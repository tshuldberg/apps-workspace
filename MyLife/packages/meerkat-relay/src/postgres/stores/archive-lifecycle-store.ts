import { verifyArchiveJob, type SignedArchiveJob } from '@mylife/sync';
import type { QueryResult, QueryResultRow } from 'pg';
import type {
  ArchiveDurableObjectInput,
  ArchiveDeleteObjectInput,
  ArchiveEnqueueInput,
  ArchiveEnqueueResult,
  ArchiveHostCursor,
  ArchiveHostPage,
  ArchiveJobClaim,
  ArchiveJobClaimInput,
  ArchiveJobIdentityStatus,
  ArchiveJobRecord,
  ArchiveJobStatus,
  ArchiveLeaseInput,
  ArchiveLifecycleStore,
  ArchiveObjectRecord,
  ArchiveObjectMetadataStatus,
  ArchiveObjectDeletionResult,
  ArchivePinCursor,
  ArchivePinInput,
  ArchivePinPage,
  ArchivePinRecord,
  ArchiveQuarantineObjectInput,
  ArchiveRemovalInput,
  ArchiveScanCompletionInput,
  ArchiveScanRecord,
  ArchiveScanResult,
} from '../../archive-lifecycle';
import type { PostgresStoreContext } from '../store-context';
import { toPostgresStoreUnavailableError } from '../store-context';

const JOB_ID = /^(?:[a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/u;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const LEGACY_OWNER_HASH = /^[a-f0-9]{32,256}$/u;
const SAFE_ID = /^[A-Za-z0-9_.:@/-]{1,512}$/u;
const SAFE_CODE = /^[A-Za-z0-9_.:-]{1,128}$/u;
const MAX_LEASE_MS = 24 * 60 * 60 * 1000;
const MAX_ARCHIVE_OBJECTS = 100_000;
const MAX_ARCHIVE_ENVELOPE_BYTES = 64 * 1024;
const MAX_SCAN_EVIDENCE_BYTES = 64 * 1024;
const JOB_STATUSES = new Set<ArchiveJobStatus>([
  'created', 'uploading', 'quarantined', 'scanning', 'review_required', 'approved',
  'pinned', 'announced', 'rejected', 'takedown_pending', 'removed', 'failed',
]);
const SCAN_RESULTS = new Set<ArchiveScanResult>([
  'clean', 'malware', 'abuse_hash_match', 'flagged', 'error',
]);

interface JobRow extends QueryResultRow {
  job_id: unknown;
  idempotency_key: unknown;
  request_digest_hex: unknown;
  publication_id: unknown;
  content_id: unknown;
  owner_subject_hash_hex: unknown;
  tier: unknown;
  signed_job: unknown;
  identity_status: unknown;
  expected_bytes: unknown;
  received_bytes: unknown;
  status: unknown;
  last_error_code: unknown;
  lease_owner: unknown;
  leased_until: unknown;
  next_attempt_at: unknown;
  attempt_count: unknown;
  fencing_token: unknown;
  lifecycle_version: unknown;
  created_at: unknown;
  updated_at: unknown;
}

interface ObjectRow extends QueryResultRow {
  content_id: unknown;
  object_index: unknown;
  object_hash: unknown;
  object_bytes: unknown;
  quarantine_key: unknown;
  durable_key: unknown;
  storage_checksum: unknown;
  status: unknown;
  metadata_status: unknown;
  lifecycle_version: unknown;
}

interface ScanRow extends QueryResultRow {
  scan_id: unknown;
  job_id: unknown;
  engine: unknown;
  engine_version: unknown;
  definitions_version: unknown;
  result: unknown;
  result_code: unknown;
  evidence: unknown;
  started_at: unknown;
  completed_at: unknown;
  lifecycle_version: unknown;
}

interface PinRow extends QueryResultRow {
  publication_id: unknown;
  content_id: unknown;
  host_id: unknown;
  state: unknown;
  last_verified_at: unknown;
  disabled_at: unknown;
  deletion_verified_at: unknown;
  lifecycle_version: unknown;
}

interface AggregateRow extends QueryResultRow {
  count: unknown;
  bytes: unknown;
  invalid: unknown;
}

interface LegacyReadinessRow extends QueryResultRow {
  legacy_jobs: unknown;
  legacy_leases: unknown;
  legacy_active_pins: unknown;
  legacy_objects: unknown;
  legacy_object_contents: unknown;
}

export interface ArchiveLegacyReadiness {
  legacyJobs: number;
  legacyLeases: number;
  legacyActivePins: number;
  legacyObjects: number;
  legacyObjectContents: number;
}

function text(name: string, value: unknown, pattern?: RegExp): string {
  if (typeof value !== 'string' || value.length === 0 || (pattern && !pattern.test(value))) {
    throw new Error(`PostgreSQL archive ${name} is invalid`);
  }
  return value;
}

function optionalText(name: string, value: unknown): string | null {
  if (value === null) return null;
  return text(name, value);
}

function legacyText(name: string, value: unknown): string {
  if (typeof value !== 'string') throw new Error(`PostgreSQL archive ${name} is invalid`);
  return value;
}

function legacyOptionalText(name: string, value: unknown): string | null {
  return value === null ? null : legacyText(name, value);
}

function safeInteger(name: string, value: unknown): number {
  const parsed = typeof value === 'bigint' ? Number(value)
    : typeof value === 'string' && /^\d+$/u.test(value) ? Number(value)
      : typeof value === 'number' ? value : Number.NaN;
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`PostgreSQL archive ${name} is invalid`);
  }
  return parsed;
}

function iso(name: string, value: unknown): string {
  const parsed = value instanceof Date ? value : new Date(String(value));
  if (!Number.isFinite(parsed.getTime())) throw new Error(`PostgreSQL archive ${name} is invalid`);
  return parsed.toISOString();
}

function nullableIso(name: string, value: unknown): string | null {
  return value === null ? null : iso(name, value);
}

function jsonObject(name: string, value: unknown): Record<string, unknown> {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      throw new Error(`PostgreSQL archive ${name} is invalid JSON`);
    }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`PostgreSQL archive ${name} is not an object`);
  }
  return parsed as Record<string, unknown>;
}

function signedJob(value: unknown): SignedArchiveJob | null {
  if (value === null) return null;
  const parsed = jsonObject('signed job', value) as unknown as SignedArchiveJob;
  if (verifyArchiveJob(parsed) !== 'ok') throw new Error('PostgreSQL archive signed job is invalid');
  return parsed;
}

