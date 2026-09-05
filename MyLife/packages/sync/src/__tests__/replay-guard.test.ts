/**
 * MK-012 -- replay protection. Unit matrix for the guard, plus the acceptance
 * scenario: a captured SYNC_DATA frame re-injected mid-session is rejected and
 * audited while the original applies exactly once.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import type { ModuleSyncPolicy } from '@mylife/module-registry/types';
import type { DeviceIdentity, PairedDevice, TransportConnection } from '../types';
import type { DocumentManager } from '../crdt/document-manager';
import { ReplayGuard } from '../protocol/replay-guard';
import { createSyncTables } from '../db/schema';
import { insertPairedDevice, getInboundAudit } from '../db/queries';
import { generateDeviceIdentity, extractDhPrivateKeyHex } from '../identity/device-identity';
import { derivePairingSharedSecret } from '../identity/pairing';
import { envelopeKeyFromSharedHex, openTappedFrame } from '../test/frame-tap';
import { ChangeTracker } from '../crdt/change-tracker';
import { LwwDocumentManager } from '../crdt/lww-document-manager';
import { runInitiatorSession, runResponderSession } from '../protocol/sync-session';

const enc = (s: string) => new TextEncoder().encode(s);

describe('ReplayGuard (MK-012)', () => {
  it('accepts distinct frames and rejects an identical re-delivery', () => {
    const guard = new ReplayGuard({ now: () => 1000 });
    expect(guard.check(enc('frame-one'), 1000)).toEqual({ ok: true });
    expect(guard.check(enc('frame-two'), 1000)).toEqual({ ok: true });
    expect(guard.check(enc('frame-one'), 1000)).toEqual({ ok: false, reason: 'replayed_frame' });
  });

  it('rejects frames outside the timestamp skew budget, past and future', () => {
    const guard = new ReplayGuard({ now: () => 1_000_000, maxSkewMs: 1000 });
    expect(guard.check(enc('a'), 1_000_500)).toEqual({ ok: true });
    expect(guard.check(enc('b'), 998_000)).toEqual({ ok: false, reason: 'timestamp_skew' });
    expect(guard.check(enc('c'), 1_002_000)).toEqual({ ok: false, reason: 'timestamp_skew' });
    expect(guard.check(enc('d'), Number.NaN)).toEqual({ ok: false, reason: 'timestamp_skew' });
  });

  it('evicts the oldest hashes once the window is full (skew still bounds replay)', () => {
    const guard = new ReplayGuard({ now: () => 1000, windowSize: 2 });
    expect(guard.check(enc('one'), 1000).ok).toBe(true);
    expect(guard.check(enc('two'), 1000).ok).toBe(true);
    expect(guard.check(enc('three'), 1000).ok).toBe(true); // evicts 'one'
    expect(guard.check(enc('one'), 1000).ok).toBe(true); // out of window again
    expect(guard.check(enc('three'), 1000).ok).toBe(false); // still in window
  });
});

// ---------------------------------------------------------------------------
// Acceptance: replayed SYNC_DATA frame in a live session
// ---------------------------------------------------------------------------

const NOTES_POLICY: ModuleSyncPolicy = {
  defaultScope: 'personal_replica',
  shareable: true,
  entityRules: [{ tableName: 'nt_notes', defaultScope: 'personal_replica', conflictStrategy: 'lww' }],
};
const POLICIES = new Map([['notes', NOTES_POLICY]]);
const PREFIXES = new Map([['notes', 'nt_']]);
const SYNC_DATA_TYPE_BYTE = 0x12;

function pairedRow(remote: DeviceIdentity, sharedSecretHex: string): PairedDevice {
  const now = new Date().toISOString();
  return {
    deviceId: remote.publicKey, displayName: remote.displayName, dhPublicKey: remote.dhPublicKey,
    sharedSecretRef: `local:shared:${sharedSecretHex}`,
    lastSeenAt: now, lastSyncAt: null, lastSyncModule: null,
    bytesSent: 0, bytesReceived: 0, isActive: true, pairedAt: now,
  };
}

/**
 * Wired pair that delivers every SYNC_DATA frame to B TWICE (the replay).
 * The wire is enveloped (MK-044), so the attacker-tap identifies SYNC_DATA by
 * opening the envelope read-only and re-injects the ORIGINAL wire bytes
 * verbatim: an envelope replay opens cleanly at B, which is exactly why the
 * inner ReplayGuard must still reject the duplicate.
 */
