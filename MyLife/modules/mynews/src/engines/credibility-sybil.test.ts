import { describe, expect, it } from 'vitest';

import {
  SECTION_EDITOR_MIN_ACCOUNT_AGE_MS,
  TRUST_MIN_ACCOUNT_AGE_MS,
  TRUST_RING_SUSPICION_MAX,
  accountAgeMultiplier,
  authorStandingFor,
  authorStandingForTier,
  editorStatsFromAggregates,
  isVerifiedState,
  levelFor,
  openSuggestionCap,
  standingMultiplier,
  verificationWeight,
  type EditorStats,
  type VerificationState,
} from './credibility';
import { DEFAULT_RING_CONFIG } from './rings';

const DAY = 86_400_000;

/** Stats that qualify for trusted_editor on every pre-WP8 axis. */
function trustedBase(over: Partial<EditorStats> = {}): EditorStats {
  return {
    weightedScore: 200,
    acceptedTotal: 40,
    acceptedCopyedits: 0,
    distinctAuthors: 12,
    acceptanceRate: 0.9,
    decidedSampleSize: 44,
    sanctionsInLast90d: 0,
    topicScore: 0,
    endorsements: 0,
    identityVerified: false,
    maxPairShare: 0.2,
    ...over,
  };
}

describe('account-age trust gate', () => {
  it('pins the thresholds', () => {
    expect(TRUST_MIN_ACCOUNT_AGE_MS).toBe(14 * DAY);
    expect(SECTION_EDITOR_MIN_ACCOUNT_AGE_MS).toBe(90 * DAY);
  });

  it('withholds trusted_editor from a fresh account that otherwise qualifies', () => {
    expect(levelFor(trustedBase({ accountAgeMs: 13 * DAY }))).not.toBe('trusted_editor');
    expect(levelFor(trustedBase({ accountAgeMs: 13 * DAY }))).toBe('contributor');
  });

  it('grants trusted_editor exactly at the age boundary', () => {
    expect(levelFor(trustedBase({ accountAgeMs: TRUST_MIN_ACCOUNT_AGE_MS }))).toBe(
      'trusted_editor',
    );
  });

  it('leaves the gate inert when the caller has no age signal', () => {
    expect(levelFor(trustedBase({ accountAgeMs: null }))).toBe('trusted_editor');
    expect(levelFor(trustedBase())).toBe('trusted_editor');
  });

  it('does not gate the lower rungs on age', () => {
    const copyeditor = {
      ...trustedBase({ accountAgeMs: 0 }),
      weightedScore: 0,
      acceptedCopyedits: 25,
      acceptedTotal: 25,
      acceptanceRate: 0.6,
      distinctAuthors: 5,
    };
    expect(levelFor(copyeditor)).toBe('copyeditor');
  });

  it('requires a longer record for section_editor', () => {
    const eligible = trustedBase({
      accountAgeMs: 30 * DAY,
      topicScore: 600,
      endorsements: 4,
      identityVerified: true,
    });
    expect(levelFor(eligible)).toBe('trusted_editor');
    expect(levelFor({ ...eligible, accountAgeMs: SECTION_EDITOR_MIN_ACCOUNT_AGE_MS })).toBe(
      'section_editor',
    );
  });

  it('shrinks the open-suggestion cap along with the level', () => {
    expect(openSuggestionCap(trustedBase({ accountAgeMs: 100 * DAY }))).toBe(20);
    expect(openSuggestionCap(trustedBase({ accountAgeMs: 1 * DAY }))).toBe(8);
  });
});

describe('ring-suspicion trust gate', () => {
  it('pins the threshold to the ring detector flag level', () => {
    expect(TRUST_RING_SUSPICION_MAX).toBe(DEFAULT_RING_CONFIG.flagAt);
  });

  it('withholds trusted_editor from a flagged profile', () => {
    expect(levelFor(trustedBase({ ringSuspicion: TRUST_RING_SUSPICION_MAX }))).toBe('contributor');
    expect(levelFor(trustedBase({ ringSuspicion: 1 }))).toBe('contributor');
  });

  it('allows trusted_editor just below the threshold', () => {
    expect(levelFor(trustedBase({ ringSuspicion: TRUST_RING_SUSPICION_MAX - 0.01 }))).toBe(
      'trusted_editor',
    );
  });

  it('treats an absent ring signal as no suspicion', () => {
    expect(levelFor(trustedBase())).toBe('trusted_editor');
  });

  it('stacks with the pair-concentration gate rather than replacing it', () => {
    expect(levelFor(trustedBase({ maxPairShare: 0.6 }))).toBe('contributor');
    expect(levelFor(trustedBase({ maxPairShare: 0.6, ringSuspicion: 0 }))).toBe('contributor');
  });
});

