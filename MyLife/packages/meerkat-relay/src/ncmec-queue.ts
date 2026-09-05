/**
 * NCMEC report QUEUE (Plan 39 P13). A durable, append-only queue of CSAM report records with a
 * VENDOR SEAM. This module makes NO real NCMEC API calls: it persists a report record whenever
 * a CSAM signal fires (a submit-boundary abuse-hash match, or an operator actioning a
 * csam-flagged report) and exposes an EXPORT for the founder's manual filing until the vendor
 * onboarding lands (Plan 39 P15 founder-ops).
 *
 * Honesty (NC-P4): the queue never claims a report was FILED. A record is `queued` until the
 * founder (or, later, a real NcmecFilingClient) marks it `exported`/`filed`. Evidence is stored
 * as REFERENCES ONLY -- content-derived ids and blob HASHES, never bytes and never a raw persona
 * key beyond the public pubkey the post already carries. NC-P1: only public-tier signals reach
 * here; the private mesh is never scanned or reported.
 */

import { createHash, randomUUID } from 'node:crypto';

export type NcmecReportSource = 'submit_scan' | 'operator_report';

/**
 * Lifecycle of a queued report.
 *  - `queued`    the signal fired; the record is durable and awaiting a filing or a manual export.
 *  - `exported`  the founder pulled it for MANUAL CyberTipline filing (the emergency path).
 *  - `filed`     a real NcmecFilingClient confirmed the provider accepted it. NEVER set by a
 *                queued request, a manual export, or a worker without provider confirmation.
 *  - `escalated` the filing worker hit a PERMANENT validation failure (bad/missing evidence the
 *                provider will always reject). A durable dead-letter surfaced to operators, never
 *                a silent drop and never a false `filed`. An operator resolves it manually.
 */
export type NcmecReportStatus = 'queued' | 'exported' | 'filed' | 'escalated';

/** One durable CSAM report record. All fields are references; no bytes, no secrets. */
export interface NcmecReportRecord {
  /** Stable content-derived id (sha256 over the evidence tuple). Idempotent enqueue key. */
  id: string;
  source: NcmecReportSource;
  /** ISO time the signal fired. */
  detectedAt: string;
  publicationId: string;
  channelId?: string;
  postId?: string;
  /** The author persona public key (already public in the post; not a secret). */
  personaPubkey?: string;
  /** Blob hashes that matched the known-bad set (submit_scan) -- evidence references. */
  matchedBlobHashes?: string[];
  /** The operator report key (operator_report source), sha256 of the report signature. */
  reportKey?: string;
  /** The triggering reason, e.g. 'abuse_hash_match' | 'csam'. */
  reason: string;
  status: NcmecReportStatus;
  /**
   * The provider's confirmation reference (CyberTipline report id), set ONLY when a real filing
   * client confirms acceptance. Present iff `status === 'filed'`.
   */
  providerRef?: string;
  /** ISO time the provider confirmed the filing. Present iff `status === 'filed'`. */
  filedAt?: string;
  /** How many filing attempts the worker has made (transient retries + the terminal attempt). */
  filingAttemptCount?: number;
  /** The last filing error code (transient or permanent) the worker recorded, for operators. */
  lastFilingErrorCode?: string;
}

export const NCMEC_MAX_EVIDENCE_HASHES = 256;
export const NCMEC_MAX_PAYLOAD_BYTES = 64 * 1024;
const NCMEC_HASH = /^[a-f0-9]{64}$/u;
const NCMEC_SOURCES = new Set<NcmecReportSource>(['submit_scan', 'operator_report']);
const NCMEC_STATUSES = new Set<NcmecReportStatus>(['queued', 'exported', 'filed', 'escalated']);
/** Provider references / error codes are bounded, printable, no-whitespace tokens. */
const NCMEC_PROVIDER_REF = /^[A-Za-z0-9_.:@/-]{1,256}$/u;
const NCMEC_ERROR_CODE = /^[A-Za-z0-9_.:-]{1,128}$/u;

