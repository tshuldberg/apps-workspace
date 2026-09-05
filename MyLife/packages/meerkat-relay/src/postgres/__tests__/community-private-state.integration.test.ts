import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createCommunity,
  createManifest,
  extractSigningPrivateKeyHex,
  generateDeviceIdentity,
  reviseCommunity,
  signFeedAuth,
  signSealedTailEntry,
} from '@mylife/sync';
import {
  CommunityNode,
} from '../../community-node';
import { InMemorySeederPieceStore } from '../../seeder-node';
import { CommunityPrivateStateUnavailableError } from '../../community-private-state';
import { runPostgresMigrations } from '../migrate';
import { COMMUNITY_PRIVATE_STATE_SQL } from '../migrations/0007-community-private-state';
import { PostgresStoreContext } from '../store-context';
import { PostgresCommunityPrivateStateStore } from '../stores/community-private-state-store';
import { PostgresCommunityDescriptorStore } from '../stores/community-stores';

const connectionString = process.env.MEERKAT_TEST_POSTGRES_URL?.trim();
const destructiveTests = process.env.MEERKAT_ALLOW_DESTRUCTIVE_POSTGRES_TESTS === 'true';
const describePostgres = connectionString && destructiveTests
  ? describe.sequential
  : describe.skip;

function failingContext(): PostgresStoreContext {
  const failure = new Error('database unavailable');
  return new PostgresStoreContext({
    query: async () => { throw failure; },
    connect: async () => { throw failure; },
  } as unknown as Pool);
}

describe('PostgreSQL private community state outage mapping', () => {
  it('never translates a database outage into missing private state', async () => {
    const store = new PostgresCommunityPrivateStateStore(failingContext());
    await expect(store.getState('community'))
      .rejects.toBeInstanceOf(CommunityPrivateStateUnavailableError);
  });
});

