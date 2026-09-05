/**
 * M3 group keys (MK-021/022/023 unit layer).
 *
 * - MK-021 AC: a 3-device group agrees on the epoch key (commit on the
 *   admin, wraps distributed, every member unwraps the SAME secret).
 * - MK-022 (crypto layer): a 5-member workspace derives one shared content
 *   key and traffic encrypted under it round-trips for every member.
 * - MK-023 AC (module layer): a removal commit mints an epoch the removed
 *   device holds no wrap for; an add grants the new epoch but nothing earlier.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { generateDeviceIdentity } from '../identity/device-identity';
import { createSyncTables } from '../db/schema';
import { createWorkspace, getKeyWraps, getWorkspaceMembers } from '../db/queries';
import {
  createGroupCommit,
  commitMemberAdd,
  commitMemberRemoval,
  deriveEpochContentKey,
  getCurrentEpochKey,
  getWorkspaceEpoch,
  storeReceivedKeyWrap,
  unwrapEpochSecret,
  type GroupMemberKey,
} from '../protocol/group-keys';
import { encrypt, decrypt } from '../encryption/encrypt';

const WS = 'ws-group';

type Member = ReturnType<typeof generateDeviceIdentity>;
const memberKey = (m: Member): GroupMemberKey => ({ deviceId: m.publicKey, dhPublicKey: m.dhPublicKey });

function freshDb(): InMemoryTestDatabase {
  const db = createInMemoryTestDatabase();
  createSyncTables(db.adapter);
  createWorkspace(db.adapter, {
    id: WS, displayName: 'Group', workspaceType: 'group', createdByDeviceId: 'admin',
    createdAt: '2026-06-11T00:00:00.000Z', rotatedAt: null, currentKeyVersion: 0, archivedAt: null,
  });
  return db;
}

/** Copy one member's wrap rows from the committer's DB to the member's DB. */
function distributeWraps(from: InMemoryTestDatabase, to: InMemoryTestDatabase, epoch: number, deviceId: string) {
  for (const wrap of getKeyWraps(from.adapter, WS, epoch)) {
    if (wrap.wrappedForDeviceId === deviceId) storeReceivedKeyWrap(to.adapter, wrap);
  }
}

describe('group epoch keys (MK-021 acceptance: 3-device agreement)', () => {
  let adminDb: InMemoryTestDatabase;
  let bDb: InMemoryTestDatabase;
  let cDb: InMemoryTestDatabase;
  beforeEach(() => { adminDb = freshDb(); bDb = freshDb(); cDb = freshDb(); });
  afterEach(() => { adminDb.close(); bDb.close(); cDb.close(); });

  it('three devices unwrap the SAME epoch secret from one commit', () => {
    const admin = generateDeviceIdentity('Admin');
    const b = generateDeviceIdentity('Bea');
    const c = generateDeviceIdentity('Cal');

    const commit = createGroupCommit(adminDb.adapter, {
      workspaceId: WS, committer: admin, members: [admin, b, c].map(memberKey),
    });
    expect(commit.epoch).toBe(1);
    expect(commit.wrappedFor.sort()).toEqual([admin.publicKey, b.publicKey, c.publicKey].sort());

    // Wraps travel to each member (the distribution seam).
    distributeWraps(adminDb, bDb, 1, b.publicKey);
    distributeWraps(adminDb, cDb, 1, c.publicKey);

    const adminSecret = unwrapEpochSecret(adminDb.adapter, WS, 1, admin)!;
    const bSecret = unwrapEpochSecret(bDb.adapter, WS, 1, b)!;
    const cSecret = unwrapEpochSecret(cDb.adapter, WS, 1, c)!;
    expect(adminSecret).toEqual(commit.secret);
    expect(bSecret).toEqual(commit.secret);
    expect(cSecret).toEqual(commit.secret);

    // And the receiving DBs learned the epoch number.
    expect(getWorkspaceEpoch(bDb.adapter, WS)).toBe(1);
    expect(getCurrentEpochKey(cDb.adapter, WS, c)!.epoch).toBe(1);
  });

  it('a device with no wrap (not a member of the epoch) cannot unwrap', () => {
    const admin = generateDeviceIdentity('Admin');
    const outsider = generateDeviceIdentity('Outsider');
    createGroupCommit(adminDb.adapter, { workspaceId: WS, committer: admin, members: [memberKey(admin)] });
    expect(unwrapEpochSecret(adminDb.adapter, WS, 1, outsider)).toBeNull();
  });

  it('a tampered wrap blob fails closed', () => {
    const admin = generateDeviceIdentity('Admin');
    createGroupCommit(adminDb.adapter, { workspaceId: WS, committer: admin, members: [memberKey(admin)] });
    const wrap = getKeyWraps(adminDb.adapter, WS, 1)[0]!;
    const blob = wrap.wrappedKeyBlob instanceof Uint8Array ? wrap.wrappedKeyBlob : new Uint8Array(wrap.wrappedKeyBlob as ArrayBufferLike);
    blob[blob.length - 1]! ^= 0xff;
    adminDb.adapter.execute(
      'UPDATE sync_workspace_keys SET wrapped_key_blob = ? WHERE workspace_id = ? AND key_version = ?',
      [blob, WS, 1],
    );
    expect(unwrapEpochSecret(adminDb.adapter, WS, 1, admin)).toBeNull();
  });
});

