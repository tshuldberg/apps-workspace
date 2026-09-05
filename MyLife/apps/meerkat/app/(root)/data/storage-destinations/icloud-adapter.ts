import { sha512Hex } from '@mylife/sync/src/node/hkdf';
import {
  StorageAdapterError,
  type EncryptedStorageObject,
  type StorageAuthorizationInput,
  type StorageAuthorizationResult,
  type StorageByteRange,
  type StorageCapabilities,
  type StorageDeleteResult,
  type StorageDestinationAdapter,
  type StorageHealth,
  type StorageObjectMetadata,
  type StorageObjectPage,
  type StorageObjectRef,
  type StorageQuota,
  type StorageResumeToken,
  type StorageWriteResult,
} from '@mylife/sync/src/storage/types';
import type {
  ICloudContainerState,
  ICloudFileStatus,
  ICloudStorageResult,
  MeerkatICloudStorage,
} from '@mylife/meerkat-icloud-storage';
import {
  DIRECTORY_OBJECT_LIMIT_BYTES,
  equalStorageBytes,
  objectFileNames,
} from './directory-destination-core';

const APP_DIRECTORY = 'Meerkat';
const ACCOUNT_PREFIX = 'icloud-account:';
const PAGE_SIZE = 100;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

interface ICloudMetadata {
  version: 1;
  objectId: string;
  dataClass: string;
  ciphertextHash: string;
  encryptedBytes: number;
}

export interface ICloudAdapterOptions {
  platformOS?: string;
  native?: MeerkatICloudStorage;
  containerIdentifier?: string;
  uploadWaitMs?: number;
  downloadWaitMs?: number;
  pollIntervalMs?: number;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
}

export interface ICloudHealthInput {
  container: ICloudContainerState;
  authorizedIdentity: string | null;
  invalidated: boolean;
  revoked: boolean;
  verifiedReadWrite: boolean;
  checkedAt: string;
}

export function mapICloudDestinationHealth(input: ICloudHealthInput): StorageHealth {
  if (input.revoked) {
    return {
      state: 'revoked',
      verifiedReadWrite: false,
      checkedAt: input.checkedAt,
      errorCode: 'icloud_revoked',
    };
  }
  if (input.container.kind === 'no_account') {
    return {
      state: 'auth_required',
      verifiedReadWrite: false,
      checkedAt: input.checkedAt,
      errorCode: 'icloud_no_account',
    };
  }
  if (
    input.invalidated
    || (input.authorizedIdentity !== null
      && input.authorizedIdentity !== input.container.identityToken)
  ) {
    return {
      state: 'revoked',
      verifiedReadWrite: false,
      checkedAt: input.checkedAt,
      errorCode: 'icloud_account_changed',
    };
  }
  if (input.container.kind === 'container_unavailable' || !input.container.reachable) {
    return {
      state: 'unreachable',
      verifiedReadWrite: false,
      checkedAt: input.checkedAt,
      errorCode: 'icloud_container_unreachable',
    };
  }
  if (!input.authorizedIdentity) {
    return {
      state: 'auth_required',
      verifiedReadWrite: false,
      checkedAt: input.checkedAt,
      errorCode: 'icloud_authorization_required',
    };
  }
  return {
    state: 'ok',
    verifiedReadWrite: input.verifiedReadWrite,
    checkedAt: input.checkedAt,
  };
}

export function statusesConfirmUbiquitousUpload(statuses: readonly ICloudFileStatus[]): boolean {
  return statuses.length > 0 && statuses.every((status) => status.kind === 'downloaded');
}

function nativeValue<T>(result: ICloudStorageResult<T>): T {
  if (result.kind === 'success') return result.value;
  if (result.kind === 'unavailable') {
    throw new StorageAdapterError('provider_error', 'The iCloud native module is unavailable.', false);
  }
  if (result.code === 'no_account') {
    throw new StorageAdapterError('auth_required', result.message, false);
  }
  if (result.code === 'conflict') {
    throw new StorageAdapterError('conflict', result.message, false);
  }
  if (result.code === 'unreachable' || result.code === 'container_unavailable') {
    throw new StorageAdapterError('unreachable', result.message, true);
  }
  throw new StorageAdapterError('provider_error', result.message, result.code === 'io_error');
}

