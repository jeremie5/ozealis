import { Buffer } from "buffer";

export const LIVE_EVIDENCE_MANIFEST_VERSION = 1;
export const LIVE_EVIDENCE_MIN_FRESH_ROWS = 10;

export type LiveEvidenceOwner = {
  deviceId: string;
  sessionId: number;
};

export type LiveEvidenceManifest = {
  version: typeof LIVE_EVIDENCE_MANIFEST_VERSION;
  deviceId: string;
  appSessionId: number;
  appVersion: string;
  protocol: string;
  createdAtMs: number;
  updatedAtMs: number;
  firstDeviceMs: number;
  lastDeviceMs: number;
  rowCount: number;
  byteCount: number;
  fnv1aHash: string;
};

export type LiveEvidenceSnapshot = {
  csv: string;
  rows: string[];
  manifest: LiveEvidenceManifest;
};

export type LiveEvidenceSampleAction = "append" | "ignore" | "reject" | "replace";

type DecideLiveEvidenceSampleInput = {
  currentOwner: LiveEvidenceOwner | null;
  evidenceOwner: LiveEvidenceOwner | null;
  incomingOwner: LiveEvidenceOwner;
  evidenceRestored: boolean;
  hasEvidenceRows: boolean;
  lastDeviceMs: number;
  incomingDeviceMs: number;
  restartBackstepMs: number;
  maximumGapMs: number;
};

type BuildLiveEvidenceManifestInput = {
  csv: string;
  rows: string[];
  owner: LiveEvidenceOwner;
  appVersion: string;
  protocol: string;
  nowMs: number;
  createdAtMs?: number;
};

const manifestKeys = [
  "appSessionId",
  "appVersion",
  "byteCount",
  "createdAtMs",
  "deviceId",
  "firstDeviceMs",
  "fnv1aHash",
  "lastDeviceMs",
  "protocol",
  "rowCount",
  "updatedAtMs",
  "version",
] as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function deviceMsFromRow(row: string): number | null {
  const firstComma = row.indexOf(",");
  const raw = firstComma >= 0 ? row.slice(0, firstComma) : row;
  const deviceMs = Number(raw);
  return Number.isSafeInteger(deviceMs) && deviceMs >= 0 ? deviceMs : null;
}

