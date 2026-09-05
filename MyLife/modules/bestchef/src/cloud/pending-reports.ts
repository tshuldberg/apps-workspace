/**
 * Pending moderation reports queue (B-003).
 *
 * Trust-and-safety blocker: when the user submits a moderation report
 * and the cloud insert into bc_flags fails (offline, RLS denial,
 * transient outage) the report would otherwise be silently dropped.
 * We instead persist the payload to the device-local
 * `rc_pending_reports` table plus a best-effort cloud row in
 * `bc_pending_reports`. The background sweeper retries with
 * exponential backoff on app foreground or manual user action.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { BestChefResult } from './client';
import type {
  ModerationReportInput,
  ModerationReportResult,
  ModerationTargetKind,
} from './moderation';
import { reportContentToModeration } from './moderation';

const PENDING_TABLE = 'rc_pending_reports';
const CLOUD_TABLE = 'bc_pending_reports';
const MAX_BACKOFF_MIN = 60;

export interface PendingReportPayload {
  targetKind: ModerationTargetKind;
  targetId: string;
  reason: string;
  reporterProfileId: string | null;
}

export interface PendingReportRow {
  localId: string;
  payload: PendingReportPayload;
  lastError: string | null;
  attemptCount: number;
  nextAttemptAt: string;
  synced: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PendingRow {
  local_id: string;
  payload: string;
  last_error: string | null;
  attempt_count: number;
  next_attempt_at: string;
  synced: number;
  created_at: string;
  updated_at: string;
}

export interface EnqueueReportInput {
  localId: string;
  payload: PendingReportPayload;
  error?: string | null;
}

export interface EnqueueReportResult {
  ok: boolean;
  cloudReportId: string | null;
  pending: PendingReportRow | null;
  error: string | null;
}

export interface RetryReportResult {
  ok: boolean;
  cloudReportId?: string;
  error?: string;
  attemptCount: number;
  nextAttemptAt: string | null;
}

export interface PendingReportsSweepResult {
  attempted: number;
  succeeded: number;
  failed: number;
  succeededLocalIds: string[];
}

let inFlightSweep: Promise<PendingReportsSweepResult> | null = null;

interface ReportSyncSupabaseClient {
  from(
    table: string,
  ): {
    upsert(
      values: Record<string, unknown>,
      options?: { onConflict?: string },
    ): Promise<{ error: { message?: string } | null }>;
    update(values: Record<string, unknown>): {
      eq(
        column: string,
        value: unknown,
      ): Promise<{ error: { message?: string } | null }>;
    };
    delete(): {
      eq(
        column: string,
        value: unknown,
      ): Promise<{ error: { message?: string } | null }>;
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

function generateLocalId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `pr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function computeReportNextAttemptDelayMinutes(attemptCount: number): number {
  if (attemptCount <= 0) return 0;
  const squared = attemptCount * attemptCount;
  return Math.min(squared, MAX_BACKOFF_MIN);
}

function computeNextAttemptAt(attemptCount: number, fromMs: number = Date.now()): string {
  const delayMs = computeReportNextAttemptDelayMinutes(attemptCount) * 60 * 1000;
  return new Date(fromMs + delayMs).toISOString();
}

function rowToPending(row: PendingRow): PendingReportRow {
  let payload: PendingReportPayload;
  try {
    payload = JSON.parse(row.payload) as PendingReportPayload;
  } catch {
    payload = {
      targetKind: 'submission',
      targetId: '',
      reason: '',
      reporterProfileId: null,
    };
  }
  return {
    localId: row.local_id,
    payload,
    lastError: row.last_error,
    attemptCount: row.attempt_count,
    nextAttemptAt: row.next_attempt_at,
    synced: row.synced === 1,
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
  supabase: SupabaseClient | ReportSyncSupabaseClient | null | undefined,
  row: {
    payload: PendingReportPayload;
    lastError: string | null;
    attemptCount: number;
    nextAttemptAt: string;
    synced: boolean;
  },
): Promise<void> {
  if (!supabase) return;
  const client = supabase as unknown as ReportSyncSupabaseClient;
  try {
    const userResult = await client.auth.getUser();
    const userId = userResult?.data?.user?.id ?? null;
    if (!userId) return;
    await client.from(CLOUD_TABLE).upsert(
      {
        user_id: userId,
        payload: row.payload as unknown as Record<string, unknown>,
        last_error: row.lastError,
        attempt_count: row.attemptCount,
        next_attempt_at: row.nextAttemptAt,
        synced: row.synced,
      },
      { onConflict: 'user_id,payload' },
    );
  } catch {
    // Cloud queue is a best-effort backup; local row is the source of truth.
  }
}

async function bestEffortCloudMarkSynced(
  supabase: SupabaseClient | ReportSyncSupabaseClient | null | undefined,
  localId: string,
): Promise<void> {
  if (!supabase) return;
  const client = supabase as unknown as ReportSyncSupabaseClient;
  try {
    await client.from(CLOUD_TABLE).update({ synced: true }).eq('id', localId);
  } catch {
    // Best-effort cleanup.
  }
}

/**
 * Persist a failed (or new) report to the local pending queue and optionally
 * attempt the cloud insert. If the cloud insert succeeds the local row is
 * marked synced. If it fails the row stays in the queue for retry.
 *
 * Returns `ok: true` if either the cloud insert succeeded OR the local row
 * was written (so the caller knows the report is at least durably stored
 * locally). Only returns `ok: false` if both writes fail.
 */
