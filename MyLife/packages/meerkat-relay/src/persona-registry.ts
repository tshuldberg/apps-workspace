/**
 * Public-tier ALIAS REGISTRY + accounts service (Plan 39, P2). The deployable that turns a
 * humanity-verified public persona into a registered account with a unique alias, issues
 * short-lived session tokens, and runs GDPR delete/export. It is the `pf_personas` table
 * concept, DI'd over a durable store, mirroring HumanityService's pure-core-plus-store shape.
 *
 * SECURITY / HONESTY (binding, Plan 39 NCs):
 *  - Registration is HUMANITY-GATED (NC-P3 anchor): the persona commits (in its signed
 *    PersonaClaim) to sha512(tokenId) of the humanity token it will spend; the service
 *    verifies the claim, checks the presented token's id matches that commitment, then
 *    REDEEMS the token (double-spend gate) before writing the row. A bad claim never spends
 *    a token; a spent/forged/mismatched token never registers.
 *  - Alias uniqueness is ATOMIC on the case-folded canonical form (the store's durable
 *    registration critical section). Exactly one of two racing registrations wins.
 *  - GDPR delete releases the alias, revokes the persona's sessions (fail-closed), and blocks
 *    re-registration of that alias for 30 days (AC-5). Export returns exactly the rows the
 *    service holds for a persona, authorized by a fresh persona-signed request.
 *  - The device key never appears here (NC-P2): the service only ever sees persona pubkeys,
 *    aliases, humanity-token commitments, and session bearers.
 *
 * NO NEW CRYPTO: persona claim/proof verification is Ed25519 via @mylife/sync; session
 * bearers are HMAC-SHA256 (persona-session.ts); the only hash here is the repo-wide sha512Hex
 * for the humanity-token binding check (the same primitive the RN/web client uses, so the
 * commitment matches on both ends).
 */

import { createHash, randomBytes as nodeRandomBytes } from 'node:crypto';
import {
  canonicalizeAlias,
  parseHumanityToken,
  sha512Hex,
  verifyPersonaClaim,
  type PersonaClaim,
} from '@mylife/sync';
import { humanityRegistrationRedemptionDigest } from './humanity-service';
import {
  DEFAULT_PERSONA_SESSION_TTL_MS,
  MAX_PERSONA_SESSION_TTL_MS,
  PERSONA_GDPR_DELETE_DOMAIN,
  PERSONA_GDPR_EXPORT_DOMAIN,
  signPersonaSessionToken,
  verifyPersonaRequestSignature,
  verifyPersonaSessionChallengeSignature,
  verifyPersonaSessionToken,
  type PersonaSessionVerdict,
} from './persona-session';

// ---------------------------------------------------------------------------
// Records + store contract.
// ---------------------------------------------------------------------------

/** A registered persona row (the `pf_personas` concept). */
export interface PersonaRecord {
  version: 1;
  /** Canonical, case-folded alias (the primary key). */
  alias: string;
  /** The persona Ed25519 public key (hex). */
  personaPubkey: string;
  /** sha512(tokenId) of the humanity token spent at registration (no identity). */
  humanityBinding: string;
  /** The signed claim, retained as durable proof of the registration. */
  claim: PersonaClaim;
  createdAt: string;
}

export type PersonaRegistrationAttemptState =
  | 'reserved'
  | 'humanity_verified'
  | 'committed';

/** Durable provisional registration state. It is never returned by alias resolution. */
export interface PersonaRegistrationAttempt {
  version: 1;
  attemptId: string;
  requestDigest: string;
  state: PersonaRegistrationAttemptState;
  record: PersonaRecord;
  createdAt: string;
  updatedAt: string;
}

/** Reserved attempts release their alias if the caller never recovers the humanity result. */
export const PERSONA_REGISTRATION_RESERVATION_TTL_MS = 24 * 60 * 60 * 1000;

export type BeginPersonaRegistrationOutcome =
  | 'reserved'
  | 'resume_reserved'
  | 'humanity_verified'
  | 'committed'
  | 'alias_taken'
  | 'pubkey_taken'
  | 'alias_cooldown'
  | 'persona_revoked'
  | 'attempt_conflict';

export type CommitPersonaRegistrationOutcome =
  | { outcome: 'ok'; record: PersonaRecord }
  | {
      outcome:
        | 'not_found'
        | 'not_verified'
        | 'attempt_conflict'
        | 'alias_taken'
        | 'pubkey_taken'
        | 'alias_cooldown'
        | 'persona_revoked';
    };

function sameRegistrationAttempt(
  existing: PersonaRegistrationAttempt,
  candidate: PersonaRegistrationAttempt,
): boolean {
  return existing.attemptId === candidate.attemptId
    && existing.requestDigest === candidate.requestDigest
    && existing.record.alias === candidate.record.alias
    && existing.record.personaPubkey === candidate.record.personaPubkey
    && existing.record.humanityBinding === candidate.record.humanityBinding
    && existing.record.claim.signature === candidate.record.claim.signature;
}

/** A released-alias tombstone: blocks re-registration of that alias for the cooldown. */
export interface AliasReleaseTombstone {
  alias: string;
  personaPubkey: string;
  releasedAt: string;
  /** Re-registration of this alias is refused until this ms timestamp (AC-5: 30 days). */
  reregisterBlockedUntilMs: number;
}

/**
 * Outcome of the atomic reservation. Policy and uniqueness are decided in the same store
 * transaction/critical section so a second service replica cannot pass a stale pre-check:
 *  - 'alias_cooldown' the alias has an active release tombstone,
 *  - 'persona_revoked' this persona key has a durable revocation,
 *  - 'alias_taken'   the canonical alias already belongs to some persona,
 *  - 'pubkey_taken'  this persona key already owns a (different) alias (one alias per persona),
 *  - 'ok'            the reservation won both locks.
 */
export type TryRegisterOutcome =
  | 'ok'
  | 'alias_taken'
  | 'pubkey_taken'
  | 'alias_cooldown'
  | 'persona_revoked';

