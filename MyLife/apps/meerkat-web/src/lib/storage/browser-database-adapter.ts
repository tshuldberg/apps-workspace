import type { DatabaseAdapter } from '@mylife/db';
import type { Database, SqlJsStatic } from 'sql.js';
import { loadSqlJs, type LocateFile } from './load-sqljs';
import { STORE_SQLITE, idbGet, idbPut } from './idb';
import { acquireDatabaseWriter, DatabaseOwnershipError, DATABASE_WRITER_LOCK } from './database-ownership';

/** Where the exported sql.js bytes live durably. Pluggable so tests can inject. */
export interface DbBytesStore {
  /** Shared storage must use a shared origin lock name. Omit only for isolated memory stores. */
  lockName?: string;
  read(): Promise<Uint8Array | null>;
  write(bytes: Uint8Array): Promise<void>;
}

/** Default durable store: IndexedDB object store `sqlite`, key `db`. */
export function createIdbDbBytesStore(key = 'db'): DbBytesStore {
  return {
    lockName: key === 'db' ? DATABASE_WRITER_LOCK : `meerkat-web:sqlite:${key}:writer`,
    async read(): Promise<Uint8Array | null> {
      const value = await idbGet<Uint8Array | ArrayBuffer>(STORE_SQLITE, key);
      if (!value) return null;
      return value instanceof Uint8Array ? value : new Uint8Array(value);
    },
    async write(bytes: Uint8Array): Promise<void> {
      // Copy into a plain Uint8Array so structured-clone stores a stable buffer.
      await idbPut(STORE_SQLITE, key, new Uint8Array(bytes));
    },
  };
}

export interface BrowserDatabaseAdapterOptions {
  /** Durable bytes store. Defaults to IndexedDB. */
  bytesStore?: DbBytesStore;
  /** Debounce window for background persistence in ms (default 250). */
  persistDebounceMs?: number;
  /** Node-only: explicit sql.js wasm locator. Omitted in the browser. */
  locateFile?: LocateFile;
  /** Called before each database save, e.g. to durably save referenced keys first. */
  beforePersist?: () => Promise<void>;
  /** Runs under ownership before loading bytes, for crypto boot. */
  beforeOpen?: () => Promise<void>;
  beforeRetry?: () => Promise<void>;
}

export interface DatabasePersistenceState {
  status: 'saved' | 'pending' | 'saving' | 'retrying' | 'unsaved' | 'closed';
  pending: boolean;
  failures: number;
}

export interface BrowserDatabaseAdapter extends DatabaseAdapter {
  /** Rejects on failure. Resolves only after all pending revisions are durable. */
  flush(): Promise<void>;
  /** Explicit user recovery restarts the bounded retry budget. */
  retryPersistence(): Promise<void>;
  export(): Promise<Uint8Array>;
  /** Flush before releasing ownership. Failure keeps the database open for recovery. */
  close(options?: { retainOwnership?: boolean }): Promise<void>;
  getPersistenceState(): DatabasePersistenceState;
  subscribePersistence(listener: () => void): () => void;
}

// Memory fixtures have no cross-tab backing; their object identity is their scope.
const memoryOwners = new WeakSet<DbBytesStore>();

