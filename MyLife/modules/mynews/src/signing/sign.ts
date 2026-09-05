import { bytesToHex, hexToBytes, signMessage, verifySignature } from '@mylife/sync';
import {
  canonicalArticleMetaBytes,
  canonicalKeyCustodyBytes,
  canonicalKeyPossessionBytes,
  canonicalRejectBytes,
  canonicalRevisionBytes,
  canonicalSuggestionBytes,
  type SignableArticleMeta,
  type SignableKeyCustody,
  type SignableKeyPossession,
  type SignableReject,
  type SignableRevision,
  type SignableSuggestion,
} from './canonical';

export function signRevision(rev: SignableRevision, privateKeyHex: string): string {
  return bytesToHex(signMessage(privateKeyHex, canonicalRevisionBytes(rev)));
}

export function verifyRevisionSignature(rev: SignableRevision, signatureHex: string): boolean {
  try {
    return verifySignature(rev.signerPubkey, canonicalRevisionBytes(rev), hexToBytes(signatureHex));
  } catch {
    return false;
  }
}

export function signSuggestion(s: SignableSuggestion, privateKeyHex: string): string {
  return bytesToHex(signMessage(privateKeyHex, canonicalSuggestionBytes(s)));
}

export function verifySuggestionSignature(s: SignableSuggestion, signatureHex: string): boolean {
  try {
    return verifySignature(s.editorPubkey, canonicalSuggestionBytes(s), hexToBytes(signatureHex));
  } catch {
    return false;
  }
}

export function signReject(r: SignableReject, privateKeyHex: string): string {
  return bytesToHex(signMessage(privateKeyHex, canonicalRejectBytes(r)));
}

export function verifyRejectSignature(r: SignableReject, signatureHex: string): boolean {
  try {
    return verifySignature(r.signerPubkey, canonicalRejectBytes(r), hexToBytes(signatureHex));
  } catch {
    return false;
  }
}

export function signKeyPossession(k: SignableKeyPossession, privateKeyHex: string): string {
  return bytesToHex(signMessage(privateKeyHex, canonicalKeyPossessionBytes(k)));
}

export function verifyKeyPossessionSignature(
  k: SignableKeyPossession,
  signatureHex: string,
): boolean {
  try {
    return verifySignature(k.pubkey, canonicalKeyPossessionBytes(k), hexToBytes(signatureHex));
  } catch {
    return false;
  }
}

/** Sign a custody transition proof (rotation, device approval, revoke, escrow). */
export function signKeyCustody(k: SignableKeyCustody, privateKeyHex: string): string {
  return bytesToHex(signMessage(privateKeyHex, canonicalKeyCustodyBytes(k)));
}

/**
 * Verify a custody proof against the key that must have produced it. The caller
 * chooses which pubkey to check: the OLD head for an authorization purpose, the
 * NEW key for a possession purpose.
 */
export function verifyKeyCustodySignature(
  k: SignableKeyCustody,
  signerPubkey: string,
  signatureHex: string,
): boolean {
  try {
    return verifySignature(signerPubkey, canonicalKeyCustodyBytes(k), hexToBytes(signatureHex));
  } catch {
    return false;
  }
}

export function signArticleMeta(m: SignableArticleMeta, privateKeyHex: string): string {
  return bytesToHex(signMessage(privateKeyHex, canonicalArticleMetaBytes(m)));
}

export function verifyArticleMetaSignature(m: SignableArticleMeta, signatureHex: string): boolean {
  try {
    return verifySignature(m.signerPubkey, canonicalArticleMetaBytes(m), hexToBytes(signatureHex));
  } catch {
    return false;
  }
}
