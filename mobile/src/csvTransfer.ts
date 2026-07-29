import { Buffer } from "buffer";

export const CSV_TRANSFER_MAX_BYTES = 512_000;
export const CSV_TRANSFER_MAX_PAGES = 2_048;
export const CSV_TRANSFER_RAW_PAGE_BYTES = 288;
export const CSV_TRANSFER_MAX_RESPONSE_CHARS = 500;
export const CSV_TRANSFER_REQUESTED_MTU = 517;
export const CSV_TRANSFER_ATT_OVERHEAD_BYTES = 3;

type CsvTransferResponse = {
  ok: true;
  generation: number;
  offset: number;
  total: number;
  hash: string;
  data: string;
};

export type CsvTransferSnapshot = {
  csv: string;
  generation: number;
  total: number;
  hash: string;
};

export type CsvTransferTransport = {
  writeRequest: (request: string) => Promise<void>;
  readResponse: () => Promise<string>;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUnsignedInteger(value: unknown, maximum: number): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= maximum;
}

function decodeCanonicalBase64(value: string): Buffer {
  if (value.length === 0 || value.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new Error("CSV transfer page data is not canonical base64.");
  }
  const decoded = Buffer.from(value, "base64");
  if (decoded.toString("base64") !== value) {
    throw new Error("CSV transfer page data is not canonical base64.");
  }
  return decoded;
}

function parseResponse(raw: string): CsvTransferResponse {
  if (!raw || raw.length > CSV_TRANSFER_MAX_RESPONSE_CHARS) {
    throw new Error("CSV transfer response length is invalid.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("CSV transfer response is not valid JSON.");
  }
  if (!isObject(parsed)) {
    throw new Error("CSV transfer response is not an object.");
  }
  if (parsed.ok === false) {
    const error = typeof parsed.error === "string" && /^[a-z][a-z0-9_-]{0,31}$/.test(parsed.error)
      ? parsed.error
      : "rejected";
    throw new Error(`CSV transfer rejected by device: ${error}.`);
  }

  const expectedKeys = ["data", "generation", "hash", "offset", "ok", "total"];
  const actualKeys = Object.keys(parsed).sort();
  if (actualKeys.length !== expectedKeys.length || actualKeys.some((key, index) => key !== expectedKeys[index])) {
    throw new Error("CSV transfer response schema is invalid.");
  }
  if (
    parsed.ok !== true ||
    !isUnsignedInteger(parsed.generation, 0xffff_ffff) ||
    parsed.generation === 0 ||
    !isUnsignedInteger(parsed.offset, CSV_TRANSFER_MAX_BYTES) ||
    !isUnsignedInteger(parsed.total, CSV_TRANSFER_MAX_BYTES) ||
    parsed.total === 0 ||
    typeof parsed.hash !== "string" ||
    !/^[0-9a-f]{8}$/.test(parsed.hash) ||
    typeof parsed.data !== "string"
  ) {
    throw new Error("CSV transfer response fields are invalid.");
  }

  return parsed as CsvTransferResponse;
}

function hashBytes(hash: number, bytes: Uint8Array): number {
  let next = hash >>> 0;
  for (const byte of bytes) {
    next = Math.imul(next ^ byte, 0x01000193) >>> 0;
  }
  return next;
}

export function csvTransferHash(raw: string): string {
  return hashBytes(0x811c9dc5, Buffer.from(raw, "utf8")).toString(16).padStart(8, "0");
}

export function csvTransferMtuCanCarryMaxResponse(mtu: number): boolean {
  return Number.isInteger(mtu) &&
    mtu >= 0 &&
    mtu - CSV_TRANSFER_ATT_OVERHEAD_BYTES >= CSV_TRANSFER_MAX_RESPONSE_CHARS;
}

export async function readCsvTransferWithTransport(transport: CsvTransferTransport): Promise<CsvTransferSnapshot> {
  const transfer = new CsvTransferAssembler();
  for (let page = 0; page < CSV_TRANSFER_MAX_PAGES; page += 1) {
    await transport.writeRequest(transfer.requestJson());
    const response = await transport.readResponse();
    if (transfer.accept(response)) return transfer.finishSnapshot();
  }
  throw new Error("CSV transfer exceeded the page limit.");
}

export class CsvTransferAssembler {
  private generation: number | null = null;
  private total: number | null = null;
  private expectedHash: string | null = null;
  private offset = 0;
  private pages = 0;
  private hash = 0x811c9dc5;
  private readonly chunks: Buffer[] = [];

  requestJson(): string {
    return this.generation === null
      ? JSON.stringify({ offset: 0 })
      : JSON.stringify({ offset: this.offset, generation: this.generation });
  }

  accept(raw: string): boolean {
    if (this.isComplete()) {
      throw new Error("CSV transfer is already complete.");
    }
    if (this.pages >= CSV_TRANSFER_MAX_PAGES) {
      throw new Error("CSV transfer exceeded the page limit.");
    }

    const response = parseResponse(raw);
    if (response.offset !== this.offset) {
      throw new Error("CSV transfer page offset does not match the request.");
    }
    if (this.generation === null) {
      this.generation = response.generation;
      this.total = response.total;
      this.expectedHash = response.hash;
    } else if (
      response.generation !== this.generation ||
      response.total !== this.total ||
      response.hash !== this.expectedHash
    ) {
      throw new Error("CSV transfer snapshot changed during download.");
    }

    const bytes = decodeCanonicalBase64(response.data);
    if (bytes.length === 0 || bytes.length > CSV_TRANSFER_RAW_PAGE_BYTES) {
      throw new Error("CSV transfer page size is invalid.");
    }
    if (bytes.some((byte) => byte !== 0x0a && (byte < 0x20 || byte > 0x7e))) {
      throw new Error("CSV transfer page contains non-ASCII CSV data.");
    }
    if (this.total === null || this.offset + bytes.length > this.total) {
      throw new Error("CSV transfer page exceeds the advertised total.");
    }

    this.chunks.push(bytes);
    this.hash = hashBytes(this.hash, bytes);
    this.offset += bytes.length;
    this.pages += 1;
    return this.isComplete();
  }

  isComplete(): boolean {
    return this.total !== null && this.offset === this.total;
  }

  finish(): string {
    return this.finishSnapshot().csv;
  }

  finishSnapshot(): CsvTransferSnapshot {
    if (!this.isComplete() || this.total === null || this.expectedHash === null) {
      throw new Error("CSV transfer is incomplete.");
    }
    const actualHash = this.hash.toString(16).padStart(8, "0");
    if (actualHash !== this.expectedHash) {
      throw new Error("CSV transfer integrity check failed.");
    }
    const combined = Buffer.concat(this.chunks, this.total);
    if (combined.length !== this.total) {
      throw new Error("CSV transfer byte count is invalid.");
    }
    if (this.generation === null) {
      throw new Error("CSV transfer generation is unavailable.");
    }
    return {
      csv: combined.toString("utf8"),
      generation: this.generation,
      total: this.total,
      hash: this.expectedHash,
    };
  }
}
