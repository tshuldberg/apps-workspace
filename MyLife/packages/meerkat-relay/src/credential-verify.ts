/**
 * Plan 51 P2: anonymous-credential presentation verifier for public-layer surfaces
 * (community node publish, archive intake, persona registration).
 *
 * Verification is local: the epoch PUBLIC key plus a serial revocation check.
 * No account-layer secret and no account-service call sits on this path, so a
 * presentation can never become a timing beacon back to the issuer.
 *
 * Fail-closed discipline (mirrors persona-session.ts / humanity gate):
 *  - No key source configured        -> 'not_configured' (never a fabricated pass).
 *  - Unknown epoch / malformed token -> 'invalid'.
 *  - Authentic but out of window     -> 'expired'.
 *  - Serial on the revocation list   -> 'revoked'.
 *
 * Log hygiene: results expose the serial ONLY for the surface's moderation
 * evidence path (serial may co-locate with persona identifiers there). A serial
 * must NEVER be logged or stored next to an account identifier -- the canary
 * asserts that on the account-service side. Precise claim: the account service
 * never sees a serial during blind ISSUANCE (it signs a value it cannot read).
 * A client-initiated deletion or renewal that submits its OWN credential does
 * reveal that serial to the service (for revocation / one-epoch-forward renewal),
 * so the unlinkability is "one epoch forward", not unconditional; the canary
 * still guarantees the serial is never persisted or logged beside an account id.
 */

import {
  credentialSerial,
  parseMeerkatCredential,
  verifyBlindCredential,
} from '@mylife/sync';

export type CredentialPresentationReason =
  | 'not_configured'
  | 'missing'
  | 'invalid'
  | 'expired'
  | 'revoked';

export type CredentialPresentationResult =
  | { ok: true; epoch: number; serial: string }
  | { ok: false; reason: CredentialPresentationReason };

export interface CredentialVerifierOptions {
  /** Epoch -> base64 SPKI DER public key, or null when unknown. Sync or async. */
  getEpochPublicKey: (epoch: number) => Promise<string | null> | string | null;
  /** Serial revocation membership (credential.revocations). Sync or async. */
  isSerialRevoked: (serial: string) => Promise<boolean> | boolean;
  /** Injected clock for tests. */
  now?: () => number;
}

export interface CredentialVerifier {
  verifyPresentation(bearer: string | null | undefined): Promise<CredentialPresentationResult>;
}

/**
 * Build the shared presentation verifier. Surfaces mount it when (and only when)
 * an epoch key source is wired; an absent verifier means the surface keeps its
 * existing proof path and never silently accepts credentials.
 */
export function createCredentialVerifier(options: CredentialVerifierOptions): CredentialVerifier {
  const now = options.now ?? (() => Date.now());
  return {
    async verifyPresentation(bearer) {
      if (typeof bearer !== 'string' || bearer.trim().length === 0) {
        return { ok: false, reason: 'missing' };
      }
      const credential = parseMeerkatCredential(bearer);
      if (!credential) return { ok: false, reason: 'invalid' };
      let publicKey: string | null;
      try {
        publicKey = await options.getEpochPublicKey(credential.epoch);
      } catch {
        return { ok: false, reason: 'not_configured' };
      }
      if (!publicKey) return { ok: false, reason: 'not_configured' };
      const verdict = verifyBlindCredential(credential, publicKey, now());
      if (verdict === 'expired') return { ok: false, reason: 'expired' };
      if (verdict !== 'ok') return { ok: false, reason: 'invalid' };
      const serial = credentialSerial(credential.messageBase64);
      if (!serial) return { ok: false, reason: 'invalid' };
      let revoked: boolean;
      try {
        revoked = await options.isSerialRevoked(serial);
      } catch {
        // A dead revocation source fails closed: an unverifiable serial is refused.
        return { ok: false, reason: 'revoked' };
      }
      if (revoked) return { ok: false, reason: 'revoked' };
      return { ok: true, epoch: credential.epoch, serial };
    },
  };
}
