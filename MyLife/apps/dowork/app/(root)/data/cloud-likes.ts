// DoWork cloud like helpers.
//
// CRUD against the `dw_likes` table. Optimistic mutations + in-memory
// offline queue for failed like/unlike actions.
//
// The in-memory offline queue is persisted to the hub_settings KV table by
// data/pending-queues.ts. It hydrates at app start, and this module fires a
// registered persist hook after every queue mutation (enqueue AND flush
// retention update) so a queued like/unlike survives a force-quit that never
// routes through the AppState background handler. The hook is registered by
// pending-queues.ts (which imports this module); this module never imports
// pending-queues back.

import type { SupabaseClient } from '@supabase/supabase-js';
import { isTransientQueueError } from './friendly-errors';

const LIKES_TABLE = 'dw_likes';

export type CloudLikeResult<T> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

export interface PendingLikeItem {
  id: string;
  shareId: string;
  userId: string;
  desiredLiked: boolean;
  createdAt: string;
  attempts: number;
  lastError: string | null;
}

const pendingLikeQueue: PendingLikeItem[] = [];

// Registered by pending-queues.ts at hydrate time; a no-op until then. Fired
// after every queue mutation so an enqueue-then-force-quit does not lose the
// op. Best-effort: a persist failure must never break the user-facing op.
let persistHook: (() => void) | null = null;

export function setPendingLikesPersistHook(hook: (() => void) | null): void {
  persistHook = hook;
}

function firePersistHook(): void {
  if (!persistHook) return;
  try {
    persistHook();
  } catch {
    // Best-effort persistence; never surface to the calling op.
  }
}

// After this many failed flush attempts an entry is poison (RLS/validation
// rejection that will never succeed) and is dropped rather than retried forever.
// Only permanent-looking failures count against this cap (DL-4); a transient
// network blip re-queues with attempts unchanged. MAX_QUEUE_AGE_MS is the
// backstop for an item that stays transient forever.
const MAX_QUEUE_ATTEMPTS = 5;
const MAX_QUEUE_AGE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

