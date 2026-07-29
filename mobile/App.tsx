import { Ionicons } from "@expo/vector-icons";
import { Buffer } from "buffer";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { StatusBar } from "expo-status-bar";
import { Component, ErrorInfo, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  PermissionsAndroid,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { BleManager, Device, State, Subscription } from "react-native-ble-plx";

import {
  DEFAULT_SETTINGS,
  DEFAULT_PREWARM_SCHEDULE,
  EMPTY_TELEMETRY,
  OZEALIS_CHARACTERISTICS,
  OZEALIS_PROTOCOL_VERSION,
  OZEALIS_SERVICE_UUID,
  PLX_CONTINUOUS_MEASUREMENT_UUID,
  PLX_SERVICE_UUID,
  THERAPY_MODE_LABELS,
  OzealisSettings,
  OzealisTelemetry,
  OximetrySample,
  CsvTransferSnapshot,
  LatestOnlyAsyncRelay,
  OXIMETRY_STALE_MS,
  RetainedImportManifest,
  csvTransferHash,
  csvDataRowCount,
  csvPreview,
  filterSessionCsvByDay,
  flagSessionObservations,
  formatOximetryStatus,
  isClearedDeviceLogReadback,
  isCompatibleDeviceSession,
  isOtaStatusInProgress,
  isPrewarmScheduleDue,
  isSameDeviceSession,
  isValidLiveCsvRow,
  isSupportedOtaUrl,
  isOzealisDevice,
  listSessionDayOptions,
  normalizeFaultSnapshot,
  normalizeRetainedSessionSnapshot,
  parseCalibrationStatus,
  parseFaultCode,
  parseLiveCsvDiagnostics,
  parseMcfParamsSnapshot,
  parseModuleStatus,
  parseOtaStatus,
  parseOptionalTelemetryNumber,
  parsePrewarmSchedule,
  prewarmScheduleRunKey,
  parsePlxContinuousMeasurement,
  parseSessionGraphData,
  parseSystemMode,
  parseSettingsReadback,
  parseRetainedImportManifest,
  parseUiPreference,
  markPrewarmScheduleRun,
  readCsvTransfer,
  readUtf8,
  redactSensitiveJson,
  retainedReadbackImportedRowCount,
  sanitizeSettings,
  sanitizePrewarmSchedule,
  selectSessionAnalysisCsv,
  SessionGraphPoint,
  SessionObservation,
  PrewarmSchedule,
  serializeSettings,
  serializeRetainedImportManifest,
  serializePrewarmSchedule,
  settingLimitMessages,
  subscribeText,
  summarizeSessionCsv,
  writeUtf8,
} from "./src/ozealisBle";

type Screen = "control" | "settings" | "logs" | "calibration" | "ota" | "about";
type WaterSetupKey = "tube" | "water" | "ruler" | "secure" | "bench";
type ModeAwareMessage = string | { simple: string; advanced: string };
type GraphScale = "all" | "10m" | "1m" | "30s";
type ControlCommand = "start" | "stop" | "prewarmStart" | "prewarmStop";
type QueuedOximetryRelay = {
  sample: OximetrySample;
  oximeterDeviceId: string;
  oximeterSessionId: number;
  ozealisDeviceId: string;
  ozealisSessionId: number;
};
type RetainedSnapshotPair = {
  session: CsvTransferSnapshot;
  fault: CsvTransferSnapshot;
};
type RetainedImportState = {
  sessionCsv: string;
  faultCsv: string;
  manifest: RetainedImportManifest;
};
type RetainedLoadResult = "imported" | "empty" | "failed" | "stale" | "unavailable";

const therapyModes = THERAPY_MODE_LABELS;
const simpleTherapyModeIndexes = [0, 1, 2] as const;
const humidifierKinds = ["Off", "Ultrasonic", "Water warmer"] as const;
const systemModes = ["Idle", "Startup", "Running", "Shutdown", "Fault"];
const faultTypes = ["None", "Low VIN", "Sensor", "Overpressure", "I/O"];
const simpleFaultTypes = ["No alert", "Low power", "Sensor alert", "Pressure alert", "Device alert"];
const waterSetupItems: { key: WaterSetupKey; label: string }[] = [
  { key: "tube", label: "Clear tube taped as a U" },
  { key: "water", label: "Water added; machine 5 cm above water" },
  { key: "ruler", label: "20 cm+ ruler zeroed at resting waterline" },
  { key: "secure", label: "Tube and ruler secured so nothing can move" },
  { key: "bench", label: "Device and tube are easy to reach" },
];
const emptyWaterSetupChecks: Record<WaterSetupKey, boolean> = {
  tube: false,
  water: false,
  ruler: false,
  secure: false,
  bench: false,
};
const waterColumnTargets = Array.from({ length: 17 }, (_, index) => index + 4);
const tabLabels: Record<Screen, string> = {
  control: "Home",
  settings: "Comfort",
  logs: "Data",
  calibration: "Setup",
  ota: "OTA",
  about: "About",
};
const advancedTabLabels: Record<Screen, string> = {
  control: "Control",
  settings: "Settings",
  logs: "Logs",
  calibration: "Calibration",
  ota: "OTA",
  about: "About",
};
const simpleTabs: Screen[] = ["control", "settings", "logs", "calibration", "about"];
const advancedTabs: Screen[] = ["control", "settings", "logs", "calibration", "ota", "about"];
const accent = "#0f766e";
const projectUrl = "https://ozealis.org/";
const appVersion = "1.0.0";
const liveSyncCsvHeader =
  "ms,setpoint_hPa,pressure_hPa,flow_hPa,vin,mode,measured_cm,error_cm,controller_amp,motor_cmd,motor_fault,motor_i2c,motor_fg_hz,spo2_percent,pulse_bpm,oximeter_source,humidifier_temp_c,humidifier_rh_percent,hose_temp_c";
const liveSyncRetentionMinutes = 60;
const maxLiveSyncRows = liveSyncRetentionMinutes * 60 * 10;
const liveSyncRestartBackstepMs = 5000;
const liveSyncMaxSampleGapMs = 1000;
const liveSyncSpoolFileName = "ozealis-live-sync.csv";
const retainedSessionImportFileName = "ozealis-retained-session.csv";
const retainedFaultImportFileName = "ozealis-retained-faults.csv";
const retainedImportManifestFileName = "ozealis-retained-import.json";
const uiPreferenceFileName = "ozealis-ui-preferences.json";
const prewarmScheduleFileName = "ozealis-prewarm-schedule.json";
const autoImportRetryDelayMs = 2000;
const autoImportMaxAttempts = 3;
const blePreviewMode = Platform.OS === "web";
const maxGraphSourcePoints = 36000;
const graphScaleWindowsMs: Record<GraphScale, number | null> = {
  all: null,
  "10m": 10 * 60 * 1000,
  "1m": 60 * 1000,
  "30s": 30 * 1000,
};
const advancedGraphScales: { key: GraphScale; label: string }[] = [
  { key: "all", label: "All" },
  { key: "10m", label: "10 min" },
  { key: "1m", label: "1 min" },
  { key: "30s", label: "30 sec" },
];
const simpleGraphScales: { key: GraphScale; label: string }[] = [
  { key: "all", label: "Night" },
  { key: "30s", label: "Breath" },
];

type AppErrorBoundaryState = {
  crashed: boolean;
};

class AppErrorBoundary extends Component<{ children: ReactNode }, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { crashed: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { crashed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Ozealis app render error", error, info.componentStack);
  }

  render() {
    if (this.state.crashed) {
      return (
        <SafeAreaView style={styles.safeArea}>
          <StatusBar style="dark" />
          <View style={styles.errorPanel}>
            <Text style={styles.errorTitle}>App view stopped</Text>
            <Text style={styles.mutedText}>
              No device command was sent. Return to the app view, then reconnect before changing airflow or setup.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Return to app"
              style={styles.errorAction}
              onPress={() => this.setState({ crashed: false })}
            >
              <Text style={styles.actionText}>Return to app</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <AppErrorBoundary>
      <OzealisApp />
    </AppErrorBoundary>
  );
}

function OzealisApp() {
  const managerRef = useRef<BleManager | null>(null);
  const subscriptionsRef = useRef<Subscription[]>([]);
  const oximeterSubscriptionsRef = useRef<Subscription[]>([]);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const oximeterScanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoImportRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousModeRef = useRef(EMPTY_TELEMETRY.mode);
  const previousAdvancedModeRef = useRef(false);
  const autoImportingSessionRef = useRef<number | null>(null);
  const autoImportPendingSessionRef = useRef<number | null>(null);
  const autoImportRetryCountRef = useRef(0);
  const prewarmScheduleSkipKeyRef = useRef("");
  const connectedDeviceRef = useRef<Device | null>(null);
  const deviceSessionIdRef = useRef(0);
  const protocolVersionRef = useRef("unknown");
  const oximeterDeviceRef = useRef<Device | null>(null);
  const oximeterSessionIdRef = useRef(0);
  const oximetryRelayRef = useRef<LatestOnlyAsyncRelay<QueuedOximetryRelay> | null>(null);
  const liveSyncRowsRef = useRef<string[]>([]);
  const liveSyncPendingRowsRef = useRef<string[]>([]);
  const liveSyncLastMsRef = useRef(0);
  const liveSyncLastUiMsRef = useRef(0);
  const liveSyncSpoolReadyRef = useRef(false);
  const uiPreferenceReadyRef = useRef(false);
  const prewarmScheduleReadyRef = useRef(false);
  const advancedModeRef = useRef(false);
  const writeGuardsRef = useRef({
    busy: false,
    protocolCompatible: false,
    settingsWriteAllowed: false,
    calibrationStartAllowed: false,
    waterCaptureAllowed: false,
    calibrationAbortAllowed: false,
    otaAllowed: false,
    otaInProgress: false,
    waterSetupReady: false,
  });
  const [bleState, setBleState] = useState<State>("Unknown" as State);
  const [devices, setDevices] = useState<Device[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [oximeterDevice, setOximeterDevice] = useState<Device | null>(null);
  const [oximeterScanning, setOximeterScanning] = useState(false);
  const [oximetrySample, setOximetrySample] = useState<OximetrySample | null>(null);
  const [oximetryNow, setOximetryNow] = useState(() => Date.now());
  const [telemetry, setTelemetry] = useState<OzealisTelemetry>(() => ({ ...EMPTY_TELEMETRY }));
  const [settings, setSettings] = useState<OzealisSettings>(() => ({ ...DEFAULT_SETTINGS }));
  const [settingsReadbackValid, setSettingsReadbackValid] = useState(false);
  const [prewarmSchedule, setPrewarmSchedule] = useState<PrewarmSchedule>(() => ({ ...DEFAULT_PREWARM_SCHEDULE }));
  const [screen, setScreen] = useState<Screen>("control");
  const [advancedMode, setAdvancedMode] = useState(false);
  const [showBuilderOptions, setShowBuilderOptions] = useState(false);
  const [selectedDataDayKey, setSelectedDataDayKey] = useState("day-0");
  const [graphScale, setGraphScale] = useState<GraphScale>("all");
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [retainedImport, setRetainedImport] = useState<RetainedImportState | null>(null);
  const [liveSyncCsv, setLiveSyncCsv] = useState("");
  const [liveSyncRowCount, setLiveSyncRowCount] = useState(0);
  const [liveSyncSessionActive, setLiveSyncSessionActive] = useState(false);
  const [driverParamsJson, setDriverParamsJson] = useState("");
  const [protocolVersion, setProtocolVersion] = useState("unknown");
  const [otaSsid, setOtaSsid] = useState("");
  const [otaPassword, setOtaPassword] = useState("");
  const [otaUrl, setOtaUrl] = useState("");
  const [waterSetupChecks, setWaterSetupChecks] = useState<Record<WaterSetupKey, boolean>>(() => ({ ...emptyWaterSetupChecks }));
  const [autoImportRetryTick, setAutoImportRetryTick] = useState(0);
  const logCsv = retainedImport?.sessionCsv || "";
  const faultCsv = retainedImport?.faultCsv || "";
  const retainedImportManifest = retainedImport?.manifest || null;

  if (!oximetryRelayRef.current) {
    oximetryRelayRef.current = new LatestOnlyAsyncRelay<QueuedOximetryRelay>(async (queued) => {
      if (
        !isSameDeviceSession(
          oximeterDeviceRef.current?.id,
          oximeterSessionIdRef.current,
          queued.oximeterDeviceId,
          queued.oximeterSessionId,
        ) ||
        Date.now() - queued.sample.receivedAt > OXIMETRY_STALE_MS
      ) {
        return;
      }
      const device = connectedDeviceRef.current;
      if (
        !device ||
        !isCompatibleDeviceSession(
          connectedDeviceRef.current?.id,
          deviceSessionIdRef.current,
          protocolVersionRef.current,
          queued.ozealisDeviceId,
          queued.ozealisSessionId,
          OZEALIS_PROTOCOL_VERSION,
        )
      ) {
        return;
      }
      await writeUtf8(
        device,
        OZEALIS_CHARACTERISTICS.oximetryRelay,
        JSON.stringify({
          spo2: roundSample(queued.sample.spo2, 1),
          pulse: roundSample(queued.sample.pulse, 1),
          quality: queued.sample.quality,
        }),
      );
    });
  }

  const connectedName = connectedDevice?.name || connectedDevice?.localName || "Ozealis";
  const canUseDevice = Boolean(connectedDevice);
  const protocolCompatible = protocolVersion === OZEALIS_PROTOCOL_VERSION;
  const connectedStateUnknown = canUseDevice && (!/^[0-4]$/.test(telemetry.mode) || !/^[0-4]$/.test(telemetry.fault));
  const faultActive = Number(telemetry.fault) > 0 || telemetry.mode === "4";
  const noSystemFault = telemetry.fault === "0";
  const calibration = useMemo(
    () => parseCalibrationStatus(telemetry.calibrationStatus),
    [telemetry.calibrationStatus],
  );
  const driverParams = useMemo(
    () => parseMcfParamsSnapshot(driverParamsJson),
    [driverParamsJson],
  );
  const driverSnapshotMatches = driverParams.driver === "MCF8316D" && driverParams.targetSpeed === "i2c";
  const driverCommandReady = driverSnapshotMatches && driverParams.commandReady;
  const driverReady = telemetry.motorI2c === "1" && telemetry.motorFault === "0" && driverCommandReady;
  const controlStartAllowed = canUseDevice && protocolCompatible && telemetry.mode === "0" && noSystemFault && !calibration.active && driverReady;
  const calibrationStartAllowed = canUseDevice && protocolCompatible && telemetry.mode === "0" && noSystemFault && !calibration.active && driverReady;
  const motorFaultClearAllowed =
    canUseDevice && protocolCompatible && !calibration.active && (telemetry.mode === "0" || (telemetry.mode === "4" && telemetry.fault === "4"));
  const otaInProgress = isOtaStatusInProgress(telemetry.otaStatus);
  const retainedReadAllowed =
    canUseDevice &&
    protocolCompatible &&
    (telemetry.mode === "0" || telemetry.mode === "4") &&
    !calibration.active &&
    !otaInProgress;
  const otaAllowed = canUseDevice && protocolCompatible && telemetry.mode === "0" && noSystemFault && !calibration.active && !otaInProgress;
  const settingsWriteAllowed =
    canUseDevice &&
    protocolCompatible &&
    settingsReadbackValid &&
    telemetry.mode === "0" &&
    noSystemFault &&
    !calibration.active;
  const humidifierPresent = telemetry.moduleStatus.includes("humidifier");
  const prewarmActive = telemetry.moduleStatus.includes("prewarm");
  const prewarmStartAllowed = settingsWriteAllowed && settings.humidifierKind === 2 && settings.humidifierPrewarmMinutes > 0 && humidifierPresent;
  const prewarmScheduleLabel = formatPrewarmScheduleLabel(prewarmSchedule);
  const waterCaptureAllowed = canUseDevice && protocolCompatible && calibration.active && calibration.mode === "water";
  const calibrationAbortAllowed = canUseDevice && protocolCompatible && calibration.active;
  const driverI2cLabel = telemetry.motorI2c === "1" ? "Present" : telemetry.motorI2c === "0" ? "Missing" : "Unknown";
  const driverFaultLabel = telemetry.motorFault === "1" ? "Latched" : telemetry.motorFault === "0" ? "Clear" : "Unknown";
  const driverCommandPathLabel =
    driverParams.runtimeSpeed === "i2c"
      ? driverParams.state === "readback_valid"
        ? "I2C speed verified"
        : "I2C speed pending readback"
      : driverParams.runtimeSpeed === "bench_pwm_fallback"
        ? "Bench PWM build"
        : driverParams.runtimeSpeed === "disabled_until_i2c_speed"
          ? "Disabled until I2C speed"
          : "Unknown";
  const displayPressure = telemetry.controllerMeasured !== "--" ? telemetry.controllerMeasured : "--";
  const displayPressureUnit = "cmH2O";
  const oximetryDisplay = useMemo(
    () => formatOximetryStatus(telemetry.oximetry, telemetry.oximetryReceivedAt, oximetrySample, oximetryNow),
    [telemetry.oximetry, telemetry.oximetryReceivedAt, oximetrySample, oximetryNow],
  );
  const comfortPressureLabel =
    settings.pMin === settings.pMax
      ? `${formatPressureSetting(settings.pMin)} cmH2O`
      : `${formatPressureSetting(settings.pMin)}-${formatPressureSetting(settings.pMax)} cmH2O`;
  const homeStatusLabel = connectedStateUnknown
    ? "Checking"
    : faultActive
    ? "Needs attention"
    : prewarmActive
    ? "Prewarming"
    : telemetry.mode === "2"
      ? "Running"
      : telemetry.mode === "1"
        ? "Starting"
        : telemetry.mode === "3"
          ? "Stopping"
          : "Ready";
  const homeStatusTone = connectedStateUnknown ? "checking" : faultActive ? "attention" : prewarmActive ? "humidifier warming" : telemetry.mode === "2" ? "airflow on" : "ready";
  const faultLabel = advancedMode ? faultTypes[Number(telemetry.fault)] || telemetry.fault : simpleFaultTypes[Number(telemetry.fault)] || "Device alert";
  const startBlockReason = !canUseDevice
    ? "Connect a device before starting."
    : !protocolCompatible
      ? "Protocol mismatch blocks start."
      : telemetry.mode !== "0"
        ? "Use standby to start airflow."
        : !noSystemFault
          ? "Clear the active system fault before starting."
          : calibration.active
            ? "Calibration must finish or abort before starting."
            : telemetry.motorI2c !== "1"
              ? "MCF8316D I2C target is not present."
              : telemetry.motorFault === "1"
                ? "MCF8316D fault latch is active."
                : telemetry.motorFault !== "0"
                  ? "MCF8316D fault-latch reading is unknown."
                : !driverCommandReady
                  ? "Motor command path is blocked until I2C speed command readback is verified or an explicit bench PWM build is flashed."
                  : "";
  const calibrationBlockReason = !canUseDevice
    ? "Connect a device before calibration."
    : !protocolCompatible
      ? "Protocol mismatch blocks calibration."
      : telemetry.mode !== "0"
        ? "Use standby to start setup."
        : !noSystemFault
          ? "Clear the active system fault before calibration."
          : calibration.active
            ? "Finish or abort the active calibration before starting another."
            : telemetry.motorI2c !== "1"
              ? "MCF8316D I2C target is not present."
              : telemetry.motorFault === "1"
                ? "MCF8316D fault latch is active."
                : telemetry.motorFault !== "0"
                  ? "MCF8316D fault-latch reading is unknown."
                : !driverCommandReady
                  ? "Motor command path is blocked until I2C speed command readback is verified or an explicit bench PWM build is flashed."
                  : "";
  const simpleStartDisabled = busy;
  const showSimpleStart = controlStartAllowed;
  const showSimpleStop = canUseDevice && protocolCompatible && (telemetry.mode === "1" || telemetry.mode === "2" || telemetry.mode === "3");
  const showSimplePrewarmStop = canUseDevice && protocolCompatible && prewarmActive;
  const retainedImportMatchesConnection =
    !connectedDevice ||
    (retainedImportManifest !== null && retainedImportManifest.deviceId === connectedDevice.id);
  const visibleLogCsv = retainedImportMatchesConnection ? logCsv : "";
  const visibleFaultCsv = retainedImportMatchesConnection ? faultCsv : "";
  const sessionRows = useMemo(() => csvDataRowCount(visibleLogCsv), [visibleLogCsv]);
  const faultRows = useMemo(() => csvDataRowCount(visibleFaultCsv), [visibleFaultCsv]);
  const sessionPreview = useMemo(() => csvPreview(visibleLogCsv), [visibleLogCsv]);
  const faultPreview = useMemo(() => csvPreview(visibleFaultCsv), [visibleFaultCsv]);
  const analysisSelection = useMemo(
    () => selectSessionAnalysisCsv(liveSyncCsv, visibleLogCsv, canUseDevice && liveSyncSessionActive),
    [liveSyncCsv, visibleLogCsv, canUseDevice, liveSyncSessionActive],
  );
  const analysisCsv = analysisSelection.csv;
  const analysisSource = analysisSelection.source;
  const liveSyncRows = liveSyncRowCount;
  const sessionSummary = useMemo(() => summarizeSessionCsv(visibleLogCsv), [visibleLogCsv]);
  const liveSyncSummary = useMemo(() => summarizeSessionCsv(liveSyncCsv), [liveSyncCsv]);
  const simpleDataDays = useMemo(() => listSessionDayOptions(analysisCsv), [analysisCsv]);
  const selectedDataDay = simpleDataDays.find((day) => day.key === selectedDataDayKey) || simpleDataDays[0];
  const selectedDataCsv = useMemo(
    () => filterSessionCsvByDay(analysisCsv, selectedDataDay?.key || "day-0"),
    [analysisCsv, selectedDataDay?.key],
  );
  const visibleAnalysisCsv = advancedMode ? analysisCsv : selectedDataCsv;
  const selectedDataSummary = useMemo(() => summarizeSessionCsv(selectedDataCsv), [selectedDataCsv]);
  const graphSourcePoints = useMemo(() => parseSessionGraphData(visibleAnalysisCsv, maxGraphSourcePoints), [visibleAnalysisCsv]);
  const activeGraphScale = advancedMode || graphScale === "all" || graphScale === "30s" ? graphScale : "all";
  const sessionGraphPoints = useMemo(
    () => windowGraphPoints(graphSourcePoints, activeGraphScale, advancedMode ? 180 : 120),
    [graphSourcePoints, activeGraphScale, advancedMode],
  );
  const graphWindowLabel = useMemo(
    () => formatGraphWindowLabel(sessionGraphPoints, graphSourcePoints, activeGraphScale, advancedMode),
    [sessionGraphPoints, graphSourcePoints, activeGraphScale, advancedMode],
  );
  const sessionObservations = useMemo(() => flagSessionObservations(visibleAnalysisCsv), [visibleAnalysisCsv]);
  const simpleDataWindow = selectedDataCsv.trim() ? formatDuration(selectedDataSummary.durationSec) : "--";
  const waterTargetLabel = calibration.mode === "water" && calibration.targetCm ? `${calibration.targetCm} cmH2O` : "4 cmH2O";
  const waterSetupReady = waterSetupItems.every((item) => waterSetupChecks[item.key]);
  const simpleWaterStartDisabled = busy;
  const waterSetupCompleted = waterSetupItems.filter((item) => waterSetupChecks[item.key]).length;
  const waterCapturedCount = Math.min(17, Math.max(0, Math.floor(calibration.capturedPoints)));
  const simpleSetupRunning = calibration.mode === "water" && calibration.active;
  const waterSetupSaved = !calibration.active && calibration.curveValid && waterCapturedCount === waterColumnTargets.length;
  const showSimpleWaterStart = calibrationStartAllowed && waterSetupReady;
  const showSimpleWaterCapture = canUseDevice && simpleSetupRunning;
  const showSimpleWaterStop = canUseDevice && simpleSetupRunning;
  const activeWaterTarget =
    calibration.mode === "water" && calibration.targetCm >= 4 && calibration.targetCm <= 20
      ? calibration.targetCm
      : waterColumnTargets[Math.min(waterCapturedCount, waterColumnTargets.length - 1)];
  const simpleSetupStatus = simpleSetupRunning
    ? `Match ${waterTargetLabel}`
    : waterSetupSaved
      ? "Saved"
      : waterSetupReady
        ? "Ready to start"
        : `${waterSetupCompleted}/${waterSetupItems.length} checks done`;
  const showStatusLine = advancedMode || busy || scanning || Boolean(message.trim());
  writeGuardsRef.current = {
    busy,
    protocolCompatible,
    settingsWriteAllowed,
    calibrationStartAllowed,
    waterCaptureAllowed,
    calibrationAbortAllowed,
    otaAllowed,
    otaInProgress,
    waterSetupReady,
  };

  useEffect(() => {
    restoreUiPreferences();
    restorePrewarmSchedule();
    restoreRetainedImports();
    restoreLiveSyncSpool();
    if (blePreviewMode) {
      setBleState("Unsupported" as State);
      setMessage("Previewing the app layout.");
      return () => {
        cleanupSubscriptions();
        cleanupOximeterSubscriptions();
        clearAutoImportRetry();
        oximeterSessionIdRef.current += 1;
        oximetryRelayRef.current?.clearPending();
        stopScan();
        stopOximeterScan();
      };
    }

    const nativeManager = new BleManager();
    managerRef.current = nativeManager;
    const manager = managerRef.current;
    const stateSub = manager.onStateChange((state) => {
      setBleState(state);
      if (state !== "PoweredOn") {
        stopScan();
        stopOximeterScan();
        setDevices([]);
        cleanupOximeterSubscriptions();
        resetOximeterSessionState();
        if (connectedDeviceRef.current) {
          cleanupSubscriptions();
          resetDeviceSessionState();
          flushLiveSyncCsv();
        }
        if (state !== "Unknown") setMessage(advancedModeRef.current ? `Bluetooth ${state}. Turn Bluetooth on before scanning.` : "Turn Bluetooth on to pair.");
      }
    }, true);

    return () => {
      const activeDevice = connectedDeviceRef.current;
      const activeOximeter = oximeterDeviceRef.current;
      stateSub.remove();
      cleanupSubscriptions();
      cleanupOximeterSubscriptions();
      clearAutoImportRetry();
      oximeterSessionIdRef.current += 1;
      oximetryRelayRef.current?.clearPending();
      stopScan();
      stopOximeterScan();
      flushLiveSyncCsv();
      const closeManager = () => {
        manager.destroy();
        if (managerRef.current === manager) managerRef.current = null;
      };
      const closeTasks = [activeDevice, activeOximeter]
        .filter((device): device is Device => Boolean(device))
        .map((device) => manager.cancelDeviceConnection(device.id).catch(() => undefined));
      if (closeTasks.length > 0) {
        void Promise.all(closeTasks).finally(closeManager);
      } else {
        closeManager();
      }
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setOximetryNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const wasAdvanced = previousAdvancedModeRef.current;
    previousAdvancedModeRef.current = advancedMode;
    advancedModeRef.current = advancedMode;
    if (wasAdvanced && !advancedMode) {
      setMessage("");
      setShowBuilderOptions(false);
    }
    if (!uiPreferenceReadyRef.current) return;
    writeUiPreferences(advancedMode);
  }, [advancedMode]);

  useEffect(() => {
    if (simpleDataDays.length === 0) {
      if (selectedDataDayKey !== "day-0") setSelectedDataDayKey("day-0");
      return;
    }
    if (!simpleDataDays.some((day) => day.key === selectedDataDayKey)) {
      setSelectedDataDayKey(simpleDataDays[0].key);
    }
  }, [selectedDataDayKey, simpleDataDays]);

  useEffect(() => {
    if (!connectedDevice) return;
    const manager = managerRef.current;
    if (!manager) return;
    const sessionId = deviceSessionIdRef.current;
    const disconnectSub = manager.onDeviceDisconnected(connectedDevice.id, () => {
      if (!isCurrentDeviceSession(connectedDevice, sessionId)) return;
      cleanupSubscriptions();
      if (!resetDeviceSessionState(sessionId)) return;
      flushLiveSyncCsv();
      setMessage("Device disconnected.");
    });
    return () => disconnectSub.remove();
  }, [connectedDevice]);

  useEffect(() => {
    const previousMode = previousModeRef.current;
    const nextMode = telemetry.mode;
    previousModeRef.current = nextMode;

    const wasTherapyActive = previousMode === "1" || previousMode === "2";
    const isTherapyActive = nextMode === "1" || nextMode === "2";
    if (!wasTherapyActive && isTherapyActive) {
      autoImportPendingSessionRef.current = null;
      autoImportRetryCountRef.current = 0;
      clearAutoImportRetry(false);
      resetLiveSync();
    }
    if (wasTherapyActive && !isTherapyActive) {
      autoImportPendingSessionRef.current = deviceSessionIdRef.current;
      autoImportRetryCountRef.current = 0;
      clearAutoImportRetry(false);
    }
    const sessionId = deviceSessionIdRef.current;
    const machineSettled =
      autoImportPendingSessionRef.current === sessionId && (nextMode === "0" || nextMode === "4");
    if (
      !machineSettled ||
      !connectedDevice ||
      !protocolCompatible ||
      calibration.active ||
      otaInProgress ||
      busy ||
      autoImportingSessionRef.current === sessionId
    ) {
      return;
    }

    autoImportPendingSessionRef.current = null;
    autoImportingSessionRef.current = sessionId;
    void loadLogsFromDevice("auto", connectedDevice, sessionId)
      .then((result) => {
        if (result === "failed" || result === "unavailable") scheduleAutoImportRetry(connectedDevice, sessionId);
        if (result === "imported" || result === "empty") {
          autoImportRetryCountRef.current = 0;
          clearAutoImportRetry(false);
        }
      })
      .finally(() => {
        if (autoImportingSessionRef.current === sessionId) {
          autoImportingSessionRef.current = null;
        }
      });
  }, [telemetry.mode, connectedDevice, protocolCompatible, calibration.active, otaInProgress, busy, autoImportRetryTick]);

  const connectionLabel = useMemo(() => {
    if (connectedDevice) return `Connected to ${connectedName}`;
    if (bleState !== "PoweredOn") return `Bluetooth ${bleState}`;
    if (scanning) return "Scanning for Ozealis";
    return "Not connected";
  }, [bleState, connectedDevice, connectedName, scanning]);

  useEffect(() => {
    if (!advancedMode && screen === "ota") setScreen("about");
  }, [advancedMode, screen]);

  useEffect(() => {
    if (!prewarmScheduleReadyRef.current) return;
    writePrewarmSchedule(prewarmSchedule);
  }, [prewarmSchedule]);

  useEffect(() => {
    if (!prewarmSchedule.enabled) return;
    const timer = setInterval(() => {
      const now = new Date();
      if (!isPrewarmScheduleDue(prewarmSchedule, now)) return;
      const skipKey = prewarmScheduleRunKey(now);
      if (!prewarmStartAllowed || writeGuardsRef.current.busy) {
        if (prewarmScheduleSkipKeyRef.current !== skipKey) {
          prewarmScheduleSkipKeyRef.current = skipKey;
          setMessage(
            advancedModeRef.current
              ? "Scheduled prewarm waiting; device is not idle, ready, connected, or configured for water-warmer prewarm."
              : "Scheduled prewarm waiting.",
          );
        }
        return;
      }
      prewarmScheduleSkipKeyRef.current = "";
      setPrewarmSchedule(markPrewarmScheduleRun(prewarmSchedule, now));
      void sendControlCommand("prewarmStart");
    }, 15000);
    return () => clearInterval(timer);
  }, [prewarmSchedule, prewarmStartAllowed]);

  async function requestBlePermissions() {
    if (Platform.OS !== "android") return true;

    if (Platform.Version >= 31) {
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);
      return Object.values(result).every((value) => value === PermissionsAndroid.RESULTS.GRANTED);
    }

    const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }

  async function startScan() {
    const manager = managerRef.current;
    if (!manager || blePreviewMode) {
      setMessage(advancedMode ? "Bluetooth scanning is available only in the Android or iOS app." : "Pairing is available in the phone app.");
      return;
    }
    const allowed = await requestBlePermissions();
    if (!allowed) {
      setMessage(advancedMode ? "Bluetooth permission is required to scan." : "Allow Bluetooth to pair.");
      return;
    }
    if (bleState !== "PoweredOn") {
      setMessage(advancedMode ? "Turn Bluetooth on before scanning." : "Turn Bluetooth on to pair.");
      return;
    }

    setDevices([]);
    setScanning(true);
    stopScan(false);
    stopOximeterScan();
    manager.startDeviceScan([OZEALIS_SERVICE_UUID], { allowDuplicates: false }, (error, device) => {
      if (error) {
        setMessage(actionErrorMessage(error, "Could not scan. Try again.", "Scan failed."));
        stopScan();
        return;
      }
      if (!device || !isOzealisDevice(device)) return;
      setDevices((current) => {
        if (current.some((item) => item.id === device.id)) return current;
        return [...current, device];
      });
    });

    scanTimeoutRef.current = setTimeout(() => stopScan(), 12000);
  }

  async function connect(device: Device) {
    const sessionId = deviceSessionIdRef.current + 1;
    deviceSessionIdRef.current = sessionId;
    protocolVersionRef.current = "unknown";
    setSettingsReadbackValid(false);
    cleanupSubscriptions();
    setBusy(true);
    setMessage("Connecting...");
    let discovered: Device | null = null;
    let connectedForCleanup: Device | null = null;
    try {
      stopScan();
      setDevices([]);
      oximetryRelayRef.current?.clearPending();
      await oximetryRelayRef.current?.whenIdle();
      if (deviceSessionIdRef.current !== sessionId) return;
      const connected = await device.connect({ timeout: 12000 });
      connectedForCleanup = connected;
      let mtuReady = connected;
      if (Platform.OS === "android") {
        mtuReady = await connected.requestMTU(517).catch(() => connected);
        connectedForCleanup = mtuReady;
      }
      discovered = await mtuReady.discoverAllServicesAndCharacteristics();
      if (deviceSessionIdRef.current !== sessionId) {
        await managerRef.current?.cancelDeviceConnection(discovered.id).catch(() => undefined);
        return;
      }
      connectedDeviceRef.current = discovered;
      previousModeRef.current = EMPTY_TELEMETRY.mode;
      const nextProtocol = await loadProtocol(discovered, sessionId);
      await loadSettings(discovered, sessionId);
      await loadDriverParams(discovered, sessionId);
      if (!isCurrentDeviceSession(discovered, sessionId)) {
        await managerRef.current?.cancelDeviceConnection(discovered.id).catch(() => undefined);
        return;
      }
      subscribeTelemetry(discovered, sessionId);
      if (!isCurrentDeviceSession(discovered, sessionId)) {
        await managerRef.current?.cancelDeviceConnection(discovered.id).catch(() => undefined);
        return;
      }
      setLiveSyncSessionActive(false);
      setConnectedDevice(discovered);
      setMessage(
        nextProtocol === OZEALIS_PROTOCOL_VERSION
          ? advancedMode
            ? "Connected. Review settings before changing output behavior."
            : "Connected."
          : advancedMode
            ? `Connected, but protocol ${nextProtocol} does not match ${OZEALIS_PROTOCOL_VERSION}. Writes disabled.`
            : "Connected. Update the app or firmware before starting.",
      );
    } catch (error) {
      if (deviceSessionIdRef.current !== sessionId) {
        if (connectedForCleanup) {
          await managerRef.current?.cancelDeviceConnection(connectedForCleanup.id).catch(() => undefined);
        }
        return;
      }
      cleanupSubscriptions();
      if (connectedForCleanup) {
        await managerRef.current?.cancelDeviceConnection(connectedForCleanup.id).catch(() => undefined);
      }
      resetDeviceSessionState(sessionId);
      setMessage(actionErrorMessage(error, "Could not connect. Try pairing again.", "Connection failed."));
    } finally {
      if (deviceSessionIdRef.current === sessionId) setBusy(false);
    }
  }

  async function startOximeterScan() {
    const manager = managerRef.current;
    if (!manager || blePreviewMode) {
      setMessage(advancedMode ? "Bluetooth oximetry is available only in the Android or iOS app." : "Oximeter pairing is available in the phone app.");
      return;
    }
    const allowed = await requestBlePermissions();
    if (!allowed) {
      setMessage(advancedMode ? "Bluetooth permission is required to scan for an oximeter." : "Allow Bluetooth to pair an oximeter.");
      return;
    }
    if (bleState !== "PoweredOn") {
      setMessage(advancedMode ? "Turn Bluetooth on before scanning for an oximeter." : "Turn Bluetooth on to pair an oximeter.");
      return;
    }

    stopScan(false);
    setScanning(false);
    stopOximeterScan(false);
    setOximeterScanning(true);
    setMessage(advancedMode ? "Scanning for a Bluetooth Pulse Oximeter Service device..." : "Looking for an oximeter...");
    manager.startDeviceScan([PLX_SERVICE_UUID], { allowDuplicates: false }, (error, device) => {
      if (error) {
        setMessage(actionErrorMessage(error, "Could not find an oximeter. Try again.", "Oximeter scan failed."));
        stopOximeterScan();
        return;
      }
      if (!device) return;
      void connectOximeter(device);
    });

    oximeterScanTimeoutRef.current = setTimeout(() => {
      stopOximeterScan();
      setMessage(advancedMode ? "No standard Bluetooth pulse oximeter found." : "No oximeter found.");
    }, 12000);
  }

  async function connectOximeter(device: Device) {
    const manager = managerRef.current;
    if (!manager) return;
    const sessionId = oximeterSessionIdRef.current + 1;
    oximeterSessionIdRef.current = sessionId;
    stopOximeterScan();
    cleanupOximeterSubscriptions();
    oximetryRelayRef.current?.clearPending();
    const previousOximeter = oximeterDeviceRef.current;
    oximeterDeviceRef.current = null;
    setOximeterDevice(null);
    setOximetrySample(null);
    await oximetryRelayRef.current?.whenIdle();
    if (oximeterSessionIdRef.current !== sessionId) return;
    if (previousOximeter) {
      await manager.cancelDeviceConnection(previousOximeter.id).catch(() => undefined);
    }
    if (oximeterSessionIdRef.current !== sessionId) return;
    try {
      const connected = await device.connect({ timeout: 12000 });
      if (oximeterSessionIdRef.current !== sessionId) {
        if (currentOximeterDeviceId() !== connected.id) {
          await manager.cancelDeviceConnection(connected.id).catch(() => undefined);
        }
        return;
      }
      const discovered = await connected.discoverAllServicesAndCharacteristics();
      if (oximeterSessionIdRef.current !== sessionId) {
        if (currentOximeterDeviceId() !== discovered.id) {
          await manager.cancelDeviceConnection(discovered.id).catch(() => undefined);
        }
        return;
      }
      oximeterDeviceRef.current = discovered;
      const sub = discovered.monitorCharacteristicForService(
        PLX_SERVICE_UUID,
        PLX_CONTINUOUS_MEASUREMENT_UUID,
        (error, characteristic) => {
          if (!isCurrentOximeterSession(discovered, sessionId)) return;
          if (error) {
            cleanupOximeterSubscriptions();
            if (!resetOximeterSessionState(sessionId)) return;
            setMessage(advancedModeRef.current ? `Oximeter disconnected: ${error.message}` : "Oximeter disconnected.");
            return;
          }
          const sample = parsePlxContinuousMeasurement(characteristic?.value);
          if (!sample) return;
          setOximetrySample(sample);
          const ozealisDevice = connectedDeviceRef.current;
          const ozealisSessionId = deviceSessionIdRef.current;
          if (
            !ozealisDevice ||
            !isCompatibleDeviceSession(
              connectedDeviceRef.current?.id,
              deviceSessionIdRef.current,
              protocolVersionRef.current,
              ozealisDevice.id,
              ozealisSessionId,
              OZEALIS_PROTOCOL_VERSION,
            )
          ) {
            return;
          }
          oximetryRelayRef.current?.push({
            sample,
            oximeterDeviceId: discovered.id,
            oximeterSessionId: sessionId,
            ozealisDeviceId: ozealisDevice.id,
            ozealisSessionId,
          });
        },
      );
      if (!isCurrentOximeterSession(discovered, sessionId)) {
        sub.remove();
        return;
      }
      oximeterSubscriptionsRef.current.push(sub);
      setOximeterDevice(discovered);
      setMessage(advancedMode ? "Oximeter connected; SpO2 and pulse will be relayed while Ozealis is connected." : "Oximeter connected.");
    } catch (error) {
      if (oximeterSessionIdRef.current !== sessionId) return;
      await manager.cancelDeviceConnection(device.id).catch(() => undefined);
      cleanupOximeterSubscriptions();
      resetOximeterSessionState(sessionId);
      setMessage(actionErrorMessage(error, "Could not connect the oximeter.", "Oximeter connection failed."));
    }
  }

  async function disconnectOximeter() {
    const device = oximeterDevice;
    const sessionId = oximeterSessionIdRef.current;
    cleanupOximeterSubscriptions();
    if (!resetOximeterSessionState(sessionId)) return;
    await oximetryRelayRef.current?.whenIdle();
    if (device) await managerRef.current?.cancelDeviceConnection(device.id).catch(() => undefined);
    setMessage("Oximeter disconnected.");
  }

  async function disconnect() {
    if (!connectedDevice) return;
    const sessionId = deviceSessionIdRef.current;
    const deviceId = connectedDevice.id;
    setBusy(true);
    cleanupSubscriptions();
    protocolVersionRef.current = "unknown";
    oximetryRelayRef.current?.clearPending();
    await oximetryRelayRef.current?.whenIdle();
    let disconnectError: unknown = null;
    let sessionReset = false;
    try {
      await managerRef.current?.cancelDeviceConnection(deviceId);
    } catch (error) {
      disconnectError = error;
    } finally {
      sessionReset = resetDeviceSessionState(sessionId);
      if (sessionReset) flushLiveSyncCsv();
    }
    if (!sessionReset) return;
    setMessage(disconnectError ? actionErrorMessage(disconnectError, "Disconnected.", "Disconnected locally; BLE close reported an error.") : "Disconnected.");
  }

  function resetDeviceSessionState(expectedSessionId = deviceSessionIdRef.current): boolean {
    if (deviceSessionIdRef.current !== expectedSessionId) return false;
    autoImportingSessionRef.current = null;
    autoImportPendingSessionRef.current = null;
    autoImportRetryCountRef.current = 0;
    clearAutoImportRetry(false);
    oximetryRelayRef.current?.clearPending();
    connectedDeviceRef.current = null;
    setConnectedDevice(null);
    setBusy(false);
    setDevices([]);
    setTelemetry({ ...EMPTY_TELEMETRY });
    setSettings({ ...DEFAULT_SETTINGS });
    setSettingsReadbackValid(false);
    protocolVersionRef.current = "unknown";
    setProtocolVersion("unknown");
    setDriverParamsJson("");
    setOtaSsid("");
    setOtaPassword("");
    setOtaUrl("");
    setLiveSyncSessionActive(false);
    setWaterSetupChecks({ ...emptyWaterSetupChecks });
    previousModeRef.current = EMPTY_TELEMETRY.mode;
    return true;
  }

  function isCurrentOximeterSession(device: Device | null, sessionId: number) {
    return isSameDeviceSession(
      oximeterDeviceRef.current?.id,
      oximeterSessionIdRef.current,
      device?.id,
      sessionId,
    );
  }

  function currentOximeterDeviceId() {
    return oximeterDeviceRef.current?.id;
  }

  function resetOximeterSessionState(expectedSessionId = oximeterSessionIdRef.current): boolean {
    if (oximeterSessionIdRef.current !== expectedSessionId) return false;
    oximeterSessionIdRef.current += 1;
    oximetryRelayRef.current?.clearPending();
    oximeterDeviceRef.current = null;
    setOximeterDevice(null);
    setOximetrySample(null);
    setOximeterScanning(false);
    return true;
  }

  function clearAutoImportRetry(resetCount = true) {
    if (autoImportRetryTimeoutRef.current) {
      clearTimeout(autoImportRetryTimeoutRef.current);
      autoImportRetryTimeoutRef.current = null;
    }
    if (resetCount) autoImportRetryCountRef.current = 0;
  }

  function scheduleAutoImportRetry(device: Device, sessionId: number) {
    if (!isCurrentDeviceSession(device, sessionId)) return;
    autoImportRetryCountRef.current += 1;
    if (autoImportRetryCountRef.current >= autoImportMaxAttempts) {
      autoImportPendingSessionRef.current = null;
      clearAutoImportRetry(false);
      return;
    }
    autoImportPendingSessionRef.current = sessionId;
    clearAutoImportRetry(false);
    autoImportRetryTimeoutRef.current = setTimeout(() => {
      autoImportRetryTimeoutRef.current = null;
      if (
        autoImportPendingSessionRef.current === sessionId &&
        isCurrentDeviceSession(device, sessionId)
      ) {
        setAutoImportRetryTick((current) => current + 1);
      }
    }, autoImportRetryDelayMs);
  }

  function stopScan(updateState = true) {
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    managerRef.current?.stopDeviceScan();
    if (updateState) setScanning(false);
  }

  function stopOximeterScan(updateState = true) {
    if (oximeterScanTimeoutRef.current) {
      clearTimeout(oximeterScanTimeoutRef.current);
      oximeterScanTimeoutRef.current = null;
    }
    managerRef.current?.stopDeviceScan();
    if (updateState) setOximeterScanning(false);
  }

  function isCurrentConnectedDevice(device: Device | null) {
    return Boolean(device && connectedDeviceRef.current === device);
  }

  function isCurrentDeviceSession(device: Device | null, sessionId: number) {
    return isSameDeviceSession(
      connectedDeviceRef.current?.id,
      deviceSessionIdRef.current,
      device?.id,
      sessionId,
    );
  }

  async function loadSettings(device = connectedDevice, sessionId = deviceSessionIdRef.current) {
    if (!device) return;
    if (isCurrentDeviceSession(device, sessionId)) setSettingsReadbackValid(false);
    const raw = await readUtf8(device, OZEALIS_CHARACTERISTICS.settings);
    if (!isCurrentDeviceSession(device, sessionId)) return;
    const parsed = parseSettingsReadback(raw);
    if (!parsed) {
      setSettingsReadbackValid(false);
      throw new Error("Settings readback was incomplete or invalid.");
    }
    setSettings(parsed);
    setSettingsReadbackValid(true);
  }

  async function refreshSettings() {
    if (!connectedDevice) return;
    const readDevice = connectedDevice;
    const sessionId = deviceSessionIdRef.current;
    setBusy(true);
    try {
      await loadSettings(readDevice, sessionId);
      if (!isCurrentDeviceSession(readDevice, sessionId)) return;
      setMessage(advancedModeRef.current ? "Settings loaded from device." : "Comfort updated.");
    } catch (error) {
      if (!isCurrentDeviceSession(readDevice, sessionId)) return;
      setMessage(actionErrorMessage(error, "Could not update comfort.", "Could not read settings."));
    } finally {
      if (isCurrentDeviceSession(readDevice, sessionId)) setBusy(false);
    }
  }

  async function loadProtocol(device = connectedDevice, sessionId = deviceSessionIdRef.current): Promise<string> {
    if (!device) return "unknown";
    try {
      const raw = await readUtf8(device, OZEALIS_CHARACTERISTICS.protocol);
      const next = raw || "unknown";
      if (!isCurrentDeviceSession(device, sessionId)) return "unknown";
      protocolVersionRef.current = next;
      setProtocolVersion(next);
      return next;
    } catch {
      if (!isCurrentDeviceSession(device, sessionId)) return "unknown";
      protocolVersionRef.current = "unknown";
      setProtocolVersion("unknown");
      return "unknown";
    }
  }

  async function loadDriverParams(device = connectedDevice, sessionId = deviceSessionIdRef.current) {
    if (!device) {
      setDriverParamsJson("");
      return "";
    }
    try {
      const params = await readUtf8(device, OZEALIS_CHARACTERISTICS.mcfParams);
      if (!isCurrentDeviceSession(device, sessionId)) return "";
      setDriverParamsJson(params);
      return params;
    } catch (error) {
      if (!isCurrentDeviceSession(device, sessionId)) return "";
      setDriverParamsJson("");
      throw error;
    }
  }

  function actionErrorMessage(error: unknown, simpleFallback: string, advancedFallback = simpleFallback) {
    if (!advancedModeRef.current) return simpleFallback;
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
          ? error.message
          : "";
    return message.trim() ? message : advancedFallback;
  }

  function modeAwareMessage(messageText: ModeAwareMessage) {
    return typeof messageText === "string" ? messageText : advancedModeRef.current ? messageText.advanced : messageText.simple;
  }

  async function confirmProtocolBeforeWrite(messageText: ModeAwareMessage, device = connectedDevice) {
    if (!device) return false;
    const nextProtocol = await loadProtocol(device);
    if (!isCurrentConnectedDevice(device)) return false;
    if (nextProtocol === OZEALIS_PROTOCOL_VERSION) return true;
    Alert.alert(advancedModeRef.current ? "Protocol mismatch" : "Update app or firmware", modeAwareMessage(messageText));
    return false;
  }

  async function confirmDriverSnapshotBeforeMotorAction(messageText: ModeAwareMessage, device = connectedDevice) {
    if (!device) return false;
    try {
      const raw = await loadDriverParams(device);
      if (!isCurrentConnectedDevice(device)) return false;
      const snapshot = parseMcfParamsSnapshot(raw);
      const snapshotCommandReady =
        snapshot.driver === "MCF8316D" &&
        snapshot.i2c === true &&
        snapshot.fault === false &&
        snapshot.targetSpeed === "i2c" &&
        snapshot.commandReady;
      if (snapshotCommandReady) return true;
      Alert.alert(advancedModeRef.current ? "Motor command unavailable" : "Use standby", modeAwareMessage(messageText));
      return false;
    } catch {
      Alert.alert(
        advancedModeRef.current ? "Motor command unavailable" : "Use standby",
        advancedModeRef.current ? "Could not reread the MCF8316D parameter snapshot." : modeAwareMessage(messageText),
      );
      return false;
    }
  }

  async function saveSettings() {
    if (!connectedDevice) return;
    if (!protocolCompatible) {
      Alert.alert(
        advancedMode ? "Protocol mismatch" : "Update app or firmware",
        advancedMode ? "Writes require the expected Ozealis BLE protocol version." : "This app and device do not match. Update the app or firmware, then try again.",
      );
      return;
    }
    if (!settingsWriteAllowed) {
      Alert.alert(
        advancedMode ? "Settings require idle" : "Save from standby",
        advancedMode ? "Stop airflow, clear active faults, and wait for calibration to finish or abort before writing settings." : "Stop airflow or setup, then try again.",
      );
      return;
    }
    const safe = sanitizeSettings(settings);
    const limitMessages = advancedMode ? settingLimitMessages(settings) : simpleSettingLimitMessages(settings, safe);
    if (limitMessages.length > 0) {
      setSettings(safe);
      Alert.alert(advancedMode ? "Review adjusted settings" : "Comfort adjusted", limitMessages.join("\n"));
      setMessage(advancedMode ? "Settings adjusted to firmware limits. Review and write again." : "Comfort settings adjusted. Review and save again.");
      return;
    }
    setBusy(true);
    const writeDevice = connectedDevice;
    const sessionId = deviceSessionIdRef.current;
    try {
      if (!isCurrentDeviceSession(writeDevice, sessionId)) return;
      if (
        !(await confirmProtocolBeforeWrite({
          advanced: "Writes require the expected Ozealis BLE protocol version.",
          simple: "This app and device do not match. Update the app or firmware, then try again.",
        }, writeDevice))
      ) {
        return;
      }
      if (
        !(await confirmIdleNoCalibrationBeforeWrite(
          {
            advanced: "Settings writes require a fresh idle, no-fault, no-calibration readback before changing pressure settings.",
            simple: "Stop airflow or setup, then try again.",
          },
          writeDevice,
        ))
      ) {
        return;
      }
      if (!isCurrentDeviceSession(writeDevice, sessionId)) return;
      setSettingsReadbackValid(false);
      await writeUtf8(writeDevice, OZEALIS_CHARACTERISTICS.settings, serializeSettings(safe));
      const settingsReadback = await readUtf8(writeDevice, OZEALIS_CHARACTERISTICS.settings);
      if (!isCurrentDeviceSession(writeDevice, sessionId)) return;
      const confirmed = parseSettingsReadback(settingsReadback);
      const readbackValid = confirmed !== null;
      const settingsVerified = confirmed !== null && serializeSettings(confirmed) === serializeSettings(safe);
      setSettingsReadbackValid(readbackValid);
      if (confirmed) setSettings(confirmed);
      const messageAdvanced = advancedModeRef.current;
      setMessage(
        messageAdvanced
          ? !readbackValid
            ? "Settings write not verified; settings readback was invalid."
            : settingsVerified
            ? "Settings written and verified from device NVS."
            : "Settings write completed; device returned adjusted values."
          : !readbackValid
            ? "Comfort did not verify. Update comfort before saving again."
            : settingsVerified
            ? "Comfort saved."
            : "Comfort saved with device adjustments.",
      );
    } catch (error) {
      if (!isCurrentDeviceSession(writeDevice, sessionId)) return;
      setSettingsReadbackValid(false);
      setMessage(actionErrorMessage(error, "Comfort did not save. Try again from standby.", "Settings write failed."));
    } finally {
      if (isCurrentDeviceSession(writeDevice, sessionId)) setBusy(false);
    }
  }

  function subscribeTelemetry(device: Device, sessionId: number) {
    cleanupSubscriptions();
    const subscribe = (key: keyof OzealisTelemetry, uuid: string) => {
      if (!isCurrentDeviceSession(device, sessionId)) return;
      const sub = subscribeText(
        device,
        uuid,
        (value) => updateTelemetryValue(device, sessionId, key, value),
        (errorMessage) => handleTelemetrySubscriptionError(device, sessionId, errorMessage),
      );
      if (!isCurrentDeviceSession(device, sessionId)) {
        sub.remove();
        return;
      }
      subscriptionsRef.current.push(sub);
    };

    subscribe("pressure", OZEALIS_CHARACTERISTICS.pressure);
    subscribe("flow", OZEALIS_CHARACTERISTICS.flow);
    subscribe("setpoint", OZEALIS_CHARACTERISTICS.setpoint);
    subscribe("vin", OZEALIS_CHARACTERISTICS.vin);
    subscribe("mode", OZEALIS_CHARACTERISTICS.mode);
    subscribe("fault", OZEALIS_CHARACTERISTICS.fault);
    subscribe("ahi", OZEALIS_CHARACTERISTICS.ahi);
    subscribe("humidifierTemp", OZEALIS_CHARACTERISTICS.humidifierTemp);
    subscribe("humidifierRh", OZEALIS_CHARACTERISTICS.humidifierRh);
    subscribe("hoseTemp", OZEALIS_CHARACTERISTICS.hoseTemp);
    subscribe("moduleStatus", OZEALIS_CHARACTERISTICS.moduleStatus);
    subscribe("oximetry", OZEALIS_CHARACTERISTICS.oximetry);
    subscribe("liveCsv", OZEALIS_CHARACTERISTICS.liveCsv);
    subscribe("otaStatus", OZEALIS_CHARACTERISTICS.otaStatus);
    subscribe("calibrationStatus", OZEALIS_CHARACTERISTICS.calibrationStatus);
  }

  function handleTelemetrySubscriptionError(device: Device, sessionId: number, errorMessage: string) {
    if (!isCurrentDeviceSession(device, sessionId)) return;
    cleanupSubscriptions();
    if (!resetDeviceSessionState(sessionId)) return;
    flushLiveSyncCsv();
    setMessage(advancedModeRef.current && errorMessage.trim() ? errorMessage : "Connection needs attention.");
  }

  function updateTelemetryValue(device: Device, sessionId: number, key: keyof OzealisTelemetry, value: string) {
    if (!isCurrentDeviceSession(device, sessionId)) return;
    if (key === "liveCsv" && value) {
      captureLiveCsv(value);
    }
    setTelemetry((current) => {
      if (!isCurrentDeviceSession(device, sessionId)) return current;
      const receivedAt = Date.now();
      const normalizedValue =
        key === "otaStatus"
          ? parseOtaStatus(value || "")
          : key === "mode"
            ? parseSystemMode(value || "")
            : key === "fault"
              ? parseFaultCode(value || "")
              : key === "moduleStatus"
                ? parseModuleStatus(value || "")
                : key === "humidifierTemp" || key === "humidifierRh" || key === "hoseTemp"
                  ? parseOptionalTelemetryNumber(value || "")
                  : value || "--";
      const next = { ...current, [key]: normalizedValue, updatedAt: receivedAt };
      if (key === "oximetry") next.oximetryReceivedAt = receivedAt;
      if (key === "liveCsv" && value) {
        const parsed = parseLiveCsvDiagnostics(value);
        next.controllerMeasured = parsed.measuredCm;
        next.controllerError = parsed.errorCm;
        next.controllerAmp = parsed.amp;
        next.motorCommand = parsed.motorCmd;
        next.motorFault = parsed.motorFault;
        next.motorI2c = parsed.motorI2c;
        next.motorFgHz = parsed.motorFgHz;
      }
      return next;
    });
  }

  function resetLiveSync() {
    liveSyncRowsRef.current = [];
    liveSyncPendingRowsRef.current = [];
    liveSyncLastMsRef.current = 0;
    liveSyncLastUiMsRef.current = 0;
    setLiveSyncSessionActive(false);
    setLiveSyncCsv("");
    setLiveSyncRowCount(0);
    writeLiveSyncSpool([]);
  }

  function flushLiveSyncCsv() {
    const rows = liveSyncRowsRef.current;
    setLiveSyncCsv(formatLiveSyncCsv(rows));
    setLiveSyncRowCount(rows.length);
    flushLiveSyncSpool();
  }

  async function restoreUiPreferences() {
    try {
      const file = new File(Paths.document, uiPreferenceFileName);
      if (!file.exists) {
        uiPreferenceReadyRef.current = true;
        return;
      }
      const raw = await file.text();
      setAdvancedMode(parseUiPreference(raw));
    } catch {
      setAdvancedMode(false);
    } finally {
      uiPreferenceReadyRef.current = true;
    }
  }

  function writeUiPreferences(nextAdvancedMode: boolean) {
    try {
      const file = new File(Paths.document, uiPreferenceFileName);
      file.write(`${JSON.stringify({ advancedMode: nextAdvancedMode })}\n`);
    } catch {
      // Simple mode remains the safe default if local preference storage is unavailable.
    }
  }

  async function restorePrewarmSchedule() {
    try {
      const file = new File(Paths.document, prewarmScheduleFileName);
      if (!file.exists) {
        prewarmScheduleReadyRef.current = true;
        return;
      }
      setPrewarmSchedule(parsePrewarmSchedule(await file.text()));
    } catch {
      setPrewarmSchedule({ ...DEFAULT_PREWARM_SCHEDULE });
    } finally {
      prewarmScheduleReadyRef.current = true;
    }
  }

  function writePrewarmSchedule(nextSchedule: PrewarmSchedule) {
    try {
      const file = new File(Paths.document, prewarmScheduleFileName);
      file.write(serializePrewarmSchedule(nextSchedule));
    } catch {
      // Scheduled prewarm is a convenience; manual prewarm remains available if local storage fails.
    }
  }

  async function restoreRetainedImports() {
    const manifestRaw = await readStoredText(retainedImportManifestFileName);
    const manifest = parseRetainedImportManifest(manifestRaw);
    if (!manifest) return;
    const sessionCsv = await readStoredText(retainedSessionImportFileName);
    const faultLogCsv = await readStoredText(retainedFaultImportFileName);
    if (
      !retainedCsvMatchesIdentity(sessionCsv, manifest.session, normalizeRetainedSessionSnapshot) ||
      !retainedCsvMatchesIdentity(faultLogCsv, manifest.fault, normalizeFaultSnapshot)
    ) {
      return;
    }
    setRetainedImport({ sessionCsv, faultCsv: faultLogCsv, manifest });
  }

  async function readStoredText(fileName: string) {
    try {
      const file = new File(Paths.document, fileName);
      if (!file.exists) return "";
      return await file.text();
    } catch {
      return "";
    }
  }

  function retainedCsvMatchesIdentity(
    raw: string,
    identity: RetainedImportManifest["session"],
    normalize: (value: string) => string | null,
  ) {
    return (
      Buffer.byteLength(raw, "utf8") === identity.total &&
      csvTransferHash(raw) === identity.hash &&
      normalize(raw) === raw
    );
  }

  function validateRetainedSnapshotPair(pair: RetainedSnapshotPair) {
    if (
      !retainedCsvMatchesIdentity(pair.session.csv, pair.session, normalizeRetainedSessionSnapshot) ||
      !retainedCsvMatchesIdentity(pair.fault.csv, pair.fault, normalizeFaultSnapshot)
    ) {
      throw new Error("Retained CSV snapshot format or metadata is invalid.");
    }
  }

  function commitRetainedSnapshotPair(deviceId: string, pair: RetainedSnapshotPair, verifiedClear = false) {
    validateRetainedSnapshotPair(pair);
    const importedRows = retainedReadbackImportedRowCount(pair.session.csv, pair.fault.csv);
    if (importedRows === 0 && !verifiedClear) return 0;
    const manifest: RetainedImportManifest = {
      version: 1,
      deviceId,
      importedAtMs: Date.now(),
      session: {
        generation: pair.session.generation,
        total: pair.session.total,
        hash: pair.session.hash,
      },
      fault: {
        generation: pair.fault.generation,
        total: pair.fault.total,
        hash: pair.fault.hash,
      },
    };

    try {
      new File(Paths.document, retainedSessionImportFileName).write(pair.session.csv);
      new File(Paths.document, retainedFaultImportFileName).write(pair.fault.csv);
      // The manifest is the commit marker. A partial CSV write cannot restore against an older manifest.
      new File(Paths.document, retainedImportManifestFileName).write(serializeRetainedImportManifest(manifest));
    } catch {
      // The verified pair remains available in memory; an incomplete disk update fails closed on restore.
    }
    setRetainedImport({
      sessionCsv: pair.session.csv,
      faultCsv: pair.fault.csv,
      manifest,
    });
    return importedRows;
  }

  async function restoreLiveSyncSpool() {
    try {
      const file = new File(Paths.document, liveSyncSpoolFileName);
      if (!file.exists) {
        liveSyncSpoolReadyRef.current = true;
        return;
      }
      const restored = await file.text();
      const lines = liveSyncSpoolLines(restored);
      if (!lines) {
        liveSyncRowsRef.current = [];
        liveSyncLastMsRef.current = 0;
        setLiveSyncCsv("");
        setLiveSyncRowCount(0);
        writeLiveSyncSpool([]);
        return;
      }
      const sourceRows = lines.slice(1);
      const filteredRows = filterIncreasingLiveSyncRows(sourceRows);
      const rows = filteredRows.slice(-maxLiveSyncRows);
      liveSyncRowsRef.current = rows;
      liveSyncLastMsRef.current = rows.reduce((maxMs, row) => {
        const ms = Number(row.split(",")[0]);
        return Number.isFinite(ms) ? Math.max(maxMs, ms) : maxMs;
      }, 0);
      setLiveSyncCsv(formatLiveSyncCsv(rows));
      setLiveSyncRowCount(rows.length);
      if (rows.length < sourceRows.length || rows.length < filteredRows.length) {
        writeLiveSyncSpool(rows);
      }
    } catch {
      liveSyncRowsRef.current = [];
      liveSyncLastMsRef.current = 0;
      setLiveSyncCsv("");
      setLiveSyncRowCount(0);
      writeLiveSyncSpool([]);
    } finally {
      liveSyncSpoolReadyRef.current = true;
    }
  }

  function writeLiveSyncSpool(rows: string[]) {
    try {
      const file = new File(Paths.document, liveSyncSpoolFileName);
      const csv = formatLiveSyncCsv(rows);
      file.write(csv ? `${csv}\n` : "");
    } catch {
      // The in-memory live trace still remains exportable if document storage is unavailable.
    }
  }

  function filterIncreasingLiveSyncRows(rows: string[]) {
    let lastMs = -Infinity;
    let accepted: string[] = [];
    rows.forEach((row) => {
      if (!isValidLiveCsvRow(row)) return false;
      const parts = row.split(",");
      const mode = parts[5];
      if (mode !== "1" && mode !== "2") return false;
      const ms = Number(parts[0]);
      if (!Number.isFinite(ms)) return false;
      if (ms <= lastMs) {
        if (lastMs - ms <= liveSyncRestartBackstepMs) return false;
        accepted = [];
        lastMs = -Infinity;
      }
      if (Number.isFinite(lastMs) && ms - lastMs > liveSyncMaxSampleGapMs) {
        accepted = [];
      }
      lastMs = ms;
      accepted.push(row);
    });
    return accepted;
  }

  function flushLiveSyncSpool() {
    if (!liveSyncSpoolReadyRef.current) return;
    const pending = liveSyncPendingRowsRef.current;
    if (pending.length === 0) return;
    liveSyncPendingRowsRef.current = [];

    try {
      const file = new File(Paths.document, liveSyncSpoolFileName);
      if (!file.exists || liveSyncRowsRef.current.length === pending.length) {
        file.write(`${liveSyncCsvHeader}\n${pending.join("\n")}\n`);
        return;
      }
      const storedRows = readValidLiveSyncSpoolRows(file);
      if (!storedRows) {
        writeLiveSyncSpool(liveSyncRowsRef.current);
        return;
      }
      const expectedPending = liveSyncRowsRef.current.slice(storedRows.length);
      if (
        !rowsMatch(storedRows, liveSyncRowsRef.current.slice(0, storedRows.length)) ||
        !rowsMatch(pending, expectedPending)
      ) {
        writeLiveSyncSpool(liveSyncRowsRef.current);
        return;
      }
      if (liveSyncRowsRef.current.length >= maxLiveSyncRows) {
        writeLiveSyncSpool(liveSyncRowsRef.current);
        return;
      }
      file.write(`${pending.join("\n")}\n`, { append: true });
    } catch {
      // Persistence is best-effort; UI state and manual export continue to work.
    }
  }

  function rowsMatch(left: string[], right: string[]) {
    return left.length === right.length && left.every((row, index) => row === right[index]);
  }

  function readValidLiveSyncSpoolRows(file: File) {
    const lines = liveSyncSpoolLines(file.textSync());
    if (!lines) return null;
    if (lines.length === 0) return [] as string[];
    const rows = lines.slice(1);
    const filteredRows = filterIncreasingLiveSyncRows(rows);
    return filteredRows.length === rows.length ? rows : null;
  }

  function liveSyncSpoolLines(raw: string) {
    if (!raw.trim()) return [] as string[];
    const lines = raw.split(/\r?\n/);
    if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
    if (lines[0] !== liveSyncCsvHeader) return null;
    if (lines.some((line) => line !== line.trim() || line.length === 0)) return null;
    return lines;
  }

  function isCurrentLiveSyncRow(row: string) {
    return isValidLiveCsvRow(row) && row.split(",").length === 19;
  }

  function captureLiveCsv(value: string) {
    const row = value;
    const parts = row.split(",");
    if (!isCurrentLiveSyncRow(row)) return;
    const packetMs = Number(parts[0]);
    const mode = parts[5];
    if (!Number.isFinite(packetMs)) return;
    if (mode !== "1" && mode !== "2") return;
    if (packetMs <= liveSyncLastMsRef.current) {
      if (liveSyncLastMsRef.current - packetMs <= liveSyncRestartBackstepMs) return;
      resetLiveSync();
    }
    if (liveSyncRowsRef.current.length > 0 && packetMs - liveSyncLastMsRef.current > liveSyncMaxSampleGapMs) {
      resetLiveSync();
    }

    liveSyncLastMsRef.current = packetMs;
    setLiveSyncSessionActive(true);
    const firstLiveSyncRow = liveSyncRowsRef.current.length === 0;
    liveSyncRowsRef.current.push(row);
    liveSyncPendingRowsRef.current.push(row);
    if (liveSyncRowsRef.current.length > maxLiveSyncRows) {
      liveSyncRowsRef.current.splice(0, liveSyncRowsRef.current.length - maxLiveSyncRows);
    }
    setLiveSyncRowCount(liveSyncRowsRef.current.length);

    const now = Date.now();
    if (firstLiveSyncRow || now - liveSyncLastUiMsRef.current >= 1000) {
      liveSyncLastUiMsRef.current = now;
      flushLiveSyncCsv();
    }
  }

  function cleanupSubscriptions() {
    subscriptionsRef.current.forEach((subscription) => subscription.remove());
    subscriptionsRef.current = [];
  }

  function cleanupOximeterSubscriptions() {
    oximeterSubscriptionsRef.current.forEach((subscription) => subscription.remove());
    oximeterSubscriptionsRef.current = [];
  }

  function formatLiveSyncCsv(rows: string[]) {
    return rows.length > 0 ? `${liveSyncCsvHeader}\n${rows.join("\n")}` : "";
  }

  async function loadLogsFromDevice(
    reason: "manual" | "auto",
    readDevice = connectedDevice,
    sessionId = deviceSessionIdRef.current,
  ): Promise<RetainedLoadResult> {
    if (!readDevice) return "unavailable";
    const manualRead = reason === "manual";
    if (
      !isCompatibleDeviceSession(
        connectedDeviceRef.current?.id,
        deviceSessionIdRef.current,
        protocolVersionRef.current,
        readDevice.id,
        sessionId,
        OZEALIS_PROTOCOL_VERSION,
      )
    ) {
      if (manualRead) {
        Alert.alert("Protocol mismatch", "Retained log transfer requires the expected Ozealis BLE protocol version.");
      }
      return "unavailable";
    }
    if (!retainedReadAllowed) {
      if (manualRead) {
        Alert.alert("Logs unavailable", "Wait until airflow has stopped and setup or OTA activity has finished before reading retained logs.");
      }
      return "unavailable";
    }
    setBusy(true);
    try {
      const logs = await readCsvTransfer(readDevice, OZEALIS_CHARACTERISTICS.logDownload);
      if (!isCurrentDeviceSession(readDevice, sessionId)) return "stale";
      const faults = await readCsvTransfer(readDevice, OZEALIS_CHARACTERISTICS.faultCsv);
      if (!isCurrentDeviceSession(readDevice, sessionId)) return "stale";
      const pair = { session: logs, fault: faults };
      validateRetainedSnapshotPair(pair);
      const validImportedRows = retainedReadbackImportedRowCount(logs.csv, faults.csv);
      if (validImportedRows > 0) {
        commitRetainedSnapshotPair(readDevice.id, pair);
      }
      flushLiveSyncCsv();
      const messageAdvanced = advancedModeRef.current;
      setMessage(
        reason === "auto"
          ? messageAdvanced
            ? validImportedRows > 0
              ? "Machine stopped. Latest retained session, pressure, flow, and fault data imported."
              : "Machine stopped. Retained log readback had no valid rows."
            : validImportedRows > 0
              ? "Your data is ready."
              : "Data checked. No new rows yet."
          : messageAdvanced
            ? validImportedRows > 0
              ? "Logs loaded from device."
              : "Log readback had no valid rows."
            : validImportedRows > 0
              ? "Data updated."
              : "No data yet.",
      );
      return validImportedRows > 0 ? "imported" : "empty";
    } catch (error) {
      if (!isCurrentDeviceSession(readDevice, sessionId)) return "stale";
      setMessage(actionErrorMessage(error, "Could not update data.", reason === "auto" ? "Automatic retained-session import failed." : "Could not read logs."));
      return "failed";
    } finally {
      if (isCurrentDeviceSession(readDevice, sessionId)) setBusy(false);
    }
  }

  async function readLogs() {
    const readDevice = connectedDevice;
    if (!readDevice) return;
    await loadLogsFromDevice("manual", readDevice, deviceSessionIdRef.current);
  }

  async function clearLogs() {
    if (!connectedDevice) return;
    const writeDevice = connectedDevice;
    const sessionId = deviceSessionIdRef.current;
    if (!protocolCompatible) {
      Alert.alert("Protocol mismatch", "Log clearing requires the expected Ozealis BLE protocol version.");
      return;
    }
    if (!settingsWriteAllowed) {
      Alert.alert("Log clear requires idle", "Stop airflow, clear active faults, and wait for calibration to finish or abort before clearing logs.");
      return;
    }
    Alert.alert(
      "Clear device logs?",
      "Session and fault logs are bench evidence. Export anything needed before clearing them from the device.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Clear logs", style: "destructive", onPress: () => void writeClearLogs(writeDevice, sessionId) },
      ],
    );
  }

  async function writeClearLogs(writeDevice: Device, sessionId: number) {
    if (!isCurrentDeviceSession(writeDevice, sessionId)) return;
    if (writeGuardsRef.current.busy) return;
    if (!writeGuardsRef.current.protocolCompatible) {
      Alert.alert("Protocol mismatch", "Log clearing requires the expected Ozealis BLE protocol version.");
      return;
    }
    if (!writeGuardsRef.current.settingsWriteAllowed) {
      Alert.alert("Log clear requires idle", "Stop airflow, clear active faults, and wait for calibration to finish or abort before clearing logs.");
      return;
    }
    setBusy(true);
    try {
      if (!(await confirmProtocolBeforeWrite("Log clearing requires the expected Ozealis BLE protocol version.", writeDevice))) return;
      if (
        !(await confirmIdleNoCalibrationBeforeWrite(
          "Log clearing requires a fresh idle, no-fault, no-calibration readback before erasing retained evidence.",
          writeDevice,
        ))
      ) {
        return;
      }
      if (!isCurrentDeviceSession(writeDevice, sessionId)) return;
      await writeUtf8(writeDevice, OZEALIS_CHARACTERISTICS.settings, JSON.stringify({ clearLog: 1, clearFaults: 1 }));
      const logs = await readCsvTransfer(writeDevice, OZEALIS_CHARACTERISTICS.logDownload);
      if (!isCurrentDeviceSession(writeDevice, sessionId)) return;
      const faults = await readCsvTransfer(writeDevice, OZEALIS_CHARACTERISTICS.faultCsv);
      if (!isCurrentDeviceSession(writeDevice, sessionId)) return;
      const pair = { session: logs, fault: faults };
      validateRetainedSnapshotPair(pair);
      const validRowsRemain = retainedReadbackImportedRowCount(logs.csv, faults.csv) > 0;
      const verifiedClear = isClearedDeviceLogReadback(logs.csv, faults.csv);
      if (validRowsRemain || verifiedClear) {
        commitRetainedSnapshotPair(writeDevice.id, pair, verifiedClear);
      }
      if (verifiedClear) resetLiveSync();
      setMessage(
        validRowsRemain
          ? "Log clear requested; retained rows still present on device."
          : verifiedClear
            ? "Device logs cleared and verified."
            : "Log clear requested; readback did not contain valid retained rows.",
      );
    } catch (error) {
      if (!isCurrentDeviceSession(writeDevice, sessionId)) return;
      setMessage(actionErrorMessage(error, "Could not clear logs.", "Log clear failed."));
    } finally {
      if (isCurrentDeviceSession(writeDevice, sessionId)) setBusy(false);
    }
  }

  async function clearMotorFault() {
    if (!connectedDevice) return;
    if (!protocolCompatible) {
      Alert.alert("Protocol mismatch", "Motor fault clearing requires the expected Ozealis BLE protocol version.");
      return;
    }
    if (!motorFaultClearAllowed) {
      Alert.alert("Clear unavailable", "Motor driver fault clearing is accepted only while idle or in an I/O fault, with no calibration active.");
      return;
    }
    const writeDevice = connectedDevice;
    setBusy(true);
    try {
      if (!isCurrentConnectedDevice(writeDevice)) return;
      if (!(await confirmProtocolBeforeWrite("Motor fault clearing requires the expected Ozealis BLE protocol version.", writeDevice))) return;
      if (!(await confirmMotorFaultClearAvailableBeforeWrite(writeDevice))) return;
      if (!isCurrentConnectedDevice(writeDevice)) return;
      await writeUtf8(writeDevice, OZEALIS_CHARACTERISTICS.settings, JSON.stringify({ clearMotorFault: 1 }));
      const params = await loadDriverParams(writeDevice);
      if (!isCurrentConnectedDevice(writeDevice)) return;
      const modeFault = await refreshModeFaultFromDevice(writeDevice);
      const snapshot = parseMcfParamsSnapshot(params);
      const firmwareClear = modeFault.mode === "0" && modeFault.fault === "0";
      const verifiedClear = snapshot.driver === "MCF8316D" && snapshot.i2c === true && snapshot.fault === false && snapshot.commandReady && firmwareClear;
      setMessage(
        verifiedClear
          ? "Motor driver fault cleared and verified."
          : snapshot.fault === true
            ? "Motor driver fault clear requested; fault still latched."
            : snapshot.driver === "MCF8316D" && snapshot.i2c === true && snapshot.fault === false && !snapshot.commandReady
              ? "Motor driver fault latch is clear, but speed-command readiness is not verified."
              : snapshot.driver === "MCF8316D" && snapshot.i2c === true && snapshot.fault === false && !firmwareClear
                ? "Motor driver fault latch is clear, but firmware fault readback is not idle."
            : "Motor driver fault clear requested; MCF8316D snapshot could not verify a present driver with clear latch.",
      );
    } catch (error) {
      if (!isCurrentConnectedDevice(writeDevice)) return;
      setMessage(actionErrorMessage(error, "Could not clear motor driver fault.", "Motor driver fault clear failed."));
    } finally {
      setBusy(false);
    }
  }

  async function exportFile(name: string, contents: string, extension: string, mimeType: string) {
    if (!contents.trim()) {
      Alert.alert("Nothing to export", "Read data from the device first.");
      return;
    }
    try {
      const fileName = `${name}-${new Date().toISOString().replace(/[:.]/g, "-")}.${extension}`;
      const file = new File(Paths.document, fileName);
      file.write(contents);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType });
        setMessage(`Export shared: ${fileName}`);
      } else {
        setMessage(`Saved export: ${fileName}`);
      }
    } catch (error) {
      setMessage(actionErrorMessage(error, "Could not export.", "Export failed."));
    }
  }

  async function exportCsv(name: string, contents: string) {
    await exportFile(name, contents, "csv", "text/csv");
  }

  async function exportLiveSyncCsv() {
    const csv = formatLiveSyncCsv(liveSyncRowsRef.current);
    setLiveSyncCsv(csv);
    setLiveSyncRowCount(liveSyncRowsRef.current.length);
    flushLiveSyncSpool();
    await exportCsv("ozealis-live-10hz", csv);
  }

  async function exportJson(name: string, contents: string) {
    await exportFile(name, contents, "json", "application/json");
  }

  async function readDriverParams() {
    if (!connectedDevice) return;
    const readDevice = connectedDevice;
    setBusy(true);
    try {
      await loadDriverParams(readDevice);
      if (!isCurrentConnectedDevice(readDevice)) return;
      setMessage("MCF8316D parameter snapshot loaded.");
    } catch (error) {
      if (!isCurrentConnectedDevice(readDevice)) return;
      setMessage(actionErrorMessage(error, "Could not update device details.", "Could not read MCF8316D parameters."));
    } finally {
      setBusy(false);
    }
  }

  async function refreshModeFaultFromDevice(device = connectedDevice) {
    if (!device) return { mode: "--", fault: "--" };
    const [mode, fault] = await Promise.all([
      readUtf8(device, OZEALIS_CHARACTERISTICS.mode),
      readUtf8(device, OZEALIS_CHARACTERISTICS.fault),
    ]);
    if (!isCurrentConnectedDevice(device)) return { mode: "--", fault: "--" };
    const nextMode = parseSystemMode(mode || "");
    const nextFault = parseFaultCode(fault || "");
    setTelemetry((current) => ({ ...current, mode: nextMode, fault: nextFault, updatedAt: Date.now() }));
    return { mode: nextMode, fault: nextFault };
  }

  async function confirmIdleNoCalibrationBeforeWrite(messageText: ModeAwareMessage, device = connectedDevice) {
    if (!device) return false;
    const [mode, fault, calibrationStatus] = await Promise.all([
      readUtf8(device, OZEALIS_CHARACTERISTICS.mode),
      readUtf8(device, OZEALIS_CHARACTERISTICS.fault),
      readUtf8(device, OZEALIS_CHARACTERISTICS.calibrationStatus),
    ]);
    if (!isCurrentConnectedDevice(device)) return false;
    const nextMode = parseSystemMode(mode || "");
    const nextFault = parseFaultCode(fault || "");
    const nextCalibration = parseCalibrationStatus(calibrationStatus || "{}");
    setTelemetry((current) => ({
      ...current,
      mode: nextMode,
      fault: nextFault,
      calibrationStatus: calibrationStatus || "{}",
      updatedAt: Date.now(),
    }));
    if (nextMode === "0" && nextFault === "0" && !nextCalibration.active) return true;
    Alert.alert(advancedMode ? "Write unavailable" : "Use standby", modeAwareMessage(messageText));
    return false;
  }

  async function confirmMotorFaultClearAvailableBeforeWrite(device = connectedDevice) {
    if (!device) return false;
    const [mode, fault, calibrationStatus] = await Promise.all([
      readUtf8(device, OZEALIS_CHARACTERISTICS.mode),
      readUtf8(device, OZEALIS_CHARACTERISTICS.fault),
      readUtf8(device, OZEALIS_CHARACTERISTICS.calibrationStatus),
    ]);
    if (!isCurrentConnectedDevice(device)) return false;
    const nextMode = parseSystemMode(mode || "");
    const nextFault = parseFaultCode(fault || "");
    const nextCalibration = parseCalibrationStatus(calibrationStatus || "{}");
    setTelemetry((current) => ({
      ...current,
      mode: nextMode,
      fault: nextFault,
      calibrationStatus: calibrationStatus || "{}",
      updatedAt: Date.now(),
    }));
    if (!nextCalibration.active && (nextMode === "0" || (nextMode === "4" && nextFault === "4"))) return true;
    Alert.alert("Clear unavailable", "Motor driver fault clearing requires a fresh idle or FAULT_IO readback with no active calibration.");
    return false;
  }

  async function confirmCalibrationCommandAvailableBeforeWrite(command: "capture" | "abort", device = connectedDevice) {
    if (!device) return null;
    const statusJson = await readUtf8(device, OZEALIS_CHARACTERISTICS.calibrationStatus);
    if (!isCurrentConnectedDevice(device)) return null;
    const nextCalibration = parseCalibrationStatus(statusJson || "{}");
    setTelemetry((current) => ({ ...current, calibrationStatus: statusJson || "{}", updatedAt: Date.now() }));
    if (command === "capture" && nextCalibration.active && nextCalibration.mode === "water") return nextCalibration;
    if (command === "abort" && nextCalibration.active) return nextCalibration;
    Alert.alert(
      advancedMode ? (command === "capture" ? "Capture unavailable" : "Abort unavailable") : command === "capture" ? "Wait for the mark" : "Nothing to stop",
      modeAwareMessage(
        command === "capture"
          ? {
              advanced: "Water-column capture requires a fresh active water-column calibration readback.",
              simple: "Wait for the ruler mark.",
            }
          : {
              advanced: "Calibration abort requires a fresh active calibration readback.",
              simple: "Setup is not running.",
            },
      ),
    );
    return null;
  }

  async function sendOtaCommand() {
    if (!connectedDevice) return;
    if (!protocolCompatible) {
      Alert.alert("Protocol mismatch", "OTA writes require the expected Ozealis BLE protocol version.");
      return;
    }
    if (otaInProgress) {
      Alert.alert("OTA already running", "Wait for OTA status to report OK or ERR before sending another firmware URL.");
      return;
    }
    if (!otaAllowed) {
      Alert.alert("OTA requires idle", "Stop airflow, clear active faults, and wait for calibration to finish or abort before sending OTA.");
      return;
    }
    if (!otaSsid.trim() || !otaPassword.trim() || !otaUrl.trim()) {
      Alert.alert("OTA fields required", "Enter SSID, password, and a firmware URL.");
      return;
    }
    if (!isSupportedOtaUrl(otaUrl)) {
      Alert.alert("Unsupported firmware URL", "Use an http:// or https:// firmware URL.");
      return;
    }
    Alert.alert(
      "Send OTA command?",
      "Only continue with a firmware binary you built and verified. This OTA path does not verify project-owned signatures or pinned certificates.",
      [
        { text: "Cancel", style: "cancel", onPress: () => setOtaPassword("") },
        { text: "Send OTA", style: "destructive", onPress: () => void writeOtaCommand() },
      ],
    );
  }

  async function writeOtaCommand() {
    if (!connectedDevice) return;
    const writeDevice = connectedDevice;
    if (!isCurrentConnectedDevice(writeDevice)) {
      setOtaPassword("");
      return;
    }
    if (writeGuardsRef.current.busy) {
      setOtaPassword("");
      return;
    }
    if (!writeGuardsRef.current.protocolCompatible) {
      setOtaPassword("");
      Alert.alert("Protocol mismatch", "OTA writes require the expected Ozealis BLE protocol version.");
      return;
    }
    if (writeGuardsRef.current.otaInProgress || !writeGuardsRef.current.otaAllowed) {
      setOtaPassword("");
      if (writeGuardsRef.current.otaInProgress) {
        Alert.alert("OTA already running", "Wait for OTA status to report OK or ERR before sending another firmware URL.");
        return;
      }
      Alert.alert("OTA requires idle", "Stop airflow, clear active faults, and wait for calibration to finish or abort before sending OTA.");
      return;
    }
    const nextSsid = otaSsid.trim();
    const nextUrl = otaUrl;
    if (!nextSsid || !otaPassword.trim() || !nextUrl) {
      setOtaPassword("");
      Alert.alert("OTA fields required", "Enter SSID, password, and a firmware URL.");
      return;
    }
    if (!isSupportedOtaUrl(nextUrl)) {
      setOtaPassword("");
      Alert.alert("Unsupported firmware URL", "Use an http:// or https:// firmware URL.");
      return;
    }
    setBusy(true);
    try {
      if (!(await confirmProtocolBeforeWrite("OTA writes require the expected Ozealis BLE protocol version.", writeDevice))) return;
      if (
        !(await confirmIdleNoCalibrationBeforeWrite(
          "OTA requires a fresh idle, no-fault, no-calibration readback before sending a firmware URL.",
          writeDevice,
        ))
      ) {
        return;
      }
      const freshOtaStatus = parseOtaStatus(await readUtf8(writeDevice, OZEALIS_CHARACTERISTICS.otaStatus));
      if (!isCurrentConnectedDevice(writeDevice)) return;
      setTelemetry((current) => ({ ...current, otaStatus: freshOtaStatus, updatedAt: Date.now() }));
      if (isOtaStatusInProgress(freshOtaStatus)) {
        Alert.alert("OTA already running", "Wait for OTA status to report OK or ERR before sending another firmware URL.");
        return;
      }
      if (!isCurrentConnectedDevice(writeDevice)) return;
      await writeUtf8(
        writeDevice,
        OZEALIS_CHARACTERISTICS.otaCommand,
        JSON.stringify({ ssid: nextSsid, pwd: otaPassword, url: nextUrl }),
      );
      const status = parseOtaStatus(await readUtf8(writeDevice, OZEALIS_CHARACTERISTICS.otaStatus));
      if (!isCurrentConnectedDevice(writeDevice)) return;
      setTelemetry((current) => ({ ...current, otaStatus: status, updatedAt: Date.now() }));
      setMessage(
        status === "ERR"
          ? "OTA command returned ERR. Check URL, Wi-Fi, idle state, and serial logs before retrying."
          : isOtaStatusInProgress(status) || status === "OK"
            ? `OTA command accepted; status readback is ${status}. Watch OTA status before power cycling.`
            : `OTA command not verified; status readback is ${status}. Check idle state and serial logs before retrying.`,
      );
    } catch {
      if (!isCurrentConnectedDevice(writeDevice)) return;
      setMessage("OTA command failed. Check URL, Wi-Fi, idle state, and serial logs before retrying.");
    } finally {
      setOtaPassword("");
      setBusy(false);
    }
  }

  async function sendControlCommand(command: ControlCommand) {
    if (!connectedDevice) return;
    if (!protocolCompatible) {
      Alert.alert(
        advancedMode ? "Protocol mismatch" : "Update app or firmware",
        advancedMode ? "Control commands require the expected Ozealis BLE protocol version." : "This app and device do not match. Update the app or firmware, then try again.",
      );
      return;
    }
    if (command === "start" && !controlStartAllowed) {
      Alert.alert(
        advancedMode ? "Start unavailable" : "Use standby",
        advancedMode
          ? "Start requires idle state, no active system fault, no active calibration, an MCF8316D driver present on I2C with an explicit clear fault-latch reading, and verified I2C speed-command readback or an explicit bench PWM fallback build."
          : "Use standby to start airflow.",
      );
      return;
    }
    if (command === "prewarmStart" && !prewarmStartAllowed) {
      Alert.alert(
        advancedMode ? "Prewarm unavailable" : "Use standby",
        advancedMode ? "Prewarm requires standby, no active fault or setup, a detected humidifier module, water-warmer humidifier mode, and a nonzero prewarm time." : "Use standby to prewarm.",
      );
      return;
    }
    setBusy(true);
    const writeDevice = connectedDevice;
    try {
      if (!isCurrentConnectedDevice(writeDevice)) return;
      if (
        !(await confirmProtocolBeforeWrite({
          advanced: "Control commands require the expected Ozealis BLE protocol version.",
          simple: "This app and device do not match. Update the app or firmware, then try again.",
        }, writeDevice))
      ) {
        return;
      }
      if (
        (command === "start" || command === "prewarmStart") &&
        !(await confirmIdleNoCalibrationBeforeWrite({
          advanced: command === "prewarmStart" ? "Prewarm requires a fresh idle, no-fault, no-calibration readback." : "Start requires a fresh idle, no-fault, no-calibration readback before commanding airflow.",
          simple: command === "prewarmStart" ? "Use standby to prewarm." : "Use standby to start airflow.",
        }, writeDevice))
      ) {
        return;
      }
      if (
        command === "start" &&
        !(await confirmDriverSnapshotBeforeMotorAction({
          advanced:
            "Start requires a fresh MCF8316D snapshot with I2C present, an explicit clear driver fault-latch reading, and verified I2C speed-command readback or an explicit bench PWM fallback build.",
          simple: "Use standby to start airflow.",
        }, writeDevice))
      ) {
        return;
      }
      if (!isCurrentConnectedDevice(writeDevice)) return;
      await writeUtf8(writeDevice, OZEALIS_CHARACTERISTICS.control, JSON.stringify({ command }));
      const readback = await refreshModeFaultFromDevice(writeDevice);
      let moduleStatusReadback = telemetry.moduleStatus;
      if (command === "prewarmStart" || command === "prewarmStop") {
        moduleStatusReadback = parseModuleStatus(await readUtf8(writeDevice, OZEALIS_CHARACTERISTICS.moduleStatus));
        if (!isCurrentConnectedDevice(writeDevice)) return;
        setTelemetry((current) => ({ ...current, moduleStatus: moduleStatusReadback, updatedAt: Date.now() }));
      }
      setMessage(controlCommandReadbackMessage(command, readback.mode, readback.fault, moduleStatusReadback));
    } catch (error) {
      if (!isCurrentConnectedDevice(writeDevice)) return;
      setMessage(actionErrorMessage(error, command === "start" ? "Use standby to start airflow." : command === "prewarmStart" ? "Use standby to prewarm." : "Stop from the device if needed.", `Could not send ${command} command.`));
    } finally {
      setBusy(false);
    }
  }

  function controlCommandReadbackMessage(command: ControlCommand, mode: string, fault: string, moduleStatus = telemetry.moduleStatus) {
    const hasSystemFault = /^[1-4]$/.test(fault);
    if (!advancedMode) {
      if (command === "start") {
        if (hasSystemFault) return "Review the alert before starting again.";
        if (mode === "1" || mode === "2") return "Airflow is starting.";
        return "Airflow did not start.";
      }
      if (command === "prewarmStart") {
        if (hasSystemFault) return "Review the alert before prewarming again.";
        if (mode === "0" && moduleStatus.includes("prewarm")) return "Prewarm started.";
        return "Prewarm did not start.";
      }
      if (command === "prewarmStop") return moduleStatus.includes("prewarm") ? "Prewarm is still on." : "Prewarm stopped.";
      if (hasSystemFault) return "Review the alert before trying again.";
      if (mode === "0" || mode === "3") return "Airflow is stopping.";
      return "Airflow did not stop.";
    }
    if (command === "start") {
      if (hasSystemFault) return `Start rejected or faulted; mode is ${systemModes[Number(mode)] || mode}, fault is ${faultTypes[Number(fault)] || fault}.`;
      if (fault !== "0") return `Start not verified; mode readback is ${systemModes[Number(mode)] || mode}, fault readback is ${fault}.`;
      if (mode === "1" || mode === "2") return `Start accepted; mode is ${systemModes[Number(mode)]}.`;
      return `Start not verified; mode readback is ${systemModes[Number(mode)] || mode}.`;
    }
    if (command === "prewarmStart") {
      if (hasSystemFault) return `Prewarm rejected or faulted; mode is ${systemModes[Number(mode)] || mode}, fault is ${faultTypes[Number(fault)] || fault}.`;
      if (fault !== "0") return `Prewarm not verified; mode readback is ${systemModes[Number(mode)] || mode}, fault readback is ${fault}.`;
      if (mode === "0" && moduleStatus.includes("prewarm")) return `Prewarm verified for up to ${settings.humidifierPrewarmMinutes} minutes.`;
      return `Prewarm not verified; mode readback is ${systemModes[Number(mode)] || mode}.`;
    }
    if (command === "prewarmStop") {
      if (hasSystemFault) return `Prewarm stop sent; device is faulted with fault ${faultTypes[Number(fault)] || fault}.`;
      if (fault !== "0") return `Prewarm stop not verified; fault readback is ${fault}.`;
      return moduleStatus.includes("prewarm") ? "Prewarm stop not verified; module status still reports prewarm." : "Prewarm stop verified.";
    }
    if (hasSystemFault) return `Stop not verified; device remains faulted with fault ${faultTypes[Number(fault)] || fault}.`;
    if (fault !== "0") return `Stop not verified; mode readback is ${systemModes[Number(mode)] || mode}, fault readback is ${fault}.`;
    if (mode === "0" || mode === "3") return `Stop accepted; mode is ${systemModes[Number(mode)]}.`;
    return `Stop not verified; mode readback is ${systemModes[Number(mode)] || mode}.`;
  }

  function humidifierLabel() {
    if (telemetry.humidifierTemp === "--" && telemetry.humidifierRh === "--") return "Not present";
    const temp = telemetry.humidifierTemp === "--" ? "unknown C" : `${telemetry.humidifierTemp} C`;
    const rh = telemetry.humidifierRh === "--" ? "unknown RH" : `${telemetry.humidifierRh}% RH`;
    return `${temp}, ${rh}`;
  }

  function hoseTemperatureLabel() {
    return telemetry.hoseTemp === "--" ? "Not present" : `${telemetry.hoseTemp} C`;
  }

  async function sendCalibrationCommand(command: "start" | "waterStart" | "capture" | "abort") {
    if (!connectedDevice) return;
    if ((command === "start" || command === "waterStart" || command === "capture" || command === "abort") && !protocolCompatible) {
      Alert.alert(
        advancedMode ? "Protocol mismatch" : command === "waterStart" || command === "start" ? "Update app or firmware" : "Use setup when ready",
        advancedMode
          ? "Calibration requires the expected Ozealis BLE protocol version."
          : "This app and device do not match. Update the app or firmware, then try again.",
      );
      return;
    }
    if ((command === "start" || command === "waterStart") && !calibrationStartAllowed) {
      Alert.alert(
        advancedMode ? "Calibration unavailable" : "Use standby",
        advancedMode
          ? "Calibration requires idle state, no active system fault, no active calibration, an MCF8316D driver present on I2C with an explicit clear fault-latch reading, and verified I2C speed-command readback or an explicit bench PWM fallback build."
          : "Use standby to start setup.",
      );
      return;
    }
    if (command === "capture" && !waterCaptureAllowed) {
      Alert.alert(
        advancedMode ? "Capture unavailable" : "Wait for the mark",
        advancedMode ? "Water-column capture requires an active water-column calibration sweep." : "Wait for the ruler mark.",
      );
      return;
    }
    if (command === "abort" && !calibrationAbortAllowed) {
      Alert.alert(
        advancedMode ? "Abort unavailable" : "Nothing to stop",
        advancedMode ? "There is no active calibration sweep to abort." : "Setup is not running.",
      );
      return;
    }
    if (command === "waterStart" && !waterSetupReady) {
      Alert.alert("Finish checklist", "Complete every water-column setup check before starting.");
      return;
    }
    if (command === "waterStart") {
      Alert.alert(
        "Confirm water-column setup",
        "Clear CPAP tube is taped as a U, water is added, the machine is at least 5 cm above the water level, and a secured 20 cm+ ruler has zero aligned to the resting waterline.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Start", onPress: () => void writeCalibrationCommand("waterStart") },
        ],
      );
      return;
    }
    await writeCalibrationCommand(command);
  }

  function setWaterSetupCheck(key: WaterSetupKey, value: boolean) {
    setWaterSetupChecks((current) => ({ ...current, [key]: value }));
  }

  async function writeCalibrationCommand(command: "start" | "waterStart" | "capture" | "abort") {
    if (!connectedDevice) return;
    const writeDevice = connectedDevice;
    if (!isCurrentConnectedDevice(writeDevice)) return;
    if (writeGuardsRef.current.busy) return;
    if (!writeGuardsRef.current.protocolCompatible) {
      Alert.alert(
        advancedModeRef.current ? "Protocol mismatch" : command === "waterStart" || command === "start" ? "Update app or firmware" : "Use setup when ready",
        advancedModeRef.current
          ? "Calibration requires the expected Ozealis BLE protocol version."
          : "This app and device do not match. Update the app or firmware, then try again.",
      );
      return;
    }
    if ((command === "start" || command === "waterStart") && !writeGuardsRef.current.calibrationStartAllowed) {
      Alert.alert(
        advancedMode ? "Calibration unavailable" : "Use standby",
        advancedMode
          ? "Calibration requires idle state, no active system fault, no active calibration, an MCF8316D driver present on I2C with an explicit clear fault-latch reading, and verified I2C speed-command readback or an explicit bench PWM fallback build."
          : "Use standby to start setup.",
      );
      return;
    }
    if (command === "waterStart" && !writeGuardsRef.current.waterSetupReady) {
      Alert.alert("Finish checklist", "Complete every water-column setup check before starting.");
      return;
    }
    if (command === "capture" && !writeGuardsRef.current.waterCaptureAllowed) {
      Alert.alert(
        advancedMode ? "Capture unavailable" : "Wait for the mark",
        advancedMode ? "Water-column capture requires an active water-column calibration sweep." : "Wait for the ruler mark.",
      );
      return;
    }
    if (command === "abort" && !writeGuardsRef.current.calibrationAbortAllowed) {
      Alert.alert(
        advancedMode ? "Abort unavailable" : "Nothing to stop",
        advancedMode ? "There is no active calibration sweep to abort." : "Setup is not running.",
      );
      return;
    }
    const payload =
      command === "start"
        ? { command, minAmp: 30, maxAmp: 180, stepAmp: 10, dwellMs: 5000, maxPressureCm: 18 }
        : command === "waterStart"
          ? { command, minAmp: 0, maxAmp: 220, stepAmp: 1, dwellMs: 1200, maxPressureCm: 20 }
        : { command };
    let before = parseCalibrationStatus(telemetry.calibrationStatus);
    setBusy(true);
    try {
      if (
        (command === "start" || command === "waterStart" || command === "capture" || command === "abort") &&
        !(await confirmProtocolBeforeWrite(
          advancedMode
            ? "Calibration requires the expected Ozealis BLE protocol version."
            : "This app and device do not match. Update the app or firmware, then try again.",
          writeDevice,
        ))
      ) {
        return;
      }
      if (
        (command === "start" || command === "waterStart") &&
        !(await confirmIdleNoCalibrationBeforeWrite(
          advancedMode
            ? "Calibration start requires a fresh idle, no-fault, no-calibration readback before commanding the blower."
            : "Use standby to start setup.",
          writeDevice,
        ))
      ) {
        return;
      }
      if (
        (command === "start" || command === "waterStart") &&
        !(await confirmDriverSnapshotBeforeMotorAction(
          advancedMode
            ? "Calibration start requires a fresh MCF8316D snapshot with I2C present, an explicit clear driver fault-latch reading, and verified I2C speed-command readback or an explicit bench PWM fallback build."
            : "Use standby to start setup.",
          writeDevice,
        ))
      ) {
        return;
      }
      if (command === "capture" || command === "abort") {
        const freshBefore = await confirmCalibrationCommandAvailableBeforeWrite(command, writeDevice);
        if (!freshBefore) return;
        before = freshBefore;
      }
      if (!isCurrentConnectedDevice(writeDevice)) return;
      await writeUtf8(writeDevice, OZEALIS_CHARACTERISTICS.calibrationCommand, JSON.stringify(payload));
      const statusJson = await readUtf8(writeDevice, OZEALIS_CHARACTERISTICS.calibrationStatus);
      if (!isCurrentConnectedDevice(writeDevice)) return;
      setTelemetry((current) => ({ ...current, calibrationStatus: statusJson || "{}", updatedAt: Date.now() }));
      setMessage(calibrationCommandReadbackMessage(command, before, parseCalibrationStatus(statusJson)));
    } catch (error) {
      if (!isCurrentConnectedDevice(writeDevice)) return;
      setMessage(actionErrorMessage(error, "Use standby to start setup.", "Calibration command failed."));
    } finally {
      setBusy(false);
    }
  }

  function calibrationCommandReadbackMessage(
    command: "start" | "waterStart" | "capture" | "abort",
    before: ReturnType<typeof parseCalibrationStatus>,
    after: ReturnType<typeof parseCalibrationStatus>,
  ) {
    const finalWaterCaptureVerified = after.state === "water-done" && after.capturedPoints === 17 && after.curveValid;
    if (!advancedMode) {
      if (command === "waterStart") {
        return after.active && after.mode === "water" ? `Setup started. First mark is ${after.targetCm || 4} cmH2O.` : "Use standby to start setup.";
      }
      if (command === "start") {
        return after.active && after.mode === "auto" ? "Setup started." : "Use standby to start setup.";
      }
      if (command === "capture") {
        if (after.capturedPoints > before.capturedPoints) {
          return after.active && after.mode === "water"
            ? `Mark saved. Next mark is ${after.targetCm} cmH2O.`
            : finalWaterCaptureVerified
              ? "Final mark saved. Setup saved."
              : "Final mark saved. Check setup status.";
        }
        return "Wait for the waterline to reach the ruler mark.";
      }
      if (!after.active && after.state !== "unknown") return "Setup stopped.";
      return "Setup is stopping.";
    }
    if (command === "start") {
      return after.active && after.mode === "auto"
        ? `Calibration sweep accepted; state is ${after.state}.`
        : `Calibration sweep not accepted yet; status readback is ${after.state}.`;
    }
    if (command === "waterStart") {
      return after.active && after.mode === "water"
        ? `Water-column calibration accepted; target is ${after.targetCm || 4} cmH2O.`
        : `Water-column calibration not accepted yet; status readback is ${after.state}.`;
    }
    if (command === "capture") {
      if (after.capturedPoints > before.capturedPoints) {
        return after.active && after.mode === "water"
          ? `Water-column point captured; next target is ${after.targetCm} cmH2O.`
          : finalWaterCaptureVerified
            ? "Final water-column point captured; curve and trim status updated."
            : `Final water-column point captured; curve was not verified, status is ${after.state}.`;
      }
      return `Capture not accepted yet; status is ${after.state}. Wait for the ruler mark before trying again.`;
    }
    if (!after.active && after.state !== "unknown") return `Calibration abort verified; status is ${after.state}.`;
    return `Calibration abort not verified yet; status is ${after.state}.`;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Ozealis</Text>
          <Text style={styles.subtitle}>{connectionLabel}</Text>
        </View>
        {connectedDevice ? (
          <IconButton icon="close" label="Disconnect" onPress={disconnect} />
        ) : (
          <IconButton icon="bluetooth" label="Scan" onPress={startScan} disabled={scanning || busy} />
        )}
      </View>

      {advancedMode && (
        <View style={styles.notice}>
          <Ionicons name="warning-outline" size={18} color="#92400e" />
          <Text style={styles.noticeText}>
            Experimental research platform only. Not approved for diagnosis, treatment, emergency, or life-support use.
          </Text>
        </View>
      )}

      {showStatusLine && (
        <View style={styles.statusLine}>
          <Text style={styles.statusText}>{message}</Text>
          {(busy || scanning) && <ActivityIndicator color={accent} />}
        </View>
      )}

      {!connectedDevice && (
        <View style={styles.scanPanel}>
          <Text style={styles.sectionTitle}>{blePreviewMode ? "Preview mode" : advancedMode ? "Nearby Devices" : "Pair device"}</Text>
          {blePreviewMode ? (
            <Text style={styles.mutedText}>
              The app shell is available here for layout review. Pairing, scanning, and airflow control require the Android or iOS build.
            </Text>
          ) : devices.length === 0 ? (
            <Text style={styles.mutedText}>
              {advancedMode
                ? `Hold the device pairing button until advertising starts, then scan. BLE service: ${OZEALIS_SERVICE_UUID}`
                : "Hold the device pairing button until it is ready to pair, then scan for your Ozealis device."}
            </Text>
          ) : (
            devices.map((device) => (
              <Pressable key={device.id} style={styles.deviceRow} onPress={() => connect(device)} disabled={busy}>
                <View>
                  <Text style={styles.deviceName}>{device.name || device.localName || "Unnamed Ozealis"}</Text>
                  {advancedMode && <Text style={styles.mutedText}>{device.id}</Text>}
                </View>
                <Ionicons name="chevron-forward" size={20} color="#475569" />
              </Pressable>
            ))
          )}
        </View>
      )}

      <View style={styles.tabs}>
        {(advancedMode ? advancedTabs : simpleTabs).map((item) => (
          <Pressable
            key={item}
            style={[styles.tab, screen === item && styles.tabActive]}
            onPress={() => setScreen(item)}
          >
            <Text style={[styles.tabText, screen === item && styles.tabTextActive]}>
              {(advancedMode ? advancedTabLabels : tabLabels)[item]}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {screen === "control" && (
          <View>
            {!advancedMode && (
              <View style={styles.homePanel}>
                <View style={styles.homeHeaderRow}>
                  <View>
                    <Text style={styles.homeEyebrow}>{homeStatusTone}</Text>
                    <Text style={styles.homeStatus}>{homeStatusLabel}</Text>
                  </View>
                  <View style={[styles.statusDot, connectedStateUnknown && styles.statusDotPending, prewarmActive && styles.statusDotWarm, faultActive && styles.statusDotFault]} />
                </View>
                <View style={styles.pressureReadout}>
                  <Text style={styles.pressureValue}>{displayPressure}</Text>
                  <Text style={styles.pressureUnit}>{displayPressureUnit}</Text>
                </View>
                <Text style={styles.homeHint}>
                  {connectedStateUnknown
                    ? "Waiting for device status."
                    : faultActive
                    ? "Check the device."
                    : prewarmActive
                    ? "Humidifier prewarming."
                    : telemetry.mode === "2"
                      ? `${therapyModes[settings.mode] || "CPAP"} mode, comfort range ${comfortPressureLabel}.`
                      : canUseDevice
                        ? `Comfort range ${comfortPressureLabel}.`
                        : `Comfort range ${comfortPressureLabel}. Pair your Ozealis device when ready.`}
                </Text>
                {(advancedMode || oximetryDisplay.present || oximeterDevice) && (
                  <View style={styles.oxygenStrip}>
                    <Text style={styles.oxygenLabel}>Oxygen</Text>
                    <Text style={styles.oxygenValue}>{oximetryDisplay.label}</Text>
                    {advancedMode && <Text style={styles.oxygenDetail}>{oximetryDisplay.detail}</Text>}
                  </View>
                )}
                <View style={styles.primaryActions}>
                  {!canUseDevice && (
                    <ActionButton icon="bluetooth" label="Pair device" onPress={startScan} disabled={scanning || busy} fill />
                  )}
                  {showSimpleStart && (
                    <ActionButton
                      icon="play"
                      label="Start airflow"
                      onPress={() => sendControlCommand("start")}
                      disabled={simpleStartDisabled}
                      fill
                    />
                  )}
                  {showSimpleStop && (
                    <ActionButton
                      icon="stop"
                      label="Stop"
                      onPress={() => sendControlCommand("stop")}
                      disabled={busy}
                      secondary
                    />
                  )}
                  {showSimplePrewarmStop && (
                    <ActionButton
                      icon="close-circle"
                      label="Stop prewarm"
                      onPress={() => sendControlCommand("prewarmStop")}
                      disabled={busy}
                      secondary
                    />
                  )}
                  {!advancedMode && !oximeterDevice && (
                    <ActionButton
                      icon="pulse"
                      label="Pair oximeter"
                      onPress={startOximeterScan}
                      disabled={oximeterScanning || busy}
                      secondary
                    />
                  )}
                </View>
              </View>
            )}
            {(advancedMode || faultActive) && (
              <>
                <Text style={styles.sectionTitle}>{advancedMode ? "Live Telemetry" : "Alert"}</Text>
                {advancedMode && <ValueRow label="System mode" value={systemModes[Number(telemetry.mode)] || telemetry.mode} />}
                {(advancedMode || faultActive) && <ValueRow label={advancedMode ? "Fault" : "Device"} value={faultLabel} />}
                {advancedMode && <ValueRow label="Therapy mode" value={therapyModes[settings.mode] || "CPAP"} />}
                {advancedMode && <ValueRow label="Oximetry" value={oximetryDisplay.label} />}
                {advancedMode && <ValueRow label="Oximetry source" value={oximetryDisplay.detail} />}
                {advancedMode && <ValueRow label="Humidifier" value={humidifierLabel()} />}
                {advancedMode && <ValueRow label="Hose temperature" value={hoseTemperatureLabel()} />}
              </>
            )}
            {advancedMode && <ValueRow label="Measured pressure" value={`${telemetry.controllerMeasured} cmH2O`} />}
            {advancedMode && (
              <>
                <ValueRow label="Pressure delta" value={`${telemetry.pressure} hPa`} />
                <ValueRow label="Flow proxy" value={`${telemetry.flow} hPa`} />
                <ValueRow label="Setpoint" value={`${telemetry.setpoint} hPa`} />
                <ValueRow label="Input voltage" value={`${telemetry.vin} V`} />
                <ValueRow label="Low-flow index" value={telemetry.ahi} />
                <ValueRow label="Modules" value={telemetry.moduleStatus} />
                <ValueRow label="Pressure error" value={`${telemetry.controllerError} cmH2O`} />
                <ValueRow label="Controller command" value={telemetry.controllerAmp} />
                <ValueRow label="Driver command" value={telemetry.motorCommand} />
                <ValueRow label="Driver FG" value={telemetry.motorFgHz === "--" ? "--" : `${telemetry.motorFgHz} Hz`} />
                <ValueRow label="Driver I2C" value={driverI2cLabel} />
                <ValueRow label="Driver fault" value={driverFaultLabel} />
                <ValueRow label="Driver command path" value={driverCommandPathLabel} />
                {!controlStartAllowed && <Text style={styles.mutedText}>{startBlockReason}</Text>}
                <View style={styles.actions}>
                  <ActionButton
                    icon="pulse"
                    label={oximeterDevice ? "Reconnect oximeter" : "Pair oximeter"}
                    onPress={startOximeterScan}
                    disabled={oximeterScanning || busy}
                    secondary
                  />
                  <ActionButton
                    icon="close"
                    label="Disconnect oximeter"
                    onPress={disconnectOximeter}
                    disabled={!oximeterDevice || busy}
                    secondary
                  />
                </View>
                <View style={styles.actions}>
                  <ActionButton
                    icon="refresh"
                    label="Clear driver fault"
                    onPress={clearMotorFault}
                    disabled={!motorFaultClearAllowed || busy}
                    secondary
                  />
                </View>
                <View style={styles.actions}>
                  <ActionButton
                    icon="play"
                    label="Start"
                    onPress={() => sendControlCommand("start")}
                    disabled={!controlStartAllowed || busy}
                  />
                  <ActionButton
                    icon="stop"
                    label="Stop"
                    onPress={() => sendControlCommand("stop")}
                    disabled={!canUseDevice || !protocolCompatible || busy}
                    secondary
                  />
                </View>
                <Text style={styles.sectionTitle}>Live CSV</Text>
                <Text style={styles.mono}>{telemetry.liveCsv}</Text>
              </>
            )}
          </View>
        )}

        {screen === "settings" && (
          <View>
            <Text style={styles.sectionTitle}>{advancedMode ? "Device Settings" : "Comfort"}</Text>
            <NumberField label={advancedMode ? "Minimum pressure (cmH2O)" : "Low pressure"} value={settings.pMin} onChange={(pMin) => setSettings({ ...settings, pMin })} />
            <NumberField label={advancedMode ? "Maximum pressure (cmH2O)" : "High pressure"} value={settings.pMax} onChange={(pMax) => setSettings({ ...settings, pMax })} />
            <NumberField label={advancedMode ? "EPR relief (cmH2O)" : "Pressure relief"} value={settings.epr} onChange={(epr) => setSettings({ ...settings, epr })} />
            <NumberField
              label={advancedMode ? "Ramp seconds" : "Ramp time"}
              value={advancedMode ? settings.ramp : Math.round(settings.ramp / 60)}
              onChange={(ramp) => setSettings({ ...settings, ramp: advancedMode ? ramp : Math.max(0, Math.round(ramp * 60)) })}
              suffix={advancedMode ? undefined : "min"}
            />
            <SegmentedMode
              value={settings.mode}
              advanced={advancedMode}
              onChange={(mode) => setSettings(sanitizeSettings({ ...settings, mode }))}
            />
            {advancedMode && (
              <>
                <NumberField label="Bi-level delta (cmH2O)" value={settings.delta} onChange={(delta) => setSettings({ ...settings, delta })} />
                <NumberField label="Backup rate (bpm)" value={settings.backupRateBpm} onChange={(backupRateBpm) => setSettings({ ...settings, backupRateBpm })} />
                <NumberField label="Inspiratory time (ms)" value={settings.inspTimeMs} onChange={(inspTimeMs) => setSettings({ ...settings, inspTimeMs })} />
                <NumberField label="Trigger sensitivity reserved" value={settings.triggerSens} onChange={(triggerSens) => setSettings({ ...settings, triggerSens })} />
                <NumberField label="Cycle sensitivity reserved" value={settings.cycleSens} onChange={(cycleSens) => setSettings({ ...settings, cycleSens })} />
                <SegmentedHumidifierKind
                  value={settings.humidifierKind}
                  onChange={(humidifierKind) => setSettings({ ...settings, humidifierKind })}
                />
                {settings.humidifierKind !== 0 && (
                  <>
                    <NumberField label="Humidity target (% RH)" value={settings.humidifierTargetRH} onChange={(humidifierTargetRH) => setSettings({ ...settings, humidifierTargetRH })} />
                    <NumberField label="Humidifier temperature limit (C)" value={settings.humidifierMaxTempC} onChange={(humidifierMaxTempC) => setSettings({ ...settings, humidifierMaxTempC })} />
                  </>
                )}
                {settings.humidifierKind === 2 && (
                  <>
                    <NumberField label="Prewarm time (min)" value={settings.humidifierPrewarmMinutes} onChange={(humidifierPrewarmMinutes) => setSettings({ ...settings, humidifierPrewarmMinutes })} />
                    <ToggleRow
                      label="Scheduled prewarm"
                      value={prewarmSchedule.enabled}
                      onChange={(enabled) => setPrewarmSchedule(sanitizePrewarmSchedule({ ...prewarmSchedule, enabled }))}
                    />
                    {prewarmSchedule.enabled && (
                      <>
                        <View style={styles.splitFields}>
                          <View style={styles.splitField}>
                            <NumberField
                              label="Prewarm hour"
                              value={prewarmSchedule.hour}
                              onChange={(hour) => setPrewarmSchedule(sanitizePrewarmSchedule({ ...prewarmSchedule, hour }))}
                              suffix="0-23"
                            />
                          </View>
                          <View style={styles.splitField}>
                            <NumberField
                              label="Prewarm minute"
                              value={prewarmSchedule.minute}
                              onChange={(minute) => setPrewarmSchedule(sanitizePrewarmSchedule({ ...prewarmSchedule, minute }))}
                              suffix="0-59"
                            />
                          </View>
                        </View>
                        <ValueRow label="Prewarm schedule" value={prewarmScheduleLabel} />
                        <Text style={styles.mutedText}>The phone must stay connected; the app still requires standby, no alert, and a ready water-warmer module at that time.</Text>
                      </>
                    )}
                    <View style={styles.actions}>
                      <ActionButton icon="thermometer" label="Start prewarm" onPress={() => sendControlCommand("prewarmStart")} disabled={!prewarmStartAllowed || busy} />
                      <ActionButton icon="close-circle" label="Stop prewarm" onPress={() => sendControlCommand("prewarmStop")} disabled={!canUseDevice || !protocolCompatible || busy} secondary />
                    </View>
                  </>
                )}
                <NumberField label="Heated hose lift (C)" value={settings.hoseTempDeltaC} onChange={(hoseTempDeltaC) => setSettings({ ...settings, hoseTempDeltaC })} />
                <ValueRow label="Auto range flag" value={settings.auto ? "Mode-derived: on" : "Mode-derived: off"} />
                <ToggleRow label="BLE advertising on boot" value={settings.bleAdv} onChange={(bleAdv) => setSettings({ ...settings, bleAdv })} />
                <TextField label="BLE name" value={settings.bleName} onChange={(bleName) => setSettings({ ...settings, bleName })} />
              </>
            )}
            <View style={styles.actions}>
              <ActionButton icon="refresh" label={advancedMode ? "Read" : "Update"} onPress={refreshSettings} disabled={!canUseDevice || busy} secondary />
              <ActionButton icon="save" label={advancedMode ? "Write" : "Save"} onPress={saveSettings} disabled={!settingsWriteAllowed || busy} />
            </View>
          </View>
        )}

        {screen === "logs" && (
          <View>
            <Text style={styles.sectionTitle}>{advancedMode ? "Logs" : "Here's your data"}</Text>
            {connectedDevice && retainedImportManifest && !retainedImportMatchesConnection && (
              <Text style={styles.mutedText}>
                Stored data belongs to a different Ozealis and is hidden while this device is connected.
              </Text>
            )}
            {advancedMode && (
              <View style={styles.actions}>
                <ActionButton icon="download" label="Read" onPress={readLogs} disabled={!retainedReadAllowed || busy} />
                <ActionButton icon="trash" label="Clear" onPress={clearLogs} disabled={!settingsWriteAllowed || busy} secondary />
              </View>
            )}
            {advancedMode ? (
              <>
                <Text style={styles.subhead}>Session CSV</Text>
                <ValueRow label="Live synced rows" value={liveSyncRows > 0 ? String(liveSyncRows) : "--"} />
                <ValueRow label="Live synced window" value={liveSyncCsv ? formatDuration(liveSyncSummary.durationSec) : "--"} />
                <ValueRow label="Session rows" value={visibleLogCsv ? String(sessionRows) : "--"} />
                <ValueRow label="Retained window" value={visibleLogCsv ? formatDuration(sessionSummary.durationSec) : "--"} />
                <ValueRow
                  label="Retained source"
                  value={retainedImportMatchesConnection && retainedImportManifest ? retainedImportManifest.deviceId : "--"}
                />
                <ValueRow
                  label="Imported"
                  value={
                    retainedImportMatchesConnection && retainedImportManifest
                      ? new Date(retainedImportManifest.importedAtMs).toLocaleString()
                      : "--"
                  }
                />
                <ValueRow label="Analysis source" value={analysisSource} />
                <ValueRow label="Graph view" value={graphWindowLabel} />
                <Text style={styles.mutedText}>
                  Connected app sessions keep the latest 60 minutes of live CSV at up to 10 Hz. If Bluetooth disconnects, analysis derates to the rolling 30-minute 1 Hz retained firmware buffer; the last live trace remains exportable.
                </Text>
                {graphSourcePoints.length > 0 && <GraphScaleSelector advanced={advancedMode} value={activeGraphScale} onChange={setGraphScale} />}
              </>
            ) : (
              <>
                {simpleDataDays.length > 0 && (
                  <>
                    {simpleDataDays.length > 1 && <Text style={styles.mutedText}>Select the day if you want.</Text>}
                    <View style={styles.dayPicker}>
                      {simpleDataDays.map((day) => {
                        const active = day.key === (selectedDataDay?.key || "day-0");
                        return (
                          <Pressable
                            key={day.key}
                            accessibilityRole="button"
                            style={[styles.dayChoice, active && styles.dayChoiceActive]}
                            onPress={() => setSelectedDataDayKey(day.key)}
                          >
                            <Text style={[styles.dayChoiceText, active && styles.dayChoiceTextActive]}>{day.label}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </>
                )}
                {selectedDataCsv.trim() && (
                  <>
                    <Text style={styles.dataDayTitle}>{selectedDataDay?.label || "Latest day"}</Text>
                    <ValueRow label="Time" value={simpleDataWindow} />
                    <ValueRow label="View" value={graphWindowLabel} />
                    <GraphScaleSelector advanced={advancedMode} value={activeGraphScale} onChange={setGraphScale} />
                  </>
                )}
              </>
            )}
            {advancedMode || selectedDataCsv.trim() ? (
              <>
                <SessionGraphs points={sessionGraphPoints} advanced={advancedMode} />
                <PotentialObservations observations={sessionObservations} sessionLoaded={Boolean(visibleAnalysisCsv.trim())} advanced={advancedMode} />
              </>
            ) : (
              <Text style={styles.mutedText}>Your pressure and airflow graphs will appear here.</Text>
            )}
            {!advancedMode && (
              <View style={styles.actions}>
                <ActionButton icon="refresh" label="Update" onPress={readLogs} disabled={!canUseDevice || busy} secondary />
              </View>
            )}
            {advancedMode && <Text style={styles.logBox}>{sessionPreview || "No session log loaded."}</Text>}
            {advancedMode && (
              <>
                <ActionButton
                  icon="share"
                  label="Export live 10 Hz CSV"
                  onPress={exportLiveSyncCsv}
                  disabled={liveSyncRows === 0}
                  secondary
                />
                <ActionButton icon="share" label="Export session CSV" onPress={() => exportCsv("ozealis-session", visibleLogCsv)} disabled={!visibleLogCsv.trim()} secondary />
                <Text style={styles.subhead}>Fault CSV</Text>
                <ValueRow label="Fault rows" value={visibleFaultCsv ? String(faultRows) : "--"} />
                <Text style={styles.logBox}>{faultPreview || "No fault log loaded."}</Text>
                <ActionButton icon="share" label="Export fault CSV" onPress={() => exportCsv("ozealis-faults", visibleFaultCsv)} disabled={!visibleFaultCsv.trim()} secondary />
              </>
            )}
          </View>
        )}

        {screen === "calibration" && (
          <View>
            <Text style={styles.sectionTitle}>{advancedMode ? "Motor Calibration" : "Water-column setup"}</Text>
            <Text style={styles.mutedText}>
              {advancedMode
                ? "Run only on an instrumented bench with a blocked or known test load. Stop immediately if pressure, sound, heat, vibration, or current behavior looks wrong."
                : "Use the tube, water, ruler, and device together."}
            </Text>
            {!advancedMode && (
              <View style={styles.setupPanel}>
                <View style={styles.setupHeaderRow}>
                  <View>
                    <Text style={styles.homeEyebrow}>guided setup</Text>
                    <Text style={styles.setupTitle}>{simpleSetupStatus}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusDot,
                      !waterSetupReady && !waterSetupSaved && !simpleSetupRunning && styles.statusDotPending,
                      waterSetupSaved && styles.statusDotSaved,
                      simpleSetupRunning && styles.statusDotActive,
                    ]}
                  />
                </View>
                <View style={styles.setupProgressTrack}>
                  <View style={[styles.setupProgressFill, { width: `${Math.round((waterCapturedCount / waterColumnTargets.length) * 100)}%` }]} />
                </View>
                <Text style={styles.setupProgressText}>
                  {simpleSetupRunning
                    ? `Point ${Math.min(waterCapturedCount + 1, waterColumnTargets.length)} of ${waterColumnTargets.length}. Wait until the waterline reaches ${waterTargetLabel}, then capture.`
                    : waterSetupSaved
                      ? "Setup saved."
                      : "Check each setup item, then start."}
                </Text>
              </View>
            )}
            <Text style={styles.subhead}>{advancedMode ? "Water Column Guide" : "Before you start"}</Text>
            <View style={advancedMode ? styles.guideBox : styles.simpleGuideBox}>
              {advancedMode ? (
                <>
                  <Text style={styles.guideText}>1. Make a U with clear CPAP tubing and tape it to a vertical surface.</Text>
                  <Text style={styles.guideText}>2. Add water to the tube. Keep the machine at least 5 cm above the water level.</Text>
                  <Text style={styles.guideText}>3. Secure a 20 cm or longer ruler beside the far tube leg with zero at the resting waterline.</Text>
                  <Text style={styles.guideText}>4. Start Water column. Press Capture point, or the device button, when the waterline reaches the target mark.</Text>
                  <Text style={styles.guideText}>5. Continue through 20 cmH2O, then export the session CSV and parameter snapshot.</Text>
                </>
              ) : (
                <>
                  <SetupStep number={1} text="Tape clear CPAP tubing into a U on a vertical surface." />
                  <SetupStep number={2} text="Add water and keep the machine at least 5 cm above the water." />
                  <SetupStep number={3} text="Place a 20 cm or longer ruler with zero at the resting waterline." />
                  <SetupStep number={4} text="Start setup. Capture each point only when the waterline reaches the matching ruler mark." />
                  <SetupStep number={5} text="Continue through 20 cmH2O. The app saves the setup when the sequence finishes." />
                </>
              )}
              <View style={styles.guideChecklist}>
                {waterSetupItems.map((item) => (
                  <View key={item.key} style={styles.guideCheckRow}>
                    <Text style={styles.guideCheckText}>{item.label}</Text>
                    <Switch
                      value={waterSetupChecks[item.key]}
                      onValueChange={(value) => setWaterSetupCheck(item.key, value)}
                      trackColor={{ false: "#cbd5e1", true: "#99f6e4" }}
                      thumbColor={waterSetupChecks[item.key] ? accent : "#f8fafc"}
                    />
                  </View>
                ))}
              </View>
            </View>
            <Text style={styles.capturePrompt}>
              {calibration.mode === "water"
                ? `Current target: ${waterTargetLabel}. Capture only when the ruler waterline matches this mark.`
                : "Start at 4 cmH2O. The app moves one mark at a time."}
            </Text>
            <View style={styles.targetLadder} accessibilityLabel="Water-column target ladder: captured, current, and pending">
              {waterColumnTargets.map((target) => {
                const captured = target < 4 + waterCapturedCount;
                const current = calibration.mode === "water" && calibration.active && target === activeWaterTarget;
                const icon = captured ? "checkmark-circle" : current ? "radio-button-on" : "ellipse-outline";
                const color = captured ? "#0f766e" : current ? "#b45309" : "#64748b";
                return (
                  <View
                    key={target}
                    style={[
                      styles.targetStep,
                      captured && styles.targetStepCaptured,
                      current && styles.targetStepCurrent,
                    ]}
                  >
                    <Ionicons name={icon} size={16} color={color} />
                    <Text style={[styles.targetStepText, { color }]}>{target} cm</Text>
                  </View>
                );
              })}
            </View>
            {advancedMode && <ValueRow label="Calibration state" value={calibration.state} />}
            {advancedMode && (
              <>
                <ValueRow label="Sweep active" value={calibration.active ? "Yes" : "No"} />
                <ValueRow label="Stored profile" value={calibration.valid ? "Valid" : "Not valid"} />
                <ValueRow label="Current command" value={String(calibration.amp)} />
                <ValueRow label="Sweep range" value={`${calibration.minAmp}-${calibration.maxAmp}`} />
                <ValueRow label="Best pressure" value={`${calibration.bestCm.toFixed(2)} cmH2O @ ${calibration.bestAmp}`} />
                <ValueRow label="Stored max" value={`${calibration.maxCm.toFixed(2)} cmH2O`} />
                <ValueRow label="Gain" value={`${calibration.gain.toFixed(5)} cmH2O/cmd`} />
                <ValueRow label="Calibration mode" value={calibration.mode} />
                <ValueRow label="Calibration FG" value={calibration.fgHz === null ? "--" : `${calibration.fgHz.toFixed(2)} Hz`} />
              </>
            )}
            {advancedMode ? (
              <>
                <ValueRow label="Water target" value={calibration.targetCm ? `${calibration.targetCm} cmH2O` : "--"} />
                <ValueRow label="Captured points" value={`${calibration.capturedPoints}/17`} />
                <ValueRow label="Curve map" value={calibration.curveValid ? "Saved" : "Not saved"} />
                <ValueRow
                  label="Sensor trim"
                  value={
                    calibration.sensorTrimValid
                      ? `${calibration.sensorTrimHpa.toFixed(3)} hPa (${calibration.sensorTrimSamples} samples, ${calibration.sensorTrimStatus})`
                      : `${calibration.sensorTrimStatus} (${calibration.sensorTrimSamples} samples)`
                  }
                />
              </>
            ) : (
              <ValueRow label="Next ruler mark" value={calibration.targetCm ? `${calibration.targetCm} cmH2O` : "4 cmH2O"} />
            )}
            {advancedMode && (
              <>
                <Text style={styles.subhead}>MCF8316D Parameters</Text>
                <ValueRow label="Driver" value={driverParams.driver} />
                <ValueRow label="Snapshot state" value={driverParams.state} />
                <ValueRow label="Snapshot I2C address" value={driverParams.i2cAddr} />
                <ValueRow label="Snapshot I2C" value={driverParams.i2c === null ? "Unknown" : driverParams.i2c ? "Present" : "Missing"} />
                <ValueRow label="Snapshot fault" value={driverParams.fault === null ? "Unknown" : driverParams.fault ? "Latched" : "Clear"} />
                <ValueRow label="Snapshot FG" value={driverParams.fgHz === null ? "--" : `${driverParams.fgHz.toFixed(2)} Hz`} />
                <ValueRow label="Snapshot command" value={`${driverParams.commandAmp} amp / ${driverParams.commandPwm} pwm`} />
                <ValueRow
                  label="Snapshot pins"
                  value={`SPD ${formatMcfPin(driverParams.pins.speedPwm)}, DRVOFF ${formatMcfPin(driverParams.pins.drvOff)}, nFAULT ${formatMcfPin(driverParams.pins.nFault)}, FG ${formatMcfPin(driverParams.pins.fg)}`}
                />
                <ValueRow label="Runtime speed" value={driverParams.runtimeSpeed} />
                <ValueRow label="Driver command path" value={driverCommandPathLabel} />
                <ValueRow label="Target speed" value={driverParams.targetSpeed} />
                <ValueRow label="Command ready" value={driverParams.commandReady ? "Yes" : "No"} />
                <ValueRow label="Parameter writes" value={driverParams.writesAllowed ? "Enabled" : "Disabled"} />
                <ValueRow label="Bench-only" value={driverParams.benchOnly ? "Yes" : "No"} />
                <View style={styles.actions}>
                  <ActionButton icon="download" label="Read snapshot" onPress={readDriverParams} disabled={!canUseDevice || busy} secondary />
                  <ActionButton icon="share" label="Export snapshot" onPress={() => exportJson("ozealis-mcf8316d-params", redactSensitiveJson(driverParamsJson))} disabled={!driverParamsJson.trim()} secondary />
                </View>
                <Text style={styles.mono}>{driverParamsJson || "No driver parameter snapshot loaded."}</Text>
              </>
            )}
            {advancedMode && !calibrationStartAllowed && <Text style={styles.mutedText}>{calibrationBlockReason}</Text>}
            <View style={styles.actions}>
              {advancedMode && (
                <ActionButton
                  icon="pulse"
                  label="Start sweep"
                  onPress={() => sendCalibrationCommand("start")}
                  disabled={!calibrationStartAllowed || busy}
                />
              )}
              {advancedMode && (
                <ActionButton
                  icon="water"
                  label="Water column"
                  onPress={() => sendCalibrationCommand("waterStart")}
                  disabled={!calibrationStartAllowed || !waterSetupReady || busy}
                  secondary
                />
              )}
              {!advancedMode && !canUseDevice && (
                <ActionButton icon="bluetooth" label="Pair device" onPress={startScan} disabled={scanning || busy} secondary />
              )}
              {!advancedMode && showSimpleWaterStart && (
                <ActionButton
                  icon="water"
                  label="Start setup"
                  onPress={() => sendCalibrationCommand("waterStart")}
                  disabled={simpleWaterStartDisabled}
                  secondary
                />
              )}
              {(advancedMode || showSimpleWaterCapture) && (
                <ActionButton
                  icon="checkmark-circle"
                  label={calibration.mode === "water" && calibration.targetCm ? `Capture ${calibration.targetCm} cm` : advancedMode ? "Capture point" : "Capture mark"}
                  onPress={() => sendCalibrationCommand("capture")}
                  disabled={!waterCaptureAllowed || busy}
                  secondary
                />
              )}
              {(advancedMode || showSimpleWaterStop) && (
                <ActionButton
                  icon="close-circle"
                  label={advancedMode ? "Abort" : "Stop setup"}
                  onPress={() => sendCalibrationCommand("abort")}
                  disabled={!calibrationAbortAllowed || busy}
                  secondary
                />
              )}
            </View>
            {advancedMode && (
              <>
                <Text style={styles.subhead}>Raw Status</Text>
                <Text style={styles.mono}>{telemetry.calibrationStatus}</Text>
              </>
            )}
          </View>
        )}

        {screen === "ota" && (
          <View>
            <Text style={styles.sectionTitle}>OTA Firmware Update</Text>
            <Text style={styles.mutedText}>
              Use only firmware binaries you built and verified. OTA is available only while idle and not calibrating.
              The current OTA path does not verify project-owned signatures or pinned certificates. Keep the device powered until OTA status reports OK or ERR.
            </Text>
            <ValueRow label="OTA status" value={telemetry.otaStatus} />
            <TextField label="WiFi SSID" value={otaSsid} onChange={setOtaSsid} />
            <TextField label="WiFi password" value={otaPassword} onChange={setOtaPassword} secure />
            <TextField label="Firmware URL" value={otaUrl} onChange={setOtaUrl} autoCapitalize="none" />
            <ActionButton icon="cloud-upload" label="Send OTA command" onPress={sendOtaCommand} disabled={!otaAllowed || busy} />
          </View>
        )}

        {screen === "about" && (
          <View>
            <Text style={styles.sectionTitle}>{advancedMode ? "About This App" : "About Ozealis"}</Text>
            <Text style={styles.paragraph}>
              {advancedMode
                ? "Ozealis Control is the companion app for an open-source experimental airflow simulator. It connects to the firmware BLE service, reads telemetry, writes persisted settings, exports logs, and starts OTA updates."
                : "Ozealis is the open-source experimental CPAP/BiPAP project at https://ozealis.org/."}
            </Text>
            {advancedMode ? (
              <Text style={styles.paragraph}>
                It makes no medical, diagnostic, therapeutic, performance, safety, or reliability claims. You are
                responsible for validation, supervision, regulatory compliance, and risk decisions.
              </Text>
            ) : (
              <Text style={styles.paragraph}>Experimental research project only. No warranties or medical claims.</Text>
            )}
            {advancedMode && <ValueRow label="Project" value={projectUrl} />}
            {advancedMode && <ValueRow label="App version" value={appVersion} />}
            {(advancedMode || connectedDevice) && <ValueRow label="Device name" value={connectedDevice ? connectedName : "Ozealis"} />}
            <View style={styles.actions}>
              <ActionButton icon="globe" label="Open ozealis.org" onPress={() => Linking.openURL(projectUrl)} secondary />
            </View>
            <Pressable
              accessibilityRole="button"
              style={styles.builderDisclosure}
              onPress={() => setShowBuilderOptions((value) => !value)}
            >
              <Text style={styles.builderDisclosureText}>Builder settings</Text>
              <Ionicons name={showBuilderOptions ? "chevron-up" : "chevron-down"} size={18} color="#475569" />
            </Pressable>
            {showBuilderOptions && <UiModeSelector advancedMode={advancedMode} setAdvancedMode={setAdvancedMode} />}
            {advancedMode && (
              <>
                <ValueRow label="BLE service" value={OZEALIS_SERVICE_UUID} />
                <ValueRow label="Protocol" value={protocolVersion} />
                <ValueRow label="Protocol writes" value={protocolCompatible ? "Enabled" : "Disabled"} />
              </>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ValueRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.valueRow}>
      <Text style={styles.valueLabel}>{label}</Text>
      <Text style={styles.valueText}>{value || "--"}</Text>
    </View>
  );
}

function NumberField({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
}) {
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText(String(value));
  }, [value]);

  const commitText = (nextText: string) => {
    setText(nextText);
    const normalized = nextText.replace(",", ".").trim();
    if (!normalized || normalized === "-" || normalized === "." || normalized === "-." || normalized.endsWith(".")) return;
    const nextValue = Number(normalized);
    if (Number.isFinite(nextValue)) onChange(nextValue);
  };

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputShell}>
        <TextInput
          style={[styles.input, suffix && styles.inputWithSuffix]}
          keyboardType="decimal-pad"
          value={text}
          onChangeText={commitText}
          onBlur={() => setText(String(value))}
        />
        {suffix && <Text style={styles.inputSuffix}>{suffix}</Text>}
      </View>
    </View>
  );
}

function TextField({
  label,
  value,
  onChange,
  secure,
  autoCapitalize = "sentences",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  secure?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        secureTextEntry={secure}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
      />
    </View>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.valueLabel}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: "#99f6e4", false: "#cbd5e1" }} thumbColor={value ? accent : "#f8fafc"} />
    </View>
  );
}

