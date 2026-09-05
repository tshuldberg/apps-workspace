/**
 * PostgreSQL-owned ObjectDeletionJobStore (Plan 44 WP-2C, migration 8).
 *
 * ops.object_deletion_jobs is the durable queue; one row per object key. Claiming
 * bumps the row's fencing_token and stamps claim_owner + claim_expires_at exactly as
 * the operations store claims job leases, so a stale worker's commit is rejected by a
 * WHERE clause pinned to the live (owner, fencing_token, unexpired lease). Retries set
 * next_attempt_at into the future (backoff+jitter is the caller's), and a poison job
 * is a terminal finding the operator can page through. clock_timestamp() is the single
 * time authority; the caller's nowMs is used only for lease-window arithmetic that must
 * agree with the returned leasedUntil, matching the memory/file adapters.
 *
 * Every deletion action also appends a durable audit row (ops.object_deletion_audit),
 * so the queue never mutates state without a trail. A database fault throws
 * PostgresStoreUnavailableError, never a fabricated result.
 */

import type { QueryResult, QueryResultRow } from 'pg';
import type { PostgresStoreContext } from '../store-context';
import { toPostgresStoreUnavailableError } from '../store-context';
import {
  assertClockMs,
  assertDeletionClaimLimit,
  assertDeletionDelayMs,
  assertDeletionError,
  assertDeletionKey,
  assertDeletionLeaseMs,
  assertDeletionOwner,
  assertDeletionVersionId,
  type ClaimObjectDeletionsInput,
  type CommitObjectDeletionResult,
  type CompleteObjectDeletionInput,
  type EnqueueObjectDeletionResult,
  type ObjectDeletionCursor,
  type ObjectDeletionJob,
  type ObjectDeletionJobStore,
  type ObjectDeletionLease,
  type ObjectDeletionPage,
  type ObjectDeletionState,
  type PoisonObjectDeletionInput,
  type RescheduleObjectDeletionInput,
} from '../../object-deletion-jobs';

interface JobRow extends QueryResultRow {
  object_key: string;
  state: string;
  version_id: string | null;
  attempt: string | number;
  next_attempt_at: Date | string;
  last_error: string | null;
  enqueued_at: Date | string;
  updated_at: Date | string;
}

interface ClaimRow extends QueryResultRow {
  object_key: string;
  attempt: string | number;
  fencing_token: string | number;
  claim_expires_at: Date | string;
}

const KNOWN_STATES = new Set<ObjectDeletionState>(['pending', 'leased', 'deleted', 'poison']);

function timestamp(value: Date | string): string {
  const parsed = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error('Invalid PostgreSQL timestamp');
  return parsed.toISOString();
}

function integer(value: string | number, field: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`Invalid PostgreSQL ${field}`);
  return parsed;
}

function state(value: string): ObjectDeletionState {
  if (!KNOWN_STATES.has(value as ObjectDeletionState)) {
    throw new Error('Invalid PostgreSQL deletion job state');
  }
  return value as ObjectDeletionState;
}

function mapJob(row: JobRow): ObjectDeletionJob {
  return {
    objectKey: row.object_key,
    state: state(row.state),
    versionId: row.version_id,
    attempt: integer(row.attempt, 'attempt'),
    nextAttemptAt: timestamp(row.next_attempt_at),
    lastError: row.last_error,
    enqueuedAt: timestamp(row.enqueued_at),
    updatedAt: timestamp(row.updated_at),
  };
}

export class PostgresObjectDeletionJobStore implements ObjectDeletionJobStore {
  constructor(private readonly database: PostgresStoreContext) {}

  private async query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<QueryResult<Row>> {
    try {
      return await this.database.query<Row>(text, values);
    } catch (error) {
      throw toPostgresStoreUnavailableError('object deletion job query', error);
    }
  }

