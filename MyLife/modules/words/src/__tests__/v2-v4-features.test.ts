import { beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import type { SavedWord, MyWordsLookupResult } from '../types';
import {
  saveWord,
  getSavedWord,
  getSavedWordCount,
  setFlashCardId,
  cacheLookupResult,
  getCachedLookup,
  evictLruEntries,
  evictStaleEntries,
  getCachePrefixMatches,
  getCacheStats,
  clearCache,
  getDistinctPartsOfSpeech,
  advancedSearchSavedWords,
  escapeFtsQuery,
} from '../db/crud';
import {
  buildFlashcardContent,
  buildFlashcardTags,
  getOrCreateVocabularyDeck,
  createFlashcardFromWord,
  bulkCreateFlashcards,
  checkFlashCardExists,
} from '../flash-bridge';
import type { FlashBridgeDeps } from '../flash-bridge';
import { ALL_TABLES, CREATE_INDEXES, V2_UP, V3_UP, V4_UP } from '../db/schema';

// ── In-memory SQLite adapter ──────────────────────────────────────────

function createTestDb(): DatabaseAdapter {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require('better-sqlite3');
  const raw = new Database(':memory:');
  raw.pragma('journal_mode = WAL');

  const db: DatabaseAdapter = {
    execute(sql: string, params?: unknown[]): void {
      raw.prepare(sql).run(...(params ?? []));
    },
    query<T>(sql: string, params?: unknown[]): T[] {
      return raw.prepare(sql).all(...(params ?? [])) as T[];
    },
    transaction(fn: () => void): void {
      raw.transaction(fn)();
    },
  };

  for (const sql of [...ALL_TABLES, ...CREATE_INDEXES]) {
    raw.exec(sql);
  }
  for (const sql of V2_UP) {
    raw.exec(sql);
  }
  for (const sql of V3_UP) {
    raw.exec(sql);
  }
  for (const sql of V4_UP) {
    raw.exec(sql);
  }

  return db;
}

function makeLookupResult(word: string, lang: string = 'en'): MyWordsLookupResult {
  return {
    word,
    requestedLanguageCode: lang,
    language: { code: lang, name: lang === 'en' ? 'English' : 'Spanish' },
    entries: [{
      partOfSpeech: 'noun',
      pronunciations: [{ text: '/test/', tags: [] }],
      forms: [],
      senses: [{
        definition: `Definition of ${word}`,
        tags: [],
        examples: [`Example sentence with ${word}`, `Another example of ${word}`, 'Third example'],
        quotes: [],
        synonyms: ['syn1'],
        antonyms: ['ant1'],
        subsenses: [],
      }],
      synonyms: [],
      antonyms: [],
    }],
    synonyms: ['syn1'],
    antonyms: ['ant1'],
    providers: ['freeDictionaryApi'],
    attributions: [{ name: 'Test', url: 'https://test.com', license: 'MIT' }],
  };
}

let db: DatabaseAdapter;
let idCounter = 0;
function nextId(): string { return `test_${++idCounter}`; }

beforeEach(() => {
  db = createTestDb();
  idCounter = 0;
});

// ── V2: Flash Bridge ──────────────────────────────────────────────────

describe('flash bridge', () => {
  function makeSavedWord(word: string, lang: string = 'en'): SavedWord {
    const lookup = makeLookupResult(word, lang);
    return saveWord(db, nextId(), {
      word,
      languageCode: lang,
      languageName: lang === 'en' ? 'English' : 'Spanish',
      definitionSummary: `Definition of ${word}`,
      partOfSpeech: 'noun',
      pronunciationText: '/test/',
      lookupData: lookup,
    });
  }

  const flashCards = new Map<string, { id: string; front: string; back: string }>();

  function makeDeps(): FlashBridgeDeps {
    const decks: Array<{ id: string; name: string }> = [];
    return {
      createFlashcards: (_db, _deckId, cards) => {
        return cards.map((c) => {
          const id = `fl_${nextId()}`;
          flashCards.set(id, { id, front: c.front, back: c.back });
          return { id };
        });
      },
      createDeck: (_db, input) => {
        const id = `deck_${nextId()}`;
        decks.push({ id, name: input.name });
        return { id };
      },
      listDecks: () => decks,
      getFlashcardById: (_db, id) => flashCards.get(id) ?? null,
    };
  }

  describe('buildFlashcardContent', () => {
    it('generates front with word + pronunciation + POS', () => {
      const word = makeSavedWord('ephemeral');
      const content = buildFlashcardContent(word);
      expect(content.front).toBe('ephemeral /test/ (noun)');
    });

    it('generates back with definition + up to 2 examples', () => {
      const word = makeSavedWord('ephemeral');
      const content = buildFlashcardContent(word);
      expect(content.back).toContain('Definition of ephemeral');
      expect(content.back).toContain('e.g. Example sentence with ephemeral');
      expect(content.back).toContain('e.g. Another example of ephemeral');
      expect(content.back).not.toContain('Third example');
    });

    it('handles missing pronunciation', () => {
      const word = makeSavedWord('test');
      word.pronunciationText = null;
      const content = buildFlashcardContent(word);
      expect(content.front).toBe('test (noun)');
    });

    it('handles missing lookupData', () => {
      const word = makeSavedWord('test');
      word.lookupData = null;
      const content = buildFlashcardContent(word);
      expect(content.back).toBe('Definition of test');
    });

    it('truncates back text exceeding 500 chars', () => {
      const word = makeSavedWord('test');
      word.definitionSummary = 'x'.repeat(600);
      const content = buildFlashcardContent(word);
      expect(content.back.length).toBeLessThanOrEqual(500);
      expect(content.back.endsWith('...')).toBe(true);
    });

    it('shows fallback when no definition', () => {
      const word = makeSavedWord('test');
      word.definitionSummary = null;
      word.lookupData = null;
      const content = buildFlashcardContent(word);
      expect(content.back).toBe('No definition available');
    });
  });

  describe('buildFlashcardTags', () => {
    it('returns words + languageCode + partOfSpeech', () => {
      const word = makeSavedWord('test');
      const tags = buildFlashcardTags(word);
      expect(tags).toEqual(['words', 'en', 'noun']);
    });

    it('omits null partOfSpeech', () => {
      const word = makeSavedWord('test');
      word.partOfSpeech = null;
      const tags = buildFlashcardTags(word);
      expect(tags).toEqual(['words', 'en']);
    });
  });

  describe('getOrCreateVocabularyDeck', () => {
    it('creates deck on first call', () => {
      const deps = makeDeps();
      const id = getOrCreateVocabularyDeck(db, deps);
      expect(id).toBeTruthy();
    });

    it('returns existing deck on subsequent calls', () => {
      const deps = makeDeps();
      const id1 = getOrCreateVocabularyDeck(db, deps);
      const id2 = getOrCreateVocabularyDeck(db, deps);
      expect(id1).toBe(id2);
    });
  });

  describe('createFlashcardFromWord', () => {
    it('creates flash card and sets flash_card_id', () => {
      const deps = makeDeps();
      const word = makeSavedWord('ephemeral');
      const deckId = getOrCreateVocabularyDeck(db, deps);
      const result = createFlashcardFromWord(db, word.id, deckId, deps);
      expect(result).not.toBeNull();
      expect(result!.created).toBe(true);

      const updated = getSavedWord(db, word.id);
      expect(updated!.flashCardId).toBe(result!.flashCardId);
    });

    it('returns existing link if flash_card_id already set', () => {
      const deps = makeDeps();
      const word = makeSavedWord('ephemeral');
      const deckId = getOrCreateVocabularyDeck(db, deps);
      const first = createFlashcardFromWord(db, word.id, deckId, deps);
      const second = createFlashcardFromWord(db, word.id, deckId, deps);
      expect(second!.created).toBe(false);
      expect(second!.flashCardId).toBe(first!.flashCardId);
    });

    it('returns null for non-existent word', () => {
      const deps = makeDeps();
      const result = createFlashcardFromWord(db, 'nonexistent', 'deck1', deps);
      expect(result).toBeNull();
    });
  });

  describe('bulkCreateFlashcards', () => {
    it('creates cards for words without flash_card_id', () => {
      const deps = makeDeps();
      const w1 = makeSavedWord('alpha');
      const w2 = makeSavedWord('beta');
      const w3 = makeSavedWord('gamma');
      const deckId = getOrCreateVocabularyDeck(db, deps);
      const result = bulkCreateFlashcards(db, [w1.id, w2.id, w3.id], deckId, deps);
      expect(result.created).toBe(3);
      expect(result.skipped).toBe(0);
    });

    it('skips words that already have flash_card_id', () => {
      const deps = makeDeps();
      const w1 = makeSavedWord('alpha');
      const w2 = makeSavedWord('beta');
      const deckId = getOrCreateVocabularyDeck(db, deps);
      createFlashcardFromWord(db, w1.id, deckId, deps);
      const result = bulkCreateFlashcards(db, [w1.id, w2.id], deckId, deps);
      expect(result.created).toBe(1);
      expect(result.skipped).toBe(1);
    });
  });

  describe('checkFlashCardExists', () => {
    it('returns true for existing card', () => {
      const deps = makeDeps();
      const word = makeSavedWord('test');
      const deckId = getOrCreateVocabularyDeck(db, deps);
      createFlashcardFromWord(db, word.id, deckId, deps);
      expect(checkFlashCardExists(db, word.id, deps)).toBe(true);
    });

    it('returns false and clears flash_card_id for deleted card', () => {
      const deps = makeDeps();
      const word = makeSavedWord('test');
      const deckId = getOrCreateVocabularyDeck(db, deps);
      const result = createFlashcardFromWord(db, word.id, deckId, deps)!;
      flashCards.delete(result.flashCardId);
      expect(checkFlashCardExists(db, word.id, deps)).toBe(false);

      const updated = getSavedWord(db, word.id);
      expect(updated!.flashCardId).toBeNull();
    });
  });

  describe('setFlashCardId', () => {
    it('sets and clears flash_card_id', () => {
      const word = makeSavedWord('test');
      setFlashCardId(db, word.id, 'card_123');
      expect(getSavedWord(db, word.id)!.flashCardId).toBe('card_123');
      setFlashCardId(db, word.id, null);
      expect(getSavedWord(db, word.id)!.flashCardId).toBeNull();
    });
  });
});

// ── V3: Offline Cache ─────────────────────────────────────────────────

describe('offline cache', () => {
  const lookup = makeLookupResult('test');

  describe('cacheLookupResult', () => {
    it('creates cache entry with correct data_size_bytes', () => {
      cacheLookupResult(db, nextId(), 'test', 'en', lookup);
      const stats = getCacheStats(db);
      expect(stats.wordCount).toBe(1);
      expect(stats.totalSizeBytes).toBeGreaterThan(0);
    });

    it('updates existing entry if word+lang match', () => {
      cacheLookupResult(db, nextId(), 'test', 'en', lookup);
      cacheLookupResult(db, nextId(), 'test', 'en', lookup);
      const stats = getCacheStats(db);
      expect(stats.wordCount).toBe(1);
    });
  });

  describe('getCachedLookup', () => {
    it('returns cached result and updates last_accessed_at', () => {
      cacheLookupResult(db, nextId(), 'test', 'en', lookup);
      const result = getCachedLookup(db, 'test', 'en');
      expect(result).not.toBeNull();
      expect(result!.lookupData.word).toBe('test');
      expect(result!.accessCount).toBe(2);
    });

    it('returns null for uncached word', () => {
      const result = getCachedLookup(db, 'missing', 'en');
      expect(result).toBeNull();
    });
  });

  describe('evictLruEntries', () => {
    it('deletes least-recently-accessed entries until under limit', () => {
      for (let i = 0; i < 5; i++) {
        cacheLookupResult(db, nextId(), `word${i}`, 'en', makeLookupResult(`word${i}`));
      }
      const stats = getCacheStats(db);
      const halfSize = Math.floor(stats.totalSizeBytes / 2);
      const evicted = evictLruEntries(db, halfSize);
      expect(evicted).toBeGreaterThan(0);
      const after = getCacheStats(db);
      expect(after.totalSizeBytes).toBeLessThanOrEqual(halfSize);
    });
  });

  describe('evictStaleEntries', () => {
    it('deletes entries not accessed in 30+ days', () => {
      cacheLookupResult(db, nextId(), 'stale', 'en', lookup);
      db.execute(
        `UPDATE wd_lookup_cache SET last_accessed_at = ? WHERE word = 'stale'`,
        [new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString()],
      );
      const evicted = evictStaleEntries(db, 30);
      expect(evicted).toBe(1);
      expect(getCacheStats(db).wordCount).toBe(0);
    });
  });

  describe('getCachePrefixMatches', () => {
    it('returns matching cached words', () => {
      cacheLookupResult(db, nextId(), 'serendipity', 'en', makeLookupResult('serendipity'));
      cacheLookupResult(db, nextId(), 'serene', 'en', makeLookupResult('serene'));
      cacheLookupResult(db, nextId(), 'bright', 'en', makeLookupResult('bright'));
      const matches = getCachePrefixMatches(db, 'ser', null, 10);
      expect(matches).toHaveLength(2);
      expect(matches).toContain('serendipity');
      expect(matches).toContain('serene');
    });

    it('merges results from cache and saved words', () => {
      cacheLookupResult(db, nextId(), 'serendipity', 'en', makeLookupResult('serendipity'));
      saveWord(db, nextId(), { word: 'serene', languageCode: 'en', languageName: 'English' });
      const matches = getCachePrefixMatches(db, 'ser', null, 10);
      expect(matches).toHaveLength(2);
    });
  });

  describe('getCacheStats', () => {
    it('returns word count and total size', () => {
      const empty = getCacheStats(db);
      expect(empty.wordCount).toBe(0);
      expect(empty.totalSizeBytes).toBe(0);

      cacheLookupResult(db, nextId(), 'test', 'en', lookup);
      const stats = getCacheStats(db);
      expect(stats.wordCount).toBe(1);
      expect(stats.totalSizeBytes).toBeGreaterThan(0);
    });
  });

  describe('clearCache', () => {
    it('deletes all cache rows', () => {
      cacheLookupResult(db, nextId(), 'test1', 'en', lookup);
      cacheLookupResult(db, nextId(), 'test2', 'en', makeLookupResult('test2'));
      clearCache(db);
      expect(getCacheStats(db).wordCount).toBe(0);
    });

    it('does not affect saved words', () => {
      saveWord(db, nextId(), { word: 'kept', languageCode: 'en', languageName: 'English' });
      cacheLookupResult(db, nextId(), 'cached', 'en', lookup);
      clearCache(db);
      expect(getSavedWordCount(db)).toBe(1);
    });
  });
});

// ── V4: Advanced Search ───────────────────────────────────────────────

describe('advanced search', () => {
  function seedWords() {
    saveWord(db, nextId(), {
      word: 'ephemeral', languageCode: 'en', languageName: 'English',
      definitionSummary: 'Lasting for a very short time', partOfSpeech: 'adjective',
      notes: 'Found this in a novel',
    });
    saveWord(db, nextId(), {
      word: 'ubiquitous', languageCode: 'en', languageName: 'English',
      definitionSummary: 'Present everywhere', partOfSpeech: 'adjective',
    });
    saveWord(db, nextId(), {
      word: 'correr', languageCode: 'es', languageName: 'Spanish',
      definitionSummary: 'To run', partOfSpeech: 'verb',
    });
    saveWord(db, nextId(), {
      word: 'algorithm', languageCode: 'en', languageName: 'English',
      definitionSummary: 'A process or set of rules', partOfSpeech: 'noun',
      notes: 'Used in computer science',
    });
  }

  describe('escapeFtsQuery', () => {
    it('escapes special characters', () => {
      expect(escapeFtsQuery('hello world')).toBe('"hello" "world"');
    });

    it('preserves prefix matching asterisks', () => {
      expect(escapeFtsQuery('ephem*')).toBe('"ephem"*');
    });

    it('preserves phrase matching quotes', () => {
      expect(escapeFtsQuery('"word family"')).toBe('"word family"');
    });

    it('returns empty for empty input', () => {
      expect(escapeFtsQuery('')).toBe('');
      expect(escapeFtsQuery('   ')).toBe('');
    });
  });

  describe('getDistinctPartsOfSpeech', () => {
    it('returns unique non-null values sorted alphabetically', () => {
      seedWords();
      const pos = getDistinctPartsOfSpeech(db);
      expect(pos).toEqual(['adjective', 'noun', 'verb']);
    });

    it('returns empty array when no saved words', () => {
      const pos = getDistinctPartsOfSpeech(db);
      expect(pos).toEqual([]);
    });
  });

  describe('advancedSearchSavedWords', () => {
    it('returns all words with no filters', () => {
      seedWords();
      const results = advancedSearchSavedWords(db, {});
      expect(results).toHaveLength(4);
    });

    it('filters by language', () => {
      seedWords();
      const results = advancedSearchSavedWords(db, { languageCodes: ['es'] });
      expect(results).toHaveLength(1);
      expect(results[0].word).toBe('correr');
    });

    it('filters by part of speech', () => {
      seedWords();
      const results = advancedSearchSavedWords(db, { partsOfSpeech: ['adjective'] });
      expect(results).toHaveLength(2);
    });

    it('filters by mastery range', () => {
      seedWords();
      const results = advancedSearchSavedWords(db, { masteryMin: 0, masteryMax: 0 });
      expect(results).toHaveLength(4);
    });

    it('filters by favorites only', () => {
      seedWords();
      const results = advancedSearchSavedWords(db, { favoritesOnly: true });
      expect(results).toHaveLength(0);
    });

    it('combines multiple filters with AND', () => {
      seedWords();
      const results = advancedSearchSavedWords(db, {
        languageCodes: ['en'],
        partsOfSpeech: ['noun'],
      });
      expect(results).toHaveLength(1);
      expect(results[0].word).toBe('algorithm');
    });

    it('full-text search finds matches in word column', () => {
      seedWords();
      const results = advancedSearchSavedWords(db, { ftsQuery: 'ephemeral' });
      expect(results).toHaveLength(1);
      expect(results[0].word).toBe('ephemeral');
    });

    it('full-text search finds matches in definition_summary', () => {
      seedWords();
      const results = advancedSearchSavedWords(db, { ftsQuery: 'everywhere' });
      expect(results).toHaveLength(1);
      expect(results[0].word).toBe('ubiquitous');
    });

    it('full-text search finds matches in notes', () => {
      seedWords();
      const results = advancedSearchSavedWords(db, { ftsQuery: 'novel' });
      expect(results).toHaveLength(1);
      expect(results[0].word).toBe('ephemeral');
    });

    it('full-text search prefix matching', () => {
      seedWords();
      const results = advancedSearchSavedWords(db, { ftsQuery: 'ephem*' });
      expect(results).toHaveLength(1);
      expect(results[0].word).toBe('ephemeral');
    });

    it('FTS + filter intersection', () => {
      seedWords();
      const results = advancedSearchSavedWords(db, {
        ftsQuery: 'novel',
        languageCodes: ['es'],
      });
      expect(results).toHaveLength(0);
    });

    it('date range filter', () => {
      seedWords();
      const results = advancedSearchSavedWords(db, { dateRangeDays: 7 });
      expect(results).toHaveLength(4);
    });
  });
});