/**
 * The durable store. Security-critical properties: registration must be ATOMIC on BOTH the
 * canonical alias AND the persona key (one alias per persona), and survive restart; release
 * tombstones + revocations must be durable (a forgotten tombstone re-opens an early
 * re-register; a forgotten revocation re-opens a deleted persona's sessions).
 */
export interface PersonaRegistryStore {
  /** Reserve an alias/persona pair without making it resolvable. */
  beginRegistrationAttempt?(
    attempt: PersonaRegistrationAttempt,
    nowMs?: number,
  ): BeginPersonaRegistrationOutcome | Promise<BeginPersonaRegistrationOutcome>;
  /** Persist the remote humanity success before activating the persona row. */
  markRegistrationHumanityVerified?(
    attemptId: string,
    requestDigest: string,
  ): 'ok' | 'not_found' | 'attempt_conflict' | Promise<'ok' | 'not_found' | 'attempt_conflict'>;
  /** Idempotently activate a humanity-verified attempt. */
  commitRegistrationAttempt?(
    attemptId: string,
    requestDigest: string,
    nowMs?: number,
  ): CommitPersonaRegistrationOutcome | Promise<CommitPersonaRegistrationOutcome>;
  /** Release a noncommitted reservation after a definitive rejection or terminal policy block. */
  cancelRegistrationAttempt?(
    attemptId: string,
    requestDigest: string,
  ): boolean | Promise<boolean>;
  /**
   * ATOMIC insert-if-absent keyed on BOTH the canonical alias and the persona pubkey. Returns
   * 'ok' iff THIS call claimed both; otherwise which lock was already held. The two-key
   * uniqueness is what stops one persona owning two aliases (which would leave an alias
   * undeletable after a GDPR delete resolves the persona to a single alias).
   */
  tryRegister(record: PersonaRecord, nowMs?: number): TryRegisterOutcome | Promise<TryRegisterOutcome>;
  /**
   * Remove an alias row + its pubkey pointer WITHOUT a tombstone. Used to roll back a
   * reservation whose humanity redeem failed, so an aborted registration frees the alias
   * immediately (no 30-day hold, since nothing was ever really registered).
   */
  remove(alias: string, expectedPersonaPubkey?: string): void | Promise<void>;
  getByAlias(alias: string): (PersonaRecord | null) | Promise<PersonaRecord | null>;
  getByPubkey(personaPubkey: string): (PersonaRecord | null) | Promise<PersonaRecord | null>;
  /** Bounded bulk reverse lookup. Durable production stores implement this without N+1 IO. */
  getByPubkeys?(personaPubkeys: readonly string[]): PersonaRecord[] | Promise<PersonaRecord[]>;
  /** Remove the alias record and persist the release tombstone. */
  release(alias: string, tombstone: AliasReleaseTombstone): void | Promise<void>;
  getTombstone(alias: string): (AliasReleaseTombstone | null) | Promise<AliasReleaseTombstone | null>;
  /** Mark a persona's sessions revoked (GDPR delete / operator suspend). */
  revoke(personaPubkey: string, reason?: string): void | Promise<void>;
  /**
   * Clear a persona's revocation marker (operator UNSUSPEND, Plan 39 P12). The
   * SERVICE decides when this is allowed (never for a GDPR-deleted persona, whose
   * registry row is gone); the store just flips the durable flag back.
   */
  unrevoke(personaPubkey: string): void | Promise<void>;
  isRevoked(personaPubkey: string): boolean | Promise<boolean>;
  /**
   * Serialize a persona lifecycle write across every process sharing this store. The method is
   * optional only for compatibility with external/test store decorators; first-party durable
   * stores implement it. The service retains a process-local fallback for older decorators.
   */
  withPersonaWriteLock?<T>(personaPubkey: string, operation: () => Promise<T>): Promise<T>;
  prune(nowMs: number): void | Promise<void>;
  stats(): { personas: number; tombstones: number; revoked: number } | Promise<{ personas: number; tombstones: number; revoked: number }>;
}

/** In-memory store: default for tests + ephemeral nodes. */
export class InMemoryPersonaRegistryStore implements PersonaRegistryStore {
  private readonly personas = new Map<string, PersonaRecord>(); // alias -> record
  private readonly byPubkey = new Map<string, string>(); // pubkey -> alias
  private readonly tombstones = new Map<string, AliasReleaseTombstone>(); // alias -> tombstone
  private readonly revoked = new Map<string, { reason: string; revokedAt: string }>();
  private readonly writeLocks = new Map<string, Promise<unknown>>();
  private readonly registrationAttempts = new Map<string, PersonaRegistrationAttempt>();

  private pruneExpiredRegistrationAttempts(nowMs: number): void {
    for (const [attemptId, attempt] of this.registrationAttempts) {
      if (attempt.state === 'reserved'
        && Date.parse(attempt.createdAt) + PERSONA_REGISTRATION_RESERVATION_TTL_MS <= nowMs) {
        this.registrationAttempts.delete(attemptId);
      }
    }
  }

  beginRegistrationAttempt(
    attempt: PersonaRegistrationAttempt,
    nowMs = Date.now(),
  ): BeginPersonaRegistrationOutcome {
    this.pruneExpiredRegistrationAttempts(nowMs);
    const tombstone = this.tombstones.get(attempt.record.alias);
    if (tombstone) {
      if (tombstone.reregisterBlockedUntilMs > nowMs) return 'alias_cooldown';
      this.tombstones.delete(attempt.record.alias);
    }
    if (this.revoked.has(attempt.record.personaPubkey)) return 'persona_revoked';

    const existing = this.registrationAttempts.get(attempt.attemptId);
    if (existing) {
      if (!sameRegistrationAttempt(existing, attempt)) return 'attempt_conflict';
      if (existing.state === 'committed') return 'committed';
      return existing.state === 'humanity_verified' ? 'humanity_verified' : 'resume_reserved';
    }
    if (this.personas.has(attempt.record.alias)) return 'alias_taken';
    if (this.byPubkey.has(attempt.record.personaPubkey)) return 'pubkey_taken';
    for (const other of this.registrationAttempts.values()) {
      if (other.state === 'committed') continue;
      if (other.record.alias === attempt.record.alias) return 'alias_taken';
      if (other.record.personaPubkey === attempt.record.personaPubkey) return 'pubkey_taken';
    }
    this.registrationAttempts.set(attempt.attemptId, attempt);
    return 'reserved';
  }

