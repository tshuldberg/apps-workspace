import { verifyPersonaClaim } from '@mylife/sync';
import type { QueryResult, QueryResultRow } from 'pg';
import type {
  AliasReleaseTombstone,
  BeginPersonaRegistrationOutcome,
  CommitPersonaRegistrationOutcome,
  PersonaRecord,
  PersonaRegistrationAttempt,
  PersonaRegistrationAttemptState,
  PersonaRegistryStore,
  TryRegisterOutcome,
} from '../../persona-registry';
import {
  PostgresStoreContext,
  toPostgresStoreUnavailableError,
} from '../store-context';

interface PersonaRow extends QueryResultRow {
  alias: unknown;
  persona_pubkey: unknown;
  created_at: unknown;
  payload: unknown;
}

interface TombstoneRow extends QueryResultRow {
  alias: unknown;
  released_at: unknown;
  cooldown_until: unknown;
  payload: unknown;
  active?: unknown;
}

interface PersonaStatsRow extends QueryResultRow {
  personas: unknown;
  tombstones: unknown;
  revoked: unknown;
}

interface RegistrationAttemptRow extends QueryResultRow {
  attempt_id: unknown;
  request_digest: unknown;
  alias: unknown;
  persona_pubkey: unknown;
  state: unknown;
  record_payload: unknown;
  created_at: unknown;
  updated_at: unknown;
}

const ALIAS_RE = /^[a-z0-9_]{3,20}$/;
const PUBKEY_RE = /^[0-9a-f]{64}$/;
const MAX_BATCH_SIZE = 200;
const REGISTRATION_STATES = new Set<PersonaRegistrationAttemptState>([
  'reserved',
  'humanity_verified',
  'committed',
]);

function jsonObject(value: unknown, label: string): Record<string, unknown> {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      throw new Error(`PostgreSQL ${label} contains invalid JSON.`);
    }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`PostgreSQL ${label} must be a JSON object.`);
  }
  return parsed as Record<string, unknown>;
}

function timestampMs(value: unknown, label: string): number {
  const parsed = value instanceof Date
    ? value.getTime()
    : typeof value === 'string' || typeof value === 'number'
      ? new Date(value).getTime()
      : Number.NaN;
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`PostgreSQL ${label} contains an invalid timestamp.`);
  }
  return parsed;
}

function safeCount(value: unknown, label: string): number {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'bigint'
      ? Number(value)
      : typeof value === 'string' && /^\d+$/u.test(value)
        ? Number(value)
        : Number.NaN;
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`PostgreSQL ${label} contains an invalid count.`);
  }
  return parsed;
}

function assertAlias(alias: string): void {
  if (!ALIAS_RE.test(alias)) throw new TypeError('Persona alias must be canonical.');
}

function assertPubkey(personaPubkey: string): void {
  if (!PUBKEY_RE.test(personaPubkey)) {
    throw new TypeError('Persona public key must be 64 lowercase hexadecimal characters.');
  }
}

function normalizeRevocationReason(reason: string | undefined): string {
  const normalized = reason ?? 'unspecified';
  if (normalized.length === 0 || normalized.length > 512) {
    throw new TypeError('Persona revocation reason must be between 1 and 512 characters.');
  }
  return normalized;
}

function validateRecord(record: PersonaRecord): void {
  assertAlias(record.alias);
  assertPubkey(record.personaPubkey);
  if (record.version !== 1
    || typeof record.humanityBinding !== 'string'
    || record.humanityBinding.length === 0
    || record.humanityBinding.length > 256
    || verifyPersonaClaim(record.claim) !== 'ok'
    || record.claim.alias !== record.alias
    || record.claim.personaPubkey !== record.personaPubkey) {
    throw new TypeError('Persona record is invalid.');
  }
  timestampMs(record.createdAt, 'persona record createdAt');
}

function validateTombstone(tombstone: AliasReleaseTombstone): void {
  assertAlias(tombstone.alias);
  assertPubkey(tombstone.personaPubkey);
  const releasedAtMs = timestampMs(tombstone.releasedAt, 'persona tombstone releasedAt');
  if (!Number.isSafeInteger(tombstone.reregisterBlockedUntilMs)
    || tombstone.reregisterBlockedUntilMs < releasedAtMs) {
    throw new TypeError('Persona tombstone cooldown is invalid.');
  }
}

