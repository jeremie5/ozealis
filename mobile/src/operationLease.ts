export type OperationSessionId = number | string;

export type OperationLeaseIdentity<Operation extends string = string> = Readonly<{
  deviceId: string;
  sessionId: OperationSessionId;
  operation: Operation;
}>;

export type OperationLeaseToken<Operation extends string = string> = Readonly<{
  identity: OperationLeaseIdentity<Operation>;
}>;

export type OperationLeaseTransportBarrier = Readonly<{
  clearPending: () => void;
  whenIdle: () => Promise<void>;
}>;

export type OperationLeaseCoordinatorOptions = Readonly<{
  isSessionCurrent: (identity: OperationLeaseIdentity) => boolean;
  setBusy: (busy: boolean) => void;
  transportBarrier?: OperationLeaseTransportBarrier;
}>;

function isValidSessionId(sessionId: OperationSessionId): boolean {
  if (typeof sessionId === "number") {
    return Number.isSafeInteger(sessionId) && sessionId >= 0;
  }
  return sessionId.trim().length > 0;
}

function validateIdentity(identity: OperationLeaseIdentity): void {
  if (identity.deviceId.trim().length === 0) {
    throw new Error("Operation lease device id must not be empty.");
  }
  if (!isValidSessionId(identity.sessionId)) {
    throw new Error("Operation lease session id must be a non-negative integer or non-empty string.");
  }
  if (identity.operation.trim().length === 0) {
    throw new Error("Operation lease name must not be empty.");
  }
}

export function advanceSessionGeneration(
  currentSessionId: number,
  expectedSessionId: number,
): number | null {
  if (currentSessionId !== expectedSessionId) return null;
  if (
    !Number.isSafeInteger(currentSessionId)
    || currentSessionId < 0
    || currentSessionId === Number.MAX_SAFE_INTEGER
  ) {
    throw new Error("Session generation must be an incrementable non-negative safe integer.");
  }
  return currentSessionId + 1;
}

function hasIdentity(
  token: OperationLeaseToken,
  identity: OperationLeaseIdentity,
): boolean {
  return token.identity.deviceId === identity.deviceId
    && token.identity.sessionId === identity.sessionId
    && token.identity.operation === identity.operation;
}

/**
 * Serializes sensitive mobile operations without introducing an async gap
 * between checking availability and claiming it.
 *
 * A token remains usable only while it is the manager's exact active token.
 * Call `isValid` or `isValidFor` after every awaited boundary, and release the
 * token in `finally`. Invalidated and released tokens can never release a
 * replacement operation.
 */
export class OperationLeaseManager {
  private activeToken: OperationLeaseToken | null = null;

  acquire<Operation extends string>(
    identity: OperationLeaseIdentity<Operation>,
  ): OperationLeaseToken<Operation> | null {
    validateIdentity(identity);
    if (this.activeToken) return null;

    const token = Object.freeze({
      identity: Object.freeze({
        deviceId: identity.deviceId,
        sessionId: identity.sessionId,
        operation: identity.operation,
      }),
    });
    this.activeToken = token;
    return token;
  }

  isValid<Operation extends string>(
    token: OperationLeaseToken<Operation> | null | undefined,
  ): token is OperationLeaseToken<Operation> {
    return token !== null && token !== undefined && this.activeToken === token;
  }

  isValidFor(
    token: OperationLeaseToken | null | undefined,
    identity: OperationLeaseIdentity,
  ): boolean {
    return this.isValid(token) && hasIdentity(token, identity);
  }

  release(token: OperationLeaseToken | null | undefined): boolean {
    if (!this.isValid(token)) return false;
    this.activeToken = null;
    return true;
  }

  invalidateSession(deviceId: string, sessionId: OperationSessionId): boolean {
    if (
      !this.activeToken
      || this.activeToken.identity.deviceId !== deviceId
      || this.activeToken.identity.sessionId !== sessionId
    ) {
      return false;
    }
    this.activeToken = null;
    return true;
  }

  invalidateDevice(deviceId: string): boolean {
    if (!this.activeToken || this.activeToken.identity.deviceId !== deviceId) {
      return false;
    }
    this.activeToken = null;
    return true;
  }

  invalidateAll(): boolean {
    if (!this.activeToken) return false;
    this.activeToken = null;
    return true;
  }

  activeIdentity(): OperationLeaseIdentity | null {
    return this.activeToken?.identity ?? null;
  }
}

/**
 * Owns the synchronous UI/transport side effects around an operation lease.
 *
 * `acquire` is for work against an already committed connected session.
 * `reserve` is for connection transitions that establish or tear down that
 * session. Both paths share one manager, so transition work and foreground
 * reads/writes cannot overlap.
 */
export class OperationLeaseCoordinator<Operation extends string = string> {
  private readonly leases = new OperationLeaseManager();

  constructor(private readonly options: OperationLeaseCoordinatorOptions) {}

  acquire(
    identity: OperationLeaseIdentity<Operation>,
  ): OperationLeaseToken<Operation> | null {
    if (!this.options.isSessionCurrent(identity)) return null;
    return this.reserve(identity);
  }

  reserve(
    identity: OperationLeaseIdentity<Operation>,
  ): OperationLeaseToken<Operation> | null {
    const token = this.leases.acquire(identity);
    if (!token) return null;
    try {
      this.options.transportBarrier?.clearPending();
      this.options.setBusy(true);
      return token;
    } catch (error) {
      this.leases.release(token);
      throw error;
    }
  }

  isValid(
    token: OperationLeaseToken<Operation> | null | undefined,
  ): token is OperationLeaseToken<Operation> {
    return this.leases.isValid(token);
  }

  isCurrent(
    token: OperationLeaseToken<Operation> | null | undefined,
  ): token is OperationLeaseToken<Operation> {
    return this.leases.isValid(token)
      && this.options.isSessionCurrent(token.identity);
  }

  async waitForTransport(
    token: OperationLeaseToken<Operation>,
  ): Promise<boolean> {
    if (!this.isCurrent(token)) return false;
    await this.options.transportBarrier?.whenIdle();
    return this.isCurrent(token);
  }

  release(
    token: OperationLeaseToken<Operation> | null | undefined,
    canClearBusy?: boolean,
  ): boolean {
    const sessionCurrent =
      canClearBusy
      ?? Boolean(token && this.options.isSessionCurrent(token.identity));
    const released = this.leases.release(token);
    if (released && sessionCurrent) this.options.setBusy(false);
    return released;
  }

  invalidateSession(deviceId: string, sessionId: OperationSessionId): boolean {
    return this.leases.invalidateSession(deviceId, sessionId);
  }

  invalidateDevice(deviceId: string): boolean {
    return this.leases.invalidateDevice(deviceId);
  }

  invalidateAll(): boolean {
    return this.leases.invalidateAll();
  }

  activeIdentity(): OperationLeaseIdentity | null {
    return this.leases.activeIdentity();
  }
}
