// Plan 25 WP-25G: pure orchestration decisions under CallProvider.

import { describe, expect, it } from 'vitest';
import {
  createCallSignal,
  deriveCallInviteToken,
  deriveCallSignalToken,
  generateDeviceIdentity,
  sealCallSignalFrame,
  type CallSignal,
  type CallSignalKind,
} from '@mylife/sync';
import {
  makeCallId,
  peekInboundCallSignal,
  planOutboundCallSignalTokens,
  shouldRingForInvite,
} from '../call-provider-core';

const PAIR_SECRET = 'ab'.repeat(32);
const PAIR_SECRET_BYTES = new Uint8Array(32).fill(0xab);

function signedSignal(kind: CallSignalKind, toDeviceId: string, callId = 'call-1') {
  const sender = generateDeviceIdentity('call-core-test');
  const result = createCallSignal({
    sender,
    callId,
    kind,
    toDeviceId,
    media: 'voice',
    nowMs: 1_000_000,
  });
  if (!result.ok) throw new Error(result.reason);
  return { sender, signal: result.signal };
}

describe('planOutboundCallSignalTokens', () => {
  it('sends invite and cancel on both the per-call and invite channels', () => {
    for (const kind of ['invite', 'cancel'] as const) {
      const { signal } = signedSignal(kind, 'cd'.repeat(32));
      const callToken = deriveCallSignalToken(PAIR_SECRET, signal.callId);
      const tokens = planOutboundCallSignalTokens(PAIR_SECRET, { token: callToken, signal });
      expect(tokens).toEqual([callToken, deriveCallInviteToken(PAIR_SECRET)]);
    }
  });

  it('keeps every other kind on the per-call channel only', () => {
    for (const kind of ['accept', 'decline', 'busy', 'end', 'offer', 'answer', 'ice', 'restart'] as const) {
      const { signal } = signedSignal(kind, 'cd'.repeat(32));
      const callToken = deriveCallSignalToken(PAIR_SECRET, signal.callId);
      expect(planOutboundCallSignalTokens(PAIR_SECRET, { token: callToken, signal }))
        .toEqual([callToken]);
    }
  });

  it('never duplicates a token when the session already targeted the invite channel', () => {
    const { signal } = signedSignal('invite', 'cd'.repeat(32));
    const inviteToken = deriveCallInviteToken(PAIR_SECRET);
    expect(planOutboundCallSignalTokens(PAIR_SECRET, { token: inviteToken, signal }))
      .toEqual([inviteToken]);
  });
});

describe('peekInboundCallSignal (NC-25.2)', () => {
  const self = generateDeviceIdentity('callee');

  function sealedFrom(sender: ReturnType<typeof generateDeviceIdentity>, kind: CallSignalKind = 'invite') {
    const result = createCallSignal({
      sender,
      callId: 'call-peek',
      kind,
      toDeviceId: self.publicKey,
      media: 'video',
      nowMs: 1_000_000,
    });
    if (!result.ok) throw new Error(result.reason);
    return { signal: result.signal, frame: sealCallSignalFrame(PAIR_SECRET_BYTES, result.signal) };
  }

  it('accepts a valid sealed invite from the channel peer', () => {
    const peer = generateDeviceIdentity('caller');
    const { frame, signal } = sealedFrom(peer);
    const result = peekInboundCallSignal({
      pairSecretBytes: PAIR_SECRET_BYTES,
      frame,
      peerDeviceId: peer.publicKey,
      selfDeviceId: self.publicKey,
      nowMs: 1_001_000,
      hasSeenNonce: () => false,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.signal.callId).toBe(signal.callId);
      expect(result.signal.kind).toBe('invite');
    }
  });

  it('rejects a signal signed by anyone other than the channel peer', () => {
    const peer = generateDeviceIdentity('caller');
    const impostor = generateDeviceIdentity('impostor');
    const { frame } = sealedFrom(impostor);
    const result = peekInboundCallSignal({
      pairSecretBytes: PAIR_SECRET_BYTES,
      frame,
      peerDeviceId: peer.publicKey,
      selfDeviceId: self.publicKey,
      nowMs: 1_001_000,
      hasSeenNonce: () => false,
    });
    expect(result.ok).toBe(false);
  });

  it('rejects a replayed nonce and a tampered frame; never records a nonce itself', () => {
    const peer = generateDeviceIdentity('caller');
    const { frame } = sealedFrom(peer);
    const seen: string[] = [];
    const replayed = peekInboundCallSignal({
      pairSecretBytes: PAIR_SECRET_BYTES,
      frame,
      peerDeviceId: peer.publicKey,
      selfDeviceId: self.publicKey,
      nowMs: 1_001_000,
      hasSeenNonce: (nonce) => {
        seen.push(nonce);
        return true;
      },
    });
    expect(replayed.ok).toBe(false);
    expect(seen.length).toBe(1);

    const text = new TextDecoder().decode(frame);
    const tampered = new TextEncoder().encode(text.slice(0, -1) + (text.endsWith('0') ? '1' : '0'));
    expect(peekInboundCallSignal({
      pairSecretBytes: PAIR_SECRET_BYTES,
      frame: tampered,
      peerDeviceId: peer.publicKey,
      selfDeviceId: self.publicKey,
      nowMs: 1_001_000,
      hasSeenNonce: () => false,
    }).ok).toBe(false);
  });

  it('rejects an expired signal (stale parked frames die at verify)', () => {
    const peer = generateDeviceIdentity('caller');
    const { frame } = sealedFrom(peer);
    const result = peekInboundCallSignal({
      pairSecretBytes: PAIR_SECRET_BYTES,
      frame,
      peerDeviceId: peer.publicKey,
      selfDeviceId: self.publicKey,
      nowMs: 1_000_000 + 10 * 60_000,
      hasSeenNonce: () => false,
    });
    expect(result.ok).toBe(false);
  });
});

describe('shouldRingForInvite', () => {
  const target = 'cd'.repeat(32);

  it('rings only for an invite with no live call', () => {
    const { signal } = signedSignal('invite', target);
    expect(shouldRingForInvite(signal, false)).toBe(true);
    expect(shouldRingForInvite(signal, true)).toBe(false);
  });

  it('never rings for a non-invite kind', () => {
    for (const kind of ['accept', 'offer', 'ice', 'end', 'cancel'] as const) {
      const { signal } = signedSignal(kind, target);
      expect(shouldRingForInvite(signal as CallSignal, false)).toBe(false);
    }
  });
});

describe('makeCallId', () => {
  it('shapes injected randomness into a uuid-like id and rejects bad input', () => {
    expect(makeCallId('0123456789abcdef0123456789abcdef'))
      .toBe('01234567-89ab-cdef-0123-456789abcdef');
    expect(() => makeCallId('short')).toThrow(TypeError);
    expect(() => makeCallId('Z123456789abcdef0123456789abcdef')).toThrow(TypeError);
  });
});
