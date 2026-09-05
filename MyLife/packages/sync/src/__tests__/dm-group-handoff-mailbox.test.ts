/**
 * Group DM epoch handoff mailbox (Plan 21 Phase 6).
 *
 * - Per-member handoff round-trip: the admin seals a DM_GROUP_COMMIT for a member
 *   over the pure mailbox path; the member opens + applies it and ends up holding
 *   the SAME current epoch key the admin minted.
 * - Poison defense: a handoff whose wrap is addressed to ANOTHER device does not
 *   advance my key version (I get no readable epoch).
 * - Fast-forward defense: a self-addressed but UNOPENABLE wrap for a bogus high
 *   epoch does not advance my epoch pointer (storeReceivedKeyWrap guards it).
 * - Fail-closed open: a descriptor signed by someone other than the envelope
 *   sender is rejected; a handoff opened by the WRONG recipient is rejected.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import type { SyncWorkspaceKeyWrap } from '../types';
import { generateDeviceIdentity } from '../identity/device-identity';
import { createSyncTables } from '../db/schema';
import { getKeyWraps, getPinnedIdentity, getWorkspace, getWorkspaceMembers } from '../db/queries';
import {
  getCurrentEpochKey,
  getWorkspaceEpoch,
  keyWrapToSyncedRow,
} from '../protocol/group-keys';
import { createSignedIdentityBundle } from '../protocol/identity-bundle';
import {
  createDmGroup,
  createDmGroupDescriptor,
  type DmGroupMember,
  type SignedDmGroupDescriptor,
} from '../protocol/dm-group';
import {
  openDmGroupCommit,
  sealDmGroupCommit,
  type DmGroupCommitRecipient,
} from '../protocol/dm-group-handoff-mailbox';
import { applyDmGroupCommit } from '../protocol/dm-group-handoff-core';

type Identity = ReturnType<typeof generateDeviceIdentity>;
const member = (id: Identity, role: DmGroupMember['role'] = 'member'): DmGroupMember => ({
  deviceId: id.publicKey, dhPublicKey: id.dhPublicKey, role,
});

function freshDb(): InMemoryTestDatabase {
  const db = createInMemoryTestDatabase();
  createSyncTables(db.adapter);
  return db;
}

/** The wrap rows addressed to `deviceId` for `epoch` on the admin's db. */
function wrapsFor(adminDb: InMemoryTestDatabase, cid: string, epoch: number, deviceId: string): SyncWorkspaceKeyWrap[] {
  return getKeyWraps(adminDb.adapter, cid, epoch).filter((w) => w.wrappedForDeviceId === deviceId);
}

