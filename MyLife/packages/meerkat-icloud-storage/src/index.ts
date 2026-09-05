// UNVERIFIED - pending dev build / physical device QA.
//
// Owned bridge for iCloud Drive and iOS Files security-scoped bookmarks. The
// Swift source is authored but is not proof of iCloud upload, account-switch,
// bookmark, or conflict behavior. When it is absent, every method returns the
// typed unavailable result and no event or storage success is fabricated.

import { loadExpoNativeModule } from './loader';
import type {
  BookmarkResolution,
  CoordinatedReadResult,
  ICloudContainerState,
  ICloudFileStatus,
  ICloudStorageErrorCode,
  ICloudStorageResult,
  ICloudStorageSubscription,
  MeerkatICloudStorage,
  NativeAccountChangedEvent,
  NativeBookmarkResolution,
  NativeContainerState,
  NativeICloudFileStatusSnapshot,
  NativeSubscription,
  RawMeerkatICloudStorageModule,
} from './types';

export * from './types';

export const ICLOUD_STORAGE_NATIVE_MODULE_NAME = 'MeerkatICloudStorage';

const UNAVAILABLE = { kind: 'unavailable', reason: 'native_module_absent' } as const;

export function mapNativeContainerState(state: NativeContainerState): ICloudContainerState {
  if (state.status === 'no_account' || !state.identityToken) {
    return { kind: 'no_account', identityToken: null, reachable: false };
  }
  if (state.status !== 'available' || !state.containerUrl) {
    return {
      kind: 'container_unavailable',
      identityToken: state.identityToken,
      reachable: false,
    };
  }
  return {
    kind: 'available',
    containerUrl: state.containerUrl,
    identityToken: state.identityToken,
    reachable: state.reachable,
  };
}

export function mapNativeFileStatus(status: NativeICloudFileStatusSnapshot): ICloudFileStatus {
  if (!status.exists) return { kind: 'missing', modificationTime: null };
  const modificationTime = status.modificationTime;
  if (status.hasUnresolvedConflicts) return { kind: 'conflict', modificationTime };
  if (!status.isUbiquitous) return { kind: 'local_container_write', modificationTime };
  if (!status.isUploaded || status.isUploading) {
    return { kind: 'ubiquitous_upload_pending', modificationTime };
  }
  if (status.downloadingStatus === 'current' || status.downloadingStatus === 'downloaded') {
    return { kind: 'downloaded', modificationTime };
  }
  return { kind: 'not_downloaded', modificationTime };
}

export function mapNativeBookmarkResolution(
  resolution: NativeBookmarkResolution,
): BookmarkResolution {
  if (resolution.status === 'resolved' && resolution.directoryUrl) {
    return {
      kind: 'resolved',
      bookmarkId: resolution.bookmarkId,
      directoryUrl: resolution.directoryUrl,
    };
  }
  if (resolution.status === 'stale') {
    return { kind: 'stale', bookmarkId: resolution.bookmarkId };
  }
  if (resolution.status === 'permission_denied') {
    return { kind: 'permission_denied', bookmarkId: resolution.bookmarkId };
  }
  return { kind: 'missing', bookmarkId: resolution.bookmarkId };
}

