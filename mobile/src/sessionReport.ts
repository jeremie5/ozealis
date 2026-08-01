import { Buffer } from "buffer";

import { csvTransferHash } from "./csvTransfer";
import {
  parseLiveEvidenceManifest,
  type LiveEvidenceManifest,
} from "./liveEvidence";
import {
  analyzeSessionCsvDetails,
  inspectSessionEvidence,
  normalizeFaultSnapshot,
  parseRetainedImportManifest,
  type RetainedImportManifest,
  type SessionAnalysisReasonCode,
  type SessionAnalysisStatus,
  type SessionEvidenceFormat,
  type SessionEvidenceSample,
} from "./validation";

export const SESSION_REPORT_SCHEMA = "ozealis.session-report";
export const SESSION_REPORT_SCHEMA_VERSION = 1;
export const SESSION_REPORT_PARSER_VERSION = "ozealis-session-evidence-v1";
export const SESSION_REPORT_ANALYSIS_VERSION = "ozealis-airflow-window-v1";

const LIVE_ROLLING_ROW_LIMIT = 36_000;
const RETAINED_ROLLING_ROW_LIMIT = 1_800;
const MINIMUM_ANALYSIS_ROWS = 20;
const MINIMUM_ANALYSIS_DURATION_MS = 20_000;
const MINIMUM_ANALYSIS_RATE_HZ = 0.8;
const MINIMUM_WINDOW_DURATION_MS = 10_000;
const TERMINAL_CADENCE_CAP_MS = 1_000;
const RETAINED_CSV_PROTOCOL = "ozealis-ble-v3";

export type SessionReportInput = {
  rawCsv: string;
  reportingAppVersion: string;
  expectedProtocol: string;
  source:
    | {
        kind: "live_app_sync";
        manifest: LiveEvidenceManifest;
      }
    | {
        kind: "retained_firmware";
        manifest: RetainedImportManifest;
        faultCsv: string;
      };
};

export type SessionReportSha256Digest = (value: string) => Promise<string>;

type SessionReportHashBinding = {
  sha256: string;
  fnv1a32: string;
};

type SessionReportArtifact = {
  role: "live_session_csv" | "retained_session_csv" | "selected_airflow_csv";
  byteCount: number;
  rowCount: number;
  hash: SessionReportHashBinding;
};

type SessionReportFaultArtifact = {
  role: "retained_fault_csv";
  consumedByAnalysis: false;
  generation: number;
  byteCount: number;
  hash: SessionReportHashBinding;
};

type SessionReportSummary = {
  count: number;
  min: number | null;
  max: number | null;
  mean: number | null;
};

type SessionReportCoverage = {
  rows: number;
  ratio: number;
};

type SessionReportLimitation = {
  category: "interpretation" | "data_quality";
  code:
    | "experimental_research_only"
    | "non_diagnostic_heuristic"
    | "flow_proxy_not_volumetric_airflow"
    | "device_time_not_wall_clock"
    | "rolling_window_only"
    | "source_authenticity_not_established"
    | "firmware_build_unavailable"
    | "sensor_accuracy_not_validated"
    | "latest_segment_only"
    | "optional_channels_incomplete";
  text: string;
};

type SessionReportWindowType =
  | "partial_low_flow_reduction"
  | "low_flow_with_controller_response"
  | "low_flow_without_strong_controller_response"
  | "indeterminate_low_flow_window";

