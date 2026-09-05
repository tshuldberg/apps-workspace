/**
 * Introducer model (plan 14, MK-018; the Syncthing introduction pattern).
 *
 * Pairing is normally pairwise: every two devices must meet (paste a payload,
 * scan a code). In a workspace that does not scale -- a five-person group would
 * need ten in-person pairings. The introducer model collapses it: a member the
 * group already trusts (the admin) vouches for the others. The admin signs an
 * introduction record carrying a member's signed identity bundle; a recipient
 * who trusts the admin pins that member and pairs with them WITHOUT ever
 * contacting them directly.
 *
 * The pairing still produces a real shared secret: X25519 is commutative, so a
 * recipient computing DH(self_priv, subject_dhPub) lands on the same secret the
 * subject computes as DH(subject_priv, recipient_dhPub). Both end mutually
 * paired from the admin's two introductions, with no direct round-trip.
 *
 * Trust chain: the admin's signature proves the admin issued the introduction;
 * the bundle's own self-signature (MK-015) proves it describes the member's real
 * key; first-use pinning still applies, so a later key change is surfaced, not
 * silently trusted. A recipient only acts on an introduction from a device it
 * has already paired with (the introducer must itself be trusted).
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { DeviceIdentity } from '../types';
import {
  extractSigningPrivateKeyHex,
  signMessage,
  verifySignature,
} from '../identity/device-identity';
import { bytesToHex, hexToBytes } from '../encryption/keys';
import { completePairing } from '../identity/pairing';
import {
  verifySignedIdentityBundle,
  evaluateBundleTrust,
  type SignedIdentityBundle,
} from './identity-bundle';
import {
  getPairedDevice,
  insertPairedDevice,
  getPinnedIdentity,
  getWorkspaceMembers,
  pinIdentity,
  storeIntroductionRecord,
} from '../db/queries';

const encoder = new TextEncoder();

/** An admin's attestation that a member's signed bundle belongs in a workspace. */
export interface IntroductionRecord {
  version: 1;
  workspaceId: string;
  /** The introducer's (admin's) Ed25519 device id. */
  introducerDeviceId: string;
  /** The member being introduced, with their own self-signed bundle. */
  subject: SignedIdentityBundle;
  introducedAt: string;
}

export interface SignedIntroduction {
  record: IntroductionRecord;
  /** Ed25519 signature (hex) over the canonical record, by introducerDeviceId. */
  signature: string;
}

/** Canonical bytes the introducer signs. Binds to the subject's signature. */
function canonicalIntroduction(record: IntroductionRecord): Uint8Array {
  return encoder.encode(
    JSON.stringify([
      'meerkat-introduction',
      record.version,
      record.workspaceId,
      record.introducerDeviceId,
      record.subject.signature,
      record.introducedAt,
    ]),
  );
}

/** Build a signed introduction for `subject`, vouched for by `introducer`. */
export function createIntroduction(
  introducer: DeviceIdentity,
  subject: SignedIdentityBundle,
  workspaceId: string,
  introducedAt: string = new Date().toISOString(),
): SignedIntroduction {
  const record: IntroductionRecord = {
    version: 1,
    workspaceId,
    introducerDeviceId: introducer.publicKey,
    subject,
    introducedAt,
  };
  const privateKeyHex = extractSigningPrivateKeyHex(introducer.privateKeyRef);
  const signature = bytesToHex(signMessage(privateKeyHex, canonicalIntroduction(record)));
  return { record, signature };
}

/**
 * Verify an introduction: the subject bundle is self-valid AND the introducer
 * actually signed it. Optionally require a specific introducer device id.
 */
export function verifySignedIntroduction(
  signed: SignedIntroduction,
  expectedIntroducerDeviceId?: string,
): boolean {
  if (!signed?.record || typeof signed.signature !== 'string') return false;
  const { record } = signed;
  if (
    record.version !== 1
    || typeof record.workspaceId !== 'string'
    || typeof record.introducerDeviceId !== 'string'
    || typeof record.introducedAt !== 'string'
    || !record.subject
  ) {
    return false;
  }
  if (expectedIntroducerDeviceId && record.introducerDeviceId !== expectedIntroducerDeviceId) {
    return false;
  }
  if (!verifySignedIdentityBundle(record.subject)) return false;
  try {
    return verifySignature(
      record.introducerDeviceId,
      canonicalIntroduction(record),
      hexToBytes(signed.signature),
    );
  } catch {
    return false;
  }
}

export type ApplyIntroductionResult =
  | { ok: true; paired: boolean; subjectDeviceId: string }
  | { ok: false; reason: 'invalid' | 'untrusted_introducer' | 'introducer_not_admin' | 'self' | 'key_changed' };

/**
 * Act on an introduction: verify it, confirm the introducer is a trusted
 * workspace ADMIN, pin the subject on first sight, and pair with them. Pairing
 * does NOT mark the subject emoji-verified, so the SAS gate (MK-017) still
 * holds sensitive-module data back until the recipient confirms the 5 emoji.
 * Idempotent -- applying again for an already-paired subject is a no-op success.
 */
export function applyIntroduction(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  signed: SignedIntroduction,
): ApplyIntroductionResult {
  if (!verifySignedIntroduction(signed)) return { ok: false, reason: 'invalid' };

  // The recipient only trusts an introduction from a device it has paired with.
  if (!getPairedDevice(db, signed.record.introducerDeviceId)) {
    return { ok: false, reason: 'untrusted_introducer' };
  }

  // Authority gate (audit P1): only a current owner/admin of the named
  // workspace may vouch. A plain member (or a removed one) cannot introduce
  // arbitrary identities into the group.
  const members = getWorkspaceMembers(db, signed.record.workspaceId);
  const introducer = members.find(
    (m) => m.deviceId === signed.record.introducerDeviceId && m.removedAt === null,
  );
  if (!introducer || (introducer.role !== 'owner' && introducer.role !== 'admin')) {
    return { ok: false, reason: 'introducer_not_admin' };
  }

  const subject = signed.record.subject;
  const subjectId = subject.bundle.deviceId;
  if (subjectId === identity.publicKey) return { ok: false, reason: 'self' };

  // TOFU: a known subject presenting a new DH key is a key change, not silent trust.
  const pinnedRow = getPinnedIdentity(db, subjectId);
  const trust = evaluateBundleTrust(
    subject,
    pinnedRow ? { deviceId: pinnedRow.deviceId, dhPublicKey: pinnedRow.dhPublicKey } : null,
  );
  if (trust === 'invalid_signature') return { ok: false, reason: 'invalid' };
  if (trust === 'key_changed') return { ok: false, reason: 'key_changed' };

  // Keep the signed introduction forwardable either way (MK-018 gossip).
  storeIntroductionRecord(db, signed.record.workspaceId, subjectId, JSON.stringify(signed));

  if (getPairedDevice(db, subjectId)) {
    return { ok: true, paired: false, subjectDeviceId: subjectId };
  }

  if (trust === 'first_seen') {
    pinIdentity(db, {
      deviceId: subjectId,
      dhPublicKey: subject.bundle.dhPublicKey,
      displayName: subject.bundle.displayName,
      bundleJson: JSON.stringify(subject.bundle),
      bundleSignature: subject.signature,
    });
  }

  const device = completePairing(identity, {
    publicKey: subjectId,
    dhPublicKey: subject.bundle.dhPublicKey,
    displayName: subject.bundle.displayName,
    pairingNonce: '',
  });
  insertPairedDevice(db, device);
  return { ok: true, paired: true, subjectDeviceId: subjectId };
}