function validateRegistrationAttempt(attempt: PersonaRegistrationAttempt): void {
  if (attempt.version !== 1
    || !/^[0-9a-f]{64}$/u.test(attempt.attemptId)
    || !/^[0-9a-f]{64}$/u.test(attempt.requestDigest)
    || !REGISTRATION_STATES.has(attempt.state)) {
    throw new TypeError('Persona registration attempt is invalid.');
  }
  validateRecord(attempt.record);
  timestampMs(attempt.createdAt, 'persona registration attempt createdAt');
  timestampMs(attempt.updatedAt, 'persona registration attempt updatedAt');
}

function sameRegistrationAttempt(
  existing: PersonaRegistrationAttempt,
  candidate: PersonaRegistrationAttempt,
): boolean {
  return existing.requestDigest === candidate.requestDigest
    && existing.record.alias === candidate.record.alias
    && existing.record.personaPubkey === candidate.record.personaPubkey
    && existing.record.humanityBinding === candidate.record.humanityBinding
    && existing.record.claim.signature === candidate.record.claim.signature;
}

function decodePersona(row: PersonaRow): PersonaRecord {
  if (typeof row.alias !== 'string' || typeof row.persona_pubkey !== 'string') {
    throw new Error('PostgreSQL persona record has invalid identity columns.');
  }
  const payload = jsonObject(row.payload, 'persona record payload') as unknown as PersonaRecord;
  try {
    validateRecord(payload);
  } catch (error) {
    throw new Error('PostgreSQL persona record payload is invalid.', { cause: error });
  }
  const createdAtMs = timestampMs(row.created_at, 'persona record created_at');
  if (payload.alias !== row.alias
    || payload.personaPubkey !== row.persona_pubkey
    || timestampMs(payload.createdAt, 'persona record payload createdAt') !== createdAtMs) {
    throw new Error('PostgreSQL persona record columns and payload do not match.');
  }
  return payload;
}

function decodeTombstone(row: TombstoneRow): AliasReleaseTombstone {
  if (typeof row.alias !== 'string') {
    throw new Error('PostgreSQL persona tombstone has an invalid alias.');
  }
  const payload = jsonObject(
    row.payload,
    'persona alias tombstone payload',
  ) as unknown as AliasReleaseTombstone;
  try {
    validateTombstone(payload);
  } catch (error) {
    throw new Error('PostgreSQL persona alias tombstone payload is invalid.', { cause: error });
  }
  const releasedAtMs = timestampMs(row.released_at, 'persona tombstone released_at');
  const cooldownUntilMs = timestampMs(row.cooldown_until, 'persona tombstone cooldown_until');
  if (payload.alias !== row.alias
    || timestampMs(payload.releasedAt, 'persona tombstone payload releasedAt') !== releasedAtMs
    || payload.reregisterBlockedUntilMs !== cooldownUntilMs) {
    throw new Error('PostgreSQL persona tombstone columns and payload do not match.');
  }
  return payload;
}

function decodeRegistrationAttempt(row: RegistrationAttemptRow): PersonaRegistrationAttempt {
  if (typeof row.attempt_id !== 'string'
    || typeof row.request_digest !== 'string'
    || typeof row.alias !== 'string'
    || typeof row.persona_pubkey !== 'string'
    || typeof row.state !== 'string'
    || !REGISTRATION_STATES.has(row.state as PersonaRegistrationAttemptState)) {
    throw new Error('PostgreSQL persona registration attempt has invalid identity columns.');
  }
  const record = jsonObject(
    row.record_payload,
    'persona registration attempt payload',
  ) as unknown as PersonaRecord;
  const attempt: PersonaRegistrationAttempt = {
    version: 1,
    attemptId: row.attempt_id,
    requestDigest: row.request_digest,
    state: row.state as PersonaRegistrationAttemptState,
    record,
    createdAt: new Date(timestampMs(
      row.created_at,
      'persona registration attempt created_at',
    )).toISOString(),
    updatedAt: new Date(timestampMs(
      row.updated_at,
      'persona registration attempt updated_at',
    )).toISOString(),
  };
  try {
    validateRegistrationAttempt(attempt);
  } catch (error) {
    throw new Error('PostgreSQL persona registration attempt payload is invalid.', { cause: error });
  }
  if (record.alias !== row.alias || record.personaPubkey !== row.persona_pubkey) {
    throw new Error('PostgreSQL persona registration attempt columns and payload do not match.');
  }
  return attempt;
}

