/**
 * BestChef notification feed -- client-side read layer + realtime subscription.
 *
 * Server-side fanout RPCs (bc_notify_*) live in 004__notification_fanout.sql.
 * This module handles reads, mark-read, remove, and the realtime subscription
 * that delivers new rows in real time with a polling fallback.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getBestChefClient, ok, err, type BestChefResult } from './client';

// Minimal polling handle (mirrors @mylife/realtime/polling-fallback shape)
interface PollingHandle { start(): void; stop(): void; isRunning(): boolean; }
function createSimplePoller(
  intervalMs: number,
  fetchFn: () => Promise<NotificationViewModel[]>,
  onData: (rows: NotificationViewModel[]) => void,
): PollingHandle {
  let timer: ReturnType<typeof setInterval> | null = null;
  let running = false;
  async function poll() {
    try { onData(await fetchFn()); } catch { /* noop */ }
  }
  return {
    start() { if (running) return; running = true; void poll(); timer = setInterval(() => { void poll(); }, intervalMs); },
    stop() { if (timer) { clearInterval(timer); timer = null; } running = false; },
    isRunning() { return running; },
  };
}
import type {
  Notification,
  NotificationKind,
  NotificationCategory,
  NotificationTargetType,
} from './types';

export type { NotificationKind, NotificationCategory, NotificationTargetType };

// ── ViewModel ─────────────────────────────────────────────────────────

const RANK_MILESTONES = [1, 3, 10, 25, 50, 100];

/** Category derived from kind -- mirrors NotificationsStore.swift grouping. */
function kindToCategory(kind: NotificationKind): NotificationCategory {
  switch (kind) {
    case 'upvote':
    case 'reviewed_vote':
      return 'votes';
    case 'rank_up':
    case 'rank_milestone':
    case 'competition':
      return 'ranks';
    case 'follow':
    case 'comment':
    case 'mention':
      return 'social';
    case 'moderation_decision':
    case 'appeal_resolved':
      return 'moderation';
    case 'badge':
    case 'system':
    default:
      return 'system';
  }
}

/** Derive a deep-link route string from target fields. */
function buildTargetRoute(
  targetType: NotificationTargetType | null,
  targetId: string | null,
): string | null {
  if (!targetType || !targetId) return null;
  // Every route here must exist in the app tree (plan 33 Phase 5.5 review:
  // 4 of 5 mappings pointed at dead routes and the dynamic push evades the
  // route contract test).
  switch (targetType) {
    case 'submission':
      // Cloud submission detail renders through the recipe screen.
      return `/recipe/${targetId}`;
    case 'chef':
      return `/chef/${targetId}`;
    case 'dish':
      return `/dish/${targetId}`;
    case 'badge':
      // No badges screen exists; the profile shows badges inline.
      return `/(tabs)/profile`;
    case 'challenge':
      return `/challenge/${targetId}`;
    case 'comment':
    case 'appeal':
      // Moderation/appeal notices deep-link to the user's reports + appeals
      // screen. The migration collapses comment moderation notices to their
      // submission where known (routing to /recipe/{id}); a bare comment or
      // appeal target lands on My Reports, which always exists.
      return `/my-reports`;
    default:
      return null;
  }
}

/** Human-readable time-ago string. */
function buildTimeAgo(createdAt: Date): string {
  const diffMs = Date.now() - createdAt.getTime();
  const secs = Math.floor(diffMs / 1000);
  if (secs < 60) return 'now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  const wks = Math.floor(days / 7);
  return `${wks}w`;
}

export interface NotificationViewModel extends Notification {
  timeAgo: string;
  targetRoute: string | null;
}

function toViewModel(row: Record<string, unknown>): NotificationViewModel {
  const createdAt = new Date(row.created_at as string);
  const targetType = (row.target_type as NotificationTargetType | null) ?? null;
  const targetId = (row.target_id as string | null) ?? null;

  const notif: Notification = {
    id: row.id as string,
    userId: row.user_id as string,
    kind: row.kind as NotificationKind,
    category: row.category as NotificationCategory,
    title: (row.title as string) ?? '',
    body: (row.body as string) ?? '',
    params: (row.params as Record<string, unknown>) ?? {},
    actorUserId: (row.actor_user_id as string) ?? null,
    actorName: (row.actor_name as string) ?? null,
    actorColor: (row.actor_color as string) ?? null,
    targetType,
    targetId,
    isRead: (row.is_read as boolean) ?? false,
    createdAt,
  };

  return {
    ...notif,
    timeAgo: buildTimeAgo(createdAt),
    targetRoute: buildTargetRoute(targetType, targetId),
  };
}

// ── Shorthand ─────────────────────────────────────────────────────────

function from(table: string) {
  return getBestChefClient().from(table);
}

// ── Read operations ───────────────────────────────────────────────────

export interface GetNotificationFeedOptions {
  userId: string;
  category?: NotificationCategory;
  limit?: number;
  before?: Date;
}

