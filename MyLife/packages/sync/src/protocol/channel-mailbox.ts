import type { DeviceIdentity } from '../types';
import {
  compareChannelMessages,
  verifyChannelMessage,
  type ChannelMessageAttachment,
  type ChannelMessageEvent,
  type Hlc,
} from './channel-message';
import {
  deriveMailboxToken,
  resolveMailboxSealClock,
  openMailboxDelta,
  sealMailboxDelta,
  type MailboxEnvelope,
} from './mailbox';

export const CHANNEL_MESSAGE_MAILBOX_KIND = 'meerkat.channel-message-events';

export interface ChannelMessageMailboxPayload {
  kind: typeof CHANNEL_MESSAGE_MAILBOX_KIND;
  version: 1;
  communityId: string;
  channelId: string;
  events: ChannelMessageEvent[];
}

export interface SealChannelMessageMailboxInput {
  sender: DeviceIdentity;
  recipient: { deviceId: string; dhPublicKey: string };
  pairSharedSecretHex: string;
  communityId: string;
  channelId: string;
  events: readonly ChannelMessageEvent[];
  now?: string;
}

export type SealChannelMessageMailboxResult =
  | {
      ok: true;
      token: string;
      envelope: MailboxEnvelope;
      payload: ChannelMessageMailboxPayload;
      eventCount: number;
    }
  | { ok: false; reason: ChannelMessageMailboxBuildRejectReason };

export type ChannelMessageMailboxBuildRejectReason =
  | 'empty'
  | 'invalid_event'
  | 'channel_mismatch';

export type ChannelMessageMailboxRejectReason =
  | ChannelMessageMailboxBuildRejectReason
  | 'invalid_payload'
  | 'invalid_signature'
  | 'wrong_recipient'
  | 'decrypt_failed'
  | 'malformed';

export type OpenChannelMessageMailboxResult =
  | {
      ok: true;
      senderDeviceId: string;
      createdAt: string;
      payload: ChannelMessageMailboxPayload;
      events: ChannelMessageEvent[];
    }
  | { ok: false; reason: ChannelMessageMailboxRejectReason };

type NormalizeChannelMailboxEventsResult =
  | { ok: true; events: ChannelMessageEvent[] }
  | { ok: false; reason: ChannelMessageMailboxBuildRejectReason };

function normalizeChannelMailboxEvents(
  events: readonly ChannelMessageEvent[],
  communityId: string,
  channelId: string,
): NormalizeChannelMailboxEventsResult {
  if (events.length === 0) return { ok: false, reason: 'empty' };

  const byId = new Map<string, ChannelMessageEvent>();
  for (const event of events) {
    if (event.communityId !== communityId || event.channelId !== channelId) {
      return { ok: false, reason: 'channel_mismatch' };
    }
    if (!verifyChannelMessage(event)) {
      return { ok: false, reason: 'invalid_event' };
    }
    if (!byId.has(event.id)) byId.set(event.id, event);
  }

  return { ok: true, events: [...byId.values()].sort(compareChannelMessages) };
}

export function sealChannelMessageMailboxDelta(
  input: SealChannelMessageMailboxInput,
): SealChannelMessageMailboxResult {
  const normalized = normalizeChannelMailboxEvents(input.events, input.communityId, input.channelId);
  if (!normalized.ok) return normalized;

  const payload: ChannelMessageMailboxPayload = {
    kind: CHANNEL_MESSAGE_MAILBOX_KIND,
    version: 1,
    communityId: input.communityId,
    channelId: input.channelId,
    events: normalized.events,
  };
  const clock = resolveMailboxSealClock(input.now);
  const token = deriveMailboxToken(
    input.pairSharedSecretHex,
    input.recipient.deviceId,
    clock.nowMs,
  );
  const envelope = sealMailboxDelta(input.sender, input.recipient, payload, clock.nowIso);
  return {
    ok: true,
    token,
    envelope,
    payload,
    eventCount: payload.events.length,
  };
}

export function openChannelMessageMailboxDelta(
  recipient: DeviceIdentity,
  envelope: MailboxEnvelope,
): OpenChannelMessageMailboxResult {
  const opened = openMailboxDelta<unknown>(recipient, envelope);
  if (!opened.ok) return opened;

  const parsed = parseChannelMessageMailboxPayload(opened.payload);
  if (!parsed.ok) return parsed;

  return {
    ok: true,
    senderDeviceId: opened.senderDeviceId,
    createdAt: opened.createdAt,
    payload: parsed.payload,
    events: parsed.payload.events,
  };
}

function parseChannelMessageMailboxPayload(
  payload: unknown,
): { ok: true; payload: ChannelMessageMailboxPayload } | { ok: false; reason: ChannelMessageMailboxRejectReason } {
  if (!isRecord(payload)) return { ok: false, reason: 'invalid_payload' };
  if (payload.kind !== CHANNEL_MESSAGE_MAILBOX_KIND || payload.version !== 1) {
    return { ok: false, reason: 'invalid_payload' };
  }
  if (
    typeof payload.communityId !== 'string'
    || typeof payload.channelId !== 'string'
    || !Array.isArray(payload.events)
  ) {
    return { ok: false, reason: 'invalid_payload' };
  }
  if (!payload.events.every(isChannelMessageEvent)) {
    return { ok: false, reason: 'invalid_payload' };
  }

  const normalized = normalizeChannelMailboxEvents(
    payload.events,
    payload.communityId,
    payload.channelId,
  );
  if (!normalized.ok) return normalized;

  return {
    ok: true,
    payload: {
      kind: CHANNEL_MESSAGE_MAILBOX_KIND,
      version: 1,
      communityId: payload.communityId,
      channelId: payload.channelId,
      events: normalized.events,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isHlc(value: unknown): value is Hlc {
  return isRecord(value)
    && typeof value.wall === 'string'
    && Number.isInteger(value.counter);
}

function isChannelMessageAttachment(value: unknown): value is ChannelMessageAttachment {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.blobHash === 'string'
    && typeof value.name === 'string'
    && typeof value.mimeType === 'string'
    && typeof value.size === 'number';
}

function isChannelMessageEvent(value: unknown): value is ChannelMessageEvent {
  if (!isRecord(value)) return false;
  const attachments = value.attachments;
  const supersedes = value.supersedes;
  const hasValidAttachments = attachments === undefined
    || (Array.isArray(attachments) && attachments.every(isChannelMessageAttachment));
  const hasValidSupersedes = supersedes === undefined
    || (
      isRecord(supersedes)
      && typeof supersedes.id === 'string'
      && typeof supersedes.deleted === 'boolean'
    );

  return value.version === 1
    && typeof value.id === 'string'
    && typeof value.communityId === 'string'
    && typeof value.channelId === 'string'
    && typeof value.authorDeviceId === 'string'
    && typeof value.body === 'string'
    && hasValidAttachments
    && isHlc(value.hlc)
    && hasValidSupersedes
    && typeof value.signature === 'string';
}
