/**
 * Realtime engine: channel management, subscription lifecycle, event batching.
 */

import {
  getReconnectDelay,
  shouldDebounceTyping,
  isTypingExpired,
  getPresenceStatus,
  shouldBatchUpdate,
  type TypingIndicator,
} from '../models/realtime';

// Re-export helpers for direct engine access
export {
  getReconnectDelay,
  shouldDebounceTyping,
  isTypingExpired,
  getPresenceStatus,
  shouldBatchUpdate,
};

// ── Channel Name Builders ───────────────────────────────────────────

export function buildThreadChannel(threadId: string): string {
  return `forum:thread:${threadId}`;
}

export function buildCommunityPresenceChannel(communityId: string): string {
  return `forum:presence:${communityId}`;
}

export function buildFeedChannel(userId: string): string {
  return `forum:feed:${userId}`;
}

export function buildDMChannel(conversationId: string): string {
  return `forum:dm:${conversationId}`;
}

export function buildVoiceChannel(channelId: string): string {
  return `forum:voice:${channelId}`;
}

// ── Typing Tracker ──────────────────────────────────────────────────

export function formatTypingText(typers: TypingIndicator[]): string {
  if (typers.length === 0) return '';
  if (typers.length === 1) return `${typers[0].displayName} is typing...`;
  if (typers.length === 2) {
    return `${typers[0].displayName} and ${typers[1].displayName} are typing...`;
  }
  return `${typers.length} people are typing...`;
}

export function pruneExpiredTypers(
  typers: TypingIndicator[],
  now: number,
): TypingIndicator[] {
  return typers.filter((t) => !isTypingExpired(t.timestamp, now));
}

// ── Online Members ──────────────────────────────────────────────────

export function countOnlineMembers(
  members: Array<{ lastSeenAt: number }>,
  now: number,
): number {
  return members.filter((m) => getPresenceStatus(m.lastSeenAt, now) === 'online').length;
}

// ── Event Batching ──────────────────────────────────────────────────

interface BatchedEvent<T> {
  events: T[];
  lastProcessedAt: number;
}

export function createEventBatch<T>(): BatchedEvent<T> {
  return { events: [], lastProcessedAt: 0 };
}

export function addToBatch<T>(batch: BatchedEvent<T>, event: T): BatchedEvent<T> {
  return { ...batch, events: [...batch.events, event] };
}

export function flushBatch<T>(batch: BatchedEvent<T>, now: number): { events: T[]; batch: BatchedEvent<T> } {
  if (!shouldBatchUpdate(batch.lastProcessedAt, now)) {
    return { events: [], batch };
  }
  return {
    events: batch.events,
    batch: { events: [], lastProcessedAt: now },
  };
}
