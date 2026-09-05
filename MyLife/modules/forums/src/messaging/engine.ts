/**
 * Direct messaging engine: conversation management, message helpers, offline queue.
 */

import {
  getUnreadCount,
  isReadByRecipient,
  formatMessagePreview,
  MAX_GROUP_PARTICIPANTS,
  MESSAGE_PAGE_SIZE,
} from '../models/messaging';

// Re-export for direct engine access
export {
  getUnreadCount,
  isReadByRecipient,
  formatMessagePreview,
  MAX_GROUP_PARTICIPANTS,
  MESSAGE_PAGE_SIZE,
};

// ── Conversation Deduplication ──────────────────────────────────────

/**
 * Check if a 1:1 conversation already exists between two users.
 * Returns the conversation id if found, null otherwise.
 */
export function findExisting1to1(
  conversations: Array<{
    id: string;
    isGroup: boolean;
    participantIds: string[];
  }>,
  userId: string,
  otherUserId: string,
): string | null {
  for (const conv of conversations) {
    if (conv.isGroup) continue;
    if (
      conv.participantIds.length === 2 &&
      conv.participantIds.includes(userId) &&
      conv.participantIds.includes(otherUserId)
    ) {
      return conv.id;
    }
  }
  return null;
}

// ── Block Checking ──────────────────────────────────────────────────

export function isUserBlocked(
  blocks: Array<{ blockerId: string; blockedId: string }>,
  userId: string,
  otherUserId: string,
): boolean {
  return blocks.some(
    (b) =>
      (b.blockerId === userId && b.blockedId === otherUserId) ||
      (b.blockerId === otherUserId && b.blockedId === userId),
  );
}

// ── Message Validation ──────────────────────────────────────────────

export function validateMessageBody(body: string): { valid: boolean; error?: string } {
  if (body.length === 0) {
    return { valid: false, error: 'Message cannot be empty' };
  }
  if (body.length > 5000) {
    return { valid: false, error: 'Message exceeds 5000 character limit' };
  }
  return { valid: true };
}

export function getCharacterCountInfo(body: string): {
  count: number;
  remaining: number;
  showWarning: boolean;
} {
  const count = body.length;
  return {
    count,
    remaining: 5000 - count,
    showWarning: count >= 4500,
  };
}

// ── Offline Message Queue ───────────────────────────────────────────

export type QueueStatus = 'pending' | 'sent' | 'failed';

export interface QueuedMessage {
  localId: string;
  conversationId: string;
  body: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'gif';
  status: QueueStatus;
  createdAt: string;
}

export function sortConversationsByLastMessage(
  conversations: Array<{ lastMessageAt: string | null }>,
): Array<{ lastMessageAt: string | null }> {
  return [...conversations].sort((a, b) => {
    if (!a.lastMessageAt) return 1;
    if (!b.lastMessageAt) return -1;
    return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
  });
}
