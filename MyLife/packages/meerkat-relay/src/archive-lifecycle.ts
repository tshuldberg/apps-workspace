/**
 * Durable archive lifecycle contracts for Plan 43 and the Plan 44 PostgreSQL cutover.
 *
 * The state machine deliberately owns compound transitions. Callers cannot make a
 * quarantine object serveable, approve a job without a clean scan, or commit work
 * after a lease has expired. File mode supplies its clock explicitly. PostgreSQL
 * implementations ignore caller clocks and use database time.
 */

import { verifyArchiveJob, type SignedArchiveJob } from '@mylife/sync';

export type ArchiveJobStatus =
  | 'created'
  | 'uploading'
  | 'quarantined'
  | 'scanning'
  | 'review_required'
  | 'approved'
  | 'pinned'
  | 'announced'
  | 'rejected'
  | 'takedown_pending'
  | 'removed'
  | 'failed';

export type ArchiveObjectStatus =
  | 'uploading'
  | 'quarantined'
  | 'verified'
  | 'durable'
  | 'deleting'
  | 'deleted'
  | 'failed';

export type ArchiveScanResult = 'clean' | 'malware' | 'abuse_hash_match' | 'flagged' | 'error';
export type ArchivePinState = 'pinning' | 'active' | 'removing' | 'removed' | 'error';
export type ArchiveJobIdentityStatus = 'verified' | 'legacy_unbound';
export type ArchiveObjectMetadataStatus = 'verified' | 'legacy_unbound';