export function validateNcmecReportRecord(record: NcmecReportRecord): void {
  if (!NCMEC_HASH.test(record.id)
    || !NCMEC_SOURCES.has(record.source)
    || !NCMEC_STATUSES.has(record.status)
    || !Number.isSafeInteger(Date.parse(record.detectedAt))) {
    throw new TypeError('NCMEC report identity is invalid');
  }
  const boundedStrings = [
    record.publicationId,
    record.channelId,
    record.postId,
    record.personaPubkey,
    record.reportKey,
    record.reason,
  ].filter((value): value is string => value !== undefined);
  if (boundedStrings.some((value) => value.length === 0 || value.length > 512)) {
    throw new TypeError('NCMEC evidence reference is invalid');
  }
  if (record.reportKey !== undefined && !NCMEC_HASH.test(record.reportKey)) {
    throw new TypeError('NCMEC report key is invalid');
  }
  const evidence = record.matchedBlobHashes ?? [];
  if (evidence.length > NCMEC_MAX_EVIDENCE_HASHES
    || new Set(evidence).size !== evidence.length
    || evidence.some((hash) => !NCMEC_HASH.test(hash))) {
    throw new TypeError('NCMEC evidence hashes are invalid');
  }
  // Filing-lifecycle coherence. `filed` REQUIRES a provider ref and a filed time (never faked); a
  // provider ref / filed time REQUIRES `filed`. The attempt count and last error are bounded.
  if (record.providerRef !== undefined && !NCMEC_PROVIDER_REF.test(record.providerRef)) {
    throw new TypeError('NCMEC provider reference is invalid');
  }
  if (record.lastFilingErrorCode !== undefined && !NCMEC_ERROR_CODE.test(record.lastFilingErrorCode)) {
    throw new TypeError('NCMEC filing error code is invalid');
  }
  if (record.filedAt !== undefined && !Number.isSafeInteger(Date.parse(record.filedAt))) {
    throw new TypeError('NCMEC filed time is invalid');
  }
  if (record.filingAttemptCount !== undefined
    && (!Number.isSafeInteger(record.filingAttemptCount) || record.filingAttemptCount < 0)) {
    throw new TypeError('NCMEC filing attempt count is invalid');
  }
  const hasProviderRef = record.providerRef !== undefined;
  const hasFiledAt = record.filedAt !== undefined;
  if (record.status === 'filed') {
    if (!hasProviderRef || !hasFiledAt) {
      throw new TypeError('NCMEC filed record requires a provider reference and filed time');
    }
  } else if (hasProviderRef || hasFiledAt) {
    throw new TypeError('NCMEC provider reference and filed time require a filed record');
  }
  if (Buffer.byteLength(JSON.stringify(record), 'utf8') > NCMEC_MAX_PAYLOAD_BYTES) {
    throw new TypeError('NCMEC report payload exceeds the byte limit');
  }
}

/** Bounded counts the console + status surfaces render (real counts, NC-P6). */
export interface NcmecQueueCounts {
  queued: number;
  exported: number;
  filed: number;
  escalated: number;
  total: number;
}

export interface NcmecExportClaim {
  record: NcmecReportRecord;
  fencingToken: number;
}

export interface NcmecExportClaimInput {
  owner: string;
  limit: number;
  leaseMs: number;
  /** File and memory clock. PostgreSQL adapters deliberately use database time instead. */
  nowMs: number;
}

export interface NcmecExportCompletionInput {
  owner: string;
  claims: ReadonlyArray<{ id: string; fencingToken: number }>;
  status: Extract<NcmecReportStatus, 'exported' | 'filed'>;
  /** File and memory clock. PostgreSQL adapters deliberately use database time instead. */
  nowMs: number;
}

