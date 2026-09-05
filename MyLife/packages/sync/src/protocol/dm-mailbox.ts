/**
 * 1:1 DM mailbox (Plan 21 Phase 1).
 *
 * A private message to a peer parks a SEALED delta in the peer's pair-private
 * mailbox exactly like channel-mailbox.ts / file-request-mailbox.ts: sealed to
 * each recipient device's X25519 key, signed by the sender, addressed by
 * deriveMailboxToken(pairSecret, recipientDeviceId). A peer with more than one
 * device is a SET of recipients; sealDmDirect fans ONE sealMailboxDelta envelope
 * per device, each under that device's own pair-private token, so the relay sees
 * only a 64-hex token and a ciphertext size (no device ids, no conversation id,
 * no kind tag, no body).
 *
 * This is the PURE protocol layer. Sealing a delta does NOT mean it was
 * delivered: a 'delivered' receipt (dm-receipt.ts) is emitted only after a real
 * merge on the recipient, and a 'read' only on real render -- both provider-layer
 * concerns (Phase 4), never fabricated here.
 *
 * RN-safe: reuses the SHIPPED mailbox + dm-message primitives verbatim; no new
 * crypto and no Node built-ins at import.
 */

import type { DeviceIdentity } from '../types';
import type { BlobDataPayload } from './blob-transfer';
import { bytesToHex, hexToBytes } from '../encryption/keys';
import { decrypt, encrypt } from '../encryption/encrypt';
import { deriveEpochContentKey } from './group-keys';
import {
  compareDmMessages,
  verifyDmMessage,
  type DmMessageEvent,
} from './dm-message';
import {
  deriveMailboxToken,
  resolveMailboxSealClock,
  openMailboxDelta,
  sealMailboxDelta,
  type MailboxEnvelope,
} from './mailbox';

export const DM_MESSAGE_MAILBOX_KIND = 'meerkat.dm-message-v1';

/**
 * The sealed 1:1 delta. `mode: 'direct'` discriminates it from a future group
 * variant so the two can never be confused; `blocks` carries the 16 KiB blob
 * blocks for any attachments referenced by the events (same format as the live
 * blob phase), reassembled + hash-verified on the recipient.
 */
export interface DmDirectMailboxPayload {
  kind: typeof DM_MESSAGE_MAILBOX_KIND;
  version: 1;
  mode: 'direct';
  conversationId: string;
  events: DmMessageEvent[];
  blocks?: BlobDataPayload[];
}

/** A single recipient device: its id, DH key, and the pair-private secret. */
export interface DmDirectRecipient {
  deviceId: string;
  dhPublicKey: string;
  /** The pairing shared secret between this device and the sender (hex). */
  pairSecret: string;
}

export interface SealDmDirectInput {
  sender: DeviceIdentity;
  conversationId: string;
  events: readonly DmMessageEvent[];
  /** Every device that should receive this delta. One envelope is sealed per device. */
  recipients: readonly DmDirectRecipient[];
  /** Optional attachment blob blocks referenced by the events. */
  blocks?: readonly BlobDataPayload[];
  now?: string;
}

/** One sealed envelope, addressed to one device by its pair-private token. */
export interface SealedDmDirectEnvelope {
  recipientDeviceId: string;
  token: string;
  envelope: MailboxEnvelope;
}

export type DmMailboxBuildRejectReason =
  | 'empty'
  | 'invalid_event'
  | 'conversation_mismatch'
  | 'no_recipients';

export type SealDmDirectResult =
  | {
      ok: true;
      payload: DmDirectMailboxPayload;
      sealed: SealedDmDirectEnvelope[];
      eventCount: number;
    }
  | { ok: false; reason: DmMailboxBuildRejectReason };

export type DmMailboxRejectReason =
  | DmMailboxBuildRejectReason
  | 'invalid_payload'
  | 'invalid_signature'
  | 'wrong_recipient'
  | 'decrypt_failed'
  | 'malformed';

export type OpenDmMailboxResult =
  | {
      ok: true;
      senderDeviceId: string;
      createdAt: string;
      payload: DmDirectMailboxPayload;
      events: DmMessageEvent[];
      blocks: BlobDataPayload[];
    }
  | { ok: false; reason: DmMailboxRejectReason };

type NormalizeResult =
  | { ok: true; events: DmMessageEvent[] }
  | { ok: false; reason: DmMailboxBuildRejectReason };

function normalizeDmEvents(
  events: readonly DmMessageEvent[],
  conversationId: string,
): NormalizeResult {
  if (events.length === 0) return { ok: false, reason: 'empty' };

  const byId = new Map<string, DmMessageEvent>();
  for (const event of events) {
    if (event.conversationId !== conversationId) {
      return { ok: false, reason: 'conversation_mismatch' };
    }
    if (!verifyDmMessage(event)) {
      return { ok: false, reason: 'invalid_event' };
    }
    if (!byId.has(event.id)) byId.set(event.id, event);
  }

  return { ok: true, events: [...byId.values()].sort(compareDmMessages) };
}

