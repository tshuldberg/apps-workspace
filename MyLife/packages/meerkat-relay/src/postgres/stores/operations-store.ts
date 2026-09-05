import type { QueryResult, QueryResultRow } from 'pg';
import type { PostgresStoreContext } from '../store-context';
import { toPostgresStoreUnavailableError } from '../store-context';

const SHA256_HEX = /^[a-f0-9]{64}$/;
const SAFE_SCOPE = /^[A-Za-z0-9_.:-]{1,128}$/;
const SAFE_OWNER = /^[A-Za-z0-9_.:@/-]{1,256}$/;
const SAFE_QUEUE = /^[A-Za-z0-9_.:-]{1,128}$/;
const SAFE_IDENTIFIER = /^[A-Za-z0-9_.:@/-]{1,512}$/;
const MAX_LEASE_MS = 24 * 60 * 60 * 1000;
const MAX_RESULT_TTL_MS = 365 * 24 * 60 * 60 * 1000;

export interface IdempotencyClaimInput {
  scope: string;
  key: string;
  requestDigestHex: string;
  owner: string;
  leaseMs: number;
}

export type IdempotencyClaim<T> =
  | { status: 'acquired'; fencingToken: number }
  | { status: 'replay'; result: T }
  | { status: 'in_progress' }
  | { status: 'conflict' };

export interface CompleteIdempotencyInput<T> extends IdempotencyClaimInput {
  fencingToken: number;
  result: T;
  resultTtlMs?: number;
}

export interface JobLeaseClaimInput {
  queue: string;
  jobId: string;
  owner: string;
  leaseMs: number;
}

export interface JobLease {
  queue: string;
  jobId: string;
  owner: string;
  attempt: number;
  fencingToken: number;
  acquiredAt: string;
  leasedUntil: string;
}

export interface BackupRestoreProof {
  proofId: string;
  sourceBackupId: string;
  releaseSha: string;
  restoredAt: string;
  rpoSeconds: number;
  rtoSeconds: number;
  semanticDigests: Record<string, unknown>;
  verified: boolean;
  lifecycleVersion?: number;
  recordedAt?: string;
}

export interface BackupRestoreProofCursor {
  restoredAt: string;
  proofId: string;
}

export interface ReleaseManifestRecord {
  releaseId: string;
  gitSha: string;
  manifest: Record<string, unknown>;
  manifestDigestHex: string;
  supersedesReleaseId?: string | null;
  createdAt?: string;
  approvedAt?: string | null;
  lifecycleVersion?: number;
}

export interface ReleaseManifestCursor {
  createdAt: string;
  releaseId: string;
}

interface IdempotencyRow extends QueryResultRow {
  request_digest_hex: string;
  state: string;
  result: unknown;
  claim_owner: string | null;
  claim_expires_at: Date | string | null;
  fencing_token: string | number;
}

interface JobLeaseRow extends QueryResultRow {
  queue: string;
  job_id: string;
  owner: string;
  attempt: string | number;
  fencing_token: string | number;
  acquired_at: Date | string;
  leased_until: Date | string;
}

interface BackupRestoreProofRow extends QueryResultRow {
  proof_id: string;
  source_backup_id: string;
  release_sha: string;
  restored_at: Date | string;
  rpo_seconds: number;
  rto_seconds: number;
  semantic_digests: Record<string, unknown>;
  verified: boolean;
  lifecycle_version: string | number;
  recorded_at: Date | string;
}

interface ReleaseManifestRow extends QueryResultRow {
  release_id: string;
  git_sha: string;
  manifest: Record<string, unknown>;
  manifest_digest_hex: string;
  supersedes_release_id: string | null;
  created_at: Date | string;
  approved_at: Date | string | null;
  lifecycle_version: string | number;
}

function positiveInteger(name: string, value: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) {
    throw new Error(`${name} must be an integer between 1 and ${maximum}`);
  }
  return value;
}

function assertMatch(name: string, value: string, pattern: RegExp): string {
  const normalized = value.trim();
  if (!pattern.test(normalized)) throw new Error(`${name} is invalid`);
  return normalized;
}

