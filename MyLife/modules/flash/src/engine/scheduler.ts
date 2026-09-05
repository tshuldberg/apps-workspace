import type { CardRating, FlashDashboard, Flashcard } from '../types';

function previousDay(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function calculateStudyStreak(
  distinctDatesDesc: string[],
  referenceDate: string,
): Pick<FlashDashboard, 'currentStreak' | 'longestStreak'> {
  if (distinctDatesDesc.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  let longestStreak = 0;
  let running = 0;
  let previous: string | null = null;

  for (const date of [...distinctDatesDesc].sort()) {
    if (!previous || previousDay(date) === previous) {
      running += 1;
    } else {
      longestStreak = Math.max(longestStreak, running);
      running = 1;
    }
    previous = date;
  }
  longestStreak = Math.max(longestStreak, running);

  if (distinctDatesDesc[0] !== referenceDate) {
    return { currentStreak: 0, longestStreak };
  }

  let currentStreak = 1;
  let expected = previousDay(distinctDatesDesc[0]);
  for (let index = 1; index < distinctDatesDesc.length; index += 1) {
    const date = distinctDatesDesc[index];
    if (date !== expected) {
      break;
    }
    currentStreak += 1;
    expected = previousDay(expected);
  }

  return { currentStreak, longestStreak };
}

function addMinutes(iso: string, minutes: number): string {
  const date = new Date(iso);
  date.setUTCMinutes(date.getUTCMinutes() + minutes);
  return date.toISOString();
}

function addDays(iso: string, days: number): string {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

export function scheduleFlashcard(
  card: Flashcard,
  rating: CardRating,
  reviewedAt: string,
): Pick<
  Flashcard,
  'queue' | 'intervalDays' | 'ease' | 'dueAt' | 'lastReviewAt' | 'reviewCount' | 'lapseCount'
> {
  const baseEase = Math.max(1.3, card.ease || 2.5);
  const nextReviewCount = card.reviewCount + 1;

  if (rating === 'again') {
    return {
      queue: 'learning',
      intervalDays: 0,
      ease: Math.max(1.3, baseEase - 0.2),
      dueAt: addMinutes(reviewedAt, 10),
      lastReviewAt: reviewedAt,
      reviewCount: nextReviewCount,
      lapseCount: card.lapseCount + 1,
    };
  }

  if (rating === 'hard') {
    const intervalDays = Math.max(1, Math.round(card.intervalDays > 0 ? card.intervalDays * 1.2 : 1));
    return {
      queue: 'review',
      intervalDays,
      ease: Math.max(1.3, baseEase - 0.15),
      dueAt: addDays(reviewedAt, intervalDays),
      lastReviewAt: reviewedAt,
      reviewCount: nextReviewCount,
      lapseCount: card.lapseCount,
    };
  }

  if (rating === 'easy') {
    const intervalDays = Math.max(4, Math.round(card.intervalDays > 0 ? card.intervalDays * (baseEase + 0.5) : 4));
    return {
      queue: 'review',
      intervalDays,
      ease: Math.min(3.2, baseEase + 0.15),
      dueAt: addDays(reviewedAt, intervalDays),
      lastReviewAt: reviewedAt,
      reviewCount: nextReviewCount,
      lapseCount: card.lapseCount,
    };
  }

  const intervalDays = Math.max(2, Math.round(card.intervalDays > 0 ? card.intervalDays * baseEase : 2));
  return {
    queue: 'review',
    intervalDays,
    ease: Math.min(3.0, baseEase + 0.05),
    dueAt: addDays(reviewedAt, intervalDays),
    lastReviewAt: reviewedAt,
    reviewCount: nextReviewCount,
    lapseCount: card.lapseCount,
  };
}
