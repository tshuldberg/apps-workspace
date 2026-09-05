/**
 * Takedown propagation for the hosted seeder (Plan 43 WP-43B).
 *
 * A terminal takedown (owner unpublish, operator kill, DMCA action, GDPR delete, entitlement
 * expiry) must remove a publication from the serving path AND reclaim its bytes WITHOUT ever
 * deleting bytes another live publication still references. The archive lifecycle machine
 * (archive-lifecycle.ts) already owns the METADATA half: requestTakedown flips active pins to
 * `removing` and the job to `takedown_pending`; markObjectDeleted returns `shared` while any other
 * job still references the content; confirmRemoval finishes the job only when every pin is removed
 * and (unless shared) every object is deleted. This propagator is the ORCHESTRATION that drives
 * that metadata half in lockstep with the two external effects: the seeder's serving index and the
 * WP-2C object reference ledger + deletion queue.
 *
 * The ORDER is the load-bearing safety property (NC-43.4, AC-43.4/5):
 *   1. requestTakedown            -- pins -> removing, job -> takedown_pending (idempotent).
 *   2. removeServing(publication) -- the serving-index entry is disabled FIRST. After this step no
 *                                    request can be served, so nothing is served past a takedown.
 *   3. releaseObjectReference     -- for each durable object, drop this publication's reference edge
 *                                    in the WP-2C ledger (the single liveness authority). A byte a
 *                                    DIFFERENT active publication still references stays referenced
 *                                    (its edge is untouched), so it survives.
 *   4. deletion queue enqueue     -- an object that dropped to ZERO references is routed through the
 *                                    WP-2C deletion queue (the ONLY byte remover); a still-referenced
 *                                    object is left alone. This propagator NEVER deletes bytes inline.
 *   5. markObjectDeleted          -- record the metadata deletion under the fenced takedown lease.
 *                                    A `shared` result (another live job references the content)
 *                                    leaves the byte, and the object is NOT enqueued.
 *   6. confirmRemoval             -- move the job to `removed` once pins are removed and objects are
 *                                    deleted-or-shared. Restart-safe: re-running replays cleanly.
 *
 * The reference ledger is authority: step 4 enqueues deletion only when referenceCount hits 0, so a
 * byte shared by another active publication is never enqueued even if THIS publication is fully torn
 * down. The whole flow is idempotent, so a crash at any step is repaired by re-running the drain.
 */

import type {
  ArchiveObjectRecord,
  ArchivePinRecord,
  ArchivePinStore,
  ArchiveJobStore,
  ArchiveObjectStore,
} from './archive-lifecycle';
import type { ArchiveObjectByteService } from './archive-object-bytes';
import type { ObjectReferenceLedger } from './object-reference-ledger';
import type { ObjectDeletionJobStore } from './object-deletion-jobs';
import type { PinServingIndex } from './archive-pin-reconciler';

