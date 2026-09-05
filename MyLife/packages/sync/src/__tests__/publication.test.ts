/**
 * Plan 19 (Meerkat Public Social Layer) P0 -- PublicationDescriptor lifecycle.
 *
 * A publication is a SIGNED, portable descriptor that carries the PUBLISHED read
 * key in the clear so anyone can read a public snapshot anonymously. It mirrors
 * the CommunityDescriptor crypto exactly: a content-derived stable id, owner-
 * signed revisions chained by previousHash, and an owner-only revise/unpublish.
 *
 * AC (P0): create/verify/revise/unpublish; not_owner, killed, revision-chain
 * monotonicity, and id-derivation stability.
 */

import { describe, it, expect } from 'vitest';
import { generateDeviceIdentity } from '../identity/device-identity';
import {
  createPublication,
  createPublicJoinGrant,
  publicationDescriptorHash,
  revisePublication,
  unpublish,
  verifyPublication,
  verifyOwnerTakedown,
  verifyPublicJoinGrant,
  type CreatePublicationOptions,
  type PublicJoinGrant,
  type SignedPublicationDescriptor,
} from '../protocol/publication';
import { type PublicationRights } from '../protocol/public-archive';

const GRANT: PublicJoinGrant = { version: 1, ownerDhPublicKey: 'a'.repeat(64), grantId: 'grant-nonce-1' };
const RIGHTS: PublicationRights = { license: 'cc_by', rightsAssertion: 'i_own', provenance: '', consentAt: '2026-06-28T00:00:00.000Z' };

const baseOpts: CreatePublicationOptions = {
  kind: 'community',
  communityId: 'comm-123',
  channelId: null,
  postId: null,
  title: 'NYC Cyclists',
  description: 'A public community for NYC cyclists.',
  category: 'local',
  contentId: 'snapshot-cid-1',
  publicKeyHex: 'aabbccddeeff',
  hostUrls: ['https://relay.example/host'],
  joinPolicy: 'open',
  now: '2026-06-28T00:00:00.000Z',
};