function errorValue(error: unknown, key: 'code' | 'name'): string | null {
  if (!error || typeof error !== 'object' || !(key in error)) return null;
  const value = (error as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : null;
}

function mapNativeError(error: unknown): { code: ICloudStorageErrorCode; message: string } {
  const raw = errorValue(error, 'code') ?? errorValue(error, 'name') ?? '';
  const normalized = raw.toUpperCase();
  const mappings: ReadonlyArray<readonly [string, ICloudStorageErrorCode, string]> = [
    ['INVALID', 'invalid_argument', 'The storage request was invalid.'],
    ['NO_ACCOUNT', 'no_account', 'No iCloud account is available.'],
    ['CONTAINER', 'container_unavailable', 'The iCloud container is unavailable.'],
    ['UNREACHABLE', 'unreachable', 'The storage destination is unreachable.'],
    ['NOT_FOUND', 'not_found', 'The requested file was not found.'],
    ['PERMISSION', 'permission_denied', 'Access to the selected folder is no longer granted.'],
    ['STALE_BOOKMARK', 'stale_bookmark', 'The selected folder must be chosen again.'],
    ['CONFLICT', 'conflict', 'The iCloud file has unresolved versions.'],
    ['IO', 'io_error', 'The coordinated storage operation failed.'],
  ];
  for (const [needle, code, message] of mappings) {
    if (normalized.includes(needle)) return { code, message };
  }
  return { code: 'unknown', message: 'The native storage operation failed.' };
}

async function callNative<T, U>(
  operation: () => Promise<T>,
  map: (value: T) => U,
): Promise<ICloudStorageResult<U>> {
  try {
    return { kind: 'success', value: map(await operation()) };
  } catch (error) {
    const failure = mapNativeError(error);
    return { kind: 'failure', ...failure };
  }
}

class NativeBridge implements MeerkatICloudStorage {
  readonly available = true;
  private readonly listeners = new Set<(event: NativeAccountChangedEvent) => void>();
  private nativeAccountSubscription: NativeSubscription | null = null;

  constructor(private readonly raw: RawMeerkatICloudStorageModule) {}

  getContainerState(input: { containerIdentifier?: string } = {}) {
    return callNative(() => this.raw.getContainerState(input), mapNativeContainerState);
  }

  coordinatedWriteICloudFile(input: Parameters<MeerkatICloudStorage['coordinatedWriteICloudFile']>[0]) {
    return callNative(() => this.raw.coordinatedWriteICloudFile(input), (value) => value);
  }

  coordinatedReadICloudFile(input: Parameters<MeerkatICloudStorage['coordinatedReadICloudFile']>[0]) {
    return callNative(() => this.raw.coordinatedReadICloudFile(input), (value): CoordinatedReadResult =>
      value.found && value.bytes ? { kind: 'found', bytes: value.bytes } : { kind: 'not_found' });
  }

  queryICloudFileStatus(input: Parameters<MeerkatICloudStorage['queryICloudFileStatus']>[0]) {
    return callNative(() => this.raw.queryICloudFileStatus(input), mapNativeFileStatus);
  }

  startICloudDownload(input: Parameters<MeerkatICloudStorage['startICloudDownload']>[0]) {
    return callNative(() => this.raw.startICloudDownload(input), () => undefined);
  }

  stopICloudDownload(input: Parameters<MeerkatICloudStorage['stopICloudDownload']>[0]) {
    return callNative(() => this.raw.stopICloudDownload(input), () => undefined);
  }

  listICloudConflictVersions(input: Parameters<MeerkatICloudStorage['listICloudConflictVersions']>[0]) {
    return callNative(() => this.raw.listICloudConflictVersions(input), (value) => value);
  }

  listICloudFiles(input: Parameters<MeerkatICloudStorage['listICloudFiles']>[0]) {
    return callNative(() => this.raw.listICloudFiles(input), (value) => value);
  }

  deleteICloudFile(input: Parameters<MeerkatICloudStorage['deleteICloudFile']>[0]) {
    return callNative(() => this.raw.deleteICloudFile(input), (value) => value);
  }

  persistBookmark(input: Parameters<MeerkatICloudStorage['persistBookmark']>[0]) {
    return callNative(() => this.raw.persistBookmark(input), (value) => value);
  }

  resolveBookmark(input: Parameters<MeerkatICloudStorage['resolveBookmark']>[0]) {
    return callNative(() => this.raw.resolveBookmark(input), mapNativeBookmarkResolution);
  }

  removeBookmark(input: Parameters<MeerkatICloudStorage['removeBookmark']>[0]) {
    return callNative(() => this.raw.removeBookmark(input), (value) => value);
  }

  coordinatedWriteBookmarkFile(input: Parameters<MeerkatICloudStorage['coordinatedWriteBookmarkFile']>[0]) {
    return callNative(() => this.raw.coordinatedWriteBookmarkFile(input), (value) => value);
  }

  coordinatedReadBookmarkFile(input: Parameters<MeerkatICloudStorage['coordinatedReadBookmarkFile']>[0]) {
    return callNative(() => this.raw.coordinatedReadBookmarkFile(input), (value): CoordinatedReadResult =>
      value.found && value.bytes ? { kind: 'found', bytes: value.bytes } : { kind: 'not_found' });
  }

  listBookmarkFiles(input: Parameters<MeerkatICloudStorage['listBookmarkFiles']>[0]) {
    return callNative(() => this.raw.listBookmarkFiles(input), (value) => value);
  }

  deleteBookmarkFile(input: Parameters<MeerkatICloudStorage['deleteBookmarkFile']>[0]) {
    return callNative(() => this.raw.deleteBookmarkFile(input), (value) => value);
  }

  onAccountChanged(listener: (event: NativeAccountChangedEvent) => void): ICloudStorageSubscription {
    this.listeners.add(listener);
    if (!this.nativeAccountSubscription) {
      this.nativeAccountSubscription = this.raw.addListener('accountChanged', (event) => {
        for (const subscriber of [...this.listeners]) subscriber(event);
      });
    }
    let removed = false;
    return {
      available: true,
      remove: () => {
        if (removed) return;
        removed = true;
        this.listeners.delete(listener);
        if (this.listeners.size === 0) {
          this.nativeAccountSubscription?.remove();
          this.nativeAccountSubscription = null;
        }
      },
    };
  }
}

class UnavailableBridge implements MeerkatICloudStorage {
  readonly available = false;

  private unavailable<T>(): Promise<ICloudStorageResult<T>> {
    return Promise.resolve(UNAVAILABLE);
  }

  getContainerState() { return this.unavailable<ICloudContainerState>(); }
  coordinatedWriteICloudFile() { return this.unavailable<{ relativePath: string; bytesWritten: number; state: 'local_container_write' }>(); }
  coordinatedReadICloudFile() { return this.unavailable<CoordinatedReadResult>(); }
  queryICloudFileStatus() { return this.unavailable<ICloudFileStatus>(); }
  startICloudDownload() { return this.unavailable<void>(); }
  stopICloudDownload() { return this.unavailable<void>(); }
  listICloudConflictVersions() { return this.unavailable<Awaited<ReturnType<RawMeerkatICloudStorageModule['listICloudConflictVersions']>>>(); }
  listICloudFiles() { return this.unavailable<Awaited<ReturnType<RawMeerkatICloudStorageModule['listICloudFiles']>>>(); }
  deleteICloudFile() { return this.unavailable<{ deleted: boolean }>(); }
  persistBookmark() { return this.unavailable<{ bookmarkId: string }>(); }
  resolveBookmark() { return this.unavailable<BookmarkResolution>(); }
  removeBookmark() { return this.unavailable<{ removed: boolean }>(); }
  coordinatedWriteBookmarkFile() { return this.unavailable<{ relativePath: string; bytesWritten: number }>(); }
  coordinatedReadBookmarkFile() { return this.unavailable<CoordinatedReadResult>(); }
  listBookmarkFiles() { return this.unavailable<Awaited<ReturnType<RawMeerkatICloudStorageModule['listBookmarkFiles']>>>(); }
  deleteBookmarkFile() { return this.unavailable<{ deleted: boolean }>(); }
  onAccountChanged(): ICloudStorageSubscription {
    return { available: false, remove() {} };
  }
}

const unavailableBridge = new UnavailableBridge();

export function createMeerkatICloudStorageBridge(
  raw: RawMeerkatICloudStorageModule | null,
): MeerkatICloudStorage {
  return raw ? new NativeBridge(raw) : unavailableBridge;
}

export function loadMeerkatICloudStorage(): MeerkatICloudStorage {
  return createMeerkatICloudStorageBridge(
    loadExpoNativeModule<RawMeerkatICloudStorageModule>(ICLOUD_STORAGE_NATIVE_MODULE_NAME),
  );
}
