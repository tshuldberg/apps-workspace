/**
 * Durable push-gateway contracts for Plan 42.
 *
 * Privacy boundary: every address and bearer secret reaches these stores only as
 * a SHA-256 hash. Provider tokens reach them only as ciphertext produced by a
 * PushTokenCipher. Attempts contain routing metadata and provider acceptance,
 * never a wake payload or a Meerkat identity.
 */

export type PushProvider = 'apns' | 'fcm' | 'webpush';
export type PushCapabilityScope = 'sync_wake' | 'call_wake';
export type PushProviderTokenState = 'active' | 'retiring' | 'invalidated';
export type PushAttemptState =
  | 'queued'
  | 'leased'
  | 'succeeded'
  | 'retryable'
  | 'failed'
  | 'cancelled';
export type PushProviderStatus =
  | 'pending'
  | 'provider_accepted'
  | 'provider_rejected'
  | 'unknown';
export type PushPublicProviderStatus = Exclude<PushProviderStatus, 'pending'>;

export type PushProviderInvalidationReason =
  | 'invalid_token'
  | 'unregistered'
  | 'token_expired'
  | 'provider_rejected';

export interface PushTokenCipherContext {
  registrationIdHash: string;
  provider: PushProvider;
  tokenGeneration: number;
}

export interface EncryptedPushProviderToken {
  /** Opaque authenticated ciphertext. Plaintext tokens are never store inputs. */
  ciphertext: Uint8Array;
  /** KMS or envelope-encryption key generation required to decrypt this value. */
  keyVersion: number;
}

/**
 * KMS seam implemented by the production deployment. This package intentionally
 * provides no local fallback or production fake.
 */
export interface PushTokenCipher {
  encryptProviderToken(
    plaintextToken: string,
    context: PushTokenCipherContext,
  ): Promise<EncryptedPushProviderToken>;
  decryptProviderToken(
    encryptedToken: EncryptedPushProviderToken,
    context: PushTokenCipherContext,
  ): Promise<string>;
  readiness(): Promise<{ ready: true; keyVersion: number } | { ready: false; reason: string }>;
}

export interface PushProviderTokenRecord {
  registrationIdHash: string;
  provider: PushProvider;
  tokenGeneration: number;
  encryptedToken: EncryptedPushProviderToken;
  state: PushProviderTokenState;
  expiresAt: string;
  retireAfter?: string;
  invalidatedAt?: string;
  invalidationReason?: PushProviderInvalidationReason;
  createdAt: string;
  updatedAt: string;
  lifecycleVersion: number;
}

export interface PushProviderTokenSummary
  extends Omit<PushProviderTokenRecord, 'encryptedToken'> {}

export interface PushRegistrationRecord {
  registrationIdHash: string;
  provider: PushProvider;
  expiresAt: string;
  revokedAt?: string;
  createdAt: string;
  updatedAt: string;
  lifecycleVersion: number;
  tokenGenerations: PushProviderTokenSummary[];
}

export interface PushCapabilityRecord {
  capabilityHash: string;
  registrationIdHash: string;
  scope: PushCapabilityScope;
  expiresAt: string;
  revokedAt?: string;
  createdAt: string;
  lifecycleVersion: number;
}

export interface PushCapabilityResolution {
  capability: PushCapabilityRecord;
  provider: PushProvider;
  /** Newest generation first. Retiring generations remain available only in their overlap window. */
  deliverableTokens: PushProviderTokenRecord[];
}

export interface PushIdempotentRequest {
  /** SHA-256 of the caller's opaque idempotency key. Never a user or device identifier. */
  idempotencyKey: string;
  /** Server-computed SHA-256 of the canonical, authorized request. */
  requestDigestHex: string;
  idempotencyExpiresAtMs: number;
  nowMs: number;
}

export interface RegisterPushInstallationInput extends PushIdempotentRequest {
  registrationIdHash: string;
  registrationSecretHash: string;
  provider: PushProvider;
  encryptedToken: EncryptedPushProviderToken;
  tokenGeneration: 1;
  tokenExpiresAtMs: number;
  registrationExpiresAtMs: number;
}

