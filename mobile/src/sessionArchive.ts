import { Buffer } from "buffer";

import {
  parseLiveEvidenceManifest,
  type LiveEvidenceManifest,
} from "./liveEvidence";
import {
  SESSION_REPORT_SCHEMA,
  SESSION_REPORT_SCHEMA_VERSION,
  serializeSessionReportV1,
  sessionReportSelectedAirflowCsv,
  type SessionReportInput,
  type SessionReportV1,
} from "./sessionReport";
import {
  parseRetainedImportManifest,
  type RetainedImportManifest,
} from "./validation";

export const SESSION_ARCHIVE_SCHEMA = "ozealis.session-archive-entry";
export const SESSION_ARCHIVE_SCHEMA_VERSION = 1;
export const SESSION_ARCHIVE_MAX_ENTRIES = 250;
export const SESSION_ARCHIVE_MAX_TOTAL_BYTES = 256 * 1024 * 1024;
export const SESSION_ARCHIVE_MAX_ENTRY_BYTES = 40_000_000;
export const SESSION_COMPARISON_SCHEMA = "ozealis.session-comparison";
export const SESSION_COMPARISON_SCHEMA_VERSION = 1;

const OWNER_HASH_PREFIX = "ozealis-owner-v1\u0000";
const ARCHIVE_ID_HASH_PREFIX = "ozealis-session-archive-v1\u0000";
const ARCHIVE_ENVELOPE_HASH_PREFIX = "ozealis-session-archive-envelope-v1\u0000";
const ARCHIVED_DEVICE_ID_PREFIX = "archive:";
const MAX_REPORT_JSON_BYTES = 1_000_000;
const MAX_RAW_EVIDENCE_BYTES = 16_000_000;
const MAX_FAULT_EVIDENCE_BYTES = 512_000;
const MAX_DATE_MS = 8_640_000_000_000_000;

export type Sha256TextDigest = (value: string) => Promise<string>;

export type SessionArchiveReportInputV1 = {
  rawSha256: string;
  selectedAirflowSha256: string;
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
        faultSha256: string;
      };
};

export type SessionArchiveEntryV1 = {
  schema: typeof SESSION_ARCHIVE_SCHEMA;
  schemaVersion: typeof SESSION_ARCHIVE_SCHEMA_VERSION;
  archiveId: string;
  archivedAtMs: number;
  envelopeSha256: string;
  owner: {
    scheme: "sha256_domain_separated_ble_device_id";
    fingerprint: string;
  };
  reportInput: SessionArchiveReportInputV1;
  evidence: {
    rawCsv: string;
    selectedAirflowCsv: string | null;
    faultCsv: string | null;
  };
  report: {
    json: string;
    sha256: string;
  };
};

export type VerifiedSessionArchiveRecordV1 = {
  entry: SessionArchiveEntryV1;
  report: SessionReportV1;
};

export type SessionComparisonReasonCode =
  | "same_archive_entry"
  | "duplicate_selected_evidence"
  | "different_device_owner"
  | "incompatible_report_contract"
  | "reporting_software_differs"
  | "analysis_contract_differs"
  | "missing_selected_evidence"
  | "different_source_formats"
  | "possible_rolling_truncation"
  | "low_cadence_coverage"
  | "different_evidence_durations"
  | "analysis_status_differs"
  | "heuristic_analysis_unavailable"
  | "window_result_limit_ambiguous"
  | "discarded_earlier_segments";

export type SessionComparisonMetricCode =
  | "credited_duration_ms"
  | "selected_rows"
  | "cadence_coverage_ratio"
  | "mean_setpoint_cm_h2o"
  | "mean_pressure_cm_h2o"
  | "mean_flow_proxy_hpa"
  | "mean_motor_amplitude"
  | "mean_motor_command"
  | "mean_controller_command"
  | "mean_motor_fg_hz"
  | "absolute_flow_baseline_hpa"
  | "heuristic_window_count"
  | "heuristic_window_duration_ms";

export type SessionComparisonMetric = {
  code: SessionComparisonMetricCode;
  label: string;
  unit: string;
  baseline: number | null;
  current: number | null;
  delta: number | null;
  deltaState: "available" | "suppressed" | "unavailable";
  reasonCode:
    | "missing_in_one_or_both_reports"
    | "evidence_windows_not_equivalent"
    | "heuristic_comparison_unavailable"
    | null;
};

