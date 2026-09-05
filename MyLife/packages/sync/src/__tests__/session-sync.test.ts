/**
 * MK-008 continuous sync -- the real session path end to end.
 *
 * Two paired devices run runInitiatorSession + runResponderSession over a wired
 * in-memory connection pair (real better-sqlite3 DBs, real handshake, real LWW
 * document manager, real MK-002 inbound enforcement). A note recorded on device
 * A must land in device B's database: "edited on A, appears on B". This is the
 * session glue that the LAN/relay transports carry on real devices (MK-007/008).
 */

import { describe, it, expect, afterEach } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import type { ModuleSyncPolicy } from '@mylife/module-registry/types';
import type { PairedDevice, TransportConnection } from '../types';
import type { DocumentManager } from '../crdt/document-manager';
import { createSyncTables } from '../db/schema';
import { generateDeviceIdentity } from '../identity/device-identity';
import { ChangeTracker } from '../crdt/change-tracker';
import { LwwDocumentManager } from '../crdt/lww-document-manager';
import { runInitiatorSession, runResponderSession } from '../protocol/sync-session';

const SECRET = 'ab'.repeat(32); // 64 hex -> a real shared secret both sides derive from

const NOTES_POLICY: ModuleSyncPolicy = {
  defaultScope: 'personal_replica',
  shareable: true,
  entityRules: [{ tableName: 'nt_notes', defaultScope: 'personal_replica', conflictStrategy: 'lww' }],
};
const POLICIES = new Map([['notes', NOTES_POLICY]]);
const PREFIXES = new Map([['notes', 'nt_']]);

function paired(deviceId: string, dhPublicKey: string): PairedDevice {
  return {
    deviceId,
    displayName: 'peer',
    // A real paired device carries the peer's real DH public key: forward
    // secrecy (D.6) requires it, so the fixture must supply the true key.
    dhPublicKey,
    sharedSecretRef: `local:shared:${SECRET}`,
    isActive: true,
  } as unknown as PairedDevice;
}

/**
 * Wire two TransportConnections so a send on one is delivered (async) to the
 * other's data handlers. Buffers anything sent before a handler is attached, so
 * the handshake's request/response ordering can't lose the first frame.
 */
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

let dbA: InMemoryTestDatabase | null = null;
let dbB: InMemoryTestDatabase | null = null;

afterEach(() => {
  dbA?.close(); dbA = null;
  dbB?.close(); dbB = null;
});

