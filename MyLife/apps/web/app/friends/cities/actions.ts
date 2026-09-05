'use server';

import { getAdapter, ensureModuleMigrations } from '@/lib/db';
import { getPeopleByCities } from '@mylife/friends';

function db() {
  const adapter = getAdapter();
  ensureModuleMigrations('friends');
  return adapter;
}

export async function fetchPeopleByCities(): Promise<
  Record<string, Array<{ id: string; display_name: string }>>
> {
  try {
    return getPeopleByCities(db());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to fetch cities.';
    throw new Error(message);
  }
}
