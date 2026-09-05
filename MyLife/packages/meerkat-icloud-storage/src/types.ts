export interface NativeSubscription {
  remove(): void;
}

export interface NativeAccountChangedEvent {
  previousIdentityToken: string | null;
  currentIdentityToken: string | null;
}

export interface NativeContainerState {
  status: 'available' | 'no_account' | 'container_unavailable';
  containerUrl: string | null;
  identityToken: string | null;
  reachable: boolean;
}

export interface NativeICloudFileStatusSnapshot {
  exists: boolean;
  isUbiquitous: boolean;
  isUploaded: boolean;
  isUploading: boolean;
  downloadingStatus: 'current' | 'downloaded' | 'not_downloaded' | 'unknown';
  hasUnresolvedConflicts: boolean;
  modificationTime: string | null;
}

export interface NativeFileEntry {
  relativePath: string;
  size: number;
  modificationTime: string | null;
}

export interface NativeConflictVersion {
  versionIdentifier: string;
  modificationTime: string | null;
  localizedName: string | null;
  resolved: boolean;
}

export interface NativeBookmarkResolution {
  status: 'resolved' | 'stale' | 'missing' | 'permission_denied';
  bookmarkId: string;
  directoryUrl: string | null;
}

export interface RawMeerkatICloudStorageModule {
  getContainerState(input: { containerIdentifier?: string }): Promise<NativeContainerState>;
  coordinatedWriteICloudFile(input: {
    containerIdentifier?: string;
    relativePath: string;
    bytes: Uint8Array;
  }): Promise<{ relativePath: string; bytesWritten: number; state: 'local_container_write' }>;
  coordinatedReadICloudFile(input: {
    containerIdentifier?: string;
    relativePath: string;
  }): Promise<{ found: boolean; bytes: Uint8Array | null }>;
  queryICloudFileStatus(input: {
    containerIdentifier?: string;
    relativePath: string;
  }): Promise<NativeICloudFileStatusSnapshot>;
  startICloudDownload(input: { containerIdentifier?: string; relativePath: string }): Promise<void>;
  stopICloudDownload(input: { containerIdentifier?: string; relativePath: string }): Promise<void>;
  listICloudConflictVersions(input: {
    containerIdentifier?: string;
    relativePath: string;
  }): Promise<NativeConflictVersion[]>;
  listICloudFiles(input: {
    containerIdentifier?: string;
    relativePath: string;
  }): Promise<NativeFileEntry[]>;
  deleteICloudFile(input: {
    containerIdentifier?: string;
    relativePath: string;
  }): Promise<{ deleted: boolean }>;
  persistBookmark(input: { directoryUrl: string; bookmarkId?: string }): Promise<{ bookmarkId: string }>;
  resolveBookmark(input: { bookmarkId: string }): Promise<NativeBookmarkResolution>;
  removeBookmark(input: { bookmarkId: string }): Promise<{ removed: boolean }>;
  coordinatedWriteBookmarkFile(input: {
    bookmarkId: string;
    relativePath: string;
    bytes: Uint8Array;
  }): Promise<{ relativePath: string; bytesWritten: number }>;
  coordinatedReadBookmarkFile(input: {
    bookmarkId: string;
    relativePath: string;
  }): Promise<{ found: boolean; bytes: Uint8Array | null }>;
  listBookmarkFiles(input: { bookmarkId: string; relativePath: string }): Promise<NativeFileEntry[]>;
  deleteBookmarkFile(input: {
    bookmarkId: string;
    relativePath: string;
  }): Promise<{ deleted: boolean }>;
  addListener(
    eventName: 'accountChanged',
    listener: (event: NativeAccountChangedEvent) => void,
  ): NativeSubscription;
}

export type ICloudStorageErrorCode =
  | 'invalid_argument'
  | 'no_account'
  | 'container_unavailable'
  | 'unreachable'
  | 'not_found'
  | 'permission_denied'
  | 'stale_bookmark'
  | 'conflict'
  | 'io_error'
  | 'unknown';

export type ICloudStorageResult<T> =
  | { kind: 'success'; value: T }
  | { kind: 'unavailable'; reason: 'native_module_absent' }
  | { kind: 'failure'; code: ICloudStorageErrorCode; message: string };

