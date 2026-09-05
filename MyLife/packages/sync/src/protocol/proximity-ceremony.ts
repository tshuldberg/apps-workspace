/**
 * Plan 53 P0: the in-person proximity friend ceremony.
 *
 * Two people standing together each tap one button. Both phones advertise AND
 * browse at once, meet over the Nearby substrate, exchange signed identity
 * bundles, show the same short authentication string, and both confirm. The
 * result is the ordinary paired state, with no relay and no internet.
 *
 * Everything here is PURE: a reducer plus frame builders and validators. The
 * transport (Multipeer on iOS, Wi-Fi Direct on Android) is injected by the app
 * adapter in P1, so every state-machine path, every rejection, and every SAS
 * vector is testable without a device.
 *
 * THREAT MODEL, and what answers each threat:
 *
 *  - IN-ROOM MITM. Multipeer is room-scale, not touch-scale, so "the phone I
 *    connected to" is not evidence of "the phone in front of me". An attacker
 *    can run two sessions and relay between them. Answer: the SAS is derived
 *    from the ephemeral DH secret AND the full transcript, so an attacker who
 *    terminates both sides holds two different secrets and the two screens show
 *    different emoji. The users comparing them IS the security control; this is
 *    why the ceremony cannot auto-confirm, ever.
 *
 *  - ADVERTISEMENT TRACKING. A passive listener in a cafe must not be able to
 *    tell that the same phone ran two ceremonies, or which phone it is. Answer:
 *    the advertised handle is a per-tap ephemeral id (`newCeremonyId`) and
 *    nothing else. No device id, no DH key, no display name, no stable value.
 *    Identity moves only after the session exists, inside the sealed channel.
 *
 *  - NO CONFIDENTIALITY FROM THE SUBSTRATE. iOS sets MCSession
 *    encryptionPreference .required; the Android twin is a raw TCP socket with
 *    NO transport encryption. The ceremony therefore seals its OWN payloads
 *    (ephemeral X25519 -> HKDF -> secretbox) and never relies on the channel.
 *    Sealing is not conditional on platform.
 *
 *  - UNILATERAL COMMIT. Neither side may end up believing it paired with
 *    someone who did not agree. Answer: a side commits only after the peer's
 *    signed accept verifies, and that accept covers the transcript hash. The
 *    honest limit is stated in `commitOnPeerAccept`: this is the two generals
 *    problem, so a LOST final accept can leave one side paired and the other
 *    not. That is detectable and re-runnable; a fabricated mutual confirmation
 *    would not be.
 *
 *  - STALE CEREMONY REPLAY. An accept captured from an earlier ceremony must be
 *    worthless. Answer: the transcript covers both fresh ephemeral public keys
 *    and both fresh nonces, so an accept from any other ceremony verifies
 *    against a different hash and is rejected.
 */

import nacl from 'tweetnacl';
import type { DeviceIdentity } from '../types';
import {
  extractSigningPrivateKeyHex,
  signMessage,
  verifySignature,
} from '../identity/device-identity';
import { bytesToHex, hexToBytes } from '../encryption/keys';
import { hkdf } from '../node/hkdf';
import { deriveSas, sasMatches, type SasResult } from './sas';
import {
  verifySignedIdentityBundle,
  type SignedIdentityBundle,
} from './identity-bundle';

const encoder = new TextEncoder();

/** The ceremony's own discovery namespace, distinct from the sync rung's. */
export const CEREMONY_SERVICE_TYPE = 'mk-ceremony';

/** How long a ceremony may stay open before it expires (AC-2). */
export const CEREMONY_WINDOW_MS = 90_000;

/** Ephemeral ceremony id length in bytes (hex-encoded on the wire). */
export const CEREMONY_ID_BYTES = 8;

/** Per-ceremony nonce length in bytes. */
export const CEREMONY_NONCE_BYTES = 16;

const TRANSCRIPT_TAG = 'meerkat-ceremony-transcript-v1';
const ACCEPT_TAG = 'meerkat-ceremony-accept-v1';
const SEAL_INFO = 'meerkat-ceremony-seal-v1';
const SAS_INFO = 'meerkat-ceremony-sas-v1';

// ---------------------------------------------------------------------------
// Wire frames
// ---------------------------------------------------------------------------

