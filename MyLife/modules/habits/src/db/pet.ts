import type { DatabaseAdapter } from '@mylife/db';
import { getSetting, setSetting } from './crud';
import {
  applyPetCareAction,
  decayPetCareState,
  getPetLevelForXP,
  getPetUnlockables,
  hydratePetCareState,
  type PetCareState,
  type PetHistoryEntry,
} from '../pet/engine';

const PET_STATE_KEY = 'pet_care_state';
const PET_HISTORY_KEY = 'pet_care_history';

function mapPetState(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    name: row.name as string,
    species: row.species as string,
    equippedItems: JSON.parse(row.equipped_items as string) as string[],
    daysTogether: row.days_together as number,
    totalHabitsCompleted: row.total_habits_completed as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function parseJsonSetting<T>(db: DatabaseAdapter, key: string, fallback: T): T {
  const raw = getSetting(db, key);

  if (raw == null) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function persistPetCareState(db: DatabaseAdapter, state: PetCareState): void {
  const { mood: _mood, ...persisted } = state;
  setSetting(db, PET_STATE_KEY, JSON.stringify(persisted));
}

function persistPetHistory(db: DatabaseAdapter, history: PetHistoryEntry[]): void {
  setSetting(db, PET_HISTORY_KEY, JSON.stringify(history.slice(0, 24)));
}

function createHistoryEntry(
  action: PetHistoryEntry['action'],
  title: string,
  detail: string,
  value: number,
  timestamp: string,
): PetHistoryEntry {
  return {
    id: `${action}-${timestamp}`,
    action,
    title,
    detail,
    value,
    timestamp,
  };
}

function appendPetHistory(db: DatabaseAdapter, entries: PetHistoryEntry[]): void {
  const existing = getPetHistory(db, 24);
  persistPetHistory(db, [...entries.reverse(), ...existing]);
}

function resolvePetCareState(db: DatabaseAdapter, now: string): PetCareState {
  const stored = parseJsonSetting<Partial<PetCareState>>(db, PET_STATE_KEY, {});
  const hydrated = hydratePetCareState(stored);

  if (hydrated.lastInteractionAt == null) {
    return hydrated;
  }

  const elapsedMs = new Date(now).getTime() - new Date(hydrated.lastInteractionAt).getTime();
  const elapsedHours = Math.max(0, elapsedMs / (60 * 60 * 1000));

  return decayPetCareState(hydrated, elapsedHours);
}

function runPetAction(
  db: DatabaseAdapter,
  action: 'feed' | 'play' | 'rest',
): PetCareState {
  const now = new Date().toISOString();
  const current = resolvePetCareState(db, now);
  const previousLevel = current.petLevel;
  const updated = applyPetCareAction(current, action);
  const nextState: PetCareState = {
    ...updated,
    petLevel: getPetLevelForXP(updated.petXP),
    lastInteractionAt: now,
  };

  persistPetCareState(db, nextState);

  const titles = {
    feed: 'Fed your companion',
    play: 'Played together',
    rest: 'Shared a rest break',
  } as const;
  const details = {
    feed: 'Hunger restored and trust increased.',
    play: 'Happiness surged with a burst of energy.',
    rest: 'Energy recovered inside the sanctuary.',
  } as const;
  const xpValues = {
    feed: 18,
    play: 24,
    rest: 14,
  } as const;

  const entries = [
    createHistoryEntry(action, titles[action], details[action], xpValues[action], now),
  ];

  if (nextState.petLevel > previousLevel) {
    entries.push(
      createHistoryEntry(
        'level_up',
        `Reached level ${nextState.petLevel}`,
        'Your companion evolved through consistent care.',
        nextState.petLevel,
        now,
      ),
    );
  }

  appendPetHistory(db, entries);

  return nextState;
}

export function getPetState(db: DatabaseAdapter) {
  const rows = db.query<Record<string, unknown>>('SELECT * FROM hb_pet_state WHERE id = ?', ['pet']);
  return rows.length > 0 ? mapPetState(rows[0]) : null;
}

export function ensurePetState(db: DatabaseAdapter): void {
  db.execute(`INSERT OR IGNORE INTO hb_pet_state (id) VALUES ('pet')`);
}

export function updatePetName(db: DatabaseAdapter, name: string): void {
  const now = new Date().toISOString();
  db.execute(
    "UPDATE hb_pet_state SET name = ?, updated_at = ? WHERE id = 'pet'",
    [name, now],
  );
}

export function updatePetSpecies(db: DatabaseAdapter, species: string): void {
  const now = new Date().toISOString();
  db.execute(
    "UPDATE hb_pet_state SET species = ?, updated_at = ? WHERE id = 'pet'",
    [species, now],
  );
}

export function updatePetEquippedItems(db: DatabaseAdapter, items: string[]): void {
  const now = new Date().toISOString();
  db.execute(
    "UPDATE hb_pet_state SET equipped_items = ?, updated_at = ? WHERE id = 'pet'",
    [JSON.stringify(items), now],
  );
}

export function incrementPetCompletions(db: DatabaseAdapter, count: number = 1): void {
  const now = new Date().toISOString();
  db.execute(
    "UPDATE hb_pet_state SET total_habits_completed = total_habits_completed + ?, updated_at = ? WHERE id = 'pet'",
    [count, now],
  );
}

export function getPetCareState(db: DatabaseAdapter, at: string = new Date().toISOString()): PetCareState {
  return resolvePetCareState(db, at);
}

export function getPetHistory(db: DatabaseAdapter, limit: number = 12): PetHistoryEntry[] {
  const history = parseJsonSetting<PetHistoryEntry[]>(db, PET_HISTORY_KEY, []);
  return history.slice(0, limit);
}

export function feedPet(db: DatabaseAdapter): PetCareState {
  return runPetAction(db, 'feed');
}

export function playWithPet(db: DatabaseAdapter): PetCareState {
  return runPetAction(db, 'play');
}

export function restPet(db: DatabaseAdapter): PetCareState {
  return runPetAction(db, 'rest');
}

export function getPetUnlockablesForState(db: DatabaseAdapter) {
  return getPetUnlockables(getPetCareState(db).petLevel);
}
