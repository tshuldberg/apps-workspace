import { describe, it, expect } from 'vitest';
import {
  calculateSocialMoodCorrelation,
  getGiftSpendingSummary,
  getJournalDeepLink,
  getJournalContext,
  isModuleEnabled,
  diningIntegration,
  rsvpIntegration,
  trailsIntegration,
  workoutsIntegration,
  gamingIntegration,
  musicIntegration,
} from '../integrations';

// ── calculateSocialMoodCorrelation ─────────────────────────────────

describe('calculateSocialMoodCorrelation', () => {
  it('returns correct correlation with sample data', () => {
    const hangoutDates = ['2026-04-01', '2026-04-05', '2026-04-10'];
    const moodEntries = [
      { date: '2026-04-01', score: 8 },
      { date: '2026-04-02', score: 5 },
      { date: '2026-04-03', score: 6 },
      { date: '2026-04-04', score: 5 },
      { date: '2026-04-05', score: 9 },
      { date: '2026-04-06', score: 4 },
      { date: '2026-04-07', score: 6 },
      { date: '2026-04-08', score: 5 },
      { date: '2026-04-09', score: 5 },
      { date: '2026-04-10', score: 7 },
      { date: '2026-04-11', score: 6 },
      { date: '2026-04-12', score: 4 },
    ];

    const result = calculateSocialMoodCorrelation(hangoutDates, moodEntries);

    expect(result).not.toBeNull();
    expect(result!.socialDayAvg).toBe(8); // (8 + 9 + 7) / 3
    expect(result!.nonSocialDayAvg).toBeCloseTo(5.1, 1); // (5+6+5+4+6+5+5+6+4) / 9
    expect(result!.correlation).toBeGreaterThan(0);
    expect(result!.insight).toContain('social days');
  });

  it('returns null with fewer than 10 entries', () => {
    const hangoutDates = ['2026-04-01'];
    const moodEntries = [
      { date: '2026-04-01', score: 8 },
      { date: '2026-04-02', score: 5 },
      { date: '2026-04-03', score: 6 },
    ];

    const result = calculateSocialMoodCorrelation(hangoutDates, moodEntries);
    expect(result).toBeNull();
  });

  it('returns null when all entries are on social days', () => {
    const dates = ['2026-04-01', '2026-04-02', '2026-04-03'];
    const moodEntries = Array.from({ length: 10 }, (_, i) => ({
      date: `2026-04-0${(i % 3) + 1}`,
      score: 7,
    }));

    // All mood entries land on hangout days, none on non-social days
    const result = calculateSocialMoodCorrelation(
      dates,
      moodEntries,
    );
    expect(result).toBeNull();
  });
});

// ── getGiftSpendingSummary ──────────────────────────────────────────

describe('getGiftSpendingSummary', () => {
  it('calculates correct totals', () => {
    const gifts = [
      { direction: 'given', amount_cents: 5000 },
      { direction: 'given', amount_cents: 2500 },
      { direction: 'received', amount_cents: 3000 },
    ];

    const result = getGiftSpendingSummary(gifts);

    expect(result.totalGiven).toBe(75);
    expect(result.totalReceived).toBe(30);
    expect(result.netSpent).toBe(45);
  });

  it('handles null amounts', () => {
    const gifts = [
      { direction: 'given', amount_cents: null },
      { direction: 'given', amount_cents: 2000 },
      { direction: 'received', amount_cents: null },
    ];

    const result = getGiftSpendingSummary(gifts);

    expect(result.totalGiven).toBe(20);
    expect(result.totalReceived).toBe(0);
    expect(result.netSpent).toBe(20);
  });

  it('returns zeros for empty array', () => {
    const result = getGiftSpendingSummary([]);

    expect(result.totalGiven).toBe(0);
    expect(result.totalReceived).toBe(0);
    expect(result.netSpent).toBe(0);
  });
});

// ── getJournalDeepLink ─────────────────────────────────────────────

describe('getJournalDeepLink', () => {
  it('returns correct path with encoded name', () => {
    const link = getJournalDeepLink('John Smith');
    expect(link).toBe('/journal/new?context=friend&name=John%20Smith');
  });

  it('handles special characters', () => {
    const link = getJournalDeepLink("Mary O'Brien");
    expect(link).toBe("/journal/new?context=friend&name=Mary%20O'Brien");
  });
});

// ── getJournalContext ──────────────────────────────────────────────

describe('getJournalContext', () => {
  it('returns context with last hangout', () => {
    const ctx = getJournalContext('Alice', '2026-04-15');
    expect(ctx).toBe('Reflecting on time with Alice (2026-04-15)...');
  });

  it('returns simple context without last hangout', () => {
    const ctx = getJournalContext('Bob');
    expect(ctx).toBe('Thinking about Bob...');
  });
});

// ── isModuleEnabled ────────────────────────────────────────────────

describe('isModuleEnabled', () => {
  it('returns true for known modules', () => {
    expect(isModuleEnabled('dining')).toBe(true);
    expect(isModuleEnabled('mood')).toBe(true);
    expect(isModuleEnabled('workouts')).toBe(true);
    expect(isModuleEnabled('budget')).toBe(true);
    expect(isModuleEnabled('trails')).toBe(true);
    expect(isModuleEnabled('rsvp')).toBe(true);
  });

  it('returns false for unknown modules', () => {
    expect(isModuleEnabled('nonexistent')).toBe(false);
    expect(isModuleEnabled('gaming')).toBe(false);
    expect(isModuleEnabled('music')).toBe(false);
  });
});

// ── Stub integrations return graceful empty states ─────────────────

describe('stub integrations', () => {
  it('dining returns empty activities', () => {
    expect(diningIntegration.getActivitiesForPerson('test-id')).toEqual([]);
    expect(diningIntegration.suggestHangout({})).toBeNull();
    expect(diningIntegration.moduleId).toBe('dining');
  });

  it('rsvp returns empty activities', () => {
    expect(rsvpIntegration.getActivitiesForPerson('test-id')).toEqual([]);
    expect(rsvpIntegration.suggestHangout({})).toBeNull();
  });

  it('trails returns empty activities', () => {
    expect(trailsIntegration.getActivitiesForPerson('test-id')).toEqual([]);
    expect(trailsIntegration.suggestHangout({})).toBeNull();
  });

  it('workouts returns empty activities', () => {
    expect(workoutsIntegration.getActivitiesForPerson('test-id')).toEqual([]);
    expect(workoutsIntegration.suggestHangout({})).toBeNull();
  });

  it('gaming returns empty activities', () => {
    expect(gamingIntegration.getActivitiesForPerson('test-id')).toEqual([]);
    expect(gamingIntegration.suggestHangout({})).toBeNull();
  });

  it('music returns empty activities', () => {
    expect(musicIntegration.getActivitiesForPerson('test-id')).toEqual([]);
    expect(musicIntegration.suggestHangout({})).toBeNull();
  });

  it('dining isAvailable returns true (known module)', () => {
    expect(diningIntegration.isAvailable()).toBe(true);
  });

  it('gaming isAvailable returns false (unknown module)', () => {
    expect(gamingIntegration.isAvailable()).toBe(false);
  });
});
