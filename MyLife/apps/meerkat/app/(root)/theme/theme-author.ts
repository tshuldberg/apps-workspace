// Signed-author glue for the theme share/import flow. The crypto-free
// @mylife/meerkat-theme package carries the author ENVELOPE and the
// canonical-bytes contract; this thin app-layer module supplies the actual
// Ed25519 signing/verification using the device's existing identity key via
// @mylife/sync. We reimplement no crypto. The signature attests WHO authored a
// theme; it is never a trust boundary (a validated theme is safe regardless).

import {
  bytesToHex,
  getDeviceIdentitySecrets,
  hexToBytes,
  signMessage,
  verifySignature,
  type DeviceIdentity,
} from '@mylife/sync';
import {
  canonicalThemeBytes,
  verifyThemeAuthor,
  type MkThemeAuthor,
  type MkThemeProfile,
} from '@mylife/meerkat-theme';

/**
 * Sign a theme with the device identity, producing a portable author
 * attribution. Returns null when the private key is unavailable or the name is
 * empty (the export then ships unsigned, never a fake signature).
 */
export function signThemeAuthor(
  profile: MkThemeProfile,
  identity: DeviceIdentity,
  name: string,
): MkThemeAuthor | null {
  const safeName = name.trim().slice(0, 60);
  if (!safeName) return null;
  try {
    const secrets = getDeviceIdentitySecrets(identity.privateKeyRef);
    if (!secrets) return null;
    const signature = signMessage(secrets.ed25519PrivateKeyHex, canonicalThemeBytes(profile));
    return { name: safeName, publicKey: identity.publicKey, signature: bytesToHex(signature) };
  } catch {
    return null;
  }
}

/** Verify a decoded theme's author signature against the canonical theme bytes. */
export function verifyThemeAuthorSignature(
  profile: MkThemeProfile,
  author: MkThemeAuthor,
): boolean {
  return verifyThemeAuthor(profile, author, (publicKey, message, signatureHex) => {
    try {
      return verifySignature(publicKey, message, hexToBytes(signatureHex));
    } catch {
      return false;
    }
  });
}

/** The honest attribution label for a decoded theme. */
export function authorLabel(
  profile: MkThemeProfile,
  author: MkThemeAuthor | undefined,
): string {
  if (!author) return 'Unsigned theme';
  return verifyThemeAuthorSignature(profile, author)
    ? `Signed by ${author.name} (verified)`
    : `Signed by ${author.name} (unverified)`;
}
