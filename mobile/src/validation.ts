export type TherapyMode = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type OzealisSettings = {
  pMin: number;
  pMax: number;
  auto: boolean;
  ramp: number;
  mode: TherapyMode;
  delta: number;
  epr: number;
  backupRateBpm: number;
  inspTimeMs: number;
  triggerSens: number;
  cycleSens: number;
  humidifierKind: 0 | 1 | 2;
  humidifierTargetRH: number;
  humidifierMaxTempC: number;
  humidifierPrewarmMinutes: number;
  hoseTempDeltaC: number;
  bleName: string;
  bleAdv: boolean;
};

export type PrewarmSchedule = {
  enabled: boolean;
  hour: number;
  minute: number;
  lastRunKey: string;
};

export type RetainedTransferIdentity = {
  generation: number;
  total: number;
  hash: string;
};

export type RetainedImportManifest = {
  version: 1;
  deviceId: string;
  importedAtMs: number;
  session: RetainedTransferIdentity;
  fault: RetainedTransferIdentity;
};

export type CalibrationStatus = {
  state: string;
  active: boolean;
  valid: boolean;
  amp: number;
  minAmp: number;
  maxAmp: number;
  gain: number;
  maxCm: number;
  bestCm: number;
  bestAmp: number;
  mode: string;
  targetCm: number;
  capturedPoints: number;
  curveValid: boolean;
  fgHz: number | null;
  sensorTrimValid: boolean;
  sensorTrimHpa: number;
  sensorTrimSamples: number;
  sensorTrimStatus: string;
};

export type LiveCsvDiagnostics = {
  measuredCm: string;
  errorCm: string;
  amp: string;
  motorCmd: string;
  motorFault: string;
  motorI2c: string;
  motorFgHz: string;
};

export type SessionGraphPoint = {
  ms: number;
  pressureCm: number;
  flowHpa: number;
  setpointCm: number;
  motorFgHz: number;
  spo2Percent?: number | null;
  pulseBpm?: number | null;
  oximeterSource?: number;
  humidifierTempC?: number | null;
  humidifierRhPercent?: number | null;
  hoseTempC?: number | null;
};

export type SessionSummary = {
  rows: number;
  durationSec: number;
  firstMs: number;
  lastMs: number;
};

export type SessionAnalysisSelection = {
  csv: string;
  source: "Live 10 Hz app sync" | "Retained 1 Hz firmware session" | "--";
};

export type SessionDayOption = {
  key: string;
  label: string;
  rows: number;
};

export type SessionObservationType =
  | "possible obstructive low-flow pattern"
  | "possible central-like low-flow pattern"
  | "possible hypopnea-like low-flow pattern"
  | "indeterminate low-flow pattern";

export type SessionObservation = {
  startMs: number;
  endMs: number;
  durationSec: number;
  type: SessionObservationType;
  confidence: "low" | "medium";
  flowDropPercent: number;
  basis: string;
};

export type McfParamsSnapshot = {
  driver: string;
  state: string;
  i2c: boolean | null;
  fault: boolean | null;
  i2cAddr: string;
  runtimeSpeed: string;
  targetSpeed: string;
  commandReady: boolean;
  writesAllowed: boolean;
  benchOnly: boolean;
  fgHz: number | null;
  commandAmp: number;
  commandPwm: number;
  pins: {
    speedPwm: number | null;
    drvOff: number | null;
    nFault: number | null;
    fg: number | null;
  };
};

export const DEFAULT_SETTINGS: OzealisSettings = {
  pMin: 4,
  pMax: 15,
  auto: true,
  ramp: 300,
  mode: 1,
  delta: 4,
  epr: 3,
  backupRateBpm: 12,
  inspTimeMs: 1000,
  triggerSens: 5,
  cycleSens: 5,
  humidifierKind: 0,
  humidifierTargetRH: 70,
  humidifierMaxTempC: 45,
  humidifierPrewarmMinutes: 15,
  hoseTempDeltaC: 4,
  bleName: "Ozealis",
  bleAdv: true,
};

export const DEFAULT_PREWARM_SCHEDULE: PrewarmSchedule = {
  enabled: false,
  hour: 6,
  minute: 30,
  lastRunKey: "",
};

export const MIN_THERAPY_PRESSURE_CM = 4;
export const MAX_MASK_PRESSURE_CM = 25;
export const MAX_THERAPY_PRESSURE_CM = MAX_MASK_PRESSURE_CM;
export const THERAPY_MODE_LABELS = [
  "CPAP",
  "AutoPAP",
  "BiPAP S",
  "BiPAP ST",
  "BiPAP T",
  "ASV",
  "AutoASV",
  "Auto BiPAP",
  "BiPAP PC",
  "VAPS",
] as const;

const LIVE_SESSION_HEADER =
  "ms,setpoint_hPa,pressure_hPa,flow_hPa,vin,mode,measured_cm,error_cm,controller_amp,motor_cmd,motor_fault,motor_i2c,motor_fg_hz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c";
const RETAINED_SESSION_HEADER =
  "ms,setpoint_cm,pressure_cmH2O,error_cmH2O,flowProxy_hPa,motorAmp,controller_error_cm,controller_amp,motorCmd,motorFault,motorI2c,motorFgHz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c";
const FAULT_CSV_HEADER =
  "ts_ms,sys_mode,fault,vin_V,pMask_hPa,pBlower_hPa,ambient_hPa,diff_hPa,setpoint_cm,flowProxy_hPa,motorAmp,motorCmd,motorFault,motorI2c,motorFgHz,loop_us,miss1,miss2,i2cErr1,i2cErr2";
const LIVE_MAX_SAMPLE_GAP_MS = 1000;
const LIVE_MIN_ANALYSIS_ROWS = 10;
const RETAINED_MAX_SAMPLE_GAP_MS = 2500;
const RETAINED_TRANSFER_MAX_BYTES = 512000;

export function parseSettings(raw: string): OzealisSettings {
  try {
    const parsed = JSON.parse(raw);
    if (!isJsonObject(parsed)) return { ...DEFAULT_SETTINGS };
    return sanitizeSettings(parsed);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function parseSettingsReadback(raw: string): OzealisSettings | null {
  return isSettingsReadbackObject(raw) ? parseSettings(raw) : null;
}

export function isSettingsReadbackObject(raw: string): boolean {
  try {
    const parsed = JSON.parse(raw);
    if (!isJsonObject(parsed)) return false;
    const safe = sanitizeSettings(parsed);
    const expected: Record<keyof OzealisSettings | "backupRate", unknown> = {
      pMin: safe.pMin,
      pMax: safe.pMax,
      auto: safe.auto,
      ramp: safe.ramp,
      mode: safe.mode,
      delta: safe.delta,
      epr: safe.epr,
      backupRate: safe.backupRateBpm,
      backupRateBpm: safe.backupRateBpm,
      inspTimeMs: safe.inspTimeMs,
      triggerSens: safe.triggerSens,
      cycleSens: safe.cycleSens,
      humidifierKind: safe.humidifierKind,
      humidifierTargetRH: safe.humidifierTargetRH,
      humidifierMaxTempC: safe.humidifierMaxTempC,
      humidifierPrewarmMinutes: safe.humidifierPrewarmMinutes,
      hoseTempDeltaC: safe.hoseTempDeltaC,
      bleName: safe.bleName,
      bleAdv: safe.bleAdv,
    };
    const requiredReadbackKeys = [
      "pMin",
      "pMax",
      "auto",
      "ramp",
      "mode",
      "delta",
      "epr",
      "backupRate",
      "inspTimeMs",
      "triggerSens",
      "cycleSens",
      "humidifierKind",
      "humidifierTargetRH",
      "humidifierMaxTempC",
      "humidifierPrewarmMinutes",
      "hoseTempDeltaC",
      "bleName",
      "bleAdv",
    ] as const;
    return requiredReadbackKeys.every(
      (key) => Object.prototype.hasOwnProperty.call(parsed, key) && parsed[key] === expected[key],
    );
  } catch {
    return false;
  }
}

export function parseRetainedImportManifest(raw: string): RetainedImportManifest | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isJsonObject(parsed) || !hasExactKeys(parsed, ["deviceId", "fault", "importedAtMs", "session", "version"])) return null;
    if (
      parsed.version !== 1 ||
      typeof parsed.deviceId !== "string" ||
      parsed.deviceId.length < 1 ||
      parsed.deviceId.length > 256 ||
      /[\x00-\x1f\x7f]/.test(parsed.deviceId) ||
      !Number.isSafeInteger(parsed.importedAtMs) ||
      (parsed.importedAtMs as number) < 0
    ) {
      return null;
    }
    const session = parseRetainedTransferIdentity(parsed.session);
    const fault = parseRetainedTransferIdentity(parsed.fault);
    if (!session || !fault) return null;
    return {
      version: 1,
      deviceId: parsed.deviceId,
      importedAtMs: parsed.importedAtMs as number,
      session,
      fault,
    };
  } catch {
    return null;
  }
}

