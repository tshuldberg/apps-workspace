/**
 * Person groups (Plan 52 P0): a set of device identities mutually attested as
 * ONE person, with a per-context derived identifier so communities cannot
 * correlate a person's pseudonyms.
 *
 * Security architecture (binding, plan 52):
 *  - Mutual attestation, no unilateral claims: the group document lists member
 *    devices and carries a signature from EVERY listed device over the same
 *    canonical revision bytes. A document missing any member's signature does
 *    not verify, so a device cannot be claimed into a group without signing its
 *    own membership, and cannot claim another's.
 *  - Monotonic revisions: a stale document can never resurrect a removed
 *    device. Acceptance is a deterministic total order (revision, updatedAt,
 *    canonical hash); replaying an older revision is rejected.
 *  - Per-context derived ids: the identifier shown to a community (or a DM
 *    peer) is HMAC-SHA512(groupSecret, context)[0..32]. The stable inner
 *    groupId and the group secret replicate at personal_replica ONLY and never
 *    leave the person's own devices; two contexts cannot equate their derived
 *    ids without the secret (plan 51's unlinkability posture at the community
 *    layer).
 *  - Secret rotation on shrink: any revision that REMOVES a device also
 *    rotates the group secret. An expelled (or lost) device that knew the old
 *    secret can therefore no longer derive the person's future per-context
 *    ids, and communities see a fresh derived id via re-announce.
 *  - Size cap: 8 devices (matches the relay maxPeersPerToken posture).
 *
 * Everything here is PURE protocol: no IO, no platform deps, RN-safe. Storage
 * (pi_person_group / pi_presentation_profile / cm_person_links) and transport
 * (the existing own-device personal_replica session + cm_ announce rows) live
 * in the apps and the engine.
 */

import nacl from 'tweetnacl';
import type { DeviceIdentity } from '../types';
import {
  extractSigningPrivateKeyHex,
  signMessage,
  verifySignature,
} from '../identity/device-identity';
import { bytesToHex, hexToBytes } from '../encryption/keys';
import { hmacSha512, sha512Hex } from '../node/hkdf';
import {
  PROFILE_BIO_MAX_CHARS,
  PROFILE_NAME_COLOR_TOKENS,
  PROFILE_PRONOUNS_MAX_CHARS,
  isValidCommunityAvatarImage,
  normalizeProfileDisplayName,
  type ProfileNameColorToken,
} from './community-profile';

const encoder = new TextEncoder();

/** Hard cap on attested devices per person (relay maxPeersPerToken posture). */
export const PERSON_GROUP_MAX_DEVICES = 8;
/** Group secret length (32 bytes, hex-encoded at rest). */
export const PERSON_GROUP_SECRET_BYTES = 32;
/** Device label cap (display only, never an identity claim). */
export const PERSON_DEVICE_LABEL_MAX_CHARS = 32;
/** Derived per-context id length in hex chars (128 bits of the HMAC). */
export const PERSON_DERIVED_ID_HEX_CHARS = 32;

const GROUP_DOC_TAG = 'meerkat-person-group-v1';
const ANNOUNCE_TAG = 'meerkat-person-group-announce-v1';
const CONTEXT_TAG = 'meerkat-person-context-v1';

export interface PersonGroupDevice {
  /** Ed25519 identity public key hex (the device id everywhere else). */
  deviceId: string;
  /** Human label ("iPhone", "Mac mini"); display sugar, normalized + capped. */
  label: string;
  /** ISO timestamp the device was added at (first revision listing it). */
  addedAt: string;
}

export interface UnsignedPersonGroupDoc {
  version: 1;
  /**
   * Commitment to the group SECRET (`personGroupSecretCommitment`). The secret
   * itself never rides in the doc, but the commitment is inside the canonical
   * signed bytes, so a sibling cannot swap in an attacker-chosen secret while
   * keeping the attestations valid (the secret is the whole basis of
   * unlinkability -- whoever holds it derives every per-context id).
   */
  secretCommitment: string;
  /**
   * The stable INNER group id (random 32 hex). NEVER disclosed beyond the
   * person's own devices; communities only ever see per-context derived ids.
   */
  groupId: string;
  /** Monotonic revision, starting at 1. */
  revision: number;
  /** Sorted by deviceId, unique, 1..PERSON_GROUP_MAX_DEVICES entries. */
  devices: PersonGroupDevice[];
  /**
   * TOMBSTONES: every device ever removed from this person, sorted + unique
   * and disjoint from `devices`. Signature-covered and MONOTONIC -- a later
   * revision may not silently forget a removal.
   *
   * This is what makes expulsion durable. Without it, two devices that both
   * build a revision N+1 against the same stored doc produce divergent
   * successors, and whichever the ordering picks silently resurrects whatever
   * the other one removed. It also stops an already-expelled device from
   * proposing its own way back in: its doc would have to drop itself from the
   * tombstone set, which verification rejects unless the device is being
   * DELIBERATELY re-added (present in `devices`).
   */
  removed: string[];
  /**
   * LINEAGE: the canonical hash of the revision this one is built on, or null
   * for a genesis revision. Signature-covered.
   *
   * Revision numbers alone let a doc claim to be the next state while actually
   * descending from an older ancestor (revision === stored + 1 but built on
   * stored's grandparent), which is enough to slip past a
   * "clear-only-from-a-strict-successor" tombstone rule. Binding each revision
   * to its parent makes succession CAUSAL rather than numeric: a doc is a
   * successor only if it names the exact doc it was built on.
   */
  parentHash: string | null;
  updatedAt: string;
}

export interface PersonGroupDoc extends UnsignedPersonGroupDoc {
  /**
   * deviceId -> hex Ed25519 signature over the canonical revision bytes. The
   * key set MUST equal the listed device id set exactly (no missing, no
   * extras), and every signature must verify -- mutual attestation.
   */
  signatures: Record<string, string>;
}

function normalizeDeviceLabel(label: string): string {
  // Slice by CODE POINT, not UTF-16 unit: a unit slice can cut an emoji in
  // half and persist a lone surrogate that re-normalizes to itself.
  const collapsed = label.trim().replace(/\s+/g, ' ');
  return Array.from(collapsed).slice(0, PERSON_DEVICE_LABEL_MAX_CHARS).join('');
}

function isHex(value: string, length?: number): boolean {
  if (length !== undefined && value.length !== length) return false;
  return value.length > 0 && value.length % 2 === 0 && /^[0-9a-f]+$/.test(value);
}