export async function getNotificationFeed(
  _supabase: SupabaseClient | null,
  options: GetNotificationFeedOptions,
): Promise<BestChefResult<NotificationViewModel[]>> {
  const { userId, category, limit = 50, before } = options;

  let query = from('bc_notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (category) {
    query = query.eq('category', category);
  }
  if (before) {
    query = query.lt('created_at', before.toISOString());
  }

  const { data, error: dbErr } = await query;
  if (dbErr) return err(dbErr.message);
  return ok((data ?? []).map(toViewModel));
}

export interface GetUnreadCountOptions {
  userId: string;
  category?: NotificationCategory;
}

export async function getUnreadCount(
  _supabase: SupabaseClient | null,
  options: GetUnreadCountOptions,
): Promise<BestChefResult<number>> {
  const { userId, category } = options;

  let query = from('bc_notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (category) {
    query = query.eq('category', category);
  }

  const { count, error: dbErr } = await query;
  if (dbErr) return err(dbErr.message);
  return ok(count ?? 0);
}

export async function markNotificationRead(
  _supabase: SupabaseClient | null,
  options: { id: string },
): Promise<BestChefResult<void>> {
  const { error: dbErr } = await from('bc_notifications')
    .update({ is_read: true })
    .eq('id', options.id);

  if (dbErr) return err(dbErr.message);
  return ok(undefined);
}

export async function markAllRead(
  _supabase: SupabaseClient | null,
  options: { userId: string; category?: NotificationCategory },
): Promise<BestChefResult<void>> {
  const { userId, category } = options;

  let query = from('bc_notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (category) {
    query = query.eq('category', category);
  }

  const { error: dbErr } = await query;
  if (dbErr) return err(dbErr.message);
  return ok(undefined);
}

export async function removeNotification(
  _supabase: SupabaseClient | null,
  options: { id: string },
): Promise<BestChefResult<void>> {
  const { error: dbErr } = await from('bc_notifications')
    .delete()
    .eq('id', options.id);

  if (dbErr) return err(dbErr.message);
  return ok(undefined);
}

// ── Realtime subscription ─────────────────────────────────────────────

export interface SubscribeNotificationFeedOptions {
  supabase: SupabaseClient;
  userId: string;
  onInsert?: (notif: NotificationViewModel) => void;
  onUpdate?: (notif: NotificationViewModel) => void;
  onDelete?: (id: string) => void;
}

/**
 * Subscribe to bc_notifications realtime changes for the given user.
 * Returns an unsubscribe function.
 *
 * Falls back to 30-second polling when realtime is unavailable.
 * Polling only delivers new rows (INSERT equivalent) via `onInsert`.
 */
export function subscribeNotificationFeed(
  options: SubscribeNotificationFeedOptions,
): () => void {
  const { supabase, userId, onInsert, onUpdate, onDelete } = options;

  let realtimeActive = false;
  let pollHandle: PollingHandle | null = null;
  let lastPollAt = new Date();

  // Attempt realtime first
  const channel = supabase
    .channel(`bc_notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'bc_notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        realtimeActive = true;
        const { eventType, new: newRow, old: oldRow } = payload as {
          eventType: 'INSERT' | 'UPDATE' | 'DELETE';
          new?: Record<string, unknown>;
          old?: Record<string, unknown>;
        };

        if (eventType === 'INSERT' && newRow) {
          onInsert?.(toViewModel(newRow));
        } else if (eventType === 'UPDATE' && newRow) {
          onUpdate?.(toViewModel(newRow));
        } else if (eventType === 'DELETE' && oldRow?.id) {
          onDelete?.(oldRow.id as string);
        }
      },
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        realtimeActive = true;
        // Stop polling if it was running
        if (pollHandle?.isRunning()) {
          pollHandle.stop();
          pollHandle = null;
        }
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        realtimeActive = false;
        startPolling();
      }
    });

  function startPolling() {
    if (pollHandle?.isRunning()) return;
    pollHandle = createSimplePoller(
      30_000,
      async () => {
        const since = lastPollAt;
        lastPollAt = new Date();
        const result = await getNotificationFeed(null, { userId, limit: 20 });
        if (!result.ok) return [];
        return result.data.filter((n) => n.createdAt >= since);
      },
      (rows) => {
        if (realtimeActive) return;
        for (const notif of rows) onInsert?.(notif);
      },
    );
    pollHandle.start();
  }

  // Kick off polling as a backup after 5 s if realtime hasn't connected
  const fallbackTimer = setTimeout(() => {
    if (!realtimeActive) startPolling();
  }, 5_000);

  return () => {
    clearTimeout(fallbackTimer);
    pollHandle?.stop();
    supabase.removeChannel(channel);
  };
}

// ── Re-export helpers for callers ─────────────────────────────────────
export { kindToCategory, buildTargetRoute, buildTimeAgo, RANK_MILESTONES };
