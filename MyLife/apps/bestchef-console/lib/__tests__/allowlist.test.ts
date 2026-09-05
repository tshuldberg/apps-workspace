import { describe, expect, it } from 'vitest';

import { isModeratorEmail, parseModeratorAllowlist } from '../allowlist';

describe('parseModeratorAllowlist', () => {
  it('parses a comma-separated list, trimming and lowercasing', () => {
    expect(parseModeratorAllowlist(' Trey@Example.com , mod2@example.com ')).toEqual([
      'trey@example.com',
      'mod2@example.com',
    ]);
  });

  it('returns empty for undefined, null, and empty input (fail closed)', () => {
    expect(parseModeratorAllowlist(undefined)).toEqual([]);
    expect(parseModeratorAllowlist(null)).toEqual([]);
    expect(parseModeratorAllowlist('')).toEqual([]);
    expect(parseModeratorAllowlist('  ,  ,')).toEqual([]);
  });

  it('drops entries without a plausible email shape', () => {
    expect(parseModeratorAllowlist('not-an-email, @nope, nope@, a@b')).toEqual(['a@b']);
  });

  it('dedupes case-insensitively', () => {
    expect(parseModeratorAllowlist('A@b.com,a@B.com')).toEqual(['a@b.com']);
  });
});

describe('isModeratorEmail', () => {
  const list = parseModeratorAllowlist('mod@bestchef.app');

  it('matches case-insensitively with whitespace tolerance', () => {
    expect(isModeratorEmail('MOD@bestchef.app', list)).toBe(true);
    expect(isModeratorEmail('  mod@bestchef.app  ', list)).toBe(true);
  });

  it('rejects non-members', () => {
    expect(isModeratorEmail('user@bestchef.app', list)).toBe(false);
  });

  it('rejects everyone when the allowlist is empty (fail closed)', () => {
    expect(isModeratorEmail('mod@bestchef.app', [])).toBe(false);
  });

  it('rejects null/undefined/empty email', () => {
    expect(isModeratorEmail(null, list)).toBe(false);
    expect(isModeratorEmail(undefined, list)).toBe(false);
    expect(isModeratorEmail('', list)).toBe(false);
  });
});
