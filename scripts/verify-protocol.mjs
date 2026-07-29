import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

const firmwareHeader = read("firmware/Rev 2/ozealis/ble.h");
const topReadme = read("README.md");
const safetyDoc = read("SAFETY.md");
const securityDoc = read("SECURITY.md");
const gitAttributes = read(".gitattributes");
const firmwareBle = read("firmware/Rev 2/ozealis/ble.cpp");
const firmwareMain = read("firmware/Rev 2/ozealis/ozealis.ino");
const firmwareOta = read("firmware/Rev 2/ozealis/ota_secure.cpp");
const firmwareDatalog = read("firmware/Rev 2/ozealis/datalog.cpp");
const firmwareLogic = read("firmware/Rev 2/ozealis/logic.cpp");
const firmwareLogicHeader = read("firmware/Rev 2/ozealis/logic.h");
const firmwarePressureLimits = read("firmware/Rev 2/ozealis/pressure_limits.h");
const firmwareDiag = read("firmware/Rev 2/ozealis/diag.cpp");
const firmwareDiagHeader = read("firmware/Rev 2/ozealis/diag.h");
const firmwareAutopap = read("firmware/Rev 2/ozealis/autopap.cpp");
const firmwareAutopapHeader = read("firmware/Rev 2/ozealis/autopap.h");
const firmwareMotorCal = read("firmware/Rev 2/ozealis/motor_calibration.cpp");
const firmwareSensor = read("firmware/Rev 2/ozealis/sensor.cpp");
const firmwareSensorHeader = read("firmware/Rev 2/ozealis/sensor.h");
const firmwareModules = read("firmware/Rev 2/ozealis/modules.cpp");
const firmwareModulesHeader = read("firmware/Rev 2/ozealis/modules.h");
const firmwareOximetry = read("firmware/Rev 2/ozealis/oximetry.cpp");
const firmwareOximetryHeader = read("firmware/Rev 2/ozealis/oximetry.h");
const firmwareBuzzer = read("firmware/Rev 2/ozealis/buzzer.cpp");
const firmwareButton = read("firmware/Rev 2/ozealis/button.cpp");
const firmwareLed = read("firmware/Rev 2/ozealis/led.cpp");
const firmwareMotor = read("firmware/Rev 2/ozealis/motor.cpp");
const firmwareMotorHeader = read("firmware/Rev 2/ozealis/motor.h");
const firmwareReadme = read("firmware/Rev 2/README.md");
const firmwarePlatformio = read("firmware/Rev 2/platformio.ini");
const firmwarePartitions = read("firmware/Rev 2/min_spiffs.csv");
const appProtocol = read("mobile/src/ozealisBle.ts");
const appCsvTransfer = read("mobile/src/csvTransfer.ts");
const appPlxOximetry = read("mobile/src/plxOximetry.ts");
const appValidation = read("mobile/src/validation.ts");
const mobileApp = read("mobile/App.tsx");
const mobileAppJson = read("mobile/app.json");
const mobilePackage = read("mobile/package.json");
const mobilePackageLock = read("mobile/package-lock.json");
const protocolDoc = read("docs/ble-protocol.md");
const mobileDoc = read("docs/mobile-app.md");
const mobileAuditDoc = read("docs/mobile-audit.md");
const mobileAuditBaseline = JSON.parse(read("docs/mobile-audit-baseline.json"));
const motorCalibrationDoc = read("docs/motor-calibration.md");
const rev3MotorDriverDoc = read("docs/rev3-motor-driver.md");
const mcfBringupDoc = read("docs/mcf8316d-bringup.md");
const mcfCommissioningDoc = read("docs/mcf8316d-commissioning.md");
const mcfRegisterManifest = JSON.parse(read("docs/mcf8316d-register-manifest.json"));
const releaseChecklistDoc = read("docs/release-checklist.md");
const ciWorkflow = read(".github/workflows/ci.yml");
const ciRequirements = read("requirements-ci.txt");
const localVerifier = read("scripts/verify-local.mjs");
const mobileAuditSummary = read("scripts/summarize-mobile-audit.mjs");
const repoHygieneVerifier = read("scripts/verify-repo-hygiene.mjs");
const releaseTextVerifier = read("scripts/verify-release-text.mjs");
const docLinksVerifier = read("scripts/verify-doc-links.mjs");
const mobileValidationTests = read("scripts/test-mobile-validation.mjs");
const mobileCsvTransferTests = read("scripts/test-mobile-csv-transfer.mjs");
const mobilePlxOximetryTests = read("scripts/test-mobile-plx-oximetry.mjs");
const activeFirmwareSerialSources = {
  "firmware/Rev 2/ozealis/autopap.cpp": firmwareAutopap,
  "firmware/Rev 2/ozealis/autopap.h": firmwareAutopapHeader,
  "firmware/Rev 2/ozealis/ble.cpp": firmwareBle,
  "firmware/Rev 2/ozealis/ble.h": firmwareHeader,
  "firmware/Rev 2/ozealis/button.cpp": firmwareButton,
  "firmware/Rev 2/ozealis/button.h": read("firmware/Rev 2/ozealis/button.h"),
  "firmware/Rev 2/ozealis/buzzer.cpp": firmwareBuzzer,
  "firmware/Rev 2/ozealis/buzzer.h": read("firmware/Rev 2/ozealis/buzzer.h"),
  "firmware/Rev 2/ozealis/datalog.cpp": firmwareDatalog,
  "firmware/Rev 2/ozealis/datalog.h": read("firmware/Rev 2/ozealis/datalog.h"),
  "firmware/Rev 2/ozealis/diag.cpp": firmwareDiag,
  "firmware/Rev 2/ozealis/diag.h": firmwareDiagHeader,
  "firmware/Rev 2/ozealis/led.cpp": firmwareLed,
  "firmware/Rev 2/ozealis/led.h": read("firmware/Rev 2/ozealis/led.h"),
  "firmware/Rev 2/ozealis/logic.cpp": firmwareLogic,
  "firmware/Rev 2/ozealis/logic.h": firmwareLogicHeader,
  "firmware/Rev 2/ozealis/modules.cpp": firmwareModules,
  "firmware/Rev 2/ozealis/modules.h": firmwareModulesHeader,
  "firmware/Rev 2/ozealis/motor.cpp": firmwareMotor,
  "firmware/Rev 2/ozealis/motor.h": firmwareMotorHeader,
  "firmware/Rev 2/ozealis/motor_calibration.cpp": firmwareMotorCal,
  "firmware/Rev 2/ozealis/motor_calibration.h": read("firmware/Rev 2/ozealis/motor_calibration.h"),
  "firmware/Rev 2/ozealis/ota_secure.cpp": firmwareOta,
  "firmware/Rev 2/ozealis/ota_secure.h": read("firmware/Rev 2/ozealis/ota_secure.h"),
  "firmware/Rev 2/ozealis/ozealis.ino": firmwareMain,
  "firmware/Rev 2/ozealis/pressure_limits.h": firmwarePressureLimits,
  "firmware/Rev 2/ozealis/sensor.cpp": firmwareSensor,
  "firmware/Rev 2/ozealis/sensor.h": firmwareSensorHeader,
};

const expectedServiceUuid = "7f2d5f4a-0f4d-4a1f-9f84-0c2a6b3d0000";
const expectedProtocol = "ozealis-ble-v2";
const characteristics = {
  pressure: "7f2d0001-0f4d-4a1f-9f84-0c2a6b3d0000",
  flow: "7f2d0002-0f4d-4a1f-9f84-0c2a6b3d0000",
  setpoint: "7f2d0003-0f4d-4a1f-9f84-0c2a6b3d0000",
  vin: "7f2d0004-0f4d-4a1f-9f84-0c2a6b3d0000",
  mode: "7f2d0005-0f4d-4a1f-9f84-0c2a6b3d0000",
  ahi: "7f2d0006-0f4d-4a1f-9f84-0c2a6b3d0000",
  otaCommand: "7f2d0007-0f4d-4a1f-9f84-0c2a6b3d0000",
  otaStatus: "7f2d0008-0f4d-4a1f-9f84-0c2a6b3d0000",
  fault: "7f2d0009-0f4d-4a1f-9f84-0c2a6b3d0000",
  humidifierTemp: "7f2d0010-0f4d-4a1f-9f84-0c2a6b3d0000",
  humidifierRh: "7f2d0011-0f4d-4a1f-9f84-0c2a6b3d0000",
  hoseTemp: "7f2d0012-0f4d-4a1f-9f84-0c2a6b3d0000",
  moduleStatus: "7f2d0013-0f4d-4a1f-9f84-0c2a6b3d0000",
  oximetry: "7f2d0014-0f4d-4a1f-9f84-0c2a6b3d0000",
  liveCsv: "7f2d0020-0f4d-4a1f-9f84-0c2a6b3d0000",
  logDownload: "7f2d0021-0f4d-4a1f-9f84-0c2a6b3d0000",
  faultCsv: "7f2d0022-0f4d-4a1f-9f84-0c2a6b3d0000",
  calibrationStatus: "7f2d0030-0f4d-4a1f-9f84-0c2a6b3d0000",
  calibrationCommand: "7f2d0031-0f4d-4a1f-9f84-0c2a6b3d0000",
  mcfParams: "7f2d0032-0f4d-4a1f-9f84-0c2a6b3d0000",
  control: "7f2d00c0-0f4d-4a1f-9f84-0c2a6b3d0000",
  oximetryRelay: "7f2d00d0-0f4d-4a1f-9f84-0c2a6b3d0000",
  settings: "7f2d00f0-0f4d-4a1f-9f84-0c2a6b3d0000",
  protocol: "7f2d00ff-0f4d-4a1f-9f84-0c2a6b3d0000",
};
const appShortCodes = {
  pressure: "0001",
  flow: "0002",
  setpoint: "0003",
  vin: "0004",
  mode: "0005",
  ahi: "0006",
  otaCommand: "0007",
  otaStatus: "0008",
  fault: "0009",
  humidifierTemp: "0010",
  humidifierRh: "0011",
  hoseTemp: "0012",
  moduleStatus: "0013",
  oximetry: "0014",
  liveCsv: "0020",
  logDownload: "0021",
  faultCsv: "0022",
  calibrationStatus: "0030",
  calibrationCommand: "0031",
  mcfParams: "0032",
  control: "00c0",
  oximetryRelay: "00d0",
  settings: "00f0",
  protocol: "00ff",
};
const expectedCsvHeaders = {
  live: "ms,setpoint_hPa,pressure_hPa,flow_hPa,vin,mode,measured_cm,error_cm,controller_amp,motor_cmd,motor_fault,motor_i2c,motor_fg_hz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
  retained: "ms,setpoint_cm,pressure_cmH2O,error_cmH2O,flowProxy_hPa,motorAmp,controller_error_cm,controller_amp,motorCmd,motorFault,motorI2c,motorFgHz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c",
  fault: "ts_ms,sys_mode,fault,vin_V,pMask_hPa,pBlower_hPa,ambient_hPa,diff_hPa,setpoint_cm,flowProxy_hPa,motorAmp,motorCmd,motorFault,motorI2c,motorFgHz,loop_us,miss1,miss2,i2cErr1,i2cErr2",
};

const firmwareMacros = extractFirmwareMacros(firmwareHeader);
const firmwarePlatformioConfig = parseIni(firmwarePlatformio);
const appCharacteristics = extractAppCharacteristics(appProtocol);
const protocolDocCharacteristics = extractProtocolDocCharacteristics(protocolDoc);
const mobilePackageJson = JSON.parse(mobilePackage);
const mobilePackageLockJson = JSON.parse(mobilePackageLock);
const mobileAppConfigJson = JSON.parse(mobileAppJson);
const failures = [];

assertContains("firmware service UUID", firmwareHeader, expectedServiceUuid);
assertFirmwarePlatformioMetadata();
assertContains("app service UUID", appProtocol, expectedServiceUuid);
assertContains("protocol docs service UUID", protocolDoc, expectedServiceUuid);
assertMacro("OZEALIS_PROTOCOL_VERSION", expectedProtocol);
assertContains("firmware protocol characteristic uses macro", firmwareBle, "char_protocol->setValue(OZEALIS_PROTOCOL_VERSION);");
assertContains("mobile expected protocol constant", appProtocol, `OZEALIS_PROTOCOL_VERSION = "${expectedProtocol}"`);
assertContains("mobile protocol compatibility gate", mobileApp, "const protocolCompatible = protocolVersion === OZEALIS_PROTOCOL_VERSION");
assertContains("mobile app error boundary class", mobileApp, "class AppErrorBoundary extends Component");
assertMobileAppMetadata();
assertMobileLockfileMetadata();
assertCiWorkflowPermissions();
assertContains("mobile app error boundary fallback", mobileApp, "App view stopped");
assertContains("mobile app error boundary no command copy", mobileApp, "No device command was sent.");
assertContains("mobile error boundary unmount captures active device", mobileApp, "const activeDevice = connectedDeviceRef.current;");
assertContains("mobile error boundary unmount captures active oximeter", mobileApp, "const activeOximeter = oximeterDeviceRef.current;");
assertContains("mobile error boundary unmount flushes live CSV", mobileApp, "flushLiveSyncCsv();\n      const closeManager");
assertContains("mobile error boundary unmount cancels active connections", mobileApp, "const closeTasks = [activeDevice, activeOximeter]");
assertContains("mobile error boundary unmount waits for active connections", mobileApp, "void Promise.all(closeTasks).finally(closeManager);");
assertContains("mobile error boundary unmount destroys manager after close", mobileApp, "if (managerRef.current === manager) managerRef.current = null;");
assertContains("mobile Bluetooth power loss clears oximeter subscriptions", mobileApp, "cleanupOximeterSubscriptions();\n        resetOximeterSessionState();");
assertContains("mobile Ozealis scan stops oximeter scan", mobileApp, "setScanning(true);\n    stopScan(false);\n    stopOximeterScan();");
assertContains("mobile oximeter scan clears Ozealis scan state", mobileApp, "stopScan(false);\n    setScanning(false);\n    stopOximeterScan(false);");
assertContains("mobile oximeter reconnect cancels previous device", mobileApp, "await manager.cancelDeviceConnection(previousOximeter.id).catch(() => undefined);");
assertContains(
  "mobile oximeter reset helper is session scoped",
  mobileApp,
  "function resetOximeterSessionState(expectedSessionId = oximeterSessionIdRef.current): boolean",
);
assertContains("mobile oximeter latest-only relay", appPlxOximetry, "export class LatestOnlyAsyncRelay<T>");
assertContains("mobile oximeter relay clear-pending helper", appPlxOximetry, "clearPending(): void");
assertContains("mobile oximeter relay idle barrier", appPlxOximetry, "whenIdle(): Promise<void>");
assertContains("mobile oximeter relay captures source session", mobileApp, "oximeterSessionId: sessionId,");
assertContains("mobile oximeter relay captures target device", mobileApp, "ozealisDeviceId: ozealisDevice.id,");
assertContains("mobile oximeter relay captures target session", mobileApp, "ozealisSessionId,");
assertContains(
  "mobile oximeter replacement waits for in-flight relay",
  mobileApp,
  "oximetryRelayRef.current?.clearPending();\n    const previousOximeter",
);
assertContains(
  "mobile oximeter replacement idle barrier",
  mobileApp,
  "await oximetryRelayRef.current?.whenIdle();\n    if (oximeterSessionIdRef.current !== sessionId) return;",
);
assertContains("mobile docs error boundary contract", mobileDoc, "Wrap the app shell in an error boundary");
assertContains("mobile docs error boundary cleanup contract", mobileDoc, "flush the live trace, cancel any active BLE connection, wait for that disconnect attempt to settle before destroying the BLE manager");
assertContains("mobile docs oximeter secondary BLE cleanup", mobileDoc, "app teardown cancels both the active Ozealis device and active oximeter before destroying the BLE manager");
assertContains("mobile write-time protocol recheck helper", mobileApp, "async function confirmProtocolBeforeWrite");
assertContains("mobile protocol connect preload is session scoped", mobileApp, "const nextProtocol = await loadProtocol(discovered, sessionId);");
assertContains("mobile protocol loader carries session identity", mobileApp, "async function loadProtocol(device = connectedDevice, sessionId = deviceSessionIdRef.current): Promise<string>");
assertContains("mobile protocol stale session readback discarded", mobileApp, "if (!isCurrentDeviceSession(device, sessionId)) return \"unknown\";");
assertContains("mobile protocol stale session failure discarded", mobileApp, "catch {\n      if (!isCurrentDeviceSession(device, sessionId)) return \"unknown\";");
assertContains("mobile write-time protocol reread", mobileApp, "const nextProtocol = await loadProtocol(device)");
assertContains("mobile write-time protocol stale alert suppressed", mobileApp, "if (!isCurrentConnectedDevice(device)) return false;\n    if (nextProtocol === OZEALIS_PROTOCOL_VERSION) return true;");
assertContains("mobile captured-device write guard", mobileApp, "const writeDevice = connectedDevice;");
assertContains("mobile captured-device stale readback fails closed", mobileApp, "if (!isCurrentConnectedDevice(device)) return false;");
assertContains("mobile docs protocol stale readback discard", mobileDoc, "Protocol refreshes discard stale readbacks and stale read failures if the active connected session changes before the read returns");
assertContains("mobile docs delayed writes capture device", mobileDoc, "Delayed confirmation callbacks for destructive or motor-moving writes must capture the intended connected device");
assertContains("mobile docs delayed writes suppress stale failures", mobileDoc, "suppress stale failure messages");
assertContains("protocol docs version", protocolDoc, expectedProtocol);
assertContains("protocol docs compatibility gate", protocolDoc, "compatibility gate");

for (const [name, uuid] of Object.entries(characteristics)) {
  assertAppCharacteristic(name, appShortCodes[name]);
  assertContains(`protocol docs ${name} UUID`, protocolDoc, uuid);
}

assertMacro("UUID_CpapService", expectedServiceUuid);
assertMacro("UUID_CHAR_PRESSURE", characteristics.pressure);
assertMacro("UUID_CHAR_FLOW", characteristics.flow);
assertMacro("UUID_CHAR_SETPOINT", characteristics.setpoint);
assertMacro("UUID_CHAR_VIN", characteristics.vin);
assertMacro("UUID_CHAR_MODE", characteristics.mode);
assertMacro("UUID_CHAR_AHI", characteristics.ahi);
assertContains("protocol docs AHI slot renamed", protocolDoc, "Low-flow index, legacy AHI slot");
assertContains("protocol docs legacy AHI compatibility", protocolDoc, "keeps its legacy firmware/app key name for compatibility");
assertContains("protocol docs AHI non-diagnostic boundary", protocolDoc, "non-diagnostic low-flow index rather than a clinical AHI value");
assertMacro("UUID_CHAR_OTA_CMD", characteristics.otaCommand);
assertMacro("UUID_CHAR_OTA_ST", characteristics.otaStatus);
assertMacro("UUID_CHAR_FAULT", characteristics.fault);
assertMacro("UUID_CHAR_HUM_TEMP", characteristics.humidifierTemp);
assertMacro("UUID_CHAR_HUM_RH", characteristics.humidifierRh);
assertMacro("UUID_CHAR_HOSE_TEMP", characteristics.hoseTemp);
assertMacro("UUID_CHAR_MOD_STATUS", characteristics.moduleStatus);
assertMacro("UUID_CHAR_OXIMETRY", characteristics.oximetry);
assertMacro("UUID_CHAR_LIVECSV", characteristics.liveCsv);
assertMacro("UUID_CHAR_LOGDL", characteristics.logDownload);
assertMacro("UUID_CHAR_FAULTCSV", characteristics.faultCsv);
assertMacro("UUID_CHAR_CAL_STATUS", characteristics.calibrationStatus);
assertMacro("UUID_CHAR_CAL_CMD", characteristics.calibrationCommand);
assertMacro("UUID_CHAR_MCF_PARAMS", characteristics.mcfParams);
assertMacro("UUID_CHAR_CONTROL", characteristics.control);
assertMacro("UUID_CHAR_OXIMETRY_RELAY", characteristics.oximetryRelay);
assertMacro("UUID_CHAR_SETTINGS_RW", characteristics.settings);
assertMacro("UUID_CHAR_PROTOCOL", characteristics.protocol);
assertProtocolDocCharacteristicTable();

assertContains("firmware BLE security setup", firmwareBle, "configureBleSecurity();");
assertContains("firmware BLE secure-connections bond mode", firmwareBle, "ESP_LE_AUTH_REQ_SC_BOND");
assertContains("firmware BLE complete service handle budget", firmwareBle, "OZEALIS_SERVICE_HANDLE_BUDGET = 72");
assertContains("firmware BLE service uses explicit handle budget", firmwareBle, "BLEUUID(UUID_CpapService),\n    OZEALIS_SERVICE_HANDLE_BUDGET");
assertContains("firmware BLE notification CCCD helper", firmwareBle, "static void addNotificationCccd(BLECharacteristic* characteristic, bool encrypted = false)");
assertContains("firmware BLE encrypted notification CCCD permissions", firmwareBle, "descriptor->setAccessPermissions(ESP_GATT_PERM_READ_ENCRYPTED | ESP_GATT_PERM_WRITE_ENCRYPTED);");
assertOccurrenceCount("firmware BLE every notify characteristic has a CCCD", firmwareBle, "addNotificationCccd(char_", 15);
assertContains("firmware BLE encrypted oximetry CCCD", firmwareBle, "addNotificationCccd(char_oximetry, true);");
assertContains("firmware BLE encrypted calibration status CCCD", firmwareBle, "addNotificationCccd(char_calStatus, true);");
assertContains("firmware BLE encrypted OTA status CCCD", firmwareBle, "addNotificationCccd(char_otaSt, true);");
assertContains("protocol docs BLE service handle budget", protocolDoc, "reserves enough GATT handles for the complete project service");
assertContains("protocol docs BLE notification CCCDs", protocolDoc, "Client Characteristic Configuration descriptor (`0x2902`) to every notifying characteristic");
assertContains("firmware recursive control mutex creation", firmwareLogic, "xSemaphoreCreateRecursiveMutex()");
assertContains("firmware control mutex take is recursive", firmwareLogic, "xSemaphoreTakeRecursive(systemControlMutex, portMAX_DELAY)");
assertContains("firmware control mutex release is recursive", firmwareLogic, "xSemaphoreGiveRecursive(systemControlMutex)");
assertContains("firmware control guard type", firmwareLogicHeader, "class SystemControlGuard");
assertOrder("firmware initializes control mutex before BLE", firmwareMain, "systemControlInit();", "startBLE();");
assertContains("firmware main loop holds control guard", firmwareMain, "SystemControlGuard controlGuard;\n    runMainLogic();\n    pollButton();");
assertOccurrenceCount("firmware every BLE callback method holds control guard", firmwareBle, "SystemControlGuard controlGuard;", 12);
for (const callbackClass of [
  "CsvTransferCallback",
  "McfParamsReadCallback",
  "OximetryReadCallback",
  "MyServerCallbacks",
  "SettingsCallback",
  "OtaStatusReadCallback",
  "OtaCmdCallback",
  "ControlCallback",
  "OximetryRelayCallback",
  "CalibrationStatusCallback",
  "CalibrationCommandCallback",
]) {
  assertFirmwareCallbackUsesControlGuard(callbackClass);
}
assertContains("protocol docs BLE task serialization", protocolDoc, "serializes the complete main control/button pass and every BLE callback");
assertContains("firmware README BLE task serialization", firmwareReadme, "serialized by one recursive FreeRTOS control mutex initialized before BLE startup");
assertContains("release checklist BLE task serialization", releaseChecklistDoc, "Firmware BLE/main-loop serialization verified under concurrent read/write stress");
assertContains("firmware BLE connect clears advertising timeout flag", firmwareBle, "bleActive = false;\n    ledTogglePairingWave(false);");
assertContains("firmware BLE connect restores current status color", firmwareBle, "ledTogglePairingWave(false);   // stop when phone connects\n    refreshSystemStatusLed();");
assertContains("firmware BLE disconnect clears advertising timeout flag", firmwareBle, "bleConnected = false;\n    bleActive = false;");
assertCsvTransferConnectionReset();
assertContains("firmware BLE disconnect restarts saved advertising window", firmwareBle, "if (settings.bleAdvertise) {\n      BLEAdvertising* adv = BLEDevice::getAdvertising();");
assertContains("firmware BLE disconnect rearms timeout flag", firmwareBle, "adv->start();\n        bleStartTime = millis();\n        bleActive = true;");
assertContains("firmware BLE first advertising start arms timeout flag", firmwareBle, "bleStartTime = millis();\n  bleActive = true;\n  BLE_LOG(\"BLE advertising started\");");
assertContains("firmware boot applies saved BLE advertising preference", firmwareMain, "startBLE();");
assertOrder("firmware boot initializes PAP before applying saved mode", firmwareMain, "papBegin(settingsToPapLimits());", "papSetMode(settings.mode);");
assertOrder("firmware boot applies saved mode before BLE startup", firmwareMain, "papSetMode(settings.mode);", "startBLE();");
assertContains("firmware README saved therapy mode boot application", firmwareReadme, "boot also applies the sanitized saved therapy mode through `papSetMode(settings.mode)` before BLE can accept control writes");
assertContains("firmware BLE boot respects disabled preference", firmwareBle, "if (!forceAdvertising && !settings.bleAdvertise)");
assertContains("firmware temporary BLE initializes without preference mutation", firmwareBle, "startBleStack(true);");
assertAbsent("firmware temporary BLE does not force live saved preference", firmwareBle, "settings.bleAdvertise = true");
assertContains("protocol docs saved BLE boot behavior", protocolDoc, "When `bleAdv=true`, boot initializes the BLE stack");
assertContains("firmware BLE advertising timeout excludes connected sessions", firmwareLogic, "bleActive && !bleConnected && millis() - bleStartTime > BLE_TIMEOUT_MS");
assertContains("firmware BLE advertising timeout stops pairing wave", firmwareLogic, "BLEDevice::getAdvertising()->stop();\n    bleActive = false;\n    ledTogglePairingWave(false);");
assertContains("firmware BLE advertising timeout restores status color", firmwareLogic, "ledTogglePairingWave(false);   // stop animation\n    refreshSystemStatusLed();");
assertAbsent("firmware BLE advertising timeout must not force idle", firmwareLogic, "ledTogglePairingWave(false);   // stop animation\n    enterMode(MODE_IDLE);");
assertContains("firmware BLE serial log opt-in flag", firmwareBle, "OZEALIS_BLE_SERIAL_LOG 0");
assertContains("firmware BLE serial log macro gated", firmwareBle, "#if OZEALIS_BLE_SERIAL_LOG");
assertOccurrenceCount("firmware BLE direct Serial.println limited to opt-in macro", firmwareBle, "Serial.println(", 1);
assertContains("firmware logic serial log opt-in flag", firmwareLogic, "OZEALIS_LOGIC_SERIAL_LOG 0");
assertContains("firmware logic serial log macro gated", firmwareLogic, "#if OZEALIS_LOGIC_SERIAL_LOG");
assertOccurrenceCount("firmware logic direct Serial.println limited to opt-in macro", firmwareLogic, "Serial.println(", 1);
assertAbsent("firmware BLE stale scaffolding comment removed", firmwareBle, "// add near the top of ble.cpp");
assertOccurrenceCount("firmware flow telemetry notifies once per stream update", firmwareBle, "char_flow->notify();", 1);
assertContains("firmware encrypted settings permissions", firmwareBle, "requireEncryptedReadWrite(char_settings);");
assertContains("firmware encrypted OTA command permissions", firmwareBle, "requireEncryptedWrite(char_otaCmd);");
assertContains("firmware encrypted control permissions", firmwareBle, "requireEncryptedWrite(char_control);");
assertContains("firmware encrypted session log permissions", firmwareBle, "requireEncryptedReadWrite(char_logDl);");
assertContains("firmware encrypted fault log permissions", firmwareBle, "requireEncryptedReadWrite(char_faultCsv);");
assertContains("firmware retained transfer local MTU", firmwareBle, "BLEDevice::setMTU(517);");
assertContains("firmware retained transfer raw page bound", firmwareBle, "CSV_TRANSFER_RAW_PAGE_BYTES = 288");
assertContains("firmware retained transfer total bound", firmwareBle, "CSV_TRANSFER_MAX_TOTAL_BYTES = 512000");
assertContains("firmware retained transfer response bound", firmwareBle, "CSV_TRANSFER_MAX_RESPONSE_BYTES = 500");
assertContains("firmware retained transfer session callback", firmwareBle, "new CsvTransferCallback(CsvTransferSource::Session)");
assertContains("firmware retained transfer fault callback", firmwareBle, "new CsvTransferCallback(CsvTransferSource::Fault)");
assertContains("firmware retained transfer settled-mode gate", firmwareBle, "(currentMode == MODE_IDLE || currentMode == MODE_FAULT)");
assertContains("firmware retained transfer calibration gate", firmwareBle, "!motorCalIsActive()");
assertContains("firmware retained transfer OTA gate", firmwareBle, "!otaSecure_inProgress()");
assertContains("firmware retained transfer exact first request schema", firmwareBle, "object.size() != 1 || object.containsKey(\"generation\")");
assertContains("firmware retained transfer exact continuation schema", firmwareBle, "object.size() != 2 || !object.containsKey(\"generation\")");
assertContains("firmware retained transfer sequential offset", firmwareBle, "requestedOffset != transferred_");
assertContains("firmware retained transfer snapshots generation", firmwareBle, "snapshotGeneration_ = sourceGeneration();");
assertContains("firmware retained transfer rechecks generation", firmwareBle, "sourceGeneration() != snapshotGeneration_");
assertContains("firmware retained transfer base64 encoding", firmwareBle, "mbedtls_base64_encode");
assertContains("firmware retained transfer base64 buffer includes terminator", firmwareBle, "unsigned char encoded[((CSV_TRANSFER_RAW_PAGE_BYTES + 2) / 3) * 4 + 1];");
assertContains("firmware retained transfer passes complete base64 capacity", firmwareBle, "mbedtls_base64_encode(encoded, sizeof(encoded), &encodedLength,");
assertAbsent("firmware retained transfer does not remove terminator capacity", firmwareBle, "mbedtls_base64_encode(encoded, sizeof(encoded) - 1");
assertContains("protocol docs retained full-page base64 capacity", protocolDoc, "384 encoded bytes plus the terminating NUL");
assertContains("firmware retained transfer response metadata", firmwareBle, "\\\"ok\\\":true,\\\"generation\\\":%lu,\\\"offset\\\":%lu,\\\"total\\\":%lu");
assertContains("firmware retained transfer response hash", firmwareBle, "\\\"hash\\\":\\\"%08lx\\\",\\\"data\\\":\\\"%s\\\"");
assertContains("firmware retained transfer cursor reset", firmwareBle, "beginSourceRead();");
assertContains("firmware retained transfer reset helper", firmwareBle, "void resetSnapshot()");
assertContains("firmware retained transfer disconnect resets session snapshot", firmwareBle, "sessionCsvTransferCallback->resetSnapshot();");
assertContains("firmware retained transfer disconnect resets fault snapshot", firmwareBle, "faultCsvTransferCallback->resetSnapshot();");
assertMinimumOccurrences("firmware retained transfer connect/disconnect reset coverage", firmwareBle, "publishCsvTransferError(char_logDl, \"request_required\");", 3);
assertContains("firmware retained session compact typed row", firmwareDatalog, "struct DatalogSample");
assertContains("firmware retained session 30-minute capacity", firmwareDatalog, "DATALOG_CAPACITY = 1800");
assertContains("firmware retained session heap allocation", firmwareDatalog, "calloc(DATALOG_CAPACITY, sizeof(DatalogSample))");
assertContains("firmware retained session allocates before BLE", firmwareMain, "loadSettings();\n  dl_init();\n  otaSecure_begin();");
assertAbsent("firmware retained session no String ring", firmwareDatalog, "CircularBuffer<String");
assertAbsent("firmware retained session no full CSV materializer", firmwareBle, "dl_getCsv");
assertAbsent("firmware retained fault no full CSV materializer", firmwareBle, "diag_fault_csv()");
assertContains("firmware retained session cursor reads forward", firmwareDatalog, "dl_readNextCsvChunk(DatalogCsvCursor& cursor");
assertContains("firmware retained fault cursor reads forward", firmwareDiag, "diag_read_next_fault_csv_chunk(FaultCsvCursor& cursor");
assertContains("mobile retained transfer assembler export", appProtocol, "CsvTransferAssembler");
assertContains("mobile retained transfer device adapter", appProtocol, "return readCsvTransferWithTransport({");
assertContains("mobile retained transfer device write adapter", appProtocol, "writeRequest: (request) => writeUtf8(device, characteristicUuid, request)");
assertContains("mobile retained transfer device read adapter", appProtocol, "readResponse: () => readUtf8(device, characteristicUuid)");
assertContains("mobile retained transfer helper loop", appCsvTransfer, "for (let page = 0; page < CSV_TRANSFER_MAX_PAGES; page += 1)");
assertContains("mobile retained transfer writes request before read", appCsvTransfer, "await transport.writeRequest(transfer.requestJson());");
assertContains("mobile retained transfer reads response", appCsvTransfer, "const response = await transport.readResponse();");
assertContains("mobile retained transfer raw page bound", appCsvTransfer, "CSV_TRANSFER_RAW_PAGE_BYTES = 288");
assertContains("mobile retained transfer total bound", appCsvTransfer, "CSV_TRANSFER_MAX_BYTES = 512_000");
assertContains("mobile retained transfer page-count bound", appCsvTransfer, "CSV_TRANSFER_MAX_PAGES = 2_048");
assertContains("mobile retained transfer response bound", appCsvTransfer, "CSV_TRANSFER_MAX_RESPONSE_CHARS = 500");
assertContains("mobile retained transfer requested MTU", appCsvTransfer, "CSV_TRANSFER_REQUESTED_MTU = 517");
assertContains("mobile retained transfer ATT overhead", appCsvTransfer, "CSV_TRANSFER_ATT_OVERHEAD_BYTES = 3");
assertContains("mobile retained transfer MTU capacity helper", appCsvTransfer, "csvTransferMtuCanCarryMaxResponse");
assertContains("mobile retained transfer exact schema", appCsvTransfer, "const expectedKeys = [\"data\", \"generation\", \"hash\", \"offset\", \"ok\", \"total\"]");
assertContains("mobile retained transfer canonical base64 check", appCsvTransfer, "decoded.toString(\"base64\") !== value");
assertContains("mobile retained transfer ASCII check", appCsvTransfer, "byte !== 0x0a && (byte < 0x20 || byte > 0x7e)");
assertContains("mobile retained transfer stable snapshot metadata", appCsvTransfer, "response.generation !== this.generation");
assertContains("mobile retained transfer exact page offset", appCsvTransfer, "response.offset !== this.offset");
assertContains("mobile retained transfer FNV multiply", appCsvTransfer, "Math.imul(next ^ byte, 0x01000193)");
assertContains("mobile retained transfer final integrity check", appCsvTransfer, "CSV transfer integrity check failed.");
assertContains("mobile retained transfer Android MTU request", mobileApp, "connected.requestMTU(517)");
assertContains("mobile retained transfer settled read gate", mobileApp, "(telemetry.mode === \"0\" || telemetry.mode === \"4\")");
assertContains("mobile retained transfer session file first", mobileApp, "readCsvTransfer(readDevice, OZEALIS_CHARACTERISTICS.logDownload)");
assertContains("mobile retained transfer fault file second", mobileApp, "readCsvTransfer(readDevice, OZEALIS_CHARACTERISTICS.faultCsv)");
assertOrder(
  "mobile retained transfer files are sequential",
  mobileApp,
  "readCsvTransfer(readDevice, OZEALIS_CHARACTERISTICS.logDownload)",
  "readCsvTransfer(readDevice, OZEALIS_CHARACTERISTICS.faultCsv)",
);
assertContains("mobile retained transfer test multi-page loop", mobileCsvTransferTests, "while (offset < bytes.length)");
assertContains("mobile retained transfer test transport loop", mobileCsvTransferTests, "readCsvTransferWithTransport(transport)");
assertContains("mobile retained transfer test mock Device adapter loop", mobileCsvTransferTests, "readCsvTransfer(mockDevice, characteristicUuid)");
assertContains("mobile retained transfer test mock Device GATT write", mobileCsvTransferTests, "writeCharacteristicWithResponseForService");
assertContains("mobile retained transfer test mock Device GATT read", mobileCsvTransferTests, "readCharacteristicForService");
assertContains("mobile retained transfer test exact continuation requests", mobileCsvTransferTests, "transportRequests.slice(1).forEach");
assertContains("mobile retained transfer test MTU success", mobileCsvTransferTests, "csvTransferMtuCanCarryMaxResponse(CSV_TRANSFER_REQUESTED_MTU)");
assertContains("mobile retained transfer test insufficient MTU", mobileCsvTransferTests, "csvTransferMtuCanCarryMaxResponse(502)");
assertContains("mobile retained transfer test rejection propagation", mobileCsvTransferTests, "/rejected by device: snapshot_changed/");
assertContains("mobile retained transfer test reconnect starts zero", mobileCsvTransferTests, "reconnectRequests[reconnectStartIndex], \"{\\\"offset\\\":0}\"");
assertContains("mobile retained transfer test rejects changed snapshot", mobileCsvTransferTests, "/snapshot changed/");
assertContains("mobile retained transfer test rejects corrupt hash", mobileCsvTransferTests, "/integrity check failed/");
assertContains("protocol docs retained transfer v2", protocolDoc, "Protocol v2 transfers retained session and fault CSV");
assertContains("protocol docs retained transfer integrity", protocolDoc, "recomputes the FNV-1a hash");
assertContains("mobile docs retained transfer integrity", mobileDoc, "verify the final FNV-1a hash");
assertContains("release checklist protocol-v2 multi-page hardware test", releaseChecklistDoc, "enough retained rows to require multiple 288-byte pages");
assertContains("release checklist protocol-v2 insufficient MTU test", releaseChecklistDoc, "a deliberately insufficient MTU fails closed");
assertContains("release checklist protocol-v2 reconnect reset test", releaseChecklistDoc, "both connect and disconnect reset both firmware transfer cursors to `request_required` so reconnect starts at offset zero");
assertContains("firmware encrypted calibration status permissions", firmwareBle, "requireEncryptedRead(char_calStatus);");
assertContains("firmware encrypted calibration command permissions", firmwareBle, "requireEncryptedWrite(char_calCmd);");
assertContains("firmware encrypted MCF snapshot permissions", firmwareBle, "requireEncryptedRead(char_mcfParams);");
assertContains("firmware encrypted oximetry read permissions", firmwareBle, "requireEncryptedRead(char_oximetry);");
assertContains("firmware encrypted oximetry relay permissions", firmwareBle, "requireEncryptedWrite(char_oxRelay);");
assertContains("firmware oximetry relay bounded SpO2", firmwareBle, "spo2 < 50.0f || spo2 > 100.0f");
assertContains("firmware oximetry relay bounded pulse", firmwareBle, "pulse < 20.0f || pulse > 250.0f");
assertContains("firmware wired oximetry accessory address", firmwareOximetryHeader, "#define ADDR_OXIMETER 0x46");
assertContains("firmware wired oximetry wins over BLE relay", firmwareOximetry, "current.source == OX_SOURCE_I2C");
assertContains("firmware oximetry stale expiry", firmwareOximetry, "OX_STALE_MS = 10000");
assertContains("mobile standard PLX service UUID", appProtocol, "PLX_SERVICE_UUID = \"00001822-0000-1000-8000-00805f9b34fb\"");
assertContains("mobile standard PLX continuous measurement UUID", appProtocol, "PLX_CONTINUOUS_MEASUREMENT_UUID = \"00002a5f-0000-1000-8000-00805f9b34fb\"");
assertContains("mobile PLX parser re-export", appProtocol, "parsePlxContinuousMeasurement");
assertContains("mobile pure PLX SFLOAT decoder", appPlxOximetry, "decodeBluetoothSfloat");
assertContains("mobile PLX parser bounds SpO2", appPlxOximetry, "spo2 < 50 || spo2 > 100");
assertContains("mobile PLX parser bounds pulse", appPlxOximetry, "pulse < 20 || pulse > 250");
assertContains("mobile PLX parser reports unknown quality", appPlxOximetry, "quality: 0");
assertContains("mobile PLX parser tests normal SFLOAT", mobilePlxOximetryTests, "decodeBluetoothSfloat(sfloat(975, -1))");
assertContains("mobile PLX parser tests unknown quality", mobilePlxOximetryTests, "quality: 0");
assertContains("mobile oximetry relay write", mobileApp, "OZEALIS_CHARACTERISTICS.oximetryRelay");
assertContains("mobile oximetry relay reads current protocol ref", mobileApp, "protocolVersionRef.current");
assertContains("mobile oximetry relay requires compatible device session", mobileApp, "isCompatibleDeviceSession(");
assertContains("mobile oximetry relay protocol ref resets for new connection", mobileApp, "protocolVersionRef.current = \"unknown\";");
assertContains("mobile oximetry graph SpO2", mobileApp, "label={advanced ? \"SpO2\" : \"Oxygen\"}");
assertContains("mobile oximetry graph pulse", mobileApp, "label=\"Pulse\"");
assertContains("mobile Builder humidity graph", mobileApp, "label=\"Humidity\"");
assertContains("mobile Builder air temperature graph", mobileApp, "label=\"Air temperature\"");
assertContains("mobile Builder hose temperature graph", mobileApp, "label=\"Hose temperature\"");
assertContains("mobile oximetry triplet validator", appValidation, "function validOximetryCsvTriplet");
assertContains("mobile environment triplet validator", appValidation, "function validEnvironmentCsvTriplet");
assertContains("mobile oximetry absent source must be zero", appValidation, "return !spo2Present && !pulsePresent && source === 0;");
assertContains("protocol docs oximetry source consistency", protocolDoc, "A row may use `oximeter_source=1` or `2` only when both SpO2 and pulse fields are finite and in range");
assertContains("protocol docs environment NAN absence", protocolDoc, "Optional humidifier and heated-hose environment absence is encoded as `NAN,NAN,NAN`");
assertContains("mobile docs Builder environment graphs", mobileDoc, "graph validated humidifier RH, humidifier air temperature, and heated-hose temperature");
assertContains("protocol docs security section", protocolDoc, "## Security expectations");
assertContains("protocol docs Just Works caveat", protocolDoc, "Just Works");
assertContains("protocol docs table OTA command encrypted", protocolDoc, "| OTA command | `0007` | `7f2d0007-0f4d-4a1f-9f84-0c2a6b3d0000` | encrypted write |");
assertContains("protocol docs table session log encrypted", protocolDoc, "| Session log | `0021` | `7f2d0021-0f4d-4a1f-9f84-0c2a6b3d0000` | encrypted read/write |");
assertContains("protocol docs table fault CSV encrypted", protocolDoc, "| Fault CSV | `0022` | `7f2d0022-0f4d-4a1f-9f84-0c2a6b3d0000` | encrypted read/write |");
assertContains("protocol docs table calibration status encrypted", protocolDoc, "| Motor calibration status | `0030` | `7f2d0030-0f4d-4a1f-9f84-0c2a6b3d0000` | encrypted read + notify |");
assertContains("protocol docs table calibration command encrypted", protocolDoc, "| Motor calibration command | `0031` | `7f2d0031-0f4d-4a1f-9f84-0c2a6b3d0000` | encrypted write |");
assertContains("protocol docs table MCF snapshot encrypted", protocolDoc, "| MCF8316D parameter snapshot | `0032` | `7f2d0032-0f4d-4a1f-9f84-0c2a6b3d0000` | encrypted read |");
assertContains("protocol docs MCF snapshot not placeholder", protocolDoc, "read-only commissioning snapshot JSON");
assertContains("mobile docs MCF snapshot not placeholder", mobileDoc, "encrypted read-only MCF8316D commissioning snapshot");
assertAbsent("protocol docs MCF snapshot placeholder", protocolDoc, "JSON readback/export placeholder");
assertAbsent("mobile docs MCF snapshot placeholder", mobileDoc, "parameter snapshot placeholder");
assertContains("protocol docs table control encrypted", protocolDoc, "| Control command | `00C0` | `7f2d00c0-0f4d-4a1f-9f84-0c2a6b3d0000` | encrypted write |");
assertContains("protocol docs table settings encrypted", protocolDoc, "| Settings | `00F0` | `7f2d00f0-0f4d-4a1f-9f84-0c2a6b3d0000` | encrypted read/write |");
assertContains("protocol docs OTA status encrypted list item", protocolDoc, "`0008` OTA status: encrypted read");
assertContains("protocol docs MCF snapshot encrypted list item", protocolDoc, "`0032` MCF8316D parameter snapshot: encrypted read");
assertContains("mobile docs encrypted sensitive surface summary", mobileDoc, "settings, control/start-stop, OTA command/status, session and fault logs, motor-calibration status/command, and MCF8316D parameter snapshots as encrypted");
assertContains("security docs encrypted sensitive surface summary", read("SECURITY.md"), "settings, control/start-stop, OTA command/status, session and fault logs, motor-calibration status/command, and MCF8316D parameter snapshots");
assertContains("firmware OTA URL scheme guard", firmwareOta, "isSupportedOtaUrl(url)");
assertContains("firmware OTA http support", firmwareOta, "\"http://\"");
assertContains("firmware OTA https support", firmwareOta, "\"https://\"");
assertContains("firmware OTA URL rejects empty host/authority", firmwareOta, "if (*body == '\\0' || *body == '/' || *body == '?' || *body == '#') return false;");
assertContains("firmware OTA URL rejects whitespace and control bytes", firmwareOta, "const unsigned char c = (unsigned char)*p;\n    if (c <= 0x20 || c == 0x7f) return false;");
assertContains("firmware OTA retry after failure", firmwareOta, "status == OTA_START || status == OTA_PROG");
assertContains("firmware OTA keeps reboot-pending OK interlocked", firmwareOta, "status == OTA_PROG || status == OTA_OK");
assertContains("firmware OTA background task", firmwareOta, "xTaskCreate(otaWorker, \"otaSecure\"");
assertContains("firmware OTA command copies fields before async work", firmwareOta, "copyField(pendingUrl, sizeof(pendingUrl), url)");
assertContains("firmware OTA pending credential clear helper", firmwareOta, "static void clearPendingOtaCredentials()");
assertContains("firmware OTA clears pending credentials after worker copy", firmwareOta, "strlcpy(url, pendingUrl, sizeof(url));\n  clearPendingOtaCredentials();");
assertContains("firmware OTA clears local password after WiFi attempt", firmwareOta, "memset(pwd, 0, sizeof(pwd));");
assertContains("firmware OTA clears pending credentials on copy failure", firmwareOta, "clearPendingOtaCredentials();\n    setStatus(OTA_ERR);");
assertContains("firmware OTA rejected command preserves in-progress status", firmwareOta, "if (otaSecure_inProgress()) return;");
assertContains("firmware OTA exposes global busy interlock", read("firmware/Rev 2/ozealis/ota_secure.h"), "bool otaSecure_inProgress();");
assertContains("firmware OTA busy stops PAP session", firmwareLogic, "if (papSessionActive()) papStopSession();");
assertContains("firmware OTA busy disables running motor", firmwareLogic, "if (motorIsRunning()) motorSetDriveEnabled(false);");
assertContains("firmware OTA busy blocks physical start", firmwareButton, "BUTTON_START_IGNORED_OTA");
assertContains("protocol docs OTA firmware-wide interlock", protocolDoc, "a firmware-wide busy interlock keeps the PAP session and motor disabled");
assertContains("firmware OTA WiFi cleanup on connection failure", firmwareOta, "WiFi.disconnect(true);\n    WiFi.mode(WIFI_OFF);\n    setStatus(OTA_ERR);");
assertContains("firmware OTA rejected command status helper", firmwareOta, "void otaSecure_markError()");
assertContains("firmware OTA status read characteristic", firmwareBle, "BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY");
assertContains("firmware OTA status encrypted read", firmwareBle, "requireEncryptedRead(char_otaSt);");
assertContains("firmware OTA status read callback", firmwareBle, "class OtaStatusReadCallback");
assertContains("firmware OTA status read publisher", firmwareBle, "publishOtaStatus(false)");
assertContains("firmware OTA status bounded progress format", firmwareBle, "snprintf(buf, sizeof(buf), \"%u%%\", (unsigned)otaSecure_progress());");
assertAbsent("firmware BLE avoids unbounded sprintf", firmwareBle, "sprintf(");
assertContains("firmware OTA malformed JSON marks ERR", firmwareBle, "BLE OTA JSON parse error");
assertContains("firmware OTA malformed JSON notifies ERR", firmwareBle, "otaSecure_markError();\n      publishOtaStatus(true);\n      BLE_LOG(\"BLE OTA JSON parse error\");");
assertContains("firmware OTA outside idle notifies ERR", firmwareBle, "otaSecure_markError();\n      publishOtaStatus(true);\n      BLE_LOG(\"BLE OTA ignored outside idle\");");
assertContains("firmware OTA command JSON buffer", firmwareBle, "DynamicJsonDocument d(512)");
assertContains("firmware OTA missing fields marks ERR", firmwareBle, "BLE OTA missing fields");
assertContains("firmware OTA missing fields notifies ERR", firmwareBle, "otaSecure_markError();\n      publishOtaStatus(true);\n      BLE_LOG(\"BLE OTA missing fields\");");
assertContains("firmware JSON root object helper", firmwareBle, "static bool jsonRootObject(JsonDocument& doc)");
assertContains("firmware OTA rejects non-object JSON roots", firmwareBle, "BLE OTA JSON root not object");
assertContains("firmware OTA non-empty string helper", firmwareBle, "static const char* jsonNonEmptyString");
assertContains("firmware OTA SSID strict string parse", firmwareBle, "const char* ss = jsonNonEmptyString(d, \"ssid\")");
assertContains("firmware OTA URL strict string parse", firmwareBle, "const char* url = jsonNonEmptyString(d, \"url\")");
assertContains("firmware OTA idle and fault guard", firmwareBle, "currentMode != MODE_IDLE || currentFault != FAULT_NONE || motorCalIsActive()");
assertContains("firmware OTA trigger publishes resulting status", firmwareBle, "otaSecure_trigger(ss, pw, url);\n    publishOtaStatus(true);");
assertContains("mobile OTA URL guard re-export", appProtocol, "isSupportedOtaUrl,");
assertContains("mobile validation OTA URL scheme guard", appValidation, "isSupportedOtaUrl(value: string)");
assertContains("mobile validation OTA URL rejects padding, controls, and empty authority", appValidation, "value === value.trim() && /^https?:\\/\\/[^/?#\\s\\x00-\\x1f\\x7f]+[^\\s\\x00-\\x1f\\x7f]*$/.test(value)");
assertContains("mobile validation OTA uppercase HTTPS test", mobileValidationTests, "assert.equal(isSupportedOtaUrl(\"HTTPS://example.test/firmware.bin\"), false);");
assertContains("mobile validation OTA mixed-case HTTP test", mobileValidationTests, "assert.equal(isSupportedOtaUrl(\"Http://192.168.4.2/firmware.bin\"), false);");
assertContains("mobile validation OTA empty HTTPS body test", mobileValidationTests, "assert.equal(isSupportedOtaUrl(\"https://\"), false);");
assertContains("mobile validation OTA empty HTTP body test", mobileValidationTests, "assert.equal(isSupportedOtaUrl(\"http://\"), false);");
assertContains("mobile validation OTA bare host test", mobileValidationTests, "assert.equal(isSupportedOtaUrl(\"https://example.test\"), true);");
assertContains("mobile validation OTA hostless path test", mobileValidationTests, "assert.equal(isSupportedOtaUrl(\"https:///firmware.bin\"), false);");
assertContains("mobile validation OTA hostless query test", mobileValidationTests, "assert.equal(isSupportedOtaUrl(\"http://?url=firmware.bin\"), false);");
assertContains("mobile validation OTA hostless fragment test", mobileValidationTests, "assert.equal(isSupportedOtaUrl(\"http://#firmware.bin\"), false);");
assertContains("mobile validation OTA in-progress helper", appValidation, "isOtaStatusInProgress(raw: string)");
assertContains("mobile validation OTA exact status text", appValidation, "if (raw !== raw.trim()) return \"unknown\";");
assertContains("mobile validation OTA exact progress format", appValidation, "const match = /^(0|[1-9]\\d?|100)%$/.exec(raw);");
assertContains("mobile validation OTA padded status tests", mobileValidationTests, "assert.equal(parseOtaStatus(\" START \"), \"unknown\");");
assertContains("mobile validation OTA padded progress tests", mobileValidationTests, "assert.equal(parseOtaStatus(\"007%\"), \"unknown\");");
assertContains("mobile validation OTA 100 percent remains in progress", mobileValidationTests, "assert.equal(isOtaStatusInProgress(\"100%\"), true);");
assertContains("mobile validation OTA padded progress not in progress", mobileValidationTests, "assert.equal(isOtaStatusInProgress(\" 100% \"), false);");
assertContains("mobile validation OTA padded URL test", mobileValidationTests, "assert.equal(isSupportedOtaUrl(\" https://example.test/firmware.bin\"), false);");
assertContains("mobile validation OTA newline URL test", mobileValidationTests, "assert.equal(isSupportedOtaUrl(\"https://example.test/firmware\\n.bin\"), false);");
assertContains("mobile validation OTA DEL URL test", mobileValidationTests, "assert.equal(isSupportedOtaUrl(\"https://example.test/firmware\\x7f.bin\"), false);");
assertContains("firmware OTA rejects DEL URL byte", firmwareOta, "if (c <= 0x20 || c == 0x7f) return false;");
assertContains("mobile OTA URL guard usage", mobileApp, "isSupportedOtaUrl(otaUrl)");
assertContains("mobile OTA idle and fault guard", mobileApp, "const otaAllowed = canUseDevice && protocolCompatible && telemetry.mode === \"0\" && noSystemFault && !calibration.active");
assertContains("mobile OTA in-progress gate", mobileApp, "const otaInProgress = isOtaStatusInProgress(telemetry.otaStatus)");
assertContains("mobile OTA allowed blocks in-progress", mobileApp, "&& !otaInProgress");
assertContains("mobile delayed write protocol guard state", mobileApp, "protocolCompatible: false");
assertContains("mobile delayed write protocol guard refresh", mobileApp, "protocolCompatible,");
assertContains("mobile OTA delayed guard state", mobileApp, "otaAllowed: false");
assertContains("mobile OTA delayed in-progress guard state", mobileApp, "otaInProgress: false");
assertContains("mobile OTA delayed guard refresh", mobileApp, "otaAllowed,");
assertContains("mobile OTA delayed in-progress guard refresh", mobileApp, "otaInProgress,");
assertContains("mobile OTA confirmation prompt", mobileApp, "Send OTA command?");
assertContains("mobile OTA confirmation authenticity warning", mobileApp, "Only continue with a firmware binary you built and verified");
assertContains("mobile OTA cancel clears password", mobileApp, "{ text: \"Cancel\", style: \"cancel\", onPress: () => setOtaPassword(\"\") }");
assertContains("mobile OTA confirmation destructive action", mobileApp, "Send OTA\", style: \"destructive\"");
assertContains("mobile OTA in-progress alert", mobileApp, "OTA already running");
assertContains("mobile OTA delayed stale device clears password", mobileApp, "if (!isCurrentConnectedDevice(writeDevice)) {\n      setOtaPassword(\"\");\n      return;\n    }");
assertContains("mobile OTA delayed busy guard clears password", mobileApp, "if (writeGuardsRef.current.busy) {\n      setOtaPassword(\"\");\n      return;\n    }");
assertContains("mobile OTA delayed protocol guard before availability", mobileApp, "if (!writeGuardsRef.current.protocolCompatible) {\n      setOtaPassword(\"\");\n      Alert.alert(\"Protocol mismatch\", \"OTA writes require the expected Ozealis BLE protocol version.\");");
assertContains("mobile OTA delayed callback latest guard", mobileApp, "if (writeGuardsRef.current.otaInProgress || !writeGuardsRef.current.otaAllowed)");
assertOrder("mobile OTA delayed protocol before availability guard", mobileApp, "if (!writeGuardsRef.current.protocolCompatible)", "if (writeGuardsRef.current.otaInProgress || !writeGuardsRef.current.otaAllowed)");
assertContains("mobile OTA delayed callback trims SSID only", mobileApp, "const nextSsid = otaSsid.trim();\n    const nextUrl = otaUrl;");
assertContains("mobile OTA delayed callback field recheck", mobileApp, "if (!nextSsid || !otaPassword.trim() || !nextUrl)");
assertContains("mobile OTA delayed field recheck clears password", mobileApp, "if (!nextSsid || !otaPassword.trim() || !nextUrl) {\n      setOtaPassword(\"\");");
assertContains("mobile OTA delayed callback URL recheck", mobileApp, "if (!isSupportedOtaUrl(nextUrl))");
assertContains("mobile OTA delayed URL recheck clears password", mobileApp, "if (!isSupportedOtaUrl(nextUrl)) {\n      setOtaPassword(\"\");");
assertContains("mobile OTA protocol mismatch alert", mobileApp, "OTA writes require the expected Ozealis BLE protocol version");
assertContains("mobile OTA write-time protocol recheck", mobileApp, "confirmProtocolBeforeWrite(\"OTA writes require the expected Ozealis BLE protocol version.\", writeDevice)");
assertContains("mobile OTA fresh idle readback message", mobileApp, "OTA requires a fresh idle, no-fault, no-calibration readback before sending a firmware URL");
assertContains("mobile OTA fresh status read before write", mobileApp, "const freshOtaStatus = parseOtaStatus(await readUtf8(writeDevice, OZEALIS_CHARACTERISTICS.otaStatus));");
assertContains("mobile OTA fresh in-progress gate before write", mobileApp, "if (isOtaStatusInProgress(freshOtaStatus))");
assertContains("mobile OTA status readback", mobileApp, "readUtf8(writeDevice, OZEALIS_CHARACTERISTICS.otaStatus)");
assertContains("mobile OTA ERR readback message", mobileApp, "OTA command returned ERR.");
assertContains("mobile OTA accepted requires active or OK status", mobileApp, "isOtaStatusInProgress(status) || status === \"OK\"");
assertContains("mobile OTA unverified status message", mobileApp, "OTA command not verified; status readback is");
assertContains("mobile docs OTA confirmation and fault-code guard", mobileDoc, "Send exact, unpadded, whitespace-free, control-character-free `http://` or `https://` OTA update URLs with a non-empty URL host/authority immediately after the scheme only after an explicit confirmation while the device reports idle, the reported fault code is clear");
assertContains("mobile docs OTA post-write readback", mobileDoc, "then rereads OTA status so immediate `START`, progress, `OK`, or `ERR` responses are visible");
assertContains("mobile docs OTA in-progress block", mobileDoc, "OTA status is not already `START` or an exact unpadded progress percentage");
assertContains("mobile docs OTA delayed field and URL recheck", mobileDoc, "re-checks required OTA fields, supported URL scheme, non-empty URL host/authority, URL whitespace/control characters, fresh mode/fault/calibration readback, and a fresh OTA-status read inside the delayed confirmation callback before writing the command");
assertContains("mobile docs OTA accepted wording proof", mobileDoc, "reserve accepted wording for `START`, progress, or `OK` readback");
assertContains("mobile docs OTA not verified wording", mobileDoc, "`IDLE` or unknown readback is reported as not verified");
assertContains("protocol docs OTA idle guard", protocolDoc, "Firmware accepts OTA commands only while the system is idle");
assertContains("protocol docs OTA URL scheme", protocolDoc, "http(s)://");
assertContains("protocol docs OTA object root", protocolDoc, "The OTA command root must be a JSON object");
assertContains("protocol docs OTA non-empty string fields", protocolDoc, "`ssid`, `pwd`, and `url` fields must be non-empty JSON strings");
assertContains("protocol docs OTA non-empty URL host/authority", protocolDoc, "include a non-empty URL host/authority immediately after the scheme");
assertContains("protocol docs OTA URL whitespace rejected", protocolDoc, "and contain no leading, trailing, embedded whitespace, or ASCII control characters");
assertContains("protocol docs OTA background task", protocolDoc, "runs the Wi-Fi/download work in a background task");
assertContains("protocol docs OTA oversized fields ERR", protocolDoc, "oversized OTA fields");
assertContains("protocol docs OTA non-object roots fail", protocolDoc, "non-object JSON roots, missing or non-string OTA fields");
assertContains("protocol docs OTA URL authority/whitespace ERR", protocolDoc, "unsupported URL scheme, missing URL host/authority, URL whitespace/control characters, or oversized OTA fields");
assertContains("protocol docs OTA immediate ERR notify", protocolDoc, "Immediate command-validation errors update and notify the OTA status characteristic with `ERR`");
assertContains("protocol docs OTA trigger result notify", protocolDoc, "accepted commands and trigger-time validation failures also notify the resulting `START` or `ERR` status before the BLE write handler returns");
assertContains("protocol docs OTA status readback", protocolDoc, "characteristic can also be reread after a command write");
assertContains("firmware OTA strict SSID field parse", firmwareBle, "const char* ss = jsonNonEmptyString(d, \"ssid\");");
assertContains("firmware OTA strict password field parse", firmwareBle, "const char* pw = jsonNonEmptyString(d, \"pwd\");");
assertContains("firmware OTA strict URL field parse", firmwareBle, "const char* url = jsonNonEmptyString(d, \"url\");");
assertContains("firmware OTA missing field ERR notify", firmwareBle, "if (!ss || !pw || !url) {\n      otaSecure_markError();\n      publishOtaStatus(true);");
assertContains("mobile OTA status parser helper", appValidation, "parseOtaStatus(raw: string)");
assertContains("mobile OTA status parser finite states", appValidation, "raw === \"IDLE\" || raw === \"START\" || raw === \"OK\" || raw === \"ERR\"");
assertContains("mobile OTA status parser exact progress", appValidation, "const match = /^(0|[1-9]\\d?|100)%$/.exec(raw);");
assertContains("mobile OTA status parser percent range", appValidation, "percent < 0 || percent > 100");
assertContains("mobile OTA status notification parser", mobileApp, "key === \"otaStatus\"\n          ? parseOtaStatus(value || \"\")");
assertContains("mobile OTA status readback parser", mobileApp, "const status = parseOtaStatus(await readUtf8(writeDevice, OZEALIS_CHARACTERISTICS.otaStatus))");
assertContains("mobile docs OTA status parser", mobileDoc, "OTA status text is accepted only as `IDLE`, `START`, `OK`, `ERR`, or exact unpadded `0%` through `100%`");
assertContains("README mobile web preview command", topReadme, "npm run web");
assertContains("README mobile web export smoke command", topReadme, "npm run test:web-export");
assertContains("README mobile missing build script note", topReadme, "There is no `npm run build` script.");
assertContains("README mobile web export smoke boundary", topReadme, "bundler smoke for browser preview only");
assertContains("README mobile native BLE dev build boundary", topReadme, "Native BLE control requires an Expo development build");
assertContains("mobile docs web preview command", mobileDoc, "npm run web");
assertContains("mobile docs web preview working directory", mobileDoc, "From `mobile/`, run a browser layout preview without BLE hardware");
assertContains("mobile docs web export smoke command", mobileDoc, "npm run test:web-export");
assertContains("mobile docs missing build script note", mobileDoc, "There is no `npm run build` script in `mobile/package.json`");
assertContains("mobile docs web export smoke cleanup", mobileDoc, "temporary Expo web export smoke");
assertContains("mobile docs Expo Go BLE boundary", mobileDoc, "Expo Go and the browser are useful for layout checks only");
assertContains("mobile docs native BLE working directory", mobileDoc, "From `mobile/`, create and install an Expo development build for native BLE control");
assertContains("mobile docs Android native development build", mobileDoc, "npm run android:dev-build");
assertContains("mobile docs iOS native development build", mobileDoc, "npm run ios:dev-build");
assertContains("mobile docs launch scripts are not build scripts", mobileDoc, "The `android` and `ios` scripts do not create a development build.");
assertContains("mobile docs web BLE preview guard", mobileDoc, "Browser preview stays in BLE preview mode and must not construct the native BLE manager");
assertContains("mobile package lacks build script by design", mobilePackage, "\"web\": \"expo start --web\"");
assertContains("mobile package web export smoke script", mobilePackage, "\"test:web-export\": \"node ../scripts/verify-mobile-web-export.mjs\"");
assertContains("mobile app BLE plugin central mode", mobileAppJson, "\"modes\": [\"central\"]");
assertAbsent("mobile app BLE plugin no peripheral mode", mobileAppJson, "\"peripheral\"");
assertContains("mobile app BLE plugin neverForLocation", mobileAppJson, "\"neverForLocation\": true");
assertAbsent("mobile app no manual Android permission list", mobileAppJson, "\"permissions\": [");
assertAbsent("mobile app no unrestricted Android fine location", mobileAppJson, "android.permission.ACCESS_FINE_LOCATION");
assertContains("mobile runtime Android 12 Bluetooth scan request", mobileApp, "PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN");
assertContains("mobile runtime Android 12 Bluetooth connect request", mobileApp, "PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT");
assertContains("mobile runtime legacy Android fine location request", mobileApp, "PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION");
assertContains("mobile docs BLE central metadata", mobileDoc, "modes: [\"central\"]");
assertContains("mobile docs BLE no peripheral advertising", mobileDoc, "does not advertise as a BLE peripheral");
assertContains("mobile docs BLE neverForLocation", mobileDoc, "neverForLocation: true");
assertContains("mobile docs BLE Android 12 location boundary", mobileDoc, "Android 12+ scan permission is marked as not used for location");
assertContains("release checklist BLE central metadata", releaseChecklistDoc, "Expo BLE plugin `modes` is `[\"central\"]`");
assertContains("release checklist BLE neverForLocation metadata", releaseChecklistDoc, "generated by the Expo BLE plugin with `neverForLocation: true`");
assertMobilePackageScript("web", "expo start --web");
assertMobilePackageScript("android", "expo start --android");
assertMobilePackageScript("ios", "expo start --ios");
assertMobilePackageScript("android:dev-build", "expo run:android");
assertMobilePackageScript("ios:dev-build", "expo run:ios");
assertMobilePackageScript("test:web-export", "node ../scripts/verify-mobile-web-export.mjs");
assertMobilePackageScriptAbsent("build");
assertContains("mobile OTA password clears after write attempt", mobileApp, "setOtaPassword(\"\");\n      setBusy(false);");
assertContains("mobile docs OTA password lifecycle", mobileDoc, "Clear the in-app OTA password field after each OTA write attempt and after canceling the final OTA confirmation");
assertContains("mobile docs session reset clears OTA fields and settings", mobileDoc, "On connected-session reset, clear all in-app OTA command fields and return displayed comfort settings to defaults");
assertContains("mobile OTA write exception fixed copy", mobileApp, "OTA command failed. Check URL, Wi-Fi, idle state, and serial logs before retrying.");
assertContains("mobile OTA suppresses stale failure message", mobileApp, "catch {\n      if (!isCurrentConnectedDevice(writeDevice)) return;\n      setMessage(\"OTA command failed. Check URL, Wi-Fi, idle state, and serial logs before retrying.\");");
assertAbsent("mobile OTA catch must not display raw exception", mobileApp, "setMessage(error instanceof Error ? error.message : \"OTA command failed.\");");
assertContains("mobile docs OTA exception fixed copy", mobileDoc, "OTA write exceptions use fixed failure copy instead of displaying raw exception text");
assertContains("mobile docs firmware OTA credential lifecycle", mobileDoc, "Firmware clears stale pending OTA buffers before accepting a new command");
assertContains("mobile docs firmware OTA worker URL clear", mobileDoc, "clears the task-local URL after the OTA call or failed Wi-Fi connection");
assertContains("firmware OTA clears stale pending buffers before validation", firmwareOta, "clearPendingOtaCredentials();\n  if (!ssid || !pwd || !isSupportedOtaUrl(url))");
assertContains("firmware OTA clears task-local SSID", firmwareOta, "memset(ssid, 0, sizeof(ssid));");
assertContains("firmware OTA clears task-local URL on Wi-Fi failure", firmwareOta, "if (WiFi.status() != WL_CONNECTED) {\n    memset(url, 0, sizeof(url));");
assertContains("firmware OTA clears task-local URL after OTA call", firmwareOta, "esp_err_t ret = esp_https_ota(&http_cfg);\n  progress = 100;\n  memset(url, 0, sizeof(url));");
assertContains("protocol docs OTA credential lifecycle", protocolDoc, "clears the static pending SSID/password/URL buffers");
assertContains("protocol docs OTA stale pending buffer clear", protocolDoc, "clears stale pending OTA buffers before validating a new command");
assertContains("protocol docs OTA task-local URL clear", protocolDoc, "clears the task-local URL after the OTA call or failed Wi-Fi connection");
assertContains("protocol docs OTA credential lifecycle caveat", protocolDoc, "does not make OTA a trusted or hardened update channel");
assertContains("protocol docs OTA malformed command ERR", protocolDoc, "missing or non-string OTA fields");
assertContains("protocol docs OTA retry after failure", protocolDoc, "a later idle OTA command may retry");
assertContains("protocol docs OTA 100 percent remains in progress", protocolDoc, "any `n%` progress status including `100%`, and reboot-pending `OK` reject a new OTA trigger");
assertContains("protocol docs OTA app password clearing", protocolDoc, "The mobile app clears its OTA password field after every OTA write attempt and after canceling the final OTA confirmation");
assertContains("protocol docs OTA session reset clears command fields", protocolDoc, "on connected-session reset it clears all in-app OTA command fields and returns displayed comfort settings to defaults");
assertContains("security docs OTA credential app clearing", securityDoc, "the app clears the in-app password field after each write attempt and after canceling the final OTA confirmation, clears all in-app OTA command fields on device-session reset");
assertContains("security docs OTA exception fixed copy", securityDoc, "OTA write exceptions use fixed failure copy instead of displaying raw exception text near credentials");
assertContains("security docs OTA firmware credential clearing", securityDoc, "firmware clears stale pending OTA buffers, pending credential buffers, task-local SSID/password, and task-local URL");
assertContains("security docs OTA credential lifecycle caveat", securityDoc, "does not make OTA a trusted or hardened update channel");
assertContains("firmware OTA no project CA configured", firmwareOta, ".cert_pem = nullptr");
assertContains("protocol docs OTA authenticity boundary", protocolDoc, "does not perform project-owned signed-image verification or certificate pinning");
assertContains("protocol docs OTA local lab HTTP boundary", protocolDoc, "plain `http://` URLs are accepted for local lab servers");
assertContains("protocol docs OTA authenticity hardening", protocolDoc, "Add signed-image verification, certificate pinning, or an equivalent documented firmware authenticity design");
assertContains("mobile docs OTA authenticity boundary", mobileDoc, "does not provide signed-image verification or certificate pinning");
assertContains("mobile docs OTA not trusted channel", mobileDoc, "not a trusted production update channel");
assertContains("mobile OTA visible authenticity warning", mobileApp, "does not verify project-owned signatures or pinned certificates");
assertContains("security docs OTA authenticity boundary", securityDoc, "does not perform project-owned signed-image verification or certificate pinning");
assertContains("release checklist OTA authenticity item", releaseChecklistDoc, "OTA authenticity limitation reviewed");
assertContains("release checklist OTA not trusted channel", releaseChecklistDoc, "must not present OTA as a trusted production update channel");
assertContains("release checklist broader OTA authenticity design", releaseChecklistDoc, "equivalent documented firmware authenticity design for OTA");
assertContains("firmware strict flag helper", firmwareBle, "static bool jsonFlag1");
assertContains("firmware fault log clear command", firmwareBle, "const bool clearFaults = jsonFlag1(doc, \"clearFaults\")");
assertContains("firmware settings command classifies config writes once", firmwareBle, "const bool settingsConfigWrite = hasSettingsConfigWrite(doc);");
assertContains("firmware log clear independent idle gate", firmwareBle, "const bool logClearAllowed = currentMode == MODE_IDLE && currentFault == FAULT_NONE &&\n                                 !motorCalIsActive() && !otaSecure_inProgress();");
assertContains("firmware rejected log clear can still reach motor fault clear", firmwareBle, "if (!clearMotorFault && !settingsConfigWrite) return;");
assertContains("firmware session clear invalidates transfer snapshot", firmwareBle, "dl_init();\n      publishCsvTransferError(char_logDl, \"request_required\");");
assertContains("firmware fault clear invalidates transfer snapshot", firmwareBle, "diag_clear_faults();\n      publishCsvTransferError(char_faultCsv, \"request_required\");");
assertContains("firmware log clear command-only returns before settings save", firmwareBle, "if ((clearLog || clearFaults) && !settingsConfigWrite) return;");
assertContains("firmware motor fault clear command", firmwareBle, "const bool clearMotorFault = jsonFlag1(doc, \"clearMotorFault\")");
assertContains("firmware motor fault clear API usage", firmwareBle, "motorClearFault()");
assertContains("firmware motor fault clear notifies mode/fault", firmwareBle, "currentFault = FAULT_NONE;\n          enterMode(MODE_IDLE);\n          publishModeFault(true);");
assertContains("firmware mixed motor fault clear/settings unavailable echoes unchanged settings", firmwareBle, "if (settingsConfigWrite) publishSettings();\n        BLE_LOG(\"Motor fault clear ignored while unavailable\");");
assertContains("firmware mixed motor fault clear/settings handled echoes unchanged settings", firmwareBle, "BLE_LOG(\"Motor fault clear failed\");\n      }\n      if (settingsConfigWrite) publishSettings();\n      return;");
assertContains("firmware MCF snapshot fault field", firmwareMotor, "\\\"fault\\\":%s");
assertContains("firmware MCF snapshot fault source", firmwareMotor, "const bool faultActive = motorFaultActive();");
assertContains("mobile fault log clear command", mobileApp, "clearFaults: 1");
assertContains("mobile log clear idle alert", mobileApp, "Log clear requires idle");
assertContains("mobile current connected device helper", mobileApp, "function isCurrentConnectedDevice(device: Device | null)");
assertContains("mobile delayed log clear captures intended device", mobileApp, "const writeDevice = connectedDevice;\n    const sessionId = deviceSessionIdRef.current;");
assertContains("mobile delayed log clear passes captured session", mobileApp, "onPress: () => void writeClearLogs(writeDevice, sessionId)");
assertContains("mobile delayed log clear current session guard", mobileApp, "if (!isCurrentDeviceSession(writeDevice, sessionId)) return;\n    if (writeGuardsRef.current.busy) return;");
assertContains("mobile delayed write latest busy guard", mobileApp, "if (writeGuardsRef.current.busy) return");
assertContains("mobile delayed log clear protocol guard", mobileApp, "if (!writeGuardsRef.current.protocolCompatible) {\n      Alert.alert(\"Protocol mismatch\", \"Log clearing requires the expected Ozealis BLE protocol version.\");");
assertOrder("mobile delayed log clear protocol before idle guard", mobileApp, "Log clearing requires the expected Ozealis BLE protocol version.", "if (!writeGuardsRef.current.settingsWriteAllowed)");
assertContains("mobile delayed log clear latest guard", mobileApp, "if (!writeGuardsRef.current.settingsWriteAllowed)");
assertContains("mobile log clear write-time protocol recheck", mobileApp, "confirmProtocolBeforeWrite(\"Log clearing requires the expected Ozealis BLE protocol version.\", writeDevice)");
assertContains("mobile log clear suppresses stale failure message", mobileApp, "catch (error) {\n      if (!isCurrentDeviceSession(writeDevice, sessionId)) return;\n      setMessage(actionErrorMessage(error, \"Could not clear logs.\", \"Log clear failed.\"));");
assertContains("mobile log clear does not clear newer busy state", mobileApp, "finally {\n      if (isCurrentDeviceSession(writeDevice, sessionId)) setBusy(false);\n    }\n  }\n\n  async function clearMotorFault");
assertContains("mobile fresh idle readback helper", mobileApp, "async function confirmIdleNoCalibrationBeforeWrite");
assertContains("mobile log clear fresh mode readback", mobileApp, "readUtf8(device, OZEALIS_CHARACTERISTICS.mode)");
assertContains("mobile log clear fresh calibration readback", mobileApp, "readUtf8(device, OZEALIS_CHARACTERISTICS.calibrationStatus)");
assertContains("mobile log clear fresh readback gate", mobileApp, "nextMode === \"0\" && nextFault === \"0\" && !nextCalibration.active");
assertContains("mobile log clear fresh readback message", mobileApp, "Log clearing requires a fresh idle, no-fault, no-calibration readback");
assertContains("mobile log clear confirmation", mobileApp, "Clear device logs?");
assertContains("mobile log clear evidence warning", mobileApp, "Session and fault logs are bench evidence");
assertContains("mobile log clear destructive action", mobileApp, "Clear logs");
assertContains("mobile log clear idle disabled state", mobileApp, "label=\"Clear\" onPress={clearLogs} disabled={!settingsWriteAllowed || busy}");
assertContains("mobile log clear transfer-after-write session", mobileApp, "readCsvTransfer(writeDevice, OZEALIS_CHARACTERISTICS.logDownload)");
assertContains("mobile log clear transfer-after-write faults", mobileApp, "readCsvTransfer(writeDevice, OZEALIS_CHARACTERISTICS.faultCsv)");
assertContains("mobile log clear exact header-only readback helper", appValidation, "isClearedDeviceLogReadback(sessionCsv: string, faultCsv: string)");
assertContains("mobile log clear header-only session helper", appValidation, "isHeaderOnlyRetainedSessionCsv(raw: string)");
assertContains("mobile log clear header-only fault helper", appValidation, "isHeaderOnlyFaultCsv(raw: string)");
assertContains("mobile log clear header-only trims one final newline only", appValidation, "if (lines.length > 1 && lines[lines.length - 1] === \"\") lines.pop();");
assertContains("mobile log clear header-only exact line count", appValidation, "return lines.length === 1 && lines[0] === expectedHeader;");
assertContains("mobile log clear exact header-only readback export", appProtocol, "isClearedDeviceLogReadback");
assertContains(
  "mobile retained import commits a validated snapshot pair",
  mobileApp,
  "function commitRetainedSnapshotPair(deviceId: string, pair: RetainedSnapshotPair, verifiedClear = false)",
);
assertContains(
  "mobile retained import preserves stored pair on ordinary empty readback",
  mobileApp,
  "if (importedRows === 0 && !verifiedClear) return 0;",
);
assertContains(
  "mobile retained import writes session snapshot",
  mobileApp,
  "new File(Paths.document, retainedSessionImportFileName).write(pair.session.csv);",
);
assertContains(
  "mobile retained import writes fault snapshot",
  mobileApp,
  "new File(Paths.document, retainedFaultImportFileName).write(pair.fault.csv);",
);
assertContains(
  "mobile retained import writes manifest commit marker",
  mobileApp,
  "new File(Paths.document, retainedImportManifestFileName).write(serializeRetainedImportManifest(manifest));",
);
assertOrder(
  "mobile retained import writes both CSV files before manifest",
  mobileApp,
  "new File(Paths.document, retainedSessionImportFileName).write(pair.session.csv);",
  "new File(Paths.document, retainedImportManifestFileName).write(serializeRetainedImportManifest(manifest));",
);
assertContains("mobile log clear malformed nonempty readback message", mobileApp, "Log clear requested; readback did not contain valid retained rows.");
assertContains("mobile log clear verifies retained rows", mobileApp, "Log clear requested; retained rows still present on device.");
assertContains("mobile log clear rows-present uses expected families", mobileApp, "const validRowsRemain = retainedReadbackImportedRowCount(logs.csv, faults.csv) > 0;");
assertContains("mobile log clear verified empty message", mobileApp, "Device logs cleared and verified.");
assertContains("mobile log clear verified clear variable", mobileApp, "const verifiedClear = isClearedDeviceLogReadback(logs.csv, faults.csv);");
assertContains("mobile log clear commits verified pair atomically", mobileApp, "commitRetainedSnapshotPair(writeDevice.id, pair, verifiedClear);");
assertContains("mobile log clear live trace reset only when verified", mobileApp, "if (verifiedClear) resetLiveSync();");
assertContains("mobile validation tests log clear header-only readback", mobileValidationTests, "isClearedDeviceLogReadback(retainedHeaderOnlyCsv, faultHeaderOnlyCsv), true");
assertContains("mobile validation tests log clear leading blank readback rejected", mobileValidationTests, "isClearedDeviceLogReadback(`\\n${retainedHeaderOnlyCsv}`, faultHeaderOnlyCsv), false");
assertContains("mobile validation tests log clear extra blank readback rejected", mobileValidationTests, "isClearedDeviceLogReadback(retainedHeaderOnlyCsv, `${faultHeaderOnlyCsv}\\n`), false");
assertContains("mobile validation tests log clear empty readback rejected", mobileValidationTests, "isClearedDeviceLogReadback(\"\", \"\"), false");
assertContains("mobile validation tests log clear malformed readback", mobileValidationTests, "isClearedDeviceLogReadback(retainedHeaderOnlyCsv, \"fault-not-csv\"), false");
assertContains("mobile motor fault clear command", mobileApp, "clearMotorFault: 1");
assertContains("mobile motor fault clear readback", mobileApp, "const params = await loadDriverParams(writeDevice);");
assertContains("mobile motor fault clear captures mode fault readback", mobileApp, "const modeFault = await refreshModeFaultFromDevice(writeDevice);\n      const snapshot = parseMcfParamsSnapshot(params);");
assertContains("mobile motor fault clear firmware idle verification", mobileApp, "const firmwareClear = modeFault.mode === \"0\" && modeFault.fault === \"0\";");
assertContains("mobile motor fault clear requires verified command path", mobileApp, "snapshot.fault === false && snapshot.commandReady && firmwareClear");
assertContains("mobile motor fault clear verified message", mobileApp, "Motor driver fault cleared and verified.");
assertContains("mobile motor fault clear command not ready message", mobileApp, "Motor driver fault latch is clear, but speed-command readiness is not verified.");
assertContains("mobile motor fault clear firmware not idle message", mobileApp, "Motor driver fault latch is clear, but firmware fault readback is not idle.");
assertContains("mobile motor fault clear not-verifiable message", mobileApp, "snapshot could not verify a present driver with clear latch");
assertContains("mobile MCF snapshot fault parser", appValidation, "const fault = typeof parsed.fault === \"boolean\" ? parsed.fault : null");
assertContains("mobile motor fault clear button", mobileApp, "Clear driver fault");
assertContains("mobile motor fault clear idle-or-IO guard", mobileApp, "canUseDevice && protocolCompatible && !calibration.active && (telemetry.mode === \"0\" || (telemetry.mode === \"4\" && telemetry.fault === \"4\"));");
assertContains("mobile motor fault clear protocol guard", mobileApp, "Motor fault clearing requires the expected Ozealis BLE protocol version");
assertContains("mobile motor fault clear write-time protocol recheck", mobileApp, "confirmProtocolBeforeWrite(\"Motor fault clearing requires the expected Ozealis BLE protocol version.\", writeDevice)");
assertContains("mobile motor fault clear suppresses stale failure message", mobileApp, "catch (error) {\n      if (!isCurrentConnectedDevice(writeDevice)) return;\n      setMessage(actionErrorMessage(error, \"Could not clear motor driver fault.\", \"Motor driver fault clear failed.\"));");
assertContains("mobile motor fault clear fresh readback helper", mobileApp, "async function confirmMotorFaultClearAvailableBeforeWrite");
assertContains("mobile motor fault clear fresh readback gate", mobileApp, "nextMode === \"0\" || (nextMode === \"4\" && nextFault === \"4\")");
assertContains("mobile motor fault clear fresh readback use", mobileApp, "confirmMotorFaultClearAvailableBeforeWrite(writeDevice)");
assertContains("mobile motor fault clear fresh readback alert", mobileApp, "requires a fresh idle or FAULT_IO readback");
assertContains("mobile motor fault clear unavailable alert", mobileApp, "Motor driver fault clearing is accepted only while idle or in an I/O fault");
assertContains("protocol docs fault log clear command", protocolDoc, "\"clearFaults\"");
assertContains("protocol docs motor fault clear command", protocolDoc, "\"clearMotorFault\"");
assertContains("protocol docs clear flag integer contract", protocolDoc, "each request flag must be the JSON integer `1`");
assertContains("protocol docs log clear fault-code guard", protocolDoc, "`clearLog` and `clearFaults` are accepted only while idle, with fault code `0`");
assertContains("protocol docs log clear invalidates snapshots", protocolDoc, "invalidate any transfer snapshot");
assertContains("protocol docs log clear app header-only boundary", protocolDoc, "only both canonical header-only CSV results as a verified clear");
assertContains("protocol docs log clear exact header-only shape", protocolDoc, "exactly its expected header with at most one final newline and no leading, extra trailing, or whitespace-only lines");
assertContains("protocol docs log clear app preserves evidence", protocolDoc, "empty, malformed, live-format, swapped, foreign, incomplete, or integrity-failed transfers must not erase stored latest-data evidence");
assertContains("protocol docs log clear rows-present expected family", protocolDoc, "post-clear rows are reported as still present only when they normalize into the expected retained-session or fault readback family");
assertContains("protocol docs combined clear command independence", protocolDoc, "ignores only the log-clear flags and still evaluates the motor-fault clear request");
assertContains("protocol docs motor fault clear limits", protocolDoc, "`clearMotorFault` is accepted only while idle or while the system is in `FAULT_IO`");
assertContains("protocol docs motor fault clear writes CLR_FLT", protocolDoc, "firmware writes the `ALGO_CTRL1` `CLR_FLT` bit");
assertContains("protocol docs motor fault clear revalidates speed command", protocolDoc, "the speed-command path revalidates");
assertContains("protocol docs mixed motor fault clear settings echo", protocolDoc, "mixes `clearMotorFault` with normal settings fields treats the fault clear as the only command");
assertContains("protocol docs motor fault clear readback", protocolDoc, "snapshot includes `fault:true/false`");
assertContains("protocol docs motor fault clear immediate notify", protocolDoc, "updates and notifies the mode/fault characteristics immediately after returning to idle");
assertContains("protocol docs motor fault clear app mode readback", protocolDoc, "post-write MCF8316D snapshot shows a present driver with a clear latch and `commandReady=true`");
assertContains("mobile docs motor fault clear readback", mobileDoc, "post-write MCF8316D snapshot confirms a present driver, clear latch, and `commandReady=true`");
assertContains("mobile docs motor fault clear fresh readback", mobileDoc, "rereads mode, fault, and calibration status immediately before sending the clear request");
assertContains("firmware control start fault-code guard", firmwareBle, "currentMode != MODE_IDLE || currentFault != FAULT_NONE || motorCalIsActive()");
assertContains("firmware control start driver-ready guard", firmwareBle, "BLE control: start rejected, motor driver not ready");
assertContains("firmware startup verifies motor actually running", firmwareLogic, "motorSetDriveEnabled(true);\n      if (!motorIsRunning()) {\n        currentMode = MODE_IDLE;\n        triggerFault(FAULT_IO);\n        break;\n      }\n      enterMode(MODE_RUNNING);");
assertContains("firmware running transition starts fresh PAP session", firmwareLogic, "papStartSession();");
assertContains("firmware running transition sets green status", firmwareLogic, "case MODE_RUNNING:\n      humidifierPrewarmStop();\n      setLED(0, 255, 0);");
assertContains("firmware mode transition cancels pairing animation", firmwareLogic, "currentMode = m;\n  ledTogglePairingWave(false);");
assertContains("firmware BLE status restore defers RMT write to main loop", firmwareLogic, "statusLedRefreshPending = true;");
assertContains("firmware PAP stop synchronizes system idle", firmwareLogic, "if (!papSessionActive()) enterMode(MODE_IDLE);");
assertContains("firmware mode readback characteristic", firmwareBle, "UUID_CHAR_MODE,\n                                        BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY");
assertContains("firmware fault readback characteristic", firmwareBle, "UUID_CHAR_FAULT,\n                                         BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY");
assertContains("firmware immediate mode/fault publisher", firmwareBle, "static void publishModeFault(bool notify = false)");
assertContains("firmware mode/fault publisher stack buffer", firmwareBle, "char modeValue[4];");
assertContains("firmware mode/fault stream uses publisher", firmwareBle, "publishModeFault(true);\n  setFloatValue(char_ahi, ahi, 1);");
assertAbsent("firmware mode/fault stream avoids heap String mode", firmwareBle, "String((uint8_t)currentMode)");
assertAbsent("firmware mode/fault stream avoids heap String fault", firmwareBle, "String((uint8_t)currentFault)");
assertContains("firmware live telemetry float stack helper", firmwareBle, "static void setFloatValue(BLECharacteristic* characteristic, float value, uint8_t decimals)");
assertContains("firmware live telemetry pressure uses stack helper", firmwareBle, "setFloatValue(char_pressure, diff_hPa, 2);");
assertContains("firmware live telemetry module status stack buffer", firmwareBle, "char moduleStatus[4];");
assertContains("firmware live telemetry module status prewarm bit", firmwareBle, "humid.prewarm ? 8 : 0");
assertContains("firmware module status read characteristic", firmwareBle, "UUID_CHAR_MOD_STATUS,\n                                           BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY");
assertContains("firmware module status publisher helper", firmwareBle, "static void publishModuleStatus(bool notify = false)");
assertContains("firmware module status prewarm start immediate notify", firmwareBle, "publishModeFault(true);\n      publishModuleStatus(true);\n      BLE_LOG(\"BLE control: prewarm start\")");
assertContains("firmware module status prewarm stop immediate notify", firmwareBle, "publishModeFault(true);\n      publishModuleStatus(true);\n      BLE_LOG(\"BLE control: prewarm stop\")");
assertContains("firmware rejected prewarm clears stale status", firmwareBle, "if (!humidifierPrewarmStart()) {\n        humidifierPrewarmStop();");
assertContains("firmware rejected prewarm publishes module status", firmwareBle, "BLE_LOG(\"BLE control: prewarm start ignored\");\n        publishModeFault(true);\n        publishModuleStatus(true);");
assertAbsent("firmware live telemetry avoids heap String pressure", firmwareBle, "char_pressure->setValue(String(");
assertAbsent("firmware live telemetry avoids heap String accessory", firmwareBle, "char_humTemp->setValue(String(");
assertAbsent("firmware live telemetry avoids heap String module status", firmwareBle, "char_modStat->setValue(String(");
assertContains("firmware control notifies mode/fault after start", firmwareBle, "enterMode(MODE_STARTUP);\n      publishModeFault(true);");
assertContains("firmware control notifies mode/fault after stop", firmwareBle, "enterMode(MODE_SHUTDOWN);\n      publishModeFault(true);");
assertContains("firmware button can publish BLE events", firmwareHeader, "void sendBLEEvent(const char* evt);");
assertContains("firmware button calibration capture publishes BLE event", firmwareButton, "sendBLEEvent(\"BUTTON_CAL_CAPTURE\")");
assertContains("firmware button calibration stop publishes BLE event", firmwareButton, "sendBLEEvent(\"BUTTON_CAL_STOP\")");
assertContains("firmware button stop publishes BLE event", firmwareButton, "sendBLEEvent(\"BUTTON_STOP\")");
assertContains("firmware button start publishes BLE event", firmwareButton, "sendBLEEvent(\"BUTTON_START\")");
assertContains("firmware button pairing publishes BLE event", firmwareButton, "sendBLEEvent(\"BUTTON_PAIR\")");
assertContains("firmware README physical button immediate BLE events", firmwareReadme, "Button-driven start, stop, calibration capture/abort, and temporary pairing actions publish the same BLE mode/fault and calibration-status event path as BLE commands");
assertContains("protocol docs physical button immediate BLE events", protocolDoc, "Physical button start, stop, calibration capture/abort, and temporary pairing actions use the same mode/fault and calibration-status event publisher");
assertContains("firmware BLE fault event publishes mode/fault", firmwareBle, "void sendBLEEvent(const char*) {\n  publishModeFault(true);");
assertContains("firmware stop aborts calibration", firmwareBle, "if (motorCalIsActive()) motorCalAbort();");
assertContains("firmware stop notifies calibration abort status", firmwareBle, "if (motorCalIsActive()) motorCalAbort();\n      publishCalibrationStatus(true);");
assertContains("firmware stop preserves fault mode", firmwareBle, "BLE control: stop ignored while faulted");
assertContains("firmware unavailable start notifies unchanged mode/fault", firmwareBle, "BLE_LOG(\"BLE control: start ignored while unavailable\");\n        publishModeFault(true);");
assertContains("firmware control malformed JSON diagnostic", firmwareBle, "BLE control JSON parse error");
assertContains("firmware control command strict string parse", firmwareBle, "const char* command = jsonNonEmptyString(d, \"command\")");
assertContains("firmware control missing command diagnostic", firmwareBle, "BLE control missing command");
assertContains("firmware control unknown command diagnostic", firmwareBle, "BLE control: unknown command");
assertContains("mobile driver snapshot identity guard", mobileApp, "const driverSnapshotMatches = driverParams.driver === \"MCF8316D\" && driverParams.targetSpeed === \"i2c\"");
assertContains("mobile driver readiness requires explicit clear fault telemetry", mobileApp, "const driverReady = telemetry.motorI2c === \"1\" && telemetry.motorFault === \"0\" && driverCommandReady");
assertContains("mobile MCF snapshot confirm helper", mobileApp, "async function confirmDriverSnapshotBeforeMotorAction");
assertContains("mobile MCF snapshot connect preload is session scoped", mobileApp, "await loadDriverParams(discovered, sessionId);");
assertContains("mobile MCF snapshot shared loader carries session identity", mobileApp, "async function loadDriverParams(device = connectedDevice, sessionId = deviceSessionIdRef.current)");
assertContains("mobile MCF snapshot manual refresh captures read device", mobileApp, "const readDevice = connectedDevice;\n    setBusy(true);\n    try {\n      await loadDriverParams(readDevice);");
assertContains("mobile MCF snapshot manual refresh suppresses stale success", mobileApp, "if (!isCurrentConnectedDevice(readDevice)) return;\n      setMessage(\"MCF8316D parameter snapshot loaded.\");");
assertContains("mobile MCF snapshot manual refresh suppresses stale failure", mobileApp, "catch (error) {\n      if (!isCurrentConnectedDevice(readDevice)) return;\n      setMessage(actionErrorMessage(error, \"Could not update device details.\", \"Could not read MCF8316D parameters.\"));");
assertContains("mobile MCF snapshot fresh read", mobileApp, "const raw = await loadDriverParams(device);");
assertContains("mobile MCF snapshot clears stale evidence without device", mobileApp, "if (!device) {\n      setDriverParamsJson(\"\");\n      return \"\";\n    }");
assertContains("mobile MCF snapshot stale readback discarded", mobileApp, "if (!isCurrentDeviceSession(device, sessionId)) return \"\";\n      setDriverParamsJson(params);");
assertContains("mobile MCF snapshot stale failure discarded", mobileApp, "catch (error) {\n      if (!isCurrentDeviceSession(device, sessionId)) return \"\";");
assertContains("mobile MCF snapshot clears stale evidence on current read failure", mobileApp, "setDriverParamsJson(\"\");\n      throw error;");
assertContains("mobile docs MCF stale readback failure discard", mobileDoc, "stale snapshot readbacks and stale read failures from a replaced connected session must not publish or clear the current session's snapshot");
assertContains("mobile MCF snapshot driver gate", mobileApp, "snapshot.driver === \"MCF8316D\"");
assertContains("mobile MCF snapshot I2C gate", mobileApp, "snapshot.i2c === true");
assertContains("mobile MCF snapshot fault-clear gate", mobileApp, "snapshot.fault === false");
assertContains("mobile MCF snapshot target speed gate", mobileApp, "snapshot.targetSpeed === \"i2c\"");
assertContains("mobile MCF snapshot commandReady gate", mobileApp, "snapshot.commandReady");
assertContains("mobile MCF snapshot simple catch uses current interface mode", mobileApp, "advancedModeRef.current ? \"Could not reread the MCF8316D parameter snapshot.\" : modeAwareMessage(messageText)");
assertContains("mobile clear fault-code gate", mobileApp, "const noSystemFault = telemetry.fault === \"0\"");
assertContains("mobile connected unknown state guard", mobileApp, "const connectedStateUnknown = canUseDevice && (!/^[0-4]$/.test(telemetry.mode) || !/^[0-4]$/.test(telemetry.fault));");
assertContains("mobile control start idle and fault guard", mobileApp, "const controlStartAllowed = canUseDevice && protocolCompatible && telemetry.mode === \"0\" && noSystemFault && !calibration.active && driverReady");
assertContains("mobile control protocol gate covers commands", mobileApp, "if (!protocolCompatible) {\n      Alert.alert(\n        advancedMode ? \"Protocol mismatch\" : \"Update app or firmware\",\n        advancedMode ? \"Control commands require the expected Ozealis BLE protocol version.\"");
assertContains("mobile control write-time protocol recheck covers commands", mobileApp, "advanced: \"Control commands require the expected Ozealis BLE protocol version.\"");
assertContains("mobile simple stop requires protocol match", mobileApp, "const showSimpleStop = canUseDevice && protocolCompatible && (telemetry.mode === \"1\" || telemetry.mode === \"2\" || telemetry.mode === \"3\");");
assertContains("mobile advanced stop requires protocol match", mobileApp, "disabled={!canUseDevice || !protocolCompatible || busy}");
assertContains("mobile start fresh idle readback message", mobileApp, "Start requires a fresh idle, no-fault, no-calibration readback before commanding airflow.");
assertContains("mobile start write-time MCF snapshot recheck", mobileApp, "Start requires a fresh MCF8316D snapshot");
assertContains("mobile control mode-fault readback helper", mobileApp, "async function refreshModeFaultFromDevice");
assertContains("mobile control mode readback", mobileApp, "readUtf8(device, OZEALIS_CHARACTERISTICS.mode)");
assertContains("mobile control fault readback", mobileApp, "readUtf8(device, OZEALIS_CHARACTERISTICS.fault)");
assertContains("mobile control mode readback parser", mobileApp, "const nextMode = parseSystemMode(mode || \"\")");
assertContains("mobile control fault readback parser", mobileApp, "const nextFault = parseFaultCode(fault || \"\")");
assertContains("mobile control readback message helper", mobileApp, "controlCommandReadbackMessage(command, readback.mode, readback.fault, moduleStatusReadback)");
assertContains("mobile control suppresses stale failure message", mobileApp, "catch (error) {\n      if (!isCurrentConnectedDevice(writeDevice)) return;\n      setMessage(actionErrorMessage(error, command === \"start\" ? \"Use standby to start airflow.\" : command === \"prewarmStart\" ? \"Use standby to prewarm.\" : \"Stop from the device if needed.\"");
assertContains("mobile control fault readback nonzero enum guard", mobileApp, "const hasSystemFault = /^[1-4]$/.test(fault);");
assertContains("mobile control unverified start readback copy", mobileApp, "Start not verified; mode readback is");
assertContains("mobile control unverified start unknown fault copy", mobileApp, "Start not verified; mode readback is ${systemModes[Number(mode)] || mode}, fault readback is ${fault}.");
assertContains("mobile control unverified stop readback copy", mobileApp, "Stop not verified; mode readback is");
assertContains("mobile control unverified stop unknown fault copy", mobileApp, "Stop not verified; mode readback is ${systemModes[Number(mode)] || mode}, fault readback is ${fault}.");
assertAbsent("mobile control avoids sent-as-success wording", mobileApp, "Start command sent; mode readback");
assertAbsent("mobile control avoids stop sent wording", mobileApp, "Stop command sent;");
assertContains("protocol docs control readback", protocolDoc, "mode and fault remain readable");
assertContains("protocol docs immediate command notifications", protocolDoc, "updated and notified after command-driven transitions");
assertContains("protocol docs unavailable start notifies unchanged mode/fault", protocolDoc, "ignored after notifying the unchanged mode/fault characteristics");
assertContains("mobile docs control readback", mobileDoc, "Reread system mode and fault after start/stop writes");
assertContains("mobile docs delayed protocol guard", mobileDoc, "Delayed confirmation callbacks for destructive or motor-moving writes must re-check protocol compatibility separately");
assertContains("mobile docs start stop writes protocol gate", mobileDoc, "Start and stop control writes require the expected protocol version");
assertContains("mobile docs immediate mode fault notification", mobileDoc, "firmware also updates and notifies mode/fault immediately");
assertContains("protocol docs control start idle and fault guard", protocolDoc, "the reported fault code is `0`");
assertContains("protocol docs app start stop protocol gate", protocolDoc, "requires the expected protocol version before sending any start or stop control write");
assertContains("protocol docs control start driver-or-command-ready guard", protocolDoc, "If the driver or command transport is not ready, firmware rejects the start and enters the normal `FAULT_IO` path");
assertContains("protocol docs startup running requires motor running", protocolDoc, "only advances to `MODE_RUNNING` if the motor wrapper reports that the driver actually started");
assertContains("protocol docs stop aborts calibration", protocolDoc, "stop` aborts any active motor calibration sweep");
assertContains("protocol docs stop preserves fault mode", protocolDoc, "sent while faulted keeps the system in `MODE_FAULT`");
assertContains("protocol docs disconnect reconnect advertising window", protocolDoc, "If a connected phone disconnects while saved BLE advertising is enabled, firmware starts a new unconnected advertising window");
assertContains("firmware control rejects non-object JSON roots", firmwareBle, "BLE control JSON root not object");
assertContains("protocol docs malformed control no-op", protocolDoc, "non-object JSON roots, missing, empty, or non-string `command`, or unknown control commands are ignored with a serial diagnostic and no state change");
assertContains("release checklist start stop protocol gate", releaseChecklistDoc, "mobile protocol-version gating for both start and stop writes");
assertContains("mobile settings active fault alert", mobileApp, "clear active faults");
assertContains("mobile invalid settings parse returns fresh defaults", appValidation, "return { ...DEFAULT_SETTINGS };");
assertContains("mobile settings parse rejects non-objects", appValidation, "if (!isJsonObject(parsed)) return { ...DEFAULT_SETTINGS };");
assertContains("mobile settings parse object helper", appValidation, "function isJsonObject(value: unknown): value is Record<string, unknown>");
assertContains("mobile settings readback object helper", appValidation, "export function isSettingsReadbackObject(raw: string): boolean");
assertContains("mobile validation tests non-object settings JSON", mobileValidationTests, "for (const rawSettings of [\"null\", \"42\", \"\\\"settings\\\"\", \"[]\", \"true\"])");
assertContains("mobile validation tests settings readback rejects non-objects", mobileValidationTests, "assert.equal(isSettingsReadbackObject(rawSettings), false);");
assertContains("mobile validation tests settings readback accepts complete schema", mobileValidationTests, "assert.equal(isSettingsReadbackObject(serializeSettings(DEFAULT_SETTINGS)), true);");
assertContains("mobile settings limit messages", appValidation, "settingLimitMessages(settings");
assertContains("mobile settings adjusted mode label source", appValidation, "THERAPY_MODE_LABELS");
assertContains("mobile settings adjusted mode copy", appValidation, "Therapy mode adjusted to ${THERAPY_MODE_LABELS[safe.mode]}");
assertContains("mobile simple adjusted mode copy", mobileApp, "Mode adjusted to ${therapyModes[safe.mode]}");
assertContains("mobile settings write review", mobileApp, "Review adjusted settings");
assertContains("mobile settings read-after-write", mobileApp, "const settingsReadback = await readUtf8(writeDevice, OZEALIS_CHARACTERISTICS.settings);");
assertContains(
  "mobile settings nullable readback parser",
  appValidation,
  "export function parseSettingsReadback(raw: string): OzealisSettings | null",
);
assertContains("mobile settings readback object gate", appValidation, "return isSettingsReadbackObject(raw) ? parseSettings(raw) : null;");
assertContains("mobile settings write readback parser", mobileApp, "const confirmed = parseSettingsReadback(settingsReadback);");
assertContains("mobile settings write validity derives from parser", mobileApp, "const readbackValid = confirmed !== null;");
assertContains("mobile settings verified comparison", mobileApp, "const settingsVerified = confirmed !== null && serializeSettings(confirmed) === serializeSettings(safe);");
assertContains("mobile settings only applies valid readback", mobileApp, "if (confirmed) setSettings(confirmed);");
assertContains("mobile settings verified message", mobileApp, "Settings written and verified from device NVS.");
assertContains("mobile settings invalid-readback message", mobileApp, "Settings write not verified; settings readback was invalid.");
assertContains("mobile settings adjusted-readback message", mobileApp, "Settings write completed; device returned adjusted values.");
assertContains("mobile simple settings invalid-readback message", mobileApp, "Comfort did not verify. Update comfort before saving again.");
assertContains("mobile simple settings adjusted-readback message", mobileApp, "Comfort saved with device adjustments.");
assertContains("firmware settings config write detector", firmwareBle, "hasSettingsConfigWrite");
assertContains("firmware settings rejects non-object JSON roots", firmwareBle, "BLE settings JSON root not object");
assertContains("firmware settings idle and fault guard", firmwareBle, "settingsConfigWrite && (currentMode != MODE_IDLE || currentFault != FAULT_NONE ||\n                                motorCalIsActive() || otaSecure_inProgress())");
assertContains("firmware fault snapshots record fault mode", firmwareLogic, "snap.sys_mode     = (uint8_t)MODE_FAULT;");
assertContains("firmware diag fault mode constant", firmwareDiag, "static constexpr uint8_t DIAG_MODE_FAULT = 4;");
assertContains("firmware diag rejects no-fault snapshots", firmwareDiag, "if (s.fault_code == 0) return;");
assertContains("firmware diag forces fault mode", firmwareDiag, "s.sys_mode = DIAG_MODE_FAULT;");
assertContains("firmware diag normalizes nonfinite analogs", firmwareDiag, "s.vin_V = finiteOrNan(s.vin_V);");
assertContains("firmware diag clamps motor fault flag", firmwareDiag, "s.motorFault = s.motorFault ? 1 : 0;");
assertContains("firmware diag clamps motor I2C flag", firmwareDiag, "s.motorI2c = s.motorI2c ? 1 : 0;");
assertContains("protocol docs fault CSV records fault mode", protocolDoc, "Firmware records `sys_mode=4` for captured fault rows");
assertContains("protocol docs fault capture helper rejects none", protocolDoc, "The capture helper rejects `fault=0`");
assertContains("protocol docs fault capture helper binary flags", protocolDoc, "clamps `motorFault`/`motorI2c` to binary flags");
assertContains("firmware low VIN recovery publishes BLE event", firmwareLogic, "currentFault = FAULT_NONE;              // clear latched fault\n    enterMode(MODE_IDLE);\n    sendBLEEvent(\"VIN_RECOVER\");");
assertContains("firmware low VIN trip threshold", firmwareLogic, "VIN_TRIP_V = 9.8f");
assertContains("firmware low VIN recovery threshold", firmwareLogic, "VIN_RECOVER_V = 10.3f");
assertContains("firmware low VIN debounce", firmwareLogic, "VIN_TRIP_MS = 200");
assertContains("firmware VIN filter first sample init flag", firmwareSensor, "static bool vinLPInit = false;");
assertContains("firmware VIN filter initializes from first ADC sample", firmwareSensor, "if (!vinLPInit) {\n    vinLP = now;\n    vinLPInit = true;\n    return vinLP;\n  }");
assertContains("firmware README low VIN thresholds", firmwareReadme, "Filtered VIN below `9.8 V` for more than `200 ms` raises `FAULT_LOW_VIN`");
assertContains("firmware README low VIN recovery threshold", firmwareReadme, "Low-VIN recovery above `10.3 V` clears `FAULT_LOW_VIN`");
assertContains("protocol docs low VIN thresholds", protocolDoc, "Filtered VIN below `9.8 V` for more than `200 ms` raises `FAULT_LOW_VIN`");
assertContains("protocol docs low VIN first ADC init", protocolDoc, "VIN filter initializes from the first ADC reading instead of a synthetic `0 V` value");
assertContains("protocol docs low VIN recovery threshold", protocolDoc, "recovers above `10.3 V`");
assertContains("protocol docs low VIN recovery event", protocolDoc, "`VIN_RECOVER` BLE event path");
assertContains("release checklist low VIN first ADC init", releaseChecklistDoc, "the filtered VIN initializes from the first ADC reading rather than a synthetic `0 V` boot value");
assertContains("release checklist low VIN retained evidence", releaseChecklistDoc, "records retained `FAULT_LOW_VIN` evidence");
assertContains("release checklist low VIN recovery event", releaseChecklistDoc, "immediately publishes the `VIN_RECOVER` BLE mode/fault update");
assertContains("release checklist low VIN evidence preserved", releaseChecklistDoc, "does not erase the retained fault row");
assertContains("mobile settings idle and fault guard", mobileApp, "const settingsWriteAllowed =\n    canUseDevice &&\n    protocolCompatible &&");
assertContains("mobile settings writes require verified full readback", mobileApp, "settingsReadbackValid &&\n    telemetry.mode === \"0\"");
assertContains("mobile settings connect preload is session scoped", mobileApp, "await loadSettings(discovered, sessionId);");
assertContains("mobile settings loader carries session identity", mobileApp, "async function loadSettings(device = connectedDevice, sessionId = deviceSessionIdRef.current)");
assertContains("mobile settings stale session readback discarded", mobileApp, "if (!isCurrentDeviceSession(device, sessionId)) return;");
assertContains("mobile settings refresh invalidates write gate before transport read", mobileApp, "if (isCurrentDeviceSession(device, sessionId)) setSettingsReadbackValid(false);\n    const raw = await readUtf8(device, OZEALIS_CHARACTERISTICS.settings);");
assertContains("mobile settings loader fails closed on incomplete schema", mobileApp, "throw new Error(\"Settings readback was incomplete or invalid.\");");
assertContains("mobile settings manual refresh captures session", mobileApp, "const sessionId = deviceSessionIdRef.current;\n    setBusy(true);");
assertContains("mobile settings manual refresh passes captured session", mobileApp, "await loadSettings(readDevice, sessionId);");
assertContains("mobile settings manual refresh suppresses stale success", mobileApp, "if (!isCurrentDeviceSession(readDevice, sessionId)) return;\n      setMessage(advancedModeRef.current ? \"Settings loaded from device.\" : \"Comfort updated.\");");
assertContains("mobile settings manual refresh suppresses stale failure", mobileApp, "catch (error) {\n      if (!isCurrentDeviceSession(readDevice, sessionId)) return;\n      setMessage(actionErrorMessage(error, \"Could not update comfort.\", \"Could not read settings.\"));");
assertContains("mobile settings manual refresh does not clear newer busy state", mobileApp, "if (isCurrentDeviceSession(readDevice, sessionId)) setBusy(false);");
assertContains("mobile settings protocol mismatch alert", mobileApp, "Writes require the expected Ozealis BLE protocol version");
assertContains("mobile settings write-time protocol recheck", mobileApp, "advanced: \"Writes require the expected Ozealis BLE protocol version.\"");
assertContains("mobile simple settings protocol recheck copy", mobileApp, "simple: \"This app and device do not match. Update the app or firmware, then try again.\"");
assertContains("mobile settings fresh idle readback message", mobileApp, "Settings writes require a fresh idle, no-fault, no-calibration readback");
assertContains("mobile settings write suppresses stale failure message", mobileApp, "catch (error) {\n      if (!isCurrentDeviceSession(writeDevice, sessionId)) return;\n      setSettingsReadbackValid(false);\n      setMessage(actionErrorMessage(error, \"Comfort did not save. Try again from standby.\", \"Settings write failed.\"));");
assertContains("mobile settings write invalidates gate before transport write", mobileApp, "setSettingsReadbackValid(false);\n      await writeUtf8(writeDevice, OZEALIS_CHARACTERISTICS.settings, serializeSettings(safe));");
assertContains("mobile settings write transport failure remains fail closed", mobileApp, "catch (error) {\n      if (!isCurrentDeviceSession(writeDevice, sessionId)) return;\n      setSettingsReadbackValid(false);");
assertContains("mobile settings write does not clear newer busy state", mobileApp, "finally {\n      if (isCurrentDeviceSession(writeDevice, sessionId)) setBusy(false);");
assertContains("mobile simple settings idle recheck copy", mobileApp, "simple: \"Stop airflow or setup, then try again.\"");
assertContains("protocol docs settings idle and fault guard", protocolDoc, "settings configuration writes only while the system is idle, the reported fault code is `0`");
assertContains("mobile docs settings fresh readback", mobileDoc, "rereads mode, fault, and calibration status immediately before the final write");
assertContains("mobile docs settings stale readback discard", mobileDoc, "Settings refreshes discard stale readbacks if the active connected session changes before the read returns");
assertContains("mobile docs settings adjusted mode", mobileDoc, "Mode adjustments name the actual sanitized mode");
assertContains("mobile docs settings readback", mobileDoc, "reread the settings characteristic and display the device-confirmed values");
assertContains("mobile docs simple settings adjusted readback", mobileDoc, "Simple mode says comfort was saved with device adjustments only when the settings readback is a valid JSON object");
assertContains("mobile docs settings invalid readback fails closed", mobileDoc, "malformed, primitive, array, empty, or partial objects fail closed");
assertContains("mobile docs firmware settings boot writeback", mobileDoc, "rewrites sanitized boot-loaded settings back to the `cpap` NVS namespace");
assertContains("mobile validation test script", mobilePackage, "\"test:validation\"");
assertContains("mobile retained CSV transfer test script", mobilePackage, "\"test:csv-transfer\"");
assertContains("mobile PLX oximetry test script", mobilePackage, "\"test:plx-oximetry\"");
assertContains("mobile Expo compatibility check script", mobilePackage, "\"check:expo\"");
assertContains("mobile production audit script", mobilePackage, "\"audit:prod\": \"npm audit --omit=dev\"");
assertContains("mobile audit summary script", mobilePackage, "\"audit:summary\": \"node ../scripts/summarize-mobile-audit.mjs\"");
assertContains("mobile package declares Node 22 engine", mobilePackage, "\"node\": \"22.x\"");
assertContains("mobile lockfile records Node 22 engine", mobilePackageLock, "\"engines\": {\n        \"node\": \"22.x\"\n      }");
assertContains("mobile audit summary reports spawn errors", read("scripts/summarize-mobile-audit.mjs"), "Could not start npm audit");
assertContains("mobile audit summary reports signal termination", read("scripts/summarize-mobile-audit.mjs"), "npm audit terminated by signal");
assertContains("mobile audit summary reads reviewed baseline", mobileAuditSummary, "docs/mobile-audit-baseline.json");
assertContains("mobile audit summary exact comparison", mobileAuditSummary, "JSON.stringify(observed) !== JSON.stringify(expected)");
assertContains("mobile audit summary rejects baseline drift", mobileAuditSummary, "Mobile production audit differs from the reviewed baseline");
assertContains("local verifier command in README", topReadme, "node scripts/verify-local.mjs");
assertContains("README pins local PlatformIO core version", topReadme, "PlatformIO Core `6.1.19`");
assertContains("firmware README pins PlatformIO core version", firmwareReadme, "PlatformIO Core `6.1.19`");
assertContains("README installs managed Python 3.12", topReadme, "uv python install 3.12");
assertContains("README creates repository Python environment", topReadme, "uv venv --python 3.12 .venv");
assertContains("README installs exact requirements into repository environment", topReadme, "uv pip install --python .venv --requirement requirements-ci.txt");
assertContains("firmware README installs managed Python 3.12", firmwareReadme, "uv python install 3.12");
assertContains("firmware README creates repository Python environment", firmwareReadme, "uv venv --python 3.12 .venv");
assertContains("firmware README installs exact requirements into repository environment", firmwareReadme, "uv pip install --python .venv --requirement requirements-ci.txt");
assertExactText("CI Python requirements", ciRequirements, `${[
  "# Exact PlatformIO Core dependency closure reviewed on 2026-07-29.",
  "ajsonrpc==1.2.0",
  "anyio==4.14.2",
  "bottle==0.13.4",
  "certifi==2026.7.22",
  "chardet==5.2.0",
  "charset-normalizer==3.4.9",
  "click==8.3.3",
  "colorama==0.4.6",
  "h11==0.16.0",
  "idna==3.18",
  "marshmallow==3.26.2",
  "packaging==26.2",
  "platformio==6.1.19",
  "pyelftools==0.33",
  "pyserial==3.5",
  "requests==2.34.2",
  "semantic-version==2.10.0",
  "starlette==0.52.1",
  "tabulate==0.10.0",
  "typing-extensions==4.15.0",
  "urllib3==2.7.0",
  "uvicorn==0.40.0",
  "wsproto==1.3.2",
].join("\n")}\n`);
assertContains("README local verifier Simple copy summary", topReadme, "mobile Simple-mode copy check");
assertContains("local verifier command in release checklist", releaseChecklistDoc, "node scripts/verify-local.mjs");
assertContains("local verifier protocol step", localVerifier, "scripts/verify-protocol.mjs");
assertContains("local verifier release text step", localVerifier, "scripts/verify-release-text.mjs");
assertContains("local verifier doc links step", localVerifier, "scripts/verify-doc-links.mjs");
assertContains("local verifier mobile Simple copy step", localVerifier, "scripts/verify-mobile-simple-copy.mjs");
assertContains("doc link verifier recursive markdown", read("scripts/verify-doc-links.mjs"), "collectMarkdown(root)");
assertContains("doc link verifier repo-relative paths", read("scripts/verify-doc-links.mjs"), "function repoRelative(file)");
assertContains("doc link verifier slash-normalized paths", read("scripts/verify-doc-links.mjs"), "replace(/\\\\/g, \"/\")");
assertContains("doc link verifier markdown anchor check", read("scripts/verify-doc-links.mjs"), "missing Markdown anchor");
assertContains("doc link verifier local anchor support", read("scripts/verify-doc-links.mjs"), "const resolved = pathPart ? resolve(dirname(file), pathPart) : file");
assertContains("doc link verifier rejects empty links", read("scripts/verify-doc-links.mjs"), "empty ${label}");
assertContains("doc link verifier captures empty inline links", read("scripts/verify-doc-links.mjs"), "([^)]*)");
assertContains("doc link verifier skips generated Expo output", read("scripts/verify-doc-links.mjs"), "\".expo-web-smoke\"");
assertContains("doc link verifier skips native Android output", read("scripts/verify-doc-links.mjs"), "\"android\"");
assertContains("doc link verifier skips native iOS output", read("scripts/verify-doc-links.mjs"), "\"ios\"");
assertContains("doc link verifier skips web-build output", read("scripts/verify-doc-links.mjs"), "\"web-build\"");
assertContains("doc link verifier traversal uses shared skip set", read("scripts/verify-doc-links.mjs"), "if (skipDirs.has(entry.name)) continue;");
assertContains("doc link verifier reference definition parser", read("scripts/verify-doc-links.mjs"), "parseReferenceDefinitions");
assertContains("doc link verifier missing reference definition check", read("scripts/verify-doc-links.mjs"), "missing reference link definition");
assertContains("doc link verifier github slug helper", read("scripts/verify-doc-links.mjs"), "function githubSlug(text)");
assertContains("local verifier enforces Node 22 runtime", localVerifier, "nodeMajor !== 22");
assertContains("local verifier reports active Node runtime", localVerifier, "found ${process.versions.node}");
assertContains("local verifier clean mobile npm ci", localVerifier, "\"ci\", \"--ignore-scripts\"");
assertAbsent("local verifier must not use stale dependency dry run", localVerifier, "\"--dry-run\"");
assertContains("release checklist clean local npm ci", releaseChecklistDoc, "clean mobile lockfile install `npm ci --ignore-scripts`");
assertContains("CI mobile npm ci ignores lifecycle scripts", ciWorkflow, "npm ci --ignore-scripts");
assertContains("CI pins mobile Node 22", ciWorkflow, "node-version: 22");
assertContains("README documents mobile Node 22", topReadme, "Use Node.js `22.x` for mobile commands");
assertContains("README mobile setup uses npm ci without lifecycle scripts", topReadme, "npm ci --ignore-scripts");
assertContains("mobile docs document Node 22", mobileDoc, "Use Node.js `22.x` for mobile commands");
assertContains("mobile docs setup uses npm ci without lifecycle scripts", mobileDoc, "npm ci --ignore-scripts");
assertContains("release checklist documents mobile Node 22", releaseChecklistDoc, "Mobile Node.js `22.x` engine metadata is declared");
assertContains("release checklist documents lockfile root consistency", releaseChecklistDoc, "lockfile root name, version, dependencies, and devDependencies match `mobile/package.json`");
assertContains("release checklist documents mobile identity metadata", releaseChecklistDoc, "Mobile app identity metadata is internally consistent");
assertContains("CI workflow uses read-only repository token", ciWorkflow, "permissions:\n  contents: read");
assertContains("CI workflow structurally checks read-only token", read("scripts/verify-protocol.mjs"), "function assertCiWorkflowPermissions()");
assertContains("CI workflow rejects extra permission scopes", read("scripts/verify-protocol.mjs"), "CI workflow permissions must contain only contents: read");
assertContains("CI references pinned PlatformIO requirements", ciWorkflow, "requirements-ci.txt");
assertContains("CI caches from pinned Python requirements", ciWorkflow, "cache-dependency-path: requirements-ci.txt");
assertContains("CI installs pinned Python requirements", ciWorkflow, "python -m pip install --upgrade -r requirements-ci.txt");
assertContains("local verifier probes Python 3.12 launcher", localVerifier, "python3.12");
assertContains("local verifier probes generic Python 3 launcher", localVerifier, "python3");
assertContains("local verifier probes Windows Python launcher", localVerifier, '{ command: "py", prefixArgs: ["-3.12"] }');
assertContains("local verifier prefers repository Python environment", localVerifier, 'resolve(root, ".venv"');
assertContains("local verifier requires Python 3.12 and pinned PlatformIO", localVerifier, "output === \"3.12 6.1.19\"");
assertContains("local verifier explains exact requirements install", localVerifier, "install the exact requirements-ci.txt closure");
assertContains("release checklist CI mobile npm ci ignores scripts", releaseChecklistDoc, "part of both the local source-release gate and CI");
assertContains("release checklist CI read-only token", releaseChecklistDoc, "CI workflow keeps `GITHUB_TOKEN` at read-only repository contents permission");
assertContains("local verifier Expo step", localVerifier, "\"check:expo\"");
assertContains("local verifier mobile audit summary step", localVerifier, "\"audit:summary\"");
assertContains("local verifier mobile validation step", localVerifier, "\"test:validation\"");
assertContains("local verifier mobile retained CSV transfer step", localVerifier, "\"test:csv-transfer\"");
assertContains("local verifier mobile PLX oximetry step", localVerifier, "\"test:plx-oximetry\"");
assertContains("local verifier typecheck step", localVerifier, "\"typecheck\"");
assertContains("local verifier web export smoke step", localVerifier, "\"test:web-export\"");
assertContains("local verifier disables Expo telemetry writes", localVerifier, 'EXPO_NO_TELEMETRY: "1"');
assertContains("web export smoke script checks index", read("scripts/verify-mobile-web-export.mjs"), "did not produce index.html");
assertContains("web export smoke script checks nonempty JS bundle", read("scripts/verify-mobile-web-export.mjs"), "did not produce a non-empty JS bundle");
assertContains("web export smoke script scans generated JS recursively", read("scripts/verify-mobile-web-export.mjs"), "function hasNonEmptyJsBundle");
assertContains("web export smoke script cleans output", read("scripts/verify-mobile-web-export.mjs"), "rmSync(outputDir, { recursive: true, force: true })");
assertContains("web export smoke script disables Expo telemetry writes", read("scripts/verify-mobile-web-export.mjs"), 'EXPO_NO_TELEMETRY: "1"');
assertContains("mobile docs web export smoke JS bundle check", mobileDoc, "requires both `index.html` and a non-empty generated JavaScript bundle");
assertOrder("CI mobile hygiene runs after web export smoke", ciWorkflow, "run: npm run test:web-export", "Verify repository hygiene after mobile export smoke");
assertContains("release checklist CI mobile hygiene after export", releaseChecklistDoc, "CI must run repository hygiene after the mobile web export smoke");
assertContains("local verifier reports spawn errors", localVerifier, "could not start");
assertContains("local verifier reports signal termination", localVerifier, "terminated by signal");
assertContains("local verifier firmware build step", localVerifier, "platformio");
assertContains("local verifier default firmware env", localVerifier, "\"esp32dev\"");
assertContains("local verifier bench PWM build step", localVerifier, "esp32dev_bench_pwm");
assertContains("local verifier flash budget step", localVerifier, "scripts/check-firmware-size.mjs");
assertContains("firmware flash budget checks default env", read("scripts/check-firmware-size.mjs"), "\"esp32dev\"");
assertContains("firmware flash budget checks bench PWM env", read("scripts/check-firmware-size.mjs"), "\"esp32dev_bench_pwm\"");
assertContains("firmware flash budget checks bench PWM bin", read("scripts/check-firmware-size.mjs"), "esp32dev_bench_pwm/firmware.bin");
assertContains("firmware flash budget reports missing images clearly", read("scripts/check-firmware-size.mjs"), "Run the PlatformIO build before checking flash budget");
assertContains("firmware flash budget reads partition CSV", read("scripts/check-firmware-size.mjs"), "firmware/Rev 2/min_spiffs.csv");
assertContains("firmware flash budget checks OTA app slots", read("scripts/check-firmware-size.mjs"), "subtype?.startsWith(\"ota_\")");
assertContains("firmware flash budget requires ota_0 slot", read("scripts/check-firmware-size.mjs"), "\"ota_0\"");
assertContains("firmware flash budget requires ota_1 slot", read("scripts/check-firmware-size.mjs"), "\"ota_1\"");
assertContains("firmware flash budget reports missing OTA slots", read("scripts/check-firmware-size.mjs"), "required app OTA partition ${subtype} is missing or malformed");
assertContains("firmware flash budget checks duplicate OTA slots", read("scripts/check-firmware-size.mjs"), "matchingSlots.length > 1");
assertContains("firmware flash budget reports duplicate OTA slots", read("scripts/check-firmware-size.mjs"), "required app OTA partition ${subtype} is duplicated");
assertContains("firmware flash budget reports malformed partition rows", read("scripts/check-firmware-size.mjs"), "partition row is malformed");
assertContains("firmware flash budget validates exact partition rows", read("scripts/check-firmware-size.mjs"), "partition table must contain exactly");
assertContains("firmware flash budget validates flash boundary", read("scripts/check-firmware-size.mjs"), "beyond 4 MB flash boundary");
assertContains("firmware flash budget validates partition overlap", read("scripts/check-firmware-size.mjs"), "overlaps ${previous.name}");
assertContains("firmware flash budget blocks partition drift", read("scripts/check-firmware-size.mjs"), "exceeds ${name} partition size");
assertContains("firmware flash budget parses hex partitions", read("scripts/check-firmware-size.mjs"), "Number.parseInt(text, 16)");
assertContains("local verifier repo hygiene step", localVerifier, "scripts/verify-repo-hygiene.mjs");
assertContains("release text verifier has positive boundary checks", releaseTextVerifier, "requiredText");
assertContains("release text verifier guards mobile safety banner", releaseTextVerifier, "Experimental research platform only. Not approved for diagnosis, treatment, emergency, or life-support use.");
assertContains("release text verifier guards mobile about claims", releaseTextVerifier, "It makes no medical, diagnostic, therapeutic, performance, safety, or reliability claims.");
assertContains("release text verifier guards OTA authenticity warning", releaseTextVerifier, "Only continue with a firmware binary you built and verified.");
assertContains("release text verifier guards observation disclaimer", releaseTextVerifier, "These are not AHI, diagnosis, screening, or treatment guidance.");
assertContains("release text verifier scans CI workflow metadata", releaseTextVerifier, "\".github/workflows/ci.yml\"");
assertContains("release text verifier scans MCF register manifest metadata", releaseTextVerifier, "\"docs/mcf8316d-register-manifest.json\"");
assertContains("release text verifier scans mobile app metadata", releaseTextVerifier, "\"mobile/app.json\"");
assertContains("release text verifier scans mobile package metadata", releaseTextVerifier, "\"mobile/package.json\"");
assertContains("release text verifier scans firmware PlatformIO metadata", releaseTextVerifier, "\"firmware/Rev 2/platformio.ini\"");
assertContains("release text verifier guards Bluetooth permission copy", releaseTextVerifier, "Allow Ozealis Control to connect to nearby Ozealis experimental airflow devices.");
assertContains("release text verifier detects replacement characters", releaseTextVerifier, "\\uFFFD");
assertContains("release text verifier detects UTF-8-as-Latin-1 sequences", releaseTextVerifier, "\\u00C3[\\u0080-\\u00BF]");
assertAbsent("release text verifier permits valid Unicode", releaseTextVerifier, "[^\\x00-\\x7F]");
assertContains("release text verifier scopes allowed context", releaseTextVerifier, "function claimLikePhrases(lower, file)");
assertContains("release text verifier rejects contradictory safe prefix", releaseTextVerifier, "not medical advice; clinically proven");
assertContains("release text verifier requires exact quoted examples", releaseTextVerifier, "exact quoted forbidden-phrase examples");
assertAbsent("release text verifier must not exempt an entire allowed line", releaseTextVerifier, "if (!allowed) {");
assertContains("protocol verifier exact BLE plugin permission copy", read("scripts/verify-protocol.mjs"), "mobile BLE plugin permission copy");
assertContains("protocol verifier exact iOS Bluetooth always copy", read("scripts/verify-protocol.mjs"), "mobile iOS Bluetooth always usage copy");
assertContains("protocol verifier exact iOS Bluetooth peripheral copy", read("scripts/verify-protocol.mjs"), "mobile iOS Bluetooth peripheral usage copy");
assertContains("mobile app metadata Bluetooth permission stays experimental", mobileAppJson, "Ozealis experimental airflow device");
assertAbsent("release text verifier has no broad diagnostic allow-list", releaseTextVerifier, "\"diagnostic\",\n");
assertContains("release text verifier bans spaced medical grade claim", releaseTextVerifier, "label: \"medical grade\"");
assertContains("release text verifier bans medical quality claim", releaseTextVerifier, "label: \"medical quality\"");
assertContains("release text verifier bans clinical quality claim", releaseTextVerifier, "label: \"clinical quality\"");
assertContains("release text verifier bans clinical grade claim", releaseTextVerifier, "label: \"clinical grade\"");
assertContains("release text verifier bans therapeutic claim", releaseTextVerifier, "label: \"therapeutic\"");
assertContains("release text verifier bans compliant claim", releaseTextVerifier, "label: \"compliant\"");
assertContains("release text verifier bans production-ready claim", releaseTextVerifier, "label: \"production-ready\"");
assertContains("release text verifier bans prescription claim", releaseTextVerifier, "label: \"prescription\"");
assertContains("release text verifier allows contribution unvalidated behavior rule", releaseTextVerifier, "\"do not present unvalidated behavior as safe, therapeutic, compliant, or production-ready\"");
assertContains("release text verifier allows experimental settings not prescriptions", releaseTextVerifier, "\"not prescriptions\"");
assertContains("release text verifier bans FDA-approved claim", releaseTextVerifier, "label: \"FDA-approved\"");
assertContains("release text verifier bans regulator-approved claim", releaseTextVerifier, "label: \"regulator-approved\"");
assertContains("release text verifier bans clinically proven claim", releaseTextVerifier, "label: \"clinically proven\"");
assertContains("release text verifier bans validated human use claim", releaseTextVerifier, "label: \"validated for human use\"");
assertContains("release text verifier bans spaced patient ready claim", releaseTextVerifier, "label: \"patient ready\"");
assertContains("release text verifier bans ready for clinical use claim", releaseTextVerifier, "label: \"ready for clinical use\"");
assertContains("release text verifier bans sleep apnea treatment claim", releaseTextVerifier, "label: \"sleep apnea treatment\"");
assertContains("release text verifier bans sleep apnea screening claim", releaseTextVerifier, "label: \"sleep apnea screening\"");
assertContains("release text verifier bans screening tool claim", releaseTextVerifier, "label: \"screening tool\"");
assertContains("release text verifier bans screens-for-sleep-apnea claim", releaseTextVerifier, "label: \"screens for sleep apnea\"");
assertContains("release text verifier bans medical advice claim", releaseTextVerifier, "label: \"medical advice\"");
assertAbsent("release text verifier has no broad diagnosis-treatment allow-list", releaseTextVerifier, "\"diagnosis, treatment\",\n");
assertAbsent("release text verifier has no broad diagnosis-screening allow-list", releaseTextVerifier, "\"diagnosis, screening\",\n");
assertContains("release text verifier bans emergency use claim", releaseTextVerifier, "label: \"emergency use\"");
assertContains("release text verifier bans life-support claim", releaseTextVerifier, "label: \"life-support\"");
assertContains("release text verifier bans spaced life support claim", releaseTextVerifier, "label: \"life support\"");
assertContains("release text verifier allows negated human-use validation", releaseTextVerifier, "\"not validated for human use\"");
assertContains("release text verifier bans certified medical device claim", releaseTextVerifier, "label: \"certified medical device\"");
assertContains("safety docs list spaced patient ready claim", safetyDoc, "\"patient ready\"");
assertContains("safety docs list ready for clinical use claim", safetyDoc, "\"ready for clinical use\"");
assertContains("safety docs list sleep apnea treatment claim", safetyDoc, "\"sleep apnea treatment\"");
assertContains("safety docs list therapeutic claim", safetyDoc, "\"therapeutic\"");
assertContains("safety docs list compliant claim", safetyDoc, "\"compliant\"");
assertContains("safety docs list production ready claim", safetyDoc, "\"production ready\"");
assertContains("safety docs list prescription claim", safetyDoc, "\"prescription\"");
assertContains("safety docs list emergency use claim", safetyDoc, "\"emergency use\"");
assertContains("safety docs list life support claim", safetyDoc, "\"life support\"");
assertContains("release text verifier guards contributing no claims rule", releaseTextVerifier, "Do not make medical, diagnostic, screening, treatment, cure, prevention, or emergency-use claims.");
assertContains("release text verifier guards contributing screening boundary", releaseTextVerifier, "Documentation avoids claims that the project treats, diagnoses, screens for, prevents, or cures disease.");
assertContains("release text verifier guards contributing unvalidated behavior rule", releaseTextVerifier, "Do not present unvalidated behavior as safe, therapeutic, compliant, or production-ready.");
assertContains("release text verifier guards security Just Works boundary", releaseTextVerifier, "does not provide passkey verification");
assertContains("release text verifier guards no app authorization boundary", releaseTextVerifier, "There is no app-layer authorization, rotating key, or documented physical commissioning flow yet.");
assertContains("release text verifier guards app not safety boundary", releaseTextVerifier, "The mobile app is a control surface, not a safety boundary.");
assertContains("doc link verifier rejects machine-local links", docLinksVerifier, "isForbiddenLocalMachineLink");
assertContains("doc link verifier rejects file URI links", docLinksVerifier, "/^file:/i");
assertContains("doc link verifier rejects absolute repo paths", docLinksVerifier, "isRepoAbsolutePath");
assertContains("doc link verifier rejects placeholder hosts", docLinksVerifier, "isPlaceholderExternalLink");
assertContains("doc link verifier reports placeholder external links", docLinksVerifier, "placeholder external link");
assertContains("firmware PlatformIO custom partition reference", firmwarePlatformio, "board_build.partitions = min_spiffs.csv");
assertContains("firmware PlatformIO default env", firmwarePlatformio, "default_envs = esp32dev");
assertContains("firmware PlatformIO bench PWM env", firmwarePlatformio, "[env:esp32dev_bench_pwm]");
assertContains("firmware PlatformIO bench PWM flag", firmwarePlatformio, "OZEALIS_BENCH_PWM_SPEED_FALLBACK=1");
assertContains("release checklist pins PlatformIO core version", releaseChecklistDoc, "PlatformIO Core `6.1.19` and its reviewed Python dependency closure");
assertContains("release checklist pins PlatformIO requirements file", releaseChecklistDoc, "installed from `requirements-ci.txt`");
assertContains("release checklist documents PlatformIO metadata shape", releaseChecklistDoc, "Firmware PlatformIO metadata keeps `src_dir=ozealis`, default environment `esp32dev`, release build type");
assertContains("release checklist pins firmware platform version", releaseChecklistDoc, "exact `espressif32@6.13.0`, ESP32 Arduino framework/toolchain/upload package pins");
assertContains("release checklist documents native build scripts", releaseChecklistDoc, "`npm run android:dev-build` / `npm run ios:dev-build`");
assertContains("CI bench PWM build", ciWorkflow, "esp32dev_bench_pwm");
assertContains("CI default firmware env", ciWorkflow, "-e esp32dev");
assertContains("CI repository hygiene check", ciWorkflow, "node scripts/verify-repo-hygiene.mjs");
assertContains("repo hygiene generated path list", repoHygieneVerifier, "generatedPaths");
assertContains("repo hygiene allowed root directory list", repoHygieneVerifier, "allowedRootDirectories");
assertContains("repo hygiene checks duplicate root directories", repoHygieneVerifier, "assertUniqueList(\"allowedRootDirectories\", allowedRootDirectories);");
assertContains("repo hygiene rejects unlisted root directories", repoHygieneVerifier, "top-level directory is present but not listed in allowedRootDirectories or ignored");
assertContains("repo hygiene required hardware artifact list", repoHygieneVerifier, "requiredHardwareArtifacts");
assertContains("repo hygiene batches release artifact tracking", repoHygieneVerifier, "gitTrackedPaths(requiredReleaseArtifacts)");
assertContains("repo hygiene checks hardware artifact tracking", repoHygieneVerifier, "required hardware release artifact is not tracked");
assertContains("repo hygiene requires interactive BOM", repoHygieneVerifier, "InteractiveBOM_PCB1_2025-7-8.html");
assertContains("repo hygiene requires EasyEDA project", repoHygieneVerifier, "ProPrj_Ozealis_2025-07-08.epro");
assertContains("repo hygiene requires printable part", repoHygieneVerifier, "PumpOutlet.3mf");
assertContains("repo hygiene scans actual hardware tree", repoHygieneVerifier, "collectFiles(\"hardware\")");
assertContains("repo hygiene rejects unlisted hardware artifacts", repoHygieneVerifier, "hardware artifact is present but not listed in requiredHardwareArtifacts");
assertContains("repo hygiene requires source-release artifacts list", repoHygieneVerifier, "requiredSourceReleaseArtifacts");
assertContains("repo hygiene checks source artifact tracking", repoHygieneVerifier, "required source-release artifact is not tracked");
assertContains("repo hygiene requires safety doc", repoHygieneVerifier, "SAFETY.md");
assertContains("repo hygiene requires CI Python requirements", repoHygieneVerifier, "requirements-ci.txt");
assertContains("repo hygiene requires top-level instructions", repoHygieneVerifier, "instructions.md");
assertContains("repo hygiene scans top-level files", repoHygieneVerifier, "collectRootFiles()");
assertContains("repo hygiene allows ignored top-level local output", repoHygieneVerifier, "isGitIgnored(relativePath)");
assertContains("repo hygiene rejects unlisted top-level artifacts", repoHygieneVerifier, "top-level artifact is present but not listed in requiredSourceReleaseArtifacts or ignored");
assertContains("repo hygiene requires CI workflow", repoHygieneVerifier, ".github/workflows/ci.yml");
assertContains("repo hygiene scans GitHub metadata tree", repoHygieneVerifier, "collectFiles(\".github\")");
assertContains("repo hygiene rejects unlisted GitHub metadata", repoHygieneVerifier, "GitHub metadata artifact is present but not listed in requiredSourceReleaseArtifacts");
assertContains("repo hygiene requires firmware Rev 2 README", repoHygieneVerifier, "firmware/Rev 2/README.md");
assertContains("repo hygiene requires firmware main source", repoHygieneVerifier, "firmware/Rev 2/ozealis/ozealis.ino");
assertContains("repo hygiene requires firmware BLE source", repoHygieneVerifier, "firmware/Rev 2/ozealis/ble.cpp");
assertContains("repo hygiene requires firmware logic source", repoHygieneVerifier, "firmware/Rev 2/ozealis/logic.cpp");
assertContains("repo hygiene requires firmware motor source", repoHygieneVerifier, "firmware/Rev 2/ozealis/motor.cpp");
assertContains("repo hygiene requires firmware motor calibration source", repoHygieneVerifier, "firmware/Rev 2/ozealis/motor_calibration.cpp");
assertContains("repo hygiene requires firmware pressure limits header", repoHygieneVerifier, "firmware/Rev 2/ozealis/pressure_limits.h");
assertContains("repo hygiene requires firmware sensor source", repoHygieneVerifier, "firmware/Rev 2/ozealis/sensor.cpp");
assertContains("repo hygiene requires firmware OTA source", repoHygieneVerifier, "firmware/Rev 2/ozealis/ota_secure.cpp");
assertContains("repo hygiene scans actual firmware Rev 2 tree", repoHygieneVerifier, "collectFiles(\"firmware/Rev 2\"");
assertContains("repo hygiene skips firmware generated PlatformIO tree", repoHygieneVerifier, "firmware/Rev 2/.pio");
assertContains("repo hygiene rejects unlisted firmware artifacts", repoHygieneVerifier, "firmware artifact is present but not listed in requiredSourceReleaseArtifacts");
assertContains("repo hygiene requires project picture body", repoHygieneVerifier, "pictures/body.png");
assertContains("repo hygiene requires project picture muffler", repoHygieneVerifier, "pictures/muffler.png");
assertContains("repo hygiene requires project picture pcb", repoHygieneVerifier, "pictures/pcb.png");
assertContains("repo hygiene scans actual pictures tree", repoHygieneVerifier, "collectFiles(\"pictures\")");
assertContains("repo hygiene rejects unlisted picture artifacts", repoHygieneVerifier, "picture artifact is present but not listed in requiredSourceReleaseArtifacts");
assertContains("repo hygiene requires mobile app manifest", repoHygieneVerifier, "mobile/app.json");
assertContains("repo hygiene requires mobile local gitignore", repoHygieneVerifier, "mobile/.gitignore");
assertContains("repo hygiene requires mobile app entry", repoHygieneVerifier, "mobile/App.tsx");
assertContains("repo hygiene requires mobile root registration", repoHygieneVerifier, "mobile/index.ts");
assertContains("repo hygiene requires mobile tsconfig", repoHygieneVerifier, "mobile/tsconfig.json");
assertContains("repo hygiene requires mobile icon asset", repoHygieneVerifier, "mobile/assets/icon.png");
assertContains("repo hygiene requires mobile Android foreground asset", repoHygieneVerifier, "mobile/assets/android-icon-foreground.png");
assertContains("repo hygiene requires mobile BLE source", repoHygieneVerifier, "mobile/src/ozealisBle.ts");
assertContains("repo hygiene requires mobile PLX oximetry source", repoHygieneVerifier, "mobile/src/plxOximetry.ts");
assertContains("repo hygiene requires mobile retained CSV transfer source", repoHygieneVerifier, "mobile/src/csvTransfer.ts");
assertContains("repo hygiene requires mobile audit baseline", repoHygieneVerifier, "docs/mobile-audit-baseline.json");
assertContains("repo hygiene requires mobile validation source", repoHygieneVerifier, "mobile/src/validation.ts");
assertContains("repo hygiene scans actual mobile tree", repoHygieneVerifier, "collectFiles(\"mobile\"");
assertContains("repo hygiene skips mobile generated tree", repoHygieneVerifier, "mobile/.expo-web-smoke");
assertContains("repo hygiene rejects unlisted mobile artifacts", repoHygieneVerifier, "mobile source artifact is present but not listed in requiredSourceReleaseArtifacts");
assertContains("repo hygiene requires mobile audit doc", repoHygieneVerifier, "docs/mobile-audit.md");
assertContains("repo hygiene requires motor calibration doc", repoHygieneVerifier, "docs/motor-calibration.md");
assertContains("repo hygiene requires Rev 3 motor driver doc", repoHygieneVerifier, "docs/rev3-motor-driver.md");
assertContains("repo hygiene requires MCF bring-up doc", repoHygieneVerifier, "docs/mcf8316d-bringup.md");
assertContains("repo hygiene requires MCF commissioning doc", repoHygieneVerifier, "docs/mcf8316d-commissioning.md");
assertContains("repo hygiene requires MCF register manifest", repoHygieneVerifier, "docs/mcf8316d-register-manifest.json");
assertContains("repo hygiene scans actual docs tree", repoHygieneVerifier, "collectFiles(\"docs\")");
assertContains("repo hygiene rejects unlisted docs artifacts", repoHygieneVerifier, "documentation artifact is present but not listed in requiredSourceReleaseArtifacts");
assertContains("repo hygiene requires mobile lockfile", repoHygieneVerifier, "mobile/package-lock.json");
assertContains("repo hygiene requires firmware size verifier", repoHygieneVerifier, "scripts/check-firmware-size.mjs");
assertContains("repo hygiene requires release text verifier", repoHygieneVerifier, "scripts/verify-release-text.mjs");
assertContains("repo hygiene requires doc link verifier", repoHygieneVerifier, "scripts/verify-doc-links.mjs");
assertContains("repo hygiene requires repo hygiene verifier", repoHygieneVerifier, "scripts/verify-repo-hygiene.mjs");
assertContains("repo hygiene requires web export verifier", repoHygieneVerifier, "scripts/verify-mobile-web-export.mjs");
assertContains("repo hygiene requires mobile Simple copy verifier", repoHygieneVerifier, "scripts/verify-mobile-simple-copy.mjs");
assertContains("repo hygiene requires mobile validation tests", repoHygieneVerifier, "scripts/test-mobile-validation.mjs");
assertContains("repo hygiene requires mobile PLX oximetry tests", repoHygieneVerifier, "scripts/test-mobile-plx-oximetry.mjs");
assertContains("repo hygiene requires mobile retained CSV transfer tests", repoHygieneVerifier, "scripts/test-mobile-csv-transfer.mjs");
assertContains("repo hygiene requires audit summary script", repoHygieneVerifier, "scripts/summarize-mobile-audit.mjs");
assertContains("repo hygiene scans actual scripts tree", repoHygieneVerifier, "collectFiles(\"scripts\")");
assertContains("repo hygiene rejects unlisted script artifacts", repoHygieneVerifier, "script artifact is present but not listed in requiredSourceReleaseArtifacts");
assertContains("repo hygiene rejects ignored source-release artifacts", repoHygieneVerifier, "required source-release artifact is ignored");
assertContains("repo hygiene uses git check-ignore", repoHygieneVerifier, "git\", [\"check-ignore\"");
assertContains("repo hygiene batches gitignore policy checks", repoHygieneVerifier, "gitIgnoredPaths(");
assertContains("repo hygiene checks PlatformIO output", repoHygieneVerifier, "firmware/Rev 2/.pio");
assertContains("repo hygiene checks preview log output", repoHygieneVerifier, ".expo-web-preview.err.log");
assertContains("repo hygiene checks mobile node_modules", repoHygieneVerifier, "mobile/node_modules");
assertContains("repo hygiene checks web export smoke output", repoHygieneVerifier, "mobile/.expo-web-smoke");
assertContains("repo hygiene reports git spawn errors", repoHygieneVerifier, "could not start git check-ignore");
assertContains("repo hygiene reports git signal termination", repoHygieneVerifier, "terminated by signal");
assertContains("repo hygiene keeps env example trackable", repoHygieneVerifier, ".env.example must remain trackable");
assertContains("repo hygiene checks gitattributes", repoHygieneVerifier, "requiredGitAttributeLines");
assertContains("repo hygiene reports missing gitattributes rules", repoHygieneVerifier, ".gitattributes missing required rule");
assertContains("repo hygiene duplicate helper", repoHygieneVerifier, "function assertUniqueList");
assertContains("repo hygiene reports duplicate entries", repoHygieneVerifier, "contains duplicate entry");
assertContains("repo hygiene checks duplicate source artifacts", repoHygieneVerifier, "assertUniqueList(\"requiredSourceReleaseArtifacts\", requiredSourceReleaseArtifacts);");
assertContains("repo hygiene checks duplicate hardware artifacts", repoHygieneVerifier, "assertUniqueList(\"requiredHardwareArtifacts\", requiredHardwareArtifacts);");
assertContains("repo hygiene checks duplicate generated paths", repoHygieneVerifier, "assertUniqueList(\"generatedPaths\", generatedPaths);");
assertContains("repo hygiene checks duplicate gitignore fragments", repoHygieneVerifier, "assertUniqueList(\"requiredGitignoreFragments\", requiredGitignoreFragments);");
assertContains("repo hygiene requires log ignore", repoHygieneVerifier, "*.log");
assertContains("repo hygiene checks duplicate gitattributes rules", repoHygieneVerifier, "assertUniqueList(\"requiredGitAttributeLines\", requiredGitAttributeLines);");
assertContains("repo hygiene checks required LF text extensions", repoHygieneVerifier, "requiredLfTextExtensions");
assertContains("repo hygiene reports CRLF text artifacts", repoHygieneVerifier, "text artifact must use LF line endings per .gitattributes");
assertContains("repo hygiene requires firmware LF", repoHygieneVerifier, "*.cpp text eol=lf");
assertContains("repo hygiene requires text export LF", repoHygieneVerifier, "*.txt text eol=lf");
assertContains("repo hygiene requires hardware BOM HTML LF", repoHygieneVerifier, "*.html text eol=lf");
assertContains("repo hygiene requires PowerShell CRLF", repoHygieneVerifier, "*.ps1 text eol=crlf");
assertContains("repo hygiene requires image binary", repoHygieneVerifier, "*.png binary");
assertContains("release checklist doc link hygiene gate", releaseChecklistDoc, "Documentation link verifier passes, including rejection of empty links");
assertContains("release checklist doc link generated output scope", releaseChecklistDoc, "while ignoring generated output folders");
assertContains("release checklist source-release hygiene gate", releaseChecklistDoc, "exact required tracked hardware and source-release artifacts with no unlisted files under `hardware/`");
assertContains("release checklist docs exact source gate", releaseChecklistDoc, "exact docs/source manifests with no unlisted files or directories under the repository root, `.github/`, `pictures/`, `docs/`, `scripts/`, non-generated `firmware/Rev 2`, or non-generated `mobile/`");
assertContains("release checklist LF normalized text gate", releaseChecklistDoc, "LF-normalized required text artifacts per `.gitattributes`");
assertContains("release checklist source-release controls gate", releaseChecklistDoc, "required source-release control files such as safety/security docs, CI, lockfiles, firmware source, and exact verifier scripts");
assertContains("release checklist metadata no-claims gate", releaseChecklistDoc, "mobile metadata permission text");
assertContains("release checklist documented unsafe behavior gate", releaseChecklistDoc, "Any known unsafe behavior lacks a documented limitation, mitigation, or test plan.");
assertContains("git attributes CSV LF rule", gitAttributes, "*.csv text eol=lf");
assertContains("git attributes HTML LF rule", gitAttributes, "*.html text eol=lf");
assertContains("firmware checked-in OTA app0 slot", firmwarePartitions, "app0,     app,  ota_0,   0x10000,  0x1E0000");
assertContains("firmware checked-in OTA app1 slot", firmwarePartitions, "app1,     app,  ota_1,   0x1F0000, 0x1E0000");
assertContains("firmware checked-in min SPIFFS slot", firmwarePartitions, "spiffs,   data, spiffs,  0x3D0000, 0x30000");
assertContains("mobile docs Expo compatibility check", mobileDoc, "npm run check:expo");
assertContains("top README Expo compatibility check", topReadme, "npm run check:expo");
assertContains("CI Expo compatibility check", ciWorkflow, "npm run check:expo");
assertContains("CI release text check", ciWorkflow, "node scripts/verify-release-text.mjs");
assertContains("CI mobile audit summary check", ciWorkflow, "npm run audit:summary");
assertContains("CI documentation link check", ciWorkflow, "node scripts/verify-doc-links.mjs");
assertContains("CI mobile Simple-mode copy check", ciWorkflow, "node scripts/verify-mobile-simple-copy.mjs");
assertContains("CI mobile validation test", ciWorkflow, "npm run test:validation");
assertContains("CI mobile retained CSV transfer test", ciWorkflow, "npm run test:csv-transfer");
assertContains("CI mobile PLX oximetry test", ciWorkflow, "npm run test:plx-oximetry");
assertContains("CI mobile web export smoke", ciWorkflow, "npm run test:web-export");
assertContains("CI mobile job disables Expo telemetry writes", ciWorkflow, 'EXPO_NO_TELEMETRY: "1"');
assertContains("CI repository hygiene check", ciWorkflow, "node scripts/verify-repo-hygiene.mjs");
assertContains("mobile audit summary runs production JSON audit", mobileAuditSummary, "\"audit\", \"--omit=dev\", \"--json\"");
assertContains("mobile audit summary blocks high critical advisories", mobileAuditSummary, "High or critical production advisories require explicit review before release.");
assertContains("top README mobile audit doc", topReadme, "docs/mobile-audit.md");
assertContains("top README guarded motor abstraction", topReadme, "guarded motor-driver abstraction");
assertContains("top README motor boundary heading", topReadme, "Current motor-driver boundary");
assertContains("top README default motor command I2C readback", topReadme, "uses the Rev 3 D-variant I2C speed-command register with readback verification");
assertContains("top README bench PWM env boundary", topReadme, "esp32dev_bench_pwm");
assertContains("release checklist mobile audit doc", releaseChecklistDoc, "Mobile Dependency Audit");
assertContains("release checklist mobile audit summary gate", releaseChecklistDoc, "Mobile production audit summary exactly matches the reviewed advisory baseline");
assertContains("release checklist mobile audit summary wraps production audit", releaseChecklistDoc, "`npm run audit:summary` wraps `npm audit --omit=dev --json`");
assertContains("release checklist mobile audit summary blocks high critical", releaseChecklistDoc, "fails on high or critical production advisories");
assertContains("release checklist mobile audit baseline drift gate", releaseChecklistDoc, "fails whenever counts or the normalized vulnerability graph differ from `docs/mobile-audit-baseline.json`");
assertContains("release checklist mobile audit live renderer", releaseChecklistDoc, "`npm run audit:prod` may still be run for the live npm renderer");
assertContains("release checklist mobile web export smoke", releaseChecklistDoc, "npm run test:web-export");
assertContains("release checklist mobile preview command", releaseChecklistDoc, "Mobile preview command remains `npm run web`");
assertContains("release checklist mobile build script absent", releaseChecklistDoc, "intentionally has no `build` script");
assertContains("release checklist repo hygiene gate", releaseChecklistDoc, "Repository hygiene verifier passes");
assertContains("release checklist hardware and source artifacts hygiene", releaseChecklistDoc, "required tracked hardware and source-release artifacts");
assertContains("release checklist both firmware images budgeted", releaseChecklistDoc, "Default and explicit bench PWM firmware images remain under the CI flash budget");
assertContains("release checklist partition table exact rows", releaseChecklistDoc, "exact non-overlapping 4 MB flash rows for `nvs`, `otadata`, `app0`, `app1`, and `spiffs`");
assertContains("release checklist BLE advertising timeout gate", releaseChecklistDoc, "BLE advertising timeout verified to stop advertising only while unconnected");
assertContains("release checklist BLE advertising timeout first-start gate", releaseChecklistDoc, "including when the first pairing request starts the BLE stack");
assertContains("release checklist BLE advertising timeout disconnect gate", releaseChecklistDoc, "and when a connected phone disconnects");
assertContains("release checklist BLE advertising timeout no mode transition", releaseChecklistDoc, "must not force firmware back to idle or change therapy/calibration state");
assertContains("mobile audit command", mobileAuditDoc, "npm run audit:prod");
assertContains("mobile audit summary command", mobileAuditDoc, "npm run audit:summary");
assertContains("mobile audit summary behavior", mobileAuditDoc, "no high or critical production advisories are present and the normalized report exactly matches the reviewed baseline");
assertContains("mobile audit baseline docs link", mobileAuditDoc, "[mobile-audit-baseline.json](mobile-audit-baseline.json)");
assertJsonEqual("mobile audit baseline schema", mobileAuditBaseline.schema, 1);
assertJsonEqual("mobile audit baseline reviewed date", mobileAuditBaseline.reviewed, "2026-07-29");
assertJsonEqual("mobile audit baseline command", mobileAuditBaseline.command, "npm audit --omit=dev --json");
assertJsonEqual("mobile audit baseline moderate count", mobileAuditBaseline.counts?.moderate, 11);
assertJsonEqual("mobile audit baseline high count", mobileAuditBaseline.counts?.high, 0);
assertJsonEqual("mobile audit baseline critical count", mobileAuditBaseline.counts?.critical, 0);
assertJsonEqual("mobile audit baseline vulnerability count", mobileAuditBaseline.vulnerabilities?.length, 11);
assertContains("mobile audit review date", mobileAuditDoc, "Last reviewed: 2026-07-29");
assertContains("mobile audit records high-severity cleanup", mobileAuditDoc, "removed the previously reported high-severity");
assertContains("mobile audit records compatible dev-client patch", mobileAuditDoc, "`expo-dev-client` patch was then aligned to `~56.0.24`");
assertContains("mobile audit current count", mobileAuditDoc, "11 moderate production advisories");
assertContains("mobile audit current summary counts", mobileAuditDoc, "moderate=11 high=0 critical=0 total=11");
assertContains("mobile audit observed reviewed summary block", mobileAuditDoc, "Observed reviewed summary lines included:");
assertContains("mobile audit current named packages", mobileAuditDoc, "the summary names `@expo/cli`, `@expo/config`, `@expo/config-plugins`, `@expo/inline-modules`, `@expo/local-build-cache-provider`, `@expo/metro-config`, `@expo/prebuild-config`, `expo`, `expo-sharing`, `xcode`, and `uuid`");
assertContains("mobile audit current expo-sharing fix", mobileAuditDoc, "fix expo-sharing@14.0.8 (major)");
assertContains("mobile audit current expo major fix", mobileAuditDoc, "fix expo@46.0.21 (major)");
assertContains("mobile audit fix parent variability", mobileAuditDoc, "fixAvailable` parent package can also vary");
assertContains("mobile audit advisory area", mobileAuditDoc, "Expo SDK developer/configuration/prebuild dependency graph");
assertContains("mobile audit exact chain unstable", mobileAuditDoc, "not as a stable source contract");
assertContains("mobile audit no unattended SDK-incompatible fix", mobileAuditDoc, "not valid unattended fixes for this Expo 56 app");
assertContains("mobile audit summary runs production audit", mobileAuditSummary, "\"audit\", \"--omit=dev\", \"--json\"");
assertContains("mobile audit summary validates vulnerability metadata", mobileAuditSummary, "function isAuditCounts");
assertContains("mobile audit summary fails malformed vulnerability metadata", mobileAuditSummary, "npm audit JSON is missing numeric vulnerability metadata.");
assertContains("mobile audit summary requires info count", mobileAuditSummary, "Number.isFinite(value.info)");
assertContains("mobile audit summary requires low count", mobileAuditSummary, "Number.isFinite(value.low)");
assertContains("mobile audit summary checks total consistency", mobileAuditSummary, "counts.total !== expectedTotal");
assertContains("mobile audit summary reports inconsistent total", mobileAuditSummary, "vulnerability total is inconsistent");
assertContains("mobile audit summary high critical gate", mobileAuditSummary, "counts.high");
assertContains("mobile audit summary direct advisory gate", mobileAuditSummary, "blockingAdvisories");
assertContains("mobile audit summary direct high severity", mobileAuditSummary, "item.severity === \"high\"");
assertContains("mobile audit summary direct critical severity", mobileAuditSummary, "item.severity === \"critical\"");
assertContains("firmware README flash budget script", firmwareReadme, "node scripts/check-firmware-size.mjs");
assertContains("release text scans source extensions", read("scripts/verify-release-text.mjs"), "sourceExtensions");
assertContains("release text recursively scans markdown", read("scripts/verify-release-text.mjs"), "collectMarkdownFiles(\".\")");
assertContains("release text recursively scans firmware source", read("scripts/verify-release-text.mjs"), "collectSourceFiles(\"firmware/Rev 2/ozealis\")");
assertContains("release text recursively scans mobile source", read("scripts/verify-release-text.mjs"), "collectSourceFiles(\"mobile\")");
assertContains("release text shared skip dir set", read("scripts/verify-release-text.mjs"), "const skipDirs = new Set");
assertContains("release text skips Expo web smoke output", read("scripts/verify-release-text.mjs"), "\".expo-web-smoke\"");
assertContains("release text skips dist output", read("scripts/verify-release-text.mjs"), "\"dist\"");
assertContains("release text skips build output", read("scripts/verify-release-text.mjs"), "\"build\"");
assertContains("release text traversal uses shared skip set", read("scripts/verify-release-text.mjs"), "if (skipDirs.has(entry.name)) continue;");
assertContains("release text includes markdown extension", read("scripts/verify-release-text.mjs"), "endsWith(\".md\")");
assertContains("AutoPAP header clean cmH2O text", firmwareAutopapHeader, "cmH2O lower bound");
assertContains("AutoPAP header clean delta-P text", firmwareAutopapHeader, "latest delta-P");
assertContains("firmware therapy mode AutoPAP", firmwareAutopapHeader, "MODE_AUTOPAP");
assertContains("firmware therapy mode BiPAP S", firmwareAutopapHeader, "MODE_BIPAP_S");
assertContains("firmware therapy mode BiPAP ST", firmwareAutopapHeader, "MODE_BIPAP_ST");
assertContains("firmware therapy mode BiPAP T", firmwareAutopapHeader, "MODE_BIPAP_T");
assertContains("firmware therapy mode AutoASV", firmwareAutopapHeader, "MODE_AUTO_ASV");
assertContains("firmware therapy mode Auto BiPAP", firmwareAutopapHeader, "MODE_AUTO_BIPAP");
assertContains("firmware therapy mode BiPAP PC", firmwareAutopapHeader, "MODE_BIPAP_PC");
assertContains("firmware therapy mode VAPS", firmwareAutopapHeader, "MODE_VAPS");
assertContains("firmware therapy mode max guard", firmwareBle, "settings.mode > MODE_VAPS");
assertContains("firmware legacy auto migrates to AutoPAP", firmwareBle, "settings.mode == MODE_CPAP && settings.autoPap");
assertContains("firmware auto flag mirrors mode", firmwareBle, "settings.autoPap = modeUsesAutoRange(settings.mode)");
assertContains("firmware CPAP fixes effective max pressure", firmwareBle, "settings.mode == MODE_CPAP ? settings.pMin : settings.pMax");
assertContains("firmware default settings mode is AutoPAP", firmwareHeader, "TherapyMode mode = MODE_AUTOPAP;");
assertContains("firmware advanced modes use bilevel targets", firmwareAutopap, "modeUsesBilevelTargets");
assertContains("mobile therapy mode type expanded", appValidation, "export type TherapyMode = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9");
assertContains("mobile default settings mode is AutoPAP", appValidation, "mode: 1,");
assertContains("mobile legacy auto migrates to AutoPAP", appValidation, "requestedMode === 0 && settings.auto === true ? 1 : requestedMode");
assertContains("mobile auto flag mirrors mode", appValidation, "auto: therapyModeUsesAutoRange(mode)");
assertContains("mobile settings BLE advertising strict boolean", appValidation, "const bleAdv = typeof settings.bleAdv === \"boolean\" ? settings.bleAdv : DEFAULT_SETTINGS.bleAdv");
assertContains("mobile therapy mode labels expanded", appValidation, "BiPAP ST");
assertContains("mobile therapy mode Auto BiPAP label", appValidation, "Auto BiPAP");
assertContains("mobile therapy mode VAPS label", appValidation, "VAPS");
assertContains("mobile advanced therapy mode implementation note", mobileApp, "CPAP and AutoPAP use the current experimental pressure-target logic");
assertContains("mobile advanced therapy mode BiPAP S boundary", mobileApp, "BiPAP S uses an experimental bilevel target family");
assertContains("mobile advanced therapy mode backup timing boundary", mobileApp, "ST/T/PC add experimental backup-rate timing");
assertContains("mobile advanced therapy mode reserved algorithm boundary", mobileApp, "ASV/AutoASV servo adaptation and VAPS volume assurance are not implemented");
assertContains("mobile simple therapy mode set", mobileApp, "const simpleTherapyModeIndexes = [0, 1, 2] as const;");
assertContains("mobile simple therapy mode advanced prop", mobileApp, "advanced={advancedMode}");
assertContains("mobile simple selected builder mode lock", mobileApp, "Switch to Builder in About, then change this in Comfort.");
assertContains("mobile simple builder mode hides simple picker", mobileApp, "{(advanced || currentModeIsVisible) && (");
assertContains("mobile auto flag displayed as mode-derived", mobileApp, "Auto range flag");
assertContains("mobile therapy mode wrap layout", mobileApp, "flexWrap: \"wrap\"");
assertContains("protocol docs settings example explicit AutoPAP mode", protocolDoc, "\"mode\": 1");
assertContains("protocol docs therapy mode AutoASV", protocolDoc, "`6`: AutoASV");
assertContains("protocol docs therapy mode Auto BiPAP", protocolDoc, "`7`: Auto BiPAP");
assertContains("protocol docs therapy mode VAPS", protocolDoc, "`9`: VAPS");
assertContains("protocol docs BiPAP S target-family boundary", protocolDoc, "maps BiPAP S onto an experimental bilevel target family");
assertContains("protocol docs backup timing overlay", protocolDoc, "BiPAP ST/T and BiPAP PC add an experimental backup-rate timing overlay");
assertContains("protocol docs backup interval behavior", protocolDoc, "`backupRate` sets the minimum timed interval");
assertContains("protocol docs timed IPAP behavior", protocolDoc, "`inspTimeMs` sets the timed IPAP window");
assertContains("protocol docs ST spontaneous reset behavior", protocolDoc, "ST/PC spontaneous inspiratory flow resets the backup interval");
assertContains("protocol docs T fixed timing behavior", protocolDoc, "T mode follows the timed interval without spontaneous reset");
assertContains("protocol docs backup timing clamp basis", protocolDoc, "bounded to `4..30` bpm and `300..3000` ms");
assertContains("protocol docs backup timing non-prescription boundary", protocolDoc, "not a prescription model, servo-ventilation algorithm, or validated ventilator feature");
assertContains("protocol docs reserved mode algorithm boundary", protocolDoc, "rather than their named servo, auto-bilevel, or volume-assured algorithms");
assertContains("protocol docs advanced mode boundary", protocolDoc, "Trigger/cycle controls, servo-ventilation adaptation, auto-bilevel adaptation, and volume-assured pressure support are not implemented");
assertContains("protocol docs firmware direct mode clamp", protocolDoc, "pressure-controller mode setter also clamps out-of-range enum values back to CPAP");
assertContains("protocol docs mode authoritative", protocolDoc, "The `mode` field is authoritative");
assertContains("mobile docs auto mode-derived", mobileDoc, "legacy `auto` settings flag as mode-derived compatibility state");
assertContains("mobile docs therapy mode identifiers", mobileDoc, "CPAP, AutoPAP, BiPAP S, BiPAP ST, BiPAP T, ASV, AutoASV, Auto BiPAP, BiPAP PC, and VAPS");
assertContains("mobile docs advanced therapy note", mobileDoc, "Keep an adjacent Advanced-mode note that CPAP and AutoPAP use the current experimental pressure-target logic");
assertContains("mobile docs BiPAP S target-family boundary", mobileDoc, "BiPAP S uses an experimental bilevel target family");
assertContains("mobile docs backup timing overlay", mobileDoc, "ST/T/PC add an experimental backup-rate timing overlay");
assertContains("mobile docs simple hides backup controls", mobileDoc, "Simple mode must not expose backup-rate controls");
assertContains("README therapy mode backup overlay", topReadme, "BiPAP ST, BiPAP T, and BiPAP PC add an experimental backup-rate timing overlay");
assertContains("README therapy mode boundary", topReadme, "this is not a validated ventilation algorithm");
assertContains("README BiPAP S target-family boundary", topReadme, "BiPAP S currently maps to an experimental bilevel target family");
assertContains("firmware settings epr JSON clamp", firmwareBle, "settings.epr = jsonU8Clamped(doc, \"epr\"");
assertContains("firmware settings backup rate JSON clamp", firmwareBle, "settings.backupRateBpm = jsonFiniteFloat(doc, \"backupRate\", settings.backupRateBpm)");
assertContains("firmware settings inspiratory time JSON clamp", firmwareBle, "settings.inspTimeMs = jsonU16Clamped(doc, \"inspTimeMs\", settings.inspTimeMs)");
assertContains("firmware settings trigger sensitivity JSON clamp", firmwareBle, "settings.triggerSens = jsonU8Clamped(doc, \"triggerSens\", settings.triggerSens)");
assertContains("firmware settings cycle sensitivity JSON clamp", firmwareBle, "settings.cycleSens = jsonU8Clamped(doc, \"cycleSens\", settings.cycleSens)");
assertContains("firmware settings backup rate persistence", firmwareBle, "prefs.putFloat(\"backupRate\", settings.backupRateBpm)");
assertContains("firmware settings inspiratory time persistence", firmwareBle, "prefs.putUShort(\"inspTimeMs\", settings.inspTimeMs)");
assertContains("firmware settings trigger sensitivity persistence", firmwareBle, "prefs.putUChar(\"triggerSens\", settings.triggerSens)");
assertContains("firmware settings cycle sensitivity persistence", firmwareBle, "prefs.putUChar(\"cycleSens\", settings.cycleSens)");
assertContains("firmware settings mode JSON clamp", firmwareBle, "settings.mode = (TherapyMode)jsonU8Clamped(doc, \"mode\"");
assertContains("firmware settings echo JSON capacity covers full schema", firmwareBle, "DynamicJsonDocument jd(768)");
assertContains("firmware settings write JSON capacity covers full schema", firmwareBle, "DynamicJsonDocument doc(768)");
assertContains("firmware settings finite float helper", firmwareBle, "static float jsonFiniteFloat");
assertContains("firmware settings boolean helper", firmwareBle, "static bool jsonBool");
assertContains("firmware settings auto boolean write", firmwareBle, "settings.autoPap = jsonBool(doc, \"auto\", settings.autoPap)");
assertContains("firmware settings BLE advertise boolean write", firmwareBle, "settings.bleAdvertise = jsonBool(doc, \"bleAdv\", settings.bleAdvertise)");
assertContains("firmware integer JSON rejects non-integer values", firmwareBle, "!doc[key].is<int>()");
assertContains("firmware u16 JSON rejects non-integer values", firmwareBle, "!doc[key].is<long>()");
assertContains("firmware u8 JSON rejects out-of-storage-range values", firmwareBle, "if (value < 0 || value > 255) return fallback;");
assertContains("firmware u16 JSON rejects out-of-storage-range values", firmwareBle, "if (value < 0L || value > 65535L) return fallback;");
assertContains("firmware settings finite pMin write", firmwareBle, "settings.pMin = jsonFiniteFloat(doc, \"pMin\", settings.pMin)");
assertContains("firmware settings finite ramp write", firmwareBle, "settings.rampSecs = jsonFiniteFloat(doc, \"ramp\", settings.rampSecs)");
assertContains("firmware humidifier kind setting", firmwareHeader, "uint8_t humidifierKind = 0");
assertContains("firmware humidifier RH target setting", firmwareHeader, "float humidifierTargetRH = 70.0f");
assertContains("firmware humidifier max temp setting", firmwareHeader, "float humidifierMaxTempC = 45.0f");
assertContains("firmware humidifier prewarm duration setting", firmwareHeader, "uint16_t humidifierPrewarmMinutes = 15");
assertContains("firmware hose temperature delta setting", firmwareHeader, "float hoseTempDeltaC = 4.0f");
assertContains("firmware humidifier kind persistence", firmwareBle, "prefs.putUChar(\"humKind\", settings.humidifierKind)");
assertContains("firmware humidifier target persistence", firmwareBle, "prefs.putFloat(\"humTarget\", settings.humidifierTargetRH)");
assertContains("firmware humidifier max temp persistence", firmwareBle, "prefs.putFloat(\"humMaxT\", settings.humidifierMaxTempC)");
assertContains("firmware humidifier prewarm persistence", firmwareBle, "prefs.putUShort(\"humPreMin\", settings.humidifierPrewarmMinutes)");
assertContains("firmware hose delta persistence", firmwareBle, "prefs.putFloat(\"hoseDelta\", settings.hoseTempDeltaC)");
assertContains("firmware humidifier kind write", firmwareBle, "settings.humidifierKind = jsonU8Clamped(doc, \"humidifierKind\", settings.humidifierKind)");
assertContains("firmware humidifier RH write", firmwareBle, "settings.humidifierTargetRH = jsonFiniteFloat(doc, \"humidifierTargetRH\", settings.humidifierTargetRH)");
assertContains("firmware humidifier max temp write", firmwareBle, "settings.humidifierMaxTempC = jsonFiniteFloat(doc, \"humidifierMaxTempC\", settings.humidifierMaxTempC)");
assertContains("firmware humidifier prewarm write", firmwareBle, "settings.humidifierPrewarmMinutes = jsonU16Clamped(doc, \"humidifierPrewarmMinutes\", settings.humidifierPrewarmMinutes)");
assertContains("firmware hose delta write", firmwareBle, "settings.hoseTempDeltaC = jsonFiniteFloat(doc, \"hoseTempDeltaC\", settings.hoseTempDeltaC)");
assertContains("firmware humidifier prewarm start API", firmwareLogic, "bool humidifierPrewarmStart()");
assertContains("firmware humidifier prewarm stop API", firmwareLogic, "void humidifierPrewarmStop()");
assertContains("firmware humidifier prewarm water warmer gate", firmwareLogic, "settings.humidifierKind != 2 || settings.humidifierPrewarmMinutes == 0");
assertContains("firmware humidifier prewarm accessory-ready gate", firmwareLogic, "!humid.present || !humid.ready");
assertContains("firmware humidifier prewarm fresh telemetry gate", firmwareLogic, "humidifierTelemetryFresh()");
assertContains("firmware humidifier readiness requires bounded telemetry", firmwareModules, "humid.ready = telemetryValid;");
assertContains("firmware invalid humidifier telemetry disables output", firmwareModules, "safeControl.enabled = false;");
assertContains("firmware water warmer rejects missing temperature", firmwareModules, "(control.kind == 2 && !isfinite(measuredTempC))");
assertAbsent("firmware water warmer does not invent temperature headroom", firmwareModules, ": 5.0f");
assertContains("firmware heated hose invalid telemetry commands zero", firmwareModules, "telemetryValid ? clampFloat(targetTubeT, 0.0f, 15.0f) : 0.0f");
assertContains("firmware humidifier prewarm timeout", firmwareLogic, "humidifierPrewarmUntilMs = millis() + (uint32_t)settings.humidifierPrewarmMinutes * 60000UL");
assertContains("firmware humidifier prewarm sets status immediately", firmwareLogic, "humid.prewarm = true;");
assertContains("firmware humidifier prewarm clears status immediately", firmwareLogic, "humid.prewarm = false;");
assertContains("firmware humidifier running or prewarm enable", firmwareLogic, "humidifierControl.enabled = (currentMode == MODE_RUNNING && settings.humidifierKind != 0) || prewarmActive");
assertContains("firmware module polling uses gated hose target", firmwareLogic, "pollModules(humidifierControl, hoseTargetDeltaC)");
assertContains("firmware ultrasonic PID profile", firmwareModules, "if (control.kind == 2) {\n    kp = 0.45f;");
assertContains("firmware water warmer thermal ceiling", firmwareModules, "const float headroom = maxTempC - measuredTempC;");
assertContains("firmware water warmer prewarm output path", firmwareModules, "control.prewarm && control.kind == 2");
assertContains("firmware humidifier accessory command frame", firmwareModules, "Wire.write(kind);  // 0x12 humidifier kind");
assertContains("firmware BLE prewarm start command", firmwareBle, "strcmp(command, \"prewarmStart\") == 0");
assertContains("firmware BLE prewarm stop command", firmwareBle, "strcmp(command, \"prewarmStop\") == 0");
assertContains("firmware settings finite sanitize fallback", firmwareBle, "if (!isfinite(settings.pMin)) settings.pMin = 4.0f;");
assertContains("firmware settings sanitizer returns change flag", firmwareBle, "static bool sanitizeSettings()");
assertContains("firmware settings sanitizer snapshots live copy", firmwareBle, "CPAPSettings before = settings;");
assertContains("firmware settings sanitizer compares persisted fields only", firmwareBle, "static bool persistedSettingsEqual(const CPAPSettings& a, const CPAPSettings& b)");
assertContains("firmware settings load rewrites sanitized NVS", firmwareBle, "if (sanitizeSettings()) {\n    saveSettings();\n  }");
assertContains("mobile backup rate validation", appValidation, "backupRateBpm: clampNumber");
assertContains("mobile backup rate serializes BLE key", appValidation, "backupRate: safe.backupRateBpm");
assertContains("mobile inspiratory time serializes", appValidation, "inspTimeMs: safe.inspTimeMs");
assertContains("mobile humidifier kind validation", appValidation, "humidifierKind: clampInteger(settings.humidifierKind, 0, 2");
assertContains("mobile humidifier target validation", appValidation, "humidifierTargetRH: clampNumber(settings.humidifierTargetRH, 30, 90");
assertContains("mobile humidifier max temp validation", appValidation, "humidifierMaxTempC: clampNumber(settings.humidifierMaxTempC, 30, 60");
assertContains("mobile humidifier prewarm validation", appValidation, "humidifierPrewarmMinutes: clampInteger(settings.humidifierPrewarmMinutes, 0, 60");
assertContains("mobile hose delta validation", appValidation, "hoseTempDeltaC: clampNumber(settings.hoseTempDeltaC, 0, 15");
assertContains("mobile humidifier kind serializes", appValidation, "humidifierKind: safe.humidifierKind");
assertContains("mobile humidifier target serializes", appValidation, "humidifierTargetRH: safe.humidifierTargetRH");
assertContains("mobile humidifier prewarm serializes", appValidation, "humidifierPrewarmMinutes: safe.humidifierPrewarmMinutes");
assertContains("mobile prewarm start gate", mobileApp, "const prewarmStartAllowed = settingsWriteAllowed && settings.humidifierKind === 2 && settings.humidifierPrewarmMinutes > 0");
assertContains("mobile prewarm start requires humidifier telemetry", mobileApp, "const humidifierPresent = telemetry.moduleStatus.includes(\"humidifier\")");
assertContains("mobile prewarm start gate includes humidifier", mobileApp, "settings.humidifierPrewarmMinutes > 0 && humidifierPresent");
assertContains("mobile prewarm command type", mobileApp, "type ControlCommand = \"start\" | \"stop\" | \"prewarmStart\" | \"prewarmStop\"");
assertContains("mobile prewarm control button", mobileApp, "label=\"Start prewarm\"");
assertContains("mobile prewarm stop button", mobileApp, "label=\"Stop prewarm\"");
assertContains("mobile prewarm reads module status after command", mobileApp, "readUtf8(writeDevice, OZEALIS_CHARACTERISTICS.moduleStatus)");
assertContains("mobile prewarm success requires status bit", mobileApp, "mode === \"0\" && moduleStatus.includes(\"prewarm\")");
assertContains("mobile prewarm stop verifies status clear", mobileApp, "moduleStatus.includes(\"prewarm\") ? \"Prewarm stop not verified");
assertContains("mobile prewarm schedule default", appValidation, "export const DEFAULT_PREWARM_SCHEDULE");
assertContains("mobile prewarm schedule parser", appValidation, "export function parsePrewarmSchedule");
assertContains("mobile prewarm schedule once-per-minute due check", appValidation, "safe.lastRunKey !== prewarmScheduleRunKey(now)");
assertContains("mobile prewarm schedule run key export", appProtocol, "prewarmScheduleRunKey");
assertContains("mobile prewarm schedule run marker", appValidation, "export function markPrewarmScheduleRun");
assertContains("mobile prewarm schedule persisted file", mobileApp, "const prewarmScheduleFileName = \"ozealis-prewarm-schedule.json\"");
assertContains("mobile prewarm schedule storage restore", mobileApp, "setPrewarmSchedule(parsePrewarmSchedule(await file.text()))");
assertContains("mobile prewarm schedule storage write", mobileApp, "file.write(serializePrewarmSchedule(nextSchedule))");
assertContains("mobile prewarm schedule waiting de-duplicates messages", mobileApp, "prewarmScheduleSkipKeyRef.current !== skipKey");
assertContains("mobile prewarm schedule does not stamp skipped waits", mobileApp, "Scheduled prewarm waiting; device is not idle, ready, connected, or configured for water-warmer prewarm.");
assertContains("mobile prewarm schedule stamps before actual send", mobileApp, "setPrewarmSchedule(markPrewarmScheduleRun(prewarmSchedule, now));\n      void sendControlCommand(\"prewarmStart\")");
assertContains("mobile prewarm schedule toggle", mobileApp, "label=\"Scheduled prewarm\"");
assertContains("mobile prewarm schedule hour field", mobileApp, "label=\"Prewarm hour\"");
assertContains("mobile prewarm schedule minute field", mobileApp, "label=\"Prewarm minute\"");
assertContains("mobile prewarm schedule fires same command path", mobileApp, "void sendControlCommand(\"prewarmStart\")");
assertContains("mobile prewarm schedule docs", mobileDoc, "waits during the matching local date-minute");
assertContains("mobile integer settings clamp helper", appValidation, "function clampInteger");
assertContains("mobile numeric settings reject string coercion", appValidation, "typeof value !== \"number\"");
assertContains("mobile therapy mode rejects string coercion", appValidation, "typeof value === \"number\" && Number.isInteger(value)");
assertContains("mobile integer settings reject fractional values", appValidation, "typeof value !== \"number\" || !Number.isInteger(value)");
assertContains("mobile integer settings no flooring", read("scripts/test-mobile-validation.mjs"), "sanitizeSettings({ epr: 2.9, inspTimeMs: 777.8, triggerSens: 4.9, cycleSens: 6.2, humidifierKind: 1.5, humidifierPrewarmMinutes: 10.5 })");
assertContains("mobile backup rate remains numeric", read("scripts/test-mobile-validation.mjs"), "sanitizeSettings({ backupRateBpm: 9.5 }).backupRateBpm");
assertContains("firmware PapLimits carries backup rate", firmwareAutopapHeader, "float backupRateBpm");
assertContains("firmware PapLimits carries inspiratory time", firmwareAutopapHeader, "uint16_t inspTimeMs");
assertContains("firmware settings passes backup rate to controller", firmwareBle, "settings.backupRateBpm,\n    settings.inspTimeMs");
assertContains("firmware backup rate mode whitelist", firmwareAutopap, "m == MODE_BIPAP_ST || m == MODE_BIPAP_T || m == MODE_BIPAP_PC");
assertContains("firmware backup rate spontaneous reset modes", firmwareAutopap, "m == MODE_BIPAP_ST || m == MODE_BIPAP_PC");
assertContains("firmware backup rate clamp", firmwareAutopap, "next.backupRateBpm = constrain(next.backupRateBpm, 4.0f, 30.0f);");
assertContains("firmware backup inspiratory time clamp", firmwareAutopap, "next.inspTimeMs = constrain(next.inspTimeMs, (uint16_t)300, (uint16_t)3000);");
assertContains("firmware backup interval derives from bpm", firmwareAutopap, "60000.0f / limits.backupRateBpm");
assertContains("firmware timed IPAP window bounded to half cycle", firmwareAutopap, "min((uint32_t)limits.inspTimeMs, backupIntervalMs / 2)");
assertContains("firmware timed IPAP setpoint override", firmwareAutopap, "modeUsesBackupRate(mode) && millis() < timedIpapUntilMs");
assertContains("firmware timed mode ignores spontaneous IPAP selection", firmwareAutopap, "else if (mode != MODE_BIPAP_T) targetCm = flowProxy >= 0 ? ipap_cm : epap_cm;");
assertContains("firmware final PAP target uses shared ceiling", firmwareAutopap, "constrain(targetCm, MIN_THERAPY_PRESSURE_CM, MAX_THERAPY_PRESSURE_CM)");
assertAbsent("firmware ASV target does not exceed configured maximum", firmwareAutopap, "limits.pMax + limits.delta");
assertContains("firmware PAP explicit session start API", firmwareAutopapHeader, "void papStartSession();");
assertContains("firmware PAP explicit session stop API", firmwareAutopapHeader, "void papStopSession();");
assertContains("firmware backup timing resets on mode change", firmwareAutopap, "resetBreathTiming(millis());");
assertContains("mobile EPR integer validation", appValidation, "epr: clampInteger(settings.epr, 0, 3");
assertContains("mobile trigger sensitivity validation", appValidation, "triggerSens: clampInteger(settings.triggerSens, 1, 9");
assertContains("mobile cycle sensitivity serializes", appValidation, "cycleSens: safe.cycleSens");
assertContains("mobile backup rate field", mobileApp, "Backup rate (bpm)");
assertContains("mobile inspiratory time field", mobileApp, "Inspiratory time (ms)");
assertContains("mobile reserved trigger sensitivity field", mobileApp, "Trigger sensitivity reserved");
assertContains("mobile reserved cycle sensitivity field", mobileApp, "Cycle sensitivity reserved");
assertContains("mobile number field keeps editable local text", mobileApp, "const [text, setText] = useState(String(value))");
assertContains("mobile number field avoids blank-to-zero coercion", mobileApp, "if (!normalized || normalized === \"-\" || normalized === \".\" || normalized === \"-.\" || normalized.endsWith(\".\")) return");
assertContains("mobile number field commits finite values only", mobileApp, "if (Number.isFinite(nextValue)) onChange(nextValue)");
assertContains("firmware settings BLE name strict string helper", firmwareBle, "const char* nextName = jsonNonEmptyString(doc, \"bleName\")");
assertContains("firmware BLE name sanitizer", firmwareBle, "static void sanitizeBleName()");
assertContains("firmware BLE name strips unsafe chars", firmwareBle, "c < 0x20 || c > 0x7e || c == '\"' || c == '\\\\'");
assertContains("firmware BLE name trims leading spaces", firmwareBle, "while (start < out && cleaned[start] == ' ') start++;");
assertContains("firmware BLE name trims trailing spaces", firmwareBle, "while (end > start && cleaned[end - 1] == ' ') end--;");
assertContains("firmware BLE name whitespace fallback", firmwareBle, "if (end <= start)");
assertContains("firmware pressure limits header", firmwarePressureLimits, "#ifndef PRESSURE_LIMITS_H");
assertContains("firmware minimum therapy pressure constant", firmwarePressureLimits, "MIN_THERAPY_PRESSURE_CM = 4.0f");
assertContains("firmware overpressure threshold constant", firmwarePressureLimits, "MAX_MASK_PRESSURE_CM = 25.0f");
assertContains("firmware therapy ceiling tied to overpressure", firmwarePressureLimits, "MAX_THERAPY_PRESSURE_CM = MAX_MASK_PRESSURE_CM");
assertContains("firmware logic includes shared pressure limits", firmwareLogicHeader, "#include \"pressure_limits.h\"");
assertContains("firmware overpressure uses shared threshold", firmwareLogic, "cmH2O_to_hPa(MAX_MASK_PRESSURE_CM)");
assertAbsent("firmware removes stale hPa pressure threshold", firmwareLogicHeader, "MAX_MASK_PRESSURE_HPA");
assertContains("firmware settings min pressure uses shared constant", firmwareBle, "constrain(settings.pMin, MIN_THERAPY_PRESSURE_CM, MAX_THERAPY_PRESSURE_CM)");
assertContains("firmware settings max pressure uses shared constant", firmwareBle, "constrain(settings.pMax, settings.pMin, MAX_THERAPY_PRESSURE_CM)");
assertContains("firmware pressure controller direct mode clamp", firmwareAutopap, "mode = m <= MODE_VAPS ? m : MODE_CPAP;");
assertContains("firmware autopap min pressure uses shared constant", firmwareAutopap, "constrain(next.pMin, MIN_THERAPY_PRESSURE_CM, MAX_THERAPY_PRESSURE_CM)");
assertContains("firmware autopap max pressure uses shared constant", firmwareAutopap, "constrain(next.pMax, next.pMin, MAX_THERAPY_PRESSURE_CM)");
assertContains("firmware calibration max pressure uses shared constant", firmwareMotorCal, "constrain(next.maxPressureCm, MIN_THERAPY_PRESSURE_CM, MAX_THERAPY_PRESSURE_CM)");
assertContains("firmware calibration profile max pressure validates shared ceiling", firmwareMotorCal, "profile.maxPressureCm > MAX_THERAPY_PRESSURE_CM");
assertContains("mobile max mask pressure constant", appValidation, "export const MAX_MASK_PRESSURE_CM = 25;");
assertContains("mobile max therapy pressure tied to mask constant", appValidation, "export const MAX_THERAPY_PRESSURE_CM = MAX_MASK_PRESSURE_CM;");
assertContains("mobile min settings clamp uses shared constant", appValidation, "clampNumber(settings.pMin, MIN_THERAPY_PRESSURE_CM, MAX_THERAPY_PRESSURE_CM");
assertContains("mobile max settings clamp uses shared constant", appValidation, "clampNumber(settings.pMax, pMin, MAX_THERAPY_PRESSURE_CM");
assertContains("protocol docs shared pressure range", protocolDoc, "Pressure settings are clamped to the shared 4-25 cmH2O therapy range");
assertContains("protocol docs calibration shared pressure range", protocolDoc, "`maxPressureCm` must be a finite JSON number and is clamped to the same shared 4-25 cmH2O therapy range as settings");
assertContains("protocol docs finite numeric settings", protocolDoc, "Numeric settings must be finite JSON numbers");
assertContains("protocol docs settings write object boundary", protocolDoc, "Settings writes must be JSON objects");
assertContains("protocol docs settings object boundary", protocolDoc, "The settings characteristic must be a complete canonical JSON object");
assertContains("protocol docs primitive settings invalid", protocolDoc, "arrays, strings, numbers, booleans, `null`, or partial objects as invalid readback");
assertContains("protocol docs integer settings", protocolDoc, "integer settings (`mode`, `epr`, `inspTimeMs`, `triggerSens`, `cycleSens`, `humidifierKind`, and `humidifierPrewarmMinutes`) must be JSON integers");
assertContains("protocol docs prewarm control commands", protocolDoc, "`{\"command\":\"prewarmStart\"}` and `{\"command\":\"prewarmStop\"}`");
assertContains("protocol docs prewarm requires ready accessory", protocolDoc, "a currently detected and ready humidifier accessory");
assertContains("protocol docs prewarm verified by module bit", protocolDoc, "verifies prewarm success by rereading module status and requiring bit 3");
assertContains("protocol docs module status read characteristic", protocolDoc, "| Module status | `0013` | `7f2d0013-0f4d-4a1f-9f84-0c2a6b3d0000` | read + notify |");
assertContains("protocol docs boolean settings", protocolDoc, "Boolean settings (`auto` and `bleAdv`) must be JSON booleans");
assertContains("protocol docs persisted settings writeback", protocolDoc, "persisted settings are treated as untrusted input");
assertContains("protocol docs persisted settings writeback namespace", protocolDoc, "writes the sanitized settings back to the `cpap` NVS namespace");
assertContains("mobile BLE name strict string sanitizer", appValidation, "typeof settings.bleName === \"string\"");
assertContains("mobile BLE name sanitizer helper", appValidation, "function sanitizeBleName(value: string)");
assertContains("mobile BLE name strips quotes and backslashes", appValidation, ".replace(/[\"\\\\]/g, \"\")");
assertContains("mobile BLE name strips non-printable characters", appValidation, ".replace(/[^\\x20-\\x7e]/g, \"\")");
assertContains("mobile BLE name unsafe-character test", mobileValidationTests, "OzealisLab");
assertContains("mobile BLE name fallback test", mobileValidationTests, "DEFAULT_SETTINGS.bleName");
assertContains("protocol docs BLE name sanitizer", protocolDoc, "accepted BLE names are trimmed and sanitized to printable ASCII");
assertContains("protocol docs reserved trigger cycle settings", protocolDoc, "`triggerSens` and `cycleSens` are persisted reserved settings");
assertContains("mobile docs timed backup settings", mobileDoc, "backup-rate and inspiratory-time settings as Advanced experimental timed-bilevel controls");
assertContains("README backup timing settings", topReadme, "raises the pressure target to IPAP for the configured inspiratory-time window");
assertContains("firmware calibration profile load", firmwareMotorCal, "calPrefs.begin(\"motorcal\"");
assertContains("firmware calibration profile rewrite flag", firmwareMotorCal, "bool rewriteSanitizedProfile = false;");
assertContains("firmware calibration profile checks full curve blob", firmwareMotorCal, "const size_t curveBytes = calPrefs.getBytes(\"curveAmp\", profile.curveAmp, sizeof(profile.curveAmp));");
assertContains("firmware calibration profile rejects nonfinite gain", firmwareMotorCal, "!isfinite(profile.gainCmPerAmp)");
assertContains("firmware calibration profile rejects nonfinite max pressure", firmwareMotorCal, "!isfinite(profile.maxPressureCm)");
assertContains("firmware calibration profile rejects partial curve blob", firmwareMotorCal, "curveBytes != sizeof(profile.curveAmp)");
assertContains("firmware calibration profile rejects non-increasing curve", firmwareMotorCal, "profile.curveAmp[i] <= profile.curveAmp[i - 1]");
assertContains("firmware calibration profile rejects mismatched curve endpoints", firmwareMotorCal, "profile.minAmp != profile.curveAmp[0] || profile.maxAmp != profile.curveAmp[16]");
assertContains("firmware calibration profile persists sanitized reject", firmwareMotorCal, "if (rewriteSanitizedProfile) {\n    saveProfile();\n  }");
assertContains("firmware calibration fresh pressure helper", firmwareMotorCal, "static bool pressureSensorsReadyForCalibration() {\n  float pMask = NAN;\n  float pBlower = NAN;\n  return readPressures(pMask, pBlower) && isfinite(pMask) && isfinite(pBlower);\n}");
assertOccurrenceCount("firmware calibration start uses fresh pressure helper", firmwareMotorCal, "if (!pressureSensorsReadyForCalibration())", 2);
assertContains("firmware water calibration curve storage", firmwareMotorCal, "profile.curveAmp");
assertContains("firmware water calibration start API", firmwareMotorCal, "bool motorCalWaterStart");
assertContains("firmware water calibration capture API", firmwareMotorCal, "bool motorCalCapturePoint()");
assertContains("firmware water calibration interpolation", firmwareMotorCal, "profile.curveValid");
assertContains("firmware water calibration capture monotonic guard", firmwareMotorCal, "currentAmp == 0 || (index > 0 && currentAmp <= waterCurveAmp[index - 1])");
assertContains("firmware water capture requires trim sample before counting point", firmwareMotorCal, "if (!sensorDifferentialTrimCaptureSample()) {\n    currentAmp = currentAmp > 3 ? currentAmp - 3 : 0;\n    resetSamples();\n    setState(CAL_WATER, \"sensor-error\");\n    return false;\n  }\n\n  waterCurveAmp[index] = currentAmp;");
assertContains("firmware water final commit before curve save", firmwareMotorCal, "if (!sensorDifferentialTrimCommit()) {\n      profile.valid = false;\n      profile.curveValid = false;");
assertContains("firmware water calibration sensor trim reset", firmwareMotorCal, "sensorDifferentialTrimResetSamples();");
assertContains("firmware water calibration clears previous valid flag", firmwareMotorCal, "profile.valid = false;");
assertContains("firmware water calibration clears previous curve flag", firmwareMotorCal, "profile.curveValid = false;");
assertContains("firmware water calibration persists cleared curve", firmwareMotorCal, "saveProfile();\n  waterTargetCm = 4;");
assertContains("firmware auto calibration clears curve map", firmwareMotorCal, "memset(profile.curveAmp, 0, sizeof(profile.curveAmp));");
assertContains("firmware calibration duty clamps before uint8 cast", firmwareMotorCal, "static uint8_t clampAmp(float amp");
assertContains("firmware sensor trim preference namespace", firmwareSensor, "sensorPrefs.begin(\"sensorcal\"");
assertContains("firmware sensor trim requires all water samples", firmwareSensor, "SENSOR_TRIM_REQUIRED_SAMPLES = 17");
assertContains("firmware sensor trim max absolute offset constant", firmwareSensor, "SENSOR_TRIM_MAX_ABS_HPA = 25.0f");
assertContains("firmware sensor trim capture uses shared bound", firmwareSensor, "fabsf(rawDiff) > SENSOR_TRIM_MAX_ABS_HPA");
assertContains("firmware sensor trim commit uses shared bound", firmwareSensor, "fabsf(nextTrim) > SENSOR_TRIM_MAX_ABS_HPA");
assertContains("firmware sensor trim load uses shared bound", firmwareSensor, "fabsf(sensorDiffTrim_hPa) > SENSOR_TRIM_MAX_ABS_HPA");
assertContains("firmware sensor trim clears previous saved trim", firmwareSensor, "sensorPrefs.putBool(\"diffValid\", false);");
assertContains("firmware sensor trim rewrite flag", firmwareSensor, "bool rewriteSanitizedTrim = false;");
assertContains("firmware sensor trim rewrites rejected persisted trim", firmwareSensor, "if (rewriteSanitizedTrim) {\n    sensorPrefs.begin(\"sensorcal\", false);");
assertContains("firmware sensor trim too few status", firmwareSensor, "sensorTrimStatus = \"too-few-samples\";");
assertContains("firmware sensor trim status API", firmwareSensorHeader, "const char* sensorDifferentialTrimStatus();");
assertContains("firmware sensor trim correction", firmwareSensor, "return sensorTrimValid ? raw_hPa - sensorDiffTrim_hPa : raw_hPa;");
assertContains("firmware sensor trim raw no-flow sample", firmwareSensor, "const float rawDiff = e2_pressure.pressure - e1_pressure.pressure;");
assertContains("firmware sensor trim committed sample count", firmwareSensor, "sensorPrefs.putUShort(\"diffSamples\", sensorTrimCommittedSamples);");
assertContains("firmware sensor trim load requires committed samples", firmwareSensor, "sensorTrimCommittedSamples < SENSOR_TRIM_REQUIRED_SAMPLES");
assertContains("motor calibration docs sensor trim bound", motorCalibrationDoc, "shared 25 hPa sensor-trim sanity bound");
assertContains("firmware calibration JSON u8 clamp", firmwareBle, "jsonU8Clamped(d, \"minAmp\"");
assertContains("firmware calibration JSON u16 clamp", firmwareBle, "jsonU16Clamped(d, \"dwellMs\"");
assertContains("firmware calibration max pressure finite parse", firmwareBle, "plan.maxPressureCm = jsonFiniteFloat(d, \"maxPressureCm\", plan.maxPressureCm)");
assertContains("firmware calibration max pressure nonfinite fallback", firmwareMotorCal, "if (!isfinite(next.maxPressureCm)) next.maxPressureCm = MotorCalibrationPlan{}.maxPressureCm;");
assertContains("firmware calibration status active plan flag", firmwareMotorCal, "const bool active = motorCalIsActive();");
assertContains("firmware calibration status active min range", firmwareMotorCal, "const uint8_t statusMinAmp = active ? plan.minAmp : profile.minAmp;");
assertContains("firmware calibration status active max range", firmwareMotorCal, "const uint8_t statusMaxAmp = active ? plan.maxAmp : profile.maxAmp;");
assertContains("firmware calibration status emits active min range", firmwareMotorCal, "statusMinAmp,\n           statusMaxAmp,");
assertContains("firmware persisted water profile requires primary validity", firmwareMotorCal, "bool waterProfileInvalid =\n      !profile.valid ||");
assertContains("firmware persisted water profile requires paired sensor trim", firmwareMotorCal, "!sensorDifferentialTrimValid() ||");
assertContains("firmware invalid persisted water profile clears whole profile", firmwareMotorCal, "if (waterProfileInvalid) {\n      profile.valid = false;\n      profile.curveValid = false;");
assertContains("firmware loaded water profile restores completion mode", firmwareMotorCal, "if (profile.valid && profile.curveValid) {\n    calibrationMode = CAL_MODE_WATER;");
assertContains("firmware loaded water profile restores all points", firmwareMotorCal, "waterCapturedPoints = 17;");
assertContains("firmware loaded water profile restores completion state", firmwareMotorCal, "setState(CAL_DONE, \"water-done\");");
assertContains("firmware water run records calibration mode", firmwareMotorCal, "bool motorCalWaterStart(const MotorCalibrationPlan& requestedPlan) {\n  if (motorCalIsActive() || otaSecure_inProgress()) return false;\n  calibrationMode = CAL_MODE_WATER;");
assertContains("firmware water completion retains completion state", firmwareMotorCal, "saveProfile();\n    setState(CAL_DONE, \"water-done\");");
assertContains("firmware calibration status mode comes from retained calibration mode", firmwareMotorCal, "const bool waterMode = calibrationMode == CAL_MODE_WATER;");
assertContains("firmware calibration status restores 17 completed points", firmwareMotorCal, "state == CAL_WATER ? waterCapturedPoints : (waterMode && profile.curveValid ? 17 : 0)");
assertContains("protocol docs persisted water completion tuple", protocolDoc, "`state=\"water-done\"`, `active=false`, `mode=\"water\"`, `capturedPoints=17`, and `curveValid=true`");
assertContains("motor calibration docs whole invalid water profile fails closed", motorCalibrationDoc, "rejects the whole saved water profile instead of retaining its endpoint-derived values as a fallback linear profile");
assertContains("protocol docs calibration integer fields", protocolDoc, "Calibration command-unit fields (`minAmp`, `maxAmp`, `stepAmp`, and `dwellMs`) must be JSON integers");
assertContains("firmware calibration rejects non-object JSON roots", firmwareBle, "BLE calibration JSON root not object");
assertContains("protocol docs calibration object boundary", protocolDoc, "Calibration commands must be JSON objects");
assertContains("protocol docs calibration max pressure finite number", protocolDoc, "`maxPressureCm` must be a finite JSON number");
assertContains("protocol docs active calibration status range", protocolDoc, "`minAmp` and `maxAmp` report the active calibration plan while `active=true`");
assertContains("firmware calibrated pressure mapping", firmwareAutopap, "motorCalDutyForCm(targetCm)");
assertContains("firmware pressure controller", firmwareAutopap, "pressureControllerDuty");
assertContains("firmware pressure controller integral clamp", firmwareAutopap, "pressureIntegral = constrain");
assertContains("firmware pressure controller slew limit", firmwareAutopap, "ampCommand + 2.0f");
assertContains("firmware pressure controller measured getter", firmwareAutopap, "papGetMeasuredCm()");
assertContains("firmware live CSV controller fields", firmwareBle, "papGetPressureErrorCm()");
assertContains("firmware live CSV motor command field", firmwareBle, "motorGetCommand()");
assertContains("firmware fault snapshot legacy motorAmp clarified", firmwareDiagHeader, "legacy CSV name; bounded driver command units 0..255");
assertAbsent("firmware fault snapshot stale PWM amplitude wording", firmwareDiagHeader, "PWM amplitude 0..255");
assertContains("firmware live CSV motor fault field", firmwareBle, "motorFaultActive() ? 1 : 0");
assertContains("firmware live CSV cached motor I2C field", firmwareBle, "liveMotorI2cPresent ? 1 : 0");
assertContains("firmware live CSV 10 Hz period", firmwareBle, "LIVE_CSV_CONNECTED_PERIOD_MS = 100");
assertContains("firmware live CSV I2C 1 Hz probe period", firmwareBle, "LIVE_CSV_I2C_PROBE_PERIOD_MS = 1000");
assertContains("firmware live CSV finite row guard", firmwareBle, "isfinite(setPt_hPa) && isfinite(diff_hPa) && isfinite(flow_hPa) && isfinite(vin_V)");
assertContains("firmware live CSV measured/error finite guard", firmwareBle, "isfinite(measuredCm) && isfinite(pressureErrorCm)");
assertContains("firmware live CSV FG sampled before guard", firmwareBle, "const float motorFgHz = motorGetFgHz();");
assertContains("firmware live CSV FG finite guard", firmwareBle, "isfinite(measuredCm) && isfinite(pressureErrorCm) && isfinite(motorFgHz)");
assertContains("firmware live CSV uses checked FG", firmwareBle, "liveMotorI2cPresent ? 1 : 0,\n               motorFgHz,");
assertContains("firmware pressure acquisition initializes NAN sentinels", firmwareLogic, "float pMask = NAN, pBlower = NAN;\n  const bool pressureComplete = readPressures(pMask, pBlower);");
assertContains("firmware sensor fault does not overwrite active fault", firmwareLogic, "if (currentMode != MODE_FAULT && !sensorsOK())");
assertContains("firmware pressure-control read failure gate", firmwareAutopap, "if (!readPressures(pMask, pBlower)) {");
assertContains("firmware pressure-control read failure drops motor command", firmwareAutopap, "setMotorAmplitude(0);\n    blowerOn = false;\n    resetPressureController();");
assertContains("firmware pressure-control read failure resets backup timing", firmwareAutopap, "resetBreathTiming(millis());\n    return;");
assertContains("firmware calibration pressure read failure stops motor", firmwareMotorCal, "if (!readPressures(pMask, pBlower) || !isfinite(ambient)) {\n    stopMotor();\n    setState(CAL_ERROR, \"sensor-error\");\n    return;\n  }");
assertContains("firmware pressure delta fresh-complete guard", firmwareLogic, "const float diff_hPa = pressureComplete ? (pBlower - pMask) : NAN;");
assertContains("firmware mask gauge fresh-complete guard", firmwareLogic, "if (pressureComplete && isfinite(sensorAmbient_hPa()))");
assertContains("firmware ambient update fresh-complete guard", firmwareLogic, "if (pressureComplete) sensorUpdateAmbientEstimate(pMask, diff_hPa);");
assertContains("firmware failed mask read returns unknown", firmwareSensor, "pMask = NAN;");
assertContains("firmware failed blower read returns unknown", firmwareSensor, "pBlower = NAN;");
assertAbsent("firmware live pressure read never substitutes mask cache", firmwareSensor, "pMask = !isnan(pMask_cache)");
assertAbsent("firmware live pressure read never substitutes blower cache", firmwareSensor, "pBlower = !isnan(pBlower_cache)");
assertContains("firmware overpressure fault does not overwrite active fault", firmwareLogic, "if (currentMode != MODE_FAULT && isfinite(maskGauge_hPa))");
assertContains("firmware ambient estimate rejects incomplete inputs before init", firmwareSensor, "if (!isfinite(pMask) || !isfinite(diff_hPa)) return;\n  if (!ambientInit) {");
assertContains("firmware fault snapshot finite helper", firmwareLogic, "static float finiteOrNan(float value)");
assertContains("firmware fault snapshot finite pressure guard", firmwareLogic, "pMask = finiteOrNan(pMask);\n  pBlower = finiteOrNan(pBlower);");
assertContains("firmware fault snapshot finite diff guard", firmwareLogic, "const float diff = (isfinite(pMask) && isfinite(pBlower)) ? (pBlower - pMask) : NAN;");
assertContains("firmware fault snapshot finite analog fields", firmwareLogic, "snap.vin_V        = finiteOrNan(vinFiltered());");
assertContains("firmware fault snapshot caches finite setpoint before shutdown", firmwareLogic, "const float faultSetpointCm = finiteOrNan(papGetSetpointCm());");
assertContains("firmware fault snapshot uses cached finite setpoint", firmwareLogic, "snap.setpoint_cm  = faultSetpointCm;");
assertContains("firmware fault snapshot caches finite flow before shutdown", firmwareLogic, "const float faultFlowProxy = finiteOrNan(papGetFlowProxy());");
assertContains("firmware fault snapshot uses cached finite flow proxy", firmwareLogic, "snap.flowProxy_hPa= faultFlowProxy;");
assertContains("firmware retained CSV uses fresh calibration differential", firmwareLogic, "const float flowProxy = calibrationActive ? diff_hPa : papGetFlowProxy();");
assertContains("firmware retained CSV uses calibration target", firmwareLogic, "const float setpoint_cm = calibrationActive ? motorCalLogTargetCm() : papGetSetpointCm();");
assertContains("firmware retained CSV uses calibration error", firmwareLogic, "const float controllerError = calibrationActive ? error_cm : papGetPressureErrorCm();");
assertContains("firmware retained CSV uses calibration command", firmwareLogic, "const uint8_t controllerAmp = calibrationActive ? motorGetAmplitude() : papGetCommandedAmp();");
assertContains("firmware calibration retained target getter", firmwareMotorCal, "float motorCalLogTargetCm() {\n  if (!motorCalIsActive()) return NAN;\n  return state == CAL_WATER ? (float)waterTargetCm : plan.maxPressureCm;");
assertContains("protocol docs calibration retained row semantics", protocolDoc, "where the PAP pressure controller is intentionally inactive");
assertContains("firmware retained CSV caches FG tach", firmwareLogic, "const float motorFgHz = motorGetFgHz();");
assertContains("firmware retained CSV finite row guard", firmwareLogic, "isfinite(setpoint_cm) && isfinite(measured_cm) && isfinite(error_cm) && isfinite(flowProxy) &&\n        isfinite(controllerError) && isfinite(motorFgHz)");
assertContains("firmware retained CSV skips nonfinite rows without loop return", firmwareLogic, "isfinite(controllerError) && isfinite(motorFgHz)) {\n      char line[220];");
assertContains("firmware retained CSV formats cached FG tach", firmwareLogic, "motorFgHz,\n               spo2Text,");
assertContains("protocol docs live CSV motor fields", protocolDoc, expectedCsvHeaders.live);
assertContains("protocol docs retained CSV finite rows", protocolDoc, "firmware skips that row rather than storing `nan`/`inf` evidence");
assertContains("protocol docs retained CSV finite FG tach", protocolDoc, "retained logger checks `motorFgHz` before formatting the row");
assertContains("protocol docs fault CSV finite analog rows", protocolDoc, "analog diagnostic fields from `vin_V` through `flowProxy_hPa` and `motorFgHz` are emitted as finite decimal numbers or uppercase `NAN`");
assertContains("protocol docs fault latch preservation", protocolDoc, "secondary sensor-health and overpressure checks do not overwrite the active latched fault code");
assertContains("firmware BLE float nonfinite sentinel", firmwareBle, "if (!isfinite(value)) {\n    characteristic->setValue(\"NAN\");");
assertContains("protocol docs pressure finite derivation", protocolDoc, "Firmware derives pressure delta and mask gauge values only from finite mask and blower pressure reads");
assertContains("protocol docs pressure-control read failure drops command", protocolDoc, "make the running pressure-control loop drop motor command to zero and reset its pressure controller state");
assertContains("motor calibration docs pressure-control read failure drops command", motorCalibrationDoc, "drops motor command to zero and resets the pressure controller");
assertContains("protocol docs pressure NAN sentinel", protocolDoc, "| Pressure delta | `0001` | `7f2d0001-0f4d-4a1f-9f84-0c2a6b3d0000` | notify | hPa decimal text or `NAN` |");
assertContains("protocol docs low-flow NAN sentinel", protocolDoc, "non-diagnostic decimal text or `NAN`");
assertContains("protocol docs live CSV 10 Hz capture", protocolDoc, "live CSV notification is emitted every 100 ms");
assertContains("protocol docs live CSV skips incomplete rows", protocolDoc, "incomplete pressure, controller, or FG tach reads skip that live CSV row");
assertContains("protocol docs live CSV cached I2C probe", protocolDoc, "refreshed from a real target probe once per second");
assertContains("protocol docs live CSV derates on disconnect", protocolDoc, "derates analysis to that retained trace after connection loss");
assertContains("protocol docs session log calibration rows", protocolDoc, "running or an experimental motor calibration sweep is active");
assertContains("protocol docs session log 30 minute buffer", protocolDoc, "30 minutes at 1 Hz");
assertContains("mobile live CSV parser helper", appValidation, "parseLiveCsvDiagnostics(raw: string)");
assertContains("mobile live CSV validator helper", appValidation, "isValidLiveCsvRow(raw: string)");
assertContains("mobile live CSV rejects padded rows", appValidation, "if (raw !== raw.trim()) return false;");
assertContains("mobile live CSV validator requires finite CSV fields", appValidation, "finiteCsvNumber(part) !== null");
assertContains("mobile CSV finite number rejects padded fields", appValidation, "if (text !== text.trim() || !text) return null;");
assertContains("mobile CSV integer parser rejects padded text", appValidation, "if (!/^-?(?:0|[1-9]\\d*)$/.test(text)) return null;");
assertContains("mobile live CSV validator exact field count", appValidation, "parts.length !== 19");
assertContains("mobile live CSV validator export", appProtocol, "isValidLiveCsvRow");
assertContains("mobile live CSV parser usage", mobileApp, "parseLiveCsvDiagnostics(value)");
assertContains("mobile live CSV capture usage", mobileApp, "captureLiveCsv(value)");
assertContains("mobile live CSV capture preserves exact row text", mobileApp, "const row = value;");
assertContains("mobile live CSV current row gate", mobileApp, "function isCurrentLiveSyncRow(row: string)");
assertContains("mobile live CSV current row requires 19 fields", mobileApp, "isValidLiveCsvRow(row) && row.split(\",\").length === 19");
assertContains("mobile live CSV capture rejects non-current rows", mobileApp, "if (!isCurrentLiveSyncRow(row)) return;");
assertContains("mobile live CSV spool restore filters increasing rows", mobileApp, "filterIncreasingLiveSyncRows(sourceRows)");
assertContains("mobile live CSV spool restore preserves exact first line", mobileApp, "function liveSyncSpoolLines(raw: string)");
assertContains("mobile live CSV spool restore rejects blank lines", mobileApp, "line.length === 0");
assertAbsent("mobile live CSV spool restore must not trim evidence rows", mobileApp, ".map((line) => line.trim())");
assertContains("mobile live CSV spool restore rejects duplicate timestamps", mobileApp, "ms <= lastMs");
assertContains("mobile live CSV spool restore ignores tiny stale backsteps", mobileApp, "lastMs - ms <= liveSyncRestartBackstepMs");
assertContains("mobile live CSV spool restore clears old prefix after large backstep", mobileApp, "accepted = [];\n        lastMs = -Infinity;");
assertContains("mobile live CSV max gap constant", mobileApp, "const liveSyncMaxSampleGapMs = 1000;");
assertContains("mobile live CSV spool restore starts fresh after large gap", mobileApp, "ms - lastMs > liveSyncMaxSampleGapMs");
assertContains("mobile live CSV capture starts fresh after large forward gap", mobileApp, "packetMs - liveSyncLastMsRef.current > liveSyncMaxSampleGapMs");
assertContains("mobile docs live CSV forward gap fresh trace", mobileDoc, "a forward gap larger than the live 10 Hz cadence tolerance starts a fresh live trace");
assertContains("mobile docs live CSV latest cadence segment", mobileDoc, "latest cadence-consistent segment");
assertContains("mobile live CSV high-rate header", mobileApp, "setpoint_hPa,pressure_hPa,flow_hPa");
assertContains("mobile live CSV analysis selector helper", appValidation, "selectSessionAnalysisCsv(");
assertContains("mobile live CSV minimum analysis window constant", appValidation, "const LIVE_MIN_ANALYSIS_ROWS = 10");
assertContains("mobile live CSV connected analysis gate", appValidation, "bleConnected && parseSessionSamples(liveCsv).length >= LIVE_MIN_ANALYSIS_ROWS");
assertContains("mobile validation tests live one-row derates to retained", mobileValidationTests, "selectSessionAnalysisCsv(liveCsv, retainedCsv, true), {\n    csv: retainedCsv");
assertContains("mobile validation tests live ten-row analysis source", mobileValidationTests, "selectSessionAnalysisCsv(liveAnalysisCsv, retainedCsv, true), {\n    csv: liveAnalysisCsv");
assertContains("mobile retained CSV analysis gate", appValidation, "parseSessionSamples(retainedCsv).length > 0");
assertContains("mobile live CSV retained analysis fallback", appValidation, "return { csv: retainedCsv, source: \"Retained 1 Hz firmware session\" }");
assertContains("mobile live CSV analysis selector export", appProtocol, "selectSessionAnalysisCsv");
assertContains("mobile known CSV normalizer export", appProtocol, "normalizeKnownCsv");
assertContains("mobile known CSV normalizer helper", appValidation, "normalizeKnownCsv(raw: string)");
assertContains("mobile retained session normalizer export", appProtocol, "normalizeRetainedSessionCsv");
assertContains("mobile retained session normalizer helper", appValidation, "normalizeRetainedSessionCsv(raw: string)");
assertContains("mobile retained snapshot validator export", appProtocol, "normalizeRetainedSessionSnapshot");
assertContains("mobile retained snapshot validator preserves transfer bytes", appValidation, "return raw;\n}\n\nexport function normalizeFaultCsv");
assertContains("mobile retained snapshot validator permits cadence gaps", mobileValidationTests, "a valid rolling snapshot may contain more than one cadence-separated therapy segment");
assertContains("mobile retained snapshot validator still rejects non-increasing timestamps", mobileValidationTests, "the raw retained snapshot still requires strictly increasing timestamps");
assertContains("mobile fault CSV normalizer export", appProtocol, "normalizeFaultCsv");
assertContains("mobile fault CSV normalizer helper", appValidation, "normalizeFaultCsv(raw: string)");
assertContains("mobile fault snapshot validator export", appProtocol, "normalizeFaultSnapshot");
assertContains("mobile fault snapshot validator rejects malformed full snapshot", mobileValidationTests, "assert.equal(normalizeFaultSnapshot(faultCountCsv), null);");
assertContains("mobile retained expected-family import count helper", appValidation, "retainedReadbackImportedRowCount(sessionCsv: string, faultCsv: string)");
assertContains("mobile retained expected-family import count export", appProtocol, "retainedReadbackImportedRowCount");
assertContains("mobile known CSV normalizer uses preview lines", appValidation, "const lines = knownCsvLines(raw);");
assertContains("mobile live CSV current-session active state", mobileApp, "const [liveSyncSessionActive, setLiveSyncSessionActive] = useState(false);");
assertContains("mobile live CSV analysis selector uses source-matched retained data", mobileApp, "selectSessionAnalysisCsv(liveSyncCsv, visibleLogCsv, canUseDevice && liveSyncSessionActive)");
assertContains("mobile live CSV reconnect starts inactive", mobileApp, "setLiveSyncSessionActive(false);\n      setConnectedDevice(discovered);");
assertContains("mobile live CSV accepted row marks active", mobileApp, "setLiveSyncSessionActive(true);\n    const firstLiveSyncRow");
assertContains("mobile live CSV session reset marks inactive", mobileApp, "setLiveSyncSessionActive(false);");
assertContains("mobile live CSV retention minutes", mobileApp, "const liveSyncRetentionMinutes = 60");
assertContains("mobile live CSV max rows", mobileApp, "liveSyncRetentionMinutes * 60 * 10");
assertContains("mobile live CSV restart backstep threshold", mobileApp, "const liveSyncRestartBackstepMs = 5000");
assertContains("mobile live CSV spool filename", mobileApp, "const liveSyncSpoolFileName = \"ozealis-live-sync.csv\"");
assertContains("mobile retained session import filename", mobileApp, "const retainedSessionImportFileName = \"ozealis-retained-session.csv\"");
assertContains("mobile retained fault import filename", mobileApp, "const retainedFaultImportFileName = \"ozealis-retained-faults.csv\"");
assertContains("mobile retained import manifest filename", mobileApp, "const retainedImportManifestFileName = \"ozealis-retained-import.json\"");
assertContains("mobile retained import restore", mobileApp, "restoreRetainedImports()");
assertContains("mobile retained import restore parses strict manifest", mobileApp, "const manifest = parseRetainedImportManifest(manifestRaw);");
assertContains("mobile retained import restore rejects missing manifest", mobileApp, "if (!manifest) return;");
assertContains("mobile retained import restore binds session file identity", mobileApp, "retainedCsvMatchesIdentity(sessionCsv, manifest.session, normalizeRetainedSessionSnapshot)");
assertContains("mobile retained import restore binds fault file identity", mobileApp, "retainedCsvMatchesIdentity(faultLogCsv, manifest.fault, normalizeFaultSnapshot)");
assertContains("mobile retained import restore validates byte count", mobileApp, "Buffer.byteLength(raw, \"utf8\") === identity.total");
assertContains("mobile retained import restore validates hash", mobileApp, "csvTransferHash(raw) === identity.hash");
assertContains("mobile retained import restore validates exact canonical bytes", mobileApp, "normalize(raw) === raw");
assertContains("mobile retained import restore applies pair only after all validation", mobileApp, "setRetainedImport({ sessionCsv, faultCsv: faultLogCsv, manifest });");
assertContains("mobile retained manifest strict parser", appValidation, "export function parseRetainedImportManifest(raw: string): RetainedImportManifest | null");
assertContains("mobile retained manifest serializer validates input", appValidation, "export function serializeRetainedImportManifest(manifest: RetainedImportManifest): string");
assertContains("mobile retained manifest exact top-level schema", appValidation, "hasExactKeys(parsed, [\"deviceId\", \"fault\", \"importedAtMs\", \"session\", \"version\"])");
assertContains("mobile retained manifest records device identity", appValidation, "deviceId: string;");
assertContains("mobile retained manifest records import time", appValidation, "importedAtMs: number;");
assertContains("mobile live CSV spool restore", mobileApp, "restoreLiveSyncSpool()");
assertContains("mobile live CSV spool restore uses strict first-line helper", mobileApp, "const lines = liveSyncSpoolLines(restored);");
assertContains("mobile live CSV spool header validation", mobileApp, "if (lines[0] !== liveSyncCsvHeader) return null;");
assertContains("mobile live CSV spool rejects blank or padded lines", mobileApp, "if (lines.some((line) => line !== line.trim() || line.length === 0)) return null;");
assertContains("mobile live CSV spool inactive mode rejection", mobileApp, "const mode = parts[5];\n      if (mode !== \"1\" && mode !== \"2\") return false;\n      const ms = Number(parts[0]);");
assertContains("mobile live CSV row count state", mobileApp, "const [liveSyncRowCount, setLiveSyncRowCount] = useState(0);");
assertContains("mobile live CSV row count resets", mobileApp, "setLiveSyncCsv(\"\");\n    setLiveSyncRowCount(0);");
assertContains("mobile live CSV spool clears stale format", mobileApp, "writeLiveSyncSpool([])");
assertContains("mobile live CSV spool bad header resets timestamp cursor", mobileApp, "liveSyncLastMsRef.current = 0;\n        setLiveSyncCsv(\"\");\n        setLiveSyncRowCount(0);\n        writeLiveSyncSpool([]);");
assertContains("mobile live CSV spool restore catch clears bad file", mobileApp, "catch {\n      liveSyncRowsRef.current = [];\n      liveSyncLastMsRef.current = 0;\n      setLiveSyncCsv(\"\");\n      setLiveSyncRowCount(0);\n      writeLiveSyncSpool([]);");
assertContains("mobile live CSV row count restores", mobileApp, "setLiveSyncCsv(formatLiveSyncCsv(rows));\n      setLiveSyncRowCount(rows.length);");
assertContains("mobile live CSV row count tracks capture ref", mobileApp, "setLiveSyncRowCount(liveSyncRowsRef.current.length);");
assertContains("mobile live CSV spool rewrites stale rows", mobileApp, "rows.length < sourceRows.length || rows.length < filteredRows.length");
assertContains("mobile live CSV spool append revalidates local file", mobileApp, "const storedRows = readValidLiveSyncSpoolRows(file);");
assertContains("mobile live CSV spool append computes expected pending rows", mobileApp, "const expectedPending = liveSyncRowsRef.current.slice(storedRows.length);");
assertContains("mobile live CSV spool append verifies stored prefix", mobileApp, "!rowsMatch(storedRows, liveSyncRowsRef.current.slice(0, storedRows.length))");
assertContains("mobile live CSV spool append verifies pending rows", mobileApp, "!rowsMatch(pending, expectedPending)");
assertContains("mobile live CSV spool row equality helper", mobileApp, "function rowsMatch(left: string[], right: string[])");
assertContains("mobile live CSV spool append validation helper", mobileApp, "function readValidLiveSyncSpoolRows(file: File)");
assertContains("mobile live CSV spool append rewrites corrupt file", mobileApp, "writeLiveSyncSpool(liveSyncRowsRef.current);");
assertContains("mobile docs live CSV spool increasing rows", mobileDoc, "retaining only valid, increasing-timestamp rows");
assertContains("mobile docs live CSV reconnect derate", mobileDoc, "before a reconnected session receives at least 10 valid fresh live rows");
assertContains("mobile docs restored live rows validated untrimmed", mobileDoc, "Restored live CSV rows are validated without trimming");
assertContains("mobile docs restored live export only until minimum window", mobileDoc, "not treated as the current live analysis source until this connected session accepts a minimum live analysis window");
assertContains("mobile docs restored live non-first-line header rejection", mobileDoc, "foreign, padded, or non-first-line header");
assertContains("mobile docs corrupted live spool clears restored trace", mobileDoc, "clears the restored trace, resets the live timestamp cursor, and attempts to empty the bad spool");
assertContains("mobile docs live CSV spool exact prefix match", mobileDoc, "exact prefix match against the current in-memory trace");
assertContains("mobile live CSV spool append", mobileApp, "file.write(`${pending.join(\"\\n\")}\\n`, { append: true })");
assertContains("mobile live CSV formatter helper", mobileApp, "function formatLiveSyncCsv(rows: string[])");
assertContains("mobile live CSV export uses current buffer", mobileApp, "const csv = formatLiveSyncCsv(liveSyncRowsRef.current);");
assertContains("mobile live CSV export updates row count from ref", mobileApp, "setLiveSyncCsv(csv);\n    setLiveSyncRowCount(liveSyncRowsRef.current.length);");
assertContains("mobile export file catches write/share failures", mobileApp, "Export failed.");
assertContains("mobile export file reports shared export", mobileApp, "Export shared:");
assertContains("mobile export exact timestamped filename", mobileApp, "const fileName = `${name}-${new Date().toISOString().replace(/[:.]/g, \"-\")}.${extension}`;");
assertContains("mobile export shared exact filename message", mobileApp, "setMessage(`Export shared: ${fileName}`);");
assertContains("mobile export saved exact filename message", mobileApp, "setMessage(`Saved export: ${fileName}`);");
assertContains("mobile live CSV export enabled from in-memory rows", mobileApp, "disabled={liveSyncRows === 0}");
assertContains("mobile session CSV export is source matched", mobileApp, "label=\"Export session CSV\" onPress={() => exportCsv(\"ozealis-session\", visibleLogCsv)} disabled={!visibleLogCsv.trim()}");
assertContains("mobile fault CSV export is source matched", mobileApp, "label=\"Export fault CSV\" onPress={() => exportCsv(\"ozealis-faults\", visibleFaultCsv)} disabled={!visibleFaultCsv.trim()}");
assertContains("mobile live CSV first row updates UI immediately", mobileApp, "firstLiveSyncRow || now - liveSyncLastUiMsRef.current >= 1000");
assertContains("mobile live CSV ignores small stale backsteps", mobileApp, "liveSyncLastMsRef.current - packetMs <= liveSyncRestartBackstepMs");
assertContains("mobile live CSV resets on large backstep", mobileApp, "resetLiveSync();");
assertContains("mobile docs live CSV backstep restart", mobileDoc, "large backward firmware timestamp jump or a forward gap larger than the live 10 Hz cadence tolerance starts a fresh live trace");
assertContains("mobile docs restored live spool backstep restart", mobileDoc, "restored live-spool filtering applies the same large-backstep fresh-trace rule");
assertContains("mobile live CSV parser requires exact current row", appValidation, "parts.length !== 19");
assertContains("mobile live CSV exact session header", appValidation, "const LIVE_SESSION_HEADER");
assertContains("mobile retained CSV exact session header", appValidation, "const RETAINED_SESSION_HEADER");
assertAbsent("mobile legacy live oximetry header removed", appValidation, "LIVE_SESSION_OXIMETRY_HEADER");
assertAbsent("mobile legacy live environment header removed", appValidation, "LIVE_SESSION_ENVIRONMENT_HEADER");
assertAbsent("mobile legacy retained oximetry header removed", appValidation, "RETAINED_SESSION_OXIMETRY_HEADER");
assertAbsent("mobile legacy retained environment header removed", appValidation, "RETAINED_SESSION_ENVIRONMENT_HEADER");
assertContains("mobile live CSV header constant exact", appValidation, expectedCsvHeaders.live);
assertContains("mobile retained CSV header constant exact", appValidation, expectedCsvHeaders.retained);
assertContains("mobile fault CSV header constant exact", appValidation, expectedCsvHeaders.fault);
assertContains("mobile live spool header exact", mobileApp, expectedCsvHeaders.live);
assertContains("firmware retained CSV header exact", firmwareDatalog, expectedCsvHeaders.retained);
assertContains("firmware fault CSV header exact", firmwareDiag, expectedCsvHeaders.fault);
assertContains("firmware live CSV formatter stays unpadded", firmwareBle, "\"%lu,%.2f,%.2f,%.2f,%.2f,%d,%.2f,%.2f,%u,%u,%u,%u,%.2f,%s,%s,%u,%s,%s,%s\"");
assertContains("firmware retained CSV formatter stays unpadded", firmwareLogic, "\"%lu,%.2f,%.2f,%.2f,%.2f,%u,%.2f,%u,%u,%u,%u,%.2f,%s,%s,%u,%s,%s,%s\"");
assertContains("firmware fault CSV formatter stays unpadded", firmwareDiag, "\"%lu,%u,%u,%.2f,%.2f,%.2f,%.2f,%.2f,%.2f,%.2f,%u,%u,%u,%u,%.2f,%u,%u,%u,%d,%d\\n\"");
assertCsvFormatterUnpadded("firmware live CSV", firmwareBle);
assertCsvFormatterUnpadded("firmware retained CSV", firmwareLogic);
assertCsvFormatterUnpadded("firmware fault CSV", firmwareDiag);
assertContains("firmware fault CSV normalizes lowercase nan", firmwareDiag, "static void normalizeNanTokens(char* line)");
assertContains("firmware fault CSV applies NAN normalization", firmwareDiag, "normalizeNanTokens(line);");
assertContains("protocol docs live CSV header exact", protocolDoc, expectedCsvHeaders.live);
assertContains("protocol docs retained CSV header exact", protocolDoc, expectedCsvHeaders.retained);
assertContains("protocol docs fault CSV header exact", protocolDoc, expectedCsvHeaders.fault);
assertAbsent("protocol docs stale live CSV millis header", protocolDoc, "millis,setpoint_hPa");
assertContains("mobile live CSV graph parser exact format", appValidation, "header === LIVE_SESSION_HEADER");
assertContains("mobile session summary uses timestamp window", appValidation, "sampleWindowDurationSec(samples, 1000, samples, fallbackPeriodMs)");
assertContains("mobile session summary detects CSV family", appValidation, "sessionCsvFormat(raw)");
assertContains("mobile live summary fallback cadence", appValidation, "format === \"live\" ? 100 : 1000");
assertContains("mobile session summary caps retained cadence", appValidation, "Math.min(maxPeriodMs, inferredPeriodMs || fallbackPeriodMs)");
assertContains("mobile short live window display", mobileApp, "totalSeconds > 0 && totalSeconds < 1");
assertContains("mobile live CSV motor command parser", appValidation, "motorCmd: cleanCsvValue(parts[9])");
assertContains("mobile live CSV motor fault parser", appValidation, "motorFault: cleanCsvValue(parts[10])");
assertContains("mobile live CSV motor I2C parser", appValidation, "motorI2c: cleanCsvValue(parts[11])");
assertContains("mobile live CSV motor FG parser", appValidation, "motorFgHz: cleanCsvValue(parts[12])");
assertContains("mobile live CSV mode enum validation", appValidation, "if (index === 5) return boundedCsvInteger(part, 0, 4);");
assertContains("mobile live CSV evidence mode helper", appValidation, "function isValidLiveSessionEvidenceRow(row: string): boolean");
assertContains("mobile live CSV evidence mode startup/running only", appValidation, "return mode === \"1\" || mode === \"2\";");
assertContains("mobile validation tests raw idle live row is syntactically valid", mobileValidationTests, "isValidLiveCsvRow(\"1000,9.81,1.20,-0.4,24.0,0,10.20,-0.20,42,42,0,1,123.45,NAN,NAN,0,NAN,NAN,NAN\")");
assertContains("mobile validation tests live inactive modes excluded from evidence", mobileValidationTests, "for (const inactiveMode of [\"0\", \"3\", \"4\"])");
assertContains("mobile live capture mode uses exact field", mobileApp, "const mode = parts[5];");
assertContains("mobile live CSV motor status flag validation", appValidation, "if (index === 10 || index === 11) return boundedCsvInteger(part, 0, 1);");
assertContains("mobile retained CSV row helper", appValidation, "function isValidRetainedCsvRow(row: string)");
assertContains("mobile retained/fault CSV rejects padded rows", appValidation, "if (row !== row.trim()) return false;");
assertContains("mobile retained CSV motor status flag validation", appValidation, "if (index === 9 || index === 10) return boundedCsvInteger(part, 0, 1);");
assertContains("mobile live CSV motor command display", mobileApp, "Driver command");
assertContains("mobile live CSV motor FG display", mobileApp, "Driver FG");
assertContains("mobile advanced session graph motor FG field", appValidation, "motorFgHz: values[11] as number");
assertContains("mobile advanced session graph live motor FG field", appValidation, "motorFgHz: values[12] as number");
assertContains("mobile advanced session graph motor FG plot", mobileApp, "values={points.map((point) => point.motorFgHz)}");
assertContains("mobile live CSV motor fault display", mobileApp, "Driver fault");
assertContains("mobile live CSV motor I2C display", mobileApp, "Driver I2C");
assertContains("mobile driver I2C explicit labels", mobileApp, "telemetry.motorI2c === \"1\" ? \"Present\" : telemetry.motorI2c === \"0\" ? \"Missing\" : \"Unknown\"");
assertContains("mobile driver fault explicit labels", mobileApp, "telemetry.motorFault === \"1\" ? \"Latched\" : telemetry.motorFault === \"0\" ? \"Clear\" : \"Unknown\"");
assertContains("mobile docs driver telemetry", mobileDoc, "Display MCF8316D driver command, FG tach frequency, fault latch, I2C probe status");
assertContains("mobile docs MCF writes readback-valid gate", mobileDoc, "parameter-write availability as displayable only after a `readback_valid` MCF8316D snapshot");
assertContains("mobile telemetry system mode parser helper", appValidation, "parseSystemMode(raw: string)");
assertContains("mobile telemetry fault parser helper", appValidation, "parseFaultCode(raw: string)");
assertContains("mobile telemetry module parser helper", appValidation, "parseModuleStatus(raw: string)");
assertContains("mobile telemetry exact system mode parser", appValidation, "return /^[0-4]$/.test(raw) ? raw : \"--\";");
assertContains("mobile telemetry exact fault parser", appValidation, "return /^[0-4]$/.test(raw) ? raw : \"--\";");
assertContains("mobile telemetry exact module parser", appValidation, "if (!/^(?:[0-9]|1[0-5])$/.test(raw)) return \"unknown\";");
assertContains("mobile telemetry module prewarm label", appValidation, "if (flags & 8) modules.push(\"prewarm\");");
assertContains("mobile telemetry padded mode rejection test", mobileValidationTests, "assert.equal(parseSystemMode(\" 2 \"), \"--\");");
assertContains("mobile telemetry padded fault rejection test", mobileValidationTests, "assert.equal(parseFaultCode(\" 1 \"), \"--\");");
assertContains("mobile telemetry padded module rejection test", mobileValidationTests, "assert.equal(parseModuleStatus(\" 3 \"), \"unknown\");");
assertContains("mobile telemetry prewarm module test", mobileValidationTests, "assert.equal(parseModuleStatus(\"9\"), \"humidifier + prewarm\");");
assertContains("mobile telemetry optional numeric parser helper", appValidation, "parseOptionalTelemetryNumber(raw: string)");
assertContains("mobile telemetry optional parser rejects padded text", appValidation, "if (raw !== raw.trim() || !raw || raw === \"NAN\") return \"--\";");
assertContains("mobile telemetry optional parser uses plain decimal helper", appValidation, "return finiteCsvNumber(raw) !== null ? raw : \"--\";");
assertContains("mobile telemetry optional padded number test", mobileValidationTests, "assert.equal(parseOptionalTelemetryNumber(\" 24.5 \"), \"--\");");
assertContains("mobile telemetry optional padded NAN test", mobileValidationTests, "assert.equal(parseOptionalTelemetryNumber(\" NAN \"), \"--\");");
assertContains("mobile telemetry optional exponent rejection test", mobileValidationTests, "assert.equal(parseOptionalTelemetryNumber(\"1e3\"), \"--\");");
assertContains("mobile telemetry optional plus-sign rejection test", mobileValidationTests, "assert.equal(parseOptionalTelemetryNumber(\"+24.5\"), \"--\");");
assertContains("mobile telemetry normalizes mode", mobileApp, "key === \"mode\"");
assertContains("mobile telemetry normalizes fault", mobileApp, "key === \"fault\"");
assertContains("mobile telemetry normalizes module status", mobileApp, "key === \"moduleStatus\"");
assertContains("mobile telemetry normalizes optional module readings", mobileApp, "key === \"humidifierTemp\" || key === \"humidifierRh\" || key === \"hoseTemp\"");
assertContains("mobile telemetry humidifier not-present display", mobileApp, "function humidifierLabel()");
assertContains("mobile telemetry hose not-present display", mobileApp, "function hoseTemperatureLabel()");
assertContains("mobile telemetry module label display", mobileApp, "label=\"Modules\"");
assertContains("mobile docs finite telemetry enums", mobileDoc, "system mode and fault must be exact `0..4`, module status must be an exact decimal bitfield `0..15`");
assertContains("protocol docs module status prewarm bit", protocolDoc, "bit 3 water-warmer prewarm");
assertContains("protocol docs module status exact range", protocolDoc, "module status must be an exact decimal bitfield from `0` through `15`");
assertContains("mobile docs exact optional module readings", mobileDoc, "optional humidifier/hose readings must be exact unpadded plain-decimal finite numbers or exact `NAN`");
assertContains("mobile docs optional module readings", mobileDoc, "exact `NAN` readings are shown as not present");
assertContains("protocol docs exact optional notification text", protocolDoc, "humidifier/hose readings must be exact unpadded plain-decimal finite numbers or exact uppercase `NAN`");
assertContains("protocol docs exponent optional notification rejection", protocolDoc, "exponent-form");
assertContains("mobile docs command path state", mobileDoc, "parameter-snapshot command path state");
assertContains("mobile docs protocol write gate", mobileDoc, "disable settings, start, calibration, OTA, retained-log transfer, log clear, and driver-fault clear writes");
assertContains("mobile simple advanced mode state", mobileApp, "const [advancedMode, setAdvancedMode] = useState(false);");
assertContains("mobile web BLE preview mode guard", mobileApp, "const blePreviewMode = Platform.OS === \"web\";");
assertContains("mobile web skips native BLE manager", mobileApp, "if (blePreviewMode) {\n      setBleState(\"Unsupported\" as State);\n      setMessage(\"Previewing the app layout.\");\n      return");
assertContains("mobile native BLE manager constructed after preview guard", mobileApp, "const nativeManager = new BleManager();");
assertContains("mobile UI preference file", mobileApp, "ozealis-ui-preferences.json");
assertContains("mobile UI preference restore", mobileApp, "async function restoreUiPreferences()");
assertContains("mobile UI preference write", mobileApp, "function writeUiPreferences(nextAdvancedMode: boolean)");
assertContains("mobile UI preference startup guard", mobileApp, "if (!uiPreferenceReadyRef.current) return;");
assertContains("mobile UI preference parser", appValidation, "export function parseUiPreference(raw: string): boolean");
assertContains("mobile UI preference parser use", mobileApp, "setAdvancedMode(parseUiPreference(raw));");
assertContains("mobile UI preference parser primitive test", read("scripts/test-mobile-validation.mjs"), "for (const rawPreference of [\"not json\", \"null\", \"42\", \"\\\"advanced\\\"\", \"[]\", \"true\", \"{}\"]");
assertContains("mobile docs UI preference fail closed", mobileDoc, "malformed, primitive, array, or non-boolean preference files as Simple mode");
assertContains("mobile simple action error helper", mobileApp, "function actionErrorMessage(error: unknown, simpleFallback: string, advancedFallback = simpleFallback)");
assertContains("mobile async error copy uses current interface mode", mobileApp, "if (!advancedModeRef.current) return simpleFallback;");
assertContains("mobile delayed guard copy uses current interface mode", mobileApp, "return typeof messageText === \"string\" ? messageText : advancedModeRef.current ? messageText.advanced : messageText.simple;");
assertContains("mobile settings refresh success uses current interface mode", mobileApp, "setMessage(advancedModeRef.current ? \"Settings loaded from device.\" : \"Comfort updated.\");");
assertContains("mobile settings write success uses current interface mode", mobileApp, "const messageAdvanced = advancedModeRef.current;\n      setMessage(\n        messageAdvanced");
assertContains("mobile retained import status uses current interface mode", mobileApp, "const messageAdvanced = advancedModeRef.current;\n      setMessage(\n        reason === \"auto\"\n          ? messageAdvanced");
assertContains("mobile docs async success copy current interface mode", mobileDoc, "settings-read/write success, and retained-data import status copy must use the current Simple/Advanced interface state");
assertContains("mobile action error helper handles BLE object messages", mobileApp, "typeof error === \"object\" && error !== null && \"message\" in error && typeof error.message === \"string\"");
assertContains("mobile simple scan failure copy", mobileApp, "Could not scan. Try again.");
assertContains("mobile scan failure uses action error helper", mobileApp, "actionErrorMessage(error, \"Could not scan. Try again.\", \"Scan failed.\")");
assertAbsent("mobile scan raw error branch removed", mobileApp, "advancedMode ? error.message : \"Could not scan. Try again.\"");
assertContains("mobile simple connection failure copy", mobileApp, "Could not connect. Try pairing again.");
assertContains("mobile simple subscription failure copy", mobileApp, "Connection needs attention.");
assertContains("mobile log clear fixed failure copy", mobileApp, "actionErrorMessage(error, \"Could not clear logs.\", \"Log clear failed.\")");
assertAbsent("mobile log clear raw exception fallback removed", mobileApp, "setMessage(error instanceof Error ? error.message : \"Could not clear logs.\");");
assertContains("mobile motor fault clear fixed failure copy", mobileApp, "actionErrorMessage(error, \"Could not clear motor driver fault.\", \"Motor driver fault clear failed.\")");
assertAbsent("mobile motor fault clear raw exception fallback removed", mobileApp, "setMessage(error instanceof Error ? error.message : \"Could not clear motor driver fault.\");");
assertContains("mobile subscription errors carry device session", mobileApp, "function handleTelemetrySubscriptionError(device: Device, sessionId: number, errorMessage: string)");
assertContains("mobile subscription errors reject stale sessions", mobileApp, "if (!isCurrentDeviceSession(device, sessionId)) return;");
assertContains("mobile subscription errors reset matching session", mobileApp, "if (!resetDeviceSessionState(sessionId)) return;\n    flushLiveSyncCsv();");
assertContains("mobile docs subscription error cleanup", mobileDoc, "telemetry subscription monitoring fails");
assertContains("mobile simple protocol alert title", mobileApp, "advancedMode ? \"Protocol mismatch\" : \"Update app or firmware\"");
assertContains("mobile simple write standby alert title", mobileApp, "advancedMode ? \"Write unavailable\" : \"Use standby\"");
assertContains("mobile simple motor standby alert title", mobileApp, "advancedModeRef.current ? \"Motor command unavailable\" : \"Use standby\"");
assertContains("mobile simple driver reread standby copy", mobileApp, "Use standby to start airflow.");
assertContains("mobile simple tabs omit OTA", mobileApp, "const simpleTabs: Screen[] = [\"control\", \"settings\", \"logs\", \"calibration\", \"about\"];");
assertContains("mobile advanced tabs include OTA", mobileApp, "const advancedTabs: Screen[] = [\"control\", \"settings\", \"logs\", \"calibration\", \"ota\", \"about\"];");
assertContains("mobile simple mode status readout", mobileApp, "displayPressureUnit");
assertContains("mobile simple mode cmH2O unit", mobileApp, "const displayPressureUnit = \"cmH2O\";");
assertContains("mobile simple mode comfort range", mobileApp, "const comfortPressureLabel");
assertContains("mobile simple mode pressure formatter", mobileApp, "function formatPressureSetting(value: number): string");
assertContains("mobile simple status line hidden when idle", mobileApp, "const showStatusLine = advancedMode || busy || scanning || Boolean(message.trim());");
assertContains("mobile simple status line conditional", mobileApp, "{showStatusLine && (");
assertContains("mobile simple starts without preemptive message", mobileApp, "const [message, setMessage] = useState(\"\");");
assertContains("mobile simple home unknown status label", mobileApp, "connectedStateUnknown\n    ? \"Checking\"");
assertContains("mobile simple home unknown status hint", mobileApp, "Waiting for device status.");
assertContains("mobile simple home unknown status pending dot", mobileApp, "connectedStateUnknown && styles.statusDotPending");
assertContains("mobile simple normal home hides telemetry table", mobileApp, "{(advancedMode || faultActive) && (");
assertContains("mobile simple home alert section only", mobileApp, "<Text style={styles.sectionTitle}>{advancedMode ? \"Live Telemetry\" : \"Alert\"}</Text>");
assertContains("mobile advanced home mode label", mobileApp, "advancedMode && <ValueRow label=\"System mode\"");
assertContains("mobile advanced home therapy label", mobileApp, "advancedMode && <ValueRow label=\"Therapy mode\"");
assertContains("mobile advanced home hose label", mobileApp, "advancedMode && <ValueRow label=\"Hose temperature\"");
assertContains("mobile simple home alert map", mobileApp, "const simpleFaultTypes = [\"No alert\", \"Low power\", \"Sensor alert\", \"Pressure alert\", \"Device alert\"]");
assertContains("mobile simple home alert label", mobileApp, "label={advancedMode ? \"Fault\" : \"Device\"}");
assertContains("mobile advanced measured pressure only", mobileApp, "advancedMode && <ValueRow label=\"Measured pressure\"");
assertContains("mobile docs simple advanced UX", mobileDoc, "Default to a consumer-style Simple mode with Home, Comfort, Data, Setup, and About tabs");
assertContains("mobile docs default simple hides builder details", mobileDoc, "hide raw BLE, MCF8316D, OTA, CSV, driver commissioning, and builder diagnostic details");
assertContains("mobile docs persisted UI preference", mobileDoc, "persist the user's interface preference locally");
assertContains("mobile docs simple cmH2O language", mobileDoc, "Keep Simple mode pressure language in `cmH2O`");
assertContains("mobile docs simple home appliance labels", mobileDoc, "Keep Simple Home appliance-like");
assertContains("mobile docs simple home unknown status", mobileDoc, "Simple Home shows `Checking` and `Waiting for device status.` rather than `Ready`");
assertContains("mobile docs simple home no normal telemetry", mobileDoc, "Do not show a normal-state telemetry table or idle status strip in Simple");
assertContains("mobile docs simple home alert wording", mobileDoc, "translate raw fault names into plain alert names");
assertContains("mobile simple comfort low pressure label", mobileApp, "advancedMode ? \"Minimum pressure (cmH2O)\" : \"Low pressure\"");
assertContains("mobile simple comfort high pressure label", mobileApp, "advancedMode ? \"Maximum pressure (cmH2O)\" : \"High pressure\"");
assertContains("mobile simple comfort pressure relief label", mobileApp, "advancedMode ? \"EPR relief (cmH2O)\" : \"Pressure relief\"");
assertContains("mobile simple comfort ramp label", mobileApp, "advancedMode ? \"Ramp seconds\" : \"Ramp time\"");
assertContains("mobile simple comfort ramp minutes conversion", mobileApp, "Math.round(settings.ramp / 60)");
assertContains("mobile simple comfort ramp seconds preservation", mobileApp, "ramp: advancedMode ? ramp : Math.max(0, Math.round(ramp * 60))");
assertContains("mobile simple comfort ramp suffix", mobileApp, "suffix={advancedMode ? undefined : \"min\"}");
assertContains("mobile simple comfort mode label", mobileApp, "{advanced ? \"Therapy mode\" : \"Mode\"}");
assertContains("mobile simple comfort update label", mobileApp, "label={advancedMode ? \"Read\" : \"Update\"}");
assertContains("mobile comfort refresh action helper", mobileApp, "async function refreshSettings()");
assertContains("mobile comfort refresh action uses helper", mobileApp, "onPress={refreshSettings}");
assertContains("mobile simple comfort updated message", mobileApp, "Comfort updated.");
assertContains("mobile simple comfort update failure copy", mobileApp, "Could not update comfort.");
assertContains("mobile advanced settings loaded message", mobileApp, "Settings loaded from device.");
assertContains("mobile simple comfort adjustment helper", mobileApp, "function simpleSettingLimitMessages");
assertContains("mobile simple comfort adjustment title", mobileApp, "advancedMode ? \"Review adjusted settings\" : \"Comfort adjusted\"");
assertContains("mobile simple comfort idle alert title", mobileApp, "advancedMode ? \"Settings require idle\" : \"Save from standby\"");
assertContains("mobile simple comfort idle alert body", mobileApp, "Stop airflow or setup, then try again.");
assertContains("mobile simple comfort adjusted save message", mobileApp, "Comfort settings adjusted. Review and save again.");
assertContains("mobile simple comfort saved copy", mobileApp, "Comfort saved.");
assertContains("mobile simple comfort failure copy", mobileApp, "Comfort did not save. Try again from standby.");
assertContains("mobile simple comfort ramp adjusted minutes", mobileApp, "Ramp time adjusted to ${Math.round(safe.ramp / 60)} min.");
assertContains("mobile docs simple comfort appliance labels", mobileDoc, "Keep Simple Comfort appliance-like");
assertContains("mobile docs simple comfort ramp minutes", mobileDoc, "display ramp in minutes while preserving seconds");
assertContains("mobile docs simple comfort adjustment wording", mobileDoc, "show out-of-range or device-returned adjustments as comfort adjustments");
assertContains("mobile docs simple comfort update failure wording", mobileDoc, "make Comfort update/read failures and delayed write-time guard failures plain-language");
assertContains("mobile docs simple comfort advanced protocol wording", mobileDoc, "protocol/readback wording");
assertContains("mobile docs simple therapy picker", mobileDoc, "Keep the Simple Comfort therapy picker limited to CPAP, AutoPAP, and BiPAP S");
assertContains("mobile docs simple builder mode choices hidden", mobileDoc, "hides the Simple mode choices");
assertContains("mobile docs simple quiet blocker copy", mobileDoc, "avoid preemptive readiness/failure explanations in Simple");
assertContains("mobile docs simple neutral precheck copy", mobileDoc, "When a Simple pre-check stops a start/setup action before sending a command");
assertContains("mobile docs simple no failure-first precheck copy", mobileDoc, "not failure-first copy like `could not start`, `did not start`, or `try again`");
assertContains("mobile docs simple no hypothetical failure copy", mobileDoc, "any \"this may fail\" style copy before a failure actually happens");
assertContains("mobile docs simple failure copy boundary", mobileDoc, "Reserve raw BLE exception text");
assertContains("mobile advanced about tab label", mobileApp, "about: \"About\"");
assertContains("mobile simple about title", mobileApp, "advancedMode ? \"About This App\" : \"About Ozealis\"");
assertContains("mobile simple about public project purpose", mobileApp, "Ozealis is the open-source experimental CPAP/BiPAP project at https://ozealis.org/.");
assertContains("mobile simple about project URL", mobileApp, "const projectUrl = \"https://ozealis.org/\"");
assertContains("mobile app version constant", mobileApp, `const appVersion = "${mobilePackageJson.version}";`);
assertContains("mobile advanced about app version row", mobileApp, "<ValueRow label=\"App version\" value={appVersion} />");
assertContains("mobile about builder options disclosure", mobileApp, "style={styles.builderDisclosure}");
assertContains("mobile about builder settings label", mobileApp, "<Text style={styles.builderDisclosureText}>Builder settings</Text>");
assertContains("mobile simple top research warning hidden", mobileApp, "{advancedMode && (\n        <View style={styles.notice}>");
assertContains("mobile about mode selector", mobileApp, "UiModeSelector advancedMode={advancedMode} setAdvancedMode={setAdvancedMode}");
assertContains("mobile advanced about BLE service", mobileApp, "{advancedMode && (\n              <>\n                <ValueRow label=\"BLE service\"");
assertContains("mobile docs simple about boundary", mobileDoc, "Keep Simple About focused on the public `https://ozealis.org/` CPAP/BiPAP project");
assertContains("mobile docs app version advanced-only", mobileDoc, "app version/build identifier, and full responsibility language for Advanced");
assertContains("mobile docs simple about hides unpaired device row", mobileDoc, "the connected device name only after pairing");
assertContains("mobile connection setup waits for protocol/settings/snapshot", mobileApp, "await loadDriverParams(discovered, sessionId);");
assertContains("mobile connection updates connected ref before preload", mobileApp, "connectedDeviceRef.current = discovered;\n      previousModeRef.current = EMPTY_TELEMETRY.mode;");
assertContains("mobile connection subscribes before committing state", mobileApp, "subscribeTelemetry(discovered, sessionId);\n      if (!isCurrentDeviceSession(discovered, sessionId))");
assertContains("mobile connection commits inactive live state", mobileApp, "setLiveSyncSessionActive(false);\n      setConnectedDevice(discovered);");
assertContains("mobile failed setup cancels connection", mobileApp, "await managerRef.current?.cancelDeviceConnection(discovered.id).catch(() => undefined);");
assertContains("mobile manual disconnect captures device id", mobileApp, "const deviceId = connectedDevice.id;");
assertContains("mobile manual disconnect catches BLE close error", mobileApp, "disconnectError = error;");
assertContains("mobile manual disconnect resets only matching session", mobileApp, "sessionReset = resetDeviceSessionState(sessionId);");
assertContains("mobile manual disconnect advanced BLE close message", mobileApp, "Disconnected locally; BLE close reported an error.");
assertContains("mobile initial telemetry state uses fresh copy", mobileApp, "useState<OzealisTelemetry>(() => ({ ...EMPTY_TELEMETRY }))");
assertContains("mobile initial settings state uses fresh copy", mobileApp, "useState<OzealisSettings>(() => ({ ...DEFAULT_SETTINGS }))");
assertContains("mobile session reset telemetry uses fresh copy", mobileApp, "setTelemetry({ ...EMPTY_TELEMETRY });");
assertContains("mobile session reset settings uses fresh copy", mobileApp, "setSettings({ ...DEFAULT_SETTINGS });");
assertContains("mobile session reset clears connected device ref synchronously", mobileApp, "autoImportPendingSessionRef.current = null;\n    autoImportRetryCountRef.current = 0;\n    clearAutoImportRetry(false);\n    oximetryRelayRef.current?.clearPending();\n    connectedDeviceRef.current = null;\n    setConnectedDevice(null);");
assertContains("mobile session reset clears protocol", mobileApp, "setProtocolVersion(\"unknown\");");
assertContains("mobile session reset clears driver snapshot", mobileApp, "setDriverParamsJson(\"\");");
assertContains("mobile session reset clears OTA SSID", mobileApp, "setOtaSsid(\"\");");
assertContains("mobile session reset clears OTA password", mobileApp, "setOtaPassword(\"\");");
assertContains("mobile session reset clears OTA URL", mobileApp, "setOtaUrl(\"\");");
assertContains("mobile session reset clears auto import session", mobileApp, "autoImportingSessionRef.current = null;");
assertContains("mobile session reset clears pending auto import session", mobileApp, "autoImportPendingSessionRef.current = null;");
assertContains("mobile water checklist default object", mobileApp, "const emptyWaterSetupChecks: Record<WaterSetupKey, boolean>");
assertContains("mobile session reset clears water setup checklist", mobileApp, "setWaterSetupChecks({ ...emptyWaterSetupChecks });");
assertContains("mobile docs session reset clears auto import latch", mobileDoc, "clear pending automatic log-import bookkeeping");
assertContains("mobile docs delayed callbacks verify current device", mobileDoc, "delayed destructive or motor-moving callbacks must verify their captured device still matches the current connected session before writing");
assertContains("mobile docs automatic retained graph import", mobileDoc, "Automatically import the latest retained session and fault logs after telemetry leaves Startup/Running and settles in Idle/Fault");
assertContains("mobile docs connected 10 Hz live capture", mobileDoc, "latest 60 minutes of connected live CSV at up to 10 Hz");
assertContains("mobile docs live CSV fresh-buffer export", mobileDoc, "built from the current in-memory capture buffer before sharing");
assertContains("mobile docs live CSV export enabled from row count", mobileDoc, "Live CSV export is enabled from the current in-memory row count");
assertContains("mobile docs live CSV restored trace inactive mode rejection", mobileDoc, "inactive-mode rows are rejected from the restored in-memory trace");
assertContains("mobile docs live CSV evidence mode boundary", mobileDoc, "live rows count as graph/session evidence only in startup or running modes");
assertContains("mobile docs disconnect derates analysis", mobileDoc, "derate analysis to the retained 1 Hz firmware session after Bluetooth disconnects");
assertContains("mobile docs live 10 Hz persistent spool", mobileDoc, "spools that latest window to app documents storage");
assertContains("mobile docs live CSV spool header validation", mobileDoc, "validating the exact live CSV header");
assertContains("mobile docs live CSV append revalidates spool", mobileDoc, "Before appending pending live rows to the local spool");
assertContains("mobile docs analysis source label", mobileDoc, "label whether graphs and observation flags come from live app sync or the retained firmware session");
assertContains("mobile simple data airflow trend", mobileApp, "label={advanced ? \"Flow proxy\" : \"Airflow trend\"}");
assertContains("mobile simple data relative flow unit", mobileApp, "unit={advanced ? \"hPa\" : \"relative\"}");
assertContains("mobile simple data review notes", mobileApp, "advanced ? \"Potential breathing observations\" : \"Airflow notes\"");
assertContains("mobile docs simple data labels", mobileDoc, "In Simple Data, label the flow graph as an airflow trend, hide graph min/max ranges and heuristic basis details");
assertContains("protocol docs live CSV typed status boundary", protocolDoc, "Live CSV `mode` must be a firmware mode enum integer `0..4`");
assertContains("protocol docs live CSV evidence mode boundary", protocolDoc, "live CSV rows count as graph/session evidence only when `mode` is startup `1` or running `2`");
assertContains("protocol docs live CSV finite FG row gate", protocolDoc, "required numeric graph fields, including FG tach, are finite");
assertContains("protocol docs live CSV skips incomplete FG", protocolDoc, "incomplete pressure, controller, or FG tach reads skip that live CSV row");
assertContains("protocol docs session CSV binary motor flags", protocolDoc, "must be binary `0`/`1` flags");
assertContains("mobile docs potential breathing observations", mobileDoc, "Flag non-diagnostic potential breathing observations");
assertContains("mobile docs low-flow observation labels", mobileDoc, "central-like low-flow, hypopnea-like low-flow");
assertContains("mobile docs low-flow index display", mobileDoc, "Display BLE characteristic `0006` as a non-diagnostic low-flow index");
assertContains("mobile docs low-flow not clinical AHI", mobileDoc, "not as a clinical AHI value");
assertContains("mobile docs low-flow observation boundary", mobileDoc, "not diagnostic, screening, treatment, or efficacy outputs");
assertContains("mobile observation duration uses sample cadence", appValidation, "segmentDurationSec(segment, samples)");
assertContains("mobile observation cadence estimator", appValidation, "estimateSamplePeriodMs(cadenceSamples)");
assertContains("mobile observation pre-window is time based", appValidation, "sample.ms >= segmentStartMs - 20000");
assertContains("mobile observation requires controller baseline flag", appValidation, "const hasControllerBaseline = Number.isFinite(meanController) && Number.isFinite(beforeController);");
assertContains("mobile observation central requires controller baseline", appValidation, "if (hasControllerBaseline && (Number.isFinite(meanError) && Math.abs(meanError) <= 1.0) && Math.abs(controllerRise) <= 8)");
assertContains("mobile validation tests no-baseline low-flow indeterminate", mobileValidationTests, "noBaselineFlags[0].type, \"indeterminate low-flow pattern\"");
assertContains("mobile docs observation timestamp cadence", mobileDoc, "Observation durations are computed from CSV timestamps");
assertContains("mobile docs central-like baseline boundary", mobileDoc, "Central-like low-flow labels require a real pre-window controller baseline");
assertContains("mobile docs water-column setup checklist", mobileDoc, "require every physical setup checklist item before confirmation");
assertContains("mobile docs water checklist resets per session", mobileDoc, "clear that checklist on connected-session reset so a later setup requires fresh physical confirmation");
assertContains("mobile docs water-column capture ladder", mobileDoc, "show a 4-20 cmH2O capture ladder");
assertContains("mobile docs water-column sensor trim status", mobileDoc, "differential sensor trim status");
assertContains("mobile docs start-like fresh state readback", mobileDoc, "Start-like writes reread mode, fault, calibration status, and the encrypted MCF8316D snapshot");
assertContains("mobile docs calibration command readback", mobileDoc, "All calibration commands reread the status characteristic after writing");
assertContains("mobile docs calibration abort unknown not verified", mobileDoc, "abort is shown as verified only when the post-write readback is non-active with a known calibration state");
assertContains("mobile docs calibration fresh capture abort readback", mobileDoc, "capture and abort reread calibration status immediately before writing");
assertContains("mobile docs calibration immediate notification", mobileDoc, "Firmware also notifies calibration status immediately after command handling");
assertContains("mobile docs log clear confirmation and fault guard", mobileDoc, "Clear session and fault logs only after confirmation while the device is idle, the reported fault code is clear");
assertContains("mobile docs log clear fresh readback", mobileDoc, "rereads mode, fault, and calibration status immediately before sending the clear request");
assertContains("mobile docs log clear preserves live trace until verified", mobileDoc, "resets the app-side live 10 Hz trace only after both retained-session and fault CSV readbacks are canonical header-only clear evidence");
assertContains("mobile docs log clear rows-present expected family", mobileDoc, "Clear status says retained rows are still present only when post-clear readback rows normalize into the expected retained-session or fault file family");
assertContains("mobile docs bounded CSV preview", mobileDoc, "bounded on-screen previews, row counts, and the retained session duration");
assertContains("mobile docs retained session limit", mobileDoc, "rolling 30-minute 1 Hz session buffer in RAM");
assertContains("mobile docs motor fault clear", mobileDoc, "Request motor-driver fault latch clearing");
assertContains("mobile docs motor fault clear guard", mobileDoc, "only while the device is idle or reporting `FAULT_IO`");
assertContains("mobile docs driver readiness explicit clear latch", mobileDoc, "MCF8316D driver reports present on I2C with an explicit clear fault-latch reading");
assertContains("mobile docs driver readiness unknown fault blocked", mobileDoc, "Unknown driver-fault telemetry is treated as not ready");
assertContains("mobile docs driver readiness unknown fault blocker", mobileDoc, "`MCF8316D fault-latch reading is unknown.`");
assertContains("mobile start blocker unknown fault telemetry", mobileApp, "MCF8316D fault-latch reading is unknown.");
assertMinimumOccurrences("mobile start/calibration unknown fault blockers", mobileApp, "MCF8316D fault-latch reading is unknown.", 2);
assertContains("mobile docs start blocker display", mobileDoc, "Advanced control and calibration screens show the active technical blocker");
assertContains("mobile docs start fault-code guard", mobileDoc, "reported fault code is clear");
assertContains("mobile scan timeout ref", mobileApp, "scanTimeoutRef");
assertContains("mobile scan timeout cleanup", mobileApp, "clearTimeout(scanTimeoutRef.current)");
assertContains("mobile clears stale scan results when BLE unavailable", mobileApp, "setDevices([]);");
assertContains("mobile clears stale scan results before connecting", mobileApp, "try {\n      stopScan();\n      setDevices([]);\n      oximetryRelayRef.current?.clearPending();");
assertContains("mobile Ozealis replacement waits for in-flight relay", mobileApp, "await oximetryRelayRef.current?.whenIdle();\n      if (deviceSessionIdRef.current !== sessionId) return;");
assertContains("mobile reset clears stale scan results", mobileApp, "setConnectedDevice(null);\n    setBusy(false);\n    setDevices([]);");
assertContains("mobile tracks connected device for BLE state cleanup", mobileApp, "connectedDeviceRef.current = discovered;");
assertContains("mobile clears stale connected session when BLE unavailable", mobileApp, "if (connectedDeviceRef.current) {\n          cleanupSubscriptions();\n          resetDeviceSessionState();\n          flushLiveSyncCsv();");
assertContains("mobile reports BLE unavailable during scan cleanup", mobileApp, "Turn Bluetooth on before scanning.");
assertContains("mobile docs stale scan result cleanup", mobileDoc, "clear stale scan results");
assertContains("mobile docs stale connected session cleanup", mobileDoc, "clear stale connected-session state");
assertContains("mobile docs disconnect cleanup error boundary", mobileDoc, "Manual disconnect cleanup must run even if the platform BLE close call reports an error");
assertContains("firmware session log samples", firmwareLogic, "dl_push(line)");
assertContains("firmware session log includes calibration", firmwareLogic, "currentMode == MODE_RUNNING || motorCalIsActive()");
assertContains("firmware session log controller fields", firmwareLogic, "papGetPressureErrorCm()");
assertContains("motor calibration docs finite retained calibration trace", motorCalibrationDoc, "instead of silently dropping every calibration row because idle PAP getters are unavailable");
assertContains("firmware fault aborts calibration", firmwareLogic, "if (motorCalIsActive()) motorCalAbort();");
assertFaultStopsBeforeAlarm();
assertContains("firmware button calibration include", firmwareButton, "#include \"motor_calibration.h\"");
assertContains("firmware button motor include", firmwareButton, "#include \"motor.h\"");
assertContains("firmware button aborts calibration", firmwareButton, "motorCalAbort();");
assertContains("firmware button captures water calibration", firmwareButton, "motorCalCapturePoint()");
assertContains("firmware button short start idle guard", firmwareButton, "currentMode == MODE_IDLE");
assertContains("firmware button short start fault-code guard", firmwareButton, "currentFault != FAULT_NONE");
assertContains("firmware button short start latched-fault publishes unchanged state", firmwareButton, "Button: start ignored while fault is latched\");\n      sendBLEEvent(\"BUTTON_START_IGNORED_FAULT\");");
assertContains("firmware button short start driver-ready guard", firmwareButton, "Button: start rejected, motor driver not ready");
assertContains("firmware button long idle guard", firmwareButton, "Button: long ignored");
assertContains("firmware button long clears cpap namespace only", firmwareButton, "p.begin(\"cpap\", false)");
assertContains("firmware button long clears settings namespace", firmwareButton, "p.clear();");
assertLongPressResetScope();
assertContains("firmware button pairing idle guard", firmwareButton, "Button: pairing ignored");
assertContains("firmware button pairing starts advertising", firmwareButton, "ensureBleAdvertising();");
assertContains("firmware README button state rules", firmwareReadme, "short press starts only from idle");
assertContains("firmware README button driver-ready rule", firmwareReadme, "short-press start requires the MCF8316D driver");
assertContains("firmware README button latched-fault publish rule", firmwareReadme, "short-press start ignored because a fault is already latched publishes the unchanged BLE mode/fault");
assertContains("firmware README triple press temporary advertising", firmwareReadme, "does not change the saved boot-advertising setting");
assertContains("firmware README long press settings namespace", firmwareReadme, "clears the `cpap` persisted settings namespace");
assertContains("firmware README long press not calibration reset", firmwareReadme, "does not clear retained session/fault logs, motor calibration profiles");
assertContains("release checklist long press reset scope", releaseChecklistDoc, "Physical long-press reset scope verified");
assertContains("release checklist short press driver rejection", releaseChecklistDoc, "short-press start rejected into `FAULT_IO` when the MCF8316D driver is not ready");
assertContains("release checklist long press preserves calibration evidence", releaseChecklistDoc, "motor calibration profile, MCF8316D configuration, and pressure-sensor trim data");
assertContains("release checklist exact export filename evidence", releaseChecklistDoc, "Mobile CSV/JSON export messages verified to show the exact timestamped filename");
assertContains("release checklist fault CSV exact mode evidence", releaseChecklistDoc, "exact `sys_mode=4`");
assertContains("release checklist fault CSV nonzero fault evidence", releaseChecklistDoc, "nonzero fault code");
assertContains("release checklist fault latch preservation", releaseChecklistDoc, "secondary sensor-health or overpressure checks do not overwrite the active fault code");
assertContains("release checklist incomplete pressure ambient gate", releaseChecklistDoc, "do not seed or update the ambient estimate");
assertContains("release checklist incomplete pressure overpressure gate", releaseChecklistDoc, "cannot produce a finite mask-gauge overpressure decision until both pressure inputs are finite again");
assertContains("release checklist fault CSV uppercase NAN evidence", releaseChecklistDoc, "uppercase `NAN` for unknown analog fields");
assertContains("release checklist fault CSV binary motor evidence", releaseChecklistDoc, "binary `motorFault`/`motorI2c` evidence");
assertContains("release checklist fault CSV tach evidence", releaseChecklistDoc, "finite or uppercase `NAN` `motorFgHz` tach evidence");
assertContains("firmware README fault hardware-disable invariant", firmwareReadme, "asserts the dedicated motor hardware-disable path before any pressure, I2C, BLE, logging, or UI work");
assertContains("firmware README motor stop DRVOFF ordering", firmwareReadme, "`stopMotor()` likewise asserts `DRVOFF` before attempting the zero-speed I2C write");
assertContains("firmware calibration BLE command", firmwareBle, "CalibrationCommandCallback");
assertContains("firmware calibration start fault-code guard", firmwareBle, "currentMode != MODE_IDLE || currentFault != FAULT_NONE || motorCalIsActive()");
assertContains("firmware calibration start driver-ready guard", firmwareBle, "BLE calibration: start rejected, motor driver not ready");
assertContains("firmware calibration malformed JSON diagnostic", firmwareBle, "BLE calibration JSON parse error");
assertContains("firmware calibration malformed JSON returns without notify", firmwareBle, "BLE_LOG(\"BLE calibration JSON parse error\");\n      return;");
assertContains("firmware calibration missing command diagnostic", firmwareBle, "BLE calibration missing command");
assertContains("firmware calibration missing command returns without notify", firmwareBle, "BLE_LOG(\"BLE calibration missing command\");\n      return;");
assertContains("firmware calibration unknown command diagnostic", firmwareBle, "BLE calibration: unknown command");
assertContains("firmware water calibration BLE start", firmwareBle, "\"waterStart\"");
assertContains("firmware water calibration BLE capture", firmwareBle, "\"capture\"");
assertContains("firmware calibration abort command branch", firmwareBle, "if (strcmp(command, \"abort\") == 0)");
assertContains("firmware calibration immediate status publisher", firmwareBle, "static void publishCalibrationStatus(bool notify = false)");
assertContains("firmware calibration abort active guard", firmwareBle, "if (!motorCalIsActive()) {\n        BLE_LOG(\"BLE calibration: abort ignored while inactive\");");
assertContains("firmware calibration inactive abort notifies status", firmwareBle, "BLE calibration: abort ignored while inactive\");\n        publishCalibrationStatus(true);");
assertContains("firmware calibration abort notifies status", firmwareBle, "motorCalAbort();\n      publishCalibrationStatus(true);");
assertContains("firmware calibration capture notifies status", firmwareBle, "motorCalCapturePoint()) BLE_LOG(\"BLE calibration: capture ignored\");\n      publishCalibrationStatus(true);");
assertContains("firmware calibration unavailable start notifies status", firmwareBle, "BLE calibration: start ignored while unavailable\");\n        publishCalibrationStatus(true);");
assertContains("firmware calibration start checks module return", firmwareBle, "const bool accepted = strcmp(command, \"waterStart\") == 0 ? motorCalWaterStart(plan) : motorCalStart(plan);");
assertContains("firmware calibration module rejection diagnostic", firmwareBle, "BLE calibration: start rejected by calibration module");
assertContains("firmware calibration start notifies status", firmwareBle, "if (!accepted) BLE_LOG(\"BLE calibration: start rejected by calibration module\");\n      publishCalibrationStatus(true);");
assertContains("firmware calibration capture command branch", firmwareBle, "if (strcmp(command, \"capture\") == 0)");
assertContains("firmware calibration active driver-ready guard", firmwareLogic, "Motor calibration driver fault detected");
assertContains("firmware calibration module active driver-ready guard", firmwareMotorCal, "if (!motorDriverReady()) {\n    stopMotor();\n    setState(CAL_ERROR, \"driver-not-ready\");\n    return;\n  }");
assertContains("firmware calibration module auto active guard", firmwareMotorCal, "bool motorCalStart(const MotorCalibrationPlan& requestedPlan) {\n  if (motorCalIsActive() || otaSecure_inProgress()) return false;");
assertContains("firmware calibration module auto driver-ready guard", firmwareMotorCal, "if (!motorDriverReady()) {\n    setState(CAL_ERROR, \"driver-not-ready\");");
assertContains("firmware calibration module water driver-ready guard", firmwareMotorCal, "bool motorCalWaterStart(const MotorCalibrationPlan& requestedPlan) {\n  if (motorCalIsActive() || otaSecure_inProgress()) return false;\n  calibrationMode = CAL_MODE_WATER;\n  if (!motorDriverReady())");
assertContains("firmware MCF params UUID", firmwareHeader, "UUID_CHAR_MCF_PARAMS");
assertContains("firmware MCF params read callback", firmwareBle, "McfParamsReadCallback");
assertContains("firmware MCF params read-only characteristic", firmwareBle, "UUID_CHAR_MCF_PARAMS, BLECharacteristic::PROPERTY_READ");
assertContains("firmware MCF params motor API", firmwareMotorHeader, "String motorMcfParamsJson();");
assertContains("firmware MCF params owned by motor module", firmwareMotor, "String motorMcfParamsJson()");
assertContains("firmware MCF params BLE transport delegates", firmwareBle, "motorMcfParamsJson().c_str()");
assertContains("firmware MCF params pending state", firmwareMotor, "register_layer_pending");
assertContains("firmware MCF params fixed buffer", firmwareMotor, "char out[448];");
assertContains("firmware MCF params I2C address key", firmwareMotor, "\\\"i2cAddr\\\":\\\"0x%02x");
assertContains("firmware MCF params I2C address source", firmwareMotor, "MCF_I2C_ADDR");
assertContains("firmware MCF params default speed disabled", firmwareMotor, "disabled_until_i2c_speed");
assertContains("firmware MCF I2C speed flag", firmwareMotorHeader, "OZEALIS_MCF8316D_I2C_SPEED");
assertContains("firmware MCF I2C transaction clock", firmwareMotorHeader, "MCF_I2C_TRANSACTION_HZ");
assertContains("firmware MCF ALGO_DEBUG1 register", firmwareMotor, "static constexpr uint16_t MCF_REG_ALGO_DEBUG1 = 0x00EC;");
assertContains("firmware MCF ALGO_CTRL1 register", firmwareMotor, "static constexpr uint16_t MCF_REG_ALGO_CTRL1 = 0x00EA;");
assertContains("firmware MCF speed override bit", firmwareMotor, "static constexpr uint32_t MCF_ALGO_DEBUG1_OVERRIDE = 0x80000000UL;");
assertContains("firmware MCF clear fault bit", firmwareMotor, "static constexpr uint32_t MCF_ALGO_CTRL1_CLR_FLT = 0x20000000UL;");
assertContains("firmware MCF write32 helper", firmwareMotor, "static bool mcfWrite32(uint16_t reg, uint32_t value)");
assertContains("firmware MCF read32 helper", firmwareMotor, "static bool mcfRead32(uint16_t reg, uint32_t& value)");
assertContains("firmware MCF 100us transaction spacing", firmwareMotor, "delayMicroseconds(100);");
assertContains("firmware MCF I2C speed word", firmwareMotor, "return MCF_ALGO_DEBUG1_OVERRIDE | ((speed & 0x7fffUL) << 16);");
assertContains("firmware MCF I2C speed readback", firmwareMotor, "return (readback & 0xffff0000UL) == command;");
assertContains("firmware MCF clear fault helper", firmwareMotor, "static bool clearMcfLatchedFaults()");
assertContains("firmware MCF clear fault writes CLR_FLT", firmwareMotor, "mcfWrite32(MCF_REG_ALGO_CTRL1, MCF_ALGO_CTRL1_CLR_FLT)");
assertContains("firmware motor clear-fault sends chip clear", firmwareMotor, "if (!clearMcfLatchedFaults()) return false;");
assertContains("firmware MCF idle readiness retry helper", firmwareMotor, "static bool verifyI2cSpeedReadyIfIdle()");
assertContains("firmware MCF idle readiness only zero command", firmwareMotor, "if (g_running || g_amplitude != 0 || g_faultLatched) return g_i2cSpeedReadbackValid;");
assertContains("firmware MCF idle readiness retry writes zero", firmwareMotor, "g_i2cSpeedReadbackValid = writeI2cSpeedCommand(0);");
assertContains("firmware MCF setup verifies zero speed", firmwareMotor, "verifyI2cSpeedReadyIfIdle();\n  if (g_i2cSpeedReadbackValid)");
assertContains("firmware MCF params commandReady key", firmwareMotor, "\\\"commandReady\\\":%s");
assertContains("firmware MCF params commandReady derives transport and readiness", firmwareMotor, "const bool ready = commandTransportReady() && i2cPresent && !faultActive;");
assertContains("firmware MCF params I2C speed variable", firmwareMotor, "const bool i2cSpeed = OZEALIS_MCF8316D_I2C_SPEED != 0 && g_i2cSpeedReadbackValid;");
assertContains("firmware MCF params bench fallback variable", firmwareMotor, "const bool benchFallback = OZEALIS_MCF8316D_I2C_SPEED == 0 && commandTransportReady();");
assertContains("firmware MCF params read retries idle zero-speed verification", firmwareMotor, "if (i2cPresent && !faultActive) verifyI2cSpeedReadyIfIdle();");
assertContains("firmware MCF params benchOnly derives fallback", firmwareMotor, "benchFallback ? \"true\" : \"false\"");
assertAbsent("firmware MCF params avoids String hex allocation", firmwareMotor, "String(MCF_I2C_ADDR, HEX)");
assertContains("firmware bench PWM fallback flag", firmwareMotorHeader, "OZEALIS_BENCH_PWM_SPEED_FALLBACK");
assertContains("firmware bench PWM env disables I2C speed", firmwarePlatformio, "OZEALIS_MCF8316D_I2C_SPEED=0");
assertContains("firmware command transport gate", firmwareMotor, "commandTransportReady()");
assertContains("firmware default command transport blocks unverified readback", firmwareMotor, "I2C speed command readback not verified, start ignored");
assertContains("firmware MCF params writes disabled key", firmwareMotor, "writesAllowed");
assertContains("firmware MCF params bench-only key", firmwareMotor, "benchOnly");
assertContains("firmware MCF params command amp key", firmwareMotor, "\\\"commandAmp\\\":%u");
assertContains("firmware MCF params command pwm key", firmwareMotor, "\\\"commandPwm\\\":%u");
assertContains("firmware MCF params pin map key", firmwareMotor, "\\\"pins\\\":{\\\"speedPwm\\\":%d,\\\"drvOff\\\":%d,\\\"nFault\\\":%d,\\\"fg\\\":%d}");
assertAbsent("firmware no dormant motor force-step surface", firmwareMotor + firmwareMotorHeader, "motorForceStep");
assertAbsent("firmware no dormant motor debug service hook", firmwareMotor + firmwareMotorHeader + firmwareMain, "motorDebugService");
assertAbsent("firmware no stale elecAngle debug proxy", firmwareMotor + firmwareMotorHeader, "elecAngle");
assertAbsent("firmware MCF params not assembled in BLE", firmwareBle, "jd[\"writesAllowed\"] = false;");
assertContains("mobile MCF params characteristic", appProtocol, "mcfParams: uuid16(\"0032\")");
assertContains("mobile MCF params parser re-export", appProtocol, "parseMcfParamsSnapshot");
assertContains("mobile CSV row-count helper re-export", appProtocol, "csvDataRowCount");
assertContains("mobile CSV preview helper re-export", appProtocol, "csvPreview");
assertContains("mobile session graph parser re-export", appProtocol, "parseSessionGraphData");
assertContains("mobile session observation parser re-export", appProtocol, "flagSessionObservations");
assertContains("mobile session summary re-export", appProtocol, "summarizeSessionCsv");
assertContains("mobile MCF params parser helper", appValidation, "parseMcfParamsSnapshot(raw: string)");
assertContains("mobile MCF params parse rejects non-objects", appValidation, "if (!isJsonObject(parsed)) return defaultMcfParamsSnapshot();");
assertContains("mobile MCF params default helper", appValidation, "function defaultMcfParamsSnapshot(): McfParamsSnapshot");
assertContains("mobile MCF params strict driver parser", appValidation, "const driver = parsed.driver === \"MCF8316D\" ? parsed.driver : \"unknown\"");
assertContains("mobile MCF params I2C address parser", appValidation, "i2cAddr: knownMcfI2cAddress(parsed.i2cAddr)");
assertContains("mobile MCF params runtime speed parser", appValidation, "const runtimeSpeed = knownMcfRuntimeSpeed(parsed.runtimeSpeed)");
assertContains("mobile MCF params driver parser", appValidation, "driver,");
assertContains("mobile MCF params target speed parser", appValidation, "const targetSpeed = knownMcfTargetSpeed(parsed.targetSpeed)");
assertContains("mobile MCF params commandReady explicit parser", appValidation, "const explicitCommandReady = parsed.commandReady === true;");
assertContains("mobile MCF params commandReady parser", appValidation, "commandReady: explicitCommandReady && derivedCommandReady");
assertContains("mobile MCF params commandReady derived guard", appValidation, "driver === \"MCF8316D\" &&");
assertContains("mobile MCF params I2C readiness requires readback", appValidation, "runtimeSpeed === \"i2c\" && state === \"readback_valid\"");
assertContains("mobile MCF params writes conservative parser", appValidation, "writesAllowed: derivedWritesAllowed");
assertContains("mobile MCF params writes require verified readback", appValidation, "state === \"readback_valid\"");
assertContains("mobile MCF params benchOnly runtime parser", appValidation, "benchOnly: runtimeSpeed === \"bench_pwm_fallback\"");
assertContains("mobile MCF params invalid snapshot not bench fallback", appValidation, "benchOnly: false");
assertContains("mobile MCF command path verified label", mobileApp, "I2C speed verified");
assertContains("mobile MCF command path pending label", mobileApp, "I2C speed pending readback");
assertContains("mobile MCF params command amp strict parser", appValidation, "const commandAmp = boundedJsonInteger(parsed.commandAmp, 0, 255, 0);");
assertContains("mobile MCF params command pwm strict parser", appValidation, "const commandPwm = boundedJsonInteger(parsed.commandPwm, 0, 65535, 0);");
assertContains("mobile MCF params pin parser", appValidation, "function parseMcfPins(value: unknown): McfParamsSnapshot[\"pins\"]");
assertContains("mobile MCF params pin disabled sentinel", appValidation, "if (value === -1) return -1;");
assertContains("mobile MCF params command display", mobileApp, "Snapshot command");
assertContains("mobile MCF params pins display", mobileApp, "Snapshot pins");
assertContains("mobile docs MCF benchOnly runtime-derived", mobileDoc, "The app derives `benchOnly` only from `runtimeSpeed=bench_pwm_fallback`");
assertContains("mobile docs MCF benchOnly ignores contradictory fields", mobileDoc, "contradictory or foreign `benchOnly` fields are ignored");
assertContains("mobile docs MCF commandReady explicit boolean", mobileDoc, "explicit boolean `commandReady=true`");
assertContains("mobile docs MCF I2C readiness readback-valid", mobileDoc, "A true I2C speed-command path must come from `state=readback_valid`");
assertContains("mobile docs MCF command path pending display", mobileDoc, "pending I2C snapshots display as `I2C speed pending readback`");
assertContains("protocol docs MCF I2C readiness readback-valid", protocolDoc, "A true I2C speed-command path must come from `state=readback_valid`");
assertContains("protocol docs MCF idle readiness recovery", protocolDoc, "start/calibration readiness checks and MCF snapshot reads retry a zero-speed command/readback");
assertContains("mobile docs MCF commandReady missing string blocked", mobileDoc, "Missing, string, contradictory, or foreign `commandReady` fields must not unlock motor actions");
assertContains("protocol docs MCF passive command fields", protocolDoc, "`commandAmp` (`0..255`), `commandPwm` (`0..65535`)");
assertContains("protocol docs MCF passive pin fields", protocolDoc, "`pins` object with `speedPwm`, `drvOff`, `nFault`, and `fg`");
assertContains("mobile docs MCF passive diagnostics", mobileDoc, "passive command readback, and ESP32 pin map");
assertContains("mobile docs MCF failed reads clear stale evidence", mobileDoc, "Failed snapshot reads clear the displayed/exportable raw snapshot");
assertContains("commissioning docs MCF command fields", mcfCommissioningDoc, "\"commandAmp\": 0");
assertContains("commissioning docs MCF pin fields", mcfCommissioningDoc, "\"speedPwm\": 19");
assertContains("mobile validation tests default snapshot helper", mobileValidationTests, "const expectedDefaultMcfParams = {");
assertContains("mobile validation tests command fields accepted", mobileValidationTests, "commandAmp: 42");
assertContains("mobile validation tests pin fields accepted", mobileValidationTests, "pins: { speedPwm: 19, drvOff: 17, nFault: 26, fg: 33 }");
assertContains("mobile validation tests invalid command fields default", mobileValidationTests, "commandAmp: 256");
assertContains("mobile validation tests bench fallback derives benchOnly", mobileValidationTests, "runtimeSpeed: \"bench_pwm_fallback\"");
assertContains("mobile validation tests MCF FG accepts finite", mobileValidationTests, "fgHz: 321.5");
assertContains("firmware MCF snapshot finite helper", firmwareMotor, "static float finiteMcfSnapshotNumber(float value, float fallback, float minValue, float maxValue)");
assertContains("firmware MCF snapshot bounded FG source", firmwareMotor, "const float statusFgHz = finiteMcfSnapshotNumber(motorGetFgHz(), 0.0f, 0.0f, 100000.0f);");
assertContains("firmware MCF snapshot uses finite FG", firmwareMotor, "MCF_I2C_ADDR,\n           statusFgHz,");
assertContains("mobile validation tests contradictory i2c benchOnly normalized false", mobileValidationTests, "runtimeSpeed: \"i2c\",\n        targetSpeed: \"i2c\",\n        commandReady: true,\n        writesAllowed: false,\n        benchOnly: true");
assertContains("mobile validation tests MCF FG rejects overrange", mobileValidationTests, "fgHz: 100000.1");
assertContains("mobile validation tests MCF FG rejects string", mobileValidationTests, "fgHz: \"321.5\"");
assertContains("mobile validation tests missing commandReady input omits commandReady", mobileValidationTests, "writesAllowed: true,\n        benchOnly: false");
assertContains("mobile validation tests missing commandReady blocks readiness", mobileValidationTests, "commandReady: false,\n      writesAllowed: true,\n      benchOnly: false,\n      fgHz: null");
assertContains("mobile validation tests pending I2C snapshot blocks readiness", mobileValidationTests, "state: \"register_layer_pending\",\n      i2c: true,\n      fault: false,\n      i2cAddr: \"0x01\",\n      runtimeSpeed: \"i2c\",\n      targetSpeed: \"i2c\",\n      commandReady: false");
assertContains("mobile validation tests string commandReady blocks readiness", mobileValidationTests, "commandReady: \"true\"");
assertContains("mobile CSV row-count helper", appValidation, "csvDataRowCount(raw: string)");
assertContains("mobile CSV row-count requires known format", appValidation, "const format = csvFormat(raw);");
assertContains("mobile CSV row-count rejects unknown format", appValidation, "if (format === \"live\" || format === \"retained\") return parseSessionSamples(raw).length;");
assertContains("mobile CSV fault header", appValidation, "ts_ms,sys_mode,fault,vin_V,pMask_hPa");
assertContains("mobile fault CSV row helper", appValidation, "function isValidFaultCsvRow(row: string)");
assertContains("mobile fault CSV rejects padded rows", appValidation, "function isValidFaultCsvRow(row: string)");
assertContains("mobile fault CSV allows exact NAN analog diagnostics", appValidation, "index >= 3 && index <= 9 && part === \"NAN\"");
assertContains("mobile fault CSV typed integer helper", appValidation, "function boundedCsvInteger(value: string | undefined, min: number, max: number): boolean");
assertContains("mobile CSV integer parser rejects negative zero", appValidation, "if (text === \"-0\") return null;");
assertContains("mobile CSV integer text rejects decimal, exponent, and padded integers", appValidation, "if (!/^-?(?:0|[1-9]\\d*)$/.test(text)) return null;");
assertContains("mobile CSV unsigned integer text rejects negative sign", appValidation, "if (min >= 0 && text.startsWith(\"-\")) return false;");
assertContains("mobile fault CSV requires fault system mode", appValidation, "if (index === 1) return part === \"4\";");
assertContains("mobile fault CSV bounds fault enum", appValidation, "if (index === 2) return boundedCsvInteger(part, 1, 4);");
assertContains("mobile fault CSV bounds motor status flags", appValidation, "if (index === 12 || index === 13) return boundedCsvInteger(part, 0, 1);");
assertContains("mobile fault CSV parser tracks timestamp order", appValidation, "let lastMs = -Infinity");
assertContains("mobile fault CSV parser rejects non-increasing timestamps", appValidation, "ms === null || ms <= lastMs");
assertContains("mobile validation tests reject non-fault-mode fault CSV", mobileValidationTests, "const faultNonFaultModeCsv = [");
assertContains("mobile validation tests reject lowercase fault NAN", mobileValidationTests, "const faultLowercaseNanAnalogCsv = [");
assertContains("mobile CSV preview known-format helper", appValidation, "knownCsvLines(raw)");
assertContains("mobile CSV evidence physical-line helper", appValidation, "function csvEvidenceLines(raw: string): string[] | null");
assertContains("mobile CSV evidence rejects blank or padded lines", appValidation, "if (lines.some((line) => line.length === 0 || line !== line.trim())) return null;");
assertContains("mobile CSV header uses first line only", appValidation, "const header = raw.split(/\\r?\\n/)[0];");
assertContains("mobile CSV header rejects padded headers", appValidation, "if (!header || header !== header.trim()) return \"\";");
assertContains("mobile docs CSV counts use committed source-matched pair", mobileDoc, "Row counts and previews are shown only for the committed, source-matched pair");
assertContains("mobile docs CSV headers first line only", mobileDoc, "CSV headers must be the exact recognized first line");
assertContains("mobile docs CSV previews use validated source-matched pair", mobileDoc, "Row counts and previews are shown only for the committed, source-matched pair");
assertContains("mobile docs CSV rejects leading blank", mobileDoc, "leading-blank");
assertContains("mobile docs CSV rejects blank body lines", mobileDoc, "blank-body-line");
assertContains("mobile docs CSV rejects extra trailing blank lines", mobileDoc, "extra-trailing-blank");
assertContains("mobile docs CSV rejects negative-signed unsigned fields", mobileDoc, "negative-signed unsigned counters or flags");
assertContains("mobile docs fault CSV timestamp order", mobileDoc, "strictly increasing fault timestamps");
assertContains("protocol docs fault CSV NAN analog boundary", protocolDoc, "analog diagnostic fields from `vin_V` through `flowProxy_hPa` and `motorFgHz` are emitted as finite decimal numbers or uppercase `NAN`");
assertContains("protocol docs fault CSV exact fault mode", protocolDoc, "`sys_mode` must be exact fault mode `4`");
assertContains("protocol docs fault CSV typed fault field", protocolDoc, "`fault` must be a nonzero enum integer from `1` through `4`");
assertContains("protocol docs fault CSV typed binary fields", protocolDoc, "`motorFault` and `motorI2c` must be binary `0`/`1` flags");
assertContains("protocol docs fault CSV rejects negative zero", protocolDoc, "`-0` is not accepted as a canonical integer token");
assertContains("protocol docs fault CSV uppercase NAN normalization", protocolDoc, "normalizes formatter-produced lowercase `nan` tokens to uppercase before export");
assertContains("protocol docs fault CSV rejects exponent fields", protocolDoc, "Exponent-form numeric fields are rejected for fault analog fields");
assertContains("firmware fault CSV uppercase NAN helper", firmwareDiag, "static void normalizeNanTokens(char* line)");
assertContains("firmware fault CSV uppercase NAN replacement", firmwareDiag, "p[0] = 'N';\n      p[1] = 'A';\n      p[2] = 'N';");
assertContains("firmware fault CSV normalizes formatted rows", firmwareDiag, "normalizeNanTokens(line);\n  return (size_t)written;");
assertContains("protocol docs fault CSV timestamp order", protocolDoc, "`ts_ms` must be strictly increasing");
assertContains("protocol docs CSV leading zero boundary", protocolDoc, "Plain-decimal numeric fields with leading zeroes");
assertContains("protocol docs CSV exponent boundary", protocolDoc, "Exponent-form numeric fields are also not canonical evidence tokens.");
assertContains("protocol docs CSV first-line header boundary", protocolDoc, "exact recognized first-line headers");
assertContains("protocol docs CSV blank line rejection", protocolDoc, "Leading blank lines before the CSV header, blank body lines, whitespace-only lines, and extra trailing blank lines are rejected rather than skipped.");
assertContains("mobile validation tests live row-count fixture", mobileValidationTests, "const liveCountCsv = [");
assertContains("mobile validation tests fault NAN analog row", mobileValidationTests, "faultNanAnalogCsv");
assertContains("mobile validation tests padded retained CSV rejection", mobileValidationTests, "retainedPaddedFieldCsv");
assertContains("mobile validation tests retained leading blank header rejection", mobileValidationTests, "retainedLeadingBlankHeaderCsv");
assertContains("mobile validation tests retained blank body rejection", mobileValidationTests, "retainedBlankBodyCsv");
assertContains("mobile validation tests retained extra trailing blank rejection", mobileValidationTests, "retainedExtraTrailingBlankCsv");
assertContains("mobile validation tests padded retained row rejection", mobileValidationTests, "retainedPaddedRowCsv");
assertContains("mobile validation tests padded retained header rejection", mobileValidationTests, "retainedPaddedHeaderCsv");
assertContains("mobile validation tests padded retained integer rejection", mobileValidationTests, "retainedPaddedIntegerCsv");
assertContains("mobile validation tests negative zero retained integer rejection", mobileValidationTests, "retainedNegativeZeroIntegerCsv");
assertContains("mobile validation tests padded fault NAN rejection", mobileValidationTests, "faultPaddedNanAnalogCsv");
assertContains("mobile validation tests fault leading blank header rejection", mobileValidationTests, "faultLeadingBlankHeaderCsv");
assertContains("mobile validation tests fault blank body rejection", mobileValidationTests, "faultBlankBodyCsv");
assertContains("mobile validation tests fault extra trailing blank rejection", mobileValidationTests, "faultExtraTrailingBlankCsv");
assertContains("mobile validation tests padded fault integer rejection", mobileValidationTests, "faultPaddedIntegerCsv");
assertContains("mobile validation tests negative zero fault integer rejection", mobileValidationTests, "faultNegativeZeroUnsignedCsv");
assertContains("mobile validation tests signed negative zero fault CSV", mobileValidationTests, "const faultNegativeZeroSignedCsv");
assertContains("mobile validation tests padded fault row rejection", mobileValidationTests, "faultPaddedRowCsv");
assertContains("mobile validation tests duplicate fault timestamp rejection", mobileValidationTests, "faultDuplicateTimestampCsv");
assertContains("mobile validation tests backward fault timestamp rejection", mobileValidationTests, "faultBackwardTimestampCsv");
assertContains("mobile validation tests padded live flag rejection", mobileValidationTests, "livePaddedStatusCsv");
assertContains("mobile validation tests fault NAN status rejection", mobileValidationTests, "faultNanStatusCsv");
assertContains("mobile validation tests fault impossible enum rejection", mobileValidationTests, "faultImpossibleEnumCsv");
assertContains("mobile validation tests fault impossible flag rejection", mobileValidationTests, "faultImpossibleFlagCsv");
assertContains("mobile validation tests fault fractional counter rejection", mobileValidationTests, "faultFractionalCounterCsv");
assertContains("mobile validation tests fault exponent counter rejection", mobileValidationTests, "faultExponentCounterCsv");
assertContains("mobile validation tests live impossible mode rejection", mobileValidationTests, "liveImpossibleModeCsv");
assertContains("mobile validation tests live impossible status rejection", mobileValidationTests, "liveImpossibleStatusCsv");
assertContains("mobile validation tests retained impossible status rejection", mobileValidationTests, "retainedImpossibleStatusCsv");
assertContains("mobile validation tests retained fractional command rejection", mobileValidationTests, "retainedFractionalCommandCsv");
assertContains("mobile validation tests retained exponent flag rejection", mobileValidationTests, "retainedExponentFlagCsv");
assertContains("mobile validation tests live row-count drops duplicates", mobileValidationTests, "assert.equal(csvDataRowCount(liveCountCsv), 2);");
assertContains("mobile validation tests retained row-count drops timestamp gaps", mobileValidationTests, "const retainedGapCsv = [");
assertContains("mobile validation tests live row-count drops timestamp gaps", mobileValidationTests, "const liveGapCsv = [");
assertContains("mobile CSV bounded preview helper", appValidation, "more valid preview lines; export CSV for the complete log");
assertContains("mobile CSV preview clamps line limit", appValidation, "const lineLimit = Number.isFinite(maxLines)");
assertContains("mobile session graph parser helper", appValidation, "parseSessionGraphData(raw: string");
assertContains("mobile session graph downsample preserves tail", appValidation, "points.length - 1");
assertContains("mobile session graph downsample clamps point limit", appValidation, "const pointLimit = Number.isFinite(maxPoints) ? Math.max(0, Math.floor(maxPoints)) : 120;");
assertContains("mobile validation tests graph parser NaN point fallback", mobileValidationTests, "Number.NaN,\n    ).map(({ ms }) => ms),");
assertContains("mobile session graph one-point limit returns latest point", appValidation, "if (pointLimit === 1) return points.length > 0 ? [points[points.length - 1]] : []");
assertContains("mobile session graph downsample spans full source range", appValidation, "pointLimit - 1");
assertContains("mobile graph source preserves 10 Hz hour", mobileApp, "const maxGraphSourcePoints = 36000;");
assertContains("mobile graph scale type", mobileApp, "type GraphScale = \"all\" | \"10m\" | \"1m\" | \"30s\";");
assertContains("mobile graph scale windows", mobileApp, "const graphScaleWindowsMs: Record<GraphScale, number | null>");
assertContains("mobile graph source parses before windowing", mobileApp, "parseSessionGraphData(visibleAnalysisCsv, maxGraphSourcePoints)");
assertContains("mobile graph window helper", mobileApp, "function windowGraphPoints(points: SessionGraphPoint[], scale: GraphScale, maxPoints: number)");
assertContains("mobile graph downsamples after windowing", mobileApp, "return downsampleGraphPoints(windowed.length > 0 ? windowed : points.slice(-1), maxPoints);");
assertContains("mobile graph breath window", mobileApp, "\"30s\": 30 * 1000");
assertContains("mobile graph advanced scale labels", mobileApp, "{ key: \"10m\", label: \"10 min\" }");
assertContains("mobile graph simple scale labels", mobileApp, "{ key: \"30s\", label: \"Breath\" }");
assertContains("mobile session parser requires exact retained Ozealis header", appValidation, "header === RETAINED_SESSION_HEADER");
assertContains("mobile session parser rejects unknown header", appValidation, "if (format === \"unknown\") return []");
assertContains("mobile retained session parser exact field count", appValidation, "parts.length !== 18");
assertContains("mobile CSV parser rejects exponent-form and leading-zero numbers", appValidation, "!/^-?(?:0|[1-9]\\d*)(?:\\.\\d+)?$/.test(text)");
assertContains("mobile session parser tracks timestamp order", appValidation, "let lastMs = -Infinity");
assertContains("mobile session parser drops duplicate timestamps", appValidation, "if (sample.ms === lastMs) return");
assertContains("mobile session parser live max sample gap", appValidation, "const LIVE_MAX_SAMPLE_GAP_MS = 1000");
assertContains("mobile session parser retained max sample gap", appValidation, "const RETAINED_MAX_SAMPLE_GAP_MS = 2500");
assertContains("mobile session parser restarts latest segment on gaps", appValidation, "samples = []");
assertContains("mobile CSV preview restarts latest segment on gaps", appValidation, "rows = []");
assertContains("mobile simple day row helper uses session cadence gap", appValidation, "const maxGapMs = sessionMaxSampleGapMs(format);");
assertContains("mobile simple day rows restart on timestamp gaps", appValidation, "rows = []");
assertContains("mobile validation tests retained latest gap segment", mobileValidationTests, "[9000, 10000]");
assertContains("mobile validation tests live latest gap segment", mobileValidationTests, "[3100, 3200]");
assertContains("mobile validation tests retained gap normalizer latest segment", mobileValidationTests, "normalizeRetainedSessionCsv(retainedGapCsv)");
assertContains("mobile validation tests retained gap preview latest segment", mobileValidationTests, "csvPreview(retainedGapCsv)");
assertContains("mobile docs retained backstep rejects pair", mobileDoc, "Retained imports reject the whole session/fault pair on duplicate or backwards session timestamps");
assertContains("mobile docs retained forward gap latest segment", mobileDoc, "an over-cadence forward gap is allowed between legitimate therapy segments");
assertContains("protocol docs exact CSV evidence tokens", protocolDoc, "exact recognized first-line headers, exact unpadded rows and field tokens");
assertContains("protocol docs CSV timestamps increase", protocolDoc, "and strictly increasing timestamps");
assertContains("protocol docs retained backstep rejects pair", protocolDoc, "A retained snapshot with a duplicate or backwards timestamp is rejected atomically");
assertContains("protocol docs retained forward gap latest segment", protocolDoc, "A retained over-cadence forward gap is allowed between legitimate therapy sessions");
assertContains("release checklist retained backstep rejects pair", releaseChecklistDoc, "duplicate or backwards timestamps reject the whole pair");
assertContains("release checklist retained forward gap latest segment", releaseChecklistDoc, "an over-cadence forward gap may separate legitimate therapy sessions");
assertContains("release checklist live latest segment", releaseChecklistDoc, "starts a fresh latest segment after large backward timestamp jumps or over-cadence forward gaps instead of keeping the older prefix");
assertContains("mobile session summary helper", appValidation, "summarizeSessionCsv(raw: string)");
assertContains("mobile session observation parser helper", appValidation, "flagSessionObservations(raw: string)");
assertContains("mobile session observation obstructive heuristic", appValidation, "possible obstructive low-flow pattern");
assertContains("mobile session observation central heuristic", appValidation, "possible central-like low-flow pattern");
assertContains("mobile session observation hypopnea heuristic", appValidation, "possible hypopnea-like low-flow pattern");
assertContains("mobile MCF params reader", mobileApp, "readDriverParams");
assertContains("mobile auto-loads MCF params on connect", mobileApp, "await loadDriverParams(discovered, sessionId)");
assertContains("mobile docs MCF params fresh-read feature", mobileDoc, "Start-like writes reread mode, fault, calibration status, and the encrypted MCF8316D snapshot");
assertContains("mobile driver command readiness gate", mobileApp, "const driverCommandReady = driverSnapshotMatches && driverParams.commandReady");
assertContains("mobile driver command path label", mobileApp, "Driver command path");
assertContains("mobile driver command ready display", mobileApp, "Command ready");
assertContains("mobile disabled I2C speed command label", mobileApp, "Disabled until I2C speed");
assertContains("mobile start blocked command path reason", mobileApp, "Motor command path is blocked until I2C speed command readback is verified");
assertAbsent("mobile simple start blocker helper removed", mobileApp, "const simpleStartBlockReason");
assertAbsent("mobile simple start blocker pre-alert removed", mobileApp, "Review the alert before starting airflow.");
assertContains("mobile simple start disabled helper", mobileApp, "const simpleStartDisabled");
assertContains("mobile simple start neutral title", mobileApp, "advancedMode ? \"Start unavailable\" : \"Use standby\"");
assertContains("mobile simple start standby copy", mobileApp, "Use standby to start airflow.");
assertContains("mobile simple start action standby copy", mobileApp, "Use standby to start airflow.");
assertContains("mobile simple start readback accepted copy", mobileApp, "Airflow is starting.");
assertContains("mobile simple start readback requires startup or running", mobileApp, "if (mode === \"1\" || mode === \"2\") return \"Airflow is starting.\";");
assertContains("mobile simple start readback rejected copy", mobileApp, "Airflow did not start.");
assertContains("mobile simple stop readback accepted copy", mobileApp, "Airflow is stopping.");
assertContains("mobile simple stop readback requires idle or shutdown", mobileApp, "if (mode === \"0\" || mode === \"3\") return \"Airflow is stopping.\";");
assertContains("mobile simple stop readback rejected copy", mobileApp, "Airflow did not stop.");
assertContains("mobile simple command result alert requires exact fault enum", mobileApp, "if (hasSystemFault) return \"Review the alert before starting again.\";");
assertContains("mobile simple setup stopping copy", mobileApp, "Setup is stopping.");
assertAbsent("mobile simple start sent watch copy removed", mobileApp, "Start sent. Watch the device state.");
assertAbsent("mobile simple stop sent watch copy removed", mobileApp, "Stop sent. Watch the device state.");
assertAbsent("mobile simple setup sent watch copy removed", mobileApp, "Stop sent. Watch the setup state.");
assertAbsent("mobile simple start preemptive advanced failure copy removed", mobileApp, "The device is not ready to start airflow yet. Open Advanced for details.");
assertContains("mobile simple pairing hides BLE UUID", mobileApp, "Hold the device pairing button until it is ready to pair, then scan for your Ozealis device.");
assertContains("mobile advanced pairing shows BLE UUID", mobileApp, "BLE service: ${OZEALIS_SERVICE_UUID}");
assertContains("mobile simple pairing title", mobileApp, "advancedMode ? \"Nearby Devices\" : \"Pair device\"");
assertContains("mobile simple pairing hides device id", mobileApp, "{advancedMode && <Text style={styles.mutedText}>{device.id}</Text>}");
assertContains("mobile calibration blocker reason", mobileApp, "const calibrationBlockReason");
assertAbsent("mobile simple calibration blocker helper removed", mobileApp, "const simpleCalibrationBlockReason");
assertContains("mobile simple setup disabled helper", mobileApp, "const simpleWaterStartDisabled");
assertContains("mobile simple setup neutral title", mobileApp, "advancedMode ? \"Calibration unavailable\" : \"Use standby\"");
assertContains("mobile simple setup standby copy", mobileApp, "Use standby to start setup.");
assertContains("mobile simple setup protocol mismatch copy", mobileApp, "This app and device do not match. Update the app or firmware, then try again.");
assertContains("mobile simple setup capture unavailable copy", mobileApp, "Wait for the ruler mark.");
assertContains("mobile simple setup abort unavailable copy", mobileApp, "Setup is not running.");
assertContains("mobile simple setup started readback copy", mobileApp, "Setup started. First mark is");
assertContains("mobile simple water setup readback requires water mode", mobileApp, "return after.active && after.mode === \"water\" ? `Setup started. First mark is ${after.targetCm || 4} cmH2O.` : \"Use standby to start setup.\";");
assertContains("mobile simple auto calibration readback requires auto mode", mobileApp, "return after.active && after.mode === \"auto\" ? \"Setup started.\" : \"Use standby to start setup.\";");
assertContains("mobile simple setup mark saved copy", mobileApp, "Mark saved. Next mark is");
assertContains("mobile simple setup mark not saved copy", mobileApp, "Wait for the waterline to reach the ruler mark.");
assertContains("mobile simple setup saved panel copy", mobileApp, "Setup saved.");
assertAbsent("mobile simple setup panel hides map saved copy", mobileApp, "Water-column map saved.");
assertContains("mobile simple setup action standby copy", mobileApp, "Use standby to start setup.");
assertAbsent("mobile simple setup preemptive advanced failure copy removed", mobileApp, "The device is not ready for setup yet. Open Advanced for details.");
assertContains("mobile mode-aware write recheck helper", mobileApp, "type ModeAwareMessage = string | { simple: string; advanced: string };");
assertContains("mobile mode-aware write recheck selector", mobileApp, "function modeAwareMessage(messageText: ModeAwareMessage)");
assertContains("mobile simple start write-time recheck copy", mobileApp, "Use standby to start airflow.");
assertContains("mobile simple capture write-time recheck copy", mobileApp, "Wait for the ruler mark.");
assertContains("mobile simple abort write-time recheck copy", mobileApp, "Setup is not running.");
assertAbsent("mobile simple setup preemptive blocker display removed", mobileApp, "simpleCalibrationBlockReason");
assertAbsent("mobile simple old did-not-start copy removed", mobileApp, "The device did not start.");
assertAbsent("mobile simple old setup-did-not-start copy removed", mobileApp, "The setup did not start.");
assertAbsent("mobile simple old could-not-start title removed", mobileApp, "\"Could not start\"");
assertAbsent("mobile simple old could-not-start-setup title removed", mobileApp, "\"Could not start setup\"");
assertAbsent("mobile simple old could-not-capture title removed", mobileApp, "\"Could not capture mark\"");
assertContains("mobile automatic stop import previous mode ref", mobileApp, "previousModeRef");
assertContains("mobile automatic stop import session guard ref", mobileApp, "autoImportingSessionRef");
assertContains("mobile automatic stop import pending session ref", mobileApp, "autoImportPendingSessionRef");
assertContains("mobile automatic stop import arms captured session transition", mobileApp, "if (wasTherapyActive && !isTherapyActive) {\n      autoImportPendingSessionRef.current = deviceSessionIdRef.current;");
assertContains("mobile automatic stop import waits for settled captured session", mobileApp, "autoImportPendingSessionRef.current === sessionId && (nextMode === \"0\" || nextMode === \"4\")");
assertContains("mobile automatic stop import waits while busy", mobileApp, "otaInProgress ||\n      busy ||\n      autoImportingSessionRef.current === sessionId");
assertContains("mobile automatic stop import captures loader target", mobileApp, "loadLogsFromDevice(\"auto\", connectedDevice, sessionId)");
assertContains("mobile automatic stop import schedules bounded retries", mobileApp, "if (result === \"failed\" || result === \"unavailable\") scheduleAutoImportRetry(connectedDevice, sessionId);");
assertContains("mobile automatic stop import retry count bound", mobileApp, "autoImportRetryCountRef.current >= autoImportMaxAttempts");
assertContains("mobile automatic stop import retry timer", mobileApp, "autoImportRetryTimeoutRef.current = setTimeout(() => {");
assertContains("mobile retained log owns busy flag for every transfer", mobileApp, "setBusy(true);\n    try {\n      const logs = await readCsvTransfer");
assertContains("mobile retained log releases busy only for captured session", mobileApp, "if (isCurrentDeviceSession(readDevice, sessionId)) setBusy(false);");
assertContains("mobile retained log captures read device", mobileApp, "readDevice = connectedDevice,\n    sessionId = deviceSessionIdRef.current,");
assertContains("mobile retained log reads captured device", mobileApp, "readCsvTransfer(readDevice, OZEALIS_CHARACTERISTICS.logDownload)");
assertContains("mobile retained log discards stale readback", mobileApp, "if (!isCurrentDeviceSession(readDevice, sessionId)) return \"stale\";");
assertContains("mobile retained log suppresses stale failure", mobileApp, "catch (error) {\n      if (!isCurrentDeviceSession(readDevice, sessionId)) return \"stale\";\n      setMessage(actionErrorMessage(error, \"Could not update data.\"");
assertContains("mobile docs retained log stale failure discard", mobileDoc, "stale read failures from replaced sessions are also suppressed");
assertContains("mobile retained readback validates pair before apply", mobileApp, "validateRetainedSnapshotPair(pair);");
assertContains("mobile retained readback keeps previous pair on ordinary empty import", mobileApp, "if (validImportedRows > 0) {\n        commitRetainedSnapshotPair(readDevice.id, pair);");
assertContains("mobile retained readback commits both streams together", mobileApp, "setRetainedImport({\n      sessionCsv: pair.session.csv,\n      faultCsv: pair.fault.csv,\n      manifest,");
assertContains("mobile retained readback carries transfer metadata", appCsvTransfer, "export type CsvTransferSnapshot = {");
assertContains("mobile retained transfer returns metadata snapshot", appCsvTransfer, "if (transfer.accept(response)) return transfer.finishSnapshot();");
assertAbsent("mobile device log import must not replace display with raw logs", mobileApp, "setLogCsv(logs);");
assertAbsent("mobile device log import must not replace display with raw faults", mobileApp, "setFaultCsv(faults);");
assertContains("mobile data import expected-family valid row count", mobileApp, "const validImportedRows = retainedReadbackImportedRowCount(logs.csv, faults.csv);");
assertContains("mobile automatic retained import message", mobileApp, "Machine stopped. Latest retained session, pressure, flow, and fault data imported.");
assertContains("mobile automatic retained import no rows message", mobileApp, "Machine stopped. Retained log readback had no valid rows.");
assertContains("mobile simple automatic data ready copy", mobileApp, "Your data is ready.");
assertContains("mobile simple automatic no rows copy", mobileApp, "Data checked. No new rows yet.");
assertContains("mobile advanced manual no rows copy", mobileApp, "Log readback had no valid rows.");
assertContains("mobile simple manual data update message", mobileApp, "Data updated.");
assertContains("mobile simple manual no rows copy", mobileApp, "No data yet.");
assertAbsent("mobile simple automatic data ready copy removed", mobileApp, "Your latest data is ready.");
assertContains("mobile simple data update failure copy", mobileApp, "Could not update data.");
assertAbsent("mobile simple automatic data update failure latest copy removed", mobileApp, "Could not update your latest data.");
assertContains("mobile log row-count display", mobileApp, "Session rows");
assertContains("mobile retained window display", mobileApp, "Retained window");
assertContains("mobile live synced rows display", mobileApp, "Live synced rows");
assertContains("mobile analysis source display", mobileApp, "Analysis source");
assertContains("mobile simple data title", mobileApp, "Here's your data");
assertContains("mobile simple data day picker", mobileApp, "simpleDataDays.map((day) =>");
assertContains("mobile simple data elapsed latest label", appValidation, "Latest day");
assertContains("mobile simple data elapsed previous label", appValidation, "Previous day");
assertAbsent("mobile simple data must not claim calendar today", appValidation, "return \"Today\"");
assertAbsent("mobile simple data must not claim calendar yesterday", appValidation, "return \"Yesterday\"");
assertContains("mobile simple data selected day helper", mobileApp, "const selectedDataDay");
assertContains("mobile simple data day options helper", appValidation, "export function listSessionDayOptions");
assertContains("mobile simple data day filter helper", appValidation, "export function filterSessionCsvByDay");
assertContains("mobile simple data finite day limit guard", appValidation, "const dayLimit = Number.isFinite(maxDays) ? Math.max(0, Math.floor(maxDays)) : 7;");
assertContains("mobile simple data uses day options", mobileApp, "const simpleDataDays = useMemo(() => listSessionDayOptions(analysisCsv), [analysisCsv]);");
assertContains("mobile simple data filters selected day", mobileApp, "const selectedDataCsv = useMemo(");
assertContains("mobile simple data graph uses selected day", mobileApp, "const visibleAnalysisCsv = advancedMode ? analysisCsv : selectedDataCsv;");
assertContains("mobile simple data day options tests", mobileValidationTests, "assert.deepEqual(listSessionDayOptions(multiDayCsv)");
assertContains("mobile simple data nonfinite day limit tests", mobileValidationTests, "listSessionDayOptions(multiDayCsv, Number.NaN)");
assertContains("mobile simple data day filter tests", mobileValidationTests, "filterSessionCsvByDay(multiDayCsv, \"day-1\")");
assertContains("mobile simple data gap rejection tests", mobileValidationTests, "const dayGapCsv = [");
assertContains("mobile simple data day gap filter tests", mobileValidationTests, "filterSessionCsvByDay(dayGapCsv, \"day-0\")");
assertContains("mobile simple data invalid day key fallback tests", mobileValidationTests, "filterSessionCsvByDay(multiDayCsv, \"not-a-day\")");
assertContains("mobile simple data display", mobileApp, "Data");
assertContains("mobile simple data time display", mobileApp, "Time");
assertContains("mobile simple data optional day prompt", mobileApp, "Select the day if you want.");
assertContains("mobile simple data quiet empty state", mobileApp, "Your pressure and airflow graphs will appear here.");
assertContains("mobile simple data hides empty day picker", mobileApp, "simpleDataDays.length > 0 && (\n                  <>");
assertContains("mobile simple data helper before day picker", mobileApp, "Select the day if you want.</Text>}\n                    <View style={styles.dayPicker}>");
assertAbsent("mobile simple data ready row removed", mobileApp, "const simpleDataLabel");
assertContains("mobile simple data update action label", mobileApp, "label=\"Update\"");
assertContains("mobile simple data keeps read action advanced only", mobileApp, "{advancedMode && (\n              <View style={styles.actions}>\n                <ActionButton icon=\"download\" label=\"Read\"");
assertContains("mobile docs simple day filters graphs", mobileDoc, "filters the displayed graphs and airflow notes to the selected elapsed-day bucket");
assertContains("mobile docs simple day cadence validation", mobileDoc, "strictly increasing timestamps and cadence-consistent gaps");
assertContains("mobile docs simple day updates displays", mobileDoc, "changing the selected day must update the displayed graphs, time window, and airflow notes");
assertContains("mobile docs retained import atomic pair", mobileDoc, "commits session CSV, fault CSV, and a strict source manifest as one logical import");
assertContains("mobile docs retained import manifest device source", mobileDoc, "manifest records BLE device ID, import time, and each transfer's generation, byte count, and hash");
assertContains("mobile docs retained import manifest commits last", mobileDoc, "is written after both CSV files");
assertContains("mobile docs retained import restore validates both files", mobileDoc, "must match both files before restore");
assertContains("mobile docs retained import rejects mixed pair", mobileDoc, "incomplete, interrupted, or mixed pair updates neither stream");
assertContains("mobile docs retained import binds visible evidence to device", mobileDoc, "stored evidence from one Ozealis is hidden while another device is connected");
assertContains("mobile docs retained import verified clear commits pair", mobileDoc, "Canonical header-only clear evidence commits both empty files together only when both exact families verify");
assertContains("mobile docs retained import rejects malformed rows atomically", mobileDoc, "Malformed, duplicate, padded, non-increasing, exponent-form, leading-zero numeric fields, no-fault, or foreign rows fail the pair");
assertContains("mobile docs automatic import waits for busy operation", mobileDoc, "Automatic stop-time import waits while another app operation is busy");
assertContains("mobile docs automatic import owns busy guard", mobileDoc, "owns the busy guard while transferring");
assertContains("mobile docs automatic import retries captured session", mobileDoc, "retries bounded transient failures only for the captured connected-device session");
assertContains("mobile docs retained log stale session discard", mobileDoc, "discard the pair if either changes before both files return");
assertContains("mobile docs retained import success requires expected-family rows", mobileDoc, "say data is ready/updated only when the retained-session or fault readback contains at least one exact valid row after validating both readbacks into their expected file families");
assertContains("mobile docs retained import preserves old pair on empty readback", mobileDoc, "ordinary valid header-only pair means there are no new rows and preserves the previously committed pair");
assertContains("mobile docs retained CSV exports disabled until loaded", mobileDoc, "Advanced retained-session and fault CSV export controls stay disabled until that CSV body has been loaded");
assertContains("mobile validation tests retained normalizer rejects fault CSV", mobileValidationTests, "assert.equal(normalizeRetainedSessionCsv(faultCountCsv), \"\");");
assertContains("mobile validation tests fault normalizer rejects session CSV", mobileValidationTests, "assert.equal(normalizeFaultCsv(retainedCountCsv), \"\");");
assertContains("mobile validation tests retained import count accepts expected families", mobileValidationTests, "assert.equal(retainedReadbackImportedRowCount(retainedImportCsv, faultImportCsv), 3);");
assertContains("mobile validation tests retained import count rejects swapped families", mobileValidationTests, "assert.equal(retainedReadbackImportedRowCount(faultImportCsv, retainedImportCsv), 0);");
assertContains("mobile validation tests retained import count rejects live family", mobileValidationTests, "assert.equal(retainedReadbackImportedRowCount(liveCountCsv, \"\"), 0);");
assertContains("mobile validation tests retained import count ignores clear headers", mobileValidationTests, "assert.equal(retainedReadbackImportedRowCount(retainedHeaderOnlyCsv, faultHeaderOnlyCsv), 0);");
assertContains("mobile validation tests retained import count accepts expected fault family only", mobileValidationTests, "assert.equal(retainedReadbackImportedRowCount(liveCountCsv, faultImportCsv), 1);");
assertContains("mobile validation tests fault CSV rejects no-fault rows", mobileValidationTests, "assert.equal(normalizeFaultCsv(faultNoneCsv), \"\");");
assertContains("mobile validation tests retained exponent analog rows", mobileValidationTests, "const retainedExponentAnalogCsv = [");
assertContains("mobile validation tests fault exponent analog rows", mobileValidationTests, "const faultExponentAnalogCsv = [");
assertContains("mobile validation tests live exponent analog rows", mobileValidationTests, "const liveExponentAnalogCsv = [");
assertContains("mobile validation tests live leading blank header rejection", mobileValidationTests, "liveLeadingBlankHeaderCsv");
assertContains("mobile validation tests live blank body rejection", mobileValidationTests, "liveBlankBodyCsv");
assertContains("mobile validation tests live extra trailing blank rejection", mobileValidationTests, "liveExtraTrailingBlankCsv");
assertContains("mobile validation tests optional leading-zero number rejection", mobileValidationTests, "assert.equal(parseOptionalTelemetryNumber(\"024.5\"), \"--\");");
assertContains("mobile validation tests retained leading-zero analog rows", mobileValidationTests, "const retainedLeadingZeroAnalogCsv = [");
assertContains("mobile validation tests fault leading-zero analog rows", mobileValidationTests, "const faultLeadingZeroAnalogCsv = [");
assertContains("mobile validation tests live leading-zero analog rows", mobileValidationTests, "const liveLeadingZeroAnalogCsv = [");
assertContains("mobile docs CSV exponent-form rejection", mobileDoc, "exponent-form");
assertContains("mobile docs CSV leading-zero rejection", mobileDoc, "leading-zero numeric fields");
assertAbsent("mobile simple data old latest import label removed", mobileApp, "Latest import");
assertAbsent("mobile simple data old recorded time label removed", mobileApp, "Recorded time");
assertAbsent("mobile simple data old sync copy removed", mobileApp, "The app imports the latest session when airflow stops.");
assertAbsent("mobile simple data old choose-day copy removed", mobileApp, "Choose a day");
assertAbsent("mobile simple data old refresh empty copy removed", mobileApp, "Your pressure and airflow data will appear here after refresh.");
assertAbsent("mobile simple data old session empty copy removed", mobileApp, "Pressure and airflow data will appear here after a session.");
assertContains("mobile analysis source live label", appValidation, "Live 10 Hz app sync");
assertContains("mobile analysis source retained label", appValidation, "Retained 1 Hz firmware session");
assertContains("mobile live 10 Hz export", mobileApp, "Export live 10 Hz CSV");
assertContains("mobile retained window disclosure", mobileApp, "analysis derates to the rolling 30-minute 1 Hz retained firmware buffer");
assertContains("mobile advanced pressure flow graph empty state", mobileApp, "Pressure and flow graphs appear after a session import.");
assertContains("mobile simple pressure airflow graph empty state", mobileApp, "Your pressure and airflow graphs will appear here.");
assertContains("mobile pressure graph label", mobileApp, "label=\"Pressure\"");
assertContains("mobile flow graph label", mobileApp, "label=\"Flow proxy\"");
assertContains("mobile simple graph hides technical range", mobileApp, "showRange={advanced}");
assertContains("mobile graph scale selector", mobileApp, "function GraphScaleSelector");
assertContains("mobile advanced graph scale selector", mobileApp, "advanced ? advancedGraphScales : simpleGraphScales");
assertContains("mobile graph view label", mobileApp, "Graph view");
assertContains("mobile low-flow index label", mobileApp, "Low-flow index");
assertContains("mobile potential observation display", mobileApp, "Potential breathing observations");
assertContains("mobile potential observation non-diagnostic copy", mobileApp, "Non-diagnostic heuristic flags from the imported flow proxy");
assertContains("mobile potential observation not AHI copy", mobileApp, "These are not AHI, diagnosis, screening, or treatment guidance");
assertContains("mobile simple observation nonmedical copy", mobileApp, "Notes from the airflow trend. These are not medical advice or diagnosis.");
assertContains("mobile simple observation plain type", mobileApp, "advanced ? observation.type : \"Airflow note\"");
assertContains("mobile simple observation plain time copy", mobileApp, "Around ${formatElapsed(observation.startMs)} for about ${observation.durationSec}s.");
assertContains("mobile simple observation quiet empty state", mobileApp, "Notes will appear here.");
assertContains("mobile simple observation no notes copy", mobileApp, "Nothing unusual noted.");
assertAbsent("mobile simple observation old imported copy removed", mobileApp, "Simple notes from the imported airflow trend");
assertContains("mobile simple observation plain trend copy", mobileApp, "Notes from the airflow trend. These are not medical advice or diagnosis.");
assertAbsent("mobile simple observation old session empty copy removed", mobileApp, "No airflow notes for this session.");
assertAbsent("mobile simple observation old refresh copy removed", mobileApp, "Refresh after a session to see notes here.");
assertContains("mobile advanced-only observation basis", mobileApp, "advanced && <Text style={styles.observationBasis}>{observation.basis}</Text>");
assertContains("mobile docs simple data hides graph ranges", mobileDoc, "hide graph min/max ranges and heuristic basis details");
assertContains("mobile docs graph scale simple", mobileDoc, "Simple graph scale controls stay limited to Night and Breath views");
assertContains("mobile docs graph scale advanced", mobileDoc, "Advanced exposes All, 10 min, 1 min, and 30 sec graph windows");
assertContains("mobile docs graph scale breath inspection", mobileDoc, "scale from night-wide review to breath-level inspection");
assertContains("mobile docs advanced data keeps heuristic details", mobileDoc, "confidence, flow-drop percentages, heuristic basis");
assertContains("mobile Simple copy verifier title guard", read("scripts/verify-mobile-simple-copy.mjs"), "Simple Data title");
assertContains("mobile Simple copy verifier history guard", read("scripts/verify-mobile-simple-copy.mjs"), "History");
assertContains("mobile Simple copy verifier scoped update branch", read("scripts/verify-mobile-simple-copy.mjs"), "Simple Data action branch");
assertContains("mobile Simple copy verifier update reads logs", read("scripts/verify-mobile-simple-copy.mjs"), "onPress={readLogs}");
assertContains("mobile Simple copy verifier raw read label guard", read("scripts/verify-mobile-simple-copy.mjs"), "Simple Data update hides raw read label");
assertContains("mobile Simple copy verifier About selector guard", read("scripts/verify-mobile-simple-copy.mjs"), "showBuilderOptions && <UiModeSelector");
assertContains("mobile Simple copy verifier Builder status clear guard", read("scripts/verify-mobile-simple-copy.mjs"), "Simple mode clears Builder status text");
assertContains("mobile Simple copy verifier Builder collapse guard", read("scripts/verify-mobile-simple-copy.mjs"), "Simple mode collapses Builder settings");
assertContains("mobile Simple copy verifier pairing device-id guard", read("scripts/verify-mobile-simple-copy.mjs"), "{advancedMode && <Text style={styles.mutedText}>{device.id}</Text>}");
assertContains("mobile docs Simple copy verifier release item", releaseChecklistDoc, "Mobile Simple-mode copy verifier passes");
assertContains("mobile bounded session preview", mobileApp, "sessionPreview || \"No session log loaded.\"");
assertContains("mobile MCF params export", mobileApp, "Export snapshot");
assertContains("mobile MCF params export redaction helper", appValidation, "redactSensitiveJson(raw: string)");
assertContains("mobile MCF params export uses redaction", mobileApp, "redactSensitiveJson(driverParamsJson)");
assertContains("mobile MCF params export redacts passcodes", appValidation, "passcode|password|pwd|secret|token|credential|api[_-]?key|private[_-]?key|authorization|bearer");
assertContains("mobile validation tests snapshot API key redaction", mobileValidationTests, "apiKey: \"[redacted]\"");
assertContains("mobile validation tests snapshot private key redaction", mobileValidationTests, "private_key: \"[redacted]\"");
assertContains("mobile MCF params export rejects non-object roots", appValidation, "if (!isJsonObject(parsed)) return invalidJsonSnapshotExport();");
assertContains("mobile MCF params export blocks invalid JSON raw fallback", appValidation, "invalid_json_snapshot_not_exported");
assertContains("mobile docs MCF params export redaction", mobileDoc, "Redact sensitive key names such as passcodes, passwords, secrets, tokens, credentials, API keys, private keys, authorization values, and bearer values");
assertContains("mobile docs MCF params invalid JSON export marker", mobileDoc, "malformed or non-object snapshot JSON exports only a benign `invalid_json_snapshot_not_exported` marker");
assertContains("mobile docs exact export filename message", mobileDoc, "show the exact timestamped filename in the status message");
assertContains("mobile validation tests non-object snapshot export marker", mobileValidationTests, "for (const rawSnapshot of [\"null\", \"42\", \"\\\"snapshot\\\"\", \"[]\", \"true\"])");
assertContains("mobile MCF params parsed state display", mobileApp, "Snapshot state");
assertContains("mobile MCF params I2C address display", mobileApp, "Snapshot I2C address");
assertContains("mobile MCF params fault display", mobileApp, "Snapshot fault");
assertContains("mobile MCF params FG display", mobileApp, "Snapshot FG");
assertContains("mobile MCF params parsed write display", mobileApp, "Parameter writes");
assertContains("mobile docs MCF snapshot FG display", mobileDoc, "current speed-command transport state and FG tach estimate");
assertContains("protocol docs MCF params UUID", protocolDoc, "MCF8316D parameter snapshot");
assertContains("protocol docs MCF params read-only", protocolDoc, "encrypted read-only");
assertContains("protocol docs MCF params speed I2C", protocolDoc, "\"runtimeSpeed\": \"i2c\"");
assertContains("protocol docs MCF params I2C address", protocolDoc, "\"i2cAddr\": \"0x01\"");
assertContains("protocol docs MCF params fault field", protocolDoc, "fault:true/false");
assertContains("protocol docs MCF params commandReady field", protocolDoc, "\"commandReady\": true");
assertContains("protocol docs MCF params default benchOnly false", protocolDoc, "\"benchOnly\": false");
assertContains("protocol docs MCF params default FG field", protocolDoc, "\"fgHz\": 0.0");
assertContains("protocol docs MCF params commandReady explicit boolean", protocolDoc, "mobile clients require an explicit boolean `commandReady=true`");
assertContains("protocol docs MCF params commandReady cross-check", protocolDoc, "still cross-check driver identity, I2C presence, fault state, target speed, runtime speed, and readback state");
assertContains("protocol docs MCF params missing commandReady not ready", protocolDoc, "Missing or non-boolean `commandReady` fields are treated as not ready");
assertContains("protocol docs MCF params finite FG", protocolDoc, "The MCF snapshot keeps `fgHz` as a finite JSON number from `0` through `100000`");
assertContains("protocol docs MCF params unavailable FG fallback", protocolDoc, "unavailable or out-of-range tach evidence is reported as `0` while the readiness booleans and state fields remain authoritative");
assertContains("protocol docs benchOnly field meaning", protocolDoc, "`benchOnly` is true only when the explicit bench PWM speed-command fallback is compiled in");
assertContains("protocol docs bench PWM opt-in", protocolDoc, "OZEALIS_BENCH_PWM_SPEED_FALLBACK=1");
assertContains("protocol docs MCF params writes disabled", protocolDoc, "\"writesAllowed\": false");
assertContains("protocol docs JSON readbacks object roots", protocolDoc, "JSON readbacks for settings, motor calibration status, and the MCF8316D parameter snapshot must be JSON objects");
assertContains("protocol docs non-object readbacks fail closed", protocolDoc, "treats malformed JSON, arrays, primitive JSON values, or `null` as invalid readback instead of deriving readiness from a non-object root");
assertContains("protocol docs invalid settings readback preserves display", protocolDoc, "leaves the currently displayed settings in place, marks them unverified, and keeps settings writes disabled");
assertContains("MCF commissioning snapshot fault field", mcfCommissioningDoc, "\"fault\": false");
assertContains("MCF commissioning snapshot I2C address", mcfCommissioningDoc, "\"i2cAddr\": \"0x01\"");
assertContains("MCF commissioning snapshot commandReady field", mcfCommissioningDoc, "\"commandReady\": true");
assertContains("MCF commissioning snapshot I2C speed not bench-only", mcfCommissioningDoc, "\"runtimeSpeed\": \"i2c\",\n  \"targetSpeed\": \"i2c\",\n  \"commandReady\": true,\n  \"writesAllowed\": false,\n  \"benchOnly\": false");
assertContains("MCF commissioning export command readiness", mcfCommissioningDoc, "command-readiness summary");
assertContains("MCF commissioning finite FG field", mcfCommissioningDoc, "current finite FG tach frequency estimate as `fgHz`");
assertContains("MCF commissioning unavailable FG fallback", mcfCommissioningDoc, "unavailable or out-of-range tach evidence reports `0`");
assertContains("MCF commissioning export fault state", mcfCommissioningDoc, "driver fault-latch state");
assertContains("mobile calibration status parser", appValidation, "parseCalibrationStatus(raw: string)");
assertContains("mobile calibration status parse rejects non-objects", appValidation, "if (!isJsonObject(parsed)) return defaultCalibrationStatus();");
assertContains("mobile calibration status default helper", appValidation, "function defaultCalibrationStatus(): CalibrationStatus");
assertContains("mobile validation tests non-object calibration JSON", mobileValidationTests, "const defaultCalibration = parseCalibrationStatus(\"null\");");
assertContains("mobile validation tests non-object MCF JSON", mobileValidationTests, "const defaultMcfParams = parseMcfParamsSnapshot(\"null\");");
assertContains("mobile calibration active strict boolean parser", appValidation, "const active = parsed.active === true;");
assertContains("mobile calibration curve completion requires exact terminal state", appValidation, "parsed.state === \"water-done\"");
assertContains("mobile calibration curve completion requires exact raw point count", appValidation, "parsed.capturedPoints === 17");
assertContains("mobile calibration curve parser uses completion predicate", appValidation, "curveValid: curveComplete");
assertContains("mobile calibration strict JSON number helper", appValidation, "function finiteJsonNumber");
assertContains("mobile calibration bounded JSON number helper", appValidation, "function boundedJsonNumber");
assertContains("mobile calibration strict JSON integer helper", appValidation, "function clampJsonInteger");
assertContains("mobile calibration strict JSON string helper", appValidation, "function jsonString");
assertContains("mobile calibration known-state parser", appValidation, "state: knownCalibrationState(parsed.state)");
assertContains("mobile calibration known-mode parser", appValidation, "mode: knownCalibrationMode(parsed.mode)");
assertContains("mobile calibration known trim status helper", appValidation, "function knownSensorTrimStatus");
assertContains("mobile calibration water target parser", appValidation, "targetCm: waterTargetCm(parsed.targetCm)");
assertContains("mobile calibration water target strict helper", appValidation, "value < 4 || value > 20");
assertContains("mobile calibration captured points clamp", appValidation, "const capturedPoints = clampJsonInteger(parsed.capturedPoints, 0, 17, 0);");
assertContains("mobile calibration command clamp", appValidation, "amp: clampJsonInteger(parsed.amp, 0, 255, 0)");
assertContains("firmware calibration status finite helper", firmwareMotorCal, "static float finiteStatusNumber(float value, float fallback, float minValue, float maxValue)");
assertContains("firmware calibration status FG field", firmwareMotorCal, "\\\"fgHz\\\":%.2f");
assertContains("firmware calibration status finite gain", firmwareMotorCal, "const float statusGain = finiteStatusNumber(profile.gainCmPerAmp, 0.0f, 0.0f, 2.0f);");
assertContains("firmware calibration status finite pressure", firmwareMotorCal, "const float statusMaxCm = finiteStatusNumber(profile.maxPressureCm, 0.0f, 0.0f, MAX_THERAPY_PRESSURE_CM);");
assertContains("firmware calibration status finite best pressure", firmwareMotorCal, "const float statusBestCm = finiteStatusNumber(bestPressureCm, 0.0f, 0.0f, MAX_THERAPY_PRESSURE_CM);");
assertContains("firmware calibration status bounded FG source", firmwareMotorCal, "const float statusFgHz = finiteStatusNumber(motorGetFgHz(), 0.0f, 0.0f, 100000.0f);");
assertContains("firmware calibration status bounded trim source", firmwareMotorCal, "const float statusTrimHpa = finiteStatusNumber(sensorDifferentialTrim_hPa(), 0.0f, -25.0f, 25.0f);");
assertContains("firmware calibration status uses finite FG", firmwareMotorCal, "statusFgHz,\n           sensorDifferentialTrimValid()");
assertContains("firmware calibration status uses finite trim", firmwareMotorCal, "statusTrimHpa,\n           sensorDifferentialTrimSamples()");
assertContains("mobile calibration FG parser", appValidation, "fgHz: boundedJsonNumberOrNull(parsed.fgHz, 0, 100000)");
assertContains("mobile calibration FG default", appValidation, "fgHz: null");
assertContains("mobile validation tests calibration FG high bound", mobileValidationTests, "assert.equal(parseCalibrationStatus(JSON.stringify({ fgHz: 100000 })).fgHz, 100000);");
assertContains("mobile validation tests calibration FG rejects string", mobileValidationTests, "assert.equal(parseCalibrationStatus(JSON.stringify({ fgHz: \"123.4\" })).fgHz, null);");
assertContains("mobile calibration trim samples raw read", appValidation, "const sensorTrimSamplesRaw = parsed.sensorTrimSamples;");
assertContains("mobile calibration trim samples clamp", appValidation, "const sensorTrimSamples = clampJsonInteger(sensorTrimSamplesRaw, 0, 17, 0);");
assertContains("mobile calibration gain range parser", appValidation, "gain: boundedJsonNumber(parsed.gain, 0, MAX_MASK_PRESSURE_CM, 0)");
assertContains("mobile calibration max pressure range parser", appValidation, "maxCm: boundedJsonNumber(parsed.maxCm, 0, MAX_MASK_PRESSURE_CM, 0)");
assertContains("mobile calibration best pressure range parser", appValidation, "bestCm: boundedJsonNumber(parsed.bestCm, 0, MAX_MASK_PRESSURE_CM, 0)");
assertContains("mobile calibration sensor trim parser", appValidation, "sensorTrimHpa,");
assertContains("mobile calibration sensor trim range parser", appValidation, "boundedJsonNumber(parsed.sensorTrimHpa, -25, 25, 0)");
assertContains("mobile calibration sensor trim status parser", appValidation, "const sensorTrimStatus = knownSensorTrimStatus(parsed.sensorTrimStatus);");
assertContains("mobile calibration trim valid exact raw sample rule", appValidation, "const sensorTrimSamplesComplete = sensorTrimSamplesRaw === 17;");
assertContains("mobile calibration trim valid derived from saved status", appValidation, "sensorTrimValid: parsed.sensorTrimValid === true && sensorTrimStatus === \"saved\" && sensorTrimSamplesComplete && sensorTrimInRange");
assertContains("mobile validation tests trim valid requires full sample count", mobileValidationTests, "sensorTrimSamples: 16, sensorTrimStatus: \"saved\"");
assertContains("mobile validation tests trim valid rejects overrange sample count", mobileValidationTests, "sensorTrimSamples: 42, sensorTrimStatus: \"saved\"");
assertContains("mobile validation tests trim valid requires saved status", mobileValidationTests, "sensorTrimSamples: 17, sensorTrimStatus: \"pending\"");
assertContains("mobile validation tests reject high trim valid flag", mobileValidationTests, "sensorTrimHpa: 26");
assertContains("mobile validation tests reject out of range maxCm", mobileValidationTests, "maxCm: 25.1");
assertContains("mobile validation tests curve requires exact terminal set", mobileValidationTests, "const exactWaterCompletion = { state: \"water-done\", active: false, mode: \"water\", capturedPoints: 17, curveValid: true };");
assertContains("mobile validation tests curve rejects active full set", mobileValidationTests, "{ ...exactWaterCompletion, active: true }");
assertContains("mobile validation tests curve rejects partial set", mobileValidationTests, "{ ...exactWaterCompletion, capturedPoints: 16 }");
assertContains("mobile docs calibration status integer bounds", mobileDoc, "accepts only whole-centimeter water targets `4..20` or idle target `0`");
assertContains("mobile docs calibration status string whitelist", mobileDoc, "accepts only known firmware calibration state, mode, and sensor-trim status strings");
assertContains("mobile docs calibration pressure display bounds", mobileDoc, "bounds displayed calibration pressures and gain to `0..25`");
assertContains("mobile docs calibration FG bounds", mobileDoc, "accepts calibration FG tach status only as finite JSON `0..100000` Hz");
assertContains("mobile docs calibration trim valid full sample rule", mobileDoc, "treats sensor trim as valid only when the firmware reports `sensorTrimStatus=saved` with all 17 samples and a blower-minus-mask offset within the shared `25 hPa` sensor-trim sanity bound");
assertContains("mobile docs calibration curve valid full sample rule", mobileDoc, "treats `curveValid` as setup evidence only when the same parsed status is non-active and reports exactly 17 captured water-column points");
assertContains("protocol docs calibration curve valid full sample rule", protocolDoc, "The app treats `curveValid` as true only from a non-active status with exactly 17 captured water-column points");
assertContains("protocol docs calibration status finite numbers", protocolDoc, "Calibration-status numeric fields must remain finite JSON numbers");
assertContains("protocol docs calibration unavailable numeric fallback", protocolDoc, "firmware reports unavailable or out-of-range gain, pressure, FG, and trim values as bounded `0` values");
assertContains("mobile calibration parsed display", mobileApp, "calibration.bestCm.toFixed(2)");
assertContains("mobile calibration command label", mobileApp, "Current command");
assertContains("mobile calibration FG display", mobileApp, "Calibration FG");
assertContains("mobile calibration start idle and fault guard", mobileApp, "const calibrationStartAllowed = canUseDevice && protocolCompatible && telemetry.mode === \"0\" && noSystemFault && !calibration.active && driverReady");
assertContains("mobile calibration protocol gate", mobileApp, "Calibration requires the expected Ozealis BLE protocol version");
assertContains("mobile delayed calibration start latest guard", mobileApp, "writeGuardsRef.current.calibrationStartAllowed");
assertContains("mobile delayed calibration current device guard", mobileApp, "if (!isCurrentConnectedDevice(writeDevice)) return;\n    if (writeGuardsRef.current.busy) return;");
assertContains("mobile delayed calibration protocol guard", mobileApp, "if (!writeGuardsRef.current.protocolCompatible) {\n      Alert.alert(\n        advancedModeRef.current ? \"Protocol mismatch\"");
assertOrder("mobile delayed calibration protocol before start availability guard", mobileApp, "advancedModeRef.current ? \"Protocol mismatch\"", "(command === \"start\" || command === \"waterStart\") && !writeGuardsRef.current.calibrationStartAllowed");
assertContains("mobile delayed calibration capture latest guard", mobileApp, "writeGuardsRef.current.waterCaptureAllowed");
assertContains("mobile delayed calibration abort latest guard", mobileApp, "writeGuardsRef.current.calibrationAbortAllowed");
assertContains("mobile calibration capture/abort fresh status helper", mobileApp, "async function confirmCalibrationCommandAvailableBeforeWrite(command: \"capture\" | \"abort\", device = connectedDevice)");
assertContains("mobile calibration capture fresh water gate", mobileApp, "command === \"capture\" && nextCalibration.active && nextCalibration.mode === \"water\"");
assertContains("mobile calibration abort fresh active gate", mobileApp, "command === \"abort\" && nextCalibration.active");
assertContains("mobile calibration fresh status returned for readback baseline", mobileApp, "if (command === \"capture\" && nextCalibration.active && nextCalibration.mode === \"water\") return nextCalibration;");
assertContains("mobile calibration readback baseline uses fresh status", mobileApp, "const freshBefore = await confirmCalibrationCommandAvailableBeforeWrite(command, writeDevice);\n        if (!freshBefore) return;\n        before = freshBefore;");
assertContains("mobile calibration capture fresh readback message", mobileApp, "Water-column capture requires a fresh active water-column calibration readback.");
assertContains("mobile calibration abort fresh readback message", mobileApp, "Calibration abort requires a fresh active calibration readback.");
assertContains("mobile delayed water setup guard state", mobileApp, "waterSetupReady: false");
assertContains("mobile delayed water setup guard refresh", mobileApp, "waterSetupReady,");
assertContains("mobile delayed water setup latest guard", mobileApp, "command === \"waterStart\" && !writeGuardsRef.current.waterSetupReady");
assertContains("mobile calibration write-time protocol recheck", mobileApp, "confirmProtocolBeforeWrite(");
assertContains("mobile calibration start fresh idle readback message", mobileApp, "Calibration start requires a fresh idle, no-fault, no-calibration readback before commanding the blower.");
assertContains("mobile calibration write-time MCF snapshot recheck", mobileApp, "Calibration start requires a fresh MCF8316D snapshot");
assertContains("mobile calibration abort protocol precheck", mobileApp, "command === \"start\" || command === \"waterStart\" || command === \"capture\" || command === \"abort\"");
assertContains("mobile water calibration capture gate", mobileApp, "const waterCaptureAllowed = canUseDevice && protocolCompatible && calibration.active && calibration.mode === \"water\"");
assertContains("mobile calibration abort protocol gate", mobileApp, "const calibrationAbortAllowed = canUseDevice && protocolCompatible && calibration.active");
assertContains("mobile calibration abort inactive alert", mobileApp, "There is no active calibration sweep to abort.");
assertContains("mobile water calibration start action", mobileApp, "sendCalibrationCommand(\"waterStart\")");
assertContains("mobile water calibration capture action", mobileApp, "sendCalibrationCommand(\"capture\")");
assertContains("mobile calibration command status readback", mobileApp, "readUtf8(writeDevice, OZEALIS_CHARACTERISTICS.calibrationStatus)");
assertContains("mobile calibration suppresses stale failure message", mobileApp, "catch (error) {\n      if (!isCurrentConnectedDevice(writeDevice)) return;\n      setMessage(actionErrorMessage(error, \"Use standby to start setup.\", \"Calibration command failed.\"));");
assertContains("firmware calibration command strict string parse", firmwareBle, "const char* command = jsonNonEmptyString(d, \"command\")");
assertContains("protocol docs malformed calibration no-notify no-op", protocolDoc, "missing, empty, or non-string `command`, or unknown calibration commands are ignored with a serial diagnostic, no calibration status notification, and no calibration state change");
assertContains("mobile calibration readback message helper", mobileApp, "calibrationCommandReadbackMessage(");
assertContains("mobile calibration start unaccepted readback", mobileApp, "Calibration sweep not accepted yet; status readback is");
assertContains("mobile water calibration start unaccepted readback", mobileApp, "Water-column calibration not accepted yet; status readback is");
assertContains("mobile water capture accepted readback", mobileApp, "Water-column point captured; next target is");
assertContains("mobile simple final setup saved copy", mobileApp, "Final mark saved. Setup saved.");
assertContains("mobile simple final setup fallback copy", mobileApp, "Final mark saved. Check setup status.");
assertAbsent("mobile simple final setup hides map jargon", mobileApp, "Final mark saved. Water-column map updated.");
assertContains("mobile final water capture exact completion guard", mobileApp, "const finalWaterCaptureVerified = after.state === \"water-done\" && after.capturedPoints === 17 && after.curveValid;");
assertContains("mobile advanced final water curve unverified copy", mobileApp, "curve was not verified");
assertContains("mobile water capture ignored readback", mobileApp, "Capture not accepted yet; status is");
assertContains("mobile calibration abort verified readback", mobileApp, "Calibration abort verified; status is");
assertContains("mobile calibration abort known-state verification guard", mobileApp, "if (!after.active && after.state !== \"unknown\") return `Calibration abort verified; status is ${after.state}.`;");
assertContains("mobile calibration abort unknown readback not verified", mobileApp, "Calibration abort not verified yet; status is");
assertContains("mobile simple calibration abort known-state guard", mobileApp, "if (!after.active && after.state !== \"unknown\") return \"Setup stopped.\";");
assertContains("mobile water calibration guided setup", mobileApp, "Make a U with clear CPAP tubing");
assertContains("mobile water calibration setup checklist", mobileApp, "const waterSetupReady = waterSetupItems.every");
assertContains("mobile water calibration setup checklist fresh initial state", mobileApp, "useState<Record<WaterSetupKey, boolean>>(() => ({ ...emptyWaterSetupChecks }))");
assertContains("mobile water calibration setup checklist guard", mobileApp, "Finish checklist");
assertContains("mobile simple setup plain guidance", mobileApp, "Use the tube, water, ruler, and device together.");
assertContains("mobile simple setup status helper", mobileApp, "const simpleSetupStatus");
assertContains("mobile simple setup active helper", mobileApp, "const simpleSetupRunning = calibration.mode === \"water\" && calibration.active;");
assertContains("mobile simple setup active status precedence", mobileApp, "const simpleSetupStatus = simpleSetupRunning");
assertContains("mobile simple setup checks done copy", mobileApp, "`${waterSetupCompleted}/${waterSetupItems.length} checks done`");
assertAbsent("mobile simple setup pressure map helper removed", mobileApp, "const simplePressureMapStatus");
assertAbsent("mobile simple setup sensor summary helper removed", mobileApp, "const simpleSensorCheck");
assertContains("mobile simple setup guided status panel", mobileApp, "Check each setup item, then start.");
assertContains("mobile simple setup checklist label", mobileApp, "Before you start");
assertAbsent("mobile simple setup bench checklist label removed", mobileApp, "Bench checklist");
assertContains("mobile simple setup pending status dot", mobileApp, "statusDotPending");
assertContains("mobile simple setup active status dot", mobileApp, "statusDotActive");
assertContains("mobile simple setup saved predicate", mobileApp, "const waterSetupSaved = !calibration.active && calibration.curveValid && waterCapturedCount === waterColumnTargets.length;");
assertContains("mobile simple setup saved dot predicate", mobileApp, "waterSetupSaved && styles.statusDotSaved");
assertContains("mobile simple setup numbered step component", mobileApp, "function SetupStep");
assertContains("mobile simple setup start label", mobileApp, "Start setup");
assertContains("mobile simple setup capture label", mobileApp, "Capture mark");
assertContains("mobile simple setup stop label", mobileApp, "Stop setup");
assertAbsent("mobile simple setup pressure map label removed", mobileApp, "Pressure map");
assertAbsent("mobile simple setup sensor check label removed", mobileApp, "Sensor check");
assertContains("mobile simple setup next ruler mark label", mobileApp, "Next ruler mark");
assertContains("mobile simple setup saves setup copy", mobileApp, "The app saves the setup when the sequence finishes.");
assertContains("mobile advanced setup export copy", mobileApp, "then export the session CSV and parameter snapshot");
assertContains("mobile docs simple setup copy split", mobileDoc, "In Simple Setup, use a guided status panel");
assertContains("mobile docs simple setup checklist language", mobileDoc, "`Before you start` numbered checklist");
assertContains("mobile docs simple setup appliance copy", mobileDoc, "Use appliance copy such as `Check each setup item, then start.`");
assertContains("mobile docs simple setup bench warnings advanced", mobileDoc, "Keep bench/instrumentation warnings");
assertContains("mobile simple setup active point prompt", mobileApp, "Point ${Math.min(waterCapturedCount + 1, waterColumnTargets.length)} of ${waterColumnTargets.length}");
assertContains("mobile docs simple setup action labels", mobileDoc, "plain action labels (`Start setup`, `Capture mark`, `Stop setup`)");
assertContains("mobile docs simple setup hides raw trim", mobileDoc, "raw sensor-check status, calibration state/status, sensor-trim hPa/sample details");
assertContains("mobile docs simple command results plain language", mobileDoc, "keep actual action failures plain-language");
assertContains("mobile docs simple no command-watch phrasing", mobileDoc, "command-sent/watch-state phrasing");
assertContains("mobile docs advanced command readback details", mobileDoc, "state-readback, calibration-status, command-transport details");
assertContains("mobile docs async copy current interface state", mobileDoc, "Async write-failure, delayed-guard, settings-read/write success, and retained-data import status copy must use the current Simple/Advanced interface state at message time");
assertContains("mobile docs simple control readback no false success", mobileDoc, "Simple must show success only when fresh mode/fault readback matches the expected transition");
assertContains("mobile docs simple command unknown fault not alert", mobileDoc, "Simple command-result alerts require an exact nonzero fault enum");
assertContains("mobile docs advanced control readback no false success", mobileDoc, "Advanced command messages must also avoid implying success when readback does not verify the requested transition");
assertContains("mobile docs simple setup readback no false success", mobileDoc, "water-column setup start success only when fresh calibration-status readback reports active water mode");
assertContains("mobile docs final setup saved requires exact completion readback", mobileDoc, "show final setup-saved success only when the final fresh readback reports `state=water-done`, `capturedPoints=17`, and `curveValid=true`");
assertContains("mobile docs setup panel saved predicate", mobileDoc, "only from a non-active 17-point saved water setup");
assertContains("mobile docs simple setup no pressure map wording", mobileDoc, "do not expose pressure-map wording in Simple");
assertContains("mobile docs about-only mode selector", mobileDoc, "tuck the builder selector away in a collapsed About > Builder settings disclosure");
assertContains("mobile docs simple quiet start setup", mobileDoc, "avoid preemptive readiness/failure explanations in Simple");
assertContains("mobile docs simple about project URL", mobileDoc, "public `https://ozealis.org/` CPAP/BiPAP project");
assertContains("mobile simple about open project action", mobileApp, "Open ozealis.org");
assertContains("mobile simple home no preemptive start blocker", mobileApp, "Pair your Ozealis device when ready.");
assertAbsent("mobile simple home alert blocker removed", mobileApp, "Review the alert before starting airflow.");
assertAbsent("mobile simple home review-alert copy removed", mobileApp, "review the alert before changing settings");
assertContains("mobile docs simple pairing data boundary", mobileDoc, "pairing copy does not show the raw BLE service UUID or platform device ID");
assertContains("mobile docs simple pairing title", mobileDoc, "Simple pairing uses `Pair device`");
assertContains("mobile docs simple data day labels", mobileDoc, "Data shows `Here's your data`, day choices appear only once data exists");
assertContains("mobile docs simple data elapsed labels", mobileDoc, "uses elapsed-data labels such as `Latest day` and `Previous day` instead of calendar-date claims");
assertContains("mobile docs advanced data driver FG graph", mobileDoc, "driver FG tach graphs");
assertContains("mobile docs simple data avoids latest warnings", mobileDoc, "latest-data warnings");
assertContains("mobile docs simple data waits for actual failure", mobileDoc, "suggesting data-update failures until an update actually fails");
assertContains("mobile docs simple data empty state", mobileDoc, "pressure and airflow graphs will appear here");
assertContains("mobile simple data update action", mobileApp, "label=\"Update\" onPress={readLogs}");
assertAbsent("mobile simple data refresh action removed", mobileApp, "Refresh data");
assertContains("mobile docs simple data update action", mobileDoc, "an `Update` action after the data/empty state");
assertContains("mobile docs delayed water setup recheck", mobileDoc, "re-check the checklist inside the delayed confirmation callback");
assertContains("mobile docs calibration unaccepted readback", mobileDoc, "accepted starts, unaccepted starts, accepted captures");
assertContains("mobile water calibration ruler checklist item", mobileApp, "20 cm+ ruler zeroed at resting waterline");
assertContains("mobile water calibration simple start requires checklist", mobileApp, "const simpleWaterStartDisabled");
assertContains("mobile water calibration advanced start requires checklist", mobileApp, "disabled={!calibrationStartAllowed || !waterSetupReady || busy}");
assertContains("mobile water calibration simple start hidden until ready", mobileApp, "!advancedMode && showSimpleWaterStart");
assertContains("mobile water calibration abort disabled while inactive", mobileApp, "disabled={!calibrationAbortAllowed || busy}");
assertContains("mobile water calibration setup confirmation", mobileApp, "Confirm water-column setup");
assertContains("mobile water calibration target capture label", mobileApp, "Capture ${calibration.targetCm} cm");
assertContains("mobile water calibration target prompt", mobileApp, "Current target:");
assertContains("mobile water calibration target ladder", mobileApp, "waterColumnTargets.map((target)");
assertContains("mobile water calibration target ladder status", mobileApp, "captured, current, and pending");
assertContains("mobile water calibration sensor trim display", mobileApp, "Sensor trim");
assertContains("mobile water calibration sensor trim status display", mobileApp, "calibration.sensorTrimStatus");
assertContains("mobile start handler full gate", mobileApp, "command === \"start\" && !controlStartAllowed");
assertContains("mobile calibration handler full gate", mobileApp, "(command === \"start\" || command === \"waterStart\") && !calibrationStartAllowed");
assertContains("mobile driver readiness alert", mobileApp, "verified I2C speed-command readback or an explicit bench PWM fallback build");
assertContains("mobile docs driver readiness alert", mobileDoc, "verified I2C speed-command readback or an explicit bench PWM fallback build");
assertContains("mobile calibration MCF snapshot simple setup copy", mobileApp, ": \"Use standby to start setup.\",\n          writeDevice,\n        ))");
assertContains("mobile calibration tab", mobileApp, "Motor Calibration");
assertContains("protocol docs calibration command", protocolDoc, "Motor calibration command JSON");
assertContains("protocol docs water calibration command", protocolDoc, "\"command\": \"waterStart\"");
assertContains("protocol docs water calibration capture", protocolDoc, "\"command\": \"capture\"");
assertContains("protocol docs water calibration capture guard", protocolDoc, "strictly above the previous captured point");
assertContains("protocol docs water calibration curve", protocolDoc, "17-point pressure response map");
assertContains("protocol docs water calibration sensor trim", protocolDoc, "averaged differential sensor trim commits successfully");
assertContains("protocol docs water capture trim atomicity", protocolDoc, "failed trim sample leaves the same target pending, backs off command for another dwell window, and does not count a pressure-map point");
assertContains("protocol docs water final curve requires trim commit", protocolDoc, "stores a nonlinear 17-point pressure response map only after the averaged differential sensor trim commits successfully");
assertContains("protocol docs water calibration sensor trim status", protocolDoc, "\"sensorTrimHpa\"");
assertContains("protocol docs water calibration sensor trim requires all samples", protocolDoc, "all 17 no-flow samples");
assertContains("protocol docs water calibration sensor trim status field", protocolDoc, "\"sensorTrimStatus\"");
assertContains("protocol docs calibration start idle and fault guard", protocolDoc, "Firmware accepts calibration `start` and `waterStart` only while the system is idle, the reported fault code is `0`");
assertContains("protocol docs app start explicit clear driver fault", protocolDoc, "explicit clear driver fault before enabling start");
assertContains("protocol docs button latched-fault publish rule", protocolDoc, "short-press start ignored because a fault is already latched also publishes the unchanged state");
assertContains("protocol docs app calibration explicit clear driver fault", protocolDoc, "explicit clear driver fault before enabling calibration start");
assertContains("protocol docs start requires speed command transport", protocolDoc, "the speed-command transport is enabled, and the MCF8316D motor driver responds on I2C");
assertContains("protocol docs start commandReady snapshot", protocolDoc, "MCF8316D snapshot to report `commandReady=true` after cross-checking I2C presence, target speed, runtime speed");
assertContains("protocol docs calibration requires speed command transport", protocolDoc, "calibration `start` and `waterStart` only while the system is idle, the reported fault code is `0`, no calibration sweep is already active, the speed-command transport is enabled");
assertContains("protocol docs calibration commandReady snapshot", protocolDoc, "MCF8316D snapshot to report `commandReady=true` after cross-checking I2C presence, target speed, runtime speed, and an explicit clear driver fault before enabling calibration start");
assertContains("protocol docs calibration fresh pressure start gate", protocolDoc, "Firmware calibration entry also requires a fresh complete pressure read from both pressure sensors");
assertContains("protocol docs calibration capture active-only", protocolDoc, "`capture` is accepted only during an active water-column sweep");
assertContains("protocol docs calibration abort active-only", protocolDoc, "`abort` is accepted only during an active calibration sweep");
assertContains("protocol docs calibration immediate notifications", protocolDoc, "Valid calibration command-object writes update and notify the calibration-status characteristic immediately");
assertContains("protocol docs calibration start-like unavailable no-op", protocolDoc, "Start-like commands sent while running, faulted, shutting down, starting, calibrating");
assertContains("protocol docs calibration start-like unavailable notify", protocolDoc, "ignored after notifying the unchanged calibration status");
assertContains("protocol docs calibration start driver-command-pressure guard", protocolDoc, "If the driver, command transport, or fresh pressure read is not ready before or during the sweep");
assertContains("protocol docs malformed calibration no-op", protocolDoc, "unknown calibration commands are ignored with a serial diagnostic, no calibration status notification, and no calibration state change");
assertContains("protocol docs calibration command-unit compatibility", protocolDoc, "represent bounded driver command units");
assertContains("motor calibration docs fresh pressure start gate", motorCalibrationDoc, "Calibration entry requires a fresh complete pressure read from both LPS22 sensors");
assertContains("motor calibration docs fault abort", motorCalibrationDoc, "any firmware fault aborts an active calibration sweep");
assertContains("motor calibration docs calibration fault-code gate", motorCalibrationDoc, "the reported fault code is `0`");
assertContains("motor calibration docs speed command gate", motorCalibrationDoc, "the speed-command transport is enabled");
assertContains("motor calibration docs module command-ready gate", motorCalibrationDoc, "calibration module also checks command readiness");
assertContains("motor calibration docs active service command-ready gate", motorCalibrationDoc, "re-checks command readiness when servicing an active sweep");
assertContains("motor calibration docs pressure acquisition abort", motorCalibrationDoc, "marks calibration `sensor-error` if a pressure sample or ambient estimate cannot be read");
assertContains("motor calibration docs capture active water only", motorCalibrationDoc, "`capture` is only meaningful during an active water-column sweep");
assertContains("motor calibration docs abort active only", motorCalibrationDoc, "`abort` is only meaningful during an active calibration sweep");
assertContains("motor calibration docs driver failure abort", motorCalibrationDoc, "driver-readiness failure");
assertContains("motor calibration docs pressure failure abort", motorCalibrationDoc, "pressure-acquisition failure");
assertContains("motor calibration docs session export trace", motorCalibrationDoc, "normal session CSV row once per second");
assertContains("motor calibration docs session FG tach trace", motorCalibrationDoc, "`motorFgHz` FG tach trace");
assertContains("motor calibration docs 30 minute buffer", motorCalibrationDoc, "30 minutes of 1 Hz rows");
assertContains("motor calibration docs water-column map", motorCalibrationDoc, "Water-Column Map");
assertContains("motor calibration docs water-column setup tube", motorCalibrationDoc, "Make a U with clear CPAP tubing");
assertContains("motor calibration docs water-column setup height", motorCalibrationDoc, "at least 5 cm above the water level");
assertContains("motor calibration docs water-column setup ruler", motorCalibrationDoc, "ruler zero mark at the resting waterline");
assertContains("motor calibration docs water-column physical button", motorCalibrationDoc, "press the device button");
assertContains("motor calibration docs water-column app ladder", motorCalibrationDoc, "mobile app shows a 4-20 cmH2O capture ladder");
assertContains("motor calibration docs water-column sensor trim", motorCalibrationDoc, "averaged differential pressure sensor trim commits successfully");
assertContains("motor calibration docs water capture trim atomicity", motorCalibrationDoc, "A valid capture is atomic");
assertContains("motor calibration docs failed trim sample retry", motorCalibrationDoc, "the point is not counted, command backs off for another dwell window, and the operator must retry at the same mark");
assertContains("motor calibration docs final curve requires trim commit", motorCalibrationDoc, "stores the 17-point nonlinear map only after the averaged differential pressure sensor trim commits successfully");
assertContains("motor calibration docs finite numeric status", motorCalibrationDoc, "keeps numeric JSON fields finite even when tach, trim, pressure, or gain evidence is unavailable");
assertContains("motor calibration docs water-column trim applied", motorCalibrationDoc, "subtract the persisted trim from the blower-side sensor");
assertContains("motor calibration docs stored profile tach review", motorCalibrationDoc, "retained `motorFgHz` trace for tach sanity review");
assertContains("motor calibration docs water-column trim status values", motorCalibrationDoc, "`too-few-samples`");
assertContains("motor calibration docs persisted profile untrusted", motorCalibrationDoc, "persisted motor calibration is treated as untrusted input");
assertContains("motor calibration docs rejected profile writeback", motorCalibrationDoc, "writes the sanitized profile back to NVS");
assertContains("motor calibration docs rejected trim writeback", motorCalibrationDoc, "writes `diffValid=false`, `diffTrim=0`, and `diffSamples=0` back to the `sensorcal` namespace");
assertContains("motor calibration docs rejects partial curve blobs", motorCalibrationDoc, "partial curve blobs");
assertContains("motor calibration docs rejects trim sample mismatch", motorCalibrationDoc, "do not have all 17 committed samples");
assertContains("motor calibration docs water-column capture guard", motorCalibrationDoc, "strictly above the previous captured point");
assertContains("motor calibration docs water-column interpolation", motorCalibrationDoc, "interpolates between saved command points");
assertContains("motor calibration docs Rev 3 motor driver link", motorCalibrationDoc, "rev3-motor-driver.md");
assertContains("firmware MCF8316D motor wrapper", firmwareMotor, "MCF8316D speed-command wrapper");
assertContains("firmware MCF8316D command pin map", firmwareMotorHeader, "MCF8316D COMMAND PIN MAP");
assertContains("firmware MCF8316D DRVOFF pin", firmwareMotorHeader, "MCF_DRVOFF_PIN");
assertContains("firmware MCF8316D fault pin", firmwareMotorHeader, "MCF_NFAULT_PIN");
assertContains("firmware MCF8316D I2C address", firmwareMotorHeader, "MCF_I2C_ADDR 0x01");
assertContains("firmware README motor driver contract", firmwareReadme, "## Motor driver contract");
assertContains("firmware README speed pin", firmwareReadme, "`MOTOR_SPEED_PWM_PIN` | GPIO 19");
assertContains("firmware README DRVOFF pin", firmwareReadme, "`MCF_DRVOFF_PIN` | GPIO 17");
assertContains("firmware README nFAULT pin", firmwareReadme, "`MCF_NFAULT_PIN` | GPIO 26");
assertContains("firmware README FG pin", firmwareReadme, "`MCF_FG_PIN` | GPIO 33");
assertContains("firmware README I2C target", firmwareReadme, "`MCF_I2C_ADDR` | `0x01`");
assertContains("firmware main serial status opt-in flag", firmwareMain, "OZEALIS_SERIAL_STATUS_LOG 0");
assertContains("firmware main serial status gated", firmwareMain, "#if OZEALIS_SERIAL_STATUS_LOG");
assertContains("firmware main boot banner behind status log flag", firmwareMain, "#if OZEALIS_SERIAL_STATUS_LOG\n  Serial.println(\"Ozealis - Booting\");\n#endif");
assertOccurrenceCount("firmware main direct Serial.println limited to status log blocks", firmwareMain, "Serial.println(", 2);
assertActiveFirmwareSerialPolicy();
assertContains("firmware motor serial log opt-in flag", firmwareMotor, "OZEALIS_MOTOR_SERIAL_LOG 0");
assertContains("firmware motor serial log macro gated", firmwareMotor, "#if OZEALIS_MOTOR_SERIAL_LOG");
assertContains("firmware button serial log opt-in flag", firmwareButton, "OZEALIS_BUTTON_SERIAL_LOG 0");
assertContains("firmware button serial log macro gated", firmwareButton, "#if OZEALIS_BUTTON_SERIAL_LOG");
assertContains("firmware module serial log opt-in flag", firmwareModules, "OZEALIS_MODULE_SERIAL_LOG 0");
assertContains("firmware module serial log macro gated", firmwareModules, "#if OZEALIS_MODULE_SERIAL_LOG");
assertContains("firmware module accessory register contract", firmwareModules, "Accessory telemetry contract: 0x01..0x04 = centi-C then centi-%RH.");
assertContains("firmware module reserved address contract", firmwareModulesHeader, "Ozealis reserved accessory range");
assertAbsent("firmware module implementation has no example scaffold comment", firmwareModules, "example");
assertAbsent("firmware module header has no example scaffold comment", firmwareModulesHeader, "example");
assertContains("firmware sensor serial log opt-in flag", firmwareSensor, "OZEALIS_SENSOR_SERIAL_LOG 0");
assertContains("firmware sensor serial log macro gated", firmwareSensor, "#if OZEALIS_SENSOR_SERIAL_LOG");
assertContains("firmware LED serial log opt-in flag", firmwareLed, "OZEALIS_LED_SERIAL_LOG 0");
assertContains("firmware LED serial log macro gated", firmwareLed, "#if OZEALIS_LED_SERIAL_LOG");
assertContains("firmware LED uses ESP32 RMT peripheral", firmwareLed, "#include <driver/rmt.h>");
assertContains("firmware LED RMT clock gives 10 MHz timing", firmwareLed, "config.clk_div = 8;");
assertContains("firmware LED uses blocking RMT write", firmwareLed, "rmt_write_items(kLedRmtChannel, items, (int)itemCount, true)");
assertAbsent("firmware LED removes timing-unsafe bit banging", firmwareLed, "static void IRAM_ATTR writeBit");
assertAbsent("firmware pairing end does not force idle blue", firmwareLed, "LED: BT pairing ended, resetting");
assertContains("firmware PlatformIO core debug quiet", firmwarePlatformio, "CORE_DEBUG_LEVEL=0");
assertContains("firmware README core debug quiet", firmwareReadme, "CORE_DEBUG_LEVEL=0");
assertAbsent("checked-in firmware envs do not enable core info debug", firmwarePlatformio, "CORE_DEBUG_LEVEL=1");
assertContains("firmware README serial status opt-in", firmwareReadme, "OZEALIS_SERIAL_STATUS_LOG=1");
assertContains("firmware README motor serial opt-in", firmwareReadme, "OZEALIS_MOTOR_SERIAL_LOG=1");
assertContains("firmware README button serial opt-in", firmwareReadme, "OZEALIS_BUTTON_SERIAL_LOG=1");
assertContains("firmware README module serial opt-in", firmwareReadme, "OZEALIS_MODULE_SERIAL_LOG=1");
assertContains("firmware README sensor serial opt-in", firmwareReadme, "OZEALIS_SENSOR_SERIAL_LOG=1");
assertContains("firmware README LED serial opt-in", firmwareReadme, "OZEALIS_LED_SERIAL_LOG=1");
assertAbsent("checked-in firmware envs do not enable serial status spam", firmwarePlatformio, "OZEALIS_SERIAL_STATUS_LOG=1");
assertAbsent("checked-in firmware envs do not enable motor serial spam", firmwarePlatformio, "OZEALIS_MOTOR_SERIAL_LOG=1");
assertAbsent("checked-in firmware envs do not enable button serial spam", firmwarePlatformio, "OZEALIS_BUTTON_SERIAL_LOG=1");
assertAbsent("checked-in firmware envs do not enable module serial spam", firmwarePlatformio, "OZEALIS_MODULE_SERIAL_LOG=1");
assertAbsent("checked-in firmware envs do not enable sensor serial spam", firmwarePlatformio, "OZEALIS_SENSOR_SERIAL_LOG=1");
assertAbsent("checked-in firmware envs do not enable LED serial spam", firmwarePlatformio, "OZEALIS_LED_SERIAL_LOG=1");
assertAbsent("firmware LED default serial pairing print removed", firmwareLed, "Serial.println(\"LED: BT pairing ended, resetting\")");
assertAbsent("firmware buzzer stays quiet on serial", firmwareBuzzer, "Buzzer: playing");
assertContains("firmware README default speed readback", firmwareReadme, "Default firmware uses the Rev 3 D-variant I2C speed-command path");
assertContains("firmware README bench PWM opt-in", firmwareReadme, "OZEALIS_BENCH_PWM_SPEED_FALLBACK=1");
assertContains("firmware README bench PWM disables I2C", firmwareReadme, "OZEALIS_MCF8316D_I2C_SPEED=0");
assertContains("firmware README bench PWM env", firmwareReadme, "esp32dev_bench_pwm");
assertContains("firmware PWM command implementation", firmwareMotor, "ledc_set_duty(MOTOR_PWM_MODE, MOTOR_SPEED_CH, g_commandProxy);");
assertContains("firmware motor fault API", firmwareMotorHeader, "bool motorFaultActive();");
assertContains("firmware motor I2C API", firmwareMotorHeader, "bool motorDriverI2cPresent();");
assertContains("firmware motor FG pin default", firmwareMotorHeader, "# define MCF_FG_PIN 33");
assertContains("firmware motor FG API", firmwareMotorHeader, "float motorGetFgHz();");
assertContains("firmware motor FG interrupt", firmwareMotor, "attachInterrupt(digitalPinToInterrupt(MCF_FG_PIN), mcfFgISR, FALLING);");
assertContains("firmware motor driver-ready API", firmwareMotorHeader, "bool motorDriverReady();");
assertContains("firmware motor driver-ready comment", firmwareMotorHeader, "Command readiness, not just chip presence");
assertContains("firmware motor clear-fault API", firmwareMotorHeader, "bool motorClearFault();");
assertContains("firmware motor fault latches nFAULT", firmwareMotor, "g_faultLatched = true;");
assertContains("firmware motor probes I2C", firmwareMotor, "Wire.beginTransmission(MCF_I2C_ADDR)");
assertContains("firmware motor I2C telemetry re-probes", firmwareMotor, "bool motorDriverI2cPresent() {\n  return probeDriverI2c();");
assertContains("firmware motor blocks missing I2C start", firmwareMotor, "MCF not ready, start ignored");
assertContains("firmware motor readiness helper", firmwareMotor, "bool motorDriverReady()");
assertContains("firmware motor readiness re-probes I2C", firmwareMotor, "if (!probeDriverI2c())");
assertContains("firmware motor nonzero command readiness guard", firmwareMotor, "if (amp > 0 && !motorDriverReady()) {\n    stopMotor();\n    return;\n  }");
assertContains("firmware motor clear-fault helper", firmwareMotor, "bool motorClearFault()");
assertContains("firmware motor clear-fault revalidates zero command", firmwareMotor, "g_i2cSpeedReadbackValid = writeI2cSpeedCommand(0);");
assertContains("firmware motor clear-fault rejects failed command readback", firmwareMotor, "if (!g_i2cSpeedReadbackValid) return false;");
assertContains("firmware motor clear-fault clears software latch last", firmwareMotor, "g_faultLatched = false;\n  return true;");
assertContains("firmware motor fault system check", firmwareLogic, "motorFaultActive()");
assertContains("firmware motor fault maps to FAULT_IO", firmwareLogic, "triggerFault(FAULT_IO);");
assertContains("firmware fault log motor command", firmwareDiag, "motorCmd");
assertContains("firmware fault log motor fault", firmwareDiag, "motorFault");
assertContains("firmware fault log motor I2C", firmwareDiag, "motorI2c");
assertContains("firmware fault log motor FG", firmwareDiag, "motorFgHz");
assertContains("Rev 3 motor driver chosen part", rev3MotorDriverDoc, "MCF8316DVRGFR");
assertContains("Rev 3 motor driver JLCPCB part", rev3MotorDriverDoc, "C47122159");
assertContains("Rev 3 motor driver code-free FOC", rev3MotorDriverDoc, "code-free sensorless FOC");
assertContains("Rev 3 motor driver removes old path", rev3MotorDriverDoc, "removes the discrete phase-drive firmware path");
assertContains("Rev 3 motor driver schematic checklist", rev3MotorDriverDoc, "Schematic Integration Checklist");
assertContains("Rev 3 motor driver removes LM339 path", rev3MotorDriverDoc, "LM339 BEMF comparator network");
assertContains("Rev 3 motor driver SDA route", rev3MotorDriverDoc, "GPIO 21 / `Wire` SDA");
assertContains("Rev 3 motor driver SCL route", rev3MotorDriverDoc, "GPIO 22 / `Wire` SCL");
assertContains("Rev 3 motor driver DRVOFF route", rev3MotorDriverDoc, "GPIO 17 / `MCF_DRVOFF_PIN`");
assertContains("Rev 3 motor driver nFAULT route", rev3MotorDriverDoc, "GPIO 26 / `MCF_NFAULT_PIN`");
assertContains("Rev 3 motor driver FG route", rev3MotorDriverDoc, "GPIO 33 / `MCF_FG_PIN`");
assertContains("Rev 3 motor command readiness wrapper doc", rev3MotorDriverDoc, "re-check driver readiness inside the motor command wrapper before accepting any nonzero command");
assertContains("Rev 3 motor driver speed wake route", rev3MotorDriverDoc, "GPIO 19 / `MOTOR_SPEED_PWM_PIN`");
assertContains("Rev 3 motor driver VM bypass", rev3MotorDriverDoc, "`0.1 uF` X7R from `VM` to `PGND`");
assertContains("Rev 3 motor driver VM local bulk", rev3MotorDriverDoc, "`100 uF` to `470 uF` at 35 V or higher");
assertContains("Rev 3 motor driver CP cap", rev3MotorDriverDoc, "`1 uF` X7R, 16 V from `CP` to `VM`");
assertContains("Rev 3 motor driver charge pump cap", rev3MotorDriverDoc, "`47 nF` X7R from `CPH` to `CPL`");
assertContains("Rev 3 motor driver AVDD bypass", rev3MotorDriverDoc, "`1 uF` X7R, at least 10 V from `AVDD` to `AGND`");
assertContains("Rev 3 motor driver AVDD effective capacitance", rev3MotorDriverDoc, "effective capacitance remains about `0.7 uF` to `1.3 uF`");
assertContains("Rev 3 motor driver AVDD not ESP32 supply", rev3MotorDriverDoc, "Do not power the ESP32 from `AVDD`");
assertContains("Rev 3 motor driver DVDD bypass", rev3MotorDriverDoc, "`1 uF` X7R, at least 6.3 V from `DVDD` to `DGND`");
assertContains("Rev 3 motor driver DVDD effective capacitance", rev3MotorDriverDoc, "effective capacitance remains about `0.7 uF` to `2.5 uF`");
assertContains("Rev 3 motor driver DVDD local-only", rev3MotorDriverDoc, "do not power external loads from `DVDD`");
assertContains("Rev 3 motor driver buck resistor mode", rev3MotorDriverDoc, "`22 ohm` from `SW_BK` to `FB_BK`");
assertContains("Rev 3 motor driver buck capacitor", rev3MotorDriverDoc, "`22 uF` X7R from `FB_BK` to `GND_BK`");
assertContains("Rev 3 motor driver buck not ESP32 supply", rev3MotorDriverDoc, "do not power the ESP32, pressure sensors, BLE module, display, or other board loads from this rail");
assertContains("Rev 3 motor driver buck no board loads", rev3MotorDriverDoc, "pressure sensors, BLE module, display, or other board loads");
assertContains("Rev 3 motor driver buck 47 uH load option", rev3MotorDriverDoc, "`47 uH` inductor for up to 170 mA");
assertContains("Rev 3 motor driver buck 22 uH load option", rev3MotorDriverDoc, "`22 uH` for up to 20 mA");
assertContains("Rev 3 motor driver I2C pullups", rev3MotorDriverDoc, "`5.1 kOhm` from `SDA` to 3.3 V");
assertContains("Rev 3 motor driver fault pullup", rev3MotorDriverDoc, "`5.1 kOhm` from `nFAULT` to 3.3 V");
assertContains("Rev 3 motor driver DIR fixed", rev3MotorDriverDoc, "Tie `DIR` to `AGND` or `AVDD`");
assertContains("Rev 3 motor driver BRAKE fixed", rev3MotorDriverDoc, "Tie `BRAKE` low for normal operation");
assertContains("Rev 3 motor driver DRVOFF reset pullup", rev3MotorDriverDoc, "local pullup to the driver logic rail so reset and ESP32 boot states hold the MCF8316D outputs disabled");
assertAbsent("Rev 3 motor driver must not recommend DRVOFF pulldown", rev3MotorDriverDoc, "DRVOFF` to GPIO 17 and consider a local pulldown");
assertContains("Rev 3 motor driver phase outputs", rev3MotorDriverDoc, "`OUTA`, `OUTB`, and `OUTC` directly to the three blower phases");
assertContains("Rev 3 motor driver test pads", rev3MotorDriverDoc, "Add test pads for `VM`, 3.3 V, `FB_BK`, `AVDD`, `DVDD`");
assertContains("Rev 3 motor driver release FG test point", rev3MotorDriverDoc, "phase outputs, `nFAULT`, `FG`, I2C");
assertContains("Rev 3 motor driver EasyEDA note", rev3MotorDriverDoc, "EasyEDA Copilot schematic note");
assertContains("Rev 3 motor driver VM pin numbers", rev3MotorDriverDoc, "`VM` pins 9/10/11");
assertContains("Rev 3 motor driver PGND pin numbers", rev3MotorDriverDoc, "`PGND` pins 12/15/18");
assertContains("Rev 3 motor driver OUTA pin numbers", rev3MotorDriverDoc, "`OUTA` pins 13/14");
assertContains("Rev 3 motor driver OUTB pin numbers", rev3MotorDriverDoc, "`OUTB` pins 16/17");
assertContains("Rev 3 motor driver OUTC pin numbers", rev3MotorDriverDoc, "`OUTC` pins 19/20");
assertContains("Rev 3 motor driver copyable schematic contract", rev3MotorDriverDoc, "Copyable schematic contract for EasyEDA Copilot");
assertContains("Rev 3 motor driver schematic contract legacy removal", rev3MotorDriverDoc, "Replace the legacy BLDC driver, LM339 BEMF network");
assertContains("Rev 3 motor driver schematic contract DRVOFF pin", rev3MotorDriverDoc, "DRVOFF -> ESP32 GPIO17 / MCF_DRVOFF_PIN");
assertContains("Rev 3 motor driver schematic contract nFAULT pin", rev3MotorDriverDoc, "nFAULT -> ESP32 GPIO26 / MCF_NFAULT_PIN");
assertContains("Rev 3 motor driver schematic contract optional speed path", rev3MotorDriverDoc, "SPEED/WAKE -> optional ESP32 GPIO19 / MOTOR_SPEED_PWM_PIN");
assertContains("Rev 3 motor driver nFAULT behavior", rev3MotorDriverDoc, "treat asserted `nFAULT` as firmware `FAULT_IO`");
assertContains("Rev 3 motor driver I2C probe behavior", rev3MotorDriverDoc, "re-probe before any motor start or calibration sweep");
assertContains("Rev 3 motor driver D I2C speed target", rev3MotorDriverDoc, "I2C speed command as the Rev 3 D-variant target");
assertContains("Rev 3 motor driver default speed disabled", rev3MotorDriverDoc, "refuse nonzero motor command in default builds");
assertContains("Rev 3 motor driver bench PWM opt-in", rev3MotorDriverDoc, "OZEALIS_BENCH_PWM_SPEED_FALLBACK=1");
assertContains("Rev 3 motor driver D readback gate", rev3MotorDriverDoc, "D-specific `ALGO_DEBUG1` `DIGITAL_SPEED_CTRL` field");
assertContains("Rev 3 motor driver parameter write gate", rev3MotorDriverDoc, "Parameter writes must be idle-only");
assertContains("Rev 3 motor driver read-only commissioning surface", rev3MotorDriverDoc, "read-only as `0032` MCF8316D parameter snapshot");
assertContains("Rev 3 motor driver parameter export plan", rev3MotorDriverDoc, "BLE readback/export path");
assertContains("Rev 3 motor driver commissioning link", rev3MotorDriverDoc, "mcf8316d-commissioning.md");
assertContains("Rev 3 motor driver SLLA662 reference", rev3MotorDriverDoc, "TI SLLA662");
assertContains("Rev 3 motor driver I2C future transaction note", rev3MotorDriverDoc, "Future register reads/writes should follow TI application note SLLA662");
assertContains("Rev 3 motor driver bring-up link", rev3MotorDriverDoc, "mcf8316d-bringup.md");
assertContains("top README MCF motor summary", topReadme, "MCF8316D-style sensorless FOC driver readiness and fault handling");
assertContains("top README Rev 3 motor driver link", topReadme, "docs/rev3-motor-driver.md");
assertContains("top README MCF bring-up link", topReadme, "docs/mcf8316d-bringup.md");
assertContains("top README MCF commissioning link", topReadme, "docs/mcf8316d-commissioning.md");
assertContains("top README MCF register manifest link", topReadme, "docs/mcf8316d-register-manifest.json");
assertAbsent("top README stale DRV8313 active path", topReadme, "Motor startup/control code for the DRV8313 path");
assertContains("firmware README bring-up link", firmwareReadme, "../../docs/mcf8316d-bringup.md");
assertContains("firmware README button explicit clear latch", firmwareReadme, "respond on I2C with the fault latch clear");
assertContains("release checklist evidence boundary heading", releaseChecklistDoc, "## Evidence boundary");
assertContains("release checklist source gate scope", releaseChecklistDoc, "The local source-release gate proves repository consistency only");
assertContains("release checklist no source-only broad claim", releaseChecklistDoc, "Do not convert a source-only passing gate into a broader release claim");
assertContains("release checklist hardware evidence artifacts", releaseChecklistDoc, "firmware hash, app build identifier, photos or screenshots");
assertContains("release checklist bring-up artifact item", releaseChecklistDoc, "MCF8316D bench bring-up checklist completed");
assertContains("release checklist mobile fresh write gates", releaseChecklistDoc, "Mobile app sensitive-write gates verified to reread fresh device state before writes");
assertContains("release checklist retained-log clear header-only readback", releaseChecklistDoc, "only canonical header-only retained-session and fault CSV readbacks are shown as cleared");
assertContains("release checklist retained-log clear preserves stored data", releaseChecklistDoc, "empty, malformed, live-format, swapped, or foreign readbacks do not erase the app's stored latest-data copy");
assertContains("release checklist retained-log clear preserves live trace", releaseChecklistDoc, "or app-side live 10 Hz trace");
assertContains("release checklist retained-log clear rows-present expected family", releaseChecklistDoc, "post-clear \"rows still present\" copy requires rows in the expected retained-session or fault readback family");
assertContains("release checklist mobile simple mode UX", releaseChecklistDoc, "Mobile app default Simple mode verified on a phone-sized viewport");
assertContains("release checklist mobile prewarm UX", releaseChecklistDoc, "Mobile prewarm UX verified on a phone-sized viewport");
assertContains("release checklist simple prewarm visible", releaseChecklistDoc, "Simple Home shows active prewarm as `Prewarming`");
assertContains("release checklist prewarm schedule wait invariant", releaseChecklistDoc, "records the run only when it is about to send the verified command");
assertContains("release checklist mobile simple setup UX", releaseChecklistDoc, "Mobile Simple Setup verified on a phone-sized viewport");
assertContains("release checklist app version advanced-only", releaseChecklistDoc, "builder diagnostics and the app version/build identifier only in Advanced mode");
assertContains("release checklist simple setup hidden gates", releaseChecklistDoc, "unavailable setup actions stay hidden until the verified gates and physical checklist are complete");
assertContains("release checklist simple setup plain actions", releaseChecklistDoc, "plain `Start setup`/`Capture mark`/`Stop setup` actions");
assertContains("release checklist simple setup saved copy", releaseChecklistDoc, "completion says `Setup saved.`");
assertContains("release checklist simple setup advanced-only internals", releaseChecklistDoc, "pressure-map, sensor-trim, calibration-status, FG tach, session CSV, and MCF8316D snapshot details stay Advanced-only");
assertContains("release checklist simple data restart persistence", releaseChecklistDoc, "Mobile Simple Data verified after app restart");
assertContains("release checklist simple data success row gate", releaseChecklistDoc, "Automatic stop-time import and manual Data updates only say data is ready or updated after at least one exact valid row in the expected retained-session or fault readback family");
assertContains("release checklist simple data no-new-data readbacks", releaseChecklistDoc, "empty, header-only, malformed, swapped, live-format, or foreign readbacks use no-new-data copy");
assertContains("release checklist simple data preserves current display", releaseChecklistDoc, "do not replace the current displayed latest-data copy unless they are canonical header-only clear evidence");
assertContains("release checklist mobile about selector", releaseChecklistDoc, "tuck the builder selector away in a collapsed About > Builder settings disclosure");
assertContains("release checklist mobile advanced builder diagnostics", releaseChecklistDoc, "expose builder diagnostics and the app version/build identifier only in Advanced mode");
assertContains("release checklist mobile error boundary fallback", releaseChecklistDoc, "Mobile app error-boundary fallback verified");
assertContains("release checklist mobile graph-rate evidence", releaseChecklistDoc, "Mobile pressure/airflow graphs verified against a flashed device");
assertContains("release checklist mobile live 10 Hz capture", releaseChecklistDoc, "captures and exports up to 10 Hz for the latest 60 minutes");
assertContains("release checklist mobile live spool validation", releaseChecklistDoc, "live spool survives app restart without accepting malformed rows");
assertContains("release checklist mobile graph derate evidence", releaseChecklistDoc, "before at least 10 valid fresh live rows derates graphing and observation flags to the retained 1 Hz firmware session");
assertContains("release checklist mobile observation evidence", releaseChecklistDoc, "Mobile airflow observation flags verified against retained 1 Hz and connected 10 Hz traces");
assertContains("release checklist simple observation non-diagnostic evidence", releaseChecklistDoc, "labels remain non-diagnostic airflow notes in Simple");
assertContains("release checklist advanced observation basis evidence", releaseChecklistDoc, "detailed heuristic basis stays Advanced-only");
assertContains("release checklist observation timestamp duration evidence", releaseChecklistDoc, "durations are computed from CSV timestamps with the same 10-second minimum");
assertContains("release checklist observation controller baseline evidence", releaseChecklistDoc, "central-like labels require a real pre-window controller baseline");
assertContains("release checklist mobile error boundary no command", releaseChecklistDoc, "sends no device command");
assertContains("release checklist mobile error boundary cancels BLE", releaseChecklistDoc, "cancels any active BLE connection");
assertContains("release checklist start fresh MCF snapshot", releaseChecklistDoc, "start/calibration start reread mode, fault, calibration status, and MCF8316D snapshot");
assertContains("release checklist startup no false running", releaseChecklistDoc, "accepted startup must advance to `MODE_RUNNING` only after the motor wrapper reports running");
assertContains("release checklist firmware direct mode clamp", releaseChecklistDoc, "clamp direct pressure-controller mode changes back to CPAP");
assertContains("release checklist capture abort fresh status", releaseChecklistDoc, "capture/abort reread calibration status");
assertContains("release checklist calibration fresh pressure start gate", releaseChecklistDoc, "Calibration start pressure-read gate verified");
assertContains("release checklist MCF params readback valid item", releaseChecklistDoc, "state=readback_valid");
assertContains("release checklist MCF command readiness recovery item", releaseChecklistDoc, "command-readiness recovery verified");
assertContains("release checklist default speed I2C item", releaseChecklistDoc, "runtimeSpeed=i2c");
assertContains("release checklist command ready verified item", releaseChecklistDoc, "commandReady=true");
assertContains("release checklist MCF params FG item", releaseChecklistDoc, "current `fgHz` tach estimate");
assertContains("release checklist MCF params command readback item", releaseChecklistDoc, "passive `commandAmp`/`commandPwm` readback");
assertContains("release checklist MCF params pin map item", releaseChecklistDoc, "ESP32 `speedPwm`/`drvOff`/`nFault`/`fg` pin map");
assertContains("release checklist water capture atomicity", releaseChecklistDoc, "Water-column capture atomicity verified");
assertContains("release checklist water failed trim backoff", releaseChecklistDoc, "failed trim samples leave the same mark pending with command backed off for another dwell window");
assertContains("release checklist water final trim commit", releaseChecklistDoc, "final curve is saved only after all 17 trim samples commit successfully");
assertContains("release checklist MCF clear fault CLR_FLT item", releaseChecklistDoc, "ALGO_CTRL1.CLR_FLT");
assertContains("release checklist bench PWM fallback item", releaseChecklistDoc, "OZEALIS_BENCH_PWM_SPEED_FALLBACK=1");
assertContains("release checklist bench PWM disables I2C item", releaseChecklistDoc, "OZEALIS_MCF8316D_I2C_SPEED=0");
assertContains("release checklist bench PWM env build", releaseChecklistDoc, "esp32dev_bench_pwm");
assertContains("release checklist MCF commissioning contract item", releaseChecklistDoc, "MCF8316D commissioning contract reviewed");
assertContains("release checklist MCF register manifest item", releaseChecklistDoc, "MCF8316D register manifest reviewed");
assertContains("release checklist Rev 3 schematic integration item", releaseChecklistDoc, "Rev 3 schematic reviewed against the MCF8316D integration checklist");
assertContains("release checklist Rev 3 legacy removal item", releaseChecklistDoc, "removal of the legacy LM339/BEMF path");
assertContains("release checklist Rev 3 support parts item", releaseChecklistDoc, "VM/charge-pump/AVDD/DVDD/buck support parts");
assertContains("release checklist Rev 3 test pads item", releaseChecklistDoc, "phase-output routing, and test pads");
assertContains("release checklist OTA retry item", releaseChecklistDoc, "retry after an induced failed URL or Wi-Fi failure verified");
assertContains("MCF8316D bring-up bench-only warning", mcfBringupDoc, "Do not connect the blower output to a person");
assertContains("MCF8316D bring-up schematic checklist link", mcfBringupDoc, "[Rev 3 Motor Driver](rev3-motor-driver.md)");
assertContains("MCF8316D bring-up surrounding components", mcfBringupDoc, "VM bypass, charge-pump capacitors, AVDD/DVDD bypass, buck support parts, I2C/fault pullups, and phase-output test access");
assertContains("MCF8316D bring-up command pin", mcfBringupDoc, "MOTOR_SPEED_PWM_PIN");
assertContains("MCF8316D bring-up default speed readback", mcfBringupDoc, "Default firmware uses the Rev 3 D-variant I2C speed command path");
assertContains("MCF8316D bring-up bench PWM opt-in", mcfBringupDoc, "OZEALIS_BENCH_PWM_SPEED_FALLBACK=1");
assertContains("MCF8316D bring-up bench PWM disables I2C", mcfBringupDoc, "OZEALIS_MCF8316D_I2C_SPEED=0");
assertContains("MCF8316D bring-up bench PWM env", mcfBringupDoc, "esp32dev_bench_pwm");
assertContains("MCF8316D bring-up future I2C target", mcfBringupDoc, "D-variant I2C speed command path");
assertContains("MCF8316D bring-up DRVOFF pin", mcfBringupDoc, "MCF_DRVOFF_PIN");
assertContains("MCF8316D bring-up nFAULT pin", mcfBringupDoc, "MCF_NFAULT_PIN");
assertContains("MCF8316D bring-up I2C target", mcfBringupDoc, "MCF_I2C_ADDR");
assertContains("MCF8316D bring-up default target address", mcfBringupDoc, "`0x01`");
assertContains("MCF8316D bring-up fault clear command", mcfBringupDoc, "{clearMotorFault:1}");
assertContains("MCF8316D bring-up fault clear CLR_FLT", mcfBringupDoc, "writes the MCF8316D `CLR_FLT` bit");
assertContains("MCF8316D bring-up FAULT_IO tests", mcfBringupDoc, "FAULT_IO");
assertContains("MCF8316D bring-up alarm after motor command removed", mcfBringupDoc, "motor command is removed before the audible alarm sequence begins");
assertContains("MCF8316D bring-up active sweep driver fault test", mcfBringupDoc, "interrupt driver I2C");
assertContains("MCF8316D bring-up calibration session CSV retention", mcfBringupDoc, "retains up to 30 minutes");
assertContains("MCF8316D bring-up water-column flow", mcfBringupDoc, "capture with the physical button");
assertContains("MCF8316D bring-up water-column setup", mcfBringupDoc, "keep the machine at least 5 cm above the water level");
assertContains("MCF8316D bring-up water-column sensor trim", mcfBringupDoc, "persist the blower-minus-mask differential sensor trim");
assertContains("MCF8316D bring-up live CSV I2C field", mcfBringupDoc, "motor_i2c");
assertContains("MCF8316D bring-up live CSV fault field", mcfBringupDoc, "motor_fault");
assertContains("MCF8316D bring-up live CSV FG field", mcfBringupDoc, "motor_fg_hz");
assertContains("MCF8316D bring-up retained/fault FG header", mcfBringupDoc, "`motorI2c`, `motorFault`, and `motorFgHz`");
assertContains("MCF8316D bring-up periodic I2C probe note", mcfBringupDoc, "periodic target probe");
assertContains("MCF8316D bring-up immediate readiness probe note", mcfBringupDoc, "immediate readiness probes");
assertContains("MCF8316D bring-up parameter snapshot readback valid", mcfBringupDoc, "state=readback_valid");
assertContains("MCF8316D bring-up readback recovery", mcfBringupDoc, "reread the MCF8316D snapshot while the blower is stopped");
assertContains("MCF8316D bring-up commissioning link", mcfBringupDoc, "mcf8316d-commissioning.md");
assertContains("MCF8316D bring-up SLLA662 reference", mcfBringupDoc, "TI SLLA662");
assertContains("MCF8316D commissioning EEPROM read command", mcfCommissioningDoc, "0x40000000");
assertContains("MCF8316D commissioning EEPROM read register", mcfCommissioningDoc, "0x0000EA");
assertContains("MCF8316D commissioning shadow range start", mcfCommissioningDoc, "0x000080");
assertContains("MCF8316D commissioning shadow range end", mcfCommissioningDoc, "0x0000AE");
assertContains("MCF8316D commissioning MPET motor resistance", mcfCommissioningDoc, "MOTOR_RES");
assertContains("MCF8316D commissioning MPET speed loop", mcfCommissioningDoc, "SPD_LOOP_KP");
assertContains("MCF8316D commissioning FG snapshot field", mcfCommissioningDoc, "\"fgHz\": 0.0");
assertContains("MCF8316D commissioning EEPROM security", mcfCommissioningDoc, "eeprom_key_required");
assertContains("MCF8316D commissioning write gate DRVOFF", mcfCommissioningDoc, "`DRVOFF` is asserted");
assertContains("MCF8316D commissioning no arbitrary BLE writes", mcfCommissioningDoc, "No BLE write path for arbitrary register pokes");
assertContains("MCF8316D commissioning no passcode storage", mcfCommissioningDoc, "Do not store EEPROM passcodes");
assertContains("MCF8316D commissioning manifest link", mcfCommissioningDoc, "mcf8316d-register-manifest.json");
assertMcfRegisterManifest();
assertActiveMcfVariant();
assertAbsent("firmware legacy DRV8313", firmwareMotor + firmwareMotorHeader + firmwareLogic, "DRV8313");
assertAbsent("firmware legacy BEMF symbols", firmwareMotor + firmwareMotorHeader + firmwareLogic, "bemfEdges");
assertAbsent("firmware legacy BEMF pin names", firmwareMotor + firmwareMotorHeader + firmwareLogic, "BEMF_");
assertSanitizedModeApply();
assertContains("firmware datalog row max constant", firmwareDatalog, "static constexpr size_t MAX_DATALOG_ROW_LEN = 219;");
assertContains("firmware datalog rejects null rows", firmwareDatalog, "if (!line) return;");
assertContains("firmware datalog rejects empty or long rows", firmwareDatalog, "if (len == 0 || len > MAX_DATALOG_ROW_LEN) return;");
assertContains("firmware datalog rejects newline injection", firmwareDatalog, "if (line[i] == '\\n' || line[i] == '\\r') return;");
assertContains("protocol docs datalog row injection guard", protocolDoc, "rejects empty, overlong, or newline-containing rows");
assertCsvHeader("session log", firmwareDatalog, protocolDoc, "ms,setpoint_cm,pressure_cmH2O,error_cmH2O,flowProxy_hPa,motorAmp,controller_error_cm,controller_amp,motorCmd,motorFault,motorI2c,motorFgHz");
assertCsvHeader("fault log", firmwareDiag, protocolDoc, "ts_ms,sys_mode,fault,vin_V,pMask_hPa,pBlower_hPa,ambient_hPa,diff_hPa,setpoint_cm,flowProxy_hPa,motorAmp,motorCmd,motorFault,motorI2c,motorFgHz,loop_us,miss1,miss2,i2cErr1,i2cErr2");

for (const stale of ["180F", "0000180f-0000-1000-8000-00805f9b34fb"]) {
  if (firmwareHeader.includes(stale) || appProtocol.includes(stale) || protocolDoc.includes(stale)) {
    failures.push(`stale BLE UUID remains: ${stale}`);
  }
}

if (failures.length > 0) {
  console.error("Protocol verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Protocol verification passed.");

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8");
}

function assertContains(label, source, expected) {
  if (!source.includes(expected)) failures.push(`${label} missing ${expected}`);
}

function assertExactText(label, actual, expected) {
  if (actual !== expected) failures.push(`${label} expected ${JSON.stringify(expected)}, found ${JSON.stringify(actual)}`);
}

function assertAbsent(label, source, unexpected) {
  if (source.includes(unexpected)) failures.push(`${label} still contains ${unexpected}`);
}

function assertMinimumOccurrences(label, source, expected, minimum) {
  const count = source.split(expected).length - 1;
  if (count < minimum) failures.push(`${label} expected at least ${minimum} occurrences of ${expected}, found ${count}`);
}

function assertOrder(label, source, first, second) {
  const firstIndex = source.indexOf(first);
  const secondIndex = source.indexOf(second);
  if (firstIndex === -1 || secondIndex === -1 || firstIndex > secondIndex) {
    failures.push(`${label} expected ${first} before ${second}`);
  }
}

function assertCsvTransferConnectionReset() {
  const callbacksStart = firmwareBle.indexOf("class MyServerCallbacks");
  const connectStart = firmwareBle.indexOf("void onConnect", callbacksStart);
  const disconnectStart = firmwareBle.indexOf("void onDisconnect", connectStart);
  const callbacksEnd = firmwareBle.indexOf("// ============== BLE callbacks", disconnectStart);
  if (callbacksStart < 0 || connectStart < 0 || disconnectStart < 0 || callbacksEnd < 0) {
    failures.push("firmware BLE server callback blocks could not be located");
    return;
  }
  const connectBlock = firmwareBle.slice(connectStart, disconnectStart);
  const disconnectBlock = firmwareBle.slice(disconnectStart, callbacksEnd);
  for (const [label, block] of [["connect", connectBlock], ["disconnect", disconnectBlock]]) {
    for (const expected of [
      "sessionCsvTransferCallback->resetSnapshot();",
      "faultCsvTransferCallback->resetSnapshot();",
      "publishCsvTransferError(char_logDl, \"request_required\");",
      "publishCsvTransferError(char_faultCsv, \"request_required\");",
    ]) {
      if (!block.includes(expected)) {
        failures.push(`firmware BLE ${label} must reset retained CSV state: missing ${expected}`);
      }
    }
  }
  if (!protocolDoc.includes("resets both transfer cursors") ||
      !protocolDoc.includes("on every BLE connect and disconnect")) {
    failures.push("protocol docs must describe retained-transfer reset on connect and disconnect");
  }
}

function assertMobilePackageScript(name, expected) {
  const actual = mobilePackageJson.scripts?.[name];
  if (actual !== expected) {
    failures.push(`mobile package script ${name} expected ${expected}, found ${actual || "<missing>"}`);
  }
}

function assertMobilePackageScriptAbsent(name) {
  if (Object.prototype.hasOwnProperty.call(mobilePackageJson.scripts || {}, name)) {
    failures.push(`mobile package script ${name} must stay absent; use npm run web for preview`);
  }
}

function assertMobileAppMetadata() {
  const expo = mobileAppConfigJson.expo || {};
  const blePlugin = Array.isArray(expo.plugins)
    ? expo.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === "react-native-ble-plx")
    : undefined;
  const blePluginOptions = Array.isArray(blePlugin) ? blePlugin[1] || {} : {};

  assertJsonEqual("mobile package name", mobilePackageJson.name, "ozealis-control");
  assertJsonEqual("mobile package private flag", mobilePackageJson.private, true);
  assertJsonEqual("mobile package main entry", mobilePackageJson.main, "index.ts");
  assertJsonEqual("mobile package Node engine", mobilePackageJson.engines?.node, "22.x");
  assertJsonEqual("mobile Expo name", expo.name, "Ozealis Control");
  assertJsonEqual("mobile Expo slug matches package name", expo.slug, mobilePackageJson.name);
  assertJsonEqual("mobile Expo version matches package version", expo.version, mobilePackageJson.version);
  assertJsonEqual("mobile Expo orientation", expo.orientation, "portrait");
  assertJsonEqual("mobile Expo user interface style", expo.userInterfaceStyle, "light");
  assertJsonEqual("mobile iOS bundle identifier", expo.ios?.bundleIdentifier, "org.ozealis.control");
  assertJsonEqual("mobile Android package", expo.android?.package, "org.ozealis.control");
  assertJsonEqual("mobile BLE plugin background disabled", blePluginOptions.isBackgroundEnabled, false);
  assertJsonEqual("mobile BLE plugin neverForLocation", blePluginOptions.neverForLocation, true);
  assertJsonArrayEqual("mobile BLE plugin modes", blePluginOptions.modes, ["central"]);
  assertJsonEqual(
    "mobile BLE plugin permission copy",
    blePluginOptions.bluetoothAlwaysPermission,
    "Allow Ozealis Control to connect to nearby Ozealis experimental airflow devices.",
  );
  assertJsonEqual(
    "mobile iOS Bluetooth always usage copy",
    expo.ios?.infoPlist?.NSBluetoothAlwaysUsageDescription,
    "Ozealis Control uses Bluetooth to connect to an Ozealis experimental airflow device.",
  );
  assertJsonEqual(
    "mobile iOS Bluetooth peripheral usage copy",
    expo.ios?.infoPlist?.NSBluetoothPeripheralUsageDescription,
    "Ozealis Control uses Bluetooth to connect to an Ozealis experimental airflow device.",
  );
  if (Object.prototype.hasOwnProperty.call(expo.android || {}, "permissions")) {
    failures.push("mobile Android permissions must be generated by the BLE plugin, not manually declared in app.json");
  }
  if (!Object.prototype.hasOwnProperty.call(mobilePackageJson.dependencies || {}, "expo-dev-client")) {
    failures.push("mobile package must keep expo-dev-client dependency for native BLE development builds");
  }
}

function assertMobileLockfileMetadata() {
  const rootPackage = mobilePackageLockJson.packages?.[""] || {};
  assertJsonEqual("mobile lockfile name", mobilePackageLockJson.name, mobilePackageJson.name);
  assertJsonEqual("mobile lockfile version", mobilePackageLockJson.version, mobilePackageJson.version);
  assertJsonEqual("mobile lockfile format version", mobilePackageLockJson.lockfileVersion, 3);
  assertJsonEqual("mobile lockfile root name", rootPackage.name, mobilePackageJson.name);
  assertJsonEqual("mobile lockfile root version", rootPackage.version, mobilePackageJson.version);
  assertJsonEqual("mobile lockfile root Node engine", rootPackage.engines?.node, mobilePackageJson.engines?.node);
  assertJsonObjectEqual("mobile lockfile root dependencies", rootPackage.dependencies || {}, mobilePackageJson.dependencies || {});
  assertJsonObjectEqual("mobile lockfile root devDependencies", rootPackage.devDependencies || {}, mobilePackageJson.devDependencies || {});
}

function assertCiWorkflowPermissions() {
  const lines = ciWorkflow.split(/\r?\n/);
  const permissionsIndex = lines.findIndex((line) => line === "permissions:");
  if (permissionsIndex < 0) {
    failures.push("CI workflow must declare top-level permissions");
    return;
  }
  const entries = [];
  for (let index = permissionsIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) continue;
    if (/^\S/.test(line)) break;
    const match = /^  ([A-Za-z-]+):\s*(\S+)\s*$/.exec(line);
    if (!match) {
      failures.push(`CI workflow permissions contains malformed entry: ${line.trim()}`);
      continue;
    }
    entries.push([match[1], match[2]]);
  }
  if (entries.length !== 1 || entries[0]?.[0] !== "contents" || entries[0]?.[1] !== "read") {
    failures.push("CI workflow permissions must contain only contents: read");
  }
}

function assertFirmwarePlatformioMetadata() {
  const platformio = firmwarePlatformioConfig.platformio || {};
  const defaultEnv = firmwarePlatformioConfig["env:esp32dev"] || {};
  const benchEnv = firmwarePlatformioConfig["env:esp32dev_bench_pwm"] || {};
  assertJsonEqual("firmware PlatformIO source dir", platformio.src_dir, "ozealis");
  assertJsonEqual("firmware PlatformIO default env", platformio.default_envs, "esp32dev");
  assertJsonEqual("firmware default env platform", defaultEnv.platform, "espressif32@6.13.0");
  assertJsonArrayEqual("firmware exact platform package closure", defaultEnv.platform_packages, [
    "platformio/framework-arduinoespressif32@3.20017.241212+sha.dcc1105b",
    "espressif/toolchain-xtensa-esp32@8.4.0+2021r2-patch5",
    "platformio/tool-esptoolpy@2.41100.0",
  ]);
  assertJsonEqual("firmware default env board", defaultEnv.board, "esp32dev");
  assertJsonEqual("firmware default env framework", defaultEnv.framework, "arduino");
  assertJsonEqual("firmware default env monitor speed", defaultEnv.monitor_speed, "115200");
  assertJsonEqual("firmware default env partition CSV", defaultEnv["board_build.partitions"], "min_spiffs.csv");
  assertJsonEqual("firmware default env build type", defaultEnv.build_type, "release");
  assertJsonArrayEqual("firmware exact direct/transitive library closure", defaultEnv.lib_deps, [
    "bblanchon/ArduinoJson@6.21.6",
    "adafruit/Adafruit LPS2X@2.0.6",
    "adafruit/Adafruit AHTX0@2.0.6",
    "rlogiacco/CircularBuffer@1.4.0",
    "adafruit/Adafruit Unified Sensor@1.1.15",
    "adafruit/Adafruit BusIO@1.17.4",
    "adafruit/Adafruit GFX Library@1.12.6",
    "adafruit/Adafruit SH110X@2.1.15",
  ]);
  assertArrayIncludes("firmware default env debug off flag", defaultEnv.build_flags, "-D CORE_DEBUG_LEVEL=0");
  assertArrayIncludes("firmware default env size optimization flag", defaultEnv.build_flags, "-Os");
  assertArrayIncludes("firmware default env function sections flag", defaultEnv.build_flags, "-ffunction-sections");
  assertArrayIncludes("firmware default env data sections flag", defaultEnv.build_flags, "-fdata-sections");
  assertArrayIncludes("firmware default env removes debug flag", defaultEnv.build_unflags, "-D CORE_DEBUG_LEVEL=2");
  assertJsonEqual("firmware bench PWM env extends default", benchEnv.extends, "env:esp32dev");
  assertJsonArrayEqual("firmware exact bench PWM flags", benchEnv.build_flags, [
    "${env:esp32dev.build_flags}",
    "-D OZEALIS_MCF8316D_I2C_SPEED=0",
    "-D OZEALIS_BENCH_PWM_SPEED_FALLBACK=1",
  ]);
}

function assertJsonEqual(label, actual, expected) {
  if (actual !== expected) {
    failures.push(`${label} expected ${JSON.stringify(expected)}, found ${JSON.stringify(actual)}`);
  }
}

function assertArrayIncludes(label, actual, expected) {
  if (!Array.isArray(actual) || !actual.includes(expected)) {
    failures.push(`${label} expected list to include ${JSON.stringify(expected)}, found ${JSON.stringify(actual)}`);
  }
}

function assertJsonObjectEqual(label, actual, expected) {
  if (JSON.stringify(sortObject(actual)) !== JSON.stringify(sortObject(expected))) {
    failures.push(`${label} expected ${JSON.stringify(sortObject(expected))}, found ${JSON.stringify(sortObject(actual))}`);
  }
}

function assertJsonArrayEqual(label, actual, expected) {
  if (!Array.isArray(actual) || actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    failures.push(`${label} expected ${JSON.stringify(expected)}, found ${JSON.stringify(actual)}`);
  }
}

function sortObject(value) {
  return Object.fromEntries(Object.entries(value || {}).sort(([left], [right]) => left.localeCompare(right)));
}

function parseIni(source) {
  const config = {};
  let section = "";
  let pendingKey = "";
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(";") || trimmed.startsWith("#")) {
      pendingKey = "";
      continue;
    }
    const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      section = sectionMatch[1];
      config[section] ||= {};
      pendingKey = "";
      continue;
    }
    if (!section) continue;
    if (pendingKey && /^\s+/.test(rawLine)) {
      config[section][pendingKey].push(trimmed);
      continue;
    }
    const keyValueMatch = trimmed.match(/^([^=]+?)\s*=\s*(.*)$/);
    if (keyValueMatch) {
      const key = keyValueMatch[1].trim();
      const value = keyValueMatch[2].trim();
      if (value) {
        config[section][key] = value;
        pendingKey = "";
      } else {
        config[section][key] = [];
        pendingKey = key;
      }
      continue;
    }
    pendingKey = "";
  }
  return config;
}

function assertOccurrenceCount(label, source, needle, expected) {
  const actual = source.split(needle).length - 1;
  if (actual !== expected) failures.push(`${label} expected ${expected}, found ${actual}`);
}

function assertActiveFirmwareSerialPolicy() {
  const allowedSerialLines = new Set([
    "#define BLE_LOG(message) Serial.println(message)",
    "#define BUTTON_LOG(message) Serial.println(message)",
    "#define LED_LOG(message) Serial.println(message)",
    "#define LOGIC_LOG(message) Serial.println(message)",
    "#define MODULE_LOG(message) Serial.println(message)",
    "#define MOTOR_LOG_PRINTLN(message) Serial.println(message)",
    "#define MOTOR_LOG_PRINTF(...) Serial.printf(__VA_ARGS__)",
    "#define SENSOR_LOG(message) Serial.println(message)",
    "Serial.print(\"State: mode=\");",
    "Serial.print(modeName(currentMode));",
    "Serial.print(\" fault=\");",
    "Serial.print(faultName(currentFault));",
    "Serial.print(\" last_fault=\");",
    "Serial.print(faultName(lastFault));",
    "Serial.print(\" setpoint_cm=\");",
    "Serial.print(setpoint, 2);",
    "Serial.print(\" flow_proxy=\");",
    "Serial.print(flow, 2);",
    "Serial.print(\" vin=\");",
    "Serial.print(vin, 2);",
    "Serial.println(\" V\");",
    "Serial.println(\"Ozealis - Booting\");",
  ]);

  for (const [relativePath, source] of Object.entries(activeFirmwareSerialSources)) {
    source.split(/\r?\n/).forEach((line, index) => {
      const trimmed = line.trim();
      if (!/Serial\.(?:print|println|printf)\(/.test(trimmed)) return;
      if (!allowedSerialLines.has(trimmed)) {
        failures.push(`${relativePath}:${index + 1} has ungated or unpinned serial diagnostic: ${trimmed}`);
      }
    });
  }
}

function assertCsvHeader(label, firmwareSource, docSource, header) {
  if (!firmwareSource.includes(header)) failures.push(`firmware ${label} CSV header missing`);
  if (!docSource.includes(header)) failures.push(`protocol docs ${label} CSV header missing`);
}

function assertCsvFormatterUnpadded(label, source) {
  const csvFormats = [...source.matchAll(/"(%lu,[^"]*)"/g)].map((match) => match[1]);
  if (csvFormats.length === 0) {
    failures.push(`${label} CSV formatter missing`);
    return;
  }
  for (const format of csvFormats) {
    if (/%0|%[1-9]\d*(?:\.\d+)?[diufoxX]/.test(format)) {
      failures.push(`${label} CSV formatter uses padded numeric token: ${format}`);
    }
  }
}

function assertSanitizedModeApply() {
  const modeBlock = /if \(doc\.containsKey\("mode"\)\) \{[\s\S]*?\n    \}/.exec(firmwareBle)?.[0] || "";
  if (!modeBlock) {
    failures.push("firmware settings mode block missing");
    return;
  }
  if (modeBlock.includes("papSetMode")) {
    failures.push("firmware applies raw BLE mode before sanitizing settings");
  }
  const saveThenMode = /saveSettings\(\);\s*papSetMode\(settings\.mode\);\s*papSetLimits\(settingsToPapLimits\(\)\);/.test(firmwareBle);
  if (!saveThenMode) {
    failures.push("firmware sanitized settings apply path missing saveSettings -> papSetMode -> papSetLimits");
  }
}

function assertFaultStopsBeforeAlarm() {
  const faultBlock = /void triggerFault\(FaultType f\) \{[\s\S]*?\n\}/.exec(firmwareLogic)?.[0] || "";
  if (!faultBlock) {
    failures.push("firmware triggerFault block missing");
    return;
  }
  const currentFaultIndex = faultBlock.indexOf("currentFault = f;");
  const emergencyDisableIndex = faultBlock.indexOf("motorEmergencyDisable();");
  const pressureReadIndex = faultBlock.indexOf("readPressures(");
  const motorI2cIndex = faultBlock.indexOf("motorDriverI2cPresent()");
  const eventIndex = faultBlock.indexOf("sendBLEEvent(\"FAULT\");");
  const faultModeIndex = faultBlock.indexOf("enterMode(MODE_FAULT);");
  const beepIndex = faultBlock.indexOf("alarmBeep");
  if (
    currentFaultIndex === -1 ||
    emergencyDisableIndex === -1 ||
    pressureReadIndex === -1 ||
    motorI2cIndex === -1 ||
    eventIndex === -1 ||
    faultModeIndex === -1 ||
    beepIndex === -1 ||
    !(currentFaultIndex < emergencyDisableIndex &&
      emergencyDisableIndex < faultModeIndex &&
      emergencyDisableIndex < pressureReadIndex &&
      emergencyDisableIndex < motorI2cIndex &&
      faultModeIndex < eventIndex &&
      eventIndex < beepIndex)
  ) {
    failures.push("firmware triggerFault must hard-disable drive before I2C/sensor work, then enter MODE_FAULT before BLE notification and audible alarm");
  }

  const stopBlock = /void stopMotor\(\) \{[\s\S]*?\n\}/.exec(firmwareMotor)?.[0] || "";
  const stopDisableIndex = stopBlock.indexOf("motorEmergencyDisable();");
  const zeroCommandIndex = stopBlock.indexOf("writeCommand(0);");
  if (!stopBlock || stopDisableIndex === -1 || zeroCommandIndex === -1 ||
      stopDisableIndex >= zeroCommandIndex) {
    failures.push("firmware stopMotor must assert DRVOFF before attempting the zero I2C command");
  }
}

function assertLongPressResetScope() {
  const longBlock = /static void actionLong\(\) \{[\s\S]*?\n\}/.exec(firmwareButton)?.[0] || "";
  if (!longBlock) {
    failures.push("firmware button long-press handler missing");
    return;
  }
  if (!longBlock.includes("currentMode != MODE_IDLE || motorCalIsActive()")) {
    failures.push("firmware long-press reset must require idle and no active calibration");
  }
  if (!longBlock.includes("p.begin(\"cpap\", false)") || !longBlock.includes("p.clear();")) {
    failures.push("firmware long-press reset must clear only the cpap settings namespace");
  }
  for (const forbidden of ["motorcal", "sensorcal", "diag", "fault", "session", "mcf", "nvs_flash_erase"]) {
    if (longBlock.includes(forbidden)) failures.push(`firmware long-press reset must not touch ${forbidden}`);
  }
  const clearCalls = [...firmwareButton.matchAll(/\.clear\(\)/g)].length;
  if (clearCalls !== 1) failures.push(`firmware button expected exactly one Preferences clear call, found ${clearCalls}`);
}

function assertMcfRegisterManifest() {
  if (mcfRegisterManifest.driver !== "MCF8316D") failures.push("MCF register manifest driver must be MCF8316D");
  if (mcfRegisterManifest.preferredPartNumber !== "MCF8316DVRGFR") failures.push("MCF register manifest preferred part must be MCF8316DVRGFR");
  if (mcfRegisterManifest.status !== "contract_only") failures.push("MCF register manifest status must remain contract_only");
  if (mcfRegisterManifest.assemblyPart?.vendor !== "JLCPCB") failures.push("MCF register manifest assembly vendor must be JLCPCB");
  if (mcfRegisterManifest.assemblyPart?.partNumber !== "C47122159") failures.push("MCF register manifest JLCPCB part must be C47122159");
  if (mcfRegisterManifest.bleSnapshot?.shortUuid !== "0032") failures.push("MCF register manifest short UUID must be 0032");
  if (mcfRegisterManifest.bleSnapshot?.uuid !== characteristics.mcfParams) failures.push("MCF register manifest UUID must match BLE characteristic 0032");
  if (mcfRegisterManifest.bleSnapshot?.encrypted !== true) failures.push("MCF register manifest snapshot must stay encrypted");
  if (mcfRegisterManifest.bleSnapshot?.readOnlyUntilRegisterLayer !== true) failures.push("MCF register manifest snapshot must stay read-only until register layer exists");
  if (mcfRegisterManifest.bleSnapshot?.currentState !== "readback_valid_when_i2c_speed_verified") failures.push("MCF register manifest current state must describe verified I2C speed readback");
  if (mcfRegisterManifest.bleSnapshot?.pendingState !== "register_layer_pending") failures.push("MCF register manifest pending state must remain register_layer_pending");
  if (mcfRegisterManifest.bleSnapshot?.includesI2cPresence !== true) failures.push("MCF register manifest must include snapshot I2C-presence flag");
  if (mcfRegisterManifest.bleSnapshot?.includesI2cAddress !== true) failures.push("MCF register manifest must include snapshot I2C-address flag");
  if (mcfRegisterManifest.bleSnapshot?.includesFaultState !== true) failures.push("MCF register manifest must include snapshot fault-state flag");
  if (mcfRegisterManifest.bleSnapshot?.includesCommandReadback !== true) failures.push("MCF register manifest must include snapshot command readback fields");
  if (mcfRegisterManifest.bleSnapshot?.includesPinMap !== true) failures.push("MCF register manifest must include snapshot pin map fields");
  if (mcfRegisterManifest.bleSnapshot?.includesCommandReady !== true) failures.push("MCF register manifest must include snapshot commandReady flag");
  if (mcfRegisterManifest.bleSnapshot?.writesAllowed !== false) failures.push("MCF register manifest writesAllowed must remain false");
  if (mcfRegisterManifest.i2c?.defaultTargetAddress !== "0x01") failures.push("MCF register manifest default I2C address must be 0x01");
  if (mcfRegisterManifest.i2c?.transactionReference !== "TI SLLA662") failures.push("MCF register manifest transaction reference must remain TI SLLA662");
  if (mcfRegisterManifest.eepromReadback?.devCtrlRegister !== "0x0000EA") failures.push("MCF register manifest EEPROM DEV_CTRL register mismatch");
  if (mcfRegisterManifest.eepromReadback?.loadShadowCommand !== "0x40000000") failures.push("MCF register manifest EEPROM read command mismatch");
  if (mcfRegisterManifest.eepromReadback?.minimumWaitMs < 100) failures.push("MCF register manifest EEPROM wait must be at least 100 ms");
  if (mcfRegisterManifest.eepromReadback?.shadowStart !== "0x000080") failures.push("MCF register manifest shadow start mismatch");
  if (mcfRegisterManifest.eepromReadback?.shadowEnd !== "0x0000AE") failures.push("MCF register manifest shadow end mismatch");
  if (mcfRegisterManifest.eepromReadback?.addressStepFor32BitRead !== 2) failures.push("MCF register manifest 32-bit read address step must be 2");
  const requiredParameters = mcfRegisterManifest.requiredParameters || [];
  if (requiredParameters.length !== 7) failures.push(`MCF register manifest expected 7 required parameters, found ${requiredParameters.length}`);
  const requiredNames = new Set(requiredParameters.map((p) => p.name));
  for (const name of ["MOTOR_RES", "MOTOR_IND", "MOTOR_BEMF_CONST", "SPD_LOOP_KP", "SPD_LOOP_KI", "MAX_SPEED", "SPEED_MODE"]) {
    if (!requiredNames.has(name)) failures.push(`MCF register manifest missing required parameter ${name}`);
  }
  for (const name of ["MOTOR_RES", "MOTOR_IND", "MOTOR_BEMF_CONST", "SPD_LOOP_KP", "SPD_LOOP_KI"]) {
    const parameter = requiredParameters.find((p) => p.name === name);
    if (parameter?.zeroMeansCommissioningRequired !== true) failures.push(`MCF register manifest ${name} must require commissioning when zero`);
  }
  for (const parameter of requiredParameters) {
    if (parameter.addressSource !== "datasheet_or_ti_gui_export_required") {
      failures.push(`MCF register manifest ${parameter.name || "<unnamed>"} must require datasheet or TI GUI address source`);
    }
  }
  const prematureAddress = requiredParameters.find(
    (p) => p.address !== null && p.addressSource === "datasheet_or_ti_gui_export_required",
  );
  if (prematureAddress) failures.push(`MCF register manifest has unsourced address for ${prematureAddress.name}`);
  for (const state of ["eeprom_access_unknown", "eeprom_read_allowed", "eeprom_key_required", "eeprom_write_locked", "eeprom_locked_permanent"]) {
    if (!mcfRegisterManifest.eepromSecurityStates?.includes(state)) failures.push(`MCF register manifest missing EEPROM state ${state}`);
  }
  const gate = mcfRegisterManifest.writeGate || {};
  if (gate.systemMode !== "idle" ||
      gate.calibrationActive !== false ||
      gate.motorCommand !== 0 ||
      gate.drvOffAsserted !== true ||
      gate.i2cPresent !== true ||
      gate.nFaultAsserted !== false ||
      gate.requiresExplicitCommissioningAction !== true ||
      gate.requiresPostWriteReadbackMatch !== true ||
      gate.blocksStartAndCalibrationUntilVerified !== true ||
      gate.forbiddenFromNormalSettingsWrites !== true) {
    failures.push("MCF register manifest write gate is incomplete");
  }
  const mpet = mcfRegisterManifest.mpet || {};
  if (mpet.benchOnly !== true ||
      mpet.requiresExplicitCommissioningMode !== true ||
      mpet.requiresAbortFromBleStop !== true ||
      mpet.requiresAbortFromPhysicalButton !== true ||
      mpet.requiresPostRunReadbackExport !== true) {
    failures.push("MCF register manifest MPET boundary is incomplete");
  }
  const exportContract = mcfRegisterManifest.export || {};
  for (const field of [
    "includeFirmwareBuild",
    "includeBoardRevision",
    "includeDriverPart",
    "includeRegisterSource",
    "includeFaultStatus",
    "includeCalibrationProfileReference",
  ]) {
    if (exportContract[field] !== true) failures.push(`MCF register manifest export contract must include ${field}`);
  }
  if (exportContract.neverIncludeEepromPasscode !== true) {
    failures.push("MCF register manifest must forbid EEPROM passcode export");
  }
}

function assertActiveMcfVariant() {
  const activeSources = [
    topReadme,
    firmwareReadme,
    firmwareMotor,
    firmwareMotorHeader,
    firmwareBle,
    firmwareLogic,
    appProtocol,
    appValidation,
    mobileApp,
    protocolDoc,
    mobileDoc,
    motorCalibrationDoc,
    rev3MotorDriverDoc,
    mcfBringupDoc,
    mcfCommissioningDoc,
    releaseChecklistDoc,
    JSON.stringify(mcfRegisterManifest),
  ].join("\n");
  for (const forbidden of ["MCF8316A", "MCF8316A1", "MCF8316A1VRGFR"]) {
    if (activeSources.includes(forbidden)) failures.push(`active MCF8316D contract still contains ${forbidden}`);
  }
}

function assertMacro(name, expected) {
  const actual = firmwareMacros.get(name);
  if (actual !== expected) failures.push(`${name} expected ${expected}, found ${actual || "<missing>"}`);
}

function assertFirmwareCallbackUsesControlGuard(className) {
  const marker = `class ${className} `;
  const start = firmwareBle.indexOf(marker);
  const end = start === -1 ? -1 : firmwareBle.indexOf("\n};", start);
  if (start === -1 || end === -1) {
    failures.push(`firmware callback class ${className} is missing`);
    return;
  }
  const body = firmwareBle.slice(start, end);
  const guardCount = body.split("SystemControlGuard controlGuard;").length - 1;
  const expected = className === "MyServerCallbacks" ? 2 : 1;
  if (guardCount !== expected) {
    failures.push(`firmware callback class ${className} expected ${expected} control guard(s), found ${guardCount}`);
  }
}

function assertAppCharacteristic(name, expectedShortCode) {
  const actual = appCharacteristics.get(name);
  if (actual !== expectedShortCode) {
    failures.push(`app ${name} expected uuid16("${expectedShortCode}"), found ${actual || "<missing>"}`);
  }
}

function assertProtocolDocCharacteristicTable() {
  for (const [name, shortCode] of Object.entries(appShortCodes)) {
    const expected = characteristics[name];
    const actual = protocolDocCharacteristics.get(shortCode.toLowerCase());
    if (actual !== expected) {
      failures.push(`protocol docs ${shortCode} expected ${expected}, found ${actual || "<missing>"}`);
    }
  }
}

function extractFirmwareMacros(source) {
  const macros = new Map();
  const matcher = /^#define\s+(\S+)\s+"([^"]+)"/gm;
  let match;
  while ((match = matcher.exec(source))) {
    macros.set(match[1], match[2]);
  }
  return macros;
}

function extractAppCharacteristics(source) {
  const entries = new Map();
  const matcher = /^\s*(\w+):\s*uuid16\("([0-9a-fA-F]{4})"\),/gm;
  let match;
  while ((match = matcher.exec(source))) {
    entries.set(match[1], match[2].toLowerCase());
  }
  return entries;
}

function extractProtocolDocCharacteristics(source) {
  const entries = new Map();
  const matcher = /^\|[^|\n]+\|\s*`([0-9a-fA-F]{4})`\s*\|\s*`([0-9a-fA-F-]{36})`\s*\|/gm;
  let match;
  while ((match = matcher.exec(source))) {
    entries.set(match[1].toLowerCase(), match[2].toLowerCase());
  }
  return entries;
}
