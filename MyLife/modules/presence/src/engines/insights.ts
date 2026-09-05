import type { DailyUsage, FocusSession } from '../types';

export interface Insight {
  type: string;
  title: string;
  body: string;
  severity?: 'positive' | 'neutral' | 'warning';
  actionRoute?: string;
}

function parseMinutesFromTime(time: string | null | undefined): number | null {
  if (!time) {
    return null;
  }

  const source = time.includes('T') ? time : `1970-01-01T${time}`;
  const date = new Date(source);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.getHours() * 60 + date.getMinutes();
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function averageDailyMinutes(records: DailyUsage[]): number {
  return average(records.map((record) => record.total_minutes));
}

function splitRecentDailyWindows(daily: DailyUsage[]): { recent: DailyUsage[]; previous: DailyUsage[] } {
  const sorted = [...daily].sort((left, right) => left.date.localeCompare(right.date));
  return {
    recent: sorted.slice(-7),
    previous: sorted.slice(-14, -7),
  };
}

function minutesToClock(totalMinutes: number): string {
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHour}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

export function detectWeekendPattern(daily: DailyUsage[]): Insight | null {
  if (daily.length < 7) {
    return null;
  }

  const weekend = daily.filter((record) => {
    const day = new Date(`${record.date}T00:00:00`).getDay();
    return day === 0 || day === 6;
  });
  const weekday = daily.filter((record) => {
    const day = new Date(`${record.date}T00:00:00`).getDay();
    return day >= 1 && day <= 5;
  });

  if (weekend.length === 0 || weekday.length === 0) {
    return null;
  }

  const weekendAverage = averageDailyMinutes(weekend);
  const weekdayAverage = averageDailyMinutes(weekday);
  if (weekdayAverage <= 0) {
    return null;
  }

  const deltaPercent = Math.round(((weekendAverage - weekdayAverage) / weekdayAverage) * 100);
  if (Math.abs(deltaPercent) < 15) {
    return null;
  }

  if (deltaPercent > 0) {
    return {
      type: 'weekend-pattern',
      title: 'Weekend drift shows up fast',
      body: `Your weekends average ${deltaPercent}% more screen time than weekdays. A Sunday reset session could soften the spike.`,
      severity: 'warning',
      actionRoute: '/(presence)/sessions',
    };
  }

  return {
    type: 'weekend-pattern',
    title: 'Weekends are your reset window',
    body: `You spend ${Math.abs(deltaPercent)}% less time on your phone on weekends. Protect that rhythm with a low-friction routine.`,
    severity: 'positive',
    actionRoute: '/(presence)/hub',
  };
}

export function detectMorningPickupTrend(daily: DailyUsage[]): Insight | null {
  const { recent, previous } = splitRecentDailyWindows(daily);
  const recentMinutes = recent.map((record) => parseMinutesFromTime(record.first_pickup)).filter((value): value is number => value != null);
  const previousMinutes = previous.map((record) => parseMinutesFromTime(record.first_pickup)).filter((value): value is number => value != null);

  if (recentMinutes.length < 3 || previousMinutes.length < 3) {
    return null;
  }

  const recentAverage = average(recentMinutes);
  const previousAverage = average(previousMinutes);
  const shiftMinutes = Math.round(recentAverage - previousAverage);

  if (Math.abs(shiftMinutes) < 15) {
    return null;
  }

  if (shiftMinutes > 0) {
    return {
      type: 'morning-pickup-trend',
      title: 'Your first pickup is getting later',
      body: `You are reaching for your phone around ${minutesToClock(recentAverage)} lately, about ${shiftMinutes} minutes later than the week before.`,
      severity: 'positive',
      actionRoute: '/(presence)/report',
    };
  }

  return {
    type: 'morning-pickup-trend',
    title: 'Mornings are slipping earlier',
    body: `Your first pickup moved ${Math.abs(shiftMinutes)} minutes earlier this week. A short morning focus block could reclaim that space.`,
    severity: 'warning',
    actionRoute: '/(presence)/sessions',
  };
}

export function detectSessionTimeOfDay(sessions: FocusSession[]): Insight | null {
  const completed = sessions.filter((session) => session.completed === 1);
  if (completed.length < 3) {
    return null;
  }

  const buckets = {
    morning: 0,
    afternoon: 0,
    evening: 0,
  };

  completed.forEach((session) => {
    const hour = new Date(session.start_time).getHours();
    if (hour < 12) {
      buckets.morning += 1;
      return;
    }
    if (hour < 18) {
      buckets.afternoon += 1;
      return;
    }
    buckets.evening += 1;
  });

  const dominant = Object.entries(buckets).sort((left, right) => right[1] - left[1])[0];
  if (!dominant || dominant[1] < 2) {
    return null;
  }

  const [period, count] = dominant as [keyof typeof buckets, number];
  const labels = {
    morning: 'Morning sessions stick best',
    afternoon: 'Afternoons are your focus pocket',
    evening: 'Evenings are when you reset best',
  };
  const bodies = {
    morning: 'Most completed sessions start before noon. Lean into that momentum with a consistent morning block.',
    afternoon: 'You complete most sessions in the afternoon. Scheduling around that window should feel natural.',
    evening: 'Your focus sessions cluster in the evening. A nightly shutdown ritual could turn that into a habit.',
  };

  return {
    type: 'session-time-of-day',
    title: labels[period],
    body: `${bodies[period]} (${count} completed sessions in this window.)`,
    severity: period === 'evening' ? 'neutral' : 'positive',
    actionRoute: '/(presence)/sessions',
  };
}

export function detectGoalRegression(daily: DailyUsage[]): Insight | null {
  const { recent, previous } = splitRecentDailyWindows(daily);
  if (recent.length < 5 || previous.length < 5) {
    return null;
  }

  const recentAverage = averageDailyMinutes(recent);
  const previousAverage = averageDailyMinutes(previous);
  if (previousAverage <= 0) {
    return null;
  }

  const recentGoalRate = recent.filter((record) => record.goal_met === 1).length / recent.length;
  const previousGoalRate = previous.filter((record) => record.goal_met === 1).length / previous.length;
  const usageDeltaPercent = Math.round(((recentAverage - previousAverage) / previousAverage) * 100);
  const goalRateDeltaPercent = Math.round((recentGoalRate - previousGoalRate) * 100);

  if (usageDeltaPercent >= 10 || goalRateDeltaPercent <= -20) {
    return {
      type: 'goal-regression',
      title: 'Your goal streak is under pressure',
      body: `The last week averaged ${usageDeltaPercent}% more screen time, and your goal-hit rate shifted ${goalRateDeltaPercent}% versus the previous week.`,
      severity: 'warning',
      actionRoute: '/(presence)/sessions',
    };
  }

  if (usageDeltaPercent <= -10 || goalRateDeltaPercent >= 20) {
    return {
      type: 'goal-regression',
      title: 'The trend is bending your way',
      body: `You cut average screen time by ${Math.abs(usageDeltaPercent)}% and improved goal hits by ${goalRateDeltaPercent}% week over week.`,
      severity: 'positive',
      actionRoute: '/(presence)/badges',
    };
  }

  return null;
}

export function generatePresenceInsights(daily: DailyUsage[], sessions: FocusSession[]): Insight[] {
  return [
    detectWeekendPattern(daily),
    detectMorningPickupTrend(daily),
    detectSessionTimeOfDay(sessions),
    detectGoalRegression(daily),
  ].filter((insight): insight is Insight => insight != null);
}