  private async transaction<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await this.database.transaction(operation);
    } catch (error) {
      throw toPostgresStoreUnavailableError('object deletion job transaction', error);
    }
  }

  private async audit(objectKey: string, action: string, detail: Record<string, unknown>): Promise<void> {
    await this.query(`
      INSERT INTO ops.object_deletion_audit (object_key, action, detail)
      VALUES ($1, $2, $3::jsonb)
    `, [objectKey, action, JSON.stringify(detail)]);
  }

  async enqueue(objectKey: string, nowMs: number): Promise<EnqueueObjectDeletionResult> {
    assertDeletionKey('object key', objectKey);
    assertClockMs('nowMs', nowMs);
    return this.transaction(async () => {
      const inserted = await this.query<JobRow>(`
        INSERT INTO ops.object_deletion_jobs (object_key, state, next_attempt_at)
        VALUES ($1, 'pending', clock_timestamp())
        ON CONFLICT (object_key) DO NOTHING
        RETURNING object_key, state, version_id, attempt, next_attempt_at,
          last_error, enqueued_at, updated_at
      `, [objectKey]);
      if (inserted.rows[0]) {
        await this.audit(objectKey, 'enqueued', {});
        return { status: 'enqueued', job: mapJob(inserted.rows[0]) };
      }
      const existing = await this.query<JobRow>(`
        SELECT object_key, state, version_id, attempt, next_attempt_at,
          last_error, enqueued_at, updated_at
        FROM ops.object_deletion_jobs WHERE object_key = $1
      `, [objectKey]);
      const job = mapJob(existing.rows[0]!);
      return job.state === 'deleted'
        ? { status: 'already_deleted', job }
        : { status: 'already_pending', job };
    });
  }

  async getJob(objectKey: string): Promise<ObjectDeletionJob | null> {
    assertDeletionKey('object key', objectKey);
    const result = await this.query<JobRow>(`
      SELECT object_key, state, version_id, attempt, next_attempt_at,
        last_error, enqueued_at, updated_at
      FROM ops.object_deletion_jobs WHERE object_key = $1
    `, [objectKey]);
    return result.rows[0] ? mapJob(result.rows[0]) : null;
  }

  async claim(input: ClaimObjectDeletionsInput): Promise<ObjectDeletionLease[]> {
    const owner = input.owner.trim();
    assertDeletionOwner('deletion owner', owner);
    assertDeletionClaimLimit(input.limit);
    assertDeletionLeaseMs(input.leaseMs);
    assertClockMs('nowMs', input.nowMs);
    // Claim due 'pending' jobs and 'leased' jobs whose lease has lapsed (crash recovery),
    // bumping fencing_token and attempt in one atomic, skip-locked batch.
    const claimed = await this.query<ClaimRow>(`
      WITH due AS (
        SELECT object_key
        FROM ops.object_deletion_jobs
        WHERE next_attempt_at <= clock_timestamp()
          AND (
            state = 'pending'
            OR (state = 'leased' AND claim_expires_at <= clock_timestamp())
          )
        ORDER BY next_attempt_at ASC, object_key ASC
        LIMIT $2
        FOR UPDATE SKIP LOCKED
      )
      UPDATE ops.object_deletion_jobs AS jobs
      SET state = 'leased',
          claim_owner = $1,
          claim_expires_at = clock_timestamp() + ($3::bigint * interval '1 millisecond'),
          fencing_token = jobs.fencing_token + 1,
          attempt = jobs.attempt + 1,
          updated_at = clock_timestamp()
      FROM due
      WHERE jobs.object_key = due.object_key
      RETURNING jobs.object_key, jobs.attempt, jobs.fencing_token, jobs.claim_expires_at
    `, [owner, input.limit, input.leaseMs]);
    return claimed.rows.map((row) => ({
      objectKey: row.object_key,
      owner,
      attempt: integer(row.attempt, 'attempt'),
      fencingToken: integer(row.fencing_token, 'fencing token'),
      leasedUntil: timestamp(row.claim_expires_at),
    }));
  }

  private async commit(
    lease: ObjectDeletionLease,
    set: string,
    extraValues: readonly unknown[],
    action: string,
    detail: Record<string, unknown>,
  ): Promise<CommitObjectDeletionResult> {
    assertDeletionKey('object key', lease.objectKey);
    return this.transaction(async () => {
      const updated = await this.query<JobRow>(`
        UPDATE ops.object_deletion_jobs
        SET ${set}
        WHERE object_key = $1
          AND state = 'leased'
          AND claim_owner = $2
          AND fencing_token = $3
          AND claim_expires_at > clock_timestamp()
        RETURNING object_key, state, version_id, attempt, next_attempt_at,
          last_error, enqueued_at, updated_at
      `, [lease.objectKey, lease.owner, lease.fencingToken, ...extraValues]);
      const row = updated.rows[0];
      if (!row) return { status: 'lease_lost' };
      await this.audit(lease.objectKey, action, detail);
      return { status: 'committed', job: mapJob(row) };
    });
  }

  async complete(input: CompleteObjectDeletionInput): Promise<CommitObjectDeletionResult> {
    assertClockMs('nowMs', input.nowMs);
    if (input.versionId !== null) assertDeletionVersionId('version id', input.versionId);
    return this.commit(
      input.lease,
      `state = 'deleted', version_id = $4, claim_owner = NULL, claim_expires_at = NULL,
       last_error = NULL, updated_at = clock_timestamp()`,
      [input.versionId],
      'deleted',
      { versionId: input.versionId, attempt: input.lease.attempt },
    );
  }

  async reschedule(input: RescheduleObjectDeletionInput): Promise<CommitObjectDeletionResult> {
    assertDeletionDelayMs(input.delayMs);
    assertClockMs('nowMs', input.nowMs);
    const error = assertDeletionError('deletion error', input.error);
    return this.commit(
      input.lease,
      `state = 'pending', claim_owner = NULL, claim_expires_at = NULL,
       last_error = $4,
       next_attempt_at = clock_timestamp() + ($5::bigint * interval '1 millisecond'),
       updated_at = clock_timestamp()`,
      [error, input.delayMs],
      'retry_scheduled',
      { attempt: input.lease.attempt, delayMs: input.delayMs },
    );
  }

  async poison(input: PoisonObjectDeletionInput): Promise<CommitObjectDeletionResult> {
    assertClockMs('nowMs', input.nowMs);
    const error = assertDeletionError('deletion error', input.error);
    return this.commit(
      input.lease,
      `state = 'poison', claim_owner = NULL, claim_expires_at = NULL,
       last_error = $4, updated_at = clock_timestamp()`,
      [error],
      'poisoned',
      { attempt: input.lease.attempt },
    );
  }

  async listPoison(input: {
    after?: ObjectDeletionCursor;
    limit: number;
  }): Promise<ObjectDeletionPage> {
    assertDeletionClaimLimit(input.limit);
    if (input.after) assertDeletionKey('poison cursor key', input.after.objectKey);
    const result = await this.query<JobRow>(`
      SELECT object_key, state, version_id, attempt, next_attempt_at,
        last_error, enqueued_at, updated_at
      FROM ops.object_deletion_jobs
      WHERE state = 'poison'
        AND ($1::text IS NULL OR object_key > $1::text)
      ORDER BY object_key ASC
      LIMIT $2
    `, [input.after ? input.after.objectKey : null, input.limit + 1]);
    const jobs = result.rows.slice(0, input.limit).map(mapJob);
    const hasMore = result.rows.length > input.limit;
    const last = jobs.at(-1);
    return {
      jobs,
      nextCursor: hasMore && last ? { objectKey: last.objectKey } : null,
    };
  }
}
