import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import {
  createDescriptorKill,
  createPublication,
  deriveCategoryRid,
  deriveContentRegistryId,
  generateDeviceIdentity,
  revisePublication,
  unpublish,
  type DeviceIdentity,
  type SignedPublicationDescriptor,
} from '@mylife/sync';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  PublicDirectoryNode,
  type DirectoryHostAnnouncementInput,
} from '../../public-directory-node';
import { runPostgresMigrations } from '../migrate';
import { PostgresStoreContext } from '../store-context';
import {
  PostgresDirectoryHostAnnouncementStore,
  PostgresPublicDirectoryRepository,
} from '../stores/directory-store';

const adminConnectionString = process.env.MEERKAT_TEST_POSTGRES_URL?.trim();
const destructive = process.env.MEERKAT_ALLOW_DESTRUCTIVE_POSTGRES_TESTS === 'true';
const describePostgres = adminConnectionString && destructive ? describe.sequential : describe.skip;
const CATEGORY_RID = deriveCategoryRid('technology');
const EXTRA_RID = 'ab'.repeat(16);
const THIRD_RID = 'cd'.repeat(16);
const HMAC_KEY = new Uint8Array(32).fill(0x5a);

function publication(
  owner: DeviceIdentity,
  suffix: string,
  updatedAt = '2026-07-10T00:00:00.000Z',
): SignedPublicationDescriptor {
  return createPublication(owner, {
    kind: 'community',
    communityId: `community-${suffix}`,
    title: `Publication ${suffix}`,
    description: `Directory integration ${suffix}`,
    category: 'technology',
    contentId: `content-${suffix}`,
    publicKeyHex: 'ab'.repeat(32),
    now: updatedAt,
  });
}

function hostInput(
  rid: string,
  clientKey: string,
  record: string,
  ttlMs = 60_000,
  maxAnnouncersPerHostRid = 8,
  maxHostRids = 100,
): DirectoryHostAnnouncementInput {
  return {
    rid,
    clientKey,
    rec: record,
    ttlMs,
    limits: {
      maxHostRids,
      maxAnnouncersPerHostRid,
      maxRecordChars: 32 * 1024,
    },
  };
}

