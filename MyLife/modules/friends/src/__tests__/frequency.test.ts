import { describe, it, expect } from 'vitest';
import {
  calculateDaysSinceLastSeen,
  getFrequencyStatus,
  generateLastSeenLabel,
  getFrequencyColor,
  getOverduePeople,
  getApproachingPeople,
} from '../engine/frequency';

// Fixed reference date for deterministic tests
const NOW = new Date('2026-04-20T12:00:00Z');

function daysAgo(n: number): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// ── calculateDaysSinceLastSeen ──────────────────────────────────────

describe('calculateDaysSinceLastSeen', () => {
  it('returns 0 for today', () => {
    expect(calculateDaysSinceLastSeen(daysAgo(0), NOW)).toBe(0);
  });

  it('returns 1 for yesterday', () => {
    expect(calculateDaysSinceLastSeen(daysAgo(1), NOW)).toBe(1);
  });

  it('returns 30 for 30 days ago', () => {
    expect(calculateDaysSinceLastSeen(daysAgo(30), NOW)).toBe(30);
  });

  it('returns null when lastHangoutDate is null', () => {
    expect(calculateDaysSinceLastSeen(null, NOW)).toBeNull();
  });

  it('uses custom now parameter', () => {
    const customNow = new Date('2026-01-15T12:00:00Z');
    const date = '2026-01-10';
    expect(calculateDaysSinceLastSeen(date, customNow)).toBe(5);
  });
});

// ── getFrequencyStatus ──────────────────────────────────────────────

describe('getFrequencyStatus', () => {
  it('returns no-goal when goalDays is null', () => {
    expect(getFrequencyStatus(10, null)).toBe('no-goal');
  });

  it('returns overdue when daysSince is null (never seen) but has a goal', () => {
    expect(getFrequencyStatus(null, 30)).toBe('overdue');
  });

  it('returns on-track when daysSince < 70% of goal (5/30)', () => {
    expect(getFrequencyStatus(5, 30)).toBe('on-track');
  });

  it('returns approaching at exactly 70% of goal (21/30)', () => {
    expect(getFrequencyStatus(21, 30)).toBe('approaching');
  });

  it('returns approaching between 70% and 100% (25/30)', () => {
    expect(getFrequencyStatus(25, 30)).toBe('approaching');
  });

  it('returns overdue at exactly 100% of goal (30/30)', () => {
    expect(getFrequencyStatus(30, 30)).toBe('overdue');
  });

  it('returns overdue beyond goal (45/30)', () => {
    expect(getFrequencyStatus(45, 30)).toBe('overdue');
  });

  it('returns on-track just below 70% boundary (20/30)', () => {
    // 20 < 30 * 0.7 = 21 -> on-track
    expect(getFrequencyStatus(20, 30)).toBe('on-track');
  });
});

// ── generateLastSeenLabel ───────────────────────────────────────────

describe('generateLastSeenLabel', () => {
  it('returns "Never hung out" for null', () => {
    expect(generateLastSeenLabel(null)).toBe('Never hung out');
  });

  it('returns "Today" for 0', () => {
    expect(generateLastSeenLabel(0)).toBe('Today');
  });

  it('returns "Yesterday" for 1', () => {
    expect(generateLastSeenLabel(1)).toBe('Yesterday');
  });

  it('returns "5 days ago" for 5', () => {
    expect(generateLastSeenLabel(5)).toBe('5 days ago');
  });

  it('returns "1 week ago" for 7', () => {
    expect(generateLastSeenLabel(7)).toBe('1 week ago');
  });

  it('returns "2 weeks ago" for 14', () => {
    expect(generateLastSeenLabel(14)).toBe('2 weeks ago');
  });

  it('returns "1 month ago" for 30', () => {
    expect(generateLastSeenLabel(30)).toBe('1 month ago');
  });

  it('returns "3 months ago" for 90', () => {
    expect(generateLastSeenLabel(90)).toBe('3 months ago');
  });

  it('returns "Over a year ago" for 400', () => {
    expect(generateLastSeenLabel(400)).toBe('Over a year ago');
  });
});

// ── getFrequencyColor ───────────────────────────────────────────────

describe('getFrequencyColor', () => {
  it('returns green for on-track', () => {
    expect(getFrequencyColor('on-track')).toBe('#10B981');
  });

  it('returns yellow for approaching', () => {
    expect(getFrequencyColor('approaching')).toBe('#F59E0B');
  });

  it('returns red for overdue', () => {
    expect(getFrequencyColor('overdue')).toBe('#EF4444');
  });

  it('returns gray for no-goal', () => {
    expect(getFrequencyColor('no-goal')).toBe('#9F8E81');
  });
});

// ── getOverduePeople ────────────────────────────────────────────────

describe('getOverduePeople', () => {
  const people = [
    { id: 'overdue-1', frequency_goal_days: 14, lastHangoutDate: daysAgo(20) },
    { id: 'on-track-1', frequency_goal_days: 30, lastHangoutDate: daysAgo(5) },
    { id: 'no-goal-1', frequency_goal_days: null, lastHangoutDate: daysAgo(100) },
    { id: 'never-seen', frequency_goal_days: 7, lastHangoutDate: null },
    { id: 'approaching-1', frequency_goal_days: 30, lastHangoutDate: daysAgo(22) },
  ];

  it('filters correctly with a mix of statuses', () => {
    const result = getOverduePeople(people, NOW);
    const ids = result.map((r) => r.id);
    expect(ids).toContain('overdue-1');
    expect(ids).toContain('never-seen');
    expect(ids).not.toContain('on-track-1');
    expect(ids).not.toContain('approaching-1');
  });

  it('excludes people with no goal', () => {
    const result = getOverduePeople(people, NOW);
    const ids = result.map((r) => r.id);
    expect(ids).not.toContain('no-goal-1');
  });

  it('includes people never seen who have a goal', () => {
    const result = getOverduePeople(people, NOW);
    const match = result.find((r) => r.id === 'never-seen');
    expect(match).toBeDefined();
    expect(match!.daysSince).toBeNull();
    expect(match!.goalDays).toBe(7);
  });
});

// ── getApproachingPeople ────────────────────────────────────────────

describe('getApproachingPeople', () => {
  const people = [
    { id: 'overdue-1', frequency_goal_days: 14, lastHangoutDate: daysAgo(20) },
    { id: 'on-track-1', frequency_goal_days: 30, lastHangoutDate: daysAgo(5) },
    { id: 'approaching-1', frequency_goal_days: 30, lastHangoutDate: daysAgo(22) },
    { id: 'approaching-2', frequency_goal_days: 10, lastHangoutDate: daysAgo(8) },
    { id: 'no-goal-1', frequency_goal_days: null, lastHangoutDate: daysAgo(50) },
  ];

  it('returns only approaching-status people', () => {
    const result = getApproachingPeople(people, NOW);
    const ids = result.map((r) => r.id);
    expect(ids).toContain('approaching-1');
    expect(ids).toContain('approaching-2');
    expect(ids).toHaveLength(2);
  });

  it('excludes on-track and overdue', () => {
    const result = getApproachingPeople(people, NOW);
    const ids = result.map((r) => r.id);
    expect(ids).not.toContain('on-track-1');
    expect(ids).not.toContain('overdue-1');
    expect(ids).not.toContain('no-goal-1');
  });
});
