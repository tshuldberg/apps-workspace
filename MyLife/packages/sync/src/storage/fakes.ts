import { sha512Hex } from '../node/hkdf';
import type {
  EncryptedStorageObject,
  StorageAuthorizationInput,
  StorageAuthorizationResult,
  StorageByteRange,
  StorageCapabilities,
  StorageDeleteResult,
  StorageDestinationAdapter,
  StorageHealth,
  StorageObjectMetadata,
  StorageObjectPage,
  StorageObjectRef,
  StorageQuota,
  StorageResumeToken,
  StorageWriteResult,
} from './types';
import { StorageAdapterError } from './types';

export type StorageAdapterOperation =
  | 'authorize'
  | 'revoke'
  | 'capabilities'
  | 'health'
  | 'quota'
  | 'putObject'
  | 'headObject'
  | 'getObject'
  | 'listObjects'
  | 'deleteObject';

export type InMemoryVerificationMode = 'read_back' | 'provider_checksum' | 'none';

export interface InMemoryStorageDestinationAdapterOptions {
  maximumObjectBytes?: number;
  pageSize?: number;
  quotaCapBytes?: number | null;
  verification?: InMemoryVerificationMode;
  accountHint?: string;
  credentialRef?: string;
  now?: () => string;
}

interface StoredObject {
  objectId: string;
  dataClass: string;
  bytes: Uint8Array;
  ciphertextHash: string;
  remoteRef: string;
  remoteVersion: string;
}

interface PendingUpload {
  providerSession: string;
  objectId: string;
  dataClass: string;
  ciphertextHash: string;
  encryptedBytes: number;
  bytes: Uint8Array;
}

function copyBytes(value: Uint8Array): Uint8Array {
  return value.slice();
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function validateNonNegativeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new StorageAdapterError('provider_error', `${label} must be a non-negative integer`, false);
  }
}

export class InMemoryStorageDestinationAdapter implements StorageDestinationAdapter {
  private readonly objects = new Map<string, StoredObject>();
  private readonly pending = new Map<string, PendingUpload>();
  private readonly faults = new Map<StorageAdapterOperation, StorageAdapterError[]>();
  private readonly maximumObjectBytes: number;
  private readonly pageSize: number;
  private readonly accountHint: string;
  private readonly defaultCredentialRef: string;
  private readonly now: () => string;
  private authorized = false;
  private revoked = false;
  private verificationMode: InMemoryVerificationMode;
  private healthOverride: StorageHealth['state'] | null = null;
  private healthErrorCode: string | undefined;
  private verifiedReadWrite = false;
  private quotaCapBytes: number | null;
  private quotaUsedOverride: number | null = null;
  private partialPutBytes: number | null = null;
  private conflictCode: 'conflict' | 'corrupt_ciphertext' = 'corrupt_ciphertext';
  private uploadSequence = 0;
  private versionSequence = 0;

  constructor(options: InMemoryStorageDestinationAdapterOptions = {}) {
    this.maximumObjectBytes = options.maximumObjectBytes ?? 8 * 1024 * 1024;
    this.pageSize = options.pageSize ?? 2;
    this.quotaCapBytes = options.quotaCapBytes ?? null;
    this.verificationMode = options.verification ?? 'read_back';
    this.accountHint = options.accountHint ?? 'memory@example.invalid';
    this.defaultCredentialRef = options.credentialRef ?? 'securestore://mylife/storage/memory';
    this.now = options.now ?? (() => new Date().toISOString());
    if (!Number.isSafeInteger(this.maximumObjectBytes) || this.maximumObjectBytes <= 0) {
      throw new Error('maximumObjectBytes must be a positive safe integer');
    }
    if (!Number.isSafeInteger(this.pageSize) || this.pageSize <= 0) {
      throw new Error('pageSize must be a positive safe integer');
    }
  }