// Replace the in-memory queue with items hydrated from local storage
// (dedupes by (shareId, userId) keeping the newest desire).
export function restorePendingLikeQueue(items: PendingLikeItem[]): void {
  pendingLikeQueue.length = 0;
  for (const item of items) {
    if (!item || typeof item.id !== 'string') continue;
    const existingIndex = pendingLikeQueue.findIndex(
      (queued) => queued.shareId === item.shareId && queued.userId === item.userId,
    );
    if (existingIndex >= 0) pendingLikeQueue.splice(existingIndex, 1);
    pendingLikeQueue.push(item);
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function errMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return 'Unknown error';
}

function enqueuePendingLike(
  shareId: string,
  userId: string,
  desiredLiked: boolean,
  error: string,
): void {
  const id = `pending-like-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  // De-duplicate by (shareId, userId) — keep latest desire.
  const existingIndex = pendingLikeQueue.findIndex(
    (item) => item.shareId === shareId && item.userId === userId,
  );
  if (existingIndex >= 0) {
    pendingLikeQueue.splice(existingIndex, 1);
  }
  pendingLikeQueue.push({
    id,
    shareId,
    userId,
    desiredLiked,
    createdAt: nowIso(),
    attempts: 0,
    lastError: error,
  });
  firePersistHook();
}

// Insert/delete cores. Never enqueue, so flushPendingLikes can replay an item
// without likeShare/unlikeShare re-appending it mid-flush (which reset attempts
// to 0 and defeated the poison cap). The public wrappers own the enqueue.
async function likeShareCore(
  supabase: SupabaseClient,
  shareId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const result = await supabase
      .from(LIKES_TABLE)
      .insert({ share_id: shareId, user_id: userId })
      .select('id')
      .maybeSingle();

    if (result.error) {
      // Unique violation == already liked == treat as success.
      const code = (result.error as { code?: string }).code;
      if (code === '23505') return { ok: true };
      return { ok: false, error: errMessage(result.error) };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

async function unlikeShareCore(
  supabase: SupabaseClient,
  shareId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const result = await supabase
      .from(LIKES_TABLE)
      .delete()
      .eq('share_id', shareId)
      .eq('user_id', userId);

    if (result.error) {
      return { ok: false, error: errMessage(result.error) };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

export async function likeShare(
  supabase: SupabaseClient,
  shareId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await likeShareCore(supabase, shareId, userId);
  if (!result.ok) enqueuePendingLike(shareId, userId, true, result.error);
  return result;
}

export async function unlikeShare(
  supabase: SupabaseClient,
  shareId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await unlikeShareCore(supabase, shareId, userId);
  if (!result.ok) enqueuePendingLike(shareId, userId, false, result.error);
  return result;
}

export async function getLikeCounts(
  supabase: SupabaseClient,
  shareIds: string[],
): Promise<CloudLikeResult<{ counts: Record<string, number> }>> {
  if (shareIds.length === 0) {
    return { ok: true, counts: {} };
  }
  try {
    const result = await supabase
      .from(LIKES_TABLE)
      .select('share_id')
      .in('share_id', shareIds);

    if (result.error) return { ok: false, error: errMessage(result.error) };

    const counts: Record<string, number> = {};
    for (const row of (result.data ?? []) as { share_id: string }[]) {
      counts[row.share_id] = (counts[row.share_id] ?? 0) + 1;
    }
    for (const id of shareIds) {
      if (!(id in counts)) counts[id] = 0;
    }
    return { ok: true, counts };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

export async function getMyLikedShareIds(
  supabase: SupabaseClient,
  userId: string,
  shareIds: string[],
): Promise<CloudLikeResult<{ ids: Set<string> }>> {
  if (shareIds.length === 0) return { ok: true, ids: new Set() };
  try {
    const result = await supabase
      .from(LIKES_TABLE)
      .select('share_id')
      .eq('user_id', userId)
      .in('share_id', shareIds);

    if (result.error) return { ok: false, error: errMessage(result.error) };

    const ids = new Set<string>();
    for (const row of (result.data ?? []) as { share_id: string }[]) {
      ids.add(row.share_id);
    }
    return { ok: true, ids };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

export function getPendingLikeQueue(): readonly PendingLikeItem[] {
  return pendingLikeQueue;
}

export function clearPendingLikeQueue(): void {
  pendingLikeQueue.length = 0;
}

export async function flushPendingLikes(
  supabase: SupabaseClient,
): Promise<{ flushed: number; failed: number }> {
  if (pendingLikeQueue.length === 0) return { flushed: 0, failed: 0 };

  const items = [...pendingLikeQueue];
  pendingLikeQueue.length = 0;
  const remaining: PendingLikeItem[] = [];
  let flushed = 0;
  let failed = 0;

  for (const item of items) {
    const result = item.desiredLiked
      ? await likeShareCore(supabase, item.shareId, item.userId)
      : await unlikeShareCore(supabase, item.shareId, item.userId);
    if (result.ok) {
      flushed += 1;
    } else {
      failed += 1;
      const transient = isTransientQueueError(result.error);
      const attempts = transient ? item.attempts : item.attempts + 1;
      const age = Date.now() - Date.parse(item.createdAt);
      const expired = Number.isFinite(age) && age > MAX_QUEUE_AGE_MS;
      if (attempts < MAX_QUEUE_ATTEMPTS && !expired) {
        remaining.push({ ...item, attempts, lastError: result.error });
      }
    }
  }

  pendingLikeQueue.push(...remaining);
  // Retained failures shrank the queue; persist so a force-quit before the
  // flushAllPendingQueues caller's final persist does not resurrect a
  // just-succeeded item.
  firePersistHook();
  return { flushed, failed };
}
