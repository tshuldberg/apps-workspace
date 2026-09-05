import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetMyWordsServiceCacheForTests,
  browseWordsAlphabetically,
  getMyWordsLanguages,
  lookupWord,
  suggestWordReplacements,
} from '../service';

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } });
}

describe('@mylife/words', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    __resetMyWordsServiceCacheForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads languages and caches response', async () => {
    const fetchMock = vi.fn(async () => json([
      { code: 'es', name: 'Spanish', words: 200 },
      { code: 'en', name: 'English', words: 300 },
    ]));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const first = await getMyWordsLanguages();
    const second = await getMyWordsLanguages();

    expect(first[0]?.code).toBe('en');
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('adds datamuse fallback terms for english lookup', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/entries/en/bright')) {
        return json({
          word: 'bright',
          entries: [{
            language: { code: 'en', name: 'English' },
            partOfSpeech: 'adjective',
            pronunciations: [{ text: '/brait/' }],
            forms: [{ word: 'brighter' }],
            senses: [{ definition: 'full of light', synonyms: ['luminous'], antonyms: ['dark'] }],
          }],
        });
      }
      if (url.includes('rel_syn=bright')) return json([{ word: 'radiant' }]);
      if (url.includes('rel_ant=bright')) return json([{ word: 'dim' }]);
      throw new Error(`unexpected ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const result = await lookupWord({ languageCode: 'en', word: 'bright' });
    expect(result?.providers).toEqual(['freeDictionaryApi', 'datamuse']);
    expect(result?.synonyms).toEqual(['luminous', 'radiant']);
    expect(result?.antonyms).toEqual(['dark', 'dim']);
  });

  it('preserves pronunciations, forms, quotes, and subsenses from dictionary payload', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/entries/fr/temps')) {
        return json({
          word: 'temps',
          entries: [{
            language: { code: 'fr', name: 'French' },
            partOfSpeech: 'noun',
            pronunciations: [{ text: '/tɑ̃/', type: 'ipa', tags: ['standard'] }],
            forms: [{ word: 'tempss', tags: ['plural'] }],
            senses: [{
              definition: 'Durée considérée comme une succession de moments.',
              tags: ['masculine'],
              examples: ['Le temps passe vite.'],
              quotes: [{ text: 'Le temps est un grand maître.', reference: 'Corneille' }],
              synonyms: ['durée'],
              antonyms: ['instant'],
              subsenses: [{
                definition: 'Époque déterminée.',
                tags: ['figurative'],
                examples: [],
                quotes: [],
                synonyms: ['période'],
                antonyms: [],
                subsenses: [],
              }],
            }],
            synonyms: ['moment'],
            antonyms: [],
          }],
        });
      }
      throw new Error(`unexpected ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const result = await lookupWord({ languageCode: 'fr', word: 'temps' });
    expect(result?.entries[0]?.pronunciations[0]).toEqual({ text: '/tɑ̃/', type: 'ipa', tags: ['standard'] });
    expect(result?.entries[0]?.forms[0]).toEqual({ word: 'tempss', tags: ['plural'] });
    expect(result?.entries[0]?.senses[0]?.quotes[0]).toEqual({ text: 'Le temps est un grand maître.', reference: 'Corneille' });
    expect(result?.entries[0]?.senses[0]?.subsenses[0]?.definition).toBe('Époque déterminée.');
    expect(result?.synonyms).toEqual(['moment', 'durée', 'période']);
    expect(result?.antonyms).toEqual(['instant']);
  });

  it('enriches english lookups with word history, first known use, rhymes, and nearby words', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/entries/en/anachronism')) {
        return json({
          word: 'anachronism',
          entries: [{
            language: { code: 'en', name: 'English' },
            partOfSpeech: 'noun',
            pronunciations: [{ text: '/əˈnæ.kɹə.nɪ.z(ə)m/' }],
            forms: [{ word: 'anachronisms', tags: ['plural'] }],
            senses: [{
              definition: 'A chronological mistake. [from 17th c.]',
              tags: ['countable'],
              examples: [],
              quotes: [],
              synonyms: ['chronological error'],
              antonyms: [],
              subsenses: [],
            }],
          }],
        });
      }
      if (url.includes('/words?rel_syn=anachronism')) return json([]);
      if (url.includes('/words?rel_ant=anachronism')) return json([]);
      if (url.includes('/words?rel_rhy=anachronism')) return json([{ word: 'parachronism' }]);
      if (url.includes('en.wiktionary.org/w/api.php') && url.includes('prop=sections')) {
        return json({
          parse: {
            sections: [
              { line: 'English', index: '1', level: '2', toclevel: 1 },
              { line: 'Etymology', index: '2', level: '3', toclevel: 2 },
              { line: 'Related terms', index: '5', level: '4', toclevel: 3 },
            ],
          },
        });
      }
      if (url.includes('en.wiktionary.org/w/api.php') && url.includes('section=2')) {
        return json({
          parse: {
            text: {
              '*': '<div><h3 id="Etymology">Etymology</h3><p>From New Latin anachronismus, from Ancient Greek.</p></div>',
            },
          },
        });
      }
      if (url.includes('en.wiktionary.org/w/api.php') && url.includes('section=5')) {
        return json({
          parse: {
            text: {
              '*': '<div><ul><li><a href="/wiki/anachronic">anachronic</a></li><li><a href="/wiki/anachronistic">anachronistic</a></li></ul></div>',
            },
          },
        });
      }
      throw new Error(`unexpected ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const result = await lookupWord({ languageCode: 'en', word: 'anachronism' });
    expect(result?.wordHistory?.[0]).toContain('New Latin');
    expect(result?.didYouKnow).toContain('New Latin');
    expect(result?.chronology).toEqual(['17th century']);
    expect(result?.firstKnownUse).toContain('17th century');
    expect(result?.wordFamily).toContain('anachronic');
    expect(result?.rhymes).toContain('parachronism');
    expect(result?.nearbyWords).toEqual(['anachronic', 'anachronistic']);
    expect(result?.providers).toContain('wiktionaryApi');
  });

  it('returns null for unknown words', async () => {
    const fetchMock = vi.fn(async () => json({ error: 'No entries found' }, 404));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const result = await lookupWord({ languageCode: 'fr', word: 'zzz-not-found' });
    expect(result).toBeNull();
  });

  it('browses english words alphabetically with pagination and cache', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/words?sp=a*&max=1000')) {
        return json([{ word: 'azure' }, { word: 'amber' }, { word: 'azure' }, { word: 'arc' }]);
      }
      throw new Error(`unexpected ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const first = await browseWordsAlphabetically({ languageCode: 'en', letter: 'a', page: 1, pageSize: 2 });
    const second = await browseWordsAlphabetically({ languageCode: 'en', letter: 'A', page: 2, pageSize: 2 });

    expect(first.supported).toBe(true);
    expect(first.total).toBe(3);
    expect(first.words).toEqual(['amber', 'arc']);
    expect(second.words).toEqual(['azure']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns unsupported response for non-english alphabetical browse', async () => {
    const fetchMock = vi.fn(async () => json([]));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const result = await browseWordsAlphabetically({ languageCode: 'es', letter: 'b' });
    expect(result.supported).toBe(false);
    expect(result.words).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it('rejects invalid browse letters', async () => {
    const fetchMock = vi.fn(async () => json([]));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    await expect(
      browseWordsAlphabetically({ languageCode: 'en', letter: 'ab' }),
    ).rejects.toThrow('Letter must be A-Z.');
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it('suggests context-aware sentence replacements for english', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/entries/en/bright')) {
        return json({
          word: 'bright',
          entries: [{
            language: { code: 'en', name: 'English' },
            partOfSpeech: 'adjective',
            pronunciations: [{ text: '/brait/' }],
            forms: [{ word: 'brighter' }],
            senses: [{
              definition: 'full of light',
              synonyms: ['luminous', 'radiant', 'vivid'],
              antonyms: ['dark'],
            }],
          }],
        });
      }
      if (url.includes('/words?ml=bright') && url.includes('lc=the') && url.includes('rc=sun')) {
        return json([
          { word: 'radiant', score: 990 },
          { word: 'vivid', score: 760 },
        ]);
      }
      if (url.includes('/words?rel_syn=bright')) return json([]);
      if (url.includes('/words?rel_ant=bright')) return json([]);
      if (url.includes('/words?rel_rhy=bright')) return json([]);
      throw new Error(`unexpected ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const result = await suggestWordReplacements({
      languageCode: 'en',
      sentence: 'The bright sun warmed the room.',
      targetWord: 'bright',
      maxSuggestions: 3,
    });

    expect(result.supported).toBe(true);
    expect(result.suggestions[0]?.replacement).toBe('radiant');
    expect(result.suggestions[0]?.replacedSentence).toBe('The radiant sun warmed the room.');
    expect(result.providers).toContain('datamuse');
  });

  it('throws when selected word is not in sentence', async () => {
    await expect(
      suggestWordReplacements({
        languageCode: 'en',
        sentence: 'The sky is blue.',
        targetWord: 'green',
      }),
    ).rejects.toThrow('Selected word must appear in the sentence.');
  });
});