function timestamp(value: Date | string, field: string): string {
  const parsed = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error(`Invalid PostgreSQL ${field}`);
  return parsed.toISOString();
}

function safeInteger(value: number | string, field: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid PostgreSQL ${field}`);
  }
  return parsed;
}

function limit(value: number | undefined, defaultValue: number, maximum: number): number {
  if (value === undefined) return defaultValue;
  return positiveInteger('limit', value, maximum);
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

function mapLease(row: JobLeaseRow): JobLease {
  return {
    queue: row.queue,
    jobId: row.job_id,
    owner: row.owner,
    attempt: safeInteger(row.attempt, 'attempt'),
    fencingToken: safeInteger(row.fencing_token, 'fencing token'),
    acquiredAt: timestamp(row.acquired_at, 'acquired_at'),
    leasedUntil: timestamp(row.leased_until, 'leased_until'),
  };
}

function mapBackupProof(row: BackupRestoreProofRow): BackupRestoreProof {
  return {
    proofId: row.proof_id,
    sourceBackupId: row.source_backup_id,
    releaseSha: row.release_sha,
    restoredAt: timestamp(row.restored_at, 'restored_at'),
    rpoSeconds: safeInteger(row.rpo_seconds, 'rpo_seconds'),
    rtoSeconds: safeInteger(row.rto_seconds, 'rto_seconds'),
    semanticDigests: row.semantic_digests,
    verified: row.verified,
    lifecycleVersion: safeInteger(row.lifecycle_version, 'lifecycle_version'),
    recordedAt: timestamp(row.recorded_at, 'recorded_at'),
  };
}

function mapReleaseManifest(row: ReleaseManifestRow): ReleaseManifestRecord {
  return {
    releaseId: row.release_id,
    gitSha: row.git_sha,
    manifest: row.manifest,
    manifestDigestHex: row.manifest_digest_hex,
    supersedesReleaseId: row.supersedes_release_id,
    createdAt: timestamp(row.created_at, 'created_at'),
    approvedAt: row.approved_at ? timestamp(row.approved_at, 'approved_at') : null,
    lifecycleVersion: safeInteger(row.lifecycle_version, 'lifecycle_version'),
  };
}

/** PostgreSQL-owned operational idempotency, leases, recovery proofs, and releases. */
export class PostgresOperationsStore {
  constructor(private readonly database: PostgresStoreContext) {}

  private async query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<QueryResult<Row>> {
    try {
      return await this.database.query<Row>(text, values);
    } catch (error) {
      throw toPostgresStoreUnavailableError('operations store query', error);
    }
  }

  private async transaction<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await this.database.transaction(operation);
    } catch (error) {
      throw toPostgresStoreUnavailableError('operations store transaction', error);
    }
  }

  async claimIdempotency<T>(input: IdempotencyClaimInput): Promise<IdempotencyClaim<T>> {
    const scope = assertMatch('idempotency scope', input.scope, SAFE_SCOPE);
    const key = assertMatch('idempotency key', input.key, SAFE_IDENTIFIER);
    const owner = assertMatch('idempotency owner', input.owner, SAFE_OWNER);
    const digest = assertMatch('request digest', input.requestDigestHex, SHA256_HEX);
    const leaseMs = positiveInteger('idempotency leaseMs', input.leaseMs, MAX_LEASE_MS);

    return this.transaction(async () => {
      const inserted = await this.query<IdempotencyRow>(`
        INSERT INTO ops.idempotency_results (
          scope, idempotency_key, request_digest, state, result,
          claim_owner, claim_expires_at, fencing_token, updated_at
        ) VALUES (
          $1, $2, decode($3, 'hex'), 'in_progress', NULL,
          $4, clock_timestamp() + ($5::bigint * interval '1 millisecond'), 1,
          clock_timestamp()
        )
        ON CONFLICT (scope, idempotency_key) DO NOTHING
        RETURNING encode(request_digest, 'hex') AS request_digest_hex, state, result,
          claim_owner, claim_expires_at, fencing_token
      `, [scope, key, digest, owner, leaseMs]);
      const insertedRow = inserted.rows[0];
      if (insertedRow) {
        return { status: 'acquired', fencingToken: safeInteger(
          insertedRow.fencing_token,
          'fencing token',
        ) };
      }

      const selected = await this.query<IdempotencyRow>(`
        SELECT encode(request_digest, 'hex') AS request_digest_hex, state, result,
          claim_owner, claim_expires_at, fencing_token
        FROM ops.idempotency_results
        WHERE scope = $1 AND idempotency_key = $2
        FOR UPDATE
      `, [scope, key]);
      const row = selected.rows[0];
      if (!row) throw new Error('Idempotency row disappeared during claim');
      if (row.request_digest_hex !== digest) return { status: 'conflict' };
      if (row.state === 'committed') return { status: 'replay', result: row.result as T };
      if (row.state !== 'in_progress') throw new Error('Invalid PostgreSQL idempotency state');

      const takeover = await this.query<IdempotencyRow>(`
        UPDATE ops.idempotency_results
        SET claim_owner = $3,
            claim_expires_at = clock_timestamp() + ($4::bigint * interval '1 millisecond'),
            fencing_token = fencing_token + 1,
            updated_at = clock_timestamp()
        WHERE scope = $1
          AND idempotency_key = $2
          AND state = 'in_progress'
          AND claim_expires_at <= clock_timestamp()
        RETURNING encode(request_digest, 'hex') AS request_digest_hex, state, result,
          claim_owner, claim_expires_at, fencing_token
      `, [scope, key, owner, leaseMs]);
      const takeoverRow = takeover.rows[0];
      return takeoverRow
        ? { status: 'acquired', fencingToken: safeInteger(
            takeoverRow.fencing_token,
            'fencing token',
          ) }
        : { status: 'in_progress' };
    });
  }

  async completeIdempotency<T>(input: CompleteIdempotencyInput<T>): Promise<boolean> {
    const scope = assertMatch('idempotency scope', input.scope, SAFE_SCOPE);
    const key = assertMatch('idempotency key', input.key, SAFE_IDENTIFIER);
    const owner = assertMatch('idempotency owner', input.owner, SAFE_OWNER);
    const digest = assertMatch('request digest', input.requestDigestHex, SHA256_HEX);
    const fencingToken = positiveInteger(
      'idempotency fencingToken',
      input.fencingToken,
      Number.MAX_SAFE_INTEGER,
    );
    const resultTtlMs = input.resultTtlMs === undefined
      ? null
      : positiveInteger('idempotency resultTtlMs', input.resultTtlMs, MAX_RESULT_TTL_MS);
    const updated = await this.query(`
      UPDATE ops.idempotency_results
      SET state = 'committed',
          result = $6::jsonb,
          claim_owner = NULL,
          claim_expires_at = NULL,
          expires_at = CASE
            WHEN $7::bigint IS NULL THEN NULL
            ELSE clock_timestamp() + ($7::bigint * interval '1 millisecond')
          END,
          updated_at = clock_timestamp()
      WHERE scope = $1
        AND idempotency_key = $2
        AND request_digest = decode($3, 'hex')
        AND state = 'in_progress'
        AND claim_owner = $4
        AND fencing_token = $5
        AND claim_expires_at > clock_timestamp()
    `, [scope, key, digest, owner, fencingToken, jsonText(input.result, 'idempotency result'), resultTtlMs]);
    return updated.rowCount === 1;
  }

  async abandonIdempotency(input: IdempotencyClaimInput & { fencingToken: number }): Promise<boolean> {
    const abandoned = await this.query(`
      UPDATE ops.idempotency_results
      SET claim_expires_at = clock_timestamp(),
          updated_at = clock_timestamp()
      WHERE scope = $1
        AND idempotency_key = $2
        AND request_digest = decode($3, 'hex')
        AND state = 'in_progress'
        AND claim_owner = $4
        AND fencing_token = $5
        AND claim_expires_at > clock_timestamp()
    `, [
      assertMatch('idempotency scope', input.scope, SAFE_SCOPE),
      assertMatch('idempotency key', input.key, SAFE_IDENTIFIER),
      assertMatch('request digest', input.requestDigestHex, SHA256_HEX),
      assertMatch('idempotency owner', input.owner, SAFE_OWNER),
      positiveInteger('idempotency fencingToken', input.fencingToken, Number.MAX_SAFE_INTEGER),
    ]);
    return abandoned.rowCount === 1;
  }

  async pruneIdempotencyResults(): Promise<number> {
    const deleted = await this.query(`
      DELETE FROM ops.idempotency_results
      WHERE state = 'committed'
        AND expires_at IS NOT NULL
        AND expires_at <= clock_timestamp()
    `);
    return deleted.rowCount ?? 0;
  }

  async claimJobLease(input: JobLeaseClaimInput): Promise<JobLease | null> {
    const queue = assertMatch('job queue', input.queue, SAFE_QUEUE);
    const jobId = assertMatch('job id', input.jobId, SAFE_IDENTIFIER);
    const owner = assertMatch('job owner', input.owner, SAFE_OWNER);
    const leaseMs = positiveInteger('job leaseMs', input.leaseMs, MAX_LEASE_MS);
    const claimed = await this.query<JobLeaseRow>(`
      INSERT INTO ops.job_leases (
        queue, job_id, owner, attempt, fencing_token,
        acquired_at, leased_until, created_at, updated_at
      ) VALUES (
        $1, $2, $3, 1, 1, clock_timestamp(),
        clock_timestamp() + ($4::bigint * interval '1 millisecond'),
        clock_timestamp(), clock_timestamp()
      )
      ON CONFLICT (queue, job_id) DO UPDATE
      SET owner = EXCLUDED.owner,
          attempt = ops.job_leases.attempt + 1,
          fencing_token = ops.job_leases.fencing_token + 1,
          acquired_at = clock_timestamp(),
          leased_until = clock_timestamp() + ($4::bigint * interval '1 millisecond'),
          updated_at = clock_timestamp()
      WHERE ops.job_leases.leased_until <= clock_timestamp()
      RETURNING queue, job_id, owner, attempt, fencing_token, acquired_at, leased_until
    `, [queue, jobId, owner, leaseMs]);
    const row = claimed.rows[0];
    return row ? mapLease(row) : null;
  }

  async renewJobLease(lease: JobLease, leaseMs: number): Promise<JobLease | null> {
    const renewed = await this.query<JobLeaseRow>(`
      UPDATE ops.job_leases
      SET leased_until = clock_timestamp() + ($5::bigint * interval '1 millisecond'),
          updated_at = clock_timestamp()
      WHERE queue = $1
        AND job_id = $2
        AND owner = $3
        AND fencing_token = $4
        AND leased_until > clock_timestamp()
      RETURNING queue, job_id, owner, attempt, fencing_token, acquired_at, leased_until
    `, [
      assertMatch('job queue', lease.queue, SAFE_QUEUE),
      assertMatch('job id', lease.jobId, SAFE_IDENTIFIER),
      assertMatch('job owner', lease.owner, SAFE_OWNER),
      positiveInteger('job fencingToken', lease.fencingToken, Number.MAX_SAFE_INTEGER),
      positiveInteger('job leaseMs', leaseMs, MAX_LEASE_MS),
    ]);
    const row = renewed.rows[0];
    return row ? mapLease(row) : null;
  }

  async releaseJobLease(lease: JobLease): Promise<boolean> {
    const released = await this.query(`
      UPDATE ops.job_leases
      SET leased_until = clock_timestamp(),
          updated_at = clock_timestamp()
      WHERE queue = $1 AND job_id = $2 AND owner = $3 AND fencing_token = $4
        AND leased_until > clock_timestamp()
    `, [
      assertMatch('job queue', lease.queue, SAFE_QUEUE),
      assertMatch('job id', lease.jobId, SAFE_IDENTIFIER),
      assertMatch('job owner', lease.owner, SAFE_OWNER),
      positiveInteger('job fencingToken', lease.fencingToken, Number.MAX_SAFE_INTEGER),
    ]);
    return released.rowCount === 1;
  }

  /**
   * Insert a restore proof, optionally FENCED on a still-held job lease. With a
   * lease supplied, the insert lands ONLY while that exact lease (queue, job id,
   * owner, fencing token) is still live: an expired holder whose lease was
   * re-claimed by another worker cannot write its stale evidence. Returns
   * `inserted` on a fresh row, `duplicate` when the proof id already exists (the
   * durable row is never rewritten), and `lease_lost` when the fencing predicate
   * refused the write.
   */
  async recordBackupRestoreProof(
    proof: BackupRestoreProof,
    lease?: JobLease,
  ): Promise<'inserted' | 'duplicate' | 'lease_lost'> {
    const values = [
      assertMatch('proof id', proof.proofId, SAFE_IDENTIFIER),
      assertMatch('source backup id', proof.sourceBackupId, SAFE_IDENTIFIER),
      assertMatch('release SHA', proof.releaseSha, SAFE_IDENTIFIER),
      timestamp(proof.restoredAt, 'restoredAt'),
      safeInteger(proof.rpoSeconds, 'rpoSeconds'),
      safeInteger(proof.rtoSeconds, 'rtoSeconds'),
      jsonText(proof.semanticDigests, 'backup semantic digests'),
      proof.verified,
    ];
    const inserted = lease
      ? await this.query(`
          INSERT INTO ops.backup_restore_proofs (
            proof_id, source_backup_id, release_sha, restored_at,
            rpo_seconds, rto_seconds, semantic_digests, verified
          )
          SELECT $1, $2, $3, $4::timestamptz, $5, $6, $7::jsonb, $8
          WHERE EXISTS (
            SELECT 1 FROM ops.job_leases
            WHERE queue = $9 AND job_id = $10 AND owner = $11
              AND fencing_token = $12 AND leased_until > clock_timestamp()
          )
          ON CONFLICT (proof_id) DO NOTHING
        `, [
          ...values,
          assertMatch('job queue', lease.queue, SAFE_QUEUE),
          assertMatch('job id', lease.jobId, SAFE_IDENTIFIER),
          assertMatch('job owner', lease.owner, SAFE_OWNER),
          positiveInteger('job fencingToken', lease.fencingToken, Number.MAX_SAFE_INTEGER),
        ])
      : await this.query(`
          INSERT INTO ops.backup_restore_proofs (
            proof_id, source_backup_id, release_sha, restored_at,
            rpo_seconds, rto_seconds, semantic_digests, verified
          ) VALUES ($1, $2, $3, $4::timestamptz, $5, $6, $7::jsonb, $8)
          ON CONFLICT (proof_id) DO NOTHING
        `, values);
    if (inserted.rowCount === 1) return 'inserted';
    const existing = await this.getBackupRestoreProof(proof.proofId);
    return existing ? 'duplicate' : 'lease_lost';
  }

  /** The durable proof row for one proof id, or null. */
  async getBackupRestoreProof(proofId: string): Promise<BackupRestoreProof | null> {
    const result = await this.query<BackupRestoreProofRow>(`
      SELECT proof_id, source_backup_id, release_sha, restored_at,
        rpo_seconds, rto_seconds, semantic_digests, verified,
        lifecycle_version, recorded_at
      FROM ops.backup_restore_proofs
      WHERE proof_id = $1
    `, [assertMatch('proof id', proofId, SAFE_IDENTIFIER)]);
    const row = result.rows[0];
    return row ? mapBackupProof(row) : null;
  }

  async listBackupRestoreProofs(options: {
    before?: BackupRestoreProofCursor;
    limit?: number;
  } = {}): Promise<BackupRestoreProof[]> {
    const pageSize = limit(options.limit, 50, 200);
    const result = await this.query<BackupRestoreProofRow>(`
      SELECT proof_id, source_backup_id, release_sha, restored_at,
        rpo_seconds, rto_seconds, semantic_digests, verified,
        lifecycle_version, recorded_at
      FROM ops.backup_restore_proofs
      WHERE $1::timestamptz IS NULL
        OR (restored_at, proof_id) < ($1::timestamptz, $2::text)
      ORDER BY restored_at DESC, proof_id DESC
      LIMIT $3
    `, [
      options.before ? timestamp(options.before.restoredAt, 'before.restoredAt') : null,
      options.before ? assertMatch('before proof id', options.before.proofId, SAFE_IDENTIFIER) : null,
      pageSize,
    ]);
    return result.rows.map(mapBackupProof);
  }

  async recordReleaseManifest(record: ReleaseManifestRecord): Promise<boolean> {
    const inserted = await this.query(`
      INSERT INTO ops.release_manifests (
        release_id, git_sha, manifest, manifest_digest, supersedes_release_id
      ) VALUES ($1, $2, $3::jsonb, decode($4, 'hex'), $5)
      ON CONFLICT (release_id) DO NOTHING
    `, [
      assertMatch('release id', record.releaseId, SAFE_IDENTIFIER),
      assertMatch('git SHA', record.gitSha, SAFE_IDENTIFIER),
      jsonText(record.manifest, 'release manifest'),
      assertMatch('manifest digest', record.manifestDigestHex, SHA256_HEX),
      record.supersedesReleaseId
        ? assertMatch('superseded release id', record.supersedesReleaseId, SAFE_IDENTIFIER)
        : null,
    ]);
    return inserted.rowCount === 1;
  }

  async approveReleaseManifest(releaseId: string, expectedVersion: number): Promise<number | null> {
    const result = await this.query<{ lifecycle_version: number | string }>(`
      UPDATE ops.release_manifests
      SET approved_at = clock_timestamp(),
          lifecycle_version = lifecycle_version + 1
      WHERE release_id = $1
        AND lifecycle_version = $2
        AND approved_at IS NULL
      RETURNING lifecycle_version
    `, [
      assertMatch('release id', releaseId, SAFE_IDENTIFIER),
      positiveInteger('expected release version', expectedVersion, Number.MAX_SAFE_INTEGER),
    ]);
    const row = result.rows[0];
    return row ? safeInteger(row.lifecycle_version, 'lifecycle_version') : null;
  }

  /** The durable manifest row for one release id, or null. */
  async getReleaseManifest(releaseId: string): Promise<ReleaseManifestRecord | null> {
    const result = await this.query<ReleaseManifestRow>(`
      SELECT release_id, git_sha, manifest,
        encode(manifest_digest, 'hex') AS manifest_digest_hex,
        supersedes_release_id, created_at, approved_at, lifecycle_version
      FROM ops.release_manifests
      WHERE release_id = $1
    `, [assertMatch('release id', releaseId, SAFE_IDENTIFIER)]);
    const row = result.rows[0];
    return row ? mapReleaseManifest(row) : null;
  }

  async listReleaseManifests(options: {
    before?: ReleaseManifestCursor;
    limit?: number;
  } = {}): Promise<ReleaseManifestRecord[]> {
    const pageSize = limit(options.limit, 50, 200);
    const result = await this.query<ReleaseManifestRow>(`
      SELECT release_id, git_sha, manifest,
        encode(manifest_digest, 'hex') AS manifest_digest_hex,
        supersedes_release_id, created_at, approved_at, lifecycle_version
      FROM ops.release_manifests
      WHERE $1::timestamptz IS NULL
        OR (created_at, release_id) < ($1::timestamptz, $2::text)
      ORDER BY created_at DESC, release_id DESC
      LIMIT $3
    `, [
      options.before ? timestamp(options.before.createdAt, 'before.createdAt') : null,
      options.before ? assertMatch('before release id', options.before.releaseId, SAFE_IDENTIFIER) : null,
      pageSize,
    ]);
    return result.rows.map(mapReleaseManifest);
  }
}
