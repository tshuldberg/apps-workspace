import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { RECIPES_MODULE } from '@mylife/bestchef';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  drainPendingSubmissionLikes,
  getCachedSubmissionLikeState,
  getSubmissionLikeViewerId,
  setSubmissionLikeDesired,
  syncSubmissionLikeState,
} from '../feed-likes';

function mockSupabase(rows: unknown[]) {
  const rpc = vi.fn(async () => ({
    data: rows.shift() ?? null,
    error: null,
  }));
  return { rpc } as unknown as SupabaseClient & { rpc: typeof rpc };
}

function deferredSupabase() {
  const pending: Array<(value: { data: unknown; error: null }) => void> = [];
  const rpc = vi.fn(() => new Promise<{ data: unknown; error: null }>((resolve) => {
    pending.push(resolve);
  }));
  return {
    supabase: { rpc } as unknown as SupabaseClient & { rpc: typeof rpc },
    rpc,
    resolveNext(data: unknown) {
      const resolve = pending.shift();
      if (!resolve) throw new Error('No pending RPC call.');
      resolve({ data, error: null });
    },
  };
}

describe('BestChef feed likes', () => {
  let db: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('recipes', RECIPES_MODULE.migrations!);
    db = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  it('returns fallback cloud count until the viewer has local state', () => {
    const viewerId = getSubmissionLikeViewerId(db, null);

    expect(getCachedSubmissionLikeState(db, {
      localTargetId: 's1',
      viewerId,
      fallbackCount: 847,
    })).toMatchObject({
      targetId: 's1',
      liked: false,
      likeCount: 847,
      pending: false,
    });
  });

  it('persists offline optimistic likes and keeps one queued desired state', async () => {
    const viewerId = 'profile-1';
    const liked = await setSubmissionLikeDesired(db, {
      localTargetId: 's1',
      viewerId,
      fallbackCount: 847,
    }, true);
    const unliked = await setSubmissionLikeDesired(db, {
      localTargetId: 's1',
      viewerId,
      fallbackCount: 847,
    }, false);

    expect(liked).toMatchObject({ liked: true, likeCount: 848, pending: true });
    expect(unliked).toMatchObject({ liked: false, likeCount: 847, pending: true });
    expect(db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM rc_bestchef_submission_like_queue`,
    )[0]?.count).toBe(1);
  });

  it('uses cloud truth after an online toggle succeeds', async () => {
    const supabase = mockSupabase([{
      submission_id: 'cloud-s1',
      like_count: 900,
      liked: true,
      error_code: null,
    }]);

    const state = await setSubmissionLikeDesired(db, {
      localTargetId: 's1',
      viewerId: 'profile-1',
      fallbackCount: 847,
      cloudSubmissionId: 'cloud-s1',
    }, true, { supabase });

    expect(state).toMatchObject({ liked: true, likeCount: 900, pending: false });
    expect(db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM rc_bestchef_submission_like_queue`,
    )[0]?.count).toBe(0);
  });

  it('keeps the newest desired state when cloud responses arrive out of order', async () => {
    const deferred = deferredSupabase();
    const target = {
      localTargetId: 's1',
      viewerId: 'profile-1',
      fallbackCount: 847,
      cloudSubmissionId: 'cloud-s1',
    };

    const first = setSubmissionLikeDesired(db, target, true, { supabase: deferred.supabase });
    const second = setSubmissionLikeDesired(db, target, false, { supabase: deferred.supabase });

    expect(deferred.rpc).toHaveBeenCalledTimes(2);
    expect(getCachedSubmissionLikeState(db, target)).toMatchObject({
      liked: false,
      likeCount: 847,
      pending: true,
    });

    deferred.resolveNext({
      submission_id: 'cloud-s1',
      like_count: 900,
      liked: true,
      error_code: null,
    });
    await expect(first).resolves.toMatchObject({
      liked: false,
      likeCount: 847,
      pending: true,
    });
    expect(db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM rc_bestchef_submission_like_queue`,
    )[0]?.count).toBe(1);

    deferred.resolveNext({
      submission_id: 'cloud-s1',
      like_count: 899,
      liked: false,
      error_code: null,
    });
    await expect(second).resolves.toMatchObject({
      liked: false,
      likeCount: 899,
      pending: false,
    });
    expect(db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM rc_bestchef_submission_like_queue`,
    )[0]?.count).toBe(0);
  });

  it('drains pending likes once a cloud submission id is available', async () => {
    await setSubmissionLikeDesired(db, {
      localTargetId: 's1',
      viewerId: 'profile-1',
      fallbackCount: 847,
      cloudSubmissionId: 'cloud-s1',
    }, true);
    const supabase = mockSupabase([{
      submission_id: 'cloud-s1',
      like_count: 901,
      liked: true,
      error_code: null,
    }]);

    const drained = await drainPendingSubmissionLikes(db, {
      supabase,
      viewerId: 'profile-1',
      targetId: 's1',
    });

    expect(drained).toHaveLength(1);
    expect(getCachedSubmissionLikeState(db, {
      localTargetId: 's1',
      viewerId: 'profile-1',
      fallbackCount: 847,
    })).toMatchObject({ liked: true, likeCount: 901, pending: false });
  });

  it('refreshes cached state from cloud when no local queue remains', async () => {
    const supabase = mockSupabase([{
      submission_id: 'cloud-s1',
      like_count: 902,
      liked: false,
      error_code: null,
    }]);

    const state = await syncSubmissionLikeState(db, {
      localTargetId: 's1',
      viewerId: 'profile-1',
      fallbackCount: 847,
      cloudSubmissionId: 'cloud-s1',
    }, { supabase });

    expect(state).toMatchObject({ liked: false, likeCount: 902, pending: false });
  });
});
