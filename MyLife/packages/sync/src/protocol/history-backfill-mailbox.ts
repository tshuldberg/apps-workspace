/**
 * History-backfill request / grant mailbox payloads (community feed Phase 3).
 *
 * With NO community node, a member who joins late (or whose cm_messages fell
 * behind) reconstructs the feed from another MEMBER over the EXACT existing
 * pair-private mailbox path: the requester asks a peer to serve every channel
 * event after its local cursor; the peer serves the verified events back. Both
 * the "request" and the "grant" ride the same primitives as channel-mailbox.ts
 * and file-request-mailbox.ts VERBATIM: sealMailboxDelta to the recipient's
 * X25519 key, addressed by deriveMailboxToken(pairSecret, recipientDeviceId),
 * parked in the relay's TTL store-and-forward mailbox. So the relay sees only a
 * 64-hex token and a ciphertext size: no community id, no channel, no
 * identities, no kind tag ever crosses in the clear.
 *
 * Two new sealed payload kinds live INSIDE the box:
 *   HISTORY_REQUEST_MAILBOX_KIND -- requester -> server (a peer member); names a
 *     community/channel the requester is entitled to read and a cursor floor.
 *   HISTORY_GRANT_MAILBOX_KIND   -- server -> requester; carries the verified
 *     ChannelMessageEvent[] strictly after the cursor. The events are RAW signed
 *     events: the pair-private envelope provides confidentiality (the recipient
 *     is the entitled member), so no epoch key is needed, and the recipient
 *     re-verifies every event on apply.
 *
 * Verify-on-BOTH-sides (Critical): the SERVE side (buildHistoryBackfillHandlers
 * .historyRequest) gates the requester (revoked? active member? descriptor
 * exists?) and re-verifies + role-gates every event before sealing; the APPLY
 * side (.historyGrant) re-verifies every event again (mergeChannelMessageEvents
 * verifies) plus evaluateChannelPost per event before any row is written. A
 * tampered event is dropped fail-closed on either side. openHistoryGrant drops
 * the WHOLE grant if events[] is not an array of well-formed events.
 *
 * RN-safe: no Node crypto/fs. The DB query, the gates, and the park are injected
 * by the app (history-backfill-core.ts), mirroring file-request-mailbox.ts.
 */

import type { DeviceIdentity } from '../types';
import { sha512Hex } from '../node/hkdf';
import {
  verifyChannelMessage,
  type ChannelMessageAttachment,
  type ChannelMessageEvent,
} from './channel-message';
import {
  deriveMailboxToken,
  resolveMailboxSealClock,
  openMailboxDelta,
  sealMailboxDelta,
  type MailboxEnvelope,
} from './mailbox';

export const HISTORY_REQUEST_MAILBOX_KIND = 'meerkat.history-request-v1';
export const HISTORY_GRANT_MAILBOX_KIND = 'meerkat.history-grant-v1';

/** Cap on how many events a single grant carries (a serve-side guardrail). */
export const HISTORY_GRANT_MAX_EVENTS = 500;

/**
 * The cursor floor a request names. `sinceWall === null` means a FULL backfill
 * (the requester holds nothing for this channel); otherwise the server returns
 * only events strictly after (sinceWall, sinceCounter) in HLC order.
 */
export interface HistoryRequestFields {
  communityId: string;
  channelId: string;
  sinceWall: string | null;
  sinceCounter: number | null;
  /**
   * Content-derived id that correlates a grant to its request idempotently. A
   * single logical request (same requester, community, channel, cursor floor)
   * is stable; the caller mints it (see historyRequestId).
   */
  requestId: string;
}

export interface HistoryRequestMailboxPayload extends HistoryRequestFields {
  kind: typeof HISTORY_REQUEST_MAILBOX_KIND;
  version: 1;
}

export interface HistoryGrantMailboxPayload {
  kind: typeof HISTORY_GRANT_MAILBOX_KIND;
  version: 1;
  communityId: string;
  channelId: string;
  requestId: string;
  events: ChannelMessageEvent[];
}

export type HistoryMailboxRejectReason =
  | 'invalid_payload'
  | 'invalid_signature'
  | 'wrong_recipient'
  | 'decrypt_failed'
  | 'malformed';

// ---------------------------------------------------------------------------
// requestId derivation (stable per logical request)
// ---------------------------------------------------------------------------

/**
 * A stable request id. Reusing the same inputs (same requester, same channel,
 * same cursor floor) yields the same id, so retries are idempotent and a grant
 * always correlates back to its request. The requesterDeviceId is included so
 * two members requesting the same channel get distinct ids.
 */
