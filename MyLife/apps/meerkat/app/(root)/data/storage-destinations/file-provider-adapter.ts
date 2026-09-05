import {
  StorageAdapterError,
  type StorageDestinationAdapter,
} from '@mylife/sync/src/storage/types';
import { decodeBase64, encodeBase64 } from 'tweetnacl-util';
import type {
  ICloudStorageResult,
  MeerkatICloudStorage,
} from '@mylife/meerkat-icloud-storage';
import {
  DirectoryDestinationAdapter,
  type DirectoryDestinationAccess,
} from './directory-destination-core';

const APP_DIRECTORY = 'Meerkat';
const IOS_BOOKMARK_PREFIX = 'ios-bookmark:';
const ANDROID_SAF_PREFIX = 'android-saf:';

interface SafPermissionResult {
  granted: boolean;
  directoryUri?: string;
}

export interface AndroidSafApi {
  requestDirectoryPermissionsAsync(initialUri?: string | null): Promise<SafPermissionResult>;
  readDirectoryAsync(directoryUri: string): Promise<string[]>;
  makeDirectoryAsync(parentUri: string, directoryName: string): Promise<string>;
  createFileAsync(parentUri: string, fileName: string, mimeType: string): Promise<string>;
  writeAsStringAsync(uri: string, contents: string, options: { encoding: string }): Promise<void>;
  readAsStringAsync(uri: string, options: { encoding: string }): Promise<string>;
  deleteAsync(uri: string, options: { idempotent: boolean }): Promise<void>;
  base64Encoding: string;
}

export interface FileProviderAdapterOptions {
  platformOS?: string;
  native?: MeerkatICloudStorage;
  saf?: AndroidSafApi;
  initialCredentialRef?: string;
  selectedIosDirectoryUrl?: string;
}

function checkedNativeValue<T>(result: ICloudStorageResult<T>): T {
  if (result.kind === 'success') return result.value;
  if (result.kind === 'unavailable') {
    throw new StorageAdapterError('provider_error', 'The iOS storage module is unavailable.', false);
  }
  if (
    result.code === 'permission_denied'
    || result.code === 'stale_bookmark'
    || result.code === 'not_found'
  ) {
    throw new StorageAdapterError('auth_required', 'Reselect the Files folder to continue.', false);
  }
  throw new StorageAdapterError(
    result.code === 'unreachable' ? 'unreachable' : 'provider_error',
    result.message,
    result.code === 'unreachable' || result.code === 'io_error',
  );
}

function credentialValue(reference: string | undefined, prefix: string): string | null {
  if (!reference?.startsWith(prefix)) return null;
  const value = reference.slice(prefix.length).trim();
  return value || null;
}

class IosBookmarkAccess implements DirectoryDestinationAccess {
  readonly backgroundWrite = true;
  private bookmarkId: string | null;
  private selectedDirectoryUrl: string | null;
  private revoked = false;

  constructor(
    private readonly native: MeerkatICloudStorage,
    initialCredentialRef?: string,
    selectedDirectoryUrl?: string,
  ) {
    this.bookmarkId = credentialValue(initialCredentialRef, IOS_BOOKMARK_PREFIX);
    this.selectedDirectoryUrl = selectedDirectoryUrl?.trim() || null;
  }

  async authorize(input: Parameters<DirectoryDestinationAccess['authorize']>[0]) {
    if (input.kind === 'interactive' && this.selectedDirectoryUrl) {
      const persisted = checkedNativeValue(await this.native.persistBookmark({
        directoryUrl: this.selectedDirectoryUrl,
      }));
      this.bookmarkId = persisted.bookmarkId;
      this.selectedDirectoryUrl = null;
    } else {
      this.bookmarkId = credentialValue(input.credentialRef, IOS_BOOKMARK_PREFIX) ?? this.bookmarkId;
    }
    if (!this.bookmarkId) return { kind: 'authorization_required' as const };
    try {
      await this.ensureAccess();
    } catch {
      return {
        kind: 'authorization_required' as const,
        credentialRef: `${IOS_BOOKMARK_PREFIX}${this.bookmarkId}`,
      };
    }
    this.revoked = false;
    return {
      kind: 'authorized' as const,
      credentialRef: `${IOS_BOOKMARK_PREFIX}${this.bookmarkId}`,
    };
  }

