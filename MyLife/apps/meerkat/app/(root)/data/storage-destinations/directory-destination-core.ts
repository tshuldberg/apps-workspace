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

export const DIRECTORY_OBJECT_LIMIT_BYTES = 256 * 1024 * 1024;
const PAGE_SIZE = 100;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

interface StoredObjectMetadata {
  version: 1;
  objectId: string;
  dataClass: string;
  ciphertextHash: string;
  encryptedBytes: number;
}

export interface DirectoryDestinationAccess {
  readonly backgroundWrite: boolean;
  authorize(input: StorageAuthorizationInput): Promise<StorageAuthorizationResult>;
  revoke(): Promise<void>;
  health(): Promise<StorageHealth>;
  ensureAccess(): Promise<void>;
  read(fileName: string): Promise<Uint8Array | null>;
  write(fileName: string, bytes: Uint8Array): Promise<void>;
  list(): Promise<string[]>;
  delete(fileName: string): Promise<boolean>;
}

export function objectFileNames(objectId: string): { data: string; metadata: string } {
  const key = sha512Hex(encoder.encode(objectId)).slice(0, 64);
  return { data: `object-${key}.bin`, metadata: `metadata-${key}.json` };
}

export function equalStorageBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function metadataBytes(input: EncryptedStorageObject): Uint8Array {
  const metadata: StoredObjectMetadata = {
    version: 1,
    objectId: input.objectId,
    dataClass: input.dataClass,
    ciphertextHash: input.ciphertextHash.toLowerCase(),
    encryptedBytes: input.encryptedBytes,
  };
  return encoder.encode(JSON.stringify(metadata));
}

function parseMetadata(bytes: Uint8Array): StoredObjectMetadata | null {
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

function verifyInput(input: EncryptedStorageObject): void {
  if (
    input.encryptedBytes !== input.ciphertext.length
    || sha512Hex(input.ciphertext) !== input.ciphertextHash.toLowerCase()
  ) {
    throw new StorageAdapterError('corrupt_ciphertext', 'Ciphertext metadata does not match the bytes.', false);
  }
  if (input.encryptedBytes > DIRECTORY_OBJECT_LIMIT_BYTES) {
    throw new StorageAdapterError('quota_exceeded', 'The encrypted object exceeds the directory limit.', false);
  }
}

function parseCursor(cursor: string | undefined): number {
  if (cursor === undefined) return 0;
  const offset = Number(cursor);
  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new StorageAdapterError('provider_error', 'The directory cursor is invalid.', false);
  }
  return offset;
}

function normalizeError(error: unknown): StorageAdapterError {
  if (error instanceof StorageAdapterError) return error;
  const message = error instanceof Error && error.message
    ? error.message
    : 'The directory operation failed.';
  return new StorageAdapterError('provider_error', message, true);
}

export class DirectoryDestinationAdapter implements StorageDestinationAdapter {
  constructor(private readonly access: DirectoryDestinationAccess) {}

  async authorize(input: StorageAuthorizationInput): Promise<StorageAuthorizationResult> {
    try {
      return await this.access.authorize(input);
    } catch (error) {
      throw normalizeError(error);
    }
  }

  async revoke(options: { deleteRemoteData: boolean }): Promise<void> {
    try {
      if (options.deleteRemoteData) {
        await this.access.ensureAccess();
        for (const fileName of await this.access.list()) {
          await this.access.delete(fileName);
        }
      }
      await this.access.revoke();
    } catch (error) {
      throw normalizeError(error);
    }
  }

  async capabilities(): Promise<StorageCapabilities> {
    return {
      backgroundWrite: this.access.backgroundWrite,
      resumableUpload: false,
      list: true,
      delete: true,
      quota: false,
      serverChecksum: false,
      maximumObjectBytes: DIRECTORY_OBJECT_LIMIT_BYTES,
    };
  }

  async health(): Promise<StorageHealth> {
    try {
      return await this.access.health();
    } catch (error) {
      const typed = normalizeError(error);
      return {
        state: typed.code === 'auth_required' ? 'auth_required' : 'unreachable',
        verifiedReadWrite: false,
        checkedAt: new Date().toISOString(),
        errorCode: typed.code,
      };
    }
  }

  async quota(): Promise<StorageQuota> {
    try {
      await this.access.ensureAccess();
      return { usedBytes: null, capBytes: null, estimated: true };
    } catch (error) {
      throw normalizeError(error);
    }
  }

