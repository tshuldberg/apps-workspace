/**
 * Plan 51 P1 + P5: the verification-account service core.
 *
 * This is the ONLY component that both learns which store account a caller is (via
 * SSO token verification) AND blind-signs anonymous credentials for the inner layer.
 * It never persists a link between the two: issuance is blind (it never sees a token
 * message, nonce, or serial), and the one datum that transits at renewal -- the
 * expiring credential's serial -- is checked against the revocation list and then
 * discarded, never written to any account table or log (AC-2/AC-3).
 *
 * Session bearers follow persona-session.ts exactly: HMAC-SHA256 over a domain-led
 * MAC input, constant-time compare, TTL clamp, fail-closed without a secret. The
 * domain is distinct ('meerkat-account-session-v1') so an account session can never
 * cross-verify as a persona session.
 *
 * Uniform refusal (quota side-channel hygiene, AC-1/NC-1): every issuance refusal --
 * already-issued this epoch, renewal-flagged, or unentitled -- returns the SAME
 * { ok:false, reason:'refused' } shape, and every refusal path performs the same
 * store reads (see issueLocked) so there is no timing-distinguishable early exit.
 */

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import {
  blindSignCredential,
  deriveEpochPublicKey,
  generateEpochKeyPair,
  sealEpochPrivateKey,
  unsealEpochPrivateKey,
} from './blind-credential-server';
import { createCredentialVerifier } from './credential-verify';
import {
  CREDENTIAL_MODULUS_BYTES,
  credentialBase64ToBytes,
  credentialEpochAt,
  credentialEpochWindow,
  isWithinRenewalWindow,
  parseRsaPublicKeySpki,
} from '@mylife/sync';
import { canIssueCredential } from './account-store';
import type {
  AccountAgeSource,
  AccountProvider,
  AccountRecord,
  AccountStore,
  EntitlementProduct,
  EntitlementRail,
  EntitlementStatus,
} from './account-store';
import type { CredentialBridgeStore } from './credential-bridge-store';
import type { SsoProvider, SsoTokenVerifier } from './sso-token-verify';

/**
 * Client-input shape check for a blinded message: base64 decoding to exactly
 * modulus length. Runs BEFORE the quota insert so a malformed request can never
 * burn the account's one-per-epoch slot. Content-independent (every caller gets
 * the same check), so it opens no eligibility side channel.
 */
function isWellFormedBlindedMessage(blindedMessageBase64: unknown): blindedMessageBase64 is string {
  if (typeof blindedMessageBase64 !== 'string') return false;
  const bytes = credentialBase64ToBytes(blindedMessageBase64);
  return bytes !== null && bytes.length === CREDENTIAL_MODULUS_BYTES;
}

// ---------------------------------------------------------------------------
// Account session bearer (HMAC-SHA256, distinct domain from persona sessions).
// ---------------------------------------------------------------------------

export const ACCOUNT_SESSION_DOMAIN = 'meerkat-account-session-v1';
export const DEFAULT_ACCOUNT_SESSION_TTL_MS = 60 * 60 * 1000;
export const MAX_ACCOUNT_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export interface AccountSessionClaims {
  accountId: string;
  issuedAtMs: number;
  expiresAtMs: number;
}

const ACCOUNT_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function bytesToBase64Url(bytes: Buffer): string {
  return bytes.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value: string): Buffer | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  } catch {
    return null;
  }
}

function sessionMacInput(claims: AccountSessionClaims): string {
  return `${ACCOUNT_SESSION_DOMAIN}:${claims.accountId}:${claims.issuedAtMs}:${claims.expiresAtMs}`;
}

/** Mint an account session bearer: `<accountId>.<issuedAtMs>.<expiresAtMs>.<hmacBase64Url>`. */
export function signAccountSessionToken(secret: string, claims: AccountSessionClaims): string {
  const mac = createHmac('sha256', secret).update(sessionMacInput(claims)).digest();
  return `${claims.accountId}.${claims.issuedAtMs}.${claims.expiresAtMs}.${bytesToBase64Url(mac)}`;
}

export type AccountSessionReason = 'not_configured' | 'malformed' | 'bad_signature' | 'expired';

export type AccountSessionVerdict =
  | { ok: true; accountId: string; issuedAtMs: number; expiresAtMs: number }
  | { ok: false; reason: AccountSessionReason };

