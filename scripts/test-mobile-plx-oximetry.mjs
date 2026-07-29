import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "../mobile/node_modules/typescript/lib/typescript.js";

const root = resolve(import.meta.dirname, "..");
const sourcePath = resolve(root, "mobile/src/plxOximetry.ts");
const tempDir = mkdtempSync(join(tmpdir(), "ozealis-plx-oximetry-"));

function sfloat(mantissa, exponent) {
  const mantissaRaw = mantissa < 0 ? 0x1000 + mantissa : mantissa;
  const exponentRaw = exponent < 0 ? 0x10 + exponent : exponent;
  return (exponentRaw << 12) | mantissaRaw;
}

function measurement(spo2Raw, pulseRaw, flags = 0) {
  return Buffer.from([flags, spo2Raw & 0xff, spo2Raw >> 8, pulseRaw & 0xff, pulseRaw >> 8]).toString("base64");
}

try {
  const source = readFileSync(sourcePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const modulePath = join(tempDir, "plxOximetry.mjs");
  writeFileSync(modulePath, output.outputText);

  const { decodeBluetoothSfloat, formatOximetryStatus, LatestOnlyAsyncRelay, OXIMETRY_STALE_MS, parsePlxContinuousMeasurement } =
    await import(pathToFileURL(modulePath).href);

  assert.equal(decodeBluetoothSfloat(sfloat(975, -1)), 97.5);
  assert.equal(decodeBluetoothSfloat(sfloat(620, -1)), 62);
  assert.equal(decodeBluetoothSfloat(sfloat(98, 0)), 98);
  assert.equal(decodeBluetoothSfloat(sfloat(-10, 0)), -10);

  assert.deepEqual(parsePlxContinuousMeasurement(measurement(sfloat(975, -1), sfloat(620, -1)), 1234), {
    spo2: 97.5,
    pulse: 62,
    quality: 0,
    receivedAt: 1234,
    source: "bluetooth",
  });
  assert.deepEqual(parsePlxContinuousMeasurement(measurement(sfloat(98, 0), sfloat(62, 0), 0xff), 5678), {
    spo2: 98,
    pulse: 62,
    quality: 0,
    receivedAt: 5678,
    source: "bluetooth",
  });

  assert.equal(parsePlxContinuousMeasurement(null), null);
  assert.equal(parsePlxContinuousMeasurement(""), null);
  assert.equal(parsePlxContinuousMeasurement(Buffer.from([0, 1, 2, 3]).toString("base64")), null);
  assert.equal(parsePlxContinuousMeasurement(measurement(sfloat(495, -1), sfloat(620, -1))), null);
  assert.equal(parsePlxContinuousMeasurement(measurement(sfloat(1010, -1), sfloat(620, -1))), null);
  assert.equal(parsePlxContinuousMeasurement(measurement(sfloat(975, -1), sfloat(190, -1))), null);
  assert.equal(parsePlxContinuousMeasurement(measurement(sfloat(975, -1), sfloat(2510, -1))), null);
  assert.equal(parsePlxContinuousMeasurement(measurement(sfloat(-975, -1), sfloat(620, -1))), null);

  const phoneSample = {
    spo2: 97.5,
    pulse: 62,
    quality: 0,
    receivedAt: 1,
    source: "bluetooth",
  };
  assert.equal(OXIMETRY_STALE_MS, 10000);
  assert.equal(formatOximetryStatus("--", undefined, phoneSample, 10000).present, true);
  assert.equal(formatOximetryStatus("--", undefined, phoneSample, 10002).present, false);
  assert.equal(formatOximetryStatus("--", undefined, { ...phoneSample, spo2: 101 }, 2).present, false);
  assert.equal(formatOximetryStatus("--", undefined, { ...phoneSample, pulse: 19 }, 2).present, false);

  const freshDeviceRaw = JSON.stringify({ present: true, spo2: 98, pulse: 63, quality: 90, source: "i2c", ageMs: 0 });
  assert.equal(formatOximetryStatus(freshDeviceRaw, 1, null, 10000).present, true);
  assert.equal(formatOximetryStatus(freshDeviceRaw, 1, null, 10002).present, false);
  assert.equal(
    formatOximetryStatus(JSON.stringify({ present: true, spo2: 98, pulse: 63, source: "ble", ageMs: 10001 }), 100, null, 100).present,
    false,
  );
  assert.equal(
    formatOximetryStatus(JSON.stringify({ present: true, spo2: 98, pulse: 63, source: "ble", ageMs: -1 }), 100, null, 100).present,
    false,
  );
  assert.equal(
    formatOximetryStatus(JSON.stringify({ present: true, spo2: 49.9, pulse: 63, source: "ble", ageMs: 0 }), 100, null, 100).present,
    false,
  );
  assert.equal(
    formatOximetryStatus(JSON.stringify({ present: true, spo2: 98, pulse: 250.1, source: "ble", ageMs: 0 }), 100, null, 100).present,
    false,
  );
  assert.equal(
    formatOximetryStatus(JSON.stringify({ present: true, spo2: 98, pulse: 63, source: "ble", ageMs: 5000 }), 1, null, 5002).present,
    false,
  );

  const relayed = [];
  let releaseFirst;
  const firstBlocked = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  const relay = new LatestOnlyAsyncRelay(async (value) => {
    relayed.push(value);
    if (value === 1) await firstBlocked;
  });
  relay.push(1);
  relay.push(2);
  relay.push(3);
  releaseFirst();
  await relay.whenIdle();
  assert.deepEqual(relayed, [1, 3]);

  const cleared = [];
  let releaseClearTest;
  const clearBlocked = new Promise((resolve) => {
    releaseClearTest = resolve;
  });
  const clearRelay = new LatestOnlyAsyncRelay(async (value) => {
    cleared.push(value);
    if (value === 1) await clearBlocked;
  });
  clearRelay.push(1);
  clearRelay.push(2);
  clearRelay.clearPending();
  releaseClearTest();
  await clearRelay.whenIdle();
  assert.deepEqual(cleared, [1]);

  const relayErrors = [];
  const errorRelay = new LatestOnlyAsyncRelay(
    async () => {
      throw new Error("relay failed");
    },
    (error) => relayErrors.push(error.message),
  );
  errorRelay.push(1);
  await errorRelay.whenIdle();
  assert.deepEqual(relayErrors, ["relay failed"]);

  console.log("Mobile PLX oximetry tests passed.");
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
