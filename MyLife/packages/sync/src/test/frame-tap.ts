/**
 * Test-only helpers for inspecting wire frames now that every session frame
 * crosses the pipe inside the pairwise frame envelope (MK-044). A tap that
 * wants to see codec frames must open the envelope exactly like the peer
 * would: with the key derived from the pair's shared secret.
 */

import type { SyncMessage } from '../types';
import { hexToBytes } from '../encryption/keys';
import { decodeMessage } from '../protocol/message-codec';
import { deriveFrameEnvelopeKey, openFrame } from '../protocol/frame-envelope';

/** Envelope key from a `local:shared:` style hex secret (mirrors the store). */
export function envelopeKeyFromSharedHex(
  sharedSecretHex: string,
  deviceA: string,
  deviceB: string,
): Uint8Array {
  return deriveFrameEnvelopeKey(hexToBytes(sharedSecretHex.slice(0, 64)), deviceA, deviceB);
}

/** Open one captured wire frame back to codec bytes, or null. */
export function openTappedFrame(key: Uint8Array, wire: Uint8Array): Uint8Array | null {
  return openFrame(key, wire);
}

/** Open + decode one captured wire frame, or null. */
export function decodeTappedMessage(key: Uint8Array, wire: Uint8Array): SyncMessage | null {
  const inner = openFrame(key, wire);
  return inner ? decodeMessage(inner) : null;
}
