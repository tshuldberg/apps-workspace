/**
 * Plan 51 P1: the verification-account (outer identity) store contract.
 *
 * THE WALL. This contract models ONLY the account layer: accounts, entitlements,
 * per-epoch issuance quota bookkeeping, and sealed epoch signing keys. It NEVER
 * carries a credential serial, persona key, or device identifier -- no field here
 * may join an account to a persona (AC-2). The serial-keyed anonymous bridge lives
 * in a physically separate contract (credential-bridge-store.ts) with no account
 * identifier on its side. Security lives in what these two stores can and cannot
 * hold, not in the code that calls them.
 *
 * The store is DI'd behind an interface so the same service core runs over the
 * in-memory double (tests), a file ledger (self-host), and PostgreSQL (first-party),
 * mirroring the persona-registry store shape.
 */

import { createHash, createHmac, randomBytes } from 'node:crypto';

export type AccountProvider = 'apple' | 'google';

export type AccountAgeStatus = 'unknown' | 'store_adult' | 'store_minor' | 'gate_outcome';

export type AccountAgeSource = 'apple_store' | 'google_store' | 'in_app_gate';

export type ParentalConsentState = 'not_required' | 'required_pending' | 'granted' | 'refused';

export type EntitlementProduct = 'app_unlock' | 'hosted_subscription';

export type EntitlementRail = 'apple' | 'google' | 'stripe';

export type EntitlementStatus = 'active' | 'lapsed' | 'refunded' | 'revoked';

/** A verification-account row. Holds no persona/device/serial field, ever. */
export interface AccountRecord {
  accountId: string;
  provider: AccountProvider;
  /** The SSO provider subject identifier (Apple/Google `sub`). */
  providerSubject: string;
  /** Optional relay email (Apple private relay / Google email), never required. */
  relayEmail?: string;
  /** Set on the first successful sign-in (the store-grade human check). */
  humanVerifiedAt?: string;
  ageStatus: AccountAgeStatus;
  ageSource?: AccountAgeSource;
  parentalConsentState: ParentalConsentState;
  /** When set, renewal is refused (a revoked serial was presented at renewal). */
  renewalFlaggedAt?: string;
  flagReasonCode?: string;
  /** Epoch-only continuity fact. Never a credential identifier. */
  latestIssuedEpoch?: number;
  /** Digest of the blinded request, never the token or its serial. */
  latestIssuedRequestHash?: string;
  /** Day-coarse creation date (YYYY-MM-DD); never a wall-clock timestamp. */
  createdDay: string;
}

/** One entitlement row per (account, product). */
export interface EntitlementRecord {
  accountId: string;
  product: EntitlementProduct;
  rail: EntitlementRail;
  status: EntitlementStatus;
  validUntil?: string;
  updatedAt: string;
}

/** The quota fact: (account, epoch, issued day). NO serial column, ever. */
export interface IssuanceRecord {
  accountId: string;
  epoch: number;
  issuedDay: string;
}

export interface UpsertAccountInput {
  provider: AccountProvider;
  providerSubject: string;
  relayEmail?: string;
  nowMs: number;
}

export interface RecordEntitlementInput {
  accountId: string;
  product: EntitlementProduct;
  rail: EntitlementRail;
  status: EntitlementStatus;
  validUntil?: string;
  nowMs: number;
}

export interface DeleteAccountInput {
  accountId: string;
  provider: AccountProvider;
  providerSubject: string;
  /** Epoch boundary after which the same verified subject may create an account again. */
  recreateAfterMs: number;
}

/**
 * Anti-abuse state that must SURVIVE account deletion so a delete-and-recreate
 * cannot launder away a minor determination or a renewal flag. Captured onto the
 * subject tombstone at deletion and re-seeded onto the recreated account. Retention
 * is the tombstone's, independent of the quota `recreateAfterMs`: the flag re-seeds
 * on every recreate, so it is effectively durable across cycles.
 */
export interface CarriedAntiAbuseState {
  ageStatus: AccountAgeStatus;
  ageSource?: AccountAgeSource;
  parentalConsentState: ParentalConsentState;
  renewalFlaggedAt?: string;
  flagReasonCode?: string;
  /** Epoch-only continuity fact. Never a credential identifier. */
  latestIssuedEpoch?: number;
}