export type SessionComparisonV1 = {
  schema: typeof SESSION_COMPARISON_SCHEMA;
  schemaVersion: typeof SESSION_COMPARISON_SCHEMA_VERSION;
  status: "unavailable" | "limited" | "comparable";
  reasonCodes: SessionComparisonReasonCode[];
  baselineArchiveId: string;
  currentArchiveId: string;
  evidenceBasis: string;
  metrics: SessionComparisonMetric[];
  limitations: string[];
};

type CreateSessionArchiveInput = {
  ownerDeviceId: string;
  archivedAtMs: number;
  reportInput: SessionReportInput;
  reportJson: string;
};

export async function createSessionArchiveEntryV1(
  input: CreateSessionArchiveInput,
  digestSha256: Sha256TextDigest,
): Promise<VerifiedSessionArchiveRecordV1 | null> {
  if (
    !isBoundedIdentity(input.ownerDeviceId, 256)
    || !isSafeUnsignedInteger(input.archivedAtMs)
    || input.archivedAtMs === 0
    || input.archivedAtMs > MAX_DATE_MS
    || !hasOneTrailingLf(input.reportJson)
    || Buffer.byteLength(input.reportJson, "utf8") > MAX_REPORT_JSON_BYTES
  ) {
    return null;
  }

  const originalReportJson = await serializeSessionReportV1(input.reportInput, digestSha256);
  if (originalReportJson !== input.reportJson) return null;

  const selectedAirflowCsv = sessionReportSelectedAirflowCsv(input.reportInput.rawCsv);
  if (!selectedAirflowCsv) return null;

  const faultCsv = input.reportInput.source.kind === "retained_firmware"
    ? input.reportInput.source.faultCsv
    : null;
  const [ownerFingerprint, rawSha256, selectedAirflowSha256, faultSha256, reportSha256] =
    await Promise.all([
      digestLowerHex(`${OWNER_HASH_PREFIX}${input.ownerDeviceId}`, digestSha256),
      digestLowerHex(input.reportInput.rawCsv, digestSha256),
      digestLowerHex(selectedAirflowCsv, digestSha256),
      faultCsv === null ? Promise.resolve(null) : digestLowerHex(faultCsv, digestSha256),
      digestLowerHex(input.reportJson, digestSha256),
    ]);
  if (
    !ownerFingerprint
    || !rawSha256
    || !selectedAirflowSha256
    || !reportSha256
    || (input.reportInput.source.kind === "live_app_sync"
      ? input.reportInput.source.manifest.deviceId !== input.ownerDeviceId || faultSha256 !== null
      : input.reportInput.source.manifest.deviceId !== input.ownerDeviceId
        || faultSha256 === null)
  ) {
    return null;
  }

  const archivedDeviceId = `${ARCHIVED_DEVICE_ID_PREFIX}${ownerFingerprint}`;
  const reportInput: SessionArchiveReportInputV1 =
    input.reportInput.source.kind === "live_app_sync"
      ? {
          rawSha256,
          selectedAirflowSha256,
          reportingAppVersion: input.reportInput.reportingAppVersion,
          expectedProtocol: input.reportInput.expectedProtocol,
          source: {
            kind: "live_app_sync",
            manifest: {
              ...input.reportInput.source.manifest,
              deviceId: archivedDeviceId,
              appSessionId: 1,
            },
          },
        }
      : {
          rawSha256,
          selectedAirflowSha256,
          reportingAppVersion: input.reportInput.reportingAppVersion,
          expectedProtocol: input.reportInput.expectedProtocol,
          source: {
            kind: "retained_firmware",
            manifest: {
              ...input.reportInput.source.manifest,
              deviceId: archivedDeviceId,
              session: { ...input.reportInput.source.manifest.session },
              fault: { ...input.reportInput.source.manifest.fault },
            },
            faultSha256: faultSha256 as string,
          },
        };

  const sanitizedReportJson = await serializeSessionReportV1(
    restoreReportInput(reportInput, input.reportInput.rawCsv, faultCsv),
    digestSha256,
  );
  if (sanitizedReportJson !== input.reportJson) return null;

  const sourceKind = reportInput.source.kind;
  const archiveId = await digestLowerHex(
    `${ARCHIVE_ID_HASH_PREFIX}${ownerFingerprint}\u0000${sourceKind}\u0000${rawSha256}\u0000${reportSha256}`,
    digestSha256,
  );
  if (!archiveId) return null;

  const unsignedEntry: Omit<SessionArchiveEntryV1, "envelopeSha256"> = {
    schema: SESSION_ARCHIVE_SCHEMA,
    schemaVersion: SESSION_ARCHIVE_SCHEMA_VERSION,
    archiveId,
    archivedAtMs: input.archivedAtMs,
    owner: {
      scheme: "sha256_domain_separated_ble_device_id",
      fingerprint: ownerFingerprint,
    },
    reportInput,
    evidence: {
      rawCsv: input.reportInput.rawCsv,
      selectedAirflowCsv:
        selectedAirflowCsv === input.reportInput.rawCsv
          ? null
          : selectedAirflowCsv,
      faultCsv,
    },
    report: {
      json: input.reportJson,
      sha256: reportSha256,
    },
  };
  const envelopeSha256 = await digestLowerHex(
    `${ARCHIVE_ENVELOPE_HASH_PREFIX}${canonicalJson(unsignedEntry)}`,
    digestSha256,
  );
  if (!envelopeSha256) return null;
  const entry: SessionArchiveEntryV1 = {
    ...unsignedEntry,
    envelopeSha256,
  };

  return verifySessionArchiveEntryV1(serializeSessionArchiveEntryV1(entry), digestSha256);
}

