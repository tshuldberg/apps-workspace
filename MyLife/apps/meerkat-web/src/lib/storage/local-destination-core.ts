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

export const LOCAL_DESTINATION_OBJECT_LIMIT_BYTES = 256 * 1024 * 1024;
const DEFAULT_PAGE_SIZE = 100;
const HASH_PATTERN = /^[a-f0-9]{128}$/u;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type LocalDestinationDurability = 'durable' | 'evictable' | 'session_only';

export interface LocalDestinationStore {
  readonly credentialRef: string;
  readonly maximumObjectBytes: number;
  readonly backgroundWrite: boolean;
  prepareAuthorization(input: StorageAuthorizationInput): Promise<void>;
  durability(): Promise<LocalDestinationDurability>;
  read(key: string): Promise<Uint8Array | null>;
  write(key: string, bytes: Uint8Array): Promise<void>;
  delete(key: string): Promise<boolean>;
  list(): Promise<string[]>;
  usedBytes(): Promise<number>;
  freeBytes(): Promise<{ bytes: number | null; estimated: boolean }>;
}

export interface LocalPinClassUsage {
  count: number;
  bytes: number;
}

export interface LocalContentAccountingSnapshot {
  blobBytes: number;
  nodeBytes: number;
  budgetBytes: number | null;
  pinClasses: {
    authored: LocalPinClassUsage;
    explicit: LocalPinClassUsage;
    policy: LocalPinClassUsage;
    fetch_cache: LocalPinClassUsage;
  };
}

export interface LocalContentAccountingProvider {
  snapshot(): Promise<LocalContentAccountingSnapshot>;
}

export interface LocalStorageAccountingSnapshot extends LocalContentAccountingSnapshot {
  destinationBytes: number;
  totalUsedBytes: number;
  freeBytes: number | null;
  freeBytesEstimated: boolean;
  durability: LocalDestinationDurability;
}

interface StoredLocalObjectMetadata {
  version: 1;
  objectId: string;
  dataClass: string;
  ciphertextHash: string;
  encryptedBytes: number;
}

export interface LocalDeviceDestinationAdapterOptions {
  now?: () => string;
  pageSize?: number;
  accounting?: LocalContentAccountingProvider;
}

function objectKeys(objectId: string): { data: string; metadata: string } {
  const key = sha512Hex(encoder.encode(objectId)).slice(0, 64);
  return { data: `object-${key}.bin`, metadata: `metadata-${key}.json` };
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function checkedPositiveInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new StorageAdapterError('provider_error', `${label} must be a positive safe integer.`, false);
  }
  return value;
}

function metadataBytes(input: EncryptedStorageObject): Uint8Array {
  const metadata: StoredLocalObjectMetadata = {
    version: 1,
    objectId: input.objectId,
    dataClass: input.dataClass,
    ciphertextHash: input.ciphertextHash.toLowerCase(),
    encryptedBytes: input.encryptedBytes,
  };
  return encoder.encode(JSON.stringify(metadata));
}

function parseMetadata(bytes: Uint8Array): StoredLocalObjectMetadata | null {
  try {
    const parsed: unknown = JSON.parse(decoder.decode(bytes));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const value = parsed as Record<string, unknown>;
    if (
      value.version !== 1
      || typeof value.objectId !== 'string'
      || value.objectId.length === 0
      || typeof value.dataClass !== 'string'
      || value.dataClass.length === 0
      || typeof value.ciphertextHash !== 'string'
      || !HASH_PATTERN.test(value.ciphertextHash)
      || typeof value.encryptedBytes !== 'number'
      || !Number.isSafeInteger(value.encryptedBytes)
      || value.encryptedBytes < 0
    ) return null;
    return {
      version: 1,
      objectId: value.objectId,
      dataClass: value.dataClass,
      ciphertextHash: value.ciphertextHash,
      encryptedBytes: value.encryptedBytes,
    };
  } catch {
    return null;
  }
}

function normalizeError(error: unknown, fallback = 'The local storage operation failed.'): StorageAdapterError {
  if (error instanceof StorageAdapterError) return error;
  const message = error instanceof Error && error.message ? error.message : fallback;
  return new StorageAdapterError('provider_error', message, true);
}

