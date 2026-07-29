import { Buffer } from "buffer";
import { BleManager, Characteristic, Device, Subscription } from "react-native-ble-plx";
import { CsvTransferSnapshot, readCsvTransferWithTransport } from "./csvTransfer";
export {
  CSV_TRANSFER_ATT_OVERHEAD_BYTES,
  CSV_TRANSFER_MAX_BYTES,
  CSV_TRANSFER_MAX_PAGES,
  CSV_TRANSFER_MAX_RESPONSE_CHARS,
  CSV_TRANSFER_RAW_PAGE_BYTES,
  CSV_TRANSFER_REQUESTED_MTU,
  CsvTransferAssembler,
  csvTransferHash,
  csvTransferMtuCanCarryMaxResponse,
  readCsvTransferWithTransport,
} from "./csvTransfer";
export { formatOximetryStatus, LatestOnlyAsyncRelay, OXIMETRY_STALE_MS, parsePlxContinuousMeasurement } from "./plxOximetry";
export type { OximetrySample, OximetryStatus } from "./plxOximetry";
export type { CsvTransferSnapshot } from "./csvTransfer";

export {
  DEFAULT_PREWARM_SCHEDULE,
  DEFAULT_SETTINGS,
  THERAPY_MODE_LABELS,
  csvDataRowCount,
  csvPreview,
  filterSessionCsvByDay,
  flagSessionObservations,
  isClearedDeviceLogReadback,
  isHeaderOnlyFaultCsv,
  isHeaderOnlyRetainedSessionCsv,
  isOtaStatusInProgress,
  isPrewarmScheduleDue,
  isCompatibleDeviceSession,
  isSameDeviceSession,
  isSettingsReadbackObject,
  isValidLiveCsvRow,
  isSupportedOtaUrl,
  listSessionDayOptions,
  normalizeFaultCsv,
  normalizeFaultSnapshot,
  normalizeKnownCsv,
  normalizeRetainedSessionCsv,
  normalizeRetainedSessionSnapshot,
  parseCalibrationStatus,
  parseLiveCsvDiagnostics,
  parseMcfParamsSnapshot,
  parseFaultCode,
  parseModuleStatus,
  parseOtaStatus,
  parseOptionalTelemetryNumber,
  parsePrewarmSchedule,
  prewarmScheduleRunKey,
  parseSessionGraphData,
  parseSystemMode,
  parseUiPreference,
  redactSensitiveJson,
  retainedReadbackImportedRowCount,
  markPrewarmScheduleRun,
  parseSettings,
  parseSettingsReadback,
  parseRetainedImportManifest,
  sanitizePrewarmSchedule,
  sanitizeSettings,
  selectSessionAnalysisCsv,
  serializeSettings,
  serializeRetainedImportManifest,
  serializePrewarmSchedule,
  settingLimitMessages,
  summarizeSessionCsv,
} from "./validation";
export type { OzealisSettings, PrewarmSchedule, RetainedImportManifest, SessionDayOption, SessionGraphPoint, SessionObservation, SessionSummary, TherapyMode } from "./validation";

export const OZEALIS_SERVICE_UUID = "7f2d5f4a-0f4d-4a1f-9f84-0c2a6b3d0000";
export const OZEALIS_PROTOCOL_VERSION = "ozealis-ble-v2";

export const OZEALIS_CHARACTERISTICS = {
  pressure: uuid16("0001"),
  flow: uuid16("0002"),
  setpoint: uuid16("0003"),
  vin: uuid16("0004"),
  mode: uuid16("0005"),
  ahi: uuid16("0006"),
  otaCommand: uuid16("0007"),
  otaStatus: uuid16("0008"),
  fault: uuid16("0009"),
  humidifierTemp: uuid16("0010"),
  humidifierRh: uuid16("0011"),
  hoseTemp: uuid16("0012"),
  moduleStatus: uuid16("0013"),
  oximetry: uuid16("0014"),
  liveCsv: uuid16("0020"),
  logDownload: uuid16("0021"),
  faultCsv: uuid16("0022"),
  calibrationStatus: uuid16("0030"),
  calibrationCommand: uuid16("0031"),
  mcfParams: uuid16("0032"),
  control: uuid16("00c0"),
  oximetryRelay: uuid16("00d0"),
  settings: uuid16("00f0"),
  protocol: uuid16("00ff"),
} as const;

