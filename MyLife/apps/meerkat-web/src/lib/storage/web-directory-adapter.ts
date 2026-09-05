import {
  StorageAdapterError,
  type StorageDestinationAdapter,
} from '@mylife/sync/src/storage/types';
import {
  DirectoryDestinationAdapter,
  type DirectoryDestinationAccess,
} from './directory-destination-core';
import {
  STORE_DIRECTORY_HANDLES,
  idbDelete,
  idbGet,
  idbPut,
} from './idb';

const APP_DIRECTORY = 'Meerkat';
const CREDENTIAL_PREFIX = 'web-directory:';

export const WEB_DIRECTORY_UNAVAILABLE_COPY =
  'This browser cannot keep a folder connected. Use Download to save a copy and Upload to restore one. Those copies are not persistent destinations.';

export type WebDirectoryPermission = 'granted' | 'denied' | 'prompt';

export interface WebWritableFile {
  write(data: ArrayBuffer): Promise<void>;
  close(): Promise<void>;
}

export interface WebFileHandle {
  readonly kind: 'file';
  readonly name: string;
  createWritable(): Promise<WebWritableFile>;
  getFile(): Promise<{ arrayBuffer(): Promise<ArrayBuffer> }>;
}

export interface WebDirectoryHandle {
  readonly kind: 'directory';
  readonly name: string;
  queryPermission(options: { mode: 'readwrite' }): Promise<WebDirectoryPermission>;
  requestPermission(options: { mode: 'readwrite' }): Promise<WebDirectoryPermission>;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<WebDirectoryHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<WebFileHandle>;
  removeEntry(name: string): Promise<void>;
  values(): AsyncIterableIterator<WebDirectoryHandle | WebFileHandle>;
}

export interface WebDirectoryHandleStore {
  get(key: string): Promise<WebDirectoryHandle | null>;
  put(key: string, handle: WebDirectoryHandle): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface WebDirectoryAdapterOptions {
  picker?: () => Promise<WebDirectoryHandle>;
  handleStore?: WebDirectoryHandleStore;
  handleKey?: string;
  initialCredentialRef?: string;
}

class IndexedDbDirectoryHandleStore implements WebDirectoryHandleStore {
  async get(key: string): Promise<WebDirectoryHandle | null> {
    return (await idbGet<WebDirectoryHandle>(STORE_DIRECTORY_HANDLES, key)) ?? null;
  }

  async put(key: string, handle: WebDirectoryHandle): Promise<void> {
    await idbPut(STORE_DIRECTORY_HANDLES, key, handle);
  }

  async delete(key: string): Promise<void> {
    await idbDelete(STORE_DIRECTORY_HANDLES, key);
  }
}

function permissionError(): StorageAdapterError {
  return new StorageAdapterError(
    'auth_required',
    'Folder permission changed. Choose the folder again to resume jobs.',
    false,
  );
}

function errorName(error: unknown): string {
  if (!error || typeof error !== 'object' || !('name' in error)) return '';
  const name = (error as Record<string, unknown>).name;
  return typeof name === 'string' ? name : '';
}

function isNotFound(error: unknown): boolean {
  return errorName(error) === 'NotFoundError';
}

function mapFileSystemError(error: unknown): StorageAdapterError {
  if (error instanceof StorageAdapterError) return error;
  const name = errorName(error);
  if (name === 'NotAllowedError' || name === 'SecurityError') return permissionError();
  const message = error instanceof Error && error.message
    ? error.message
    : 'The browser folder operation failed.';
  return new StorageAdapterError('provider_error', message, true);
}

function credentialKey(reference: string | undefined): string | null {
  if (!reference?.startsWith(CREDENTIAL_PREFIX)) return null;
  const key = reference.slice(CREDENTIAL_PREFIX.length).trim();
  return key || null;
}

class WebDirectoryAccess implements DirectoryDestinationAccess {
  readonly backgroundWrite = false;
  private handle: WebDirectoryHandle | null = null;
  private handleKey: string;
  private revoked = false;

  constructor(
    private readonly picker: () => Promise<WebDirectoryHandle>,
    private readonly store: WebDirectoryHandleStore,
    options: WebDirectoryAdapterOptions,
  ) {
    this.handleKey = credentialKey(options.initialCredentialRef)
      ?? options.handleKey?.trim()
      ?? 'default';
  }

  async authorize(input: Parameters<DirectoryDestinationAccess['authorize']>[0]) {
    this.handleKey = credentialKey(input.credentialRef) ?? this.handleKey;
    await this.loadHandle();
    if (input.kind === 'interactive' && !this.handle) {
      try {
        this.handle = await this.picker();
      } catch (error) {
        if (errorName(error) === 'AbortError') return { kind: 'cancelled' as const };
        throw mapFileSystemError(error);
      }
    }
    if (!this.handle) return { kind: 'authorization_required' as const };
    let permission = await this.handle.queryPermission({ mode: 'readwrite' });
    if (permission !== 'granted' && input.kind === 'interactive') {
      permission = await this.handle.requestPermission({ mode: 'readwrite' });
    }
    if (permission !== 'granted') {
      return {
        kind: 'authorization_required' as const,
        credentialRef: `${CREDENTIAL_PREFIX}${this.handleKey}`,
      };
    }
    await this.store.put(this.handleKey, this.handle);
    this.revoked = false;
    return {
      kind: 'authorized' as const,
      credentialRef: `${CREDENTIAL_PREFIX}${this.handleKey}`,
    };
  }