/** PostgreSQL-backed persona registry with cross-replica lifecycle serialization. */
export class PostgresPersonaRegistryStore implements PersonaRegistryStore {
  constructor(private readonly context: PostgresStoreContext) {}

  private async query<Row extends QueryResultRow = QueryResultRow>(
    operation: string,
    text: string,
    values: readonly unknown[] = [],
  ): Promise<QueryResult<Row>> {
    try {
      return await this.context.query<Row>(text, values);
    } catch (error) {
      throw toPostgresStoreUnavailableError(operation, error);
    }
  }

  private async withAliasWriteLock<T>(alias: string, operation: () => Promise<T>): Promise<T> {
    try {
      return await this.context.withAdvisoryTransactionLock(
        'persona-alias-write',
        alias,
        operation,
      );
    } catch (error) {
      throw toPostgresStoreUnavailableError('lock persona alias write', error);
    }
  }

  private async withRegistrationAttemptLock<T>(
    attemptId: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    try {
      return await this.context.withAdvisoryTransactionLock(
        'persona-registration-attempt',
        attemptId,
        operation,
      );
    } catch (error) {
      throw toPostgresStoreUnavailableError('lock persona registration attempt', error);
    }
  }

  async withPersonaWriteLock<T>(
    personaPubkey: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    assertPubkey(personaPubkey);
    try {
      return await this.context.withAdvisoryTransactionLock(
        'persona-lifecycle-write',
        personaPubkey,
        operation,
      );
    } catch (error) {
      throw toPostgresStoreUnavailableError('lock persona lifecycle write', error);
    }
  }

