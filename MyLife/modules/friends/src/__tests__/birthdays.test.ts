import { describe, it, expect } from 'vitest';
import {
  getDaysUntilBirthday,
  getAge,
  getTurningAge,
  getUpcomingBirthdays,
  getFriendshipAnniversaries,
  shouldTriggerReminder,
  getBirthdayMonth,
  generateDaysUntilLabel,
  formatBirthdayDate,
} from '../engine/birthdays';

// Fixed reference date: April 20, 2026
const NOW = new Date('2026-04-20T12:00:00Z');

// ── getDaysUntilBirthday ──────────────────────────────────────────────

describe('getDaysUntilBirthday', () => {
  it('returns 0 for birthday today (YYYY-MM-DD)', () => {
    expect(getDaysUntilBirthday('1990-04-20', NOW)).toBe(0);
  });

  it('returns 0 for birthday today (MM-DD)', () => {
    expect(getDaysUntilBirthday('04-20', NOW)).toBe(0);
  });

  it('returns 1 for birthday tomorrow', () => {
    expect(getDaysUntilBirthday('1990-04-21', NOW)).toBe(1);
  });

  it('returns 10 for birthday 10 days away', () => {
    expect(getDaysUntilBirthday('1990-04-30', NOW)).toBe(10);
  });

  it('handles year wrapping (Dec birthday checked in April)', () => {
    // Dec 25 from April 20 = 249 days
    const result = getDaysUntilBirthday('1990-12-25', NOW);
    expect(result).toBe(249);
  });

  it('handles year wrapping (Jan birthday checked in Nov)', () => {
    const novRef = new Date('2026-11-15T12:00:00Z');
    // Jan 10 from Nov 15 = 56 days (Nov has 15 remaining + Dec 31 + Jan 10 = 56)
    const result = getDaysUntilBirthday('1990-01-10', novRef);
    expect(result).toBe(56);
  });

  it('handles birthday that just passed (yesterday)', () => {
    // April 19 from April 20: already passed, next is April 19 2027
    const result = getDaysUntilBirthday('1990-04-19', NOW);
    expect(result).toBe(364);
  });

  it('handles leap year Feb 29 birthday from non-leap year ref', () => {
    // 2026 is not a leap year. Feb 29 -> March 1 in non-leap years.
    // From April 20 2026, next "Feb 29" occurrence:
    // Date constructor with Feb 29 in non-leap year rolls to March 1.
    const result = getDaysUntilBirthday('2000-02-29', NOW);
    // March 1 2027 from April 20 2026 = 315 days
    expect(result).toBe(315);
  });

  it('handles MM-DD format', () => {
    expect(getDaysUntilBirthday('05-01', NOW)).toBe(11);
  });
});

// ── getAge ────────────────────────────────────────────────────────────

describe('getAge', () => {
  it('returns correct age for YYYY-MM-DD (birthday already passed this year)', () => {
    // Born Jan 15 1990, ref is April 20 2026 -> age 36
    expect(getAge('1990-01-15', NOW)).toBe(36);
  });

  it('returns correct age for YYYY-MM-DD (birthday today)', () => {
    // Born April 20 1990, ref is April 20 2026 -> age 36
    expect(getAge('1990-04-20', NOW)).toBe(36);
  });

  it('returns correct age for YYYY-MM-DD (birthday not yet this year)', () => {
    // Born June 15 1990, ref is April 20 2026 -> still 35
    expect(getAge('1990-06-15', NOW)).toBe(35);
  });

  it('returns null for MM-DD format (no year)', () => {
    expect(getAge('06-15', NOW)).toBeNull();
  });

  it('returns null for MM-DD with leading zero', () => {
    expect(getAge('01-05', NOW)).toBeNull();
  });
});

// ── getTurningAge ─────────────────────────────────────────────────────

