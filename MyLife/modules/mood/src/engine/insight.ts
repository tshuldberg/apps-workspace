/**
 * AI Mood Insights -- 8 pattern detectors, all pure functions.
 * No database access inside detectors. The orchestrator prepares data and passes it in.
 * No network calls. No external AI/ML. Pure TypeScript algorithmic detection.
 */

import type { MoodInsight, InsightType, InsightSeverity } from '../types';

// ── Types ─────────────────────────────────────────────────────────────

export interface EntryData {
  score: number;
  date: string;       // YYYY-MM-DD
  loggedAt: string;    // ISO datetime
  activityNames: string[];
  emotions: string[];
}

export interface ActivityCorrelationData {
  activityName: string;
  averageScore: number;
  entryCount: number;
  pearsonR: number | null;
}

// ── Math Utilities ────────────────────────────────────────────────────

export function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squareDiffs = values.map((v) => (v - mean) ** 2);
  return Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / values.length);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function insightId(type: InsightType, key: string): string {
  return `${type}:${key}`;
}

function makeInsight(
  type: InsightType,
  severity: InsightSeverity,
  title: string,
  body: string,
  metric: string,
  key: string,
  data?: Record<string, unknown>,
): MoodInsight {
  return {
    id: insightId(type, key),
    type,
    severity,
    title,
    body,
    metric,
    data,
    generatedAt: new Date().toISOString(),
  };
}

// ── Detector 1: Day of Week Pattern ──────────────────────────────────

export function detectDayOfWeekPattern(entries: EntryData[]): MoodInsight[] {
  if (entries.length < 14) return [];

  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const byDay: Record<number, number[]> = {};

  for (const e of entries) {
    const day = new Date(e.date + 'T00:00:00Z').getUTCDay();
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(e.score);
  }

  const overall = average(entries.map((e) => e.score));
  const insights: MoodInsight[] = [];

  // Find days that differ by > 1.0 from overall
  let bestDay = -1, bestAvg = -Infinity;
  let worstDay = -1, worstAvg = Infinity;

  for (const [dayStr, scores] of Object.entries(byDay)) {
    if (scores.length < 2) continue;
    const dayNum = Number(dayStr);
    const avg = average(scores);
    if (avg > bestAvg) { bestAvg = avg; bestDay = dayNum; }
    if (avg < worstAvg) { worstAvg = avg; worstDay = dayNum; }
  }

  if (bestDay >= 0 && bestAvg - overall > 1.0) {
    insights.push(makeInsight(
      'day_of_week_pattern',
      'notable',
      'Your Best Day',
      `${DAYS[bestDay]}s are your happiest day -- your average mood is ${round1(bestAvg)} compared to ${round1(overall)} overall.`,
      `${round1(bestAvg)}`,
      `best:${DAYS[bestDay]}`,
    ));
  }

  if (worstDay >= 0 && overall - worstAvg > 1.0) {
    insights.push(makeInsight(
      'day_of_week_pattern',
      'actionable',
      'Your Hardest Day',
      `${DAYS[worstDay]}s tend to be tough -- your average mood is ${round1(worstAvg)} compared to ${round1(overall)} overall.`,
      `${round1(worstAvg)}`,
      `worst:${DAYS[worstDay]}`,
    ));
  }

  return insights;
}

// ── Detector 2: Time of Day Pattern ──────────────────────────────────

export function detectTimeOfDayPattern(entries: EntryData[]): MoodInsight[] {
  if (entries.length < 14) return [];

  const buckets: Record<string, number[]> = {
    morning: [],
    afternoon: [],
    evening: [],
    night: [],
  };

  for (const e of entries) {
    const hour = new Date(e.loggedAt).getHours();
    if (hour >= 5 && hour < 12) buckets.morning.push(e.score);
    else if (hour >= 12 && hour < 17) buckets.afternoon.push(e.score);
    else if (hour >= 17 && hour < 22) buckets.evening.push(e.score);
    else buckets.night.push(e.score);
  }

  const overall = average(entries.map((e) => e.score));
  const insights: MoodInsight[] = [];
  const labels: Record<string, string> = {
    morning: 'Morning (5am-12pm)',
    afternoon: 'Afternoon (12pm-5pm)',
    evening: 'Evening (5pm-10pm)',
    night: 'Night (10pm-5am)',
  };

  for (const [bucket, scores] of Object.entries(buckets)) {
    if (scores.length < 3) continue;
    const avg = average(scores);
    const diff = avg - overall;
    if (Math.abs(diff) > 0.8) {
      insights.push(makeInsight(
        'time_of_day_pattern',
        diff > 0 ? 'info' : 'notable',
        diff > 0 ? `${labels[bucket]} Boost` : `${labels[bucket]} Dip`,
        `Your mood averages ${round1(avg)} during ${labels[bucket].toLowerCase()}, compared to ${round1(overall)} overall (${diff > 0 ? '+' : ''}${round1(diff)}).`,
        `${diff > 0 ? '+' : ''}${round1(diff)}`,
        bucket,
      ));
    }
  }

  return insights;
}

