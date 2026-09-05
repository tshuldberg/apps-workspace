/**
 * Submission media upload queue (plan 33 Phase 4.4, BCSERVER-P0-04).
 *
 * Durable, device-local job records for submission photos and videos:
 * compression state, byte-level progress, attempts, cancellation, and the
 * finalized asset/public URL. The app layer supplies the platform legs
 * (compression, PUT with progress) through DrainMediaJobsDeps; this module
 * owns the state machine so it stays unit-testable off-device.
 */

import type { DatabaseAdapter } from '@mylife/db';

export type MediaUploadJobStatus =
  | 'queued'
  | 'compressing'
  | 'uploading'
  | 'finalizing'
  | 'done'
  | 'failed'
  | 'cancelled';

export interface MediaUploadJob {
  id: string;
  ownerId: string;
  mediaKind: 'image' | 'video';
  localUri: string;
  compressedUri: string | null;
  mimeType: string;
  byteSize: number | null;
  contentHash: string | null;
  /** Client-known media duration (videos) forwarded to finalize (audit M2). */
  durationMs: number | null;
  /** Client-known pixel width forwarded to finalize (audit M2). */
  width: number | null;
  /** Client-known pixel height forwarded to finalize (audit M2). */
  height: number | null;
  status: MediaUploadJobStatus;
  /** 0-100. */
  progress: number;
  attempts: number;
  lastError: string | null;
  assetId: string | null;
  publicUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export const MEDIA_JOB_MAX_ATTEMPTS = 5;

interface JobRow {
  id: string;
  owner_id: string;
  media_kind: string;
  local_uri: string;
  compressed_uri: string | null;
  mime_type: string;
  byte_size: number | null;
  content_hash: string | null;
  duration_ms: number | null;
  width: number | null;
  height: number | null;
  status: string;
  progress: number;
  attempts: number;
  last_error: string | null;
  asset_id: string | null;
  public_url: string | null;
  created_at: string;
  updated_at: string;
}

const ACTIVE_STATUSES = "('queued', 'compressing', 'uploading', 'finalizing')";

function nowIso(now: Date | string = new Date()): string {
  return now instanceof Date ? now.toISOString() : now;
}

function defaultId(): string {
  const maybeCrypto = globalThis as typeof globalThis & {
    crypto?: { randomUUID?: () => string };
  };
  return maybeCrypto.crypto?.randomUUID?.() ?? `job-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function isStatus(value: string): value is MediaUploadJobStatus {
  return ['queued', 'compressing', 'uploading', 'finalizing', 'done', 'failed', 'cancelled'].includes(value);
}

function mapRow(row: JobRow): MediaUploadJob {
  return {
    id: row.id,
    ownerId: row.owner_id,
    mediaKind: row.media_kind === 'video' ? 'video' : 'image',
    localUri: row.local_uri,
    compressedUri: row.compressed_uri,
    mimeType: row.mime_type,
    byteSize: row.byte_size,
    contentHash: row.content_hash,
    durationMs: row.duration_ms,
    width: row.width,
    height: row.height,
    status: isStatus(row.status) ? row.status : 'failed',
    progress: Math.max(0, Math.min(100, row.progress ?? 0)),
    attempts: row.attempts ?? 0,
    lastError: row.last_error,
    assetId: row.asset_id,
    publicUrl: row.public_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface EnqueueMediaJobInput {
  id?: string;
  ownerId: string;
  mediaKind: 'image' | 'video';
  localUri: string;
  mimeType: string;
  /** Client-known media dimensions, forwarded to finalize (audit M2). */
  durationMs?: number | null;
  width?: number | null;
  height?: number | null;
  createdAt?: string;
}

/** Clamp a client-supplied dimension to a non-negative integer, or null. */
function sanitizeDimension(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return Math.floor(value);
}

export function enqueueMediaJob(db: DatabaseAdapter, input: EnqueueMediaJobInput): MediaUploadJob {
  const createdAt = input.createdAt ?? nowIso();
  const id = input.id ?? defaultId();
  db.execute(
    `INSERT INTO rc_media_upload_jobs (
      id, owner_id, media_kind, local_uri, mime_type, duration_ms, width, height, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.ownerId,
      input.mediaKind,
      input.localUri,
      input.mimeType,
      sanitizeDimension(input.durationMs),
      sanitizeDimension(input.width),
      sanitizeDimension(input.height),
      createdAt,
      createdAt,
    ],
  );
  const job = getMediaJob(db, id);
  if (!job) throw new Error('Media job insert failed.');
  return job;
}

