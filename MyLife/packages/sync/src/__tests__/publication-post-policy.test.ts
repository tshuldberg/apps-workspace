/**
 * Plan 39 P4 -- postPolicy (+ pinned node receipt key) on PublicationDescriptor.
 *
 * Both ride the tagged conditional-canonical-append pattern (rights / publicJoin
 * precedent): absent fields canonicalize byte-identically to a pre-P4 descriptor,
 * present fields are signature-covered, and the EFFECTIVE policy fails closed to
 * 'view_only' whenever the field is absent or unrecognized.
 */

import { describe, it, expect } from 'vitest';
import { generateDeviceIdentity } from '../identity/device-identity';
import {
  createPublication,
  effectivePostPolicy,
  revisePublication,
  verifyPublication,
  verifyPublicationOwnerSignature,
  type CreatePublicationOptions,
  type PublicationDescriptor,
  type SignedPublicationDescriptor,
} from '../protocol/publication';

const NODE_KEY = 'ab'.repeat(32);

const baseOpts: CreatePublicationOptions = {
  kind: 'community',
  communityId: 'comm-postpolicy',
  channelId: null,
  postId: null,
  title: 'Open Posting Test',
  description: 'postPolicy conditional-append coverage.',
  category: 'discussion',
  contentId: 'snapshot-cid-pp',
  publicKeyHex: 'aabbccddeeff',
  hostUrls: ['https://relay.example/host'],
  joinPolicy: 'open',
  now: '2026-07-06T00:00:00.000Z',
};