/** A filing-worker claim: the same fenced lease machinery as export, keyed by the filing owner. */
export interface NcmecFilingClaim {
  record: NcmecReportRecord;
  fencingToken: number;
  /** How many times this record has been claimed for filing so far (0 before the first claim). */
  filingAttemptCount: number;
}

export interface NcmecFilingClaimInput {
  owner: string;
  limit: number;
  leaseMs: number;
  /** File and memory clock. PostgreSQL adapters deliberately use database time instead. */
  nowMs: number;
}

/**
 * The terminal outcome the filing worker records under its held claim, fenced on
 * (owner, fencingToken, live lease). Exactly one of:
 *  - `filed`      the provider confirmed; store the reference and stamp the filed time.
 *  - `escalated`  a PERMANENT validation failure; dead-letter it with the error code.
 *  - `retry`      a TRANSIENT failure; release the claim and reschedule after `nextAttemptAtMs`.
 */
export type NcmecFilingResolution =
  | { kind: 'filed'; providerRef: string }
  | { kind: 'escalated'; errorCode: string }
  | { kind: 'retry'; errorCode: string; nextAttemptAtMs: number };

export interface NcmecFilingCompletionInput {
  owner: string;
  id: string;
  fencingToken: number;
  resolution: NcmecFilingResolution;
  /** File and memory clock. PostgreSQL adapters deliberately use database time instead. */
  nowMs: number;
}

export type NcmecFilingCompletionResult = 'committed' | 'lease_lost';

const EXPORT_OWNER = /^[A-Za-z0-9_.:@/-]{1,256}$/u;
const FILING_PROVIDER_REF = /^[A-Za-z0-9_.:@/-]{1,256}$/u;
const FILING_ERROR_CODE = /^[A-Za-z0-9_.:-]{1,128}$/u;

function validateExportClaimInput(input: NcmecExportClaimInput): void {
  if (!EXPORT_OWNER.test(input.owner)) throw new TypeError('NCMEC export owner is invalid');
  if (!Number.isSafeInteger(input.limit) || input.limit <= 0 || input.limit > 1000) {
    throw new TypeError('NCMEC export limit must be between 1 and 1000');
  }
  if (!Number.isSafeInteger(input.leaseMs) || input.leaseMs <= 0
    || input.leaseMs > 24 * 60 * 60 * 1000) {
    throw new TypeError('NCMEC export lease must be between 1ms and 24 hours');
  }
  if (!Number.isSafeInteger(input.nowMs) || input.nowMs < 0) {
    throw new TypeError('NCMEC export clock must be a non-negative safe integer');
  }
}

function validateExportCompletionInput(input: NcmecExportCompletionInput): void {
  if (!EXPORT_OWNER.test(input.owner)) throw new TypeError('NCMEC export owner is invalid');
  if (input.status !== 'exported' && input.status !== 'filed') {
    throw new TypeError('NCMEC export completion status is invalid');
  }
  if (input.claims.length > 1000) throw new TypeError('NCMEC export completion exceeds 1000 claims');
  if (!Number.isSafeInteger(input.nowMs) || input.nowMs < 0) {
    throw new TypeError('NCMEC export completion clock is invalid');
  }
  const ids = new Set<string>();
  for (const claim of input.claims) {
    if (!/^[a-f0-9]{64}$/u.test(claim.id)
      || !Number.isSafeInteger(claim.fencingToken) || claim.fencingToken <= 0
      || ids.has(claim.id)) {
      throw new TypeError('NCMEC export completion claim is invalid');
    }
    ids.add(claim.id);
  }
}

function validateFilingClaimInput(input: NcmecFilingClaimInput): void {
  if (!EXPORT_OWNER.test(input.owner)) throw new TypeError('NCMEC filing owner is invalid');
  if (!Number.isSafeInteger(input.limit) || input.limit <= 0 || input.limit > 1000) {
    throw new TypeError('NCMEC filing limit must be between 1 and 1000');
  }
  if (!Number.isSafeInteger(input.leaseMs) || input.leaseMs <= 0
    || input.leaseMs > 24 * 60 * 60 * 1000) {
    throw new TypeError('NCMEC filing lease must be between 1ms and 24 hours');
  }
  if (!Number.isSafeInteger(input.nowMs) || input.nowMs < 0) {
    throw new TypeError('NCMEC filing clock must be a non-negative safe integer');
  }
}

