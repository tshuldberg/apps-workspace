/**
 * Plan 27 P4: the LOCAL observed transport-policy ledger + change notice.
 *
 * A ledger point is written only AFTER a real owner-signed descriptor was already
 * adopted, so it never fabricates a change. Proves: baseline seed on first sight,
 * a real change row on a policy revision, idempotent reconcile (no duplicate rows
 * per revision), and the honest notice string.
 */

import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import {
  createCommunity,
  createSyncTables,
  generateDeviceIdentity,
  revisePolicy,
  upsertCommunity,
  configureSyncSecretStore,
  createInMemorySyncSecretStore,
  type SignedCommunityDescriptor,
} from '@mylife/sync';
import {
  ensureCommunityTables,
  formatPolicyChangeNotice,
  getLatestPolicyChange,
  listCommunityPolicyHistory,
  reconcileCommunityPolicyHistory,
  recordCommunityPolicyPoint,
  TRANSPORT_POLICY_LABELS,
} from '../(root)/data/community-core';

const NOW = '2026-07-05T00:00:00.000Z';
const LATER = '2026-07-06T00:00:00.000Z';
type Identity = ReturnType<typeof generateDeviceIdentity>;

let db: InMemoryTestDatabase;
beforeEach(() => {
  configureSyncSecretStore(createInMemorySyncSecretStore());
  db = createInMemoryTestDatabase();
  createSyncTables(db.adapter);
  ensureCommunityTables(db.adapter);
});
afterEach(() => db.close());

function store(owner: Identity, signed: SignedCommunityDescriptor): void {
  upsertCommunity(db.adapter, signed, owner.publicKey, NOW);
}

describe('community policy history (Plan 27 P4)', () => {
  it('seeds a baseline point (no previous) the first time a community is observed', () => {
    const owner = generateDeviceIdentity('Owner');
    const signed = createCommunity(owner, { name: 'Club', transportPolicy: 'local_only', now: NOW });
    store(owner, signed);

    expect(recordCommunityPolicyPoint(db.adapter, signed.descriptor.communityId, NOW)).toBe(true);
    const history = listCommunityPolicyHistory(db.adapter, signed.descriptor.communityId);
    expect(history).toHaveLength(1);
    expect(history[0].policy).toBe('local_only');
    expect(history[0].previousPolicy).toBeNull();
    expect(getLatestPolicyChange(db.adapter, signed.descriptor.communityId)).toBeNull();
  });

  it('records a real change when the owner revises the policy', () => {
    const owner = generateDeviceIdentity('Owner');
    const signed = createCommunity(owner, { name: 'Club', transportPolicy: 'local_only', now: NOW });
    store(owner, signed);
    recordCommunityPolicyPoint(db.adapter, signed.descriptor.communityId, NOW);

    const revised = revisePolicy(owner, signed, 'any', LATER);
    store(owner, revised);
    expect(recordCommunityPolicyPoint(db.adapter, signed.descriptor.communityId, LATER)).toBe(true);

    const change = getLatestPolicyChange(db.adapter, signed.descriptor.communityId);
    expect(change).not.toBeNull();
    expect(change!.previousPolicy).toBe('local_only');
    expect(change!.policy).toBe('any');
    expect(formatPolicyChangeNotice(change!)).toBe(
      `The owner changed the sync policy from ${TRANSPORT_POLICY_LABELS.local_only} to ${TRANSPORT_POLICY_LABELS.any}.`,
    );
  });

  it('is idempotent per revision: reconcile twice never duplicates rows', () => {
    const owner = generateDeviceIdentity('Owner');
    const signed = createCommunity(owner, { name: 'Club', transportPolicy: 'local_preferred', now: NOW });
    store(owner, signed);

    expect(reconcileCommunityPolicyHistory(db.adapter, NOW)).toBe(1);
    expect(reconcileCommunityPolicyHistory(db.adapter, NOW)).toBe(0);
    expect(listCommunityPolicyHistory(db.adapter, signed.descriptor.communityId)).toHaveLength(1);
  });

  it('a legacy (absent policy) community records an `any` baseline (AC-6)', () => {
    const owner = generateDeviceIdentity('Owner');
    const signed = createCommunity(owner, { name: 'Legacy', now: NOW });
    store(owner, signed);
    reconcileCommunityPolicyHistory(db.adapter, NOW);
    expect(listCommunityPolicyHistory(db.adapter, signed.descriptor.communityId)[0].policy).toBe('any');
  });

  it('records only the DELTA across a two-step tighten then relax', () => {
    const owner = generateDeviceIdentity('Owner');
    const signed = createCommunity(owner, { name: 'Club', transportPolicy: 'any', now: NOW });
    store(owner, signed);
    reconcileCommunityPolicyHistory(db.adapter, NOW);

    const tightened = revisePolicy(owner, signed, 'local_only', LATER);
    store(owner, tightened);
    reconcileCommunityPolicyHistory(db.adapter, LATER);

    const relaxed = revisePolicy(owner, tightened, 'local_preferred', '2026-07-07T00:00:00.000Z');
    store(owner, relaxed);
    reconcileCommunityPolicyHistory(db.adapter, '2026-07-07T00:00:00.000Z');

    const history = listCommunityPolicyHistory(db.adapter, signed.descriptor.communityId);
    expect(history.map((r) => r.policy)).toEqual(['local_preferred', 'local_only', 'any']);
    expect(history.map((r) => r.previousPolicy)).toEqual(['local_only', 'any', null]);
  });
});
