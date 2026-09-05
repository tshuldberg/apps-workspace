/**
 * Apply-time inbound row validators (Plan 38 Phase 0, Codex amendment 3).
 *
 * The generic inbound path validates module/scope/channel policy and then
 * generic-inserts a row. For OWNER-SIGNED row types that is not enough: a
 * forged row would land in the table and rely on read-time verification to
 * stay invisible. This registry lets applyReceivedDocumentChanges verify a
 * table's rows BEFORE insert, so a forge never lands at all. Read-time
 * verification remains the rendering floor (defense in depth), unchanged.
 *
 * Posture:
 * - Unregistered tables pass through untouched (existing behavior).
 * - A registered table's INSERT/UPDATE must parse AND verify; anything else
 *   is rejected + audited (fail-closed).
 * - A registered table REJECTS raw DELETEs: the protocol's delete mechanism
 *   for owner-signed rows is the SIGNED tombstone event, so an unsigned
 *   engine-level DELETE from any peer is a defacement vector, not a sync.
 * - An identity row for a community this device does not hold fails CLOSED
 *   (`identity_community_unknown`): without the descriptor there is no owner
 *   to verify against. The row arrives again on a later session once the
 *   descriptor has landed.
 */

import type { DatabaseAdapter } from '@mylife/db';
import { evaluateChannelPost, getCommunity } from './community';
import {
  COMMUNITY_IDENTITY_TABLE,
  communityIdentityEventFromRow,
  verifyCommunityIdentityEvent,
} from './community-identity';
import {
  COMMUNITY_LAYOUT_TABLE,
  communityLayoutEventFromRow,
  verifyCommunityLayoutEvent,
} from './community-layout';
import { COMMUNITY_BADGES_TABLE, validateBadgeRow } from './community-badges';
import { COMMUNITY_ASSET_PACKS_TABLE, validateAssetPackRow } from './community-asset-packs';
import {
  COMMUNITY_CANVAS_MARKS_TABLE,
  COMMUNITY_CANVAS_PIXELS_TABLE,
  validateCanvasPixelRow,
  COMMUNITY_CANVAS_NODES_TABLE,
  COMMUNITY_CANVAS_STROKES_TABLE,
  COMMUNITY_CANVAS_TABLE,
  validateCanvasMarkRow,
  validateCanvasNodeRow,
  validateCanvasRow,
  validateCanvasStrokeRow,
} from './community-canvas';
import {
  CHANNEL_MESSAGE_TABLE,
  channelMessageEventFromRow,
  verifyChannelMessage,
} from './channel-message';
import {
  PERSON_ANNOUNCE_TABLE,
  PERSON_GROUP_TABLE,
  PRESENTATION_PROFILE_TABLE,
  validatePersonAnnounceRow,
  validatePersonGroupRow,
  validatePresentationProfileRow,
} from './person-group-rows';

export type InboundRowVerdict = { ok: true } | { ok: false; reason: string };

export interface InboundRowChange {
  table: string;
  rowId: string;
  operation: string;
  data: Record<string, unknown> | null | undefined;
}

type RowValidator = (db: DatabaseAdapter, change: InboundRowChange) => InboundRowVerdict;

function validateCommunityIdentityRow(db: DatabaseAdapter, change: InboundRowChange): InboundRowVerdict {
  if (!change.data) return { ok: false, reason: 'identity_row_malformed' };
  const event = communityIdentityEventFromRow(change.data);
  if (!event) return { ok: false, reason: 'identity_row_malformed' };
  const community = getCommunity(db, event.communityId);
  if (!community) return { ok: false, reason: 'identity_community_unknown' };
  if (!verifyCommunityIdentityEvent(event, community.descriptor.ownerDeviceId)) {
    return { ok: false, reason: 'identity_signature_invalid' };
  }
  return { ok: true };
}

/**
 * A cm_messages row is an author-SIGNED channel event. The transport peer of a
 * device-scoped session is NOT the author (one session carries every
 * community's rows), so the channel-post gate must run against the row's OWN
 * signed author, never context.remoteDeviceId (AM3). Reconstruct the event,
 * verify its signature, resolve the row's community per-row, then apply the
 * signed descriptor's posting rules. Fail-closed: a malformed row, a bad
 * signature, an unknown community (no descriptor => no owner to authorize
 * against; it re-arrives once the descriptor lands), or a role/channel denial
 * all reject before any write.
 */