export interface ArchiveJobRecord {
  jobId: string;
  idempotencyKey: string;
  /** Null only for a pre-digest row retained for explicit operator draining. */
  requestDigestHex: string | null;
  publicationId: string;
  contentId: string;
  ownerSubjectHashHex: string;
  tier: 'self_host' | 'managed';
  /** Null only for an unsigned legacy row. It must never enter claim or serve paths. */
  signedJob: SignedArchiveJob | null;
  identityStatus: ArchiveJobIdentityStatus;
  expectedBytes: number;
  receivedBytes: number;
  status: ArchiveJobStatus;
  lastErrorCode: string | null;
  leaseOwner: string | null;
  leasedUntilMs: number | null;
  nextAttemptAtMs: number;
  attemptCount: number;
  fencingToken: number;
  lifecycleVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface ArchiveObjectRecord {
  contentId: string;
  objectIndex: number;
  objectHash: string;
  objectBytes: number;
  quarantineKey: string;
  durableKey: string | null;
  storageChecksum: string | null;
  status: ArchiveObjectStatus;
  metadataStatus: ArchiveObjectMetadataStatus;
  lifecycleVersion: number;
}

export interface ArchiveScanRecord {
  scanId: string;
  jobId: string;
  engine: string;
  engineVersion: string;
  definitionsVersion: string | null;
  result: ArchiveScanResult;
  resultCode: string | null;
  evidence: Record<string, unknown>;
  startedAt: string;
  completedAt: string;
  lifecycleVersion: number;
}

export interface ArchivePinRecord {
  publicationId: string;
  contentId: string;
  hostId: string;
  state: ArchivePinState;
  lastVerifiedAt: string | null;
  disabledAt: string | null;
  deletionVerifiedAt: string | null;
  lifecycleVersion: number;
}

export interface ArchiveEnqueueInput {
  signedJob: SignedArchiveJob;
  idempotencyKey: string;
  requestDigestHex: string;
  ownerSubjectHashHex: string;
  expectedBytes: number;
  /** Atomic owner reservation ceiling. Omit only for internal/self-host callers without quotas. */
  ownerCapBytes?: number;
  nowMs: number;
}

export type ArchiveEnqueueResult =
  | { status: 'created'; job: ArchiveJobRecord }
  | { status: 'replay'; job: ArchiveJobRecord }
  | { status: 'conflict' }
  | { status: 'quota_exceeded' };

export interface ArchiveQuarantineObjectInput {
  jobId: string;
  expectedJobVersion: number;
  objectIndex: number;
  objectHash: string;
  objectBytes: number;
  quarantineKey: string;
  nowMs: number;
}

export interface ArchiveJobClaimInput {
  workerId: string;
  eligibleStatuses: readonly ArchiveJobStatus[];
  limit: number;
  leaseMs: number;
  nowMs: number;
}

export interface ArchiveJobClaim {
  job: ArchiveJobRecord;
  fencingToken: number;
}

export interface ArchiveLeaseInput {
  jobId: string;
  workerId: string;
  fencingToken: number;
  nowMs: number;
}

export interface ArchiveScanCompletionInput extends ArchiveLeaseInput {
  scanId: string;
  engine: string;
  engineVersion: string;
  definitionsVersion?: string | null;
  result: ArchiveScanResult;
  resultCode?: string | null;
  evidence?: Record<string, unknown>;
  startedAt: string;
  completedAt: string;
  retryAtMs?: number;
}

export interface ArchiveDurableObjectInput extends ArchiveLeaseInput {
  objectIndex: number;
  durableKey: string;
  storageChecksum: string;
}

export interface ArchiveDeleteObjectInput extends ArchiveLeaseInput {
  objectIndex: number;
  /** Set only after the object adapter has verified that every stored version is absent. */
  absenceVerified: boolean;
}

export type ArchiveObjectDeletionResult =
  | { status: 'deleted'; object: ArchiveObjectRecord }
  | { status: 'shared'; object: ArchiveObjectRecord }
  | null;

export interface ArchivePinInput extends ArchiveLeaseInput {
  hostId: string;
}

export interface ArchiveRemovalInput extends ArchiveLeaseInput {
  /** Null is valid when the job never reached a host pin. */
  hostId: string | null;
}

export interface ArchiveHostCursor {
  lastVerifiedAt: string;
  publicationId: string;
  hostId: string;
}

export interface ArchiveHostPage {
  records: ArchivePinRecord[];
  nextCursor: ArchiveHostCursor | null;
}

/** A stable, publicationId-ordered cursor over one host's pin records (reconciliation scan). */
export interface ArchivePinCursor {
  publicationId: string;
}

export interface ArchivePinPage {
  records: ArchivePinRecord[];
  nextCursor: ArchivePinCursor | null;
}

export interface ArchiveLifecycleLedger {
  version: 1;
  jobs: Record<string, ArchiveJobRecord>;
  idempotency: Record<string, { requestDigestHex: string; jobId: string }>;
  objects: Record<string, ArchiveObjectRecord>;
  scans: Record<string, ArchiveScanRecord>;
  pins: Record<string, ArchivePinRecord>;
}

export interface ArchiveJobStore {
  enqueue(input: ArchiveEnqueueInput): ArchiveEnqueueResult | Promise<ArchiveEnqueueResult>;
  getJob(jobId: string): ArchiveJobRecord | null | Promise<ArchiveJobRecord | null>;
  /**
   * Total bytes still reserved by one verified archive owner. Removed jobs release their quota;
   * every other lifecycle state remains charged so retries and failed scans cannot overbook it.
   */
  usedBytesForOwner(ownerSubjectHashHex: string): number | Promise<number>;
  markQuarantined(
    jobId: string,
    expectedJobVersion: number,
    nowMs: number,
  ): ArchiveJobRecord | null | Promise<ArchiveJobRecord | null>;
  claimJobs(input: ArchiveJobClaimInput): ArchiveJobClaim[] | Promise<ArchiveJobClaim[]>;
  completeScan(input: ArchiveScanCompletionInput): ArchiveJobRecord | null | Promise<ArchiveJobRecord | null>;
  requestTakedown(
    jobId: string,
    nowMs: number,
  ): ArchiveJobRecord | null | Promise<ArchiveJobRecord | null>;
}

export interface ArchiveObjectStore {
  recordQuarantineObject(
    input: ArchiveQuarantineObjectInput,
  ): ArchiveObjectRecord | null | Promise<ArchiveObjectRecord | null>;
  markObjectDurable(
    input: ArchiveDurableObjectInput,
  ): ArchiveObjectRecord | null | Promise<ArchiveObjectRecord | null>;
  markObjectDeleted(
    input: ArchiveDeleteObjectInput,
  ): ArchiveObjectDeletionResult | Promise<ArchiveObjectDeletionResult>;
  listObjects(jobId: string): ArchiveObjectRecord[] | Promise<ArchiveObjectRecord[]>;
  /**
   * List every object row for a content id (the dedup key), independent of any single job. The pin
   * reconciler's byte-presence probe uses this to check a pin's durable bytes without a jobId (a pin
   * carries contentId, not jobId).
   */
  listObjectsForContent(contentId: string): ArchiveObjectRecord[] | Promise<ArchiveObjectRecord[]>;
}

export interface ArchiveScanStore {
  listScans(jobId: string, limit?: number): ArchiveScanRecord[] | Promise<ArchiveScanRecord[]>;
}

export interface ArchivePinStore {
  activatePin(input: ArchivePinInput): ArchivePinRecord | null | Promise<ArchivePinRecord | null>;
  markAnnounced(input: ArchiveLeaseInput): ArchiveJobRecord | null | Promise<ArchiveJobRecord | null>;
  confirmRemoval(input: ArchiveRemovalInput): ArchiveJobRecord | null | Promise<ArchiveJobRecord | null>;
  isServeable(publicationId: string, hostId: string): boolean | Promise<boolean>;
  listActiveHosts(
    publicationId: string,
    options?: { limit?: number; cursor?: ArchiveHostCursor },
  ): ArchiveHostPage | Promise<ArchiveHostPage>;
  /**
   * Page every pin record this host holds (any state), ordered by publicationId, for the pin
   * reconciler. Unlike listActiveHosts (per-publication, active only), this enumerates the whole
   * host's pin intent so the reconciler can repair drift in BOTH directions: an `active` pin whose
   * bytes/serving entry are missing, and a `removed`/`removing` pin whose serving entry lingers.
   */
  listPinsForHost(
    hostId: string,
    options?: { limit?: number; cursor?: ArchivePinCursor },
  ): ArchivePinPage | Promise<ArchivePinPage>;
}

export interface ArchiveLifecycleStore
  extends ArchiveJobStore, ArchiveObjectStore, ArchiveScanStore, ArchivePinStore {}

const JOB_ID = /^(?:[a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/u;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const SAFE_ID = /^[A-Za-z0-9_.:@/-]{1,512}$/u;
const SAFE_CODE = /^[A-Za-z0-9_.:-]{1,128}$/u;
const MAX_BYTES = Number.MAX_SAFE_INTEGER;
const MAX_LEASE_MS = 24 * 60 * 60 * 1000;
const MAX_ARCHIVE_OBJECTS = 100_000;
const MAX_ARCHIVE_ENVELOPE_BYTES = 64 * 1024;
const MAX_SCAN_EVIDENCE_BYTES = 64 * 1024;
const ALL_JOB_STATUSES = new Set<ArchiveJobStatus>([
  'created', 'uploading', 'quarantined', 'scanning', 'review_required', 'approved',
  'pinned', 'announced', 'rejected', 'takedown_pending', 'removed', 'failed',
]);
const BYTE_REFERENCE_STATUSES = new Set<ArchiveJobStatus>([
  'created', 'uploading', 'quarantined', 'scanning', 'review_required',
  'approved', 'pinned', 'announced',
]);

function clone<T>(value: T): T {
  return structuredClone(value);
}

function timestamp(nowMs: number): string {
  assertClock(nowMs);
  return new Date(nowMs).toISOString();
}

function assertClock(nowMs: number): void {
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) throw new TypeError('archive clock is invalid');
}

function assertPositiveInteger(name: string, value: number, maximum = MAX_BYTES): void {
  if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) {
    throw new TypeError(`${name} must be a positive safe integer`);
  }
}

function assertNonnegativeInteger(name: string, value: number, maximum = MAX_BYTES): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
    throw new TypeError(`${name} must be a non-negative safe integer`);
  }
}

