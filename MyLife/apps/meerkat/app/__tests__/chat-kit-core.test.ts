// Plan 30 Phase 1 (T1.2-T1.6): pure logic behind the shared chat kit.
//
// Mobile vitest is Node-only (no React render harness), so every testable
// decision in the kit lives in components/chat/chat-kit-core.ts and is proven
// here: message grouping + dividers, day labels, @mention detect/filter/insert,
// the reaction-chip toggle decision, and the emoji-catalog search filter. The
// .tsx components are thin, props-only shells over these functions.

import { describe, it, expect } from 'vitest';
import {
  buildMessageRows,
  groupMessages,
  dayDividerLabel,
  formatClockTime,
  detectMentionQuery,
  filterMentionCandidates,
  applyMentionSelection,
  resolveSignedMentions,
  resolveReactionTap,
  createSendLatch,
  type ChatListRow,
  type GroupableChatMessage,
  type KitReactionGroup,
  type MentionCandidate,
} from '../(root)/components/chat/chat-kit-core';
import {
  QUICK_REACTIONS,
  EMOJI_CATALOG,
  searchEmojiCatalog,
  type EmojiCategory,
  type EmojiEntry,
} from '../(root)/components/chat/emoji-data';

type Row = ChatListRow<GroupableChatMessage>;

// Build a wall ISO string relative to a base, in local time, so the day-boundary
// tests are timezone-agnostic (the function derives calendar days in local time,
// matching the runtime that renders the time labels).
function wallAt(base: Date, opts: { addDays?: number; addMinutes?: number } = {}): string {
  const d = new Date(base.getTime());
  if (opts.addDays) d.setDate(d.getDate() + opts.addDays);
  if (opts.addMinutes) d.setMinutes(d.getMinutes() + opts.addMinutes);
  return d.toISOString();
}

function msg(id: string, authorId: string, wall: string): GroupableChatMessage {
  return { id, authorId, wall };
}