/** Whether any carried field is worth persisting on the tombstone. */
export function hasCarriedAntiAbuseState(s: CarriedAntiAbuseState): boolean {
  return s.ageStatus !== 'unknown'
    || s.parentalConsentState !== 'not_required'
    || s.renewalFlaggedAt !== undefined
    || s.flagReasonCode !== undefined
    || s.latestIssuedEpoch !== undefined;
}

/** Extract the carried anti-abuse state from an account record. */
export function carriedAntiAbuseFromRecord(record: AccountRecord): CarriedAntiAbuseState {
  return {
    ageStatus: record.ageStatus,
    ...(record.latestIssuedEpoch !== undefined ? { latestIssuedEpoch: record.latestIssuedEpoch } : {}),
    ...(record.ageSource ? { ageSource: record.ageSource } : {}),
    parentalConsentState: record.parentalConsentState,
    ...(record.renewalFlaggedAt ? { renewalFlaggedAt: record.renewalFlaggedAt } : {}),
    ...(record.flagReasonCode ? { flagReasonCode: record.flagReasonCode } : {}),
  };
}

/** Age statuses ranked so a more restrictive determination never regresses. */
const AGE_STATUS_RANK: Record<AccountAgeStatus, number> = {
  store_minor: 3,
  gate_outcome: 2,
  store_adult: 1,
  unknown: 0,
};

/**
 * Merge two carried states (a re-deletion of a recreated subject), keeping the
 * most restrictive: the higher-ranked age status, any parental-consent requirement,
 * and the earliest renewal flag. Prevents a delete -> recreate -> weaker-signal ->
 * delete cycle from eroding a prior minor or renewal determination.
 */
export function mergeCarriedAntiAbuse(
  prior: CarriedAntiAbuseState | undefined,
  next: CarriedAntiAbuseState,
): CarriedAntiAbuseState {
  if (!prior) return next;
  const priorRank = AGE_STATUS_RANK[prior.ageStatus];
  const nextRank = AGE_STATUS_RANK[next.ageStatus];
  const stricter = priorRank >= nextRank ? prior : next;
  const renewalFlaggedAt = [prior.renewalFlaggedAt, next.renewalFlaggedAt]
    .filter((v): v is string => typeof v === 'string')
    .sort()[0];
  return {
    ageStatus: stricter.ageStatus,
    ...([prior.latestIssuedEpoch, next.latestIssuedEpoch].some((epoch) => epoch !== undefined)
      ? { latestIssuedEpoch: Math.max(prior.latestIssuedEpoch ?? -1, next.latestIssuedEpoch ?? -1) } : {}),
    ...(stricter.ageSource ? { ageSource: stricter.ageSource } : {}),
    parentalConsentState: prior.parentalConsentState !== 'not_required'
      ? prior.parentalConsentState
      : next.parentalConsentState,
    ...(renewalFlaggedAt ? { renewalFlaggedAt } : {}),
    ...(prior.flagReasonCode ?? next.flagReasonCode
      ? { flagReasonCode: prior.flagReasonCode ?? next.flagReasonCode }
      : {}),
  };
}

/**
 * Merge carried anti-abuse state onto a freshly created account record. The most
 * restrictive age status wins ('store_minor' is never downgraded by a carried
 * 'unknown'), and a prior renewal flag is preserved.
 */
export function applyCarriedAntiAbuse(record: AccountRecord, carried: CarriedAntiAbuseState): void {
  if (carried.latestIssuedEpoch !== undefined) record.latestIssuedEpoch = carried.latestIssuedEpoch;
  if (carried.ageStatus !== 'unknown') {
    record.ageStatus = carried.ageStatus;
    if (carried.ageSource) record.ageSource = carried.ageSource;
  }
  if (carried.parentalConsentState !== 'not_required') {
    record.parentalConsentState = carried.parentalConsentState;
  }
  if (carried.renewalFlaggedAt) record.renewalFlaggedAt = carried.renewalFlaggedAt;
  if (carried.flagReasonCode) record.flagReasonCode = carried.flagReasonCode;
}

