/**
 * Durable pin reconciliation for the hosted seeder (Plan 43 WP-43B).
 *
 * A hosted seeder's SERVING state (what its web-seed actually hands out) and the durable pin
 * INTENT recorded in the archive lifecycle store (archive-lifecycle.ts) can disagree after a crash,
 * a partial takedown, or a missing durable object. This reconciler is the bounded, resumable scan
 * that closes that gap. It mirrors the WP-2C object reconciler exactly: a pure core (`run`) over a
 * cursor-paged slice of this host's pin records, wrapped by a leased driver (below) that holds a
 * FENCED operations-store lease for the whole run and persists the cursor under it, so two
 * reconcilers never scan the same host concurrently and a crashed run resumes where it stopped.
 *
 * It is deliberately NOT a blind repair tool. It repairs the two drifts it is sure about and
 * surfaces the one it must never silently paper over:
 *
 * Outcome taxonomy (one per pin record examined):
 *  - `serving_added`         an ACTIVE pin whose bytes ARE present but which the serving index was
 *                            not yet serving: added to the serving index (drift toward intent).
 *  - `serving_removed`       a non-active pin (`removing`/`removed`/`pinning`/`error`) that the
 *                            serving index was still serving: removed FIRST (never serve what intent
 *                            no longer says is active). This is the restart-safe takedown residue.
 *  - `pin_bytes_missing`     an ACTIVE pin whose durable bytes are ABSENT: an explicit FINDING. The
 *                            serving entry is removed (never serve missing bytes) and the drift is
 *                            surfaced for a human/higher layer. It is NEVER silently served and
 *                            NEVER auto-repaired by fabricating bytes.
 *  - `healthy`              an active pin whose bytes are present and already served: no change.
 *
 * Serving-index orphans (a served publication with NO pin record at all) are the mirror scan,
 * `findServingOrphans`, run over the serving index's own key set: anything served that the pin
 * store does not know about is removed. Together the two scans converge intent and serving state.
 */

import type { ArchivePinRecord, ArchivePinStore, ArchivePinCursor } from './archive-lifecycle';
import type { ReconcilerLease, ReconcilerLeaseProvider } from './object-reconciler-leased';

/**
 * The seeder's actual serving index: the set of publications this host currently hands out, keyed
 * by publicationId. Backed in production by the seeder node's pinned-content set; a fake in tests.
 * Every method is idempotent so a reconciler re-run replays cleanly.
 */
export interface PinServingIndex {
  /** True iff this host is currently serving `publicationId`. */
  isServing(publicationId: string): Promise<boolean>;
  /** Start serving `publicationId` (idempotent). Called only after bytes are confirmed present. */
  addServing(publicationId: string): Promise<void>;
  /** Stop serving `publicationId` (idempotent). Called BEFORE any byte deletion, never after. */
  removeServing(publicationId: string): Promise<void>;
  /** Every publicationId currently served, ascending, cursor-paged (never an unbounded list). */
  listServing(input: { after?: string; limit: number }): Promise<{
    publicationIds: string[];
    nextCursor: string | null;
  }>;
}

/**
 * Confirms whether the durable bytes behind an active pin are actually present and referenced.
 * Backed in production by the reference ledger + object store (the WP-2C liveness authority) over
 * the archive object keys for the publication's content; a fake in tests. True means every durable
 * object the publication needs is present; false means at least one is missing (a `pin_bytes_missing`
 * finding). Absence is never conflated with a fault: a fault throws.
 */
export type PinBytesPresenceProbe = (pin: ArchivePinRecord) => Promise<boolean>;

export type PinReconcileOutcome =
  | 'serving_added'
  | 'serving_removed'
  | 'pin_bytes_missing'
  | 'serving_orphan_removed'
  | 'healthy';

export interface PinReconcileFinding {
  publicationId: string;
  hostId: string;
  outcome: PinReconcileOutcome;
  detail: Record<string, unknown>;
}

