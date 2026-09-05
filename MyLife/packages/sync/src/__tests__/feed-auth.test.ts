/**
 * Community feed P2 -- per-member signed feed auth + sealed-tail-entry integrity.
 *
 * Pure unit coverage with REAL identities + a REAL signed community descriptor:
 *  - verifyFeedAuth: happy path returns the role; bad signature, non-member,
 *    removed member, stale ts, and expired challenge are all rejected.
 *  - verifySealedTailEntry: happy path; tampered sealed bytes and a non-member
 *    author are rejected WITHOUT decrypting.
 */

import { describe, expect, it } from 'vitest';
import {
  createCommunity,
  reviseCommunity,
  type CommunityDescriptor,
} from '../protocol/community';
import {
  createFeedChallenge,
  signFeedAuth,
  verifyFeedAuth,
  signSealedTailEntry,
  verifySealedTailEntry,
} from '../protocol/feed-auth';
import { generateDeviceIdentity, signMessage, extractSigningPrivateKeyHex } from '../identity/device-identity';
import { bytesToHex } from '../encryption/keys';

const NOW = '2026-06-16T00:00:00.000Z';

function communityWith(owner: ReturnType<typeof generateDeviceIdentity>, member: ReturnType<typeof generateDeviceIdentity>): CommunityDescriptor {
  const signed = createCommunity(owner, {
    name: 'Feed Auth Club',
    channels: [{ id: 'general', name: 'general' }],
    members: [{ deviceId: member.publicKey, role: 'member', displayName: member.displayName, dhPublicKey: member.dhPublicKey }],
    now: NOW,
  });
  return signed.descriptor;
}

describe('feed-auth: per-member challenge-response', () => {
  it('accepts a fresh, correctly signed member proof and returns the role', () => {
    const owner = generateDeviceIdentity('Owner');
    const member = generateDeviceIdentity('Member');
    const descriptor = communityWith(owner, member);
    const challenge = createFeedChallenge({ now: NOW });

    const signature = signFeedAuth(member, { communityId: descriptor.communityId, nonce: challenge.nonce, ts: NOW });
    const verdict = verifyFeedAuth({
      communityId: descriptor.communityId,
      nonce: challenge.nonce,
      ts: NOW,
      deviceId: member.publicKey,
      signature,
      descriptor,
      now: NOW,
      expiresAt: challenge.expiresAt,
    });

    expect(verdict).toEqual({ ok: true, role: 'member' });
    expect(verifyFeedAuth({
      communityId: descriptor.communityId,
      nonce: challenge.nonce,
      ts: NOW,
      deviceId: owner.publicKey,
      signature: signFeedAuth(owner, { communityId: descriptor.communityId, nonce: challenge.nonce, ts: NOW }),
      descriptor,
      now: NOW,
    })).toEqual({ ok: true, role: 'owner' });
  });

  it('rejects a bad signature', () => {
    const owner = generateDeviceIdentity('Owner');
    const member = generateDeviceIdentity('Member');
    const descriptor = communityWith(owner, member);
    const challenge = createFeedChallenge({ now: NOW });

    // A signature over the WRONG canonical (different nonce) must not verify.
    const wrongSig = signFeedAuth(member, { communityId: descriptor.communityId, nonce: 'deadbeef', ts: NOW });
    const verdict = verifyFeedAuth({
      communityId: descriptor.communityId,
      nonce: challenge.nonce,
      ts: NOW,
      deviceId: member.publicKey,
      signature: wrongSig,
      descriptor,
      now: NOW,
    });
    expect(verdict).toEqual({ ok: false, reason: 'bad_signature' });
  });

  it('rejects a non-member (valid key, not in the descriptor)', () => {
    const owner = generateDeviceIdentity('Owner');
    const member = generateDeviceIdentity('Member');
    const outsider = generateDeviceIdentity('Outsider');
    const descriptor = communityWith(owner, member);
    const challenge = createFeedChallenge({ now: NOW });

    const signature = signFeedAuth(outsider, { communityId: descriptor.communityId, nonce: challenge.nonce, ts: NOW });
    expect(verifyFeedAuth({
      communityId: descriptor.communityId,
      nonce: challenge.nonce,
      ts: NOW,
      deviceId: outsider.publicKey,
      signature,
      descriptor,
      now: NOW,
    })).toEqual({ ok: false, reason: 'not_member' });
  });

  it('rejects a REMOVED member (absent from the latest descriptor)', () => {
    const owner = generateDeviceIdentity('Owner');
    const member = generateDeviceIdentity('Member');
    const signed = createCommunity(owner, {
      name: 'Feed Auth Club',
      channels: [{ id: 'general', name: 'general' }],
      members: [{ deviceId: member.publicKey, role: 'member', displayName: member.displayName, dhPublicKey: member.dhPublicKey }],
      now: NOW,
    });
    // Owner revises the descriptor to drop the member (revocation).
    const revised = reviseCommunity(owner, signed, {
      members: signed.descriptor.members.filter((m) => m.deviceId !== member.publicKey),
    }, '2026-06-16T00:01:00.000Z');

    const challenge = createFeedChallenge({ now: NOW });
    const signature = signFeedAuth(member, { communityId: revised.descriptor.communityId, nonce: challenge.nonce, ts: NOW });
    expect(verifyFeedAuth({
      communityId: revised.descriptor.communityId,
      nonce: challenge.nonce,
      ts: NOW,
      deviceId: member.publicKey,
      signature,
      descriptor: revised.descriptor, // the LATEST roster, without the removed member
      now: NOW,
    })).toEqual({ ok: false, reason: 'not_member' });
  });

  it('rejects a stale ts and an expired challenge', () => {
    const owner = generateDeviceIdentity('Owner');
    const member = generateDeviceIdentity('Member');
    const descriptor = communityWith(owner, member);
    const challenge = createFeedChallenge({ now: NOW, ttlMs: 60_000 });
    const fields = { communityId: descriptor.communityId, nonce: challenge.nonce, ts: NOW };
    const signature = signFeedAuth(member, fields);

    // ts far outside the skew window.
    expect(verifyFeedAuth({
      ...fields, deviceId: member.publicKey, signature, descriptor,
      now: '2026-06-16T01:00:00.000Z', maxSkewMs: 60_000,
    })).toEqual({ ok: false, reason: 'expired' });

    // ts fresh, but the challenge itself has expired.
    expect(verifyFeedAuth({
      ...fields, deviceId: member.publicKey, signature, descriptor,
      now: '2026-06-16T00:02:00.000Z', expiresAt: challenge.expiresAt, maxSkewMs: 10 * 60_000,
    })).toEqual({ ok: false, reason: 'expired' });
  });
});

