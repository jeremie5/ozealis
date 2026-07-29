import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const maxBytes = 1_850_000;
const flashSizeBytes = 0x400000;
const partitionCsv = resolve(root, "firmware/Rev 2/min_spiffs.csv");
const firmwareImages = [
  ["esp32dev", resolve(root, "firmware/Rev 2/.pio/build/esp32dev/firmware.bin")],
  ["esp32dev_bench_pwm", resolve(root, "firmware/Rev 2/.pio/build/esp32dev_bench_pwm/firmware.bin")],
];

const failures = [];
const partitions = readPartitions();
const appSlotBytes = partitions.filter((partition) => partition.type === "app" && partition.subtype?.startsWith("ota_"));
const requiredOtaSubtypes = ["ota_0", "ota_1"];

assertPartitionLayout();
if (appSlotBytes.length === 0) {
  failures.push(`no app OTA partitions found in ${partitionCsv}`);
} else {
  for (const { name, size } of appSlotBytes) {
    if (maxBytes > size) {
      failures.push(`flash budget ${maxBytes} bytes exceeds ${name} partition size ${size} bytes.`);
    }
  }
}
for (const subtype of requiredOtaSubtypes) {
  const matchingSlots = appSlotBytes.filter((slot) => slot.subtype === subtype);
  if (matchingSlots.length === 0) {
    failures.push(`required app OTA partition ${subtype} is missing or malformed in ${partitionCsv}.`);
  } else if (matchingSlots.length > 1) {
    failures.push(`required app OTA partition ${subtype} is duplicated in ${partitionCsv}.`);
  }
}

for (const [env, firmwareBin] of firmwareImages) {
  if (!existsSync(firmwareBin)) {
    failures.push(`${env} firmware image is missing at ${firmwareBin}. Run the PlatformIO build before checking flash budget.`);
    continue;
  }
  const size = statSync(firmwareBin).size;
  const headroom = maxBytes - size;
  if (headroom < 0) {
    failures.push(`${env} firmware image is ${size} bytes, exceeding the ${maxBytes} byte CI budget by ${Math.abs(headroom)} bytes.`);
  } else {
    console.log(`${env} firmware image is ${size} bytes; ${headroom} bytes remain under the ${maxBytes} byte CI budget.`);
  }
}

if (failures.length > 0) {
  console.error("Firmware flash budget verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

function assertPartitionLayout() {
  const requiredRows = [
    { name: "nvs", type: "data", subtype: "nvs", offset: 0x9000, size: 0x5000 },
    { name: "otadata", type: "data", subtype: "ota", offset: 0xe000, size: 0x2000 },
    { name: "app0", type: "app", subtype: "ota_0", offset: 0x10000, size: 0x1e0000 },
    { name: "app1", type: "app", subtype: "ota_1", offset: 0x1f0000, size: 0x1e0000 },
    { name: "spiffs", type: "data", subtype: "spiffs", offset: 0x3d0000, size: 0x30000 },
  ];
  if (partitions.length !== requiredRows.length) {
    failures.push(`partition table must contain exactly ${requiredRows.length} rows; found ${partitions.length}.`);
  }
  for (const expected of requiredRows) {
    const actual = partitions.find((partition) => partition.name === expected.name);
    if (!actual) {
      failures.push(`required partition ${expected.name} is missing in ${partitionCsv}.`);
      continue;
    }
    for (const key of ["type", "subtype", "offset", "size"]) {
      if (actual[key] !== expected[key]) {
        failures.push(`partition ${expected.name} ${key} expected ${formatPartitionValue(expected[key])}, found ${formatPartitionValue(actual[key])}.`);
      }
    }
  }
  const sorted = [...partitions].sort((left, right) => left.offset - right.offset);
  for (let index = 0; index < sorted.length; index += 1) {
    const partition = sorted[index];
    if (partition.offset + partition.size > flashSizeBytes) {
      failures.push(`partition ${partition.name} ends at ${formatHex(partition.offset + partition.size)}, beyond 4 MB flash boundary ${formatHex(flashSizeBytes)}.`);
    }
    if (index === 0) continue;
    const previous = sorted[index - 1];
    const previousEnd = previous.offset + previous.size;
    if (partition.offset < previousEnd) {
      failures.push(`partition ${partition.name} at ${formatHex(partition.offset)} overlaps ${previous.name}, which ends at ${formatHex(previousEnd)}.`);
    }
  }
}

function readPartitions() {
  if (!existsSync(partitionCsv)) return [];
  const rows = [];
  for (const line of readFileSync(partitionCsv, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))) {
    const fields = line.split(",").map((field) => field.trim());
    const [name, type, subtype, offsetText, sizeText] = fields;
    const offset = parsePartitionSize(offsetText);
    const size = parsePartitionSize(sizeText);
    if (!name || !type || !subtype || !Number.isFinite(offset) || offset < 0 || !Number.isFinite(size) || size <= 0) {
      failures.push(`partition row is malformed in ${partitionCsv}: ${line}`);
      continue;
    }
    rows.push({ name, type, subtype, offset, size });
  }
  return rows;
}

function parsePartitionSize(value) {
  const text = String(value || "").trim().toLowerCase();
  if (/^0x[0-9a-f]+$/.test(text)) return Number.parseInt(text, 16);
  if (/^\d+$/.test(text)) return Number.parseInt(text, 10);
  return NaN;
}

function formatPartitionValue(value) {
  return typeof value === "number" ? formatHex(value) : JSON.stringify(value);
}

function formatHex(value) {
  return `0x${value.toString(16).toUpperCase()}`;
}