/** An Ed25519 device id: exactly 64 lowercase hex chars (never a derived id). */
function isDeviceId(value: unknown): value is string {
  return typeof value === 'string' && isHex(value, 64);
}

/**
 * The furthest-future timestamp any document may carry. Without a bound, a
 * crafted `9999-12-31...` value wins every ordering tie forever.
 */
export const PERSON_MAX_FUTURE_SKEW_MS = 24 * 60 * 60 * 1000;

/**
 * A timestamp usable in an ORDERING comparison: strictly the canonical
 * `toISOString()` form (so lexicographic order really is chronological -- a
 * millisecond-free variant sorts above a strictly later value) and not
 * implausibly far in the future.
 */
export function isOrderableTimestamp(value: unknown, now: number = Date.now()): boolean {
  if (typeof value !== 'string') return false;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return false;
  if (new Date(parsed).toISOString() !== value) return false;
  return parsed <= now + PERSON_MAX_FUTURE_SKEW_MS;
}

function sortedUniqueDevices(devices: readonly PersonGroupDevice[]): PersonGroupDevice[] {
  const byId = new Map<string, PersonGroupDevice>();
  for (const device of devices) {
    byId.set(device.deviceId, {
      deviceId: device.deviceId,
      label: normalizeDeviceLabel(device.label),
      addedAt: device.addedAt,
    });
  }
  return Array.from(byId.values()).sort((a, b) => (a.deviceId < b.deviceId ? -1 : 1));
}

/** The canonical bytes every member signs. Devices are sorted; order matters. */
export function canonicalPersonGroupBytes(doc: UnsignedPersonGroupDoc): Uint8Array {
  return encoder.encode(JSON.stringify([
    GROUP_DOC_TAG,
    doc.version,
    doc.groupId,
    doc.revision,
    doc.devices.map((d) => [d.deviceId, d.label, d.addedAt]),
    doc.updatedAt,
    doc.secretCommitment,
    doc.removed,
    doc.parentHash,
  ]));
}

/** The signed commitment to a group secret (hex, 32 chars of SHA-512). */
export function personGroupSecretCommitment(secretHex: string): string {
  if (!isHex(secretHex, PERSON_GROUP_SECRET_BYTES * 2)) {
    throw new Error('Person group secret must be 32 bytes of hex.');
  }
  return sha512Hex(encoder.encode(`meerkat-person-secret-commit-v1|${secretHex}`)).slice(0, 32);
}

/**
 * Content hash for deterministic tie-breaking and idempotence checks.
 *
 * Deliberately over the CANONICAL SIGNED BYTES only, NOT the signatures:
 * tweetnacl omits libsodium's canonical-S check, so `S + L` is a distinct
 * accepted signature for the same content. A signature-inclusive hash would
 * make a malleated twin compare as strictly newer (and let it carry a
 * different unsigned column past the ordering gate); hashing content alone
 * makes identical documents compare EQUAL, so a twin reports not_newer.
 */
export function personGroupDocHash(doc: PersonGroupDoc): string {
  return sha512Hex(canonicalPersonGroupBytes(doc)).slice(0, 32);
}

/** Mint the inner group id (random 32 hex). Uses the configured sync PRNG. */
export function generatePersonGroupId(): string {
  return bytesToHex(nacl.randomBytes(16));
}

/** Mint (or rotate) the group secret. Personal_replica only; never announced. */
export function generatePersonGroupSecret(): string {
  return bytesToHex(nacl.randomBytes(PERSON_GROUP_SECRET_BYTES));
}

export interface BuildPersonGroupRevisionInput {
  /** The previous accepted doc, or null when forming a new group. */
  previous: PersonGroupDoc | null;
  /**
   * The group secret this revision commits to. REQUIRED: on a revision that
   * removes a device the caller must pass a freshly rotated secret (an
   * expelled device that knew the old one must not derive future ids).
   */
  secretHex: string;
  /** Devices to add (deviceId + label; addedAt defaults to now). */
  add?: Array<{ deviceId: string; label: string; addedAt?: string }>;
  /** Device ids to remove. */
  remove?: readonly string[];
  now?: string;
  /** Override the minted group id when previous is null (tests). */
  groupId?: string;
}

export type BuildPersonGroupRevisionResult =
  | { ok: true; doc: UnsignedPersonGroupDoc; removedDevice: boolean }
  | { ok: false; reason: 'over_cap' | 'empty' | 'bad_device_id' | 'bad_secret' | 'bad_timestamp' };

/**
 * Build the next unsigned revision. Every listed device (including ones
 * carried over) must then sign the SAME canonical bytes before the doc can be
 * assembled -- there is no unilateral add. A removal is flagged so the caller
 * knows to rotate the group secret in the same step.
 */
export function buildPersonGroupRevision(
  input: BuildPersonGroupRevisionInput,
): BuildPersonGroupRevisionResult {
  const now = input.now ?? new Date().toISOString();
  const removeSet = new Set(input.remove ?? []);
  const kept = (input.previous?.devices ?? []).filter((d) => !removeSet.has(d.deviceId));
  const added: PersonGroupDevice[] = (input.add ?? []).map((d) => ({
    deviceId: d.deviceId,
    label: d.label,
    addedAt: d.addedAt ?? now,
  }));
  for (const device of added) {
    if (!isDeviceId(device.deviceId)) return { ok: false, reason: 'bad_device_id' };
    if (!isOrderableTimestamp(device.addedAt)) return { ok: false, reason: 'bad_timestamp' };
  }
  if (!isOrderableTimestamp(now)) return { ok: false, reason: 'bad_timestamp' };
  let secretCommitment: string;
  try {
    secretCommitment = personGroupSecretCommitment(input.secretHex);
  } catch {
    return { ok: false, reason: 'bad_secret' };
  }
  const devices = sortedUniqueDevices([...kept, ...added]);
  if (devices.length === 0) return { ok: false, reason: 'empty' };
  if (devices.length > PERSON_GROUP_MAX_DEVICES) return { ok: false, reason: 'over_cap' };
  // Tombstones accumulate; an explicit re-add (the device is back in
  // `devices`) is the only thing that clears one.
  const listed = new Set(devices.map((d) => d.deviceId));
  const removed = [...new Set([...(input.previous?.removed ?? []), ...removeSet])]
    .filter((id) => !listed.has(id))
    .sort();
  const removedDevice = (input.previous?.devices ?? []).some((d) => removeSet.has(d.deviceId));
  return {
    ok: true,
    removedDevice,
    doc: {
      version: 1,
      secretCommitment,
      groupId: input.previous?.groupId ?? input.groupId ?? generatePersonGroupId(),
      revision: (input.previous?.revision ?? 0) + 1,
      devices,
      removed,
      parentHash: input.previous ? personGroupDocHash(input.previous) : null,
      updatedAt: now,
    },
  };
}