  async beginRegistrationAttempt(
    attempt: PersonaRegistrationAttempt,
    _nowMs?: number,
  ): Promise<BeginPersonaRegistrationOutcome> {
    validateRegistrationAttempt(attempt);
    return this.withPersonaWriteLock(attempt.record.personaPubkey, () => (
      this.withAliasWriteLock(attempt.record.alias, () => (
        this.withRegistrationAttemptLock(attempt.attemptId, async () => {
          await this.query(
            'release expired persona registration reservations',
            `DELETE FROM persona.registration_attempts
             WHERE state = 'reserved'
               AND reservation_expires_at <= clock_timestamp()
               AND (attempt_id = $1 OR alias = $2 OR persona_pubkey = $3)`,
            [attempt.attemptId, attempt.record.alias, attempt.record.personaPubkey],
          );
          const tombstoneResult = await this.query<TombstoneRow>(
            'check persona registration attempt cooldown',
            `SELECT alias, released_at, cooldown_until, payload,
               cooldown_until > clock_timestamp() AS active
             FROM persona.alias_tombstones
             WHERE alias = $1
             FOR UPDATE`,
            [attempt.record.alias],
          );
          const tombstone = tombstoneResult.rows[0];
          if (tombstone) {
            decodeTombstone(tombstone);
            if (tombstone.active !== false) return 'alias_cooldown';
            await this.query(
              'delete expired persona registration tombstone',
              'DELETE FROM persona.alias_tombstones WHERE alias = $1',
              [attempt.record.alias],
            );
          }

          const revoked = await this.query(
            'check persona registration attempt revocation',
            'SELECT 1 FROM persona.revocations WHERE persona_pubkey = $1',
            [attempt.record.personaPubkey],
          );
          if (revoked.rowCount === 1) return 'persona_revoked';

          const existingResult = await this.query<RegistrationAttemptRow>(
            'read persona registration attempt',
            `SELECT attempt_id, request_digest, alias, persona_pubkey, state,
               record_payload, created_at, updated_at
             FROM persona.registration_attempts
             WHERE attempt_id = $1
             FOR UPDATE`,
            [attempt.attemptId],
          );
          const existingRow = existingResult.rows[0];
          if (existingRow) {
            const existing = decodeRegistrationAttempt(existingRow);
            if (!sameRegistrationAttempt(existing, attempt)) return 'attempt_conflict';
            if (existing.state === 'committed') return 'committed';
            return existing.state === 'humanity_verified'
              ? 'humanity_verified'
              : 'resume_reserved';
          }

          const aliasOwner = await this.query(
            'check active persona alias before reservation',
            'SELECT 1 FROM persona.records WHERE alias = $1',
            [attempt.record.alias],
          );
          if (aliasOwner.rowCount === 1) return 'alias_taken';
          const pubkeyOwner = await this.query(
            'check active persona key before reservation',
            'SELECT 1 FROM persona.records WHERE persona_pubkey = $1',
            [attempt.record.personaPubkey],
          );
          if (pubkeyOwner.rowCount === 1) return 'pubkey_taken';
          const pending = await this.query<{ alias_conflict: unknown; pubkey_conflict: unknown }>(
            'check pending persona registration conflicts',
            `SELECT
               EXISTS (
                 SELECT 1 FROM persona.registration_attempts
                 WHERE alias = $1 AND state IN ('reserved', 'humanity_verified')
               ) AS alias_conflict,
               EXISTS (
                 SELECT 1 FROM persona.registration_attempts
                 WHERE persona_pubkey = $2 AND state IN ('reserved', 'humanity_verified')
               ) AS pubkey_conflict`,
            [attempt.record.alias, attempt.record.personaPubkey],
          );
          if (pending.rows[0]?.alias_conflict === true) return 'alias_taken';
          if (pending.rows[0]?.pubkey_conflict === true) return 'pubkey_taken';

          await this.query(
            'reserve persona registration attempt',
            `INSERT INTO persona.registration_attempts (
               attempt_id, request_digest, alias, persona_pubkey, state,
               record_payload
             ) VALUES ($1, $2, $3, $4, 'reserved', $5::jsonb)`,
            [
              attempt.attemptId,
              attempt.requestDigest,
              attempt.record.alias,
              attempt.record.personaPubkey,
              JSON.stringify(attempt.record),
            ],
          );
          return 'reserved';
        })
      ))
    ));
  }

  async markRegistrationHumanityVerified(
    attemptId: string,
    requestDigest: string,
  ): Promise<'ok' | 'not_found' | 'attempt_conflict'> {
    if (!/^[0-9a-f]{64}$/u.test(attemptId) || !/^[0-9a-f]{64}$/u.test(requestDigest)) {
      throw new TypeError('Persona registration attempt identity is invalid.');
    }
    return this.withRegistrationAttemptLock(attemptId, async () => {
      const result = await this.query<RegistrationAttemptRow>(
        'lock persona registration attempt for humanity success',
        `SELECT attempt_id, request_digest, alias, persona_pubkey, state,
           record_payload, created_at, updated_at
         FROM persona.registration_attempts
         WHERE attempt_id = $1
         FOR UPDATE`,
        [attemptId],
      );
      const row = result.rows[0];
      if (!row) return 'not_found';
      const attempt = decodeRegistrationAttempt(row);
      if (attempt.requestDigest !== requestDigest) return 'attempt_conflict';
      if (attempt.state === 'reserved') {
        await this.query(
          'mark persona registration humanity verified',
          `UPDATE persona.registration_attempts
           SET state = 'humanity_verified',
             lifecycle_version = lifecycle_version + 1,
             updated_at = clock_timestamp()
           WHERE attempt_id = $1`,
          [attemptId],
        );
      }
      return 'ok';
    });
  }

