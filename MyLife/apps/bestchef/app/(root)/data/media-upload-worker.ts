/**
 * Platform legs for the submission media upload queue (plan 33 Phase 4.4).
 *
 * Compression (image quality ladder), validation (server byte caps),
 * hashing, signed-URL PUT with byte-level progress via
 * FileSystem.createUploadTask (cancellable), and finalize. The state
 * machine lives module-side in drainMediaJobs; this file only supplies
 * processJob.
 *
 * Video transcoding is deliberately NOT here: HLS ladders are the Phase
 * 4.1 media pipeline (founder F4, Cloudflare Stream vs Mux). The client
 * validates size caps and uploads the original; oversized videos fail
 * with honest copy instead of pretending to compress.
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createSubmissionMediaIntent,
  drainMediaJobs,
  enqueueMediaJob,
  finalizeSubmissionMedia,
  getMediaJob,
  isMediaJobCancelled,
  listActiveMediaJobs,
  listMediaJobsForOwner,
  pruneSettledMediaJobs,
  requeueStalledMediaJobs,
  updateMediaJob,
  type DrainMediaJobsResult,
  type MediaJobOutcome,
  type MediaUploadJob,
} from '@mylife/bestchef';
import type { DatabaseAdapter } from '@mylife/db';

/** Server caps (supabase/functions/_shared/media.ts). */
export const SUBMISSION_IMAGE_MAX_BYTES = 12 * 1024 * 1024;
export const SUBMISSION_VIDEO_MAX_BYTES = 150 * 1024 * 1024;

const IMAGE_COMPRESS_LADDER = [0.85, 0.7, 0.5, 0.35];

async function fileSize(uri: string): Promise<number | null> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return null;
    return (info as { size?: number }).size ?? null;
  } catch {
    return null;
  }
}

/**
 * Hash via the NATIVE fetch/blob path (no JS byte loops). Only used for
 * images (<= 12MiB); videos pass a null hash because materializing 150MB
 * in the JS heap jetsam-kills the app (review P0).
 */
