/**
 * Community challenges engine -- progress tracking and auto-update.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { CommunityChallenge, CommunityParticipation } from '../db/community-challenges';
import {
  getActiveParticipations,
  getCommunityChallenge,
  getAllCommunityChallenge,
  getParticipation,
  updateParticipationProgress,
  completeParticipation,
} from '../db/community-challenges';
import type { CommunityChallengeWithProgress, CommunityProgressUpdate } from './types';

/**
 * Update progress for all active community challenges when a book is finished.
 */
export function updateCommunityProgress(
  db: DatabaseAdapter,
  bookId: string,
  pageCount?: number,
): CommunityProgressUpdate[] {
  const activeParticipations = getActiveParticipations(db);
  const updates: CommunityProgressUpdate[] = [];

  for (const participation of activeParticipations) {
    const challenge = getCommunityChallenge(db, participation.challenge_id);
    if (!challenge) continue;

    // Skip expired challenges
    const { isExpired } = getChallengeTimeStatus(challenge);
    if (isExpired) continue;

    let newValue = participation.current_value;

    switch (challenge.challenge_type) {
      case 'books_count':
        newValue = participation.current_value + 1;
        break;

      case 'pages_count':
        if (pageCount && pageCount > 0) {
          newValue = participation.current_value + pageCount;
        }
        break;

      case 'genre_diversity':
        newValue = getGenreDiversity(db, challenge.start_date, challenge.end_date);
        break;

      case 'author_diversity':
        newValue = getAuthorDiversity(db, challenge.start_date, challenge.end_date);
        break;

      case 'themed': {
        const matches = checkThemedMatch(db, bookId, challenge.theme_tags);
        if (matches) {
          newValue = participation.current_value + 1;
        }
        break;
      }
    }

    // Only update if value changed
    if (newValue !== participation.current_value) {
      updateParticipationProgress(db, participation.id, newValue);

      const isComplete = newValue >= challenge.target_value;
      if (isComplete) {
        completeParticipation(db, participation.id);
      }

      updates.push({
        challengeId: challenge.id,
        participationId: participation.id,
        newValue,
        isComplete,
      });
    }
  }

  return updates;
}

/**
 * Count distinct genres from finished books within a date range.
 */
export function getGenreDiversity(
  db: DatabaseAdapter,
  startDate: string,
  endDate: string,
): number {
  const rows = db.query<{ count: number }>(
    `SELECT COUNT(DISTINCT mt.value) as count
     FROM bk_mood_tags mt
     JOIN bk_reading_sessions rs ON mt.book_id = rs.book_id
     WHERE mt.tag_type = 'genre'
       AND rs.status = 'finished'
       AND rs.finished_at BETWEEN ? AND ?`,
    [startDate, endDate],
  );
  return rows[0]?.count ?? 0;
}

/**
 * Count distinct authors from finished books within a date range.
 */
export function getAuthorDiversity(
  db: DatabaseAdapter,
  startDate: string,
  endDate: string,
): number {
  const rows = db.query<{ authors: string }>(
    `SELECT b.authors
     FROM bk_books b
     JOIN bk_reading_sessions rs ON b.id = rs.book_id
     WHERE rs.status = 'finished'
       AND rs.finished_at BETWEEN ? AND ?`,
    [startDate, endDate],
  );

  const uniqueAuthors = new Set<string>();
  for (const row of rows) {
    try {
      const parsed = JSON.parse(row.authors);
      if (Array.isArray(parsed)) {
        for (const author of parsed) {
          uniqueAuthors.add(author.toLowerCase().trim());
        }
      } else {
        uniqueAuthors.add(String(row.authors).toLowerCase().trim());
      }
    } catch {
      // If JSON parse fails, treat as single author string
      uniqueAuthors.add(String(row.authors).toLowerCase().trim());
    }
  }

  return uniqueAuthors.size;
}

/**
 * Check if a book's mood tags overlap with a challenge's theme_tags.
 */
export function checkThemedMatch(
  db: DatabaseAdapter,
  bookId: string,
  themeTags: string | null,
): boolean {
  if (!themeTags) return false;

  let parsed: string[];
  try {
    parsed = JSON.parse(themeTags);
    if (!Array.isArray(parsed)) return false;
  } catch {
    return false;
  }

  const bookTags = db.query<{ value: string }>(
    `SELECT value FROM bk_mood_tags WHERE book_id = ?`,
    [bookId],
  );

  const bookTagValues = new Set(bookTags.map((t) => t.value.toLowerCase().trim()));

  return parsed.some((tag) => bookTagValues.has(tag.toLowerCase().trim()));
}

/**
 * Get time status for a community challenge.
 */
export function getChallengeTimeStatus(
  challenge: CommunityChallenge,
): { daysRemaining: number | null; isExpired: boolean } {
  const now = new Date();
  const endDate = new Date(challenge.end_date);

  if (isNaN(endDate.getTime())) {
    return { daysRemaining: null, isExpired: false };
  }

  const diffMs = endDate.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return {
    daysRemaining: daysRemaining >= 0 ? daysRemaining : 0,
    isExpired: daysRemaining < 0,
  };
}

/**
 * Get all community challenges with their progress and time status.
 */
export function getCommunityChallengesWithProgress(
  db: DatabaseAdapter,
): CommunityChallengeWithProgress[] {
  const challenges = getAllCommunityChallenge(db);
  const participations = getActiveParticipations(db);

  // Build lookup from challenge_id to participation
  const participationMap = new Map<string, CommunityParticipation>();
  for (const p of participations) {
    participationMap.set(p.challenge_id, p);
  }

  return challenges.map((challenge) => {
    const participation = participationMap.get(challenge.id) ?? null;
    const { daysRemaining, isExpired } = getChallengeTimeStatus(challenge);

    const currentValue = participation?.current_value ?? 0;
    const percentComplete = challenge.target_value > 0
      ? Math.min(Math.round((currentValue / challenge.target_value) * 100), 100)
      : 0;

    return {
      challenge,
      participation,
      percentComplete,
      daysRemaining,
      isExpired,
    };
  });
}
