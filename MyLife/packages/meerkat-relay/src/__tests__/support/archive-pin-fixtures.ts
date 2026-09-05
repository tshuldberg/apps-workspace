/**
 * Shared fixtures for the WP-43B pin reconciliation / takedown / quota tests.
 *
 * Drives a managed archive job the whole way to a `pinned` job with an `active` pin over a durable
 * object, using the real in-memory lifecycle store, object store, and reference ledger (the same
 * substrate the byte-path tests use). Everything is a genuine signed archive job -- no stubbed
 * lifecycle -- so pin reconciliation and takedown run against real intent + serving state.
 */

import { createHash } from 'node:crypto';
import {
  createArchiveJob,
  createPublication,
  generateDeviceIdentity,
  type SignedArchiveJob,
} from '@mylife/sync';
import { InMemoryObjectStore } from '../../object-store-memory';
import { InMemoryArchiveLifecycleStore } from '../../archive-lifecycle';
import { InMemoryObjectReferenceLedger } from '../../object-reference-ledger-memory';
import { InMemoryObjectDeletionJobStore } from '../../object-deletion-jobs-memory';
import { ArchiveObjectByteService } from '../../archive-object-bytes';
import type { PinServingIndex } from '../../archive-pin-reconciler';

export const OWNER_HASH = 'c'.repeat(64);
export const START = Date.parse('2026-07-11T12:00:00.000Z');
export const HOST_ID = 'seeder-host-1';