function UiModeSelector({
  advancedMode,
  setAdvancedMode,
}: {
  advancedMode: boolean;
  setAdvancedMode: (value: boolean) => void;
}) {
  return (
    <View style={styles.modeShell}>
      <Pressable
        accessibilityRole="button"
        style={[styles.modeChoice, !advancedMode && styles.modeChoiceActive]}
        onPress={() => setAdvancedMode(false)}
      >
        <Text style={[styles.modeChoiceText, !advancedMode && styles.modeChoiceTextActive]}>Standard</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        style={[styles.modeChoice, advancedMode && styles.modeChoiceActive]}
        onPress={() => setAdvancedMode(true)}
      >
        <Text style={[styles.modeChoiceText, advancedMode && styles.modeChoiceTextActive]}>Builder</Text>
      </Pressable>
    </View>
  );
}

function SetupStep({ number, text }: { number: number; text: string }) {
  return (
    <View style={styles.setupStep}>
      <View style={styles.setupStepNumber}>
        <Text style={styles.setupStepNumberText}>{number}</Text>
      </View>
      <Text style={styles.setupStepText}>{text}</Text>
    </View>
  );
}

function SegmentedMode({
  value,
  advanced,
  onChange,
}: {
  value: OzealisSettings["mode"];
  advanced: boolean;
  onChange: (value: OzealisSettings["mode"]) => void;
}) {
  const visibleModeIndexes = advanced ? therapyModes.map((_, index) => index) : [...simpleTherapyModeIndexes];
  const currentModeIsVisible = visibleModeIndexes.includes(value);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{advanced ? "Therapy mode" : "Mode"}</Text>
      {!currentModeIsVisible && (
        <View style={styles.modeLockedRow}>
          <Text style={styles.modeLockedTitle}>{therapyModes[value] || "Builder mode"} selected</Text>
          <Text style={styles.modeLockedText}>Switch to Builder in About, then change this in Comfort.</Text>
        </View>
      )}
      {(advanced || currentModeIsVisible) && (
        <View style={styles.segmented}>
          {visibleModeIndexes.map((index) => {
            const mode = therapyModes[index];
            return (
            <Pressable
              key={mode}
              onPress={() => onChange(index as OzealisSettings["mode"])}
              style={[styles.segment, value === index && styles.segmentActive]}
            >
              <Text style={[styles.segmentText, value === index && styles.segmentTextActive]}>{mode}</Text>
            </Pressable>
            );
          })}
        </View>
      )}
      {advanced && (
        <Text style={styles.modeLockedText}>
          CPAP and AutoPAP use the current experimental pressure-target logic. BiPAP S uses an experimental bilevel target family; ST/T/PC add experimental backup-rate timing. ASV/AutoASV servo adaptation and VAPS volume assurance are not implemented.
        </Text>
      )}
    </View>
  );
}

