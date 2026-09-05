'use server';

import { getAdapter, ensureModuleMigrations } from '@/lib/db';
import {
  createGift,
  deleteGift,
  listGiftsForPerson,
  getGiftSpendingForPerson,
  createIdea,
  deleteIdea,
  listIdeasForPerson,
  markPurchased,
  type GiftRecord,
  type GiftIdeaRecord,
  type GiftInput,
  type GiftIdeaInput,
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
      error instanceof Error ? error.message : 'Gift action failed.';
    throw new Error(message);
  }
}

// ── Gifts ──────────────────────────────────────────────────────────

export async function fetchGiftsForPerson(
  personId: string,
  direction?: string,
): Promise<GiftRecord[]> {
  return runAction(() => listGiftsForPerson(db(), personId, direction));
}

export async function fetchGiftSpending(personId: string): Promise<number> {
  return runAction(() => getGiftSpendingForPerson(db(), personId));
}

export async function addGift(input: GiftInput): Promise<GiftRecord> {
  return runAction(() => createGift(db(), input));
}

export async function removeGift(id: string): Promise<void> {
  return runAction(() => deleteGift(db(), id));
}

// ── Gift Ideas ─────────────────────────────────────────────────────

export async function fetchIdeasForPerson(
  personId: string,
): Promise<GiftIdeaRecord[]> {
  return runAction(() => listIdeasForPerson(db(), personId));
}

export async function addIdea(input: GiftIdeaInput): Promise<GiftIdeaRecord> {
  return runAction(() => createIdea(db(), input));
}

export async function removeIdea(id: string): Promise<void> {
  return runAction(() => deleteIdea(db(), id));
}

export async function purchaseIdea(id: string): Promise<void> {
  return runAction(() => markPurchased(db(), id));
}
