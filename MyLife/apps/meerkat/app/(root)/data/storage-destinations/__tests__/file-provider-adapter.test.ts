import { describe, expect, it } from 'vitest';
import { sha512Hex } from '@mylife/sync/src/node/hkdf';
import {
  StorageAdapterError,
  type EncryptedStorageObject,
} from '@mylife/sync/src/storage/types';
import {
  createMeerkatICloudStorageBridge,
  type NativeBookmarkResolution,
  type RawMeerkatICloudStorageModule,
} from '@mylife/meerkat-icloud-storage';
import {
  DirectoryDestinationAdapter,
  type DirectoryDestinationAccess,
} from '../directory-destination-core';
import {
  createFileProviderDestinationAdapter,
  type AndroidSafApi,
} from '../file-provider-adapter';

function object(objectId = 'file-provider-a'): EncryptedStorageObject {
  const ciphertext = new Uint8Array([8, 6, 7, 5]);
  return {
    objectId,
    dataClass: 'backup_chunk',
    ciphertext,
    ciphertextHash: sha512Hex(ciphertext),
    encryptedBytes: ciphertext.length,
  };
}

function bookmarkNative(initialResolution: NativeBookmarkResolution) {
  const files = new Map<string, Uint8Array>();
  let resolution = initialResolution;
  const raw: RawMeerkatICloudStorageModule = {
    getContainerState: async () => ({
      status: 'no_account', containerUrl: null, identityToken: null, reachable: false,
    }),
    coordinatedWriteICloudFile: async ({ relativePath, bytes }) => ({
      relativePath, bytesWritten: bytes.length, state: 'local_container_write',
    }),
    coordinatedReadICloudFile: async () => ({ found: false, bytes: null }),
    queryICloudFileStatus: async () => ({
      exists: false,
      isUbiquitous: false,
      isUploaded: false,
      isUploading: false,
      downloadingStatus: 'unknown',
      hasUnresolvedConflicts: false,
      modificationTime: null,
    }),
    startICloudDownload: async () => {},
    stopICloudDownload: async () => {},
    listICloudConflictVersions: async () => [],
    listICloudFiles: async () => [],
    deleteICloudFile: async () => ({ deleted: false }),
    persistBookmark: async () => ({ bookmarkId: 'bookmark-a' }),
    resolveBookmark: async ({ bookmarkId }) => ({ ...resolution, bookmarkId }),
    removeBookmark: async () => ({ removed: true }),
    coordinatedWriteBookmarkFile: async ({ relativePath, bytes }) => {
      files.set(relativePath, new Uint8Array(bytes));
      return { relativePath, bytesWritten: bytes.length };
    },
    coordinatedReadBookmarkFile: async ({ relativePath }) => {
      const bytes = files.get(relativePath);
      return bytes ? { found: true, bytes: new Uint8Array(bytes) } : { found: false, bytes: null };
    },
    listBookmarkFiles: async ({ relativePath }) => [...files.entries()]
      .filter(([path]) => path.startsWith(`${relativePath}/`))
      .map(([path, bytes]) => ({ relativePath: path, size: bytes.length, modificationTime: null })),
    deleteBookmarkFile: async ({ relativePath }) => ({ deleted: files.delete(relativePath) }),
    addListener: () => ({ remove() {} }),
  };
  return {
    native: createMeerkatICloudStorageBridge(raw),
    setResolution(value: NativeBookmarkResolution) { resolution = value; },
  };
}

describe('iOS Files provider adapter', () => {
  it('returns null when the native module is absent', () => {
    expect(createFileProviderDestinationAdapter({
      platformOS: 'ios',
      native: createMeerkatICloudStorageBridge(null),
    })).toBeNull();
  });

  it('verifies only by reading bytes back through the bookmark handle', async () => {
    const harness = bookmarkNative({
      status: 'resolved', bookmarkId: 'bookmark-a', directoryUrl: 'file:///provider',
    });
    const adapter = createFileProviderDestinationAdapter({
      platformOS: 'ios',
      native: harness.native,
      selectedIosDirectoryUrl: 'file:///provider',
    })!;
    await expect(adapter.authorize({ kind: 'interactive' })).resolves.toMatchObject({
      kind: 'authorized',
      credentialRef: 'ios-bookmark:bookmark-a',
    });
    const input = object();
    const result = await adapter.putObject(input);
    expect(result).toMatchObject({
      complete: true,
      verified: true,
      verification: { kind: 'read_back', ciphertextHash: input.ciphertextHash },
    });
    expect(result.verification.kind).not.toBe('provider_checksum');
  });

  it('surfaces a stale bookmark as reselection and a non-retryable job pause', async () => {
    const harness = bookmarkNative({
      status: 'stale', bookmarkId: 'bookmark-a', directoryUrl: null,
    });
    const adapter = createFileProviderDestinationAdapter({
      platformOS: 'ios',
      native: harness.native,
      initialCredentialRef: 'ios-bookmark:bookmark-a',
    })!;
    await expect(adapter.health()).resolves.toMatchObject({
      state: 'auth_required',
      errorCode: 'file_provider_bookmark_stale',
    });
    await expect(adapter.putObject(object())).rejects.toMatchObject({
      code: 'auth_required',
      retryable: false,
    });
  });
});

