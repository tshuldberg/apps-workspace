/**
 * Group DM epoch backing (Plan 21 Phase 6, unit layer).
 *
 * - Descriptor sign/verify, admin-only (a non-admin signature is rejected), and
 *   cross-domain isolation (a channel/dm-message signature cannot masquerade).
 * - create / add / remove produce REAL epoch commits (epoch increments, the
 *   secret changes), and a removed device CANNOT unwrap epoch N+1 (forward
 *   secrecy from removal).
 * - NC-9 (metadata no-leak): a create/add/remove leaves the syncable
 *   `communitykeys` change count UNCHANGED -- the load-bearing proof that dm_group
 *   key wraps never enter the change log and never replicate.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import type { ModuleSyncPolicy } from '@mylife/module-registry/types';
import { generateDeviceIdentity } from '../identity/device-identity';
import { createSyncTables } from '../db/schema';
import { createWorkspace, getWorkspace, getWorkspaceMembers } from '../db/queries';
import { ChangeTracker } from '../crdt/change-tracker';
import {
  createGroupCommit,
  getCurrentEpochKey,
  unwrapEpochSecret,
  type GroupMemberKey,
} from '../protocol/group-keys';
import {
  createDmGroup,
  createDmGroupDescriptor,
  dmGroupAdd,
  dmGroupRemove,
  verifyDmGroupDescriptor,
  type DmGroupMember,
  type SignedDmGroupDescriptor,
} from '../protocol/dm-group';
import { createDmMessage, verifyDmMessage } from '../protocol/dm-message';
import {
  decryptDmGroupEvents,
  openDmGroup,
  sealDmGroup,
} from '../protocol/dm-mailbox';

type Identity = ReturnType<typeof generateDeviceIdentity>;
const member = (id: Identity, role: DmGroupMember['role'] = 'member'): DmGroupMember => ({
  deviceId: id.publicKey,
  dhPublicKey: id.dhPublicKey,
  role,
});

function freshDb(): InMemoryTestDatabase {
  const db = createInMemoryTestDatabase();
  createSyncTables(db.adapter);
  return db;
}

describe('SignedDmGroupDescriptor sign + verify (admin authority, cross-domain isolation)', () => {
  it('a descriptor the admin signed verifies', () => {
    const admin = generateDeviceIdentity('Admin');
    const b = generateDeviceIdentity('Bea');
    const descriptor = createDmGroupDescriptor(admin, {
      conversationId: 'abcd1234',
      title: 'Trip crew',
      epoch: 1,
      members: [member(admin, 'admin'), member(b)],
    });
    expect(descriptor.adminDeviceId).toBe(admin.publicKey);
    expect(verifyDmGroupDescriptor(descriptor)).toBe(true);
  });

  it('rejects a non-admin signature (only the admin may sign membership)', () => {
    const admin = generateDeviceIdentity('Admin');
    const impostor = generateDeviceIdentity('Impostor');
    // impostor signs a descriptor that CLAIMS the admin as adminDeviceId.
    const forged: SignedDmGroupDescriptor = {
      ...createDmGroupDescriptor(impostor, {
        conversationId: 'abcd1234',
        title: 'Trip crew',
        epoch: 1,
        members: [member(admin, 'admin')],
      }),
      adminDeviceId: admin.publicKey,
    };
    expect(verifyDmGroupDescriptor(forged)).toBe(false);
  });

  it('rejects a tampered field (signature no longer covers it)', () => {
    const admin = generateDeviceIdentity('Admin');
    const descriptor = createDmGroupDescriptor(admin, {
      conversationId: 'abcd1234', title: 'Trip crew', epoch: 1, members: [member(admin, 'admin')],
    });
    expect(verifyDmGroupDescriptor({ ...descriptor, title: 'Hijacked' })).toBe(false);
    expect(verifyDmGroupDescriptor({ ...descriptor, epoch: 99 })).toBe(false);
  });

  it('a DM-message signature cannot cross-verify as a descriptor (distinct domain)', () => {
    const admin = generateDeviceIdentity('Admin');
    const dm = createDmMessage(admin, {
      conversationId: 'abcd1234',
      body: 'not a descriptor',
      hlc: { wall: '2026-07-01T00:00:00.000Z', counter: 0 },
    });
    // Graft the DM signature onto a descriptor shell: it must not verify.
    const descriptor: SignedDmGroupDescriptor = {
      version: 1,
      conversationId: 'abcd1234',
      title: 'x',
      adminDeviceId: admin.publicKey,
      epoch: 1,
      members: [member(admin, 'admin')],
      createdAt: '2026-07-01T00:00:00.000Z',
      signature: dm.signature,
    };
    expect(verifyDmGroupDescriptor(descriptor)).toBe(false);
  });
});

describe('createDmGroup / dmGroupAdd / dmGroupRemove are REAL epoch commits', () => {
  let db: InMemoryTestDatabase;
  beforeEach(() => { db = freshDb(); });
  afterEach(() => { db.close(); });

  it('create mints epoch 1 wrapped for every member; the workspace is dm_group', () => {
    const admin = generateDeviceIdentity('Admin');
    const b = generateDeviceIdentity('Bea');
    const c = generateDeviceIdentity('Cal');
    const { descriptor, commit, conversationId } = createDmGroup(db.adapter, {
      admin, title: 'Trip crew', members: [member(b), member(c)],
    });

    expect(commit.epoch).toBe(1);
    expect(descriptor.epoch).toBe(1);
    expect(verifyDmGroupDescriptor(descriptor)).toBe(true);
    const ws = getWorkspace(db.adapter, conversationId)!;
    expect(ws.workspaceType).toBe('dm_group');
    // Every member (admin + b + c) can unwrap the SAME epoch-1 secret.
    for (const id of [admin, b, c]) {
      expect(unwrapEpochSecret(db.adapter, conversationId, 1, id)).toEqual(commit.secret);
    }
    expect(getWorkspaceMembers(db.adapter, conversationId).map((m) => m.deviceId).sort())
      .toEqual([admin.publicKey, b.publicKey, c.publicKey].sort());
  });

  it('add advances the epoch and grants ONLY the new epoch under join_point', () => {
    const admin = generateDeviceIdentity('Admin');
    const b = generateDeviceIdentity('Bea');
    const newbie = generateDeviceIdentity('Newbie');
    const created = createDmGroup(db.adapter, { admin, title: 'Trip crew', members: [member(b)] });

    const added = dmGroupAdd(db.adapter, { admin, descriptor: created.descriptor, added: member(newbie) });
    expect(added.commit.epoch).toBe(2);
    expect(added.commit.secret).not.toEqual(created.commit.secret);
    expect(added.descriptor.epoch).toBe(2);
    expect(added.descriptor.members.some((m) => m.deviceId === newbie.publicKey)).toBe(true);

    const cid = created.conversationId;
    // Newbie reads epoch 2 (join_point default), but NOT epoch 1 history.
    expect(unwrapEpochSecret(db.adapter, cid, 2, newbie)).toEqual(added.commit.secret);
    expect(unwrapEpochSecret(db.adapter, cid, 1, newbie)).toBeNull();
  });

  it('remove mints an epoch the removed device cannot unwrap (forward secrecy)', () => {
    const admin = generateDeviceIdentity('Admin');
    const keep = generateDeviceIdentity('Keep');
    const lost = generateDeviceIdentity('Lost');
    const created = createDmGroup(db.adapter, { admin, title: 'Trip crew', members: [member(keep), member(lost)] });
    const cid = created.conversationId;
    // Epoch 1: the soon-removed device CAN unwrap.
    expect(unwrapEpochSecret(db.adapter, cid, 1, lost)).toEqual(created.commit.secret);

    const removed = dmGroupRemove(db.adapter, { admin, descriptor: created.descriptor, removedDeviceId: lost.publicKey });
    expect(removed.commit.epoch).toBe(2);
    expect(removed.commit.secret).not.toEqual(created.commit.secret);
    expect(removed.descriptor.members.some((m) => m.deviceId === lost.publicKey)).toBe(false);

    // The removed device holds NO wrap for epoch 2; survivors do.
    expect(unwrapEpochSecret(db.adapter, cid, 2, lost)).toBeNull();
    expect(unwrapEpochSecret(db.adapter, cid, 2, keep)).toEqual(removed.commit.secret);
    expect(unwrapEpochSecret(db.adapter, cid, 2, admin)).toEqual(removed.commit.secret);
  });

  it('a non-admin cannot add or remove (throws)', () => {
    const admin = generateDeviceIdentity('Admin');
    const b = generateDeviceIdentity('Bea');
    const stranger = generateDeviceIdentity('Stranger');
    const created = createDmGroup(db.adapter, { admin, title: 'Trip crew', members: [member(b)] });
    expect(() => dmGroupAdd(db.adapter, { admin: stranger, descriptor: created.descriptor, added: member(stranger) })).toThrow();
    expect(() => dmGroupRemove(db.adapter, { admin: b, descriptor: created.descriptor, removedDeviceId: admin.publicKey })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// NC-9: the load-bearing metadata no-leak proof.
// ---------------------------------------------------------------------------

// Minimal communitykeys policy: sync_workspace_keys replicates at shared_workspace
// scope (mirrors the shipped KEYS_SYNC_POLICY). A dm_group commit must add ZERO
// rows for this module -- because it passes NO recordChange.
const KEYS_POLICY: ModuleSyncPolicy = {
  defaultScope: 'shared_workspace',
  shareable: true,
  entityRules: [
    { tableName: 'sync_workspace_keys', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'or_set' },
  ],
};
const PREFIXES = new Map<string, string>([['communitykeys', 'sync_workspace_keys']]);

describe('NC-9: dm_group commits write ZERO syncable communitykeys rows', () => {
  let db: InMemoryTestDatabase;
  let tracker: ChangeTracker;
  beforeEach(() => {
    db = freshDb();
    tracker = new ChangeTracker({
      db: db.adapter,
      deviceId: 'device-local',
      modulePrefixes: PREFIXES,
      modulePolicies: new Map([['communitykeys', KEYS_POLICY]]),
    });
  });
  afterEach(() => { db.close(); });

  it('positive control: a commit WITH recordChange DOES record communitykeys rows', () => {
    const admin = generateDeviceIdentity('Admin');
    const b = generateDeviceIdentity('Bea');
    // A normal COMMUNITY workspace commit passing the tracker's recordChange.
    createWorkspace(db.adapter, {
      id: 'community-ws', displayName: 'Community', workspaceType: 'community', createdByDeviceId: admin.publicKey,
      createdAt: '2026-07-01T00:00:00.000Z', rotatedAt: null, currentKeyVersion: 0, archivedAt: null,
    });
    const before = tracker.getUnsyncedByModule('communitykeys').length;
    createGroupCommit(db.adapter, {
      workspaceId: 'community-ws',
      committer: admin,
      members: [admin, b].map((id): GroupMemberKey => ({ deviceId: id.publicKey, dhPublicKey: id.dhPublicKey })),
      recordChange: (t, op, rowId, data) => tracker.recordChange(t, op, rowId, data),
    });
    // The tracker WOULD catch a leak: recorded rows appear for communitykeys.
    expect(tracker.getUnsyncedByModule('communitykeys').length).toBeGreaterThan(before);
  });

  it('create + add + remove leave the communitykeys change count UNCHANGED', () => {
    const admin = generateDeviceIdentity('Admin');
    const b = generateDeviceIdentity('Bea');
    const c = generateDeviceIdentity('Cal');
    const newbie = generateDeviceIdentity('Newbie');

    const baseline = tracker.getUnsyncedByModule('communitykeys').length;

    const created = createDmGroup(db.adapter, { admin, title: 'Trip crew', members: [member(b), member(c)] });
    expect(tracker.getUnsyncedByModule('communitykeys').length).toBe(baseline);

    const added = dmGroupAdd(db.adapter, { admin, descriptor: created.descriptor, added: member(newbie) });
    expect(tracker.getUnsyncedByModule('communitykeys').length).toBe(baseline);

    dmGroupRemove(db.adapter, { admin, descriptor: added.descriptor, removedDeviceId: c.publicKey });
    expect(tracker.getUnsyncedByModule('communitykeys').length).toBe(baseline);
  });
});

// ---------------------------------------------------------------------------
// Group MESSAGE seal/open under the epoch content key (the confidentiality layer).
// ---------------------------------------------------------------------------

describe('sealDmGroup / openDmGroup: epoch-content-key confidentiality', () => {
  let db: InMemoryTestDatabase;
  beforeEach(() => { db = freshDb(); });
  afterEach(() => { db.close(); });

  it('a member decrypts a group message sealed under the current epoch', () => {
    const admin = generateDeviceIdentity('Admin');
    const b = generateDeviceIdentity('Bea');
    const { conversationId, commit } = createDmGroup(db.adapter, {
      admin, title: 'Trip crew', members: [member(b)],
    });
    const epochKey = getCurrentEpochKey(db.adapter, conversationId, admin)!;
    expect(epochKey.secret).toEqual(commit.secret);

    const message = createDmMessage(admin, {
      conversationId, body: 'dinner at 8?', hlc: { wall: '2026-07-01T00:00:00.000Z', counter: 0 },
    });
    const sealed = sealDmGroup({
      sender: admin,
      conversationId,
      epoch: epochKey.epoch,
      epochSecret: epochKey.secret,
      events: [message],
      recipients: [{ deviceId: b.publicKey, dhPublicKey: b.dhPublicKey, pairSecret: 'ab'.repeat(32) }],
    });
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;

    // B unwraps its own epoch secret, then opens the group delta.
    const bSecret = unwrapEpochSecret(db.adapter, conversationId, epochKey.epoch, b)!;
    const opened = openDmGroup(b, sealed.sealed[0]!.envelope, bSecret);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.events).toHaveLength(1);
    expect(opened.events[0]!.body).toBe('dinner at 8?');
    expect(verifyDmMessage(opened.events[0]!)).toBe(true);
  });

  it('a device without the epoch secret cannot decrypt the events (unreadable)', () => {
    const admin = generateDeviceIdentity('Admin');
    const b = generateDeviceIdentity('Bea');
    const { conversationId } = createDmGroup(db.adapter, { admin, title: 'Trip crew', members: [member(b)] });
    const epochKey = getCurrentEpochKey(db.adapter, conversationId, admin)!;
    const message = createDmMessage(admin, {
      conversationId, body: 'secret', hlc: { wall: '2026-07-01T00:00:00.000Z', counter: 0 },
    });
    const sealed = sealDmGroup({
      sender: admin, conversationId, epoch: epochKey.epoch, epochSecret: epochKey.secret,
      events: [message],
      recipients: [{ deviceId: b.publicKey, dhPublicKey: b.dhPublicKey, pairSecret: 'ab'.repeat(32) }],
    });
    if (!sealed.ok) throw new Error('seal failed');

    // The wrong epoch secret yields nothing (fail-closed decrypt).
    const wrongSecret = new Uint8Array(32).fill(7);
    expect(decryptDmGroupEvents(sealed.payload, wrongSecret)).toBeNull();
  });
});
