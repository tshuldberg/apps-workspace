/**
 * Group DM epoch backing (Plan 21 Phase 6).
 *
 * A group DM (2-7+ members) is an admin-signed SignedDmGroupDescriptor backed by
 * a real MLS-shaped epoch key: a `sync_workspaces` row with
 * `workspace_type = 'dm_group'` + `sync_workspace_members` + per-member key wraps
 * in `sync_workspace_keys`, minted by the SHIPPED group-keys.ts commit path
 * (createGroupCommit / commitMemberAdd / commitMemberRemoval). No new key
 * derivation lives here; the only new crypto is the descriptor's Ed25519
 * signature over its own domain string, so a group DM descriptor can never
 * cross-verify with a channel message, a 1:1 DM, a publication, or a community.
 *
 * THE CRITICAL INVARIANT (NC-9, metadata no-leak). `sync_workspace_keys` is a
 * SYNCED table at shared_workspace scope (module `communitykeys`). If a dm_group
 * commit EVER recorded a change-tracker row for its wraps, those wraps -- and thus
 * the group's existence + its member device ids -- would replicate to the user's
 * UNRELATED community co-members over a shared session. Mitigation, ENFORCED:
 *   - Every commit here is called with NO recordChange (undefined). Zero
 *     change-tracker rows are written, so nothing is ever queued for replication.
 *   - A dm_group workspace is NEVER joined to a community sync session.
 *   - Wraps reach members ONLY through the explicit per-member DM_GROUP_COMMIT
 *     mailbox handoff (dm-group-handoff-mailbox.ts), sealed to each recipient.
 * The load-bearing proof is the NC-9 negative test: a create/add/remove leaves
 * `getUnsyncedByModule('communitykeys')` unchanged.
 *
 * Admin authority: membership is rewritten ONLY by the admin. The descriptor is
 * admin-signed and verifyDmGroupDescriptor enforces the adminDeviceId signature,
 * so a non-admin member cannot forge a membership change.
 *
 * RN-safe: no Node built-ins at import; reuses the package crypto helpers only.
 */

import nacl from 'tweetnacl';
import type { DatabaseAdapter } from '@mylife/db';
import type { DeviceIdentity, HistoryScope } from '../types';
import {
  extractSigningPrivateKeyHex,
  signMessage,
  verifySignature,
} from '../identity/device-identity';
import { bytesToHex, hexToBytes } from '../encryption/keys';
import { addWorkspaceMember, createWorkspace } from '../db/queries';
import {
  commitMemberAdd,
  commitMemberRemoval,
  createGroupCommit,
  type GroupCommitResult,
} from './group-keys';

/** The DM-group descriptor domain: distinct from channel / dm-message / publication / community. */
const DM_GROUP_DOMAIN = 'meerkat-dm-group-v1';

const encoder = new TextEncoder();

/** A member of a group DM: its device id, X25519 key (for wrapping), and role. */
export interface DmGroupMember {
  deviceId: string;
  /** X25519 public key hex, used to wrap the epoch secret for this member. */
  dhPublicKey: string;
  role: 'member' | 'admin';
}

/**
 * The admin-signed group DM descriptor. `signature` is an Ed25519 signature by
 * `adminDeviceId` over the canonical form (everything but the signature) under
 * the DM_GROUP_DOMAIN string.
 */
export interface SignedDmGroupDescriptor {
  version: 1;
  /** Stable id of this group DM; also the backing workspace id + epoch-key scope. */
  conversationId: string;
  title: string;
  /** The sole device authorized to rewrite membership (signs every revision). */
  adminDeviceId: string;
  /** The current epoch this descriptor revision corresponds to. */
  epoch: number;
  members: DmGroupMember[];
  createdAt: string;
  signature: string;
}

/** Canonical bytes signed/verified. First element is the DM-group domain (cross-domain isolation). */
function canonicalDmGroupDescriptor(d: Omit<SignedDmGroupDescriptor, 'signature'>): Uint8Array {
  return encoder.encode(JSON.stringify([
    DM_GROUP_DOMAIN,
    d.version,
    d.conversationId,
    d.title,
    d.adminDeviceId,
    d.epoch,
    d.members.map((m) => [m.deviceId, m.dhPublicKey, m.role]),
    d.createdAt,
  ]));
}