function mapJob(row: JobRow): ArchiveJobRecord {
  const status = text('job status', row.status);
  if (!JOB_STATUSES.has(status as ArchiveJobStatus)) {
    throw new Error('PostgreSQL archive job status is unsupported');
  }
  const tier = text('job tier', row.tier);
  if (tier !== 'self_host' && tier !== 'managed') {
    throw new Error('PostgreSQL archive job tier is unsupported');
  }
  const jobId = text('job id', row.job_id, JOB_ID);
  const publicationId = text('publication id', row.publication_id);
  const contentId = text('content id', row.content_id);
  const identityStatus = text('job identity status', row.identity_status);
  if (identityStatus !== 'verified' && identityStatus !== 'legacy_unbound') {
    throw new Error('PostgreSQL archive job identity status is unsupported');
  }
  const requestDigestHex = row.request_digest_hex === null
    ? null
    : text('request digest', row.request_digest_hex, SHA256);
  const signed = signedJob(row.signed_job);
  if (identityStatus === 'verified' && (signed === null || requestDigestHex === null)) {
    throw new Error('PostgreSQL verified archive identity is incomplete');
  }
  if (identityStatus === 'legacy_unbound' && signed !== null && requestDigestHex !== null) {
    throw new Error('PostgreSQL legacy archive identity is unexpectedly complete');
  }
  if (signed !== null && (signed.job.jobId !== jobId || signed.job.publicationId !== publicationId
    || signed.job.contentId !== contentId || signed.job.tier !== tier)) {
    throw new Error('PostgreSQL archive signed job does not match typed columns');
  }
  const leasedUntil = row.leased_until === null ? null : new Date(iso('leased_until', row.leased_until)).getTime();
  const ownerSubjectHashHex = text(
    'owner subject hash',
    row.owner_subject_hash_hex,
    identityStatus === 'verified' ? SHA256 : LEGACY_OWNER_HASH,
  );
  return {
    jobId,
    idempotencyKey: text('idempotency key', row.idempotency_key),
    requestDigestHex,
    publicationId,
    contentId,
    ownerSubjectHashHex,
    tier,
    signedJob: signed,
    identityStatus: identityStatus as ArchiveJobIdentityStatus,
    expectedBytes: safeInteger('expected bytes', row.expected_bytes),
    receivedBytes: safeInteger('received bytes', row.received_bytes),
    status: status as ArchiveJobStatus,
    lastErrorCode: optionalText('last error code', row.last_error_code),
    leaseOwner: optionalText('lease owner', row.lease_owner),
    leasedUntilMs: leasedUntil,
    nextAttemptAtMs: new Date(iso('next_attempt_at', row.next_attempt_at)).getTime(),
    attemptCount: safeInteger('attempt count', row.attempt_count),
    fencingToken: safeInteger('fencing token', row.fencing_token),
    lifecycleVersion: safeInteger('lifecycle version', row.lifecycle_version),
    createdAt: iso('created_at', row.created_at),
    updatedAt: iso('updated_at', row.updated_at),
  };
}

function mapObject(row: ObjectRow): ArchiveObjectRecord {
  const status = text('object status', row.status);
  if (!['uploading', 'quarantined', 'verified', 'durable', 'deleting', 'deleted', 'failed'].includes(status)) {
    throw new Error('PostgreSQL archive object status is unsupported');
  }
  const metadataStatus = text('object metadata status', row.metadata_status);
  if (metadataStatus !== 'verified' && metadataStatus !== 'legacy_unbound') {
    throw new Error('PostgreSQL archive object metadata status is unsupported');
  }
  const objectIndex = safeInteger('object index', row.object_index);
  const objectBytes = safeInteger('object bytes', row.object_bytes);
  const objectHash = metadataStatus === 'verified'
    ? text('object hash', row.object_hash, SHA256)
    : legacyText('legacy object hash', row.object_hash);
  const quarantineKey = metadataStatus === 'verified'
    ? text('quarantine key', row.quarantine_key, SAFE_ID)
    : legacyText('legacy quarantine key', row.quarantine_key);
  const durableKey = metadataStatus === 'verified'
    ? optionalText('durable key', row.durable_key)
    : legacyOptionalText('legacy durable key', row.durable_key);
  const storageChecksum = metadataStatus === 'verified'
    ? optionalText('storage checksum', row.storage_checksum)
    : legacyOptionalText('legacy storage checksum', row.storage_checksum);
  if (metadataStatus === 'verified' && (objectIndex >= MAX_ARCHIVE_OBJECTS || objectBytes === 0
    || (durableKey !== null && !SAFE_ID.test(durableKey))
    || (storageChecksum !== null && !SHA256.test(storageChecksum)))) {
    throw new Error('PostgreSQL verified archive object metadata is incoherent');
  }
  return {
    contentId: text('object content id', row.content_id),
    objectIndex,
    objectHash,
    objectBytes,
    quarantineKey,
    durableKey,
    storageChecksum,
    status: status as ArchiveObjectRecord['status'],
    metadataStatus: metadataStatus as ArchiveObjectMetadataStatus,
    lifecycleVersion: safeInteger('object lifecycle version', row.lifecycle_version),
  };
}

function mapScan(row: ScanRow): ArchiveScanRecord {
  const result = text('scan result', row.result);
  if (!SCAN_RESULTS.has(result as ArchiveScanResult)) {
    throw new Error('PostgreSQL archive scan result is unsupported');
  }
  return {
    scanId: text('scan id', row.scan_id),
    jobId: text('scan job id', row.job_id, JOB_ID),
    engine: text('scan engine', row.engine),
    engineVersion: text('scan engine version', row.engine_version),
    definitionsVersion: optionalText('scan definitions version', row.definitions_version),
    result: result as ArchiveScanResult,
    resultCode: optionalText('scan result code', row.result_code),
    evidence: jsonObject('scan evidence', row.evidence),
    startedAt: iso('scan started_at', row.started_at),
    completedAt: iso('scan completed_at', row.completed_at),
    lifecycleVersion: safeInteger('scan lifecycle version', row.lifecycle_version),
  };
}

function mapPin(row: PinRow): ArchivePinRecord {
  const state = text('pin state', row.state);
  if (!['pinning', 'active', 'removing', 'removed', 'error'].includes(state)) {
    throw new Error('PostgreSQL archive pin state is unsupported');
  }
  return {
    publicationId: text('pin publication id', row.publication_id),
    contentId: text('pin content id', row.content_id),
    hostId: text('pin host id', row.host_id),
    state: state as ArchivePinRecord['state'],
    lastVerifiedAt: nullableIso('pin last_verified_at', row.last_verified_at),
    disabledAt: nullableIso('pin disabled_at', row.disabled_at),
    deletionVerifiedAt: nullableIso('pin deletion_verified_at', row.deletion_verified_at),
    lifecycleVersion: safeInteger('pin lifecycle version', row.lifecycle_version),
  };
}

function assertPattern(name: string, value: string, pattern: RegExp): void {
  if (!pattern.test(value)) throw new TypeError(`${name} is invalid`);
}

function positive(name: string, value: number, maximum = Number.MAX_SAFE_INTEGER): void {
  if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) {
    throw new TypeError(`${name} must be a positive safe integer`);
  }
}

function nonnegative(name: string, value: number, maximum = Number.MAX_SAFE_INTEGER): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
    throw new TypeError(`${name} must be a non-negative safe integer`);
  }
}

function validateLease(input: ArchiveLeaseInput): void {
  assertPattern('archive job id', input.jobId, JOB_ID);
  assertPattern('archive worker id', input.workerId, SAFE_ID);
  positive('archive fencing token', input.fencingToken);
  nonnegative('archive clock', input.nowMs);
}