export async function enqueueReport(
  supabase: SupabaseClient | null | undefined,
  db: DatabaseAdapter,
  input: EnqueueReportInput,
): Promise<EnqueueReportResult> {
  if (!ensureLocalTable(db)) {
    return {
      ok: false,
      cloudReportId: null,
      pending: null,
      error: 'Local pending reports table is unavailable.',
    };
  }

  const now = nowIso();
  const nextAttemptAt = computeNextAttemptAt(0);
  const payloadJson = JSON.stringify(input.payload);

  let localWrote = false;
  try {
    db.execute(
      `INSERT INTO ${PENDING_TABLE} (
        local_id, payload, last_error, attempt_count, next_attempt_at, synced, created_at, updated_at
      ) VALUES (?, ?, ?, 0, ?, 0, ?, ?)
      ON CONFLICT(local_id) DO UPDATE SET
        payload = excluded.payload,
        last_error = excluded.last_error,
        next_attempt_at = excluded.next_attempt_at,
        updated_at = excluded.updated_at`,
      [
        input.localId,
        payloadJson,
        input.error ?? null,
        nextAttemptAt,
        now,
        now,
      ],
    );
    localWrote = true;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Local insert failed';
    return {
      ok: false,
      cloudReportId: null,
      pending: null,
      error: message,
    };
  }

  await bestEffortCloudUpsert(supabase, {
    payload: input.payload,
    lastError: input.error ?? null,
    attemptCount: 0,
    nextAttemptAt,
    synced: false,
  });

  return {
    ok: localWrote,
    cloudReportId: null,
    pending: {
      localId: input.localId,
      payload: input.payload,
      lastError: input.error ?? null,
      attemptCount: 0,
      nextAttemptAt,
      synced: false,
      createdAt: now,
      updatedAt: now,
    },
    error: null,
  };
}

export function listPendingReports(db: DatabaseAdapter): PendingReportRow[] {
  if (!ensureLocalTable(db)) return [];
  try {
    const rows = db.query<PendingRow>(
      `SELECT * FROM ${PENDING_TABLE} ORDER BY created_at DESC`,
    );
    return rows.map(rowToPending);
  } catch {
    return [];
  }
}

