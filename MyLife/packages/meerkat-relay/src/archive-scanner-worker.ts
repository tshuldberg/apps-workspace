/**
 * Managed archive scanner worker (Plan 43 WP-43A).
 *
 * The pure core that turns a QUARANTINED archive job into a durable scan DECISION. It claims
 * quarantined jobs under the archive lifecycle store's FENCED lease (claimJobs moves them to
 * `scanning`), reads each object's quarantined bytes, runs BOTH real scan rails -- the malware/AV
 * seam (archive-malware-scan.ts) and the abuse-hash seam (abuse-scan.ts) -- and records the decision
 * with the store's fenced completeScan. The lifecycle store is the durable moderation store: its
 * archive.scans row + the scanning->clean/rejected/error transition under a fencing token IS the
 * moderation decision, and its activatePin already refuses to pin without a committed clean scan.
 *
 * Honesty + fail-closed (NC-43.1, NC-43.2):
 *  - A clean malware verdict AND a clean abuse-hash result => `clean` => the job becomes `approved`
 *    (the only path to a pin). A malware hit => `malware`; an abuse-hash hit => `abuse_hash_match`
 *    (and the evidence is enqueued to the NCMEC queue). Either rejects the job (never served).
 *  - ANY scanner outage -- an unconfigured/unreachable malware scanner, an unavailable abuse-hash
 *    scanner, or a missing/short quarantine read -- yields an `error` scan result: the job stays
 *    `quarantined` and retries after a bounded backoff. It can NEVER advance to approved on an
 *    outage. Nothing unscanned or non-clean is ever pinnable.
 *
 * A stale worker whose lease was reclaimed cannot commit: completeScan is fenced on (jobId,
 * workerId, fencingToken, live lease), so a second worker that re-claims the same job is the only
 * one whose decision lands (fenced double-claim yields one decider).
 */

import { randomUUID } from 'node:crypto';
import type { AbuseHashScanner } from './abuse-scan';
import type {
  ArchiveJobClaim,
  ArchiveLifecycleStore,
  ArchiveObjectRecord,
  ArchiveScanResult,
} from './archive-lifecycle';
import type { MalwareScanner } from './archive-malware-scan';
import type { NcmecReportQueue } from './ncmec-queue';

const SAFE_ID = /^[A-Za-z0-9_.:@/-]{1,512}$/u;
const DEFAULT_LEASE_MS = 5 * 60 * 1000;
const DEFAULT_RETRY_MS = 60 * 1000;
const DEFAULT_CLAIM_LIMIT = 8;
/** Per-object in-memory scan bound: an object above this is flagged, never loaded whole. */
const DEFAULT_MAX_SCAN_OBJECT_BYTES = 128 * 1024 * 1024;

/**
 * Reads the quarantined bytes for one object key. Backed in production by the object store's
 * read(quarantineKey) path; a fake supplies bytes in tests. Returns null when the bytes are absent
 * (the worker treats absence as a fail-closed scanner error, never a clean).
 */
export type QuarantineByteSource = (input: {
  quarantineKey: string;
  objectHashSha256: string;
  objectBytes: number;
}) => Promise<Uint8Array | null>;

export interface ArchiveScannerWorkerOptions {
  /** Stable worker id used as the lease owner. Must match the archive SAFE_ID pattern. */
  workerId: string;
  store: ArchiveLifecycleStore;
  malwareScanner: MalwareScanner;
  abuseScanner: AbuseHashScanner;
  readQuarantineBytes: QuarantineByteSource;
  /** Optional CSAM report queue; an abuse-hash hit is enqueued here (fail-closed evidence). */
  ncmecQueue?: NcmecReportQueue;
  /** Max jobs claimed per tick. Defaults to 8. */
  claimLimit?: number;
  /** Lease duration for a claimed scan. Defaults to 5 minutes. */
  leaseMs?: number;
  /** Backoff before a fail-closed job is re-claimable. Defaults to 60 seconds. */
  retryMs?: number;
  /**
   * Per-object scan-memory bound. An object whose recorded size exceeds this is never read into
   * memory; the job is terminally `flagged` (object_exceeds_scan_cap) for operator review instead
   * of an unbounded read or an infinite error-retry loop. Defaults to 128 MiB.
   */
  maxScanObjectBytes?: number;
  now?: () => number;
}

export type ArchiveScanOutcome =
  | { jobId: string; decision: ArchiveScanResult }
  | { jobId: string; decision: 'lease_lost' };

export interface ArchiveScannerTickResult {
  claimed: number;
  outcomes: ArchiveScanOutcome[];
}

