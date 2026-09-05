import { describe, it, expect } from 'vitest';
import {
  searchMessages,
  groupByThread,
  getUnreadCount,
  filterByDateRange,
} from '../engine/search';
import type { MailMessage } from '../types';

function makeMessage(overrides: Partial<MailMessage> = {}): MailMessage {
  return {
    id: 'msg-1',
    accountId: 'acc-1',
    subject: 'Test Subject',
    from: 'sender@example.com',
    to: ['recipient@example.com'],
    body: 'This is the message body.',
    isRead: false,
    isStarred: false,
    folder: 'Inbox',
    receivedAt: '2026-03-05T10:00:00Z',
    createdAt: '2026-03-05T10:00:00Z',
    ...overrides,
  };
}

describe('searchMessages', () => {
  const messages = [
    makeMessage({ id: '1', subject: 'Meeting tomorrow', from: 'boss@work.com', body: 'Discuss Q1 results' }),
    makeMessage({ id: '2', subject: 'Lunch plans', from: 'friend@social.com', body: 'Want to grab sushi?' }),
    makeMessage({ id: '3', subject: 'Invoice #1234', from: 'billing@vendor.com', body: 'Your invoice is attached' }),
    makeMessage({ id: '4', subject: 'Newsletter', from: 'news@updates.com', body: 'Weekly tech roundup' }),
  ];

  it('returns all messages for empty query', () => {
    expect(searchMessages(messages, '')).toHaveLength(4);
    expect(searchMessages(messages, '   ')).toHaveLength(4);
  });

  it('searches by subject', () => {
    const results = searchMessages(messages, 'meeting');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('1');
  });

  it('searches by from field', () => {
    const results = searchMessages(messages, 'billing@vendor');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('3');
  });

  it('searches by body content', () => {
    const results = searchMessages(messages, 'sushi');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('2');
  });

  it('is case-insensitive', () => {
    expect(searchMessages(messages, 'INVOICE')).toHaveLength(1);
    expect(searchMessages(messages, 'invoice')).toHaveLength(1);
  });

  it('returns empty array when no matches', () => {
    expect(searchMessages(messages, 'nonexistent')).toHaveLength(0);
  });

  it('matches across multiple fields', () => {
    // "weekly" is in the body of message 4 ("Weekly tech roundup")
    const results = searchMessages(messages, 'weekly');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('4');
  });
});

describe('groupByThread', () => {
  it('groups messages with same subject', () => {
    const messages = [
      makeMessage({ id: '1', subject: 'Project Update' }),
      makeMessage({ id: '2', subject: 'Project Update' }),
      makeMessage({ id: '3', subject: 'Different Topic' }),
    ];
    const threads = groupByThread(messages);
    expect(threads.size).toBe(2);
    expect(threads.get('project update')).toHaveLength(2);
    expect(threads.get('different topic')).toHaveLength(1);
  });

  it('strips Re: prefix to group replies together', () => {
    const messages = [
      makeMessage({ id: '1', subject: 'Quarterly Report' }),
      makeMessage({ id: '2', subject: 'Re: Quarterly Report' }),
      makeMessage({ id: '3', subject: 'Re: Re: Quarterly Report' }),
    ];
    const threads = groupByThread(messages);
    expect(threads.size).toBe(1);
    const thread = threads.get('quarterly report');
    expect(thread).toHaveLength(3);
  });

  it('strips Fwd: and FW: prefixes', () => {
    const messages = [
      makeMessage({ id: '1', subject: 'Important Doc' }),
      makeMessage({ id: '2', subject: 'Fwd: Important Doc' }),
      makeMessage({ id: '3', subject: 'FW: Important Doc' }),
    ];
    const threads = groupByThread(messages);
    expect(threads.size).toBe(1);
    expect(threads.get('important doc')).toHaveLength(3);
  });

  it('handles mixed Re: and Fwd: prefixes', () => {
    const messages = [
      makeMessage({ id: '1', subject: 'Action Items' }),
      makeMessage({ id: '2', subject: 'Re: Action Items' }),
      makeMessage({ id: '3', subject: 'Fwd: Re: Action Items' }),
    ];
    const threads = groupByThread(messages);
    expect(threads.size).toBe(1);
  });

  it('returns empty map for empty input', () => {
    expect(groupByThread([]).size).toBe(0);
  });
});

describe('getUnreadCount', () => {
  it('counts unread messages', () => {
    const messages = [
      makeMessage({ id: '1', isRead: false }),
      makeMessage({ id: '2', isRead: true }),
      makeMessage({ id: '3', isRead: false }),
      makeMessage({ id: '4', isRead: true }),
    ];
    expect(getUnreadCount(messages)).toBe(2);
  });

  it('returns 0 when all are read', () => {
    const messages = [
      makeMessage({ id: '1', isRead: true }),
      makeMessage({ id: '2', isRead: true }),
    ];
    expect(getUnreadCount(messages)).toBe(0);
  });

  it('returns total count when none are read', () => {
    const messages = [
      makeMessage({ id: '1', isRead: false }),
      makeMessage({ id: '2', isRead: false }),
    ];
    expect(getUnreadCount(messages)).toBe(2);
  });

  it('returns 0 for empty array', () => {
    expect(getUnreadCount([])).toBe(0);
  });
});

describe('filterByDateRange', () => {
  const messages = [
    makeMessage({ id: '1', receivedAt: '2026-03-01T08:00:00Z' }),
    makeMessage({ id: '2', receivedAt: '2026-03-03T12:00:00Z' }),
    makeMessage({ id: '3', receivedAt: '2026-03-05T16:00:00Z' }),
    makeMessage({ id: '4', receivedAt: '2026-03-07T20:00:00Z' }),
  ];

  it('filters messages within date range', () => {
    const results = filterByDateRange(messages, '2026-03-02T00:00:00Z', '2026-03-06T00:00:00Z');
    expect(results).toHaveLength(2);
    expect(results[0].id).toBe('2');
    expect(results[1].id).toBe('3');
  });

  it('includes boundary dates', () => {
    const results = filterByDateRange(messages, '2026-03-01T08:00:00Z', '2026-03-07T20:00:00Z');
    expect(results).toHaveLength(4);
  });

  it('returns empty array when no messages in range', () => {
    const results = filterByDateRange(messages, '2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z');
    expect(results).toHaveLength(0);
  });

  it('works with single-day range', () => {
    const results = filterByDateRange(messages, '2026-03-03T00:00:00Z', '2026-03-03T23:59:59Z');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('2');
  });
});
