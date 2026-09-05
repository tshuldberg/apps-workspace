/**
 * Gossip phase over a real sync session (Plan 27/28 P4, Item 10 / AM6).
 *
 * Until now gossipDescriptors / gossipRevocations were barrel exports nothing
 * called. This proves the production caller: two paired devices run one real
 * `gossip: true` session (handshake, encrypted negotiation, frame envelope),
 * and a member-removal descriptor revision + a signed revocation issued on the
 * initiator converge onto the responder as an explicit GOSSIP message BEFORE
 * BYE -- reconciling the responder's roster (Item 7) and locking out the
 * revoked device -- with NO second raw-frame phase bolted onto the session.
 */

import { afterEach, describe, expect, it, beforeEach } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import type { DatabaseAdapter } from '@mylife/db';
import type { DocumentManager } from '../crdt/document-manager';
import type { PairedDevice, TransportConnection } from '../types';
import { ChangeTracker } from '../crdt/change-tracker';
import { LwwDocumentManager } from '../crdt/lww-document-manager';
import { createSyncTables } from '../db/schema';
import {
  addWorkspaceMember,
  createWorkspace,
  getWorkspaceMembers,
  isDeviceRevoked,
} from '../db/queries';
import {
  configureSyncSecretStore,
  createInMemorySyncSecretStore,
} from '../secrets/sync-secret-store';
import { generateDeviceIdentity } from '../identity/device-identity';
import {
  createCommunity,
  getCommunity,
  removeMemberRevision,
  upsertCommunity,
  type SignedCommunityDescriptor,
} from '../protocol/community';
import { applySignedRevocation, createSignedRevocation } from '../protocol/revocation-record';
import { runInitiatorSession, runResponderSession } from '../protocol/sync-session';

const SECRET = 'ab'.repeat(32);
type Identity = ReturnType<typeof generateDeviceIdentity>;

function paired(deviceId: string, dhPublicKey: string): PairedDevice {
  return {
    deviceId,
    displayName: 'peer',
    dhPublicKey,
    sharedSecretRef: `local:shared:${SECRET}`,
    isActive: true,
  } as unknown as PairedDevice;
}

/** Two in-memory connections that ferry frames to each other's handlers (additive). */
function connectionPair(deviceA: string, deviceB: string): { connA: TransportConnection; connB: TransportConnection } {
  const handlersForA: Array<(d: Uint8Array) => void> = [];
  const handlersForB: Array<(d: Uint8Array) => void> = [];
  const bufferForA: Uint8Array[] = [];
  const bufferForB: Uint8Array[] = [];
  const deliver = (handlers: Array<(d: Uint8Array) => void>, buffer: Uint8Array[], data: Uint8Array) => {
    if (handlers.length === 0) { buffer.push(data); return; }
    for (const handler of [...handlers]) handler(data);
  };
  const attach = (handlers: Array<(d: Uint8Array) => void>, buffer: Uint8Array[], handler: (d: Uint8Array) => void) => {
    handlers.push(handler);
    if (buffer.length > 0) {
      const queued = buffer.splice(0, buffer.length);
      for (const data of queued) handler(data);
    }
  };
  const connA: TransportConnection = {
    id: 'conn-a', remoteDeviceId: deviceB, transport: 'wan_relay',
    send: async (data) => { setTimeout(() => deliver(handlersForB, bufferForB, data), 0); },
    onData: (handler) => attach(handlersForA, bufferForA, handler),
    close: async () => {},
  };
  const connB: TransportConnection = {
    id: 'conn-b', remoteDeviceId: deviceA, transport: 'wan_relay',
    send: async (data) => { setTimeout(() => deliver(handlersForA, bufferForA, data), 0); },
    onData: (handler) => attach(handlersForB, bufferForB, handler),
    close: async () => {},
  };
  return { connA, connB };
}

const asMember = (id: Identity) => ({ deviceId: id.publicKey, role: 'member' as const, dhPublicKey: id.dhPublicKey });

/** Mirror the app's stored community on one device: descriptor + workspace + roster. */
function storeCommunity(db: DatabaseAdapter, me: Identity, signed: SignedCommunityDescriptor, at: string): void {
  const d = signed.descriptor;
  upsertCommunity(db, signed, me.publicKey, at);
  createWorkspace(db, {
    id: d.communityId, displayName: d.name, workspaceType: 'community',
    createdByDeviceId: d.ownerDeviceId, createdAt: at, rotatedAt: null, currentKeyVersion: 0, archivedAt: null,
  });
  for (const member of d.members) {
    addWorkspaceMember(db, {
      workspaceId: d.communityId, deviceId: member.deviceId, role: member.role,
      invitedByDeviceId: d.ownerDeviceId, invitedAt: at, removedAt: null,
    });
  }
}

