// Signed-author glue for the web theme share/import flow. Mirrors the mobile
// apps/meerkat/app/(root)/theme/theme-author.ts: the crypto-free
// @mylife/meerkat-theme package carries the author envelope + canonical-bytes
// contract; this supplies the Ed25519 signing/verification via the device's
// existing identity key (@mylife/sync). No crypto is reimplemented. The
// signature attests WHO authored a theme; it is never a trust boundary.

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

export function authorLabel(
  profile: MkThemeProfile,
  author: MkThemeAuthor | undefined,
): string {
  if (!author) return 'Unsigned theme';
  return verifyThemeAuthorSignature(profile, author)
    ? `Signed by ${author.name} (verified)`
    : `Signed by ${author.name} (unverified)`;
}
