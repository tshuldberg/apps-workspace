/**
 * Plan 52 P1/P2 mailbox layer: the propose / accept / announce kinds that
 * carry mutual attestation and person proofs over the pair-private mailbox.
 *
 * The adversarial review (2026-07-29) found this layer shipped with zero
 * coverage and one HIGH (announce drafts co-signed with no binding to the doc
 * being signed). Every gate it identified is pinned here, driven through the
 * REAL dispatcher (applyMailboxEnvelope) so the checks are proven where they
 * actually run, not just where they are defined.
 */

import { describe, expect, it } from 'vitest';
import {
  PERSON_GROUP_ACCEPT_MAILBOX_KIND,
  PERSON_GROUP_ANNOUNCE_MAILBOX_KIND,
  PERSON_GROUP_PROPOSE_MAILBOX_KIND,
  assemblePersonGroupAnnounce,
  buildPersonGroupAnnounce,
  buildPersonGroupRevision,
  canonicalPersonAnnounceBytes,
  canonicalPersonGroupBytes,
  communityDerivationContext,
  dmPeerDerivationContext,
  encodeMailboxEnvelope,
  generateDeviceIdentity,
  parsePersonGroupAcceptPayload,
  parsePersonGroupProposePayload,
  personGroupProposalHash,
  sealMailboxDelta,
  signPersonCanonicalBytes,
  verifyPersonGroupAccept,
  verifyPersonGroupAnnouncePayload,
  verifyPersonGroupProposePayload,
  type PersonGroupAcceptPayload,
  type PersonGroupAnnouncePayload,
  type UnsignedPersonGroupDoc,
} from '../index';
import { applyMailboxEnvelope, type MailboxEnvelopeHandlers } from '../protocol/mailbox-dispatch';

type Identity = ReturnType<typeof generateDeviceIdentity>;

const NOW = '2026-07-29T12:00:00.000Z';
const SECRET = 'a'.repeat(64);

function unsignedDoc(identities: Identity[], now = NOW): UnsignedPersonGroupDoc {
  const built = buildPersonGroupRevision({
    previous: null,
    secretHex: SECRET,
    add: identities.map((identity, i) => ({ deviceId: identity.publicKey, label: `D${i}` })),
    now,
  });
  if (!built.ok) throw new Error(`build failed: ${built.reason}`);
  return built.doc;
}

function sign(identity: Identity, doc: UnsignedPersonGroupDoc): string {
  return signPersonCanonicalBytes(identity, canonicalPersonGroupBytes(doc));
}

/** Seal a payload from sender to recipient and run the real dispatcher. */
async function dispatch(
  sender: Identity,
  recipient: Identity,
  payload: unknown,
  handlers: MailboxEnvelopeHandlers,
) {
  const envelope = sealMailboxDelta(
    sender,
    { deviceId: recipient.publicKey, dhPublicKey: recipient.dhPublicKey },
    payload,
    NOW,
  );
  return applyMailboxEnvelope(recipient, encodeMailboxEnvelope(envelope), handlers);
}