describe('5-member workspace under one group key (MK-022 crypto layer)', () => {
  it('all five members derive the same content key and decrypt the same traffic', () => {
    const members = ['A', 'B', 'C', 'D', 'E'].map((n) => generateDeviceIdentity(n));
    const dbs = members.map(() => freshDb());
    const admin = members[0]!;

    const commit = createGroupCommit(dbs[0]!.adapter, {
      workspaceId: WS, committer: admin, members: members.map(memberKey),
    });
    for (let i = 1; i < members.length; i++) {
      distributeWraps(dbs[0]!, dbs[i]!, commit.epoch, members[i]!.publicKey);
    }

    // One member encrypts; every other member decrypts with its own unwrap.
    const sender = getCurrentEpochKey(dbs[1]!.adapter, WS, members[1]!)!;
    const key = deriveEpochContentKey(sender.secret, WS, sender.epoch);
    const plaintext = new TextEncoder().encode('group traffic under one epoch key');
    const sealed = encrypt(plaintext, key);

    for (let i = 0; i < members.length; i++) {
      const mine = getCurrentEpochKey(dbs[i]!.adapter, WS, members[i]!)!;
      const myKey = deriveEpochContentKey(mine.secret, WS, mine.epoch);
      expect(decrypt(sealed.ciphertext, sealed.nonce, myKey)).toEqual(plaintext);
    }
    dbs.forEach((d) => d.close());
  });
});

describe('membership commits (MK-023)', () => {
  let adminDb: InMemoryTestDatabase;
  beforeEach(() => { adminDb = freshDb(); });
  afterEach(() => { adminDb.close(); });

  it('removal mints a new epoch the removed device cannot unwrap', () => {
    const admin = generateDeviceIdentity('Admin');
    const lost = generateDeviceIdentity('Lost');
    const commit1 = createGroupCommit(adminDb.adapter, {
      workspaceId: WS, committer: admin, members: [admin, lost].map(memberKey),
    });
    // Epoch 1: the soon-to-be-removed device CAN unwrap (it is a member).
    expect(unwrapEpochSecret(adminDb.adapter, WS, 1, lost)).toEqual(commit1.secret);

    const commit2 = commitMemberRemoval(adminDb.adapter, {
      workspaceId: WS, committer: admin,
      members: [admin, lost].map(memberKey), removedDeviceId: lost.publicKey,
    });
    expect(commit2.epoch).toBe(2);
    expect(commit2.wrappedFor).toEqual([admin.publicKey]);
    expect(commit2.secret).not.toEqual(commit1.secret);

    // The removed device holds NO wrap for epoch 2 and the membership row is closed.
    expect(unwrapEpochSecret(adminDb.adapter, WS, 2, lost)).toBeNull();
    expect(getWorkspaceMembers(adminDb.adapter, WS).some((m) => m.deviceId === lost.publicKey)).toBe(false);
    // The survivor still can.
    expect(unwrapEpochSecret(adminDb.adapter, WS, 2, admin)).toEqual(commit2.secret);
  });

  it('add with historyScope join_point grants the new epoch but no retroactive access', () => {
    const admin = generateDeviceIdentity('Admin');
    const newbie = generateDeviceIdentity('Newbie');
    createGroupCommit(adminDb.adapter, { workspaceId: WS, committer: admin, members: [memberKey(admin)] });

    const commit2 = commitMemberAdd(adminDb.adapter, {
      workspaceId: WS, committer: admin, members: [memberKey(admin)], added: memberKey(newbie),
      historyScope: 'join_point',
    });
    expect(commit2.epoch).toBe(2);
    expect(unwrapEpochSecret(adminDb.adapter, WS, 2, newbie)).toEqual(commit2.secret);
    expect(unwrapEpochSecret(adminDb.adapter, WS, 1, newbie)).toBeNull(); // no history
    expect(getWorkspaceMembers(adminDb.adapter, WS).some((m) => m.deviceId === newbie.publicKey)).toBe(true);
  });

  it('add defaults to historyScope full: the newcomer can read every prior epoch', () => {
    const admin = generateDeviceIdentity('Admin');
    const newbie = generateDeviceIdentity('Newbie');
    // Two prior epochs the newcomer was never part of.
    const commit1 = createGroupCommit(adminDb.adapter, { workspaceId: WS, committer: admin, members: [memberKey(admin)] });
    const commit2 = commitMemberAdd(adminDb.adapter, {
      workspaceId: WS, committer: admin, members: [memberKey(admin)],
      added: memberKey(generateDeviceIdentity('Mid')),
      historyScope: 'join_point',
    });

    // Default (no historyScope) is full: back-wraps every prior epoch to newbie.
    const commit3 = commitMemberAdd(adminDb.adapter, {
      workspaceId: WS, committer: admin,
      members: [memberKey(admin)], added: memberKey(newbie),
    });
    expect(commit3.epoch).toBe(3);
    expect(unwrapEpochSecret(adminDb.adapter, WS, 3, newbie)).toEqual(commit3.secret);
    expect(unwrapEpochSecret(adminDb.adapter, WS, 2, newbie)).toEqual(commit2.secret);
    expect(unwrapEpochSecret(adminDb.adapter, WS, 1, newbie)).toEqual(commit1.secret);
  });
});

