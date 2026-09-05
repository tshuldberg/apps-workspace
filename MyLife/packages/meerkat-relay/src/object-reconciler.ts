/**
 * Inventory reconciliation over the MeerkatObjectStore boundary (Plan 44 WP-2C).
 *
 * The object store and the reference ledger can disagree after a crash. The file
 * adapter's crash model (object-store-file.ts header) is explicit about the ONE shape
 * of residue it can leave: an orphan byte object with no ledger row, never a ledger row
 * pointing at missing bytes. Reconciliation is the bounded, resumable scan that closes
 * the gap between what the object store physically holds and what the reference ledger
 * says is referenced. It is deliberately NOT a repair tool: it quarantines or sweeps
 * orphans it is sure about, and for everything else it emits an explicit typed FINDING
 * that a human or a higher layer resolves. It never auto-repairs drift and never serves
 * a referenced-but-missing object (Plan 44 failure-modes table).
 *
 * Outcome taxonomy (one per inventory entry examined):
 *  - `orphan_quarantined`   a durable/quarantined store object with ZERO ledger
 *                           references, older than the grace window (so it is not an
 *                           in-flight write-ahead upload), that was still `durable`:
 *                           enqueued for deletion via the deletion queue. A durable
 *                           object with no reference is deletion-eligible; a quarantined
 *                           one is left to its own promote/expire path unless already
 *                           past the retention window.
 *  - `orphan_swept`         a `quarantined` orphan already older than the RETENTION
 *                           window (never promoted, never referenced): deleted directly.
 *  - `in_grace`             an unreferenced object younger than the grace window: LEFT
 *                           ALONE this run (it may be an upload whose reference has not
 *                           been recorded yet). Not a finding, just skipped.
 *  - `referenced_missing`   a referenced ledger key whose store object is ABSENT: an
 *                           explicit finding. Callers surface this as an exact
 *                           unavailable state; never served, never silently skipped.
 *  - `drift`                a referenced object whose store checksum or size does not
 *                           match what the reference expected: an explicit finding.
 *                           NEVER auto-repaired.
 *  - `healthy`              a referenced object present with matching observation.
 *
 * A run holds a FENCED operations-store lease for its whole duration (the same lease
 * primitive push/archive workers use) so two reconcilers never scan the same store
 * concurrently, and it persists its inventory cursor under that lease so a crashed run
 * resumes where it stopped. Each run is bounded (maxEntries) and returns its findings
 * plus the cursor to resume from.
 */

import {
  ObjectStoreUnavailableError,
  type MeerkatObjectStore,
  type ObjectInventoryCursor,
  type ObjectInventoryEntry,
} from './object-store';
import type { ObjectReferenceLedger } from './object-reference-ledger';
import type { ObjectDeletionJobStore } from './object-deletion-jobs';

/** What the reference ledger asserted about a key, for the drift check. */
export interface ReferencedExpectation {
  checksumSha256: string;
  sizeBytes: number;
}

/**
 * The reconciler needs the referenced object's expected content address to detect
 * drift. The reference ledger tracks WHICH keys are referenced; the metadata plane
 * that recorded the reference knows the expected checksum/size. This resolver bridges
 * the two: given a referenced key, return the expectation, or null if the plane cannot
 * vouch for it (in which case drift is not checked, only presence).
 */
export type ReferencedExpectationResolver =
  (objectKey: string) => Promise<ReferencedExpectation | null>;

export type ReconcileOutcome =
  | 'orphan_quarantined'
  | 'orphan_swept'
  | 'in_grace'
  | 'referenced_missing'
  | 'drift'
  | 'healthy';

/** One inventory entry's reconciliation result. Findings are the non-`healthy`/non-`in_grace` ones. */
export interface ReconcileFinding {
  objectKey: string;
  outcome: ReconcileOutcome;
  state: ObjectInventoryEntry['state'];
  detail: Record<string, unknown>;
}

export interface ReconcileRunInput {
  /** Resume from this cursor; omit to start from the beginning of the inventory. */
  after?: ObjectInventoryCursor;
  /** Max inventory entries examined this run (bounded). */
  maxEntries: number;
  /** Inventory page size; each store page is at most this many entries. */
  pageSize: number;
  /** Unreferenced store objects younger than this are left alone (in-flight uploads). */
  graceWindowMs: number;
  /** Quarantined orphans older than this are swept outright. */
  retentionWindowMs: number;
  nowMs: number;
}

