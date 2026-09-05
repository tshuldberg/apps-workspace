import { notFound } from 'next/navigation';
import {
  getEntry,
  getFactorByDate,
  getFactorByEntry,
  isFactorLogMode,
  resolveFactorLogDate,
} from '@mylife/sleep';
import { getAdapter } from '@/lib/db';
import { SleepFactorLogForm } from '../SleepFactorLogForm';

function firstValue(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SleepFactorLogPage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string | string[];
    entryId?: string | string[];
    mode?: string | string[];
    quick?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const adapter = getAdapter();
  const date = firstValue(params.date);
  const entryId = firstValue(params.entryId);
  const mode = firstValue(params.mode);
  const quick = firstValue(params.quick);
  const referenceNowIso = new Date().toISOString();
  const referenceNow = new Date(referenceNowIso);
  const linkedEntry = entryId ? getEntry(adapter, entryId) : null;

  if (entryId && !linkedEntry) {
    notFound();
  }

  return (
    <SleepFactorLogForm
      closeHref={linkedEntry ? `/sleep/entry/${linkedEntry.id}` : '/sleep/factors'}
      factorsByMode={
        linkedEntry
          ? {
              last_night: getFactorByEntry(adapter, linkedEntry.id),
            }
          : date
            ? {
                last_night: getFactorByDate(adapter, date),
              }
          : {
              tonight: getFactorByDate(
                adapter,
                resolveFactorLogDate('tonight', referenceNow),
              ),
              last_night: getFactorByDate(
                adapter,
                resolveFactorLogDate('last_night', referenceNow),
              ),
            }
      }
      fixedDate={date ?? null}
      initialMode={mode && isFactorLogMode(mode) ? mode : undefined}
      initialQuick={quick === '1' || quick === 'true'}
      linkedEntry={linkedEntry}
      referenceNowIso={referenceNowIso}
    />
  );
}
