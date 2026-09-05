import { getLevelForXP } from './xp';
import type { DailyUsage, FocusSession } from '../types';

export type BadgeCategory = 'Streaks' | 'Sessions' | 'Screen Time' | 'Milestones' | 'Special';

export interface BadgeStatsSnapshot {
  totalXP: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  completedSessions: number;
  totalDays: number;
  totalFocusMinutes: number;
  beastSessions: number;
  morningSessions: number;
  nightSessions: number;
  longestSessionMinutes: number;
  activeIntentions: number;
  mindfulOpenCount: number;
  reflectionCount: number;
  daysUnderGoal: number;
  reductionPercent: number;
  halfDayOffCount: number;
  fullDayOffCount: number;
  weekendDetoxCount: number;
  hubVisits: number;
}

export interface BadgeDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: BadgeCategory;
  target: number;
  unit: string;
  currentValue: (stats: BadgeStatsSnapshot) => number;
  check: (stats: BadgeStatsSnapshot) => boolean;
}

function progressToward(value: number, target: number): number {
  if (target <= 0) {
    return 1;
  }
  return Math.max(0, Math.min(1, value / target));
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function calculateReductionPercent(records: DailyUsage[]): number {
  const sorted = [...records].sort((left, right) => left.date.localeCompare(right.date));
  if (sorted.length < 14) {
    return 0;
  }

  const earlyWindow = sorted.slice(0, 7);
  const recentWindow = sorted.slice(-7);
  const earlyAverage = average(earlyWindow.map((record) => record.total_minutes));
  const recentAverage = average(recentWindow.map((record) => record.total_minutes));

  if (earlyAverage <= 0) {
    return 0;
  }

  return Math.max(0, Math.round(((earlyAverage - recentAverage) / earlyAverage) * 100));
}

function calculateStreaks(records: DailyUsage[]): { current: number; longest: number } {
  const sortedDescending = [...records].sort((left, right) => right.date.localeCompare(left.date));
  let current = 0;
  for (const record of sortedDescending) {
    if (record.goal_met === 1) {
      current += 1;
    } else {
      break;
    }
  }

  const sortedAscending = [...records].sort((left, right) => left.date.localeCompare(right.date));
  let longest = 0;
  let run = 0;
  sortedAscending.forEach((record) => {
    if (record.goal_met === 1) {
      run += 1;
      longest = Math.max(longest, run);
      return;
    }
    run = 0;
  });

  return { current, longest };
}

export function buildBadgeStatsSnapshotFromData(input: {
  dailyUsage: DailyUsage[];
  sessions: FocusSession[];
  totalXP: number;
  activeIntentions?: number;
  mindfulOpenCount?: number;
  reflectionCount?: number;
  hubVisits?: number;
}): BadgeStatsSnapshot {
  const completedSessions = input.sessions.filter((session) => session.completed === 1);
  const streaks = calculateStreaks(input.dailyUsage);

  return {
    totalXP: input.totalXP,
    level: getLevelForXP(input.totalXP),
    currentStreak: streaks.current,
    longestStreak: streaks.longest,
    completedSessions: completedSessions.length,
    totalDays: input.dailyUsage.length,
    totalFocusMinutes: completedSessions.reduce(
      (sum, session) => sum + (session.actual_minutes ?? session.planned_minutes),
      0,
    ),
    beastSessions: completedSessions.filter((session) => session.type === 'beast').length,
    morningSessions: completedSessions.filter((session) => new Date(session.start_time).getHours() < 8).length,
    nightSessions: completedSessions.filter((session) => new Date(session.start_time).getHours() >= 21).length,
    longestSessionMinutes: completedSessions.reduce(
      (max, session) => Math.max(max, session.actual_minutes ?? session.planned_minutes),
      0,
    ),
    activeIntentions: input.activeIntentions ?? 0,
    mindfulOpenCount: input.mindfulOpenCount ?? 0,
    reflectionCount: input.reflectionCount ?? completedSessions.filter((session) => session.rating != null).length,
    daysUnderGoal: input.dailyUsage.filter((record) => record.goal_met === 1).length,
    reductionPercent: calculateReductionPercent(input.dailyUsage),
    halfDayOffCount: input.dailyUsage.filter((record) => record.total_minutes <= 60).length,
    fullDayOffCount: input.dailyUsage.filter((record) => record.total_minutes === 0).length,
    weekendDetoxCount: input.dailyUsage.filter((record) => {
      const day = new Date(`${record.date}T00:00:00`).getDay();
      return (day === 0 || day === 6) && record.total_minutes <= 60;
    }).length,
    hubVisits: input.hubVisits ?? 0,
  };
}

function buildBadgeDef(
  id: string,
  name: string,
  description: string,
  icon: string,
  category: BadgeCategory,
  target: number,
  unit: string,
  selector: (stats: BadgeStatsSnapshot) => number,
): BadgeDef {
  return {
    id,
    name,
    description,
    icon,
    category,
    target,
    unit,
    currentValue: selector,
    check: (stats) => selector(stats) >= target,
  };
}

export const BADGE_DEFS: BadgeDef[] = [
  buildBadgeDef('first-day', 'First Day', 'Track your first day of screen time.', 'check_circle', 'Streaks', 1, 'day', (stats) => stats.totalDays),
  buildBadgeDef('three-day-streak', '3-Day Streak', 'Stay under goal for 3 straight days.', 'local_fire_department', 'Streaks', 3, 'days', (stats) => Math.max(stats.currentStreak, stats.longestStreak)),
  buildBadgeDef('seven-day-streak', '7-Day Streak', 'Hold a full 7-day streak.', 'local_fire_department', 'Streaks', 7, 'days', (stats) => Math.max(stats.currentStreak, stats.longestStreak)),
  buildBadgeDef('fourteen-day-streak', '14-Day Streak', 'Maintain momentum for two weeks.', 'bolt', 'Streaks', 14, 'days', (stats) => Math.max(stats.currentStreak, stats.longestStreak)),
  buildBadgeDef('thirty-day-streak', '30-Day Streak', 'Complete a full month under goal.', 'diamond', 'Streaks', 30, 'days', (stats) => Math.max(stats.currentStreak, stats.longestStreak)),
  buildBadgeDef('sixty-day-streak', '60-Day Streak', 'Double your monthly consistency.', 'diamond', 'Streaks', 60, 'days', (stats) => Math.max(stats.currentStreak, stats.longestStreak)),
  buildBadgeDef('ninety-day-streak', '90-Day Streak', 'Reach a quarter of focused days.', 'insights', 'Streaks', 90, 'days', (stats) => Math.max(stats.currentStreak, stats.longestStreak)),
  buildBadgeDef('one-eighty-streak', '180-Day Streak', 'Stay present for half a year.', 'insights', 'Streaks', 180, 'days', (stats) => Math.max(stats.currentStreak, stats.longestStreak)),
  buildBadgeDef('three-sixty-five-streak', '365-Day Streak', 'Build a year-long presence practice.', 'share', 'Streaks', 365, 'days', (stats) => Math.max(stats.currentStreak, stats.longestStreak)),

  buildBadgeDef('first-focus', 'First Focus', 'Complete your first focus session.', 'timer', 'Sessions', 1, 'session', (stats) => stats.completedSessions),
  buildBadgeDef('ten-sessions', '10 Sessions', 'Complete 10 focus sessions.', 'timer', 'Sessions', 10, 'sessions', (stats) => stats.completedSessions),
  buildBadgeDef('fifty-sessions', '50 Sessions', 'Complete 50 focus sessions.', 'timer', 'Sessions', 50, 'sessions', (stats) => stats.completedSessions),
  buildBadgeDef('hundred-sessions', '100 Sessions', 'Complete 100 focus sessions.', 'timer', 'Sessions', 100, 'sessions', (stats) => stats.completedSessions),
  buildBadgeDef('beast-mode', 'Beast Mode', 'Complete 5 Beast Mode sessions.', 'local_fire_department', 'Sessions', 5, 'beast sessions', (stats) => stats.beastSessions),
  buildBadgeDef('marathon', 'Marathon', 'Finish a 90 minute session.', 'play_circle', 'Sessions', 90, 'minutes', (stats) => stats.longestSessionMinutes),
  buildBadgeDef('early-bird', 'Early Bird', 'Complete 5 sessions before 8 AM.', 'lightbulb', 'Sessions', 5, 'sessions', (stats) => stats.morningSessions),
  buildBadgeDef('night-owl', 'Night Owl', 'Complete 5 sessions after 9 PM.', 'bedtime', 'Sessions', 5, 'sessions', (stats) => stats.nightSessions),

  buildBadgeDef('under-goal', 'Under Goal', 'Log 7 under-goal days.', 'check_circle', 'Screen Time', 7, 'days', (stats) => stats.daysUnderGoal),
  buildBadgeDef('reduction-thirty', '30% Reduction', 'Cut average screen time by 30%.', 'insights', 'Screen Time', 30, 'percent', (stats) => stats.reductionPercent),
  buildBadgeDef('reduction-fifty', '50% Reduction', 'Cut average screen time by 50%.', 'insights', 'Screen Time', 50, 'percent', (stats) => stats.reductionPercent),
  buildBadgeDef('half-day-off', 'Half Day Off', 'Keep screen time under 60 minutes on one day.', 'bedtime', 'Screen Time', 1, 'day', (stats) => stats.halfDayOffCount),
  buildBadgeDef('full-day-off', 'Full Day Off', 'Log a zero-minute day.', 'bedtime', 'Screen Time', 1, 'day', (stats) => stats.fullDayOffCount),
  buildBadgeDef('weekend-detox', 'Weekend Detox', 'Stack 2 low-screen weekend days.', 'psychology', 'Screen Time', 2, 'days', (stats) => stats.weekendDetoxCount),

  buildBadgeDef('level-five', 'Level 5', 'Reach level 5.', 'diamond', 'Milestones', 5, 'levels', (stats) => stats.level),
  buildBadgeDef('level-ten', 'Level 10', 'Reach level 10.', 'diamond', 'Milestones', 10, 'levels', (stats) => stats.level),
  buildBadgeDef('level-twenty-five', 'Level 25', 'Reach level 25.', 'diamond', 'Milestones', 25, 'levels', (stats) => stats.level),
  buildBadgeDef('level-fifty', 'Level 50', 'Reach level 50.', 'diamond', 'Milestones', 50, 'levels', (stats) => stats.level),
  buildBadgeDef('xp-thousand', '1,000 XP', 'Cross 1,000 total XP.', 'bolt', 'Milestones', 1000, 'XP', (stats) => stats.totalXP),
  buildBadgeDef('xp-ten-thousand', '10,000 XP', 'Cross 10,000 total XP.', 'bolt', 'Milestones', 10000, 'XP', (stats) => stats.totalXP),
  buildBadgeDef('xp-hundred-thousand', '100,000 XP', 'Cross 100,000 total XP.', 'bolt', 'Milestones', 100000, 'XP', (stats) => stats.totalXP),

  buildBadgeDef('app-tamer', 'App Tamer', 'Create 10 active app intentions.', 'psychology', 'Special', 10, 'intentions', (stats) => stats.activeIntentions),
  buildBadgeDef('mindful-open', 'Mindful Open', 'Use mindful open prompts 10 times.', 'lightbulb', 'Special', 10, 'opens', (stats) => stats.mindfulOpenCount),
  buildBadgeDef('reflection-master', 'Reflection', 'Rate 10 completed sessions.', 'chat', 'Special', 10, 'reflections', (stats) => stats.reflectionCount),
  buildBadgeDef('discoverer', 'Discoverer', 'Open the Presence Hub.', 'explore', 'Special', 1, 'visit', (stats) => stats.hubVisits),
];

export function computeEarnedBadges(stats: BadgeStatsSnapshot): BadgeDef[] {
  return BADGE_DEFS.filter((badge) => badge.check(stats));
}

export function getBadgeCurrentValue(badge: BadgeDef, stats: BadgeStatsSnapshot): number {
  return badge.currentValue(stats);
}

export function getBadgeProgress(badge: BadgeDef, stats: BadgeStatsSnapshot): number {
  return progressToward(getBadgeCurrentValue(badge, stats), badge.target);
}
