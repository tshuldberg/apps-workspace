import type { DatabaseAdapter } from '@mylife/db';
import type { StorageAuthorizationInput } from '@mylife/sync/src/storage/types';
import {
  LIBRARY_STORAGE_BUDGET_SETTING_KEY,
  parseStorageBudget,
} from '../library-storage-core';
import { getSetting } from '../meerkat-data';
import {
  LOCAL_DESTINATION_OBJECT_LIMIT_BYTES,
  LocalDeviceDestinationAdapter,
  type LocalContentAccountingProvider,
  type LocalDestinationDurability,
  type LocalDestinationStore,
  type LocalDeviceDestinationAdapterOptions,
} from './local-destination-core';
import { BrowserNodeStore, createBlockBackend } from './browser-node-store';
import {
  STORE_BLOB_BYTES,
  idbDelete,
  idbGet,
  idbPut,
  openMeerkatIdb,
} from './idb';

const DESTINATION_ID_PATTERN = /^[A-Za-z0-9._-]{1,120}$/u;

export const WEB_LOCAL_STORAGE_CAVEAT =
  'Browser storage may be cleared unless this browser grants persistent storage. Download a backup for a copy you control.';

export interface BrowserLocalKeyValueStore {
  readonly persistentCapable: boolean;
  get(key: string): Promise<Uint8Array | null>;
  put(key: string, bytes: Uint8Array): Promise<void>;
  delete(key: string): Promise<boolean>;
  keys(prefix: string): Promise<string[]>;
}

export interface BrowserStoragePersistence {
  persisted(): Promise<boolean>;
  persist(): Promise<boolean>;
  estimate(): Promise<{ usage?: number; quota?: number }>;
}

class IndexedDbLocalKeyValueStore implements BrowserLocalKeyValueStore {
  readonly persistentCapable = true;

  async get(key: string): Promise<Uint8Array | null> {
    const value = await idbGet<Uint8Array | ArrayBuffer>(STORE_BLOB_BYTES, key);
    if (!value) return null;
    return value instanceof Uint8Array ? new Uint8Array(value) : new Uint8Array(value);
  }

  async put(key: string, bytes: Uint8Array): Promise<void> {
    await idbPut(STORE_BLOB_BYTES, key, new Uint8Array(bytes));
  }

  async delete(key: string): Promise<boolean> {
    const existed = (await this.get(key)) !== null;
    await idbDelete(STORE_BLOB_BYTES, key);
    return existed;
  }

  async keys(prefix: string): Promise<string[]> {
    const db = await openMeerkatIdb();
    const transaction = db.transaction(STORE_BLOB_BYTES, 'readonly');
    const request = transaction.objectStore(STORE_BLOB_BYTES).getAllKeys();
    const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB key listing failed.'));
    });
    return keys
      .filter((key): key is string => typeof key === 'string' && key.startsWith(prefix))
      .sort();
  }
}

export class MemoryLocalKeyValueStore implements BrowserLocalKeyValueStore {
  readonly persistentCapable = false;
  private readonly values = new Map<string, Uint8Array>();

  async get(key: string): Promise<Uint8Array | null> {
    const value = this.values.get(key);
    return value ? new Uint8Array(value) : null;
  }

  async put(key: string, bytes: Uint8Array): Promise<void> {
    this.values.set(key, new Uint8Array(bytes));
  }

  async delete(key: string): Promise<boolean> {
    return this.values.delete(key);
  }

  async keys(prefix: string): Promise<string[]> {
    return [...this.values.keys()].filter((key) => key.startsWith(prefix)).sort();
  }
}

function defaultPersistence(): BrowserStoragePersistence | null {
  const storage = globalThis.navigator?.storage;
  if (
    !storage
    || typeof storage.persisted !== 'function'
    || typeof storage.persist !== 'function'
    || typeof storage.estimate !== 'function'
  ) return null;
  return {
    persisted: () => storage.persisted(),
    persist: () => storage.persist(),
    estimate: () => storage.estimate(),
  };
}

function indexedDbAvailable(): boolean {
  return typeof globalThis.indexedDB !== 'undefined';
}

export class BrowserLocalDestinationStore implements LocalDestinationStore {
  readonly credentialRef: string;
  readonly maximumObjectBytes: number;
  readonly backgroundWrite = false;
  private readonly prefix: string;

  constructor(
    private readonly keyValueStore: BrowserLocalKeyValueStore,
    private readonly persistence: BrowserStoragePersistence | null,
    destinationId: string,
    maximumObjectBytes = LOCAL_DESTINATION_OBJECT_LIMIT_BYTES,
  ) {
    if (!DESTINATION_ID_PATTERN.test(destinationId) || destinationId === '.' || destinationId === '..') {
      throw new Error('Local destinationId must be a path-safe opaque id.');
    }
    this.credentialRef = `browser-local:${destinationId}`;
    this.maximumObjectBytes = maximumObjectBytes;
    this.prefix = `storage:${destinationId}:`;
  }

