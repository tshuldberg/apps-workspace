import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { RECIPES_MODULE } from '../../definition';
import {
  MEDIA_JOB_MAX_ATTEMPTS,
  cancelMediaJob,
  drainMediaJobs,
  enqueueMediaJob,
  getMediaJob,
  listActiveMediaJobs,
  listMediaJobsForOwner,
  pruneSettledMediaJobs,
  requeueStalledMediaJobs,
  updateMediaJob,
} from '../media-upload-queue';

describe('media upload queue (plan 33 Phase 4.4)', () => {
  let db: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('recipes', RECIPES_MODULE.migrations!);
    db = testDb.adapter;
    closeDb = () => testDb.close();
  });

  afterEach(() => {
    closeDb();
  });

  it('creates the jobs table and enqueues', () => {
    expect(RECIPES_MODULE.schemaVersion).toBe(34);
    const job = enqueueMediaJob(db, {
      ownerId: 'local-1',
      mediaKind: 'image',
      localUri: 'file:///photo.jpg',
      mimeType: 'image/jpeg',
    });
    expect(job.status).toBe('queued');
    expect(job.progress).toBe(0);
    // Dimension columns default to null when not supplied.
    expect(job.durationMs).toBeNull();
    expect(job.width).toBeNull();
    expect(job.height).toBeNull();
    expect(listActiveMediaJobs(db)).toHaveLength(1);
  });

  it('persists and round-trips video duration/width/height (audit M2)', () => {
    const job = enqueueMediaJob(db, {
      ownerId: 'local-1',
      mediaKind: 'video',
      localUri: 'file:///clip.mp4',
      mimeType: 'video/mp4',
      durationMs: 42_000,
      width: 1080,
      height: 1920,
    });
    const stored = getMediaJob(db, job.id);
    expect(stored).toMatchObject({ durationMs: 42_000, width: 1080, height: 1920 });
  });

  it('clamps invalid dimensions to null on enqueue', () => {
    const job = enqueueMediaJob(db, {
      ownerId: 'local-1',
      mediaKind: 'video',
      localUri: 'file:///clip.mp4',
      mimeType: 'video/mp4',
      durationMs: -5,
      width: 0,
      height: Number.NaN,
    });
    expect(getMediaJob(db, job.id)).toMatchObject({ durationMs: null, width: null, height: null });
  });

  it('drains a job through progress to done with asset + url', async () => {
    const job = enqueueMediaJob(db, {
      ownerId: 'local-1',
      mediaKind: 'image',
      localUri: 'file:///photo.jpg',
      mimeType: 'image/jpeg',
    });

    const result = await drainMediaJobs(db, {
      processJob: async (j, onProgress) => {
        onProgress(40);
        expect(getMediaJob(db, j.id)?.progress).toBe(40);
        onProgress(90);
        return { ok: true, assetId: 'asset-1', publicUrl: 'https://cdn.example.com/a.jpg' };
      },
    });

    expect(result).toMatchObject({ processed: 1, completed: 1, failed: 0 });
    const done = getMediaJob(db, job.id);
    expect(done).toMatchObject({
      status: 'done',
      progress: 100,
      assetId: 'asset-1',
      publicUrl: 'https://cdn.example.com/a.jpg',
      attempts: 1,
    });
  });

  it('requeues retryable failures and stops the pass', async () => {
    enqueueMediaJob(db, { ownerId: 'a', mediaKind: 'image', localUri: 'file:///1.jpg', mimeType: 'image/jpeg' });
    enqueueMediaJob(db, { ownerId: 'b', mediaKind: 'image', localUri: 'file:///2.jpg', mimeType: 'image/jpeg' });

    const result = await drainMediaJobs(db, {
      processJob: async () => ({ ok: false, retryable: true, error: 'network' }),
    });

    expect(result).toMatchObject({ processed: 1, failed: 1, stoppedOnFailure: true });
    const jobs = listActiveMediaJobs(db);
    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toMatchObject({ status: 'queued', attempts: 1, lastError: 'network' });
  });

  it('permanently fails non-retryable outcomes', async () => {
    const job = enqueueMediaJob(db, { ownerId: 'a', mediaKind: 'video', localUri: 'file:///v.mp4', mimeType: 'video/mp4' });

    await drainMediaJobs(db, {
      processJob: async () => ({ ok: false, retryable: false, error: 'file_too_large' }),
    });

    expect(getMediaJob(db, job.id)).toMatchObject({ status: 'failed', lastError: 'file_too_large' });
    expect(listActiveMediaJobs(db)).toHaveLength(0);
  });

  it('exhausts the attempt budget', async () => {
    const job = enqueueMediaJob(db, { ownerId: 'a', mediaKind: 'image', localUri: 'file:///1.jpg', mimeType: 'image/jpeg' });
    for (let i = 0; i < MEDIA_JOB_MAX_ATTEMPTS; i += 1) {
      await drainMediaJobs(db, {
        processJob: async () => ({ ok: false, retryable: true, error: 'network' }),
      });
    }
    expect(getMediaJob(db, job.id)).toMatchObject({ status: 'failed', attempts: MEDIA_JOB_MAX_ATTEMPTS });
  });

  it('cancellation mid-flight wins over the outcome', async () => {
    const job = enqueueMediaJob(db, { ownerId: 'a', mediaKind: 'image', localUri: 'file:///1.jpg', mimeType: 'image/jpeg' });

    const result = await drainMediaJobs(db, {
      processJob: async (j) => {
        cancelMediaJob(db, j.id);
        return { ok: true, assetId: 'asset-x', publicUrl: 'https://x' };
      },
    });

    expect(result).toMatchObject({ cancelled: 1, completed: 0 });
    expect(getMediaJob(db, job.id)?.status).toBe('cancelled');
  });

  it('treats a processJob THROW as a retryable failure instead of wedging', async () => {
    const job = enqueueMediaJob(db, { ownerId: 'a', mediaKind: 'image', localUri: 'file:///1.jpg', mimeType: 'image/jpeg' });

    const result = await drainMediaJobs(db, {
      processJob: async () => { throw new Error('boom'); },
    });

    expect(result).toMatchObject({ processed: 1, failed: 1 });
    expect(getMediaJob(db, job.id)).toMatchObject({
      status: 'queued',
      attempts: 1,
      lastError: 'exception',
    });

    // Exhaustion applies to throws too: the job eventually fails hard.
    for (let i = 1; i < MEDIA_JOB_MAX_ATTEMPTS; i += 1) {
      await drainMediaJobs(db, {
        processJob: async () => { throw new Error('boom'); },
      });
    }
    expect(getMediaJob(db, job.id)?.status).toBe('failed');
  });

  it('claims jobs so a concurrent drain cannot double-process', async () => {
    const job = enqueueMediaJob(db, { ownerId: 'a', mediaKind: 'image', localUri: 'file:///1.jpg', mimeType: 'image/jpeg' });

    let innerProcessed = 0;
    const outer = await drainMediaJobs(db, {
      processJob: async () => {
        // While the first drain holds the claim, a second drain must skip.
        const inner = await drainMediaJobs(db, {
          processJob: async () => {
            innerProcessed += 1;
            return { ok: true };
          },
        });
        expect(inner.processed).toBe(0);
        return { ok: true, assetId: 'asset-1' };
      },
    });

    expect(outer).toMatchObject({ processed: 1, completed: 1 });
    expect(innerProcessed).toBe(0);
    expect(getMediaJob(db, job.id)?.status).toBe('done');
  });

  it('a cancel racing the terminal write wins', async () => {
    const job = enqueueMediaJob(db, { ownerId: 'a', mediaKind: 'image', localUri: 'file:///1.jpg', mimeType: 'image/jpeg' });

    // Simulate the narrow window: the worker returns ok, but the user
    // cancelled after the post-outcome check would have passed. The
    // guarded UPDATE must not resurrect the job to done.
    updateMediaJob(db, job.id, { status: 'cancelled' });
    const result = await drainMediaJobs(db, {
      processJob: async () => ({ ok: true, assetId: 'asset-1' }),
    });
    // Cancelled jobs are not queued, so nothing processes at all.
    expect(result.processed).toBe(0);
    expect(getMediaJob(db, job.id)?.status).toBe('cancelled');
  });

  it('prunes settled rows and keeps active ones', () => {
    const done = enqueueMediaJob(db, { ownerId: 'a', mediaKind: 'image', localUri: 'file:///1.jpg', mimeType: 'image/jpeg' });
    db.execute(
      `UPDATE rc_media_upload_jobs SET status = 'done', updated_at = datetime('now', '-10 days') WHERE id = ?`,
      [done.id],
    );
    const active = enqueueMediaJob(db, { ownerId: 'b', mediaKind: 'image', localUri: 'file:///2.jpg', mimeType: 'image/jpeg' });

    pruneSettledMediaJobs(db, 7);
    expect(getMediaJob(db, done.id)).toBeNull();
    expect(getMediaJob(db, active.id)).not.toBeNull();
  });

  it('stall requeue spares excluded in-flight jobs', () => {
    const mine = enqueueMediaJob(db, { ownerId: 'a', mediaKind: 'image', localUri: 'file:///1.jpg', mimeType: 'image/jpeg' });
    const stray = enqueueMediaJob(db, { ownerId: 'b', mediaKind: 'image', localUri: 'file:///2.jpg', mimeType: 'image/jpeg' });
    updateMediaJob(db, mine.id, { status: 'uploading' });
    updateMediaJob(db, stray.id, { status: 'uploading' });

    requeueStalledMediaJobs(db, [mine.id]);
    expect(getMediaJob(db, mine.id)?.status).toBe('uploading');
    expect(getMediaJob(db, stray.id)?.status).toBe('queued');
  });

  it('lists owner jobs newest first across statuses', () => {
    enqueueMediaJob(db, { ownerId: 'a', mediaKind: 'image', localUri: 'file:///1.jpg', mimeType: 'image/jpeg', createdAt: '2026-07-01T00:00:00.000Z' });
    const newer = enqueueMediaJob(db, { ownerId: 'a', mediaKind: 'video', localUri: 'file:///2.mp4', mimeType: 'video/mp4', createdAt: '2026-07-02T00:00:00.000Z' });
    updateMediaJob(db, newer.id, { status: 'done' });

    const jobs = listMediaJobsForOwner(db, 'a');
    expect(jobs).toHaveLength(2);
    expect(jobs[0].id).toBe(newer.id);
  });

  it('requeues stalled mid-flight jobs after an app death', () => {
    const job = enqueueMediaJob(db, { ownerId: 'a', mediaKind: 'image', localUri: 'file:///1.jpg', mimeType: 'image/jpeg' });
    updateMediaJob(db, job.id, { status: 'uploading', progress: 60 });

    const queued = requeueStalledMediaJobs(db);
    expect(queued).toBe(1);
    expect(getMediaJob(db, job.id)).toMatchObject({ status: 'queued', progress: 0 });
  });
});
