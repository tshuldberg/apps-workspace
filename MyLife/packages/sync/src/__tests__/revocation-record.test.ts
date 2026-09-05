/**
 * MK-019 -- signed, gossipable revocation v2. The acceptance: a revocation made
 * by one member, once gossiped and applied, causes every other member to reject
 * the revoked device at handshake time (the handshake's isDeviceRevoked check),
 * within a single gossip round. Forged or unauthorized revocations are refused.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { generateDeviceIdentity } from '../identity/device-identity';
import { completePairing } from '../identity/pairing';
import {
  createSignedRevocation,
  verifySignedRevocation,
  applySignedRevocation,
  type SignedRevocation,
} from '../protocol/revocation-record';
import { createSyncTables } from '../db/schema';
import { isDeviceRevoked, insertPairedDevice, createWorkspace, addWorkspaceMember } from '../db/queries';
import type { WorkspaceMemberRole } from '../types';

const WS = 'ws-rev';

function freshDb(): InMemoryTestDatabase {
  const db = createInMemoryTestDatabase();
  createSyncTables(db.adapter);
  return db;
}

/** Create WS with the given members so the admin authority model can resolve. */
function setupWorkspace(db: InMemoryTestDatabase, roles: Record<string, WorkspaceMemberRole>) {
  const ids = Object.keys(roles);
  createWorkspace(db.adapter, {
    id: WS, displayName: 'Rev', workspaceType: 'group', createdByDeviceId: ids[0]!,
    createdAt: '2026-06-11T00:00:00.000Z', rotatedAt: null, currentKeyVersion: 0, archivedAt: null,
  });
  for (const id of ids) {
    addWorkspaceMember(db.adapter, {
      workspaceId: WS, deviceId: id, role: roles[id]!, invitedByDeviceId: ids[0]!,
      invitedAt: '2026-06-11T00:00:00.000Z', removedAt: null,
    });
  }
}

const pairingData = (id: ReturnType<typeof generateDeviceIdentity>) =>
  ({ publicKey: id.publicKey, dhPublicKey: id.dhPublicKey, displayName: id.displayName, pairingNonce: '' });

describe('createSignedRevocation / verifySignedRevocation (MK-019)', () => {
  it('round-trips and verifies', () => {
    const admin = generateDeviceIdentity('Admin');
    const lost = generateDeviceIdentity('Lost Phone');
    const signed = createSignedRevocation(admin, lost.publicKey, 'stolen');
    expect(signed.revocation.deviceId).toBe(lost.publicKey);
    expect(signed.revocation.revokedByDeviceId).toBe(admin.publicKey);
    expect(verifySignedRevocation(signed)).toBe(true);
  });

  it('rejects a forged signature (revoker did not actually sign)', () => {
    const admin = generateDeviceIdentity('Admin');
    const evil = generateDeviceIdentity('Evil');
    const lost = generateDeviceIdentity('Lost');
    const evilSigned = createSignedRevocation(evil, lost.publicKey);
    const forged: SignedRevocation = {
      revocation: { ...evilSigned.revocation, revokedByDeviceId: admin.publicKey },
      signature: evilSigned.signature,
    };
    expect(verifySignedRevocation(forged)).toBe(false);
  });

  it('rejects a tampered target (signature no longer covers the device id)', () => {
    const admin = generateDeviceIdentity('Admin');
    const lost = generateDeviceIdentity('Lost');
    const other = generateDeviceIdentity('Other');
    const signed = createSignedRevocation(admin, lost.publicKey);
    signed.revocation.deviceId = other.publicKey;
    expect(verifySignedRevocation(signed)).toBe(false);
  });
});

describe('applySignedRevocation gossip (MK-019 acceptance)', () => {
  let db: InMemoryTestDatabase;
  beforeEach(() => { db = freshDb(); });
  afterEach(() => { db.close(); });

  it('a member applies a gossiped revocation from a WORKSPACE ADMIN and then rejects the device', () => {
    const admin = generateDeviceIdentity('Admin');
    const member = generateDeviceIdentity('Member');
    const lost = generateDeviceIdentity('Lost Phone');

    // A shared workspace: the admin is owner, the lost device is a member.
    setupWorkspace(db, { [admin.publicKey]: 'owner', [member.publicKey]: 'member', [lost.publicKey]: 'member' });
    insertPairedDevice(db.adapter, completePairing(member, pairingData(lost)));
    expect(isDeviceRevoked(db.adapter, lost.publicKey)).toBe(false);

    // The admin revokes the lost device and gossips the signed record.
    const gossiped = createSignedRevocation(admin, lost.publicKey, 'lost');
    const result = applySignedRevocation(db.adapter, gossiped);

    expect(result).toEqual({ ok: true, applied: true, deviceId: lost.publicKey });
    // The handshake check (isDeviceRevoked) now rejects the lost device for THIS
    // member, even though this member did not issue the revocation.
    expect(isDeviceRevoked(db.adapter, lost.publicKey)).toBe(true);
  });

  it('refuses a gossiped revocation from a NON-ADMIN member (authority gate)', () => {
    const member = generateDeviceIdentity('Plain Member');
    const target = generateDeviceIdentity('Target');
    // Both are members, but `member` is not an admin: it cannot evict `target`.
    setupWorkspace(db, { [member.publicKey]: 'member', [target.publicKey]: 'member' });
    insertPairedDevice(db.adapter, completePairing(target, pairingData(member)));
    const gossiped = createSignedRevocation(member, target.publicKey);
    expect(applySignedRevocation(db.adapter, gossiped)).toEqual({ ok: false, reason: 'unauthorized_revoker' });
    expect(isDeviceRevoked(db.adapter, target.publicKey)).toBe(false);
  });

  it('refuses a revocation signed by a device the recipient does not trust', () => {
    const stranger = generateDeviceIdentity('Stranger');
    const target = generateDeviceIdentity('Target');
    const gossiped = createSignedRevocation(stranger, target.publicKey);
    // The stranger is not a workspace admin and is not revoking itself.
    expect(applySignedRevocation(db.adapter, gossiped)).toEqual({ ok: false, reason: 'unauthorized_revoker' });
    expect(isDeviceRevoked(db.adapter, target.publicKey)).toBe(false);
  });

  it('always allows a device to revoke itself (compromised-device self-report)', () => {
    const self = generateDeviceIdentity('Compromised');
    const gossiped = createSignedRevocation(self, self.publicKey, 'I was compromised');
    expect(applySignedRevocation(db.adapter, gossiped)).toEqual({ ok: true, applied: true, deviceId: self.publicKey });
    expect(isDeviceRevoked(db.adapter, self.publicKey)).toBe(true);
  });

  it('refuses a forged revocation outright', () => {
    const evil = generateDeviceIdentity('Evil');
    const admin = generateDeviceIdentity('Admin');
    const target = generateDeviceIdentity('Target');
    const evilSigned = createSignedRevocation(evil, target.publicKey);
    const forged: SignedRevocation = {
      revocation: { ...evilSigned.revocation, revokedByDeviceId: admin.publicKey },
      signature: evilSigned.signature,
    };
    expect(applySignedRevocation(db.adapter, forged)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('is idempotent: re-applying a recorded revocation is a no-op success', () => {
    const self = generateDeviceIdentity('Self');
    const gossiped = createSignedRevocation(self, self.publicKey);
    expect(applySignedRevocation(db.adapter, gossiped).ok).toBe(true);
    expect(applySignedRevocation(db.adapter, gossiped)).toEqual({ ok: true, applied: false, deviceId: self.publicKey });
  });
});
