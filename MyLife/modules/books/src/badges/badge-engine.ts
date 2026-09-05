/**
 * Badge engine -- badge evaluation, stat gathering, and automatic awarding.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { Badge } from '../db/badges';
import { getUnearnedBadges, getAllBadges, awardBadge } from '../db/badges';
import type { BadgeProgress, BadgeEvaluationResult, BadgeStats } from './types';

/**
 * Gather all stats needed for badge evaluation from the database.
 */
export function gatherBadgeStats(db: DatabaseAdapter): BadgeStats {
  // Total finished books
  const totalBooksRows = db.query<{ count: number }>(
    `SELECT COUNT(DISTINCT book_id) as count FROM bk_reading_sessions WHERE status = 'finished'`,
  );
  const totalBooks = totalBooksRows.length > 0 ? totalBooksRows[0].count : 0;

  // Total pages from finished books
  const totalPagesRows = db.query<{ total: number | null }>(
    `SELECT SUM(b.page_count) as total FROM bk_books b
     JOIN bk_reading_sessions rs ON b.id = rs.book_id
     WHERE rs.status = 'finished'`,
  );
  const totalPages = totalPagesRows.length > 0 && totalPagesRows[0].total != null
    ? totalPagesRows[0].total
    : 0;

  // Distinct genres from finished books
  const genreRows = db.query<{ count: number }>(
    `SELECT COUNT(DISTINCT value) as count FROM bk_mood_tags
     WHERE tag_type = 'genre' AND book_id IN (
       SELECT DISTINCT book_id FROM bk_reading_sessions WHERE status = 'finished'
     )`,
  );
  const genreCount = genreRows.length > 0 ? genreRows[0].count : 0;

  // Distinct authors from finished books
  const authorCount = countDistinctAuthors(db);

  // Current reading streak
  const currentStreak = computeStreak(db);

  // Completed challenges
  const challengeRows = db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM bk_challenges WHERE is_active = 0`,
  );
  const completedChallenges = challengeRows.length > 0 ? challengeRows[0].count : 0;

  // Review count -- count actual written reviews, not just star ratings
  const reviewRows = db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM bk_reviews WHERE review_text IS NOT NULL AND review_text != ''`,
  );
  const reviewCount = reviewRows.length > 0 ? reviewRows[0].count : 0;

  // Journal entry count
  const journalRows = db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM bk_journal_entries`,
  );
  const journalCount = journalRows.length > 0 ? journalRows[0].count : 0;

  // Fastest book (minimum days between started_at and finished_at)
  const speedRows = db.query<{ min_days: number | null }>(
    `SELECT MIN(
       CAST(julianday(finished_at) - julianday(started_at) AS INTEGER) + 1
     ) as min_days
     FROM bk_reading_sessions
     WHERE status = 'finished' AND started_at IS NOT NULL AND finished_at IS NOT NULL`,
  );
  const fastestBookDays = speedRows.length > 0 && speedRows[0].min_days != null
    ? speedRows[0].min_days
    : null;

  return {
    totalBooks,
    totalPages,
    genreCount,
    authorCount,
    currentStreak,
    completedChallenges,
    reviewCount,
    journalCount,
    fastestBookDays,
  };
}

/**
 * Count distinct authors from all finished books by parsing JSON author arrays.
 */
export function countDistinctAuthors(db: DatabaseAdapter): number {
  const rows = db.query<{ authors: string }>(
    `SELECT DISTINCT b.authors FROM bk_books b
     JOIN bk_reading_sessions rs ON b.id = rs.book_id
     WHERE rs.status = 'finished'`,
  );

  const authorSet = new Set<string>();
  for (const row of rows) {
    try {
      const parsed = JSON.parse(row.authors) as string[];
      for (const author of parsed) {
        authorSet.add(author.toLowerCase().trim());
      }
    } catch {
      // If authors is a plain string, count as one author
      if (row.authors) {
        authorSet.add(row.authors.toLowerCase().trim());
      }
    }
  }

  return authorSet.size;
}

/**
 * Compute the current reading streak (consecutive days with activity).
 * Checks both timed_sessions and progress_updates for activity dates.
 */
export function computeStreak(db: DatabaseAdapter): number {
  // Gather all activity dates from timed sessions
  const timedRows = db.query<{ day: string }>(
    `SELECT DISTINCT DATE(started_at) as day FROM bk_timed_sessions ORDER BY day DESC`,
  );

  // Gather all activity dates from progress updates
  const progressRows = db.query<{ day: string }>(
    `SELECT DISTINCT DATE(created_at) as day FROM bk_progress_updates ORDER BY day DESC`,
  );

  // Merge into a set of unique dates
  const dateSet = new Set<string>();
  for (const row of timedRows) {
    if (row.day) dateSet.add(row.day);
  }
  for (const row of progressRows) {
    if (row.day) dateSet.add(row.day);
  }

  if (dateSet.size === 0) return 0;

  // Sort dates descending
  const dates = Array.from(dateSet).sort().reverse();

  // Check if the most recent activity is today or yesterday
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  if (dates[0] !== todayStr && dates[0] !== yesterdayStr) {
    return 0; // Streak is broken
  }

  // Count consecutive days
  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const current = new Date(dates[i - 1]);
    const prev = new Date(dates[i]);
    const diffMs = current.getTime() - prev.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Get progress info for a single badge given current stats.
 */
export function getBadgeProgress(badge: Badge, stats: BadgeStats): BadgeProgress {
  const currentValue = getStatForCategory(badge.category, stats);

  return {
    badge,
    currentValue,
    isEarned: badge.earned_at !== null,
    progressText: `${currentValue}/${badge.threshold}`,
  };
}

/**
 * Evaluate all unearned badges against current stats, awarding any that
 * have met their threshold. Returns newly earned badges and progress for all badges.
 */
export function evaluateBadges(db: DatabaseAdapter): BadgeEvaluationResult {
  const unearnedBadges = getUnearnedBadges(db);
  const stats = gatherBadgeStats(db);
  const newlyEarned: Badge[] = [];

  for (const badge of unearnedBadges) {
    const currentValue = getStatForCategory(badge.category, stats);

    if (meetsThreshold(badge, currentValue, stats)) {
      awardBadge(db, badge.id);
      newlyEarned.push({ ...badge, earned_at: new Date().toISOString() });
    }
  }

  // Build progress for all badges
  const allBadges = getAllBadges(db);
  const allProgress: BadgeProgress[] = allBadges.map((badge) =>
    getBadgeProgress(badge, stats),
  );

  return { newlyEarned, allProgress };
}

/**
 * Map a badge category to the relevant stat value.
 */
function getStatForCategory(category: string, stats: BadgeStats): number {
  switch (category) {
    case 'volume':
      return stats.totalBooks;
    case 'pages':
      return stats.totalPages;
    case 'genre':
      return stats.genreCount;
    case 'author':
      return stats.authorCount;
    case 'streak':
      return stats.currentStreak;
    case 'challenge':
      return stats.completedChallenges;
    case 'review':
      return stats.reviewCount;
    case 'journal':
      return stats.journalCount;
    default:
      return 0;
  }
}

/**
 * Check if a badge's threshold condition is met.
 * Speed badges use inverted logic (fastestBookDays <= threshold).
 */
function meetsThreshold(badge: Badge, currentValue: number, stats: BadgeStats): boolean {
  if (badge.category === 'speed') {
    // Speed badges: threshold is max days, so fastest must be <= threshold
    return stats.fastestBookDays !== null && stats.fastestBookDays <= badge.threshold;
  }
  return currentValue >= badge.threshold;
}
