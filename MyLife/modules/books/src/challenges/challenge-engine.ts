/**
 * Challenge engine -- higher-level challenge status and auto-logging.
 */

import type { DatabaseAdapter } from '@mylife/db';
import { getChallenge, getActiveChallenges } from '../db/challenges';
import { getTotalProgress, logChallengeProgress } from '../db/challenge-progress';
import type { ChallengeStatus } from './types';

/**
 * Get the current status of a challenge including progress percentage.
 */
export function getChallengeStatus(
  db: DatabaseAdapter,
  challengeId: string,
): ChallengeStatus | null {
  const challenge = getChallenge(db, challengeId);
  if (!challenge) return null;

  const currentValue = getTotalProgress(db, challengeId);
  const targetValue = challenge.target_value;
  const percentComplete = targetValue > 0
    ? Math.min(Math.round((currentValue / targetValue) * 100), 100)
    : 0;

  return {
    challenge,
    currentValue,
    targetValue,
    percentComplete,
    isComplete: currentValue >= targetValue,
  };
}

/**
 * Get statuses for all active challenges.
 */
export function getActiveChallengeStatuses(
  db: DatabaseAdapter,
): ChallengeStatus[] {
  const challenges = getActiveChallenges(db);
  return challenges.map((challenge) => {
    const currentValue = getTotalProgress(db, challenge.id);
    const targetValue = challenge.target_value;
    const percentComplete = targetValue > 0
      ? Math.min(Math.round((currentValue / targetValue) * 100), 100)
      : 0;

    return {
      challenge,
      currentValue,
      targetValue,
      percentComplete,
      isComplete: currentValue >= targetValue,
    };
  });
}

/**
 * Auto-log progress for relevant active challenges when a book is completed.
 * - books_count challenges get +1
 * - pages_count challenges get +pageCount (if provided)
 */
export function logBookCompletion(
  db: DatabaseAdapter,
  bookId: string,
  pageCount?: number,
): void {
  const challenges = getActiveChallenges(db);

  for (const challenge of challenges) {
    if (challenge.challenge_type === 'books_count' || challenge.challenge_type === 'themed') {
      const id = crypto.randomUUID();
      logChallengeProgress(db, id, {
        challenge_id: challenge.id,
        book_id: bookId,
        value_added: 1,
        note: 'Auto-logged: book completed',
      });
    }

    if (challenge.challenge_type === 'pages_count' && pageCount && pageCount > 0) {
      const id = crypto.randomUUID();
      logChallengeProgress(db, id, {
        challenge_id: challenge.id,
        book_id: bookId,
        value_added: pageCount,
        note: 'Auto-logged: book completed',
      });
    }
  }
}

/**
 * Auto-log reading minutes for relevant active challenges.
 */
export function logReadingMinutes(
  db: DatabaseAdapter,
  bookId: string,
  minutes: number,
): void {
  if (minutes <= 0) return;

  const challenges = getActiveChallenges(db);

  for (const challenge of challenges) {
    if (challenge.challenge_type === 'minutes_count') {
      const id = crypto.randomUUID();
      logChallengeProgress(db, id, {
        challenge_id: challenge.id,
        book_id: bookId,
        value_added: minutes,
        note: 'Auto-logged: reading session',
      });
    }
  }
}
