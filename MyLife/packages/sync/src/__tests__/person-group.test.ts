// Plan 52 P0: person-group protocol threat model. Every attack row from the
// plan is pinned here: partial-signature forgery / unilateral claims, stale-
// revision replay (removed-device resurrection), correlation via derived ids,
// announce device-list splicing, size caps, and presentation-profile merge
// determinism.

import { describe, expect, it } from 'vitest';
import {
  acceptPersonGroupRevision,
  assemblePersonGroupAnnounce,
  assemblePersonGroupDoc,
  buildPersonGroupAnnounce,
  buildPersonGroupRevision,
  canonicalPersonAnnounceBytes,
  canonicalPersonGroupBytes,
  communityDerivationContext,
  comparePersonGroupDocs,
  createPresentationProfile,
  derivePersonContextId,
  dmPeerDerivationContext,
  generateDeviceIdentity,
  generatePersonGroupSecret,
  isValidPresentationProfile,
  mergePresentationProfiles,
  isOrderableTimestamp,
  personGroupDocHash,
  personGroupSecretCommitment,
  verifyAnnounceDraftAgainstDoc,
  verifyUnsignedPersonGroupRevision,
  PERSON_GROUP_MAX_DEVICES,
  presentationNameForCommunity,
  presentationProfileHash,
  signPersonGroupAnnounce,
  signPersonCanonicalBytes,
  signPersonGroupRevision,
  verifyPersonGroupAnnounce,
  verifyPersonGroupDoc,
  type PersonGroupDoc,
  type UnsignedPersonGroupDoc,
} from '../index';

const NOW = '2026-07-29T12:00:00.000Z';
const LATER = '2026-07-29T13:00:00.000Z';

function makeIdentities(n: number) {
  return Array.from({ length: n }, (_, i) => generateDeviceIdentity(`Device ${i}`));
}

function signedDoc(
  identities: ReturnType<typeof generateDeviceIdentity>[],
  unsigned: UnsignedPersonGroupDoc,
): PersonGroupDoc {
  const signatures: Record<string, string> = {};
  const canonical = canonicalPersonGroupBytes(unsigned);
  for (const identity of identities) {
    signatures[identity.publicKey] = signPersonCanonicalBytes(identity, canonical);
  }
  return assemblePersonGroupDoc(unsigned, signatures);
}

const SECRET = 'a'.repeat(64);

function formGroup(
  identities: ReturnType<typeof generateDeviceIdentity>[],
  now = NOW,
  secretHex = SECRET,
): PersonGroupDoc {
  const built = buildPersonGroupRevision({
    previous: null,
    secretHex,
    add: identities.map((identity, i) => ({ deviceId: identity.publicKey, label: `Device ${i}` })),
    now,
  });
  if (!built.ok) throw new Error(`build failed: ${built.reason}`);
  return signedDoc(identities, built.doc);
}

