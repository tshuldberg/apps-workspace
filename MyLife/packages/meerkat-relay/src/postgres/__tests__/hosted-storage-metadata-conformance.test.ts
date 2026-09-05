import { describe, expect, it } from 'vitest';
import {
  InMemoryHostedStorageMetadataStore,
  type HostedObjectObservation,
  type HostedStorageMetadataStore,
  type HostedStoragePolicy,
} from '../../hosted-storage-metadata';
import { PostgresHostedStorageMetadataStore } from '../stores/hosted-storage-metadata-store';
import {
  PostgresStoreUnavailableError,
  type PostgresStoreContext,
} from '../store-context';

const CHECKSUM_A = 'aa'.repeat(32);
const CHECKSUM_B = 'bb'.repeat(32);
const POLICY: HostedStoragePolicy = {
  policyVersion: 1,
  maxObjectBytes: 10,
  maxObjectCount: 4,
  maxConcurrentReservations: 4,
  reservationTtlSeconds: 60,
  retentionDays: 0,
};

async function provision(
  store: HostedStorageMetadataStore,
  subjectId = 'tenant-a',
  capBytes = 10,
  policy = POLICY,
): Promise<void> {
  expect(await store.provisionTenant({ subjectId, capBytes, policy })).toMatchObject({
    status: 'created',
  });
}

function reservation(
  reservationId: string,
  blockIndex: number,
  sizeBytes = 6,
  checksum = CHECKSUM_A,
) {
  return {
    reservationId,
    subjectId: 'tenant-a',
    contentId: 'content-a',
    blockIndex,
    objectKey: `tenant-a/content-a/${blockIndex}/${reservationId}`,
    checksum,
    sizeBytes,
  };
}

function observation(
  objectKey: string,
  checksum = CHECKSUM_A,
  sizeBytes = 6,
  versionId = 'version-1',
): HostedObjectObservation {
  return { objectKey, checksum, sizeBytes, versionId };
}

function deletion(objectKey: string, versionId = 'version-1') {
  return { objectKey, versionId, deleted: true };
}

