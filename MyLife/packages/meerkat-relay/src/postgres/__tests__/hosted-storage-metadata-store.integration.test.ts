import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  type HostedObjectObservation,
  type HostedStoragePolicy,
} from '../../hosted-storage-metadata';
import { runPostgresMigrations } from '../migrate';
import { PostgresStoreContext } from '../store-context';
import { PostgresHostedStorageMetadataStore } from '../stores/hosted-storage-metadata-store';

const adminConnectionString = process.env.MEERKAT_TEST_POSTGRES_URL?.trim();
const destructive = process.env.MEERKAT_ALLOW_DESTRUCTIVE_POSTGRES_TESTS === 'true';
const describePostgres = adminConnectionString && destructive ? describe.sequential : describe.skip;
const CHECKSUM_A = 'aa'.repeat(32);
const CHECKSUM_B = 'bb'.repeat(32);

const POLICY: HostedStoragePolicy = {
  policyVersion: 1,
  maxObjectBytes: 20,
  maxObjectCount: 10,
  maxConcurrentReservations: 10,
  reservationTtlSeconds: 60,
  retentionDays: 0,
};

function reservation(
  reservationId: string,
  blockIndex: number,
  sizeBytes = 6,
  subjectId = 'tenant-a',
) {
  return {
    reservationId,
    subjectId,
    contentId: 'content-a',
    blockIndex,
    objectKey: `${subjectId}/content-a/${blockIndex}/${reservationId}`,
    checksum: CHECKSUM_A,
    sizeBytes,
  };
}

function observation(
  objectKey: string,
  sizeBytes = 6,
  versionId = 'version-1',
): HostedObjectObservation {
  return { objectKey, checksum: CHECKSUM_A, sizeBytes, versionId };
}

function deletion(objectKey: string, versionId = 'version-1') {
  return { objectKey, versionId, deleted: true };
}

