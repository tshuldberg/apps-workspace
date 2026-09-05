'use server';

import { getAdapter, ensureModuleMigrations } from '@/lib/db';
import {
  APP_LIBRARY,
  BADGE_DEFS,
  awardXP,
  buildBadgeStatsSnapshot,
  buildCategoryBreakdown,
  buildDailySummary,
  buildPresenceRecommendations,
  buildRewardEvaluationStats,
  buildWeeklySummary,
  calculateImprovement,
  calculateStreaks,
  abandonFocusSession,
  completeFocusSession,
  createAccountabilityPartner,
  createAppUsage,
  createCommitment,
  createFocusSession,
  createGoal,
  createReward,
  createScheduledSession,
  deactivateIntention,
  deleteCommitment,
  deleteFocusSession,
  deleteIntention,
  deleteReward,
  deleteScheduledSession,
  exportAppUsageCSV,
  exportDailyUsageCSV,
  exportSessionsCSV,
  generatePresenceInsights,
  getAccountabilityPartners,
  getActiveCommitment,
  getActiveGoal,
  getAllActiveIntentions,
  getAllGoals,
  getAppOpensForDate,
  getAppUsageByDate,
  getAppUsageRange,
  getBadgeCurrentValue,
  getBadgeProgress,
  getCommitments,
  getDailyUsageByDate,
  getDailyUsageRange,
  getEarnedBadges,
  getFocusSessions,
  getFocusSessionsByDate,
  getLevelForXP,
  getRewards,
  getScheduledSessions,
  getSetting,
  getTopApps,
  getTotalXP,
  getXPForDate,
  getXPLog,
  getXPProgress,
  listUpcomingScheduled,
  revokeAccountabilityPartner,
  setSetting,
  syncRewards,
  toggleScheduledSession,
  type AwardXPInput,
  type CreateAppIntentionInput,
  type CreateAppUsageInput,
  type CreateFocusSessionInput,
  type CreateGoalInput,
  type CreateRewardInput,
  type CreateScheduledSessionInput,
  type UpdateAccountabilityPartnerPatch,
  type UpdateScheduledSessionPatch,
  updateAccountabilityPartner,
  updateCommitment,
  updateScheduledSession,
  upsertAppIntention,
  upsertDailyUsage,
  type UpsertDailyUsageInput,
} from '@mylife/presence';

type PresencePeriod = 'today' | '7d' | '30d' | '90d';

function db() {
  const adapter = getAdapter();
  ensureModuleMigrations('presence');
  return adapter;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateKey: string, delta: number): string {
  const next = new Date(`${dateKey}T12:00:00`);
  next.setDate(next.getDate() + delta);
  return next.toISOString().slice(0, 10);
}

function isoDateDaysAgo(daysAgo: number): string {
  return addDays(todayKey(), -daysAgo);
}

function diffInDays(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86_400_000));
}

function getRangeForPeriod(period: PresencePeriod): { start: string; end: string; days: number } {
  const end = todayKey();
  if (period === 'today') {
    return { start: end, end, days: 1 };
  }

  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  return {
    start: addDays(end, -(days - 1)),
    end,
    days,
  };
}

function getPreviousRange(startDate: string, days: number): { start: string; end: string } {
  const end = addDays(startDate, -1);
  const start = addDays(end, -(days - 1));
  return { start, end };
}

function calculateDeltaPercent(current: number, previous: number | null): number | null {
  if (previous == null || previous <= 0) {
    return current > 0 ? null : 0;
  }
  return Math.round(((current - previous) / previous) * 100);
}

// ── Daily Usage ────────────────────────────────────────────────────────────

export async function fetchDailyUsage(date: string) {
  try {
    return getDailyUsageByDate(db(), date);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to fetch daily usage');
  }
}

export async function fetchDailyUsageRange(startDate: string, endDate: string) {
  try {
    return getDailyUsageRange(db(), startDate, endDate);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to fetch usage range');
  }
}

export async function doUpsertDailyUsage(input: UpsertDailyUsageInput) {
  try {
    return upsertDailyUsage(db(), input);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to upsert daily usage');
  }
}

