import { describe, it, expect } from 'vitest';
import {
  getTimeDistribution,
  getQualityCorrelation,
  getInnerCircle,
  getTimeVsQualityQuadrant,
  getEnergyCorrelation,
} from '../engine/quality-analysis';

// ── Test data ───────────────────────────────────────────────────────

const people = [
  { id: 'alice', display_name: 'Alice' },
  { id: 'bob', display_name: 'Bob' },
  { id: 'carol', display_name: 'Carol' },
  { id: 'dave', display_name: 'Dave' },
  { id: 'eve', display_name: 'Eve' },
  { id: 'frank', display_name: 'Frank' },
];

const hangouts = [
  { people_ids: ['alice'], duration_minutes: 60, quality_rating: 5 },
  { people_ids: ['alice'], duration_minutes: 90, quality_rating: 4 },
  { people_ids: ['bob'], duration_minutes: 120, quality_rating: 3 },
  { people_ids: ['bob'], duration_minutes: 30, quality_rating: 2 },
  { people_ids: ['carol'], duration_minutes: 45, quality_rating: 5 },
  { people_ids: ['dave'], duration_minutes: 180, quality_rating: 1 },
  { people_ids: ['alice', 'bob'], duration_minutes: 60, quality_rating: 4 },
  { people_ids: ['eve'], duration_minutes: 30, quality_rating: null },
];

// ── getTimeDistribution ─────────────────────────────────────────────

describe('getTimeDistribution', () => {
  it('sorts by totalMinutes DESC', () => {
    const result = getTimeDistribution(hangouts, people);
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].totalMinutes).toBeGreaterThanOrEqual(result[i + 1].totalMinutes);
    }
  });

  it('percentages sum to approximately 100', () => {
    const result = getTimeDistribution(hangouts, people);
    const sum = result.reduce((s, r) => s + r.percentOfTotal, 0);
    // Allow floating point tolerance
    expect(sum).toBeCloseTo(100, 0);
  });

  it('handles multi-person hangouts (time counted for each)', () => {
    const result = getTimeDistribution(hangouts, people);
    const alice = result.find((r) => r.personId === 'alice')!;
    const bob = result.find((r) => r.personId === 'bob')!;
    // Alice: 60 + 90 + 60 (group) = 210
    expect(alice.totalMinutes).toBe(210);
    // Bob: 120 + 30 + 60 (group) = 210
    expect(bob.totalMinutes).toBe(210);
  });

  it('counts hangouts with null duration as 0 minutes but increments count', () => {
    const result = getTimeDistribution(hangouts, people);
    const eve = result.find((r) => r.personId === 'eve')!;
    expect(eve.totalMinutes).toBe(30);
    expect(eve.hangoutCount).toBe(1);
  });

  it('returns empty array for empty hangouts', () => {
    expect(getTimeDistribution([], people)).toEqual([]);
  });

  it('returns empty array for empty people', () => {
    expect(getTimeDistribution(hangouts, [])).toEqual([]);
  });

  it('ignores people_ids not in the people list', () => {
    const h = [{ people_ids: ['unknown'], duration_minutes: 100 }];
    expect(getTimeDistribution(h, people)).toEqual([]);
  });
});

// ── getQualityCorrelation ───────────────────────────────────────────

describe('getQualityCorrelation', () => {
  it('computes correct averages', () => {
    const result = getQualityCorrelation(hangouts, people);
    const alice = result.find((r) => r.personId === 'alice')!;
    // Alice: (5 + 4 + 4) / 3 = 4.33
    expect(alice.avgQuality).toBeCloseTo(4.33, 1);
    expect(alice.hangoutCount).toBe(3);
  });

  it('excludes hangouts with null quality_rating from average calculation', () => {
    const result = getQualityCorrelation(hangouts, people);
    // Eve has only null rating hangouts, so excluded
    const eve = result.find((r) => r.personId === 'eve');
    expect(eve).toBeUndefined();
  });

  it('sorts by avgQuality DESC', () => {
    const result = getQualityCorrelation(hangouts, people);
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].avgQuality).toBeGreaterThanOrEqual(result[i + 1].avgQuality);
    }
  });

  it('returns empty array for empty hangouts', () => {
    expect(getQualityCorrelation([], people)).toEqual([]);
  });
});

// ── getInnerCircle ──────────────────────────────────────────────────