  markRegistrationHumanityVerified(
    attemptId: string,
    requestDigest: string,
  ): 'ok' | 'not_found' | 'attempt_conflict' {
    const existing = this.registrationAttempts.get(attemptId);
    if (!existing) return 'not_found';
    if (existing.requestDigest !== requestDigest) return 'attempt_conflict';
    if (existing.state === 'reserved') {
      this.registrationAttempts.set(attemptId, {
        ...existing,
        state: 'humanity_verified',
        updatedAt: new Date().toISOString(),
      });
    }
    return 'ok';
  }

  commitRegistrationAttempt(
    attemptId: string,
    requestDigest: string,
    nowMs = Date.now(),
  ): CommitPersonaRegistrationOutcome {
    const attempt = this.registrationAttempts.get(attemptId);
    if (!attempt) return { outcome: 'not_found' };
    if (attempt.requestDigest !== requestDigest) return { outcome: 'attempt_conflict' };
    const record = attempt.record;
    if (attempt.state === 'committed') {
      const active = this.personas.get(record.alias);
      return active?.personaPubkey === record.personaPubkey
        ? { outcome: 'ok', record: active }
        : { outcome: 'not_found' };
    }
    if (attempt.state !== 'humanity_verified') return { outcome: 'not_verified' };
    const tombstone = this.tombstones.get(record.alias);
    if (tombstone) {
      if (tombstone.reregisterBlockedUntilMs > nowMs) return { outcome: 'alias_cooldown' };
      this.tombstones.delete(record.alias);
    }
    if (this.revoked.has(record.personaPubkey)) return { outcome: 'persona_revoked' };
    const aliasOwner = this.personas.get(record.alias);
    if (aliasOwner && aliasOwner.personaPubkey !== record.personaPubkey) {
      return { outcome: 'alias_taken' };
    }
    const pubkeyOwner = this.byPubkey.get(record.personaPubkey);
    if (pubkeyOwner && pubkeyOwner !== record.alias) return { outcome: 'pubkey_taken' };
    this.personas.set(record.alias, record);
    this.byPubkey.set(record.personaPubkey, record.alias);
    this.registrationAttempts.set(attemptId, {
      ...attempt,
      state: 'committed',
      updatedAt: new Date().toISOString(),
    });
    return { outcome: 'ok', record };
  }

  cancelRegistrationAttempt(attemptId: string, requestDigest: string): boolean {
    const attempt = this.registrationAttempts.get(attemptId);
    if (!attempt || attempt.requestDigest !== requestDigest || attempt.state === 'committed') {
      return false;
    }
    return this.registrationAttempts.delete(attemptId);
  }

  tryRegister(record: PersonaRecord, nowMs = Date.now()): TryRegisterOutcome {
    this.pruneExpiredRegistrationAttempts(nowMs);
    // Atomic in memory: check-then-set with NO await between, so two concurrent registers can
    // never both see policy/alias/pubkey state as free (single-threaded event loop).
    const tombstone = this.tombstones.get(record.alias);
    if (tombstone) {
      if (tombstone.reregisterBlockedUntilMs > nowMs) return 'alias_cooldown';
      this.tombstones.delete(record.alias);
    }
    if (this.revoked.has(record.personaPubkey)) return 'persona_revoked';
    for (const attempt of this.registrationAttempts.values()) {
      if (attempt.state === 'committed') continue;
      if (attempt.record.alias === record.alias) return 'alias_taken';
      if (attempt.record.personaPubkey === record.personaPubkey) return 'pubkey_taken';
    }
    if (this.personas.has(record.alias)) return 'alias_taken';
    if (this.byPubkey.has(record.personaPubkey)) return 'pubkey_taken';
    this.personas.set(record.alias, record);
    this.byPubkey.set(record.personaPubkey, record.alias);
    return 'ok';
  }
  remove(alias: string, expectedPersonaPubkey?: string): void {
    const record = this.personas.get(alias);
    if (expectedPersonaPubkey && record?.personaPubkey !== expectedPersonaPubkey) return;
    if (record) this.byPubkey.delete(record.personaPubkey);
    this.personas.delete(alias);
  }
  getByAlias(alias: string): PersonaRecord | null {
    return this.personas.get(alias) ?? null;
  }
  getByPubkey(personaPubkey: string): PersonaRecord | null {
    const alias = this.byPubkey.get(personaPubkey);
    return alias ? this.personas.get(alias) ?? null : null;
  }
  getByPubkeys(personaPubkeys: readonly string[]): PersonaRecord[] {
    const records: PersonaRecord[] = [];
    for (const personaPubkey of personaPubkeys.slice(0, 200)) {
      const record = this.getByPubkey(personaPubkey);
      if (record) records.push(record);
    }
    return records;
  }
  release(alias: string, tombstone: AliasReleaseTombstone): void {
    const record = this.personas.get(alias);
    if (record && record.personaPubkey !== tombstone.personaPubkey) {
      throw new Error('Refusing to release an alias owned by another persona.');
    }
    this.tombstones.set(alias, tombstone);
    for (const [attemptId, attempt] of this.registrationAttempts) {
      if (attempt.record.personaPubkey === tombstone.personaPubkey) {
        this.registrationAttempts.delete(attemptId);
      }
    }
    if (record) this.byPubkey.delete(record.personaPubkey);
    this.personas.delete(alias);
  }
  getTombstone(alias: string): AliasReleaseTombstone | null {
    return this.tombstones.get(alias) ?? null;
  }
  revoke(personaPubkey: string, reason = 'unspecified'): void {
    if (reason.length === 0 || reason.length > 512) {
      throw new TypeError('Persona revocation reason must be between 1 and 512 characters.');
    }
    this.revoked.set(personaPubkey, { reason, revokedAt: new Date().toISOString() });
  }
  unrevoke(personaPubkey: string): void {
    this.revoked.delete(personaPubkey);
  }
  isRevoked(personaPubkey: string): boolean {
    return this.revoked.has(personaPubkey);
  }
  async withPersonaWriteLock<T>(personaPubkey: string, operation: () => Promise<T>): Promise<T> {
    const key = personaPubkey.toLowerCase();
    const prior = this.writeLocks.get(key) ?? Promise.resolve();
    const run = prior.then(operation, operation);
    const tail = run.then(() => undefined, () => undefined);
    this.writeLocks.set(key, tail);
    void tail.then(() => {
      if (this.writeLocks.get(key) === tail) this.writeLocks.delete(key);
    });
    return run;
  }
  prune(nowMs: number): void {
    this.pruneExpiredRegistrationAttempts(nowMs);
    for (const attempt of [...this.registrationAttempts.values()]) {
      if (attempt.state === 'humanity_verified') {
        this.commitRegistrationAttempt(attempt.attemptId, attempt.requestDigest, nowMs);
      }
    }
    // Drop expired tombstones (cooldown passed -> the alias is freely re-registrable).
    for (const [alias, t] of this.tombstones) {
      if (t.reregisterBlockedUntilMs <= nowMs) this.tombstones.delete(alias);
    }
  }
  stats(): { personas: number; tombstones: number; revoked: number } {
    return { personas: this.personas.size, tombstones: this.tombstones.size, revoked: this.revoked.size };
  }
}

