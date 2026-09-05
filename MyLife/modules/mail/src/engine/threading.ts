import type { MailMessage, MailThread } from '../types';

/**
 * Normalize a subject line by stripping Re:, Fwd:, FW: prefixes.
 */
export function normalizeSubject(subject: string): string {
  return subject
    .replace(/^(\s*(Re|Fwd|FW)\s*:\s*)+/i, '')
    .trim();
}

/**
 * Resolve which thread a message belongs to using RFC 5322 headers.
 *
 * Priority:
 * 1. In-Reply-To or References header matches a known message_id_header -> that message's thread
 * 2. Normalized subject matches an existing thread's subject
 * 3. No match -> create new thread
 *
 * Returns the thread ID or null if a new thread should be created.
 */
export function resolveThread(
  message: {
    messageIdHeader?: string | null;
    inReplyTo?: string | null;
    references?: string[];
    subject: string;
    accountId: string;
  },
  existingThreads: MailThread[],
  messagesByHeaderId: Map<string, { threadId: string | null }>,
): string | null {
  // 1. Check In-Reply-To header
  if (message.inReplyTo) {
    const parent = messagesByHeaderId.get(message.inReplyTo);
    if (parent?.threadId) return parent.threadId;
  }

  // 2. Check References headers (last reference is most relevant)
  if (message.references && message.references.length > 0) {
    for (let i = message.references.length - 1; i >= 0; i--) {
      const ref = messagesByHeaderId.get(message.references[i]);
      if (ref?.threadId) return ref.threadId;
    }
  }

  // 3. Fall back to subject-based matching
  const normalized = normalizeSubject(message.subject).toLowerCase();
  if (normalized) {
    const match = existingThreads.find(
      (t) =>
        t.accountId === message.accountId &&
        normalizeSubject(t.subject).toLowerCase() === normalized,
    );
    if (match) return match.id;
  }

  return null;
}

/**
 * Build thread metadata from a set of messages.
 */
export function buildThreadMetadata(messages: MailMessage[]): {
  messageCount: number;
  unreadCount: number;
  participantEmails: string[];
  latestMessageAt: string;
} {
  const participants = new Set<string>();
  let unread = 0;
  let latest = '';

  for (const msg of messages) {
    participants.add(msg.from);
    for (const to of msg.to) participants.add(to);
    if (!msg.isRead) unread++;
    if (msg.receivedAt > latest) latest = msg.receivedAt;
  }

  return {
    messageCount: messages.length,
    unreadCount: unread,
    participantEmails: Array.from(participants),
    latestMessageAt: latest || new Date().toISOString(),
  };
}

/**
 * Sort messages within a thread chronologically.
 */
export function sortThreadMessages(messages: MailMessage[]): MailMessage[] {
  return [...messages].sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
}
