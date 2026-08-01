import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import ts from "../mobile/node_modules/typescript/lib/typescript.js";

const root = resolve(import.meta.dirname, "..");
const tempDir = mkdtempSync(join(tmpdir(), "ozealis-session-report-"));
const appVersion = "1.0.0";
const protocol = "ozealis-ble-v3";
const privateDeviceId = "PRIVATE-BLE-DEVICE-ID";
const liveHeader =
  "ms,setpoint_hPa,pressure_hPa,flow_hPa,vin,mode,measured_cm,error_cm,controller_amp,motor_cmd,motor_fault,motor_i2c,motor_fg_hz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c";
const retainedHeader =
  "ms,setpoint_cm,pressure_cmH2O,error_cmH2O,flowProxy_hPa,motorAmp,controller_error_cm,controller_amp,motorCmd,motorFault,motorI2c,motorFgHz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c,sample_kind";
const faultHeader =
  "ts_ms,sys_mode,fault,vin_V,pMask_hPa,pBlower_hPa,ambient_hPa,diff_hPa,setpoint_cm,flowProxy_hPa,motorAmp,motorCmd,motorFault,motorI2c,motorFgHz,loop_us,miss1,miss2,i2cErr1,i2cErr2";

const goldenRawSha256 = "5cd52fa60076673e575b7f314fabe977166242627e4ecb783cd70ddc658b747e";
const goldenReportSha256 = "74a7cb2064d4a7f2a0849fcd56b71f4df2d0190122f74d92db63bc7785b195a7";
const segmentedRawSha256 = "80159ee7d4db1f5d3a613fae844d9723f73dcbdd58cdc9cc2858dc365a4a7b65";
const segmentedSelectedSha256 = "d49407d42700f7410fa29426e700126eddda72c1550b98361b0a83609882329b";
const digestSha256 = async (value) => sha256(value);
let fnv1a32Helper;