function assertPattern(name: string, value: string, pattern: RegExp): void {
  if (!pattern.test(value)) throw new TypeError(`${name} is invalid`);
}

function objectKey(contentId: string, objectIndex: number): string {
  return `${contentId}:${objectIndex}`;
}

function pinKey(publicationId: string, hostId: string): string {
  return `${publicationId}:${hostId}`;
}

function validateEnqueue(input: ArchiveEnqueueInput): void {
  if (verifyArchiveJob(input.signedJob) !== 'ok') {
    throw new TypeError('archive signed job is invalid or lacks rights and consent');
  }
  assertPattern('archive job id', input.signedJob.job.jobId, JOB_ID);
  assertPattern('archive idempotency key', input.idempotencyKey, SAFE_ID);
  assertPattern('archive request digest', input.requestDigestHex, SHA256);
  assertPattern('archive owner subject hash', input.ownerSubjectHashHex, SHA256);
  assertNonnegativeInteger('archive expected bytes', input.expectedBytes);
  if (input.ownerCapBytes !== undefined) {
    assertNonnegativeInteger('archive owner cap bytes', input.ownerCapBytes);
  }
  assertClock(input.nowMs);
  if (Buffer.byteLength(JSON.stringify(input.signedJob), 'utf8') > MAX_ARCHIVE_ENVELOPE_BYTES) {
    throw new TypeError('archive signed job exceeds the metadata limit');
  }
}

function validateClaim(input: ArchiveJobClaimInput): void {
  assertPattern('archive worker id', input.workerId, SAFE_ID);
  assertPositiveInteger('archive claim limit', input.limit, 1000);
  assertPositiveInteger('archive lease duration', input.leaseMs, MAX_LEASE_MS);
  assertClock(input.nowMs);
  if (input.eligibleStatuses.length === 0
    || input.eligibleStatuses.some((status) => !ALL_JOB_STATUSES.has(status))) {
    throw new TypeError('archive eligible statuses are invalid');
  }
}

function validateLease(input: ArchiveLeaseInput): void {
  assertPattern('archive job id', input.jobId, JOB_ID);
  assertPattern('archive worker id', input.workerId, SAFE_ID);
  assertPositiveInteger('archive fencing token', input.fencingToken);
  assertClock(input.nowMs);
}

