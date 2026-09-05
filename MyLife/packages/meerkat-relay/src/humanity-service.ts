/**
 * Deployable HUMANITY VERIFICATION SERVICE (Plan 24, P1) -- a FOURTH deployable image
 * alongside the slim relay (server.ts), the community node (community-node.ts), and the
 * public directory node (public-directory-node.ts).
 *
 * It is the anonymous anti-bot issuer for the shared network. It runs a three-verb HTTP
 * surface:
 *   POST /humanity/challenge -> mint a one-time nonce for a chosen verifier kind.
 *   POST /humanity/issue     -> verify the device's attestation for that challenge and,
 *                               on success, sign a wallet BATCH of single-use tokens.
 *   POST /humanity/redeem    -> verify a token's signature + expiry, reject a replay, and
 *                               record its spend (the double-spend gate the community node
 *                               calls, AC-2).
 * Plus GET /healthz for liveness (bounded counts only, never content).
 *
 * PRIVACY (binding, NC-1/NC-2). The service stores ONLY:
 *   - sha256(tokenId) for spent tokens (with a TTL so the set stays bounded),
 *   - opaque sha256 registration attempt/request digests for successful replay receipts,
 *   - sha256(attestationKeyId) -> a per-day issuance count (the abuse cap, AC-5).
 * It stores NO name, email, phone, device-identity key, or raw attestation. A token is
 * NEVER bound to the Meerkat device key. The client never sends its device public key
 * during issuance. The attestation key id (the per-device abuse anchor) is HASHED before
 * it touches storage, so the durable store holds only opaque hashes + counters.
 *
 * FAIL-CLOSED (binding). An unknown/expired challenge, a verifier rejection, an over-cap
 * attestation key, an over-window IP, a bad token, or a replayed token all REFUSE. No
 * verifier may fabricate a pass. A STUB verifier (isProductionSafe=false) is REJECTED at
 * construction when productionMode is set, mirroring how Simulated* transport backends are
 * excluded from live rungs.
 *
 * NO NEW CRYPTO. Token signing/verifying is Ed25519 via @mylife/sync's tweetnacl wrappers
 * (the humanity-credential protocol). The only hash here is SHA-256 for the opaque store
 * keys, from node:crypto (a standard hash, not a hand-rolled primitive).
 */

import { createHash, randomBytes as nodeRandomBytes } from 'node:crypto';
import {
  humanityServiceKeypairFromSeed,
  issueHumanityTokenBatch,
  parseHumanityToken,
  verifyHumanityToken,
  HUMANITY_BATCH_SIZE,
  HUMANITY_TOKEN_TTL_MS,
  type HumanityToken,
} from '@mylife/sync';

// ---------------------------------------------------------------------------
// Verifier contract (P2 adapters implement this; P1 tests inject fakes).
// ---------------------------------------------------------------------------

export type HumanityChallengeKind = 'app-attest' | 'play-integrity' | 'turnstile';

export const HUMANITY_CHALLENGE_KINDS: readonly HumanityChallengeKind[] = [
  'app-attest',
  'play-integrity',
  'turnstile',
];

/** The one-time challenge a verifier binds its attestation to. */
export interface HumanityChallengeContext {
  challengeId: string;
  kind: HumanityChallengeKind;
  /** Random nonce the client feeds into the platform attestation (hex). */
  nonce: string;
  issuedAt: string;
}

export type HumanityVerifierResult =
  | {
      ok: true;
      /**
       * A STABLE per-device identifier the issuance cap rate-limits on (e.g. the App
       * Attest key id, the Play Integrity device hash, or a Turnstile-derived bucket).
       * It is HASHED by the service before storage; the raw value is never persisted.
       */
      attestationKeyId: string;
    }
  | { ok: false; reason: string };

export interface HumanityVerifyInput {
  challenge: HumanityChallengeContext;
  /** The opaque attestation payload the client returned (verifier-specific shape). */
  attestation: unknown;
}

