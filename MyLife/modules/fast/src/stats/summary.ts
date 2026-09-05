import type { DatabaseAdapter } from '@mylife/db';
import type { SummaryStats } from '../types';
import { adherenceRate } from './aggregation';
import { getStreaks } from './streaks';

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function monthRange(year: number, month: number): { start: string; end: string } {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return { start: toISODate(start), end: toISODate(end) };
}

function yearRange(year: number): { start: string; end: string } {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year, 11, 31));
  return { start: toISODate(start), end: toISODate(end) };
}

function summaryForRange(db: DatabaseAdapter, start: string, end: string): SummaryStats {
  const rows = db.query<{
    total_fasts: number;
    total_seconds: number | null;
    avg_seconds: number | null;
    longest_seconds: number | null;
    hits: number;
  }>(
    `SELECT
      COUNT(*) as total_fasts,
      COALESCE(SUM(duration_seconds), 0) as total_seconds,
      AVG(duration_seconds) as avg_seconds,
      MAX(duration_seconds) as longest_seconds,
      SUM(CASE WHEN hit_target = 1 THEN 1 ELSE 0 END) as hits
     FROM ft_fasts
     WHERE ended_at IS NOT NULL
       AND started_at >= ? AND started_at < date(?, '+1 day')`,
    [start, end],
  );

  const totals = rows[0];
  const totalFasts = totals?.total_fasts ?? 0;
  const totalHours = Math.round((((totals?.total_seconds ?? 0) / 3600) + Number.EPSILON) * 10) / 10;
  const averageDurationHours = totalFasts > 0
    ? Math.round(((((totals?.avg_seconds ?? 0) / 3600) + Number.EPSILON) * 10)) / 10
    : 0;
  const longestFastHours = Math.round(((((totals?.longest_seconds ?? 0) / 3600) + Number.EPSILON) * 10)) / 10;

  const periodAdherence = totalFasts > 0
    ? Math.round((((totals?.hits ?? 0) / totalFasts) * 100 + Number.EPSILON) * 10) / 10
    : 0;

  const streaks = getStreaks(db);

  return {
    totalFasts,
    totalHours,
    averageDurationHours,
    longestFastHours,
    adherenceRate: Number.isFinite(periodAdherence) ? periodAdherence : adherenceRate(db),
    currentStreak: streaks.currentStreak,
  };
}

export function getMonthlySummary(db: DatabaseAdapter, year: number, month: number): SummaryStats {
  const range = monthRange(year, month);
  return summaryForRange(db, range.start, range.end);
}

export function getAnnualSummary(db: DatabaseAdapter, year: number): SummaryStats {
  const range = yearRange(year);
  return summaryForRange(db, range.start, range.end);
}

export function formatSummaryShareText(
  summary: SummaryStats,
  label: string,
): string {
  return [
    `${label} Summary`,
    `Total fasts: ${summary.totalFasts}`,
    `Total hours: ${summary.totalHours}h`,
    `Average duration: ${summary.averageDurationHours}h`,
    `Longest fast: ${summary.longestFastHours}h`,
    `Current streak: ${summary.currentStreak} day${summary.currentStreak === 1 ? '' : 's'}`,
    `Adherence: ${summary.adherenceRate}%`,
  ].join('\n');
}