function jobProjection(alias = 'j'): string {
  return `${alias}.job_id, ${alias}.idempotency_key, ${alias}.request_digest_hex,
    ${alias}.publication_id, ${alias}.content_id,
    encode(${alias}.owner_subject_hash, 'hex') AS owner_subject_hash_hex,
    ${alias}.tier, ${alias}.signed_job, ${alias}.identity_status,
    ${alias}.expected_bytes, ${alias}.received_bytes,
    ${alias}.status, ${alias}.last_error_code, ${alias}.lease_owner, ${alias}.leased_until,
    ${alias}.next_attempt_at, ${alias}.attempt_count, ${alias}.fencing_token,
    ${alias}.lifecycle_version, ${alias}.created_at, ${alias}.updated_at`;
}

function objectProjection(alias = 'o'): string {
  return `${alias}.content_id, ${alias}.object_index, ${alias}.object_hash,
    ${alias}.object_bytes, ${alias}.quarantine_key, ${alias}.durable_key,
    ${alias}.storage_checksum, ${alias}.status, ${alias}.metadata_status,
    ${alias}.lifecycle_version`;
}

function pinProjection(alias = 'p'): string {
  return `${alias}.publication_id, ${alias}.content_id, ${alias}.host_id, ${alias}.state,
    ${alias}.last_verified_at, ${alias}.disabled_at, ${alias}.deletion_verified_at,
    ${alias}.lifecycle_version`;
}

/** PostgreSQL source of truth for archive jobs, objects, scans, leases, and pins. */
export class PostgresArchiveLifecycleStore implements ArchiveLifecycleStore {
  constructor(private readonly context: PostgresStoreContext) {}

  private async query<Row extends QueryResultRow = QueryResultRow>(
    operation: string,
    sql: string,
    values: readonly unknown[] = [],
  ): Promise<QueryResult<Row>> {
    try {
      return await this.context.query<Row>(sql, values);
    } catch (error) {
      throw toPostgresStoreUnavailableError(operation, error);
    }
  }

  private async transaction<T>(operation: string, callback: () => Promise<T>): Promise<T> {
    try {
      return await this.context.transaction(callback);
    } catch (error) {
      throw toPostgresStoreUnavailableError(operation, error);
    }
  }

  async enqueue(input: ArchiveEnqueueInput): Promise<ArchiveEnqueueResult> {
    if (verifyArchiveJob(input.signedJob) !== 'ok') throw new TypeError('archive signed job is invalid');
    assertPattern('archive job id', input.signedJob.job.jobId, JOB_ID);
    assertPattern('archive idempotency key', input.idempotencyKey, SAFE_ID);
    assertPattern('archive request digest', input.requestDigestHex, SHA256);
    assertPattern('archive owner subject hash', input.ownerSubjectHashHex, SHA256);
    nonnegative('archive expected bytes', input.expectedBytes);
    if (input.ownerCapBytes !== undefined) nonnegative('archive owner cap bytes', input.ownerCapBytes);
    nonnegative('archive clock', input.nowMs);
    const signedJson = JSON.stringify(input.signedJob);
    if (Buffer.byteLength(signedJson, 'utf8') > MAX_ARCHIVE_ENVELOPE_BYTES) {
      throw new TypeError('archive signed job exceeds the metadata limit');
    }
    try {
      return await this.context.withAdvisoryTransactionLock(
        'archive-owner-quota',
        input.ownerSubjectHashHex,
        async () => {
      const existing = await this.query<JobRow>(
        'read archive idempotency conflict',
        `SELECT ${jobProjection('j')} FROM archive.jobs j
         WHERE j.idempotency_key = $1 OR j.job_id = $2
            OR (j.publication_id = $3 AND j.content_id = $4)
         ORDER BY CASE WHEN j.idempotency_key = $1 THEN 0 ELSE 1 END
         LIMIT 1 FOR UPDATE`,
        [input.idempotencyKey, input.signedJob.job.jobId,
          input.signedJob.job.publicationId, input.signedJob.job.contentId],
      );
      if (existing.rows[0]) {
        const mapped = mapJob(existing.rows[0]);
        return mapped.requestDigestHex === input.requestDigestHex
          && mapped.jobId === input.signedJob.job.jobId
          ? { status: 'replay' as const, job: mapped }
          : { status: 'conflict' as const };
      }
      if (input.ownerCapBytes !== undefined) {
        const quota = await this.query<{ used_bytes: string }>(
          'reserve archive owner quota',
          `SELECT COALESCE(SUM(expected_bytes), 0)::text AS used_bytes
           FROM archive.jobs
           WHERE owner_subject_hash = decode($1, 'hex')
             AND identity_status = 'verified'
             AND status <> 'removed'`,
          [input.ownerSubjectHashHex],
        );
        const usedBytes = Number(quota.rows[0]?.used_bytes ?? 0);
        if (!Number.isSafeInteger(usedBytes) || usedBytes < 0) {
          throw new Error('archive owner quota exceeds the safe integer range');
        }
        if (usedBytes + input.expectedBytes > input.ownerCapBytes) {
          return { status: 'quota_exceeded' as const };
        }
      }
      const inserted = await this.query<JobRow>(
        'insert archive job',
        `INSERT INTO archive.jobs AS j (
           job_id, idempotency_key, request_digest_hex, publication_id, content_id,
           owner_subject_hash, tier, status, rights_json, rights_signature,
           signed_job, job_signature, identity_status, expected_bytes, next_attempt_at
         ) VALUES (
           $1, $2, $3, $4, $5, decode($6, 'hex'), $7, 'created', $8::jsonb, $9,
           $10::jsonb, $11, 'verified', $12, clock_timestamp()
         ) ON CONFLICT DO NOTHING
         RETURNING ${jobProjection('j')}`,
        [
          input.signedJob.job.jobId, input.idempotencyKey, input.requestDigestHex,
          input.signedJob.job.publicationId, input.signedJob.job.contentId,
          input.ownerSubjectHashHex, input.signedJob.job.tier,
          JSON.stringify(input.signedJob.job.rights), input.signedJob.rightsSignature,
          signedJson, input.signedJob.signature, input.expectedBytes,
        ],
      );
      if (inserted.rows[0]) return { status: 'created', job: mapJob(inserted.rows[0]) };
      const raced = await this.query<JobRow>(
        'read archive idempotency conflict',
        `SELECT ${jobProjection('j')} FROM archive.jobs j
         WHERE j.idempotency_key = $1 OR j.job_id = $2
            OR (j.publication_id = $3 AND j.content_id = $4)
         ORDER BY CASE WHEN j.idempotency_key = $1 THEN 0 ELSE 1 END
         LIMIT 1 FOR UPDATE`,
        [input.idempotencyKey, input.signedJob.job.jobId,
          input.signedJob.job.publicationId, input.signedJob.job.contentId],
      );
      const row = raced.rows[0];
      if (!row) throw new Error('archive insert conflict did not resolve to an existing row');
      const mapped = mapJob(row);
      return mapped.requestDigestHex === input.requestDigestHex
        && mapped.jobId === input.signedJob.job.jobId
        ? { status: 'replay', job: mapped }
        : { status: 'conflict' };
        },
      );
    } catch (error) {
      throw toPostgresStoreUnavailableError('enqueue archive job', error);
    }
  }

