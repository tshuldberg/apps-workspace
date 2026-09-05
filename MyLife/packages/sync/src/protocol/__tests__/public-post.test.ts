/**
 * Plan 39 P5 -- public post protocol adversarial coverage.
 *
 * Dual-signature verify (persona author + pinned node receipt), fail-closed on
 * forgery, transplant, node substitution, scope confusion, tamper, and
 * cross-domain signature confusion with private-tier channel messages.
 */

import { describe, it, expect } from 'vitest';
import nacl from 'tweetnacl';
import { generateDeviceIdentity, extractSigningPrivateKeyHex } from '../../identity/device-identity';
import { bytesToHex } from '../../encryption/keys';
import { createChannelMessage } from '../channel-message';
import {
  CURRENT_PUBLIC_TERMS_VERSION,
  createPublicPost,
  createPublicPostTombstone,
  createPublicPostingFreeze,
  publicPostEventHash,
  publicPostNodeKeypairFromSeed,
  signPublicPostAcceptance,
  verifyPublicPost,
  verifyPublicPostAuthor,
  verifyPublicPostTombstone,
  verifyPublicPostingFreeze,
  MAX_PUBLIC_POST_BODY_CHARS,
  type AcceptedPublicPost,
  type PublicPostEvent,
} from '../public-post';

function keypair(): { publicKeyHex: string; privateKeyHex: string } {
  const kp = nacl.sign.keyPair();
  return { publicKeyHex: bytesToHex(kp.publicKey), privateKeyHex: bytesToHex(kp.secretKey) };
}

const NOW = '2026-07-06T12:00:00.000Z';
const HLC = { wall: NOW, counter: 0 };

const persona = keypair();
const node = publicPostNodeKeypairFromSeed('11'.repeat(32));

function makeAccepted(overrides?: Partial<Parameters<typeof createPublicPost>[1]>): AcceptedPublicPost {
  const post = createPublicPost(persona, {
    publicationId: 'pub-1',
    channelId: 'chan-1',
    body: 'hello public world',
    now: NOW,
    ...overrides,
  });
  const receipt = signPublicPostAcceptance(node, { post, hlc: HLC, acceptedAt: NOW });
  return { post, receipt };
}

