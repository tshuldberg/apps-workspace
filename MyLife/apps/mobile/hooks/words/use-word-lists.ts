import { useState, useEffect, useCallback } from 'react';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';
import {
  getWordLists,
  createWordList,
  updateWordList,
  deleteWordList,
  getSavedWords,
  type WordList,
  type CreateWordListInput,
  type UpdateWordListInput,
} from '@mylife/words';

export interface WordListWithCount extends WordList {
  wordCount: number;
}

export function useWordLists() {
  const db = useDatabase();
  const [lists, setLists] = useState<WordListWithCount[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    try {
      setLoading(true);
      const allLists = getWordLists(db);
      const listsWithCounts: WordListWithCount[] = allLists.map((list) => {
        const wordsInList = getSavedWords(db, { listId: list.id, limit: 0 });
        return { ...list, wordCount: wordsInList.length };
      });
      setLists(listsWithCounts);
    } catch {
      // Keep existing state on error
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    (input: CreateWordListInput): WordList => {
      const list = createWordList(db, uuid(), input);
      refresh();
      return list;
    },
    [db, refresh],
  );

  const update = useCallback(
    (id: string, input: UpdateWordListInput) => {
      updateWordList(db, id, input);
      refresh();
    },
    [db, refresh],
  );

  const remove = useCallback(
    (id: string) => {
      deleteWordList(db, id);
      refresh();
    },
    [db, refresh],
  );

  return { lists, loading, refresh, create, update, remove };
}
