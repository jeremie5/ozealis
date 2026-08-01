import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import ts from "../mobile/node_modules/typescript/lib/typescript.js";

const root = resolve(import.meta.dirname, "..");
const tempDir = mkdtempSync(join(tmpdir(), "ozealis-session-archive-"));
const appVersion = "1.0.0";
const protocol = "ozealis-ble-v3";
const privateDeviceId = "PRIVATE-BLE-DEVICE-ID";
const secondPrivateDeviceId = "SECOND-PRIVATE-BLE-DEVICE-ID";
const retainedHeader =
  "ms,setpoint_cm,pressure_cmH2O,error_cmH2O,flowProxy_hPa,motorAmp,controller_error_cm,controller_amp,motorCmd,motorFault,motorI2c,motorFgHz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c,sample_kind";
const liveHeader =
  "ms,setpoint_hPa,pressure_hPa,flow_hPa,vin,mode,measured_cm,error_cm,controller_amp,motor_cmd,motor_fault,motor_i2c,motor_fg_hz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c";
const faultHeader =
  "ts_ms,sys_mode,fault,vin_V,pMask_hPa,pBlower_hPa,ambient_hPa,diff_hPa,setpoint_cm,flowProxy_hPa,motorAmp,motorCmd,motorFault,motorI2c,motorFgHz,loop_us,miss1,miss2,i2cErr1,i2cErr2";
const digestSha256 = async (value) => sha256(value);

