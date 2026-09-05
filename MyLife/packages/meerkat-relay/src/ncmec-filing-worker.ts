/**
 * NCMEC filing worker (Plan 43 WP-43C).
 *
 * The pure core that drives a `queued` CSAM report record to a confirmed `filed` state through the
 * NcmecFilingClient seam -- or, on a permanent validation defect, to a durable `escalated`
 * dead-letter. It claims due queued records under the NCMEC queue store's FENCED lease
 * (claimQueuedForFiling), validates the required evidence fields, files ONCE through the client,
 * and commits the terminal resolution with the store's fenced completeFiling.
 *
 * Honesty + fail-closed (NC-43.5, plan Failure Modes):
 *  - A record is marked `filed` ONLY on a real provider confirmation carrying a provider reference.
 *    The default client is `UnavailableNcmecFilingClient`, which always reports a `transient`
 *    `client_unavailable`, so an unconfigured deploy leaves records `queued` forever and NEVER
 *    fabricates a filed confirmation.
 *  - A PERMANENT validation failure (bad/missing evidence the provider will always reject) routes
 *    the record to `escalated` -- a durable, operator-visible dead-letter -- never a silent drop
 *    and never a false `filed`.
 *  - A TRANSIENT failure (transport/provider-temporary) reschedules the record with JITTERED
 *    backoff. After a bounded attempt cap it escalates rather than retrying forever.
 *  - The filing call is idempotent per record: the store's evidence id IS the idempotency key, and
 *    a record only leaves `queued` on a committed terminal resolution.
 *
 * A stale worker whose lease was reclaimed cannot commit: completeFiling is fenced on
 * (owner, fencingToken, live lease), so a fenced double-claim yields exactly one filer.
 */

import { randomUUID } from 'node:crypto';
import type {
  NcmecFilingClaim,
  NcmecFilingClient,
  NcmecFilingResolution,
  NcmecReportQueueStore,
  NcmecReportRecord,
} from './ncmec-queue';

const SAFE_OWNER = /^[A-Za-z0-9_.:@/-]{1,256}$/u;
const NCMEC_HASH = /^[a-f0-9]{64}$/u;
const DEFAULT_LEASE_MS = 5 * 60 * 1000;
const DEFAULT_CLAIM_LIMIT = 8;
const DEFAULT_BASE_RETRY_MS = 60 * 1000;
const DEFAULT_MAX_RETRY_MS = 60 * 60 * 1000;
const DEFAULT_MAX_ATTEMPTS = 8;

export interface NcmecFilingWorkerOptions {
  /** Stable worker id used as the fenced lease owner. Must match the owner pattern. */
  workerId: string;
  store: NcmecReportQueueStore;
  /** The vendor seam. Defaults to the honest UnavailableNcmecFilingClient when omitted. */
  client: NcmecFilingClient;
  /** Max records claimed per tick. Defaults to 8. */
  claimLimit?: number;
  /** Lease duration for a claimed filing. Defaults to 5 minutes. */
  leaseMs?: number;
  /** Base backoff for the first transient retry. Defaults to 60 seconds. */
  baseRetryMs?: number;
  /** Ceiling for the exponential retry backoff. Defaults to 1 hour. */
  maxRetryMs?: number;
  /** Attempt cap before a persistently transient record escalates. Defaults to 8. */
  maxAttempts?: number;
  now?: () => number;
  /** Deterministic jitter source in [0,1). Defaults to Math.random. Injected for tests. */
  random?: () => number;
}

export type NcmecFilingDecision = 'filed' | 'escalated' | 'retry_scheduled' | 'lease_lost';

export interface NcmecFilingOutcomeRecord {
  id: string;
  decision: NcmecFilingDecision;
  /** The error/reason code recorded on escalate/retry, or the provider ref on filed. */
  detail?: string;
}

export interface NcmecFilingTickResult {
  claimed: number;
  outcomes: NcmecFilingOutcomeRecord[];
}

/**
 * The required evidence a report must carry before the worker attempts a filing. A record missing
 * these is a PERMANENT defect (the provider will always reject it): escalate, never file. This
 * mirrors the queue's own record invariants; it is a defensive gate at the filing boundary so a
 * corrupt or legacy row can never be presented to the provider as a valid report.
 */
function evidenceDefect(record: NcmecReportRecord): string | null {
  if (!NCMEC_HASH.test(record.id)) return 'invalid_evidence_id';
  if (record.source !== 'submit_scan' && record.source !== 'operator_report') {
    return 'invalid_source';
  }
  if (!record.publicationId || record.publicationId.length > 512) return 'missing_publication_id';
  if (!record.reason || record.reason.length > 512) return 'missing_reason';
  if (record.source === 'submit_scan') {
    const hashes = record.matchedBlobHashes ?? [];
    if (hashes.length === 0 || hashes.some((hash) => !NCMEC_HASH.test(hash))) {
      return 'missing_matched_hashes';
    }
  }
  if (record.source === 'operator_report' && !NCMEC_HASH.test(record.reportKey ?? '')) {
    return 'missing_report_key';
  }
  return null;
}

