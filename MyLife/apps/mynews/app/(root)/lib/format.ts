// Presentation helpers. Pure and injectable so they unit-test cleanly.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/**
 * Compact relative time for feed and byline timestamps. Falls back to an
 * absolute date past a week. `now` is injectable for deterministic tests.
 */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const diff = now - then;
  if (diff < MINUTE) return 'just now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  if (diff < WEEK) return `${Math.floor(diff / DAY)}d ago`;
  return new Date(then).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Absolute date used in bylines and revision history rows. */
export function absoluteDate(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  return new Date(then).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** First 8 hex characters of an editor or author key, for compact credit lines. */
export function shortKey(key: string): string {
  return key.slice(0, 8);
}

/** Renders "@handle" once, tolerating handles that already carry the sigil. */
export function atHandle(handle: string): string {
  return handle.startsWith('@') ? handle : `@${handle}`;
}