export function serializeRetainedImportManifest(manifest: RetainedImportManifest): string {
  const parsed = parseRetainedImportManifest(JSON.stringify(manifest));
  if (!parsed) throw new Error("Retained import manifest is invalid.");
  return `${JSON.stringify(parsed)}\n`;
}

export function isSameDeviceSession(
  currentDeviceId: string | null | undefined,
  currentSessionId: number,
  candidateDeviceId: string | null | undefined,
  candidateSessionId: number,
): boolean {
  return Boolean(
    currentDeviceId &&
      candidateDeviceId &&
      currentDeviceId === candidateDeviceId &&
      Number.isSafeInteger(currentSessionId) &&
      currentSessionId === candidateSessionId,
  );
}

export function isCompatibleDeviceSession(
  currentDeviceId: string | null | undefined,
  currentSessionId: number,
  currentProtocolVersion: string,
  candidateDeviceId: string | null | undefined,
  candidateSessionId: number,
  expectedProtocolVersion: string,
): boolean {
  return (
    currentProtocolVersion === expectedProtocolVersion &&
    isSameDeviceSession(currentDeviceId, currentSessionId, candidateDeviceId, candidateSessionId)
  );
}

export function parseUiPreference(raw: string): boolean {
  try {
    const parsed = JSON.parse(raw);
    return isJsonObject(parsed) && parsed.advancedMode === true;
  } catch {
    return false;
  }
}

export function parsePrewarmSchedule(raw: string): PrewarmSchedule {
  try {
    const parsed = JSON.parse(raw);
    if (!isJsonObject(parsed)) return { ...DEFAULT_PREWARM_SCHEDULE };
    return sanitizePrewarmSchedule(parsed);
  } catch {
    return { ...DEFAULT_PREWARM_SCHEDULE };
  }
}

export function sanitizePrewarmSchedule(schedule: Partial<PrewarmSchedule>): PrewarmSchedule {
  return {
    enabled: schedule.enabled === true,
    hour: clampInteger(schedule.hour, 0, 23, DEFAULT_PREWARM_SCHEDULE.hour),
    minute: clampInteger(schedule.minute, 0, 59, DEFAULT_PREWARM_SCHEDULE.minute),
    lastRunKey: typeof schedule.lastRunKey === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(schedule.lastRunKey) ? schedule.lastRunKey : "",
  };
}

export function serializePrewarmSchedule(schedule: PrewarmSchedule): string {
  return `${JSON.stringify(sanitizePrewarmSchedule(schedule))}\n`;
}

export function prewarmScheduleRunKey(now = new Date()): string {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}T${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
}

export function isPrewarmScheduleDue(schedule: PrewarmSchedule, now = new Date()): boolean {
  const safe = sanitizePrewarmSchedule(schedule);
  if (!safe.enabled) return false;
  if (now.getHours() !== safe.hour || now.getMinutes() !== safe.minute) return false;
  return safe.lastRunKey !== prewarmScheduleRunKey(now);
}

export function markPrewarmScheduleRun(schedule: PrewarmSchedule, now = new Date()): PrewarmSchedule {
  return sanitizePrewarmSchedule({ ...schedule, lastRunKey: prewarmScheduleRunKey(now) });
}

export function parseCalibrationStatus(raw: string): CalibrationStatus {
  try {
    const parsed = JSON.parse(raw);
    if (!isJsonObject(parsed)) return defaultCalibrationStatus();
    const sensorTrimSamplesRaw = parsed.sensorTrimSamples;
    const sensorTrimSamples = clampJsonInteger(sensorTrimSamplesRaw, 0, 17, 0);
    const sensorTrimSamplesComplete = sensorTrimSamplesRaw === 17;
    const sensorTrimStatus = knownSensorTrimStatus(parsed.sensorTrimStatus);
    const sensorTrimHpa = boundedJsonNumber(parsed.sensorTrimHpa, -25, 25, 0);
    const sensorTrimInRange = typeof parsed.sensorTrimHpa === "number" && Number.isFinite(parsed.sensorTrimHpa) && parsed.sensorTrimHpa >= -25 && parsed.sensorTrimHpa <= 25;
    const active = parsed.active === true;
    const capturedPoints = clampJsonInteger(parsed.capturedPoints, 0, 17, 0);
    const curveComplete =
      parsed.state === "water-done" &&
      parsed.active === false &&
      parsed.mode === "water" &&
      parsed.capturedPoints === 17 &&
      parsed.curveValid === true;
    return {
      state: knownCalibrationState(parsed.state),
      active,
      valid: parsed.valid === true,
      amp: clampJsonInteger(parsed.amp, 0, 255, 0),
      minAmp: clampJsonInteger(parsed.minAmp, 0, 255, 0),
      maxAmp: clampJsonInteger(parsed.maxAmp, 0, 255, 0),
      gain: boundedJsonNumber(parsed.gain, 0, MAX_MASK_PRESSURE_CM, 0),
      maxCm: boundedJsonNumber(parsed.maxCm, 0, MAX_MASK_PRESSURE_CM, 0),
      bestCm: boundedJsonNumber(parsed.bestCm, 0, MAX_MASK_PRESSURE_CM, 0),
      bestAmp: clampJsonInteger(parsed.bestAmp, 0, 255, 0),
      mode: knownCalibrationMode(parsed.mode),
      targetCm: waterTargetCm(parsed.targetCm),
      capturedPoints,
      curveValid: curveComplete,
      fgHz: boundedJsonNumberOrNull(parsed.fgHz, 0, 100000),
      sensorTrimValid: parsed.sensorTrimValid === true && sensorTrimStatus === "saved" && sensorTrimSamplesComplete && sensorTrimInRange,
      sensorTrimHpa,
      sensorTrimSamples,
      sensorTrimStatus,
    };
  } catch {
    return defaultCalibrationStatus();
  }
}

export function parseLiveCsvDiagnostics(raw: string): LiveCsvDiagnostics {
  const parts = raw.split(",");
  if (!isValidLiveCsvRow(raw)) {
    return { measuredCm: "--", errorCm: "--", amp: "--", motorCmd: "--", motorFault: "--", motorI2c: "--", motorFgHz: "--" };
  }
  return {
    measuredCm: cleanCsvValue(parts[6]),
    errorCm: cleanCsvValue(parts[7]),
    amp: cleanCsvValue(parts[8]),
    motorCmd: cleanCsvValue(parts[9]),
    motorFault: cleanCsvValue(parts[10]),
    motorI2c: cleanCsvValue(parts[11]),
    motorFgHz: cleanCsvValue(parts[12]),
  };
}

