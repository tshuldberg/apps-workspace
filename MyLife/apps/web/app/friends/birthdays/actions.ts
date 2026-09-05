'use server';

import { getAdapter, ensureModuleMigrations } from '@/lib/db';
import {
  listPeople,
  getUpcomingBirthdays,
  type UpcomingBirthday,
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
      error instanceof Error ? error.message : 'Birthday action failed.';
    throw new Error(message);
  }
}

export async function fetchUpcomingBirthdays(
  daysAhead: number = 90,
): Promise<UpcomingBirthday[]> {
  return runAction(() => {
    const people = listPeople(db(), { is_archived: false });
    return getUpcomingBirthdays(people, daysAhead);
  });
}