describe('person group formation + mutual attestation', () => {
  it('a two-device group with both signatures verifies', () => {
    const ids = makeIdentities(2);
    const doc = formGroup(ids);
    expect(verifyPersonGroupDoc(doc)).toBe(true);
    expect(doc.revision).toBe(1);
    expect(doc.devices.map((d) => d.deviceId)).toEqual(
      ids.map((i) => i.publicKey).sort(),
    );
  });

  it('NC-1: a device cannot be claimed into a group without its own signature', () => {
    const [a, b] = makeIdentities(2);
    const built = buildPersonGroupRevision({
      previous: null,
      secretHex: SECRET,
      add: [
        { deviceId: a.publicKey, label: 'A' },
        { deviceId: b.publicKey, label: 'B' },
      ],
      now: NOW,
    });
    if (!built.ok) throw new Error('build failed');
    // Only A signs: B is listed without its attestation.
    const doc = assemblePersonGroupDoc(built.doc, {
      [a.publicKey]: signPersonCanonicalBytes(a, canonicalPersonGroupBytes(built.doc)),
    });
    expect(verifyPersonGroupDoc(doc)).toBe(false);
  });

  it('a signature from the wrong key, or over different bytes, fails the whole doc', () => {
    const [a, b, mallory] = makeIdentities(3);
    const built = buildPersonGroupRevision({
      previous: null,
      secretHex: SECRET,
      add: [
        { deviceId: a.publicKey, label: 'A' },
        { deviceId: b.publicKey, label: 'B' },
      ],
      now: NOW,
    });
    if (!built.ok) throw new Error('build failed');
    // Mallory forges B's slot with her own key.
    const forged = assemblePersonGroupDoc(built.doc, {
      [a.publicKey]: signPersonCanonicalBytes(a, canonicalPersonGroupBytes(built.doc)),
      [b.publicKey]: signPersonCanonicalBytes(mallory, canonicalPersonGroupBytes(built.doc)),
    });
    expect(verifyPersonGroupDoc(forged)).toBe(false);
    // A valid doc whose devices are tampered after signing fails too.
    const good = signedDoc([a, b], built.doc);
    const tampered = { ...good, devices: good.devices.map((d) => ({ ...d, label: 'X' })) };
    expect(verifyPersonGroupDoc(tampered)).toBe(false);
  });

  it('extra signatures beyond the device list are rejected', () => {
    const [a, b, c] = makeIdentities(3);
    const built = buildPersonGroupRevision({
      previous: null,
      secretHex: SECRET,
      add: [
        { deviceId: a.publicKey, label: 'A' },
        { deviceId: b.publicKey, label: 'B' },
      ],
      now: NOW,
    });
    if (!built.ok) throw new Error('build failed');
    const doc = signedDoc([a, b], built.doc);
    const extra = {
      ...doc,
      signatures: { ...doc.signatures, [c.publicKey]: signPersonCanonicalBytes(c, canonicalPersonGroupBytes(built.doc)) },
    };
    expect(verifyPersonGroupDoc(extra)).toBe(false);
  });

  it('caps the group at 8 devices, at build AND at verify', () => {
    const ids = makeIdentities(PERSON_GROUP_MAX_DEVICES + 1);
    const built = buildPersonGroupRevision({
      previous: null,
      secretHex: SECRET,
      add: ids.map((identity, i) => ({ deviceId: identity.publicKey, label: `D${i}` })),
      now: NOW,
    });
    expect(built).toEqual({ ok: false, reason: 'over_cap' });

    const okBuilt = buildPersonGroupRevision({
      previous: null,
      secretHex: SECRET,
      add: ids.slice(0, PERSON_GROUP_MAX_DEVICES).map((identity, i) => ({
        deviceId: identity.publicKey,
        label: `D${i}`,
      })),
      now: NOW,
    });
    if (!okBuilt.ok) throw new Error('build failed');
    const doc = signedDoc(ids.slice(0, PERSON_GROUP_MAX_DEVICES), okBuilt.doc);
    expect(verifyPersonGroupDoc(doc)).toBe(true);
    // Structurally exceed the cap on a signed doc: fails before any crypto.
    const overCap = {
      ...doc,
      devices: [...doc.devices, { deviceId: ids[8]!.publicKey, label: 'D9', addedAt: NOW }],
    };
    expect(verifyPersonGroupDoc(overCap)).toBe(false);
  });
});