export function isValidLiveCsvRow(raw: string): boolean {
  if (raw !== raw.trim()) return false;
  const parts = raw.split(",");
  if (parts.length !== 19) return false;
  if (!validOximetryCsvTriplet(parts, 13) || !validEnvironmentCsvTriplet(parts, 16)) return false;
  return parts.every((part, index) => {
    if (index === 0) return boundedCsvInteger(part, 0, Number.MAX_SAFE_INTEGER);
    if (index === 5) return boundedCsvInteger(part, 0, 4);
    if (index === 8) return boundedCsvInteger(part, 0, 255);
    if (index === 9) return boundedCsvInteger(part, 0, 65535);
    if (index === 10 || index === 11) return boundedCsvInteger(part, 0, 1);
    if (index === 12) return boundedCsvNumber(part, 0, 100000);
    if (index === 13) return part === "NAN" || boundedCsvNumber(part, 50, 100);
    if (index === 14) return part === "NAN" || boundedCsvNumber(part, 20, 250);
    if (index === 15) return boundedCsvInteger(part, 0, 2);
    if (index === 16) return part === "NAN" || boundedCsvNumber(part, -20, 80);
    if (index === 17) return part === "NAN" || boundedCsvNumber(part, 0, 100);
    if (index === 18) return part === "NAN" || boundedCsvNumber(part, -20, 80);
    return finiteCsvNumber(part) !== null;
  });
}

export function parseMcfParamsSnapshot(raw: string): McfParamsSnapshot {
  try {
    const parsed = JSON.parse(raw);
    if (!isJsonObject(parsed)) return defaultMcfParamsSnapshot();
    const driver = parsed.driver === "MCF8316D" ? parsed.driver : "unknown";
    const i2c = typeof parsed.i2c === "boolean" ? parsed.i2c : null;
    const fault = typeof parsed.fault === "boolean" ? parsed.fault : null;
    const state = knownMcfState(parsed.state);
    const runtimeSpeed = knownMcfRuntimeSpeed(parsed.runtimeSpeed);
    const targetSpeed = knownMcfTargetSpeed(parsed.targetSpeed);
    const fgHz = boundedJsonNumberOrNull(parsed.fgHz, 0, 100000);
    const commandAmp = boundedJsonInteger(parsed.commandAmp, 0, 255, 0);
    const commandPwm = boundedJsonInteger(parsed.commandPwm, 0, 65535, 0);
    const pins = parseMcfPins(parsed.pins);
    const explicitCommandReady = parsed.commandReady === true;
    const speedCommandVerified = runtimeSpeed === "bench_pwm_fallback" || (runtimeSpeed === "i2c" && state === "readback_valid");
    const derivedCommandReady =
      driver === "MCF8316D" &&
      i2c === true &&
      fault === false &&
      targetSpeed === "i2c" &&
      speedCommandVerified;
    const derivedWritesAllowed =
      driver === "MCF8316D" &&
      state === "readback_valid" &&
      i2c === true &&
      fault === false &&
      targetSpeed === "i2c" &&
      parsed.writesAllowed === true;
    return {
      driver,
      state,
      i2c,
      fault,
      i2cAddr: knownMcfI2cAddress(parsed.i2cAddr),
      runtimeSpeed,
      targetSpeed,
      commandReady: explicitCommandReady && derivedCommandReady,
      writesAllowed: derivedWritesAllowed,
      benchOnly: runtimeSpeed === "bench_pwm_fallback",
      fgHz,
      commandAmp,
      commandPwm,
      pins,
    };
  } catch {
    return defaultMcfParamsSnapshot();
  }
}

export function parseOtaStatus(raw: string): string {
  if (raw !== raw.trim()) return "unknown";
  if (raw === "IDLE" || raw === "START" || raw === "OK" || raw === "ERR") return raw;
  const match = /^(0|[1-9]\d?|100)%$/.exec(raw);
  if (!match) return "unknown";
  const percent = Number(match[1]);
  if (!Number.isInteger(percent) || percent < 0 || percent > 100) return "unknown";
  return `${percent}%`;
}

export function isOtaStatusInProgress(raw: string): boolean {
  const status = parseOtaStatus(raw);
  return status === "START" || /^\d{1,3}%$/.test(status);
}

export function redactSensitiveJson(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    if (!isJsonObject(parsed)) return invalidJsonSnapshotExport();
    return JSON.stringify(redactSensitiveValue(parsed), null, 2);
  } catch {
    return invalidJsonSnapshotExport();
  }
}

export function parseSystemMode(raw: string): string {
  return /^[0-4]$/.test(raw) ? raw : "--";
}

export function parseFaultCode(raw: string): string {
  return /^[0-4]$/.test(raw) ? raw : "--";
}

export function parseModuleStatus(raw: string): string {
  if (!/^(?:[0-9]|1[0-5])$/.test(raw)) return "unknown";
  const flags = Number(raw);
  const modules = [];
  if (flags & 1) modules.push("humidifier");
  if (flags & 2) modules.push("hose");
  if (flags & 4) modules.push("oximeter");
  if (flags & 8) modules.push("prewarm");
  return modules.length ? modules.join(" + ") : "none";
}

export function parseOptionalTelemetryNumber(raw: string): string {
  if (raw !== raw.trim() || !raw || raw === "NAN") return "--";
  return finiteCsvNumber(raw) !== null ? raw : "--";
}

export function csvDataRowCount(raw: string): number {
  const format = csvFormat(raw);
  if (format === "live" || format === "retained") return parseSessionSamples(raw).length;
  if (format === "fault") return parseFaultRows(raw).length;
  return 0;
}

export function csvPreview(raw: string, maxLines = 40): string {
  const lines = knownCsvLines(raw);
  if (lines.length === 0) return "";
  const lineLimit = Number.isFinite(maxLines) ? Math.max(0, Math.floor(maxLines)) : 0;
  if (lines.length <= lineLimit) return lines.join("\n");
  const preview = lines.slice(0, lineLimit).join("\n");
  const suffix = `... ${lines.length - lineLimit} more valid preview lines; export CSV for the complete log.`;
  return preview ? `${preview}\n${suffix}` : suffix;
}

export function normalizeKnownCsv(raw: string): string {
  const lines = knownCsvLines(raw);
  return lines.length > 1 ? `${lines.join("\n")}\n` : "";
}

export function normalizeRetainedSessionCsv(raw: string): string {
  if (sessionCsvFormat(raw) !== "retained") return "";
  const lines = knownCsvLines(raw);
  return lines.length > 1 ? `${lines.join("\n")}\n` : "";
}

export function normalizeRetainedSessionSnapshot(raw: string): string | null {
  const lines = csvEvidenceLines(raw);
  if (!lines || lines[0] !== RETAINED_SESSION_HEADER) return null;
  if (lines.length === 1) return raw;
  let lastMs = -Infinity;
  for (const row of lines.slice(1)) {
    if (!isValidRetainedCsvRow(row)) return null;
    const ms = finiteCsvNumber(row.split(",")[0]);
    if (ms === null || ms <= lastMs) return null;
    lastMs = ms;
  }
  // Preserve the exact transferred bytes so generation/total/hash keep identifying
  // the persisted snapshot. Analysis helpers separately select its latest cadence segment.
  return raw;
}

export function normalizeFaultCsv(raw: string): string {
  if (csvFormat(raw) !== "fault") return "";
  const lines = knownCsvLines(raw);
  return lines.length > 1 ? `${lines.join("\n")}\n` : "";
}