describe('postPolicy protocol (Plan 39 P4)', () => {
  it('absent postPolicy verifies unchanged and fails closed to view_only', () => {
    const owner = generateDeviceIdentity('Owner');
    const v1 = createPublication(owner, baseOpts);
    expect(v1.descriptor.postPolicy).toBeUndefined();
    expect(verifyPublication(v1)).toBe('ok');
    expect(effectivePostPolicy(v1.descriptor)).toBe('view_only');
  });

  it('a pre-P4 descriptor fixture (no postPolicy field anywhere) still verifies', () => {
    const owner = generateDeviceIdentity('Owner');
    const v1 = createPublication(owner, baseOpts);
    // Simulate an old-wire descriptor: serialize + reparse drops nothing, but assert
    // the canonical form carries NO post-policy tag when the field is absent.
    const rehydrated = JSON.parse(JSON.stringify(v1)) as SignedPublicationDescriptor;
    expect('postPolicy' in rehydrated.descriptor).toBe(false);
    expect('postNodeKeyHex' in rehydrated.descriptor).toBe(false);
    expect(verifyPublication(rehydrated)).toBe('ok');
    expect(verifyPublicationOwnerSignature(rehydrated)).toBe(true);
  });

  it('signs and verifies each declared policy round-trip', () => {
    const owner = generateDeviceIdentity('Owner');
    for (const policy of ['view_only', 'approval', 'open'] as const) {
      const signed = createPublication(owner, { ...baseOpts, postPolicy: policy });
      expect(verifyPublication(signed)).toBe('ok');
      expect(effectivePostPolicy(signed.descriptor)).toBe(policy);
    }
  });

  it('tampering the postPolicy breaks the descriptor signature', () => {
    const owner = generateDeviceIdentity('Owner');
    const signed = createPublication(owner, { ...baseOpts, postPolicy: 'open' });
    const tampered: SignedPublicationDescriptor = {
      ...signed,
      descriptor: { ...signed.descriptor, postPolicy: 'view_only' },
    };
    expect(verifyPublication(tampered)).toBe('invalid');
    expect(verifyPublicationOwnerSignature(tampered)).toBe(false);
  });

  it('ADDING a postPolicy to a policy-less signed descriptor breaks verification', () => {
    const owner = generateDeviceIdentity('Owner');
    const signed = createPublication(owner, baseOpts);
    const upgraded: SignedPublicationDescriptor = {
      ...signed,
      descriptor: { ...signed.descriptor, postPolicy: 'open' },
    };
    expect(verifyPublication(upgraded)).toBe('invalid');
  });

  it('STRIPPING the postPolicy from a policy-bearing signed descriptor breaks verification', () => {
    const owner = generateDeviceIdentity('Owner');
    const signed = createPublication(owner, { ...baseOpts, postPolicy: 'open' });
    const { postPolicy, ...rest } = signed.descriptor;
    expect(postPolicy).toBe('open');
    const stripped: SignedPublicationDescriptor = { ...signed, descriptor: rest as PublicationDescriptor };
    expect(verifyPublication(stripped)).toBe('invalid');
  });

  it('an owner-signed UNRECOGNIZED policy value verifies but degrades to view_only', () => {
    const owner = generateDeviceIdentity('Owner');
    const signed = createPublication(owner, {
      ...baseOpts,
      postPolicy: 'members_plus_friends' as unknown as 'open',
    });
    expect(verifyPublication(signed)).toBe('ok');
    expect(effectivePostPolicy(signed.descriptor)).toBe('view_only');
  });

  it('a non-string postPolicy is rejected as invalid (fail-closed shape)', () => {
    const owner = generateDeviceIdentity('Owner');
    const signed = createPublication(owner, { ...baseOpts, postPolicy: 'open' });
    const malformed: SignedPublicationDescriptor = {
      ...signed,
      descriptor: { ...signed.descriptor, postPolicy: 7 as unknown as 'open' },
    };
    expect(verifyPublication(malformed)).toBe('invalid');
    expect(verifyPublicationOwnerSignature(malformed)).toBe(false);
  });

  it('revising a policy is owner-signed and chain-verified; kill-switch to view_only round-trips', () => {
    const owner = generateDeviceIdentity('Owner');
    const v1 = createPublication(owner, { ...baseOpts, postPolicy: 'open', postNodeKeyHex: NODE_KEY });
    const v2 = revisePublication(owner, v1, { postPolicy: 'view_only' }, '2026-07-06T01:00:00.000Z');
    expect(verifyPublication(v2, v1)).toBe('ok');
    expect(effectivePostPolicy(v2.descriptor)).toBe('view_only');
    // The pinned node key rides along unchanged.
    expect(v2.descriptor.postNodeKeyHex).toBe(NODE_KEY);
  });

  it('pins the node receipt key signature-covered; tamper breaks verification', () => {
    const owner = generateDeviceIdentity('Owner');
    const signed = createPublication(owner, { ...baseOpts, postPolicy: 'open', postNodeKeyHex: NODE_KEY });
    expect(verifyPublication(signed)).toBe('ok');
    const swapped: SignedPublicationDescriptor = {
      ...signed,
      descriptor: { ...signed.descriptor, postNodeKeyHex: 'cd'.repeat(32) },
    };
    expect(verifyPublication(swapped)).toBe('invalid');
  });

  it('rejects a malformed node receipt key fail-closed', () => {
    const owner = generateDeviceIdentity('Owner');
    const signed = createPublication(owner, { ...baseOpts, postPolicy: 'open', postNodeKeyHex: NODE_KEY });
    const malformed: SignedPublicationDescriptor = {
      ...signed,
      descriptor: { ...signed.descriptor, postNodeKeyHex: 'not-hex' },
    };
    expect(verifyPublication(malformed)).toBe('invalid');
    expect(verifyPublicationOwnerSignature(malformed)).toBe(false);
  });

  it('(policy-present, key-absent) never collides with (policy-absent, key-present)', () => {
    const owner = generateDeviceIdentity('Owner');
    const policyOnly = createPublication(owner, { ...baseOpts, postPolicy: 'open' });
    const keyOnly = createPublication(owner, { ...baseOpts, postNodeKeyHex: NODE_KEY });
    expect(verifyPublication(policyOnly)).toBe('ok');
    expect(verifyPublication(keyOnly)).toBe('ok');
    // Cross-transplanting the signatures fails: the tagged appends are distinct.
    expect(verifyPublication({ descriptor: policyOnly.descriptor, signature: keyOnly.signature })).toBe('invalid');
    expect(verifyPublication({ descriptor: keyOnly.descriptor, signature: policyOnly.signature })).toBe('invalid');
  });

  it('effectivePostPolicy fails closed on null and undefined descriptors fields', () => {
    const owner = generateDeviceIdentity('Owner');
    const signed = createPublication(owner, baseOpts);
    expect(effectivePostPolicy({ ...signed.descriptor, postPolicy: null })).toBe('view_only');
    expect(effectivePostPolicy(signed.descriptor)).toBe('view_only');
  });
});