describe('publication descriptor lifecycle (Plan 19 P0)', () => {
  it('creates a genesis that verifies as the owner descriptor', () => {
    const owner = generateDeviceIdentity('Owner');
    const v1 = createPublication(owner, baseOpts);
    expect(verifyPublication(v1)).toBe('ok');
    expect(v1.descriptor.revision).toBe(1);
    expect(v1.descriptor.previousHash).toBeNull();
    expect(v1.descriptor.publicationId).toHaveLength(32);
    expect(v1.descriptor.ownerDeviceId).toBe(owner.publicKey);
    expect(v1.descriptor.status).toBe('active');
    expect(v1.descriptor.publicKeyHex).toBe(baseOpts.publicKeyHex);
    expect(v1.descriptor.joinPolicy).toBe('open');
  });

  it('revises content as a chained revision keeping the stable id', () => {
    const owner = generateDeviceIdentity('Owner');
    const v1 = createPublication(owner, baseOpts);
    const v2 = revisePublication(owner, v1, {
      title: 'NYC Cyclists v2',
      hostUrls: ['https://relay2.example/host'],
    });
    expect(v2.descriptor.revision).toBe(2);
    expect(v2.descriptor.title).toBe('NYC Cyclists v2');
    expect(v2.descriptor.hostUrls).toEqual(['https://relay2.example/host']);
    expect(v2.descriptor.publicationId).toBe(v1.descriptor.publicationId);
    expect(v2.descriptor.previousHash).toBe(publicationDescriptorHash(v1));
    expect(verifyPublication(v2, v1)).toBe('ok');
  });

  it('unpublish flips status to unpublished as a chained revision that still verifies', () => {
    const owner = generateDeviceIdentity('Owner');
    const v1 = createPublication(owner, baseOpts);
    const u = unpublish(owner, v1);
    expect(u.descriptor.status).toBe('unpublished');
    expect(u.descriptor.revision).toBe(2);
    expect(u.descriptor.previousHash).toBe(publicationDescriptorHash(v1));
    expect(verifyPublication(u, v1)).toBe('ok');
  });

  it('revisePublication and unpublish are owner-only', () => {
    const owner = generateDeviceIdentity('Owner');
    const rando = generateDeviceIdentity('Rando');
    const v1 = createPublication(owner, baseOpts);
    expect(() => revisePublication(rando, v1, { title: 'Coup' })).toThrow();
    expect(() => unpublish(rando, v1)).toThrow();
  });

  it('flags a revision that claims a different owner than the genesis (not_owner)', () => {
    const owner = generateDeviceIdentity('Owner');
    const usurper = generateDeviceIdentity('Usurper');
    const v1 = createPublication(owner, baseOpts);
    const v2 = revisePublication(owner, v1, { title: 'Renamed' });
    const takeover: SignedPublicationDescriptor = {
      ...v2,
      descriptor: { ...v2.descriptor, ownerDeviceId: usurper.publicKey },
    };
    expect(verifyPublication(takeover, v1)).toBe('not_owner');
  });

  it('refuses to honor a forged (unsigned) killed bit: it is invalid, not killed', () => {
    // Censorship/DoS guard: anyone could flip status to 'killed' on a copy to
    // suppress a publication. Flipping it without re-signing breaks id-derivation
    // (genesis) / the signature, so verify must return 'invalid', never 'killed'.
    const owner = generateDeviceIdentity('Owner');
    const v1 = createPublication(owner, baseOpts);
    const forgedKilledGenesis: SignedPublicationDescriptor = {
      ...v1,
      descriptor: { ...v1.descriptor, status: 'killed' },
    };
    expect(verifyPublication(forgedKilledGenesis)).toBe('invalid');

    // Same on a chained revision: the flipped status breaks the owner signature.
    const v2 = revisePublication(owner, v1, { title: 'v2' });
    const forgedKilledRevision: SignedPublicationDescriptor = {
      ...v2,
      descriptor: { ...v2.descriptor, status: 'killed' },
    };
    expect(verifyPublication(forgedKilledRevision, v1)).toBe('invalid');
  });

  it('fail-closed: a revision (>1) presented without its predecessor is invalid', () => {
    // FIX 2 guard: an attacker mints a self-signed "revision 2" claiming a victim's
    // publicationId. A single-arg (no-predecessor) verify must NOT fall through to
    // a signature-only check and return 'ok'.
    const victim = generateDeviceIdentity('Victim');
    const attacker = generateDeviceIdentity('Attacker');
    const victimGenesis = createPublication(victim, baseOpts);
    const attackerGenesis = createPublication(attacker, { ...baseOpts, title: 'attacker base' });
    const attackerV2 = revisePublication(attacker, attackerGenesis, { title: 'forged rev 2' });
    const forged: SignedPublicationDescriptor = {
      ...attackerV2,
      descriptor: { ...attackerV2.descriptor, publicationId: victimGenesis.descriptor.publicationId },
    };
    expect(verifyPublication(forged)).toBe('invalid');

    // A LEGIT revision is also invalid without its predecessor, but valid with it.
    const legitV2 = revisePublication(victim, victimGenesis, { title: 'v2' });
    expect(verifyPublication(legitV2)).toBe('invalid');
    expect(verifyPublication(legitV2, victimGenesis)).toBe('ok');
  });

  it('rejects a tampered genesis (id no longer derives) as invalid', () => {
    const owner = generateDeviceIdentity('Owner');
    const v1 = createPublication(owner, baseOpts);
    const tampered: SignedPublicationDescriptor = {
      ...v1,
      descriptor: { ...v1.descriptor, title: 'Hijacked' },
    };
    expect(verifyPublication(tampered)).toBe('invalid');
  });

  it('chains revisions monotonically and rejects a broken chain', () => {
    const owner = generateDeviceIdentity('Owner');
    const v1 = createPublication(owner, baseOpts);
    const v2 = revisePublication(owner, v1, { contentId: 'snapshot-cid-2' });
    const v3 = revisePublication(owner, v2, { contentId: 'snapshot-cid-3' });

    expect(v2.descriptor.revision).toBe(2);
    expect(v3.descriptor.revision).toBe(3);
    expect(v2.descriptor.previousHash).toBe(publicationDescriptorHash(v1));
    expect(v3.descriptor.previousHash).toBe(publicationDescriptorHash(v2));
    expect(v2.descriptor.publicationId).toBe(v1.descriptor.publicationId);

    expect(verifyPublication(v2, v1)).toBe('ok');
    expect(verifyPublication(v3, v2)).toBe('ok');
    // Wrong predecessor / skipped revision number.
    expect(verifyPublication(v3, v1)).toBe('invalid');
    expect(verifyPublication(v2, v3)).toBe('invalid');
  });

  it('derives a stable id from the genesis content (same in -> same id; any change -> new id)', () => {
    const owner = generateDeviceIdentity('Owner');
    const a = createPublication(owner, baseOpts);
    const b = createPublication(owner, baseOpts);
    expect(a.descriptor.publicationId).toBe(b.descriptor.publicationId);

    const titleChanged = createPublication(owner, { ...baseOpts, title: 'Different Title' });
    expect(titleChanged.descriptor.publicationId).not.toBe(a.descriptor.publicationId);

    const categoryChanged = createPublication(owner, { ...baseOpts, category: 'gaming' });
    expect(categoryChanged.descriptor.publicationId).not.toBe(a.descriptor.publicationId);

    const ownerChanged = createPublication(generateDeviceIdentity('Other'), baseOpts);
    expect(ownerChanged.descriptor.publicationId).not.toBe(a.descriptor.publicationId);
  });
});

