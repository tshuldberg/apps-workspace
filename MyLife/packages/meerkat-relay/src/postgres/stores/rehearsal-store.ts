import type { QueryResult, QueryResultRow } from 'pg';
import type { PostgresStoreContext } from '../store-context';
import { toPostgresStoreUnavailableError } from '../store-context';
import { PostgresOperationsStore, type JobLease } from './operations-store';

/**
 * PostgreSQL-owned durable rehearsal-drill proof (Plan 44 WP-7A).
 *
 * One IMMUTABLE row per drill. The store NEVER runs a drill and NEVER invents a
 * verdict: it records the outcome an operator (or a harness) ALREADY produced,
 * attaching the evidence that justified it. Every recordDrill is fenced by an
 * operations-store JOB LEASE (queue `rehearsal`, jobId = drillId) so two
 * concurrent records for the same drill id cannot interleave: the second observes
 * `contended` (or a `duplicate` of the winner's durable row) and must not proceed.
 *
 * It refuses (a typed result, never a throw-for-control-flow) when:
 *   - the drill_kind is not one of the eleven known kinds (`unknown_kind`),
 *   - the verdict is not one of passed/failed/aborted (`invalid_verdict`),
 *   - a `passed` verdict carries an empty evidence object (`passed_requires_evidence`):
 *     a positive readiness claim must prove itself; the migration CHECK is the
 *     backstop, this store is the gate,
 *   - started_at does not parse, or postdates the database clock beyond a small
 *     skew tolerance (`invalid_started_at`): a drill cannot have started in the
 *     future, and
 *   - a release_id is supplied but names no recorded manifest (`release_not_found`).
 *
 * When a release_id IS supplied the store verifies the manifest exists (approval
 * is NOT required, since drills legitimately run against unapproved candidates)
 * and stamps the manifest's approval state into the evidence under
 * `storeStamped.releaseApproved` so the export can be honest about whether a drill
 * ran against an approved candidate.
 */

const SAFE_DRILL_ID = /^[A-Za-z0-9_.:-]{1,128}$/;
const SAFE_RELEASE_ID = /^[A-Za-z0-9_.:@/-]{1,512}$/;
const REHEARSAL_QUEUE = 'rehearsal';
const REHEARSAL_LEASE_MS = 10 * 60 * 1000;
/** A drill's started_at may not postdate database now by more than this skew. */
const STARTED_AT_FUTURE_SKEW_MS = 5 * 60 * 1000;

/** The eleven drill kinds, matching the migration's CHECK constraint verbatim. */
export const REHEARSAL_DRILL_KINDS = [
  'load',
  'soak',
  'failover',
  'dependency_outage',
  'secret_rotation',
  'migration_rollback',
  'backup_restore',
  'regional_object_recovery',
  'queue_backlog',
  'incident',
  'canary_stop_rollback',
] as const;

export type RehearsalDrillKind = (typeof REHEARSAL_DRILL_KINDS)[number];

export type RehearsalVerdict = 'passed' | 'failed' | 'aborted';

export interface RehearsalDrill {
  drillId: string;
  drillKind: RehearsalDrillKind;
  releaseId: string | null;
  operator: string;
  verdict: RehearsalVerdict;
  evidence: Record<string, unknown>;
  startedAt: string;
  recordedAt: string;
}

interface RehearsalDrillRow extends QueryResultRow {
  drill_id: string;
  drill_kind: string;
  release_id: string | null;
  operator: string;
  verdict: string;
  evidence: Record<string, unknown>;
  started_at: Date | string;
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
    throw new Error('drill evidence must be a JSON object');
  }
  return evidence as Record<string, unknown>;
}

function isKnownKind(kind: string): kind is RehearsalDrillKind {
  return (REHEARSAL_DRILL_KINDS as readonly string[]).includes(kind);
}

function mapDrill(row: RehearsalDrillRow): RehearsalDrill {
  return {
    drillId: row.drill_id,
    drillKind: row.drill_kind as RehearsalDrillKind,
    releaseId: row.release_id,
    operator: row.operator,
    verdict: row.verdict as RehearsalVerdict,
    evidence: row.evidence,
    startedAt: timestamp(row.started_at),
    recordedAt: timestamp(row.recorded_at),
  };
}

