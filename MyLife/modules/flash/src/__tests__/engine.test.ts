import { describe, expect, it } from 'vitest';
import { buildClozeFlashcards, parseClozeText, renderClozeBack, renderClozeFront } from '../engine/cloze';
import { parseFlashSearchQuery } from '../engine/search';
import { calculateStudyStreak, scheduleFlashcard } from '../engine/scheduler';
import type { Flashcard } from '../types';

function makeCard(overrides: Partial<Flashcard> = {}): Flashcard {
  return {
    id: 'card-1',
    noteId: 'note-1',
    deckId: 'deck-1',
    cardType: 'basic',
    templateOrdinal: 0,
    front: 'Q',
    back: 'A',
    tags: [],
    queue: 'new',
    queueBeforeSuspend: null,
    queueBeforeBury: null,
    buriedUntil: null,
    intervalDays: 0,
    ease: 2.5,
    dueAt: null,
    lastReviewAt: null,
    reviewCount: 0,
    lapseCount: 0,
    starred: false,
    createdAt: '2026-03-08T00:00:00.000Z',
    updatedAt: '2026-03-08T00:00:00.000Z',
    ...overrides,
  };
}

describe('scheduleFlashcard', () => {
  const reviewedAt = '2026-03-08T10:00:00.000Z';

  describe('rating: again', () => {
    it('moves a new card to learning queue with 10-min re-study', () => {
      const result = scheduleFlashcard(makeCard(), 'again', reviewedAt);
      expect(result.queue).toBe('learning');
      expect(result.intervalDays).toBe(0);
      expect(result.dueAt).toBe('2026-03-08T10:10:00.000Z');
      expect(result.reviewCount).toBe(1);
      expect(result.lapseCount).toBe(1);
    });

    it('decreases ease by 0.2 but clamps at 1.3', () => {
      const result = scheduleFlashcard(makeCard({ ease: 2.5 }), 'again', reviewedAt);
      expect(result.ease).toBe(2.3);
    });

    it('clamps ease floor at 1.3', () => {
      const result = scheduleFlashcard(makeCard({ ease: 1.3 }), 'again', reviewedAt);
      expect(result.ease).toBe(1.3);
    });

    it('increments lapse count from a review card', () => {
      const card = makeCard({ queue: 'review', intervalDays: 10, ease: 2.5, lapseCount: 2, reviewCount: 5 });
      const result = scheduleFlashcard(card, 'again', reviewedAt);
      expect(result.lapseCount).toBe(3);
      expect(result.reviewCount).toBe(6);
      expect(result.queue).toBe('learning');
    });
  });

  describe('rating: hard', () => {
    it('schedules a new card with 1 day interval', () => {
      const result = scheduleFlashcard(makeCard(), 'hard', reviewedAt);
      expect(result.queue).toBe('review');
      expect(result.intervalDays).toBe(1);
      expect(result.dueAt).toBe('2026-03-09T10:00:00.000Z');
      expect(result.reviewCount).toBe(1);
      expect(result.lapseCount).toBe(0);
    });

    it('decreases ease by 0.15 but clamps at 1.3', () => {
      const result = scheduleFlashcard(makeCard({ ease: 2.5 }), 'hard', reviewedAt);
      expect(result.ease).toBe(2.35);
    });

    it('multiplies existing interval by 1.2', () => {
      const card = makeCard({ queue: 'review', intervalDays: 10 });
      const result = scheduleFlashcard(card, 'hard', reviewedAt);
      expect(result.intervalDays).toBe(12);
    });

    it('keeps interval at minimum 1 day', () => {
      const card = makeCard({ queue: 'review', intervalDays: 0.5 });
      const result = scheduleFlashcard(card, 'hard', reviewedAt);
      expect(result.intervalDays).toBeGreaterThanOrEqual(1);
    });

    it('does not increment lapse count', () => {
      const card = makeCard({ lapseCount: 3 });
      const result = scheduleFlashcard(card, 'hard', reviewedAt);
      expect(result.lapseCount).toBe(3);
    });
  });

  describe('rating: good', () => {
    it('schedules a new card with 2 day interval', () => {
      const result = scheduleFlashcard(makeCard(), 'good', reviewedAt);
      expect(result.queue).toBe('review');
      expect(result.intervalDays).toBe(2);
      expect(result.dueAt).toBe('2026-03-10T10:00:00.000Z');
      expect(result.reviewCount).toBe(1);
    });

    it('increases ease by 0.05 and caps at 3.0', () => {
      const result = scheduleFlashcard(makeCard({ ease: 2.5 }), 'good', reviewedAt);
      expect(result.ease).toBe(2.55);
    });

    it('multiplies existing interval by ease factor', () => {
      const card = makeCard({ queue: 'review', intervalDays: 5, ease: 2.5 });
      const result = scheduleFlashcard(card, 'good', reviewedAt);
      // 5 * 2.5 = 12.5, rounded = 13
      expect(result.intervalDays).toBe(13);
    });

    it('caps ease at 3.0', () => {
      const result = scheduleFlashcard(makeCard({ ease: 2.98 }), 'good', reviewedAt);
      expect(result.ease).toBe(3.0);
    });
  });

  describe('rating: easy', () => {
    it('schedules a new card with 4 day interval', () => {
      const result = scheduleFlashcard(makeCard(), 'easy', reviewedAt);
      expect(result.queue).toBe('review');
      expect(result.intervalDays).toBe(4);
      expect(result.dueAt).toBe('2026-03-12T10:00:00.000Z');
      expect(result.reviewCount).toBe(1);
    });

    it('increases ease by 0.15 and caps at 3.2', () => {
      const result = scheduleFlashcard(makeCard({ ease: 2.5 }), 'easy', reviewedAt);
      expect(result.ease).toBe(2.65);
    });

    it('multiplies existing interval by (ease + 0.5)', () => {
      const card = makeCard({ queue: 'review', intervalDays: 5, ease: 2.5 });
      const result = scheduleFlashcard(card, 'easy', reviewedAt);
      // 5 * (2.5 + 0.5) = 15
      expect(result.intervalDays).toBe(15);
    });

    it('caps ease at 3.2', () => {
      const result = scheduleFlashcard(makeCard({ ease: 3.15 }), 'easy', reviewedAt);
      expect(result.ease).toBe(3.2);
    });

    it('guarantees minimum 4-day interval', () => {
      const card = makeCard({ queue: 'review', intervalDays: 1, ease: 1.5 });
      const result = scheduleFlashcard(card, 'easy', reviewedAt);
      expect(result.intervalDays).toBeGreaterThanOrEqual(4);
    });
  });

  describe('cross-rating state transitions', () => {
    it('tracks lastReviewAt for all ratings', () => {
      for (const rating of ['again', 'hard', 'good', 'easy'] as const) {
        const result = scheduleFlashcard(makeCard(), rating, reviewedAt);
        expect(result.lastReviewAt).toBe(reviewedAt);
      }
    });

    it('always increments reviewCount', () => {
      const card = makeCard({ reviewCount: 3 });
      for (const rating of ['again', 'hard', 'good', 'easy'] as const) {
        const result = scheduleFlashcard(card, rating, reviewedAt);
        expect(result.reviewCount).toBe(4);
      }
    });

    it('only again increments lapseCount', () => {
      const card = makeCard({ lapseCount: 2 });
      expect(scheduleFlashcard(card, 'again', reviewedAt).lapseCount).toBe(3);
      expect(scheduleFlashcard(card, 'hard', reviewedAt).lapseCount).toBe(2);
      expect(scheduleFlashcard(card, 'good', reviewedAt).lapseCount).toBe(2);
      expect(scheduleFlashcard(card, 'easy', reviewedAt).lapseCount).toBe(2);
    });

    it('recovers from low ease after repeated again ratings', () => {
      let card = makeCard();
      // Simulate 3 consecutive "again" ratings
      for (let i = 0; i < 3; i++) {
        const result = scheduleFlashcard(card, 'again', reviewedAt);
        card = makeCard({
          ...result,
          id: card.id,
          noteId: card.noteId,
          deckId: card.deckId,
          cardType: card.cardType,
          templateOrdinal: card.templateOrdinal,
          front: card.front,
          back: card.back,
          tags: card.tags,
          createdAt: card.createdAt,
          updatedAt: card.updatedAt,
        });
      }
      // Ease floor holds
      expect(card.ease).toBeGreaterThanOrEqual(1.3);
      // Good rating should still produce a positive interval
      const recovery = scheduleFlashcard(card, 'good', reviewedAt);
      expect(recovery.intervalDays).toBeGreaterThanOrEqual(2);
      expect(recovery.queue).toBe('review');
    });
  });
});

