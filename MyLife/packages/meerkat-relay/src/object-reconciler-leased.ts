/**
 * The leased driver around ObjectReconciler (Plan 44 WP-2C).
 *
 * A reconciliation run must be single-writer and resumable. This driver claims a FENCED
 * job lease (the same claim/renew/release primitive push and archive workers use from
 * the operations store), loads the persisted cursor for its scan id, runs one bounded
 * ObjectReconciler pass under the lease, persists the advanced cursor, then releases the
 * lease. Two workers racing the same queue+jobId: only one wins the lease, so only one
 * reconciler runs; the loser gets `contended` and does nothing. A long scan renews its
 * lease between pages so a slow but live run is never stolen.
 *
 * The lease and cursor stores are expressed as minimal interfaces so this driver
 * composes over the memory, file, or PostgreSQL operations store without importing any
 * of them, keeping the relay-image-deps boundary intact.
 */

import { ObjectReconciler, type ReconcileRunInput, type ReconcileRunResult } from './object-reconciler';
import type { ObjectInventoryCursor } from './object-store';

/** The fenced-lease surface this driver needs, satisfied by PostgresOperationsStore. */
export interface ReconcilerLeaseProvider {
  claimJobLease(input: {
    queue: string;
    jobId: string;
    owner: string;
    leaseMs: number;
  }): Promise<ReconcilerLease | null>;
  renewJobLease(lease: ReconcilerLease, leaseMs: number): Promise<ReconcilerLease | null>;
  releaseJobLease(lease: ReconcilerLease): Promise<boolean>;
}

export interface ReconcilerLease {
  queue: string;
  jobId: string;
  owner: string;
  attempt: number;
  fencingToken: number;
  acquiredAt: string;
  leasedUntil: string;
}

/** Durable cursor persistence keyed by scan id, so a crashed run resumes in place. */
export interface ReconcileCursorStore {
  loadCursor(scanId: string): Promise<ObjectInventoryCursor | null>;
  saveCursor(scanId: string, cursor: ObjectInventoryCursor | null, entriesScanned: number): Promise<void>;
}

export interface LeasedReconcileInput extends Omit<ReconcileRunInput, 'after'> {
  scanId: string;
  owner: string;
  leaseMs: number;
}

export type LeasedReconcileResult =
  | { status: 'ran'; result: ReconcileRunResult }
  | { status: 'contended' };

const RECONCILE_QUEUE = 'object.reconcile';
const SCAN_ID = /^[A-Za-z0-9_.:-]{1,128}$/u;

export class LeasedObjectReconciler {
  constructor(
    private readonly reconciler: ObjectReconciler,
    private readonly leases: ReconcilerLeaseProvider,
    private readonly cursors: ReconcileCursorStore,
  ) {}

  async runOnce(input: LeasedReconcileInput): Promise<LeasedReconcileResult> {
    if (!SCAN_ID.test(input.scanId)) throw new TypeError('reconcile scan id is invalid');
    const lease = await this.leases.claimJobLease({
      queue: RECONCILE_QUEUE,
      jobId: input.scanId,
      owner: input.owner,
      leaseMs: input.leaseMs,
    });
    if (!lease) return { status: 'contended' };
    try {
      const after = (await this.cursors.loadCursor(input.scanId)) ?? undefined;
      const result = await this.reconciler.run({
        after,
        maxEntries: input.maxEntries,
        pageSize: input.pageSize,
        graceWindowMs: input.graceWindowMs,
        retentionWindowMs: input.retentionWindowMs,
        nowMs: input.nowMs,
      });
      // Persist the advanced cursor under the still-live lease before releasing it, so a
      // crash after the scan but before persistence simply re-runs the same slice (the
      // reconciler's actions are idempotent: enqueue and delete both replay cleanly).
      const renewed = await this.leases.renewJobLease(lease, input.leaseMs);
      if (!renewed) return { status: 'contended' };
      await this.cursors.saveCursor(input.scanId, result.nextCursor, result.entriesScanned);
      return { status: 'ran', result };
    } finally {
      await this.leases.releaseJobLease(lease).catch(() => undefined);
    }
  }
}