export function serializeSessionArchiveEntryV1(entry: SessionArchiveEntryV1): string {
  return `${JSON.stringify(entry, null, 2)}\n`;
}

export async function verifySessionArchiveEntryV1(
  raw: string,
  digestSha256: Sha256TextDigest,
): Promise<VerifiedSessionArchiveRecordV1 | null> {
  const entry = parseSessionArchiveEnvelopeV1(raw);
  if (!entry) return null;

  const derivedSelectedAirflowCsv = sessionReportSelectedAirflowCsv(
    entry.evidence.rawCsv,
  );
  if (!derivedSelectedAirflowCsv) return null;
  if (
    derivedSelectedAirflowCsv === entry.evidence.rawCsv
      ? entry.evidence.selectedAirflowCsv !== null
      : entry.evidence.selectedAirflowCsv !== derivedSelectedAirflowCsv
  ) {
    return null;
  }
  const selectedAirflowCsv = derivedSelectedAirflowCsv;

  const [
    rawSha256,
    selectedAirflowSha256,
    faultSha256,
    reportSha256,
    archiveId,
    envelopeSha256,
  ] =
    await Promise.all([
      digestLowerHex(entry.evidence.rawCsv, digestSha256),
      digestLowerHex(selectedAirflowCsv, digestSha256),
      entry.evidence.faultCsv === null
        ? Promise.resolve(null)
        : digestLowerHex(entry.evidence.faultCsv, digestSha256),
      digestLowerHex(entry.report.json, digestSha256),
      digestLowerHex(
        `${ARCHIVE_ID_HASH_PREFIX}${entry.owner.fingerprint}\u0000${entry.reportInput.source.kind}\u0000${entry.reportInput.rawSha256}\u0000${entry.report.sha256}`,
        digestSha256,
      ),
      digestLowerHex(
        `${ARCHIVE_ENVELOPE_HASH_PREFIX}${canonicalJson(archiveEnvelopePayload(entry))}`,
        digestSha256,
      ),
    ]);
  if (
    !rawSha256
    || !selectedAirflowSha256
    || !reportSha256
    || !archiveId
    || !envelopeSha256
    || rawSha256 !== entry.reportInput.rawSha256
    || selectedAirflowSha256 !== entry.reportInput.selectedAirflowSha256
    || reportSha256 !== entry.report.sha256
    || archiveId !== entry.archiveId
    || envelopeSha256 !== entry.envelopeSha256
  ) {
    return null;
  }

  if (
    entry.reportInput.source.kind === "live_app_sync"
      ? faultSha256 !== null
      : faultSha256 === null || faultSha256 !== entry.reportInput.source.faultSha256
  ) {
    return null;
  }

  const rebuiltReportJson = await serializeSessionReportV1(
    restoreReportInput(entry.reportInput, entry.evidence.rawCsv, entry.evidence.faultCsv),
    digestSha256,
  );
  if (rebuiltReportJson !== entry.report.json) return null;

  let report: unknown;
  try {
    report = JSON.parse(entry.report.json);
  } catch {
    return null;
  }
  if (
    !isObject(report)
    || report.schema !== SESSION_REPORT_SCHEMA
    || report.schemaVersion !== SESSION_REPORT_SCHEMA_VERSION
  ) {
    return null;
  }
  return {
    entry,
    report: report as SessionReportV1,
  };
}

