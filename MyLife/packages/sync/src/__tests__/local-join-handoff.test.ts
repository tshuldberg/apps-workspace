/**
 * Plan 27 P3: local community join handoff over an established local connection.
 *
 * Proves AC-4: joining a proximity-gated (`local_only`) community succeeds over a
 * LAN/Nearby connection and is REFUSED fail-closed over a relay connection -- the
 * join handoff never touches a relay. An `any` community still joins over either
 * carrier (grandfathered). The handoff reuses the exact sealed request/grant
 * envelopes (no new crypto): the connection just replaces the relay mailbox.
 */

import { describe, it, expect } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { generateDeviceIdentity } from '../identity/device-identity';
import { createSyncTables } from '../db/schema';
import { createWorkspace, addWorkspaceMember } from '../db/queries';
import {
  createCommunity,
  createCommunityInvite,
  communityRole,
  getCommunity,
  upsertCommunity,
  type CommunityTransportPolicy,
  type SignedCommunityDescriptor,
} from '../protocol/community';
import { createGroupCommit, getCurrentEpochKey } from '../protocol/group-keys';
import { runLocalJoinAsJoiner, runLocalJoinAsOwner } from '../protocol/local-join-handoff';
import type { SyncTransport, TransportConnection } from '../types';
import {
  configureSyncSecretStore,
  createInMemorySyncSecretStore,
} from '../secrets/sync-secret-store';

const NOW = '2026-07-05T00:00:00.000Z';
type Identity = ReturnType<typeof generateDeviceIdentity>;

function freshDb(): InMemoryTestDatabase {
  const db = createInMemoryTestDatabase();
  createSyncTables(db.adapter);
  return db;
}

/** Found an owner-only community with a REAL epoch 1 (mirrors the app path). */
function foundOwnerCommunity(db: InMemoryTestDatabase, owner: Identity, signed: SignedCommunityDescriptor): void {
  const communityId = signed.descriptor.communityId;
  upsertCommunity(db.adapter, signed, owner.publicKey, NOW);
  createWorkspace(db.adapter, {
    id: communityId,
    displayName: signed.descriptor.name,
    workspaceType: 'community',
    createdByDeviceId: signed.descriptor.ownerDeviceId,
    createdAt: NOW,
    rotatedAt: null,
    currentKeyVersion: 0,
    archivedAt: null,
  });
  for (const member of signed.descriptor.members) {
    addWorkspaceMember(db.adapter, {
      workspaceId: communityId,
      deviceId: member.deviceId,
      role: member.role,
      invitedByDeviceId: signed.descriptor.ownerDeviceId,
      invitedAt: NOW,
      removedAt: null,
    });
  }
  createGroupCommit(db.adapter, {
    workspaceId: communityId,
    committer: owner,
    members: [{ deviceId: owner.publicKey, dhPublicKey: owner.dhPublicKey }],
    now: NOW,
  });
}

/** An in-memory duplex connection pair; a.send -> b.onData and vice versa. */
function duplexPair(transport: SyncTransport, aDevice: string, bDevice: string): [TransportConnection, TransportConnection] {
  let aHandler: ((data: Uint8Array) => void) | null = null;
  let bHandler: ((data: Uint8Array) => void) | null = null;
  const a: TransportConnection = {
    id: 'a',
    remoteDeviceId: bDevice,
    transport,
    send: async (data) => { queueMicrotask(() => bHandler?.(data)); },
    onData: (h) => { aHandler = h; },
    close: async () => {},
  };
  const b: TransportConnection = {
    id: 'b',
    remoteDeviceId: aDevice,
    transport,
    send: async (data) => { queueMicrotask(() => aHandler?.(data)); },
    onData: (h) => { bHandler = h; },
    close: async () => {},
  };
  return [a, b];
}

function inviteFor(owner: Identity, signed: SignedCommunityDescriptor) {
  return createCommunityInvite(owner, signed, 48 * 60 * 60 * 1000, new Date(NOW));
}

