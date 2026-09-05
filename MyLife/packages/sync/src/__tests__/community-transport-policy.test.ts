/**
 * Community transport policy, P0 protocol (Plan 27): the owner-signed
 * `transportPolicy` descriptor field + fail-restrictive parsing + the
 * owner-only policy revision + the allow-map other plans consume.
 *
 * The policy is a PROTOCOL property, not UI copy (NC-1): it rides the signed
 * canonical tuple (tamper = signature failure), absent means `any`
 * (grandfathered legacy communities, AC-6), an UNKNOWN value fails RESTRICTIVE
 * to `local_only`, and the monotonic upsert guard makes a rollback to an older
 * relaxed revision impossible (AC-3). BLE is never a data path under any
 * policy (NC-2).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import {
  communityTransportPolicy,
  configureSyncSecretStore,
  createInMemorySyncSecretStore,
  revisePolicy,
  transportAllowedForCommunity,
  transportPolicyAllows,
  type CommunityTransportPolicy,
} from '../index';
import { generateDeviceIdentity } from '../identity/device-identity';
import { createSyncTables } from '../db/schema';
import {
  createCommunity,
  getCommunity,
  upsertCommunity,
  verifyCommunityDescriptor,
  verifyDescriptorOwnerSignature,
  type CommunityDescriptor,
  type SignedCommunityDescriptor,
} from '../protocol/community';
import { applyGossipedDescriptors } from '../protocol/descriptor-gossip';
import type { SyncTransport } from '../types';

const NOW = '2026-07-02T00:00:00.000Z';
const LATER = '2026-07-02T01:00:00.000Z';

beforeEach(() => configureSyncSecretStore(createInMemorySyncSecretStore()));

type Identity = ReturnType<typeof generateDeviceIdentity>;

function freshDb(): InMemoryTestDatabase {
  const db = createInMemoryTestDatabase();
  createSyncTables(db.adapter);
  return db;
}

function found(owner: Identity, transportPolicy?: CommunityTransportPolicy): SignedCommunityDescriptor {
  return createCommunity(owner, {
    name: 'Block Club',
    channels: [{ id: 'general', name: 'general' }],
    ...(transportPolicy ? { transportPolicy } : {}),
    now: NOW,
  });
}

describe('communityTransportPolicy accessor (fail-restrictive parse)', () => {
  it('reads an absent field as any (grandfathered legacy descriptors, AC-6)', () => {
    const owner = generateDeviceIdentity('Owner');
    const community = found(owner);
    expect(community.descriptor.transportPolicy).toBeUndefined();
    expect(communityTransportPolicy(community.descriptor)).toBe('any');
  });

  it('round-trips each explicit policy through createCommunity', () => {
    const owner = generateDeviceIdentity('Owner');
    for (const policy of ['local_only', 'local_preferred', 'any'] as const) {
      const community = found(owner, policy);
      expect(communityTransportPolicy(community.descriptor)).toBe(policy);
      expect(verifyDescriptorOwnerSignature(community)).toBe(true);
    }
  });

  it('fails RESTRICTIVE on an unknown value: local_only, never any', () => {
    const owner = generateDeviceIdentity('Owner');
    const community = found(owner);
    const forged = {
      ...community.descriptor,
      transportPolicy: 'totally_open_v99',
    } as unknown as CommunityDescriptor;
    expect(communityTransportPolicy(forged)).toBe('local_only');
  });
});

describe('the signature covers the policy field', () => {
  it('tampering the policy of a signed descriptor breaks the owner signature', () => {
    const owner = generateDeviceIdentity('Owner');
    const community = found(owner, 'local_only');

    const relaxed: SignedCommunityDescriptor = {
      descriptor: { ...community.descriptor, transportPolicy: 'any' },
      signature: community.signature,
    };
    expect(verifyDescriptorOwnerSignature(relaxed)).toBe(false);

    const stripped = { ...community.descriptor };
    delete (stripped as { transportPolicy?: unknown }).transportPolicy;
    expect(verifyDescriptorOwnerSignature({ descriptor: stripped, signature: community.signature }))
      .toBe(false);
  });

  it('absent and explicit any are canonically the SAME (the grandfather equivalence)', () => {
    const owner = generateDeviceIdentity('Owner');
    const community = found(owner, 'any');
    const withoutField = { ...community.descriptor };
    delete (withoutField as { transportPolicy?: unknown }).transportPolicy;
    // Same canonical bytes -> the signature still verifies with the field absent.
    expect(verifyDescriptorOwnerSignature({ descriptor: withoutField, signature: community.signature }))
      .toBe(true);
  });
});

describe('revisePolicy (owner-only signed policy change)', () => {
  it('produces a chained next revision carrying the new policy', () => {
    const owner = generateDeviceIdentity('Owner');
    const community = found(owner);
    const revised = revisePolicy(owner, community, 'local_only', LATER);

    expect(revised.descriptor.revision).toBe(community.descriptor.revision + 1);
    expect(communityTransportPolicy(revised.descriptor)).toBe('local_only');
    expect(verifyCommunityDescriptor(revised, community)).toBe(true);
  });

  it('a non-owner cannot sign a policy change (throws)', () => {
    const owner = generateDeviceIdentity('Owner');
    const mallory = generateDeviceIdentity('Mallory');
    const community = found(owner);
    expect(() => revisePolicy(mallory, community, 'any', LATER)).toThrow();
  });
});

describe('rollback to a relaxed older revision is impossible (AC-3)', () => {
  it('the monotonic store guard and gossip both reject the replayed relaxed predecessor', () => {
    const owner = generateDeviceIdentity('Owner');
    const member = generateDeviceIdentity('Member');
    const community = found(owner); // rev 1, absent -> any
    const hardened = revisePolicy(owner, community, 'local_only', LATER); // rev 2

    const db = freshDb();
    upsertCommunity(db.adapter, community, member.publicKey, NOW);
    upsertCommunity(db.adapter, hardened, member.publicKey, LATER);
    expect(communityTransportPolicy(getCommunity(db.adapter, community.descriptor.communityId)!.descriptor))
      .toBe('local_only');

    // Replaying the RELAXED rev 1 (store + gossip) must not reopen the policy.
    upsertCommunity(db.adapter, community, member.publicKey, LATER);
    expect(applyGossipedDescriptors(db.adapter, [community], member.publicKey, LATER)).toBe(0);
    const stored = getCommunity(db.adapter, community.descriptor.communityId)!;
    expect(stored.descriptor.revision).toBe(hardened.descriptor.revision);
    expect(communityTransportPolicy(stored.descriptor)).toBe('local_only');
  });
});

describe('transportPolicyAllows / transportAllowedForCommunity (the Plan 29 seam)', () => {
  const ALL: SyncTransport[] = ['lan', 'nearby', 'ble', 'wan_webrtc', 'wan_relay'];

  it('local_only permits ONLY lan + nearby; BLE is never a data path (NC-2)', () => {
    const allowed = ALL.filter((t) => transportPolicyAllows('local_only', t));
    expect(allowed.sort()).toEqual(['lan', 'nearby']);
    for (const policy of ['local_only', 'local_preferred', 'any'] as const) {
      expect(transportPolicyAllows(policy, 'ble')).toBe(false);
    }
  });

  it('local_preferred and any permit every DATA transport', () => {
    for (const policy of ['local_preferred', 'any'] as const) {
      const allowed = ALL.filter((t) => transportPolicyAllows(policy, t));
      expect(allowed.sort()).toEqual(['lan', 'nearby', 'wan_relay', 'wan_webrtc']);
    }
  });

  it('resolves a stored community by id, fails closed on an unknown one', () => {
    const owner = generateDeviceIdentity('Owner');
    const db = freshDb();
    const hard = found(owner, 'local_only');
    const legacy = found(owner); // absent -> any
    upsertCommunity(db.adapter, hard, owner.publicKey, NOW);
    upsertCommunity(db.adapter, legacy, owner.publicKey, NOW);

    expect(transportAllowedForCommunity(db.adapter, hard.descriptor.communityId, 'wan_relay')).toBe(false);
    expect(transportAllowedForCommunity(db.adapter, hard.descriptor.communityId, 'lan')).toBe(true);
    // Legacy (absent field) behaves exactly as today: relay allowed (AC-6).
    expect(transportAllowedForCommunity(db.adapter, legacy.descriptor.communityId, 'wan_relay')).toBe(true);
    // Unknown community: fail closed.
    expect(transportAllowedForCommunity(db.adapter, 'no-such-community', 'lan')).toBe(false);
  });
});
