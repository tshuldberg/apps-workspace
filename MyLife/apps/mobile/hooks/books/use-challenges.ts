import { useState, useEffect, useCallback } from 'react';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';
import {
  getActiveChallengeStatuses,
  getAllChallenges,
  createChallenge,
  deactivateChallenge,
  deleteChallenge,
  type ChallengeStatus,
  type Challenge,
  type ChallengeInsert,
} from '@mylife/books';

export function useChallenges() {
  const db = useDatabase();
  const [activeStatuses, setActiveStatuses] = useState<ChallengeStatus[]>([]);
  const [allChallenges, setAllChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    try {
      setLoading(true);
      setActiveStatuses(getActiveChallengeStatuses(db));
      setAllChallenges(getAllChallenges(db));
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
    (input: ChallengeInsert) => {
      const id = uuid();
      createChallenge(db, id, input);
      refresh();
    },
    [db, refresh],
  );

  const deactivate = useCallback(
    (id: string) => {
      deactivateChallenge(db, id);
      refresh();
    },
    [db, refresh],
  );

  const remove = useCallback(
    (id: string) => {
      deleteChallenge(db, id);
      refresh();
    },
    [db, refresh],
  );

  return { activeStatuses, allChallenges, loading, refresh, create, deactivate, remove };
}
