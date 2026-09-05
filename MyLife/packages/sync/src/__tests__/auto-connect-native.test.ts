/**
 * Plan 29 / AM5: runAutoConnectJob over a real native data transport.
 *
 * When a peer is not on LAN and a real native data transport (WebRTC / Nearby)
 * is present and policy-permitted, the round dials it directly (before relay)
 * and runs a REAL session; an all-forbidden native policy falls through to
 * relay; nativeDataAvailable defaults false so the prior relay behavior is
 * unchanged.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import type { ModuleSyncPolicy } from '@mylife/module-registry/types';
import type { PairedDevice, TransportConnection } from '../types';
import { createSyncTables, migrateSyncSchema } from '../db/schema';
import { insertPairedDevice, readAutoConnectState } from '../db/queries';
import { generateDeviceIdentity } from '../identity/device-identity';
import { configureSyncSecretStore, createInMemorySyncSecretStore, storeSharedSecret } from '../index';
import type { DocumentManager } from '../crdt/document-manager';
import { LwwDocumentManager } from '../crdt/lww-document-manager';
import { SyncEngine as NativeSyncEngine } from '../engine/sync-engine.native';
import type { RelayBackend, RelaySession } from '../transport/relay-transport';
import {
  NEARBY_LAYER_ID,
  RELAY_LAYER_ID,
  WEBRTC_LAYER_ID,
  planAutoConnectRound,
  runAutoConnectJob,
  type AutoConnectPeerInput,
} from '../engine/auto-connect';

const SECRET = 'ab'.repeat(32);
const DEFAULT_POLICY = { minSessionIntervalMs: 300_000, backoffLadderMs: [30_000], backoffCapMs: 7_200_000 };

const PAD_POLICY: ModuleSyncPolicy = {
  defaultScope: 'personal_replica',
  shareable: true,
  entityRules: [{ tableName: 'mp_pad', defaultScope: 'personal_replica', conflictStrategy: 'lww' }],
};
const POLICIES = new Map([['pad', PAD_POLICY]]);
const PREFIXES = new Map([['pad', 'mp_']]);

function connectionPair(deviceA: string, deviceB: string): { connA: TransportConnection; connB: TransportConnection } {
  const hA: Array<(d: Uint8Array) => void> = [];
  const hB: Array<(d: Uint8Array) => void> = [];
  const bA: Uint8Array[] = [];
  const bB: Uint8Array[] = [];
  const deliver = (h: Array<(d: Uint8Array) => void>, b: Uint8Array[], d: Uint8Array): void => {
    if (h.length === 0) { b.push(d); return; }
    for (const fn of [...h]) fn(d);
  };
  const attach = (h: Array<(d: Uint8Array) => void>, b: Uint8Array[], fn: (d: Uint8Array) => void): void => {
    h.push(fn);
    if (b.length > 0) for (const d of b.splice(0, b.length)) fn(d);
  };
  const connA: TransportConnection = {
    id: 'conn-a', remoteDeviceId: deviceB, transport: 'wan_webrtc',
    send: async (d) => { setTimeout(() => deliver(hB, bB, d), 0); },
    onData: (fn) => attach(hA, bA, fn), close: async () => {},
  };
  const connB: TransportConnection = {
    id: 'conn-b', remoteDeviceId: deviceA, transport: 'wan_webrtc',
    send: async (d) => { setTimeout(() => deliver(hA, bA, d), 0); },
    onData: (fn) => attach(hB, bB, fn), close: async () => {},
  };
  return { connA, connB };
}

class DeadRelaySession implements RelaySession {
  async send(): Promise<void> {}
  onMessage(): void {}
  async close(): Promise<void> {}
}
class DeadRelayBackend implements RelayBackend {
  async connect(): Promise<RelaySession> { return new DeadRelaySession(); }
  destroy(): void {}
}

function paired(deviceId: string, dhPublicKey: string): PairedDevice {
  return {
    deviceId, displayName: 'peer', dhPublicKey,
    sharedSecretRef: storeSharedSecret('self', deviceId, SECRET),
    isActive: true, pairedAt: '2026-06-14T00:00:00.000Z',
    bytesSent: 0, bytesReceived: 0, lastSeenAt: null, lastSyncAt: null, lastSyncModule: null,
  } as unknown as PairedDevice;
}

function freshDb(): InMemoryTestDatabase {
  const db = createInMemoryTestDatabase();
  createSyncTables(db.adapter);
  migrateSyncSchema(db.adapter);
  db.adapter.execute('CREATE TABLE mp_pad (id TEXT PRIMARY KEY, body TEXT, updated_at TEXT)');
  return db;
}

function peerInput(deviceId: string): AutoConnectPeerInput {
  return { deviceId, discoveredOnLan: false, state: null, lastCompletedSessionAt: null, pendingChanges: 0 };
}

describe('planAutoConnectRound native transport', () => {
  it('routes a non-LAN peer to native when available and policy-permitted (before relay)', () => {
    const plan = planAutoConnectRound({
      selfDeviceId: 'aaaa', peers: [peerInput('bbbb')],
      relayAvailable: true, nativeDataAvailable: true, policy: DEFAULT_POLICY, now: 0,
    });
    expect(plan.dials[0]?.transport).toBe('native');
  });

  it('defaults to relay when no native transport is available (unchanged behavior)', () => {
    const plan = planAutoConnectRound({
      selfDeviceId: 'aaaa', peers: [peerInput('bbbb')],
      relayAvailable: true, policy: DEFAULT_POLICY, now: 0,
    });
    expect(plan.dials[0]?.transport).toBe('wan_relay');
  });

  it('falls through to relay when every native layer is forbidden by policy', () => {
    const plan = planAutoConnectRound({
      selfDeviceId: 'aaaa', peers: [peerInput('bbbb')],
      relayAvailable: true, nativeDataAvailable: true, policy: DEFAULT_POLICY, now: 0,
      transportPolicyAllows: (layerId) => layerId !== NEARBY_LAYER_ID && layerId !== WEBRTC_LAYER_ID,
    });
    expect(plan.dials[0]?.transport).toBe('wan_relay');
  });

  it('routes to native even with no relay when a native layer is permitted', () => {
    const plan = planAutoConnectRound({
      selfDeviceId: 'aaaa', peers: [peerInput('bbbb')],
      relayAvailable: false, nativeDataAvailable: true, policy: DEFAULT_POLICY, now: 0,
      transportPolicyAllows: (layerId) => layerId === NEARBY_LAYER_ID,
    });
    expect(plan.dials[0]?.transport).toBe('native');
    expect(RELAY_LAYER_ID).toBe(5);
  });
});

let dbLower: InMemoryTestDatabase | null = null;
let dbHigher: InMemoryTestDatabase | null = null;
afterEach(() => { dbLower?.close(); dbLower = null; dbHigher?.close(); dbHigher = null; });

describe('runAutoConnectJob native transport', () => {
  it('runs a real session over an injected native data transport (no LAN, no relay)', async () => {
    configureSyncSecretStore(createInMemorySyncSecretStore());
    const idA = generateDeviceIdentity('Device A');
    const idB = generateDeviceIdentity('Device B');
    const aIsLower = idA.publicKey < idB.publicKey;
    const lower = aIsLower ? idA : idB;
    const higher = aIsLower ? idB : idA;

    dbLower = freshDb();
    dbHigher = freshDb();
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

    dbLower.adapter.execute('INSERT INTO mp_pad (id, body, updated_at) VALUES (?, ?, ?)', ['pad', 'native hello', '2026-06-14T00:00:00.000Z']);
    engineLower.recordChange('mp_pad', 'INSERT', 'pad', { id: 'pad', body: 'native hello', updated_at: '2026-06-14T00:00:00.000Z' });

    const { connA: connLower, connB: connHigher } = connectionPair(lower.publicKey, higher.publicKey);

    const [lowerResult, higherResult] = await Promise.all([
      runAutoConnectJob({
        db: dbLower.adapter, selfDeviceId: lower.publicKey, engine: engineLower,
        relayUrl: '', relayBackendFactory: () => new DeadRelayBackend(),
        resolvePeerSecret: () => SECRET,
        nativeDataAvailable: true,
        connectNativeDataTransport: async () => connLower,
        now: () => Date.now(),
      }),
      runAutoConnectJob({
        db: dbHigher.adapter, selfDeviceId: higher.publicKey, engine: engineHigher,
        relayUrl: '', relayBackendFactory: () => new DeadRelayBackend(),
        resolvePeerSecret: () => SECRET,
        nativeDataAvailable: true,
        connectNativeDataTransport: async () => connHigher,
        now: () => Date.now(),
      }),
    ]);

    expect(lowerResult.completed).toBe(1);
    expect(lowerResult.failed).toBe(0);
    expect(higherResult.completed).toBe(1);

    const rows = dbHigher.adapter.query<{ body: string }>('SELECT body FROM mp_pad WHERE id = ?', ['pad']);
    expect(rows[0]?.body).toBe('native hello');

    const lowerState = readAutoConnectState(dbLower.adapter, higher.publicKey);
    expect(lowerState?.lastResult).toBe('completed');
    expect(lowerState?.failureCount).toBe(0);

    await engineLower.destroy();
    await engineHigher.destroy();
  });

  it('passes the policy-derived forbidden native layers into the connect callback (NC-3)', async () => {
    configureSyncSecretStore(createInMemorySyncSecretStore());
    const idA = generateDeviceIdentity('Device A');
    dbLower = freshDb();
    const peerId = 'f'.repeat(64);
    insertPairedDevice(dbLower.adapter, paired(peerId, 'ff'.repeat(16)));
    const engineA = new NativeSyncEngine({
      db: dbLower.adapter, identity: idA, modulePrefixes: PREFIXES,
      enabledModules: ['pad'], modulePolicies: POLICIES,
      documentManager: new LwwDocumentManager() as unknown as DocumentManager,
    });
    await engineA.initialize();

    let seenForbidden: number[] | null = null;
    await runAutoConnectJob({
      db: dbLower.adapter, selfDeviceId: idA.publicKey, engine: engineA,
      relayUrl: '', relayBackendFactory: () => new DeadRelayBackend(),
      resolvePeerSecret: () => SECRET,
      nativeDataAvailable: true,
      // Policy permits Nearby (2) but forbids WebRTC (4).
      transportPolicyAllows: (layerId) => layerId !== WEBRTC_LAYER_ID,
      connectNativeDataTransport: async (input) => {
        seenForbidden = input.forbiddenLayerIds;
        throw new Error('no transport'); // record a failure, we only assert the input
      },
      now: () => 1_800_000_000_000,
    });

    expect(seenForbidden).toEqual([WEBRTC_LAYER_ID]);
    await engineA.destroy();
  });

  it('a native-planned peer with no native connect dep is skipped, not fabricated', async () => {
    configureSyncSecretStore(createInMemorySyncSecretStore());
    const idA = generateDeviceIdentity('Device A');
    dbLower = freshDb();
    const peerId = 'f'.repeat(64);
    insertPairedDevice(dbLower.adapter, paired(peerId, 'ff'.repeat(16)));

    const engineA = new NativeSyncEngine({
      db: dbLower.adapter, identity: idA, modulePrefixes: PREFIXES,
      enabledModules: ['pad'], modulePolicies: POLICIES,
      documentManager: new LwwDocumentManager() as unknown as DocumentManager,
    });
    await engineA.initialize();

    const result = await runAutoConnectJob({
      db: dbLower.adapter, selfDeviceId: idA.publicKey, engine: engineA,
      relayUrl: '', relayBackendFactory: () => new DeadRelayBackend(),
      resolvePeerSecret: () => SECRET,
      nativeDataAvailable: true, // planner picks native, but no connect dep supplied
      now: () => 1_800_000_000_000,
    });

    expect(result.attempted).toBe(0);
    expect(result.completed).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(1);
    // No fabricated backoff row for a skipped no_peer.
    expect(readAutoConnectState(dbLower.adapter, peerId)).toBeNull();
    await engineA.destroy();
  });
});