export type UnsignedRevisionVerdict =
  | { ok: true }
  | {
      ok: false;
      reason:
        | 'malformed'
        | 'self_not_listed'
        | 'group_mismatch'
        | 'not_next_revision'
        | 'secret_mismatch'
        | 'over_cap'
        | 'forgets_removal'
        | 'wrong_parent';
    };

/**
 * A later doc may never silently DROP a tombstone. Every device the stored doc
 * had removed must either still be removed, or be explicitly listed as a
 * device again (a deliberate re-add). This is what makes an expulsion durable:
 * a concurrently-built sibling revision that never learned about the removal
 * fails here instead of resurrecting the device by winning a timestamp
 * comparison, and an expelled device cannot propose itself back in without the
 * re-add being visible in the signed bytes every sibling co-signs.
 */
function preservesRemovals(stored: PersonGroupDoc, incoming: UnsignedPersonGroupDoc): boolean {
  const stillRemoved = new Set(incoming.removed);
  const listed = new Set(incoming.devices.map((d) => d.deviceId));
  // Clearing a tombstone (re-listing a removed device) is allowed ONLY from a
  // STRICT SUCCESSOR -- a doc built on top of the one that carries the
  // tombstone. A concurrently-built sibling at the SAME revision never learned
  // about the removal, so "it lists the device again" is not consent, it is
  // ignorance; treating it as a re-add is exactly how a fork resurrects an
  // expelled device by winning a timestamp comparison.
  // With parentHash bound, a strict successor really is a child of `stored`,
  // so clearing a tombstone here is a deliberate re-add rather than a fork
  // that never learned about the removal.
  const isStrictSuccessor = incoming.revision === stored.revision + 1;
  return stored.removed.every((id) => (
    stillRemoved.has(id) || (isStrictSuccessor && listed.has(id))
  ));
}

/**
 * One entry in this device's own attestation ledger: "I signed revision N of
 * this group, it hashed to `docHash`, and it removed `removed`."
 */
export interface PersonAttestation {
  revision: number;
  docHash: string;
  removed: readonly string[];
}

export type AttestationVerdict =
  | { ok: true }
  | { ok: false; reason: 'equivocation' };

/**
 * The ANTI-EQUIVOCATION gate, and the durable fix for two distinct forks.
 *
 * A device must never sign two different docs at the same revision. That single
 * rule closes both of the fork routes that tombstones and parentHash alone
 * leave open, because both of them depend on a sibling attesting twice:
 *
 *  1. CAPTURE OF A STALE SIBLING. A expels X and B co-signs that removal, but B
 *     has not yet RECEIVED the committed doc, so B's stored state is still the
 *     old revision. X (expelled on A, still own-linked on B) then proposes a
 *     rival revision at the same number that drops A and keeps X. Against B's
 *     stale stored doc every other gate passes: X is still listed there, the
 *     parent matches, and that old doc carries no tombstone to preserve. B
 *     would co-sign its own capture. It cannot now, because B already attested
 *     a DIFFERENT doc at that revision.
 *
 *     Note why the obvious alternative does not work: requiring the dropped
 *     device to sign its own removal would equally block removing a device that
 *     is lost, stolen, or broken, which is the whole point of removal. What
 *     separates the attack from a legitimate expulsion is not who is dropped,
 *     it is that the signer is being asked to contradict itself.
 *
 *  2. DIVERGENT-INTENT DOUBLE REMOVAL. A removes C while B removes D, both
 *     built on the same parent. Each doc forgets the other's tombstone, so each
 *     side correctly refuses the other and the two lineages can never be
 *     reconciled: even a later doc that forgets nothing is rejected as
 *     wrong_parent forever. Refusing to attest twice at one revision means
 *     neither doc ever collects a full signature set, so nothing commits and
 *     the group simply stays where it was. A stalled ceremony expires on the
 *     TTL sweep and the user can retry, which is recoverable; a fork is not.
 *
 * Why anti-equivocation is SUFFICIENT for case 1, and no extra "never re-list a
 * device I attested as removed" rule is needed: a revision only commits when
 * EVERY device it lists has signed it, so a device that is still a member
 * cannot be unaware of a committed removal without having attested it. The
 * stale window and the ledger entry therefore always coincide. An extra rule
 * would also break the deliberate re-add that `preservesRemovals` exists to
 * permit, forbidding a user from ever relinking a device they once removed.
 *
 * Pure and ledger-shaped on purpose: the caller owns storage, and the ledger is
 * a record of this device's own acts, so it is device-local and never syncs.
 */
export function checkPersonAttestationLedger(
  ledger: readonly PersonAttestation[],
  doc: UnsignedPersonGroupDoc,
): AttestationVerdict {
  const docHash = personGroupDocHash({ ...doc, signatures: {} });
  for (const entry of ledger) {
    if (entry.revision === doc.revision && entry.docHash !== docHash) {
      return { ok: false, reason: 'equivocation' };
    }
  }
  // A re-signature of the SAME doc is not equivocation and must stay allowed:
  // an announce-only re-sign and a retried delivery both replay it.
  return { ok: true };
}


/** The ledger entry this device should record for a doc it just signed. */
export function personAttestationFor(doc: UnsignedPersonGroupDoc): PersonAttestation {
  return {
    revision: doc.revision,
    docHash: personGroupDocHash({ ...doc, signatures: {} }),
    removed: [...doc.removed],
  };
}

/**
 * The SIGNER-SIDE precondition check (the bait-and-switch defense). Signing
 * over canonical bytes only tells a device what it is joining if something
 * INSPECTS those bytes first: this does. A device must refuse to attest unless
 * it is itself listed, the group matches the one it already belongs to (or it
 * has none), the revision advances by exactly one, the caps/ordering
 * invariants hold, and -- when the caller knows the secret -- the commitment
 * matches, so a sibling cannot swap the secret behind a valid signature.
 */