  async getJob(jobId: string): Promise<ArchiveJobRecord | null> {
    if (!JOB_ID.test(jobId)) return null;
    const result = await this.query<JobRow>(
      'get archive job',
      `SELECT ${jobProjection('j')} FROM archive.jobs j WHERE j.job_id = $1`,
      [jobId],
    );
    return result.rows[0] ? mapJob(result.rows[0]) : null;
  }

  async usedBytesForOwner(ownerSubjectHashHex: string): Promise<number> {
    if (!SHA256.test(ownerSubjectHashHex)) return 0;
    const result = await this.query<{ used_bytes: string }>(
      'sum archive owner quota',
      `SELECT COALESCE(SUM(expected_bytes), 0)::text AS used_bytes
       FROM archive.jobs
       WHERE owner_subject_hash = decode($1, 'hex')
         AND identity_status = 'verified'
         AND status <> 'removed'`,
      [ownerSubjectHashHex],
    );
    const used = Number(result.rows[0]?.used_bytes ?? 0);
    if (!Number.isSafeInteger(used) || used < 0) {
      throw new Error('archive owner quota exceeds the safe integer range');
    }
    return used;
  }

  async recordQuarantineObject(input: ArchiveQuarantineObjectInput): Promise<ArchiveObjectRecord | null> {
    assertPattern('archive job id', input.jobId, JOB_ID);
    positive('archive expected job version', input.expectedJobVersion);
    nonnegative('archive object index', input.objectIndex, MAX_ARCHIVE_OBJECTS - 1);
    assertPattern('archive object hash', input.objectHash, SHA256);
    positive('archive object bytes', input.objectBytes);
    assertPattern('archive quarantine key', input.quarantineKey, SAFE_ID);
    nonnegative('archive clock', input.nowMs);
    return this.transaction('record archive quarantine object', async () => {
      const jobs = await this.query<JobRow>(
        'lock archive upload job',
        `SELECT ${jobProjection('j')} FROM archive.jobs j WHERE j.job_id = $1 FOR UPDATE`,
        [input.jobId],
      );
      const job = jobs.rows[0] ? mapJob(jobs.rows[0]) : null;
      if (!job || job.identityStatus !== 'verified'
        || job.lifecycleVersion !== input.expectedJobVersion
        || (job.status !== 'created' && job.status !== 'uploading')) return null;
      await this.query(
        'lock archive content object',
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [JSON.stringify(['archive-object', job.contentId, input.objectIndex])],
      );
      const existing = await this.query<ObjectRow>(
        'read archive quarantine object',
        `SELECT ${objectProjection('o')} FROM archive.objects o
         WHERE o.content_id = $1 AND o.object_index = $2 FOR UPDATE`,
        [job.contentId, input.objectIndex],
      );
      if (existing.rows[0]) {
        const object = mapObject(existing.rows[0]);
        if (object.metadataStatus !== 'verified'
          || object.objectHash !== input.objectHash || object.objectBytes !== input.objectBytes
          || object.quarantineKey !== input.quarantineKey) return null;
        const aggregate = await this.query<AggregateRow>(
          'sum shared archive objects',
          `SELECT
             count(*) FILTER (WHERE metadata_status = 'verified')::bigint AS count,
             COALESCE(sum(object_bytes) FILTER (
               WHERE metadata_status = 'verified'
             ), 0)::bigint AS bytes,
             count(*) FILTER (
               WHERE metadata_status <> 'verified'
                 OR status NOT IN ('quarantined','verified','durable')
             )::bigint AS invalid
           FROM archive.objects WHERE content_id = $1`,
          [job.contentId],
        );
        const bytes = safeInteger('shared object bytes', aggregate.rows[0]?.bytes ?? 0);
        const invalid = safeInteger('invalid shared object count', aggregate.rows[0]?.invalid ?? 0);
        if (invalid !== 0 || bytes > job.expectedBytes) return null;
        if (bytes !== job.receivedBytes) {
          await this.query(
            'update archive shared upload accounting',
            `UPDATE archive.jobs SET received_bytes = $2, status = 'uploading',
               lifecycle_version = lifecycle_version + 1, updated_at = clock_timestamp()
             WHERE job_id = $1`,
            [job.jobId, bytes],
          );
        }
        return object;
      }
      if (job.receivedBytes + input.objectBytes > job.expectedBytes) return null;
      const object = await this.query<ObjectRow>(
        'insert archive quarantine object',
        `INSERT INTO archive.objects AS o (
           content_id, object_index, object_hash, object_bytes, quarantine_key, status,
           metadata_status
         ) VALUES ($1, $2, $3, $4, $5, 'quarantined', 'verified')
         RETURNING ${objectProjection('o')}`,
        [job.contentId, input.objectIndex, input.objectHash, input.objectBytes, input.quarantineKey],
      );
      await this.query(
        'update archive upload accounting',
        `UPDATE archive.jobs SET received_bytes = received_bytes + $2, status = 'uploading',
           lifecycle_version = lifecycle_version + 1, updated_at = clock_timestamp()
         WHERE job_id = $1`,
        [job.jobId, input.objectBytes],
      );
      return object.rows[0] ? mapObject(object.rows[0]) : null;
    });
  }

  async listObjects(jobId: string): Promise<ArchiveObjectRecord[]> {
    if (!JOB_ID.test(jobId)) return [];
    const result = await this.query<ObjectRow>(
      'list archive objects',
      `SELECT ${objectProjection('o')} FROM archive.objects o
       JOIN archive.jobs j ON j.content_id = o.content_id
       WHERE j.job_id = $1 ORDER BY o.object_index ASC`,
      [jobId],
    );
    return result.rows.map(mapObject);
  }

  async listObjectsForContent(contentId: string): Promise<ArchiveObjectRecord[]> {
    assertPattern('archive content id', contentId, SAFE_ID);
    const result = await this.query<ObjectRow>(
      'list archive objects for content',
      `SELECT ${objectProjection('o')} FROM archive.objects o
       WHERE o.content_id = $1 ORDER BY o.object_index ASC`,
      [contentId],
    );
    return result.rows.map(mapObject);
  }

