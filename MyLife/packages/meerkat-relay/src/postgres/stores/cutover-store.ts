import type { QueryResult, QueryResultRow } from 'pg';
import type { PostgresStoreContext } from '../store-context';
import { toPostgresStoreUnavailableError } from '../store-context';
import { PostgresOperationsStore } from './operations-store';

/**
 * PostgreSQL-owned durable cutover-and-rollback proof (Plan 44 WP-3C).
 *
 * One row per cutover attempt, advanced through a fenced state machine
 * (preflighted -> executed -> verified, plus rolled_back / aborted). Each
 * transition guards on lifecycle_version so two operators cannot race a phase.
 * Independently, every mutating phase takes an operations-store idempotency claim
 * keyed by the cutover id, so two CONCURRENT cutover runs cannot interleave: the
 * second observes `contended`.
 *
 * The store never invents a state: it records only what the orchestration
 * verified (digests, attestations, timestamps from database time), and a rollback
 * records the honest loss delta.
 */

const SAFE_CUTOVER_ID = /^[A-Za-z0-9_.:-]{1,128}$/;
const CLAIM_SCOPE = 'cutover';
const CLAIM_LEASE_MS = 10 * 60 * 1000;

export type CutoverState =
  | 'preflighted'
  | 'executed'
  | 'verified'
  | 'rolled_back'
  | 'aborted';

/** A per-store semantic digest snapshot, as the import engine produces it. */
export type CutoverDigestMap = Record<string, { count: number; rollupHex: string }>;

export interface CutoverProof {
  cutoverId: string;
  releaseSha: string;
  state: CutoverState;
  operator: string;
  writersFrozenBy: string;
  sourceDigest: CutoverDigestMap;
  preflightReport: Record<string, unknown>;
  executedDigest: CutoverDigestMap | null;
  postBootDigest: CutoverDigestMap | null;
  rollbackDigestDelta: Record<string, unknown> | null;
  preflightedAt: string | null;
  executedAt: string | null;
  flippedAt: string | null;
  verifiedAt: string | null;
  rolledBackAt: string | null;
  lifecycleVersion: number;
  createdAt: string;
  updatedAt: string;
}

interface CutoverProofRow extends QueryResultRow {
  cutover_id: string;
  release_sha: string;
  state: string;
  operator: string;
  writers_frozen_by: string;
  source_digest: CutoverDigestMap;
  preflight_report: Record<string, unknown>;
  executed_digest: CutoverDigestMap | null;
  post_boot_digest: CutoverDigestMap | null;
  rollback_digest_delta: Record<string, unknown> | null;
  preflighted_at: Date | string | null;
  executed_at: Date | string | null;
  flipped_at: Date | string | null;
  verified_at: Date | string | null;
  rolled_back_at: Date | string | null;
  lifecycle_version: string | number;
  created_at: Date | string;
  updated_at: Date | string;
}

function assertCutoverId(value: string): string {
  const normalized = value.trim();
  if (!SAFE_CUTOVER_ID.test(normalized)) throw new Error('Cutover id is invalid');
  return normalized;
}

function assertText(name: string, value: string, max: number): string {
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > max) throw new Error(`${name} is invalid`);
  return normalized;
}

function positiveInteger(name: string, value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  return value;
}

function timestamp(value: Date | string | null): string | null {
  if (value === null) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error('Invalid PostgreSQL timestamp');
  return parsed.toISOString();
}

function jsonText(value: unknown, field: string): string {
  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(value);
  } catch (error) {
    throw new TypeError(`${field} must be JSON serializable`, { cause: error });
  }
  if (serialized === undefined) throw new TypeError(`${field} must be JSON serializable`);
  return serialized;
}

function mapProof(row: CutoverProofRow): CutoverProof {
  const version = Number(row.lifecycle_version);
  if (!Number.isSafeInteger(version) || version <= 0) throw new Error('Invalid cutover lifecycle version');
  return {
    cutoverId: row.cutover_id,
    releaseSha: row.release_sha,
    state: row.state as CutoverState,
    operator: row.operator,
    writersFrozenBy: row.writers_frozen_by,
    sourceDigest: row.source_digest,
    preflightReport: row.preflight_report,
    executedDigest: row.executed_digest,
    postBootDigest: row.post_boot_digest,
    rollbackDigestDelta: row.rollback_digest_delta,
    preflightedAt: timestamp(row.preflighted_at),
    executedAt: timestamp(row.executed_at),
    flippedAt: timestamp(row.flipped_at),
    verifiedAt: timestamp(row.verified_at),
    rolledBackAt: timestamp(row.rolled_back_at),
    lifecycleVersion: version,
    createdAt: timestamp(row.created_at)!,
    updatedAt: timestamp(row.updated_at)!,
  };
}

