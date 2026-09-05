import { useState, useEffect, useCallback } from 'react';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';
import {
  getActiveClubs,
  getAllClubs,
  createClub,
  deleteClub,
  getClubProgress,
  setNextBook,
  createClubNote,
  getNotesForClub,
  getHistoryForClub,
  type BookClubInsert,
  type ClubWithProgress,
  type ClubNote,
  type ClubHistory,
} from '@mylife/books';

export function useClubs() {
  const db = useDatabase();
  const [clubs, setClubs] = useState<ClubWithProgress[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    try {
      setLoading(true);
      const active = getActiveClubs(db);
      const withProgress = active
        .map((club) => getClubProgress(db, club.id))
        .filter((c): c is ClubWithProgress => c !== null);
      setClubs(withProgress);
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
    (input: BookClubInsert) => {
      const id = uuid();
      createClub(db, id, input);
      refresh();
    },
    [db, refresh],
  );

  const remove = useCallback(
    (id: string) => {
      deleteClub(db, id);
      refresh();
    },
    [db, refresh],
  );

  const setBook = useCallback(
    (clubId: string, bookId: string, start?: string, end?: string) => {
      setNextBook(db, clubId, bookId, start, end);
      refresh();
    },
    [db, refresh],
  );

  const addNote = useCallback(
    (clubId: string, input: { book_id?: string | null; content: string }) => {
      const id = uuid();
      createClubNote(db, id, {
        club_id: clubId,
        book_id: input.book_id ?? null,
        content: input.content,
      });
    },
    [db],
  );

  const getNotes = useCallback(
    (clubId: string): ClubNote[] => {
      return getNotesForClub(db, clubId);
    },
    [db],
  );

  const getHistory = useCallback(
    (clubId: string): ClubHistory[] => {
      return getHistoryForClub(db, clubId);
    },
    [db],
  );

  return { clubs, loading, refresh, create, remove, setBook, addNote, getNotes, getHistory };
}
