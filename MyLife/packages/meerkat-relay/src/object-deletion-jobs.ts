/**
 * The durable object-deletion queue for Plan 44 (WP-2C).
 *
 * When an object key drops to zero references (object-reference-ledger.ts) or a
 * metadata plane releases its bytes, the physical bytes behind the object store must
 * be reclaimed. Deleting them inline is unsafe: the delete can fail transiently, two
 * workers can race, and a permanently failing key must not loop forever. This queue
 * makes deletion a durable job processed under a FENCED lease, exactly as the push
 * and archive workers claim leases from the operations store: one worker owns a key
 * at a time, a stale worker's completion is rejected by its fencing token, retries
 * back off with jitter, and a key that exhausts its attempt budget becomes a terminal
 * `poison` finding rather than an infinite retry.
 *
 * Job identity is the object key itself: a key has at most one live deletion job, so
 * enqueue is idempotent (enqueuing an already-pending/leased key is a no-op success),
 * and a `deleted` key re-enqueued after its bytes are gone is likewise idempotent.
 * The worker records a deletion receipt (the object store's ObjectDeletionReceipt is
 * idempotent on replay), so a completion that lands twice is equivalent.
 *
 * State machine (per object key):
 *
 *     enqueue
 *        |
 *        v
 *   [ pending ] --claim(lease,fence)--> [ leased ]
 *        ^                                  |
 *        |                                  |-- complete(fence ok) --> [ deleted ] (terminal success)
 *        |                                  |
 *        +----- reschedule(fence ok) -------+   (attempt < maxAttempts; next_attempt_at = now + backoff+jitter)
 *                                           |
 *                                           +-- poison(fence ok) ----> [ poison ] (terminal finding)
 *
 * A stale worker (expired lease, superseded fence) that calls complete/reschedule/
 * poison is rejected: its fencing token no longer matches, so it cannot commit over
 * the worker that took the lease. A backing fault throws an explicit unavailable error.
 */

const DELETION_KEY = /^[A-Za-z0-9_][A-Za-z0-9_.:@/-]{0,511}$/u;
const DELETION_OWNER = /^[A-Za-z0-9_][\x20-\x7e]{0,255}$/u;
const VERSION_ID = /^.{1,256}$/u;
const MAX_LEASE_MS = 24 * 60 * 60 * 1000;
const MAX_CLAIM_LIMIT = 1_000;
const MAX_ERROR_BYTES = 2_048;

export type ObjectDeletionState = 'pending' | 'leased' | 'deleted' | 'poison';

/** The durability record of a single object's deletion job. */
export interface ObjectDeletionJob {
  objectKey: string;
  state: ObjectDeletionState;
  /** The object-store version the last delete receipt was recorded at, when known. */
  versionId: string | null;
  attempt: number;
  /** ISO instant the job becomes claimable again (backoff+jitter after a reschedule). */
  nextAttemptAt: string;
  lastError: string | null;
  enqueuedAt: string;
  updatedAt: string;
}

/** A claimed deletion lease: the fenced handle a worker must present to commit. */
export interface ObjectDeletionLease {
  objectKey: string;
  owner: string;
  attempt: number;
  fencingToken: number;
  leasedUntil: string;
}

export type EnqueueObjectDeletionResult =
  | { status: 'enqueued'; job: ObjectDeletionJob }
  | { status: 'already_pending'; job: ObjectDeletionJob }
  | { status: 'already_deleted'; job: ObjectDeletionJob };

export interface ClaimObjectDeletionsInput {
  owner: string;
  limit: number;
  leaseMs: number;
  nowMs: number;
}

export interface CompleteObjectDeletionInput {
  lease: ObjectDeletionLease;
  versionId: string | null;
  nowMs: number;
}

export interface RescheduleObjectDeletionInput {
  lease: ObjectDeletionLease;
  /** Delay before the job is claimable again; the caller supplies backoff+jitter. */
  delayMs: number;
  error: string;
  nowMs: number;
}

