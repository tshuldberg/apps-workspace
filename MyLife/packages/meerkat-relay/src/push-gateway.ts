/**
 * Meerkat push gateway service core (Plan 42 P4).
 *
 * Drives the Phase 1/44 push stores (registration, encrypted provider token,
 * capability, attempt) and the provider adapters through one uniform surface:
 *
 *   - registration create / rotate / revoke, with provider-token ENCRYPTION via the
 *     injected PushTokenCipher (plaintext tokens never touch the store);
 *   - capability mint / revoke, addressed by a random 256-bit capability whose SHA-256
 *     hash is the only value the server keeps (the capability hash IS the wake bearer);
 *   - wake enqueue: a bounded opaque payload is queued as an attempt, then the drain
 *     loop CLAIMS (fenced lease), DECRYPTS the deliverable token, SENDS via the
 *     provider adapter, and COMPLETEs the attempt (succeeded / retryable-reschedule /
 *     failed-poison), invalidating a provider token the adapter reports dead;
 *   - abuse controls: per-capability sliding wake-rate windows, payload-size caps, and
 *     expiry/revocation enforcement inherited from the store's deliverability checks.
 *
 * Privacy (NC-42.3): no push record or log line carries a device pubkey, community id,
 * message id, caller identity, or plaintext content. Acceptance is recorded, never
 * "delivered" (NC-42.4): the public status is provider_accepted / provider_rejected /
 * unknown only. The gateway holds NO Meerkat identity; a caller proves a mutation with
 * the registration secret and proves a wake with the raw capability, nothing else.
 */

import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type {
  CompletePushAttemptOutcome,
  PushAttemptRecord,
  PushAttemptStore,
  PushCapabilityScope,
  PushProvider,
  PushProviderInvalidationReason,
  PushProviderTokenRecord,
  PushPublicProviderStatus,
  PushRegistrationRecord,
  PushRegistrationStore,
  PushTokenCipher,
} from './push-store';
import {
  MAX_PUSH_WAKE_PAYLOAD_BYTES,
  type PushProviderAdapter,
  type PushProviderOutcome,
  type PushRejectionReasonClass,
  type PushWakeUrgency,
} from './push-providers';

/** Wake capabilities and registration secrets are 256-bit random values, base64url. */
const RANDOM_TOKEN = /^[A-Za-z0-9_-]{43}$/u;
const HASH = /^[a-f0-9]{64}$/u;
const MAX_URGENCY_HIGH_RATE = { max: 30, windowMs: 60_000 } as const;
const MAX_URGENCY_NORMAL_RATE = { max: 120, windowMs: 60_000 } as const;

/** Bounded lease, retry, and idempotency budgets for the attempt loop. */
const DEFAULTS = {
  leaseMs: 30_000,
  claimLimit: 32,
  maxAttempts: 5,
  baseRetryMs: 15_000,
  maxRetryMs: 15 * 60_000,
  idempotencyTtlMs: 24 * 60 * 60_000,
  capabilityMaxTtlMs: 30 * 24 * 60 * 60_000,
  registrationMaxTtlMs: 90 * 24 * 60 * 60_000,
  tokenMaxTtlMs: 60 * 24 * 60 * 60_000,
  rotateOverlapMs: 24 * 60 * 60_000,
  sendTimeoutMs: 10_000,
} as const;

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function assertRandomToken(label: string, value: string): void {
  if (!RANDOM_TOKEN.test(value)) throw new PushGatewayInputError(`${label} must be a 256-bit base64url token`);
}

function assertProvider(value: unknown): asserts value is PushProvider {
  if (value !== 'apns' && value !== 'fcm' && value !== 'webpush') {
    throw new PushGatewayInputError('provider must be apns, fcm, or webpush');
  }
}

function assertScope(value: unknown): asserts value is PushCapabilityScope {
  if (value !== 'sync_wake' && value !== 'call_wake') {
    throw new PushGatewayInputError('scope must be sync_wake or call_wake');
  }
}