try {
  for (const moduleName of [
    "csvTransfer",
    "liveEvidence",
    "validation",
    "sessionReport",
    "sessionArchive",
  ]) {
    const source = readFileSync(resolve(root, `mobile/src/${moduleName}.ts`), "utf8");
    const output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ES2022,
        target: ts.ScriptTarget.ES2022,
      },
    });
    const runnable = output.outputText.replace(
      /from "(\.\/[^"]+)";/g,
      (_match, specifier) => `from "${specifier}.mjs";`,
    );
    writeFileSync(join(tempDir, `${moduleName}.mjs`), runnable);
  }

  const { csvTransferHash } = await import(pathToFileURL(join(tempDir, "csvTransfer.mjs")).href);
  const { buildLiveEvidenceManifest } = await import(
    pathToFileURL(join(tempDir, "liveEvidence.mjs")).href
  );
  const { serializeSessionReportV1 } = await import(
    pathToFileURL(join(tempDir, "sessionReport.mjs")).href
  );
  const {
    SESSION_ARCHIVE_SCHEMA,
    SESSION_ARCHIVE_SCHEMA_VERSION,
    SESSION_ARCHIVE_MAX_ENTRY_BYTES,
    SESSION_ARCHIVE_MAX_ENTRIES,
    SESSION_ARCHIVE_MAX_TOTAL_BYTES,
    SESSION_COMPARISON_SCHEMA,
    SESSION_COMPARISON_SCHEMA_VERSION,
    compareSessionArchiveRecords,
    createSessionArchiveEntryV1,
    serializeSessionArchiveEntryV1,
    serializeSessionComparisonV1,
    sortSessionArchiveRecords,
    verifySessionArchiveEntryV1,
  } = await import(pathToFileURL(join(tempDir, "sessionArchive.mjs")).href);

  const retainedInput = makeRetainedInput(csvTransferHash, privateDeviceId, {
    pressure: 8,
    flow: 2,
    motorCommand: 40,
    importedAtMs: 1_770_000_000_000,
    sessionGeneration: 17,
  });
  const retainedReportJson = await serializeSessionReportV1(retainedInput, digestSha256);
  assert.ok(retainedReportJson);
  const retainedRecord = await createSessionArchiveEntryV1(
    {
      ownerDeviceId: privateDeviceId,
      archivedAtMs: 1_800_000_000_000,
      reportInput: retainedInput,
      reportJson: retainedReportJson,
    },
    digestSha256,
  );
  assert.ok(retainedRecord, "valid retained evidence must produce an archive entry");
  assert.equal(retainedRecord.entry.schema, SESSION_ARCHIVE_SCHEMA);
  assert.equal(retainedRecord.entry.schemaVersion, SESSION_ARCHIVE_SCHEMA_VERSION);
  assert.equal(SESSION_ARCHIVE_MAX_ENTRIES, 250);
  assert.equal(SESSION_ARCHIVE_MAX_ENTRY_BYTES, 40_000_000);
  assert.equal(SESSION_ARCHIVE_MAX_TOTAL_BYTES, 256 * 1024 * 1024);
  assert.match(retainedRecord.entry.archiveId, /^[0-9a-f]{64}$/);
  assert.match(retainedRecord.entry.envelopeSha256, /^[0-9a-f]{64}$/);
  assert.match(retainedRecord.entry.owner.fingerprint, /^[0-9a-f]{64}$/);
  assert.equal(
    retainedRecord.entry.owner.fingerprint,
    "0553e9ba5b61bfe6154a614a9ea0d430dfc0448bf2872bb98c385d06b413cbc7",
    "the owner-fingerprint domain and byte encoding must remain stable",
  );
  assert.equal(
    retainedRecord.entry.owner.fingerprint,
    sha256(`ozealis-owner-v1\u0000${privateDeviceId}`),
    "the owner fingerprint must match an independently computed positive vector",
  );
  assert.equal(
    retainedRecord.entry.reportInput.source.manifest.deviceId,
    `archive:${retainedRecord.entry.owner.fingerprint}`,
  );
  assert.equal(retainedRecord.entry.evidence.rawCsv, retainedInput.rawCsv);
  assert.equal(
    retainedRecord.entry.evidence.selectedAirflowCsv,
    null,
    "selected evidence should alias raw bytes when they are identical",
  );
  assert.equal(retainedRecord.entry.evidence.faultCsv, faultHeader);
  assert.equal(retainedRecord.entry.report.json, retainedReportJson);

  const retainedSerialized = serializeSessionArchiveEntryV1(retainedRecord.entry);
  assert.ok(retainedSerialized.endsWith("\n"));
  assert.equal(retainedSerialized.endsWith("\n\n"), false);
  assert.equal(
    retainedSerialized,
    serializeSessionArchiveEntryV1(retainedRecord.entry),
    "archive serialization must be byte-deterministic",
  );
  assert.equal(retainedSerialized.includes(privateDeviceId), false);
  assert.equal(retainedSerialized.includes("731337"), false);
  const restoredRetained = await verifySessionArchiveEntryV1(
    retainedSerialized,
    digestSha256,
  );
  assert.deepEqual(restoredRetained, retainedRecord);

  const repeatedRetained = await createSessionArchiveEntryV1(
    {
      ownerDeviceId: privateDeviceId,
      archivedAtMs: 1_800_000_000_000,
      reportInput: retainedInput,
      reportJson: retainedReportJson,
    },
    digestSha256,
  );
  assert.deepEqual(
    repeatedRetained,
    retainedRecord,
    "the same immutable capture must produce the same content identity",
  );
  const laterEnvelope = await createSessionArchiveEntryV1(
    {
      ownerDeviceId: privateDeviceId,
      archivedAtMs: 1_800_000_000_001,
      reportInput: retainedInput,
      reportJson: retainedReportJson,
    },
    digestSha256,
  );
  assert.ok(laterEnvelope);
  assert.equal(
    laterEnvelope.entry.archiveId,
    retainedRecord.entry.archiveId,
    "deduplication must retain one stable evidence-content identity",
  );
  assert.notEqual(
    laterEnvelope.entry.envelopeSha256,
    retainedRecord.entry.envelopeSha256,
    "the committed envelope digest must bind its distinct app save-time anchor",
  );

  const currentInput = makeRetainedInput(csvTransferHash, privateDeviceId, {
    pressure: 9,
    flow: 2.5,
    motorCommand: 45,
    importedAtMs: 1_771_000_000_000,
    sessionGeneration: 18,
  });
  const currentRecord = await archiveInput(
    currentInput,
    privateDeviceId,
    1_801_000_000_000,
    serializeSessionReportV1,
    createSessionArchiveEntryV1,
  );
  assert.notEqual(currentRecord.entry.archiveId, retainedRecord.entry.archiveId);

  const secondDeviceInput = makeRetainedInput(csvTransferHash, secondPrivateDeviceId, {
    pressure: 9,
    flow: 2.5,
    motorCommand: 45,
    importedAtMs: 1_771_000_000_000,
    sessionGeneration: 18,
  });
  const secondDeviceRecord = await archiveInput(
    secondDeviceInput,
    secondPrivateDeviceId,
    1_801_000_000_000,
    serializeSessionReportV1,
    createSessionArchiveEntryV1,
  );
  assert.notEqual(
    secondDeviceRecord.entry.archiveId,
    currentRecord.entry.archiveId,
    "byte-identical evidence from another local device owner must not deduplicate",
  );
  assert.notEqual(
    secondDeviceRecord.entry.owner.fingerprint,
    currentRecord.entry.owner.fingerprint,
  );

  const liveRows = Array.from({ length: 200 }, (_, index) =>
    liveRow(index * 100, { pressure: 8.5, flow: 2.2, motorCommand: 77 }),
  );
  const liveRaw = [liveHeader, ...liveRows].join("\n");
  const liveManifest = buildLiveEvidenceManifest({
    csv: liveRaw,
    rows: liveRows,
    owner: { deviceId: privateDeviceId, sessionId: 731_337 },
    appVersion,
    protocol,
    createdAtMs: 1_802_000_000_000,
    nowMs: 1_802_000_019_900,
  });
  assert.ok(liveManifest);
  const liveInput = {
    rawCsv: liveRaw,
    reportingAppVersion: appVersion,
    expectedProtocol: protocol,
    source: {
      kind: "live_app_sync",
      manifest: liveManifest,
    },
  };
  const liveRecord = await archiveInput(
    liveInput,
    privateDeviceId,
    1_802_000_020_000,
    serializeSessionReportV1,
    createSessionArchiveEntryV1,
  );
  assert.equal(liveRecord.entry.evidence.faultCsv, null);
  assert.equal(liveRecord.entry.reportInput.source.kind, "live_app_sync");
  assert.equal(liveRecord.entry.reportInput.source.manifest.appSessionId, 1);
  assert.equal(
    serializeSessionArchiveEntryV1(liveRecord.entry).includes("731337"),
    false,
    "the private app-session identity must not enter the archive bundle",
  );

  const tamperCases = [
    ["raw evidence", (entry) => {
      entry.evidence.rawCsv = entry.evidence.rawCsv.replace(",8,8,", ",8,9,");
    }],
    ["fault evidence", (entry) => {
      entry.evidence.faultCsv = `${entry.evidence.faultCsv}\n`;
    }],
    ["selected evidence", (entry) => {
      entry.evidence.selectedAirflowCsv = entry.evidence.rawCsv.replace(",8,8,", ",8,9,");
    }],
    ["stored report", (entry) => {
      entry.report.json = entry.report.json.replace('"mean": 8', '"mean": 8.1');
    }],
    ["report digest", (entry) => {
      entry.report.sha256 = "0".repeat(64);
    }],
    ["raw digest", (entry) => {
      entry.reportInput.rawSha256 = "0".repeat(64);
    }],
    ["selected digest", (entry) => {
      entry.reportInput.selectedAirflowSha256 = "0".repeat(64);
    }],
    ["fault digest", (entry) => {
      entry.reportInput.source.faultSha256 = "0".repeat(64);
    }],
    ["owner binding", (entry) => {
      entry.reportInput.source.manifest.deviceId = `archive:${"0".repeat(64)}`;
    }],
    ["content identity", (entry) => {
      entry.archiveId = "0".repeat(64);
    }],
    ["archive timestamp", (entry) => {
      entry.archivedAtMs += 1;
    }],
    ["envelope digest", (entry) => {
      entry.envelopeSha256 = "0".repeat(64);
    }],
    ["unknown field", (entry) => {
      entry.unexpected = true;
    }],
    ["future schema", (entry) => {
      entry.schemaVersion = 2;
    }],
  ];
  for (const [label, mutate] of tamperCases) {
    const entry = structuredClone(retainedRecord.entry);
    mutate(entry);
    assert.equal(
      await verifySessionArchiveEntryV1(
        `${JSON.stringify(entry, null, 2)}\n`,
        digestSha256,
      ),
      null,
      `${label} tampering must reject only that entry`,
    );
  }
  for (const [label, mutate] of tamperCases.slice(0, 10)) {
    const entry = structuredClone(retainedRecord.entry);
    mutate(entry);
    entry.envelopeSha256 = archiveEnvelopeSha256(entry);
    assert.equal(
      await verifySessionArchiveEntryV1(
        `${JSON.stringify(entry, null, 2)}\n`,
        digestSha256,
      ),
      null,
      `${label} tampering must still fail after recomputing the unkeyed envelope digest`,
    );
  }
  const noncanonicalAliasEntry = structuredClone(retainedRecord.entry);
  noncanonicalAliasEntry.evidence.selectedAirflowCsv =
    noncanonicalAliasEntry.evidence.rawCsv;
  noncanonicalAliasEntry.envelopeSha256 =
    archiveEnvelopeSha256(noncanonicalAliasEntry);
  assert.equal(
    await verifySessionArchiveEntryV1(
      `${JSON.stringify(noncanonicalAliasEntry, null, 2)}\n`,
      digestSha256,
    ),
    null,
    "byte-identical selected evidence must use the canonical null alias",
  );
  assert.equal(
    await verifySessionArchiveEntryV1(retainedSerialized.trimEnd(), digestSha256),
    null,
    "noncanonical archive framing must fail closed",
  );
  assert.equal(
    await createSessionArchiveEntryV1(
      {
        ownerDeviceId: secondPrivateDeviceId,
        archivedAtMs: 1_800_000_000_000,
        reportInput: retainedInput,
        reportJson: retainedReportJson,
      },
      digestSha256,
    ),
    null,
    "the archive owner must match the frozen source manifest",
  );
  assert.equal(
    await createSessionArchiveEntryV1(
      {
        ownerDeviceId: privateDeviceId,
        archivedAtMs: 1_800_000_000_000,
        reportInput: retainedInput,
        reportJson: retainedReportJson,
      },
      async () => "not-a-digest",
    ),
    null,
    "digest failures must fail closed",
  );

  assert.deepEqual(
    sortSessionArchiveRecords([
      retainedRecord,
      currentRecord,
      retainedRecord,
      liveRecord,
    ]).map((record) => record.entry.archiveId),
    [
      liveRecord.entry.archiveId,
      currentRecord.entry.archiveId,
      retainedRecord.entry.archiveId,
    ],
    "archive order must use the app archive anchor with a stable identity tie-break",
  );

  const comparison = compareSessionArchiveRecords(retainedRecord, currentRecord);
  assert.equal(comparison.schema, SESSION_COMPARISON_SCHEMA);
  assert.equal(comparison.schemaVersion, SESSION_COMPARISON_SCHEMA_VERSION);
  assert.equal(comparison.status, "comparable");
  assert.deepEqual(comparison.reasonCodes, []);
  const pressureMetric = metric(comparison, "mean_pressure_cm_h2o");
  assert.deepEqual(
    pressureMetric,
    {
      code: "mean_pressure_cm_h2o",
      label: "Mean pressure",
      unit: "cmH2O",
      baseline: 8,
      current: 9,
      delta: 1,
      deltaState: "available",
      reasonCode: null,
    },
  );
  const reverseComparison = compareSessionArchiveRecords(currentRecord, retainedRecord);
  assert.equal(metric(reverseComparison, "mean_pressure_cm_h2o").delta, -1);
  assert.equal(reverseComparison.baselineArchiveId, currentRecord.entry.archiveId);
  assert.equal(reverseComparison.currentArchiveId, retainedRecord.entry.archiveId);

  const duplicateComparison = compareSessionArchiveRecords(retainedRecord, retainedRecord);
  assert.equal(duplicateComparison.status, "unavailable");
  assert.ok(duplicateComparison.reasonCodes.includes("same_archive_entry"));
  assert.ok(duplicateComparison.reasonCodes.includes("duplicate_selected_evidence"));
  assert.deepEqual(duplicateComparison.metrics, []);

  const foreignComparison = compareSessionArchiveRecords(
    currentRecord,
    secondDeviceRecord,
  );
  assert.equal(foreignComparison.status, "unavailable");
  assert.ok(foreignComparison.reasonCodes.includes("different_device_owner"));
  assert.deepEqual(foreignComparison.metrics, []);

  const mixedSourceComparison = compareSessionArchiveRecords(retainedRecord, liveRecord);
  assert.equal(mixedSourceComparison.status, "limited");
  assert.ok(mixedSourceComparison.reasonCodes.includes("different_source_formats"));
  assert.equal(
    metric(mixedSourceComparison, "mean_pressure_cm_h2o").deltaState,
    "suppressed",
  );
  assert.deepEqual(
    metric(mixedSourceComparison, "mean_motor_amplitude"),
    {
      code: "mean_motor_amplitude",
      label: "Mean motor amplitude",
      unit: "amplitude",
      baseline: 40,
      current: null,
      delta: null,
      deltaState: "unavailable",
      reasonCode: "missing_in_one_or_both_reports",
    },
    "a missing live motor amplitude must never be replaced by motor command",
  );

  const shortInput = makeRetainedInput(csvTransferHash, privateDeviceId, {
    rowCount: 19,
    pressure: 8.2,
    flow: 2.1,
    importedAtMs: 1_773_000_000_000,
    sessionGeneration: 19,
  });
  const shortRecord = await archiveInput(
    shortInput,
    privateDeviceId,
    1_803_000_000_000,
    serializeSessionReportV1,
    createSessionArchiveEntryV1,
  );
  const shortComparison = compareSessionArchiveRecords(retainedRecord, shortRecord);
  assert.equal(shortComparison.status, "limited");
  assert.ok(shortComparison.reasonCodes.includes("analysis_status_differs"));
  assert.ok(shortComparison.reasonCodes.includes("heuristic_analysis_unavailable"));
  assert.equal(
    metric(shortComparison, "heuristic_window_count").deltaState,
    "unavailable",
  );

  const cappedWindowsRecord = structuredClone(currentRecord);
  cappedWindowsRecord.report.analysis.windows = Array.from({ length: 50 }, (_, index) => ({
    startDeviceMs: index * 20_000,
    endDeviceMs: index * 20_000 + 10_000,
    creditedDurationMs: 10_000,
    type: "partial_low_flow_reduction",
    flowReductionPercent: 50,
  }));
  const cappedComparison = compareSessionArchiveRecords(
    retainedRecord,
    cappedWindowsRecord,
  );
  assert.ok(cappedComparison.reasonCodes.includes("window_result_limit_ambiguous"));
  assert.equal(
    metric(cappedComparison, "heuristic_window_count").deltaState,
    "suppressed",
  );

  const rollingTruncationRecord = structuredClone(currentRecord);
  rollingTruncationRecord.report.evidence.rollingWindow.possibleTruncation = true;
  const rollingTruncationComparison = compareSessionArchiveRecords(
    retainedRecord,
    rollingTruncationRecord,
  );
  assert.equal(rollingTruncationComparison.status, "limited");
  assert.ok(
    rollingTruncationComparison.reasonCodes.includes("possible_rolling_truncation"),
  );
  assert.equal(
    metric(rollingTruncationComparison, "mean_pressure_cm_h2o").deltaState,
    "suppressed",
  );
  assert.ok(
    rollingTruncationComparison.limitations.some((text) =>
      text.includes("rolling row limit")),
  );

  for (const coverageRatio of [null, 0.79]) {
    const lowCoverageRecord = structuredClone(currentRecord);
    lowCoverageRecord.report.evidence.cadence.coverageRatio = coverageRatio;
    const lowCoverageComparison = compareSessionArchiveRecords(
      retainedRecord,
      lowCoverageRecord,
    );
    assert.equal(lowCoverageComparison.status, "limited");
    assert.ok(lowCoverageComparison.reasonCodes.includes("low_cadence_coverage"));
    assert.equal(
      metric(lowCoverageComparison, "mean_pressure_cm_h2o").deltaState,
      "suppressed",
    );
    assert.ok(
      lowCoverageComparison.limitations.some((text) =>
        text.includes("low-coverage cadence")),
    );
  }
  const thresholdCoverageRecord = structuredClone(currentRecord);
  thresholdCoverageRecord.report.evidence.cadence.coverageRatio = 0.8;
  const thresholdCoverageComparison = compareSessionArchiveRecords(
    retainedRecord,
    thresholdCoverageRecord,
  );
  assert.equal(
    thresholdCoverageComparison.reasonCodes.includes("low_cadence_coverage"),
    false,
    "cadence coverage exactly at the comparison threshold must remain eligible",
  );
  assert.equal(
    metric(thresholdCoverageComparison, "mean_pressure_cm_h2o").deltaState,
    "available",
  );

  const durationBaselineMs = retainedRecord.report.evidence.creditedDurationMs;
  const longDurationRecord = structuredClone(currentRecord);
  longDurationRecord.report.evidence.creditedDurationMs = durationBaselineMs * 2 + 1;
  const longDurationComparison = compareSessionArchiveRecords(
    retainedRecord,
    longDurationRecord,
  );
  assert.equal(longDurationComparison.status, "limited");
  assert.ok(
    longDurationComparison.reasonCodes.includes("different_evidence_durations"),
  );
  assert.equal(
    metric(longDurationComparison, "mean_pressure_cm_h2o").deltaState,
    "suppressed",
  );
  assert.ok(
    longDurationComparison.limitations.some((text) =>
      text.includes("more than twofold")),
  );
  const thresholdDurationRecord = structuredClone(currentRecord);
  thresholdDurationRecord.report.evidence.creditedDurationMs = durationBaselineMs * 2;
  const thresholdDurationComparison = compareSessionArchiveRecords(
    retainedRecord,
    thresholdDurationRecord,
  );
  assert.equal(
    thresholdDurationComparison.reasonCodes.includes("different_evidence_durations"),
    false,
    "evidence duration exactly at the twofold boundary must remain eligible",
  );
  assert.equal(
    metric(thresholdDurationComparison, "mean_pressure_cm_h2o").deltaState,
    "available",
  );

  const analysisContractRecord = structuredClone(currentRecord);
  analysisContractRecord.report.analysis.thresholds.minimumRows += 1;
  const analysisContractComparison = compareSessionArchiveRecords(
    retainedRecord,
    analysisContractRecord,
  );
  assert.equal(analysisContractComparison.status, "limited");
  assert.ok(
    analysisContractComparison.reasonCodes.includes("analysis_contract_differs"),
  );
  assert.equal(
    metric(analysisContractComparison, "mean_pressure_cm_h2o").deltaState,
    "available",
  );
  assert.equal(
    metric(analysisContractComparison, "heuristic_window_count").deltaState,
    "unavailable",
  );
  assert.ok(
    analysisContractComparison.limitations.some((text) =>
      text.includes("analysis algorithm or thresholds")),
  );

  const reportingVersionRecord = structuredClone(currentRecord);
  reportingVersionRecord.report.reportingSoftware.appVersion = "1.0.1";
  const reportingVersionComparison = compareSessionArchiveRecords(
    retainedRecord,
    reportingVersionRecord,
  );
  assert.equal(reportingVersionComparison.status, "limited");
  assert.ok(
    reportingVersionComparison.reasonCodes.includes("reporting_software_differs"),
  );
  assert.equal(
    metric(reportingVersionComparison, "mean_pressure_cm_h2o").deltaState,
    "available",
  );

  const discardedSegmentRecord = structuredClone(currentRecord);
  discardedSegmentRecord.report.evidence.discardedAirflowRows = 1;
  const discardedSegmentComparison = compareSessionArchiveRecords(
    retainedRecord,
    discardedSegmentRecord,
  );
  assert.equal(discardedSegmentComparison.status, "limited");
  assert.ok(
    discardedSegmentComparison.reasonCodes.includes("discarded_earlier_segments"),
  );
  assert.equal(
    metric(discardedSegmentComparison, "mean_pressure_cm_h2o").deltaState,
    "available",
  );
  assert.ok(
    discardedSegmentComparison.limitations.some((text) =>
      text.includes("latest contiguous airflow segment")),
  );

  const comparisonJson = serializeSessionComparisonV1(comparison);
  assert.ok(comparisonJson);
  assert.equal(comparisonJson, serializeSessionComparisonV1(comparison));
  assert.ok(comparisonJson.endsWith("\n"));
  assert.equal(comparisonJson.includes(privateDeviceId), false);
  assert.equal(comparisonJson.includes(secondPrivateDeviceId), false);
  assert.equal(comparisonJson.includes(retainedHeader), false);
  assert.doesNotMatch(comparisonJson, /\b(?:confidence|probability|severity|better|worse)\b/i);
  assert.doesNotMatch(comparisonJson, /\b(?:NaN|Infinity|-Infinity)\b/);

  const appSource = readFileSync(resolve(root, "mobile/App.tsx"), "utf8");
  const restoreSource = sliceBetween(
    appSource,
    "  async function restoreSessionArchive()",
    "  function retainedCsvMatchesIdentity(",
  );
  assert.match(restoreSource, /if \(Platform\.OS === "web"\)/);
  assert.match(
    restoreSource,
    /setSessionArchiveIssueCount\(0\)/,
    "the web preview must not present unsupported native storage as archive corruption",
  );
  assert.match(restoreSource, /sessionArchiveFileNamePattern\.test\(file\.name\)/);
  assert.match(restoreSource, /sessionArchivePendingFileNamePattern\.test\(file\.name\)/);
  assert.match(restoreSource, /await pendingFile\.move\(finalFile\)/);
  assert.match(restoreSource, /SESSION_ARCHIVE_MAX_TOTAL_BYTES/);
  assert.match(restoreSource, /SESSION_ARCHIVE_MAX_ENTRY_BYTES/);
  assert.match(restoreSource, /sessionArchiveReadyRef\.current = false/);
  assert.match(restoreSource, /return false/);
  assert.match(restoreSource, /verifySessionArchiveEntryV1\(/);
  assert.match(restoreSource, /issueCount \+= 1/);
  assert.doesNotMatch(
    restoreSource,
    /\.delete\(\)/,
    "restore must isolate damaged entries instead of deleting them",
  );

  const saveSource = sliceBetween(
    appSource,
    "  async function saveCurrentSessionCapture()",
    "  async function exportArchivedReport(",
  );
  assert.match(saveSource, /enqueueSessionArchiveMutation\(async \(\) =>/);
  assert.match(saveSource, /Crypto\.randomUUID\(\)\.toLowerCase\(\)/);
  assert.match(saveSource, /`\$\{storageId\}\.pending`/);
  assert.match(saveSource, /`\$\{storageId\}\.json`/);
  assert.doesNotMatch(
    saveSource,
    /new File\([^)]*archiveId/,
    "stable evidence or owner hashes must not become archive file names",
  );
  assertOrdered(
    saveSource,
    [
      "pendingFile.write(serialized)",
      "const stagedRecord = await verifySessionArchiveEntryV1(",
      "await pendingFile.move(finalFile)",
      "const committedRecord = await verifySessionArchiveEntryV1(",
      "publishSessionArchiveRecords([",
    ],
    "archive commit/readback ordering",
  );
  assert.match(saveSource, /SESSION_ARCHIVE_MAX_ENTRIES/);
  assert.match(saveSource, /SESSION_ARCHIVE_MAX_TOTAL_BYTES/);
  assert.match(appSource, /setSessionArchiveRecords\(allRecords\.slice\(0, SESSION_ARCHIVE_MAX_ENTRIES\)\)/);
  assert.match(appSource, /label="Remove incomplete saves"/);
  assert.match(appSource, /label="Save current evidence capture"/);
  assert.match(appSource, /Saved evidence captures/);
  assert.match(appSource, /Saved comparison/);
  assert.match(appSource, /label=\{selectedAsCurrent \? "Comparison current" : "Use as current"\}/);
  assert.match(appSource, /\.map\(sessionComparisonReasonLabel\)/);
  assert.match(appSource, /Record<SessionComparisonReasonCode, string>/);
  assert.match(appSource, /record\.entry\.owner\.fingerprint/);
  const deleteSource = sliceBetween(
    appSource,
    "  function confirmDeleteArchivedSession(",
    "  function confirmDeleteIncompleteArchiveFiles()",
  );
  assert.match(deleteSource, /for \(const file of orderedFiles\)/);
  assert.match(deleteSource, /byteCount > SESSION_ARCHIVE_MAX_ENTRY_BYTES/);
  assert.match(deleteSource, /verifySessionArchiveEntryV1\(/);
  assert.match(
    deleteSource,
    /verified\?\.entry\.archiveId === current\.record\.entry\.archiveId/,
    "deleting one logical capture must remove every verified duplicate content copy",
  );
  assert.match(
    deleteSource,
    /The selected archive file changed after restore/,
    "delete must abort if its opaque file now contains another valid archive entry",
  );
  assert.match(deleteSource, /sessionArchiveReadyRef\.current = false/);

  const exportFileSource = sliceBetween(
    appSource,
    "  async function exportFile(",
    "  async function exportCsv(",
  );
  assert.match(exportFileSource, /sharingAvailable \? Paths\.cache : Paths\.document/);
  assert.match(exportFileSource, /finally \{/);
  assert.match(exportFileSource, /stagedFile\.delete\(\)/);

  console.log("Mobile session archive and comparison tests passed.");
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

async function archiveInput(
  reportInput,
  ownerDeviceId,
  archivedAtMs,
  serializeSessionReportV1,
  createSessionArchiveEntryV1,
) {
  const reportJson = await serializeSessionReportV1(reportInput, digestSha256);
  assert.ok(reportJson);
  const record = await createSessionArchiveEntryV1(
    {
      ownerDeviceId,
      archivedAtMs,
      reportInput,
      reportJson,
    },
    digestSha256,
  );
  assert.ok(record);
  return record;
}

function makeRetainedInput(
  csvTransferHash,
  deviceId,
  {
    rowCount = 20,
    pressure = 8,
    flow = 2,
    motorCommand = 40,
    importedAtMs = 1_770_000_000_000,
    sessionGeneration = 17,
  } = {},
) {
  const rawCsv = [
    retainedHeader,
    ...Array.from({ length: rowCount }, (_, index) =>
      retainedRow(index * 1_000, { pressure, flow, motorCommand }),
    ),
  ].join("\n");
  return {
    rawCsv,
    reportingAppVersion: appVersion,
    expectedProtocol: protocol,
    source: {
      kind: "retained_firmware",
      manifest: {
        version: 1,
        deviceId,
        importedAtMs,
        session: {
          generation: sessionGeneration,
          total: Buffer.byteLength(rawCsv, "utf8"),
          hash: csvTransferHash(rawCsv),
        },
        fault: {
          generation: 9,
          total: Buffer.byteLength(faultHeader, "utf8"),
          hash: csvTransferHash(faultHeader),
        },
      },
      faultCsv: faultHeader,
    },
  };
}

function retainedRow(ms, { pressure, flow, motorCommand }) {
  return [
    ms,
    8,
    pressure,
    0.1,
    flow,
    40,
    0.1,
    40,
    motorCommand,
    0,
    1,
    123.45,
    "NAN",
    "NAN",
    0,
    "NAN",
    "NAN",
    "NAN",
    "airflow_run",
  ].join(",");
}

function liveRow(ms, { pressure, flow, motorCommand }) {
  return [
    ms,
    7.84532,
    pressure / 1.019716,
    flow,
    24,
    2,
    pressure,
    0.1,
    40,
    motorCommand,
    0,
    1,
    123.45,
    "NAN",
    "NAN",
    0,
    "NAN",
    "NAN",
    "NAN",
  ].join(",");
}

function metric(comparison, code) {
  const value = comparison.metrics.find((candidate) => candidate.code === code);
  assert.ok(value, `missing comparison metric ${code}`);
  return value;
}

function sha256(raw) {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

function archiveEnvelopeSha256(entry) {
  const {
    envelopeSha256: _envelopeSha256,
    ...payload
  } = entry;
  return sha256(`ozealis-session-archive-envelope-v1\u0000${canonicalJson(payload)}`);
}

function canonicalJson(value) {
  if (value === null || typeof value !== "object") {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? "null" : serialized;
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
    .join(",")}}`;
}

function sliceBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.ok(startIndex >= 0 && endIndex > startIndex, `missing source slice ${start}`);
  return source.slice(startIndex, endIndex);
}

function assertOrdered(source, fragments, label) {
  let previousIndex = -1;
  for (const fragment of fragments) {
    const index = source.indexOf(fragment);
    assert.ok(index > previousIndex, `${label} must contain ${fragment} in order`);
    previousIndex = index;
  }
}
