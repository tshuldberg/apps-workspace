/**
 * highlight-to-flash — Phase 5-core automation rule.
 *
 * When a user captures a highlight against a book, offer to turn it into a
 * flash card. The card is added to a per-book deck (created on first use,
 * reused thereafter), keyed by name `"<bookTitle> — highlights"`.
 *
 * Cross-module: this rule writes to `fl_decks` and `fl_cards` directly via
 * SQL. If the flash module isn't installed (no fl_decks / fl_cards tables),
 * check() returns null so the rule silently declines to apply.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { AutomationRule } from '@mylife/automations';
import { logAutomationEvent } from '@mylife/automations';

/** UUID v4-shaped id generator (no crypto dep). */
function generateId(): string {
  const hex = '0123456789abcdef';
  const segments = [8, 4, 4, 4, 12];
  return segments
    .map((len) =>
      Array.from({ length: len }, () =>
        hex[Math.floor(Math.random() * 16)],
      ).join(''),
    )
    .join('-');
}

function tableExists(db: DatabaseAdapter, name: string): boolean {
  const rows = db.query<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name = ?`,
    [name],
  );
  return rows.length > 0;
}

/** Extract the first sentence of `text`, truncated to `maxLen` chars. */
export function firstSentence(text: string, maxLen: number): string {
  const m = text.match(/^[^.!?\n]+[.!?]?/);
  const sentence = m ? m[0].trim() : text.trim();
  if (sentence.length <= maxLen) return sentence;
  return sentence.slice(0, maxLen - 1).trimEnd() + '…';
}

const MIN_HIGHLIGHT_LEN = 10;
const MAX_HIGHLIGHT_LEN = 1000;
const FRONT_MAX_LEN = 120;

export interface HighlightToFlashInput {
  bookId: string;
  highlightText: string;
  pageOrLocation?: string;
}

export interface HighlightToFlashPreviewState {
  bookId: string;
  bookTitle: string;
  highlightText: string;
  pageOrLocation?: string;
  suggestedFront: string;
  suggestedBack: string;
  suggestedDeckName: string;
}

export interface HighlightToFlashResult {
  deckId: string;
  deckCreated: boolean;
  cardId: string;
  auditEntryId: string;
}

interface DeckRow {
  id: string;
  name: string;
}

interface BookRow {
  id: string;
  title: string;
}

export const highlightToFlashRule: AutomationRule<
  HighlightToFlashInput,
  HighlightToFlashPreviewState,
  HighlightToFlashResult
> = {
  id: 'highlight-to-flash',
  label: 'Turn book highlights into flash cards',
  description:
    'When you capture a highlight on a book, offer to save it as a flash card in a per-book deck so you can review memorable passages over time.',
  clusters: ['learn'],

  check(db, input) {
    if (!input || typeof input !== 'object') return null;
    if (!input.bookId || typeof input.bookId !== 'string') return null;
    if (
      !input.highlightText ||
      typeof input.highlightText !== 'string'
    ) {
      return null;
    }
    const text = input.highlightText;
    if (text.length < MIN_HIGHLIGHT_LEN || text.length > MAX_HIGHLIGHT_LEN) {
      return null;
    }

    const adapter = db as DatabaseAdapter;

    // Flash module must be installed for this rule to apply.
    if (!tableExists(adapter, 'fl_decks') || !tableExists(adapter, 'fl_cards')) {
      return null;
    }

    // Book must exist in bk_books.
    const books = adapter.query<BookRow>(
      `SELECT id, title FROM bk_books WHERE id = ?`,
      [input.bookId],
    );
    if (books.length === 0) return null;
    const bookTitle = books[0]!.title;

    const sentence = firstSentence(text, FRONT_MAX_LEN);
    const frontBase = `${sentence} — ${bookTitle}`;
    const suggestedFront =
      frontBase.length <= FRONT_MAX_LEN
        ? frontBase
        : frontBase.slice(0, FRONT_MAX_LEN - 1).trimEnd() + '…';

    const pageRef = input.pageOrLocation
      ? ` (${input.pageOrLocation})`
      : '';
    const suggestedBack = `${text}${pageRef}`;
    const suggestedDeckName = `${bookTitle} — highlights`;

    return {
      bookId: input.bookId,
      bookTitle,
      highlightText: text,
      pageOrLocation: input.pageOrLocation,
      suggestedFront,
      suggestedBack,
      suggestedDeckName,
    };
  },

  previewCard(state) {
    const front = state.suggestedFront;
    const subtitle =
      front.length <= 60 ? front : front.slice(0, 60) + '…';
    return {
      title: 'Make flashcard from highlight?',
      subtitle,
      cta: { apply: 'Save card', dismiss: 'Skip' },
    };
  },

  apply(db, state) {
    const adapter = db as DatabaseAdapter;
    let result: HighlightToFlashResult | null = null;

    adapter.transaction(() => {
      // 1. Find or create the per-book deck by name.
      const existing = adapter.query<DeckRow>(
        `SELECT id, name FROM fl_decks WHERE name = ? LIMIT 1`,
        [state.suggestedDeckName],
      );

      let deckId: string;
      let deckCreated = false;
      if (existing.length > 0) {
        deckId = existing[0]!.id;
      } else {
        deckId = generateId();
        adapter.execute(
          `INSERT INTO fl_decks (id, name, description, parent_id, is_default)
           VALUES (?, ?, ?, NULL, 0)`,
          [
            deckId,
            state.suggestedDeckName,
            `Highlights captured from ${state.bookTitle}`,
          ],
        );
        deckCreated = true;
      }

      // 2. Insert the card. note_id is required NOT NULL; use the card id
      //    as a stable value so each card is its own note in the highlights
      //    stream.
      const cardId = generateId();
      adapter.execute(
        `INSERT INTO fl_cards (id, note_id, deck_id, card_type, front, back)
         VALUES (?, ?, ?, 'basic', ?, ?)`,
        [cardId, cardId, deckId, state.suggestedFront, state.suggestedBack],
      );

      // 3. Audit log entry in the same transaction so rollback is atomic.
      const audit = logAutomationEvent(adapter, {
        ruleId: 'highlight-to-flash',
        outcome: 'applied',
      });

      result = {
        deckId,
        deckCreated,
        cardId,
        auditEntryId: audit.id,
      };
    });

    if (!result) {
      throw new Error(
        'highlight-to-flash apply failed: transaction rolled back',
      );
    }
    return result;
  },
};