export function verifyUnsignedPersonGroupRevision(
  doc: UnsignedPersonGroupDoc,
  context: {
    selfDeviceId: string;
    stored?: PersonGroupDoc | null;
    expectedSecretHex?: string;
    now?: number;
    /**
     * This device holds NO group and is being INVITED into an existing one.
     * A storedless device normally may only attest revision 1, so that it
     * cannot be talked into adopting a history it never witnessed. An invitee
     * legitimately has no stored doc yet must attest revision N+1, so this
     * flag relaxes exactly that one rule -- every other invariant (self
     * listed, sorted/unique devices, caps, canonical timestamps, secret
     * commitment) still applies. The caller MUST only set it when it has no
     * stored group AND the proposer is an own-device-linked peer.
     */
    joining?: boolean;
  },
): UnsignedRevisionVerdict {
  if (doc.version !== 1) return { ok: false, reason: 'malformed' };
  if (!isHex(doc.groupId, 32)) return { ok: false, reason: 'malformed' };
  if (!Number.isInteger(doc.revision) || doc.revision < 1) return { ok: false, reason: 'malformed' };
  if (!isHex(doc.secretCommitment, 32)) return { ok: false, reason: 'malformed' };
  if (!isOrderableTimestamp(doc.updatedAt, context.now)) return { ok: false, reason: 'malformed' };
  if (!Array.isArray(doc.devices) || doc.devices.length === 0) return { ok: false, reason: 'malformed' };
  if (doc.devices.length > PERSON_GROUP_MAX_DEVICES) return { ok: false, reason: 'over_cap' };
  const ids: string[] = [];
  for (const device of doc.devices) {
    if (!device || !isDeviceId(device.deviceId)) return { ok: false, reason: 'malformed' };
    if (typeof device.label !== 'string' || device.label !== normalizeDeviceLabel(device.label)) {
      return { ok: false, reason: 'malformed' };
    }
    if (!isOrderableTimestamp(device.addedAt, context.now)) return { ok: false, reason: 'malformed' };
    ids.push(device.deviceId);
  }
  for (let i = 1; i < ids.length; i++) {
    if (ids[i - 1]! >= ids[i]!) return { ok: false, reason: 'malformed' };
  }
  if (!ids.includes(context.selfDeviceId)) return { ok: false, reason: 'self_not_listed' };
  if (context.expectedSecretHex !== undefined) {
    let expected: string;
    try {
      expected = personGroupSecretCommitment(context.expectedSecretHex);
    } catch {
      return { ok: false, reason: 'secret_mismatch' };
    }
    if (expected !== doc.secretCommitment) return { ok: false, reason: 'secret_mismatch' };
  }
  const stored = context.stored ?? null;
  if (stored) {
    if (doc.groupId !== stored.groupId) return { ok: false, reason: 'group_mismatch' };
    // Exactly one step forward, or an announce-only re-sign of the SAME
    // revision (identical canonical content).
    const sameRevision = doc.revision === stored.revision
      && personGroupDocHash({ ...doc, signatures: {} }) === personGroupDocHash(stored);
    if (!sameRevision && doc.revision !== stored.revision + 1) {
      return { ok: false, reason: 'not_next_revision' };
    }
    if (!preservesRemovals(stored, doc)) return { ok: false, reason: 'forgets_removal' };
    // Causal succession: a doc that advances the revision must name the stored
    // doc as its parent. This is what stops a doc built on an older ancestor
    // from posing as the next state.
    if (doc.revision === stored.revision + 1 && doc.parentHash !== personGroupDocHash(stored)) {
      return { ok: false, reason: 'wrong_parent' };
    }
  } else if (doc.revision !== 1 && !context.joining) {
    // A device with no stored group may only attest a genesis revision; a
    // higher revision would mean adopting a history it never witnessed. The
    // one exception is an explicit invite (context.joining), which the app
    // sets only for an own-device-linked proposer.
    return { ok: false, reason: 'not_next_revision' };
  }
  return { ok: true };
}

/**
 * One device's signature over an unsigned revision (its own attestation).
 * REFUSES unless verifyUnsignedPersonGroupRevision passes for this device, so
 * the primitive itself cannot be used to sign a foreign group (MEDIUM-2).
 */
export function signPersonGroupRevision(
  identity: DeviceIdentity,
  doc: UnsignedPersonGroupDoc,
  context?: {
    stored?: PersonGroupDoc | null;
    expectedSecretHex?: string;
    now?: number;
    joining?: boolean;
  },
): string {
  const verdict = verifyUnsignedPersonGroupRevision(doc, {
    selfDeviceId: identity.publicKey,
    stored: context?.stored ?? null,
    ...(context?.expectedSecretHex !== undefined ? { expectedSecretHex: context.expectedSecretHex } : {}),
    ...(context?.now !== undefined ? { now: context.now } : {}),
    ...(context?.joining ? { joining: true } : {}),
  });
  if (!verdict.ok) {
    throw new Error(`Refusing to attest this person-group revision: ${verdict.reason}.`);
  }
  const privateKeyHex = extractSigningPrivateKeyHex(identity.privateKeyRef);
  return bytesToHex(signMessage(privateKeyHex, canonicalPersonGroupBytes(doc)));
}

/**
 * LOW-LEVEL signing over already-built canonical bytes. Deliberately
 * unguarded: it exists for the ASSEMBLING device (which built the bytes
 * itself) and for adversarial tests. Co-signing paths that receive bytes over
 * a transport must use signPersonGroupRevision / signPersonGroupAnnounce,
 * which run the precondition checks first.
 */
export function signPersonCanonicalBytes(identity: DeviceIdentity, bytes: Uint8Array): string {
  const privateKeyHex = extractSigningPrivateKeyHex(identity.privateKeyRef);
  return bytesToHex(signMessage(privateKeyHex, bytes));
}

/** Verify one Ed25519 signature over arbitrary canonical bytes (app seam). */
export function verifyPersonSignatureBytes(
  deviceId: string,
  bytes: Uint8Array,
  signatureHex: string,
): boolean {
  if (!isDeviceId(deviceId) || !isHex(signatureHex)) return false;
  try {
    return verifySignature(deviceId, bytes, hexToBytes(signatureHex));
  } catch {
    return false;
  }
}

