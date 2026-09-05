// Plan 30 Phase 1: the pure decision logic behind the shared chat kit.
//
// Mobile vitest is Node-only, so every branch worth testing lives here as a
// pure function (no React, no native, no provider) and the .tsx components are
// thin shells that call these. Kept provider-agnostic on purpose: the kit is
// props-only (Design Decision 7), and Plan 21's DM threads pass DM-shaped items
// through the same functions.

/** The minimum a message needs for grouping + day/unread dividers. */
export interface GroupableChatMessage {
  id: string;
  /** Author device id: drives grouping and (via the caller) right/left alignment. */
  authorId: string;
  /** ISO wall-clock timestamp of the event's HLC. */
  wall: string;
}

/** A reply-context snippet resolved by the caller from a trusted-local source. */
export interface ChatKitReplyContext {
  targetId: string;
  authorName: string;
  snippet: string;
}

/** The normalized message shape MessageBubble renders (extends the groupable core). */
export interface ChatKitMessage extends GroupableChatMessage {
  isMine: boolean;
  body: string;
  status: 'sent' | 'sending' | 'failed';
  /** True when this event supersedes a prior one and is not a deletion. */
  edited: boolean;
  /** Honest failure copy for a failed local send. */
  errorText?: string | null;
  replyTo?: ChatKitReplyContext | null;
  /**
   * Plan 56 feature 6: the author's chosen name color as a CLOSED palette
   * token ('accent' | 'success' | 'warning' | 'danger' | 'info'), resolved by
   * the host from a signature-verified v3 profile. Display sugar only: the
   * bubble maps it to the active palette; an unknown token renders default.
   */
  authorNameColorToken?: string | null;
  /**
   * Plan 56 feature 4: the author's ROLE bubble shape as a closed token
   * ('rounded' | 'square' | 'pill'), resolved by the host from the community
   * theme's bubbleShapesByRole. Display sugar; unknown tokens fall through to
   * the community-wide bubble radius.
   */
  authorBubbleShape?: string | null;
}

/**
 * Structurally identical to community-core's MessageReactionGroup. Declared here
 * so the kit imports no data module and stays purely prop-driven; the channel
 * screen passes MessageReactionGroup[] straight in (structural typing).
 */
export interface KitReactionGroup {
  emoji: string;
  count: number;
  mine: boolean;
  myEventId: string | null;
  /**
   * Plan 56 feature 5: when `emoji` is a pack token (mkpack:...), the host
   * resolves how it renders HERE: a unicode glyph, a decrypted image data
   * URI, or the honest :slug: fallback while the pack has not arrived.
   * Absent on plain emoji groups.
   */
  displayGlyph?: string;
  displayImageUri?: string | null;
  displayLabel?: string;
}

/**
 * Plan 56 feature 12: one sticker stuck over a message. Every field derives
 * from a VERIFIED signed canvas node on the channel's thread_overlay canvas;
 * receiver dials (muted authors, member decorations) are applied by the host
 * BEFORE these reach the kit. imageUri is the locally decrypted pack image,
 * null while its blocks have not arrived (the glyph/label renders instead).
 */
export interface KitSticker {
  nodeId: string;
  emoji: string | null;
  imageUri: string | null;
  x: number;
  y: number;
  rotation: number;
  mine: boolean;
  removable: boolean;
}

/** One rendered row in the message list: a message or a divider. */
export type ChatListRow<T extends GroupableChatMessage = ChatKitMessage> =
  | { type: 'day'; key: string; label: string }
  | { type: 'unread'; key: string }
  | { type: 'message'; key: string; item: T; isGroupStart: boolean; isGroupEnd: boolean };

export interface BuildRowsOptions {
  /** Id of the first unread message; a new-messages divider renders above it. */
  firstUnreadId?: string | null;
  /** Reference time for the day labels (defaults to Date.now()). */
  now?: number;
  /** Max gap that still groups two same-author messages (defaults to 5 min). */
  groupWindowMs?: number;
}

