/**
 * Pending submission sync queue (B-005).
 *
 * When the user submits a recipe but the cloud write fails (offline,
 * RLS denial, transient outage), we keep the local submission and
 * stash a payload in the device-local `rc_pending_submissions` table
 * plus a best-effort cloud row in `bc_submission_sync_queue`. The
 * background sweeper retries with exponential backoff on app
 * foreground or manual user action.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { EnsureSubmissionAliasInput } from './submission-alias';
import { ensureSubmissionAlias } from './submission-alias';

const PENDING_TABLE = 'rc_pending_submissions';
const CLOUD_TABLE = 'bc_submission_sync_queue';
const MAX_BACKOFF_MIN = 60;

/** Payload mirrors `EnsureSubmissionAliasInput` so retries can re-run the alias bridge. */
export type PendingSubmissionPayload = EnsureSubmissionAliasInput;

export interface PendingSubmissionRow {
  localId: string;
  payload: PendingSubmissionPayload;
  lastError: string | null;
  attemptCount: number;
  nextAttemptAt: string;
  createdAt: string;
  updatedAt: string;
}

interface PendingRow {
  local_id: string;
  payload: string;
  last_error: string | null;
  attempt_count: number;
  next_attempt_at: string;
  created_at: string;
  updated_at: string;
}

export interface EnqueueFailedSubmissionInput {
  localId: string;
  payload: PendingSubmissionPayload;
  error: string;
}

export interface RetrySubmissionResult {
  ok: boolean;
  cloudSubmissionId?: string;
  error?: string;
  attemptCount: number;
  nextAttemptAt: string | null;
}

export interface PendingSubmissionSweepResult {
  attempted: number;
  succeeded: number;
  failed: number;
  succeededLocalIds: string[];
}

