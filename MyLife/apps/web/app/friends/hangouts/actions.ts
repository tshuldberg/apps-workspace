'use server';

import { getAdapter, ensureModuleMigrations } from '@/lib/db';
import {
  createHangout,
  getHangout,
  deleteHangout,
  listHangouts,
  listPeople,
  type HangoutRecord,
  type HangoutFilter,
  type PersonRecord,
  type ActivityTag,
} from '@mylife/friends';

function db() {
  const adapter = getAdapter();
  ensureModuleMigrations('friends');
  return adapter;
}

async function runAction<T>(work: () => T): Promise<T> {
  try {
    return work();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Hangout action failed.';
    throw new Error(message);
  }
}

export async function fetchHangouts(
  filters?: HangoutFilter,
): Promise<HangoutRecord[]> {
  return runAction(() => listHangouts(db(), filters));
}

export async function fetchHangout(
  id: string,
): Promise<HangoutRecord | null> {
  return runAction(() => getHangout(db(), id));
}

export async function addHangout(input: {
  people_ids: string[];
  happened_at: string;
  duration_minutes?: number;
  activity_tags?: ActivityTag[];
  quality_rating?: number;
  location_name?: string;
  notes_md?: string;
}): Promise<HangoutRecord> {
  return runAction(() =>
    createHangout(db(), {
      people_ids: input.people_ids,
      happened_at: input.happened_at,
      duration_minutes: input.duration_minutes,
      activity_tags: input.activity_tags ?? [],
      quality_rating: input.quality_rating,
      location_name: input.location_name,
      notes_md: input.notes_md,
    }),
  );
}

export async function removeHangout(id: string): Promise<void> {
  return runAction(() => deleteHangout(db(), id));
}

export async function fetchPeopleMap(): Promise<Record<string, PersonRecord>> {
  return runAction(() => {
    const d = db();
    const active = listPeople(d, { is_archived: false });
    const archived = listPeople(d, { is_archived: true });
    const map: Record<string, PersonRecord> = {};
    for (const p of [...active, ...archived]) {
      map[p.id] = p;
    }
    return map;
  });
}
