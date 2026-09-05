import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { ensureMeerkatTables, ensureSyncSchema } from '../schema';
import {
  isAppearOnlineEnabled,
  setAppearOnlineEnabled,
  describeCommunityPresence,
  communityPresenceView,
  planPresenceEmission,
  type PresenceEmitCommunity,
  type PresenceEmitPeer,
} from '../presence-core';

const COMMUNITY: PresenceEmitCommunity = {
  communityId: 'cm-a',
  memberDeviceIds: ['self', 'peer-a'],
  relayAllowed: true,
  appearOnline: true,
};
const PEER_A: PresenceEmitPeer = {
  deviceId: 'peer-a', dhPublicKey: 'dhA', pairSharedSecretHex: 'aa', isActive: true, revoked: false,
};

let db: InMemoryTestDatabase;

beforeEach(() => {
  db = createInMemoryTestDatabase();
  ensureMeerkatTables(db.adapter);
  ensureSyncSchema(db.adapter);
});

afterEach(() => {
  db.close();
});

describe('web presence-core (Appear online opt-in, twin)', () => {
  it('is OFF by default per community; opting into one never opts into another (NC-4)', () => {
    expect(isAppearOnlineEnabled(db.adapter, 'cm-a')).toBe(false);
    setAppearOnlineEnabled(db.adapter, 'cm-a', true);
    expect(isAppearOnlineEnabled(db.adapter, 'cm-a')).toBe(true);
    expect(isAppearOnlineEnabled(db.adapter, 'cm-b')).toBe(false);
    setAppearOnlineEnabled(db.adapter, 'cm-a', false);
    expect(isAppearOnlineEnabled(db.adapter, 'cm-a')).toBe(false);
  });

  it('describes presence honestly, never inventing activity', () => {
    expect(describeCommunityPresence(0)).toBe('No one is appearing online right now.');
    expect(describeCommunityPresence(1)).toBe('1 member appearing online.');
    expect(describeCommunityPresence(3)).toBe('3 members appearing online.');
  });

  it('fails closed to zero for an unknown community', () => {
    const view = communityPresenceView(db.adapter, 'cm-unknown', 'self-device');
    expect(view.otherCount).toBe(0);
    expect(view.label).toBe('No one is appearing online right now.');
  });

  it('planPresenceEmission (per-community): opted-out => empty; opted-in => one target per reachable co-member', () => {
    expect(planPresenceEmission({
      selfDeviceId: 'self', communities: [{ ...COMMUNITY, appearOnline: false }], pairedPeers: [PEER_A],
    })).toEqual([]);
    expect(planPresenceEmission({
      selfDeviceId: 'self', communities: [COMMUNITY], pairedPeers: [PEER_A],
    })).toEqual([{
      communityId: 'cm-a', recipientDeviceId: 'peer-a', recipientDhPublicKey: 'dhA', pairSharedSecretHex: 'aa',
    }]);
  });

  it('planPresenceEmission never emits over a relay-forbidden community or to a revoked peer', () => {
    expect(planPresenceEmission({
      selfDeviceId: 'self',
      communities: [{ ...COMMUNITY, relayAllowed: false }], pairedPeers: [PEER_A],
    })).toEqual([]);
    expect(planPresenceEmission({
      selfDeviceId: 'self',
      communities: [COMMUNITY], pairedPeers: [{ ...PEER_A, revoked: true }],
    })).toEqual([]);
  });
});