/** Input rejected before any store mutation. The message is safe (no secret material). */
export class PushGatewayInputError extends Error {
  readonly code = 'invalid_request';
}

export interface PushGatewayObservers {
  /** Static-label attempt outcome counter sink (provider, outcome). Never identity. */
  onAttemptOutcome?(provider: PushProvider, outcome: 'accepted' | 'rejected' | 'retryable' | 'poisoned' | 'cancelled'): void;
  /** Structured, redacted log sink. Detail is bounded/machine-readable only. */
  log?(event: string, detail?: Record<string, unknown>): void;
}

export interface PushGatewayOptions {
  registrations: PushRegistrationStore;
  attempts: PushAttemptStore;
  cipher: PushTokenCipher;
  /** One adapter per provider the deployment supports. Missing provider => wake unavailable. */
  adapters: Partial<Record<PushProvider, PushProviderAdapter>>;
  now?: () => number;
  observers?: PushGatewayObservers;
  /** Stable owner id for this process's attempt leases. */
  workerId?: string;
  overrides?: Partial<typeof DEFAULTS>;
}

export interface RegisterInstallationRequest {
  registrationId: string;
  registrationSecret: string;
  provider: PushProvider;
  /** The plaintext provider token; the gateway encrypts it before storing. */
  providerToken: string;
  tokenTtlMs: number;
  registrationTtlMs: number;
  idempotencyKey: string;
}

export interface RotateTokenRequest {
  registrationId: string;
  registrationSecret: string;
  providerToken: string;
  tokenTtlMs: number;
  idempotencyKey: string;
}

export interface RevokeRegistrationRequest {
  registrationId: string;
  registrationSecret: string;
  idempotencyKey: string;
}

export interface MintCapabilityRequest {
  registrationId: string;
  registrationSecret: string;
  capability: string;
  scope: PushCapabilityScope;
  ttlMs: number;
  idempotencyKey: string;
}

export interface RevokeCapabilityRequest {
  registrationId: string;
  registrationSecret: string;
  capability: string;
  idempotencyKey: string;
}

export interface EnqueueWakeRequest {
  capability: string;
  scope: PushCapabilityScope;
  payload: Uint8Array;
  urgency: PushWakeUrgency;
  idempotencyKey: string;
}

export type PushGatewayMutationResult<Value> =
  | { status: 'ok'; value: Value }
  | { status: 'conflict' }
  | { status: 'not_found' }
  | { status: 'unauthorized' };

export type EnqueueWakeResult =
  | { status: 'accepted'; attemptId: string }
  | { status: 'not_found' }
  | { status: 'rate_limited'; retryAfterSeconds: number }
  | { status: 'unavailable' };

export interface PublicAttemptStatus {
  attemptId: string;
  providerStatus: PushPublicProviderStatus;
  terminal: boolean;
}

interface RateWindow {
  count: number;
  resetsAt: number;
}

/**
 * The gateway service. Stateless except for a bounded in-memory wake-rate window map
 * (self-cleaning). All durable state lives in the injected stores.
 */
export class PushGatewayService {
  private readonly registrations: PushRegistrationStore;
  private readonly attempts: PushAttemptStore;
  private readonly cipher: PushTokenCipher;
  private readonly adapters: Partial<Record<PushProvider, PushProviderAdapter>>;
  private readonly now: () => number;
  private readonly observers: PushGatewayObservers;
  private readonly workerId: string;
  private readonly config: typeof DEFAULTS;
  private readonly rateWindows = new Map<string, RateWindow>();

  constructor(options: PushGatewayOptions) {
    this.registrations = options.registrations;
    this.attempts = options.attempts;
    this.cipher = options.cipher;
    this.adapters = options.adapters;
    this.now = options.now ?? (() => Date.now());
    this.observers = options.observers ?? {};
    this.workerId = options.workerId ?? `push-worker-${randomUUID()}`;
    this.config = { ...DEFAULTS, ...(options.overrides ?? {}) };
  }

