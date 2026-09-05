/**
 * Integration tests for the highlight-to-flash automation rule.
 *
 * Spans two modules: books (bk_books) and flash (fl_decks, fl_cards). We seed
 * both sets of migrations against a hub test DB so the rule can read book
 * metadata and write flash rows inside a single SQLite file.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import {
  createHubTestDatabase,
  runModuleMigrations,
} from '@mylife/db';
import { FLASH_MODULE } from '@mylife/flash';
import { BOOKS_MODULE } from '../../definition';
import { createBook } from '../../db/books';
import {
  firstSentence,
  highlightToFlashRule,
  type HighlightToFlashInput,
} from '../highlight-to-flash';

function seedBookAndModules(withFlash: boolean): {
  adapter: DatabaseAdapter;
  close: () => void;
} {
  const db = createHubTestDatabase();
  runModuleMigrations(db.adapter, 'books', BOOKS_MODULE.migrations!);
  if (withFlash) {
    runModuleMigrations(db.adapter, 'flash', FLASH_MODULE.migrations!);
  }
  return { adapter: db.adapter, close: db.close };
}

function seedBook(
  adapter: DatabaseAdapter,
  id: string,
  title: string,
): void {
  createBook(adapter, id, {
    title,
    authors: 'Test Author',
    format: 'physical',
    added_source: 'manual',
    language: 'en',
  });
}

function makeInput(
  overrides: Partial<HighlightToFlashInput> = {},
): HighlightToFlashInput {
  return {
    bookId: 'book-1',
    highlightText:
      'The only way out is through. Pain demands to be felt, and running from it only makes it heavier.',
    pageOrLocation: 'p. 42',
    ...overrides,
  };
}

describe('highlightToFlashRule', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const setup = seedBookAndModules(true);
    adapter = setup.adapter;
    closeDb = setup.close;
    seedBook(adapter, 'book-1', 'Dune');
  });

  afterEach(() => {
    closeDb();
  });

  // ------------------------------------------------------------------
  // firstSentence()
  // ------------------------------------------------------------------

  describe('firstSentence()', () => {
    it('extracts the first sentence up to the first . ! or ?', () => {
      expect(
        firstSentence('Hello world. Second sentence.', 120),
      ).toBe('Hello world.');
      expect(firstSentence('Is this a question? Yes!', 120)).toBe(
        'Is this a question?',
      );
    });

    it('truncates with ellipsis when the sentence exceeds maxLen', () => {
      const long = 'a'.repeat(150);
      const out = firstSentence(long, 120);
      expect(out).toHaveLength(120);
      expect(out.endsWith('…')).toBe(true);
    });

    it('falls back to the full trimmed text when no terminator is present', () => {
      expect(firstSentence('   short phrase   ', 120)).toBe('short phrase');
    });
  });

  // ------------------------------------------------------------------
  // check()
  // ------------------------------------------------------------------

  describe('check()', () => {
    it('returns preview state with derived front/back/deckName for a valid highlight', () => {
      const state = highlightToFlashRule.check(adapter, makeInput());
      expect(state).not.toBeNull();
      expect(state?.bookTitle).toBe('Dune');
      expect(state?.suggestedDeckName).toBe('Dune — highlights');
      expect(state?.suggestedFront).toContain('The only way out is through.');
      expect(state?.suggestedFront).toContain('Dune');
      expect(state?.suggestedBack).toContain('(p. 42)');
    });

    it('returns null when highlight is shorter than 10 chars', () => {
      expect(
        highlightToFlashRule.check(
          adapter,
          makeInput({ highlightText: 'too short' }),
        ),
      ).toBeNull();
      expect(
        highlightToFlashRule.check(
          adapter,
          makeInput({ highlightText: '' }),
        ),
      ).toBeNull();
    });

    it('returns null when highlight is longer than 1000 chars', () => {
      expect(
        highlightToFlashRule.check(
          adapter,
          makeInput({ highlightText: 'x'.repeat(1001) }),
        ),
      ).toBeNull();
    });

    it('returns null when the book does not exist', () => {
      expect(
        highlightToFlashRule.check(
          adapter,
          makeInput({ bookId: 'does-not-exist' }),
        ),
      ).toBeNull();
    });

    it('returns null when flash tables are absent (module not installed)', () => {
      closeDb();
      const setup = seedBookAndModules(false);
      adapter = setup.adapter;
      closeDb = setup.close;
      seedBook(adapter, 'book-1', 'Dune');

      expect(
        highlightToFlashRule.check(adapter, makeInput()),
      ).toBeNull();
    });
  });

  // ------------------------------------------------------------------
  // previewCard()
  // ------------------------------------------------------------------

  describe('previewCard()', () => {
    it('uses first 60 chars of suggestedFront as subtitle', () => {
      const state = highlightToFlashRule.check(adapter, makeInput())!;
      const card = highlightToFlashRule.previewCard(state);
      expect(card.title).toBe('Make flashcard from highlight?');
      expect(card.subtitle.length).toBeLessThanOrEqual(61);
      expect(card.cta.apply).toBe('Save card');
      expect(card.cta.dismiss).toBe('Skip');
    });
  });

  // ------------------------------------------------------------------
  // apply()
  // ------------------------------------------------------------------

  describe('apply()', () => {
    it('creates deck + card + audit log on first apply', () => {
      const state = highlightToFlashRule.check(adapter, makeInput())!;
      const result = highlightToFlashRule.apply(adapter, state);

      expect(result.deckCreated).toBe(true);

      const decks = adapter.query<{ id: string; name: string }>(
        `SELECT id, name FROM fl_decks WHERE name = ?`,
        ['Dune — highlights'],
      );
      expect(decks).toHaveLength(1);
      expect(decks[0]!.id).toBe(result.deckId);

      const cards = adapter.query<{
        id: string;
        deck_id: string;
        front: string;
        back: string;
      }>(`SELECT id, deck_id, front, back FROM fl_cards WHERE id = ?`, [
        result.cardId,
      ]);
      expect(cards).toHaveLength(1);
      expect(cards[0]!.deck_id).toBe(result.deckId);
      expect(cards[0]!.back).toContain('(p. 42)');

      const logs = adapter.query<{ rule_id: string; outcome: string }>(
        `SELECT rule_id, outcome FROM hub_automation_log WHERE id = ?`,
        [result.auditEntryId],
      );
      expect(logs).toHaveLength(1);
      expect(logs[0]!.rule_id).toBe('highlight-to-flash');
      expect(logs[0]!.outcome).toBe('applied');
    });

    it('reuses the per-book deck on second apply (2 cards, 1 deck)', () => {
      const state1 = highlightToFlashRule.check(adapter, makeInput())!;
      const first = highlightToFlashRule.apply(adapter, state1);

      const state2 = highlightToFlashRule.check(
        adapter,
        makeInput({
          highlightText:
            'Fear is the mind-killer. I will face my fear and let it pass through me.',
          pageOrLocation: 'p. 57',
        }),
      )!;
      const second = highlightToFlashRule.apply(adapter, state2);

      expect(second.deckId).toBe(first.deckId);
      expect(second.deckCreated).toBe(false);

      const deckCount = adapter.query<{ c: number }>(
        `SELECT COUNT(*) as c FROM fl_decks WHERE name = ?`,
        ['Dune — highlights'],
      )[0]!.c;
      expect(deckCount).toBe(1);

      const cardCount = adapter.query<{ c: number }>(
        `SELECT COUNT(*) as c FROM fl_cards WHERE deck_id = ?`,
        [first.deckId],
      )[0]!.c;
      expect(cardCount).toBe(2);
    });

    it('rolls back deck + card writes when inner INSERT fails', () => {
      const state = highlightToFlashRule.check(adapter, makeInput())!;

      // Corrupt the state to violate fl_cards NOT NULL on front.
      const badState = {
        ...state,
        suggestedFront: null as unknown as string,
      };

      expect(() =>
        highlightToFlashRule.apply(adapter, badState),
      ).toThrow();

      // No deck, no card, no audit log row for this rule.
      const deckCount = adapter.query<{ c: number }>(
        `SELECT COUNT(*) as c FROM fl_decks WHERE name = ?`,
        ['Dune — highlights'],
      )[0]!.c;
      expect(deckCount).toBe(0);

      const cardCount = adapter.query<{ c: number }>(
        `SELECT COUNT(*) as c FROM fl_cards`,
      )[0]!.c;
      expect(cardCount).toBe(0);

      const logCount = adapter.query<{ c: number }>(
        `SELECT COUNT(*) as c FROM hub_automation_log WHERE rule_id = ?`,
        ['highlight-to-flash'],
      )[0]!.c;
      expect(logCount).toBe(0);
    });
  });
});
