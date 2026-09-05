/**
 * Plan 53 P0: the proximity ceremony protocol, driven as two simulated phones.
 *
 * Every acceptance criterion that can be proven without a device is proven
 * here: AC-2 (nothing persists on cancel/expiry/loss), AC-3 (the advertisement
 * carries no long-term identifier and changes per tap), AC-4 (forged,
 * substituted, and replayed material is rejected), and the in-room MITM defence
 * the whole design rests on.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  ceremonyAdvertisementPayload,
  ceremonyPairingResult,
  ceremonyReducer,
  ceremonySas,
  ceremonySasAgrees,
  ceremonyTranscriptHash,
  createSignedIdentityBundle,
  deriveCeremonyKey,
  helloFrameFor,
  newCeremonyEphemeral,
  openBundleFrame,
  sealBundleFrame,
  signCeremonyAccept,
  startCeremony,
  verifyCeremonyAccept,
  CEREMONY_WINDOW_MS,
  configureSyncPrngFromGlobalCrypto,
  generateDeviceIdentity,
  type CeremonyState,
  type DeviceIdentity,
} from '../index';

const T0 = 1_780_000_000_000;

describe('proximity ceremony (plan 53 P0)', () => {
  let alice: DeviceIdentity;
  let bob: DeviceIdentity;

  beforeEach(() => {
    configureSyncPrngFromGlobalCrypto();
    alice = generateDeviceIdentity('Alice');
    bob = generateDeviceIdentity('Bob');
  });

  /** Run both phones through to whatever phase the events reach. */
  function runBothSides(): { a: CeremonyState; b: CeremonyState } {
    const aBundle = createSignedIdentityBundle(alice);
    const bBundle = createSignedIdentityBundle(bob);
    const aEph = newCeremonyEphemeral();
    const bEph = newCeremonyEphemeral();

    let a = startCeremony(aBundle, T0, aEph);
    let b = startCeremony(bBundle, T0, bEph);

    a = ceremonyReducer(a, { type: 'peer_hello', frame: helloFrameFor(bEph) }, alice);
    b = ceremonyReducer(b, { type: 'peer_hello', frame: helloFrameFor(aEph) }, bob);

    a = ceremonyReducer(a, { type: 'peer_bundle', frame: sealBundleFrame(a.channelKey!, bBundle) }, alice);
    b = ceremonyReducer(b, { type: 'peer_bundle', frame: sealBundleFrame(b.channelKey!, aBundle) }, bob);
    return { a, b };
  }

  it('AC-1: both sides reach the same SAS and commit only after mutual confirm', () => {
    let { a, b } = runBothSides();

    expect(a.phase).toBe('awaiting_confirm');
    expect(b.phase).toBe('awaiting_confirm');
    // Both phones derived the SAME transcript despite neither being "the
    // initiator", which is what the symmetric one-button design requires.
    expect(a.transcriptHash).toBe(b.transcriptHash);
    expect(ceremonySasAgrees(a, b)).toBe(true);
    // The name on the confirm popup comes from the VERIFIED bundle.
    expect(a.peerBundle?.bundle.displayName).toBe('Bob');
    expect(b.peerBundle?.bundle.displayName).toBe('Alice');
    // Nothing is persistable yet.
    expect(ceremonyPairingResult(a)).toBeNull();

    a = ceremonyReducer(a, { type: 'local_confirm' }, alice);
    b = ceremonyReducer(b, { type: 'local_confirm' }, bob);
    expect(a.phase).toBe('awaiting_peer');
    expect(ceremonyPairingResult(a)).toBeNull();

    const aAccept = signCeremonyAccept(alice, a.transcriptHash!);
    const bAccept = signCeremonyAccept(bob, b.transcriptHash!);
    a = ceremonyReducer(a, { type: 'peer_accept', frame: bAccept }, alice);
    b = ceremonyReducer(b, { type: 'peer_accept', frame: aAccept }, bob);

    expect(a.phase).toBe('committed');
    expect(b.phase).toBe('committed');
    expect(ceremonyPairingResult(a)?.bundle.deviceId).toBe(bob.publicKey);
    expect(ceremonyPairingResult(b)?.bundle.deviceId).toBe(alice.publicKey);
  });

  it('AC-1: a confirm from only ONE side never commits', () => {
    let { a } = runBothSides();
    a = ceremonyReducer(a, { type: 'local_confirm' }, alice);
    // Bob never confirms, so no accept ever arrives.
    a = ceremonyReducer(a, { type: 'tick', now: T0 + 1000 }, alice);
    expect(a.phase).toBe('awaiting_peer');
    expect(ceremonyPairingResult(a)).toBeNull();
  });

  it('AC-2: cancelling at any point persists nothing, and a late accept cannot revive it', () => {
    let { a, b } = runBothSides();
    a = ceremonyReducer(a, { type: 'local_confirm' }, alice);
    a = ceremonyReducer(a, { type: 'cancel' }, alice);
    expect(a.phase).toBe('cancelled');
    expect(ceremonyPairingResult(a)).toBeNull();

    b = ceremonyReducer(b, { type: 'local_confirm' }, bob);
    const bAccept = signCeremonyAccept(bob, b.transcriptHash!);
    const after = ceremonyReducer(a, { type: 'peer_accept', frame: bAccept }, alice);
    expect(after.phase).toBe('cancelled');
    expect(ceremonyPairingResult(after)).toBeNull();
  });

  it('AC-2: the window expires and a valid accept arriving after it commits nothing', () => {
    let { a, b } = runBothSides();
    a = ceremonyReducer(a, { type: 'local_confirm' }, alice);
    b = ceremonyReducer(b, { type: 'local_confirm' }, bob);
    const bAccept = signCeremonyAccept(bob, b.transcriptHash!);

    a = ceremonyReducer(a, { type: 'tick', now: T0 + CEREMONY_WINDOW_MS }, alice);
    expect(a.phase).toBe('expired');
    a = ceremonyReducer(a, { type: 'peer_accept', frame: bAccept }, alice);
    expect(a.phase).toBe('expired');
    expect(ceremonyPairingResult(a)).toBeNull();
  });

  it('AC-2: the window does NOT expire one millisecond early', () => {
    let { a } = runBothSides();
    a = ceremonyReducer(a, { type: 'tick', now: T0 + CEREMONY_WINDOW_MS - 1 }, alice);
    expect(a.phase).toBe('awaiting_confirm');
  });

  it('AC-2: losing the session mid-ceremony fails honestly and persists nothing', () => {
    let { a } = runBothSides();
    a = ceremonyReducer(a, { type: 'local_confirm' }, alice);
    a = ceremonyReducer(a, { type: 'transport_lost' }, alice);
    expect(a.phase).toBe('failed');
    expect(a.failure).toBe('transport_lost');
    expect(ceremonyPairingResult(a)).toBeNull();
  });

  it('AC-3: the advertisement carries ONLY the ephemeral ceremony id', () => {
    const identity = generateDeviceIdentity('Alice');
    const ephemeral = newCeremonyEphemeral();
    const payload = ceremonyAdvertisementPayload(ephemeral);

    expect(Object.keys(payload)).toEqual(['ceremonyId']);
    // Nothing long-term may appear anywhere in the serialized payload.
    const wire = JSON.stringify(payload);
    expect(wire).not.toContain(identity.publicKey);
    expect(wire).not.toContain(identity.dhPublicKey);
    expect(wire).not.toContain('Alice');
    expect(wire).not.toContain(ephemeral.ephemeralPublicKey);
  });

  it('AC-3: two consecutive ceremonies from the same phone advertise different ids', () => {
    const first = ceremonyAdvertisementPayload(newCeremonyEphemeral());
    const second = ceremonyAdvertisementPayload(newCeremonyEphemeral());
    expect(first.ceremonyId).not.toBe(second.ceremonyId);
  });

  it('AC-4: an unsigned or forged bundle is rejected and nothing renders', () => {
    const aEph = newCeremonyEphemeral();
    const bEph = newCeremonyEphemeral();
    let a = startCeremony(createSignedIdentityBundle(alice), T0, aEph);
    a = ceremonyReducer(a, { type: 'peer_hello', frame: helloFrameFor(bEph) }, alice);

    // A bundle claiming Bob's device id but signed by nobody.
    const forged = createSignedIdentityBundle(bob);
    forged.signature = 'ab'.repeat(32);
    a = ceremonyReducer(a, { type: 'peer_bundle', frame: sealBundleFrame(a.channelKey!, forged) }, alice);

    expect(a.phase).toBe('failed');
    expect(a.failure).toBe('peer_bundle_rejected');
    expect(a.peerBundle).toBeUndefined();
    expect(a.sas).toBeUndefined();
  });

  it('AC-4: a bundle whose signature does not match its deviceId is rejected', () => {
    const bundle = createSignedIdentityBundle(bob);
    // Keep Bob's valid signature but claim Alice's device id.
    bundle.bundle.deviceId = alice.publicKey;
    const key = new Uint8Array(32).fill(7);
    expect(openBundleFrame(key, sealBundleFrame(key, bundle))).toBeNull();
  });

  it('AC-4: a REPLAYED accept from a previous ceremony is rejected', () => {
    const first = runBothSides();
    const staleAccept = signCeremonyAccept(bob, first.b.transcriptHash!);

    // A fresh ceremony between the same two people.
    let { a: second } = runBothSides();
    expect(second.transcriptHash).not.toBe(first.a.transcriptHash);
    second = ceremonyReducer(second, { type: 'local_confirm' }, alice);
    second = ceremonyReducer(second, { type: 'peer_accept', frame: staleAccept }, alice);

    expect(second.phase).toBe('failed');
    expect(second.failure).toBe('peer_accept_rejected');
    expect(ceremonyPairingResult(second)).toBeNull();
  });

  it('AC-4: a valid accept from a THIRD device cannot be substituted', () => {
    let { a } = runBothSides();
    a = ceremonyReducer(a, { type: 'local_confirm' }, alice);
    const mallory = generateDeviceIdentity('Mallory');
    // Correctly signed, over the RIGHT transcript, by the wrong device.
    const substituted = signCeremonyAccept(mallory, a.transcriptHash!);
    expect(verifyCeremonyAccept(substituted, {
      transcriptHash: a.transcriptHash!,
      peerDeviceId: bob.publicKey,
    })).toEqual({ ok: false, reason: 'wrong_device' });

    a = ceremonyReducer(a, { type: 'peer_accept', frame: substituted }, alice);
    expect(a.phase).toBe('failed');
  });

  it('AC-4: verifyCeremonyAccept reason codes are distinct and honest', () => {
    let { a } = runBothSides();
    const good = signCeremonyAccept(bob, a.transcriptHash!);
    const expected = { transcriptHash: a.transcriptHash!, peerDeviceId: bob.publicKey };

    expect(verifyCeremonyAccept(good, expected)).toEqual({ ok: true });
    expect(verifyCeremonyAccept({ kind: 'nope' }, expected)).toEqual({ ok: false, reason: 'malformed' });
    expect(verifyCeremonyAccept({ ...good, transcriptHash: 'ff'.repeat(32) }, expected))
      .toEqual({ ok: false, reason: 'wrong_transcript' });
    expect(verifyCeremonyAccept({ ...good, signature: 'ab'.repeat(64) }, expected))
      .toEqual({ ok: false, reason: 'bad_signature' });
  });

  it('MITM: an attacker relaying between two sessions produces DIFFERENT emoji on each screen', () => {
    // Mallory terminates both sides: Alice talks to Mallory, Bob talks to
    // Mallory, and Mallory forwards the identities. Every signature is valid,
    // so only the SAS can expose this.
    const mallory = generateDeviceIdentity('Mallory');
    const aBundle = createSignedIdentityBundle(alice);
    const bBundle = createSignedIdentityBundle(bob);
    const mBundle = createSignedIdentityBundle(mallory);

    const aEph = newCeremonyEphemeral();
    const bEph = newCeremonyEphemeral();
    const mToA = newCeremonyEphemeral();
    const mToB = newCeremonyEphemeral();

    let a = startCeremony(aBundle, T0, aEph);
    a = ceremonyReducer(a, { type: 'peer_hello', frame: helloFrameFor(mToA) }, alice);
    a = ceremonyReducer(a, { type: 'peer_bundle', frame: sealBundleFrame(a.channelKey!, mBundle) }, alice);

    let b = startCeremony(bBundle, T0, bEph);
    b = ceremonyReducer(b, { type: 'peer_hello', frame: helloFrameFor(mToB) }, bob);
    b = ceremonyReducer(b, { type: 'peer_bundle', frame: sealBundleFrame(b.channelKey!, mBundle) }, bob);

    expect(a.phase).toBe('awaiting_confirm');
    expect(b.phase).toBe('awaiting_confirm');
    // The users are looking at two different pictures. That mismatch is the
    // entire defence, and it is why confirmation can never be automatic.
    expect(ceremonySasAgrees(a, b)).toBe(false);
    // And the popup names Mallory, not the person standing there.
    expect(a.peerBundle?.bundle.displayName).toBe('Mallory');
  });

  it('a phone that meets its own advertisement refuses to pair with itself', () => {
    const eph = newCeremonyEphemeral();
    let a = startCeremony(createSignedIdentityBundle(alice), T0, eph);
    a = ceremonyReducer(a, { type: 'peer_hello', frame: helloFrameFor(eph) }, alice);
    expect(a.phase).toBe('failed');
    expect(a.failure).toBe('self_pairing');
  });

  it('a peer bundle carrying OUR OWN device id is refused', () => {
    const aEph = newCeremonyEphemeral();
    const bEph = newCeremonyEphemeral();
    let a = startCeremony(createSignedIdentityBundle(alice), T0, aEph);
    a = ceremonyReducer(a, { type: 'peer_hello', frame: helloFrameFor(bEph) }, alice);
    const ownBundle = createSignedIdentityBundle(alice);
    a = ceremonyReducer(a, { type: 'peer_bundle', frame: sealBundleFrame(a.channelKey!, ownBundle) }, alice);
    expect(a.phase).toBe('failed');
    expect(a.failure).toBe('self_pairing');
  });

  it('a confirm before the SAS is on screen is ignored', () => {
    const aEph = newCeremonyEphemeral();
    const bEph = newCeremonyEphemeral();
    let a = startCeremony(createSignedIdentityBundle(alice), T0, aEph);
    a = ceremonyReducer(a, { type: 'local_confirm' }, alice);
    expect(a.phase).toBe('discovering');
    a = ceremonyReducer(a, { type: 'peer_hello', frame: helloFrameFor(bEph) }, alice);
    a = ceremonyReducer(a, { type: 'local_confirm' }, alice);
    expect(a.phase).toBe('connected');
  });

  it('an accept arriving BEFORE the local confirm is ignored, not banked', () => {
    // The peer simply confirmed first. It must not be stored and cashed in
    // later, or the local confirm would stop being a precondition for commit.
    let { a, b } = runBothSides();
    b = ceremonyReducer(b, { type: 'local_confirm' }, bob);
    const bAccept = signCeremonyAccept(bob, b.transcriptHash!);

    a = ceremonyReducer(a, { type: 'peer_accept', frame: bAccept }, alice);
    expect(a.phase).toBe('awaiting_confirm');
    a = ceremonyReducer(a, { type: 'local_confirm' }, alice);
    expect(a.phase).toBe('awaiting_peer');
    expect(ceremonyPairingResult(a)).toBeNull();
  });

  it('a malformed hello is ignored rather than advancing the ceremony', () => {
    let a = startCeremony(createSignedIdentityBundle(alice), T0, newCeremonyEphemeral());
    for (const frame of [null, {}, { kind: 'ceremony-hello', version: 1 }, { kind: 'x' }]) {
      a = ceremonyReducer(a, { type: 'peer_hello', frame }, alice);
      expect(a.phase).toBe('discovering');
    }
  });

  it('the sealed channel really is confidential: a wrong key opens nothing', () => {
    const aEph = newCeremonyEphemeral();
    const bEph = newCeremonyEphemeral();
    const eavesdropper = newCeremonyEphemeral();
    const realKey = deriveCeremonyKey(aEph, helloFrameFor(bEph));
    const wrongKey = deriveCeremonyKey(eavesdropper, helloFrameFor(bEph));
    const frame = sealBundleFrame(realKey, createSignedIdentityBundle(alice));

    expect(openBundleFrame(realKey, frame)?.bundle.deviceId).toBe(alice.publicKey);
    expect(openBundleFrame(wrongKey, frame)).toBeNull();
  });

  it('both sides derive the same channel key without agreeing who started', () => {
    const aEph = newCeremonyEphemeral();
    const bEph = newCeremonyEphemeral();
    expect(Array.from(deriveCeremonyKey(aEph, helloFrameFor(bEph))))
      .toEqual(Array.from(deriveCeremonyKey(bEph, helloFrameFor(aEph))));
  });

  it('the transcript is order-independent but changes when any input changes', () => {
    const aBundle = createSignedIdentityBundle(alice);
    const bBundle = createSignedIdentityBundle(bob);
    const aHello = helloFrameFor(newCeremonyEphemeral());
    const bHello = helloFrameFor(newCeremonyEphemeral());

    const fromA = ceremonyTranscriptHash({
      selfHello: aHello, peerHello: bHello, selfBundle: aBundle, peerBundle: bBundle,
    });
    const fromB = ceremonyTranscriptHash({
      selfHello: bHello, peerHello: aHello, selfBundle: bBundle, peerBundle: aBundle,
    });
    expect(fromA).toBe(fromB);

    const swappedBundle = ceremonyTranscriptHash({
      selfHello: aHello,
      peerHello: bHello,
      selfBundle: aBundle,
      peerBundle: createSignedIdentityBundle(generateDeviceIdentity('Mallory')),
    });
    expect(swappedBundle).not.toBe(fromA);
  });

  it('the SAS is bound to the channel key, not the transcript alone', () => {
    const transcript = 'ab'.repeat(32);
    const one = ceremonySas(new Uint8Array(32).fill(1), transcript);
    const two = ceremonySas(new Uint8Array(32).fill(2), transcript);
    expect(one.indices).not.toEqual(two.indices);
    expect(one.emoji).toHaveLength(5);
  });
});
