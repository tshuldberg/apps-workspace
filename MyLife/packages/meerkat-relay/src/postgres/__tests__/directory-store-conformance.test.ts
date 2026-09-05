import { WebSocket } from 'ws';
import { afterEach, describe, expect, it } from 'vitest';
import {
  InMemoryDirectoryHostAnnouncementStore,
  PublicDirectoryNode,
  startPublicDirectoryNode,
  type DirectoryHostAnnouncementInput,
  type PublicDirectoryNodeServer,
  type PublicDirectoryRepository,
} from '../../public-directory-node';
import {
  PostgresDirectoryHostAnnouncementStore,
  PostgresPublicDirectoryRepository,
} from '../stores/directory-store';
import {
  PostgresStoreUnavailableError,
  type PostgresStoreContext,
} from '../store-context';

const RID_A = 'ab'.repeat(16);
const RID_B = 'cd'.repeat(16);
let server: PublicDirectoryNodeServer | null = null;

afterEach(async () => {
  await server?.close();
  server = null;
});

function hostInput(
  clientKey: string,
  rid = RID_A,
  rec = `record-${clientKey}`,
): DirectoryHostAnnouncementInput {
  return {
    clientKey,
    rid,
    rec,
    ttlMs: 1_000,
    limits: {
      maxHostRids: 1,
      maxAnnouncersPerHostRid: 1,
      maxRecordChars: 1_024,
    },
  };
}

function roundTrip(url: string, frame: unknown): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.once('open', () => socket.send(JSON.stringify(frame)));
    socket.once('message', (data) => {
      try {
        resolve(JSON.parse(data.toString('utf8')) as Record<string, unknown>);
      } catch (error) {
        reject(error);
      } finally {
        socket.close();
      }
    });
    socket.once('error', reject);
  });
}

describe('directory store contracts', () => {
  it('enforces host rid and announcer caps while allowing refreshes and expiry', async () => {
    let now = 1_000;
    const store = new InMemoryDirectoryHostAnnouncementStore(() => now);

    expect(await store.announceHost(hostInput('client-a'))).toEqual({ ok: true });
    expect(await store.announceHost(hostInput('client-a', RID_A, 'refreshed'))).toEqual({ ok: true });
    expect(await store.announceHost(hostInput('client-b'))).toEqual({ ok: false, code: 'rid_full' });
    expect(await store.announceHost(hostInput('client-c', RID_B))).toEqual({
      ok: false,
      code: 'registry_full',
    });
    expect(await store.lookupHosts(RID_A, 10)).toEqual(['refreshed']);
    expect((await store.countLiveHosts([RID_A])).get(RID_A)).toBe(1);

    now += 1_001;
    await store.pruneExpiredHosts();
    expect(await store.lookupHosts(RID_A, 10)).toEqual([]);
    expect(await store.announceHost(hostInput('client-c', RID_B))).toEqual({ ok: true });
  });

  it('requires a decoded 256-bit HMAC key for persisted announcer identities', () => {
    const context = {} as PostgresStoreContext;
    expect(() => new PostgresDirectoryHostAnnouncementStore(context, {
      announcerHmacKey: new Uint8Array(31),
    })).toThrow(/at least 32 decoded bytes/u);
    expect(() => new PostgresDirectoryHostAnnouncementStore(context, {
      announcerHmacKey: new Uint8Array(32),
    })).not.toThrow();
  });

  it('maps PostgreSQL failures to an explicit unavailable error', async () => {
    const context = {
      query: async () => { throw new Error('database offline'); },
    } as unknown as PostgresStoreContext;
    await expect(new PostgresPublicDirectoryRepository(context).lookupPublications(RID_A, 10))
      .rejects.toBeInstanceOf(PostgresStoreUnavailableError);
  });

  it('sends service_unavailable rather than bad_frame for repository outages', async () => {
    const unavailable = new PostgresStoreUnavailableError('directory lookup', new Error('offline'));
    const repository: PublicDirectoryRepository = {
      storePublication: async () => { throw unavailable; },
      recordUnpublish: async () => { throw unavailable; },
      recordKill: async () => { throw unavailable; },
      lookupPublications: async () => { throw unavailable; },
      listTrendingCandidates: async () => { throw unavailable; },
      pruneExpired: async () => { throw unavailable; },
    };
    server = await startPublicDirectoryNode({
      node: new PublicDirectoryNode({ repository }),
      host: '127.0.0.1',
    });
    await expect(roundTrip(server.url, { t: 'lk', rid: RID_A })).resolves.toMatchObject({
      t: 'err',
      code: 'service_unavailable',
    });
  });
});
