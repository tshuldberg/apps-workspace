/**
 * Friend-code rendezvous: identity layer over the relay rendezvous store
 * (plan 14, MK-016).
 *
 * A device that wants to be found generates a friend code (MEER-XXXX-...),
 * publishes its SIGNED identity bundle (MK-015) to a relay under the code's
 * rendezvous id, and shares the code. A peer types the code, resolves the
 * bundle, and verifies its self-signature before pairing. The code carries no
 * key material; trust comes from the signature plus first-use pinning.
 *
 * Sealed record (Plan 23 D.5): when the publisher supplies the `secretHalf` of
 * an extended friend code, the published record is `encryptString(JSON(signed),
 * key)` where `key = HKDF(secretHalf, 'meerkat-rendezvous-seal-v1')`. The relay
 * still stores `rec` opaquely (no relay change), but the secret half NEVER
 * reaches the relay (only the `rid`, an HKDF of the public half, is sent), so a
 * relay operator can no longer read a device's public keys or display name from
 * a record. The self-signature is still verified post-decrypt, preserving TOFU.
 *
 * Legacy compatibility: records published before D.5 are `base64(JSON(signed))`.
 * Resolve tries the sealed path first, then falls back to the plain path while
 * `allowLegacyUnsealed` is true (default), so old shared codes keep pairing for a
 * transition window. NEW publishes with a secret half are always sealed.
 */

import naclUtil from 'tweetnacl-util';
import type { DeviceIdentity } from '../types';
import { bytesToHex } from '../encryption/keys';
import { encryptString, decryptString } from '../encryption/encrypt';
import { hkdf } from './hkdf';
import {
  createSignedIdentityBundle,
  verifySignedIdentityBundle,
  type SignedIdentityBundle,
} from '../protocol/identity-bundle';
import {
  buildExtendedFriendCode,
  encodeFriendCode,
  friendCodeToRendezvousId,
  parseExtendedFriendCode,
  rendezvousIdFromCustomCode,
} from './friend-code';
import {
  publishRendezvous,
  resolveRendezvous,
  type RendezvousClientOptions,
  type PublishRendezvousReceipt,
} from '../transport/rendezvous-client';

const { encodeBase64, decodeBase64, decodeUTF8, encodeUTF8 } = naclUtil;

/** Domain-separated derivation of the rendezvous seal key from a secret half. */
const RENDEZVOUS_SEAL_INFO = 'meerkat-rendezvous-seal-v1';

/** Derive the 32-byte secretbox key that seals a rendezvous record. */
export function deriveRendezvousSealKey(secretHalf: Uint8Array): Uint8Array {
  return hkdf(secretHalf, RENDEZVOUS_SEAL_INFO);
}

export interface PublishIdentityInput extends RendezvousClientOptions {
  url: string;
  identity: DeviceIdentity;
  onPublished?: (receipt: PublishRendezvousReceipt) => void;
  /**
   * The 8-byte rendezvous id from generateFriendCode() (standard checksummed
   * code path). Provide this OR `customCode`, not both.
   */
  rendezvousId?: Uint8Array;
  /**
   * A user-chosen custom (vanity + suffix) friend code. Its rendezvous id is
   * derived deterministically via the domain-separated hash; this exact display
   * string is returned to share. Provide this OR `rendezvousId`.
   */
  customCode?: string;
  relayHints?: string[];
  /** Requested TTL; the relay clamps to its own maximum. */
  ttlMs?: number;
  /**
   * The secret half of an extended friend code (Plan 23 D.5). When supplied the
   * published record is SEALED with `HKDF(secretHalf, 'meerkat-rendezvous-seal-v1')`
   * so the relay cannot read the identity from the record. When omitted the
   * record is the legacy `base64(JSON)` form (a resolver still verifies the
   * self-signature either way).
   */
  secretHalf?: Uint8Array;
}

/**
 * Publish this device's signed identity bundle under a friend code's rendezvous
 * id. Returns the formatted friend code to share. The bundle is self-signed by
 * the device's Ed25519 key, so a resolver can verify it without prior contact.
 *
 * Accepts either a standard `rendezvousId` (the 8 random bytes behind a
 * checksummed code) or a `customCode` (vanity + random suffix, whose rid is
 * derived by the domain-separated hash). Exactly one must be supplied.
 */
