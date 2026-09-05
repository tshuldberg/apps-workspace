'use server';

import { getAdapter, ensureModuleMigrations } from '@/lib/db';
import {
  createLifeEvent,
  listEventsForPerson,
  acknowledgeEvent,
  deleteLifeEvent,
  type LifeEventInput,
  type LifeEventRecord,
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
      error instanceof Error ? error.message : 'Life event action failed.';
    throw new Error(message);
  }
}

export async function fetchEventsForPerson(
  personId: string,
): Promise<LifeEventRecord[]> {
  return runAction(() => listEventsForPerson(db(), personId));
}

export async function addLifeEvent(
  input: LifeEventInput,
): Promise<LifeEventRecord> {
  return runAction(() => createLifeEvent(db(), input));
}

export async function ackEvent(id: string): Promise<void> {
  return runAction(() => acknowledgeEvent(db(), id));
}

export async function removeLifeEvent(id: string): Promise<void> {
  return runAction(() => deleteLifeEvent(db(), id));
}
