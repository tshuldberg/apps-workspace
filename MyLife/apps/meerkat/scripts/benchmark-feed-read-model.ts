import {
  createInMemoryTestDatabase,
  type DatabaseAdapter,
} from '@mylife/db';
import {
  createChannelMessage,
  createChannelMessageV2,
  createCommunity,
  generateDeviceIdentity,
  type ChannelMessageEvent,
  type StoredCommunity,
} from '@mylife/sync';
import {
  createChannelPostEvent,
  ensureCommunityTables,
  insertMessageRow,
  insertPostHeaderRow,
  listChannelPostCards,
  listChannelReactions,
} from '../app/(root)/data/community-core';
import { evaluateLocalFeed } from '../app/(root)/data/feed-core';

const SIZES = [20, 80, 320] as const;
const WARMUPS = 3;
const REPETITIONS = 9;
const COMMUNITY_ID = 'benchmark-community';
const CHANNEL_ID = 'general';

interface MeasuredRun {
  queries: number;
  medianMs: number;
  p95Ms: number;
}

function percentile(samples: readonly number[], fraction: number): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * fraction) - 1] ?? 0;
}

function instrument(adapter: DatabaseAdapter): {
  adapter: DatabaseAdapter;
  reset: () => void;
  queries: () => number;
} {
  let queryCount = 0;
  return {
    adapter: {
      execute: (sql, params) => adapter.execute(sql, params),
      query: <T>(sql: string, params?: unknown[]) => {
        queryCount += 1;
        return adapter.query<T>(sql, params);
      },
      transaction: (fn) => adapter.transaction(fn),
    },
    reset: () => {
      queryCount = 0;
    },
    queries: () => queryCount,
  };
}

function measure(measured: ReturnType<typeof instrument>, run: () => void): MeasuredRun {
  for (let index = 0; index < WARMUPS; index += 1) run();

  const samples: number[] = [];
  let queryCount = 0;
  for (let index = 0; index < REPETITIONS; index += 1) {
    measured.reset();
    const startedAt = performance.now();
    run();
    samples.push(performance.now() - startedAt);
    queryCount = measured.queries();
  }

  return {
    queries: queryCount,
    medianMs: percentile(samples, 0.5),
    p95Ms: percentile(samples, 0.95),
  };
}

function feedFixture(postCount: number): {
  close: () => void;
  measured: ReturnType<typeof instrument>;
  community: StoredCommunity;
  communityId: string;
  selfDeviceId: string;
} {
  const database = createInMemoryTestDatabase();
  ensureCommunityTables(database.adapter);
  const self = generateDeviceIdentity('Benchmark self');
  const peer = generateDeviceIdentity('Benchmark peer');
  const signed = createCommunity(self, {
    name: 'Benchmark community',
    channels: [{ id: CHANNEL_ID, name: CHANNEL_ID }],
    members: [{
      deviceId: peer.publicKey,
      role: 'member',
      displayName: 'Benchmark peer',
      dhPublicKey: peer.dhPublicKey,
    }],
    now: '2026-09-02T00:00:00.000Z',
  });
  const communityId = signed.descriptor.communityId;

  for (let index = 0; index < postCount; index += 1) {
    const event = createChannelPostEvent(peer, {
      communityId,
      channelId: CHANNEL_ID,
      body: `Benchmark post ${index}`,
      hlc: {
        wall: new Date(Date.UTC(2026, 8, 2, 0, 0, index)).toISOString(),
        counter: 0,
      },
    });
    insertMessageRow(database.adapter, event);
    insertPostHeaderRow(database.adapter, event);
  }

  return {
    close: database.close,
    measured: instrument(database.adapter),
    community: {
      communityId,
      descriptor: signed.descriptor,
      signature: signed.signature,
      myRole: 'owner',
      joinedAt: '2026-09-02T00:00:00.000Z',
      updatedAt: '2026-09-02T00:00:00.000Z',
    },
    communityId,
    selfDeviceId: self.publicKey,
  };
}

function reactionFixture(reactionCount: number): {
  close: () => void;
  measured: ReturnType<typeof instrument>;
  selfDeviceId: string;
} {
  const database = createInMemoryTestDatabase();
  ensureCommunityTables(database.adapter);
  const self = generateDeviceIdentity('Benchmark self');
  const peer = generateDeviceIdentity('Benchmark peer');
  const target = createChannelMessage(peer, {
    communityId: COMMUNITY_ID,
    channelId: CHANNEL_ID,
    body: 'Reaction target',
    hlc: { wall: '2026-09-02T00:00:00.000Z', counter: 0 },
  });
  insertMessageRow(database.adapter, target);

  for (let index = 0; index < reactionCount; index += 1) {
    const reaction: ChannelMessageEvent = createChannelMessageV2(peer, {
      communityId: COMMUNITY_ID,
      channelId: CHANNEL_ID,
      body: '👍',
      hlc: {
        wall: new Date(Date.UTC(2026, 8, 2, 0, 0, index + 1)).toISOString(),
        counter: 0,
      },
      parentId: target.id,
      intent: 'react',
      authorKind: 'human',
    });
    insertMessageRow(database.adapter, reaction);
  }

  return {
    close: database.close,
    measured: instrument(database.adapter),
    selfDeviceId: self.publicKey,
  };
}

const results = SIZES.map((size) => {
  const feed = feedFixture(size);
  const cards = measure(feed.measured, () => {
    listChannelPostCards(feed.measured.adapter, feed.communityId, CHANNEL_ID);
  });
  const localFeed = measure(feed.measured, () => {
    evaluateLocalFeed({
      db: feed.measured.adapter,
      communities: [feed.community],
      selfDeviceId: feed.selfDeviceId,
      limit: size + 10,
    });
  });
  feed.close();

  const reaction = reactionFixture(size);
  const reactions = measure(reaction.measured, () => {
    listChannelReactions(
      reaction.measured.adapter,
      COMMUNITY_ID,
      CHANNEL_ID,
      reaction.selfDeviceId,
    );
  });
  reaction.close();

  return { size, cards, feed: localFeed, reactions };
});

console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  warmups: WARMUPS,
  repetitions: REPETITIONS,
  results,
}, null, 2));