// P0 hardening: a received wrap row is authored by an arbitrary (authorized)
// member, so the recipient must not trust it to move its epoch pointer or to
// overwrite a good wrap. The replication path passes the recipient identity.
describe('received key wraps cannot strand or poison the recipient', () => {
  const NOW = '2026-06-16T00:00:00.000Z';

  it('a foreign or bogus-epoch wrap never advances the recipient epoch pointer', () => {
    const victim = generateDeviceIdentity('Victim');
    const attacker = generateDeviceIdentity('Attacker');
    const db = freshDb();
    // Victim legitimately holds epoch 1.
    createGroupCommit(db.adapter, { workspaceId: WS, committer: victim, members: [memberKey(victim)] });
    expect(getCurrentEpochKey(db.adapter, WS, victim)?.epoch).toBe(1);

    // Attacker pushes a wrap for a huge epoch addressed to SOMEONE ELSE.
    storeReceivedKeyWrap(db.adapter, {
      workspaceId: WS, keyVersion: 999_999, wrappedForDeviceId: attacker.publicKey,
      wrappedKeyBlob: new Uint8Array(80), validFrom: NOW, validUntil: null,
    }, victim);

    // The victim's pointer stays at the real, readable epoch.
    expect(getWorkspaceEpoch(db.adapter, WS)).toBe(1);
    expect(getCurrentEpochKey(db.adapter, WS, victim)?.epoch).toBe(1);
    db.close();
  });

  it('an unopenable self-addressed wrap does not advance the epoch', () => {
    const victim = generateDeviceIdentity('Victim');
    const db = freshDb();
    storeReceivedKeyWrap(db.adapter, {
      workspaceId: WS, keyVersion: 5, wrappedForDeviceId: victim.publicKey,
      wrappedKeyBlob: new Uint8Array(80), validFrom: NOW, validUntil: null,
    }, victim);
    expect(getWorkspaceEpoch(db.adapter, WS)).toBe(0);
    expect(getCurrentEpochKey(db.adapter, WS, victim)).toBeNull();
    db.close();
  });

  it('an openable self-wrap supersedes an earlier poison in the same slot', () => {
    const owner = generateDeviceIdentity('Owner');
    const victim = generateDeviceIdentity('Victim');
    const ownerDb = freshDb();
    const commit1 = createGroupCommit(ownerDb.adapter, {
      workspaceId: WS, committer: owner, members: [memberKey(owner), memberKey(victim)],
    });
    const realVictimWrap = getKeyWraps(ownerDb.adapter, WS, 1)
      .find((w) => w.wrappedForDeviceId === victim.publicKey)!;

    const victimDb = freshDb();
    // Poison arrives first.
    storeReceivedKeyWrap(victimDb.adapter, {
      workspaceId: WS, keyVersion: 1, wrappedForDeviceId: victim.publicKey,
      wrappedKeyBlob: new Uint8Array(80), validFrom: NOW, validUntil: null,
    }, victim);
    expect(getCurrentEpochKey(victimDb.adapter, WS, victim)).toBeNull();

    // The real, openable wrap arrives second and wins.
    storeReceivedKeyWrap(victimDb.adapter, realVictimWrap, victim);
    const key = getCurrentEpochKey(victimDb.adapter, WS, victim);
    expect(key?.epoch).toBe(1);
    expect(key?.secret).toEqual(commit1.secret);
    ownerDb.close();
    victimDb.close();
  });
});