  supportsProvider(provider: PushProvider): boolean {
    return Boolean(this.adapters[provider]);
  }

  // ---- registration lifecycle -------------------------------------------

  async registerInstallation(
    request: RegisterInstallationRequest,
  ): Promise<PushGatewayMutationResult<PushRegistrationRecord>> {
    assertRandomToken('registrationId', request.registrationId);
    assertRandomToken('registrationSecret', request.registrationSecret);
    assertProvider(request.provider);
    this.assertProviderToken(request.provider, request.providerToken);
    const nowMs = this.now();
    const tokenExpiresAtMs = this.futureBudget('tokenTtlMs', request.tokenTtlMs, this.config.tokenMaxTtlMs, nowMs);
    const registrationExpiresAtMs = this.futureBudget(
      'registrationTtlMs', request.registrationTtlMs, this.config.registrationMaxTtlMs, nowMs,
    );
    const registrationIdHash = sha256Hex(request.registrationId);
    const encryptedToken = await this.cipher.encryptProviderToken(request.providerToken, {
      registrationIdHash,
      provider: request.provider,
      tokenGeneration: 1,
    });
    const result = await this.registrations.register({
      ...this.idempotency(request.idempotencyKey, nowMs, {
        registrationIdHash, provider: request.provider, tokenGeneration: 1,
      }),
      registrationIdHash,
      registrationSecretHash: sha256Hex(request.registrationSecret),
      provider: request.provider,
      encryptedToken,
      tokenGeneration: 1,
      tokenExpiresAtMs,
      registrationExpiresAtMs,
    });
    return this.toMutationResult(result);
  }

  async rotateToken(
    request: RotateTokenRequest,
  ): Promise<PushGatewayMutationResult<PushRegistrationRecord>> {
    assertRandomToken('registrationId', request.registrationId);
    assertRandomToken('registrationSecret', request.registrationSecret);
    const nowMs = this.now();
    const registrationIdHash = sha256Hex(request.registrationId);
    // Determine the provider + next generation from the current registration.
    const current = await this.registrations.getRegistration(registrationIdHash);
    if (!current) return { status: 'not_found' };
    this.assertProviderToken(current.provider, request.providerToken);
    const tokenExpiresAtMs = this.futureBudget('tokenTtlMs', request.tokenTtlMs, this.config.tokenMaxTtlMs, nowMs);
    const nextGeneration = current.tokenGenerations.reduce(
      (max, token) => Math.max(max, token.tokenGeneration), 0,
    ) + 1;
    const encryptedToken = await this.cipher.encryptProviderToken(request.providerToken, {
      registrationIdHash,
      provider: current.provider,
      tokenGeneration: nextGeneration,
    });
    const result = await this.registrations.rotateToken({
      ...this.idempotency(request.idempotencyKey, nowMs, {
        registrationIdHash, tokenGeneration: nextGeneration,
      }),
      registrationIdHash,
      registrationSecretHash: sha256Hex(request.registrationSecret),
      encryptedToken,
      tokenGeneration: nextGeneration,
      tokenExpiresAtMs,
      overlapMs: this.config.rotateOverlapMs,
    });
    return this.toMutationResult(result);
  }

  async revokeRegistration(
    request: RevokeRegistrationRequest,
  ): Promise<PushGatewayMutationResult<PushRegistrationRecord>> {
    assertRandomToken('registrationId', request.registrationId);
    assertRandomToken('registrationSecret', request.registrationSecret);
    const nowMs = this.now();
    const registrationIdHash = sha256Hex(request.registrationId);
    const result = await this.registrations.revokeRegistration({
      ...this.idempotency(request.idempotencyKey, nowMs, { registrationIdHash, revoke: true }),
      registrationIdHash,
      registrationSecretHash: sha256Hex(request.registrationSecret),
    });
    return this.toMutationResult(result);
  }

  // ---- capability lifecycle ---------------------------------------------