const rights: PublicationRights = {
  license: 'cc_by',
  rightsAssertion: 'i_own',
  provenance: 'Photographed by me, 2026.',
  consentAt: '2026-06-28T00:00:00.000Z',
};

describe('publication descriptor rights/consent block (Plan 19 P9.3b)', () => {
  it('a rights-less publication verifies ok and carries no rights field (backward compatible)', () => {
    const owner = generateDeviceIdentity('Owner');
    const v1 = createPublication(owner, baseOpts);
    expect(verifyPublication(v1)).toBe('ok');
    expect(v1.descriptor.rights ?? null).toBeNull();
  });

  it('carries an owner-signed rights block when provided and verifies ok', () => {
    const owner = generateDeviceIdentity('Owner');
    const v1 = createPublication(owner, { ...baseOpts, rights });
    expect(verifyPublication(v1)).toBe('ok');
    expect(v1.descriptor.rights).toEqual(rights);
  });

  it('carries the rights forward across a revision and the chain verifies', () => {
    const owner = generateDeviceIdentity('Owner');
    const v1 = createPublication(owner, { ...baseOpts, rights });
    const v2 = revisePublication(owner, v1, { title: 'Renamed' });
    expect(v2.descriptor.rights).toEqual(rights);
    expect(verifyPublication(v2, v1)).toBe('ok');
  });

  it('fails closed when the signed rights block is mutated', () => {
    const owner = generateDeviceIdentity('Owner');
    const v1 = createPublication(owner, { ...baseOpts, rights });
    const mutated: SignedPublicationDescriptor = {
      ...v1,
      descriptor: { ...v1.descriptor, rights: { ...rights, license: 'cc0' } },
    };
    expect(verifyPublication(mutated)).toBe('invalid');
  });

  it('fails closed when rights are stripped from a rights-bearing descriptor', () => {
    const owner = generateDeviceIdentity('Owner');
    const v1 = createPublication(owner, { ...baseOpts, rights });
    const stripped: SignedPublicationDescriptor = {
      ...v1,
      descriptor: { ...v1.descriptor, rights: null },
    };
    expect(verifyPublication(stripped)).toBe('invalid');
  });

  it('fails closed when rights are injected onto a rights-less descriptor', () => {
    // Proves the rights-less canonical EXCLUDES rights: a rights-less descriptor's
    // signature is over 20 fields, so adding a 21st (rights) breaks id-derivation.
    const owner = generateDeviceIdentity('Owner');
    const v1 = createPublication(owner, baseOpts);
    const injected: SignedPublicationDescriptor = {
      ...v1,
      descriptor: { ...v1.descriptor, rights },
    };
    expect(verifyPublication(injected)).toBe('invalid');
  });

  it('rejects a malformed rights object as invalid', () => {
    const owner = generateDeviceIdentity('Owner');
    const v1 = createPublication(owner, { ...baseOpts, rights });
    const malformed: SignedPublicationDescriptor = {
      ...v1,
      descriptor: { ...v1.descriptor, rights: { license: 'cc_by' } as PublicationRights },
    };
    expect(verifyPublication(malformed)).toBe('invalid');
  });
});

