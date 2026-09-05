import { useState, useEffect, useCallback } from 'react';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  addContentWarning,
  removeContentWarning,
  getContentWarningsForBook,
  getDistinctWarnings,
  addMoodTag,
  removeMoodTag,
  getMoodTagsForBook,
  getDistinctMoodValues,
  type ContentWarning,
  type MoodTag,
} from '@mylife/books';

export function useContentWarnings(bookId: string) {
  const db = useDatabase();
  const [warnings, setWarnings] = useState<ContentWarning[]>([]);
  const [moods, setMoods] = useState<MoodTag[]>([]);
  const [distinctWarnings, setDistinctWarnings] = useState<string[]>([]);
  const [distinctMoods, setDistinctMoods] = useState<string[]>([]);
  const [distinctPaces, setDistinctPaces] = useState<string[]>([]);
  const [distinctGenres, setDistinctGenres] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    try {
      setLoading(true);
      setWarnings(getContentWarningsForBook(db, bookId));
      setMoods(getMoodTagsForBook(db, bookId));
      setDistinctWarnings(getDistinctWarnings(db));
      setDistinctMoods(getDistinctMoodValues(db, 'mood'));
      setDistinctPaces(getDistinctMoodValues(db, 'pace'));
      setDistinctGenres(getDistinctMoodValues(db, 'genre'));
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [db, bookId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addWarningTag = useCallback(
    (warning: string, severity?: 'mild' | 'moderate' | 'severe') => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
      addContentWarning(db, id, { book_id: bookId, warning, severity });
      refresh();
    },
    [db, bookId, refresh],
  );

  const removeWarningTag = useCallback(
    (warningId: string) => {
      removeContentWarning(db, warningId);
      refresh();
    },
    [db, refresh],
  );

  const addMood = useCallback(
    (type: 'mood' | 'pace' | 'genre', value: string) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
      addMoodTag(db, id, { book_id: bookId, tag_type: type, value });
      refresh();
    },
    [db, bookId, refresh],
  );

  const removeMood = useCallback(
    (moodId: string) => {
      removeMoodTag(db, moodId);
      refresh();
    },
    [db, refresh],
  );

  return {
    warnings,
    moods,
    distinctWarnings,
    distinctMoods,
    distinctPaces,
    distinctGenres,
    loading,
    refresh,
    addWarning: addWarningTag,
    removeWarning: removeWarningTag,
    addMood,
    removeMood,
  };
}