describe('feed-auth: sealed tail entry integrity over ciphertext', () => {
  const SEALED = new Uint8Array(Array.from({ length: 80 }, (_, i) => (i * 7 + 3) % 251));

  it('accepts a correctly signed sealed tail entry from a member', () => {
    const owner = generateDeviceIdentity('Owner');
    const member = generateDeviceIdentity('Member');
    const descriptor = communityWith(owner, member);

    const entry = signSealedTailEntry(member, {
      communityId: descriptor.communityId,
      channelId: 'general',
      authorDeviceId: member.publicKey,
      hlcWall: '2026-06-16T00:05:00.000Z',
      hlcCounter: 0,
    }, SEALED);

    expect(verifySealedTailEntry(entry, descriptor)).toEqual({ ok: true, role: 'member' });
  });

  it('rejects tampered sealed bytes (signature commits to the ciphertext hash)', () => {
    const owner = generateDeviceIdentity('Owner');
    const member = generateDeviceIdentity('Member');
    const descriptor = communityWith(owner, member);

    const entry = signSealedTailEntry(member, {
      communityId: descriptor.communityId,
      channelId: 'general',
      authorDeviceId: member.publicKey,
      hlcWall: '2026-06-16T00:05:00.000Z',
      hlcCounter: 0,
    }, SEALED);

    // Flip one ciphertext byte; the outer signature no longer matches the hash.
    const tampered = bytesToHex(new Uint8Array([...SEALED.slice(0, -1), SEALED[SEALED.length - 1]! ^ 0xff]));
    expect(verifySealedTailEntry({ ...entry, sealedHex: tampered }, descriptor))
      .toEqual({ ok: false, reason: 'bad_signature' });
  });

  it('rejects an entry whose author is not a descriptor member', () => {
    const owner = generateDeviceIdentity('Owner');
    const member = generateDeviceIdentity('Member');
    const outsider = generateDeviceIdentity('Outsider');
    const descriptor = communityWith(owner, member);

    // Outsider signs a well-formed entry; the outer signature is valid but the
    // author is not in the roster -> rejected fail-closed (still no decryption).
    const entry = signSealedTailEntry(outsider, {
      communityId: descriptor.communityId,
      channelId: 'general',
      authorDeviceId: outsider.publicKey,
      hlcWall: '2026-06-16T00:05:00.000Z',
      hlcCounter: 0,
    }, SEALED);
    expect(verifySealedTailEntry(entry, descriptor)).toEqual({ ok: false, reason: 'not_member' });
  });

  it('rejects a malformed entry', () => {
    const owner = generateDeviceIdentity('Owner');
    const member = generateDeviceIdentity('Member');
    const descriptor = communityWith(owner, member);
    // Non-hex sealed bytes.
    const bogus = {
      communityId: descriptor.communityId,
      channelId: 'general',
      authorDeviceId: member.publicKey,
      hlcWall: NOW,
      hlcCounter: 0,
      sealedHex: 'zznothex',
      entrySignature: bytesToHex(signMessage(extractSigningPrivateKeyHex(member.privateKeyRef), SEALED)),
    };
    expect(verifySealedTailEntry(bogus, descriptor)).toEqual({ ok: false, reason: 'malformed' });
  });
});
