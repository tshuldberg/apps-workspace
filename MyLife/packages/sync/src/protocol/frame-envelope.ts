/**
 * Frame envelope (MK-044): every engine-session frame crossing a pipe is
 * sealed under a key derived from the PAIR's shared secret, so the pipe
 * (relay, LAN segment, any on-path observer) sees only:
 *
 *   [1 byte version 0xE1][24-byte random nonce][secretbox ciphertext]
 *
 * What an observer loses versus the bare message codec: message types, device
 * public keys, codec nonces, timestamps, and payload shapes. It learns only
 * frame count, sizes, and timing. Because the key is bound to the pairwise
 * shared secret (never to anything exchanged in-band), an ACTIVELY malicious
 * relay cannot strip or re-establish the envelope: it never holds a pair
 * secret. This closes the audit finding that frame headers leaked stable
 * device identities to the relay.
 *
 * The initiator knows which peer it is dialing (connectRelayPeer requires
 * remoteDeviceId), so it seals under that pair's key from frame one. The
 * responder cannot know which paired device is dialing until a frame opens,
 * so it trial-decrypts the first frame against each active paired device and
 * then locks the matched key for the connection's lifetime. Frames that open
 * under no key are dropped: an unpaired stranger cannot even reach the
 * handshake, matching the existing invariant that the handshake itself
 * requires a pairwise key.
 */

import type { DeviceIdentity, PairedDevice, TransportConnection } from '../types';
import { decrypt, encrypt } from '../encryption/encrypt';
import { deriveKeyV2 } from '../encryption/keys';
import { resolvePairSharedSecret } from './payload-security';

export const FRAME_ENVELOPE_VERSION = 0xe1;

const NONCE_LENGTH = 24;

/** Derive the per-pair envelope key. Domain-separated from every payload key. */
export function deriveFrameEnvelopeKey(
  sharedSecret: Uint8Array,
  localDeviceId: string,
  remoteDeviceId: string,
): Uint8Array {
  const pairId = [localDeviceId, remoteDeviceId].sort().join(':');
  return deriveKeyV2(sharedSecret, `mylife-sync-frame-envelope:v1:${pairId}`);
}

/** Seal one frame. Output: [version][nonce][ciphertext]. */
export function sealFrame(key: Uint8Array, frame: Uint8Array): Uint8Array {
  const sealed = encrypt(frame, key);
  const wire = new Uint8Array(1 + NONCE_LENGTH + sealed.ciphertext.length);
  wire[0] = FRAME_ENVELOPE_VERSION;
  wire.set(sealed.nonce, 1);
  wire.set(sealed.ciphertext, 1 + NONCE_LENGTH);
  return wire;
}

/** Open one frame; null on wrong version, truncation, wrong key, or tamper. */
export function openFrame(key: Uint8Array, wire: Uint8Array): Uint8Array | null {
  if (wire.length < 1 + NONCE_LENGTH + 16) return null;
  if (wire[0] !== FRAME_ENVELOPE_VERSION) return null;
  const nonce = wire.slice(1, 1 + NONCE_LENGTH);
  const ciphertext = wire.slice(1 + NONCE_LENGTH);
  try {
    return decrypt(ciphertext, nonce, key);
  } catch {
    return null;
  }
}

/** Resolve the envelope key for a known peer, or null when not pairable. */
export function resolveFrameEnvelopeKeyForPeer(
  identity: DeviceIdentity,
  pairedDevices: PairedDevice[],
  remoteDeviceId: string,
): Uint8Array | null {
  const sharedSecret = resolvePairSharedSecret(pairedDevices, remoteDeviceId);
  if (!sharedSecret) return null;
  return deriveFrameEnvelopeKey(sharedSecret, identity.publicKey, remoteDeviceId);
}

export interface FrameEnvelopeOptions {
  identity: DeviceIdentity;
  pairedDevices: PairedDevice[];
}

/**
 * Wrap a TransportConnection so everything inside the session sees plaintext
 * frames while the wire carries only sealed envelopes.
 *
 * Sending requires a resolved key: the connection's remoteDeviceId when known,
 * otherwise the key locked by the first successfully opened inbound frame.
 * Sending with no key throws rather than ever emitting a bare frame.
 */
export function wrapConnectionWithFrameEnvelope(
  connection: TransportConnection,
  options: FrameEnvelopeOptions,
): TransportConnection {
  let lockedKey: Uint8Array | null = connection.remoteDeviceId
    ? resolveFrameEnvelopeKeyForPeer(options.identity, options.pairedDevices, connection.remoteDeviceId)
    : null;
  let lockedDeviceId: string | null = lockedKey ? connection.remoteDeviceId : null;

  const tryOpen = (wire: Uint8Array): Uint8Array | null => {
    if (lockedKey) return openFrame(lockedKey, wire);
    for (const device of options.pairedDevices) {
      if (!device.isActive) continue;
      const key = resolveFrameEnvelopeKeyForPeer(options.identity, options.pairedDevices, device.deviceId);
      if (!key) continue;
      const frame = openFrame(key, wire);
      if (frame) {
        lockedKey = key;
        lockedDeviceId = device.deviceId;
        return frame;
      }
    }
    return null;
  };

  return {
    id: connection.id,
    get remoteDeviceId() {
      return lockedDeviceId ?? connection.remoteDeviceId;
    },
    transport: connection.transport,
    send: (data: Uint8Array) => {
      if (!lockedKey) {
        throw new Error('Frame envelope key unavailable: peer is not a paired device');
      }
      return connection.send(sealFrame(lockedKey, data));
    },
    onData: (handler: (data: Uint8Array) => void) => {
      connection.onData((wire) => {
        const frame = tryOpen(wire);
        if (frame) handler(frame);
        // Frames that open under no paired key are dropped: an unpaired or
        // tampering sender never reaches the codec, let alone the handshake.
      });
    },
    close: () => connection.close(),
  };
}
