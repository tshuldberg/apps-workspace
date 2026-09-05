import { describe, expect, it } from 'vitest';
import {
  createMeerkatICloudStorageBridge,
  loadMeerkatICloudStorage,
  mapNativeFileStatus,
} from '../index';
import type {
  NativeAccountChangedEvent,
  NativeSubscription,
  RawMeerkatICloudStorageModule,
} from '../types';

function snapshot(
  overrides: Partial<Awaited<ReturnType<RawMeerkatICloudStorageModule['queryICloudFileStatus']>>> = {},
) {
  return {
    exists: true,
    isUbiquitous: true,
    isUploaded: false,
    isUploading: false,
    downloadingStatus: 'not_downloaded' as const,
    hasUnresolvedConflicts: false,
    modificationTime: '2026-07-14T12:00:00Z',
    ...overrides,
  };
}

function rawModule(
  overrides: Partial<RawMeerkatICloudStorageModule> = {},
): RawMeerkatICloudStorageModule {
  const base: RawMeerkatICloudStorageModule = {
    getContainerState: async () => ({
      status: 'available',
      containerUrl: 'file:///iCloud/Documents',
      identityToken: 'identity-a',
      reachable: true,
    }),
    coordinatedWriteICloudFile: async ({ relativePath, bytes }) => ({
      relativePath,
      bytesWritten: bytes.length,
      state: 'local_container_write',
    }),
    coordinatedReadICloudFile: async () => ({ found: false, bytes: null }),
    queryICloudFileStatus: async () => snapshot(),
    startICloudDownload: async () => {},
    stopICloudDownload: async () => {},
    listICloudConflictVersions: async () => [],
    listICloudFiles: async () => [],
    deleteICloudFile: async () => ({ deleted: false }),
    persistBookmark: async () => ({ bookmarkId: 'bookmark-a' }),
    resolveBookmark: async ({ bookmarkId }) => ({
      status: 'resolved',
      bookmarkId,
      directoryUrl: 'file:///provider',
    }),
    removeBookmark: async () => ({ removed: true }),
    coordinatedWriteBookmarkFile: async ({ relativePath, bytes }) => ({
      relativePath,
      bytesWritten: bytes.length,
    }),
    coordinatedReadBookmarkFile: async () => ({ found: false, bytes: null }),
    listBookmarkFiles: async () => [],
    deleteBookmarkFile: async () => ({ deleted: false }),
    addListener: () => ({ remove() {} }),
  };
  return { ...base, ...overrides };
}

describe('absent native bridge', () => {
  it('returns typed unavailable results from every storage entry point', async () => {
    const api = createMeerkatICloudStorageBridge(null);
    expect(api.available).toBe(false);
    const bytes = new Uint8Array([1]);
    const results = await Promise.all([
      api.getContainerState(),
      api.coordinatedWriteICloudFile({ relativePath: 'a', bytes }),
      api.coordinatedReadICloudFile({ relativePath: 'a' }),
      api.queryICloudFileStatus({ relativePath: 'a' }),
      api.startICloudDownload({ relativePath: 'a' }),
      api.stopICloudDownload({ relativePath: 'a' }),
      api.listICloudConflictVersions({ relativePath: 'a' }),
      api.listICloudFiles({ relativePath: '' }),
      api.deleteICloudFile({ relativePath: 'a' }),
      api.persistBookmark({ directoryUrl: 'file:///folder' }),
      api.resolveBookmark({ bookmarkId: 'a' }),
      api.removeBookmark({ bookmarkId: 'a' }),
      api.coordinatedWriteBookmarkFile({ bookmarkId: 'a', relativePath: 'a', bytes }),
      api.coordinatedReadBookmarkFile({ bookmarkId: 'a', relativePath: 'a' }),
      api.listBookmarkFiles({ bookmarkId: 'a', relativePath: '' }),
      api.deleteBookmarkFile({ bookmarkId: 'a', relativePath: 'a' }),
    ]);
    expect(results.every((result) => result.kind === 'unavailable')).toBe(true);
    expect(api.onAccountChanged(() => {}).available).toBe(false);
  });

  it('lazy loading stays unavailable in Node without the native runtime', () => {
    expect(loadMeerkatICloudStorage().available).toBe(false);
  });
});

describe('iCloud state mapping', () => {
  it('never maps a local container write or pending upload to uploaded', async () => {
    const api = createMeerkatICloudStorageBridge(rawModule());
    const write = await api.coordinatedWriteICloudFile({
      relativePath: 'objects/a.bin',
      bytes: new Uint8Array([1, 2]),
    });
    expect(write).toEqual({
      kind: 'success',
      value: {
        relativePath: 'objects/a.bin',
        bytesWritten: 2,
        state: 'local_container_write',
      },
    });
    expect(mapNativeFileStatus(snapshot()).kind).toBe('ubiquitous_upload_pending');
    expect(mapNativeFileStatus(snapshot({ isUbiquitous: false })).kind).toBe('local_container_write');
  });

  it('maps upload-pending, downloaded, not-downloaded, and conflict exactly', () => {
    expect(mapNativeFileStatus(snapshot({ isUploading: true })).kind)
      .toBe('ubiquitous_upload_pending');
    expect(mapNativeFileStatus(snapshot({
      isUploaded: true,
      downloadingStatus: 'current',
    })).kind).toBe('downloaded');
    expect(mapNativeFileStatus(snapshot({
      isUploaded: true,
      downloadingStatus: 'not_downloaded',
    })).kind).toBe('not_downloaded');
    expect(mapNativeFileStatus(snapshot({
      isUploaded: true,
      downloadingStatus: 'current',
      hasUnresolvedConflicts: true,
    })).kind).toBe('conflict');
    expect(mapNativeFileStatus(snapshot({ exists: false })).kind).toBe('missing');
  });
});

describe('account and bookmark events', () => {
  it('fans one native account-change event out to every live subscriber', () => {
    const nativeListener: { current: ((event: NativeAccountChangedEvent) => void) | null } = {
      current: null,
    };
    let nativeRemoveCount = 0;
    const addListener: RawMeerkatICloudStorageModule['addListener'] = (_event, listener) => {
      nativeListener.current = listener;
      const subscription: NativeSubscription = {
        remove() { nativeRemoveCount += 1; },
      };
      return subscription;
    };
    const api = createMeerkatICloudStorageBridge(rawModule({ addListener }));
    const first: NativeAccountChangedEvent[] = [];
    const second: NativeAccountChangedEvent[] = [];
    const a = api.onAccountChanged((event) => first.push(event));
    const b = api.onAccountChanged((event) => second.push(event));
    const event = { previousIdentityToken: 'old', currentIdentityToken: 'new' };
    expect(nativeListener.current).not.toBeNull();
    nativeListener.current?.(event);
    expect(first).toEqual([event]);
    expect(second).toEqual([event]);
    a.remove();
    expect(nativeRemoveCount).toBe(0);
    b.remove();
    expect(nativeRemoveCount).toBe(1);
  });

  it('surfaces bookmark staleness without a resolved directory URL', async () => {
    const api = createMeerkatICloudStorageBridge(rawModule({
      resolveBookmark: async ({ bookmarkId }) => ({
        status: 'stale',
        bookmarkId,
        directoryUrl: null,
      }),
    }));
    await expect(api.resolveBookmark({ bookmarkId: 'stale-a' })).resolves.toEqual({
      kind: 'success',
      value: { kind: 'stale', bookmarkId: 'stale-a' },
    });
  });
});
