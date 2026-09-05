/**
 * Plan 52 storage row codecs + apply-time validators for the person-identity
 * tables. The pure protocol lives in person-group.ts; this file owns the row
 * shapes the engine replicates and the fail-closed inbound gates:
 *
 *  - pi_person_group (personal_replica): ONE row (id 'self') holding the
 *    mutually attested group doc + the group secret. Inbound acceptance runs
 *    the full acceptPersonGroupRevision order, so a stale or forged doc is
 *    rejected BEFORE insert and a removed device can never be resurrected by
 *    replaying an old row. The secret never leaves personal_replica scope
 *    (maxScope caps it) and never appears in any log line.
 *  - pi_presentation_profile (personal_replica): ONE row (id 'self') holding
 *    the person's presentation profile. Inbound accepts only a profile that
 *    WINS the deterministic merge against the stored row.
 *  - cm_person_announces (shared_workspace): per-community membership proofs.
 *    Inbound requires the announce to verify (every listed device's signature
 *    over the canonical bytes), to be FOR the carrying community, and every
 *    listed device to be an active member of that community. Verification
 *    failure renders as ungrouped devices -- never a fabricated group.
 *  - cm_person_links (device_local): the receiver-side materialization of
 *    verified announces. Never replicates; no validator needed.
 */

import type { DatabaseAdapter } from '@mylife/db';
import { getCommunity } from './community';
import {
  acceptPersonGroupRevision,
  communityDerivationContext,
  personAnnounceRowKey,
  isValidPresentationProfile,
  mergePresentationProfiles,
  presentationProfileHash,
  verifyPersonGroupAnnounce,
  type PersonGroupAnnounce,
  type PersonGroupDoc,
  type PresentationProfile,
} from './person-group';

export const PERSON_GROUP_TABLE = 'pi_person_group';
export const PRESENTATION_PROFILE_TABLE = 'pi_presentation_profile';
export const PERSON_ANNOUNCE_TABLE = 'cm_person_announces';
export const PERSON_LINKS_TABLE = 'cm_person_links';

/** The single-row id for both pi_ tables (one person per device). */
export const PERSON_SELF_ROW_ID = 'self';

export interface PersonGroupRow {
  id: string;
  group_id: string;
  revision: number;
  doc_json: string;
  secret_hex: string;
  updated_at: string;
}

export interface PresentationProfileRow {
  id: string;
  revision: number;
  profile_json: string;
  updated_at: string;
}

export interface PersonAnnounceRow {
  id: string;
  community_id: string;
  derived_group_id: string;
  revision: number;
  announce_json: string;
  updated_at: string;
}

export function personGroupRowFromDoc(
  doc: PersonGroupDoc,
  secretHex: string,
): PersonGroupRow {
  return {
    id: PERSON_SELF_ROW_ID,
    group_id: doc.groupId,
    revision: doc.revision,
    doc_json: JSON.stringify(doc),
    secret_hex: secretHex,
    updated_at: doc.updatedAt,
  };
}

export function personGroupDocFromRow(row: Record<string, unknown>): PersonGroupDoc | null {
  if (typeof row.doc_json !== 'string') return null;
  try {
    return JSON.parse(row.doc_json) as PersonGroupDoc;
  } catch {
    return null;
  }
}

export function presentationProfileRowFromProfile(profile: PresentationProfile): PresentationProfileRow {
  return {
    id: PERSON_SELF_ROW_ID,
    revision: profile.revision,
    profile_json: JSON.stringify(profile),
    updated_at: profile.updatedAt,
  };
}