// ── App Usage ──────────────────────────────────────────────────────────────

export async function fetchAppUsage(date: string) {
  try {
    return getAppUsageByDate(db(), date);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to fetch app usage');
  }
}

export async function fetchAppUsageRange(startDate: string, endDate: string) {
  try {
    return getAppUsageRange(db(), startDate, endDate);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to fetch app usage range');
  }
}

export async function fetchTopApps(startDate: string, endDate: string, topN?: number) {
  try {
    return getTopApps(db(), startDate, endDate, topN);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to fetch top apps');
  }
}

export async function doCreateAppUsage(input: CreateAppUsageInput) {
  try {
    return createAppUsage(db(), input);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to create app usage');
  }
}

// ── Goals ──────────────────────────────────────────────────────────────────

export async function fetchGoal(date: string) {
  try {
    return getActiveGoal(db(), date);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to fetch goal');
  }
}

export async function fetchAllGoals() {
  try {
    return getAllGoals(db());
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to fetch goals');
  }
}

export async function doCreateGoal(input: CreateGoalInput) {
  try {
    return createGoal(db(), input);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to create goal');
  }
}

// ── Focus Sessions ─────────────────────────────────────────────────────────

export async function fetchSessions(limit?: number) {
  try {
    return getFocusSessions(db(), limit);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to fetch sessions');
  }
}

export async function fetchSessionsByDate(date: string) {
  try {
    return getFocusSessionsByDate(db(), date);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to fetch sessions for date');
  }
}

export async function doCreateSession(input: CreateFocusSessionInput) {
  try {
    return createFocusSession(db(), input);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to create session');
  }
}

export async function doCompleteSession(sessionId: string, actualMinutes: number, rating?: number) {
  try {
    completeFocusSession(db(), sessionId, actualMinutes, rating);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to complete session');
  }
}

export async function doAbandonSession(sessionId: string, actualMinutes: number) {
  try {
    abandonFocusSession(db(), sessionId, actualMinutes);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to abandon session');
  }
}

export async function doDeleteSession(sessionId: string) {
  try {
    deleteFocusSession(db(), sessionId);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to delete session');
  }
}

// ── App Intentions ─────────────────────────────────────────────────────────

export async function fetchIntentions() {
  try {
    return getAllActiveIntentions(db());
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to fetch intentions');
  }
}

export async function doUpsertIntention(input: CreateAppIntentionInput) {
  try {
    return upsertAppIntention(db(), input);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to upsert intention');
  }
}

export async function doDeactivateIntention(appId: string) {
  try {
    deactivateIntention(db(), appId);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to deactivate intention');
  }
}

export async function doDeleteIntention(appId: string) {
  try {
    deleteIntention(db(), appId);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to delete intention');
  }
}

export async function fetchAppLibrary() {
  return APP_LIBRARY;
}

// ── XP ─────────────────────────────────────────────────────────────────────

export async function doAwardXP(input: AwardXPInput) {
  try {
    return awardXP(db(), input);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to award XP');
  }
}

export async function fetchTotalXP() {
  try {
    return getTotalXP(db());
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to fetch total XP');
  }
}

export async function fetchXPLog(limit?: number) {
  try {
    return getXPLog(db(), limit);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to fetch XP log');
  }
}

// ── Settings ───────────────────────────────────────────────────────────────

export async function doGetSetting(key: string) {
  try {
    return getSetting(db(), key);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to get setting');
  }
}

export async function doSetSetting(key: string, value: string) {
  try {
    setSetting(db(), key, value);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to set setting');
  }
}

// ── Engines (pure functions, run server-side for consistency) ──────────────

export async function computeStreaks() {
  try {
    const endDate = todayKey();
    const startDate = addDays(endDate, -365);
    const records = getDailyUsageRange(db(), startDate, endDate);
    return calculateStreaks(records);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to compute streaks');
  }
}

export async function computeXPProgress() {
  try {
    const totalXP = getTotalXP(db());
    return getXPProgress(totalXP);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to compute XP progress');
  }
}