export type SessionReportV1 = {
  schema: typeof SESSION_REPORT_SCHEMA;
  schemaVersion: typeof SESSION_REPORT_SCHEMA_VERSION;
  parserVersion: typeof SESSION_REPORT_PARSER_VERSION;
  reportingSoftware: {
    appVersion: string;
    protocolContract: string;
  };
  scope: {
    policy: "latest_contiguous_airflow_run";
    sampleKind: "airflow_run";
    rawEvidenceEmbedded: false;
    deviceIdentity: "omitted";
  };
  source:
    | {
        kind: "live_app_sync";
        csvFormat: "live_csv_v1";
        manifestVersion: 1;
        appVersion: string;
        protocol: string;
        createdAtMs: number;
        updatedAtMs: number;
        firstDeviceMs: number;
        lastDeviceMs: number;
        clockBasis: "app_capture_time";
        firmwareBuildId: null;
        authenticity: "not_established";
      }
    | {
        kind: "retained_firmware";
        csvFormat: "retained_session_csv_v3";
        manifestVersion: 1;
        importedAtMs: number;
        importClockBasis: "app_import_time";
        protocol: string;
        protocolBasis: "csv_schema_not_device_attestation";
        firmwareBuildId: null;
        authenticity: "not_established";
        sessionTransfer: {
          generation: number;
          byteCount: number;
          hashAlgorithm: "fnv1a32";
          hash: string;
        };
        faultTransfer: {
          generation: number;
          byteCount: number;
          hashAlgorithm: "fnv1a32";
          hash: string;
        };
      };
  artifacts: {
    rawEvidence: SessionReportArtifact;
    selectedAirflowEvidence: SessionReportArtifact | null;
    companionFaultEvidence: SessionReportFaultArtifact | null;
  };
  evidence: {
    validation: "strict_valid";
    inputRows: number;
    airflowRunRows: number;
    calibrationRows: number;
    segmentCount: number;
    selectedRows: number;
    discardedAirflowRows: number;
    firstDeviceMs: number | null;
    lastDeviceMs: number | null;
    spanMs: number;
    creditedDurationMs: number;
    cadence: {
      nominalPeriodMs: 100 | 1_000;
      medianPeriodMs: number | null;
      averageRateHz: number | null;
      gapCount: number;
      largestGapMs: number | null;
      estimatedMissingRows: number | null;
      coverageRatio: number | null;
    };
    optionalCoverage: {
      spo2Pulse: SessionReportCoverage;
      humidifierTemp: SessionReportCoverage;
      humidifierRh: SessionReportCoverage;
      hoseTemp: SessionReportCoverage;
    };
    rollingWindow: {
      rowLimit: number;
      possibleTruncation: boolean;
    };
  };
  statistics: {
    setpointCmH2O: SessionReportSummary;
    pressureCmH2O: SessionReportSummary;
    flowProxyHpa: SessionReportSummary;
    motorAmplitude: SessionReportSummary;
    motorCommand: SessionReportSummary;
    controllerErrorCmH2O: SessionReportSummary;
    controllerCommand: SessionReportSummary;
    motorFgHz: SessionReportSummary;
    spo2Percent: SessionReportSummary;
    pulseBpm: SessionReportSummary;
    humidifierTempC: SessionReportSummary;
    humidifierRhPercent: SessionReportSummary;
    hoseTempC: SessionReportSummary;
  };
  analysis: {
    algorithm: typeof SESSION_REPORT_ANALYSIS_VERSION;
    status: SessionAnalysisStatus;
    reasonCode: SessionAnalysisReasonCode;
    rows: number;
    creditedDurationMs: number;
    evidenceBasis: string;
    baselineAbsFlowHpa: number | null;
    thresholds: {
      minimumRows: typeof MINIMUM_ANALYSIS_ROWS;
      minimumDurationMs: typeof MINIMUM_ANALYSIS_DURATION_MS;
      minimumAverageRateHz: typeof MINIMUM_ANALYSIS_RATE_HZ;
      minimumWindowDurationMs: typeof MINIMUM_WINDOW_DURATION_MS;
      terminalCadenceCapMs: typeof TERMINAL_CADENCE_CAP_MS;
      nearZeroAbsFlowHpa: number | null;
      reductionAbsFlowHpa: number | null;
    };
    windows: {
      startDeviceMs: number;
      endDeviceMs: number;
      creditedDurationMs: number;
      type: SessionReportWindowType;
      flowReductionPercent: number;
    }[];
  };
  limitations: SessionReportLimitation[];
};

