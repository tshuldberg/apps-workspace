import { useState, useEffect, useCallback } from 'react';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';
import {
  getEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  getRsvpSummary,
  type Event,
  type RsvpSummary,
} from '@mylife/rsvp';

export interface EventWithSummary {
  event: Event;
  summary: RsvpSummary;
}

export function useEvents(opts?: { includePast?: boolean }) {
  const db = useDatabase();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(() => {
    try {
      setLoading(true);
      const result = getEvents(db, { includePast: opts?.includePast });
      setEvents(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [db, opts?.includePast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    (input: Parameters<typeof createEvent>[2]): string => {
      const id = uuid();
      createEvent(db, id, input);
      refresh();
      return id;
    },
    [db, refresh],
  );

  const update = useCallback(
    (id: string, updates: Parameters<typeof updateEvent>[2]) => {
      updateEvent(db, id, updates);
      refresh();
    },
    [db, refresh],
  );

  const remove = useCallback(
    (id: string) => {
      deleteEvent(db, id);
      refresh();
    },
    [db, refresh],
  );

  return { events, loading, error, refresh, create, update, remove };
}

export function useEvent(id: string | undefined) {
  const db = useDatabase();
  const [event, setEvent] = useState<Event | null>(null);
  const [summary, setSummary] = useState<RsvpSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!id) {
      setEvent(null);
      setSummary(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setEvent(getEventById(db, id));
      setSummary(getRsvpSummary(db, id));
    } finally {
      setLoading(false);
    }
  }, [db, id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { event, summary, loading, refresh };
}
