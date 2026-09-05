import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';
import {
  createReaderNote,
  deleteReaderNote,
  getReaderNotes,
  updateReaderNote,
  type ReaderDocumentNote,
  type ReaderDocumentNoteInsert,
} from '@mylife/books';

export function useReaderNotes(documentId: string | undefined) {
  const db = useDatabase();
  const [notes, setNotes] = useState<ReaderDocumentNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(() => {
    if (!documentId) {
      setNotes([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setNotes(getReaderNotes(db, documentId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [db, documentId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback((input: Omit<ReaderDocumentNoteInsert, 'document_id'>) => {
    if (!documentId) {
      throw new Error('documentId is required to create a note.');
    }
    const note = createReaderNote(db, uuid(), {
      ...input,
      document_id: documentId,
    });
    refresh();
    return note;
  }, [db, documentId, refresh]);

  const update = useCallback((
    id: string,
    updates: Partial<Pick<ReaderDocumentNote, 'note_type' | 'selection_start' | 'selection_end' | 'selected_text' | 'note_text' | 'color'>>,
  ) => {
    updateReaderNote(db, id, updates);
    refresh();
  }, [db, refresh]);

  const remove = useCallback((id: string) => {
    deleteReaderNote(db, id);
    refresh();
  }, [db, refresh]);

  const highlights = useMemo(
    () => notes.filter((n) => n.note_type === 'highlight'),
    [notes],
  );

  const getForDocument = useCallback(
    (docId: string): ReaderDocumentNote[] => {
      return getReaderNotes(db, docId);
    },
    [db],
  );

  return {
    notes,
    highlights,
    loading,
    error,
    refresh,
    create,
    update,
    remove,
    getForDocument,
  };
}