function verifyInput(input: EncryptedStorageObject, maximumObjectBytes: number): void {
  if (
    input.objectId.length === 0
    || input.dataClass.length === 0
    || input.encryptedBytes !== input.ciphertext.length
    || !HASH_PATTERN.test(input.ciphertextHash.toLowerCase())
    || sha512Hex(input.ciphertext) !== input.ciphertextHash.toLowerCase()
  ) {
    throw new StorageAdapterError('corrupt_ciphertext', 'Ciphertext metadata does not match the bytes.', false);
  }
  if (input.encryptedBytes > maximumObjectBytes) {
    throw new StorageAdapterError('quota_exceeded', 'The encrypted object exceeds the local object limit.', false);
  }
}

function parseCursor(cursor: string | undefined): number {
  if (cursor === undefined) return 0;
  const value = Number(cursor);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new StorageAdapterError('provider_error', 'The local destination cursor is invalid.', false);
  }
  return value;
}

function emptyContentAccounting(): LocalContentAccountingSnapshot {
  return {
    blobBytes: 0,
    nodeBytes: 0,
    budgetBytes: null,
    pinClasses: {
      authored: { count: 0, bytes: 0 },
      explicit: { count: 0, bytes: 0 },
      policy: { count: 0, bytes: 0 },
      fetch_cache: { count: 0, bytes: 0 },
    },
  };
}

export class LocalDeviceDestinationAdapter implements StorageDestinationAdapter {
  private readonly now: () => string;
  private readonly pageSize: number;
  private readonly accountingProvider: LocalContentAccountingProvider | null;
  private authorized = false;
  private revoked = false;
  private probeSequence = 0;

  constructor(
    private readonly store: LocalDestinationStore,
    options: LocalDeviceDestinationAdapterOptions = {},
  ) {
    this.now = options.now ?? (() => new Date().toISOString());
    this.pageSize = checkedPositiveInteger(options.pageSize ?? DEFAULT_PAGE_SIZE, 'pageSize');
    this.accountingProvider = options.accounting ?? null;
    checkedPositiveInteger(store.maximumObjectBytes, 'maximumObjectBytes');
  }

  async authorize(input: StorageAuthorizationInput): Promise<StorageAuthorizationResult> {
    if (this.revoked && input.kind !== 'interactive') {
      return { kind: 'revoked', credentialRef: this.store.credentialRef };
    }
    try {
      await this.store.prepareAuthorization(input);
      this.authorized = true;
      this.revoked = false;
      return { kind: 'authorized', credentialRef: this.store.credentialRef };
    } catch (error) {
      const normalized = normalizeError(error);
      if (normalized.code === 'cancelled') return { kind: 'cancelled' };
      if (normalized.code === 'auth_required') {
        return { kind: 'authorization_required', credentialRef: this.store.credentialRef };
      }
      throw normalized;
    }
  }

  async revoke(options: { deleteRemoteData: boolean }): Promise<void> {
    try {
      if (options.deleteRemoteData && this.authorized) {
        for (const key of await this.store.list()) await this.store.delete(key);
      }
      this.authorized = false;
      this.revoked = true;
    } catch (error) {
      throw normalizeError(error);
    }
  }

  async capabilities(): Promise<StorageCapabilities> {
    let freeBytes: number | null = null;
    try {
      freeBytes = (await this.store.freeBytes()).bytes;
    } catch {
      freeBytes = null;
    }
    const durability = await this.store.durability();
    return {
      backgroundWrite: this.store.backgroundWrite && durability === 'durable',
      resumableUpload: false,
      list: true,
      delete: true,
      quota: freeBytes !== null,
      serverChecksum: false,
      maximumObjectBytes: this.store.maximumObjectBytes,
    };
  }

  async health(): Promise<StorageHealth> {
    if (this.revoked) return this.healthResult('revoked', false, 'local_destination_revoked');
    if (!this.authorized) return this.healthResult('auth_required', false, 'local_destination_not_opened');

    const probeKey = `.health-${this.now().replace(/[^0-9]/gu, '')}-${this.probeSequence}`;
    this.probeSequence += 1;
    const probeBytes = encoder.encode(`meerkat-local-health:${probeKey}`);
    try {
      await this.store.write(probeKey, probeBytes);
      const readBack = await this.store.read(probeKey);
      if (!readBack || !equalBytes(readBack, probeBytes)) {
        return this.healthResult('degraded', false, 'local_read_back_failed');
      }
      const deleted = await this.store.delete(probeKey);
      if (!deleted) return this.healthResult('degraded', false, 'local_probe_cleanup_failed');
      const durability = await this.store.durability();
      if (durability === 'durable') return this.healthResult('ok', true);
      return this.healthResult(
        'degraded',
        false,
        durability === 'evictable'
          ? 'browser_storage_evictable'
          : 'browser_storage_session_only',
      );
    } catch (error) {
      try {
        await this.store.delete(probeKey);
      } catch {
        // The original health failure remains authoritative.
      }
      const normalized = normalizeError(error);
      return this.healthResult(
        normalized.code === 'auth_required' ? 'auth_required' : 'unreachable',
        false,
        normalized.code,
      );
    }
  }