/** Verify an account session bearer. Fail-closed; MAC checked before expiry. */
export function verifyAccountSessionToken(token: string, secret: string, nowMs: number): AccountSessionVerdict {
  if (!secret) return { ok: false, reason: 'not_configured' };
  if (typeof token !== 'string') return { ok: false, reason: 'malformed' };
  const parts = token.split('.');
  if (parts.length !== 4) return { ok: false, reason: 'malformed' };
  const [accountId, issuedRaw, expiryRaw, macRaw] = parts;
  if (!ACCOUNT_ID_RE.test(accountId)) return { ok: false, reason: 'malformed' };
  const issuedAtMs = Number(issuedRaw);
  const expiresAtMs = Number(expiryRaw);
  if (!Number.isInteger(issuedAtMs) || !Number.isInteger(expiresAtMs)) return { ok: false, reason: 'malformed' };
  if (expiresAtMs <= issuedAtMs) return { ok: false, reason: 'malformed' };
  if (expiresAtMs - issuedAtMs > MAX_ACCOUNT_SESSION_TTL_MS) return { ok: false, reason: 'malformed' };
  const provided = base64UrlToBytes(macRaw);
  if (!provided) return { ok: false, reason: 'malformed' };
  const expected = createHmac('sha256', secret).update(sessionMacInput({ accountId, issuedAtMs, expiresAtMs })).digest();
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return { ok: false, reason: 'bad_signature' };
  }
  if (expiresAtMs <= nowMs) return { ok: false, reason: 'expired' };
  return { ok: true, accountId, issuedAtMs, expiresAtMs };
}

// ---------------------------------------------------------------------------
// Entitlement-rail webhook verification seams (fail-closed / not_configured).
// ---------------------------------------------------------------------------

export interface AccountEntitlementRailConfig {
  /** Apple App Store Server Notifications: root CA for the JWS x5c chain. */
  appleServerNotificationRootCa?: string;
  /** Google Play RTDN: the Pub/Sub push audience the bearer must match. */
  googleRtdnAudience?: string;
  /** Stripe webhook signing secret (whsec_...). */
  stripeWebhookSecret?: string;
}

export type WebhookResult =
  | { ok: true; recorded: boolean }
  | { ok: false; reason: 'not_configured' | 'invalid' };

// ---------------------------------------------------------------------------
// Issuance / renewal / deletion result shapes.
// ---------------------------------------------------------------------------

export type IssueCredentialResult =
  | { ok: true; blindSignatureBase64: string; epoch: number; publicKeySpkiDerBase64: string }
  | { ok: false; reason: 'refused' | 'not_configured' | 'unauthenticated' | 'bad_request' };

export type EpochKeyResult =
  | { ok: true; epoch: number; publicKeySpkiDerBase64: string }
  | { ok: false; reason: 'not_configured' | 'invalid_epoch' };

export type AccountDeletionResult =
  | { ok: true; deletionScope: 'account_layer_only'; revokedSerial: boolean }
  | { ok: false; reason: 'unauthenticated' | 'not_found' };

export interface AccountStatus {
  accountId: string;
  provider: AccountProvider;
  ageStatus: AccountRecord['ageStatus'];
  renewalFlagged: boolean;
  entitlements: { product: EntitlementProduct; rail: EntitlementRail; status: EntitlementStatus; validUntil?: string }[];
}

export interface AccountServiceOptions {
  accountStore: AccountStore;
  bridgeStore: CredentialBridgeStore;
  /** HMAC secret for account session bearers. Empty => sessions fail closed. */
  sessionSecret: string;
  /** SSO verifier (Apple/Google). Fail-closed when a provider is unconfigured. */
  ssoVerifier: SsoTokenVerifier;
  /** AES-256-GCM seal secret for epoch private keys. Empty => issuance not_configured. */
  epochKeySecret: string;
  /** Entitlement-rail webhook verification config. */
  railConfig?: AccountEntitlementRailConfig;
  /**
   * Age policy: when true, a 'store_minor' age status blocks issuance. Default true.
   * (The in-app neutral age gate remains the universal floor regardless.)
   */
  blockMinorIssuance?: boolean;
  /** Session lifetime (ms). Clamped to [60s, MAX_ACCOUNT_SESSION_TTL_MS]. */
  sessionTtlMs?: number;
  now?: () => number;
}

