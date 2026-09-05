/**
 * MK-018 -- introducer model. The headline acceptance: a third member who has
 * paired ONLY with the admin ends up mutually paired with every other member,
 * via the admin's signed introductions, with no direct contact between members.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { generateDeviceIdentity } from '../identity/device-identity';
import { completePairing } from '../identity/pairing';
import { createSignedIdentityBundle } from '../protocol/identity-bundle';
import {
  createIntroduction,
  verifySignedIntroduction,
  applyIntroduction,
  type SignedIntroduction,
} from '../protocol/introduction';
import { createSyncTables } from '../db/schema';
import { addWorkspaceMember, getPairedDevice, getPinnedIdentity, insertPairedDevice } from '../db/queries';
import type { WorkspaceMemberRole } from '../types';

const WS = 'ws-fam';

function freshDb(): InMemoryTestDatabase {
  const db = createInMemoryTestDatabase();
  createSyncTables(db.adapter);
  return db;
}

/** Register a device as a current member of WS with the given role. */
function joinWorkspace(db: InMemoryTestDatabase, deviceId: string, role: WorkspaceMemberRole) {
  addWorkspaceMember(db.adapter, {
    workspaceId: WS, deviceId, role, invitedByDeviceId: deviceId,
    invitedAt: '2026-06-11T00:00:00.000Z', removedAt: null,
  });
}

describe('createIntroduction / verifySignedIntroduction (MK-018)', () => {
  it('round-trips and verifies; pins the introducer when expected', () => {
    const admin = generateDeviceIdentity('Admin');
    const member = generateDeviceIdentity('Member');
    const intro = createIntroduction(admin, createSignedIdentityBundle(member), WS);
    expect(verifySignedIntroduction(intro)).toBe(true);
    expect(verifySignedIntroduction(intro, admin.publicKey)).toBe(true);
    expect(verifySignedIntroduction(intro, member.publicKey)).toBe(false); // wrong introducer
  });

  it('rejects a forged admin signature', () => {
    const admin = generateDeviceIdentity('Admin');
    const evil = generateDeviceIdentity('Evil');
    const member = generateDeviceIdentity('Member');
    const honest = createIntroduction(admin, createSignedIdentityBundle(member), WS);
    const forged: SignedIntroduction = {
      record: { ...honest.record, introducerDeviceId: admin.publicKey },
      signature: createIntroduction(evil, createSignedIdentityBundle(member), WS).signature,
    };
    expect(verifySignedIntroduction(forged)).toBe(false);
  });

  it('rejects a tampered subject bundle (swapped DH key)', () => {
    const admin = generateDeviceIdentity('Admin');
    const member = generateDeviceIdentity('Member');
    const evil = generateDeviceIdentity('Evil');
    const intro = createIntroduction(admin, createSignedIdentityBundle(member), WS);
    intro.record.subject.bundle.dhPublicKey = evil.dhPublicKey; // breaks the subject self-sig
    expect(verifySignedIntroduction(intro)).toBe(false);
  });
});