// ---------------------------------------------------------------------------
// Reserved aliases + limits.
// ---------------------------------------------------------------------------

/**
 * Aliases reserved from public registration (impersonation of first-party / system roles).
 * All entries are already in canonical form. Deploys can extend via options.reservedAliases.
 */
export const DEFAULT_RESERVED_ALIASES: readonly string[] = [
  'admin', 'administrator', 'root', 'system', 'sysadmin', 'moderator', 'mod', 'staff',
  'support', 'help', 'official', 'meerkat', 'meerkat_team', 'team', 'security', 'abuse',
  'billing', 'legal', 'dmca', 'ncmec', 'commons', 'the_commons', 'everyone', 'here',
  'null', 'undefined', 'anonymous', 'anon', 'me', 'you', 'owner',
];

/** Alias re-registration cooldown after a GDPR release: 30 days (AC-5). */
export const ALIAS_REREGISTER_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Service.
// ---------------------------------------------------------------------------

/** Verifies + spends a wire humanity token (the double-spend gate; wired to a HumanityService). */
export interface HumanityRegistrationRedeemContext {
  attemptId: string;
  requestDigest: string;
}

export type HumanityRedeemFn = (
  token: string,
  registration?: HumanityRegistrationRedeemContext,
) => Promise<{ ok: boolean; reason?: string; replayed?: boolean }>;

export interface PersonaRegistryServiceOptions {
  store?: PersonaRegistryStore;
  /** HMAC secret for session bearers. Required to issue/verify sessions. */
  sessionSecret: string;
  /**
   * Redeem seam for the registration humanity gate. When humanityRequired is true this MUST
   * be provided or registration fails CLOSED (not_configured). Verifies + SPENDS the token.
   */
  redeemHumanity?: HumanityRedeemFn;
  /** Whether registration requires a humanity token. Default true (first-party). */
  humanityRequired?: boolean;
  /** Extra reserved aliases (merged with DEFAULT_RESERVED_ALIASES). */
  reservedAliases?: Iterable<string>;
  /** Session lifetime (ms). Clamped to [60s, MAX_PERSONA_SESSION_TTL_MS]. */
  sessionTtlMs?: number;
  /** Session-issuance challenge lifetime (ms). Default 5m. */
  challengeTtlMs?: number;
  now?: () => number;
  randomBytes?: (length: number) => Uint8Array;
}

export type RegisterResult =
  | { ok: true; alias: string; personaPubkey: string }
  | {
      ok: false;
      reason:
        | 'bad_claim'
        | 'bad_alias'
        | 'alias_reserved'
        | 'alias_cooldown'
        | 'alias_taken'
        | 'persona_exists'
        | 'persona_revoked'
        | 'humanity_not_configured'
        | 'humanity_binding_mismatch'
        | 'humanity_invalid'
        | 'humanity_already_spent'
        | 'humanity_attempt_conflict'
        | 'humanity_unreachable';
    };

export type SessionChallengeResult =
  | { ok: true; challengeId: string; nonce: string }
  | { ok: false; reason: 'unregistered' | 'revoked' };

export type IssueSessionResult =
  | { ok: true; token: string; expiresAtMs: number }
  | { ok: false; reason: 'unknown_challenge' | 'challenge_expired' | 'unregistered' | 'revoked' | 'bad_signature' | 'not_configured' };

export type PersonaExport =
  | { ok: true; record: PersonaRecord | null; revoked: boolean }
  | { ok: false; reason: 'bad_signature' };

export type DeleteAccountResult =
  | { ok: true; releasedAlias: string | null; revokedPersona: string; reregisterBlockedUntilMs: number | null }
  | { ok: false; reason: 'bad_signature' };

export type AuthorizeDeleteAccountResult =
  | { ok: true; personaPubkey: string; alreadyRevoked: boolean }
  | { ok: false; reason: 'bad_signature' };

/** Operator suspend outcome (Plan 39 P12). Idempotent: re-suspending is ok. */
export type SuspendPersonaResult =
  | { ok: true; personaPubkey: string; alias: string | null; alreadySuspended: boolean }
  | { ok: false; reason: 'bad_pubkey' };

/**
 * Operator unsuspend outcome (Plan 39 P12). FAIL-CLOSED for deleted accounts: a
 * persona with no registry row (GDPR delete released it) can never be un-revoked,
 * because that would re-validate any still-unexpired session bearers of a deleted
 * account. Idempotent: unsuspending a live, unsuspended persona is ok.
 */
export type UnsuspendPersonaResult =
  | { ok: true; personaPubkey: string; alias: string; wasSuspended: boolean }
  | { ok: false; reason: 'bad_pubkey' | 'not_registered' };

/** Operator-facing persona status (real store rows only; Plan 39 P12 / NC-P6). */
export interface PersonaAdminStatus {
  personaPubkey: string;
  registered: boolean;
  alias: string | null;
  suspended: boolean;
}