  async mintCapability(
    request: MintCapabilityRequest,
  ): Promise<PushGatewayMutationResult<{ capabilityHash: string; scope: PushCapabilityScope; expiresAt: string }>> {
    assertRandomToken('registrationId', request.registrationId);
    assertRandomToken('registrationSecret', request.registrationSecret);
    assertRandomToken('capability', request.capability);
    assertScope(request.scope);
    const nowMs = this.now();
    const expiresAtMs = this.futureBudget('ttlMs', request.ttlMs, this.config.capabilityMaxTtlMs, nowMs);
    const registrationIdHash = sha256Hex(request.registrationId);
    const capabilityHash = sha256Hex(request.capability);
    const result = await this.registrations.mintCapability({
      ...this.idempotency(request.idempotencyKey, nowMs, {
        registrationIdHash, capabilityHash, scope: request.scope,
      }),
      registrationIdHash,
      registrationSecretHash: sha256Hex(request.registrationSecret),
      capabilityHash,
      scope: request.scope,
      expiresAtMs,
    });
    if (result.status !== 'applied' && result.status !== 'replay') {
      return this.toMutationResult(result);
    }
    return {
      status: 'ok',
      value: {
        capabilityHash: result.value.capabilityHash,
        scope: result.value.scope,
        expiresAt: result.value.expiresAt,
      },
    };
  }

  async revokeCapability(
    request: RevokeCapabilityRequest,
  ): Promise<PushGatewayMutationResult<{ capabilityHash: string }>> {
    assertRandomToken('registrationId', request.registrationId);
    assertRandomToken('registrationSecret', request.registrationSecret);
    assertRandomToken('capability', request.capability);
    const nowMs = this.now();
    const registrationIdHash = sha256Hex(request.registrationId);
    const capabilityHash = sha256Hex(request.capability);
    const result = await this.registrations.revokeCapability({
      ...this.idempotency(request.idempotencyKey, nowMs, { registrationIdHash, capabilityHash, revoke: true }),
      registrationIdHash,
      registrationSecretHash: sha256Hex(request.registrationSecret),
      capabilityHash,
    });
    if (result.status !== 'applied' && result.status !== 'replay') {
      return this.toMutationResult(result);
    }
    return { status: 'ok', value: { capabilityHash: result.value.capabilityHash } };
  }

  // ---- wake enqueue + status --------------------------------------------

  async enqueueWake(request: EnqueueWakeRequest): Promise<EnqueueWakeResult> {
    assertRandomToken('capability', request.capability);
    assertScope(request.scope);
    if (request.urgency !== 'high' && request.urgency !== 'normal') {
      throw new PushGatewayInputError('urgency must be high or normal');
    }
    if (!(request.payload instanceof Uint8Array) || request.payload.byteLength === 0) {
      throw new PushGatewayInputError('payload must be non-empty bytes');
    }
    if (request.payload.byteLength > MAX_PUSH_WAKE_PAYLOAD_BYTES) {
      throw new PushGatewayInputError(`payload exceeds ${MAX_PUSH_WAKE_PAYLOAD_BYTES} bytes`);
    }
    const nowMs = this.now();
    const capabilityHash = sha256Hex(request.capability);

    const rate = this.checkRateWindow(capabilityHash, request.urgency, nowMs);
    if (!rate.allowed) {
      return { status: 'rate_limited', retryAfterSeconds: rate.retryAfterSeconds };
    }

    const resolution = await this.registrations.resolveCapability({
      capabilityHash,
      scope: request.scope,
      nowMs,
    });
    if (!resolution) return { status: 'not_found' };
    if (!this.supportsProvider(resolution.provider)) return { status: 'unavailable' };
    const deliverable = resolution.deliverableTokens[0];
    if (!deliverable) return { status: 'unavailable' };

    const attemptId = randomUUID();
    const enqueue = await this.attempts.enqueue({
      ...this.idempotency(request.idempotencyKey, nowMs, {
        capabilityHash, attemptId, generation: deliverable.tokenGeneration,
      }),
      attemptId,
      capabilityHash,
      provider: resolution.provider,
      tokenGeneration: deliverable.tokenGeneration,
    });
    if (enqueue.status === 'conflict') return { status: 'unavailable' };
    // The opaque payload rides on the drain via a bounded in-memory map keyed by the
    // attempt id; it is never persisted (NC-42.3: no plaintext content in any record).
    this.pendingPayloads.set(enqueue.attempt.attemptId, {
      payload: Uint8Array.from(request.payload),
      urgency: request.urgency,
    });
    return { status: 'accepted', attemptId: enqueue.attempt.attemptId };
  }

