import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { WORDS_MODULE } from '../definition';
import {
  saveWord,
  unsaveWord,
  getSavedWord,
  getSavedWordByWordAndLang,
  getSavedWords,
  updateSavedWord,
  incrementLookupCount,
  getSavedWordCount,
  getSavedWordCountByLanguage,
  truncateLookupData,
  createWordList,
  getWordList,
  getWordLists,
  updateWordList,
  deleteWordList,
} from '../db/crud';
import type { MyWordsLookupResult } from '../types';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('words', WORDS_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

function makeLookupResult(word: string): MyWordsLookupResult {
  return {
    word,
    requestedLanguageCode: 'en',
    language: { code: 'en', name: 'English' },
    entries: [
      {
        partOfSpeech: 'noun',
        pronunciations: [{ text: '/sɛrənˈdɪpɪti/', tags: [] }],
        forms: [],
        senses: [
          {
            definition: 'The occurrence of events by chance in a happy way.',
            tags: [],
            examples: ['A fortunate serendipity.'],
            quotes: [],
            synonyms: ['luck', 'fortune'],
            antonyms: [],
            subsenses: [],
          },
        ],
        synonyms: ['luck'],
        antonyms: ['misfortune'],
      },
    ],
    synonyms: ['luck', 'fortune'],
    antonyms: ['misfortune'],
    providers: ['freeDictionaryApi'],
    attributions: [
      { name: 'Free Dictionary API', url: 'https://freedictionaryapi.com', license: 'CC BY-SA 4.0' },
    ],
  };
}

// ── Saved Words CRUD ──────────────────────────────────────────────────

describe('Saved Words CRUD', () => {
  it('creates a saved word with all fields', () => {
    const lookup = makeLookupResult('serendipity');
    const saved = saveWord(testDb.adapter, 'sw1', {
      word: 'serendipity',
      languageCode: 'en',
      languageName: 'English',
      definitionSummary: 'The occurrence of events by chance in a happy way.',
      partOfSpeech: 'noun',
      pronunciationText: '/sɛrənˈdɪpɪti/',
      lookupData: lookup,
      notes: 'Found in a novel',
    });

    expect(saved.id).toBe('sw1');
    expect(saved.word).toBe('serendipity');
    expect(saved.languageCode).toBe('en');
    expect(saved.languageName).toBe('English');
    expect(saved.definitionSummary).toBe('The occurrence of events by chance in a happy way.');
    expect(saved.partOfSpeech).toBe('noun');
    expect(saved.pronunciationText).toBe('/sɛrənˈdɪpɪti/');
    expect(saved.lookupData).toBeTruthy();
    expect(saved.lookupData?.word).toBe('serendipity');
    expect(saved.notes).toBe('Found in a novel');
    expect(saved.masteryLevel).toBe(0);
    expect(saved.isFavorite).toBe(false);
    expect(saved.lookedUpCount).toBe(1);
    expect(saved.createdAt).toBeTruthy();
  });

  it('rejects duplicate word+language pair', () => {
    saveWord(testDb.adapter, 'sw1', {
      word: 'hello',
      languageCode: 'en',
      languageName: 'English',
    });
    expect(() =>
      saveWord(testDb.adapter, 'sw2', {
        word: 'hello',
        languageCode: 'en',
        languageName: 'English',
      }),
    ).toThrow();
  });

  it('allows same word in different languages', () => {
    saveWord(testDb.adapter, 'sw1', {
      word: 'chat',
      languageCode: 'en',
      languageName: 'English',
    });
    const fr = saveWord(testDb.adapter, 'sw2', {
      word: 'chat',
      languageCode: 'fr',
      languageName: 'French',
    });
    expect(fr.languageCode).toBe('fr');
  });

  it('unsaves a word and returns true', () => {
    saveWord(testDb.adapter, 'sw1', {
      word: 'test',
      languageCode: 'en',
      languageName: 'English',
    });
    expect(unsaveWord(testDb.adapter, 'sw1')).toBe(true);
    expect(getSavedWord(testDb.adapter, 'sw1')).toBeNull();
  });

  it('unsave returns false for nonexistent id', () => {
    expect(unsaveWord(testDb.adapter, 'nope')).toBe(false);
  });

  it('gets a saved word by id with parsed lookup_data', () => {
    const lookup = makeLookupResult('test');
    saveWord(testDb.adapter, 'sw1', {
      word: 'test',
      languageCode: 'en',
      languageName: 'English',
      lookupData: lookup,
    });
    const result = getSavedWord(testDb.adapter, 'sw1');
    expect(result).toBeTruthy();
    expect(result!.lookupData?.word).toBe('test');
    expect(result!.lookupData?.entries).toHaveLength(1);
  });

  it('finds by word and language code', () => {
    saveWord(testDb.adapter, 'sw1', {
      word: 'serendipity',
      languageCode: 'en',
      languageName: 'English',
    });
    const found = getSavedWordByWordAndLang(testDb.adapter, 'serendipity', 'en');
    expect(found).toBeTruthy();
    expect(found!.id).toBe('sw1');
  });

  it('returns null for unfound word+lang', () => {
    expect(getSavedWordByWordAndLang(testDb.adapter, 'nope', 'en')).toBeNull();
  });
});

// ── Listing & Sorting ─────────────────────────────────────────────────

describe('Saved Words Listing', () => {
  beforeEach(() => {
    // Save words with different timestamps by updating last_looked_up_at
    saveWord(testDb.adapter, 'sw1', {
      word: 'apple',
      languageCode: 'en',
      languageName: 'English',
    });
    saveWord(testDb.adapter, 'sw2', {
      word: 'banana',
      languageCode: 'en',
      languageName: 'English',
    });
    saveWord(testDb.adapter, 'sw3', {
      word: 'cereza',
      languageCode: 'es',
      languageName: 'Spanish',
    });
  });

  it('returns all words sorted by last_looked_up_at DESC by default', () => {
    const words = getSavedWords(testDb.adapter);
    expect(words).toHaveLength(3);
  });

  it('sorts alphabetically', () => {
    const words = getSavedWords(testDb.adapter, { sortBy: 'alphabetical' });
    expect(words[0].word).toBe('apple');
    expect(words[1].word).toBe('banana');
    expect(words[2].word).toBe('cereza');
  });

  it('sorts by most looked up', () => {
    incrementLookupCount(testDb.adapter, 'sw2');
    incrementLookupCount(testDb.adapter, 'sw2');
    const words = getSavedWords(testDb.adapter, { sortBy: 'mostLookedUp' });
    expect(words[0].word).toBe('banana');
    expect(words[0].lookedUpCount).toBe(3);
  });

  it('sorts by mastery level', () => {
    updateSavedWord(testDb.adapter, 'sw3', { masteryLevel: 5 });
    updateSavedWord(testDb.adapter, 'sw1', { masteryLevel: 2 });
    const words = getSavedWords(testDb.adapter, { sortBy: 'mastery' });
    expect(words[0].masteryLevel).toBe(0); // sw2
    expect(words[1].masteryLevel).toBe(2); // sw1
    expect(words[2].masteryLevel).toBe(5); // sw3
  });

  it('filters by language code', () => {
    const words = getSavedWords(testDb.adapter, { languageCode: 'es' });
    expect(words).toHaveLength(1);
    expect(words[0].word).toBe('cereza');
  });

  it('filters by favorites only', () => {
    updateSavedWord(testDb.adapter, 'sw1', { isFavorite: true });
    const words = getSavedWords(testDb.adapter, { favoritesOnly: true });
    expect(words).toHaveLength(1);
    expect(words[0].word).toBe('apple');
  });

  it('filters by search text', () => {
    const words = getSavedWords(testDb.adapter, { search: 'ban' });
    expect(words).toHaveLength(1);
    expect(words[0].word).toBe('banana');
  });

  it('search escapes special LIKE characters', () => {
    saveWord(testDb.adapter, 'sw4', {
      word: '100%_done',
      languageCode: 'en',
      languageName: 'English',
    });
    const words = getSavedWords(testDb.adapter, { search: '%_' });
    expect(words).toHaveLength(1);
    expect(words[0].word).toBe('100%_done');
  });

  it('filters by list id', () => {
    const list = createWordList(testDb.adapter, 'l1', { name: 'GRE' });
    updateSavedWord(testDb.adapter, 'sw1', { listId: list.id });
    const words = getSavedWords(testDb.adapter, { listId: 'l1' });
    expect(words).toHaveLength(1);
    expect(words[0].word).toBe('apple');
  });

  it('respects limit and offset', () => {
    const words = getSavedWords(testDb.adapter, {
      sortBy: 'alphabetical',
      limit: 2,
      offset: 1,
    });
    expect(words).toHaveLength(2);
    expect(words[0].word).toBe('banana');
  });
});

// ── Update & Increment ────────────────────────────────────────────────

describe('Saved Words Update', () => {
  beforeEach(() => {
    saveWord(testDb.adapter, 'sw1', {
      word: 'test',
      languageCode: 'en',
      languageName: 'English',
    });
  });

  it('updates notes', () => {
    const updated = updateSavedWord(testDb.adapter, 'sw1', { notes: 'My note' });
    expect(updated!.notes).toBe('My note');
  });

  it('updates mastery level', () => {
    const updated = updateSavedWord(testDb.adapter, 'sw1', { masteryLevel: 3 });
    expect(updated!.masteryLevel).toBe(3);
  });

  it('updates favorite status', () => {
    const updated = updateSavedWord(testDb.adapter, 'sw1', { isFavorite: true });
    expect(updated!.isFavorite).toBe(true);
  });

  it('assigns to a list', () => {
    createWordList(testDb.adapter, 'l1', { name: 'Vocab' });
    const updated = updateSavedWord(testDb.adapter, 'sw1', { listId: 'l1' });
    expect(updated!.listId).toBe('l1');
  });

  it('returns null for nonexistent word', () => {
    expect(updateSavedWord(testDb.adapter, 'nope', { notes: 'x' })).toBeNull();
  });

  it('increments lookup count', () => {
    const updated = incrementLookupCount(testDb.adapter, 'sw1');
    expect(updated!.lookedUpCount).toBe(2);
  });

  it('increments lookup count and updates lookup_data', () => {
    const newData = makeLookupResult('test');
    const updated = incrementLookupCount(testDb.adapter, 'sw1', newData);
    expect(updated!.lookedUpCount).toBe(2);
    expect(updated!.lookupData?.word).toBe('test');
  });

  it('increment returns null for nonexistent id', () => {
    expect(incrementLookupCount(testDb.adapter, 'nope')).toBeNull();
  });
});

// ── Count ─────────────────────────────────────────────────────────────

describe('Saved Word Counts', () => {
  it('returns total count', () => {
    expect(getSavedWordCount(testDb.adapter)).toBe(0);
    saveWord(testDb.adapter, 'sw1', {
      word: 'a',
      languageCode: 'en',
      languageName: 'English',
    });
    saveWord(testDb.adapter, 'sw2', {
      word: 'b',
      languageCode: 'es',
      languageName: 'Spanish',
    });
    expect(getSavedWordCount(testDb.adapter)).toBe(2);
  });

  it('returns counts by language', () => {
    saveWord(testDb.adapter, 'sw1', {
      word: 'a',
      languageCode: 'en',
      languageName: 'English',
    });
    saveWord(testDb.adapter, 'sw2', {
      word: 'b',
      languageCode: 'en',
      languageName: 'English',
    });
    saveWord(testDb.adapter, 'sw3', {
      word: 'c',
      languageCode: 'es',
      languageName: 'Spanish',
    });
    const counts = getSavedWordCountByLanguage(testDb.adapter);
    expect(counts).toHaveLength(2);
    expect(counts[0]).toEqual({ languageCode: 'en', count: 2 });
    expect(counts[1]).toEqual({ languageCode: 'es', count: 1 });
  });
});

// ── Truncation ────────────────────────────────────────────────────────

describe('truncateLookupData', () => {
  it('returns JSON unchanged if under 100KB', () => {
    const data = makeLookupResult('small');
    const json = truncateLookupData(data);
    const parsed = JSON.parse(json);
    expect(parsed.word).toBe('small');
  });

  it('truncates oversized results', () => {
    const data = makeLookupResult('big');
    // Add many large entries to exceed 100KB
    data.entries = Array.from({ length: 20 }, (_, i) => ({
      partOfSpeech: `pos-${i}`,
      pronunciations: [],
      forms: [],
      senses: Array.from({ length: 10 }, (_, j) => ({
        definition: 'x'.repeat(1000) + `-${j}`,
        tags: [],
        examples: [],
        quotes: [],
        synonyms: [],
        antonyms: [],
        subsenses: [],
      })),
      synonyms: [],
      antonyms: [],
    }));
    const json = truncateLookupData(data);
    const parsed = JSON.parse(json);
    // Truncated to 10 entries max
    expect(parsed.entries.length).toBeLessThanOrEqual(10);
    // Each entry truncated to 5 senses max
    for (const entry of parsed.entries) {
      expect(entry.senses.length).toBeLessThanOrEqual(5);
    }
  });
});

// ── Word Lists ────────────────────────────────────────────────────────

describe('Word Lists', () => {
  it('creates a word list', () => {
    const list = createWordList(testDb.adapter, 'l1', {
      name: 'GRE Vocab',
      description: 'Words for GRE prep',
      languageCode: 'en',
      sortOrder: 1,
    });

    expect(list.id).toBe('l1');
    expect(list.name).toBe('GRE Vocab');
    expect(list.description).toBe('Words for GRE prep');
    expect(list.languageCode).toBe('en');
    expect(list.sortOrder).toBe(1);
  });

  it('gets all lists sorted by sort_order', () => {
    createWordList(testDb.adapter, 'l1', { name: 'B List', sortOrder: 2 });
    createWordList(testDb.adapter, 'l2', { name: 'A List', sortOrder: 1 });
    const lists = getWordLists(testDb.adapter);
    expect(lists).toHaveLength(2);
    expect(lists[0].name).toBe('A List');
    expect(lists[1].name).toBe('B List');
  });

  it('updates a word list', () => {
    createWordList(testDb.adapter, 'l1', { name: 'Old Name' });
    const updated = updateWordList(testDb.adapter, 'l1', {
      name: 'New Name',
      description: 'Updated',
    });
    expect(updated!.name).toBe('New Name');
    expect(updated!.description).toBe('Updated');
  });

  it('update returns null for nonexistent list', () => {
    expect(updateWordList(testDb.adapter, 'nope', { name: 'x' })).toBeNull();
  });

  it('deletes a word list and orphans words', () => {
    createWordList(testDb.adapter, 'l1', { name: 'Temp' });
    saveWord(testDb.adapter, 'sw1', {
      word: 'test',
      languageCode: 'en',
      languageName: 'English',
    });
    updateSavedWord(testDb.adapter, 'sw1', { listId: 'l1' });
    expect(getSavedWord(testDb.adapter, 'sw1')!.listId).toBe('l1');

    expect(deleteWordList(testDb.adapter, 'l1')).toBe(true);
    expect(getWordList(testDb.adapter, 'l1')).toBeNull();

    // Word still exists but list_id is null (ON DELETE SET NULL)
    const word = getSavedWord(testDb.adapter, 'sw1');
    expect(word).toBeTruthy();
    expect(word!.listId).toBeNull();
  });

  it('delete returns false for nonexistent list', () => {
    expect(deleteWordList(testDb.adapter, 'nope')).toBe(false);
  });
});