export interface HumanityVerifier {
  readonly kind: HumanityChallengeKind;
  /**
   * TRUE only for a real, production-safe verifier. A stub/dev verifier sets this false
   * and is refused at construction when the service runs in productionMode.
   */
  readonly isProductionSafe: boolean;
  verify(input: HumanityVerifyInput): Promise<HumanityVerifierResult>;
}

// ---------------------------------------------------------------------------
// Store (spent hashes + issuance counts + pending challenges).
// ---------------------------------------------------------------------------

export interface StoredChallenge {
  kind: HumanityChallengeKind;
  nonce: string;
  issuedAt: string;
  expiresAtMs: number;
}

/** Result of atomically consuming a one-time humanity challenge. */
export interface ConsumedHumanityChallenge {
  challenge: StoredChallenge;
  /**
   * Whether the challenge was expired at the store's authoritative clock. File and
   * memory stores use the supplied clock; PostgreSQL uses database time.
   */
  expired: boolean;
}

/** Atomic input for a replayable persona-registration token redemption. */
export interface HumanityRegistrationRedemptionInput {
  /** Deterministic digest of the signed persona registration claim. */
  attemptId: string;
  /** Digest binding this attempt to this exact humanity token id. */
  requestDigest: string;
  /** sha256(tokenId), never the raw token id. */
  tokenHash: string;
  expiresAtMs: number;
  /** False for an expired token: an existing success may replay, but no new spend may occur. */
  allowCreate: boolean;
}

export type HumanityRegistrationRedemptionOutcome =
  | 'spent'
  | 'replayed'
  | 'already_spent'
  | 'attempt_conflict'
  | 'not_recorded';

/**
 * The durable store. The security-critical property is SPENT-token durability: a restart
 * must not forget spent tokens (that would re-open double-spend, AC-2). Challenges are
 * short-TTL and may live in memory only (losing one just forces a re-challenge).
 */
export interface HumanityStore {
  putChallenge(id: string, record: StoredChallenge): void | Promise<void>;
  getChallenge(id: string): StoredChallenge | null | Promise<StoredChallenge | null>;
  deleteChallenge(id: string): void | Promise<void>;
  /**
   * Atomically delete and return a challenge. Exactly one concurrent caller may
   * receive it. `nowMs` is used by local stores; managed stores may classify expiry
   * with their own authoritative clock.
   */
  consumeChallenge(
    id: string,
    nowMs: number,
  ): ConsumedHumanityChallenge | null | Promise<ConsumedHumanityChallenge | null>;
  /**
   * ATOMICALLY spend a token hash: record it as spent iff it was not already, and
   * return true iff THIS call was the one that recorded it (i.e. the token had not
   * been spent). SECURITY-CRITICAL (AC-2): this is the double-spend gate, and it MUST
   * be atomic. A check-then-set (isSpent then markSpent) has a TOCTOU race that lets
   * two concurrent redeems of the same token both pass; every implementation resolves
   * the winner with a single atomic primitive (a Map has-then-set with no intervening
   * await in memory; an O_EXCL exclusive-create on the filesystem; a UNIQUE-key insert
   * in a SQL store). A durable implementation must ALSO survive a restart: a spent
   * token stays spent, or double-spend re-opens.
   */
  trySpend(tokenHash: string, expiresAtMs: number): boolean | Promise<boolean>;
  /**
   * Atomically records both the token spend and its replayable registration result. The same
   * attempt, request digest, and token hash replays success. Reusing either uniqueness key for
   * a different request never spends another token and returns a typed conflict.
   */
  redeemRegistrationAttempt(
    input: HumanityRegistrationRedemptionInput,
  ): HumanityRegistrationRedemptionOutcome | Promise<HumanityRegistrationRedemptionOutcome>;
  isSpent(tokenHash: string): boolean | Promise<boolean>;
  markSpent(tokenHash: string, expiresAtMs: number): void | Promise<void>;
  getIssuanceCount(keyHash: string, dayBucket: number): number | Promise<number>;
  incrementIssuanceCount(keyHash: string, dayBucket: number): void | Promise<void>;
  /**
   * Atomically increment a daily issuance counter only while it is below
   * `maximum`. Returns true iff this call consumed one allowance.
   */
  tryIncrementIssuanceCount(
    keyHash: string,
    dayBucket: number,
    maximum: number,
  ): boolean | Promise<boolean>;
  prune(nowMs: number): void | Promise<void>;
  stats(): { spent: number; issuanceKeys: number; challenges: number } | Promise<{ spent: number; issuanceKeys: number; challenges: number }>;
}

