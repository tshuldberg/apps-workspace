/**
 * Plan 51 P1: the anonymous credential BRIDGE store contract (the credential.* model).
 *
 * THE OTHER SIDE OF THE WALL. This store holds ONLY published epoch public keys and
 * the serial-keyed revocation list. It NEVER carries an account identifier, persona
 * key, or device identifier (AC-2). It is the single surface both the account service
 * (which publishes epoch public keys)
 * and the public verifier surfaces (which read epoch keys + revocations) touch, and it
 * is anonymous on both sides: an account id can never be joined to a serial here.
 *
 * getEpochPublicKey/isSerialRevoked exactly match the seams createCredentialVerifier
 * consumes (credential-verify.ts), so a verifier surface mounts this store directly.
 */

export type RevokeSerialOutcome = 'revoked' | 'already_revoked';

export interface CredentialBridgeStore {
  /** Publish an epoch's public key + validity window (idempotent on epoch). */
  publishEpochKey(
    epoch: number,
    publicKeySpkiDerBase64: string,
    notBeforeMs: number,
    notAfterMs: number,
  ): void | Promise<void>;
  /** The verifier seam: epoch -> base64 SPKI DER public key, or null when unknown. */
  getEpochPublicKey(epoch: number): (string | null) | Promise<string | null>;
  /** Revoke a credential serial (idempotent). Serial is 64 lowercase hex. */
  revokeSerial(serial: string, epoch: number, reasonCode: string): RevokeSerialOutcome | Promise<RevokeSerialOutcome>;
  /** The verifier seam: serial revocation membership. */
  isSerialRevoked(serial: string): boolean | Promise<boolean>;
  stats(): CredentialBridgeStoreStats | Promise<CredentialBridgeStoreStats>;
}

export interface CredentialBridgeStoreStats {
  epochKeys: number;
  revocations: number;
}

const SERIAL_RE = /^[0-9a-f]{64}$/;

/** True iff `serial` is the canonical 64-lowercase-hex form. */
export function isCredentialSerial(serial: string): boolean {
  return typeof serial === 'string' && SERIAL_RE.test(serial);
}

interface StoredEpochKey {
  publicKeySpkiDerBase64: string;
  notBeforeMs: number;
  notAfterMs: number;
}

// ---------------------------------------------------------------------------
// In-memory bridge store (tests + ephemeral). Anonymous on both sides.
// ---------------------------------------------------------------------------

export class InMemoryCredentialBridgeStore implements CredentialBridgeStore {
  private readonly epochKeys = new Map<number, StoredEpochKey>();
  private readonly revocations = new Set<string>();

  publishEpochKey(
    epoch: number,
    publicKeySpkiDerBase64: string,
    notBeforeMs: number,
    notAfterMs: number,
  ): void {
    // Idempotent: an epoch key is published once and never mutated. A second
    // publish for a known epoch is a no-op (the account service re-derives the
    // same key deterministically only from its sealed private half, never here).
    if (this.epochKeys.has(epoch)) return;
    this.epochKeys.set(epoch, { publicKeySpkiDerBase64, notBeforeMs, notAfterMs });
  }

  getEpochPublicKey(epoch: number): string | null {
    return this.epochKeys.get(epoch)?.publicKeySpkiDerBase64 ?? null;
  }

  revokeSerial(serial: string, _epoch: number, _reasonCode: string): RevokeSerialOutcome {
    if (!isCredentialSerial(serial)) throw new Error('Serial must be 64 lowercase hex');
    if (this.revocations.has(serial)) return 'already_revoked';
    this.revocations.add(serial);
    return 'revoked';
  }

  isSerialRevoked(serial: string): boolean {
    return this.revocations.has(serial);
  }

  stats(): CredentialBridgeStoreStats {
    return { epochKeys: this.epochKeys.size, revocations: this.revocations.size };
  }
}
