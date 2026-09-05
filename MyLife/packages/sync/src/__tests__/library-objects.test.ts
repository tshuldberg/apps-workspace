/**
 * Plan 38 Phase 0 -- library objects (the D.3 sealing decision).
 *
 * Membership IS the read capability: the per-object DEK wraps under the
 * workspace epoch, so historyScope governs late joiners, removal revokes new
 * items, and a member with the wrap history can open any epoch it held.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import nacl from 'tweetnacl';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { generateDeviceIdentity } from '../identity/device-identity';
import { createSyncTables } from '../db/schema';
import { createWorkspace, getKeyWraps } from '../db/queries';
import {
  commitMemberAdd,
  commitMemberRemoval,
  createGroupCommit,
  storeReceivedKeyWrap,
  unwrapEpochSecret,
  type GroupMemberKey,
} from '../protocol/group-keys';
import {
  deriveEpochLibraryWrapKey,
  openLibraryObject,
  sealLibraryObject,
  unwrapLibraryObjectKey,
  unwrapLibraryObjectKeyForDevice,
  wrapLibraryObjectKey,
} from '../protocol/library-objects';
import { deriveEpochContentKey } from '../protocol/group-keys';

const WS = 'ws-library';
type Member = ReturnType<typeof generateDeviceIdentity>;
const memberKey = (m: Member): GroupMemberKey => ({ deviceId: m.publicKey, dhPublicKey: m.dhPublicKey });

function freshDb(): InMemoryTestDatabase {
  const db = createInMemoryTestDatabase();
  createSyncTables(db.adapter);
  createWorkspace(db.adapter, {
    id: WS, displayName: 'Library WS', workspaceType: 'community', createdByDeviceId: 'owner',
    createdAt: '2026-07-05T00:00:00.000Z', rotatedAt: null, currentKeyVersion: 0, archivedAt: null,
  });
  return db;
}

function distributeWraps(from: InMemoryTestDatabase, to: InMemoryTestDatabase, deviceId: string) {
  for (let epoch = 1; epoch <= 8; epoch += 1) {
    for (const wrap of getKeyWraps(from.adapter, WS, epoch)) {
      if (wrap.wrappedForDeviceId === deviceId) storeReceivedKeyWrap(to.adapter, wrap);
    }
  }
}

const CONTENT = new TextEncoder().encode('a family movie night file, sealed at rest');

describe('DEK wrap primitives', () => {
  const epochSecret = nacl.randomBytes(32);
  const dek = nacl.randomBytes(32);

  it('round-trips a DEK under the epoch wrap key', () => {
    const wrapped = wrapLibraryObjectKey(dek, epochSecret, WS, 1);
    expect(unwrapLibraryObjectKey(wrapped, epochSecret, WS, 1)).toEqual(dek);
  });

  it('fails closed on wrong secret, workspace, epoch, or tamper', () => {
    const wrapped = wrapLibraryObjectKey(dek, epochSecret, WS, 1);
    expect(unwrapLibraryObjectKey(wrapped, nacl.randomBytes(32), WS, 1)).toBeNull();
    expect(unwrapLibraryObjectKey(wrapped, epochSecret, 'ws-other', 1)).toBeNull();
    expect(unwrapLibraryObjectKey(wrapped, epochSecret, WS, 2)).toBeNull();
    const tampered = `${wrapped.slice(0, -2)}${wrapped.slice(-2) === '00' ? 'ff' : '00'}`;
    expect(unwrapLibraryObjectKey(tampered, epochSecret, WS, 1)).toBeNull();
    expect(unwrapLibraryObjectKey('zz-not-hex', epochSecret, WS, 1)).toBeNull();
    expect(unwrapLibraryObjectKey('abcd', epochSecret, WS, 1)).toBeNull();
  });

  it('rejects a non-32-byte DEK at wrap time', () => {
    expect(() => wrapLibraryObjectKey(nacl.randomBytes(16), epochSecret, WS, 1)).toThrow();
  });

  it('derives a wrap key DISTINCT from the epoch content key (domain separation)', () => {
    expect(deriveEpochLibraryWrapKey(epochSecret, WS, 1)).not.toEqual(deriveEpochContentKey(epochSecret, WS, 1));
  });
});

describe('membership as read capability (epoch machinery end-to-end)', () => {
  let ownerDb: InMemoryTestDatabase;
  let memberDb: InMemoryTestDatabase;
  let joinerDb: InMemoryTestDatabase;
  const owner = generateDeviceIdentity('Owner');
  const member = generateDeviceIdentity('Member');
  const joiner = generateDeviceIdentity('Joiner');

  beforeEach(() => { ownerDb = freshDb(); memberDb = freshDb(); joinerDb = freshDb(); });
  afterEach(() => { ownerDb.close(); memberDb.close(); joinerDb.close(); });

  it('a current member opens an item; the sealed blocks never expose plaintext', () => {
    const commit = createGroupCommit(ownerDb.adapter, {
      workspaceId: WS, committer: owner, members: [owner, member].map(memberKey),
    });
    const sealed = sealLibraryObject(CONTENT, {
      workspaceId: WS, epoch: commit.epoch, epochSecret: commit.secret,
      name: 'movie-night.mp4', identity: owner, createdAt: '2026-07-05T00:00:00.000Z',
    });
    expect(sealed.keyEpoch).toBe(1);
    // Blocks are base64(nonce).base64(ciphertext) -- decode the ciphertext and
    // prove the plaintext is not inside it (at-rest sealing, unlike Model A).
    for (const chunk of sealed.share.sealedChunks) {
      const ciphertext = Buffer.from(chunk.payload.split('.')[1]!, 'base64');
      expect(ciphertext.includes(Buffer.from('family movie'))).toBe(false);
    }

    distributeWraps(ownerDb, memberDb, member.publicKey);
    const dek = unwrapLibraryObjectKeyForDevice(memberDb.adapter, member, WS, sealed.keyEpoch, sealed.wrappedKey);
    expect(dek).not.toBeNull();
    const memberSecret = unwrapEpochSecret(memberDb.adapter, WS, sealed.keyEpoch, member)!;
    const opened = openLibraryObject(sealed.share, sealed.wrappedKey, memberSecret, WS, sealed.keyEpoch, {
      expectedAuthor: owner.publicKey,
    });
    expect(opened.ok).toBe(true);
    if (opened.ok) expect(opened.content).toEqual(CONTENT);
  });

  it('join_point: a late joiner cannot open items sealed before it joined; full: it can', () => {
    const epoch1 = createGroupCommit(ownerDb.adapter, {
      workspaceId: WS, committer: owner, members: [memberKey(owner)],
    });
    const sealed = sealLibraryObject(CONTENT, {
      workspaceId: WS, epoch: epoch1.epoch, epochSecret: epoch1.secret,
      name: 'pre-join.pdf', identity: owner,
    });

    // join_point add: the joiner gets epoch 2 only.
    commitMemberAdd(ownerDb.adapter, {
      workspaceId: WS, committer: owner, members: [memberKey(owner)],
      added: memberKey(joiner), historyScope: 'join_point',
    });
    distributeWraps(ownerDb, joinerDb, joiner.publicKey);
    expect(unwrapLibraryObjectKeyForDevice(joinerDb.adapter, joiner, WS, sealed.keyEpoch, sealed.wrappedKey)).toBeNull();

    // full add on a fresh workspace state: back-wraps deliver the old epoch too.
    const fullJoiner = generateDeviceIdentity('Full Joiner');
    const fullJoinerDb = freshDb();
    try {
      commitMemberAdd(ownerDb.adapter, {
        workspaceId: WS, committer: owner, members: [memberKey(owner), memberKey(joiner)],
        added: memberKey(fullJoiner), historyScope: 'full',
      });
      distributeWraps(ownerDb, fullJoinerDb, fullJoiner.publicKey);
      const dek = unwrapLibraryObjectKeyForDevice(fullJoinerDb.adapter, fullJoiner, WS, sealed.keyEpoch, sealed.wrappedKey);
      expect(dek).not.toBeNull();
      const secret = unwrapEpochSecret(fullJoinerDb.adapter, WS, sealed.keyEpoch, fullJoiner)!;
      const opened = openLibraryObject(sealed.share, sealed.wrappedKey, secret, WS, sealed.keyEpoch);
      expect(opened.ok).toBe(true);
    } finally {
      fullJoinerDb.close();
    }
  });

  it('removal: items sealed under the post-removal epoch are unreadable to the removed member', () => {
    createGroupCommit(ownerDb.adapter, {
      workspaceId: WS, committer: owner, members: [owner, member].map(memberKey),
    });
    distributeWraps(ownerDb, memberDb, member.publicKey);

    const epoch2 = commitMemberRemoval(ownerDb.adapter, {
      workspaceId: WS, committer: owner, members: [owner, member].map(memberKey),
      removedDeviceId: member.publicKey,
    });
    const sealed = sealLibraryObject(CONTENT, {
      workspaceId: WS, epoch: epoch2.epoch, epochSecret: epoch2.secret,
      name: 'post-removal.jpg', identity: owner,
    });

    // The removed member never receives an epoch-2 wrap; even with the signed
    // row's wrappedKey in hand it cannot unwrap.
    distributeWraps(ownerDb, memberDb, member.publicKey);
    expect(unwrapLibraryObjectKeyForDevice(memberDb.adapter, member, WS, sealed.keyEpoch, sealed.wrappedKey)).toBeNull();

    // The owner (current member) still can.
    expect(unwrapLibraryObjectKeyForDevice(ownerDb.adapter, owner, WS, sealed.keyEpoch, sealed.wrappedKey)).not.toBeNull();
  });

  it('openLibraryObject fails closed on a wrong-epoch wrap and on author mismatch', () => {
    const commit = createGroupCommit(ownerDb.adapter, {
      workspaceId: WS, committer: owner, members: [memberKey(owner)],
    });
    const sealed = sealLibraryObject(CONTENT, {
      workspaceId: WS, epoch: commit.epoch, epochSecret: commit.secret,
      name: 'strict.bin', identity: owner,
    });
    const wrongEpoch = openLibraryObject(sealed.share, sealed.wrappedKey, commit.secret, WS, 99);
    expect(wrongEpoch.ok).toBe(false);
    const wrongAuthor = openLibraryObject(sealed.share, sealed.wrappedKey, commit.secret, WS, 1, {
      expectedAuthor: member.publicKey,
    });
    expect(wrongAuthor.ok).toBe(false);
  });
});