function hasVerifiedObjectMetadata(object: ArchiveObjectRecord): boolean {
  return Number.isSafeInteger(object.objectIndex)
    && object.objectIndex >= 0
    && object.objectIndex < MAX_ARCHIVE_OBJECTS
    && Number.isSafeInteger(object.objectBytes)
    && object.objectBytes > 0
    && SHA256.test(object.objectHash)
    && SAFE_ID.test(object.quarantineKey)
    && (object.durableKey === null || SAFE_ID.test(object.durableKey))
    && (object.storageChecksum === null || SHA256.test(object.storageChecksum));
}

function assertIso(name: string, value: string): void {
  if (!value || !Number.isFinite(Date.parse(value))) throw new TypeError(`${name} is invalid`);
}

export function emptyArchiveLifecycleLedger(): ArchiveLifecycleLedger {
  return { version: 1, jobs: {}, idempotency: {}, objects: {}, scans: {}, pins: {} };
}

/** Pure state machine shared by memory and crash-safe file stores. */
export class ArchiveLifecycleStateMachine implements ArchiveLifecycleStore {
  private readonly ledger: ArchiveLifecycleLedger;

  constructor(ledger: ArchiveLifecycleLedger = emptyArchiveLifecycleLedger()) {
    this.ledger = ledger;
    for (const job of Object.values(this.ledger.jobs)) {
      const prior = job as ArchiveJobRecord & { identityStatus?: ArchiveJobIdentityStatus };
      const identityIsVerified = prior.signedJob !== null
        && verifyArchiveJob(prior.signedJob) === 'ok'
        && typeof prior.requestDigestHex === 'string'
        && SHA256.test(prior.requestDigestHex);
      if (prior.identityStatus === undefined) {
        prior.identityStatus = identityIsVerified ? 'verified' : 'legacy_unbound';
      } else if (prior.identityStatus === 'verified' && !identityIsVerified) {
        prior.identityStatus = 'legacy_unbound';
      }
    }
    for (const object of Object.values(this.ledger.objects)) {
      const prior = object as ArchiveObjectRecord & {
        metadataStatus?: ArchiveObjectMetadataStatus;
      };
      const metadataIsVerified = hasVerifiedObjectMetadata(prior);
      if (prior.metadataStatus === undefined) {
        prior.metadataStatus = metadataIsVerified ? 'verified' : 'legacy_unbound';
      } else if (prior.metadataStatus === 'verified' && !metadataIsVerified) {
        prior.metadataStatus = 'legacy_unbound';
      }
    }
  }

  snapshot(): ArchiveLifecycleLedger {
    return clone(this.ledger);
  }

  enqueue(input: ArchiveEnqueueInput): ArchiveEnqueueResult {
    validateEnqueue(input);
    const prior = this.ledger.idempotency[input.idempotencyKey];
    if (prior) {
      if (prior.requestDigestHex !== input.requestDigestHex) return { status: 'conflict' };
      const replay = this.ledger.jobs[prior.jobId];
      if (!replay) throw new Error('archive idempotency record references a missing job');
      return { status: 'replay', job: clone(replay) };
    }
    const { job } = input.signedJob;
    const existingJob = this.ledger.jobs[job.jobId];
    if (existingJob) {
      if (existingJob.requestDigestHex !== input.requestDigestHex) return { status: 'conflict' };
      this.ledger.idempotency[input.idempotencyKey] = {
        requestDigestHex: input.requestDigestHex,
        jobId: job.jobId,
      };
      return { status: 'replay', job: clone(existingJob) };
    }
    if (input.ownerCapBytes !== undefined
      && this.usedBytesForOwner(input.ownerSubjectHashHex) + input.expectedBytes > input.ownerCapBytes) {
      return { status: 'quota_exceeded' };
    }
    const now = timestamp(input.nowMs);
    const record: ArchiveJobRecord = {
      jobId: job.jobId,
      idempotencyKey: input.idempotencyKey,
      requestDigestHex: input.requestDigestHex,
      publicationId: job.publicationId,
      contentId: job.contentId,
      ownerSubjectHashHex: input.ownerSubjectHashHex,
      tier: job.tier,
      signedJob: clone(input.signedJob),
      identityStatus: 'verified',
      expectedBytes: input.expectedBytes,
      receivedBytes: 0,
      status: 'created',
      lastErrorCode: null,
      leaseOwner: null,
      leasedUntilMs: null,
      nextAttemptAtMs: input.nowMs,
      attemptCount: 0,
      fencingToken: 0,
      lifecycleVersion: 1,
      createdAt: now,
      updatedAt: now,
    };
    this.ledger.jobs[job.jobId] = record;
    this.ledger.idempotency[input.idempotencyKey] = {
      requestDigestHex: input.requestDigestHex,
      jobId: job.jobId,
    };
    return { status: 'created', job: clone(record) };
  }

  getJob(jobId: string): ArchiveJobRecord | null {
    if (!JOB_ID.test(jobId)) return null;
    const job = this.ledger.jobs[jobId];
    return job ? clone(job) : null;
  }