describe('applyIntroduction transitive pairing (MK-018 acceptance)', () => {
  let bDb: InMemoryTestDatabase;
  let cDb: InMemoryTestDatabase;
  beforeEach(() => { bDb = freshDb(); cDb = freshDb(); });
  afterEach(() => { bDb.close(); cDb.close(); });

  it('B and C, each paired only with the admin, end mutually paired', () => {
    const admin = generateDeviceIdentity('Admin');
    const b = generateDeviceIdentity('Bea');
    const c = generateDeviceIdentity('Cal');

    // B and C have each already paired with the admin (only)...
    insertPairedDevice(bDb.adapter, completePairing(b, payload(admin)));
    insertPairedDevice(cDb.adapter, completePairing(c, payload(admin)));
    // ...and recognize the admin as a workspace admin (authority to vouch).
    joinWorkspace(bDb, admin.publicKey, 'admin');
    joinWorkspace(cDb, admin.publicKey, 'admin');

    // The admin introduces them to each other.
    const introOfC = createIntroduction(admin, createSignedIdentityBundle(c), WS);
    const introOfB = createIntroduction(admin, createSignedIdentityBundle(b), WS);

    const bResult = applyIntroduction(bDb.adapter, b, introOfC);
    const cResult = applyIntroduction(cDb.adapter, c, introOfB);

    expect(bResult).toEqual({ ok: true, paired: true, subjectDeviceId: c.publicKey });
    expect(cResult).toEqual({ ok: true, paired: true, subjectDeviceId: b.publicKey });

    // Both now hold a paired-device row for the other, AND the same shared
    // secret (X25519 is commutative) -- a usable channel with no direct contact.
    const bWithC = getPairedDevice(bDb.adapter, c.publicKey)!;
    const cWithB = getPairedDevice(cDb.adapter, b.publicKey)!;
    expect(bWithC).not.toBeNull();
    expect(cWithB).not.toBeNull();
    expect(bWithC.sharedSecretRef).toBe(cWithB.sharedSecretRef);

    // The subject was pinned on B's side (TOFU groundwork for future key changes).
    expect(getPinnedIdentity(bDb.adapter, c.publicKey)).not.toBeNull();
  });

  it('refuses an introduction from an introducer the recipient has not paired with', () => {
    const stranger = generateDeviceIdentity('Stranger');
    const b = generateDeviceIdentity('Bea');
    const c = generateDeviceIdentity('Cal');
    // B has NOT paired with the stranger.
    const intro = createIntroduction(stranger, createSignedIdentityBundle(c), WS);
    expect(applyIntroduction(bDb.adapter, b, intro)).toEqual({ ok: false, reason: 'untrusted_introducer' });
    expect(getPairedDevice(bDb.adapter, c.publicKey)).toBeNull();
  });

  it('is idempotent: re-applying for an already-paired subject is a no-op success', () => {
    const admin = generateDeviceIdentity('Admin');
    const b = generateDeviceIdentity('Bea');
    const c = generateDeviceIdentity('Cal');
    insertPairedDevice(bDb.adapter, completePairing(b, payload(admin)));
    joinWorkspace(bDb, admin.publicKey, 'admin');
    const introOfC = createIntroduction(admin, createSignedIdentityBundle(c), WS);

    expect(applyIntroduction(bDb.adapter, b, introOfC).ok).toBe(true);
    expect(applyIntroduction(bDb.adapter, b, introOfC)).toEqual({
      ok: true, paired: false, subjectDeviceId: c.publicKey,
    });
  });

  it('refuses an introduction from a paired but NON-ADMIN member (authority gate)', () => {
    const plain = generateDeviceIdentity('Plain Member');
    const b = generateDeviceIdentity('Bea');
    const c = generateDeviceIdentity('Cal');
    // B has paired with `plain` and sees them in the workspace, but only as a
    // plain member -- not an admin, so they may not vouch for anyone.
    insertPairedDevice(bDb.adapter, completePairing(b, payload(plain)));
    joinWorkspace(bDb, plain.publicKey, 'member');

    const intro = createIntroduction(plain, createSignedIdentityBundle(c), WS);
    expect(applyIntroduction(bDb.adapter, b, intro)).toEqual({ ok: false, reason: 'introducer_not_admin' });
    expect(getPairedDevice(bDb.adapter, c.publicKey)).toBeNull();
  });

  it('refuses an introduction from a REMOVED admin', () => {
    const exAdmin = generateDeviceIdentity('Ex Admin');
    const b = generateDeviceIdentity('Bea');
    const c = generateDeviceIdentity('Cal');
    insertPairedDevice(bDb.adapter, completePairing(b, payload(exAdmin)));
    // The admin was removed from the workspace.
    addWorkspaceMember(bDb.adapter, {
      workspaceId: WS, deviceId: exAdmin.publicKey, role: 'admin', invitedByDeviceId: exAdmin.publicKey,
      invitedAt: '2026-06-11T00:00:00.000Z', removedAt: '2026-06-12T00:00:00.000Z',
    });
    const intro = createIntroduction(exAdmin, createSignedIdentityBundle(c), WS);
    expect(applyIntroduction(bDb.adapter, b, intro)).toEqual({ ok: false, reason: 'introducer_not_admin' });
  });
});

/** Minimal PairingData for completePairing from an identity. */
function payload(id: ReturnType<typeof generateDeviceIdentity>) {
  return { publicKey: id.publicKey, dhPublicKey: id.dhPublicKey, displayName: id.displayName, pairingNonce: '' };
}