export function sortSessionArchiveRecords(
  records: VerifiedSessionArchiveRecordV1[],
): VerifiedSessionArchiveRecordV1[] {
  const byId = new Map<string, VerifiedSessionArchiveRecordV1>();
  for (const record of records) {
    if (!byId.has(record.entry.archiveId)) byId.set(record.entry.archiveId, record);
  }
  return [...byId.values()].sort(
    (left, right) =>
      right.entry.archivedAtMs - left.entry.archivedAtMs
      || left.entry.archiveId.localeCompare(right.entry.archiveId),
  );
}

export function compareSessionArchiveRecords(
  baseline: VerifiedSessionArchiveRecordV1,
  current: VerifiedSessionArchiveRecordV1,
): SessionComparisonV1 {
  const reasonCodes: SessionComparisonReasonCode[] = [];
  const fixedLimitations = [
    "This is a factual comparison of two bounded experimental evidence windows, not a clinical assessment.",
    "Local hashes bind the archived bytes but do not authenticate the device, operator, sensors, or measurements.",
    "Device timestamps are uptime values; archive times are app wall-clock anchors and do not synchronize the device clocks.",
  ];

  if (baseline.entry.archiveId === current.entry.archiveId) {
    reasonCodes.push("same_archive_entry");
  }
  const baselineSelectedSha256 =
    baseline.report.artifacts.selectedAirflowEvidence?.hash.sha256;
  const currentSelectedSha256 =
    current.report.artifacts.selectedAirflowEvidence?.hash.sha256;
  if (
    baselineSelectedSha256
    && currentSelectedSha256
    && baselineSelectedSha256 === currentSelectedSha256
  ) {
    reasonCodes.push("duplicate_selected_evidence");
  }
  if (baseline.entry.owner.fingerprint !== current.entry.owner.fingerprint) {
    reasonCodes.push("different_device_owner");
  }
  if (
    baseline.report.schema !== current.report.schema
    || baseline.report.schemaVersion !== current.report.schemaVersion
    || baseline.report.parserVersion !== current.report.parserVersion
    || baseline.report.reportingSoftware.protocolContract
      !== current.report.reportingSoftware.protocolContract
    || baseline.report.scope.policy !== current.report.scope.policy
    || baseline.report.scope.sampleKind !== current.report.scope.sampleKind
  ) {
    reasonCodes.push("incompatible_report_contract");
  }
  if (
    !baseline.report.artifacts.selectedAirflowEvidence
    || !current.report.artifacts.selectedAirflowEvidence
    || baseline.report.evidence.selectedRows <= 0
    || current.report.evidence.selectedRows <= 0
  ) {
    reasonCodes.push("missing_selected_evidence");
  }

  const unavailableReasons = new Set<SessionComparisonReasonCode>([
    "same_archive_entry",
    "duplicate_selected_evidence",
    "different_device_owner",
    "incompatible_report_contract",
    "missing_selected_evidence",
  ]);
  if (reasonCodes.some((reason) => unavailableReasons.has(reason))) {
    return {
      schema: SESSION_COMPARISON_SCHEMA,
      schemaVersion: SESSION_COMPARISON_SCHEMA_VERSION,
      status: "unavailable",
      reasonCodes,
      baselineArchiveId: baseline.entry.archiveId,
      currentArchiveId: current.entry.archiveId,
      evidenceBasis: "The selected archive entries cannot be compared under one validated evidence contract.",
      metrics: [],
      limitations: fixedLimitations,
    };
  }

  if (
    baseline.report.reportingSoftware.appVersion
    !== current.report.reportingSoftware.appVersion
  ) {
    reasonCodes.push("reporting_software_differs");
  }
  const analysisContractMatches =
    baseline.report.analysis.algorithm === current.report.analysis.algorithm
    && baseline.report.analysis.thresholds.minimumRows
      === current.report.analysis.thresholds.minimumRows
    && baseline.report.analysis.thresholds.minimumDurationMs
      === current.report.analysis.thresholds.minimumDurationMs
    && baseline.report.analysis.thresholds.minimumAverageRateHz
      === current.report.analysis.thresholds.minimumAverageRateHz
    && baseline.report.analysis.thresholds.minimumWindowDurationMs
      === current.report.analysis.thresholds.minimumWindowDurationMs
    && baseline.report.analysis.thresholds.terminalCadenceCapMs
      === current.report.analysis.thresholds.terminalCadenceCapMs;
  if (!analysisContractMatches) {
    reasonCodes.push("analysis_contract_differs");
  }
  if (baseline.report.source.kind !== current.report.source.kind) {
    reasonCodes.push("different_source_formats");
  }
  if (
    baseline.report.evidence.rollingWindow.possibleTruncation
    || current.report.evidence.rollingWindow.possibleTruncation
  ) {
    reasonCodes.push("possible_rolling_truncation");
  }
  const baselineCoverage = baseline.report.evidence.cadence.coverageRatio;
  const currentCoverage = current.report.evidence.cadence.coverageRatio;
  if (
    baselineCoverage === null
    || currentCoverage === null
    || baselineCoverage < 0.8
    || currentCoverage < 0.8
  ) {
    reasonCodes.push("low_cadence_coverage");
  }
  const shorterDuration = Math.min(
    baseline.report.evidence.creditedDurationMs,
    current.report.evidence.creditedDurationMs,
  );
  const longerDuration = Math.max(
    baseline.report.evidence.creditedDurationMs,
    current.report.evidence.creditedDurationMs,
  );
  if (shorterDuration <= 0 || longerDuration / shorterDuration > 2) {
    reasonCodes.push("different_evidence_durations");
  }
  if (baseline.report.analysis.status !== current.report.analysis.status) {
    reasonCodes.push("analysis_status_differs");
  }
  const heuristicAnalysisAvailable =
    analysisContractMatches
    && baseline.report.analysis.status === "analyzed"
    && current.report.analysis.status === "analyzed";
  if (!heuristicAnalysisAvailable) {
    reasonCodes.push("heuristic_analysis_unavailable");
  }
  const windowResultLimitAmbiguous =
    baseline.report.analysis.windows.length >= 50
    || current.report.analysis.windows.length >= 50;
  if (windowResultLimitAmbiguous) {
    reasonCodes.push("window_result_limit_ambiguous");
  }
  if (
    baseline.report.evidence.discardedAirflowRows > 0
    || current.report.evidence.discardedAirflowRows > 0
  ) {
    reasonCodes.push("discarded_earlier_segments");
  }

  const metrics: SessionComparisonMetric[] = [];
  const suppressCoreDeltas =
    reasonCodes.includes("different_source_formats")
    || reasonCodes.includes("possible_rolling_truncation")
    || reasonCodes.includes("low_cadence_coverage")
    || reasonCodes.includes("different_evidence_durations");
  const coreDeltaReason = suppressCoreDeltas
    ? "evidence_windows_not_equivalent"
    : null;
  addMetric(
    metrics,
    "credited_duration_ms",
    "Credited evidence duration",
    "ms",
    baseline.report.evidence.creditedDurationMs,
    current.report.evidence.creditedDurationMs,
    coreDeltaReason,
  );
  addMetric(
    metrics,
    "selected_rows",
    "Selected airflow rows",
    "rows",
    baseline.report.evidence.selectedRows,
    current.report.evidence.selectedRows,
    coreDeltaReason,
  );
  addMetric(
    metrics,
    "cadence_coverage_ratio",
    "Cadence coverage",
    "ratio",
    baselineCoverage,
    currentCoverage,
    coreDeltaReason,
  );
  addMetric(
    metrics,
    "mean_setpoint_cm_h2o",
    "Mean setpoint",
    "cmH2O",
    baseline.report.statistics.setpointCmH2O.mean,
    current.report.statistics.setpointCmH2O.mean,
    coreDeltaReason,
  );
  addMetric(
    metrics,
    "mean_pressure_cm_h2o",
    "Mean pressure",
    "cmH2O",
    baseline.report.statistics.pressureCmH2O.mean,
    current.report.statistics.pressureCmH2O.mean,
    coreDeltaReason,
  );
  addMetric(
    metrics,
    "mean_flow_proxy_hpa",
    "Mean signed flow proxy",
    "hPa",
    baseline.report.statistics.flowProxyHpa.mean,
    current.report.statistics.flowProxyHpa.mean,
    coreDeltaReason,
  );
  addMetric(
    metrics,
    "mean_motor_amplitude",
    "Mean motor amplitude",
    "amplitude",
    baseline.report.statistics.motorAmplitude.mean,
    current.report.statistics.motorAmplitude.mean,
    coreDeltaReason,
  );
  addMetric(
    metrics,
    "mean_motor_command",
    "Mean motor command",
    "command",
    baseline.report.statistics.motorCommand.mean,
    current.report.statistics.motorCommand.mean,
    coreDeltaReason,
  );
  addMetric(
    metrics,
    "mean_controller_command",
    "Mean controller command",
    "command",
    baseline.report.statistics.controllerCommand.mean,
    current.report.statistics.controllerCommand.mean,
    coreDeltaReason,
  );
  addMetric(
    metrics,
    "mean_motor_fg_hz",
    "Mean motor FG",
    "Hz",
    baseline.report.statistics.motorFgHz.mean,
    current.report.statistics.motorFgHz.mean,
    coreDeltaReason,
  );
  const heuristicDeltaReason =
    !heuristicAnalysisAvailable || windowResultLimitAmbiguous
      ? "heuristic_comparison_unavailable"
      : coreDeltaReason;
  addMetric(
    metrics,
    "absolute_flow_baseline_hpa",
    "Absolute-flow heuristic baseline",
    "hPa",
    baseline.report.analysis.baselineAbsFlowHpa,
    current.report.analysis.baselineAbsFlowHpa,
    heuristicDeltaReason,
  );
  addMetric(
    metrics,
    "heuristic_window_count",
    "Heuristic airflow-window count",
    "windows",
    heuristicAnalysisAvailable ? baseline.report.analysis.windows.length : null,
    heuristicAnalysisAvailable ? current.report.analysis.windows.length : null,
    heuristicDeltaReason,
  );
  addMetric(
    metrics,
    "heuristic_window_duration_ms",
    "Heuristic airflow-window duration",
    "ms",
    heuristicAnalysisAvailable ? sumWindowDuration(baseline.report) : null,
    heuristicAnalysisAvailable ? sumWindowDuration(current.report) : null,
    heuristicDeltaReason,
  );

  const limitations = [...fixedLimitations];
  if (reasonCodes.includes("different_source_formats")) {
    limitations.push("The two reports use different live/retained source formats and nominal sample cadences.");
  }
  if (reasonCodes.includes("possible_rolling_truncation")) {
    limitations.push("At least one report reached its rolling row limit and may omit earlier evidence.");
  }
  if (reasonCodes.includes("low_cadence_coverage")) {
    limitations.push("At least one report has missing or low-coverage cadence evidence.");
  }
  if (reasonCodes.includes("different_evidence_durations")) {
    limitations.push("The credited evidence durations differ by more than twofold.");
  }
  if (reasonCodes.includes("analysis_status_differs")) {
    limitations.push("The heuristic analysis status differs between the two reports.");
  }
  if (reasonCodes.includes("reporting_software_differs")) {
    limitations.push("The reports were produced by different app versions under the same parser and protocol contract.");
  }
  if (reasonCodes.includes("analysis_contract_differs")) {
    limitations.push("Heuristic deltas are suppressed because the analysis algorithm or thresholds differ.");
  }
  if (reasonCodes.includes("heuristic_analysis_unavailable")) {
    limitations.push("Heuristic deltas are unavailable unless both reports completed the same analysis contract.");
  }
  if (reasonCodes.includes("window_result_limit_ambiguous")) {
    limitations.push("At least one V1 report reached the 50-window output cap, so its total window result is ambiguous.");
  }
  if (reasonCodes.includes("discarded_earlier_segments")) {
    limitations.push("At least one report compares only its latest contiguous airflow segment after discarding earlier airflow rows.");
  }

  return {
    schema: SESSION_COMPARISON_SCHEMA,
    schemaVersion: SESSION_COMPARISON_SCHEMA_VERSION,
    status: reasonCodes.length > 0 ? "limited" : "comparable",
    reasonCodes,
    baselineArchiveId: baseline.entry.archiveId,
    currentArchiveId: current.entry.archiveId,
    evidenceBasis:
      "Metrics are direct deltas between two strictly validated archived reports from the same pseudonymous device owner; no evaluative interpretation is assigned.",
    metrics,
    limitations,
  };
}