interface PendingSessionChallenge {
  personaPubkey: string;
  nonce: string;
  expiresAtMs: number;
}

const encoder = new TextEncoder();
/** The humanity-token commitment hash (repo-wide sha512Hex, RN/web/node-portable). */
function bindingHash(tokenId: string): string {
  return sha512Hex(encoder.encode(tokenId));
}

const PERSONA_REGISTRATION_ATTEMPT_DOMAIN = 'mylife:persona:registration-attempt:v1';

/** Stable idempotency key for one exact signed persona registration claim. */
export function personaRegistrationAttemptId(claim: PersonaClaim): string {
  const request = JSON.stringify([
    claim.version,
    claim.alias,
    claim.personaPubkey,
    claim.humanityBinding,
    claim.issuedAt,
    claim.signature,
  ]);
  return createHash('sha256')
    .update(`${PERSONA_REGISTRATION_ATTEMPT_DOMAIN}\0${request}`, 'utf8')
    .digest('hex');
}

const ADMIN_PUBKEY_RE = /^[0-9a-f]{64}$/i;
/** Lowercase-normalize a persona pubkey; null when it is not 64 hex (fail-closed). */
function normalizePubkey(raw: string): string | null {
  if (typeof raw !== 'string' || !ADMIN_PUBKEY_RE.test(raw)) return null;
  return raw.toLowerCase();
}

export class PersonaRegistryService {
  private readonly store: PersonaRegistryStore;
  private readonly sessionSecret: string;
  private readonly redeemHumanity?: HumanityRedeemFn;
  private readonly humanityRequired: boolean;
  private readonly reserved: Set<string>;
  private readonly sessionTtlMs: number;
  private readonly challengeTtlMs: number;
  private readonly now: () => number;
  private readonly randomBytes: (length: number) => Uint8Array;
  /** challengeId -> pending challenge (in-memory, short-TTL; loss just forces a re-challenge). */
  private readonly challenges = new Map<string, PendingSessionChallenge>();
  /**
   * Per-persona write serialization for the revocation lifecycle (GDPR delete,
   * operator suspend/unsuspend). Each of those is a read-modify-write over the
   * same row + revocation flag; unserialized, an unsuspend racing a delete could
   * clear the delete's revocation and re-validate a deleted account's bearers.
   */
  private readonly personaLocks = new Map<string, Promise<unknown>>();

  constructor(options: PersonaRegistryServiceOptions) {
    this.store = options.store ?? new InMemoryPersonaRegistryStore();
    this.sessionSecret = options.sessionSecret;
    this.redeemHumanity = options.redeemHumanity;
    this.humanityRequired = options.humanityRequired ?? true;
    this.reserved = new Set<string>(DEFAULT_RESERVED_ALIASES);
    for (const a of options.reservedAliases ?? []) {
      const canonical = canonicalizeAlias(a);
      if (canonical) this.reserved.add(canonical);
    }
    this.sessionTtlMs = Math.min(
      MAX_PERSONA_SESSION_TTL_MS,
      Math.max(60_000, options.sessionTtlMs ?? DEFAULT_PERSONA_SESSION_TTL_MS),
    );
    this.challengeTtlMs = options.challengeTtlMs ?? 5 * 60 * 1000;
    this.now = options.now ?? (() => Date.now());
    this.randomBytes = options.randomBytes ?? ((n) => new Uint8Array(nodeRandomBytes(n)));
  }

  /** True iff a canonical alias is reserved. */
  isReserved(canonicalAlias: string): boolean {
    return this.reserved.has(canonicalAlias);
  }

