import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const mobileApp = readFileSync(resolve(root, "mobile/App.tsx"), "utf8");
const mobileDoc = readFileSync(resolve(root, "docs/mobile-app.md"), "utf8");
const failures = [];

const simpleLogsBranch = sliceBetween(
  mobileApp,
  "            ) : (\n              <>\n                {simpleDataDays.length > 0",
  "{advancedMode || selectedDataCsv.trim() ? (",
  "Simple Data branch",
);
const simpleLogsActionBranch = sliceBetween(
  mobileApp,
  "            {!advancedMode && (\n              <View style={styles.actions}>\n                <ActionButton icon=\"refresh\" label=\"Update\"",
  "            {advancedMode && <Text style={styles.logBox}",
  "Simple Data action branch",
);
const simpleLogsScreenBranch = sliceBetween(
  mobileApp,
  "{screen === \"logs\" && (",
  "{screen === \"calibration\" && (",
  "Simple Data screen branch",
);
const aboutBranch = sliceBetween(
  mobileApp,
  "{screen === \"about\" && (",
  "      </ScrollView>",
  "About screen branch",
);
const pairingBranch = sliceBetween(
  mobileApp,
  "{!connectedDevice && (",
  "<View style={styles.tabs}>",
  "pairing branch",
);
const logImportBranch = sliceBetween(
  mobileApp,
  "  async function loadLogsFromDevice(",
  "  async function clearLogs()",
  "log import branch",
);
const saveSettingsBranch = sliceBetween(
  mobileApp,
  "  async function saveSettings()",
  "  function subscribeTelemetry(device: Device, sessionId: number)",
  "save settings branch",
);

assertContains("Simple Data title", mobileApp, "advancedMode ? \"Logs\" : \"Here's your data\"");
assertAbsent("Simple Data hides day subhead", simpleLogsBranch, ">Day<");
assertContains("Simple Data optional day helper", simpleLogsBranch, "Select the day if you want.");
assertOrder("Simple Data day helper before choices", simpleLogsBranch, "Select the day if you want.", "style={styles.dayPicker}");
assertContains("Simple Data time label", simpleLogsBranch, 'label="Time"');
assertContains("Simple Data update action", simpleLogsActionBranch, 'label="Update"');
assertContains("Simple Data update reads logs", simpleLogsActionBranch, "onPress={readLogs}");
assertAbsent("Simple Data update hides raw read label", simpleLogsActionBranch, 'label="Read"');
assertOrder("Simple Data update stays after graphs or empty state", simpleLogsScreenBranch, "Your pressure and airflow graphs will appear here.", '<ActionButton icon="refresh" label="Update"');
assertContains("Simple auto data ready copy", logImportBranch, '? "Your data is ready."');
assertContains("Simple auto no-data copy", logImportBranch, ': "Data checked. No new rows yet."');
assertContains("Simple manual data updated copy", logImportBranch, '? "Data updated."');
assertContains("Simple manual no-data copy", logImportBranch, ': "No data yet."');
assertContains("Simple data messages require expected-family valid row count", logImportBranch, "const validImportedRows = retainedReadbackImportedRowCount(logs.csv, faults.csv);");
assertOrder("Simple auto data hides retained-session copy behind current advanced state", logImportBranch, "const messageAdvanced = advancedModeRef.current;", "Latest retained session");
assertContains("Simple Data quiet empty state", mobileApp, "Your pressure and airflow graphs will appear here.");
assertContains("Simple Data selected-day graph source", mobileApp, "const visibleAnalysisCsv = advancedMode ? analysisCsv : selectedDataCsv;");
assertContains("Simple Data selected-day observations source", mobileApp, "flagSessionObservations(visibleAnalysisCsv)");
assertContains("Simple Home hides start until usable", mobileApp, "showSimpleStart &&");
assertContains("Simple Home only shows verified usable start", mobileApp, "const showSimpleStart = controlStartAllowed;");
assertContains("Simple Home stop requires verified protocol", mobileApp, "const showSimpleStop = canUseDevice && protocolCompatible");
assertContains("Simple Home exposes active prewarm state", mobileApp, "const prewarmActive = telemetry.moduleStatus.includes(\"prewarm\");");
assertContains("Simple Home active prewarm label", mobileApp, "? \"Prewarming\"");
assertContains("Simple Home active prewarm stop", mobileApp, "label=\"Stop prewarm\"");
assertContains("Simple Setup hides start until usable", mobileApp, "!advancedMode && showSimpleWaterStart");
assertContains("Simple Setup only shows verified usable start", mobileApp, "const showSimpleWaterStart = calibrationStartAllowed && waterSetupReady;");
assertContains("Simple Setup hides capture until running", mobileApp, "advancedMode || showSimpleWaterCapture");
assertContains("Simple docs hidden unavailable actions", mobileDoc, "Simple hides unavailable start/setup actions");
assertContains("Simple setup saved panel copy", mobileApp, "Setup saved.");
assertAbsent("Simple setup hides water-column map saved copy", mobileApp, "Water-column map saved.");
assertAbsent("Simple setup hides water-column map updated copy", mobileApp, "Water-column map updated.");
assertContains("Simple start standby title", mobileApp, 'advancedMode ? "Start unavailable" : "Use standby"');
assertContains("Simple start standby instruction", mobileApp, "Use standby to start airflow.");
assertContains("Simple setup standby title", mobileApp, 'advancedMode ? "Calibration unavailable" : "Use standby"');
assertContains("Simple setup standby instruction", mobileApp, "Use standby to start setup.");
assertContains("Simple capture neutral title", mobileApp, 'advancedMode ? "Capture unavailable" : "Wait for the mark"');
assertContains("Simple capture neutral instruction", mobileApp, "Wait for the ruler mark.");
assertContains("Simple setup plain reachability check", mobileApp, "Device and tube are easy to reach");
assertContains("Simple setup checklist action title", mobileApp, 'Alert.alert("Finish checklist"');
assertAbsent("Simple setup hides bench wiring wording", mobileApp, "Power, wiring, and airflow path visible");
assertContains("Simple Comfort write-time protocol fallback", saveSettingsBranch, 'simple: "This app and device do not match. Update the app or firmware, then try again."');
assertContains("Simple Comfort write-time idle fallback", saveSettingsBranch, 'simple: "Stop airflow or setup, then try again."');
assertContains("Advanced Comfort write-time protocol detail", saveSettingsBranch, 'advanced: "Writes require the expected Ozealis BLE protocol version."');
assertContains("Advanced Comfort write-time readback detail", saveSettingsBranch, 'advanced: "Settings writes require a fresh idle, no-fault, no-calibration readback before changing pressure settings."');

