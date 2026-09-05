import { z } from 'zod';

// ── Realtime Events ─────────────────────────────────────────────────

export const RealtimeEventTypeSchema = z.enum([
  'new_reply',
  'vote_update',
  'new_thread',
  'thread_update',
  'reply_update',
  'presence_change',
]);
export type RealtimeEventType = z.infer<typeof RealtimeEventTypeSchema>;

export const RealtimeEventSchema = z.object({
  type: RealtimeEventTypeSchema,
  payload: z.record(z.unknown()),
  timestamp: z.string().datetime(),
});
export type RealtimeEvent = z.infer<typeof RealtimeEventSchema>;

// ── Presence ────────────────────────────────────────────────────────

export const PresenceStatusSchema = z.enum(['online', 'idle', 'offline']);
export type PresenceStatus = z.infer<typeof PresenceStatusSchema>;

export const PresenceStateSchema = z.object({
  userId: z.string().uuid(),
  communityId: z.string().uuid(),
  status: PresenceStatusSchema,
  lastSeenAt: z.string().datetime(),
});
export type PresenceState = z.infer<typeof PresenceStateSchema>;

// ── Typing Indicator ────────────────────────────────────────────────

export const TypingIndicatorSchema = z.object({
  userId: z.string().uuid(),
  displayName: z.string(),
  channelId: z.string(),
  timestamp: z.number(),
});
export type TypingIndicator = z.infer<typeof TypingIndicatorSchema>;

// ── Realtime Helpers ────────────────────────────────────────────────

const TYPING_DEBOUNCE_MS = 2000;
const TYPING_TIMEOUT_MS = 3000;
const BATCH_INTERVAL_MS = 500;
const PRESENCE_IDLE_MS = 60_000;
const PRESENCE_OFFLINE_MS = 300_000;
const RECONNECT_INTERVALS = [1000, 2000, 4000, 8000, 16000, 30000];

export function getReconnectDelay(attempt: number): number {
  return RECONNECT_INTERVALS[Math.min(attempt, RECONNECT_INTERVALS.length - 1)];
}

export function shouldDebounceTyping(lastBroadcast: number, now: number): boolean {
  return now - lastBroadcast < TYPING_DEBOUNCE_MS;
}

export function isTypingExpired(timestamp: number, now: number): boolean {
  return now - timestamp > TYPING_TIMEOUT_MS;
}

export function getPresenceStatus(lastSeenAt: number, now: number): PresenceStatus {
  const elapsed = now - lastSeenAt;
  if (elapsed < PRESENCE_IDLE_MS) return 'online';
  if (elapsed < PRESENCE_OFFLINE_MS) return 'idle';
  return 'offline';
}

export function shouldBatchUpdate(lastRender: number, now: number): boolean {
  return now - lastRender >= BATCH_INTERVAL_MS;
}

export { TYPING_DEBOUNCE_MS, TYPING_TIMEOUT_MS, BATCH_INTERVAL_MS, PRESENCE_IDLE_MS, PRESENCE_OFFLINE_MS };