describePostgres('PostgreSQL public-directory authority across two pools', () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const databaseName = `meerkat_test_directory_${suffix}`;
  const adminPool = new Pool({ connectionString: adminConnectionString });
  adminPool.on('error', () => undefined);
  let firstPool: Pool;
  let secondPool: Pool;
  let firstContext: PostgresStoreContext;
  let secondContext: PostgresStoreContext;

  beforeAll(async () => {
    await adminPool.query(`CREATE DATABASE "${databaseName}"`);
    const databaseUrl = new URL(adminConnectionString!);
    databaseUrl.pathname = `/${databaseName}`;
    firstPool = new Pool({ connectionString: databaseUrl.toString(), max: 4 });
    firstPool.on('error', () => undefined);
    secondPool = new Pool({ connectionString: databaseUrl.toString(), max: 4 });
    secondPool.on('error', () => undefined);
    firstContext = new PostgresStoreContext(firstPool);
    secondContext = new PostgresStoreContext(secondPool);
    await runPostgresMigrations(firstPool);
  });

  beforeEach(async () => {
    await firstPool.query(`
      TRUNCATE TABLE
        directory.host_announcements,
        directory.kills,
        directory.publication_rids,
        directory.publications
      RESTART IDENTITY CASCADE
    `);
  });

  afterAll(async () => {
    await firstPool?.end();
    await secondPool?.end();
    await adminPool.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    await adminPool.end();
  });

  function node(
    context: PostgresStoreContext,
    limits: { maxPublications: number; maxPublicationsPerOwner: number; maxRidsPerPublication?: number },
    authorityDeviceId?: string,
  ): PublicDirectoryNode {
    return new PublicDirectoryNode({
      repository: new PostgresPublicDirectoryRepository(context),
      hostAnnouncementStore: new PostgresDirectoryHostAnnouncementStore(context, {
        announcerHmacKey: HMAC_KEY,
      }),
      trustedKillAuthorityDeviceId: authorityDeviceId,
      limits: {
        ...limits,
        maxRidsPerPublication: limits.maxRidsPerPublication ?? 64,
      },
    });
  }

  it('enforces owner, global, and per-publication RID caps atomically', async () => {
    const owner = generateDeviceIdentity('directory-owner-cap');
    const first = node(firstContext, { maxPublications: 10, maxPublicationsPerOwner: 1, maxRidsPerPublication: 2 });
    const second = node(secondContext, { maxPublications: 10, maxPublicationsPerOwner: 1, maxRidsPerPublication: 2 });
    const alpha = publication(owner, 'owner-alpha');
    const beta = publication(owner, 'owner-beta');
    const outcomes = await Promise.all([
      first.announce('client-a', CATEGORY_RID, JSON.stringify(alpha)),
      second.announce('client-b', CATEGORY_RID, JSON.stringify(beta)),
    ]);
    expect(outcomes.filter((outcome) => outcome.ok)).toHaveLength(1);
    expect(outcomes).toContainEqual({ ok: false, code: 'owner_full' });

    const stored = (await new PostgresPublicDirectoryRepository(firstContext)
      .lookupPublications(CATEGORY_RID, 10))[0]!;
    await Promise.all([
      second.announce('client-c', EXTRA_RID, stored),
      first.announce('client-d', THIRD_RID, stored),
    ]);
    const ridCount = await firstPool.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM directory.publication_rids',
    );
    expect(ridCount.rows[0]?.count).toBe('2');
    const extraLookups = await Promise.all([
      new PostgresPublicDirectoryRepository(firstContext).lookupPublications(EXTRA_RID, 10),
      new PostgresPublicDirectoryRepository(secondContext).lookupPublications(THIRD_RID, 10),
    ]);
    expect(extraLookups.filter((records) => records.length === 1)).toHaveLength(1);

    await firstPool.query('TRUNCATE directory.publications CASCADE');
    const globalFirst = node(firstContext, { maxPublications: 1, maxPublicationsPerOwner: 1 });
    const globalSecond = node(secondContext, { maxPublications: 1, maxPublicationsPerOwner: 1 });
    const globalOutcomes = await Promise.all([
      globalFirst.announce(
        'client-d',
        CATEGORY_RID,
        JSON.stringify(publication(generateDeviceIdentity('global-a'), 'global-a')),
      ),
      globalSecond.announce(
        'client-e',
        CATEGORY_RID,
        JSON.stringify(publication(generateDeviceIdentity('global-b'), 'global-b')),
      ),
    ]);
    expect(globalOutcomes.filter((outcome) => outcome.ok)).toHaveLength(1);
    expect(globalOutcomes).toContainEqual({ ok: false, code: 'directory_full' });
  });

  it('keeps an owner takedown terminal when it races a refresh', async () => {
    const owner = generateDeviceIdentity('directory-takedown-owner');
    const first = node(firstContext, { maxPublications: 10, maxPublicationsPerOwner: 10 });
    const second = node(secondContext, { maxPublications: 10, maxPublicationsPerOwner: 10 });
    const genesis = publication(owner, 'takedown');
    expect(await first.announce('client-a', CATEGORY_RID, JSON.stringify(genesis))).toEqual({ ok: true });
    const revised = revisePublication(
      owner,
      genesis,
      { title: 'Publication takedown v2' },
      '2026-07-10T00:01:00.000Z',
    );
    const terminal = unpublish(owner, revised, '2026-07-10T00:02:00.000Z');
    await Promise.all([
      first.announce('client-a', CATEGORY_RID, JSON.stringify(genesis)),
      second.announce('client-b', CATEGORY_RID, JSON.stringify(terminal)),
    ]);
    expect(await first.lookup('reader-a', CATEGORY_RID)).toEqual({ ok: true, recs: [] });
    expect(await second.announce('client-c', CATEGORY_RID, JSON.stringify(genesis))).toEqual({ ok: true });
    expect(await second.lookup('reader-b', CATEGORY_RID)).toEqual({ ok: true, recs: [] });
    const row = await firstPool.query<{ descriptor_status: string; descriptor_revision: string }>(
      `SELECT descriptor_status, descriptor_revision::text
       FROM directory.publications
       WHERE publication_id = $1`,
      [genesis.descriptor.publicationId],
    );
    expect(row.rows[0]).toEqual({ descriptor_status: 'unpublished', descriptor_revision: '3' });
  });

  it('observes kills immediately after warm reads and recomputes trending with batched host counts', async () => {
    const owner = generateDeviceIdentity('directory-trending-owner');
    const authority = generateDeviceIdentity('directory-kill-authority');
    const first = node(firstContext, { maxPublications: 10, maxPublicationsPerOwner: 10 }, authority.publicKey);
    const second = node(secondContext, { maxPublications: 10, maxPublicationsPerOwner: 10 }, authority.publicKey);
    const newer = publication(owner, 'newer', '2026-07-10T00:00:10.000Z');
    const older = publication(owner, 'older', '2026-07-10T00:00:05.000Z');
    await first.announce('publisher', CATEGORY_RID, JSON.stringify(newer));
    await first.announce('publisher', CATEGORY_RID, JSON.stringify(older));

    const olderRid = deriveContentRegistryId(older.descriptor.contentId);
    const firstHosts = new PostgresDirectoryHostAnnouncementStore(firstContext, {
      announcerHmacKey: HMAC_KEY,
    });
    const secondHosts = new PostgresDirectoryHostAnnouncementStore(secondContext, {
      announcerHmacKey: HMAC_KEY,
    });
    await Promise.all([
      firstHosts.announceHost(hostInput(olderRid, '198.51.100.1', 'host-one')),
      secondHosts.announceHost(hostInput(olderRid, '198.51.100.2', 'host-two')),
    ]);
    const warm = await second.trending('reader', undefined, 10);
    expect(warm.ok).toBe(true);
    if (!warm.ok) return;
    expect((JSON.parse(warm.recs[0]!) as SignedPublicationDescriptor).descriptor.publicationId)
      .toBe(older.descriptor.publicationId);

    expect(await first.recordKill(createDescriptorKill(
      authority,
      older.descriptor.communityId,
      'policy',
      '2026-07-10T00:03:00.000Z',
    ))).toBe(true);
    const afterKill = await second.trending('reader', undefined, 10);
    expect(afterKill.ok).toBe(true);
    if (!afterKill.ok) return;
    expect(afterKill.recs).toHaveLength(1);
    expect((JSON.parse(afterKill.recs[0]!) as SignedPublicationDescriptor).descriptor.publicationId)
      .toBe(newer.descriptor.publicationId);
    expect(await second.lookup('reader', CATEGORY_RID)).toMatchObject({ ok: true });
    const lookup = await second.lookup('another-reader', CATEGORY_RID);
    expect(lookup.ok && lookup.recs.some((rec) => rec.includes(older.descriptor.publicationId))).toBe(false);
  });

  it('enforces host slots across replicas, stores only keyed hashes, and expires by database time', async () => {
    const first = new PostgresDirectoryHostAnnouncementStore(firstContext, {
      announcerHmacKey: HMAC_KEY,
    });
    const second = new PostgresDirectoryHostAnnouncementStore(secondContext, {
      announcerHmacKey: HMAC_KEY,
    });
    const rid = deriveContentRegistryId('host-cap-content');
    const outcomes = await Promise.all([
      first.announceHost(hostInput(rid, '203.0.113.10', 'host-a', 20, 1)),
      second.announceHost(hostInput(rid, '203.0.113.11', 'host-b', 20, 1)),
    ]);
    expect(outcomes.filter((outcome) => outcome.ok)).toHaveLength(1);
    expect(outcomes).toContainEqual({ ok: false, code: 'rid_full' });
    const stored = await firstPool.query<{ announcer_hash: string }>(
      'SELECT announcer_hash FROM directory.host_announcements WHERE rid = $1',
      [rid],
    );
    expect(stored.rows[0]?.announcer_hash).toMatch(/^[0-9a-f]{64}$/u);
    expect(stored.rows[0]?.announcer_hash).not.toBe('203.0.113.10');
    expect(stored.rows[0]?.announcer_hash).not.toBe('203.0.113.11');

    await firstPool.query('SELECT pg_sleep(0.05)');
    expect(await second.lookupHosts(rid, 10)).toEqual([]);
    await second.pruneExpiredHosts();
    expect((await firstPool.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM directory.host_announcements',
    )).rows[0]?.count).toBe('0');

    const firstRid = deriveContentRegistryId('global-host-rid-a');
    const secondRid = deriveContentRegistryId('global-host-rid-b');
    const globalOutcomes = await Promise.all([
      first.announceHost(hostInput(firstRid, '198.51.100.10', 'global-a', 60_000, 8, 1)),
      second.announceHost(hostInput(secondRid, '198.51.100.11', 'global-b', 60_000, 8, 1)),
    ]);
    expect(globalOutcomes.filter((outcome) => outcome.ok)).toHaveLength(1);
    expect(globalOutcomes).toContainEqual({ ok: false, code: 'registry_full' });

    const restartedReplica = new PostgresDirectoryHostAnnouncementStore(secondContext, {
      announcerHmacKey: HMAC_KEY,
    });
    expect(await restartedReplica.stats()).toEqual({ liveRids: 1 });
  });

  it('expires publications using PostgreSQL time rather than process clocks', async () => {
    const owner = generateDeviceIdentity('directory-expiry-owner');
    const repository = new PostgresPublicDirectoryRepository(firstContext);
    const signed = publication(owner, 'expiry');
    expect(await repository.storePublication({
      signed,
      rec: JSON.stringify(signed),
      rid: CATEGORY_RID,
      ttlMs: 20,
      limits: {
        maxPublications: 10,
        maxPublicationsPerOwner: 10,
        maxRidsPerPublication: 10,
        maxHostRids: 10,
        maxAnnouncersPerHostRid: 10,
        maxRecordChars: 32 * 1024,
        publicationTtlMs: 60_000,
        hostTtlMs: 60_000,
      },
    })).toEqual({ ok: true });
    await secondPool.query('SELECT pg_sleep(0.05)');
    expect(await new PostgresPublicDirectoryRepository(secondContext)
      .lookupPublications(CATEGORY_RID, 10)).toEqual([]);
    await repository.pruneExpired();
    expect((await firstPool.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM directory.publications',
    )).rows[0]?.count).toBe('0');
  });
});
