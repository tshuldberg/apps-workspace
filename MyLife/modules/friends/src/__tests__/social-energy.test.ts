import { describe, it, expect } from 'vitest';
import {
  getWeekStart,
  calculateWeeklySocialTime,
  generateWeeklySummary,
  getAverageWeeklySocialHours,
  getSocialPattern,
  detectOverSocializing,
  detectUnderSocializing,
  generatePatternInsight,
} from '../engine/social-energy';
import type { WeeklySummary } from '../engine/social-energy';

// ── Helpers ────────────────────────────────────────────────────────────

function makeHangout(
  date: string,
  duration: number | null,
  peopleIds: string[],
  quality: number | null = null,
) {
  return {
    happened_at: date,
    duration_minutes: duration,
    people_ids: peopleIds,
    quality_rating: quality,
  };
}

function makeSummary(overrides: Partial<WeeklySummary> = {}): WeeklySummary {
  return {
    weekStart: '2026-04-13',
    totalMinutes: 360,
    hangoutCount: 3,
    uniquePeople: 4,
    averageQuality: null,
    topPerson: null,
    ...overrides,
  };
}

// ── getWeekStart ───────────────────────────────────────────────────────

describe('getWeekStart', () => {
  it('returns Monday for a Monday', () => {
    const monday = new Date('2026-04-20'); // Monday
    const result = getWeekStart(monday);
    expect(result.toISOString().slice(0, 10)).toBe('2026-04-20');
  });

  it('returns Monday for a Wednesday', () => {
    const wed = new Date('2026-04-16'); // Wednesday
    const result = getWeekStart(wed);
    expect(result.toISOString().slice(0, 10)).toBe('2026-04-13');
  });

  it('returns Monday for a Sunday', () => {
    const sun = new Date('2026-04-19'); // Sunday
    const result = getWeekStart(sun);
    expect(result.toISOString().slice(0, 10)).toBe('2026-04-13');
  });

  it('returns Monday for a Saturday', () => {
    const sat = new Date('2026-04-18'); // Saturday
    const result = getWeekStart(sat);
    expect(result.toISOString().slice(0, 10)).toBe('2026-04-13');
  });

  it('zeroes out time components', () => {
    const dateWithTime = new Date('2026-04-16T15:30:45Z');
    const result = getWeekStart(dateWithTime);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
  });
});

// ── calculateWeeklySocialTime ──────────────────────────────────────────

describe('calculateWeeklySocialTime', () => {
  const weekStart = new Date('2026-04-13'); // Monday

  it('calculates total minutes correctly', () => {
    const hangouts = [
      makeHangout('2026-04-14', 90, ['a']),
      makeHangout('2026-04-15', 120, ['b']),
    ];
    const result = calculateWeeklySocialTime(hangouts, weekStart);
    expect(result.totalMinutes).toBe(210);
  });

  it('defaults to 60 minutes for null duration', () => {
    const hangouts = [
      makeHangout('2026-04-14', null, ['a']),
      makeHangout('2026-04-15', 30, ['b']),
    ];
    const result = calculateWeeklySocialTime(hangouts, weekStart);
    expect(result.totalMinutes).toBe(90);
  });

  it('counts unique people across hangouts', () => {
    const hangouts = [
      makeHangout('2026-04-14', 60, ['a', 'b']),
      makeHangout('2026-04-15', 60, ['b', 'c']),
    ];
    const result = calculateWeeklySocialTime(hangouts, weekStart);
    expect(result.uniquePeople).toBe(3); // a, b, c
  });

  it('counts hangouts in the week', () => {
    const hangouts = [
      makeHangout('2026-04-13', 60, ['a']),
      makeHangout('2026-04-15', 60, ['b']),
      makeHangout('2026-04-17', 60, ['c']),
    ];
    const result = calculateWeeklySocialTime(hangouts, weekStart);
    expect(result.hangoutCount).toBe(3);
  });

  it('excludes hangouts outside the week', () => {
    const hangouts = [
      makeHangout('2026-04-12', 60, ['a']), // before
      makeHangout('2026-04-14', 90, ['b']), // in
      makeHangout('2026-04-20', 60, ['c']), // after (next Monday)
    ];
    const result = calculateWeeklySocialTime(hangouts, weekStart);
    expect(result.totalMinutes).toBe(90);
    expect(result.hangoutCount).toBe(1);
  });

  it('calculates average quality rating', () => {
    const hangouts = [
      makeHangout('2026-04-14', 60, ['a'], 4),
      makeHangout('2026-04-15', 60, ['b'], 5),
      makeHangout('2026-04-16', 60, ['c'], 3),
    ];
    const result = calculateWeeklySocialTime(hangouts, weekStart);
    expect(result.averageQuality).toBe(4);
  });

  it('returns null average quality when no ratings', () => {
    const hangouts = [
      makeHangout('2026-04-14', 60, ['a'], null),
      makeHangout('2026-04-15', 60, ['b'], null),
    ];
    const result = calculateWeeklySocialTime(hangouts, weekStart);
    expect(result.averageQuality).toBeNull();
  });

  it('ignores null ratings in average calculation', () => {
    const hangouts = [
      makeHangout('2026-04-14', 60, ['a'], 4),
      makeHangout('2026-04-15', 60, ['b'], null),
      makeHangout('2026-04-16', 60, ['c'], 2),
    ];
    const result = calculateWeeklySocialTime(hangouts, weekStart);
    expect(result.averageQuality).toBe(3);
  });
});