export async function buildSessionReportV1(
  input: SessionReportInput,
  digestSha256: SessionReportSha256Digest,
): Promise<SessionReportV1 | null> {
  if (
    !isBoundedText(input.reportingAppVersion, 64)
    || !isBoundedText(input.expectedProtocol, 128)
  ) {
    return null;
  }

  const inspection = inspectSessionEvidence(input.rawCsv);
  if (!inspection) return null;

  const rawByteCount = Buffer.byteLength(input.rawCsv, "utf8");
  const rawFnv1a32 = csvTransferHash(input.rawCsv);
  const selectedCsv = inspection.selectedCsv;
  const selectedByteCount = Buffer.byteLength(selectedCsv, "utf8");
  const [computedRawSha256, computedSelectedAirflowSha256, computedFaultSha256] =
    await Promise.all([
      digestLowerHex(input.rawCsv, digestSha256),
      selectedCsv.length === 0
        ? Promise.resolve(null)
        : digestLowerHex(selectedCsv, digestSha256),
      input.source.kind === "retained_firmware"
        ? digestLowerHex(input.source.faultCsv, digestSha256)
        : Promise.resolve(null),
    ]);
  if (
    computedRawSha256 === null
    || (input.source.kind === "retained_firmware"
      ? computedFaultSha256 === null
      : computedFaultSha256 !== null)
  ) {
    return null;
  }

  const source = validateAndBuildSource(
    input,
    inspection.format,
    inspection.inputRows,
    rawByteCount,
    rawFnv1a32,
    inspection.samples,
    computedFaultSha256,
  );
  if (!source) return null;

  const samples = inspection.samples;
  const firstDeviceMs = samples.length > 0 ? samples[0].ms : null;
  const lastDeviceMs = samples.length > 0 ? samples[samples.length - 1].ms : null;
  const spanMs = firstDeviceMs === null || lastDeviceMs === null ? 0 : lastDeviceMs - firstDeviceMs;
  const deltas = sampleDeltas(samples);
  const medianPeriodMs = deltas.length > 0 ? median(deltas) : null;
  const nominalPeriodMs = inspection.format === "live" ? 100 : 1_000;
  const terminalPeriodMs = Math.min(
    TERMINAL_CADENCE_CAP_MS,
    medianPeriodMs ?? nominalPeriodMs,
  );
  const creditedDurationMs = samples.length > 0 ? spanMs + terminalPeriodMs : 0;
  const averageRateHz = samples.length > 1 && creditedDurationMs > 0
    ? roundFinite(samples.length / (creditedDurationMs / 1_000))
    : null;
  const expectedRows = samples.length > 1
    ? 1 + Math.round(spanMs / nominalPeriodMs)
    : null;
  const cadenceCoverageRatio = expectedRows !== null && expectedRows > 0
    ? roundFinite(Math.min(1, samples.length / expectedRows))
    : null;
  const largestGapMs = deltas.length > 0 ? Math.max(...deltas) : null;
  const gapCount = deltas.filter((delta) => delta > nominalPeriodMs * 1.5).length;

  const optionalCoverage = {
    spo2Pulse: coverage(
      samples,
      (sample) => Number.isFinite(sample.spo2Percent) && Number.isFinite(sample.pulseBpm),
    ),
    humidifierTemp: coverage(samples, (sample) => Number.isFinite(sample.humidifierTempC)),
    humidifierRh: coverage(samples, (sample) => Number.isFinite(sample.humidifierRhPercent)),
    hoseTemp: coverage(samples, (sample) => Number.isFinite(sample.hoseTempC)),
  };
  const rowLimit = inspection.format === "live" ? LIVE_ROLLING_ROW_LIMIT : RETAINED_ROLLING_ROW_LIMIT;
  const analysis = analyzeSessionCsvDetails(input.rawCsv);
  const reportSource = source.source;
  const companionFaultEvidence = source.companionFaultEvidence;
  const rawRole = inspection.format === "live" ? "live_session_csv" : "retained_session_csv";

  const report: SessionReportV1 = {
    schema: SESSION_REPORT_SCHEMA,
    schemaVersion: SESSION_REPORT_SCHEMA_VERSION,
    parserVersion: SESSION_REPORT_PARSER_VERSION,
    reportingSoftware: {
      appVersion: input.reportingAppVersion,
      protocolContract: input.expectedProtocol,
    },
    scope: {
      policy: "latest_contiguous_airflow_run",
      sampleKind: "airflow_run",
      rawEvidenceEmbedded: false,
      deviceIdentity: "omitted",
    },
    source: reportSource,
    artifacts: {
      rawEvidence: {
        role: rawRole,
        byteCount: rawByteCount,
        rowCount: inspection.inputRows,
        hash: {
          sha256: computedRawSha256,
          fnv1a32: rawFnv1a32,
        },
      },
      selectedAirflowEvidence: computedSelectedAirflowSha256 === null
        ? null
        : {
            role: "selected_airflow_csv",
            byteCount: selectedByteCount,
            rowCount: inspection.selectedRows,
            hash: {
              sha256: computedSelectedAirflowSha256,
              fnv1a32: csvTransferHash(selectedCsv),
            },
          },
      companionFaultEvidence,
    },
    evidence: {
      validation: "strict_valid",
      inputRows: inspection.inputRows,
      airflowRunRows: inspection.airflowRunRows,
      calibrationRows: inspection.calibrationRows,
      segmentCount: inspection.segmentCount,
      selectedRows: inspection.selectedRows,
      discardedAirflowRows: inspection.discardedAirflowRows,
      firstDeviceMs,
      lastDeviceMs,
      spanMs,
      creditedDurationMs,
      cadence: {
        nominalPeriodMs,
        medianPeriodMs: medianPeriodMs === null ? null : roundFinite(medianPeriodMs),
        averageRateHz,
        gapCount,
        largestGapMs,
        estimatedMissingRows: expectedRows === null ? null : Math.max(0, expectedRows - samples.length),
        coverageRatio: cadenceCoverageRatio,
      },
      optionalCoverage,
      rollingWindow: {
        rowLimit,
        possibleTruncation: inspection.inputRows >= rowLimit,
      },
    },
    statistics: {
      setpointCmH2O: summarize(samples.map((sample) => sample.setpointCm)),
      pressureCmH2O: summarize(samples.map((sample) => sample.pressureCm)),
      flowProxyHpa: summarize(samples.map((sample) => sample.flowHpa)),
      motorAmplitude: summarize(samples.map((sample) => sample.motorAmplitude)),
      motorCommand: summarize(samples.map((sample) => sample.motorCommand)),
      controllerErrorCmH2O: summarize(samples.map((sample) => sample.controllerErrorCm)),
      controllerCommand: summarize(samples.map((sample) => sample.controllerAmp)),
      motorFgHz: summarize(samples.map((sample) => sample.motorFgHz)),
      spo2Percent: summarize(samples.map((sample) => sample.spo2Percent)),
      pulseBpm: summarize(samples.map((sample) => sample.pulseBpm)),
      humidifierTempC: summarize(samples.map((sample) => sample.humidifierTempC)),
      humidifierRhPercent: summarize(samples.map((sample) => sample.humidifierRhPercent)),
      hoseTempC: summarize(samples.map((sample) => sample.hoseTempC)),
    },
    analysis: {
      algorithm: SESSION_REPORT_ANALYSIS_VERSION,
      status: analysis.status,
      reasonCode: analysis.reasonCode,
      rows: analysis.rows,
      creditedDurationMs: Math.round(analysis.durationSec * 1_000),
      evidenceBasis: analysis.evidenceBasis,
      baselineAbsFlowHpa: nullableRounded(analysis.baselineAbsFlowHpa),
      thresholds: {
        minimumRows: MINIMUM_ANALYSIS_ROWS,
        minimumDurationMs: MINIMUM_ANALYSIS_DURATION_MS,
        minimumAverageRateHz: MINIMUM_ANALYSIS_RATE_HZ,
        minimumWindowDurationMs: MINIMUM_WINDOW_DURATION_MS,
        terminalCadenceCapMs: TERMINAL_CADENCE_CAP_MS,
        nearZeroAbsFlowHpa: nullableRounded(analysis.nearZeroAbsFlowHpa),
        reductionAbsFlowHpa: nullableRounded(analysis.reductionAbsFlowHpa),
      },
      windows: analysis.observations.map((observation) => ({
        startDeviceMs: observation.startMs,
        endDeviceMs: observation.endMs,
        creditedDurationMs: Math.round(observation.durationSec * 1_000),
        type: reportWindowType(observation.type),
        flowReductionPercent: observation.flowDropPercent,
      })),
    },
    limitations: buildLimitations(
      inspection.discardedAirflowRows,
      Object.values(optionalCoverage).some((item) => item.ratio < 1),
    ),
  };
  return hasOnlyFiniteNumbers(report) ? report : null;
}