  async markQuarantined(
    jobId: string,
    expectedJobVersion: number,
    nowMs: number,
  ): Promise<ArchiveJobRecord | null> {
    assertPattern('archive job id', jobId, JOB_ID);
    positive('archive expected job version', expectedJobVersion);
    nonnegative('archive clock', nowMs);
    return this.transaction('complete archive upload', async () => {
      const jobs = await this.query<JobRow>(
        'lock archive upload completion',
        `SELECT ${jobProjection('j')} FROM archive.jobs j WHERE j.job_id = $1 FOR UPDATE`,
        [jobId],
      );
      const job = jobs.rows[0] ? mapJob(jobs.rows[0]) : null;
      if (!job || job.identityStatus !== 'verified'
        || job.lifecycleVersion !== expectedJobVersion
        || (job.status !== 'created' && job.status !== 'uploading')
        || job.receivedBytes !== job.expectedBytes) return null;
      const objects = await this.query<AggregateRow>(
        'validate archive upload objects',
        `SELECT
           count(*) FILTER (WHERE metadata_status = 'verified')::bigint AS count,
           COALESCE(sum(object_bytes) FILTER (
             WHERE metadata_status = 'verified'
           ), 0)::bigint AS bytes,
           count(*) FILTER (
             WHERE metadata_status <> 'verified'
               OR status NOT IN ('quarantined','verified','durable')
           )::bigint AS invalid
         FROM archive.objects WHERE content_id = $1`,
        [job.contentId],
      );
      const aggregate = objects.rows[0];
      if (!aggregate || safeInteger('invalid object count', aggregate.invalid) !== 0
        || safeInteger('object bytes', aggregate.bytes) !== job.expectedBytes
        || (job.expectedBytes > 0 && safeInteger('object count', aggregate.count) === 0)) return null;
      const updated = await this.query<JobRow>(
        'mark archive job quarantined',
        `UPDATE archive.jobs AS j SET status = 'quarantined', next_attempt_at = clock_timestamp(),
           lifecycle_version = j.lifecycle_version + 1, updated_at = clock_timestamp()
         WHERE j.job_id = $1 RETURNING ${jobProjection('j')}`,
        [jobId],
      );
      return updated.rows[0] ? mapJob(updated.rows[0]) : null;
    });
  }

  async claimJobs(input: ArchiveJobClaimInput): Promise<ArchiveJobClaim[]> {
    assertPattern('archive worker id', input.workerId, SAFE_ID);
    positive('archive claim limit', input.limit, 1000);
    positive('archive lease duration', input.leaseMs, MAX_LEASE_MS);
    nonnegative('archive clock', input.nowMs);
    if (input.eligibleStatuses.length === 0
      || input.eligibleStatuses.some((status) => !JOB_STATUSES.has(status))) {
      throw new TypeError('archive eligible statuses are invalid');
    }
    const result = await this.query<JobRow>(
      'claim archive jobs',
      `WITH candidates AS (
         SELECT candidate.job_id FROM archive.jobs candidate
         WHERE candidate.identity_status = 'verified'
           AND candidate.status = ANY($1::text[])
           AND NOT EXISTS (
             SELECT 1 FROM archive.objects o
             WHERE o.content_id = candidate.content_id
               AND o.metadata_status <> 'verified'
           )
           AND candidate.next_attempt_at <= clock_timestamp()
           AND (candidate.lease_owner IS NULL OR candidate.leased_until <= clock_timestamp())
         ORDER BY candidate.created_at ASC, candidate.job_id ASC
         FOR UPDATE SKIP LOCKED LIMIT $2
       )
       UPDATE archive.jobs j SET
         lease_owner = $3,
         leased_until = clock_timestamp() + ($4::bigint * interval '1 millisecond'),
         fencing_token = j.fencing_token + 1,
         attempt_count = j.attempt_count + 1,
         status = CASE WHEN j.status = 'quarantined' THEN 'scanning' ELSE j.status END,
         lifecycle_version = j.lifecycle_version + 1,
         updated_at = clock_timestamp()
       FROM candidates c WHERE j.job_id = c.job_id
       RETURNING ${jobProjection('j')}`,
      [input.eligibleStatuses, input.limit, input.workerId, input.leaseMs],
    );
    return result.rows.map((row) => {
      const job = mapJob(row);
      return { job, fencingToken: job.fencingToken };
    });
  }

  async completeScan(input: ArchiveScanCompletionInput): Promise<ArchiveJobRecord | null> {
    validateLease(input);
    assertPattern('archive scan id', input.scanId, UUID);
    assertPattern('archive scan engine', input.engine, SAFE_CODE);
    assertPattern('archive scan engine version', input.engineVersion, SAFE_CODE);
    if (input.definitionsVersion) assertPattern('archive definitions version', input.definitionsVersion, SAFE_CODE);
    if (input.resultCode) assertPattern('archive result code', input.resultCode, SAFE_CODE);
    if (!SCAN_RESULTS.has(input.result)) throw new TypeError('archive scan result is invalid');
    const started = Date.parse(input.startedAt);
    const completed = Date.parse(input.completedAt);
    if (!Number.isFinite(started) || !Number.isFinite(completed) || completed < started) {
      throw new TypeError('archive scan timestamps are invalid');
    }
    const retryDelayMs = input.result === 'error' ? (input.retryAtMs ?? 0) - input.nowMs : 0;
    if (input.result === 'error' && (!Number.isSafeInteger(retryDelayMs) || retryDelayMs <= 0)) {
      throw new TypeError('archive retry time is invalid');
    }
    let evidenceJson: string;
    try {
      evidenceJson = JSON.stringify(input.evidence ?? {});
    } catch (error) {
      throw new TypeError('archive scan evidence must be JSON serializable', { cause: error });
    }
    if (Buffer.byteLength(evidenceJson, 'utf8') > MAX_SCAN_EVIDENCE_BYTES) {
      throw new TypeError('archive scan evidence exceeds the metadata limit');
    }
    return this.transaction('complete archive scan', async () => {
      const jobs = await this.query<JobRow>(
        'lock archive scan lease',
         `SELECT ${jobProjection('j')} FROM archive.jobs j
         WHERE j.job_id = $1 AND j.lease_owner = $2 AND j.fencing_token = $3
           AND j.identity_status = 'verified'
           AND j.leased_until > clock_timestamp() AND j.status = 'scanning'
         FOR UPDATE`,
        [input.jobId, input.workerId, input.fencingToken],
      );
      if (!jobs.rows[0]) return null;
      const inserted = await this.query(
        'insert archive scan result',
        `INSERT INTO archive.scans (
           scan_id, job_id, engine, engine_version, definitions_version, result,
           result_code, evidence, started_at, completed_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::timestamptz, $10::timestamptz)
         ON CONFLICT (scan_id) DO NOTHING`,
        [input.scanId, input.jobId, input.engine, input.engineVersion,
          input.definitionsVersion ?? null, input.result, input.resultCode ?? null,
          evidenceJson, new Date(started).toISOString(), new Date(completed).toISOString()],
      );
      if (inserted.rowCount !== 1) return null;
      const status = input.result === 'clean' ? 'approved'
        : input.result === 'error' ? 'quarantined' : 'rejected';
      const lastError = input.result === 'clean' ? null
        : input.resultCode ?? (input.result === 'error' ? 'scanner_unavailable' : input.result);
      const updated = await this.query<JobRow>(
        'commit archive scan result',
        `UPDATE archive.jobs AS j SET status = $4, last_error_code = $5,
           next_attempt_at = CASE WHEN $4 = 'quarantined'
             THEN clock_timestamp() + ($6::bigint * interval '1 millisecond')
             ELSE j.next_attempt_at END,
           lease_owner = NULL, leased_until = NULL,
           lifecycle_version = j.lifecycle_version + 1, updated_at = clock_timestamp()
         WHERE j.job_id = $1 AND j.lease_owner = $2 AND j.fencing_token = $3
           AND j.identity_status = 'verified' AND j.leased_until > clock_timestamp()
         RETURNING ${jobProjection('j')}`,
        [input.jobId, input.workerId, input.fencingToken, status, lastError, retryDelayMs],
      );
      return updated.rows[0] ? mapJob(updated.rows[0]) : null;
    });
  }

