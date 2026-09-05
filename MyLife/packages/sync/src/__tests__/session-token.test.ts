import { describe, expect, it } from 'vitest';
import {
  deriveSessionRendezvousToken,
  sessionTokenCandidates,
  utcDayBucket,
} from '../protocol/session-token';
import { deriveMailboxToken } from '../protocol/mailbox';

// A fixed 32-byte pairing secret (hex) shared by both ends of a pairing.
const PAIR_SECRET = 'a'.repeat(64);
const OTHER_SECRET = 'b'.repeat(64);

// 2026-07-04T12:00:00Z and 2026-07-05T00:30:00Z (crosses a UTC midnight).
const NOON_JUL4 = Date.parse('2026-07-04T12:00:00.000Z');
const AFTER_MIDNIGHT_JUL5 = Date.parse('2026-07-05T00:30:00.000Z');

describe('deriveSessionRendezvousToken', () => {
  it('is a 64-hex opaque token', () => {
    const token = deriveSessionRendezvousToken(PAIR_SECRET, '2026-07-04');
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic across both ends (same secret + bucket => same token)', () => {
    const a = deriveSessionRendezvousToken(PAIR_SECRET, '2026-07-04');
    const b = deriveSessionRendezvousToken(PAIR_SECRET, '2026-07-04');
    expect(a).toBe(b);
  });

  it('rotates daily: a different UTC bucket yields a different token', () => {
    const day1 = deriveSessionRendezvousToken(PAIR_SECRET, '2026-07-04');
    const day2 = deriveSessionRendezvousToken(PAIR_SECRET, '2026-07-05');
    expect(day1).not.toBe(day2);
  });

  it('is pair-scoped: a different pairing secret yields a different token', () => {
    const mine = deriveSessionRendezvousToken(PAIR_SECRET, '2026-07-04');
    const theirs = deriveSessionRendezvousToken(OTHER_SECRET, '2026-07-04');
    expect(mine).not.toBe(theirs);
  });

  it('is domain-separated from the mailbox token (NC-2: never reuse it)', () => {
    // Same secret, comparable second component: the domain string alone must
    // make the two derivations diverge, so a session token can never collide
    // with a mailbox token.
    const session = deriveSessionRendezvousToken(PAIR_SECRET, '2026-07-04');
    const mailbox = deriveMailboxToken(PAIR_SECRET, '2026-07-04', Date.now());
    expect(session).not.toBe(mailbox);
  });
});

describe('utcDayBucket', () => {
  it('formats the UTC calendar day as YYYY-MM-DD', () => {
    expect(utcDayBucket(NOON_JUL4)).toBe('2026-07-04');
    expect(utcDayBucket(AFTER_MIDNIGHT_JUL5)).toBe('2026-07-05');
  });
});

describe('sessionTokenCandidates', () => {
  it('returns [today, yesterday] tokens for clock-skew tolerance', () => {
    const candidates = sessionTokenCandidates(PAIR_SECRET, AFTER_MIDNIGHT_JUL5);
    expect(candidates).toEqual([
      deriveSessionRendezvousToken(PAIR_SECRET, '2026-07-05'),
      deriveSessionRendezvousToken(PAIR_SECRET, '2026-07-04'),
    ]);
  });

  it('both ends agree on the current-bucket token at the same instant', () => {
    const mine = sessionTokenCandidates(PAIR_SECRET, NOON_JUL4);
    const theirs = sessionTokenCandidates(PAIR_SECRET, NOON_JUL4);
    expect(mine[0]).toBe(theirs[0]);
  });
});
