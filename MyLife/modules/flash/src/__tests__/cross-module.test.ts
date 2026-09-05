import { describe, it, expect } from 'vitest';
import {
  getStudySignal,
  validateCardSuggestion,
  buildVocabularyCards,
  buildStudyDeckFromNotes,
} from '../engine/cross-module';
import type { CardSuggestion, VocabularyPair, NoteExcerpt } from '../engine/cross-module';
import type { FlashDashboard } from '../types';

const baseDashboard: FlashDashboard = {
  deckCount: 3,
  cardCount: 100,
  newCount: 10,
  dueCount: 25,
  reviewedToday: 15,
  currentStreak: 5,
  longestStreak: 10,
};

describe('getStudySignal', () => {
  it('computes retention rate from logs', () => {
    const logs = [
      { rating: 'good' as const },
      { rating: 'easy' as const },
      { rating: 'again' as const },
    ];
    const signal = getStudySignal(baseDashboard, logs);
    expect(signal.retentionRate).toBeCloseTo(0.667, 2);
  });

  it('returns zero retention for empty logs', () => {
    const signal = getStudySignal(baseDashboard, []);
    expect(signal.retentionRate).toBe(0);
  });

  it('copies dashboard fields through', () => {
    const signal = getStudySignal(baseDashboard, []);
    expect(signal.activeDeckCount).toBe(3);
    expect(signal.currentStreak).toBe(5);
    expect(signal.totalCards).toBe(100);
    expect(signal.dueToday).toBe(25);
    expect(signal.reviewedToday).toBe(15);
  });

  it('computes study readiness score (0-100)', () => {
    const logs = Array.from({ length: 20 }, () => ({ rating: 'good' as const }));
    const signal = getStudySignal(
      { ...baseDashboard, currentStreak: 7, reviewedToday: 20 },
      logs,
    );
    expect(signal.studyReadiness).toBeLessThanOrEqual(100);
    expect(signal.studyReadiness).toBeGreaterThan(50);
  });
});

describe('validateCardSuggestion', () => {
  const validSuggestion: CardSuggestion = {
    sourceModule: 'books',
    sourceEntityId: 'book-123',
    front: 'What is TypeScript?',
    back: 'A typed superset of JavaScript',
    deckId: null,
    tags: ['programming'],
    cardType: 'basic',
  };

  it('accepts valid suggestion', () => {
    const result = validateCardSuggestion(validSuggestion);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.sanitized).not.toBeNull();
  });

  it('adds source tag automatically', () => {
    const result = validateCardSuggestion(validSuggestion);
    expect(result.sanitized!.tags).toContain('source:books');
  });

  it('rejects empty source module', () => {
    const result = validateCardSuggestion({ ...validSuggestion, sourceModule: '' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('sourceModule is required');
  });

  it('rejects empty front text', () => {
    const result = validateCardSuggestion({ ...validSuggestion, front: '' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('front text is required');
  });

  it('rejects front text exceeding max length', () => {
    const result = validateCardSuggestion({ ...validSuggestion, front: 'x'.repeat(2001) });
    expect(result.valid).toBe(false);
  });

  it('rejects cloze type without markers', () => {
    const result = validateCardSuggestion({
      ...validSuggestion,
      cardType: 'cloze',
      front: 'No cloze markers here',
    });
    expect(result.valid).toBe(false);
  });

  it('accepts cloze type with markers', () => {
    const result = validateCardSuggestion({
      ...validSuggestion,
      cardType: 'cloze',
      front: 'TypeScript is a {{c1::typed}} superset of JavaScript',
    });
    expect(result.valid).toBe(true);
  });
});

describe('buildVocabularyCards', () => {
  it('creates basic and reversed cards for each pair', () => {
    const pairs: VocabularyPair[] = [
      { word: 'ephemeral', definition: 'lasting a short time', sourceModule: 'books', sourceEntityId: 'b1' },
    ];
    const cards = buildVocabularyCards(pairs, 'deck-1');
    expect(cards).toHaveLength(2);
    expect(cards[0].cardType).toBe('basic');
    expect(cards[0].front).toBe('ephemeral');
    expect(cards[0].back).toBe('lasting a short time');
    expect(cards[1].cardType).toBe('reversed');
    expect(cards[1].front).toBe('lasting a short time');
    expect(cards[1].back).toBe('ephemeral');
  });

  it('includes context in front text when provided', () => {
    const pairs: VocabularyPair[] = [
      { word: 'ephemeral', definition: 'short-lived', context: 'The beauty was ephemeral', sourceModule: 'books', sourceEntityId: 'b1' },
    ];
    const cards = buildVocabularyCards(pairs, 'deck-1');
    expect(cards[0].front).toContain('ephemeral');
    expect(cards[0].front).toContain('The beauty was ephemeral');
  });

  it('tags cards with source module', () => {
    const pairs: VocabularyPair[] = [
      { word: 'test', definition: 'def', sourceModule: 'words', sourceEntityId: 'w1' },
    ];
    const cards = buildVocabularyCards(pairs, 'deck-1');
    expect(cards[0].tags).toContain('source:words');
    expect(cards[0].tags).toContain('vocabulary');
  });

  it('returns empty array for no pairs', () => {
    expect(buildVocabularyCards([], 'deck-1')).toEqual([]);
  });
});

describe('buildStudyDeckFromNotes', () => {
  it('creates cloze cards for text with markers', () => {
    const excerpts: NoteExcerpt[] = [
      { text: 'TypeScript is {{c1::statically typed}}', title: 'TS Notes', sourceModule: 'notes', sourceEntityId: 'n1' },
    ];
    const cards = buildStudyDeckFromNotes(excerpts, 'deck-1');
    expect(cards).toHaveLength(1);
    expect(cards[0].cardType).toBe('cloze');
    expect(cards[0].front).toContain('{{c1::');
  });

  it('creates basic cards for text without markers', () => {
    const excerpts: NoteExcerpt[] = [
      { text: 'TypeScript adds types to JavaScript', title: 'TS Notes', sourceModule: 'notes', sourceEntityId: 'n1' },
    ];
    const cards = buildStudyDeckFromNotes(excerpts, 'deck-1');
    expect(cards).toHaveLength(1);
    expect(cards[0].cardType).toBe('basic');
    expect(cards[0].front).toBe('TS Notes');
    expect(cards[0].back).toBe('TypeScript adds types to JavaScript');
  });

  it('tags cards with source module', () => {
    const excerpts: NoteExcerpt[] = [
      { text: 'content', sourceModule: 'notes', sourceEntityId: 'n1' },
    ];
    const cards = buildStudyDeckFromNotes(excerpts, 'deck-1');
    expect(cards[0].tags).toContain('source:notes');
  });
});