  async commitRegistrationAttempt(
    attemptId: string,
    requestDigest: string,
    _nowMs?: number,
  ): Promise<CommitPersonaRegistrationOutcome> {
    if (!/^[0-9a-f]{64}$/u.test(attemptId) || !/^[0-9a-f]{64}$/u.test(requestDigest)) {
      throw new TypeError('Persona registration attempt identity is invalid.');
    }
    const observedResult = await this.query<RegistrationAttemptRow>(
      'locate persona registration attempt for commit',
      `SELECT attempt_id, request_digest, alias, persona_pubkey, state,
         record_payload, created_at, updated_at
       FROM persona.registration_attempts
       WHERE attempt_id = $1`,
      [attemptId],
    );
    const observedRow = observedResult.rows[0];
    if (!observedRow) return { outcome: 'not_found' };
    const observed = decodeRegistrationAttempt(observedRow);

    return this.withPersonaWriteLock(observed.record.personaPubkey, () => (
      this.withAliasWriteLock(observed.record.alias, () => (
        this.withRegistrationAttemptLock(attemptId, async () => {
          const attemptResult = await this.query<RegistrationAttemptRow>(
            'lock persona registration attempt for commit',
            `SELECT attempt_id, request_digest, alias, persona_pubkey, state,
               record_payload, created_at, updated_at
             FROM persona.registration_attempts
             WHERE attempt_id = $1
             FOR UPDATE`,
            [attemptId],
          );
          const attemptRow = attemptResult.rows[0];
          if (!attemptRow) return { outcome: 'not_found' };
          const attempt = decodeRegistrationAttempt(attemptRow);
          if (attempt.requestDigest !== requestDigest) return { outcome: 'attempt_conflict' };
          const record = attempt.record;
          if (attempt.state === 'committed') {
            const active = await this.getByAlias(record.alias);
            return active?.personaPubkey === record.personaPubkey
              ? { outcome: 'ok', record: active }
              : { outcome: 'not_found' };
          }
          if (attempt.state !== 'humanity_verified') return { outcome: 'not_verified' };

          const tombstoneResult = await this.query<TombstoneRow>(
            'check persona commit cooldown',
            `SELECT alias, released_at, cooldown_until, payload,
               cooldown_until > clock_timestamp() AS active
             FROM persona.alias_tombstones
             WHERE alias = $1
             FOR UPDATE`,
            [record.alias],
          );
          const tombstone = tombstoneResult.rows[0];
          if (tombstone) {
            decodeTombstone(tombstone);
            if (tombstone.active !== false) return { outcome: 'alias_cooldown' };
            await this.query(
              'delete expired persona tombstone before commit',
              'DELETE FROM persona.alias_tombstones WHERE alias = $1',
              [record.alias],
            );
          }
          const revoked = await this.query(
            'check persona revocation before commit',
            'SELECT 1 FROM persona.revocations WHERE persona_pubkey = $1',
            [record.personaPubkey],
          );
          if (revoked.rowCount === 1) return { outcome: 'persona_revoked' };

          const inserted = await this.query<QueryResultRow>(
            'activate persona registration',
            `INSERT INTO persona.records (alias, persona_pubkey, created_at, payload)
             VALUES ($1, $2, $3::timestamptz, $4::jsonb)
             ON CONFLICT DO NOTHING
             RETURNING alias`,
            [record.alias, record.personaPubkey, record.createdAt, JSON.stringify(record)],
          );
          if (inserted.rowCount !== 1) {
            const aliasOwner = await this.getByAlias(record.alias);
            if (aliasOwner && aliasOwner.personaPubkey !== record.personaPubkey) {
              return { outcome: 'alias_taken' };
            }
            const pubkeyOwner = await this.getByPubkey(record.personaPubkey);
            if (pubkeyOwner && pubkeyOwner.alias !== record.alias) {
              return { outcome: 'pubkey_taken' };
            }
            if (!aliasOwner || !pubkeyOwner) {
              throw new Error('Persona registration commit conflict had no matching owner.');
            }
          }
          await this.query(
            'commit persona registration attempt',
            `UPDATE persona.registration_attempts
             SET state = 'committed',
               lifecycle_version = lifecycle_version + 1,
               updated_at = clock_timestamp()
             WHERE attempt_id = $1`,
            [attemptId],
          );
          return { outcome: 'ok', record };
        })
      ))
    ));
  }

