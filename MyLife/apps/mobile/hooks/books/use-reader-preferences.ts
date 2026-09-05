import { useCallback, useEffect, useState } from 'react';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  getReaderPreferences,
  upsertReaderPreferences,
  type ReaderDocumentPreference,
  type ReaderDocumentPreferenceInsert,
} from '@mylife/books';

export function useReaderPreferences(documentId: string | undefined) {
  const db = useDatabase();
  const [preferences, setPreferences] = useState<ReaderDocumentPreference | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!documentId) {
      setPreferences(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setPreferences(getReaderPreferences(db, documentId));
    } finally {
      setLoading(false);
    }
  }, [db, documentId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = useCallback((
    updates: Omit<ReaderDocumentPreferenceInsert, 'document_id'>,
  ) => {
    if (!documentId) {
      throw new Error('documentId is required to save preferences.');
    }
    const result = upsertReaderPreferences(db, {
      document_id: documentId,
      ...updates,
    });
    setPreferences(result);
    return result;
  }, [db, documentId]);

  return {
    preferences,
    loading,
    refresh,
    save,
  };
}