for (const text of [
  "History",
  "Latest import",
  "Session rows",
  "Retained window",
  "Live synced rows",
  "Analysis source",
  "Export session CSV",
  "Export live 10 Hz CSV",
  "No session log loaded.",
  "The device did not start.",
  "The setup did not start.",
  "\"Could not start\"",
  "\"Could not start setup\"",
  "\"Could not capture mark\"",
  "Not available right now",
  "App/device mismatch",
  "Start from standby",
  "Setup from standby",
]) {
  assertAbsent(`Simple Data hides ${text}`, simpleLogsBranch, text);
}

for (const text of [
  "The device did not start.",
  "The setup did not start.",
  "\"Could not start\"",
  "\"Could not start setup\"",
  "\"Could not capture mark\"",
  "Not available right now",
  "App/device mismatch",
  "Start from standby",
  "Setup from standby",
]) {
  assertAbsent(`Simple app avoids ${text}`, mobileApp, text);
}

assertContains("Simple About project URL constant", mobileApp, 'const projectUrl = "https://ozealis.org/";');
assertContains("Simple About names public project site", aboutBranch, "Ozealis is the open-source experimental CPAP/BiPAP project at https://ozealis.org/.");
assertContains("Simple About project action", aboutBranch, "Open ozealis.org");
assertContains("Simple About collapsed builder settings selector", aboutBranch, "Builder settings");
assertContains("Simple About selector disclosure gate", aboutBranch, "showBuilderOptions && <UiModeSelector");
assertContains("Simple About standard selector label", mobileApp, "Standard");
assertContains("Simple About builder selector label", mobileApp, "Builder");
assertContains("Simple mode clears Builder status ref", mobileApp, "const wasAdvanced = previousAdvancedModeRef.current;");
assertContains("Simple mode detects Builder-to-Standard transition", mobileApp, "if (wasAdvanced && !advancedMode) {");
assertContains("Simple mode clears Builder status text", mobileApp, 'setMessage("");');
assertContains("Simple mode collapses Builder settings", mobileApp, "setShowBuilderOptions(false);");
assertContains("Simple banner hides research warning behind advanced", mobileApp, "{advancedMode && (\n        <View style={styles.notice}>");
assertContains("Simple tab list excludes OTA", mobileApp, 'const simpleTabs: Screen[] = ["control", "settings", "logs", "calibration", "about"];');
assertContains("Advanced tab list keeps OTA", mobileApp, 'const advancedTabs: Screen[] = ["control", "settings", "logs", "calibration", "ota", "about"];');

assertContains("Simple pairing title", pairingBranch, 'advancedMode ? "Nearby Devices" : "Pair device"');
assertContains("Simple pairing hides BLE UUID behind advanced", pairingBranch, "advancedMode");
assertContains("Simple pairing plain copy", pairingBranch, "Hold the device pairing button until it is ready to pair");
assertContains("Simple pairing hides device ID", pairingBranch, "{advancedMode && <Text style={styles.mutedText}>{device.id}</Text>}");

assertContains("Simple-mode docs About selector", mobileDoc, "tuck the builder selector away in a collapsed About > Builder settings disclosure");
assertContains("Simple-mode docs Data wording", mobileDoc, "Data shows `Here's your data`");
assertContains("Simple-mode docs no history/import/session wording", mobileDoc, "without exposing history/import/session terminology");

if (failures.length > 0) {
  console.error("Mobile Simple-mode copy verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Mobile Simple-mode copy verification passed.");

function sliceBetween(source, start, end, label) {
  const startIndex = source.indexOf(start);
  if (startIndex === -1) {
    failures.push(`${label} start marker missing: ${start}`);
    return "";
  }
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (endIndex === -1) {
    failures.push(`${label} end marker missing: ${end}`);
    return "";
  }
  return source.slice(startIndex, endIndex);
}

function assertContains(label, source, expected) {
  if (!source.includes(expected)) failures.push(`${label} missing ${expected}`);
}

function assertAbsent(label, source, unexpected) {
  if (source.includes(unexpected)) failures.push(`${label} still contains ${unexpected}`);
}

function assertOrder(label, source, first, second) {
  const firstIndex = source.indexOf(first);
  const secondIndex = source.indexOf(second);
  if (firstIndex === -1 || secondIndex === -1 || firstIndex > secondIndex) {
    failures.push(`${label} expected ${first} before ${second}`);
  }
}
