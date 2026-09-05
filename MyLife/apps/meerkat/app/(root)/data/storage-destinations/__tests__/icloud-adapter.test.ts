import { describe, expect, it } from 'vitest';
import { sha512Hex } from '@mylife/sync/src/node/hkdf';
import type { EncryptedStorageObject } from '@mylife/sync/src/storage/types';
import {
  createMeerkatICloudStorageBridge,
  type NativeAccountChangedEvent,
  type NativeICloudFileStatusSnapshot,
  type RawMeerkatICloudStorageModule,
} from '@mylife/meerkat-icloud-storage';
import {
  createICloudDestinationAdapter,
  mapICloudDestinationHealth,
  statusesConfirmUbiquitousUpload,
} from '../icloud-adapter';

function object(objectId = 'object-a'): EncryptedStorageObject {
  const ciphertext = new Uint8Array([1, 2, 3, 4]);
  return {
    objectId,
    dataClass: 'backup_chunk',
    ciphertext,
    ciphertextHash: sha512Hex(ciphertext),
    encryptedBytes: ciphertext.length,
  };
}

function nativeHarness(initialStatus: NativeICloudFileStatusSnapshot) {
  const files = new Map<string, Uint8Array>();
  let fileStatus = initialStatus;
  let startedDownloads = 0;
  let accountListener: ((event: NativeAccountChangedEvent) => void) | null = null;
  let container: Awaited<ReturnType<RawMeerkatICloudStorageModule['getContainerState']>> = {
    status: 'available',
    containerUrl: 'file:///iCloud/Documents',
    identityToken: 'account-a',
    reachable: true,
  };
  const raw: RawMeerkatICloudStorageModule = {
    getContainerState: async () => container,
    coordinatedWriteICloudFile: async ({ relativePath, bytes }) => {
      files.set(relativePath, new Uint8Array(bytes));
      return { relativePath, bytesWritten: bytes.length, state: 'local_container_write' };
    },
    coordinatedReadICloudFile: async ({ relativePath }) => {
      const bytes = files.get(relativePath);
      return bytes ? { found: true, bytes: new Uint8Array(bytes) } : { found: false, bytes: null };
    },
    queryICloudFileStatus: async ({ relativePath }) => ({
      ...fileStatus,
      exists: files.has(relativePath),
    }),
    startICloudDownload: async () => {
      startedDownloads += 1;
      fileStatus = { ...fileStatus, downloadingStatus: 'current' };
    },
    stopICloudDownload: async () => {},
    listICloudConflictVersions: async () => [],
    listICloudFiles: async ({ relativePath }) => [...files.entries()]
      .filter(([path]) => path.startsWith(`${relativePath}/`))
      .map(([path, bytes]) => ({ relativePath: path, size: bytes.length, modificationTime: null })),
    deleteICloudFile: async ({ relativePath }) => ({ deleted: files.delete(relativePath) }),
    persistBookmark: async () => ({ bookmarkId: 'bookmark-a' }),
    resolveBookmark: async ({ bookmarkId }) => ({
      status: 'resolved', bookmarkId, directoryUrl: 'file:///folder',
    }),
    removeBookmark: async () => ({ removed: true }),
    coordinatedWriteBookmarkFile: async ({ relativePath, bytes }) => ({
      relativePath, bytesWritten: bytes.length,
    }),
    coordinatedReadBookmarkFile: async () => ({ found: false, bytes: null }),
    listBookmarkFiles: async () => [],
    deleteBookmarkFile: async () => ({ deleted: false }),
    addListener: (_event, listener) => {
      accountListener = listener;
      return { remove() { accountListener = null; } };
    },
  };
  return {
    native: createMeerkatICloudStorageBridge(raw),
    setContainer(value: typeof container) { container = value; },
    setFileStatus(value: NativeICloudFileStatusSnapshot) { fileStatus = value; },
    finishDownloads() { fileStatus = { ...fileStatus, downloadingStatus: 'downloaded' }; },
    startedDownloads() { return startedDownloads; },
    emitAccount(event: NativeAccountChangedEvent) { accountListener?.(event); },
  };
}

const pendingStatus: NativeICloudFileStatusSnapshot = {
  exists: true,
  isUbiquitous: true,
  isUploaded: false,
  isUploading: true,
  downloadingStatus: 'current',
  hasUnresolvedConflicts: false,
  modificationTime: null,
};