  async getAttemptStatus(input: { attemptId: string; capability: string }): Promise<PublicAttemptStatus | null> {
    assertRandomToken('capability', input.capability);
    const status = await this.attempts.getStatus({
      attemptId: input.attemptId,
      capabilityHash: sha256Hex(input.capability),
    });
    if (!status) return null;
    return {
      attemptId: status.attemptId,
      providerStatus: status.providerStatus,
      terminal: status.terminal,
    };
  }

  // ---- attempt drain loop -----------------------------------------------

  /**
   * One bounded drain pass: claim due attempts under a fenced lease, deliver each via
   * its provider adapter, and complete (succeed / reschedule / poison). Returns the
   * number of attempts processed so a caller can decide whether to loop again.
   */
  async drainOnce(): Promise<number> {
    const nowMs = this.now();
    const claimed = await this.attempts.claim({
      owner: this.workerId,
      limit: this.config.claimLimit,
      leaseMs: this.config.leaseMs,
      nowMs,
    });
    let processed = 0;
    for (const attempt of claimed) {
      await this.deliverClaimed(attempt);
      processed += 1;
    }
    return processed;
  }

  private async deliverClaimed(attempt: PushAttemptRecord): Promise<void> {
    const pending = this.pendingPayloads.get(attempt.attemptId);
    const adapter = this.adapters[attempt.provider];
    if (!adapter) {
      await this.complete(attempt, { state: 'failed', providerStatus: 'unknown', errorCode: 'provider_unsupported' }, 'poisoned');
      return;
    }
    if (!pending) {
      // The payload is gone (process restart between enqueue and drain). This attempt
      // can never carry its wake, so poison it rather than deliver an empty push.
      await this.complete(attempt, { state: 'failed', providerStatus: 'unknown', errorCode: 'payload_unavailable' }, 'poisoned');
      return;
    }
    // Re-resolve to get the CURRENT deliverable token ciphertext for this generation.
    const token = await this.resolveDeliverableToken(attempt);
    if (!token) {
      await this.complete(attempt, { state: 'failed', providerStatus: 'unknown', errorCode: 'address_unavailable' }, 'cancelled');
      return;
    }
    let plaintextToken: string;
    try {
      plaintextToken = await this.cipher.decryptProviderToken(token.encryptedToken, {
        registrationIdHash: token.registrationIdHash,
        provider: token.provider,
        tokenGeneration: token.tokenGeneration,
      });
    } catch {
      await this.complete(attempt, {
        state: 'retryable', providerStatus: 'unknown', errorCode: 'token_decrypt_failed',
        retryAtMs: this.retryAt(attempt),
      }, 'retryable');
      return;
    }

    let outcome: PushProviderOutcome;
    try {
      outcome = await adapter.send({
        token: plaintextToken,
        payload: pending.payload,
        urgency: pending.urgency,
        timeoutMs: this.config.sendTimeoutMs,
      });
    } catch {
      outcome = { kind: 'retryable', reasonClass: 'transport_error' };
    }
    await this.applyOutcome(attempt, outcome, token.registrationIdHash);
  }

