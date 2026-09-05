/**
 * MK-019 gossip transport -- the deferred seam, now closed. A revocation issued
 * by one device PROPAGATES over a connection to a peer, which then rejects the
 * revoked device at handshake time. This is the "within one gossip round"
 * acceptance, end to end over the connection-pair harness.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import type { TransportConnection } from '../types';
import { createSyncTables } from '../db/schema';
import { generateDeviceIdentity } from '../identity/device-identity';
import { completePairing } from '../identity/pairing';
import {
  createSignedRevocation,
  applySignedRevocation,
} from '../protocol/revocation-record';
import { gossipRevocations, collectRevocationRecords } from '../protocol/revocation-gossip';
import { isDeviceRevoked, insertPairedDevice, createWorkspace, addWorkspaceMember } from '../db/queries';
import type { WorkspaceMemberRole } from '../types';

const WS = 'ws-gossip';

/** Register a shared workspace so the admin revocation-authority model resolves. */
function setupWorkspace(db: InMemoryTestDatabase, roles: Record<string, WorkspaceMemberRole>) {
  const ids = Object.keys(roles);
  createWorkspace(db.adapter, {
    id: WS, displayName: 'Gossip', workspaceType: 'group', createdByDeviceId: ids[0]!,
    createdAt: '2026-06-11T00:00:00.000Z', rotatedAt: null, currentKeyVersion: 0, archivedAt: null,
  });
  for (const id of ids) {
    addWorkspaceMember(db.adapter, {
      workspaceId: WS, deviceId: id, role: roles[id]!, invitedByDeviceId: ids[0]!,
      invitedAt: '2026-06-11T00:00:00.000Z', removedAt: null,
    });
  }
}

const pairingData = (id: ReturnType<typeof generateDeviceIdentity>) =>
  ({ publicKey: id.publicKey, dhPublicKey: id.dhPublicKey, displayName: id.displayName, pairingNonce: '' });

/** Wired pair with async delivery + pre-handler buffering (the session harness). */
function connectionPair(a: string, b: string): { connA: TransportConnection; connB: TransportConnection } {
  const hA: Array<(d: Uint8Array) => void> = [];
  const hB: Array<(d: Uint8Array) => void> = [];
  const bufA: Uint8Array[] = [];
  const bufB: Uint8Array[] = [];
  const deliver = (h: typeof hA, buf: Uint8Array[], d: Uint8Array) => {
    if (h.length === 0) { buf.push(d); return; }
    for (const f of [...h]) f(d);
  };
  const attach = (h: typeof hA, buf: Uint8Array[], f: (d: Uint8Array) => void) => {
    h.push(f);
    if (buf.length) for (const d of buf.splice(0)) f(d);
  };
  const connA: TransportConnection = {
    id: 'a', remoteDeviceId: b, transport: 'wan_relay',
    send: async (d) => { setTimeout(() => deliver(hB, bufB, d), 0); },
    onData: (f) => attach(hA, bufA, f), close: async () => {},
  };
  const connB: TransportConnection = {
    id: 'b', remoteDeviceId: a, transport: 'wan_relay',
    send: async (d) => { setTimeout(() => deliver(hA, bufA, d), 0); },
    onData: (f) => attach(hB, bufB, f), close: async () => {},
  };
  return { connA, connB };
}

let dbA: InMemoryTestDatabase | null = null;
let dbB: InMemoryTestDatabase | null = null;
afterEach(() => {
  dbA?.close(); dbA = null;
  dbB?.close(); dbB = null;
});

describe('revocation record persistence (MK-019 gossip)', () => {
  it('a self-issued revocation is stored as a forwardable signed record', () => {
    const db = createInMemoryTestDatabase();
    createSyncTables(db.adapter);
    const me = generateDeviceIdentity('Me');
    const lost = generateDeviceIdentity('Lost');
    const signed = createSignedRevocation(me, lost.publicKey, 'lost');

    // Self-authorized apply (as the app's revokePeer does).
    applySignedRevocation(db.adapter, signed, { isAuthorizedRevoker: (r) => r === me.publicKey });

    const records = collectRevocationRecords(db.adapter);
    expect(records).toHaveLength(1);
    expect(records[0]!.revocation.deviceId).toBe(lost.publicKey);
    expect(records[0]!.signature).toBe(signed.signature);
    db.close();
  });
});