export function serializeSessionComparisonV1(
  comparison: SessionComparisonV1,
): string | null {
  return hasOnlyFiniteNumbers(comparison)
    ? `${JSON.stringify(comparison, null, 2)}\n`
    : null;
}

function parseSessionArchiveEnvelopeV1(raw: string): SessionArchiveEntryV1 | null {
  if (
    !hasOneTrailingLf(raw)
    || Buffer.byteLength(raw, "utf8") > SESSION_ARCHIVE_MAX_ENTRY_BYTES
  ) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (
    !isObject(parsed)
    || !hasExactKeys(parsed, [
      "archiveId",
      "archivedAtMs",
      "envelopeSha256",
      "evidence",
      "owner",
      "report",
      "reportInput",
      "schema",
      "schemaVersion",
    ])
    || parsed.schema !== SESSION_ARCHIVE_SCHEMA
    || parsed.schemaVersion !== SESSION_ARCHIVE_SCHEMA_VERSION
    || !isSha256(parsed.archiveId)
    || !isSafeUnsignedInteger(parsed.archivedAtMs)
    || parsed.archivedAtMs === 0
    || parsed.archivedAtMs > MAX_DATE_MS
    || !isSha256(parsed.envelopeSha256)
    || !isObject(parsed.owner)
    || !hasExactKeys(parsed.owner, ["fingerprint", "scheme"])
    || parsed.owner.scheme !== "sha256_domain_separated_ble_device_id"
    || !isSha256(parsed.owner.fingerprint)
    || !isObject(parsed.reportInput)
    || !hasExactKeys(parsed.reportInput, [
      "expectedProtocol",
      "rawSha256",
      "reportingAppVersion",
      "selectedAirflowSha256",
      "source",
    ])
    || !isSha256(parsed.reportInput.rawSha256)
    || !isSha256(parsed.reportInput.selectedAirflowSha256)
    || !isBoundedIdentity(parsed.reportInput.reportingAppVersion, 64)
    || !isBoundedIdentity(parsed.reportInput.expectedProtocol, 128)
    || !isObject(parsed.evidence)
    || !hasExactKeys(parsed.evidence, [
      "faultCsv",
      "rawCsv",
      "selectedAirflowCsv",
    ])
    || typeof parsed.evidence.rawCsv !== "string"
    || parsed.evidence.rawCsv.length === 0
    || Buffer.byteLength(parsed.evidence.rawCsv, "utf8") > MAX_RAW_EVIDENCE_BYTES
    || (
      parsed.evidence.selectedAirflowCsv !== null
      && (
        typeof parsed.evidence.selectedAirflowCsv !== "string"
        || parsed.evidence.selectedAirflowCsv.length === 0
        || Buffer.byteLength(parsed.evidence.selectedAirflowCsv, "utf8")
          > MAX_RAW_EVIDENCE_BYTES
      )
    )
    || !isObject(parsed.report)
    || !hasExactKeys(parsed.report, ["json", "sha256"])
    || typeof parsed.report.json !== "string"
    || !hasOneTrailingLf(parsed.report.json)
    || Buffer.byteLength(parsed.report.json, "utf8") > MAX_REPORT_JSON_BYTES
    || !isSha256(parsed.report.sha256)
  ) {
    return null;
  }

  const source = parsed.reportInput.source;
  const archivedDeviceId = `${ARCHIVED_DEVICE_ID_PREFIX}${parsed.owner.fingerprint}`;
  if (!isObject(source) || typeof source.kind !== "string") return null;
  if (source.kind === "live_app_sync") {
    if (
      !hasExactKeys(source, ["kind", "manifest"])
      || !isObject(source.manifest)
      || parsed.evidence.faultCsv !== null
    ) {
      return null;
    }
    const manifest = parseLiveEvidenceManifest(JSON.stringify(source.manifest));
    if (
      !manifest
      || manifest.deviceId !== archivedDeviceId
      || manifest.appSessionId !== 1
    ) {
      return null;
    }
    parsed.reportInput.source = { kind: "live_app_sync", manifest };
  } else if (source.kind === "retained_firmware") {
    if (
      !hasExactKeys(source, ["faultSha256", "kind", "manifest"])
      || !isSha256(source.faultSha256)
      || !isObject(source.manifest)
      || typeof parsed.evidence.faultCsv !== "string"
      || Buffer.byteLength(parsed.evidence.faultCsv, "utf8") > MAX_FAULT_EVIDENCE_BYTES
    ) {
      return null;
    }
    const manifest = parseRetainedImportManifest(JSON.stringify(source.manifest));
    if (!manifest || manifest.deviceId !== archivedDeviceId) return null;
    parsed.reportInput.source = {
      kind: "retained_firmware",
      manifest,
      faultSha256: source.faultSha256,
    };
  } else {
    return null;
  }

  return parsed as SessionArchiveEntryV1;
}