/**
 * Seal a DM delta for every recipient device. Rejects (never seals) an empty
 * delta, an event for another conversation, an unverifiable event, or an empty
 * recipient set.
 */
export function sealDmDirect(input: SealDmDirectInput): SealDmDirectResult {
  if (input.recipients.length === 0) return { ok: false, reason: 'no_recipients' };

  const normalized = normalizeDmEvents(input.events, input.conversationId);
  if (!normalized.ok) return normalized;

  const payload: DmDirectMailboxPayload = {
    kind: DM_MESSAGE_MAILBOX_KIND,
    version: 1,
    mode: 'direct',
    conversationId: input.conversationId,
    events: normalized.events,
    ...(input.blocks && input.blocks.length > 0 ? { blocks: [...input.blocks] } : {}),
  };

  const clock = resolveMailboxSealClock(input.now);
  const sealed = input.recipients.map<SealedDmDirectEnvelope>((recipient) => ({
    recipientDeviceId: recipient.deviceId,
    token: deriveMailboxToken(recipient.pairSecret, recipient.deviceId, clock.nowMs),
    envelope: sealMailboxDelta(
      input.sender,
      { deviceId: recipient.deviceId, dhPublicKey: recipient.dhPublicKey },
      payload,
      clock.nowIso,
    ),
  }));

  return { ok: true, payload, sealed, eventCount: payload.events.length };
}

/**
 * Open a sealed DM delta: decrypt with our DH key, verify the sender's
 * signature, then re-verify every carried DmMessageEvent. Fail-closed on any
 * tamper, forgery, misdelivery, or wrong kind -- nothing is returned unverified.
 */
export function openDmMailbox(
  recipient: DeviceIdentity,
  envelope: MailboxEnvelope,
): OpenDmMailboxResult {
  const opened = openMailboxDelta<unknown>(recipient, envelope);
  if (!opened.ok) return opened;

  const parsed = parseDmMailboxPayload(opened.payload);
  if (!parsed.ok) return parsed;

  return {
    ok: true,
    senderDeviceId: opened.senderDeviceId,
    createdAt: opened.createdAt,
    payload: parsed.payload,
    events: parsed.payload.events,
    blocks: parsed.payload.blocks ?? [],
  };
}