describe('getTurningAge', () => {
  it('returns next birthday age for birthday not yet passed', () => {
    // Born June 15 1990, currently 35, turning 36
    expect(getTurningAge('1990-06-15', NOW)).toBe(36);
  });

  it('returns next birthday age for birthday today', () => {
    // Born April 20 1990, currently 36, turning 37
    expect(getTurningAge('1990-04-20', NOW)).toBe(37);
  });

  it('returns null for MM-DD format', () => {
    expect(getTurningAge('06-15', NOW)).toBeNull();
  });
});

// ── getUpcomingBirthdays ──────────────────────────────────────────────

describe('getUpcomingBirthdays', () => {
  const people = [
    { id: '1', display_name: 'Alice', birthday: '1990-04-25' }, // 5 days away
    { id: '2', display_name: 'Bob', birthday: '1985-05-10' },   // 20 days away
    { id: '3', display_name: 'Charlie', birthday: null },         // no birthday
    { id: '4', display_name: 'Diana', birthday: '04-22' },       // 2 days, no year
    { id: '5', display_name: 'Eve', birthday: '1995-12-25' },    // 249 days away
  ];

  it('returns birthdays sorted by proximity', () => {
    const result = getUpcomingBirthdays(people, 90, NOW);
    expect(result).toHaveLength(3); // Alice(5), Diana(2), Bob(20) -- Eve excluded (249 > 90)
    expect(result[0].display_name).toBe('Diana');
    expect(result[0].daysUntil).toBe(2);
    expect(result[1].display_name).toBe('Alice');
    expect(result[1].daysUntil).toBe(5);
    expect(result[2].display_name).toBe('Bob');
    expect(result[2].daysUntil).toBe(20);
  });

  it('excludes people without birthdays', () => {
    const result = getUpcomingBirthdays(people, 365, NOW);
    const ids = result.map((r) => r.id);
    expect(ids).not.toContain('3');
  });

  it('respects daysAhead limit', () => {
    const result = getUpcomingBirthdays(people, 3, NOW);
    expect(result).toHaveLength(1); // only Diana (2 days)
    expect(result[0].display_name).toBe('Diana');
  });

  it('includes age when year is known', () => {
    const result = getUpcomingBirthdays(people, 90, NOW);
    const alice = result.find((r) => r.id === '1');
    expect(alice?.age).toBe(36); // turning 36 on April 25
  });

  it('returns null age when year is unknown (MM-DD)', () => {
    const result = getUpcomingBirthdays(people, 90, NOW);
    const diana = result.find((r) => r.id === '4');
    expect(diana?.age).toBeNull();
  });

  it('defaults daysAhead to 90', () => {
    const result = getUpcomingBirthdays(people, undefined, NOW);
    // Eve (249 days) should be excluded
    const ids = result.map((r) => r.id);
    expect(ids).not.toContain('5');
  });
});

// ── getFriendshipAnniversaries ────────────────────────────────────────

describe('getFriendshipAnniversaries', () => {
  const people = [
    { id: '1', display_name: 'Alice', when_met: '2024-04-25' }, // 2 days, 2 years
    { id: '2', display_name: 'Bob', when_met: '2020-05-10' },   // 20 days, 6 years
    { id: '3', display_name: 'Charlie', when_met: null },
    { id: '4', display_name: 'Diana', when_met: '2023-12-25' }, // 249 days
  ];

  it('returns anniversaries sorted by proximity', () => {
    const result = getFriendshipAnniversaries(people, 90, NOW);
    expect(result).toHaveLength(2);
    expect(result[0].display_name).toBe('Alice');
    expect(result[0].daysUntil).toBe(5);
    expect(result[1].display_name).toBe('Bob');
    expect(result[1].daysUntil).toBe(20);
  });

  it('excludes people without when_met', () => {
    const result = getFriendshipAnniversaries(people, 365, NOW);
    const ids = result.map((r) => r.id);
    expect(ids).not.toContain('3');
  });

  it('calculates years correctly', () => {
    const result = getFriendshipAnniversaries(people, 90, NOW);
    const alice = result.find((r) => r.id === '1');
    expect(alice?.years).toBe(2); // Met 2024, anniversary in 2026 = 2 years
  });
});

