import { useState, useEffect, useCallback } from 'react';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';
import {
  getTags,
  createTag,
  getTagsForBook,
  addTagToBook,
  removeTagFromBook,
  type Tag,
  type TagInsert,
} from '@mylife/books';

export function useTags() {
  const db = useDatabase();
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(() => {
    try {
      setLoading(true);
      setTags(getTags(db));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    (input: TagInsert): Tag => {
      const id = uuid();
      const tag = createTag(db, id, input);
      refresh();
      return tag;
    },
    [db, refresh],
  );

  return { tags, loading, error, refresh, create };
}

export function useBookTags(bookId: string | undefined) {
  const db = useDatabase();
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!bookId) {
      setTags([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setTags(getTagsForBook(db, bookId));
    } finally {
      setLoading(false);
    }
  }, [db, bookId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addTag = useCallback(
    (tagId: string) => {
      if (!bookId) return;
      addTagToBook(db, bookId, tagId);
      refresh();
    },
    [db, bookId, refresh],
  );

  const removeTag = useCallback(
    (tagId: string) => {
      if (!bookId) return;
      removeTagFromBook(db, bookId, tagId);
      refresh();
    },
    [db, bookId, refresh],
  );

  return { tags, loading, refresh, addTag, removeTag };
}