export function getMediaJob(db: DatabaseAdapter, id: string): MediaUploadJob | null {
  const row = db.query<JobRow>(
    `SELECT * FROM rc_media_upload_jobs WHERE id = ? LIMIT 1`,
    [id],
  )[0];
  return row ? mapRow(row) : null;
}

/** Every job for an owner, newest first (retry reconciliation). */
export function listMediaJobsForOwner(db: DatabaseAdapter, ownerId: string): MediaUploadJob[] {
  return db
    .query<JobRow>(
      `SELECT * FROM rc_media_upload_jobs WHERE owner_id = ? ORDER BY created_at DESC, rowid DESC`,
      [ownerId],
    )
    .map(mapRow);
}

export function listActiveMediaJobs(db: DatabaseAdapter, ownerId?: string): MediaUploadJob[] {
  const rows = ownerId
    ? db.query<JobRow>(
        `SELECT * FROM rc_media_upload_jobs WHERE status IN ${ACTIVE_STATUSES} AND owner_id = ? ORDER BY created_at ASC, rowid ASC`,
        [ownerId],
      )
    : db.query<JobRow>(
        `SELECT * FROM rc_media_upload_jobs WHERE status IN ${ACTIVE_STATUSES} ORDER BY created_at ASC, rowid ASC`,
      );
  return rows.map(mapRow);
}

export function updateMediaJob(
  db: DatabaseAdapter,
  id: string,
  patch: Partial<{
    status: MediaUploadJobStatus;
    progress: number;
    compressedUri: string | null;
    byteSize: number | null;
    contentHash: string | null;
    attempts: number;
    lastError: string | null;
    assetId: string | null;
    publicUrl: string | null;
  }>,
  now: Date | string = new Date(),
): void {
  const columns: string[] = [];
  const values: unknown[] = [];
  const mapping: Record<string, string> = {
    status: 'status',
    progress: 'progress',
    compressedUri: 'compressed_uri',
    byteSize: 'byte_size',
    contentHash: 'content_hash',
    attempts: 'attempts',
    lastError: 'last_error',
    assetId: 'asset_id',
    publicUrl: 'public_url',
  };
  for (const [key, column] of Object.entries(mapping)) {
    if (key in patch) {
      columns.push(`${column} = ?`);
      values.push((patch as Record<string, unknown>)[key]);
    }
  }
  if (columns.length === 0) return;
  columns.push('updated_at = ?');
  values.push(nowIso(now));
  values.push(id);
  db.execute(
    `UPDATE rc_media_upload_jobs SET ${columns.join(', ')} WHERE id = ?`,
    values,
  );
}

/** Cancellation is cooperative: the worker checks this between legs. */
export function cancelMediaJob(db: DatabaseAdapter, id: string): void {
  db.execute(
    `UPDATE rc_media_upload_jobs
     SET status = 'cancelled', updated_at = ?
     WHERE id = ? AND status IN ${ACTIVE_STATUSES}`,
    [nowIso(), id],
  );
}

export function isMediaJobCancelled(db: DatabaseAdapter, id: string): boolean {
  return getMediaJob(db, id)?.status === 'cancelled';
}

/**
 * Jobs left mid-flight by an app death are re-queued for the next drain.
 * excludeIds: jobs currently being processed in THIS process (a publish
 * drain in flight) must not be yanked back to queued underneath it.
 */
export function requeueStalledMediaJobs(db: DatabaseAdapter, excludeIds: readonly string[] = []): number {
  const placeholders = excludeIds.map(() => '?').join(', ');
  const where = excludeIds.length > 0
    ? `WHERE status IN ('compressing', 'uploading', 'finalizing') AND id NOT IN (${placeholders})`
    : `WHERE status IN ('compressing', 'uploading', 'finalizing')`;
  db.execute(
    `UPDATE rc_media_upload_jobs
     SET status = 'queued', progress = 0, updated_at = ?
     ${where}`,
    [nowIso(), ...excludeIds],
  );
  return db.query<{ n: number }>(
    `SELECT COUNT(*) as n FROM rc_media_upload_jobs WHERE status = 'queued'`,
  )[0]?.n ?? 0;
}