export async function createBrowserDatabaseAdapter(
  options: BrowserDatabaseAdapterOptions = {},
): Promise<BrowserDatabaseAdapter> {
  const bytesStore = options.bytesStore ?? createIdbDbBytesStore();
  let release: () => void | Promise<void>;
  if (bytesStore.lockName) {
    release = await acquireDatabaseWriter(bytesStore.lockName);
  } else {
    if (memoryOwners.has(bytesStore)) throw new DatabaseOwnershipError('busy');
    memoryOwners.add(bytesStore);
    release = () => { memoryOwners.delete(bytesStore); };
  }
  let db: Database;
  try {
    await options.beforeOpen?.();
    const SQL: SqlJsStatic = await loadSqlJs(options.locateFile);
    const existing = await bytesStore.read();
    db = existing ? new SQL.Database(existing) : new SQL.Database();
    db.run('PRAGMA foreign_keys=ON;');
  } catch (error) { await release(); throw error; }

  let revision = 0;
  let durableRevision = 0;
  let failures = 0;
  let lastError: unknown;
  let closed = false;
  let closing = false;
  let inTransaction = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<void> | null = null;
  let state: DatabasePersistenceState = { status: 'saved', pending: false, failures: 0 };
  const listeners = new Set<() => void>();
  const maxAttempts = 4;

  function publish(status: DatabasePersistenceState['status']): void {
    state = { status, pending: revision !== durableRevision, failures };
    for (const listener of listeners) listener();
  }
  function cancelTimer(): void {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }
  function schedule(delay: number): void {
    if (timer !== null || closed || closing) return;
    timer = setTimeout(() => {
      timer = null;
      void persist().catch(() => undefined);
    }, delay);
  }
  function assertOpen(): void {
    if (closed) throw new Error('Database is closed');
  }
  function changed(): void {
    revision++;
    publish(failures >= maxAttempts ? 'unsaved' : failures ? 'retrying' : 'pending');
    if (failures === 0 && !inFlight) schedule(options.persistDebounceMs ?? 250);
  }
  async function persist(): Promise<void> {
    assertOpen();
    if (inTransaction) throw new Error('Cannot persist an open transaction');
    if (inFlight) return inFlight;
    if (failures >= maxAttempts) throw lastError;
    const run = async (): Promise<void> => {
      while (durableRevision !== revision) {
        const savingRevision = revision;
        const bytes = db.export();
        publish('saving');
        try {
          // Keys must reach durable storage before rows referencing them.
          await options.beforePersist?.();
          await bytesStore.write(bytes);
        } catch (error) {
          cancelTimer();
          lastError = error;
          failures++;
          publish(failures >= maxAttempts ? 'unsaved' : 'retrying');
          if (failures < maxAttempts) schedule(1000 * 2 ** (failures - 1));
          throw error;
        }
        durableRevision = savingRevision;
        failures = 0;
        lastError = undefined;
        publish(durableRevision === revision ? 'saved' : 'pending');
      }
    };
    inFlight = run().finally(() => { inFlight = null; });
    return inFlight;
  }

  // Never claim that an unload handler made asynchronous writes durable.
  const beforeUnload = (event: BeforeUnloadEvent): void => {
    if (revision === durableRevision) return;
    event.preventDefault();
    event.returnValue = '';
  };
  globalThis.addEventListener?.('beforeunload', beforeUnload);

  return {
    execute(sql, params): void {
      assertOpen();
      if (closing) throw new Error('Database is saving before close');
      db.run(sql, (params ?? []) as never[]);
      if (!inTransaction) changed();
    },
    query<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[] {
      assertOpen();
      // Enforce the read contract even for SQL with RETURNING or a writable CTE.
      db.run('PRAGMA query_only=ON');
      let stmt: ReturnType<Database['prepare']> | undefined;
      try {
        stmt = db.prepare(sql);
        if (params?.length) stmt.bind(params as never[]);
        const rows: T[] = [];
        while (stmt.step()) rows.push(stmt.getAsObject() as T);
        return rows;
      } finally {
        stmt?.free();
        db.run('PRAGMA query_only=OFF');
      }
    },
    transaction(fn): void {
      assertOpen();
      if (closing || inTransaction) throw new Error('Database transaction unavailable');
      db.run('BEGIN');
      inTransaction = true;
      try {
        fn();
        db.run('COMMIT');
        changed();
      } catch (error) {
        db.run('ROLLBACK');
        throw error;
      } finally { inTransaction = false; }
    },
    async flush(): Promise<void> {
      cancelTimer();
      await persist();
    },
    async retryPersistence(): Promise<void> {
      if (inFlight) return inFlight;
      failures = 0;
      cancelTimer();
      await options.beforeRetry?.();
      await persist();
    },
    async export(): Promise<Uint8Array> {
      assertOpen();
      if (inTransaction) throw new Error('Cannot export an open transaction');
      return db.export();
    },
    async close(closeOptions): Promise<void> {
      if (closed) return;
      closing = true;
      cancelTimer();
      try { await persist(); }
      catch (error) { closing = false; throw error; }
      closed = true;
      db.close();
      globalThis.removeEventListener?.('beforeunload', beforeUnload);
      // Restore replaces durable bytes while the old image must never run again.
      // Keep ownership until the required page reload terminates this realm.
      if (!closeOptions?.retainOwnership) await release();
      publish('closed');
      listeners.clear();
    },
    getPersistenceState: () => state,
    subscribePersistence(listener): () => void {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