export class AccountService {
  private readonly accountStore: AccountStore;
  private readonly bridgeStore: CredentialBridgeStore;
  private readonly sessionSecret: string;
  private readonly ssoVerifier: SsoTokenVerifier;
  private readonly epochKeySecret: string;
  private readonly railConfig: AccountEntitlementRailConfig;
  private readonly blockMinorIssuance: boolean;
  private readonly sessionTtlMs: number;
  private readonly now: () => number;
  /** Per-account write serialization for the ensure-epoch-key + issuance path. */
  private readonly accountLocks = new Map<string, Promise<unknown>>();
  /** Per-epoch serialization so two concurrent first-mints share one keypair. */
  private readonly epochLocks = new Map<number, Promise<unknown>>();

  constructor(options: AccountServiceOptions) {
    this.accountStore = options.accountStore;
    this.bridgeStore = options.bridgeStore;
    this.sessionSecret = options.sessionSecret;
    this.ssoVerifier = options.ssoVerifier;
    this.epochKeySecret = options.epochKeySecret;
    this.railConfig = options.railConfig ?? {};
    this.blockMinorIssuance = options.blockMinorIssuance ?? true;
    this.sessionTtlMs = Math.min(
      MAX_ACCOUNT_SESSION_TTL_MS,
      Math.max(60_000, options.sessionTtlMs ?? DEFAULT_ACCOUNT_SESSION_TTL_MS),
    );
    this.now = options.now ?? (() => Date.now());
  }

  // -------------------------------------------------------------------------
  // Sign-in: SSO verify -> upsert account -> mint session bearer.
  // -------------------------------------------------------------------------

  async signIn(input: {
    provider: SsoProvider;
    providerToken: string;
  }): Promise<
    | { ok: true; token: string; expiresAtMs: number; accountId: string }
    | { ok: false; reason: 'not_configured' | 'invalid' | 'session_not_configured' | 'account_deleted' }
  > {
    if (!this.sessionSecret) return { ok: false, reason: 'session_not_configured' };
    const verified = await this.ssoVerifier.verify(input.provider, input.providerToken);
    if (!verified.ok) return { ok: false, reason: verified.reason };
    const nowMs = this.now();
    // First successful sign-in records humanVerifiedAt (the store-grade human check
    // IS the sign-in). The store upsert is idempotent on (provider, subject).
    const account = await this.accountStore.upsertAccount({
      provider: verified.provider,
      providerSubject: verified.subject,
      ...(verified.email ? { relayEmail: verified.email } : {}),
      nowMs,
    });
    if (!account) return { ok: false, reason: 'account_deleted' };
    const issuedAtMs = nowMs;
    const expiresAtMs = issuedAtMs + this.sessionTtlMs;
    const token = signAccountSessionToken(this.sessionSecret, { accountId: account.accountId, issuedAtMs, expiresAtMs });
    return { ok: true, token, expiresAtMs, accountId: account.accountId };
  }

  /** Verify an account session bearer (HMAC + not-deleted). */
  async verifySession(token: string): Promise<AccountSessionVerdict> {
    const verdict = verifyAccountSessionToken(token, this.sessionSecret, this.now());
    if (!verdict.ok) return verdict;
    // A deleted account's still-unexpired bearer must not authorize anything.
    const account = await this.accountStore.getAccountById(verdict.accountId);
    if (!account) return { ok: false, reason: 'bad_signature' };
    return verdict;
  }

  async getStatus(token: string): Promise<AccountStatus | null> {
    const verdict = await this.verifySession(token);
    if (!verdict.ok) return null;
    const account = await this.accountStore.getAccountById(verdict.accountId);
    if (!account) return null;
    const entitlements = await this.accountStore.getEntitlements(account.accountId);
    return {
      accountId: account.accountId,
      provider: account.provider,
      // Existing adult rows carry no provider attestation and cannot confer a store pass.
      ageStatus: account.ageStatus === 'store_adult' ? 'unknown' : account.ageStatus,
      renewalFlagged: Boolean(account.renewalFlaggedAt),
      entitlements: entitlements.map((row) => ({
        product: row.product,
        rail: row.rail,
        status: row.status === 'active' && row.validUntil !== undefined && !(Date.parse(row.validUntil) > this.now()) ? 'lapsed' : row.status,
        ...(row.validUntil ? { validUntil: row.validUntil } : {}),
      })),
    };
  }

