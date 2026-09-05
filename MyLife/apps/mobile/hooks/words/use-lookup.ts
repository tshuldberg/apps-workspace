import { useState, useCallback, useRef } from 'react';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  lookupWordWithFallback,
  getMyWordsLanguages,
  getCachePrefixMatches,
  getSavedWordByWordAndLang,
  saveWord,
  unsaveWord,
  incrementLookupCount,
  type MyWordsLanguage,
  type MyWordsLookupResult,
  type OfflineLookupResult,
  type OfflineLookupSource,
} from '@mylife/words';
import { uuid } from '../../lib/uuid';

const DEFAULT_LANGUAGES: MyWordsLanguage[] = [
  { code: 'en', name: 'English', words: 0 },
  { code: 'es', name: 'Spanish', words: 0 },
  { code: 'fr', name: 'French', words: 0 },
  { code: 'de', name: 'German', words: 0 },
  { code: 'it', name: 'Italian', words: 0 },
  { code: 'pt', name: 'Portuguese', words: 0 },
  { code: 'ru', name: 'Russian', words: 0 },
  { code: 'ja', name: 'Japanese', words: 0 },
  { code: 'ko', name: 'Korean', words: 0 },
  { code: 'zh', name: 'Chinese', words: 0 },
];

const SUGGESTION_DEBOUNCE_MS = 300;

export function useWordsLookup() {
  const db = useDatabase();
  const [query, setQuery] = useState('');
  const [languageCode, setLanguageCode] = useState('en');
  const [languages, setLanguages] = useState<MyWordsLanguage[]>([]);
  const [result, setResult] = useState<MyWordsLookupResult | null>(null);
  const [source, setSource] = useState<OfflineLookupSource | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isOnline] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadLanguages = useCallback(async () => {
    try {
      const langs = await getMyWordsLanguages();
      setLanguages(langs);
    } catch {
      setLanguages(DEFAULT_LANGUAGES);
    }
  }, []);

  const lookup = useCallback(
    async (word: string, lang: string) => {
      if (!word.trim()) return;
      try {
        setLoading(true);
        setError(null);

        // Check if already saved -- increment lookup count if so
        const existing = getSavedWordByWordAndLang(db, word.trim(), lang);
        if (existing) {
          incrementLookupCount(db, existing.id);
        }

        const offlineResult: OfflineLookupResult | null =
          await lookupWordWithFallback(db, { word: word.trim(), languageCode: lang }, isOnline);

        if (offlineResult) {
          setResult(offlineResult.result);
          setSource(offlineResult.source);
        } else {
          setResult(null);
          setSource(null);
          setError(new Error(`No results found for "${word.trim()}"`));
        }
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
        setResult(null);
        setSource(null);
      } finally {
        setLoading(false);
      }
    },
    [db, isOnline],
  );

  const getSuggestions = useCallback(
    (prefix: string, lang: string): Promise<string[]> => {
      return new Promise((resolve) => {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }
        debounceRef.current = setTimeout(() => {
          if (!prefix.trim()) {
            resolve([]);
            return;
          }
          try {
            const matches = getCachePrefixMatches(db, prefix.trim(), lang, 8);
            resolve(matches);
          } catch {
            resolve([]);
          }
        }, SUGGESTION_DEBOUNCE_MS);
      });
    },
    [db],
  );

  const checkSaved = useCallback(
    (word: string, lang: string) => {
      return getSavedWordByWordAndLang(db, word, lang);
    },
    [db],
  );

  const toggleSave = useCallback(
    (
      word: string,
      lang: string,
      lookupResult: MyWordsLookupResult | null,
      languageName: string,
    ) => {
      const existing = getSavedWordByWordAndLang(db, word, lang);
      if (existing) {
        unsaveWord(db, existing.id);
        return null;
      }

      const firstEntry = lookupResult?.entries?.[0];
      const firstSense = firstEntry?.senses?.[0];

      return saveWord(db, uuid(), {
        word,
        languageCode: lang,
        languageName,
        definitionSummary: firstSense?.definition ?? null,
        partOfSpeech: firstEntry?.partOfSpeech ?? null,
        pronunciationText: firstEntry?.pronunciations?.[0]?.text ?? null,
        lookupData: lookupResult ?? undefined,
      });
    },
    [db],
  );

  return {
    query,
    setQuery,
    languageCode,
    setLanguageCode,
    languages,
    result,
    source,
    loading,
    error,
    lookup,
    getSuggestions,
    checkSaved,
    toggleSave,
    loadLanguages,
  };
}
