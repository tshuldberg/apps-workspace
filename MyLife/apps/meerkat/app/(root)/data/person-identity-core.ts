// person-identity-core.ts (Plan 52 P1/P2, MOBILE; web twin:
// apps/meerkat-web/src/lib/person-identity-core.ts -- keep lockstep).
//
// The app half of the person-identity layer:
//  - read/write pi_person_group + pi_presentation_profile (the engine
//    replicates them at personal_replica between own devices; inbound rows are
//    gated by @mylife/sync's apply validators);
//  - the mutual-attestation exchange over the pair-private mailbox (propose /
//    accept, with announce drafts co-signed in the same round);
//  - auto-alignment: on any change, update the local identity name and
//    RE-SIGN this device's own CommunityProfileEvents to match, because member
//    rows are device-keyed -- alignment means every linked device emits
//    identical profile content under its OWN signature, never one device
//    signing for another;
//  - receiver-side link materialization (cm_person_links) rebuilt from
//    verified announces only.
//
// HONESTY: nothing here fabricates a group. A device renders as part of a
// person ONLY from a verified, fully signed announce. A proposal is co-signed
// ONLY when the proposer is one of THIS device's own-device-linked peers
// (linking already required a safety-code compare), and the sync layer's
// signer-side preconditions must pass on the exact bytes being signed.

import type { DatabaseAdapter } from '@mylife/db';
import {
  acceptPersonGroupRevision,
  assemblePersonGroupAnnounce,
  assemblePersonGroupDoc,
  buildPersonGroupAnnounce,
  buildPersonGroupRevision,
  canonicalPersonAnnounceBytes,
  canonicalPersonGroupBytes,
  communityDerivationContext,
  createCommunityProfileEvent,
  type PresentationPersonaInput,
  createPresentationProfile,
  deriveMailboxToken,
  mailboxSealNowMs,
  dmPeerDerivationContext,
  DM_PEER_CONTEXT_PREFIX,
  generatePersonGroupSecret,
  listCommunities,
  PERSON_ANNOUNCE_TABLE,
  PERSON_GROUP_ACCEPT_MAILBOX_KIND,
  PERSON_GROUP_ANNOUNCE_MAILBOX_KIND,
  PERSON_GROUP_PROPOSE_MAILBOX_KIND,
  PERSON_GROUP_TABLE,
  PERSON_LINKS_TABLE,
  PERSON_SELF_ROW_ID,
  PRESENTATION_PROFILE_TABLE,
  personAnnounceFromRow,
  personAnnounceRowFromAnnounce,
  personGroupDocFromRow,
  personGroupDocHash,
  personGroupProposalHash,
  personGroupRowFromDoc,
  presentationNameForCommunity,
  presentationProfileFromRow,
  presentationProfileRowFromProfile,
  sealMailboxDelta,
  signPersonCanonicalBytes,
  signPersonGroupAnnounce,
  signPersonGroupRevision,
  checkPersonAttestationLedger,
  personAttestationFor,
  verifyAnnounceDraftAgainstDoc,
  verifyPersonGroupAnnounce,
  verifyPersonGroupDoc,
  verifyPersonSignatureBytes,
  type DeviceIdentity,
  type MailboxEnvelope,
  type MailboxEnvelopeHandlers,
  type PersonGroupAcceptPayload,
  type PersonGroupAnnounce,
  type PersonGroupDoc,
  type PersonGroupProposePayload,
  type PresentationProfile,
  type UnsignedPersonGroupAnnounce,
  type UnsignedPersonGroupDoc,
  type PersonAttestation,
} from '@mylife/sync';
import { getIdentityRow, updateDisplayName } from './db';
import {
  CM_PROFILES_TABLE,
  communityProfileRowFromEvent,
  insertCommunityProfileRow,
  listCommunityProfileEvents,
} from './community-core';

export type RecordPersonChange = (
  table: string,
  operation: 'INSERT' | 'UPDATE' | 'DELETE',
  rowId: string,
  data: Record<string, unknown> | null,
) => void;

/** The reserved cm_person_links scope for DM-peer person proofs. */
export const DM_PERSON_LINKS_SCOPE = '@dm';

// ---------------------------------------------------------------------------
// Device-local ceremony state (mk_ prefix: NEVER replicates)
// ---------------------------------------------------------------------------

export const PERSON_PROPOSALS_TABLE = 'mk_person_proposals';
/**
 * This device's own attestation ledger (round-3 HIGH-1 + HIGH-2). It records
 * every person-group revision THIS device has signed, so it can refuse to sign
 * a second, different doc at the same revision. `mk_` prefixed on purpose: it
 * is a record of this device's own acts and must never replicate, because a
 * sibling's ledger is not evidence about what this device attested.
 */
export const PERSON_ATTESTATIONS_TABLE = 'mk_person_attestations';
/**
 * Removal requests from your OTHER devices that are waiting on your approval
 * (round-4 L2). Device-local: it is this device's inbox, not shared state.
 */
export const PERSON_INBOUND_TABLE = 'mk_person_inbound_proposals';
export const PERSON_ANNOUNCE_OUTBOX_TABLE = 'mk_person_announce_outbox';