  failNext(operation: StorageAdapterOperation, error: StorageAdapterError): void {
    const queued = this.faults.get(operation) ?? [];
    queued.push(error);
    this.faults.set(operation, queued);
  }

  setQuota(usedBytes: number | null, capBytes: number | null): void {
    if (usedBytes !== null) validateNonNegativeInteger(usedBytes, 'usedBytes');
    if (capBytes !== null) validateNonNegativeInteger(capBytes, 'capBytes');
    this.quotaUsedOverride = usedBytes;
    this.quotaCapBytes = capBytes;
  }

  setVerificationMode(mode: InMemoryVerificationMode): void {
    this.verificationMode = mode;
  }

  setPartialPutBytes(bytes: number | null): void {
    if (bytes !== null && (!Number.isSafeInteger(bytes) || bytes <= 0)) {
      throw new Error('partial put size must be a positive safe integer');
    }
    this.partialPutBytes = bytes;
  }

  setConflictMode(code: 'conflict' | 'corrupt_ciphertext'): void {
    this.conflictCode = code;
  }

  setHealthState(state: StorageHealth['state'] | null, errorCode?: string): void {
    this.healthOverride = state;
    this.healthErrorCode = errorCode;
  }

  async authorize(input: StorageAuthorizationInput): Promise<StorageAuthorizationResult> {
    this.throwFault('authorize');
    if (this.revoked && input.kind !== 'interactive') {
      return {
        kind: 'revoked',
        accountHint: input.accountHint ?? this.accountHint,
        credentialRef: input.credentialRef,
      };
    }
    this.authorized = true;
    this.revoked = false;
    this.healthOverride = null;
    return {
      kind: 'authorized',
      accountHint: input.accountHint ?? this.accountHint,
      credentialRef: input.credentialRef ?? this.defaultCredentialRef,
    };
  }

  async revoke(options: { deleteRemoteData: boolean }): Promise<void> {
    this.throwFault('revoke');
    this.authorized = false;
    this.revoked = true;
    this.verifiedReadWrite = false;
    this.pending.clear();
    if (options.deleteRemoteData) this.objects.clear();
  }

  async capabilities(): Promise<StorageCapabilities> {
    this.throwFault('capabilities');
    return {
      backgroundWrite: true,
      resumableUpload: true,
      list: true,
      delete: true,
      quota: true,
      serverChecksum: true,
      maximumObjectBytes: this.maximumObjectBytes,
    };
  }

  async health(): Promise<StorageHealth> {
    this.throwFault('health');
    const state = this.healthOverride ?? (this.revoked ? 'revoked' : this.authorized ? 'ok' : 'auth_required');
    return {
      state,
      verifiedReadWrite: state === 'ok' || state === 'degraded' ? this.verifiedReadWrite : false,
      checkedAt: this.now(),
      ...(this.healthErrorCode === undefined ? {} : { errorCode: this.healthErrorCode }),
    };
  }

  async quota(): Promise<StorageQuota> {
    this.requireAuthorized();
    this.throwFault('quota');
    return {
      usedBytes: this.quotaUsedOverride ?? this.actualUsedBytes(),
      capBytes: this.quotaCapBytes,
      estimated: false,
    };
  }

