import { Ionicons } from "@expo/vector-icons";
import { Buffer } from "buffer";
import * as Crypto from "expo-crypto";
import { Directory, File, Paths } from "expo-file-system";
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

import { advanceSessionGeneration, OperationLeaseCoordinator } from "./src/operationLease";
import type { OperationLeaseToken } from "./src/operationLease";
import { downsampleSessionGraphPoints } from "./src/graphDownsampling";
import {
  LIVE_EVIDENCE_MIN_FRESH_ROWS,
  buildLiveEvidenceManifest,
  decideLiveEvidenceSample,
  isSameLiveEvidenceOwner,
  restoreLiveEvidenceSnapshot,
  serializeLiveEvidenceManifest,
} from "./src/liveEvidence";
import type { LiveEvidenceManifest, LiveEvidenceOwner, LiveEvidenceSnapshot } from "./src/liveEvidence";
import {
  serializeSessionReportV1,
  sessionReportSelectedAirflowCsv,
} from "./src/sessionReport";
import type { SessionReportInput } from "./src/sessionReport";
import {
  SESSION_ARCHIVE_MAX_ENTRY_BYTES,
  SESSION_ARCHIVE_MAX_ENTRIES,
  SESSION_ARCHIVE_MAX_TOTAL_BYTES,
  compareSessionArchiveRecords,
  createSessionArchiveEntryV1,
  serializeSessionArchiveEntryV1,
  sortSessionArchiveRecords,
  verifySessionArchiveEntryV1,
} from "./src/sessionArchive";
import type {
  SessionComparisonMetric,
  SessionComparisonReasonCode,
  SessionComparisonV1,
  VerifiedSessionArchiveRecordV1,
} from "./src/sessionArchive";
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
  analyzeSessionCsv,
  filterSessionCsvByDay,
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
  SessionAnalysisStatus,
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
type CalibrationCommand = "start" | "waterStart" | "capture" | "abort";
type ForegroundBleOperation =
  | "connection:connect"
  | "connection:disconnect"
  | "settings:read"
  | "settings:write"
  | "logs:read:manual"
  | "logs:read:auto"
  | "logs:clear"
  | "motor-fault:clear"
  | "driver:read"
  | "ota:write"
  | `control:${ControlCommand}`
  | `calibration:${CalibrationCommand}`;