const DEFAULT_GROUP_WINDOW_MS = 5 * 60 * 1000;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// A local-calendar day index (days since epoch, using the runtime's timezone).
// Local, not UTC, so "Today"/"Yesterday" and the day dividers match the local
// time labels the bubbles render.
function localDayIndex(t: number): number {
  const d = new Date(t);
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
}

const EPOCH_ISO = new Date(0).toISOString();

// An unparseable wall collapses to epoch 0 (a single, stable divider bucket)
// rather than NaN, which would compare unequal to everything and spray a blank
// day divider before every such row.
function safeTime(wall: string): number {
  const parsed = Date.parse(wall);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** "Today" / "Yesterday" / "January 9, 2026" for a day divider (T1.3). */
export function dayDividerLabel(wall: string, now: number): string {
  const t = Date.parse(wall);
  if (Number.isNaN(t)) return '';
  const diff = localDayIndex(now) - localDayIndex(t);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  const d = new Date(t);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/**
 * Build the ordered render rows for the message list (T1.3): a day divider
 * whenever the calendar day changes (and above the first message), a
 * new-messages divider above the first unread, and per-message group flags.
 * Two messages group when they share an author, sit within groupWindowMs, and
 * have no divider between them. Input is sorted by wall time (stable) so
 * out-of-order arrivals still render chronologically; the caller inverts the
 * list for the FlatList.
 */
export function buildMessageRows<T extends GroupableChatMessage>(
  items: readonly T[],
  options: BuildRowsOptions = {},
): Array<ChatListRow<T>> {
  const now = options.now ?? Date.now();
  const groupWindowMs = options.groupWindowMs ?? DEFAULT_GROUP_WINDOW_MS;
  const firstUnreadId = options.firstUnreadId ?? null;

  const sorted = items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const wa = safeTime(a.item.wall);
      const wb = safeTime(b.item.wall);
      if (wa !== wb) return wa - wb;
      return a.index - b.index;
    })
    .map((entry) => entry.item);

  const rows: Array<ChatListRow<T>> = [];
  const messageRowIndices: number[] = [];
  let prevDayIndex: number | null = null;
  let prevAuthor: string | null = null;
  let prevWall: number | null = null;

  for (const item of sorted) {
    const t = safeTime(item.wall);
    const safeWall = Number.isNaN(Date.parse(item.wall)) ? EPOCH_ISO : item.wall;
    const dayIndex = localDayIndex(t);
    let dividerBefore = false;

    if (prevDayIndex === null || dayIndex !== prevDayIndex) {
      rows.push({ type: 'day', key: `day-${item.id}`, label: dayDividerLabel(safeWall, now) });
      dividerBefore = true;
    }
    if (firstUnreadId && item.id === firstUnreadId) {
      rows.push({ type: 'unread', key: `unread-${item.id}` });
      dividerBefore = true;
    }

    const isGroupStart =
      dividerBefore
      || prevAuthor === null
      || item.authorId !== prevAuthor
      || (prevWall !== null && t - prevWall >= groupWindowMs);

    rows.push({ type: 'message', key: `msg-${item.id}`, item, isGroupStart, isGroupEnd: true });
    messageRowIndices.push(rows.length - 1);

    prevDayIndex = dayIndex;
    prevAuthor = item.authorId;
    prevWall = t;
  }

  // Second pass: a message ends its group when the next message starts one.
  for (let i = 0; i < messageRowIndices.length; i++) {
    const row = rows[messageRowIndices[i]];
    if (row.type !== 'message') continue;
    const nextIndex = messageRowIndices[i + 1];
    if (nextIndex === undefined) {
      row.isGroupEnd = true;
      continue;
    }
    const nextRow = rows[nextIndex];
    row.isGroupEnd = nextRow.type === 'message' ? nextRow.isGroupStart : true;
  }

  return rows;
}

/**
 * Spec (TC-2) name for the grouping pass. buildMessageRows already implements
 * "same author + < groupWindowMs gap + no divider between = one group" alongside
 * the divider rows, so this is a stable alias downstream plans can grep for.
 */
export const groupMessages = buildMessageRows;

