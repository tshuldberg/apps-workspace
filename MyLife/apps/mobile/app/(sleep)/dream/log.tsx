import { useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  createDream,
  getDream,
  listDreams,
  listEntries,
  updateDream,
} from '@mylife/sleep';
import { useDatabase } from '../../../components/DatabaseProvider';
import { SleepDreamForm } from '../SleepDreamForm';

const DREAM_LIMIT = 250;
const ENTRY_LIMIT = 60;

export default function SleepDreamLogScreen() {
  const db = useDatabase();
  const router = useRouter();
  const { dreamId, entryId } = useLocalSearchParams<{
    dreamId?: string;
    entryId?: string;
  }>();

  const dream = useMemo(() => {
    if (!dreamId) {
      return null;
    }
    try {
      return getDream(db, dreamId);
    } catch {
      return null;
    }
  }, [db, dreamId]);

  const archiveDreams = useMemo(() => {
    try {
      return listDreams(db, { limit: DREAM_LIMIT });
    } catch {
      return [];
    }
  }, [db]);

  const entryOptions = useMemo(() => {
    try {
      return listEntries(db, { limit: ENTRY_LIMIT });
    } catch {
      return [];
    }
  }, [db]);

  return (
    <SleepDreamForm
      mode={dream ? 'edit' : 'create'}
      dream={dream}
      archiveDreams={archiveDreams}
      entryOptions={entryOptions}
      initialEntryId={entryId ?? null}
      saveLabel={dream ? 'Save Dream Changes' : 'Save Dream'}
      onSubmit={async (input) => {
        const saved = dream
          ? updateDream(db, dream.id, input)
          : createDream(db, input);

        if (!saved) {
          throw new Error('Dream not found.');
        }

        router.replace(`/(sleep)/dream/${saved.id}` as never);
      }}
      onClose={() => {
        if (dream) {
          router.replace(`/(sleep)/dream/${dream.id}` as never);
          return;
        }
        if (entryId) {
          router.replace(`/(sleep)/entry/${entryId}` as never);
          return;
        }
        router.replace('/(sleep)/dreams' as never);
      }}
    />
  );
}