/**
 * A cm_layout row is an OWNER-signed composition document (composition plan
 * 2.2). Same posture as the identity row: reconstruct, resolve the community,
 * verify against the descriptor's owner. A forged layout (a member trying to
 * re-compose the community) dies before INSERT; an unknown community fails
 * closed and the row re-arrives once the descriptor has landed.
 */
function validateCommunityLayoutRow(db: DatabaseAdapter, change: InboundRowChange): InboundRowVerdict {
  if (!change.data) return { ok: false, reason: 'layout_row_malformed' };
  const event = communityLayoutEventFromRow(change.data);
  if (!event) return { ok: false, reason: 'layout_row_malformed' };
  const community = getCommunity(db, event.communityId);
  if (!community) return { ok: false, reason: 'layout_community_unknown' };
  if (!verifyCommunityLayoutEvent(event, community.descriptor.ownerDeviceId)) {
    return { ok: false, reason: 'layout_signature_invalid' };
  }
  return { ok: true };
}

function validateChannelMessageRow(db: DatabaseAdapter, change: InboundRowChange): InboundRowVerdict {
  if (!change.data) return { ok: false, reason: 'channel_message_malformed' };
  const event = channelMessageEventFromRow(change.data);
  if (!event) return { ok: false, reason: 'channel_message_malformed' };
  if (!verifyChannelMessage(event)) return { ok: false, reason: 'channel_message_signature_invalid' };
  const community = getCommunity(db, event.communityId);
  if (!community) return { ok: false, reason: 'channel_message_community_unknown' };
  const verdict = evaluateChannelPost(community.descriptor, event.authorDeviceId, event.channelId);
  if (!verdict.allowed) return { ok: false, reason: verdict.reason };
  return { ok: true };
}

/**
 * Registered owner-signed tables. Plan 38 later phases add cm_libraries and
 * the smart-collection rule table here; each entry needs forge-rejection
 * tests at apply time.
 */
const SIGNED_ROW_VALIDATORS: Record<string, RowValidator> = {
  [COMMUNITY_IDENTITY_TABLE]: validateCommunityIdentityRow,
  // Composition plan 2.2: the owner-signed layout document.
  [COMMUNITY_LAYOUT_TABLE]: validateCommunityLayoutRow,
  // Plan 56 C1: the Canvas layer. Every canvas/node/stroke/mark row is
  // signature-verified, role/layer-gated, and cap/rate-checked before INSERT
  // (community-canvas.ts); deletion is tombstone events only.
  [COMMUNITY_CANVAS_TABLE]: validateCanvasRow,
  [COMMUNITY_CANVAS_NODES_TABLE]: validateCanvasNodeRow,
  [COMMUNITY_CANVAS_STROKES_TABLE]: validateCanvasStrokeRow,
  [COMMUNITY_CANVAS_MARKS_TABLE]: validateCanvasMarkRow,
  [COMMUNITY_CANVAS_PIXELS_TABLE]: validateCanvasPixelRow,
  // Plan 56 C2: owner-minted badges + curator awards (verifiable scarcity).
  [COMMUNITY_BADGES_TABLE]: validateBadgeRow,
  [COMMUNITY_ASSET_PACKS_TABLE]: validateAssetPackRow,
  [CHANNEL_MESSAGE_TABLE]: validateChannelMessageRow,
  // Plan 52: person-identity rows are mutually attested / merge-ordered; a
  // forged, stale, or spliced row is rejected before insert (person-group-rows).
  [PERSON_GROUP_TABLE]: validatePersonGroupRow,
  [PRESENTATION_PROFILE_TABLE]: validatePresentationProfileRow,
  [PERSON_ANNOUNCE_TABLE]: validatePersonAnnounceRow,
};

/** Is this table's inbound path signature-gated at apply time? */
export function isSignedRowTable(table: string): boolean {
  return Object.prototype.hasOwnProperty.call(SIGNED_ROW_VALIDATORS, table);
}

/**
 * Verdict for one inbound change. Called by applyReceivedDocumentChanges
 * after policy + channel gates, before any write.
 */
export function validateSignedInboundRow(
  db: DatabaseAdapter,
  change: InboundRowChange,
): InboundRowVerdict {
  const validator = SIGNED_ROW_VALIDATORS[change.table];
  if (!validator) return { ok: true };
  if (change.operation === 'DELETE') {
    return { ok: false, reason: 'signed_row_delete_rejected' };
  }
  return validator(db, change);
}