describe('dm_group commit handoff round-trip', () => {
  let adminDb: InMemoryTestDatabase;
  let bDb: InMemoryTestDatabase;
  beforeEach(() => { adminDb = freshDb(); bDb = freshDb(); });
  afterEach(() => { adminDb.close(); bDb.close(); });

  it('a member opens + applies its sealed handoff and holds the epoch key', () => {
    const admin = generateDeviceIdentity('Admin');
    const b = generateDeviceIdentity('Bea');
    const { descriptor, commit, conversationId } = createDmGroup(adminDb.adapter, {
      admin, title: 'Trip crew', members: [member(b)],
    });

    const recipient: DmGroupCommitRecipient = {
      deviceId: b.publicKey,
      dhPublicKey: b.dhPublicKey,
      keyWraps: wrapsFor(adminDb, conversationId, commit.epoch, b.publicKey),
    };
    const sealed = sealDmGroupCommit({
      admin,
      conversationId,
      descriptor,
      adminBundle: createSignedIdentityBundle(admin),
      recipients: [recipient],
    });
    expect(sealed).toHaveLength(1);
    expect(sealed[0]!.recipientDeviceId).toBe(b.publicKey);

    // B opens its handoff over the pure mailbox path.
    const opened = openDmGroupCommit(b, sealed[0]!.envelope);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.senderDeviceId).toBe(admin.publicKey);
    expect(opened.payload.conversationId).toBe(conversationId);

    // B applies it: bridges the workspace, stores its wrap, pins the admin.
    const handler = applyDmGroupCommit({ db: bDb.adapter, self: b });
    const applied = handler.dmGroupCommit!(opened.senderDeviceId, opened.payload, opened.createdAt);
    expect(applied).toBe(true);

    // B now holds the SAME epoch-1 key the admin minted.
    const key = getCurrentEpochKey(bDb.adapter, conversationId, b);
    expect(key?.epoch).toBe(1);
    expect(key?.secret).toEqual(commit.secret);
  });

  it('the WRONG recipient cannot open a handoff sealed for someone else', () => {
    const admin = generateDeviceIdentity('Admin');
    const b = generateDeviceIdentity('Bea');
    const stranger = generateDeviceIdentity('Stranger');
    const { descriptor, commit, conversationId } = createDmGroup(adminDb.adapter, {
      admin, title: 'Trip crew', members: [member(b)],
    });
    const sealed = sealDmGroupCommit({
      admin, conversationId, descriptor, adminBundle: createSignedIdentityBundle(admin),
      recipients: [{ deviceId: b.publicKey, dhPublicKey: b.dhPublicKey, keyWraps: wrapsFor(adminDb, conversationId, commit.epoch, b.publicKey) }],
    });
    const opened = openDmGroupCommit(stranger, sealed[0]!.envelope);
    expect(opened.ok).toBe(false);
  });

  it('a descriptor signed by someone other than the envelope sender is rejected', () => {
    const admin = generateDeviceIdentity('Admin');
    const b = generateDeviceIdentity('Bea');
    const other = generateDeviceIdentity('Other');
    const { commit, conversationId } = createDmGroup(adminDb.adapter, {
      admin, title: 'Trip crew', members: [member(b)],
    });
    // A descriptor validly signed by `other` (adminDeviceId = other), but the
    // envelope is signed by `admin`: the sender/admin binding must fail.
    const foreignDescriptor: SignedDmGroupDescriptor = createDmGroupDescriptor(other, {
      conversationId, title: 'Trip crew', epoch: commit.epoch, members: [member(admin, 'admin'), member(b)],
    });
    const sealed = sealDmGroupCommit({
      admin, conversationId, descriptor: foreignDescriptor, adminBundle: createSignedIdentityBundle(admin),
      recipients: [{ deviceId: b.publicKey, dhPublicKey: b.dhPublicKey, keyWraps: wrapsFor(adminDb, conversationId, commit.epoch, b.publicKey) }],
    });
    const opened = openDmGroupCommit(b, sealed[0]!.envelope);
    expect(opened.ok).toBe(false);
    if (!opened.ok) expect(opened.reason).toBe('wrong_sender');
  });
});