export function validateFilingCompletionInput(input: NcmecFilingCompletionInput): void {
  if (!EXPORT_OWNER.test(input.owner)) throw new TypeError('NCMEC filing owner is invalid');
  if (!/^[a-f0-9]{64}$/u.test(input.id)) throw new TypeError('NCMEC filing id is invalid');
  if (!Number.isSafeInteger(input.fencingToken) || input.fencingToken <= 0) {
    throw new TypeError('NCMEC filing fencing token is invalid');
  }
  if (!Number.isSafeInteger(input.nowMs) || input.nowMs < 0) {
    throw new TypeError('NCMEC filing completion clock is invalid');
  }
  const { resolution } = input;
  if (resolution.kind === 'filed') {
    if (!FILING_PROVIDER_REF.test(resolution.providerRef)) {
      throw new TypeError('NCMEC filing provider reference is invalid');
    }
  } else if (resolution.kind === 'escalated') {
    if (!FILING_ERROR_CODE.test(resolution.errorCode)) {
      throw new TypeError('NCMEC escalation error code is invalid');
    }
  } else if (resolution.kind === 'retry') {
    if (!FILING_ERROR_CODE.test(resolution.errorCode)) {
      throw new TypeError('NCMEC retry error code is invalid');
    }
    if (!Number.isSafeInteger(resolution.nextAttemptAtMs) || resolution.nextAttemptAtMs < 0) {
      throw new TypeError('NCMEC retry next-attempt clock is invalid');
    }
  } else {
    throw new TypeError('NCMEC filing resolution kind is invalid');
  }
}

function cloneReport(record: NcmecReportRecord): NcmecReportRecord {
  return structuredClone(record);
}

/**
 * Durable queue store. Enqueue is IDEMPOTENT by `id` (a re-fired identical signal does not
 * create a duplicate). There is no delete: a record only advances status. `list` is newest-first.
 */
export interface NcmecReportQueueStore {
  enqueue(record: NcmecReportRecord): NcmecReportRecord | Promise<NcmecReportRecord>;
  get(id: string): (NcmecReportRecord | null) | Promise<NcmecReportRecord | null>;
  list(filter?: { status?: NcmecReportStatus; limit?: number }): NcmecReportRecord[] | Promise<NcmecReportRecord[]>;
  claimQueuedForExport(
    input: NcmecExportClaimInput,
  ): NcmecExportClaim[] | Promise<NcmecExportClaim[]>;
  completeExportClaims(
    input: NcmecExportCompletionInput,
  ): boolean | Promise<boolean>;
  /**
   * Claim queued, due (nextAttemptAt <= now) records for FILING under a fenced lease. This shares
   * the lease machinery with export but is a distinct verb: the worker files each claim once and
   * then commits a terminal filing resolution. A record already leased (by an export OR another
   * filing worker) whose lease has not expired is skipped.
   */
  claimQueuedForFiling(
    input: NcmecFilingClaimInput,
  ): NcmecFilingClaim[] | Promise<NcmecFilingClaim[]>;
  /**
   * Commit one filing outcome, fenced on (owner, fencingToken, live lease). `filed` transitions the
   * record to `filed` and stores the provider reference; `escalated` dead-letters it; `retry`
   * releases the lease and reschedules. Returns `lease_lost` when the fencing predicate refuses the
   * write (a stale worker after its lease was reclaimed), so a false `filed` can never land.
   */
  completeFiling(
    input: NcmecFilingCompletionInput,
  ): NcmecFilingCompletionResult | Promise<NcmecFilingCompletionResult>;
  counts(): NcmecQueueCounts | Promise<NcmecQueueCounts>;
}

