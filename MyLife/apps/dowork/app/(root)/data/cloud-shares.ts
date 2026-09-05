// DoWork cloud share helpers.
//
// CRUD against the `dw_workout_shares` table. Mirrors the BestChef
// cloud-submissions pattern with optimistic + offline-queued mutations.
//
// The in-memory offline queue is persisted to the hub_settings KV table by
// data/pending-queues.ts. It hydrates at app start, and this module fires a
// registered persist hook after every queue mutation (enqueue AND flush
// retention update) so a queued op survives a force-quit that never routes
// through the AppState background handler. The hook is registered by
// pending-queues.ts (which imports this module); this module never imports
// pending-queues back, keeping the dependency one-directional.

import type { SupabaseClient } from '@supabase/supabase-js';
import { classifyCloudWriteFailure, type CloudWriteFailureClass } from './cloud-failures';

const SHARES_TABLE = 'dw_workout_shares';
const LIKES_TABLE = 'dw_likes';
const COMMENTS_TABLE = 'dw_comments';

export type SharePrivacy = 'public' | 'followers' | 'private';

export interface CloudShareInput {
  title: string;
  summary?: string;
  durationSeconds: number;
  totalVolumeKg: number;
  exerciseCount: number;
  category?: string;
  heroImageUrl?: string;
  privacy: SharePrivacy;
}

export interface CloudShareRow {
  id: string;
  userId: string;
  title: string;
  summary: string | null;
  durationSeconds: number;
  totalVolumeKg: number;
  exerciseCount: number;
  category: string | null;
  heroImageUrl: string | null;
  privacy: SharePrivacy;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  myLikedFlag: boolean;
}

export interface ListSharesOptions {
  limit?: number;
  cursor?: string;
}

export type CloudShareResult<T> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

// Public upload result. `queued` tells the caller whether a failure was parked
// for offline retry (true) or is a permanent rejection to surface (false), so
// the share screen never invites a retry that would double-queue the post.
export type UploadShareResult =
  | { ok: true; share: CloudShareRow; queued: false }
  | { ok: false; error: string; queued: boolean };

type UploadShareCoreResult =
  | { ok: true; share: CloudShareRow }
  | { ok: false; error: string; failureClass: CloudWriteFailureClass };

interface RawShareRow {
  id: string;
  user_id: string;
  title: string;
  summary: string | null;
  duration_seconds: number;
  total_volume_kg: number | string;
  exercise_count: number;
  category: string | null;
  hero_image_url: string | null;
  privacy: SharePrivacy;
  created_at: string;
  is_hidden?: boolean;
}

interface RawLikeRow {
  share_id: string;
  user_id: string;
}