export interface PreflightCutoverInput {
  cutoverId: string;
  releaseSha: string;
  operator: string;
  writersFrozenBy: string;
  sourceDigest: CutoverDigestMap;
  preflightReport: Record<string, unknown>;
}

export interface ExecuteCutoverInput {
  cutoverId: string;
  expectedVersion: number;
  executedDigest: CutoverDigestMap;
}

export interface VerifyCutoverInput {
  cutoverId: string;
  expectedVersion: number;
  postBootDigest: CutoverDigestMap;
}

export interface RollbackCutoverInput {
  cutoverId: string;
  expectedVersion: number;
  rollbackDigestDelta: Record<string, unknown>;
}

/**
 * The outcome of a fenced transition. `contended` means a concurrent cutover run
 * holds the operations-store claim for this id; the caller must not proceed.
 */
export type CutoverTransition =
  | { status: 'ok'; proof: CutoverProof }
  | { status: 'version_conflict' }
  | { status: 'invalid_state' }
  | { status: 'contended' };

export class PostgresCutoverStore {
  private readonly operations: PostgresOperationsStore;

  constructor(private readonly database: PostgresStoreContext) {
    this.operations = new PostgresOperationsStore(database);
  }

  private async query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<QueryResult<Row>> {
    try {
      return await this.database.query<Row>(text, values);
    } catch (error) {
      throw toPostgresStoreUnavailableError('cutover store query', error);
    }
  }

  /**
   * Take the per-cutover concurrency LEASE, run the phase, then release it. A
   * concurrent run holding the lease yields `contended`. A job lease (not an
   * idempotency claim) is the right primitive: it is a mutex on the cutover id
   * that is explicitly released after each phase, so sequential phases by the
   * owner proceed while a truly concurrent run is refused. A crashed run's lease
   * expires after CLAIM_LEASE_MS so the cutover is not wedged forever.
   */
  private async withClaim(
    cutoverId: string,
    _phase: string,
    owner: string,
    operation: () => Promise<CutoverTransition>,
  ): Promise<CutoverTransition> {
    const id = assertCutoverId(cutoverId);
    const lease = await this.operations.claimJobLease({
      queue: CLAIM_SCOPE,
      jobId: id,
      owner: assertText('owner', owner, 256),
      leaseMs: CLAIM_LEASE_MS,
    });
    if (!lease) return { status: 'contended' };
    try {
      return await operation();
    } finally {
      await this.operations.releaseJobLease(lease).catch(() => undefined);
    }
  }

  /**
   * Begin a cutover: record the source (file) digest, the writer-freeze
   * attestation, and the preflight report. Idempotent per id (a repeat returns the
   * existing proof). Contention-fenced so two operators cannot both open the same id.
   */
  async preflight(input: PreflightCutoverInput): Promise<CutoverTransition> {
    return this.withClaim(input.cutoverId, 'preflight', input.operator, async () => {
      const inserted = await this.query<CutoverProofRow>(`
        INSERT INTO ops.cutover_proofs (
          cutover_id, release_sha, operator, writers_frozen_by,
          source_digest, preflight_report, state, preflighted_at
        ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, 'preflighted', clock_timestamp())
        ON CONFLICT (cutover_id) DO NOTHING
        RETURNING *
      `, [
        assertCutoverId(input.cutoverId),
        assertText('release sha', input.releaseSha, 256),
        assertText('operator', input.operator, 256),
        assertText('writers frozen by', input.writersFrozenBy, 256),
        jsonText(input.sourceDigest, 'source digest'),
        jsonText(input.preflightReport, 'preflight report'),
      ]);
      const row = inserted.rows[0];
      if (row) return { status: 'ok', proof: mapProof(row) };
      const existing = await this.get(input.cutoverId);
      if (!existing) throw new Error('Cutover row disappeared during preflight');
      return { status: 'ok', proof: existing };
    });
  }

  /**
   * The gate: after the final delta import and a proven-identical digest compare,
   * record the executed digest and advance to executed.
   */
  async recordExecuted(input: ExecuteCutoverInput, owner: string): Promise<CutoverTransition> {
    return this.withClaim(input.cutoverId, 'execute', owner, () =>
      this.advance(input.cutoverId, input.expectedVersion, 'preflighted', `
        UPDATE ops.cutover_proofs
        SET state = 'executed',
            executed_digest = $3::jsonb,
            executed_at = clock_timestamp(),
            lifecycle_version = lifecycle_version + 1,
            updated_at = clock_timestamp()
        WHERE cutover_id = $1 AND lifecycle_version = $2 AND state = 'preflighted'
        RETURNING *
      `, [jsonText(input.executedDigest, 'executed digest')]));
  }