export async function publishIdentityToRendezvous(input: PublishIdentityInput): Promise<string> {
  let rid: Uint8Array;
  let returnedCode: string;
  if (input.customCode != null) {
    const customRid = rendezvousIdFromCustomCode(input.customCode);
    if (!customRid) {
      throw new Error('publishIdentityToRendezvous: invalid customCode.');
    }
    rid = customRid;
    returnedCode = input.customCode;
  } else if (input.rendezvousId != null) {
    rid = input.rendezvousId;
    returnedCode = encodeFriendCode(input.rendezvousId);
  } else {
    throw new Error('publishIdentityToRendezvous: provide rendezvousId or customCode.');
  }

  const signed = createSignedIdentityBundle(input.identity, input.relayHints ?? []);
  // Build the shareable code FIRST so a malformed secretHalf (wrong length) throws
  // BEFORE any network publish, never leaving an orphan sealed record in relay
  // storage. When sealed, the returned code is the EXTENDED (public + secret) code.
  const shareCode = input.secretHalf ? buildExtendedFriendCode(returnedCode, input.secretHalf) : returnedCode;
  // D.5: seal the record with the extended code's secret half when provided; the
  // secret half never leaves the device (only `rid` is transmitted). Otherwise
  // fall back to the legacy opaque base64 record.
  const record = input.secretHalf
    ? encryptString(JSON.stringify(signed), deriveRendezvousSealKey(input.secretHalf))
    : encodeBase64(decodeUTF8(JSON.stringify(signed)));
  const receipt = await publishRendezvous({
    url: input.url,
    rid: bytesToHex(rid),
    record,
    ttlMs: input.ttlMs,
    webSocketImpl: input.webSocketImpl,
    timeoutMs: input.timeoutMs,
    entitlementToken: input.entitlementToken,
  });
  input.onPublished?.(receipt);
  // The share code (extended when sealed) was validated + built before publish.
  return shareCode;
}

export type ResolveIdentityResult =
  | { ok: true; bundle: SignedIdentityBundle }
  | { ok: false; reason: 'bad_code' | 'not_found' | 'invalid_bundle' };

export interface ResolveIdentityInput extends RendezvousClientOptions {
  url: string;
  /**
   * The friend code typed in by the user: a standard checksummed
   * MEER-XXXX-XXXX-XXXX-XXXX, a custom vanity code, or an EXTENDED (sealed) code
   * carrying a secret half after `~`. Resolution accepts all three.
   */
  code: string;
  /**
   * D.5 transition flag: when true (default) resolve falls back to reading a
   * legacy `base64(JSON)` record if the sealed decrypt fails, so codes shared
   * before D.5 keep pairing. Set false to require a sealed record.
   */
  allowLegacyUnsealed?: boolean;
}

/**
 * Resolve a friend code to its published signed identity bundle. For an extended
 * (sealed) code the record is decrypted with the code's secret half before
 * verification; for a legacy code the opaque base64 record is parsed directly.
 * Verifies the bundle's self-signature in every path; a malformed, unresolved
 * (expired/used), or unverifiable record yields a typed failure, never a throw.
 */
export async function resolveIdentityFromRendezvous(
  input: ResolveIdentityInput,
): Promise<ResolveIdentityResult> {
  const allowLegacy = input.allowLegacyUnsealed ?? true;
  const extended = parseExtendedFriendCode(input.code);
  const rid = extended ? extended.rendezvousId : friendCodeToRendezvousId(input.code);
  if (!rid) return { ok: false, reason: 'bad_code' };

  const record = await resolveRendezvous({
    url: input.url,
    rid: bytesToHex(rid),
    webSocketImpl: input.webSocketImpl,
    timeoutMs: input.timeoutMs,
    entitlementToken: input.entitlementToken,
  });
  if (record == null) return { ok: false, reason: 'not_found' };

  let json: string | null = null;
  if (extended) {
    // Sealed path ONLY: an extended code carries a secret half, so its record
    // MUST be sealed. Do NOT fall back to a plaintext record here -- that would
    // let a hostile relay serve an un-sealed base64 record for a code the user
    // believes is sealed (a silent downgrade). Fail closed instead.
    json = decryptString(record, deriveRendezvousSealKey(extended.secretHalf));
  } else if (allowLegacy) {
    // A bare (non-extended) code shared before D.5 addresses a legacy un-sealed
    // record. This is the ONLY sanctioned plaintext path, gated by the flag so a
    // future release can require sealed records everywhere.
    json = tryDecodeLegacyRecord(record);
  }
  if (json == null) return { ok: false, reason: 'invalid_bundle' };

  let signed: SignedIdentityBundle;
  try {
    signed = JSON.parse(json) as SignedIdentityBundle;
  } catch {
    return { ok: false, reason: 'invalid_bundle' };
  }
  if (!verifySignedIdentityBundle(signed)) return { ok: false, reason: 'invalid_bundle' };
  return { ok: true, bundle: signed };
}

/** Decode a legacy `base64(JSON)` rendezvous record, or null if it is not one. */
function tryDecodeLegacyRecord(record: string): string | null {
  try {
    return encodeUTF8(decodeBase64(record));
  } catch {
    return null;
  }
}
