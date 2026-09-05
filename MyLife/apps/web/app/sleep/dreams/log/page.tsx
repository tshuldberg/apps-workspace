import { notFound } from 'next/navigation';
import {
  getDream,
  listDreams,
  listEntries,
} from '@mylife/sleep';
import { getAdapter } from '@/lib/db';
import { SleepDreamLogForm } from '../SleepDreamLogForm';

const DREAM_LIMIT = 250;
const ENTRY_LIMIT = 60;

function firstValue(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SleepDreamLogPage({
  searchParams,
}: {
  searchParams: Promise<{
    dreamId?: string | string[];
    entryId?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const adapter = getAdapter();
  const dreamId = firstValue(params.dreamId);
  const entryId = firstValue(params.entryId);
  const dream = dreamId ? getDream(adapter, dreamId) : null;

  if (dreamId && !dream) {
    notFound();
  }

  return (
    <SleepDreamLogForm
      mode={dream ? 'edit' : 'create'}
      dream={dream}
      archiveDreams={listDreams(adapter, { limit: DREAM_LIMIT })}
      entryOptions={listEntries(adapter, { limit: ENTRY_LIMIT })}
      initialEntryId={entryId ?? null}
      closeHref={
        dream
          ? `/sleep/dreams/${dream.id}`
          : entryId
            ? `/sleep/entry/${entryId}`
            : '/sleep/dreams'
      }
    />
  );
}