export async function computeLevel() {
  try {
    const totalXP = getTotalXP(db());
    return getLevelForXP(totalXP);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to compute level');
  }
}

export async function computeDailySummary(date: string) {
  try {
    const adapter = db();
    const daily = getDailyUsageByDate(adapter, date);
    if (!daily) return null;
    const appUsage = getAppUsageByDate(adapter, date);
    return buildDailySummary(daily, appUsage);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to compute daily summary');
  }
}

export async function computeWeeklySummary(weekStart: string) {
  try {
    const start = new Date(`${weekStart}T12:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const records = getDailyUsageRange(db(), weekStart, end.toISOString().slice(0, 10));
    return buildWeeklySummary(records, weekStart);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to compute weekly summary');
  }
}

export async function computeCategoryBreakdown(startDate: string, endDate: string) {
  try {
    const appUsage = getAppUsageRange(db(), startDate, endDate);
    return buildCategoryBreakdown(appUsage);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to compute category breakdown');
  }
}

export async function computeImprovement() {
  try {
    const thisWeekEnd = todayKey();
    const thisWeekStart = addDays(thisWeekEnd, -6);
    const lastWeekEnd = addDays(thisWeekStart, -1);
    const lastWeekStart = addDays(lastWeekEnd, -6);

    const adapter = db();
    const thisWeek = getDailyUsageRange(adapter, thisWeekStart, thisWeekEnd);
    const lastWeek = getDailyUsageRange(adapter, lastWeekStart, lastWeekEnd);

    const thisTotal = thisWeek.reduce((sum, record) => sum + record.total_minutes, 0);
    const lastTotal = lastWeek.reduce((sum, record) => sum + record.total_minutes, 0);

    return {
      currentMinutes: thisTotal,
      previousMinutes: lastTotal,
      improvementPercent: calculateImprovement(thisTotal, lastTotal),
    };
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to compute improvement');
  }
}

// ── Composite Presence Fetchers ───────────────────────────────────────────

export async function fetchPresenceDashboard(date = todayKey()) {
  try {
    const adapter = db();
    const daily = getDailyUsageByDate(adapter, date);
    const goal = getActiveGoal(adapter, date);
    const sessions = getFocusSessionsByDate(adapter, date, 8);
    const totalXP = getTotalXP(adapter);
    const xpProgress = getXPProgress(totalXP);
    const topApps = getTopApps(adapter, date, date, 5);
    const recentDaily = getDailyUsageRange(adapter, addDays(date, -29), date, 30)
      .sort((left, right) => left.date.localeCompare(right.date));
    const allDaily = getDailyUsageRange(adapter, '2020-01-01', date, 3000);
    const previousWeek = getDailyUsageRange(adapter, addDays(date, -7), addDays(date, -1), 7);
    const streaks = calculateStreaks(allDaily);
    const commitment = getActiveCommitment(adapter);
    const badgeStats = buildBadgeStatsSnapshot(adapter);
    const earnedIds = new Set(getEarnedBadges(adapter).map((badge) => badge.badgeId));
    const badgePreview = BADGE_DEFS
      .map((badge) => ({
        id: badge.id,
        name: badge.name,
        icon: badge.icon,
        earned: earnedIds.has(badge.id),
        progress: getBadgeProgress(badge, badgeStats),
        currentValue: getBadgeCurrentValue(badge, badgeStats),
        target: badge.target,
      }))
      .sort((left, right) => Number(right.earned) - Number(left.earned) || right.progress - left.progress)
      .slice(0, 6);

    const goalMinutes = goal?.daily_minutes ?? Number(getSetting(adapter, 'daily_goal_minutes') ?? '180');
    const previousAverage = previousWeek.length > 0
      ? Math.round(previousWeek.reduce((sum, record) => sum + record.total_minutes, 0) / previousWeek.length)
      : goalMinutes;

    return {
      date,
      daily,
      goal,
      goalMinutes,
      sessions,
      totalXP,
      xpProgress,
      topApps,
      trendData: recentDaily.map((record) => ({ date: record.date, minutes: record.total_minutes })),
      streaks,
      deltaMinutes: (daily?.total_minutes ?? 0) - previousAverage,
      badgePreview,
      commitment,
    };
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to load dashboard');
  }
}

export async function fetchPresenceStatsSnapshot(period: PresencePeriod = '7d') {
  try {
    const range = getRangeForPeriod(period);
    const previousRange = getPreviousRange(range.start, range.days);
    const adapter = db();
    const dailyRecords = getDailyUsageRange(adapter, range.start, range.end, 200)
      .sort((left, right) => left.date.localeCompare(right.date));
    const appUsage = getAppUsageRange(adapter, range.start, range.end, 5000);
    const previousTopApps = getTopApps(adapter, previousRange.start, previousRange.end, 20);
    const previousMinutesByName = new Map(previousTopApps.map((item) => [item.app_name, item.total_minutes]));
    const goal = getActiveGoal(adapter, range.end);
    const goalMinutes = goal?.daily_minutes ?? Number(getSetting(adapter, 'daily_goal_minutes') ?? '180');
    const categoryBreakdown = buildCategoryBreakdown(appUsage);
    const topApps = getTopApps(adapter, range.start, range.end, 10).map((app) => ({
      ...app,
      deltaPercent: calculateDeltaPercent(app.total_minutes, previousMinutesByName.get(app.app_name) ?? null),
    }));
    const totalMinutes = dailyRecords.reduce((sum, record) => sum + record.total_minutes, 0);
    const averageMinutes = dailyRecords.length === 0 ? 0 : Math.round(totalMinutes / dailyRecords.length);
    const goalMetDays = dailyRecords.filter((record) => record.goal_met === 1).length;
    const bestDay = dailyRecords.length === 0
      ? null
      : [...dailyRecords].sort((left, right) => left.total_minutes - right.total_minutes)[0] ?? null;
    const worstDay = dailyRecords.length === 0
      ? null
      : [...dailyRecords].sort((left, right) => right.total_minutes - left.total_minutes)[0] ?? null;
    const currentTotal = totalMinutes;
    const previousTotal = getDailyUsageRange(adapter, previousRange.start, previousRange.end, 200)
      .reduce((sum, record) => sum + record.total_minutes, 0);

    const usageByDate = new Map<string, typeof appUsage>([]);
    appUsage.forEach((usage) => {
      usageByDate.set(usage.date, [...(usageByDate.get(usage.date) ?? []), usage]);
    });

    const visibleDaily = dailyRecords.slice(period === 'today' ? -1 : -Math.min(7, dailyRecords.length));
    const dailyCategoryStacks = visibleDaily.map((record) => {
      const rows = usageByDate.get(record.date) ?? [];
      const categories = new Map<string, number>();
      rows.forEach((row) => {
        categories.set(row.category, (categories.get(row.category) ?? 0) + row.minutes);
      });
      return {
        date: record.date,
        totalMinutes: record.total_minutes,
        categories: [...categories.entries()]
          .map(([category, minutes]) => ({ category, minutes }))
          .sort((left, right) => right.minutes - left.minutes),
      };
    });

    return {
      range,
      goalMinutes,
      dailyRecords,
      totalMinutes,
      averageMinutes,
      goalMetDays,
      bestDay,
      worstDay,
      categoryBreakdown,
      topApps,
      visibleDaily,
      dailyCategoryStacks,
      improvementPercent: calculateImprovement(currentTotal, previousTotal),
      currentTotal,
      previousTotal,
    };
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to load stats');
  }
}

export async function fetchPresenceSessionsSnapshot() {
  try {
    const adapter = db();
    const sessions = getFocusSessions(adapter, 300);
    const weekStart = isoDateDaysAgo(6);
    const weeklySessions = sessions.filter((session) => session.start_time.slice(0, 10) >= weekStart);
    const completedWeekly = weeklySessions.filter((session) => session.completed === 1);
    const weeklyMinutes = completedWeekly.reduce(
      (sum, session) => sum + (session.actual_minutes ?? session.planned_minutes),
      0,
    );
    const trendData = Array.from({ length: 7 }, (_, index) => {
      const date = isoDateDaysAgo(6 - index);
      const daySessions = completedWeekly.filter((session) => session.start_time.slice(0, 10) === date);
      return {
        date,
        label: new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' }),
        value: daySessions.reduce(
          (sum, session) => sum + (session.actual_minutes ?? session.planned_minutes),
          0,
        ),
      };
    });

    return {
      sessions,
      weeklySessionsCount: weeklySessions.length,
      weeklyMinutes,
      weeklyCompletionRate: weeklySessions.length === 0 ? 0 : Math.round((completedWeekly.length / weeklySessions.length) * 100),
      trendData,
    };
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to load focus sessions');
  }
}

export async function fetchPresenceInsightsSnapshot() {
  try {
    const adapter = db();
    const dailyUsage = getDailyUsageRange(adapter, isoDateDaysAgo(89), todayKey(), 180)
      .sort((left, right) => left.date.localeCompare(right.date));
    const sessions = getFocusSessions(adapter, 1000);
    const xpLog = getXPLog(adapter, 1000);

    return {
      dailyUsage,
      sessions,
      xpLog,
      trackedDays: dailyUsage.length,
      generatedInsights: generatePresenceInsights(dailyUsage, sessions),
    };
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to load insights');
  }
}

export async function fetchPresenceBadgeSnapshot() {
  try {
    const adapter = db();
    const stats = buildBadgeStatsSnapshot(adapter);
    const earnedIds = new Set(getEarnedBadges(adapter).map((badge) => badge.badgeId));
    const categories = ['Streaks', 'Sessions', 'Screen Time', 'Milestones', 'Special'].map((category) => ({
      category,
      badges: BADGE_DEFS
        .filter((badge) => badge.category === category)
        .map((badge) => ({
          id: badge.id,
          name: badge.name,
          description: badge.description,
          icon: badge.icon,
          category: badge.category,
          target: badge.target,
          unit: badge.unit,
          currentValue: getBadgeCurrentValue(badge, stats),
          progress: getBadgeProgress(badge, stats),
          earned: earnedIds.has(badge.id),
        })),
    }));

    const nextBadge = categories
      .flatMap((category) => category.badges)
      .filter((badge) => !badge.earned)
      .sort((left, right) => right.progress - left.progress)[0] ?? null;

    return {
      earnedCount: earnedIds.size,
      totalCount: BADGE_DEFS.length,
      categories,
      nextBadge,
      level: stats.level,
      totalXP: stats.totalXP,
    };
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to load badges');
  }
}

export async function fetchPresenceReport(date: string) {
  try {
    const adapter = db();
    const normalizedDate = date || todayKey();
    const dailyUsage = getDailyUsageByDate(adapter, normalizedDate);
    const appUsage = getAppUsageByDate(adapter, normalizedDate, 200);
    const focusSessions = getFocusSessionsByDate(adapter, normalizedDate, 100);
    const recentUsage = getDailyUsageRange(adapter, addDays(normalizedDate, -6), normalizedDate, 7)
      .sort((left, right) => left.date.localeCompare(right.date));
    const recentStreakUsage = getDailyUsageRange(adapter, addDays(normalizedDate, -60), normalizedDate, 120);
    const goal = getActiveGoal(adapter, normalizedDate);
    const activeIntentions = getAllActiveIntentions(adapter, 200);
    const xpEntries = getXPLog(adapter, 1000).filter((entry) => entry.date === normalizedDate);
    const xpTotal = getXPForDate(adapter, normalizedDate);
    const activeCommitment = getActiveCommitment(adapter);

    if (!dailyUsage) {
      return {
        date: normalizedDate,
        summary: null,
        goal,
        focusSessions,
        xpEntries,
        xpTotal,
        activeCommitment,
      };
    }

    const summary = buildDailySummary(dailyUsage, appUsage);
    const goalMinutes = goal?.daily_minutes ?? 180;
    const completedSessions = focusSessions.filter((session) => session.completed === 1);
    const focusMinutes = completedSessions.reduce(
      (sum, session) => sum + (session.actual_minutes ?? session.planned_minutes),
      0,
    );
    const streaks = calculateStreaks(recentStreakUsage);
    const recentAverageMinutes = recentUsage.length === 0
      ? summary.totalMinutes
      : Math.round(recentUsage.reduce((sum, record) => sum + record.total_minutes, 0) / recentUsage.length);

    const intentionStatus = activeIntentions.map((intention) => {
      const app = appUsage.find((item) => item.app_id === intention.app_id);
      const opens = getAppOpensForDate(adapter, normalizedDate, intention.app_id).length;
      const minutes = app?.minutes ?? 0;
      const averagePerOpen = opens > 0 ? minutes / opens : 0;
      const withinOpens = intention.daily_open_limit == null || opens <= intention.daily_open_limit;
      const withinMinutes = intention.per_open_minutes == null || averagePerOpen <= intention.per_open_minutes;

      return {
        appId: intention.app_id,
        appName: intention.app_name,
        opens,
        minutes,
        compliant: withinOpens && withinMinutes,
        overage: Math.max(opens - (intention.daily_open_limit ?? opens), 0),
      };
    });

    const intentionCompliance = intentionStatus.length === 0
      ? 100
      : Math.round((intentionStatus.filter((item) => item.compliant).length / intentionStatus.length) * 100);

    return {
      date: normalizedDate,
      summary,
      goal,
      focusSessions,
      recentUsage,
      xpEntries,
      xpTotal,
      activeCommitment,
      streaks,
      intentionCompliance,
      intentionStatus,
      recommendations: buildPresenceRecommendations({
        summary,
        goalMinutes,
        recentAverageMinutes,
        completedSessions: completedSessions.length,
        focusMinutes,
        currentStreak: streaks.current,
        intentionCompliance,
        violatingApps: intentionStatus
          .filter((item) => !item.compliant)
          .sort((left, right) => right.overage - left.overage),
      }),
    };
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to load daily report');
  }
}

export async function fetchPresenceSettingsSnapshot() {
  try {
    const adapter = db();
    const goals = getAllGoals(adapter);
    const categories = APP_LIBRARY.reduce<Record<string, number>>((acc, app) => {
      acc[app.category] = (acc[app.category] ?? 0) + 1;
      return acc;
    }, {});

    return {
      goalMinutes: getSetting(adapter, 'daily_goal_minutes') ?? '180',
      scrollAlert: getSetting(adapter, 'scroll_alert_interval_minutes') ?? '60',
      progressiveAlerts: getSetting(adapter, 'progressive_alerts_enabled') === '1',
      morningBriefing: getSetting(adapter, 'morning_briefing_enabled') === '1',
      morningBriefingTime: getSetting(adapter, 'morning_briefing_time') ?? '07:30',
      bedtimeWindDown: getSetting(adapter, 'bedtime_wind_down_enabled') === '1',
      bedtimeTime: getSetting(adapter, 'bedtime_time') ?? '22:00',
      streakReminders: getSetting(adapter, 'streak_reminders_enabled') === '1',
      timeDisplayMode: getSetting(adapter, 'time_display_mode') ?? 'clock',
      goals,
      categories,
    };
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to load settings');
  }
}

export async function fetchPresenceHubSnapshot() {
  try {
    const adapter = db();
    const today = todayKey();
    const allDaily = getDailyUsageRange(adapter, '2020-01-01', today, 4000)
      .sort((left, right) => left.date.localeCompare(right.date));
    const earliestDate = allDaily[0]?.date;
    const daysTracked = earliestDate ? diffInDays(earliestDate, today) + 1 : 0;
    const currentVisitCount = parseInt(getSetting(adapter, 'hub_visit_count') ?? '0', 10) || 0;
    const hubVisitCount = currentVisitCount + 1;
    setSetting(adapter, 'hub_visit_count', String(hubVisitCount));

    return {
      daysTracked,
      hubVisitCount,
      unlocks: [
        { label: 'Day 3', title: '7-Day Trends', unlocked: daysTracked >= 3 },
        { label: 'Day 7', title: 'Peak Hours Heatmap', unlocked: daysTracked >= 7 },
        { label: 'Day 14', title: 'Monthly Patterns', unlocked: daysTracked >= 14 },
        { label: 'Day 30', title: 'Personalized Tips', unlocked: daysTracked >= 30 },
      ],
    };
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to load presence hub');
  }
}

// ── Phase 4 / Parity CRUD ────────────────────────────────────────────────

export async function fetchScheduledSnapshot() {
  try {
    const adapter = db();
    const scheduled = getScheduledSessions(adapter);
    return {
      scheduled,
      upcoming: listUpcomingScheduled(scheduled, 14).map((entry) => ({
        scheduled: entry.scheduled,
        datetime: entry.datetime.toISOString(),
      })),
      appLibrary: APP_LIBRARY,
    };
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to load scheduled sessions');
  }
}

export async function doCreateScheduled(input: CreateScheduledSessionInput) {
  try {
    return createScheduledSession(db(), input);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to create scheduled session');
  }
}

export async function doUpdateScheduled(id: string, patch: UpdateScheduledSessionPatch) {
  try {
    return updateScheduledSession(db(), id, patch);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to update scheduled session');
  }
}

export async function doDeleteScheduled(id: string) {
  try {
    deleteScheduledSession(db(), id);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to delete scheduled session');
  }
}

export async function doToggleScheduled(id: string, active: boolean) {
  try {
    return toggleScheduledSession(db(), id, active);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to toggle scheduled session');
  }
}

export async function fetchAccountabilitySnapshot() {
  try {
    return {
      partners: getAccountabilityPartners(db()),
    };
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to load accountability partners');
  }
}

export async function doCreateAccountabilityPartner(name: string) {
  try {
    return createAccountabilityPartner(db(), name);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to create accountability partner');
  }
}

export async function doUpdateAccountabilityPartner(id: string, patch: UpdateAccountabilityPartnerPatch) {
  try {
    return updateAccountabilityPartner(db(), id, patch);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to update accountability partner');
  }
}

export async function doRevokeAccountabilityPartner(id: string) {
  try {
    revokeAccountabilityPartner(db(), id);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to revoke accountability partner');
  }
}

export async function fetchRewardsSnapshot() {
  try {
    const adapter = db();
    const syncResult = await syncRewards(adapter);
    return {
      rewards: getRewards(adapter),
      stats: buildRewardEvaluationStats(adapter),
      newlyEarned: syncResult.newlyEarned.map((reward) => reward.id),
    };
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to load rewards');
  }
}

export async function doCreateReward(input: CreateRewardInput) {
  try {
    return createReward(db(), input);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to create reward');
  }
}

export async function doDeleteReward(id: string) {
  try {
    deleteReward(db(), id);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to delete reward');
  }
}

export async function fetchCommitmentSnapshot() {
  try {
    const adapter = db();
    return {
      active: getActiveCommitment(adapter),
      commitments: getCommitments(adapter),
    };
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to load commitment history');
  }
}

export async function doCreateCommitment(text: string) {
  try {
    return createCommitment(db(), text);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to create commitment');
  }
}

export async function doUpdateCommitment(id: string, text: string) {
  try {
    return updateCommitment(db(), id, text);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to update commitment');
  }
}

export async function doDeleteCommitment(id: string) {
  try {
    deleteCommitment(db(), id);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to delete commitment');
  }
}

// ── CSV Export ─────────────────────────────────────────────────────────────

export async function fetchExportDailyUsageCSV() {
  try {
    const endDate = todayKey();
    const startDate = addDays(endDate, -365);
    const records = getDailyUsageRange(db(), startDate, endDate);
    return exportDailyUsageCSV(records);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to export daily usage');
  }
}

export async function fetchExportAppUsageCSV() {
  try {
    const endDate = todayKey();
    const startDate = addDays(endDate, -365);
    const records = getAppUsageRange(db(), startDate, endDate);
    return exportAppUsageCSV(records);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to export app usage');
  }
}

export async function fetchExportSessionsCSV() {
  try {
    const records = getFocusSessions(db(), 1000);
    return exportSessionsCSV(records);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to export sessions');
  }
}
