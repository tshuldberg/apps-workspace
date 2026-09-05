/**
 * Plan 29 Phase 1 (T1.2 + T1.3): runAutoConnectJob over two real in-memory
 * engines and a loopback relay connection. A full round runs a REAL session
 * (pad crosses, backoff resets); an offline peer produces a real failed row plus
 * a backoff advance and never a fabricated completed; a second immediate round
 * skips on the min interval unless changes are pending. The NC tests assert an
 * opted-out peer is never dialed, no relay dial happens without a relay, and the
 * token on the wire is the session token, never the mailbox token.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import type { ModuleSyncPolicy } from '@mylife/module-registry/types';
import type { PairedDevice, TransportConnection } from '../types';
import { createSyncTables, migrateSyncSchema } from '../db/schema';
import { insertPairedDevice, readAutoConnectState, setPeerAutoConnect } from '../db/queries';
import { generateDeviceIdentity } from '../identity/device-identity';
import { storeSharedSecret } from '../secrets/sync-secret-store';
import type { DocumentManager } from '../crdt/document-manager';
import { LwwDocumentManager } from '../crdt/lww-document-manager';
import { SyncEngine as NativeSyncEngine } from '../engine/sync-engine.native';
import type { RelayBackend, RelaySession } from '../transport/relay-transport';
import { runAutoConnectJob } from '../engine/auto-connect';
import { deriveSessionRendezvousToken, utcDayBucket } from '../protocol/session-token';
import { deriveMailboxToken } from '../protocol/mailbox';

const SECRET = 'ab'.repeat(32);
const RELAY = 'ws://relay';

const PAD_POLICY: ModuleSyncPolicy = {
  defaultScope: 'personal_replica',
  shareable: true,
  entityRules: [{ tableName: 'mp_pad', defaultScope: 'personal_replica', conflictStrategy: 'lww' }],
};
const POLICIES = new Map([['pad', PAD_POLICY]]);
const PREFIXES = new Map([['pad', 'mp_']]);

function connectionPair(deviceA: string, deviceB: string): { connA: TransportConnection; connB: TransportConnection } {
  const handlersForA: Array<(d: Uint8Array) => void> = [];
  const handlersForB: Array<(d: Uint8Array) => void> = [];
  const bufferForA: Uint8Array[] = [];
  const bufferForB: Uint8Array[] = [];

  function deliver(handlers: Array<(d: Uint8Array) => void>, buffer: Uint8Array[], data: Uint8Array): void {
    if (handlers.length === 0) { buffer.push(data); return; }
    for (const h of [...handlers]) h(data);
  }
  function attach(handlers: Array<(d: Uint8Array) => void>, buffer: Uint8Array[], h: (d: Uint8Array) => void): void {
    handlers.push(h);
    if (buffer.length > 0) {
      const queued = buffer.splice(0, buffer.length);
      for (const d of queued) h(d);
    }
  }

  const connA: TransportConnection = {
    id: 'conn-a', remoteDeviceId: deviceB, transport: 'wan_relay',
    send: async (data) => { setTimeout(() => deliver(handlersForB, bufferForB, data), 0); },
    onData: (h) => attach(handlersForA, bufferForA, h),
    close: async () => {},
  };
  const connB: TransportConnection = {
    id: 'conn-b', remoteDeviceId: deviceA, transport: 'wan_relay',
    send: async (data) => { setTimeout(() => deliver(handlersForA, bufferForA, data), 0); },
    onData: (h) => attach(handlersForB, bufferForB, h),
    close: async () => {},
  };
  return { connA, connB };
}

class DeadRelaySession implements RelaySession {
  async send(): Promise<void> {}
  onMessage(): void {}
  async close(): Promise<void> {}
}
class DeadRelayBackend implements RelayBackend {
  destroyed = false;
  async connect(): Promise<RelaySession> { return new DeadRelaySession(); }
  destroy(): void { this.destroyed = true; }
}

function paired(deviceId: string, dhPublicKey: string): PairedDevice {
  return {
    deviceId,
    displayName: 'peer',
    dhPublicKey,
    sharedSecretRef: storeSharedSecret('self', deviceId, SECRET),
    isActive: true,
    pairedAt: '2026-06-14T00:00:00.000Z',
    bytesSent: 0,
    bytesReceived: 0,
    lastSeenAt: null,
    lastSyncAt: null,
    lastSyncModule: null,
  } as unknown as PairedDevice;
}

function freshDb(): InMemoryTestDatabase {
  const db = createInMemoryTestDatabase();
  createSyncTables(db.adapter);
  migrateSyncSchema(db.adapter);
  db.adapter.execute('CREATE TABLE mp_pad (id TEXT PRIMARY KEY, body TEXT, updated_at TEXT)');
  return db;
}

let dbA: InMemoryTestDatabase | null = null;
let dbB: InMemoryTestDatabase | null = null;
afterEach(() => {
  dbA?.close(); dbA = null;
  dbB?.close(); dbB = null;
});

describe('runAutoConnectJob (Plan 29 Phase 1)', () => {
  it('a full round runs a real session, moves the pad, and resets backoff', async () => {
    const idA = generateDeviceIdentity('Device A');
    const idB = generateDeviceIdentity('Device B');
    // The lexicographically lower id initiates; author the pad there so its
    // push direction proves the round did real work regardless of key ordering.
    const aIsLower = idA.publicKey < idB.publicKey;
    const lower = aIsLower ? idA : idB;
    const higher = aIsLower ? idB : idA;

    dbA = freshDb();
    dbB = freshDb();
    const dbLower = aIsLower ? dbA : dbB;
    const dbHigher = aIsLower ? dbB : dbA;

    insertPairedDevice(dbLower.adapter, paired(higher.publicKey, higher.dhPublicKey));
    insertPairedDevice(dbHigher.adapter, paired(lower.publicKey, lower.dhPublicKey));

    const engineLower = new NativeSyncEngine({
      db: dbLower.adapter, identity: lower, modulePrefixes: PREFIXES,
      enabledModules: ['pad'], modulePolicies: POLICIES,
      documentManager: new LwwDocumentManager() as unknown as DocumentManager,
    });
    const engineHigher = new NativeSyncEngine({
      db: dbHigher.adapter, identity: higher, modulePrefixes: PREFIXES,
      enabledModules: ['pad'], modulePolicies: POLICIES,
      documentManager: new LwwDocumentManager() as unknown as DocumentManager,
    });
    await engineLower.initialize();
    await engineHigher.initialize();

    dbLower.adapter.execute('INSERT INTO mp_pad (id, body, updated_at) VALUES (?, ?, ?)', ['pad', 'hi from lower', '2026-06-14T00:00:00.000Z']);
    engineLower.recordChange('mp_pad', 'INSERT', 'pad', { id: 'pad', body: 'hi from lower', updated_at: '2026-06-14T00:00:00.000Z' });

    const { connA: connLower, connB: connHigher } = connectionPair(lower.publicKey, higher.publicKey);

    const [lowerResult, higherResult] = await Promise.all([
      runAutoConnectJob({
        db: dbLower.adapter, selfDeviceId: lower.publicKey, engine: engineLower,
        relayUrl: RELAY, relayBackendFactory: () => new DeadRelayBackend(),
        resolvePeerSecret: () => SECRET, connectRelay: async () => connLower,
        now: () => Date.now(),
      }),
      runAutoConnectJob({
        db: dbHigher.adapter, selfDeviceId: higher.publicKey, engine: engineHigher,
        relayUrl: RELAY, relayBackendFactory: () => new DeadRelayBackend(),
        resolvePeerSecret: () => SECRET, connectRelay: async () => connHigher,
        now: () => Date.now(),
      }),
    ]);

    // The initiator recorded a completed dial; the responder handled a session.
    expect(lowerResult.completed).toBe(1);
    expect(lowerResult.failed).toBe(0);
    expect(higherResult.completed).toBe(1);

    // The pad crossed to the higher device.
    const rows = dbHigher.adapter.query<{ body: string }>('SELECT body FROM mp_pad WHERE id = ?', ['pad']);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.body).toBe('hi from lower');

    // Backoff reset on both sides.
    const lowerState = readAutoConnectState(dbLower.adapter, higher.publicKey);
    expect(lowerState?.failureCount).toBe(0);
    expect(lowerState?.nextAttemptAt).toBeNull();
    expect(lowerState?.lastResult).toBe('completed');
    const higherState = readAutoConnectState(dbHigher.adapter, lower.publicKey);
    expect(higherState?.lastResult).toBe('listened');
  });

  it('an offline peer yields a real failed attempt, a backoff advance, and no fabricated completed', async () => {
    const idA = generateDeviceIdentity('Device A');
    dbA = freshDb();
    // A peer id above any real pubkey so self always initiates (and thus fails,
    // rather than silently listening).
    const peerId = 'f'.repeat(64);
    insertPairedDevice(dbA.adapter, paired(peerId, 'ff'.repeat(16)));

    const engineA = new NativeSyncEngine({
      db: dbA.adapter, identity: idA, modulePrefixes: PREFIXES,
      enabledModules: ['pad'], modulePolicies: POLICIES,
      documentManager: new LwwDocumentManager() as unknown as DocumentManager,
    });
    await engineA.initialize();

    const CLOCK = 1_800_000_000_000;
    const result = await runAutoConnectJob({
      db: dbA.adapter, selfDeviceId: idA.publicKey, engine: engineA,
      relayUrl: RELAY, relayBackendFactory: () => new DeadRelayBackend(),
      resolvePeerSecret: () => SECRET,
      // Relay unreachable: connect throws, a real failure with no session.
      connectRelay: async () => { throw new Error('relay unreachable'); },
      now: () => CLOCK,
    });

    expect(result.attempted).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.completed).toBe(0);

    // No fabricated completed session anywhere.
    const completed = dbA.adapter.query<{ c: number }>("SELECT COUNT(*) AS c FROM sync_sessions WHERE status = 'completed'");
    expect(completed[0]!.c).toBe(0);

    // Backoff advanced to the first ladder rung (30s).
    const state = readAutoConnectState(dbA.adapter, peerId);
    expect(state?.failureCount).toBe(1);
    expect(state?.nextAttemptAt).toBe(CLOCK + 30_000);
    expect(result.nextEarliestRetryAt).toBe(CLOCK + 30_000);
    expect(state?.lastResult).toBe('failed');
  });

  it('a listener connection failure is a failed attempt with backoff', async () => {
    const identity = generateDeviceIdentity('Listener');
    dbA = freshDb();
    const peerId = '0'.repeat(64);
    insertPairedDevice(dbA.adapter, paired(peerId, 'ff'.repeat(16)));
    const engine = new NativeSyncEngine({
      db: dbA.adapter, identity, modulePrefixes: PREFIXES,
      enabledModules: ['pad'], modulePolicies: POLICIES,
    });
    await engine.initialize();
    const clock = 1_800_000_000_000;
    const result = await runAutoConnectJob({
      db: dbA.adapter, selfDeviceId: identity.publicKey, engine,
      relayUrl: RELAY, relayBackendFactory: () => new DeadRelayBackend(),
      resolvePeerSecret: () => SECRET,
      connectRelay: async () => { throw new Error('relay unreachable'); },
      now: () => clock,
    });
    expect(result).toMatchObject({ attempted: 1, failed: 1, completed: 0, skipped: 0 });
    expect(result.nextEarliestRetryAt).toBe(clock + 30_000);
    expect(readAutoConnectState(dbA.adapter, peerId)).toMatchObject({ failureCount: 1, lastResult: 'failed' });
  });

  it('a real listener handshake timeout never counts as synced', async () => {
    const identity = generateDeviceIdentity('Listener');
    dbA = freshDb();
    const peerId = '0'.repeat(64);
    insertPairedDevice(dbA.adapter, paired(peerId, 'ff'.repeat(16)));
    const engine = new NativeSyncEngine({
      db: dbA.adapter, identity, modulePrefixes: PREFIXES,
      enabledModules: ['pad'], modulePolicies: POLICIES,
    });
    await engine.initialize();
    const result = await runAutoConnectJob({
      db: dbA.adapter, selfDeviceId: identity.publicKey, engine,
      relayUrl: RELAY, relayBackendFactory: () => new DeadRelayBackend(),
      resolvePeerSecret: () => SECRET,
      connectRelay: async () => ({
        id: 'silent', remoteDeviceId: peerId, transport: 'wan_relay',
        send: async () => {}, onData: () => {}, close: async () => {},
      }),
    });
    expect(dbA.adapter.query<{ status: string }>('SELECT status FROM sync_sessions'))
      .toEqual([{ status: 'failed' }]);
    expect(result).toMatchObject({ attempted: 1, failed: 1, completed: 0 });
    expect(readAutoConnectState(dbA.adapter, peerId)?.lastResult).toBe('failed');
  }, 20_000);

  it('overlapping triggers share one dial and a later round can run', async () => {
    const identity = generateDeviceIdentity('Listener');
    dbA = freshDb();
    const peerId = '0'.repeat(64);
    insertPairedDevice(dbA.adapter, paired(peerId, 'ff'.repeat(16)));
    const engine = new NativeSyncEngine({
      db: dbA.adapter, identity, modulePrefixes: PREFIXES,
      enabledModules: ['pad'], modulePolicies: POLICIES,
    });
    await engine.initialize();
    let release!: () => void;
    const waiting = new Promise<void>((resolve) => { release = resolve; });
    let calls = 0;
    let clock = 1_800_000_000_000;
    const deps = {
      db: dbA.adapter, selfDeviceId: identity.publicKey, engine,
      relayUrl: RELAY, relayBackendFactory: () => new DeadRelayBackend(),
      resolvePeerSecret: () => SECRET,
      connectRelay: async (): Promise<TransportConnection> => {
        calls += 1;
        await waiting;
        throw new Error('offline');
      },
      now: () => clock,
    };
    const first = runAutoConnectJob(deps);
    const overlapping = runAutoConnectJob(deps);
    expect(first).toBe(overlapping);
    expect(calls).toBe(1);
    release();
    await first;
    expect(readAutoConnectState(dbA.adapter, peerId)?.failureCount).toBe(1);
    clock += 31_000;
    await runAutoConnectJob(deps);
    expect(calls).toBe(2);
  });

  it('a second immediate round skips on the min interval unless changes are pending', async () => {
    const idA = generateDeviceIdentity('Device A');
    const idB = generateDeviceIdentity('Device B');
    const aIsLower = idA.publicKey < idB.publicKey;
    const lower = aIsLower ? idA : idB;
    const higher = aIsLower ? idB : idA;

    dbA = freshDb();
    dbB = freshDb();
    const dbLower = aIsLower ? dbA : dbB;
    const dbHigher = aIsLower ? dbB : dbA;
    insertPairedDevice(dbLower.adapter, paired(higher.publicKey, higher.dhPublicKey));
    insertPairedDevice(dbHigher.adapter, paired(lower.publicKey, lower.dhPublicKey));

    const engineLower = new NativeSyncEngine({
      db: dbLower.adapter, identity: lower, modulePrefixes: PREFIXES,
      enabledModules: ['pad'], modulePolicies: POLICIES,
      documentManager: new LwwDocumentManager() as unknown as DocumentManager,
    });
    const engineHigher = new NativeSyncEngine({
      db: dbHigher.adapter, identity: higher, modulePrefixes: PREFIXES,
      enabledModules: ['pad'], modulePolicies: POLICIES,
      documentManager: new LwwDocumentManager() as unknown as DocumentManager,
    });
    await engineLower.initialize();
    await engineHigher.initialize();

    async function round(pendingForLower: number): Promise<void> {
      const { connA: connLower, connB: connHigher } = connectionPair(lower.publicKey, higher.publicKey);
      await Promise.all([
        runAutoConnectJob({
          db: dbLower.adapter, selfDeviceId: lower.publicKey, engine: engineLower,
          relayUrl: RELAY, relayBackendFactory: () => new DeadRelayBackend(),
          resolvePeerSecret: () => SECRET, connectRelay: async () => connLower,
          pendingChangesForPeer: () => pendingForLower, now: () => Date.now(),
        }),
        runAutoConnectJob({
          db: dbHigher.adapter, selfDeviceId: higher.publicKey, engine: engineHigher,
          relayUrl: RELAY, relayBackendFactory: () => new DeadRelayBackend(),
          resolvePeerSecret: () => SECRET, connectRelay: async () => connHigher,
          now: () => Date.now(),
        }),
      ]);
    }

    // Round 1 completes a real session.
    await round(0);
    const firstCount = dbLower.adapter.query<{ c: number }>("SELECT COUNT(*) AS c FROM sync_sessions WHERE status = 'completed'")[0]!.c;
    expect(firstCount).toBeGreaterThanOrEqual(1);

    // Round 2, immediately after, with nothing pending: the initiator skips.
    const skipResult = await runAutoConnectJob({
      db: dbLower.adapter, selfDeviceId: lower.publicKey, engine: engineLower,
      relayUrl: RELAY, relayBackendFactory: () => new DeadRelayBackend(),
      resolvePeerSecret: () => SECRET, connectRelay: async () => { throw new Error('should not dial'); },
      pendingChangesForPeer: () => 0, now: () => Date.now(),
    });
    expect(skipResult.attempted).toBe(0);
    expect(skipResult.skipped).toBe(1);

    // Round 2b, with a pending change, dials again.
    await round(3);
    const secondCount = dbLower.adapter.query<{ c: number }>("SELECT COUNT(*) AS c FROM sync_sessions WHERE status = 'completed'")[0]!.c;
    expect(secondCount).toBeGreaterThan(firstCount);
  });

  it('never dials a peer with auto_connect = 0 (AC-4, engine-enforced)', async () => {
    const idA = generateDeviceIdentity('Device A');
    dbA = freshDb();
    const peerId = 'f'.repeat(64);
    insertPairedDevice(dbA.adapter, paired(peerId, 'ff'.repeat(16)));
    setPeerAutoConnect(dbA.adapter, peerId, false);

    const engineA = new NativeSyncEngine({
      db: dbA.adapter, identity: idA, modulePrefixes: PREFIXES, enabledModules: ['pad'], modulePolicies: POLICIES,
      documentManager: new LwwDocumentManager() as unknown as DocumentManager,
    });
    await engineA.initialize();

    let dialed = false;
    const result = await runAutoConnectJob({
      db: dbA.adapter, selfDeviceId: idA.publicKey, engine: engineA,
      relayUrl: RELAY, relayBackendFactory: () => new DeadRelayBackend(),
      resolvePeerSecret: () => SECRET,
      connectRelay: async () => { dialed = true; throw new Error('should not dial'); },
      now: () => Date.now(),
    });
    expect(dialed).toBe(false);
    expect(result.attempted).toBe(0);
    expect(result.dials).toEqual([]);
  });

  it('does not relay-dial when no relay is available and the peer is not on LAN (health gate)', async () => {
    const idA = generateDeviceIdentity('Device A');
    dbA = freshDb();
    const peerId = 'f'.repeat(64);
    insertPairedDevice(dbA.adapter, paired(peerId, 'ff'.repeat(16)));

    const engineA = new NativeSyncEngine({
      db: dbA.adapter, identity: idA, modulePrefixes: PREFIXES, enabledModules: ['pad'], modulePolicies: POLICIES,
      documentManager: new LwwDocumentManager() as unknown as DocumentManager,
    });
    await engineA.initialize();

    let dialed = false;
    const result = await runAutoConnectJob({
      db: dbA.adapter, selfDeviceId: idA.publicKey, engine: engineA,
      relayUrl: '', relayBackendFactory: () => new DeadRelayBackend(),
      resolvePeerSecret: () => SECRET,
      connectRelay: async () => { dialed = true; throw new Error('should not dial'); },
      now: () => Date.now(),
    });
    expect(dialed).toBe(false);
    expect(result.attempted).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('dials with the session token, never the mailbox token (NC-2)', async () => {
    const idA = generateDeviceIdentity('Device A');
    dbA = freshDb();
    const peerId = 'f'.repeat(64);
    insertPairedDevice(dbA.adapter, paired(peerId, 'ff'.repeat(16)));

    const engineA = new NativeSyncEngine({
      db: dbA.adapter, identity: idA, modulePrefixes: PREFIXES, enabledModules: ['pad'], modulePolicies: POLICIES,
      documentManager: new LwwDocumentManager() as unknown as DocumentManager,
    });
    await engineA.initialize();

    const CLOCK = Date.parse('2026-07-04T12:00:00.000Z');
    const seenTokens: string[] = [];
    await runAutoConnectJob({
      db: dbA.adapter, selfDeviceId: idA.publicKey, engine: engineA,
      relayUrl: RELAY, relayBackendFactory: () => new DeadRelayBackend(),
      resolvePeerSecret: () => SECRET,
      connectRelay: async (input) => { seenTokens.push(input.token); throw new Error('stop after capture'); },
      now: () => CLOCK,
    });

    const expectedSessionToken = deriveSessionRendezvousToken(SECRET, utcDayBucket(CLOCK));
    const mailboxToken = deriveMailboxToken(SECRET, peerId, CLOCK);
    expect(seenTokens[0]).toBe(expectedSessionToken);
    expect(seenTokens).not.toContain(mailboxToken);
  });
});
