import type { MailMessage } from '../types';

/**
 * Search messages by matching query against subject, from, and body fields.
 * Case-insensitive substring match.
 */
export function searchMessages(messages: MailMessage[], query: string): MailMessage[] {
  if (!query.trim()) return messages;
  const lower = query.toLowerCase();
  return messages.filter((msg) =>
    msg.subject.toLowerCase().includes(lower) ||
    msg.from.toLowerCase().includes(lower) ||
    msg.body.toLowerCase().includes(lower),
  );
}

/**
 * Strip common reply/forward prefixes from a subject line to get the thread root subject.
 * Handles Re:, Fwd:, FW:, and multiple nested prefixes.
 */
function normalizeSubject(subject: string): string {
  return subject
    .replace(/^(\s*(Re|Fwd|FW)\s*:\s*)+/i, '')
    .trim()
    .toLowerCase();
}

/**
 * Group messages by thread based on normalized subject (stripping Re:, Fwd:, FW: prefixes).
 * Returns a Map where keys are normalized subject strings and values are arrays of messages.
 */
export function groupByThread(messages: MailMessage[]): Map<string, MailMessage[]> {
  const threads = new Map<string, MailMessage[]>();

  for (const msg of messages) {
    const key = normalizeSubject(msg.subject);
    const existing = threads.get(key);
    if (existing) {
      existing.push(msg);
    } else {
      threads.set(key, [msg]);
    }
  }

  return threads;
}

/**
 * Count the number of unread messages in a list.
 */
export function getUnreadCount(messages: MailMessage[]): number {
  return messages.filter((msg) => !msg.isRead).length;
}

/**
 * Filter messages to those received within a date range (inclusive).
 * Dates should be ISO strings (compared lexicographically).
 */
export function filterByDateRange(
  messages: MailMessage[],
  from: string,
  to: string,
): MailMessage[] {
  return messages.filter((msg) => msg.receivedAt >= from && msg.receivedAt <= to);
}
