import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { FLASH_MODULE } from '../definition';
import { saveMCResult, listMCResults } from '../db/mc-results';
import { saveMatchResult, getMatchBest, updateMatchBest, listMatchResults } from '../db/match-results';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  // Create a deck for FK references
  testDb = createModuleTestDatabase('flash', FLASH_MODULE.migrations!);
  testDb.adapter.execute(
    `INSERT INTO fl_decks (id, name, is_default, created_at, updated_at) VALUES ('d1', 'Test Deck', 0, datetime('now'), datetime('now'))`,
  );
});

afterEach(() => {
  testDb.close();
});

describe('MC Results CRUD', () => {
  it('saves and retrieves MC results', () => {
    const result = saveMCResult(testDb.adapter, 'mcr1', {
      deckId: 'd1',
      questionCount: 10,
      correctCount: 7,
      incorrectCount: 3,
      scorePercent: 70.0,
      timeMs: 45000,
    });
    expect(result.id).toBe('mcr1');
    expect(result.scorePercent).toBe(70.0);

    const results = listMCResults(testDb.adapter, 'd1');
    expect(results).toHaveLength(1);
    expect(results[0].correctCount).toBe(7);
  });

  it('lists results in descending order', () => {
    saveMCResult(testDb.adapter, 'mcr1', {
      deckId: 'd1', questionCount: 5, correctCount: 3, incorrectCount: 2, scorePercent: 60, timeMs: 30000,
    });
    saveMCResult(testDb.adapter, 'mcr2', {
      deckId: 'd1', questionCount: 5, correctCount: 5, incorrectCount: 0, scorePercent: 100, timeMs: 20000,
    });
    const results = listMCResults(testDb.adapter, 'd1');
    expect(results).toHaveLength(2);
  });
});

describe('Match Results CRUD', () => {
  it('saves and retrieves match results', () => {
    const result = saveMatchResult(testDb.adapter, 'mr1', {
      deckId: 'd1',
      boardSize: 12,
      timeMs: 25000,
      mistakes: 1,
      stars: 3,
      cardIds: ['c1', 'c2', 'c3'],
    });
    expect(result.id).toBe('mr1');
    expect(result.stars).toBe(3);
    expect(result.cardIds).toEqual(['c1', 'c2', 'c3']);

    const results = listMatchResults(testDb.adapter, 'd1');
    expect(results).toHaveLength(1);
    expect(results[0].boardSize).toBe(12);
  });

  it('updates match best times', () => {
    updateMatchBest(testDb.adapter, 'd1', 12, 30000, 2);
    let best = getMatchBest(testDb.adapter, 'd1', 12);
    expect(best!.bestTimeMs).toBe(30000);
    expect(best!.bestStars).toBe(2);

    // Faster time replaces
    updateMatchBest(testDb.adapter, 'd1', 12, 20000, 3);
    best = getMatchBest(testDb.adapter, 'd1', 12);
    expect(best!.bestTimeMs).toBe(20000);
    expect(best!.bestStars).toBe(3);
  });

  it('tracks bests per board size independently', () => {
    updateMatchBest(testDb.adapter, 'd1', 6, 15000, 3);
    updateMatchBest(testDb.adapter, 'd1', 12, 30000, 2);

    expect(getMatchBest(testDb.adapter, 'd1', 6)!.bestTimeMs).toBe(15000);
    expect(getMatchBest(testDb.adapter, 'd1', 12)!.bestTimeMs).toBe(30000);
  });

  it('returns null for no best', () => {
    expect(getMatchBest(testDb.adapter, 'd1', 12)).toBeNull();
  });
});

describe('V3 Migration - Source Column', () => {
  it('fl_cards has source column with default manual', () => {
    testDb.adapter.execute(
      `INSERT INTO fl_cards (id, note_id, deck_id, card_type, front, back, created_at, updated_at)
       VALUES ('c1', 'n1', 'd1', 'basic', 'Q', 'A', datetime('now'), datetime('now'))`,
    );
    const rows = testDb.adapter.query<{ source: string }>(
      `SELECT source FROM fl_cards WHERE id = 'c1'`,
    );
    expect(rows[0].source).toBe('manual');
  });

  it('allows setting source to ai_ondevice', () => {
    testDb.adapter.execute(
      `INSERT INTO fl_cards (id, note_id, deck_id, card_type, front, back, source, created_at, updated_at)
       VALUES ('c1', 'n1', 'd1', 'basic', 'Q', 'A', 'ai_ondevice', datetime('now'), datetime('now'))`,
    );
    const rows = testDb.adapter.query<{ source: string }>(
      `SELECT source FROM fl_cards WHERE id = 'c1'`,
    );
    expect(rows[0].source).toBe('ai_ondevice');
  });
});