export async function serializeSessionReportV1(
  input: SessionReportInput,
  digestSha256: SessionReportSha256Digest,
): Promise<string | null> {
  const report = await buildSessionReportV1(input, digestSha256);
  return report ? `${JSON.stringify(report, null, 2)}\n` : null;
}

export function sessionReportSelectedAirflowCsv(rawCsv: string): string | null {
  return inspectSessionEvidence(rawCsv)?.selectedCsv ?? null;
}

function validateAndBuildSource(
  input: SessionReportInput,
  format: SessionEvidenceFormat,
  inputRows: number,
  rawByteCount: number,
  rawFnv1a32: string,
  samples: SessionEvidenceSample[],
  computedFaultSha256: string | null,
): {
  source: SessionReportV1["source"];
  companionFaultEvidence: SessionReportFaultArtifact | null;
} | null {
  if (input.source.kind === "live_app_sync") {
    const manifest = parseLiveEvidenceManifest(JSON.stringify(input.source.manifest));
    if (
      !manifest
      || format !== "live"
      || manifest.appVersion !== input.reportingAppVersion
      || manifest.protocol !== input.expectedProtocol
      || manifest.rowCount !== inputRows
      || manifest.byteCount !== rawByteCount
      || manifest.fnv1aHash !== rawFnv1a32
      || samples.length !== inputRows
      || samples.length === 0
      || samples[0].ms !== manifest.firstDeviceMs
      || samples[samples.length - 1].ms !== manifest.lastDeviceMs
    ) {
      return null;
    }
    return {
      source: {
        kind: "live_app_sync",
        csvFormat: "live_csv_v1",
        manifestVersion: manifest.version,
        appVersion: manifest.appVersion,
        protocol: manifest.protocol,
        createdAtMs: manifest.createdAtMs,
        updatedAtMs: manifest.updatedAtMs,
        firstDeviceMs: manifest.firstDeviceMs,
        lastDeviceMs: manifest.lastDeviceMs,
        clockBasis: "app_capture_time",
        firmwareBuildId: null,
        authenticity: "not_established",
      },
      companionFaultEvidence: null,
    };
  }

  const manifest = parseRetainedImportManifest(JSON.stringify(input.source.manifest));
  if (
    !manifest
    || format !== "retained"
    || input.expectedProtocol !== RETAINED_CSV_PROTOCOL
    || manifest.session.total !== rawByteCount
    || manifest.session.hash !== rawFnv1a32
    || computedFaultSha256 === null
    || normalizeFaultSnapshot(input.source.faultCsv) !== input.source.faultCsv
  ) {
    return null;
  }
  const faultByteCount = Buffer.byteLength(input.source.faultCsv, "utf8");
  const faultFnv1a32 = csvTransferHash(input.source.faultCsv);
  if (
    faultByteCount !== manifest.fault.total
    || faultFnv1a32 !== manifest.fault.hash
  ) {
    return null;
  }

  return {
    source: {
      kind: "retained_firmware",
      csvFormat: "retained_session_csv_v3",
      manifestVersion: manifest.version,
      importedAtMs: manifest.importedAtMs,
      importClockBasis: "app_import_time",
      protocol: input.expectedProtocol,
      protocolBasis: "csv_schema_not_device_attestation",
      firmwareBuildId: null,
      authenticity: "not_established",
      sessionTransfer: {
        generation: manifest.session.generation,
        byteCount: manifest.session.total,
        hashAlgorithm: "fnv1a32",
        hash: manifest.session.hash,
      },
      faultTransfer: {
        generation: manifest.fault.generation,
        byteCount: manifest.fault.total,
        hashAlgorithm: "fnv1a32",
        hash: manifest.fault.hash,
      },
    },
    companionFaultEvidence: {
      role: "retained_fault_csv",
      consumedByAnalysis: false,
      generation: manifest.fault.generation,
      byteCount: faultByteCount,
      hash: {
        sha256: computedFaultSha256,
        fnv1a32: faultFnv1a32,
      },
    },
  };
}

