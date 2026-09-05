import { describe, expect, it } from 'vitest';
import { sha512Hex } from '@mylife/sync/src/node/hkdf';
import {
  StorageAdapterError,
  type EncryptedStorageObject,
} from '@mylife/sync/src/storage/types';
import {
  createWebDirectoryDestinationAdapter,
  WEB_DIRECTORY_UNAVAILABLE_COPY,
  type WebDirectoryHandle,
  type WebDirectoryHandleStore,
  type WebDirectoryPermission,
  type WebFileHandle,
  type WebWritableFile,
} from '../web-directory-adapter';

function notFound(): Error {
  const error = new Error('Not found');
  Object.defineProperty(error, 'name', { value: 'NotFoundError' });
  return error;
}

class MemoryHandleStore implements WebDirectoryHandleStore {
  private readonly handles = new Map<string, WebDirectoryHandle>();

  async get(key: string): Promise<WebDirectoryHandle | null> {
    return this.handles.get(key) ?? null;
  }

  async put(key: string, handle: WebDirectoryHandle): Promise<void> {
    this.handles.set(key, handle);
  }

  async delete(key: string): Promise<void> {
    this.handles.delete(key);
  }
}

interface FakeController {
  permission: WebDirectoryPermission;
  corruptAfterMetadata: boolean;
  corruptReads: boolean;
  revokeAfterObjectWrite: boolean;
}

class FakeFileHandle implements WebFileHandle {
  readonly kind = 'file' as const;
  private bytes = new Uint8Array(0);

  constructor(readonly name: string, private readonly controller: FakeController) {}

  async createWritable(): Promise<WebWritableFile> {
    let pending = new Uint8Array(0);
    return {
      write: async (data) => { pending = new Uint8Array(data.slice(0)); },
      close: async () => {
        this.bytes = new Uint8Array(pending);
        if (this.name.startsWith('object-') && this.controller.revokeAfterObjectWrite) {
          this.controller.permission = 'denied';
        }
        if (this.name.startsWith('metadata-') && this.controller.corruptAfterMetadata) {
          this.controller.corruptReads = true;
        }
      },
    };
  }

  async getFile(): Promise<{ arrayBuffer(): Promise<ArrayBuffer> }> {
    const value = this.controller.corruptReads && this.name.startsWith('object-')
      ? new Uint8Array([255])
      : new Uint8Array(this.bytes);
    return { arrayBuffer: async () => Uint8Array.from(value).buffer };
  }
}

class FakeDirectoryHandle implements WebDirectoryHandle {
  readonly kind = 'directory' as const;
  private readonly directories = new Map<string, FakeDirectoryHandle>();
  private readonly files = new Map<string, FakeFileHandle>();

  constructor(readonly name: string, private readonly controller: FakeController) {}

  async queryPermission(): Promise<WebDirectoryPermission> {
    return this.controller.permission;
  }

  async requestPermission(): Promise<WebDirectoryPermission> {
    return this.controller.permission;
  }

  async getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<WebDirectoryHandle> {
    const existing = this.directories.get(name);
    if (existing) return existing;
    if (!options?.create) throw notFound();
    const created = new FakeDirectoryHandle(name, this.controller);
    this.directories.set(name, created);
    return created;
  }

  async getFileHandle(name: string, options?: { create?: boolean }): Promise<WebFileHandle> {
    const existing = this.files.get(name);
    if (existing) return existing;
    if (!options?.create) throw notFound();
    const created = new FakeFileHandle(name, this.controller);
    this.files.set(name, created);
    return created;
  }

  async removeEntry(name: string): Promise<void> {
    if (!this.files.delete(name) && !this.directories.delete(name)) throw notFound();
  }

  async *values(): AsyncIterableIterator<WebDirectoryHandle | WebFileHandle> {
    for (const directory of this.directories.values()) yield directory;
    for (const file of this.files.values()) yield file;
  }
}

function object(objectId = 'web-directory-a'): EncryptedStorageObject {
  const ciphertext = new Uint8Array([3, 1, 4, 1, 5]);
  return {
    objectId,
    dataClass: 'backup_chunk',
    ciphertext,
    ciphertextHash: sha512Hex(ciphertext),
    encryptedBytes: ciphertext.length,
  };
}

function harness(overrides: Partial<FakeController> = {}) {
  const controller: FakeController = {
    permission: 'granted',
    corruptAfterMetadata: false,
    corruptReads: false,
    revokeAfterObjectWrite: false,
    ...overrides,
  };
  const root = new FakeDirectoryHandle('Backups', controller);
  const store = new MemoryHandleStore();
  return { controller, root, store, picker: async () => root as WebDirectoryHandle };
}

describe('web directory destination', () => {
  it('returns null when the File System Access directory picker is unsupported', () => {
    expect(createWebDirectoryDestinationAdapter()).toBeNull();
    expect(WEB_DIRECTORY_UNAVAILABLE_COPY).toContain('Download');
    expect(WEB_DIRECTORY_UNAVAILABLE_COPY).toContain('Upload');
    expect(WEB_DIRECTORY_UNAVAILABLE_COPY).toContain('not persistent');
  });

  it('persists the approved handle and re-queries it after adapter restart', async () => {
    const test = harness();
    const first = createWebDirectoryDestinationAdapter({
      picker: test.picker,
      handleStore: test.store,
      handleKey: 'backup-a',
    })!;
    const authorization = await first.authorize({ kind: 'interactive' });
    expect(authorization).toEqual({
      kind: 'authorized',
      credentialRef: 'web-directory:backup-a',
    });

    const restarted = createWebDirectoryDestinationAdapter({
      picker: test.picker,
      handleStore: test.store,
      initialCredentialRef: 'web-directory:backup-a',
    })!;
    await expect(restarted.authorize({
      kind: 'stored_credential',
      credentialRef: 'web-directory:backup-a',
    })).resolves.toMatchObject({ kind: 'authorized' });
  });

  it('fails closed when permission is revoked during a write job', async () => {
    const test = harness({ revokeAfterObjectWrite: true });
    const adapter = createWebDirectoryDestinationAdapter({
      picker: test.picker,
      handleStore: test.store,
    })!;
    await adapter.authorize({ kind: 'interactive' });
    await expect(adapter.putObject(object('revoked-mid-job'))).rejects.toMatchObject({
      code: 'auth_required',
      retryable: false,
    });
    await expect(adapter.health()).resolves.toMatchObject({
      state: 'auth_required',
      errorCode: 'web_directory_permission_required',
    });
  });

  it('fails closed when provider read-back bytes do not match', async () => {
    const test = harness({ corruptAfterMetadata: true });
    const adapter = createWebDirectoryDestinationAdapter({
      picker: test.picker,
      handleStore: test.store,
    })!;
    await adapter.authorize({ kind: 'interactive' });
    await expect(adapter.putObject(object('mismatch'))).rejects.toSatisfy((error: unknown) =>
      error instanceof StorageAdapterError
      && error.code === 'corrupt_ciphertext'
      && error.retryable === false);
  });

  it('returns read-back evidence after reopening matching bytes', async () => {
    const test = harness();
    const adapter = createWebDirectoryDestinationAdapter({
      picker: test.picker,
      handleStore: test.store,
    })!;
    await adapter.authorize({ kind: 'interactive' });
    const input = object('verified');
    await expect(adapter.putObject(input)).resolves.toMatchObject({
      complete: true,
      verified: true,
      verification: { kind: 'read_back', ciphertextHash: input.ciphertextHash },
    });
  });
});
