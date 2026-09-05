import { useState, useEffect, useCallback } from 'react';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';
import {
  updateProgress,
  getReadingSpeed,
  getProgressTimeline,
  getLatestProgress,
  getProgressHistory,
  startTimedSession,
  stopTimedSession,
  getTimedSessionsForBook,
  type ReadingSpeed,
  type ProgressTimelineEntry,
} from '@mylife/books';

export function useProgress(bookId: string) {
  const db = useDatabase();
  const [speed, setSpeed] = useState<ReadingSpeed | null>(null);
  const [timeline, setTimeline] = useState<ProgressTimelineEntry[]>([]);
  const [latestPage, setLatestPage] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    try {
      setLoading(true);
      const s = getReadingSpeed(db, bookId);
      setSpeed(s);
      const t = getProgressTimeline(db, bookId);
      setTimeline(t);
      const latest = getLatestProgress(db, bookId);
      setLatestPage(latest?.page_number ?? null);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [db, bookId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logProgress = useCallback(
    (page: number, pageCount: number | null) => {
      const sessionId = uuid();
      updateProgress(db, bookId, sessionId, page, pageCount ?? 0);
      refresh();
    },
    [db, bookId, refresh],
  );

  const startTimer = useCallback(
    (sessionId: string) => {
      const id = uuid();
      startTimedSession(db, id, {
        book_id: bookId,
        session_id: sessionId,
        started_at: new Date().toISOString(),
      });
      refresh();
    },
    [db, bookId, refresh],
  );

  const stopTimer = useCallback(
    (timedSessionId: string, endPage?: number) => {
      stopTimedSession(db, timedSessionId, endPage);
      refresh();
    },
    [db, refresh],
  );

  return { speed, timeline, latestPage, loading, refresh, logProgress, startTimer, stopTimer };
}