interface JobScanVerdict {
  result: ArchiveScanResult;
  resultCode: string | null;
  evidence: Record<string, unknown>;
  /** Matched abuse-hash blob hashes to enqueue to NCMEC, when the result is abuse_hash_match. */
  abuseMatches: string[];
}

export class ArchiveScannerWorker {
  private readonly workerId: string;
  private readonly store: ArchiveLifecycleStore;
  private readonly malwareScanner: MalwareScanner;
  private readonly abuseScanner: AbuseHashScanner;
  private readonly readQuarantineBytes: QuarantineByteSource;
  private readonly ncmecQueue?: NcmecReportQueue;
  private readonly claimLimit: number;
  private readonly leaseMs: number;
  private readonly retryMs: number;
  private readonly maxScanObjectBytes: number;
  private readonly now: () => number;

  constructor(options: ArchiveScannerWorkerOptions) {
    if (!SAFE_ID.test(options.workerId)) throw new TypeError('archive scanner worker id is invalid');
    this.workerId = options.workerId;
    this.store = options.store;
    this.malwareScanner = options.malwareScanner;
    this.abuseScanner = options.abuseScanner;
    this.readQuarantineBytes = options.readQuarantineBytes;
    this.ncmecQueue = options.ncmecQueue;
    this.claimLimit = options.claimLimit ?? DEFAULT_CLAIM_LIMIT;
    this.leaseMs = options.leaseMs ?? DEFAULT_LEASE_MS;
    this.retryMs = options.retryMs ?? DEFAULT_RETRY_MS;
    this.maxScanObjectBytes = options.maxScanObjectBytes ?? DEFAULT_MAX_SCAN_OBJECT_BYTES;
    this.now = options.now ?? (() => Date.now());
  }

  /** Honest posture for the ready log: the worker fails closed unless BOTH rails are configured. */
  readinessState(): 'ready' | 'fail_closed' {
    return this.malwareScanner.state === 'configured' ? 'ready' : 'fail_closed';
  }

  /**
   * Claim and decide one batch of jobs. Returns each job's committed decision. Eligible are
   * quarantined jobs AND `scanning` jobs whose lease has expired: a worker that crashed after
   * claiming but before its fenced completeScan leaves the job in `scanning`, and without the
   * reclaim the job would strand there forever, fail-closed but never re-scanned. claimJobs only
   * hands out unleased or expired-lease rows, so a live scan is never double-claimed.
   */
  async runOnce(): Promise<ArchiveScannerTickResult> {
    const nowMs = this.now();
    const claims = await this.store.claimJobs({
      workerId: this.workerId,
      eligibleStatuses: ['quarantined', 'scanning'],
      limit: this.claimLimit,
      leaseMs: this.leaseMs,
      nowMs,
    });
    const outcomes: ArchiveScanOutcome[] = [];
    for (const claim of claims) {
      outcomes.push(await this.scanClaim(claim));
    }
    return { claimed: claims.length, outcomes };
  }

  private async scanClaim(claim: ArchiveJobClaim): Promise<ArchiveScanOutcome> {
    const { job, fencingToken } = claim;
    const startedAt = new Date(this.now()).toISOString();
    const verdict = await this.decide(job.jobId);
    // The NCMEC evidence lands BEFORE the terminal reject commit: a rejected job is never
    // re-claimed, so a crash in the old commit-then-enqueue window silently dropped the mandated
    // CSAM report forever. Enqueue-first is safe because the evidence id is derived from the
    // (source, publication, hashes) tuple - a re-scan after a crash, or a lease-lost racer, writes
    // the SAME row idempotently, never a duplicate. A crash after enqueue but before the commit
    // re-scans and re-enqueues the same id; the report survives every window.
    if (verdict.result === 'abuse_hash_match' && verdict.abuseMatches.length > 0 && this.ncmecQueue) {
      await this.ncmecQueue.enqueueScanHit({
        publicationId: job.publicationId,
        matchedBlobHashes: verdict.abuseMatches,
        reason: 'abuse_hash_match',
      });
    }
    const completedAt = new Date(this.now()).toISOString();
    const nowMs = this.now();
    const committed = await this.store.completeScan({
      jobId: job.jobId,
      workerId: this.workerId,
      fencingToken,
      nowMs,
      scanId: randomUUID(),
      engine: this.malwareScanner.engine.engine,
      engineVersion: this.malwareScanner.engine.engineVersion,
      definitionsVersion: this.malwareScanner.engine.definitionsVersion,
      result: verdict.result,
      resultCode: verdict.resultCode,
      evidence: verdict.evidence,
      startedAt,
      completedAt,
      ...(verdict.result === 'error' ? { retryAtMs: nowMs + this.retryMs } : {}),
    });
    if (!committed) return { jobId: job.jobId, decision: 'lease_lost' };
    return { jobId: job.jobId, decision: verdict.result };
  }