async function sha256HexOfFile(uri: string): Promise<string | null> {
  try {
    const subtle = (globalThis as { crypto?: { subtle?: SubtleCrypto } }).crypto?.subtle;
    if (!subtle) return null;
    const response = await fetch(uri);
    const buffer = await response.arrayBuffer();
    const digest = await subtle.digest('SHA-256', buffer);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}

/** Walk the quality ladder until the encoded jpeg fits the server cap. */
async function compressImage(uri: string): Promise<{ uri: string; byteSize: number } | null> {
  const original = await fileSize(uri);
  if (original !== null && original <= SUBMISSION_IMAGE_MAX_BYTES) {
    return { uri, byteSize: original };
  }
  for (const quality of IMAGE_COMPRESS_LADDER) {
    try {
      const result = await ImageManipulator.manipulateAsync(uri, [], {
        compress: quality,
        format: ImageManipulator.SaveFormat.JPEG,
      });
      const size = await fileSize(result.uri);
      if (size !== null && size <= SUBMISSION_IMAGE_MAX_BYTES) {
        return { uri: result.uri, byteSize: size };
      }
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Process one job end to end. Progress: 0-15 compression, 15-90 upload
 * bytes, 90-100 finalize. Cancellation is checked between legs and aborts
 * the in-flight PUT.
 */
export async function processSubmissionMediaJob(
  db: DatabaseAdapter,
  supabase: SupabaseClient,
  job: MediaUploadJob,
  onProgress: (pct: number) => void,
): Promise<MediaJobOutcome> {
  // ── Leg 0: existence + compression/validation ──────────────────────
  const exists = await fileSize(job.localUri);
  if (exists === null) {
    return { ok: false, retryable: false, error: 'draft_file_missing' };
  }

  let uploadUri = job.compressedUri ?? job.localUri;
  let byteSize = exists;

  if (job.mediaKind === 'image') {
    const compressed = await compressImage(uploadUri);
    if (!compressed) {
      return { ok: false, retryable: false, error: 'file_too_large' };
    }
    uploadUri = compressed.uri;
    byteSize = compressed.byteSize;
    // Persisting lets a retry skip recompression.
    updateMediaJob(db, job.id, { compressedUri: uploadUri, byteSize });
  } else if (byteSize > SUBMISSION_VIDEO_MAX_BYTES) {
    // No client transcode until the Phase 4.1 pipeline (founder F4).
    return { ok: false, retryable: false, error: 'file_too_large' };
  }
  onProgress(10);
  if (isMediaJobCancelled(db, job.id)) return { ok: false, retryable: false, error: 'cancelled' };

  // ── Hash: images only. Videos send null (server accepts it); reading
  // a 150MB file into the JS heap crash-loops the app (review P0). ─────
  let contentHash: string | null = null;
  if (job.mediaKind === 'image') {
    contentHash = await sha256HexOfFile(uploadUri);
    if (!contentHash) return { ok: false, retryable: false, error: 'invalid_input' };
  }
  onProgress(15);
  if (isMediaJobCancelled(db, job.id)) return { ok: false, retryable: false, error: 'cancelled' };

  // ── Leg 1: intent ───────────────────────────────────────────────────
  const intent = await createSubmissionMediaIntent(
    {
      ownerId: job.ownerId,
      mediaKind: job.mediaKind,
      mimeType: job.mimeType,
      byteSize,
      contentHash,
    },
    supabase,
  );
  if (!intent.ok) {
    return { ok: false, retryable: intent.retryable, error: intent.code };
  }
  if (isMediaJobCancelled(db, job.id)) return { ok: false, retryable: false, error: 'cancelled' };

  // ── Leg 2: PUT with byte progress + cooperative cancel ─────────────
  updateMediaJob(db, job.id, { status: 'uploading' });
  // Progress ticks fire per network chunk (thousands for 150MB): only
  // touch SQLite when the integer percent changes, and poll cancellation at
  // most twice a second (review perf finding).
  let lastReportedPct = -1;
  let lastCancelPollMs = 0;
  const uploadTask = FileSystem.createUploadTask(
    intent.data.signedUploadUrl,
    uploadUri,
    {
      httpMethod: 'PUT',
      headers: { 'Content-Type': job.mimeType, 'x-upsert': 'false' },
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    },
    ({ totalBytesSent, totalBytesExpectedToSend }) => {
      if (totalBytesExpectedToSend > 0) {
        const pct = Math.round(15 + (totalBytesSent / totalBytesExpectedToSend) * 75);
        if (pct !== lastReportedPct) {
          lastReportedPct = pct;
          onProgress(pct);
        }
      }
      const nowMs = Date.now();
      if (nowMs - lastCancelPollMs >= 500) {
        lastCancelPollMs = nowMs;
        if (isMediaJobCancelled(db, job.id)) {
          void uploadTask.cancelAsync().catch(() => {});
        }
      }
    },
  );

  let putStatus: number | undefined;
  try {
    const res = await uploadTask.uploadAsync();
    putStatus = res?.status;
  } catch {
    if (isMediaJobCancelled(db, job.id)) return { ok: false, retryable: false, error: 'cancelled' };
    return { ok: false, retryable: true, error: 'network' };
  }
  if (isMediaJobCancelled(db, job.id)) return { ok: false, retryable: false, error: 'cancelled' };
  if (putStatus === undefined || putStatus >= 400) {
    return {
      ok: false,
      retryable: putStatus !== 413,
      error: putStatus === 413 ? 'file_too_large' : 'service_unavailable',
    };
  }
  onProgress(90);

  // ── Leg 3: finalize ─────────────────────────────────────────────────
  updateMediaJob(db, job.id, { status: 'finalizing' });
  const finalized = await finalizeSubmissionMedia(
    {
      intent: intent.data,
      byteSize,
      contentHash,
      // Client-known dimensions ride the job so the server persists
      // bc_media_assets.duration_ms and feed cards can show clip length
      // (audit M2). Videos carry durationMs; the server clamps bounds.
      durationMs: job.durationMs,
      width: job.width,
      height: job.height,
    },
    supabase,
  );
  if (!finalized.ok) {
    return { ok: false, retryable: finalized.retryable, error: finalized.code };
  }

  return {
    ok: true,
    assetId: finalized.data.assetId,
    // The video bucket is private: getPublicUrl would fabricate a dead
    // 403 link, so only image jobs carry a public URL (review finding).
    publicUrl: job.mediaKind === 'image' ? finalized.data.publicUrl : undefined,
  };
}

/** Job errors where a retry can never help (drives the retry-queue call). */
export function isPermanentJobError(code: string | null | undefined): boolean {
  return code === 'draft_file_missing'
    || code === 'cancelled'
    || code === 'attempts_exhausted'
    || code === 'file_too_large'
    || code === 'invalid_input'
    || code === 'unsupported_media_type';
}

export type PhotoQueueResolution =
  | { status: 'done'; publicUrl: string }
  | { status: 'cancelled' }
  | { status: 'failed'; code: string; permanent: boolean };

/**
 * THE single photo-upload path for publish AND retry (review finding: two
 * parallel pipelines double-uploaded the same bytes). Reuses a settled job
 * for the owner when one exists, reuses an active job instead of enqueuing
 * a duplicate, drains owner-scoped, and reports the outcome.
 */
export async function resolveSubmissionPhotoViaQueue(
  db: DatabaseAdapter,
  supabase: SupabaseClient,
  input: { ownerId: string; localUri: string },
  hooks?: { onJobStart?: (jobId: string) => void; onProgress?: (pct: number) => void },
): Promise<PhotoQueueResolution> {
  const existingDone = listMediaJobsForOwner(db, input.ownerId).find(
    (job) => job.mediaKind === 'image' && job.status === 'done' && job.publicUrl,
  );
  if (existingDone?.publicUrl) {
    return { status: 'done', publicUrl: existingDone.publicUrl };
  }

  const active = listActiveMediaJobs(db, input.ownerId).find((job) => job.mediaKind === 'image');
  const job = active ?? enqueueSubmissionMedia(db, {
    ownerId: input.ownerId,
    mediaKind: 'image',
    localUri: input.localUri,
  });
  hooks?.onJobStart?.(job.id);

  await drainMediaJobsForOwner(db, supabase, input.ownerId, (_jobId, pct) => {
    hooks?.onProgress?.(pct);
  });

  const settled = getMediaJob(db, job.id);
  if (settled?.status === 'done' && settled.publicUrl) {
    return { status: 'done', publicUrl: settled.publicUrl };
  }
  if (settled?.status === 'cancelled') {
    return { status: 'cancelled' };
  }
  const code = settled?.lastError ?? 'unknown';
  return { status: 'failed', code, permanent: isPermanentJobError(code) };
}

/** Jobs being processed by THIS process (publish drain or sweep). */
const inFlightJobIds = new Set<string>();

export function enqueueSubmissionMedia(
  db: DatabaseAdapter,
  input: {
    ownerId: string;
    mediaKind: 'image' | 'video';
    localUri: string;
    mimeType?: string;
    durationMs?: number | null;
    width?: number | null;
    height?: number | null;
  },
): MediaUploadJob {
  return enqueueMediaJob(db, {
    ownerId: input.ownerId,
    mediaKind: input.mediaKind,
    localUri: input.localUri,
    mimeType: input.mimeType ?? (input.mediaKind === 'video' ? 'video/mp4' : 'image/jpeg'),
    durationMs: input.durationMs,
    width: input.width,
    height: input.height,
  });
}

/**
 * Drain only one owner's jobs (publish flow: upload THIS submission's
 * media now with progress, without churning through older queue items).
 */
export async function drainMediaJobsForOwner(
  db: DatabaseAdapter,
  supabase: SupabaseClient,
  ownerId: string,
  onProgress?: (jobId: string, pct: number) => void,
): Promise<DrainMediaJobsResult> {
  return drainMediaJobs(db, {
    processJob: async (job, report) => {
      inFlightJobIds.add(job.id);
      try {
        return await processSubmissionMediaJob(db, supabase, job, (pct) => {
          report(pct);
          onProgress?.(job.id, pct);
        });
      } finally {
        inFlightJobIds.delete(job.id);
      }
    },
    filter: (job) => job.ownerId === ownerId,
    stopOnFailure: true,
  });
}

/** One drain pass: requeue app-death strays, then process the queue. */
export async function sweepMediaUploadJobs(
  db: DatabaseAdapter,
  supabase: SupabaseClient,
): Promise<DrainMediaJobsResult> {
  pruneSettledMediaJobs(db);
  // Never yank a job the publish drain is processing right now.
  requeueStalledMediaJobs(db, [...inFlightJobIds]);
  return drainMediaJobs(db, {
    processJob: async (job, onProgress) => {
      inFlightJobIds.add(job.id);
      try {
        return await processSubmissionMediaJob(db, supabase, job, onProgress);
      } finally {
        inFlightJobIds.delete(job.id);
      }
    },
    stopOnFailure: true,
  });
}