describe('iCloud destination honesty', () => {
  it('returns null on Android and when the native module is absent', () => {
    const unavailable = createMeerkatICloudStorageBridge(null);
    expect(createICloudDestinationAdapter({ platformOS: 'android', native: unavailable })).toBeNull();
    expect(createICloudDestinationAdapter({ platformOS: 'ios', native: unavailable })).toBeNull();
  });

  it('returns verification none for a local write while ubiquitous upload is pending', async () => {
    const harness = nativeHarness(pendingStatus);
    const adapter = createICloudDestinationAdapter({
      platformOS: 'ios',
      native: harness.native,
      uploadWaitMs: 0,
    })!;
    await expect(adapter.authorize({ kind: 'interactive' })).resolves.toMatchObject({
      kind: 'authorized',
    });
    const result = await adapter.putObject(object());
    expect(result.complete).toBe(true);
    expect(result.verified).toBe(false);
    expect(result.verification).toEqual({ kind: 'none' });
  });

  it('returns read-back evidence only after the data and metadata report uploaded', async () => {
    const harness = nativeHarness({
      ...pendingStatus,
      isUploaded: true,
      isUploading: false,
      downloadingStatus: 'current',
    });
    const adapter = createICloudDestinationAdapter({
      platformOS: 'ios',
      native: harness.native,
      uploadWaitMs: 0,
    })!;
    await adapter.authorize({ kind: 'interactive' });
    const input = object();
    await expect(adapter.putObject(input)).resolves.toMatchObject({
      complete: true,
      verified: true,
      verification: { kind: 'read_back', ciphertextHash: input.ciphertextHash },
    });
  });

  it('invalidates the destination when the iCloud identity changes', async () => {
    const harness = nativeHarness(pendingStatus);
    const adapter = createICloudDestinationAdapter({
      platformOS: 'ios', native: harness.native, uploadWaitMs: 0,
    })!;
    await adapter.authorize({ kind: 'interactive' });
    harness.emitAccount({ previousIdentityToken: 'account-a', currentIdentityToken: 'account-b' });
    await expect(adapter.health()).resolves.toMatchObject({
      state: 'revoked',
      errorCode: 'icloud_account_changed',
    });
    await expect(adapter.putObject(object())).rejects.toMatchObject({
      code: 'revoked',
      retryable: false,
    });
  });

  it('starts downloads before reading remote-only files on a fresh restore', async () => {
    const downloadedStatus: NativeICloudFileStatusSnapshot = {
      ...pendingStatus,
      isUploaded: true,
      isUploading: false,
      downloadingStatus: 'downloaded',
    };
    const harness = nativeHarness(downloadedStatus);
    const adapter = createICloudDestinationAdapter({
      platformOS: 'ios',
      native: harness.native,
      uploadWaitMs: 0,
      downloadWaitMs: 100,
      pollIntervalMs: 1,
      sleep: async () => { harness.finishDownloads(); },
    })!;
    await adapter.authorize({ kind: 'interactive' });
    const input = object('remote-only');
    await adapter.putObject(input);
    harness.setFileStatus({ ...downloadedStatus, downloadingStatus: 'not_downloaded' });

    await expect(adapter.getObject({ objectId: input.objectId })).resolves.toEqual(input.ciphertext);
    expect(harness.startedDownloads()).toBeGreaterThan(0);
  });
});

describe('iCloud pure state mapping', () => {
  const checkedAt = '2026-07-14T12:00:00Z';

  it('distinguishes no account, account change, unreachable container, and ok', () => {
    expect(mapICloudDestinationHealth({
      container: { kind: 'no_account', identityToken: null, reachable: false },
      authorizedIdentity: null,
      invalidated: false,
      revoked: false,
      verifiedReadWrite: false,
      checkedAt,
    })).toMatchObject({ state: 'auth_required', errorCode: 'icloud_no_account' });
    expect(mapICloudDestinationHealth({
      container: {
        kind: 'available', containerUrl: 'file:///iCloud', identityToken: 'new', reachable: true,
      },
      authorizedIdentity: 'old',
      invalidated: false,
      revoked: false,
      verifiedReadWrite: false,
      checkedAt,
    })).toMatchObject({ state: 'revoked', errorCode: 'icloud_account_changed' });
    expect(mapICloudDestinationHealth({
      container: {
        kind: 'available', containerUrl: 'file:///iCloud', identityToken: 'same', reachable: false,
      },
      authorizedIdentity: 'same',
      invalidated: false,
      revoked: false,
      verifiedReadWrite: false,
      checkedAt,
    })).toMatchObject({ state: 'unreachable', errorCode: 'icloud_container_unreachable' });
    expect(mapICloudDestinationHealth({
      container: {
        kind: 'available', containerUrl: 'file:///iCloud', identityToken: 'same', reachable: true,
      },
      authorizedIdentity: 'same',
      invalidated: false,
      revoked: false,
      verifiedReadWrite: true,
      checkedAt,
    })).toMatchObject({ state: 'ok', verifiedReadWrite: true });
  });

  it('does not accept pending, local, or conflict status as uploaded', () => {
    expect(statusesConfirmUbiquitousUpload([
      { kind: 'ubiquitous_upload_pending', modificationTime: null },
    ])).toBe(false);
    expect(statusesConfirmUbiquitousUpload([
      { kind: 'local_container_write', modificationTime: null },
    ])).toBe(false);
    expect(statusesConfirmUbiquitousUpload([
      { kind: 'conflict', modificationTime: null },
    ])).toBe(false);
    expect(statusesConfirmUbiquitousUpload([
      { kind: 'downloaded', modificationTime: null },
      { kind: 'downloaded', modificationTime: null },
    ])).toBe(true);
  });
});