function metadataBytes(input: EncryptedStorageObject): Uint8Array {
  const metadata: ICloudMetadata = {
    version: 1,
    objectId: input.objectId,
    dataClass: input.dataClass,
    ciphertextHash: input.ciphertextHash.toLowerCase(),
    encryptedBytes: input.encryptedBytes,
  };
  return encoder.encode(JSON.stringify(metadata));
}

function parseMetadata(bytes: Uint8Array): ICloudMetadata | null {
  try {
    const value: unknown = JSON.parse(decoder.decode(bytes));
    if (!value || typeof value !== 'object') return null;
    const row = value as Record<string, unknown>;
    if (
      row.version !== 1
      || typeof row.objectId !== 'string'
      || typeof row.dataClass !== 'string'
      || typeof row.ciphertextHash !== 'string'
      || !/^[a-f0-9]{128}$/u.test(row.ciphertextHash)
      || typeof row.encryptedBytes !== 'number'
      || !Number.isSafeInteger(row.encryptedBytes)
      || row.encryptedBytes < 0
    ) return null;
    return {
      version: 1,
      objectId: row.objectId,
      dataClass: row.dataClass,
      ciphertextHash: row.ciphertextHash,
      encryptedBytes: row.encryptedBytes,
    };
  } catch {
    return null;
  }
}

function validateInput(input: EncryptedStorageObject): void {
  if (
    input.encryptedBytes !== input.ciphertext.length
    || sha512Hex(input.ciphertext) !== input.ciphertextHash.toLowerCase()
  ) {
    throw new StorageAdapterError('corrupt_ciphertext', 'Ciphertext metadata does not match the bytes.', false);
  }
  if (input.encryptedBytes > DIRECTORY_OBJECT_LIMIT_BYTES) {
    throw new StorageAdapterError('quota_exceeded', 'The encrypted object exceeds the iCloud object limit.', false);
  }
}

function objectPaths(objectId: string): { data: string; metadata: string } {
  const names = objectFileNames(objectId);
  return {
    data: `${APP_DIRECTORY}/${names.data}`,
    metadata: `${APP_DIRECTORY}/${names.metadata}`,
  };
}

function parseCursor(cursor: string | undefined): number {
  if (cursor === undefined) return 0;
  const value = Number(cursor);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new StorageAdapterError('provider_error', 'The iCloud cursor is invalid.', false);
  }
  return value;
}

class ICloudDestinationAdapter implements StorageDestinationAdapter {
  private authorizedIdentity: string | null = null;
  private invalidated = false;
  private revoked = false;
  private verifiedReadWrite = false;
  private readonly containerIdentifier?: string;
  private readonly uploadWaitMs: number;
  private readonly downloadWaitMs: number;
  private readonly pollIntervalMs: number;
  private readonly now: () => number;
  private readonly sleep: (milliseconds: number) => Promise<void>;