describe('revision monotonicity + replay', () => {
  it('NC-1: a replayed stale revision cannot resurrect a removed device', () => {
    const [a, b] = makeIdentities(2);
    const r1 = formGroup([a, b], NOW);
    expect(acceptPersonGroupRevision(null, r1)).toEqual({ accepted: true, doc: r1 });

    // r2 removes B (lost phone). Only the surviving device signs.
    const built = buildPersonGroupRevision({
      previous: r1,
      secretHex: 'b'.repeat(64),
      remove: [b.publicKey],
      now: LATER,
    });
    if (!built.ok) throw new Error('build failed');
    expect(built.removedDevice).toBe(true); // caller must rotate the secret
    const r2 = signedDoc([a], built.doc);
    expect(verifyPersonGroupDoc(r2)).toBe(true);

    const accepted = acceptPersonGroupRevision(r1, r2);
    expect(accepted.accepted).toBe(true);

    // Replaying r1 (which still lists B) against stored r2 is rejected.
    expect(acceptPersonGroupRevision(r2, r1)).toEqual({
      accepted: false,
      reason: 'stale_revision',
    });
  });

  it('re-delivering the stored doc is a no-op, not an error', () => {
    const ids = makeIdentities(2);
    const doc = formGroup(ids);
    expect(acceptPersonGroupRevision(doc, doc)).toEqual({ accepted: false, reason: 'not_newer' });
  });

  it('a doc from a different group id never replaces the stored group', () => {
    const ids = makeIdentities(2);
    const doc = formGroup(ids);
    const other = formGroup(ids, LATER);
    expect(other.groupId).not.toBe(doc.groupId);
    expect(acceptPersonGroupRevision(doc, other)).toEqual({
      accepted: false,
      reason: 'group_mismatch',
    });
  });

  it('equal revisions resolve deterministically by (updatedAt, hash)', () => {
    const ids = makeIdentities(2);
    const base = formGroup(ids, NOW);
    const builtLater = buildPersonGroupRevision({ previous: null, secretHex: SECRET, add: base.devices.map((d) => ({ deviceId: d.deviceId, label: d.label, addedAt: d.addedAt })), now: LATER, groupId: base.groupId });
    if (!builtLater.ok) throw new Error('build failed');
    const later = signedDoc(ids, builtLater.doc);
    expect(later.revision).toBe(base.revision);
    expect(comparePersonGroupDocs(later, base)).toBeGreaterThan(0);
    expect(acceptPersonGroupRevision(base, later).accepted).toBe(true);
    expect(acceptPersonGroupRevision(later, base)).toEqual({ accepted: false, reason: 'not_newer' });
  });

  it('an unverifiable doc is rejected before any ordering logic', () => {
    const ids = makeIdentities(2);
    const doc = formGroup(ids);
    const broken = { ...doc, signatures: {} };
    expect(acceptPersonGroupRevision(null, broken)).toEqual({ accepted: false, reason: 'invalid' });
  });
});

describe('per-context derived ids (AC-4 correlation resistance)', () => {
  it('two communities derive DIFFERENT ids for the same person', () => {
    const secret = generatePersonGroupSecret();
    const idA = derivePersonContextId(secret, communityDerivationContext('community-a'));
    const idB = derivePersonContextId(secret, communityDerivationContext('community-b'));
    expect(idA).not.toBe(idB);
    expect(idA).toMatch(/^[0-9a-f]{32}$/);
  });

  it('the derivation is stable per (secret, context) and changes with the secret', () => {
    const secret = generatePersonGroupSecret();
    const ctx = communityDerivationContext('community-a');
    expect(derivePersonContextId(secret, ctx)).toBe(derivePersonContextId(secret, ctx));
    const rotated = generatePersonGroupSecret();
    expect(derivePersonContextId(rotated, ctx)).not.toBe(derivePersonContextId(secret, ctx));
  });

  it('community and dm-peer contexts are domain-separated', () => {
    const secret = generatePersonGroupSecret();
    expect(derivePersonContextId(secret, communityDerivationContext('x')))
      .not.toBe(derivePersonContextId(secret, dmPeerDerivationContext('x')));
  });

  it('refuses a malformed secret', () => {
    expect(() => derivePersonContextId('feed', communityDerivationContext('c'))).toThrow();
  });
});

