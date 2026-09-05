import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { FLASH_MODULE } from '../definition';
import {
  browseFlashcards,
  buryFlashNote,
  buryFlashcard,
  DEFAULT_FLASH_DECK_ID,
  createDeck,
  createFlashcards,
  exportFlashData,
  getDeckById,
  getFlashcardById,
  getFlashDashboard,
  getFlashSetting,
  listCardsForDeck,
  listDecks,
  listDueFlashcards,
  listFlashExportRecords,
  listFlashTags,
  listReviewLogsForCard,
  rateFlashcard,
  setFlashSetting,
  suspendFlashcard,
  unburyFlashcards,
  unsuspendFlashcard,
  updateDeck,
} from '..';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('flash', FLASH_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

describe('Flash decks', () => {
  it('seeds the default deck', () => {
    const decks = listDecks(testDb.adapter);
    expect(decks).toHaveLength(1);
    expect(decks[0]?.id).toBe(DEFAULT_FLASH_DECK_ID);
    expect(decks[0]?.isDefault).toBe(true);
  });

  it('creates a custom deck with description', () => {
    const deck = createDeck(testDb.adapter, 'deck-1', {
      name: 'Spanish',
      description: 'Language flashcards',
    });
    expect(deck.id).toBe('deck-1');
    expect(deck.name).toBe('Spanish');
    expect(deck.description).toBe('Language flashcards');
    expect(deck.isDefault).toBe(false);
    expect(deck.cardCount).toBe(0);
  });

  it('getDeckById returns the correct deck', () => {
    createDeck(testDb.adapter, 'deck-1', { name: 'Physics' });
    const found = getDeckById(testDb.adapter, 'deck-1');
    expect(found?.name).toBe('Physics');
  });

  it('getDeckById returns null for non-existent deck', () => {
    const found = getDeckById(testDb.adapter, 'non-existent');
    expect(found).toBeNull();
  });

  it('updateDeck modifies name and description', () => {
    createDeck(testDb.adapter, 'deck-1', { name: 'Original' });
    const updated = updateDeck(testDb.adapter, 'deck-1', {
      name: 'Renamed',
      description: 'New description',
    });
    expect(updated?.name).toBe('Renamed');
    expect(updated?.description).toBe('New description');
  });

  it('updateDeck returns null for non-existent deck', () => {
    const result = updateDeck(testDb.adapter, 'non-existent', { name: 'Test' });
    expect(result).toBeNull();
  });

  it('updateDeck preserves fields not included in the update', () => {
    createDeck(testDb.adapter, 'deck-1', {
      name: 'Original',
      description: 'Keep me',
    });
    const updated = updateDeck(testDb.adapter, 'deck-1', { name: 'Renamed' });
    expect(updated?.name).toBe('Renamed');
    expect(updated?.description).toBe('Keep me');
  });

  it('lists all decks sorted with default first', () => {
    createDeck(testDb.adapter, 'deck-a', { name: 'Alpha' });
    createDeck(testDb.adapter, 'deck-z', { name: 'Zulu' });
    const decks = listDecks(testDb.adapter);
    expect(decks).toHaveLength(3);
    expect(decks[0]?.id).toBe(DEFAULT_FLASH_DECK_ID);
    expect(decks[1]?.name).toBe('Alpha');
    expect(decks[2]?.name).toBe('Zulu');
  });
});

describe('Flash cards', () => {
  it('creates basic cards with default settings', () => {
    const [card] = createFlashcards(testDb.adapter, {
      deckId: DEFAULT_FLASH_DECK_ID,
      front: 'What is 2+2?',
      back: '4',
    });
    expect(card?.cardType).toBe('basic');
    expect(card?.queue).toBe('new');
    expect(card?.intervalDays).toBe(0);
    expect(card?.ease).toBe(2.5);
    expect(card?.reviewCount).toBe(0);
    expect(card?.lapseCount).toBe(0);
    expect(card?.dueAt).toBeNull();
  });

  it('creates a deck and reversed cards', () => {
    const deck = createDeck(testDb.adapter, 'deck-1', { name: 'Spanish' });
    const cards = createFlashcards(testDb.adapter, {
      deckId: deck.id,
      front: 'dog',
      back: 'perro',
      cardType: 'reversed',
      tags: ['Language', 'Vocab'],
    });

    expect(cards).toHaveLength(2);
    expect(listCardsForDeck(testDb.adapter, deck.id)).toHaveLength(2);
    expect(cards[0]?.tags).toEqual(['language', 'vocab']);
    expect(cards[1]?.front).toBe('perro');
    expect(cards[1]?.back).toBe('dog');
  });

  it('does not create reversed card when back is empty', () => {
    const cards = createFlashcards(testDb.adapter, {
      deckId: DEFAULT_FLASH_DECK_ID,
      front: 'Front only',
      back: '',
      cardType: 'reversed',
    });
    expect(cards).toHaveLength(1);
  });

  it('creates cloze cards from one note', () => {
    const cards = createFlashcards(testDb.adapter, {
      deckId: DEFAULT_FLASH_DECK_ID,
      front: '{{c1::Paris}} is in {{c2::France}}',
      back: 'Remember the capital-country pair',
      cardType: 'cloze',
    });

    expect(cards).toHaveLength(2);
    expect(cards[0]?.templateOrdinal).toBe(0);
    expect(cards[0]?.front).toBe('[...] is in France');
    expect(cards[0]?.back).toContain('[[Paris]] is in France');
    expect(cards[1]?.templateOrdinal).toBe(1);
    expect(cards[1]?.front).toBe('Paris is in [...]');
  });

  it('normalizes and deduplicates tags', () => {
    const [card] = createFlashcards(testDb.adapter, {
      deckId: DEFAULT_FLASH_DECK_ID,
      front: 'Q',
      back: 'A',
      tags: ['  Science  ', 'science', 'SCIENCE', 'Math'],
    });
    expect(card?.tags).toEqual(['science', 'math']);
  });

  it('getFlashcardById returns the correct card', () => {
    const [card] = createFlashcards(testDb.adapter, {
      deckId: DEFAULT_FLASH_DECK_ID,
      front: 'Q',
      back: 'A',
    });
    const found = getFlashcardById(testDb.adapter, card!.id);
    expect(found?.front).toBe('Q');
    expect(found?.back).toBe('A');
  });

  it('getFlashcardById returns null for non-existent card', () => {
    const found = getFlashcardById(testDb.adapter, 'non-existent');
    expect(found).toBeNull();
  });

  it('listCardsForDeck returns empty array for empty deck', () => {
    createDeck(testDb.adapter, 'empty-deck', { name: 'Empty' });
    const cards = listCardsForDeck(testDb.adapter, 'empty-deck');
    expect(cards).toEqual([]);
  });

  it('deck card counts update as cards are added', () => {
    const deck = createDeck(testDb.adapter, 'deck-1', { name: 'Counting' });
    expect(getDeckById(testDb.adapter, deck.id)?.cardCount).toBe(0);
    createFlashcards(testDb.adapter, { deckId: deck.id, front: 'Q1', back: 'A1' });
    createFlashcards(testDb.adapter, { deckId: deck.id, front: 'Q2', back: 'A2' });
    const updated = getDeckById(testDb.adapter, deck.id);
    expect(updated?.cardCount).toBe(2);
    expect(updated?.newCount).toBe(2);
  });
});

describe('Flash scheduling and logs', () => {
  it('lists new cards as due and records a review', () => {
    const deck = createDeck(testDb.adapter, 'deck-1', { name: 'Biology' });
    const [card] = createFlashcards(testDb.adapter, {
      deckId: deck.id,
      front: 'Cell powerhouse',
      back: 'Mitochondria',
    });

    expect(listDueFlashcards(testDb.adapter, deck.id)).toHaveLength(1);

    const updated = rateFlashcard(testDb.adapter, card!.id, 'good', '2026-03-08T10:00:00.000Z');
    expect(updated?.queue).toBe('review');
    expect(updated?.dueAt?.slice(0, 10)).toBe('2026-03-10');
    expect(updated?.reviewCount).toBe(1);
    expect(listReviewLogsForCard(testDb.adapter, card!.id)).toHaveLength(1);
  });

  it('rateFlashcard returns null for non-existent card', () => {
    const result = rateFlashcard(testDb.adapter, 'non-existent', 'good');
    expect(result).toBeNull();
  });

  it('records multiple reviews with review log history', () => {
    const [card] = createFlashcards(testDb.adapter, {
      deckId: DEFAULT_FLASH_DECK_ID,
      front: 'Q',
      back: 'A',
    });
    rateFlashcard(testDb.adapter, card!.id, 'good', '2026-03-08T10:00:00.000Z');
    rateFlashcard(testDb.adapter, card!.id, 'hard', '2026-03-10T10:00:00.000Z');
    rateFlashcard(testDb.adapter, card!.id, 'easy', '2026-03-12T10:00:00.000Z');

    const logs = listReviewLogsForCard(testDb.adapter, card!.id);
    expect(logs).toHaveLength(3);
    // Most recent first
    expect(logs[0]?.rating).toBe('easy');
    expect(logs[2]?.rating).toBe('good');
  });

  it('again rating puts card back in learning queue', () => {
    const [card] = createFlashcards(testDb.adapter, {
      deckId: DEFAULT_FLASH_DECK_ID,
      front: 'Q',
      back: 'A',
    });
    const updated = rateFlashcard(testDb.adapter, card!.id, 'again', '2026-03-08T10:00:00.000Z');
    expect(updated?.queue).toBe('learning');
    expect(updated?.lapseCount).toBe(1);
  });

  it('listDueFlashcards excludes suspended and buried cards', () => {
    const [card] = createFlashcards(testDb.adapter, {
      deckId: DEFAULT_FLASH_DECK_ID,
      front: 'Q',
      back: 'A',
    });
    // Manually set queue to suspended
    testDb.adapter.execute(
      `UPDATE fl_cards SET queue = 'suspended' WHERE id = ?`,
      [card!.id],
    );
    const due = listDueFlashcards(testDb.adapter, DEFAULT_FLASH_DECK_ID);
    expect(due).toHaveLength(0);
  });

  it('auto-buries sibling cards after a review when enabled', () => {
    const [first, second] = createFlashcards(testDb.adapter, {
      deckId: DEFAULT_FLASH_DECK_ID,
      front: 'dog',
      back: 'perro',
      cardType: 'reversed',
    });

    rateFlashcard(testDb.adapter, first!.id, 'good', '2026-03-08T10:00:00.000Z');

    const updatedSibling = getFlashcardById(testDb.adapter, second!.id);
    expect(updatedSibling?.queue).toBe('buried');
    expect(updatedSibling?.queueBeforeBury).toBe('new');
  });

  it('suspends and unsuspends a card while preserving the previous queue', () => {
    const [card] = createFlashcards(testDb.adapter, {
      deckId: DEFAULT_FLASH_DECK_ID,
      front: 'Q',
      back: 'A',
    });

    rateFlashcard(testDb.adapter, card!.id, 'good', '2026-03-08T10:00:00.000Z');
    const suspended = suspendFlashcard(testDb.adapter, card!.id);
    expect(suspended?.queue).toBe('suspended');
    expect(suspended?.queueBeforeSuspend).toBe('review');

    const unsuspended = unsuspendFlashcard(testDb.adapter, card!.id);
    expect(unsuspended?.queue).toBe('review');
    expect(unsuspended?.queueBeforeSuspend).toBeNull();
  });

  it('buries a note and later unburies it', () => {
    const [first] = createFlashcards(testDb.adapter, {
      deckId: DEFAULT_FLASH_DECK_ID,
      front: 'dog',
      back: 'perro',
      cardType: 'reversed',
    });

    const buriedCards = buryFlashNote(testDb.adapter, first!.id, '2026-03-08T10:00:00.000Z');
    expect(buriedCards).toHaveLength(2);
    expect(buriedCards.every((card) => card.queue === 'buried')).toBe(true);

    expect(unburyFlashcards(testDb.adapter, '2026-03-09T00:00:00.000Z')).toBe(2);
    const restored = listCardsForDeck(testDb.adapter, DEFAULT_FLASH_DECK_ID);
    expect(restored.every((card) => card.queue === 'new')).toBe(true);
  });

  it('listDueFlashcards respects the limit parameter', () => {
    for (let i = 0; i < 5; i++) {
      createFlashcards(testDb.adapter, {
        deckId: DEFAULT_FLASH_DECK_ID,
        front: `Q${i}`,
        back: `A${i}`,
      });
    }
    const due = listDueFlashcards(testDb.adapter, DEFAULT_FLASH_DECK_ID, new Date().toISOString(), 2);
    expect(due).toHaveLength(2);
  });

  it('listDueFlashcards across all decks when no deckId given', () => {
    createFlashcards(testDb.adapter, {
      deckId: DEFAULT_FLASH_DECK_ID,
      front: 'Q1',
      back: 'A1',
    });
    const deck2 = createDeck(testDb.adapter, 'deck-2', { name: 'Deck 2' });
    createFlashcards(testDb.adapter, {
      deckId: deck2.id,
      front: 'Q2',
      back: 'A2',
    });
    const due = listDueFlashcards(testDb.adapter);
    expect(due.length).toBeGreaterThanOrEqual(2);
  });
});

describe('Flash settings', () => {
  it('reads seeded default settings', () => {
    expect(getFlashSetting(testDb.adapter, 'dailyNewLimit')).toBe('20');
    expect(getFlashSetting(testDb.adapter, 'dailyReviewLimit')).toBe('200');
    expect(getFlashSetting(testDb.adapter, 'dailyStudyTarget')).toBe('1');
    expect(getFlashSetting(testDb.adapter, 'autoBurySiblings')).toBe('1');
    expect(getFlashSetting(testDb.adapter, 'dailyReminderTime')).toBe('09:00');
  });

  it('returns null for non-existent setting', () => {
    expect(getFlashSetting(testDb.adapter, 'nonExistent')).toBeNull();
  });

  it('upserts a setting value', () => {
    setFlashSetting(testDb.adapter, 'dailyNewLimit', '50');
    expect(getFlashSetting(testDb.adapter, 'dailyNewLimit')).toBe('50');
  });

  it('creates new custom settings', () => {
    const result = setFlashSetting(testDb.adapter, 'theme', 'dark');
    expect(result.key).toBe('theme');
    expect(result.value).toBe('dark');
    expect(getFlashSetting(testDb.adapter, 'theme')).toBe('dark');
  });
});

describe('Flash dashboard', () => {
  it('returns correct counts for fresh database', () => {
    const dashboard = getFlashDashboard(testDb.adapter, '2026-03-08');
    expect(dashboard.deckCount).toBe(1);
    expect(dashboard.cardCount).toBe(0);
    expect(dashboard.newCount).toBe(0);
    expect(dashboard.dueCount).toBe(0);
    expect(dashboard.reviewedToday).toBe(0);
    expect(dashboard.currentStreak).toBe(0);
    expect(dashboard.longestStreak).toBe(0);
  });

  it('stores settings and computes dashboard streaks', () => {
    const deck = createDeck(testDb.adapter, 'deck-1', { name: 'History' });
    const [first] = createFlashcards(testDb.adapter, {
      deckId: deck.id,
      front: '1776',
      back: 'US Declaration of Independence',
    });
    const [second] = createFlashcards(testDb.adapter, {
      deckId: deck.id,
      front: '1789',
      back: 'French Revolution begins',
    });

    setFlashSetting(testDb.adapter, 'dailyStudyTarget', '1');
    expect(getFlashSetting(testDb.adapter, 'dailyStudyTarget')).toBe('1');

    rateFlashcard(testDb.adapter, first!.id, 'good', '2026-03-07T09:00:00.000Z');
    rateFlashcard(testDb.adapter, second!.id, 'hard', '2026-03-08T09:00:00.000Z');

    const dashboard = getFlashDashboard(testDb.adapter, '2026-03-08');
    expect(dashboard.deckCount).toBe(2);
    expect(dashboard.cardCount).toBe(2);
    expect(dashboard.reviewedToday).toBe(1);
    expect(dashboard.currentStreak).toBe(2);
    expect(dashboard.longestStreak).toBe(2);
  });

  it('counts new cards correctly in dashboard', () => {
    createFlashcards(testDb.adapter, {
      deckId: DEFAULT_FLASH_DECK_ID,
      front: 'Q1',
      back: 'A1',
    });
    createFlashcards(testDb.adapter, {
      deckId: DEFAULT_FLASH_DECK_ID,
      front: 'Q2',
      back: 'A2',
    });
    const dashboard = getFlashDashboard(testDb.adapter, '2026-03-08');
    expect(dashboard.newCount).toBe(2);
    expect(dashboard.cardCount).toBe(2);
  });
});

describe('Flash browser and export', () => {
  it('lists global tags and browses cards with search filters', () => {
    const biology = createDeck(testDb.adapter, 'deck-bio', { name: 'Biology' });
    const spanish = createDeck(testDb.adapter, 'deck-spanish', { name: 'Spanish' });
    createFlashcards(testDb.adapter, {
      deckId: biology.id,
      front: 'Mitochondria',
      back: 'Powerhouse',
      tags: ['Exam', 'Science'],
    });
    const [spanishCard] = createFlashcards(testDb.adapter, {
      deckId: spanish.id,
      front: 'Perro',
      back: 'Dog',
      tags: ['Exam', 'Language'],
    });
    rateFlashcard(testDb.adapter, spanishCard!.id, 'again', '2026-03-08T10:00:00.000Z');
    rateFlashcard(testDb.adapter, spanishCard!.id, 'again', '2026-03-08T10:10:00.000Z');
    rateFlashcard(testDb.adapter, spanishCard!.id, 'again', '2026-03-08T10:20:00.000Z');

    expect(listFlashTags(testDb.adapter)).toEqual(['exam', 'language', 'science']);

    const results = browseFlashcards(testDb.adapter, {
      query: 'deck:Spanish tag:exam prop:lapses>2',
      sort: 'lapses',
    });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      deckName: 'Spanish',
      isLeech: false,
      lapseCount: 3,
    });
  });

  it('can filter suspended cards in the browser', () => {
    const [card] = createFlashcards(testDb.adapter, {
      deckId: DEFAULT_FLASH_DECK_ID,
      front: 'Q',
      back: 'A',
    });
    suspendFlashcard(testDb.adapter, card!.id);

    const results = browseFlashcards(testDb.adapter, { query: 'is:suspended' });
    expect(results).toHaveLength(1);
    expect(results[0]?.queue).toBe('suspended');
  });

  it('exports data, records export history, and can strip scheduling fields', () => {
    const [card] = createFlashcards(testDb.adapter, {
      deckId: DEFAULT_FLASH_DECK_ID,
      front: 'Q',
      back: 'A',
      tags: ['Exam'],
    });
    rateFlashcard(testDb.adapter, card!.id, 'good', '2026-03-08T10:00:00.000Z');

    const exported = exportFlashData(testDb.adapter, {
      includeScheduling: false,
      includeTags: false,
    });

    expect(exported.cards).toHaveLength(1);
    expect(exported.cards[0]).toMatchObject({
      queue: 'new',
      tags: [],
      reviewCount: 0,
      dueAt: null,
    });
    expect(exported.reviewLogs).toHaveLength(0);

    const history = listFlashExportRecords(testDb.adapter);
    expect(history).toHaveLength(1);
    expect(history[0]?.cardsExported).toBe(1);
  });

  it('buries a single card without affecting suspended cards', () => {
    const [first] = createFlashcards(testDb.adapter, {
      deckId: DEFAULT_FLASH_DECK_ID,
      front: 'Q1',
      back: 'A1',
    });
    const [second] = createFlashcards(testDb.adapter, {
      deckId: DEFAULT_FLASH_DECK_ID,
      front: 'Q2',
      back: 'A2',
    });
    suspendFlashcard(testDb.adapter, second!.id);

    const buried = buryFlashcard(testDb.adapter, first!.id, '2026-03-08T10:00:00.000Z');
    expect(buried?.queue).toBe('buried');
    expect(getFlashcardById(testDb.adapter, second!.id)?.queue).toBe('suspended');
  });
});