export interface PoisonObjectDeletionInput {
  lease: ObjectDeletionLease;
  error: string;
  nowMs: number;
}

export type CommitObjectDeletionResult =
  | { status: 'committed'; job: ObjectDeletionJob }
  | { status: 'lease_lost' };

export interface ObjectDeletionCursor {
  objectKey: string;
}

export interface ObjectDeletionPage {
  jobs: ObjectDeletionJob[];
  nextCursor: ObjectDeletionCursor | null;
}

export class ObjectDeletionJobUnavailableError extends Error {
  readonly code = 'object_deletion_job_unavailable';
  readonly operation: string;

  constructor(operation: string, cause: unknown) {
    super(`Object deletion job store is unavailable during ${operation}`, { cause });
    this.name = 'ObjectDeletionJobUnavailableError';
    this.operation = operation;
  }
}

export function toObjectDeletionJobUnavailableError(
  operation: string,
  error: unknown,
): ObjectDeletionJobUnavailableError {
  if (error instanceof ObjectDeletionJobUnavailableError) return error;
  return new ObjectDeletionJobUnavailableError(operation, error);
}

// ---------------------------------------------------------------------------
// Boundary validation shared by the memory, file, and PostgreSQL adapters.
// ---------------------------------------------------------------------------

export function assertDeletionKey(name: string, value: string): void {
  if (!DELETION_KEY.test(value)) throw new TypeError(`${name} is not a valid object key`);
}

export function assertDeletionOwner(name: string, value: string): void {
  if (!DELETION_OWNER.test(value)) throw new TypeError(`${name} is not a valid worker owner`);
}

export function assertDeletionVersionId(name: string, value: string): void {
  if (!VERSION_ID.test(value)) throw new TypeError(`${name} is not a valid version id`);
}

export function assertDeletionLeaseMs(value: number): void {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_LEASE_MS) {
    throw new TypeError(`deletion lease ms must be between 1 and ${MAX_LEASE_MS}`);
  }
}

export function assertDeletionDelayMs(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_LEASE_MS) {
    throw new TypeError(`deletion delay ms must be between 0 and ${MAX_LEASE_MS}`);
  }
}

export function assertDeletionClaimLimit(value: number): void {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_CLAIM_LIMIT) {
    throw new TypeError(`deletion claim limit must be between 1 and ${MAX_CLAIM_LIMIT}`);
  }
}

export function assertClockMs(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${name} must be a non-negative integer clock reading`);
  }
}

export function assertDeletionError(name: string, value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0 || Buffer.byteLength(trimmed, 'utf8') > MAX_ERROR_BYTES) {
    throw new TypeError(`${name} must be a non-empty error under ${MAX_ERROR_BYTES} bytes`);
  }
  return trimmed;
}

/**
 * The one deletion-queue contract. `enqueue` is idempotent per key; `claim` hands out
 * fenced leases; `complete`/`reschedule`/`poison` require a live fence and are the only
 * terminal/retry transitions. `listPoison` surfaces terminal findings for an operator.
 * Every method validates at the boundary; a backing fault throws
 * ObjectDeletionJobUnavailableError rather than returning a wrong result.
 */
export interface ObjectDeletionJobStore {
  enqueue(objectKey: string, nowMs: number): Promise<EnqueueObjectDeletionResult>;
  getJob(objectKey: string): Promise<ObjectDeletionJob | null>;
  claim(input: ClaimObjectDeletionsInput): Promise<ObjectDeletionLease[]>;
  complete(input: CompleteObjectDeletionInput): Promise<CommitObjectDeletionResult>;
  reschedule(input: RescheduleObjectDeletionInput): Promise<CommitObjectDeletionResult>;
  poison(input: PoisonObjectDeletionInput): Promise<CommitObjectDeletionResult>;
  listPoison(input: {
    after?: ObjectDeletionCursor;
    limit: number;
  }): Promise<ObjectDeletionPage>;
}