describe('calculateStudyStreak', () => {
  it('returns zero streaks for empty input', () => {
    expect(calculateStudyStreak([], '2026-03-08')).toEqual({
      currentStreak: 0,
      longestStreak: 0,
    });
  });

  it('returns 1-day streak for a single matching date', () => {
    expect(calculateStudyStreak(['2026-03-08'], '2026-03-08')).toEqual({
      currentStreak: 1,
      longestStreak: 1,
    });
  });

  it('returns zero current streak when reference date has no study', () => {
    expect(calculateStudyStreak(['2026-03-07'], '2026-03-08')).toEqual({
      currentStreak: 0,
      longestStreak: 1,
    });
  });

  it('counts consecutive days correctly', () => {
    const dates = ['2026-03-08', '2026-03-07', '2026-03-06', '2026-03-05'];
    expect(calculateStudyStreak(dates, '2026-03-08')).toEqual({
      currentStreak: 4,
      longestStreak: 4,
    });
  });

  it('breaks streak on gap', () => {
    const dates = ['2026-03-08', '2026-03-07', '2026-03-05', '2026-03-04'];
    expect(calculateStudyStreak(dates, '2026-03-08')).toEqual({
      currentStreak: 2,
      longestStreak: 2,
    });
  });

  it('detects longest streak from the past, not current', () => {
    // Past: 5 day streak, current: 1 day
    const dates = [
      '2026-03-08',
      '2026-03-01', '2026-02-28', '2026-02-27', '2026-02-26', '2026-02-25',
    ];
    expect(calculateStudyStreak(dates, '2026-03-08')).toEqual({
      currentStreak: 1,
      longestStreak: 5,
    });
  });

  it('handles unsorted input (longestStreak computed correctly)', () => {
    // The function sorts for longestStreak but expects DESC order for currentStreak
    const dates = ['2026-03-06', '2026-03-08', '2026-03-07'];
    expect(calculateStudyStreak(dates, '2026-03-08')).toEqual({
      currentStreak: 0,  // [0] is '2026-03-06', not in reference set
      longestStreak: 3,
    });
  });

  it('handles month boundary correctly', () => {
    const dates = ['2026-03-01', '2026-02-28'];
    expect(calculateStudyStreak(dates, '2026-03-01')).toEqual({
      currentStreak: 2,
      longestStreak: 2,
    });
  });

  it('handles year boundary correctly', () => {
    const dates = ['2026-01-01', '2025-12-31'];
    expect(calculateStudyStreak(dates, '2026-01-01')).toEqual({
      currentStreak: 2,
      longestStreak: 2,
    });
  });
});