// ── Detector 3: Activity Impact ──────────────────────────────────────

export function detectActivityImpact(
  correlations: ActivityCorrelationData[],
  overallAvg: number,
): MoodInsight[] {
  const insights: MoodInsight[] = [];

  // Top positive
  const positive = correlations
    .filter((c) => c.pearsonR !== null && c.pearsonR >= 0.2 && c.entryCount >= 3)
    .sort((a, b) => (b.pearsonR ?? 0) - (a.pearsonR ?? 0));

  if (positive.length > 0) {
    const top = positive[0];
    insights.push(makeInsight(
      'activity_impact',
      'actionable',
      `${top.activityName} Boosts Your Mood`,
      `Your mood averages ${round1(top.averageScore)} on ${top.activityName} days compared to ${round1(overallAvg)} overall. That's a +${round1(top.averageScore - overallAvg)} point difference.`,
      `+${round1(top.averageScore - overallAvg)} pts`,
      `positive:${top.activityName}`,
    ));
  }

  // Top negative
  const negative = correlations
    .filter((c) => c.pearsonR !== null && c.pearsonR <= -0.2 && c.entryCount >= 3)
    .sort((a, b) => (a.pearsonR ?? 0) - (b.pearsonR ?? 0));

  if (negative.length > 0) {
    const top = negative[0];
    insights.push(makeInsight(
      'activity_impact',
      'notable',
      `${top.activityName} and Lower Mood`,
      `Your mood averages ${round1(top.averageScore)} on ${top.activityName} days compared to ${round1(overallAvg)} overall.`,
      `${round1(top.averageScore - overallAvg)} pts`,
      `negative:${top.activityName}`,
    ));
  }

  return insights;
}

// ── Detector 4: Emotion Cluster ──────────────────────────────────────

export function detectEmotionCluster(entries: EntryData[]): MoodInsight[] {
  const entriesWithEmotions = entries.filter((e) => e.emotions.length >= 2);
  if (entriesWithEmotions.length < 10) return [];

  const pairCounts: Record<string, number> = {};
  const total = entriesWithEmotions.length;

  for (const e of entriesWithEmotions) {
    const sorted = [...e.emotions].sort();
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const key = `${sorted[i]}+${sorted[j]}`;
        pairCounts[key] = (pairCounts[key] ?? 0) + 1;
      }
    }
  }

  const insights: MoodInsight[] = [];

  for (const [pair, count] of Object.entries(pairCounts)) {
    const pct = (count / total) * 100;
    if (pct > 30) {
      const [a, b] = pair.split('+');
      insights.push(makeInsight(
        'emotion_cluster',
        'info',
        `${titleCase(a)} & ${titleCase(b)}`,
        `${titleCase(a)} and ${titleCase(b)} often appear together in your entries (${Math.round(pct)}% of the time).`,
        `${Math.round(pct)}%`,
        pair,
      ));
    }
  }

  return insights;
}

// ── Detector 5: Streak Impact ────────────────────────────────────────

export function detectStreakImpact(
  streakDayScores: number[],
  nonStreakDayScores: number[],
): MoodInsight[] {
  if (streakDayScores.length < 5 || nonStreakDayScores.length < 3) return [];

  const streakAvg = average(streakDayScores);
  const nonStreakAvg = average(nonStreakDayScores);
  const diff = streakAvg - nonStreakAvg;

  if (Math.abs(diff) <= 0.5) return [];

  return [makeInsight(
    'streak_impact',
    diff > 0 ? 'actionable' : 'notable',
    diff > 0 ? 'Streaks Help' : 'Streak Pressure',
    `During logging streaks, your mood averages ${round1(streakAvg)} vs ${round1(nonStreakAvg)} on gap days.`,
    `${diff > 0 ? '+' : ''}${round1(diff)} pts`,
    'streak',
  )];
}

// ── Detector 6: Trend Direction ──────────────────────────────────────