  usedBytesForOwner(ownerSubjectHashHex: string): number {
    if (!SHA256.test(ownerSubjectHashHex)) return 0;
    return Object.values(this.ledger.jobs)
      .filter((job) => job.identityStatus === 'verified'
        && job.ownerSubjectHashHex === ownerSubjectHashHex
        && job.status !== 'removed')
      .reduce((total, job) => total + job.expectedBytes, 0);
  }

  recordQuarantineObject(input: ArchiveQuarantineObjectInput): ArchiveObjectRecord | null {
    assertPattern('archive job id', input.jobId, JOB_ID);
    assertPositiveInteger('archive expected job version', input.expectedJobVersion);
    assertNonnegativeInteger('archive object index', input.objectIndex, MAX_ARCHIVE_OBJECTS - 1);
    assertPattern('archive object hash', input.objectHash, SHA256);
    assertPositiveInteger('archive object bytes', input.objectBytes);
    assertPattern('archive quarantine key', input.quarantineKey, SAFE_ID);
    assertClock(input.nowMs);
    const job = this.ledger.jobs[input.jobId];
    if (!job || job.identityStatus !== 'verified'
      || job.lifecycleVersion !== input.expectedJobVersion
      || (job.status !== 'created' && job.status !== 'uploading')) return null;
    const key = objectKey(job.contentId, input.objectIndex);
    const existing = this.ledger.objects[key];
    if (existing) {
      if (existing.metadataStatus !== 'verified'
        || existing.objectHash !== input.objectHash || existing.objectBytes !== input.objectBytes
        || existing.quarantineKey !== input.quarantineKey) return null;
      const sharedBytes = Object.values(this.ledger.objects)
        .filter((row) => row.contentId === job.contentId && row.metadataStatus === 'verified')
        .reduce((total, row) => total + row.objectBytes, 0);
      if (sharedBytes > job.expectedBytes) return null;
      if (job.receivedBytes !== sharedBytes) {
        job.receivedBytes = sharedBytes;
        job.status = 'uploading';
        job.lifecycleVersion += 1;
        job.updatedAt = timestamp(input.nowMs);
      }
      return clone(existing);
    }
    if (job.receivedBytes + input.objectBytes > job.expectedBytes) return null;
    const record: ArchiveObjectRecord = {
      contentId: job.contentId,
      objectIndex: input.objectIndex,
      objectHash: input.objectHash,
      objectBytes: input.objectBytes,
      quarantineKey: input.quarantineKey,
      durableKey: null,
      storageChecksum: null,
      status: 'quarantined',
      metadataStatus: 'verified',
      lifecycleVersion: 1,
    };
    this.ledger.objects[key] = record;
    job.receivedBytes += input.objectBytes;
    job.status = 'uploading';
    job.lifecycleVersion += 1;
    job.updatedAt = timestamp(input.nowMs);
    return clone(record);
  }

  listObjects(jobId: string): ArchiveObjectRecord[] {
    const job = this.ledger.jobs[jobId];
    if (!job) return [];
    return this.listObjectsForContent(job.contentId);
  }

  listObjectsForContent(contentId: string): ArchiveObjectRecord[] {
    return Object.values(this.ledger.objects)
      .filter((row) => row.contentId === contentId)
      .sort((a, b) => a.objectIndex - b.objectIndex)
      .map(clone);
  }

  markQuarantined(jobId: string, expectedJobVersion: number, nowMs: number): ArchiveJobRecord | null {
    assertPattern('archive job id', jobId, JOB_ID);
    assertPositiveInteger('archive expected job version', expectedJobVersion);
    assertClock(nowMs);
    const job = this.ledger.jobs[jobId];
    if (!job || job.identityStatus !== 'verified'
      || job.lifecycleVersion !== expectedJobVersion
      || (job.status !== 'created' && job.status !== 'uploading')
      || job.receivedBytes !== job.expectedBytes) return null;
    const objects = this.listObjects(jobId);
    if (job.expectedBytes > 0 && objects.length === 0) return null;
    if (objects.some((row) => row.metadataStatus !== 'verified'
      || (row.status !== 'quarantined'
        && row.status !== 'verified' && row.status !== 'durable'))) return null;
    job.status = 'quarantined';
    job.lifecycleVersion += 1;
    job.updatedAt = timestamp(nowMs);
    job.nextAttemptAtMs = nowMs;
    return clone(job);
  }

