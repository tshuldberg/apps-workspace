import { useState, useEffect, useCallback } from 'react';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';
import {
  getCommunityChallengesWithProgress,
  getPresetChallenges,
  joinChallenge,
  abandonParticipation,
  type CommunityChallengeWithProgress,
  type CommunityChallenge,
} from '@mylife/books';

export function useCommunityChallenge() {
  const db = useDatabase();
  const [challenges, setChallenges] = useState<CommunityChallengeWithProgress[]>([]);
  const [presets, setPresets] = useState<CommunityChallenge[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    try {
      setLoading(true);
      setChallenges(getCommunityChallengesWithProgress(db));
      setPresets(getPresetChallenges(db));
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const join = useCallback(
    (challengeId: string) => {
      const id = uuid();
      joinChallenge(db, id, challengeId);
      refresh();
    },
    [db, refresh],
  );

  const abandon = useCallback(
    (participationId: string) => {
      abandonParticipation(db, participationId);
      refresh();
    },
    [db, refresh],
  );

  return { challenges, presets, loading, refresh, join, abandon };
}