describe('person-group propose over the mailbox', () => {
  it('an honest proposal reaches the handler', async () => {
    const [a, b] = [generateDeviceIdentity('A'), generateDeviceIdentity('B')];
    const doc = unsignedDoc([a, b]);
    let seen = false;
    const outcome = await dispatch(a, b, {
      kind: PERSON_GROUP_PROPOSE_MAILBOX_KIND,
      version: 1,
      doc,
      signatures: { [a.publicKey]: sign(a, doc) },
    }, {
      personGroupPropose: (senderDeviceId) => {
        seen = senderDeviceId === a.publicKey;
        return true;
      },
    });
    expect(outcome).toEqual({ kind: 'person-group-propose' });
    expect(seen).toBe(true);
  });

  it('MEDIUM-6: a proposal the sender did not sign never reaches the handler', async () => {
    const [a, b] = [generateDeviceIdentity('A'), generateDeviceIdentity('B')];
    const doc = unsignedDoc([a, b]);
    let called = false;
    const outcome = await dispatch(a, b, {
      kind: PERSON_GROUP_PROPOSE_MAILBOX_KIND,
      version: 1,
      doc,
      signatures: { [a.publicKey]: 'deadbeef' },
    }, { personGroupPropose: () => { called = true; return true; } });
    expect(outcome).toEqual({ kind: 'rejected' });
    expect(called).toBe(false);
  });

  it('MEDIUM-6: a proposal that does not list the RECIPIENT is rejected', async () => {
    const [a, b, c] = [generateDeviceIdentity('A'), generateDeviceIdentity('B'), generateDeviceIdentity('C')];
    const doc = unsignedDoc([a, c]); // b is not listed
    let called = false;
    const outcome = await dispatch(a, b, {
      kind: PERSON_GROUP_PROPOSE_MAILBOX_KIND,
      version: 1,
      doc,
      signatures: { [a.publicKey]: sign(a, doc) },
    }, { personGroupPropose: () => { called = true; return true; } });
    expect(outcome).toEqual({ kind: 'rejected' });
    expect(called).toBe(false);
  });

  it('MEDIUM-6: a bogus co-signature for a listed device is rejected', () => {
    const [a, b] = [generateDeviceIdentity('A'), generateDeviceIdentity('B')];
    const doc = unsignedDoc([a, b]);
    expect(verifyPersonGroupProposePayload(a.publicKey, b.publicKey, {
      kind: PERSON_GROUP_PROPOSE_MAILBOX_KIND,
      version: 1,
      doc,
      signatures: { [a.publicKey]: sign(a, doc), [b.publicKey]: 'ff'.repeat(32) },
    })).toBe(false);
  });

  it('HIGH-3: a proposal carrying an announce draft not bound to the doc fails to parse', () => {
    const [a, b] = [generateDeviceIdentity('A'), generateDeviceIdentity('B')];
    const stranger = generateDeviceIdentity('Stranger');
    const doc = unsignedDoc([a, b]);
    const honest = buildPersonGroupAnnounce(doc, SECRET, communityDerivationContext('c1'), NOW);
    // Honest drafts parse.
    expect(parsePersonGroupProposePayload({
      kind: PERSON_GROUP_PROPOSE_MAILBOX_KIND,
      version: 1,
      doc,
      signatures: { [a.publicKey]: sign(a, doc) },
      announces: [honest],
    })).not.toBeNull();
    // A draft aimed at a third party at an out-ranking revision does not.
    expect(parsePersonGroupProposePayload({
      kind: PERSON_GROUP_PROPOSE_MAILBOX_KIND,
      version: 1,
      doc,
      signatures: { [a.publicKey]: sign(a, doc) },
      announces: [{ ...honest, context: dmPeerDerivationContext(stranger.publicKey), revision: 4242 }],
    })).toBeNull();
  });

  it('DoS: an oversized device list or draft array fails to parse before any crypto', () => {
    const [a, b] = [generateDeviceIdentity('A'), generateDeviceIdentity('B')];
    const doc = unsignedDoc([a, b]);
    const flooded = {
      ...doc,
      devices: Array.from({ length: 10_000 }, (_, i) => ({
        deviceId: `${i}`.padStart(64, '0'),
        label: 'x',
        addedAt: NOW,
      })),
    };
    expect(parsePersonGroupProposePayload({
      kind: PERSON_GROUP_PROPOSE_MAILBOX_KIND,
      version: 1,
      doc: flooded,
      signatures: {},
    })).toBeNull();

    const draft = buildPersonGroupAnnounce(doc, SECRET, communityDerivationContext('c1'), NOW);
    expect(parsePersonGroupProposePayload({
      kind: PERSON_GROUP_PROPOSE_MAILBOX_KIND,
      version: 1,
      doc,
      signatures: { [a.publicKey]: sign(a, doc) },
      announces: Array.from({ length: 5_000 }, () => draft),
    })).toBeNull();
  });
});