let dbA: InMemoryTestDatabase | null = null;
let dbB: InMemoryTestDatabase | null = null;

beforeEach(() => configureSyncSecretStore(createInMemorySyncSecretStore()));
afterEach(() => { dbA?.close(); dbA = null; dbB?.close(); dbB = null; });

describe('gossip phase converges over a real session (Item 10 / AM6)', () => {
  it('spreads a member-removal revision + a signed revocation from initiator to responder', async () => {
    const NOW = '2026-07-06T00:00:00.000Z';
    const LATER = '2026-07-06T01:00:00.000Z';
    const owner = generateDeviceIdentity('Owner');   // device A, the initiator
    const bea = generateDeviceIdentity('Bea');        // device B, the responder
    const cal = generateDeviceIdentity('Cal');        // removed + revoked

    const rev1 = createCommunity(owner, {
      name: 'Surf Club', channels: [{ id: 'general', name: 'general' }],
      members: [asMember(bea), asMember(cal)], now: NOW,
    });
    const communityId = rev1.descriptor.communityId;

    dbA = createInMemoryTestDatabase();
    dbB = createInMemoryTestDatabase();
    createSyncTables(dbA.adapter);
    createSyncTables(dbB.adapter);

    // Both hold revision 1 (Cal is a member); B's roster lists Cal.
    storeCommunity(dbA.adapter, owner, rev1, NOW);
    storeCommunity(dbB.adapter, bea, rev1, NOW);

    // The owner applies its own revocation locally FIRST (while Cal is still a
    // listed member, so the owner is an authorized revoker); this also stores the
    // signed record so the session can gossip it forward.
    const revocation = createSignedRevocation(owner, cal.publicKey, 'left the group', LATER);
    expect(applySignedRevocation(dbA.adapter, revocation).ok).toBe(true);
    // Then the owner removes Cal (revision 2) and reconciles its own roster.
    const rev2 = removeMemberRevision(owner, rev1, cal.publicKey, LATER);
    upsertCommunity(dbA.adapter, rev2, owner.publicKey, LATER);
    dbA.adapter.execute(
      'UPDATE sync_workspace_members SET removed_at = ? WHERE workspace_id = ? AND device_id = ?',
      [LATER, communityId, cal.publicKey],
    );

    // Sanity: before the session, B still lists Cal and does not know the revocation.
    expect(getWorkspaceMembers(dbB.adapter, communityId).map((m) => m.deviceId)).toContain(cal.publicKey);
    expect(isDeviceRevoked(dbB.adapter, cal.publicKey)).toBe(false);

    const { connA, connB } = connectionPair(owner.publicKey, bea.publicKey);
    const [initiator, responder] = await Promise.all([
      runInitiatorSession(connA, {
        db: dbA.adapter, identity: owner,
        pairedDevices: [paired(bea.publicKey, bea.dhPublicKey)],
        documentManager: new LwwDocumentManager() as unknown as DocumentManager,
        changeTracker: new ChangeTracker({ db: dbA.adapter, deviceId: owner.publicKey, modulePrefixes: new Map(), modulePolicies: new Map() }),
        enabledModules: [], transport: 'wan_relay', gossip: true,
      }),
      runResponderSession(connB, {
        db: dbB.adapter, identity: bea,
        pairedDevices: [paired(owner.publicKey, owner.dhPublicKey)],
        documentManager: new LwwDocumentManager() as unknown as DocumentManager,
        changeTracker: new ChangeTracker({ db: dbB.adapter, deviceId: bea.publicKey, modulePrefixes: new Map(), modulePolicies: new Map() }),
        enabledModules: [], transport: 'wan_relay', gossip: true,
      }),
    ]);

    expect(initiator.session.status).toBe('completed');
    expect(responder.session.status).toBe('completed');

    // The gossip phase ran and reported honest counts.
    expect(initiator.gossip?.revsSent).toBe(1);
    expect(initiator.gossip?.descsSent).toBe(1);
    expect(responder.gossip?.appliedFromPeer).toBe(2); // rev2 descriptor + the revocation

    // B converged: revision 2, Cal dropped from the descriptor AND the roster
    // (Item 7 reconcile flips the session-auth gate), and Cal is now revoked.
    const stored = getCommunity(dbB.adapter, communityId)!;
    expect(stored.descriptor.revision).toBe(2);
    expect(stored.descriptor.members.some((m) => m.deviceId === cal.publicKey)).toBe(false);
    expect(getWorkspaceMembers(dbB.adapter, communityId).map((m) => m.deviceId)).not.toContain(cal.publicKey);
    expect(isDeviceRevoked(dbB.adapter, cal.publicKey)).toBe(true);
  });

  it('a session without gossip enabled exchanges nothing (opt-in)', async () => {
    const NOW = '2026-07-06T00:00:00.000Z';
    const owner = generateDeviceIdentity('Owner');
    const bea = generateDeviceIdentity('Bea');
    const cal = generateDeviceIdentity('Cal');
    const rev1 = createCommunity(owner, { name: 'Surf Club', channels: [], members: [asMember(bea), asMember(cal)], now: NOW });
    const communityId = rev1.descriptor.communityId;

    dbA = createInMemoryTestDatabase();
    dbB = createInMemoryTestDatabase();
    createSyncTables(dbA.adapter);
    createSyncTables(dbB.adapter);
    storeCommunity(dbA.adapter, owner, rev1, NOW);
    storeCommunity(dbB.adapter, bea, rev1, NOW);
    const rev2 = removeMemberRevision(owner, rev1, cal.publicKey, NOW);
    upsertCommunity(dbA.adapter, rev2, owner.publicKey, NOW);

    const { connA, connB } = connectionPair(owner.publicKey, bea.publicKey);
    const [initiator, responder] = await Promise.all([
      runInitiatorSession(connA, {
        db: dbA.adapter, identity: owner, pairedDevices: [paired(bea.publicKey, bea.dhPublicKey)],
        documentManager: new LwwDocumentManager() as unknown as DocumentManager,
        changeTracker: new ChangeTracker({ db: dbA.adapter, deviceId: owner.publicKey, modulePrefixes: new Map(), modulePolicies: new Map() }),
        enabledModules: [], transport: 'wan_relay', // gossip omitted
      }),
      runResponderSession(connB, {
        db: dbB.adapter, identity: bea, pairedDevices: [paired(owner.publicKey, owner.dhPublicKey)],
        documentManager: new LwwDocumentManager() as unknown as DocumentManager,
        changeTracker: new ChangeTracker({ db: dbB.adapter, deviceId: bea.publicKey, modulePrefixes: new Map(), modulePolicies: new Map() }),
        enabledModules: [], transport: 'wan_relay',
      }),
    ]);

    expect(initiator.gossip).toBeUndefined();
    expect(responder.gossip).toBeUndefined();
    // B did NOT converge: still revision 1 with Cal listed.
    expect(getCommunity(dbB.adapter, communityId)!.descriptor.revision).toBe(1);
  });

  it('does NOT gossip a peer the descriptors of communities they are not a member of (roster privacy)', async () => {
    const NOW = '2026-07-06T00:00:00.000Z';
    const owner = generateDeviceIdentity('Owner');   // A, initiator
    const bea = generateDeviceIdentity('Bea');        // B, responder
    const dave = generateDeviceIdentity('Dave');      // member of the community B is NOT in

    // Y: A + B are members. X: A + Dave, but NOT B.
    const shared = createCommunity(owner, { name: 'Shared', channels: [], members: [asMember(bea)], now: NOW });
    const secret = createCommunity(owner, { name: 'Private Group', channels: [], members: [asMember(dave)], now: NOW });

    dbA = createInMemoryTestDatabase();
    dbB = createInMemoryTestDatabase();
    createSyncTables(dbA.adapter);
    createSyncTables(dbB.adapter);
    // A holds BOTH; B holds only the shared one.
    storeCommunity(dbA.adapter, owner, shared, NOW);
    storeCommunity(dbA.adapter, owner, secret, NOW);
    storeCommunity(dbB.adapter, bea, shared, NOW);

    const { connA, connB } = connectionPair(owner.publicKey, bea.publicKey);
    const [initiator] = await Promise.all([
      runInitiatorSession(connA, {
        db: dbA.adapter, identity: owner, pairedDevices: [paired(bea.publicKey, bea.dhPublicKey)],
        documentManager: new LwwDocumentManager() as unknown as DocumentManager,
        changeTracker: new ChangeTracker({ db: dbA.adapter, deviceId: owner.publicKey, modulePrefixes: new Map(), modulePolicies: new Map() }),
        enabledModules: [], transport: 'wan_relay', gossip: true,
      }),
      runResponderSession(connB, {
        db: dbB.adapter, identity: bea, pairedDevices: [paired(owner.publicKey, owner.dhPublicKey)],
        documentManager: new LwwDocumentManager() as unknown as DocumentManager,
        changeTracker: new ChangeTracker({ db: dbB.adapter, deviceId: bea.publicKey, modulePrefixes: new Map(), modulePolicies: new Map() }),
        enabledModules: [], transport: 'wan_relay', gossip: true,
      }),
    ]);

    // A gossiped ONLY the shared community's descriptor to B, never the private
    // one B is not a member of -- so B's roster metadata never crossed the wire.
    expect(initiator.gossip?.descsSent).toBe(1);
    // And B never learns the private community exists.
    expect(getCommunity(dbB.adapter, secret.descriptor.communityId)).toBeNull();
    expect(getCommunity(dbB.adapter, shared.descriptor.communityId)).not.toBeNull();
  });
});