interface SyncSupabaseClient {
  from(
    table: string,
  ): {
    upsert(
      values: Record<string, unknown>,
      options?: { onConflict?: string },
    ): Promise<{ error: { message?: string } | null }>;
    delete(): {
      eq(column: string, value: unknown): Promise<{ error: { message?: string } | null }>;
    };
  };
  auth: {
    getUser(): Promise<{
      data: { user: { id: string } | null };
      error: { message?: string } | null;
    }>;
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Compute exponential backoff in minutes. Per ticket: `min(attempt^2, 60) minutes`.
 * `attemptCount` is the value AFTER incrementing for the failed attempt.
 */
export function computeNextAttemptDelayMinutes(attemptCount: number): number {
  if (attemptCount <= 0) return 0;
  const squared = attemptCount * attemptCount;
  return Math.min(squared, MAX_BACKOFF_MIN);
}

function computeNextAttemptAt(attemptCount: number, fromMs: number = Date.now()): string {
  const delayMs = computeNextAttemptDelayMinutes(attemptCount) * 60 * 1000;
  return new Date(fromMs + delayMs).toISOString();
}

function rowToPending(row: PendingRow): PendingSubmissionRow {
  let payload: PendingSubmissionPayload;
  try {
    payload = JSON.parse(row.payload) as PendingSubmissionPayload;
  } catch {
    payload = {
      alias: '',
      profileId: '',
      dishSlug: '',
      title: '',
      ingredients: [],
      steps: [],
    };
  }
  return {
    localId: row.local_id,
    payload,
    lastError: row.last_error,
    attemptCount: row.attempt_count,
    nextAttemptAt: row.next_attempt_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function ensureLocalTable(db: DatabaseAdapter): boolean {
  try {
    db.query(`SELECT local_id FROM ${PENDING_TABLE} LIMIT 1`);
    return true;
  } catch {
    return false;
  }
}

async function bestEffortCloudUpsert(
  supabase: SupabaseClient | SyncSupabaseClient | null | undefined,
  row: {
    localId: string;
    payload: PendingSubmissionPayload;
    lastError: string | null;
    attemptCount: number;
    nextAttemptAt: string;
  },
): Promise<void> {
  if (!supabase) return;
  const client = supabase as unknown as SyncSupabaseClient;
  try {
    const userResult = await client.auth.getUser();
    const userId = userResult?.data?.user?.id ?? null;
    if (!userId) return;
    await client.from(CLOUD_TABLE).upsert(
      {
        local_id: row.localId,
        user_id: userId,
        payload: row.payload as unknown as Record<string, unknown>,
        last_error: row.lastError,
        attempt_count: row.attemptCount,
        next_attempt_at: row.nextAttemptAt,
      },
      { onConflict: 'local_id' },
    );
  } catch {
    // Cloud queue is a best-effort backup; local row is the source of truth.
  }
}

async function bestEffortCloudDelete(
  supabase: SupabaseClient | SyncSupabaseClient | null | undefined,
  localId: string,
): Promise<void> {
  if (!supabase) return;
  const client = supabase as unknown as SyncSupabaseClient;
  try {
    await client.from(CLOUD_TABLE).delete().eq('local_id', localId);
  } catch {
    // Best-effort cleanup.
  }
}

/**
 * Persist a failed submission to the local pending queue and (best effort)
 * the cloud queue table. Idempotent: re-enqueueing the same `localId` updates
 * the row in place.
 */
export async function enqueueFailedSubmission(
  db: DatabaseAdapter,
  supabase: SupabaseClient | null | undefined,
  input: EnqueueFailedSubmissionInput,
): Promise<PendingSubmissionRow | null> {
  if (!ensureLocalTable(db)) return null;

  const now = nowIso();
  const nextAttemptAt = computeNextAttemptAt(0);
  const payloadJson = JSON.stringify(input.payload);

  try {
    db.execute(
      `INSERT INTO ${PENDING_TABLE} (
        local_id, payload, last_error, attempt_count, next_attempt_at, created_at, updated_at
      ) VALUES (?, ?, ?, 0, ?, ?, ?)
      ON CONFLICT(local_id) DO UPDATE SET
        payload = excluded.payload,
        last_error = excluded.last_error,
        next_attempt_at = excluded.next_attempt_at,
        updated_at = excluded.updated_at`,
      [
        input.localId,
        payloadJson,
        input.error,
        nextAttemptAt,
        now,
        now,
      ],
    );
  } catch {
    return null;
  }

  await bestEffortCloudUpsert(supabase, {
    localId: input.localId,
    payload: input.payload,
    lastError: input.error,
    attemptCount: 0,
    nextAttemptAt,
  });

  return {
    localId: input.localId,
    payload: input.payload,
    lastError: input.error,
    attemptCount: 0,
    nextAttemptAt,
    createdAt: now,
    updatedAt: now,
  };
}

/** Returns all pending rows ordered by oldest-created first. */
export function listPendingSubmissions(db: DatabaseAdapter): PendingSubmissionRow[] {
  if (!ensureLocalTable(db)) return [];
  try {
    const rows = db.query<PendingRow>(
      `SELECT * FROM ${PENDING_TABLE} ORDER BY created_at ASC`,
    );
    return rows.map(rowToPending);
  } catch {
    return [];
  }
}

/** Returns the pending row for a given local submission id, or null. */
export function getPendingSubmission(
  db: DatabaseAdapter,
  localId: string,
): PendingSubmissionRow | null {
  if (!ensureLocalTable(db)) return null;
  try {
    const rows = db.query<PendingRow>(
      `SELECT * FROM ${PENDING_TABLE} WHERE local_id = ? LIMIT 1`,
      [localId],
    );
    return rows[0] ? rowToPending(rows[0]) : null;
  } catch {
    return null;
  }
}

function deletePendingRow(db: DatabaseAdapter, localId: string): void {
  try {
    db.execute(`DELETE FROM ${PENDING_TABLE} WHERE local_id = ?`, [localId]);
  } catch {
    // Best-effort cleanup; sweep will eventually retry.
  }
}

function markFailedAttempt(
  db: DatabaseAdapter,
  localId: string,
  attemptCount: number,
  error: string,
  nextAttemptAt: string,
): void {
  try {
    db.execute(
      `UPDATE ${PENDING_TABLE}
       SET attempt_count = ?, last_error = ?, next_attempt_at = ?, updated_at = ?
       WHERE local_id = ?`,
      [attemptCount, error, nextAttemptAt, nowIso(), localId],
    );
  } catch {
    // Local store unavailable; surface the failure via the result regardless.
  }
}

/**
 * Retry a single pending submission. On success the queue row is deleted.
 * On failure the attempt count is incremented and `next_attempt_at` is
 * pushed out by the squared backoff.
 */
/**
 * Patch a queued payload's photo URL (plan 33 Phase 4.4 reconciliation:
 * the media queue may finish uploading a photo AFTER the submission was
 * queued, and replaying the stale payload would publish photoless).
 */
export function updatePendingSubmissionPhotoUrl(
  db: DatabaseAdapter,
  localId: string,
  photoUrl: string,
): boolean {
  const row = getPendingSubmission(db, localId);
  if (!row) return false;
  const payload = { ...row.payload, photoUrl };
  try {
    db.execute(
      `UPDATE ${PENDING_TABLE} SET payload = ?, updated_at = ? WHERE local_id = ?`,
      [JSON.stringify(payload), nowIso(), localId],
    );
    return true;
  } catch {
    return false;
  }
}

export async function retryPendingSubmission(
  supabase: SupabaseClient | null | undefined,
  db: DatabaseAdapter,
  localId: string,
): Promise<RetrySubmissionResult> {
  const row = getPendingSubmission(db, localId);
  if (!row) {
    return {
      ok: false,
      error: 'Pending submission not found.',
      attemptCount: 0,
      nextAttemptAt: null,
    };
  }

  let result: Awaited<ReturnType<typeof ensureSubmissionAlias>>;
  try {
    result = await ensureSubmissionAlias(row.payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown retry error';
    const nextAttemptCount = row.attemptCount + 1;
    const nextAttemptAt = computeNextAttemptAt(nextAttemptCount);
    markFailedAttempt(db, localId, nextAttemptCount, message, nextAttemptAt);
    await bestEffortCloudUpsert(supabase, {
      localId,
      payload: row.payload,
      lastError: message,
      attemptCount: nextAttemptCount,
      nextAttemptAt,
    });
    return {
      ok: false,
      error: message,
      attemptCount: nextAttemptCount,
      nextAttemptAt,
    };
  }

  if (result.ok) {
    deletePendingRow(db, localId);
    await bestEffortCloudDelete(supabase, localId);
    return {
      ok: true,
      cloudSubmissionId: result.data,
      attemptCount: row.attemptCount,
      nextAttemptAt: null,
    };
  }

  const nextAttemptCount = row.attemptCount + 1;
  const nextAttemptAt = computeNextAttemptAt(nextAttemptCount);
  markFailedAttempt(db, localId, nextAttemptCount, result.error, nextAttemptAt);
  await bestEffortCloudUpsert(supabase, {
    localId,
    payload: row.payload,
    lastError: result.error,
    attemptCount: nextAttemptCount,
    nextAttemptAt,
  });
  return {
    ok: false,
    error: result.error,
    attemptCount: nextAttemptCount,
    nextAttemptAt,
  };
}

/**
 * Background sweeper. Retries every pending submission whose
 * `next_attempt_at` is in the past. Safe to call from app foreground hooks.
 */
export async function runPendingSubmissionSweep(
  supabase: SupabaseClient | null | undefined,
  db: DatabaseAdapter,
): Promise<PendingSubmissionSweepResult> {
  if (!ensureLocalTable(db)) {
    return { attempted: 0, succeeded: 0, failed: 0, succeededLocalIds: [] };
  }

  const now = nowIso();
  let dueRows: PendingRow[] = [];
  try {
    dueRows = db.query<PendingRow>(
      `SELECT * FROM ${PENDING_TABLE}
       WHERE next_attempt_at <= ?
       ORDER BY next_attempt_at ASC`,
      [now],
    );
  } catch {
    return { attempted: 0, succeeded: 0, failed: 0, succeededLocalIds: [] };
  }

  let succeeded = 0;
  let failed = 0;
  const succeededLocalIds: string[] = [];
  for (const row of dueRows) {
    const result = await retryPendingSubmission(supabase, db, row.local_id);
    if (result.ok) {
      succeeded += 1;
      succeededLocalIds.push(row.local_id);
    } else {
      failed += 1;
    }
  }

  return {
    attempted: dueRows.length,
    succeeded,
    failed,
    succeededLocalIds,
  };
}
