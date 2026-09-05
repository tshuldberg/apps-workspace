import { describe, it, expect } from 'vitest';
import {
  generateMCQuestion,
  generateTFQuestion,
  generateShortAnswerQuestion,
  generateFillBlankQuestion,
  generateTestQuestions,
} from '../practice/generator';
import {
  levenshteinDistance,
  normalizeAnswer,
  scoreShortAnswer,
  calculateTestScore,
} from '../practice/scorer';
import type { PracticeAnswer } from '../practice/types';

const makeCard = (id: string, front: string, back: string) => ({
  id, front, back, tags: [],
});

const deck = [
  makeCard('c1', 'What is mitosis?', 'Cell division producing two identical daughter cells'),
  makeCard('c2', 'What is meiosis?', 'Cell division producing four gametes'),
  makeCard('c3', 'What is DNA?', 'Deoxyribonucleic acid'),
  makeCard('c4', 'What is RNA?', 'Ribonucleic acid'),
  makeCard('c5', 'What is ATP?', 'Adenosine triphosphate'),
];

describe('practice generator', () => {
  describe('generateMCQuestion', () => {
    it('returns question with 4 options including correct answer', () => {
      const q = generateMCQuestion(deck[0], deck, 0);
      expect(q).not.toBeNull();
      expect(q!.options).toHaveLength(4);
      expect(q!.options).toContain(deck[0].back);
      expect(q!.questionType).toBe('mc');
    });
    it('returns null if fewer than 4 cards', () => {
      const small = deck.slice(0, 3);
      const q = generateMCQuestion(small[0], small, 0);
      expect(q).toBeNull();
    });
  });

  describe('generateTFQuestion', () => {
    it('returns TF question with True or False answer', () => {
      const q = generateTFQuestion(deck[0], deck, 0);
      expect(q.questionType).toBe('tf');
      expect(q.options).toEqual(['True', 'False']);
      expect(['True', 'False']).toContain(q.correctAnswer);
    });
  });

  describe('generateShortAnswerQuestion', () => {
    it('uses card front as question', () => {
      const q = generateShortAnswerQuestion(deck[0], 0);
      expect(q.questionText).toBe(deck[0].front);
      expect(q.correctAnswer).toBe(deck[0].back);
      expect(q.options).toEqual([]);
    });
  });

  describe('generateFillBlankQuestion', () => {
    it('creates a fill blank from card content', () => {
      const q = generateFillBlankQuestion(deck[2], 0);
      expect(q.questionType).toBe('fill_blank');
      expect(q.questionText).toContain('______');
      expect(q.correctAnswer.length).toBeGreaterThan(0);
    });
  });

  describe('generateTestQuestions', () => {
    it('generates requested number of questions', () => {
      const qs = generateTestQuestions(
        { deckId: 'd1', questionCount: 3, timeLimitSeconds: null, questionTypes: ['mc', 'tf'] },
        deck,
      );
      expect(qs.length).toBeLessThanOrEqual(3);
      expect(qs.length).toBeGreaterThan(0);
    });
    it('handles empty deck', () => {
      const qs = generateTestQuestions(
        { deckId: 'd1', questionCount: 10, timeLimitSeconds: null, questionTypes: ['mc'] },
        [],
      );
      expect(qs).toEqual([]);
    });
    it('caps at deck size', () => {
      const qs = generateTestQuestions(
        { deckId: 'd1', questionCount: 100, timeLimitSeconds: null, questionTypes: ['short_answer'] },
        deck,
      );
      expect(qs.length).toBeLessThanOrEqual(deck.length);
    });
  });
});

describe('practice scorer', () => {
  describe('levenshteinDistance', () => {
    it('returns 0 for identical strings', () => {
      expect(levenshteinDistance('hello', 'hello')).toBe(0);
    });
    it('returns correct distance for single edit', () => {
      expect(levenshteinDistance('cat', 'bat')).toBe(1);
    });
    it('handles empty strings', () => {
      expect(levenshteinDistance('', 'abc')).toBe(3);
      expect(levenshteinDistance('abc', '')).toBe(3);
    });
  });

  describe('normalizeAnswer', () => {
    it('lowercases and strips punctuation', () => {
      expect(normalizeAnswer('Hello, World!')).toBe('hello world');
    });
    it('trims whitespace', () => {
      expect(normalizeAnswer('  test  ')).toBe('test');
    });
  });

  describe('scoreShortAnswer', () => {
    it('accepts exact match (case insensitive)', () => {
      expect(scoreShortAnswer('United States', 'united states')).toBe(true);
    });
    it('accepts minor typo', () => {
      expect(scoreShortAnswer('Untied States', 'United States')).toBe(true);
    });
    it('rejects very different answer', () => {
      expect(scoreShortAnswer('US', 'United States')).toBe(false);
    });
    it('rejects empty answer', () => {
      expect(scoreShortAnswer('', 'United States')).toBe(false);
    });
  });

  describe('calculateTestScore', () => {
    it('calculates correct score', () => {
      const answers: PracticeAnswer[] = [
        { id: '1', testId: 't', questionIndex: 0, sourceCardId: 'c1', questionType: 'mc', questionText: 'q', options: [], correctAnswer: 'a', userAnswer: 'a', isCorrect: true, timeSpentSeconds: 5, explanation: '', answeredAt: '2026-01-01' },
        { id: '2', testId: 't', questionIndex: 1, sourceCardId: 'c2', questionType: 'mc', questionText: 'q', options: [], correctAnswer: 'b', userAnswer: 'c', isCorrect: false, timeSpentSeconds: 5, explanation: '', answeredAt: '2026-01-01' },
        { id: '3', testId: 't', questionIndex: 2, sourceCardId: 'c3', questionType: 'tf', questionText: 'q', options: [], correctAnswer: 'True', userAnswer: 'True', isCorrect: true, timeSpentSeconds: 5, explanation: '', answeredAt: '2026-01-01' },
      ];
      const result = calculateTestScore(answers);
      expect(result.totalScore).toBe(2);
      expect(result.maxScore).toBe(3);
      expect(result.scorePercent).toBe(67);
      expect(result.perType.mc.correct).toBe(1);
      expect(result.perType.mc.total).toBe(2);
      expect(result.perType.tf.correct).toBe(1);
      expect(result.perType.tf.total).toBe(1);
    });

    it('finds weak tags', () => {
      const answers: PracticeAnswer[] = [
        { id: '1', testId: 't', questionIndex: 0, sourceCardId: 'c1', questionType: 'mc', questionText: 'q', options: [], correctAnswer: 'a', userAnswer: 'a', isCorrect: false, timeSpentSeconds: 5, explanation: '', answeredAt: '2026-01-01' },
        { id: '2', testId: 't', questionIndex: 1, sourceCardId: 'c2', questionType: 'mc', questionText: 'q', options: [], correctAnswer: 'b', userAnswer: 'b', isCorrect: false, timeSpentSeconds: 5, explanation: '', answeredAt: '2026-01-01' },
      ];
      const tags = new Map([['c1', ['bio']], ['c2', ['bio']]]);
      const result = calculateTestScore(answers, tags);
      expect(result.weakTags).toContain('bio');
    });
  });
});