  async cancelRegistrationAttempt(attemptId: string, requestDigest: string): Promise<boolean> {
    if (!/^[0-9a-f]{64}$/u.test(attemptId) || !/^[0-9a-f]{64}$/u.test(requestDigest)) {
      throw new TypeError('Persona registration attempt identity is invalid.');
    }
    return this.withRegistrationAttemptLock(attemptId, async () => {
      const deleted = await this.query<QueryResultRow>(
        'cancel unverified persona registration attempt',
        `DELETE FROM persona.registration_attempts
         WHERE attempt_id = $1 AND request_digest = $2 AND state <> 'committed'
         RETURNING attempt_id`,
        [attemptId, requestDigest],
      );
      return deleted.rowCount === 1;
    });
  }

  async tryRegister(
    record: PersonaRecord,
    _nowMs?: number,
  ): Promise<TryRegisterOutcome> {
    validateRecord(record);
    return this.withPersonaWriteLock(record.personaPubkey, () => (
      this.withAliasWriteLock(record.alias, async () => {
        await this.query(
          'release expired persona reservations before direct registration',
          `DELETE FROM persona.registration_attempts
           WHERE state = 'reserved'
             AND reservation_expires_at <= clock_timestamp()
             AND (alias = $1 OR persona_pubkey = $2)`,
          [record.alias, record.personaPubkey],
        );
        const tombstoneResult = await this.query<TombstoneRow>(
          'check persona alias cooldown',
          `SELECT alias, released_at, cooldown_until, payload,
             cooldown_until > clock_timestamp() AS active
           FROM persona.alias_tombstones
           WHERE alias = $1
           FOR UPDATE`,
          [record.alias],
        );
        const tombstoneRow = tombstoneResult.rows[0];
        if (tombstoneRow) {
          decodeTombstone(tombstoneRow);
          if (tombstoneRow.active !== false) return 'alias_cooldown';
          await this.query(
            'delete expired persona alias tombstone',
            'DELETE FROM persona.alias_tombstones WHERE alias = $1',
            [record.alias],
          );
        }

        const revoked = await this.query(
          'check persona revocation before registration',
          'SELECT 1 FROM persona.revocations WHERE persona_pubkey = $1',
          [record.personaPubkey],
        );
        if (revoked.rowCount === 1) return 'persona_revoked';

        const pending = await this.query<{ alias_conflict: unknown; pubkey_conflict: unknown }>(
          'check pending persona registration before direct registration',
          `SELECT
             EXISTS (
               SELECT 1 FROM persona.registration_attempts
               WHERE alias = $1 AND state IN ('reserved', 'humanity_verified')
             ) AS alias_conflict,
             EXISTS (
               SELECT 1 FROM persona.registration_attempts
               WHERE persona_pubkey = $2 AND state IN ('reserved', 'humanity_verified')
             ) AS pubkey_conflict`,
          [record.alias, record.personaPubkey],
        );
        if (pending.rows[0]?.alias_conflict === true) return 'alias_taken';
        if (pending.rows[0]?.pubkey_conflict === true) return 'pubkey_taken';

        const inserted = await this.query<QueryResultRow>(
          'register persona',
          `INSERT INTO persona.records (alias, persona_pubkey, created_at, payload)
           VALUES ($1, $2, $3::timestamptz, $4::jsonb)
           ON CONFLICT DO NOTHING
           RETURNING alias`,
          [record.alias, record.personaPubkey, record.createdAt, JSON.stringify(record)],
        );
        if (inserted.rowCount === 1) return 'ok';

        const aliasOwner = await this.query(
          'resolve persona alias registration conflict',
          'SELECT 1 FROM persona.records WHERE alias = $1',
          [record.alias],
        );
        if (aliasOwner.rowCount === 1) return 'alias_taken';
        const pubkeyOwner = await this.query(
          'resolve persona pubkey registration conflict',
          'SELECT 1 FROM persona.records WHERE persona_pubkey = $1',
          [record.personaPubkey],
        );
        if (pubkeyOwner.rowCount === 1) return 'pubkey_taken';
        throw new Error('Persona registration conflict had no surviving owner.');
      })
    ));
  }

