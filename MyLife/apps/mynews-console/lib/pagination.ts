/**
 * Keyset pagination and search-term sanitising for the console queues
 * (plan 48 WP9). Pure and unit-tested.
 *
 * Keyset, not offset: these queues grow, and OFFSET both slows down linearly and
 * silently skips or repeats rows when something is inserted or resolved between
 * page loads. The cursor is the (created_at, id) tuple of the last row shown, so
 * page N+1 is always "strictly after what you already saw".
 *
 * Both functions here exist because PostgREST filters are built as query STRINGS.
 * supabase-js does not quote filter values, so a value containing a comma or a
 * parenthesis can break out of its filter and add another one. Every value that
 * reaches a filter goes through these validators first, and anything that does
 * not match is rejected rather than escaped: a cursor is machine-generated, and a
 * search term does not need punctuation.
 */

const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface KeysetCursor {
  createdAt: string;
  id: string;
}

/** Encode a cursor for a URL. Opaque to the operator, checked on the way back. */
export function encodeCursor(cursor: KeysetCursor): string {
  return Buffer.from(`${cursor.createdAt}|${cursor.id}`, 'utf8').toString('base64url');
}

/**
 * Decode a cursor, or null. Rejects anything that is not an ISO timestamp and a
 * UUID, so a hand-edited cursor cannot inject a PostgREST filter.
 */
export function decodeCursor(raw: string | null | undefined): KeysetCursor | null {
  if (!raw || typeof raw !== 'string' || raw.length > 200) return null;
  let decoded: string;
  try {
    decoded = Buffer.from(raw, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  const separator = decoded.lastIndexOf('|');
  if (separator <= 0) return null;
  const createdAt = decoded.slice(0, separator);
  const id = decoded.slice(separator + 1);
  if (!ISO_TIMESTAMP.test(createdAt) || !UUID.test(id)) return null;
  return { createdAt, id };
}

/**
 * The PostgREST `or` filter for "strictly before this cursor" on a
 * created_at-descending list. Values are already validated by decodeCursor.
 */
export function keysetBeforeFilter(
  cursor: KeysetCursor,
  column = 'created_at',
  idColumn = 'id',
): string {
  return (
    `${column}.lt.${cursor.createdAt},` +
    `and(${column}.eq.${cursor.createdAt},${idColumn}.lt.${cursor.id})`
  );
}

/** The same, for an ascending list (oldest-first queues). */
export function keysetAfterFilter(
  cursor: KeysetCursor,
  column = 'created_at',
  idColumn = 'id',
): string {
  return (
    `${column}.gt.${cursor.createdAt},` +
    `and(${column}.eq.${cursor.createdAt},${idColumn}.gt.${cursor.id})`
  );
}

export const SEARCH_MAX_CHARS = 100;

/**
 * Reduce an operator's search box to the characters the console actually searches
 * on: ids, handles, slugs, emails, reasons. Everything else is dropped rather
 * than escaped, which keeps the filter string unambiguous and means a search can
 * never widen a query.
 *
 * Returns null when nothing usable is left, and callers treat that as "no search"
 * rather than "match nothing", because an operator who typed only punctuation
 * meant to see the queue.
 */
export function sanitizeSearchTerm(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = raw
    .trim()
    .slice(0, SEARCH_MAX_CHARS)
    .replace(/[^A-Za-z0-9@._:/-]+/g, ' ')
    .trim();
  return cleaned.length === 0 ? null : cleaned;
}

/** True when a search term is a full UUID, which searches by exact id instead. */
export function isUuidSearch(term: string): boolean {
  return UUID.test(term);
}
