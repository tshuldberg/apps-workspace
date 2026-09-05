import { describe, it, expect } from 'vitest';
import {
  getGroupActivity,
  getCompatibilityPairs,
  detectTraditions,
  detectIntroductions,
} from '../engine/groups';

// ── Test data ───────────────────────────────────────────────────────

const people = [
  { id: 'alice', display_name: 'Alice' },
  { id: 'bob', display_name: 'Bob' },
  { id: 'carol', display_name: 'Carol' },
  { id: 'dave', display_name: 'Dave' },
  { id: 'eve', display_name: 'Eve' },
];

const hangouts = [
  { people_ids: ['alice', 'bob'], happened_at: '2026-01-01', activity_tags: ['coffee'] },
  { people_ids: ['alice', 'bob', 'carol'], happened_at: '2026-01-08', activity_tags: ['brunch'] },
  { people_ids: ['alice', 'carol'], happened_at: '2026-01-15', activity_tags: ['coffee'] },
  { people_ids: ['bob', 'carol', 'dave'], happened_at: '2026-01-22', activity_tags: ['dinner'] },
  { people_ids: ['alice', 'bob', 'carol'], happened_at: '2026-01-29', activity_tags: ['brunch'] },
  { people_ids: ['alice'], happened_at: '2026-02-01', activity_tags: ['coffee'] },
  { people_ids: ['alice', 'bob', 'carol'], happened_at: '2026-02-05', activity_tags: ['brunch'] },
  { people_ids: ['dave', 'eve'], happened_at: '2026-02-10', activity_tags: ['hike'] },
  { people_ids: ['alice', 'bob'], happened_at: '2026-02-15', activity_tags: ['coffee'] },
];

// ── getGroupActivity ─────────────────────────────────────────────────

describe('getGroupActivity', () => {
  it('counts group hangouts with 2+ circle members', () => {
    const memberIds = ['alice', 'bob', 'carol'];
    const result = getGroupActivity(memberIds, hangouts);

    // Hangouts with 2+ of [alice, bob, carol]:
    // 2026-01-01: alice+bob (2)
    // 2026-01-08: alice+bob+carol (3)
    // 2026-01-15: alice+carol (2)
    // 2026-01-22: bob+carol (2, dave also present)
    // 2026-01-29: alice+bob+carol (3)
    // 2026-02-05: alice+bob+carol (3)
    // 2026-02-15: alice+bob (2)
    expect(result.totalGroupHangouts).toBe(7);
  });

  it('returns the last group hangout date', () => {
    const memberIds = ['alice', 'bob', 'carol'];
    const result = getGroupActivity(memberIds, hangouts);
    expect(result.lastGroupHangout).toBe('2026-02-15');
  });

  it('calculates average frequency between group hangouts', () => {
    const memberIds = ['alice', 'bob', 'carol'];
    const result = getGroupActivity(memberIds, hangouts);
    // 7 hangouts across 46 days (Jan 1 to Feb 15), avg gap = 46/6 ~ 8 days
    expect(result.averageFrequencyDays).toBeGreaterThan(0);
    expect(result.averageFrequencyDays).toBeLessThan(15);
  });

  it('handles no matching hangouts', () => {
    const memberIds = ['frank', 'george'];
    const result = getGroupActivity(memberIds, hangouts);
    expect(result.totalGroupHangouts).toBe(0);
    expect(result.lastGroupHangout).toBeNull();
    expect(result.averageFrequencyDays).toBeNull();
  });

  it('handles single member (no group possible)', () => {
    const memberIds = ['alice'];
    const result = getGroupActivity(memberIds, hangouts);
    expect(result.totalGroupHangouts).toBe(0);
  });

  it('returns null frequency with only 1 group hangout', () => {
    const memberIds = ['dave', 'eve'];
    const result = getGroupActivity(memberIds, hangouts);
    // Only 2026-02-10 has dave+eve
    expect(result.totalGroupHangouts).toBe(1);
    expect(result.averageFrequencyDays).toBeNull();
  });
});

// ── getCompatibilityPairs ────────────────────────────────────────────