describe('verifyOwnerTakedown (Plan 19 FF1: terminal, any-revision, owner-authenticated)', () => {
  it('accepts an owner-signed takedown at ANY revision above genesis (no previousHash adjacency)', () => {
    const owner = generateDeviceIdentity('Owner');
    const v1 = createPublication(owner, baseOpts);
    const v2 = revisePublication(owner, v1, { title: 'v2' });
    const v3 = revisePublication(owner, v2, { title: 'v3' });
    const taken = unpublish(owner, v3); // revision 4, status 'unpublished'
    expect(taken.descriptor.revision).toBe(4);

    // The directory only stores the GENESIS (v1). A standard chained verify fails
    // (revision 4 is not adjacent to v1), but a terminal takedown is idempotent +
    // owner-authenticated, so verifyOwnerTakedown accepts it against the genesis.
    expect(verifyPublication(taken, v1)).toBe('invalid');
    expect(verifyOwnerTakedown(taken, v1)).toBe(true);
  });

  it('rejects a non-owner forged takedown (owner mismatch / bad signature)', () => {
    const owner = generateDeviceIdentity('Owner');
    const attacker = generateDeviceIdentity('Attacker');
    const v1 = createPublication(owner, baseOpts);
    const attackerGenesis = createPublication(attacker, baseOpts);
    const attackerTakedown = unpublish(attacker, attackerGenesis);
    // Forge the victim's publicationId onto the attacker's signed takedown.
    const forged: SignedPublicationDescriptor = {
      ...attackerTakedown,
      descriptor: { ...attackerTakedown.descriptor, publicationId: v1.descriptor.publicationId },
    };
    expect(verifyOwnerTakedown(forged, v1)).toBe(false);
  });

  it('rejects an active descriptor, a wrong publicationId, and a non-greater revision', () => {
    const owner = generateDeviceIdentity('Owner');
    const other = generateDeviceIdentity('Other');
    const v1 = createPublication(owner, baseOpts);
    const v2active = revisePublication(owner, v1, { title: 'still active' });
    // active status is not a takedown.
    expect(verifyOwnerTakedown(v2active, v1)).toBe(false);

    // wrong genesis (different publication).
    const otherGenesis = createPublication(other, { ...baseOpts, title: 'other' });
    const taken = unpublish(owner, v1);
    expect(verifyOwnerTakedown(taken, otherGenesis)).toBe(false);

    // revision must be strictly greater than the genesis revision.
    const genesisAsTakedown: SignedPublicationDescriptor = {
      ...v1,
      descriptor: { ...v1.descriptor, status: 'unpublished' },
    };
    expect(verifyOwnerTakedown(genesisAsTakedown, v1)).toBe(false);
  });
});