describe('gossipRevocations propagation (MK-019 acceptance)', () => {
  it('a revocation known to A reaches B in one round; B then rejects the device', async () => {
    const a = generateDeviceIdentity('Admin');
    const b = generateDeviceIdentity('Member');
    const lost = generateDeviceIdentity('Lost Phone');

    dbA = createInMemoryTestDatabase();
    dbB = createInMemoryTestDatabase();
    createSyncTables(dbA.adapter);
    createSyncTables(dbB.adapter);

    // A and B are paired with each other; B is also paired with the lost device.
    insertPairedDevice(dbA.adapter, completePairing(a, pairingData(b)));
    insertPairedDevice(dbB.adapter, completePairing(b, pairingData(a)));
    insertPairedDevice(dbB.adapter, completePairing(b, pairingData(lost)));
    // B's view of the workspace: A is the owner/admin, the lost device a member,
    // so B will accept A's admin-authored revocation of the lost device.
    setupWorkspace(dbB, { [a.publicKey]: 'owner', [b.publicKey]: 'member', [lost.publicKey]: 'member' });

    // A issues + stores a revocation of the lost device (self-authorized).
    const signed = createSignedRevocation(a, lost.publicKey, 'stolen');
    applySignedRevocation(dbA.adapter, signed, { isAuthorizedRevoker: (r) => r === a.publicKey });

    // B does not know about it yet.
    expect(isDeviceRevoked(dbB.adapter, lost.publicKey)).toBe(false);

    // One gossip round over a shared connection.
    const { connA, connB } = connectionPair(a.publicKey, b.publicKey);
    const [aRes, bRes] = await Promise.all([
      gossipRevocations({ connection: connA, db: dbA.adapter, identity: a, role: 'initiate' }),
      gossipRevocations({ connection: connB, db: dbB.adapter, identity: b, role: 'respond' }),
    ]);

    expect(aRes.sent).toBe(1);
    expect(bRes.applied).toBe(1);
    // B (which trusts A as a paired device) now rejects the lost device -- the
    // existing handshake check uses exactly this.
    expect(isDeviceRevoked(dbB.adapter, lost.publicKey)).toBe(true);
    // And B now holds the record, so it would forward it onward next round.
    expect(collectRevocationRecords(dbB.adapter)).toHaveLength(1);
  });

  it('a gossiped revocation from an UNTRUSTED signer is not applied', async () => {
    const stranger = generateDeviceIdentity('Stranger');
    const b = generateDeviceIdentity('Member');
    const target = generateDeviceIdentity('Target');

    dbA = createInMemoryTestDatabase();
    dbB = createInMemoryTestDatabase();
    createSyncTables(dbA.adapter);
    createSyncTables(dbB.adapter);
    // The stranger and B are paired (so the gossip channel exists)...
    insertPairedDevice(dbA.adapter, completePairing(stranger, pairingData(b)));
    insertPairedDevice(dbB.adapter, completePairing(b, pairingData(stranger)));

    // ...but the revocation of `target` is signed by a THIRD device B never paired with.
    const phantom = generateDeviceIdentity('Phantom');
    const signed = createSignedRevocation(phantom, target.publicKey);
    // Stranger stores it (stranger paired with phantom in its own world) then gossips.
    insertPairedDevice(dbA.adapter, completePairing(stranger, pairingData(phantom)));
    applySignedRevocation(dbA.adapter, signed);

    const { connA, connB } = connectionPair(stranger.publicKey, b.publicKey);
    await Promise.all([
      gossipRevocations({ connection: connA, db: dbA.adapter, identity: stranger, role: 'initiate' }),
      gossipRevocations({ connection: connB, db: dbB.adapter, identity: b, role: 'respond' }),
    ]);

    // B never paired with phantom -> it does not trust the revocation -> not applied.
    expect(isDeviceRevoked(dbB.adapter, target.publicKey)).toBe(false);
  });
});