describe('cloze helpers', () => {
  it('parses cloze markers with hints and unique numbers', () => {
    const parsed = parseClozeText('{{c1::Paris::city}} is in {{c2::France}}');
    expect(parsed.markers).toHaveLength(2);
    expect(parsed.uniqueNumbers).toEqual([1, 2]);
    expect(parsed.markers[0]).toMatchObject({
      number: 1,
      answer: 'Paris',
      hint: 'city',
    });
  });

  it('renders cloze fronts and backs for the active card', () => {
    const source = '{{c1::mitochondria::organelle}} makes ATP';
    expect(renderClozeFront(source, 1)).toBe('[organelle] makes ATP');
    expect(renderClozeBack(source, 1)).toBe('[[mitochondria]] makes ATP');
  });

  it('builds cards with sparse ordinals from cloze markers', () => {
    const cards = buildClozeFlashcards('{{c1::Paris}} and {{c3::France}}');
    expect(cards).toHaveLength(2);
    expect(cards[0]).toMatchObject({ templateOrdinal: 0, front: '[...] and France' });
    expect(cards[1]).toMatchObject({ templateOrdinal: 2, front: 'Paris and [...]' });
  });
});

describe('flash search parsing', () => {
  it('parses combined structured filters', () => {
    const parsed = parseFlashSearchQuery('deck:Biology tag:Exam is:due prop:lapses>5');
    expect(parsed.tokens).toEqual([
      { kind: 'deck', value: 'biology', negated: false },
      { kind: 'tag', value: 'exam', negated: false },
      { kind: 'state', value: 'due', negated: false },
      { kind: 'property', field: 'lapses', operator: '>', value: 5, negated: false },
    ]);
  });

  it('treats free text and invalid filters as text search terms', () => {
    const parsed = parseFlashSearchQuery('mitochondria deck: -tag:ignore');
    expect(parsed.tokens).toEqual([
      { kind: 'text', value: 'mitochondria', negated: false },
      { kind: 'text', value: 'deck:', negated: false },
      { kind: 'tag', value: 'ignore', negated: true },
    ]);
  });
});
