import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import {
  createDescriptorKill,
  createPublication,
  createPublicAbuseReport,
  createPublicPost,
  createPublicPostTombstone,
  createPublicPostingFreeze,
  generateDeviceIdentity,
  publicPostNodeKeypairFromSeed,
  revisePublication,
  signPublicPostAcceptance,
  type AcceptedPublicPost,
} from '@mylife/sync';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CommunityNode } from '../../community-node';
import { runPostgresMigrations } from '../migrate';
import { PostgresStoreContext } from '../store-context';
import {
  PostgresCommunityDescriptorStore,
  PostgresKillStore,
  PostgresPublicationStore,
  PostgresPublicPostStore,
  PostgresReportStore,
} from '../stores/community-stores';

const adminConnectionString = process.env.MEERKAT_TEST_POSTGRES_URL?.trim();
const destructive = process.env.MEERKAT_ALLOW_DESTRUCTIVE_POSTGRES_TESTS === 'true';
const describePostgres = adminConnectionString && destructive ? describe.sequential : describe.skip;

describePostgres('PostgreSQL community adapters across two pools', () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const databaseName = `meerkat_test_community_${suffix}`;
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

  afterAll(async () => {
    await firstPool?.end();
    await secondPool?.end();
    await adminPool.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    await adminPool.end();
  });

  it('allows one conflicting descriptor revision claim and classifies the loser', async () => {
    const first = new PostgresCommunityDescriptorStore(firstContext);
    const second = new PostgresCommunityDescriptorStore(secondContext);
    const communityId = `community-${randomUUID()}`;
    const outcomes = await Promise.all([
      first.claimRevision(communityId, 1, 'hash-a'),
      second.claimRevision(communityId, 1, 'hash-b'),
    ]);
    expect(outcomes.sort()).toEqual(['conflict', 'inserted']);
    expect((await first.getHighestRevision(communityId))?.revision).toBe(1);
  });

  it('uses publication CAS and exposes a committed kill to a separate node immediately', async () => {
    const first = new PostgresPublicationStore(firstContext);
    const second = new PostgresPublicationStore(secondContext);
    const killWriter = new PostgresKillStore(firstContext);
    const killReader = new PostgresKillStore(secondContext);
    const owner = generateDeviceIdentity('postgres-publication-owner');
    const authority = generateDeviceIdentity('postgres-kill-authority');
    const communityId = `community-${randomUUID()}`;
    const genesis = createPublication(owner, {
      kind: 'community',
      communityId,
      title: 'Genesis',
      description: 'postgres publication',
      category: 'technology',
      contentId: `content-${randomUUID()}`,
      publicKeyHex: 'ab'.repeat(32),
      now: '2026-07-10T00:00:00.000Z',
    });
    await first.put(genesis.descriptor.publicationId, { signed: genesis, snapshots: [] });
    const alpha = revisePublication(owner, genesis, { title: 'Alpha' }, '2026-07-10T00:01:00.000Z');
    const beta = revisePublication(owner, genesis, { title: 'Beta' }, '2026-07-10T00:01:01.000Z');
    const replacements = await Promise.all([
      first.withPublicationWriteLock(genesis.descriptor.publicationId, () => first.replace(
        genesis.descriptor.publicationId,
        1,
        { signed: alpha, snapshots: [] },
      )),
      second.withPublicationWriteLock(genesis.descriptor.publicationId, () => second.replace(
        genesis.descriptor.publicationId,
        1,
        { signed: beta, snapshots: [] },
      )),
    ]);
    expect(replacements.sort()).toEqual(['conflict', 'updated']);

    const node = new CommunityNode({ publicationStore: second, killStore: killReader });
    expect(await node.getPublicationManifest(genesis.descriptor.publicationId)).not.toBeNull();
    await killWriter.recordKill(createDescriptorKill(
      authority,
      communityId,
      'policy',
      '2026-07-10T00:02:00.000Z',
    ));
    expect(await node.getPublicationManifest(genesis.descriptor.publicationId)).toBeNull();
  });

  it('serializes concurrent report appends and retains priority evidence at the cap', async () => {
    const first = new PostgresReportStore(firstContext);
    const second = new PostgresReportStore(secondContext);
    const publicationId = `publication-${randomUUID()}`;
    const reports = Array.from({ length: 20 }, (_, index) => createPublicAbuseReport(
      generateDeviceIdentity(`postgres-reporter-${index}`),
      {
        publicationId,
        targetKind: 'post',
        targetId: `post-${index}`,
        reason: index === 19 ? 'csam' : 'spam',
        reportedAt: new Date(Date.UTC(2026, 6, 10, 0, 0, index)).toISOString(),
      },
    ));
    await Promise.all(reports.map((report, index) =>
      (index % 2 === 0 ? first : second).appendCapped(publicationId, report, 5)));
    const stored = await first.get(publicationId);
    expect(stored).toHaveLength(5);
    expect(stored?.some((report) => report.report.reason === 'csam')).toBe(true);
  });

  it('deduplicates replayed posts and serializes freeze and tombstone replacements', async () => {
    const first = new PostgresPublicPostStore(firstContext);
    const second = new PostgresPublicPostStore(secondContext);
    const publicationId = `publication-${randomUUID()}`;
    const persona = publicPostNodeKeypairFromSeed('88'.repeat(32));
    const node = publicPostNodeKeypairFromSeed('99'.repeat(32));
    const post = createPublicPost(persona, {
      publicationId,
      channelId: 'general',
      body: 'one post',
      now: '2026-07-10T00:00:00.000Z',
    });
    const accepted: AcceptedPublicPost = {
      post,
      receipt: signPublicPostAcceptance(node, {
        post,
        hlc: { wall: '2026-07-10T00:00:00.000Z', counter: 0 },
        acceptedAt: '2026-07-10T00:00:00.000Z',
      }),
    };
    await Promise.all([first, second].map((store) =>
      store.withPublicationWriteLock(publicationId, async () => {
        const posts = await store.listPosts(publicationId);
        if (!posts.some((candidate) => candidate.post.postId === post.postId)) {
          await store.putPosts(publicationId, [...posts, accepted]);
        }
      })));
    expect(await first.listPosts(publicationId)).toHaveLength(1);

    const tombstone = createPublicPostTombstone(node, {
      publicationId,
      postId: post.postId,
      now: '2026-07-10T00:01:00.000Z',
    });
    const freeze = createPublicPostingFreeze(node, {
      publicationId,
      frozen: true,
      now: '2026-07-10T00:01:00.000Z',
    });
    await Promise.all([
      first.withPublicationWriteLock(publicationId, async () => {
        await first.putTombstones(publicationId, [tombstone]);
        await first.putPosts(publicationId, []);
      }),
      second.withPublicationWriteLock(publicationId, () => second.putFreeze(publicationId, freeze)),
    ]);
    expect(await first.listPosts(publicationId)).toEqual([]);
    expect((await second.listTombstones(publicationId))[0]?.signature).toBe(tombstone.signature);
    await second.putTombstones(publicationId, []);
    expect((await first.listTombstones(publicationId))[0]?.signature).toBe(tombstone.signature);
    expect((await first.getFreeze(publicationId))?.signature).toBe(freeze.signature);
  });
});
