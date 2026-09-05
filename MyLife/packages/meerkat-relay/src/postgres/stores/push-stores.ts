import { randomUUID, timingSafeEqual } from 'node:crypto';
import type { QueryResult, QueryResultRow } from 'pg';
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
  PushIdempotentRequest,
  PushProvider,
  PushProviderInvalidationReason,
  PushProviderStatus,
  PushProviderTokenRecord,
  PushProviderTokenState,
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
} from '../../push-store';
import type { PostgresStoreContext } from '../store-context';
import { toPostgresStoreUnavailableError } from '../store-context';
import { PostgresOperationsStore } from './operations-store';

const HASH = /^[a-f0-9]{64}$/u;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u;
const EXACT_UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/u;
const SAFE_KEY = /^[A-Za-z0-9_.:@/-]{1,256}$/u;
const SAFE_CODE = /^[a-z][a-z0-9_.:-]{0,127}$/u;
const PROVIDERS = new Set<PushProvider>(['apns', 'fcm', 'webpush']);
const SCOPES = new Set<PushCapabilityScope>(['sync_wake', 'call_wake']);
const TOKEN_STATES = new Set<PushProviderTokenState>(['active', 'retiring', 'invalidated']);
const INVALIDATION_REASONS = new Set<PushProviderInvalidationReason>([
  'invalid_token', 'unregistered', 'token_expired', 'provider_rejected',
]);
const ATTEMPT_STATES = new Set<PushAttemptState>([
  'queued', 'leased', 'succeeded', 'retryable', 'failed', 'cancelled',
]);
const PROVIDER_STATUSES = new Set<PushProviderStatus>([
  'pending', 'provider_accepted', 'provider_rejected', 'unknown',
]);
const COMPLETION_STATES = new Set(['succeeded', 'retryable', 'failed', 'cancelled']);
const MAX_LEASE_MS = 24 * 60 * 60 * 1000;
const MAX_OVERLAP_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_IDEMPOTENCY_MS = 90 * 24 * 60 * 60 * 1000;
const IDEMPOTENCY_LEASE_MS = 30_000;
const MAX_TOKEN_CIPHERTEXT_BYTES = 16 * 1024;

interface RegistrationRow extends QueryResultRow {
  registration_id_hash: unknown;
  registration_secret_hash?: unknown;
  provider: unknown;
  expires_at: unknown;
  revoked_at: unknown;
  created_at: unknown;
  updated_at: unknown;
  lifecycle_version: unknown;
  is_active?: unknown;
}

interface TokenRow extends QueryResultRow {
  registration_id_hash: unknown;
  provider: unknown;
  token_generation: unknown;
  token_ciphertext?: unknown;
  token_key_version: unknown;
  state: unknown;
  expires_at: unknown;
  retire_after: unknown;
  invalidated_at: unknown;
  invalidation_reason: unknown;
  created_at: unknown;
  updated_at: unknown;
  lifecycle_version: unknown;
}

interface CapabilityRow extends QueryResultRow {
  capability_hash: unknown;
  registration_id_hash: unknown;
  scope: unknown;
  expires_at: unknown;
  revoked_at: unknown;
  created_at: unknown;
  lifecycle_version: unknown;
  provider?: unknown;
}

interface AttemptRow extends QueryResultRow {
  attempt_id: unknown;
  capability_hash: unknown;
  provider: unknown;
  token_generation: unknown;
  idempotency_key: unknown;
  request_digest_hex: unknown;
  state: unknown;
  provider_status: unknown;
  provider_reference: unknown;
  lease_owner: unknown;
  leased_until: unknown;
  attempt_count: unknown;
  fencing_token: unknown;
  next_attempt_at: unknown;
  last_error_code: unknown;
  created_at: unknown;
  updated_at: unknown;
  completed_at: unknown;
  lifecycle_version: unknown;
}

interface CountRow extends QueryResultRow {
  count: unknown;
}

interface RegistrationStatsRow extends QueryResultRow {
  registrations: unknown;
  active_registrations: unknown;
  capabilities: unknown;
  active_capabilities: unknown;
  active_tokens: unknown;
  retiring_tokens: unknown;
  invalidated_tokens: unknown;
  expired_tokens: unknown;
}

interface AttemptStatsRow extends QueryResultRow {
  queued: unknown;
  leased: unknown;
  retryable: unknown;
  succeeded: unknown;
  failed: unknown;
  cancelled: unknown;
  due: unknown;
  total: unknown;
}

function text(name: string, value: unknown, pattern?: RegExp): string {
  if (typeof value !== 'string' || value.length === 0 || (pattern && !pattern.test(value))) {
    throw new Error(`PostgreSQL push ${name} is invalid`);
  }
  return value;
}

function nullableText(name: string, value: unknown): string | null {
  return value === null ? null : text(name, value);
}

function safeInteger(name: string, value: unknown): number {
  const parsed = typeof value === 'bigint'
    ? Number(value)
    : typeof value === 'string' && /^\d+$/u.test(value)
      ? Number(value)
      : typeof value === 'number' ? value : Number.NaN;
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`PostgreSQL push ${name} is invalid`);
  }
  return parsed;
}

function timestamp(name: string, value: unknown): string {
  if (typeof value === 'string' && EXACT_UTC_TIMESTAMP.test(value)) {
    if (!Number.isFinite(Date.parse(value))) throw new Error(`PostgreSQL push ${name} is invalid`);
    return value;
  }
  const parsed = value instanceof Date ? value : new Date(String(value));
  if (!Number.isFinite(parsed.getTime())) throw new Error(`PostgreSQL push ${name} is invalid`);
  return parsed.toISOString();
}

function nullableTimestamp(name: string, value: unknown): string | null {
  return value === null ? null : timestamp(name, value);
}

function boolean(name: string, value: unknown): boolean {
  if (typeof value !== 'boolean') throw new Error(`PostgreSQL push ${name} is invalid`);
  return value;
}

function enumValue<Value extends string>(
  name: string,
  value: unknown,
  values: ReadonlySet<Value>,
): Value {
  const parsed = text(name, value) as Value;
  if (!values.has(parsed)) throw new Error(`PostgreSQL push ${name} is unsupported`);
  return parsed;
}

function provider(value: unknown): PushProvider {
  return enumValue('provider', value, PROVIDERS);
}

function scope(value: unknown): PushCapabilityScope {
  return enumValue('capability scope', value, SCOPES);
}

function tokenState(value: unknown): PushProviderTokenState {
  return enumValue('token state', value, TOKEN_STATES);
}

function invalidationReason(value: unknown): PushProviderInvalidationReason | null {
  return value === null
    ? null
    : enumValue('token invalidation reason', value, INVALIDATION_REASONS);
}

function attemptState(value: unknown): PushAttemptState {
  return enumValue('attempt state', value, ATTEMPT_STATES);
}

function providerStatus(value: unknown): PushProviderStatus {
  return enumValue('provider status', value, PROVIDER_STATUSES);
}

function ciphertext(value: unknown): Uint8Array {
  if (!(value instanceof Uint8Array)
    || value.byteLength === 0
    || value.byteLength > MAX_TOKEN_CIPHERTEXT_BYTES) {
    throw new Error('PostgreSQL push token ciphertext is invalid');
  }
  return new Uint8Array(value);
}

function assertPattern(name: string, value: string, pattern: RegExp): void {
  if (!pattern.test(value)) throw new TypeError(`${name} is invalid`);
}