describe('person-group accept over the mailbox', () => {
  function acceptPayload(signer: Identity, doc: UnsignedPersonGroupDoc): PersonGroupAcceptPayload {
    return {
      kind: PERSON_GROUP_ACCEPT_MAILBOX_KIND,
      version: 1,
      proposalHash: personGroupProposalHash(doc),
      doc,
      signature: sign(signer, doc),
    };
  }

  it('an honest accept reaches the handler', async () => {
    const [a, b] = [generateDeviceIdentity('A'), generateDeviceIdentity('B')];
    const doc = unsignedDoc([a, b]);
    const outcome = await dispatch(b, a, acceptPayload(b, doc), {
      personGroupAccept: () => true,
    });
    expect(outcome).toEqual({ kind: 'person-group-accept' });
  });

  it('MEDIUM-7: an accept whose proposalHash does not match its doc is rejected', async () => {
    const [a, b] = [generateDeviceIdentity('A'), generateDeviceIdentity('B')];
    const doc = unsignedDoc([a, b]);
    const other = unsignedDoc([a, b], '2026-07-29T13:00:00.000Z');
    let called = false;
    const outcome = await dispatch(b, a, {
      ...acceptPayload(b, doc),
      proposalHash: personGroupProposalHash(other),
    }, { personGroupAccept: () => { called = true; return true; } });
    expect(outcome).toEqual({ kind: 'rejected' });
    expect(called).toBe(false);
  });

  it('MEDIUM-7: an accept from a device not listed in the doc is rejected', () => {
    const [a, b, stranger] = [generateDeviceIdentity('A'), generateDeviceIdentity('B'), generateDeviceIdentity('S')];
    const doc = unsignedDoc([a, b]);
    expect(verifyPersonGroupAccept(stranger.publicKey, acceptPayload(stranger, doc))).toBe(false);
  });

  it('an accept whose signature is over different bytes is rejected', () => {
    const [a, b] = [generateDeviceIdentity('A'), generateDeviceIdentity('B')];
    const doc = unsignedDoc([a, b]);
    const other = unsignedDoc([a, b], '2026-07-29T13:00:00.000Z');
    expect(verifyPersonGroupAccept(b.publicKey, {
      ...acceptPayload(b, doc),
      signature: sign(b, other),
    })).toBe(false);
  });

  it('an accept missing its proposalHash fails to parse', () => {
    const [a, b] = [generateDeviceIdentity('A'), generateDeviceIdentity('B')];
    const doc = unsignedDoc([a, b]);
    const { proposalHash: _drop, ...withoutHash } = acceptPayload(b, doc);
    expect(_drop).toBeTruthy();
    expect(parsePersonGroupAcceptPayload(withoutHash)).toBeNull();
  });
});

describe('DM-peer announce over the mailbox', () => {
  function announceFor(members: Identity[], context: string): PersonGroupAnnouncePayload {
    const doc = unsignedDoc(members);
    const unsigned = buildPersonGroupAnnounce(doc, SECRET, context, NOW);
    const canonical = canonicalPersonAnnounceBytes(unsigned);
    const signatures: Record<string, string> = {};
    for (const identity of members) {
      signatures[identity.publicKey] = signPersonCanonicalBytes(identity, canonical);
    }
    return {
      kind: PERSON_GROUP_ANNOUNCE_MAILBOX_KIND,
      version: 1,
      announce: assemblePersonGroupAnnounce(unsigned, signatures),
    };
  }

  it('an announce derived FOR the recipient is accepted', async () => {
    const [a, b, peer] = [generateDeviceIdentity('A'), generateDeviceIdentity('B'), generateDeviceIdentity('P')];
    const payload = announceFor([a, b], dmPeerDerivationContext(peer.publicKey));
    const outcome = await dispatch(a, peer, payload, { personGroupAnnounce: () => true });
    expect(outcome).toEqual({ kind: 'person-group-announce' });
  });

  it('a COMMUNITY announce delivered to a DM mailbox is rejected', async () => {
    const [a, b, peer] = [generateDeviceIdentity('A'), generateDeviceIdentity('B'), generateDeviceIdentity('P')];
    const payload = announceFor([a, b], communityDerivationContext('c1'));
    const outcome = await dispatch(a, peer, payload, { personGroupAnnounce: () => true });
    expect(outcome).toEqual({ kind: 'rejected' });
  });

  it('an announce minted for a DIFFERENT peer is rejected (transplant)', async () => {
    const [a, b, peer, other] = [
      generateDeviceIdentity('A'), generateDeviceIdentity('B'),
      generateDeviceIdentity('P'), generateDeviceIdentity('O'),
    ];
    const payload = announceFor([a, b], dmPeerDerivationContext(other.publicKey));
    const outcome = await dispatch(a, peer, payload, { personGroupAnnounce: () => true });
    expect(outcome).toEqual({ kind: 'rejected' });
  });

  it('delivery by a device not listed in the announce is rejected', () => {
    const [a, b, peer, stranger] = [
      generateDeviceIdentity('A'), generateDeviceIdentity('B'),
      generateDeviceIdentity('P'), generateDeviceIdentity('S'),
    ];
    const payload = announceFor([a, b], dmPeerDerivationContext(peer.publicKey));
    expect(verifyPersonGroupAnnouncePayload(stranger.publicKey, peer.publicKey, payload)).toBe(false);
    expect(verifyPersonGroupAnnouncePayload(a.publicKey, peer.publicKey, payload)).toBe(true);
  });

  it('a missing handler drops the kind fail-closed', async () => {
    const [a, b, peer] = [generateDeviceIdentity('A'), generateDeviceIdentity('B'), generateDeviceIdentity('P')];
    const payload = announceFor([a, b], dmPeerDerivationContext(peer.publicKey));
    expect(await dispatch(a, peer, payload, {})).toEqual({ kind: 'rejected' });
  });
});