/** Remove settled rows so the table cannot grow forever. */
export function pruneSettledMediaJobs(db: DatabaseAdapter, maxAgeDays = 7): void {
  db.execute(
    `DELETE FROM rc_media_upload_jobs
     WHERE status IN ('done', 'failed', 'cancelled')
       AND updated_at < datetime('now', ?)`,
    [`-${Math.max(1, Math.floor(maxAgeDays))} days`],
  );
}

export interface MediaJobOutcome {
  ok: boolean;
  retryable?: boolean;
  error?: string;
  assetId?: string;
  publicUrl?: string;
}

export interface DrainMediaJobsDeps {
  /** Runs all platform legs for one job. Must call the progress callback. */
  processJob: (job: MediaUploadJob, onProgress: (pct: number) => void) => Promise<MediaJobOutcome>;
  /** Restrict the pass to matching jobs (e.g. one owner during publish). */
  filter?: (job: MediaUploadJob) => boolean;
  stopOnFailure?: boolean;
  now?: () => Date | string;
}

export interface DrainMediaJobsResult {
  processed: number;
  completed: number;
  failed: number;
  cancelled: number;
  stoppedOnFailure: boolean;
}

export async function drainMediaJobs(
  db: DatabaseAdapter,
  deps: DrainMediaJobsDeps,
): Promise<DrainMediaJobsResult> {
  const result: DrainMediaJobsResult = {
    processed: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    stoppedOnFailure: false,
  };

  for (const listed of listActiveMediaJobs(db)) {
    if (deps.filter && !deps.filter(listed)) continue;

    // CLAIM: re-read fresh state and flip to 'compressing' synchronously
    // (no await between read and write, so JS run-to-completion makes the
    // claim atomic against a concurrently interleaved drain). A job another
    // drain claimed is no longer 'queued' and is skipped here.
    const job = getMediaJob(db, listed.id);
    if (!job || job.status !== 'queued') continue;
    updateMediaJob(db, job.id, { status: 'compressing', attempts: job.attempts + 1 }, deps.now?.());
    result.processed += 1;

    let outcome: MediaJobOutcome;
    try {
      outcome = await deps.processJob(job, (pct) => {
        updateMediaJob(db, job.id, { progress: Math.max(0, Math.min(100, Math.round(pct))) }, deps.now?.());
      });
    } catch {
      // A THROW must never wedge the queue: treat as a retryable failure so
      // the attempt budget applies (review: unbounded queued+attempts).
      outcome = { ok: false, retryable: true, error: 'exception' };
    }

    // The worker may have observed a cancellation mid-flight.
    if (isMediaJobCancelled(db, job.id)) {
      result.cancelled += 1;
      continue;
    }

    if (outcome.ok) {
      // Guarded terminal write: a cancel landing between the check above
      // and this write must win (review: publish-after-cancel race).
      db.execute(
        `UPDATE rc_media_upload_jobs
         SET status = 'done', progress = 100, asset_id = ?, public_url = ?, last_error = NULL, updated_at = ?
         WHERE id = ? AND status != 'cancelled'`,
        [outcome.assetId ?? null, outcome.publicUrl ?? null, nowIso(deps.now?.()), job.id],
      );
      if (getMediaJob(db, job.id)?.status === 'cancelled') {
        result.cancelled += 1;
      } else {
        result.completed += 1;
      }
      continue;
    }

    const attempts = job.attempts + 1;
    const exhausted = attempts >= MEDIA_JOB_MAX_ATTEMPTS;
    const permanent = outcome.retryable === false || exhausted;
    updateMediaJob(db, job.id, {
      status: permanent ? 'failed' : 'queued',
      progress: 0,
      lastError: outcome.error ?? (exhausted ? 'attempts_exhausted' : 'unknown'),
    }, deps.now?.());
    result.failed += 1;
    if (deps.stopOnFailure !== false) {
      result.stoppedOnFailure = true;
      break;
    }
  }

  return result;
}
