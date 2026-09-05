import { getPrivateStorageRoot } from '../private-storage';
import type { DatabaseAdapter } from '@mylife/db';
import type { StorageAuthorizationInput } from '@mylife/sync/src/storage/types';
import { decodeBase64, encodeBase64 } from 'tweetnacl-util';
import { ExpoNodeStore } from '../expo-node-store';
import { getSetting } from '../db';
import {
  LIBRARY_STORAGE_BUDGET_SETTING_KEY,
  parseStorageBudget,
} from '../library-storage-core';
import {
  LOCAL_DESTINATION_OBJECT_LIMIT_BYTES,
  LocalDeviceDestinationAdapter,
  type LocalContentAccountingProvider,
  type LocalDestinationStore,
  type LocalDeviceDestinationAdapterOptions,
} from './local-destination-core';

const DESTINATION_ID_PATTERN = /^[A-Za-z0-9._-]{1,120}$/u;

export interface MobileLocalFileInfo {
  exists: boolean;
  size: number;
}

export interface MobileLocalFileSystem {
  /** Internal storage root; never the Files-visible Documents directory on iOS. */
  readonly documentDirectory: string | null;
  ensureDirectory(uri: string): Promise<void>;
  info(uri: string): Promise<MobileLocalFileInfo>;
  readBytes(uri: string): Promise<Uint8Array>;
  writeBytes(uri: string, bytes: Uint8Array): Promise<void>;
  delete(uri: string): Promise<boolean>;
  list(uri: string): Promise<string[]>;
  freeBytes(): Promise<number | null>;
}

interface ExpoLegacyFileSystemModule {
  documentDirectory: string | null;
  EncodingType: { Base64: string };
  getInfoAsync(uri: string): Promise<{
    exists: boolean;
    size?: number;
  }>;
  makeDirectoryAsync(uri: string, options: { intermediates: boolean }): Promise<void>;
  readAsStringAsync(uri: string, options: { encoding: string }): Promise<string>;
  writeAsStringAsync(uri: string, value: string, options: { encoding: string }): Promise<void>;
  deleteAsync(uri: string, options: { idempotent: boolean }): Promise<void>;
  readDirectoryAsync(uri: string): Promise<string[]>;
  getFreeDiskStorageAsync?: () => Promise<number>;
}

function loadExpoFileSystem(): ExpoLegacyFileSystemModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-file-system/legacy') as ExpoLegacyFileSystemModule;
  } catch {
    return null;
  }
}

export function createExpoLocalFileSystem(): MobileLocalFileSystem | null {
  const fileSystem = loadExpoFileSystem();
  if (!fileSystem) return null;
  return {
    documentDirectory: getPrivateStorageRoot(),
    async ensureDirectory(uri): Promise<void> {
      const info = await fileSystem.getInfoAsync(uri);
      if (!info.exists) await fileSystem.makeDirectoryAsync(uri, { intermediates: true });
    },
    async info(uri): Promise<MobileLocalFileInfo> {
      const info = await fileSystem.getInfoAsync(uri);
      return { exists: info.exists, size: info.exists ? (info.size ?? 0) : 0 };
    },
    async readBytes(uri): Promise<Uint8Array> {
      const value = await fileSystem.readAsStringAsync(uri, {
        encoding: fileSystem.EncodingType.Base64,
      });
      return decodeBase64(value);
    },
    async writeBytes(uri, bytes): Promise<void> {
      await fileSystem.writeAsStringAsync(uri, encodeBase64(bytes), {
        encoding: fileSystem.EncodingType.Base64,
      });
    },
    async delete(uri): Promise<boolean> {
      const before = await fileSystem.getInfoAsync(uri);
      if (!before.exists) return false;
      await fileSystem.deleteAsync(uri, { idempotent: true });
      const after = await fileSystem.getInfoAsync(uri);
      if (after.exists) throw new Error('The local file remained after deletion.');
      return true;
    },
    async list(uri): Promise<string[]> {
      const info = await fileSystem.getInfoAsync(uri);
      return info.exists ? fileSystem.readDirectoryAsync(uri) : [];
    },
    async freeBytes(): Promise<number | null> {
      if (!fileSystem.getFreeDiskStorageAsync) return null;
      try {
        const bytes = await fileSystem.getFreeDiskStorageAsync();
        return Number.isSafeInteger(bytes) && bytes >= 0 ? bytes : null;
      } catch {
        return null;
      }
    },
  };
}