export function historyRequestId(
  fields: Omit<HistoryRequestFields, 'requestId'>,
  requesterDeviceId: string,
): string {
  const canonical = JSON.stringify([
    'meerkat-history-request-id-v1',
    fields.communityId,
    fields.channelId,
    fields.sinceWall,
    fields.sinceCounter,
    requesterDeviceId,
  ]);
  return sha512Hex(new TextEncoder().encode(canonical)).slice(0, 32);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasRequestFields(value: Record<string, unknown>): boolean {
  return typeof value.communityId === 'string'
    && typeof value.channelId === 'string'
    && (value.sinceWall === null || typeof value.sinceWall === 'string')
    && (value.sinceCounter === null || Number.isInteger(value.sinceCounter))
    // sinceWall and sinceCounter are paired: both null (full) or both set.
    && (value.sinceWall === null) === (value.sinceCounter === null)
    && typeof value.requestId === 'string'
    && value.requestId.length > 0;
}

function readRequestFields(value: Record<string, unknown>): HistoryRequestFields {
  return {
    communityId: value.communityId as string,
    channelId: value.channelId as string,
    sinceWall: (value.sinceWall as string | null) ?? null,
    sinceCounter: (value.sinceCounter as number | null) ?? null,
    requestId: value.requestId as string,
  };
}

function isAttachment(value: unknown): value is ChannelMessageAttachment {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && typeof value.blobHash === 'string'
    && typeof value.name === 'string'
    && typeof value.mimeType === 'string'
    && typeof value.size === 'number';
}

/**
 * A structural well-formedness check for one ChannelMessageEvent. This is the
 * SHAPE gate only: cryptographic verification (verifyChannelMessage) happens on
 * both the serve side and the apply side, never here. A grant whose events[] is
 * not an array of well-formed events is dropped WHOLE (open returns invalid).
 */
function isChannelMessageEventShape(value: unknown): value is ChannelMessageEvent {
  if (!isRecord(value)) return false;
  if (value.version !== 1) return false;
  if (typeof value.id !== 'string' || value.id.length === 0) return false;
  if (typeof value.communityId !== 'string') return false;
  if (typeof value.channelId !== 'string') return false;
  if (typeof value.authorDeviceId !== 'string') return false;
  if (typeof value.body !== 'string') return false;
  if (!isRecord(value.hlc)) return false;
  if (typeof (value.hlc as Record<string, unknown>).wall !== 'string') return false;
  if (!Number.isInteger((value.hlc as Record<string, unknown>).counter)) return false;
  if (typeof value.signature !== 'string' || value.signature.length === 0) return false;
  if (value.attachments !== undefined) {
    if (!Array.isArray(value.attachments) || !value.attachments.every(isAttachment)) return false;
  }
  if (value.supersedes !== undefined) {
    const s = value.supersedes;
    if (!isRecord(s) || typeof s.id !== 'string' || typeof s.deleted !== 'boolean') return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// HISTORY_REQUEST: requester -> server (a peer member)
// ---------------------------------------------------------------------------

export interface SealHistoryRequestInput {
  /** The requester (this device). */
  sender: DeviceIdentity;
  /** The peer member this is addressed to (the would-be server). */
  recipient: { deviceId: string; dhPublicKey: string };
  /** The pairing shared secret between the two devices (hex). */
  pairSharedSecretHex: string;
  fields: HistoryRequestFields;
  now?: string;
}

export interface SealHistoryRequestResult {
  token: string;
  envelope: MailboxEnvelope;
  payload: HistoryRequestMailboxPayload;
}

export function sealHistoryRequestMailbox(
  input: SealHistoryRequestInput,
): SealHistoryRequestResult {
  const payload: HistoryRequestMailboxPayload = {
    kind: HISTORY_REQUEST_MAILBOX_KIND,
    version: 1,
    communityId: input.fields.communityId,
    channelId: input.fields.channelId,
    sinceWall: input.fields.sinceWall,
    sinceCounter: input.fields.sinceCounter,
    requestId: input.fields.requestId,
  };
  const clock = resolveMailboxSealClock(input.now);
  const token = deriveMailboxToken(
    input.pairSharedSecretHex,
    input.recipient.deviceId,
    clock.nowMs,
  );
  const envelope = sealMailboxDelta(input.sender, input.recipient, payload, clock.nowIso);
  return { token, envelope, payload };
}

export type OpenHistoryRequestResult =
  | {
      ok: true;
      senderDeviceId: string;
      createdAt: string;
      payload: HistoryRequestMailboxPayload;
    }
  | { ok: false; reason: HistoryMailboxRejectReason };

export function openHistoryRequestMailbox(
  recipient: DeviceIdentity,
  envelope: MailboxEnvelope,
): OpenHistoryRequestResult {
  const opened = openMailboxDelta<unknown>(recipient, envelope);
  if (!opened.ok) return opened;

  const payload = opened.payload;
  if (
    !isRecord(payload)
    || payload.kind !== HISTORY_REQUEST_MAILBOX_KIND
    || payload.version !== 1
    || !hasRequestFields(payload)
  ) {
    return { ok: false, reason: 'invalid_payload' };
  }

  return {
    ok: true,
    senderDeviceId: opened.senderDeviceId,
    createdAt: opened.createdAt,
    payload: { kind: HISTORY_REQUEST_MAILBOX_KIND, version: 1, ...readRequestFields(payload) },
  };
}

// ---------------------------------------------------------------------------
// HISTORY_GRANT: server -> requester
// ---------------------------------------------------------------------------

export interface SealHistoryGrantInput {
  /** The server (this device). */
  sender: DeviceIdentity;
  /** The requester this grant is addressed back to. */
  recipient: { deviceId: string; dhPublicKey: string };
  pairSharedSecretHex: string;
  payload: HistoryGrantMailboxPayload;
  now?: string;
}

export interface SealHistoryGrantResult {
  token: string;
  envelope: MailboxEnvelope;
  payload: HistoryGrantMailboxPayload;
}

export function sealHistoryGrantMailbox(input: SealHistoryGrantInput): SealHistoryGrantResult {
  const clock = resolveMailboxSealClock(input.now);
  const token = deriveMailboxToken(
    input.pairSharedSecretHex,
    input.recipient.deviceId,
    clock.nowMs,
  );
  const envelope = sealMailboxDelta(input.sender, input.recipient, input.payload, clock.nowIso);
  return { token, envelope, payload: input.payload };
}

export type OpenHistoryGrantResult =
  | {
      ok: true;
      senderDeviceId: string;
      createdAt: string;
      payload: HistoryGrantMailboxPayload;
    }
  | { ok: false; reason: HistoryMailboxRejectReason };

export function openHistoryGrantMailbox(
  recipient: DeviceIdentity,
  envelope: MailboxEnvelope,
): OpenHistoryGrantResult {
  const opened = openMailboxDelta<unknown>(recipient, envelope);
  if (!opened.ok) return opened;

  const payload = opened.payload;
  if (
    !isRecord(payload)
    || payload.kind !== HISTORY_GRANT_MAILBOX_KIND
    || payload.version !== 1
    || typeof payload.communityId !== 'string'
    || typeof payload.channelId !== 'string'
    || typeof payload.requestId !== 'string'
    || payload.requestId.length === 0
  ) {
    return { ok: false, reason: 'invalid_payload' };
  }

  // Drop the WHOLE grant if events[] is not an array of well-formed events. The
  // shape gate is structural; cryptographic re-verification still happens on
  // apply (mergeChannelMessageEvents) and is also enforced by the serve side.
  if (!Array.isArray(payload.events) || !payload.events.every(isChannelMessageEventShape)) {
    return { ok: false, reason: 'invalid_payload' };
  }

  return {
    ok: true,
    senderDeviceId: opened.senderDeviceId,
    createdAt: opened.createdAt,
    payload: {
      kind: HISTORY_GRANT_MAILBOX_KIND,
      version: 1,
      communityId: payload.communityId,
      channelId: payload.channelId,
      requestId: payload.requestId,
      events: payload.events as ChannelMessageEvent[],
    },
  };
}

// ---------------------------------------------------------------------------
// Cursor helpers (pure)
// ---------------------------------------------------------------------------

/**
 * Whether an event's HLC is strictly after the (sinceWall, sinceCounter) floor.
 * A null floor (full backfill) matches everything. Used by the SERVE side to
 * pick which events to send back.
 */
export function isAfterCursor(
  event: ChannelMessageEvent,
  sinceWall: string | null,
  sinceCounter: number | null,
): boolean {
  if (sinceWall === null || sinceCounter === null) return true;
  if (event.hlc.wall !== sinceWall) return event.hlc.wall > sinceWall;
  return event.hlc.counter > sinceCounter;
}

/**
 * Re-verify (signature) + structurally re-check a candidate event before it is
 * served. Pure defense in depth so the serve side never sends an unverifiable
 * event even if a corrupt row sneaks into the local store. The role/membership
 * gate (evaluateChannelPost) is applied by the caller, which holds the
 * descriptor.
 */
export function isServableEvent(event: ChannelMessageEvent): boolean {
  return isChannelMessageEventShape(event) && verifyChannelMessage(event);
}