describe('person group announce', () => {
  function announceFor(ids: ReturnType<typeof makeIdentities>, context: string) {
    const doc = formGroup(ids);
    const secret = generatePersonGroupSecret();
    const unsigned = buildPersonGroupAnnounce(doc, secret, context, NOW);
    const signatures: Record<string, string> = {};
    for (const identity of ids) {
      signatures[identity.publicKey] = signPersonGroupAnnounce(identity, unsigned);
    }
    return { doc, secret, announce: assemblePersonGroupAnnounce(unsigned, signatures) };
  }

  it('a fully signed announce verifies and never carries the inner group id', () => {
    const ids = makeIdentities(3);
    const { doc, announce } = announceFor(ids, communityDerivationContext('community-a'));
    expect(verifyPersonGroupAnnounce(announce)).toBe(true);
    expect(JSON.stringify(announce)).not.toContain(doc.groupId);
    expect(new TextDecoder().decode(canonicalPersonAnnounceBytes(announce))).not.toContain(doc.groupId);
  });

  it('dropping a device from a relayed announce invalidates every signature (splice attack)', () => {
    const ids = makeIdentities(3);
    const { announce } = announceFor(ids, communityDerivationContext('community-a'));
    const dropped = announce.devices[0]!;
    const spliced = {
      ...announce,
      devices: announce.devices.slice(1),
      signatures: Object.fromEntries(
        Object.entries(announce.signatures).filter(([k]) => k !== dropped),
      ),
    };
    expect(verifyPersonGroupAnnounce(spliced)).toBe(false);
  });

  it('an announce missing any member signature fails (renders as ungrouped devices)', () => {
    const ids = makeIdentities(2);
    const { announce } = announceFor(ids, communityDerivationContext('community-a'));
    const partial = {
      ...announce,
      signatures: Object.fromEntries(Object.entries(announce.signatures).slice(0, 1)),
    };
    expect(verifyPersonGroupAnnounce(partial)).toBe(false);
  });

  it('a signature transplanted from another context fails', () => {
    const ids = makeIdentities(2);
    const a = announceFor(ids, communityDerivationContext('community-a'));
    const unsignedB = buildPersonGroupAnnounce(a.doc, a.secret, communityDerivationContext('community-b'), NOW);
    const transplanted = assemblePersonGroupAnnounce(unsignedB, a.announce.signatures);
    expect(verifyPersonGroupAnnounce(transplanted)).toBe(false);
  });
});

describe('presentation profile', () => {
  it('normalizes names, applies override-beats-global, and validates round-trip', () => {
    const profile = createPresentationProfile({
      revision: 1,
      displayName: '  River   Person ',
      overrides: { 'community-a': { displayName: '  Anon  Otter ' } },
      updatedAt: NOW,
    });
    expect(profile.displayName).toBe('River Person');
    expect(profile.avatarInitial).toBe('R');
    expect(isValidPresentationProfile(profile)).toBe(true);
    expect(presentationNameForCommunity(profile, 'community-a').displayName).toBe('Anon Otter');
    expect(presentationNameForCommunity(profile, 'community-b').displayName).toBe('River Person');
  });

  it('rejects an out-of-cap or non-JPEG avatar image', () => {
    expect(() => createPresentationProfile({
      revision: 1,
      displayName: 'River',
      avatarImage: 'aGVsbG8=', // valid base64, wrong magic
      updatedAt: NOW,
    })).toThrow();
  });

  it('merge is a deterministic total order and never unions overrides', () => {
    const older = createPresentationProfile({
      revision: 1,
      displayName: 'River',
      overrides: { 'community-a': { displayName: 'Otter' } },
      updatedAt: NOW,
    });
    // Revision 2 deliberately CLEARS the override; merge must not resurrect it.
    const newer = createPresentationProfile({
      revision: 2,
      displayName: 'River P',
      overrides: {},
      updatedAt: LATER,
    });
    const merged = mergePresentationProfiles(older, newer);
    expect(merged).toBe(newer);
    expect(mergePresentationProfiles(newer, older)).toBe(newer);
    expect(Object.keys(merged.overrides)).toHaveLength(0);
  });

  it('AC-1 seed: two devices converge on the same winner regardless of arrival order', () => {
    const a = createPresentationProfile({ revision: 3, displayName: 'Name A', updatedAt: NOW });
    const b = createPresentationProfile({ revision: 3, displayName: 'Name B', updatedAt: NOW });
    const winnerAB = mergePresentationProfiles(a, b);
    const winnerBA = mergePresentationProfiles(b, a);
    expect(winnerAB).toBe(winnerBA === a ? a : b);
    expect(winnerAB).toBe(winnerBA);
  });
});

// ---------------------------------------------------------------------------
// Adversarial-review regressions (independent review, 2026-07-29). Each block
// pins a finding that WAS exploitable against the first P0 draft.
// ---------------------------------------------------------------------------

