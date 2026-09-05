// DoWork cloud-likes contract tests.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearPendingLikeQueue,
  flushPendingLikes,
  getLikeCounts,
  getMyLikedShareIds,
  getPendingLikeQueue,
  likeShare,
  unlikeShare,
} from '../cloud-likes';
import { makeSupabase } from './_supabase-mock';

describe('cloud-likes', () => {
  beforeEach(() => clearPendingLikeQueue());
  afterEach(() => clearPendingLikeQueue());

  describe('likeShare', () => {
    it('inserts a like row on happy path', async () => {
      const supabase = makeSupabase({
        responses: {
          'dw_likes:insert': { data: { id: 'l1' }, error: null },
        },
      });
      const result = await likeShare(supabase, 'share-1', 'user-1');
      expect(result.ok).toBe(true);
      expect(getPendingLikeQueue()).toHaveLength(0);
    });

    it('treats unique violation (23505) as success (already liked)', async () => {
      const supabase = makeSupabase({
        responses: {
          'dw_likes:insert': {
            data: null,
            error: { message: 'duplicate', code: '23505' },
          },
        },
      });
      const result = await likeShare(supabase, 'share-1', 'user-1');
      expect(result.ok).toBe(true);
      expect(getPendingLikeQueue()).toHaveLength(0);
    });

    it('enqueues a pending like when supabase errors', async () => {
      const supabase = makeSupabase({
        responses: {
          'dw_likes:insert': {
            data: null,
            error: { message: 'offline' },
          },
        },
      });
      const result = await likeShare(supabase, 'share-1', 'user-1');
      expect(result.ok).toBe(false);
      const queue = getPendingLikeQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0]?.desiredLiked).toBe(true);
    });

    it('deduplicates queued items per (shareId, userId)', async () => {
      const supabase = makeSupabase({
        responses: {
          'dw_likes:insert': { data: null, error: { message: 'offline' } },
          'dw_likes:delete': { data: null, error: { message: 'offline' } },
        },
      });
      await likeShare(supabase, 'share-1', 'user-1');
      await unlikeShare(supabase, 'share-1', 'user-1');
      const queue = getPendingLikeQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0]?.desiredLiked).toBe(false);
    });
  });

  describe('getLikeCounts', () => {
    it('returns short-circuit empty result for empty input', async () => {
      const supabase = makeSupabase({ responses: {} });
      const result = await getLikeCounts(supabase, []);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.counts).toEqual({});
    });

    it('counts likes per share id, filling zeros for missing', async () => {
      const supabase = makeSupabase({
        responses: {
          'dw_likes:select': {
            data: [{ share_id: 's1' }, { share_id: 's1' }, { share_id: 's2' }],
            error: null,
          },
        },
      });
      const result = await getLikeCounts(supabase, ['s1', 's2', 's3']);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.counts).toEqual({ s1: 2, s2: 1, s3: 0 });
      }
    });
  });

  describe('getMyLikedShareIds', () => {
    it('returns the set of shares the viewer has liked', async () => {
      const supabase = makeSupabase({
        responses: {
          'dw_likes:select': {
            data: [{ share_id: 's1' }, { share_id: 's3' }],
            error: null,
          },
        },
      });
      const result = await getMyLikedShareIds(supabase, 'viewer', ['s1', 's2', 's3']);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.ids.has('s1')).toBe(true);
        expect(result.ids.has('s2')).toBe(false);
        expect(result.ids.has('s3')).toBe(true);
      }
    });
  });

  describe('flushPendingLikes', () => {
    it('drains the queue against a healthy supabase', async () => {
      const failing = makeSupabase({
        responses: {
          'dw_likes:insert': { data: null, error: { message: 'offline' } },
        },
      });
      await likeShare(failing, 's1', 'u1');
      expect(getPendingLikeQueue()).toHaveLength(1);

      const healthy = makeSupabase({
        responses: {
          'dw_likes:insert': { data: { id: 'l1' }, error: null },
        },
      });
      const result = await flushPendingLikes(healthy);
      expect(result).toEqual({ flushed: 1, failed: 0 });
    });
  });
});
