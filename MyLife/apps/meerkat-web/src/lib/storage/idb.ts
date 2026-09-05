// Tiny promise wrapper over the raw IndexedDB request/transaction API.
//
// One database and one schema version shared by the browser
// adapters so they reuse a single connection:
//   - `sqlite`    : the exported sql.js DB bytes (browser-database-adapter)
//   - `secrets`   : the WebCrypto-encrypted secret vault + the wrapping CryptoKey
//   - `blocks`    : the IndexedDB fallback for sealed ciphertext blocks when OPFS
//                   is unavailable (browser-node-store)
//   - `blobBytes` : raw plaintext blob bytes (Uint8Array) keyed by content hash
//                   for sync-session blob transfer (browser-blob-store)
//   - `directoryHandles`: user-approved File System Access directory handles
//   - `storageJobPayloads`: durable encrypted backup chunks for restartable jobs
//
// In Node + Vitest, `fake-indexeddb/auto` (installed by the test setup) provides
// `globalThis.indexedDB`, so this module runs unchanged under the contract tests.

export const IDB_NAME = 'meerkat-web';
// Version fence: pre-ownership clients opened v4. Their versionchange handler
// closes the connection; reopening v4 after this upgrade fails instead of
// allowing a stale, lock-unaware image to overwrite the authoritative writer.
export const IDB_VERSION = 5;

export const STORE_SQLITE = 'sqlite';
export const STORE_SECRETS = 'secrets';
export const STORE_BLOCKS = 'blocks';
export const STORE_BLOB_BYTES = 'blobBytes';
export const STORE_DIRECTORY_HANDLES = 'directoryHandles';
export const STORE_STORAGE_JOB_PAYLOADS = 'storageJobPayloads';

const ALL_STORES = [
  STORE_SQLITE,
  STORE_SECRETS,
  STORE_BLOCKS,
  STORE_BLOB_BYTES,
  STORE_DIRECTORY_HANDLES,
  STORE_STORAGE_JOB_PAYLOADS,
] as const;

function getIndexedDB(): IDBFactory {
  const idb = globalThis.indexedDB;
  if (!idb) {
    throw new Error('IndexedDB is not available in this environment');
  }
  return idb;
}

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

let dbPromise: Promise<IDBDatabase> | null = null;

export function openMeerkatIdb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  const pending = new Promise<IDBDatabase>((resolve, reject) => {
    const request = getIndexedDB().open(IDB_NAME, IDB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const store of ALL_STORES) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store);
        }
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        if (dbPromise === pending) dbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
    request.onblocked = () => reject(new Error(
      'Meerkat storage upgrade is blocked by another open tab. Close or reload other Meerkat tabs and retry.',
    ));
  });
  dbPromise = pending;
  void pending.catch(() => {
    if (dbPromise === pending) dbPromise = null;
  });
  return pending;
}

export async function idbGet<T>(store: string, key: IDBValidKey): Promise<T | undefined> {
  const db = await openMeerkatIdb();
  const tx = db.transaction(store, 'readonly');
  const result = await promisifyRequest<T | undefined>(tx.objectStore(store).get(key));
  return result;
}

export async function idbPut(store: string, key: IDBValidKey, value: unknown): Promise<void> {
  const db = await openMeerkatIdb();
  const tx = db.transaction(store, 'readwrite');
  await promisifyRequest(tx.objectStore(store).put(value, key));
  await txDone(tx);
}

/**
 * Put several key/value pairs in ONE readwrite transaction so they land (or
 * fail) together. The secret vault uses this to keep the encrypted vault and
 * its wrapping-key record consistent under a single commit.
 */
export async function idbPutMany(
  store: string,
  entries: ReadonlyArray<readonly [IDBValidKey, unknown]>,
): Promise<void> {
  const db = await openMeerkatIdb();
  const tx = db.transaction(store, 'readwrite');
  const objectStore = tx.objectStore(store);
  for (const [key, value] of entries) objectStore.put(value, key);
  await txDone(tx);
}

export async function idbDelete(store: string, key: IDBValidKey): Promise<void> {
  const db = await openMeerkatIdb();
  const tx = db.transaction(store, 'readwrite');
  await promisifyRequest(tx.objectStore(store).delete(key));
  await txDone(tx);
}

export async function idbHas(store: string, key: IDBValidKey): Promise<boolean> {
  const db = await openMeerkatIdb();
  const tx = db.transaction(store, 'readonly');
  const count = await promisifyRequest<number>(tx.objectStore(store).count(key));
  return count > 0;
}

export async function idbClear(store: string): Promise<void> {
  const db = await openMeerkatIdb();
  const tx = db.transaction(store, 'readwrite');
  await promisifyRequest(tx.objectStore(store).clear());
  await txDone(tx);
}

export async function idbDeletePrefix(store: string, prefix: string): Promise<void> {
  const db = await openMeerkatIdb();
  const tx = db.transaction(store, 'readwrite');
  const objectStore = tx.objectStore(store);
  const keys = await promisifyRequest<IDBValidKey[]>(objectStore.getAllKeys());
  for (const key of keys) {
    if (typeof key === 'string' && key.startsWith(prefix)) objectStore.delete(key);
  }
  await txDone(tx);
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

/**
 * Drop the cached connection. Tests use this between persist/reload cases so a
 * fresh adapter re-opens the same on-disk (fake-indexeddb) database.
 */
export function resetMeerkatIdbCache(): void {
  dbPromise = null;
}

/**
 * Close the open IndexedDB connection (if any) and drop the cache. Tests call
 * this before deleteDatabase so the delete does not block on a live connection.
 */
export async function closeMeerkatIdb(): Promise<void> {
  const pending = dbPromise;
  dbPromise = null;
  if (!pending) return;
  try {
    const db = await pending;
    db.close();
  } catch {
    // Nothing to close.
  }
}
