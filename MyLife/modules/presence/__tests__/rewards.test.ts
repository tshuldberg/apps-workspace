import { beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import {
  awardXP,
  completeFocusSession,
  createFocusSession,
  createReward,
  getRewards,
  upsertDailyUsage,
} from '../src/db';
import {
  buildRewardEvaluationStats,
  getRewardMilestoneLabel,
  getRewardProgress,
  syncRewards,
  type RewardEvaluationStats,
} from '../src/engines';
import type { Reward } from '../src/types';
import { createTestAdapter } from './test-db';

function rewardFixture(overrides: Partial<Reward> = {}): Reward {
  return {
    id: 'reward-1',
    milestoneType: 'sessions',
    milestoneValue: 4,
    rewardText: 'Take a quiet walk',
    earned: false,
    earnedAt: null,
    createdAt: 1,
    ...overrides,
  };
}

describe('reward helpers', () => {
  it('formats milestone labels and progress', () => {
    const stats: RewardEvaluationStats = {
      currentStreak: 3,
      completedSessions: 2,
      totalXP: 400,
      goalMetDays: 5,
    };

    expect(getRewardMilestoneLabel({ milestoneType: 'sessions', milestoneValue: 4 })).toBe('4 sessions');
    expect(getRewardMilestoneLabel({ milestoneType: 'goal-met-days', milestoneValue: 7 })).toBe('7 goal-met days');
    expect(getRewardProgress(rewardFixture(), stats)).toBe(0.5);
    expect(getRewardProgress(rewardFixture({ milestoneType: 'xp', milestoneValue: 200 }), stats)).toBe(1);
  });
});

describe('reward sync', () => {
  let db: DatabaseAdapter;

  beforeEach(() => {
    db = createTestAdapter();
  });

  it('builds reward stats and marks only due rewards as earned', async () => {
    upsertDailyUsage(db, {
      date: '2026-04-04',
      total_minutes: 110,
      goal_minutes: 180,
      goal_met: true,
      pickups: 4,
    });
    upsertDailyUsage(db, {
      date: '2026-04-05',
      total_minutes: 120,
      goal_minutes: 180,
      goal_met: true,
      pickups: 5,
    });
    upsertDailyUsage(db, {
      date: '2026-04-06',
      total_minutes: 95,
      goal_minutes: 180,
      goal_met: true,
      pickups: 3,
    });

    const first = createFocusSession(db, { planned_minutes: 25, type: 'solo' });
    completeFocusSession(db, first.id, 25, 4);
    const second = createFocusSession(db, { planned_minutes: 45, type: 'group' });
    completeFocusSession(db, second.id, 45, 5);

    awardXP(db, { date: '2026-04-06', source: 'session', amount: 400 });

    const streakReward = createReward(db, {
      milestoneType: 'streak',
      milestoneValue: 3,
      rewardText: 'Order your favorite tea',
    });
    const sessionsReward = createReward(db, {
      milestoneType: 'sessions',
      milestoneValue: 2,
      rewardText: 'Buy flowers',
    });
    createReward(db, {
      milestoneType: 'xp',
      milestoneValue: 500,
      rewardText: 'Movie night',
    });

    const stats = buildRewardEvaluationStats(db);
    expect(stats.currentStreak).toBe(3);
    expect(stats.completedSessions).toBe(2);
    expect(stats.totalXP).toBe(400);
    expect(stats.goalMetDays).toBe(3);

    const firstSync = await syncRewards(db, stats);
    expect(firstSync.newlyEarned.map((reward) => reward.id)).toEqual(expect.arrayContaining([
      streakReward.id,
      sessionsReward.id,
    ]));

    const rewards = getRewards(db);
    expect(rewards.find((reward) => reward.id === streakReward.id)?.earned).toBe(true);
    expect(rewards.find((reward) => reward.id === sessionsReward.id)?.earned).toBe(true);
    expect(rewards.filter((reward) => reward.earned)).toHaveLength(2);

    const secondSync = await syncRewards(db, stats);
    expect(secondSync.newlyEarned).toHaveLength(0);
  });
});
