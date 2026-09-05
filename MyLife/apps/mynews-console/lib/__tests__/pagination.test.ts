import { describe, expect, it } from 'vitest';

import {
  SEARCH_MAX_CHARS,
  decodeCursor,
  encodeCursor,
  isUuidSearch,
  keysetAfterFilter,
  keysetBeforeFilter,
  sanitizeSearchTerm,
} from '../pagination';

/**
 * Keyset pagination and search sanitising (plan 48 WP9).
 *
 * The security-relevant half of this file is that cursor and search values reach
 * a PostgREST filter as part of a query STRING. supabase-js does not quote them,
 * so a value carrying a comma or a parenthesis could add a filter of its own.
 * Every "rejects" case below is that attack.
 */

const CURSOR = { createdAt: '2026-07-30T12:00:00.000000Z', id: 'ffffffff-1111-2222-3333-444444444444' };

describe('cursors', () => {
  it('round-trips', () => {
    expect(decodeCursor(encodeCursor(CURSOR))).toEqual(CURSOR);
  });

  it('accepts the timestamp shapes Postgres returns', () => {
    for (const createdAt of [
      '2026-07-30T12:00:00Z',
      '2026-07-30T12:00:00.5Z',
      '2026-07-30T12:00:00.123456Z',
      '2026-07-30T12:00:00+00:00',
      '2026-07-30T12:00:00.123456-07:00',
    ]) {
      expect(decodeCursor(encodeCursor({ ...CURSOR, createdAt }))).not.toBeNull();
    }
  });

  it.each([
    ['an empty value', ''],
    ['null', null],
    ['undefined', undefined],
    ['non-base64 junk', '!!!!'],
    ['a cursor with no separator', Buffer.from('nope', 'utf8').toString('base64url')],
    [
      'a non-timestamp first half',
      Buffer.from(`whenever|${CURSOR.id}`, 'utf8').toString('base64url'),
    ],
    [
      'a non-uuid second half',
      Buffer.from(`${CURSOR.createdAt}|not-a-uuid`, 'utf8').toString('base64url'),
    ],
    [
      'an injected extra filter in the id',
      Buffer.from(`${CURSOR.createdAt}|${CURSOR.id},status.eq.open`, 'utf8').toString('base64url'),
    ],
    [
      'an injected filter in the timestamp',
      Buffer.from(`2026-07-30T12:00:00Z),or(status.eq.actioned|${CURSOR.id}`, 'utf8').toString(
        'base64url',
      ),
    ],
    ['an absurdly long cursor', 'A'.repeat(400)],
  ])('rejects %s', (_label, value) => {
    expect(decodeCursor(value as string | null)).toBeNull();
  });

  it('builds a descending keyset filter with a tie-break on id', () => {
    expect(keysetBeforeFilter(CURSOR)).toBe(
      `created_at.lt.${CURSOR.createdAt},and(created_at.eq.${CURSOR.createdAt},id.lt.${CURSOR.id})`,
    );
  });

  it('builds an ascending keyset filter, with custom columns', () => {
    expect(keysetAfterFilter(CURSOR, 'created_at', 'appeal_id')).toBe(
      `created_at.gt.${CURSOR.createdAt},` +
        `and(created_at.eq.${CURSOR.createdAt},appeal_id.gt.${CURSOR.id})`,
    );
  });
});

describe('sanitizeSearchTerm', () => {
  it('keeps the characters ids, handles, slugs, and emails are made of', () => {
    expect(sanitizeSearchTerm('  Owens-Valley_99  ')).toBe('Owens-Valley_99');
    expect(sanitizeSearchTerm('mod@example.test')).toBe('mod@example.test');
    expect(sanitizeSearchTerm('a/b:c.d')).toBe('a/b:c.d');
  });

  it.each([
    ['a comma, which would start a second filter', 'open,status.eq.actioned', 'open status.eq.actioned'],
    ['parentheses, which would open a boolean group', 'or(status.eq.open)', 'or status.eq.open'],
    ['a percent wildcard', 'copy%right', 'copy right'],
    ['an underscore wildcard is kept: it is a real handle character', 'my_handle', 'my_handle'],
    ['quotes', 'say "hi"', 'say hi'],
    ['a backslash', 'a\\b', 'a b'],
    ['an asterisk', 'a*b', 'a b'],
  ])('strips %s', (_label, input, expected) => {
    expect(sanitizeSearchTerm(input)).toBe(expected);
  });

  it('returns null for nothing usable, which callers read as "no search"', () => {
    expect(sanitizeSearchTerm('')).toBeNull();
    expect(sanitizeSearchTerm('   ')).toBeNull();
    expect(sanitizeSearchTerm(',,,()')).toBeNull();
    expect(sanitizeSearchTerm(null)).toBeNull();
    expect(sanitizeSearchTerm(undefined)).toBeNull();
  });

  it('bounds the length', () => {
    const long = 'a'.repeat(SEARCH_MAX_CHARS + 50);
    expect(sanitizeSearchTerm(long)!.length).toBe(SEARCH_MAX_CHARS);
  });

  it('recognises a full uuid so an id search matches exactly', () => {
    expect(isUuidSearch(CURSOR.id)).toBe(true);
    expect(isUuidSearch(CURSOR.id.toUpperCase())).toBe(true);
    expect(isUuidSearch('ffffffff-1111-2222-3333')).toBe(false);
    expect(isUuidSearch('copyright')).toBe(false);
  });
});
