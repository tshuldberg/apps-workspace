import {
  getDreamDictionaryNotes,
  listAllDreams,
} from '@mylife/sleep';
import { getAdapter } from '@/lib/db';
import { SleepDreamDictionaryClient } from '../SleepDreamDictionaryClient';

export default function SleepDreamDictionaryPage() {
  const adapter = getAdapter();
  const dreams = listAllDreams(adapter);
  const initialNotes = getDreamDictionaryNotes(adapter);

  return (
    <SleepDreamDictionaryClient
      initialDreams={dreams}
      initialNotes={initialNotes}
    />
  );
}
