import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "../mobile/node_modules/typescript/lib/typescript.js";

const root = resolve(import.meta.dirname, "..");
const sourcePath = resolve(root, "mobile/src/operationLease.ts");
const tempDir = mkdtempSync(join(tmpdir(), "ozealis-operation-lease-"));

try {
  const source = readFileSync(sourcePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const modulePath = join(tempDir, "operationLease.mjs");
  writeFileSync(modulePath, output.outputText);

  const {
    advanceSessionGeneration,
    OperationLeaseCoordinator,
    OperationLeaseManager,
  } = await import(pathToFileURL(modulePath).href);

  {
    const capturedGeneration = 9;
    const advancedGeneration = advanceSessionGeneration(capturedGeneration, capturedGeneration);
    assert.equal(advancedGeneration, 10);
    assert.equal(
      advanceSessionGeneration(advancedGeneration, capturedGeneration),
      null,
      "a second reset with the captured old generation must be rejected",
    );
  }

  {
    const leases = new OperationLeaseManager();
    const control = { deviceId: "device-a", sessionId: 1, operation: "control:start" };
    const token = leases.acquire(control);

    assert.ok(token, "the first operation should acquire synchronously");
    assert.equal(typeof token.then, "undefined");
    assert.equal(leases.isValid(token), true);
    assert.equal(leases.isValidFor(token, control), true);
    assert.deepEqual(leases.activeIdentity(), control);
    assert.equal(Object.isFrozen(token), true, "the acquired token must be immutable");
    assert.equal(Object.isFrozen(token.identity), true, "the acquired token identity must be immutable");
    control.deviceId = "caller-mutated-device";
    assert.equal(
      token.identity.deviceId,
      "device-a",
      "mutating the caller identity must not alter the acquired token",
    );
    assert.throws(
      () => {
        token.identity.deviceId = "token-mutated-device";
      },
      TypeError,
      "runtime mutation of the frozen token identity must fail",
    );

    assert.equal(
      leases.acquire({ deviceId: "device-a", sessionId: 1, operation: "settings:write" }),
      null,
      "different sensitive operations must not overlap",
    );
    assert.equal(
      leases.acquire(control),
      null,
      "duplicate sensitive operations must not overlap",
    );

    assert.equal(leases.release(token), true);
    assert.equal(leases.isValid(token), false);
    assert.equal(leases.activeIdentity(), null);
  }

  {
    const leases = new OperationLeaseManager();
    const oldToken = leases.acquire({
      deviceId: "device-a",
      sessionId: 10,
      operation: "logs:clear",
    });
    assert.ok(oldToken);

    const afterAwait = (async () => {
      await Promise.resolve();
      return leases.isValid(oldToken);
    })();

    assert.equal(leases.invalidateAll(), true, "disconnect must invalidate outstanding work");
    const reconnectedToken = leases.acquire({
      deviceId: "device-a",
      sessionId: 11,
      operation: "logs:clear",
    });
    assert.ok(reconnectedToken);
    assert.equal(await afterAwait, false, "work resumed after disconnect must observe revocation");
    assert.equal(leases.release(oldToken), false, "a disconnected token must not release reconnect work");
    assert.equal(leases.isValid(reconnectedToken), true);
  }

  {
    const leases = new OperationLeaseManager();
    const oldSessionToken = leases.acquire({
      deviceId: "device-a",
      sessionId: 20,
      operation: "calibration:capture",
    });
    assert.ok(oldSessionToken);
    assert.equal(leases.invalidateSession("device-a", 19), false);
    assert.equal(leases.isValid(oldSessionToken), true);
    assert.equal(leases.invalidateSession("device-a", 20), true);
    assert.equal(leases.isValid(oldSessionToken), false);

    const newSessionToken = leases.acquire({
      deviceId: "device-a",
      sessionId: 21,
      operation: "calibration:capture",
    });
    assert.ok(newSessionToken, "the same device may acquire under a new session");
    assert.equal(leases.release(oldSessionToken), false);
    assert.equal(leases.isValid(newSessionToken), true);
  }

  {
    const leases = new OperationLeaseManager();
    const deviceAToken = leases.acquire({
      deviceId: "device-a",
      sessionId: "session-a",
      operation: "ota",
    });
    assert.ok(deviceAToken);
    assert.equal(leases.invalidateDevice("device-b"), false);
    assert.equal(leases.isValid(deviceAToken), true);
    assert.equal(leases.invalidateDevice("device-a"), true);

    const deviceBToken = leases.acquire({
      deviceId: "device-b",
      sessionId: "session-b",
      operation: "ota",
    });
    assert.ok(deviceBToken, "a device switch may acquire after invalidating the old device");
    assert.equal(leases.isValid(deviceAToken), false);
    assert.equal(leases.release(deviceAToken), false);
    assert.equal(leases.isValid(deviceBToken), true);
  }

  {
    const leases = new OperationLeaseManager();
    const otaIdentity = { deviceId: "device-a", sessionId: 30, operation: "ota" };
    const otaToken = leases.acquire(otaIdentity);
    assert.ok(otaToken);
    assert.equal(leases.isValidFor(otaToken, otaIdentity), true);
    assert.equal(
      leases.isValidFor(otaToken, { ...otaIdentity, operation: "control:start" }),
      false,
      "a token must not authorize a different operation",
    );
    assert.equal(
      leases.isValidFor(otaToken, { ...otaIdentity, deviceId: "device-b" }),
      false,
    );
    assert.equal(
      leases.isValidFor(otaToken, { ...otaIdentity, sessionId: 31 }),
      false,
    );
  }

  {
    const leases = new OperationLeaseManager();
    assert.throws(
      () => leases.acquire({ deviceId: "", sessionId: 1, operation: "ota" }),
      /device id must not be empty/,
    );
    assert.throws(
      () => leases.acquire({ deviceId: "device-a", sessionId: -1, operation: "ota" }),
      /session id must be/,
    );
    assert.throws(
      () => leases.acquire({ deviceId: "device-a", sessionId: 1, operation: " " }),
      /name must not be empty/,
    );
  }

  {
    const relayIdle = Promise.withResolvers();
    const busyEvents = [];
    let relayClears = 0;
    let currentSession = { deviceId: "device-a", sessionId: 40 };
    const coordinator = new OperationLeaseCoordinator({
      isSessionCurrent: (identity) => (
        identity.deviceId === currentSession.deviceId
        && identity.sessionId === currentSession.sessionId
      ),
      setBusy: (busy) => busyEvents.push(busy),
      transportBarrier: {
        clearPending: () => {
          relayClears += 1;
        },
        whenIdle: () => relayIdle.promise,
      },
    });
    const oldToken = coordinator.acquire({
      deviceId: "device-a",
      sessionId: 40,
      operation: "logs:read",
    });
    assert.ok(oldToken);
    assert.deepEqual(busyEvents, [true]);
    assert.equal(relayClears, 1);
    assert.equal(
      coordinator.acquire({
        deviceId: "device-a",
        sessionId: 40,
        operation: "settings:read",
      }),
      null,
      "coordinator admission must remain synchronous while relay drain is pending",
    );

    const published = [];
    let waitSettled = false;
    const staleWork = (async () => {
      const transportReady = await coordinator.waitForTransport(oldToken);
      waitSettled = true;
      if (transportReady && coordinator.isCurrent(oldToken)) {
        published.push("old-session");
      }
      coordinator.release(oldToken);
    })();
    await Promise.resolve();
    assert.equal(waitSettled, false, "foreground work must wait for an in-flight relay write");

    assert.equal(coordinator.invalidateSession("device-a", 40), true);
    currentSession = { deviceId: "device-a", sessionId: 41 };
    const replacementToken = coordinator.acquire({
      deviceId: "device-a",
      sessionId: 41,
      operation: "control:start",
    });
    assert.ok(replacementToken);
    assert.deepEqual(
      busyEvents,
      [true, true],
      "replacement admission must not depend on a stale React busy render",
    );

    relayIdle.resolve();
    await staleWork;
    assert.equal(waitSettled, true);
    assert.deepEqual(published, [], "invalidated work must not publish stale UI state");
    assert.equal(
      coordinator.release(oldToken),
      false,
      "stale finally must not release replacement work",
    );
    assert.deepEqual(
      busyEvents,
      [true, true],
      "stale finally must not clear replacement busy state",
    );
    assert.equal(coordinator.isCurrent(replacementToken), true);
    assert.equal(coordinator.release(replacementToken), true);
    assert.deepEqual(busyEvents, [true, true, false]);
  }

  {
    const busyEvents = [];
    const coordinator = new OperationLeaseCoordinator({
      isSessionCurrent: () => false,
      setBusy: (busy) => busyEvents.push(busy),
    });
    const transitionToken = coordinator.reserve({
      deviceId: "device-a",
      sessionId: 50,
      operation: "connection:connect",
    });
    assert.ok(transitionToken, "connection bootstrap must reserve before a session is committed");
    assert.equal(coordinator.isCurrent(transitionToken), false);
    assert.equal(
      coordinator.reserve({
        deviceId: "device-a",
        sessionId: 51,
        operation: "connection:connect",
      }),
      null,
      "a second connection transition must not overlap",
    );
    assert.equal(coordinator.release(transitionToken, true), true);
    assert.deepEqual(busyEvents, [true, false]);
  }

  {
    const busyEvents = [];
    const coordinator = new OperationLeaseCoordinator({
      isSessionCurrent: () => false,
      setBusy: (busy) => busyEvents.push(busy),
    });
    const staleTransition = coordinator.reserve({
      deviceId: "device-a",
      sessionId: 55,
      operation: "connection:connect",
    });
    assert.ok(staleTransition);
    let transitionOwner = staleTransition;
    coordinator.invalidateAll();
    transitionOwner = null;
    const replacement = coordinator.reserve({
      deviceId: "device-a",
      sessionId: 56,
      operation: "connection:connect",
    });
    assert.ok(
      replacement,
      "Bluetooth-loss tombstoning must allow a replacement transition without waiting for stale native work",
    );
    assert.equal(transitionOwner, null);
    assert.equal(coordinator.release(staleTransition), false);
    assert.equal(coordinator.isValid(replacement), true);
    assert.equal(coordinator.release(replacement, true), true);
    assert.deepEqual(busyEvents, [true, true, false]);
  }

  {
    let currentSession = { deviceId: "device-a", sessionId: 60 };
    const coordinator = new OperationLeaseCoordinator({
      isSessionCurrent: (identity) => (
        currentSession !== null
        && identity.deviceId === currentSession.deviceId
        && identity.sessionId === currentSession.sessionId
      ),
      setBusy: () => undefined,
    });
    const activeToken = coordinator.acquire({
      deviceId: "device-a",
      sessionId: 60,
      operation: "logs:clear",
    });
    assert.ok(activeToken);
    coordinator.invalidateAll();
    currentSession = null;
    assert.equal(
      coordinator.acquire({
        deviceId: "device-a",
        sessionId: 60,
        operation: "logs:clear",
      }),
      null,
      "a delayed callback must not acquire after lifecycle teardown",
    );
  }

  const appSource = readFileSync(resolve(root, "mobile/App.tsx"), "utf8");
  const appAst = ts.createSourceFile(
    "App.tsx",
    appSource,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  function functionNode(name) {
    let match = null;
    const visit = (node) => {
      if (
        !match
        && ts.isFunctionDeclaration(node)
        && node.name?.text === name
      ) {
        match = node;
        return;
      }
      ts.forEachChild(node, visit);
    };
    visit(appAst);
    assert.ok(match, `App.tsx must define ${name}`);
    return match;
  }

  function functionSource(name) {
    return functionNode(name).getText(appAst);
  }

  function assertSourceOrder(source, first, second, message) {
    const firstAt = source.indexOf(first);
    const secondAt = source.indexOf(second);
    assert.ok(firstAt >= 0, `${message}: missing ${first}`);
    assert.ok(secondAt >= 0, `${message}: missing ${second}`);
    assert.ok(firstAt < secondAt, message);
  }

  function hasFinallyCall(node, callText) {
    let found = false;
    const visit = (current) => {
      if (
        ts.isTryStatement(current)
        && current.finallyBlock?.getText(appAst).includes(callText)
      ) {
        found = true;
        return;
      }
      ts.forEachChild(current, visit);
    };
    visit(node);
    return found;
  }

  function assertExactScanAdmission(
    functionName,
    callbackGuard,
    timeoutGuard,
  ) {
    const source = functionSource(functionName);
    const previousStopAt = source.indexOf("await previousScanStop;");
    const permissionAt = source.indexOf("const allowed = await requestBlePermissions();");
    const liveStateAt = source.indexOf("const liveBleState = await manager.state();");
    const dispatchAt = source.indexOf("await manager.startDeviceScan");
    const scanStartedAt = source.indexOf("scanStarted = true;");
    const checkIndexes = [];
    let searchAt = 0;
    while (true) {
      const foundAt = source.indexOf("scanAdmissionRef.current !== admission", searchAt);
      if (foundAt < 0) break;
      checkIndexes.push(foundAt);
      searchAt = foundAt + 1;
    }
    assert.ok(
      previousStopAt >= 0
      && permissionAt > previousStopAt
      && liveStateAt > permissionAt
      && dispatchAt > liveStateAt
      && scanStartedAt > dispatchAt,
    );
    assert.ok(
      checkIndexes.some((index) => index > previousStopAt && index < permissionAt),
      `${functionName} must revalidate exact admission after awaiting native stop`,
    );
    assert.ok(
      checkIndexes.filter((index) => index > permissionAt && index < dispatchAt).length >= 2,
      `${functionName} must revalidate exact admission after permission and again immediately before dispatch`,
    );
    assert.ok(
      checkIndexes.some((index) => index > liveStateAt && index < dispatchAt),
      `${functionName} must revalidate exact admission after reading live Bluetooth state`,
    );
    assert.ok(
      checkIndexes.filter((index) => index > dispatchAt && index < scanStartedAt).length >= 2,
      `${functionName} must revalidate exact admission after awaited native start`,
    );
    assert.ok(
      source.includes(callbackGuard),
      `${functionName} native callback must reject stale admission`,
    );
    assert.ok(
      source.includes(timeoutGuard),
      `${functionName} timeout must reject stale admission`,
    );
    assert.equal(
      hasFinallyCall(functionNode(functionName), "scanAdmissionRef.current === admission"),
      true,
      `${functionName} early cleanup must release only its exact admission`,
    );
  }

  function nearestCallableName(node) {
    let current = node.parent;
    while (current) {
      if (ts.isFunctionDeclaration(current) && current.name) {
        return current.name.text;
      }
      if (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) {
        const parent = current.parent;
        if (
          (ts.isCallExpression(parent) || ts.isNewExpression(parent))
          && parent.expression.getText(appAst) === "LatestOnlyAsyncRelay"
        ) {
          return "oximetryRelayWorker";
        }
        if (
          ts.isVariableDeclaration(parent)
          && ts.isIdentifier(parent.name)
        ) {
          return parent.name.text;
        }
      }
      current = current.parent;
    }
    return "<module>";
  }

  const leasedFunctions = new Map([
    ["refreshSettings", ["\"settings:read\""]],
    ["saveSettings", ["\"settings:write\""]],
    ["loadLogsFromDevice", ["\"logs:read:manual\"", "\"logs:read:auto\""]],
    ["writeClearLogs", ["\"logs:clear\""]],
    ["clearMotorFault", ["\"motor-fault:clear\""]],
    ["readDriverParams", ["\"driver:read\""]],
    ["writeOtaCommand", ["\"ota:write\""]],
    ["sendControlCommand", ["`control:${command}`"]],
    ["writeCalibrationCommand", ["`calibration:${command}`"]],
  ]);

  for (const [name, operations] of leasedFunctions) {
    const node = functionNode(name);
    const source = node.getText(appAst);
    const acquireAt = source.indexOf("acquireForegroundBleLease(");
    const firstAwaitAt = source.indexOf("await ");
    assert.ok(acquireAt >= 0, `${name} must acquire a foreground BLE lease`);
    assert.ok(firstAwaitAt < 0 || acquireAt < firstAwaitAt, `${name} must acquire before its first await`);
    for (const operation of operations) {
      assert.ok(source.includes(operation), `${name} must bind operation ${operation}`);
    }
    assert.equal(
      hasFinallyCall(node, "releaseForegroundBleLease(lease)"),
      true,
      `${name} must release only its exact lease in finally`,
    );
    assert.equal(
      source.includes("setBusy(false)"),
      false,
      `${name} must not clear busy independently of token release`,
    );
  }

  const acquiredByFunctions = new Set();
  const transportCallers = new Set();
  const leaseRequiredHelpers = new Set(["loadSettings", "loadProtocol", "loadDriverParams"]);
  const leaseRequiredHelperCalls = new Map(
    [...leaseRequiredHelpers].map((name) => [name, 0]),
  );
  let directBusyTrueCalls = 0;
  const inspectApp = (node) => {
    if (ts.isCallExpression(node)) {
      const expression = node.expression.getText(appAst);
      if (expression === "acquireForegroundBleLease") {
        acquiredByFunctions.add(nearestCallableName(node));
      }
      if (["readUtf8", "writeUtf8", "readCsvTransfer"].includes(expression)) {
        transportCallers.add(nearestCallableName(node));
      }
      if (leaseRequiredHelpers.has(expression)) {
        assert.equal(
          node.arguments.length,
          3,
          `${expression} callers must pass device, session, and exact lease/transition`,
        );
        assert.notEqual(
          node.arguments[2].getText(appAst),
          "undefined",
          `${expression} callers must not opt out of exact lease/transition validation`,
        );
        leaseRequiredHelperCalls.set(
          expression,
          leaseRequiredHelperCalls.get(expression) + 1,
        );
      }
      if (expression === "readCsvTransfer") {
        assert.equal(
          node.arguments.length,
          3,
          "every App paged transfer must pass an exact current-operation callback",
        );
        assert.ok(
          node.arguments[2].getText(appAst).includes("isForegroundBleLeaseCurrent(lease)"),
          "every App paged transfer must bind its exact foreground lease",
        );
      }
      if (
        expression === "setBusy"
        && node.arguments.length === 1
        && node.arguments[0].kind === ts.SyntaxKind.TrueKeyword
      ) {
        directBusyTrueCalls += 1;
      }
    }
    ts.forEachChild(node, inspectApp);
  };
  inspectApp(appAst);
  for (const helper of leaseRequiredHelpers) {
    const declaration = functionNode(helper);
    assert.equal(
      declaration.parameters.length,
      3,
      `${helper} must require device, session, and lease/transition parameters`,
    );
    assert.equal(
      Boolean(declaration.parameters[2].questionToken || declaration.parameters[2].initializer),
      false,
      `${helper} must not make its lease/transition parameter optional`,
    );
    assert.ok(
      leaseRequiredHelperCalls.get(helper) > 0,
      `${helper} must remain exercised by a classified call path`,
    );
  }
  assert.deepEqual(
    [...acquiredByFunctions].sort(),
    [...leasedFunctions.keys()].sort(),
    "every current-session foreground lease caller must be classified by the regression gate",
  );
  assert.equal(
    directBusyTrueCalls,
    0,
    "App callbacks must acquire busy ownership through the coordinator instead of setting it directly",
  );
  assert.deepEqual(
    [...transportCallers].sort(),
    [
      "clearMotorFault",
      "confirmCalibrationCommandAvailableBeforeWrite",
      "confirmIdleNoCalibrationBeforeWrite",
      "confirmMotorFaultClearAvailableBeforeWrite",
      "loadDriverParams",
      "loadLogsFromDevice",
      "loadProtocol",
      "loadSettings",
      "oximetryRelayWorker",
      "refreshModeFaultFromDevice",
      "saveSettings",
      "sendControlCommand",
      "writeCalibrationCommand",
      "writeClearLogs",
      "writeOtaCommand",
    ].sort(),
    "every direct App BLE read/write caller must be classified before transport coverage can expand",
  );

  const otaPrompt = functionSource("sendOtaCommand");
  assert.ok(
    otaPrompt.includes("writeOtaCommand(writeDevice, sessionId, payload)"),
    "the OTA confirmation must retain its originating device, session, and payload",
  );
  assert.equal(
    otaPrompt.includes("writeOtaCommand()"),
    false,
    "the OTA confirmation must not select mutable connection state after confirmation",
  );

  const calibrationPrompt = functionSource("sendCalibrationCommand");
  assert.ok(
    calibrationPrompt.includes("writeCalibrationCommand(\"waterStart\", writeDevice, sessionId)"),
    "the water-column confirmation must retain its originating device and session",
  );
  assert.equal(
    calibrationPrompt.includes("writeCalibrationCommand(\"waterStart\")"),
    false,
    "the water-column confirmation must not select mutable connection state after confirmation",
  );

  const logClearPrompt = functionSource("clearLogs");
  assert.ok(
    logClearPrompt.includes("writeClearLogs(writeDevice, sessionId)"),
    "the log-clear confirmation must retain its originating device and session",
  );
  assert.equal(
    logClearPrompt.includes("writeClearLogs()"),
    false,
    "the log-clear confirmation must not select mutable connection state after confirmation",
  );

  const oximeterConnectSource = functionSource("connectOximeter");
  assertSourceOrder(
    oximeterConnectSource,
    "if (!manager || oximeterTransitionRef.current || connectionTransitionTokenRef.current) return;",
    "oximeterSessionIdRef.current = sessionId",
    "oximeter connect must reject a second transition before advancing its generation",
  );
  assertSourceOrder(
    oximeterConnectSource,
    "oximeterTransitionRef.current = transition",
    "await ",
    "oximeter connect must claim a non-reentrant transition before its first await",
  );
  assert.equal(
    hasFinallyCall(
      functionNode("connectOximeter"),
      "if (oximeterTransitionRef.current === transition) {\n        oximeterTransitionRef.current = null;",
    ),
    true,
    "oximeter connect must release only its exact transition owner",
  );
  const oximeterDisconnectSource = functionSource("disconnectOximeter");
  assertSourceOrder(
    oximeterDisconnectSource,
    "if (oximeterTransitionRef.current || connectionTransitionTokenRef.current) return;",
    "oximeterTransitionRef.current = transition",
    "oximeter disconnect must reject a second transition before claiming ownership",
  );
  assertSourceOrder(
    oximeterDisconnectSource,
    "oximeterTransitionRef.current = transition",
    "await ",
    "oximeter disconnect must claim a non-reentrant transition before cancellation",
  );
  assert.equal(
    oximeterDisconnectSource.includes("await oximetryRelayRef.current?.whenIdle()"),
    false,
    "oximeter disconnect must not wait on an independent target relay write",
  );
  assertSourceOrder(
    oximeterDisconnectSource,
    "void stopOximeterScan();",
    "await managerRef.current?.cancelDeviceConnection",
    "oximeter disconnect must synchronously revoke reconnect-scan admission before cancellation",
  );
  assertSourceOrder(
    functionSource("startOximeterScan"),
    "scanAdmissionRef.current = admission",
    "await requestBlePermissions()",
    "oximeter scanning must claim synchronous admission before its first await",
  );
  assertExactScanAdmission(
    "startOximeterScan",
    "manager.startDeviceScan([PLX_SERVICE_UUID], { allowDuplicates: false }, (error, device) => {\n        if (scanAdmissionRef.current !== admission) return;",
    "oximeterScanTimeoutRef.current = setTimeout(() => {\n        if (scanAdmissionRef.current !== admission) return;",
  );
  assert.ok(
    functionSource("startOximeterScan").includes("scanAdmissionRef.current?.kind === \"ozealis\"\n        ? stopScan()")
      && functionSource("startOximeterScan").includes("connectionTransitionTokenRef.current"),
    "oximeter scan admission must replace an Ozealis scan and reject connection transitions",
  );
  assert.ok(
    functionSource("startOximeterScan").includes("await manager.startDeviceScan")
      && functionSource("startOximeterScan").includes("void manager.stopDeviceScan().catch(() => undefined)")
      && functionSource("startOximeterScan").includes("uuid.toLowerCase() === PLX_SERVICE_UUID"),
    "oximeter scan must await native start, handle rejected cleanup, and reject cross-service queued events",
  );
  assert.ok(
    (appSource.match(/disabled=\{oximeterScanning \|\| oximeterTransitionBusy \|\| connectionTransitionBusy \|\| busy\}/g) || []).length >= 2,
    "oximeter pair and reconnect controls must remain disabled through the exact source transition",
  );
  assert.ok(
    appSource.includes("disabled={!oximeterDevice || oximeterTransitionBusy || connectionTransitionBusy || busy}"),
    "oximeter disconnect must remain disabled through the exact source transition",
  );

  const connectSource = functionSource("connect");
  assertSourceOrder(
    connectSource,
    "if (connectionTransitionTokenRef.current) return;",
    "deviceSessionIdRef.current = sessionId",
    "connect must reject a second transition before advancing its generation",
  );
  assertSourceOrder(
    connectSource,
    "foregroundBleCoordinatorRef.current!.invalidateAll()",
    "await ",
    "a new connection generation must synchronously revoke previous foreground work",
  );
  assertSourceOrder(
    connectSource,
    "connectedDeviceRef.current = null",
    "await ",
    "connect must synchronously close the previous committed-session identity",
  );
  assertSourceOrder(
    connectSource,
    "reserveConnectionTransition(\"connection:connect\"",
    "await ",
    "connect must reserve exact transition ownership before its first await",
  );
  assert.equal(
    hasFinallyCall(functionNode("connect"), "releaseConnectionTransition(transition)"),
    true,
    "connect must release busy ownership only from its exact transition finally",
  );
  assert.ok(
    connectSource.includes("loadProtocol(discovered, sessionId, transition)")
      && connectSource.includes("loadSettings(discovered, sessionId, transition)")
      && connectSource.includes("loadDriverParams(discovered, sessionId, transition)"),
    "connection bootstrap reads must remain inside the exact transition lease",
  );
  const disconnectSource = functionSource("disconnect");
  assertSourceOrder(
    disconnectSource,
    "if (connectionTransitionTokenRef.current) return;",
    "foregroundBleCoordinatorRef.current!.invalidateSession(deviceId, sessionId)",
    "disconnect must reject a second transition before invalidating foreground work",
  );
  assertSourceOrder(
    disconnectSource,
    "foregroundBleCoordinatorRef.current!.invalidateSession(deviceId, sessionId)",
    "await ",
    "disconnect must synchronously revoke the captured session before transport cleanup",
  );
  assertSourceOrder(
    disconnectSource,
    "reserveConnectionTransition(\"connection:disconnect\", disconnectDevice, sessionId)",
    "await ",
    "disconnect must claim a non-reentrant exact transition owner before transport cleanup",
  );
  assertSourceOrder(
    disconnectSource,
    "connectedDeviceRef.current = null",
    "await ",
    "disconnect must make the captured session unavailable before its first await",
  );
  assert.equal(
    disconnectSource.includes("await oximetryRelayRef.current?.whenIdle()"),
    false,
    "disconnect must not wait on the relay before cancelling the target connection",
  );
  assert.equal(
    hasFinallyCall(functionNode("disconnect"), "releaseConnectionTransition(transition)"),
    true,
    "disconnect must release only its exact transition owner",
  );
  assertSourceOrder(
    disconnectSource,
    "void stopOximeterScan();",
    "await managerRef.current?.cancelDeviceConnection",
    "Ozealis disconnect must synchronously revoke an active oximeter scan before cancellation",
  );
  assertSourceOrder(
    functionSource("startScan"),
    "scanAdmissionRef.current = admission",
    "await requestBlePermissions()",
    "Ozealis scanning must claim synchronous admission before its first await",
  );
  assertExactScanAdmission(
    "startScan",
    "manager.startDeviceScan([OZEALIS_SERVICE_UUID], { allowDuplicates: false }, (error, device) => {\n        if (scanAdmissionRef.current !== admission) return;",
    "scanTimeoutRef.current = setTimeout(() => {\n        if (scanAdmissionRef.current === admission) stopScan();",
  );
  assert.ok(
    functionSource("startScan").includes("scanAdmissionRef.current?.kind === \"oximeter\"\n        ? stopOximeterScan()")
      && functionSource("startScan").includes("oximeterTransitionRef.current"),
    "Ozealis scan admission must replace an oximeter scan and reject source transitions",
  );
  assert.ok(
    functionSource("startScan").includes("await manager.startDeviceScan")
      && functionSource("startScan").includes("void manager.stopDeviceScan().catch(() => undefined)"),
    "Ozealis scan must await native start and handle rejected or stale native cleanup",
  );
  assert.ok(
    (appSource.match(/disabled=\{scanning \|\| connectionTransitionBusy \|\| oximeterTransitionBusy \|\| busy\}/g) || []).length >= 3,
    "Ozealis scan and pair controls must remain disabled through the exact connection transition",
  );
  assert.ok(
    functionSource("resetDeviceSessionState").includes("foregroundBleCoordinatorRef.current!.invalidateAll()"),
    "every connected-session reset must invalidate outstanding foreground work",
  );
  assert.ok(
    functionSource("resetDeviceSessionState").includes(
      "const nextSessionId = advanceSessionGeneration(deviceSessionIdRef.current, expectedSessionId)",
    )
      && functionSource("resetDeviceSessionState").includes("deviceSessionIdRef.current = nextSessionId"),
    "a completed connected-session reset must advance the generation",
  );
  assert.ok(
    appSource.includes("const transitionSessionId = connectionTransition?.identity.sessionId;")
      && appSource.includes("if (resetDeviceSessionState(resetSessionId)) flushLiveSyncCsv();"),
    "Bluetooth loss must reset the captured transition generation only once",
  );
  assert.ok(
    appSource.includes(
      "if (connectionTransitionTokenRef.current === connectionTransition) {\n          connectionTransitionTokenRef.current = null;\n          setConnectionTransitionBusy(false);",
    )
      && appSource.includes(
        "if (oximeterTransitionRef.current === oximeterTransition) {\n          oximeterTransitionRef.current = null;\n          setOximeterTransitionBusy(false);",
      ),
    "Bluetooth loss must tombstone exact connection and source transition admission for recovery",
  );
  const staleConnectionCleanupSource = functionSource("cancelConnectionCandidateUnlessReplaced");
  assert.ok(
    staleConnectionCleanupSource.includes("activeTransition?.deviceId === candidateDeviceId")
      && staleConnectionCleanupSource.includes("activeTransition.sessionId !== ownerSessionId")
      && staleConnectionCleanupSource.includes("connectedDeviceRef.current?.id === candidateDeviceId")
      && staleConnectionCleanupSource.includes("deviceSessionIdRef.current !== ownerSessionId"),
    "stale Ozealis cleanup must not cancel an in-flight or committed same-device replacement",
  );
  const staleOximeterCleanupSource = functionSource("cancelOximeterCandidateUnlessReplaced");
  assert.ok(
    staleOximeterCleanupSource.includes("activeTransition?.deviceId === candidateDeviceId")
      && staleOximeterCleanupSource.includes("activeTransition.sessionId !== ownerSessionId")
      && staleOximeterCleanupSource.includes("oximeterDeviceRef.current?.id === candidateDeviceId")
      && staleOximeterCleanupSource.includes("oximeterSessionIdRef.current !== ownerSessionId"),
    "stale oximeter cleanup must not cancel an in-flight or committed same-device replacement",
  );
  assert.ok(
    (connectSource.match(/cancelConnectionCandidateUnlessReplaced\(/g) || []).length >= 8,
    "every Ozealis connection candidate cleanup path must protect replacement ownership",
  );
  assert.ok(
    (oximeterConnectSource.match(/cancelOximeterCandidateUnlessReplaced\(/g) || []).length >= 3,
    "every oximeter connection candidate cleanup path must protect replacement ownership",
  );
  assert.ok(
    (appSource.match(/invalidateDeviceSessionLifecycle\(\);/g) || []).length >= 2,
    "both preview and native app teardown must close the connected-session identity",
  );
  const lifecycleSource = functionSource("invalidateDeviceSessionLifecycle");
  assert.ok(
    lifecycleSource.includes("foregroundBleCoordinatorRef.current?.invalidateAll()")
      && lifecycleSource.includes("connectedDeviceRef.current = null")
      && lifecycleSource.includes("connectionTransitionTokenRef.current = null")
      && lifecycleSource.includes("deviceSessionIdRef.current = nextSessionId"),
    "lifecycle teardown must revoke active work and synchronously tombstone the session identity",
  );
  assert.ok(
    appSource.includes("if (foregroundBleCoordinatorRef.current?.activeIdentity()) return;"),
    "the low-priority oximetry relay must drop while foreground BLE work owns the transport",
  );
  assert.ok(
    appSource.includes("clearPending: () => oximetryRelayRef.current?.clearPending()"),
    "the coordinator barrier must discard lower-priority queued relay work",
  );
  assert.ok(
    functionSource("waitForForegroundBleTransport").includes(".waitForTransport(lease.token)"),
    "foreground BLE work must wait for an already-dispatched relay write to drain",
  );
  assertSourceOrder(
    functionSource("sendControlCommand"),
    "beforeDispatch?.();",
    "await writeUtf8(",
    "scheduled prewarm may stamp its run only immediately before leased transport dispatch",
  );
  assert.equal(
    appSource.includes("setPrewarmSchedule(markPrewarmScheduleRun(prewarmSchedule, now))"),
    false,
    "scheduled prewarm must not consume the minute before lease admission and fresh guards",
  );
  assert.equal(
    appSource.includes("isCurrentConnectedDevice"),
    false,
    "foreground BLE work must not fall back to device-object-only lifetime checks",
  );

  console.log("Mobile operation lease tests passed.");
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