export interface RotatePushProviderTokenInput extends PushIdempotentRequest {
  registrationIdHash: string;
  registrationSecretHash: string;
  encryptedToken: EncryptedPushProviderToken;
  tokenGeneration: number;
  tokenExpiresAtMs: number;
  overlapMs: number;
}

export interface RevokePushRegistrationInput extends PushIdempotentRequest {
  registrationIdHash: string;
  registrationSecretHash: string;
}

export interface MintPushCapabilityInput extends PushIdempotentRequest {
  registrationIdHash: string;
  registrationSecretHash: string;
  capabilityHash: string;
  scope: PushCapabilityScope;
  expiresAtMs: number;
}

export interface RevokePushCapabilityInput extends PushIdempotentRequest {
  registrationIdHash: string;
  registrationSecretHash: string;
  capabilityHash: string;
}

export interface InvalidatePushProviderTokenInput {
  registrationIdHash: string;
  tokenGeneration: number;
  reason: PushProviderInvalidationReason;
  nowMs: number;
}

export type PushIdempotentMutationResult<Value> =
  | { status: 'applied'; value: Value }
  | { status: 'replay'; value: Value }
  | { status: 'conflict' }
  | { status: 'not_found' }
  | { status: 'unauthorized' };

export type PushTokenInvalidationResult =
  | { status: 'applied'; token: PushProviderTokenRecord }
  | { status: 'already_invalidated'; token: PushProviderTokenRecord }
  | { status: 'not_found' };

export interface PushRegistrationCursor {
  createdAt: string;
  registrationIdHash: string;
}

export interface PushRegistrationPage {
  records: PushRegistrationRecord[];
  nextCursor: PushRegistrationCursor | null;
}

export interface PushRegistrationStats {
  registrations: number;
  activeRegistrations: number;
  capabilities: number;
  activeCapabilities: number;
  activeTokens: number;
  retiringTokens: number;
  invalidatedTokens: number;
  expiredTokens: number;
}

export interface PushRegistrationPruneInput {
  nowMs: number;
  retainedUntilMs: number;
  idempotencyRetainedUntilMs: number;
  limit: number;
}

export interface PushRegistrationPruneResult {
  registrations: number;
  capabilities: number;
  tokens: number;
  idempotencyRecords: number;
}

export interface PushRegistrationStore {
  register(
    input: RegisterPushInstallationInput,
  ): Promise<PushIdempotentMutationResult<PushRegistrationRecord>>;
  rotateToken(
    input: RotatePushProviderTokenInput,
  ): Promise<PushIdempotentMutationResult<PushRegistrationRecord>>;
  revokeRegistration(
    input: RevokePushRegistrationInput,
  ): Promise<PushIdempotentMutationResult<PushRegistrationRecord>>;
  mintCapability(
    input: MintPushCapabilityInput,
  ): Promise<PushIdempotentMutationResult<PushCapabilityRecord>>;
  revokeCapability(
    input: RevokePushCapabilityInput,
  ): Promise<PushIdempotentMutationResult<PushCapabilityRecord>>;
  invalidateProviderToken(
    input: InvalidatePushProviderTokenInput,
  ): Promise<PushTokenInvalidationResult>;
  resolveCapability(input: {
    capabilityHash: string;
    scope: PushCapabilityScope;
    nowMs: number;
  }): Promise<PushCapabilityResolution | null>;
  /** O(1) by-hash read of one registration (any lifecycle state), or null. */
  getRegistration(registrationIdHash: string): Promise<PushRegistrationRecord | null>;
  listRegistrations(input?: {
    limit?: number;
    before?: PushRegistrationCursor;
  }): Promise<PushRegistrationPage>;
  stats(nowMs: number): Promise<PushRegistrationStats>;
  prune(input: PushRegistrationPruneInput): Promise<PushRegistrationPruneResult>;
}