/** In-memory store: the default for tests + ephemeral nodes. */
export class InMemoryHumanityStore implements HumanityStore {
  private readonly challenges = new Map<string, StoredChallenge>();
  private readonly spent = new Map<string, number>(); // tokenHash -> expiresAtMs
  private readonly issuance = new Map<string, number>(); // `${keyHash}:${dayBucket}` -> count
  private readonly registrationRedemptions = new Map<string, {
    requestDigest: string;
    tokenHash: string;
  }>();

  putChallenge(id: string, record: StoredChallenge): void {
    this.challenges.set(id, record);
  }
  getChallenge(id: string): StoredChallenge | null {
    return this.challenges.get(id) ?? null;
  }
  deleteChallenge(id: string): void {
    this.challenges.delete(id);
  }
  consumeChallenge(id: string, nowMs: number): ConsumedHumanityChallenge | null {
    const challenge = this.challenges.get(id);
    if (!challenge) return null;
    // No await may be introduced between the read and delete. JavaScript's
    // run-to-completion semantics make this one atomic winner in memory.
    this.challenges.delete(id);
    return { challenge, expired: challenge.expiresAtMs <= nowMs };
  }
  trySpend(tokenHash: string, expiresAtMs: number): boolean {
    // Atomic in memory: has-then-set with NO await between the check and the write,
    // so two concurrent redeems can never both see the token unspent (single-threaded
    // event loop). The first caller records it and wins; every later caller sees it.
    if (this.spent.has(tokenHash)) return false;
    this.spent.set(tokenHash, expiresAtMs);
    return true;
  }
  redeemRegistrationAttempt(
    input: HumanityRegistrationRedemptionInput,
  ): HumanityRegistrationRedemptionOutcome {
    const existing = this.registrationRedemptions.get(input.attemptId);
    if (existing) {
      return existing.requestDigest === input.requestDigest && existing.tokenHash === input.tokenHash
        ? 'replayed'
        : 'attempt_conflict';
    }
    if (!input.allowCreate) return 'not_recorded';
    if (this.spent.has(input.tokenHash)) return 'already_spent';
    // Both maps change synchronously with no intervening await, which is the in-memory atomic
    // boundary corresponding to the filesystem ledger write and PostgreSQL transaction.
    this.spent.set(input.tokenHash, input.expiresAtMs);
    this.registrationRedemptions.set(input.attemptId, {
      requestDigest: input.requestDigest,
      tokenHash: input.tokenHash,
    });
    return 'spent';
  }
  isSpent(tokenHash: string): boolean {
    return this.spent.has(tokenHash);
  }
  markSpent(tokenHash: string, expiresAtMs: number): void {
    this.spent.set(tokenHash, expiresAtMs);
  }
  getIssuanceCount(keyHash: string, dayBucket: number): number {
    return this.issuance.get(`${keyHash}:${dayBucket}`) ?? 0;
  }
  incrementIssuanceCount(keyHash: string, dayBucket: number): void {
    const key = `${keyHash}:${dayBucket}`;
    this.issuance.set(key, (this.issuance.get(key) ?? 0) + 1);
  }
  tryIncrementIssuanceCount(keyHash: string, dayBucket: number, maximum: number): boolean {
    if (!Number.isSafeInteger(maximum) || maximum <= 0) {
      throw new RangeError('Humanity issuance maximum must be a positive safe integer.');
    }
    const key = `${keyHash}:${dayBucket}`;
    const current = this.issuance.get(key) ?? 0;
    if (current >= maximum) return false;
    // Check and increment remain synchronous, so concurrent callers cannot both
    // consume the final allowance.
    this.issuance.set(key, current + 1);
    return true;
  }
  prune(nowMs: number): void {
    for (const [id, c] of this.challenges) if (c.expiresAtMs <= nowMs) this.challenges.delete(id);
    for (const [hash, exp] of this.spent) if (exp <= nowMs) this.spent.delete(hash);
    // Issuance day buckets older than 2 days can never gate a fresh day; drop them.
    const cutoff = Math.floor(nowMs / DAY_MS) - 1;
    for (const key of this.issuance.keys()) {
      const bucket = Number(key.slice(key.lastIndexOf(':') + 1));
      if (Number.isFinite(bucket) && bucket < cutoff) this.issuance.delete(key);
    }
  }
  stats(): { spent: number; issuanceKeys: number; challenges: number } {
    return { spent: this.spent.size, issuanceKeys: this.issuance.size, challenges: this.challenges.size };
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Limits (env-tunable via the resolveRelayLimits pattern; see resolveHumanityLimits).
// ---------------------------------------------------------------------------

export interface HumanityServiceLimits {
  /** Tokens minted per successful verification (the wallet batch). */
  batchSize: number;
  /** Token lifetime in ms (also the spent-hash retention window). */
  tokenTtlMs: number;
  /** Pending-challenge lifetime in ms. */
  challengeTtlMs: number;
  /** Max issuance batches per attestation key per UTC day (AC-5). */
  maxBatchesPerKeyPerDay: number;
  /** Max issuance attempts per client IP per window (AC-5). */
  maxIssuePerIpPerWindow: number;
  /** The IP window in ms. */
  ipWindowMs: number;
}

export const DEFAULT_HUMANITY_LIMITS: HumanityServiceLimits = {
  batchSize: HUMANITY_BATCH_SIZE,
  tokenTtlMs: HUMANITY_TOKEN_TTL_MS,
  challengeTtlMs: 5 * 60 * 1000,
  maxBatchesPerKeyPerDay: 3,
  maxIssuePerIpPerWindow: 30,
  ipWindowMs: 60 * 60 * 1000,
};

interface HumanityLimitEnvSpec {
  env: string;
  key: keyof HumanityServiceLimits;
  min: number;
  max: number;
}

const HUMANITY_LIMIT_ENV: readonly HumanityLimitEnvSpec[] = [
  { env: 'HUMANITY_BATCH_SIZE', key: 'batchSize', min: 1, max: 256 },
  { env: 'HUMANITY_TOKEN_TTL_MS', key: 'tokenTtlMs', min: 60_000, max: 400 * DAY_MS },
  { env: 'HUMANITY_CHALLENGE_TTL_MS', key: 'challengeTtlMs', min: 10_000, max: 3_600_000 },
  { env: 'HUMANITY_MAX_BATCHES_PER_KEY_PER_DAY', key: 'maxBatchesPerKeyPerDay', min: 1, max: 100 },
  { env: 'HUMANITY_MAX_ISSUE_PER_IP_PER_WINDOW', key: 'maxIssuePerIpPerWindow', min: 1, max: 10_000 },
  { env: 'HUMANITY_IP_WINDOW_MS', key: 'ipWindowMs', min: 1_000, max: 24 * 60 * 60 * 1000 },
];

/**
 * Resolve effective limits from env, clamped to safe [min,max]. Pure: never mutates the
 * default. An unset/empty/non-integer env value falls back to the default (mirrors
 * resolveRelayLimits).
 */
export function resolveHumanityLimits(
  env: Record<string, string | undefined> = {},
): HumanityServiceLimits {
  const limits: { -readonly [K in keyof HumanityServiceLimits]: number } = { ...DEFAULT_HUMANITY_LIMITS };
  for (const spec of HUMANITY_LIMIT_ENV) {
    const raw = env[spec.env];
    if (raw == null || raw.trim() === '') continue;
    const n = Number(raw);
    if (!Number.isInteger(n)) continue;
    limits[spec.key] = Math.min(spec.max, Math.max(spec.min, n));
  }
  return limits;
}

// ---------------------------------------------------------------------------
// Service core.
// ---------------------------------------------------------------------------

export interface HumanityServiceKeypair {
  publicKeyHex: string;
  privateKeyHex: string;
}

export interface HumanityServiceOptions {
  /** The service signing keypair (from humanityServiceKeypairFromSeed). */
  signingKeypair: HumanityServiceKeypair;
  /** Real verifier adapters, one per supported kind. */
  verifiers: HumanityVerifier[];
  /** Durable store. Default in-memory. */
  store?: HumanityStore;
  /** Cap overrides. */
  limits?: Partial<HumanityServiceLimits>;
  /** Injected clock (ms). */
  now?: () => number;
  /** Injected PRNG for challenge ids, nonces, and token ids. Default node:crypto. */
  randomBytes?: (length: number) => Uint8Array;
  /**
   * When true, a verifier with isProductionSafe=false is REFUSED at construction. The
   * deploy sets this; tests leave it false so they can inject fakes.
   */
  productionMode?: boolean;
}

export type ChallengeResult =
  | { ok: true; challengeId: string; kind: HumanityChallengeKind; nonce: string }
  | { ok: false; reason: 'unsupported_kind' };

export type IssueResult =
  | { ok: true; tokens: HumanityToken[] }
  | { ok: false; reason: 'unknown_challenge' | 'challenge_expired' | 'verification_failed' | 'key_cap_exceeded' | 'ip_rate_limited' };

export type RedeemResult =
  | { ok: true }
  | { ok: false; reason: 'invalid' | 'expired' | 'already_spent' };

export interface RedeemRegistrationInput {
  token: string;
  attemptId: string;
  requestDigest: string;
}

export type RedeemRegistrationResult =
  | { ok: true; replayed: boolean }
  | {
      ok: false;
      reason:
        | 'invalid'
        | 'expired'
        | 'already_spent'
        | 'attempt_conflict'
        | 'request_digest_mismatch';
    };

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

const REGISTRATION_DIGEST_RE = /^[0-9a-f]{64}$/;
const HUMANITY_REGISTRATION_REDEMPTION_DOMAIN = 'mylife:humanity:registration-redeem:v1';

/** Deterministically binds one persona registration attempt to one humanity token id. */
export function humanityRegistrationRedemptionDigest(
  attemptId: string,
  tokenId: string,
): string {
  if (!REGISTRATION_DIGEST_RE.test(attemptId) || typeof tokenId !== 'string' || tokenId.length === 0) {
    throw new TypeError('Humanity registration redemption digest input is invalid.');
  }
  return sha256Hex(
    `${HUMANITY_REGISTRATION_REDEMPTION_DOMAIN}\0${attemptId}\0${sha256Hex(tokenId)}`,
  );
}

export class HumanityService {
  private readonly keypair: HumanityServiceKeypair;
  private readonly verifiers = new Map<HumanityChallengeKind, HumanityVerifier>();
  private readonly store: HumanityStore;
  private readonly limits: HumanityServiceLimits;
  private readonly now: () => number;
  private readonly randomBytes: (length: number) => Uint8Array;
  /** ipHash -> [windowStartMs, count] (in-memory only; never persisted). */
  private readonly ipWindows = new Map<string, { windowStartMs: number; count: number }>();

  constructor(options: HumanityServiceOptions) {
    this.keypair = options.signingKeypair;
    this.store = options.store ?? new InMemoryHumanityStore();
    this.limits = { ...DEFAULT_HUMANITY_LIMITS, ...(options.limits ?? {}) };
    this.now = options.now ?? (() => Date.now());
    this.randomBytes = options.randomBytes ?? ((n) => new Uint8Array(nodeRandomBytes(n)));
    for (const verifier of options.verifiers) {
      if (options.productionMode && !verifier.isProductionSafe) {
        throw new Error(
          `Refusing to register a non-production-safe humanity verifier (${verifier.kind}) in productionMode.`,
        );
      }
      this.verifiers.set(verifier.kind, verifier);
    }
  }

  /** The service PUBLIC key clients pin to verify tokens locally. */
  get publicKeyHex(): string {
    return this.keypair.publicKeyHex;
  }

  /** Mint a one-time challenge for a verifier kind. Fail-closed on an unregistered kind. */
  async challenge(kind: HumanityChallengeKind): Promise<ChallengeResult> {
    if (!this.verifiers.has(kind)) return { ok: false, reason: 'unsupported_kind' };
    const t = this.now();
    const challengeId = this.hex(16);
    const nonce = this.hex(32);
    await this.store.putChallenge(challengeId, {
      kind,
      nonce,
      issuedAt: new Date(t).toISOString(),
      expiresAtMs: t + this.limits.challengeTtlMs,
    });
    return { ok: true, challengeId, kind, nonce };
  }

  /**
   * Verify an attestation for a challenge and, on success, mint + return a wallet batch.
   * Enforces the per-attestation-key daily cap and the per-IP window (AC-5). The challenge
   * is consumed (deleted) on ANY terminal outcome so it is strictly one-time.
   */
  async issue(input: {
    challengeId: string;
    attestation: unknown;
    clientIp?: string;
  }): Promise<IssueResult> {
    const t = this.now();

    // Per-IP window first (cheapest DoS backstop, before any verifier work).
    if (input.clientIp && !this.admitIp(input.clientIp, t)) {
      return { ok: false, reason: 'ip_rate_limited' };
    }

    // One atomic consume makes a challenge one-time across every service replica.
    // The old get-then-delete sequence let two instances read before either delete.
    const consumed = await this.store.consumeChallenge(input.challengeId, t);
    if (!consumed) return { ok: false, reason: 'unknown_challenge' };
    const stored = consumed.challenge;
    if (consumed.expired) return { ok: false, reason: 'challenge_expired' };

    const verifier = this.verifiers.get(stored.kind);
    if (!verifier) return { ok: false, reason: 'verification_failed' };

    const context: HumanityChallengeContext = {
      challengeId: input.challengeId,
      kind: stored.kind,
      nonce: stored.nonce,
      issuedAt: stored.issuedAt,
    };
    let verdict: HumanityVerifierResult;
    try {
      verdict = await verifier.verify({ challenge: context, attestation: input.attestation });
    } catch {
      return { ok: false, reason: 'verification_failed' };
    }
    if (!verdict.ok) return { ok: false, reason: 'verification_failed' };

    // Per-attestation-key daily cap. The key id is HASHED before it touches storage.
    const keyHash = sha256Hex(verdict.attestationKeyId);
    const dayBucket = Math.floor(t / DAY_MS);
    const admitted = await this.store.tryIncrementIssuanceCount(
      keyHash,
      dayBucket,
      this.limits.maxBatchesPerKeyPerDay,
    );
    if (!admitted) return { ok: false, reason: 'key_cap_exceeded' };

    const tokens = issueHumanityTokenBatch({
      servicePrivateKeyHex: this.keypair.privateKeyHex,
      count: this.limits.batchSize,
      ttlMs: this.limits.tokenTtlMs,
      now: t,
      randomBytes: this.randomBytes,
    });
    return { ok: true, tokens };
  }

  /**
   * Verify + spend a single token (the community node's double-spend gate, AC-2). Verifies
   * the signature + expiry against the service's own public key, then records sha256(tokenId)
   * as spent. A replay hits isSpent and is rejected. The token id is HASHED before storage.
   */
  async redeem(rawToken: string): Promise<RedeemResult> {
    const token = parseHumanityToken(rawToken);
    if (!token) return { ok: false, reason: 'invalid' };
    const t = this.now();
    const verdict = verifyHumanityToken(token, this.keypair.publicKeyHex, t);
    if (verdict === 'invalid') return { ok: false, reason: 'invalid' };
    if (verdict === 'expired') return { ok: false, reason: 'expired' };
    const tokenHash = sha256Hex(token.tokenId);
    // ATOMIC spend (AC-2): a single trySpend records-if-absent and reports whether THIS
    // call won. The old isSpent-then-markSpent pair had a TOCTOU race that let two
    // concurrent redeems of the same token both pass. The retained hash expires when the
    // token would have anyway, keeping the spent set bounded.
    const won = await this.store.trySpend(tokenHash, Date.parse(token.expiresAt));
    if (!won) return { ok: false, reason: 'already_spent' };
    return { ok: true };
  }

  /**
   * Replayable registration-only redemption. Signature validation always runs. An expired
   * token may replay a previously committed success, but it can never create a new spend.
   */
  async redeemRegistration(input: RedeemRegistrationInput): Promise<RedeemRegistrationResult> {
    if (!REGISTRATION_DIGEST_RE.test(input.attemptId)
      || !REGISTRATION_DIGEST_RE.test(input.requestDigest)) {
      return { ok: false, reason: 'attempt_conflict' };
    }
    const token = parseHumanityToken(input.token);
    if (!token) return { ok: false, reason: 'invalid' };
    const t = this.now();
    const verdict = verifyHumanityToken(token, this.keypair.publicKeyHex, t);
    if (verdict === 'invalid') return { ok: false, reason: 'invalid' };
    const expectedDigest = humanityRegistrationRedemptionDigest(input.attemptId, token.tokenId);
    if (input.requestDigest !== expectedDigest) {
      return { ok: false, reason: 'request_digest_mismatch' };
    }

    const outcome = await this.store.redeemRegistrationAttempt({
      attemptId: input.attemptId,
      requestDigest: input.requestDigest,
      tokenHash: sha256Hex(token.tokenId),
      expiresAtMs: Date.parse(token.expiresAt),
      allowCreate: verdict === 'ok',
    });
    if (outcome === 'spent') return { ok: true, replayed: false };
    if (outcome === 'replayed') return { ok: true, replayed: true };
    if (outcome === 'attempt_conflict') return { ok: false, reason: 'attempt_conflict' };
    if (outcome === 'already_spent') return { ok: false, reason: 'already_spent' };
    return { ok: false, reason: verdict === 'expired' ? 'expired' : 'invalid' };
  }

  /** Prune expired challenges, spent hashes, stale issuance buckets, and IP windows. */
  async sweep(): Promise<void> {
    const t = this.now();
    await this.store.prune(t);
    for (const [ip, w] of this.ipWindows) {
      if (t - w.windowStartMs >= this.limits.ipWindowMs) this.ipWindows.delete(ip);
    }
  }

  /** Bounded observability (tests + /healthz). Never content or PII. */
  async stats(): Promise<{ spent: number; issuanceKeys: number; challenges: number; ipWindows: number }> {
    const s = await this.store.stats();
    return { ...s, ipWindows: this.ipWindows.size };
  }

  /** IP-window rate check, hashed IP, in-memory only. */
  private admitIp(clientIp: string, t: number): boolean {
    const ipHash = sha256Hex(clientIp);
    const window = this.ipWindows.get(ipHash);
    if (!window || t - window.windowStartMs >= this.limits.ipWindowMs) {
      this.ipWindows.set(ipHash, { windowStartMs: t, count: 1 });
      return true;
    }
    if (window.count >= this.limits.maxIssuePerIpPerWindow) return false;
    window.count += 1;
    return true;
  }

  private hex(bytes: number): string {
    const out = this.randomBytes(bytes);
    let s = '';
    for (const b of out) s += b.toString(16).padStart(2, '0');
    return s;
  }
}

/** Build the signing keypair from the deploy's HUMANITY_SIGNING_KEY seed env. */
export function humanityServiceKeypairFromEnv(
  env: Record<string, string | undefined> = process.env,
): HumanityServiceKeypair {
  const seed = env.HUMANITY_SIGNING_KEY?.trim();
  if (!seed) {
    throw new Error('HUMANITY_SIGNING_KEY (32-byte Ed25519 seed, 64 hex chars) is required.');
  }
  return humanityServiceKeypairFromSeed(seed);
}