/** Compare-and-set continuity, inside the store's atomic quota mutation. */
export function canRecordCredentialIssuance(
  latest: number | undefined,
  expected: number | null | undefined,
  epoch: number,
): boolean {
  if (expected == null) return latest === undefined;
  return latest === expected && epoch > expected;
}

/** Exact request replay may recover a lost response without issuing another pass. */
export function isCredentialIssuanceReplay(
  account: Pick<AccountRecord, 'latestIssuedEpoch' | 'latestIssuedRequestHash'>,
  epoch: number,
  requestHash?: string,
): boolean {
  return typeof requestHash === 'string' && /^[a-f0-9]{64}$/u.test(requestHash)
    && account.latestIssuedEpoch === epoch && account.latestIssuedRequestHash === requestHash;
}

export interface IssuanceEligibility {
  blockMinorIssuance: boolean;
  /** Read inside the quota mutation so waiting for a lock cannot extend entitlement validity. */
  now: () => number;
}

export function canIssueCredential(
  account: Pick<AccountRecord, 'ageStatus' | 'renewalFlaggedAt'> | null | undefined,
  entitlements: readonly EntitlementRecord[], nowMs: number, blockMinorIssuance: boolean,
): boolean {
  return Boolean(account && Number.isFinite(nowMs) && !account.renewalFlaggedAt
    && !(blockMinorIssuance && account.ageStatus === 'store_minor')
    && entitlements.some((row) => (row.product === 'app_unlock' || row.product === 'hosted_subscription')
      && row.status === 'active'
      && (row.validUntil === undefined || Date.parse(row.validUntil) > nowMs)));
}

/** Result of the one-per-epoch quota insert (AC-1 / NC-1). */
export type RecordIssuanceOutcome = 'recorded' | 'already_issued';

/**
 * The durable account store. Every method that mutates account state cascades on
 * account deletion (entitlements + issuance rows go with the account row).
 */
export interface AccountStore {
  /** Insert-if-absent by (provider, subject); returns the existing or created row. */
  upsertAccount(input: UpsertAccountInput): (AccountRecord | null) | Promise<AccountRecord | null>;
  getAccountById(accountId: string): (AccountRecord | null) | Promise<AccountRecord | null>;
  getAccountByProviderSubject(
    provider: AccountProvider,
    providerSubject: string,
  ): (AccountRecord | null) | Promise<AccountRecord | null>;
  /** Record a store age signal (skips/pre-fills the in-app gate where lawful). */
  setAgeStatus(
    accountId: string,
    status: AccountAgeStatus,
    source: AccountAgeSource,
  ): void | Promise<void>;
  /** Flag the account so renewal is refused (a revoked serial was presented). */
  flagRenewal(accountId: string, reasonCode: string, nowMs: number): void | Promise<void>;
  /** Upsert an entitlement row for (account, product). */
  recordEntitlement(input: RecordEntitlementInput): void | Promise<void>;
  getEntitlements(accountId: string): EntitlementRecord[] | Promise<EntitlementRecord[]>;
  /**
   * The one-per-epoch quota gate: insert (account, epoch). 'recorded' iff THIS call
   * claimed the slot and continuity. Omitted/null predecessor means first issuance;
   * renewal requires the latest issued epoch. Exact blinded-request replays return
   * recorded without advancing the quota. Store mutation must be atomic.
   */
  recordIssuance(accountId: string, epoch: number, nowMs: number, expectedPreviousEpoch?: number | null, requestHash?: string, eligibility?: IssuanceEligibility): RecordIssuanceOutcome | Promise<RecordIssuanceOutcome>;
  /** Store a sealed epoch private key (idempotent: no-op if the epoch key exists). */
  putSealedEpochKey(epoch: number, sealedPrivateKey: string): void | Promise<void>;
  getSealedEpochKey(epoch: number): (string | null) | Promise<string | null>;
  /** Delete an account, preserve an epoch-bounded subject tombstone, and cascade rows. */
  deleteAccount(input: DeleteAccountInput): void | Promise<void>;
  stats(): AccountStoreStats | Promise<AccountStoreStats>;
}

export interface AccountStoreStats {
  accounts: number;
  entitlements: number;
  issuances: number;
}

// ---------------------------------------------------------------------------
// Day-coarse helpers (timing-correlation mitigation: no wall-clock on rows the
// issuance quota touches).
// ---------------------------------------------------------------------------