/**
 * The first frame, sent in the clear because it is what BOOTSTRAPS the sealed
 * channel. It deliberately carries no long-term identifier: the ephemeral
 * public key and nonce are fresh per ceremony, and the ceremony id is the same
 * ephemeral value already in the advertisement.
 */
export interface CeremonyHelloFrame {
  kind: 'ceremony-hello';
  version: 1;
  ceremonyId: string;
  /** Fresh X25519 public key (hex), used ONLY for this ceremony. */
  ephemeralPublicKey: string;
  /** Fresh random nonce (hex), so no two ceremonies share a transcript. */
  nonce: string;
}

/** The identity exchange, sealed to the ephemeral channel. */
export interface CeremonyBundleFrame {
  kind: 'ceremony-bundle';
  version: 1;
  /** secretbox nonce (hex). */
  boxNonce: string;
  /** Sealed JSON of a SignedIdentityBundle (hex). */
  sealed: string;
}

/** The signed agreement to pair, sent only after the local user confirms. */
export interface CeremonyAcceptFrame {
  kind: 'ceremony-accept';
  version: 1;
  /** The sender's device id (its Ed25519 public key). */
  deviceId: string;
  /** The transcript hash this accept covers (hex). */
  transcriptHash: string;
  /** Ed25519 signature (hex) by deviceId over the tagged transcript hash. */
  signature: string;
}

export type CeremonyFrame = CeremonyHelloFrame | CeremonyBundleFrame | CeremonyAcceptFrame;

// ---------------------------------------------------------------------------
// Ephemeral material
// ---------------------------------------------------------------------------

export interface CeremonyEphemeral {
  ceremonyId: string;
  nonce: string;
  ephemeralPublicKey: string;
  /** Never leaves the device, never logged. */
  ephemeralSecretKey: Uint8Array;
}

/**
 * Fresh per-tap material. The ceremony id is what the transport advertises, so
 * generating it here (rather than reusing any device handle) is the whole of
 * AC-3's privacy claim on the JS side. The native advertiser must mint a fresh
 * peer id from it; see the plan 53 amendment.
 */
export function newCeremonyEphemeral(): CeremonyEphemeral {
  const keyPair = nacl.box.keyPair();
  return {
    ceremonyId: bytesToHex(nacl.randomBytes(CEREMONY_ID_BYTES)),
    nonce: bytesToHex(nacl.randomBytes(CEREMONY_NONCE_BYTES)),
    ephemeralPublicKey: bytesToHex(keyPair.publicKey),
    ephemeralSecretKey: keyPair.secretKey,
  };
}

export function helloFrameFor(ephemeral: CeremonyEphemeral): CeremonyHelloFrame {
  return {
    kind: 'ceremony-hello',
    version: 1,
    ceremonyId: ephemeral.ceremonyId,
    ephemeralPublicKey: ephemeral.ephemeralPublicKey,
    nonce: ephemeral.nonce,
  };
}

function isHex(value: unknown, byteLength?: number): value is string {
  if (typeof value !== 'string') return false;
  if (byteLength !== undefined && value.length !== byteLength * 2) return false;
  return value.length > 0 && value.length % 2 === 0 && /^[0-9a-f]+$/.test(value);
}

export function isValidHelloFrame(frame: unknown): frame is CeremonyHelloFrame {
  const f = frame as CeremonyHelloFrame;
  return !!f
    && f.kind === 'ceremony-hello'
    && f.version === 1
    && isHex(f.ceremonyId, CEREMONY_ID_BYTES)
    && isHex(f.ephemeralPublicKey, 32)
    && isHex(f.nonce, CEREMONY_NONCE_BYTES);
}

/**
 * The advertised payload, isolated in one function so AC-3 can be asserted
 * against it directly. If this ever returns anything but the ephemeral id, the
 * privacy claim is broken and the payload-shape test fails.
 */
export function ceremonyAdvertisementPayload(ephemeral: CeremonyEphemeral): { ceremonyId: string } {
  return { ceremonyId: ephemeral.ceremonyId };
}

// ---------------------------------------------------------------------------
// Channel + transcript
// ---------------------------------------------------------------------------

/**
 * The sealing key for this ceremony's frames.
 *
 * Salted with the SORTED pair of ephemeral public keys so both sides derive the
 * same key without needing to agree on who is the initiator, which the
 * symmetric "both tap the same button" design means nobody can decide.
 */
