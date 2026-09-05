import { beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  clearAllPendingQueues,
  flushAllPendingQueues,
  getPendingOpsCount,
  hydratePendingQueues,
  persistPendingQueues,
} from '../pending-queues';
import {
  clearPendingShareQueue,
  getPendingShareQueue,
  restorePendingShareQueue,
  setPendingSharesPersistHook,
  uploadWorkoutShare,
  type PendingShareItem,
} from '../cloud-shares';
import {
  clearPendingLikeQueue,
  getPendingLikeQueue,
  likeShare,
  restorePendingLikeQueue,
  setPendingLikesPersistHook,
  type PendingLikeItem,
} from '../cloud-likes';
import {
  clearPendingCommentQueue,
  getPendingCommentQueue,
  postComment,
  restorePendingCommentQueue,
  setPendingCommentsPersistHook,
  type PendingCommentItem,
} from '../cloud-comments';
import {
  clearPendingFeedbackQueue,
  getPendingFeedbackQueue,
  postFormFeedback,
  restorePendingFeedbackQueue,
  setPendingFeedbackPersistHook,
  type PendingFeedbackItem,
} from '../cloud-coaching';
import { makeSupabase } from './_supabase-mock';

// In-memory stand-in for the hub_settings KV table.
function makeKvDb(): DatabaseAdapter {
  const store = new Map<string, string>();
  return {
    query: <T>(sql: string, params: unknown[] = []): T[] => {
      if (sql.includes('FROM hub_settings')) {
        const value = store.get(String(params[0]));
        return (value === undefined ? [] : [{ value }]) as T[];
      }
      return [] as T[];
    },
    execute: (sql: string, params: unknown[] = []) => {
      if (sql.includes('INSERT INTO hub_settings')) {
        store.set(String(params[0]), String(params[1]));
      }
    },
    transaction: (fn: () => void) => {
      fn();
    },
  } as unknown as DatabaseAdapter;
}

const SHARE_ITEM: PendingShareItem = {
  id: 'pending-share-1',
  input: { title: 'Pull day', durationSeconds: 60, totalVolumeKg: 100, exerciseCount: 3, privacy: 'public' },
  userId: 'user-1',
  createdAt: '2026-06-09T00:00:00.000Z',
  attempts: 1,
  lastError: 'offline',
};

const LIKE_ITEM: PendingLikeItem = {
  id: 'pending-like-1',
  shareId: 'share-1',
  userId: 'user-1',
  desiredLiked: true,
  createdAt: '2026-06-09T00:00:00.000Z',
  attempts: 1,
  lastError: 'offline',
};

const COMMENT_ITEM: PendingCommentItem = {
  id: 'pending-comment-1',
  shareId: 'share-1',
  userId: 'user-1',
  body: 'Nice work!',
  createdAt: '2026-06-09T00:00:00.000Z',
  attempts: 1,
  lastError: 'offline',
};

const FEEDBACK_ITEM: PendingFeedbackItem = {
  id: 'pending-feedback-1',
  formCheckId: 'fc-1',
  authorUserId: 'trainer-1',
  body: 'Keep your elbows tucked.',
  videoTimestampSeconds: 12,
  markReviewed: true,
  createdAt: '2026-06-09T00:00:00.000Z',
  attempts: 1,
  lastError: 'offline',
};

function resetQueues(): void {
  clearPendingShareQueue();
  clearPendingLikeQueue();
  clearPendingCommentQueue();
  clearPendingFeedbackQueue();
}

// Clear the module-level persist hooks so a hook registered by a hydrate in one
// test cannot fire (against a disposed db) during a later test's enqueue.
function clearPersistHooks(): void {
  setPendingSharesPersistHook(null);
  setPendingLikesPersistHook(null);
  setPendingCommentsPersistHook(null);
  setPendingFeedbackPersistHook(null);
}

// Reset before every test (not after) so module-level queue arrays and persist
// hooks never leak in from a prior test in this file OR from another test file
// sharing the same module instance in a full-suite run. The mutex test in
// particular asserts kvWrites == 1, which only holds when no persist hook is
// registered; a stale hook left by an enqueue-time test would flip it to 2.
beforeEach(() => {
  resetQueues();
  clearPersistHooks();
});