  claimJobs(input: ArchiveJobClaimInput): ArchiveJobClaim[] {
    validateClaim(input);
    const eligible = new Set(input.eligibleStatuses);
    const jobs = Object.values(this.ledger.jobs)
      .filter((job) => eligible.has(job.status)
        && job.identityStatus === 'verified'
        && !Object.values(this.ledger.objects).some((object) => (
          object.contentId === job.contentId && object.metadataStatus !== 'verified'
        ))
        && job.nextAttemptAtMs <= input.nowMs
        && (!job.leaseOwner || (job.leasedUntilMs ?? 0) <= input.nowMs))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.jobId.localeCompare(b.jobId))
      .slice(0, input.limit);
    return jobs.map((job) => {
      job.leaseOwner = input.workerId;
      job.leasedUntilMs = input.nowMs + input.leaseMs;
      job.fencingToken += 1;
      job.attemptCount += 1;
      job.status = job.status === 'quarantined' ? 'scanning' : job.status;
      job.lifecycleVersion += 1;
      job.updatedAt = timestamp(input.nowMs);
      return { job: clone(job), fencingToken: job.fencingToken };
    });
  }

  completeScan(input: ArchiveScanCompletionInput): ArchiveJobRecord | null {
    validateLease(input);
    assertPattern('archive scan id', input.scanId, UUID);
    assertPattern('archive scan engine', input.engine, SAFE_CODE);
    assertPattern('archive scan engine version', input.engineVersion, SAFE_CODE);
    if (input.definitionsVersion) {
      assertPattern('archive scan definitions version', input.definitionsVersion, SAFE_CODE);
    }
    if (input.resultCode) assertPattern('archive scan result code', input.resultCode, SAFE_CODE);
    assertIso('archive scan start time', input.startedAt);
    assertIso('archive scan completion time', input.completedAt);
    if (Date.parse(input.completedAt) < Date.parse(input.startedAt)) {
      throw new TypeError('archive scan completion predates its start');
    }
    const job = this.currentLease(input);
    if (!job || job.status !== 'scanning' || this.ledger.scans[input.scanId]) return null;
    if (input.result === 'error') {
      if (!Number.isSafeInteger(input.retryAtMs) || input.retryAtMs! <= input.nowMs) {
        throw new TypeError('archive scan retry time is invalid');
      }
    }
    let evidence: Record<string, unknown>;
    try {
      const serialized = JSON.stringify(input.evidence ?? {});
      if (Buffer.byteLength(serialized, 'utf8') > MAX_SCAN_EVIDENCE_BYTES) {
        throw new TypeError('archive scan evidence exceeds the metadata limit');
      }
      evidence = JSON.parse(serialized) as Record<string, unknown>;
    } catch (error) {
      throw new TypeError('archive scan evidence must be JSON serializable', { cause: error });
    }
    this.ledger.scans[input.scanId] = {
      scanId: input.scanId,
      jobId: input.jobId,
      engine: input.engine,
      engineVersion: input.engineVersion,
      definitionsVersion: input.definitionsVersion ?? null,
      result: input.result,
      resultCode: input.resultCode ?? null,
      evidence,
      startedAt: new Date(input.startedAt).toISOString(),
      completedAt: new Date(input.completedAt).toISOString(),
      lifecycleVersion: 1,
    };
    if (input.result === 'clean') job.status = 'approved';
    else if (input.result === 'error') {
      job.status = 'quarantined';
      job.nextAttemptAtMs = input.retryAtMs!;
      job.lastErrorCode = input.resultCode ?? 'scanner_unavailable';
    } else {
      job.status = 'rejected';
      job.lastErrorCode = input.resultCode ?? input.result;
    }
    this.releaseLease(job, input.nowMs);
    return clone(job);
  }

  listScans(jobId: string, limit = 100): ArchiveScanRecord[] {
    assertPositiveInteger('archive scan list limit', limit, 1000);
    return Object.values(this.ledger.scans)
      .filter((scan) => scan.jobId === jobId)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt) || b.scanId.localeCompare(a.scanId))
      .slice(0, limit)
      .map(clone);
  }

  markObjectDurable(input: ArchiveDurableObjectInput): ArchiveObjectRecord | null {
    validateLease(input);
    assertNonnegativeInteger('archive object index', input.objectIndex, MAX_ARCHIVE_OBJECTS - 1);
    assertPattern('archive durable key', input.durableKey, SAFE_ID);
    assertPattern('archive storage checksum', input.storageChecksum, SHA256);
    const job = this.currentLease(input);
    if (!job || job.status !== 'approved') return null;
    const object = this.ledger.objects[objectKey(job.contentId, input.objectIndex)];
    if (!object || object.metadataStatus !== 'verified') return null;
    if (object.status === 'durable') {
      return object.durableKey === input.durableKey
        && object.storageChecksum === input.storageChecksum ? clone(object) : null;
    }
    if (object.status !== 'quarantined' && object.status !== 'verified') return null;
    object.status = 'durable';
    object.durableKey = input.durableKey;
    object.storageChecksum = input.storageChecksum;
    object.lifecycleVersion += 1;
    job.lifecycleVersion += 1;
    job.updatedAt = timestamp(input.nowMs);
    return clone(object);
  }

  markObjectDeleted(input: ArchiveDeleteObjectInput): ArchiveObjectDeletionResult {
    validateLease(input);
    assertNonnegativeInteger('archive object index', input.objectIndex, MAX_ARCHIVE_OBJECTS - 1);
    if (typeof input.absenceVerified !== 'boolean') {
      throw new TypeError('archive object absence verification is invalid');
    }
    const job = this.currentLease(input);
    if (!job || job.status !== 'takedown_pending') return null;
    const object = this.ledger.objects[objectKey(job.contentId, input.objectIndex)];
    if (!object) return null;
    const shared = Object.values(this.ledger.jobs).some((candidate) => (
      candidate.jobId !== job.jobId
      && candidate.contentId === job.contentId
      && BYTE_REFERENCE_STATUSES.has(candidate.status)
    ));
    if (shared) return { status: 'shared', object: clone(object) };
    if (!input.absenceVerified) return null;
    if (object.status !== 'deleted') {
      object.status = 'deleted';
      object.lifecycleVersion += 1;
      job.lifecycleVersion += 1;
      job.updatedAt = timestamp(input.nowMs);
    }
    return { status: 'deleted', object: clone(object) };
  }

  activatePin(input: ArchivePinInput): ArchivePinRecord | null {
    validateLease(input);
    assertPattern('archive host id', input.hostId, SAFE_ID);
    const job = this.currentLease(input);
    if (!job || job.status !== 'approved') return null;
    const objects = this.listObjects(job.jobId);
    if ((job.expectedBytes > 0 && objects.length === 0)
      || objects.some((object) => object.metadataStatus !== 'verified'
        || object.status !== 'durable')) return null;
    const cleanScan = Object.values(this.ledger.scans)
      .some((scan) => scan.jobId === job.jobId && scan.result === 'clean');
    if (!cleanScan) return null;
    const now = timestamp(input.nowMs);
    const key = pinKey(job.publicationId, input.hostId);
    const existing = this.ledger.pins[key];
    if (existing && existing.contentId !== job.contentId && existing.state !== 'removed') return null;
    const pin: ArchivePinRecord = existing
      ? {
        ...existing,
        contentId: job.contentId,
        state: 'active',
        lastVerifiedAt: now,
        disabledAt: null,
        deletionVerifiedAt: null,
        lifecycleVersion: existing.lifecycleVersion + 1,
      }
      : {
        publicationId: job.publicationId,
        contentId: job.contentId,
        hostId: input.hostId,
        state: 'active',
        lastVerifiedAt: now,
        disabledAt: null,
        deletionVerifiedAt: null,
        lifecycleVersion: 1,
      };
    this.ledger.pins[key] = pin;
    job.status = 'pinned';
    this.releaseLease(job, input.nowMs);
    return clone(pin);
  }

  markAnnounced(input: ArchiveLeaseInput): ArchiveJobRecord | null {
    validateLease(input);
    const job = this.currentLease(input);
    if (!job || job.status !== 'pinned') return null;
    const hasActivePin = Object.values(this.ledger.pins)
      .some((pin) => pin.publicationId === job.publicationId
        && pin.contentId === job.contentId && pin.state === 'active');
    if (!hasActivePin) return null;
    job.status = 'announced';
    this.releaseLease(job, input.nowMs);
    return clone(job);
  }

  requestTakedown(jobId: string, nowMs: number): ArchiveJobRecord | null {
    assertPattern('archive job id', jobId, JOB_ID);
    assertClock(nowMs);
    const job = this.ledger.jobs[jobId];
    if (!job) return null;
    if (job.status === 'takedown_pending' || job.status === 'removed') return clone(job);
    const now = timestamp(nowMs);
    for (const pin of Object.values(this.ledger.pins)) {
      if (pin.publicationId !== job.publicationId || pin.contentId !== job.contentId
        || pin.state === 'removed') continue;
      pin.state = 'removing';
      pin.disabledAt = now;
      pin.lifecycleVersion += 1;
    }
    job.status = 'takedown_pending';
    job.leaseOwner = null;
    job.leasedUntilMs = null;
    job.lifecycleVersion += 1;
    job.updatedAt = now;
    return clone(job);
  }

  confirmRemoval(input: ArchiveRemovalInput): ArchiveJobRecord | null {
    validateLease(input);
    if (input.hostId !== null) assertPattern('archive host id', input.hostId, SAFE_ID);
    const job = this.currentLease(input);
    if (!job || job.status !== 'takedown_pending') return null;
    const now = timestamp(input.nowMs);
    const jobPins = Object.values(this.ledger.pins).filter((pin) => (
      pin.publicationId === job.publicationId && pin.contentId === job.contentId
    ));
    if (input.hostId !== null) {
      const pin = this.ledger.pins[pinKey(job.publicationId, input.hostId)];
      if (!pin || pin.contentId !== job.contentId || pin.state !== 'removing') return null;
      pin.state = 'removed';
      pin.deletionVerifiedAt = now;
      pin.lifecycleVersion += 1;
    } else if (jobPins.some((pin) => pin.state !== 'removed')) {
      return null;
    }
    const remaining = Object.values(this.ledger.pins)
      .some((row) => row.publicationId === job.publicationId
        && row.contentId === job.contentId && row.state !== 'removed');
    if (remaining) return clone(job);
    const shared = Object.values(this.ledger.jobs).some((candidate) => (
      candidate.jobId !== job.jobId
      && candidate.contentId === job.contentId
      && BYTE_REFERENCE_STATUSES.has(candidate.status)
    ));
    if (!shared && this.listObjects(job.jobId).some((object) => object.status !== 'deleted')) {
      return null;
    }
    job.status = 'removed';
    this.releaseLease(job, input.nowMs);
    return clone(job);
  }

  isServeable(publicationId: string, hostId: string): boolean {
    const pin = this.ledger.pins[pinKey(publicationId, hostId)];
    if (!pin || pin.state !== 'active') return false;
    const job = Object.values(this.ledger.jobs).find((row) => row.publicationId === publicationId
      && row.contentId === pin.contentId
      && row.identityStatus === 'verified'
      && (row.status === 'pinned' || row.status === 'announced'));
    if (!job) return false;
    const objects = this.listObjects(job.jobId);
    return (job.expectedBytes === 0 || objects.length > 0)
      && objects.every((object) => object.metadataStatus === 'verified'
        && object.status === 'durable');
  }

  listActiveHosts(
    publicationId: string,
    options: { limit?: number; cursor?: ArchiveHostCursor } = {},
  ): ArchiveHostPage {
    const limit = options.limit ?? 100;
    assertPositiveInteger('archive host list limit', limit, 1000);
    if (options.cursor) assertIso('archive host cursor timestamp', options.cursor.lastVerifiedAt);
    const records = Object.values(this.ledger.pins)
      .filter((pin) => pin.publicationId === publicationId && pin.state === 'active'
        && pin.lastVerifiedAt !== null
        && Object.values(this.ledger.jobs).some((job) => (
          job.publicationId === pin.publicationId
          && job.contentId === pin.contentId
          && job.identityStatus === 'verified'
          && (job.status === 'pinned' || job.status === 'announced')
          && !Object.values(this.ledger.objects).some((object) => (
            object.contentId === job.contentId && object.metadataStatus !== 'verified'
          ))
        )))
      .sort((a, b) => {
        const time = b.lastVerifiedAt!.localeCompare(a.lastVerifiedAt!);
        return time || b.publicationId.localeCompare(a.publicationId) || b.hostId.localeCompare(a.hostId);
      })
      .filter((pin) => {
        if (!options.cursor) return true;
        const tuple = [pin.lastVerifiedAt!, pin.publicationId, pin.hostId].join('\u0000');
        const cursor = [options.cursor.lastVerifiedAt, options.cursor.publicationId,
          options.cursor.hostId].join('\u0000');
        return tuple < cursor;
      });
    const page = records.slice(0, limit).map(clone);
    const last = page.at(-1);
    return {
      records: page,
      nextCursor: records.length > limit && last
        ? {
          lastVerifiedAt: last.lastVerifiedAt!,
          publicationId: last.publicationId,
          hostId: last.hostId,
        }
        : null,
    };
  }

  listPinsForHost(
    hostId: string,
    options: { limit?: number; cursor?: ArchivePinCursor } = {},
  ): ArchivePinPage {
    assertPattern('archive host id', hostId, SAFE_ID);
    const limit = options.limit ?? 100;
    assertPositiveInteger('archive pin list limit', limit, 1000);
    if (options.cursor) assertPattern('archive pin cursor', options.cursor.publicationId, SAFE_ID);
    const ordered = Object.values(this.ledger.pins)
      .filter((pin) => pin.hostId === hostId)
      .sort((a, b) => a.publicationId.localeCompare(b.publicationId)
        || a.contentId.localeCompare(b.contentId))
      .filter((pin) => !options.cursor || pin.publicationId > options.cursor.publicationId);
    const page = ordered.slice(0, limit).map(clone);
    const last = page.at(-1);
    return {
      records: page,
      nextCursor: ordered.length > limit && last ? { publicationId: last.publicationId } : null,
    };
  }

  private currentLease(input: ArchiveLeaseInput): ArchiveJobRecord | null {
    const job = this.ledger.jobs[input.jobId];
    if (!job || job.identityStatus !== 'verified' || job.leaseOwner !== input.workerId
      || job.fencingToken !== input.fencingToken
      || (job.leasedUntilMs ?? 0) <= input.nowMs) return null;
    return job;
  }

  private releaseLease(job: ArchiveJobRecord, nowMs: number): void {
    job.leaseOwner = null;
    job.leasedUntilMs = null;
    job.lifecycleVersion += 1;
    job.updatedAt = timestamp(nowMs);
  }
}

export class InMemoryArchiveLifecycleStore extends ArchiveLifecycleStateMachine {}