export function deriveCeremonyKey(
  ephemeral: CeremonyEphemeral,
  peerHello: CeremonyHelloFrame,
): Uint8Array {
  const shared = nacl.box.before(hexToBytes(peerHello.ephemeralPublicKey), ephemeral.ephemeralSecretKey);
  const salt = encoder.encode(
    [ephemeral.ephemeralPublicKey, peerHello.ephemeralPublicKey].sort().join('|'),
  );
  return hkdf(shared, SEAL_INFO, salt, 32);
}

/**
 * The ceremony transcript hash: everything both sides contributed, in an order
 * both compute identically.
 *
 * Covering the bundles as well as the hellos is what makes the SAS a statement
 * about WHO you are pairing with rather than merely about the channel: swap a
 * bundle and the emoji change. Covering both nonces and both ephemeral keys is
 * what makes a prior ceremony's accept worthless here.
 */
export function ceremonyTranscriptHash(input: {
  selfHello: CeremonyHelloFrame;
  peerHello: CeremonyHelloFrame;
  selfBundle: SignedIdentityBundle;
  peerBundle: SignedIdentityBundle;
}): string {
  const side = (hello: CeremonyHelloFrame, bundle: SignedIdentityBundle): string => JSON.stringify([
    hello.ceremonyId,
    hello.ephemeralPublicKey,
    hello.nonce,
    bundle.bundle.deviceId,
    bundle.bundle.dhPublicKey,
    bundle.signature,
  ]);
  const sides = [
    side(input.selfHello, input.selfBundle),
    side(input.peerHello, input.peerBundle),
  ].sort();
  return bytesToHex(nacl.hash(encoder.encode(JSON.stringify([TRANSCRIPT_TAG, ...sides])))).slice(0, 64);
}

/**
 * The five emoji both users compare. Bound to the ephemeral secret AND the
 * transcript, so an in-room attacker relaying between two sessions cannot make
 * the two screens agree.
 */
export function ceremonySas(channelKey: Uint8Array, transcriptHash: string): SasResult {
  return deriveSas(hkdf(channelKey, SAS_INFO, hexToBytes(transcriptHash), 32));
}

// ---------------------------------------------------------------------------
// Sealing
// ---------------------------------------------------------------------------

export function sealBundleFrame(
  channelKey: Uint8Array,
  bundle: SignedIdentityBundle,
): CeremonyBundleFrame {
  const boxNonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const sealed = nacl.secretbox(encoder.encode(JSON.stringify(bundle)), boxNonce, channelKey);
  return {
    kind: 'ceremony-bundle',
    version: 1,
    boxNonce: bytesToHex(boxNonce),
    sealed: bytesToHex(sealed),
  };
}

/**
 * Open a bundle frame AND verify its self-signature. Fail-closed: an
 * unopenable box, malformed JSON, or a bundle whose signature does not match
 * its deviceId all return null, and the caller must render nothing (AC-4).
 */
export function openBundleFrame(
  channelKey: Uint8Array,
  frame: CeremonyBundleFrame,
): SignedIdentityBundle | null {
  if (!frame || frame.kind !== 'ceremony-bundle' || frame.version !== 1) return null;
  if (!isHex(frame.boxNonce, nacl.secretbox.nonceLength) || !isHex(frame.sealed)) return null;
  let opened: Uint8Array | null;
  try {
    opened = nacl.secretbox.open(hexToBytes(frame.sealed), hexToBytes(frame.boxNonce), channelKey);
  } catch {
    return null;
  }
  if (!opened) return null;
  let parsed: SignedIdentityBundle;
  try {
    parsed = JSON.parse(new TextDecoder().decode(opened)) as SignedIdentityBundle;
  } catch {
    return null;
  }
  if (!verifySignedIdentityBundle(parsed)) return null;
  return parsed;
}

// ---------------------------------------------------------------------------
// Accept
// ---------------------------------------------------------------------------

function acceptBytes(transcriptHash: string): Uint8Array {
  return encoder.encode(JSON.stringify([ACCEPT_TAG, transcriptHash]));
}

/** Sign this device's agreement to pair. Only ever called after a local confirm. */
export function signCeremonyAccept(
  identity: DeviceIdentity,
  transcriptHash: string,
): CeremonyAcceptFrame {
  const privateKeyHex = extractSigningPrivateKeyHex(identity.privateKeyRef);
  return {
    kind: 'ceremony-accept',
    version: 1,
    deviceId: identity.publicKey,
    transcriptHash,
    signature: bytesToHex(signMessage(privateKeyHex, acceptBytes(transcriptHash))),
  };
}