  async listScans(jobId: string, limit = 100): Promise<ArchiveScanRecord[]> {
    assertPattern('archive job id', jobId, JOB_ID);
    positive('archive scan list limit', limit, 1000);
    const result = await this.query<ScanRow>(
      'list archive scans',
      `SELECT scan_id, job_id, engine, engine_version, definitions_version, result,
         result_code, evidence, started_at, completed_at, lifecycle_version
       FROM archive.scans WHERE job_id = $1
       ORDER BY started_at DESC, scan_id DESC LIMIT $2`,
      [jobId, limit],
    );
    return result.rows.map(mapScan);
  }

  async markObjectDurable(input: ArchiveDurableObjectInput): Promise<ArchiveObjectRecord | null> {
    validateLease(input);
    nonnegative('archive object index', input.objectIndex, MAX_ARCHIVE_OBJECTS - 1);
    assertPattern('archive durable key', input.durableKey, SAFE_ID);
    assertPattern('archive storage checksum', input.storageChecksum, SHA256);
    return this.transaction('promote archive object', async () => {
      const jobs = await this.query<JobRow>(
        'lock archive promotion lease',
         `SELECT ${jobProjection('j')} FROM archive.jobs j
         WHERE j.job_id = $1 AND j.lease_owner = $2 AND j.fencing_token = $3
           AND j.identity_status = 'verified'
           AND j.leased_until > clock_timestamp() AND j.status = 'approved'
         FOR UPDATE`,
        [input.jobId, input.workerId, input.fencingToken],
      );
      const job = jobs.rows[0] ? mapJob(jobs.rows[0]) : null;
      if (!job) return null;
      const objects = await this.query<ObjectRow>(
        'lock archive promotion object',
        `SELECT ${objectProjection('o')} FROM archive.objects o
         WHERE o.content_id = $1 AND o.object_index = $2 FOR UPDATE`,
        [job.contentId, input.objectIndex],
      );
      const object = objects.rows[0] ? mapObject(objects.rows[0]) : null;
      if (!object || object.metadataStatus !== 'verified') return null;
      if (object.status === 'durable') {
        return object.durableKey === input.durableKey
          && object.storageChecksum === input.storageChecksum ? object : null;
      }
      if (object.status !== 'quarantined' && object.status !== 'verified') return null;
      const updated = await this.query<ObjectRow>(
        'mark archive object durable',
        `UPDATE archive.objects AS o SET status = 'durable', durable_key = $3,
           storage_checksum = $4, lifecycle_version = o.lifecycle_version + 1
         WHERE o.content_id = $1 AND o.object_index = $2
           AND o.metadata_status = 'verified'
         RETURNING ${objectProjection('o')}`,
        [job.contentId, input.objectIndex, input.durableKey, input.storageChecksum],
      );
      await this.query(
        'advance archive job after object promotion',
        `UPDATE archive.jobs SET lifecycle_version = lifecycle_version + 1,
           updated_at = clock_timestamp() WHERE job_id = $1`,
        [job.jobId],
      );
      return updated.rows[0] ? mapObject(updated.rows[0]) : null;
    });
  }

  async markObjectDeleted(input: ArchiveDeleteObjectInput): Promise<ArchiveObjectDeletionResult> {
    validateLease(input);
    nonnegative('archive object index', input.objectIndex, MAX_ARCHIVE_OBJECTS - 1);
    if (typeof input.absenceVerified !== 'boolean') {
      throw new TypeError('archive object absence verification is invalid');
    }
    return this.transaction('delete archive object metadata', async () => {
      const jobs = await this.query<JobRow>(
        'lock archive deletion lease',
         `SELECT ${jobProjection('j')} FROM archive.jobs j
         WHERE j.job_id = $1 AND j.lease_owner = $2 AND j.fencing_token = $3
           AND j.identity_status = 'verified'
           AND j.leased_until > clock_timestamp() AND j.status = 'takedown_pending'
         FOR UPDATE`,
        [input.jobId, input.workerId, input.fencingToken],
      );
      const job = jobs.rows[0] ? mapJob(jobs.rows[0]) : null;
      if (!job) return null;
      await this.query(
        'lock archive deletion object',
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [JSON.stringify(['archive-object', job.contentId, input.objectIndex])],
      );
      const objects = await this.query<ObjectRow>(
        'read archive deletion object',
        `SELECT ${objectProjection('o')} FROM archive.objects o
         WHERE o.content_id = $1 AND o.object_index = $2 FOR UPDATE`,
        [job.contentId, input.objectIndex],
      );
      const object = objects.rows[0] ? mapObject(objects.rows[0]) : null;
      if (!object || object.metadataStatus !== 'verified') return null;
      const shared = await this.query<{ shared: boolean } & QueryResultRow>(
        'check archive object references',
        `SELECT EXISTS (
           SELECT 1 FROM archive.jobs
           WHERE job_id <> $1 AND content_id = $2
             AND status IN (
               'created','uploading','quarantined','scanning','review_required',
               'approved','pinned','announced'
             )
         ) AS shared`,
        [job.jobId, job.contentId],
      );
      if (shared.rows[0]?.shared === true) return { status: 'shared', object };
      if (!input.absenceVerified) return null;
      if (object.status === 'deleted') return { status: 'deleted', object };
      const updated = await this.query<ObjectRow>(
        'mark archive object deleted',
        `UPDATE archive.objects AS o SET status = 'deleted',
           lifecycle_version = o.lifecycle_version + 1
         WHERE o.content_id = $1 AND o.object_index = $2
           AND o.metadata_status = 'verified'
         RETURNING ${objectProjection('o')}`,
        [job.contentId, input.objectIndex],
      );
      await this.query(
        'advance archive deletion lifecycle',
        `UPDATE archive.jobs SET lifecycle_version = lifecycle_version + 1,
           updated_at = clock_timestamp() WHERE job_id = $1`,
        [job.jobId],
      );
      return updated.rows[0] ? { status: 'deleted', object: mapObject(updated.rows[0]) } : null;
    });
  }