export function normalizeFaultSnapshot(raw: string): string | null {
  const lines = csvEvidenceLines(raw);
  if (!lines || lines[0] !== FAULT_CSV_HEADER) return null;
  if (lines.length === 1) return raw;
  let lastMs = -Infinity;
  for (const row of lines.slice(1)) {
    if (!isValidFaultCsvRow(row)) return null;
    const ms = finiteCsvNumber(row.split(",")[0]);
    if (ms === null || ms <= lastMs) return null;
    lastMs = ms;
  }
  return raw;
}

export function retainedReadbackImportedRowCount(sessionCsv: string, faultCsv: string): number {
  return csvDataRowCount(normalizeRetainedSessionCsv(sessionCsv)) + csvDataRowCount(normalizeFaultCsv(faultCsv));
}

export function isClearedDeviceLogReadback(sessionCsv: string, faultCsv: string): boolean {
  return isHeaderOnlyCsvReadback(sessionCsv, RETAINED_SESSION_HEADER) && isHeaderOnlyCsvReadback(faultCsv, FAULT_CSV_HEADER);
}

export function isHeaderOnlyRetainedSessionCsv(raw: string): boolean {
  return isHeaderOnlyCsvReadback(raw, RETAINED_SESSION_HEADER);
}

export function isHeaderOnlyFaultCsv(raw: string): boolean {
  return isHeaderOnlyCsvReadback(raw, FAULT_CSV_HEADER);
}

export function parseSessionGraphData(raw: string, maxPoints = 120): SessionGraphPoint[] {
  const points = parseSessionSamples(raw).map(({ ms, pressureCm, flowHpa, setpointCm, motorFgHz, spo2Percent, pulseBpm, oximeterSource, humidifierTempC, humidifierRhPercent, hoseTempC }) => {
    const point: SessionGraphPoint = { ms, pressureCm, flowHpa, setpointCm, motorFgHz };
    if (oximeterSource !== undefined) {
      point.spo2Percent = spo2Percent;
      point.pulseBpm = pulseBpm;
      point.oximeterSource = oximeterSource;
    }
    if (humidifierTempC !== undefined || humidifierRhPercent !== undefined || hoseTempC !== undefined) {
      point.humidifierTempC = humidifierTempC;
      point.humidifierRhPercent = humidifierRhPercent;
      point.hoseTempC = hoseTempC;
    }
    return point;
  });

  const pointLimit = Number.isFinite(maxPoints) ? Math.max(0, Math.floor(maxPoints)) : 120;
  if (pointLimit === 0) return [];
  if (pointLimit === 1) return points.length > 0 ? [points[points.length - 1]] : [];
  if (points.length <= pointLimit) return points;
  return Array.from({ length: pointLimit }, (_, index) => {
    const sourceIndex = Math.round((index * (points.length - 1)) / (pointLimit - 1));
    return points[sourceIndex];
  });
}

export function summarizeSessionCsv(raw: string): SessionSummary {
  const format = sessionCsvFormat(raw);
  const samples = parseSessionSamples(raw);
  if (samples.length === 0) {
    return { rows: 0, durationSec: 0, firstMs: 0, lastMs: 0 };
  }
  const firstMs = samples[0].ms;
  const lastMs = samples[samples.length - 1].ms;
  const fallbackPeriodMs = format === "live" ? 100 : 1000;
  return {
    rows: samples.length,
    durationSec: sampleWindowDurationSec(samples, 1000, samples, fallbackPeriodMs),
    firstMs,
    lastMs,
  };
}

export function selectSessionAnalysisCsv(
  liveCsv: string,
  retainedCsv: string,
  bleConnected: boolean,
): SessionAnalysisSelection {
  if (bleConnected && parseSessionSamples(liveCsv).length >= LIVE_MIN_ANALYSIS_ROWS) {
    return { csv: liveCsv, source: "Live 10 Hz app sync" };
  }
  if (parseSessionSamples(retainedCsv).length > 0) {
    return { csv: retainedCsv, source: "Retained 1 Hz firmware session" };
  }
  return { csv: "", source: "--" };
}

export function listSessionDayOptions(raw: string, maxDays = 7): SessionDayOption[] {
  const rows = validSessionRows(raw);
  if (rows.length === 0) return [];
  const dayLimit = Number.isFinite(maxDays) ? Math.max(0, Math.floor(maxDays)) : 7;
  const lastMs = rows[rows.length - 1].ms;
  const buckets = new Map<number, number>();
  rows.forEach(({ ms }) => {
    const index = elapsedDayIndex(ms, lastMs);
    if (index >= 0 && index < dayLimit) buckets.set(index, (buckets.get(index) || 0) + 1);
  });
  return Array.from(buckets.entries())
    .sort(([left], [right]) => left - right)
    .map(([index, count]) => ({ key: `day-${index}`, label: elapsedDayLabel(index), rows: count }));
}

export function filterSessionCsvByDay(raw: string, dayKey: string): string {
  const rows = validSessionRows(raw);
  if (rows.length === 0) return "";
  const match = /^day-(\d+)$/.exec(dayKey);
  const selectedIndex = match ? Number(match[1]) : 0;
  if (!Number.isSafeInteger(selectedIndex) || selectedIndex < 0) return "";
  const header = csvHeader(raw);
  const lastMs = rows[rows.length - 1].ms;
  const selectedRows = rows.filter(({ ms }) => elapsedDayIndex(ms, lastMs) === selectedIndex).map(({ row }) => row);
  return selectedRows.length > 0 ? `${[header, ...selectedRows].join("\n")}\n` : "";
}

export function flagSessionObservations(raw: string): SessionObservation[] {
  const samples = parseSessionSamples(raw);
  if (samples.length < 20) return [];

  const absFlow = samples.map((sample) => Math.abs(sample.flowHpa)).filter((value) => Number.isFinite(value));
  const baselineFlow = percentile(absFlow, 75);
  if (!Number.isFinite(baselineFlow) || baselineFlow < 0.05) return [];

  const apneaThreshold = Math.max(0.03, baselineFlow * 0.2);
  const hypopneaThreshold = Math.max(apneaThreshold, baselineFlow * 0.5);
  const observations: SessionObservation[] = [];
  let segmentStart = -1;
  let segmentKind: "apnea" | "hypopnea" | null = null;

  const closeSegment = (endIndex: number) => {
    if (segmentStart < 0 || !segmentKind) return;
    const segment = samples.slice(segmentStart, endIndex);
    if (segment.length === 0) return;
    const durationSec = segmentDurationSec(segment, samples);
    if (durationSec < 10) return;
    observations.push(classifyObservation(samples, segmentStart, endIndex, segmentKind, baselineFlow));
  };

  samples.forEach((sample, index) => {
    const value = Math.abs(sample.flowHpa);
    const nextKind = value <= apneaThreshold ? "apnea" : value <= hypopneaThreshold ? "hypopnea" : null;
    if (nextKind === segmentKind) return;
    closeSegment(index);
    segmentStart = nextKind ? index : -1;
    segmentKind = nextKind;
  });
  closeSegment(samples.length);

  return observations.slice(0, 50);
}

