import type { Game } from '../types';
import type { LeagueEvent } from './calendar';

/**
 * ICS calendar export helpers for MySports (P8-D).
 *
 * Pure TypeScript. No DB access, no fetch, no React imports, no `Date.now()`,
 * no persistence. Callers are responsible for delivering the ICS string to the
 * user (download link on web, Share sheet on mobile) in a follow-up card.
 *
 * RFC-5545 notes:
 *   - Line endings are CRLF.
 *   - DTSTART / DTEND emitted in UTC format `YYYYMMDDTHHMMSSZ`.
 *   - SUMMARY / DESCRIPTION / LOCATION escape backslashes, commas,
 *     semicolons, and newlines per spec.
 *   - Long lines are folded at 75 octets with `CRLF + space` continuation.
 *   - UIDs are stable across re-exports (derived from caller-supplied ids).
 *   - DTSTAMP is derived deterministically from each event's uid so the
 *     output is byte-stable across runs (no `Date.now()`).
 */

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

/** Default window applied to a `Game` when the caller does not supply an end time. */
export const DEFAULT_GAME_DURATION_MS = 3 * MS_PER_HOUR;

export interface IcsEventInput {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  startMs: number;
  endMs: number;
}

export interface SportsCalendarExportInput {
  games: readonly Game[];
  leagueEvents: readonly LeagueEvent[];
  /** Fallback duration applied to games without an explicit end. Defaults to 3 hours. */
  defaultGameDurationMs?: number;
}

/**
 * Escape a string for use in SUMMARY / DESCRIPTION / LOCATION per RFC 5545
 * section 3.3.11. Order matters: backslashes must be doubled before other
 * replacements introduce their own backslashes.
 */
function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n/g, '\\n')
    .replace(/\r/g, '\\n')
    .replace(/\n/g, '\\n');
}

/** Zero-pad a non-negative integer to at least `width` characters. */
function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/** Format an epoch-ms timestamp as `YYYYMMDDTHHMMSSZ` in UTC. */
function formatUtcStamp(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const mo = pad2(d.getUTCMonth() + 1);
  const da = pad2(d.getUTCDate());
  const h = pad2(d.getUTCHours());
  const mi = pad2(d.getUTCMinutes());
  const s = pad2(d.getUTCSeconds());
  return `${y}${mo}${da}T${h}${mi}${s}Z`;
}

/**
 * Fold a content line at 75 octets per RFC 5545 section 3.1. Continuation
 * lines begin with a single space. Uses UTF-8 byte counting via TextEncoder
 * so multi-byte characters do not split mid-sequence.
 */
function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const bytes = encoder.encode(line);
  if (bytes.length <= 75) return line;

  const parts: string[] = [];
  let offset = 0;
  let first = true;
  while (offset < bytes.length) {
    const budget = first ? 75 : 74;
    const end = Math.min(offset + budget, bytes.length);
    // Avoid splitting multi-byte UTF-8 by walking back to a safe boundary.
    let safeEnd = end;
    while (safeEnd > offset && safeEnd < bytes.length) {
      const byte = bytes[safeEnd];
      // Continuation bytes have form 10xxxxxx -- back off if we land on one.
      if (byte !== undefined && (byte & 0xc0) === 0x80) {
        safeEnd -= 1;
      } else {
        break;
      }
    }
    const chunk = bytes.slice(offset, safeEnd);
    const decoded = decoder.decode(chunk);
    parts.push(first ? decoded : ` ${decoded}`);
    first = false;
    offset = safeEnd;
  }
  return parts.join('\r\n');
}

/**
 * Deterministic 32-bit hash of a string. Used to derive a pseudo DTSTAMP
 * from an event uid without touching the real clock. The epoch offset below
 * is an arbitrary fixed base (2020-01-01T00:00:00Z) so stamps stay within
 * a plausible range. Two events with different uids produce different
 * stamps; the same uid always produces the same stamp.
 */
function hashString(input: string): number {
  let hash = 2_166_136_261; // FNV-1a offset basis
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16_777_619);
  }
  // Ensure unsigned 32-bit result.
  return hash >>> 0;
}