export interface RecordDrillInput {
  drillId: string;
  drillKind: string;
  verdict: string;
  operator: string;
  /** ISO 8601 instant the operator began the drill. Must not postdate database now. */
  startedAt: string;
  /** Verbatim drill evidence attached to the row (a non-empty object for `passed`). */
  evidence: Record<string, unknown>;
  /** Optional release candidate the drill ran against. Verified to exist if supplied. */
  releaseId?: string | null;
}

export interface ListDrillsQuery {
  kind?: RehearsalDrillKind;
  releaseId?: string;
  max?: number;
}

/**
 * A record outcome. Every non-`recorded` result is a typed refusal, never a thrown
 * control-flow error. `contended` means a concurrent record holds the lease.
 * `duplicate` means the drill id was already recorded (the durable row stands).
 * Each refusal variant names exactly why the record was rejected.
 */
export type RehearsalRecordResult =
  | { status: 'recorded'; drill: RehearsalDrill }
  | { status: 'duplicate'; existing: RehearsalDrill }
  | { status: 'contended' }
  | { status: 'refused'; reason: RehearsalRefusalReason; detail: string };

export type RehearsalRefusalReason =
  | 'unknown_kind'
  | 'invalid_verdict'
  | 'passed_requires_evidence'
  | 'invalid_started_at'
  | 'started_at_in_future'
  | 'started_at_too_old'
  | 'release_not_found';

/** Explicit ISO-8601 UTC instant: loose Date.parse forms are silently timezone-reinterpreted. */
const STARTED_AT_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

/** No Meerkat drill ran before 2025; an older claimed instant is a data-entry error. */
const STARTED_AT_FLOOR_MS = Date.parse('2025-01-01T00:00:00.000Z');

/**
 * Deep vacuity: evidence "content" is any value that is not null/undefined, not a
 * whitespace-only string, and not an object/array whose members are ALL vacuous.
 * Numbers and booleans (including 0 and false) count as content: they are at least
 * assertions. This gate refuses EMPTINESS dressed up as evidence ({a:null}, {x:{}},
 * {attachedEvidence:{}}, [""], a whitespace key over null); it cannot and does not
 * claim to validate TRUTH — a liar can still attach junk, and the audit trail
 * records exactly what they attached.
 */
export function isVacuousEvidence(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.every(isVacuousEvidence);
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).every(isVacuousEvidence);
  }
  return false;
}