// ── generateWeeklySummary ──────────────────────────────────────────────

describe('generateWeeklySummary', () => {
  const weekStart = new Date('2026-04-13');
  const people = [
    { id: 'a', display_name: 'Alice' },
    { id: 'b', display_name: 'Bob' },
    { id: 'c', display_name: 'Carol' },
  ];

  it('identifies top person by time spent', () => {
    const hangouts = [
      makeHangout('2026-04-14', 120, ['a']),
      makeHangout('2026-04-15', 60, ['b']),
      makeHangout('2026-04-16', 30, ['c']),
    ];
    const result = generateWeeklySummary(hangouts, people, weekStart);
    expect(result.topPerson).toEqual({ id: 'a', name: 'Alice', minutes: 120 });
  });

  it('distributes time equally in group hangouts', () => {
    // 120 min hangout with a and b: 60 each
    // 90 min hangout with b alone: 90 to b
    // b total: 150, a total: 60
    const hangouts = [
      makeHangout('2026-04-14', 120, ['a', 'b']),
      makeHangout('2026-04-15', 90, ['b']),
    ];
    const result = generateWeeklySummary(hangouts, people, weekStart);
    expect(result.topPerson).toEqual({ id: 'b', name: 'Bob', minutes: 150 });
  });

  it('returns null topPerson when no hangouts in week', () => {
    const hangouts = [
      makeHangout('2026-04-10', 120, ['a']), // outside week
    ];
    const result = generateWeeklySummary(hangouts, people, weekStart);
    expect(result.topPerson).toBeNull();
  });

  it('sets weekStart to ISO date string', () => {
    const result = generateWeeklySummary([], people, weekStart);
    expect(result.weekStart).toBe('2026-04-13');
  });
});

// ── getAverageWeeklySocialHours ────────────────────────────────────────

describe('getAverageWeeklySocialHours', () => {
  it('returns 0 for empty array', () => {
    expect(getAverageWeeklySocialHours([])).toBe(0);
  });

  it('calculates correct average', () => {
    const summaries = [
      makeSummary({ totalMinutes: 360 }), // 6 hours
      makeSummary({ totalMinutes: 240 }), // 4 hours
      makeSummary({ totalMinutes: 480 }), // 8 hours
    ];
    // Average: (360 + 240 + 480) / 3 / 60 = 6
    expect(getAverageWeeklySocialHours(summaries)).toBe(6);
  });

  it('rounds to one decimal place', () => {
    const summaries = [
      makeSummary({ totalMinutes: 100 }),
      makeSummary({ totalMinutes: 200 }),
    ];
    // Average: 150 min = 2.5 hours
    expect(getAverageWeeklySocialHours(summaries)).toBe(2.5);
  });
});

// ── getSocialPattern ───────────────────────────────────────────────────

