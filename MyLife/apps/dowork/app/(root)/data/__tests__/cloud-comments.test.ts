// DoWork cloud-comments contract tests.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearPendingCommentQueue,
  deleteComment,
  editComment,
  flushPendingComments,
  getPendingCommentQueue,
  listComments,
  postComment,
} from '../cloud-comments';
import { makeSupabase } from './_supabase-mock';

describe('cloud-comments', () => {
  beforeEach(() => clearPendingCommentQueue());
  afterEach(() => clearPendingCommentQueue());

  describe('postComment', () => {
    it('rejects empty bodies without hitting supabase', async () => {
      const supabase = makeSupabase({ responses: {} });
      const result = await postComment(supabase, 'share-1', 'user-1', '   ');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/empty/i);
    });

    it('rejects bodies over 500 characters', async () => {
      const supabase = makeSupabase({ responses: {} });
      const result = await postComment(supabase, 'share-1', 'user-1', 'a'.repeat(501));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/500/);
    });

    it('inserts a comment on happy path', async () => {
      const supabase = makeSupabase({
        responses: {
          'dw_comments:insert': {
            data: {
              id: 'c1',
              share_id: 'share-1',
              user_id: 'user-1',
              body: 'Nice lift!',
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
            },
            error: null,
          },
        },
      });
      const result = await postComment(supabase, 'share-1', 'user-1', 'Nice lift!');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.comment.id).toBe('c1');
        expect(result.comment.body).toBe('Nice lift!');
      }
      expect(getPendingCommentQueue()).toHaveLength(0);
    });

    it('enqueues a pending comment when supabase errors', async () => {
      const supabase = makeSupabase({
        responses: {
          'dw_comments:insert': {
            data: null,
            error: { message: 'offline' },
          },
        },
      });
      const result = await postComment(supabase, 'share-1', 'user-1', 'Queued');
      expect(result.ok).toBe(false);
      expect(getPendingCommentQueue()).toHaveLength(1);
      expect(getPendingCommentQueue()[0]?.body).toBe('Queued');
    });
  });

  describe('listComments', () => {
    it('hydrates raw rows into camelCase', async () => {
      const supabase = makeSupabase({
        responses: {
          'dw_comments:select': {
            data: [
              {
                id: 'c1',
                share_id: 'share-1',
                user_id: 'user-1',
                body: 'Hi',
                created_at: '2026-01-01T00:00:00Z',
                updated_at: '2026-01-01T00:00:00Z',
              },
            ],
            error: null,
          },
        },
      });
      const result = await listComments(supabase, 'share-1', { limit: 10 });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.comments).toHaveLength(1);
        expect(result.comments[0]?.shareId).toBe('share-1');
        expect(result.nextCursor).toBeNull();
      }
    });

    it('returns an error when supabase select errors', async () => {
      const supabase = makeSupabase({
        responses: {
          'dw_comments:select': { data: null, error: { message: 'denied' } },
        },
      });
      const result = await listComments(supabase, 'share-1');
      expect(result.ok).toBe(false);
    });
  });

  describe('editComment', () => {
    it('rejects empty bodies', async () => {
      const supabase = makeSupabase({ responses: {} });
      const result = await editComment(supabase, 'c1', '');
      expect(result.ok).toBe(false);
    });

    it('updates a comment on happy path', async () => {
      const supabase = makeSupabase({
        responses: {
          'dw_comments:update': { data: null, error: null },
        },
      });
      const result = await editComment(supabase, 'c1', 'Edited body');
      expect(result.ok).toBe(true);
    });
  });

  describe('deleteComment', () => {
    it('returns ok on happy path', async () => {
      const supabase = makeSupabase({
        responses: {
          'dw_comments:delete': { data: null, error: null },
        },
      });
      const result = await deleteComment(supabase, 'c1');
      expect(result.ok).toBe(true);
    });

    it('returns the supabase error message', async () => {
      const supabase = makeSupabase({
        responses: {
          'dw_comments:delete': { data: null, error: { message: 'forbidden' } },
        },
      });
      const result = await deleteComment(supabase, 'c1');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe('forbidden');
    });
  });

  describe('flushPendingComments', () => {
    it('replays queued comments against a healthy supabase', async () => {
      const failing = makeSupabase({
        responses: {
          'dw_comments:insert': { data: null, error: { message: 'offline' } },
        },
      });
      await postComment(failing, 'share-1', 'user-1', 'Queued');
      expect(getPendingCommentQueue()).toHaveLength(1);

      const healthy = makeSupabase({
        responses: {
          'dw_comments:insert': {
            data: {
              id: 'c2',
              share_id: 'share-1',
              user_id: 'user-1',
              body: 'Queued',
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
            },
            error: null,
          },
        },
      });
      const result = await flushPendingComments(healthy);
      expect(result).toEqual({ flushed: 1, failed: 0 });
      expect(getPendingCommentQueue()).toHaveLength(0);
    });

    it('does not duplicate an entry when the flush keeps failing', async () => {
      // The old flush called the self-enqueueing postComment, so each failed
      // item landed twice per cycle (self-enqueue + remaining re-push). The
      // error is RLS-shaped (permanent), not offline-shaped, so it counts
      // against the attempts cap (DL-4 distinguishes the two).
      const failing = makeSupabase({
        responses: {
          'dw_comments:insert': { data: null, error: { message: 'new row violates row-level security policy' } },
        },
      });
      await postComment(failing, 'share-1', 'user-1', 'Queued');
      expect(getPendingCommentQueue()).toHaveLength(1);

      await flushPendingComments(failing);
      expect(getPendingCommentQueue()).toHaveLength(1);
      expect(getPendingCommentQueue()[0]?.attempts).toBe(1);

      await flushPendingComments(failing);
      expect(getPendingCommentQueue()).toHaveLength(1);
      expect(getPendingCommentQueue()[0]?.attempts).toBe(2);
    });

    it('does not burn down attempts on a transient/offline failure (DL-4)', async () => {
      const failing = makeSupabase({
        responses: {
          'dw_comments:insert': { data: null, error: { message: 'network request failed' } },
        },
      });
      await postComment(failing, 'share-1', 'user-1', 'Queued');

      for (let i = 0; i < 10; i += 1) {
        await flushPendingComments(failing);
      }
      expect(getPendingCommentQueue()).toHaveLength(1);
      expect(getPendingCommentQueue()[0]?.attempts).toBe(0);
    });
  });
});
