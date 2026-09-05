/**
 * MK-008 -- the M0 demo in code, minus the phones: two NATIVE SyncEngines
 * (LWW document manager, the Hermes profile) complete a full sync session
 * across the REAL relay server over live WebSockets. Devices are paired with
 * real X25519 Diffie-Hellman (each side derives the same shared secret from
 * its own private key + the peer's public key), the Ed25519 handshake
 * authenticates both ends, payloads are encrypted, and a note recorded on
 * device A lands in device B's SQLite through MK-002 inbound enforcement.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import type { ModuleSyncPolicy } from '@mylife/module-registry/types';
import {
  NativeSyncEngine,
  LwwDocumentManager,
  WebSocketRelayBackend,
  connectRelayPeer,
  createSyncTables,
  generateDeviceIdentity,
  extractDhPrivateKeyHex,
  derivePairingSharedSecret,
  insertPairedDevice,
  type DeviceIdentity,
  type PairedDevice,
} from '@mylife/sync';
import type { DocumentManager } from '@mylife/sync';
import { startRelayServer, type RelayServer } from '../server';

const TOKEN = 'c'.repeat(64);

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

let server: RelayServer | null = null;
let backend: WebSocketRelayBackend | null = null;
let dbA: InMemoryTestDatabase | null = null;
let dbB: InMemoryTestDatabase | null = null;

afterEach(async () => {
  backend?.destroy();
  backend = null;
  if (server) {
    await server.close();
    server = null;
  }
  dbA?.close(); dbA = null;
  dbB?.close(); dbB = null;
});

describe('native engines over the real relay (MK-008)', () => {
  it('a note recorded on engine A appears in engine B\'s database across the live relay', async () => {
    server = await startRelayServer({ port: 0, host: '127.0.0.1' });
    backend = new WebSocketRelayBackend();
    const url = `ws://127.0.0.1:${server.port}`;

    const idA = generateDeviceIdentity('Phone A');
    const idB = generateDeviceIdentity('Phone B');

    // Real pairing: X25519 DH agreement -- both sides derive the SAME secret
    // from their own private key and the peer's public key.
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

    // Native-profile engines: explicit LwwDocumentManager (what Hermes runs).
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

    // The note authored on A (engine records it into change log + document).
    engineA.recordChange('nt_notes', 'INSERT', 'n1', {
      id: 'n1', title: 'note from phone A', updated_at: '2026-06-11T00:00:00.000Z',
    });

    // Both devices join the relay on the shared ephemeral token.
    const connA = await connectRelayPeer({ backend, url, token: TOKEN, remoteDeviceId: idB.publicKey });
    const connB = await connectRelayPeer({ backend, url, token: TOKEN, remoteDeviceId: idA.publicKey });

    const [session] = await Promise.all([
      engineA.syncWithConnection(connA),
      engineB.handleIncomingConnection(connB),
    ]);

    expect(session.status).toBe('completed');

    // The note crossed the live relay and was applied through MK-002.
    const rows = dbB.adapter.query<{ id: string; title: string }>('SELECT * FROM nt_notes WHERE id = ?', ['n1']);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.title).toBe('note from phone A');

    // No inbound rejection: the paired, authorized write was clean.
    expect(dbB.adapter.query('SELECT * FROM sync_inbound_audit WHERE outcome = ?', ['rejected'])).toHaveLength(0);

    // Engine status reflects the completed sync on both ends.
    expect(engineA.getStatus().lastSyncAt).not.toBeNull();
    expect(engineB.getStatus().lastSyncAt).not.toBeNull();

    await connA.close();
    await connB.close();
    await engineA.destroy();
    await engineB.destroy();
  });
});