export function liveEvidenceHash(raw: string): string {
  let hash = 0x811c9dc5;
  for (const byte of Buffer.from(raw, "utf8")) {
    hash = Math.imul(hash ^ byte, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function isSameLiveEvidenceOwner(
  owner: LiveEvidenceOwner | null,
  deviceId: string,
  sessionId: number,
): boolean {
  return owner?.deviceId === deviceId && owner.sessionId === sessionId;
}

export function decideLiveEvidenceSample({
  currentOwner,
  evidenceOwner,
  incomingOwner,
  evidenceRestored,
  hasEvidenceRows,
  lastDeviceMs,
  incomingDeviceMs,
  restartBackstepMs,
  maximumGapMs,
}: DecideLiveEvidenceSampleInput): LiveEvidenceSampleAction {
  if (
    !isBoundedIdentity(incomingOwner.deviceId, 256)
    || !Number.isSafeInteger(incomingOwner.sessionId)
    || incomingOwner.sessionId <= 0
    || !isSameLiveEvidenceOwner(currentOwner, incomingOwner.deviceId, incomingOwner.sessionId)
    || !isSafeUnsignedInteger(incomingDeviceMs)
    || !isSafeUnsignedInteger(lastDeviceMs)
    || !isSafeUnsignedInteger(restartBackstepMs)
    || !Number.isSafeInteger(maximumGapMs)
    || maximumGapMs <= 0
  ) {
    return "reject";
  }
  if (
    evidenceRestored
    || !isSameLiveEvidenceOwner(evidenceOwner, incomingOwner.deviceId, incomingOwner.sessionId)
  ) {
    return "replace";
  }
  if (!hasEvidenceRows) return "append";
  if (incomingDeviceMs <= lastDeviceMs) {
    return lastDeviceMs - incomingDeviceMs <= restartBackstepMs ? "ignore" : "replace";
  }
  if (incomingDeviceMs - lastDeviceMs > maximumGapMs) return "replace";
  return "append";
}

export function buildLiveEvidenceManifest({
  csv,
  rows,
  owner,
  appVersion,
  protocol,
  nowMs,
  createdAtMs = nowMs,
}: BuildLiveEvidenceManifestInput): LiveEvidenceManifest | null {
  if (
    rows.length === 0
    || !isBoundedIdentity(owner.deviceId, 256)
    || !Number.isSafeInteger(owner.sessionId)
    || owner.sessionId <= 0
    || !isBoundedIdentity(appVersion, 64)
    || !isBoundedIdentity(protocol, 128)
    || !isSafeUnsignedInteger(createdAtMs)
    || !isSafeUnsignedInteger(nowMs)
    || nowMs < createdAtMs
  ) {
    return null;
  }

  const firstDeviceMs = deviceMsFromRow(rows[0]);
  const lastDeviceMs = deviceMsFromRow(rows[rows.length - 1]);
  if (firstDeviceMs === null || lastDeviceMs === null || lastDeviceMs < firstDeviceMs) return null;

  return {
    version: LIVE_EVIDENCE_MANIFEST_VERSION,
    deviceId: owner.deviceId,
    appSessionId: owner.sessionId,
    appVersion,
    protocol,
    createdAtMs,
    updatedAtMs: nowMs,
    firstDeviceMs,
    lastDeviceMs,
    rowCount: rows.length,
    byteCount: Buffer.byteLength(csv, "utf8"),
    fnv1aHash: liveEvidenceHash(csv),
  };
}

export function serializeLiveEvidenceManifest(manifest: LiveEvidenceManifest): string {
  return JSON.stringify(manifest);
}

export function parseLiveEvidenceManifest(raw: string): LiveEvidenceManifest | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObject(parsed)) return null;

  const keys = Object.keys(parsed).sort();
  if (keys.length !== manifestKeys.length || keys.some((key, index) => key !== manifestKeys[index])) {
    return null;
  }
  if (
    parsed.version !== LIVE_EVIDENCE_MANIFEST_VERSION
    || !isBoundedIdentity(parsed.deviceId, 256)
    || !Number.isSafeInteger(parsed.appSessionId)
    || (parsed.appSessionId as number) <= 0
    || !isBoundedIdentity(parsed.appVersion, 64)
    || !isBoundedIdentity(parsed.protocol, 128)
    || !isSafeUnsignedInteger(parsed.createdAtMs)
    || !isSafeUnsignedInteger(parsed.updatedAtMs)
    || parsed.updatedAtMs < parsed.createdAtMs
    || !isSafeUnsignedInteger(parsed.firstDeviceMs)
    || !isSafeUnsignedInteger(parsed.lastDeviceMs)
    || parsed.lastDeviceMs < parsed.firstDeviceMs
    || !Number.isSafeInteger(parsed.rowCount)
    || (parsed.rowCount as number) <= 0
    || !Number.isSafeInteger(parsed.byteCount)
    || (parsed.byteCount as number) <= 0
    || typeof parsed.fnv1aHash !== "string"
    || !/^[0-9a-f]{8}$/.test(parsed.fnv1aHash)
  ) {
    return null;
  }

  return parsed as LiveEvidenceManifest;
}

export function restoreLiveEvidenceSnapshot(
  csv: string,
  rawManifest: string,
  expectedHeader: string,
  maximumRows: number,
  isValidRow: (row: string) => boolean,
): LiveEvidenceSnapshot | null {
  const manifest = parseLiveEvidenceManifest(rawManifest);
  if (
    !manifest
    || !Number.isSafeInteger(maximumRows)
    || maximumRows <= 0
    || !csv
    || csv.includes("\r")
    || csv !== csv.trim()
    || Buffer.byteLength(csv, "utf8") !== manifest.byteCount
    || liveEvidenceHash(csv) !== manifest.fnv1aHash
  ) {
    return null;
  }

  const lines = csv.split("\n");
  if (lines[0] !== expectedHeader || lines.length < 2) return null;
  const rows = lines.slice(1);
  if (
    rows.length !== manifest.rowCount
    || rows.length > maximumRows
    || rows.some((row) => row.length === 0 || row !== row.trim() || !isValidRow(row))
  ) {
    return null;
  }

  const firstDeviceMs = deviceMsFromRow(rows[0]);
  const lastDeviceMs = deviceMsFromRow(rows[rows.length - 1]);
  if (
    firstDeviceMs === null
    || lastDeviceMs === null
    || firstDeviceMs !== manifest.firstDeviceMs
    || lastDeviceMs !== manifest.lastDeviceMs
  ) {
    return null;
  }

  return { csv, rows, manifest };
}
