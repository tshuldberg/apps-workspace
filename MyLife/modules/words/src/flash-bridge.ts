import type { DatabaseAdapter } from '@mylife/db';
import type { SavedWord, FlashBridgeContent, FlashBridgeResult, BulkFlashBridgeResult } from './types';
import { getSavedWord, setFlashCardId } from './db/crud';

const MAX_BACK_LENGTH = 500;
const BULK_BATCH_SIZE = 20;
const VOCABULARY_DECK_NAME = 'Words: Vocabulary';

export function buildFlashcardContent(savedWord: SavedWord): FlashBridgeContent {
  const frontParts: string[] = [savedWord.word];
  if (savedWord.pronunciationText) {
    frontParts.push(savedWord.pronunciationText);
  }
  if (savedWord.partOfSpeech) {
    frontParts.push(`(${savedWord.partOfSpeech})`);
  }
  const front = frontParts.join(' ');

  let back = savedWord.definitionSummary ?? '';

  if (savedWord.lookupData?.entries?.[0]?.senses?.[0]?.examples) {
    const examples = savedWord.lookupData.entries[0].senses[0].examples.slice(0, 2);
    if (examples.length > 0) {
      const exampleText = examples.map((e) => `e.g. ${e}`).join('\n');
      back = back ? `${back}\n\n${exampleText}` : exampleText;
    }
  }

  if (!back) {
    back = 'No definition available';
  }

  if (back.length > MAX_BACK_LENGTH) {
    back = back.slice(0, MAX_BACK_LENGTH - 3) + '...';
  }

  return { front, back, tags: buildFlashcardTags(savedWord) };
}

export function buildFlashcardTags(savedWord: SavedWord): string[] {
  const tags: string[] = ['words'];
  if (savedWord.languageCode) tags.push(savedWord.languageCode);
  if (savedWord.partOfSpeech) tags.push(savedWord.partOfSpeech);
  return tags;
}

export interface FlashBridgeDeps {
  createFlashcards: (db: DatabaseAdapter, deckId: string, cards: Array<{ front: string; back: string; cardType?: string; tags?: string[] }>) => unknown[];
  createDeck: (db: DatabaseAdapter, input: { name: string; description?: string | null }) => { id: string };
  listDecks: (db: DatabaseAdapter) => Array<{ id: string; name: string }>;
  getFlashcardById: (db: DatabaseAdapter, id: string) => unknown | null;
}

export function getOrCreateVocabularyDeck(
  db: DatabaseAdapter,
  deps: FlashBridgeDeps,
): string {
  const decks = deps.listDecks(db);
  const existing = decks.find((d) => d.name === VOCABULARY_DECK_NAME);
  if (existing) return existing.id;
  const newDeck = deps.createDeck(db, { name: VOCABULARY_DECK_NAME, description: 'Auto-created deck for words from MyWords' });
  return newDeck.id;
}

export function createFlashcardFromWord(
  db: DatabaseAdapter,
  savedWordId: string,
  deckId: string,
  deps: FlashBridgeDeps,
): FlashBridgeResult | null {
  const word = getSavedWord(db, savedWordId);
  if (!word) return null;

  if (word.flashCardId) {
    const existingCard = deps.getFlashcardById(db, word.flashCardId);
    if (existingCard) {
      return { flashCardId: word.flashCardId, created: false };
    }
    setFlashCardId(db, savedWordId, null);
  }

  const content = buildFlashcardContent(word);
  const cards = deps.createFlashcards(db, deckId, [{
    front: content.front,
    back: content.back,
    cardType: 'basic',
    tags: content.tags,
  }]);

  const created = cards[0] as { id: string } | undefined;
  if (!created?.id) return null;

  setFlashCardId(db, savedWordId, created.id);
  return { flashCardId: created.id, created: true };
}

export function bulkCreateFlashcards(
  db: DatabaseAdapter,
  savedWordIds: string[],
  deckId: string,
  deps: FlashBridgeDeps,
): BulkFlashBridgeResult {
  let created = 0;
  let skipped = 0;
  const results: BulkFlashBridgeResult['results'] = [];

  db.transaction(() => {
    for (let i = 0; i < savedWordIds.length; i += BULK_BATCH_SIZE) {
      const batch = savedWordIds.slice(i, i + BULK_BATCH_SIZE);
      for (const id of batch) {
        const result = createFlashcardFromWord(db, id, deckId, deps);
        if (!result) {
          results.push({ savedWordId: id, flashCardId: null, created: false });
          skipped++;
        } else if (result.created) {
          results.push({ savedWordId: id, flashCardId: result.flashCardId, created: true });
          created++;
        } else {
          results.push({ savedWordId: id, flashCardId: result.flashCardId, created: false });
          skipped++;
        }
      }
    }
  });

  return { created, skipped, results };
}

export function checkFlashCardExists(
  db: DatabaseAdapter,
  savedWordId: string,
  deps: FlashBridgeDeps,
): boolean {
  const word = getSavedWord(db, savedWordId);
  if (!word?.flashCardId) return false;

  const card = deps.getFlashcardById(db, word.flashCardId);
  if (card) return true;

  setFlashCardId(db, savedWordId, null);
  return false;
}