function SegmentedHumidifierKind({
  value,
  onChange,
}: {
  value: OzealisSettings["humidifierKind"];
  onChange: (value: OzealisSettings["humidifierKind"]) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>Humidifier type</Text>
      <View style={styles.segmented}>
        {humidifierKinds.map((label, index) => (
          <Pressable
            key={label}
            onPress={() => onChange(index as OzealisSettings["humidifierKind"])}
            style={[styles.segment, value === index && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, value === index && styles.segmentTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function IconButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.iconButton, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Ionicons name={icon} size={22} color="#f8fafc" />
    </Pressable>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  disabled,
  secondary,
  fill,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  fill?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      style={[styles.actionButton, fill && styles.actionButtonFill, secondary && styles.actionButtonSecondary, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Ionicons name={icon} size={18} color={secondary ? accent : "#f8fafc"} />
      <Text style={[styles.actionText, secondary && styles.actionTextSecondary]}>{label}</Text>
    </Pressable>
  );
}

function SessionGraphs({ points, advanced }: { points: SessionGraphPoint[]; advanced: boolean }) {
  if (points.length === 0) {
    return (
      <Text style={styles.mutedText}>
        {advanced ? "Pressure and flow graphs appear after a session import." : "Your pressure and airflow graphs will appear here."}
      </Text>
    );
  }

  const hasOximetry = points.some((point) => Number.isFinite(point.spo2Percent) || Number.isFinite(point.pulseBpm));
  const hasEnvironment = points.some(
    (point) => Number.isFinite(point.humidifierTempC) || Number.isFinite(point.humidifierRhPercent) || Number.isFinite(point.hoseTempC),
  );

  return (
    <View style={styles.sessionGraphs}>
      <GraphPlot label="Pressure" unit="cmH2O" color="#0f766e" values={points.map((point) => point.pressureCm)} showRange={advanced} />
      <GraphPlot
        label={advanced ? "Flow proxy" : "Airflow trend"}
        unit={advanced ? "hPa" : "relative"}
        color="#2563eb"
        values={points.map((point) => point.flowHpa)}
        showRange={advanced}
      />
      {hasOximetry && (
        <>
          <GraphPlot
            label={advanced ? "SpO2" : "Oxygen"}
            unit="%"
            color="#be123c"
            values={points.map((point) => point.spo2Percent ?? Number.NaN)}
            showRange={advanced}
          />
          {advanced && (
            <GraphPlot
              label="Pulse"
              unit="bpm"
              color="#9333ea"
              values={points.map((point) => point.pulseBpm ?? Number.NaN)}
              showRange
            />
          )}
        </>
      )}
      {advanced && (
        <>
          {hasEnvironment && (
            <>
              <GraphPlot
                label="Humidity"
                unit="% RH"
                color="#0891b2"
                values={points.map((point) => point.humidifierRhPercent ?? Number.NaN)}
                showRange
              />
              <GraphPlot
                label="Air temperature"
                unit="C"
                color="#b45309"
                values={points.map((point) => point.humidifierTempC ?? Number.NaN)}
                showRange
              />
              <GraphPlot
                label="Hose temperature"
                unit="C"
                color="#854d0e"
                values={points.map((point) => point.hoseTempC ?? Number.NaN)}
                showRange
              />
            </>
          )}
          <GraphPlot
            label="Driver FG"
            unit="Hz"
            color="#7c2d12"
            values={points.map((point) => point.motorFgHz)}
            showRange
          />
        </>
      )}
    </View>
  );
}

function GraphScaleSelector({
  advanced,
  value,
  onChange,
}: {
  advanced: boolean;
  value: GraphScale;
  onChange: (value: GraphScale) => void;
}) {
  const options = advanced ? advancedGraphScales : simpleGraphScales;
  return (
    <View style={styles.graphScalePicker}>
      {options.map((option) => {
        const active = option.key === value;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="button"
            style={[styles.graphScaleChoice, active && styles.graphScaleChoiceActive]}
            onPress={() => onChange(option.key)}
          >
            <Text style={[styles.graphScaleText, active && styles.graphScaleTextActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function PotentialObservations({
  observations,
  sessionLoaded,
  advanced,
}: {
  observations: SessionObservation[];
  sessionLoaded: boolean;
  advanced: boolean;
}) {
  const preview = observations.slice(0, 6);
  return (
    <View style={styles.observationBlock}>
      <Text style={styles.graphLabel}>{advanced ? "Potential breathing observations" : "Airflow notes"}</Text>
      <Text style={styles.observationNotice}>
        {advanced
          ? "Non-diagnostic heuristic flags from the imported flow proxy. These are not AHI, diagnosis, screening, or treatment guidance."
          : "Notes from the airflow trend. These are not medical advice or diagnosis."}
      </Text>
      {!sessionLoaded && <Text style={styles.mutedText}>Notes will appear here.</Text>}
      {sessionLoaded && observations.length === 0 && (
        <Text style={styles.mutedText}>{advanced ? "No low-flow observation windows detected in the imported session." : "Nothing unusual noted."}</Text>
      )}
      {preview.map((observation, index) => (
        <View key={`${observation.startMs}-${index}`} style={styles.observationRow}>
          <Text style={styles.observationType}>{advanced ? observation.type : "Airflow note"}</Text>
          <Text style={styles.observationDetail}>
            {advanced
              ? `${formatElapsed(observation.startMs)} for ${observation.durationSec}s, ${observation.confidence} confidence, flow drop about ${observation.flowDropPercent}%`
              : `Around ${formatElapsed(observation.startMs)} for about ${observation.durationSec}s.`}
          </Text>
          {advanced && <Text style={styles.observationBasis}>{observation.basis}</Text>}
        </View>
      ))}
      {observations.length > preview.length && (
        <Text style={styles.mutedText}>{observations.length - preview.length} more {advanced ? "flags in this session" : "notes here"}.</Text>
      )}
    </View>
  );
}

function GraphPlot({
  label,
  unit,
  color,
  values,
  showRange,
}: {
  label: string;
  unit: string;
  color: string;
  values: number[];
  showRange: boolean;
}) {
  const finiteValues = values.filter(Number.isFinite);
  const min = finiteValues.length ? Math.min(...finiteValues) : 0;
  const max = finiteValues.length ? Math.max(...finiteValues) : 0;
  const range = Math.max(0.001, max - min);

  return (
    <View style={styles.graphBlock}>
      <View style={styles.graphHeader}>
        <Text style={styles.graphLabel}>{label}</Text>
        {showRange && (
          <Text style={styles.graphRange}>
            {min.toFixed(1)}-{max.toFixed(1)} {unit}
          </Text>
        )}
      </View>
      <View style={styles.graphTrack}>
        {values.map((value, index) => {
          const normalized = Number.isFinite(value) ? (value - min) / range : 0;
          const height = 4 + normalized * 72;
          return <View key={`${label}-${index}`} style={[styles.graphBar, { height, backgroundColor: color }]} />;
        })}
      </View>
    </View>
  );
}

function formatPressureSetting(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatPrewarmScheduleLabel(schedule: PrewarmSchedule): string {
  const safe = sanitizePrewarmSchedule(schedule);
  const time = `${String(safe.hour).padStart(2, "0")}:${String(safe.minute).padStart(2, "0")}`;
  return safe.enabled ? `Daily at ${time}` : "Off";
}

function roundSample(value: number, decimals: number): number {
  const multiplier = 10 ** decimals;
  return Math.round(value * multiplier) / multiplier;
}

function formatMcfPin(value: number | null): string {
  if (value === null) return "--";
  return value < 0 ? "disabled" : `GPIO${value}`;
}

function simpleSettingLimitMessages(current: OzealisSettings, safe: OzealisSettings): string[] {
  const messages: string[] = [];
  if (current.pMin !== safe.pMin) messages.push(`Low pressure adjusted to ${formatPressureSetting(safe.pMin)} cmH2O.`);
  if (current.pMax !== safe.pMax) messages.push(`High pressure adjusted to ${formatPressureSetting(safe.pMax)} cmH2O.`);
  if (current.epr !== safe.epr) messages.push(`Pressure relief adjusted to ${formatPressureSetting(safe.epr)} cmH2O.`);
  if (current.ramp !== safe.ramp) messages.push(`Ramp time adjusted to ${Math.round(safe.ramp / 60)} min.`);
  if (current.mode !== safe.mode) messages.push(`Mode adjusted to ${therapyModes[safe.mode]}.`);
  return messages.length > 0 ? messages : settingLimitMessages(current);
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function windowGraphPoints(points: SessionGraphPoint[], scale: GraphScale, maxPoints: number): SessionGraphPoint[] {
  if (points.length === 0) return [];
  const windowMs = graphScaleWindowsMs[scale];
  const lastMs = points[points.length - 1].ms;
  const windowed = windowMs === null ? points : points.filter((point) => point.ms >= lastMs - windowMs);
  return downsampleGraphPoints(windowed.length > 0 ? windowed : points.slice(-1), maxPoints);
}

function downsampleGraphPoints(points: SessionGraphPoint[], maxPoints: number): SessionGraphPoint[] {
  const pointLimit = Number.isFinite(maxPoints) ? Math.max(0, Math.floor(maxPoints)) : 120;
  if (pointLimit === 0) return [];
  if (pointLimit === 1) return points.length > 0 ? [points[points.length - 1]] : [];
  if (points.length <= pointLimit) return points;
  return Array.from({ length: pointLimit }, (_, index) => {
    const sourceIndex = Math.round((index * (points.length - 1)) / (pointLimit - 1));
    return points[sourceIndex];
  });
}

function formatGraphWindowLabel(points: SessionGraphPoint[], sourcePoints: SessionGraphPoint[], scale: GraphScale, advanced: boolean): string {
  if (points.length === 0) return "--";
  const firstMs = points[0].ms;
  const lastMs = points[points.length - 1].ms;
  const durationSec = Math.max(0, (lastMs - firstMs) / 1000);
  const prefix = scale === "all" ? (advanced ? "All" : "Night") : scale === "10m" ? "Latest 10m" : scale === "1m" ? "Latest 1m" : advanced ? "Latest 30s" : "Breath";
  if (!advanced) return `${prefix} (${formatDuration(durationSec)})`;
  const sourceNote = sourcePoints.length > points.length ? ` of ${sourcePoints.length}` : "";
  return `${prefix} (${formatDuration(durationSec)}, ${points.length}${sourceNote} points)`;
}

function formatDuration(totalSeconds: number): string {
  if (totalSeconds > 0 && totalSeconds < 1) return "<1s";
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes === 0) return `${remainingSeconds}s`;
  return `${minutes}m ${remainingSeconds}s`;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: 0,
  },
  subtitle: {
    marginTop: 3,
    color: "#475569",
    fontSize: 14,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: accent,
  },
  notice: {
    marginHorizontal: 20,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
    flexDirection: "row",
    gap: 8,
  },
  noticeText: {
    flex: 1,
    color: "#78350f",
    fontSize: 13,
    lineHeight: 18,
  },
  statusLine: {
    minHeight: 42,
    marginHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  statusText: {
    flex: 1,
    color: "#475569",
    fontSize: 13,
  },
  modeShell: {
    marginHorizontal: 0,
    marginBottom: 12,
    padding: 4,
    minHeight: 42,
    borderRadius: 8,
    backgroundColor: "#e2e8f0",
    flexDirection: "row",
    gap: 4,
  },
  modeChoice: {
    flex: 1,
    minHeight: 34,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  modeChoiceActive: {
    backgroundColor: "#ffffff",
  },
  modeChoiceText: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "800",
  },
  modeChoiceTextActive: {
    color: "#0f172a",
  },
  scanPanel: {
    marginHorizontal: 20,
    marginBottom: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#e2e8f0",
  },
  sectionTitle: {
    marginTop: 14,
    marginBottom: 10,
    color: "#0f172a",
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800",
  },
  mutedText: {
    color: "#64748b",
    fontSize: 13,
    lineHeight: 19,
  },
  deviceRow: {
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderColor: "#e2e8f0",
  },
  deviceName: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "700",
  },
  tabs: {
    flexDirection: "row",
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
  },
  tab: {
    flex: 1,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: accent,
  },
  tabText: {
    fontSize: 10,
    color: "#64748b",
    fontWeight: "800",
    letterSpacing: 0,
  },
  tabTextActive: {
    color: accent,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  errorPanel: {
    margin: 20,
    padding: 18,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dbe4ea",
    gap: 12,
  },
  errorTitle: {
    color: "#0f172a",
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
  },
  errorAction: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: accent,
    alignItems: "center",
    justifyContent: "center",
  },
  homePanel: {
    marginTop: 16,
    marginBottom: 8,
    padding: 18,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dbe4ea",
  },
  homeHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  homeEyebrow: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0,
  },
  homeStatus: {
    marginTop: 2,
    color: "#0f172a",
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
  },
  statusDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#0f766e",
  },
  statusDotFault: {
    backgroundColor: "#b45309",
  },
  statusDotPending: {
    backgroundColor: "#94a3b8",
  },
  statusDotWarm: {
    backgroundColor: "#d97706",
  },
  statusDotActive: {
    backgroundColor: "#b45309",
  },
  statusDotSaved: {
    backgroundColor: "#2563eb",
  },
  pressureReadout: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  pressureValue: {
    color: "#0f172a",
    fontSize: 54,
    lineHeight: 60,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  pressureUnit: {
    paddingBottom: 9,
    color: "#475569",
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
  },
  homeHint: {
    marginTop: 10,
    color: "#334155",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  oxygenStrip: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#dbe4e1",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#ffffff",
    gap: 2,
  },
  oxygenLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "700",
  },
  oxygenValue: {
    fontSize: 20,
    color: "#0f172a",
    fontWeight: "800",
  },
  oxygenDetail: {
    fontSize: 12,
    color: "#475569",
  },
  blockText: {
    marginTop: 10,
    color: "#92400e",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  primaryActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 16,
  },
  valueRow: {
    minHeight: 44,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: "#e2e8f0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  valueLabel: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "600",
  },
  valueText: {
    flex: 1,
    textAlign: "right",
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "800",
  },
  mono: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#0f172a",
    color: "#ccfbf1",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
    fontSize: 12,
    lineHeight: 18,
  },
  field: {
    marginBottom: 12,
  },
  splitFields: {
    flexDirection: "row",
    gap: 10,
  },
  splitField: {
    flex: 1,
    minWidth: 0,
  },
  fieldLabel: {
    marginBottom: 6,
    color: "#334155",
    fontSize: 13,
    fontWeight: "700",
  },
  input: {
    height: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    color: "#0f172a",
    fontSize: 15,
  },
  inputShell: {
    position: "relative",
  },
  inputWithSuffix: {
    paddingRight: 52,
  },
  inputSuffix: {
    position: "absolute",
    right: 12,
    top: 13,
    color: "#64748b",
    fontSize: 14,
    fontWeight: "800",
  },
  toggleRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderColor: "#e2e8f0",
  },
  segmented: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  modeLockedRow: {
    marginBottom: 10,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#dbe4ea",
  },
  modeLockedTitle: {
    color: "#0f172a",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800",
  },
  modeLockedText: {
    marginTop: 3,
    color: "#64748b",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
  segment: {
    minWidth: "30%",
    flexGrow: 1,
    minHeight: 42,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
  },
  segmentActive: {
    borderColor: accent,
    backgroundColor: "#ccfbf1",
  },
  segmentText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  segmentTextActive: {
    color: "#134e4a",
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 8,
    marginBottom: 16,
  },
  actionButton: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: accent,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actionButtonFill: {
    flex: 1,
    minWidth: 180,
  },
  actionButtonSecondary: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#99f6e4",
  },
  actionText: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "800",
  },
  actionTextSecondary: {
    color: accent,
  },
  disabled: {
    opacity: 0.5,
  },
  subhead: {
    marginTop: 10,
    marginBottom: 6,
    color: "#334155",
    fontSize: 14,
    fontWeight: "800",
  },
  builderDisclosure: {
    minHeight: 44,
    marginTop: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  builderDisclosureText: {
    color: "#475569",
    fontSize: 14,
    fontWeight: "800",
  },
  dayPicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  dayChoice: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
  },
  dayChoiceActive: {
    borderColor: "#5eead4",
    backgroundColor: "#ccfbf1",
  },
  dayChoiceText: {
    color: "#475569",
    fontSize: 14,
    fontWeight: "800",
  },
  dayChoiceTextActive: {
    color: "#134e4a",
  },
  graphScalePicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
    marginBottom: 10,
  },
  graphScaleChoice: {
    minHeight: 38,
    minWidth: 76,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  graphScaleChoiceActive: {
    borderColor: "#5eead4",
    backgroundColor: "#ccfbf1",
  },
  graphScaleText: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },
  graphScaleTextActive: {
    color: "#134e4a",
  },
  dataDayTitle: {
    marginTop: 2,
    marginBottom: 2,
    color: "#0f172a",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
  },
  logBox: {
    minHeight: 96,
    maxHeight: 240,
    padding: 12,
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    color: "#0f172a",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
    fontSize: 12,
    lineHeight: 18,
  },
  sessionGraphs: {
    marginBottom: 12,
    gap: 10,
  },
  graphBlock: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#e2e8f0",
  },
  graphHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  graphLabel: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "800",
  },
  graphRange: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
  },
  graphTrack: {
    height: 84,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 1,
    overflow: "hidden",
  },
  graphBar: {
    flex: 1,
    minWidth: 1,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  observationBlock: {
    marginBottom: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#e2e8f0",
    gap: 8,
  },
  observationNotice: {
    color: "#78350f",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },
  observationRow: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderColor: "#e2e8f0",
    gap: 3,
  },
  observationType: {
    color: "#0f172a",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
  },
  observationDetail: {
    color: "#334155",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },
  observationBasis: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 17,
  },
  paragraph: {
    color: "#334155",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  setupPanel: {
    marginTop: 14,
    marginBottom: 12,
    padding: 16,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dbe4ea",
  },
  setupHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  setupTitle: {
    marginTop: 2,
    color: "#0f172a",
    fontSize: 21,
    lineHeight: 27,
    fontWeight: "800",
  },
  setupProgressTrack: {
    height: 8,
    marginTop: 14,
    borderRadius: 4,
    backgroundColor: "#e2e8f0",
    overflow: "hidden",
  },
  setupProgressFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: accent,
  },
  setupProgressText: {
    marginTop: 10,
    color: "#334155",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  setupSummaryRows: {
    marginTop: 6,
  },
  guideBox: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#e2e8f0",
    gap: 6,
  },
  simpleGuideBox: {
    paddingVertical: 6,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#e2e8f0",
    gap: 8,
  },
  guideText: {
    color: "#334155",
    fontSize: 13,
    lineHeight: 19,
  },
  setupStep: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  setupStepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ccfbf1",
  },
  setupStepNumberText: {
    color: "#134e4a",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
  setupStepText: {
    flex: 1,
    color: "#334155",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  guideChecklist: {
    marginTop: 6,
    gap: 4,
  },
  guideCheckRow: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  guideCheckText: {
    flex: 1,
    color: "#0f172a",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  capturePrompt: {
    marginTop: 10,
    marginBottom: 6,
    color: "#134e4a",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
  },
  targetLadder: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  targetStep: {
    width: 80,
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
  },
  targetStepCaptured: {
    borderColor: "#5eead4",
    backgroundColor: "#f0fdfa",
  },
  targetStepCurrent: {
    borderColor: "#f59e0b",
    backgroundColor: "#fffbeb",
  },
  targetStepText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
});