  async revoke(): Promise<void> {
    if (this.bookmarkId) {
      checkedNativeValue(await this.native.removeBookmark({ bookmarkId: this.bookmarkId }));
    }
    this.bookmarkId = null;
    this.revoked = true;
  }

  async health() {
    if (this.revoked) {
      return {
        state: 'revoked' as const,
        verifiedReadWrite: false,
        checkedAt: new Date().toISOString(),
        errorCode: 'file_provider_revoked',
      };
    }
    if (!this.bookmarkId) {
      return {
        state: 'auth_required' as const,
        verifiedReadWrite: false,
        checkedAt: new Date().toISOString(),
        errorCode: 'file_provider_folder_required',
      };
    }
    const resolution = checkedNativeValue(
      await this.native.resolveBookmark({ bookmarkId: this.bookmarkId }),
    );
    if (resolution.kind !== 'resolved') {
      return {
        state: 'auth_required' as const,
        verifiedReadWrite: false,
        checkedAt: new Date().toISOString(),
        errorCode: resolution.kind === 'stale'
          ? 'file_provider_bookmark_stale'
          : 'file_provider_permission_required',
      };
    }
    try {
      checkedNativeValue(await this.native.listBookmarkFiles({
        bookmarkId: this.bookmarkId,
        relativePath: APP_DIRECTORY,
      }));
      return {
        state: 'ok' as const,
        verifiedReadWrite: false,
        checkedAt: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof StorageAdapterError && error.code === 'auth_required') {
        return {
          state: 'auth_required' as const,
          verifiedReadWrite: false,
          checkedAt: new Date().toISOString(),
          errorCode: 'file_provider_permission_required',
        };
      }
      throw error;
    }
  }

  async ensureAccess(): Promise<void> {
    if (this.revoked || !this.bookmarkId) {
      throw new StorageAdapterError('auth_required', 'Select a Files folder to continue.', false);
    }
    const resolution = checkedNativeValue(
      await this.native.resolveBookmark({ bookmarkId: this.bookmarkId }),
    );
    if (resolution.kind === 'stale') {
      throw new StorageAdapterError('auth_required', 'The Files folder bookmark is stale. Reselect it.', false);
    }
    if (resolution.kind !== 'resolved') {
      throw new StorageAdapterError('auth_required', 'Access to the Files folder changed. Reselect it.', false);
    }
  }

  async read(fileName: string): Promise<Uint8Array | null> {
    await this.ensureAccess();
    const bookmarkId = this.bookmarkId!;
    const result = checkedNativeValue(await this.native.coordinatedReadBookmarkFile({
      bookmarkId,
      relativePath: `${APP_DIRECTORY}/${fileName}`,
    }));
    return result.kind === 'found' ? result.bytes : null;
  }

  async write(fileName: string, bytes: Uint8Array): Promise<void> {
    await this.ensureAccess();
    checkedNativeValue(await this.native.coordinatedWriteBookmarkFile({
      bookmarkId: this.bookmarkId!,
      relativePath: `${APP_DIRECTORY}/${fileName}`,
      bytes,
    }));
  }

  async list(): Promise<string[]> {
    await this.ensureAccess();
    const entries = checkedNativeValue(await this.native.listBookmarkFiles({
      bookmarkId: this.bookmarkId!,
      relativePath: APP_DIRECTORY,
    }));
    return entries.map((entry) => entry.relativePath.split('/').at(-1) ?? '').filter(Boolean);
  }

  async delete(fileName: string): Promise<boolean> {
    await this.ensureAccess();
    return checkedNativeValue(await this.native.deleteBookmarkFile({
      bookmarkId: this.bookmarkId!,
      relativePath: `${APP_DIRECTORY}/${fileName}`,
    })).deleted;
  }
}