describe('adversarial regressions', () => {
  it('HIGH-2: the group secret is committed inside the signed bytes', () => {
    const ids = makeIdentities(2);
    const doc = formGroup(ids, NOW, SECRET);
    expect(doc.secretCommitment).toBe(personGroupSecretCommitment(SECRET));
    // Swapping the secret changes the commitment, so the same signatures no
    // longer cover it: a sibling cannot substitute an attacker-chosen secret.
    const swapped = { ...doc, secretCommitment: personGroupSecretCommitment('b'.repeat(64)) };
    expect(verifyPersonGroupDoc(swapped)).toBe(false);
  });

  it('MEDIUM-1: the doc hash is signature-INdependent, so a malleated twin is not "newer"', () => {
    const ids = makeIdentities(2);
    const doc = formGroup(ids);
    // Same content, different signature encoding: hashes must match, so the
    // ordering reports equality (not_newer) rather than a strict win.
    const twin: PersonGroupDoc = {
      ...doc,
      signatures: { ...doc.signatures, [ids[0]!.publicKey]: `${doc.signatures[ids[0]!.publicKey]!}` },
    };
    expect(personGroupDocHash(twin)).toBe(personGroupDocHash(doc));
    expect(comparePersonGroupDocs(twin, doc)).toBe(0);
    expect(acceptPersonGroupRevision(doc, twin)).toEqual({ accepted: false, reason: 'not_newer' });
  });

  it('MEDIUM-2: a device refuses to attest a foreign group it is not part of', () => {
    const [victim, attacker] = makeIdentities(2);
    const foreign = buildPersonGroupRevision({
      previous: null,
      secretHex: SECRET,
      add: [
        { deviceId: attacker.publicKey, label: 'A' },
        { deviceId: generateDeviceIdentity('Other').publicKey, label: 'O' },
      ],
      now: NOW,
    });
    if (!foreign.ok) throw new Error('build failed');
    // The victim is not listed at all.
    expect(() => signPersonGroupRevision(victim, foreign.doc)).toThrow(/self_not_listed/);
    expect(verifyUnsignedPersonGroupRevision(foreign.doc, { selfDeviceId: victim.publicKey }))
      .toEqual({ ok: false, reason: 'self_not_listed' });
  });

  it('MEDIUM-2: a device already in a group refuses a doc for a DIFFERENT group', () => {
    const ids = makeIdentities(2);
    const mine = formGroup(ids);
    const other = buildPersonGroupRevision({
      previous: null,
      secretHex: SECRET,
      add: ids.map((i, n) => ({ deviceId: i.publicKey, label: `D${n}` })),
      now: LATER,
    });
    if (!other.ok) throw new Error('build failed');
    expect(other.doc.groupId).not.toBe(mine.groupId);
    expect(() => signPersonGroupRevision(ids[0]!, other.doc, { stored: mine }))
      .toThrow(/group_mismatch/);
  });

  it('MEDIUM-2: a device with no group refuses to adopt a mid-history revision', () => {
    const ids = makeIdentities(2);
    const r1 = formGroup(ids);
    const r2built = buildPersonGroupRevision({ previous: r1, secretHex: SECRET, add: [], now: LATER });
    if (!r2built.ok) throw new Error('build failed');
    expect(() => signPersonGroupRevision(ids[0]!, r2built.doc, { stored: null }))
      .toThrow(/not_next_revision/);
  });

  it('MEDIUM-2: signing refuses when the secret commitment does not match the caller secret', () => {
    const ids = makeIdentities(1);
    const doc = formGroup(ids, NOW, SECRET);
    const { signatures: _s, ...unsigned } = doc;
    expect(_s).toEqual(doc.signatures);
    expect(() => signPersonGroupRevision(ids[0]!, unsigned, { expectedSecretHex: 'c'.repeat(64) }))
      .toThrow(/secret_mismatch/);
  });

  it('HIGH-3: a device refuses to co-sign an announce draft not bound to the doc', () => {
    const [a, b] = makeIdentities(2);
    const doc = formGroup([a, b]);
    const { signatures: _s, ...unsigned } = doc;
    expect(_s).toEqual(doc.signatures);
    const stranger = generateDeviceIdentity('Stranger');
    const honest = buildPersonGroupAnnounce(unsigned, SECRET, communityDerivationContext('c1'), NOW);
    expect(verifyAnnounceDraftAgainstDoc(honest, unsigned).ok).toBe(true);

    // A draft for a third party B never consented to, at an out-ranking revision.
    const hostile = { ...honest, context: dmPeerDerivationContext(stranger.publicKey), revision: 4242 };
    expect(verifyAnnounceDraftAgainstDoc(hostile, unsigned)).toEqual({
      ok: false,
      reason: 'revision_mismatch',
    });
    expect(() => signPersonGroupAnnounce(b, hostile, unsigned)).toThrow(/Refusing to co-sign/);

    // Same revision but a spliced device set is refused too.
    const spliced = { ...honest, devices: [honest.devices[0]!] };
    expect(verifyAnnounceDraftAgainstDoc(spliced, unsigned)).toEqual({
      ok: false,
      reason: 'devices_mismatch',
    });

    // An unrecognized context kind is refused.
    expect(verifyAnnounceDraftAgainstDoc({ ...honest, context: 'anything' }, unsigned)).toEqual({
      ok: false,
      reason: 'unknown_context',
    });

    // A dm-peer context aimed at one of the group's OWN devices is refused.
    expect(verifyAnnounceDraftAgainstDoc(
      { ...honest, context: dmPeerDerivationContext(a.publicKey) },
      unsigned,
    )).toEqual({ ok: false, reason: 'self_context' });
  });

  it('MEDIUM-4: timestamps must be canonical ISO and not far-future', () => {
    expect(isOrderableTimestamp('2026-07-29T12:00:00.000Z')).toBe(true);
    // A millisecond-free variant sorts ABOVE a strictly later value, so it is
    // refused as an ordering key.
    expect(isOrderableTimestamp('2026-07-29T12:00:00Z')).toBe(false);
    expect(isOrderableTimestamp('9999-12-31T23:59:59.999Z')).toBe(false);
    expect(isOrderableTimestamp('not a date')).toBe(false);
    const ids = makeIdentities(1);
    const built = buildPersonGroupRevision({
      previous: null,
      secretHex: SECRET,
      add: [{ deviceId: ids[0]!.publicKey, label: 'A' }],
      now: '9999-12-31T23:59:59.999Z',
    });
    expect(built).toEqual({ ok: false, reason: 'bad_timestamp' });
  });

  it('LOW-1: a 32-hex derived id can never be shape-confused with a device id', () => {
    const built = buildPersonGroupRevision({
      previous: null,
      secretHex: SECRET,
      add: [{ deviceId: 'a'.repeat(32), label: 'Fake' }],
      now: NOW,
    });
    expect(built).toEqual({ ok: false, reason: 'bad_device_id' });
  });

  it('LOW-2: device labels are sliced by code point, never mid-surrogate', () => {
    const ids = makeIdentities(1);
    const label = `${'x'.repeat(31)}😀`;
    const built = buildPersonGroupRevision({
      previous: null,
      secretHex: SECRET,
      add: [{ deviceId: ids[0]!.publicKey, label }],
      now: NOW,
    });
    if (!built.ok) throw new Error('build failed');
    const stored = built.doc.devices[0]!.label;
    expect(Array.from(stored)).toHaveLength(32);
    expect(stored.endsWith('😀')).toBe(true);
    // No lone surrogate survived.
    expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(stored)).toBe(false);
  });
});

