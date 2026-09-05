/**
 * Plan 52 P1: the person-group attestation exchange over the existing
 * pair-private mailbox (sealMailboxDelta / deriveMailboxToken).
 *
 * Mutual attestation needs every listed device's signature over the SAME
 * canonical revision bytes. The coordinator device builds the unsigned
 * revision, signs it, and parks a PROPOSE for every OTHER listed device on
 * their pairwise mailbox. Each recipient app-verifies the proposal (the
 * sender must be one of ITS own-device-linked peers and the recipient must be
 * listed), signs the SAME canonical bytes, and parks an ACCEPT back. When the
 * coordinator holds every signature it assembles the doc, stores it, and the
 * pi_person_group row replicates (with the group secret) over the normal
 * own-device personal_replica session.
 *
 * Nothing here trusts the transport: the accept signature is verified against
 * the SENDER's device key over the exact proposed bytes, so a relayed or
 * spoofed accept for different content never assembles into a valid doc (the
 * doc would fail verifyPersonGroupDoc anyway -- this check just fails fast and
 * keeps pending state clean).
 */

import {
  PERSON_GROUP_MAX_DEVICES,
  canonicalPersonGroupBytes,
  dmPeerDerivationContext,
  personGroupDocHash,
  verifyAnnounceDraftAgainstDoc,
  verifyPersonGroupAnnounce,
  verifyPersonSignatureBytes,
  type PersonGroupAnnounce,
  type UnsignedPersonGroupAnnounce,
  type UnsignedPersonGroupDoc,
} from './person-group';
/**
 * DoS caps applied INSIDE the parsers, before any canonicalization or
 * signature work: an unvalidated 10,000-device doc or a 5,000-draft proposal
 * would otherwise cost the recipient a JSON.stringify over attacker-sized
 * input and one Ed25519 signature per draft.
 */
const MAX_ANNOUNCE_DRAFTS_PER_PROPOSAL = 64;

export const PERSON_GROUP_PROPOSE_MAILBOX_KIND = 'person-group-propose';
export const PERSON_GROUP_ACCEPT_MAILBOX_KIND = 'person-group-accept';
export const PERSON_GROUP_ANNOUNCE_MAILBOX_KIND = 'person-group-announce';

export interface PersonGroupProposePayload {
  kind: typeof PERSON_GROUP_PROPOSE_MAILBOX_KIND;
  version: 1;
  /** The unsigned revision every device must sign verbatim. */
  doc: UnsignedPersonGroupDoc;
  /** Signatures already collected (at least the proposer's own). */
  signatures: Record<string, string>;
  /**
   * Announce drafts (per community / DM-peer context) the proposer wants
   * co-signed in the same round. A recipient that does not yet hold the group
   * secret cannot re-derive the ids, but the proposer IS the user's own
   * SAS-verified linked device; the recipient still checks each draft's
   * devices and revision against the doc it is signing.
   */
  announces?: UnsignedPersonGroupAnnounce[];
}

export interface PersonGroupAcceptPayload {
  kind: typeof PERSON_GROUP_ACCEPT_MAILBOX_KIND;
  version: 1;
  /**
   * The canonical-bytes hash of the proposal being accepted. Checked at
   * dispatch against `doc`, so an accept can never be paired with a doc other
   * than the exact bytes its signature was made over.
   */
  proposalHash: string;
  /** The exact unsigned revision being accepted (binds the signature). */
  doc: UnsignedPersonGroupDoc;
  /** The accepting device's signature over canonicalPersonGroupBytes(doc). */
  signature: string;
  /**
   * Co-signatures for the announce contexts the proposal carried:
   * context -> the accepting device's signature over the canonical announce
   * bytes (as proposed). Empty when the proposal carried no announces.
   */
  announceSignatures?: Record<string, string>;
}

/**
 * Plan 52 P2: the DM-peer half of person distribution. The sender parks its
 * fully assembled announce (context dm-peer|<recipientDeviceId>) on the
 * recipient's pairwise mailbox; the dispatch layer verifies the announce AND
 * that its context is derived FOR the recipient before the handler runs.
 */
export interface PersonGroupAnnouncePayload {
  kind: typeof PERSON_GROUP_ANNOUNCE_MAILBOX_KIND;
  version: 1;
  announce: PersonGroupAnnounce;
}

function isUnsignedDoc(value: unknown): value is UnsignedPersonGroupDoc {
  if (typeof value !== 'object' || value === null) return false;
  const doc = value as UnsignedPersonGroupDoc;
  return doc.version === 1
    && typeof doc.groupId === 'string'
    && typeof doc.secretCommitment === 'string'
    && Number.isInteger(doc.revision)
    && Array.isArray(doc.devices)
    // Cap BEFORE any canonicalization/signature work (DoS).
    && doc.devices.length > 0
    && doc.devices.length <= PERSON_GROUP_MAX_DEVICES
    && doc.devices.every((d) => (
      typeof d === 'object' && d !== null
      && typeof (d as { deviceId?: unknown }).deviceId === 'string'
      && typeof (d as { label?: unknown }).label === 'string'
      && typeof (d as { addedAt?: unknown }).addedAt === 'string'
    ))
    && typeof doc.updatedAt === 'string';
}

/** The proposal identity an accept must bind to (canonical-bytes hash). */
export function personGroupProposalHash(doc: UnsignedPersonGroupDoc): string {
  return personGroupDocHash({ ...doc, signatures: {} });
}

