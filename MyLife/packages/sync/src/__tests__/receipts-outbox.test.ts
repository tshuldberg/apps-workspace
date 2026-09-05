/**
 * MK-009 -- receipts + per-peer outbox. The acceptance scenario: device A is
 * paired with B AND C. A change synced to B must still deliver to C (no silent
 * drop), and A's change log marks it synced only after BOTH peers have
 * acknowledged it. Receipts are the per-peer delivery ledger.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import type { ModuleSyncPolicy } from '@mylife/module-registry/types';
import type { DeviceIdentity, PairedDevice, TransportConnection } from '../types';
import type { DocumentManager } from '../crdt/document-manager';
import { createSyncTables } from '../db/schema';
import { insertPairedDevice, getReceiptPeersForChange } from '../db/queries';
import { generateDeviceIdentity, extractDhPrivateKeyHex } from '../identity/device-identity';
import { derivePairingSharedSecret } from '../identity/pairing';
import { ChangeTracker } from '../crdt/change-tracker';
import { LwwDocumentManager } from '../crdt/lww-document-manager';
import { runInitiatorSession, runResponderSession } from '../protocol/sync-session';

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
    lastSeenAt: now, lastSyncAt: null, lastSyncModule: null,
    bytesSent: 0, bytesReceived: 0, isActive: true, pairedAt: now,
  };
}

function connectionPair(deviceA: string, deviceB: string): { connA: TransportConnection; connB: TransportConnection } {
  const handlersForA: Array<(d: Uint8Array) => void> = [];
  const handlersForB: Array<(d: Uint8Array) => void> = [];
  const bufferForA: Uint8Array[] = [];
  const bufferForB: Uint8Array[] = [];
  const deliver = (handlers: Array<(d: Uint8Array) => void>, buffer: Uint8Array[], data: Uint8Array) => {
    if (handlers.length === 0) { buffer.push(data); return; }
    for (const h of [...handlers]) h(data);
  };
  const attach = (handlers: Array<(d: Uint8Array) => void>, buffer: Uint8Array[], h: (d: Uint8Array) => void) => {
    handlers.push(h);
    if (buffer.length > 0) for (const d of buffer.splice(0, buffer.length)) h(d);
  };
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

interface Device {
  identity: DeviceIdentity;
  db: InMemoryTestDatabase;
  tracker: ChangeTracker;
  doc: LwwDocumentManager;
}

function makeDevice(label: string): Device {
  const identity = generateDeviceIdentity(label);
  const db = createInMemoryTestDatabase();
  createSyncTables(db.adapter);
  db.adapter.execute('CREATE TABLE nt_notes (id TEXT PRIMARY KEY, title TEXT, updated_at TEXT)');
  return {
    identity,
    db,
    tracker: new ChangeTracker({ db: db.adapter, deviceId: identity.publicKey, modulePrefixes: PREFIXES, modulePolicies: POLICIES }),
    doc: new LwwDocumentManager(),
  };
}

function pairBoth(a: Device, b: Device): void {
  const secret = derivePairingSharedSecret(extractDhPrivateKeyHex(a.identity.privateKeyRef)!, b.identity.dhPublicKey);
  insertPairedDevice(a.db.adapter, pairedRow(b.identity, secret));
  insertPairedDevice(b.db.adapter, pairedRow(a.identity, secret));
}

const devices: Device[] = [];
afterEach(() => {
  for (const device of devices.splice(0, devices.length)) device.db.close();
});

describe('receipts + per-peer outbox (MK-009)', () => {
  it('a change synced to peer B stays pending until peer C acks it too, then marks synced', async () => {
    const a = makeDevice('A');
    const b = makeDevice('B');
    const c = makeDevice('C');
    devices.push(a, b, c);
    pairBoth(a, b);
    pairBoth(a, c);

    // A authors a note (change log + document, as the engine does).
    const note = { id: 'n1', title: 'multi-peer note', updated_at: '2026-06-11T00:00:00.000Z' };
    a.tracker.recordChange('nt_notes', 'INSERT', 'n1', note);
    a.doc.applyChange('notes', { table: 'nt_notes', rowId: 'n1', operation: 'INSERT', data: note });
    const changeId = a.tracker.getUnsynced()[0]!.id;

    const sessionOptions = (device: Device) => ({
      db: device.db.adapter,
      identity: device.identity,
      pairedDevices: device.db.adapter
        .query<{ device_id: string; display_name: string; dh_public_key: string; shared_secret_ref: string; is_active: number }>(
          'SELECT device_id, display_name, dh_public_key, shared_secret_ref, is_active FROM sync_paired_devices',
        )
        .map((r) => ({
          deviceId: r.device_id, displayName: r.display_name, dhPublicKey: r.dh_public_key,
          sharedSecretRef: r.shared_secret_ref, isActive: r.is_active === 1,
        })) as unknown as PairedDevice[],
      documentManager: device.doc as unknown as DocumentManager,
      changeTracker: device.tracker,
      enabledModules: ['notes'],
      modulePolicies: POLICIES,
      transport: 'wan_relay' as const,
    });

    // --- Session 1: A -> B ---------------------------------------------------
    {
      const { connA, connB } = connectionPair(a.identity.publicKey, b.identity.publicKey);
      const [initiator] = await Promise.all([
        runInitiatorSession(connA, sessionOptions(a)),
        runResponderSession(connB, sessionOptions(b)),
      ]);
      expect(initiator.session.status).toBe('completed');
    }

    // B has the note...
    expect(b.db.adapter.query('SELECT * FROM nt_notes WHERE id = ?', ['n1'])).toHaveLength(1);
    // ...B's receipt is recorded on A...
    expect(getReceiptPeersForChange(a.db.adapter, changeId)).toEqual([b.identity.publicKey]);
    // ...but the change is NOT marked synced: peer C has not acknowledged it.
    expect(a.tracker.getUnsynced().map((ch) => ch.id)).toEqual([changeId]);

    // --- Session 2: A -> C (the change must still deliver) -------------------
    {
      const { connA, connB } = connectionPair(a.identity.publicKey, c.identity.publicKey);
      const [initiator] = await Promise.all([
        runInitiatorSession(connA, sessionOptions(a)),
        runResponderSession(connB, sessionOptions(c)),
      ]);
      expect(initiator.session.status).toBe('completed');
    }

    // C received it (no silent drop)...
    expect(c.db.adapter.query('SELECT * FROM nt_notes WHERE id = ?', ['n1'])).toHaveLength(1);
    // ...both peers now hold receipts...
    expect(new Set(getReceiptPeersForChange(a.db.adapter, changeId))).toEqual(
      new Set([b.identity.publicKey, c.identity.publicKey]),
    );
    // ...and only now is the change marked synced.
    expect(a.tracker.getUnsynced()).toHaveLength(0);
  });
});