  async activatePin(input: ArchivePinInput): Promise<ArchivePinRecord | null> {
    validateLease(input);
    assertPattern('archive host id', input.hostId, SAFE_ID);
    return this.transaction('activate archive pin', async () => {
      const jobs = await this.query<JobRow>(
        'lock archive pin lease',
         `SELECT ${jobProjection('j')} FROM archive.jobs j
         WHERE j.job_id = $1 AND j.lease_owner = $2 AND j.fencing_token = $3
           AND j.identity_status = 'verified'
           AND j.leased_until > clock_timestamp() AND j.status = 'approved'
         FOR UPDATE`,
        [input.jobId, input.workerId, input.fencingToken],
      );
      const job = jobs.rows[0] ? mapJob(jobs.rows[0]) : null;
      if (!job) return null;
      await this.query(
        'lock archive publication host pin',
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [JSON.stringify(['archive-pin', job.publicationId, input.hostId])],
      );
      const check = await this.query<AggregateRow>(
        'validate archive durable objects and scan',
        `SELECT
           count(*) FILTER (WHERE metadata_status = 'verified')::bigint AS count,
           COALESCE(sum(object_bytes) FILTER (
             WHERE metadata_status = 'verified'
           ), 0)::bigint AS bytes,
           count(*) FILTER (
             WHERE metadata_status <> 'verified' OR status <> 'durable'
           )::bigint AS invalid
         FROM archive.objects WHERE content_id = $1`,
        [job.contentId],
      );
      const aggregate = check.rows[0];
      if (!aggregate || safeInteger('non-durable objects', aggregate.invalid) !== 0
        || safeInteger('durable bytes', aggregate.bytes) !== job.expectedBytes
        || (job.expectedBytes > 0 && safeInteger('durable object count', aggregate.count) === 0)) return null;
      const scans = await this.query<{ clean: boolean } & QueryResultRow>(
        'validate archive clean scan',
        `SELECT EXISTS (
           SELECT 1 FROM archive.scans WHERE job_id = $1 AND result = 'clean'
         ) AS clean`,
        [job.jobId],
      );
      if (scans.rows[0]?.clean !== true) return null;
      const pins = await this.query<PinRow>(
        'upsert archive active pin',
        `INSERT INTO archive.pins AS p (
           publication_id, content_id, host_id, state, last_verified_at
         ) VALUES ($1, $2, $3, 'active', clock_timestamp())
         ON CONFLICT (publication_id, host_id) DO UPDATE SET
           content_id = EXCLUDED.content_id, state = 'active',
           last_verified_at = clock_timestamp(), disabled_at = NULL,
           deletion_verified_at = NULL,
           lifecycle_version = p.lifecycle_version + 1
         WHERE p.content_id = EXCLUDED.content_id OR p.state = 'removed'
         RETURNING ${pinProjection('p')}`,
        [job.publicationId, job.contentId, input.hostId],
      );
      if (!pins.rows[0]) return null;
      await this.query(
        'commit archive pin activation',
        `UPDATE archive.jobs SET status = 'pinned', lease_owner = NULL, leased_until = NULL,
           lifecycle_version = lifecycle_version + 1, updated_at = clock_timestamp()
         WHERE job_id = $1`,
        [job.jobId],
      );
      return mapPin(pins.rows[0]);
    });
  }

  async markAnnounced(input: ArchiveLeaseInput): Promise<ArchiveJobRecord | null> {
    validateLease(input);
    const result = await this.query<JobRow>(
      'mark archive job announced',
      `UPDATE archive.jobs j SET status = 'announced', lease_owner = NULL, leased_until = NULL,
         lifecycle_version = j.lifecycle_version + 1, updated_at = clock_timestamp()
       WHERE j.job_id = $1 AND j.lease_owner = $2 AND j.fencing_token = $3
         AND j.identity_status = 'verified'
         AND j.leased_until > clock_timestamp() AND j.status = 'pinned'
         AND EXISTS (
           SELECT 1 FROM archive.pins p WHERE p.publication_id = j.publication_id
             AND p.content_id = j.content_id AND p.state = 'active'
         )
       RETURNING ${jobProjection('j')}`,
      [input.jobId, input.workerId, input.fencingToken],
    );
    return result.rows[0] ? mapJob(result.rows[0]) : null;
  }

  async requestTakedown(jobId: string, nowMs: number): Promise<ArchiveJobRecord | null> {
    assertPattern('archive job id', jobId, JOB_ID);
    nonnegative('archive clock', nowMs);
    return this.transaction('request archive takedown', async () => {
      const jobs = await this.query<JobRow>(
        'lock archive takedown job',
        `SELECT ${jobProjection('j')} FROM archive.jobs j WHERE j.job_id = $1 FOR UPDATE`,
        [jobId],
      );
      const job = jobs.rows[0] ? mapJob(jobs.rows[0]) : null;
      if (!job) return null;
      if (job.status === 'takedown_pending' || job.status === 'removed') return job;
      await this.query(
        'disable archive pins before deletion',
        `UPDATE archive.pins SET state = 'removing', disabled_at = clock_timestamp(),
           lifecycle_version = lifecycle_version + 1
         WHERE publication_id = $1 AND content_id = $2 AND state <> 'removed'`,
        [job.publicationId, job.contentId],
      );
      const updated = await this.query<JobRow>(
        'mark archive takedown pending',
        `UPDATE archive.jobs AS j SET status = 'takedown_pending', lease_owner = NULL,
           leased_until = NULL, lifecycle_version = j.lifecycle_version + 1,
           updated_at = clock_timestamp() WHERE j.job_id = $1
         RETURNING ${jobProjection('j')}`,
        [jobId],
      );
      return updated.rows[0] ? mapJob(updated.rows[0]) : null;
    });
  }

  async confirmRemoval(input: ArchiveRemovalInput): Promise<ArchiveJobRecord | null> {
    validateLease(input);
    if (input.hostId !== null) assertPattern('archive host id', input.hostId, SAFE_ID);
    return this.transaction('confirm archive removal', async () => {
      const jobs = await this.query<JobRow>(
        'lock archive removal job',
         `SELECT ${jobProjection('j')} FROM archive.jobs j
         WHERE j.job_id = $1 AND j.lease_owner = $2 AND j.fencing_token = $3
           AND j.identity_status = 'verified'
           AND j.leased_until > clock_timestamp() AND j.status = 'takedown_pending'
         FOR UPDATE`,
        [input.jobId, input.workerId, input.fencingToken],
      );
      const job = jobs.rows[0] ? mapJob(jobs.rows[0]) : null;
      if (!job) return null;
      if (input.hostId !== null) {
        const pin = await this.query(
          'confirm archive pin removal',
          `UPDATE archive.pins SET state = 'removed', deletion_verified_at = clock_timestamp(),
             lifecycle_version = lifecycle_version + 1
           WHERE publication_id = $1 AND content_id = $2 AND host_id = $3 AND state = 'removing'`,
          [job.publicationId, job.contentId, input.hostId],
        );
        if (pin.rowCount !== 1) return null;
      } else {
        const pins = await this.query<{ count: unknown } & QueryResultRow>(
          'check unconfirmed archive pins',
          `SELECT count(*)::bigint AS count FROM archive.pins
           WHERE publication_id = $1 AND content_id = $2 AND state <> 'removed'`,
          [job.publicationId, job.contentId],
        );
        if (safeInteger('unconfirmed pin count', pins.rows[0]?.count ?? 0) !== 0) return null;
      }
      const remaining = await this.query<{ remaining: boolean } & QueryResultRow>(
        'check archive removal completion',
        `SELECT EXISTS (
           SELECT 1 FROM archive.pins WHERE publication_id = $1 AND content_id = $2
             AND state <> 'removed'
         ) AS remaining`,
        [job.publicationId, job.contentId],
      );
      if (remaining.rows[0]?.remaining === true) return job;
      const shared = await this.query<{ shared: boolean } & QueryResultRow>(
        'check archive removal shared references',
        `SELECT EXISTS (
           SELECT 1 FROM archive.jobs WHERE job_id <> $1 AND content_id = $2
             AND status IN (
               'created','uploading','quarantined','scanning','review_required',
               'approved','pinned','announced'
             )
         ) AS shared`,
        [job.jobId, job.contentId],
      );
      if (shared.rows[0]?.shared !== true) {
        const objects = await this.query<{ count: unknown } & QueryResultRow>(
          'check archive deletion verification',
          `SELECT count(*)::bigint AS count FROM archive.objects
           WHERE content_id = $1 AND status <> 'deleted'`,
          [job.contentId],
        );
        if (safeInteger('undeleted object count', objects.rows[0]?.count ?? 0) !== 0) return null;
      }
      const updated = await this.query<JobRow>(
        'finish archive removal',
        `UPDATE archive.jobs AS j SET status = 'removed', lifecycle_version = j.lifecycle_version + 1,
           lease_owner = NULL, leased_until = NULL, updated_at = clock_timestamp()
         WHERE j.job_id = $1
         RETURNING ${jobProjection('j')}`,
        [input.jobId],
      );
      return updated.rows[0] ? mapJob(updated.rows[0]) : null;
    });
  }

