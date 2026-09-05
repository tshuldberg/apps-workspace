/**
 * Reference in-memory ObjectDeletionJobStore, a pure state machine over a serializable
 * ledger so the file adapter (object-deletion-jobs-file.ts) can reuse the exact
 * claim/commit/fence logic under an exclusive lock, exactly as ObjectStoreStateMachine
 * backs FileObjectStore.
 *
 * The fencing model mirrors the operations store's job leases: each claim bumps a
 * monotonic per-key fencing token and stamps an owner + lease deadline; complete,
 * reschedule, and poison only commit when the presented lease still matches the live
 * (owner, fencing token, unexpired lease). A worker whose lease expired and was
 * re-claimed by another worker therefore cannot commit over the new owner.
 */

import {
  assertClockMs,
  assertDeletionClaimLimit,
  assertDeletionDelayMs,
  assertDeletionError,
  assertDeletionKey,
  assertDeletionLeaseMs,
  assertDeletionOwner,
  assertDeletionVersionId,
  type ClaimObjectDeletionsInput,
  type CommitObjectDeletionResult,
  type CompleteObjectDeletionInput,
  type EnqueueObjectDeletionResult,
  type ObjectDeletionCursor,
  type ObjectDeletionJob,
  type ObjectDeletionJobStore,
  type ObjectDeletionLease,
  type ObjectDeletionPage,
  type ObjectDeletionState,
  type PoisonObjectDeletionInput,
  type RescheduleObjectDeletionInput,
} from './object-deletion-jobs';

interface DeletionRecord {
  objectKey: string;
  state: ObjectDeletionState;
  versionId: string | null;
  attempt: number;
  nextAttemptAtMs: number;
  lastError: string | null;
  enqueuedAtMs: number;
  updatedAtMs: number;
  owner: string | null;
  leaseExpiresAtMs: number | null;
  fencingToken: number;
}

export interface ObjectDeletionJobLedger {
  version: 1;
  jobs: Record<string, {
    objectKey: string;
    state: ObjectDeletionState;
    versionId: string | null;
    attempt: number;
    nextAttemptAtMs: number;
    lastError: string | null;
    enqueuedAtMs: number;
    updatedAtMs: number;
    owner: string | null;
    leaseExpiresAtMs: number | null;
    fencingToken: number;
  }>;
}

