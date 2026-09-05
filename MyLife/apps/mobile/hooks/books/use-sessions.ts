import { useState, useEffect, useCallback } from 'react';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';
import {
  getSessions,
  getSessionsForBook,
  getCurrentlyReading,
  createSession,
  updateSession,
  startReading,
  finishReading,
  markDNF,
  getBook,
  getSession as getSessionById,
  updateCommunityProgress,
  type ReadingSession,
  type ReadingSessionInsert,
} from '@mylife/books';

export function useSessions(bookId?: string) {
  const db = useDatabase();
  const [sessions, setSessions] = useState<ReadingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(() => {
    try {
      setLoading(true);
      const result = bookId
        ? getSessionsForBook(db, bookId)
        : getSessions(db);
      setSessions(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [db, bookId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    (input: ReadingSessionInsert): ReadingSession => {
      const id = uuid();
      const session = createSession(db, id, input);
      refresh();
      return session;
    },
    [db, refresh],
  );

  const start = useCallback(
    (sessionId: string) => {
      startReading(db, sessionId);
      refresh();
    },
    [db, refresh],
  );

  const finish = useCallback(
    (sessionId: string) => {
      finishReading(db, sessionId);
      // Wire community challenge progress
      try {
        const session = getSessionById(db, sessionId);
        if (session) {
          const book = getBook(db, session.book_id);
          updateCommunityProgress(db, session.book_id, book?.page_count ?? undefined);
        }
      } catch {
        // Community progress is non-critical -- don't block the finish flow
      }
      refresh();
    },
    [db, refresh],
  );

  const updateProgress = useCallback(
    (sessionId: string, currentPage: number) => {
      updateSession(db, sessionId, { current_page: currentPage });
      refresh();
    },
    [db, refresh],
  );

  const setDNF = useCallback(
    (sessionId: string, reason?: string) => {
      markDNF(db, sessionId, reason);
      refresh();
    },
    [db, refresh],
  );

  return { sessions, loading, error, refresh, create, start, finish, updateProgress, setDNF };
}

export function useCurrentlyReading() {
  const db = useDatabase();
  const [sessions, setSessions] = useState<ReadingSession[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    try {
      setLoading(true);
      setSessions(getCurrentlyReading(db));
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { sessions, loading, refresh };
}