export function detectTrendDirection(
  thisWeekAvg: number,
  fourWeekAvg: number,
  thisWeekCount: number,
): MoodInsight[] {
  if (thisWeekCount < 3) return [];

  const diff = thisWeekAvg - fourWeekAvg;

  if (diff > 1.0) {
    return [makeInsight(
      'trend_direction',
      'info',
      'Great Week!',
      `Your mood is trending up. This week's average is ${round1(thisWeekAvg)} compared to your 4-week rolling average of ${round1(fourWeekAvg)}.`,
      `+${round1(diff)}`,
      'up',
    )];
  }

  if (diff < -1.0) {
    return [makeInsight(
      'trend_direction',
      'notable',
      'Tough Week',
      `Your mood is below your recent average. This week: ${round1(thisWeekAvg)} vs 4-week average: ${round1(fourWeekAvg)}.`,
      `${round1(diff)}`,
      'down',
    )];
  }

  return [];
}

// ── Detector 7: Volatility Alert ─────────────────────────────────────

export function detectVolatilityAlert(dailyAverages: number[]): MoodInsight[] {
  if (dailyAverages.length < 7) return [];

  const last7 = dailyAverages.slice(-7);
  const stddev = standardDeviation(last7);

  if (stddev <= 2.0) return [];

  return [makeInsight(
    'volatility_alert',
    'notable',
    'Volatile Week',
    `Your mood has been swinging significantly this week (standard deviation: ${round1(stddev)}). Consider what might be driving the ups and downs.`,
    `\u{00B1}${round1(stddev)}`,
    'volatile',
  )];
}

// ── Detector 8: Best/Worst Day ───────────────────────────────────────

export function detectBestWorstDay(entries: EntryData[]): MoodInsight[] {
  if (entries.length < 14) return [];

  // Group by date, average scores per day
  const byDate: Record<string, { scores: number[]; activities: Set<string>; emotions: Set<string> }> = {};
  for (const e of entries) {
    if (!byDate[e.date]) byDate[e.date] = { scores: [], activities: new Set(), emotions: new Set() };
    byDate[e.date].scores.push(e.score);
    for (const a of e.activityNames) byDate[e.date].activities.add(a);
    for (const em of e.emotions) byDate[e.date].emotions.add(em);
  }

  const days = Object.entries(byDate).map(([date, data]) => ({
    date,
    avg: average(data.scores),
    activities: Array.from(data.activities),
    emotions: Array.from(data.emotions),
  }));

  if (days.length < 2) return [];

  days.sort((a, b) => b.avg - a.avg);
  const best = days[0];
  const worst = days[days.length - 1];

  const insights: MoodInsight[] = [];

  const bestContext = best.activities.length > 0
    ? ` -- you logged ${best.activities.join(', ')} that day`
    : '';
  insights.push(makeInsight(
    'best_worst_day',
    'info',
    'Your Best Day',
    `Your best day was ${formatDate(best.date)} (${round1(best.avg)})${bestContext}.`,
    `${round1(best.avg)}`,
    `best:${best.date}`,
  ));

  const worstContext = worst.activities.length > 0
    ? ` -- you logged ${worst.activities.join(', ')} that day`
    : '';
  insights.push(makeInsight(
    'best_worst_day',
    'notable',
    'Your Hardest Day',
    `Your hardest day was ${formatDate(worst.date)} (${round1(worst.avg)})${worstContext}.`,
    `${round1(worst.avg)}`,
    `worst:${worst.date}`,
  ));

  return insights;
}

// ── Orchestrator ──────────────────────────────────────────────────────

export interface InsightInput {
  entries: EntryData[];
  activityCorrelations: ActivityCorrelationData[];
  overallAvg: number;
  thisWeekAvg: number;
  fourWeekAvg: number;
  thisWeekCount: number;
  dailyAverages: number[];
  streakDayScores: number[];
  nonStreakDayScores: number[];
}

export function generateInsights(input: InsightInput): MoodInsight[] {
  const all: MoodInsight[] = [
    ...detectDayOfWeekPattern(input.entries),
    ...detectTimeOfDayPattern(input.entries),
    ...detectActivityImpact(input.activityCorrelations, input.overallAvg),
    ...detectEmotionCluster(input.entries),
    ...detectStreakImpact(input.streakDayScores, input.nonStreakDayScores),
    ...detectTrendDirection(input.thisWeekAvg, input.fourWeekAvg, input.thisWeekCount),
    ...detectVolatilityAlert(input.dailyAverages),
    ...detectBestWorstDay(input.entries),
  ];

  // Deduplicate by id
  const seen = new Set<string>();
  return all.filter((insight) => {
    if (seen.has(insight.id)) return false;
    seen.add(insight.id);
    return true;
  });
}

// ── Helpers ───────────────────────────────────────────────────────────

function titleCase(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return `${days[d.getUTCDay()]}, ${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
}
