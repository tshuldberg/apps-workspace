// Plan 25 WP-25G: the pure orchestration core under CallProvider.
//
// Everything here is IO-free and unit-tested; the provider layers the live
// transport, media backend, native bridge, and SQLite on top of these
// decisions. Honesty rules enforced at this seam:
//
//   - NC-25.2: an inbound frame may ring ONLY after openCallSignalFrame +
//     verifyCallSignal both pass against the exact peer the channel belongs
//     to. peekInboundCallSignal never records a nonce (recording stays with
//     the CallSession, which re-verifies), so the peek cannot poison replay
//     state or double-drop a legitimate signal.
//   - Invite routing: a callee cannot know a callId before the invite
//     arrives, so 'invite' and pre-accept 'cancel' frames are sent on BOTH
//     the pair invite channel and the per-call channel; everything else rides
//     the per-call channel only. Duplicate delivery is safe: the receiver's
//     nonce replay floor drops the second copy.

import {
  deriveCallInviteToken,
  openCallSignalFrame,
  verifyCallSignal,
  type CallSignal,
  type CallSignalKind,
  type OutboundCallSignal,
} from '@mylife/sync';

/** Kinds that must also ride the pair invite channel (pre-callId reachability). */
const INVITE_CHANNEL_KINDS: ReadonlySet<CallSignalKind> = new Set(['invite', 'cancel']);

/**
 * The full token set one outbound signal must be sent on. The per-call token
 * (chosen by CallSession) always leads; the pair invite token is appended for
 * invite/cancel so a callee that has not yet learned the callId still hears it.
 */
export function planOutboundCallSignalTokens(
  pairSecretHex: string,
  outbound: OutboundCallSignal,
): string[] {
  const tokens = [outbound.token];
  if (INVITE_CHANNEL_KINDS.has(outbound.signal.kind)) {
    const inviteToken = deriveCallInviteToken(pairSecretHex);
    if (inviteToken !== outbound.token) tokens.push(inviteToken);
  }
  return tokens;
}

export interface PeekInboundCallSignalInput {
  pairSecretBytes: Uint8Array;
  frame: Uint8Array;
  /** The peer this channel belongs to; only their signature may pass. */
  peerDeviceId: string;
  selfDeviceId: string;
  nowMs: number;
  /** Read-only replay check; the peek NEVER records the nonce. */
  hasSeenNonce: (nonce: string) => boolean;
}

export type PeekInboundCallSignalResult =
  | { ok: true; signal: CallSignal; raw: unknown }
  | { ok: false };

/**
 * Open a sealed relay frame and verify the signal against the channel's peer.
 * Returns the verified signal AND the raw opened value: the raw value is what
 * the CallSession must consume (it re-verifies and records the nonce itself,
 * NC-25.2), so verification is never split from state advancement.
 */
export function peekInboundCallSignal(
  input: PeekInboundCallSignalInput,
): PeekInboundCallSignalResult {
  const raw = openCallSignalFrame(input.pairSecretBytes, input.frame);
  if (raw === null) return { ok: false };
  const verified = verifyCallSignal(raw, {
    senderPublicKey: input.peerDeviceId,
    expectedRecipientDeviceId: input.selfDeviceId,
    nowMs: input.nowMs,
    hasSeenNonce: input.hasSeenNonce,
  });
  if (!verified.ok) return { ok: false };
  return { ok: true, signal: verified.signal, raw };
}

/**
 * Whether a verified inbound signal may START a new incoming call flow.
 * Only a verified 'invite' with no live call may ring (one call at a time);
 * anything else routes to the existing session or is dropped.
 */
export function shouldRingForInvite(
  signal: CallSignal,
  hasActiveCall: boolean,
): boolean {
  return signal.kind === 'invite' && !hasActiveCall;
}

/** A stable UUID-shaped call id from an injected random source (no Date/Math). */
export function makeCallId(randomHex32: string): string {
  if (!/^[0-9a-f]{32}$/u.test(randomHex32)) {
    throw new TypeError('makeCallId needs 32 lowercase hex chars');
  }
  return [
    randomHex32.slice(0, 8),
    randomHex32.slice(8, 12),
    randomHex32.slice(12, 16),
    randomHex32.slice(16, 20),
    randomHex32.slice(20, 32),
  ].join('-');
}
