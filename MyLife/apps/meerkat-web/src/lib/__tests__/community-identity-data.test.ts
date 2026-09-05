// Plan 38 Phase 1b (web twin): community identity data layer. publish/get round
// trips with a real owner identity; a non-owner publish is REFUSED; a non-owner
// (forged) event resolves to null (renders nothing); the per-community theme mode
// round-trips and defaults to 'community'. Mirrors the cm_profiles write/read flow.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import {
  createCommunity,
  createCommunityIdentityEvent,
  createSyncTables,
  generateDeviceIdentity,
  type DeviceIdentity,
} from '@mylife/sync';
import {
  CM_COMMUNITY_IDENTITY_TABLE,
  getCommunityIdentity,
  getCommunityThemeMode,
  insertCommunityIdentityRow,
  publishCommunityIdentity,
  setCommunityThemeMode,
  storeOwnedCommunity,
  tombstoneCommunityIdentity,
} from '../meerkat-data';
import { COMMUNITY_DDL, ensureMeerkatTables } from '../schema';

let db: InMemoryTestDatabase;
let owner: DeviceIdentity;
let member: DeviceIdentity;
let communityId: string;

beforeEach(() => {
  db = createInMemoryTestDatabase();
  createSyncTables(db.adapter);
  ensureMeerkatTables(db.adapter);
  for (const ddl of COMMUNITY_DDL) db.adapter.execute(ddl);
  owner = generateDeviceIdentity('Owner');
  member = generateDeviceIdentity('Member');
  const signed = createCommunity(owner, {
    name: 'Trail Cooks',
    channels: [{ id: 'general', name: 'general' }],
    members: [
      { deviceId: member.publicKey, role: 'member', displayName: 'Member', dhPublicKey: member.dhPublicKey },
    ],
    now: '2026-07-05T09:00:00.000Z',
  });
  storeOwnedCommunity(db.adapter, owner, signed);
  communityId = signed.descriptor.communityId;
});

afterEach(() => db.close());

describe('publishCommunityIdentity / getCommunityIdentity round trip (web)', () => {
  it('publishes an owner-signed identity and reads it back verified', () => {
    const event = publishCommunityIdentity(db.adapter, owner, communityId, {
      description: 'A cozy space for the crew',
      accentColor: '#0E7C66',
      themeBlob: 'meerkat-theme:v1:eyJ2IjoxfQ:deadbeef',
    });
    expect(event.revision).toBe(1);

    const resolved = getCommunityIdentity(db.adapter, communityId);
    expect(resolved?.description).toBe('A cozy space for the crew');
    expect(resolved?.accentColor).toBe('#0e7c66');
    expect(resolved?.signedBy).toBe(owner.publicKey);
  });

  it('increments the revision and the latest owner-signed revision wins', () => {
    publishCommunityIdentity(db.adapter, owner, communityId, { description: 'first' });
    const second = publishCommunityIdentity(db.adapter, owner, communityId, { description: 'second' });
    expect(second.revision).toBe(2);
    expect(getCommunityIdentity(db.adapter, communityId)?.description).toBe('second');
  });

  it('records the change for replication (table, INSERT, id, row data)', () => {
    const calls: Array<{ table: string; op: string; id: string; data: Record<string, unknown> }> = [];
    const event = publishCommunityIdentity(
      db.adapter,
      owner,
      communityId,
      { description: 'replicate me' },
      (table, op, id, data) => calls.push({ table, op, id, data }),
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].table).toBe(CM_COMMUNITY_IDENTITY_TABLE);
    expect(calls[0].op).toBe('INSERT');
    expect(calls[0].id).toBe(event.id);
    expect(calls[0].data.community_id).toBe(communityId);
  });

  it('tombstones the identity back to defaults (getCommunityIdentity returns null)', () => {
    publishCommunityIdentity(db.adapter, owner, communityId, { description: 'temporary' });
    tombstoneCommunityIdentity(db.adapter, owner, communityId);
    expect(getCommunityIdentity(db.adapter, communityId)).toBeNull();
  });
});

describe('owner enforcement (web)', () => {
  it('REFUSES a non-owner publish with an honest error', () => {
    expect(() =>
      publishCommunityIdentity(db.adapter, member, communityId, { description: 'not allowed' }),
    ).toThrow('Only the community owner can change its identity.');
  });

  it('REFUSES a publish for an unknown community', () => {
    expect(() =>
      publishCommunityIdentity(db.adapter, owner, 'deadbeefdeadbeefdeadbeefdeadbeef', { description: 'nope' }),
    ).toThrow('Community not found on this device.');
  });

  it('resolves a non-owner (forged) identity event to null (renders nothing)', () => {
    const stranger = generateDeviceIdentity('Stranger');
    const forged = createCommunityIdentityEvent(stranger, {
      communityId,
      revision: 99,
      description: 'takeover attempt',
    });
    insertCommunityIdentityRow(db.adapter, forged);
    expect(getCommunityIdentity(db.adapter, communityId)).toBeNull();
  });
});

describe('per-community theme mode (device-local, web)', () => {
  it("defaults to 'community'", () => {
    expect(getCommunityThemeMode(db.adapter, communityId)).toBe('community');
  });

  it("round-trips 'mine' and back to 'community'", () => {
    setCommunityThemeMode(db.adapter, communityId, 'mine');
    expect(getCommunityThemeMode(db.adapter, communityId)).toBe('mine');
    setCommunityThemeMode(db.adapter, communityId, 'community');
    expect(getCommunityThemeMode(db.adapter, communityId)).toBe('community');
  });

  it('is scoped per community', () => {
    setCommunityThemeMode(db.adapter, communityId, 'mine');
    expect(getCommunityThemeMode(db.adapter, 'other-community-id')).toBe('community');
  });
});
