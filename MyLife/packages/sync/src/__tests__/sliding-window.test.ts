/**
 * MK-028 -- sliding-window sync. Cold start against a large dataset: the most
 * recently updated rows (what a UI renders) arrive in a fast priority batch,
 * then the backfill completes in the same session. AC: visible data < 3s in
 * the harness; backfill completes; nothing lost.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import type { ModuleSyncPolicy } from '@mylife/module-registry/types';
import type { PairedDevice, SyncSecurityPreference, TransportConnection } from '../types';
import type { DocumentManager } from '../crdt/document-manager';
import { createSyncTables } from '../db/schema';
import { generateDeviceIdentity } from '../identity/device-identity';
import { ChangeTracker } from '../crdt/change-tracker';
import { LwwDocumentManager } from '../crdt/lww-document-manager';
import { runInitiatorSession, runResponderSession } from '../protocol/sync-session';
import { decodeTappedMessage, envelopeKeyFromSharedHex } from '../test/frame-tap';
import { parseSecureJsonPayload } from '../protocol/payload-security';
import { splitSnapshotForWindow } from '../protocol/sync-window';

const SECRET = '12'.repeat(32);
const TOTAL_ROWS = 400;
const WINDOW = 25;

const NOTES_POLICY: ModuleSyncPolicy = {
  defaultScope: 'personal_replica',
  shareable: true,
  entityRules: [{ tableName: 'nt_notes', defaultScope: 'personal_replica', conflictStrategy: 'lww' }],
};
const POLICIES = new Map([['notes', NOTES_POLICY]]);
const PREFIXES = new Map([['notes', 'nt_']]);

const paired = (deviceId: string): PairedDevice => ({
  deviceId, displayName: 'peer', dhPublicKey: 'dh',
  sharedSecretRef: `local:shared:${SECRET}`, isActive: true,
} as unknown as PairedDevice);

/** updated_at increases with index: note-399 is the newest. */
const rowTime = (i: number) => new Date(Date.UTC(2026, 0, 1) + i * 60_000).toISOString();
const rowId = (i: number) => `note-${String(i).padStart(3, '0')}`;

function tappedConnectionPair(deviceA: string, deviceB: string) {
  const captured: Array<{ data: Uint8Array; at: number }> = [];
  const hA: Array<(d: Uint8Array) => void> = [];
  const hB: Array<(d: Uint8Array) => void> = [];
  const bA: Uint8Array[] = [];
  const bB: Uint8Array[] = [];
  const deliver = (h: Array<(d: Uint8Array) => void>, buf: Uint8Array[], d: Uint8Array) => {
    if (h.length === 0) { buf.push(d); return; }
    for (const f of [...h]) f(d);
  };
  const attach = (h: Array<(d: Uint8Array) => void>, buf: Uint8Array[], f: (d: Uint8Array) => void) => {
    h.push(f);
    if (buf.length) for (const d of buf.splice(0)) f(d);
  };
  const connA: TransportConnection = {
    id: 'a', remoteDeviceId: deviceB, transport: 'wan_relay',
    send: async (d) => { captured.push({ data: d, at: Date.now() }); setTimeout(() => deliver(hB, bB, d), 0); },
    onData: (f) => attach(hA, bA, f),
    close: async () => {},
  };
  const connB: TransportConnection = {
    id: 'b', remoteDeviceId: deviceA, transport: 'wan_relay',
    send: async (d) => { setTimeout(() => deliver(hA, bA, d), 0); },
    onData: (f) => attach(hB, bB, f),
    close: async () => {},
  };
  return { connA, connB, captured };
}

let dbA: InMemoryTestDatabase | null = null;
let dbB: InMemoryTestDatabase | null = null;
afterEach(() => {
  dbA?.close(); dbA = null;
  dbB?.close(); dbB = null;
});

describe('splitSnapshotForWindow (MK-028 unit)', () => {
  function makeSnapshot(rows: number): Uint8Array {
    const doc = new LwwDocumentManager();
    for (let i = 0; i < rows; i++) {
      doc.applyChange('notes', {
        table: 'nt_notes', rowId: rowId(i), operation: 'INSERT',
        data: { id: rowId(i), title: `n${i}`, updated_at: rowTime(i) },
      });
    }
    return doc.generateSyncMessage('notes', null)!;
  }

  it('keeps the N most recent rows in the window and the rest in backfill, losing nothing', () => {
    const split = splitSnapshotForWindow(makeSnapshot(100), 10)!;
    expect(split.windowRows).toBe(10);
    expect(split.backfillRows).toBe(90);

    const win = JSON.parse(new TextDecoder().decode(split.window)) as { tables: { nt_notes: Record<string, unknown> } };
    const back = JSON.parse(new TextDecoder().decode(split.backfill!)) as { tables: { nt_notes: Record<string, unknown> } };
    const winIds = Object.keys(win.tables.nt_notes).sort();
    // The newest ten: note-090..note-099.
    expect(winIds).toEqual(Array.from({ length: 10 }, (_, i) => rowId(90 + i)));
    // Disjoint and complete.
    const backIds = Object.keys(back.tables.nt_notes);
    expect(backIds).toHaveLength(90);
    expect(backIds.some((id) => winIds.includes(id))).toBe(false);
  });

  it('returns the whole snapshot with no backfill when it fits the window', () => {
    const snapshot = makeSnapshot(5);
    const split = splitSnapshotForWindow(snapshot, 10)!;
    expect(split.window).toEqual(snapshot);
    expect(split.backfill).toBeNull();
    expect(split.backfillRows).toBe(0);
  });

  it('returns null for unparseable input (caller sends the batch whole)', () => {
    expect(splitSnapshotForWindow(new Uint8Array([1, 2, 3]), 10)).toBeNull();
  });
});

