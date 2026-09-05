'use server';

import { getAdapter, ensureModuleMigrations } from '@/lib/db';
import {
  createJournalEntry,
  listJournalForPerson,
  deleteJournalEntry,
  countJournalByType,
  getPerson,
  type JournalEntryRecord,
  type JournalCountByType,
  type JournalEntryInput,
  type PersonRecord,
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
      error instanceof Error ? error.message : 'Journal action failed.';
    throw new Error(message);
  }
}

export async function fetchPerson(id: string): Promise<PersonRecord | null> {
  return runAction(() => getPerson(db(), id));
}

export async function fetchJournalForPerson(
  personId: string,
  type?: 'gratitude' | 'conflict' | 'growth',
): Promise<JournalEntryRecord[]> {
  return runAction(() => listJournalForPerson(db(), personId, type));
}

export async function fetchJournalCounts(
  personId: string,
): Promise<JournalCountByType> {
  return runAction(() => countJournalByType(db(), personId));
}

export async function addJournalEntry(
  input: JournalEntryInput,
): Promise<JournalEntryRecord> {
  return runAction(() => createJournalEntry(db(), input));
}

export async function removeJournalEntry(id: string): Promise<void> {
  return runAction(() => deleteJournalEntry(db(), id));
}