try {
  for (const moduleName of ["csvTransfer", "liveEvidence", "validation", "sessionReport"]) {
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
  const { buildLiveEvidenceManifest } = await import(pathToFileURL(join(tempDir, "liveEvidence.mjs")).href);
  const {
    buildSessionReportV1,
    serializeSessionReportV1,
    sessionReportSelectedAirflowCsv,
  } = await import(pathToFileURL(join(tempDir, "sessionReport.mjs")).href);
  fnv1a32Helper = csvTransferHash;

  const faultCsv = faultHeader;
  const faultFnv1a32 = csvTransferHash(faultCsv);
  const faultSha256 = sha256(faultCsv);

  const goldenRaw = [
    retainedHeader,
    ...Array.from({ length: 20 }, (_, index) => retainedRow(index * 1_000)),
  ].join("\n");
  const goldenSelected = sessionReportSelectedAirflowCsv(goldenRaw);
  assert.equal(goldenSelected, goldenRaw);
  const actualGoldenRawSha256 = sha256(goldenRaw);
  assertKnownDigest("golden retained raw SHA-256", actualGoldenRawSha256, goldenRawSha256);

  const goldenInput = retainedInput(goldenRaw, {
    sessionGeneration: 17,
    faultGeneration: 9,
    importedAtMs: 1_770_000_000_000,
  });
  const goldenReport = await buildSessionReportV1(goldenInput, digestSha256);
  assert.ok(goldenReport, "valid retained evidence must produce SessionReportV1");

  const absentSummary = {
    count: 0,
    min: null,
    max: null,
    mean: null,
  };
  const goldenExpected = {
    schema: "ozealis.session-report",
    schemaVersion: 1,
    parserVersion: "ozealis-session-evidence-v1",
    reportingSoftware: {
      appVersion,
      protocolContract: protocol,
    },
    scope: {
      policy: "latest_contiguous_airflow_run",
      sampleKind: "airflow_run",
      rawEvidenceEmbedded: false,
      deviceIdentity: "omitted",
    },
    source: {
      kind: "retained_firmware",
      csvFormat: "retained_session_csv_v3",
      manifestVersion: 1,
      importedAtMs: 1_770_000_000_000,
      importClockBasis: "app_import_time",
      protocol,
      protocolBasis: "csv_schema_not_device_attestation",
      firmwareBuildId: null,
      authenticity: "not_established",
      sessionTransfer: {
        generation: 17,
        byteCount: Buffer.byteLength(goldenRaw, "utf8"),
        hashAlgorithm: "fnv1a32",
        hash: csvTransferHash(goldenRaw),
      },
      faultTransfer: {
        generation: 9,
        byteCount: Buffer.byteLength(faultCsv, "utf8"),
        hashAlgorithm: "fnv1a32",
        hash: faultFnv1a32,
      },
    },
    artifacts: {
      rawEvidence: {
        role: "retained_session_csv",
        byteCount: Buffer.byteLength(goldenRaw, "utf8"),
        rowCount: 20,
        hash: {
          sha256: actualGoldenRawSha256,
          fnv1a32: csvTransferHash(goldenRaw),
        },
      },
      selectedAirflowEvidence: {
        role: "selected_airflow_csv",
        byteCount: Buffer.byteLength(goldenRaw, "utf8"),
        rowCount: 20,
        hash: {
          sha256: actualGoldenRawSha256,
          fnv1a32: csvTransferHash(goldenRaw),
        },
      },
      companionFaultEvidence: {
        role: "retained_fault_csv",
        consumedByAnalysis: false,
        generation: 9,
        byteCount: Buffer.byteLength(faultCsv, "utf8"),
        hash: {
          sha256: faultSha256,
          fnv1a32: faultFnv1a32,
        },
      },
    },
    evidence: {
      validation: "strict_valid",
      inputRows: 20,
      airflowRunRows: 20,
      calibrationRows: 0,
      segmentCount: 1,
      selectedRows: 20,
      discardedAirflowRows: 0,
      firstDeviceMs: 0,
      lastDeviceMs: 19_000,
      spanMs: 19_000,
      creditedDurationMs: 20_000,
      cadence: {
        nominalPeriodMs: 1_000,
        medianPeriodMs: 1_000,
        averageRateHz: 1,
        gapCount: 0,
        largestGapMs: 1_000,
        estimatedMissingRows: 0,
        coverageRatio: 1,
      },
      optionalCoverage: {
        spo2Pulse: { rows: 0, ratio: 0 },
        humidifierTemp: { rows: 0, ratio: 0 },
        humidifierRh: { rows: 0, ratio: 0 },
        hoseTemp: { rows: 0, ratio: 0 },
      },
      rollingWindow: {
        rowLimit: 1_800,
        possibleTruncation: false,
      },
    },
    statistics: {
      setpointCmH2O: summary(20, 8, 8, 8),
      pressureCmH2O: summary(20, 8, 8, 8),
      flowProxyHpa: summary(20, 2, 2, 2),
      motorAmplitude: summary(20, 40, 40, 40),
      motorCommand: summary(20, 40, 40, 40),
      controllerErrorCmH2O: summary(20, 0.1, 0.1, 0.1),
      controllerCommand: summary(20, 40, 40, 40),
      motorFgHz: summary(20, 123.45, 123.45, 123.45),
      spo2Percent: absentSummary,
      pulseBpm: absentSummary,
      humidifierTempC: absentSummary,
      humidifierRhPercent: absentSummary,
      hoseTempC: absentSummary,
    },
    analysis: {
      algorithm: "ozealis-airflow-window-v1",
      status: "analyzed",
      reasonCode: "complete",
      rows: 20,
      creditedDurationMs: 20_000,
      evidenceBasis: "Flow-proxy intervals were evaluated against the session's 75th-percentile absolute-flow baseline (2.0 hPa).",
      baselineAbsFlowHpa: 2,
      thresholds: {
        minimumRows: 20,
        minimumDurationMs: 20_000,
        minimumAverageRateHz: 0.8,
        minimumWindowDurationMs: 10_000,
        terminalCadenceCapMs: 1_000,
        nearZeroAbsFlowHpa: 0.4,
        reductionAbsFlowHpa: 1,
      },
      windows: [],
    },
    limitations: [
      limitation(
        "interpretation",
        "experimental_research_only",
        "Ozealis is an experimental research platform, not a medical device.",
      ),
      limitation(
        "interpretation",
        "non_diagnostic_heuristic",
        "Airflow windows are non-diagnostic engineering heuristics; they are not screening, diagnosis, treatment, efficacy, or AHI outputs.",
      ),
      limitation(
        "data_quality",
        "flow_proxy_not_volumetric_airflow",
        "flowProxy_hPa is a differential-pressure proxy, not calibrated volumetric airflow.",
      ),
      limitation(
        "data_quality",
        "device_time_not_wall_clock",
        "Device timestamps are monotonic device milliseconds, not verified wall-clock times.",
      ),
      limitation(
        "data_quality",
        "rolling_window_only",
        "The source is a bounded rolling capture and may omit earlier session evidence.",
      ),
      limitation(
        "data_quality",
        "source_authenticity_not_established",
        "The manifest checks local source binding and byte integrity; it does not authenticate the device, operator, or measurements.",
      ),
      limitation(
        "data_quality",
        "firmware_build_unavailable",
        "The source does not carry a firmware build identifier; the BLE protocol contract is not a firmware version.",
      ),
      limitation(
        "data_quality",
        "sensor_accuracy_not_validated",
        "This report does not establish sensor calibration, accuracy, or fitness for use.",
      ),
      limitation(
        "data_quality",
        "optional_channels_incomplete",
        "One or more optional channels contain missing samples; missing values were not imputed.",
      ),
    ],
  };
  assert.deepEqual(goldenReport, goldenExpected, "the retained golden report shape must remain exact");

  const goldenSerialized = await serializeSessionReportV1(goldenInput, digestSha256);
  assert.equal(
    goldenSerialized,
    `${JSON.stringify(goldenExpected, null, 2)}\n`,
    "serialization must preserve the versioned property order and one trailing LF",
  );
  assert.equal(
    await serializeSessionReportV1(goldenInput, digestSha256),
    goldenSerialized,
    "identical inputs must produce byte-identical report JSON",
  );
  assert.ok(goldenSerialized.endsWith("\n"));
  assert.equal(goldenSerialized.endsWith("\n\n"), false);
  assert.doesNotMatch(goldenSerialized, /\b(?:NaN|Infinity|-Infinity)\b/);
  const actualGoldenReportSha256 = sha256(goldenSerialized);
  assertKnownDigest("golden report SHA-256", actualGoldenReportSha256, goldenReportSha256);

  const segmentedRows = [
    ...Array.from({ length: 5 }, (_, index) => retainedRow(index * 1_000)),
    retainedRow(5_000, { kind: "calibration", flow: 0.01 }),
    ...Array.from({ length: 5 }, (_, index) => retainedRow(6_000 + index * 1_000)),
    ...Array.from({ length: 20 }, (_, index) => retainedRow(14_000 + index * 1_000)),
  ];
  const segmentedRaw = [retainedHeader, ...segmentedRows].join("\n");
  const segmentedSelected = [
    retainedHeader,
    ...Array.from({ length: 20 }, (_, index) => retainedRow(14_000 + index * 1_000)),
  ].join("\n");
  assert.equal(sessionReportSelectedAirflowCsv(segmentedRaw), segmentedSelected);
  assertKnownDigest("segmented retained raw SHA-256", sha256(segmentedRaw), segmentedRawSha256);
  assertKnownDigest(
    "segmented retained selected SHA-256",
    sha256(segmentedSelected),
    segmentedSelectedSha256,
  );
  assert.notEqual(sha256(segmentedRaw), sha256(segmentedSelected));
  const segmentedReport = await buildSessionReportV1(retainedInput(segmentedRaw), digestSha256);
  assert.ok(segmentedReport);
  assert.deepEqual(
    pick(segmentedReport.evidence, [
      "inputRows",
      "airflowRunRows",
      "calibrationRows",
      "segmentCount",
      "selectedRows",
      "discardedAirflowRows",
      "firstDeviceMs",
      "lastDeviceMs",
    ]),
    {
      inputRows: 31,
      airflowRunRows: 30,
      calibrationRows: 1,
      segmentCount: 3,
      selectedRows: 20,
      discardedAirflowRows: 10,
      firstDeviceMs: 14_000,
      lastDeviceMs: 33_000,
    },
  );
  assert.equal(segmentedReport.analysis.status, "analyzed");
  assert.equal(segmentedReport.analysis.reasonCode, "complete");
  assert.equal(segmentedReport.artifacts.rawEvidence.hash.sha256, sha256(segmentedRaw));
  assert.equal(
    segmentedReport.artifacts.selectedAirflowEvidence?.hash.sha256,
    sha256(segmentedSelected),
  );
  assert.ok(
    segmentedReport.limitations.some(({ code }) => code === "latest_segment_only"),
    "discarded earlier airflow evidence must be disclosed",
  );

  const shortRaw = [
    retainedHeader,
    ...Array.from({ length: 19 }, (_, index) => retainedRow(index * 1_000)),
  ].join("\n");
  const shortReport = await buildSessionReportV1(retainedInput(shortRaw), digestSha256);
  assert.ok(shortReport);
  assert.deepEqual(
    pick(shortReport.analysis, ["status", "reasonCode", "rows", "creditedDurationMs"]),
    {
      status: "insufficient",
      reasonCode: "minimum_window_not_met",
      rows: 19,
      creditedDurationMs: 19_000,
    },
  );
  assert.deepEqual(shortReport.analysis.windows, []);

  const sparseRaw = [
    retainedHeader,
    ...Array.from({ length: 20 }, (_, index) => retainedRow(index * 2_500)),
  ].join("\n");
  const sparseReport = await buildSessionReportV1(retainedInput(sparseRaw), digestSha256);
  assert.ok(sparseReport);
  assert.equal(sparseReport.analysis.status, "insufficient");
  assert.equal(sparseReport.analysis.reasonCode, "average_rate_too_low");
  assert.equal(sparseReport.evidence.cadence.medianPeriodMs, 2_500);
  assert.equal(sparseReport.evidence.cadence.averageRateHz, 0.412371);
  assert.equal(sparseReport.evidence.cadence.gapCount, 19);
  assert.equal(sparseReport.evidence.cadence.estimatedMissingRows, 29);
  assert.equal(sparseReport.evidence.cadence.coverageRatio, 0.408163);
  assert.deepEqual(sparseReport.analysis.windows, []);

  const mixedOptionalRaw = [
    retainedHeader,
    ...Array.from({ length: 20 }, (_, index) =>
      retainedRow(index * 1_000, index % 2 === 0
        ? {
            spo2: 97.5,
            pulse: 60,
            oximeterSource: 2,
            humidifierTemp: 25,
            humidifierRh: 50,
            hoseTemp: 28,
          }
        : {}),
    ),
  ].join("\n");
  const mixedOptionalReport = await buildSessionReportV1(retainedInput(mixedOptionalRaw), digestSha256);
  assert.ok(mixedOptionalReport);
  assert.deepEqual(mixedOptionalReport.evidence.optionalCoverage, {
    spo2Pulse: { rows: 10, ratio: 0.5 },
    humidifierTemp: { rows: 10, ratio: 0.5 },
    humidifierRh: { rows: 10, ratio: 0.5 },
    hoseTemp: { rows: 10, ratio: 0.5 },
  });
  assert.deepEqual(mixedOptionalReport.statistics.spo2Percent, summary(10, 97.5, 97.5, 97.5));
  assert.deepEqual(mixedOptionalReport.statistics.pulseBpm, summary(10, 60, 60, 60));
  assert.deepEqual(mixedOptionalReport.statistics.humidifierTempC, summary(10, 25, 25, 25));
  assert.deepEqual(mixedOptionalReport.statistics.humidifierRhPercent, summary(10, 50, 50, 50));
  assert.deepEqual(mixedOptionalReport.statistics.hoseTempC, summary(10, 28, 28, 28));

  const liveRows = Array.from({ length: 200 }, (_, index) => liveRow(index * 100));
  const liveRaw = [liveHeader, ...liveRows].join("\n");
  const liveManifest = buildLiveEvidenceManifest({
    csv: liveRaw,
    rows: liveRows,
    owner: { deviceId: privateDeviceId, sessionId: 731_337 },
    appVersion,
    protocol,
    createdAtMs: 1_800_000_000_000,
    nowMs: 1_800_000_019_900,
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
  const liveReport = await buildSessionReportV1(liveInput, digestSha256);
  assert.ok(liveReport);
  assert.deepEqual(liveReport.source, {
    kind: "live_app_sync",
    csvFormat: "live_csv_v1",
    manifestVersion: 1,
    appVersion,
    protocol,
    createdAtMs: 1_800_000_000_000,
    updatedAtMs: 1_800_000_019_900,
    firstDeviceMs: 0,
    lastDeviceMs: 19_900,
    clockBasis: "app_capture_time",
    firmwareBuildId: null,
    authenticity: "not_established",
  });
  assert.equal(liveReport.artifacts.rawEvidence.role, "live_session_csv");
  assert.equal(liveReport.artifacts.companionFaultEvidence, null);
  assert.equal(liveReport.evidence.cadence.nominalPeriodMs, 100);
  assert.equal(liveReport.evidence.creditedDurationMs, 20_000);
  assert.equal(liveReport.evidence.cadence.averageRateHz, 10);
  assert.equal(liveReport.analysis.status, "analyzed");
  assert.deepEqual(liveReport.statistics.motorAmplitude, {
    count: 0,
    min: null,
    max: null,
    mean: null,
  });
  assert.deepEqual(liveReport.statistics.motorCommand, summary(200, 77, 77, 77));
  assert.deepEqual(liveReport.statistics.controllerCommand, summary(200, 40, 40, 40));

  const atRetainedLimitRaw = [
    retainedHeader,
    ...Array.from({ length: 1_800 }, (_, index) => retainedRow(index * 1_000)),
  ].join("\n");
  const belowRetainedLimitRaw = [
    retainedHeader,
    ...Array.from({ length: 1_799 }, (_, index) => retainedRow(index * 1_000)),
  ].join("\n");
  assert.equal(
    (await buildSessionReportV1(
      retainedInput(atRetainedLimitRaw),
      digestSha256,
    ))?.evidence.rollingWindow.possibleTruncation,
    true,
  );
  assert.equal(
    (await buildSessionReportV1(
      retainedInput(belowRetainedLimitRaw),
      digestSha256,
    ))?.evidence.rollingWindow.possibleTruncation,
    false,
  );

  const digestInputs = [];
  assert.deepEqual(
    await buildSessionReportV1(goldenInput, async (value) => {
      digestInputs.push(value);
      return sha256(value);
    }),
    goldenReport,
  );
  assert.deepEqual(
    digestInputs,
    [goldenRaw, goldenRaw, faultHeader],
    "the report builder must hash the exact raw, selected, and fault evidence itself",
  );
  assert.equal(
    await buildSessionReportV1(goldenInput, async () => "not-a-sha256"),
    null,
    "invalid digest output must fail closed",
  );
  assert.equal(
    await buildSessionReportV1(goldenInput, async () => {
      throw new Error("digest unavailable");
    }),
    null,
    "digest failures must fail closed",
  );
  assert.deepEqual(
    await buildSessionReportV1(goldenInput, async (value) => sha256(value).toUpperCase()),
    goldenReport,
    "canonical digest output is normalized to lowercase",
  );

  const wrongSessionHashInput = structuredClone(goldenInput);
  wrongSessionHashInput.source.manifest.session.hash = "00000000";
  assert.equal(await buildSessionReportV1(wrongSessionHashInput, digestSha256), null);
  const wrongFaultHashInput = structuredClone(goldenInput);
  wrongFaultHashInput.source.manifest.fault.hash = "00000000";
  assert.equal(await buildSessionReportV1(wrongFaultHashInput, digestSha256), null);
  const invalidGenerationInput = structuredClone(goldenInput);
  invalidGenerationInput.source.manifest.session.generation = 0;
  assert.equal(await buildSessionReportV1(invalidGenerationInput, digestSha256), null);
  const malformedFaultInput = structuredClone(goldenInput);
  malformedFaultInput.source.faultCsv = `${faultHeader}\nnot,a,fault,row`;
  malformedFaultInput.source.manifest.fault.total = Buffer.byteLength(
    malformedFaultInput.source.faultCsv,
    "utf8",
  );
  malformedFaultInput.source.manifest.fault.hash = csvTransferHash(
    malformedFaultInput.source.faultCsv,
  );
  assert.equal(await buildSessionReportV1(malformedFaultInput, digestSha256), null);

  for (const invalidRaw of [
    goldenRaw.replace(retainedHeader, "not,a,recognized,header"),
    goldenRaw.replace(",airflow_run", ",foreign_kind"),
    goldenRaw.replace("\n1000,", "\n 1000,"),
    `${goldenRaw}\n\n`,
    goldenRaw.replace("\n", "\r\n"),
  ]) {
    const invalidInput = structuredClone(goldenInput);
    invalidInput.rawCsv = invalidRaw;
    invalidInput.source.manifest.session.total = Buffer.byteLength(invalidRaw, "utf8");
    invalidInput.source.manifest.session.hash = csvTransferHash(invalidRaw);
    assert.equal(
      await buildSessionReportV1(invalidInput, digestSha256),
      null,
      "malformed or foreign retained evidence must fail closed",
    );
  }
  const extremeFiniteRaw = [
    retainedHeader,
    retainedRow(0, { flow: `1${"0".repeat(300)}` }),
  ].join("\n");
  assert.equal(
    await buildSessionReportV1(retainedInput(extremeFiniteRaw), digestSha256),
    null,
    "physically unbounded but finite numeric tokens must not reach report arithmetic",
  );

  const retainedAsLiveInput = {
    ...structuredClone(liveInput),
    rawCsv: goldenRaw,
  };
  assert.equal(await buildSessionReportV1(retainedAsLiveInput, digestSha256), null);
  const liveProtocolMismatchInput = structuredClone(liveInput);
  liveProtocolMismatchInput.source.manifest.protocol = "ozealis-ble-v2";
  assert.equal(await buildSessionReportV1(liveProtocolMismatchInput, digestSha256), null);
  const liveRowCountMismatchInput = structuredClone(liveInput);
  liveRowCountMismatchInput.source.manifest.rowCount += 1;
  assert.equal(await buildSessionReportV1(liveRowCountMismatchInput, digestSha256), null);
  const liveTimestampMismatchInput = structuredClone(liveInput);
  liveTimestampMismatchInput.source.manifest.lastDeviceMs += 100;
  assert.equal(await buildSessionReportV1(liveTimestampMismatchInput, digestSha256), null);

  assertReportPrivacy(goldenReport, goldenSerialized);
  assertReportPrivacy(liveReport, await serializeSessionReportV1(liveInput, digestSha256));
  assert.equal(Object.prototype.hasOwnProperty.call(goldenReport.analysis, "confidence"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(goldenReport.analysis, "probability"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(goldenReport.analysis, "severity"), false);
  assert.doesNotMatch(
    JSON.stringify(goldenReport.analysis),
    /\b(?:apnea|hypopnea|obstructive|central|diagnosis|screening|treatment|efficacy|ahi)\b/i,
  );

  const appSource = readFileSync(resolve(root, "mobile/App.tsx"), "utf8");
  assert.match(
    appSource,
    /serializeSessionReportV1,\s*sessionReportSelectedAirflowCsv,/,
    "App must use the versioned report builder and canonical selected-airflow helper",
  );
  const captureSource = sliceBetween(
    appSource,
    "  function captureCurrentSessionReportDraft()",
    "  async function buildCurrentSessionReportArtifact()",
    "session report source capture",
  );
  const builderSource = sliceBetween(
    appSource,
    "  async function buildCurrentSessionReportArtifact()",
    "  async function exportSessionReport()",
    "session report builder",
  );
  const exportSource = sliceBetween(
    appSource,
    "  async function exportSessionReport()",
    "  async function saveCurrentSessionCapture()",
    "session report export",
  );
  assert.match(captureSource, /analysisKind === "live"/);
  assert.match(captureSource, /analysisKind === "retained"/);
  assert.doesNotMatch(
    captureSource,
    /analysisSource ===/,
    "report source selection must use the stable source enum rather than a display label",
  );
  assert.match(captureSource, /snapshot\.csv === analysisCsv/);
  assert.match(captureSource, /snapshot\.manifest\.deviceId === connectedDevice\.id/);
  assert.match(
    captureSource,
    /snapshot\.manifest\.appSessionId === deviceSessionIdRef\.current/,
  );
  assert.match(captureSource, /snapshot\.manifest\.appVersion === appVersion/);
  assert.match(captureSource, /snapshot\.manifest\.protocol === OZEALIS_PROTOCOL_VERSION/);
  assert.match(captureSource, /rawCsv = retainedImport\.sessionCsv/);
  assert.match(captureSource, /selectedAirflowCsv === analysisCsv/);
  assert.match(
    captureSource,
    /sessionReportSelectedAirflowCsv\(rawCsv\)/,
    "report derivation must use the canonical full-resolution selector",
  );
  assert.match(
    appSource,
    /async function digestSha256Text\(value: string\): Promise<string>/,
  );
  assert.match(
    appSource,
    /Crypto\.digestStringAsync\(\s*Crypto\.CryptoDigestAlgorithm\.SHA256,\s*value,/,
  );
  assert.match(builderSource, /await serializeSessionReportV1\(/);
  assert.match(builderSource, /digestSha256Text/);
  assert.doesNotMatch(builderSource, /rawSha256|selectedAirflowSha256|faultSha256/);
  assert.match(exportSource, /exportJson\("ozealis-session-report-v1", artifact\.reportJson\)/);
  assert.doesNotMatch(
    `${captureSource}\n${builderSource}`,
    /visibleAnalysisCsv|sessionGraphPoints|parseSessionGraphData/,
    "report export must not use UI day filtering or graph downsampling",
  );
  assert.match(appSource, /label="Export session report JSON"/);
  assert.match(appSource, /disabled=\{!analysisCsv\.trim\(\)\}/);
  assert.match(
    appSource,
    /The report summarizes full-resolution evidence and byte fingerprints without exporting the BLE device identity\./,
  );

  console.log("Mobile session report tests passed.");
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

function retainedRow(ms, options = {}) {
  const {
    kind = "airflow_run",
    setpoint = 8,
    pressure = 8,
    error = 0.1,
    flow = 2,
    motorAmp = 40,
    controllerError = error,
    controllerAmp = 40,
    motorCmd = 40,
    motorFault = 0,
    motorI2c = 1,
    motorFgHz = 123.45,
    spo2 = null,
    pulse = null,
    oximeterSource = spo2 === null ? 0 : 2,
    humidifierTemp = null,
    humidifierRh = null,
    hoseTemp = null,
  } = options;
  return [
    ms,
    setpoint,
    pressure,
    error,
    flow,
    motorAmp,
    controllerError,
    controllerAmp,
    motorCmd,
    motorFault,
    motorI2c,
    motorFgHz,
    optionalCsv(spo2),
    optionalCsv(pulse),
    oximeterSource,
    optionalCsv(humidifierTemp),
    optionalCsv(humidifierRh),
    optionalCsv(hoseTemp),
    kind,
  ].join(",");
}

function liveRow(ms, options = {}) {
  const {
    flow = 2,
    measuredCm = 8,
    errorCm = 0.1,
    controllerAmp = 40,
    motorCmd = 77,
    spo2 = null,
    pulse = null,
    oximeterSource = spo2 === null ? 0 : 2,
    humidifierTemp = null,
    humidifierRh = null,
    hoseTemp = null,
  } = options;
  return [
    ms,
    7.84532,
    7.84532,
    flow,
    24,
    2,
    measuredCm,
    errorCm,
    controllerAmp,
    motorCmd,
    0,
    1,
    123.45,
    optionalCsv(spo2),
    optionalCsv(pulse),
    oximeterSource,
    optionalCsv(humidifierTemp),
    optionalCsv(humidifierRh),
    optionalCsv(hoseTemp),
  ].join(",");
}

function optionalCsv(value) {
  return value === null ? "NAN" : String(value);
}

function retainedInput(
  rawCsv,
  {
    sessionGeneration = 17,
    faultGeneration = 9,
    importedAtMs = 1_770_000_000_000,
  } = {},
) {
  return {
    rawCsv,
    reportingAppVersion: appVersion,
    expectedProtocol: protocol,
    source: {
      kind: "retained_firmware",
      manifest: {
        version: 1,
        deviceId: privateDeviceId,
        importedAtMs,
        session: {
          generation: sessionGeneration,
          total: Buffer.byteLength(rawCsv, "utf8"),
          hash: fnv1a32ForInput(rawCsv),
        },
        fault: {
          generation: faultGeneration,
          total: Buffer.byteLength(faultHeader, "utf8"),
          hash: fnv1a32ForInput(faultHeader),
        },
      },
      faultCsv: faultHeader,
    },
  };
}

function fnv1a32ForInput(raw) {
  assert.equal(typeof fnv1a32Helper, "function", "FNV-1a helper not initialized");
  return fnv1a32Helper(raw);
}

function sha256(raw) {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

function summary(count, min, max, mean) {
  return { count, min, max, mean };
}

function limitation(category, code, text) {
  return { category, code, text };
}

function pick(value, keys) {
  return Object.fromEntries(keys.map((key) => [key, value[key]]));
}

function assertKnownDigest(label, actual, expected) {
  assert.equal(actual, expected, `${label} changed`);
}

function assertReportPrivacy(report, serialized) {
  const keys = collectKeys(report).map((key) => key.toLowerCase());
  for (const forbiddenKey of [
    "deviceid",
    "appsessionid",
    "blename",
    "settings",
    "otaurl",
    "ssid",
    "password",
    "pwd",
    "credential",
    "rawcsv",
    "faultcsv",
  ]) {
    assert.equal(keys.includes(forbiddenKey), false, `report leaked forbidden key ${forbiddenKey}`);
  }
  assert.equal(serialized.includes(privateDeviceId), false, "report leaked BLE device identity");
  assert.equal(serialized.includes(retainedHeader), false, "report embedded raw retained CSV");
  assert.equal(serialized.includes(liveHeader), false, "report embedded raw live CSV");
}

function collectKeys(value, keys = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectKeys(item, keys));
    return keys;
  }
  if (!value || typeof value !== "object") return keys;
  for (const [key, item] of Object.entries(value)) {
    keys.push(key);
    collectKeys(item, keys);
  }
  return keys;
}

function sliceBetween(source, start, end, label) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.ok(startIndex >= 0 && endIndex > startIndex, `${label} source must remain inspectable`);
  return source.slice(startIndex, endIndex);
}