describe('sliding-window in a live session (MK-028 acceptance)', () => {
  it('cold start: the priority window lands first (<3s) and backfill completes in-session', async () => {
    const idA = generateDeviceIdentity('Device A');
    const idB = generateDeviceIdentity('Device B');
    dbA = createInMemoryTestDatabase();
    dbB = createInMemoryTestDatabase();
    for (const db of [dbA.adapter, dbB.adapter]) {
      createSyncTables(db);
      db.execute('CREATE TABLE nt_notes (id TEXT PRIMARY KEY, title TEXT, updated_at TEXT)');
    }

    // A holds the large workspace; B is a cold start (empty).
    const docA = new LwwDocumentManager();
    for (let i = 0; i < TOTAL_ROWS; i++) {
      docA.applyChange('notes', {
        table: 'nt_notes', rowId: rowId(i), operation: 'INSERT',
        data: { id: rowId(i), title: `note ${i}`, updated_at: rowTime(i) },
      });
    }
    const docB = new LwwDocumentManager();
    const ctA = new ChangeTracker({ db: dbA.adapter, deviceId: idA.publicKey, modulePrefixes: PREFIXES, modulePolicies: POLICIES });
    const ctB = new ChangeTracker({ db: dbB.adapter, deviceId: idB.publicKey, modulePrefixes: PREFIXES, modulePolicies: POLICIES });

    const { connA, connB, captured } = tappedConnectionPair(idA.publicKey, idB.publicKey);
    const sessionStart = Date.now();

    // This test asserts window-split MECHANICS, so both sides explicitly opt
    // the payload channel off (the only way to get plaintext payloads now
    // that sessions default to required encryption). The wire still rides
    // the frame envelope, which the tap below opens like the peer would.
    const offSecurity: SyncSecurityPreference = {
      subjectType: 'direct', subjectId: 'window-test', encryptionMode: 'off',
      disappearingMessagesEnabled: false, disappearAfterSeconds: null,
      updatedAt: new Date().toISOString(),
    };
    const [initiator, responder] = await Promise.all([
      runInitiatorSession(connA, {
        db: dbA.adapter, identity: idA, pairedDevices: [paired(idB.publicKey)],
        documentManager: docA as unknown as DocumentManager, changeTracker: ctA,
        enabledModules: ['notes'], modulePolicies: POLICIES, transport: 'wan_relay',
        syncWindow: WINDOW,
        securityPreference: offSecurity,
      }),
      runResponderSession(connB, {
        db: dbB.adapter, identity: idB, pairedDevices: [paired(idA.publicKey)],
        documentManager: docB as unknown as DocumentManager, changeTracker: ctB,
        enabledModules: ['notes'], modulePolicies: POLICIES, transport: 'wan_relay',
        securityPreference: offSecurity,
      }),
    ]);

    expect(initiator.session.status).toBe('completed');
    expect(responder.session.status).toBe('completed');

    // Two SYNC_DATA batches crossed: the window, then the backfill.
    const envelopeKey = envelopeKeyFromSharedHex(SECRET, idA.publicKey, idB.publicKey);
    const dataFrames = captured
      .map(({ data, at }) => ({ msg: decodeTappedMessage(envelopeKey, data), at }))
      .filter((e): e is { msg: NonNullable<typeof e.msg>; at: number } => e.msg !== null && e.msg.type === 'SYNC_DATA');
    expect(dataFrames).toHaveLength(2);

    // The PRIORITY WINDOW: exactly the 25 most recent rows, on the wire well
    // inside the 3-second visible-data budget.
    const plain = { enabled: false, key: null };
    const first = parseSecureJsonPayload<{ syncData: number[] }>(dataFrames[0]!.msg!, plain)!;
    const firstWire = JSON.parse(new TextDecoder().decode(new Uint8Array(first.syncData))) as { tables: { nt_notes: Record<string, unknown> } };
    const firstIds = Object.keys(firstWire.tables.nt_notes).sort();
    expect(firstIds).toEqual(
      Array.from({ length: WINDOW }, (_, i) => rowId(TOTAL_ROWS - WINDOW + i)),
    );
    expect(dataFrames[0]!.at - sessionStart).toBeLessThan(3_000);

    // Backfill completed in the background of the same session: B holds ALL rows.
    const rowsOnB = dbB.adapter.query<{ id: string }>('SELECT id FROM nt_notes');
    expect(rowsOnB).toHaveLength(TOTAL_ROWS);

    // MK-009 receipts survive the split: every covered change acked on the
    // final batch, so A marks the module fully synced.
    expect(ctA.getUnsynced()).toHaveLength(0);
  }, 30_000);
});
