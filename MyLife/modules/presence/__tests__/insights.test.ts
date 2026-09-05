import { describe, expect, it } from 'vitest';
import {
  detectGoalRegression,
  detectMorningPickupTrend,
  detectSessionTimeOfDay,
  detectWeekendPattern,
  generatePresenceInsights,
} from '../src/engines';
import type { DailyUsage, FocusSession } from '../src/types';

const DAILY_USAGE: DailyUsage[] = [
  { id: '1', date: '2026-03-24', total_minutes: 90, goal_minutes: 180, goal_met: 1, pickups: 5, first_pickup: '2026-03-24T08:30:00', last_pickup: '2026-03-24T21:00:00', created_at: '2026-03-24T08:30:00' },
  { id: '2', date: '2026-03-25', total_minutes: 95, goal_minutes: 180, goal_met: 1, pickups: 6, first_pickup: '2026-03-25T08:25:00', last_pickup: '2026-03-25T20:50:00', created_at: '2026-03-25T08:25:00' },
  { id: '3', date: '2026-03-26', total_minutes: 92, goal_minutes: 180, goal_met: 1, pickups: 5, first_pickup: '2026-03-26T08:20:00', last_pickup: '2026-03-26T20:40:00', created_at: '2026-03-26T08:20:00' },
  { id: '4', date: '2026-03-27', total_minutes: 96, goal_minutes: 180, goal_met: 1, pickups: 5, first_pickup: '2026-03-27T08:15:00', last_pickup: '2026-03-27T20:55:00', created_at: '2026-03-27T08:15:00' },
  { id: '5', date: '2026-03-28', total_minutes: 150, goal_minutes: 180, goal_met: 0, pickups: 8, first_pickup: '2026-03-28T08:45:00', last_pickup: '2026-03-28T22:10:00', created_at: '2026-03-28T08:45:00' },
  { id: '6', date: '2026-03-29', total_minutes: 165, goal_minutes: 180, goal_met: 0, pickups: 9, first_pickup: '2026-03-29T08:50:00', last_pickup: '2026-03-29T22:30:00', created_at: '2026-03-29T08:50:00' },
  { id: '7', date: '2026-03-30', total_minutes: 135, goal_minutes: 180, goal_met: 1, pickups: 7, first_pickup: '2026-03-30T09:05:00', last_pickup: '2026-03-30T21:45:00', created_at: '2026-03-30T09:05:00' },
  { id: '8', date: '2026-03-31', total_minutes: 150, goal_minutes: 180, goal_met: 0, pickups: 8, first_pickup: '2026-03-31T09:15:00', last_pickup: '2026-03-31T22:00:00', created_at: '2026-03-31T09:15:00' },
  { id: '9', date: '2026-04-01', total_minutes: 155, goal_minutes: 180, goal_met: 0, pickups: 8, first_pickup: '2026-04-01T09:20:00', last_pickup: '2026-04-01T22:10:00', created_at: '2026-04-01T09:20:00' },
  { id: '10', date: '2026-04-02', total_minutes: 158, goal_minutes: 180, goal_met: 0, pickups: 8, first_pickup: '2026-04-02T09:25:00', last_pickup: '2026-04-02T22:05:00', created_at: '2026-04-02T09:25:00' },
  { id: '11', date: '2026-04-03', total_minutes: 162, goal_minutes: 180, goal_met: 0, pickups: 9, first_pickup: '2026-04-03T09:30:00', last_pickup: '2026-04-03T22:15:00', created_at: '2026-04-03T09:30:00' },
  { id: '12', date: '2026-04-04', total_minutes: 205, goal_minutes: 180, goal_met: 0, pickups: 12, first_pickup: '2026-04-04T09:35:00', last_pickup: '2026-04-04T23:10:00', created_at: '2026-04-04T09:35:00' },
  { id: '13', date: '2026-04-05', total_minutes: 210, goal_minutes: 180, goal_met: 0, pickups: 13, first_pickup: '2026-04-05T09:40:00', last_pickup: '2026-04-05T23:20:00', created_at: '2026-04-05T09:40:00' },
  { id: '14', date: '2026-04-06', total_minutes: 195, goal_minutes: 180, goal_met: 0, pickups: 11, first_pickup: '2026-04-06T09:45:00', last_pickup: '2026-04-06T22:50:00', created_at: '2026-04-06T09:45:00' },
];

const SESSIONS: FocusSession[] = [
  { id: 's1', start_time: '2026-04-01T07:10:00', end_time: '2026-04-01T07:35:00', planned_minutes: 25, actual_minutes: 25, completed: 1, type: 'solo', rating: 4, created_at: '2026-04-01T07:10:00' },
  { id: 's2', start_time: '2026-04-02T07:20:00', end_time: '2026-04-02T07:45:00', planned_minutes: 25, actual_minutes: 25, completed: 1, type: 'solo', rating: 4, created_at: '2026-04-02T07:20:00' },
  { id: 's3', start_time: '2026-04-03T07:40:00', end_time: '2026-04-03T08:05:00', planned_minutes: 25, actual_minutes: 25, completed: 1, type: 'solo', rating: 5, created_at: '2026-04-03T07:40:00' },
];

describe('presence insights engine', () => {
  it('detects weekend drift and morning pickup changes', () => {
    expect(detectWeekendPattern(DAILY_USAGE)?.type).toBe('weekend-pattern');
    expect(detectMorningPickupTrend(DAILY_USAGE)?.type).toBe('morning-pickup-trend');
  });

  it('detects the dominant focus time of day', () => {
    const insight = detectSessionTimeOfDay(SESSIONS);

    expect(insight?.type).toBe('session-time-of-day');
    expect(insight?.title).toContain('Morning');
  });

  it('detects goal regression from recent daily data', () => {
    const insight = detectGoalRegression(DAILY_USAGE);

    expect(insight?.type).toBe('goal-regression');
    expect(insight?.severity).toBe('warning');
  });

  it('generates a compact combined insights list', () => {
    const insights = generatePresenceInsights(DAILY_USAGE, SESSIONS);

    expect(insights.length).toBeGreaterThanOrEqual(3);
    expect(insights.map((insight) => insight.type)).toEqual(expect.arrayContaining([
      'weekend-pattern',
      'morning-pickup-trend',
      'session-time-of-day',
      'goal-regression',
    ]));
  });
});