function safDisplayName(uri: string): string {
  const withoutQuery = uri.split('?')[0] ?? uri;
  let decoded = withoutQuery;
  try {
    decoded = decodeURIComponent(withoutQuery);
  } catch {
    // Keep the original URI when a provider emits invalid percent encoding.
  }
  const segments = decoded.split('/').filter(Boolean);
  return segments.at(-1)?.split(':').at(-1) ?? '';
}

function normalizeSafName(name: string): string {
  if (name.startsWith('metadata-') && !name.endsWith('.json')) return `${name}.json`;
  if (name.startsWith('object-') && !name.endsWith('.bin')) return `${name}.bin`;
  return name;
}

function matchesSafName(uri: string, expected: string): boolean {
  const actual = safDisplayName(uri);
  const extensionIndex = expected.lastIndexOf('.');
  const base = extensionIndex > 0 ? expected.slice(0, extensionIndex) : expected;
  return actual === expected || actual === base;
}

function safAccessError(): StorageAdapterError {
  return new StorageAdapterError(
    'auth_required',
    'Access to the Android folder changed. Reselect the folder to resume jobs.',
    false,
  );
}

class AndroidSafAccess implements DirectoryDestinationAccess {
  readonly backgroundWrite = true;
  private rootUri: string | null;
  private revoked = false;

  constructor(private readonly saf: AndroidSafApi, initialCredentialRef?: string) {
    this.rootUri = credentialValue(initialCredentialRef, ANDROID_SAF_PREFIX);
  }

  async authorize(input: Parameters<DirectoryDestinationAccess['authorize']>[0]) {
    this.rootUri = credentialValue(input.credentialRef, ANDROID_SAF_PREFIX) ?? this.rootUri;
    if (input.kind === 'interactive' && !this.rootUri) {
      const selected = await this.saf.requestDirectoryPermissionsAsync();
      if (!selected.granted || !selected.directoryUri) return { kind: 'cancelled' as const };
      this.rootUri = selected.directoryUri;
    }
    if (!this.rootUri) return { kind: 'authorization_required' as const };
    try {
      await this.ensureAccess();
    } catch {
      return {
        kind: 'authorization_required' as const,
        credentialRef: `${ANDROID_SAF_PREFIX}${this.rootUri}`,
      };
    }
    this.revoked = false;
    return {
      kind: 'authorized' as const,
      credentialRef: `${ANDROID_SAF_PREFIX}${this.rootUri}`,
    };
  }

  async revoke(): Promise<void> {
    this.rootUri = null;
    this.revoked = true;
  }

  async health() {
    if (this.revoked) {
      return {
        state: 'revoked' as const,
        verifiedReadWrite: false,
        checkedAt: new Date().toISOString(),
        errorCode: 'file_provider_revoked',
      };
    }
    try {
      await this.ensureAccess();
      return {
        state: 'ok' as const,
        verifiedReadWrite: false,
        checkedAt: new Date().toISOString(),
      };
    } catch {
      return {
        state: 'auth_required' as const,
        verifiedReadWrite: false,
        checkedAt: new Date().toISOString(),
        errorCode: 'file_provider_permission_required',
      };
    }
  }

  async ensureAccess(): Promise<void> {
    if (this.revoked || !this.rootUri) throw safAccessError();
    try {
      await this.saf.readDirectoryAsync(this.rootUri);
    } catch {
      throw safAccessError();
    }
  }

  async read(fileName: string): Promise<Uint8Array | null> {
    const uri = await this.findFile(fileName, false);
    if (!uri) return null;
    try {
      const encoded = await this.saf.readAsStringAsync(uri, { encoding: this.saf.base64Encoding });
      return decodeBase64(encoded);
    } catch {
      throw safAccessError();
    }
  }

