import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'path';
import type { DatabaseAdapter } from '@mylife/db';
import {
  initializeHubDatabase,
  runModuleMigrations,
  getHubMode,
  setHubMode,
} from '@mylife/db';
import { BOOKS_MODULE } from '../../../modules/books/src/definition';
import { FAST_MODULE } from '../../../modules/fast/src/definition';
import { FLASH_MODULE } from '../../../modules/flash/src/definition';
import { BUDGET_MODULE } from '../../../modules/budget/src/definition';
import { RECIPES_MODULE } from '../../../modules/bestchef/src/definition';
import { CAR_MODULE } from '../../../modules/car/src/definition';
import { CLASSES_MODULE } from '../../../modules/classes/src/definition';
import { CLOSET_MODULE } from '../../../modules/closet/src/definition';
import { CYCLE_MODULE } from '../../../modules/cycle/src/definition';
import { CREATE_MODULE } from '../../../modules/create/src/definition';
import { HABITS_MODULE } from '../../../modules/habits/src/definition';
import { MEDS_MODULE } from '../../../modules/meds/src/definition';
import { SURF_MODULE } from '../../../modules/surf/src/definition';
import { WORKOUTS_MODULE } from '../../../modules/workouts/src/definition';
import { HOMES_MODULE } from '../../../modules/homes/src/definition';
import { WORDS_MODULE } from '../../../modules/words/src/definition';
import { JOURNAL_MODULE } from '../../../modules/journal/src/definition';
import { PETS_MODULE } from '../../../modules/pets/src/definition';
import { RSVP_MODULE } from '../../../modules/rsvp/src/definition';
import { STARS_MODULE } from '../../../modules/stars/src/definition';
import { HEALTH_MODULE } from '../../../modules/health/src/definition';
import { NUTRITION_MODULE } from '../../../modules/nutrition/src/definition';
import { MOOD_MODULE } from '../../../modules/mood/src/definition';
import { NOTES_MODULE } from '../../../modules/notes/src/definition';
import { GARDEN_MODULE } from '../../../modules/garden/src/definition';
import { TRAILS_MODULE } from '../../../modules/trails/src/definition';
import { VOICE_MODULE } from '../../../modules/voice/src/definition';
import { MAIL_MODULE } from '../../../modules/mail/src/definition';
import { PRESENCE_MODULE } from '../../../modules/presence/src/definition';
import { SUBS_MODULE } from '../../../modules/subs/src/definition';
import { FORUMS_MODULE } from '../../../modules/forums/src/definition';
import { MARKET_MODULE } from '../../../modules/market/src/definition';
import { DINING_MODULE } from '../../../modules/dining/src/definition';
import { FRIENDS_MODULE } from '../../../modules/friends/src/definition';
import { SHOP_MODULE } from '../../../modules/shop/src/definition';
import { SLEEP_MODULE } from '../../../modules/sleep/src/definition';
import { SPORTS_MODULE } from '../../../modules/sports/src/definition';
import { TRAVEL_MODULE } from '../../../modules/travel/src/definition';
import { MANHATTAN_MODULE } from '../../../modules/manhattan/src/definition';

let adapter: DatabaseAdapter | null = null;

/**
 * Singleton better-sqlite3 adapter for the web app.
 * Stores the database file in the project root as mylife-hub.db.
 * Server-only — cannot be imported from client components.
 */
export function getAdapter(): DatabaseAdapter {
  if (adapter) return adapter;

  const configuredPath = process.env.MYLIFE_DB_PATH?.trim();
  const dbPath = configuredPath
    ? (path.isAbsolute(configuredPath)
      ? configuredPath
      : path.join(process.cwd(), configuredPath))
    : path.join(process.cwd(), 'mylife-hub.db');
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  adapter = {
    execute(sql: string, params?: unknown[]): void {
      db.prepare(sql).run(...(params ?? []));
    },
    query<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[] {
      return db.prepare(sql).all(...(params ?? [])) as T[];
    },
    transaction(fn: () => void): void {
      db.transaction(fn)();
    },
  };

  // Initialize hub tables on first connection
  initializeHubDatabase(adapter);
  if (!getHubMode(adapter)) {
    setHubMode(adapter, 'local_only');
  }

  return adapter;
}

/**
 * Map of module IDs to their full definitions (with migrations).
 */
const MODULE_DEFINITIONS_WITH_MIGRATIONS = {
  books: BOOKS_MODULE,
  fast: FAST_MODULE,
  flash: FLASH_MODULE,
  budget: BUDGET_MODULE,
  recipes: RECIPES_MODULE,
  car: CAR_MODULE,
  classes: CLASSES_MODULE,
  closet: CLOSET_MODULE,
  cycle: CYCLE_MODULE,
  create: CREATE_MODULE,
  habits: HABITS_MODULE,
  meds: MEDS_MODULE,
  surf: SURF_MODULE,
  workouts: WORKOUTS_MODULE,
  homes: HOMES_MODULE,
  words: WORDS_MODULE,
  journal: JOURNAL_MODULE,
  pets: PETS_MODULE,
  rsvp: RSVP_MODULE,
  stars: STARS_MODULE,
  health: HEALTH_MODULE,
  nutrition: NUTRITION_MODULE,
  mood: MOOD_MODULE,
  notes: NOTES_MODULE,
  garden: GARDEN_MODULE,
  trails: TRAILS_MODULE,
  voice: VOICE_MODULE,
  mail: MAIL_MODULE,
  presence: PRESENCE_MODULE,
  subs: SUBS_MODULE,
  forums: FORUMS_MODULE,
  market: MARKET_MODULE,
  dining: DINING_MODULE,
  friends: FRIENDS_MODULE,
  shop: SHOP_MODULE,
  sleep: SLEEP_MODULE,
  sports: SPORTS_MODULE,
  travel: TRAVEL_MODULE,
  manhattan: MANHATTAN_MODULE,
} as const;

/**
 * Ensure a module's migrations have been run.
 * Called when enabling a module for the first time.
 */
export function ensureModuleMigrations(moduleId: string): void {
  const db = getAdapter();
  const moduleDef = MODULE_DEFINITIONS_WITH_MIGRATIONS[moduleId as keyof typeof MODULE_DEFINITIONS_WITH_MIGRATIONS];
  if (moduleDef?.migrations) {
    runModuleMigrations(db, moduleId, moduleDef.migrations);
  }
}