export class MobileLocalDestinationStore implements LocalDestinationStore {
  readonly credentialRef: string;
  readonly maximumObjectBytes: number;
  readonly backgroundWrite = true;
  readonly directory: string;

  constructor(
    private readonly fileSystem: MobileLocalFileSystem,
    destinationId: string,
    maximumObjectBytes = LOCAL_DESTINATION_OBJECT_LIMIT_BYTES,
  ) {
    if (!DESTINATION_ID_PATTERN.test(destinationId) || destinationId === '.' || destinationId === '..') {
      throw new Error('Local destinationId must be a path-safe opaque id.');
    }
    if (!fileSystem.documentDirectory) throw new Error('The app document directory is unavailable.');
    this.credentialRef = `local-device:${destinationId}`;
    this.maximumObjectBytes = maximumObjectBytes;
    this.directory = `${fileSystem.documentDirectory}meerkat/storage/${destinationId}/`;
  }

  async prepareAuthorization(_input: StorageAuthorizationInput): Promise<void> {
    await this.fileSystem.ensureDirectory(this.directory);
  }

  async durability(): Promise<'durable'> {
    return 'durable';
  }

  async read(key: string): Promise<Uint8Array | null> {
    const uri = this.path(key);
    const info = await this.fileSystem.info(uri);
    return info.exists ? this.fileSystem.readBytes(uri) : null;
  }

  async write(key: string, bytes: Uint8Array): Promise<void> {
    await this.fileSystem.ensureDirectory(this.directory);
    const uri = this.path(key);
    await this.fileSystem.writeBytes(uri, bytes);
    const info = await this.fileSystem.info(uri);
    if (!info.exists || info.size !== bytes.length) {
      throw new Error('Local file write did not land with the expected byte count.');
    }
  }

  async delete(key: string): Promise<boolean> {
    return this.fileSystem.delete(this.path(key));
  }

  async list(): Promise<string[]> {
    await this.fileSystem.ensureDirectory(this.directory);
    return (await this.fileSystem.list(this.directory)).sort();
  }

  async usedBytes(): Promise<number> {
    let total = 0;
    for (const name of await this.list()) {
      const info = await this.fileSystem.info(this.path(name));
      if (!info.exists) continue;
      total += info.size;
      if (!Number.isSafeInteger(total)) throw new Error('Local used bytes exceed the safe range.');
    }
    return total;
  }

  async freeBytes(): Promise<{ bytes: number | null; estimated: boolean }> {
    return { bytes: await this.fileSystem.freeBytes(), estimated: false };
  }

  private path(key: string): string {
    if (!/^[A-Za-z0-9._-]+$/u.test(key)) throw new Error('Local storage key is not path safe.');
    return `${this.directory}${key}`;
  }
}

export function createMobileLocalContentAccounting(
  db: DatabaseAdapter,
): LocalContentAccountingProvider {
  const nodeStore = new ExpoNodeStore(db);
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
        // A first-launch database may not have reached sync schema boot yet.
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

export interface MobileLocalDeviceAdapterOptions extends LocalDeviceDestinationAdapterOptions {
  destinationId: string;
  fileSystem?: MobileLocalFileSystem;
  db?: DatabaseAdapter;
  maximumObjectBytes?: number;
}

export function createLocalDeviceDestinationAdapter(
  options: MobileLocalDeviceAdapterOptions,
): LocalDeviceDestinationAdapter | null {
  const fileSystem = options.fileSystem ?? createExpoLocalFileSystem();
  if (!fileSystem?.documentDirectory) return null;
  const store = new MobileLocalDestinationStore(
    fileSystem,
    options.destinationId,
    options.maximumObjectBytes,
  );
  return new LocalDeviceDestinationAdapter(store, {
    now: options.now,
    pageSize: options.pageSize,
    accounting: options.accounting ?? (options.db ? createMobileLocalContentAccounting(options.db) : undefined),
  });
}
