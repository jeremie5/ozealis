import { Buffer } from "buffer";

export type OximetrySample = {
  spo2: number;
  pulse: number;
  quality: number;
  receivedAt: number;
  source: "bluetooth" | "i2c" | "none";
};

export type OximetryStatus = {
  label: string;
  detail: string;
  source: string;
  present: boolean;
};

export const OXIMETRY_STALE_MS = 10000;

export class LatestOnlyAsyncRelay<T> {
  private pending: T | null = null;
  private running = false;
  private readonly idleWaiters: Array<() => void> = [];

  constructor(
    private readonly send: (value: T) => Promise<void>,
    private readonly onError: (error: unknown) => void = () => undefined,
  ) {}

  push(value: T): void {
    this.pending = value;
    if (!this.running) void this.drain();
  }

  clearPending(): void {
    this.pending = null;
  }

  whenIdle(): Promise<void> {
    if (!this.running && this.pending === null) return Promise.resolve();
    return new Promise((resolve) => this.idleWaiters.push(resolve));
  }

  private async drain(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      while (this.pending !== null) {
        const value = this.pending;
        this.pending = null;
        try {
          await this.send(value);
        } catch (error) {
          this.onError(error);
        }
      }
    } finally {
      this.running = false;
      if (this.pending !== null) {
        void this.drain();
        return;
      }
      this.idleWaiters.splice(0).forEach((resolve) => resolve());
    }
  }
}

export function parsePlxContinuousMeasurement(value?: string | null, receivedAt = Date.now()): OximetrySample | null {
  if (!value) return null;
  const bytes = Buffer.from(value, "base64");
  if (bytes.length < 5) return null;
  const spo2 = decodeBluetoothSfloat(bytes[1] | (bytes[2] << 8));
  const pulse = decodeBluetoothSfloat(bytes[3] | (bytes[4] << 8));
  if (!Number.isFinite(spo2) || !Number.isFinite(pulse) || spo2 < 50 || spo2 > 100 || pulse < 20 || pulse > 250) return null;
  return {
    spo2,
    pulse,
    quality: 0,
    receivedAt,
    source: "bluetooth",
  };
}

export function formatOximetryStatus(
  raw: string,
  deviceReceivedAt: number | undefined,
  phoneSample: OximetrySample | null,
  now = Date.now(),
): OximetryStatus {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isJsonObject(parsed) && parsed.present === true) {
      const spo2 = boundedNumber(parsed.spo2, 50, 100);
      const pulse = boundedNumber(parsed.pulse, 20, 250);
      const reportedAgeMs = boundedInteger(parsed.ageMs, 0, OXIMETRY_STALE_MS);
      const localAgeMs = sampleAgeMs(deviceReceivedAt, now);
      if (
        spo2 !== null &&
        pulse !== null &&
        reportedAgeMs !== null &&
        localAgeMs !== null &&
        reportedAgeMs + localAgeMs <= OXIMETRY_STALE_MS
      ) {
        const source = parsed.source === "i2c" ? "wired" : parsed.source === "ble" ? "Bluetooth relay" : "device";
        return {
          label: `${spo2.toFixed(1)}% / ${pulse.toFixed(1)} bpm`,
          detail: `${source}, ${Math.round((reportedAgeMs + localAgeMs) / 1000)}s old`,
          source,
          present: true,
        };
      }
    }
  } catch {
    // Fall through to a fresh phone-side sample or the absent display.
  }

  const phoneAgeMs = sampleAgeMs(phoneSample?.receivedAt, now);
  if (
    phoneSample &&
    boundedNumber(phoneSample.spo2, 50, 100) !== null &&
    boundedNumber(phoneSample.pulse, 20, 250) !== null &&
    phoneAgeMs !== null &&
    phoneAgeMs <= OXIMETRY_STALE_MS
  ) {
    return {
      label: `${phoneSample.spo2.toFixed(1)}% / ${phoneSample.pulse.toFixed(1)} bpm`,
      detail: "phone-side Bluetooth oximeter",
      source: "phone",
      present: true,
    };
  }
  return { label: "Not connected", detail: "No oximeter data", source: "none", present: false };
}

export function decodeBluetoothSfloat(raw: number): number {
  const mantissaRaw = raw & 0x0fff;
  const exponentRaw = raw >> 12;
  const mantissa = mantissaRaw >= 0x0800 ? mantissaRaw - 0x1000 : mantissaRaw;
  const exponent = exponentRaw >= 0x08 ? exponentRaw - 0x10 : exponentRaw;
  const value = mantissa * Math.pow(10, exponent);
  return Number.isFinite(value) ? value : Number.NaN;
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function boundedNumber(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? value : null;
}

function boundedInteger(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max ? value : null;
}

function sampleAgeMs(receivedAt: number | undefined, now: number): number | null {
  if (typeof receivedAt !== "number" || !Number.isFinite(receivedAt) || !Number.isFinite(now)) return null;
  const ageMs = now - receivedAt;
  return ageMs >= 0 ? ageMs : null;
}
