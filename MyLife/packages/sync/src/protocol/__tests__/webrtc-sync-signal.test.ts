/**
 * WebRTC SYNC signaling on the shared call-signal machinery (2026-08-25).
 * The MED-severity findings this locks down: the sync rung's envelope must be
 * as strong as the call one (Ed25519 signature + replay floor), must be
 * cryptographically DISJOINT from call signals (domain + media + frame
 * context), and its invite token must rotate daily instead of being a static
 * per-pair pseudonym.
 */

import { describe, expect, it } from 'vitest';
import { generateDeviceIdentity } from '../../identity/device-identity';
import {
  createCallSignal,
  createWebRTCSyncSignal,
  decryptWebRTCSyncPayload,
  deriveCallInviteToken,
  deriveWebRTCSyncInviteListenTokens,
  deriveWebRTCSyncInviteToken,
  deriveWebRTCSyncSessionToken,
  encryptWebRTCSyncPayload,
  openCallSignalFrame,
  openWebRTCSyncSignalFrame,
  sealCallSignalFrame,
  sealWebRTCSyncSignalFrame,
  verifyCallSignal,
  verifyWebRTCSyncSignal,
} from '../call-signal';
import { hexToBytes } from '../../encryption/keys';

const alice = generateDeviceIdentity('Alice');
const bob = generateDeviceIdentity('Bob');
const PAIR_SECRET_HEX = 'ab'.repeat(32);
const PAIR_SECRET = hexToBytes(PAIR_SECRET_HEX);
const SESSION_ID = 'f0'.repeat(32);
const T = Date.parse('2026-08-25T12:00:00.000Z');
const DAY_MS = 86_400_000;
const neverSeen = () => false;

function makeSyncSignal(kind: 'offer' | 'answer' | 'ice' = 'offer', payload = '{"type":"offer","sdp":"v=0"}') {
  const created = createWebRTCSyncSignal({
    sender: alice,
    sessionId: SESSION_ID,
    kind,
    toDeviceId: bob.publicKey,
    payloadCiphertext: encryptWebRTCSyncPayload(PAIR_SECRET, SESSION_ID, payload),
    nowMs: T,
  });
  expect(created.ok).toBe(true);
  if (!created.ok) throw new Error('unreachable');
  return created.signal;
}

describe('createWebRTCSyncSignal / verifyWebRTCSyncSignal', () => {
  it('round-trips a signed offer with the payload decrypting to the original data', () => {
    const signal = makeSyncSignal();
    const verified = verifyWebRTCSyncSignal(signal, {
      senderPublicKey: alice.publicKey,
      expectedRecipientDeviceId: bob.publicKey,
      nowMs: T + 1_000,
      hasSeenNonce: neverSeen,
    });
    expect(verified.ok).toBe(true);
    if (!verified.ok) return;
    expect(verified.signal.media).toBe('data');
    expect(verified.signal.callId).toBe(SESSION_ID);
    const payload = decryptWebRTCSyncPayload<string>(
      PAIR_SECRET,
      verified.signal.callId,
      verified.signal.payloadCiphertext!,
    );
    expect(payload).toBe('{"type":"offer","sdp":"v=0"}');
  });

  it('rejects a replayed nonce (DB-persisted floor contract)', () => {
    const signal = makeSyncSignal();
    const verified = verifyWebRTCSyncSignal(signal, {
      senderPublicKey: alice.publicKey,
      expectedRecipientDeviceId: bob.publicKey,
      nowMs: T + 1_000,
      hasSeenNonce: (nonce) => nonce === signal.nonce,
    });
    expect(verified).toEqual({ ok: false, reason: 'replayed_nonce' });
  });

  it('rejects a forged signature and a wrong sender', () => {
    const signal = makeSyncSignal();
    const tampered = { ...signal, signature: signal.signature.replace(/^../u, signal.signature.startsWith('00') ? '11' : '00') };
    expect(verifyWebRTCSyncSignal(tampered, {
      senderPublicKey: alice.publicKey,
      expectedRecipientDeviceId: bob.publicKey,
      nowMs: T + 1_000,
      hasSeenNonce: neverSeen,
    }).ok).toBe(false);
    expect(verifyWebRTCSyncSignal(signal, {
      senderPublicKey: bob.publicKey,
      expectedRecipientDeviceId: bob.publicKey,
      nowMs: T + 1_000,
      hasSeenNonce: neverSeen,
    }).ok).toBe(false);
  });

  it('rejects call-profile kinds and media on the sync profile', () => {
    const created = createWebRTCSyncSignal({
      sender: alice,
      sessionId: SESSION_ID,
      kind: 'invite' as never,
      toDeviceId: bob.publicKey,
      payloadCiphertext: encryptWebRTCSyncPayload(PAIR_SECRET, SESSION_ID, 'x'),
      nowMs: T,
    });
    expect(created).toEqual({ ok: false, reason: 'invalid_kind' });
  });
});