  // -------------------------------------------------------------------------
  // Store age signal.
  // -------------------------------------------------------------------------

  async recordStoreAgeSignal(input: {
    token: string;
    signal: 'adult' | 'minor';
    source: AccountAgeSource;
  }): Promise<{ ok: false; reason: 'unauthenticated' | 'not_configured' }> {
    const verdict = await this.verifySession(input.token);
    if (!verdict.ok) return { ok: false, reason: 'unauthenticated' };
    // This route has no provider-signed, account-bound age attestation verifier.
    // A session bearer authenticates an account, never its asserted age/source.
    return { ok: false, reason: 'not_configured' };
  }

  // -------------------------------------------------------------------------
  // Entitlement webhooks. Each verifies with its configured secret, then maps a
  // verified event to recordEntitlement. Unconfigured rail => not_configured.
  // -------------------------------------------------------------------------

  /**
   * Apple App Store Server Notifications V2. The signedPayload is a JWS whose x5c
   * chain must verify to Apple's root CA. Full chain verification requires the root
   * CA (MEERKAT_ASSN_ROOT_CA); absent it, this is a documented fail-closed
   * not_configured refusal -- it NEVER fabricates a verified entitlement (AC-6).
   */
  async appleServerNotification(input: {
    rawBody: string;
    resolve: (signedPayload: string, rootCa: string) => AppleNotificationVerification | null;
  }): Promise<WebhookResult> {
    const rootCa = this.railConfig.appleServerNotificationRootCa;
    if (!rootCa) return { ok: false, reason: 'not_configured' };
    let parsed: { signedPayload?: unknown };
    try {
      parsed = JSON.parse(input.rawBody) as { signedPayload?: unknown };
    } catch {
      return { ok: false, reason: 'invalid' };
    }
    if (typeof parsed.signedPayload !== 'string') return { ok: false, reason: 'invalid' };
    const verification = input.resolve(parsed.signedPayload, rootCa);
    if (!verification) return { ok: false, reason: 'invalid' };
    return this.applyRailEvent('apple', verification);
  }

  /**
   * Google Play Real-time Developer Notifications. The Pub/Sub push bearer audience
   * must match MEERKAT_PLAY_RTDN_AUDIENCE. Unconfigured => not_configured.
   */
  async googleRtdn(input: {
    rawBody: string;
    bearerAudience: string | null;
    resolve: (rawBody: string) => GoogleRtdnVerification | null;
  }): Promise<WebhookResult> {
    const audience = this.railConfig.googleRtdnAudience;
    if (!audience) return { ok: false, reason: 'not_configured' };
    if (!input.bearerAudience || !constantTimeStringEquals(input.bearerAudience, audience)) {
      return { ok: false, reason: 'invalid' };
    }
    const verification = input.resolve(input.rawBody);
    if (!verification) return { ok: false, reason: 'invalid' };
    return this.applyRailEvent('google', verification);
  }

  /**
   * Stripe webhook. The signature header is verified per Stripe's signing scheme
   * (HMAC-SHA256 over `${timestamp}.${rawBody}` under MEERKAT_STRIPE_WEBHOOK_SECRET).
   * Unconfigured => not_configured.
   */
  async stripeWebhook(input: {
    rawBody: string;
    signatureHeader: string | null;
    resolve: (rawBody: string) => StripeWebhookVerification | null;
    toleranceMs?: number;
  }): Promise<WebhookResult> {
    const secret = this.railConfig.stripeWebhookSecret;
    if (!secret) return { ok: false, reason: 'not_configured' };
    if (!verifyStripeSignature(input.rawBody, input.signatureHeader, secret, this.now(), input.toleranceMs ?? 5 * 60 * 1000)) {
      return { ok: false, reason: 'invalid' };
    }
    const verification = input.resolve(input.rawBody);
    if (!verification) return { ok: false, reason: 'invalid' };
    return this.applyRailEvent('stripe', verification);
  }

