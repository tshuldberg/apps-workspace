import { describe, it, expect } from 'vitest';
import {
  getEligibleCards,
  generateDistractors,
  generateMCQuestions,
  calculateMCScore,
  truncateText,
} from '../mc/distractor-engine';
import type { CardData } from '../mc/distractor-engine';

function makeCards(count: number): CardData[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `c${i}`,
    front: `Front ${i}`,
    back: `Back ${i}`,
    cardType: 'basic',
    queue: 'new',
    templateOrdinal: 0,
  }));
}

describe('Multiple Choice - Distractor Engine', () => {
  it('generates 3 distractors from a 10-card deck', () => {
    const cards = makeCards(10);
    const distractors = generateDistractors(cards[0], cards, 3);
    expect(distractors).toHaveLength(3);
    expect(distractors.every((d) => d.id !== cards[0].id)).toBe(true);
  });

  it('excludes cards with duplicate back text', () => {
    const cards = makeCards(5);
    cards[1].back = cards[0].back; // duplicate
    const distractors = generateDistractors(cards[0], cards, 3);
    expect(distractors.every((d) => d.id !== cards[1].id)).toBe(true);
  });

  it('shuffles options so correct is not always first', () => {
    const cards = makeCards(10);
    const positions = new Set<number>();
    for (let i = 0; i < 50; i++) {
      const questions = generateMCQuestions(cards, 1);
      const correctIdx = questions[0].options.findIndex((o) => o.isCorrect);
      positions.add(correctIdx);
    }
    // Should appear in at least 2 different positions over 50 runs
    expect(positions.size).toBeGreaterThanOrEqual(2);
  });

  it('excludes suspended cards', () => {
    const cards = makeCards(6);
    cards[0].queue = 'suspended';
    const eligible = getEligibleCards(cards);
    expect(eligible).toHaveLength(5);
    expect(eligible.every((c) => c.queue !== 'suspended')).toBe(true);
  });

  it('excludes buried cards', () => {
    const cards = makeCards(6);
    cards[0].queue = 'buried';
    const eligible = getEligibleCards(cards);
    expect(eligible).toHaveLength(5);
  });

  it('throws for fewer than 4 cards', () => {
    const cards = makeCards(3);
    expect(() => generateMCQuestions(cards, 5)).toThrow('Need at least 4 cards');
  });

  it('calculates score correctly', () => {
    expect(calculateMCScore(7, 10)).toBe(70);
    expect(calculateMCScore(10, 10)).toBe(100);
    expect(calculateMCScore(0, 10)).toBe(0);
  });

  it('truncates long answer text', () => {
    const longText = 'a'.repeat(150);
    expect(truncateText(longText)).toHaveLength(123); // 120 + "..."
    expect(truncateText(longText).endsWith('...')).toBe(true);
  });

  it('does not truncate short text', () => {
    expect(truncateText('short')).toBe('short');
  });

  it('skips reversed card duplicates (templateOrdinal > 0)', () => {
    const cards = makeCards(6);
    cards[2].templateOrdinal = 1; // reversed duplicate
    const eligible = getEligibleCards(cards);
    expect(eligible).toHaveLength(5);
  });

  it('generates correct number of questions', () => {
    const cards = makeCards(10);
    const questions = generateMCQuestions(cards, 5);
    expect(questions).toHaveLength(5);
    for (const q of questions) {
      expect(q.options).toHaveLength(4);
      expect(q.options.filter((o) => o.isCorrect)).toHaveLength(1);
    }
  });
});