describe('buildMessageRows (T1.3 grouping + dividers)', () => {
  const noon = new Date();
  noon.setHours(12, 0, 0, 0);

  it('groups consecutive same-author messages within the 5 min window', () => {
    const rows = buildMessageRows([
      msg('a', 'alice', wallAt(noon)),
      msg('b', 'alice', wallAt(noon, { addMinutes: 2 })),
      msg('c', 'alice', wallAt(noon, { addMinutes: 3 })),
    ], { now: noon.getTime() });

    const messageRows = rows.filter((r: Row) => r.type === 'message');
    expect(messageRows).toHaveLength(3);
    // First message starts the group; only the last ends it.
    expect(messageRows[0]).toMatchObject({ isGroupStart: true, isGroupEnd: false });
    expect(messageRows[1]).toMatchObject({ isGroupStart: false, isGroupEnd: false });
    expect(messageRows[2]).toMatchObject({ isGroupStart: false, isGroupEnd: true });
  });

  it('breaks a group when the author changes', () => {
    const rows = buildMessageRows([
      msg('a', 'alice', wallAt(noon)),
      msg('b', 'bob', wallAt(noon, { addMinutes: 1 })),
    ], { now: noon.getTime() });
    const messageRows = rows.filter((r: Row) => r.type === 'message');
    expect(messageRows[0]).toMatchObject({ isGroupStart: true, isGroupEnd: true });
    expect(messageRows[1]).toMatchObject({ isGroupStart: true, isGroupEnd: true });
  });

  it('breaks a group when the gap is 5 minutes or more', () => {
    const rows = buildMessageRows([
      msg('a', 'alice', wallAt(noon)),
      msg('b', 'alice', wallAt(noon, { addMinutes: 6 })),
    ], { now: noon.getTime() });
    const messageRows = rows.filter((r: Row) => r.type === 'message');
    expect(messageRows[0]).toMatchObject({ isGroupStart: true, isGroupEnd: true });
    expect(messageRows[1]).toMatchObject({ isGroupStart: true, isGroupEnd: true });
  });

  it('groups at 4m59s and breaks at exactly 5m00s (exact boundary)', () => {
    const base = noon.getTime();
    const at = (ms: number): string => new Date(base + ms).toISOString();

    const grouped = buildMessageRows([
      { id: 'a', authorId: 'alice', wall: at(0) },
      { id: 'b', authorId: 'alice', wall: at(4 * 60_000 + 59_000) },
    ], { now: base }).filter((r: Row) => r.type === 'message');
    expect(grouped[1]).toMatchObject({ isGroupStart: false });

    const broken = buildMessageRows([
      { id: 'a', authorId: 'alice', wall: at(0) },
      { id: 'b', authorId: 'alice', wall: at(5 * 60_000) },
    ], { now: base }).filter((r: Row) => r.type === 'message');
    expect(broken[1]).toMatchObject({ isGroupStart: true });
  });

  it('groupMessages is the exact same function (spec TC-2 alias)', () => {
    expect(groupMessages).toBe(buildMessageRows);
  });

  it('treats an unparseable wall as epoch 0 without per-row blank dividers', () => {
    const rows = buildMessageRows([
      { id: 'x', authorId: 'alice', wall: 'not-a-date' },
      { id: 'y', authorId: 'alice', wall: 'also-bad' },
    ], { now: noon.getTime() });
    const dayDividers = rows.filter((r: Row) => r.type === 'day');
    expect(dayDividers).toHaveLength(1);
    const label = dayDividers[0].type === 'day' ? dayDividers[0].label : '';
    expect(label.length).toBeGreaterThan(0);
  });

  it('inserts a day divider on a calendar-day change and breaks the group', () => {
    const rows = buildMessageRows([
      msg('a', 'alice', wallAt(noon, { addDays: -1 })),
      msg('b', 'alice', wallAt(noon)),
    ], { now: noon.getTime() });
    const dayDividers = rows.filter((r: Row) => r.type === 'day');
    // One divider above the first message (its day) + one on the day change.
    expect(dayDividers).toHaveLength(2);
    const messageRows = rows.filter((r: Row) => r.type === 'message');
    expect(messageRows[1]).toMatchObject({ isGroupStart: true });
    // The second message is immediately preceded by its day divider.
    const idxDivider = rows.findIndex((r: Row) => r.type === 'day' && r === dayDividers[1]);
    expect(rows[idxDivider + 1]).toMatchObject({ type: 'message', key: expect.stringContaining('b') });
  });

  it('inserts a new-messages divider before the first unread and starts a group there', () => {
    const rows = buildMessageRows([
      msg('a', 'alice', wallAt(noon)),
      msg('b', 'alice', wallAt(noon, { addMinutes: 1 })),
      msg('c', 'alice', wallAt(noon, { addMinutes: 2 })),
    ], { now: noon.getTime(), firstUnreadId: 'b' });
    const unread = rows.filter((r: Row) => r.type === 'unread');
    expect(unread).toHaveLength(1);
    const idx = rows.findIndex((r: Row) => r.type === 'unread');
    expect(rows[idx + 1]).toMatchObject({ type: 'message', key: expect.stringContaining('b'), isGroupStart: true });
    // The message before the divider closes its group.
    const before = rows[idx - 1];
    expect(before).toMatchObject({ type: 'message', isGroupEnd: true });
  });

  it('sorts out-of-order input by wall time (stable)', () => {
    const rows = buildMessageRows([
      msg('b', 'alice', wallAt(noon, { addMinutes: 2 })),
      msg('a', 'alice', wallAt(noon)),
    ], { now: noon.getTime() });
    const messageRows = rows.filter((r: Row) => r.type === 'message');
    expect(messageRows.map((r: Row) => (r.type === 'message' ? r.item.id : ''))).toEqual(['a', 'b']);
  });

  it('returns no rows for an empty list', () => {
    expect(buildMessageRows([], { now: noon.getTime() })).toEqual([]);
  });
});

describe('dayDividerLabel (T1.3)', () => {
  it('labels the current day Today', () => {
    const now = new Date();
    now.setHours(12, 0, 0, 0);
    expect(dayDividerLabel(wallAt(now, { addMinutes: -30 }), now.getTime())).toBe('Today');
  });

  it('labels the prior day Yesterday', () => {
    const now = new Date();
    now.setHours(12, 0, 0, 0);
    expect(dayDividerLabel(wallAt(now, { addDays: -1 }), now.getTime())).toBe('Yesterday');
  });

  it('labels older days with an absolute month, day, and year', () => {
    const now = new Date();
    now.setFullYear(2026, 6, 3); // 2026-07-03
    now.setHours(12, 0, 0, 0);
    const old = new Date(now.getTime());
    old.setFullYear(2026, 0, 9); // 2026-01-09
    old.setHours(9, 0, 0, 0);
    const label = dayDividerLabel(old.toISOString(), now.getTime());
    expect(label).toContain('January');
    expect(label).toContain('9');
    expect(label).toContain('2026');
  });
});