export class NcmecFilingWorker {
  private readonly workerId: string;
  private readonly store: NcmecReportQueueStore;
  private readonly client: NcmecFilingClient;
  private readonly claimLimit: number;
  private readonly leaseMs: number;
  private readonly baseRetryMs: number;
  private readonly maxRetryMs: number;
  private readonly maxAttempts: number;
  private readonly now: () => number;
  private readonly random: () => number;

  constructor(options: NcmecFilingWorkerOptions) {
    if (!SAFE_OWNER.test(options.workerId)) throw new TypeError('NCMEC filing worker id is invalid');
    this.workerId = options.workerId;
    this.store = options.store;
    this.client = options.client;
    this.claimLimit = options.claimLimit ?? DEFAULT_CLAIM_LIMIT;
    this.leaseMs = options.leaseMs ?? DEFAULT_LEASE_MS;
    this.baseRetryMs = options.baseRetryMs ?? DEFAULT_BASE_RETRY_MS;
    this.maxRetryMs = options.maxRetryMs ?? DEFAULT_MAX_RETRY_MS;
    this.maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.now = options.now ?? (() => Date.now());
    this.random = options.random ?? Math.random;
  }

  /** Honest posture for the ready log: filing works only with a real client wired. */
  readinessState(): 'ready' | 'fail_closed' {
    return this.client.state === 'configured' ? 'ready' : 'fail_closed';
  }

  /** Claim and file one batch of due queued records. Returns each record's committed decision. */
  async runOnce(): Promise<NcmecFilingTickResult> {
    const claims = await this.store.claimQueuedForFiling({
      owner: this.workerId,
      limit: this.claimLimit,
      leaseMs: this.leaseMs,
      nowMs: this.now(),
    });
    const outcomes: NcmecFilingOutcomeRecord[] = [];
    for (const claim of claims) {
      outcomes.push(await this.fileClaim(claim));
    }
    return { claimed: claims.length, outcomes };
  }

  private async fileClaim(claim: NcmecFilingClaim): Promise<NcmecFilingOutcomeRecord> {
    const { record, fencingToken, filingAttemptCount } = claim;

    // Permanent evidence defect: escalate without ever presenting a malformed report to the provider.
    const defect = evidenceDefect(record);
    if (defect) {
      return this.commit(record.id, fencingToken, { kind: 'escalated', errorCode: defect });
    }

    let resolution: NcmecFilingResolution;
    try {
      const outcome = await this.client.file(record);
      if (outcome.ok) {
        resolution = { kind: 'filed', providerRef: outcome.providerRef };
      } else if (outcome.classification === 'permanent') {
        resolution = { kind: 'escalated', errorCode: sanitizeCode(outcome.reason) };
      } else {
        resolution = this.transientResolution(filingAttemptCount, sanitizeCode(outcome.reason));
      }
    } catch (error) {
      // A thrown client is treated as transient (unknown provider/transport fault): retry, then
      // escalate at the cap. It can never mark filed.
      resolution = this.transientResolution(filingAttemptCount, 'client_threw');
      void error;
    }
    return this.commit(record.id, fencingToken, resolution);
  }

  /** Decide retry-vs-escalate for a transient failure, applying the attempt cap and jitter. */
  private transientResolution(attemptCount: number, errorCode: string): NcmecFilingResolution {
    if (attemptCount >= this.maxAttempts) {
      return { kind: 'escalated', errorCode: `retry_cap_${errorCode}`.slice(0, 128) };
    }
    return {
      kind: 'retry',
      errorCode,
      nextAttemptAtMs: this.now() + this.backoffMs(attemptCount),
    };
  }

  /** Exponential backoff (base * 2^(attempt-1)) capped, with up to +/-50% jitter. */
  private backoffMs(attemptCount: number): number {
    const exponent = Math.max(0, attemptCount - 1);
    const raw = this.baseRetryMs * 2 ** exponent;
    const capped = Math.min(this.maxRetryMs, raw);
    const jitter = capped * 0.5 * (this.random() * 2 - 1);
    return Math.max(1, Math.round(capped + jitter));
  }

  private async commit(
    id: string,
    fencingToken: number,
    resolution: NcmecFilingResolution,
  ): Promise<NcmecFilingOutcomeRecord> {
    const result = await this.store.completeFiling({
      owner: this.workerId,
      id,
      fencingToken,
      resolution,
      nowMs: this.now(),
    });
    if (result === 'lease_lost') return { id, decision: 'lease_lost' };
    if (resolution.kind === 'filed') return { id, decision: 'filed', detail: resolution.providerRef };
    if (resolution.kind === 'escalated') return { id, decision: 'escalated', detail: resolution.errorCode };
    return { id, decision: 'retry_scheduled', detail: resolution.errorCode };
  }
}

function sanitizeCode(reason: string): string {
  const normalized = reason.trim().toLowerCase().replace(/[^a-z0-9_.:-]/gu, '_').slice(0, 128);
  return normalized.length > 0 ? normalized : 'unknown';
}

/** A stable default worker id (host-scoped) when a caller does not pin one. */
export function defaultNcmecFilingWorkerId(): string {
  return `ncmec-filer-${randomUUID()}`;
}