/**
 * A deterministic 12-hour clock label (e.g. "3:07 PM") built from local
 * getHours/getMinutes, NOT toLocaleTimeString: Hermes may ignore the options bag
 * and render a wrong or 24-hour string, so this hand-rolls the format the same
 * way dayDividerLabel hand-rolls the date. An unparseable wall renders "".
 */
export function formatClockTime(wall: string): string {
  const d = new Date(wall);
  if (Number.isNaN(d.getTime())) return '';
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const meridiem = hours < 12 ? 'AM' : 'PM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${hours}:${String(minutes).padStart(2, '0')} ${meridiem}`;
}

export interface MentionCandidate {
  deviceId: string;
  name: string;
}

/** The active @mention token ending at the cursor, or null (T1.6). */
export interface MentionQuery {
  query: string;
  /** Index of the '@'. */
  start: number;
  /** The cursor position (exclusive end of the token). */
  end: number;
}

const MAX_MENTION_QUERY = 40;

/**
 * Detect an @mention token immediately before the cursor. The '@' must sit at
 * the start of the text or follow whitespace (so email-like "a@b" is ignored),
 * and the token runs from the '@' to the cursor with NO whitespace and no second
 * '@'. Stopping at whitespace means a space after a chosen name commits the
 * mention and closes the popup (multi-word names still match by any substring of
 * the typed run). An empty token (bare "@") is valid and lists everyone.
 */
export function detectMentionQuery(text: string, cursor: number): MentionQuery | null {
  if (cursor < 1 || cursor > text.length) return null;
  const at = text.slice(0, cursor).lastIndexOf('@');
  if (at === -1) return null;
  const before = at === 0 ? '' : text[at - 1];
  if (before !== '' && !/\s/.test(before)) return null;
  const token = text.slice(at + 1, cursor);
  if (/[\s@]/.test(token)) return null;
  if (token.length > MAX_MENTION_QUERY) return null;
  return { query: token, start: at, end: cursor };
}

/**
 * Filter mention candidates by a case-insensitive substring match, ranking
 * name-prefix matches ahead of interior matches (both stable). An empty query
 * returns everyone.
 */
export function filterMentionCandidates(
  candidates: readonly MentionCandidate[],
  query: string,
): MentionCandidate[] {
  const q = query.trim().toLowerCase();
  if (q === '') return [...candidates];
  const prefix: MentionCandidate[] = [];
  const interior: MentionCandidate[] = [];
  for (const candidate of candidates) {
    const name = candidate.name.toLowerCase();
    if (!name.includes(q)) continue;
    if (name.startsWith(q)) prefix.push(candidate);
    else interior.push(candidate);
  }
  return [...prefix, ...interior];
}

/**
 * Replace the detected @token with the selected display name and report the
 * deviceId to append to the signed mentions array. A trailing space is added so
 * the caret lands past the committed name (closing the popup), UNLESS the next
 * character is already whitespace, in which case the existing space is reused
 * (no double space) and the caret is placed just past it. The mention is display
 * sugar in the body; the identity lives in the signed mentions field (Design
 * Decision 6).
 */
export function applyMentionSelection(
  text: string,
  range: { start: number; end: number },
  candidate: MentionCandidate,
): { text: string; cursor: number; mentionDeviceId: string } {
  const nextChar = text[range.end];
  const nextIsSpace = nextChar !== undefined && /\s/.test(nextChar);
  const core = `@${candidate.name}`;
  const replacement = nextIsSpace ? core : `${core} `;
  const next = text.slice(0, range.start) + replacement + text.slice(range.end);
  // When reusing an existing space, step the caret past it so the run between
  // the '@' and the caret contains whitespace and the mention popup stays closed.
  const cursor = range.start + replacement.length + (nextIsSpace ? 1 : 0);
  return { text: next, cursor, mentionDeviceId: candidate.deviceId };
}

// A name occurrence in the body counts only if it is bounded on both sides
// (start/whitespace before the '@', end/whitespace after the name), so a removed
// mention whose name is a prefix of another ("Al" vs "Alice") is NOT re-signed.
function bodyMentionsName(body: string, name: string): boolean {
  const needle = `@${name}`;
  let from = 0;
  for (;;) {
    const idx = body.indexOf(needle, from);
    if (idx === -1) return false;
    const beforeOk = idx === 0 || /\s/.test(body[idx - 1]);
    const after = body[idx + needle.length];
    const afterOk = after === undefined || /\s/.test(after);
    if (beforeOk && afterOk) return true;
    from = idx + 1;
  }
}