const DTSTAMP_EPOCH_MS = Date.UTC(2020, 0, 1, 0, 0, 0);

function dtstampFromUid(uid: string): string {
  // Spread hash value across ~ten years (10 * 365 * 86_400_000 ≈ 3.15e11 ms).
  // Using modulo on the hash keeps the stamp deterministic and well-formed.
  const offset = hashString(uid) % (10 * 365 * MS_PER_DAY);
  return formatUtcStamp(DTSTAMP_EPOCH_MS + offset);
}

/**
 * Convert a `Game` to an `IcsEventInput`. Games currently carry only a
 * `startAt` on the live type, so the caller-supplied (or default) duration
 * is applied for `endMs`. Summary follows the "Away @ Home" convention so
 * calendar clients surface the away side first.
 */
export function gameToIcsEvent(
  game: Game,
  defaultDurationMs: number = DEFAULT_GAME_DURATION_MS,
): IcsEventInput {
  const startMs = game.startAt;
  const endMs = startMs + defaultDurationMs;
  const summary = `${game.away.name} @ ${game.home.name}`;
  const input: IcsEventInput = {
    uid: `sports-game-${game.id}@mylife`,
    summary,
    startMs,
    endMs,
  };
  if (game.venue) {
    input.location = game.venue;
  }
  return input;
}

/**
 * Convert a `LeagueEvent` to an all-day ICS event. The start time is
 * normalized to 00:00 UTC of the calendar day containing `startMs`, and
 * the end time is exactly 24 hours later. This produces the kind of single-
 * day all-day block that calendar clients render without a time range.
 */
export function leagueEventToIcsEvent(evt: LeagueEvent): IcsEventInput {
  const startOfDay = Date.UTC(
    new Date(evt.startMs).getUTCFullYear(),
    new Date(evt.startMs).getUTCMonth(),
    new Date(evt.startMs).getUTCDate(),
  );
  const endOfDay = startOfDay + MS_PER_DAY;
  const input: IcsEventInput = {
    uid: `sports-event-${evt.leagueId}-${evt.eventType}-${startOfDay}@mylife`,
    summary: evt.label,
    startMs: startOfDay,
    endMs: endOfDay,
  };
  if (evt.notes) {
    input.description = evt.notes;
  }
  return input;
}

/**
 * Render a list of `IcsEventInput`s to a minimal RFC-5545 VCALENDAR
 * string. One VEVENT per input, DTSTAMP derived deterministically from
 * each uid, all lines folded at 75 octets, CRLF throughout.
 */
export function renderIcs(events: readonly IcsEventInput[]): string {
  const lines: string[] = [];
  lines.push('BEGIN:VCALENDAR');
  lines.push('VERSION:2.0');
  lines.push('PRODID:-//MyLife//MySports//EN');
  lines.push('CALSCALE:GREGORIAN');
  for (const evt of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${evt.uid}`);
    lines.push(`DTSTAMP:${dtstampFromUid(evt.uid)}`);
    lines.push(`DTSTART:${formatUtcStamp(evt.startMs)}`);
    lines.push(`DTEND:${formatUtcStamp(evt.endMs)}`);
    lines.push(`SUMMARY:${escapeIcsText(evt.summary)}`);
    if (evt.description) {
      lines.push(`DESCRIPTION:${escapeIcsText(evt.description)}`);
    }
    if (evt.location) {
      lines.push(`LOCATION:${escapeIcsText(evt.location)}`);
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

/**
 * Compose a full sports calendar: every game mapped via `gameToIcsEvent`
 * followed by every league event mapped via `leagueEventToIcsEvent`.
 * Event order is preserved so callers can control ordering by sorting
 * their inputs before invoking.
 */
export function buildSportsCalendar(input: SportsCalendarExportInput): string {
  const defaultDuration = input.defaultGameDurationMs ?? DEFAULT_GAME_DURATION_MS;
  const events: IcsEventInput[] = [];
  for (const game of input.games) {
    events.push(gameToIcsEvent(game, defaultDuration));
  }
  for (const evt of input.leagueEvents) {
    events.push(leagueEventToIcsEvent(evt));
  }
  return renderIcs(events);
}