// ── shouldTriggerReminder ─────────────────────────────────────────────

describe('shouldTriggerReminder', () => {
  it('triggers at 7 days before', () => {
    // Birthday April 27, ref April 20 = 7 days
    const result = shouldTriggerReminder('1990-04-27', [7, 1], NOW);
    expect(result.trigger).toBe(true);
    expect(result.daysUntil).toBe(7);
  });

  it('triggers at 1 day before', () => {
    // Birthday April 21, ref April 20 = 1 day
    const result = shouldTriggerReminder('1990-04-21', [7, 1], NOW);
    expect(result.trigger).toBe(true);
    expect(result.daysUntil).toBe(1);
  });

  it('triggers at 0 days (today)', () => {
    const result = shouldTriggerReminder('1990-04-20', [7, 1, 0], NOW);
    expect(result.trigger).toBe(true);
    expect(result.daysUntil).toBe(0);
  });

  it('does not trigger at 15 days when only [7, 1] configured', () => {
    // Birthday May 5, ref April 20 = 15 days
    const result = shouldTriggerReminder('1990-05-05', [7, 1], NOW);
    expect(result.trigger).toBe(false);
    expect(result.daysUntil).toBe(15);
  });

  it('does not trigger when no matching threshold', () => {
    // Birthday April 25, ref April 20 = 5 days. Thresholds: [7, 1, 0]
    const result = shouldTriggerReminder('1990-04-25', [7, 1, 0], NOW);
    expect(result.trigger).toBe(false);
    expect(result.daysUntil).toBe(5);
  });
});

// ── getBirthdayMonth ──────────────────────────────────────────────────

describe('getBirthdayMonth', () => {
  const people = [
    { birthday: '1990-04-15' },
    { birthday: '1985-04-25' },
    { birthday: '1992-05-10' },
    { birthday: '06-15' },
    { birthday: null },
  ];

  it('filters to April birthdays', () => {
    const result = getBirthdayMonth(people, 4);
    expect(result).toHaveLength(2);
  });

  it('filters MM-DD format correctly', () => {
    const result = getBirthdayMonth(people, 6);
    expect(result).toHaveLength(1);
  });

  it('excludes people without birthdays', () => {
    const result = getBirthdayMonth(people, 4);
    expect(result.every((p) => p.birthday !== null)).toBe(true);
  });

  it('returns empty for months with no birthdays', () => {
    const result = getBirthdayMonth(people, 1);
    expect(result).toHaveLength(0);
  });
});

// ── Display helpers ───────────────────────────────────────────────────

describe('generateDaysUntilLabel', () => {
  it('returns "Today!" for 0', () => {
    expect(generateDaysUntilLabel(0)).toBe('Today!');
  });

  it('returns "Tomorrow" for 1', () => {
    expect(generateDaysUntilLabel(1)).toBe('Tomorrow');
  });

  it('returns "In 5 days" for 5', () => {
    expect(generateDaysUntilLabel(5)).toBe('In 5 days');
  });

  it('returns "Next week" for 8', () => {
    expect(generateDaysUntilLabel(8)).toBe('Next week');
  });

  it('returns "In 3 weeks" for 21', () => {
    expect(generateDaysUntilLabel(21)).toBe('In 3 weeks');
  });

  it('returns "Next month" for 35', () => {
    expect(generateDaysUntilLabel(35)).toBe('Next month');
  });

  it('returns "In 3 months" for 90', () => {
    expect(generateDaysUntilLabel(90)).toBe('In 3 months');
  });
});

describe('formatBirthdayDate', () => {
  it('formats YYYY-MM-DD', () => {
    expect(formatBirthdayDate('1990-06-15')).toBe('June 15');
  });

  it('formats MM-DD', () => {
    expect(formatBirthdayDate('12-25')).toBe('December 25');
  });

  it('formats single-digit day', () => {
    expect(formatBirthdayDate('01-05')).toBe('January 5');
  });
});