describe('accountAgeMultiplier', () => {
  it('is 0.5 at creation and 1 at the section-editor age', () => {
    expect(accountAgeMultiplier(0)).toBe(0.5);
    expect(accountAgeMultiplier(SECTION_EDITOR_MIN_ACCOUNT_AGE_MS)).toBe(1);
  });

  it('is monotonically non-decreasing in age', () => {
    let previous = 0;
    for (let days = 0; days <= 120; days += 3) {
      const value = accountAgeMultiplier(days * DAY);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  it('never exceeds 1 or drops below 0.5 for a real age', () => {
    for (const days of [0, 1, 7, 14, 45, 90, 365, 10_000]) {
      const value = accountAgeMultiplier(days * DAY);
      expect(value).toBeGreaterThanOrEqual(0.5);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('is 1 when there is no age signal, so nothing is downgraded on a guess', () => {
    expect(accountAgeMultiplier(null)).toBe(1);
    expect(accountAgeMultiplier(undefined)).toBe(1);
  });
});

describe('verification weighting', () => {
  it('weights only a live approval above the baseline', () => {
    expect(verificationWeight('approved')).toBe(0.75);
    expect(verificationWeight('pending')).toBe(0.55);
    for (const state of ['none', 'rejected', 'revoked', 'expired'] as VerificationState[]) {
      expect(verificationWeight(state)).toBe(0.5);
    }
    expect(verificationWeight(null)).toBe(0.5);
    expect(verificationWeight(undefined)).toBe(0.5);
  });

  it('never penalizes a denied request below the unverified baseline', () => {
    expect(verificationWeight('rejected')).toBe(verificationWeight('none'));
  });

  it('treats only an approval as verified identity', () => {
    expect(isVerifiedState('approved')).toBe(true);
    for (const state of ['none', 'pending', 'rejected', 'revoked', 'expired'] as VerificationState[]) {
      expect(isVerifiedState(state)).toBe(false);
    }
  });

  it('agrees with the tier mapping for a mature account', () => {
    const age = SECTION_EDITOR_MIN_ACCOUNT_AGE_MS;
    expect(authorStandingFor({ verification: 'approved', accountAgeMs: age })).toBe(
      authorStandingForTier('verified'),
    );
    expect(authorStandingFor({ verification: 'none', accountAgeMs: age })).toBe(
      authorStandingForTier('open'),
    );
  });

  it('falls back to the tier column when there is no verification record', () => {
    expect(authorStandingFor({ tier: 'verified' })).toBe(0.75);
    expect(authorStandingFor({ tier: 'open' })).toBe(0.5);
    expect(authorStandingFor({})).toBe(0.5);
  });

  it('scales standing down for a brand-new verified account', () => {
    const fresh = authorStandingFor({ verification: 'approved', accountAgeMs: 0 });
    const mature = authorStandingFor({
      verification: 'approved',
      accountAgeMs: SECTION_EDITOR_MIN_ACCOUNT_AGE_MS,
    });
    expect(fresh).toBeLessThan(mature);
    expect(fresh).toBeCloseTo(0.375, 10);
  });

  it('stays inside 0..1 across the whole input space', () => {
    for (const state of [
      'none',
      'pending',
      'approved',
      'rejected',
      'revoked',
      'expired',
      null,
      undefined,
    ] as Array<VerificationState | null | undefined>) {
      for (const days of [0, 1, 14, 90, 5000]) {
        const value = authorStandingFor({ verification: state, accountAgeMs: days * DAY });
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
        // Standing feeds standingMultiplier, which must stay in its own range.
        const multiplier = standingMultiplier(value);
        expect(multiplier).toBeGreaterThanOrEqual(0.5);
        expect(multiplier).toBeLessThanOrEqual(1.2);
      }
    }
  });

  it('is monotonic in verification strength at a fixed age', () => {
    const age = 30 * DAY;
    const none = authorStandingFor({ verification: 'none', accountAgeMs: age });
    const pending = authorStandingFor({ verification: 'pending', accountAgeMs: age });
    const approved = authorStandingFor({ verification: 'approved', accountAgeMs: age });
    expect(pending).toBeGreaterThan(none);
    expect(approved).toBeGreaterThan(pending);
  });
});

describe('editorStatsFromAggregates: WP8 signals', () => {
  const base = {
    acceptedTotal: 40,
    acceptedCopyedits: 0,
    distinctAuthors: 12,
    acceptanceRate: 0.9,
    decidedSampleSize: 44,
    sanctionsInLast90d: 0,
    maxPairShare: 0.2,
  };

  it('threads age, verification, endorsements, and ring suspicion through', () => {
    const stats = editorStatsFromAggregates(
      {
        ...base,
        accountAgeMs: 20 * DAY,
        verification: 'approved',
        ringSuspicion: 0.3,
        endorsementsReceived: 5,
      },
      200,
    );
    expect(stats.accountAgeMs).toBe(20 * DAY);
    expect(stats.verification).toBe('approved');
    expect(stats.ringSuspicion).toBe(0.3);
    expect(stats.endorsements).toBe(5);
    expect(stats.identityVerified).toBe(true);
    expect(levelFor(stats)).toBe('trusted_editor');
  });

  it('makes section_editor reachable only for a verified, endorsed, long-lived editor', () => {
    const stats = editorStatsFromAggregates(
      {
        ...base,
        accountAgeMs: 200 * DAY,
        verification: 'approved',
        ringSuspicion: 0,
        endorsementsReceived: 4,
      },
      200,
    );
    // topicScore is still not provided by any aggregate, so the rung stays out
    // of reach until it is. Documented, not silently pretended.
    expect(stats.topicScore).toBe(0);
    expect(levelFor(stats)).toBe('trusted_editor');
    expect(levelFor({ ...stats, topicScore: 600 })).toBe('section_editor');
  });

  it('does not treat a pending or expired verification as verified identity', () => {
    for (const state of ['pending', 'expired', 'revoked'] as VerificationState[]) {
      const stats = editorStatsFromAggregates(
        { ...base, accountAgeMs: 200 * DAY, verification: state, endorsementsReceived: 4 },
        200,
      );
      expect(stats.identityVerified).toBe(false);
      expect(levelFor({ ...stats, topicScore: 600 })).toBe('trusted_editor');
    }
  });

  it('withholds trust when the aggregates report a flagged ring', () => {
    const stats = editorStatsFromAggregates(
      { ...base, accountAgeMs: 200 * DAY, verification: 'approved', ringSuspicion: 0.9 },
      200,
    );
    expect(levelFor(stats)).toBe('contributor');
    expect(openSuggestionCap(stats)).toBe(8);
  });
});