export interface PushAttemptRecord {
  /** Independently generated attempt UUID. It must never reuse an application message id. */
  attemptId: string;
  capabilityHash: string;
  provider: PushProvider;
  tokenGeneration: number;
  idempotencyKey: string;
  requestDigestHex: string;
  state: PushAttemptState;
  providerStatus: PushProviderStatus;
  /** Provider-issued request reference only, never an application or user identifier. */
  providerReference?: string;
  leaseOwner?: string;
  leasedUntil?: string;
  attemptCount: number;
  fencingToken: number;
  nextAttemptAt: string;
  lastErrorCode?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  lifecycleVersion: number;
}

export interface EnqueuePushAttemptInput extends PushIdempotentRequest {
  attemptId: string;
  capabilityHash: string;
  provider: PushProvider;
  tokenGeneration: number;
  nextAttemptAtMs?: number;
}

export type PushAttemptEnqueueResult =
  | { status: 'created'; attempt: PushAttemptRecord }
  | { status: 'replay'; attempt: PushAttemptRecord }
  | { status: 'conflict' };

export interface ClaimPushAttemptsInput {
  owner: string;
  limit: number;
  leaseMs: number;
  nowMs: number;
}

export interface RenewPushAttemptInput {
  attemptId: string;
  owner: string;
  fencingToken: number;
  leaseMs: number;
  nowMs: number;
}

export type CompletePushAttemptOutcome =
  | {
      state: 'succeeded';
      providerStatus: 'provider_accepted';
      providerReference?: string;
    }
  | {
      state: 'retryable';
      providerStatus: 'unknown';
      errorCode: string;
      retryAtMs: number;
    }
  | {
      state: 'failed';
      providerStatus: 'provider_rejected' | 'unknown';
      errorCode: string;
      providerReference?: string;
    }
  | {
      state: 'cancelled';
      providerStatus: 'unknown';
      errorCode: string;
    };

export interface CompletePushAttemptInput {
  attemptId: string;
  owner: string;
  fencingToken: number;
  outcome: CompletePushAttemptOutcome;
  nowMs: number;
}

export type PushFencedAttemptResult =
  | { status: 'applied'; attempt: PushAttemptRecord }
  | { status: 'stale' }
  | { status: 'not_found' };

export interface PushAttemptStatus {
  attemptId: string;
  providerStatus: PushPublicProviderStatus;
  providerReference?: string;
  terminal: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PushAttemptCursor {
  createdAt: string;
  attemptId: string;
}

export interface PushAttemptPage {
  records: PushAttemptRecord[];
  nextCursor: PushAttemptCursor | null;
}

export interface PushAttemptStats {
  queued: number;
  leased: number;
  retryable: number;
  succeeded: number;
  failed: number;
  cancelled: number;
  due: number;
  total: number;
}

export interface PushAttemptPruneInput {
  nowMs: number;
  completedBeforeMs: number;
  idempotencyRetainedUntilMs: number;
  limit: number;
}

export interface PushAttemptPruneResult {
  attempts: number;
  idempotencyRecords: number;
}

export interface PushAttemptStore {
  enqueue(input: EnqueuePushAttemptInput): Promise<PushAttemptEnqueueResult>;
  claim(input: ClaimPushAttemptsInput): Promise<PushAttemptRecord[]>;
  renew(input: RenewPushAttemptInput): Promise<PushFencedAttemptResult>;
  complete(input: CompletePushAttemptInput): Promise<PushFencedAttemptResult>;
  cancelByCapability(input: {
    capabilityHash: string;
    reasonCode: string;
    nowMs: number;
    limit: number;
  }): Promise<number>;
  getStatus(input: {
    attemptId: string;
    capabilityHash: string;
  }): Promise<PushAttemptStatus | null>;
  list(input?: {
    state?: PushAttemptState;
    limit?: number;
    before?: PushAttemptCursor;
  }): Promise<PushAttemptPage>;
  stats(nowMs: number): Promise<PushAttemptStats>;
  prune(input: PushAttemptPruneInput): Promise<PushAttemptPruneResult>;
}