/** In-memory queue store (tests, ephemeral runs). */
export class InMemoryNcmecReportQueueStore implements NcmecReportQueueStore {
  private readonly rows = new Map<string, NcmecReportRecord>();
  private readonly order: string[] = [];
  private readonly claims = new Map<string, {
    owner: string;
    expiresAtMs: number;
    fencingToken: number;
  }>();
  private readonly fencingTokens = new Map<string, number>();
  /** How many times a record has been claimed for filing (attempt cap lives in the worker). */
  private readonly filingAttempts = new Map<string, number>();
  /** Earliest ms at which a record may be re-claimed for filing (transient backoff). */
  private readonly nextAttemptAtMs = new Map<string, number>();

  enqueue(record: NcmecReportRecord): NcmecReportRecord {
    validateNcmecReportRecord(record);
    const existing = this.rows.get(record.id);
    if (existing) return cloneReport(existing);
    this.rows.set(record.id, cloneReport(record));
    this.order.push(record.id);
    return cloneReport(record);
  }

  get(id: string): NcmecReportRecord | null {
    const row = this.rows.get(id);
    return row ? cloneReport(row) : null;
  }

  list(filter: { status?: NcmecReportStatus; limit?: number } = {}): NcmecReportRecord[] {
    const bound = Math.max(1, Math.min(1000, Math.floor(filter.limit ?? 200)));
    const out: NcmecReportRecord[] = [];
    for (let i = this.order.length - 1; i >= 0 && out.length < bound; i -= 1) {
      const row = this.rows.get(this.order[i]!);
      if (!row) continue;
      if (filter.status && row.status !== filter.status) continue;
      out.push(cloneReport(row));
    }
    return out;
  }

  claimQueuedForExport(input: NcmecExportClaimInput): NcmecExportClaim[] {
    validateExportClaimInput(input);
    const bound = Math.max(1, Math.min(1000, Math.floor(input.limit)));
    const claimed: NcmecExportClaim[] = [];
    for (const id of this.order) {
      if (claimed.length >= bound) break;
      const row = this.rows.get(id);
      if (!row || row.status !== 'queued') continue;
      const active = this.claims.get(id);
      if (active && active.expiresAtMs > input.nowMs) continue;
      const fencingToken = (this.fencingTokens.get(id) ?? 0) + 1;
      this.fencingTokens.set(id, fencingToken);
      this.claims.set(id, {
        owner: input.owner,
        expiresAtMs: input.nowMs + input.leaseMs,
        fencingToken,
      });
      claimed.push({ record: cloneReport(row), fencingToken });
    }
    return claimed;
  }

  completeExportClaims(input: NcmecExportCompletionInput): boolean {
    validateExportCompletionInput(input);
    for (const claim of input.claims) {
      const active = this.claims.get(claim.id);
      const row = this.rows.get(claim.id);
      if (!row || row.status !== 'queued' || !active
        || active.owner !== input.owner || active.fencingToken !== claim.fencingToken
        || active.expiresAtMs <= input.nowMs) {
        return false;
      }
    }
    for (const claim of input.claims) {
      const row = this.rows.get(claim.id)!;
      this.rows.set(claim.id, { ...row, status: input.status });
      this.claims.delete(claim.id);
    }
    return true;
  }

