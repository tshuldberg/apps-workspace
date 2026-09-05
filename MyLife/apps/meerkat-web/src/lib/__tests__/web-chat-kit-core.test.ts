// Plan 30 Phase 4: the web twin of the mobile chat-kit-core tests. Proves the
// SHARED pure logic (grouping + dividers, mention detect/filter/insert/resolve,
// body highlight segments, reaction-tap toggle, send latch) behaves identically on
// the web build, so the two surfaces cannot drift.

import { describe, expect, it } from 'vitest';
import {
  applyMentionSelection,
  buildMessageRows,
  createSendLatch,
  detectMentionQuery,
  filterMentionCandidates,
  formatClockTime,
  resolveReactionTap,
  resolveSignedMentions,
  segmentBodyMentions,
  type GroupableChatMessage,
} from '../chat-kit-core';

function msg(id: string, authorId: string, wall: string): GroupableChatMessage {
  return { id, authorId, wall };
}

const T = (min: number): string => new Date(Date.UTC(2026, 0, 9, 12, min, 0)).toISOString();

describe('buildMessageRows grouping + dividers', () => {
  it('groups same-author messages within 5 minutes and breaks on author/gap', () => {
    const rows = buildMessageRows(
      [msg('a', 'alice', T(0)), msg('b', 'alice', T(2)), msg('c', 'bob', T(3)), msg('d', 'alice', T(20))],
      { now: Date.UTC(2026, 0, 9, 13, 0, 0) },
    );
    const messages = rows.filter((r) => r.type === 'message');
    const byId = new Map(messages.map((r) => [r.type === 'message' ? r.item.id : '', r]));
    const flag = (id: string): { start: boolean; end: boolean } => {
      const r = byId.get(id);
      return r && r.type === 'message' ? { start: r.isGroupStart, end: r.isGroupEnd } : { start: false, end: false };
    };
    expect(flag('a')).toEqual({ start: true, end: false });   // group starts
    expect(flag('b')).toEqual({ start: false, end: true });   // groups with a, ends (bob next)
    expect(flag('c')).toEqual({ start: true, end: true });    // author change
    expect(flag('d')).toEqual({ start: true, end: true });    // >5 min gap
  });

  it('renders a "new messages" unread divider immediately above the first unread (M1)', () => {
    // This is the exact wiring ChatMessageList uses: buildMessageRows(items,
    // { firstUnreadId }). Dropping the option (the M1 bug) would emit NO unread row.
    const rows = buildMessageRows(
      [msg('a', 'alice', T(0)), msg('b', 'alice', T(1)), msg('c', 'bob', T(2))],
      { firstUnreadId: 'c' },
    );
    const unreadRows = rows.filter((r) => r.type === 'unread');
    expect(unreadRows).toHaveLength(1); // exactly one divider
    const unreadIndex = rows.findIndex((r) => r.type === 'unread');
    const cIndex = rows.findIndex((r) => r.type === 'message' && r.item.id === 'c');
    expect(unreadIndex).toBe(cIndex - 1); // sits directly above the first unread
  });

  it('emits NO unread divider when firstUnreadId is omitted (proves the option is load-bearing)', () => {
    const rows = buildMessageRows([msg('a', 'alice', T(0)), msg('b', 'bob', T(1))]);
    expect(rows.some((r) => r.type === 'unread')).toBe(false);
  });

  it('sorts out-of-order arrivals by wall time (stable)', () => {
    const rows = buildMessageRows([msg('late', 'a', T(5)), msg('early', 'a', T(0))]);
    const order = rows.filter((r) => r.type === 'message').map((r) => (r.type === 'message' ? r.item.id : ''));
    expect(order).toEqual(['early', 'late']);
  });
});

describe('formatClockTime is deterministic', () => {
  it('formats a 12-hour clock with AM/PM', () => {
    expect(formatClockTime(new Date(2026, 0, 9, 15, 7, 0).toISOString())).toBe('3:07 PM');
    expect(formatClockTime(new Date(2026, 0, 9, 0, 5, 0).toISOString())).toBe('12:05 AM');
    expect(formatClockTime('not-a-date')).toBe('');
  });
});

describe('mention detect/filter/insert/resolve', () => {
  const candidates = [
    { deviceId: 'd-al', name: 'Al' },
    { deviceId: 'd-alice', name: 'Alice' },
    { deviceId: 'd-bob', name: 'Bob' },
  ];

  it('detects a bare @ and an @prefix but ignores email-like a@b', () => {
    expect(detectMentionQuery('@', 1)).toEqual({ query: '', start: 0, end: 1 });
    expect(detectMentionQuery('hi @al', 6)?.query).toBe('al');
    expect(detectMentionQuery('a@b', 3)).toBeNull();
  });

  it('filters prefix ahead of interior, empty returns everyone', () => {
    expect(filterMentionCandidates(candidates, '').map((c) => c.name)).toEqual(['Al', 'Alice', 'Bob']);
    expect(filterMentionCandidates(candidates, 'al').map((c) => c.name)).toEqual(['Al', 'Alice']);
  });

  it('inserts the picked name + a trailing space and reports the deviceId', () => {
    const applied = applyMentionSelection('hi @al', { start: 3, end: 6 }, candidates[1]!);
    expect(applied.text).toBe('hi @Alice ');
    expect(applied.mentionDeviceId).toBe('d-alice');
  });

  it('resolveSignedMentions keeps only names still present as a bounded token', () => {
    // "@Al" removed (deleted), "@Alice" kept: the prefix name must not re-sign.
    expect(resolveSignedMentions('hey @Alice', [candidates[0]!, candidates[1]!])).toEqual(['d-alice']);
  });

  it('segmentBodyMentions highlights the longest bounded @name', () => {
    const segments = segmentBodyMentions('hi @Alice ok', ['Al', 'Alice']);
    expect(segments.find((s) => s.mention)?.text).toBe('@Alice');
  });
});

describe('resolveReactionTap toggle + send latch', () => {
  it('removes an emoji this device holds and adds any other', () => {
    const groups = [{ emoji: '❤️', count: 1, mine: true, myEventId: 'ev1' }];
    expect(resolveReactionTap(groups, '❤️')).toEqual({ action: 'remove', myEventId: 'ev1' });
    expect(resolveReactionTap(groups, '👍')).toEqual({ action: 'add', emoji: '👍' });
    expect(resolveReactionTap(null, '🎉')).toEqual({ action: 'add', emoji: '🎉' });
  });

  it('the send latch fires once until released', () => {
    const latch = createSendLatch();
    expect(latch.tryAcquire()).toBe(true);
    expect(latch.tryAcquire()).toBe(false);
    latch.release();
    expect(latch.tryAcquire()).toBe(true);
  });
});