export function sanitizeSettings(settings: Partial<OzealisSettings>): OzealisSettings {
  const pMin = clampNumber(settings.pMin, MIN_THERAPY_PRESSURE_CM, MAX_THERAPY_PRESSURE_CM, DEFAULT_SETTINGS.pMin);
  const pMaxFallback = Math.max(pMin, DEFAULT_SETTINGS.pMax);
  const pMax = clampNumber(settings.pMax, pMin, MAX_THERAPY_PRESSURE_CM, pMaxFallback);
  const requestedBleName = typeof settings.bleName === "string" ? sanitizeBleName(settings.bleName) : "";
  const bleName = requestedBleName || DEFAULT_SETTINGS.bleName;
  const requestedMode =
    settings.mode === undefined && typeof settings.auto === "boolean"
      ? settings.auto
        ? 1
        : 0
      : toTherapyMode(settings.mode);
  const mode = requestedMode === 0 && settings.auto === true ? 1 : requestedMode;
  const bleAdv = typeof settings.bleAdv === "boolean" ? settings.bleAdv : DEFAULT_SETTINGS.bleAdv;
  return {
    pMin,
    pMax,
    auto: therapyModeUsesAutoRange(mode),
    ramp: clampNumber(settings.ramp, 0, 1800, DEFAULT_SETTINGS.ramp),
    mode,
    delta: clampNumber(settings.delta, 0, 12, DEFAULT_SETTINGS.delta),
    epr: clampInteger(settings.epr, 0, 3, DEFAULT_SETTINGS.epr),
    backupRateBpm: clampNumber((settings as Partial<OzealisSettings> & { backupRate?: unknown }).backupRate ?? settings.backupRateBpm, 4, 30, DEFAULT_SETTINGS.backupRateBpm),
    inspTimeMs: clampInteger(settings.inspTimeMs, 300, 3000, DEFAULT_SETTINGS.inspTimeMs),
    triggerSens: clampInteger(settings.triggerSens, 1, 9, DEFAULT_SETTINGS.triggerSens),
    cycleSens: clampInteger(settings.cycleSens, 1, 9, DEFAULT_SETTINGS.cycleSens),
    humidifierKind: clampInteger(settings.humidifierKind, 0, 2, DEFAULT_SETTINGS.humidifierKind) as 0 | 1 | 2,
    humidifierTargetRH: clampNumber(settings.humidifierTargetRH, 30, 90, DEFAULT_SETTINGS.humidifierTargetRH),
    humidifierMaxTempC: clampNumber(settings.humidifierMaxTempC, 30, 60, DEFAULT_SETTINGS.humidifierMaxTempC),
    humidifierPrewarmMinutes: clampInteger(settings.humidifierPrewarmMinutes, 0, 60, DEFAULT_SETTINGS.humidifierPrewarmMinutes),
    hoseTempDeltaC: clampNumber(settings.hoseTempDeltaC, 0, 15, DEFAULT_SETTINGS.hoseTempDeltaC),
    bleName,
    bleAdv,
  };
}

export function settingLimitMessages(settings: OzealisSettings): string[] {
  const safe = sanitizeSettings(settings);
  const messages: string[] = [];
  if (settings.pMin !== safe.pMin) messages.push(`Minimum pressure adjusted to ${safe.pMin} cmH2O.`);
  if (settings.pMax !== safe.pMax) messages.push(`Maximum pressure adjusted to ${safe.pMax} cmH2O.`);
  if (settings.ramp !== safe.ramp) messages.push(`Ramp adjusted to ${safe.ramp} seconds.`);
  if (settings.delta !== safe.delta) messages.push(`Bi-level delta adjusted to ${safe.delta} cmH2O.`);
  if (settings.epr !== safe.epr) messages.push(`EPR relief adjusted to ${safe.epr} cmH2O.`);
  if (settings.backupRateBpm !== safe.backupRateBpm) messages.push(`Backup rate adjusted to ${safe.backupRateBpm} bpm.`);
  if (settings.inspTimeMs !== safe.inspTimeMs) messages.push(`Inspiratory time adjusted to ${safe.inspTimeMs} ms.`);
  if (settings.triggerSens !== safe.triggerSens) messages.push(`Trigger sensitivity adjusted to ${safe.triggerSens}.`);
  if (settings.cycleSens !== safe.cycleSens) messages.push(`Cycle sensitivity adjusted to ${safe.cycleSens}.`);
  if (settings.humidifierKind !== safe.humidifierKind) messages.push("Humidifier type adjusted.");
  if (settings.humidifierTargetRH !== safe.humidifierTargetRH) messages.push(`Humidity target adjusted to ${safe.humidifierTargetRH}% RH.`);
  if (settings.humidifierMaxTempC !== safe.humidifierMaxTempC) messages.push(`Humidifier temperature limit adjusted to ${safe.humidifierMaxTempC} C.`);
  if (settings.humidifierPrewarmMinutes !== safe.humidifierPrewarmMinutes) messages.push(`Prewarm time adjusted to ${safe.humidifierPrewarmMinutes} minutes.`);
  if (settings.hoseTempDeltaC !== safe.hoseTempDeltaC) messages.push(`Hose temperature lift adjusted to ${safe.hoseTempDeltaC} C.`);
  if (settings.mode !== safe.mode) messages.push(`Therapy mode adjusted to ${THERAPY_MODE_LABELS[safe.mode]}.`);
  if (settings.bleName !== safe.bleName) messages.push(`BLE name adjusted to "${safe.bleName}".`);
  return messages;
}

export function serializeSettings(settings: OzealisSettings): string {
  const safe = sanitizeSettings(settings);
  return JSON.stringify({
    pMin: safe.pMin,
    pMax: safe.pMax,
    auto: safe.auto,
    ramp: safe.ramp,
    mode: safe.mode,
    delta: safe.delta,
    epr: safe.epr,
    backupRate: safe.backupRateBpm,
    inspTimeMs: safe.inspTimeMs,
    triggerSens: safe.triggerSens,
    cycleSens: safe.cycleSens,
    humidifierKind: safe.humidifierKind,
    humidifierTargetRH: safe.humidifierTargetRH,
    humidifierMaxTempC: safe.humidifierMaxTempC,
    humidifierPrewarmMinutes: safe.humidifierPrewarmMinutes,
    hoseTempDeltaC: safe.hoseTempDeltaC,
    bleName: safe.bleName,
    bleAdv: safe.bleAdv,
  });
}

export function isSupportedOtaUrl(value: string): boolean {
  return value === value.trim() && /^https?:\/\/[^/?#\s\x00-\x1f\x7f]+[^\s\x00-\x1f\x7f]*$/.test(value);
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isInteger(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function finiteJsonNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function boundedJsonNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) return fallback;
  return value;
}

function boundedJsonNumberOrNull(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) return null;
  return value;
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expectedKeys: string[]): boolean {
  const actualKeys = Object.keys(value).sort();
  return actualKeys.length === expectedKeys.length && actualKeys.every((key, index) => key === expectedKeys[index]);
}

function parseRetainedTransferIdentity(value: unknown): RetainedTransferIdentity | null {
  if (!isJsonObject(value) || !hasExactKeys(value, ["generation", "hash", "total"])) return null;
  if (
    !Number.isSafeInteger(value.generation) ||
    (value.generation as number) < 1 ||
    (value.generation as number) > 0xffff_ffff ||
    !Number.isSafeInteger(value.total) ||
    (value.total as number) < 1 ||
    (value.total as number) > RETAINED_TRANSFER_MAX_BYTES ||
    typeof value.hash !== "string" ||
    !/^[0-9a-f]{8}$/.test(value.hash)
  ) {
    return null;
  }
  return {
    generation: value.generation as number,
    total: value.total as number,
    hash: value.hash,
  };
}

function invalidJsonSnapshotExport(): string {
  return JSON.stringify({ exportError: "invalid_json_snapshot_not_exported" }, null, 2);
}

function defaultCalibrationStatus(): CalibrationStatus {
  return {
    state: "unknown",
    active: false,
    valid: false,
    amp: 0,
    minAmp: 0,
    maxAmp: 0,
    gain: 0,
    maxCm: 0,
    bestCm: 0,
    bestAmp: 0,
    mode: "auto",
    targetCm: 0,
    capturedPoints: 0,
    curveValid: false,
    fgHz: null,
    sensorTrimValid: false,
    sensorTrimHpa: 0,
    sensorTrimSamples: 0,
    sensorTrimStatus: "unknown",
  };
}