describe('pending queue persistence', () => {
  it('round-trips queues through the KV table', () => {
    const db = makeKvDb();
    restorePendingShareQueue([SHARE_ITEM]);
    restorePendingLikeQueue([LIKE_ITEM]);
    persistPendingQueues(db);

    resetQueues();
    expect(getPendingOpsCount()).toBe(0);

    hydratePendingQueues(db);
    expect(getPendingOpsCount()).toBe(2);
    expect(getPendingShareQueue()[0]?.id).toBe('pending-share-1');
    expect(getPendingLikeQueue()[0]?.desiredLiked).toBe(true);
  });

  it('round-trips comments and feedback through the KV table (CG-2)', () => {
    const db = makeKvDb();
    restorePendingCommentQueue([COMMENT_ITEM]);
    restorePendingFeedbackQueue([FEEDBACK_ITEM]);
    persistPendingQueues(db);

    resetQueues();
    expect(getPendingOpsCount()).toBe(0);

    hydratePendingQueues(db);
    expect(getPendingOpsCount()).toBe(2);
    expect(getPendingCommentQueue()[0]?.body).toBe('Nice work!');
    expect(getPendingFeedbackQueue()[0]?.formCheckId).toBe('fc-1');
    expect(getPendingFeedbackQueue()[0]?.markReviewed).toBe(true);
  });

  it('round-trips all four queues together (CG-2)', () => {
    const db = makeKvDb();
    restorePendingShareQueue([SHARE_ITEM]);
    restorePendingLikeQueue([LIKE_ITEM]);
    restorePendingCommentQueue([COMMENT_ITEM]);
    restorePendingFeedbackQueue([FEEDBACK_ITEM]);
    persistPendingQueues(db);

    resetQueues();
    expect(getPendingOpsCount()).toBe(0);

    hydratePendingQueues(db);
    expect(getPendingOpsCount()).toBe(4);
  });

  it('ignores missing persisted state', () => {
    const db = makeKvDb();
    hydratePendingQueues(db);
    expect(getPendingOpsCount()).toBe(0);
  });

  it('drops corrupt payloads instead of throwing', () => {
    const db = makeKvDb();
    db.execute(
      `INSERT INTO hub_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      ['dowork.pending_cloud_ops.v1', 'not-json{{{'],
    );
    expect(() => hydratePendingQueues(db)).not.toThrow();
    expect(getPendingOpsCount()).toBe(0);
  });

  it('restore dedupes like flips to the newest desire', () => {
    restorePendingLikeQueue([
      LIKE_ITEM,
      { ...LIKE_ITEM, id: 'pending-like-2', desiredLiked: false },
    ]);
    const queue = getPendingLikeQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0]?.desiredLiked).toBe(false);
  });

  it('clearAllPendingQueues empties memory and the persisted KV', () => {
    const db = makeKvDb();
    restorePendingShareQueue([SHARE_ITEM]);
    restorePendingLikeQueue([LIKE_ITEM]);
    persistPendingQueues(db);
    expect(getPendingOpsCount()).toBe(2);

    clearAllPendingQueues(db);
    expect(getPendingOpsCount()).toBe(0);

    // The KV is wiped too: a fresh hydrate must not resurrect the queued ops
    // (which would otherwise flush under the next identity after sign-out).
    hydratePendingQueues(db);
    expect(getPendingOpsCount()).toBe(0);
  });

  it('two near-concurrent upserts both survive a persist (DL-1)', () => {
    const db = makeKvDb();

    // Two "finishers" each read-modify-write the same KV key. With the
    // transaction wrap, the second call's read must observe the first
    // call's write, so both entries make it into the persisted payload.
    restorePendingShareQueue([SHARE_ITEM]);
    persistPendingQueues(db);

    restorePendingShareQueue([SHARE_ITEM, { ...SHARE_ITEM, id: 'pending-share-2' }]);
    persistPendingQueues(db);

    resetQueues();
    hydratePendingQueues(db);
    expect(getPendingShareQueue()).toHaveLength(2);
    expect(getPendingShareQueue().map((item) => item.id).sort()).toEqual([
      'pending-share-1',
      'pending-share-2',
    ]);
  });

  it('persistPendingQueues writes through db.transaction', () => {
    const db = makeKvDb();
    let transactionCalls = 0;
    const wrapped: DatabaseAdapter = {
      ...db,
      transaction: (fn: () => void) => {
        transactionCalls += 1;
        fn();
      },
    };
    restorePendingShareQueue([SHARE_ITEM]);
    persistPendingQueues(wrapped);
    expect(transactionCalls).toBe(1);
  });

  it('clearAllPendingQueues retries once and succeeds if the second persist works (DL-2)', () => {
    const db = makeKvDb();
    restorePendingShareQueue([SHARE_ITEM]);
    persistPendingQueues(db);

    let writeAttempts = 0;
    const flaky: DatabaseAdapter = {
      ...db,
      execute: (sql: string, params: unknown[] = []) => {
        if (sql.includes('INSERT INTO hub_settings')) {
          writeAttempts += 1;
          if (writeAttempts === 1) throw new Error('disk write failed');
        }
        db.execute(sql, params);
      },
    };

    expect(() => clearAllPendingQueues(flaky)).not.toThrow();
    expect(writeAttempts).toBe(2);
    expect(getPendingOpsCount()).toBe(0);

    // The retried write succeeded, so the stale queue does not rehydrate
    // into the next signed-in identity.
    hydratePendingQueues(db);
    expect(getPendingOpsCount()).toBe(0);
  });

  it('clearAllPendingQueues rethrows if both persist attempts fail (DL-2)', () => {
    const db = makeKvDb();
    const alwaysFails: DatabaseAdapter = {
      ...db,
      execute: () => {
        throw new Error('disk full');
      },
    };
    restorePendingShareQueue([SHARE_ITEM]);
    expect(() => clearAllPendingQueues(alwaysFails)).toThrow('disk full');
    // In-memory queues are still wiped even though the KV write failed.
    expect(getPendingOpsCount()).toBe(0);
  });

  it('drops a malformed persisted item instead of replaying it (DL-3)', () => {
    const db = makeKvDb();
    const corrupt = {
      shares: [
        SHARE_ITEM,
        // Missing input.durationSeconds: must be dropped, not replayed.
        { id: 'pending-share-bad', input: { title: 'Bad', totalVolumeKg: 1, exerciseCount: 1, privacy: 'public' }, createdAt: '2026-06-09T00:00:00.000Z', attempts: 0, lastError: null },
      ],
      likes: [],
      comments: [],
      feedback: [],
    };
    db.execute(
      `INSERT INTO hub_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      ['dowork.pending_cloud_ops.v1', JSON.stringify(corrupt)],
    );
    hydratePendingQueues(db);
    expect(getPendingShareQueue()).toHaveLength(1);
    expect(getPendingShareQueue()[0]?.id).toBe('pending-share-1');
  });
});

