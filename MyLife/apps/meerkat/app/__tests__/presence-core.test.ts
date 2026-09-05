import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { ensureMeerkatTables } from '../(root)/data/db';
import { ensureSyncSchema } from '../(root)/data/sync-core';
import { ensureCommunityTables } from '../(root)/data/community-core';
import {
  isAppearOnlineEnabled,
  setAppearOnlineEnabled,
  describeCommunityPresence,
  communityPresenceView,
  planPresenceEmission,
  type PresenceEmitCommunity,
  type PresenceEmitPeer,
} from '../(root)/data/presence-core';

const COMMUNITY: PresenceEmitCommunity = {
  communityId: 'cm-a',
  memberDeviceIds: ['self', 'peer-a', 'peer-b'],
  relayAllowed: true,
  appearOnline: true,
};
const PEER_A: PresenceEmitPeer = {
  deviceId: 'peer-a', dhPublicKey: 'dhA', pairSharedSecretHex: 'aa', isActive: true, revoked: false,
};

let testDb: InMemoryTestDatabase;
let db: InMemoryTestDatabase['adapter'];

beforeEach(() => {
  testDb = createInMemoryTestDatabase();
  db = testDb.adapter;
  ensureMeerkatTables(db);
  ensureSyncSchema(db);
  ensureCommunityTables(db);
});

afterEach(() => {
  testDb.close();
});

describe('presence-core (Appear online opt-in)', () => {
  it('is OFF by default per community; opting into one never opts into another (NC-4, per-community)', () => {
    expect(isAppearOnlineEnabled(db, 'cm-a')).toBe(false);
    expect(isAppearOnlineEnabled(db, 'cm-b')).toBe(false);
    setAppearOnlineEnabled(db, 'cm-a', true);
    expect(isAppearOnlineEnabled(db, 'cm-a')).toBe(true);
    // cm-b stays OFF: the flag is independent per community.
    expect(isAppearOnlineEnabled(db, 'cm-b')).toBe(false);
    setAppearOnlineEnabled(db, 'cm-a', false);
    expect(isAppearOnlineEnabled(db, 'cm-a')).toBe(false);
  });

  it('describes presence honestly, never inventing activity', () => {
    expect(describeCommunityPresence(0)).toBe('No one is appearing online right now.');
    expect(describeCommunityPresence(1)).toBe('1 member appearing online.');
    expect(describeCommunityPresence(3)).toBe('3 members appearing online.');
  });

  it('fails closed to zero for an unknown community (no roster to trust)', () => {
    const view = communityPresenceView(db, 'cm-unknown', 'self-device');
    expect(view.otherCount).toBe(0);
    expect(view.members).toEqual([]);
    expect(view.label).toBe('No one is appearing online right now.');
  });
});

describe('planPresenceEmission (per-community)', () => {
  it('emits nothing for a community the user did NOT opt into', () => {
    expect(planPresenceEmission({
      selfDeviceId: 'self', communities: [{ ...COMMUNITY, appearOnline: false }], pairedPeers: [PEER_A],
    })).toEqual([]);
  });

  it('emits only for the opted-in community, one beacon per reachable co-member peer', () => {
    const optedOut: PresenceEmitCommunity = {
      communityId: 'cm-b', memberDeviceIds: ['self', 'peer-a'], relayAllowed: true, appearOnline: false,
    };
    const targets = planPresenceEmission({
      selfDeviceId: 'self', communities: [COMMUNITY, optedOut], pairedPeers: [PEER_A],
    });
    expect(targets).toEqual([{
      communityId: 'cm-a', recipientDeviceId: 'peer-a', recipientDhPublicKey: 'dhA', pairSharedSecretHex: 'aa',
    }]);
  });

  it('never emits to self, non-members, revoked/inactive peers, or a relay-forbidden community', () => {
    const revoked: PresenceEmitPeer = { ...PEER_A, deviceId: 'peer-b', revoked: true };
    const notMember: PresenceEmitPeer = { deviceId: 'stranger', dhPublicKey: 'x', pairSharedSecretHex: 'x', isActive: true, revoked: false };
    // relay-forbidden community => no targets even when opted in.
    expect(planPresenceEmission({
      selfDeviceId: 'self',
      communities: [{ ...COMMUNITY, relayAllowed: false }], pairedPeers: [PEER_A],
    })).toEqual([]);
    // self not a member of the community => no targets.
    expect(planPresenceEmission({
      selfDeviceId: 'outsider',
      communities: [COMMUNITY], pairedPeers: [PEER_A],
    })).toEqual([]);
    // revoked co-member + a non-member paired peer are both excluded.
    expect(planPresenceEmission({
      selfDeviceId: 'self',
      communities: [COMMUNITY], pairedPeers: [revoked, notMember],
    })).toEqual([]);
  });

  it('excludes a co-member peer with no resolvable secret or DH key', () => {
    const noSecret: PresenceEmitPeer = { ...PEER_A, pairSharedSecretHex: null };
    expect(planPresenceEmission({
      selfDeviceId: 'self', communities: [COMMUNITY], pairedPeers: [noSecret],
    })).toEqual([]);
  });
});