describePostgres('PostgreSQL hosted storage metadata across two pools', () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const databaseName = `meerkat_test_storage_metadata_${suffix}`;
  const adminPool = new Pool({ connectionString: adminConnectionString });
  adminPool.on('error', () => undefined);
  let firstPool: Pool;
  let secondPool: Pool;
  let first: PostgresHostedStorageMetadataStore;
  let second: PostgresHostedStorageMetadataStore;

  beforeAll(async () => {
    await adminPool.query(`CREATE DATABASE "${databaseName}"`);
    const url = new URL(adminConnectionString!);
    url.pathname = `/${databaseName}`;
    firstPool = new Pool({ connectionString: url.toString(), max: 4 });
    firstPool.on('error', () => undefined);
    secondPool = new Pool({ connectionString: url.toString(), max: 4 });
    secondPool.on('error', () => undefined);
    await runPostgresMigrations(firstPool);
    first = new PostgresHostedStorageMetadataStore(new PostgresStoreContext(firstPool));
    second = new PostgresHostedStorageMetadataStore(new PostgresStoreContext(secondPool));
  });

  beforeEach(async () => {
    await firstPool.query(`
      TRUNCATE TABLE
        hosted.storage_backup_locators,
        hosted.storage_api_objects,
        hosted.storage_api_upload_blocks,
        hosted.seeder_manifests,
        hosted.storage_reservations,
        hosted.storage_objects,
        hosted.storage_tenant_policies,
        hosted.storage_tenants
      RESTART IDENTITY CASCADE
    `);
  });

  afterAll(async () => {
    await firstPool?.end();
    await secondPool?.end();
    await adminPool.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    await adminPool.end();
  });

  async function provision(
    capBytes = 10,
    policy: HostedStoragePolicy = POLICY,
    subjectId = 'tenant-a',
  ): Promise<void> {
    expect(await first.provisionTenant({ subjectId, capBytes, policy })).toMatchObject({
      status: 'created',
    });
  }

  it('serializes quota races and keeps reservation replay free of double charges', async () => {
    await provision(10);
    const alpha = reservation('reservation-a', 0);
    const beta = reservation('reservation-b', 1);
    const outcomes = await Promise.all([first.reserve(alpha), second.reserve(beta)]);
    expect(outcomes.filter((outcome) => outcome.status === 'reserved')).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === 'quota_exceeded')).toHaveLength(1);
    const winner = outcomes[0]?.status === 'reserved' ? alpha : beta;
    expect(await second.reserve(winner)).toMatchObject({ status: 'replayed' });
    expect(await first.getTenant('tenant-a')).toMatchObject({
      reservedBytes: 6,
      committedBytes: 0,
    });
    expect(await second.reserve({ ...winner, checksum: CHECKSUM_B })).toEqual({ status: 'conflict' });
  });

  it('fences activation and release across replicas without double charging', async () => {
    await provision(20);
    const input = reservation('reservation-a', 0);
    const reserved = await first.reserve(input);
    if (reserved.status !== 'reserved') throw new Error('expected reservation');
    const transition = {
      reservationId: input.reservationId,
      fencingToken: reserved.reservation.fencingToken,
      observation: observation(input.objectKey),
    };
    expect(await second.stage({ ...transition, fencingToken: transition.fencingToken + 1 }))
      .toEqual({ status: 'stale_fence' });
    expect(await first.stage(transition)).toMatchObject({ status: 'staged' });
    const activated = await Promise.all([first.activate(transition), second.activate(transition)]);
    expect(activated.map((result) => result.status).sort()).toEqual(['activated', 'replayed']);
    expect(await first.getTenant('tenant-a')).toMatchObject({ reservedBytes: 0, committedBytes: 6 });
    expect(await second.getObject('tenant-a', 'content-a', 0)).toMatchObject({
      checksum: CHECKSUM_A,
      versionId: 'version-1',
    });
    expect(await first.release(transition)).toEqual({ status: 'delete_not_confirmed' });
    const release = {
      reservationId: input.reservationId,
      fencingToken: transition.fencingToken,
      deletion: deletion(input.objectKey),
    };
    const released = await Promise.all([first.release(release), second.release(release)]);
    expect(released.map((result) => result.status).sort()).toEqual(['released', 'replayed']);
    expect(await first.getTenant('tenant-a')).toMatchObject({ reservedBytes: 0, committedBytes: 0 });
    expect(await first.getObject('tenant-a', 'content-a', 0)).toBeNull();
  });

  it('partitions expiry work across workers and advances the retry fence using database time', async () => {
    await provision(20, { ...POLICY, reservationTtlSeconds: 1 });
    const firstReservation = await first.reserve(reservation('reservation-a', 0, 4));
    const secondReservation = await second.reserve(reservation('reservation-b', 1, 4));
    if (firstReservation.status !== 'reserved' || secondReservation.status !== 'reserved') {
      throw new Error('expected reservations');
    }
    await firstPool.query('SELECT pg_sleep(1.05)');
    const expired = (await Promise.all([first.expireDue(1), second.expireDue(1)])).flat();
    expect(new Set(expired.map((item) => item.reservationId))).toEqual(new Set([
      'reservation-a', 'reservation-b',
    ]));
    expect(await first.getTenant('tenant-a')).toMatchObject({ reservedBytes: 0 });
    const retried = await second.reserve(reservation('reservation-c', 0, 4));
    if (retried.status !== 'reserved') throw new Error('expected retry reservation');
    expect(retried.reservation.fencingToken).toBeGreaterThan(firstReservation.reservation.fencingToken);
  });

  it('enforces policy object/reservation counts atomically across pools', async () => {
    await provision(100, {
      ...POLICY,
      maxObjectCount: 1,
      maxConcurrentReservations: 1,
    });
    const outcomes = await Promise.all([
      first.reserve(reservation('reservation-a', 0, 1)),
      second.reserve(reservation('reservation-b', 1, 1)),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === 'reserved')).toHaveLength(1);
    expect(outcomes.filter((outcome) =>
      outcome.status === 'object_limit' || outcome.status === 'reservation_limit')).toHaveLength(1);
  });

  it('CAS-updates expiring manifests and returns stable bounded reconciliation pages', async () => {
    await provision(100);
    for (const contentId of ['content-a', 'content-b']) {
      expect(await first.putManifest({
        subjectId: 'tenant-a',
        contentId,
        manifest: { contentId, checksum: CHECKSUM_A },
        isPinned: false,
        expectedLifecycleVersion: null,
      })).toMatchObject({ status: 'inserted' });
    }
    await firstPool.query(`
      UPDATE hosted.seeder_manifests
      SET auto_delete_at = CASE content_id
        WHEN 'content-a' THEN TIMESTAMPTZ '2026-01-01 00:00:00.000001+00'
        ELSE TIMESTAMPTZ '2026-01-01 00:00:00.000002+00'
      END
      WHERE subject_id = 'tenant-a'
    `);
    const pageOne = await second.listExpiredManifests({ limit: 1 });
    expect(pageOne.items).toHaveLength(1);
    expect(pageOne.nextCursor).not.toBeNull();
    const pageTwo = await second.listExpiredManifests({ after: pageOne.nextCursor!, limit: 1 });
    expect(pageTwo.items).toHaveLength(1);
    expect(pageTwo.items[0]?.contentId).not.toBe(pageOne.items[0]?.contentId);

    const updates = await Promise.all([
      first.putManifest({
        subjectId: 'tenant-a',
        contentId: 'content-a',
        manifest: { checksum: CHECKSUM_B },
        isPinned: true,
        expectedLifecycleVersion: 1,
      }),
      second.putManifest({
        subjectId: 'tenant-a',
        contentId: 'content-a',
        manifest: { checksum: CHECKSUM_A, revision: 2 },
        isPinned: true,
        expectedLifecycleVersion: 1,
      }),
    ]);
    expect(updates.filter((result) => result.status === 'updated')).toHaveLength(1);
    expect(updates.filter((result) => result.status === 'conflict')).toHaveLength(1);

    for (let index = 0; index < 2; index += 1) {
      const input = reservation(`reconcile-${index}`, index, 1);
      const reserved = await first.reserve(input);
      if (reserved.status !== 'reserved') throw new Error('expected reconciliation reservation');
      await first.stage({
        reservationId: input.reservationId,
        fencingToken: reserved.reservation.fencingToken,
        observation: observation(input.objectKey, 1, `version-${index}`),
      });
    }
    await firstPool.query(`
      UPDATE hosted.storage_reservations
      SET created_at = CASE reservation_id
            WHEN 'reconcile-0' THEN TIMESTAMPTZ '2026-01-01 00:00:00.000001+00'
            ELSE TIMESTAMPTZ '2026-01-01 00:00:00.000002+00'
          END,
          expires_at = CASE reservation_id
            WHEN 'reconcile-0' THEN TIMESTAMPTZ '2099-01-01 00:00:00.000001+00'
            ELSE TIMESTAMPTZ '2099-01-01 00:00:00.000002+00'
          END
      WHERE reservation_id IN ('reconcile-0', 'reconcile-1')
    `);
    const firstReservationPage = await second.listReservations({
      subjectId: 'tenant-a',
      limit: 1,
    });
    const secondReservationPage = await second.listReservations({
      subjectId: 'tenant-a',
      after: firstReservationPage.nextCursor!,
      limit: 1,
    });
    expect(firstReservationPage.items).toHaveLength(1);
    expect(secondReservationPage.items).toHaveLength(1);
    expect(secondReservationPage.items[0]?.reservationId)
      .not.toBe(firstReservationPage.items[0]?.reservationId);
    const firstReconciliation = await second.listReconciliation({ limit: 1 });
    const secondReconciliation = await second.listReconciliation({
      after: firstReconciliation.nextCursor!,
      limit: 1,
    });
    expect(firstReconciliation.items).toHaveLength(1);
    expect(secondReconciliation.items).toHaveLength(1);
    expect(secondReconciliation.items[0]?.reservationId)
      .not.toBe(firstReconciliation.items[0]?.reservationId);
  });

  it('persists isolated versioned API objects, backup locators, and exact tenant deletion', async () => {
    await provision(100, POLICY, 'tenant-a');
    await provision(100, POLICY, 'tenant-b');
    expect(await first.recordApiUploadBlock({
      subjectId: 'tenant-a',
      objectId: 'api-object',
      blockIndex: 0,
      totalBlocks: 2,
      blockHash: CHECKSUM_A,
      sizeBytes: 3,
    })).toMatchObject({ status: 'inserted' });
    expect(await first.completeApiObject({
      subjectId: 'tenant-a',
      objectId: 'api-object',
      encryptedBytes: 7,
      ciphertextHash: 'cc'.repeat(64),
      dataClass: 'encrypted_backup_manifest',
      totalBlocks: 2,
      version: 'version-a',
    })).toEqual({ status: 'upload_incomplete' });
    expect(await second.recordApiUploadBlock({
      subjectId: 'tenant-a',
      objectId: 'api-object',
      blockIndex: 1,
      totalBlocks: 2,
      blockHash: CHECKSUM_B,
      sizeBytes: 4,
    })).toMatchObject({ status: 'inserted' });
    expect(await first.completeApiObject({
      subjectId: 'tenant-a',
      objectId: 'api-object',
      encryptedBytes: 7,
      ciphertextHash: 'cc'.repeat(64),
      dataClass: 'encrypted_backup_manifest',
      totalBlocks: 2,
      version: 'version-a',
    })).toMatchObject({ status: 'completed' });

    expect(await first.recordApiUploadBlock({
      subjectId: 'tenant-b',
      objectId: 'api-object',
      blockIndex: 0,
      totalBlocks: 1,
      blockHash: CHECKSUM_A,
      sizeBytes: 2,
    })).toMatchObject({ status: 'inserted' });
    expect(await first.completeApiObject({
      subjectId: 'tenant-b',
      objectId: 'api-object',
      encryptedBytes: 2,
      ciphertextHash: 'dd'.repeat(64),
      dataClass: 'encrypted_payload',
      totalBlocks: 1,
      version: 'version-b',
    })).toMatchObject({ status: 'completed' });
    expect(await second.getApiObject('tenant-a', 'api-object')).toMatchObject({
      ciphertextHash: 'cc'.repeat(64),
    });
    expect(await second.getApiObject('tenant-b', 'api-object')).toMatchObject({
      ciphertextHash: 'dd'.repeat(64),
    });
    expect((await first.listApiObjects({ subjectId: 'tenant-a', limit: 10 })).items)
      .toHaveLength(1);

    expect(await second.putBackupLocator({
      subjectId: 'tenant-a',
      formatVersion: 1,
      backupId: 'backup-a',
      encryptedManifestHash: 'cc'.repeat(64),
      createdAt: '2026-07-14T12:00:00.000Z',
      manifestObjectId: 'api-object',
    })).toMatchObject({ status: 'inserted' });
    expect((await first.listBackupLocators({ subjectId: 'tenant-a', limit: 10 })).items)
      .toHaveLength(1);
    expect((await first.listBackupLocators({ subjectId: 'tenant-b', limit: 10 })).items)
      .toEqual([]);

    expect(await first.deleteApiTenant('tenant-a')).toEqual({
      tenantRows: 1,
      policyRows: 1,
      objectRows: 1,
      uploadBlockRows: 2,
      backupRows: 1,
      storageObjectRows: 0,
      reservationRows: 0,
      seederManifestRows: 0,
    });
    expect(await second.deleteApiTenant('tenant-a')).toEqual({
      tenantRows: 0,
      policyRows: 0,
      objectRows: 0,
      uploadBlockRows: 0,
      backupRows: 0,
      storageObjectRows: 0,
      reservationRows: 0,
      seederManifestRows: 0,
    });
    expect(await first.getApiObject('tenant-b', 'api-object')).not.toBeNull();
  });
});