  async remove(alias: string, expectedPersonaPubkey?: string): Promise<void> {
    assertAlias(alias);
    if (expectedPersonaPubkey) assertPubkey(expectedPersonaPubkey);
    const observed = await this.getByAlias(alias);
    if (!observed) return;
    const personaPubkey = expectedPersonaPubkey ?? observed.personaPubkey;
    await this.withPersonaWriteLock(personaPubkey, () => (
      this.withAliasWriteLock(alias, async () => {
        await this.query(
          'remove persona registration reservation',
          'DELETE FROM persona.records WHERE alias = $1 AND persona_pubkey = $2',
          [alias, personaPubkey],
        );
      })
    ));
  }

  async getByAlias(alias: string): Promise<PersonaRecord | null> {
    if (!ALIAS_RE.test(alias)) return null;
    const result = await this.query<PersonaRow>(
      'get persona by alias',
      `SELECT alias, persona_pubkey, created_at, payload
       FROM persona.records
       WHERE alias = $1`,
      [alias],
    );
    return result.rows[0] ? decodePersona(result.rows[0]) : null;
  }

  async getByPubkey(personaPubkey: string): Promise<PersonaRecord | null> {
    if (!PUBKEY_RE.test(personaPubkey)) return null;
    const result = await this.query<PersonaRow>(
      'get persona by public key',
      `SELECT alias, persona_pubkey, created_at, payload
       FROM persona.records
       WHERE persona_pubkey = $1`,
      [personaPubkey],
    );
    return result.rows[0] ? decodePersona(result.rows[0]) : null;
  }

  async getByPubkeys(personaPubkeys: readonly string[]): Promise<PersonaRecord[]> {
    const keys = [...new Set(personaPubkeys.filter((key) => PUBKEY_RE.test(key)))]
      .slice(0, MAX_BATCH_SIZE);
    if (keys.length === 0) return [];
    const result = await this.query<PersonaRow>(
      'batch get personas by public key',
      `SELECT alias, persona_pubkey, created_at, payload
       FROM persona.records
       WHERE persona_pubkey = ANY($1::text[])`,
      [keys],
    );
    return result.rows.map(decodePersona);
  }

  async release(alias: string, tombstone: AliasReleaseTombstone): Promise<void> {
    assertAlias(alias);
    validateTombstone(tombstone);
    if (tombstone.alias !== alias) throw new TypeError('Persona tombstone alias does not match.');
    await this.withPersonaWriteLock(tombstone.personaPubkey, () => (
      this.withAliasWriteLock(alias, async () => {
        const owner = await this.query<PersonaRow>(
          'lock persona alias for release',
          `SELECT alias, persona_pubkey, created_at, payload
           FROM persona.records
           WHERE alias = $1
           FOR UPDATE`,
          [alias],
        );
        if (owner.rows[0]) decodePersona(owner.rows[0]);
        if (owner.rows[0] && owner.rows[0].persona_pubkey !== tombstone.personaPubkey) {
          throw new Error('Refusing to release an alias owned by another persona.');
        }

        // Insert the cooldown before deleting the registration. Both statements commit in the
        // same transaction, while the alias advisory lock excludes competing registration.
        await this.query(
          'write persona alias tombstone',
          `INSERT INTO persona.alias_tombstones (
             alias, released_at, cooldown_until, payload
           ) VALUES ($1, $2::timestamptz, to_timestamp($3 / 1000.0), $4::jsonb)
           ON CONFLICT (alias) DO UPDATE SET
             released_at = CASE
               WHEN EXCLUDED.cooldown_until >= persona.alias_tombstones.cooldown_until
                 THEN EXCLUDED.released_at
               ELSE persona.alias_tombstones.released_at
             END,
             cooldown_until = GREATEST(
               EXCLUDED.cooldown_until,
               persona.alias_tombstones.cooldown_until
             ),
             payload = CASE
               WHEN EXCLUDED.cooldown_until >= persona.alias_tombstones.cooldown_until
                 THEN EXCLUDED.payload
               ELSE persona.alias_tombstones.payload
             END,
             lifecycle_version = persona.alias_tombstones.lifecycle_version + 1`,
          [
            alias,
            tombstone.releasedAt,
            tombstone.reregisterBlockedUntilMs,
            JSON.stringify(tombstone),
          ],
        );
        await this.query(
          'purge persona registration attempts on release',
          'DELETE FROM persona.registration_attempts WHERE persona_pubkey = $1',
          [tombstone.personaPubkey],
        );
        await this.query(
          'release persona alias',
          'DELETE FROM persona.records WHERE alias = $1 AND persona_pubkey = $2',
          [alias, tombstone.personaPubkey],
        );
      })
    ));
  }

