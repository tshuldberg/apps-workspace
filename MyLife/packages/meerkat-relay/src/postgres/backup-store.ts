import type { PostgresStoreContext } from './store-context';
import {
  PostgresOperationsStore,
  type BackupRestoreProof,
} from './stores/operations-store';

/**
 * Fenced restore-smoke recorder (Plan 44 WP-5A).
 *
 * A restore smoke records a `backup_restore_proofs` row on the PRIMARY ops database.
 * Two smokes for the SAME proof id must not interleave, so every record takes a
 * per-proof operations-store JOB LEASE (queue `restore-smoke`, jobId = proofId),
 * exactly as PostgresCutoverStore fences a cutover id. A concurrent smoke holding
 * the lease yields `contended`; the caller must not proceed. The lease is released
 * after the record, and a crashed run's lease expires so a proof id is never wedged.
 *
 * The proof insert is `ON CONFLICT (proof_id) DO NOTHING` in the operations store,
 * so a replay of an already-recorded proof id is a no-op that reports `duplicate`,
 * never a rewrite of recovery evidence.
 */

const RESTORE_SMOKE_QUEUE = 'restore-smoke';
const RESTORE_SMOKE_LEASE_MS = 10 * 60 * 1000;
const SAFE_OWNER = /^[A-Za-z0-9_.:@/-]{1,256}$/;

export type RecordRestoreProofResult =
  | { status: 'recorded'; proof: BackupRestoreProof }
  /** The proof id already exists; `existing` is the DURABLE row (never this attempt's values). */
  | { status: 'duplicate'; existing: BackupRestoreProof }
  | { status: 'contended' };

export class PostgresBackupStore {
  private readonly operations: PostgresOperationsStore;

  constructor(database: PostgresStoreContext) {
    this.operations = new PostgresOperationsStore(database);
  }

  /**
   * Record a restore proof under a per-proof-id lease. The insert itself is FENCED
   * on the lease (queue, job id, owner, fencing token, still live), so a holder
   * whose lease expired mid-run and was re-claimed by another smoke cannot land its
   * stale evidence: that attempt reports `contended`, never a phantom `recorded`.
   * Returns `recorded` with the durable row on a fresh insert, `duplicate` with the
   * DURABLE existing row when the proof id already exists (a replay never rewrites
   * or re-labels recovery evidence), or `contended` when the lease was refused or
   * lost.
   */
  async recordRestoreProof(proof: BackupRestoreProof, owner: string): Promise<RecordRestoreProofResult> {
    const normalizedOwner = owner.trim();
    if (!SAFE_OWNER.test(normalizedOwner)) throw new Error('restore-smoke owner is invalid');

    const lease = await this.operations.claimJobLease({
      queue: RESTORE_SMOKE_QUEUE,
      jobId: proof.proofId,
      owner: normalizedOwner,
      leaseMs: RESTORE_SMOKE_LEASE_MS,
    });
    if (!lease) return { status: 'contended' };

    try {
      const outcome = await this.operations.recordBackupRestoreProof(proof, lease);
      if (outcome === 'lease_lost') return { status: 'contended' };
      if (outcome === 'duplicate') {
        const existing = await this.operations.getBackupRestoreProof(proof.proofId);
        if (!existing) throw new Error(`Proof ${proof.proofId} vanished between insert and read`);
        return { status: 'duplicate', existing };
      }
      const recorded = await this.operations.getBackupRestoreProof(proof.proofId);
      return { status: 'recorded', proof: recorded ?? proof };
    } finally {
      await this.operations.releaseJobLease(lease).catch(() => undefined);
    }
  }

  /** The latest recorded proof rows (newest first), bounded. */
  async listRecentProofs(limit = 20): Promise<BackupRestoreProof[]> {
    return this.operations.listBackupRestoreProofs({ limit });
  }
}