export type AcceptVerdict =
  | { ok: true }
  | { ok: false; reason: 'malformed' | 'wrong_transcript' | 'wrong_device' | 'bad_signature' };

/**
 * Verify the peer's accept.
 *
 * `wrong_transcript` is the replay rejection: an accept captured from any other
 * ceremony covers a different hash, because the transcript includes both fresh
 * ephemeral keys and both fresh nonces. `wrong_device` binds the accept to the
 * bundle we actually verified, so a valid accept from a THIRD device cannot be
 * substituted for the one we are looking at.
 */
export function verifyCeremonyAccept(
  frame: unknown,
  expected: { transcriptHash: string; peerDeviceId: string },
): AcceptVerdict {
  const f = frame as CeremonyAcceptFrame;
  if (!f || f.kind !== 'ceremony-accept' || f.version !== 1) return { ok: false, reason: 'malformed' };
  if (!isHex(f.deviceId, 32) || !isHex(f.transcriptHash) || !isHex(f.signature)) {
    return { ok: false, reason: 'malformed' };
  }
  if (f.transcriptHash !== expected.transcriptHash) return { ok: false, reason: 'wrong_transcript' };
  if (f.deviceId !== expected.peerDeviceId) return { ok: false, reason: 'wrong_device' };
  let verified: boolean;
  try {
    verified = verifySignature(f.deviceId, acceptBytes(f.transcriptHash), hexToBytes(f.signature));
  } catch {
    return { ok: false, reason: 'bad_signature' };
  }
  return verified ? { ok: true } : { ok: false, reason: 'bad_signature' };
}

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

export type CeremonyPhase =
  /** Advertising and browsing; no peer yet. */
  | 'discovering'
  /** A session exists and hellos were exchanged; identities not yet verified. */
  | 'connected'
  /** Both bundles verified; the SAS is on screen awaiting the local user. */
  | 'awaiting_confirm'
  /** This user confirmed; waiting for the peer's signed accept. */
  | 'awaiting_peer'
  /** Both sides agreed. The caller may now write the pairing. */
  | 'committed'
  | 'cancelled'
  | 'expired'
  | 'failed';

export type CeremonyFailure =
  | 'peer_bundle_rejected'
  | 'peer_accept_rejected'
  | 'self_pairing'
  | 'transport_lost';

export interface CeremonyState {
  phase: CeremonyPhase;
  startedAt: number;
  ephemeral: CeremonyEphemeral;
  peerHello?: CeremonyHelloFrame;
  channelKey?: Uint8Array;
  selfBundle?: SignedIdentityBundle;
  peerBundle?: SignedIdentityBundle;
  transcriptHash?: string;
  sas?: SasResult;
  /** Set only when phase is 'failed'; drives the honest error copy. */
  failure?: CeremonyFailure;
}

export type CeremonyEvent =
  | { type: 'peer_hello'; frame: unknown }
  | { type: 'peer_bundle'; frame: CeremonyBundleFrame }
  | { type: 'local_confirm' }
  | { type: 'peer_accept'; frame: unknown }
  | { type: 'cancel' }
  | { type: 'transport_lost' }
  | { type: 'tick'; now: number };

export function startCeremony(
  selfBundle: SignedIdentityBundle,
  now: number,
  ephemeral: CeremonyEphemeral = newCeremonyEphemeral(),
): CeremonyState {
  return { phase: 'discovering', startedAt: now, ephemeral, selfBundle };
}

/** Phases from which nothing further can happen. */
function isTerminal(phase: CeremonyPhase): boolean {
  return phase === 'committed' || phase === 'cancelled' || phase === 'expired' || phase === 'failed';
}

/**
 * The reducer. Pure, so every path in the threat model is a unit test.
 *
 * Two rules run before anything else and are the whole of AC-2: a terminal
 * ceremony never moves again (so a late frame cannot revive a cancelled one),
 * and an expired one commits nothing however far along it was.
 */