describePostgres('PostgreSQL private community state multi-node integration', () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const isolatedDatabaseName = `meerkat_test_private_${suffix}`;
  let adminPool: Pool;
  let firstPool: Pool;
  let secondPool: Pool;
  let firstContext: PostgresStoreContext;
  let secondContext: PostgresStoreContext;

  beforeAll(async () => {
    adminPool = new Pool({ connectionString, max: 2 });
    adminPool.on('error', () => undefined);
    const current = await adminPool.query<{ name: string }>('SELECT current_database() AS name');
    if (!/^meerkat_(?:ci|test)(?:_|$)/u.test(current.rows[0]?.name ?? '')) {
      throw new Error('Private community integration requires a meerkat_ci or meerkat_test database');
    }
    await adminPool.query(`CREATE DATABASE "${isolatedDatabaseName}"`);
    const databaseUrl = new URL(connectionString!);
    databaseUrl.pathname = `/${isolatedDatabaseName}`;
    const poolOptions = {
      connectionString: databaseUrl.toString(),
      max: 4,
      statement_timeout: 30_000,
      lock_timeout: 5_000,
      idle_in_transaction_session_timeout: 15_000,
    };
    firstPool = new Pool({ ...poolOptions, application_name: 'meerkat-private-state-a' });
    firstPool.on('error', () => undefined);
    secondPool = new Pool({ ...poolOptions, application_name: 'meerkat-private-state-b' });
    secondPool.on('error', () => undefined);
    await runPostgresMigrations(firstPool);
    const exists = await firstPool.query<{ exists: string | null }>(
      "SELECT to_regclass('community.private_states')::text AS exists",
    );
    if (!exists.rows[0]?.exists) await firstPool.query(COMMUNITY_PRIVATE_STATE_SQL);
    firstContext = new PostgresStoreContext(firstPool);
    secondContext = new PostgresStoreContext(secondPool);
  });

  beforeEach(async () => {
    await firstPool.query(`
      TRUNCATE TABLE
        community.private_tail,
        community.private_snapshots,
        community.private_descriptor_history,
        community.private_states,
        community.private_challenges,
        community.private_rate_hits,
        community.private_publish_stages,
        community.descriptor_revisions
      RESTART IDENTITY CASCADE
    `);
  });

  afterAll(async () => {
    await Promise.all([firstPool.end(), secondPool.end()]);
    await adminPool.query(`DROP DATABASE IF EXISTS "${isolatedDatabaseName}" WITH (FORCE)`);
    await adminPool.end();
  });

  function fixture() {
    const owner = generateDeviceIdentity('Owner');
    const member = generateDeviceIdentity('Member');
    const descriptor = createCommunity(owner, {
      name: 'Two Node Private State',
      channels: [{ id: 'general', name: 'General' }],
      members: [{
        deviceId: member.publicKey,
        role: 'member',
        displayName: member.displayName,
        dhPublicKey: member.dhPublicKey,
      }],
      now: new Date().toISOString(),
    });
    return { owner, member, descriptor, communityId: descriptor.descriptor.communityId };
  }

  async function publish(
    node: CommunityNode,
    fx: ReturnType<typeof fixture>,
    descriptor = fx.descriptor,
  ): Promise<void> {
    const challenge = (await node.issueChallenge(fx.communityId))!;
    const ts = new Date().toISOString();
    const result = await node.publish(fx.communityId, {
      descriptor,
      snapshots: [],
    }, {
      deviceId: fx.owner.publicKey,
      nonce: challenge.nonce,
      ts,
      signature: signFeedAuth(fx.owner, {
        communityId: fx.communityId,
        nonce: challenge.nonce,
        ts,
      }),
    });
    expect(result.ok).toBe(true);
  }

  function nodes(rateLimit = 10) {
    const pieceStore = new InMemorySeederPieceStore();
    const first = new CommunityNode({
      pieceStore,
      descriptorStore: new PostgresCommunityDescriptorStore(firstContext),
      privateStateStore: new PostgresCommunityPrivateStateStore(firstContext),
      rateLimits: { appendPerWindow: rateLimit },
    });
    const second = new CommunityNode({
      pieceStore,
      descriptorStore: new PostgresCommunityDescriptorStore(secondContext),
      privateStateStore: new PostgresCommunityPrivateStateStore(secondContext),
      rateLimits: { appendPerWindow: rateLimit },
    });
    return { first, second };
  }

  async function auth(
    node: CommunityNode,
    fx: ReturnType<typeof fixture>,
  ) {
    const challenge = (await node.issueChallenge(fx.communityId))!;
    const ts = new Date().toISOString();
    return {
      deviceId: fx.member.publicKey,
      nonce: challenge.nonce,
      ts,
      signature: signFeedAuth(fx.member, {
        communityId: fx.communityId,
        nonce: challenge.nonce,
        ts,
      }),
    };
  }

  function tail(
    fx: ReturnType<typeof fixture>,
    counter: number,
  ) {
    return signSealedTailEntry(fx.member, {
      communityId: fx.communityId,
      channelId: 'general',
      authorDeviceId: fx.member.publicKey,
      hlcWall: new Date().toISOString(),
      hlcCounter: counter,
    }, new Uint8Array([counter + 1, 2, 3]));
  }

  it('allows exactly one mutation to consume a nonce across two node pools', async () => {
    const fx = fixture();
    const { first, second } = nodes();
    await publish(first, fx);
    const sharedAuth = await auth(first, fx);
    const outcomes = await Promise.all([
      first.append(fx.communityId, tail(fx, 1), sharedAuth),
      second.append(fx.communityId, tail(fx, 2), sharedAuth),
    ]);
    expect(outcomes.filter((outcome) => outcome.ok)).toHaveLength(1);
    expect(outcomes.filter((outcome) => !outcome.ok).map((outcome) => outcome.reason))
      .toEqual(['bad_nonce']);
    expect((await new PostgresCommunityPrivateStateStore(firstContext).getState(fx.communityId))?.tail)
      .toHaveLength(1);
  });

  it('deduplicates the same sealed append across two nodes and shares rate windows', async () => {
    const fx = fixture();
    const { first, second } = nodes(2);
    await publish(first, fx);
    const entry = tail(fx, 1);
    const [firstResult, secondResult] = await Promise.all([
      first.append(fx.communityId, entry, await auth(first, fx)),
      second.append(fx.communityId, entry, await auth(second, fx)),
    ]);
    expect(firstResult.ok).toBe(true);
    expect(secondResult.ok).toBe(true);
    expect((await new PostgresCommunityPrivateStateStore(firstContext).getState(fx.communityId))?.tail)
      .toEqual([entry]);

    const over = await first.append(fx.communityId, tail(fx, 2), await auth(first, fx));
    expect(over).toEqual({ ok: false, status: 429, reason: 'rate_limited' });
  });

  it('retains verifiable historical tail metadata across a roster revision', async () => {
    const fx = fixture();
    const { first } = nodes();
    await publish(first, fx);
    const entry = tail(fx, 1);
    expect((await first.append(fx.communityId, entry, await auth(first, fx))).ok).toBe(true);

    const revised = reviseCommunity(fx.owner, fx.descriptor, {
      name: 'Two Node Private State Revised',
    }, new Date(Date.now() + 1_000).toISOString());
    await publish(first, fx, revised);

    const state = await new PostgresCommunityPrivateStateStore(firstContext).getState(fx.communityId);
    expect(state?.descriptor.descriptor.revision).toBe(2);
    expect(state?.tail).toEqual([entry]);

    const bytes = new Uint8Array([4, 5, 6]);
    const manifest = createManifest({
      title: 'Compacting snapshot',
      description: '',
      files: [{ path: 'sealed.bin', data: bytes, mimeType: 'application/octet-stream' }],
      access: 'encrypted',
      category: 'other',
      tags: [],
      creatorPublicKey: fx.owner.publicKey,
      creatorDisplayName: fx.owner.displayName,
      creatorPrivateKey: extractSigningPrivateKeyHex(fx.owner.privateKeyRef),
    });
    const challenge = (await first.issueChallenge(fx.communityId))!;
    const ts = new Date().toISOString();
    expect((await first.publish(fx.communityId, {
      descriptor: revised,
      snapshots: [{ channelId: 'general', epoch: 1, manifest, pieces: [bytes] }],
    }, {
      deviceId: fx.owner.publicKey,
      nonce: challenge.nonce,
      ts,
      signature: signFeedAuth(fx.owner, {
        communityId: fx.communityId,
        nonce: challenge.nonce,
        ts,
      }),
    })).ok).toBe(true);
    expect((await new PostgresCommunityPrivateStateStore(firstContext).getState(fx.communityId))?.tail)
      .toEqual([]);
  });
});
