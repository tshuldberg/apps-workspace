'use server';

import { getAdapter, ensureModuleMigrations } from '@/lib/db';
import {
  createMemory,
  getMemory,
  updateMemory,
  deleteMemory,
  listMemories,
  listPeople,
  type MemoryRecord,
  type MemoryFilter,
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
      error instanceof Error ? error.message : 'Memory action failed.';
    throw new Error(message);
  }
}

export async function fetchMemories(
  filters?: MemoryFilter,
): Promise<MemoryRecord[]> {
  return runAction(() => listMemories(db(), filters));
}

export async function fetchMemory(
  id: string,
): Promise<MemoryRecord | null> {
  return runAction(() => getMemory(db(), id));
}

export async function addMemory(input: {
  title: string;
  description_md?: string;
  person_ids?: string[];
  happened_at?: string;
  tags?: string[];
  is_inside_joke?: boolean;
}): Promise<MemoryRecord> {
  return runAction(() =>
    createMemory(db(), {
      title: input.title,
      description_md: input.description_md,
      person_ids: input.person_ids,
      happened_at: input.happened_at,
      tags: input.tags,
      is_inside_joke: input.is_inside_joke,
    }),
  );
}

export async function editMemory(
  id: string,
  updates: {
    title?: string;
    description_md?: string;
    person_ids?: string[];
    tags?: string[];
    is_inside_joke?: boolean;
  },
): Promise<void> {
  return runAction(() => updateMemory(db(), id, updates));
}

export async function removeMemory(id: string): Promise<void> {
  return runAction(() => deleteMemory(db(), id));
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