  claimQueuedForFiling(input: NcmecFilingClaimInput): NcmecFilingClaim[] {
    validateFilingClaimInput(input);
    const bound = Math.max(1, Math.min(1000, Math.floor(input.limit)));
    const claimed: NcmecFilingClaim[] = [];
    for (const id of this.order) {
      if (claimed.length >= bound) break;
      const row = this.rows.get(id);
      if (!row || row.status !== 'queued') continue;
      if ((this.nextAttemptAtMs.get(id) ?? 0) > input.nowMs) continue;
      const active = this.claims.get(id);
      if (active && active.expiresAtMs > input.nowMs) continue;
      const fencingToken = (this.fencingTokens.get(id) ?? 0) + 1;
      this.fencingTokens.set(id, fencingToken);
      this.claims.set(id, {
        owner: input.owner,
        expiresAtMs: input.nowMs + input.leaseMs,
        fencingToken,
      });
      const filingAttemptCount = (this.filingAttempts.get(id) ?? 0) + 1;
      this.filingAttempts.set(id, filingAttemptCount);
      const updated: NcmecReportRecord = { ...row, filingAttemptCount };
      this.rows.set(id, cloneReport(updated));
      claimed.push({ record: cloneReport(updated), fencingToken, filingAttemptCount });
    }
    return claimed;
  }

  completeFiling(input: NcmecFilingCompletionInput): NcmecFilingCompletionResult {
    validateFilingCompletionInput(input);
    const active = this.claims.get(input.id);
    const row = this.rows.get(input.id);
    if (!row || row.status !== 'queued' || !active
      || active.owner !== input.owner || active.fencingToken !== input.fencingToken
      || active.expiresAtMs <= input.nowMs) {
      return 'lease_lost';
    }
    const { resolution } = input;
    if (resolution.kind === 'filed') {
      const filedAt = new Date(input.nowMs).toISOString();
      this.rows.set(input.id, {
        ...row,
        status: 'filed',
        providerRef: resolution.providerRef,
        filedAt,
        lastFilingErrorCode: undefined,
      });
      this.claims.delete(input.id);
      this.nextAttemptAtMs.delete(input.id);
    } else if (resolution.kind === 'escalated') {
      this.rows.set(input.id, {
        ...row,
        status: 'escalated',
        lastFilingErrorCode: resolution.errorCode,
      });
      this.claims.delete(input.id);
      this.nextAttemptAtMs.delete(input.id);
    } else {
      // Transient: release the lease, record the error, reschedule; stays `queued`.
      this.rows.set(input.id, { ...row, lastFilingErrorCode: resolution.errorCode });
      this.claims.delete(input.id);
      this.nextAttemptAtMs.set(input.id, resolution.nextAttemptAtMs);
    }
    return 'committed';
  }

  counts(): NcmecQueueCounts {
    const counts: NcmecQueueCounts = { queued: 0, exported: 0, filed: 0, escalated: 0, total: 0 };
    for (const row of this.rows.values()) {
      counts[row.status] += 1;
      counts.total += 1;
    }
    return counts;
  }
}

/**
 * The outcome a filing client reports. `filed` carries the provider confirmation reference; a
 * failure is classified `permanent` (a validation defect the provider will always reject -> the
 * worker escalates to a durable dead-letter) or `transient` (a transport/provider-temporary error
 * -> the worker retries with jittered backoff up to the attempt cap). A client that is not wired
 * MUST report `transient` with reason `client_unavailable` so the record stays queued and NEVER
 * becomes a false `filed`.
 */
export type NcmecFilingOutcome =
  | { ok: true; providerRef: string }
  | { ok: false; classification: 'permanent' | 'transient'; reason: string };

/**
 * VENDOR SEAM. A real NCMEC filing integration (CyberTipline API) implements this; there is NO
 * real client in-repo (founder-ops, Plan 39 P15). Documented here so the wiring is honest and
 * a client can be dropped in without touching the queue. The default deployment binds
 * `UnavailableNcmecFilingClient`, so no record is ever marked filed until a real client is wired.
 */
export interface NcmecFilingClient {
  /** Honest capability posture for the ready log; the worker refuses to mark filed when 'unavailable'. */
  readonly state: 'configured' | 'unavailable';
  file(record: NcmecReportRecord): Promise<NcmecFilingOutcome>;
}