describe('formatClockTime (deterministic, Hermes-safe)', () => {
  it('formats 12-hour time with AM/PM from local time', () => {
    const d = new Date();
    d.setHours(15, 7, 0, 0);
    expect(formatClockTime(d.toISOString())).toBe('3:07 PM');
    d.setHours(0, 5, 0, 0);
    expect(formatClockTime(d.toISOString())).toBe('12:05 AM');
    d.setHours(12, 0, 0, 0);
    expect(formatClockTime(d.toISOString())).toBe('12:00 PM');
  });

  it('returns empty string for an unparseable wall', () => {
    expect(formatClockTime('nope')).toBe('');
  });
});

describe('detectMentionQuery (T1.6)', () => {
  it('detects an @ token at the cursor', () => {
    const text = 'hey @al';
    expect(detectMentionQuery(text, text.length)).toEqual({ query: 'al', start: 4, end: 7 });
  });

  it('detects a bare @ (empty query lists everyone)', () => {
    const text = 'hi @';
    expect(detectMentionQuery(text, text.length)).toEqual({ query: '', start: 3, end: 4 });
  });

  it('closes (returns null) once a space follows the token, committing the mention', () => {
    // A space after the chosen name ends the mention run, so the popup closes.
    expect(detectMentionQuery('@john sm', 8)).toBeNull();
    // Before the space, the run is still an active query.
    expect(detectMentionQuery('@john', 5)).toEqual({ query: 'john', start: 0, end: 5 });
  });

  it('returns null when @ is mid-word (email-like)', () => {
    expect(detectMentionQuery('mail me at a@b', 14)).toBeNull();
  });

  it('returns null when there is no @ before the cursor', () => {
    expect(detectMentionQuery('plain text', 5)).toBeNull();
  });

  it('returns null when a newline separates the @ from the cursor', () => {
    const text = '@alice\nmore';
    expect(detectMentionQuery(text, text.length)).toBeNull();
  });
});

describe('filterMentionCandidates (T1.6)', () => {
  const candidates = [
    { deviceId: 'd1', name: 'Alice' },
    { deviceId: 'd2', name: 'Bob' },
    { deviceId: 'd3', name: 'Alicia' },
    { deviceId: 'd4', name: 'You as Carol' },
  ];

  it('returns everyone for an empty query', () => {
    expect(filterMentionCandidates(candidates, '')).toHaveLength(4);
  });

  it('matches case-insensitively by substring', () => {
    const out = filterMentionCandidates(candidates, 'ali');
    expect(out.map((c: MentionCandidate) => c.name)).toEqual(['Alice', 'Alicia']);
  });

  it('ranks prefix matches ahead of interior matches', () => {
    const out = filterMentionCandidates(candidates, 'carol');
    expect(out[0].name).toBe('You as Carol');
  });
});

describe('applyMentionSelection (T1.6)', () => {
  it('adds a trailing space when the mention lands at the end of the text', () => {
    const text = 'hi @a';
    const range = detectMentionQuery(text, text.length)!; // { start: 3, end: 5 }
    const out = applyMentionSelection(text, range, { deviceId: 'd1', name: 'Al' });
    expect(out.text).toBe('hi @Al ');
    expect(out.cursor).toBe('hi @Al '.length);
    expect(out.mentionDeviceId).toBe('d1');
  });

  it('reuses an existing following space (no double space) and steps past it', () => {
    const text = 'hey @al done';
    const range = detectMentionQuery('hey @al', 7)!; // { start: 4, end: 7 }, next char is a space
    const out = applyMentionSelection(text, range, { deviceId: 'd1', name: 'Alice' });
    expect(out.text).toBe('hey @Alice done');
    // Caret sits just past the reused space, so the run before it holds a space
    // and the mention popup stays closed.
    expect(out.cursor).toBe('hey @Alice '.length);
    expect(out.text[out.cursor]).toBe('d');
  });
});