describe('getSocialPattern', () => {
  it('returns insufficient_data for fewer than 4 weeks', () => {
    const summaries = [
      makeSummary({ totalMinutes: 360 }),
      makeSummary({ totalMinutes: 360 }),
      makeSummary({ totalMinutes: 360 }),
    ];
    expect(getSocialPattern(summaries)).toBe('insufficient_data');
  });

  it('returns insufficient_data when custom minWeeks not met', () => {
    const summaries = Array.from({ length: 5 }, () => makeSummary({ totalMinutes: 200 }));
    expect(getSocialPattern(summaries, 6)).toBe('insufficient_data');
  });

  it('detects consistent pattern (low variance)', () => {
    const summaries = [
      makeSummary({ totalMinutes: 300 }),
      makeSummary({ totalMinutes: 310 }),
      makeSummary({ totalMinutes: 290 }),
      makeSummary({ totalMinutes: 305 }),
      makeSummary({ totalMinutes: 295 }),
    ];
    expect(getSocialPattern(summaries)).toBe('consistent');
  });

  it('detects increasing trend', () => {
    const summaries = [
      makeSummary({ totalMinutes: 100 }),
      makeSummary({ totalMinutes: 150 }),
      makeSummary({ totalMinutes: 200 }),
      makeSummary({ totalMinutes: 250 }),
    ];
    expect(getSocialPattern(summaries)).toBe('increasing');
  });

  it('detects decreasing trend', () => {
    const summaries = [
      makeSummary({ totalMinutes: 400 }),
      makeSummary({ totalMinutes: 350 }),
      makeSummary({ totalMinutes: 300 }),
      makeSummary({ totalMinutes: 250 }),
    ];
    expect(getSocialPattern(summaries)).toBe('decreasing');
  });

  it('detects variable pattern (high variance, no trend)', () => {
    const summaries = [
      makeSummary({ totalMinutes: 100 }),
      makeSummary({ totalMinutes: 400 }),
      makeSummary({ totalMinutes: 50 }),
      makeSummary({ totalMinutes: 300 }),
      makeSummary({ totalMinutes: 120 }),
      makeSummary({ totalMinutes: 350 }),
    ];
    expect(getSocialPattern(summaries)).toBe('variable');
  });
});

// ── detectOverSocializing ──────────────────────────────────────────────

describe('detectOverSocializing', () => {
  it('returns true at 2.1x average', () => {
    expect(detectOverSocializing(210, 100)).toBe(true);
  });

  it('returns false at 1.9x average', () => {
    expect(detectOverSocializing(190, 100)).toBe(false);
  });

  it('returns false at exactly 2x average', () => {
    expect(detectOverSocializing(200, 100)).toBe(false);
  });

  it('returns false when average is 0', () => {
    expect(detectOverSocializing(100, 0)).toBe(false);
  });
});

// ── detectUnderSocializing ─────────────────────────────────────────────

describe('detectUnderSocializing', () => {
  it('returns true at 0.2x average', () => {
    expect(detectUnderSocializing(20, 100)).toBe(true);
  });

  it('returns false at 0.4x average', () => {
    expect(detectUnderSocializing(40, 100)).toBe(false);
  });

  it('returns false at exactly 0.3x average', () => {
    expect(detectUnderSocializing(30, 100)).toBe(false);
  });

  it('returns false when average is 0', () => {
    expect(detectUnderSocializing(0, 0)).toBe(false);
  });
});

// ── generatePatternInsight ─────────────────────────────────────────────

describe('generatePatternInsight', () => {
  it('generates consistent insight', () => {
    const result = generatePatternInsight('consistent', 6);
    expect(result).toContain('consistent');
    expect(result).toContain('6');
    expect(result).not.toMatch(/should|try|need/i);
  });

  it('generates increasing insight', () => {
    const result = generatePatternInsight('increasing', 8);
    expect(result).toContain('increasing');
    expect(result).not.toMatch(/should|try|need/i);
  });

  it('generates decreasing insight', () => {
    const result = generatePatternInsight('decreasing', 3);
    expect(result).toContain('tapering');
    expect(result).not.toMatch(/should|try|need/i);
  });

  it('generates variable insight', () => {
    const result = generatePatternInsight('variable', 5);
    expect(result).toContain('varies');
    expect(result).toContain('5');
    expect(result).not.toMatch(/should|try|need/i);
  });

  it('generates insufficient_data insight', () => {
    const result = generatePatternInsight('insufficient_data', 0);
    expect(result).toContain('Not enough data');
    expect(result).not.toMatch(/should|try|need/i);
  });

  it('never uses prescriptive language', () => {
    const patterns: Array<'consistent' | 'increasing' | 'decreasing' | 'variable' | 'insufficient_data'> = [
      'consistent', 'increasing', 'decreasing', 'variable', 'insufficient_data',
    ];
    for (const pattern of patterns) {
      const result = generatePatternInsight(pattern, 5);
      expect(result).not.toMatch(/should|must|need to|try to|you should|consider/i);
    }
  });
});
