/**
 * Local mirror of cloud bookmarks (plan 33 Phase 5.6, F-010).
 *
 * rc_saved_submissions_cache gives the feed instant saved-state and lets a
 * toggle work offline: the optimistic row carries pending_op until the
 * cloud write lands, and drainPendingSaves sweeps the queue on foreground
 * (same pattern as the vote-proof draft sweep).
 */

import type { DatabaseAdapter } from '@mylife/db';

export interface SavedSubmissionCacheEntry {
  submissionId: string;
  savedAt: string;
  pendingOp: 'save' | 'unsave' | null;
  updatedAt: string;
}

interface CacheRow {
  submission_id: string;
  saved_at: string;
  pending_op: string | null;
  updated_at: string;
}

function nowIso(now: Date | string = new Date()): string {
  return now instanceof Date ? now.toISOString() : now;
}

function mapRow(row: CacheRow): SavedSubmissionCacheEntry {
  return {
    submissionId: row.submission_id,
    savedAt: row.saved_at,
    pendingOp: row.pending_op === 'save' || row.pending_op === 'unsave' ? row.pending_op : null,
    updatedAt: row.updated_at,
  };
}

/** Saved ids for instant UI. Rows pending unsave read as NOT saved. */
export function listCachedSavedIds(db: DatabaseAdapter): string[] {
  return db
    .query<CacheRow>(
      `SELECT * FROM rc_saved_submissions_cache
       WHERE pending_op IS NULL OR pending_op = 'save'
       ORDER BY saved_at DESC`,
    )
    .map((row) => row.submission_id);
}

export function isSubmissionSavedLocally(db: DatabaseAdapter, submissionId: string): boolean {
  const row = db.query<CacheRow>(
    `SELECT * FROM rc_saved_submissions_cache WHERE submission_id = ? LIMIT 1`,
    [submissionId],
  )[0];
  if (!row) return false;
  return row.pending_op !== 'unsave';
}

/** Optimistic save: visible immediately, queued for the cloud. */
export function markSavedLocally(
  db: DatabaseAdapter,
  submissionId: string,
  options: { pending?: boolean; savedAt?: Date | string } = {},
): void {
  const at = nowIso(options.savedAt);
  db.execute(
    `INSERT INTO rc_saved_submissions_cache (submission_id, saved_at, pending_op, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(submission_id) DO UPDATE SET
       pending_op = excluded.pending_op,
       updated_at = excluded.updated_at`,
    [submissionId, at, options.pending === false ? null : 'save', at],
  );
}

/** Optimistic unsave: hidden immediately, deletion queued for the cloud. */
export function markUnsavedLocally(
  db: DatabaseAdapter,
  submissionId: string,
  options: { pending?: boolean } = {},
): void {
  if (options.pending === false) {
    db.execute(`DELETE FROM rc_saved_submissions_cache WHERE submission_id = ?`, [submissionId]);
    return;
  }
  const at = nowIso();
  db.execute(
    `INSERT INTO rc_saved_submissions_cache (submission_id, saved_at, pending_op, updated_at)
     VALUES (?, ?, 'unsave', ?)
     ON CONFLICT(submission_id) DO UPDATE SET
       pending_op = 'unsave',
       updated_at = excluded.updated_at`,
    [submissionId, at, at],
  );
}

/** Replace the cache with the cloud truth, preserving queued local ops. */
export function reconcileSavedCache(
  db: DatabaseAdapter,
  cloudSavedIds: readonly string[],
  now: Date | string = new Date(),
): void {
  const at = nowIso(now);
  db.transaction(() => {
    db.execute(`DELETE FROM rc_saved_submissions_cache WHERE pending_op IS NULL`);
    for (const submissionId of cloudSavedIds) {
      db.execute(
        `INSERT INTO rc_saved_submissions_cache (submission_id, saved_at, pending_op, updated_at)
         VALUES (?, ?, NULL, ?)
         ON CONFLICT(submission_id) DO NOTHING`,
        [submissionId, at, at],
      );
    }
  });
}

export function listPendingSaveOps(db: DatabaseAdapter): SavedSubmissionCacheEntry[] {
  return db
    .query<CacheRow>(
      `SELECT * FROM rc_saved_submissions_cache
       WHERE pending_op IS NOT NULL
       ORDER BY updated_at ASC`,
    )
    .map(mapRow);
}

export interface DrainPendingSavesDeps {
  save: (submissionId: string) => Promise<{ ok: boolean; retryable?: boolean }>;
  unsave: (submissionId: string) => Promise<{ ok: boolean; retryable?: boolean }>;
  stopOnFailure?: boolean;
}

export interface DrainPendingSavesResult {
  processed: number;
  committed: number;
  failed: number;
  stoppedOnFailure: boolean;
}

/**
 * Push queued save/unsave ops to the cloud. Non-retryable failures drop the
 * pending op (save rolls back to unsaved, unsave completes locally) so the
 * queue can never wedge on a permanent rejection.
 */
export async function drainPendingSaves(
  db: DatabaseAdapter,
  deps: DrainPendingSavesDeps,
): Promise<DrainPendingSavesResult> {
  const result: DrainPendingSavesResult = {
    processed: 0,
    committed: 0,
    failed: 0,
    stoppedOnFailure: false,
  };

  for (const entry of listPendingSaveOps(db)) {
    result.processed += 1;
    const outcome = entry.pendingOp === 'save'
      ? await deps.save(entry.submissionId)
      : await deps.unsave(entry.submissionId);

    if (outcome.ok) {
      if (entry.pendingOp === 'save') {
        markSavedLocally(db, entry.submissionId, { pending: false, savedAt: entry.savedAt });
      } else {
        markUnsavedLocally(db, entry.submissionId, { pending: false });
      }
      result.committed += 1;
      continue;
    }

    result.failed += 1;
    if (outcome.retryable === false) {
      // Permanent rejection: drop the row entirely. A failed save rolls
      // back to unsaved; a failed unsave still ends unsaved locally (the
      // cloud row, if any, resurfaces on the next reconcile).
      markUnsavedLocally(db, entry.submissionId, { pending: false });
    }
    if (deps.stopOnFailure !== false) {
      result.stoppedOnFailure = true;
      break;
    }
  }

  return result;
}
