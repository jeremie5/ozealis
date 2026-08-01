import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "../mobile/node_modules/typescript/lib/typescript.js";

const root = resolve(import.meta.dirname, "..");
const sourcePath = resolve(root, "mobile/src/liveEvidence.ts");
const tempDir = mkdtempSync(join(tmpdir(), "ozealis-live-evidence-"));
const header =
  "ms,setpoint_hPa,pressure_hPa,flow_hPa,vin,mode,measured_cm,error_cm,controller_amp,motor_cmd,motor_fault,motor_i2c,motor_fg_hz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c";

function liveRow(ms) {
  return `${ms},8,8.1,0.2,12.1,2,8.1,0.1,100,1200,0,1,240,NAN,NAN,0,NAN,NAN,NAN`;
}

try {
  const source = readFileSync(sourcePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const modulePath = join(tempDir, "liveEvidence.mjs");
  writeFileSync(modulePath, output.outputText);

  const {
    LIVE_EVIDENCE_MANIFEST_VERSION,
    LIVE_EVIDENCE_MIN_FRESH_ROWS,
    buildLiveEvidenceManifest,
    decideLiveEvidenceSample,
    isSameLiveEvidenceOwner,
    liveEvidenceHash,
    parseLiveEvidenceManifest,
    restoreLiveEvidenceSnapshot,
    serializeLiveEvidenceManifest,
  } = await import(pathToFileURL(modulePath).href);

  assert.equal(LIVE_EVIDENCE_MANIFEST_VERSION, 1);
  assert.equal(LIVE_EVIDENCE_MIN_FRESH_ROWS, 10);
  assert.equal(liveEvidenceHash("hello\n"), "f8934173", "the manifest must use FNV-1a over UTF-8 bytes");

  const owner = { deviceId: "ozealis-a", sessionId: 7 };
  const rows = [liveRow(100), liveRow(200), liveRow(300)];
  const csv = `${header}\n${rows.join("\n")}`;
  const manifest = buildLiveEvidenceManifest({
    csv,
    rows,
    owner,
    appVersion: "1.0.0",
    protocol: "ozealis-ble-v3",
    createdAtMs: 1_000,
    nowMs: 2_000,
  });
  assert.ok(manifest);
  assert.deepEqual(
    manifest,
    {
      version: 1,
      deviceId: "ozealis-a",
      appSessionId: 7,
      appVersion: "1.0.0",
      protocol: "ozealis-ble-v3",
      createdAtMs: 1_000,
      updatedAtMs: 2_000,
      firstDeviceMs: 100,
      lastDeviceMs: 300,
      rowCount: 3,
      byteCount: Buffer.byteLength(csv, "utf8"),
      fnv1aHash: liveEvidenceHash(csv),
    },
  );
  assert.equal(Object.keys(manifest).length, 12, "the commit marker must contain the complete provenance schema");

  const serialized = serializeLiveEvidenceManifest(manifest);
  assert.deepEqual(parseLiveEvidenceManifest(serialized), manifest);
  assert.deepEqual(
    restoreLiveEvidenceSnapshot(csv, serialized, header, 36_000, (row) => row.split(",").length === 19),
    { csv, rows, manifest },
  );

  assert.equal(isSameLiveEvidenceOwner(owner, "ozealis-a", 7), true);
  assert.equal(isSameLiveEvidenceOwner(owner, "ozealis-a", 8), false);
  assert.equal(isSameLiveEvidenceOwner(owner, "ozealis-b", 7), false);
  assert.equal(isSameLiveEvidenceOwner(null, "ozealis-a", 7), false);

  const decisionInput = {
    currentOwner: owner,
    evidenceOwner: owner,
    incomingOwner: owner,
    evidenceRestored: false,
    hasEvidenceRows: true,
    lastDeviceMs: 1_000,
    incomingDeviceMs: 1_100,
    restartBackstepMs: 5_000,
    maximumGapMs: 1_000,
  };
  assert.equal(decideLiveEvidenceSample(decisionInput), "append");
  assert.equal(
    decideLiveEvidenceSample({ ...decisionInput, incomingOwner: { ...owner, sessionId: 6 } }),
    "reject",
    "a stale callback from an older connection generation must be rejected",
  );
  assert.equal(
    decideLiveEvidenceSample({ ...decisionInput, incomingOwner: { deviceId: "", sessionId: 7 } }),
    "reject",
  );
  assert.equal(
    decideLiveEvidenceSample({ ...decisionInput, incomingOwner: { deviceId: "ozealis-a", sessionId: 0 } }),
    "reject",
  );
  assert.equal(
    decideLiveEvidenceSample({
      ...decisionInput,
      currentOwner: { deviceId: "ozealis-b", sessionId: 8 },
      incomingOwner: { deviceId: "ozealis-b", sessionId: 8 },
    }),
    "replace",
    "a replacement device must start a new evidence source",
  );
  assert.equal(
    decideLiveEvidenceSample({ ...decisionInput, evidenceRestored: true }),
    "replace",
    "a restored same-device/same-session-number source must still be replaced",
  );
  assert.equal(
    decideLiveEvidenceSample({ ...decisionInput, incomingDeviceMs: 1_000 }),
    "ignore",
    "a duplicate device timestamp must not be appended",
  );
  assert.equal(
    decideLiveEvidenceSample({ ...decisionInput, lastDeviceMs: 10_000, incomingDeviceMs: 6_000 }),
    "ignore",
    "a small stale backstep must not replace a healthy source",
  );
  assert.equal(
    decideLiveEvidenceSample({ ...decisionInput, lastDeviceMs: 10_000, incomingDeviceMs: 4_999 }),
    "replace",
    "a large firmware timestamp backstep must reset source ownership and freshness",
  );
  assert.equal(
    decideLiveEvidenceSample({ ...decisionInput, incomingDeviceMs: 2_001 }),
    "replace",
    "an over-cadence forward gap must reset source ownership and freshness",
  );
  let freshRows = 9;
  const gapAction = decideLiveEvidenceSample({ ...decisionInput, incomingDeviceMs: 2_001 });
  if (gapAction === "replace") freshRows = 0;
  freshRows += 1;
  assert.equal(freshRows, 1, "the first row after a source reset must restart the fresh-row count");

  const withField = (field, value) => serializeLiveEvidenceManifest({ ...manifest, [field]: value });
  for (const [field, value] of [
    ["version", 2],
    ["appSessionId", 0],
    ["createdAtMs", 2_001],
    ["firstDeviceMs", 99],
    ["lastDeviceMs", 301],
    ["rowCount", 4],
    ["byteCount", manifest.byteCount + 1],
    ["fnv1aHash", "00000000"],
  ]) {
    assert.equal(
      restoreLiveEvidenceSnapshot(csv, withField(field, value), header, 36_000, () => true),
      null,
      `${field} mismatch must fail closed`,
    );
  }

  assert.equal(
    parseLiveEvidenceManifest(JSON.stringify({ ...manifest, unexpected: true })),
    null,
    "unknown manifest fields must fail closed",
  );
  assert.equal(restoreLiveEvidenceSnapshot(csv, "", header, 36_000, () => true), null);
  assert.equal(restoreLiveEvidenceSnapshot(`${csv}\n`, serialized, header, 36_000, () => true), null);
  assert.equal(restoreLiveEvidenceSnapshot(csv.replace("8.1,0.2", "8.2,0.2"), serialized, header, 36_000, () => true), null);
  assert.equal(restoreLiveEvidenceSnapshot(csv, serialized, header, 2, () => true), null);
  assert.equal(restoreLiveEvidenceSnapshot(csv, serialized, header, 36_000, (row) => !row.startsWith("200,")), null);

  assert.equal(
    buildLiveEvidenceManifest({
      csv: "",
      rows: [],
      owner,
      appVersion: "1.0.0",
      protocol: "ozealis-ble-v3",
      createdAtMs: 1_000,
      nowMs: 2_000,
    }),
    null,
  );
  assert.equal(
    buildLiveEvidenceManifest({
      csv,
      rows,
      owner: { deviceId: "ozealis-a", sessionId: 0 },
      appVersion: "1.0.0",
      protocol: "ozealis-ble-v3",
      createdAtMs: 1_000,
      nowMs: 2_000,
    }),
    null,
  );

  const appSource = readFileSync(resolve(root, "mobile/App.tsx"), "utf8");
  assert.match(
    appSource,
    /captureLiveCsv\(device, sessionId, value\)/,
    "the telemetry callback must pass its exact device/session identity into capture",
  );
  assert.match(
    appSource,
    /!liveSyncRestoredRef\.current\s*&&\s*isSameLiveEvidenceOwner/,
    "a restored owner must never be accepted as the current callback owner",
  );
  assert.match(
    appSource,
    /freshRows === LIVE_EVIDENCE_MIN_FRESH_ROWS/,
    "live analysis must wait for the explicit fresh-row threshold",
  );
  assert.match(
    appSource,
    /&& liveSyncSessionActive\s*&& liveSyncModeEligible/,
    "a completed or inactive therapy trace must remain export-only rather than current analysis evidence",
  );
  assert.match(
    appSource,
    /liveSyncManifest\.appVersion === appVersion\s*&& liveSyncManifest\.protocol === OZEALIS_PROTOCOL_VERSION/,
    "live analysis admission must match the current app and protocol build",
  );
  const flushStart = appSource.indexOf("function flushLiveSyncSpool()");
  const flushEnd = appSource.indexOf("function rowsMatch(", flushStart);
  assert.ok(flushStart >= 0 && flushEnd > flushStart, "the live-spool flush function must remain inspectable");
  const flushSource = appSource.slice(flushStart, flushEnd);
  const appendBranchStart = flushSource.indexOf("if (liveSyncRowsRef.current.length >= maxLiveSyncRows)");
  assert.ok(appendBranchStart >= 0, "the bounded append branch must remain inspectable");
  const appendBranch = flushSource.slice(appendBranchStart);
  const appendCsvWrite = appendBranch.indexOf('file.write(`\\n${pending.join("\\n")}`, { append: true });');
  const appendManifestWrite = appendBranch.indexOf("manifestFile.write(serializeLiveEvidenceManifest(manifest));");
  assert.ok(
    appendCsvWrite >= 0 && appendManifestWrite > appendCsvWrite,
    "incremental commits must write CSV before the manifest commit marker",
  );
  assert.match(
    appSource,
    /if \(!Number\.isFinite\(value\)\) \{\s*return <View key=\{`\$\{label\}-\$\{index\}`\} style=\{styles\.graphGap\} \/>;/,
    "non-finite graph samples must render as gaps",
  );

  console.log("Mobile live evidence tests passed.");
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