describe('flushAllPendingQueues mutex', () => {
  const FLUSHED_SHARE_ROW = {
    id: 's-flushed',
    user_id: 'user-1',
    title: 'Pull day',
    summary: null,
    duration_seconds: 60,
    total_volume_kg: 100,
    exercise_count: 3,
    category: null,
    hero_image_url: null,
    privacy: 'public',
    created_at: '2026-06-09T00:00:00.000Z',
  };

  it('serializes concurrent flushes into a single run', async () => {
    restorePendingShareQueue([SHARE_ITEM]);

    let insertCalls = 0;
    const supabase = makeSupabase(
      {
        responses: {
          'dw_workout_shares:insert': () => {
            insertCalls += 1;
            return { data: FLUSHED_SHARE_ROW, error: null };
          },
        },
      },
      { userId: 'user-1' },
    );

    // Count KV persists. This test never calls hydratePendingQueues, so no
    // per-queue persist hook is registered and the per-flush firePersistHook is
    // a no-op; only flushAllPendingQueues' own final persist writes == 1. A
    // second, un-serialized run would persist again. Serialization is asserted
    // primarily through insertCalls == 1.
    let kvWrites = 0;
    const store = new Map<string, string>();
    const db = {
      query: <T>(sql: string, params: unknown[] = []): T[] => {
        if (sql.includes('FROM hub_settings')) {
          const value = store.get(String(params[0]));
          return (value === undefined ? [] : [{ value }]) as T[];
        }
        return [] as T[];
      },
      execute: (sql: string, params: unknown[] = []) => {
        if (sql.includes('INSERT INTO hub_settings')) {
          kvWrites += 1;
          store.set(String(params[0]), String(params[1]));
        }
      },
      transaction: (fn: () => void) => {
        fn();
      },
    } as unknown as DatabaseAdapter;

    const [a, b] = await Promise.all([
      flushAllPendingQueues(supabase, db),
      flushAllPendingQueues(supabase, db),
    ]);

    expect(insertCalls).toBe(1);
    expect(kvWrites).toBe(1);
    expect(a).toEqual(b);
    expect(a.flushed).toBe(1);
    expect(getPendingOpsCount()).toBe(0);
  });
});

