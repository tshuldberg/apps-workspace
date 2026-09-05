import type { QueryResult, QueryResultRow } from 'pg';
import type { PostgresStoreContext } from '../store-context';
import { toPostgresStoreUnavailableError } from '../store-context';
import { PostgresOperationsStore, type JobLease } from './operations-store';

/**
 * PostgreSQL-owned durable release-promotion proof (Plan 44 WP-6C).
 *
 * One IMMUTABLE row per transition. The CURRENT state of a release is the to_state
 * of its latest row; there is no mutable "current" column, so history is the
 * source of truth. Every recordPromotion is fenced by an operations-store JOB
 * LEASE (queue `release-promotion`, jobId = releaseId) so two concurrent
 * transitions for the same release cannot interleave: the second observes
 * `contended` and must not proceed.
 *
 * The store NEVER performs a deploy and NEVER invents a transition. It refuses (a
 * typed result, never a throw-for-control-flow) when:
 *   - the release manifest does not exist or is NOT approved (NC-44.4): only an
 *     approved release may be promoted,
 *   - the caller's from_state does not equal the release's actual current state
 *     (a stale operator view must not advance the ladder), or
 *   - the (from_state, to_state) pair is not a legal transition.
 *
 * ROLLBACK HONESTY (NC-44.5). A rollback re-points the deploy at an EARLIER
 * approved release's images. It does not un-write the database. recordRollback
 * therefore requires a rollbackToReleaseId that names a DIFFERENT, EARLIER,
 * APPROVED manifest (verified via getReleaseManifest), and it stamps the evidence
 * with the literal honesty markers dataReversalClaimed=false and
 * postgresWritesAfterFlipReversed=false. A caller-supplied evidence object that
 * claims data reversal is REFUSED before the write; the migration's CHECK is the
 * backstop, this store is the gate.
 */

const SAFE_PROMOTION_ID = /^[A-Za-z0-9_.:-]{1,128}$/;
const SAFE_RELEASE_ID = /^[A-Za-z0-9_.:@/-]{1,512}$/;
const PROMOTION_QUEUE = 'release-promotion';
const PROMOTION_LEASE_MS = 10 * 60 * 1000;

/** Forward ladder rungs plus the terminal rollback state. */
export type PromotionState =
  | 'staging'
  | 'staging_canary'
  | 'production_canary'
  | 'production'
  | 'rolled_back';

/**
 * The from_state of a promotion: either a real prior rung, or `none` for a
 * release's very first promotion (into `staging`).
 */
export type PromotionFromState = 'none' | Exclude<PromotionState, 'rolled_back'>;

/** The single legal forward successor of each state, and the ladder start. */
const FORWARD_TRANSITION: Record<PromotionFromState, PromotionState | undefined> = {
  none: 'staging',
  staging: 'staging_canary',
  staging_canary: 'production_canary',
  production_canary: 'production',
  production: undefined,
};

export interface ReleasePromotion {
  promotionId: string;
  releaseId: string;
  fromState: PromotionFromState;
  toState: PromotionState;
  operator: string;
  evidence: Record<string, unknown>;
  recordedAt: string;
}

interface ReleasePromotionRow extends QueryResultRow {
  promotion_id: string;
  release_id: string;
  from_state: string;
  to_state: string;
  operator: string;
  evidence: Record<string, unknown>;
  recorded_at: Date | string;
}

function assertMatch(name: string, value: string, pattern: RegExp): string {
  const normalized = value.trim();
  if (!pattern.test(normalized)) throw new Error(`${name} is invalid`);
  return normalized;
}

function assertText(name: string, value: string, max: number): string {
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > max) throw new Error(`${name} is invalid`);
  return normalized;
}

function timestamp(value: Date | string): string {
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
  if (serialized === undefined || serialized === 'null') {
    throw new TypeError(`${field} must be a JSON object`);
  }
  return serialized;
}

/** Reject an evidence value that is not a plain JSON object (the jsonb CHECK's peer). */
function assertEvidenceObject(evidence: unknown): Record<string, unknown> {
  if (evidence === null || typeof evidence !== 'object' || Array.isArray(evidence)) {
    throw new Error('promotion evidence must be a JSON object');
  }
  return evidence as Record<string, unknown>;
}

function mapPromotion(row: ReleasePromotionRow): ReleasePromotion {
  return {
    promotionId: row.promotion_id,
    releaseId: row.release_id,
    fromState: row.from_state as PromotionFromState,
    toState: row.to_state as PromotionState,
    operator: row.operator,
    evidence: row.evidence,
    recordedAt: timestamp(row.recorded_at),
  };
}