  async prepareAuthorization(input: StorageAuthorizationInput): Promise<void> {
    if (input.kind === 'interactive' && this.persistence) {
      try {
        if (!(await this.persistence.persisted())) await this.persistence.persist();
      } catch {
        // Authorization still succeeds with an honest evictable health state.
      }
    }
  }

  async durability(): Promise<LocalDestinationDurability> {
    if (!this.keyValueStore.persistentCapable) return 'session_only';
    if (!this.persistence) return 'evictable';
    try {
      return await this.persistence.persisted() ? 'durable' : 'evictable';
    } catch {
      return 'evictable';
    }
  }

  async read(key: string): Promise<Uint8Array | null> {
    return this.keyValueStore.get(this.key(key));
  }

  async write(key: string, bytes: Uint8Array): Promise<void> {
    const storageKey = this.key(key);
    await this.keyValueStore.put(storageKey, bytes);
    const readBack = await this.keyValueStore.get(storageKey);
    if (!readBack || readBack.length !== bytes.length) {
      throw new Error('Browser local write did not land with the expected byte count.');
    }
  }

  async delete(key: string): Promise<boolean> {
    return this.keyValueStore.delete(this.key(key));
  }

  async list(): Promise<string[]> {
    return (await this.keyValueStore.keys(this.prefix)).map((key) => key.slice(this.prefix.length));
  }

  async usedBytes(): Promise<number> {
    let total = 0;
    for (const key of await this.keyValueStore.keys(this.prefix)) {
      const bytes = await this.keyValueStore.get(key);
      if (!bytes) continue;
      total += bytes.length;
      if (!Number.isSafeInteger(total)) throw new Error('Browser local used bytes exceed the safe range.');
    }
    return total;
  }

  async freeBytes(): Promise<{ bytes: number | null; estimated: boolean }> {
    if (!this.persistence) return { bytes: null, estimated: true };
    try {
      const estimate = await this.persistence.estimate();
      if (
        typeof estimate.usage !== 'number'
        || typeof estimate.quota !== 'number'
        || !Number.isFinite(estimate.usage)
        || !Number.isFinite(estimate.quota)
      ) return { bytes: null, estimated: true };
      const bytes = Math.max(0, Math.floor(estimate.quota - estimate.usage));
      return { bytes: Number.isSafeInteger(bytes) ? bytes : null, estimated: true };
    } catch {
      return { bytes: null, estimated: true };
    }
  }

  private key(key: string): string {
    if (!/^[A-Za-z0-9._-]+$/u.test(key)) throw new Error('Browser local storage key is not safe.');
    return `${this.prefix}${key}`;
  }
}

export function createBrowserLocalContentAccounting(
  db: DatabaseAdapter,
): LocalContentAccountingProvider {
  const nodeStore = new BrowserNodeStore(db, createBlockBackend());
  return {
    async snapshot() {
      const [nodeStats, pinClasses] = await Promise.all([
        nodeStore.stats(),
        nodeStore.classBreakdown(),
      ]);
      let blobBytes = 0;
      try {
        blobBytes = db.query<{ total_bytes: number | null }>(
          'SELECT COALESCE(SUM(size), 0) AS total_bytes FROM sync_blobs',
        )[0]?.total_bytes ?? 0;
      } catch {
        // The sync schema may not be bootstrapped during an import-only flow.
      }
      return {
        blobBytes,
        nodeBytes: nodeStats.totalBytes,
        budgetBytes: parseStorageBudget(getSetting(db, LIBRARY_STORAGE_BUDGET_SETTING_KEY)),
        pinClasses,
      };
    },
  };
}

export interface WebLocalDeviceAdapterOptions extends LocalDeviceDestinationAdapterOptions {
  destinationId: string;
  keyValueStore?: BrowserLocalKeyValueStore;
  persistence?: BrowserStoragePersistence | null;
  db?: DatabaseAdapter;
  maximumObjectBytes?: number;
}

export function createWebLocalDeviceDestinationAdapter(
  options: WebLocalDeviceAdapterOptions,
): LocalDeviceDestinationAdapter {
  const keyValueStore = options.keyValueStore
    ?? (indexedDbAvailable() ? new IndexedDbLocalKeyValueStore() : new MemoryLocalKeyValueStore());
  const store = new BrowserLocalDestinationStore(
    keyValueStore,
    options.persistence === undefined ? defaultPersistence() : options.persistence,
    options.destinationId,
    options.maximumObjectBytes,
  );
  return new LocalDeviceDestinationAdapter(store, {
    now: options.now,
    pageSize: options.pageSize,
    accounting: options.accounting ?? (options.db ? createBrowserLocalContentAccounting(options.db) : undefined),
  });
}