const JOB_ID = /^(?:[a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/u;
const SAFE_ID = /^[A-Za-z0-9_.:@/-]{1,512}$/u;

/** Strict predecessor of a publicationId so listPinsForHost's `> cursor` scan starts at the id. */
function predecessorId(value: string): string {
  return value.length <= 1 ? '' : value.slice(0, -1);
}

/** The archive lifecycle surface the propagator drives (the metadata half of a takedown). */
export type TakedownLifecycleStore = Pick<
  ArchiveJobStore,
  'getJob' | 'requestTakedown'
> & Pick<
  ArchiveObjectStore,
  'listObjects' | 'markObjectDeleted'
> & Pick<
  ArchivePinStore,
  'confirmRemoval' | 'listPinsForHost'
>;

/** A fenced takedown lease over the job, claimed via claimJobs(['takedown_pending']) in the bin. */
export interface TakedownLease {
  jobId: string;
  workerId: string;
  fencingToken: number;
}

/**
 * Confirms a durable object's bytes are ACTUALLY gone from the object store (every version absent),
 * so markObjectDeleted(absenceVerified:true) may finalize the metadata. Backed in production by the
 * object store's observe(durableKey) returning null; a fake in tests. This is the proof the WP-2C
 * deletion queue provides after it removes the bytes: the propagator never fabricates absence.
 */
export type ObjectAbsenceProbe = (durableKey: string) => Promise<boolean>;

export interface TakedownPropagateInput {
  jobId: string;
  /** This host's stable id, so pins removed are scoped to this seeder. */
  hostId: string;
  /** A fenced lease on the takedown_pending job (from claimJobs). Required for byte deletion. */
  lease: TakedownLease;
  nowMs: number;
}

export type TakedownObjectOutcome =
  | 'reference_released_enqueued'
  | 'reference_released_shared'
  | 'already_deleted'
  | 'deletion_rejected';

export interface TakedownObjectResult {
  objectIndex: number;
  durableKey: string | null;
  outcome: TakedownObjectOutcome;
}

export type TakedownPropagateResult =
  | {
    status: 'removed' | 'partial';
    servingRemoved: boolean;
    objects: TakedownObjectResult[];
  }
  | { status: 'not_found' }
  | { status: 'lease_lost' };

/**
 * Orchestrates a terminal takedown across the serving index, the reference ledger, and the WP-2C
 * deletion queue, in the load-bearing order above. Construct one per deployment over the same
 * object byte service, ledger, and deletion queue the archive intake/scanner use.
 */
export class ArchiveTakedownPropagator {
  constructor(
    private readonly lifecycle: TakedownLifecycleStore,
    private readonly servingIndex: PinServingIndex,
    private readonly byteService: Pick<ArchiveObjectByteService, 'releaseObjectReference'>,
    private readonly referenceLedger: Pick<ObjectReferenceLedger, 'referenceCount'>,
    private readonly deletionJobs: Pick<ObjectDeletionJobStore, 'enqueue'>,
    private readonly probeAbsence: ObjectAbsenceProbe,
  ) {}

  /**
   * Request the takedown (idempotent), remove the serving entry FIRST, release each object's
   * reference, enqueue deletion for any object that dropped to zero references, record the metadata
   * deletion under the fenced lease, and confirm removal. Returns `removed` when the job reached the
   * terminal removed state, `partial` when it is torn down from serving but the metadata removal is
   * not yet final (e.g. a shared byte or a not-yet-absence-verified object), `lease_lost` when the
   * fenced lease was reclaimed, `not_found` for an unknown job.
   */
  async propagate(input: TakedownPropagateInput): Promise<TakedownPropagateResult> {
    if (!JOB_ID.test(input.jobId) || !JOB_ID.test(input.lease.jobId)
      || input.jobId !== input.lease.jobId) {
      throw new TypeError('takedown job id is invalid');
    }
    if (!SAFE_ID.test(input.hostId) || !SAFE_ID.test(input.lease.workerId)) {
      throw new TypeError('takedown host or worker id is invalid');
    }
    const job = await this.lifecycle.getJob(input.jobId);
    if (!job) return { status: 'not_found' };

    // Step 1: request takedown (pins -> removing, job -> takedown_pending). Idempotent: a job already
    // takedown_pending/removed returns its current record.
    const requested = await this.lifecycle.requestTakedown(input.jobId, input.nowMs);
    if (!requested) return { status: 'not_found' };
    if (requested.status === 'removed') {
      // Already fully removed on a prior run: ensure serving is off and report done.
      await this.servingIndex.removeServing(requested.publicationId);
      return { status: 'removed', servingRemoved: true, objects: [] };
    }

    // Step 2: SERVING OFF FIRST. Nothing is served past this line, regardless of what follows.
    await this.servingIndex.removeServing(requested.publicationId);

    // Steps 3-4: per durable object, release THIS publication's reference edge and, when it was the
    // last reference, route the now-unreferenced key through the WP-2C deletion queue (never inline).
    // This runs BEFORE pin/removal confirmation so the reference ledger is the authority that decides
    // shared-vs-delete while the job is still takedown_pending -- a shared byte survives because its
    // other publication's edge is untouched. A concurrent republish keeps the byte referenced.
    const objects = await this.lifecycle.listObjects(input.jobId);
    const results: TakedownObjectResult[] = [];
    let leaseLost = false;
    for (const object of objects) {
      const result = await this.propagateObject(input, object);
      if (result === 'lease_lost') { leaseLost = true; break; }
      results.push(result);
    }
    if (leaseLost) return { status: 'lease_lost' };

    // Step 5: confirm this host's `removing` pins are marked `removed` under the fenced lease.
    const pinsConfirmed = await this.confirmHostPins(input);
    if (pinsConfirmed === 'lease_lost') return { status: 'lease_lost' };

    // Step 6: confirm removal to reach `removed`. Returns null (=> partial) while any sole-referenced
    // object is not yet deleted -- a later drain pass finalizes once the deletion queue confirms
    // absence. A fully-shared job (every object shared) reaches removed immediately.
    const finished = await this.lifecycle.confirmRemoval({
      jobId: input.jobId,
      workerId: input.lease.workerId,
      fencingToken: input.lease.fencingToken,
      hostId: null,
      nowMs: input.nowMs,
    });
    const alreadyRemoved = (await this.lifecycle.getJob(input.jobId))?.status === 'removed';
    if ((!finished || finished.status !== 'removed') && !alreadyRemoved) {
      return { status: 'partial', servingRemoved: true, objects: results };
    }
    return { status: 'removed', servingRemoved: true, objects: results };
  }

  private async propagateObject(
    input: TakedownPropagateInput,
    object: ArchiveObjectRecord,
  ): Promise<TakedownObjectResult | 'lease_lost'> {
    if (object.status === 'deleted') {
      return { objectIndex: object.objectIndex, durableKey: object.durableKey, outcome: 'already_deleted' };
    }
    // Probe the SHARED verdict first (absenceVerified:false). `shared` => another live publication
    // references the content, so the byte MUST survive: release only THIS publication's edge and
    // stop. `null` here does NOT mean lease loss -- for a sole-referenced object markObjectDeleted
    // returns null until absence is verified, which is exactly the byte-not-yet-gone case handled
    // below. We disambiguate a genuine lease loss by re-checking the job's lease-bound state at the
    // end of propagate (confirmRemoval is the fenced gate that would reject a lost lease).
    const sharedProbe = await this.lifecycle.markObjectDeleted({
      jobId: input.jobId,
      workerId: input.lease.workerId,
      fencingToken: input.lease.fencingToken,
      objectIndex: object.objectIndex,
      absenceVerified: false,
      nowMs: input.nowMs,
    });
    if (sharedProbe && sharedProbe.status === 'shared') {
      if (object.durableKey) {
        await this.byteService.releaseObjectReference(input.jobId, object.objectIndex, object.durableKey);
      }
      return {
        objectIndex: object.objectIndex,
        durableKey: object.durableKey,
        outcome: 'reference_released_shared',
      };
    }
    if (!object.durableKey) {
      // A never-promoted object (no durable bytes): nothing to release or delete.
      return { objectIndex: object.objectIndex, durableKey: null, outcome: 'deletion_rejected' };
    }
    // Sole reference: release the edge, then route the now-unreferenced key through the WP-2C
    // deletion queue (the ONLY byte remover). Enqueue is idempotent, so a re-run replays cleanly.
    await this.byteService.releaseObjectReference(input.jobId, object.objectIndex, object.durableKey);
    const remaining = await this.referenceLedger.referenceCount(object.durableKey);
    if (remaining > 0) {
      // A concurrent republish re-referenced the key between the shared probe and the count: leave
      // the byte. The deletion queue is never handed a still-referenced key.
      return {
        objectIndex: object.objectIndex,
        durableKey: object.durableKey,
        outcome: 'reference_released_shared',
      };
    }
    await this.deletionJobs.enqueue(object.durableKey, input.nowMs);
    // If the deletion queue has already removed the bytes (a prior pass, or a fast worker), finalize
    // the metadata deletion now with a REAL absence proof. Otherwise leave the object pending; a
    // later drain pass finalizes it once the queue confirms absence. Never fabricate absence.
    const absent = await this.probeAbsence(object.durableKey);
    if (absent) {
      const finalized = await this.lifecycle.markObjectDeleted({
        jobId: input.jobId,
        workerId: input.lease.workerId,
        fencingToken: input.lease.fencingToken,
        objectIndex: object.objectIndex,
        absenceVerified: true,
        nowMs: input.nowMs,
      });
      if (finalized === null) return 'lease_lost';
    }
    return {
      objectIndex: object.objectIndex,
      durableKey: object.durableKey,
      outcome: 'reference_released_enqueued',
    };
  }

  /** Confirm every removing pin for this host is marked removed under the fenced lease. */
  private async confirmHostPins(input: TakedownPropagateInput): Promise<'ok' | 'lease_lost'> {
    const job = await this.lifecycle.getJob(input.jobId);
    if (!job) return 'ok';
    let cursor: { publicationId: string } | undefined;
    const removingForJob: ArchivePinRecord[] = [];
    do {
      const page = await this.lifecycle.listPinsForHost(input.hostId, { cursor, limit: 500 });
      for (const pin of page.records) {
        if (pin.publicationId === job.publicationId && pin.contentId === job.contentId
          && pin.state === 'removing') {
          removingForJob.push(pin);
        }
      }
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    for (const pin of removingForJob) {
      // confirmRemoval(hostId) marks THIS pin `removed` as a side effect, then returns null when it
      // was the last pin but objects are not yet deleted -- that null is NOT a lease loss. Re-read the
      // exact pin to distinguish: a real lease loss leaves it `removing`; success leaves it `removed`.
      await this.lifecycle.confirmRemoval({
        jobId: input.jobId,
        workerId: input.lease.workerId,
        fencingToken: input.lease.fencingToken,
        hostId: pin.hostId,
        nowMs: input.nowMs,
      });
      const state = await this.pinState(input.hostId, pin.publicationId, pin.contentId);
      if (state !== 'removed') return 'lease_lost';
    }
    return 'ok';
  }

  /** The exact pin state for (host, publication, content), by paging listPinsForHost precisely. */
  private async pinState(
    hostId: string,
    publicationId: string,
    contentId: string,
  ): Promise<string | null> {
    let cursor: { publicationId: string } | undefined = { publicationId: predecessorId(publicationId) };
    for (let guard = 0; guard < 1000; guard += 1) {
      const page = await this.lifecycle.listPinsForHost(hostId, { cursor, limit: 500 });
      const pin = page.records.find((row) => row.publicationId === publicationId
        && row.contentId === contentId);
      if (pin) return pin.state;
      if (!page.nextCursor) return null;
      cursor = page.nextCursor;
    }
    return null;
  }
}