function restoreReportInput(
  reportInput: SessionArchiveReportInputV1,
  rawCsv: string,
  faultCsv: string | null,
): SessionReportInput {
  if (reportInput.source.kind === "live_app_sync") {
    return {
      rawCsv,
      reportingAppVersion: reportInput.reportingAppVersion,
      expectedProtocol: reportInput.expectedProtocol,
      source: {
        kind: "live_app_sync",
        manifest: { ...reportInput.source.manifest },
      },
    };
  }
  return {
    rawCsv,
    reportingAppVersion: reportInput.reportingAppVersion,
    expectedProtocol: reportInput.expectedProtocol,
    source: {
      kind: "retained_firmware",
      manifest: {
        ...reportInput.source.manifest,
        session: { ...reportInput.source.manifest.session },
        fault: { ...reportInput.source.manifest.fault },
      },
      faultCsv: faultCsv ?? "",
    },
  };
}

function archiveEnvelopePayload(
  entry: SessionArchiveEntryV1,
): Omit<SessionArchiveEntryV1, "envelopeSha256"> {
  const {
    envelopeSha256: _envelopeSha256,
    ...payload
  } = entry;
  return payload;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? "null" : serialized;
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  const objectValue = value as Record<string, unknown>;
  return `{${Object.keys(objectValue)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(objectValue[key])}`)
    .join(",")}}`;
}

function addMetric(
  metrics: SessionComparisonMetric[],
  code: SessionComparisonMetricCode,
  label: string,
  unit: string,
  baseline: number | null,
  current: number | null,
  suppressedReason:
    | "evidence_windows_not_equivalent"
    | "heuristic_comparison_unavailable"
    | null,
) {
  if (!Number.isFinite(baseline) || !Number.isFinite(current)) {
    metrics.push({
      code,
      label,
      unit,
      baseline: Number.isFinite(baseline) ? roundFinite(baseline as number) : null,
      current: Number.isFinite(current) ? roundFinite(current as number) : null,
      delta: null,
      deltaState: "unavailable",
      reasonCode: suppressedReason === "heuristic_comparison_unavailable"
        ? suppressedReason
        : "missing_in_one_or_both_reports",
    });
    return;
  }
  const safeBaseline = roundFinite(baseline as number);
  const safeCurrent = roundFinite(current as number);
  const delta = roundFinite(safeCurrent - safeBaseline);
  if (![safeBaseline, safeCurrent, delta].every(Number.isFinite)) return;
  metrics.push({
    code,
    label,
    unit,
    baseline: safeBaseline,
    current: safeCurrent,
    delta: suppressedReason === null ? delta : null,
    deltaState: suppressedReason === null ? "available" : "suppressed",
    reasonCode: suppressedReason,
  });
}

function sumWindowDuration(report: SessionReportV1): number {
  return report.analysis.windows.reduce(
    (total, window) => total + window.creditedDurationMs,
    0,
  );
}

function roundFinite(value: number): number {
  if (!Number.isFinite(value)) return Number.NaN;
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return Number.isFinite(rounded) ? rounded : Number.NaN;
}

function hasOnlyFiniteNumbers(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(hasOnlyFiniteNumbers);
  if (isObject(value)) return Object.values(value).every(hasOnlyFiniteNumbers);
  return true;
}

async function digestLowerHex(
  value: string,
  digestSha256: Sha256TextDigest,
): Promise<string | null> {
  try {
    const digest = (await digestSha256(value)).toLowerCase();
    return isSha256(digest) ? digest : null;
  } catch {
    return null;
  }
}

function hasOneTrailingLf(value: string): boolean {
  return value.endsWith("\n") && !value.endsWith("\n\n");
}

function isObject(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return (
    actual.length === sortedExpected.length
    && actual.every((key, index) => key === sortedExpected[index])
  );
}

function isSafeUnsignedInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isBoundedIdentity(value: unknown, maximumLength: number): value is string {
  return (
    typeof value === "string"
    && value.length > 0
    && value.length <= maximumLength
    && value === value.trim()
    && !/[\u0000-\u001f\u007f]/.test(value)
  );
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}
