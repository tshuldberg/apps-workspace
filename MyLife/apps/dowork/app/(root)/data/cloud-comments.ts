// DoWork cloud comment helpers.
//
// CRUD against the `dw_comments` table. Mirrors the cloud-shares /
// cloud-likes pattern with an in-memory offline queue for failed
// posts.
//
// The in-memory offline queue is persisted to the hub_settings KV table by
// data/pending-queues.ts. It hydrates at app start, and this module fires a
// registered persist hook after every queue mutation (enqueue AND flush
// retention update) so a queued comment survives a force-quit that never routes
// through the AppState background handler. The hook is registered by
// pending-queues.ts (which imports this module); this module never imports
// pending-queues back.

import type { SupabaseClient } from '@supabase/supabase-js';
import { isTransientQueueError } from './friendly-errors';

const COMMENTS_TABLE = 'dw_comments';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const MAX_BODY_LENGTH = 500;

export type CloudCommentResult<T> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

export interface CloudCommentRow {
  id: string;
  shareId: string;
  userId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListCommentsOptions {
  limit?: number;
  cursor?: string;
}

interface RawCommentRow {
  id: string;
  share_id: string;
  user_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  is_hidden?: boolean;
}

export interface PendingCommentItem {
  id: string;
  shareId: string;
  userId: string;
  body: string;
  createdAt: string;
  attempts: number;
  lastError: string | null;
}

const pendingCommentQueue: PendingCommentItem[] = [];

// Registered by pending-queues.ts at hydrate time; a no-op until then. Fired
// after every queue mutation so an enqueue-then-force-quit does not lose the
// op. Best-effort: a persist failure must never break the user-facing op.
let persistHook: (() => void) | null = null;

export function setPendingCommentsPersistHook(hook: (() => void) | null): void {
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
// (dedupes by id; used by lib/pending-queues at app start).
export function restorePendingCommentQueue(items: PendingCommentItem[]): void {
  const seen = new Set<string>();
  pendingCommentQueue.length = 0;
  for (const item of items) {
    if (!item || typeof item.id !== 'string' || seen.has(item.id)) continue;
    seen.add(item.id);
    pendingCommentQueue.push(item);
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function clampLimit(value: number | undefined): number {
  if (!value || value <= 0) return DEFAULT_LIMIT;
  return Math.min(value, MAX_LIMIT);
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

function toRow(raw: RawCommentRow): CloudCommentRow {
  return {
    id: raw.id,
    shareId: raw.share_id,
    userId: raw.user_id,
    body: raw.body,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

function enqueuePendingComment(
  shareId: string,
  userId: string,
  body: string,
  error: string,
): string {
  const id = `pending-comment-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  pendingCommentQueue.push({
    id,
    shareId,
    userId,
    body,
    createdAt: nowIso(),
    attempts: 0,
    lastError: error,
  });
  firePersistHook();
  return id;
}

// Insert core. Never enqueues, so flushPendingComments can replay an item
// without postComment re-appending a duplicate copy mid-flush (which posted the
// comment N times once connectivity returned). Body is assumed already trimmed
// and validated by the caller. The public postComment wrapper owns the enqueue.
async function insertCommentCore(
  supabase: SupabaseClient,
  shareId: string,
  userId: string,
  body: string,
): Promise<CloudCommentResult<{ comment: CloudCommentRow }>> {
  try {
    const insert = await supabase
      .from(COMMENTS_TABLE)
      .insert({ share_id: shareId, user_id: userId, body })
      .select('*')
      .single();

    if (insert.error || !insert.data) {
      return { ok: false, error: errMessage(insert.error) };
    }

    return { ok: true, comment: toRow(insert.data as RawCommentRow) };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

export async function postComment(
  supabase: SupabaseClient,
  shareId: string,
  userId: string,
  body: string,
): Promise<CloudCommentResult<{ comment: CloudCommentRow }>> {
  const trimmed = body.trim();
  // Validation failures are permanent, so they return without queueing.
  if (!trimmed) {
    return { ok: false, error: 'Comment body cannot be empty.' };
  }
  if (trimmed.length > MAX_BODY_LENGTH) {
    return { ok: false, error: `Comment exceeds ${MAX_BODY_LENGTH} characters.` };
  }

  const result = await insertCommentCore(supabase, shareId, userId, trimmed);
  if (!result.ok) {
    enqueuePendingComment(shareId, userId, trimmed, result.error);
  }
  return result;
}

export async function listComments(
  supabase: SupabaseClient,
  shareId: string,
  options: ListCommentsOptions = {},
): Promise<CloudCommentResult<{ comments: CloudCommentRow[]; nextCursor: string | null }>> {
  try {
    const limit = clampLimit(options.limit);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase
      .from(COMMENTS_TABLE)
      .select('*')
      .eq('share_id', shareId)
      .order('created_at', { ascending: false })
      .limit(limit + 1);

    if (options.cursor) q = q.lt('created_at', options.cursor);

    const result = await q;
    if (result.error) return { ok: false, error: errMessage(result.error) };

    const raw = (result.data ?? []) as RawCommentRow[];
    const hasMore = raw.length > limit;
    const trimmed = hasMore ? raw.slice(0, limit) : raw;
    const comments = trimmed.map(toRow);
    const nextCursor = hasMore ? trimmed[trimmed.length - 1]?.created_at ?? null : null;
    return { ok: true, comments, nextCursor };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

export async function deleteComment(
  supabase: SupabaseClient,
  commentId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const result = await supabase.from(COMMENTS_TABLE).delete().eq('id', commentId);
    if (result.error) return { ok: false, error: errMessage(result.error) };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

export async function editComment(
  supabase: SupabaseClient,
  commentId: string,
  body: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = body.trim();
  if (!trimmed) {
    return { ok: false, error: 'Comment body cannot be empty.' };
  }
  if (trimmed.length > MAX_BODY_LENGTH) {
    return { ok: false, error: `Comment exceeds ${MAX_BODY_LENGTH} characters.` };
  }

  try {
    const result = await supabase
      .from(COMMENTS_TABLE)
      .update({ body: trimmed, updated_at: nowIso() })
      .eq('id', commentId);
    if (result.error) return { ok: false, error: errMessage(result.error) };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

export function getPendingCommentQueue(): readonly PendingCommentItem[] {
  return pendingCommentQueue;
}

export function clearPendingCommentQueue(): void {
  pendingCommentQueue.length = 0;
}

export async function flushPendingComments(
  supabase: SupabaseClient,
): Promise<{ flushed: number; failed: number }> {
  if (pendingCommentQueue.length === 0) return { flushed: 0, failed: 0 };

  const items = [...pendingCommentQueue];
  pendingCommentQueue.length = 0;
  const remaining: PendingCommentItem[] = [];
  let flushed = 0;
  let failed = 0;

  for (const item of items) {
    // insertCommentCore (not postComment) so a failure re-queues exactly once.
    const result = await insertCommentCore(supabase, item.shareId, item.userId, item.body);
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

  pendingCommentQueue.push(...remaining);
  // Retained failures shrank the queue; persist so a force-quit before the
  // flushAllPendingQueues caller's final persist does not resurrect a
  // just-succeeded item.
  firePersistHook();
  return { flushed, failed };
}
