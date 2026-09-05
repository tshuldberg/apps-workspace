import type { QueryResult, QueryResultRow } from 'pg';
import {
  HUMANITY_CHALLENGE_KINDS,
  type ConsumedHumanityChallenge,
  type HumanityChallengeKind,
  type HumanityRegistrationRedemptionInput,
  type HumanityRegistrationRedemptionOutcome,
  type HumanityStore,
  type StoredChallenge,
} from '../../humanity-service';
import {
  PostgresStoreContext,
  toPostgresStoreUnavailableError,
} from '../store-context';

interface ChallengeRow extends QueryResultRow {
  kind: unknown;
  nonce: unknown;
  issued_at: unknown;
  expires_at: unknown;
  payload: unknown;
  expired?: unknown;
}

interface CountRow extends QueryResultRow {
  count: unknown;
}

interface StatsRow extends QueryResultRow {
  spent: unknown;
  issuance_keys: unknown;
  challenges: unknown;
}

interface RegistrationRedemptionRow extends QueryResultRow {
  request_digest: unknown;
  token_hash: unknown;
  result: unknown;
}

const CHALLENGE_KINDS = new Set<string>(HUMANITY_CHALLENGE_KINDS);

function assertSafeText(name: string, value: string, maximumLength = 512): void {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximumLength) {
    throw new TypeError(`${name} must be a non-empty string no longer than ${maximumLength} characters.`);
  }
}