  async revoke(): Promise<void> {
    await this.store.delete(this.handleKey);
    this.handle = null;
    this.revoked = true;
  }

  async health() {
    if (this.revoked) {
      return {
        state: 'revoked' as const,
        verifiedReadWrite: false,
        checkedAt: new Date().toISOString(),
        errorCode: 'web_directory_revoked',
      };
    }
    await this.loadHandle();
    if (!this.handle) {
      return {
        state: 'auth_required' as const,
        verifiedReadWrite: false,
        checkedAt: new Date().toISOString(),
        errorCode: 'web_directory_required',
      };
    }
    try {
      const permission = await this.handle.queryPermission({ mode: 'readwrite' });
      if (permission !== 'granted') {
        return {
          state: 'auth_required' as const,
          verifiedReadWrite: false,
          checkedAt: new Date().toISOString(),
          errorCode: 'web_directory_permission_required',
        };
      }
      return {
        state: 'ok' as const,
        verifiedReadWrite: false,
        checkedAt: new Date().toISOString(),
      };
    } catch (error) {
      throw mapFileSystemError(error);
    }
  }

  async ensureAccess(): Promise<void> {
    if (this.revoked) throw permissionError();
    await this.loadHandle();
    if (!this.handle) throw permissionError();
    let permission: WebDirectoryPermission;
    try {
      permission = await this.handle.queryPermission({ mode: 'readwrite' });
    } catch (error) {
      throw mapFileSystemError(error);
    }
    if (permission !== 'granted') throw permissionError();
  }

  async read(fileName: string): Promise<Uint8Array | null> {
    try {
      const directory = await this.appDirectory(false);
      if (!directory) return null;
      await this.ensureAccess();
      let fileHandle: WebFileHandle;
      try {
        fileHandle = await directory.getFileHandle(fileName, { create: false });
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
      const file = await fileHandle.getFile();
      return new Uint8Array(await file.arrayBuffer());
    } catch (error) {
      throw mapFileSystemError(error);
    }
  }

  async write(fileName: string, bytes: Uint8Array): Promise<void> {
    try {
      const directory = await this.appDirectory(true);
      if (!directory) throw new Error('The selected folder could not be opened.');
      await this.ensureAccess();
      const fileHandle = await directory.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      const copy = Uint8Array.from(bytes);
      await writable.write(copy.buffer);
      await writable.close();
      await this.ensureAccess();
    } catch (error) {
      throw mapFileSystemError(error);
    }
  }

  async list(): Promise<string[]> {
    try {
      const directory = await this.appDirectory(false);
      if (!directory) return [];
      await this.ensureAccess();
      const names: string[] = [];
      for await (const entry of directory.values()) {
        if (entry.kind === 'file') names.push(entry.name);
      }
      return names.sort();
    } catch (error) {
      throw mapFileSystemError(error);
    }
  }

  async delete(fileName: string): Promise<boolean> {
    try {
      const directory = await this.appDirectory(false);
      if (!directory) return false;
      await this.ensureAccess();
      try {
        await directory.getFileHandle(fileName, { create: false });
      } catch (error) {
        if (isNotFound(error)) return false;
        throw error;
      }
      await directory.removeEntry(fileName);
      return true;
    } catch (error) {
      throw mapFileSystemError(error);
    }
  }

  private async loadHandle(): Promise<void> {
    if (!this.handle) this.handle = await this.store.get(this.handleKey);
  }

  private async appDirectory(create: boolean): Promise<WebDirectoryHandle | null> {
    await this.ensureAccess();
    const root = this.handle!;
    try {
      return await root.getDirectoryHandle(APP_DIRECTORY, { create });
    } catch (error) {
      if (!create && isNotFound(error)) return null;
      throw mapFileSystemError(error);
    }
  }
}

function defaultPicker(): (() => Promise<WebDirectoryHandle>) | null {
  const global = globalThis as typeof globalThis & {
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
  };
  if (typeof global.showDirectoryPicker !== 'function') return null;
  return async () => global.showDirectoryPicker!() as unknown as WebDirectoryHandle;
}

function indexedDbAvailable(): boolean {
  return typeof globalThis.indexedDB !== 'undefined';
}

export function createWebDirectoryDestinationAdapter(
  options: WebDirectoryAdapterOptions = {},
): StorageDestinationAdapter | null {
  const picker = options.picker ?? defaultPicker();
  if (!picker) return null;
  if (!options.handleStore && !indexedDbAvailable()) return null;
  const store = options.handleStore ?? new IndexedDbDirectoryHandleStore();
  return new DirectoryDestinationAdapter(new WebDirectoryAccess(picker, store, options));
}