export function emptyObjectDeletionJobLedger(): ObjectDeletionJobLedger {
  return { version: 1, jobs: {} };
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function jobOf(record: DeletionRecord): ObjectDeletionJob {
  return {
    objectKey: record.objectKey,
    state: record.state,
    versionId: record.versionId,
    attempt: record.attempt,
    nextAttemptAt: iso(record.nextAttemptAtMs),
    lastError: record.lastError,
    enqueuedAt: iso(record.enqueuedAtMs),
    updatedAt: iso(record.updatedAtMs),
  };
}

/** Pure deletion-queue state machine. */
export class ObjectDeletionJobStateMachine implements ObjectDeletionJobStore {
  private readonly jobs = new Map<string, DeletionRecord>();

  constructor(ledger: ObjectDeletionJobLedger = emptyObjectDeletionJobLedger()) {
    for (const record of Object.values(ledger.jobs)) {
      this.jobs.set(record.objectKey, { ...record });
    }
  }

  snapshot(): ObjectDeletionJobLedger {
    const jobs: ObjectDeletionJobLedger['jobs'] = {};
    for (const [key, record] of this.jobs) jobs[key] = { ...record };
    return { version: 1, jobs };
  }

  /** Resolves the presented lease against the live record; null when the fence is stale. */
  private liveLease(
    lease: ObjectDeletionLease,
    nowMs: number,
  ): DeletionRecord | null {
    const record = this.jobs.get(lease.objectKey);
    if (!record || record.state !== 'leased') return null;
    if (record.owner !== lease.owner || record.fencingToken !== lease.fencingToken) return null;
    if (record.leaseExpiresAtMs === null || record.leaseExpiresAtMs <= nowMs) return null;
    return record;
  }

  async enqueue(objectKey: string, nowMs: number): Promise<EnqueueObjectDeletionResult> {
    assertDeletionKey('object key', objectKey);
    assertClockMs('nowMs', nowMs);
    const existing = this.jobs.get(objectKey);
    if (existing) {
      if (existing.state === 'deleted') return { status: 'already_deleted', job: jobOf(existing) };
      // pending, leased, or poison: a live/terminal job already owns this key.
      return { status: 'already_pending', job: jobOf(existing) };
    }
    const record: DeletionRecord = {
      objectKey,
      state: 'pending',
      versionId: null,
      attempt: 0,
      nextAttemptAtMs: nowMs,
      lastError: null,
      enqueuedAtMs: nowMs,
      updatedAtMs: nowMs,
      owner: null,
      leaseExpiresAtMs: null,
      fencingToken: 0,
    };
    this.jobs.set(objectKey, record);
    return { status: 'enqueued', job: jobOf(record) };
  }

  async getJob(objectKey: string): Promise<ObjectDeletionJob | null> {
    assertDeletionKey('object key', objectKey);
    const record = this.jobs.get(objectKey);
    return record ? jobOf(record) : null;
  }

  async claim(input: ClaimObjectDeletionsInput): Promise<ObjectDeletionLease[]> {
    const owner = input.owner.trim();
    assertDeletionOwner('deletion owner', owner);
    assertDeletionClaimLimit(input.limit);
    assertDeletionLeaseMs(input.leaseMs);
    assertClockMs('nowMs', input.nowMs);
    // Eligible: pending due now, OR leased whose lease has expired (crash recovery).
    const eligible = [...this.jobs.values()]
      .filter((record) =>
        (record.state === 'pending' && record.nextAttemptAtMs <= input.nowMs)
        || (record.state === 'leased'
          && record.leaseExpiresAtMs !== null
          && record.leaseExpiresAtMs <= input.nowMs
          && record.nextAttemptAtMs <= input.nowMs))
      .sort((a, b) => a.nextAttemptAtMs - b.nextAttemptAtMs
        || a.objectKey.localeCompare(b.objectKey))
      .slice(0, input.limit);
    const leases: ObjectDeletionLease[] = [];
    for (const record of eligible) {
      record.state = 'leased';
      record.owner = owner;
      record.fencingToken += 1;
      record.attempt += 1;
      record.leaseExpiresAtMs = input.nowMs + input.leaseMs;
      record.updatedAtMs = input.nowMs;
      leases.push({
        objectKey: record.objectKey,
        owner,
        attempt: record.attempt,
        fencingToken: record.fencingToken,
        leasedUntil: iso(record.leaseExpiresAtMs),
      });
    }
    return leases;
  }

  async complete(input: CompleteObjectDeletionInput): Promise<CommitObjectDeletionResult> {
    assertDeletionKey('object key', input.lease.objectKey);
    assertClockMs('nowMs', input.nowMs);
    if (input.versionId !== null) assertDeletionVersionId('version id', input.versionId);
    const record = this.liveLease(input.lease, input.nowMs);
    if (!record) return { status: 'lease_lost' };
    record.state = 'deleted';
    record.versionId = input.versionId;
    record.owner = null;
    record.leaseExpiresAtMs = null;
    record.lastError = null;
    record.nextAttemptAtMs = input.nowMs;
    record.updatedAtMs = input.nowMs;
    return { status: 'committed', job: jobOf(record) };
  }

  async reschedule(input: RescheduleObjectDeletionInput): Promise<CommitObjectDeletionResult> {
    assertDeletionKey('object key', input.lease.objectKey);
    assertDeletionDelayMs(input.delayMs);
    assertClockMs('nowMs', input.nowMs);
    const error = assertDeletionError('deletion error', input.error);
    const record = this.liveLease(input.lease, input.nowMs);
    if (!record) return { status: 'lease_lost' };
    record.state = 'pending';
    record.owner = null;
    record.leaseExpiresAtMs = null;
    record.lastError = error;
    record.nextAttemptAtMs = input.nowMs + input.delayMs;
    record.updatedAtMs = input.nowMs;
    return { status: 'committed', job: jobOf(record) };
  }

  async poison(input: PoisonObjectDeletionInput): Promise<CommitObjectDeletionResult> {
    assertDeletionKey('object key', input.lease.objectKey);
    assertClockMs('nowMs', input.nowMs);
    const error = assertDeletionError('deletion error', input.error);
    const record = this.liveLease(input.lease, input.nowMs);
    if (!record) return { status: 'lease_lost' };
    record.state = 'poison';
    record.owner = null;
    record.leaseExpiresAtMs = null;
    record.lastError = error;
    record.nextAttemptAtMs = input.nowMs;
    record.updatedAtMs = input.nowMs;
    return { status: 'committed', job: jobOf(record) };
  }

  async listPoison(input: {
    after?: ObjectDeletionCursor;
    limit: number;
  }): Promise<ObjectDeletionPage> {
    assertDeletionClaimLimit(input.limit);
    if (input.after) assertDeletionKey('poison cursor key', input.after.objectKey);
    const rows = [...this.jobs.values()]
      .filter((record) => record.state === 'poison')
      .sort((a, b) => a.objectKey.localeCompare(b.objectKey))
      .filter((record) => !input.after || record.objectKey > input.after.objectKey);
    const page = rows.slice(0, input.limit);
    const last = page.at(-1);
    return {
      jobs: page.map(jobOf),
      nextCursor: rows.length > page.length && last ? { objectKey: last.objectKey } : null,
    };
  }
}

/** In-memory deletion queue (tests, ephemeral nodes). */
export class InMemoryObjectDeletionJobStore extends ObjectDeletionJobStateMachine {}
