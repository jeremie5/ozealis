import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import ts from "../mobile/node_modules/typescript/lib/typescript.js";

const root = resolve(import.meta.dirname, "..");
const tempDir = mkdtempSync(join(tmpdir(), "ozealis-graph-downsampling-"));

try {
  const source = readFileSync(resolve(root, "mobile/src/graphDownsampling.ts"), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const modulePath = join(tempDir, "graphDownsampling.mjs");
  writeFileSync(modulePath, output.outputText);

  const { downsampleSessionGraphPoints } = await import(pathToFileURL(modulePath).href);

  const longTrace = Array.from({ length: 36_000 }, (_, index) =>
    graphPoint(index, {
      flowHpa: index >= 10_000 && index < 10_100 ? 0.02 : 2,
      pressureCm: index === 27_777 ? 12.5 : 8,
    }),
  );
  const longDownsample = downsampleSessionGraphPoints(longTrace, 180);
  assert.equal(longDownsample.length, 180);
  assert.equal(longDownsample[0], longTrace[0], "the first evidence point must remain visible");
  assert.equal(
    longDownsample[longDownsample.length - 1],
    longTrace[longTrace.length - 1],
    "the final evidence point must remain visible",
  );
  assert.equal(
    Math.min(...longDownsample.map((point) => point.flowHpa)),
    0.02,
    "a real full-resolution low-flow interval must not disappear from the graph",
  );
  assert.equal(
    Math.max(...longDownsample.map((point) => point.pressureCm)),
    12.5,
    "a pressure excursion must survive graph downsampling",
  );
  assertStrictlyIncreasing(longDownsample);

  const isolatedOptional = Array.from({ length: 121 }, (_, index) =>
    graphPoint(index, index === 60
      ? {
          spo2Percent: 97,
          pulseBpm: 61,
          humidifierTempC: 27,
          humidifierRhPercent: 52,
          hoseTempC: 29,
        }
      : {}),
  );
  const optionalDownsample = downsampleSessionGraphPoints(isolatedOptional, 120);
  assert.equal(optionalDownsample.length, 120);
  const preservedOptional = optionalDownsample.find((point) => point.ms === 6_000);
  assert.ok(preservedOptional, "an isolated optional-channel sample must remain visible");
  assert.deepEqual(
    {
      spo2Percent: preservedOptional.spo2Percent,
      pulseBpm: preservedOptional.pulseBpm,
      humidifierTempC: preservedOptional.humidifierTempC,
      humidifierRhPercent: preservedOptional.humidifierRhPercent,
      hoseTempC: preservedOptional.hoseTempC,
    },
    {
      spo2Percent: 97,
      pulseBpm: 61,
      humidifierTempC: 27,
      humidifierRhPercent: 52,
      hoseTempC: 29,
    },
  );

  const missingOptional = Array.from({ length: 400 }, (_, index) => graphPoint(index));
  const missingOptionalDownsample = downsampleSessionGraphPoints(missingOptional, 40);
  assert.equal(
    missingOptionalDownsample.some(
      (point) =>
        Number.isFinite(point.spo2Percent)
        || Number.isFinite(point.pulseBpm)
        || Number.isFinite(point.humidifierTempC)
        || Number.isFinite(point.humidifierRhPercent)
        || Number.isFinite(point.hoseTempC),
    ),
    false,
    "downsampling must not fabricate absent optional evidence",
  );

  assert.deepEqual(downsampleSessionGraphPoints(longTrace, 0), []);
  assert.deepEqual(downsampleSessionGraphPoints(longTrace, 1), [longTrace.at(-1)]);
  assert.deepEqual(
    downsampleSessionGraphPoints(longTrace, 2),
    [longTrace[0], longTrace.at(-1)],
  );
  assert.deepEqual(
    downsampleSessionGraphPoints(longTrace, 180),
    longDownsample,
    "downsampling must be deterministic",
  );
  assert.equal(
    new Set(longDownsample).size,
    longDownsample.length,
    "one source point must not be emitted twice",
  );
  assert.ok(
    longDownsample.every((point) => longTrace.includes(point)),
    "every displayed point must come from the validated source trace",
  );

  console.log("Mobile graph downsampling tests passed.");
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

function graphPoint(index, overrides = {}) {
  return {
    ms: index * 100,
    pressureCm: 8,
    flowHpa: 2,
    setpointCm: 8,
    motorFgHz: 123,
    ...overrides,
  };
}

function assertStrictlyIncreasing(points) {
  for (let index = 1; index < points.length; index += 1) {
    assert.ok(points[index].ms > points[index - 1].ms, "displayed points must remain time-ordered");
  }
}