interface RawCommentCountRow {
  share_id: string;
  count: number;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export interface PendingShareItem {
  id: string;
  input: CloudShareInput;
  /**
   * The auth uid this share was composed under. Replay posts ONLY when the
   * current session matches, so a share queued anonymously can never surface
   * under an email account signed into later. null = unknown enqueuer
   * (legacy persisted items); those are dropped at flush rather than guessed.
   */
  userId: string | null;
  createdAt: string;
  attempts: number;
  lastError: string | null;
}

const pendingShareQueue: PendingShareItem[] = [];

// Registered by pending-queues.ts at hydrate time; a no-op until then. Fired
// after every queue mutation so an enqueue-then-force-quit does not lose the
// op (the AppState background handler is not guaranteed on a hard kill). The
// hook is best-effort: a persist failure must never break the user-facing
// like/comment/share/feedback op that triggered it, so firePersistHook
// swallows any throw.
let persistHook: (() => void) | null = null;

export function setPendingSharesPersistHook(hook: (() => void) | null): void {
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
// network blip re-queues with attempts unchanged so flaky connectivity does not
// silently drop a share. MAX_QUEUE_AGE_MS is the backstop for an item that stays
// transient forever (e.g. permanently offline device) so it cannot live in the
// queue indefinitely either.
const MAX_QUEUE_ATTEMPTS = 5;
const MAX_QUEUE_AGE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

// Replace the in-memory queue with items hydrated from local storage
// (dedupes by id; used by lib/pending-queues at app start).
export function restorePendingShareQueue(items: PendingShareItem[]): void {
  const seen = new Set<string>();
  pendingShareQueue.length = 0;
  for (const item of items) {
    if (!item || typeof item.id !== 'string' || seen.has(item.id)) continue;
    seen.add(item.id);
    // Items persisted before the identity field existed hydrate as null and
    // are dropped at the next flush instead of replaying under whoever is
    // signed in now.
    pendingShareQueue.push({ ...item, userId: typeof item.userId === 'string' ? item.userId : null });
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function clampLimit(value: number | undefined): number {
  if (!value || value <= 0) return DEFAULT_LIMIT;
  return Math.min(value, MAX_LIMIT);
}

function asNumber(value: number | string): number {
  if (typeof value === 'number') return value;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
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

function toRow(
  raw: RawShareRow,
  likeCount: number,
  commentCount: number,
  myLiked: boolean,
): CloudShareRow {
  return {
    id: raw.id,
    userId: raw.user_id,
    title: raw.title,
    summary: raw.summary,
    durationSeconds: raw.duration_seconds,
    totalVolumeKg: asNumber(raw.total_volume_kg),
    exerciseCount: raw.exercise_count,
    category: raw.category,
    heroImageUrl: raw.hero_image_url,
    privacy: raw.privacy,
    createdAt: raw.created_at,
    likeCount,
    commentCount,
    myLikedFlag: myLiked,
  };
}

async function hydrateShareRows(
  supabase: SupabaseClient,
  rows: RawShareRow[],
  viewerId: string | null,
): Promise<CloudShareRow[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);

  // Like counts
  const likeCountByShare = new Map<string, number>();
  const myLikedSet = new Set<string>();

  const likesQuery = await supabase
    .from(LIKES_TABLE)
    .select('share_id, user_id')
    .in('share_id', ids);

  if (!likesQuery.error && Array.isArray(likesQuery.data)) {
    for (const like of likesQuery.data as RawLikeRow[]) {
      likeCountByShare.set(
        like.share_id,
        (likeCountByShare.get(like.share_id) ?? 0) + 1,
      );
      if (viewerId && like.user_id === viewerId) myLikedSet.add(like.share_id);
    }
  }

  // Comment counts
  const commentCountByShare = new Map<string, number>();
  const commentsQuery = await supabase
    .from(COMMENTS_TABLE)
    .select('share_id, count')
    .in('share_id', ids);

  if (!commentsQuery.error && Array.isArray(commentsQuery.data)) {
    for (const row of commentsQuery.data as RawCommentCountRow[]) {
      commentCountByShare.set(row.share_id, row.count ?? 0);
    }
  } else {
    // Fallback: count manually
    const fallback = await supabase
      .from(COMMENTS_TABLE)
      .select('share_id')
      .in('share_id', ids);
    if (!fallback.error && Array.isArray(fallback.data)) {
      for (const row of fallback.data as { share_id: string }[]) {
        commentCountByShare.set(
          row.share_id,
          (commentCountByShare.get(row.share_id) ?? 0) + 1,
        );
      }
    }
  }

  return rows.map((row) =>
    toRow(
      row,
      likeCountByShare.get(row.id) ?? 0,
      commentCountByShare.get(row.id) ?? 0,
      myLikedSet.has(row.id),
    ),
  );
}

function enqueuePendingShare(input: CloudShareInput, error: string, userId: string | null): string {
  const id = `pending-share-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  pendingShareQueue.push({
    id,
    input,
    userId,
    createdAt: nowIso(),
    attempts: 0,
    lastError: error,
  });
  firePersistHook();
  return id;
}

// Insert core. Never enqueues, so flushPendingShares can call it without an
// item re-appending itself to the queue mid-flush (which would loop forever
// while offline). The public uploadWorkoutShare wrapper owns the enqueue.
async function uploadWorkoutShareCore(
  supabase: SupabaseClient,
  input: CloudShareInput,
): Promise<UploadShareCoreResult> {
  try {
    const auth = await supabase.auth.getUser();
    const userId = auth.data.user?.id ?? null;
    if (!userId) {
      return { ok: false, error: 'no_session', failureClass: 'transient' };
    }

    const insert = await supabase
      .from(SHARES_TABLE)
      .insert({
        user_id: userId,
        title: input.title,
        summary: input.summary ?? null,
        duration_seconds: input.durationSeconds,
        total_volume_kg: input.totalVolumeKg,
        exercise_count: input.exerciseCount,
        category: input.category ?? null,
        hero_image_url: input.heroImageUrl ?? null,
        privacy: input.privacy,
      })
      .select('*')
      .single();

    if (insert.error) {
      return {
        ok: false,
        error: errMessage(insert.error),
        failureClass: classifyCloudWriteFailure(insert.error),
      };
    }
    if (!insert.data) {
      return { ok: false, error: 'Share could not be created.', failureClass: 'permanent' };
    }

    const row = toRow(insert.data as RawShareRow, 0, 0, false);
    return { ok: true, share: row };
  } catch (error) {
    return {
      ok: false,
      error: errMessage(error),
      failureClass: classifyCloudWriteFailure(error),
    };
  }
}

export async function uploadWorkoutShare(
  supabase: SupabaseClient,
  input: CloudShareInput,
): Promise<UploadShareResult> {
  const result = await uploadWorkoutShareCore(supabase, input);
  if (result.ok) {
    return { ok: true, share: result.share, queued: false };
  }
  if (result.failureClass !== 'transient') {
    return { ok: false, error: result.error, queued: false };
  }
  let enqueuerUid: string | null = null;
  try {
    const session = await supabase.auth.getSession();
    enqueuerUid = session.data.session?.user?.id ?? null;
  } catch {
    // No resolvable session: item is enqueued unowned and dropped at flush.
  }
  enqueuePendingShare(input, result.error, enqueuerUid);
  const error =
    result.error === 'no_session' ? 'Sign in required to share a workout.' : result.error;
  return { ok: false, error, queued: true };
}

type ShareFilter = 'public' | { mine: string };

async function listSharesByFilter(
  supabase: SupabaseClient,
  filter: ShareFilter,
  options: ListSharesOptions,
  viewerId: string | null,
): Promise<CloudShareResult<{ shares: CloudShareRow[]; nextCursor: string | null }>> {
  try {
    const limit = clampLimit(options.limit);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase.from(SHARES_TABLE).select('*');

    if (filter === 'public') {
      q = q.eq('privacy', 'public');
    } else {
      q = q.eq('user_id', filter.mine);
    }

    q = q.order('created_at', { ascending: false }).limit(limit + 1);
    if (options.cursor) q = q.lt('created_at', options.cursor);

    const result = await q;
    if (result.error) return { ok: false, error: errMessage(result.error) };

    const raw = (result.data ?? []) as RawShareRow[];
    const hasMore = raw.length > limit;
    const trimmed = hasMore ? raw.slice(0, limit) : raw;
    const shares = await hydrateShareRows(supabase, trimmed, viewerId);
    const nextCursor = hasMore ? trimmed[trimmed.length - 1]?.created_at ?? null : null;
    return { ok: true, shares, nextCursor };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

export async function listPublicShares(
  supabase: SupabaseClient,
  options: ListSharesOptions = {},
): Promise<CloudShareResult<{ shares: CloudShareRow[]; nextCursor: string | null }>> {
  const auth = await supabase.auth.getUser();
  const viewerId = auth.data.user?.id ?? null;
  return listSharesByFilter(supabase, 'public', options, viewerId);
}

// Single share with hydrated like/comment counts (post detail screen).
export async function getShareById(
  supabase: SupabaseClient,
  shareId: string,
): Promise<CloudShareResult<{ share: CloudShareRow | null }>> {
  try {
    const auth = await supabase.auth.getUser();
    const viewerId = auth.data.user?.id ?? null;

    const result = await supabase
      .from(SHARES_TABLE)
      .select('*')
      .eq('id', shareId)
      .maybeSingle();

    if (result.error) return { ok: false, error: errMessage(result.error) };
    if (!result.data) return { ok: true, share: null };

    const shares = await hydrateShareRows(supabase, [result.data as RawShareRow], viewerId);
    return { ok: true, share: shares[0] ?? null };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

export async function listMyShares(
  supabase: SupabaseClient,
  userId: string,
  options: ListSharesOptions = {},
): Promise<CloudShareResult<{ shares: CloudShareRow[]; nextCursor: string | null }>> {
  return listSharesByFilter(supabase, { mine: userId }, options, userId);
}

export async function deleteShare(
  supabase: SupabaseClient,
  shareId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const result = await supabase.from(SHARES_TABLE).delete().eq('id', shareId);
    if (result.error) return { ok: false, error: errMessage(result.error) };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

export async function hideShare(
  supabase: SupabaseClient,
  shareId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const result = await supabase
      .from(SHARES_TABLE)
      .update({ is_hidden: true, updated_at: nowIso() })
      .eq('id', shareId);
    if (result.error) return { ok: false, error: errMessage(result.error) };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

export function getPendingShareQueue(): readonly PendingShareItem[] {
  return pendingShareQueue;
}

export function clearPendingShareQueue(): void {
  pendingShareQueue.length = 0;
}

export async function flushPendingShares(
  supabase: SupabaseClient,
): Promise<{ flushed: number; failed: number; dropped: number }> {
  if (pendingShareQueue.length === 0) return { flushed: 0, failed: 0, dropped: 0 };

  let currentUid: string | null = null;
  try {
    const session = await supabase.auth.getSession();
    currentUid = session.data.session?.user?.id ?? null;
  } catch {
    currentUid = null;
  }

  // Snapshot and clear up front so the core (which never self-enqueues) leaves
  // an empty queue; only genuinely-failed items below get re-added.
  const items = [...pendingShareQueue];
  pendingShareQueue.length = 0;
  const remaining: PendingShareItem[] = [];
  let flushed = 0;
  let failed = 0;
  let dropped = 0;

  for (const item of items) {
    // Identity guard: never post a share under a different account than the
    // one it was composed under (anonymous-to-email sign-in without an
    // explicit sign-out). Unowned legacy items are dropped, not guessed.
    if (item.userId === null || item.userId !== currentUid) {
      dropped += 1;
      continue;
    }
    const result = await uploadWorkoutShareCore(supabase, item.input);
    if (result.ok) {
      flushed += 1;
    } else {
      failed += 1;
      const transient = result.failureClass === 'transient';
      const attempts = transient ? item.attempts : item.attempts + 1;
      const age = Date.now() - Date.parse(item.createdAt);
      const expired = Number.isFinite(age) && age > MAX_QUEUE_AGE_MS;
      if (attempts < MAX_QUEUE_ATTEMPTS && !expired) {
        remaining.push({ ...item, attempts, lastError: result.error });
      } else {
        dropped += 1;
      }
    }
  }

  pendingShareQueue.push(...remaining);
  // Retained failures shrank the queue; persist so a force-quit before the
  // flushAllPendingQueues caller's final persist does not resurrect a
  // just-succeeded item.
  firePersistHook();
  return { flushed, failed, dropped };
}