  /**
   * Register a persona's alias. Fail-closed, and CRITICALLY it never burns a humanity token on
   * a doomed registration: a non-resolvable saga reservation happens BEFORE the humanity
   * redeem, so a loser of a same-alias race (or a persona that already owns an alias) is
   * rejected with NO token spent. The remote spend is idempotent on the deterministic attempt.
   * A retry can therefore recover every process-death point without exposing an unverified row.
   *
   * Order: verify claim -> alias policy -> humanity binding pre-check (no spend) -> ATOMIC
   * cooldown/revocation check + reserve(alias+pubkey) -> idempotent redeem -> persist verified
   * -> activate the persona row. Definitive redemption rejects cancel only an unverified saga.
   */
  async register(input: {
    claim: PersonaClaim;
    humanityToken?: string;
    /**
     * Plan 51 P2 alternative proof: set true ONLY by the HTTP layer after it has
     * verified a valid anonymous credential presentation. When true, the humanity
     * gate is treated as already satisfied for THIS registration (no token spend),
     * exactly as if the node did not require humanity. The core never verifies the
     * credential itself; it trusts this flag only because the HTTP layer set it
     * behind a real verifier. Default false => byte-identical legacy behavior.
     */
    humanitySatisfiedByCredential?: boolean;
  }): Promise<RegisterResult> {
    const { claim } = input;
    if (verifyPersonaClaim(claim) !== 'ok') return { ok: false, reason: 'bad_claim' };

    // The claim's alias is already canonical (verifyPersonaClaim enforced it); re-canonicalize
    // defensively so a claim that somehow carries a non-canonical alias cannot slip through.
    const alias = canonicalizeAlias(claim.alias);
    if (!alias || alias !== claim.alias) return { ok: false, reason: 'bad_alias' };
    if (this.isReserved(alias)) return { ok: false, reason: 'alias_reserved' };

    // A verified credential is the ALTERNATIVE humanity proof: it satisfies the
    // gate without spending a humanity token, so this registration follows the
    // no-humanity direct path below.
    const humanityRequired = this.humanityRequired && !input.humanitySatisfiedByCredential;

    const t = this.now();
    let humanityTokenId: string | null = null;
    // Cheap humanity BINDING check (no spend): reject a token that is not the one committed to.
    if (humanityRequired) {
      if (!this.redeemHumanity) return { ok: false, reason: 'humanity_not_configured' };
      const parsed = input.humanityToken ? parseHumanityToken(input.humanityToken) : null;
      if (!parsed) return { ok: false, reason: 'humanity_invalid' };
      if (bindingHash(parsed.tokenId) !== claim.humanityBinding) {
        return { ok: false, reason: 'humanity_binding_mismatch' };
      }
      humanityTokenId = parsed.tokenId;
    }

    // RESERVE the alias + persona key atomically, BEFORE spending any token. A race loser or a
    // persona that already owns an alias is rejected here with no token burned.
    const record: PersonaRecord = {
      version: 1,
      alias,
      personaPubkey: claim.personaPubkey,
      humanityBinding: claim.humanityBinding,
      claim,
      createdAt: new Date(t).toISOString(),
    };
    if (!humanityRequired) {
      const reservation = await this.store.tryRegister(record, t);
      if (reservation === 'alias_cooldown') return { ok: false, reason: 'alias_cooldown' };
      if (reservation === 'persona_revoked') return { ok: false, reason: 'persona_revoked' };
      if (reservation === 'alias_taken') return { ok: false, reason: 'alias_taken' };
      if (reservation === 'pubkey_taken') return { ok: false, reason: 'persona_exists' };
      return { ok: true, alias, personaPubkey: claim.personaPubkey };
    }

    const beginRegistration = this.store.beginRegistrationAttempt?.bind(this.store);
    const markVerified = this.store.markRegistrationHumanityVerified?.bind(this.store);
    const commitRegistration = this.store.commitRegistrationAttempt?.bind(this.store);
    const cancelRegistration = this.store.cancelRegistrationAttempt?.bind(this.store);
    if (!beginRegistration || !markVerified || !commitRegistration || !cancelRegistration) {
      return { ok: false, reason: 'humanity_not_configured' };
    }

    const attemptId = personaRegistrationAttemptId(claim);
    const requestDigest = humanityRegistrationRedemptionDigest(attemptId, humanityTokenId!);
    const attempt: PersonaRegistrationAttempt = {
      version: 1,
      attemptId,
      requestDigest,
      state: 'reserved',
      record,
      createdAt: record.createdAt,
      updatedAt: record.createdAt,
    };
    const begun = await beginRegistration(attempt, t);
    if (begun === 'alias_cooldown') return { ok: false, reason: 'alias_cooldown' };
    if (begun === 'persona_revoked') return { ok: false, reason: 'persona_revoked' };
    if (begun === 'alias_taken') return { ok: false, reason: 'alias_taken' };
    if (begun === 'pubkey_taken') return { ok: false, reason: 'persona_exists' };
    if (begun === 'attempt_conflict') return { ok: false, reason: 'humanity_attempt_conflict' };
    if (begun === 'committed') return { ok: true, alias, personaPubkey: claim.personaPubkey };

    if (begun === 'reserved' || begun === 'resume_reserved') {
      let verdict: { ok: boolean; reason?: string; replayed?: boolean };
      try {
        verdict = await this.redeemHumanity!(input.humanityToken as string, {
          attemptId,
          requestDigest,
        });
      } catch {
        // Unknown remote outcome: retain the durable reservation. The same request retries the
        // same humanity attempt and learns whether the spend committed.
        return { ok: false, reason: 'humanity_unreachable' };
      }
      if (!verdict.ok) {
        if (verdict.reason === 'service_unreachable' || verdict.reason === 'error') {
          return { ok: false, reason: 'humanity_unreachable' };
        }
        await cancelRegistration(attemptId, requestDigest);
        if (verdict.reason === 'already_spent') {
          return { ok: false, reason: 'humanity_already_spent' };
        }
        if (verdict.reason === 'attempt_conflict'
          || verdict.reason === 'request_digest_mismatch') {
          return { ok: false, reason: 'humanity_attempt_conflict' };
        }
        return { ok: false, reason: 'humanity_invalid' };
      }
      const marked = await markVerified(attemptId, requestDigest);
      if (marked === 'attempt_conflict') {
        return { ok: false, reason: 'humanity_attempt_conflict' };
      }
      if (marked === 'not_found') {
        throw new Error('Persona registration reservation vanished after humanity redemption.');
      }
    }

    const committed = await commitRegistration(attemptId, requestDigest, this.now());
    if (committed.outcome === 'ok') {
      return { ok: true, alias: committed.record.alias, personaPubkey: committed.record.personaPubkey };
    }
    await cancelRegistration(attemptId, requestDigest);
    if (committed.outcome === 'alias_cooldown') return { ok: false, reason: 'alias_cooldown' };
    if (committed.outcome === 'persona_revoked') return { ok: false, reason: 'persona_revoked' };
    if (committed.outcome === 'alias_taken') return { ok: false, reason: 'alias_taken' };
    if (committed.outcome === 'pubkey_taken') return { ok: false, reason: 'persona_exists' };
    return { ok: false, reason: 'humanity_attempt_conflict' };
  }

  /** Resolve a (possibly non-canonical) alias to its persona pubkey. */
  async resolve(alias: string): Promise<{ alias: string; personaPubkey: string } | null> {
    const canonical = canonicalizeAlias(alias);
    if (!canonical) return null;
    const record = await this.store.getByAlias(canonical);
    return record ? { alias: record.alias, personaPubkey: record.personaPubkey } : null;
  }

