import { describe, expect, it } from 'vitest';
import { atHandle, relativeTime, shortKey } from '../(root)/lib/format';

const NOW = Date.parse('2026-07-03T12:00:00.000Z');

describe('relativeTime', () => {
  it('renders just now under a minute', () => {
    expect(relativeTime('2026-07-03T11:59:30.000Z', NOW)).toBe('just now');
  });

  it('renders minutes, hours, and days', () => {
    expect(relativeTime('2026-07-03T11:30:00.000Z', NOW)).toBe('30m ago');
    expect(relativeTime('2026-07-03T09:00:00.000Z', NOW)).toBe('3h ago');
    expect(relativeTime('2026-07-01T12:00:00.000Z', NOW)).toBe('2d ago');
  });

  it('falls back to an absolute date past a week', () => {
    const out = relativeTime('2026-06-01T12:00:00.000Z', NOW);
    expect(out).not.toContain('ago');
    expect(out.length).toBeGreaterThan(0);
  });

  it('returns an empty string for an unparseable date', () => {
    expect(relativeTime('not-a-date', NOW)).toBe('');
  });
});

describe('shortKey', () => {
  it('takes the first eight characters', () => {
    expect(shortKey('abcdef0123456789')).toBe('abcdef01');
  });
});

describe('atHandle', () => {
  it('adds a single sigil', () => {
    expect(atHandle('reporter')).toBe('@reporter');
    expect(atHandle('@reporter')).toBe('@reporter');
  });
});