  /**
   * Run both scan rails over every quarantined object of the job and reduce to one verdict.
   * Precedence: a malware hit rejects first; then an abuse-hash hit rejects (with NCMEC evidence);
   * a scanner outage fails closed to `error`; only an all-clean scan returns `clean`.
   */
  private async decide(jobId: string): Promise<JobScanVerdict> {
    let objects: ArchiveObjectRecord[];
    try {
      objects = await this.store.listObjects(jobId);
    } catch (error) {
      return errorVerdict('object_list_unavailable', error);
    }
    const scannable = objects.filter((object) => object.metadataStatus === 'verified'
      && (object.status === 'quarantined' || object.status === 'verified'));
    const abuseMatches = new Set<string>();
    let malwareHit: { objectIndex: number; signatureId: string | null } | null = null;

    for (const object of scannable) {
      // Scan-memory bound: an object above the cap is never loaded whole. Terminal `flagged`
      // (operator review), not `error`: an over-cap object can never pass on retry, so an error
      // verdict would loop forever while the job pretends to be pending.
      if (object.objectBytes > this.maxScanObjectBytes) {
        return {
          result: 'flagged',
          resultCode: 'object_exceeds_scan_cap',
          evidence: {
            rail: 'policy',
            objectIndex: object.objectIndex,
            objectBytes: object.objectBytes,
            maxScanObjectBytes: this.maxScanObjectBytes,
          },
          abuseMatches: [],
        };
      }
      let bytes: Uint8Array | null;
      try {
        bytes = await this.readQuarantineBytes({
          quarantineKey: object.quarantineKey,
          objectHashSha256: object.objectHash,
          objectBytes: object.objectBytes,
        });
      } catch (error) {
        return errorVerdict('quarantine_read_unavailable', error);
      }
      if (!bytes) {
        return errorVerdict('quarantine_bytes_missing');
      }
      if (bytes.length !== object.objectBytes) {
        // A present-but-wrong-length read is a tamper/corruption signal, not an absence.
        return errorVerdict('quarantine_bytes_mismatch');
      }

      // Malware/AV rail. A rejection is a genuine outage => fail closed.
      try {
        const malware = await this.malwareScanner.scan({
          jobId,
          objectIndex: object.objectIndex,
          objectHashSha256: object.objectHash,
          bytes,
        });
        if (malware.verdict === 'malware' && !malwareHit) {
          malwareHit = { objectIndex: object.objectIndex, signatureId: malware.signatureId };
        }
      } catch (error) {
        return errorVerdict('malware_scanner_unavailable', error);
      }

      // Abuse-hash rail. A rejection (throw) is a genuine outage => fail closed.
      try {
        const abuse = await this.abuseScanner.scan([object.objectHash]);
        for (const hash of abuse.matched) abuseMatches.add(hash.toLowerCase());
      } catch (error) {
        return errorVerdict('abuse_scanner_unavailable', error);
      }
    }

    // An unconfigured malware scanner reports itself not_configured but is still called above; the
    // UnavailableMalwareScanner throws, so control never reaches here with an unconfigured engine
    // on a job that has scannable objects. A zero-object job (expectedBytes 0) still must not pass
    // an unconfigured rail: refuse it fail-closed.
    if (scannable.length === 0 && this.malwareScanner.state !== 'configured') {
      return errorVerdict('malware_scanner_not_configured');
    }

    if (malwareHit) {
      return {
        result: 'malware',
        resultCode: 'malware',
        evidence: {
          rail: 'malware',
          objectIndex: malwareHit.objectIndex,
          ...(malwareHit.signatureId ? { signatureId: malwareHit.signatureId } : {}),
        },
        abuseMatches: [],
      };
    }
    if (abuseMatches.size > 0) {
      const matched = [...abuseMatches].sort();
      return {
        result: 'abuse_hash_match',
        resultCode: 'abuse_hash_match',
        evidence: { rail: 'abuse_hash', matchedCount: matched.length },
        abuseMatches: matched,
      };
    }
    return { result: 'clean', resultCode: null, evidence: { rail: 'clean' }, abuseMatches: [] };
  }
}

function errorVerdict(resultCode: string, cause?: unknown): JobScanVerdict {
  const evidence: Record<string, unknown> = { rail: 'error', code: resultCode };
  if (cause instanceof Error && cause.message) evidence.detail = cause.message.slice(0, 200);
  return { result: 'error', resultCode, evidence, abuseMatches: [] };
}