export interface PinReconcileRunInput {
  /** The host id whose pin intent this run reconciles (this seeder's stable host id). */
  hostId: string;
  /** Resume from this cursor; omit to start from the beginning of the host's pin records. */
  after?: ArchivePinCursor;
  /** Max pin records examined this run (bounded). */
  maxEntries: number;
  /** Pin store page size; each store page is at most this many records. */
  pageSize: number;
}

export interface PinReconcileRunResult {
  findings: PinReconcileFinding[];
  entriesScanned: number;
  /** Cursor to resume from, or null when the host's pins were fully scanned this run. */
  nextCursor: ArchivePinCursor | null;
  outcomeCounts: Record<PinReconcileOutcome, number>;
}

const SAFE_ID = /^[A-Za-z0-9_.:@/-]{1,512}$/u;
const MAX_RUN_ENTRIES = 100_000;
const MAX_PAGE_SIZE = 1_000;

function emptyOutcomeCounts(): Record<PinReconcileOutcome, number> {
  return {
    serving_added: 0,
    serving_removed: 0,
    pin_bytes_missing: 0,
    serving_orphan_removed: 0,
    healthy: 0,
  };
}

function assertPositiveInteger(name: string, value: number, max: number): void {
  if (!Number.isSafeInteger(value) || value < 1 || value > max) {
    throw new TypeError(`${name} must be an integer between 1 and ${max}`);
  }
}

/**
 * Reconciles one bounded slice of a host's pin intent against its serving index. The caller holds
 * the fenced lease across a run and persists the returned cursor under it; `ArchivePinReconciler.run`
 * does the scan, and the leased driver (below) wraps it in a lease + cursor persistence.
 */
export class ArchivePinReconciler {
  constructor(
    private readonly pinStore: Pick<ArchivePinStore, 'listPinsForHost'>,
    private readonly servingIndex: PinServingIndex,
    private readonly probeBytes: PinBytesPresenceProbe,
  ) {}

  async run(input: PinReconcileRunInput): Promise<PinReconcileRunResult> {
    if (!SAFE_ID.test(input.hostId)) throw new TypeError('pin reconcile host id is invalid');
    assertPositiveInteger('maxEntries', input.maxEntries, MAX_RUN_ENTRIES);
    assertPositiveInteger('pageSize', input.pageSize, MAX_PAGE_SIZE);

    const findings: PinReconcileFinding[] = [];
    const outcomeCounts = emptyOutcomeCounts();
    let cursor = input.after;
    let scanned = 0;

    while (scanned < input.maxEntries) {
      const remaining = input.maxEntries - scanned;
      const page = await this.pinStore.listPinsForHost(input.hostId, {
        cursor,
        limit: Math.min(input.pageSize, remaining),
      });
      for (const pin of page.records) {
        const finding = await this.reconcilePin(pin);
        outcomeCounts[finding.outcome] += 1;
        if (finding.outcome !== 'healthy') findings.push(finding);
        scanned += 1;
        cursor = { publicationId: pin.publicationId };
      }
      if (!page.nextCursor) {
        return { findings, entriesScanned: scanned, nextCursor: null, outcomeCounts };
      }
      cursor = page.nextCursor;
      if (page.records.length === 0) break;
    }
    return { findings, entriesScanned: scanned, nextCursor: cursor ?? null, outcomeCounts };
  }

