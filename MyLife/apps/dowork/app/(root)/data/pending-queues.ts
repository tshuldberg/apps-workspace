// Pending cloud-op queue persistence.
//
// The cloud helpers (shares / likes / comments) queue failed writes in
// memory. This module makes those queues survive an app restart by
// serializing them into the hub_settings KV table in dowork.db, and gives
// the cloud provider one entry point to flush everything on foreground or
// reconnect. Without this, a queued post silently died with the process.

import { z } from 'zod';
import type { DatabaseAdapter } from '@mylife/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  clearPendingShareQueue,
  flushPendingShares,
  getPendingShareQueue,
  restorePendingShareQueue,
  setPendingSharesPersistHook,
  type PendingShareItem,
} from './cloud-shares';
import {
  clearPendingLikeQueue,
  flushPendingLikes,
  getPendingLikeQueue,
  restorePendingLikeQueue,
  setPendingLikesPersistHook,
  type PendingLikeItem,
} from './cloud-likes';
import {
  clearPendingCommentQueue,
  flushPendingComments,
  getPendingCommentQueue,
  restorePendingCommentQueue,
  setPendingCommentsPersistHook,
  type PendingCommentItem,
} from './cloud-comments';
import {
  clearPendingFeedbackQueue,
  flushPendingFeedback,
  getPendingFeedbackQueue,
  restorePendingFeedbackQueue,
  setPendingFeedbackPersistHook,
  type PendingFeedbackItem,
} from './cloud-coaching';

const QUEUE_KEY = 'dowork.pending_cloud_ops.v1';

interface PersistedQueues {
  shares: PendingShareItem[];
  likes: PendingLikeItem[];
  comments: PendingCommentItem[];
  feedback: PendingFeedbackItem[];
}

function readKey(db: DatabaseAdapter): string | null {
  const rows = db.query<{ value: string }>(
    'SELECT value FROM hub_settings WHERE key = ? LIMIT 1',
    [QUEUE_KEY],
  );
  return rows[0]?.value ?? null;
}

