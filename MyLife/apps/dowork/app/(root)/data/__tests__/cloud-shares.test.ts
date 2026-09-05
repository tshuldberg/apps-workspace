// DoWork cloud-shares contract tests.
//
// Mocks the Supabase PostgREST builder to verify happy-path inserts,
// listing, error handling, and the pending-share offline queue.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearPendingShareQueue,
  flushPendingShares,
  getPendingShareQueue,
  listPublicShares,
  restorePendingShareQueue,
  uploadWorkoutShare,
} from '../cloud-shares';
import { makeSupabase } from './_supabase-mock';

describe('cloud-shares', () => {
  beforeEach(() => clearPendingShareQueue());
  afterEach(() => clearPendingShareQueue());

  describe('uploadWorkoutShare', () => {
    it('inserts a share and returns the hydrated row on happy path', async () => {
      const supabase = makeSupabase(
        {
          responses: {
            'dw_workout_shares:insert': {
              data: {
                id: 's1',
                user_id: 'u1',
                title: 'Leg day',
                summary: null,
                duration_seconds: 1800,
                total_volume_kg: 5400,
                exercise_count: 5,
                category: 'strength',
                hero_image_url: null,
                privacy: 'public',
                created_at: '2026-01-01T00:00:00Z',
              },
              error: null,
            },
          },
        },
        { userId: 'u1' },
      );

      const result = await uploadWorkoutShare(supabase, {
        title: 'Leg day',
        durationSeconds: 1800,
        totalVolumeKg: 5400,
        exerciseCount: 5,
        privacy: 'public',
        category: 'strength',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.share.id).toBe('s1');
        expect(result.share.totalVolumeKg).toBe(5400);
        expect(result.share.likeCount).toBe(0);
        expect(result.queued).toBe(false);
      }
      expect(getPendingShareQueue()).toHaveLength(0);
    });

    it('reports queued=true when a network-style failure parks the share', async () => {
      const supabase = makeSupabase(
        {
          responses: {
            'dw_workout_shares:insert': {
              data: null,
              error: { message: 'network request failed' },
            },
          },
        },
        { userId: 'u1' },
      );
      const result = await uploadWorkoutShare(supabase, {
        title: 'Offline share',
        durationSeconds: 60,
        totalVolumeKg: 10,
        exerciseCount: 1,
        privacy: 'public',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.queued).toBe(true);
      expect(getPendingShareQueue()).toHaveLength(1);
    });

    it('enqueues to the pending queue when not signed in', async () => {
      const supabase = makeSupabase({ responses: {} }, { userId: null });
      const result = await uploadWorkoutShare(supabase, {
        title: 'Anonymous attempt',
        durationSeconds: 60,
        totalVolumeKg: 10,
        exerciseCount: 1,
        privacy: 'public',
      });

      expect(result.ok).toBe(false);
      expect(getPendingShareQueue()).toHaveLength(1);
      expect(getPendingShareQueue()[0]?.lastError).toBe('no_session');
    });

    it('enqueues to the pending queue when supabase insert has a transient error', async () => {
      const supabase = makeSupabase(
        {
          responses: {
            'dw_workout_shares:insert': {
              data: null,
              error: { message: 'network down' },
            },
          },
        },
        { userId: 'u1' },
      );
      const result = await uploadWorkoutShare(supabase, {
        title: 'Failed share',
        durationSeconds: 60,
        totalVolumeKg: 10,
        exerciseCount: 1,
        privacy: 'public',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe('network down');
      expect(getPendingShareQueue()).toHaveLength(1);
    });

    it('does not enqueue permanent insert rejections', async () => {
      const supabase = makeSupabase(
        {
          responses: {
            'dw_workout_shares:insert': {
              data: null,
              error: { message: 'new row violates row-level security policy', status: 403 },
            },
          },
        },
        { userId: 'u1' },
      );
      const result = await uploadWorkoutShare(supabase, {
        title: 'Rejected share',
        durationSeconds: 60,
        totalVolumeKg: 10,
        exerciseCount: 1,
        privacy: 'public',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.queued).toBe(false);
      expect(getPendingShareQueue()).toHaveLength(0);
    });
  });

  describe('listPublicShares', () => {
    it('returns hydrated rows with like + comment counts', async () => {
      const supabase = makeSupabase(
        {
          responses: {
            'dw_workout_shares:select': {
              data: [
                {
                  id: 's1',
                  user_id: 'u1',
                  title: 'Leg day',
                  summary: null,
                  duration_seconds: 1800,
                  total_volume_kg: 5400,
                  exercise_count: 5,
                  category: 'strength',
                  hero_image_url: null,
                  privacy: 'public',
                  created_at: '2026-01-01T00:00:00Z',
                },
              ],
              error: null,
            },
            'dw_likes:select': { data: [{ share_id: 's1', user_id: 'viewer' }], error: null },
            'dw_comments:select': { data: [{ share_id: 's1' }, { share_id: 's1' }], error: null },
          },
        },
        { userId: 'viewer' },
      );

      const result = await listPublicShares(supabase, { limit: 10 });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.shares).toHaveLength(1);
        expect(result.shares[0]?.likeCount).toBe(1);
        expect(result.shares[0]?.myLikedFlag).toBe(true);
        expect(result.nextCursor).toBeNull();
      }
    });
  });

  describe('flushPendingShares', () => {
    it('replays queued items against supabase', async () => {
      const failing = makeSupabase(
        {
          responses: {
            'dw_workout_shares:insert': { data: null, error: { message: 'offline' } },
          },
        },
        { userId: 'u1' },
      );
      await uploadWorkoutShare(failing, {
        title: 'Queued',
        durationSeconds: 100,
        totalVolumeKg: 50,
        exerciseCount: 1,
        privacy: 'public',
      });
      expect(getPendingShareQueue()).toHaveLength(1);

      const healthy = makeSupabase(
        {
          responses: {
            'dw_workout_shares:insert': {
              data: {
                id: 's2',
                user_id: 'u1',
                title: 'Queued',
                summary: null,
                duration_seconds: 100,
                total_volume_kg: 50,
                exercise_count: 1,
                category: null,
                hero_image_url: null,
                privacy: 'public',
                created_at: '2026-01-01T00:00:00Z',
              },
              error: null,
            },
          },
        },
        { userId: 'u1' },
      );
      const flushed = await flushPendingShares(healthy);
      expect(flushed).toEqual({ flushed: 1, failed: 0, dropped: 0 });
      expect(getPendingShareQueue()).toHaveLength(0);
    });

    it('terminates against a permanently failing writer and increments attempts', async () => {
      // Guard: if the flush ever iterated the live queue (the old infinite loop),
      // a self-enqueued item would drive insert calls unbounded and throw here.
      // The error is RLS-shaped (permanent), not offline-shaped, so it counts
      // against the attempts cap (DL-4 distinguishes the two).
      let insertCalls = 0;
      const failing = makeSupabase(
        {
          responses: {
            'dw_workout_shares:insert': () => {
              insertCalls += 1;
              if (insertCalls > 50) throw new Error('flush looped over a self-enqueued item');
              return { data: null, error: { message: 'new row violates row-level security policy' } };
            },
          },
        },
        { userId: 'u1' },
      );

      // Seed via restore: compose-time refuses to enqueue a permanent
      // rejection, so this models an item that turned poison after enqueueing.
      restorePendingShareQueue([
        {
          id: 'pending-rls',
          input: {
            title: 'Queued',
            durationSeconds: 60,
            totalVolumeKg: 10,
            exerciseCount: 1,
            privacy: 'public',
          },
          userId: 'u1',
          createdAt: new Date().toISOString(),
          attempts: 0,
          lastError: 'offline',
        },
      ]);
      expect(getPendingShareQueue()).toHaveLength(1);
      expect(getPendingShareQueue()[0]?.attempts).toBe(0);

      const first = await flushPendingShares(failing);
      expect(first).toEqual({ flushed: 0, failed: 1, dropped: 0 });
      expect(getPendingShareQueue()).toHaveLength(1);
      expect(getPendingShareQueue()[0]?.attempts).toBe(1);

      await flushPendingShares(failing);
      expect(getPendingShareQueue()[0]?.attempts).toBe(2);
      expect(insertCalls).toBeLessThan(50);
    });

    it('does not burn down attempts on a transient/offline failure (DL-4)', async () => {
      const failing = makeSupabase(
        {
          responses: {
            'dw_workout_shares:insert': () => ({ data: null, error: { message: 'network request failed' } }),
          },
        },
        { userId: 'u1' },
      );

      await uploadWorkoutShare(failing, {
        title: 'Queued',
        durationSeconds: 60,
        totalVolumeKg: 10,
        exerciseCount: 1,
        privacy: 'public',
      });

      // Flush repeatedly, well past MAX_QUEUE_ATTEMPTS: a purely transient
      // failure must never age the item out via the attempts cap.
      for (let i = 0; i < 10; i += 1) {
        await flushPendingShares(failing);
      }
      expect(getPendingShareQueue()).toHaveLength(1);
      expect(getPendingShareQueue()[0]?.attempts).toBe(0);
    });

    it('drops queued shares composed under a different auth uid (identity guard)', async () => {
      // Queue while signed in as the anonymous user...
      const anon = makeSupabase(
        {
          responses: {
            'dw_workout_shares:insert': { data: null, error: { message: 'offline' } },
          },
        },
        { userId: 'anon-1' },
      );
      await uploadWorkoutShare(anon, {
        title: 'Composed anonymously',
        durationSeconds: 60,
        totalVolumeKg: 10,
        exerciseCount: 1,
        privacy: 'public',
      });
      expect(getPendingShareQueue()).toHaveLength(1);
      expect(getPendingShareQueue()[0]?.userId).toBe('anon-1');

      // ...then flush after signing into an email account without sign-out.
      let insertCalls = 0;
      const emailAccount = makeSupabase(
        {
          responses: {
            'dw_workout_shares:insert': () => {
              insertCalls += 1;
              return { data: null, error: { message: 'should never be called' } };
            },
          },
        },
        { userId: 'email-user-9' },
      );
      const result = await flushPendingShares(emailAccount);
      expect(result).toEqual({ flushed: 0, failed: 0, dropped: 1 });
      expect(insertCalls).toBe(0);
      expect(getPendingShareQueue()).toHaveLength(0);
    });

    it('drops legacy queued shares with no recorded enqueuer instead of guessing', async () => {
      const { restorePendingShareQueue } = await import('../cloud-shares');
      restorePendingShareQueue([
        {
          id: 'pending-legacy',
          input: {
            title: 'Legacy item',
            durationSeconds: 60,
            totalVolumeKg: 10,
            exerciseCount: 1,
            privacy: 'public',
          },
          userId: null,
          createdAt: '2026-06-01T00:00:00.000Z',
          attempts: 0,
          lastError: 'offline',
        },
      ]);
      const supabase = makeSupabase({ responses: {} }, { userId: 'u1' });
      const result = await flushPendingShares(supabase);
      expect(result).toEqual({ flushed: 0, failed: 0, dropped: 1 });
      expect(getPendingShareQueue()).toHaveLength(0);
    });

    it('drops a poison entry once it hits the attempts cap', async () => {
      const failing = makeSupabase(
        {
          responses: {
            'dw_workout_shares:insert': {
              data: null,
              error: { message: 'new row violates row-level security policy' },
            },
          },
        },
        { userId: 'u1' },
      );
      // Seed via restore: compose-time refuses to enqueue a permanent
      // rejection, so this models an item that turned poison after enqueueing.
      restorePendingShareQueue([
        {
          id: 'pending-poison',
          input: {
            title: 'Poison',
            durationSeconds: 60,
            totalVolumeKg: 10,
            exerciseCount: 1,
            privacy: 'public',
          },
          userId: 'u1',
          createdAt: new Date().toISOString(),
          attempts: 0,
          lastError: 'offline',
        },
      ]);
      expect(getPendingShareQueue()).toHaveLength(1);

      // attempts climbs 1..4 (kept) then reaches the cap of 5 and is dropped.
      for (let i = 0; i < 5; i += 1) {
        await flushPendingShares(failing);
      }
      expect(getPendingShareQueue()).toHaveLength(0);
    });
  });
});
