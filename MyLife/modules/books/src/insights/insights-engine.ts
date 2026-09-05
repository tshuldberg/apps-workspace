/**
 * Reading insights engine -- mines reading session data for personalized observations.
 *
 * All computation is local. No cloud dependencies.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { ReadingInsight, InsightSet } from './types';

const MINIMUM_BOOKS = 5;

interface TimedSessionRow {
  started_at: string;
  duration_ms: number;
  pages_read: number | null;
  pages_per_hour: number | null;
  book_id: string;
}

interface BookRow {
  id: string;
  subjects: string | null;
  created_at: string;
}

interface CountRow {
  count: number;
}

function getDayOfWeek(dateStr: string): number {
  return new Date(dateStr).getDay();
}

function getHour(dateStr: string): number {
  return new Date(dateStr).getHours();
}

function isWeekend(dayOfWeek: number): boolean {
  return dayOfWeek === 0 || dayOfWeek === 6;
}

/**
 * Compute personalized reading insights from local data.
 */
export function computeInsights(db: DatabaseAdapter): InsightSet {
  const bookCountRows = db.query<CountRow>('SELECT COUNT(*) as count FROM bk_books');
  const totalBooks = bookCountRows[0]?.count ?? 0;

  if (totalBooks < MINIMUM_BOOKS) {
    return {
      insights: [],
      computedAt: new Date().toISOString(),
      insufficientData: true,
      minimumBooksRequired: MINIMUM_BOOKS,
    };
  }

  const insights: ReadingInsight[] = [];

  // Weekend vs weekday reading speed
  const weekendInsight = computeWeekendVsWeekday(db);
  if (weekendInsight) insights.push(weekendInsight);

  // Peak reading hours
  const peakHourInsight = computePeakReadingHours(db);
  if (peakHourInsight) insights.push(peakHourInsight);

  // Average session duration trend
  const durationInsight = computeSessionDurationTrend(db);
  if (durationInsight) insights.push(durationInsight);

  // Genre diversity
  const diversityInsight = computeGenreDiversity(db);
  if (diversityInsight) insights.push(diversityInsight);

  // Completion rate
  const completionInsight = computeCompletionRate(db);
  if (completionInsight) insights.push(completionInsight);

  // Streak info
  const streakInsight = computeReadingStreak(db);
  if (streakInsight) insights.push(streakInsight);

  return {
    insights,
    computedAt: new Date().toISOString(),
    insufficientData: false,
    minimumBooksRequired: MINIMUM_BOOKS,
  };
}

function computeWeekendVsWeekday(db: DatabaseAdapter): ReadingInsight | null {
  const sessions = db.query<TimedSessionRow>(
    `SELECT started_at, duration_ms, pages_read, pages_per_hour, book_id
     FROM bk_timed_sessions
     WHERE duration_ms > 0 AND pages_read > 0`,
  );

  if (sessions.length < 5) return null;

  let weekendPages = 0;
  let weekendMs = 0;
  let weekdayPages = 0;
  let weekdayMs = 0;

  for (const s of sessions) {
    const day = getDayOfWeek(s.started_at);
    if (isWeekend(day)) {
      weekendPages += s.pages_read ?? 0;
      weekendMs += s.duration_ms;
    } else {
      weekdayPages += s.pages_read ?? 0;
      weekdayMs += s.duration_ms;
    }
  }

  if (weekendMs === 0 || weekdayMs === 0) return null;

  const weekendPph = (weekendPages / weekendMs) * 3_600_000;
  const weekdayPph = (weekdayPages / weekdayMs) * 3_600_000;
  const ratio = weekendPph / weekdayPph;
  const percentDiff = Math.round(Math.abs(ratio - 1) * 100);

  if (percentDiff < 5) return null;

  const faster = ratio > 1 ? 'weekends' : 'weekdays';

  return {
    id: 'weekend_vs_weekday',
    category: 'speed',
    title: `You read ${percentDiff}% faster on ${faster}`,
    description: faster === 'weekends'
      ? `Your weekend reading pace is ${Math.round(weekendPph)} pages/hour vs ${Math.round(weekdayPph)} on weekdays.`
      : `Your weekday reading pace is ${Math.round(weekdayPph)} pages/hour vs ${Math.round(weekendPph)} on weekends.`,
    value: percentDiff,
    comparisonValue: faster,
    comparisonLabel: 'faster on',
  };
}

function computePeakReadingHours(db: DatabaseAdapter): ReadingInsight | null {
  const sessions = db.query<TimedSessionRow>(
    `SELECT started_at, duration_ms, pages_read, pages_per_hour, book_id
     FROM bk_timed_sessions
     WHERE duration_ms > 0`,
  );

  if (sessions.length < 5) return null;

  const hourBuckets = new Array<number>(24).fill(0);

  for (const s of sessions) {
    const hour = getHour(s.started_at);
    hourBuckets[hour] += s.duration_ms;
  }

  let peakHour = 0;
  let peakMs = 0;
  for (let h = 0; h < 24; h++) {
    if (hourBuckets[h] > peakMs) {
      peakMs = hourBuckets[h];
      peakHour = h;
    }
  }

  const label = peakHour === 0 ? '12 AM'
    : peakHour < 12 ? `${peakHour} AM`
    : peakHour === 12 ? '12 PM'
    : `${peakHour - 12} PM`;

  return {
    id: 'peak_reading_hour',
    category: 'timing',
    title: `Your peak reading hour is ${label}`,
    description: `You log the most reading time around ${label}. Your longest sessions tend to start then.`,
    value: peakHour,
    comparisonLabel: 'peak hour',
  };
}