describe('getCompatibilityPairs', () => {
  it('returns top pairs by shared hangout count', () => {
    const result = getCompatibilityPairs(hangouts, people);

    // alice+bob appear together in: 01-01, 01-08, 01-29, 02-05, 02-15 = 5
    const aliceBob = result.find(
      (p) =>
        (p.personAId === 'alice' && p.personBId === 'bob') ||
        (p.personAId === 'bob' && p.personBId === 'alice'),
    );
    expect(aliceBob).toBeDefined();
    expect(aliceBob!.sharedHangouts).toBe(5);

    // First result should have the highest count
    expect(result[0].sharedHangouts).toBeGreaterThanOrEqual(result[1]?.sharedHangouts ?? 0);
  });

  it('calculates co-occurrence rate correctly', () => {
    const result = getCompatibilityPairs(hangouts, people);

    const aliceBob = result.find(
      (p) => p.personAId === 'alice' && p.personBId === 'bob',
    );
    expect(aliceBob).toBeDefined();
    // Alice is in hangouts: 01-01, 01-08, 01-15, 01-29, 02-01, 02-05, 02-15 = 7
    // Alice+Bob together: 5
    // coOccurrenceRate = 5/7
    expect(aliceBob!.coOccurrenceRate).toBeCloseTo(5 / 7, 2);
  });

  it('respects topN parameter', () => {
    const result = getCompatibilityPairs(hangouts, people, 3);
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it('excludes people not in the people list', () => {
    const limitedPeople = [{ id: 'alice', display_name: 'Alice' }];
    const result = getCompatibilityPairs(hangouts, limitedPeople);
    // With only alice in people, no pairs can form
    expect(result.length).toBe(0);
  });
});

// ── detectTraditions ─────────────────────────────────────────────────

describe('detectTraditions', () => {
  it('finds recurring activity patterns (brunch tradition)', () => {
    const memberIds = ['alice', 'bob', 'carol'];
    const result = detectTraditions(memberIds, hangouts);

    const brunchTradition = result.find((t) => t.activityTag === 'brunch');
    expect(brunchTradition).toBeDefined();
    expect(brunchTradition!.occurrences).toBe(3);
  });

  it('detects frequency correctly (weekly pattern)', () => {
    const memberIds = ['alice', 'bob', 'carol'];
    const result = detectTraditions(memberIds, hangouts);

    const brunchTradition = result.find((t) => t.activityTag === 'brunch');
    expect(brunchTradition).toBeDefined();
    // Brunch: Jan 8, Jan 29, Feb 5 -- avg gap ~14 days = monthly
    expect(['weekly', 'monthly']).toContain(brunchTradition!.frequency);
  });

  it('requires minOccurrences', () => {
    const memberIds = ['alice', 'bob', 'carol'];

    // With min 4, brunch (3 occurrences) should not appear
    const result = detectTraditions(memberIds, hangouts, 4);
    const brunchTradition = result.find((t) => t.activityTag === 'brunch');
    expect(brunchTradition).toBeUndefined();
  });

  it('returns empty for single-member circles', () => {
    const result = detectTraditions(['alice'], hangouts);
    expect(result.length).toBe(0);
  });

  it('sorts traditions by occurrences DESC', () => {
    const memberIds = ['alice', 'bob', 'carol'];
    const result = detectTraditions(memberIds, hangouts);
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].occurrences).toBeGreaterThanOrEqual(result[i + 1].occurrences);
    }
  });

  it('generates a human-readable description', () => {
    const memberIds = ['alice', 'bob', 'carol'];
    const result = detectTraditions(memberIds, hangouts);

    const brunchTradition = result.find((t) => t.activityTag === 'brunch');
    expect(brunchTradition).toBeDefined();
    expect(brunchTradition!.description.length).toBeGreaterThan(0);
    expect(brunchTradition!.description.toLowerCase()).toContain('brunch');
  });
});

// ── detectIntroductions ──────────────────────────────────────────────

describe('detectIntroductions', () => {
  it('finds first co-occurrence between pairs', () => {
    const result = detectIntroductions(hangouts, people);

    const aliceBob = result.find(
      (i) =>
        (i.personAId === 'alice' && i.personBId === 'bob') ||
        (i.personAId === 'bob' && i.personBId === 'alice'),
    );
    expect(aliceBob).toBeDefined();
    expect(aliceBob!.firstSharedHangoutDate).toBe('2026-01-01');
  });

  it('returns correct names for introductions', () => {
    const result = detectIntroductions(hangouts, people);

    const daveEve = result.find(
      (i) =>
        (i.personAId === 'dave' && i.personBId === 'eve') ||
        (i.personAId === 'eve' && i.personBId === 'dave'),
    );
    expect(daveEve).toBeDefined();
    expect(daveEve!.personAName).toBeDefined();
    expect(daveEve!.personBName).toBeDefined();
    expect(daveEve!.firstSharedHangoutDate).toBe('2026-02-10');
  });

  it('returns empty with single-person hangouts only', () => {
    const soloHangouts = [
      { people_ids: ['alice'], happened_at: '2026-01-01', activity_tags: ['coffee'] },
      { people_ids: ['bob'], happened_at: '2026-01-02', activity_tags: ['lunch'] },
    ];
    const result = detectIntroductions(soloHangouts, people);
    expect(result.length).toBe(0);
  });

  it('sorted by date ASC (oldest first)', () => {
    const result = detectIntroductions(hangouts, people);
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].firstSharedHangoutDate <= result[i + 1].firstSharedHangoutDate).toBe(true);
    }
  });

  it('excludes people not in the people list', () => {
    const limitedPeople = [{ id: 'alice', display_name: 'Alice' }];
    const result = detectIntroductions(hangouts, limitedPeople);
    // With only alice in people, no pairs can form
    expect(result.length).toBe(0);
  });
});