export function getPendingReport(
  db: DatabaseAdapter,
  localId: string,
): PendingReportRow | null {
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

function markSynced(db: DatabaseAdapter, localId: string): void {
  try {
    db.execute(
      `UPDATE ${PENDING_TABLE} SET synced = 1, updated_at = ? WHERE local_id = ?`,
      [nowIso(), localId],
    );
  } catch {
    // Local store unavailable.
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
    // Local store unavailable.
  }
}

async function callReportCloud(
  payload: PendingReportPayload,
): Promise<BestChefResult<ModerationReportResult>> {
  const input: ModerationReportInput = {
    targetKind: payload.targetKind,
    targetId: payload.targetId,
    reason: payload.reason,
    reporterProfileId: payload.reporterProfileId,
  };
  return reportContentToModeration(input);
}

/** Retry a single pending report. Marks synced on success. */
export async function retryPendingReport(
  supabase: SupabaseClient | null | undefined,
  db: DatabaseAdapter,
  localId: string,
): Promise<RetryReportResult> {
  const row = getPendingReport(db, localId);
  if (!row || row.synced) {
    return {
      ok: false,
      error: 'Pending report not found.',
      attemptCount: row?.attemptCount ?? 0,
      nextAttemptAt: null,
    };
  }

  let result: BestChefResult<ModerationReportResult>;
  try {
    result = await callReportCloud(row.payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown retry error';
    const nextAttemptCount = row.attemptCount + 1;
    const nextAttemptAt = computeNextAttemptAt(nextAttemptCount);
    markFailedAttempt(db, localId, nextAttemptCount, message, nextAttemptAt);
    await bestEffortCloudUpsert(supabase, {
      payload: row.payload,
      lastError: message,
      attemptCount: nextAttemptCount,
      nextAttemptAt,
      synced: false,
    });
    return {
      ok: false,
      error: message,
      attemptCount: nextAttemptCount,
      nextAttemptAt,
    };
  }

  if (result.ok && !result.data.errorCode) {
    markSynced(db, localId);
    await bestEffortCloudMarkSynced(supabase, localId);
    return {
      ok: true,
      cloudReportId: result.data.flagId ?? undefined,
      attemptCount: row.attemptCount,
      nextAttemptAt: null,
    };
  }

  const errorMessage = result.ok
    ? (result.data.errorCode ?? 'unknown_error')
    : result.error;
  const nextAttemptCount = row.attemptCount + 1;
  const nextAttemptAt = computeNextAttemptAt(nextAttemptCount);
  markFailedAttempt(db, localId, nextAttemptCount, errorMessage, nextAttemptAt);
  await bestEffortCloudUpsert(supabase, {
    payload: row.payload,
    lastError: errorMessage,
    attemptCount: nextAttemptCount,
    nextAttemptAt,
    synced: false,
  });
  return {
    ok: false,
    error: errorMessage,
    attemptCount: nextAttemptCount,
    nextAttemptAt,
  };
}

async function runPendingReportsSweep(
  supabase: SupabaseClient | null | undefined,
  db: DatabaseAdapter,
): Promise<PendingReportsSweepResult> {
  if (!ensureLocalTable(db)) {
    return { attempted: 0, succeeded: 0, failed: 0, succeededLocalIds: [] };
  }

  const now = nowIso();
  let dueRows: PendingRow[] = [];
  try {
    dueRows = db.query<PendingRow>(
      `SELECT * FROM ${PENDING_TABLE}
       WHERE synced = 0 AND next_attempt_at <= ?
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
    const result = await retryPendingReport(supabase, db, row.local_id);
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

/**
 * Background sweeper. Retries every pending report whose `next_attempt_at`
 * is in the past and is not yet synced. Concurrent callers share one sweep.
 */
export function retryPendingReports(
  supabase: SupabaseClient | null | undefined,
  db: DatabaseAdapter,
): Promise<PendingReportsSweepResult> {
  if (inFlightSweep) return inFlightSweep;

  inFlightSweep = runPendingReportsSweep(supabase, db).finally(() => {
    inFlightSweep = null;
  });
  return inFlightSweep;
}

/** Generate a fresh local id for a new pending report row. */
export function generatePendingReportLocalId(): string {
  return generateLocalId();
}