async function runHandoff(
  policy: CommunityTransportPolicy | undefined,
  transport: SyncTransport,
) {
  configureSyncSecretStore(createInMemorySyncSecretStore());
  const owner = generateDeviceIdentity('Owner');
  const joiner = generateDeviceIdentity('Joiner');
  const ownerDb = freshDb();
  const joinerDb = freshDb();
  const signed = createCommunity(owner, {
    name: 'Proximity Club',
    channels: [{ id: 'general', name: 'general' }],
    ...(policy ? { transportPolicy: policy } : {}),
    now: NOW,
  });
  foundOwnerCommunity(ownerDb, owner, signed);
  const { link } = inviteFor(owner, signed);

  const [ownerConn, joinerConn] = duplexPair(transport, owner.publicKey, joiner.publicKey);
  const [ownerResult, joinerResult] = await Promise.all([
    runLocalJoinAsOwner({ connection: ownerConn, db: ownerDb.adapter, identity: owner, timeoutMs: 2000, now: () => NOW }),
    runLocalJoinAsJoiner({ connection: joinerConn, db: joinerDb.adapter, identity: joiner, invite: link, timeoutMs: 2000, now: () => NOW }),
  ]);
  const joinerHoldsKey = getCurrentEpochKey(joinerDb.adapter, signed.descriptor.communityId, joiner) !== null;
  const joinerIsMember =
    getCommunity(ownerDb.adapter, signed.descriptor.communityId) != null
    && communityRole(getCommunity(ownerDb.adapter, signed.descriptor.communityId)!.descriptor, joiner.publicKey) !== null;
  ownerDb.close();
  joinerDb.close();
  return { ownerResult, joinerResult, joinerHoldsKey, joinerIsMember };
}

describe('local join handoff (Plan 27 P3)', () => {
  it('a local_only community joins over a LAN connection (AC-4)', async () => {
    const { ownerResult, joinerResult, joinerHoldsKey, joinerIsMember } = await runHandoff('local_only', 'lan');
    expect(joinerResult.ok).toBe(true);
    expect(ownerResult.ok).toBe(true);
    expect(joinerHoldsKey).toBe(true);
    expect(joinerIsMember).toBe(true);
  });

  it('a local_only community joins over a Nearby connection', async () => {
    const { joinerResult, joinerHoldsKey } = await runHandoff('local_only', 'nearby');
    expect(joinerResult.ok).toBe(true);
    expect(joinerHoldsKey).toBe(true);
  });

  it('a local_only community REFUSES to join over a relay connection fail-closed (AC-4)', async () => {
    const { joinerResult, ownerResult, joinerHoldsKey, joinerIsMember } = await runHandoff('local_only', 'wan_relay');
    expect(joinerResult.ok).toBe(false);
    expect(joinerResult.reason).toBe('transport_forbidden');
    // Nothing was sent, so the owner side times out without serving.
    expect(ownerResult.ok).toBe(false);
    expect(joinerHoldsKey).toBe(false);
    expect(joinerIsMember).toBe(false);
  });

  it('a local_only community REFUSES over WebRTC (also non-local)', async () => {
    const { joinerResult } = await runHandoff('local_only', 'wan_webrtc');
    expect(joinerResult.ok).toBe(false);
    expect(joinerResult.reason).toBe('transport_forbidden');
  });

  it('an `any` community joins over a LAN connection', async () => {
    const { joinerResult, joinerHoldsKey } = await runHandoff('any', 'lan');
    expect(joinerResult.ok).toBe(true);
    expect(joinerHoldsKey).toBe(true);
  });

  it('an `any` community joins over a relay connection (grandfathered)', async () => {
    const { joinerResult, joinerHoldsKey } = await runHandoff('any', 'wan_relay');
    expect(joinerResult.ok).toBe(true);
    expect(joinerHoldsKey).toBe(true);
  });

  it('a legacy (absent policy) community joins over a relay connection (AC-6)', async () => {
    const { joinerResult, joinerHoldsKey } = await runHandoff(undefined, 'wan_relay');
    expect(joinerResult.ok).toBe(true);
    expect(joinerHoldsKey).toBe(true);
  });

  it('BLE never carries the handoff (NC-2): a local_only join over BLE is refused', async () => {
    const { joinerResult } = await runHandoff('local_only', 'ble');
    expect(joinerResult.ok).toBe(false);
    expect(joinerResult.reason).toBe('transport_forbidden');
  });

  it('an `any` join over BLE is also refused (BLE is never a data path)', async () => {
    const { joinerResult } = await runHandoff('any', 'ble');
    expect(joinerResult.ok).toBe(false);
    expect(joinerResult.reason).toBe('transport_forbidden');
  });
});