function parseDmMailboxPayload(
  payload: unknown,
): { ok: true; payload: DmDirectMailboxPayload } | { ok: false; reason: DmMailboxRejectReason } {
  if (!isRecord(payload)) return { ok: false, reason: 'invalid_payload' };
  if (
    payload.kind !== DM_MESSAGE_MAILBOX_KIND
    || payload.version !== 1
    || payload.mode !== 'direct'
    || typeof payload.conversationId !== 'string'
    || !Array.isArray(payload.events)
  ) {
    return { ok: false, reason: 'invalid_payload' };
  }
  if (!payload.events.every(isDmMessageEvent)) {
    return { ok: false, reason: 'invalid_payload' };
  }

  const blocks = payload.blocks;
  if (blocks !== undefined && (!Array.isArray(blocks) || !blocks.every(isBlobDataPayload))) {
    return { ok: false, reason: 'invalid_payload' };
  }

  const normalized = normalizeDmEvents(payload.events, payload.conversationId);
  if (!normalized.ok) return normalized;

  return {
    ok: true,
    payload: {
      kind: DM_MESSAGE_MAILBOX_KIND,
      version: 1,
      mode: 'direct',
      conversationId: payload.conversationId,
      events: normalized.events,
      ...(blocks !== undefined ? { blocks: blocks as BlobDataPayload[] } : {}),
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isHlc(value: unknown): boolean {
  return isRecord(value) && typeof value.wall === 'string' && Number.isInteger(value.counter);
}

function isDmMessageAttachment(value: unknown): boolean {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.blobHash === 'string'
    && typeof value.name === 'string'
    && typeof value.mimeType === 'string'
    && typeof value.size === 'number';
}

function isDmMessageEvent(value: unknown): value is DmMessageEvent {
  if (!isRecord(value)) return false;
  const attachments = value.attachments;
  const supersedes = value.supersedes;
  const intent = value.intent;
  const hasValidAttachments = attachments === undefined
    || (Array.isArray(attachments) && attachments.every(isDmMessageAttachment));
  const hasValidSupersedes = supersedes === undefined
    || (isRecord(supersedes) && typeof supersedes.id === 'string' && typeof supersedes.deleted === 'boolean');
  const hasValidIntent = intent === undefined || intent === 'message' || intent === 'react';

  return value.version === 1
    && typeof value.id === 'string'
    && typeof value.conversationId === 'string'
    && typeof value.authorDeviceId === 'string'
    && typeof value.body === 'string'
    && hasValidAttachments
    && isHlc(value.hlc)
    && hasValidSupersedes
    && hasValidIntent
    && typeof value.signature === 'string';
}

function isBlobDataPayload(value: unknown): value is BlobDataPayload {
  if (!isRecord(value)) return false;
  return typeof value.hash === 'string'
    && typeof value.moduleId === 'string'
    && Number.isInteger(value.index)
    && Number.isInteger(value.total)
    && Number.isInteger(value.totalBytes)
    && (value.mimeType === null || typeof value.mimeType === 'string')
    && typeof value.dataHex === 'string';
}

// ---------------------------------------------------------------------------
// GROUP DM message seal/open (Plan 21 Phase 6).
//
// A group DM message rides the SAME DM_MESSAGE_MAILBOX_KIND and dmMessage handler
// (the events are DmMessageEvents), discriminated by `mode: 'group'`. The delta
// carries an EPOCH-content-key-sealed events blob instead of cleartext events:
// the signed DmMessageEvents JSON is encrypted under
// deriveEpochContentKey(epochSecret, conversationId, epoch) BEFORE the pairwise
// mailbox seal. So a device that lost group membership (holds no wrap for the new
// epoch) cannot read a post-removal message even if it obtains the sealed
// envelope -- the mailbox seal opens, but the epoch layer does not. The envelope
// is then fanned out per member device under that member's pair-private token,
// consistent with sealDmDirect.
// ---------------------------------------------------------------------------

/** hex nonce + hex ciphertext of the epoch-content-key-sealed DmMessageEvents JSON. */
export interface DmGroupSealedEvents {
  nonce: string;
  ciphertext: string;
}

/** The sealed group delta. `mode: 'group'` discriminates it from the 1:1 'direct' variant. */
export interface DmGroupMailboxPayload {
  kind: typeof DM_MESSAGE_MAILBOX_KIND;
  version: 1;
  mode: 'group';
  conversationId: string;
  /** The epoch the events were sealed under (the recipient needs its wrap for this epoch). */
  epoch: number;
  sealedEvents: DmGroupSealedEvents;
  blocks?: BlobDataPayload[];
}

export interface SealDmGroupInput {
  sender: DeviceIdentity;
  conversationId: string;
  /** The current group epoch. */
  epoch: number;
  /** The group epoch SECRET (from unwrapEpochSecret / getCurrentEpochKey); NOT the content key. */
  epochSecret: Uint8Array;
  events: readonly DmMessageEvent[];
  /** Every member device that should receive this delta (one envelope per device). */
  recipients: readonly DmDirectRecipient[];
  blocks?: readonly BlobDataPayload[];
  now?: string;
}

export type SealDmGroupResult =
  | {
      ok: true;
      payload: DmGroupMailboxPayload;
      sealed: SealedDmDirectEnvelope[];
      eventCount: number;
    }
  | { ok: false; reason: DmMailboxBuildRejectReason };

/**
 * Seal a group DM delta for every member device. Rejects (never seals) an empty
 * delta, an event for another conversation, an unverifiable event, or an empty
 * recipient set -- identical guardrails to sealDmDirect. The events are
 * epoch-sealed once, then that single ciphertext is fanned to each member.
 */
export function sealDmGroup(input: SealDmGroupInput): SealDmGroupResult {
  if (input.recipients.length === 0) return { ok: false, reason: 'no_recipients' };

  const normalized = normalizeDmEvents(input.events, input.conversationId);
  if (!normalized.ok) return normalized;

  const contentKey = deriveEpochContentKey(input.epochSecret, input.conversationId, input.epoch);
  const plaintext = new TextEncoder().encode(JSON.stringify(normalized.events));
  const { ciphertext, nonce } = encrypt(plaintext, contentKey);

  const payload: DmGroupMailboxPayload = {
    kind: DM_MESSAGE_MAILBOX_KIND,
    version: 1,
    mode: 'group',
    conversationId: input.conversationId,
    epoch: input.epoch,
    sealedEvents: { nonce: bytesToHex(nonce), ciphertext: bytesToHex(ciphertext) },
    ...(input.blocks && input.blocks.length > 0 ? { blocks: [...input.blocks] } : {}),
  };

  const clock = resolveMailboxSealClock(input.now);
  const sealed = input.recipients.map<SealedDmDirectEnvelope>((recipient) => ({
    recipientDeviceId: recipient.deviceId,
    token: deriveMailboxToken(recipient.pairSecret, recipient.deviceId, clock.nowMs),
    envelope: sealMailboxDelta(
      input.sender,
      { deviceId: recipient.deviceId, dhPublicKey: recipient.dhPublicKey },
      payload,
      clock.nowIso,
    ),
  }));

  return { ok: true, payload, sealed, eventCount: normalized.events.length };
}

/**
 * Structurally validate a group mailbox payload (mode 'group') WITHOUT the epoch
 * key -- the dispatcher uses this to route a group delta to the dmMessage handler
 * (which holds the epoch key and decrypts). Exported for the dispatcher.
 */
export function parseDmGroupMailboxPayload(
  payload: unknown,
): { ok: true; payload: DmGroupMailboxPayload } | { ok: false; reason: DmMailboxRejectReason } {
  if (!isRecord(payload)) return { ok: false, reason: 'invalid_payload' };
  if (
    payload.kind !== DM_MESSAGE_MAILBOX_KIND
    || payload.version !== 1
    || payload.mode !== 'group'
    || typeof payload.conversationId !== 'string'
    || payload.conversationId.length === 0
    || typeof payload.epoch !== 'number'
    || !isRecord(payload.sealedEvents)
    || typeof payload.sealedEvents.nonce !== 'string'
    || typeof payload.sealedEvents.ciphertext !== 'string'
  ) {
    return { ok: false, reason: 'invalid_payload' };
  }
  const blocks = payload.blocks;
  if (blocks !== undefined && (!Array.isArray(blocks) || !blocks.every(isBlobDataPayload))) {
    return { ok: false, reason: 'invalid_payload' };
  }
  return {
    ok: true,
    payload: {
      kind: DM_MESSAGE_MAILBOX_KIND,
      version: 1,
      mode: 'group',
      conversationId: payload.conversationId,
      epoch: payload.epoch,
      sealedEvents: {
        nonce: payload.sealedEvents.nonce,
        ciphertext: payload.sealedEvents.ciphertext,
      },
      ...(blocks !== undefined ? { blocks: blocks as BlobDataPayload[] } : {}),
    },
  };
}

/**
 * Decrypt + verify the epoch-sealed events with a supplied epoch SECRET. Returns
 * null fail-closed on a wrong/absent key, tamper, or any unverifiable event -- so
 * a device holding no wrap for `epoch` (a removed member) gets NOTHING. Pure; the
 * caller resolves the epoch secret from its own key store.
 */
export function decryptDmGroupEvents(
  payload: Pick<DmGroupMailboxPayload, 'conversationId' | 'epoch' | 'sealedEvents'>,
  epochSecret: Uint8Array,
): DmMessageEvent[] | null {
  try {
    const key = deriveEpochContentKey(epochSecret, payload.conversationId, payload.epoch);
    const opened = decrypt(
      hexToBytes(payload.sealedEvents.ciphertext),
      hexToBytes(payload.sealedEvents.nonce),
      key,
    );
    if (!opened) return null;
    const parsed = JSON.parse(new TextDecoder().decode(opened)) as unknown;
    if (!Array.isArray(parsed) || !parsed.every(isDmMessageEvent)) return null;
    const normalized = normalizeDmEvents(parsed, payload.conversationId);
    return normalized.ok ? normalized.events : null;
  } catch {
    return null;
  }
}

export type OpenDmGroupResult =
  | {
      ok: true;
      senderDeviceId: string;
      createdAt: string;
      conversationId: string;
      epoch: number;
      events: DmMessageEvent[];
      blocks: BlobDataPayload[];
    }
  | { ok: false; reason: DmMailboxRejectReason };

/**
 * Open a sealed GROUP DM delta with the recipient's DH key AND its epoch secret:
 * verify the envelope, structurally validate the group payload, then decrypt the
 * epoch layer and re-verify every carried event. Fail-closed on any tamper,
 * forgery, wrong recipient, wrong mode, or a missing/incorrect epoch key.
 */
export function openDmGroup(
  recipient: DeviceIdentity,
  envelope: MailboxEnvelope,
  epochSecret: Uint8Array,
): OpenDmGroupResult {
  const opened = openMailboxDelta<unknown>(recipient, envelope);
  if (!opened.ok) return opened;

  const parsed = parseDmGroupMailboxPayload(opened.payload);
  if (!parsed.ok) return parsed;

  const events = decryptDmGroupEvents(parsed.payload, epochSecret);
  if (!events) return { ok: false, reason: 'decrypt_failed' };

  return {
    ok: true,
    senderDeviceId: opened.senderDeviceId,
    createdAt: opened.createdAt,
    conversationId: parsed.payload.conversationId,
    epoch: parsed.payload.epoch,
    events,
    blocks: parsed.payload.blocks ?? [],
  };
}
