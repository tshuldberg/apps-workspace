import { describe, it, expect } from 'vitest';
import {
  selectCardsForContext,
  formatCardContext,
  estimateTokens,
  buildSystemPrompt,
  buildOpeningMessage,
  extractPerformanceRating,
} from '../conversation/engine';
import type { CardContext } from '../conversation/types';

const cards: (CardContext & { dueAt?: string | null; lapseCount?: number; lastReviewAt?: string | null })[] = [
  { cardId: 'c1', front: 'What is DNA?', back: 'Deoxyribonucleic acid', dueAt: '2026-01-01', lapseCount: 0, lastReviewAt: '2025-12-31' },
  { cardId: 'c2', front: 'What is RNA?', back: 'Ribonucleic acid', dueAt: null, lapseCount: 10, lastReviewAt: '2025-12-30' },
  { cardId: 'c3', front: 'What is ATP?', back: 'Adenosine triphosphate', dueAt: null, lapseCount: 0, lastReviewAt: null },
];

describe('conversation engine', () => {
  describe('selectCardsForContext', () => {
    it('returns up to maxCards', () => {
      const selected = selectCardsForContext(cards, 2);
      expect(selected).toHaveLength(2);
    });
    it('prioritizes due cards', () => {
      const selected = selectCardsForContext(cards, 1);
      expect(selected[0].cardId).toBe('c1'); // has dueAt
    });
    it('returns empty for empty input', () => {
      expect(selectCardsForContext([], 10)).toEqual([]);
    });
    it('strips extra fields from output', () => {
      const selected = selectCardsForContext(cards, 1);
      expect(selected[0]).toEqual({ cardId: 'c1', front: 'What is DNA?', back: 'Deoxyribonucleic acid' });
    });
  });

  describe('formatCardContext', () => {
    it('formats cards as numbered Q/A pairs', () => {
      const formatted = formatCardContext([{ cardId: 'c1', front: 'Q1', back: 'A1' }]);
      expect(formatted).toContain('[1] Q: Q1');
      expect(formatted).toContain('A: A1');
    });
    it('returns empty string for empty input', () => {
      expect(formatCardContext([])).toBe('');
    });
  });

  describe('estimateTokens', () => {
    it('approximates token count', () => {
      const estimate = estimateTokens('Hello world');
      expect(estimate).toBeGreaterThan(0);
      expect(estimate).toBeLessThan(100);
    });
  });

  describe('buildSystemPrompt', () => {
    it('includes card content', () => {
      const prompt = buildSystemPrompt(
        { deckId: 'd1', mode: 'tutor', difficulty: 'medium', language: 'en' },
        [{ cardId: 'c1', front: 'DNA?', back: 'acid' }],
      );
      expect(prompt).toContain('DNA?');
      expect(prompt).toContain('acid');
    });
    it('includes mode-specific instructions', () => {
      const tutor = buildSystemPrompt({ deckId: 'd1', mode: 'tutor' }, []);
      expect(tutor).toContain('tutor');
      const debate = buildSystemPrompt({ deckId: 'd1', mode: 'debate' }, []);
      expect(debate).toContain('contrarian');
    });
    it('limits to 50 cards', () => {
      const manyCards = Array.from({ length: 60 }, (_, i) => ({
        cardId: `c${i}`, front: `Q${i}`, back: `A${i}`,
      }));
      const prompt = buildSystemPrompt({ deckId: 'd1', mode: 'tutor' }, manyCards);
      // Should only contain 60 cards since we pass them pre-selected
      expect(prompt).toContain('60 cards');
    });
  });

  describe('buildOpeningMessage', () => {
    it('returns different messages per mode', () => {
      const tutor = buildOpeningMessage('tutor', 'Biology');
      const quiz = buildOpeningMessage('quiz', 'Biology');
      expect(tutor).not.toBe(quiz);
      expect(tutor).toContain('Biology');
      expect(quiz).toContain('Biology');
    });
  });

  describe('extractPerformanceRating', () => {
    it('extracts rating from "Performance: 4/5"', () => {
      expect(extractPerformanceRating('Great job! Performance: 4/5')).toBe(4);
    });
    it('extracts rating from "3.5/5 rating"', () => {
      expect(extractPerformanceRating('Your 3.5/5 rating reflects good effort.')).toBe(3.5);
    });
    it('returns null when no rating found', () => {
      expect(extractPerformanceRating('Great conversation!')).toBeNull();
    });
    it('rejects out of range rating', () => {
      expect(extractPerformanceRating('Performance: 8/5')).toBeNull();
    });
  });
});