  /**
   * After the env flip + restart on PostgreSQL, record the post-boot digest and
   * verify. flipped_at + verified_at are stamped from database time here.
   */
  async recordVerified(input: VerifyCutoverInput, owner: string): Promise<CutoverTransition> {
    return this.withClaim(input.cutoverId, 'verify', owner, () =>
      this.advance(input.cutoverId, input.expectedVersion, 'executed', `
        UPDATE ops.cutover_proofs
        SET state = 'verified',
            post_boot_digest = $3::jsonb,
            flipped_at = clock_timestamp(),
            verified_at = clock_timestamp(),
            lifecycle_version = lifecycle_version + 1,
            updated_at = clock_timestamp()
        WHERE cutover_id = $1 AND lifecycle_version = $2 AND state = 'executed'
        RETURNING *
      `, [jsonText(input.postBootDigest, 'post-boot digest')]));
  }

  /**
   * Roll back to the UNTOUCHED file state. Records the rollback instant and the
   * honest loss delta. Reachable from executed (flip aborted) or verified (flip
   * reversed). The delta records that PostgreSQL writes taken after the flip are
   * orphaned; the file state, never mutated by import, is authority again.
   */
  async recordRolledBack(input: RollbackCutoverInput, owner: string): Promise<CutoverTransition> {
    return this.withClaim(input.cutoverId, 'rollback', owner, async () => {
      const cutoverId = assertCutoverId(input.cutoverId);
      const expectedVersion = positiveInteger('expected version', input.expectedVersion);
      const updated = await this.query<CutoverProofRow>(`
        UPDATE ops.cutover_proofs
        SET state = 'rolled_back',
            rollback_digest_delta = $3::jsonb,
            rolled_back_at = clock_timestamp(),
            lifecycle_version = lifecycle_version + 1,
            updated_at = clock_timestamp()
        WHERE cutover_id = $1 AND lifecycle_version = $2
          AND state IN ('executed', 'verified')
        RETURNING *
      `, [cutoverId, expectedVersion, jsonText(input.rollbackDigestDelta, 'rollback digest delta')]);
      const row = updated.rows[0];
      if (row) return { status: 'ok', proof: mapProof(row) };
      return this.classifyMiss(cutoverId, expectedVersion, ['executed', 'verified']);
    });
  }

  /** Abandon a cutover before verify (e.g. the gate failed). */
  async recordAborted(cutoverId: string, expectedVersion: number, owner: string): Promise<CutoverTransition> {
    return this.withClaim(cutoverId, 'abort', owner, async () => {
      const id = assertCutoverId(cutoverId);
      const version = positiveInteger('expected version', expectedVersion);
      const updated = await this.query<CutoverProofRow>(`
        UPDATE ops.cutover_proofs
        SET state = 'aborted',
            lifecycle_version = lifecycle_version + 1,
            updated_at = clock_timestamp()
        WHERE cutover_id = $1 AND lifecycle_version = $2
          AND state IN ('preflighted', 'executed')
        RETURNING *
      `, [id, version]);
      const row = updated.rows[0];
      if (row) return { status: 'ok', proof: mapProof(row) };
      return this.classifyMiss(id, version, ['preflighted', 'executed']);
    });
  }

  async get(cutoverId: string): Promise<CutoverProof | null> {
    const result = await this.query<CutoverProofRow>(
      'SELECT * FROM ops.cutover_proofs WHERE cutover_id = $1',
      [assertCutoverId(cutoverId)],
    );
    return result.rows[0] ? mapProof(result.rows[0]) : null;
  }

  private async advance(
    cutoverId: string,
    expectedVersion: number,
    fromState: CutoverState,
    sql: string,
    extraValues: readonly unknown[],
  ): Promise<CutoverTransition> {
    const id = assertCutoverId(cutoverId);
    const version = positiveInteger('expected version', expectedVersion);
    const updated = await this.query<CutoverProofRow>(sql, [id, version, ...extraValues]);
    const row = updated.rows[0];
    if (row) return { status: 'ok', proof: mapProof(row) };
    return this.classifyMiss(id, version, [fromState]);
  }

  /** Distinguish a version conflict from a wrong-state transition for a clear operator error. */
  private async classifyMiss(
    cutoverId: string,
    expectedVersion: number,
    validFromStates: readonly CutoverState[],
  ): Promise<CutoverTransition> {
    const current = await this.get(cutoverId);
    if (!current) return { status: 'invalid_state' };
    if (current.lifecycleVersion !== expectedVersion) return { status: 'version_conflict' };
    if (!validFromStates.includes(current.state)) return { status: 'invalid_state' };
    return { status: 'version_conflict' };
  }
}
