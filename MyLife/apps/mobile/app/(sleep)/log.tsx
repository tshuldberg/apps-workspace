import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  buildMorningLogEntryInput,
  createEntry,
  getLatestEntry,
  getMorningLogDraftFromEntry,
  getMorningLogSummary,
  type MorningLogDraft,
} from '@mylife/sleep';
import { useDatabase } from '../../components/DatabaseProvider';
import { SleepEntryWizard } from './SleepEntryWizard';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function currentTimeValue(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function SleepLogScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [referenceNow] = useState(() => new Date());

  const latestEntry = useMemo(() => {
    try {
      return getLatestEntry(db);
    } catch {
      return null;
    }
  }, [db]);

  const latestDraft = latestEntry
    ? getMorningLogDraftFromEntry(latestEntry)
    : null;

  const initialDraft = useMemo<MorningLogDraft>(
    () => ({
      bedtimeTime: latestDraft?.bedtimeTime ?? '22:30',
      wakeTime: currentTimeValue(referenceNow),
      qualityRating: null,
      wakeFeeling: null,
      wakeCount: 0,
      notesMd: '',
    }),
    [latestDraft, referenceNow],
  );

  const buildSummary = useCallback(
    (draft: MorningLogDraft) => getMorningLogSummary(draft, referenceNow),
    [referenceNow],
  );

  const handleSubmit = useCallback(
    async (draft: MorningLogDraft) => {
      createEntry(db, buildMorningLogEntryInput(draft, referenceNow));
      router.replace('/(sleep)' as never);
    },
    [db, referenceNow, router],
  );

  return (
    <SleepEntryWizard
      eyebrow="Morning Log"
      initialDraft={initialDraft}
      saveLabel="Save Sleep Log"
      buildSummary={buildSummary}
      onSubmit={handleSubmit}
      onClose={() => router.replace('/(sleep)' as never)}
    />
  );
}