export const sha256 = (bytes: Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex');

export function signedArchiveJob(contentId: string, publicationSuffix: string): SignedArchiveJob {
  const owner = generateDeviceIdentity(`Archive owner ${publicationSuffix}`);
  const publication = createPublication(owner, {
    kind: 'channel',
    communityId: `community-${publicationSuffix}`,
    channelId: `channel-${publicationSuffix}`,
    postId: null,
    title: `Durable archive ${publicationSuffix}`,
    description: 'Archive pin fixture.',
    category: 'technology',
    contentId,
    publicKeyHex: 'aabbccddeeff00',
    hostUrls: ['https://archive.example'],
    joinPolicy: 'open',
    now: new Date(START).toISOString(),
  });
  return createArchiveJob(owner, publication, {
    tier: 'managed',
    hostUrl: 'https://archive.example',
    objects: [{ index: 0, hash: '00'.repeat(32), size: 1 }],
    rights: {
      license: 'cc_by',
      rightsAssertion: 'i_own',
      provenance: 'Created by the fixture owner.',
      consentAt: new Date(START).toISOString(),
    },
    now: new Date(START).toISOString(),
  });
}

export interface PinHarness {
  objectStore: InMemoryObjectStore;
  archiveStore: InMemoryArchiveLifecycleStore;
  ledger: InMemoryObjectReferenceLedger;
  deletionJobs: InMemoryObjectDeletionJobStore;
  service: ArchiveObjectByteService;
}

export function pinHarness(): PinHarness {
  const objectStore = new InMemoryObjectStore();
  const archiveStore = new InMemoryArchiveLifecycleStore();
  const ledger = new InMemoryObjectReferenceLedger();
  const deletionJobs = new InMemoryObjectDeletionJobStore();
  const service = new ArchiveObjectByteService(objectStore, archiveStore, ledger);
  return { objectStore, archiveStore, ledger, deletionJobs, service };
}

export interface PinnedJob {
  jobId: string;
  publicationId: string;
  contentId: string;
  durableKey: string;
  bytes: Uint8Array;
}

/**
 * Drive one single-object job from enqueue to `pinned` with an `active` pin over a durable object,
 * on the given host. `contentId` may be shared across two jobs to exercise the shared-byte rule.
 */
export async function drivePinnedJob(
  h: PinHarness,
  options: { contentId: string; suffix: string; hostId?: string; payload?: string; clockBase?: number },
): Promise<PinnedJob> {
  const hostId = options.hostId ?? HOST_ID;
  const base = options.clockBase ?? START;
  const bytes = new Uint8Array(Buffer.from(options.payload ?? `payload-${options.suffix}`, 'utf8'));
  const job = signedArchiveJob(options.contentId, options.suffix);
  const created = await h.archiveStore.enqueue({
    signedJob: job,
    idempotencyKey: `archive-${job.job.jobId}`,
    requestDigestHex: createHash('sha256').update(JSON.stringify(job)).digest('hex'),
    ownerSubjectHashHex: OWNER_HASH,
    expectedBytes: bytes.length,
    nowMs: base,
  });
  if (created.status !== 'created') throw new Error('fixture enqueue failed');
  const jobId = created.job.jobId;
  // Content-addressed keys so two jobs sharing a contentId dedupe onto the SAME quarantine + durable
  // object (the real shared-byte path), which the lifecycle's shared-object rule requires.
  const quarantineKey = `quarantine/${options.contentId}/0`;
  const durableKey = `durable/${options.contentId}/0`;

  const intake = await h.service.intakeQuarantineObject({
    jobId, expectedJobVersion: 1, objectIndex: 0, quarantineKey,
    objectHash: sha256(bytes), bytes, nowMs: base + 1,
  });
  if (intake.status !== 'quarantined') throw new Error(`fixture intake failed: ${intake.status}`);

  const quarantined = await h.archiveStore.markQuarantined(jobId, 2, base + 2);
  if (quarantined?.status !== 'quarantined') throw new Error('fixture markQuarantined failed');
  const [scanClaim] = await h.archiveStore.claimJobs({
    workerId: 'scanner', eligibleStatuses: ['quarantined'], limit: 1, leaseMs: 5_000, nowMs: base + 3,
  });
  const approved = await h.archiveStore.completeScan({
    jobId, workerId: 'scanner', fencingToken: scanClaim!.fencingToken, nowMs: base + 4,
    scanId: randomScanId(options.suffix), engine: 'clamav', engineVersion: '1.4.3',
    result: 'clean', startedAt: new Date(base + 3).toISOString(),
    completedAt: new Date(base + 4).toISOString(),
  });
  if (approved?.status !== 'approved') throw new Error('fixture approve failed');

  // Promote and pin run under the SAME `approved` lease (activatePin advances approved -> pinned).
  const [promoClaim] = await h.archiveStore.claimJobs({
    workerId: 'promoter', eligibleStatuses: ['approved'], limit: 1, leaseMs: 5_000, nowMs: base + 5,
  });
  const promoted = await h.service.promoteObject({
    jobId, workerId: 'promoter', fencingToken: promoClaim!.fencingToken, objectIndex: 0,
    quarantineKey, durableKey, expectedChecksumSha256: sha256(bytes), nowMs: base + 6,
  });
  if (promoted.status !== 'durable') throw new Error(`fixture promote failed: ${promoted.status}`);

  const pin = await h.archiveStore.activatePin({
    jobId, workerId: 'promoter', fencingToken: promoClaim!.fencingToken, hostId, nowMs: base + 7,
  });
  if (pin?.state !== 'active') throw new Error('fixture activatePin failed');

  return { jobId, publicationId: created.job.publicationId, contentId: options.contentId, durableKey, bytes };
}

let scanCounter = 0;
function randomScanId(_suffix: string): string {
  scanCounter += 1;
  const hex = scanCounter.toString(16).padStart(12, '0').slice(-12);
  return `00000000-0000-4000-8000-${hex}`;
}

/** A simple in-memory serving index for the pin reconciler and takedown tests. */
export class FakeServingIndex implements PinServingIndex {
  private readonly serving = new Set<string>();

  constructor(initial: readonly string[] = []) {
    for (const id of initial) this.serving.add(id);
  }

  async isServing(publicationId: string): Promise<boolean> {
    return this.serving.has(publicationId);
  }

  async addServing(publicationId: string): Promise<void> {
    this.serving.add(publicationId);
  }

  async removeServing(publicationId: string): Promise<void> {
    this.serving.delete(publicationId);
  }

  async listServing(input: { after?: string; limit: number }): Promise<{
    publicationIds: string[];
    nextCursor: string | null;
  }> {
    const ordered = [...this.serving].sort()
      .filter((id) => input.after === undefined || id > input.after);
    const page = ordered.slice(0, input.limit);
    return {
      publicationIds: page,
      nextCursor: ordered.length > input.limit ? page.at(-1) ?? null : null,
    };
  }

  snapshot(): string[] {
    return [...this.serving].sort();
  }
}