export function parsePersonGroupProposePayload(payload: unknown): PersonGroupProposePayload | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const p = payload as PersonGroupProposePayload;
  if (p.kind !== PERSON_GROUP_PROPOSE_MAILBOX_KIND || p.version !== 1) return null;
  if (!isUnsignedDoc(p.doc)) return null;
  if (typeof p.signatures !== 'object' || p.signatures === null) return null;
  for (const [key, value] of Object.entries(p.signatures)) {
    if (typeof key !== 'string' || typeof value !== 'string') return null;
  }
  if (p.announces !== undefined) {
    if (!Array.isArray(p.announces)) return null;
    if (p.announces.length > MAX_ANNOUNCE_DRAFTS_PER_PROPOSAL) return null;
    if (!p.announces.every((a) => isUnsignedAnnounceDraft(a))) return null;
    // Every draft must bind to the doc being proposed (HIGH-3): same revision,
    // same device set, a recognized context. A draft that does not is a
    // request to co-sign someone else's presentation.
    if (!p.announces.every((a) => verifyAnnounceDraftAgainstDoc(a, p.doc).ok)) return null;
  }
  return p;
}

export function parsePersonGroupAcceptPayload(payload: unknown): PersonGroupAcceptPayload | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const p = payload as PersonGroupAcceptPayload;
  if (p.kind !== PERSON_GROUP_ACCEPT_MAILBOX_KIND || p.version !== 1) return null;
  if (!isUnsignedDoc(p.doc)) return null;
  if (typeof p.proposalHash !== 'string' || p.proposalHash.length === 0) return null;
  if (typeof p.signature !== 'string' || p.signature.length === 0) return null;
  if (p.announceSignatures !== undefined) {
    if (typeof p.announceSignatures !== 'object' || p.announceSignatures === null) return null;
    for (const [key, value] of Object.entries(p.announceSignatures)) {
      if (typeof key !== 'string' || typeof value !== 'string') return null;
    }
  }
  return p;
}

export function parsePersonGroupAnnouncePayload(payload: unknown): PersonGroupAnnouncePayload | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const p = payload as PersonGroupAnnouncePayload;
  if (p.kind !== PERSON_GROUP_ANNOUNCE_MAILBOX_KIND || p.version !== 1) return null;
  if (typeof p.announce !== 'object' || p.announce === null) return null;
  return p;
}

/**
 * Full dispatch-layer verification of a DM-peer announce: the announce itself
 * verifies (every listed device signed), the SENDER is one of its listed
 * devices (a stranger cannot deliver someone else's proof), and the context is
 * derived FOR the recipient, so a proof minted for another peer -- or for a
 * community -- can never land on this mailbox.
 */
export function verifyPersonGroupAnnouncePayload(
  senderDeviceId: string,
  recipientDeviceId: string,
  payload: PersonGroupAnnouncePayload,
): boolean {
  if (!verifyPersonGroupAnnounce(payload.announce)) return false;
  if (!payload.announce.devices.includes(senderDeviceId)) return false;
  return payload.announce.context === dmPeerDerivationContext(recipientDeviceId);
}

/** Guard for the announce drafts a PROPOSE may carry (co-signing contexts). */
/** Shape-only guard; binding to the doc is verifyAnnounceDraftAgainstDoc. */
export function isUnsignedAnnounceDraft(value: unknown): value is UnsignedPersonGroupAnnounce {
  if (typeof value !== 'object' || value === null) return false;
  const a = value as UnsignedPersonGroupAnnounce;
  return a.version === 1
    && typeof a.context === 'string'
    && typeof a.derivedGroupId === 'string'
    && Number.isInteger(a.revision)
    && Array.isArray(a.devices)
    && a.devices.length > 0
    && a.devices.length <= PERSON_GROUP_MAX_DEVICES
    && a.devices.every((d) => typeof d === 'string')
    && typeof a.updatedAt === 'string';
}

/**
 * Verify an accept binds the SENDER to the exact proposed doc: the carried
 * proposalHash must match the doc's canonical-bytes hash (so the pair cannot
 * be spliced), and the signature must verify over those same bytes.
 */
export function verifyPersonGroupAccept(
  senderDeviceId: string,
  payload: PersonGroupAcceptPayload,
): boolean {
  if (payload.proposalHash !== personGroupProposalHash(payload.doc)) return false;
  if (!payload.doc.devices.some((d) => d.deviceId === senderDeviceId)) return false;
  return verifyPersonSignatureBytes(
    senderDeviceId,
    canonicalPersonGroupBytes(payload.doc),
    payload.signature,
  );
}

/**
 * MEDIUM-6: the propose-side dispatch gate, symmetric with accept/announce.
 * The proposer must be listed, must have signed the doc it proposes, and the
 * RECIPIENT must be listed -- checked before any app handler runs, so an
 * unsigned or non-membership proposal never reaches signing logic.
 */
export function verifyPersonGroupProposePayload(
  senderDeviceId: string,
  recipientDeviceId: string,
  payload: PersonGroupProposePayload,
): boolean {
  const ids = payload.doc.devices.map((d) => d.deviceId);
  if (!ids.includes(senderDeviceId) || !ids.includes(recipientDeviceId)) return false;
  const proposerSig = payload.signatures[senderDeviceId];
  if (typeof proposerSig !== 'string' || proposerSig.length === 0) return false;
  const canonical = canonicalPersonGroupBytes(payload.doc);
  if (!verifyPersonSignatureBytes(senderDeviceId, canonical, proposerSig)) return false;
  // Any OTHER carried signature must also verify (a bogus one would be
  // recorded as a co-signature by a naive coordinator).
  for (const [deviceId, signature] of Object.entries(payload.signatures)) {
    if (!ids.includes(deviceId)) return false;
    if (!verifyPersonSignatureBytes(deviceId, canonical, signature)) return false;
  }
  return true;
}
