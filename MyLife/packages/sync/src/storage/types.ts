export type StorageDestinationKind =
  | 'local_device'
  | 'icloud_drive'
  | 'google_drive'
  | 'dropbox'
  | 'onedrive'
  | 'box'
  | 'file_provider'
  | 'webdav'
  | 's3'
  | 'hosted_storage'
  | 'connected_server';

export interface StorageCapabilities {
  backgroundWrite: boolean;
  resumableUpload: boolean;
  list: boolean;
  delete: boolean;
  quota: boolean;
  serverChecksum: boolean;
  maximumObjectBytes: number;
}

/** References only SecureStore keys or broker-vault records, never credentials. */
export type StorageAuthorizationInput =
  | {
      kind: 'interactive';
      accountHint?: string;
      credentialRef?: string;
    }
  | {
      kind: 'stored_credential';
      accountHint?: string;
      credentialRef: string;
    }
  | {
      kind: 'broker_vault';
      accountHint?: string;
      credentialRef: string;
    };

/** Authorization results contain custody references, never token or secret values. */
export type StorageAuthorizationResult =
  | {
      kind: 'authorized';
      accountHint?: string;
      credentialRef?: string;
    }
  | {
      kind: 'authorization_required';
      accountHint?: string;
      credentialRef?: string;
    }
  | {
      kind: 'revoked';
      accountHint?: string;
      credentialRef?: string;
    }
  | {
      kind: 'cancelled';
      accountHint?: string;
      credentialRef?: string;
    };

export interface StorageHealth {
  state: 'ok' | 'degraded' | 'unreachable' | 'auth_required' | 'revoked';
  verifiedReadWrite: boolean;
  checkedAt: string;
  errorCode?: string;
}

export interface StorageQuota {
  usedBytes: number | null;
  capBytes: number | null;
  estimated: boolean;
}

export interface EncryptedStorageObject {
  objectId: string;
  dataClass: string;
  ciphertext: Uint8Array;
  /** Lowercase SHA-512 hex over ciphertext. */
  ciphertextHash: string;
  encryptedBytes: number;
}

export type StorageVerificationEvidence =
  | { kind: 'read_back'; ciphertextHash: string }
  | { kind: 'provider_checksum'; algorithm: string; value: string }
  | { kind: 'none' };

export type VerifiedStorageEvidence = Exclude<StorageVerificationEvidence, { kind: 'none' }>;

interface StorageWriteResultBase {
  remoteRef: string;
  remoteVersion: string | null;
  encryptedBytes: number;
  ciphertextHash: string;
}

export type StorageWriteResult =
  | (StorageWriteResultBase & {
      complete: true;
      verified: true;
      verification: VerifiedStorageEvidence;
      resumeToken?: never;
    })
  | (StorageWriteResultBase & {
      complete: true;
      verified: false;
      verification: { kind: 'none' };
      resumeToken?: never;
    })
  | (StorageWriteResultBase & {
      complete: false;
      verified: false;
      verification: { kind: 'none' };
      resumeToken: StorageResumeToken;
    });

export interface StorageObjectRef {
  objectId: string;
  remoteRef?: string;
}

export interface StorageObjectMetadata {
  objectId: string;
  dataClass: string;
  remoteRef: string;
  remoteVersion: string | null;
  encryptedBytes: number;
  /**
   * Lowercase SHA-512 hex over the stored ciphertext, ONLY when the provider
   * proves it (server-side checksum or adapter read-back). Never an ETag or
   * other provider revision token (NC-41.6): an adapter that cannot prove the
   * hash MUST return null, because the router treats a matching value here as
   * provider_checksum verification evidence.
   */
  ciphertextHash: string | null;
}

export interface StorageByteRange {
  offset: number;
  length: number;
}

export interface StorageObjectPage {
  items: StorageObjectMetadata[];
  nextCursor: string | null;
}

export interface StorageDeleteResult {
  deleted: boolean;
  remoteRef: string | null;
}

export interface StorageResumeToken {
  /** Opaque provider upload-session reference, not a general auth credential. */
  providerSession: string;
  offset: number;
}

export type StorageErrorCode =
  | 'auth_required'
  | 'revoked'
  | 'quota_exceeded'
  | 'unreachable'
  | 'corrupt_ciphertext'
  | 'conflict'
  | 'unsafe_redirect'
  | 'not_found'
  | 'rate_limited'
  | 'provider_error'
  | 'cancelled';

export class StorageAdapterError extends Error {
  readonly code: StorageErrorCode;
  readonly retryable: boolean;

  constructor(code: StorageErrorCode, message: string, retryable: boolean) {
    super(message);
    this.name = 'StorageAdapterError';
    this.code = code;
    this.retryable = retryable;
  }
}

export interface StorageDestinationAdapter {
  authorize(input: StorageAuthorizationInput): Promise<StorageAuthorizationResult>;
  revoke(options: { deleteRemoteData: boolean }): Promise<void>;
  capabilities(): Promise<StorageCapabilities>;
  health(): Promise<StorageHealth>;
  quota(): Promise<StorageQuota>;
  putObject(input: EncryptedStorageObject, resume?: StorageResumeToken): Promise<StorageWriteResult>;
  headObject(ref: StorageObjectRef): Promise<StorageObjectMetadata | null>;
  getObject(ref: StorageObjectRef, range?: StorageByteRange): Promise<Uint8Array | null>;
  listObjects(cursor?: string): Promise<StorageObjectPage>;
  deleteObject(ref: StorageObjectRef): Promise<StorageDeleteResult>;
}