describe('resolveSignedMentions (adversarial: prefix names)', () => {
  const al = { deviceId: 'dev-al', name: 'Al' };
  const alice = { deviceId: 'dev-alice', name: 'Alice' };

  it('does not re-sign a removed mention whose name prefixes another', () => {
    // The user picked both Al and Alice, then deleted "@Al"; only "@Alice" remains.
    const out = resolveSignedMentions('@Alice hi', [al, alice]);
    expect(out).toEqual(['dev-alice']);
  });

  it('signs a bounded name and dedupes by deviceId', () => {
    const out = resolveSignedMentions('@Al @Al ok', [al, al]);
    expect(out).toEqual(['dev-al']);
  });

  it('drops a name that is no longer present as a bounded token', () => {
    expect(resolveSignedMentions('nothing here', [alice])).toEqual([]);
    // Interior substring does not count (must be @-anchored and bounded).
    expect(resolveSignedMentions('email a@Alicexyz', [alice])).toEqual([]);
  });
});

describe('createSendLatch (adversarial: double-send)', () => {
  it('fires once until released, then allows the next send', () => {
    const latch = createSendLatch();
    expect(latch.tryAcquire()).toBe(true);  // first tap wins
    expect(latch.tryAcquire()).toBe(false); // same-frame second tap blocked
    expect(latch.tryAcquire()).toBe(false);
    latch.release();                         // value cleared / changed
    expect(latch.tryAcquire()).toBe(true);   // next send proceeds
  });
});

describe('resolveReactionTap (T1.2 toggle decision)', () => {
  const groups: KitReactionGroup[] = [
    { emoji: '❤️', count: 2, mine: true, myEventId: 'r-heart' },
    { emoji: '👍', count: 1, mine: false, myEventId: null },
  ];

  it('removes when I tap an emoji I already hold', () => {
    expect(resolveReactionTap(groups, '❤️')).toEqual({ action: 'remove', myEventId: 'r-heart' });
  });

  it('adds when I tap an emoji others hold but I do not', () => {
    expect(resolveReactionTap(groups, '👍')).toEqual({ action: 'add', emoji: '👍' });
  });

  it('adds when I tap a brand-new emoji', () => {
    expect(resolveReactionTap(groups, '🎉')).toEqual({ action: 'add', emoji: '🎉' });
  });

  it('adds when mine is true but the event id is missing (fail-safe)', () => {
    expect(resolveReactionTap([{ emoji: '😮', count: 1, mine: true, myEventId: null }], '😮'))
      .toEqual({ action: 'add', emoji: '😮' });
  });

  it('adds (never throws) when reactions is empty, null, or undefined', () => {
    expect(resolveReactionTap([], '❤️')).toEqual({ action: 'add', emoji: '❤️' });
    expect(resolveReactionTap(null, '❤️')).toEqual({ action: 'add', emoji: '❤️' });
    expect(resolveReactionTap(undefined, '❤️')).toEqual({ action: 'add', emoji: '❤️' });
  });
});

describe('emoji catalog (T1.1 + T1.5 search)', () => {
  it('locks the six quick reactions exactly', () => {
    expect(QUICK_REACTIONS).toEqual(['❤️', '👍', '😂', '😮', '😢', '🎉']);
  });

  it('ships a broad static catalog (~300 emoji) with keyworded entries', () => {
    const total = EMOJI_CATALOG.reduce((sum: number, cat: EmojiCategory) => sum + cat.emoji.length, 0);
    expect(total).toBeGreaterThanOrEqual(250);
    for (const cat of EMOJI_CATALOG) {
      expect(cat.emoji.length).toBeGreaterThan(0);
      for (const entry of cat.emoji) {
        expect(entry.char.length).toBeGreaterThan(0);
        expect(entry.name.length).toBeGreaterThan(0);
      }
    }
  });

  it('returns the full catalog for an empty query', () => {
    expect(searchEmojiCatalog(EMOJI_CATALOG, '')).toEqual(EMOJI_CATALOG);
  });

  it('filters by name and keyword, dropping empty categories', () => {
    const out = searchEmojiCatalog(EMOJI_CATALOG, 'heart');
    const chars = out.flatMap((cat: EmojiCategory) => cat.emoji.map((e: EmojiEntry) => e.char));
    expect(chars).toContain('❤️');
    // Every returned category has at least one match.
    for (const cat of out) expect(cat.emoji.length).toBeGreaterThan(0);
  });

  it('returns no categories for a nonsense query', () => {
    expect(searchEmojiCatalog(EMOJI_CATALOG, 'zzzznotanemoji')).toEqual([]);
  });
});