  private async applyRailEvent(rail: EntitlementRail, event: RailEntitlementEvent): Promise<WebhookResult> {
    const account = await this.accountStore.getAccountByProviderSubject(event.provider, event.providerSubject);
    if (!account) {
      // No account backs this subject yet (webhook arrived before sign-in). The
      // event is authentic but there is nothing to bind it to; report honestly.
      return { ok: true, recorded: false };
    }
    await this.accountStore.recordEntitlement({
      accountId: account.accountId,
      product: event.product,
      rail,
      status: event.status,
      ...(event.validUntil ? { validUntil: event.validUntil } : {}),
      nowMs: this.now(),
    });
    return { ok: true, recorded: true };
  }

  // -------------------------------------------------------------------------
  // Public epoch-key discovery. A client needs the epoch public key BEFORE blinding
  // its first token of an epoch, and the first mint of an epoch has no prior response
  // to learn it from. This is unauthenticated by design: the key is public (verifier
  // surfaces read the identical value from credential.epoch_keys), so exposing it here
  // reveals nothing an epoch-scoped presentation would not. Only the current epoch, or
  // (during the renewal window) the next epoch, are answerable, so this is never a key
  // oracle for arbitrary epochs. It ensures the key lazily -- generate + seal + publish,
  // exactly like the issue path -- so the very first client of an epoch can still learn
  // its key.
  // -------------------------------------------------------------------------

  async getEpochKey(requestedEpoch?: number): Promise<EpochKeyResult> {
    if (!this.epochKeySecret) return { ok: false, reason: 'not_configured' };
    const nowMs = this.now();
    const currentEpoch = credentialEpochAt(nowMs);
    // A missing/malformed epoch defaults to the current epoch (the common case).
    const epoch = Number.isInteger(requestedEpoch) ? (requestedEpoch as number) : currentEpoch;
    const nextIssuable = isWithinRenewalWindow(nowMs) ? currentEpoch + 1 : currentEpoch;
    if (epoch !== currentEpoch && epoch !== nextIssuable) {
      return { ok: false, reason: 'invalid_epoch' };
    }
    const key = await this.ensureEpochKey(epoch);
    if (!key) return { ok: false, reason: 'not_configured' };
    return { ok: true, epoch, publicKeySpkiDerBase64: key.publicKeySpkiDerBase64 };
  }

  // -------------------------------------------------------------------------
  // Issuance (blind). Quota FIRST, uniform refusal, then ensure epoch key + sign.
  // -------------------------------------------------------------------------

  async issueCredential(input: {
    token: string;
    blindedMessageBase64: string;
    epoch: number;
  }): Promise<IssueCredentialResult> {
    if (!this.epochKeySecret) return { ok: false, reason: 'not_configured' };
    const verdict = await this.verifySession(input.token);
    if (!verdict.ok) return { ok: false, reason: 'unauthenticated' };
    if (!Number.isInteger(input.epoch) || input.epoch < 0) return { ok: false, reason: 'bad_request' };
    if (!isWellFormedBlindedMessage(input.blindedMessageBase64)) {
      return { ok: false, reason: 'bad_request' };
    }

    const nowMs = this.now();
    const currentEpoch = credentialEpochAt(nowMs);
    // Only the current epoch, or (during the renewal window) the next epoch, are issuable.
    const nextIssuable = isWithinRenewalWindow(nowMs) ? currentEpoch + 1 : currentEpoch;
    if (input.epoch !== currentEpoch && input.epoch !== nextIssuable) {
      return { ok: false, reason: 'bad_request' };
    }

    return this.withAccountLock(verdict.accountId, () => this.issueLocked(verdict.accountId, input.epoch, input.blindedMessageBase64, nowMs, null));
  }

  /** Recover an already authorized signature after session rotation; never allocate a pass. */
  async recoverCredential(input: {
    token: string;
    blindedMessageBase64: string;
    epoch: number;
  }): Promise<IssueCredentialResult> {
    if (!this.epochKeySecret) return { ok: false, reason: 'not_configured' };
    const verdict = await this.verifySession(input.token);
    if (!verdict.ok) return { ok: false, reason: 'unauthenticated' };
    if (!Number.isInteger(input.epoch) || !isWellFormedBlindedMessage(input.blindedMessageBase64)) {
      return { ok: false, reason: 'bad_request' };
    }
    const nowMs = this.now();
    const currentEpoch = credentialEpochAt(nowMs);
    if (input.epoch !== currentEpoch
      && !(isWithinRenewalWindow(nowMs) && input.epoch === currentEpoch + 1)) {
      return { ok: false, reason: 'bad_request' };
    }
    // Target == predecessor cannot satisfy the store's strict epoch-advance rule.
    // Only its atomic exact-request replay branch can succeed, on this account.
    return this.withAccountLock(verdict.accountId, () => this.issueLocked(
      verdict.accountId, input.epoch, input.blindedMessageBase64, nowMs, input.epoch,
    ));
  }