  private async reconcilePin(pin: ArchivePinRecord): Promise<PinReconcileFinding> {
    const serving = await this.servingIndex.isServing(pin.publicationId);
    if (pin.state !== 'active') {
      // Intent is no longer to serve this pin. Remove the serving entry FIRST (the takedown
      // ordering guarantee, restart-safe): a serving entry must never outlive an active pin.
      if (serving) {
        await this.servingIndex.removeServing(pin.publicationId);
        return finding(pin, 'serving_removed', { state: pin.state });
      }
      return finding(pin, 'healthy', {});
    }
    // Active pin: its bytes MUST be present to serve. A missing durable object is a loud finding,
    // never a silent serve. Remove any stale serving entry so nothing missing is handed out.
    const present = await this.probeBytes(pin);
    if (!present) {
      if (serving) await this.servingIndex.removeServing(pin.publicationId);
      return finding(pin, 'pin_bytes_missing', { contentId: pin.contentId });
    }
    if (!serving) {
      await this.servingIndex.addServing(pin.publicationId);
      return finding(pin, 'serving_added', {});
    }
    return finding(pin, 'healthy', {});
  }

  /**
   * The mirror scan: a bounded, cursor-paged slice of the serving index whose publications have NO
   * pin record for this host at all. Anything served that the pin store does not vouch for is a
   * `serving_orphan_removed` (removed from serving). This is the counterpart to reconcilePin's
   * intent-first scan: run both to fully converge serving state with pin intent.
   */
  async findServingOrphans(input: {
    hostId: string;
    after?: string;
    maxEntries: number;
    pageSize: number;
  }): Promise<{ findings: PinReconcileFinding[]; nextCursor: string | null; entriesScanned: number }> {
    if (!SAFE_ID.test(input.hostId)) throw new TypeError('pin reconcile host id is invalid');
    assertPositiveInteger('maxEntries', input.maxEntries, MAX_RUN_ENTRIES);
    assertPositiveInteger('pageSize', input.pageSize, MAX_PAGE_SIZE);
    const findings: PinReconcileFinding[] = [];
    let cursor = input.after;
    let scanned = 0;
    while (scanned < input.maxEntries) {
      const remaining = input.maxEntries - scanned;
      const page = await this.servingIndex.listServing({
        after: cursor,
        limit: Math.min(input.pageSize, remaining),
      });
      for (const publicationId of page.publicationIds) {
        const known = await this.pinExists(input.hostId, publicationId);
        if (!known) {
          await this.servingIndex.removeServing(publicationId);
          findings.push({
            publicationId,
            hostId: input.hostId,
            outcome: 'serving_orphan_removed',
            detail: {},
          });
        }
        scanned += 1;
        cursor = publicationId;
      }
      if (!page.nextCursor) return { findings, nextCursor: null, entriesScanned: scanned };
      cursor = page.nextCursor;
      if (page.publicationIds.length === 0) break;
    }
    return { findings, nextCursor: cursor ?? null, entriesScanned: scanned };
  }

  /** True iff this host has any pin record (any state) for the publication. Bounded lookup. */
  private async pinExists(hostId: string, publicationId: string): Promise<boolean> {
    const page = await this.pinStore.listPinsForHost(hostId, {
      cursor: { publicationId: predecessor(publicationId) },
      limit: 1,
    });
    return page.records.some((pin) => pin.publicationId === publicationId);
  }
}

/**
 * The largest publicationId strictly less than `value`, so listPinsForHost's `> cursor` scan starts
 * exactly at `value`. Trimming the last char yields a strict predecessor for the SAFE_ID key space;
 * an empty result (single-char id) starts from the beginning, which still surfaces the target row.
 */
function predecessor(value: string): string {
  if (value.length <= 1) return '';
  return value.slice(0, -1);
}

function finding(
  pin: ArchivePinRecord,
  outcome: PinReconcileOutcome,
  detail: Record<string, unknown>,
): PinReconcileFinding {
  return { publicationId: pin.publicationId, hostId: pin.hostId, outcome, detail };
}

/**
 * Durable pin-reconcile cursor persistence keyed by scan id, so a crashed run resumes in place.
 * Mirrors ReconcileCursorStore for the object reconciler; carries both the pin-intent cursor and the
 * serving-orphan cursor so one lease resumes both halves of the scan.
 */
export interface PinReconcileCursor {
  pinCursor: ArchivePinCursor | null;
  servingCursor: string | null;
}