describe('hosted storage metadata conformance', () => {
  it('reserves quota atomically and never double-charges an idempotent request', async () => {
    const store = new InMemoryHostedStorageMetadataStore();
    await provision(store);
    const firstInput = reservation('reservation-a', 0);
    const first = await store.reserve(firstInput);
    expect(first.status).toBe('reserved');
    expect(await store.reserve(firstInput)).toMatchObject({ status: 'replayed' });
    expect(await store.getTenant('tenant-a')).toMatchObject({
      reservedBytes: 6,
      committedBytes: 0,
    });

    const outcomes = await Promise.all([
      store.reserve(reservation('reservation-b', 1)),
      store.reserve(reservation('reservation-c', 2)),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === 'reserved')).toHaveLength(0);
    expect(outcomes.every((outcome) => outcome.status === 'quota_exceeded')).toBe(true);
    expect(await store.reserve({ ...firstInput, checksum: CHECKSUM_B })).toEqual({ status: 'conflict' });
  });

  it('fences stage/activate/release and moves bytes between counters exactly once', async () => {
    const store = new InMemoryHostedStorageMetadataStore();
    await provision(store);
    const input = reservation('reservation-a', 0);
    const reserved = await store.reserve(input);
    if (reserved.status !== 'reserved') throw new Error('expected reservation');
    const fence = reserved.reservation.fencingToken;
    const observed = observation(input.objectKey);

    expect(await store.stage({ reservationId: input.reservationId, fencingToken: fence + 1, observation: observed }))
      .toEqual({ status: 'stale_fence' });
    expect(await store.stage({
      reservationId: input.reservationId,
      fencingToken: fence,
      observation: { ...observed, checksum: CHECKSUM_B },
    })).toEqual({ status: 'metadata_mismatch' });
    expect(await store.stage({ reservationId: input.reservationId, fencingToken: fence, observation: observed }))
      .toMatchObject({ status: 'staged' });
    expect(await store.activate({ reservationId: input.reservationId, fencingToken: fence, observation: observed }))
      .toMatchObject({ status: 'activated', object: { versionId: 'version-1' } });
    expect(await store.activate({ reservationId: input.reservationId, fencingToken: fence, observation: observed }))
      .toMatchObject({ status: 'replayed' });
    expect(await store.getTenant('tenant-a')).toMatchObject({ reservedBytes: 0, committedBytes: 6 });
    expect(await store.release({
      reservationId: input.reservationId,
      fencingToken: fence,
      observation: observed,
    }))
      .toEqual({ status: 'delete_not_confirmed' });
    expect(await store.release({
      reservationId: input.reservationId,
      fencingToken: fence,
      deletion: deletion(input.objectKey),
    }))
      .toMatchObject({ status: 'released' });
    expect(await store.release({
      reservationId: input.reservationId,
      fencingToken: fence,
      deletion: deletion(input.objectKey),
    }))
      .toMatchObject({ status: 'replayed' });
    expect(await store.getTenant('tenant-a')).toMatchObject({ reservedBytes: 0, committedBytes: 0 });
    expect(await store.getObject('tenant-a', 'content-a', 0)).toBeNull();
  });

  it('expires reservations by authority time and issues a newer fence on retry', async () => {
    let now = Date.parse('2026-07-10T00:00:00.000Z');
    const store = new InMemoryHostedStorageMetadataStore(() => now);
    await provision(store);
    const initial = await store.reserve(reservation('reservation-a', 0));
    if (initial.status !== 'reserved') throw new Error('expected reservation');
    now += 61_000;
    expect(await store.expireDue(10)).toMatchObject([{ state: 'expired' }]);
    expect(await store.getTenant('tenant-a')).toMatchObject({ reservedBytes: 0 });
    const retried = await store.reserve(reservation('reservation-b', 0));
    if (retried.status !== 'reserved') throw new Error('expected retry reservation');
    expect(retried.reservation.fencingToken).toBeGreaterThan(initial.reservation.fencingToken);
  });

  it('uses CAS manifests, policy retention, and stable bounded reconciliation pages', async () => {
    const store = new InMemoryHostedStorageMetadataStore();
    await provision(store);
    const inserted = await store.putManifest({
      subjectId: 'tenant-a',
      contentId: 'content-a',
      manifest: { blocks: [CHECKSUM_A] },
      isPinned: false,
      expectedLifecycleVersion: null,
    });
    expect(inserted).toMatchObject({ status: 'inserted', manifest: { autoDeleteAt: expect.any(String) } });
    expect(await store.putManifest({
      subjectId: 'tenant-a',
      contentId: 'content-a',
      manifest: { blocks: [CHECKSUM_B] },
      isPinned: true,
      expectedLifecycleVersion: 99,
    })).toEqual({ status: 'conflict' });
    expect((await store.listExpiredManifests({ limit: 1 })).items).toHaveLength(1);

    for (let index = 0; index < 2; index += 1) {
      const input = reservation(`reservation-${index}`, index, 1);
      const reserved = await store.reserve(input);
      if (reserved.status !== 'reserved') throw new Error('expected reservation');
      await store.stage({
        reservationId: input.reservationId,
        fencingToken: reserved.reservation.fencingToken,
        observation: observation(input.objectKey, CHECKSUM_A, 1, `version-${index}`),
      });
    }
    const firstPage = await store.listReconciliation({ limit: 1 });
    expect(firstPage.items).toHaveLength(1);
    expect(firstPage.nextCursor).not.toBeNull();
    const secondPage = await store.listReconciliation({ after: firstPage.nextCursor!, limit: 1 });
    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.items[0]?.reservationId).not.toBe(firstPage.items[0]?.reservationId);
  });

  it('keeps versioned API objects and backup locators isolated and idempotent', async () => {
    const store = new InMemoryHostedStorageMetadataStore();
    await provision(store, 'tenant-a', 100);
    await provision(store, 'tenant-b', 100);
    const block = {
      objectId: 'api-object',
      blockIndex: 0,
      totalBlocks: 1,
      blockHash: CHECKSUM_A,
      sizeBytes: 7,
    };
    expect(await store.recordApiUploadBlock({ subjectId: 'tenant-a', ...block }))
      .toMatchObject({ status: 'inserted' });
    expect(await store.recordApiUploadBlock({ subjectId: 'tenant-a', ...block }))
      .toMatchObject({ status: 'replayed' });
    expect(await store.completeApiObject({
      subjectId: 'tenant-a',
      objectId: 'api-object',
      encryptedBytes: 7,
      ciphertextHash: 'cc'.repeat(64),
      dataClass: 'encrypted_payload',
      totalBlocks: 1,
      version: 'version-a',
    })).toMatchObject({ status: 'completed' });
    expect(await store.getApiObject('tenant-b', 'api-object')).toBeNull();
    expect((await store.listApiObjects({ subjectId: 'tenant-a', limit: 10 })).items)
      .toHaveLength(1);
    expect((await store.listApiObjects({ subjectId: 'tenant-b', limit: 10 })).items)
      .toEqual([]);

    expect(await store.putBackupLocator({
      subjectId: 'tenant-a',
      formatVersion: 1,
      backupId: 'backup-a',
      encryptedManifestHash: 'cc'.repeat(64),
      createdAt: '2026-07-14T12:00:00.000Z',
      manifestObjectId: 'api-object',
    })).toMatchObject({ status: 'inserted' });
    expect((await store.listBackupLocators({ subjectId: 'tenant-b', limit: 10 })).items)
      .toEqual([]);
    expect(await store.deleteApiObject('tenant-a', 'api-object')).toEqual({
      objectRows: 1,
      uploadBlockRows: 1,
      backupRows: 1,
    });
    expect(await store.deleteApiObject('tenant-a', 'api-object')).toEqual({
      objectRows: 0,
      uploadBlockRows: 0,
      backupRows: 0,
    });
  });

  it('maps database outages to an explicit unavailable error', async () => {
    const context = {
      query: async () => { throw new Error('database offline'); },
    } as unknown as PostgresStoreContext;
    await expect(new PostgresHostedStorageMetadataStore(context).getTenant('tenant-a'))
      .rejects.toBeInstanceOf(PostgresStoreUnavailableError);
  });
});