export interface CreateDmGroupDescriptorInput {
  conversationId: string;
  title: string;
  epoch: number;
  members: DmGroupMember[];
  createdAt?: string;
}

/** Build + sign a group DM descriptor. adminDeviceId is bound to the signer. */
export function createDmGroupDescriptor(
  admin: DeviceIdentity,
  input: CreateDmGroupDescriptorInput,
): SignedDmGroupDescriptor {
  const unsigned: Omit<SignedDmGroupDescriptor, 'signature'> = {
    version: 1,
    conversationId: input.conversationId,
    title: input.title,
    adminDeviceId: admin.publicKey,
    epoch: input.epoch,
    members: input.members.map((m) => ({ deviceId: m.deviceId, dhPublicKey: m.dhPublicKey, role: m.role })),
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
  const privateKeyHex = extractSigningPrivateKeyHex(admin.privateKeyRef);
  const signature = bytesToHex(signMessage(privateKeyHex, canonicalDmGroupDescriptor(unsigned)));
  return { ...unsigned, signature };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isDmGroupMember(value: unknown): value is DmGroupMember {
  return isRecord(value)
    && typeof value.deviceId === 'string'
    && typeof value.dhPublicKey === 'string'
    && (value.role === 'member' || value.role === 'admin');
}

/**
 * Verify a group DM descriptor: shape + the admin's Ed25519 signature over the
 * canonical form. Fail-closed. A signature by anyone but adminDeviceId, or over a
 * different domain, does not verify.
 */
export function verifyDmGroupDescriptor(d: SignedDmGroupDescriptor): boolean {
  if (!isRecord(d) || typeof d.signature !== 'string' || d.signature.length === 0) return false;
  if (
    d.version !== 1
    || typeof d.conversationId !== 'string'
    || d.conversationId.length === 0
    || typeof d.title !== 'string'
    || typeof d.adminDeviceId !== 'string'
    || typeof d.epoch !== 'number'
    || !Array.isArray(d.members)
    || !d.members.every(isDmGroupMember)
    || typeof d.createdAt !== 'string'
  ) {
    return false;
  }
  try {
    const { signature, ...unsigned } = d;
    return verifySignature(
      d.adminDeviceId,
      canonicalDmGroupDescriptor(unsigned),
      hexToBytes(signature),
    );
  } catch {
    return false;
  }
}

const toGroupMemberKey = (m: DmGroupMember) => ({ deviceId: m.deviceId, dhPublicKey: m.dhPublicKey });
const toWorkspaceRole = (role: DmGroupMember['role']) => (role === 'admin' ? 'admin' : 'member');

export interface CreateDmGroupInput {
  admin: DeviceIdentity;
  title: string;
  /** The other members (the admin is added automatically as role 'admin'). */
  members: DmGroupMember[];
  /** Optional explicit conversation id; defaults to fresh 16-byte entropy. */
  conversationId?: string;
  now?: string;
}

export interface CreateDmGroupResult {
  descriptor: SignedDmGroupDescriptor;
  commit: GroupCommitResult;
  conversationId: string;
}

/**
 * Create a group DM: a `dm_group` workspace + members + an epoch-1 commit + the
 * admin-signed descriptor. The epoch commit is minted with NO recordChange
 * (NC-9), so its key wraps never enter the change log and never replicate.
 */
export function createDmGroup(db: DatabaseAdapter, input: CreateDmGroupInput): CreateDmGroupResult {
  const now = input.now ?? new Date().toISOString();
  const conversationId = input.conversationId ?? bytesToHex(nacl.randomBytes(16));
  const adminMember: DmGroupMember = {
    deviceId: input.admin.publicKey,
    dhPublicKey: input.admin.dhPublicKey,
    role: 'admin',
  };
  const others = input.members.filter((m) => m.deviceId !== input.admin.publicKey);
  const allMembers: DmGroupMember[] = [adminMember, ...others];

  createWorkspace(db, {
    id: conversationId,
    displayName: input.title,
    workspaceType: 'dm_group',
    createdByDeviceId: input.admin.publicKey,
    createdAt: now,
    rotatedAt: null,
    currentKeyVersion: 0,
    archivedAt: null,
  });
  for (const m of allMembers) {
    addWorkspaceMember(db, {
      workspaceId: conversationId,
      deviceId: m.deviceId,
      role: toWorkspaceRole(m.role),
      invitedByDeviceId: input.admin.publicKey,
      invitedAt: now,
      removedAt: null,
    });
  }

  // Epoch 1: NO recordChange (NC-9). dm_group wraps NEVER replicate.
  const commit = createGroupCommit(db, {
    workspaceId: conversationId,
    committer: input.admin,
    members: allMembers.map(toGroupMemberKey),
    now,
  });

  const descriptor = createDmGroupDescriptor(input.admin, {
    conversationId,
    title: input.title,
    epoch: commit.epoch,
    members: allMembers,
    createdAt: now,
  });

  return { descriptor, commit, conversationId };
}

export interface DmGroupMutationResult {
  descriptor: SignedDmGroupDescriptor;
  commit: GroupCommitResult;
}

export interface DmGroupAddInput {
  admin: DeviceIdentity;
  descriptor: SignedDmGroupDescriptor;
  added: DmGroupMember;
  /** DM groups default to join_point (a newcomer reads from join forward). */
  historyScope?: HistoryScope;
  now?: string;
}

/**
 * Add a member: a real epoch commit wrapped for the old members PLUS the
 * newcomer, then a re-signed descriptor at the new epoch. NO recordChange
 * (NC-9). Admin-only: the caller must be the descriptor admin. DM groups default
 * to `historyScope: 'join_point'` (no back-wrap of prior epochs); the admin may
 * pass `'full'` to opt the newcomer into prior history.
 */
export function dmGroupAdd(db: DatabaseAdapter, input: DmGroupAddInput): DmGroupMutationResult {
  if (input.admin.publicKey !== input.descriptor.adminDeviceId) {
    throw new Error('Only the DM group admin can add a member.');
  }
  const now = input.now ?? new Date().toISOString();
  const currentMembers = input.descriptor.members;

  const commit = commitMemberAdd(db, {
    workspaceId: input.descriptor.conversationId,
    committer: input.admin,
    members: currentMembers.map(toGroupMemberKey),
    added: toGroupMemberKey(input.added),
    role: toWorkspaceRole(input.added.role),
    historyScope: input.historyScope ?? 'join_point',
    now,
  });

  const nextMembers: DmGroupMember[] = [
    ...currentMembers.filter((m) => m.deviceId !== input.added.deviceId),
    { deviceId: input.added.deviceId, dhPublicKey: input.added.dhPublicKey, role: input.added.role },
  ];
  const descriptor = createDmGroupDescriptor(input.admin, {
    conversationId: input.descriptor.conversationId,
    title: input.descriptor.title,
    epoch: commit.epoch,
    members: nextMembers,
    createdAt: input.descriptor.createdAt,
  });

  return { descriptor, commit };
}

export interface DmGroupRemoveInput {
  admin: DeviceIdentity;
  descriptor: SignedDmGroupDescriptor;
  removedDeviceId: string;
  now?: string;
}

/**
 * Remove a member: a real epoch commit wrapped for everyone EXCEPT the removed
 * device (forward secrecy -- it holds no wrap for the new epoch), then a
 * re-signed descriptor at the new epoch. NO recordChange (NC-9). Admin-only.
 */
export function dmGroupRemove(db: DatabaseAdapter, input: DmGroupRemoveInput): DmGroupMutationResult {
  if (input.admin.publicKey !== input.descriptor.adminDeviceId) {
    throw new Error('Only the DM group admin can remove a member.');
  }
  const now = input.now ?? new Date().toISOString();

  const commit = commitMemberRemoval(db, {
    workspaceId: input.descriptor.conversationId,
    committer: input.admin,
    members: input.descriptor.members.map(toGroupMemberKey),
    removedDeviceId: input.removedDeviceId,
    now,
  });

  const nextMembers = input.descriptor.members.filter((m) => m.deviceId !== input.removedDeviceId);
  const descriptor = createDmGroupDescriptor(input.admin, {
    conversationId: input.descriptor.conversationId,
    title: input.descriptor.title,
    epoch: commit.epoch,
    members: nextMembers,
    createdAt: input.descriptor.createdAt,
  });

  return { descriptor, commit };
}