export const PLX_SERVICE_UUID = "00001822-0000-1000-8000-00805f9b34fb";
export const PLX_CONTINUOUS_MEASUREMENT_UUID = "00002a5f-0000-1000-8000-00805f9b34fb";

export type OzealisTelemetry = {
  pressure: string;
  flow: string;
  setpoint: string;
  vin: string;
  mode: string;
  fault: string;
  ahi: string;
  humidifierTemp: string;
  humidifierRh: string;
  hoseTemp: string;
  moduleStatus: string;
  oximetry: string;
  liveCsv: string;
  otaStatus: string;
  calibrationStatus: string;
  controllerMeasured: string;
  controllerError: string;
  controllerAmp: string;
  motorCommand: string;
  motorFault: string;
  motorI2c: string;
  motorFgHz: string;
  oximetryReceivedAt?: number;
  updatedAt?: number;
};

export const EMPTY_TELEMETRY: OzealisTelemetry = {
  pressure: "--",
  flow: "--",
  setpoint: "--",
  vin: "--",
  mode: "--",
  fault: "--",
  ahi: "--",
  humidifierTemp: "--",
  humidifierRh: "--",
  hoseTemp: "--",
  moduleStatus: "--",
  oximetry: "--",
  liveCsv: "--",
  otaStatus: "IDLE",
  calibrationStatus: "{}",
  controllerMeasured: "--",
  controllerError: "--",
  controllerAmp: "--",
  motorCommand: "--",
  motorFault: "--",
  motorI2c: "--",
  motorFgHz: "--",
};

export function uuid16(shortUuid: string): string {
  return `7f2d${shortUuid.toLowerCase()}-0f4d-4a1f-9f84-0c2a6b3d0000`;
}

export function decodeBle(value?: string | null): string {
  if (!value) return "";
  return Buffer.from(value, "base64").toString("utf8");
}

export function encodeBle(value: string): string {
  return Buffer.from(value, "utf8").toString("base64");
}

export async function readUtf8(device: Device, characteristicUuid: string): Promise<string> {
  const characteristic = await device.readCharacteristicForService(OZEALIS_SERVICE_UUID, characteristicUuid);
  return decodeBle(characteristic.value);
}

export async function writeUtf8(device: Device, characteristicUuid: string, value: string): Promise<void> {
  await device.writeCharacteristicWithResponseForService(
    OZEALIS_SERVICE_UUID,
    characteristicUuid,
    encodeBle(value),
  );
}

export async function readCsvTransfer(device: Device, characteristicUuid: string): Promise<CsvTransferSnapshot> {
  return readCsvTransferWithTransport({
    writeRequest: (request) => writeUtf8(device, characteristicUuid, request),
    readResponse: () => readUtf8(device, characteristicUuid),
  });
}

export function subscribeText(
  device: Device,
  characteristicUuid: string,
  onValue: (value: string) => void,
  onError: (message: string) => void,
): Subscription {
  return device.monitorCharacteristicForService(
    OZEALIS_SERVICE_UUID,
    characteristicUuid,
    (error, characteristic: Characteristic | null) => {
      if (error) {
        onError(error.message);
        return;
      }
      onValue(decodeBle(characteristic?.value));
    },
  );
}

export function isOzealisDevice(device: Device): boolean {
  const name = (device.name || device.localName || "").toLowerCase();
  const serviceUuids = device.serviceUUIDs || [];
  return name.includes("ozealis") || serviceUuids.some((uuid) => uuid.toLowerCase() === OZEALIS_SERVICE_UUID);
}

export async function stopManager(manager: BleManager): Promise<void> {
  manager.stopDeviceScan();
  manager.destroy();
}