  /**
   * Batch REVERSE resolve: map each given persona pubkey to its REGISTERED alias.
   * Only registered personas appear in the result (an unregistered, deleted, or
   * malformed key is simply absent -- the caller then shows the honest short-id
   * fallback, never a fabricated name). A GDPR delete removes the pubkey->alias
   * pointer, so a deleted persona resolves to nothing here. The batch is de-duped
   * and capped so a feed page cannot turn into an unbounded lookup.
   */
  async reverseResolveKeys(personaPubkeys: readonly string[], max = 200): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    const seen = new Set<string>();
    const limit = Number.isFinite(max) ? Math.min(200, Math.max(0, Math.floor(max))) : 200;
    for (const raw of personaPubkeys) {
      if (seen.size >= limit) break;
      if (typeof raw !== 'string') continue;
      const key = raw.toLowerCase();
      if (seen.has(key) || out[key] !== undefined) continue;
      if (!/^[0-9a-f]{64}$/.test(key)) continue; // never look up a malformed key
      seen.add(key);
    }
    const keys = [...seen];
    if (this.store.getByPubkeys) {
      for (const record of await this.store.getByPubkeys(keys)) {
        if (seen.has(record.personaPubkey)) out[record.personaPubkey] = record.alias;
      }
      return out;
    }
    for (const key of keys) {
      const record = await this.store.getByPubkey(key);
      if (record) out[key] = record.alias;
    }
    return out;
  }

  /** Mint a one-time session-issuance challenge for a REGISTERED, non-revoked persona. */
  async sessionChallenge(personaPubkey: string): Promise<SessionChallengeResult> {
    const record = await this.store.getByPubkey(personaPubkey);
    if (!record) return { ok: false, reason: 'unregistered' };
    if (await this.store.isRevoked(personaPubkey)) return { ok: false, reason: 'revoked' };
    const challengeId = this.hex(16);
    const nonce = this.hex(32);
    this.challenges.set(challengeId, {
      personaPubkey,
      nonce,
      expiresAtMs: this.now() + this.challengeTtlMs,
    });
    return { ok: true, challengeId, nonce };
  }

  /**
   * Issue a session bearer after verifying: a live one-time challenge, the persona still
   * registered + not revoked, and a valid persona-key possession proof over the challenge
   * nonce. The challenge is consumed on ANY terminal outcome so it is strictly one-time.
   * (Humanity is anchored at REGISTRATION; issuance proves possession of the already-verified
   * persona key. A deploy that wants a fresh humanity check on issuance can layer it in the
   * HTTP middleware, Plan 39 P7.)
   */
  async issueSession(input: {
    challengeId: string;
    personaPubkey: string;
    signatureHex: string;
  }): Promise<IssueSessionResult> {
    if (!this.sessionSecret) return { ok: false, reason: 'not_configured' };
    const pending = this.challenges.get(input.challengeId);
    if (!pending) return { ok: false, reason: 'unknown_challenge' };
    this.challenges.delete(input.challengeId); // one-time
    if (pending.expiresAtMs <= this.now()) return { ok: false, reason: 'challenge_expired' };
    if (pending.personaPubkey !== input.personaPubkey) return { ok: false, reason: 'bad_signature' };

    const record = await this.store.getByPubkey(input.personaPubkey);
    if (!record) return { ok: false, reason: 'unregistered' };
    if (await this.store.isRevoked(input.personaPubkey)) return { ok: false, reason: 'revoked' };

    if (!verifyPersonaSessionChallengeSignature(pending.nonce, input.personaPubkey, input.signatureHex)) {
      return { ok: false, reason: 'bad_signature' };
    }

    const issuedAtMs = this.now();
    const expiresAtMs = issuedAtMs + this.sessionTtlMs;
    const token = signPersonaSessionToken(this.sessionSecret, {
      personaPubkey: input.personaPubkey,
      issuedAtMs,
      expiresAtMs,
    });
    return { ok: true, token, expiresAtMs };
  }

  /** Verify a session bearer (HMAC + revocation). The seam Track B's routes consume. */
  async verifySession(token: string): Promise<PersonaSessionVerdict> {
    const verdict = verifyPersonaSessionToken(token, this.sessionSecret, this.now());
    if (!verdict.ok) return verdict;
    if (await this.store.isRevoked(verdict.personaPubkey)) return { ok: false, reason: 'revoked' };
    return verdict;
  }

  /**
   * Verify the delete signature and revoke sessions without releasing the alias.
   * The GDPR coordinator calls this first, then removes dependent public data,
   * and calls deleteAccount only after every required downstream step succeeds.
   */
  async authorizeDeleteAccount(input: {
    personaPubkey: string;
    issuedAtMs: number;
    signatureHex: string;
  }): Promise<AuthorizeDeleteAccountResult> {
    if (!verifyPersonaRequestSignature({
      domain: PERSONA_GDPR_DELETE_DOMAIN,
      personaPubkey: input.personaPubkey,
      issuedAtMs: input.issuedAtMs,
      signatureHex: input.signatureHex,
      nowMs: this.now(),
    })) {
      return { ok: false, reason: 'bad_signature' };
    }
    return this.withPersonaLock(input.personaPubkey, async () => {
      const alreadyRevoked = await this.store.isRevoked(input.personaPubkey);
      if (!alreadyRevoked) await this.store.revoke(input.personaPubkey, 'gdpr_delete_authorized');
      return { ok: true as const, personaPubkey: input.personaPubkey, alreadyRevoked };
    });
  }

  /**
   * GDPR DELETE: authorized by a fresh persona-signed request. Releases the alias (30-day
   * re-registration block), revokes the persona's sessions, and returns the revoked persona
   * so the caller can propagate post tombstones (P6/P12). Idempotent: deleting an
   * already-deleted persona still returns ok with a null releasedAlias.
   */
  async deleteAccount(input: {
    personaPubkey: string;
    issuedAtMs: number;
    signatureHex: string;
  }): Promise<DeleteAccountResult> {
    if (!verifyPersonaRequestSignature({
      domain: PERSONA_GDPR_DELETE_DOMAIN,
      personaPubkey: input.personaPubkey,
      issuedAtMs: input.issuedAtMs,
      signatureHex: input.signatureHex,
      nowMs: this.now(),
    })) {
      return { ok: false, reason: 'bad_signature' };
    }
    // Serialized against operator suspend/unsuspend on the same persona: an
    // unsuspend interleaving between the revoke and the release below could
    // otherwise clear the delete's revocation (see personaLocks).
    return this.withPersonaLock(input.personaPubkey, async () => {
      // Revoke sessions regardless (fail-closed: a delete always kills the persona's bearers).
      await this.store.revoke(input.personaPubkey, 'gdpr_delete');
      const record = await this.store.getByPubkey(input.personaPubkey);
      if (!record) {
        return { ok: true as const, releasedAlias: null, revokedPersona: input.personaPubkey, reregisterBlockedUntilMs: null };
      }
      const releasedAt = this.now();
      const reregisterBlockedUntilMs = releasedAt + ALIAS_REREGISTER_COOLDOWN_MS;
      await this.store.release(record.alias, {
        alias: record.alias,
        personaPubkey: input.personaPubkey,
        releasedAt: new Date(releasedAt).toISOString(),
        reregisterBlockedUntilMs,
      });
      return {
        ok: true as const,
        releasedAlias: record.alias,
        revokedPersona: input.personaPubkey,
        reregisterBlockedUntilMs,
      };
    });
  }

  /** GDPR EXPORT: authorized by a fresh persona-signed request. Returns all held rows. */
  async exportAccount(input: {
    personaPubkey: string;
    issuedAtMs: number;
    signatureHex: string;
  }): Promise<PersonaExport> {
    if (!verifyPersonaRequestSignature({
      domain: PERSONA_GDPR_EXPORT_DOMAIN,
      personaPubkey: input.personaPubkey,
      issuedAtMs: input.issuedAtMs,
      signatureHex: input.signatureHex,
      nowMs: this.now(),
    })) {
      return { ok: false, reason: 'bad_signature' };
    }
    // A deleted persona's row is purged (nothing left to export but the revoked flag); a live
    // persona has no tombstone. Tombstones are keyed by alias, not pubkey, so the export holds
    // exactly the current record (or null) plus whether the persona is revoked.
    const record = await this.store.getByPubkey(input.personaPubkey);
    const revoked = await this.store.isRevoked(input.personaPubkey);
    return { ok: true, record, revoked };
  }

  /**
   * OPERATOR SUSPEND (Plan 39 P12): revoke the persona's live sessions and deny
   * every future session issuance + submit through the same durable revocation
   * flag GDPR delete uses (the flag createPersonaSessionVerifier's isRevoked seam
   * consults). Unlike deleteAccount it does NOT release the alias, so the account
   * stays resolvable and REVERSIBLE (unsuspendPersona). Authorization is the
   * CALLER's (operator console auth); the registry only enforces shape.
   */
  async suspendPersona(personaPubkeyRaw: string): Promise<SuspendPersonaResult> {
    const personaPubkey = normalizePubkey(personaPubkeyRaw);
    if (!personaPubkey) return { ok: false, reason: 'bad_pubkey' };
    return this.withPersonaLock(personaPubkey, async () => {
      const alreadySuspended = await this.store.isRevoked(personaPubkey);
      if (!alreadySuspended) await this.store.revoke(personaPubkey, 'operator_suspend');
      const record = await this.store.getByPubkey(personaPubkey);
      return { ok: true as const, personaPubkey, alias: record?.alias ?? null, alreadySuspended };
    });
  }

  /**
   * OPERATOR UNSUSPEND (Plan 39 P12). Refuses (fail-closed) when the persona has
   * no registry row: that state means a GDPR delete already released the account,
   * and clearing the revocation would re-validate a deleted account's unexpired
   * session bearers. Only a live, registered persona can be unsuspended.
   */
  async unsuspendPersona(personaPubkeyRaw: string): Promise<UnsuspendPersonaResult> {
    const personaPubkey = normalizePubkey(personaPubkeyRaw);
    if (!personaPubkey) return { ok: false, reason: 'bad_pubkey' };
    return this.withPersonaLock(personaPubkey, async () => {
      const record = await this.store.getByPubkey(personaPubkey);
      if (!record) return { ok: false as const, reason: 'not_registered' as const };
      const wasSuspended = await this.store.isRevoked(personaPubkey);
      if (wasSuspended) {
        await this.store.unrevoke(personaPubkey);
        // Belt + suspenders under external store writers (a second service
        // process sharing the volume): if the row vanished mid-flight, restore
        // the revocation so a just-deleted account's unexpired bearers are never
        // re-validated. In-process, the persona lock already serializes this
        // against deleteAccount.
        const recheck = await this.store.getByPubkey(personaPubkey);
        if (!recheck) {
          await this.store.revoke(personaPubkey, 'deleted_account_guard');
          return { ok: false as const, reason: 'not_registered' as const };
        }
      }
      return { ok: true as const, personaPubkey, alias: record.alias, wasSuspended };
    });
  }

  /** Operator-facing status snapshot: exactly what the store holds (NC-P6). */
  async personaAdminStatus(personaPubkeyRaw: string): Promise<PersonaAdminStatus | null> {
    const personaPubkey = normalizePubkey(personaPubkeyRaw);
    if (!personaPubkey) return null;
    const record = await this.store.getByPubkey(personaPubkey);
    const suspended = await this.store.isRevoked(personaPubkey);
    return { personaPubkey, registered: record !== null, alias: record?.alias ?? null, suspended };
  }

  /** Resolve an alias to its operator-facing status (console lookup by @alias). */
  async personaAdminStatusByAlias(alias: string): Promise<PersonaAdminStatus | null> {
    const resolved = await this.resolve(alias);
    if (!resolved) return null;
    return this.personaAdminStatus(resolved.personaPubkey);
  }

  /** Prune expired challenges + tombstones. Wire to the server sweep interval. */
  async sweep(): Promise<void> {
    const t = this.now();
    for (const [id, c] of this.challenges) if (c.expiresAtMs <= t) this.challenges.delete(id);
    await this.store.prune(t);
  }

  async stats(): Promise<{ personas: number; tombstones: number; revoked: number; challenges: number }> {
    const s = await this.store.stats();
    return { ...s, challenges: this.challenges.size };
  }

  /** Serialize one persona's revocation-lifecycle writes locally and, when available, durably. */
  private async withPersonaLock<T>(personaPubkey: string, fn: () => Promise<T>): Promise<T> {
    if (this.store.withPersonaWriteLock) {
      return this.store.withPersonaWriteLock(personaPubkey.toLowerCase(), fn);
    }
    const key = personaPubkey.toLowerCase();
    const prior = this.personaLocks.get(key) ?? Promise.resolve();
    const run = prior.then(fn, fn);
    const tail = run.then(() => undefined, () => undefined);
    this.personaLocks.set(key, tail);
    void tail.then(() => {
      if (this.personaLocks.get(key) === tail) this.personaLocks.delete(key);
    });
    return run;
  }

  private hex(bytes: number): string {
    const out = this.randomBytes(bytes);
    let s = '';
    for (const b of out) s += b.toString(16).padStart(2, '0');
    return s;
  }
}