/**
 * The honest fail-closed default. It NEVER files: every attempt returns a `transient`
 * `client_unavailable` so the record stays queued and the worker can never fabricate a filed
 * confirmation. This is what an unconfigured deploy runs until CyberTipline onboarding lands.
 */
export class UnavailableNcmecFilingClient implements NcmecFilingClient {
  readonly state = 'unavailable' as const;

  file(): Promise<NcmecFilingOutcome> {
    return Promise.resolve({
      ok: false,
      classification: 'transient',
      reason: 'client_unavailable',
    });
  }
}

/**
 * A deterministic test/self-host double. Not a real provider: it confirms with a synthetic
 * reference derived from the evidence id, and can be scripted to fail permanently/transiently for
 * specific report ids or after a bounded number of attempts. Real CyberTipline filing is founder-ops.
 */
export class FakeNcmecFilingClient implements NcmecFilingClient {
  readonly state = 'configured' as const;
  private readonly permanentIds: Set<string>;
  private readonly transientIds: Set<string>;
  private readonly refPrefix: string;
  private readonly attempts = new Map<string, number>();
  private readonly transientUntilAttempt: number;

  constructor(options: {
    /** Report ids that always fail as a permanent validation defect. */
    permanentIds?: readonly string[];
    /** Report ids that always fail transiently (provider temporarily unavailable). */
    transientIds?: readonly string[];
    /** Fail transiently for the first N attempts of any id, then succeed (flaky-provider sim). */
    transientUntilAttempt?: number;
    refPrefix?: string;
  } = {}) {
    this.permanentIds = new Set(options.permanentIds ?? []);
    this.transientIds = new Set(options.transientIds ?? []);
    this.transientUntilAttempt = Math.max(0, Math.floor(options.transientUntilAttempt ?? 0));
    this.refPrefix = options.refPrefix ?? 'ct';
  }

  file(record: NcmecReportRecord): Promise<NcmecFilingOutcome> {
    const attempt = (this.attempts.get(record.id) ?? 0) + 1;
    this.attempts.set(record.id, attempt);
    if (this.permanentIds.has(record.id)) {
      return Promise.resolve({ ok: false, classification: 'permanent', reason: 'validation_rejected' });
    }
    if (this.transientIds.has(record.id) || attempt <= this.transientUntilAttempt) {
      return Promise.resolve({ ok: false, classification: 'transient', reason: 'provider_unavailable' });
    }
    return Promise.resolve({ ok: true, providerRef: `${this.refPrefix}-${record.id.slice(0, 32)}` });
  }
}

