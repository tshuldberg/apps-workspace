import { useState, useEffect, useCallback } from 'react';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  createEntry,
  getDecryptedEntry,
  getJournalStats,
  getReflectionsForBook,
  exportJournalToMarkdown,
  getJournalEntries,
  deleteJournalEntry,
  searchJournalEntries,
  addJournalPhoto,
  getPhotosForEntry,
  removeJournalPhoto,
  getLinkedBooks,
  type JournalEntry,
  type JournalStats,
  type CreateEntryOptions,
  type JournalPhoto,
  type Book,
} from '@mylife/books';

export function useJournal() {
  const db = useDatabase();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [stats, setStats] = useState<JournalStats | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    try {
      setLoading(true);
      setEntries(getJournalEntries(db));
      setStats(getJournalStats(db));
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    async (content: string, options?: CreateEntryOptions) => {
      await createEntry(db, content, options);
      refresh();
    },
    [db, refresh],
  );

  const decrypt = useCallback(
    async (entryId: string, passphrase?: string) => {
      return getDecryptedEntry(db, entryId, passphrase);
    },
    [db],
  );

  const getForBook = useCallback(
    (bookId: string) => {
      return getReflectionsForBook(db, bookId);
    },
    [db],
  );

  const search = useCallback(
    (query: string) => {
      const results = searchJournalEntries(db, query);
      setEntries(results);
    },
    [db],
  );

  const remove = useCallback(
    (id: string) => {
      deleteJournalEntry(db, id);
      refresh();
    },
    [db, refresh],
  );

  const addPhoto = useCallback(
    (entryId: string, uri: string) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
      addJournalPhoto(db, id, { entry_id: entryId, file_path: uri });
    },
    [db],
  );

  const getPhotos = useCallback(
    (entryId: string): JournalPhoto[] => {
      return getPhotosForEntry(db, entryId);
    },
    [db],
  );

  const removePhoto = useCallback(
    (photoId: string) => {
      removeJournalPhoto(db, photoId);
    },
    [db],
  );

  const exportMarkdown = useCallback(
    (entryIds?: string[]) => {
      return exportJournalToMarkdown(db, entryIds);
    },
    [db],
  );

  const linkedBooks = useCallback(
    (entryId: string): Book[] => {
      return getLinkedBooks(db, entryId);
    },
    [db],
  );

  return {
    entries,
    stats,
    loading,
    refresh,
    create,
    decrypt,
    getForBook,
    search,
    remove,
    addPhoto,
    getPhotos,
    removePhoto,
    exportMarkdown,
    linkedBooks,
  };
}