function replayingConnectionPair(deviceA: string, deviceB: string, envelopeKey: Uint8Array): { connA: TransportConnection; connB: TransportConnection } {
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
    send: async (data) => {
      setTimeout(() => {
        deliver(handlersForB, bufferForB, data);
        // The attack: re-inject every captured SYNC_DATA frame verbatim.
        const inner = openTappedFrame(envelopeKey, data);
        if (inner && inner[4] === SYNC_DATA_TYPE_BYTE) deliver(handlersForB, bufferForB, data);
      }, 0);
    },
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

describe('replayed SYNC_DATA in a live session (MK-012 acceptance)', () => {
  it('the duplicate frame is rejected + audited; the note applies exactly once', async () => {
    const idA = generateDeviceIdentity('A');
    const idB = generateDeviceIdentity('B');
    const secret = derivePairingSharedSecret(extractDhPrivateKeyHex(idA.privateKeyRef)!, idB.dhPublicKey);

    dbA = createInMemoryTestDatabase();
    dbB = createInMemoryTestDatabase();
    for (const db of [dbA, dbB]) {
      createSyncTables(db.adapter);
      db.adapter.execute('CREATE TABLE nt_notes (id TEXT PRIMARY KEY, title TEXT, updated_at TEXT)');
    }
    insertPairedDevice(dbA.adapter, pairedRow(idB, secret));
    insertPairedDevice(dbB.adapter, pairedRow(idA, secret));

    const docA = new LwwDocumentManager();
    const note = { id: 'n1', title: 'replay target', updated_at: '2026-06-11T00:00:00.000Z' };
    docA.applyChange('notes', { table: 'nt_notes', rowId: 'n1', operation: 'INSERT', data: note });

    const makeOptions = (db: InMemoryTestDatabase, identity: DeviceIdentity, peer: DeviceIdentity, doc: LwwDocumentManager) => ({
      db: db.adapter,
      identity,
      pairedDevices: [pairedRow(peer, secret)],
      documentManager: doc as unknown as DocumentManager,
      changeTracker: new ChangeTracker({ db: db.adapter, deviceId: identity.publicKey, modulePrefixes: PREFIXES, modulePolicies: POLICIES }),
      enabledModules: ['notes'],
      modulePolicies: POLICIES,
      transport: 'wan_relay' as const,
    });

    const { connA, connB } = replayingConnectionPair(
      idA.publicKey,
      idB.publicKey,
      envelopeKeyFromSharedHex(secret, idA.publicKey, idB.publicKey),
    );
    const [initiator] = await Promise.all([
      runInitiatorSession(connA, makeOptions(dbA, idA, idB, docA)),
      runResponderSession(connB, makeOptions(dbB, idB, idA, new LwwDocumentManager())),
    ]);
    expect(initiator.session.status).toBe('completed');

    // Applied exactly once.
    const rows = dbB.adapter.query<{ id: string }>('SELECT * FROM nt_notes WHERE id = ?', ['n1']);
    expect(rows).toHaveLength(1);

    // The replayed frame was rejected and audited.
    const rejected = getInboundAudit(dbB.adapter, { outcome: 'rejected' });
    const replayRejections = rejected.filter((row) => row.reason === 'replayed_frame');
    expect(replayRejections).toHaveLength(1);
    expect(replayRejections[0]!.operation).toBe('SYNC_DATA');
  });
});