  async getTombstone(alias: string): Promise<AliasReleaseTombstone | null> {
    if (!ALIAS_RE.test(alias)) return null;
    const result = await this.query<TombstoneRow>(
      'get persona alias tombstone',
      `SELECT alias, released_at, cooldown_until, payload
       FROM persona.alias_tombstones
       WHERE alias = $1`,
      [alias],
    );
    return result.rows[0] ? decodeTombstone(result.rows[0]) : null;
  }

  async revoke(personaPubkey: string, reason?: string): Promise<void> {
    assertPubkey(personaPubkey);
    const explicitReason = normalizeRevocationReason(reason);
    await this.withPersonaWriteLock(personaPubkey, async () => {
      await this.query(
        'revoke persona',
        `INSERT INTO persona.revocations (persona_pubkey, reason)
         VALUES ($1, $2)
         ON CONFLICT (persona_pubkey) DO UPDATE SET
           reason = EXCLUDED.reason,
           revoked_at = clock_timestamp(),
           lifecycle_version = persona.revocations.lifecycle_version + 1`,
        [personaPubkey, explicitReason],
      );
    });
  }

  async unrevoke(personaPubkey: string): Promise<void> {
    assertPubkey(personaPubkey);
    await this.withPersonaWriteLock(personaPubkey, async () => {
      await this.query(
        'unrevoke persona',
        'DELETE FROM persona.revocations WHERE persona_pubkey = $1',
        [personaPubkey],
      );
    });
  }

  async isRevoked(personaPubkey: string): Promise<boolean> {
    if (!PUBKEY_RE.test(personaPubkey)) return true;
    const result = await this.query(
      'check persona revocation',
      'SELECT 1 FROM persona.revocations WHERE persona_pubkey = $1',
      [personaPubkey],
    );
    return result.rowCount === 1;
  }

  async prune(_nowMs: number): Promise<void> {
    await this.query(
      'prune persona alias tombstones',
      'DELETE FROM persona.alias_tombstones WHERE cooldown_until <= clock_timestamp()',
    );
    await this.query(
      'prune expired persona registration reservations',
      `WITH expired AS MATERIALIZED (
         SELECT attempt_id
         FROM persona.registration_attempts
         WHERE state = 'reserved'
           AND reservation_expires_at <= clock_timestamp()
         ORDER BY reservation_expires_at, attempt_id
         FOR UPDATE SKIP LOCKED
         LIMIT 1000
       )
       DELETE FROM persona.registration_attempts AS attempts
       USING expired
       WHERE attempts.attempt_id = expired.attempt_id`,
    );
    const recoverable = await this.query<RegistrationAttemptRow>(
      'list persona registration attempts requiring commit recovery',
      `SELECT attempt_id, request_digest, alias, persona_pubkey, state,
         record_payload, created_at, updated_at
       FROM persona.registration_attempts
       WHERE state = 'humanity_verified'
       ORDER BY updated_at, attempt_id
       LIMIT 100`,
    );
    for (const row of recoverable.rows) {
      const attempt = decodeRegistrationAttempt(row);
      await this.commitRegistrationAttempt(attempt.attemptId, attempt.requestDigest);
    }
  }

  async stats(): Promise<{ personas: number; tombstones: number; revoked: number }> {
    const result = await this.query<PersonaStatsRow>(
      'read persona registry stats',
      `SELECT
         (SELECT count(*) FROM persona.records) AS personas,
         (SELECT count(*) FROM persona.alias_tombstones) AS tombstones,
         (SELECT count(*) FROM persona.revocations) AS revoked`,
    );
    const row = result.rows[0];
    if (!row) throw new Error('PostgreSQL persona registry stats returned no row.');
    return {
      personas: safeCount(row.personas, 'persona count'),
      tombstones: safeCount(row.tombstones, 'persona tombstone count'),
      revoked: safeCount(row.revoked, 'persona revocation count'),
    };
  }
}