/** Assemble a doc from an unsigned revision + collected signatures (unchecked). */
export function assemblePersonGroupDoc(
  doc: UnsignedPersonGroupDoc,
  signatures: Record<string, string>,
): PersonGroupDoc {
  return { ...doc, signatures: { ...signatures } };
}

/**
 * Full structural + cryptographic verification. True ONLY when:
 * shape and caps hold, devices are sorted + unique, the signature key set
 * EQUALS the device id set, and every signature verifies over the same
 * canonical bytes under its device's own key.
 */
export function verifyPersonGroupDoc(doc: PersonGroupDoc, now?: number): boolean {
  if (doc.version !== 1) return false;
  if (!isHex(doc.groupId, 32)) return false;
  if (!Number.isInteger(doc.revision) || doc.revision < 1) return false;
  if (!isHex(doc.secretCommitment, 32)) return false;
  if (!isOrderableTimestamp(doc.updatedAt, now)) return false;
  if (!Array.isArray(doc.devices) || doc.devices.length === 0) return false;
  if (doc.devices.length > PERSON_GROUP_MAX_DEVICES) return false;
  const ids: string[] = [];
  for (const device of doc.devices) {
    if (!device || !isDeviceId(device.deviceId)) return false;
    if (typeof device.label !== 'string' || device.label !== normalizeDeviceLabel(device.label)) {
      return false;
    }
    if (!isOrderableTimestamp(device.addedAt, now)) return false;
    ids.push(device.deviceId);
  }
  const sorted = [...ids].sort();
  for (let i = 0; i < ids.length; i++) {
    if (ids[i] !== sorted[i]) return false;
    if (i > 0 && ids[i] === ids[i - 1]) return false;
  }
  if (doc.parentHash !== null && !isHex(doc.parentHash, 32)) return false;
  if (doc.revision === 1 && doc.parentHash !== null) return false;
  if (doc.revision > 1 && doc.parentHash === null) return false;
  if (!Array.isArray(doc.removed)) return false;
  const listedIds = new Set(ids);
  for (let i = 0; i < doc.removed.length; i++) {
    const id = doc.removed[i]!;
    if (!isDeviceId(id)) return false;
    if (i > 0 && doc.removed[i - 1]! >= id) return false; // sorted + unique
    if (listedIds.has(id)) return false; // a device cannot be both listed and removed
  }
  const sigKeys = Object.keys(doc.signatures ?? {});
  if (sigKeys.length !== ids.length) return false;
  const idSet = new Set(ids);
  for (const key of sigKeys) {
    if (!idSet.has(key)) return false;
  }
  const canonical = canonicalPersonGroupBytes(doc);
  for (const deviceId of ids) {
    const signature = doc.signatures[deviceId];
    if (typeof signature !== 'string' || !isHex(signature)) return false;
    try {
      if (!verifySignature(deviceId, canonical, hexToBytes(signature))) return false;
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * Deterministic total order over verified docs: revision, then updatedAt, then
 * canonical hash. This is the acceptance order everywhere (the wall clock in
 * updatedAt is the HLC wall component of the own-device session that carries
 * the doc, so "equal revisions resolve by the existing HLC total order").
 */
export function comparePersonGroupDocs(a: PersonGroupDoc, b: PersonGroupDoc): number {
  if (a.revision !== b.revision) return a.revision < b.revision ? -1 : 1;
  if (a.updatedAt !== b.updatedAt) return a.updatedAt < b.updatedAt ? -1 : 1;
  const ha = personGroupDocHash(a);
  const hb = personGroupDocHash(b);
  if (ha === hb) return 0;
  return ha < hb ? -1 : 1;
}

export type AcceptPersonGroupResult =
  | { accepted: true; doc: PersonGroupDoc }
  | {
      accepted: false;
      reason:
        | 'invalid'
        | 'stale_revision'
        | 'group_mismatch'
        | 'not_newer'
        | 'forgets_removal'
        | 'wrong_parent';
    };

/**
 * Accept an incoming doc against the stored one. Replay-safe: an older (or
 * equal-but-not-greater) candidate never replaces the stored doc, so a
 * replayed stale revision cannot resurrect a removed device. Idempotent
 * re-delivery of the exact stored doc reports not_newer (a no-op, not an
 * error the caller should surface).
 */
export function acceptPersonGroupRevision(
  stored: PersonGroupDoc | null,
  incoming: PersonGroupDoc,
): AcceptPersonGroupResult {
  if (!verifyPersonGroupDoc(incoming)) return { accepted: false, reason: 'invalid' };
  if (stored === null) return { accepted: true, doc: incoming };
  if (incoming.groupId !== stored.groupId) return { accepted: false, reason: 'group_mismatch' };
  if (incoming.revision < stored.revision) return { accepted: false, reason: 'stale_revision' };
  // A doc that forgot a removal is NEVER acceptable, whatever its revision or
  // timestamp. Without this, two coordinators building concurrent successors
  // resurrect each other's expulsions via the ordering tie-break.
  if (!preservesRemovals(stored, incoming)) return { accepted: false, reason: 'forgets_removal' };
  if (incoming.revision === stored.revision + 1 && incoming.parentHash !== personGroupDocHash(stored)) {
    return { accepted: false, reason: 'wrong_parent' };
  }
  const order = comparePersonGroupDocs(incoming, stored);
  if (order <= 0) return { accepted: false, reason: 'not_newer' };
  return { accepted: true, doc: incoming };
}

// ---------------------------------------------------------------------------
// Per-context derived ids
// ---------------------------------------------------------------------------

/**
 * The identifier a single context (community or DM peer) sees for this person:
 * HMAC-SHA512(groupSecret, domain-tag || context) truncated to 128 bits, hex.
 * Without the secret, derived ids from two contexts cannot be equated; the
 * inner groupId never appears in any derivation input or output.
 */
export function derivePersonContextId(groupSecretHex: string, context: string): string {
  if (!isHex(groupSecretHex, PERSON_GROUP_SECRET_BYTES * 2)) {
    throw new Error('Person group secret must be 32 bytes of hex.');
  }
  if (!context) throw new Error('A derivation context is required.');
  const mac = hmacSha512(hexToBytes(groupSecretHex), encoder.encode(`${CONTEXT_TAG}|${context}`));
  return bytesToHex(mac).slice(0, PERSON_DERIVED_ID_HEX_CHARS);
}

/**
 * The row identity for a stored community announce.
 *
 * CRITICAL: this is derived from the SIGNATURE-COVERED device set, never from
 * the attacker-choosable `derivedGroupId`. When the row key was the derived
 * id, any ordinary community member could self-sign a single-device announce
 * carrying a victim's derived id at a huge revision; it verified (one listed
 * device, one signature), collided on the primary key, and permanently
 * overwrote the victim's proof -- their honest re-announce was then rejected
 * as stale forever. Keying on the device set means a squatter's announce
 * lands on its OWN row and can never displace anyone else's.
 */
export function personAnnounceRowKey(communityId: string, devices: readonly string[]): string {
  const sorted = [...devices].sort().join(',');
  return `${communityId}:${sha512Hex(encoder.encode(`meerkat-person-announce-row-v1|${communityId}|${sorted}`)).slice(0, 32)}`;
}

/** The context string for a community derivation. */
export function communityDerivationContext(communityId: string): string {
  return `community|${communityId}`;
}

/** The context string for a DM-peer derivation (per peer device). */
/** The context prefix for every DM-peer derivation. Exported so a consumer can
 *  bind the @dm storage scope to it instead of re-spelling the string. */
export const DM_PEER_CONTEXT_PREFIX = 'dm-peer|';

export function dmPeerDerivationContext(peerDeviceId: string): string {
  return `${DM_PEER_CONTEXT_PREFIX}${peerDeviceId}`;
}

// ---------------------------------------------------------------------------
// Person group announce (P2 wire format, defined here with the protocol)
// ---------------------------------------------------------------------------

export interface UnsignedPersonGroupAnnounce {
  version: 1;
  /** The context this announce is for (communityDerivationContext / dmPeer...). */
  context: string;
  /** The derived id for that context. The inner groupId NEVER appears here. */
  derivedGroupId: string;
  /** The group revision this announce reflects (monotonic per derived id). */
  revision: number;
  /** The attested device ids, sorted + unique. */
  devices: string[];
  updatedAt: string;
}

export interface PersonGroupAnnounce extends UnsignedPersonGroupAnnounce {
  /**
   * deviceId -> hex signature over the canonical announce bytes. Signed
   * content covers the plan's derivedId || context || revision triple PLUS the
   * full device list and updatedAt, so a relayed announce cannot drop or
   * splice devices while keeping the remaining signatures valid.
   */
  signatures: Record<string, string>;
}

export function canonicalPersonAnnounceBytes(a: UnsignedPersonGroupAnnounce): Uint8Array {
  return encoder.encode(JSON.stringify([
    ANNOUNCE_TAG,
    a.version,
    a.derivedGroupId,
    a.context,
    a.revision,
    a.devices,
    a.updatedAt,
  ]));
}

/** Build the unsigned announce for one context from the accepted doc + secret. */
export function buildPersonGroupAnnounce(
  doc: UnsignedPersonGroupDoc,
  groupSecretHex: string,
  context: string,
  now?: string,
): UnsignedPersonGroupAnnounce {
  return {
    version: 1,
    context,
    derivedGroupId: derivePersonContextId(groupSecretHex, context),
    revision: doc.revision,
    devices: doc.devices.map((d) => d.deviceId),
    updatedAt: now ?? doc.updatedAt,
  };
}

export type AnnounceDraftVerdict =
  | { ok: true }
  | {
      ok: false;
      reason:
        | 'malformed'
        | 'revision_mismatch'
        | 'devices_mismatch'
        | 'unknown_context'
        | 'self_context';
    };

/** A context string this device recognizes: community|<id> or dm-peer|<id>. */
function parseDerivationContext(context: string): { kind: 'community' | 'dm-peer'; id: string } | null {
  if (context.startsWith('community|')) {
    const id = context.slice('community|'.length);
    return id ? { kind: 'community', id } : null;
  }
  if (context.startsWith('dm-peer|')) {
    const id = context.slice('dm-peer|'.length);
    return isDeviceId(id) ? { kind: 'dm-peer', id } : null;
  }
  return null;
}

/**
 * The CO-SIGNER-SIDE check for an announce draft (the counterpart to
 * verifyUnsignedPersonGroupRevision). A co-signer cannot re-derive
 * `derivedGroupId` without the group secret, so it must at minimum bind every
 * OTHER field to the revision it is attesting: same revision, exactly the same
 * device set, a context kind it recognizes, and a well-formed derived id.
 *
 * Without this, a merely-PAIRED proposer could ride an arbitrary draft
 * (foreign peer context, revision 4242) alongside an honest group doc, collect
 * a co-signature, and present the co-signer's device as part of its person to
 * a third party -- with a permanently out-ranking revision. Trust boundary
 * that remains: `derivedGroupId` itself is taken on faith from the proposer,
 * which is why the app layer must only co-sign for OWN-DEVICE-LINKED peers.
 */
export function verifyAnnounceDraftAgainstDoc(
  draft: UnsignedPersonGroupAnnounce,
  doc: UnsignedPersonGroupDoc,
  context?: { selfDeviceId?: string; now?: number },
): AnnounceDraftVerdict {
  if (draft.version !== 1) return { ok: false, reason: 'malformed' };
  if (!isHex(draft.derivedGroupId, PERSON_DERIVED_ID_HEX_CHARS)) return { ok: false, reason: 'malformed' };
  if (!isOrderableTimestamp(draft.updatedAt, context?.now)) return { ok: false, reason: 'malformed' };
  if (!Array.isArray(draft.devices) || draft.devices.length === 0) return { ok: false, reason: 'malformed' };
  if (draft.devices.length > PERSON_GROUP_MAX_DEVICES) return { ok: false, reason: 'malformed' };
  if (!Number.isInteger(draft.revision)) return { ok: false, reason: 'malformed' };
  if (draft.revision !== doc.revision) return { ok: false, reason: 'revision_mismatch' };
  const docIds = doc.devices.map((d) => d.deviceId);
  if (draft.devices.length !== docIds.length) return { ok: false, reason: 'devices_mismatch' };
  for (let i = 0; i < docIds.length; i++) {
    if (draft.devices[i] !== docIds[i]) return { ok: false, reason: 'devices_mismatch' };
  }
  const parsed = parseDerivationContext(draft.context);
  if (!parsed) return { ok: false, reason: 'unknown_context' };
  // A dm-peer context aimed at one of the group's OWN devices is nonsense (own
  // devices need no proof) and would leak a proof to a sibling as if a peer.
  if (parsed.kind === 'dm-peer' && docIds.includes(parsed.id)) {
    return { ok: false, reason: 'self_context' };
  }
  if (context?.selfDeviceId && !docIds.includes(context.selfDeviceId)) {
    return { ok: false, reason: 'devices_mismatch' };
  }
  return { ok: true };
}

/**
 * One device's signature over an announce (its own membership proof). REFUSES
 * unless the draft binds to the revision being attested when `doc` is passed;
 * app co-signing paths MUST pass it (the assembling device may omit it because
 * it built both).
 */
export function signPersonGroupAnnounce(
  identity: DeviceIdentity,
  announce: UnsignedPersonGroupAnnounce,
  doc?: UnsignedPersonGroupDoc,
): string {
  if (doc) {
    const verdict = verifyAnnounceDraftAgainstDoc(announce, doc, { selfDeviceId: identity.publicKey });
    if (!verdict.ok) {
      throw new Error(`Refusing to co-sign this person announce: ${verdict.reason}.`);
    }
  }
  const privateKeyHex = extractSigningPrivateKeyHex(identity.privateKeyRef);
  return bytesToHex(signMessage(privateKeyHex, canonicalPersonAnnounceBytes(announce)));
}

export function assemblePersonGroupAnnounce(
  announce: UnsignedPersonGroupAnnounce,
  signatures: Record<string, string>,
): PersonGroupAnnounce {
  return { ...announce, signatures: { ...signatures } };
}

/**
 * Verify an announce: shape, caps, sorted unique devices, signature key set
 * EQUALS the device set, every signature verifies. Verification failure means
 * the receiver renders the devices as ungrouped -- never a fabricated group.
 * (Whether each device is an active member of the receiving community is an
 * app-side check on top of this, since membership lives in the descriptor.)
 */
export function verifyPersonGroupAnnounce(announce: PersonGroupAnnounce, now?: number): boolean {
  if (announce.version !== 1) return false;
  if (!announce.context || typeof announce.context !== 'string') return false;
  if (!isHex(announce.derivedGroupId, PERSON_DERIVED_ID_HEX_CHARS)) return false;
  if (!Number.isInteger(announce.revision) || announce.revision < 1) return false;
  if (!isOrderableTimestamp(announce.updatedAt, now)) return false;
  if (!Array.isArray(announce.devices) || announce.devices.length === 0) return false;
  if (announce.devices.length > PERSON_GROUP_MAX_DEVICES) return false;
  for (let i = 0; i < announce.devices.length; i++) {
    const id = announce.devices[i]!;
    if (!isDeviceId(id)) return false;
    if (i > 0 && announce.devices[i - 1]! >= id) return false;
  }
  const sigKeys = Object.keys(announce.signatures ?? {});
  if (sigKeys.length !== announce.devices.length) return false;
  const idSet = new Set(announce.devices);
  for (const key of sigKeys) {
    if (!idSet.has(key)) return false;
  }
  const canonical = canonicalPersonAnnounceBytes(announce);
  for (const deviceId of announce.devices) {
    const signature = announce.signatures[deviceId];
    if (typeof signature !== 'string' || !isHex(signature)) return false;
    try {
      if (!verifySignature(deviceId, canonical, hexToBytes(signature))) return false;
    } catch {
      return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Presentation profile (the person's one name + per-community overrides)
// ---------------------------------------------------------------------------

/**
 * Plan 56 feature 53: optional persona fields (bio, pronouns, name color).
 * Same privacy rule as the avatar: a pseudonymous override community receives
 * ONLY persona explicitly chosen for it, never the global persona (a bio can
 * deanonymize a pseudonym just as surely as a photo).
 */
export interface PresentationPersona {
  bio?: string;
  pronouns?: string;
  nameColor?: ProfileNameColorToken;
}

export interface PresentationOverride extends PresentationPersona {
  displayName: string;
  avatarInitial: string | null;
  /**
   * A per-community avatar. Optional and deliberately separate from the
   * global one: a community the person is pseudonymous in must never receive
   * the global photo, but the person may still choose a DIFFERENT photo for
   * that community. Same 32 KB base64-JPEG gate as everywhere else.
   */
  avatarImage?: string;
}

export interface PresentationProfile extends PresentationPersona {
  version: 1;
  /** Monotonic revision; merge picks the higher (revision, updatedAt, hash). */
  revision: number;
  /** The global person name (per-community overrides always beat it). */
  displayName: string;
  avatarInitial: string | null;
  /** Optional base64 JPEG, same 32 KB cap + gate as community avatars. */
  avatarImage?: string;
  /** communityId -> override. An override always beats the global name. */
  overrides: Record<string, PresentationOverride>;
  updatedAt: string;
}

function personaHashPart(persona: PresentationPersona): unknown[] {
  return [persona.bio ?? null, persona.pronouns ?? null, persona.nameColor ?? null];
}

function hasPersona(persona: PresentationPersona): boolean {
  return persona.bio !== undefined || persona.pronouns !== undefined || persona.nameColor !== undefined;
}

export function presentationProfileHash(profile: PresentationProfile): string {
  const overrides = Object.keys(profile.overrides).sort().map((k) => [
    k,
    profile.overrides[k]!.displayName,
    profile.overrides[k]!.avatarInitial,
    profile.overrides[k]!.avatarImage ?? null,
    // Conditional append: persona-less overrides keep their pre-persona hash.
    ...(hasPersona(profile.overrides[k]!) ? personaHashPart(profile.overrides[k]!) : []),
  ]);
  return sha512Hex(encoder.encode(JSON.stringify([
    'meerkat-presentation-profile-v1',
    profile.version,
    profile.revision,
    profile.displayName,
    profile.avatarInitial,
    profile.avatarImage ?? null,
    overrides,
    profile.updatedAt,
    ...(hasPersona(profile) ? personaHashPart(profile) : []),
  ]))).slice(0, 32);
}

export interface PresentationPersonaInput {
  bio?: string | null;
  pronouns?: string | null;
  nameColor?: ProfileNameColorToken | null;
}

export interface PresentationProfileInput extends PresentationPersonaInput {
  revision: number;
  displayName: string;
  avatarInitial?: string | null;
  avatarImage?: string | null;
  overrides?: Record<string, {
    displayName: string;
    avatarInitial?: string | null;
    avatarImage?: string | null;
  } & PresentationPersonaInput>;
  updatedAt?: string;
}

/** Normalize + validate persona input; throws on an unknown name color. */
function normalizePersona(input: PresentationPersonaInput): PresentationPersona {
  const bio = (input.bio ?? '').trim().slice(0, PROFILE_BIO_MAX_CHARS);
  const pronouns = (input.pronouns ?? '').trim().slice(0, PROFILE_PRONOUNS_MAX_CHARS);
  const nameColor = input.nameColor ?? undefined;
  if (nameColor !== undefined && !(PROFILE_NAME_COLOR_TOKENS as readonly string[]).includes(nameColor)) {
    throw new Error('Unknown name color.');
  }
  return {
    ...(bio ? { bio } : {}),
    ...(pronouns ? { pronouns } : {}),
    ...(nameColor ? { nameColor } : {}),
  };
}

function isValidPersona(persona: PresentationPersona): boolean {
  if (persona.bio !== undefined && (typeof persona.bio !== 'string' || persona.bio.length === 0 || persona.bio.length > PROFILE_BIO_MAX_CHARS)) return false;
  if (persona.pronouns !== undefined && (typeof persona.pronouns !== 'string' || persona.pronouns.length === 0 || persona.pronouns.length > PROFILE_PRONOUNS_MAX_CHARS)) return false;
  if (persona.nameColor !== undefined && !(PROFILE_NAME_COLOR_TOKENS as readonly string[]).includes(persona.nameColor)) return false;
  return true;
}

function normalizeInitial(initial: string | null | undefined, displayName: string): string | null {
  const value = (initial ?? '').trim();
  const source = value.length > 0 ? value : displayName.trim();
  const first = Array.from(source)[0];
  return first ? first.toUpperCase() : null;
}

/** Build a normalized, validated presentation profile. Throws on bad input. */
export function createPresentationProfile(input: PresentationProfileInput): PresentationProfile {
  const displayName = normalizeProfileDisplayName(input.displayName);
  if (!displayName) throw new Error('Choose a display name.');
  if (!Number.isInteger(input.revision) || input.revision < 1) {
    throw new Error('Presentation profile revision must be a positive integer.');
  }
  const avatarImage = (input.avatarImage ?? '').trim();
  if (avatarImage && !isValidCommunityAvatarImage(avatarImage)) {
    throw new Error('That avatar image is too large or not a supported format.');
  }
  const overrides: Record<string, PresentationOverride> = {};
  for (const [communityId, override] of Object.entries(input.overrides ?? {})) {
    const name = normalizeProfileDisplayName(override.displayName);
    if (!communityId || !name) continue;
    const overrideImage = (override.avatarImage ?? '').trim();
    if (overrideImage && !isValidCommunityAvatarImage(overrideImage)) {
      throw new Error('That avatar image is too large or not a supported format.');
    }
    overrides[communityId] = {
      displayName: name,
      avatarInitial: normalizeInitial(override.avatarInitial, name),
      ...(overrideImage ? { avatarImage: overrideImage } : {}),
      ...normalizePersona(override),
    };
  }
  return {
    version: 1,
    revision: input.revision,
    displayName,
    avatarInitial: normalizeInitial(input.avatarInitial, displayName),
    ...(avatarImage ? { avatarImage } : {}),
    ...normalizePersona(input),
    overrides,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  };
}

/** Structural validation for a profile received over own-device sync. */
export function isValidPresentationProfile(profile: PresentationProfile): boolean {
  if (profile.version !== 1) return false;
  if (!Number.isInteger(profile.revision) || profile.revision < 1) return false;
  if (!profile.displayName || profile.displayName !== normalizeProfileDisplayName(profile.displayName)) {
    return false;
  }
  if (profile.avatarInitial !== normalizeInitial(profile.avatarInitial, profile.displayName)) {
    return false;
  }
  if (profile.avatarImage !== undefined && !isValidCommunityAvatarImage(profile.avatarImage)) {
    return false;
  }
  if (!isValidPersona(profile)) return false;
  if (!profile.updatedAt || Number.isNaN(Date.parse(profile.updatedAt))) return false;
  if (profile.overrides === null || typeof profile.overrides !== 'object') return false;
  for (const [communityId, override] of Object.entries(profile.overrides)) {
    if (!communityId) return false;
    if (!override || typeof override.displayName !== 'string') return false;
    if (override.displayName !== normalizeProfileDisplayName(override.displayName)) return false;
    if (!override.displayName) return false;
    if (override.avatarInitial !== normalizeInitial(override.avatarInitial, override.displayName)) {
      return false;
    }
    if (override.avatarImage !== undefined && !isValidCommunityAvatarImage(override.avatarImage)) {
      return false;
    }
    if (!isValidPersona(override)) return false;
  }
  return true;
}

/**
 * Deterministic merge: the higher (revision, updatedAt, hash) profile wins in
 * full -- overrides are not unioned, because a union could resurrect an
 * override the winning device deliberately cleared.
 */
export function mergePresentationProfiles(
  a: PresentationProfile,
  b: PresentationProfile,
): PresentationProfile {
  if (a.revision !== b.revision) return a.revision > b.revision ? a : b;
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? a : b;
  return presentationProfileHash(a) >= presentationProfileHash(b) ? a : b;
}

/** The name this person presents in one community (override beats global). */
export function presentationNameForCommunity(
  profile: PresentationProfile,
  communityId: string,
): { displayName: string; avatarInitial: string | null; avatarImage?: string } & PresentationPersona {
  const override = profile.overrides[communityId];
  if (override) {
    // The global photo (and persona) NEVER follows a pseudonym into an
    // override community; only what was explicitly chosen for it does.
    return {
      displayName: override.displayName,
      avatarInitial: override.avatarInitial,
      ...(override.avatarImage ? { avatarImage: override.avatarImage } : {}),
      ...(override.bio ? { bio: override.bio } : {}),
      ...(override.pronouns ? { pronouns: override.pronouns } : {}),
      ...(override.nameColor ? { nameColor: override.nameColor } : {}),
    };
  }
  return {
    displayName: profile.displayName,
    avatarInitial: profile.avatarInitial,
    ...(profile.avatarImage ? { avatarImage: profile.avatarImage } : {}),
    ...(profile.bio ? { bio: profile.bio } : {}),
    ...(profile.pronouns ? { pronouns: profile.pronouns } : {}),
    ...(profile.nameColor ? { nameColor: profile.nameColor } : {}),
  };
}