export interface ReconcileRunResult {
  findings: ReconcileFinding[];
  entriesScanned: number;
  /** Cursor to resume from, or null when the inventory was fully scanned this run. */
  nextCursor: ObjectInventoryCursor | null;
  outcomeCounts: Record<ReconcileOutcome, number>;
}

/** Records the wall-clock instant a store object was first observed unreferenced. */
export interface OrphanFirstSeenStore {
  /** Returns the ms epoch the key was first seen unreferenced, recording now if new. */
  firstSeen(objectKey: string, nowMs: number): Promise<number>;
  /** Drops the first-seen marker once a key is no longer an orphan (referenced or gone). */
  clear(objectKey: string): Promise<void>;
}

function emptyOutcomeCounts(): Record<ReconcileOutcome, number> {
  return {
    orphan_quarantined: 0,
    orphan_swept: 0,
    in_grace: 0,
    referenced_missing: 0,
    drift: 0,
    healthy: 0,
  };
}

function assertPositiveInteger(name: string, value: number, max: number): void {
  if (!Number.isSafeInteger(value) || value < 1 || value > max) {
    throw new TypeError(`${name} must be an integer between 1 and ${max}`);
  }
}

function assertNonNegativeInteger(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${name} must be a non-negative integer`);
  }
}

const MAX_RUN_ENTRIES = 100_000;
const MAX_PAGE_SIZE = 1_000;
const MAX_WINDOW_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Reconciles one bounded slice of the object store against the reference ledger. The
 * caller is responsible for holding the fenced lease across a run and persisting the
 * returned cursor under it; `ObjectReconciler.run` does the scan, and the leased driver
 * (below) wraps it in a lease + cursor persistence.
 */
export class ObjectReconciler {
  constructor(
    private readonly objectStore: MeerkatObjectStore,
    private readonly referenceLedger: ObjectReferenceLedger,
    private readonly deletionJobs: ObjectDeletionJobStore,
    private readonly orphanFirstSeen: OrphanFirstSeenStore,
    private readonly resolveExpectation: ReferencedExpectationResolver,
  ) {}

  async run(input: ReconcileRunInput): Promise<ReconcileRunResult> {
    assertPositiveInteger('maxEntries', input.maxEntries, MAX_RUN_ENTRIES);
    assertPositiveInteger('pageSize', input.pageSize, MAX_PAGE_SIZE);
    assertNonNegativeInteger('graceWindowMs', input.graceWindowMs);
    assertNonNegativeInteger('retentionWindowMs', input.retentionWindowMs);
    assertNonNegativeInteger('nowMs', input.nowMs);
    if (input.graceWindowMs > MAX_WINDOW_MS || input.retentionWindowMs > MAX_WINDOW_MS) {
      throw new TypeError('reconciliation windows exceed the maximum');
    }

    const findings: ReconcileFinding[] = [];
    const outcomeCounts = emptyOutcomeCounts();
    let cursor = input.after;
    let scanned = 0;

    while (scanned < input.maxEntries) {
      const remaining = input.maxEntries - scanned;
      const page = await this.objectStore.listInventory({
        after: cursor,
        limit: Math.min(input.pageSize, remaining),
      });
      for (const entry of page.entries) {
        const finding = await this.reconcileEntry(entry, input);
        outcomeCounts[finding.outcome] += 1;
        if (finding.outcome !== 'healthy' && finding.outcome !== 'in_grace') {
          findings.push(finding);
        }
        scanned += 1;
        cursor = { key: entry.key };
      }
      if (!page.nextCursor) {
        return { findings, entriesScanned: scanned, nextCursor: null, outcomeCounts };
      }
      cursor = page.nextCursor;
      if (page.entries.length === 0) break;
    }
    return { findings, entriesScanned: scanned, nextCursor: cursor ?? null, outcomeCounts };
  }

  private async reconcileEntry(
    entry: ObjectInventoryEntry,
    input: ReconcileRunInput,
  ): Promise<ReconcileFinding> {
    const referenced = await this.referenceLedger.isReferenced(entry.key);
    if (referenced) {
      // A referenced key must be present and match. Its bytes are live; never sweep it.
      await this.orphanFirstSeen.clear(entry.key);
      return this.reconcileReferenced(entry);
    }
    return this.reconcileOrphan(entry, input);
  }

  private async reconcileReferenced(entry: ObjectInventoryEntry): Promise<ReconcileFinding> {
    // The inventory entry IS a store observation, so presence is established. A
    // referenced-but-missing key is detected because it appears in the ledger yet not
    // in the store inventory; that path is covered by reconcileReferencedMissing, run
    // over the ledger's referenced set separately. Here we only drift-check present ones.
    const expectation = await this.resolveExpectation(entry.key);
    if (expectation
      && (expectation.checksumSha256 !== entry.checksumSha256
        || expectation.sizeBytes !== entry.sizeBytes)) {
      return {
        objectKey: entry.key,
        outcome: 'drift',
        state: entry.state,
        detail: {
          expectedChecksum: expectation.checksumSha256,
          storeChecksum: entry.checksumSha256,
          expectedSizeBytes: expectation.sizeBytes,
          storeSizeBytes: entry.sizeBytes,
        },
      };
    }
    return { objectKey: entry.key, outcome: 'healthy', state: entry.state, detail: {} };
  }

  private async reconcileOrphan(
    entry: ObjectInventoryEntry,
    input: ReconcileRunInput,
  ): Promise<ReconcileFinding> {
    const firstSeenMs = await this.orphanFirstSeen.firstSeen(entry.key, input.nowMs);
    const ageMs = input.nowMs - firstSeenMs;
    if (ageMs < input.graceWindowMs) {
      // Younger than the grace window: could be an upload whose reference has not landed.
      return { objectKey: entry.key, outcome: 'in_grace', state: entry.state, detail: { ageMs } };
    }
    if (entry.state === 'quarantined') {
      // A quarantined orphan past retention was never promoted and is unreferenced: sweep.
      if (ageMs >= input.retentionWindowMs) {
        await this.objectStore.deleteObject(entry.key);
        await this.orphanFirstSeen.clear(entry.key);
        return { objectKey: entry.key, outcome: 'orphan_swept', state: entry.state, detail: { ageMs } };
      }
      // Past grace but within retention: leave the quarantine key to its own lifecycle.
      return { objectKey: entry.key, outcome: 'in_grace', state: entry.state, detail: { ageMs } };
    }
    if (entry.state === 'rejected') {
      // A rejected row holds no servable bytes; sweep it once past grace.
      await this.objectStore.deleteObject(entry.key);
      await this.orphanFirstSeen.clear(entry.key);
      return { objectKey: entry.key, outcome: 'orphan_swept', state: entry.state, detail: { ageMs } };
    }
    // A durable orphan past the grace window is deletion-eligible: enqueue, do not delete
    // inline, so the fenced deletion queue owns the actual byte removal + audit.
    await this.deletionJobs.enqueue(entry.key, input.nowMs);
    return { objectKey: entry.key, outcome: 'orphan_quarantined', state: entry.state, detail: { ageMs } };
  }

  /**
   * Scans a bounded slice of the ledger's REFERENCED keys and flags any whose store
   * object is absent (`referenced_missing`). This is the mirror of the inventory scan:
   * the inventory scan finds store objects with no reference; this finds references with
   * no store object. Callers surface a `referenced_missing` finding as an exact
   * unavailable state and never serve it.
   */
  async findReferencedMissing(
    referencedKeys: readonly string[],
  ): Promise<ReconcileFinding[]> {
    const findings: ReconcileFinding[] = [];
    for (const key of referencedKeys) {
      const observation = await this.objectStore.observe(key);
      if (!observation) {
        findings.push({
          objectKey: key,
          outcome: 'referenced_missing',
          state: 'durable',
          detail: {},
        });
      }
    }
    return findings;
  }
}

/** Re-exported so callers can distinguish a scan fault from a reconciliation finding. */
export { ObjectStoreUnavailableError };