export interface RecordForwardPromotionInput {
  promotionId: string;
  releaseId: string;
  /** The rung to advance TO. from_state is derived from the release's current state. */
  toState: Exclude<PromotionState, 'rolled_back'>;
  operator: string;
  /** Verbatim canary/probe evidence attached to the row. */
  evidence: Record<string, unknown>;
}

export interface RecordRollbackInput {
  promotionId: string;
  releaseId: string;
  /** An EARLIER, APPROVED manifest id to re-point the deploy at. */
  rollbackToReleaseId: string;
  operator: string;
  /** Operator-supplied evidence; the honesty markers are stamped by the store. */
  evidence: Record<string, unknown>;
}

/**
 * A promotion outcome. Every non-`recorded` result is a typed refusal, never a
 * thrown control-flow error. `contended` means a concurrent transition holds the
 * lease. `duplicate` means the promotion id was already recorded (the durable row
 * stands). The refusal variants each name exactly why the transition was rejected.
 */
export type PromotionResult =
  | { status: 'recorded'; promotion: ReleasePromotion }
  | { status: 'duplicate'; existing: ReleasePromotion }
  | { status: 'contended' }
  | { status: 'refused'; reason: PromotionRefusalReason; detail: string };

export type PromotionRefusalReason =
  | 'release_not_found'
  | 'release_not_approved'
  | 'illegal_transition'
  | 'from_state_mismatch'
  | 'rollback_target_not_found'
  | 'rollback_target_not_approved'
  | 'rollback_target_not_earlier'
  | 'rollback_target_same_release'
  | 'rollback_target_rolled_back'
  | 'evidence_claims_data_reversal';

/**
 * Deep-scan an evidence value for a reversal-claim key at ANY depth whose value is
 * not the literal `false`. The top-level markers the store stamps are authoritative,
 * but a nested `{claims:{dataReversalClaimed:true}}` or a string "true" would leave
 * a contradictory claim inside the durable evidence; honesty requires the WHOLE
 * object to be free of reversal claims, not just the two top-level keys.
 */
function findReversalClaim(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(findReversalClaim);
  if (value === null || typeof value !== 'object') return false;
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (
      (key === 'dataReversalClaimed' || key === 'postgresWritesAfterFlipReversed') &&
      entry !== false
    ) {
      return true;
    }
    if (findReversalClaim(entry)) return true;
  }
  return false;
}