  async putObject(
    input: EncryptedStorageObject,
    resume?: StorageResumeToken,
  ): Promise<StorageWriteResult> {
    this.requireAuthorized();
    this.throwFault('putObject');
    this.validateObject(input);

    const existing = this.objects.get(input.objectId);
    if (existing !== undefined) {
      if (!equalBytes(existing.bytes, input.ciphertext)) {
        throw new StorageAdapterError(
          this.conflictCode,
          'the same ciphertext object id already contains different bytes',
          false,
        );
      }
      return this.completeWriteResult(existing);
    }

    const pending = resume === undefined ? undefined : this.pending.get(resume.providerSession);
    if (resume !== undefined) {
      if (
        pending === undefined
        || pending.objectId !== input.objectId
        || pending.ciphertextHash !== input.ciphertextHash
        || resume.offset !== pending.bytes.length
        || !equalBytes(pending.bytes, input.ciphertext.slice(0, resume.offset))
      ) {
        throw new StorageAdapterError('conflict', 'resume token does not match the pending upload', false);
      }
    }

    const currentOffset = pending?.bytes.length ?? 0;
    const writeLimit = this.partialPutBytes ?? input.encryptedBytes;
    const nextOffset = Math.min(input.encryptedBytes, currentOffset + writeLimit);
    const projectedUsed = (this.quotaUsedOverride ?? this.actualUsedBytes()) + (nextOffset - currentOffset);
    if (this.quotaCapBytes !== null && projectedUsed > this.quotaCapBytes) {
      throw new StorageAdapterError('quota_exceeded', 'destination quota would be exceeded', false);
    }

    const providerSession = pending?.providerSession ?? `memory-upload-${this.uploadSequence += 1}`;
    const nextPending: PendingUpload = {
      providerSession,
      objectId: input.objectId,
      dataClass: input.dataClass,
      ciphertextHash: input.ciphertextHash,
      encryptedBytes: input.encryptedBytes,
      bytes: copyBytes(input.ciphertext.slice(0, nextOffset)),
    };
    if (nextOffset < input.encryptedBytes) {
      this.pending.set(providerSession, nextPending);
      return {
        complete: false,
        verified: false,
        verification: { kind: 'none' },
        remoteRef: this.remoteRef(input.objectId),
        remoteVersion: null,
        encryptedBytes: nextOffset,
        ciphertextHash: input.ciphertextHash,
        resumeToken: { providerSession, offset: nextOffset },
      };
    }

    this.pending.delete(providerSession);
    const stored: StoredObject = {
      objectId: input.objectId,
      dataClass: input.dataClass,
      bytes: copyBytes(input.ciphertext),
      ciphertextHash: input.ciphertextHash,
      remoteRef: this.remoteRef(input.objectId),
      remoteVersion: `memory-v${this.versionSequence += 1}`,
    };
    this.objects.set(input.objectId, stored);
    return this.completeWriteResult(stored);
  }

  async headObject(ref: StorageObjectRef): Promise<StorageObjectMetadata | null> {
    this.requireAuthorized();
    this.throwFault('headObject');
    const object = this.lookup(ref);
    return object === null ? null : this.metadata(object);
  }

  async getObject(ref: StorageObjectRef, range?: StorageByteRange): Promise<Uint8Array | null> {
    this.requireAuthorized();
    this.throwFault('getObject');
    const object = this.lookup(ref);
    if (object === null) return null;
    if (range === undefined) return copyBytes(object.bytes);
    validateNonNegativeInteger(range.offset, 'range.offset');
    validateNonNegativeInteger(range.length, 'range.length');
    if (range.offset > object.bytes.length) {
      throw new StorageAdapterError('provider_error', 'range starts beyond the object', false);
    }
    return copyBytes(object.bytes.slice(range.offset, range.offset + range.length));
  }

  async listObjects(cursor?: string): Promise<StorageObjectPage> {
    this.requireAuthorized();
    this.throwFault('listObjects');
    let offset = 0;
    if (cursor !== undefined) {
      const match = /^memory-cursor-(\d+)$/.exec(cursor);
      if (match === null) throw new StorageAdapterError('provider_error', 'list cursor is invalid', false);
      offset = Number.parseInt(match[1] ?? '', 10);
    }
    const values = [...this.objects.values()].sort((left, right) => left.objectId.localeCompare(right.objectId));
    if (offset > values.length) throw new StorageAdapterError('provider_error', 'list cursor is out of range', false);
    const page = values.slice(offset, offset + this.pageSize);
    const nextOffset = offset + page.length;
    return {
      items: page.map((object) => this.metadata(object)),
      nextCursor: nextOffset < values.length ? `memory-cursor-${nextOffset}` : null,
    };
  }