export type ICloudContainerState =
  | {
      kind: 'available';
      containerUrl: string;
      identityToken: string;
      reachable: boolean;
    }
  | { kind: 'no_account'; identityToken: null; reachable: false }
  | {
      kind: 'container_unavailable';
      identityToken: string | null;
      reachable: false;
    };

interface ICloudFileStatusBase {
  modificationTime: string | null;
}

export type ICloudFileStatus =
  | { kind: 'missing'; modificationTime: null }
  | (ICloudFileStatusBase & { kind: 'local_container_write' })
  | (ICloudFileStatusBase & { kind: 'ubiquitous_upload_pending' })
  | (ICloudFileStatusBase & { kind: 'downloaded' })
  | (ICloudFileStatusBase & { kind: 'not_downloaded' })
  | (ICloudFileStatusBase & { kind: 'conflict' });

export type CoordinatedReadResult =
  | { kind: 'found'; bytes: Uint8Array }
  | { kind: 'not_found' };

export type BookmarkResolution =
  | { kind: 'resolved'; bookmarkId: string; directoryUrl: string }
  | { kind: 'stale'; bookmarkId: string }
  | { kind: 'missing'; bookmarkId: string }
  | { kind: 'permission_denied'; bookmarkId: string };

export interface ICloudStorageSubscription {
  available: boolean;
  remove(): void;
}

export interface MeerkatICloudStorage {
  readonly available: boolean;
  getContainerState(input?: { containerIdentifier?: string }): Promise<ICloudStorageResult<ICloudContainerState>>;
  coordinatedWriteICloudFile(input: {
    containerIdentifier?: string;
    relativePath: string;
    bytes: Uint8Array;
  }): Promise<ICloudStorageResult<{ relativePath: string; bytesWritten: number; state: 'local_container_write' }>>;
  coordinatedReadICloudFile(input: {
    containerIdentifier?: string;
    relativePath: string;
  }): Promise<ICloudStorageResult<CoordinatedReadResult>>;
  queryICloudFileStatus(input: {
    containerIdentifier?: string;
    relativePath: string;
  }): Promise<ICloudStorageResult<ICloudFileStatus>>;
  startICloudDownload(input: { containerIdentifier?: string; relativePath: string }): Promise<ICloudStorageResult<void>>;
  stopICloudDownload(input: { containerIdentifier?: string; relativePath: string }): Promise<ICloudStorageResult<void>>;
  listICloudConflictVersions(input: {
    containerIdentifier?: string;
    relativePath: string;
  }): Promise<ICloudStorageResult<NativeConflictVersion[]>>;
  listICloudFiles(input: {
    containerIdentifier?: string;
    relativePath: string;
  }): Promise<ICloudStorageResult<NativeFileEntry[]>>;
  deleteICloudFile(input: {
    containerIdentifier?: string;
    relativePath: string;
  }): Promise<ICloudStorageResult<{ deleted: boolean }>>;
  persistBookmark(input: {
    directoryUrl: string;
    bookmarkId?: string;
  }): Promise<ICloudStorageResult<{ bookmarkId: string }>>;
  resolveBookmark(input: { bookmarkId: string }): Promise<ICloudStorageResult<BookmarkResolution>>;
  removeBookmark(input: { bookmarkId: string }): Promise<ICloudStorageResult<{ removed: boolean }>>;
  coordinatedWriteBookmarkFile(input: {
    bookmarkId: string;
    relativePath: string;
    bytes: Uint8Array;
  }): Promise<ICloudStorageResult<{ relativePath: string; bytesWritten: number }>>;
  coordinatedReadBookmarkFile(input: {
    bookmarkId: string;
    relativePath: string;
  }): Promise<ICloudStorageResult<CoordinatedReadResult>>;
  listBookmarkFiles(input: {
    bookmarkId: string;
    relativePath: string;
  }): Promise<ICloudStorageResult<NativeFileEntry[]>>;
  deleteBookmarkFile(input: {
    bookmarkId: string;
    relativePath: string;
  }): Promise<ICloudStorageResult<{ deleted: boolean }>>;
  onAccountChanged(listener: (event: NativeAccountChangedEvent) => void): ICloudStorageSubscription;
}