export interface PinReconcileCursorStore {
  loadCursor(scanId: string): Promise<PinReconcileCursor | null>;
  saveCursor(scanId: string, cursor: PinReconcileCursor): Promise<void>;
}

export class InMemoryPinReconcileCursorStore implements PinReconcileCursorStore {
  private readonly cursors = new Map<string, PinReconcileCursor>();

  async loadCursor(scanId: string): Promise<PinReconcileCursor | null> {
    return this.cursors.get(scanId) ?? null;
  }

  async saveCursor(scanId: string, cursor: PinReconcileCursor): Promise<void> {
    this.cursors.set(scanId, cursor);
  }
}

export interface LeasedPinReconcileInput {
  scanId: string;
  hostId: string;
  owner: string;
  leaseMs: number;
  maxEntries: number;
  pageSize: number;
}

export type LeasedPinReconcileResult =
  | {
    status: 'ran';
    pin: PinReconcileRunResult;
    servingOrphans: {
      findings: PinReconcileFinding[];
      nextCursor: string | null;
      entriesScanned: number;
    };
  }
  | { status: 'contended' };

const PIN_RECONCILE_QUEUE = 'archive.pin.reconcile';
const SCAN_ID = /^[A-Za-z0-9_.:-]{1,128}$/u;

/**
 * The leased driver around ArchivePinReconciler. A run is single-writer and resumable: it claims a
 * FENCED job lease (the same operations-store primitive the object reconciler and workers use), loads
 * the persisted cursor for its scan id, runs one bounded pin-intent pass AND one bounded
 * serving-orphan pass under the lease, persists the advanced cursors, then releases. Two workers
 * racing the same scan id: only one wins the lease; the loser gets `contended` and does nothing. The
 * reconciler's serving-index mutations are idempotent, so a crash before cursor persistence simply
 * re-runs the same slice cleanly.
 */
export class LeasedArchivePinReconciler {
  constructor(
    private readonly reconciler: ArchivePinReconciler,
    private readonly leases: ReconcilerLeaseProvider,
    private readonly cursors: PinReconcileCursorStore,
  ) {}

  async runOnce(input: LeasedPinReconcileInput): Promise<LeasedPinReconcileResult> {
    if (!SCAN_ID.test(input.scanId)) throw new TypeError('pin reconcile scan id is invalid');
    const lease = await this.leases.claimJobLease({
      queue: PIN_RECONCILE_QUEUE,
      jobId: input.scanId,
      owner: input.owner,
      leaseMs: input.leaseMs,
    });
    if (!lease) return { status: 'contended' };
    try {
      const saved = await this.cursors.loadCursor(input.scanId);
      const pin = await this.reconciler.run({
        hostId: input.hostId,
        after: saved?.pinCursor ?? undefined,
        maxEntries: input.maxEntries,
        pageSize: input.pageSize,
      });
      const renewedForOrphans = await this.renew(lease, input.leaseMs);
      if (!renewedForOrphans) return { status: 'contended' };
      const servingOrphans = await this.reconciler.findServingOrphans({
        hostId: input.hostId,
        after: saved?.servingCursor ?? undefined,
        maxEntries: input.maxEntries,
        pageSize: input.pageSize,
      });
      const renewed = await this.renew(renewedForOrphans, input.leaseMs);
      if (!renewed) return { status: 'contended' };
      await this.cursors.saveCursor(input.scanId, {
        pinCursor: pin.nextCursor,
        servingCursor: servingOrphans.nextCursor,
      });
      return { status: 'ran', pin, servingOrphans };
    } finally {
      await this.leases.releaseJobLease(lease).catch(() => undefined);
    }
  }

  private async renew(lease: ReconcilerLease, leaseMs: number): Promise<ReconcilerLease | null> {
    return this.leases.renewJobLease(lease, leaseMs);
  }
}