describe('public post protocol (Plan 39 P5)', () => {
  it('author-signs and dual-verifies a post against the pinned node key', () => {
    const accepted = makeAccepted();
    expect(verifyPublicPostAuthor(accepted.post)).toBe(true);
    expect(verifyPublicPost(accepted, node.publicKeyHex)).toBe('ok');
    expect(verifyPublicPost(accepted, node.publicKeyHex, { publicationId: 'pub-1', channelId: 'chan-1' })).toBe('ok');
  });

  it('replies are PublicPostEvents with a parent reference and verify identically', () => {
    const parent = makeAccepted();
    const reply = createPublicPost(persona, {
      publicationId: 'pub-1',
      channelId: 'chan-1',
      parentPostId: parent.post.postId,
      body: 'a gated reply',
      now: NOW,
    });
    const receipt = signPublicPostAcceptance(node, { post: reply, hlc: { wall: NOW, counter: 1 }, acceptedAt: NOW });
    expect(verifyPublicPost({ post: reply, receipt }, node.publicKeyHex)).toBe('ok');
    expect(reply.parentPostId).toBe(parent.post.postId);
  });

  it('rejects a forged author signature fail-closed', () => {
    const accepted = makeAccepted();
    const mallory = keypair();
    const forged: PublicPostEvent = {
      ...accepted.post,
      personaPubkey: mallory.publicKeyHex,
    };
    // Same signature, swapped author: id re-derivation changes AND sig fails.
    expect(verifyPublicPostAuthor(forged)).toBe(false);
    expect(verifyPublicPost({ post: forged, receipt: accepted.receipt }, node.publicKeyHex)).toBe('invalid_post');
  });

  it('rejects a tampered body / parent / channel fail-closed', () => {
    const accepted = makeAccepted();
    for (const patch of [
      { body: 'tampered body' },
      { parentPostId: 'stolen-thread' },
      { channelId: 'chan-2' },
      { createdAt: '2026-07-07T00:00:00.000Z' },
    ] as const) {
      const tampered = { ...accepted.post, ...patch } as PublicPostEvent;
      expect(verifyPublicPostAuthor(tampered)).toBe(false);
    }
  });

  it('binds the current public Terms version into the author signature', () => {
    const accepted = makeAccepted();
    expect(accepted.post.termsVersion).toBe(CURRENT_PUBLIC_TERMS_VERSION);
    const staleTerms = { ...accepted.post, termsVersion: 'legacy' } as unknown as PublicPostEvent;
    const missingTerms = { ...accepted.post } as Partial<PublicPostEvent>;
    delete missingTerms.termsVersion;
    expect(verifyPublicPostAuthor(staleTerms)).toBe(false);
    expect(verifyPublicPostAuthor(missingTerms as PublicPostEvent)).toBe(false);
  });

  it('rejects a forged receipt (node key not holding the pinned private key)', () => {
    const accepted = makeAccepted();
    const rogue = keypair();
    const forgedReceipt = signPublicPostAcceptance(
      { publicKeyHex: node.publicKeyHex, privateKeyHex: rogue.privateKeyHex },
      { post: accepted.post, hlc: HLC, acceptedAt: NOW },
    );
    expect(verifyPublicPost({ post: accepted.post, receipt: forgedReceipt }, node.publicKeyHex)).toBe('invalid_receipt');
  });

  it('rejects a receipt from a NON-pinned node key (node substitution)', () => {
    const accepted = makeAccepted();
    const otherNode = publicPostNodeKeypairFromSeed('22'.repeat(32));
    const substituted = signPublicPostAcceptance(otherNode, { post: accepted.post, hlc: HLC, acceptedAt: NOW });
    // The substitute receipt is internally valid, but it is not the pinned key.
    expect(verifyPublicPost({ post: accepted.post, receipt: substituted }, node.publicKeyHex)).toBe('node_key_mismatch');
  });

  it('fails closed when the pinned key is missing or malformed', () => {
    const accepted = makeAccepted();
    expect(verifyPublicPost(accepted, '')).toBe('node_key_mismatch');
    expect(verifyPublicPost(accepted, 'zz'.repeat(32))).toBe('node_key_mismatch');
  });

  it('rejects a receipt transplanted onto a different post (eventHash binding)', () => {
    const a = makeAccepted();
    const b = makeAccepted({ body: 'a different post' });
    expect(verifyPublicPost({ post: b.post, receipt: a.receipt }, node.publicKeyHex)).toBe('invalid_receipt');
  });

  it('rejects a tampered receipt HLC (no silent reorder)', () => {
    const accepted = makeAccepted();
    const reordered = { ...accepted.receipt, hlc: { wall: '2000-01-01T00:00:00.000Z', counter: 0 } };
    expect(verifyPublicPost({ post: accepted.post, receipt: reordered }, node.publicKeyHex)).toBe('invalid_receipt');
  });

  it('flags a scope mismatch when reading a different publication/channel', () => {
    const accepted = makeAccepted();
    expect(verifyPublicPost(accepted, node.publicKeyHex, { publicationId: 'pub-2' })).toBe('scope_mismatch');
    expect(verifyPublicPost(accepted, node.publicKeyHex, { channelId: 'chan-9' })).toBe('scope_mismatch');
  });

  it('a byte-identical replay derives the SAME postId (deterministic dedup key)', () => {
    const a = createPublicPost(persona, { publicationId: 'pub-1', channelId: 'chan-1', body: 'same', now: NOW });
    const b = createPublicPost(persona, { publicationId: 'pub-1', channelId: 'chan-1', body: 'same', now: NOW });
    expect(a.postId).toBe(b.postId);
    expect(publicPostEventHash(a)).toBe(publicPostEventHash(b));
    const c = createPublicPost(persona, { publicationId: 'pub-1', channelId: 'chan-1', body: 'same', now: '2026-07-06T12:00:01.000Z' });
    expect(c.postId).not.toBe(a.postId);
  });

  it('never cross-verifies with the private channel-message domain', () => {
    const device = generateDeviceIdentity('Author');
    const message = createChannelMessage(device, {
      communityId: 'pub-1',
      channelId: 'chan-1',
      body: 'hello public world',
      hlc: HLC,
    });
    // A private-tier signed event reshaped as a public post must NOT verify: the
    // canonical domains differ, so the signature can never transfer.
    const masqueraded: PublicPostEvent = {
      version: 1,
      termsVersion: CURRENT_PUBLIC_TERMS_VERSION,
      postId: message.id,
      publicationId: message.communityId,
      channelId: message.channelId,
      personaPubkey: message.authorDeviceId,
      parentPostId: null,
      body: message.body,
      createdAt: NOW,
      signature: message.signature,
    };
    expect(verifyPublicPostAuthor(masqueraded)).toBe(false);

    // And the reverse: a persona-signed public post cannot pass as a receipt for
    // itself (receipt domain differs from post domain, same key notwithstanding).
    const post = createPublicPost(persona, { publicationId: 'pub-1', channelId: 'chan-1', body: 'x', now: NOW });
    const selfReceipt = {
      version: 1 as const,
      nodeKeyHex: persona.publicKeyHex,
      publicationId: post.publicationId,
      channelId: post.channelId,
      postId: post.postId,
      eventHash: publicPostEventHash(post),
      hlc: HLC,
      acceptedAt: NOW,
      signature: post.signature,
    };
    expect(verifyPublicPost({ post, receipt: selfReceipt }, persona.publicKeyHex)).toBe('invalid_receipt');
  });

  it('enforces protocol caps at create and verify', () => {
    expect(() => createPublicPost(persona, {
      publicationId: 'pub-1',
      channelId: 'chan-1',
      body: 'x'.repeat(MAX_PUBLIC_POST_BODY_CHARS + 1),
      now: NOW,
    })).toThrow();
    expect(() => createPublicPost(persona, {
      publicationId: 'pub-1', channelId: 'chan-1', body: '', now: NOW,
    })).toThrow();
    const accepted = makeAccepted();
    const oversized = { ...accepted.post, body: 'x'.repeat(MAX_PUBLIC_POST_BODY_CHARS + 1) } as PublicPostEvent;
    expect(verifyPublicPostAuthor(oversized)).toBe(false);
  });
});