function assertTime(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${name} must be a non-negative safe integer timestamp`);
  }
}

function assertPositive(name: string, value: number, maximum = Number.MAX_SAFE_INTEGER): void {
  if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) {
    throw new TypeError(`${name} must be a positive safe integer`);
  }
}

function assertFuture(name: string, value: number, nowMs: number): void {
  assertTime(name, value);
  if (value <= nowMs) throw new RangeError(`${name} must be in the future`);
}

function assertProvider(value: PushProvider): void {
  if (!PROVIDERS.has(value)) throw new TypeError('Push provider is invalid');
}

function assertScope(value: PushCapabilityScope): void {
  if (!SCOPES.has(value)) throw new TypeError('Push capability scope is invalid');
}

function assertEncryptedToken(value: EncryptedPushProviderToken): void {
  if (!(value.ciphertext instanceof Uint8Array)
    || value.ciphertext.byteLength === 0
    || value.ciphertext.byteLength > MAX_TOKEN_CIPHERTEXT_BYTES) {
    throw new TypeError('Encrypted push token ciphertext is invalid');
  }
  assertPositive('Encrypted push token keyVersion', value.keyVersion, 2_147_483_647);
}

function assertIdempotency(input: PushIdempotentRequest): number {
  assertPattern('Push idempotency key', input.idempotencyKey, HASH);
  assertPattern('Push request digest', input.requestDigestHex, HASH);
  assertTime('Push request time', input.nowMs);
  assertFuture('Push idempotency expiry', input.idempotencyExpiresAtMs, input.nowMs);
  const ttlMs = input.idempotencyExpiresAtMs - input.nowMs;
  if (ttlMs > MAX_IDEMPOTENCY_MS) throw new RangeError('Push idempotency expiry exceeds 90 days');
  return ttlMs;
}

function dateFromMs(name: string, value: number): Date {
  assertTime(name, value);
  return new Date(value);
}

function hashesEqual(left: string, right: string): boolean {
  assertPattern('Stored push hash', left, HASH);
  assertPattern('Provided push hash', right, HASH);
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

function mapToken(row: TokenRow): PushProviderTokenRecord {
  const state = tokenState(row.state);
  const retireAfter = nullableTimestamp('token retire_after', row.retire_after);
  const invalidatedAt = nullableTimestamp('token invalidated_at', row.invalidated_at);
  const reason = invalidationReason(row.invalidation_reason);
  if (state === 'retiring' && retireAfter === null) {
    throw new Error('PostgreSQL retiring push token has no retirement time');
  }
  if (state === 'invalidated' && (invalidatedAt === null || reason === null)) {
    throw new Error('PostgreSQL invalidated push token is incomplete');
  }
  if (row.token_ciphertext === undefined) {
    throw new Error('PostgreSQL push token projection omitted ciphertext');
  }
  return {
    registrationIdHash: text('registration hash', row.registration_id_hash, HASH),
    provider: provider(row.provider),
    tokenGeneration: safeInteger('token generation', row.token_generation),
    encryptedToken: {
      ciphertext: ciphertext(row.token_ciphertext),
      keyVersion: safeInteger('token key version', row.token_key_version),
    },
    state,
    expiresAt: timestamp('token expires_at', row.expires_at),
    ...(retireAfter === null ? {} : { retireAfter }),
    ...(invalidatedAt === null ? {} : { invalidatedAt }),
    ...(reason === null ? {} : { invalidationReason: reason }),
    createdAt: timestamp('token created_at', row.created_at),
    updatedAt: timestamp('token updated_at', row.updated_at),
    lifecycleVersion: safeInteger('token lifecycle version', row.lifecycle_version),
  };
}

function mapTokenSummary(row: TokenRow): PushProviderTokenSummary {
  const state = tokenState(row.state);
  const retireAfter = nullableTimestamp('token retire_after', row.retire_after);
  const invalidatedAt = nullableTimestamp('token invalidated_at', row.invalidated_at);
  const reason = invalidationReason(row.invalidation_reason);
  return {
    registrationIdHash: text('registration hash', row.registration_id_hash, HASH),
    provider: provider(row.provider),
    tokenGeneration: safeInteger('token generation', row.token_generation),
    state,
    expiresAt: timestamp('token expires_at', row.expires_at),
    ...(retireAfter === null ? {} : { retireAfter }),
    ...(invalidatedAt === null ? {} : { invalidatedAt }),
    ...(reason === null ? {} : { invalidationReason: reason }),
    createdAt: timestamp('token created_at', row.created_at),
    updatedAt: timestamp('token updated_at', row.updated_at),
    lifecycleVersion: safeInteger('token lifecycle version', row.lifecycle_version),
  };
}

function mapRegistration(
  row: RegistrationRow,
  tokenGenerations: PushProviderTokenSummary[],
): PushRegistrationRecord {
  const revokedAt = nullableTimestamp('registration revoked_at', row.revoked_at);
  return {
    registrationIdHash: text('registration hash', row.registration_id_hash, HASH),
    provider: provider(row.provider),
    expiresAt: timestamp('registration expires_at', row.expires_at),
    ...(revokedAt === null ? {} : { revokedAt }),
    createdAt: timestamp('registration created_at', row.created_at),
    updatedAt: timestamp('registration updated_at', row.updated_at),
    lifecycleVersion: safeInteger('registration lifecycle version', row.lifecycle_version),
    tokenGenerations,
  };
}

function mapCapability(row: CapabilityRow): PushCapabilityRecord {
  const revokedAt = nullableTimestamp('capability revoked_at', row.revoked_at);
  return {
    capabilityHash: text('capability hash', row.capability_hash, HASH),
    registrationIdHash: text('registration hash', row.registration_id_hash, HASH),
    scope: scope(row.scope),
    expiresAt: timestamp('capability expires_at', row.expires_at),
    ...(revokedAt === null ? {} : { revokedAt }),
    createdAt: timestamp('capability created_at', row.created_at),
    lifecycleVersion: safeInteger('capability lifecycle version', row.lifecycle_version),
  };
}

function mapAttempt(row: AttemptRow): PushAttemptRecord {
  const reference = nullableText('provider reference', row.provider_reference);
  const owner = nullableText('lease owner', row.lease_owner);
  const leasedUntil = nullableTimestamp('attempt leased_until', row.leased_until);
  const errorCode = nullableText('attempt error code', row.last_error_code);
  const completedAt = nullableTimestamp('attempt completed_at', row.completed_at);
  return {
    attemptId: text('attempt id', row.attempt_id, UUID),
    capabilityHash: text('capability hash', row.capability_hash, HASH),
    provider: provider(row.provider),
    tokenGeneration: safeInteger('attempt token generation', row.token_generation),
    idempotencyKey: text('attempt idempotency key', row.idempotency_key, HASH),
    requestDigestHex: text('attempt request digest', row.request_digest_hex, HASH),
    state: attemptState(row.state),
    providerStatus: providerStatus(row.provider_status),
    ...(reference === null ? {} : { providerReference: reference }),
    ...(owner === null ? {} : { leaseOwner: owner }),
    ...(leasedUntil === null ? {} : { leasedUntil }),
    attemptCount: safeInteger('attempt count', row.attempt_count),
    fencingToken: safeInteger('attempt fencing token', row.fencing_token),
    nextAttemptAt: timestamp('attempt next_attempt_at', row.next_attempt_at),
    ...(errorCode === null ? {} : { lastErrorCode: errorCode }),
    createdAt: timestamp('attempt created_at', row.created_at),
    updatedAt: timestamp('attempt updated_at', row.updated_at),
    ...(completedAt === null ? {} : { completedAt }),
    lifecycleVersion: safeInteger('attempt lifecycle version', row.lifecycle_version),
  };
}

function jsonObject(name: string, value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`PostgreSQL push idempotency ${name} is invalid`);
  }
  return value as Record<string, unknown>;
}

function jsonTokenSummary(value: unknown): PushProviderTokenSummary {
  const row = jsonObject('token summary', value);
  const state = tokenState(row.state);
  const retireAfter = row.retireAfter === undefined
    ? null
    : timestamp('idempotency token retireAfter', row.retireAfter);
  const invalidatedAt = row.invalidatedAt === undefined
    ? null
    : timestamp('idempotency token invalidatedAt', row.invalidatedAt);
  const reason = row.invalidationReason === undefined
    ? null
    : invalidationReason(row.invalidationReason);
  return {
    registrationIdHash: text('idempotency registration hash', row.registrationIdHash, HASH),
    provider: provider(row.provider),
    tokenGeneration: safeInteger('idempotency token generation', row.tokenGeneration),
    state,
    expiresAt: timestamp('idempotency token expiresAt', row.expiresAt),
    ...(retireAfter === null ? {} : { retireAfter }),
    ...(invalidatedAt === null ? {} : { invalidatedAt }),
    ...(reason === null ? {} : { invalidationReason: reason }),
    createdAt: timestamp('idempotency token createdAt', row.createdAt),
    updatedAt: timestamp('idempotency token updatedAt', row.updatedAt),
    lifecycleVersion: safeInteger('idempotency token lifecycle version', row.lifecycleVersion),
  };
}

function registrationReplay(value: unknown): PushRegistrationRecord {
  const envelope = jsonObject('registration result', value);
  if (envelope.kind !== 'push_registration') {
    throw new Error('PostgreSQL push registration idempotency kind is invalid');
  }
  const row = jsonObject('registration value', envelope.value);
  if (!Array.isArray(row.tokenGenerations)) {
    throw new Error('PostgreSQL push registration idempotency tokens are invalid');
  }
  const revokedAt = row.revokedAt === undefined
    ? null
    : timestamp('idempotency registration revokedAt', row.revokedAt);
  return {
    registrationIdHash: text('idempotency registration hash', row.registrationIdHash, HASH),
    provider: provider(row.provider),
    expiresAt: timestamp('idempotency registration expiresAt', row.expiresAt),
    ...(revokedAt === null ? {} : { revokedAt }),
    createdAt: timestamp('idempotency registration createdAt', row.createdAt),
    updatedAt: timestamp('idempotency registration updatedAt', row.updatedAt),
    lifecycleVersion: safeInteger(
      'idempotency registration lifecycle version',
      row.lifecycleVersion,
    ),
    tokenGenerations: row.tokenGenerations.map(jsonTokenSummary),
  };
}

function capabilityReplay(value: unknown): PushCapabilityRecord {
  const envelope = jsonObject('capability result', value);
  if (envelope.kind !== 'push_capability') {
    throw new Error('PostgreSQL push capability idempotency kind is invalid');
  }
  const row = jsonObject('capability value', envelope.value);
  const revokedAt = row.revokedAt === undefined
    ? null
    : timestamp('idempotency capability revokedAt', row.revokedAt);
  return {
    capabilityHash: text('idempotency capability hash', row.capabilityHash, HASH),
    registrationIdHash: text('idempotency registration hash', row.registrationIdHash, HASH),
    scope: scope(row.scope),
    expiresAt: timestamp('idempotency capability expiresAt', row.expiresAt),
    ...(revokedAt === null ? {} : { revokedAt }),
    createdAt: timestamp('idempotency capability createdAt', row.createdAt),
    lifecycleVersion: safeInteger(
      'idempotency capability lifecycle version',
      row.lifecycleVersion,
    ),
  };
}

function attemptReplayId(value: unknown): string {
  const envelope = jsonObject('attempt result', value);
  if (envelope.kind !== 'push_attempt') {
    throw new Error('PostgreSQL push attempt idempotency kind is invalid');
  }
  return text('idempotency attempt id', envelope.attemptId, UUID);
}

function exactTimestampSql(expression: string): string {
  return `to_char(${expression} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
}

function registrationColumns(alias = 'r', exactCreatedAt = false): string {
  return `encode(${alias}.registration_id_hash, 'hex') AS registration_id_hash,
    ${alias}.platform AS provider, ${alias}.expires_at,
    ${alias}.invalidated_at AS revoked_at,
    ${exactCreatedAt ? exactTimestampSql(`${alias}.created_at`) : `${alias}.created_at`} AS created_at,
    ${alias}.updated_at,
    ${alias}.lifecycle_version`;
}

function tokenColumns(alias = 't', includeCiphertext = true): string {
  return `encode(${alias}.registration_id_hash, 'hex') AS registration_id_hash,
    r.platform AS provider, ${alias}.token_generation,
    ${includeCiphertext ? `${alias}.token_ciphertext,` : ''}
    ${alias}.token_key_version, ${alias}.state, ${alias}.expires_at,
    ${alias}.retire_after, ${alias}.invalidated_at, ${alias}.invalidation_reason,
    ${alias}.created_at, ${alias}.updated_at, ${alias}.lifecycle_version`;
}

function capabilityColumns(alias = 'c'): string {
  return `encode(${alias}.capability_hash, 'hex') AS capability_hash,
    encode(${alias}.registration_id_hash, 'hex') AS registration_id_hash,
    ${alias}.scope, ${alias}.expires_at, ${alias}.revoked_at,
    ${alias}.created_at, ${alias}.lifecycle_version`;
}

function attemptColumns(alias = 'a', exactCreatedAt = false): string {
  return `${alias}.attempt_id::text AS attempt_id,
    encode(${alias}.capability_hash, 'hex') AS capability_hash,
    ${alias}.provider, ${alias}.token_generation,
    encode(${alias}.idempotency_key_hash, 'hex') AS idempotency_key,
    encode(${alias}.request_digest, 'hex') AS request_digest_hex,
    ${alias}.state, ${alias}.provider_status, ${alias}.provider_reference,
    ${alias}.lease_owner, ${alias}.leased_until, ${alias}.attempt_count,
    ${alias}.fencing_token, ${alias}.next_attempt_at, ${alias}.last_error_code,
    ${exactCreatedAt ? exactTimestampSql(`${alias}.created_at`) : `${alias}.created_at`} AS created_at,
    ${alias}.updated_at, ${alias}.completed_at,
    ${alias}.lifecycle_version`;
}

abstract class PostgresPushStoreBase {
  protected readonly operations: PostgresOperationsStore;
  protected readonly idempotencyOwner: string;

  protected constructor(
    protected readonly database: PostgresStoreContext,
    ownerPrefix: string,
  ) {
    this.operations = new PostgresOperationsStore(database);
    this.idempotencyOwner = `${ownerPrefix}-${randomUUID()}`;
  }

  protected async query<Row extends QueryResultRow = QueryResultRow>(
    operation: string,
    sql: string,
    values: readonly unknown[] = [],
  ): Promise<QueryResult<Row>> {
    try {
      return await this.database.query<Row>(sql, values);
    } catch (error) {
      throw toPostgresStoreUnavailableError(operation, error);
    }
  }

  protected async transaction<Value>(
    operation: string,
    callback: () => Promise<Value>,
  ): Promise<Value> {
    try {
      return await this.database.transaction(callback);
    } catch (error) {
      throw toPostgresStoreUnavailableError(operation, error);
    }
  }

  protected async claimIdempotency<Value>(
    scopeName: string,
    input: PushIdempotentRequest,
  ) {
    await this.query(
      'expire push idempotency result',
      `DELETE FROM ops.idempotency_results
       WHERE scope = $1 AND idempotency_key = $2
         AND state = 'committed' AND expires_at <= clock_timestamp()`,
      [scopeName, input.idempotencyKey],
    );
    return this.operations.claimIdempotency<Value>({
      scope: scopeName,
      key: input.idempotencyKey,
      requestDigestHex: input.requestDigestHex,
      owner: this.idempotencyOwner,
      leaseMs: IDEMPOTENCY_LEASE_MS,
    });
  }

  protected async completeIdempotency(
    scopeName: string,
    input: PushIdempotentRequest,
    fencingToken: number,
    result: unknown,
    resultTtlMs: number,
  ): Promise<void> {
    const completed = await this.operations.completeIdempotency({
      scope: scopeName,
      key: input.idempotencyKey,
      requestDigestHex: input.requestDigestHex,
      owner: this.idempotencyOwner,
      leaseMs: IDEMPOTENCY_LEASE_MS,
      fencingToken,
      result,
      resultTtlMs,
    });
    if (!completed) throw new Error('PostgreSQL push idempotency completion lost its fence');
  }

  protected abandonIdempotency(
    scopeName: string,
    input: PushIdempotentRequest,
    fencingToken: number,
  ): Promise<boolean> {
    return this.operations.abandonIdempotency({
      scope: scopeName,
      key: input.idempotencyKey,
      requestDigestHex: input.requestDigestHex,
      owner: this.idempotencyOwner,
      leaseMs: IDEMPOTENCY_LEASE_MS,
      fencingToken,
    });
  }
}

/** PostgreSQL 17 Plan 42 registration, token-generation, and capability store. */
export class PostgresPushRegistrationStore
  extends PostgresPushStoreBase
  implements PushRegistrationStore {
  constructor(database: PostgresStoreContext) {
    super(database, 'push-registration');
  }

  private async lockedRegistration(registrationIdHash: string): Promise<RegistrationRow | null> {
    const selected = await this.query<RegistrationRow>(
      'lock push registration',
      `SELECT ${registrationColumns('r')},
        encode(r.registration_secret_hash, 'hex') AS registration_secret_hash,
        (r.invalidated_at IS NULL AND r.expires_at > clock_timestamp()) AS is_active
       FROM push.registrations AS r
       WHERE r.registration_id_hash = decode($1, 'hex')
       FOR UPDATE`,
      [registrationIdHash],
    );
    return selected.rows[0] ?? null;
  }

  private authenticate(row: RegistrationRow, registrationSecretHash: string): boolean {
    return hashesEqual(
      text('registration secret hash', row.registration_secret_hash, HASH),
      registrationSecretHash,
    );
  }

  private async tokenSummaries(registrationIdHash: string): Promise<PushProviderTokenSummary[]> {
    const selected = await this.query<TokenRow>(
      'read push token summaries',
      `SELECT ${tokenColumns('t', false)}
       FROM push.registration_tokens AS t
       JOIN push.registrations AS r USING (registration_id_hash)
       WHERE t.registration_id_hash = decode($1, 'hex')
       ORDER BY t.token_generation DESC`,
      [registrationIdHash],
    );
    return selected.rows.map(mapTokenSummary);
  }

  private async registrationRecord(row: RegistrationRow): Promise<PushRegistrationRecord> {
    const registrationIdHash = text('registration hash', row.registration_id_hash, HASH);
    return mapRegistration(row, await this.tokenSummaries(registrationIdHash));
  }

  async register(
    input: RegisterPushInstallationInput,
  ): Promise<PushIdempotentMutationResult<PushRegistrationRecord>> {
    const ttlMs = assertIdempotency(input);
    assertPattern('Push registration id hash', input.registrationIdHash, HASH);
    assertPattern('Push registration secret hash', input.registrationSecretHash, HASH);
    assertProvider(input.provider);
    assertEncryptedToken(input.encryptedToken);
    if (input.tokenGeneration !== 1) throw new TypeError('Initial token generation must be 1');
    assertFuture('Push token expiry', input.tokenExpiresAtMs, input.nowMs);
    assertFuture('Push registration expiry', input.registrationExpiresAtMs, input.nowMs);
    const idempotencyScope = 'push.registration.register';

    return this.transaction('register push installation', async () => {
      const claim = await this.claimIdempotency<unknown>(idempotencyScope, input);
      if (claim.status === 'conflict' || claim.status === 'in_progress') {
        return { status: 'conflict' };
      }
      if (claim.status === 'replay') {
        return { status: 'replay', value: registrationReplay(claim.result) };
      }

      const inserted = await this.query<RegistrationRow>(
        'insert push registration',
        `INSERT INTO push.registrations (
           registration_id_hash, registration_secret_hash, platform,
           token_ciphertext, token_key_version, token_generation, expires_at
         ) VALUES (
           decode($1, 'hex'), decode($2, 'hex'), $3, $4, $5, 1, $6
         )
         ON CONFLICT DO NOTHING
         RETURNING ${registrationColumns('push.registrations')}`,
        [
          input.registrationIdHash,
          input.registrationSecretHash,
          input.provider,
          Buffer.from(input.encryptedToken.ciphertext),
          input.encryptedToken.keyVersion,
          dateFromMs('Push registration expiry', input.registrationExpiresAtMs),
        ],
      );
      const registration = inserted.rows[0];
      if (!registration) {
        await this.abandonIdempotency(idempotencyScope, input, claim.fencingToken);
        return { status: 'conflict' };
      }
      await this.query(
        'insert push token generation',
        `INSERT INTO push.registration_tokens (
           registration_id_hash, token_generation, token_ciphertext,
           token_key_version, state, expires_at
         ) VALUES (decode($1, 'hex'), 1, $2, $3, 'active', $4)
         ON CONFLICT (registration_id_hash, token_generation) DO UPDATE
         SET token_ciphertext = EXCLUDED.token_ciphertext,
             token_key_version = EXCLUDED.token_key_version,
             state = 'active',
             expires_at = EXCLUDED.expires_at,
             retire_after = NULL,
             invalidated_at = NULL,
             invalidation_reason = NULL,
             updated_at = clock_timestamp(),
             lifecycle_version = push.registration_tokens.lifecycle_version + 1`,
        [
          input.registrationIdHash,
          Buffer.from(input.encryptedToken.ciphertext),
          input.encryptedToken.keyVersion,
          dateFromMs('Push token expiry', input.tokenExpiresAtMs),
        ],
      );
      const value = await this.registrationRecord(registration);
      await this.completeIdempotency(
        idempotencyScope,
        input,
        claim.fencingToken,
        { kind: 'push_registration', value },
        ttlMs,
      );
      return { status: 'applied', value };
    });
  }

  async rotateToken(
    input: RotatePushProviderTokenInput,
  ): Promise<PushIdempotentMutationResult<PushRegistrationRecord>> {
    const ttlMs = assertIdempotency(input);
    assertPattern('Push registration id hash', input.registrationIdHash, HASH);
    assertPattern('Push registration secret hash', input.registrationSecretHash, HASH);
    assertEncryptedToken(input.encryptedToken);
    assertPositive('Push token generation', input.tokenGeneration);
    assertFuture('Push token expiry', input.tokenExpiresAtMs, input.nowMs);
    assertPositive('Push token overlap', input.overlapMs, MAX_OVERLAP_MS);
    const idempotencyScope = `push.registration.rotate:${input.registrationIdHash}`;

    return this.transaction('rotate push token', async () => {
      const registration = await this.lockedRegistration(input.registrationIdHash);
      if (!registration) return { status: 'not_found' };
      if (!this.authenticate(registration, input.registrationSecretHash)) {
        return { status: 'unauthorized' };
      }
      const claim = await this.claimIdempotency<unknown>(idempotencyScope, input);
      if (claim.status === 'conflict' || claim.status === 'in_progress') {
        return { status: 'conflict' };
      }
      if (claim.status === 'replay') {
        return { status: 'replay', value: registrationReplay(claim.result) };
      }
      if (!boolean('registration active state', registration.is_active)) {
        await this.abandonIdempotency(idempotencyScope, input, claim.fencingToken);
        return { status: 'not_found' };
      }
      const maximum = await this.query<{ maximum: unknown }>(
        'read highest push token generation',
        `SELECT COALESCE(MAX(token_generation), 0) AS maximum
         FROM push.registration_tokens
         WHERE registration_id_hash = decode($1, 'hex')`,
        [input.registrationIdHash],
      );
      const highest = safeInteger('highest token generation', maximum.rows[0]?.maximum);
      if (input.tokenGeneration !== highest + 1) {
        await this.abandonIdempotency(idempotencyScope, input, claim.fencingToken);
        return { status: 'conflict' };
      }

      await this.query(
        'retire prior push token generation',
        `UPDATE push.registration_tokens
         SET state = 'retiring',
             retire_after = LEAST(
               expires_at,
               clock_timestamp() + ($2::bigint * interval '1 millisecond')
             ),
             updated_at = clock_timestamp(),
             lifecycle_version = lifecycle_version + 1
         WHERE registration_id_hash = decode($1, 'hex')
           AND state = 'active'`,
        [input.registrationIdHash, input.overlapMs],
      );
      await this.query(
        'insert rotated push token generation',
        `INSERT INTO push.registration_tokens (
           registration_id_hash, token_generation, token_ciphertext,
           token_key_version, state, expires_at
         ) VALUES (decode($1, 'hex'), $2, $3, $4, 'active', $5)`,
        [
          input.registrationIdHash,
          input.tokenGeneration,
          Buffer.from(input.encryptedToken.ciphertext),
          input.encryptedToken.keyVersion,
          dateFromMs('Push token expiry', input.tokenExpiresAtMs),
        ],
      );
      const updated = await this.query<RegistrationRow>(
        'dual-write rotated legacy push token',
        `UPDATE push.registrations
         SET token_ciphertext = $2,
             token_key_version = $3,
             token_generation = $4,
             expires_at = GREATEST(expires_at, $5::timestamptz),
             updated_at = clock_timestamp(),
             lifecycle_version = lifecycle_version + 1
         WHERE registration_id_hash = decode($1, 'hex')
         RETURNING ${registrationColumns('push.registrations')}`,
        [
          input.registrationIdHash,
          Buffer.from(input.encryptedToken.ciphertext),
          input.encryptedToken.keyVersion,
          input.tokenGeneration,
          dateFromMs('Push token expiry', input.tokenExpiresAtMs),
        ],
      );
      const value = await this.registrationRecord(updated.rows[0]!);
      await this.completeIdempotency(
        idempotencyScope,
        input,
        claim.fencingToken,
        { kind: 'push_registration', value },
        ttlMs,
      );
      return { status: 'applied', value };
    });
  }

  async revokeRegistration(
    input: RevokePushRegistrationInput,
  ): Promise<PushIdempotentMutationResult<PushRegistrationRecord>> {
    const ttlMs = assertIdempotency(input);
    assertPattern('Push registration id hash', input.registrationIdHash, HASH);
    assertPattern('Push registration secret hash', input.registrationSecretHash, HASH);
    const idempotencyScope = `push.registration.revoke:${input.registrationIdHash}`;

    return this.transaction('revoke push registration', async () => {
      const registration = await this.lockedRegistration(input.registrationIdHash);
      if (!registration) return { status: 'not_found' };
      if (!this.authenticate(registration, input.registrationSecretHash)) {
        return { status: 'unauthorized' };
      }
      const claim = await this.claimIdempotency<unknown>(idempotencyScope, input);
      if (claim.status === 'conflict' || claim.status === 'in_progress') {
        return { status: 'conflict' };
      }
      if (claim.status === 'replay') {
        return { status: 'replay', value: registrationReplay(claim.result) };
      }

      await this.query(
        'invalidate revoked push token generations',
        `UPDATE push.registration_tokens
         SET state = 'invalidated', invalidated_at = clock_timestamp(),
             invalidation_reason = 'unregistered', updated_at = clock_timestamp(),
             lifecycle_version = lifecycle_version + 1
         WHERE registration_id_hash = decode($1, 'hex')
           AND state <> 'invalidated'`,
        [input.registrationIdHash],
      );
      await this.query(
        'revoke push capabilities',
        `UPDATE push.capabilities
         SET revoked_at = clock_timestamp(), lifecycle_version = lifecycle_version + 1
         WHERE registration_id_hash = decode($1, 'hex')
           AND revoked_at IS NULL`,
        [input.registrationIdHash],
      );
      await this.query(
        'cancel attempts for revoked push registration',
        `UPDATE push.attempts
         SET state = 'cancelled', provider_status = 'unknown',
             last_error_code = 'registration_revoked',
             lease_owner = NULL, leased_until = NULL,
             completed_at = clock_timestamp(), updated_at = clock_timestamp(),
             fencing_token = fencing_token + 1,
             lifecycle_version = lifecycle_version + 1
         WHERE registration_id_hash = decode($1, 'hex')
           AND state IN ('queued', 'leased', 'retryable')`,
        [input.registrationIdHash],
      );
      const updated = await this.query<RegistrationRow>(
        'mark push registration revoked',
        `UPDATE push.registrations
         SET invalidated_at = COALESCE(invalidated_at, clock_timestamp()),
             updated_at = CASE WHEN invalidated_at IS NULL THEN clock_timestamp() ELSE updated_at END,
             lifecycle_version = CASE
               WHEN invalidated_at IS NULL THEN lifecycle_version + 1
               ELSE lifecycle_version
             END
         WHERE registration_id_hash = decode($1, 'hex')
         RETURNING ${registrationColumns('push.registrations')}`,
        [input.registrationIdHash],
      );
      const value = await this.registrationRecord(updated.rows[0]!);
      await this.completeIdempotency(
        idempotencyScope,
        input,
        claim.fencingToken,
        { kind: 'push_registration', value },
        ttlMs,
      );
      return { status: 'applied', value };
    });
  }

  async mintCapability(
    input: MintPushCapabilityInput,
  ): Promise<PushIdempotentMutationResult<PushCapabilityRecord>> {
    const ttlMs = assertIdempotency(input);
    assertPattern('Push registration id hash', input.registrationIdHash, HASH);
    assertPattern('Push registration secret hash', input.registrationSecretHash, HASH);
    assertPattern('Push capability hash', input.capabilityHash, HASH);
    assertScope(input.scope);
    assertFuture('Push capability expiry', input.expiresAtMs, input.nowMs);
    const idempotencyScope = `push.capability.mint:${input.registrationIdHash}`;

    return this.transaction('mint push capability', async () => {
      const registration = await this.lockedRegistration(input.registrationIdHash);
      if (!registration) return { status: 'not_found' };
      if (!this.authenticate(registration, input.registrationSecretHash)) {
        return { status: 'unauthorized' };
      }
      const claim = await this.claimIdempotency<unknown>(idempotencyScope, input);
      if (claim.status === 'conflict' || claim.status === 'in_progress') {
        return { status: 'conflict' };
      }
      if (claim.status === 'replay') {
        return { status: 'replay', value: capabilityReplay(claim.result) };
      }
      if (!boolean('registration active state', registration.is_active)) {
        await this.abandonIdempotency(idempotencyScope, input, claim.fencingToken);
        return { status: 'not_found' };
      }
      const inserted = await this.query<CapabilityRow>(
        'insert push capability',
        `INSERT INTO push.capabilities (
           capability_hash, registration_id_hash, scope, expires_at
         )
         SELECT decode($2, 'hex'), r.registration_id_hash, $3, $4
         FROM push.registrations AS r
         WHERE r.registration_id_hash = decode($1, 'hex')
           AND r.invalidated_at IS NULL
           AND r.expires_at > clock_timestamp()
           AND $4::timestamptz > clock_timestamp()
           AND $4::timestamptz <= r.expires_at
         ON CONFLICT DO NOTHING
         RETURNING ${capabilityColumns('push.capabilities')}`,
        [
          input.registrationIdHash,
          input.capabilityHash,
          input.scope,
          dateFromMs('Push capability expiry', input.expiresAtMs),
        ],
      );
      const capability = inserted.rows[0];
      if (!capability) {
        await this.abandonIdempotency(idempotencyScope, input, claim.fencingToken);
        return { status: 'conflict' };
      }
      const value = mapCapability(capability);
      await this.completeIdempotency(
        idempotencyScope,
        input,
        claim.fencingToken,
        { kind: 'push_capability', value },
        ttlMs,
      );
      return { status: 'applied', value };
    });
  }

  async revokeCapability(
    input: RevokePushCapabilityInput,
  ): Promise<PushIdempotentMutationResult<PushCapabilityRecord>> {
    const ttlMs = assertIdempotency(input);
    assertPattern('Push registration id hash', input.registrationIdHash, HASH);
    assertPattern('Push registration secret hash', input.registrationSecretHash, HASH);
    assertPattern('Push capability hash', input.capabilityHash, HASH);
    const idempotencyScope = `push.capability.revoke:${input.registrationIdHash}`;

    return this.transaction('revoke push capability', async () => {
      const registration = await this.lockedRegistration(input.registrationIdHash);
      if (!registration) return { status: 'not_found' };
      if (!this.authenticate(registration, input.registrationSecretHash)) {
        return { status: 'unauthorized' };
      }
      const claim = await this.claimIdempotency<unknown>(idempotencyScope, input);
      if (claim.status === 'conflict' || claim.status === 'in_progress') {
        return { status: 'conflict' };
      }
      if (claim.status === 'replay') {
        return { status: 'replay', value: capabilityReplay(claim.result) };
      }
      const updated = await this.query<CapabilityRow>(
        'mark push capability revoked',
        `UPDATE push.capabilities
         SET revoked_at = COALESCE(revoked_at, clock_timestamp()),
             lifecycle_version = CASE
               WHEN revoked_at IS NULL THEN lifecycle_version + 1
               ELSE lifecycle_version
             END
         WHERE capability_hash = decode($1, 'hex')
           AND registration_id_hash = decode($2, 'hex')
         RETURNING ${capabilityColumns('push.capabilities')}`,
        [input.capabilityHash, input.registrationIdHash],
      );
      const capability = updated.rows[0];
      if (!capability) {
        await this.abandonIdempotency(idempotencyScope, input, claim.fencingToken);
        return { status: 'not_found' };
      }
      await this.query(
        'cancel attempts for revoked push capability',
        `UPDATE push.attempts
         SET state = 'cancelled', provider_status = 'unknown',
             last_error_code = 'capability_revoked',
             lease_owner = NULL, leased_until = NULL,
             completed_at = clock_timestamp(), updated_at = clock_timestamp(),
             fencing_token = fencing_token + 1,
             lifecycle_version = lifecycle_version + 1
         WHERE capability_hash = decode($1, 'hex')
           AND state IN ('queued', 'leased', 'retryable')`,
        [input.capabilityHash],
      );
      const value = mapCapability(capability);
      await this.completeIdempotency(
        idempotencyScope,
        input,
        claim.fencingToken,
        { kind: 'push_capability', value },
        ttlMs,
      );
      return { status: 'applied', value };
    });
  }

  async invalidateProviderToken(
    input: InvalidatePushProviderTokenInput,
  ): Promise<PushTokenInvalidationResult> {
    assertPattern('Push registration id hash', input.registrationIdHash, HASH);
    assertPositive('Push token generation', input.tokenGeneration);
    assertTime('Push provider invalidation time', input.nowMs);
    if (!INVALIDATION_REASONS.has(input.reason)) {
      throw new TypeError('Push provider invalidation reason is invalid');
    }

    return this.transaction('invalidate push provider token', async () => {
      const registration = await this.lockedRegistration(input.registrationIdHash);
      if (!registration) return { status: 'not_found' };
      const selected = await this.query<TokenRow>(
        'lock push provider token',
        `SELECT ${tokenColumns('t')}
         FROM push.registration_tokens AS t
         JOIN push.registrations AS r USING (registration_id_hash)
         WHERE t.registration_id_hash = decode($1, 'hex')
           AND t.token_generation = $2
         FOR UPDATE OF t`,
        [input.registrationIdHash, input.tokenGeneration],
      );
      const current = selected.rows[0];
      if (!current) return { status: 'not_found' };
      if (tokenState(current.state) === 'invalidated') {
        return { status: 'already_invalidated', token: mapToken(current) };
      }
      const updated = await this.query<TokenRow>(
        'invalidate push provider token row',
        `UPDATE push.registration_tokens AS t
         SET state = 'invalidated', invalidated_at = clock_timestamp(),
             invalidation_reason = $3, updated_at = clock_timestamp(),
             lifecycle_version = t.lifecycle_version + 1
         FROM push.registrations AS r
         WHERE t.registration_id_hash = decode($1, 'hex')
           AND t.token_generation = $2
           AND r.registration_id_hash = t.registration_id_hash
         RETURNING ${tokenColumns('t')}`,
        [input.registrationIdHash, input.tokenGeneration, input.reason],
      );

      await this.query(
        'cancel attempts for invalidated push provider token',
        `UPDATE push.attempts
         SET state = 'cancelled', provider_status = 'unknown',
             last_error_code = 'provider_token_invalidated',
             lease_owner = NULL, leased_until = NULL,
             completed_at = clock_timestamp(), updated_at = clock_timestamp(),
             fencing_token = fencing_token + 1,
             lifecycle_version = lifecycle_version + 1
         WHERE registration_id_hash = decode($1, 'hex')
           AND token_generation = $2
           AND state IN ('queued', 'leased', 'retryable')`,
        [input.registrationIdHash, input.tokenGeneration],
      );

      const fallback = await this.query<{
        token_ciphertext: unknown;
        token_key_version: unknown;
        token_generation: unknown;
      }>(
        'read legacy push token fallback',
        `SELECT token_ciphertext, token_key_version, token_generation
         FROM push.registration_tokens
         WHERE registration_id_hash = decode($1, 'hex')
           AND (
             (state = 'active' AND expires_at > clock_timestamp())
             OR (state = 'retiring' AND expires_at > clock_timestamp()
               AND retire_after > clock_timestamp())
           )
         ORDER BY token_generation DESC
         LIMIT 1`,
        [input.registrationIdHash],
      );
      const fallbackRow = fallback.rows[0];
      await this.query(
        'update push registration after provider invalidation',
        `UPDATE push.registrations
         SET token_ciphertext = COALESCE($2::bytea, token_ciphertext),
             token_key_version = COALESCE($3::integer, token_key_version),
             token_generation = COALESCE($4::bigint, token_generation),
             updated_at = clock_timestamp(),
             lifecycle_version = lifecycle_version + 1
         WHERE registration_id_hash = decode($1, 'hex')`,
        [
          input.registrationIdHash,
          fallbackRow ? Buffer.from(ciphertext(fallbackRow.token_ciphertext)) : null,
          fallbackRow ? safeInteger('fallback token key version', fallbackRow.token_key_version) : null,
          fallbackRow ? safeInteger('fallback token generation', fallbackRow.token_generation) : null,
        ],
      );
      return { status: 'applied', token: mapToken(updated.rows[0]!) };
    });
  }

  async resolveCapability(input: {
    capabilityHash: string;
    scope: PushCapabilityScope;
    nowMs: number;
  }): Promise<PushCapabilityResolution | null> {
    assertPattern('Push capability hash', input.capabilityHash, HASH);
    assertScope(input.scope);
    assertTime('Push capability resolution time', input.nowMs);
    const selected = await this.query<TokenRow & CapabilityRow>(
      'resolve push capability',
      `SELECT ${capabilityColumns('c')}, r.platform AS provider,
        t.token_generation, t.token_ciphertext, t.token_key_version, t.state,
        t.expires_at AS token_expires_at, t.retire_after, t.invalidated_at,
        t.invalidation_reason, t.created_at AS token_created_at,
        t.updated_at AS token_updated_at, t.lifecycle_version AS token_lifecycle_version
       FROM push.capabilities AS c
       JOIN push.registrations AS r USING (registration_id_hash)
       JOIN push.registration_tokens AS t USING (registration_id_hash)
       WHERE c.capability_hash = decode($1, 'hex')
         AND c.scope = $2
         AND c.revoked_at IS NULL
         AND c.expires_at > clock_timestamp()
         AND r.invalidated_at IS NULL
         AND r.expires_at > clock_timestamp()
         AND (
           (t.state = 'active' AND t.expires_at > clock_timestamp())
           OR (t.state = 'retiring' AND t.expires_at > clock_timestamp()
             AND t.retire_after > clock_timestamp())
         )
       ORDER BY t.token_generation DESC`,
      [input.capabilityHash, input.scope],
    );
    if (selected.rows.length === 0) return null;
    const capability = mapCapability(selected.rows[0]!);
    const deliverableTokens = selected.rows.map((row) => mapToken({
      registration_id_hash: row.registration_id_hash,
      provider: row.provider,
      token_generation: row.token_generation,
      token_ciphertext: row.token_ciphertext,
      token_key_version: row.token_key_version,
      state: row.state,
      expires_at: row.token_expires_at,
      retire_after: row.retire_after,
      invalidated_at: row.invalidated_at,
      invalidation_reason: row.invalidation_reason,
      created_at: row.token_created_at,
      updated_at: row.token_updated_at,
      lifecycle_version: row.token_lifecycle_version,
    }));
    return {
      capability,
      provider: provider(selected.rows[0]!.provider),
      deliverableTokens,
    };
  }

  async getRegistration(registrationIdHash: string): Promise<PushRegistrationRecord | null> {
    assertPattern('Push registration id hash', registrationIdHash, HASH);
    const selected = await this.query<RegistrationRow>(
      'read push registration',
      `SELECT ${registrationColumns('r')},
        encode(r.registration_secret_hash, 'hex') AS registration_secret_hash,
        (r.invalidated_at IS NULL AND r.expires_at > clock_timestamp()) AS is_active
       FROM push.registrations AS r
       WHERE r.registration_id_hash = decode($1, 'hex')`,
      [registrationIdHash],
    );
    const row = selected.rows[0];
    return row ? this.registrationRecord(row) : null;
  }

  async listRegistrations(input: {
    limit?: number;
    before?: PushRegistrationCursor;
  } = {}): Promise<PushRegistrationPage> {
    const pageLimit = input.limit ?? 100;
    assertPositive('Push registration page limit', pageLimit, 500);
    if (input.before) {
      timestamp('registration cursor createdAt', input.before.createdAt);
      assertPattern('Push registration cursor hash', input.before.registrationIdHash, HASH);
    }
    const selected = await this.query<RegistrationRow & TokenRow & { has_token: unknown }>(
      'list push registrations',
      `WITH page AS (
         SELECT r.*
         FROM push.registrations AS r
         WHERE ($2::timestamptz IS NULL OR
           (r.created_at, r.registration_id_hash) <
             ($2::timestamptz, decode($3, 'hex')))
         ORDER BY r.created_at DESC, r.registration_id_hash DESC
         LIMIT $1
       )
       SELECT ${registrationColumns('page', true)},
         (t.registration_id_hash IS NOT NULL) AS has_token,
         t.token_generation, t.token_key_version, t.state,
         t.expires_at AS token_expires_at, t.retire_after, t.invalidated_at,
         t.invalidation_reason, t.created_at AS token_created_at,
         t.updated_at AS token_updated_at, t.lifecycle_version AS token_lifecycle_version
       FROM page
       LEFT JOIN push.registration_tokens AS t USING (registration_id_hash)
       ORDER BY page.created_at DESC, page.registration_id_hash DESC,
         t.token_generation DESC`,
      [
        pageLimit + 1,
        input.before?.createdAt ?? null,
        input.before?.registrationIdHash ?? '0'.repeat(64),
      ],
    );
    const grouped = new Map<string, { row: RegistrationRow; tokens: PushProviderTokenSummary[] }>();
    for (const row of selected.rows) {
      const registrationIdHash = text('registration hash', row.registration_id_hash, HASH);
      let group = grouped.get(registrationIdHash);
      if (!group) {
        group = { row, tokens: [] };
        grouped.set(registrationIdHash, group);
      }
      if (boolean('registration token presence', row.has_token)) {
        group.tokens.push(mapTokenSummary({
          registration_id_hash: registrationIdHash,
          provider: row.provider,
          token_generation: row.token_generation,
          token_key_version: row.token_key_version,
          state: row.state,
          expires_at: row.token_expires_at,
          retire_after: row.retire_after,
          invalidated_at: row.invalidated_at,
          invalidation_reason: row.invalidation_reason,
          created_at: row.token_created_at,
          updated_at: row.token_updated_at,
          lifecycle_version: row.token_lifecycle_version,
        }));
      }
    }
    const allRecords = [...grouped.values()].map(({ row, tokens }) => mapRegistration(row, tokens));
    const records = allRecords.slice(0, pageLimit);
    const tail = records.at(-1);
    return {
      records,
      nextCursor: allRecords.length > records.length && tail
        ? { createdAt: tail.createdAt, registrationIdHash: tail.registrationIdHash }
        : null,
    };
  }

  async stats(nowMs: number): Promise<PushRegistrationStats> {
    assertTime('Push registration stats time', nowMs);
    const selected = await this.query<RegistrationStatsRow>(
      'read push registration stats',
      `SELECT
        (SELECT COUNT(*) FROM push.registrations) AS registrations,
        (SELECT COUNT(*) FROM push.registrations
          WHERE invalidated_at IS NULL AND expires_at > clock_timestamp()) AS active_registrations,
        (SELECT COUNT(*) FROM push.capabilities) AS capabilities,
        (SELECT COUNT(*) FROM push.capabilities AS c
          JOIN push.registrations AS r USING (registration_id_hash)
          WHERE c.revoked_at IS NULL AND c.expires_at > clock_timestamp()
            AND r.invalidated_at IS NULL AND r.expires_at > clock_timestamp()) AS active_capabilities,
        (SELECT COUNT(*) FROM push.registration_tokens
          WHERE state = 'active' AND expires_at > clock_timestamp()) AS active_tokens,
        (SELECT COUNT(*) FROM push.registration_tokens
          WHERE state = 'retiring' AND expires_at > clock_timestamp()
            AND retire_after > clock_timestamp()) AS retiring_tokens,
        (SELECT COUNT(*) FROM push.registration_tokens
          WHERE state = 'invalidated') AS invalidated_tokens,
        (SELECT COUNT(*) FROM push.registration_tokens
          WHERE state <> 'invalidated' AND (
            expires_at <= clock_timestamp()
            OR (state = 'retiring' AND retire_after <= clock_timestamp())
          )) AS expired_tokens`,
    );
    const row = selected.rows[0]!;
    return {
      registrations: safeInteger('registration count', row.registrations),
      activeRegistrations: safeInteger('active registration count', row.active_registrations),
      capabilities: safeInteger('capability count', row.capabilities),
      activeCapabilities: safeInteger('active capability count', row.active_capabilities),
      activeTokens: safeInteger('active token count', row.active_tokens),
      retiringTokens: safeInteger('retiring token count', row.retiring_tokens),
      invalidatedTokens: safeInteger('invalidated token count', row.invalidated_tokens),
      expiredTokens: safeInteger('expired token count', row.expired_tokens),
    };
  }

  async prune(input: PushRegistrationPruneInput): Promise<PushRegistrationPruneResult> {
    assertTime('Push registration prune time', input.nowMs);
    assertTime('Push registration retention cutoff', input.retainedUntilMs);
    assertTime('Push idempotency retention cutoff', input.idempotencyRetainedUntilMs);
    assertPositive('Push registration prune limit', input.limit, 10_000);
    if (input.retainedUntilMs > input.nowMs || input.idempotencyRetainedUntilMs > input.nowMs) {
      throw new RangeError('Push retention cutoffs cannot be in the future');
    }
    return this.transaction('prune push registration state', async () => {
      let budget = input.limit;
      const result: PushRegistrationPruneResult = {
        registrations: 0,
        capabilities: 0,
        tokens: 0,
        idempotencyRecords: 0,
      };
      const tokenDelete = await this.query(
        'prune push token generations',
        `WITH candidates AS (
           SELECT t.registration_id_hash, t.token_generation
           FROM push.registration_tokens AS t
           WHERE (t.state = 'invalidated' OR t.expires_at <= clock_timestamp()
             OR (t.state = 'retiring' AND t.retire_after <= clock_timestamp()))
             AND t.updated_at <= $1
             AND NOT EXISTS (
               SELECT 1 FROM push.attempts AS a
               WHERE a.registration_id_hash = t.registration_id_hash
                 AND a.token_generation = t.token_generation
           )
           ORDER BY t.updated_at, t.registration_id_hash, t.token_generation
           FOR UPDATE OF t SKIP LOCKED
           LIMIT $2
         )
         DELETE FROM push.registration_tokens AS t
         USING candidates AS c
         WHERE t.registration_id_hash = c.registration_id_hash
           AND t.token_generation = c.token_generation`,
        [dateFromMs('Push registration retention cutoff', input.retainedUntilMs), budget],
      );
      result.tokens = tokenDelete.rowCount ?? 0;
      budget -= result.tokens;

      if (budget > 0) {
        const capabilityDelete = await this.query(
          'prune push capabilities',
          `WITH candidates AS (
             SELECT c.capability_hash
             FROM push.capabilities AS c
             WHERE (c.revoked_at IS NOT NULL OR c.expires_at <= clock_timestamp())
               AND COALESCE(c.revoked_at, c.expires_at) <= $1
               AND NOT EXISTS (
                 SELECT 1 FROM push.attempts AS a
                 WHERE a.capability_hash = c.capability_hash
             )
             ORDER BY COALESCE(c.revoked_at, c.expires_at), c.capability_hash
             FOR UPDATE OF c SKIP LOCKED
             LIMIT $2
           )
           DELETE FROM push.capabilities AS c
           USING candidates AS doomed
           WHERE c.capability_hash = doomed.capability_hash`,
          [dateFromMs('Push registration retention cutoff', input.retainedUntilMs), budget],
        );
        result.capabilities = capabilityDelete.rowCount ?? 0;
        budget -= result.capabilities;
      }

      if (budget > 0) {
        const registrationDelete = await this.query(
          'prune push registrations',
          `WITH candidates AS (
             SELECT r.registration_id_hash
             FROM push.registrations AS r
             WHERE (r.invalidated_at IS NOT NULL OR r.expires_at <= clock_timestamp())
               AND COALESCE(r.invalidated_at, r.expires_at) <= $1
               AND NOT EXISTS (
                 SELECT 1 FROM push.registration_tokens AS t
                 WHERE t.registration_id_hash = r.registration_id_hash
               )
               AND NOT EXISTS (
                 SELECT 1 FROM push.capabilities AS c
                 WHERE c.registration_id_hash = r.registration_id_hash
             )
             ORDER BY COALESCE(r.invalidated_at, r.expires_at), r.registration_id_hash
             FOR UPDATE OF r SKIP LOCKED
             LIMIT $2
           )
           DELETE FROM push.registrations AS r
           USING candidates AS doomed
           WHERE r.registration_id_hash = doomed.registration_id_hash`,
          [dateFromMs('Push registration retention cutoff', input.retainedUntilMs), budget],
        );
        result.registrations = registrationDelete.rowCount ?? 0;
        budget -= result.registrations;
      }

      if (budget > 0) {
        const idempotencyDelete = await this.query(
          'prune push registration idempotency',
          `WITH candidates AS (
             SELECT scope, idempotency_key
             FROM ops.idempotency_results
             WHERE (scope LIKE 'push.registration.%'
               OR scope LIKE 'push.capability.%')
               AND expires_at IS NOT NULL
               AND expires_at <= clock_timestamp()
               AND expires_at <= $1
             ORDER BY expires_at, scope, idempotency_key
             FOR UPDATE SKIP LOCKED
             LIMIT $2
           )
           DELETE FROM ops.idempotency_results AS i
           USING candidates AS doomed
           WHERE i.scope = doomed.scope AND i.idempotency_key = doomed.idempotency_key`,
          [dateFromMs('Push idempotency retention cutoff', input.idempotencyRetainedUntilMs), budget],
        );
        result.idempotencyRecords = idempotencyDelete.rowCount ?? 0;
      }
      return result;
    });
  }
}

function validateAttemptInput(input: EnqueuePushAttemptInput): number {
  const ttlMs = assertIdempotency(input);
  assertPattern('Push attempt id', input.attemptId, UUID);
  assertPattern('Push capability hash', input.capabilityHash, HASH);
  assertProvider(input.provider);
  assertPositive('Push token generation', input.tokenGeneration);
  if (input.nextAttemptAtMs !== undefined) {
    assertTime('Push attempt schedule', input.nextAttemptAtMs);
  }
  return ttlMs;
}

function attemptIsTerminal(state: PushAttemptState): boolean {
  return state === 'succeeded' || state === 'failed' || state === 'cancelled';
}

function validateCompletion(input: CompletePushAttemptInput): void {
  assertPattern('Push attempt id', input.attemptId, UUID);
  assertPattern('Push attempt owner', input.owner, SAFE_KEY);
  assertPositive('Push attempt fencing token', input.fencingToken);
  assertTime('Push attempt completion time', input.nowMs);
  const outcome = input.outcome;
  if (!COMPLETION_STATES.has(outcome.state)) {
    throw new TypeError('Push attempt completion state is invalid');
  }
  if (outcome.state === 'succeeded' && outcome.providerStatus !== 'provider_accepted') {
    throw new TypeError('Succeeded push attempts require provider_accepted');
  }
  if (outcome.state === 'retryable' && outcome.providerStatus !== 'unknown') {
    throw new TypeError('Retryable push attempts require unknown provider status');
  }
  if (outcome.state === 'failed'
    && outcome.providerStatus !== 'provider_rejected'
    && outcome.providerStatus !== 'unknown') {
    throw new TypeError('Failed push attempt provider status is invalid');
  }
  if (outcome.state === 'cancelled' && outcome.providerStatus !== 'unknown') {
    throw new TypeError('Cancelled push attempts require unknown provider status');
  }
  if (outcome.state === 'retryable') {
    assertPattern('Push attempt error code', outcome.errorCode, SAFE_CODE);
    assertFuture('Push retry time', outcome.retryAtMs, input.nowMs);
  } else if (outcome.state === 'failed' || outcome.state === 'cancelled') {
    assertPattern('Push attempt error code', outcome.errorCode, SAFE_CODE);
  }
  if ('providerReference' in outcome && outcome.providerReference !== undefined
    && (outcome.providerReference.length === 0
      || outcome.providerReference.length > 512
      || /[\r\n\0]/u.test(outcome.providerReference))) {
    throw new TypeError('Push provider reference is invalid');
  }
}

/** PostgreSQL 17 Plan 42 delivery-attempt queue with DB-time leases and fences. */
export class PostgresPushAttemptStore
  extends PostgresPushStoreBase
  implements PushAttemptStore {
  constructor(database: PostgresStoreContext) {
    super(database, 'push-attempt');
  }

  private async attempt(attemptId: string): Promise<PushAttemptRecord | null> {
    const selected = await this.query<AttemptRow>(
      'read push attempt',
      `SELECT ${attemptColumns('a', true)}
       FROM push.attempts AS a
       WHERE a.attempt_id = $1::uuid
         AND a.address_binding_state = 'bound'`,
      [attemptId],
    );
    return selected.rows[0] ? mapAttempt(selected.rows[0]) : null;
  }

  async enqueue(input: EnqueuePushAttemptInput): Promise<PushAttemptEnqueueResult> {
    const ttlMs = validateAttemptInput(input);
    const idempotencyScope = 'push.attempt.enqueue';
    return this.transaction('enqueue push attempt', async () => {
      const claim = await this.claimIdempotency<unknown>(idempotencyScope, input);
      if (claim.status === 'conflict' || claim.status === 'in_progress') {
        return { status: 'conflict' };
      }
      if (claim.status === 'replay') {
        const attemptId = attemptReplayId(claim.result);
        const replayed = await this.attempt(attemptId);
        if (!replayed) throw new Error('PostgreSQL push idempotency points to a missing attempt');
        return { status: 'replay', attempt: replayed };
      }

      const inserted = await this.query<AttemptRow>(
        'insert push attempt',
        `INSERT INTO push.attempts (
           attempt_id, capability_hash, registration_id_hash, idempotency_key,
           idempotency_key_hash, request_digest, provider, token_generation,
           address_binding_state, provider_status, state, next_attempt_at
         )
         SELECT $1::uuid, c.capability_hash, c.registration_id_hash, $2,
           decode($2, 'hex'), decode($3, 'hex'), $4, $5, 'bound', 'pending', 'queued',
           COALESCE($7::timestamptz, clock_timestamp())
         FROM push.capabilities AS c
         JOIN push.registrations AS r USING (registration_id_hash)
         JOIN push.registration_tokens AS t
           ON t.registration_id_hash = c.registration_id_hash
          AND t.token_generation = $5
         WHERE c.capability_hash = decode($6, 'hex')
           AND c.revoked_at IS NULL AND c.expires_at > clock_timestamp()
           AND r.invalidated_at IS NULL AND r.expires_at > clock_timestamp()
           AND r.platform = $4
           AND (
             (t.state = 'active' AND t.expires_at > clock_timestamp())
             OR (t.state = 'retiring' AND t.expires_at > clock_timestamp()
               AND t.retire_after > clock_timestamp())
           )
         ON CONFLICT DO NOTHING
         RETURNING ${attemptColumns('push.attempts')}`,
        [
          input.attemptId,
          input.idempotencyKey,
          input.requestDigestHex,
          input.provider,
          input.tokenGeneration,
          input.capabilityHash,
          input.nextAttemptAtMs === undefined
            ? null
            : dateFromMs('Push attempt schedule', input.nextAttemptAtMs),
        ],
      );
      const row = inserted.rows[0];
      if (!row) {
        await this.abandonIdempotency(idempotencyScope, input, claim.fencingToken);
        return { status: 'conflict' };
      }
      const attempt = mapAttempt(row);
      await this.completeIdempotency(
        idempotencyScope,
        input,
        claim.fencingToken,
        { kind: 'push_attempt', attemptId: attempt.attemptId },
        ttlMs,
      );
      return { status: 'created', attempt };
    });
  }

  async claim(input: ClaimPushAttemptsInput): Promise<PushAttemptRecord[]> {
    assertPattern('Push attempt owner', input.owner, SAFE_KEY);
    assertPositive('Push attempt claim limit', input.limit, 1000);
    assertPositive('Push attempt lease', input.leaseMs, MAX_LEASE_MS);
    assertTime('Push attempt claim time', input.nowMs);
    const claimed = await this.query<AttemptRow>(
      'claim push attempts',
      `WITH invalid_candidates AS MATERIALIZED (
         SELECT a.attempt_id
         FROM push.attempts AS a
         LEFT JOIN push.capabilities AS c
           ON c.capability_hash = a.capability_hash
         LEFT JOIN push.registrations AS r
           ON r.registration_id_hash = a.registration_id_hash
         LEFT JOIN push.registration_tokens AS t
           ON t.registration_id_hash = a.registration_id_hash
          AND t.token_generation = a.token_generation
         WHERE a.state IN ('queued', 'leased', 'retryable')
           AND a.address_binding_state = 'bound'
           AND (
             c.capability_hash IS NULL
             OR c.registration_id_hash <> a.registration_id_hash
             OR c.revoked_at IS NOT NULL
             OR c.expires_at <= clock_timestamp()
             OR r.registration_id_hash IS NULL
             OR r.invalidated_at IS NOT NULL
             OR r.expires_at <= clock_timestamp()
             OR r.platform <> a.provider
             OR t.registration_id_hash IS NULL
             OR NOT (
               (t.state = 'active' AND t.expires_at > clock_timestamp())
               OR (t.state = 'retiring' AND t.expires_at > clock_timestamp()
                 AND t.retire_after > clock_timestamp())
             )
           )
         ORDER BY a.created_at, a.attempt_id
         FOR UPDATE OF a SKIP LOCKED
         LIMIT $1
       ), cancelled AS (
         UPDATE push.attempts AS a
         SET state = 'cancelled', provider_status = 'unknown',
             last_error_code = 'address_unavailable',
             lease_owner = NULL, leased_until = NULL,
             completed_at = clock_timestamp(), updated_at = clock_timestamp(),
             fencing_token = fencing_token + 1,
             lifecycle_version = lifecycle_version + 1
         FROM invalid_candidates AS invalid
         WHERE a.attempt_id = invalid.attempt_id
       ), candidates AS MATERIALIZED (
         SELECT a.attempt_id
         FROM push.attempts AS a
         JOIN push.capabilities AS c
           ON c.capability_hash = a.capability_hash
          AND c.registration_id_hash = a.registration_id_hash
         JOIN push.registrations AS r
           ON r.registration_id_hash = a.registration_id_hash
         JOIN push.registration_tokens AS t
           ON t.registration_id_hash = a.registration_id_hash
          AND t.token_generation = a.token_generation
         WHERE ((a.state IN ('queued', 'retryable')
             AND a.next_attempt_at <= clock_timestamp())
           OR (a.state = 'leased' AND a.leased_until <= clock_timestamp()))
           AND a.address_binding_state = 'bound'
           AND c.revoked_at IS NULL
           AND c.expires_at > clock_timestamp()
           AND r.invalidated_at IS NULL
           AND r.expires_at > clock_timestamp()
           AND r.platform = a.provider
           AND (
             (t.state = 'active' AND t.expires_at > clock_timestamp())
             OR (t.state = 'retiring' AND t.expires_at > clock_timestamp()
               AND t.retire_after > clock_timestamp())
           )
         ORDER BY a.next_attempt_at, a.attempt_id
         FOR UPDATE OF a SKIP LOCKED
         LIMIT $1
       ), updated AS (
         UPDATE push.attempts AS a
         SET state = 'leased', provider_status = 'pending', lease_owner = $2,
             leased_until = clock_timestamp() + ($3::bigint * interval '1 millisecond'),
             attempt_count = attempt_count + 1,
             fencing_token = fencing_token + 1,
             updated_at = clock_timestamp(),
             lifecycle_version = lifecycle_version + 1
         FROM candidates AS c
         WHERE a.attempt_id = c.attempt_id
         RETURNING ${attemptColumns('a')}
       )
       SELECT * FROM updated ORDER BY next_attempt_at, attempt_id`,
      [input.limit, input.owner, input.leaseMs],
    );
    return claimed.rows.map(mapAttempt);
  }

  async renew(input: RenewPushAttemptInput): Promise<PushFencedAttemptResult> {
    assertPattern('Push attempt id', input.attemptId, UUID);
    assertPattern('Push attempt owner', input.owner, SAFE_KEY);
    assertPositive('Push attempt fencing token', input.fencingToken);
    assertPositive('Push attempt lease', input.leaseMs, MAX_LEASE_MS);
    assertTime('Push attempt renewal time', input.nowMs);
    return this.transaction('renew push attempt lease', async () => {
      const updated = await this.query<AttemptRow>(
        'renew fenced push attempt lease',
        `UPDATE push.attempts AS a
         SET leased_until = GREATEST(
               leased_until,
               clock_timestamp() + ($4::bigint * interval '1 millisecond')
             ),
             updated_at = clock_timestamp(),
             lifecycle_version = lifecycle_version + 1
         WHERE attempt_id = $1::uuid
           AND address_binding_state = 'bound'
           AND state = 'leased'
           AND lease_owner = $2
           AND fencing_token = $3
           AND leased_until > clock_timestamp()
         RETURNING ${attemptColumns('a')}`,
        [input.attemptId, input.owner, input.fencingToken, input.leaseMs],
      );
      if (updated.rows[0]) return { status: 'applied', attempt: mapAttempt(updated.rows[0]) };
      const exists = await this.query<CountRow>(
        'check push attempt after stale renewal',
        `SELECT COUNT(*) AS count FROM push.attempts
         WHERE attempt_id = $1::uuid AND address_binding_state = 'bound'`,
        [input.attemptId],
      );
      return safeInteger('attempt existence count', exists.rows[0]?.count) === 0
        ? { status: 'not_found' }
        : { status: 'stale' };
    });
  }

  async complete(input: CompletePushAttemptInput): Promise<PushFencedAttemptResult> {
    validateCompletion(input);
    const outcome = input.outcome;
    const reference = 'providerReference' in outcome
      ? outcome.providerReference ?? null
      : null;
    const errorCode = 'errorCode' in outcome ? outcome.errorCode : null;
    const retryAt = outcome.state === 'retryable'
      ? dateFromMs('Push retry time', outcome.retryAtMs)
      : null;
    return this.transaction('complete push attempt', async () => {
      const updated = await this.query<AttemptRow>(
        'complete fenced push attempt',
        `UPDATE push.attempts AS a
         SET state = $4, provider_status = $5, provider_reference = $6,
             last_error_code = $7,
             next_attempt_at = CASE
               WHEN $4 = 'retryable' THEN $8::timestamptz
               ELSE clock_timestamp()
             END,
             completed_at = CASE
               WHEN $4 IN ('succeeded', 'failed', 'cancelled') THEN clock_timestamp()
               ELSE NULL
             END,
             lease_owner = NULL, leased_until = NULL,
             updated_at = clock_timestamp(),
             lifecycle_version = lifecycle_version + 1
         WHERE attempt_id = $1::uuid
           AND address_binding_state = 'bound'
           AND state = 'leased'
           AND lease_owner = $2
           AND fencing_token = $3
           AND leased_until > clock_timestamp()
         RETURNING ${attemptColumns('a')}`,
        [
          input.attemptId,
          input.owner,
          input.fencingToken,
          outcome.state,
          outcome.providerStatus,
          reference,
          errorCode,
          retryAt,
        ],
      );
      if (updated.rows[0]) return { status: 'applied', attempt: mapAttempt(updated.rows[0]) };
      const exists = await this.query<CountRow>(
        'check push attempt after stale completion',
        `SELECT COUNT(*) AS count FROM push.attempts
         WHERE attempt_id = $1::uuid AND address_binding_state = 'bound'`,
        [input.attemptId],
      );
      return safeInteger('attempt existence count', exists.rows[0]?.count) === 0
        ? { status: 'not_found' }
        : { status: 'stale' };
    });
  }

  async cancelByCapability(input: {
    capabilityHash: string;
    reasonCode: string;
    nowMs: number;
    limit: number;
  }): Promise<number> {
    assertPattern('Push capability hash', input.capabilityHash, HASH);
    assertPattern('Push cancellation code', input.reasonCode, SAFE_CODE);
    assertTime('Push cancellation time', input.nowMs);
    assertPositive('Push cancellation limit', input.limit, 10_000);
    const updated = await this.query(
      'cancel push attempts by capability',
      `WITH candidates AS MATERIALIZED (
         SELECT attempt_id
         FROM push.attempts
         WHERE capability_hash = decode($1, 'hex')
           AND state IN ('queued', 'leased', 'retryable')
         ORDER BY created_at, attempt_id
         FOR UPDATE SKIP LOCKED
         LIMIT $2
       )
       UPDATE push.attempts AS a
       SET state = 'cancelled', provider_status = 'unknown',
           last_error_code = $3, lease_owner = NULL, leased_until = NULL,
           completed_at = clock_timestamp(), updated_at = clock_timestamp(),
           fencing_token = fencing_token + 1,
           lifecycle_version = lifecycle_version + 1
       FROM candidates AS c
       WHERE a.attempt_id = c.attempt_id`,
      [input.capabilityHash, input.limit, input.reasonCode],
    );
    return updated.rowCount ?? 0;
  }

  async getStatus(input: {
    attemptId: string;
    capabilityHash: string;
  }): Promise<PushAttemptStatus | null> {
    assertPattern('Push attempt id', input.attemptId, UUID);
    assertPattern('Push capability hash', input.capabilityHash, HASH);
    const selected = await this.query<{
      attempt_id: unknown;
      provider_status: unknown;
      provider_reference: unknown;
      state: unknown;
      created_at: unknown;
      updated_at: unknown;
    }>(
      'read push attempt status',
      `SELECT attempt_id::text AS attempt_id, provider_status, provider_reference,
         state, created_at, updated_at
       FROM push.attempts
       WHERE attempt_id = $1::uuid
         AND capability_hash = decode($2, 'hex')
         AND address_binding_state = 'bound'`,
      [input.attemptId, input.capabilityHash],
    );
    const row = selected.rows[0];
    if (!row) return null;
    const storedStatus = providerStatus(row.provider_status);
    const reference = nullableText('provider reference', row.provider_reference);
    return {
      attemptId: text('attempt id', row.attempt_id, UUID),
      providerStatus: storedStatus === 'pending' ? 'unknown' : storedStatus,
      ...(reference === null ? {} : { providerReference: reference }),
      terminal: attemptIsTerminal(attemptState(row.state)),
      createdAt: timestamp('attempt created_at', row.created_at),
      updatedAt: timestamp('attempt updated_at', row.updated_at),
    };
  }

  async list(input: {
    state?: PushAttemptState;
    limit?: number;
    before?: PushAttemptCursor;
  } = {}): Promise<PushAttemptPage> {
    if (input.state !== undefined && !ATTEMPT_STATES.has(input.state)) {
      throw new TypeError('Push attempt state is invalid');
    }
    const pageLimit = input.limit ?? 100;
    assertPositive('Push attempt page limit', pageLimit, 500);
    if (input.before) {
      timestamp('attempt cursor createdAt', input.before.createdAt);
      assertPattern('Push attempt cursor id', input.before.attemptId, UUID);
    }
    const selected = await this.query<AttemptRow>(
      'list push attempts',
      `SELECT ${attemptColumns('a', true)}
       FROM push.attempts AS a
       WHERE a.address_binding_state = 'bound'
         AND ($1::text IS NULL OR a.state = $1)
         AND ($3::timestamptz IS NULL OR
           (a.created_at, a.attempt_id) < ($3::timestamptz, $4::uuid))
       ORDER BY a.created_at DESC, a.attempt_id DESC
       LIMIT $2`,
      [
        input.state ?? null,
        pageLimit + 1,
        input.before?.createdAt ?? null,
        input.before?.attemptId ?? '00000000-0000-4000-8000-000000000000',
      ],
    );
    const allRecords = selected.rows.map(mapAttempt);
    const records = allRecords.slice(0, pageLimit);
    const tail = records.at(-1);
    return {
      records,
      nextCursor: allRecords.length > records.length && tail
        ? { createdAt: tail.createdAt, attemptId: tail.attemptId }
        : null,
    };
  }

  async stats(nowMs: number): Promise<PushAttemptStats> {
    assertTime('Push attempt stats time', nowMs);
    const selected = await this.query<AttemptStatsRow>(
      'read push attempt stats',
      `SELECT
         COUNT(*) FILTER (WHERE state = 'queued') AS queued,
         COUNT(*) FILTER (WHERE state = 'leased') AS leased,
         COUNT(*) FILTER (WHERE state = 'retryable') AS retryable,
         COUNT(*) FILTER (WHERE state = 'succeeded') AS succeeded,
         COUNT(*) FILTER (WHERE state = 'failed') AS failed,
         COUNT(*) FILTER (WHERE state = 'cancelled') AS cancelled,
         COUNT(*) FILTER (WHERE
           (state IN ('queued', 'retryable') AND next_attempt_at <= clock_timestamp())
           OR (state = 'leased' AND leased_until <= clock_timestamp())
         ) AS due,
         COUNT(*) AS total
       FROM push.attempts
       WHERE address_binding_state = 'bound'`,
    );
    const row = selected.rows[0]!;
    return {
      queued: safeInteger('queued attempt count', row.queued),
      leased: safeInteger('leased attempt count', row.leased),
      retryable: safeInteger('retryable attempt count', row.retryable),
      succeeded: safeInteger('succeeded attempt count', row.succeeded),
      failed: safeInteger('failed attempt count', row.failed),
      cancelled: safeInteger('cancelled attempt count', row.cancelled),
      due: safeInteger('due attempt count', row.due),
      total: safeInteger('total attempt count', row.total),
    };
  }

  async prune(input: PushAttemptPruneInput): Promise<PushAttemptPruneResult> {
    assertTime('Push attempt prune time', input.nowMs);
    assertTime('Push attempt retention cutoff', input.completedBeforeMs);
    assertTime('Push idempotency retention cutoff', input.idempotencyRetainedUntilMs);
    assertPositive('Push attempt prune limit', input.limit, 10_000);
    if (input.completedBeforeMs > input.nowMs || input.idempotencyRetainedUntilMs > input.nowMs) {
      throw new RangeError('Push attempt retention cutoffs cannot be in the future');
    }
    return this.transaction('prune push attempts', async () => {
      let budget = input.limit;
      const result: PushAttemptPruneResult = { attempts: 0, idempotencyRecords: 0 };
      const idempotencyDelete = await this.query(
        'prune push attempt idempotency',
        `WITH candidates AS (
           SELECT scope, idempotency_key
           FROM ops.idempotency_results
           WHERE scope = 'push.attempt.enqueue'
             AND expires_at IS NOT NULL
             AND expires_at <= clock_timestamp()
             AND expires_at <= $1
           ORDER BY expires_at, idempotency_key
           FOR UPDATE SKIP LOCKED
           LIMIT $2
         )
         DELETE FROM ops.idempotency_results AS i
         USING candidates AS doomed
         WHERE i.scope = doomed.scope AND i.idempotency_key = doomed.idempotency_key`,
        [dateFromMs('Push idempotency retention cutoff', input.idempotencyRetainedUntilMs), budget],
      );
      result.idempotencyRecords = idempotencyDelete.rowCount ?? 0;
      budget -= result.idempotencyRecords;

      if (budget > 0) {
        const attemptDelete = await this.query(
          'prune terminal push attempts',
          `WITH candidates AS (
             SELECT a.attempt_id
             FROM push.attempts AS a
             WHERE a.state IN ('succeeded', 'failed', 'cancelled')
               AND a.address_binding_state = 'bound'
               AND a.completed_at <= $1
               AND NOT EXISTS (
                 SELECT 1 FROM ops.idempotency_results AS i
                 WHERE i.scope = 'push.attempt.enqueue'
                   AND i.state = 'committed'
                   AND i.expires_at > clock_timestamp()
                   AND i.result ->> 'attemptId' = a.attempt_id::text
             )
             ORDER BY a.completed_at, a.attempt_id
             FOR UPDATE OF a SKIP LOCKED
             LIMIT $2
           )
           DELETE FROM push.attempts AS a
           USING candidates AS doomed
           WHERE a.attempt_id = doomed.attempt_id`,
          [dateFromMs('Push attempt retention cutoff', input.completedBeforeMs), budget],
        );
        result.attempts = attemptDelete.rowCount ?? 0;
      }
      return result;
    });
  }
}