function revokingSaf(revokeAtRead: number): { saf: AndroidSafApi; readCount: () => number } {
  const root = 'content://root';
  const app = 'content://root/Meerkat';
  const children = new Map<string, string[]>([[root, [app]], [app, []]]);
  const contents = new Map<string, string>();
  let reads = 0;
  const saf: AndroidSafApi = {
    base64Encoding: 'base64',
    requestDirectoryPermissionsAsync: async () => ({ granted: true, directoryUri: root }),
    readDirectoryAsync: async (uri) => {
      reads += 1;
      if (reads >= revokeAtRead) throw new Error('SecurityException');
      return [...(children.get(uri) ?? [])];
    },
    makeDirectoryAsync: async (parent, name) => {
      const uri = `${parent}/${name}`;
      children.set(uri, []);
      children.set(parent, [...(children.get(parent) ?? []), uri]);
      return uri;
    },
    createFileAsync: async (parent, name, mimeType) => {
      const extension = mimeType === 'application/json' ? '.json' : '.bin';
      const uri = `${parent}/${name}${extension}`;
      children.set(parent, [...(children.get(parent) ?? []), uri]);
      return uri;
    },
    writeAsStringAsync: async (uri, value) => { contents.set(uri, value); },
    readAsStringAsync: async (uri) => contents.get(uri) ?? '',
    deleteAsync: async (uri) => {
      contents.delete(uri);
      children.set(app, (children.get(app) ?? []).filter((entry) => entry !== uri));
    },
  };
  return { saf, readCount: () => reads };
}

describe('Android SAF permission validation', () => {
  it('re-queries permission during a job and pauses when the grant disappears', async () => {
    const harness = revokingSaf(8);
    const adapter = createFileProviderDestinationAdapter({
      platformOS: 'android',
      saf: harness.saf,
      initialCredentialRef: 'android-saf:content://root',
    })!;
    await expect(adapter.authorize({
      kind: 'stored_credential',
      credentialRef: 'android-saf:content://root',
    })).resolves.toMatchObject({ kind: 'authorized' });
    await expect(adapter.putObject(object('android-a'))).rejects.toMatchObject({
      code: 'auth_required',
      retryable: false,
    });
    expect(harness.readCount()).toBeGreaterThan(1);
    await expect(adapter.health()).resolves.toMatchObject({ state: 'auth_required' });
  });
});

describe('directory read-back validation', () => {
  it('fails closed when the provider reopens different bytes', async () => {
    const stored = new Map<string, Uint8Array>();
    const access: DirectoryDestinationAccess = {
      backgroundWrite: true,
      authorize: async () => ({ kind: 'authorized', credentialRef: 'fake' }),
      revoke: async () => {},
      health: async () => ({
        state: 'ok', verifiedReadWrite: false, checkedAt: new Date().toISOString(),
      }),
      ensureAccess: async () => {},
      read: async (name) => {
        const bytes = stored.get(name);
        if (!bytes) return null;
        if (name.startsWith('object-')) return new Uint8Array([0]);
        return new Uint8Array(bytes);
      },
      write: async (name, bytes) => { stored.set(name, new Uint8Array(bytes)); },
      list: async () => [...stored.keys()],
      delete: async (name) => stored.delete(name),
    };
    const adapter = new DirectoryDestinationAdapter(access);
    await expect(adapter.putObject(object('mismatch-a'))).rejects.toSatisfy((error: unknown) =>
      error instanceof StorageAdapterError
      && error.code === 'corrupt_ciphertext'
      && error.retryable === false);
  });
});