describe('dm_group commit apply: poison + fast-forward defenses', () => {
  let adminDb: InMemoryTestDatabase;
  let bDb: InMemoryTestDatabase;
  beforeEach(() => { adminDb = freshDb(); bDb = freshDb(); });
  afterEach(() => { adminDb.close(); bDb.close(); });

  it('a wrap addressed to ANOTHER device does not advance my key version', () => {
    const admin = generateDeviceIdentity('Admin');
    const b = generateDeviceIdentity('Bea');
    const attacker = generateDeviceIdentity('Attacker');
    const { descriptor, conversationId } = createDmGroup(adminDb.adapter, {
      admin, title: 'Trip crew', members: [member(b)],
    });

    // A handoff to B that carries ONLY a foreign wrap (addressed to the attacker
    // at a huge epoch). B is a listed member, so apply proceeds, but the foreign
    // wrap must never advance B's pointer.
    const foreignWrap: SyncWorkspaceKeyWrap = {
      workspaceId: conversationId, keyVersion: 999_999, wrappedForDeviceId: attacker.publicKey,
      wrappedKeyBlob: new Uint8Array(80), validFrom: '2026-07-01T00:00:00.000Z', validUntil: null,
    };
    const sealed = sealDmGroupCommit({
      admin, conversationId, descriptor, adminBundle: createSignedIdentityBundle(admin),
      recipients: [{ deviceId: b.publicKey, dhPublicKey: b.dhPublicKey, keyWraps: [foreignWrap] }],
    });
    const opened = openDmGroupCommit(b, sealed[0]!.envelope);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;

    const handler = applyDmGroupCommit({ db: bDb.adapter, self: b });
    const applied = handler.dmGroupCommit!(opened.senderDeviceId, opened.payload, opened.createdAt);
    // No readable epoch was gained.
    expect(applied).toBe(false);
    expect(getWorkspaceEpoch(bDb.adapter, conversationId)).toBe(0);
    expect(getCurrentEpochKey(bDb.adapter, conversationId, b)).toBeNull();
  });

  it('a self-addressed but UNOPENABLE bogus-epoch wrap does not advance my pointer', () => {
    const admin = generateDeviceIdentity('Admin');
    const b = generateDeviceIdentity('Bea');
    const { descriptor, conversationId } = createDmGroup(adminDb.adapter, {
      admin, title: 'Trip crew', members: [member(b)],
    });

    const garbageSelfWrap: SyncWorkspaceKeyWrap = {
      workspaceId: conversationId, keyVersion: 999, wrappedForDeviceId: b.publicKey,
      wrappedKeyBlob: new Uint8Array(80), validFrom: '2026-07-01T00:00:00.000Z', validUntil: null,
    };
    const sealed = sealDmGroupCommit({
      admin, conversationId, descriptor, adminBundle: createSignedIdentityBundle(admin),
      recipients: [{ deviceId: b.publicKey, dhPublicKey: b.dhPublicKey, keyWraps: [garbageSelfWrap] }],
    });
    const opened = openDmGroupCommit(b, sealed[0]!.envelope);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;

    const handler = applyDmGroupCommit({ db: bDb.adapter, self: b });
    handler.dmGroupCommit!(opened.senderDeviceId, opened.payload, opened.createdAt);
    // The unopenable self-wrap was stored but never advanced the epoch.
    expect(getWorkspaceEpoch(bDb.adapter, conversationId)).toBe(0);
    expect(getCurrentEpochKey(bDb.adapter, conversationId, b)).toBeNull();
    // Sanity: keyWrapToSyncedRow round-trips the row (the wire form the payload carried).
    expect(keyWrapToSyncedRow(garbageSelfWrap).wrapped_for_device_id).toBe(b.publicKey);
  });

  it('AM4: a valid-but-unopenable envelope leaves ZERO state (no workspace, roster, or pin)', () => {
    const admin = generateDeviceIdentity('Admin');
    const b = generateDeviceIdentity('Bea');
    const { descriptor, conversationId } = createDmGroup(adminDb.adapter, {
      admin, title: 'Trip crew', members: [member(b)],
    });

    // A well-formed, correctly-signed handoff (B is a listed member, the sender
    // is the admin) whose only self-addressed wrap does NOT open with B's DH key.
    const unopenableSelfWrap: SyncWorkspaceKeyWrap = {
      workspaceId: conversationId, keyVersion: 1, wrappedForDeviceId: b.publicKey,
      wrappedKeyBlob: new Uint8Array(80), validFrom: '2026-07-01T00:00:00.000Z', validUntil: null,
    };
    const sealed = sealDmGroupCommit({
      admin, conversationId, descriptor, adminBundle: createSignedIdentityBundle(admin),
      recipients: [{ deviceId: b.publicKey, dhPublicKey: b.dhPublicKey, keyWraps: [unopenableSelfWrap] }],
    });
    const opened = openDmGroupCommit(b, sealed[0]!.envelope);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;

    const handler = applyDmGroupCommit({ db: bDb.adapter, self: b });
    expect(handler.dmGroupCommit!(opened.senderDeviceId, opened.payload, opened.createdAt)).toBe(false);

    // Pre-validation happened BEFORE any write: nothing was bridged or pinned.
    expect(getWorkspace(bDb.adapter, conversationId)).toBeNull();
    expect(getWorkspaceMembers(bDb.adapter, conversationId)).toHaveLength(0);
    expect(getPinnedIdentity(bDb.adapter, admin.publicKey)).toBeNull();
    expect(getKeyWraps(bDb.adapter, conversationId, 1)).toHaveLength(0);
  });
});