  /**
   * The entitlement + quota + sign core, serialized per account. Every refusal path
   * performs the SAME store reads (account fetch + entitlement fetch) and inserts the
   * quota row FIRST, so no refusal is timing-distinguishable and no signing work
   * betrays the outcome (AC-1 quota side channel).
   */
  private async issueLocked(
    accountId: string,
    epoch: number,
    blindedMessageBase64: string,
    nowMs: number,
    expectedPreviousEpoch: number | null,
  ): Promise<IssueCredentialResult> {
    const account = await this.accountStore.getAccountById(accountId);
    const entitlements = account ? await this.accountStore.getEntitlements(accountId) : [];
    // Eligibility BEFORE the quota insert: an ineligible probe (unentitled, minor
    // blocked, flagged) must not consume the epoch slot, or an account that becomes
    // entitled later in the epoch could never mint. The response shape is uniform
    // ('refused') across every path, and the only party positioned to time the
    // read-vs-insert difference is the session holder, to whom the distinction is
    // already known. The quota insert itself stays atomic (NC-1: two concurrent
    // eligible issues resolve to exactly one 'recorded').
    if (!canIssueCredential(account, entitlements, this.now(), this.blockMinorIssuance)) {
      return { ok: false, reason: 'refused' };
    }

    // Epoch key + numeric range check BEFORE the quota insert: a blinded message
    // that decodes to modulus length but a value >= the epoch modulus would make
    // the raw RSA primitive throw ("data too large for modulus"), and a key that
    // cannot be ensured is a server-config failure. Neither may burn the account's
    // one-per-epoch slot. Both checks are content-determined for the session
    // holder (who already knows their own request), so no eligibility side channel
    // opens. Length was shape-validated in issueCredential.
    const key = await this.ensureEpochKey(epoch);
    if (!key) return { ok: false, reason: 'not_configured' };
    const epochKey = parseRsaPublicKeySpki(key.publicKeySpkiDerBase64);
    if (!epochKey) return { ok: false, reason: 'not_configured' };
    const blindedBytes = credentialBase64ToBytes(blindedMessageBase64);
    if (!blindedBytes) return { ok: false, reason: 'bad_request' };
    let blindedValue = 0n;
    for (const byte of blindedBytes) blindedValue = (blindedValue << 8n) | BigInt(byte);
    if (blindedValue >= epochKey.n) return { ok: false, reason: 'bad_request' };

    const requestHash = createHash('sha256').update(blindedBytes).digest('hex');
    const quota = await this.accountStore.recordIssuance(accountId, epoch, nowMs, expectedPreviousEpoch, requestHash, {
      blockMinorIssuance: this.blockMinorIssuance, now: this.now,
    });
    if (quota === 'already_issued') {
      return { ok: false, reason: 'refused' };
    }

    // The blinded message was shape- AND range-validated above, so this cannot
    // throw for client-shaped input; any residual failure is a server defect and
    // must not masquerade as a client error.
    const blindSignatureBase64 = blindSignCredential(key.privateKeyPkcs8DerBase64, blindedMessageBase64);
    return { ok: true, blindSignatureBase64, epoch, publicKeySpkiDerBase64: key.publicKeySpkiDerBase64 };
  }