function evidenceId(parts: {
  source: NcmecReportSource;
  publicationId: string;
  postId?: string;
  reportKey?: string;
  matchedBlobHashes?: readonly string[];
}): string {
  const canonical = JSON.stringify([
    'meerkat-ncmec-report-v1',
    parts.source,
    parts.publicationId,
    parts.postId ?? '',
    parts.reportKey ?? '',
    [...(parts.matchedBlobHashes ?? [])].map((h) => h.toLowerCase()).sort(),
  ]);
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/**
 * Coordinates enqueue + export over a NcmecReportQueueStore. Two enqueue entry points -- one for
 * the submit-boundary scan hit, one for an operator actioning a csam report -- both idempotent.
 */
export class NcmecReportQueue {
  private readonly store: NcmecReportQueueStore;
  private readonly now: () => number;
  private readonly exporterId: string;
  private readonly exportLeaseMs: number;

  constructor(store: NcmecReportQueueStore, options: {
    now?: () => number;
    exporterId?: string;
    exportLeaseMs?: number;
  } = {}) {
    this.store = store;
    this.now = options.now ?? (() => Date.now());
    this.exporterId = options.exporterId ?? `ncmec-export-${randomUUID()}`;
    this.exportLeaseMs = options.exportLeaseMs ?? 5 * 60 * 1000;
  }

  private nowIso(): string {
    return new Date(this.now()).toISOString();
  }

  /** A submit-boundary abuse-hash match: refuse the post AND file it here (fail-closed). */
  async enqueueScanHit(input: {
    publicationId: string;
    channelId?: string;
    postId?: string;
    personaPubkey?: string;
    matchedBlobHashes: readonly string[];
    reason?: string;
  }): Promise<NcmecReportRecord> {
    if (input.matchedBlobHashes.length > NCMEC_MAX_EVIDENCE_HASHES) {
      throw new TypeError('NCMEC evidence hashes exceed the count limit');
    }
    const id = evidenceId({
      source: 'submit_scan',
      publicationId: input.publicationId,
      postId: input.postId,
      matchedBlobHashes: input.matchedBlobHashes,
    });
    return this.store.enqueue({
      id,
      source: 'submit_scan',
      detectedAt: this.nowIso(),
      publicationId: input.publicationId,
      ...(input.channelId ? { channelId: input.channelId } : {}),
      ...(input.postId ? { postId: input.postId } : {}),
      ...(input.personaPubkey ? { personaPubkey: input.personaPubkey } : {}),
      matchedBlobHashes: [...input.matchedBlobHashes].map((h) => h.toLowerCase()),
      reason: input.reason ?? 'abuse_hash_match',
      status: 'queued',
    });
  }

  /** An operator actioning a csam-flagged report: file the evidence references here. */
  async enqueueOperatorReport(input: {
    reportKey: string;
    publicationId: string;
    postId?: string;
    personaPubkey?: string;
    reason?: string;
  }): Promise<NcmecReportRecord> {
    if (!NCMEC_HASH.test(input.reportKey)) throw new TypeError('NCMEC report key is invalid');
    const id = evidenceId({
      source: 'operator_report',
      publicationId: input.publicationId,
      postId: input.postId,
      reportKey: input.reportKey,
    });
    return this.store.enqueue({
      id,
      source: 'operator_report',
      detectedAt: this.nowIso(),
      publicationId: input.publicationId,
      ...(input.postId ? { postId: input.postId } : {}),
      ...(input.personaPubkey ? { personaPubkey: input.personaPubkey } : {}),
      reportKey: input.reportKey,
      reason: input.reason ?? 'csam',
      status: 'queued',
    });
  }

  async counts(): Promise<NcmecQueueCounts> {
    return this.store.counts();
  }

  async list(filter?: { status?: NcmecReportStatus; limit?: number }): Promise<NcmecReportRecord[]> {
    return this.store.list(filter);
  }

  /**
   * Export queued records as NDJSON for the founder's MANUAL NCMEC filing (until the vendor
   * client lands). Marks each exported record `exported` so the next export does not re-emit it;
   * pass `markExported: false` for a dry read. Never marks `filed` (only a real vendor client
   * can honestly do that).
   */
  async exportQueued(options: { markExported?: boolean; limit?: number } = {}): Promise<{ ndjson: string; records: NcmecReportRecord[] }> {
    const limit = Math.max(1, Math.min(1000, Math.floor(options.limit ?? 1000)));
    if (options.markExported === false) {
      const records = await this.store.list({ status: 'queued', limit });
      return { ndjson: records.map((record) => JSON.stringify(record)).join('\n'), records };
    }

    const claims = await this.store.claimQueuedForExport({
      owner: this.exporterId,
      limit,
      leaseMs: this.exportLeaseMs,
      nowMs: this.now(),
    });
    const records = claims.map((claim) => claim.record);
    const ndjson = records.map((r) => JSON.stringify(r)).join('\n');
    if (claims.length > 0) {
      const completed = await this.store.completeExportClaims({
        owner: this.exporterId,
        claims: claims.map((claim) => ({
          id: claim.record.id,
          fencingToken: claim.fencingToken,
        })),
        status: 'exported',
        nowMs: this.now(),
      });
      if (!completed) throw new Error('NCMEC export claim was lost before completion');
    }
    return { ndjson, records };
  }
}