function assertTimestampMs(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${name} must be a non-negative safe integer timestamp.`);
  }
}

function assertDayBucket(dayBucket: number): void {
  if (!Number.isSafeInteger(dayBucket) || dayBucket < 0) {
    throw new TypeError('Humanity issuance day bucket must be a non-negative safe integer.');
  }
}

function assertMaximum(maximum: number): void {
  if (!Number.isSafeInteger(maximum) || maximum <= 0) {
    throw new RangeError('Humanity issuance maximum must be a positive safe integer.');
  }
}

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
  const parsed = typeof value === 'bigint'
    ? Number(value)
    : typeof value === 'number'
      ? value
      : typeof value === 'string' && /^\d+$/u.test(value)
        ? Number(value)
        : Number.NaN;
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`PostgreSQL ${label} contains an invalid count.`);
  }
  return parsed;
}

function decodeChallenge(row: ChallengeRow): StoredChallenge {
  if (typeof row.kind !== 'string' || !CHALLENGE_KINDS.has(row.kind)) {
    throw new Error('PostgreSQL humanity challenge has an unsupported kind.');
  }
  if (typeof row.nonce !== 'string' || row.nonce.length === 0) {
    throw new Error('PostgreSQL humanity challenge has an invalid nonce.');
  }
  const issuedAtMs = timestampMs(row.issued_at, 'humanity challenge issued_at');
  const expiresAtMs = timestampMs(row.expires_at, 'humanity challenge expires_at');
  const payload = jsonObject(row.payload, 'humanity challenge payload');

  if (payload.kind !== row.kind
    || payload.nonce !== row.nonce
    || typeof payload.issuedAt !== 'string'
    || timestampMs(payload.issuedAt, 'humanity challenge payload issuedAt') !== issuedAtMs
    || payload.expiresAtMs !== expiresAtMs) {
    throw new Error('PostgreSQL humanity challenge columns and payload do not match.');
  }

  return {
    kind: row.kind as HumanityChallengeKind,
    nonce: row.nonce,
    issuedAt: new Date(issuedAtMs).toISOString(),
    expiresAtMs,
  };
}

function validateChallenge(id: string, record: StoredChallenge): void {
  assertSafeText('Humanity challenge id', id, 256);
  if (!CHALLENGE_KINDS.has(record.kind)) {
    throw new TypeError('Humanity challenge kind is unsupported.');
  }
  assertSafeText('Humanity challenge nonce', record.nonce, 512);
  const issuedAtMs = Date.parse(record.issuedAt);
  if (!Number.isSafeInteger(issuedAtMs) || issuedAtMs < 0) {
    throw new TypeError('Humanity challenge issuedAt must be a valid timestamp.');
  }
  assertTimestampMs('Humanity challenge expiresAtMs', record.expiresAtMs);
  if (record.expiresAtMs <= issuedAtMs) {
    throw new RangeError('Humanity challenge expiry must be after issuance.');
  }
}

function validateRegistrationRedemption(input: HumanityRegistrationRedemptionInput): void {
  if (!/^[0-9a-f]{64}$/u.test(input.attemptId)
    || !/^[0-9a-f]{64}$/u.test(input.requestDigest)
    || !/^[0-9a-f]{64}$/u.test(input.tokenHash)
    || typeof input.allowCreate !== 'boolean') {
    throw new TypeError('Humanity registration redemption input is invalid.');
  }
  assertTimestampMs('Humanity registration token expiry', input.expiresAtMs);
}

function decodeRegistrationRedemption(row: RegistrationRedemptionRow): {
  requestDigest: string;
  tokenHash: string;
} {
  const result = jsonObject(row.result, 'humanity registration redemption result');
  if (typeof row.request_digest !== 'string'
    || typeof row.token_hash !== 'string'
    || !/^[0-9a-f]{64}$/u.test(row.request_digest)
    || !/^[0-9a-f]{64}$/u.test(row.token_hash)
    || result.ok !== true
    || Object.keys(result).length !== 1) {
    throw new Error('PostgreSQL humanity registration redemption is invalid.');
  }
  return { requestDigest: row.request_digest, tokenHash: row.token_hash };
}

/** PostgreSQL-backed humanity state for multi-instance production services. */
export class PostgresHumanityStore implements HumanityStore {
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

  private async transaction<T>(operation: string, callback: () => Promise<T>): Promise<T> {
    try {
      return await this.context.transaction(callback);
    } catch (error) {
      throw toPostgresStoreUnavailableError(operation, error);
    }
  }

  async putChallenge(id: string, record: StoredChallenge): Promise<void> {
    validateChallenge(id, record);
    await this.query(
      'put humanity challenge',
      `INSERT INTO humanity.challenges (
         challenge_id, kind, nonce, issued_at, expires_at, payload
       ) VALUES ($1, $2, $3, $4::timestamptz, to_timestamp($5 / 1000.0), $6::jsonb)
       ON CONFLICT (challenge_id) DO UPDATE SET
         kind = EXCLUDED.kind,
         nonce = EXCLUDED.nonce,
         issued_at = EXCLUDED.issued_at,
         expires_at = EXCLUDED.expires_at,
         payload = EXCLUDED.payload`,
      [id, record.kind, record.nonce, record.issuedAt, record.expiresAtMs, JSON.stringify(record)],
    );
  }

  async getChallenge(id: string): Promise<StoredChallenge | null> {
    assertSafeText('Humanity challenge id', id, 256);
    const result = await this.query<ChallengeRow>(
      'get humanity challenge',
      `SELECT kind, nonce, issued_at, expires_at, payload
       FROM humanity.challenges
       WHERE challenge_id = $1`,
      [id],
    );
    const row = result.rows[0];
    return row ? decodeChallenge(row) : null;
  }

  async deleteChallenge(id: string): Promise<void> {
    assertSafeText('Humanity challenge id', id, 256);
    await this.query(
      'delete humanity challenge',
      'DELETE FROM humanity.challenges WHERE challenge_id = $1',
      [id],
    );
  }

  async consumeChallenge(
    id: string,
    _nowMs: number,
  ): Promise<ConsumedHumanityChallenge | null> {
    assertSafeText('Humanity challenge id', id, 256);
    const result = await this.query<ChallengeRow>(
      'consume humanity challenge',
      `DELETE FROM humanity.challenges
       WHERE challenge_id = $1
       RETURNING kind, nonce, issued_at, expires_at, payload,
         expires_at <= clock_timestamp() AS expired`,
      [id],
    );
    const row = result.rows[0];
    if (!row) return null;
    if (typeof row.expired !== 'boolean') {
      throw new Error('PostgreSQL humanity challenge returned an invalid expiry verdict.');
    }
    return { challenge: decodeChallenge(row), expired: row.expired };
  }

  async trySpend(tokenHash: string, expiresAtMs: number): Promise<boolean> {
    assertSafeText('Humanity token hash', tokenHash, 256);
    assertTimestampMs('Humanity token expiry', expiresAtMs);
    const result = await this.query<QueryResultRow>(
      'spend humanity token',
      `INSERT INTO humanity.spent_tokens (token_hash, expires_at)
       VALUES ($1, to_timestamp($2 / 1000.0))
       ON CONFLICT (token_hash) DO NOTHING
       RETURNING token_hash`,
      [tokenHash, expiresAtMs],
    );
    return result.rowCount === 1;
  }

  async redeemRegistrationAttempt(
    input: HumanityRegistrationRedemptionInput,
  ): Promise<HumanityRegistrationRedemptionOutcome> {
    validateRegistrationRedemption(input);
    try {
      return await this.context.withAdvisoryTransactionLock(
        'humanity-registration-attempt',
        input.attemptId,
        () => this.context.withAdvisoryTransactionLock(
          'humanity-registration-token',
          input.tokenHash,
          async () => {
            const existingResult = await this.query<RegistrationRedemptionRow>(
              'read humanity registration redemption',
              `SELECT request_digest, token_hash, result
               FROM humanity.registration_redemptions
               WHERE attempt_id = $1
               FOR UPDATE`,
              [input.attemptId],
            );
            const existingRow = existingResult.rows[0];
            if (existingRow) {
              const existing = decodeRegistrationRedemption(existingRow);
              return existing.requestDigest === input.requestDigest
                && existing.tokenHash === input.tokenHash
                ? 'replayed'
                : 'attempt_conflict';
            }
            if (!input.allowCreate) return 'not_recorded';

            const spent = await this.query<QueryResultRow>(
              'spend humanity registration token',
              `INSERT INTO humanity.spent_tokens (token_hash, expires_at)
               VALUES ($1, to_timestamp($2 / 1000.0))
               ON CONFLICT (token_hash) DO NOTHING
               RETURNING token_hash`,
              [input.tokenHash, input.expiresAtMs],
            );
            if (spent.rowCount !== 1) return 'already_spent';

            await this.query(
              'record humanity registration redemption',
              `INSERT INTO humanity.registration_redemptions (
                 attempt_id, request_digest, token_hash, token_expires_at, result
               ) VALUES ($1, $2, $3, to_timestamp($4 / 1000.0), '{"ok": true}'::jsonb)`,
              [input.attemptId, input.requestDigest, input.tokenHash, input.expiresAtMs],
            );
            return 'spent';
          },
        ),
      );
    } catch (error) {
      throw toPostgresStoreUnavailableError('redeem humanity registration token', error);
    }
  }

  async isSpent(tokenHash: string): Promise<boolean> {
    assertSafeText('Humanity token hash', tokenHash, 256);
    const result = await this.query<QueryResultRow>(
      'read humanity token spend',
      'SELECT 1 FROM humanity.spent_tokens WHERE token_hash = $1',
      [tokenHash],
    );
    return result.rowCount === 1;
  }

  async markSpent(tokenHash: string, expiresAtMs: number): Promise<void> {
    assertSafeText('Humanity token hash', tokenHash, 256);
    assertTimestampMs('Humanity token expiry', expiresAtMs);
    await this.query(
      'mark humanity token spent',
      `INSERT INTO humanity.spent_tokens (token_hash, expires_at)
       VALUES ($1, to_timestamp($2 / 1000.0))
       ON CONFLICT (token_hash) DO UPDATE SET
         expires_at = GREATEST(humanity.spent_tokens.expires_at, EXCLUDED.expires_at)`,
      [tokenHash, expiresAtMs],
    );
  }

  async getIssuanceCount(keyHash: string, dayBucket: number): Promise<number> {
    assertSafeText('Humanity issuance key hash', keyHash, 256);
    assertDayBucket(dayBucket);
    const result = await this.query<CountRow>(
      'read humanity issuance count',
      `SELECT count
       FROM humanity.issuance_counts
       WHERE key_hash = $1 AND day_bucket = $2`,
      [keyHash, dayBucket],
    );
    const row = result.rows[0];
    return row ? safeCount(row.count, 'humanity issuance count') : 0;
  }

  async incrementIssuanceCount(keyHash: string, dayBucket: number): Promise<void> {
    assertSafeText('Humanity issuance key hash', keyHash, 256);
    assertDayBucket(dayBucket);
    await this.query(
      'increment humanity issuance count',
      `INSERT INTO humanity.issuance_counts (key_hash, day_bucket, count)
       VALUES ($1, $2, 1)
       ON CONFLICT (key_hash, day_bucket) DO UPDATE SET
         count = humanity.issuance_counts.count + 1,
         updated_at = clock_timestamp()`,
      [keyHash, dayBucket],
    );
  }

  async tryIncrementIssuanceCount(
    keyHash: string,
    dayBucket: number,
    maximum: number,
  ): Promise<boolean> {
    assertSafeText('Humanity issuance key hash', keyHash, 256);
    assertDayBucket(dayBucket);
    assertMaximum(maximum);
    const result = await this.query<CountRow>(
      'claim humanity issuance allowance',
      `INSERT INTO humanity.issuance_counts (key_hash, day_bucket, count)
       VALUES ($1, $2, 1)
       ON CONFLICT (key_hash, day_bucket) DO UPDATE SET
         count = humanity.issuance_counts.count + 1,
         updated_at = clock_timestamp()
       WHERE humanity.issuance_counts.count < $3
       RETURNING count`,
      [keyHash, dayBucket, maximum],
    );
    return result.rowCount === 1;
  }

  async prune(_nowMs: number): Promise<void> {
    // Managed expiry is intentionally based on PostgreSQL time, not an individual
    // API instance's possibly skewed wall clock.
    await this.transaction('prune humanity state', async () => {
      await this.query(
        'prune humanity challenges',
        'DELETE FROM humanity.challenges WHERE expires_at <= clock_timestamp()',
      );
      await this.query(
        'prune humanity token spends',
        'DELETE FROM humanity.spent_tokens WHERE expires_at <= clock_timestamp()',
      );
      await this.query(
        'prune humanity issuance counts',
        `DELETE FROM humanity.issuance_counts
         WHERE day_bucket < floor(extract(epoch FROM clock_timestamp()) / 86400)::bigint - 1`,
      );
    });
  }

  async stats(): Promise<{ spent: number; issuanceKeys: number; challenges: number }> {
    const result = await this.query<StatsRow>(
      'read humanity stats',
      `SELECT
         (SELECT count(*)::text FROM humanity.spent_tokens) AS spent,
         (SELECT count(*)::text FROM humanity.issuance_counts) AS issuance_keys,
         (SELECT count(*)::text FROM humanity.challenges) AS challenges`,
    );
    const row = result.rows[0];
    if (!row) throw new Error('PostgreSQL humanity stats returned no row.');
    return {
      spent: safeCount(row.spent, 'humanity spent-token stats'),
      issuanceKeys: safeCount(row.issuance_keys, 'humanity issuance stats'),
      challenges: safeCount(row.challenges, 'humanity challenge stats'),
    };
  }
}