// The CG-2 / IMP-8 gap: before enqueue-time persistence, a like/comment/share/
// feedback composed offline only reached the KV on the next flush or AppState
// background. A force-quit (which does not reliably route through the background
// handler) between the enqueue and either of those events silently lost the op.
// hydratePendingQueues now registers a persist hook that each cloud helper fires
// on enqueue, so the op is on disk the moment it is queued.
describe('enqueue-time persistence survives a cold restart (CG-2 / IMP-8)', () => {
  // A cloud client whose insert/rpc always fails, forcing the public wrapper to
  // enqueue. No flush and no AppState background is invoked in these tests.
  function makeOfflineSupabase(): SupabaseClient {
    return makeSupabase(
      {
        responses: {
          'dw_workout_shares:insert': () => ({ data: null, error: { message: 'offline' } }),
          'dw_likes:insert': () => ({ data: null, error: { message: 'offline' } }),
          'dw_comments:insert': () => ({ data: null, error: { message: 'offline' } }),
          'dw_form_feedback:insert': () => ({ data: null, error: { message: 'offline' } }),
        },
      },
      { userId: 'user-1' },
    );
  }

  // Simulate a cold restart: throw away the in-memory queues (fresh process)
  // and re-hydrate from the same db. Anything persisted at enqueue time comes
  // back; anything not persisted is lost.
  function coldRestart(db: DatabaseAdapter): void {
    resetQueues();
    clearPersistHooks();
    hydratePendingQueues(db);
  }

  it('a like enqueued offline is persisted immediately and rehydrates after a cold restart', async () => {
    const db = makeKvDb();
    hydratePendingQueues(db);
    const supabase = makeOfflineSupabase();

    const result = await likeShare(supabase, 'share-1', 'user-1');
    expect(result.ok).toBe(false);
    // Persisted at enqueue time, before any flush or AppState background.
    expect(getPendingLikeQueue()).toHaveLength(1);

    coldRestart(db);
    expect(getPendingLikeQueue()).toHaveLength(1);
    expect(getPendingLikeQueue()[0]?.shareId).toBe('share-1');
  });

  it('a comment enqueued offline rehydrates after a cold restart', async () => {
    const db = makeKvDb();
    hydratePendingQueues(db);
    const supabase = makeOfflineSupabase();

    await postComment(supabase, 'share-1', 'user-1', 'Great set');
    expect(getPendingCommentQueue()).toHaveLength(1);

    coldRestart(db);
    expect(getPendingCommentQueue()).toHaveLength(1);
    expect(getPendingCommentQueue()[0]?.body).toBe('Great set');
  });

  it('a share enqueued offline rehydrates after a cold restart', async () => {
    const db = makeKvDb();
    hydratePendingQueues(db);
    const supabase = makeOfflineSupabase();

    const result = await uploadWorkoutShare(supabase, {
      title: 'Leg day',
      durationSeconds: 60,
      totalVolumeKg: 200,
      exerciseCount: 4,
      privacy: 'public',
    });
    expect(result.queued).toBe(true);
    expect(getPendingShareQueue()).toHaveLength(1);

    coldRestart(db);
    expect(getPendingShareQueue()).toHaveLength(1);
    expect(getPendingShareQueue()[0]?.input.title).toBe('Leg day');
  });

  it('text feedback enqueued offline rehydrates after a cold restart (audit: feedback did NOT persist at enqueue either)', async () => {
    const db = makeKvDb();
    hydratePendingQueues(db);
    const supabase = makeOfflineSupabase();

    await postFormFeedback(supabase, {
      formCheckId: 'fc-1',
      authorUserId: 'trainer-1',
      body: 'Tuck your elbows',
      videoTimestampSeconds: 8,
      markReviewed: true,
    });
    expect(getPendingFeedbackQueue()).toHaveLength(1);

    coldRestart(db);
    expect(getPendingFeedbackQueue()).toHaveLength(1);
    expect(getPendingFeedbackQueue()[0]?.body).toBe('Tuck your elbows');
    expect(getPendingFeedbackQueue()[0]?.markReviewed).toBe(true);
  });

  it('all four queues enqueued offline rehydrate together after a cold restart', async () => {
    const db = makeKvDb();
    hydratePendingQueues(db);
    const supabase = makeOfflineSupabase();

    await likeShare(supabase, 'share-1', 'user-1');
    await postComment(supabase, 'share-1', 'user-1', 'Nice');
    await uploadWorkoutShare(supabase, {
      title: 'Push day',
      durationSeconds: 60,
      totalVolumeKg: 100,
      exerciseCount: 3,
      privacy: 'public',
    });
    await postFormFeedback(supabase, {
      formCheckId: 'fc-1',
      authorUserId: 'trainer-1',
      body: 'Depth looks good',
    });
    expect(getPendingOpsCount()).toBe(4);

    coldRestart(db);
    expect(getPendingOpsCount()).toBe(4);
  });

  it('a hook exception during enqueue does not propagate to the user-facing op', async () => {
    // A db whose write throws: the best-effort persist must swallow it so the
    // like still lands in memory and the caller gets its normal result.
    const throwingDb = {
      query: () => [],
      execute: () => {
        throw new Error('disk full');
      },
      transaction: (fn: () => void) => fn(),
    } as unknown as DatabaseAdapter;

    hydratePendingQueues(throwingDb);
    const supabase = makeOfflineSupabase();

    const result = await likeShare(supabase, 'share-1', 'user-1');
    // The op itself reports the transport failure, not a persist failure.
    expect(result.ok).toBe(false);
    // The in-memory enqueue still happened despite the persist throwing.
    expect(getPendingLikeQueue()).toHaveLength(1);
  });

  it('a flush retention update persists the shrunken queue (CG-2)', async () => {
    // One item flushes successfully, one keeps failing with a permanent error;
    // after the flush the surviving failure must be what is on disk, so a
    // force-quit before flushAllPendingQueues' final persist cannot resurrect
    // the succeeded item.
    const db = makeKvDb();
    hydratePendingQueues(db);

    restorePendingLikeQueue([
      { ...LIKE_ITEM, id: 'like-ok', shareId: 'ok', attempts: 0 },
      { ...LIKE_ITEM, id: 'like-bad', shareId: 'bad', attempts: 4 },
    ]);

    let call = 0;
    const supabase = makeSupabase(
      {
        responses: {
          // First insert (ok) succeeds, second (bad) fails permanently, tipping
          // the attempts-4 item over the poison cap so it is dropped.
          'dw_likes:insert': () => {
            call += 1;
            return call === 1
              ? { data: { id: 'l1' }, error: null }
              : { data: null, error: { message: 'permission denied', code: '42501' } };
          },
        },
      },
      { userId: 'user-1' },
    );

    const res = await flushAllPendingQueues(supabase, db);
    expect(res.flushed).toBe(1);

    // After the flush the queue is empty (both items resolved); a cold restart
    // must not bring either back.
    resetQueues();
    clearPersistHooks();
    hydratePendingQueues(db);
    expect(getPendingLikeQueue()).toHaveLength(0);
  });
});