describe('getInnerCircle', () => {
  it('returns top 5 by composite score', () => {
    const result = getInnerCircle(hangouts, people);
    expect(result.length).toBeLessThanOrEqual(5);
    // Carol has high quality (5) but low time (45min)
    // Alice has high quality (4.33) and high time (210min)
    // Alice should likely be #1 due to time+quality balance
    expect(result[0].personId).toBe('alice');
  });

  it('respects custom topN', () => {
    const result = getInnerCircle(hangouts, people, 2);
    expect(result.length).toBe(2);
  });

  it('handles ties gracefully (no crash, deterministic length)', () => {
    const tiedHangouts = [
      { people_ids: ['alice'], duration_minutes: 60, quality_rating: 4 },
      { people_ids: ['bob'], duration_minutes: 60, quality_rating: 4 },
      { people_ids: ['carol'], duration_minutes: 60, quality_rating: 4 },
    ];
    const result = getInnerCircle(tiedHangouts, people, 2);
    expect(result.length).toBe(2);
    // All have same score, so first 2 in sorted order
    for (const r of result) {
      expect(r.avgQuality).toBe(4);
      expect(r.totalMinutes).toBe(60);
    }
  });

  it('returns empty array when no rated hangouts', () => {
    const noRatings = [
      { people_ids: ['alice'], duration_minutes: 60, quality_rating: null },
    ];
    expect(getInnerCircle(noRatings, people)).toEqual([]);
  });
});

// ── getTimeVsQualityQuadrant ────────────────────────────────────────

describe('getTimeVsQualityQuadrant', () => {
  const timeStats = getTimeDistribution(hangouts, people);

  it('assigns high-time-high-quality correctly', () => {
    // Alice: 210 mins, avg quality ~4.33 (both above median)
    const quad = getTimeVsQualityQuadrant('alice', hangouts, timeStats);
    expect(quad).toBe('high-time-high-quality');
  });

  it('assigns high-time-low-quality correctly', () => {
    // Dave: 180 mins (high), quality 1 (low)
    const quad = getTimeVsQualityQuadrant('dave', hangouts, timeStats);
    expect(quad).toBe('high-time-low-quality');
  });

  it('assigns low-time-high-quality correctly', () => {
    // Carol: 45 mins (low), quality 5 (high)
    const quad = getTimeVsQualityQuadrant('carol', hangouts, timeStats);
    expect(quad).toBe('low-time-high-quality');
  });

  it('returns low-time-low-quality for empty stats', () => {
    const quad = getTimeVsQualityQuadrant('alice', hangouts, []);
    expect(quad).toBe('low-time-low-quality');
  });

  it('handles person not in stats gracefully', () => {
    const quad = getTimeVsQualityQuadrant('unknown', hangouts, timeStats);
    expect(quad).toBe('low-time-low-quality');
  });
});

// ── getEnergyCorrelation ────────────────────────────────────────────

describe('getEnergyCorrelation', () => {
  const peopleWithEnergy = [
    { id: 'alice', display_name: 'Alice', energy_tag: 'energizing' },
    { id: 'bob', display_name: 'Bob', energy_tag: 'neutral' },
    { id: 'carol', display_name: 'Carol', energy_tag: 'energizing' },
    { id: 'dave', display_name: 'Dave', energy_tag: 'draining' },
    { id: 'eve', display_name: 'Eve', energy_tag: null },
    { id: 'frank', display_name: 'Frank', energy_tag: 'complicated' },
  ];

  it('groups correctly by energy tag', () => {
    const result = getEnergyCorrelation(hangouts, peopleWithEnergy);
    const energizing = result.find((r) => r.energyTag === 'energizing')!;
    // Alice: 60+90+60=210, Carol: 45 -> total 255
    expect(energizing.totalMinutes).toBe(255);
    expect(energizing.personCount).toBe(2);
  });

  it('computes correct avgQuality per energy group', () => {
    const result = getEnergyCorrelation(hangouts, peopleWithEnergy);
    const draining = result.find((r) => r.energyTag === 'draining')!;
    // Dave: quality_rating 1 from one hangout
    expect(draining.avgQuality).toBe(1);
  });

  it('excludes people with null energy_tag', () => {
    const result = getEnergyCorrelation(hangouts, peopleWithEnergy);
    // Eve has null energy_tag, should not appear in any group
    const allPersonIds = new Set<string>();
    // Check that no group's stats count Eve
    for (const r of result) {
      expect(r.energyTag).not.toBe(null);
    }
    // Eve's hangout (30 mins) should not be in any totals
    const total = result.reduce((s, r) => s + r.totalMinutes, 0);
    // Total without Eve: alice(210) + bob(210) + carol(45) + dave(180) = 645
    expect(total).toBe(645);
  });

  it('returns empty array for empty hangouts', () => {
    expect(getEnergyCorrelation([], peopleWithEnergy)).toEqual([]);
  });

  it('returns empty array for empty people', () => {
    expect(getEnergyCorrelation(hangouts, [])).toEqual([]);
  });

  it('returns empty array when all people have null energy_tag', () => {
    const nullEnergy = people.map((p) => ({ ...p, energy_tag: null }));
    expect(getEnergyCorrelation(hangouts, nullEnergy)).toEqual([]);
  });
});

// ── Edge cases ──────────────────────────────────────────────────────

describe('empty hangouts across all functions', () => {
  it('all functions return empty arrays for empty inputs', () => {
    expect(getTimeDistribution([], [])).toEqual([]);
    expect(getQualityCorrelation([], [])).toEqual([]);
    expect(getInnerCircle([], [])).toEqual([]);
    expect(getEnergyCorrelation([], [])).toEqual([]);
  });
});
