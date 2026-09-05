/**
 * runSyncSessionJob (Task 3): the headless twin of the manual relay session.
 *
 * It must drive the REAL engine so every session writes a real sync_ row. The
 * happy path moves a pad row from device A into device B's database (same proof
 * shape as session-sync.test.ts). The honest-timeout path: an initiate with no
 * listener present records a real NON-completed session row, never a fabricated
 * 'completed'.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import type { ModuleSyncPolicy } from '@mylife/module-registry/types';
import type { PairedDevice, TransportConnection } from '../types';
import { createSyncTables } from '../db/schema';
import { insertPairedDevice } from '../db/queries';
import { generateDeviceIdentity } from '../identity/device-identity';
import { storeSharedSecret } from '../secrets/sync-secret-store';
import type { DocumentManager } from '../crdt/document-manager';
import { LwwDocumentManager } from '../crdt/lww-document-manager';
import { SyncEngine as NativeSyncEngine } from '../engine/sync-engine.native';
import type { RelayBackend, RelaySession } from '../transport/relay-transport';
import { runSyncSessionJob } from '../engine/session-job';

const SECRET = 'ab'.repeat(32);

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

/** A backend that produces nothing (no peer ever joins the token). */
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
    // Forward secrecy (D.6) needs the peer's real DH public key.
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

let dbA: InMemoryTestDatabase | null = null;
let dbB: InMemoryTestDatabase | null = null;

afterEach(() => {
  dbA?.close(); dbA = null;
  dbB?.close(); dbB = null;
});

describe('runSyncSessionJob (background sync headless runner)', () => {
  it('initiate role syncs a pad row into the peer DB and records a real completed session', async () => {
    const idA = generateDeviceIdentity('Device A');
    const idB = generateDeviceIdentity('Device B');

    dbA = createInMemoryTestDatabase();
    dbB = createInMemoryTestDatabase();
    createSyncTables(dbA.adapter);
    createSyncTables(dbB.adapter);
    for (const db of [dbA.adapter, dbB.adapter]) {
      db.execute('CREATE TABLE mp_pad (id TEXT PRIMARY KEY, body TEXT, updated_at TEXT)');
    }
    insertPairedDevice(dbA.adapter, paired(idB.publicKey, idB.dhPublicKey));
    insertPairedDevice(dbB.adapter, paired(idA.publicKey, idA.dhPublicKey));

    const engineA = new NativeSyncEngine({
      db: dbA.adapter, identity: idA, modulePrefixes: PREFIXES,
      enabledModules: ['pad'], modulePolicies: POLICIES,
      documentManager: new LwwDocumentManager() as unknown as DocumentManager,
    });
    const engineB = new NativeSyncEngine({
      db: dbB.adapter, identity: idB, modulePrefixes: PREFIXES,
      enabledModules: ['pad'], modulePolicies: POLICIES,
      documentManager: new LwwDocumentManager() as unknown as DocumentManager,
    });
    await engineA.initialize();
    await engineB.initialize();

    // A authors a pad row before the session.
    dbA.adapter.execute('INSERT INTO mp_pad (id, body, updated_at) VALUES (?, ?, ?)', ['pad', 'hello from A', '2026-06-14T00:00:00.000Z']);
    engineA.recordChange('mp_pad', 'INSERT', 'pad', { id: 'pad', body: 'hello from A', updated_at: '2026-06-14T00:00:00.000Z' });

    const { connA, connB } = connectionPair(idA.publicKey, idB.publicKey);
    const backendA = new DeadRelayBackend();
    const backendB = new DeadRelayBackend();

    const [initResult, listenResult] = await Promise.all([
      runSyncSessionJob({
        backend: backendA, relayUrl: 'ws://relay', token: 'a'.repeat(32),
        peerDeviceId: idB.publicKey, role: 'initiate', engine: engineA,
        connect: async () => connA,
      }),
      runSyncSessionJob({
        backend: backendB, relayUrl: 'ws://relay', token: 'a'.repeat(32),
        peerDeviceId: idA.publicKey, role: 'listen', engine: engineB,
        connect: async () => connB,
      }),
    ]);

    // The initiator returned a real recorded session.
    expect(initResult.ran).toBe(true);
    expect(initResult.session).toBeDefined();
    expect(initResult.session?.status).toBe('completed');
    expect(listenResult.session?.status).toBe('completed');
    expect(listenResult.session?.peerDeviceId).toBe(idA.publicKey);

    // It is a real row in device A's sync_sessions table (engine recorded it).
    const recorded = dbA.adapter.query<{ id: string; status: string }>(
      'SELECT id, status FROM sync_sessions WHERE id = ?', [initResult.session!.id],
    );
    expect(recorded).toHaveLength(1);
    expect(recorded[0]!.status).toBe('completed');

    // The pad crossed: it is now in device B's database.
    const rows = dbB.adapter.query<{ body: string }>('SELECT body FROM mp_pad WHERE id = ?', ['pad']);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.body).toBe('hello from A');

    // Backends were destroyed (cleanup invariant).
    expect(backendA.destroyed).toBe(true);
    expect(backendB.destroyed).toBe(true);
  });

  it('initiate with no listener records a NON-completed session, never a fabricated completed', async () => {
    const idA = generateDeviceIdentity('Device A');
    const idB = generateDeviceIdentity('Device B');

    dbA = createInMemoryTestDatabase();
    createSyncTables(dbA.adapter);
    dbA.adapter.execute('CREATE TABLE mp_pad (id TEXT PRIMARY KEY, body TEXT, updated_at TEXT)');
    insertPairedDevice(dbA.adapter, paired(idB.publicKey, idB.dhPublicKey));

    const engineA = new NativeSyncEngine({
      db: dbA.adapter, identity: idA, modulePrefixes: PREFIXES,
      enabledModules: ['pad'], modulePolicies: POLICIES,
    });
    await engineA.initialize();

    // No peer ever joins the token: the backend connects but never delivers a
    // handshake, so the initiator handshake times out and the engine records a
    // real failed session.
    const deadBackend = new DeadRelayBackend();
    const deadConn: TransportConnection = {
      id: 'dead', remoteDeviceId: idB.publicKey, transport: 'wan_relay',
      send: async () => {}, onData: () => {}, close: async () => {},
    };

    const result = await runSyncSessionJob({
      backend: deadBackend, relayUrl: 'ws://relay', token: 'a'.repeat(32),
      peerDeviceId: idB.publicKey, role: 'initiate', engine: engineA,
      connect: async () => deadConn,
    });

    // Whatever the engine recorded, it is NOT a completed session.
    const sessions = dbA.adapter.query<{ status: string }>('SELECT status FROM sync_sessions');
    expect(sessions.every((s) => s.status !== 'completed')).toBe(true);
    if (result.session) {
      expect(result.session.status).not.toBe('completed');
    }
    expect(deadBackend.destroyed).toBe(true);
  }, 20000);

  it('returns a no-op (ran:false) when no relay URL is configured', async () => {
    const engine = {
      syncWithConnection: async () => { throw new Error('should not run'); },
      handleIncomingConnection: async () => { throw new Error('should not run'); },
    };
    const backend = new DeadRelayBackend();
    const result = await runSyncSessionJob({
      backend, relayUrl: '   ', token: 'a'.repeat(32),
      peerDeviceId: 'peer', role: 'initiate', engine,
      connect: async () => { throw new Error('should not connect'); },
    });
    expect(result.ran).toBe(false);
    expect(result.error).toBeDefined();
  });
});