function defaultMcfParamsSnapshot(): McfParamsSnapshot {
  return {
    driver: "unknown",
    state: "unknown",
    i2c: null,
    fault: null,
    i2cAddr: "unknown",
    runtimeSpeed: "unknown",
    targetSpeed: "unknown",
    commandReady: false,
    writesAllowed: false,
    benchOnly: false,
    fgHz: null,
    commandAmp: 0,
    commandPwm: 0,
    pins: {
      speedPwm: null,
      drvOff: null,
      nFault: null,
      fg: null,
    },
  };
}

function sanitizeBleName(value: string): string {
  return value
    .trim()
    .replace(/["\\]/g, "")
    .replace(/[^\x20-\x7e]/g, "")
    .slice(0, 19);
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function clampJsonInteger(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isInteger(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function boundedJsonInteger(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) return fallback;
  return value;
}

function waterTargetCm(value: unknown): number {
  if (value === 0) return 0;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 4 || value > 20) return 0;
  return value;
}

function finiteCsvNumber(value: string | undefined): number | null {
  const text = String(value ?? "");
  if (text !== text.trim() || !text) return null;
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(text)) return null;
  const numberValue = Number(text);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function integerCsvNumber(value: string | undefined): number | null {
  const text = String(value ?? "");
  if (text === "-0") return null;
  if (!/^-?(?:0|[1-9]\d*)$/.test(text)) return null;
  const numberValue = finiteCsvNumber(text);
  return numberValue !== null && Number.isInteger(numberValue) ? numberValue : null;
}

function boundedCsvInteger(value: string | undefined, min: number, max: number): boolean {
  const text = String(value ?? "");
  if (min >= 0 && text.startsWith("-")) return false;
  const numberValue = integerCsvNumber(value);
  return numberValue !== null && numberValue >= min && numberValue <= max;
}

function boundedCsvNumber(value: string | undefined, min: number, max: number): boolean {
  const text = String(value ?? "");
  if (min >= 0 && text.startsWith("-")) return false;
  const numberValue = finiteCsvNumber(value);
  return numberValue !== null && numberValue >= min && numberValue <= max;
}

function parseOximetryCsvFields(parts: string[], offset: number): { spo2Percent: number | null; pulseBpm: number | null; oximeterSource?: number } {
  if (parts.length <= offset) return { spo2Percent: null, pulseBpm: null };
  const spo2 = parts[offset] === "NAN" ? null : finiteCsvNumber(parts[offset]);
  const pulse = parts[offset + 1] === "NAN" ? null : finiteCsvNumber(parts[offset + 1]);
  const source = integerCsvNumber(parts[offset + 2]) ?? 0;
  const validSource = source >= 0 && source <= 2 ? source : 0;
  return {
    spo2Percent: spo2 !== null && spo2 >= 50 && spo2 <= 100 ? spo2 : null,
    pulseBpm: pulse !== null && pulse >= 20 && pulse <= 250 ? pulse : null,
    oximeterSource: validSource,
  };
}

function jsonString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function knownCalibrationState(value: unknown): string {
  const text = jsonString(value, "unknown");
  if (
    text === "idle" ||
    text === "preparing" ||
    text === "sweeping" ||
    text === "done" ||
    text === "aborted" ||
    text === "weak-response" ||
    text === "driver-not-ready" ||
    text === "sensor-error" ||
    text === "water-column" ||
    text === "water-wait-rise" ||
    text === "water-limit" ||
    text === "water-done"
  ) {
    return text;
  }
  return "unknown";
}

function knownCalibrationMode(value: unknown): string {
  return value === "water" ? "water" : "auto";
}

function knownSensorTrimStatus(value: unknown): string {
  const text = jsonString(value, "unknown");
  if (
    text === "saved" ||
    text === "pending" ||
    text === "too-few-samples" ||
    text === "invalid-offset" ||
    text === "not-saved"
  ) {
    return text;
  }
  return "unknown";
}

function redactSensitiveValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSensitiveValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      /passcode|password|pwd|secret|token|credential|api[_-]?key|private[_-]?key|authorization|bearer/i.test(key) ? "[redacted]" : redactSensitiveValue(item),
    ]),
  );
}

function knownMcfState(value: unknown): string {
  if (value === "register_layer_pending" || value === "readback_valid") return value;
  return "unknown";
}

function knownMcfRuntimeSpeed(value: unknown): string {
  if (value === "disabled_until_i2c_speed" || value === "i2c" || value === "bench_pwm_fallback") return value;
  return "unknown";
}

function knownMcfTargetSpeed(value: unknown): string {
  if (value === "i2c") return value;
  return "unknown";
}

function knownMcfI2cAddress(value: unknown): string {
  if (typeof value !== "string" || !/^0x[0-7][0-9a-f]$/i.test(value)) return "unknown";
  return value.toLowerCase();
}

function parseMcfPin(value: unknown): number | null {
  if (value === -1) return -1;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 39) return null;
  return value;
}

function parseMcfPins(value: unknown): McfParamsSnapshot["pins"] {
  if (!isJsonObject(value)) {
    return {
      speedPwm: null,
      drvOff: null,
      nFault: null,
      fg: null,
    };
  }
  return {
    speedPwm: parseMcfPin(value.speedPwm),
    drvOff: parseMcfPin(value.drvOff),
    nFault: parseMcfPin(value.nFault),
    fg: parseMcfPin(value.fg),
  };
}

function parseSessionSamples(raw: string) {
  const lines = csvEvidenceLines(raw);
  if (!lines) return [];
  const format = sessionCsvFormat(raw);
  if (format === "unknown") return [];
  const maxGapMs = sessionMaxSampleGapMs(format);
  let lastMs = -Infinity;
  let samples: {
    ms: number;
    setpointCm: number;
    pressureCm: number;
    errorCm: number;
    flowHpa: number;
    motorAmp: number;
    controllerErrorCm: number;
    controllerAmp: number;
    motorFgHz: number;
    spo2Percent?: number | null;
    pulseBpm?: number | null;
    oximeterSource?: number;
    humidifierTempC?: number | null;
    humidifierRhPercent?: number | null;
    hoseTempC?: number | null;
  }[] = [];
  lines.slice(1).forEach((row) => {
      const parts = row.split(",");
      if (format === "live") {
        if (!isValidLiveSessionEvidenceRow(row)) return;
        const values = parts.slice(0, 13).map((part) => finiteCsvNumber(part));
        if (values.some((value) => value === null)) return;
        const oximetry = parseOximetryCsvFields(parts, 13);
        const environment = parseEnvironmentCsvFields(parts, 16);
        const sample = {
          ms: values[0] as number,
          setpointCm: hPaToCmH2O(values[1] as number),
          pressureCm: values[6] as number,
          errorCm: values[7] as number,
          flowHpa: values[3] as number,
          motorAmp: values[8] as number,
          controllerErrorCm: values[7] as number,
          controllerAmp: values[8] as number,
          motorFgHz: values[12] as number,
          spo2Percent: oximetry.spo2Percent,
          pulseBpm: oximetry.pulseBpm,
          oximeterSource: oximetry.oximeterSource,
          humidifierTempC: environment.humidifierTempC,
          humidifierRhPercent: environment.humidifierRhPercent,
          hoseTempC: environment.hoseTempC,
        };
        if (![sample.ms, sample.setpointCm, sample.pressureCm, sample.flowHpa, sample.motorFgHz].every(Number.isFinite)) return;
        if (sample.ms === lastMs) return;
        if (sample.ms < lastMs || (Number.isFinite(lastMs) && sample.ms - lastMs > maxGapMs)) samples = [];
        lastMs = sample.ms;
        samples.push(sample);
        return;
      }
      if (!isValidRetainedCsvRow(row)) return;
      const values = parts.slice(0, 12).map((part) => finiteCsvNumber(part));
      if (values.some((value) => value === null)) return;
      const oximetry = parseOximetryCsvFields(parts, 12);
      const environment = parseEnvironmentCsvFields(parts, 15);
      const sample = {
        ms: values[0] as number,
        setpointCm: values[1] as number,
        pressureCm: values[2] as number,
        errorCm: values[3] as number,
        flowHpa: values[4] as number,
        motorAmp: values[5] as number,
        controllerErrorCm: values[6] as number,
        controllerAmp: values[7] as number,
        motorFgHz: values[11] as number,
        spo2Percent: oximetry.spo2Percent,
        pulseBpm: oximetry.pulseBpm,
        oximeterSource: oximetry.oximeterSource,
        humidifierTempC: environment.humidifierTempC,
        humidifierRhPercent: environment.humidifierRhPercent,
        hoseTempC: environment.hoseTempC,
      };
      if (![sample.ms, sample.setpointCm, sample.pressureCm, sample.flowHpa, sample.motorFgHz].every(Number.isFinite)) return;
      if (sample.ms === lastMs) return;
      if (sample.ms < lastMs || (Number.isFinite(lastMs) && sample.ms - lastMs > maxGapMs)) samples = [];
      lastMs = sample.ms;
      samples.push(sample);
    });
  return samples;
}

