import { timingSafeEqual } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { atomicWriteFile } from './community-node';
import { withExclusiveFileLock } from './file-lock';
import type {
  ClaimPushAttemptsInput,
  CompletePushAttemptInput,
  EncryptedPushProviderToken,
  EnqueuePushAttemptInput,
  InvalidatePushProviderTokenInput,
  MintPushCapabilityInput,
  PushAttemptCursor,
  PushAttemptEnqueueResult,
  PushAttemptPage,
  PushAttemptPruneInput,
  PushAttemptPruneResult,
  PushAttemptRecord,
  PushAttemptState,
  PushAttemptStats,
  PushAttemptStatus,
  PushAttemptStore,
  PushCapabilityRecord,
  PushCapabilityResolution,
  PushCapabilityScope,
  PushFencedAttemptResult,
  PushIdempotentMutationResult,
  PushProvider,
  PushProviderTokenRecord,
  PushProviderTokenSummary,
  PushRegistrationCursor,
  PushRegistrationPage,
  PushRegistrationPruneInput,
  PushRegistrationPruneResult,
  PushRegistrationRecord,
  PushRegistrationStats,
  PushRegistrationStore,
  PushTokenInvalidationResult,
  RegisterPushInstallationInput,
  RenewPushAttemptInput,
  RevokePushCapabilityInput,
  RevokePushRegistrationInput,
  RotatePushProviderTokenInput,
} from './push-store';

const HASH = /^[a-f0-9]{64}$/u;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u;
const SAFE_KEY = /^[A-Za-z0-9_.:@/-]{1,256}$/u;
const SAFE_CODE = /^[a-z][a-z0-9_.:-]{0,127}$/u;
const PROVIDERS = new Set<PushProvider>(['apns', 'fcm', 'webpush']);
const SCOPES = new Set<PushCapabilityScope>(['sync_wake', 'call_wake']);
const ATTEMPT_STATES = new Set<PushAttemptState>([
  'queued',
  'leased',
  'succeeded',
  'retryable',
  'failed',
  'cancelled',
]);
const INVALIDATION_REASONS = new Set([
  'invalid_token',
  'unregistered',
  'token_expired',
  'provider_rejected',
]);
const MAX_LEASE_MS = 24 * 60 * 60 * 1000;
const MAX_OVERLAP_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_IDEMPOTENCY_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_TOKEN_CIPHERTEXT_BYTES = 16 * 1024;

interface SerializedEncryptedToken {
  ciphertextBase64: string;
  keyVersion: number;
}

interface SerializedPushProviderTokenRecord
  extends Omit<PushProviderTokenRecord, 'encryptedToken'> {
  encryptedToken: SerializedEncryptedToken;
}

interface StoredRegistration {
  registrationSecretHash: string;
  record: Omit<PushRegistrationRecord, 'tokenGenerations'>;
  tokens: SerializedPushProviderTokenRecord[];
}

interface StoredCapability extends PushCapabilityRecord {}

interface StoredIdempotency<Value = unknown> {
  requestDigestHex: string;
  expiresAtMs: number;
  value: Value;
}

interface RegistrationFileState {
  version: 1;
  registrations: Record<string, StoredRegistration>;
  capabilities: Record<string, StoredCapability>;
  idempotency: Record<string, StoredIdempotency>;
}

interface AttemptFileState {
  version: 1;
  attempts: Record<string, PushAttemptRecord>;
  idempotency: Record<string, StoredIdempotency<{ attemptId: string }>>;
}

function emptyRegistrationState(): RegistrationFileState {
  return { version: 1, registrations: {}, capabilities: {}, idempotency: {} };
}

function emptyAttemptState(): AttemptFileState {
  return { version: 1, attempts: {}, idempotency: {} };
}