type ForegroundBleLease = {
  device: Device;
  sessionId: number;
  operation: ForegroundBleOperation;
  token: OperationLeaseToken<ForegroundBleOperation>;
};
type OtaCommandPayload = {
  ssid: string;
  password: string;
  url: string;
};
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
type SessionReportDraft = {
  ownerDeviceId: string;
  input: SessionReportInput;
};
type SessionReportArtifact = SessionReportDraft & {
  reportJson: string;
};
type StoredSessionArchiveRecord = {
  fileName: string;
  byteCount: number;
  record: VerifiedSessionArchiveRecordV1;
};
type PendingSessionArchiveFile = {
  fileName: string;
  byteCount: number;
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
const liveSyncManifestFileName = "ozealis-live-sync-manifest.json";
const retainedSessionImportFileName = "ozealis-retained-session.csv";
const retainedFaultImportFileName = "ozealis-retained-faults.csv";
const retainedImportManifestFileName = "ozealis-retained-import.json";
const uiPreferenceFileName = "ozealis-ui-preferences.json";
const prewarmScheduleFileName = "ozealis-prewarm-schedule.json";
const sessionArchiveDirectoryName = "ozealis-session-archive-v1";
const sessionArchiveFileNamePattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.json$/;
const sessionArchivePendingFileNamePattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.pending$/;
const sessionArchiveMaxRestoreFiles = SESSION_ARCHIVE_MAX_ENTRIES * 2;
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

async function digestSha256Text(value: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    value,
    { encoding: Crypto.CryptoEncoding.HEX },
  );
  return digest.toLowerCase();
}
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
              A command already in flight may have reached the device. Return to the app view, then reconnect and verify device state before changing airflow or setup.
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
  const scanAdmissionRef = useRef<{ kind: "ozealis" | "oximeter" } | null>(null);
  const autoImportRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousModeRef = useRef(EMPTY_TELEMETRY.mode);
  const previousAdvancedModeRef = useRef(false);
  const autoImportingSessionRef = useRef<number | null>(null);
  const autoImportPendingSessionRef = useRef<number | null>(null);
  const autoImportRetryCountRef = useRef(0);
  const prewarmScheduleSkipKeyRef = useRef("");
  const connectedDeviceRef = useRef<Device | null>(null);
  const deviceSessionIdRef = useRef(0);
  const foregroundBleCoordinatorRef = useRef<OperationLeaseCoordinator<ForegroundBleOperation> | null>(null);
  const connectionTransitionTokenRef = useRef<OperationLeaseToken<ForegroundBleOperation> | null>(null);
  const protocolVersionRef = useRef("unknown");
  const oximeterDeviceRef = useRef<Device | null>(null);
  const oximeterSessionIdRef = useRef(0);
  const oximeterTransitionRef = useRef<{
    operation: "connect" | "disconnect";
    deviceId: string;
    sessionId: number;
  } | null>(null);
  const oximetryRelayRef = useRef<LatestOnlyAsyncRelay<QueuedOximetryRelay> | null>(null);
  const liveSyncRowsRef = useRef<string[]>([]);
  const liveSyncPendingRowsRef = useRef<string[]>([]);
  const liveSyncLastMsRef = useRef(0);
  const liveSyncLastUiMsRef = useRef(0);
  const liveSyncOwnerRef = useRef<LiveEvidenceOwner | null>(null);
  const liveSyncManifestRef = useRef<LiveEvidenceManifest | null>(null);
  const liveReportSnapshotRef = useRef<LiveEvidenceSnapshot | null>(null);
  const liveSyncCreatedAtMsRef = useRef(0);
  const liveSyncProtocolRef = useRef("");
  const liveSyncFreshRowsRef = useRef(0);
  const liveSyncRestoredRef = useRef(false);
  const liveSyncLifecycleRef = useRef(0);
  const liveSyncSpoolReadyRef = useRef(false);
  const uiPreferenceReadyRef = useRef(false);
  const prewarmScheduleReadyRef = useRef(false);
  const sessionArchiveReadyRef = useRef(false);
  const sessionArchiveRecordsRef = useRef<StoredSessionArchiveRecord[]>([]);
  const sessionArchivePendingFilesRef = useRef<PendingSessionArchiveFile[]>([]);
  const sessionArchiveStoredBytesRef = useRef(0);
  const sessionArchiveMutationQueueRef = useRef<Promise<void>>(Promise.resolve());
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
  const [connectionTransitionBusy, setConnectionTransitionBusy] = useState(false);
  const [oximeterDevice, setOximeterDevice] = useState<Device | null>(null);
  const [oximeterScanning, setOximeterScanning] = useState(false);
  const [oximeterTransitionBusy, setOximeterTransitionBusy] = useState(false);
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
  const [sessionArchiveRecords, setSessionArchiveRecords] = useState<StoredSessionArchiveRecord[]>([]);
  const [sessionArchiveIssueCount, setSessionArchiveIssueCount] = useState(0);
  const [sessionArchivePendingCount, setSessionArchivePendingCount] = useState(0);
  const [sessionArchiveStorageError, setSessionArchiveStorageError] = useState(false);
  const [comparisonCurrentArchiveId, setComparisonCurrentArchiveId] = useState("");
  const [comparisonBaselineArchiveId, setComparisonBaselineArchiveId] = useState("");
  const [showAllArchivedSessions, setShowAllArchivedSessions] = useState(false);
  const [liveSyncCsv, setLiveSyncCsv] = useState("");
  const [liveSyncRowCount, setLiveSyncRowCount] = useState(0);
  const [liveSyncFreshRowCount, setLiveSyncFreshRowCount] = useState(0);
  const [liveSyncManifest, setLiveSyncManifest] = useState<LiveEvidenceManifest | null>(null);
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

  if (!foregroundBleCoordinatorRef.current) {
    foregroundBleCoordinatorRef.current = new OperationLeaseCoordinator<ForegroundBleOperation>({
      isSessionCurrent: (identity) => (
        typeof identity.sessionId === "number"
        && isSameDeviceSession(
          connectedDeviceRef.current?.id,
          deviceSessionIdRef.current,
          identity.deviceId,
          identity.sessionId,
        )
      ),
      setBusy,
      transportBarrier: {
        clearPending: () => oximetryRelayRef.current?.clearPending(),
        whenIdle: () => oximetryRelayRef.current?.whenIdle() ?? Promise.resolve(),
      },
    });
  }

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
      if (foregroundBleCoordinatorRef.current?.activeIdentity()) return;
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
  const liveSyncManifestMatchesCurrentBuild = Boolean(
    liveSyncManifest
    && liveSyncManifest.appVersion === appVersion
    && liveSyncManifest.protocol === OZEALIS_PROTOCOL_VERSION,
  );
  const liveSyncEvidenceMatchesConnection = Boolean(
    connectedDevice
    && liveSyncFreshRowCount > 0
    && liveSyncManifest
    && liveSyncManifestMatchesCurrentBuild
    && liveSyncManifest.deviceId === connectedDevice.id
    && liveSyncManifest.appSessionId === deviceSessionIdRef.current,
  );
  const liveSyncModeEligible = telemetry.mode === "1" || telemetry.mode === "2";
  const liveSyncAnalysisEligible =
    canUseDevice
    && protocolCompatible
    && liveSyncEvidenceMatchesConnection
    && liveSyncFreshRowCount >= LIVE_EVIDENCE_MIN_FRESH_ROWS
    && liveSyncSessionActive
    && liveSyncModeEligible;
  const analysisSelection = useMemo(
    () => selectSessionAnalysisCsv(liveSyncCsv, visibleLogCsv, liveSyncAnalysisEligible),
    [liveSyncCsv, visibleLogCsv, liveSyncAnalysisEligible],
  );
  const analysisCsv = analysisSelection.csv;
  const analysisKind = analysisSelection.kind;
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
  const sessionAnalysis = useMemo(() => analyzeSessionCsv(visibleAnalysisCsv), [visibleAnalysisCsv]);
  const sessionObservations = sessionAnalysis.observations;
  const defaultComparisonCurrent = sessionArchiveRecords.find(
    (current) =>
      sessionArchiveRecords.some(
        (candidate) =>
          candidate.record.entry.archiveId !== current.record.entry.archiveId
          && candidate.record.entry.owner.fingerprint
            === current.record.entry.owner.fingerprint,
      ),
  ) || null;
  const requestedComparisonCurrent = sessionArchiveRecords.find(
    (stored) =>
      stored.record.entry.archiveId === comparisonCurrentArchiveId
      && sessionArchiveRecords.some(
        (candidate) =>
          candidate.record.entry.archiveId !== stored.record.entry.archiveId
          && candidate.record.entry.owner.fingerprint
            === stored.record.entry.owner.fingerprint,
      ),
  ) || null;
  const selectedComparisonCurrent =
    requestedComparisonCurrent || defaultComparisonCurrent;
  const defaultComparisonBaseline = selectedComparisonCurrent
    ? sessionArchiveRecords.find(
        (stored) =>
          stored.record.entry.archiveId !== selectedComparisonCurrent.record.entry.archiveId
          && stored.record.entry.owner.fingerprint
            === selectedComparisonCurrent.record.entry.owner.fingerprint,
      ) || null
    : null;
  const selectedComparisonBaseline = selectedComparisonCurrent
    ? sessionArchiveRecords.find(
        (stored) =>
          stored.record.entry.archiveId === comparisonBaselineArchiveId
          && stored.record.entry.archiveId
            !== selectedComparisonCurrent.record.entry.archiveId
          && stored.record.entry.owner.fingerprint
            === selectedComparisonCurrent.record.entry.owner.fingerprint,
      ) || defaultComparisonBaseline
    : null;
  const sessionArchiveComparison: SessionComparisonV1 | null =
    selectedComparisonCurrent && selectedComparisonBaseline
      ? compareSessionArchiveRecords(
          selectedComparisonBaseline.record,
          selectedComparisonCurrent.record,
        )
      : null;
  const visibleArchivedSessions = showAllArchivedSessions
    ? sessionArchiveRecords
    : sessionArchiveRecords.slice(0, 5);
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
    void enqueueSessionArchiveMutation(restoreSessionArchive);
    if (blePreviewMode) {
      setBleState("Unsupported" as State);
      setMessage("Previewing the app layout.");
      return () => {
        invalidateDeviceSessionLifecycle();
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
        const oximeterTransition = oximeterTransitionRef.current;
        const oximeterResetSessionId =
          oximeterTransition?.sessionId
          ?? (oximeterDeviceRef.current ? oximeterSessionIdRef.current : null);
        if (oximeterResetSessionId !== null) {
          resetOximeterSessionState(oximeterResetSessionId);
        }
        if (oximeterTransitionRef.current === oximeterTransition) {
          oximeterTransitionRef.current = null;
          setOximeterTransitionBusy(false);
        }
        const connectionTransition = connectionTransitionTokenRef.current;
        const transitionSessionId = connectionTransition?.identity.sessionId;
        const foregroundSessionId = foregroundBleCoordinatorRef.current?.activeIdentity()?.sessionId;
        const resetSessionId =
          typeof transitionSessionId === "number"
            ? transitionSessionId
            : typeof foregroundSessionId === "number"
              ? foregroundSessionId
              : connectedDeviceRef.current
                ? deviceSessionIdRef.current
                : null;
        if (resetSessionId !== null) {
          cleanupSubscriptions();
          if (resetDeviceSessionState(resetSessionId)) flushLiveSyncCsv();
        } else {
          foregroundBleCoordinatorRef.current?.invalidateAll();
        }
        if (connectionTransitionTokenRef.current === connectionTransition) {
          connectionTransitionTokenRef.current = null;
          setConnectionTransitionBusy(false);
        }
        if (state !== "Unknown") setMessage(advancedModeRef.current ? `Bluetooth ${state}. Turn Bluetooth on before scanning.` : "Turn Bluetooth on to pair.");
      }
    }, true);

    return () => {
      const activeDevice = connectedDeviceRef.current;
      const activeOximeter = oximeterDeviceRef.current;
      invalidateDeviceSessionLifecycle();
      stateSub.remove();
      cleanupSubscriptions();
      cleanupOximeterSubscriptions();
      clearAutoImportRetry();
      oximeterSessionIdRef.current += 1;
      oximetryRelayRef.current?.clearPending();
      stopScan();
      stopOximeterScan();
      if (managerRef.current === manager) managerRef.current = null;
      flushLiveSyncCsv();
      const closeManager = () => {
        manager.destroy();
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
      void sendControlCommand("prewarmStart", () => {
        setPrewarmSchedule((current) => markPrewarmScheduleRun(current, now));
      });
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
    if (connectionTransitionTokenRef.current || oximeterTransitionRef.current) return;
    const manager = managerRef.current;
    if (!manager || blePreviewMode) {
      setMessage(advancedMode ? "Bluetooth scanning is available only in the Android or iOS app." : "Pairing is available in the phone app.");
      return;
    }
    if (scanAdmissionRef.current?.kind === "ozealis") return;
    const previousScanStop =
      scanAdmissionRef.current?.kind === "oximeter"
        ? stopOximeterScan()
        : Promise.resolve();
    const admission = { kind: "ozealis" as const };
    scanAdmissionRef.current = admission;
    setScanning(true);
    let scanStarted = false;
    try {
      await previousScanStop;
      if (
        scanAdmissionRef.current !== admission
        || connectionTransitionTokenRef.current
        || oximeterTransitionRef.current
      ) return;
      const allowed = await requestBlePermissions();
      if (
        scanAdmissionRef.current !== admission
        || connectionTransitionTokenRef.current
        || oximeterTransitionRef.current
      ) return;
      if (!allowed) {
        setMessage(advancedMode ? "Bluetooth permission is required to scan." : "Allow Bluetooth to pair.");
        return;
      }
      const liveBleState = await manager.state();
      if (
        scanAdmissionRef.current !== admission
        || connectionTransitionTokenRef.current
        || oximeterTransitionRef.current
      ) return;
      if (liveBleState !== "PoweredOn") {
        setMessage(advancedMode ? "Turn Bluetooth on before scanning." : "Turn Bluetooth on to pair.");
        return;
      }
      if (
        scanAdmissionRef.current !== admission
        || connectionTransitionTokenRef.current
        || oximeterTransitionRef.current
      ) return;

      setDevices([]);
      await manager.startDeviceScan([OZEALIS_SERVICE_UUID], { allowDuplicates: false }, (error, device) => {
        if (scanAdmissionRef.current !== admission) return;
        if (error) {
          setMessage(actionErrorMessage(error, "Could not scan. Try again.", "Scan failed."));
          stopScan();
          return;
        }
        if (
          !device
          || !isOzealisDevice(device)
          || !(device.serviceUUIDs || []).some((uuid) => uuid.toLowerCase() === OZEALIS_SERVICE_UUID)
        ) return;
        setDevices((current) => {
          if (current.some((item) => item.id === device.id)) return current;
          return [...current, device];
        });
      });
      if (
        scanAdmissionRef.current !== admission
        || connectionTransitionTokenRef.current
        || oximeterTransitionRef.current
      ) {
        if (scanAdmissionRef.current === admission) {
          void manager.stopDeviceScan().catch(() => undefined);
        }
        return;
      }
      scanStarted = true;
      scanTimeoutRef.current = setTimeout(() => {
        if (scanAdmissionRef.current === admission) stopScan();
      }, 12000);
    } catch (error) {
      if (scanAdmissionRef.current === admission) {
        setMessage(actionErrorMessage(error, "Could not scan. Try again.", "Scan failed."));
      }
    } finally {
      if (!scanStarted && scanAdmissionRef.current === admission) {
        scanAdmissionRef.current = null;
        setScanning(false);
        void manager.stopDeviceScan().catch(() => undefined);
      }
    }
  }

  async function connect(device: Device) {
    if (connectionTransitionTokenRef.current) return;
    const sessionId = deviceSessionIdRef.current + 1;
    deviceSessionIdRef.current = sessionId;
    foregroundBleCoordinatorRef.current!.invalidateAll();
    connectedDeviceRef.current = null;
    const transition = reserveConnectionTransition("connection:connect", device, sessionId);
    if (!transition) return;
    protocolVersionRef.current = "unknown";
    setSettingsReadbackValid(false);
    cleanupSubscriptions();
    liveSyncFreshRowsRef.current = 0;
    setLiveSyncFreshRowCount(0);
    setLiveSyncSessionActive(false);
    setMessage("Connecting...");
    let discovered: Device | null = null;
    let connectedForCleanup: Device | null = null;
    try {
      stopScan();
      stopOximeterScan();
      setDevices([]);
      await oximetryRelayRef.current?.whenIdle();
      if (!isConnectionTransitionCurrent(transition)) return;
      const connected = await device.connect({ timeout: 12000 });
      connectedForCleanup = connected;
      if (!isConnectionTransitionCurrent(transition)) {
        await cancelConnectionCandidateUnlessReplaced(connected.id, sessionId);
        return;
      }
      let mtuReady = connected;
      if (Platform.OS === "android") {
        mtuReady = await connected.requestMTU(517).catch(() => connected);
        connectedForCleanup = mtuReady;
        if (!isConnectionTransitionCurrent(transition)) {
          await cancelConnectionCandidateUnlessReplaced(mtuReady.id, sessionId);
          return;
        }
      }
      discovered = await mtuReady.discoverAllServicesAndCharacteristics();
      if (!isConnectionTransitionCurrent(transition)) {
        await cancelConnectionCandidateUnlessReplaced(discovered.id, sessionId);
        return;
      }
      connectedDeviceRef.current = discovered;
      previousModeRef.current = EMPTY_TELEMETRY.mode;
      const nextProtocol = await loadProtocol(discovered, sessionId, transition);
      if (!isForegroundBleLeaseCurrent(transition)) {
        await cancelConnectionCandidateUnlessReplaced(discovered.id, sessionId);
        return;
      }
      await loadSettings(discovered, sessionId, transition);
      if (!isForegroundBleLeaseCurrent(transition)) {
        await cancelConnectionCandidateUnlessReplaced(discovered.id, sessionId);
        return;
      }
      await loadDriverParams(discovered, sessionId, transition);
      if (!isForegroundBleLeaseCurrent(transition)) {
        await cancelConnectionCandidateUnlessReplaced(discovered.id, sessionId);
        return;
      }
      subscribeTelemetry(discovered, sessionId);
      if (!isForegroundBleLeaseCurrent(transition)) {
        await cancelConnectionCandidateUnlessReplaced(discovered.id, sessionId);
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
      if (connectedForCleanup) {
        await cancelConnectionCandidateUnlessReplaced(connectedForCleanup.id, sessionId);
      }
      if (!isConnectionTransitionCurrent(transition)) return;
      cleanupSubscriptions();
      if (resetDeviceSessionState(sessionId)) {
        setMessage(actionErrorMessage(error, "Could not connect. Try pairing again.", "Connection failed."));
      }
    } finally {
      releaseConnectionTransition(transition);
    }
  }

  async function startOximeterScan() {
    if (oximeterTransitionRef.current || connectionTransitionTokenRef.current) return;
    const manager = managerRef.current;
    if (!manager || blePreviewMode) {
      setMessage(advancedMode ? "Bluetooth oximetry is available only in the Android or iOS app." : "Oximeter pairing is available in the phone app.");
      return;
    }
    if (scanAdmissionRef.current?.kind === "oximeter") return;
    const previousScanStop =
      scanAdmissionRef.current?.kind === "ozealis"
        ? stopScan()
        : Promise.resolve();
    const admission = { kind: "oximeter" as const };
    scanAdmissionRef.current = admission;
    setOximeterScanning(true);
    let scanStarted = false;
    try {
      await previousScanStop;
      if (
        scanAdmissionRef.current !== admission
        || oximeterTransitionRef.current
        || connectionTransitionTokenRef.current
      ) return;
      const allowed = await requestBlePermissions();
      if (
        scanAdmissionRef.current !== admission
        || oximeterTransitionRef.current
        || connectionTransitionTokenRef.current
      ) return;
      if (!allowed) {
        setMessage(advancedMode ? "Bluetooth permission is required to scan for an oximeter." : "Allow Bluetooth to pair an oximeter.");
        return;
      }
      const liveBleState = await manager.state();
      if (
        scanAdmissionRef.current !== admission
        || oximeterTransitionRef.current
        || connectionTransitionTokenRef.current
      ) return;
      if (liveBleState !== "PoweredOn") {
        setMessage(advancedMode ? "Turn Bluetooth on before scanning for an oximeter." : "Turn Bluetooth on to pair an oximeter.");
        return;
      }
      if (
        scanAdmissionRef.current !== admission
        || oximeterTransitionRef.current
        || connectionTransitionTokenRef.current
      ) return;

      setScanning(false);
      setMessage(advancedMode ? "Scanning for a Bluetooth Pulse Oximeter Service device..." : "Looking for an oximeter...");
      await manager.startDeviceScan([PLX_SERVICE_UUID], { allowDuplicates: false }, (error, device) => {
        if (scanAdmissionRef.current !== admission) return;
        if (error) {
          setMessage(actionErrorMessage(error, "Could not find an oximeter. Try again.", "Oximeter scan failed."));
          stopOximeterScan();
          return;
        }
        if (
          !device
          || !(device.serviceUUIDs || []).some((uuid) => uuid.toLowerCase() === PLX_SERVICE_UUID)
        ) return;
        void connectOximeter(device);
      });
      if (
        scanAdmissionRef.current !== admission
        || oximeterTransitionRef.current
        || connectionTransitionTokenRef.current
      ) {
        if (scanAdmissionRef.current === admission) {
          void manager.stopDeviceScan().catch(() => undefined);
        }
        return;
      }
      scanStarted = true;
      oximeterScanTimeoutRef.current = setTimeout(() => {
        if (scanAdmissionRef.current !== admission) return;
        stopOximeterScan();
        setMessage(advancedMode ? "No standard Bluetooth pulse oximeter found." : "No oximeter found.");
      }, 12000);
    } catch (error) {
      if (scanAdmissionRef.current === admission) {
        setMessage(actionErrorMessage(error, "Could not find an oximeter. Try again.", "Oximeter scan failed."));
      }
    } finally {
      if (!scanStarted && scanAdmissionRef.current === admission) {
        scanAdmissionRef.current = null;
        setOximeterScanning(false);
        void manager.stopDeviceScan().catch(() => undefined);
      }
    }
  }

  async function connectOximeter(device: Device) {
    const manager = managerRef.current;
    if (!manager || oximeterTransitionRef.current || connectionTransitionTokenRef.current) return;
    const sessionId = oximeterSessionIdRef.current + 1;
    oximeterSessionIdRef.current = sessionId;
    const transition = { operation: "connect" as const, deviceId: device.id, sessionId };
    oximeterTransitionRef.current = transition;
    setOximeterTransitionBusy(true);
    try {
      void stopOximeterScan();
      cleanupOximeterSubscriptions();
      oximetryRelayRef.current?.clearPending();
      const previousOximeter = oximeterDeviceRef.current;
      oximeterDeviceRef.current = null;
      setOximeterDevice(null);
      setOximetrySample(null);
      if (previousOximeter) {
        await manager.cancelDeviceConnection(previousOximeter.id).catch(() => undefined);
      }
      if (
        oximeterSessionIdRef.current !== sessionId
        || oximeterTransitionRef.current !== transition
      ) return;
      const connected = await device.connect({ timeout: 12000 });
      if (
        oximeterSessionIdRef.current !== sessionId
        || oximeterTransitionRef.current !== transition
      ) {
        await cancelOximeterCandidateUnlessReplaced(manager, connected.id, sessionId);
        return;
      }
      const discovered = await connected.discoverAllServicesAndCharacteristics();
      if (
        oximeterSessionIdRef.current !== sessionId
        || oximeterTransitionRef.current !== transition
      ) {
        await cancelOximeterCandidateUnlessReplaced(manager, discovered.id, sessionId);
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
      if (
        oximeterSessionIdRef.current !== sessionId
        || oximeterTransitionRef.current !== transition
      ) return;
      await cancelOximeterCandidateUnlessReplaced(manager, device.id, sessionId);
      cleanupOximeterSubscriptions();
      resetOximeterSessionState(sessionId);
      setMessage(actionErrorMessage(error, "Could not connect the oximeter.", "Oximeter connection failed."));
    } finally {
      if (oximeterTransitionRef.current === transition) {
        oximeterTransitionRef.current = null;
        setOximeterTransitionBusy(false);
      }
    }
  }

  async function disconnectOximeter() {
    if (oximeterTransitionRef.current || connectionTransitionTokenRef.current) return;
    const device = oximeterDeviceRef.current;
    if (!device) return;
    const sessionId = oximeterSessionIdRef.current;
    const transition = {
      operation: "disconnect" as const,
      deviceId: device.id,
      sessionId,
    };
    oximeterTransitionRef.current = transition;
    setOximeterTransitionBusy(true);
    try {
      void stopOximeterScan();
      cleanupOximeterSubscriptions();
      if (!resetOximeterSessionState(sessionId)) return;
      await managerRef.current?.cancelDeviceConnection(device.id).catch(() => undefined);
      if (oximeterTransitionRef.current === transition) setMessage("Oximeter disconnected.");
    } finally {
      if (oximeterTransitionRef.current === transition) {
        oximeterTransitionRef.current = null;
        setOximeterTransitionBusy(false);
      }
    }
  }

  async function disconnect() {
    if (connectionTransitionTokenRef.current) return;
    const disconnectDevice = connectedDeviceRef.current;
    if (!disconnectDevice) return;
    const sessionId = deviceSessionIdRef.current;
    if (!isCurrentDeviceSession(disconnectDevice, sessionId)) return;
    const deviceId = disconnectDevice.id;
    foregroundBleCoordinatorRef.current!.invalidateSession(deviceId, sessionId);
    const transition = reserveConnectionTransition("connection:disconnect", disconnectDevice, sessionId);
    if (!transition) return;
    void stopScan();
    void stopOximeterScan();
    connectedDeviceRef.current = null;
    cleanupSubscriptions();
    protocolVersionRef.current = "unknown";
    let disconnectError: unknown = null;
    let sessionReset = false;
    let ownsCompletion = false;
    try {
      await managerRef.current?.cancelDeviceConnection(deviceId);
    } catch (error) {
      disconnectError = error;
    } finally {
      ownsCompletion = connectionTransitionTokenRef.current === transition.token;
      if (ownsCompletion) {
        sessionReset = resetDeviceSessionState(sessionId);
        if (sessionReset) flushLiveSyncCsv();
      }
      releaseConnectionTransition(transition);
    }
    if (!ownsCompletion || !sessionReset) return;
    setMessage(disconnectError ? actionErrorMessage(disconnectError, "Disconnected.", "Disconnected locally; BLE close reported an error.") : "Disconnected.");
  }

  function resetDeviceSessionState(expectedSessionId = deviceSessionIdRef.current): boolean {
    const nextSessionId = advanceSessionGeneration(deviceSessionIdRef.current, expectedSessionId);
    if (nextSessionId === null) return false;
    foregroundBleCoordinatorRef.current!.invalidateAll();
    deviceSessionIdRef.current = nextSessionId;
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
    liveSyncFreshRowsRef.current = 0;
    setLiveSyncFreshRowCount(0);
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

  async function cancelConnectionCandidateUnlessReplaced(
    candidateDeviceId: string,
    ownerSessionId: number,
  ): Promise<void> {
    const activeTransition = connectionTransitionTokenRef.current?.identity;
    const replacementOwnsDevice =
      activeTransition?.deviceId === candidateDeviceId
      && activeTransition.sessionId !== ownerSessionId;
    const replacementCommittedDevice =
      connectedDeviceRef.current?.id === candidateDeviceId
      && deviceSessionIdRef.current !== ownerSessionId;
    if (replacementOwnsDevice || replacementCommittedDevice) return;
    await managerRef.current?.cancelDeviceConnection(candidateDeviceId).catch(() => undefined);
  }

  async function cancelOximeterCandidateUnlessReplaced(
    manager: BleManager,
    candidateDeviceId: string,
    ownerSessionId: number,
  ): Promise<void> {
    const activeTransition = oximeterTransitionRef.current;
    const replacementOwnsDevice =
      activeTransition?.deviceId === candidateDeviceId
      && activeTransition.sessionId !== ownerSessionId;
    const replacementCommittedDevice =
      oximeterDeviceRef.current?.id === candidateDeviceId
      && oximeterSessionIdRef.current !== ownerSessionId;
    if (replacementOwnsDevice || replacementCommittedDevice) return;
    await manager.cancelDeviceConnection(candidateDeviceId).catch(() => undefined);
  }

  function resetOximeterSessionState(expectedSessionId = oximeterSessionIdRef.current): boolean {
    const nextSessionId = advanceSessionGeneration(oximeterSessionIdRef.current, expectedSessionId);
    if (nextSessionId === null) return false;
    oximeterSessionIdRef.current = nextSessionId;
    void stopOximeterScan();
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

  function stopScan(updateState = true): Promise<void> {
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    const ownsAdmission = scanAdmissionRef.current?.kind === "ozealis";
    if (ownsAdmission) scanAdmissionRef.current = null;
    if (updateState) setScanning(false);
    if (!ownsAdmission || !managerRef.current) return Promise.resolve();
    return managerRef.current.stopDeviceScan().catch(() => undefined);
  }

  function stopOximeterScan(updateState = true): Promise<void> {
    if (oximeterScanTimeoutRef.current) {
      clearTimeout(oximeterScanTimeoutRef.current);
      oximeterScanTimeoutRef.current = null;
    }
    const ownsAdmission = scanAdmissionRef.current?.kind === "oximeter";
    if (ownsAdmission) scanAdmissionRef.current = null;
    if (updateState) setOximeterScanning(false);
    if (!ownsAdmission || !managerRef.current) return Promise.resolve();
    return managerRef.current.stopDeviceScan().catch(() => undefined);
  }

  function isCurrentDeviceSession(device: Device | null, sessionId: number) {
    return isSameDeviceSession(
      connectedDeviceRef.current?.id,
      deviceSessionIdRef.current,
      device?.id,
      sessionId,
    );
  }

  function invalidateDeviceSessionLifecycle(): void {
    foregroundBleCoordinatorRef.current?.invalidateAll();
    connectedDeviceRef.current = null;
    connectionTransitionTokenRef.current = null;
    const nextSessionId = advanceSessionGeneration(
      deviceSessionIdRef.current,
      deviceSessionIdRef.current,
    );
    if (nextSessionId !== null) deviceSessionIdRef.current = nextSessionId;
  }

  function acquireForegroundBleLease(
    operation: ForegroundBleOperation,
    device = connectedDevice,
    sessionId = deviceSessionIdRef.current,
  ): ForegroundBleLease | null {
    if (!device || connectionTransitionTokenRef.current) return null;
    const token = foregroundBleCoordinatorRef.current!.acquire({
      deviceId: device.id,
      sessionId,
      operation,
    });
    if (!token) return null;
    return { device, sessionId, operation, token };
  }

  function reserveConnectionTransition(
    operation: "connection:connect" | "connection:disconnect",
    device: Device,
    sessionId: number,
  ): ForegroundBleLease | null {
    if (connectionTransitionTokenRef.current) return null;
    const token = foregroundBleCoordinatorRef.current!.reserve({
      deviceId: device.id,
      sessionId,
      operation,
    });
    if (!token) return null;
    connectionTransitionTokenRef.current = token;
    setConnectionTransitionBusy(true);
    return { device, sessionId, operation, token };
  }

  function isConnectionTransitionCurrent(lease: ForegroundBleLease): boolean {
    return (
      connectionTransitionTokenRef.current === lease.token
      && deviceSessionIdRef.current === lease.sessionId
      && foregroundBleCoordinatorRef.current!.isValid(lease.token)
    );
  }

  function releaseConnectionTransition(lease: ForegroundBleLease): boolean {
    const ownsTransition = connectionTransitionTokenRef.current === lease.token;
    if (ownsTransition) {
      connectionTransitionTokenRef.current = null;
      setConnectionTransitionBusy(false);
    }
    const generationCurrent = deviceSessionIdRef.current === lease.sessionId;
    return foregroundBleCoordinatorRef.current!.release(
      lease.token,
      ownsTransition && generationCurrent,
    );
  }

  function isForegroundBleLeaseCurrent(lease: ForegroundBleLease): boolean {
    return foregroundBleCoordinatorRef.current!.isCurrent(lease.token);
  }

  function releaseForegroundBleLease(lease: ForegroundBleLease): boolean {
    return foregroundBleCoordinatorRef.current!.release(lease.token);
  }

  async function waitForForegroundBleTransport(lease: ForegroundBleLease): Promise<boolean> {
    return foregroundBleCoordinatorRef.current!.waitForTransport(lease.token);
  }

  function isDeviceSessionWorkCurrent(
    device: Device,
    sessionId: number,
    lease: ForegroundBleLease,
  ): boolean {
    return (
      lease.device.id === device.id &&
      lease.sessionId === sessionId &&
      isForegroundBleLeaseCurrent(lease)
    );
  }

  async function loadSettings(
    device: Device,
    sessionId: number,
    lease: ForegroundBleLease,
  ) {
    if (isDeviceSessionWorkCurrent(device, sessionId, lease)) setSettingsReadbackValid(false);
    const raw = await readUtf8(device, OZEALIS_CHARACTERISTICS.settings);
    if (!isDeviceSessionWorkCurrent(device, sessionId, lease)) return;
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
    const lease = acquireForegroundBleLease("settings:read", readDevice, sessionId);
    if (!lease) return;
    try {
      if (!(await waitForForegroundBleTransport(lease))) return;
      await loadSettings(readDevice, sessionId, lease);
      if (!isForegroundBleLeaseCurrent(lease)) return;
      setMessage(advancedModeRef.current ? "Settings loaded from device." : "Comfort updated.");
    } catch (error) {
      if (!isForegroundBleLeaseCurrent(lease)) return;
      setMessage(actionErrorMessage(error, "Could not update comfort.", "Could not read settings."));
    } finally {
      releaseForegroundBleLease(lease);
    }
  }

  async function loadProtocol(
    device: Device,
    sessionId: number,
    lease: ForegroundBleLease,
  ): Promise<string> {
    try {
      const raw = await readUtf8(device, OZEALIS_CHARACTERISTICS.protocol);
      const next = raw || "unknown";
      if (!isDeviceSessionWorkCurrent(device, sessionId, lease)) return "unknown";
      protocolVersionRef.current = next;
      setProtocolVersion(next);
      return next;
    } catch {
      if (!isDeviceSessionWorkCurrent(device, sessionId, lease)) return "unknown";
      protocolVersionRef.current = "unknown";
      setProtocolVersion("unknown");
      return "unknown";
    }
  }

  async function loadDriverParams(
    device: Device,
    sessionId: number,
    lease: ForegroundBleLease,
  ) {
    try {
      const params = await readUtf8(device, OZEALIS_CHARACTERISTICS.mcfParams);
      if (!isDeviceSessionWorkCurrent(device, sessionId, lease)) return "";
      setDriverParamsJson(params);
      return params;
    } catch (error) {
      if (!isDeviceSessionWorkCurrent(device, sessionId, lease)) return "";
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

  async function confirmProtocolBeforeWrite(
    messageText: ModeAwareMessage,
    lease: ForegroundBleLease,
  ) {
    if (!isForegroundBleLeaseCurrent(lease)) return false;
    if (!(await waitForForegroundBleTransport(lease))) return false;
    const nextProtocol = await loadProtocol(lease.device, lease.sessionId, lease);
    if (!isForegroundBleLeaseCurrent(lease)) return false;
    if (nextProtocol === OZEALIS_PROTOCOL_VERSION) return true;
    Alert.alert(advancedModeRef.current ? "Protocol mismatch" : "Update app or firmware", modeAwareMessage(messageText));
    return false;
  }

  async function confirmDriverSnapshotBeforeMotorAction(
    messageText: ModeAwareMessage,
    lease: ForegroundBleLease,
  ) {
    if (!isForegroundBleLeaseCurrent(lease)) return false;
    try {
      const raw = await loadDriverParams(lease.device, lease.sessionId, lease);
      if (!isForegroundBleLeaseCurrent(lease)) return false;
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
      if (!isForegroundBleLeaseCurrent(lease)) return false;
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
    const writeDevice = connectedDevice;
    const sessionId = deviceSessionIdRef.current;
    const lease = acquireForegroundBleLease("settings:write", writeDevice, sessionId);
    if (!lease) return;
    try {
      if (!isForegroundBleLeaseCurrent(lease)) return;
      if (
        !(await confirmProtocolBeforeWrite({
          advanced: "Writes require the expected Ozealis BLE protocol version.",
          simple: "This app and device do not match. Update the app or firmware, then try again.",
        }, lease))
      ) {
        return;
      }
      if (
        !(await confirmIdleNoCalibrationBeforeWrite(
          {
            advanced: "Settings writes require a fresh idle, no-fault, no-calibration readback before changing pressure settings.",
            simple: "Stop airflow or setup, then try again.",
          },
          lease,
        ))
      ) {
        return;
      }
      if (!isForegroundBleLeaseCurrent(lease)) return;
      setSettingsReadbackValid(false);
      await writeUtf8(writeDevice, OZEALIS_CHARACTERISTICS.settings, serializeSettings(safe));
      if (!isForegroundBleLeaseCurrent(lease)) return;
      const settingsReadback = await readUtf8(writeDevice, OZEALIS_CHARACTERISTICS.settings);
      if (!isForegroundBleLeaseCurrent(lease)) return;
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
      if (!isForegroundBleLeaseCurrent(lease)) return;
      setSettingsReadbackValid(false);
      setMessage(actionErrorMessage(error, "Comfort did not save. Try again from standby.", "Settings write failed."));
    } finally {
      releaseForegroundBleLease(lease);
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
      captureLiveCsv(device, sessionId, value);
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
    liveSyncLifecycleRef.current += 1;
    liveSyncRowsRef.current = [];
    liveSyncPendingRowsRef.current = [];
    liveSyncLastMsRef.current = 0;
    liveSyncLastUiMsRef.current = 0;
    liveSyncOwnerRef.current = null;
    liveSyncManifestRef.current = null;
    liveReportSnapshotRef.current = null;
    liveSyncCreatedAtMsRef.current = 0;
    liveSyncProtocolRef.current = "";
    liveSyncFreshRowsRef.current = 0;
    liveSyncRestoredRef.current = false;
    setLiveSyncSessionActive(false);
    setLiveSyncCsv("");
    setLiveSyncRowCount(0);
    setLiveSyncFreshRowCount(0);
    setLiveSyncManifest(null);
    writeLiveSyncSpool([]);
  }

  function flushLiveSyncCsv() {
    const rows = liveSyncRowsRef.current;
    setLiveSyncCsv(formatLiveSyncCsv(rows));
    setLiveSyncRowCount(rows.length);
    updateLiveSyncManifest(rows);
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

  function enqueueSessionArchiveMutation<T>(operation: () => Promise<T>): Promise<T> {
    const run = sessionArchiveMutationQueueRef.current
      .catch(() => undefined)
      .then(operation);
    sessionArchiveMutationQueueRef.current = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  function publishSessionArchiveRecords(records: StoredSessionArchiveRecord[]): number {
    const storedByArchiveId = new Map<string, StoredSessionArchiveRecord>();
    for (const stored of records) {
      const existing = storedByArchiveId.get(stored.record.entry.archiveId);
      if (
        !existing
        || stored.record.entry.archivedAtMs < existing.record.entry.archivedAtMs
        || (
          stored.record.entry.archivedAtMs === existing.record.entry.archivedAtMs
          && stored.fileName.localeCompare(existing.fileName) < 0
        )
      ) {
        storedByArchiveId.set(stored.record.entry.archiveId, stored);
      }
    }
    const sortedRecords = sortSessionArchiveRecords(
      [...storedByArchiveId.values()].map((stored) => stored.record),
    );
    const overflowCount = Math.max(0, sortedRecords.length - SESSION_ARCHIVE_MAX_ENTRIES);
    const allRecords = sortedRecords.map(
      (record) => storedByArchiveId.get(record.entry.archiveId) as StoredSessionArchiveRecord,
    );
    sessionArchiveRecordsRef.current = allRecords;
    setSessionArchiveRecords(allRecords.slice(0, SESSION_ARCHIVE_MAX_ENTRIES));
    return overflowCount;
  }

  async function restoreSessionArchive(): Promise<boolean> {
    if (sessionArchiveReadyRef.current) return true;
    if (Platform.OS === "web") {
      publishSessionArchiveRecords([]);
      setSessionArchiveIssueCount(0);
      sessionArchivePendingFilesRef.current = [];
      sessionArchiveStoredBytesRef.current = 0;
      setSessionArchivePendingCount(0);
      setSessionArchiveStorageError(false);
      sessionArchiveReadyRef.current = true;
      return true;
    }
    let issueCount = 0;
    const restored: StoredSessionArchiveRecord[] = [];
    try {
      const directory = new Directory(Paths.document, sessionArchiveDirectoryName);
      if (!directory.exists) {
        publishSessionArchiveRecords([]);
        setSessionArchiveIssueCount(0);
        sessionArchivePendingFilesRef.current = [];
        sessionArchiveStoredBytesRef.current = 0;
        setSessionArchivePendingCount(0);
        setSessionArchiveStorageError(false);
        sessionArchiveReadyRef.current = true;
        return true;
      }
      const listedFiles = directory
        .list()
        .filter((candidate): candidate is File => candidate instanceof File);
      const committedFiles = listedFiles
        .filter((file) => sessionArchiveFileNamePattern.test(file.name))
        .sort((left, right) => left.name.localeCompare(right.name));
      const pendingFiles = listedFiles
        .filter((file) => sessionArchivePendingFileNamePattern.test(file.name))
        .sort((left, right) => left.name.localeCompare(right.name));
      sessionArchivePendingFilesRef.current = pendingFiles.map((file) => ({
        fileName: file.name,
        byteCount: Number.isSafeInteger(file.size) ? Math.max(0, file.size) : 0,
      }));
      setSessionArchivePendingCount(pendingFiles.length);
      if (committedFiles.length + pendingFiles.length > sessionArchiveMaxRestoreFiles) {
        throw new Error("The archive contains too many files to verify safely.");
      }

      let observedBytes = 0;
      for (const file of [...committedFiles, ...pendingFiles]) {
        if (Number.isSafeInteger(file.size) && file.size > 0) {
          observedBytes = Math.min(Number.MAX_SAFE_INTEGER, observedBytes + file.size);
        }
      }
      if (observedBytes > SESSION_ARCHIVE_MAX_TOTAL_BYTES) {
        throw new Error("The archive exceeds the bounded restore size.");
      }
      sessionArchiveStoredBytesRef.current = observedBytes;

      for (const file of committedFiles) {
        const byteCount = file.size;
        if (
          !Number.isSafeInteger(byteCount)
          || byteCount <= 0
          || byteCount > SESSION_ARCHIVE_MAX_ENTRY_BYTES
        ) {
          issueCount += 1;
          continue;
        }
        try {
          const record = await verifySessionArchiveEntryV1(
            await file.text(),
            digestSha256Text,
          );
          if (record) {
            restored.push({ fileName: file.name, byteCount, record });
          } else {
            issueCount += 1;
          }
        } catch {
          issueCount += 1;
        }
      }

      const unresolvedPending: PendingSessionArchiveFile[] = [];
      const committedNames = new Set(committedFiles.map((file) => file.name));
      const committedArchiveIds = new Set(
        restored.map(({ record }) => record.entry.archiveId),
      );
      for (const pendingFile of pendingFiles) {
        const pendingName = pendingFile.name;
        const pendingByteCount = pendingFile.size;
        if (
          !Number.isSafeInteger(pendingByteCount)
          || pendingByteCount <= 0
          || pendingByteCount > SESSION_ARCHIVE_MAX_ENTRY_BYTES
        ) {
          issueCount += 1;
          unresolvedPending.push({
            fileName: pendingName,
            byteCount: Math.max(0, Number.isFinite(pendingByteCount) ? pendingByteCount : 0),
          });
          continue;
        }
        const finalName = pendingName.replace(/\.pending$/, ".json");
        const finalFile = new File(directory, finalName);
        if (committedNames.has(finalName) || finalFile.exists) {
          issueCount += 1;
          unresolvedPending.push({ fileName: pendingName, byteCount: pendingByteCount });
          continue;
        }
        try {
          const stagedRecord = await verifySessionArchiveEntryV1(
            await pendingFile.text(),
            digestSha256Text,
          );
          if (!stagedRecord) {
            issueCount += 1;
            unresolvedPending.push({ fileName: pendingName, byteCount: pendingByteCount });
            continue;
          }
          if (committedArchiveIds.has(stagedRecord.entry.archiveId)) {
            issueCount += 1;
            unresolvedPending.push({ fileName: pendingName, byteCount: pendingByteCount });
            continue;
          }
          await pendingFile.move(finalFile);
          const recoveredRecord = await verifySessionArchiveEntryV1(
            await finalFile.text(),
            digestSha256Text,
          );
          if (!recoveredRecord || recoveredRecord.entry.archiveId !== stagedRecord.entry.archiveId) {
            throw new Error("Recovered archive entry failed final validation.");
          }
          committedNames.add(finalName);
          committedArchiveIds.add(recoveredRecord.entry.archiveId);
          restored.push({
            fileName: finalName,
            byteCount: pendingByteCount,
            record: recoveredRecord,
          });
        } catch (error) {
          issueCount += 1;
          const originalPendingFile = new File(directory, pendingName);
          if (originalPendingFile.exists) {
            unresolvedPending.push({ fileName: pendingName, byteCount: pendingByteCount });
          } else if (finalFile.exists) {
            throw error;
          }
        }
      }
      sessionArchivePendingFilesRef.current = unresolvedPending;
      setSessionArchivePendingCount(unresolvedPending.length);
      const uniqueCount = new Set(
        restored.map(({ record }) => record.entry.archiveId),
      ).size;
      issueCount += restored.length - uniqueCount;
      issueCount += publishSessionArchiveRecords(restored);
      setSessionArchiveIssueCount(issueCount);
      setSessionArchiveStorageError(false);
      sessionArchiveReadyRef.current = true;
      return true;
    } catch {
      setSessionArchiveIssueCount(Math.max(1, issueCount));
      setSessionArchiveStorageError(true);
      sessionArchiveReadyRef.current = false;
      return false;
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
    const restoreLifecycle = liveSyncLifecycleRef.current;
    try {
      const file = new File(Paths.document, liveSyncSpoolFileName);
      const manifestFile = new File(Paths.document, liveSyncManifestFileName);
      if (!file.exists && !manifestFile.exists) {
        liveSyncSpoolReadyRef.current = true;
        return;
      }
      if (!file.exists || !manifestFile.exists) {
        throw new Error("Live evidence is missing its CSV or commit marker.");
      }
      const restored = await file.text();
      const lines = liveSyncSpoolLines(restored);
      const snapshot = restoreLiveEvidenceSnapshot(
        restored,
        await manifestFile.text(),
        liveSyncCsvHeader,
        maxLiveSyncRows,
        isCurrentLiveSyncRow,
      );
      if (liveSyncLifecycleRef.current !== restoreLifecycle) return;
      if (!lines || !snapshot) throw new Error("Live evidence commit validation failed.");
      const filteredRows = filterIncreasingLiveSyncRows(snapshot.rows);
      if (!rowsMatch(filteredRows, snapshot.rows)) {
        throw new Error("Live evidence contains a discontinuous or inactive sample sequence.");
      }
      const rows = snapshot.rows;
      liveSyncRowsRef.current = rows;
      liveSyncPendingRowsRef.current = [];
      liveSyncLastMsRef.current = rows.reduce((maxMs, row) => {
        const ms = Number(row.split(",")[0]);
        return Number.isFinite(ms) ? Math.max(maxMs, ms) : maxMs;
      }, 0);
      liveSyncOwnerRef.current = {
        deviceId: snapshot.manifest.deviceId,
        sessionId: snapshot.manifest.appSessionId,
      };
      liveSyncManifestRef.current = snapshot.manifest;
      liveReportSnapshotRef.current = {
        csv: snapshot.csv,
        rows: [...snapshot.rows],
        manifest: snapshot.manifest,
      };
      liveSyncCreatedAtMsRef.current = snapshot.manifest.createdAtMs;
      liveSyncProtocolRef.current = snapshot.manifest.protocol;
      liveSyncFreshRowsRef.current = 0;
      liveSyncRestoredRef.current = true;
      setLiveSyncCsv(snapshot.csv);
      setLiveSyncRowCount(rows.length);
      setLiveSyncFreshRowCount(0);
      setLiveSyncManifest(snapshot.manifest);
      setLiveSyncSessionActive(false);
    } catch {
      if (liveSyncLifecycleRef.current !== restoreLifecycle) return;
      liveSyncRowsRef.current = [];
      liveSyncPendingRowsRef.current = [];
      liveSyncLastMsRef.current = 0;
      liveSyncOwnerRef.current = null;
      liveSyncManifestRef.current = null;
      liveSyncCreatedAtMsRef.current = 0;
      liveReportSnapshotRef.current = null;
      liveSyncProtocolRef.current = "";
      liveSyncFreshRowsRef.current = 0;
      liveSyncRestoredRef.current = false;
      setLiveSyncCsv("");
      setLiveSyncRowCount(0);
      setLiveSyncFreshRowCount(0);
      setLiveSyncManifest(null);
      setLiveSyncSessionActive(false);
      writeLiveSyncSpool([]);
    } finally {
      liveSyncSpoolReadyRef.current = true;
      flushLiveSyncSpool();
    }
  }

  function writeLiveSyncSpool(rows: string[]) {
    if (rows.length === 0) {
      try {
        new File(Paths.document, liveSyncSpoolFileName).write("");
        new File(Paths.document, liveSyncManifestFileName).write("");
      } catch {
        // Emptying stale evidence is best-effort; a stale or partial pair still fails closed on restore.
      }
      return;
    }

    const csv = formatLiveSyncCsv(rows);
    const manifest = updateLiveSyncManifest(rows, csv);
    if (!manifest) return;
    try {
      const file = new File(Paths.document, liveSyncSpoolFileName);
      file.write(csv);
      // The manifest is the commit marker. A partial CSV update cannot validate against an older marker.
      new File(Paths.document, liveSyncManifestFileName).write(serializeLiveEvidenceManifest(manifest));
    } catch {
      // The in-memory live trace still remains exportable if document storage is unavailable.
    }
  }

  function updateLiveSyncManifest(rows: string[], csv = formatLiveSyncCsv(rows)) {
    const owner = liveSyncOwnerRef.current;
    if (!owner || rows.length === 0 || !liveSyncProtocolRef.current) return null;
    const now = Math.max(Date.now(), liveSyncCreatedAtMsRef.current);
    const manifest = buildLiveEvidenceManifest({
      csv,
      rows,
      owner,
      appVersion,
      protocol: liveSyncProtocolRef.current,
      nowMs: now,
      createdAtMs: liveSyncCreatedAtMsRef.current || now,
    });
    if (!manifest) return null;
    liveSyncManifestRef.current = manifest;
    liveReportSnapshotRef.current = {
      csv,
      rows: [...rows],
      manifest,
    };
    setLiveSyncManifest(manifest);
    return manifest;
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
      const manifestFile = new File(Paths.document, liveSyncManifestFileName);
      const csv = formatLiveSyncCsv(liveSyncRowsRef.current);
      const manifest = updateLiveSyncManifest(liveSyncRowsRef.current, csv);
      if (!manifest) return;
      if (!file.exists || liveSyncRowsRef.current.length === pending.length) {
        file.write(csv);
        manifestFile.write(serializeLiveEvidenceManifest(manifest));
        return;
      }
      const storedSnapshot = readValidLiveSyncSpool(file, manifestFile);
      if (
        !storedSnapshot
        || storedSnapshot.manifest.deviceId !== manifest.deviceId
        || storedSnapshot.manifest.appSessionId !== manifest.appSessionId
        || storedSnapshot.manifest.appVersion !== manifest.appVersion
        || storedSnapshot.manifest.protocol !== manifest.protocol
        || storedSnapshot.manifest.createdAtMs !== manifest.createdAtMs
      ) {
        writeLiveSyncSpool(liveSyncRowsRef.current);
        return;
      }
      const storedRows = storedSnapshot.rows;
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
      file.write(`\n${pending.join("\n")}`, { append: true });
      manifestFile.write(serializeLiveEvidenceManifest(manifest));
    } catch {
      // Persistence is best-effort; UI state and manual export continue to work.
    }
  }

  function rowsMatch(left: string[], right: string[]) {
    return left.length === right.length && left.every((row, index) => row === right[index]);
  }

  function readValidLiveSyncSpool(file: File, manifestFile: File) {
    if (!file.exists || !manifestFile.exists) return null;
    const csv = file.textSync();
    const lines = liveSyncSpoolLines(csv);
    if (!lines) return null;
    const snapshot = restoreLiveEvidenceSnapshot(
      csv,
      manifestFile.textSync(),
      liveSyncCsvHeader,
      maxLiveSyncRows,
      isCurrentLiveSyncRow,
    );
    if (!snapshot) return null;
    const filteredRows = filterIncreasingLiveSyncRows(snapshot.rows);
    return rowsMatch(filteredRows, snapshot.rows) ? snapshot : null;
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

  function beginLiveSyncEvidence(device: Device, sessionId: number) {
    if (!isCurrentDeviceSession(device, sessionId)) return false;
    if (
      !liveSyncRestoredRef.current
      && isSameLiveEvidenceOwner(liveSyncOwnerRef.current, device.id, sessionId)
    ) {
      return true;
    }

    const now = Date.now();
    liveSyncLifecycleRef.current += 1;
    liveSyncRowsRef.current = [];
    liveSyncPendingRowsRef.current = [];
    liveSyncLastMsRef.current = 0;
    liveSyncLastUiMsRef.current = 0;
    liveSyncOwnerRef.current = { deviceId: device.id, sessionId };
    liveSyncManifestRef.current = null;
    liveReportSnapshotRef.current = null;
    liveSyncCreatedAtMsRef.current = now;
    liveSyncProtocolRef.current = protocolVersionRef.current;
    liveSyncFreshRowsRef.current = 0;
    liveSyncRestoredRef.current = false;
    setLiveSyncCsv("");
    setLiveSyncRowCount(0);
    setLiveSyncFreshRowCount(0);
    setLiveSyncManifest(null);
    setLiveSyncSessionActive(false);
    return isCurrentDeviceSession(device, sessionId);
  }

  function captureLiveCsv(device: Device, sessionId: number, value: string) {
    if (!isCurrentDeviceSession(device, sessionId)) return;
    const row = value;
    const parts = row.split(",");
    if (!isCurrentLiveSyncRow(row)) return;
    const packetMs = Number(parts[0]);
    const mode = parts[5];
    if (!Number.isFinite(packetMs)) return;
    if (mode !== "1" && mode !== "2") return;
    const incomingOwner = { deviceId: device.id, sessionId };
    const currentDeviceId = connectedDeviceRef.current?.id;
    const sampleAction = decideLiveEvidenceSample({
      currentOwner: currentDeviceId
        ? { deviceId: currentDeviceId, sessionId: deviceSessionIdRef.current }
        : null,
      evidenceOwner: liveSyncOwnerRef.current,
      incomingOwner,
      evidenceRestored: liveSyncRestoredRef.current,
      hasEvidenceRows: liveSyncRowsRef.current.length > 0,
      lastDeviceMs: liveSyncLastMsRef.current,
      incomingDeviceMs: packetMs,
      restartBackstepMs: liveSyncRestartBackstepMs,
      maximumGapMs: liveSyncMaxSampleGapMs,
    });
    if (sampleAction === "reject" || sampleAction === "ignore") return;
    if (sampleAction === "replace") {
      resetLiveSync();
    }
    if (!beginLiveSyncEvidence(device, sessionId)) return;
    if (!isCurrentDeviceSession(device, sessionId)) return;

    liveSyncLastMsRef.current = packetMs;
    const firstLiveSyncRow = liveSyncRowsRef.current.length === 0;
    liveSyncRowsRef.current.push(row);
    liveSyncPendingRowsRef.current.push(row);
    if (liveSyncRowsRef.current.length > maxLiveSyncRows) {
      liveSyncRowsRef.current.splice(0, liveSyncRowsRef.current.length - maxLiveSyncRows);
    }
    setLiveSyncRowCount(liveSyncRowsRef.current.length);
    liveSyncFreshRowsRef.current += 1;
    const freshRows = liveSyncFreshRowsRef.current;
    setLiveSyncFreshRowCount(freshRows);
    if (freshRows === LIVE_EVIDENCE_MIN_FRESH_ROWS) {
      setLiveSyncSessionActive(true);
    }

    const now = Date.now();
    if (
      firstLiveSyncRow
      || freshRows === LIVE_EVIDENCE_MIN_FRESH_ROWS
      || now - liveSyncLastUiMsRef.current >= 1000
    ) {
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
    const lease = acquireForegroundBleLease(
      reason === "manual" ? "logs:read:manual" : "logs:read:auto",
      readDevice,
      sessionId,
    );
    if (!lease) return "unavailable";
    try {
      if (!(await waitForForegroundBleTransport(lease))) return "stale";
      const logs = await readCsvTransfer(
        readDevice,
        OZEALIS_CHARACTERISTICS.logDownload,
        () => isForegroundBleLeaseCurrent(lease),
      );
      if (!isForegroundBleLeaseCurrent(lease)) return "stale";
      const faults = await readCsvTransfer(
        readDevice,
        OZEALIS_CHARACTERISTICS.faultCsv,
        () => isForegroundBleLeaseCurrent(lease),
      );
      if (!isForegroundBleLeaseCurrent(lease)) return "stale";
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
      if (!isForegroundBleLeaseCurrent(lease)) return "stale";
      setMessage(actionErrorMessage(error, "Could not update data.", reason === "auto" ? "Automatic retained-session import failed." : "Could not read logs."));
      return "failed";
    } finally {
      releaseForegroundBleLease(lease);
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
    const lease = acquireForegroundBleLease("logs:clear", writeDevice, sessionId);
    if (!lease) return;
    try {
      if (!(await confirmProtocolBeforeWrite("Log clearing requires the expected Ozealis BLE protocol version.", lease))) return;
      if (
        !(await confirmIdleNoCalibrationBeforeWrite(
          "Log clearing requires a fresh idle, no-fault, no-calibration readback before erasing retained evidence.",
          lease,
        ))
      ) {
        return;
      }
      if (!isForegroundBleLeaseCurrent(lease)) return;
      await writeUtf8(writeDevice, OZEALIS_CHARACTERISTICS.settings, JSON.stringify({ clearLog: 1, clearFaults: 1 }));
      if (!isForegroundBleLeaseCurrent(lease)) return;
      const logs = await readCsvTransfer(
        writeDevice,
        OZEALIS_CHARACTERISTICS.logDownload,
        () => isForegroundBleLeaseCurrent(lease),
      );
      if (!isForegroundBleLeaseCurrent(lease)) return;
      const faults = await readCsvTransfer(
        writeDevice,
        OZEALIS_CHARACTERISTICS.faultCsv,
        () => isForegroundBleLeaseCurrent(lease),
      );
      if (!isForegroundBleLeaseCurrent(lease)) return;
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
      if (!isForegroundBleLeaseCurrent(lease)) return;
      setMessage(actionErrorMessage(error, "Could not clear logs.", "Log clear failed."));
    } finally {
      releaseForegroundBleLease(lease);
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
    const sessionId = deviceSessionIdRef.current;
    const lease = acquireForegroundBleLease("motor-fault:clear", writeDevice, sessionId);
    if (!lease) return;
    try {
      if (!isForegroundBleLeaseCurrent(lease)) return;
      if (!(await confirmProtocolBeforeWrite("Motor fault clearing requires the expected Ozealis BLE protocol version.", lease))) return;
      if (!(await confirmMotorFaultClearAvailableBeforeWrite(lease))) return;
      if (!isForegroundBleLeaseCurrent(lease)) return;
      await writeUtf8(writeDevice, OZEALIS_CHARACTERISTICS.settings, JSON.stringify({ clearMotorFault: 1 }));
      if (!isForegroundBleLeaseCurrent(lease)) return;
      const params = await loadDriverParams(writeDevice, sessionId, lease);
      if (!isForegroundBleLeaseCurrent(lease)) return;
      const modeFault = await refreshModeFaultFromDevice(lease);
      if (!isForegroundBleLeaseCurrent(lease)) return;
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
      if (!isForegroundBleLeaseCurrent(lease)) return;
      setMessage(actionErrorMessage(error, "Could not clear motor driver fault.", "Motor driver fault clear failed."));
    } finally {
      releaseForegroundBleLease(lease);
    }
  }

  async function exportFile(name: string, contents: string, extension: string, mimeType: string) {
    if (!contents.trim()) {
      Alert.alert("Nothing to export", "Read data from the device first.");
      return;
    }
    let stagedFile: File | null = null;
    let removeAfterShare = false;
    try {
      const fileName = `${name}-${new Date().toISOString().replace(/[:.]/g, "-")}.${extension}`;
      const sharingAvailable = await Sharing.isAvailableAsync();
      removeAfterShare = sharingAvailable;
      const file = new File(sharingAvailable ? Paths.cache : Paths.document, fileName);
      stagedFile = file;
      file.write(contents);
      if (sharingAvailable) {
        await Sharing.shareAsync(file.uri, { mimeType });
        setMessage(`Export shared: ${fileName}`);
      } else {
        setMessage(`Saved export: ${fileName}`);
      }
    } catch (error) {
      setMessage(actionErrorMessage(error, "Could not export.", "Export failed."));
    } finally {
      if (removeAfterShare && stagedFile?.exists) {
        try {
          stagedFile.delete();
        } catch {
          // Sharing succeeded; failure to remove the temporary cache copy is non-fatal.
        }
      }
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

  function captureCurrentSessionReportDraft(): SessionReportDraft | null {
    let rawCsv = "";
    let selectedAirflowCsv = "";
    let source: SessionReportInput["source"] | null = null;
    let ownerDeviceId = "";

    if (analysisKind === "live" && liveSyncAnalysisEligible) {
      const snapshot = liveReportSnapshotRef.current;
      if (
        snapshot
        && snapshot.csv === analysisCsv
        && connectedDevice
        && snapshot.manifest.deviceId === connectedDevice.id
        && snapshot.manifest.appSessionId === deviceSessionIdRef.current
        && snapshot.manifest.appVersion === appVersion
        && snapshot.manifest.protocol === OZEALIS_PROTOCOL_VERSION
      ) {
        rawCsv = snapshot.csv;
        selectedAirflowCsv = sessionReportSelectedAirflowCsv(rawCsv) || "";
        ownerDeviceId = snapshot.manifest.deviceId;
        source = {
          kind: "live_app_sync",
          manifest: { ...snapshot.manifest },
        };
      }
    } else if (
      analysisKind === "retained"
      && retainedImport
      && retainedImportMatchesConnection
      && retainedImport.sessionCsv === visibleLogCsv
    ) {
      rawCsv = retainedImport.sessionCsv;
      selectedAirflowCsv = sessionReportSelectedAirflowCsv(rawCsv) || "";
      if (selectedAirflowCsv === analysisCsv) {
        ownerDeviceId = retainedImport.manifest.deviceId;
        source = {
          kind: "retained_firmware",
          manifest: {
            ...retainedImport.manifest,
            session: { ...retainedImport.manifest.session },
            fault: { ...retainedImport.manifest.fault },
          },
          faultCsv: retainedImport.faultCsv,
        };
      }
    }

    if (!source || !ownerDeviceId || !rawCsv || !selectedAirflowCsv) {
      return null;
    }
    return {
      ownerDeviceId,
      input: {
        rawCsv,
        reportingAppVersion: appVersion,
        expectedProtocol: OZEALIS_PROTOCOL_VERSION,
        source,
      },
    };
  }

  async function buildCurrentSessionReportArtifact(): Promise<SessionReportArtifact | null> {
    const draft = captureCurrentSessionReportDraft();
    if (!draft) return null;
    const reportJson = await serializeSessionReportV1(
      draft.input,
      digestSha256Text,
    );
    return reportJson ? { ...draft, reportJson } : null;
  }

  async function exportSessionReport() {
    try {
      const artifact = await buildCurrentSessionReportArtifact();
      if (!artifact) {
        Alert.alert(
          "Report unavailable",
          "The full-resolution evidence and its source manifest are not aligned or failed strict integrity validation. Update the log and try again.",
        );
        return;
      }
      await exportJson("ozealis-session-report-v1", artifact.reportJson);
    } catch (error) {
      setMessage(actionErrorMessage(error, "Could not create the session report.", "Session report export failed."));
    }
  }

  async function saveCurrentSessionCapture() {
    const archivedAtMs = Date.now();
    try {
      const artifact = await buildCurrentSessionReportArtifact();
      if (!artifact) {
        Alert.alert(
          "Capture unavailable",
          "The full-resolution evidence and its source manifest are not aligned or failed strict integrity validation. Update the log and try again.",
        );
        return;
      }
      const record = await createSessionArchiveEntryV1(
        {
          ownerDeviceId: artifact.ownerDeviceId,
          archivedAtMs,
          reportInput: artifact.input,
          reportJson: artifact.reportJson,
        },
        digestSha256Text,
      );
      if (!record) {
        Alert.alert(
          "Capture unavailable",
          "The evidence could not be rebuilt into a self-validating archive entry.",
        );
        return;
      }
      const result = await enqueueSessionArchiveMutation(async () => {
        if (
          !sessionArchiveReadyRef.current
          && !(await restoreSessionArchive())
        ) {
          throw new Error(
            "Saved captures could not be verified from local storage. Saving remains blocked to protect existing evidence.",
          );
        }
        const existing = sessionArchiveRecordsRef.current.find(
          (stored) => stored.record.entry.archiveId === record.entry.archiveId,
        );
        if (existing) return "existing" as const;
        if (sessionArchiveRecordsRef.current.length >= SESSION_ARCHIVE_MAX_ENTRIES) {
          throw new Error(
            `The saved-capture limit (${SESSION_ARCHIVE_MAX_ENTRIES}) has been reached. Delete an older capture before saving another.`,
          );
        }
        const serialized = serializeSessionArchiveEntryV1(record.entry);
        const serializedByteCount = Buffer.byteLength(serialized, "utf8");
        if (
          serializedByteCount <= 0
          || serializedByteCount > SESSION_ARCHIVE_MAX_ENTRY_BYTES
          || sessionArchiveStoredBytesRef.current + serializedByteCount
            > SESSION_ARCHIVE_MAX_TOTAL_BYTES
        ) {
          throw new Error(
            "The saved-capture storage limit has been reached. Delete older or incomplete captures before saving another.",
          );
        }

        const directory = new Directory(Paths.document, sessionArchiveDirectoryName);
        directory.create({ idempotent: true, intermediates: true });
        let pendingFile: File | null = null;
        let finalFile: File | null = null;
        try {
          for (let attempt = 0; attempt < 4; attempt += 1) {
            const storageId = Crypto.randomUUID().toLowerCase();
            const candidatePending = new File(directory, `${storageId}.pending`);
            const candidateFinal = new File(directory, `${storageId}.json`);
            if (!candidatePending.exists && !candidateFinal.exists) {
              pendingFile = candidatePending;
              finalFile = candidateFinal;
              break;
            }
          }
          if (!pendingFile || !finalFile) {
            throw new Error("Could not allocate an opaque archive file name.");
          }

          pendingFile.write(serialized);
          const stagedRecord = await verifySessionArchiveEntryV1(
            await pendingFile.text(),
            digestSha256Text,
          );
          if (!stagedRecord || stagedRecord.entry.archiveId !== record.entry.archiveId) {
            throw new Error("The staged archive entry failed readback validation.");
          }
          await pendingFile.move(finalFile);
          const committedRecord = await verifySessionArchiveEntryV1(
            await finalFile.text(),
            digestSha256Text,
          );
          if (!committedRecord || committedRecord.entry.archiveId !== record.entry.archiveId) {
            throw new Error("The committed archive entry failed readback validation.");
          }
          publishSessionArchiveRecords([
            ...sessionArchiveRecordsRef.current,
            {
              fileName: finalFile.name,
              byteCount: serializedByteCount,
              record: committedRecord,
            },
          ]);
          sessionArchiveStoredBytesRef.current += serializedByteCount;
          return "saved" as const;
        } catch (error) {
          let cleanupFailed = false;
          for (const file of [pendingFile, finalFile]) {
            if (!file?.exists) continue;
            try {
              file.delete();
            } catch {
              cleanupFailed = true;
            }
          }
          if (cleanupFailed) {
            sessionArchiveReadyRef.current = false;
            setSessionArchiveStorageError(true);
            setSessionArchiveIssueCount((current) => current + 1);
          }
          throw error;
        }
      });
      setMessage(
        result === "existing"
          ? "This exact evidence capture is already saved."
          : "Evidence capture saved and verified.",
      );
    } catch (error) {
      setMessage(
        actionErrorMessage(
          error,
          "Could not save this evidence capture.",
          "Session archive save failed.",
        ),
      );
    }
  }

  async function exportArchivedReport(stored: StoredSessionArchiveRecord) {
    await exportJson("ozealis-archived-session-report-v1", stored.record.entry.report.json);
  }

  async function exportArchivedRawEvidence(stored: StoredSessionArchiveRecord) {
    const sourceName = stored.record.entry.reportInput.source.kind === "live_app_sync"
      ? "ozealis-archived-live-10hz"
      : "ozealis-archived-retained-session";
    await exportCsv(sourceName, stored.record.entry.evidence.rawCsv);
  }

  function confirmDeleteArchivedSession(stored: StoredSessionArchiveRecord) {
    Alert.alert(
      "Delete saved capture?",
      "This removes the locally saved evidence bundle. Export anything you need first.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void enqueueSessionArchiveMutation(async () => {
              const current = sessionArchiveRecordsRef.current.find(
                (candidate) =>
                  candidate.fileName === stored.fileName
                  && candidate.record.entry.archiveId === stored.record.entry.archiveId,
              );
              if (!current || !sessionArchiveFileNamePattern.test(current.fileName)) return;
              try {
                const directory = new Directory(Paths.document, sessionArchiveDirectoryName);
                const files = directory
                  .list()
                  .filter(
                    (candidate): candidate is File =>
                      candidate instanceof File
                      && sessionArchiveFileNamePattern.test(candidate.name),
                  );
                if (files.length > sessionArchiveMaxRestoreFiles) {
                  throw new Error("The archive changed and now contains too many files.");
                }
                const listedBytes = files.reduce(
                  (total, file) =>
                    Number.isSafeInteger(file.size) && file.size > 0
                      ? Math.min(Number.MAX_SAFE_INTEGER, total + file.size)
                      : total,
                  0,
                );
                if (listedBytes > SESSION_ARCHIVE_MAX_TOTAL_BYTES) {
                  throw new Error("The archive changed and now exceeds the bounded size.");
                }
                const targetFile = files.find((file) => file.name === current.fileName);
                if (!targetFile) {
                  throw new Error("The saved capture file was not found.");
                }
                const orderedFiles = [
                  targetFile,
                  ...files.filter((file) => file.name !== current.fileName),
                ];
                let removedBytes = 0;
                let removedCount = 0;
                for (const file of orderedFiles) {
                  const isTarget = file.name === current.fileName;
                  const byteCount = file.size;
                  if (
                    !Number.isSafeInteger(byteCount)
                    || byteCount <= 0
                    || byteCount > SESSION_ARCHIVE_MAX_ENTRY_BYTES
                  ) {
                    if (isTarget) {
                      throw new Error("The selected archive file changed after restore.");
                    }
                    continue;
                  }
                  let verified: VerifiedSessionArchiveRecordV1 | null = null;
                  try {
                    verified = await verifySessionArchiveEntryV1(
                      await file.text(),
                      digestSha256Text,
                    );
                  } catch {
                    if (isTarget) {
                      throw new Error("The selected archive file could not be reverified.");
                    }
                  }
                  const sameContent =
                    verified?.entry.archiveId === current.record.entry.archiveId;
                  if (!sameContent) {
                    if (isTarget) {
                      throw new Error("The selected archive file changed after restore.");
                    }
                    continue;
                  }
                  if (file.exists) file.delete();
                  if (file.exists) throw new Error("An archive content copy is still present.");
                  removedBytes += byteCount;
                  removedCount += 1;
                }
                sessionArchiveStoredBytesRef.current = Math.max(
                  0,
                  sessionArchiveStoredBytesRef.current - removedBytes,
                );
                const hadOverflow =
                  sessionArchiveRecordsRef.current.length > SESSION_ARCHIVE_MAX_ENTRIES;
                const overflowCount = publishSessionArchiveRecords(
                  sessionArchiveRecordsRef.current.filter(
                    (candidate) =>
                      candidate.fileName !== current.fileName
                      || candidate.record.entry.archiveId
                        !== current.record.entry.archiveId,
                  ),
                );
                if (hadOverflow || removedCount > 1) {
                  const resolvedIssueCount =
                    (hadOverflow ? 1 : 0) + Math.max(0, removedCount - 1);
                  setSessionArchiveIssueCount((count) =>
                    Math.max(
                      sessionArchivePendingFilesRef.current.length + overflowCount,
                      count - resolvedIssueCount,
                    ));
                }
                if (comparisonBaselineArchiveId === current.record.entry.archiveId) {
                  setComparisonBaselineArchiveId("");
                }
                if (comparisonCurrentArchiveId === current.record.entry.archiveId) {
                  setComparisonCurrentArchiveId("");
                  setComparisonBaselineArchiveId("");
                }
                setMessage("Saved evidence capture deleted.");
              } catch (error) {
                sessionArchiveReadyRef.current = false;
                setSessionArchiveStorageError(true);
                setMessage(
                  actionErrorMessage(
                    error,
                    "Could not delete the saved capture.",
                    "Session archive delete failed.",
                  ),
                );
              }
            });
          },
        },
      ],
    );
  }

  function confirmDeleteIncompleteArchiveFiles() {
    const pendingCount = sessionArchivePendingFilesRef.current.length;
    if (pendingCount === 0) return;
    Alert.alert(
      "Remove incomplete saves?",
      "These staged files never became verified saved captures. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove incomplete saves",
          style: "destructive",
          onPress: () => {
            void enqueueSessionArchiveMutation(async () => {
              if (
                !sessionArchiveReadyRef.current
                && sessionArchivePendingFilesRef.current.length === 0
                && !(await restoreSessionArchive())
              ) {
                setMessage("Incomplete saves could not be checked because archive storage is unavailable.");
                return;
              }
              const directory = new Directory(Paths.document, sessionArchiveDirectoryName);
              const remaining: PendingSessionArchiveFile[] = [];
              let removedCount = 0;
              for (const pending of sessionArchivePendingFilesRef.current) {
                if (!sessionArchivePendingFileNamePattern.test(pending.fileName)) {
                  remaining.push(pending);
                  continue;
                }
                try {
                  const file = new File(directory, pending.fileName);
                  if (file.exists) file.delete();
                  if (file.exists) throw new Error("The incomplete file is still present.");
                  removedCount += 1;
                } catch {
                  remaining.push(pending);
                }
              }
              sessionArchivePendingFilesRef.current = remaining;
              setSessionArchivePendingCount(remaining.length);
              sessionArchiveReadyRef.current = false;
              const restored = await restoreSessionArchive();
              if (!restored) {
                setMessage(
                  removedCount > 0
                    ? "Incomplete saves were removed, but archive storage still could not be fully verified."
                    : "Incomplete saves could not be removed or archive storage is still unavailable.",
                );
                return;
              }
              const remainingCount = sessionArchivePendingFilesRef.current.length;
              setMessage(
                remainingCount === 0
                  ? "Incomplete archive saves removed."
                  : `${remainingCount} incomplete archive ${remainingCount === 1 ? "file remains" : "files remain"}.`,
              );
            });
          },
        },
      ],
    );
  }

  async function exportJson(name: string, contents: string) {
    await exportFile(name, contents, "json", "application/json");
  }

  /*
   * Archive entries are read-only evidence. Opening, comparing, exporting, or
   * deleting one never replaces the active BLE source or changes write gates.
   */

  async function readDriverParams() {
    if (!connectedDevice) return;
    const readDevice = connectedDevice;
    const sessionId = deviceSessionIdRef.current;
    const lease = acquireForegroundBleLease("driver:read", readDevice, sessionId);
    if (!lease) return;
    try {
      if (!(await waitForForegroundBleTransport(lease))) return;
      await loadDriverParams(readDevice, sessionId, lease);
      if (!isForegroundBleLeaseCurrent(lease)) return;
      setMessage("MCF8316D parameter snapshot loaded.");
    } catch (error) {
      if (!isForegroundBleLeaseCurrent(lease)) return;
      setMessage(actionErrorMessage(error, "Could not update device details.", "Could not read MCF8316D parameters."));
    } finally {
      releaseForegroundBleLease(lease);
    }
  }

  async function refreshModeFaultFromDevice(lease: ForegroundBleLease) {
    if (!isForegroundBleLeaseCurrent(lease)) return { mode: "--", fault: "--" };
    const [mode, fault] = await Promise.all([
      readUtf8(lease.device, OZEALIS_CHARACTERISTICS.mode),
      readUtf8(lease.device, OZEALIS_CHARACTERISTICS.fault),
    ]);
    if (!isForegroundBleLeaseCurrent(lease)) return { mode: "--", fault: "--" };
    const nextMode = parseSystemMode(mode || "");
    const nextFault = parseFaultCode(fault || "");
    setTelemetry((current) => ({ ...current, mode: nextMode, fault: nextFault, updatedAt: Date.now() }));
    return { mode: nextMode, fault: nextFault };
  }

  async function confirmIdleNoCalibrationBeforeWrite(
    messageText: ModeAwareMessage,
    lease: ForegroundBleLease,
  ) {
    if (!isForegroundBleLeaseCurrent(lease)) return false;
    const [mode, fault, calibrationStatus] = await Promise.all([
      readUtf8(lease.device, OZEALIS_CHARACTERISTICS.mode),
      readUtf8(lease.device, OZEALIS_CHARACTERISTICS.fault),
      readUtf8(lease.device, OZEALIS_CHARACTERISTICS.calibrationStatus),
    ]);
    if (!isForegroundBleLeaseCurrent(lease)) return false;
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
    Alert.alert(advancedModeRef.current ? "Write unavailable" : "Use standby", modeAwareMessage(messageText));
    return false;
  }

  async function confirmMotorFaultClearAvailableBeforeWrite(lease: ForegroundBleLease) {
    if (!isForegroundBleLeaseCurrent(lease)) return false;
    const [mode, fault, calibrationStatus] = await Promise.all([
      readUtf8(lease.device, OZEALIS_CHARACTERISTICS.mode),
      readUtf8(lease.device, OZEALIS_CHARACTERISTICS.fault),
      readUtf8(lease.device, OZEALIS_CHARACTERISTICS.calibrationStatus),
    ]);
    if (!isForegroundBleLeaseCurrent(lease)) return false;
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

  async function confirmCalibrationCommandAvailableBeforeWrite(
    command: "capture" | "abort",
    lease: ForegroundBleLease,
  ) {
    if (!isForegroundBleLeaseCurrent(lease)) return null;
    const statusJson = await readUtf8(lease.device, OZEALIS_CHARACTERISTICS.calibrationStatus);
    if (!isForegroundBleLeaseCurrent(lease)) return null;
    const nextCalibration = parseCalibrationStatus(statusJson || "{}");
    setTelemetry((current) => ({ ...current, calibrationStatus: statusJson || "{}", updatedAt: Date.now() }));
    if (command === "capture" && nextCalibration.active && nextCalibration.mode === "water") return nextCalibration;
    if (command === "abort" && nextCalibration.active) return nextCalibration;
    Alert.alert(
      advancedModeRef.current ? (command === "capture" ? "Capture unavailable" : "Abort unavailable") : command === "capture" ? "Wait for the mark" : "Nothing to stop",
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
    const writeDevice = connectedDevice;
    const sessionId = deviceSessionIdRef.current;
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
    const payload: OtaCommandPayload = {
      ssid: otaSsid,
      password: otaPassword,
      url: otaUrl,
    };
    const clearCapturedPassword = () => {
      if (isCurrentDeviceSession(writeDevice, sessionId)) setOtaPassword("");
    };
    Alert.alert(
      "Send OTA command?",
      "Only continue with a firmware binary you built and verified. This OTA path does not verify project-owned signatures or pinned certificates.",
      [
        { text: "Cancel", style: "cancel", onPress: clearCapturedPassword },
        {
          text: "Send OTA",
          style: "destructive",
          onPress: () => void writeOtaCommand(writeDevice, sessionId, payload),
        },
      ],
      { cancelable: true, onDismiss: clearCapturedPassword },
    );
  }

  async function writeOtaCommand(
    writeDevice: Device,
    sessionId: number,
    payload: OtaCommandPayload,
  ) {
    if (!isCurrentDeviceSession(writeDevice, sessionId)) return;
    const clearCapturedPassword = () => {
      if (isCurrentDeviceSession(writeDevice, sessionId)) setOtaPassword("");
    };
    if (writeGuardsRef.current.busy) {
      clearCapturedPassword();
      return;
    }
    if (!writeGuardsRef.current.protocolCompatible) {
      clearCapturedPassword();
      Alert.alert("Protocol mismatch", "OTA writes require the expected Ozealis BLE protocol version.");
      return;
    }
    if (writeGuardsRef.current.otaInProgress || !writeGuardsRef.current.otaAllowed) {
      clearCapturedPassword();
      if (writeGuardsRef.current.otaInProgress) {
        Alert.alert("OTA already running", "Wait for OTA status to report OK or ERR before sending another firmware URL.");
        return;
      }
      Alert.alert("OTA requires idle", "Stop airflow, clear active faults, and wait for calibration to finish or abort before sending OTA.");
      return;
    }
    const nextSsid = payload.ssid.trim();
    const nextUrl = payload.url;
    if (!nextSsid || !payload.password.trim() || !nextUrl) {
      clearCapturedPassword();
      Alert.alert("OTA fields required", "Enter SSID, password, and a firmware URL.");
      return;
    }
    if (!isSupportedOtaUrl(nextUrl)) {
      clearCapturedPassword();
      Alert.alert("Unsupported firmware URL", "Use an http:// or https:// firmware URL.");
      return;
    }
    const lease = acquireForegroundBleLease("ota:write", writeDevice, sessionId);
    if (!lease) {
      clearCapturedPassword();
      return;
    }
    try {
      if (!(await confirmProtocolBeforeWrite("OTA writes require the expected Ozealis BLE protocol version.", lease))) return;
      if (
        !(await confirmIdleNoCalibrationBeforeWrite(
          "OTA requires a fresh idle, no-fault, no-calibration readback before sending a firmware URL.",
          lease,
        ))
      ) {
        return;
      }
      const freshOtaStatus = parseOtaStatus(await readUtf8(writeDevice, OZEALIS_CHARACTERISTICS.otaStatus));
      if (!isForegroundBleLeaseCurrent(lease)) return;
      setTelemetry((current) => ({ ...current, otaStatus: freshOtaStatus, updatedAt: Date.now() }));
      if (isOtaStatusInProgress(freshOtaStatus)) {
        Alert.alert("OTA already running", "Wait for OTA status to report OK or ERR before sending another firmware URL.");
        return;
      }
      if (!isForegroundBleLeaseCurrent(lease)) return;
      await writeUtf8(
        writeDevice,
        OZEALIS_CHARACTERISTICS.otaCommand,
        JSON.stringify({ ssid: nextSsid, pwd: payload.password, url: nextUrl }),
      );
      if (!isForegroundBleLeaseCurrent(lease)) return;
      const status = parseOtaStatus(await readUtf8(writeDevice, OZEALIS_CHARACTERISTICS.otaStatus));
      if (!isForegroundBleLeaseCurrent(lease)) return;
      setTelemetry((current) => ({ ...current, otaStatus: status, updatedAt: Date.now() }));
      setMessage(
        status === "ERR"
          ? "OTA command returned ERR. Check URL, Wi-Fi, idle state, and serial logs before retrying."
          : isOtaStatusInProgress(status) || status === "OK"
            ? `OTA command accepted; status readback is ${status}. Watch OTA status before power cycling.`
            : `OTA command not verified; status readback is ${status}. Check idle state and serial logs before retrying.`,
      );
    } catch {
      if (!isForegroundBleLeaseCurrent(lease)) return;
      setMessage("OTA command failed. Check URL, Wi-Fi, idle state, and serial logs before retrying.");
    } finally {
      if (isForegroundBleLeaseCurrent(lease)) setOtaPassword("");
      releaseForegroundBleLease(lease);
    }
  }

  async function sendControlCommand(
    command: ControlCommand,
    beforeDispatch?: () => void,
  ) {
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
    const writeDevice = connectedDevice;
    const sessionId = deviceSessionIdRef.current;
    const lease = acquireForegroundBleLease(`control:${command}`, writeDevice, sessionId);
    if (!lease) return;
    try {
      if (!isForegroundBleLeaseCurrent(lease)) return;
      if (
        !(await confirmProtocolBeforeWrite({
          advanced: "Control commands require the expected Ozealis BLE protocol version.",
          simple: "This app and device do not match. Update the app or firmware, then try again.",
        }, lease))
      ) {
        return;
      }
      if (
        (command === "start" || command === "prewarmStart") &&
        !(await confirmIdleNoCalibrationBeforeWrite({
          advanced: command === "prewarmStart" ? "Prewarm requires a fresh idle, no-fault, no-calibration readback." : "Start requires a fresh idle, no-fault, no-calibration readback before commanding airflow.",
          simple: command === "prewarmStart" ? "Use standby to prewarm." : "Use standby to start airflow.",
        }, lease))
      ) {
        return;
      }
      if (
        command === "start" &&
        !(await confirmDriverSnapshotBeforeMotorAction({
          advanced:
            "Start requires a fresh MCF8316D snapshot with I2C present, an explicit clear driver fault-latch reading, and verified I2C speed-command readback or an explicit bench PWM fallback build.",
          simple: "Use standby to start airflow.",
        }, lease))
      ) {
        return;
      }
      if (!isForegroundBleLeaseCurrent(lease)) return;
      beforeDispatch?.();
      await writeUtf8(writeDevice, OZEALIS_CHARACTERISTICS.control, JSON.stringify({ command }));
      if (!isForegroundBleLeaseCurrent(lease)) return;
      const readback = await refreshModeFaultFromDevice(lease);
      if (!isForegroundBleLeaseCurrent(lease)) return;
      let moduleStatusReadback = telemetry.moduleStatus;
      if (command === "prewarmStart" || command === "prewarmStop") {
        moduleStatusReadback = parseModuleStatus(await readUtf8(writeDevice, OZEALIS_CHARACTERISTICS.moduleStatus));
        if (!isForegroundBleLeaseCurrent(lease)) return;
        setTelemetry((current) => ({ ...current, moduleStatus: moduleStatusReadback, updatedAt: Date.now() }));
      }
      setMessage(controlCommandReadbackMessage(command, readback.mode, readback.fault, moduleStatusReadback));
    } catch (error) {
      if (!isForegroundBleLeaseCurrent(lease)) return;
      setMessage(actionErrorMessage(error, command === "start" ? "Use standby to start airflow." : command === "prewarmStart" ? "Use standby to prewarm." : "Stop from the device if needed.", `Could not send ${command} command.`));
    } finally {
      releaseForegroundBleLease(lease);
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

  async function sendCalibrationCommand(command: CalibrationCommand) {
    if (!connectedDevice) return;
    const writeDevice = connectedDevice;
    const sessionId = deviceSessionIdRef.current;
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
          {
            text: "Start",
            onPress: () => void writeCalibrationCommand("waterStart", writeDevice, sessionId),
          },
        ],
      );
      return;
    }
    await writeCalibrationCommand(command, writeDevice, sessionId);
  }

  function setWaterSetupCheck(key: WaterSetupKey, value: boolean) {
    setWaterSetupChecks((current) => ({ ...current, [key]: value }));
  }

  async function writeCalibrationCommand(
    command: CalibrationCommand,
    writeDevice: Device,
    sessionId: number,
  ) {
    if (!isCurrentDeviceSession(writeDevice, sessionId)) return;
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
    const lease = acquireForegroundBleLease(`calibration:${command}`, writeDevice, sessionId);
    if (!lease) return;
    try {
      if (
        (command === "start" || command === "waterStart" || command === "capture" || command === "abort") &&
        !(await confirmProtocolBeforeWrite(
          advancedMode
            ? "Calibration requires the expected Ozealis BLE protocol version."
            : "This app and device do not match. Update the app or firmware, then try again.",
          lease,
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
          lease,
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
          lease,
        ))
      ) {
        return;
      }
      if (command === "capture" || command === "abort") {
        const freshBefore = await confirmCalibrationCommandAvailableBeforeWrite(command, lease);
        if (!freshBefore) return;
        before = freshBefore;
      }
      if (!isForegroundBleLeaseCurrent(lease)) return;
      await writeUtf8(writeDevice, OZEALIS_CHARACTERISTICS.calibrationCommand, JSON.stringify(payload));
      if (!isForegroundBleLeaseCurrent(lease)) return;
      const statusJson = await readUtf8(writeDevice, OZEALIS_CHARACTERISTICS.calibrationStatus);
      if (!isForegroundBleLeaseCurrent(lease)) return;
      setTelemetry((current) => ({ ...current, calibrationStatus: statusJson || "{}", updatedAt: Date.now() }));
      setMessage(calibrationCommandReadbackMessage(command, before, parseCalibrationStatus(statusJson)));
    } catch (error) {
      if (!isForegroundBleLeaseCurrent(lease)) return;
      setMessage(actionErrorMessage(error, "Use standby to start setup.", "Calibration command failed."));
    } finally {
      releaseForegroundBleLease(lease);
    }
  }

  function calibrationCommandReadbackMessage(
    command: CalibrationCommand,
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
          <IconButton icon="bluetooth" label="Scan" onPress={startScan} disabled={scanning || connectionTransitionBusy || oximeterTransitionBusy || busy} />
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
                    <ActionButton icon="bluetooth" label="Pair device" onPress={startScan} disabled={scanning || connectionTransitionBusy || oximeterTransitionBusy || busy} fill />
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
                      disabled={oximeterScanning || oximeterTransitionBusy || connectionTransitionBusy || busy}
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
                    disabled={oximeterScanning || oximeterTransitionBusy || connectionTransitionBusy || busy}
                    secondary
                  />
                  <ActionButton
                    icon="close"
                    label="Disconnect oximeter"
                    onPress={disconnectOximeter}
                    disabled={!oximeterDevice || oximeterTransitionBusy || connectionTransitionBusy || busy}
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
                <ValueRow label="Exportable live rows" value={liveSyncRows > 0 ? String(liveSyncRows) : "--"} />
                <ValueRow
                  label="Current-session live rows"
                  value={liveSyncFreshRowCount > 0 ? String(liveSyncFreshRowCount) : "--"}
                />
                <ValueRow label="Live synced window" value={liveSyncCsv ? formatDuration(liveSyncSummary.durationSec) : "--"} />
                <ValueRow
                  label="Live evidence source"
                  value={
                    liveSyncManifest
                      ? liveSyncEvidenceMatchesConnection
                        ? `${liveSyncManifest.deviceId} / app session ${liveSyncManifest.appSessionId}`
                        : `${liveSyncManifest.deviceId} / stored export only`
                      : "--"
                  }
                />
                <ValueRow
                  label="Live analysis state"
                  value={
                    liveSyncAnalysisEligible
                      ? "Current source admitted"
                      : liveSyncFreshRowCount > 0 && !protocolCompatible
                        ? "Protocol mismatch; export only"
                      : liveSyncFreshRowCount > 0 && liveSyncManifest && !liveSyncManifestMatchesCurrentBuild
                        ? "Evidence metadata mismatch; export only"
                      : liveSyncFreshRowCount > 0 && !liveSyncModeEligible
                        ? "Airflow inactive; export only"
                      : liveSyncFreshRowCount > 0
                        ? `Collecting fresh rows (${liveSyncFreshRowCount}/${LIVE_EVIDENCE_MIN_FRESH_ROWS})`
                        : liveSyncRows > 0
                          ? "Stored export only"
                          : "--"
                  }
                />
                <ValueRow label="Retained evidence rows" value={visibleLogCsv ? String(sessionRows) : "--"} />
                <ValueRow label="Airflow-run window" value={visibleLogCsv ? formatDuration(sessionSummary.durationSec) : "--"} />
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
                  Connected app sessions keep the latest 60 minutes of identity-bound live CSV at up to 10 Hz. Ten fresh rows from the exact current connection are required before that source is admitted. A disconnected or restored trace remains exportable but is never attributed to a replacement connection.
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
                <PotentialObservations
                  observations={sessionObservations}
                  status={sessionAnalysis.status}
                  evidenceBasis={sessionAnalysis.evidenceBasis}
                  advanced={advancedMode}
                />
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
                  icon="archive"
                  label="Save current evidence capture"
                  onPress={saveCurrentSessionCapture}
                  disabled={!analysisCsv.trim()}
                />
                <ActionButton
                  icon="share"
                  label="Export session report JSON"
                  onPress={exportSessionReport}
                  disabled={!analysisCsv.trim()}
                  secondary
                />
                <Text style={styles.mutedText}>
                  The report summarizes full-resolution evidence and byte fingerprints without exporting the BLE device identity. Raw CSV remains a separate export.
                </Text>
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
                <Text style={styles.subhead}>Saved evidence captures</Text>
                <ValueRow
                  label="Validated captures"
                  value={sessionArchiveRecords.length > 0 ? String(sessionArchiveRecords.length) : "--"}
                />
                {sessionArchiveStorageError && (
                  <Text style={styles.mutedText}>
                    Saved captures could not be fully verified from local storage. New saves stay blocked until a complete restore succeeds; existing files are not deleted.
                  </Text>
                )}
                {sessionArchiveIssueCount > 0 && (
                  <Text style={styles.mutedText}>
                    {sessionArchiveIssueCount} local archive {sessionArchiveIssueCount === 1 ? "file was" : "files were"} not admitted because validation, deduplication, recovery, or capacity checks did not pass.
                  </Text>
                )}
                {sessionArchivePendingCount > 0 && (
                  <>
                    <Text style={styles.mutedText}>
                      {sessionArchivePendingCount} interrupted staged {sessionArchivePendingCount === 1 ? "save remains" : "saves remain"}. Valid staged evidence is recovered automatically; the remaining files are not treated as saved captures.
                    </Text>
                    <View style={styles.archiveActions}>
                      <ArchiveAction
                        label="Remove incomplete saves"
                        onPress={confirmDeleteIncompleteArchiveFiles}
                        destructive
                      />
                    </View>
                  </>
                )}
                <Text style={styles.mutedText}>
                  Saved captures retain exact raw evidence for later verification. Save time is an app clock anchor, not synchronized device time. Entries remain unauthenticated experimental evidence and may be included in platform backups.
                </Text>
                {sessionArchiveRecords.length === 0 && (
                  <Text style={styles.mutedText}>No evidence captures have been saved on this app installation.</Text>
                )}
                {visibleArchivedSessions.map((stored) => {
                  const record = stored.record;
                  const hasSameOwnerPeer = sessionArchiveRecords.some(
                    (candidate) =>
                      candidate.record.entry.archiveId !== record.entry.archiveId
                      && candidate.record.entry.owner.fingerprint
                      === record.entry.owner.fingerprint
                  );
                  const selectedAsCurrent =
                    selectedComparisonCurrent?.record.entry.archiveId
                    === record.entry.archiveId;
                  const canUseAsBaseline =
                    !selectedAsCurrent
                    && selectedComparisonCurrent?.record.entry.owner.fingerprint
                      === record.entry.owner.fingerprint;
                  const selectedForComparison =
                    selectedComparisonBaseline?.record.entry.archiveId
                    === record.entry.archiveId;
                  return (
                    <View key={record.entry.archiveId} style={styles.archiveRow}>
                      <Text style={styles.archiveTitle}>
                        Saved {new Date(record.entry.archivedAtMs).toLocaleString()}
                      </Text>
                      <Text style={styles.archiveDetail}>
                        {archiveSourceLabel(record)} · {formatDuration(record.report.evidence.creditedDurationMs / 1_000)} · {record.report.evidence.selectedRows} selected rows
                      </Text>
                      <View style={styles.archiveActions}>
                        {hasSameOwnerPeer && (
                          <ArchiveAction
                            label={selectedAsCurrent ? "Comparison current" : "Use as current"}
                            onPress={() => {
                              setComparisonCurrentArchiveId(record.entry.archiveId);
                              setComparisonBaselineArchiveId("");
                            }}
                            active={selectedAsCurrent}
                          />
                        )}
                        {canUseAsBaseline && (
                          <ArchiveAction
                            label={selectedForComparison ? "Comparison baseline" : "Use as baseline"}
                            onPress={() => setComparisonBaselineArchiveId(record.entry.archiveId)}
                            active={selectedForComparison}
                          />
                        )}
                        <ArchiveAction label="Report" onPress={() => exportArchivedReport(stored)} />
                        <ArchiveAction label="Raw CSV" onPress={() => exportArchivedRawEvidence(stored)} />
                        {record.entry.evidence.faultCsv !== null && (
                          <ArchiveAction
                            label="Fault CSV"
                            onPress={() => exportCsv(
                              "ozealis-archived-retained-faults",
                              record.entry.evidence.faultCsv || "",
                            )}
                          />
                        )}
                        <ArchiveAction
                          label="Delete"
                          onPress={() => confirmDeleteArchivedSession(stored)}
                          destructive
                        />
                      </View>
                    </View>
                  );
                })}
                {sessionArchiveRecords.length > 5 && (
                  <ActionButton
                    icon={showAllArchivedSessions ? "chevron-up" : "chevron-down"}
                    label={
                      showAllArchivedSessions
                        ? "Show latest 5 captures"
                        : `Show all ${sessionArchiveRecords.length} captures`
                    }
                    onPress={() => setShowAllArchivedSessions((current) => !current)}
                    secondary
                  />
                )}
                <Text style={styles.subhead}>Saved comparison</Text>
                {sessionArchiveComparison && selectedComparisonBaseline && selectedComparisonCurrent ? (
                  <>
                    <ValueRow
                      label="Comparison state"
                      value={
                        sessionArchiveComparison.status === "comparable"
                          ? "Comparable evidence windows"
                          : sessionArchiveComparison.status === "limited"
                            ? "Limited comparison"
                            : "Comparison unavailable"
                      }
                    />
                    <Text style={styles.mutedText}>
                      Baseline saved {new Date(selectedComparisonBaseline.record.entry.archivedAtMs).toLocaleString()}; current saved {new Date(selectedComparisonCurrent.record.entry.archivedAtMs).toLocaleString()}.
                    </Text>
                    {sessionArchiveComparison.metrics.map((metric) => (
                      <ValueRow
                        key={metric.code}
                        label={metric.label}
                        value={formatSessionComparisonMetric(metric)}
                      />
                    ))}
                    <Text style={styles.mutedText}>{sessionArchiveComparison.evidenceBasis}</Text>
                    {sessionArchiveComparison.reasonCodes.length > 0 && (
                      <Text style={styles.archiveLimitation}>
                        Reasons: {sessionArchiveComparison.reasonCodes
                          .map(sessionComparisonReasonLabel)
                          .join("; ")}.
                      </Text>
                    )}
                    {sessionArchiveComparison.limitations.map((limitation) => (
                      <Text key={limitation} style={styles.archiveLimitation}>• {limitation}</Text>
                    ))}
                  </>
                ) : (
                  <Text style={styles.mutedText}>
                    Save two different evidence captures from the same local Ozealis to compare factual values.
                  </Text>
                )}
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
                <ActionButton icon="bluetooth" label="Pair device" onPress={startScan} disabled={scanning || connectionTransitionBusy || oximeterTransitionBusy || busy} secondary />
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

function ArchiveAction({
  label,
  onPress,
  active,
  destructive,
}: {
  label: string;
  onPress: () => void;
  active?: boolean;
  destructive?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      style={[
        styles.archiveAction,
        active && styles.archiveActionActive,
        destructive && styles.archiveActionDestructive,
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.archiveActionText,
          active && styles.archiveActionTextActive,
          destructive && styles.archiveActionTextDestructive,
        ]}
      >
        {label}
      </Text>
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
  const hasHumidity = points.some((point) => Number.isFinite(point.humidifierRhPercent));
  const hasAirTemperature = points.some((point) => Number.isFinite(point.humidifierTempC));
  const hasHoseTemperature = points.some((point) => Number.isFinite(point.hoseTempC));

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
          {hasHumidity && (
            <GraphPlot
              label="Humidity"
              unit="% RH"
              color="#0891b2"
              values={points.map((point) => point.humidifierRhPercent ?? Number.NaN)}
              showRange
            />
          )}
          {hasAirTemperature && (
            <GraphPlot
              label="Air temperature"
              unit="C"
              color="#b45309"
              values={points.map((point) => point.humidifierTempC ?? Number.NaN)}
              showRange
            />
          )}
          {hasHoseTemperature && (
            <GraphPlot
              label="Hose temperature"
              unit="C"
              color="#854d0e"
              values={points.map((point) => point.hoseTempC ?? Number.NaN)}
              showRange
            />
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
  status,
  evidenceBasis,
  advanced,
}: {
  observations: SessionObservation[];
  status: SessionAnalysisStatus;
  evidenceBasis: string;
  advanced: boolean;
}) {
  const preview = observations.slice(0, 6);
  return (
    <View style={styles.observationBlock}>
      <Text style={styles.graphLabel}>{advanced ? "Heuristic airflow windows" : "Airflow notes"}</Text>
      <Text style={styles.observationNotice}>
        {advanced
          ? "Non-diagnostic heuristic windows from the imported flow proxy. These are not AHI, diagnosis, screening, or treatment guidance."
          : "Notes from the airflow trend. These are not medical advice or diagnosis."}
      </Text>
      {status === "unavailable" && <Text style={styles.mutedText}>Notes will appear after valid airflow evidence is available.</Text>}
      {status === "insufficient" && (
        <Text style={styles.mutedText}>
          {advanced ? evidenceBasis : "There is not enough airflow evidence for notes yet."}
        </Text>
      )}
      {status === "analyzed" && observations.length === 0 && (
        <Text style={styles.mutedText}>
          {advanced ? "No reduced-flow intervals were detected in the analyzed evidence window." : "No reduced-flow intervals were noted."}
        </Text>
      )}
      {preview.map((observation, index) => (
        <View key={`${observation.startMs}-${index}`} style={styles.observationRow}>
          <Text style={styles.observationType}>{advanced ? observation.type : "Airflow note"}</Text>
          <Text style={styles.observationDetail}>
            {advanced
              ? `${formatElapsed(observation.startMs)} for ${observation.durationSec}s, flow reduction about ${observation.flowDropPercent}%`
              : `Around ${formatElapsed(observation.startMs)} for about ${observation.durationSec}s.`}
          </Text>
          {advanced && <Text style={styles.observationBasis}>{observation.evidenceBasis}</Text>}
        </View>
      ))}
      {observations.length > preview.length && (
        <Text style={styles.mutedText}>{observations.length - preview.length} more {advanced ? "windows in this data" : "notes here"}.</Text>
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
          if (!Number.isFinite(value)) {
            return <View key={`${label}-${index}`} style={styles.graphGap} />;
          }
          const normalized = (value - min) / range;
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
  return downsampleSessionGraphPoints(
    windowed.length > 0 ? windowed : points.slice(-1),
    maxPoints,
  );
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

function archiveSourceLabel(record: VerifiedSessionArchiveRecordV1): string {
  return record.entry.reportInput.source.kind === "live_app_sync"
    ? "Live app capture"
    : "Retained firmware capture";
}

function formatSessionComparisonMetric(metric: SessionComparisonMetric): string {
  const baseline = formatComparisonMetricNumber(metric, metric.baseline);
  const current = formatComparisonMetricNumber(metric, metric.current);
  if (metric.deltaState === "unavailable") {
    return `${baseline} → ${current}; delta unavailable`;
  }
  if (metric.deltaState === "suppressed" || metric.delta === null) {
    return `${baseline} → ${current}; delta suppressed`;
  }
  const delta = formatComparisonMetricNumber(metric, Math.abs(metric.delta));
  const sign = metric.delta > 0 ? "+" : metric.delta < 0 ? "-" : "";
  return `${baseline} → ${current}; delta ${sign}${delta}`;
}

function sessionComparisonReasonLabel(reason: SessionComparisonReasonCode): string {
  const labels: Record<SessionComparisonReasonCode, string> = {
    same_archive_entry: "the same saved capture is selected twice",
    duplicate_selected_evidence: "the selected evidence bytes are duplicates",
    different_device_owner: "the captures have different local device owners",
    incompatible_report_contract: "the report, parser, protocol, or scope contracts differ",
    reporting_software_differs: "the reporting app versions differ",
    analysis_contract_differs: "the heuristic analysis contracts differ",
    missing_selected_evidence: "selected airflow evidence is missing",
    different_source_formats: "the live and retained source formats differ",
    possible_rolling_truncation: "at least one rolling evidence window may be truncated",
    low_cadence_coverage: "cadence coverage is missing or below the comparison threshold",
    different_evidence_durations: "the credited evidence durations differ by more than twofold",
    analysis_status_differs: "the heuristic analysis states differ",
    heuristic_analysis_unavailable: "a heuristic comparison is unavailable",
    window_result_limit_ambiguous: "at least one report reached the V1 50-window output cap",
    discarded_earlier_segments: "at least one report compares only its latest airflow segment",
  };
  return labels[reason];
}

function formatComparisonMetricNumber(
  metric: SessionComparisonMetric,
  value: number | null,
): string {
  if (value === null || !Number.isFinite(value)) return "--";
  if (metric.unit === "ms") return formatDuration(value / 1_000);
  if (metric.unit === "ratio") return `${(value * 100).toFixed(1)}%`;
  if (metric.unit === "rows" || metric.unit === "windows") {
    return String(Math.round(value));
  }
  const formatted = Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  return `${formatted} ${metric.unit}`;
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
  archiveRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#e2e8f0",
  },
  archiveTitle: {
    color: "#0f172a",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
  },
  archiveDetail: {
    marginTop: 2,
    color: "#64748b",
    fontSize: 12,
    lineHeight: 18,
  },
  archiveActions: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  archiveAction: {
    minHeight: 36,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#99f6e4",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  archiveActionActive: {
    backgroundColor: "#ccfbf1",
    borderColor: accent,
  },
  archiveActionDestructive: {
    borderColor: "#fecaca",
  },
  archiveActionText: {
    color: accent,
    fontSize: 12,
    fontWeight: "800",
  },
  archiveActionTextActive: {
    color: "#134e4a",
  },
  archiveActionTextDestructive: {
    color: "#b91c1c",
  },
  archiveLimitation: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 12,
    lineHeight: 18,
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
  graphGap: {
    flex: 1,
    minWidth: 1,
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