  async quota(): Promise<StorageQuota> {
    this.requireAuthorized();
    try {
      const usedBytes = await this.store.usedBytes();
      const free = await this.store.freeBytes();
      const capCandidate = free.bytes === null ? null : usedBytes + free.bytes;
      const capBytes = capCandidate !== null && Number.isSafeInteger(capCandidate)
        ? capCandidate
        : null;
      return {
        usedBytes,
        capBytes,
        estimated: free.estimated || capBytes === null,
      };
    } catch (error) {
      throw normalizeError(error);
    }
  }

  async accounting(): Promise<LocalStorageAccountingSnapshot> {
    this.requireAuthorized();
    try {
      const [destinationBytes, free, durability, content] = await Promise.all([
        this.store.usedBytes(),
        this.store.freeBytes(),
        this.store.durability(),
        this.accountingProvider?.snapshot() ?? Promise.resolve(emptyContentAccounting()),
      ]);
      const totalUsedBytes = destinationBytes + content.blobBytes + content.nodeBytes;
      if (!Number.isSafeInteger(totalUsedBytes)) {
        throw new StorageAdapterError('provider_error', 'Local storage accounting exceeds the safe range.', false);
      }
      return {
        ...content,
        destinationBytes,
        totalUsedBytes,
        freeBytes: free.bytes,
        freeBytesEstimated: free.estimated,
        durability,
      };
    } catch (error) {
      throw normalizeError(error);
    }
  }

  async putObject(
    input: EncryptedStorageObject,
    resume?: StorageResumeToken,
  ): Promise<StorageWriteResult> {
    this.requireAuthorized();
    if (resume !== undefined) {
      throw new StorageAdapterError('provider_error', 'Local writes are not resumable.', false);
    }
    verifyInput(input, this.store.maximumObjectBytes);
    const keys = objectKeys(input.objectId);
    let existingData: Uint8Array | null = null;
    let existingMetadataBytes: Uint8Array | null = null;
    try {
      [existingData, existingMetadataBytes] = await Promise.all([
        this.store.read(keys.data),
        this.store.read(keys.metadata),
      ]);
      if (existingData && !equalBytes(existingData, input.ciphertext)) {
        throw new StorageAdapterError('conflict', 'The object id already contains different bytes.', false);
      }
      if (existingMetadataBytes) {
        const existingMetadata = parseMetadata(existingMetadataBytes);
        if (
          !existingMetadata
          || existingMetadata.objectId !== input.objectId
          || existingMetadata.dataClass !== input.dataClass
          || existingMetadata.encryptedBytes !== input.encryptedBytes
          || existingMetadata.ciphertextHash !== input.ciphertextHash.toLowerCase()
        ) {
          throw new StorageAdapterError('conflict', 'The object metadata conflicts with this write.', false);
        }
      }

      await this.store.write(keys.data, input.ciphertext);
      await this.store.write(keys.metadata, metadataBytes(input));
      const readBack = await this.store.read(keys.data);
      if (
        !readBack
        || !equalBytes(readBack, input.ciphertext)
        || sha512Hex(readBack) !== input.ciphertextHash.toLowerCase()
      ) {
        throw new StorageAdapterError('corrupt_ciphertext', 'Local read-back did not match the write.', false);
      }
      const durability = await this.store.durability();
      const base = {
        complete: true as const,
        remoteRef: keys.data,
        remoteVersion: null,
        encryptedBytes: input.encryptedBytes,
        ciphertextHash: input.ciphertextHash.toLowerCase(),
      };
      if (durability !== 'durable') {
        return { ...base, verified: false, verification: { kind: 'none' } };
      }
      return {
        ...base,
        verified: true,
        verification: {
          kind: 'read_back',
          ciphertextHash: input.ciphertextHash.toLowerCase(),
        },
      };
    } catch (error) {
      if (!existingData) {
        try { await this.store.delete(keys.data); } catch { /* best effort */ }
      }
      if (!existingMetadataBytes) {
        try { await this.store.delete(keys.metadata); } catch { /* best effort */ }
      }
      throw normalizeError(error);
    }
  }

