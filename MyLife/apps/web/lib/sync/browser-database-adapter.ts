// BrowserDatabaseAdapter: a SYNCHRONOUS @mylife/db DatabaseAdapter backed by
// sql.js, for the hub web sync DB (sync_ tables, device identity, paired
// devices, workspaces, transport prefs).
//
// @mylife/db's DatabaseAdapter is synchronous (execute/query/transaction), but
// browser storage (IndexedDB) is async. We resolve that the same way the native
// app resolves the keychain/filesystem: load durable bytes into an in-memory
// sql.js image once at boot, serve the synchronous interface from that image,
// and persist writes back to IndexedDB in the background (debounced).
//
// This mirrors apps/meerkat-web/src/lib/storage/browser-database-adapter.ts; it
// is duplicated rather than imported because meerkat-web exposes no package
// `exports` boundary. The ONLY divergence is wasm loading (lib/sync/load-sqljs.ts
// serves the wasm from public/ under Next, not Vite's `?url`).

import type { DatabaseAdapter } from '@mylife/db';
import type { Database, SqlJsStatic } from 'sql.js';
import { loadSqlJs } from './load-sqljs';
import { STORE_SQLITE, idbGet, idbPut } from './idb';

export interface DbBytesStore {
  read(): Promise<Uint8Array | null>;
  write(bytes: Uint8Array): Promise<void>;
}

/** Default durable store: IndexedDB object store `sqlite`, key `db`. */
export function createIdbDbBytesStore(key = 'db'): DbBytesStore {
  return {
    async read(): Promise<Uint8Array | null> {
      const value = await idbGet<Uint8Array | ArrayBuffer>(STORE_SQLITE, key);
      if (!value) return null;
      return value instanceof Uint8Array ? value : new Uint8Array(value);
    },
    async write(bytes: Uint8Array): Promise<void> {
      await idbPut(STORE_SQLITE, key, new Uint8Array(bytes));
    },
  };
}

export interface BrowserDatabaseAdapterOptions {
  bytesStore?: DbBytesStore;
  persistDebounceMs?: number;
  /** Node-only: explicit sql.js wasm locator. Omitted in the browser. */
  locateFile?: (file: string) => string;
}

export interface BrowserDatabaseAdapter extends DatabaseAdapter {
  flush(): Promise<void>;
  export(): Promise<Uint8Array>;
  close(): void;
}

export async function createBrowserDatabaseAdapter(
  options: BrowserDatabaseAdapterOptions = {},
): Promise<BrowserDatabaseAdapter> {
  const bytesStore = options.bytesStore ?? createIdbDbBytesStore();
  const debounceMs = options.persistDebounceMs ?? 250;

  const SQL: SqlJsStatic = await loadSqlJs(options.locateFile);
  const existing = await bytesStore.read();
  const db: Database = existing ? new SQL.Database(existing) : new SQL.Database();
  db.run('PRAGMA foreign_keys=ON;');

  let dirty = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<void> | null = null;

  async function persistNow(): Promise<void> {
    if (inFlight) await inFlight;
    if (!dirty) return;
    dirty = false;
    const bytes = db.export();
    inFlight = bytesStore
      .write(bytes)
      .catch(() => {
        dirty = true;
      })
      .finally(() => {
        inFlight = null;
      });
    await inFlight;
    if (dirty) await persistNow();
  }

  function schedulePersist(): void {
    dirty = true;
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      void persistNow();
    }, debounceMs);
  }

  function runQuery<T>(sql: string, params?: unknown[]): T[] {
    const stmt = db.prepare(sql);
    try {
      if (params && params.length > 0) {
        stmt.bind(params as never[]);
      }
      const rows: T[] = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject() as T);
      }
      return rows;
    } finally {
      stmt.free();
    }
  }

  return {
    execute(sql: string, params?: unknown[]): void {
      db.run(sql, (params ?? []) as never[]);
      schedulePersist();
    },
    query<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[] {
      return runQuery<T>(sql, params);
    },
    transaction(fn: () => void): void {
      db.run('BEGIN');
      try {
        fn();
        db.run('COMMIT');
      } catch (err) {
        db.run('ROLLBACK');
        throw err;
      }
      schedulePersist();
    },
    async flush(): Promise<void> {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      dirty = true;
      await persistNow();
    },
    async export(): Promise<Uint8Array> {
      return db.export();
    },
    close(): void {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      db.close();
    },
  };
}
