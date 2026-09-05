import type { Database as RawSqliteDatabase } from 'better-sqlite3';
import type { DatabaseAdapter, Migration } from './adapter';
import { createHubTables } from './hub-schema';
import { initializeHubDatabase, runModuleMigrations } from './migration-runner';

type BetterSqlite3Factory = typeof import('better-sqlite3');

export interface InMemoryTestDatabase {
  adapter: DatabaseAdapter;
  raw: RawSqliteDatabase;
  close: () => void;
}

function createAdapter(raw: RawSqliteDatabase): DatabaseAdapter {
  return {
    execute(sql: string, params?: unknown[]): void {
      raw.prepare(sql).run(...(params ?? []));
    },
    query<T>(sql: string, params?: unknown[]): T[] {
      return raw.prepare(sql).all(...(params ?? [])) as T[];
    },
    transaction(fn: () => void): void {
      // Raw BEGIN/COMMIT semantics, deliberately NOT better-sqlite3's
      // raw.transaction(fn)(), which auto-nests via SAVEPOINTs. The shipped
      // adapters (sql.js browser adapter, expo-sqlite) issue a raw BEGIN and
      // throw "cannot start a transaction within a transaction" on nesting;
      // a MORE permissive test adapter hid exactly that defect from 1,003 web
      // tests (rc13 defect 1). Tests must fail where production fails.
      raw.exec('BEGIN');
      try {
        fn();
        raw.exec('COMMIT');
      } catch (err) {
        raw.exec('ROLLBACK');
        throw err;
      }
    },
  };
}

function loadBetterSqlite3(): BetterSqlite3Factory {
  const moduleApi = process.getBuiltinModule?.('module') as
    | typeof import('node:module')
    | undefined;
  if (!moduleApi) {
    throw new Error('better-sqlite3 test helpers require a Node.js runtime.');
  }

  const requireFromHere = moduleApi.createRequire(import.meta.url);
  const loaded = requireFromHere('better-sqlite3') as unknown;
  if (typeof loaded === 'function') {
    return loaded as BetterSqlite3Factory;
  }
  const loadedDefault =
    typeof loaded === 'object' && loaded !== null && 'default' in loaded
      ? (loaded as { default: unknown }).default
      : undefined;
  if (typeof loadedDefault === 'function') {
    return loadedDefault as BetterSqlite3Factory;
  }
  throw new Error('Unable to load better-sqlite3 for test database helpers.');
}

/**
 * Build a brand new in-memory SQLite database adapter for test usage.
 */
export function createInMemoryTestDatabase(): InMemoryTestDatabase {
  const Database = loadBetterSqlite3();
  const raw = new Database(':memory:');
  raw.pragma('journal_mode = WAL');
  raw.pragma('foreign_keys = ON');

  return {
    adapter: createAdapter(raw),
    raw,
    close: () => raw.close(),
  };
}

/**
 * Build a fresh hub-only schema for tests that validate hub primitives directly.
 */
export function createHubTestDatabase(): InMemoryTestDatabase {
  const db = createInMemoryTestDatabase();
  createHubTables(db.adapter);
  return db;
}

/**
 * Build a fresh module-ready schema (hub initialized + module migrations applied).
 */
export function createModuleTestDatabase(
  moduleId: string,
  migrations: Migration[],
): InMemoryTestDatabase {
  const db = createInMemoryTestDatabase();
  initializeHubDatabase(db.adapter);
  runModuleMigrations(db.adapter, moduleId, migrations);
  return db;
}
