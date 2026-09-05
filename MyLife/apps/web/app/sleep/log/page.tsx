import { getLatestEntry } from '@mylife/sleep';
import { getAdapter } from '@/lib/db';
import { SleepMorningLogForm } from './SleepMorningLogForm';

export default function SleepLogPage() {
  const latestEntry = getLatestEntry(getAdapter());

  return <SleepMorningLogForm mode="create" latestEntry={latestEntry} />;
}