function sessionMaxSampleGapMs(format: "live" | "retained"): number {
  return format === "live" ? LIVE_MAX_SAMPLE_GAP_MS : RETAINED_MAX_SAMPLE_GAP_MS;
}

function sessionCsvFormat(raw: string): "live" | "retained" | "unknown" {
  const header = csvHeader(raw);
  if (header === LIVE_SESSION_HEADER) return "live";
  if (header === RETAINED_SESSION_HEADER) return "retained";
  return "unknown";
}

function csvFormat(raw: string): "live" | "retained" | "fault" | "unknown" {
  const header = csvHeader(raw);
  if (header === LIVE_SESSION_HEADER) return "live";
  if (header === RETAINED_SESSION_HEADER) return "retained";
  if (header === FAULT_CSV_HEADER) return "fault";
  return "unknown";
}

function csvHeader(raw: string): string {
  const header = raw.split(/\r?\n/)[0];
  if (!header || header !== header.trim()) return "";
  return header;
}

function isHeaderOnlyCsvReadback(raw: string, expectedHeader: string): boolean {
  const lines = raw.split(/\r?\n/);
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  return lines.length === 1 && lines[0] === expectedHeader;
}

function knownCsvLines(raw: string): string[] {
  const lines = csvEvidenceLines(raw);
  if (!lines) return [];
  const format = csvFormat(raw);
  if (format === "unknown") return [];
  if (format === "fault") {
    return lines.slice(0, 1).concat(parseFaultRows(raw));
  }
  let lastMs = -Infinity;
  const maxGapMs = format === "live" ? LIVE_MAX_SAMPLE_GAP_MS : RETAINED_MAX_SAMPLE_GAP_MS;
  let rows: string[] = [];
  lines.slice(1).forEach((row) => {
    if (format === "live" && !isValidLiveSessionEvidenceRow(row)) return;
    if (format === "retained" && !isValidRetainedCsvRow(row)) return;
    const parts = row.split(",");
    const coreLength = format === "live" ? 13 : 12;
    const values = parts.slice(0, coreLength).map((part) => finiteCsvNumber(part));
    if (values.some((value) => value === null)) return;
    const ms = values[0] as number;
    if (ms === lastMs) return;
    if (ms < lastMs || (Number.isFinite(lastMs) && ms - lastMs > maxGapMs)) rows = [];
    lastMs = ms;
    rows.push(row);
  });
  return lines.slice(0, 1).concat(rows);
}

function validSessionRows(raw: string): { ms: number; row: string }[] {
  const lines = csvEvidenceLines(raw);
  if (!lines) return [];
  const format = sessionCsvFormat(raw);
  if (format === "unknown") return [];
  const maxGapMs = sessionMaxSampleGapMs(format);
  let lastMs = -Infinity;
  let rows: { ms: number; row: string }[] = [];
  lines.slice(1).forEach((row) => {
    if (format === "live" && !isValidLiveSessionEvidenceRow(row)) return;
    if (format === "retained" && !isValidRetainedCsvRow(row)) return;
    const ms = finiteCsvNumber(row.split(",")[0]);
    if (ms === null) return;
    if (ms === lastMs) return;
    if (ms < lastMs || (Number.isFinite(lastMs) && ms - lastMs > maxGapMs)) rows = [];
    lastMs = ms;
    rows.push({ ms, row });
  });
  return rows;
}

function elapsedDayIndex(ms: number, lastMs: number): number {
  if (!Number.isFinite(ms) || !Number.isFinite(lastMs) || ms > lastMs) return -1;
  return Math.floor((lastMs - ms) / 86400000);
}

function elapsedDayLabel(index: number): string {
  if (index === 0) return "Latest day";
  if (index === 1) return "Previous day";
  return `${index} days earlier`;
}

function parseFaultRows(raw: string): string[] {
  if (csvFormat(raw) !== "fault") return [];
  const lines = csvEvidenceLines(raw);
  if (!lines) return [];
  let lastMs = -Infinity;
  return lines
    .slice(1)
    .filter((line) => {
      if (!isValidFaultCsvRow(line)) return false;
      const ms = finiteCsvNumber(line.split(",")[0]);
      if (ms === null || ms <= lastMs) return false;
      lastMs = ms;
      return true;
    });
}

function csvEvidenceLines(raw: string): string[] | null {
  if (!raw) return [];
  const lines = raw.split(/\r?\n/);
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  if (lines.some((line) => line.length === 0 || line !== line.trim())) return null;
  return lines;
}

function isValidRetainedCsvRow(row: string): boolean {
  if (row !== row.trim()) return false;
  const parts = row.split(",");
  if (parts.length !== 18) return false;
  if (!validOximetryCsvTriplet(parts, 12) || !validEnvironmentCsvTriplet(parts, 15)) return false;
  return parts.every((part, index) => {
    if (index === 0) return boundedCsvInteger(part, 0, Number.MAX_SAFE_INTEGER);
    if (index === 5 || index === 7) return boundedCsvInteger(part, 0, 255);
    if (index === 8) return boundedCsvInteger(part, 0, 65535);
    if (index === 9 || index === 10) return boundedCsvInteger(part, 0, 1);
    if (index === 11) return boundedCsvNumber(part, 0, 100000);
    if (index === 12) return part === "NAN" || boundedCsvNumber(part, 50, 100);
    if (index === 13) return part === "NAN" || boundedCsvNumber(part, 20, 250);
    if (index === 14) return boundedCsvInteger(part, 0, 2);
    if (index === 15) return part === "NAN" || boundedCsvNumber(part, -20, 80);
    if (index === 16) return part === "NAN" || boundedCsvNumber(part, 0, 100);
    if (index === 17) return part === "NAN" || boundedCsvNumber(part, -20, 80);
    return finiteCsvNumber(part) !== null;
  });
}

function isValidLiveSessionEvidenceRow(row: string): boolean {
  if (!isValidLiveCsvRow(row)) return false;
  const mode = row.split(",")[5];
  return mode === "1" || mode === "2";
}