/**
 * The honest signed-mentions array for a send: from the candidates the user
 * picked, keep only those whose display name still appears as a bounded @token
 * in the final body, deduped by deviceId. This is the second half of the mention
 * guarantee, ensuring the signed mentions match the visible text even after the
 * user deletes a mention whose name is a prefix of another.
 */
export function resolveSignedMentions(
  body: string,
  accrued: readonly MentionCandidate[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const candidate of accrued) {
    if (seen.has(candidate.deviceId)) continue;
    if (!bodyMentionsName(body, candidate.name)) continue;
    seen.add(candidate.deviceId);
    out.push(candidate.deviceId);
  }
  return out;
}

/** One rendered body segment: plain text, or a highlighted @mention token. */
export interface BodySegment {
  text: string;
  mention: boolean;
}

/**
 * Split a body into plain + @mention segments for the render-pass highlight
 * (Plan 30 T2.2). A name matches only as a bounded `@name` token (start or
 * whitespace before the '@', end or whitespace after the name), longest name
 * first so "@Alice" wins over "@Al". This is display sugar over the visible text;
 * the signed identity lives in the event's mentions array, never here. Returns a
 * single plain segment when there is nothing to highlight.
 */
export function segmentBodyMentions(
  body: string,
  names: readonly string[],
): BodySegment[] {
  if (body.length === 0 || names.length === 0) return [{ text: body, mention: false }];
  const needles = Array.from(new Set(names.filter((name) => name.length > 0)))
    .map((name) => `@${name}`)
    .sort((a, b) => b.length - a.length);
  if (needles.length === 0) return [{ text: body, mention: false }];

  const segments: BodySegment[] = [];
  let plainStart = 0;
  let i = 0;
  while (i < body.length) {
    let matched: string | null = null;
    if (body[i] === '@' && (i === 0 || /\s/.test(body[i - 1]))) {
      for (const needle of needles) {
        if (!body.startsWith(needle, i)) continue;
        const after = body[i + needle.length];
        if (after === undefined || /\s/.test(after)) {
          matched = needle;
          break;
        }
      }
    }
    if (matched) {
      if (plainStart < i) segments.push({ text: body.slice(plainStart, i), mention: false });
      segments.push({ text: matched, mention: true });
      i += matched.length;
      plainStart = i;
    } else {
      i += 1;
    }
  }
  if (plainStart < body.length) segments.push({ text: body.slice(plainStart), mention: false });
  return segments.length > 0 ? segments : [{ text: body, mention: false }];
}

export type ReactionTapAction =
  | { action: 'add'; emoji: string }
  | { action: 'remove'; myEventId: string };

/**
 * Decide what a reaction tap does (T1.2 toggle): tapping an emoji this device
 * already holds removes it (via the stored reaction event id); tapping any other
 * emoji adds it. Fail-safe to add when the "mine" flag lacks an event id, and
 * when the reactions list is missing or empty.
 */
export function resolveReactionTap(
  reactions: readonly KitReactionGroup[] | null | undefined,
  emoji: string,
): ReactionTapAction {
  const group = reactions?.find((g) => g.emoji === emoji);
  if (group && group.mine && group.myEventId) {
    return { action: 'remove', myEventId: group.myEventId };
  }
  return { action: 'add', emoji };
}

/** A one-shot latch so a same-frame double-tap on Send fires onSend exactly once. */
export interface SendLatch {
  /** Returns true and locks on the first call; false while locked. */
  tryAcquire(): boolean;
  /** Unlocks so the next send can proceed. */
  release(): void;
}

export function createSendLatch(): SendLatch {
  let locked = false;
  return {
    tryAcquire() {
      if (locked) return false;
      locked = true;
      return true;
    },
    release() {
      locked = false;
    },
  };
}
