import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import ts from "../mobile/node_modules/typescript/lib/typescript.js";

const root = resolve(import.meta.dirname, "..");
const tempDir = mkdtempSync(join(tmpdir(), "ozealis-csv-transfer-"));

try {
  for (const moduleName of ["csvTransfer", "plxOximetry", "validation", "ozealisBle"]) {
    const source = readFileSync(resolve(root, `mobile/src/${moduleName}.ts`), "utf8");
    const output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    });
    writeFileSync(join(tempDir, `${moduleName}.js`), output.outputText);
  }
  const require = createRequire(import.meta.url);

  const {
    CSV_TRANSFER_MAX_BYTES,
    CSV_TRANSFER_RAW_PAGE_BYTES,
    CSV_TRANSFER_REQUESTED_MTU,
    CsvTransferAssembler,
    csvTransferHash,
    csvTransferMtuCanCarryMaxResponse,
    readCsvTransferWithTransport,
  } = require(join(tempDir, "csvTransfer.js"));
  const {
    OZEALIS_SERVICE_UUID,
    readCsvTransfer,
  } = require(join(tempDir, "ozealisBle.js"));

  const csv = `a,b\n${Array.from({ length: 180 }, (_, index) => `${index},${index + 1}`).join("\n")}\n`;
  const generation = 17;
  const hash = csvTransferHash(csv);
  const bytes = Buffer.from(csv, "utf8");
  const assembler = new CsvTransferAssembler();
  let offset = 0;

  assert.equal(assembler.requestJson(), "{\"offset\":0}");
  while (offset < bytes.length) {
    const data = bytes.subarray(offset, offset + CSV_TRANSFER_RAW_PAGE_BYTES);
    const response = JSON.stringify({
      ok: true,
      generation,
      offset,
      total: bytes.length,
      hash,
      data: data.toString("base64"),
    });
    const complete = assembler.accept(response);
    offset += data.length;
    assert.equal(complete, offset === bytes.length);
    if (!complete) {
      assert.equal(assembler.requestJson(), `{"offset":${offset},"generation":${generation}}`);
    }
  }
  assert.equal(assembler.finish(), csv);
  assert.deepEqual(assembler.finishSnapshot(), {
    csv,
    generation,
    total: bytes.length,
    hash,
  });
  assert.equal(csvTransferHash("hello\n"), "f8934173");
  assert.equal(csvTransferMtuCanCarryMaxResponse(CSV_TRANSFER_REQUESTED_MTU), true);
  assert.equal(csvTransferMtuCanCarryMaxResponse(502), false);

  const transportCsv = `header\n${"row\n".repeat(200)}`;
  const transportBytes = Buffer.from(transportCsv);
  const transportGeneration = 23;
  const transportHash = csvTransferHash(transportCsv);
  const transportRequests = [];
  let transportResponse = "";
  const transport = {
    async writeRequest(request) {
      transportRequests.push(request);
      const parsed = JSON.parse(request);
      const page = transportBytes.subarray(parsed.offset, parsed.offset + CSV_TRANSFER_RAW_PAGE_BYTES);
      transportResponse = JSON.stringify({
        ok: true,
        generation: transportGeneration,
        offset: parsed.offset,
        total: transportBytes.length,
        hash: transportHash,
        data: page.toString("base64"),
      });
    },
    async readResponse() {
      return transportResponse;
    },
  };
  const transportSnapshot = await readCsvTransferWithTransport(transport);
  assert.equal(transportSnapshot.csv, transportCsv);
  assert.equal(transportSnapshot.generation, transportGeneration);
  assert.ok(transportRequests.length > 1);
  assert.equal(transportRequests[0], "{\"offset\":0}");
  transportRequests.slice(1).forEach((request, index) => {
    assert.equal(request, `{"offset":${(index + 1) * CSV_TRANSFER_RAW_PAGE_BYTES},"generation":${transportGeneration}}`);
  });

  const characteristicUuid = "7f2d0021-0f4d-4a1f-9f84-0c2a6b3d0000";
  const deviceRequests = [];
  let deviceResponse = "";
  const mockDevice = {
    async writeCharacteristicWithResponseForService(serviceUuid, requestedCharacteristicUuid, encodedRequest) {
      assert.equal(serviceUuid, OZEALIS_SERVICE_UUID);
      assert.equal(requestedCharacteristicUuid, characteristicUuid);
      const request = Buffer.from(encodedRequest, "base64").toString("utf8");
      deviceRequests.push(request);
      const parsed = JSON.parse(request);
      const page = transportBytes.subarray(parsed.offset, parsed.offset + CSV_TRANSFER_RAW_PAGE_BYTES);
      deviceResponse = JSON.stringify({
        ok: true,
        generation: transportGeneration,
        offset: parsed.offset,
        total: transportBytes.length,
        hash: transportHash,
        data: page.toString("base64"),
      });
    },
    async readCharacteristicForService(serviceUuid, requestedCharacteristicUuid) {
      assert.equal(serviceUuid, OZEALIS_SERVICE_UUID);
      assert.equal(requestedCharacteristicUuid, characteristicUuid);
      return { value: Buffer.from(deviceResponse, "utf8").toString("base64") };
    },
  };
  const deviceSnapshot = await readCsvTransfer(mockDevice, characteristicUuid);
  assert.deepEqual(deviceSnapshot, transportSnapshot);
  assert.ok(deviceRequests.length > 1);
  assert.equal(deviceRequests[0], "{\"offset\":0}");
  deviceRequests.slice(1).forEach((request, index) => {
    assert.equal(request, `{"offset":${(index + 1) * CSV_TRANSFER_RAW_PAGE_BYTES},"generation":${transportGeneration}}`);
  });

  let rejectedWrites = 0;
  await assert.rejects(
    readCsvTransferWithTransport({
      async writeRequest() {
        rejectedWrites += 1;
      },
      async readResponse() {
        return JSON.stringify({ ok: false, error: "snapshot_changed" });
      },
    }),
    /rejected by device: snapshot_changed/,
  );
  assert.equal(rejectedWrites, 1);

  const reconnectRequests = [];
  let disconnectedReads = 0;
  await assert.rejects(
    readCsvTransferWithTransport({
      async writeRequest(request) {
        reconnectRequests.push(request);
      },
      async readResponse() {
        disconnectedReads += 1;
        if (disconnectedReads > 1) throw new Error("disconnected");
        const firstPage = transportBytes.subarray(0, CSV_TRANSFER_RAW_PAGE_BYTES);
        return JSON.stringify({
          ok: true,
          generation: transportGeneration,
          offset: 0,
          total: transportBytes.length,
          hash: transportHash,
          data: firstPage.toString("base64"),
        });
      },
    }),
    /disconnected/,
  );
  const reconnectStartIndex = reconnectRequests.length;
  const reconnectTransport = {
    async writeRequest(request) {
      reconnectRequests.push(request);
      const parsed = JSON.parse(request);
      const page = transportBytes.subarray(parsed.offset, parsed.offset + CSV_TRANSFER_RAW_PAGE_BYTES);
      transportResponse = JSON.stringify({
        ok: true,
        generation: transportGeneration,
        offset: parsed.offset,
        total: transportBytes.length,
        hash: transportHash,
        data: page.toString("base64"),
      });
    },
    async readResponse() {
      return transportResponse;
    },
  };
  const reconnectSnapshot = await readCsvTransferWithTransport(reconnectTransport);
  assert.equal(reconnectSnapshot.csv, transportCsv);
  assert.equal(reconnectRequests[reconnectStartIndex], "{\"offset\":0}");

  function validResponse(overrides = {}) {
    const raw = "a,b\n";
    return JSON.stringify({
      ok: true,
      generation: 1,
      offset: 0,
      total: raw.length,
      hash: csvTransferHash(raw),
      data: Buffer.from(raw).toString("base64"),
      ...overrides,
    });
  }

  assert.throws(() => new CsvTransferAssembler().accept("not json"), /not valid JSON/);
  assert.throws(() => new CsvTransferAssembler().accept("[]"), /not an object/);
  assert.throws(
    () => new CsvTransferAssembler().accept(JSON.stringify({ ok: false, error: "busy" })),
    /rejected by device: busy/,
  );
  assert.throws(() => new CsvTransferAssembler().accept(validResponse({ extra: true })), /schema is invalid/);
  assert.throws(() => new CsvTransferAssembler().accept(validResponse({ generation: 0 })), /fields are invalid/);
  assert.throws(() => new CsvTransferAssembler().accept(validResponse({ total: CSV_TRANSFER_MAX_BYTES + 1 })), /fields are invalid/);
  assert.throws(() => new CsvTransferAssembler().accept(validResponse({ hash: "F8934173" })), /fields are invalid/);
  assert.throws(() => new CsvTransferAssembler().accept("x".repeat(501)), /response length is invalid/);
  assert.throws(() => new CsvTransferAssembler().accept(validResponse({ offset: 1 })), /offset does not match/);
  assert.throws(() => new CsvTransferAssembler().accept(validResponse({ data: "YQ=" })), /canonical base64/);
  assert.throws(
    () => new CsvTransferAssembler().accept(validResponse({
      total: CSV_TRANSFER_RAW_PAGE_BYTES + 1,
      data: Buffer.alloc(CSV_TRANSFER_RAW_PAGE_BYTES + 1, 0x61).toString("base64"),
    })),
    /page size is invalid/,
  );
  assert.throws(
    () => new CsvTransferAssembler().accept(validResponse({
      total: 4,
      data: Buffer.from([0x61, 0x00, 0x62, 0x0a]).toString("base64"),
    })),
    /non-ASCII CSV data/,
  );

  const changed = new CsvTransferAssembler();
  const first = "a".repeat(CSV_TRANSFER_RAW_PAGE_BYTES);
  const completeCsv = `${first}z`;
  changed.accept(JSON.stringify({
    ok: true,
    generation: 9,
    offset: 0,
    total: completeCsv.length,
    hash: csvTransferHash(completeCsv),
    data: Buffer.from(first).toString("base64"),
  }));
  assert.throws(
    () => changed.accept(JSON.stringify({
      ok: true,
      generation: 10,
      offset: first.length,
      total: completeCsv.length,
      hash: csvTransferHash(completeCsv),
      data: Buffer.from("z").toString("base64"),
    })),
    /snapshot changed/,
  );

  const corrupted = new CsvTransferAssembler();
  corrupted.accept(validResponse({ hash: "00000000" }));
  assert.throws(() => corrupted.finish(), /integrity check failed/);

  console.log("Mobile retained CSV transfer tests passed.");
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