  async headObject(ref: StorageObjectRef): Promise<StorageObjectMetadata | null> {
    this.requireAuthorized();
    try {
      const record = await this.readRecord(ref.objectId);
      if (!record) return null;
      const durability = await this.store.durability();
      return {
        ...record.metadata,
        ciphertextHash: durability === 'durable' ? record.metadata.ciphertextHash : null,
      };
    } catch (error) {
      throw normalizeError(error);
    }
  }

  async getObject(ref: StorageObjectRef, range?: StorageByteRange): Promise<Uint8Array | null> {
    this.requireAuthorized();
    try {
      const record = await this.readRecord(ref.objectId);
      if (!record) return null;
      if (!range) return record.bytes;
      if (
        !Number.isSafeInteger(range.offset)
        || !Number.isSafeInteger(range.length)
        || range.offset < 0
        || range.length < 0
      ) {
        throw new StorageAdapterError('provider_error', 'The byte range is invalid.', false);
      }
      return record.bytes.slice(range.offset, range.offset + range.length);
    } catch (error) {
      throw normalizeError(error);
    }
  }

  async listObjects(cursor?: string): Promise<StorageObjectPage> {
    this.requireAuthorized();
    try {
      const offset = parseCursor(cursor);
      const records: Array<{ objectId: string; metadata: StorageObjectMetadata }> = [];
      const metadataKeys = (await this.store.list())
        .filter((key) => key.startsWith('metadata-') && key.endsWith('.json'));
      for (const key of metadataKeys) {
        const raw = await this.store.read(key);
        const stored = raw ? parseMetadata(raw) : null;
        if (!stored) {
          throw new StorageAdapterError('corrupt_ciphertext', 'Local metadata is missing or invalid.', false);
        }
        const record = await this.readRecord(stored.objectId);
        if (!record) {
          throw new StorageAdapterError('corrupt_ciphertext', 'Local metadata points to a missing object.', false);
        }
        records.push({ objectId: stored.objectId, metadata: record.metadata });
      }
      records.sort((left, right) => left.objectId.localeCompare(right.objectId));
      const page = records.slice(offset, offset + this.pageSize);
      const durability = await this.store.durability();
      const items = page.map(({ metadata }) => ({
        ...metadata,
        ciphertextHash: durability === 'durable' ? metadata.ciphertextHash : null,
      }));
      const nextOffset = offset + page.length;
      return { items, nextCursor: nextOffset < records.length ? String(nextOffset) : null };
    } catch (error) {
      throw normalizeError(error);
    }
  }

  async deleteObject(ref: StorageObjectRef): Promise<StorageDeleteResult> {
    this.requireAuthorized();
    const keys = objectKeys(ref.objectId);
    try {
      const [deletedData, deletedMetadata] = await Promise.all([
        this.store.delete(keys.data),
        this.store.delete(keys.metadata),
      ]);
      const deleted = deletedData || deletedMetadata;
      return { deleted, remoteRef: deleted ? keys.data : null };
    } catch (error) {
      throw normalizeError(error);
    }
  }

  private requireAuthorized(): void {
    if (!this.authorized || this.revoked) {
      throw new StorageAdapterError('auth_required', 'Open the local destination before using it.', false);
    }
  }

  private healthResult(
    state: StorageHealth['state'],
    verifiedReadWrite: boolean,
    errorCode?: string,
  ): StorageHealth {
    return {
      state,
      verifiedReadWrite,
      checkedAt: this.now(),
      ...(errorCode === undefined ? {} : { errorCode }),
    };
  }

  private async readRecord(objectId: string): Promise<{
    bytes: Uint8Array;
    metadata: StorageObjectMetadata;
  } | null> {
    const keys = objectKeys(objectId);
    const [bytes, metadataBytesValue] = await Promise.all([
      this.store.read(keys.data),
      this.store.read(keys.metadata),
    ]);
    if (!bytes && !metadataBytesValue) return null;
    if (!bytes || !metadataBytesValue) {
      throw new StorageAdapterError('corrupt_ciphertext', 'The local object is incomplete.', false);
    }
    const stored = parseMetadata(metadataBytesValue);
    if (
      !stored
      || stored.objectId !== objectId
      || stored.encryptedBytes !== bytes.length
      || stored.ciphertextHash !== sha512Hex(bytes)
    ) {
      throw new StorageAdapterError('corrupt_ciphertext', 'The local object failed read-back validation.', false);
    }
    return {
      bytes,
      metadata: {
        objectId: stored.objectId,
        dataClass: stored.dataClass,
        remoteRef: keys.data,
        remoteVersion: null,
        encryptedBytes: stored.encryptedBytes,
        ciphertextHash: stored.ciphertextHash,
      },
    };
  }
}
