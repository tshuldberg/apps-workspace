import { getEntry } from '@mylife/sleep';
import { notFound } from 'next/navigation';
import { getAdapter } from '@/lib/db';
import { SleepMorningLogForm } from '../../../log/SleepMorningLogForm';

export default async function SleepEntryEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const entry = getEntry(getAdapter(), id);

  if (!entry) {
    notFound();
  }

  return <SleepMorningLogForm mode="edit" entry={entry} />;
}
