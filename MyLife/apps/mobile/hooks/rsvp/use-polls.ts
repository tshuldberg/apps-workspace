import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';
import {
  getPollsByEvent,
  getPollVotes,
  createPoll,
  votePollOption,
  closePoll,
  type Poll,
  type PollVote,
} from '@mylife/rsvp';

export function usePolls(eventId: string | undefined) {
  const db = useDatabase();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => {
    if (!eventId) {
      setPolls([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setPolls(getPollsByEvent(db, eventId));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
      setTick((t) => t + 1);
    }
  }, [db, eventId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const votesById = useMemo(() => {
    const map = new Map<string, PollVote[]>();
    for (const poll of polls) {
      map.set(poll.id, getPollVotes(db, poll.id));
    }
    return map;
  }, [db, polls, tick]);

  const create = useCallback(
    (input: Parameters<typeof createPoll>[3]) => {
      if (!eventId) return;
      createPoll(db, uuid(), eventId, input);
      refresh();
    },
    [db, eventId, refresh],
  );

  const vote = useCallback(
    (pollId: string, input: Parameters<typeof votePollOption>[3]) => {
      votePollOption(db, uuid(), pollId, input);
      refresh();
    },
    [db, refresh],
  );

  const close = useCallback(
    (pollId: string) => {
      closePoll(db, pollId);
      refresh();
    },
    [db, refresh],
  );

  return { polls, votesById, loading, error, refresh, create, vote, close };
}
