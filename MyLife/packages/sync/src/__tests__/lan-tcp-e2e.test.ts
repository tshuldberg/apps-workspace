/**
 * MK-007 -- the LAN rung over REAL TCP sockets. A node:net implementation of
 * LanSocketBackend (the same role react-native-tcp-socket plays on phones)
 * carries a full native-engine sync session across localhost: B listens, A
 * dials, the Ed25519 handshake authenticates, and A's note lands in B's
 * SQLite through MK-002. Discovery (zeroconf) and the iOS local-network
 * permission flow are the device-only remainder.
 */

import { describe, it, expect, afterEach } from 'vitest';
import net from 'node:net';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import type { ModuleSyncPolicy } from '@mylife/module-registry/types';
import type { DeviceIdentity, PairedDevice, TransportConnection } from '../types';
import type { DocumentManager } from '../crdt/document-manager';
import { createSyncTables } from '../db/schema';
import { insertPairedDevice } from '../db/queries';
import { generateDeviceIdentity, extractDhPrivateKeyHex } from '../identity/device-identity';
import { derivePairingSharedSecret } from '../identity/pairing';
import { LwwDocumentManager } from '../crdt/lww-document-manager';
import { SyncEngine as NativeSyncEngine } from '../engine/sync-engine.native';
import {
  connectLanPeer,
  startLanListener,
  type LanListener,
  type LanSocket,
  type LanSocketBackend,
} from '../transport/lan-peer-connection';

// --- node:net backend (desktop/test twin of react-native-tcp-socket) --------

function wrapSocket(socket: net.Socket): LanSocket {
  return {
    write: (data) => { socket.write(data); },
    onData: (handler) => {
      socket.on('data', (buf: Buffer | string) => {
        // No encoding is set, so buf is always a Buffer at runtime.
        handler(typeof buf === 'string' ? new TextEncoder().encode(buf) : new Uint8Array(buf));
      });
    },
    onClose: (handler) => { socket.on('close', handler); },
    close: () => { socket.destroy(); },
  };
}

function createNodeLanBackend(): LanSocketBackend {
  return {
    connect: (host, port) =>
      new Promise((resolve, reject) => {
        const socket = net.connect({ host, port }, () => resolve(wrapSocket(socket)));
        socket.on('error', reject);
      }),
    listen: (port, onSocket) =>
      new Promise((resolve, reject) => {
        const server = net.createServer((socket) => onSocket(wrapSocket(socket)));
        server.on('error', reject);
        server.listen(port, '127.0.0.1', () => {
          resolve({
            port: (server.address() as net.AddressInfo).port,
            close: () => new Promise<void>((done) => { server.close(() => done()); }),
          });
        });
      }),
  };
}

// --- fixtures ----------------------------------------------------------------

const NOTES_POLICY: ModuleSyncPolicy = {
  defaultScope: 'personal_replica',
  shareable: true,
  entityRules: [{ tableName: 'nt_notes', defaultScope: 'personal_replica', conflictStrategy: 'lww' }],
};
const POLICIES = new Map([['notes', NOTES_POLICY]]);
const PREFIXES = new Map([['notes', 'nt_']]);

function pairedRow(remote: DeviceIdentity, sharedSecretHex: string): PairedDevice {
  const now = new Date().toISOString();
  return {
    deviceId: remote.publicKey,
    displayName: remote.displayName,
    dhPublicKey: remote.dhPublicKey,
    sharedSecretRef: `local:shared:${sharedSecretHex}`,
    lastSeenAt: now,
    lastSyncAt: null,
    lastSyncModule: null,
    bytesSent: 0,
    bytesReceived: 0,
    isActive: true,
    pairedAt: now,
  };
}

let listener: LanListener | null = null;
let dbA: InMemoryTestDatabase | null = null;
let dbB: InMemoryTestDatabase | null = null;

afterEach(async () => {
  await listener?.close();
  listener = null;
  dbA?.close(); dbA = null;
  dbB?.close(); dbB = null;
});

describe('native engines over real TCP (MK-007 LAN rung)', () => {
  it('a note recorded on engine A appears in engine B\'s database over localhost TCP', async () => {
    const backend = createNodeLanBackend();
    const idA = generateDeviceIdentity('Laptop A');
    const idB = generateDeviceIdentity('Laptop B');
    const secretFromA = derivePairingSharedSecret(extractDhPrivateKeyHex(idA.privateKeyRef)!, idB.dhPublicKey);
    const secretFromB = derivePairingSharedSecret(extractDhPrivateKeyHex(idB.privateKeyRef)!, idA.dhPublicKey);
    expect(secretFromA).toBe(secretFromB);

    dbA = createInMemoryTestDatabase();
    dbB = createInMemoryTestDatabase();
    for (const db of [dbA, dbB]) {
      createSyncTables(db.adapter);
      db.adapter.execute('CREATE TABLE nt_notes (id TEXT PRIMARY KEY, title TEXT, updated_at TEXT)');
    }
    insertPairedDevice(dbA.adapter, pairedRow(idB, secretFromA));
    insertPairedDevice(dbB.adapter, pairedRow(idA, secretFromB));

    const engineA = new NativeSyncEngine({
      db: dbA.adapter, identity: idA, modulePrefixes: PREFIXES,
      enabledModules: ['notes'], modulePolicies: POLICIES,
      documentManager: new LwwDocumentManager() as unknown as DocumentManager,
    });
    const engineB = new NativeSyncEngine({
      db: dbB.adapter, identity: idB, modulePrefixes: PREFIXES,
      enabledModules: ['notes'], modulePolicies: POLICIES,
      documentManager: new LwwDocumentManager() as unknown as DocumentManager,
    });
    await engineA.initialize();
    await engineB.initialize();

    engineA.recordChange('nt_notes', 'INSERT', 'n1', {
      id: 'n1', title: 'note over real TCP', updated_at: '2026-06-11T00:00:00.000Z',
    });

    // B binds a real TCP listener; every inbound socket becomes a responder session.
    const responderDone = new Promise<void>((resolve) => {
      void startLanListener({
        backend,
        port: 0,
        onConnection: (conn: TransportConnection) => {
          void engineB.handleIncomingConnection(conn).then(() => resolve());
        },
      }).then((l) => { listener = l; });
    });
    // Wait for the listener to be bound before dialing.
    while (!listener) await new Promise((r) => setTimeout(r, 5));

    const connA = await connectLanPeer({
      backend, host: '127.0.0.1', port: listener!.port, remoteDeviceId: idB.publicKey,
    });
    const [session] = await Promise.all([engineA.syncWithConnection(connA), responderDone]);

    expect(session.status).toBe('completed');
    expect(session.transport).toBe('lan');

    const rows = dbB.adapter.query<{ id: string; title: string }>('SELECT * FROM nt_notes WHERE id = ?', ['n1']);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.title).toBe('note over real TCP');
    expect(dbB.adapter.query('SELECT * FROM sync_inbound_audit WHERE outcome = ?', ['rejected'])).toHaveLength(0);

    await connA.close();
    await engineA.destroy();
    await engineB.destroy();
  });
});