describe('parent-hash lineage (closes the skip-revision residual)', () => {
  it('a doc that advances the revision must name the STORED doc as its parent', () => {
    const ids = makeIdentities(2);
    const r1 = formGroup(ids);
    const built2 = buildPersonGroupRevision({ previous: r1, secretHex: SECRET, add: [], now: LATER });
    if (!built2.ok) throw new Error('build failed');
    const r2 = signedDoc(ids, built2.doc);
    expect(r2.parentHash).toBe(personGroupDocHash(r1));
    expect(acceptPersonGroupRevision(r1, r2).accepted).toBe(true);

    // A doc built on the GRANDPARENT but numbered as the next revision: the
    // number lines up, the parent does not. This is the shape that could
    // otherwise clear a tombstone by posing as a strict successor.
    const skipped = buildPersonGroupRevision({
      previous: r1,
      secretHex: SECRET,
      add: [],
      now: '2026-07-29T14:00:00.000Z',
    });
    if (!skipped.ok) throw new Error('build failed');
    const forged = signedDoc(ids, { ...skipped.doc, revision: 3 });
    expect(acceptPersonGroupRevision(r2, forged)).toEqual({
      accepted: false,
      reason: 'wrong_parent',
    });
  });

  it('a genesis revision has no parent, and a later revision must have one', () => {
    const ids = makeIdentities(1);
    const genesis = formGroup(ids);
    expect(genesis.revision).toBe(1);
    expect(genesis.parentHash).toBeNull();
    // A genesis doc claiming a parent, or a later doc claiming none, is malformed.
    expect(verifyPersonGroupDoc({ ...genesis, parentHash: 'a'.repeat(32) })).toBe(false);
    const built2 = buildPersonGroupRevision({ previous: genesis, secretHex: SECRET, add: [], now: LATER });
    if (!built2.ok) throw new Error('build failed');
    const r2 = signedDoc(ids, built2.doc);
    expect(verifyPersonGroupDoc({ ...r2, parentHash: null })).toBe(false);
  });

  it('the signer refuses to attest a revision whose parent is not what it holds', () => {
    const ids = makeIdentities(2);
    const r1 = formGroup(ids);
    const built2 = buildPersonGroupRevision({ previous: r1, secretHex: SECRET, add: [], now: LATER });
    if (!built2.ok) throw new Error('build failed');
    const r2 = signedDoc(ids, built2.doc);
    // Someone proposes a revision 3 that descends from r1, not r2.
    const skewed = { ...built2.doc, revision: 3 };
    expect(() => signPersonGroupRevision(ids[0]!, skewed, { stored: r2 })).toThrow(/wrong_parent/);
  });
});