  async isServeable(publicationId: string, hostId: string): Promise<boolean> {
    assertPattern('archive publication id', publicationId, SAFE_ID);
    assertPattern('archive host id', hostId, SAFE_ID);
    const result = await this.query<{ serveable: boolean } & QueryResultRow>(
      'check archive serveability',
      `SELECT EXISTS (
         SELECT 1 FROM archive.pins p
         JOIN archive.jobs j ON j.publication_id = p.publication_id AND j.content_id = p.content_id
         WHERE p.publication_id = $1 AND p.host_id = $2 AND p.state = 'active'
           AND j.identity_status = 'verified'
           AND j.status IN ('pinned','announced')
           AND NOT EXISTS (
             SELECT 1 FROM archive.objects o
             WHERE o.content_id = j.content_id
               AND (o.metadata_status <> 'verified' OR o.status <> 'durable')
           )
           AND (j.expected_bytes = 0 OR EXISTS (
             SELECT 1 FROM archive.objects o
             WHERE o.content_id = j.content_id AND o.metadata_status = 'verified'
           ))
       ) AS serveable`,
      [publicationId, hostId],
    );
    return result.rows[0]?.serveable === true;
  }

  async listActiveHosts(
    publicationId: string,
    options: { limit?: number; cursor?: ArchiveHostCursor } = {},
  ): Promise<ArchiveHostPage> {
    assertPattern('archive publication id', publicationId, SAFE_ID);
    const limit = options.limit ?? 100;
    positive('archive host list limit', limit, 1000);
    if (options.cursor && !Number.isFinite(Date.parse(options.cursor.lastVerifiedAt))) {
      throw new TypeError('archive host cursor is invalid');
    }
    const result = await this.query<PinRow>(
      'list active archive hosts',
      `SELECT ${pinProjection('p')} FROM archive.pins p
       JOIN archive.jobs j
         ON j.publication_id = p.publication_id AND j.content_id = p.content_id
       WHERE p.publication_id = $1 AND p.state = 'active'
         AND j.identity_status = 'verified'
         AND j.status IN ('pinned','announced')
         AND NOT EXISTS (
           SELECT 1 FROM archive.objects o
           WHERE o.content_id = j.content_id AND o.metadata_status <> 'verified'
         )
         AND p.last_verified_at IS NOT NULL
         AND ($2::timestamptz IS NULL OR
           (p.last_verified_at, p.publication_id, p.host_id) < ($2::timestamptz, $3, $4))
       ORDER BY p.last_verified_at DESC, p.publication_id DESC, p.host_id DESC
       LIMIT $5`,
      [publicationId, options.cursor?.lastVerifiedAt ?? null,
        options.cursor?.publicationId ?? '', options.cursor?.hostId ?? '', limit + 1],
    );
    const mapped = result.rows.map(mapPin);
    const records = mapped.slice(0, limit);
    const last = records.at(-1);
    return {
      records,
      nextCursor: mapped.length > limit && last
        ? {
          lastVerifiedAt: last.lastVerifiedAt!,
          publicationId: last.publicationId,
          hostId: last.hostId,
        }
        : null,
    };
  }

  async listPinsForHost(
    hostId: string,
    options: { limit?: number; cursor?: ArchivePinCursor } = {},
  ): Promise<ArchivePinPage> {
    assertPattern('archive host id', hostId, SAFE_ID);
    const limit = options.limit ?? 100;
    positive('archive pin list limit', limit, 1000);
    if (options.cursor) assertPattern('archive pin cursor', options.cursor.publicationId, SAFE_ID);
    const result = await this.query<PinRow>(
      'list host archive pins',
      `SELECT ${pinProjection('p')} FROM archive.pins p
       WHERE p.host_id = $1
         AND ($2::text IS NULL OR p.publication_id > $2)
       ORDER BY p.publication_id ASC, p.content_id ASC
       LIMIT $3`,
      [hostId, options.cursor?.publicationId ?? null, limit + 1],
    );
    const mapped = result.rows.map(mapPin);
    const records = mapped.slice(0, limit);
    const last = records.at(-1);
    return {
      records,
      nextCursor: mapped.length > limit && last ? { publicationId: last.publicationId } : null,
    };
  }

  /** Counts identity or object metadata rows that require an explicit drain decision. */
  async getLegacyReadiness(): Promise<ArchiveLegacyReadiness> {
    const result = await this.query<LegacyReadinessRow>(
      'read archive legacy readiness',
      `SELECT
         (SELECT count(*)::bigint FROM archive.jobs
          WHERE identity_status = 'legacy_unbound') AS legacy_jobs,
         (SELECT count(*)::bigint FROM archive.jobs
          WHERE identity_status = 'legacy_unbound'
            AND (lease_owner IS NOT NULL OR leased_until IS NOT NULL)) AS legacy_leases,
         (SELECT count(*)::bigint FROM archive.pins p
          WHERE p.state = 'active' AND EXISTS (
            SELECT 1 FROM archive.jobs j
            WHERE j.publication_id = p.publication_id
              AND j.content_id = p.content_id
              AND j.identity_status = 'legacy_unbound'
          )) AS legacy_active_pins,
         (SELECT count(*)::bigint FROM archive.objects
          WHERE metadata_status = 'legacy_unbound') AS legacy_objects,
         (SELECT count(DISTINCT content_id)::bigint FROM archive.objects
          WHERE metadata_status = 'legacy_unbound') AS legacy_object_contents`,
    );
    const row = result.rows[0];
    return {
      legacyJobs: safeInteger('legacy job count', row?.legacy_jobs ?? 0),
      legacyLeases: safeInteger('legacy lease count', row?.legacy_leases ?? 0),
      legacyActivePins: safeInteger('legacy active pin count', row?.legacy_active_pins ?? 0),
      legacyObjects: safeInteger('legacy object count', row?.legacy_objects ?? 0),
      legacyObjectContents: safeInteger(
        'legacy object content count',
        row?.legacy_object_contents ?? 0,
      ),
    };
  }
}
