// Minimal promise-wrapped IndexedDB helper for the hub web sync bootstrap.
//
// Two object stores live in one database: `sqlite` (the exported sql.js bytes of
// the browser sync DB) and `secrets` (the device-key / shared-secret image the
// SyncSecretStore persists). Both are written as opaque values keyed by string.
// This mirrors apps/meerkat-web/src/lib/storage/idb.ts; it is duplicated rather
// than imported because meerkat-web has no package `exports` boundary.

const DB_NAME = 'mylife-hub-sync';
const DB_VERSION = 1;

export const STORE_SQLITE = 'sqlite';
export const STORE_SECRETS = 'secrets';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this environment.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_SQLITE)) {
        db.createObjectStore(STORE_SQLITE);
      }
      if (!db.objectStoreNames.contains(STORE_SECRETS)) {
        db.createObjectStore(STORE_SECRETS);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
  });
  return dbPromise;
}

export async function idbGet<T>(store: string, key: string): Promise<T | null> {
  const db = await openDb();
  return new Promise<T | null>((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve((req.result as T) ?? null);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB get failed'));
  });
}

export async function idbPut(store: string, key: string, value: unknown): Promise<void> {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB put failed'));
  });
}

export async function idbDelete(store: string, key: string): Promise<void> {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB delete failed'));
  });
}

export async function idbGetAll(
  store: string,
): Promise<Array<{ key: string; value: unknown }>> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const objectStore = tx.objectStore(store);
    const keysReq = objectStore.getAllKeys();
    const valuesReq = objectStore.getAll();
    tx.oncomplete = () => {
      const keys = keysReq.result as IDBValidKey[];
      const values = valuesReq.result as unknown[];
      resolve(keys.map((k, i) => ({ key: String(k), value: values[i] })));
    };
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB getAll failed'));
  });
}

/** Test hook: drop the cached connection so a fresh open runs. */
export function resetIdbCache(): void {
  dbPromise = null;
}
