/**
 * Plan 51 P2 test harness: mint REAL anonymous credentials end-to-end and build a
 * verifier over an inspectable in-memory epoch-key + revocation store. No fakes on
 * the crypto path -- generateEpochKeyPair + blindSignCredential (issuer, node) and
 * prepareBlindCredentialRequest + finalizeBlindCredential (client, sync) produce a
 * credential that verifyBlindCredential accepts, exactly as production does.
 */

import { randomBytes } from 'node:crypto';
import {
  credentialEpochWindow,
  credentialSerial,
  finalizeBlindCredential,
  prepareBlindCredentialRequest,
  serializeMeerkatCredential,
  type MeerkatCredential,
} from '@mylife/sync';
import {
  blindSignCredential,
  generateEpochKeyPair,
  type EpochKeyPair,
} from '../../blind-credential-server';
import { createCredentialVerifier, type CredentialVerifier } from '../../credential-verify';

/** The genesis epoch boundary + a fixed "now" solidly inside epoch 0. */
export const EPOCH_0 = 0;
export const NOW_MS_IN_EPOCH_0 = credentialEpochWindow(EPOCH_0).notBeforeMs + 60_000;

/** An inspectable epoch-key + revocation store the verifier reads. */
export class CredentialTestAuthority {
  private readonly keys = new Map<number, EpochKeyPair>();
  private readonly revoked = new Map<string, { epoch: number; reason: string }>();

  /** Publish (or reuse) the epoch keypair and return its public SPKI DER base64. */
  publishEpoch(epoch: number): string {
    if (!this.keys.has(epoch)) this.keys.set(epoch, generateEpochKeyPair(epoch));
    return this.keys.get(epoch)!.publicKeySpkiDerBase64;
  }

  epochPublicKey(epoch: number): string | null {
    return this.keys.get(epoch)?.publicKeySpkiDerBase64 ?? null;
  }

  isRevoked(serial: string): boolean {
    return this.revoked.has(serial);
  }

  revoke(serial: string, epoch: number, reason: string): void {
    if (!this.revoked.has(serial)) this.revoked.set(serial, { epoch, reason });
  }

  /** A verifier over this authority's published keys + revocation set. */
  verifier(nowMs: number = NOW_MS_IN_EPOCH_0): CredentialVerifier {
    return createCredentialVerifier({
      getEpochPublicKey: (epoch) => this.epochPublicKey(epoch),
      isSerialRevoked: (serial) => this.isRevoked(serial),
      now: () => nowMs,
    });
  }

  /**
   * Mint a real credential for an epoch. Returns the credential, its bearer string
   * (the `x-mk-credential` header value), and its serial. The issuer never sees the
   * token: it signs only the blinded bytes.
   */
  mint(epoch: number = EPOCH_0): { credential: MeerkatCredential; bearer: string; serial: string } {
    const publicKey = this.publishEpoch(epoch);
    const prepared = prepareBlindCredentialRequest(epoch, publicKey, (n) => new Uint8Array(randomBytes(n)));
    if (!prepared) throw new Error('prepareBlindCredentialRequest failed');
    const privateKey = this.keys.get(epoch)!.privateKeyPkcs8DerBase64;
    const blindSignature = blindSignCredential(privateKey, prepared.blindedMessageBase64);
    const credential = finalizeBlindCredential(prepared.state, publicKey, blindSignature);
    if (!credential) throw new Error('finalizeBlindCredential failed');
    const serial = credentialSerial(credential.messageBase64);
    if (!serial) throw new Error('credentialSerial failed');
    return { credential, bearer: serializeMeerkatCredential(credential), serial };
  }
}