describe('public post tombstones + posting freeze (Plan 39 P5)', () => {
  const owner = generateDeviceIdentity('Owner');
  const ownerKeys = {
    publicKeyHex: owner.publicKey,
    privateKeyHex: extractSigningPrivateKeyHex(owner.privateKeyRef),
  };

  it('verifies owner, node, and author tombstones against the allowed set', () => {
    const accepted = makeAccepted();
    const allowed = [owner.publicKey, node.publicKeyHex, accepted.post.personaPubkey];
    for (const signer of [ownerKeys, node, persona]) {
      const t = createPublicPostTombstone(signer, { publicationId: 'pub-1', postId: accepted.post.postId, now: NOW });
      expect(verifyPublicPostTombstone(t, allowed)).toBe(true);
    }
  });

  it('rejects a tombstone from a stranger key even when validly signed', () => {
    const stranger = keypair();
    const t = createPublicPostTombstone(stranger, { publicationId: 'pub-1', postId: 'p1', now: NOW });
    expect(verifyPublicPostTombstone(t, [owner.publicKey, node.publicKeyHex])).toBe(false);
  });

  it('rejects a tombstone whose signer field was swapped to an allowed key', () => {
    const stranger = keypair();
    const t = createPublicPostTombstone(stranger, { publicationId: 'pub-1', postId: 'p1', now: NOW });
    const swapped = { ...t, signerKeyHex: owner.publicKey };
    expect(verifyPublicPostTombstone(swapped, [owner.publicKey])).toBe(false);
  });

  it('freeze records verify only from allowed signers and cover the frozen bit', () => {
    const f = createPublicPostingFreeze(ownerKeys, { publicationId: 'pub-1', frozen: true, now: NOW });
    expect(verifyPublicPostingFreeze(f, [owner.publicKey])).toBe(true);
    expect(verifyPublicPostingFreeze(f, [node.publicKeyHex])).toBe(false);
    const flipped = { ...f, frozen: false };
    expect(verifyPublicPostingFreeze(flipped, [owner.publicKey])).toBe(false);
  });
});
