import { useState, useEffect, useCallback } from 'react';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  getSavedWordCount,
  getSavedWordCountByLanguage,
  getDistinctPartsOfSpeech,
  advancedSearchSavedWords,
  updateSavedWord,
  unsaveWord,
  type GetSavedWordsOptions,
  type SavedWord,
  type AdvancedSearchFilters,
} from '@mylife/words';
import {
  getSavedWordsLightweight,
  type SavedWordLight,
} from '@mylife/words';

export function useSavedWords(options?: GetSavedWordsOptions) {
  const db = useDatabase();
  const [words, setWords] = useState<SavedWordLight[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [languageCounts, setLanguageCounts] = useState<
    Array<{ languageCode: string; count: number }>
  >([]);
  const [partsOfSpeech, setPartsOfSpeech] = useState<string[]>([]);

  const refresh = useCallback(() => {
    try {
      setLoading(true);
      const result = getSavedWordsLightweight(db, options);
      setWords(result);
      setTotalCount(getSavedWordCount(db));
      setLanguageCounts(getSavedWordCountByLanguage(db));
      setPartsOfSpeech(getDistinctPartsOfSpeech(db));
    } catch {
      // Keep existing state on error
    } finally {
      setLoading(false);
    }
  }, [
    db,
    options?.sortBy,
    options?.languageCode,
    options?.listId,
    options?.favoritesOnly,
    options?.search,
    options?.limit,
    options?.offset,
  ]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const loadMore = useCallback(
    (currentOffset: number) => {
      try {
        const moreWords = getSavedWordsLightweight(db, {
          ...options,
          offset: currentOffset,
        });
        setWords((prev) => [...prev, ...moreWords]);
      } catch {
        // Keep existing state on error
      }
    },
    [db, options],
  );

  const search = useCallback(
    (filters: AdvancedSearchFilters): SavedWord[] => {
      try {
        return advancedSearchSavedWords(db, filters);
      } catch {
        return [];
      }
    },
    [db],
  );

  const toggleFavorite = useCallback(
    (id: string, currentFavorite: boolean) => {
      updateSavedWord(db, id, { isFavorite: !currentFavorite });
      refresh();
    },
    [db, refresh],
  );

  const remove = useCallback(
    (id: string) => {
      unsaveWord(db, id);
      refresh();
    },
    [db, refresh],
  );

  return {
    words,
    loading,
    totalCount,
    languageCounts,
    partsOfSpeech,
    refresh,
    loadMore,
    search,
    toggleFavorite,
    remove,
  };
}