  async putObject(
    input: EncryptedStorageObject,
    resume?: StorageResumeToken,
  ): Promise<StorageWriteResult> {
    try {
      if (resume) {
        throw new StorageAdapterError('provider_error', 'Directory writes are not resumable.', false);
      }
      verifyInput(input);
      await this.access.ensureAccess();
      const names = objectFileNames(input.objectId);
      const existingBytes = await this.access.read(names.data);
      if (existingBytes && !equalStorageBytes(existingBytes, input.ciphertext)) {
        throw new StorageAdapterError('conflict', 'The object id already contains different bytes.', false);
      }
      const existingMetadataBytes = await this.access.read(names.metadata);
      if (existingMetadataBytes) {
        const existingMetadata = parseMetadata(existingMetadataBytes);
        if (
          !existingMetadata
          || existingMetadata.objectId !== input.objectId
          || existingMetadata.ciphertextHash !== input.ciphertextHash.toLowerCase()
        ) {
          throw new StorageAdapterError('conflict', 'The object metadata conflicts with this write.', false);
        }
      }
      await this.access.write(names.data, input.ciphertext);
      await this.access.write(names.metadata, metadataBytes(input));
      const readBack = await this.access.read(names.data);
      if (!readBack || !equalStorageBytes(readBack, input.ciphertext)) {
        throw new StorageAdapterError('corrupt_ciphertext', 'Directory read-back did not match the write.', false);
      }
      return {
        complete: true,
        verified: true,
        verification: { kind: 'read_back', ciphertextHash: input.ciphertextHash.toLowerCase() },
        remoteRef: names.data,
        remoteVersion: null,
        encryptedBytes: input.encryptedBytes,
        ciphertextHash: input.ciphertextHash.toLowerCase(),
      };
    } catch (error) {
      throw normalizeError(error);
    }
  }

  async headObject(ref: StorageObjectRef): Promise<StorageObjectMetadata | null> {
    try {
      await this.access.ensureAccess();
      const record = await this.readRecord(ref.objectId);
      if (!record) return null;
      return record.metadata;
    } catch (error) {
      throw normalizeError(error);
    }
  }

  async getObject(ref: StorageObjectRef, range?: StorageByteRange): Promise<Uint8Array | null> {
    try {
      await this.access.ensureAccess();
      const record = await this.readRecord(ref.objectId);
      if (!record) return null;
      if (!range) return record.bytes;
      if (!Number.isSafeInteger(range.offset) || !Number.isSafeInteger(range.length)
        || range.offset < 0 || range.length < 0) {
        throw new StorageAdapterError('provider_error', 'The byte range is invalid.', false);
      }
      return record.bytes.slice(range.offset, range.offset + range.length);
    } catch (error) {
      throw normalizeError(error);
    }
  }

  async listObjects(cursor?: string): Promise<StorageObjectPage> {
    try {
      await this.access.ensureAccess();
      const offset = parseCursor(cursor);
      const names = (await this.access.list())
        .filter((name) => name.startsWith('metadata-') && name.endsWith('.json'))
        .sort();
      const items: StorageObjectMetadata[] = [];
      for (const name of names.slice(offset, offset + PAGE_SIZE)) {
        const bytes = await this.access.read(name);
        const stored = bytes ? parseMetadata(bytes) : null;
        if (!stored) {
          throw new StorageAdapterError('corrupt_ciphertext', 'Directory metadata is missing or invalid.', false);
        }
        const record = await this.readRecord(stored.objectId);
        if (!record) {
          throw new StorageAdapterError('corrupt_ciphertext', 'Directory metadata points to a missing object.', false);
        }
        items.push(record.metadata);
      }
      const nextOffset = offset + items.length;
      return { items, nextCursor: nextOffset < names.length ? String(nextOffset) : null };
    } catch (error) {
      throw normalizeError(error);
    }
  }

  async deleteObject(ref: StorageObjectRef): Promise<StorageDeleteResult> {
    try {
      await this.access.ensureAccess();
      const names = objectFileNames(ref.objectId);
      const deletedData = await this.access.delete(names.data);
      const deletedMetadata = await this.access.delete(names.metadata);
      return {
        deleted: deletedData || deletedMetadata,
        remoteRef: deletedData || deletedMetadata ? names.data : null,
      };
    } catch (error) {
      throw normalizeError(error);
    }
  }

  private async readRecord(objectId: string): Promise<{
    bytes: Uint8Array;
    metadata: StorageObjectMetadata;
  } | null> {
    const names = objectFileNames(objectId);
    const bytes = await this.access.read(names.data);
    const metadataRaw = await this.access.read(names.metadata);
    if (!bytes && !metadataRaw) return null;
    if (!bytes || !metadataRaw) {
      throw new StorageAdapterError('corrupt_ciphertext', 'The directory object is incomplete.', false);
    }
    const stored = parseMetadata(metadataRaw);
    if (
      !stored
      || stored.objectId !== objectId
      || stored.encryptedBytes !== bytes.length
      || stored.ciphertextHash !== sha512Hex(bytes)
    ) {
      throw new StorageAdapterError('corrupt_ciphertext', 'The directory object failed read-back validation.', false);
    }
    return {
      bytes,
      metadata: {
        objectId: stored.objectId,
        dataClass: stored.dataClass,
        remoteRef: names.data,
        remoteVersion: null,
        encryptedBytes: stored.encryptedBytes,
        ciphertextHash: stored.ciphertextHash,
      },
    };
  }
}