export class PostgresRehearsalStore {
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
      throw toPostgresStoreUnavailableError('rehearsal store query', error);
    }
  }

  /**
   * Record a drill outcome. The kind and verdict must be known, a `passed` verdict
   * must carry real evidence, started_at must parse and not postdate the database
   * clock beyond a small skew, and any supplied release_id must name a recorded
   * manifest. The manifest's approval state (never required) is stamped into the
   * evidence for honest export. Fenced per drill id.
   */
  async recordDrill(input: RecordDrillInput): Promise<RehearsalRecordResult> {
    if (!isKnownKind(input.drillKind.trim())) {
      return { status: 'refused', reason: 'unknown_kind', detail: `unknown drill kind: ${input.drillKind}` };
    }
    const kind = input.drillKind.trim() as RehearsalDrillKind;
    const verdict = input.verdict.trim();
    if (verdict !== 'passed' && verdict !== 'failed' && verdict !== 'aborted') {
      return { status: 'refused', reason: 'invalid_verdict', detail: `unknown verdict: ${input.verdict}` };
    }

    const evidence = assertEvidenceObject(input.evidence);
    // A `passed` verdict is a positive readiness claim; a bare passed claim is
    // exactly the lie this refusal exists to stop. DEEP vacuity is the test, not
    // key count: {a:null}, {x:{}}, {attachedEvidence:{}}, or a whitespace key over
    // null are emptiness dressed up as evidence and refused the same as {}. The
    // migration's jsonb_strip_nulls CHECK is the backstop; this store is the gate.
    if (verdict === 'passed' && isVacuousEvidence(evidence)) {
      return {
        status: 'refused',
        reason: 'passed_requires_evidence',
        detail: 'a passed drill must carry non-empty evidence; a bare or vacuous passed claim is refused',
      };
    }

    // started_at is audit evidence: only an EXPLICIT ISO-8601 UTC instant is
    // accepted (loose Date.parse forms like "Jan 1 2020" are silently timezone-
    // reinterpreted, corrupting the claimed instant), and a floor refuses instants
    // predating the project.
    const startedAtRaw = input.startedAt.trim();
    if (!STARTED_AT_ISO.test(startedAtRaw)) {
      return {
        status: 'refused',
        reason: 'invalid_started_at',
        detail: `started_at must be an explicit ISO-8601 UTC instant (YYYY-MM-DDTHH:MM:SS[.mmm]Z): ${input.startedAt}`,
      };
    }
    const startedAtMs = Date.parse(startedAtRaw);
    if (!Number.isFinite(startedAtMs)) {
      return { status: 'refused', reason: 'invalid_started_at', detail: `started_at is not a valid instant: ${input.startedAt}` };
    }
    if (startedAtMs < STARTED_AT_FLOOR_MS) {
      return {
        status: 'refused',
        reason: 'started_at_too_old',
        detail: `started_at predates the project floor (2025-01-01): ${input.startedAt}`,
      };
    }

    const releaseId = input.releaseId?.trim() || null;
    return this.withClaim(input.drillId, input.operator, async (lease) => {
      // A drill cannot have started in the future. Bound started_at against the
      // DATABASE clock (never the CLI host clock), tolerating a small skew.
      const now = await this.databaseNowMs();
      if (startedAtMs > now + STARTED_AT_FUTURE_SKEW_MS) {
        return {
          status: 'refused',
          reason: 'started_at_in_future',
          detail: 'started_at postdates the database clock beyond the allowed skew',
        };
      }

      let releaseApproved: boolean | null = null;
      if (releaseId !== null) {
        const manifest = await this.operations.getReleaseManifest(releaseId);
        if (!manifest) {
          return { status: 'refused', reason: 'release_not_found', detail: `no release manifest recorded for ${releaseId}` };
        }
        // Approval is NOT required (drills may run against unapproved candidates),
        // but we record it so the export is honest about candidate approval state.
        releaseApproved = Boolean(manifest.approvedAt);
      }

      const stamped: Record<string, unknown> = {
        ...evidence,
        storeStamped: { releaseApproved },
      };
      return this.insert({
        drillId: input.drillId,
        drillKind: kind,
        releaseId,
        operator: input.operator,
        verdict,
        startedAt: new Date(startedAtMs).toISOString(),
        evidence: stamped,
      }, lease);
    });
  }

  /**
   * Take the per-drill LEASE, run the record, release it. A concurrent record
   * holding the lease yields `contended`; a crashed run's lease expires after
   * REHEARSAL_LEASE_MS so a drill id is never wedged.
   */
  private async withClaim(
    drillId: string,
    owner: string,
    operation: (lease: JobLease) => Promise<RehearsalRecordResult>,
  ): Promise<RehearsalRecordResult> {
    const lease = await this.operations.claimJobLease({
      queue: REHEARSAL_QUEUE,
      jobId: assertMatch('drill id', drillId, SAFE_DRILL_ID),
      owner: assertText('operator', owner, 256),
      leaseMs: REHEARSAL_LEASE_MS,
    });
    if (!lease) {
      // The lease is held: a concurrent record is in flight, OR a prior record for
      // this drill id already committed and released. Distinguish honestly.
      const existing = await this.get(drillId);
      return existing ? { status: 'duplicate', existing } : { status: 'contended' };
    }
    try {
      return await operation(lease);
    } finally {
      await this.operations.releaseJobLease(lease).catch(() => undefined);
    }
  }

  /** The database clock in epoch milliseconds (never the CLI host clock). */
  private async databaseNowMs(): Promise<number> {
    const result = await this.query<{ now: Date | string }>('SELECT clock_timestamp() AS now');
    const raw = result.rows[0]?.now;
    if (raw === undefined) throw new Error('database clock unavailable');
    return new Date(raw instanceof Date ? raw : String(raw)).getTime();
  }

  /**
   * The immutable append, FENCED on the still-held lease (queue, job id, owner,
   * fencing token, live): a holder whose lease expired mid-run and was re-claimed
   * cannot land a stale record. A refused fence reports `contended`; a duplicate
   * drill id reports the durable row, never rewrites it.
   */
  private async insert(drill: {
    drillId: string;
    drillKind: RehearsalDrillKind;
    releaseId: string | null;
    operator: string;
    verdict: RehearsalVerdict;
    startedAt: string;
    evidence: Record<string, unknown>;
  }, lease: JobLease): Promise<RehearsalRecordResult> {
    const inserted = await this.query<RehearsalDrillRow>(`
      INSERT INTO ops.rehearsal_proofs (
        drill_id, drill_kind, release_id, operator, verdict, evidence, started_at
      )
      SELECT $1, $2, $3, $4, $5, $6::jsonb, $7::timestamptz
      WHERE EXISTS (
        SELECT 1 FROM ops.job_leases
        WHERE queue = $8 AND job_id = $9 AND owner = $10
          AND fencing_token = $11 AND leased_until > clock_timestamp()
      )
      ON CONFLICT (drill_id) DO NOTHING
      RETURNING drill_id, drill_kind, release_id, operator, verdict, evidence, started_at, recorded_at
    `, [
      assertMatch('drill id', drill.drillId, SAFE_DRILL_ID),
      drill.drillKind,
      drill.releaseId === null ? null : assertMatch('release id', drill.releaseId, SAFE_RELEASE_ID),
      assertText('operator', drill.operator, 256),
      drill.verdict,
      jsonText(drill.evidence, 'drill evidence'),
      drill.startedAt,
      lease.queue,
      lease.jobId,
      lease.owner,
      lease.fencingToken,
    ]);
    const row = inserted.rows[0];
    if (row) return { status: 'recorded', drill: mapDrill(row) };
    const existing = await this.get(drill.drillId);
    if (existing) return { status: 'duplicate', existing };
    // No row inserted and no duplicate exists: the lease fence refused the write.
    return { status: 'contended' };
  }

  /** The durable drill row for one drill id, or null. */
  async get(drillId: string): Promise<RehearsalDrill | null> {
    const result = await this.query<RehearsalDrillRow>(`
      SELECT drill_id, drill_kind, release_id, operator, verdict, evidence, started_at, recorded_at
      FROM ops.rehearsal_proofs
      WHERE drill_id = $1
    `, [assertMatch('drill id', drillId, SAFE_DRILL_ID)]);
    const row = result.rows[0];
    return row ? mapDrill(row) : null;
  }

  /** Drills, newest first (by insert order), optionally filtered by kind/release, bounded. */
  async listDrills(query: ListDrillsQuery = {}): Promise<RehearsalDrill[]> {
    const max = query.max;
    const bounded = Number.isSafeInteger(max) && max! > 0 && max! <= 200 ? max! : 50;
    const kind = query.kind && isKnownKind(query.kind) ? query.kind : null;
    const releaseId = query.releaseId
      ? assertMatch('release id', query.releaseId, SAFE_RELEASE_ID)
      : null;
    const result = await this.query<RehearsalDrillRow>(`
      SELECT drill_id, drill_kind, release_id, operator, verdict, evidence, started_at, recorded_at
      FROM ops.rehearsal_proofs
      WHERE ($1::text IS NULL OR drill_kind = $1)
        AND ($2::text IS NULL OR release_id = $2)
      ORDER BY seq DESC
      LIMIT $3
    `, [kind, releaseId, bounded]);
    return result.rows.map(mapDrill);
  }

  /** The most recent drill of a kind, or null if none has ever been recorded. */
  async latestByKind(kind: RehearsalDrillKind): Promise<RehearsalDrill | null> {
    if (!isKnownKind(kind)) return null;
    const result = await this.query<RehearsalDrillRow>(`
      SELECT drill_id, drill_kind, release_id, operator, verdict, evidence, started_at, recorded_at
      FROM ops.rehearsal_proofs
      WHERE drill_kind = $1
      ORDER BY seq DESC
      LIMIT 1
    `, [kind]);
    const row = result.rows[0];
    return row ? mapDrill(row) : null;
  }

  /**
   * The most recent PASSED drill of a kind for a specific release, or null. This is
   * the export's honest source: only a durable, passed, release-scoped row counts
   * as evidence a drill ran green for that candidate.
   */
  async latestPassedForRelease(
    kind: RehearsalDrillKind,
    releaseId: string,
  ): Promise<RehearsalDrill | null> {
    if (!isKnownKind(kind)) return null;
    const result = await this.query<RehearsalDrillRow>(`
      SELECT drill_id, drill_kind, release_id, operator, verdict, evidence, started_at, recorded_at
      FROM ops.rehearsal_proofs
      WHERE drill_kind = $1
        AND release_id = $2
        AND verdict = 'passed'
      ORDER BY seq DESC
      LIMIT 1
    `, [kind, assertMatch('release id', releaseId, SAFE_RELEASE_ID)]);
    const row = result.rows[0];
    return row ? mapDrill(row) : null;
  }
}