export function presentationProfileFromRow(row: Record<string, unknown>): PresentationProfile | null {
  if (typeof row.profile_json !== 'string') return null;
  try {
    const parsed = JSON.parse(row.profile_json) as PresentationProfile;
    return isValidPresentationProfile(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function personAnnounceRowFromAnnounce(
  announce: PersonGroupAnnounce,
  communityId: string,
): PersonAnnounceRow {
  return {
    // One row per (community, DEVICE SET). Deliberately NOT keyed on the
    // derivedGroupId, which is attacker-choosable: see personAnnounceRowKey.
    // A person re-announcing the same device set replaces its own row; a
    // squatter claiming someone else's derived id lands on its own row and
    // displaces nobody.
    id: personAnnounceRowKey(communityId, announce.devices),
    community_id: communityId,
    derived_group_id: announce.derivedGroupId,
    revision: announce.revision,
    announce_json: JSON.stringify(announce),
    updated_at: announce.updatedAt,
  };
}

export function personAnnounceFromRow(row: Record<string, unknown>): PersonGroupAnnounce | null {
  if (typeof row.announce_json !== 'string') return null;
  try {
    return JSON.parse(row.announce_json) as PersonGroupAnnounce;
  } catch {
    return null;
  }
}

type Verdict = { ok: true } | { ok: false; reason: string };

interface RowChange {
  table: string;
  rowId: string;
  operation: string;
  data: Record<string, unknown> | null | undefined;
}

/**
 * pi_person_group inbound gate. Runs the FULL acceptance order against the
 * stored row: structure + every member signature + group continuity +
 * monotonic revision. A replayed stale row (removed-device resurrection) and
 * a doc for a different group are both rejected before any write.
 */
export function validatePersonGroupRow(db: DatabaseAdapter, change: RowChange): Verdict {
  if (!change.data) return { ok: false, reason: 'person_group_malformed' };
  if (change.rowId !== PERSON_SELF_ROW_ID) return { ok: false, reason: 'person_group_bad_row_id' };
  const incoming = personGroupDocFromRow(change.data);
  if (!incoming) return { ok: false, reason: 'person_group_malformed' };
  const secret = change.data.secret_hex;
  if (typeof secret !== 'string' || !/^[0-9a-f]{64}$/.test(secret)) {
    return { ok: false, reason: 'person_group_bad_secret' };
  }
  // HIGH-1: bind EVERY denormalized column to the signed document, including
  // updated_at. The engine's generic LWW guard (hasNewerLocalVersion) string-
  // compares the raw updated_at COLUMN after this validator and silently skips
  // the write on a "newer" value -- so an unbound column lets a compromised
  // sibling pin a poisoned far-future timestamp and freeze its own expulsion,
  // with no audit row. Binding it makes the column exactly as trustworthy as
  // the signature over it.
  if (
    change.data.group_id !== incoming.groupId
    || change.data.revision !== incoming.revision
    || change.data.updated_at !== incoming.updatedAt
  ) {
    return { ok: false, reason: 'person_group_row_mismatch' };
  }
  const storedRows = db.query<{ doc_json: string }>(
    `SELECT doc_json FROM ${PERSON_GROUP_TABLE} WHERE id = ?`,
    [PERSON_SELF_ROW_ID],
  );
  let stored: PersonGroupDoc | null = null;
  if (storedRows[0]) {
    stored = personGroupDocFromRow(storedRows[0] as unknown as Record<string, unknown>);
  }
  const result = acceptPersonGroupRevision(stored, incoming);
  if (!result.accepted) return { ok: false, reason: `person_group_${result.reason}` };
  return { ok: true };
}

/**
 * pi_presentation_profile inbound gate: structural validity plus a WIN in the
 * deterministic merge against the stored profile, so an older (or equal but
 * ordered-lower) profile can never clobber a newer one.
 */
export function validatePresentationProfileRow(db: DatabaseAdapter, change: RowChange): Verdict {
  if (!change.data) return { ok: false, reason: 'presentation_profile_malformed' };
  if (change.rowId !== PERSON_SELF_ROW_ID) {
    return { ok: false, reason: 'presentation_profile_bad_row_id' };
  }
  const incoming = presentationProfileFromRow(change.data);
  if (!incoming) return { ok: false, reason: 'presentation_profile_malformed' };
  // HIGH-1: bind the ordering columns to the profile they describe.
  if (
    change.data.revision !== incoming.revision
    || change.data.updated_at !== incoming.updatedAt
  ) {
    return { ok: false, reason: 'presentation_profile_row_mismatch' };
  }
  const storedRows = db.query<{ profile_json: string }>(
    `SELECT profile_json FROM ${PRESENTATION_PROFILE_TABLE} WHERE id = ?`,
    [PERSON_SELF_ROW_ID],
  );
  if (storedRows[0]) {
    const stored = presentationProfileFromRow(storedRows[0] as unknown as Record<string, unknown>);
    if (stored) {
      const winner = mergePresentationProfiles(stored, incoming);
      const incomingWins =
        winner === incoming
        || presentationProfileHash(winner) === presentationProfileHash(incoming);
      const identical = presentationProfileHash(stored) === presentationProfileHash(incoming);
      if (!incomingWins || identical) {
        return { ok: false, reason: 'presentation_profile_not_newer' };
      }
    }
  }
  return { ok: true };
}

/**
 * cm_person_announces inbound gate: the announce must verify (mutual member
 * signatures over the canonical bytes), be derived FOR the carrying community,
 * carry a consistent row shape, and list only active members of that
 * community. An announce for a community this device does not hold fails
 * closed and re-arrives after the descriptor lands (identity precedent).
 */
export function validatePersonAnnounceRow(db: DatabaseAdapter, change: RowChange): Verdict {
  if (!change.data) return { ok: false, reason: 'person_announce_malformed' };
  const announce = personAnnounceFromRow(change.data);
  if (!announce) return { ok: false, reason: 'person_announce_malformed' };
  const communityId = change.data.community_id;
  if (typeof communityId !== 'string' || !communityId) {
    return { ok: false, reason: 'person_announce_malformed' };
  }
  if (!verifyPersonGroupAnnounce(announce)) {
    return { ok: false, reason: 'person_announce_signature_invalid' };
  }
  if (announce.context !== communityDerivationContext(communityId)) {
    return { ok: false, reason: 'person_announce_context_mismatch' };
  }
  // HIGH-1: bind every denormalized column, including updated_at. cm_person_
  // announces is shared_workspace, so a hostile member can rewrite a verified
  // row; an unbound updated_at let them replay it with a far-future value and
  // permanently freeze that person's device list on every device in the
  // community (the engine's LWW guard drops every later announce).
  if (
    change.data.derived_group_id !== announce.derivedGroupId
    || change.data.revision !== announce.revision
    || change.data.updated_at !== announce.updatedAt
    || change.rowId !== personAnnounceRowKey(communityId, announce.devices)
  ) {
    return { ok: false, reason: 'person_announce_row_mismatch' };
  }
  const community = getCommunity(db, communityId);
  if (!community) return { ok: false, reason: 'person_announce_community_unknown' };
  // Removal FILTERS a device out of the signed descriptor's member list, so
  // presence in members IS active membership.
  const active = new Set(community.descriptor.members.map((m) => m.deviceId));
  for (const deviceId of announce.devices) {
    if (!active.has(deviceId)) return { ok: false, reason: 'person_announce_member_unknown' };
  }
  // Monotonic per DEVICE SET: a replayed older announce for the same devices
  // cannot regress that person's proof. Because the key is the device set, a
  // foreign announce can never outrank someone else's row.
  const storedRows = db.query<{ revision: number }>(
    `SELECT revision FROM ${PERSON_ANNOUNCE_TABLE} WHERE id = ?`,
    [change.rowId],
  );
  if (storedRows[0] && announce.revision <= storedRows[0].revision) {
    // <= not <: an equal-revision replay is never NEW information, and it is
    // the delivery vehicle for a poisoned-column rewrite.
    return { ok: false, reason: 'person_announce_stale_revision' };
  }
  return { ok: true };
}