describe('full sync session (MK-008 continuous sync)', () => {
  it('a note recorded on device A lands in device B\'s database over a session', async () => {
    const idA = generateDeviceIdentity('Device A');
    const idB = generateDeviceIdentity('Device B');

    dbA = createInMemoryTestDatabase();
    dbB = createInMemoryTestDatabase();
    createSyncTables(dbA.adapter);
    createSyncTables(dbB.adapter);
    // The module's own table (where applied rows land).
    for (const db of [dbA.adapter, dbB.adapter]) {
      db.execute('CREATE TABLE nt_notes (id TEXT PRIMARY KEY, title TEXT, updated_at TEXT)');
    }

    // Device A authors a note (engine would do this via recordChange).
    const docA = new LwwDocumentManager();
    docA.applyChange('notes', { table: 'nt_notes', rowId: 'n1', operation: 'INSERT', data: { id: 'n1', title: 'hello from A', updated_at: '2026-06-11T00:00:00.000Z' } });
    const docB = new LwwDocumentManager();

    const ctA = new ChangeTracker({ db: dbA.adapter, deviceId: idA.publicKey, modulePrefixes: PREFIXES, modulePolicies: POLICIES });
    const ctB = new ChangeTracker({ db: dbB.adapter, deviceId: idB.publicKey, modulePrefixes: PREFIXES, modulePolicies: POLICIES });

    const { connA, connB } = connectionPair(idA.publicKey, idB.publicKey);

    const [initiator, responder] = await Promise.all([
      runInitiatorSession(connA, {
        db: dbA.adapter, identity: idA, pairedDevices: [paired(idB.publicKey, idB.dhPublicKey)],
        documentManager: docA as unknown as DocumentManager, changeTracker: ctA,
        enabledModules: ['notes'], modulePolicies: POLICIES, transport: 'wan_relay',
      }),
      runResponderSession(connB, {
        db: dbB.adapter, identity: idB, pairedDevices: [paired(idA.publicKey, idA.dhPublicKey)],
        documentManager: docB as unknown as DocumentManager, changeTracker: ctB,
        enabledModules: ['notes'], modulePolicies: POLICIES, transport: 'wan_relay',
      }),
    ]);

    // The handshake authenticated both ends...
    expect(initiator.session.status).toBe('completed');
    expect(responder.session.status).toBe('completed');

    // ...and the note crossed: it is now in device B's database.
    const rows = dbB.adapter.query<{ id: string; title: string }>('SELECT * FROM nt_notes WHERE id = ?', ['n1']);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.title).toBe('hello from A');

    // No inbound change was rejected (it was a legitimate, authorized write).
    const rejected = dbB.adapter.query('SELECT * FROM sync_inbound_audit WHERE outcome = ?', ['rejected']);
    expect(rejected).toHaveLength(0);
  });

  it('a delete on device A removes the row from device B\'s database over a session', async () => {
    const idA = generateDeviceIdentity('Device A');
    const idB = generateDeviceIdentity('Device B');

    dbA = createInMemoryTestDatabase();
    dbB = createInMemoryTestDatabase();
    createSyncTables(dbA.adapter);
    createSyncTables(dbB.adapter);
    for (const db of [dbA.adapter, dbB.adapter]) {
      db.execute('CREATE TABLE nt_notes (id TEXT PRIMARY KEY, title TEXT, updated_at TEXT)');
    }

    const docA = new LwwDocumentManager();
    const docB = new LwwDocumentManager();
    const ctA = new ChangeTracker({ db: dbA.adapter, deviceId: idA.publicKey, modulePrefixes: PREFIXES, modulePolicies: POLICIES });
    const ctB = new ChangeTracker({ db: dbB.adapter, deviceId: idB.publicKey, modulePrefixes: PREFIXES, modulePolicies: POLICIES });

    const runSession = async () => {
      const { connA, connB } = connectionPair(idA.publicKey, idB.publicKey);
      await Promise.all([
        runInitiatorSession(connA, {
          db: dbA!.adapter, identity: idA, pairedDevices: [paired(idB.publicKey, idB.dhPublicKey)],
          documentManager: docA as unknown as DocumentManager, changeTracker: ctA,
          enabledModules: ['notes'], modulePolicies: POLICIES, transport: 'wan_relay',
        }),
        runResponderSession(connB, {
          db: dbB!.adapter, identity: idB, pairedDevices: [paired(idA.publicKey, idA.dhPublicKey)],
          documentManager: docB as unknown as DocumentManager, changeTracker: ctB,
          enabledModules: ['notes'], modulePolicies: POLICIES, transport: 'wan_relay',
        }),
      ]);
    };

    // A authors n1, syncs: it lands on B.
    docA.applyChange('notes', { table: 'nt_notes', rowId: 'n1', operation: 'INSERT', data: { id: 'n1', title: 'temporary', updated_at: '2026-06-11T00:00:00.000Z' } });
    await runSession();
    expect(dbB!.adapter.query('SELECT * FROM nt_notes WHERE id = ?', ['n1'])).toHaveLength(1);

    // A deletes n1, syncs again: the delete propagates and B's row is gone.
    docA.applyChange('notes', { table: 'nt_notes', rowId: 'n1', operation: 'DELETE', data: { updated_at: '2026-06-11T01:00:00.000Z' } });
    await runSession();
    expect(dbB!.adapter.query('SELECT * FROM nt_notes WHERE id = ?', ['n1'])).toHaveLength(0);

    // And B does not resurrect it back onto A on the next exchange.
    await runSession();
    expect(dbB!.adapter.query('SELECT * FROM nt_notes WHERE id = ?', ['n1'])).toHaveLength(0);
  });

  it('a foreign-module write smuggled into a session is rejected mid-session while the valid change applies', async () => {
    const idA = generateDeviceIdentity('Device A');
    const idB = generateDeviceIdentity('Device B');

    dbA = createInMemoryTestDatabase();
    dbB = createInMemoryTestDatabase();
    createSyncTables(dbA.adapter);
    createSyncTables(dbB.adapter);
    dbB.adapter.execute('CREATE TABLE nt_notes (id TEXT PRIMARY KEY, title TEXT, updated_at TEXT)');

    const prefixes = new Map([['notes', 'nt_'], ['sports', 'sp_']]);

    // A (an authenticated peer) tries to smuggle a sports row inside the notes
    // sync stream, alongside one legitimate note.
    const docA = new LwwDocumentManager();
    docA.applyChange('notes', { table: 'nt_notes', rowId: 'ok', operation: 'INSERT', data: { id: 'ok', title: 'legit', updated_at: '2026-06-11T00:00:00.000Z' } });
    docA.applyChange('notes', { table: 'sp_bets', rowId: 'evil', operation: 'INSERT', data: { id: 'evil', updated_at: '2026-06-11T00:00:00.000Z' } });
    const docB = new LwwDocumentManager();

    const ctA = new ChangeTracker({ db: dbA.adapter, deviceId: idA.publicKey, modulePrefixes: prefixes, modulePolicies: POLICIES });
    const ctB = new ChangeTracker({ db: dbB.adapter, deviceId: idB.publicKey, modulePrefixes: prefixes, modulePolicies: POLICIES });

    const { connA, connB } = connectionPair(idA.publicKey, idB.publicKey);

    await Promise.all([
      runInitiatorSession(connA, {
        db: dbA.adapter, identity: idA, pairedDevices: [paired(idB.publicKey, idB.dhPublicKey)],
        documentManager: docA as unknown as DocumentManager, changeTracker: ctA,
        enabledModules: ['notes'], modulePolicies: POLICIES, transport: 'wan_relay',
      }),
      runResponderSession(connB, {
        db: dbB.adapter, identity: idB, pairedDevices: [paired(idA.publicKey, idA.dhPublicKey)],
        documentManager: docB as unknown as DocumentManager, changeTracker: ctB,
        enabledModules: ['notes'], modulePolicies: POLICIES, transport: 'wan_relay',
      }),
    ]);

    // The legitimate note applied...
    expect(dbB.adapter.query('SELECT * FROM nt_notes WHERE id = ?', ['ok'])).toHaveLength(1);
    // ...the smuggled sports row never touched the database...
    expect(dbB.adapter.query("SELECT name FROM sqlite_master WHERE type='table' AND name='sp_bets'")).toHaveLength(0);
    // ...and the rejection was audited as a module mismatch.
    const rejected = dbB.adapter.query<{ reason: string }>('SELECT * FROM sync_inbound_audit WHERE outcome = ?', ['rejected']);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.reason).toBe('module_mismatch');

    // ...AND the laundered row never entered B's document, so B cannot
    // re-broadcast it onward (policy-before-merge, closes the audit finding).
    const bDoc = docB.getDocument('notes');
    expect(bDoc.tables.sp_bets).toBeUndefined();
    const bSnapshot = docB.generateSyncMessage('notes', null);
    if (bSnapshot) {
      const wire = JSON.parse(new TextDecoder().decode(bSnapshot)) as { tables: Record<string, unknown> };
      expect(wire.tables.sp_bets).toBeUndefined();
      expect(wire.tables.nt_notes).toBeDefined(); // the legit row is there
    }
  });
});