async function readState<State extends { version: 1 }>(
  file: string,
  empty: () => State,
  requiredMaps: readonly string[],
): Promise<State> {
  let raw: string;
  try {
    raw = await fs.readFile(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return empty();
    throw error;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (error) {
    throw new Error(`Push store state is corrupt: ${path.basename(file)}`, { cause: error });
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)
    || (parsed as { version?: unknown }).version !== 1
    || requiredMaps.some((key) => {
      const value = (parsed as Record<string, unknown>)[key];
      return !value || typeof value !== 'object' || Array.isArray(value);
    })) {
    throw new Error(`Push store state has an invalid shape: ${path.basename(file)}`);
  }
  return parsed as State;
}

function assertHash(label: string, value: string): void {
  if (!HASH.test(value)) throw new TypeError(`${label} must be a lowercase SHA-256 hash`);
}

function assertUuid(label: string, value: string): void {
  if (!UUID.test(value)) throw new TypeError(`${label} must be a canonical UUID`);
}

function assertTime(label: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a non-negative safe integer timestamp`);
  }
}

function assertPositiveInteger(label: string, value: number, maximum: number): void {
  if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) {
    throw new TypeError(`${label} must be an integer between 1 and ${maximum}`);
  }
}

function assertFuture(label: string, value: number, nowMs: number): void {
  assertTime(label, value);
  if (value <= nowMs) throw new RangeError(`${label} must be in the future`);
}

function timestampMs(value: string, label: string): number {
  const parsed = Date.parse(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`Invalid ${label}`);
  return parsed;
}

function iso(value: number): string {
  assertTime('timestamp', value);
  return new Date(value).toISOString();
}

function assertProvider(provider: PushProvider): void {
  if (!PROVIDERS.has(provider)) throw new TypeError('Push provider is invalid');
}

function assertScope(scope: PushCapabilityScope): void {
  if (!SCOPES.has(scope)) throw new TypeError('Push capability scope is invalid');
}

function assertCiphertext(token: EncryptedPushProviderToken): void {
  if (!(token.ciphertext instanceof Uint8Array)
    || token.ciphertext.byteLength === 0
    || token.ciphertext.byteLength > MAX_TOKEN_CIPHERTEXT_BYTES) {
    throw new TypeError('Encrypted push token ciphertext is invalid');
  }
  assertPositiveInteger('Encrypted push token keyVersion', token.keyVersion, 2_147_483_647);
}

function serializeEncryptedToken(token: EncryptedPushProviderToken): SerializedEncryptedToken {
  assertCiphertext(token);
  return {
    ciphertextBase64: Buffer.from(token.ciphertext).toString('base64url'),
    keyVersion: token.keyVersion,
  };
}

function deserializeEncryptedToken(token: SerializedEncryptedToken): EncryptedPushProviderToken {
  if (!token || typeof token.ciphertextBase64 !== 'string') {
    throw new Error('Stored push token ciphertext is invalid');
  }
  const ciphertext = new Uint8Array(Buffer.from(token.ciphertextBase64, 'base64url'));
  const decryptedShape = { ciphertext, keyVersion: token.keyVersion };
  assertCiphertext(decryptedShape);
  return decryptedShape;
}

function serializeToken(record: PushProviderTokenRecord): SerializedPushProviderTokenRecord {
  return {
    ...record,
    encryptedToken: serializeEncryptedToken(record.encryptedToken),
  };
}

function deserializeToken(record: SerializedPushProviderTokenRecord): PushProviderTokenRecord {
  return {
    ...structuredClone(record),
    encryptedToken: deserializeEncryptedToken(record.encryptedToken),
  };
}

function tokenSummary(record: SerializedPushProviderTokenRecord): PushProviderTokenSummary {
  const summary = structuredClone(record) as Partial<SerializedPushProviderTokenRecord>;
  delete summary.encryptedToken;
  return summary as PushProviderTokenSummary;
}

function registrationRecord(stored: StoredRegistration): PushRegistrationRecord {
  return {
    ...structuredClone(stored.record),
    tokenGenerations: [...stored.tokens]
      .sort((left, right) => right.tokenGeneration - left.tokenGeneration)
      .map(tokenSummary),
  };
}

function hashesEqual(left: string, right: string): boolean {
  assertHash('Stored secret hash', left);
  assertHash('Provided secret hash', right);
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

function assertIdempotency(input: {
  idempotencyKey: string;
  requestDigestHex: string;
  idempotencyExpiresAtMs: number;
  nowMs: number;
}): void {
  assertHash('Idempotency key', input.idempotencyKey);
  assertHash('Request digest', input.requestDigestHex);
  assertTime('Request time', input.nowMs);
  assertFuture('Idempotency expiry', input.idempotencyExpiresAtMs, input.nowMs);
  if (input.idempotencyExpiresAtMs - input.nowMs > MAX_IDEMPOTENCY_MS) {
    throw new RangeError('Idempotency expiry exceeds 90 days');
  }
}

function idempotencyLookup<Value>(
  state: { idempotency: Record<string, StoredIdempotency> },
  scope: string,
  input: { idempotencyKey: string; requestDigestHex: string; nowMs: number },
): { status: 'miss' } | { status: 'conflict' } | { status: 'replay'; value: Value } {
  const key = `${scope}:${input.idempotencyKey}`;
  const stored = state.idempotency[key];
  if (!stored || stored.expiresAtMs <= input.nowMs) {
    if (stored) delete state.idempotency[key];
    return { status: 'miss' };
  }
  return stored.requestDigestHex === input.requestDigestHex
    ? { status: 'replay', value: structuredClone(stored.value) as Value }
    : { status: 'conflict' };
}

function rememberIdempotency<Value>(
  state: { idempotency: Record<string, StoredIdempotency> },
  scope: string,
  input: {
    idempotencyKey: string;
    requestDigestHex: string;
    idempotencyExpiresAtMs: number;
  },
  value: Value,
): void {
  state.idempotency[`${scope}:${input.idempotencyKey}`] = {
    requestDigestHex: input.requestDigestHex,
    expiresAtMs: input.idempotencyExpiresAtMs,
    value: structuredClone(value),
  };
}

function registrationIsActive(stored: StoredRegistration, nowMs: number): boolean {
  return !stored.record.revokedAt && timestampMs(stored.record.expiresAt, 'registration expiry') > nowMs;
}

function capabilityIsActive(capability: StoredCapability, nowMs: number): boolean {
  return !capability.revokedAt && timestampMs(capability.expiresAt, 'capability expiry') > nowMs;
}

function tokenIsDeliverable(token: SerializedPushProviderTokenRecord, nowMs: number): boolean {
  const unexpired = timestampMs(token.expiresAt, 'token expiry') > nowMs;
  return unexpired && (token.state === 'active'
    || (token.state === 'retiring'
      && token.retireAfter !== undefined
      && timestampMs(token.retireAfter, 'token retirement') > nowMs));
}

function attemptAddressIsDeliverable(
  registrations: RegistrationFileState,
  attempt: PushAttemptRecord,
  nowMs: number,
): boolean {
  const capability = registrations.capabilities[attempt.capabilityHash];
  if (!capability || !capabilityIsActive(capability, nowMs)) return false;
  const registration = registrations.registrations[capability.registrationIdHash];
  if (!registration
    || !registrationIsActive(registration, nowMs)
    || registration.record.provider !== attempt.provider) return false;
  const token = registration.tokens.find((candidate) =>
    candidate.tokenGeneration === attempt.tokenGeneration);
  return token !== undefined && tokenIsDeliverable(token, nowMs);
}

function cancelAttemptRecord(
  attempt: PushAttemptRecord,
  reasonCode: string,
  nowMs: number,
): boolean {
  if (attemptIsTerminal(attempt.state)) return false;
  attempt.state = 'cancelled';
  attempt.providerStatus = 'unknown';
  attempt.providerReference = undefined;
  attempt.lastErrorCode = reasonCode;
  attempt.leaseOwner = undefined;
  attempt.leasedUntil = undefined;
  attempt.completedAt = iso(nowMs);
  attempt.updatedAt = iso(nowMs);
  attempt.fencingToken += 1;
  attempt.lifecycleVersion += 1;
  return true;
}

function cancelStoredAttempts(
  state: AttemptFileState,
  predicate: (attempt: PushAttemptRecord) => boolean,
  reasonCode: string,
  nowMs: number,
): number {
  let cancelled = 0;
  for (const attempt of Object.values(state.attempts)) {
    if (predicate(attempt) && cancelAttemptRecord(attempt, reasonCode, nowMs)) cancelled += 1;
  }
  return cancelled;
}

/** Crash-safe, single-node self-host registration and capability store. */
export class FilePushRegistrationStore implements PushRegistrationStore {
  private readonly stateFile: string;
  private readonly lockFile: string;
  private readonly attemptStateFile: string;
  private readonly attemptLockFile: string;

  constructor(baseDir: string) {
    this.stateFile = path.join(baseDir, 'push-registrations.json');
    this.lockFile = path.join(baseDir, '.push-registrations.lock');
    this.attemptStateFile = path.join(baseDir, 'push-attempts.json');
    this.attemptLockFile = path.join(baseDir, '.push-attempts.lock');
  }

  private read(): Promise<RegistrationFileState> {
    return readState(
      this.stateFile,
      emptyRegistrationState,
      ['registrations', 'capabilities', 'idempotency'],
    );
  }

  private write(state: RegistrationFileState): Promise<void> {
    return atomicWriteFile(this.stateFile, JSON.stringify(state));
  }

  private readAttempts(): Promise<AttemptFileState> {
    return readState(this.attemptStateFile, emptyAttemptState, ['attempts', 'idempotency']);
  }

  private writeAttempts(state: AttemptFileState): Promise<void> {
    return atomicWriteFile(this.attemptStateFile, JSON.stringify(state));
  }

  register(
    input: RegisterPushInstallationInput,
  ): Promise<PushIdempotentMutationResult<PushRegistrationRecord>> {
    assertIdempotency(input);
    assertHash('Registration id hash', input.registrationIdHash);
    assertHash('Registration secret hash', input.registrationSecretHash);
    assertProvider(input.provider);
    assertCiphertext(input.encryptedToken);
    if (input.tokenGeneration !== 1) throw new TypeError('Initial token generation must be 1');
    assertFuture('Token expiry', input.tokenExpiresAtMs, input.nowMs);
    assertFuture('Registration expiry', input.registrationExpiresAtMs, input.nowMs);

    return withExclusiveFileLock(this.lockFile, async () => {
      const state = await this.read();
      const replay = idempotencyLookup<PushRegistrationRecord>(state, 'register', input);
      if (replay.status === 'conflict') return { status: 'conflict' };
      if (replay.status === 'replay') return { status: 'replay', value: replay.value };
      if (state.registrations[input.registrationIdHash]) return { status: 'conflict' };

      const now = iso(input.nowMs);
      const token: PushProviderTokenRecord = {
        registrationIdHash: input.registrationIdHash,
        provider: input.provider,
        tokenGeneration: 1,
        encryptedToken: structuredClone(input.encryptedToken),
        state: 'active',
        expiresAt: iso(input.tokenExpiresAtMs),
        createdAt: now,
        updatedAt: now,
        lifecycleVersion: 1,
      };
      const stored: StoredRegistration = {
        registrationSecretHash: input.registrationSecretHash,
        record: {
          registrationIdHash: input.registrationIdHash,
          provider: input.provider,
          expiresAt: iso(input.registrationExpiresAtMs),
          createdAt: now,
          updatedAt: now,
          lifecycleVersion: 1,
        },
        tokens: [serializeToken(token)],
      };
      state.registrations[input.registrationIdHash] = stored;
      const value = registrationRecord(stored);
      rememberIdempotency(state, 'register', input, value);
      await this.write(state);
      return { status: 'applied', value };
    });
  }

  rotateToken(
    input: RotatePushProviderTokenInput,
  ): Promise<PushIdempotentMutationResult<PushRegistrationRecord>> {
    assertIdempotency(input);
    assertHash('Registration id hash', input.registrationIdHash);
    assertHash('Registration secret hash', input.registrationSecretHash);
    assertCiphertext(input.encryptedToken);
    assertPositiveInteger('Token generation', input.tokenGeneration, Number.MAX_SAFE_INTEGER);
    assertFuture('Token expiry', input.tokenExpiresAtMs, input.nowMs);
    assertPositiveInteger('Token overlap', input.overlapMs, MAX_OVERLAP_MS);

    return withExclusiveFileLock(this.lockFile, async () => {
      const state = await this.read();
      const stored = state.registrations[input.registrationIdHash];
      if (!stored) return { status: 'not_found' };
      if (!hashesEqual(stored.registrationSecretHash, input.registrationSecretHash)) {
        return { status: 'unauthorized' };
      }
      const scope = `rotate:${input.registrationIdHash}`;
      const replay = idempotencyLookup<PushRegistrationRecord>(state, scope, input);
      if (replay.status === 'conflict') return { status: 'conflict' };
      if (replay.status === 'replay') return { status: 'replay', value: replay.value };
      if (!registrationIsActive(stored, input.nowMs)) return { status: 'not_found' };

      const highestGeneration = stored.tokens.reduce(
        (maximum, token) => Math.max(maximum, token.tokenGeneration),
        0,
      );
      if (input.tokenGeneration !== highestGeneration + 1) return { status: 'conflict' };
      const now = iso(input.nowMs);
      for (const token of stored.tokens) {
        if (token.state !== 'active') continue;
        token.state = 'retiring';
        token.retireAfter = iso(Math.min(
          timestampMs(token.expiresAt, 'token expiry'),
          input.nowMs + input.overlapMs,
        ));
        token.updatedAt = now;
        token.lifecycleVersion += 1;
      }
      stored.tokens.push(serializeToken({
        registrationIdHash: input.registrationIdHash,
        provider: stored.record.provider,
        tokenGeneration: input.tokenGeneration,
        encryptedToken: structuredClone(input.encryptedToken),
        state: 'active',
        expiresAt: iso(input.tokenExpiresAtMs),
        createdAt: now,
        updatedAt: now,
        lifecycleVersion: 1,
      }));
      stored.record.expiresAt = iso(Math.max(
        timestampMs(stored.record.expiresAt, 'registration expiry'),
        input.tokenExpiresAtMs,
      ));
      stored.record.updatedAt = now;
      stored.record.lifecycleVersion += 1;
      const value = registrationRecord(stored);
      rememberIdempotency(state, scope, input, value);
      await this.write(state);
      return { status: 'applied', value };
    });
  }

  revokeRegistration(
    input: RevokePushRegistrationInput,
  ): Promise<PushIdempotentMutationResult<PushRegistrationRecord>> {
    assertIdempotency(input);
    assertHash('Registration id hash', input.registrationIdHash);
    assertHash('Registration secret hash', input.registrationSecretHash);

    return withExclusiveFileLock(this.lockFile, async () => {
      const state = await this.read();
      const stored = state.registrations[input.registrationIdHash];
      if (!stored) return { status: 'not_found' };
      if (!hashesEqual(stored.registrationSecretHash, input.registrationSecretHash)) {
        return { status: 'unauthorized' };
      }
      const scope = `revoke-registration:${input.registrationIdHash}`;
      const replay = idempotencyLookup<PushRegistrationRecord>(state, scope, input);
      if (replay.status === 'conflict') return { status: 'conflict' };
      if (replay.status === 'replay') return { status: 'replay', value: replay.value };

      const now = iso(input.nowMs);
      if (!stored.record.revokedAt) {
        stored.record.revokedAt = now;
        stored.record.updatedAt = now;
        stored.record.lifecycleVersion += 1;
      }
      for (const token of stored.tokens) {
        if (token.state === 'invalidated') continue;
        token.state = 'invalidated';
        token.invalidatedAt = now;
        token.invalidationReason = 'unregistered';
        token.updatedAt = now;
        token.lifecycleVersion += 1;
      }
      for (const capability of Object.values(state.capabilities)) {
        if (capability.registrationIdHash !== input.registrationIdHash || capability.revokedAt) continue;
        capability.revokedAt = now;
        capability.lifecycleVersion += 1;
      }
      const value = registrationRecord(stored);
      rememberIdempotency(state, scope, input, value);
      return withExclusiveFileLock(this.attemptLockFile, async () => {
        const attempts = await this.readAttempts();
        const cancelled = cancelStoredAttempts(
          attempts,
          (attempt) => attempt.capabilityHash in state.capabilities
            && state.capabilities[attempt.capabilityHash]?.registrationIdHash
              === input.registrationIdHash,
          'registration_revoked',
          input.nowMs,
        );
        if (cancelled > 0) await this.writeAttempts(attempts);
        await this.write(state);
        return { status: 'applied', value };
      });
    });
  }

  mintCapability(
    input: MintPushCapabilityInput,
  ): Promise<PushIdempotentMutationResult<PushCapabilityRecord>> {
    assertIdempotency(input);
    assertHash('Registration id hash', input.registrationIdHash);
    assertHash('Registration secret hash', input.registrationSecretHash);
    assertHash('Capability hash', input.capabilityHash);
    assertScope(input.scope);
    assertFuture('Capability expiry', input.expiresAtMs, input.nowMs);

    return withExclusiveFileLock(this.lockFile, async () => {
      const state = await this.read();
      const stored = state.registrations[input.registrationIdHash];
      if (!stored) return { status: 'not_found' };
      if (!hashesEqual(stored.registrationSecretHash, input.registrationSecretHash)) {
        return { status: 'unauthorized' };
      }
      const scope = `mint-capability:${input.registrationIdHash}`;
      const replay = idempotencyLookup<PushCapabilityRecord>(state, scope, input);
      if (replay.status === 'conflict') return { status: 'conflict' };
      if (replay.status === 'replay') return { status: 'replay', value: replay.value };
      if (!registrationIsActive(stored, input.nowMs)) return { status: 'not_found' };
      if (state.capabilities[input.capabilityHash]
        || input.expiresAtMs > timestampMs(stored.record.expiresAt, 'registration expiry')) {
        return { status: 'conflict' };
      }
      const capability: PushCapabilityRecord = {
        capabilityHash: input.capabilityHash,
        registrationIdHash: input.registrationIdHash,
        scope: input.scope,
        expiresAt: iso(input.expiresAtMs),
        createdAt: iso(input.nowMs),
        lifecycleVersion: 1,
      };
      state.capabilities[input.capabilityHash] = capability;
      rememberIdempotency(state, scope, input, capability);
      await this.write(state);
      return { status: 'applied', value: structuredClone(capability) };
    });
  }

  revokeCapability(
    input: RevokePushCapabilityInput,
  ): Promise<PushIdempotentMutationResult<PushCapabilityRecord>> {
    assertIdempotency(input);
    assertHash('Registration id hash', input.registrationIdHash);
    assertHash('Registration secret hash', input.registrationSecretHash);
    assertHash('Capability hash', input.capabilityHash);

    return withExclusiveFileLock(this.lockFile, async () => {
      const state = await this.read();
      const registration = state.registrations[input.registrationIdHash];
      if (!registration) return { status: 'not_found' };
      if (!hashesEqual(registration.registrationSecretHash, input.registrationSecretHash)) {
        return { status: 'unauthorized' };
      }
      const scope = `revoke-capability:${input.registrationIdHash}`;
      const replay = idempotencyLookup<PushCapabilityRecord>(state, scope, input);
      if (replay.status === 'conflict') return { status: 'conflict' };
      if (replay.status === 'replay') return { status: 'replay', value: replay.value };
      const capability = state.capabilities[input.capabilityHash];
      if (!capability || capability.registrationIdHash !== input.registrationIdHash) {
        return { status: 'not_found' };
      }
      if (!capability.revokedAt) {
        capability.revokedAt = iso(input.nowMs);
        capability.lifecycleVersion += 1;
      }
      rememberIdempotency(state, scope, input, capability);
      return withExclusiveFileLock(this.attemptLockFile, async () => {
        const attempts = await this.readAttempts();
        const cancelled = cancelStoredAttempts(
          attempts,
          (attempt) => attempt.capabilityHash === input.capabilityHash,
          'capability_revoked',
          input.nowMs,
        );
        if (cancelled > 0) await this.writeAttempts(attempts);
        await this.write(state);
        return { status: 'applied', value: structuredClone(capability) };
      });
    });
  }

  invalidateProviderToken(
    input: InvalidatePushProviderTokenInput,
  ): Promise<PushTokenInvalidationResult> {
    assertHash('Registration id hash', input.registrationIdHash);
    assertPositiveInteger('Token generation', input.tokenGeneration, Number.MAX_SAFE_INTEGER);
    assertTime('Provider invalidation time', input.nowMs);
    if (!INVALIDATION_REASONS.has(input.reason)) {
      throw new TypeError('Provider invalidation reason is invalid');
    }

    return withExclusiveFileLock(this.lockFile, async () => {
      const state = await this.read();
      const stored = state.registrations[input.registrationIdHash];
      const token = stored?.tokens.find((candidate) =>
        candidate.tokenGeneration === input.tokenGeneration);
      if (!stored || !token) return { status: 'not_found' };
      if (token.state === 'invalidated') {
        return { status: 'already_invalidated', token: deserializeToken(token) };
      }
      token.state = 'invalidated';
      token.invalidatedAt = iso(input.nowMs);
      token.invalidationReason = input.reason;
      token.updatedAt = iso(input.nowMs);
      token.lifecycleVersion += 1;
      stored.record.updatedAt = iso(input.nowMs);
      stored.record.lifecycleVersion += 1;
      return withExclusiveFileLock(this.attemptLockFile, async () => {
        const attempts = await this.readAttempts();
        const cancelled = cancelStoredAttempts(
          attempts,
          (attempt) => attempt.tokenGeneration === input.tokenGeneration
            && state.capabilities[attempt.capabilityHash]?.registrationIdHash
              === input.registrationIdHash,
          'provider_token_invalidated',
          input.nowMs,
        );
        if (cancelled > 0) await this.writeAttempts(attempts);
        await this.write(state);
        return { status: 'applied', token: deserializeToken(token) };
      });
    });
  }

  resolveCapability(input: {
    capabilityHash: string;
    scope: PushCapabilityScope;
    nowMs: number;
  }): Promise<PushCapabilityResolution | null> {
    assertHash('Capability hash', input.capabilityHash);
    assertScope(input.scope);
    assertTime('Capability resolution time', input.nowMs);
    return withExclusiveFileLock(this.lockFile, async () => {
      const state = await this.read();
      const capability = state.capabilities[input.capabilityHash];
      if (!capability || capability.scope !== input.scope || !capabilityIsActive(capability, input.nowMs)) {
        return null;
      }
      const registration = state.registrations[capability.registrationIdHash];
      if (!registration || !registrationIsActive(registration, input.nowMs)) return null;
      const deliverableTokens = registration.tokens
        .filter((token) => tokenIsDeliverable(token, input.nowMs))
        .sort((left, right) => right.tokenGeneration - left.tokenGeneration)
        .map(deserializeToken);
      if (deliverableTokens.length === 0) return null;
      return {
        capability: structuredClone(capability),
        provider: registration.record.provider,
        deliverableTokens,
      };
    });
  }

  getRegistration(registrationIdHash: string): Promise<PushRegistrationRecord | null> {
    assertHash('Registration id hash', registrationIdHash);
    return withExclusiveFileLock(this.lockFile, async () => {
      const state = await this.read();
      const stored = state.registrations[registrationIdHash];
      return stored ? registrationRecord(stored) : null;
    });
  }

  listRegistrations(input: {
    limit?: number;
    before?: PushRegistrationCursor;
  } = {}): Promise<PushRegistrationPage> {
    const limit = input.limit ?? 100;
    assertPositiveInteger('Registration page limit', limit, 500);
    if (input.before) {
      timestampMs(input.before.createdAt, 'registration cursor time');
      assertHash('Registration cursor hash', input.before.registrationIdHash);
    }
    return withExclusiveFileLock(this.lockFile, async () => {
      const state = await this.read();
      let rows = Object.values(state.registrations)
        .map(registrationRecord)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)
          || right.registrationIdHash.localeCompare(left.registrationIdHash));
      if (input.before) {
        rows = rows.filter((row) => row.createdAt < input.before!.createdAt
          || (row.createdAt === input.before!.createdAt
            && row.registrationIdHash < input.before!.registrationIdHash));
      }
      const records = rows.slice(0, limit);
      const tail = records.at(-1);
      return {
        records,
        nextCursor: rows.length > records.length && tail
          ? { createdAt: tail.createdAt, registrationIdHash: tail.registrationIdHash }
          : null,
      };
    });
  }

  stats(nowMs: number): Promise<PushRegistrationStats> {
    assertTime('Push registration stats time', nowMs);
    return withExclusiveFileLock(this.lockFile, async () => {
      const state = await this.read();
      const stats: PushRegistrationStats = {
        registrations: 0,
        activeRegistrations: 0,
        capabilities: 0,
        activeCapabilities: 0,
        activeTokens: 0,
        retiringTokens: 0,
        invalidatedTokens: 0,
        expiredTokens: 0,
      };
      for (const registration of Object.values(state.registrations)) {
        stats.registrations += 1;
        if (registrationIsActive(registration, nowMs)) stats.activeRegistrations += 1;
        for (const token of registration.tokens) {
          const expired = timestampMs(token.expiresAt, 'token expiry') <= nowMs
            || (token.state === 'retiring' && token.retireAfter !== undefined
              && timestampMs(token.retireAfter, 'token retirement') <= nowMs);
          if (expired && token.state !== 'invalidated') stats.expiredTokens += 1;
          else if (token.state === 'active') stats.activeTokens += 1;
          else if (token.state === 'retiring') stats.retiringTokens += 1;
          else if (token.state === 'invalidated') stats.invalidatedTokens += 1;
          else stats.expiredTokens += 1;
        }
      }
      for (const capability of Object.values(state.capabilities)) {
        stats.capabilities += 1;
        const registration = state.registrations[capability.registrationIdHash];
        if (capabilityIsActive(capability, nowMs)
          && registration !== undefined
          && registrationIsActive(registration, nowMs)) {
          stats.activeCapabilities += 1;
        }
      }
      return stats;
    });
  }

  prune(input: PushRegistrationPruneInput): Promise<PushRegistrationPruneResult> {
    assertTime('Push prune time', input.nowMs);
    assertTime('Push retention cutoff', input.retainedUntilMs);
    assertTime('Push idempotency retention cutoff', input.idempotencyRetainedUntilMs);
    assertPositiveInteger('Push prune limit', input.limit, 10_000);
    if (input.retainedUntilMs > input.nowMs || input.idempotencyRetainedUntilMs > input.nowMs) {
      throw new RangeError('Push retention cutoffs cannot be in the future');
    }
    return withExclusiveFileLock(this.lockFile, async () => {
      const state = await this.read();
      const result: PushRegistrationPruneResult = {
        registrations: 0,
        capabilities: 0,
        tokens: 0,
        idempotencyRecords: 0,
      };
      let budget = input.limit;
      const tokenCandidates = Object.values(state.registrations)
        .flatMap((registration) => registration.tokens.map((token) => ({ registration, token })))
        .sort((left, right) => left.token.updatedAt.localeCompare(right.token.updatedAt)
          || left.token.registrationIdHash.localeCompare(right.token.registrationIdHash)
          || left.token.tokenGeneration - right.token.tokenGeneration);
      for (const { registration, token } of tokenCandidates) {
        if (budget === 0) break;
        const expired = timestampMs(token.expiresAt, 'token expiry') <= input.nowMs
          || (token.retireAfter !== undefined
            && timestampMs(token.retireAfter, 'token retirement') <= input.nowMs);
        const removable = (token.state === 'invalidated' || expired)
          && timestampMs(token.updatedAt, 'token updated time') <= input.retainedUntilMs;
        if (!removable) continue;
        registration.tokens = registration.tokens.filter((candidate) => candidate !== token);
        result.tokens += 1;
        budget -= 1;
      }
      const capabilities = Object.values(state.capabilities)
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt)
          || left.capabilityHash.localeCompare(right.capabilityHash));
      for (const capability of capabilities) {
        if (budget === 0) break;
        const terminalAt = capability.revokedAt ?? capability.expiresAt;
        if ((capability.revokedAt || timestampMs(capability.expiresAt, 'capability expiry') <= input.nowMs)
          && timestampMs(terminalAt, 'capability terminal time') <= input.retainedUntilMs) {
          delete state.capabilities[capability.capabilityHash];
          result.capabilities += 1;
          budget -= 1;
        }
      }
      const registrations = Object.values(state.registrations)
        .sort((left, right) => left.record.createdAt.localeCompare(right.record.createdAt)
          || left.record.registrationIdHash.localeCompare(right.record.registrationIdHash));
      for (const registration of registrations) {
        if (budget === 0) break;
        const terminalAt = registration.record.revokedAt ?? registration.record.expiresAt;
        const hasCapabilities = Object.values(state.capabilities).some((capability) =>
          capability.registrationIdHash === registration.record.registrationIdHash);
        if (registration.tokens.length === 0 && !hasCapabilities
          && (registration.record.revokedAt
            || timestampMs(registration.record.expiresAt, 'registration expiry') <= input.nowMs)
          && timestampMs(terminalAt, 'registration terminal time') <= input.retainedUntilMs) {
          delete state.registrations[registration.record.registrationIdHash];
          result.registrations += 1;
          budget -= 1;
        }
      }
      for (const [key, record] of Object.entries(state.idempotency).sort()) {
        if (budget === 0) break;
        if (record.expiresAtMs <= input.nowMs
          && record.expiresAtMs <= input.idempotencyRetainedUntilMs) {
          delete state.idempotency[key];
          result.idempotencyRecords += 1;
          budget -= 1;
        }
      }
      if (result.registrations + result.capabilities + result.tokens
        + result.idempotencyRecords > 0) await this.write(state);
      return result;
    });
  }
}

function assertAttemptInput(input: EnqueuePushAttemptInput): void {
  assertIdempotency(input);
  assertUuid('Push attempt id', input.attemptId);
  assertHash('Capability hash', input.capabilityHash);
  assertProvider(input.provider);
  assertPositiveInteger('Token generation', input.tokenGeneration, Number.MAX_SAFE_INTEGER);
  if (input.nextAttemptAtMs !== undefined) assertTime('Next attempt time', input.nextAttemptAtMs);
}

function attemptIsTerminal(state: PushAttemptState): boolean {
  return state === 'succeeded' || state === 'failed' || state === 'cancelled';
}

function assertCompletionOutcome(input: CompletePushAttemptInput): void {
  const { outcome } = input;
  if (outcome.state === 'succeeded' && outcome.providerStatus !== 'provider_accepted') {
    throw new TypeError('Succeeded push attempts require provider_accepted');
  }
  if (outcome.state === 'retryable'
    && (outcome.providerStatus !== 'unknown' || outcome.retryAtMs <= input.nowMs)) {
    throw new TypeError('Retryable push attempt outcome is invalid');
  }
  if (outcome.state === 'failed'
    && outcome.providerStatus !== 'provider_rejected'
    && outcome.providerStatus !== 'unknown') {
    throw new TypeError('Failed push attempt provider status is invalid');
  }
  if (outcome.state === 'cancelled' && outcome.providerStatus !== 'unknown') {
    throw new TypeError('Cancelled push attempts require unknown provider status');
  }
}

/** Crash-safe, single-node self-host delivery-attempt store. */
export class FilePushAttemptStore implements PushAttemptStore {
  private readonly stateFile: string;
  private readonly lockFile: string;
  private readonly registrationStateFile: string;
  private readonly registrationLockFile: string;

  constructor(baseDir: string) {
    this.stateFile = path.join(baseDir, 'push-attempts.json');
    this.lockFile = path.join(baseDir, '.push-attempts.lock');
    this.registrationStateFile = path.join(baseDir, 'push-registrations.json');
    this.registrationLockFile = path.join(baseDir, '.push-registrations.lock');
  }

  private read(): Promise<AttemptFileState> {
    return readState(this.stateFile, emptyAttemptState, ['attempts', 'idempotency']);
  }

  private write(state: AttemptFileState): Promise<void> {
    return atomicWriteFile(this.stateFile, JSON.stringify(state));
  }

  private readRegistrations(): Promise<RegistrationFileState> {
    return readState(
      this.registrationStateFile,
      emptyRegistrationState,
      ['registrations', 'capabilities', 'idempotency'],
    );
  }

  private withAddressState<Value>(
    operation: (
      registrations: RegistrationFileState,
      attempts: AttemptFileState,
    ) => Promise<Value>,
  ): Promise<Value> {
    return withExclusiveFileLock(this.registrationLockFile, async () => {
      const registrations = await this.readRegistrations();
      return withExclusiveFileLock(this.lockFile, async () =>
        operation(registrations, await this.read()));
    });
  }

  enqueue(input: EnqueuePushAttemptInput): Promise<PushAttemptEnqueueResult> {
    assertAttemptInput(input);
    return this.withAddressState(async (registrations, state) => {
      const replay = idempotencyLookup<{ attemptId: string }>(state, 'enqueue', input);
      if (replay.status === 'conflict') return { status: 'conflict' };
      if (replay.status === 'replay') {
        const attempt = state.attempts[replay.value.attemptId];
        if (!attempt) throw new Error('Push attempt idempotency points to missing state');
        return { status: 'replay', attempt: structuredClone(attempt) };
      }
      if (state.attempts[input.attemptId]) return { status: 'conflict' };
      const now = iso(input.nowMs);
      const attempt: PushAttemptRecord = {
        attemptId: input.attemptId,
        capabilityHash: input.capabilityHash,
        provider: input.provider,
        tokenGeneration: input.tokenGeneration,
        idempotencyKey: input.idempotencyKey,
        requestDigestHex: input.requestDigestHex,
        state: 'queued',
        providerStatus: 'pending',
        attemptCount: 0,
        fencingToken: 0,
        nextAttemptAt: iso(input.nextAttemptAtMs ?? input.nowMs),
        createdAt: now,
        updatedAt: now,
        lifecycleVersion: 1,
      };
      if (!attemptAddressIsDeliverable(registrations, attempt, input.nowMs)) {
        return { status: 'conflict' };
      }
      state.attempts[input.attemptId] = attempt;
      rememberIdempotency(state, 'enqueue', input, { attemptId: input.attemptId });
      await this.write(state);
      return { status: 'created', attempt: structuredClone(attempt) };
    });
  }

  claim(input: ClaimPushAttemptsInput): Promise<PushAttemptRecord[]> {
    if (!SAFE_KEY.test(input.owner)) throw new TypeError('Push attempt owner is invalid');
    assertPositiveInteger('Push attempt claim limit', input.limit, 1000);
    assertPositiveInteger('Push attempt lease', input.leaseMs, MAX_LEASE_MS);
    assertTime('Push attempt claim time', input.nowMs);
    return this.withAddressState(async (registrations, state) => {
      const invalid = Object.values(state.attempts)
        .filter((attempt) => !attemptIsTerminal(attempt.state)
          && !attemptAddressIsDeliverable(registrations, attempt, input.nowMs))
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt)
          || left.attemptId.localeCompare(right.attemptId))
        .slice(0, input.limit);
      for (const attempt of invalid) {
        cancelAttemptRecord(attempt, 'address_unavailable', input.nowMs);
      }
      const candidates = Object.values(state.attempts)
        .filter((attempt) => ((attempt.state === 'queued' || attempt.state === 'retryable')
          && timestampMs(attempt.nextAttemptAt, 'attempt schedule') <= input.nowMs)
          || (attempt.state === 'leased' && attempt.leasedUntil !== undefined
            && timestampMs(attempt.leasedUntil, 'attempt lease') <= input.nowMs))
        .filter((attempt) => attemptAddressIsDeliverable(registrations, attempt, input.nowMs))
        .sort((left, right) => left.nextAttemptAt.localeCompare(right.nextAttemptAt)
          || left.attemptId.localeCompare(right.attemptId))
        .slice(0, input.limit);
      const now = iso(input.nowMs);
      for (const attempt of candidates) {
        attempt.state = 'leased';
        attempt.providerStatus = 'pending';
        attempt.leaseOwner = input.owner;
        attempt.leasedUntil = iso(input.nowMs + input.leaseMs);
        attempt.attemptCount += 1;
        attempt.fencingToken += 1;
        attempt.updatedAt = now;
        attempt.lifecycleVersion += 1;
      }
      if (invalid.length > 0 || candidates.length > 0) await this.write(state);
      return candidates.map((attempt) => structuredClone(attempt));
    });
  }

  renew(input: RenewPushAttemptInput): Promise<PushFencedAttemptResult> {
    assertUuid('Push attempt id', input.attemptId);
    if (!SAFE_KEY.test(input.owner)) throw new TypeError('Push attempt owner is invalid');
    assertPositiveInteger('Push attempt fencing token', input.fencingToken, Number.MAX_SAFE_INTEGER);
    assertPositiveInteger('Push attempt lease', input.leaseMs, MAX_LEASE_MS);
    assertTime('Push attempt renewal time', input.nowMs);
    return this.withAddressState(async (registrations, state) => {
      const attempt = state.attempts[input.attemptId];
      if (!attempt) return { status: 'not_found' };
      if (!attemptIsTerminal(attempt.state)
        && !attemptAddressIsDeliverable(registrations, attempt, input.nowMs)) {
        cancelAttemptRecord(attempt, 'address_unavailable', input.nowMs);
        await this.write(state);
        return { status: 'stale' };
      }
      if (attempt.state !== 'leased' || attempt.leaseOwner !== input.owner
        || attempt.fencingToken !== input.fencingToken || !attempt.leasedUntil
        || timestampMs(attempt.leasedUntil, 'attempt lease') <= input.nowMs) {
        return { status: 'stale' };
      }
      attempt.leasedUntil = iso(Math.max(
        timestampMs(attempt.leasedUntil, 'attempt lease'),
        input.nowMs + input.leaseMs,
      ));
      attempt.updatedAt = iso(input.nowMs);
      attempt.lifecycleVersion += 1;
      await this.write(state);
      return { status: 'applied', attempt: structuredClone(attempt) };
    });
  }

  complete(input: CompletePushAttemptInput): Promise<PushFencedAttemptResult> {
    assertUuid('Push attempt id', input.attemptId);
    if (!SAFE_KEY.test(input.owner)) throw new TypeError('Push attempt owner is invalid');
    assertPositiveInteger('Push attempt fencing token', input.fencingToken, Number.MAX_SAFE_INTEGER);
    assertTime('Push attempt completion time', input.nowMs);
    assertCompletionOutcome(input);
    if ('errorCode' in input.outcome && !SAFE_CODE.test(input.outcome.errorCode)) {
      throw new TypeError('Push attempt error code is invalid');
    }
    if ('providerReference' in input.outcome && input.outcome.providerReference !== undefined
      && (input.outcome.providerReference.length === 0
        || input.outcome.providerReference.length > 512
        || /[\r\n\0]/u.test(input.outcome.providerReference))) {
      throw new TypeError('Push provider reference is invalid');
    }
    if (input.outcome.state === 'retryable') {
      assertFuture('Push retry time', input.outcome.retryAtMs, input.nowMs);
    }
    return this.withAddressState(async (registrations, state) => {
      const attempt = state.attempts[input.attemptId];
      if (!attempt) return { status: 'not_found' };
      if (!attemptIsTerminal(attempt.state)
        && !attemptAddressIsDeliverable(registrations, attempt, input.nowMs)) {
        cancelAttemptRecord(attempt, 'address_unavailable', input.nowMs);
        await this.write(state);
        return { status: 'stale' };
      }
      if (attempt.state !== 'leased' || attempt.leaseOwner !== input.owner
        || attempt.fencingToken !== input.fencingToken || !attempt.leasedUntil
        || timestampMs(attempt.leasedUntil, 'attempt lease') <= input.nowMs) {
        return { status: 'stale' };
      }
      attempt.state = input.outcome.state;
      attempt.providerStatus = input.outcome.providerStatus;
      attempt.providerReference = 'providerReference' in input.outcome
        ? input.outcome.providerReference
        : undefined;
      attempt.lastErrorCode = 'errorCode' in input.outcome
        ? input.outcome.errorCode
        : undefined;
      attempt.nextAttemptAt = input.outcome.state === 'retryable'
        ? iso(input.outcome.retryAtMs)
        : iso(input.nowMs);
      attempt.completedAt = attemptIsTerminal(input.outcome.state) ? iso(input.nowMs) : undefined;
      attempt.leaseOwner = undefined;
      attempt.leasedUntil = undefined;
      attempt.updatedAt = iso(input.nowMs);
      attempt.lifecycleVersion += 1;
      await this.write(state);
      return { status: 'applied', attempt: structuredClone(attempt) };
    });
  }

  cancelByCapability(input: {
    capabilityHash: string;
    reasonCode: string;
    nowMs: number;
    limit: number;
  }): Promise<number> {
    assertHash('Capability hash', input.capabilityHash);
    if (!SAFE_CODE.test(input.reasonCode)) throw new TypeError('Push cancellation code is invalid');
    assertTime('Push cancellation time', input.nowMs);
    assertPositiveInteger('Push cancellation limit', input.limit, 10_000);
    return withExclusiveFileLock(this.lockFile, async () => {
      const state = await this.read();
      const candidates = Object.values(state.attempts)
        .filter((attempt) => attempt.capabilityHash === input.capabilityHash
          && !attemptIsTerminal(attempt.state))
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt)
          || left.attemptId.localeCompare(right.attemptId))
        .slice(0, input.limit);
      for (const attempt of candidates) {
        cancelAttemptRecord(attempt, input.reasonCode, input.nowMs);
      }
      if (candidates.length > 0) await this.write(state);
      return candidates.length;
    });
  }

  getStatus(input: {
    attemptId: string;
    capabilityHash: string;
  }): Promise<PushAttemptStatus | null> {
    assertUuid('Push attempt id', input.attemptId);
    assertHash('Capability hash', input.capabilityHash);
    return withExclusiveFileLock(this.lockFile, async () => {
      const state = await this.read();
      const attempt = state.attempts[input.attemptId];
      if (!attempt || !hashesEqual(attempt.capabilityHash, input.capabilityHash)) return null;
      return {
        attemptId: attempt.attemptId,
        providerStatus: attempt.providerStatus === 'pending'
          ? 'unknown'
          : attempt.providerStatus,
        ...(attempt.providerReference ? { providerReference: attempt.providerReference } : {}),
        terminal: attemptIsTerminal(attempt.state),
        createdAt: attempt.createdAt,
        updatedAt: attempt.updatedAt,
      };
    });
  }

  list(input: {
    state?: PushAttemptState;
    limit?: number;
    before?: PushAttemptCursor;
  } = {}): Promise<PushAttemptPage> {
    if (input.state !== undefined && !ATTEMPT_STATES.has(input.state)) {
      throw new TypeError('Push attempt state is invalid');
    }
    const limit = input.limit ?? 100;
    assertPositiveInteger('Push attempt page limit', limit, 500);
    if (input.before) {
      timestampMs(input.before.createdAt, 'attempt cursor time');
      assertUuid('Attempt cursor id', input.before.attemptId);
    }
    return withExclusiveFileLock(this.lockFile, async () => {
      const state = await this.read();
      let rows = Object.values(state.attempts)
        .filter((attempt) => input.state === undefined || attempt.state === input.state)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)
          || right.attemptId.localeCompare(left.attemptId));
      if (input.before) {
        rows = rows.filter((row) => row.createdAt < input.before!.createdAt
          || (row.createdAt === input.before!.createdAt
            && row.attemptId < input.before!.attemptId));
      }
      const records = rows.slice(0, limit).map((attempt) => structuredClone(attempt));
      const tail = records.at(-1);
      return {
        records,
        nextCursor: rows.length > records.length && tail
          ? { createdAt: tail.createdAt, attemptId: tail.attemptId }
          : null,
      };
    });
  }

  stats(nowMs: number): Promise<PushAttemptStats> {
    assertTime('Push attempt stats time', nowMs);
    return withExclusiveFileLock(this.lockFile, async () => {
      const state = await this.read();
      const stats: PushAttemptStats = {
        queued: 0,
        leased: 0,
        retryable: 0,
        succeeded: 0,
        failed: 0,
        cancelled: 0,
        due: 0,
        total: 0,
      };
      for (const attempt of Object.values(state.attempts)) {
        stats[attempt.state] += 1;
        stats.total += 1;
        if (((attempt.state === 'queued' || attempt.state === 'retryable')
          && timestampMs(attempt.nextAttemptAt, 'attempt schedule') <= nowMs)
          || (attempt.state === 'leased' && attempt.leasedUntil !== undefined
            && timestampMs(attempt.leasedUntil, 'attempt lease') <= nowMs)) {
          stats.due += 1;
        }
      }
      return stats;
    });
  }

  prune(input: PushAttemptPruneInput): Promise<PushAttemptPruneResult> {
    assertTime('Push attempt prune time', input.nowMs);
    assertTime('Push attempt retention cutoff', input.completedBeforeMs);
    assertTime('Push idempotency retention cutoff', input.idempotencyRetainedUntilMs);
    assertPositiveInteger('Push attempt prune limit', input.limit, 10_000);
    if (input.completedBeforeMs > input.nowMs || input.idempotencyRetainedUntilMs > input.nowMs) {
      throw new RangeError('Push attempt retention cutoffs cannot be in the future');
    }
    return withExclusiveFileLock(this.lockFile, async () => {
      const state = await this.read();
      const result: PushAttemptPruneResult = { attempts: 0, idempotencyRecords: 0 };
      let budget = input.limit;
      for (const [key, record] of Object.entries(state.idempotency).sort()) {
        if (budget === 0) break;
        if (record.expiresAtMs <= input.nowMs
          && record.expiresAtMs <= input.idempotencyRetainedUntilMs) {
          delete state.idempotency[key];
          result.idempotencyRecords += 1;
          budget -= 1;
        }
      }
      const attempts = Object.values(state.attempts)
        .filter((attempt) => attemptIsTerminal(attempt.state)
          && attempt.completedAt !== undefined
          && timestampMs(attempt.completedAt, 'attempt completion') <= input.completedBeforeMs
          && !Object.values(state.idempotency).some((record) =>
            record.expiresAtMs > input.nowMs && record.value.attemptId === attempt.attemptId))
        .sort((left, right) => left.completedAt!.localeCompare(right.completedAt!)
          || left.attemptId.localeCompare(right.attemptId));
      for (const attempt of attempts) {
        if (budget === 0) break;
        delete state.attempts[attempt.attemptId];
        result.attempts += 1;
        budget -= 1;
      }
      if (result.attempts + result.idempotencyRecords > 0) await this.write(state);
      return result;
    });
  }
}