function sampleDeltas(samples: SessionEvidenceSample[]): number[] {
  return samples
    .slice(1)
    .map((sample, index) => sample.ms - samples[index].ms)
    .filter((delta) => Number.isFinite(delta) && delta > 0);
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

function coverage(
  samples: SessionEvidenceSample[],
  isPresent: (sample: SessionEvidenceSample) => boolean,
): SessionReportCoverage {
  const rows = samples.filter(isPresent).length;
  return {
    rows,
    ratio: samples.length === 0 ? 0 : roundFinite(rows / samples.length),
  };
}

function summarize(values: (number | null | undefined)[]): SessionReportSummary {
  const finiteValues = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  if (finiteValues.length === 0) {
    return {
      count: 0,
      min: null,
      max: null,
      mean: null,
    };
  }
  let mean = 0;
  finiteValues.forEach((value, index) => {
    mean += (value - mean) / (index + 1);
  });
  return {
    count: finiteValues.length,
    min: roundFinite(Math.min(...finiteValues)),
    max: roundFinite(Math.max(...finiteValues)),
    mean: roundFinite(mean),
  };
}

function reportWindowType(type: string): SessionReportWindowType {
  if (type === "partial low-flow reduction") return "partial_low_flow_reduction";
  if (type === "low-flow with pressure/controller response") return "low_flow_with_controller_response";
  if (type === "low-flow without strong controller response") return "low_flow_without_strong_controller_response";
  return "indeterminate_low_flow_window";
}

function buildLimitations(
  discardedAirflowRows: number,
  optionalChannelsIncomplete: boolean,
): SessionReportLimitation[] {
  const limitations: SessionReportLimitation[] = [
    {
      category: "interpretation",
      code: "experimental_research_only",
      text: "Ozealis is an experimental research platform, not a medical device.",
    },
    {
      category: "interpretation",
      code: "non_diagnostic_heuristic",
      text: "Airflow windows are non-diagnostic engineering heuristics; they are not screening, diagnosis, treatment, efficacy, or AHI outputs.",
    },
    {
      category: "data_quality",
      code: "flow_proxy_not_volumetric_airflow",
      text: "flowProxy_hPa is a differential-pressure proxy, not calibrated volumetric airflow.",
    },
    {
      category: "data_quality",
      code: "device_time_not_wall_clock",
      text: "Device timestamps are monotonic device milliseconds, not verified wall-clock times.",
    },
    {
      category: "data_quality",
      code: "rolling_window_only",
      text: "The source is a bounded rolling capture and may omit earlier session evidence.",
    },
    {
      category: "data_quality",
      code: "source_authenticity_not_established",
      text: "The manifest checks local source binding and byte integrity; it does not authenticate the device, operator, or measurements.",
    },
    {
      category: "data_quality",
      code: "firmware_build_unavailable",
      text: "The source does not carry a firmware build identifier; the BLE protocol contract is not a firmware version.",
    },
    {
      category: "data_quality",
      code: "sensor_accuracy_not_validated",
      text: "This report does not establish sensor calibration, accuracy, or fitness for use.",
    },
  ];
  if (discardedAirflowRows > 0) {
    limitations.push({
      category: "data_quality",
      code: "latest_segment_only",
      text: "Analysis uses only the latest cadence-contiguous airflow_run segment; earlier airflow rows were excluded.",
    });
  }
  if (optionalChannelsIncomplete) {
    limitations.push({
      category: "data_quality",
      code: "optional_channels_incomplete",
      text: "One or more optional channels contain missing samples; missing values were not imputed.",
    });
  }
  return limitations;
}

function roundFinite(value: number): number {
  if (!Number.isFinite(value)) return Number.NaN;
  const scaled = value * 1_000_000;
  if (!Number.isFinite(scaled)) return Number.NaN;
  const rounded = Math.round(scaled) / 1_000_000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function nullableRounded(value: number | null): number | null {
  return value === null || !Number.isFinite(value) ? null : roundFinite(value);
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

async function digestLowerHex(
  value: string,
  digestSha256: SessionReportSha256Digest,
): Promise<string | null> {
  try {
    const digest = (await digestSha256(value)).toLowerCase();
    return isSha256(digest) ? digest : null;
  } catch {
    return null;
  }
}

function isBoundedText(value: unknown, maximumLength: number): value is string {
  return (
    typeof value === "string"
    && value.length > 0
    && value.length <= maximumLength
    && value === value.trim()
    && !/[\u0000-\u001f\u007f]/.test(value)
  );
}

function hasOnlyFiniteNumbers(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(hasOnlyFiniteNumbers);
  if (!value || typeof value !== "object") return true;
  return Object.values(value).every(hasOnlyFiniteNumbers);
}