export function ceremonyReducer(
  state: CeremonyState,
  event: CeremonyEvent,
  identity: DeviceIdentity,
): CeremonyState {
  if (isTerminal(state.phase)) return state;

  if (event.type === 'tick') {
    return event.now - state.startedAt >= CEREMONY_WINDOW_MS
      ? { ...state, phase: 'expired' }
      : state;
  }
  if (event.type === 'cancel') return { ...state, phase: 'cancelled' };
  if (event.type === 'transport_lost') {
    // Losing the session before commit is a failure, not a cancel: the user did
    // nothing wrong and the copy should say so. After commit it cannot reach
    // here, because commit is terminal.
    return { ...state, phase: 'failed', failure: 'transport_lost' };
  }

  switch (event.type) {
    case 'peer_hello': {
      if (state.phase !== 'discovering') return state;
      if (!isValidHelloFrame(event.frame)) return state;
      // A phone that somehow met itself must not pair with itself. The ceremony
      // id is ephemeral and unique per tap, so an identical one means exactly
      // that: our own advertisement came back to us.
      if (event.frame.ceremonyId === state.ephemeral.ceremonyId) {
        return { ...state, phase: 'failed', failure: 'self_pairing' };
      }
      return {
        ...state,
        phase: 'connected',
        peerHello: event.frame,
        channelKey: deriveCeremonyKey(state.ephemeral, event.frame),
      };
    }

    case 'peer_bundle': {
      if (state.phase !== 'connected') return state;
      if (!state.channelKey || !state.peerHello || !state.selfBundle) return state;
      const peerBundle = openBundleFrame(state.channelKey, event.frame);
      if (!peerBundle) return { ...state, phase: 'failed', failure: 'peer_bundle_rejected' };
      if (peerBundle.bundle.deviceId === identity.publicKey) {
        return { ...state, phase: 'failed', failure: 'self_pairing' };
      }
      const transcriptHash = ceremonyTranscriptHash({
        selfHello: helloFrameFor(state.ephemeral),
        peerHello: state.peerHello,
        selfBundle: state.selfBundle,
        peerBundle,
      });
      return {
        ...state,
        phase: 'awaiting_confirm',
        peerBundle,
        transcriptHash,
        sas: ceremonySas(state.channelKey, transcriptHash),
      };
    }

    case 'local_confirm': {
      // Confirm is meaningful ONLY once the SAS the user just compared is on
      // screen. Accepting it earlier would mean signing an agreement about a
      // peer whose identity had not been verified yet.
      if (state.phase !== 'awaiting_confirm') return state;
      return { ...state, phase: 'awaiting_peer' };
    }

    case 'peer_accept': {
      // An accept that arrives BEFORE this user confirmed is not an error: the
      // peer simply confirmed first. It is deliberately ignored rather than
      // stored, so the commit below always requires a local confirm that has
      // already happened. The peer resends on our accept.
      if (state.phase !== 'awaiting_peer') return state;
      if (!state.transcriptHash || !state.peerBundle) return state;
      const verdict = verifyCeremonyAccept(event.frame, {
        transcriptHash: state.transcriptHash,
        peerDeviceId: state.peerBundle.bundle.deviceId,
      });
      if (!verdict.ok) return { ...state, phase: 'failed', failure: 'peer_accept_rejected' };
      return { ...state, phase: 'committed' };
    }

    default:
      return state;
  }
}

/**
 * The bundle to persist, or null if the ceremony has not earned it.
 *
 * The ONLY way to a non-null result is phase 'committed', which requires a
 * local confirm and a verified peer accept over the same transcript. Callers
 * write the pairing through the existing `applyTrustedBundle`, so an in-person
 * add produces byte-identical rows to the copy-paste flow (AC-5).
 *
 * HONEST LIMIT: this is the two generals problem and no protocol solves it. If
 * our accept is lost after we received the peer's, we pair and they do not.
 * That is visible (they are not in the friend list) and fixed by re-running the
 * ceremony, which the "Already paired with that device" path handles. The
 * alternative -- committing before the peer's accept verifies -- would trade a
 * recoverable asymmetry for a fabricated claim of mutual agreement.
 */
export function ceremonyPairingResult(state: CeremonyState): SignedIdentityBundle | null {
  return state.phase === 'committed' ? state.peerBundle ?? null : null;
}

/** True when both screens are showing the same emoji (diagnostics + tests). */
export function ceremonySasAgrees(a: CeremonyState, b: CeremonyState): boolean {
  return !!a.sas && !!b.sas && sasMatches(a.sas, b.sas);
}