  /**
   * Get or create the epoch's signing keypair. Generates once (sealed under the env
   * secret, stored in account.epoch_signing_keys), publishes the public half to the
   * anonymous bridge, and returns both halves. Serialized per epoch so two first
   * mints in the same epoch share one keypair.
   */
  private async ensureEpochKey(
    epoch: number,
  ): Promise<{ privateKeyPkcs8DerBase64: string; publicKeySpkiDerBase64: string } | null> {
    return this.withEpochLock(epoch, async () => {
      let sealed = await this.accountStore.getSealedEpochKey(epoch);
      if (!sealed) {
        const candidate = generateEpochKeyPair(epoch);
        await this.accountStore.putSealedEpochKey(epoch, sealEpochPrivateKey(this.epochKeySecret, candidate.privateKeyPkcs8DerBase64));
        // Another worker may win the insert. Never publish or sign with the local loser.
        sealed = await this.accountStore.getSealedEpochKey(epoch);
      }
      if (!sealed) return null;
      const privateKeyPkcs8DerBase64 = unsealEpochPrivateKey(this.epochKeySecret, sealed);
      if (!privateKeyPkcs8DerBase64) return null;
      const publicKeySpkiDerBase64 = deriveEpochPublicKey(privateKeyPkcs8DerBase64);
      if (!publicKeySpkiDerBase64) return null;
      const published = await this.bridgeStore.getEpochPublicKey(epoch);
      if (published !== null && published !== publicKeySpkiDerBase64) return null;
      if (published === null) {
        // Complete publication after a crash without replacing the saved signing key.
        const window = credentialEpochWindow(epoch);
        await this.bridgeStore.publishEpochKey(epoch, publicKeySpkiDerBase64, window.notBeforeMs, window.notAfterMs);
        if (await this.bridgeStore.getEpochPublicKey(epoch) !== publicKeySpkiDerBase64) return null;
      }
      return { privateKeyPkcs8DerBase64, publicKeySpkiDerBase64 };
    });
  }

  // -------------------------------------------------------------------------
  // Renewal. Only in the renewal window. Verify the expiring credential; a revoked
  // serial flags the account and refuses; a clean serial mints the next epoch. The
  // serial is NEVER persisted or logged for a clean account (AC-2/AC-3).
  // -------------------------------------------------------------------------

  async renewCredential(input: {
    token: string;
    expiringCredentialBearer: string;
    blindedMessageBase64: string;
  }): Promise<IssueCredentialResult> {
    if (!this.epochKeySecret) return { ok: false, reason: 'not_configured' };
    const verdict = await this.verifySession(input.token);
    if (!verdict.ok) return { ok: false, reason: 'unauthenticated' };
    const nowMs = this.now();
    if (!isWithinRenewalWindow(nowMs)) return { ok: false, reason: 'bad_request' };

    // Verify the expiring credential against the anonymous bridge. The verifier
    // computes the serial locally; we use ONLY its revoked/ok verdict, never storing
    // or logging the serial for a clean account.
    const verifier = createCredentialVerifier({
      getEpochPublicKey: (epoch) => this.bridgeStore.getEpochPublicKey(epoch),
      isSerialRevoked: (serial) => this.bridgeStore.isSerialRevoked(serial),
      now: () => nowMs,
    });
    const presentation = await verifier.verifyPresentation(input.expiringCredentialBearer);
    if (!presentation.ok) {
      if (presentation.reason === 'revoked') {
        // A revoked serial at renewal flags the account and refuses all future
        // renewals. The serial itself is discarded here; only the boolean outcome
        // influences account state (AC-3).
        await this.accountStore.flagRenewal(verdict.accountId, 'revoked_serial_presented', nowMs);
      }
      return { ok: false, reason: 'refused' };
    }

    // Clean serial: mint the NEXT epoch through the same quota + entitlement path.
    const nextEpoch = credentialEpochAt(nowMs) + 1;
    if (!isWellFormedBlindedMessage(input.blindedMessageBase64)) {
      return { ok: false, reason: 'bad_request' };
    }
    return this.withAccountLock(verdict.accountId, () => this.issueLocked(verdict.accountId, nextEpoch, input.blindedMessageBase64, nowMs, presentation.epoch));
  }

  // -------------------------------------------------------------------------
  // Deletion (P5). Re-verify the SSO token against the account; optionally burn a
  // account only; unproven public bearers cannot authorize revocation. Honest scope copy.
  // -------------------------------------------------------------------------

