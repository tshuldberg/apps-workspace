import type { DatabaseAdapter } from '@mylife/db';
import { getDailyUsageRange, getRewards, getFocusSessions, getTotalXP, markRewardEarned } from '../db';
import type { Reward, RewardMilestoneType } from '../types';
import { calculateStreaks } from './streaks';

export interface RewardEvaluationStats {
  currentStreak: number;
  completedSessions: number;
  totalXP: number;
  goalMetDays: number;
}

export function getRewardMilestoneValue(
  milestoneType: RewardMilestoneType,
  stats: RewardEvaluationStats,
): number {
  switch (milestoneType) {
    case 'streak':
      return stats.currentStreak;
    case 'sessions':
      return stats.completedSessions;
    case 'xp':
      return stats.totalXP;
    case 'goal-met-days':
      return stats.goalMetDays;
    default:
      return 0;
  }
}

export function getRewardProgress(reward: Reward, stats: RewardEvaluationStats): number {
  const currentValue = getRewardMilestoneValue(reward.milestoneType, stats);
  if (reward.milestoneValue <= 0) return 1;
  return Math.max(0, Math.min(1, currentValue / reward.milestoneValue));
}

export function getRewardMilestoneLabel(reward: Pick<Reward, 'milestoneType' | 'milestoneValue'>): string {
  switch (reward.milestoneType) {
    case 'streak':
      return `${reward.milestoneValue}-day streak`;
    case 'sessions':
      return `${reward.milestoneValue} sessions`;
    case 'xp':
      return `${reward.milestoneValue} XP`;
    case 'goal-met-days':
      return `${reward.milestoneValue} goal-met days`;
    default:
      return `${reward.milestoneValue}`;
  }
}

export function evaluateRewards(rewards: Reward[], stats: RewardEvaluationStats): Reward[] {
  return rewards.filter((reward) => (
    !reward.earned && getRewardMilestoneValue(reward.milestoneType, stats) >= reward.milestoneValue
  ));
}

function isoDateDaysAgo(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

export function buildRewardEvaluationStats(db: DatabaseAdapter): RewardEvaluationStats {
  const dailyUsage = getDailyUsageRange(db, isoDateDaysAgo(365), new Date().toISOString().slice(0, 10), 500);
  const streaks = calculateStreaks(dailyUsage);
  const completedSessions = getFocusSessions(db, 1000).filter((session) => session.completed === 1).length;
  const totalXP = getTotalXP(db);
  const goalMetDays = dailyUsage.filter((day) => day.goal_met === 1).length;

  return {
    currentStreak: streaks.current,
    completedSessions,
    totalXP,
    goalMetDays,
  };
}

export async function syncRewards(
  db: DatabaseAdapter,
  stats: RewardEvaluationStats = buildRewardEvaluationStats(db),
): Promise<{ newlyEarned: Reward[] }> {
  const rewards = getRewards(db);
  const newlyEarned = evaluateRewards(rewards, stats);
  newlyEarned.forEach((reward) => {
    markRewardEarned(db, reward.id);
  });
  return { newlyEarned };
}