function isValidFaultCsvRow(row: string): boolean {
  if (row !== row.trim()) return false;
  const parts = row.split(",");
  if (parts.length !== 20) return false;
  return parts.every((part, index) => {
    if (index === 0) return boundedCsvInteger(part, 0, Number.MAX_SAFE_INTEGER);
    if (index === 1) return part === "4";
    if (index === 2) return boundedCsvInteger(part, 1, 4);
    if (index >= 3 && index <= 9 && part === "NAN") return true;
    if (index === 10) return boundedCsvInteger(part, 0, 255);
    if (index === 11) return boundedCsvInteger(part, 0, 65535);
    if (index === 12 || index === 13) return boundedCsvInteger(part, 0, 1);
    if (index === 14) return part === "NAN" || boundedCsvNumber(part, 0, 100000);
    if (index >= 15 && index <= 17) return boundedCsvInteger(part, 0, 65535);
    if (index >= 18 && index <= 19) return boundedCsvInteger(part, -128, 127);
    return finiteCsvNumber(part) !== null;
  });
}

function hPaToCmH2O(value: number): number {
  return value / 0.980665;
}

function validOximetryCsvTriplet(parts: string[], offset: number): boolean {
  const spo2Present = parts[offset] !== "NAN";
  const pulsePresent = parts[offset + 1] !== "NAN";
  const source = integerCsvNumber(parts[offset + 2]);
  if (source === null || source < 0 || source > 2) return false;
  if (!spo2Present || !pulsePresent) return !spo2Present && !pulsePresent && source === 0;
  return source === 1 || source === 2;
}

function validEnvironmentCsvTriplet(parts: string[], offset: number): boolean {
  return (
    (parts[offset] === "NAN" || boundedCsvNumber(parts[offset], -20, 80)) &&
    (parts[offset + 1] === "NAN" || boundedCsvNumber(parts[offset + 1], 0, 100)) &&
    (parts[offset + 2] === "NAN" || boundedCsvNumber(parts[offset + 2], -20, 80))
  );
}

function parseEnvironmentCsvFields(
  parts: string[],
  offset: number,
): { humidifierTempC?: number | null; humidifierRhPercent?: number | null; hoseTempC?: number | null } {
  if (parts.length <= offset) return {};
  const humidifierTemp = parts[offset] === "NAN" ? null : finiteCsvNumber(parts[offset]);
  const humidifierRh = parts[offset + 1] === "NAN" ? null : finiteCsvNumber(parts[offset + 1]);
  const hoseTemp = parts[offset + 2] === "NAN" ? null : finiteCsvNumber(parts[offset + 2]);
  return {
    humidifierTempC: humidifierTemp !== null && humidifierTemp >= -20 && humidifierTemp <= 80 ? humidifierTemp : null,
    humidifierRhPercent: humidifierRh !== null && humidifierRh >= 0 && humidifierRh <= 100 ? humidifierRh : null,
    hoseTempC: hoseTemp !== null && hoseTemp >= -20 && hoseTemp <= 80 ? hoseTemp : null,
  };
}

function classifyObservation(
  samples: ReturnType<typeof parseSessionSamples>,
  startIndex: number,
  endIndex: number,
  segmentKind: "apnea" | "hypopnea",
  baselineFlow: number,
): SessionObservation {
  const segment = samples.slice(startIndex, endIndex);
  const segmentStartMs = segment[0].ms;
  const before = samples.slice(0, startIndex).filter((sample) => sample.ms >= segmentStartMs - 20000);
  const durationSec = segmentDurationSec(segment, samples);
  const meanFlow = mean(segment.map((sample) => Math.abs(sample.flowHpa)));
  const meanError = mean(segment.map((sample) => sample.controllerErrorCm).filter(Number.isFinite));
  const meanController = mean(segment.map((sample) => sample.controllerAmp).filter(Number.isFinite));
  const beforeController = mean(before.map((sample) => sample.controllerAmp).filter(Number.isFinite));
  const hasControllerBaseline = Number.isFinite(meanController) && Number.isFinite(beforeController);
  const controllerRise = hasControllerBaseline ? meanController - beforeController : 0;
  const flowDropPercent = Math.max(0, Math.min(100, Math.round((1 - meanFlow / baselineFlow) * 100)));

  if (segmentKind === "hypopnea") {
    return {
      startMs: segment[0].ms,
      endMs: segment[segment.length - 1].ms,
      durationSec: Math.round(durationSec),
      type: "possible hypopnea-like low-flow pattern",
      confidence: "low",
      flowDropPercent,
      basis: `flow proxy reduced about ${flowDropPercent}% for ${Math.round(durationSec)}s`,
    };
  }

  if ((Number.isFinite(meanError) && meanError > 1.0) || (hasControllerBaseline && controllerRise > 8)) {
    return {
      startMs: segment[0].ms,
      endMs: segment[segment.length - 1].ms,
      durationSec: Math.round(durationSec),
      type: "possible obstructive low-flow pattern",
      confidence: "medium",
      flowDropPercent,
      basis: `near-zero flow with pressure error ${formatNumber(meanError)} cmH2O and controller change ${formatNumber(controllerRise)}`,
    };
  }

  if (hasControllerBaseline && (Number.isFinite(meanError) && Math.abs(meanError) <= 1.0) && Math.abs(controllerRise) <= 8) {
    return {
      startMs: segment[0].ms,
      endMs: segment[segment.length - 1].ms,
      durationSec: Math.round(durationSec),
      type: "possible central-like low-flow pattern",
      confidence: "low",
      flowDropPercent,
      basis: `near-zero flow without a strong pressure-error or controller-rise signal`,
    };
  }

  return {
    startMs: segment[0].ms,
    endMs: segment[segment.length - 1].ms,
    durationSec: Math.round(durationSec),
    type: "indeterminate low-flow pattern",
    confidence: "low",
    flowDropPercent,
    basis: `near-zero flow for ${Math.round(durationSec)}s`,
  };
}

function percentile(values: number[], percentileRank: number): number {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return NaN;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((percentileRank / 100) * (sorted.length - 1))));
  return sorted[index];
}

function mean(values: number[]): number {
  const finiteValues = values.filter(Number.isFinite);
  if (finiteValues.length === 0) return NaN;
  return finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length;
}

function segmentDurationSec<T extends { ms: number }>(segment: T[], allSamples: T[]): number {
  if (segment.length === 0) return 0;
  return sampleWindowDurationSec(segment, Infinity, allSamples);
}

function sampleWindowDurationSec<T extends { ms: number }>(
  samples: T[],
  maxPeriodMs = Infinity,
  cadenceSamples = samples,
  fallbackPeriodMs = 0,
): number {
  if (samples.length === 0) return 0;
  const firstMs = samples[0].ms;
  const lastMs = samples[samples.length - 1].ms;
  const inferredPeriodMs = estimateSamplePeriodMs(cadenceSamples);
  const samplePeriodMs = Math.min(maxPeriodMs, inferredPeriodMs || fallbackPeriodMs);
  return Math.max(0, (lastMs - firstMs + samplePeriodMs) / 1000);
}

function estimateSamplePeriodMs<T extends { ms: number }>(samples: T[]): number {
  const deltas = samples
    .slice(1)
    .map((sample, index) => sample.ms - samples[index].ms)
    .filter((delta) => Number.isFinite(delta) && delta > 0)
    .sort((a, b) => a - b);
  if (deltas.length === 0) return 0;
  return deltas[Math.floor(deltas.length / 2)];
}

function formatNumber(value: number): string {
  return Number.isFinite(value) ? value.toFixed(1) : "unknown";
}

function cleanCsvValue(value: string | undefined): string {
  const trimmed = String(value || "").trim();
  return trimmed ? trimmed : "--";
}

function toTherapyMode(value: unknown): TherapyMode {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 9) return value as TherapyMode;
  return DEFAULT_SETTINGS.mode;
}

function therapyModeUsesAutoRange(mode: TherapyMode): boolean {
  return mode === 1 || mode === 6 || mode === 7;
}