  async deleteAccount(input: {
    provider: SsoProvider;
    providerToken: string;
    /** Legacy input, ignored: an account session does not prove ownership of a public bearer. */
    clientCredentialBearer?: string;
  }): Promise<AccountDeletionResult> {
    const verified = await this.ssoVerifier.verify(input.provider, input.providerToken);
    if (!verified.ok) return { ok: false, reason: 'unauthenticated' };
    const account = await this.accountStore.getAccountByProviderSubject(verified.provider, verified.subject);
    if (!account) return { ok: false, reason: 'not_found' };

    // A valid public bearer is not proof that this account owns it. Until renewal
    // binding also establishes deletion ownership, this route must not revoke it.
    const revokedSerial = false;

    // The tombstone must outlive the HIGHEST epoch this account could have already
    // minted for, not just the current one. Issuance permits currentEpoch + 1 during
    // the renewal window (see canIssueEpoch / renewCredential), so a pre-minted next-
    // epoch credential would otherwise outlive its own tombstone and let the same SSO
    // subject hold two valid credentials for one epoch after a delete-and-recreate.
    const nowMs = this.now();
    const highestClaimableEpoch = isWithinRenewalWindow(nowMs)
      ? credentialEpochAt(nowMs) + 1
      : credentialEpochAt(nowMs);
    const recreateAfterMs = credentialEpochWindow(highestClaimableEpoch).notAfterMs;
    await this.accountStore.deleteAccount({
      accountId: account.accountId,
      provider: account.provider,
      providerSubject: account.providerSubject,
      recreateAfterMs,
    });
    return { ok: true, deletionScope: 'account_layer_only', revokedSerial };
  }

  async stats(): Promise<{ accounts: number; entitlements: number; issuances: number; epochKeys: number; revocations: number }> {
    const account = await this.accountStore.stats();
    const bridge = await this.bridgeStore.stats();
    return { ...account, epochKeys: bridge.epochKeys, revocations: bridge.revocations };
  }

  // -------------------------------------------------------------------------
  // Serialization helpers.
  // -------------------------------------------------------------------------

  private withAccountLock<T>(accountId: string, fn: () => Promise<T>): Promise<T> {
    return serialize(this.accountLocks, accountId, fn);
  }

  private withEpochLock<T>(epoch: number, fn: () => Promise<T>): Promise<T> {
    return serialize(this.epochLocks, epoch, fn);
  }
}

function serialize<K, T>(locks: Map<K, Promise<unknown>>, key: K, fn: () => Promise<T>): Promise<T> {
  const prior = locks.get(key) ?? Promise.resolve();
  const run = prior.then(fn, fn);
  const tail = run.then(() => undefined, () => undefined);
  locks.set(key, tail);
  void tail.then(() => {
    if (locks.get(key) === tail) locks.delete(key);
  });
  return run;
}

// ---------------------------------------------------------------------------
// Rail event shapes (the resolve seams produce these; the service applies them).
// ---------------------------------------------------------------------------

export interface RailEntitlementEvent {
  provider: AccountProvider;
  providerSubject: string;
  product: EntitlementProduct;
  status: EntitlementStatus;
  validUntil?: string;
}

export type AppleNotificationVerification = RailEntitlementEvent;
export type GoogleRtdnVerification = RailEntitlementEvent;
export type StripeWebhookVerification = RailEntitlementEvent;

// ---------------------------------------------------------------------------
// Stripe signature verification (its published signing scheme; no new dep).
// ---------------------------------------------------------------------------

function constantTimeStringEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Verify a Stripe `Stripe-Signature` header: `t=<ts>,v1=<hex>`. The signed payload
 * is `${t}.${rawBody}`, HMAC-SHA256 under the webhook secret. Rejects a stale
 * timestamp (replay) outside the tolerance window. Any defect => false.
 */
export function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  nowMs: number,
  toleranceMs: number,
): boolean {
  if (!signatureHeader) return false;
  let timestamp: string | null = null;
  const signatures: string[] = [];
  for (const part of signatureHeader.split(',')) {
    const [rawKey, rawValue] = part.split('=', 2);
    const key = rawKey?.trim();
    const value = rawValue?.trim();
    if (!key || !value) continue;
    if (key === 't') timestamp = value;
    else if (key === 'v1') signatures.push(value);
  }
  if (!timestamp || signatures.length === 0) return false;
  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) return false;
  if (Math.abs(nowMs - timestampSeconds * 1000) > toleranceMs) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  return signatures.some((candidate) => candidate.length === expected.length && constantTimeStringEquals(candidate, expected));
}
