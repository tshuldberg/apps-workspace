import {
  openDatabaseSync,
  type SQLiteBindParams,
  type SQLiteDatabase,
} from 'expo-sqlite';
import type { YearnDiscoverProfile, YearnMatch } from './yearnRepository';
import type { YearnOfflineCache, YearnPendingMutation } from './offlineCache';

type CacheKey = 'deck' | 'matches';

interface CacheRow {
  value: string;
}

interface PendingMutationRow {
  payload: string;
}

function encodeJson(value: unknown): string {
  return JSON.stringify(value);
}

function decodeJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

export class SQLiteYearnOfflineCache implements YearnOfflineCache {
  constructor(private readonly db: SQLiteDatabase) {}

  initialize(): void {
    this.db.execSync(`
      PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS yearn_cache_entries (
        cache_key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS yearn_pending_mutations (
        id TEXT PRIMARY KEY NOT NULL,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_yearn_pending_mutations_created_at
        ON yearn_pending_mutations(created_at);
    `);
  }

  async readDeck(): Promise<YearnDiscoverProfile[]> {
    return this.readCacheValue('deck', []);
  }

  async writeDeck(profiles: YearnDiscoverProfile[]): Promise<void> {
    this.writeCacheValue('deck', profiles);
  }

  async removeDeckProfile(profileId: string): Promise<void> {
    const deck = await this.readDeck();
    await this.writeDeck(deck.filter((profile) => profile.id !== profileId));
  }

  async readMatches(): Promise<YearnMatch[]> {
    return this.readCacheValue('matches', []);
  }

  async writeMatches(matches: YearnMatch[]): Promise<void> {
    this.writeCacheValue('matches', matches);
  }

  async removeMatch(matchId: string): Promise<void> {
    const matches = await this.readMatches();
    await this.writeMatches(matches.filter((match) => match.id !== matchId));
  }

  async enqueueMutation(mutation: YearnPendingMutation): Promise<void> {
    this.db.runSync(
      `INSERT OR REPLACE INTO yearn_pending_mutations (id, type, payload, created_at)
       VALUES (?, ?, ?, ?)`,
      [
        mutation.id,
        mutation.type,
        encodeJson(mutation),
        mutation.createdAt,
      ] as SQLiteBindParams,
    );
  }

  async readPendingMutations(): Promise<YearnPendingMutation[]> {
    const rows = this.db.getAllSync<PendingMutationRow>(
      `SELECT payload FROM yearn_pending_mutations ORDER BY created_at ASC`,
    );
    return rows
      .map((row) => decodeJson<YearnPendingMutation | null>(row.payload, null))
      .filter((mutation): mutation is YearnPendingMutation => mutation !== null);
  }

  async clearPendingMutation(mutationId: string): Promise<void> {
    this.db.runSync(
      `DELETE FROM yearn_pending_mutations WHERE id = ?`,
      [mutationId] as SQLiteBindParams,
    );
  }

  private readCacheValue<T>(key: CacheKey, fallback: T): T {
    const row = this.db.getFirstSync<CacheRow>(
      `SELECT value FROM yearn_cache_entries WHERE cache_key = ?`,
      [key] as SQLiteBindParams,
    );
    if (!row) return fallback;
    return decodeJson(row.value, fallback);
  }

  private writeCacheValue(key: CacheKey, value: unknown): void {
    this.db.runSync(
      `INSERT OR REPLACE INTO yearn_cache_entries (cache_key, value, updated_at)
       VALUES (?, ?, ?)`,
      [key, encodeJson(value), nowIso()] as SQLiteBindParams,
    );
  }
}

export function openYearnSQLiteCache(
  databaseName = 'yearn-cache.db',
): SQLiteYearnOfflineCache {
  const cache = new SQLiteYearnOfflineCache(openDatabaseSync(databaseName));
  cache.initialize();
  return cache;
}
