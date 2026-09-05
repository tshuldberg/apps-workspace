import { beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import {
  awardXP,
  completeFocusSession,
  createFocusSession,
  getEarnedBadges,
  recordAppOpen,
  setSetting,
  upsertAppIntention,
  upsertDailyUsage,
} from '../src/db';
import { buildBadgeStatsSnapshot, syncBadges } from '../src/engines';
import { createTestAdapter } from './test-db';

describe('badge sync', () => {
  let db: DatabaseAdapter;

  beforeEach(() => {
    db = createTestAdapter();
  });

  it('builds badge stats from persisted presence data', () => {
    upsertDailyUsage(db, {
      date: '2026-04-05',
      total_minutes: 45,
      goal_minutes: 180,
      goal_met: true,
      pickups: 3,
    });
    upsertDailyUsage(db, {
      date: '2026-04-06',
      total_minutes: 0,
      goal_minutes: 180,
      goal_met: true,
      pickups: 0,
    });

    upsertAppIntention(db, {
      app_id: 'mail',
      app_name: 'Mail',
      daily_open_limit: 3,
    });

    const morning = createFocusSession(db, {
      planned_minutes: 25,
      type: 'solo',
    });
    db.execute('UPDATE pr_sessions SET start_time = ? WHERE id = ?', ['2026-04-06T06:30:00', morning.id]);
    completeFocusSession(db, morning.id, 25, 4);

    const night = createFocusSession(db, {
      planned_minutes: 50,
      type: 'beast',
    });
    db.execute('UPDATE pr_sessions SET start_time = ? WHERE id = ?', ['2026-04-06T22:15:00', night.id]);
    completeFocusSession(db, night.id, 50, 5);

    recordAppOpen(db, {
      date: '2026-04-06',
      app_id: 'mail',
      intention_text: 'Check one reply',
    });
    awardXP(db, { date: '2026-04-06', source: 'session', amount: 250 });
    setSetting(db, 'hub_visit_count', '3');

    const stats = buildBadgeStatsSnapshot(db);
    expect(stats.completedSessions).toBe(2);
    expect(stats.beastSessions).toBe(1);
    expect(stats.morningSessions).toBe(1);
    expect(stats.nightSessions).toBe(1);
    expect(stats.activeIntentions).toBe(1);
    expect(stats.mindfulOpenCount).toBe(1);
    expect(stats.hubVisits).toBe(3);
    expect(stats.daysUnderGoal).toBe(2);
  });

  it('persists newly earned badges once', async () => {
    upsertDailyUsage(db, {
      date: '2026-04-06',
      total_minutes: 0,
      goal_minutes: 180,
      goal_met: true,
      pickups: 0,
    });

    const session = createFocusSession(db, {
      planned_minutes: 45,
      type: 'solo',
    });
    completeFocusSession(db, session.id, 45, 5);

    for (let index = 0; index < 10; index += 1) {
      recordAppOpen(db, {
        date: '2026-04-06',
        app_id: `intentional-${index}`,
        intention_text: 'Use with purpose',
      });
    }

    awardXP(db, { date: '2026-04-06', source: 'session', amount: 1000 });
    setSetting(db, 'hub_visit_count', '1');

    const firstSync = await syncBadges(db);
    const earnedIds = firstSync.newlyEarned.map((badge) => badge.id);

    expect(earnedIds).toEqual(expect.arrayContaining([
      'first-day',
      'first-focus',
      'half-day-off',
      'full-day-off',
      'mindful-open',
      'discoverer',
      'xp-thousand',
    ]));
    expect(getEarnedBadges(db).map((badge) => badge.badgeId)).toEqual(expect.arrayContaining(earnedIds));

    const secondSync = await syncBadges(db);
    expect(secondSync.newlyEarned).toHaveLength(0);
  });
});