/** UTC day bucket (YYYY-MM-DD) for a ms timestamp. */
export function accountDay(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

/**
 * Domain-separated deletion marker. It never retains the raw SSO subject.
 *
 * When a server secret is configured (production), the marker is an HMAC-SHA256
 * under that key so a DB reader who holds a CANDIDATE provider subject cannot
 * confirm whether that person deleted their account (the marker is a membership
 * oracle otherwise). The secret must be STABLE for the deployment's lifetime, or
 * old tombstones stop matching and lose their block. Absent a secret, it falls
 * back to a plain SHA-256 (unkeyed) so tests and un-provisioned dev still work;
 * production MUST set MEERKAT_ACCOUNT_TOMBSTONE_SECRET. Output is 64 lowercase hex
 * either way (the deleted_subjects hash-shape CHECK holds).
 */
export function accountSubjectTombstoneHash(
  provider: AccountProvider,
  providerSubject: string,
  secret?: string,
): string {
  const preimage = `meerkat-account-deleted-subject-v1\0${provider}\0${providerSubject}`;
  return secret
    ? createHmac('sha256', secret).update(preimage, 'utf8').digest('hex')
    : createHash('sha256').update(preimage, 'utf8').digest('hex');
}

function newAccountId(): string {
  // A random v4-shaped id; the store never needs it to be provider-derived.
  const bytes = randomId();
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function randomId(): Uint8Array {
  return new Uint8Array(randomBytes(16));
}

// ---------------------------------------------------------------------------
// In-memory store (tests + ephemeral). Single-threaded check-then-set is atomic.
// ---------------------------------------------------------------------------

export class InMemoryAccountStore implements AccountStore {
  private readonly accounts = new Map<string, AccountRecord>(); // accountId -> record
  private readonly byProviderSubject = new Map<string, string>(); // provider\0subject -> accountId
  private readonly entitlements = new Map<string, EntitlementRecord>(); // accountId\0product -> row
  private readonly issuances = new Set<string>(); // accountId\0epoch
  private readonly sealedKeys = new Map<number, string>(); // epoch -> sealed private key
  private readonly deletedSubjects = new Map<string, { recreateAfterMs: number; carried: CarriedAntiAbuseState }>();
  private readonly subjectHashSecret?: string;

  constructor(options?: { subjectHashSecret?: string }) {
    this.subjectHashSecret = options?.subjectHashSecret;
  }

  private providerSubjectKey(provider: AccountProvider, providerSubject: string): string {
    return `${provider}\u0000${providerSubject}`;
  }

  upsertAccount(input: UpsertAccountInput): AccountRecord | null {
    const subjectHash = accountSubjectTombstoneHash(input.provider, input.providerSubject, this.subjectHashSecret);
    const tombstone = this.deletedSubjects.get(subjectHash);
    if (tombstone !== undefined) {
      if (input.nowMs < tombstone.recreateAfterMs) return null;
      this.deletedSubjects.delete(subjectHash);
    }
    const key = this.providerSubjectKey(input.provider, input.providerSubject);
    const existingId = this.byProviderSubject.get(key);
    if (existingId) {
      const existing = this.accounts.get(existingId)!;
      // A relay email arriving on a later sign-in is filled in if absent; never overwritten.
      if (input.relayEmail && !existing.relayEmail) existing.relayEmail = input.relayEmail;
      if (!existing.humanVerifiedAt) existing.humanVerifiedAt = new Date(input.nowMs).toISOString();
      return existing;
    }
    const record: AccountRecord = {
      accountId: newAccountId(),
      provider: input.provider,
      providerSubject: input.providerSubject,
      ...(input.relayEmail ? { relayEmail: input.relayEmail } : {}),
      humanVerifiedAt: new Date(input.nowMs).toISOString(),
      ageStatus: 'unknown',
      parentalConsentState: 'not_required',
      createdDay: accountDay(input.nowMs),
    };
    // Re-seed anti-abuse flags carried on the tombstone so delete-and-recreate
    // cannot launder a minor determination or a renewal flag (HIGH-1).
    if (tombstone) applyCarriedAntiAbuse(record, tombstone.carried);
    this.accounts.set(record.accountId, record);
    this.byProviderSubject.set(key, record.accountId);
    return record;
  }

  getAccountById(accountId: string): AccountRecord | null {
    return this.accounts.get(accountId) ?? null;
  }

  getAccountByProviderSubject(provider: AccountProvider, providerSubject: string): AccountRecord | null {
    const id = this.byProviderSubject.get(this.providerSubjectKey(provider, providerSubject));
    return id ? this.accounts.get(id) ?? null : null;
  }

  setAgeStatus(accountId: string, status: AccountAgeStatus, source: AccountAgeSource): void {
    const record = this.accounts.get(accountId);
    if (!record) return;
    record.ageStatus = status;
    record.ageSource = source;
  }

  flagRenewal(accountId: string, reasonCode: string, nowMs: number): void {
    const record = this.accounts.get(accountId);
    if (!record) return;
    if (!record.renewalFlaggedAt) record.renewalFlaggedAt = new Date(nowMs).toISOString();
    record.flagReasonCode = reasonCode;
  }

  recordEntitlement(input: RecordEntitlementInput): void {
    const key = `${input.accountId}\u0000${input.product}`;
    this.entitlements.set(key, {
      accountId: input.accountId,
      product: input.product,
      rail: input.rail,
      status: input.status,
      ...(input.validUntil !== undefined ? { validUntil: input.validUntil } : {}),
      updatedAt: new Date(input.nowMs).toISOString(),
    });
  }

  getEntitlements(accountId: string): EntitlementRecord[] {
    const out: EntitlementRecord[] = [];
    for (const row of this.entitlements.values()) {
      if (row.accountId === accountId) out.push(row);
    }
    return out;
  }

  recordIssuance(accountId: string, epoch: number, _nowMs: number, expectedPreviousEpoch?: number | null, requestHash?: string, eligibility?: IssuanceEligibility): RecordIssuanceOutcome {
    const key = `${accountId}\u0000${epoch}`;
    const account = this.accounts.get(accountId);
    if (eligibility && !canIssueCredential(account, this.getEntitlements(accountId), eligibility.now(), eligibility.blockMinorIssuance)) return 'already_issued';
    if (account && isCredentialIssuanceReplay(account, epoch, requestHash)) return 'recorded';
    if (!account || !canRecordCredentialIssuance(account.latestIssuedEpoch, expectedPreviousEpoch, epoch)
      || this.issuances.has(key)) return 'already_issued';
    account.latestIssuedEpoch = Math.max(account.latestIssuedEpoch ?? -1, epoch);
    account.latestIssuedRequestHash = requestHash;
    this.issuances.add(key);
    return 'recorded';
  }

  putSealedEpochKey(epoch: number, sealedPrivateKey: string): void {
    if (!this.sealedKeys.has(epoch)) this.sealedKeys.set(epoch, sealedPrivateKey);
  }

  getSealedEpochKey(epoch: number): string | null {
    return this.sealedKeys.get(epoch) ?? null;
  }

  deleteAccount(input: DeleteAccountInput): void {
    const { accountId } = input;
    const record = this.accounts.get(accountId);
    if (
      !record
      || record.provider !== input.provider
      || record.providerSubject !== input.providerSubject
    ) return;
    const subjectHash = accountSubjectTombstoneHash(record.provider, record.providerSubject, this.subjectHashSecret);
    const prior = this.deletedSubjects.get(subjectHash);
    this.deletedSubjects.set(subjectHash, {
      recreateAfterMs: Math.max(prior?.recreateAfterMs ?? 0, input.recreateAfterMs),
      carried: mergeCarriedAntiAbuse(prior?.carried, carriedAntiAbuseFromRecord(record)),
    });
    this.byProviderSubject.delete(this.providerSubjectKey(record.provider, record.providerSubject));
    this.accounts.delete(accountId);
    for (const key of [...this.entitlements.keys()]) {
      if (key.startsWith(`${accountId}\u0000`)) this.entitlements.delete(key);
    }
    for (const key of [...this.issuances]) {
      if (key.startsWith(`${accountId}\u0000`)) this.issuances.delete(key);
    }
  }

  stats(): AccountStoreStats {
    return {
      accounts: this.accounts.size,
      entitlements: this.entitlements.size,
      issuances: this.issuances.size,
    };
  }
}
