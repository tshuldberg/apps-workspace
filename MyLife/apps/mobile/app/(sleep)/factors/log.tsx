import { useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  getEntry,
  getFactorByDate,
  getFactorByEntry,
  isFactorLogMode,
  saveFactorLog,
  resolveFactorLogDate,
} from '@mylife/sleep';
import { useDatabase } from '../../../components/DatabaseProvider';
import { SleepFactorForm } from '../SleepFactorForm';

export default function SleepFactorLogScreen() {
  const db = useDatabase();
  const router = useRouter();
  const { entryId, mode, quick } = useLocalSearchParams<{
    entryId?: string;
    mode?: string;
    quick?: string;
  }>();
  const [referenceNow] = useState(() => new Date());

  const linkedEntry = useMemo(() => {
    if (!entryId) {
      return null;
    }

    try {
      return getEntry(db, entryId);
    } catch {
      return null;
    }
  }, [db, entryId]);

  const factorsByMode = useMemo(() => {
    if (linkedEntry) {
      return {
        last_night: getFactorByEntry(db, linkedEntry.id),
      };
    }

    try {
      return {
        tonight: getFactorByDate(db, resolveFactorLogDate('tonight', referenceNow)),
        last_night: getFactorByDate(
          db,
          resolveFactorLogDate('last_night', referenceNow),
        ),
      };
    } catch {
      return {
        tonight: null,
        last_night: null,
      };
    }
  }, [db, linkedEntry, referenceNow]);

  return (
    <SleepFactorForm
      closeLabel="Close"
      factorsByMode={factorsByMode}
      initialMode={mode && isFactorLogMode(mode) ? mode : undefined}
      initialQuick={quick === '1' || quick === 'true'}
      linkedEntry={linkedEntry}
      onClose={() => {
        if (linkedEntry) {
          router.replace(`/(sleep)/entry/${linkedEntry.id}` as never);
          return;
        }

        router.replace('/(sleep)' as never);
      }}
      onSave={async (input) => {
        const saved = saveFactorLog(db, input);
        router.replace(
          saved.sleep_entry_id
            ? (`/(sleep)/entry/${saved.sleep_entry_id}` as never)
            : ('/(sleep)' as never),
        );
      }}
      referenceNow={referenceNow}
    />
  );
}