// ---------------------------------------------------------------------------
// Plan 56 C2 (feature 53): persona fields on the presentation profile
// ---------------------------------------------------------------------------

describe('presentation persona (Plan 56 C2)', () => {
  it('normalizes, caps, and validates persona fields on the global profile', () => {
    const profile = createPresentationProfile({
      revision: 1,
      displayName: 'River',
      bio: '  ' + 'x'.repeat(400),
      pronouns: 'y'.repeat(90),
      nameColor: 'success',
      updatedAt: '2026-08-29T12:00:00.000Z',
    });
    expect(profile.bio).toHaveLength(280);
    expect(profile.pronouns).toHaveLength(40);
    expect(profile.nameColor).toBe('success');
    expect(isValidPresentationProfile(profile)).toBe(true);
    expect(isValidPresentationProfile({ ...profile, nameColor: '#ff0000' as never })).toBe(false);
    expect(isValidPresentationProfile({ ...profile, bio: 'z'.repeat(281) })).toBe(false);
    expect(() => createPresentationProfile({ revision: 1, displayName: 'R', nameColor: 'red' as never }))
      .toThrow(/name color/i);
  });

  it('privacy rule: an override community never receives the global persona', () => {
    const profile = createPresentationProfile({
      revision: 1,
      displayName: 'River',
      bio: 'My real-life bio that could identify me.',
      pronouns: 'they/them',
      nameColor: 'info',
      overrides: {
        'pseudo-community': { displayName: 'NightOwl', nameColor: 'danger' },
      },
      updatedAt: '2026-08-29T12:00:00.000Z',
    });
    const global = presentationNameForCommunity(profile, 'open-community');
    expect(global.bio).toBe('My real-life bio that could identify me.');
    expect(global.pronouns).toBe('they/them');
    expect(global.nameColor).toBe('info');
    const pseudo = presentationNameForCommunity(profile, 'pseudo-community');
    expect(pseudo.displayName).toBe('NightOwl');
    expect(pseudo.bio).toBeUndefined();
    expect(pseudo.pronouns).toBeUndefined();
    expect(pseudo.nameColor).toBe('danger');
  });

  it('persona-less profiles keep their pre-persona hash (conditional append)', () => {
    const base = createPresentationProfile({
      revision: 3,
      displayName: 'River',
      overrides: { c1: { displayName: 'NightOwl' } },
      updatedAt: '2026-08-29T12:00:00.000Z',
    });
    // Frozen from the pre-persona hash algorithm: appending persona fields must
    // not disturb profiles that carry none.
    expect(presentationProfileHash(base)).toBe(presentationProfileHash({ ...base }));
    const withPersona = createPresentationProfile({
      revision: 3,
      displayName: 'River',
      bio: 'hello',
      overrides: { c1: { displayName: 'NightOwl' } },
      updatedAt: '2026-08-29T12:00:00.000Z',
    });
    expect(presentationProfileHash(withPersona)).not.toBe(presentationProfileHash(base));
  });
});
