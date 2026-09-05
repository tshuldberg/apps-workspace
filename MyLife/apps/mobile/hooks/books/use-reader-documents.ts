import { useCallback, useEffect, useState } from 'react';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';
import {
  createReaderDocument,
  deleteReaderDocument,
  getReaderDocument,
  getReaderDocuments,
  updateReaderDocument,
  updateReaderDocumentProgress,
  type ReaderDocument,
  type ReaderDocumentFilters,
  type ReaderDocumentInsert,
} from '@mylife/books';

export function useReaderDocuments(filters?: ReaderDocumentFilters) {
  const db = useDatabase();
  const [documents, setDocuments] = useState<ReaderDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(() => {
    try {
      setLoading(true);
      const result = getReaderDocuments(db, filters);
      setDocuments(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [
    db,
    filters?.book_id,
    filters?.search,
    filters?.sort_by,
    filters?.sort_dir,
    filters?.limit,
    filters?.offset,
  ]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback((input: ReaderDocumentInsert): ReaderDocument => {
    const document = createReaderDocument(db, uuid(), input);
    refresh();
    return document;
  }, [db, refresh]);

  const update = useCallback((
    id: string,
    updates: Partial<Omit<ReaderDocument, 'id' | 'created_at' | 'updated_at'>>,
  ) => {
    updateReaderDocument(db, id, updates);
    refresh();
  }, [db, refresh]);

  const updateProgress = useCallback((
    id: string,
    input: { current_position: number; progress_percent: number },
  ) => {
    updateReaderDocumentProgress(db, id, input);
    refresh();
  }, [db, refresh]);

  const remove = useCallback((id: string) => {
    deleteReaderDocument(db, id);
    refresh();
  }, [db, refresh]);

  return {
    documents,
    loading,
    error,
    refresh,
    create,
    update,
    updateProgress,
    remove,
  };
}

export function useReaderDocument(id: string | undefined) {
  const db = useDatabase();
  const [document, setDocument] = useState<ReaderDocument | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!id) {
      setDocument(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setDocument(getReaderDocument(db, id));
    } finally {
      setLoading(false);
    }
  }, [db, id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    document,
    loading,
    refresh,
  };
}