describe('domain separation from call signals', () => {
  it('a signed CALL signal never verifies as a sync signal', () => {
    const call = createCallSignal({
      sender: alice,
      callId: SESSION_ID,
      kind: 'offer',
      toDeviceId: bob.publicKey,
      media: 'voice',
      nowMs: T,
    });
    expect(call.ok).toBe(true);
    if (!call.ok) return;
    const asSync = verifyWebRTCSyncSignal(call.signal, {
      senderPublicKey: alice.publicKey,
      expectedRecipientDeviceId: bob.publicKey,
      nowMs: T + 1_000,
      hasSeenNonce: neverSeen,
    });
    expect(asSync.ok).toBe(false);
  });

  it('a signed SYNC signal never verifies as a call signal', () => {
    const signal = makeSyncSignal();
    const asCall = verifyCallSignal(signal, {
      senderPublicKey: alice.publicKey,
      expectedRecipientDeviceId: bob.publicKey,
      nowMs: T + 1_000,
      hasSeenNonce: neverSeen,
    });
    expect(asCall.ok).toBe(false);
  });

  it('a mutual-media forgery still fails on the signing domain alone', () => {
    // Force a sync-shaped record whose media/kind WOULD satisfy the call
    // profile, so only the canonical domain distinguishes it: the signature
    // must not verify across profiles.
    const call = createCallSignal({
      sender: alice,
      callId: SESSION_ID,
      kind: 'offer',
      toDeviceId: bob.publicKey,
      media: 'voice',
      nowMs: T,
    });
    expect(call.ok).toBe(true);
    if (!call.ok) return;
    const forged = { ...call.signal, media: 'data' };
    const asSync = verifyWebRTCSyncSignal(forged, {
      senderPublicKey: alice.publicKey,
      expectedRecipientDeviceId: bob.publicKey,
      nowMs: T + 1_000,
      hasSeenNonce: neverSeen,
    });
    expect(asSync).toEqual({ ok: false, reason: 'invalid_signature' });
  });

  it('frame contexts are disjoint: a call frame will not open as a sync frame and vice versa', () => {
    const signal = makeSyncSignal();
    const syncFrame = sealWebRTCSyncSignalFrame(PAIR_SECRET, signal);
    expect(openCallSignalFrame(PAIR_SECRET, syncFrame)).toBeNull();
    const call = createCallSignal({
      sender: alice,
      callId: 'call-1',
      kind: 'invite',
      toDeviceId: bob.publicKey,
      media: 'voice',
      nowMs: T,
    });
    expect(call.ok).toBe(true);
    if (!call.ok) return;
    const callFrame = sealCallSignalFrame(PAIR_SECRET, call.signal);
    expect(openWebRTCSyncSignalFrame(PAIR_SECRET, callFrame)).toBeNull();
    // Each opens under its own context.
    expect(openWebRTCSyncSignalFrame(PAIR_SECRET, syncFrame)).not.toBeNull();
    expect(openCallSignalFrame(PAIR_SECRET, callFrame)).not.toBeNull();
  });
});

describe('day-bucketed invite tokens', () => {
  it('rotates daily and is stable within a bucket', () => {
    const today = deriveWebRTCSyncInviteToken(PAIR_SECRET_HEX, T);
    expect(deriveWebRTCSyncInviteToken(PAIR_SECRET_HEX, T + 3_600_000)).toBe(today);
    expect(deriveWebRTCSyncInviteToken(PAIR_SECRET_HEX, T + DAY_MS)).not.toBe(today);
  });

  it('the listener window is [current, previous] so a boundary-race offer is still heard', () => {
    const listenTomorrow = deriveWebRTCSyncInviteListenTokens(PAIR_SECRET_HEX, T + DAY_MS);
    // A dialer still on today's bucket sends on today's token; tomorrow's
    // listener window contains it.
    expect(listenTomorrow).toContain(deriveWebRTCSyncInviteToken(PAIR_SECRET_HEX, T));
    expect(listenTomorrow).toContain(deriveWebRTCSyncInviteToken(PAIR_SECRET_HEX, T + DAY_MS));
    expect(listenTomorrow).toHaveLength(2);
  });

  it('never collides with the call invite token or the session token', () => {
    const invite = deriveWebRTCSyncInviteToken(PAIR_SECRET_HEX, T);
    expect(invite).not.toBe(deriveCallInviteToken(PAIR_SECRET_HEX));
    expect(invite).not.toBe(deriveWebRTCSyncSessionToken(PAIR_SECRET_HEX, SESSION_ID));
  });
});
