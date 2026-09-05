import { describe, expect, it } from 'vitest';
import { isModeratorEmail, parseModeratorAllowlist } from '../allowlist';

describe('parseModeratorAllowlist', () => {
  it('returns empty for missing/blank input (fail closed)', () => {
    expect(parseModeratorAllowlist(undefined)).toEqual([]);
    expect(parseModeratorAllowlist('')).toEqual([]);
    expect(parseModeratorAllowlist('   ')).toEqual([]);
  });

  it('lowercases, trims, and dedupes', () => {
    expect(parseModeratorAllowlist(' A@x.com, a@x.com , B@y.com ')).toEqual(['a@x.com', 'b@y.com']);
  });

  it('drops malformed entries without disabling the list', () => {
    expect(parseModeratorAllowlist('good@x.com, notanemail, @x.com, y@')).toEqual(['good@x.com']);
  });
});

describe('isModeratorEmail', () => {
  it('is false for an empty allowlist (fail closed)', () => {
    expect(isModeratorEmail('a@x.com', [])).toBe(false);
  });
  it('matches case-insensitively', () => {
    expect(isModeratorEmail('A@X.com', ['a@x.com'])).toBe(true);
  });
  it('is false for a non-member or null email', () => {
    expect(isModeratorEmail('b@x.com', ['a@x.com'])).toBe(false);
    expect(isModeratorEmail(null, ['a@x.com'])).toBe(false);
  });
});