  async deleteObject(ref: StorageObjectRef): Promise<StorageDeleteResult> {
    this.requireAuthorized();
    this.throwFault('deleteObject');
    const object = this.lookup(ref);
    if (object === null) return { deleted: false, remoteRef: ref.remoteRef ?? null };
    this.objects.delete(object.objectId);
    return { deleted: true, remoteRef: object.remoteRef };
  }

  private throwFault(operation: StorageAdapterOperation): void {
    const queued = this.faults.get(operation);
    const error = queued?.shift();
    if (queued !== undefined && queued.length === 0) this.faults.delete(operation);
    if (error !== undefined) throw error;
  }

  private requireAuthorized(): void {
    if (!this.authorized) {
      throw new StorageAdapterError('auth_required', 'destination authorization is required', false);
    }
  }

  private validateObject(input: EncryptedStorageObject): void {
    validateNonNegativeInteger(input.encryptedBytes, 'encryptedBytes');
    if (input.encryptedBytes !== input.ciphertext.length) {
      throw new StorageAdapterError('corrupt_ciphertext', 'encryptedBytes does not match ciphertext', false);
    }
    if (input.encryptedBytes > this.maximumObjectBytes) {
      throw new StorageAdapterError('quota_exceeded', 'object exceeds maximumObjectBytes', false);
    }
    if (sha512Hex(input.ciphertext) !== input.ciphertextHash) {
      throw new StorageAdapterError('corrupt_ciphertext', 'ciphertext hash does not match bytes', false);
    }
  }

  private completeWriteResult(object: StoredObject): StorageWriteResult {
    if (this.verificationMode === 'none') {
      return {
        complete: true,
        verified: false,
        verification: { kind: 'none' },
        remoteRef: object.remoteRef,
        remoteVersion: object.remoteVersion,
        encryptedBytes: object.bytes.length,
        ciphertextHash: object.ciphertextHash,
      };
    }
    this.verifiedReadWrite = true;
    if (this.verificationMode === 'provider_checksum') {
      return {
        complete: true,
        verified: true,
        verification: { kind: 'provider_checksum', algorithm: 'sha512', value: object.ciphertextHash },
        remoteRef: object.remoteRef,
        remoteVersion: object.remoteVersion,
        encryptedBytes: object.bytes.length,
        ciphertextHash: object.ciphertextHash,
      };
    }
    return {
      complete: true,
      verified: true,
      verification: { kind: 'read_back', ciphertextHash: sha512Hex(object.bytes) },
      remoteRef: object.remoteRef,
      remoteVersion: object.remoteVersion,
      encryptedBytes: object.bytes.length,
      ciphertextHash: object.ciphertextHash,
    };
  }

  private actualUsedBytes(): number {
    let total = 0;
    for (const object of this.objects.values()) total += object.bytes.length;
    for (const pending of this.pending.values()) total += pending.bytes.length;
    return total;
  }

  private lookup(ref: StorageObjectRef): StoredObject | null {
    const direct = this.objects.get(ref.objectId);
    if (direct !== undefined && (ref.remoteRef === undefined || ref.remoteRef === direct.remoteRef)) return direct;
    if (ref.remoteRef === undefined) return null;
    return [...this.objects.values()].find((object) => object.remoteRef === ref.remoteRef) ?? null;
  }

  private metadata(object: StoredObject): StorageObjectMetadata {
    return {
      objectId: object.objectId,
      dataClass: object.dataClass,
      remoteRef: object.remoteRef,
      remoteVersion: object.remoteVersion,
      encryptedBytes: object.bytes.length,
      ciphertextHash: object.ciphertextHash,
    };
  }

  private remoteRef(objectId: string): string {
    return `memory://${encodeURIComponent(objectId)}`;
  }
}
