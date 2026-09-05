import { listDreams } from '@mylife/sleep';
import { getAdapter } from '@/lib/db';
import { SleepDreamArchiveClient } from './SleepDreamArchiveClient';

const DREAM_LIMIT = 250;

export default function SleepDreamsPage() {
  const adapter = getAdapter();
  const dreams = listDreams(adapter, { limit: DREAM_LIMIT });

  return <SleepDreamArchiveClient initialDreams={dreams} />;
}