  private async applyOutcome(
    attempt: PushAttemptRecord,
    outcome: PushProviderOutcome,
    registrationIdHash: string,
  ): Promise<void> {
    switch (outcome.kind) {
      case 'accepted':
        this.pendingPayloads.delete(attempt.attemptId);
        await this.complete(attempt, {
          state: 'succeeded',
          providerStatus: 'provider_accepted',
          ...(outcome.providerReference ? { providerReference: outcome.providerReference } : {}),
        }, 'accepted');
        return;
      case 'rejected': {
        this.pendingPayloads.delete(attempt.attemptId);
        // Complete the fenced attempt as provider_rejected FIRST, then invalidate the
        // dead token. Invalidation cancels any OTHER in-flight attempts on this
        // generation; doing it first would cancel this attempt out from under our fence
        // and lose the honest provider_rejected verdict.
        await this.complete(attempt, {
          state: 'failed', providerStatus: 'provider_rejected', errorCode: `rejected_${outcome.reasonClass}`,
        }, 'poisoned');
        const invalidation = tokenInvalidationForRejection(outcome.reasonClass);
        if (invalidation) {
          await this.registrations.invalidateProviderToken({
            registrationIdHash,
            tokenGeneration: attempt.tokenGeneration,
            reason: invalidation,
            nowMs: this.now(),
          }).catch(() => undefined);
        }
        return;
      }
      case 'retryable': {
        if (attempt.attemptCount >= this.config.maxAttempts) {
          this.pendingPayloads.delete(attempt.attemptId);
          await this.complete(attempt, {
            state: 'failed', providerStatus: 'unknown', errorCode: `exhausted_${outcome.reasonClass}`,
          }, 'poisoned');
          return;
        }
        await this.complete(attempt, {
          state: 'retryable', providerStatus: 'unknown', errorCode: `retry_${outcome.reasonClass}`,
          retryAtMs: this.retryAt(attempt),
        }, 'retryable');
        return;
      }
      case 'unavailable':
        this.pendingPayloads.delete(attempt.attemptId);
        await this.complete(attempt, {
          state: 'failed', providerStatus: 'unknown', errorCode: 'provider_unavailable',
        }, 'poisoned');
        return;
    }
  }

  private async complete(
    attempt: PushAttemptRecord,
    outcome: CompletePushAttemptOutcome,
    metric: 'accepted' | 'rejected' | 'retryable' | 'poisoned' | 'cancelled',
  ): Promise<void> {
    const result = await this.attempts.complete({
      attemptId: attempt.attemptId,
      owner: this.workerId,
      fencingToken: attempt.fencingToken,
      outcome,
      nowMs: this.now(),
    });
    if (result.status === 'applied') {
      this.observers.onAttemptOutcome?.(attempt.provider, metric);
      this.observers.log?.('push_attempt_completed', {
        provider: attempt.provider,
        outcome: metric,
        state: outcome.state,
      });
    }
    if (outcome.state !== 'retryable') this.pendingPayloads.delete(attempt.attemptId);
  }

  // ---- helpers -----------------------------------------------------------

  private readonly pendingPayloads = new Map<string, { payload: Uint8Array; urgency: PushWakeUrgency }>();

  private retryAt(attempt: PushAttemptRecord): number {
    const exponent = Math.min(attempt.attemptCount, 8);
    const backoff = Math.min(this.config.maxRetryMs, this.config.baseRetryMs * 2 ** (exponent - 1));
    const jitter = Math.floor(backoff * 0.2 * Math.random());
    return this.now() + backoff + jitter;
  }

  private async resolveDeliverableToken(attempt: PushAttemptRecord): Promise<PushProviderTokenRecord | null> {
    // The capability resolution returns the current deliverable tokens; match the one
    // for this attempt's generation. A rotated-away generation simply won't be present.
    const resolution = await this.registrations.resolveCapability({
      capabilityHash: attempt.capabilityHash,
      scope: 'sync_wake',
      nowMs: this.now(),
    }) ?? await this.registrations.resolveCapability({
      capabilityHash: attempt.capabilityHash,
      scope: 'call_wake',
      nowMs: this.now(),
    });
    if (!resolution) return null;
    return resolution.deliverableTokens.find(
      (token) => token.tokenGeneration === attempt.tokenGeneration,
    ) ?? null;
  }

