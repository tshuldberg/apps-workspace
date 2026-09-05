'use server';

import { getAdapter, ensureModuleMigrations } from '@/lib/db';
import {
  createPerson,
  getPerson,
  updatePerson,
  deletePerson,
  archivePerson,
  unarchivePerson,
  listPeople,
  searchPeople,
  type PersonInput,
  type PersonUpdate,
  type PersonFilter,
  type PersonSort,
  type PersonRecord,
} from '@mylife/friends';

function db() {
  const adapter = getAdapter();
  ensureModuleMigrations('friends');
  return adapter;
}

async function runFriendsAction<T>(work: () => T): Promise<T> {
  try {
    return work();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Friends action failed.';
    throw new Error(message);
  }
}

export async function fetchPeople(
  filters?: PersonFilter,
  sort?: PersonSort,
): Promise<PersonRecord[]> {
  return runFriendsAction(() => listPeople(db(), filters, sort));
}

export async function fetchPerson(id: string): Promise<PersonRecord | null> {
  return runFriendsAction(() => getPerson(db(), id));
}

export async function addPerson(input: PersonInput): Promise<PersonRecord> {
  return runFriendsAction(() => createPerson(db(), input));
}

export async function editPerson(
  id: string,
  updates: PersonUpdate,
): Promise<void> {
  return runFriendsAction(() => updatePerson(db(), id, updates));
}

export async function removePerson(id: string): Promise<void> {
  return runFriendsAction(() => deletePerson(db(), id));
}

export async function archiveFriend(id: string): Promise<void> {
  return runFriendsAction(() => archivePerson(db(), id));
}

export async function unarchiveFriend(id: string): Promise<void> {
  return runFriendsAction(() => unarchivePerson(db(), id));
}

export async function searchFriends(query: string): Promise<PersonRecord[]> {
  return runFriendsAction(() => searchPeople(db(), query));
}