export class PostgresPromotionStore {
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
      throw toPostgresStoreUnavailableError('promotion store query', error);
    }
  }

  /** The current state of a release: the to_state of its latest promotion, or `none`. */
  async currentPromotionState(releaseId: string): Promise<PromotionFromState | 'rolled_back'> {
    const latest = await this.latest(releaseId);
    return latest ? latest.toState : 'none';
  }

  /**
   * The most recent promotion row for a release, or null if it has never been
   * promoted. Ordered by seq (total insert order): clock_timestamp() ties would
   * make a timestamp+lexical order ambiguous.
   */
  async latest(releaseId: string): Promise<ReleasePromotion | null> {
    const result = await this.query<ReleasePromotionRow>(`
      SELECT promotion_id, release_id, from_state, to_state, operator, evidence, recorded_at
      FROM ops.release_promotions
      WHERE release_id = $1
      ORDER BY seq DESC
      LIMIT 1
    `, [assertMatch('release id', releaseId, SAFE_RELEASE_ID)]);
    const row = result.rows[0];
    return row ? mapPromotion(row) : null;
  }

  /** The promotion history for a release, newest first (by insert order), bounded. */
  async listPromotions(releaseId: string, max = 50): Promise<ReleasePromotion[]> {
    const bounded = Number.isSafeInteger(max) && max > 0 && max <= 200 ? max : 50;
    const result = await this.query<ReleasePromotionRow>(`
      SELECT promotion_id, release_id, from_state, to_state, operator, evidence, recorded_at
      FROM ops.release_promotions
      WHERE release_id = $1
      ORDER BY seq DESC
      LIMIT $2
    `, [assertMatch('release id', releaseId, SAFE_RELEASE_ID), bounded]);
    return result.rows.map(mapPromotion);
  }

  /**
   * Record a forward transition (staging <- ... <- production). from_state is
   * DERIVED from the release's current state, so a caller cannot skip a rung. The
   * release must be an approved manifest, and the derived (from -> to) pair must be
   * the single legal successor. Fenced per release id.
   */
  async recordForwardPromotion(input: RecordForwardPromotionInput): Promise<PromotionResult> {
    return this.withClaim(input.releaseId, input.operator, async (lease) => {
      const approval = await this.assertApprovedRelease(input.releaseId);
      if (approval.status === 'refused') return approval;

      const current = await this.currentPromotionState(input.releaseId);
      if (current === 'rolled_back') {
        return { status: 'refused', reason: 'illegal_transition', detail: 'a rolled_back release cannot be promoted forward' };
      }
      const expectedTo = FORWARD_TRANSITION[current];
      if (expectedTo === undefined) {
        return { status: 'refused', reason: 'illegal_transition', detail: `no forward transition exists from ${current}` };
      }
      if (expectedTo !== input.toState) {
        return {
          status: 'refused',
          reason: 'from_state_mismatch',
          detail: `release is at ${current}; the only legal next rung is ${expectedTo}, not ${input.toState}`,
        };
      }
      return this.insert({
        promotionId: input.promotionId,
        releaseId: input.releaseId,
        fromState: current,
        toState: input.toState,
        operator: input.operator,
        evidence: assertEvidenceObject(input.evidence),
      }, lease);
    });
  }

  /**
   * Record a rollback: transition the release's current (non-rolled_back) state to
   * rolled_back, re-pointing the deploy at an EARLIER approved manifest. The store
   * verifies the target exists, is approved, and is a DIFFERENT, EARLIER release,
   * then stamps the honest non-reversal markers into the evidence. A caller
   * evidence object claiming data reversal is refused. Fenced per release id.
   */
  async recordRollback(input: RecordRollbackInput): Promise<PromotionResult> {
    return this.withClaim(input.releaseId, input.operator, async (lease) => {
      const approval = await this.assertApprovedRelease(input.releaseId);
      if (approval.status === 'refused') return approval;

      const current = await this.currentPromotionState(input.releaseId);
      if (current === 'none') {
        return { status: 'refused', reason: 'illegal_transition', detail: 'a release with no promotions cannot be rolled back' };
      }
      if (current === 'rolled_back') {
        return { status: 'refused', reason: 'illegal_transition', detail: 'the release is already rolled_back' };
      }

      const targetCheck = await this.assertRollbackTarget(input.releaseId, input.rollbackToReleaseId);
      if (targetCheck.status === 'refused') return targetCheck;

      // A caller must not smuggle a reversal claim through the evidence, at ANY
      // depth or in any type shape (nested objects, arrays, string "true"). We
      // reject it explicitly (the migration CHECK is the top-level backstop), then
      // stamp the honest markers ourselves so the recorded row can never imply the
      // database was undone.
      const supplied = assertEvidenceObject(input.evidence);
      if (findReversalClaim(supplied)) {
        return {
          status: 'refused',
          reason: 'evidence_claims_data_reversal',
          detail: 'a rollback re-points images; it never un-writes the database (NC-44.5)',
        };
      }
      const evidence: Record<string, unknown> = {
        ...supplied,
        rollbackToReleaseId: input.rollbackToReleaseId,
        dataReversalClaimed: false,
        postgresWritesAfterFlipReversed: false,
      };
      return this.insert({
        promotionId: input.promotionId,
        releaseId: input.releaseId,
        fromState: current,
        toState: 'rolled_back',
        operator: input.operator,
        evidence,
      }, lease);
    });
  }

  /**
   * Take the per-release LEASE, run the transition, release it. A concurrent
   * transition holding the lease yields `contended`; a crashed run's lease expires
   * after PROMOTION_LEASE_MS so a release is never wedged.
   */
  private async withClaim(
    releaseId: string,
    owner: string,
    operation: (lease: JobLease) => Promise<PromotionResult>,
  ): Promise<PromotionResult> {
    const lease = await this.operations.claimJobLease({
      queue: PROMOTION_QUEUE,
      jobId: assertMatch('release id', releaseId, SAFE_RELEASE_ID),
      owner: assertText('operator', owner, 256),
      leaseMs: PROMOTION_LEASE_MS,
    });
    if (!lease) return { status: 'contended' };
    try {
      return await operation(lease);
    } finally {
      await this.operations.releaseJobLease(lease).catch(() => undefined);
    }
  }

  /** NC-44.4: the release must be a recorded, APPROVED manifest to be promotable. */
  private async assertApprovedRelease(
    releaseId: string,
  ): Promise<{ status: 'ok' } | { status: 'refused'; reason: PromotionRefusalReason; detail: string }> {
    const manifest = await this.operations.getReleaseManifest(releaseId);
    if (!manifest) {
      return { status: 'refused', reason: 'release_not_found', detail: `no release manifest recorded for ${releaseId}` };
    }
    if (!manifest.approvedAt) {
      return { status: 'refused', reason: 'release_not_approved', detail: `release ${releaseId} is not approved (NC-44.4)` };
    }
    return { status: 'ok' };
  }

  /** The rollback target must be a DIFFERENT, EARLIER, APPROVED manifest. */
  private async assertRollbackTarget(
    releaseId: string,
    rollbackToReleaseId: string,
  ): Promise<{ status: 'ok' } | { status: 'refused'; reason: PromotionRefusalReason; detail: string }> {
    const targetId = assertMatch('rollback target release id', rollbackToReleaseId, SAFE_RELEASE_ID);
    if (targetId === releaseId.trim()) {
      return { status: 'refused', reason: 'rollback_target_same_release', detail: 'a release cannot roll back to itself' };
    }
    const target = await this.operations.getReleaseManifest(targetId);
    if (!target) {
      return { status: 'refused', reason: 'rollback_target_not_found', detail: `rollback target ${targetId} is not a recorded manifest` };
    }
    if (!target.approvedAt) {
      return { status: 'refused', reason: 'rollback_target_not_approved', detail: `rollback target ${targetId} is not approved` };
    }
    // A target that was itself rolled back is not a valid deploy target: re-pointing
    // at a release the ladder already retreated from needs a fresh release, not a
    // rollback to a retreat.
    const targetState = await this.currentPromotionState(targetId);
    if (targetState === 'rolled_back') {
      return {
        status: 'refused',
        reason: 'rollback_target_rolled_back',
        detail: `rollback target ${targetId} was itself rolled back`,
      };
    }
    // "Earlier" is by the durable createdAt of the two manifests: a rollback must
    // return to a release that PROVABLY predates the one being rolled back. Missing
    // timestamps fail closed: ordering that cannot be proved is not assumed.
    const current = await this.operations.getReleaseManifest(releaseId);
    if (!current?.createdAt || !target.createdAt) {
      return {
        status: 'refused',
        reason: 'rollback_target_not_earlier',
        detail: `manifest timestamps are missing; the ordering of ${targetId} versus ${releaseId} cannot be proved`,
      };
    }
    if (!(new Date(target.createdAt) < new Date(current.createdAt))) {
      return {
        status: 'refused',
        reason: 'rollback_target_not_earlier',
        detail: `rollback target ${targetId} does not predate ${releaseId}`,
      };
    }
    return { status: 'ok' };
  }

  /**
   * The immutable append, FENCED on the still-held lease (queue, job id, owner,
   * fencing token, live): a holder whose lease expired mid-run and was re-claimed
   * cannot land a stale transition (which could otherwise append a forward row
   * AFTER a concurrent rollback, corrupting the history-derived current state).
   * A refused fence reports `contended`; a duplicate promotion id reports the
   * durable row, never rewrites it.
   */
  private async insert(promotion: {
    promotionId: string;
    releaseId: string;
    fromState: PromotionFromState;
    toState: PromotionState;
    operator: string;
    evidence: Record<string, unknown>;
  }, lease: JobLease): Promise<PromotionResult> {
    const inserted = await this.query<ReleasePromotionRow>(`
      INSERT INTO ops.release_promotions (
        promotion_id, release_id, from_state, to_state, operator, evidence
      )
      SELECT $1, $2, $3, $4, $5, $6::jsonb
      WHERE EXISTS (
        SELECT 1 FROM ops.job_leases
        WHERE queue = $7 AND job_id = $8 AND owner = $9
          AND fencing_token = $10 AND leased_until > clock_timestamp()
      )
      ON CONFLICT (promotion_id) DO NOTHING
      RETURNING promotion_id, release_id, from_state, to_state, operator, evidence, recorded_at
    `, [
      assertMatch('promotion id', promotion.promotionId, SAFE_PROMOTION_ID),
      assertMatch('release id', promotion.releaseId, SAFE_RELEASE_ID),
      promotion.fromState,
      promotion.toState,
      assertText('operator', promotion.operator, 256),
      jsonText(promotion.evidence, 'promotion evidence'),
      lease.queue,
      lease.jobId,
      lease.owner,
      lease.fencingToken,
    ]);
    const row = inserted.rows[0];
    if (row) return { status: 'recorded', promotion: mapPromotion(row) };
    const existing = await this.get(promotion.promotionId);
    if (existing) return { status: 'duplicate', existing };
    // No row inserted and no duplicate exists: the lease fence refused the write.
    return { status: 'contended' };
  }

  /** The durable promotion row for one promotion id, or null. */
  async get(promotionId: string): Promise<ReleasePromotion | null> {
    const result = await this.query<ReleasePromotionRow>(`
      SELECT promotion_id, release_id, from_state, to_state, operator, evidence, recorded_at
      FROM ops.release_promotions
      WHERE promotion_id = $1
    `, [assertMatch('promotion id', promotionId, SAFE_PROMOTION_ID)]);
    const row = result.rows[0];
    return row ? mapPromotion(row) : null;
  }
}
