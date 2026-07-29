import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "../mobile/node_modules/typescript/lib/typescript.js";

const root = resolve(import.meta.dirname, "..");
const sourcePath = resolve(root, "mobile/src/validation.ts");
const tempDir = mkdtempSync(join(tmpdir(), "ozealis-validation-"));

try {
  const source = readFileSync(sourcePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const modulePath = join(tempDir, "validation.mjs");
  writeFileSync(modulePath, output.outputText);

  const validation = await import(pathToFileURL(modulePath).href);
  const {
    DEFAULT_SETTINGS,
    DEFAULT_PREWARM_SCHEDULE,
    csvDataRowCount,
    csvPreview,
    filterSessionCsvByDay,
    flagSessionObservations,
    isClearedDeviceLogReadback,
    isCompatibleDeviceSession,
    isHeaderOnlyFaultCsv,
    isHeaderOnlyRetainedSessionCsv,
    isOtaStatusInProgress,
    isPrewarmScheduleDue,
    isSameDeviceSession,
    isSettingsReadbackObject,
    isSupportedOtaUrl,
    isValidLiveCsvRow,
    listSessionDayOptions,
    normalizeFaultCsv,
    normalizeFaultSnapshot,
    normalizeKnownCsv,
    normalizeRetainedSessionCsv,
    normalizeRetainedSessionSnapshot,
    parseCalibrationStatus,
    parseFaultCode,
    parseLiveCsvDiagnostics,
    parseMcfParamsSnapshot,
    parseModuleStatus,
    parseOtaStatus,
    parseOptionalTelemetryNumber,
    parsePrewarmSchedule,
    parseRetainedImportManifest,
    prewarmScheduleRunKey,
    parseSessionGraphData,
    parseSettings,
    parseSettingsReadback,
    parseSystemMode,
    parseUiPreference,
    markPrewarmScheduleRun,
    redactSensitiveJson,
    retainedReadbackImportedRowCount,
    sanitizeSettings,
    sanitizePrewarmSchedule,
    selectSessionAnalysisCsv,
    serializeSettings,
    serializeRetainedImportManifest,
    serializePrewarmSchedule,
    settingLimitMessages,
    summarizeSessionCsv,
  } = validation;

  const parsedDefaultSettings = parseSettings("not json");
  assert.deepEqual(parsedDefaultSettings, DEFAULT_SETTINGS);
  assert.notEqual(parsedDefaultSettings, DEFAULT_SETTINGS);
  parsedDefaultSettings.pMin = 99;
  assert.equal(DEFAULT_SETTINGS.pMin, 4);
  for (const rawSettings of ["null", "42", "\"settings\"", "[]", "true"]) {
    const parsedSettings = parseSettings(rawSettings);
    assert.deepEqual(parsedSettings, DEFAULT_SETTINGS);
    assert.notEqual(parsedSettings, DEFAULT_SETTINGS);
    assert.equal(isSettingsReadbackObject(rawSettings), false);
  }
  assert.equal(isSettingsReadbackObject("not json"), false);
  assert.equal(isSettingsReadbackObject("{}"), false);
  assert.equal(isSettingsReadbackObject("{\"pMin\":5}"), false);
  assert.equal(isSettingsReadbackObject("{\"unrelated\":true}"), false);
  assert.equal(isSettingsReadbackObject(serializeSettings(DEFAULT_SETTINGS)), true);
  assert.equal(parseSettingsReadback("{}"), null);
  assert.equal(parseSettingsReadback("{\"pMin\":5}"), null);
  assert.deepEqual(parseSettingsReadback(serializeSettings(DEFAULT_SETTINGS)), DEFAULT_SETTINGS);
  const incompleteSettingsReadback = JSON.parse(serializeSettings(DEFAULT_SETTINGS));
  delete incompleteSettingsReadback.mode;
  assert.equal(isSettingsReadbackObject(JSON.stringify(incompleteSettingsReadback)), false);
  const inconsistentSettingsReadback = JSON.parse(serializeSettings(DEFAULT_SETTINGS));
  inconsistentSettingsReadback.auto = false;
  assert.equal(isSettingsReadbackObject(JSON.stringify(inconsistentSettingsReadback)), false);
  const retainedManifest = {
    version: 1,
    deviceId: "device-a",
    importedAtMs: 1770000000000,
    session: { generation: 17, total: 1234, hash: "f8934173" },
    fault: { generation: 9, total: 456, hash: "0a1b2c3d" },
  };
  assert.deepEqual(parseRetainedImportManifest(serializeRetainedImportManifest(retainedManifest)), retainedManifest);
  assert.equal(parseRetainedImportManifest("{}"), null);
  assert.equal(parseRetainedImportManifest(JSON.stringify({ ...retainedManifest, deviceId: "" })), null);
  assert.equal(parseRetainedImportManifest(JSON.stringify({ ...retainedManifest, extra: true })), null);
  assert.equal(parseRetainedImportManifest(JSON.stringify({
    ...retainedManifest,
    session: { ...retainedManifest.session, generation: 0 },
  })), null);
  assert.equal(parseRetainedImportManifest(JSON.stringify({
    ...retainedManifest,
    fault: { ...retainedManifest.fault, hash: "F8934173" },
  })), null);
  assert.equal(isSameDeviceSession("device-a", 4, "device-a", 4), true);
  assert.equal(isSameDeviceSession("device-a", 4, "device-a", 3), false);
  assert.equal(isSameDeviceSession("device-a", 4, "device-b", 4), false);
  assert.equal(isSameDeviceSession(null, 4, "device-a", 4), false);
  assert.equal(isCompatibleDeviceSession("device-a", 4, "ozealis-ble-v2", "device-a", 4, "ozealis-ble-v2"), true);
  assert.equal(isCompatibleDeviceSession("device-a", 4, "wrong-version", "device-a", 4, "ozealis-ble-v2"), false);
  assert.equal(isCompatibleDeviceSession("device-a", 4, "ozealis-ble-v2", "device-a", 3, "ozealis-ble-v2"), false);
  assert.equal(parseUiPreference("{\"advancedMode\":true}"), true);
  assert.equal(parseUiPreference("{\"advancedMode\":false}"), false);
  assert.equal(parseUiPreference("{\"advancedMode\":\"true\"}"), false);
  assert.equal(parseUiPreference("{\"advancedMode\":1}"), false);
  for (const rawPreference of ["not json", "null", "42", "\"advanced\"", "[]", "true", "{}"]) {
    assert.equal(parseUiPreference(rawPreference), false);
  }
  assert.deepEqual(parsePrewarmSchedule("not json"), DEFAULT_PREWARM_SCHEDULE);
  for (const rawSchedule of ["null", "42", "\"schedule\"", "[]", "true"]) {
    assert.deepEqual(parsePrewarmSchedule(rawSchedule), DEFAULT_PREWARM_SCHEDULE);
  }
  assert.deepEqual(parsePrewarmSchedule("{\"enabled\":true,\"hour\":22,\"minute\":5,\"lastRunKey\":\"2026-06-25T22:05\"}"), {
    enabled: true,
    hour: 22,
    minute: 5,
    lastRunKey: "2026-06-25T22:05",
  });
  assert.deepEqual(parsePrewarmSchedule("{\"enabled\":\"true\",\"hour\":24,\"minute\":60,\"lastRunKey\":\"bad\"}"), {
    enabled: false,
    hour: 23,
    minute: 59,
    lastRunKey: "",
  });
  assert.deepEqual(sanitizePrewarmSchedule({ enabled: true, hour: 7.5, minute: 15 }), { ...DEFAULT_PREWARM_SCHEDULE, enabled: true, minute: 15 });
  assert.equal(serializePrewarmSchedule({ enabled: true, hour: 6, minute: 45, lastRunKey: "" }), "{\"enabled\":true,\"hour\":6,\"minute\":45,\"lastRunKey\":\"\"}\n");
  const scheduleNow = new Date(2026, 5, 25, 6, 45, 12);
  const dueSchedule = { enabled: true, hour: 6, minute: 45, lastRunKey: "" };
  assert.equal(prewarmScheduleRunKey(scheduleNow), "2026-06-25T06:45");
  assert.equal(isPrewarmScheduleDue(dueSchedule, scheduleNow), true);
  assert.equal(markPrewarmScheduleRun(dueSchedule, scheduleNow).lastRunKey, "2026-06-25T06:45");
  assert.equal(isPrewarmScheduleDue(markPrewarmScheduleRun(dueSchedule, scheduleNow), scheduleNow), false);
  assert.equal(isPrewarmScheduleDue({ enabled: false, hour: 6, minute: 45, lastRunKey: "" }, scheduleNow), false);
  assert.equal(isPrewarmScheduleDue({ enabled: true, hour: 6, minute: 44, lastRunKey: "" }, scheduleNow), false);
  assert.equal(isSupportedOtaUrl("https://example.test/firmware.bin"), true);
  assert.equal(isSupportedOtaUrl("http://192.168.4.2/firmware.bin"), true);
  assert.equal(isSupportedOtaUrl("https://example.test"), true);
  assert.equal(isSupportedOtaUrl("https://"), false);
  assert.equal(isSupportedOtaUrl("http://"), false);
  assert.equal(isSupportedOtaUrl("https:///firmware.bin"), false);
  assert.equal(isSupportedOtaUrl("http://?url=firmware.bin"), false);
  assert.equal(isSupportedOtaUrl("http://#firmware.bin"), false);
  assert.equal(isSupportedOtaUrl("HTTPS://example.test/firmware.bin"), false);
  assert.equal(isSupportedOtaUrl("Http://192.168.4.2/firmware.bin"), false);
  assert.equal(isSupportedOtaUrl("ftp://example.test/firmware.bin"), false);
  assert.equal(isSupportedOtaUrl("https://example.test/firmware with spaces.bin"), false);
  assert.equal(isSupportedOtaUrl(" https://example.test/firmware.bin"), false);
  assert.equal(isSupportedOtaUrl("https://example.test/firmware.bin "), false);
  assert.equal(isSupportedOtaUrl("https://example.test/firmware\t.bin"), false);
  assert.equal(isSupportedOtaUrl("https://example.test/firmware\n.bin"), false);
  assert.equal(isSupportedOtaUrl("https://example.test/firmware\x7f.bin"), false);
  assert.equal(parseOtaStatus("IDLE"), "IDLE");
  assert.equal(parseOtaStatus("START"), "START");
  assert.equal(parseOtaStatus("OK"), "OK");
  assert.equal(parseOtaStatus("ERR"), "ERR");
  assert.equal(parseOtaStatus("0%"), "0%");
  assert.equal(parseOtaStatus("7%"), "7%");
  assert.equal(parseOtaStatus("100%"), "100%");
  assert.equal(parseOtaStatus("00%"), "unknown");
  assert.equal(parseOtaStatus("007%"), "unknown");
  assert.equal(parseOtaStatus("101%"), "unknown");
  assert.equal(parseOtaStatus("-1%"), "unknown");
  assert.equal(parseOtaStatus("DONE"), "unknown");
  assert.equal(parseOtaStatus(" 7% "), "unknown");
  assert.equal(parseOtaStatus(" START "), "unknown");
  assert.equal(isOtaStatusInProgress("START"), true);
  assert.equal(isOtaStatusInProgress("7%"), true);
  assert.equal(isOtaStatusInProgress("100%"), true);
  assert.equal(isOtaStatusInProgress(" 100% "), false);
  assert.equal(isOtaStatusInProgress("IDLE"), false);
  assert.equal(isOtaStatusInProgress("OK"), false);
  assert.equal(isOtaStatusInProgress("ERR"), false);
  assert.equal(isOtaStatusInProgress("unknown"), false);
  assert.equal(isOtaStatusInProgress("101%"), false);
  assert.equal(parseSystemMode("0"), "0");
  assert.equal(parseSystemMode("4"), "4");
  assert.equal(parseSystemMode("5"), "--");
  assert.equal(parseSystemMode(" 2 "), "--");
  assert.equal(parseSystemMode("fault"), "--");
  assert.equal(parseFaultCode("0"), "0");
  assert.equal(parseFaultCode("4"), "4");
  assert.equal(parseFaultCode("9"), "--");
  assert.equal(parseFaultCode(" 1 "), "--");
  assert.equal(parseModuleStatus("0"), "none");
  assert.equal(parseModuleStatus("1"), "humidifier");
  assert.equal(parseModuleStatus("2"), "hose");
  assert.equal(parseModuleStatus("3"), "humidifier + hose");
  assert.equal(parseModuleStatus("4"), "oximeter");
  assert.equal(parseModuleStatus("7"), "humidifier + hose + oximeter");
  assert.equal(parseModuleStatus("8"), "prewarm");
  assert.equal(parseModuleStatus("9"), "humidifier + prewarm");
  assert.equal(parseModuleStatus("15"), "humidifier + hose + oximeter + prewarm");
  assert.equal(parseModuleStatus("16"), "unknown");
  assert.equal(parseModuleStatus(" 3 "), "unknown");
  assert.equal(parseOptionalTelemetryNumber("NAN"), "--");
  assert.equal(parseOptionalTelemetryNumber("nan"), "--");
  assert.equal(parseOptionalTelemetryNumber("24.5"), "24.5");
  assert.equal(parseOptionalTelemetryNumber("-1.25"), "-1.25");
  assert.equal(parseOptionalTelemetryNumber("1e3"), "--");
  assert.equal(parseOptionalTelemetryNumber("+24.5"), "--");
  assert.equal(parseOptionalTelemetryNumber("024.5"), "--");
  assert.equal(parseOptionalTelemetryNumber(" 24.5 "), "--");
  assert.equal(parseOptionalTelemetryNumber(" NAN "), "--");
  assert.equal(parseOptionalTelemetryNumber("bad"), "--");
  assert.deepEqual(JSON.parse(redactSensitiveJson("not json")), {
    exportError: "invalid_json_snapshot_not_exported",
  });
  for (const rawSnapshot of ["null", "42", "\"snapshot\"", "[]", "true"]) {
    assert.deepEqual(JSON.parse(redactSensitiveJson(rawSnapshot)), {
      exportError: "invalid_json_snapshot_not_exported",
    });
  }
  assert.deepEqual(JSON.parse(redactSensitiveJson(JSON.stringify({
    driver: "MCF8316D",
    eepromPasscode: "1234",
    apiKey: "ak_test",
    private_key: "pem",
    authorization: "Bearer abc",
    nested: { wifiPassword: "secret", ok: true },
    registers: [{ name: "MOTOR_RES", value: "0x1", token: "abc", bearerToken: "def" }],
  }))), {
    driver: "MCF8316D",
    eepromPasscode: "[redacted]",
    apiKey: "[redacted]",
    private_key: "[redacted]",
    authorization: "[redacted]",
    nested: { wifiPassword: "[redacted]", ok: true },
    registers: [{ name: "MOTOR_RES", value: "0x1", token: "[redacted]", bearerToken: "[redacted]" }],
  });

  const unsafe = {
    pMin: 2,
    pMax: 40,
    auto: true,
    ramp: 9999,
    mode: 99,
    delta: -3,
    epr: 9,
    backupRateBpm: 99,
    inspTimeMs: 50,
    triggerSens: 0,
    cycleSens: 99,
    humidifierKind: 9,
    humidifierTargetRH: 120,
    humidifierMaxTempC: 99,
    humidifierPrewarmMinutes: 99,
    hoseTempDeltaC: -2,
    bleName: "  Ozealis experimental long name  ",
    bleAdv: true,
  };
  const safe = sanitizeSettings(unsafe);
  assert.deepEqual(safe, {
    pMin: 4,
    pMax: 25,
    auto: true,
    ramp: 1800,
    mode: 1,
    delta: 0,
    epr: 3,
    backupRateBpm: 30,
    inspTimeMs: 300,
    triggerSens: 1,
    cycleSens: 9,
    humidifierKind: 2,
    humidifierTargetRH: 90,
    humidifierMaxTempC: 60,
    humidifierPrewarmMinutes: 60,
    hoseTempDeltaC: 0,
    bleName: "Ozealis experimenta",
    bleAdv: true,
  });
  assert.equal(settingLimitMessages(unsafe).length, 16);
  assert.ok(settingLimitMessages(unsafe).includes("Therapy mode adjusted to AutoPAP."));
  assert.deepEqual(parseSettings(serializeSettings(unsafe)), safe);
  assert.equal(JSON.parse(serializeSettings(unsafe)).backupRate, 30);
  assert.equal(JSON.parse(serializeSettings(unsafe)).triggerSens, 1);
  assert.equal(JSON.parse(serializeSettings(unsafe)).cycleSens, 9);
  assert.equal(JSON.parse(serializeSettings(unsafe)).humidifierKind, 2);
  assert.equal(JSON.parse(serializeSettings(unsafe)).humidifierTargetRH, 90);
  assert.equal(JSON.parse(serializeSettings(unsafe)).humidifierMaxTempC, 60);
  assert.equal(JSON.parse(serializeSettings(unsafe)).humidifierPrewarmMinutes, 60);
  assert.equal(JSON.parse(serializeSettings(unsafe)).hoseTempDeltaC, 0);
  assert.equal(parseSettings(JSON.stringify({ backupRate: 8, inspTimeMs: 1200 })).backupRateBpm, 8);
  assert.deepEqual(
    parseSettings(JSON.stringify({ humidifierKind: 1, humidifierTargetRH: 55, humidifierMaxTempC: 42, humidifierPrewarmMinutes: 12, hoseTempDeltaC: 6 })),
    { ...DEFAULT_SETTINGS, humidifierKind: 1, humidifierTargetRH: 55, humidifierMaxTempC: 42, humidifierPrewarmMinutes: 12, hoseTempDeltaC: 6 },
  );
  assert.deepEqual(
    sanitizeSettings({ epr: 2.9, inspTimeMs: 777.8, triggerSens: 4.9, cycleSens: 6.2, humidifierKind: 1.5, humidifierPrewarmMinutes: 10.5 }),
    DEFAULT_SETTINGS,
  );
  assert.equal(sanitizeSettings({ backupRateBpm: 9.5 }).backupRateBpm, 9.5);
  assert.deepEqual(
    sanitizeSettings({ mode: 0, auto: true, pMin: 4, pMax: 12 }),
    { ...DEFAULT_SETTINGS, pMin: 4, pMax: 12, mode: 1, auto: true },
  );
  assert.equal(sanitizeSettings({ mode: 1, auto: false }).auto, true);
  assert.equal(sanitizeSettings({ mode: 6, auto: false }).auto, true);
  assert.equal(sanitizeSettings({ mode: 7, auto: false }).auto, true);
  assert.equal(sanitizeSettings({ mode: 2, auto: true }).auto, false);
  assert.equal(sanitizeSettings({ mode: 8, auto: true }).auto, false);
  assert.equal(sanitizeSettings({ mode: 9, auto: true }).auto, false);
  assert.equal(sanitizeSettings({ mode: 6 }).mode, 6);
  assert.equal(sanitizeSettings({ mode: 7 }).mode, 7);
  assert.equal(sanitizeSettings({ mode: 9 }).mode, 9);
  assert.equal(sanitizeSettings({ mode: 10 }).mode, DEFAULT_SETTINGS.mode);
  assert.deepEqual(sanitizeSettings({ auto: false }), { ...DEFAULT_SETTINGS, mode: 0, auto: false });
  assert.deepEqual(sanitizeSettings({ auto: true }), DEFAULT_SETTINGS);
  assert.deepEqual(sanitizeSettings({ pMin: 20, pMax: "bad" }), { ...DEFAULT_SETTINGS, pMin: 20, pMax: 20 });
  assert.deepEqual(
    sanitizeSettings({ mode: 0, auto: "true", bleAdv: "false" }),
    { ...DEFAULT_SETTINGS, auto: false, mode: 0, bleAdv: true },
  );
  assert.deepEqual(
    sanitizeSettings({ bleName: 123 }),
    DEFAULT_SETTINGS,
  );
  assert.deepEqual(
    sanitizeSettings({ bleName: "   " }),
    DEFAULT_SETTINGS,
  );
  assert.equal(sanitizeSettings({ bleName: '  Oz"ea\\lis\nLab  ' }).bleName, "OzealisLab");
  assert.equal(sanitizeSettings({ bleName: "\"\\\n" }).bleName, DEFAULT_SETTINGS.bleName);
  assert.deepEqual(
    sanitizeSettings({
      pMin: "5",
      pMax: "12",
      ramp: "60",
      mode: "7",
      delta: "4",
      epr: "2",
      backupRate: "10",
      inspTimeMs: "900",
      triggerSens: "4",
      cycleSens: "6",
      humidifierKind: "1",
      humidifierTargetRH: "55",
      humidifierMaxTempC: "42",
      humidifierPrewarmMinutes: "12",
      hoseTempDeltaC: "6",
    }),
    DEFAULT_SETTINGS,
  );

  assert.deepEqual(parseCalibrationStatus("not json"), {
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
  });
  const defaultCalibration = parseCalibrationStatus("null");
  assert.deepEqual(defaultCalibration, parseCalibrationStatus("[]"));
  assert.deepEqual(defaultCalibration, parseCalibrationStatus("\"calibration\""));
  assert.deepEqual(defaultCalibration, parseCalibrationStatus("42"));
  assert.notEqual(defaultCalibration, parseCalibrationStatus("null"));
  assert.deepEqual(
    parseCalibrationStatus(
      JSON.stringify({
        state: "sweeping",
        active: true,
        valid: false,
        amp: 70,
        minAmp: 30,
        maxAmp: 180,
        gain: 0.0625,
        maxCm: null,
        bestCm: 3.1,
        bestAmp: 70,
        mode: "water",
        targetCm: 6,
        capturedPoints: 3,
        curveValid: true,
        fgHz: 234.5,
        sensorTrimValid: true,
        sensorTrimHpa: -0.125,
        sensorTrimSamples: 3,
        sensorTrimStatus: "saved",
      }),
    ),
    {
      state: "sweeping",
      active: true,
      valid: false,
      amp: 70,
      minAmp: 30,
      maxAmp: 180,
      gain: 0.0625,
      maxCm: 0,
      bestCm: 3.1,
      bestAmp: 70,
      mode: "water",
      targetCm: 6,
      capturedPoints: 3,
      curveValid: false,
      fgHz: 234.5,
      sensorTrimValid: false,
      sensorTrimHpa: -0.125,
      sensorTrimSamples: 3,
      sensorTrimStatus: "saved",
    },
  );
  assert.deepEqual(
    parseCalibrationStatus(
      JSON.stringify({
        state: 123,
        active: "true",
        valid: "true",
        amp: "70",
        mode: { value: "water" },
        sensorTrimHpa: "-0.125",
        curveValid: "true",
        sensorTrimValid: "true",
        sensorTrimStatus: ["saved"],
      }),
    ),
    {
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
    },
  );
  assert.deepEqual(
    parseCalibrationStatus(
      JSON.stringify({
        state: "water-column",
        active: true,
        valid: true,
        amp: 999,
        minAmp: -20,
        maxAmp: 333,
        gain: 0.0625,
        maxCm: 20,
        bestCm: 11.5,
        bestAmp: 127.5,
        mode: "water",
        targetCm: 6.5,
        capturedPoints: 99,
        curveValid: true,
        fgHz: 100001,
        sensorTrimValid: true,
        sensorTrimHpa: 0.25,
        sensorTrimSamples: 42,
        sensorTrimStatus: "saved",
      }),
    ),
    {
      state: "water-column",
      active: true,
      valid: true,
      amp: 255,
      minAmp: 0,
      maxAmp: 255,
      gain: 0.0625,
      maxCm: 20,
      bestCm: 11.5,
      bestAmp: 0,
      mode: "water",
      targetCm: 0,
      capturedPoints: 17,
      curveValid: false,
      fgHz: null,
      sensorTrimValid: false,
      sensorTrimHpa: 0.25,
      sensorTrimSamples: 17,
      sensorTrimStatus: "saved",
    },
  );
  assert.deepEqual(
    parseCalibrationStatus(
      JSON.stringify({
        state: "running<script>",
        active: true,
        valid: true,
        amp: 80,
        minAmp: 10,
        maxAmp: 220,
        gain: 0.1,
        maxCm: 20,
        bestCm: 7,
        bestAmp: 80,
        mode: "service",
        targetCm: 7,
        capturedPoints: 4,
        curveValid: true,
        fgHz: -0.1,
        sensorTrimValid: false,
        sensorTrimHpa: 0.5,
        sensorTrimSamples: 4,
        sensorTrimStatus: "factory-calibrated",
      }),
    ),
    {
      state: "unknown",
      active: true,
      valid: true,
      amp: 80,
      minAmp: 10,
      maxAmp: 220,
      gain: 0.1,
      maxCm: 20,
      bestCm: 7,
      bestAmp: 80,
      mode: "auto",
      targetCm: 7,
      capturedPoints: 4,
      curveValid: false,
      fgHz: null,
      sensorTrimValid: false,
      sensorTrimHpa: 0.5,
      sensorTrimSamples: 4,
      sensorTrimStatus: "unknown",
    },
  );
  assert.equal(parseCalibrationStatus(JSON.stringify({ targetCm: 4 })).targetCm, 4);
  assert.equal(parseCalibrationStatus(JSON.stringify({ targetCm: 20 })).targetCm, 20);
  assert.equal(parseCalibrationStatus(JSON.stringify({ targetCm: 3 })).targetCm, 0);
  assert.equal(parseCalibrationStatus(JSON.stringify({ targetCm: 21 })).targetCm, 0);
  assert.equal(parseCalibrationStatus(JSON.stringify({ gain: -0.1 })).gain, 0);
  assert.equal(parseCalibrationStatus(JSON.stringify({ gain: 26 })).gain, 0);
  assert.equal(parseCalibrationStatus(JSON.stringify({ maxCm: 25 })).maxCm, 25);
  assert.equal(parseCalibrationStatus(JSON.stringify({ maxCm: 25.1 })).maxCm, 0);
  assert.equal(parseCalibrationStatus(JSON.stringify({ bestCm: -1 })).bestCm, 0);
  const exactWaterCompletion = { state: "water-done", active: false, mode: "water", capturedPoints: 17, curveValid: true };
  assert.equal(parseCalibrationStatus(JSON.stringify(exactWaterCompletion)).curveValid, true);
  assert.equal(parseCalibrationStatus(JSON.stringify({ active: false, capturedPoints: 17, curveValid: true })).curveValid, false);
  assert.equal(parseCalibrationStatus(JSON.stringify({ ...exactWaterCompletion, active: true })).curveValid, false);
  assert.equal(parseCalibrationStatus(JSON.stringify({ ...exactWaterCompletion, capturedPoints: 16 })).curveValid, false);
  assert.equal(parseCalibrationStatus(JSON.stringify({ ...exactWaterCompletion, capturedPoints: 99 })).curveValid, false);
  assert.equal(parseCalibrationStatus(JSON.stringify({ ...exactWaterCompletion, state: "done" })).curveValid, false);
  assert.equal(parseCalibrationStatus(JSON.stringify({ ...exactWaterCompletion, mode: "auto" })).curveValid, false);
  assert.equal(parseCalibrationStatus(JSON.stringify({ sensorTrimHpa: -25 })).sensorTrimHpa, -25);
  assert.equal(parseCalibrationStatus(JSON.stringify({ sensorTrimHpa: 25.1 })).sensorTrimHpa, 0);
  assert.equal(parseCalibrationStatus(JSON.stringify({ sensorTrimValid: true, sensorTrimSamples: 16, sensorTrimStatus: "saved" })).sensorTrimValid, false);
  assert.equal(parseCalibrationStatus(JSON.stringify({ sensorTrimValid: true, sensorTrimSamples: 42, sensorTrimStatus: "saved", sensorTrimHpa: 0 })).sensorTrimValid, false);
  assert.equal(parseCalibrationStatus(JSON.stringify({ sensorTrimValid: true, sensorTrimSamples: 17, sensorTrimStatus: "pending" })).sensorTrimValid, false);
  assert.equal(parseCalibrationStatus(JSON.stringify({ sensorTrimValid: true, sensorTrimSamples: 17, sensorTrimStatus: "saved", sensorTrimHpa: 0 })).sensorTrimValid, true);
  assert.equal(parseCalibrationStatus(JSON.stringify({ sensorTrimValid: true, sensorTrimSamples: 17, sensorTrimStatus: "saved", sensorTrimHpa: 26 })).sensorTrimValid, false);
  assert.equal(parseCalibrationStatus(JSON.stringify({ fgHz: 0 })).fgHz, 0);
  assert.equal(parseCalibrationStatus(JSON.stringify({ fgHz: 100000 })).fgHz, 100000);
  assert.equal(parseCalibrationStatus(JSON.stringify({ fgHz: "123.4" })).fgHz, null);
  assert.equal(parseCalibrationStatus(JSON.stringify({ fgHz: 100000.1 })).fgHz, null);

  assert.deepEqual(parseLiveCsvDiagnostics("too,short"), {
    measuredCm: "--",
    errorCm: "--",
    amp: "--",
    motorCmd: "--",
    motorFault: "--",
    motorI2c: "--",
    motorFgHz: "--",
  });
  const validLiveRow = "1,2,3,4,5,2,7.25,-0.50,88,88,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN";
  assert.deepEqual(parseLiveCsvDiagnostics(validLiveRow), {
    measuredCm: "7.25",
    errorCm: "-0.50",
    amp: "88",
    motorCmd: "88",
    motorFault: "0",
    motorI2c: "1",
    motorFgHz: "123.45",
  });
  assert.equal(isValidLiveCsvRow(validLiveRow), true);
  assert.equal(isValidLiveCsvRow("1,2,3,4,5,2,7.25,-0.50,88,88,0,1,123.45"), false);
  assert.equal(isValidLiveCsvRow("1,2,3,4,5,2,7.25,-0.50,88,88,0,1,123.45,97.5,62.0,2"), false);
  assert.equal(isValidLiveCsvRow("1,2,3,4,5,2,7.25,-0.50,88,88,0,1,123.45,NAN,NAN,0"), false);
  assert.equal(isValidLiveCsvRow("1,2,3,4,5,2,7.25,-0.50,88,88,0,1,123.45,NAN,NAN,2,NAN,NAN,NAN"), false);
  assert.equal(isValidLiveCsvRow("1,2,3,4,5,2,7.25,-0.50,88,88,0,1,123.45,97.5,NAN,2,NAN,NAN,NAN"), false);
  assert.equal(isValidLiveCsvRow("1,2,3,4,5,2,7.25,-0.50,88,88,0,1,123.45,97.5,62.0,0,NAN,NAN,NAN"), false);
  assert.equal(isValidLiveCsvRow("1,2,3,4,5,2,7.25,-0.50,88,88,0,bad,123.45"), false);
  assert.equal(isValidLiveCsvRow("-0,2,3,4,5,2,7.25,-0.50,88,88,0,1,123.45"), false);
  assert.equal(isValidLiveCsvRow("1,2,3,4,5,2,7.25,-0.50,88,88,-0,1,123.45"), false);
  assert.equal(isValidLiveCsvRow("1,2,3,4,5,2.0,7.25,-0.50,88,88,0,1,123.45"), false);
  assert.equal(isValidLiveCsvRow("1,2,3,4,5,02,7.25,-0.50,88,88,0,1,123.45"), false);
  assert.equal(isValidLiveCsvRow("1,2,3,4,5,2,7.25,-0.50,088,88,0,1,123.45"), false);
  assert.equal(isValidLiveCsvRow("1,2,3,4,5,2,7.25,-0.50,88,88,01,1,123.45"), false);
  assert.equal(isValidLiveCsvRow("1,2,3,4,5,2,7.25,-0.50,8.8e1,88,0,1,123.45"), false);
  assert.equal(isValidLiveCsvRow("1,2,3,4,5,2,7.25,,88,88,0,1,123.45"), false);
  assert.equal(isValidLiveCsvRow("1,2,3,4,5,2,7.25,-0.50,88,88,0,1,0123.45"), false);
  assert.equal(isValidLiveCsvRow(" 1,2,3,4,5,2,7.25,-0.50,88,88,0,1,123.45"), false);
  assert.equal(isValidLiveCsvRow("1,2,3,4,5,2,7.25,-0.50,88,88,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN,extra"), false);
  assert.deepEqual(parseLiveCsvDiagnostics("1,2,3,4,5,2,7.25,-0.50,88,88,0,bad,123.45"), {
    measuredCm: "--",
    errorCm: "--",
    amp: "--",
    motorCmd: "--",
    motorFault: "--",
    motorI2c: "--",
    motorFgHz: "--",
  });
  assert.deepEqual(parseLiveCsvDiagnostics("1,2,3,4,5,6,7.25,-0.50,88"), {
    measuredCm: "--",
    errorCm: "--",
    amp: "--",
    motorCmd: "--",
    motorFault: "--",
    motorI2c: "--",
    motorFgHz: "--",
  });
  assert.deepEqual(parseLiveCsvDiagnostics("1,2,3,4,5,6, , , "), {
    measuredCm: "--",
    errorCm: "--",
    amp: "--",
    motorCmd: "--",
    motorFault: "--",
    motorI2c: "--",
    motorFgHz: "--",
  });

  const expectedDefaultMcfParams = {
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
  assert.deepEqual(parseMcfParamsSnapshot("not json"), expectedDefaultMcfParams);
  const defaultMcfParams = parseMcfParamsSnapshot("null");
  assert.deepEqual(defaultMcfParams, parseMcfParamsSnapshot("[]"));
  assert.deepEqual(defaultMcfParams, parseMcfParamsSnapshot("\"driver\""));
  assert.deepEqual(defaultMcfParams, parseMcfParamsSnapshot("42"));
  assert.notEqual(defaultMcfParams, parseMcfParamsSnapshot("null"));
  assert.deepEqual(
    parseMcfParamsSnapshot(
      JSON.stringify({
        driver: "MCF8316D",
        state: "register_layer_pending",
        i2c: true,
        fault: false,
        i2cAddr: "0x01",
        runtimeSpeed: "disabled_until_i2c_speed",
        targetSpeed: "i2c",
        commandReady: false,
        writesAllowed: false,
        benchOnly: false,
        fgHz: null,
      }),
    ),
    {
      ...expectedDefaultMcfParams,
      driver: "MCF8316D",
      state: "register_layer_pending",
      i2c: true,
      fault: false,
      i2cAddr: "0x01",
      runtimeSpeed: "disabled_until_i2c_speed",
      targetSpeed: "i2c",
      commandReady: false,
      writesAllowed: false,
      benchOnly: false,
      fgHz: null,
    },
  );
  assert.deepEqual(
    parseMcfParamsSnapshot(
      JSON.stringify({
        driver: "MCF8316D",
        state: "register_layer_pending",
        i2c: true,
        fault: false,
        i2cAddr: "0x01",
        runtimeSpeed: "bench_pwm_fallback",
        targetSpeed: "i2c",
        commandReady: true,
        writesAllowed: false,
        fgHz: 321.5,
        commandAmp: 42,
        commandPwm: 42,
        pins: { speedPwm: 19, drvOff: 17, nFault: 26, fg: 33 },
      }),
    ),
    {
      ...expectedDefaultMcfParams,
      driver: "MCF8316D",
      state: "register_layer_pending",
      i2c: true,
      fault: false,
      i2cAddr: "0x01",
      runtimeSpeed: "bench_pwm_fallback",
      targetSpeed: "i2c",
      commandReady: true,
      writesAllowed: false,
      benchOnly: true,
      fgHz: 321.5,
      commandAmp: 42,
      commandPwm: 42,
      pins: { speedPwm: 19, drvOff: 17, nFault: 26, fg: 33 },
    },
  );
  assert.deepEqual(
    parseMcfParamsSnapshot(
      JSON.stringify({
        driver: "MCF8316D",
        state: "readback_valid",
        i2c: true,
        fault: false,
        i2cAddr: "0X01",
        runtimeSpeed: "i2c",
        targetSpeed: "i2c",
        commandReady: true,
        writesAllowed: false,
        benchOnly: true,
        fgHz: 100000.1,
        commandAmp: 256,
        commandPwm: 65536,
        pins: { speedPwm: 40, drvOff: -2, nFault: "26", fg: null },
        registers: [{ name: "MOTOR_RES", addr: "0x000080", value: "0x00000001", verified: true }],
      }),
    ),
    {
      ...expectedDefaultMcfParams,
      driver: "MCF8316D",
      state: "readback_valid",
      i2c: true,
      fault: false,
      i2cAddr: "0x01",
      runtimeSpeed: "i2c",
      targetSpeed: "i2c",
      commandReady: true,
      writesAllowed: false,
      benchOnly: false,
      fgHz: null,
    },
  );
  assert.deepEqual(
    parseMcfParamsSnapshot(
      JSON.stringify({
        driver: "MCF8316A1",
        state: "ready",
        i2c: true,
        fault: false,
        i2cAddr: "0x80",
        runtimeSpeed: "i2c-speed",
        targetSpeed: "pwm",
        commandReady: true,
        writesAllowed: true,
        benchOnly: false,
        fgHz: null,
      }),
    ),
    {
      ...expectedDefaultMcfParams,
      driver: "unknown",
      state: "unknown",
      i2c: true,
      fault: false,
      i2cAddr: "unknown",
      runtimeSpeed: "unknown",
      targetSpeed: "unknown",
      commandReady: false,
      writesAllowed: false,
      benchOnly: false,
      fgHz: null,
    },
  );
  assert.deepEqual(
    parseMcfParamsSnapshot(
      JSON.stringify({
        driver: "MCF8316D",
        state: "register_layer_pending",
        i2c: true,
        fault: false,
        i2cAddr: "0x01",
        runtimeSpeed: "i2c",
        targetSpeed: "i2c",
        commandReady: true,
        writesAllowed: true,
        benchOnly: false,
        fgHz: null,
      }),
    ),
    {
      ...expectedDefaultMcfParams,
      driver: "MCF8316D",
      state: "register_layer_pending",
      i2c: true,
      fault: false,
      i2cAddr: "0x01",
      runtimeSpeed: "i2c",
      targetSpeed: "i2c",
      commandReady: false,
      writesAllowed: false,
      benchOnly: false,
      fgHz: null,
    },
  );
  assert.deepEqual(
    parseMcfParamsSnapshot(
      JSON.stringify({
        driver: "MCF8316D",
        state: "readback_valid",
        i2c: true,
        fault: false,
        i2cAddr: "0x01",
        runtimeSpeed: "i2c",
        targetSpeed: "i2c",
        commandReady: true,
        writesAllowed: true,
        benchOnly: false,
        fgHz: null,
        commandAmp: 255,
        commandPwm: 65535,
        pins: { speedPwm: -1, drvOff: 0, nFault: 39, fg: 33 },
      }),
    ),
    {
      ...expectedDefaultMcfParams,
      driver: "MCF8316D",
      state: "readback_valid",
      i2c: true,
      fault: false,
      i2cAddr: "0x01",
      runtimeSpeed: "i2c",
      targetSpeed: "i2c",
      commandReady: true,
      writesAllowed: true,
      benchOnly: false,
      fgHz: null,
      commandAmp: 255,
      commandPwm: 65535,
      pins: { speedPwm: -1, drvOff: 0, nFault: 39, fg: 33 },
    },
  );
  assert.deepEqual(
    parseMcfParamsSnapshot(
      JSON.stringify({
        driver: "MCF8316D",
        state: "readback_valid",
        i2c: true,
        fault: false,
        i2cAddr: "0x01",
        runtimeSpeed: "i2c",
        targetSpeed: "i2c",
        writesAllowed: true,
        benchOnly: false,
        fgHz: null,
      }),
    ),
    {
      ...expectedDefaultMcfParams,
      driver: "MCF8316D",
      state: "readback_valid",
      i2c: true,
      fault: false,
      i2cAddr: "0x01",
      runtimeSpeed: "i2c",
      targetSpeed: "i2c",
      commandReady: false,
      writesAllowed: true,
      benchOnly: false,
      fgHz: null,
    },
  );
  assert.deepEqual(
    parseMcfParamsSnapshot(
      JSON.stringify({
        driver: "MCF8316D",
        state: "readback_valid",
        i2c: true,
        fault: false,
        i2cAddr: "0x01",
        runtimeSpeed: "i2c",
        targetSpeed: "i2c",
        commandReady: "true",
        writesAllowed: true,
        benchOnly: false,
        fgHz: null,
      }),
    ),
    {
      ...expectedDefaultMcfParams,
      driver: "MCF8316D",
      state: "readback_valid",
      i2c: true,
      fault: false,
      i2cAddr: "0x01",
      runtimeSpeed: "i2c",
      targetSpeed: "i2c",
      commandReady: false,
      writesAllowed: true,
      benchOnly: false,
      fgHz: null,
    },
  );
  assert.deepEqual(
    parseMcfParamsSnapshot(
      JSON.stringify({
        driver: 8316,
        state: { value: "register_layer_pending" },
        i2cAddr: ["0x01"],
        runtimeSpeed: { value: "i2c" },
        targetSpeed: 12,
        commandReady: true,
        writesAllowed: "true",
        benchOnly: "false",
        fgHz: "321.5",
        commandAmp: "42",
        commandPwm: -1,
        pins: "GPIO19",
      }),
    ),
    expectedDefaultMcfParams,
  );

  const csv = "h1,h2\n1,2\n3,4\n";
  assert.equal(csvDataRowCount(csv), 0);
  assert.equal(csvDataRowCount(""), 0);
  assert.equal(csvPreview(csv, 4), "");
  const retainedCountCsv = [
    "ms,setpoint_cm,pressure_cmH2O,error_cmH2O,flowProxy_hPa,motorAmp,controller_error_cm,controller_amp,motorCmd,motorFault,motorI2c,motorFgHz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
    "1000,4.0,4.2,0.2,-0.4,40,0.2,40,40,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
    "1000,5.0,5.1,0.1,0.3,45,0.1,45,45,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
    "2000,5.0,5.1,0.1,0.3,45,0.1,45,45,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
    "bad,row",
  ].join("\n");
  assert.equal(csvDataRowCount(retainedCountCsv), 2);
  const retainedImpossibleStatusCsv = [
    "ms,setpoint_cm,pressure_cmH2O,error_cmH2O,flowProxy_hPa,motorAmp,controller_error_cm,controller_amp,motorCmd,motorFault,motorI2c,motorFgHz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
    "1000,4.0,4.2,0.2,-0.4,40,0.2,40,40,2,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
  ].join("\n");
  assert.equal(csvDataRowCount(retainedImpossibleStatusCsv), 0);
  assert.equal(parseSessionGraphData(retainedImpossibleStatusCsv).length, 0);
  const retainedFractionalCommandCsv = [
    "ms,setpoint_cm,pressure_cmH2O,error_cmH2O,flowProxy_hPa,motorAmp,controller_error_cm,controller_amp,motorCmd,motorFault,motorI2c,motorFgHz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
    "1000,4.0,4.2,0.2,-0.4,40.5,0.2,40,40,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
  ].join("\n");
  assert.equal(csvDataRowCount(retainedFractionalCommandCsv), 0);
  assert.equal(parseSessionGraphData(retainedFractionalCommandCsv).length, 0);
  const retainedPaddedFieldCsv = [
    "ms,setpoint_cm,pressure_cmH2O,error_cmH2O,flowProxy_hPa,motorAmp,controller_error_cm,controller_amp,motorCmd,motorFault,motorI2c,motorFgHz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
    "1000,4.0, 4.2,0.2,-0.4,40,0.2,40,40,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
  ].join("\n");
  assert.equal(csvDataRowCount(retainedPaddedFieldCsv), 0);
  assert.equal(parseSessionGraphData(retainedPaddedFieldCsv).length, 0);
  const retainedPaddedIntegerCsv = [
    "ms,setpoint_cm,pressure_cmH2O,error_cmH2O,flowProxy_hPa,motorAmp,controller_error_cm,controller_amp,motorCmd,motorFault,motorI2c,motorFgHz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
    "01000,4.0,4.2,0.2,-0.4,40,0.2,40,40,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
    "2000,4.0,4.2,0.2,-0.4,40,0.2,40,40,01,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
  ].join("\n");
  assert.equal(csvDataRowCount(retainedPaddedIntegerCsv), 0);
  assert.equal(parseSessionGraphData(retainedPaddedIntegerCsv).length, 0);
  const retainedNegativeZeroIntegerCsv = [
    "ms,setpoint_cm,pressure_cmH2O,error_cmH2O,flowProxy_hPa,motorAmp,controller_error_cm,controller_amp,motorCmd,motorFault,motorI2c,motorFgHz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
    "-0,4.0,4.2,0.2,-0.4,40,0.2,40,40,0,1,123.45",
    "2000,4.0,4.2,0.2,-0.4,-0,0.2,40,40,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
  ].join("\n");
  assert.equal(csvDataRowCount(retainedNegativeZeroIntegerCsv), 0);
  assert.equal(parseSessionGraphData(retainedNegativeZeroIntegerCsv).length, 0);
  const retainedPaddedRowCsv = [
    "ms,setpoint_cm,pressure_cmH2O,error_cmH2O,flowProxy_hPa,motorAmp,controller_error_cm,controller_amp,motorCmd,motorFault,motorI2c,motorFgHz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
    " 1000,4.0,4.2,0.2,-0.4,40,0.2,40,40,0,1",
  ].join("\n");
  assert.equal(csvDataRowCount(retainedPaddedRowCsv), 0);
  assert.equal(parseSessionGraphData(retainedPaddedRowCsv).length, 0);
  const retainedPaddedHeaderCsv = [
    " ms,setpoint_cm,pressure_cmH2O,error_cmH2O,flowProxy_hPa,motorAmp,controller_error_cm,controller_amp,motorCmd,motorFault,motorI2c,motorFgHz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
    "1000,4.0,4.2,0.2,-0.4,40,0.2,40,40,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
  ].join("\n");
  assert.equal(csvDataRowCount(retainedPaddedHeaderCsv), 0);
  assert.equal(parseSessionGraphData(retainedPaddedHeaderCsv).length, 0);
  const retainedLeadingBlankHeaderCsv = [
    "",
    "ms,setpoint_cm,pressure_cmH2O,error_cmH2O,flowProxy_hPa,motorAmp,controller_error_cm,controller_amp,motorCmd,motorFault,motorI2c,motorFgHz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
    "1000,4.0,4.2,0.2,-0.4,40,0.2,40,40,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
  ].join("\n");
  assert.equal(csvDataRowCount(retainedLeadingBlankHeaderCsv), 0);
  assert.equal(parseSessionGraphData(retainedLeadingBlankHeaderCsv).length, 0);
  const retainedBlankBodyCsv = [
    "ms,setpoint_cm,pressure_cmH2O,error_cmH2O,flowProxy_hPa,motorAmp,controller_error_cm,controller_amp,motorCmd,motorFault,motorI2c,motorFgHz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
    "1000,4.0,4.2,0.2,-0.4,40,0.2,40,40,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
    "",
    "2000,5.0,5.1,0.1,0.3,45,0.1,45,45,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
  ].join("\n");
  assert.equal(csvDataRowCount(retainedBlankBodyCsv), 0);
  assert.equal(normalizeRetainedSessionCsv(retainedBlankBodyCsv), "");
  const retainedExtraTrailingBlankCsv = `${retainedCountCsv}\n\n`;
  assert.equal(csvDataRowCount(retainedExtraTrailingBlankCsv), 0);
  assert.equal(normalizeRetainedSessionCsv(retainedExtraTrailingBlankCsv), "");
  const retainedExponentFlagCsv = [
    "ms,setpoint_cm,pressure_cmH2O,error_cmH2O,flowProxy_hPa,motorAmp,controller_error_cm,controller_amp,motorCmd,motorFault,motorI2c,motorFgHz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
    "1000,4.0,4.2,0.2,-0.4,40,0.2,40,40,1e0,1",
  ].join("\n");
  assert.equal(csvDataRowCount(retainedExponentFlagCsv), 0);
  const retainedExponentAnalogCsv = [
    "ms,setpoint_cm,pressure_cmH2O,error_cmH2O,flowProxy_hPa,motorAmp,controller_error_cm,controller_amp,motorCmd,motorFault,motorI2c,motorFgHz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
    "1000,4.0,4.2e0,0.2,-0.4,40,0.2,40,40,0,1",
  ].join("\n");
  assert.equal(csvDataRowCount(retainedExponentAnalogCsv), 0);
  assert.equal(normalizeKnownCsv(retainedExponentAnalogCsv), "");
  const retainedLeadingZeroAnalogCsv = [
    "ms,setpoint_cm,pressure_cmH2O,error_cmH2O,flowProxy_hPa,motorAmp,controller_error_cm,controller_amp,motorCmd,motorFault,motorI2c,motorFgHz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
    "1000,04.0,4.2,0.2,-0.4,40,0.2,40,40,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
  ].join("\n");
  assert.equal(csvDataRowCount(retainedLeadingZeroAnalogCsv), 0);
  assert.equal(normalizeKnownCsv(retainedLeadingZeroAnalogCsv), "");
  assert.equal(
    csvPreview(retainedCountCsv, 3),
    [
      "ms,setpoint_cm,pressure_cmH2O,error_cmH2O,flowProxy_hPa,motorAmp,controller_error_cm,controller_amp,motorCmd,motorFault,motorI2c,motorFgHz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
      "1000,4.0,4.2,0.2,-0.4,40,0.2,40,40,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
      "2000,5.0,5.1,0.1,0.3,45,0.1,45,45,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
    ].join("\n"),
  );
  assert.equal(
    normalizeKnownCsv(retainedCountCsv),
    [
      "ms,setpoint_cm,pressure_cmH2O,error_cmH2O,flowProxy_hPa,motorAmp,controller_error_cm,controller_amp,motorCmd,motorFault,motorI2c,motorFgHz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
      "1000,4.0,4.2,0.2,-0.4,40,0.2,40,40,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
      "2000,5.0,5.1,0.1,0.3,45,0.1,45,45,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
      "",
    ].join("\n"),
  );
  assert.equal(normalizeRetainedSessionCsv(retainedCountCsv), normalizeKnownCsv(retainedCountCsv));
  assert.equal(normalizeKnownCsv(retainedImpossibleStatusCsv), "");
  assert.equal(csvPreview(retainedCountCsv, 0), "... 3 more valid preview lines; export CSV for the complete log.");
  assert.equal(csvPreview(retainedCountCsv, Number.NaN), "... 3 more valid preview lines; export CSV for the complete log.");
  const retainedGapCsv = [
    "ms,setpoint_cm,pressure_cmH2O,error_cmH2O,flowProxy_hPa,motorAmp,controller_error_cm,controller_amp,motorCmd,motorFault,motorI2c,motorFgHz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
    "1000,4.0,4.2,0.2,-0.4,40,0.2,40,40,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
    "2000,5.0,5.1,0.1,0.3,45,0.1,45,45,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
    "9000,6.0,6.1,0.1,0.4,50,0.1,50,50,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
    "10000,7.0,7.1,0.1,0.5,55,0.1,55,55,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
  ].join("\n");
  assert.equal(csvDataRowCount(retainedGapCsv), 2);
  assert.deepEqual(parseSessionGraphData(retainedGapCsv).map(({ ms }) => ms), [9000, 10000]);
  assert.equal(
    normalizeRetainedSessionCsv(retainedGapCsv),
    [
      "ms,setpoint_cm,pressure_cmH2O,error_cmH2O,flowProxy_hPa,motorAmp,controller_error_cm,controller_amp,motorCmd,motorFault,motorI2c,motorFgHz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
      "9000,6.0,6.1,0.1,0.4,50,0.1,50,50,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
      "10000,7.0,7.1,0.1,0.5,55,0.1,55,55,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
      "",
    ].join("\n"),
  );
  assert.equal(
    normalizeRetainedSessionSnapshot(retainedGapCsv),
    retainedGapCsv,
    "a valid rolling snapshot may contain more than one cadence-separated therapy segment",
  );
  assert.equal(normalizeRetainedSessionSnapshot(`${retainedGapCsv}\n\n`), null);
  assert.equal(
    normalizeRetainedSessionSnapshot(
      retainedGapCsv.replace(
        "10000,7.0,7.1",
        "9000,7.0,7.1",
      ),
    ),
    null,
    "the raw retained snapshot still requires strictly increasing timestamps",
  );
  assert.equal(
    csvPreview(retainedGapCsv),
    [
      "ms,setpoint_cm,pressure_cmH2O,error_cmH2O,flowProxy_hPa,motorAmp,controller_error_cm,controller_amp,motorCmd,motorFault,motorI2c,motorFgHz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
      "9000,6.0,6.1,0.1,0.4,50,0.1,50,50,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
      "10000,7.0,7.1,0.1,0.5,55,0.1,55,55,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
    ].join("\n"),
  );
  const faultCountCsv = [
    "ts_ms,sys_mode,fault,vin_V,pMask_hPa,pBlower_hPa,ambient_hPa,diff_hPa,setpoint_cm,flowProxy_hPa,motorAmp,motorCmd,motorFault,motorI2c,motorFgHz,loop_us,miss1,miss2,i2cErr1,i2cErr2",
    "1000,4,4,24.00,1.00,2.00,0.00,1.00,4.00,0.10,40,40,1,1,123.45,123,0,0,0,0",
    "bad,row",
  ].join("\n");
  assert.equal(normalizeFaultSnapshot(faultCountCsv), null);
  assert.equal(csvDataRowCount(faultCountCsv), 1);
  assert.equal(
    normalizeKnownCsv(faultCountCsv),
    [
      "ts_ms,sys_mode,fault,vin_V,pMask_hPa,pBlower_hPa,ambient_hPa,diff_hPa,setpoint_cm,flowProxy_hPa,motorAmp,motorCmd,motorFault,motorI2c,motorFgHz,loop_us,miss1,miss2,i2cErr1,i2cErr2",
      "1000,4,4,24.00,1.00,2.00,0.00,1.00,4.00,0.10,40,40,1,1,123.45,123,0,0,0,0",
      "",
    ].join("\n"),
  );
  assert.equal(normalizeRetainedSessionCsv(faultCountCsv), "");
  assert.equal(normalizeFaultCsv(faultCountCsv), normalizeKnownCsv(faultCountCsv));
  assert.equal(normalizeFaultCsv(retainedCountCsv), "");
  const faultLeadingBlankHeaderCsv = [
    "",
    "ts_ms,sys_mode,fault,vin_V,pMask_hPa,pBlower_hPa,ambient_hPa,diff_hPa,setpoint_cm,flowProxy_hPa,motorAmp,motorCmd,motorFault,motorI2c,motorFgHz,loop_us,miss1,miss2,i2cErr1,i2cErr2",
    "1000,4,4,24.00,1.00,2.00,0.00,1.00,4.00,0.10,40,40,1,1,123.45,123,0,0,0,0",
  ].join("\n");
  assert.equal(csvDataRowCount(faultLeadingBlankHeaderCsv), 0);
  assert.equal(normalizeFaultCsv(faultLeadingBlankHeaderCsv), "");
  const faultBlankBodyCsv = [
    "ts_ms,sys_mode,fault,vin_V,pMask_hPa,pBlower_hPa,ambient_hPa,diff_hPa,setpoint_cm,flowProxy_hPa,motorAmp,motorCmd,motorFault,motorI2c,motorFgHz,loop_us,miss1,miss2,i2cErr1,i2cErr2",
    "1000,4,4,24.00,1.00,2.00,0.00,1.00,4.00,0.10,40,40,1,1,123.45,123,0,0,0,0",
    "",
    "2000,4,2,24.00,1.00,2.00,0.00,1.00,4.00,0.10,41,41,1,1,123.45,124,0,0,0,0",
  ].join("\n");
  assert.equal(csvDataRowCount(faultBlankBodyCsv), 0);
  assert.equal(normalizeFaultCsv(faultBlankBodyCsv), "");
  const faultExtraTrailingBlankCsv = `${faultCountCsv}\n\n`;
  assert.equal(csvDataRowCount(faultExtraTrailingBlankCsv), 0);
  assert.equal(normalizeFaultCsv(faultExtraTrailingBlankCsv), "");
  const retainedHeaderOnlyCsv = "ms,setpoint_cm,pressure_cmH2O,error_cmH2O,flowProxy_hPa,motorAmp,controller_error_cm,controller_amp,motorCmd,motorFault,motorI2c,motorFgHz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c";
  const faultHeaderOnlyCsv = "ts_ms,sys_mode,fault,vin_V,pMask_hPa,pBlower_hPa,ambient_hPa,diff_hPa,setpoint_cm,flowProxy_hPa,motorAmp,motorCmd,motorFault,motorI2c,motorFgHz,loop_us,miss1,miss2,i2cErr1,i2cErr2\n";
  assert.equal(isHeaderOnlyRetainedSessionCsv(retainedHeaderOnlyCsv), true);
  assert.equal(isHeaderOnlyFaultCsv(faultHeaderOnlyCsv), true);
  assert.equal(isHeaderOnlyRetainedSessionCsv(""), false);
  assert.equal(isHeaderOnlyFaultCsv(""), false);
  assert.equal(isHeaderOnlyRetainedSessionCsv(`\n${retainedHeaderOnlyCsv}`), false);
  assert.equal(isHeaderOnlyFaultCsv(`${faultHeaderOnlyCsv}\n`), false);
  assert.equal(isHeaderOnlyRetainedSessionCsv(`${retainedHeaderOnlyCsv} \n`), false);
  assert.equal(isHeaderOnlyRetainedSessionCsv(faultHeaderOnlyCsv), false);
  assert.equal(isHeaderOnlyFaultCsv(retainedHeaderOnlyCsv), false);
  assert.equal(isClearedDeviceLogReadback(retainedHeaderOnlyCsv, faultHeaderOnlyCsv), true);
  assert.equal(isClearedDeviceLogReadback(`\n${retainedHeaderOnlyCsv}`, faultHeaderOnlyCsv), false);
  assert.equal(isClearedDeviceLogReadback(retainedHeaderOnlyCsv, `${faultHeaderOnlyCsv}\n`), false);
  assert.equal(isClearedDeviceLogReadback("", ""), false);
  assert.equal(isClearedDeviceLogReadback(retainedHeaderOnlyCsv, "fault-not-csv"), false);
  assert.equal(isClearedDeviceLogReadback("not-retained-csv", faultHeaderOnlyCsv), false);
  assert.equal(isClearedDeviceLogReadback(retainedCountCsv, faultHeaderOnlyCsv), false);
  const faultDuplicateTimestampCsv = [
    "ts_ms,sys_mode,fault,vin_V,pMask_hPa,pBlower_hPa,ambient_hPa,diff_hPa,setpoint_cm,flowProxy_hPa,motorAmp,motorCmd,motorFault,motorI2c,motorFgHz,loop_us,miss1,miss2,i2cErr1,i2cErr2",
    "1000,4,4,24.00,1.00,2.00,0.00,1.00,4.00,0.10,40,40,1,1,123.45,123,0,0,0,0",
    "1000,4,2,24.00,1.00,2.00,0.00,1.00,4.00,0.10,41,41,1,1,123.45,124,0,0,0,0",
    "2000,4,2,24.00,1.00,2.00,0.00,1.00,4.00,0.10,42,42,1,1,123.45,125,0,0,0,0",
  ].join("\n");
  assert.equal(csvDataRowCount(faultDuplicateTimestampCsv), 2);
  assert.equal(
    normalizeFaultCsv(faultDuplicateTimestampCsv),
    [
      "ts_ms,sys_mode,fault,vin_V,pMask_hPa,pBlower_hPa,ambient_hPa,diff_hPa,setpoint_cm,flowProxy_hPa,motorAmp,motorCmd,motorFault,motorI2c,motorFgHz,loop_us,miss1,miss2,i2cErr1,i2cErr2",
      "1000,4,4,24.00,1.00,2.00,0.00,1.00,4.00,0.10,40,40,1,1,123.45,123,0,0,0,0",
      "2000,4,2,24.00,1.00,2.00,0.00,1.00,4.00,0.10,42,42,1,1,123.45,125,0,0,0,0",
      "",
    ].join("\n"),
  );
  const faultBackwardTimestampCsv = [
    "ts_ms,sys_mode,fault,vin_V,pMask_hPa,pBlower_hPa,ambient_hPa,diff_hPa,setpoint_cm,flowProxy_hPa,motorAmp,motorCmd,motorFault,motorI2c,motorFgHz,loop_us,miss1,miss2,i2cErr1,i2cErr2",
    "1000,4,4,24.00,1.00,2.00,0.00,1.00,4.00,0.10,40,40,1,1,123.45,123,0,0,0,0",
    "900,4,2,24.00,1.00,2.00,0.00,1.00,4.00,0.10,41,41,1,1,123.45,124,0,0,0,0",
    "1100,4,2,24.00,1.00,2.00,0.00,1.00,4.00,0.10,42,42,1,1,123.45,125,0,0,0,0",
  ].join("\n");
  assert.equal(csvDataRowCount(faultBackwardTimestampCsv), 2);
  const faultNanAnalogCsv = [
    "ts_ms,sys_mode,fault,vin_V,pMask_hPa,pBlower_hPa,ambient_hPa,diff_hPa,setpoint_cm,flowProxy_hPa,motorAmp,motorCmd,motorFault,motorI2c,motorFgHz,loop_us,miss1,miss2,i2cErr1,i2cErr2",
    "1000,4,2,NAN,NAN,NAN,NAN,NAN,NAN,NAN,0,0,0,1,123.45,123,5,5,-2,-2",
  ].join("\n");
  assert.equal(csvDataRowCount(faultNanAnalogCsv), 1);
  const faultPaddedNanAnalogCsv = [
    "ts_ms,sys_mode,fault,vin_V,pMask_hPa,pBlower_hPa,ambient_hPa,diff_hPa,setpoint_cm,flowProxy_hPa,motorAmp,motorCmd,motorFault,motorI2c,motorFgHz,loop_us,miss1,miss2,i2cErr1,i2cErr2",
    "1000,4,2, NAN,NAN,NAN,NAN,NAN,NAN,NAN,0,0,0,1,123.45,123,5,5,-2,-2",
  ].join("\n");
  assert.equal(csvDataRowCount(faultPaddedNanAnalogCsv), 0);
  const faultLeadingZeroAnalogCsv = [
    "ts_ms,sys_mode,fault,vin_V,pMask_hPa,pBlower_hPa,ambient_hPa,diff_hPa,setpoint_cm,flowProxy_hPa,motorAmp,motorCmd,motorFault,motorI2c,motorFgHz,loop_us,miss1,miss2,i2cErr1,i2cErr2",
    "1000,4,2,024.00,1.00,2.00,0.00,1.00,4.00,0.10,40,40,1,1,123.45,123,5,5,-2,-2",
  ].join("\n");
  assert.equal(csvDataRowCount(faultLeadingZeroAnalogCsv), 0);
  assert.equal(normalizeFaultCsv(faultLeadingZeroAnalogCsv), "");
  const faultPaddedIntegerCsv = [
    "ts_ms,sys_mode,fault,vin_V,pMask_hPa,pBlower_hPa,ambient_hPa,diff_hPa,setpoint_cm,flowProxy_hPa,motorAmp,motorCmd,motorFault,motorI2c,motorFgHz,loop_us,miss1,miss2,i2cErr1,i2cErr2",
    "1000,04,2,NAN,NAN,NAN,NAN,NAN,NAN,NAN,0,0,0,1,123,5,5,-2,-2",
    "2000,4,2,NAN,NAN,NAN,NAN,NAN,NAN,NAN,0,0,0,1,123,5,5,-01,-2",
  ].join("\n");
  assert.equal(csvDataRowCount(faultPaddedIntegerCsv), 0);
  const faultNegativeZeroUnsignedCsv = [
    "ts_ms,sys_mode,fault,vin_V,pMask_hPa,pBlower_hPa,ambient_hPa,diff_hPa,setpoint_cm,flowProxy_hPa,motorAmp,motorCmd,motorFault,motorI2c,motorFgHz,loop_us,miss1,miss2,i2cErr1,i2cErr2",
    "-0,4,2,NAN,NAN,NAN,NAN,NAN,NAN,NAN,0,0,0,1,123,5,5,-2,-2",
    "2000,4,2,NAN,NAN,NAN,NAN,NAN,NAN,NAN,-0,0,0,1,123,5,5,-2,-2",
  ].join("\n");
  assert.equal(csvDataRowCount(faultNegativeZeroUnsignedCsv), 0);
  assert.equal(normalizeFaultCsv(faultNegativeZeroUnsignedCsv), "");
  const faultNegativeZeroSignedCsv = [
    "ts_ms,sys_mode,fault,vin_V,pMask_hPa,pBlower_hPa,ambient_hPa,diff_hPa,setpoint_cm,flowProxy_hPa,motorAmp,motorCmd,motorFault,motorI2c,motorFgHz,loop_us,miss1,miss2,i2cErr1,i2cErr2",
    "1000,4,2,NAN,NAN,NAN,NAN,NAN,NAN,NAN,0,0,0,1,123,5,5,-0,-2",
    "2000,4,2,NAN,NAN,NAN,NAN,NAN,NAN,NAN,0,0,0,1,123,5,5,-2,-0",
  ].join("\n");
  assert.equal(csvDataRowCount(faultNegativeZeroSignedCsv), 0);
  assert.equal(normalizeFaultCsv(faultNegativeZeroSignedCsv), "");
  const faultLowercaseNanAnalogCsv = [
    "ts_ms,sys_mode,fault,vin_V,pMask_hPa,pBlower_hPa,ambient_hPa,diff_hPa,setpoint_cm,flowProxy_hPa,motorAmp,motorCmd,motorFault,motorI2c,motorFgHz,loop_us,miss1,miss2,i2cErr1,i2cErr2",
    "1000,4,2,nan,NAN,NAN,NAN,NAN,NAN,NAN,0,0,0,1,123,5,5,-2,-2",
  ].join("\n");
  assert.equal(csvDataRowCount(faultLowercaseNanAnalogCsv), 0);
  assert.equal(normalizeFaultCsv(faultLowercaseNanAnalogCsv), "");
  const faultPaddedRowCsv = [
    "ts_ms,sys_mode,fault,vin_V,pMask_hPa,pBlower_hPa,ambient_hPa,diff_hPa,setpoint_cm,flowProxy_hPa,motorAmp,motorCmd,motorFault,motorI2c,motorFgHz,loop_us,miss1,miss2,i2cErr1,i2cErr2",
    "1000,4,2,NAN,NAN,NAN,NAN,NAN,NAN,NAN,0,0,0,1,123,5,5,-2,-2 ",
  ].join("\n");
  assert.equal(csvDataRowCount(faultPaddedRowCsv), 0);
  const faultNanStatusCsv = [
    "ts_ms,sys_mode,fault,vin_V,pMask_hPa,pBlower_hPa,ambient_hPa,diff_hPa,setpoint_cm,flowProxy_hPa,motorAmp,motorCmd,motorFault,motorI2c,motorFgHz,loop_us,miss1,miss2,i2cErr1,i2cErr2",
    "1000,4,2,24.00,1.00,2.00,0.00,1.00,4.00,0.10,NAN,0,0,1,123,5,5,-2,-2",
  ].join("\n");
  assert.equal(csvDataRowCount(faultNanStatusCsv), 0);
  const faultImpossibleEnumCsv = [
    "ts_ms,sys_mode,fault,vin_V,pMask_hPa,pBlower_hPa,ambient_hPa,diff_hPa,setpoint_cm,flowProxy_hPa,motorAmp,motorCmd,motorFault,motorI2c,motorFgHz,loop_us,miss1,miss2,i2cErr1,i2cErr2",
    "1000,9,2,24.00,1.00,2.00,0.00,1.00,4.00,0.10,0,0,0,1,123.45,123,5,5,-2,-2",
  ].join("\n");
  assert.equal(csvDataRowCount(faultImpossibleEnumCsv), 0);
  const faultNoneCsv = [
    "ts_ms,sys_mode,fault,vin_V,pMask_hPa,pBlower_hPa,ambient_hPa,diff_hPa,setpoint_cm,flowProxy_hPa,motorAmp,motorCmd,motorFault,motorI2c,motorFgHz,loop_us,miss1,miss2,i2cErr1,i2cErr2",
    "1000,4,0,24.00,1.00,2.00,0.00,1.00,4.00,0.10,0,0,0,1,123.45,123,5,5,-2,-2",
  ].join("\n");
  assert.equal(csvDataRowCount(faultNoneCsv), 0);
  assert.equal(normalizeFaultCsv(faultNoneCsv), "");
  const faultNonFaultModeCsv = [
    "ts_ms,sys_mode,fault,vin_V,pMask_hPa,pBlower_hPa,ambient_hPa,diff_hPa,setpoint_cm,flowProxy_hPa,motorAmp,motorCmd,motorFault,motorI2c,motorFgHz,loop_us,miss1,miss2,i2cErr1,i2cErr2",
    "1000,3,2,24.00,1.00,2.00,0.00,1.00,4.00,0.10,0,0,0,1,123.45,123,5,5,-2,-2",
  ].join("\n");
  assert.equal(csvDataRowCount(faultNonFaultModeCsv), 0);
  assert.equal(normalizeFaultCsv(faultNonFaultModeCsv), "");
  const faultImpossibleFlagCsv = [
    "ts_ms,sys_mode,fault,vin_V,pMask_hPa,pBlower_hPa,ambient_hPa,diff_hPa,setpoint_cm,flowProxy_hPa,motorAmp,motorCmd,motorFault,motorI2c,motorFgHz,loop_us,miss1,miss2,i2cErr1,i2cErr2",
    "1000,4,2,24.00,1.00,2.00,0.00,1.00,4.00,0.10,0,0,2,1,123.45,123,5,5,-2,-2",
  ].join("\n");
  assert.equal(csvDataRowCount(faultImpossibleFlagCsv), 0);
  const faultFractionalCounterCsv = [
    "ts_ms,sys_mode,fault,vin_V,pMask_hPa,pBlower_hPa,ambient_hPa,diff_hPa,setpoint_cm,flowProxy_hPa,motorAmp,motorCmd,motorFault,motorI2c,motorFgHz,loop_us,miss1,miss2,i2cErr1,i2cErr2",
    "1000,4,2,24.00,1.00,2.00,0.00,1.00,4.00,0.10,0,0,0,1,123.45,123.5,5,5,-2,-2",
  ].join("\n");
  assert.equal(csvDataRowCount(faultFractionalCounterCsv), 0);
  const faultExponentCounterCsv = [
    "ts_ms,sys_mode,fault,vin_V,pMask_hPa,pBlower_hPa,ambient_hPa,diff_hPa,setpoint_cm,flowProxy_hPa,motorAmp,motorCmd,motorFault,motorI2c,motorFgHz,loop_us,miss1,miss2,i2cErr1,i2cErr2",
    "1000,4,2,24.00,1.00,2.00,0.00,1.00,4.00,0.10,0,0,0,1,1e3,5,5,-2,-2",
  ].join("\n");
  assert.equal(csvDataRowCount(faultExponentCounterCsv), 0);
  const faultExponentAnalogCsv = [
    "ts_ms,sys_mode,fault,vin_V,pMask_hPa,pBlower_hPa,ambient_hPa,diff_hPa,setpoint_cm,flowProxy_hPa,motorAmp,motorCmd,motorFault,motorI2c,motorFgHz,loop_us,miss1,miss2,i2cErr1,i2cErr2",
    "1000,4,2,2.4e1,1.00,2.00,0.00,1.00,4.00,0.10,0,0,0,1,123,5,5,-2,-2",
  ].join("\n");
  assert.equal(csvDataRowCount(faultExponentAnalogCsv), 0);
  const liveCountCsv = [
    "ms,setpoint_hPa,pressure_hPa,flow_hPa,vin,mode,measured_cm,error_cm,controller_amp,motor_cmd,motor_fault,motor_i2c,motor_fg_hz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
    "1000,9.81,1.20,-0.4,24.0,2,10.20,-0.20,42,42,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
    "1000,9.81,1.20,-0.4,24.0,2,10.20,-0.20,42,42,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
    "1500,9.81,1.30,-0.3,24.0,2,10.10,-0.10,43,43,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
    "1600,9.81,1.30,,24.0,2,10.10,-0.10,43,43,0,1,NAN,NAN,0,NAN,NAN,NAN",
  ].join("\n");
  assert.equal(csvDataRowCount(liveCountCsv), 2);
  const retainedImportCsv = [
    "ms,setpoint_cm,pressure_cmH2O,error_cmH2O,flowProxy_hPa,motorAmp,controller_error_cm,controller_amp,motorCmd,motorFault,motorI2c,motorFgHz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
    "1000,4.0,4.2,0.2,-0.4,40,0.2,40,40,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
    "2000,5.0,5.1,0.1,0.3,45,0.1,45,45,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
  ].join("\n");
  const faultImportCsv = [
    "ts_ms,sys_mode,fault,vin_V,pMask_hPa,pBlower_hPa,ambient_hPa,diff_hPa,setpoint_cm,flowProxy_hPa,motorAmp,motorCmd,motorFault,motorI2c,motorFgHz,loop_us,miss1,miss2,i2cErr1,i2cErr2",
    "1000,4,2,NAN,NAN,NAN,NAN,NAN,NAN,NAN,0,0,0,1,123.45,123,5,5,-2,-2",
  ].join("\n");
  assert.equal(retainedReadbackImportedRowCount(retainedImportCsv, faultImportCsv), 3);
  assert.equal(retainedReadbackImportedRowCount(faultImportCsv, retainedImportCsv), 0);
  assert.equal(retainedReadbackImportedRowCount(liveCountCsv, ""), 0);
  assert.equal(retainedReadbackImportedRowCount(retainedHeaderOnlyCsv, faultHeaderOnlyCsv), 0);
  assert.equal(retainedReadbackImportedRowCount(liveCountCsv, faultImportCsv), 1);
  assert.equal(retainedReadbackImportedRowCount(retainedImportCsv, liveCountCsv), 2);
  const liveImpossibleModeCsv = [
    "ms,setpoint_hPa,pressure_hPa,flow_hPa,vin,mode,measured_cm,error_cm,controller_amp,motor_cmd,motor_fault,motor_i2c,motor_fg_hz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
    "1000,9.81,1.20,-0.4,24.0,9,10.20,-0.20,42,42,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
  ].join("\n");
  assert.equal(csvDataRowCount(liveImpossibleModeCsv), 0);
  assert.equal(parseSessionGraphData(liveImpossibleModeCsv).length, 0);
  const liveLeadingBlankHeaderCsv = [
    "",
    "ms,setpoint_hPa,pressure_hPa,flow_hPa,vin,mode,measured_cm,error_cm,controller_amp,motor_cmd,motor_fault,motor_i2c,motor_fg_hz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
    "1000,9.81,1.20,-0.4,24.0,2,10.20,-0.20,42,42,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
  ].join("\n");
  assert.equal(csvDataRowCount(liveLeadingBlankHeaderCsv), 0);
  assert.equal(parseSessionGraphData(liveLeadingBlankHeaderCsv).length, 0);
  const liveBlankBodyCsv = [
    "ms,setpoint_hPa,pressure_hPa,flow_hPa,vin,mode,measured_cm,error_cm,controller_amp,motor_cmd,motor_fault,motor_i2c,motor_fg_hz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
    "1000,9.81,1.20,-0.4,24.0,2,10.20,-0.20,42,42,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
    "",
    "1100,9.81,1.30,-0.3,24.0,2,10.10,-0.10,43,43,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
  ].join("\n");
  assert.equal(csvDataRowCount(liveBlankBodyCsv), 0);
  assert.equal(parseSessionGraphData(liveBlankBodyCsv).length, 0);
  const liveExtraTrailingBlankCsv = `${liveCountCsv}\n\n`;
  assert.equal(csvDataRowCount(liveExtraTrailingBlankCsv), 0);
  assert.equal(parseSessionGraphData(liveExtraTrailingBlankCsv).length, 0);
  assert.equal(isValidLiveCsvRow("1000,9.81,1.20,-0.4,24.0,0,10.20,-0.20,42,42,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN"), true);
  for (const inactiveMode of ["0", "3", "4"]) {
    const liveInactiveModeCsv = [
      "ms,setpoint_hPa,pressure_hPa,flow_hPa,vin,mode,measured_cm,error_cm,controller_amp,motor_cmd,motor_fault,motor_i2c,motor_fg_hz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
      `1000,9.81,1.20,-0.4,24.0,${inactiveMode},10.20,-0.20,42,42,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN`,
    ].join("\n");
    assert.equal(csvDataRowCount(liveInactiveModeCsv), 0);
    assert.equal(parseSessionGraphData(liveInactiveModeCsv).length, 0);
    assert.equal(normalizeKnownCsv(liveInactiveModeCsv), "");
  }
  const liveImpossibleStatusCsv = [
    "ms,setpoint_hPa,pressure_hPa,flow_hPa,vin,mode,measured_cm,error_cm,controller_amp,motor_cmd,motor_fault,motor_i2c,motor_fg_hz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
    "1000,9.81,1.20,-0.4,24.0,2,10.20,-0.20,42,42,0,2,123.45,NAN,NAN,0,NAN,NAN,NAN",
  ].join("\n");
  assert.equal(csvDataRowCount(liveImpossibleStatusCsv), 0);
  assert.equal(parseSessionGraphData(liveImpossibleStatusCsv).length, 0);
  const liveExponentAnalogCsv = [
    "ms,setpoint_hPa,pressure_hPa,flow_hPa,vin,mode,measured_cm,error_cm,controller_amp,motor_cmd,motor_fault,motor_i2c,motor_fg_hz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
    "1000,9.81,1.2e0,-0.4,24.0,2,10.20,-0.20,42,42,0,1,NAN,NAN,0,NAN,NAN,NAN",
  ].join("\n");
  assert.equal(csvDataRowCount(liveExponentAnalogCsv), 0);
  assert.equal(parseSessionGraphData(liveExponentAnalogCsv).length, 0);
  const liveLeadingZeroAnalogCsv = [
    "ms,setpoint_hPa,pressure_hPa,flow_hPa,vin,mode,measured_cm,error_cm,controller_amp,motor_cmd,motor_fault,motor_i2c,motor_fg_hz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
    "1000,09.81,1.20,-0.4,24.0,2,10.20,-0.20,42,42,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
  ].join("\n");
  assert.equal(csvDataRowCount(liveLeadingZeroAnalogCsv), 0);
  assert.equal(parseSessionGraphData(liveLeadingZeroAnalogCsv).length, 0);
  const livePaddedStatusCsv = [
    "ms,setpoint_hPa,pressure_hPa,flow_hPa,vin,mode,measured_cm,error_cm,controller_amp,motor_cmd,motor_fault,motor_i2c,motor_fg_hz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
    "1000,9.81,1.20,-0.4,24.0,2,10.20,-0.20,42,42,0, 1,123.45,NAN,NAN,0,NAN,NAN,NAN",
  ].join("\n");
  assert.equal(csvDataRowCount(livePaddedStatusCsv), 0);
  assert.equal(parseSessionGraphData(livePaddedStatusCsv).length, 0);
  assert.equal(
    csvPreview(liveCountCsv, 3),
    [
      "ms,setpoint_hPa,pressure_hPa,flow_hPa,vin,mode,measured_cm,error_cm,controller_amp,motor_cmd,motor_fault,motor_i2c,motor_fg_hz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
      "1000,9.81,1.20,-0.4,24.0,2,10.20,-0.20,42,42,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
      "1500,9.81,1.30,-0.3,24.0,2,10.10,-0.10,43,43,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
    ].join("\n"),
  );
  const liveGapCsv = [
    "ms,setpoint_hPa,pressure_hPa,flow_hPa,vin,mode,measured_cm,error_cm,controller_amp,motor_cmd,motor_fault,motor_i2c,motor_fg_hz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
    "1000,9.81,1.20,-0.4,24.0,2,10.20,-0.20,42,42,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
    "1100,9.81,1.30,-0.3,24.0,2,10.10,-0.10,43,43,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
    "3100,9.81,1.40,-0.2,24.0,2,10.00,0.00,44,44,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
    "3200,9.81,1.50,-0.1,24.0,2,9.90,0.10,45,45,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
  ].join("\n");
  assert.equal(csvDataRowCount(liveGapCsv), 2);
  assert.deepEqual(parseSessionGraphData(liveGapCsv).map(({ ms }) => ms), [3100, 3200]);
  assert.deepEqual(
    parseSessionGraphData(
      [
        "ms,setpoint_cm,pressure_cmH2O,error_cmH2O,flowProxy_hPa,motorAmp,controller_error_cm,controller_amp,motorCmd,motorFault,motorI2c,motorFgHz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
        "1000,4.0,4.2,0.2,-0.4,40,0.2,40,40,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
        "2000,5.0,5.1,0.1,0.3,45,0.1,45,45,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
        "bad,row",
      ].join("\n"),
    ).map(({ ms, pressureCm, flowHpa, setpointCm, motorFgHz }) => ({ ms, pressureCm, flowHpa, setpointCm, motorFgHz })),
    [
      { ms: 1000, pressureCm: 4.2, flowHpa: -0.4, setpointCm: 4, motorFgHz: 123.45 },
      { ms: 2000, pressureCm: 5.1, flowHpa: 0.3, setpointCm: 5, motorFgHz: 123.45 },
    ],
  );
  assert.equal(parseSessionGraphData("h\n1,2,3,4,5\n2,3,4,5,6\n3,4,5,6,7", 2).length, 0);
  assert.equal(
    parseSessionGraphData(
      [
        "ms,setpoint_hPa,flow_hPa,pressure_hPa,vin,mode,measured_cm,error_cm,controller_amp,motor_cmd,motor_fault,motor_i2c,motor_fg_hz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
        "1000,9.81,-0.4,1.20,24.0,2,10.20,-0.20,42,42,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
      ].join("\n"),
    ).length,
    0,
  );
  assert.equal(
    parseSessionGraphData(
      [
        "ms,setpoint_cm,pressure_cmH2O,error_cmH2O,flowProxy_hPa,motorAmp,controller_error_cm,controller_amp,motorCmd,motorFault,motorI2c,motorFgHz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
        "1000,4.0,4.2,-0.4,40,0.2,40,40,0,1",
      ].join("\n"),
    ).length,
    0,
  );
  assert.equal(
    parseSessionGraphData(
      [
        "ms,setpoint_cm,pressure_cmH2O,error_cmH2O,flowProxy_hPa,motorAmp,controller_error_cm,controller_amp,motorCmd,motorFault,motorI2c,motorFgHz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
        "1000,4.0,4.2,0.2,-0.4,40,0.2,40,40,0,1,extra,NAN,NAN,0,NAN,NAN,NAN",
      ].join("\n"),
    ).length,
    0,
  );
  assert.equal(
    parseSessionGraphData(
      [
        "ms,setpoint_hPa,pressure_hPa,flow_hPa,vin,mode,measured_cm,error_cm,controller_amp,motor_cmd,motor_fault,motor_i2c,motor_fg_hz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
        "1000,9.81,1.20,-0.4,24.0,2,10.20,-0.20,42,42,0,1,extra,NAN,NAN,0,NAN,NAN,NAN",
      ].join("\n"),
    ).length,
    0,
  );
  assert.equal(
    parseSessionGraphData(
      [
        "ms,setpoint_hPa,pressure_hPa,flow_hPa,vin,mode,measured_cm,error_cm,controller_amp,motor_cmd,motor_fault,motor_i2c,motor_fg_hz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
        "1000,9.81,1.20,-0.4,24.0,2,10.20,,42,42,0,1,NAN,NAN,0,NAN,NAN,NAN",
      ].join("\n"),
    ).length,
    0,
  );
  assert.equal(
    parseSessionGraphData(
      [
        "ms,setpoint_cm,pressure_cmH2O,error_cmH2O,flowProxy_hPa,motorAmp,controller_error_cm,controller_amp,motorCmd,motorFault,motorI2c,motorFgHz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
        "1000,4.0,4.2,0.2,-0.4,40,,40,40,0,1",
      ].join("\n"),
    ).length,
    0,
  );
  assert.deepEqual(
    parseSessionGraphData(
      [
        "ms,setpoint_cm,pressure_cmH2O,error_cmH2O,flowProxy_hPa,motorAmp,controller_error_cm,controller_amp,motorCmd,motorFault,motorI2c,motorFgHz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
        "1000,4.0,4.2,0.2,-0.4,40,0.2,40,40,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
        "900,5.0,5.1,0.1,0.3,45,0.1,45,45,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
        "1000,5.5,5.6,0.1,0.3,45,0.1,45,45,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
        "2000,6.0,6.1,0.1,0.4,50,0.1,50,50,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
      ].join("\n"),
    ).map(({ ms, pressureCm, flowHpa, setpointCm, motorFgHz }) => ({ ms, pressureCm, flowHpa, setpointCm, motorFgHz })),
    [
      { ms: 900, pressureCm: 5.1, flowHpa: 0.3, setpointCm: 5, motorFgHz: 123.45 },
      { ms: 1000, pressureCm: 5.6, flowHpa: 0.3, setpointCm: 5.5, motorFgHz: 123.45 },
      { ms: 2000, pressureCm: 6.1, flowHpa: 0.4, setpointCm: 6, motorFgHz: 123.45 },
    ],
  );
  assert.equal(
    parseSessionGraphData(
      [
        "ms,setpoint_cm,pressure_cmH2O,error_cmH2O,flowProxy_hPa,motorAmp,controller_error_cm,controller_amp,motorCmd,motorFault,motorI2c,motorFgHz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
        "1000,4.0,4.2,0.2,-0.4,40,0.2,40,40,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
        "2000,5.0,5.1,0.1,0.3,45,0.1,45,45,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
        "3000,6.0,6.1,0.1,0.4,50,0.1,50,50,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
      ].join("\n"),
      2,
    ).length,
    2,
  );
  assert.deepEqual(
    parseSessionGraphData(
      [
        "ms,setpoint_cm,pressure_cmH2O,error_cmH2O,flowProxy_hPa,motorAmp,controller_error_cm,controller_amp,motorCmd,motorFault,motorI2c,motorFgHz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
        "1000,4.0,4.2,0.2,-0.4,40,0.2,40,40,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
        "2000,5.0,5.1,0.1,0.3,45,0.1,45,45,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
        "3000,6.0,6.1,0.1,0.4,50,0.1,50,50,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
        "4000,7.0,7.1,0.1,0.5,55,0.1,55,55,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
      ].join("\n"),
      3,
    ).map(({ ms }) => ms),
    [1000, 3000, 4000],
  );
  assert.deepEqual(
    parseSessionGraphData(
      [
        "ms,setpoint_cm,pressure_cmH2O,error_cmH2O,flowProxy_hPa,motorAmp,controller_error_cm,controller_amp,motorCmd,motorFault,motorI2c,motorFgHz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
        "1000,4.0,4.2,0.2,-0.4,40,0.2,40,40,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
        "2000,5.0,5.1,0.1,0.3,45,0.1,45,45,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
      ].join("\n"),
      1,
    ).map(({ ms, pressureCm, flowHpa, setpointCm, motorFgHz }) => ({ ms, pressureCm, flowHpa, setpointCm, motorFgHz })),
    [{ ms: 2000, pressureCm: 5.1, flowHpa: 0.3, setpointCm: 5, motorFgHz: 123.45 }],
  );
  assert.deepEqual(
    parseSessionGraphData(
      [
        "ms,setpoint_cm,pressure_cmH2O,error_cmH2O,flowProxy_hPa,motorAmp,controller_error_cm,controller_amp,motorCmd,motorFault,motorI2c,motorFgHz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
        "1000,4.0,4.2,0.2,-0.4,40,0.2,40,40,0,1,123.45,97.5,62.0,1,NAN,NAN,NAN",
        "2000,5.0,5.1,0.1,0.3,45,0.1,45,45,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
      ].join("\n"),
    ).map(({ spo2Percent, pulseBpm, oximeterSource }) => ({ spo2Percent, pulseBpm, oximeterSource })),
    [
      { spo2Percent: 97.5, pulseBpm: 62, oximeterSource: 1 },
      { spo2Percent: null, pulseBpm: null, oximeterSource: 0 },
    ],
  );
  assert.equal(
    parseSessionGraphData(
      [
        "ms,setpoint_cm,pressure_cmH2O,error_cmH2O,flowProxy_hPa,motorAmp,controller_error_cm,controller_amp,motorCmd,motorFault,motorI2c,motorFgHz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
        "1000,4.0,4.2,0.2,-0.4,40,0.2,40,40,0,1,123.45,NAN,NAN,1,NAN,NAN,NAN",
      ].join("\n"),
    ).length,
    0,
  );
  assert.deepEqual(
    parseSessionGraphData(
      [
        "ms,setpoint_cm,pressure_cmH2O,error_cmH2O,flowProxy_hPa,motorAmp,controller_error_cm,controller_amp,motorCmd,motorFault,motorI2c,motorFgHz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
        "1000,4.0,4.2,0.2,-0.4,40,0.2,40,40,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
      ].join("\n"),
      0,
    ),
    [],
  );
  assert.deepEqual(
    parseSessionGraphData(
      [
        "ms,setpoint_cm,pressure_cmH2O,error_cmH2O,flowProxy_hPa,motorAmp,controller_error_cm,controller_amp,motorCmd,motorFault,motorI2c,motorFgHz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
        "1000,4.0,4.2,0.2,-0.4,40,0.2,40,40,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
        "2000,5.0,5.1,0.1,0.3,45,0.1,45,45,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
      ].join("\n"),
      Number.NaN,
    ).map(({ ms }) => ms),
    [1000, 2000],
  );
  const liveGraph = parseSessionGraphData(
    [
      "ms,setpoint_hPa,pressure_hPa,flow_hPa,vin,mode,measured_cm,error_cm,controller_amp,motor_cmd,motor_fault,motor_i2c,motor_fg_hz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
      "1000,9.81,1.20,-0.4,24.0,2,10.20,-0.20,42,42,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
      "1100,9.81,1.10,-0.3,24.0,2,10.10,-0.10,43,43,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
    ].join("\n"),
  );
  assert.equal(liveGraph.length, 2);
  assert.deepEqual(
    liveGraph.map(({ ms, pressureCm, flowHpa }) => ({ ms, pressureCm, flowHpa })),
    [
      { ms: 1000, pressureCm: 10.2, flowHpa: -0.4 },
      { ms: 1100, pressureCm: 10.1, flowHpa: -0.3 },
    ],
  );
  assert.ok(Math.abs(liveGraph[0].setpointCm - 10.0034) < 0.0001);
  assert.deepEqual(liveGraph.map(({ motorFgHz }) => motorFgHz), [123.45, 123.45]);
  const liveOximetryGraph = parseSessionGraphData(
    [
      "ms,setpoint_hPa,pressure_hPa,flow_hPa,vin,mode,measured_cm,error_cm,controller_amp,motor_cmd,motor_fault,motor_i2c,motor_fg_hz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
      "1000,9.81,1.20,-0.4,24.0,2,10.20,-0.20,42,42,0,1,123.45,97.5,62.0,2,NAN,NAN,NAN",
      "1100,9.81,1.10,-0.3,24.0,2,10.10,-0.10,43,43,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
    ].join("\n"),
  );
  assert.equal(liveOximetryGraph.length, 2);
  assert.deepEqual(
    liveOximetryGraph.map(({ spo2Percent, pulseBpm, oximeterSource }) => ({ spo2Percent, pulseBpm, oximeterSource })),
    [
      { spo2Percent: 97.5, pulseBpm: 62, oximeterSource: 2 },
      { spo2Percent: null, pulseBpm: null, oximeterSource: 0 },
    ],
  );
  const liveEnvironmentGraph = parseSessionGraphData(
    [
      "ms,setpoint_hPa,pressure_hPa,flow_hPa,vin,mode,measured_cm,error_cm,controller_amp,motor_cmd,motor_fault,motor_i2c,motor_fg_hz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
      "1000,9.81,1.20,-0.4,24.0,2,10.20,-0.20,42,42,0,1,123.45,97.5,62.0,2,25.5,38.0,28.0",
      "1100,9.81,1.10,-0.3,24.0,2,10.10,-0.10,43,43,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
    ].join("\n"),
  );
  assert.equal(liveEnvironmentGraph.length, 2);
  assert.deepEqual(
    liveEnvironmentGraph.map(({ humidifierTempC, humidifierRhPercent, hoseTempC }) => ({ humidifierTempC, humidifierRhPercent, hoseTempC })),
    [
      { humidifierTempC: 25.5, humidifierRhPercent: 38, hoseTempC: 28 },
      { humidifierTempC: null, humidifierRhPercent: null, hoseTempC: null },
    ],
  );
  assert.equal(
    parseSessionGraphData(
      [
        "ms,setpoint_hPa,pressure_hPa,flow_hPa,vin,mode,measured_cm,error_cm,controller_amp,motor_cmd,motor_fault,motor_i2c,motor_fg_hz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
        "1000,9.81,1.20,-0.4,24.0,2,10.20,-0.20,42,42,0,1,123.45,97.5,62.0,2,25.5,101.0,28.0",
      ].join("\n"),
    ).length,
    0,
  );
  const retainedEnvironmentGraph = parseSessionGraphData(
    [
      "ms,setpoint_cm,pressure_cmH2O,error_cmH2O,flowProxy_hPa,motorAmp,controller_error_cm,controller_amp,motorCmd,motorFault,motorI2c,motorFgHz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
      "1000,4.0,4.2,0.2,-0.4,40,0.2,40,40,0,1,123.45,97.5,62.0,1,24.0,45.5,29.0",
      "2000,5.0,5.1,0.1,0.3,45,0.1,45,45,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
    ].join("\n"),
  );
  assert.deepEqual(
    retainedEnvironmentGraph.map(({ humidifierTempC, humidifierRhPercent, hoseTempC }) => ({ humidifierTempC, humidifierRhPercent, hoseTempC })),
    [
      { humidifierTempC: 24, humidifierRhPercent: 45.5, hoseTempC: 29 },
      { humidifierTempC: null, humidifierRhPercent: null, hoseTempC: null },
    ],
  );
  assert.deepEqual(
    parseSessionGraphData(
      [
        "ms,setpoint_hPa,pressure_hPa,flow_hPa,vin,mode,measured_cm,error_cm,controller_amp,motor_cmd,motor_fault,motor_i2c,motor_fg_hz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
        "1000,9.81,1.20,-0.4,24.0,2,10.20,-0.20,42,42,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
        "900,9.81,1.10,-0.3,24.0,2,10.10,-0.10,43,43,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
        "1100,9.81,1.05,-0.2,24.0,2,10.05,-0.05,43,43,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
      ].join("\n"),
    ).map(({ ms }) => ms),
    [900, 1100],
  );
  assert.deepEqual(
    summarizeSessionCsv(
      [
        "ms,setpoint_cm,pressure_cmH2O,error_cmH2O,flowProxy_hPa,motorAmp,controller_error_cm,controller_amp,motorCmd,motorFault,motorI2c,motorFgHz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
        "1000,4.0,4.2,0.2,-0.4,40,0.2,40,40,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
        "3000,5.0,5.1,0.1,0.3,45,0.1,45,45,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
      ].join("\n"),
    ),
    { rows: 2, durationSec: 3, firstMs: 1000, lastMs: 3000 },
  );
  assert.deepEqual(
    summarizeSessionCsv(
      [
        "ms,setpoint_cm,pressure_cmH2O,error_cmH2O,flowProxy_hPa,motorAmp,controller_error_cm,controller_amp,motorCmd,motorFault,motorI2c,motorFgHz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
        "1000,4.0,4.2,0.2,-0.4,40,0.2,40,40,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
      ].join("\n"),
    ),
    { rows: 1, durationSec: 1, firstMs: 1000, lastMs: 1000 },
  );
  assert.deepEqual(
    summarizeSessionCsv(
      [
        "ms,setpoint_hPa,pressure_hPa,flow_hPa,vin,mode,measured_cm,error_cm,controller_amp,motor_cmd,motor_fault,motor_i2c,motor_fg_hz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
        "1000,9.81,1.20,-0.4,24.0,2,10.20,-0.20,42,42,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
        "1100,9.81,1.10,-0.3,24.0,2,10.10,-0.10,43,43,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
        "1200,9.81,1.05,-0.2,24.0,2,10.05,-0.05,43,43,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
      ].join("\n"),
    ),
    { rows: 3, durationSec: 0.3, firstMs: 1000, lastMs: 1200 },
  );
  assert.deepEqual(
    summarizeSessionCsv(
      [
        "ms,setpoint_hPa,pressure_hPa,flow_hPa,vin,mode,measured_cm,error_cm,controller_amp,motor_cmd,motor_fault,motor_i2c,motor_fg_hz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
        "1000,9.81,1.20,-0.4,24.0,2,10.20,-0.20,42,42,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
      ].join("\n"),
    ),
    { rows: 1, durationSec: 0.1, firstMs: 1000, lastMs: 1000 },
  );
  const liveCsv = [
    "ms,setpoint_hPa,pressure_hPa,flow_hPa,vin,mode,measured_cm,error_cm,controller_amp,motor_cmd,motor_fault,motor_i2c,motor_fg_hz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
    "1000,9.81,1.20,-0.4,24.0,2,10.20,-0.20,42,42,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
  ].join("\n");
  const liveAnalysisCsv = [
    "ms,setpoint_hPa,pressure_hPa,flow_hPa,vin,mode,measured_cm,error_cm,controller_amp,motor_cmd,motor_fault,motor_i2c,motor_fg_hz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
    ...Array.from({ length: 10 }, (_, index) => {
      const ms = 1000 + index * 100;
      return `${ms},9.81,1.20,-0.4,24.0,2,10.20,-0.20,42,42,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN`;
    }),
  ].join("\n");
  const retainedCsv = [
    "ms,setpoint_cm,pressure_cmH2O,error_cmH2O,flowProxy_hPa,motorAmp,controller_error_cm,controller_amp,motorCmd,motorFault,motorI2c,motorFgHz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
    "1000,4.0,4.2,0.2,-0.4,40,0.2,40,40,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
  ].join("\n");
  assert.deepEqual(selectSessionAnalysisCsv(liveCsv, retainedCsv, true), {
    csv: retainedCsv,
    source: "Retained 1 Hz firmware session",
  });
  assert.deepEqual(selectSessionAnalysisCsv(liveAnalysisCsv, retainedCsv, true), {
    csv: liveAnalysisCsv,
    source: "Live 10 Hz app sync",
  });
  assert.deepEqual(selectSessionAnalysisCsv("bad\n1,2,3", retainedCsv, true), {
    csv: retainedCsv,
    source: "Retained 1 Hz firmware session",
  });
  assert.deepEqual(selectSessionAnalysisCsv(liveCsv, retainedCsv, false), {
    csv: retainedCsv,
    source: "Retained 1 Hz firmware session",
  });
  assert.deepEqual(selectSessionAnalysisCsv("", retainedCsv, true), {
    csv: retainedCsv,
    source: "Retained 1 Hz firmware session",
  });
  assert.deepEqual(selectSessionAnalysisCsv("", "", false), {
    csv: "",
    source: "--",
  });
  assert.deepEqual(selectSessionAnalysisCsv("", "bad\n1,2,3", false), {
    csv: "",
    source: "--",
  });

  const multiDayCsv = [
    "ms,setpoint_cm,pressure_cmH2O,error_cmH2O,flowProxy_hPa,motorAmp,controller_error_cm,controller_amp,motorCmd,motorFault,motorI2c,motorFgHz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
    "0,4.0,4.2,0.2,-0.4,40,0.2,40,40,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
    ...Array.from({ length: 86402 }, (_, index) => {
      const ms = (index + 1) * 1000;
      return `${ms},5.0,5.1,0.1,0.3,45,0.1,45,45,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN`;
    }),
  ].join("\n");
  assert.deepEqual(listSessionDayOptions(multiDayCsv), [
    { key: "day-0", label: "Latest day", rows: 86400 },
    { key: "day-1", label: "Previous day", rows: 3 },
  ]);
  assert.deepEqual(listSessionDayOptions(multiDayCsv, 1), [{ key: "day-0", label: "Latest day", rows: 86400 }]);
  assert.deepEqual(listSessionDayOptions(multiDayCsv, Number.NaN), [
    { key: "day-0", label: "Latest day", rows: 86400 },
    { key: "day-1", label: "Previous day", rows: 3 },
  ]);
  assert.equal(filterSessionCsvByDay(multiDayCsv, "day-0").split(/\n/).filter(Boolean).length, 86401);
  assert.equal(
    filterSessionCsvByDay(multiDayCsv, "day-1"),
    [
      "ms,setpoint_cm,pressure_cmH2O,error_cmH2O,flowProxy_hPa,motorAmp,controller_error_cm,controller_amp,motorCmd,motorFault,motorI2c,motorFgHz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
      "0,4.0,4.2,0.2,-0.4,40,0.2,40,40,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
      "1000,5.0,5.1,0.1,0.3,45,0.1,45,45,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
      "2000,5.0,5.1,0.1,0.3,45,0.1,45,45,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
      "",
    ].join("\n"),
  );
  const dayGapCsv = [
    "ms,setpoint_cm,pressure_cmH2O,error_cmH2O,flowProxy_hPa,motorAmp,controller_error_cm,controller_amp,motorCmd,motorFault,motorI2c,motorFgHz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
    "1000,4.0,4.2,0.2,-0.4,40,0.2,40,40,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
    "2000,4.0,4.2,0.2,-0.4,40,0.2,40,40,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
    "9000,5.0,5.1,0.1,0.3,45,0.1,45,45,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
    "10000,5.0,5.1,0.1,0.3,45,0.1,45,45,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
  ].join("\n");
  assert.deepEqual(listSessionDayOptions(dayGapCsv), [{ key: "day-0", label: "Latest day", rows: 2 }]);
  assert.equal(
    filterSessionCsvByDay(dayGapCsv, "day-0"),
    [
      "ms,setpoint_cm,pressure_cmH2O,error_cmH2O,flowProxy_hPa,motorAmp,controller_error_cm,controller_amp,motorCmd,motorFault,motorI2c,motorFgHz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
      "9000,5.0,5.1,0.1,0.3,45,0.1,45,45,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
      "10000,5.0,5.1,0.1,0.3,45,0.1,45,45,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN",
      "",
    ].join("\n"),
  );
  assert.deepEqual(listSessionDayOptions("bad\n1,2,3"), []);
  assert.equal(filterSessionCsvByDay(multiDayCsv, "day-9"), "");
  assert.equal(filterSessionCsvByDay(multiDayCsv, "not-a-day"), filterSessionCsvByDay(multiDayCsv, "day-0"));

  const sessionHeader =
    "ms,setpoint_cm,pressure_cmH2O,error_cmH2O,flowProxy_hPa,motorAmp,controller_error_cm,controller_amp,motorCmd,motorFault,motorI2c,motorFgHz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c";
  const obstructiveRows = [
    sessionHeader,
    ...Array.from({ length: 20 }, (_, index) => `${index * 1000},8,8,0.1,2.0,40,0.1,40,40,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN`),
    ...Array.from({ length: 12 }, (_, index) => `${(20 + index) * 1000},8,6.5,1.5,0.02,55,1.5,55,55,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN`),
  ].join("\n");
  const obstructiveFlags = flagSessionObservations(obstructiveRows);
  assert.equal(obstructiveFlags.length, 1);
  assert.equal(obstructiveFlags[0].type, "possible obstructive low-flow pattern");
  assert.equal(obstructiveFlags[0].durationSec, 12);

  const centralRows = [
    sessionHeader,
    ...Array.from({ length: 20 }, (_, index) => `${index * 1000},8,8,0.1,2.0,40,0.1,40,40,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN`),
    ...Array.from({ length: 10 }, (_, index) => `${(20 + index) * 1000},8,8,0.2,0.02,41,0.2,41,41,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN`),
  ].join("\n");
  const centralFlags = flagSessionObservations(centralRows);
  assert.equal(centralFlags.length, 1);
  assert.equal(centralFlags[0].type, "possible central-like low-flow pattern");

  const noBaselineRows = [
    sessionHeader,
    ...Array.from({ length: 10 }, (_, index) => `${index * 1000},8,8,0.2,0.02,41,0.2,41,41,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN`),
    ...Array.from({ length: 20 }, (_, index) => `${(10 + index) * 1000},8,8,0.1,2.0,40,0.1,40,40,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN`),
  ].join("\n");
  const noBaselineFlags = flagSessionObservations(noBaselineRows);
  assert.equal(noBaselineFlags.length, 1);
  assert.equal(noBaselineFlags[0].type, "indeterminate low-flow pattern");

  const shortRows = [
    sessionHeader,
    ...Array.from({ length: 20 }, (_, index) => `${index * 1000},8,8,0.1,2.0,40,0.1,40,40,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN`),
    ...Array.from({ length: 9 }, (_, index) => `${(20 + index) * 1000},8,8,0.1,0.02,40,0.1,40,40,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN`),
  ].join("\n");
  assert.equal(flagSessionObservations(shortRows).length, 0);

  const liveObservationHeader =
    "ms,setpoint_hPa,pressure_hPa,flow_hPa,vin,mode,measured_cm,error_cm,controller_amp,motor_cmd,motor_fault,motor_i2c,motor_fg_hz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c";
  const liveShortRows = [
    liveObservationHeader,
    ...Array.from({ length: 200 }, (_, index) => `${index * 100},7.85,7.85,2.0,24,2,8,0.1,40,40,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN`),
    ...Array.from({ length: 99 }, (_, index) => `${(200 + index) * 100},7.85,7.85,0.02,24,2,8,0.1,40,40,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN`),
  ].join("\n");
  assert.equal(flagSessionObservations(liveShortRows).length, 0);

  const liveTenSecondRows = [
    liveObservationHeader,
    ...Array.from({ length: 200 }, (_, index) => `${index * 100},7.85,7.85,2.0,24,2,8,0.1,40,40,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN`),
    ...Array.from({ length: 100 }, (_, index) => `${(200 + index) * 100},7.85,7.85,0.02,24,2,8,0.1,40,40,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN`),
  ].join("\n");
  const liveFlags = flagSessionObservations(liveTenSecondRows);
  assert.equal(liveFlags.length, 1);
  assert.equal(liveFlags[0].durationSec, 10);

  console.log("Mobile validation tests passed.");
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