export function ensurePersonIdentityTables(db: DatabaseAdapter): void {
  db.execute(`CREATE TABLE IF NOT EXISTS ${PERSON_PROPOSALS_TABLE} (
    id TEXT PRIMARY KEY,
    doc_json TEXT NOT NULL,
    secret_hex TEXT NOT NULL,
    signatures_json TEXT NOT NULL,
    announces_json TEXT NOT NULL,
    announce_sigs_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    last_parked_at TEXT,
    cancelled_at TEXT
  )`);
  {
    const columns = db.query<{ name: string }>(`PRAGMA table_info(${PERSON_PROPOSALS_TABLE})`);
    if (!columns.some((c) => c.name === 'cancelled_at')) {
      db.execute(`ALTER TABLE ${PERSON_PROPOSALS_TABLE} ADD COLUMN cancelled_at TEXT`);
    }
  }
  db.execute(`CREATE TABLE IF NOT EXISTS ${PERSON_ATTESTATIONS_TABLE} (
    revision INTEGER PRIMARY KEY,
    doc_hash TEXT NOT NULL,
    removed_json TEXT NOT NULL,
    signed_at TEXT NOT NULL
  )`);
  db.execute(`CREATE TABLE IF NOT EXISTS ${PERSON_INBOUND_TABLE} (
    id TEXT PRIMARY KEY,
    sender_device_id TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);
  db.execute(`CREATE TABLE IF NOT EXISTS ${PERSON_ANNOUNCE_OUTBOX_TABLE} (
    context TEXT PRIMARY KEY,
    announce_json TEXT NOT NULL,
    parked INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
  )`);
}

// ---------------------------------------------------------------------------
// Attestation ledger (anti-equivocation)
// ---------------------------------------------------------------------------

/** Everything this device has ever signed, for the anti-equivocation gate. */
export function readPersonAttestations(db: DatabaseAdapter): PersonAttestation[] {
  const rows = db.query<{ revision: number; doc_hash: string; removed_json: string }>(
    `SELECT revision, doc_hash, removed_json FROM ${PERSON_ATTESTATIONS_TABLE}`,
  );
  return rows.map((row) => ({
    revision: Number(row.revision),
    docHash: row.doc_hash,
    removed: JSON.parse(row.removed_json) as string[],
  }));
}

/**
 * Record that this device signed `doc`. Written in the SAME step as the
 * signature, never later: a signature that escaped without a ledger row is
 * exactly the equivocation the gate exists to prevent.
 */
export function recordPersonAttestation(
  db: DatabaseAdapter,
  doc: UnsignedPersonGroupDoc,
  now: string,
): void {
  const entry = personAttestationFor(doc);
  db.execute(
    `INSERT OR REPLACE INTO ${PERSON_ATTESTATIONS_TABLE}
       (revision, doc_hash, removed_json, signed_at) VALUES (?, ?, ?, ?)`,
    [entry.revision, entry.docHash, JSON.stringify(entry.removed), now],
  );
}

// ---------------------------------------------------------------------------
// Row reads/writes
// ---------------------------------------------------------------------------

export interface StoredPersonIdentity {
  doc: PersonGroupDoc;
  secretHex: string;
}

/**
 * The verified stored person group, or null. Self-inclusion floor: a doc that
 * does not list THIS device never renders as this device's person group, even
 * if it somehow reached storage.
 */
export function readPersonGroup(
  db: DatabaseAdapter,
  selfDeviceId: string,
): StoredPersonIdentity | null {
  const rows = db.query<{ doc_json: string; secret_hex: string }>(
    `SELECT doc_json, secret_hex FROM ${PERSON_GROUP_TABLE} WHERE id = ?`,
    [PERSON_SELF_ROW_ID],
  );
  const row = rows[0];
  if (!row) return null;
  const doc = personGroupDocFromRow(row as unknown as Record<string, unknown>);
  if (!doc || !verifyPersonGroupDoc(doc)) return null;
  if (!doc.devices.some((d) => d.deviceId === selfDeviceId)) return null;
  if (!/^[0-9a-f]{64}$/.test(row.secret_hex)) return null;
  return { doc, secretHex: row.secret_hex };
}

function writePersonGroupRow(
  db: DatabaseAdapter,
  doc: PersonGroupDoc,
  secretHex: string,
  recordChange?: RecordPersonChange,
): void {
  const row = personGroupRowFromDoc(doc, secretHex);
  db.execute(
    `INSERT OR REPLACE INTO ${PERSON_GROUP_TABLE}
       (id, group_id, revision, doc_json, secret_hex, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [row.id, row.group_id, row.revision, row.doc_json, row.secret_hex, row.updated_at],
  );
  recordChange?.(PERSON_GROUP_TABLE, 'UPDATE', PERSON_SELF_ROW_ID, row as unknown as Record<string, unknown>);
}

/**
 * THE FORK ESCAPE HATCH (round-3 HIGH-1). Discard this device's person group
 * entirely and start over from a fresh genesis.
 *
 * The anti-equivocation ledger stops the known routes into an irreconcilable
 * fork, but the refusals that make expulsion durable are absolute by design: if
 * two lineages ever do diverge, each one correctly rejects the other forever,
 * and a new groupId is rejected as a group mismatch. A design that can refuse
 * everything must also offer a way out, or the user's only remedy is
 * reinstalling the app.
 *
 * What this does NOT do, deliberately: it does not touch the siblings. They
 * keep their own group until each is reset too, so the user has to relink. That
 * is the honest cost of a local-only recovery, and the alternative -- a doc that
 * overrides a sibling's refusals -- would be a resurrection primitive.
 *
 * The attestation ledger is CLEARED with it. It records attestations about a
 * group that no longer exists, and keeping it would block the fresh genesis.
 */
export function resetPersonGroup(
  db: DatabaseAdapter,
  recordChange?: RecordPersonChange,
): void {
  db.execute(`DELETE FROM ${PERSON_GROUP_TABLE} WHERE id = ?`, [PERSON_SELF_ROW_ID]);
  recordChange?.(PERSON_GROUP_TABLE, 'DELETE', PERSON_SELF_ROW_ID, null);
  db.execute(`DELETE FROM ${PERSON_ATTESTATIONS_TABLE}`);
  db.execute(`DELETE FROM ${PERSON_PROPOSALS_TABLE}`);
  db.execute(`DELETE FROM ${PERSON_ANNOUNCE_OUTBOX_TABLE}`);
  db.execute(`DELETE FROM ${PERSON_INBOUND_TABLE}`);
}

export function readPresentationProfile(db: DatabaseAdapter): PresentationProfile | null {
  const rows = db.query<{ profile_json: string }>(
    `SELECT profile_json FROM ${PRESENTATION_PROFILE_TABLE} WHERE id = ?`,
    [PERSON_SELF_ROW_ID],
  );
  const row = rows[0];
  if (!row) return null;
  return presentationProfileFromRow(row as unknown as Record<string, unknown>);
}

export interface SavePresentationProfileInput extends PresentationPersonaInput {
  displayName: string;
  avatarInitial?: string | null;
  avatarImage?: string | null;
  overrides?: Record<string, { displayName: string; avatarInitial?: string | null } & PresentationPersonaInput>;
}

/** Save the profile as the NEXT revision (monotonic; wins the merge order). */
export function savePresentationProfile(
  db: DatabaseAdapter,
  input: SavePresentationProfileInput,
  recordChange?: RecordPersonChange,
): PresentationProfile {
  const stored = readPresentationProfile(db);
  const profile = createPresentationProfile({
    revision: (stored?.revision ?? 0) + 1,
    displayName: input.displayName,
    avatarInitial: input.avatarInitial,
    avatarImage: input.avatarImage,
    bio: input.bio,
    pronouns: input.pronouns,
    nameColor: input.nameColor,
    overrides: input.overrides ?? stored?.overrides ?? {},
  });
  const row = presentationProfileRowFromProfile(profile);
  db.execute(
    `INSERT OR REPLACE INTO ${PRESENTATION_PROFILE_TABLE}
       (id, revision, profile_json, updated_at)
     VALUES (?, ?, ?, ?)`,
    [row.id, row.revision, row.profile_json, row.updated_at],
  );
  recordChange?.(PRESENTATION_PROFILE_TABLE, 'UPDATE', PERSON_SELF_ROW_ID, row as unknown as Record<string, unknown>);
  return profile;
}

/**
 * Record (or clear, with null) a per-community name override. Bootstraps the
 * profile from the current identity name when none exists yet, which is what
 * the join door does when a user names themselves for a community (P3).
 */
export function setPresentationOverride(
  db: DatabaseAdapter,
  communityId: string,
  displayName: string | null,
  recordChange?: RecordPersonChange,
  appearance?: { avatarInitial?: string | null; avatarImage?: string | null } & PresentationPersonaInput,
): PresentationProfile {
  const stored = readPresentationProfile(db);
  const globalName = stored?.displayName
    ?? getIdentityRow(db)?.display_name
    ?? 'Meerkat user';
  const overrides: Record<string, {
    displayName: string;
    avatarInitial?: string | null;
    avatarImage?: string | null;
  } & PresentationPersonaInput> = { ...(stored?.overrides ?? {}) };
  const trimmed = (displayName ?? '').trim();
  // Clearing the name clears the whole override, including any per-community
  // photo: the person is no longer pseudonymous here, so the global identity
  // applies again. Accepting the join door's PREFILLED global name (no
  // appearance supplied) also means "no override", so a later global rename
  // still propagates to that community; the settings editor, which always
  // supplies appearance, can pin the same name deliberately.
  if (!trimmed || (appearance === undefined && trimmed === globalName)) {
    delete overrides[communityId];
  } else {
    const previous = stored?.overrides[communityId];
    overrides[communityId] = {
      displayName: trimmed,
      avatarInitial: appearance?.avatarInitial !== undefined
        ? appearance.avatarInitial
        : previous?.avatarInitial ?? null,
      avatarImage: appearance?.avatarImage !== undefined
        ? appearance.avatarImage
        : previous?.avatarImage ?? null,
      bio: appearance?.bio !== undefined ? appearance.bio : previous?.bio ?? null,
      pronouns: appearance?.pronouns !== undefined ? appearance.pronouns : previous?.pronouns ?? null,
      nameColor: appearance?.nameColor !== undefined ? appearance.nameColor : previous?.nameColor ?? null,
    };
  }
  return savePresentationProfile(db, {
    displayName: globalName,
    avatarInitial: stored?.avatarInitial,
    avatarImage: stored?.avatarImage,
    bio: stored?.bio,
    pronouns: stored?.pronouns,
    nameColor: stored?.nameColor,
    overrides,
  }, recordChange);
}

// ---------------------------------------------------------------------------
// Auto-alignment (P1)
// ---------------------------------------------------------------------------

export interface AlignPersonIdentityResult {
  changed: boolean;
  renamedIdentity: boolean;
  updatedCommunities: string[];
}

function myLatestProfileEvent(db: DatabaseAdapter, communityId: string, selfDeviceId: string) {
  const events = listCommunityProfileEvents(db, communityId)
    .filter((event) => event.memberDeviceId === selfDeviceId);
  return events[events.length - 1] ?? null;
}

/**
 * Idempotent alignment pass; cheap when nothing changed. Called after
 * sessions/drains and at boot, so a name chosen on another linked device
 * lands here: the local identity renames and this device re-signs its OWN
 * community profiles to the same content.
 *
 * Privacy rule: a community with an OVERRIDE never receives the global avatar
 * image. A pseudonymous name wearing your real photo is not a pseudonym.
 */
export function alignPersonIdentity(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  recordChange?: RecordPersonChange,
): AlignPersonIdentityResult {
  const profile = readPresentationProfile(db);
  const result: AlignPersonIdentityResult = {
    changed: false,
    renamedIdentity: false,
    updatedCommunities: [],
  };
  if (!profile) return result;

  const identityRow = getIdentityRow(db);
  if (identityRow && identityRow.display_name !== profile.displayName) {
    updateDisplayName(db, profile.displayName);
    result.renamedIdentity = true;
    result.changed = true;
  }

  for (const community of listCommunities(db)) {
    const communityId = community.communityId;
    if (!community.descriptor.members.some((m) => m.deviceId === identity.publicKey)) continue;
    const expected = presentationNameForCommunity(profile, communityId);
    // presentationNameForCommunity already applies the privacy rule: an
    // override community receives ONLY a photo explicitly chosen for it, never
    // the global one.
    const expectedImage = expected.avatarImage;
    const current = myLatestProfileEvent(db, communityId, identity.publicKey);
    const matches = current
      && current.displayName === expected.displayName
      && current.avatarInitial === expected.avatarInitial
      && (current.avatarImage ?? undefined) === expectedImage
      && (current.bio ?? undefined) === expected.bio
      && (current.pronouns ?? undefined) === expected.pronouns
      && (current.nameColor ?? undefined) === expected.nameColor;
    if (matches) continue;
    try {
      const event = createCommunityProfileEvent(identity, {
        communityId,
        displayName: expected.displayName,
        avatarInitial: expected.avatarInitial,
        avatarImage: expectedImage ?? null,
        bio: expected.bio ?? null,
        pronouns: expected.pronouns ?? null,
        nameColor: expected.nameColor ?? null,
      });
      const row = insertCommunityProfileRow(db, event);
      recordChange?.(CM_PROFILES_TABLE, 'INSERT', event.id, {
        ...communityProfileRowFromEvent(event),
        ...row,
      });
      result.updatedCommunities.push(communityId);
      result.changed = true;
    } catch {
      // One bad community (e.g. an oversized legacy avatar) must not abort
      // alignment for the rest; it retries on the next pass.
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Attestation exchange (P1) + announce distribution (P2)
// ---------------------------------------------------------------------------

export interface PersonCeremonyDeps {
  db: DatabaseAdapter;
  identity: DeviceIdentity;
  /** Own-device-linked peers (dm_own_devices): the only devices we co-sign for. */
  listOwnDeviceIds: () => string[];
  /** Active paired FRIEND device ids (not own devices) needing DM-peer proofs. */
  listDmPeerIds?: () => string[];
  /** Pairing material for a device, or null when not paired/active. */
  resolvePairedDevice: (deviceId: string) => { dhPublicKey: string; sharedSecretHex: string } | null;
  /** Park a sealed envelope on a mailbox token; true iff it really parked. */
  parkEnvelope: (token: string, envelope: MailboxEnvelope) => Promise<boolean>;
  /**
   * Drop a device's own-device link (dm_own_devices). Called when a device
   * leaves the person group; without it an expelled device keeps passing the
   * propose-side trust gate forever.
   */
  revokeOwnDeviceLink?: (deviceId: string) => void;
  recordChange?: RecordPersonChange;
  now?: () => string;
}

interface PendingProposalRow {
  id: string;
  doc_json: string;
  secret_hex: string;
  signatures_json: string;
  announces_json: string;
  announce_sigs_json: string;
  created_at: string;
  last_parked_at: string | null;
  /** Set when the user cancelled. The row is KEPT so its revision stays
   *  spoken for, and so an identical retry can revive it (round-4 L1). */
  cancelled_at: string | null;
}

const PROPOSAL_COLUMNS =
  'id, doc_json, secret_hex, signatures_json, announces_json, announce_sigs_json, created_at, last_parked_at, cancelled_at';

function readPendingProposal(db: DatabaseAdapter, id: string): PendingProposalRow | null {
  return db.query<PendingProposalRow>(
    `SELECT ${PROPOSAL_COLUMNS} FROM ${PERSON_PROPOSALS_TABLE} WHERE id = ?`,
    [id],
  )[0] ?? null;
}

function writePendingProposal(db: DatabaseAdapter, row: PendingProposalRow): void {
  db.execute(
    `INSERT OR REPLACE INTO ${PERSON_PROPOSALS_TABLE} (${PROPOSAL_COLUMNS})
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [row.id, row.doc_json, row.secret_hex, row.signatures_json, row.announces_json,
      row.announce_sigs_json, row.created_at, row.last_parked_at, row.cancelled_at ?? null],
  );
}

export function listPendingPersonProposals(db: DatabaseAdapter): PendingProposalRow[] {
  return db.query<PendingProposalRow>(
    `SELECT ${PROPOSAL_COLUMNS} FROM ${PERSON_PROPOSALS_TABLE}
     WHERE cancelled_at IS NULL ORDER BY created_at ASC`,
  );
}

/**
 * A cancelled proposal this device could safely REVIVE: same parent revision,
 * same resulting membership, same tombstones. Reviving means re-parking the
 * IDENTICAL bytes this device already signed, which is why it is safe.
 */
function findRevivableProposal(
  db: DatabaseAdapter,
  doc: UnsignedPersonGroupDoc,
): PendingProposalRow | null {
  const rows = db.query<PendingProposalRow>(
    `SELECT ${PROPOSAL_COLUMNS} FROM ${PERSON_PROPOSALS_TABLE}
     WHERE cancelled_at IS NOT NULL ORDER BY created_at DESC`,
  );
  for (const row of rows) {
    let candidate: UnsignedPersonGroupDoc;
    try {
      candidate = JSON.parse(row.doc_json) as UnsignedPersonGroupDoc;
    } catch {
      continue;
    }
    // Compared on WHAT THE CHANGE IS, not on groupId: a genesis build mints a
    // fresh random groupId every time, so including it would make the very
    // first ceremony impossible to retry. Where a stored group exists the
    // groupId is forced to match anyway, and reviving a genesis doc reuses the
    // id this device already signed, which is what we want.
    const sameShape = candidate.revision === doc.revision
      && candidate.parentHash === doc.parentHash
      && candidate.devices.map((d) => d.deviceId).join(',') === doc.devices.map((d) => d.deviceId).join(',')
      && candidate.removed.join(',') === doc.removed.join(',');
    if (sameShape) return row;
  }
  return null;
}

/** The announce contexts this person should currently hold proofs for. */
export function neededAnnounceContexts(
  db: DatabaseAdapter,
  deviceIds: readonly string[],
  selfDeviceId: string,
  dmPeerIds: readonly string[],
): string[] {
  const contexts: string[] = [];
  const ids = new Set(deviceIds);
  for (const community of listCommunities(db)) {
    const members = new Set(community.descriptor.members.map((m) => m.deviceId));
    if (!members.has(selfDeviceId)) continue;
    // Announce only where EVERY attested device is a member; otherwise the
    // proof fails the member gate on every receiver (fail-closed by design).
    if (![...ids].every((id) => members.has(id))) continue;
    contexts.push(communityDerivationContext(community.communityId));
  }
  for (const peerId of dmPeerIds) {
    if (ids.has(peerId)) continue; // own devices need no DM proof
    contexts.push(dmPeerDerivationContext(peerId));
  }
  return contexts;
}

async function parkToDevice(
  deps: PersonCeremonyDeps,
  deviceId: string,
  payload: unknown,
): Promise<boolean> {
  const paired = deps.resolvePairedDevice(deviceId);
  if (!paired) return false;
  const now = deps.now?.() ?? new Date().toISOString();
  const token = deriveMailboxToken(paired.sharedSecretHex, deviceId, mailboxSealNowMs(now));
  const envelope = sealMailboxDelta(
    deps.identity,
    { deviceId, dhPublicKey: paired.dhPublicKey },
    payload,
    now,
  );
  try {
    return await deps.parkEnvelope(token, envelope);
  } catch {
    return false;
  }
}

/**
 * Remove devices from this person AND revoke their own-device links, so an
 * expelled device can neither be treated as "one of your devices" nor propose
 * itself back in. Rotation of the group secret happens inside the revision
 * build; the link revocation is what makes it stick.
 */
export async function removeDevicesFromPerson(
  deps: PersonCeremonyDeps,
  deviceIds: readonly string[],
): Promise<ProposePersonGroupResult> {
  const result = await proposePersonGroupRevision(deps, { remove: deviceIds });
  // Round-3 MEDIUM-3: revoke ONLY once the removal actually committed.
  // `result.ok` is also true while the ceremony is still waiting on a
  // co-signer, and revoking then leaves the device still a full member of the
  // stored doc under the UNCHANGED group secret, while the UI claims it is
  // gone and the key rotated. The rotated secret exists only inside the pending
  // proposal until every sibling signs.
  if (result.ok && result.assembled) {
    for (const deviceId of deviceIds) {
      deps.revokeOwnDeviceLink?.(deviceId);
    }
  }
  return result;
}

export type ProposePersonGroupResult =
  | { ok: true; assembled: boolean; parked: number; proposalId: string | null }
  | {
      ok: false;
      reason: 'build_failed' | 'not_linked' | 'refused' | 'proposal_pending' | 'conflicted';
    };

/** How long a pending proposal stays live before it is swept (M-2). */
export const PERSON_PROPOSAL_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Drop pending proposals older than the TTL. A stale row otherwise sits in
 * device-local storage forever holding a rotated group secret, and blocks new
 * proposals under the single-flight rule below.
 */
export function sweepStalePersonProposals(
  db: DatabaseAdapter,
  nowMs: number = Date.now(),
): number {
  // Only LIVE rows: an already-cancelled one is in the target state already,
  // and counting it again would overstate what this sweep did.
  const rows = db.query<{ id: string; created_at: string }>(
    `SELECT id, created_at FROM ${PERSON_PROPOSALS_TABLE} WHERE cancelled_at IS NULL`,
  );
  let dropped = 0;
  for (const row of rows) {
    const created = Date.parse(row.created_at);
    if (!Number.isFinite(created) || nowMs - created > PERSON_PROPOSAL_TTL_MS) {
      // Round-5 V2: MARK it, exactly as an explicit cancel does, rather than
      // deleting it.
      //
      // The attestation is never retracted (round-4 L1), because a parked
      // proposal put this device's signature in a peer's hands and that peer
      // can still assemble it. That reasoning applies to an expired proposal
      // just as much as a cancelled one, so both must end in the SAME state.
      // Deleting the row destroyed the only copy of the bytes this device had
      // signed, which left the revision spoken for by a document that existed
      // nowhere: an identical retry could no longer revive it, hashed
      // differently because of its new timestamp, and was refused as
      // conflicted. That needed no user error and no adversary, just a second
      // device left unopened for a day.
      //
      // Single-flight is unaffected: listPendingPersonProposals already
      // filters on cancelled_at IS NULL.
      db.execute(
        `UPDATE ${PERSON_PROPOSALS_TABLE} SET cancelled_at = ?
         WHERE id = ? AND cancelled_at IS NULL`,
        [new Date(nowMs).toISOString(), row.id],
      );
      dropped += 1;
    }
  }
  return dropped;
}

/** Abandon a pending proposal (the user cancelled, or it is being replaced). */
/**
 * Cancel a waiting confirmation.
 *
 * Round-4 L1: this used to RETRACT this device's attestation and delete the
 * row, on the reasoning that only the author holds an unassembled proposal. That
 * reasoning was WRONG. The author's signature ships inside every parked PROPOSE
 * payload, so from the moment it is parked, a recipient holds the author's
 * signature over those exact bytes and can assemble that revision itself. If
 * this device then committed a DIFFERENT doc at the same revision, the two
 * lineages would fork permanently -- exactly what the ledger exists to prevent.
 *
 * So the attestation stands. The row is kept, marked cancelled, and the
 * revision stays spoken for. What makes "cancel, then link again" still work is
 * that a retry with the SAME intent REVIVES this row and re-parks the identical
 * bytes rather than building a rival doc; see findRevivableProposal. A retry
 * with a DIFFERENT intent at that revision is honestly refused as conflicted,
 * and "Start my device group over" is the way out.
 */
export function cancelPersonProposal(db: DatabaseAdapter, proposalId: string): void {
  db.execute(
    `UPDATE ${PERSON_PROPOSALS_TABLE} SET cancelled_at = ? WHERE id = ?`,
    [new Date().toISOString(), proposalId],
  );
}


/**
 * Propose the next group revision (or, with no changes, a fresh announce
 * round for the CURRENT revision). Every other listed device gets a PROPOSE
 * on its pairwise mailbox; the doc assembles when every accept lands. A
 * single-device revision assembles immediately.
 */
export async function proposePersonGroupRevision(
  deps: PersonCeremonyDeps,
  changes: { add?: Array<{ deviceId: string; label: string }>; remove?: readonly string[] } = {},
): Promise<ProposePersonGroupResult> {
  const { db, identity } = deps;
  const now = deps.now?.() ?? new Date().toISOString();
  // SINGLE-FLIGHT (HIGH-3). Two ceremonies authored against the same stored
  // revision both land on revision N+1, and the same-revision tie-breaks on
  // updatedAt -- so a later-authored proposal built BEFORE the first
  // committed can silently resurrect a device the user just expelled, and
  // replicate the current secret back to it. One at a time; the caller
  // cancels explicitly to start over.
  sweepStalePersonProposals(db, Date.parse(now) || Date.now());
  if (listPendingPersonProposals(db).length > 0) {
    return { ok: false, reason: 'proposal_pending' };
  }
  const stored = readPersonGroup(db, identity.publicKey);
  const adds = changes.add ?? [];
  const removes = changes.remove ?? [];
  const isRevision = adds.length > 0 || removes.length > 0 || stored === null;

  // Every ADDED device must already be own-device-linked here: linking
  // required the safety-code compare, and the group follows that trust.
  const ownIds = new Set(deps.listOwnDeviceIds());
  for (const add of adds) {
    if (add.deviceId !== identity.publicKey && !ownIds.has(add.deviceId)) {
      return { ok: false, reason: 'not_linked' };
    }
  }

  let doc: UnsignedPersonGroupDoc;
  let secretHex: string;
  if (isRevision) {
    const selfListed = stored !== null || adds.some((a) => a.deviceId === identity.publicKey);
    const removedSomething = removes.some((id) => stored?.doc.devices.some((d) => d.deviceId === id));
    // Rotate on ANY removal so an expelled device that knew the old secret
    // cannot derive this person's future per-context ids.
    secretHex = stored === null || removedSomething
      ? generatePersonGroupSecret()
      : stored.secretHex;
    const built = buildPersonGroupRevision({
      previous: stored?.doc ?? null,
      secretHex,
      add: selfListed
        ? adds
        : [...adds, { deviceId: identity.publicKey, label: getIdentityRow(db)?.display_name ?? 'This device' }],
      remove: removes,
      now,
    });
    if (!built.ok) return { ok: false, reason: 'build_failed' };
    doc = built.doc;
  } else {
    const storedDoc = stored!.doc;
    doc = {
      version: storedDoc.version,
      secretCommitment: storedDoc.secretCommitment,
      groupId: storedDoc.groupId,
      revision: storedDoc.revision,
      devices: storedDoc.devices,
      removed: storedDoc.removed,
      parentHash: storedDoc.parentHash,
      updatedAt: storedDoc.updatedAt,
    };
    secretHex = stored!.secretHex;
  }

  const deviceIds = doc.devices.map((d) => d.deviceId);
  const contexts = neededAnnounceContexts(
    db,
    deviceIds,
    identity.publicKey,
    deps.listDmPeerIds?.() ?? [],
  );
  const drafts = contexts.map((context) => buildPersonGroupAnnounce(doc, secretHex, context, now));

  // REVIVE a cancelled proposal with the same intent (round-4 L1). "Cancel the
  // waiting confirmation, then link again" must keep working, and the safe way
  // to do that is to re-park the IDENTICAL bytes this device already signed
  // rather than build a rival doc at the same revision.
  const revivable = findRevivableProposal(db, doc);
  if (revivable) {
    db.execute(
      `UPDATE ${PERSON_PROPOSALS_TABLE} SET cancelled_at = NULL WHERE id = ?`,
      [revivable.id],
    );
    const parked = await parkProposal(deps, revivable.id);
    return { ok: true, assembled: false, parked, proposalId: revivable.id };
  }

  // ANTI-EQUIVOCATION, author side. If this device already signed a DIFFERENT
  // doc at this revision -- whether it co-signed a sibling's or authored one it
  // later cancelled -- authoring a rival forks the group permanently. Refuse
  // and make the user resolve it explicitly.
  const ledgerVerdict = checkPersonAttestationLedger(readPersonAttestations(db), doc);
  if (!ledgerVerdict.ok) return { ok: false, reason: 'conflicted' };

  let selfSig: string;
  const selfAnnounceSigs: Record<string, string> = {};
  try {
    // The assembling device built these bytes itself, so it passes its own
    // preconditions explicitly (self listed, group continuity, secret match).
    selfSig = signPersonGroupRevision(identity, doc, {
      stored: stored?.doc ?? null,
      expectedSecretHex: secretHex,
    });
    for (const draft of drafts) {
      selfAnnounceSigs[draft.context] = signPersonGroupAnnounce(identity, draft, doc);
    }
  } catch {
    return { ok: false, reason: 'refused' };
  }
  recordPersonAttestation(db, doc, now);

  const others = deviceIds.filter((id) => id !== identity.publicKey);
  const proposalId = personGroupProposalHash(doc);

  if (others.length === 0) {
    const assembled = assemblePersonGroupDoc(doc, { [identity.publicKey]: selfSig });
    if (!verifyPersonGroupDoc(assembled)) return { ok: false, reason: 'build_failed' };
    if (isRevision) {
      const acceptance = acceptPersonGroupRevision(stored?.doc ?? null, assembled);
      if (!acceptance.accepted && acceptance.reason !== 'not_newer') {
        return { ok: false, reason: 'build_failed' };
      }
      if (acceptance.accepted) writePersonGroupRow(db, assembled, secretHex, deps.recordChange);
    }
    finalizeAnnounces(deps, assembled, drafts, { [identity.publicKey]: selfAnnounceSigs });
    return { ok: true, assembled: true, parked: 0, proposalId: null };
  }

  writePendingProposal(db, {
    id: proposalId,
    doc_json: JSON.stringify(doc),
    secret_hex: secretHex,
    signatures_json: JSON.stringify({ [identity.publicKey]: selfSig }),
    announces_json: JSON.stringify(drafts),
    announce_sigs_json: JSON.stringify({ [identity.publicKey]: selfAnnounceSigs }),
    created_at: now,
    last_parked_at: null,
    cancelled_at: null,
  });

  const parked = await parkProposal(deps, proposalId);
  return { ok: true, assembled: false, parked, proposalId };
}

/** Park (or re-park) a pending proposal to every not-yet-signed device. */
export async function parkProposal(deps: PersonCeremonyDeps, proposalId: string): Promise<number> {
  const { db } = deps;
  const pending = readPendingProposal(db, proposalId);
  if (!pending) return 0;
  const doc = JSON.parse(pending.doc_json) as UnsignedPersonGroupDoc;
  const signatures = JSON.parse(pending.signatures_json) as Record<string, string>;
  const announces = JSON.parse(pending.announces_json) as UnsignedPersonGroupAnnounce[];
  const payload: PersonGroupProposePayload = {
    kind: PERSON_GROUP_PROPOSE_MAILBOX_KIND,
    version: 1,
    doc,
    signatures,
    ...(announces.length ? { announces } : {}),
  };
  let parked = 0;
  for (const device of doc.devices) {
    if (signatures[device.deviceId]) continue;
    if (await parkToDevice(deps, device.deviceId, payload)) parked += 1;
  }
  writePendingProposal(db, { ...pending, last_parked_at: deps.now?.() ?? new Date().toISOString() });
  return parked;
}

/**
 * Assemble + persist the announces once every device has co-signed. Community
 * contexts become replicated cm_person_announces rows; DM contexts go to the
 * outbox and are parked to their peers.
 */
function finalizeAnnounces(
  deps: PersonCeremonyDeps,
  doc: PersonGroupDoc,
  drafts: readonly UnsignedPersonGroupAnnounce[],
  perDeviceSigs: Record<string, Record<string, string>>,
): void {
  const { db } = deps;
  const deviceIds = doc.devices.map((d) => d.deviceId);
  const now = deps.now?.() ?? new Date().toISOString();
  for (const draft of drafts) {
    const signatures: Record<string, string> = {};
    for (const deviceId of deviceIds) {
      const sig = perDeviceSigs[deviceId]?.[draft.context];
      if (sig) signatures[deviceId] = sig;
    }
    if (Object.keys(signatures).length !== deviceIds.length) continue;
    const announce = assemblePersonGroupAnnounce(draft, signatures);
    if (!verifyPersonGroupAnnounce(announce)) continue; // never persist an unverifiable proof
    if (draft.context.startsWith('community|')) {
      const communityId = draft.context.slice('community|'.length);
      const row = personAnnounceRowFromAnnounce(announce, communityId);
      db.execute(
        `INSERT OR REPLACE INTO ${PERSON_ANNOUNCE_TABLE}
           (id, community_id, derived_group_id, revision, announce_json, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [row.id, row.community_id, row.derived_group_id, row.revision, row.announce_json, row.updated_at],
      );
      deps.recordChange?.(PERSON_ANNOUNCE_TABLE, 'INSERT', row.id, row as unknown as Record<string, unknown>);
      rebuildPersonLinksForCommunity(db, communityId);
    } else {
      db.execute(
        `INSERT OR REPLACE INTO ${PERSON_ANNOUNCE_OUTBOX_TABLE} (context, announce_json, parked, updated_at)
         VALUES (?, ?, 0, ?)`,
        [draft.context, JSON.stringify(announce), now],
      );
    }
  }
}

/** Park every unparked DM-peer announce in the outbox. Best-effort. */
export async function drainPersonAnnounceOutbox(deps: PersonCeremonyDeps): Promise<number> {
  const { db } = deps;
  const rows = db.query<{ context: string; announce_json: string }>(
    `SELECT context, announce_json FROM ${PERSON_ANNOUNCE_OUTBOX_TABLE} WHERE parked = 0`,
  );
  let parked = 0;
  for (const row of rows) {
    if (!row.context.startsWith('dm-peer|')) continue;
    const peerDeviceId = row.context.slice('dm-peer|'.length);
    let announce: PersonGroupAnnounce;
    try {
      announce = JSON.parse(row.announce_json) as PersonGroupAnnounce;
    } catch {
      continue;
    }
    const ok = await parkToDevice(deps, peerDeviceId, {
      kind: PERSON_GROUP_ANNOUNCE_MAILBOX_KIND,
      version: 1,
      announce,
    });
    if (ok) {
      db.execute(`UPDATE ${PERSON_ANNOUNCE_OUTBOX_TABLE} SET parked = 1 WHERE context = ?`, [row.context]);
      parked += 1;
    }
  }
  return parked;
}

/**
 * Announce this person to ONE newly paired DM peer (Plan 53 P3): after an
 * in-person add commits, the new friend should render this person (all linked
 * devices collapsed) rather than a bare device.
 *
 * Honest limits, all deliberate:
 *  - No person group stored = nothing to announce; a single unlinked device
 *    renders as a device, which is the truth.
 *  - An own-device-linked peer gets NO dm announce (contexts exclude own
 *    devices), and running a no-change proposal here could block the plan 52
 *    linking proposal via the single-flight rule, so it is refused up front.
 *  - A multi-device person needs every sibling's announce signature, so this
 *    parks a co-sign round and the announce completes when the sibling
 *    accepts. A pending proposal already in flight means this is a no-op; the
 *    peer's context is picked up by the next assembled revision.
 *  - With no reachable relay the announce stays queued (parked = 0) and the
 *    foreground drain parks it later. Never claims delivery it did not make.
 */
export async function announcePersonToDmPeer(
  deps: PersonCeremonyDeps,
  peerDeviceId: string,
): Promise<number> {
  const { db, identity } = deps;
  if (!readPersonGroup(db, identity.publicKey)) return 0;
  if (deps.listOwnDeviceIds().includes(peerDeviceId)) return 0;
  const context = dmPeerDerivationContext(peerDeviceId);
  const existing = db.query<{ context: string }>(
    `SELECT context FROM ${PERSON_ANNOUNCE_OUTBOX_TABLE} WHERE context = ?`,
    [context],
  );
  if (existing.length === 0) {
    const result = await proposePersonGroupRevision(deps, {});
    if (!result.ok) return 0;
  }
  return drainPersonAnnounceOutbox(deps);
}

/** Devices the stored doc lists that the incoming one no longer does. */
export function droppedDevices(
  stored: PersonGroupDoc,
  incoming: UnsignedPersonGroupDoc,
): string[] {
  const listed = new Set(incoming.devices.map((d) => d.deviceId));
  return stored.devices.map((d) => d.deviceId).filter((id) => !listed.has(id));
}

function storeInboundProposal(
  db: DatabaseAdapter,
  senderDeviceId: string,
  payload: PersonGroupProposePayload,
  createdAt: string,
): void {
  db.execute(
    `INSERT OR REPLACE INTO ${PERSON_INBOUND_TABLE}
       (id, sender_device_id, payload_json, created_at) VALUES (?, ?, ?, ?)`,
    [personGroupProposalHash(payload.doc), senderDeviceId, JSON.stringify(payload), createdAt],
  );
}

export interface InboundPersonProposal {
  id: string;
  senderDeviceId: string;
  /** Devices this request would remove from your person. */
  removes: string[];
  createdAt: string;
}

/** Removal requests from your other devices that are waiting on you. */
export function listInboundPersonApprovals(
  db: DatabaseAdapter,
  selfDeviceId: string,
): InboundPersonProposal[] {
  const stored = readPersonGroup(db, selfDeviceId);
  if (!stored) return [];
  const rows = db.query<{ id: string; sender_device_id: string; payload_json: string; created_at: string }>(
    `SELECT id, sender_device_id, payload_json, created_at FROM ${PERSON_INBOUND_TABLE}
     ORDER BY created_at ASC`,
  );
  const out: InboundPersonProposal[] = [];
  for (const row of rows) {
    let payload: PersonGroupProposePayload;
    try {
      payload = JSON.parse(row.payload_json) as PersonGroupProposePayload;
    } catch {
      continue;
    }
    const removes = droppedDevices(stored.doc, payload.doc);
    // A request that no longer removes anything (the group already moved past
    // it) is not shown: there is nothing left for the user to decide.
    if (removes.length === 0) continue;
    out.push({
      id: row.id,
      senderDeviceId: row.sender_device_id,
      removes,
      createdAt: row.created_at,
    });
  }
  return out;
}

export function declineInboundPersonProposal(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM ${PERSON_INBOUND_TABLE} WHERE id = ?`, [id]);
}

/**
 * The user approved a removal one of their other devices asked for. Runs the
 * SAME co-sign path an add runs, with every gate re-evaluated NOW rather than
 * when the request arrived, because the group may have moved on while it sat
 * waiting.
 */
export async function approveInboundPersonProposal(
  deps: PersonCeremonyDeps,
  id: string,
): Promise<boolean> {
  const { db } = deps;
  const row = db.query<{ sender_device_id: string; payload_json: string }>(
    `SELECT sender_device_id, payload_json FROM ${PERSON_INBOUND_TABLE} WHERE id = ?`,
    [id],
  )[0];
  if (!row) return false;
  let payload: PersonGroupProposePayload;
  try {
    payload = JSON.parse(row.payload_json) as PersonGroupProposePayload;
  } catch {
    declineInboundPersonProposal(db, id);
    return false;
  }
  const signed = await coSignPersonProposal(deps, row.sender_device_id, payload);
  declineInboundPersonProposal(db, id);
  return signed;
}

/**
 * Co-sign a sibling's proposal and park the accept back. Shared by the silent
 * add path and by approveInboundPersonProposal, so an approved removal goes
 * through EXACTLY the same gates an add does, re-evaluated at approval time
 * rather than at arrival time.
 */
async function coSignPersonProposal(
  deps: PersonCeremonyDeps,
  senderDeviceId: string,
  payload: PersonGroupProposePayload,
): Promise<boolean> {
  const { db, identity } = deps;
  const doc = payload.doc;
  const stored = readPersonGroup(db, identity.publicKey);
    // Defense in depth against a device that was EXPELLED but whose
    // own-device link somehow survived: once this device holds a group, only
    // a CURRENT member of it may propose. The tombstone rule already blocks
    // the resurrection itself; this stops the proposal being co-signed at
    // all.
    if (stored && !stored.doc.devices.some((d) => d.deviceId === senderDeviceId)) {
      return false;
    }
    // The tombstone is SIGNED and replicates, so it is trustworthy even when
    // the rest of this device's view is behind: a device the group expelled
    // may never propose, whatever its own-device link still says here.
    if (stored?.doc.removed.includes(senderDeviceId)) return false;
    // ANTI-EQUIVOCATION, co-signer side. This is what stops an expelled
    // device from capturing a sibling that has not yet RECEIVED the doc it
    // already co-signed: the stale stored doc still lists the attacker and
    // carries no tombstone, so every other gate passes, but this device
    // cannot sign a second, different doc at a revision it already attested.
    if (!checkPersonAttestationLedger(readPersonAttestations(db), doc).ok) return false;
    const drafts = payload.announces ?? [];
    let signature: string;
    const announceSignatures: Record<string, string> = {};
    try {
      // Signer-side preconditions (self listed, group continuity, exactly
      // the next revision) are enforced INSIDE these primitives; a bait-and
      // -switch doc throws rather than getting attested.
      //
      // `joining` covers the INVITE case: this device holds no group yet and
      // is being added to an existing one, so it legitimately attests a
      // revision above 1. Without it an add is structurally impossible --
      // the self-inclusion floor makes `stored` null for an invitee, and a
      // storedless device may otherwise only attest revision 1. It is set
      // ONLY when we have no stored group, which is exactly the invite
      // shape, and the sender is already gated to own-device-linked peers.
      signature = signPersonGroupRevision(identity, doc, {
        stored: stored?.doc ?? null,
        ...(stored ? {} : { joining: true }),
      });
      for (const draft of drafts) {
        if (!verifyAnnounceDraftAgainstDoc(draft, doc, { selfDeviceId: identity.publicKey }).ok) {
          return false;
        }
        announceSignatures[draft.context] = signPersonGroupAnnounce(identity, draft, doc);
      }
    } catch {
      return false;
    }
    recordPersonAttestation(db, doc, deps.now?.() ?? new Date().toISOString());
    const accept: PersonGroupAcceptPayload = {
      kind: PERSON_GROUP_ACCEPT_MAILBOX_KIND,
      version: 1,
      proposalHash: personGroupProposalHash(doc),
      doc,
      signature,
      ...(Object.keys(announceSignatures).length ? { announceSignatures } : {}),
    };
  return parkToDevice(deps, senderDeviceId, accept);
}

/**
 * The mailbox handlers, injected into the app's handler map.
 *
 * The dispatch layer already proved: envelope authenticity, the proposer
 * signed the exact doc, this device is listed, every carried signature
 * verifies, and every announce draft binds to the doc. What THIS layer adds is
 * the trust decision the protocol cannot make for us: the sender must be an
 * OWN-DEVICE-LINKED peer, not merely a paired friend.
 */
export function buildPersonGroupMailboxHandlers(
  deps: PersonCeremonyDeps,
): Pick<MailboxEnvelopeHandlers, 'personGroupPropose' | 'personGroupAccept' | 'personGroupAnnounce'> {
  const { db, identity } = deps;
  return {
    personGroupPropose: async (senderDeviceId, payload, createdAt) => {
      // Trust floor first, so an unlinked sender can neither be co-signed for
      // NOR fill the approval queue below with prompts.
      if (!deps.listOwnDeviceIds().includes(senderDeviceId)) return false;
      // REMOVAL CONSENT (round-4 L2). Adding a device is co-signed silently:
      // the proposer is already an own-device-linked, safety-code-verified peer
      // and an add costs the user nothing. REMOVING one is different. A device
      // that is compromised but still linked could otherwise expel the owner's
      // main phone pre-emptively, and because a device may never sign two docs
      // at one revision, every sibling that auto-signed the attacker's doc can
      // no longer co-sign the owner's legitimate counter-removal. That turns
      // expulsion into a race the attacker can win whenever it likes.
      //
      // So a proposal that DROPS a device this one currently lists waits for
      // the user. Nothing is signed here; the accept is parked only from
      // approveInboundPersonProposal.
      const held = readPersonGroup(db, identity.publicKey);
      if (held && droppedDevices(held.doc, payload.doc).length > 0) {
        storeInboundProposal(db, senderDeviceId, payload, createdAt);
        return false;
      }
      return coSignPersonProposal(deps, senderDeviceId, payload);
    },

    personGroupAccept: async (senderDeviceId, payload) => {

      // The accept's proposalHash was checked against its doc at dispatch, so
      // this lookup cannot be spliced onto a different pending proposal.
      const pending = readPendingProposal(db, payload.proposalHash);
      if (!pending) return false;
      const doc = JSON.parse(pending.doc_json) as UnsignedPersonGroupDoc;
      if (!doc.devices.some((d) => d.deviceId === senderDeviceId)) return false;

      const drafts = JSON.parse(pending.announces_json) as UnsignedPersonGroupAnnounce[];
      const draftByContext = new Map(drafts.map((d) => [d.context, d]));
      const announceSigs: Record<string, string> = {};
      for (const [context, sig] of Object.entries(payload.announceSignatures ?? {})) {
        const draft = draftByContext.get(context);
        if (!draft) continue;
        if (!verifyPersonSignatureBytes(senderDeviceId, canonicalPersonAnnounceBytes(draft), sig)) continue;
        announceSigs[context] = sig;
      }
      const signatures = JSON.parse(pending.signatures_json) as Record<string, string>;
      signatures[senderDeviceId] = payload.signature;
      const perDeviceAnnounceSigs =
        JSON.parse(pending.announce_sigs_json) as Record<string, Record<string, string>>;
      perDeviceAnnounceSigs[senderDeviceId] = {
        ...(perDeviceAnnounceSigs[senderDeviceId] ?? {}),
        ...announceSigs,
      };
      writePendingProposal(db, {
        ...pending,
        signatures_json: JSON.stringify(signatures),
        announce_sigs_json: JSON.stringify(perDeviceAnnounceSigs),
      });

      if (!doc.devices.every((d) => signatures[d.deviceId])) return true; // still collecting
      const assembled = assemblePersonGroupDoc(doc, signatures);
      if (!verifyPersonGroupDoc(assembled)) return false;
      const stored = readPersonGroup(db, identity.publicKey);
      const acceptance = acceptPersonGroupRevision(stored?.doc ?? null, assembled);
      if (acceptance.accepted) {
        writePersonGroupRow(db, assembled, pending.secret_hex, deps.recordChange);
      } else if (acceptance.reason !== 'not_newer') {
        return false;
      } else if (!stored || personGroupDocHash(stored.doc) !== personGroupDocHash(assembled)) {
        // 'not_newer' for a DIVERGENT same-revision doc: this ceremony lost.
        // Publishing its announces would replicate a derived id computed from
        // a secret that is not the stored one (M-1). Drop it silently.
        db.execute(`DELETE FROM ${PERSON_PROPOSALS_TABLE} WHERE id = ?`, [payload.proposalHash]);
        return false;
      }
      finalizeAnnounces(deps, assembled, drafts, perDeviceAnnounceSigs);
      db.execute(`DELETE FROM ${PERSON_PROPOSALS_TABLE} WHERE id = ?`, [payload.proposalHash]);
      void drainPersonAnnounceOutbox(deps);
      return true;
    },

    personGroupAnnounce: (senderDeviceId, payload) => {
      // Dispatch verified: announce valid, sender listed, context FOR us.
      void senderDeviceId;
      return applyDmPersonAnnounce(db, payload.announce);
    },
  };
}

// ---------------------------------------------------------------------------
// Receiver-side link materialization (P2)
// ---------------------------------------------------------------------------

function announceBeats(a: PersonGroupAnnounce, b: PersonGroupAnnounce): boolean {
  if (a.revision !== b.revision) return a.revision > b.revision;
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt;
  return a.derivedGroupId > b.derivedGroupId;
}

/**
 * Rebuild cm_person_links for one community from its verified announces. Per
 * DEVICE the winning announce is the highest (revision, updatedAt, derivedId),
 * so a secret rotation (which mints a NEW derived id) cleanly replaces the old
 * grouping instead of leaving a device in two persons.
 */
export function rebuildPersonLinksForCommunity(db: DatabaseAdapter, communityId: string): void {
  const rows = db.query<{ announce_json: string }>(
    `SELECT announce_json FROM ${PERSON_ANNOUNCE_TABLE} WHERE community_id = ?`,
    [communityId],
  );
  const verified: PersonGroupAnnounce[] = [];
  for (const row of rows) {
    const announce = personAnnounceFromRow({ announce_json: row.announce_json });
    if (!announce || !verifyPersonGroupAnnounce(announce)) continue;
    if (announce.context !== communityDerivationContext(communityId)) continue;
    verified.push(announce);
  }

  // An announce proves CO-SIGNATURE, not that derivedGroupId was really
  // derived from a group secret -- a receiver cannot check that without the
  // secret. So a hostile member can self-sign an announce claiming someone
  // else's derived id. When two announces claim ONE derived id with device
  // sets that do not overlap, we cannot tell which is genuine, so we group
  // NEITHER: the devices render ungrouped. Honest degradation, never a merge
  // of two different people into one row.
  const claimants = new Map<string, PersonGroupAnnounce[]>();
  for (const announce of verified) {
    const bucket = claimants.get(announce.derivedGroupId);
    if (bucket) bucket.push(announce);
    else claimants.set(announce.derivedGroupId, [announce]);
  }
  const contested = new Set<string>();
  for (const [derivedGroupId, group] of claimants) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = new Set(group[i]!.devices);
        if (!group[j]!.devices.some((d) => a.has(d))) {
          contested.add(derivedGroupId);
        }
      }
    }
  }

  const winners = new Map<string, PersonGroupAnnounce>();
  for (const announce of verified) {
    if (contested.has(announce.derivedGroupId)) continue;
    for (const deviceId of announce.devices) {
      const current = winners.get(deviceId);
      if (!current || announceBeats(announce, current)) winners.set(deviceId, announce);
    }
  }
  db.execute(`DELETE FROM ${PERSON_LINKS_TABLE} WHERE community_id = ?`, [communityId]);
  for (const [deviceId, announce] of winners) {
    db.execute(
      `INSERT OR REPLACE INTO ${PERSON_LINKS_TABLE}
         (id, community_id, derived_group_id, device_id, revision, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [`${communityId}:${deviceId}`, communityId, announce.derivedGroupId, deviceId,
        announce.revision, announce.updatedAt],
    );
  }
}

/** Apply a dispatch-verified DM-peer announce into the @dm link scope. */
export function applyDmPersonAnnounce(db: DatabaseAdapter, announce: PersonGroupAnnounce): boolean {
  if (!verifyPersonGroupAnnounce(announce)) return false;
  // Round-3 LOW-4: bind the SCOPE to the CONTEXT. The @dm scope may only ever
  // hold ids derived under a dm-peer context. Today the only caller is the
  // handler, which already checks this, but this function is exported: without
  // the check a future caller could file a COMMUNITY-derived id under @dm,
  // which is exactly the cross-scope confusion the derivation contexts exist
  // to prevent.
  if (!announce.context.startsWith(DM_PEER_CONTEXT_PREFIX)) return false;
  // A derived id claimed by two different device groups is CONTESTED, so
  // neither claim is written -- the same fail-closed rule the community path
  // uses. Mislabelling a DM as coming from someone else is the worst outcome
  // here, and rendering each device separately is the honest floor.
  const contested = new Set<string>();
  for (const deviceId of announce.devices) {
    const rival = db.query<{ derived_group_id: string }>(
      `SELECT derived_group_id FROM ${PERSON_LINKS_TABLE}
       WHERE community_id = ? AND device_id = ? AND derived_group_id <> ?`,
      [DM_PERSON_LINKS_SCOPE, deviceId, announce.derivedGroupId],
    )[0];
    if (rival) contested.add(deviceId);
  }
  for (const deviceId of announce.devices) {
    if (contested.has(deviceId)) continue;
    const existing = db.query<{ revision: number; updated_at: string }>(
      `SELECT revision, updated_at FROM ${PERSON_LINKS_TABLE}
       WHERE community_id = ? AND device_id = ?`,
      [DM_PERSON_LINKS_SCOPE, deviceId],
    )[0];
    if (existing) {
      const currentBeats = existing.revision > announce.revision
        || (existing.revision === announce.revision && existing.updated_at > announce.updatedAt);
      if (currentBeats) continue;
    }
    db.execute(
      `INSERT OR REPLACE INTO ${PERSON_LINKS_TABLE}
         (id, community_id, derived_group_id, device_id, revision, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [`${DM_PERSON_LINKS_SCOPE}:${deviceId}`, DM_PERSON_LINKS_SCOPE, announce.derivedGroupId,
        deviceId, announce.revision, announce.updatedAt],
    );
  }
  return true;
}

export interface PersonLinkRow {
  community_id: string;
  derived_group_id: string;
  device_id: string;
  revision: number;
  updated_at: string;
}

/** Verified device -> derived group rows for one community (or the @dm scope). */
export function readPersonLinks(db: DatabaseAdapter, communityId: string): PersonLinkRow[] {
  return db.query<PersonLinkRow>(
    `SELECT community_id, derived_group_id, device_id, revision, updated_at
     FROM ${PERSON_LINKS_TABLE} WHERE community_id = ?`,
    [communityId],
  );
}

void canonicalPersonGroupBytes;
void signPersonCanonicalBytes;