  constructor(private readonly native: MeerkatICloudStorage, options: ICloudAdapterOptions) {
    this.containerIdentifier = options.containerIdentifier?.trim() || undefined;
    this.uploadWaitMs = Math.max(0, options.uploadWaitMs ?? 30_000);
    this.downloadWaitMs = Math.max(0, options.downloadWaitMs ?? 60_000);
    this.pollIntervalMs = Math.max(1, options.pollIntervalMs ?? 500);
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => {
      setTimeout(resolve, milliseconds);
    }));
    this.native.onAccountChanged((event) => {
      if (event.previousIdentityToken !== event.currentIdentityToken) {
        this.invalidated = true;
        this.verifiedReadWrite = false;
      }
    });
  }

  async authorize(input: StorageAuthorizationInput): Promise<StorageAuthorizationResult> {
    const state = nativeValue(await this.native.getContainerState(this.containerInput()));
    if (state.kind === 'no_account') return { kind: 'authorization_required' };
    if (state.kind === 'container_unavailable') return { kind: 'authorization_required' };
    const credentialRef = `${ACCOUNT_PREFIX}${state.identityToken}`;
    if (input.kind !== 'interactive' && input.credentialRef !== credentialRef) {
      this.invalidated = true;
      return { kind: 'revoked', credentialRef: input.credentialRef };
    }
    this.authorizedIdentity = state.identityToken;
    this.invalidated = false;
    this.revoked = false;
    return { kind: 'authorized', credentialRef };
  }

  async revoke(options: { deleteRemoteData: boolean }): Promise<void> {
    if (options.deleteRemoteData && this.authorizedIdentity) {
      await this.ensureOperational();
      const entries = nativeValue(await this.native.listICloudFiles({
        ...this.containerInput(),
        relativePath: APP_DIRECTORY,
      }));
      for (const entry of entries) {
        nativeValue(await this.native.deleteICloudFile({
          ...this.containerInput(),
          relativePath: entry.relativePath,
        }));
      }
    }
    this.authorizedIdentity = null;
    this.revoked = true;
    this.verifiedReadWrite = false;
  }

  async capabilities(): Promise<StorageCapabilities> {
    return {
      backgroundWrite: true,
      resumableUpload: false,
      list: true,
      delete: true,
      quota: false,
      serverChecksum: false,
      maximumObjectBytes: DIRECTORY_OBJECT_LIMIT_BYTES,
    };
  }

  async health(): Promise<StorageHealth> {
    const checkedAt = new Date().toISOString();
    try {
      const container = nativeValue(await this.native.getContainerState(this.containerInput()));
      return mapICloudDestinationHealth({
        container,
        authorizedIdentity: this.authorizedIdentity,
        invalidated: this.invalidated,
        revoked: this.revoked,
        verifiedReadWrite: this.verifiedReadWrite,
        checkedAt,
      });
    } catch (error) {
      if (error instanceof StorageAdapterError && error.code === 'auth_required') {
        return {
          state: 'auth_required',
          verifiedReadWrite: false,
          checkedAt,
          errorCode: 'icloud_no_account',
        };
      }
      return {
        state: 'unreachable',
        verifiedReadWrite: false,
        checkedAt,
        errorCode: 'icloud_container_unreachable',
      };
    }
  }

  async quota(): Promise<StorageQuota> {
    await this.ensureOperational();
    return { usedBytes: null, capBytes: null, estimated: true };
  }

  async putObject(
    input: EncryptedStorageObject,
    resume?: StorageResumeToken,
  ): Promise<StorageWriteResult> {
    if (resume) {
      throw new StorageAdapterError('provider_error', 'iCloud coordinated writes are not resumable.', false);
    }
    validateInput(input);
    await this.ensureOperational();
    const paths = objectPaths(input.objectId);
    const existing = await this.readPath(paths.data);
    if (existing && !equalStorageBytes(existing, input.ciphertext)) {
      throw new StorageAdapterError('conflict', 'The iCloud object id already contains different bytes.', false);
    }
    const existingMetadataBytes = await this.readPath(paths.metadata);
    if (existingMetadataBytes) {
      const existingMetadata = parseMetadata(existingMetadataBytes);
      if (
        !existingMetadata
        || existingMetadata.objectId !== input.objectId
        || existingMetadata.ciphertextHash !== input.ciphertextHash.toLowerCase()
      ) {
        throw new StorageAdapterError('conflict', 'The iCloud object metadata conflicts with this write.', false);
      }
    }

    const dataWrite = nativeValue(await this.native.coordinatedWriteICloudFile({
      ...this.containerInput(),
      relativePath: paths.data,
      bytes: input.ciphertext,
    }));
    const metadataWrite = nativeValue(await this.native.coordinatedWriteICloudFile({
      ...this.containerInput(),
      relativePath: paths.metadata,
      bytes: metadataBytes(input),
    }));
    if (dataWrite.state !== 'local_container_write' || metadataWrite.state !== 'local_container_write') {
      throw new StorageAdapterError('provider_error', 'The native module returned an invalid write state.', false);
    }

    const localReadBack = await this.readPath(paths.data);
    if (!localReadBack || !equalStorageBytes(localReadBack, input.ciphertext)) {
      throw new StorageAdapterError('corrupt_ciphertext', 'The coordinated iCloud read-back did not match.', false);
    }

    const uploadedAndVerified = await this.waitForUbiquitousVerification(paths, input);
    if (uploadedAndVerified) {
      this.verifiedReadWrite = true;
      return {
        complete: true,
        verified: true,
        verification: { kind: 'read_back', ciphertextHash: input.ciphertextHash.toLowerCase() },
        remoteRef: paths.data,
        remoteVersion: null,
        encryptedBytes: input.encryptedBytes,
        ciphertextHash: input.ciphertextHash.toLowerCase(),
      };
    }
    return {
      complete: true,
      verified: false,
      verification: { kind: 'none' },
      remoteRef: paths.data,
      remoteVersion: null,
      encryptedBytes: input.encryptedBytes,
      ciphertextHash: input.ciphertextHash.toLowerCase(),
    };
  }

  async headObject(ref: StorageObjectRef): Promise<StorageObjectMetadata | null> {
    await this.ensureOperational();
    const record = await this.readRecord(ref.objectId);
    return record?.metadata ?? null;
  }

  async getObject(ref: StorageObjectRef, range?: StorageByteRange): Promise<Uint8Array | null> {
    await this.ensureOperational();
    const record = await this.readRecord(ref.objectId);
    if (!record) return null;
    if (!range) return record.bytes;
    if (!Number.isSafeInteger(range.offset) || !Number.isSafeInteger(range.length)
      || range.offset < 0 || range.length < 0) {
      throw new StorageAdapterError('provider_error', 'The byte range is invalid.', false);
    }
    return record.bytes.slice(range.offset, range.offset + range.length);
  }

  async listObjects(cursor?: string): Promise<StorageObjectPage> {
    await this.ensureOperational();
    const offset = parseCursor(cursor);
    const entries = nativeValue(await this.native.listICloudFiles({
      ...this.containerInput(),
      relativePath: APP_DIRECTORY,
    }));
    const metadataEntries = entries
      .filter((entry) => (entry.relativePath.split('/').at(-1) ?? '').startsWith('metadata-'))
      .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
    const items: StorageObjectMetadata[] = [];
    for (const entry of metadataEntries.slice(offset, offset + PAGE_SIZE)) {
      const bytes = await this.readPath(entry.relativePath);
      const stored = bytes ? parseMetadata(bytes) : null;
      if (!stored) {
        throw new StorageAdapterError('corrupt_ciphertext', 'iCloud metadata is missing or invalid.', false);
      }
      const record = await this.readRecord(stored.objectId);
      if (!record) {
        throw new StorageAdapterError('corrupt_ciphertext', 'iCloud metadata points to a missing object.', false);
      }
      items.push(record.metadata);
    }
    const nextOffset = offset + items.length;
    return {
      items,
      nextCursor: nextOffset < metadataEntries.length ? String(nextOffset) : null,
    };
  }

  async deleteObject(ref: StorageObjectRef): Promise<StorageDeleteResult> {
    await this.ensureOperational();
    const paths = objectPaths(ref.objectId);
    const deletedData = nativeValue(await this.native.deleteICloudFile({
      ...this.containerInput(),
      relativePath: paths.data,
    })).deleted;
    const deletedMetadata = nativeValue(await this.native.deleteICloudFile({
      ...this.containerInput(),
      relativePath: paths.metadata,
    })).deleted;
    return {
      deleted: deletedData || deletedMetadata,
      remoteRef: deletedData || deletedMetadata ? paths.data : null,
    };
  }

  private containerInput(): { containerIdentifier?: string } {
    return this.containerIdentifier ? { containerIdentifier: this.containerIdentifier } : {};
  }

  private async ensureOperational(): Promise<void> {
    const health = await this.health();
    if (health.state === 'ok') return;
    if (health.state === 'revoked') {
      throw new StorageAdapterError('revoked', 'The iCloud account changed. Reconnect this destination.', false);
    }
    if (health.state === 'auth_required') {
      throw new StorageAdapterError('auth_required', 'Connect an iCloud account to continue.', false);
    }
    throw new StorageAdapterError('unreachable', 'The iCloud container is unreachable.', true);
  }

  private async readPath(relativePath: string): Promise<Uint8Array | null> {
    const initialStatus = await this.status(relativePath);
    if (initialStatus.kind === 'missing') return null;
    if (initialStatus.kind === 'not_downloaded') {
      nativeValue(await this.native.startICloudDownload({
        ...this.containerInput(),
        relativePath,
      }));
      const deadline = this.now() + this.downloadWaitMs;
      let current = await this.status(relativePath);
      while (current.kind !== 'downloaded') {
        if (current.kind === 'missing') return null;
        if (this.now() >= deadline) {
          throw new StorageAdapterError('unreachable', 'The iCloud file did not finish downloading.', true);
        }
        await this.sleep(Math.min(this.pollIntervalMs, Math.max(1, deadline - this.now())));
        current = await this.status(relativePath);
      }
    }
    const result = nativeValue(await this.native.coordinatedReadICloudFile({
      ...this.containerInput(),
      relativePath,
    }));
    return result.kind === 'found' ? result.bytes : null;
  }

  private async status(relativePath: string): Promise<ICloudFileStatus> {
    const status = nativeValue(await this.native.queryICloudFileStatus({
      ...this.containerInput(),
      relativePath,
    }));
    if (status.kind === 'conflict') {
      throw new StorageAdapterError('conflict', 'The iCloud file has unresolved versions.', false);
    }
    return status;
  }

  private async waitForUbiquitousVerification(
    paths: { data: string; metadata: string },
    input: EncryptedStorageObject,
  ): Promise<boolean> {
    const deadline = this.now() + this.uploadWaitMs;
    let statuses = await Promise.all([this.status(paths.data), this.status(paths.metadata)]);
    while (!statusesConfirmUbiquitousUpload(statuses) && this.now() < deadline) {
      await this.sleep(Math.min(this.pollIntervalMs, Math.max(1, deadline - this.now())));
      statuses = await Promise.all([this.status(paths.data), this.status(paths.metadata)]);
    }
    if (!statusesConfirmUbiquitousUpload(statuses)) return false;

    const [data, metadataRaw] = await Promise.all([
      this.readPath(paths.data),
      this.readPath(paths.metadata),
    ]);
    const metadata = metadataRaw ? parseMetadata(metadataRaw) : null;
    if (
      data
      && equalStorageBytes(data, input.ciphertext)
      && metadata?.objectId === input.objectId
      && metadata.ciphertextHash === input.ciphertextHash.toLowerCase()
    ) return true;
    throw new StorageAdapterError('corrupt_ciphertext', 'Uploaded iCloud read-back did not match.', false);
  }

  private async readRecord(objectId: string): Promise<{
    bytes: Uint8Array;
    metadata: StorageObjectMetadata;
  } | null> {
    const paths = objectPaths(objectId);
    const [bytes, metadataRaw] = await Promise.all([
      this.readPath(paths.data),
      this.readPath(paths.metadata),
    ]);
    if (!bytes && !metadataRaw) return null;
    if (!bytes || !metadataRaw) {
      throw new StorageAdapterError('corrupt_ciphertext', 'The iCloud object is incomplete.', false);
    }
    const stored = parseMetadata(metadataRaw);
    if (
      !stored
      || stored.objectId !== objectId
      || stored.encryptedBytes !== bytes.length
      || stored.ciphertextHash !== sha512Hex(bytes)
    ) {
      throw new StorageAdapterError('corrupt_ciphertext', 'The iCloud object failed read-back validation.', false);
    }
    return {
      bytes,
      metadata: {
        objectId: stored.objectId,
        dataClass: stored.dataClass,
        remoteRef: paths.data,
        remoteVersion: null,
        encryptedBytes: stored.encryptedBytes,
        ciphertextHash: stored.ciphertextHash,
      },
    };
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

function loadNativeStorage(): MeerkatICloudStorage | null {
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

export function createICloudDestinationAdapter(
  options: ICloudAdapterOptions = {},
): StorageDestinationAdapter | null {
  if ((options.platformOS ?? loadPlatformOS()) !== 'ios') return null;
  const native = options.native ?? loadNativeStorage();
  if (!native?.available) return null;
  return new ICloudDestinationAdapter(native, options);
}