  async write(fileName: string, bytes: Uint8Array): Promise<void> {
    const uri = await this.findFile(fileName, true);
    if (!uri) throw safAccessError();
    try {
      await this.saf.writeAsStringAsync(uri, encodeBase64(bytes), {
        encoding: this.saf.base64Encoding,
      });
    } catch {
      throw safAccessError();
    }
  }

  async list(): Promise<string[]> {
    const directory = await this.appDirectory(false);
    if (!directory) return [];
    try {
      return (await this.saf.readDirectoryAsync(directory))
        .map((uri) => normalizeSafName(safDisplayName(uri)))
        .filter(Boolean);
    } catch {
      throw safAccessError();
    }
  }

  async delete(fileName: string): Promise<boolean> {
    const uri = await this.findFile(fileName, false);
    if (!uri) return false;
    try {
      await this.saf.deleteAsync(uri, { idempotent: true });
      return true;
    } catch {
      throw safAccessError();
    }
  }

  private async appDirectory(create: boolean): Promise<string | null> {
    await this.ensureAccess();
    const rootUri = this.rootUri!;
    let children: string[];
    try {
      children = await this.saf.readDirectoryAsync(rootUri);
    } catch {
      throw safAccessError();
    }
    const existing = children.find((uri) => safDisplayName(uri) === APP_DIRECTORY);
    if (existing) return existing;
    if (!create) return null;
    try {
      return await this.saf.makeDirectoryAsync(rootUri, APP_DIRECTORY);
    } catch {
      throw safAccessError();
    }
  }

  private async findFile(fileName: string, create: boolean): Promise<string | null> {
    const directory = await this.appDirectory(create);
    if (!directory) return null;
    let children: string[];
    try {
      children = await this.saf.readDirectoryAsync(directory);
    } catch {
      throw safAccessError();
    }
    const existing = children.find((uri) => matchesSafName(uri, fileName));
    if (existing) return existing;
    if (!create) return null;
    const extensionIndex = fileName.lastIndexOf('.');
    const baseName = extensionIndex > 0 ? fileName.slice(0, extensionIndex) : fileName;
    const mimeType = fileName.endsWith('.json') ? 'application/json' : 'application/octet-stream';
    try {
      return await this.saf.createFileAsync(directory, baseName, mimeType);
    } catch {
      throw safAccessError();
    }
  }
}

function loadPlatformOS(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module = require('react-native') as { Platform?: { OS?: string } };
    return module.Platform?.OS ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

function loadIosStorage(): MeerkatICloudStorage | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module = require('@mylife/meerkat-icloud-storage') as {
      loadMeerkatICloudStorage?: () => MeerkatICloudStorage;
    };
    const native = module.loadMeerkatICloudStorage?.() ?? null;
    return native?.available ? native : null;
  } catch {
    return null;
  }
}

function loadAndroidSaf(): AndroidSafApi | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module = require('expo-file-system/legacy') as {
      EncodingType?: { Base64?: string };
      StorageAccessFramework?: Omit<AndroidSafApi, 'base64Encoding'>;
    };
    const saf = module.StorageAccessFramework;
    const base64Encoding = module.EncodingType?.Base64;
    if (!saf || !base64Encoding || typeof saf.readDirectoryAsync !== 'function') return null;
    return { ...saf, base64Encoding };
  } catch {
    return null;
  }
}

export function createFileProviderDestinationAdapter(
  options: FileProviderAdapterOptions = {},
): StorageDestinationAdapter | null {
  const platformOS = options.platformOS ?? loadPlatformOS();
  if (platformOS === 'ios') {
    const native = options.native ?? loadIosStorage();
    if (!native?.available) return null;
    return new DirectoryDestinationAdapter(new IosBookmarkAccess(
      native,
      options.initialCredentialRef,
      options.selectedIosDirectoryUrl,
    ));
  }
  if (platformOS === 'android') {
    const saf = options.saf ?? loadAndroidSaf();
    if (!saf) return null;
    return new DirectoryDestinationAdapter(new AndroidSafAccess(
      saf,
      options.initialCredentialRef,
    ));
  }
  return null;
}