describe('public-join grant (Plan 19 FF3: owner-signed, unforgeable, non-transplantable)', () => {
  it('a valid open-join grant verifies; the descriptor signature IS its authentication', () => {
    const owner = generateDeviceIdentity('Owner');
    const v1 = createPublication(owner, { ...baseOpts, joinPolicy: 'open', publicJoin: GRANT });
    expect(verifyPublication(v1)).toBe('ok');
    expect(v1.descriptor.publicJoin).toEqual(GRANT);
    expect(verifyPublicJoinGrant(v1)).toBe(true);
  });

  it('is UNFORGEABLE: mutating any signed grant field breaks the owner signature -> invalid', () => {
    const owner = generateDeviceIdentity('Owner');
    const v1 = createPublication(owner, { ...baseOpts, joinPolicy: 'open', publicJoin: GRANT });
    for (const bad of [
      { ...GRANT, grantId: 'attacker-rotated' },
      { ...GRANT, ownerDhPublicKey: 'b'.repeat(64) },
    ] as PublicJoinGrant[]) {
      const forged: SignedPublicationDescriptor = { ...v1, descriptor: { ...v1.descriptor, publicJoin: bad } };
      expect(verifyPublication(forged)).toBe('invalid');
      expect(verifyPublicJoinGrant(forged)).toBe(false);
    }
  });

  it('is NON-TRANSPLANTABLE: lifting a valid grant onto another publication -> invalid', () => {
    const owner = generateDeviceIdentity('Owner');
    const v1 = createPublication(owner, { ...baseOpts, joinPolicy: 'open', publicJoin: GRANT });
    const otherOwner = generateDeviceIdentity('Other');
    const b = createPublication(otherOwner, { ...baseOpts, communityId: 'comm-other', contentId: 'cid-other', joinPolicy: 'open' });
    // Transplant v1's signed grant block onto B's descriptor.
    const transplanted: SignedPublicationDescriptor = { ...b, descriptor: { ...b.descriptor, publicJoin: v1.descriptor.publicJoin } };
    expect(verifyPublication(transplanted)).toBe('invalid');
    expect(verifyPublicJoinGrant(transplanted)).toBe(false);
  });

  it('byte-identity: a grant-less descriptor canonicalizes byte-identical to a pre-FF3 one', () => {
    const owner = generateDeviceIdentity('Owner');
    const plain = createPublication(owner, baseOpts);
    expect(plain.descriptor.publicJoin).toBeUndefined();
    expect(verifyPublication(plain)).toBe('ok');
    // Adding a grant changes the derived id (the grant is in the canonical bytes).
    const withGrant = createPublication(owner, { ...baseOpts, publicJoin: GRANT });
    expect(withGrant.descriptor.publicationId).not.toBe(plain.descriptor.publicationId);
  });

  it('canonical disambiguation: (rights-absent, join-present) != (rights-present, join-absent)', () => {
    const owner = generateDeviceIdentity('Owner');
    const joinOnly = createPublication(owner, { ...baseOpts, publicJoin: GRANT });
    const rightsOnly = createPublication(owner, { ...baseOpts, rights: RIGHTS });
    const both = createPublication(owner, { ...baseOpts, rights: RIGHTS, publicJoin: GRANT });
    for (const p of [joinOnly, rightsOnly, both]) expect(verifyPublication(p)).toBe('ok');
    // All three produce distinct canonical bytes (distinct hashes / ids).
    const hashes = new Set([
      publicationDescriptorHash(joinOnly),
      publicationDescriptorHash(rightsOnly),
      publicationDescriptorHash(both),
    ]);
    expect(hashes.size).toBe(3);
  });

  it('fails closed on a malformed grant shape (bad version / non-64-hex DH / non-string grantId)', () => {
    const owner = generateDeviceIdentity('Owner');
    for (const bad of [
      { version: 2, ownerDhPublicKey: 'a'.repeat(64), grantId: 'g' },
      { version: 1, ownerDhPublicKey: 'nothex', grantId: 'g' },
      { version: 1, ownerDhPublicKey: 'a'.repeat(64), grantId: 123 },
    ]) {
      const p = createPublication(owner, { ...baseOpts, publicJoin: bad as unknown as PublicJoinGrant });
      expect(verifyPublication(p)).toBe('invalid'); // shape-validated before id-derivation; no throw
    }
  });

  it('createPublicJoinGrant mints an owner-DH grant that round-trips through create + revise', () => {
    const owner = generateDeviceIdentity('Owner');
    // Deterministic injected PRNG for the grantId nonce.
    const randomBytes = (n: number) => new Uint8Array(n).fill(0xab);
    const grant = createPublicJoinGrant(owner, randomBytes);
    expect(grant).toEqual({ version: 1, ownerDhPublicKey: owner.dhPublicKey, grantId: 'ab'.repeat(16) });

    // Open policy + the minted grant verifies true and survives a revision.
    const open = createPublication(owner, { ...baseOpts, joinPolicy: 'open', publicJoin: grant });
    expect(verifyPublication(open)).toBe('ok');
    expect(verifyPublicJoinGrant(open)).toBe(true);
    const revised = revisePublication(owner, open, { title: 'Renamed' });
    expect(revised.descriptor.publicJoin).toEqual(grant); // grant carried forward across the revision
    expect(verifyPublication(revised, open)).toBe('ok');

    // The open-only gate holds: the SAME minted grant on a request-policy descriptor
    // never auto-approves.
    const request = createPublication(owner, { ...baseOpts, joinPolicy: 'request', publicJoin: grant });
    expect(verifyPublication(request)).toBe('ok');
    expect(verifyPublicJoinGrant(request)).toBe(false);
  });

  it('a grant-less publish canonicalizes byte-identical to a pre-FF3 descriptor (signature unchanged)', () => {
    const owner = generateDeviceIdentity('Owner');
    // publicJoin:null is treated as absent, so the canonical bytes exclude the grant
    // tuple entirely -> identical signature to a plain (pre-FF3) publish.
    const plain = createPublication(owner, baseOpts);
    const explicitNull = createPublication(owner, { ...baseOpts, publicJoin: null });
    expect(plain.descriptor.publicJoin).toBeUndefined();
    expect(explicitNull.descriptor.publicJoin).toBeUndefined();
    expect(plain.signature).toBe(explicitNull.signature);
    expect(plain.descriptor.publicationId).toBe(explicitNull.descriptor.publicationId);

    // Adding a grant is signed: it changes the canonical bytes (new id + signature).
    const withGrant = createPublication(owner, { ...baseOpts, publicJoin: createPublicJoinGrant(owner, (n) => new Uint8Array(n).fill(1)) });
    expect(withGrant.signature).not.toBe(plain.signature);
    expect(withGrant.descriptor.publicationId).not.toBe(plain.descriptor.publicationId);
  });

  it('verifyPublicJoinGrant is fail-closed on policy + lifecycle (revocation levers)', () => {
    const owner = generateDeviceIdentity('Owner');
    const open = createPublication(owner, { ...baseOpts, joinPolicy: 'open', publicJoin: GRANT });
    expect(verifyPublicJoinGrant(open)).toBe(true);

    // request policy: no auto-approve even with a grant present.
    const request = createPublication(owner, { ...baseOpts, joinPolicy: 'request', publicJoin: GRANT });
    expect(verifyPublicJoinGrant(request)).toBe(false);

    // grant absent: nothing to redeem.
    const noGrant = createPublication(owner, { ...baseOpts, joinPolicy: 'open' });
    expect(verifyPublicJoinGrant(noGrant)).toBe(false);

    // Revocation by policy flip open -> request (chained owner revision).
    const flipped = revisePublication(owner, open, { joinPolicy: 'request' });
    expect(verifyPublicJoinGrant(flipped)).toBe(false);

    // Revocation by dropping the grant block.
    const dropped = revisePublication(owner, open, { publicJoin: null });
    expect(dropped.descriptor.publicJoin == null).toBe(true);
    expect(verifyPublicJoinGrant(dropped)).toBe(false);

    // Unpublished / killed are not redeemable.
    const taken = unpublish(owner, open);
    expect(verifyPublicJoinGrant(taken)).toBe(false);
    const killed: SignedPublicationDescriptor = { ...open, descriptor: { ...open.descriptor, status: 'killed' } };
    expect(verifyPublicJoinGrant(killed)).toBe(false);
  });
});