  private assertProviderToken(provider: PushProvider, token: string): void {
    if (typeof token !== 'string' || token.length === 0 || token.length > 8192) {
      throw new PushGatewayInputError('providerToken is invalid');
    }
    if (/[\r\n\0]/u.test(token)) throw new PushGatewayInputError('providerToken is invalid');
    if (provider === 'webpush') {
      try {
        JSON.parse(token);
      } catch {
        throw new PushGatewayInputError('webpush providerToken must be a JSON subscription');
      }
    }
  }

  private futureBudget(label: string, ttlMs: number, maxMs: number, nowMs: number): number {
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) throw new PushGatewayInputError(`${label} must be positive`);
    const clamped = Math.min(Math.floor(ttlMs), maxMs);
    return nowMs + clamped;
  }

  private idempotency(
    idempotencyKey: string,
    nowMs: number,
    canonical: Record<string, unknown>,
  ): { idempotencyKey: string; requestDigestHex: string; idempotencyExpiresAtMs: number; nowMs: number } {
    if (typeof idempotencyKey !== 'string' || idempotencyKey.length < 8 || idempotencyKey.length > 256) {
      throw new PushGatewayInputError('idempotencyKey must be 8-256 chars');
    }
    return {
      idempotencyKey: sha256Hex(idempotencyKey),
      requestDigestHex: createHash('sha256').update(JSON.stringify(canonical)).digest('hex'),
      idempotencyExpiresAtMs: nowMs + this.config.idempotencyTtlMs,
      nowMs,
    };
  }

  private toMutationResult<Value>(
    result: { status: string; value?: Value },
  ): PushGatewayMutationResult<Value> {
    switch (result.status) {
      case 'applied':
      case 'replay':
        return { status: 'ok', value: result.value as Value };
      case 'conflict':
        return { status: 'conflict' };
      case 'unauthorized':
        return { status: 'unauthorized' };
      default:
        return { status: 'not_found' };
    }
  }

  private checkRateWindow(
    capabilityHash: string,
    urgency: PushWakeUrgency,
    nowMs: number,
  ): { allowed: boolean; retryAfterSeconds: number } {
    const policy = urgency === 'high' ? MAX_URGENCY_HIGH_RATE : MAX_URGENCY_NORMAL_RATE;
    const key = `${urgency}:${capabilityHash}`;
    const window = this.rateWindows.get(key);
    if (!window || window.resetsAt <= nowMs) {
      this.rateWindows.set(key, { count: 1, resetsAt: nowMs + policy.windowMs });
      this.pruneRateWindows(nowMs);
      return { allowed: true, retryAfterSeconds: 0 };
    }
    if (window.count >= policy.max) {
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((window.resetsAt - nowMs) / 1000)) };
    }
    window.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }

  private pruneRateWindows(nowMs: number): void {
    if (this.rateWindows.size < 10_000) return;
    for (const [key, window] of this.rateWindows) {
      if (window.resetsAt <= nowMs) this.rateWindows.delete(key);
    }
  }
}

function tokenInvalidationForRejection(
  reasonClass: PushRejectionReasonClass,
): PushProviderInvalidationReason | null {
  switch (reasonClass) {
    case 'invalid_token':
      return 'invalid_token';
    case 'token_unregistered':
      return 'unregistered';
    default:
      return null;
  }
}

/** 256-bit base64url token (43 chars). Used for registration ids, secrets, capabilities. */
export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

export function capabilityHashHex(capability: string): string {
  if (!RANDOM_TOKEN.test(capability)) throw new PushGatewayInputError('capability must be a 256-bit base64url token');
  return sha256Hex(capability);
}

export function isPushHash(value: string): boolean {
  return HASH.test(value);
}

/** Constant-time compare for two same-length hex strings (defense against timing). */
export function pushHashesEqual(left: string, right: string): boolean {
  if (!HASH.test(left) || !HASH.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}
