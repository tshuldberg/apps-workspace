/**
 * Plan 38 Phase 2 exit (engine leg): an ORGANIZED descriptor revision
 * (categories, per-channel kind/category/order/topic/archived, layout)
 * round-trips through the real descriptor gossip path to a member device and
 * renders through the fail-safe readers; a legacy member device that never
 * saw the new fields still verifies and applies it.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import {
  applyGossipedDescriptors,
  channelArchived,
  channelKind,
  collectDescriptorRecords,
  communityCategories,
  communityLayout,
  configureSyncSecretStore,
  createCommunity,
  createInMemorySyncSecretStore,
  createSyncTables,
  generateDeviceIdentity,
  getCommunity,
  orderedChannels,
  reviseCommunity,
  upsertCommunity,
} from '../index';

const NOW = '2026-07-05T00:00:00.000Z';
const LATER = '2026-07-05T01:00:00.000Z';
type Identity = ReturnType<typeof generateDeviceIdentity>;
const asMember = (id: Identity) => ({ deviceId: id.publicKey, role: 'member' as const, dhPublicKey: id.dhPublicKey });

let ownerDb: InMemoryTestDatabase;
let memberDb: InMemoryTestDatabase;
beforeEach(() => {
  configureSyncSecretStore(createInMemorySyncSecretStore());
  ownerDb = createInMemoryTestDatabase();
  memberDb = createInMemoryTestDatabase();
  createSyncTables(ownerDb.adapter);
  createSyncTables(memberDb.adapter);
});
afterEach(() => { ownerDb.close(); memberDb.close(); });

describe('organized descriptor revision round-trip (Plan 38 Phase 2 exit)', () => {
  it('owner organizes; the member device applies the gossiped revision and reads the structure', () => {
    const owner = generateDeviceIdentity('Owner');
    const member = generateDeviceIdentity('Member');
    const genesis = createCommunity(owner, {
      name: 'Club',
      channels: [
        { id: 'general', name: 'General' },
        { id: 'photos', name: 'Photos' },
        { id: 'old-plans', name: 'Old Plans' },
      ],
      members: [asMember(member)],
    });
    upsertCommunity(ownerDb.adapter, genesis, owner.publicKey, NOW);
    upsertCommunity(memberDb.adapter, genesis, member.publicKey, NOW);

    // The owner's channel manager commits EVERYTHING as ONE revision (the
    // Phase 2 batching rule): categories, order, topics, a kind, an archive,
    // and the layout, in a single reviseCommunity call.
    const organized = reviseCommunity(owner, genesis, {
      channels: [
        { id: 'photos', name: 'Family Photos', kind: 'library', categoryId: 'media', order: 0, topic: 'Every trip' },
        { id: 'general', name: 'General', categoryId: 'talk', order: 1 },
        { id: 'old-plans', name: 'Old Plans', archived: true, order: 2 },
      ],
      categories: [
        { id: 'media', name: 'Media', order: 0 },
        { id: 'talk', name: 'Talk', order: 1 },
      ],
      layout: 'library_first',
    }, LATER);
    expect(organized.descriptor.revision).toBe(genesis.descriptor.revision + 1);
    upsertCommunity(ownerDb.adapter, organized, owner.publicKey, LATER);

    // Real gossip leg: records collected on the owner device, applied on the member device.
    const records = collectDescriptorRecords(ownerDb.adapter);
    const applied = applyGossipedDescriptors(memberDb.adapter, records, member.publicKey, LATER);
    expect(applied).toBe(1);

    const stored = getCommunity(memberDb.adapter, organized.descriptor.communityId)!;
    expect(stored.descriptor.revision).toBe(2);
    expect(communityLayout(stored.descriptor)).toBe('library_first');
    expect(communityCategories(stored.descriptor).map((c) => c.id)).toEqual(['media', 'talk']);
    const visible = orderedChannels(stored.descriptor);
    expect(visible.map((c) => c.id)).toEqual(['photos', 'general']);
    expect(channelKind(visible[0]!)).toBe('library');
    expect(visible[0]!.topic).toBe('Every trip');
    const archived = orderedChannels(stored.descriptor, { includeArchived: true })
      .filter((c) => channelArchived(c));
    expect(archived.map((c) => c.id)).toEqual(['old-plans']);
  });

  it('a legacy (unorganized) revision still applies and renders unchanged after the fields shipped', () => {
    const owner = generateDeviceIdentity('Owner');
    const member = generateDeviceIdentity('Member');
    const genesis = createCommunity(owner, {
      name: 'Plain Club',
      channels: [{ id: 'general', name: 'General' }],
      members: [asMember(member)],
    });
    upsertCommunity(memberDb.adapter, genesis, member.publicKey, NOW);

    const renamed = reviseCommunity(owner, genesis, { name: 'Plain Club Renamed' }, LATER);
    const applied = applyGossipedDescriptors(memberDb.adapter, [renamed], member.publicKey, LATER);
    expect(applied).toBe(1);
    const stored = getCommunity(memberDb.adapter, genesis.descriptor.communityId)!;
    expect(communityLayout(stored.descriptor)).toBe('chat_first');
    expect(communityCategories(stored.descriptor)).toEqual([]);
    expect(orderedChannels(stored.descriptor).map((c) => c.id)).toEqual(['general']);
    expect(stored.descriptor.categories).toBeUndefined();
  });
});