function writeKey(db: DatabaseAdapter, value: string): void {
  db.execute(
    `INSERT INTO hub_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [QUEUE_KEY, value],
  );
}

// ── per-item validation (DL-3) ──────────────────────────────────────────────
//
// A persisted queue item that has lost a required field (e.g. a share missing
// input.durationSeconds after a schema change) must be dropped, not replayed
// against the cloud helper's core insert, where a missing field would either
// throw or silently write bad data. Each schema mirrors its PendingXItem type;
// unknown/extra fields are ignored, missing required fields fail validation.

const pendingBaseSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string(),
  attempts: z.number(),
  lastError: z.string().nullable(),
});

const cloudShareInputSchema = z.object({
  title: z.string(),
  summary: z.string().optional(),
  durationSeconds: z.number(),
  totalVolumeKg: z.number(),
  exerciseCount: z.number(),
  category: z.string().optional(),
  heroImageUrl: z.string().optional(),
  privacy: z.enum(['public', 'followers', 'private']),
});

const pendingShareItemSchema = pendingBaseSchema.extend({
  input: cloudShareInputSchema,
  // Identity guard: the auth uid the share was composed under. Legacy persisted
  // payloads predate the field; hydration backfills null (see hydratePendingQueues)
  // and unowned items are dropped at flush rather than replayed under whoever is
  // signed in now.
  userId: z.string().min(1).nullable(),
});

const pendingLikeItemSchema = pendingBaseSchema.extend({
  shareId: z.string().min(1),
  userId: z.string().min(1),
  desiredLiked: z.boolean(),
});

const pendingCommentItemSchema = pendingBaseSchema.extend({
  shareId: z.string().min(1),
  userId: z.string().min(1),
  body: z.string(),
});

const pendingFeedbackItemSchema = pendingBaseSchema.extend({
  formCheckId: z.string().min(1),
  authorUserId: z.string().min(1),
  body: z.string(),
  videoTimestampSeconds: z.number().nullable(),
  markReviewed: z.boolean(),
});

// Keeps only the items that parse; malformed entries are dropped silently
// rather than throwing away the whole queue or replaying a corrupt shape.
function validItems<T>(value: unknown, schema: z.ZodType<T>): T[] {
  if (!Array.isArray(value)) return [];
  const out: T[] = [];
  for (const item of value) {
    const result = schema.safeParse(item);
    if (result.success) out.push(result.data);
  }
  return out;
}

// Register each cloud helper's persist hook so an enqueue (or a flush retention
// update) writes the full snapshot to the KV immediately, not only on AppState
// background. This closes CG-2 / IMP-8: a like/comment/share/feedback composed
// offline and then force-quit (which does not reliably route through the
// background handler) is now on disk the moment it is queued. Every hook
// persists all four queues via persistPendingQueues; a single-queue mutation
// still writes a consistent full payload. Idempotent: safe to call on every
// hydrate.
function registerPersistHooks(db: DatabaseAdapter): void {
  const persist = () => persistPendingQueues(db);
  setPendingSharesPersistHook(persist);
  setPendingLikesPersistHook(persist);
  setPendingCommentsPersistHook(persist);
  setPendingFeedbackPersistHook(persist);
}

// Load persisted queues into the in-memory cloud helpers. Call once at
// app start, before anything can enqueue. Corrupt payloads are dropped;
// individually malformed items within an otherwise valid payload are
// dropped without discarding the rest of the queue. Registers the enqueue-time
// persist hooks last so a restore during hydration does not fire a redundant
// persist of what we just read back.
export function hydratePendingQueues(db: DatabaseAdapter): void {
  const raw = readKey(db);
  try {
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedQueues>;
      // Legacy share payloads predate the identity guard; backfill userId: null
      // so they parse and are then dropped at flush as unowned, not guessed.
      const shares = Array.isArray(parsed.shares)
        ? parsed.shares.map((item) =>
            item && typeof item === 'object' && !('userId' in item)
              ? { ...(item as Record<string, unknown>), userId: null }
              : item,
          )
        : parsed.shares;
      restorePendingShareQueue(validItems(shares, pendingShareItemSchema));
      restorePendingLikeQueue(validItems(parsed.likes, pendingLikeItemSchema));
      restorePendingCommentQueue(validItems(parsed.comments, pendingCommentItemSchema));
      restorePendingFeedbackQueue(validItems(parsed.feedback, pendingFeedbackItemSchema));
    }
  } catch {
    writeKey(db, JSON.stringify({ shares: [], likes: [], comments: [], feedback: [] }));
  }
  registerPersistHooks(db);
}

// Wrapped in a transaction so two near-concurrent persists (e.g. a flush and a
// foreground-resume enqueue) cannot read-modify-write over each other's KV
// write and lose an entry.
export function persistPendingQueues(db: DatabaseAdapter): void {
  const payload: PersistedQueues = {
    shares: [...getPendingShareQueue()],
    likes: [...getPendingLikeQueue()],
    comments: [...getPendingCommentQueue()],
    feedback: [...getPendingFeedbackQueue()],
  };
  db.transaction(() => {
    writeKey(db, JSON.stringify(payload));
  });
}

export function getPendingOpsCount(): number {
  return (
    getPendingShareQueue().length +
    getPendingLikeQueue().length +
    getPendingCommentQueue().length +
    getPendingFeedbackQueue().length
  );
}

// Drop every queued op, in memory and in the persisted KV. Called on sign-out so
// ops parked under one identity never flush under the next (uploadWorkoutShare
// resolves user_id from the *current* session). The memory arrays are cleared
// first so the in-memory wipe holds even if the KV write below throws. The KV
// write itself is retried once; if it still throws, the stale on-disk queue
// would otherwise rehydrate into the next signed-in identity, so the failure
// is rethrown for the caller to log/surface rather than swallowed (DL-2).
export function clearAllPendingQueues(db: DatabaseAdapter): void {
  clearPendingShareQueue();
  clearPendingLikeQueue();
  clearPendingCommentQueue();
  clearPendingFeedbackQueue();
  try {
    persistPendingQueues(db);
  } catch {
    persistPendingQueues(db);
  }
}

// Serialize flushes: startup and foreground-resume can both fire this. A second
// call while one is in flight awaits the same run instead of double-draining the
// queues (which double-posts as items are re-added between the two passes).
let flushInFlight: Promise<{ flushed: number; failed: number }> | null = null;

// Flush every queue against the live client, then persist whatever is
// left (failed items re-enqueue inside the flush functions).
export async function flushAllPendingQueues(
  supabase: SupabaseClient,
  db: DatabaseAdapter,
): Promise<{ flushed: number; failed: number }> {
  if (flushInFlight) return flushInFlight;

  const run = (async () => {
    const shares = await flushPendingShares(supabase);
    const likes = await flushPendingLikes(supabase);
    const comments = await flushPendingComments(supabase);
    const feedback = await flushPendingFeedback(supabase);
    persistPendingQueues(db);
    return {
      flushed: shares.flushed + likes.flushed + comments.flushed + feedback.flushed,
      failed: shares.failed + likes.failed + comments.failed + feedback.failed,
    };
  })();

  flushInFlight = run;
  try {
    return await run;
  } finally {
    flushInFlight = null;
  }
}
