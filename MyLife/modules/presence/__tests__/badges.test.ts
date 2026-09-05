import { describe, expect, it } from 'vitest';
import {
  BADGE_DEFS,
  buildBadgeStatsSnapshotFromData,
  computeEarnedBadges,
  getBadgeCurrentValue,
  getBadgeProgress,
} from '../src/engines';
import type { DailyUsage, FocusSession } from '../src/types';

const DAILY_USAGE: DailyUsage[] = [
  {
    id: 'day-1',
    date: '2026-04-01',
    total_minutes: 120,
    goal_minutes: 180,
    goal_met: 1,
    pickups: 6,
    first_pickup: '2026-04-01T08:10:00',
    last_pickup: '2026-04-01T21:15:00',
    created_at: '2026-04-01T08:10:00',
  },
  {
    id: 'day-2',
    date: '2026-04-02',
    total_minutes: 90,
    goal_minutes: 180,
    goal_met: 1,
    pickups: 4,
    first_pickup: '2026-04-02T08:05:00',
    last_pickup: '2026-04-02T20:45:00',
    created_at: '2026-04-02T08:05:00',
  },
  {
    id: 'day-3',
    date: '2026-04-03',
    total_minutes: 45,
    goal_minutes: 180,
    goal_met: 1,
    pickups: 2,
    first_pickup: '2026-04-03T09:20:00',
    last_pickup: '2026-04-03T19:30:00',
    created_at: '2026-04-03T09:20:00',
  },
  {
    id: 'day-4',
    date: '2026-04-04',
    total_minutes: 0,
    goal_minutes: 180,
    goal_met: 1,
    pickups: 0,
    first_pickup: null,
    last_pickup: null,
    created_at: '2026-04-04T00:00:00',
  },
  {
    id: 'day-5',
    date: '2026-04-05',
    total_minutes: 50,
    goal_minutes: 180,
    goal_met: 1,
    pickups: 1,
    first_pickup: '2026-04-05T10:00:00',
    last_pickup: '2026-04-05T18:00:00',
    created_at: '2026-04-05T10:00:00',
  },
  {
    id: 'day-6',
    date: '2026-04-06',
    total_minutes: 40,
    goal_minutes: 180,
    goal_met: 1,
    pickups: 1,
    first_pickup: '2026-04-06T07:55:00',
    last_pickup: '2026-04-06T17:45:00',
    created_at: '2026-04-06T07:55:00',
  },
  {
    id: 'day-7',
    date: '2026-04-07',
    total_minutes: 35,
    goal_minutes: 180,
    goal_met: 1,
    pickups: 1,
    first_pickup: '2026-04-07T07:40:00',
    last_pickup: '2026-04-07T17:10:00',
    created_at: '2026-04-07T07:40:00',
  },
];

const SESSIONS: FocusSession[] = [
  {
    id: 'session-1',
    start_time: '2026-04-01T07:10:00',
    end_time: '2026-04-01T07:35:00',
    planned_minutes: 25,
    actual_minutes: 25,
    completed: 1,
    type: 'solo',
    rating: 4,
    created_at: '2026-04-01T07:10:00',
  },
  {
    id: 'session-2',
    start_time: '2026-04-03T21:15:00',
    end_time: '2026-04-03T22:45:00',
    planned_minutes: 90,
    actual_minutes: 90,
    completed: 1,
    type: 'beast',
    rating: 5,
    created_at: '2026-04-03T21:15:00',
  },
];

describe('presence badge engine', () => {
  it('builds an enriched snapshot from raw presence data', () => {
    const stats = buildBadgeStatsSnapshotFromData({
      dailyUsage: DAILY_USAGE,
      sessions: SESSIONS,
      totalXP: 1400,
      activeIntentions: 10,
      mindfulOpenCount: 11,
      hubVisits: 1,
    });

    expect(stats.currentStreak).toBe(7);
    expect(stats.longestStreak).toBe(7);
    expect(stats.completedSessions).toBe(2);
    expect(stats.beastSessions).toBe(1);
    expect(stats.morningSessions).toBe(1);
    expect(stats.nightSessions).toBe(1);
    expect(stats.fullDayOffCount).toBe(1);
    expect(stats.activeIntentions).toBe(10);
    expect(stats.hubVisits).toBe(1);
  });

  it('earns milestone, special, and screen-time badges from the snapshot', () => {
    const stats = buildBadgeStatsSnapshotFromData({
      dailyUsage: DAILY_USAGE,
      sessions: SESSIONS,
      totalXP: 1400,
      activeIntentions: 10,
      mindfulOpenCount: 11,
      hubVisits: 1,
    });

    const earnedIds = computeEarnedBadges(stats).map((badge) => badge.id);

    expect(earnedIds).toEqual(expect.arrayContaining([
      'first-day',
      'seven-day-streak',
      'first-focus',
      'marathon',
      'under-goal',
      'full-day-off',
      'xp-thousand',
      'app-tamer',
      'mindful-open',
      'discoverer',
    ]));
  });

  it('reports raw progress for locked badges', () => {
    const stats = buildBadgeStatsSnapshotFromData({
      dailyUsage: DAILY_USAGE,
      sessions: SESSIONS,
      totalXP: 1400,
      activeIntentions: 2,
    });
    const ninetyDay = BADGE_DEFS.find((badge) => badge.id === 'ninety-day-streak');

    expect(ninetyDay).toBeDefined();
    expect(getBadgeCurrentValue(ninetyDay!, stats)).toBe(7);
    expect(getBadgeProgress(ninetyDay!, stats)).toBeCloseTo(7 / 90, 5);
  });
});