function computeSessionDurationTrend(db: DatabaseAdapter): ReadingInsight | null {
  const sessions = db.query<{ duration_ms: number; started_at: string }>(
    `SELECT duration_ms, started_at FROM bk_timed_sessions
     WHERE duration_ms > 0
     ORDER BY started_at ASC`,
  );

  if (sessions.length < 10) return null;

  const midpoint = Math.floor(sessions.length / 2);
  const firstHalf = sessions.slice(0, midpoint);
  const secondHalf = sessions.slice(midpoint);

  const avgFirst = firstHalf.reduce((sum, s) => sum + s.duration_ms, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((sum, s) => sum + s.duration_ms, 0) / secondHalf.length;

  const firstMin = Math.round(avgFirst / 60_000);
  const secondMin = Math.round(avgSecond / 60_000);
  const diff = secondMin - firstMin;

  if (Math.abs(diff) < 2) return null;

  const direction = diff > 0 ? 'longer' : 'shorter';

  return {
    id: 'session_duration_trend',
    category: 'consistency',
    title: `Your sessions are getting ${direction}`,
    description: `Average session went from ${firstMin} min to ${secondMin} min. ${direction === 'longer' ? 'You\'re settling into deeper reading.' : 'You might be reading in more frequent, shorter bursts.'}`,
    value: secondMin,
    comparisonValue: firstMin,
    comparisonLabel: 'minutes (before)',
  };
}

function computeGenreDiversity(db: DatabaseAdapter): ReadingInsight | null {
  const books = db.query<BookRow>(
    `SELECT b.id, b.subjects, b.created_at FROM bk_books b
     JOIN bk_reading_sessions s ON s.book_id = b.id
     WHERE s.status = 'finished' AND b.subjects IS NOT NULL`,
  );

  if (books.length < 3) return null;

  const genres = new Set<string>();
  for (const book of books) {
    try {
      const parsed = JSON.parse(book.subjects ?? '[]');
      if (Array.isArray(parsed)) {
        for (const s of parsed.slice(0, 3)) {
          if (typeof s === 'string') genres.add(s.toLowerCase());
        }
      }
    } catch {
      // skip
    }
  }

  return {
    id: 'genre_diversity',
    category: 'diversity',
    title: `You've explored ${genres.size} genres`,
    description: `Across your finished books, you've read from ${genres.size} different subject areas.`,
    value: genres.size,
    comparisonLabel: 'genres explored',
  };
}

function computeCompletionRate(db: DatabaseAdapter): ReadingInsight | null {
  const startedRows = db.query<CountRow>(
    `SELECT COUNT(*) as count FROM bk_reading_sessions WHERE status IN ('reading', 'finished', 'dnf')`,
  );
  const finishedRows = db.query<CountRow>(
    `SELECT COUNT(*) as count FROM bk_reading_sessions WHERE status = 'finished'`,
  );

  const started = startedRows[0]?.count ?? 0;
  const finished = finishedRows[0]?.count ?? 0;

  if (started < 3) return null;

  const rate = Math.round((finished / started) * 100);

  return {
    id: 'completion_rate',
    category: 'milestones',
    title: `You finish ${rate}% of books you start`,
    description: `Out of ${started} books started, you've completed ${finished}.${rate >= 80 ? ' Strong follow-through!' : rate < 50 ? ' No shame in DNF-ing.' : ''}`,
    value: rate,
    comparisonValue: `${finished}/${started}`,
    comparisonLabel: 'finished/started',
  };
}

function computeReadingStreak(db: DatabaseAdapter): ReadingInsight | null {
  const sessions = db.query<{ started_at: string }>(
    `SELECT DISTINCT DATE(started_at) as started_at FROM bk_timed_sessions
     WHERE started_at IS NOT NULL
     ORDER BY started_at DESC`,
  );

  if (sessions.length < 2) return null;

  let currentStreak = 1;
  let currentStreakDone = false;
  let maxStreak = 1;
  let streak = 1;

  for (let i = 1; i < sessions.length; i++) {
    const prev = new Date(sessions[i - 1].started_at);
    const curr = new Date(sessions[i].started_at);
    const diffDays = Math.round((prev.getTime() - curr.getTime()) / 86_400_000);

    if (diffDays === 1) {
      streak++;
    } else {
      if (streak > maxStreak) maxStreak = streak;
      if (!currentStreakDone) {
        currentStreak = streak;
        currentStreakDone = true;
      }
      streak = 1;
    }
  }
  if (streak > maxStreak) maxStreak = streak;
  if (!currentStreakDone) currentStreak = streak;

  if (maxStreak < 3) return null;

  return {
    id: 'reading_streak',
    category: 'consistency',
    title: `Longest streak: ${maxStreak} days`,
    description: `Your best reading streak was ${maxStreak} consecutive days.${currentStreak > 1 ? ` Currently on a ${currentStreak}-day streak!` : ''}`,
    value: maxStreak,
    comparisonValue: currentStreak,
    comparisonLabel: 'current streak',
  };
}
