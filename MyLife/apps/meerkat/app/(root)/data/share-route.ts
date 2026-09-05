// share-route.ts: pure, native-free routing for the OS Share Inbox (Plan 20,
// Phase 9/10). Turns a device-local staged intake (mk_share_intake +
// mk_share_payload) into a REAL destination row and only then records the route.
//
// HONESTY (Critical, NC-10 / L7):
//   1. A staged item is NEVER "sent" until a real destination row exists. This
//      module writes the real cm_messages row FIRST (via the injected send fn,
//      which is ChatProvider.sendMessage in the app) and marks the intake routed
//      ONLY when that write succeeds. If send fails, the intake stays 'staged'.
//   2. The "Sent" label reads the REAL destination row (isShareIntakeSent), never
//      mk_share_intake.status. A routed status with a dangling dest_ref (no real
//      row) reads as not-sent.
//   3. The direct-message surface (Plan 21 Phase 5) is LIVE on mobile, so
//      DM_MESSAGES_SURFACE_AVAILABLE is true and availableShareDestinations()
//      includes 'dm'. Plan 40 R1 wires the real DM share route: routeStagedShareToDm
//      routes through the REAL DM provider (queueDmMessage) - it never writes a
//      dm_messages row directly - and marks the intake routed only on the real
//      local echo id. A failed send leaves the intake 'staged' and retryable, and
//      "Sent" for a DM reads a real dm_messages row (isShareIntakeSent), never the
//      intake status.
//
// The send + attachment builders are injected so this is fully testable with an
// in-memory db and no React Native. The staging rows are DEVICE-LOCAL by
// construction (mk_ prefix, outside MEERKAT_SYNC_PREFIXES); nothing here ever
// records a sync change.

import type { DatabaseAdapter } from '@mylife/db';
import {
  getSharePayloads,
  routeShareIntake as markShareIntakeRouted,
  type ChannelMessageAttachment,
  type DmMessageAttachment,
  type ShareIntakeRow,
  type SharePayloadRow,
} from '@mylife/sync';
import { CM_MESSAGES_TABLE } from './community-core';

export type ShareDestinationKind = 'channel' | 'files' | 'dm';

/**
 * The Plan-21 direct-messages surface is LIVE on mobile (Phase 5): a real dm_
 * store, thread UI, and send path exist, so this is true. Plan 40 R1 wires the
 * real DM share route (routeStagedShareToDm) and the Share Inbox renders a
 * recipient picker, so 'dm' is now a live destination, not a latent capability.
 */
export const DM_MESSAGES_SURFACE_AVAILABLE = true;

/** The destination kinds the Share Inbox may render right now (DM gated out). */
export function availableShareDestinations(): ShareDestinationKind[] {
  const kinds: ShareDestinationKind[] = ['channel', 'files'];
  if (DM_MESSAGES_SURFACE_AVAILABLE) kinds.push('dm');
  return kinds;
}

/** A concrete route target. `files` posts into a channel; the community Files index aggregates it. */
export interface ShareRouteTarget {
  kind: 'channel' | 'files';
  communityId: string;
  channelId: string;
}

/** Writes the REAL cm_messages row and returns its id (ChatProvider.sendMessage adapter). */
export type ChannelSendFn = (
  communityId: string,
  channelId: string,
  body: string,
  attachments: ChannelMessageAttachment[],
) => { ok: true; messageId: string } | { ok: false; error: string };

/**
 * Builds a verified channel attachment from a staged file payload (in the app:
 * confirm the blob is on-device via ExpoBlobStore.has, then reference it). Return
 * null when the bytes are no longer present so routing fails honestly instead of
 * attaching a dangling hash.
 */
export type BuildAttachmentFn = (
  payload: SharePayloadRow,
) => Promise<ChannelMessageAttachment | null>;

export interface RouteStagedShareDeps {
  db: DatabaseAdapter;
  item: ShareIntakeRow;
  target: ShareRouteTarget;
  send: ChannelSendFn;
  buildAttachment?: BuildAttachmentFn;
}

export type RouteStagedShareResult =
  | { ok: true; destination: 'channel' | 'files'; messageId: string }
  | { ok: false; error: string };

/**
 * Route one staged intake into a community channel (or the Files index, which is
 * the same channel-message path). Combines text/url payloads into the message
 * body and attaches every file payload. Writes the real row first; records the
 * route only on success.
 */
export async function routeStagedShare(
  deps: RouteStagedShareDeps,
): Promise<RouteStagedShareResult> {
  const { db, item, target, send, buildAttachment } = deps;

  const payloads = getSharePayloads(db, item.id);
  if (payloads.length === 0) return { ok: false, error: 'Nothing staged to send.' };

  const bodyParts: string[] = [];
  const attachments: ChannelMessageAttachment[] = [];
  for (const payload of payloads) {
    if ((payload.kind === 'text' || payload.kind === 'url') && payload.text_value) {
      bodyParts.push(payload.text_value);
      continue;
    }
    if (payload.blob_hash) {
      if (!buildAttachment) {
        return { ok: false, error: 'This build cannot attach shared files yet.' };
      }
      const attachment = await buildAttachment(payload);
      if (!attachment) {
        return {
          ok: false,
          error: `${payload.filename ?? 'A shared file'} is no longer on this device.`,
        };
      }
      attachments.push(attachment);
    }
  }

  const body = bodyParts.join('\n');
  if (!body && attachments.length === 0) {
    return { ok: false, error: 'Nothing staged to send.' };
  }

  // Write the REAL destination row FIRST. The intake is marked routed ONLY after
  // this succeeds; a failed send leaves it 'staged' (never a fake "sent").
  const sent = send(target.communityId, target.channelId, body, attachments);
  if (!sent.ok) return { ok: false, error: sent.error };

  markShareIntakeRouted(db, item.id, target.kind, sent.messageId);
  return { ok: true, destination: target.kind, messageId: sent.messageId };
}

/** Writes the REAL dm_messages local echo via the DM provider and returns its id. */
export type DmSendFn = (
  conversationId: string,
  body: string,
  attachments: DmMessageAttachment[],
) => Promise<{ ok: true; messageId: string } | { ok: false; error: string }>;

export interface RouteStagedShareToDmDeps {
  db: DatabaseAdapter;
  item: ShareIntakeRow;
  conversationId: string;
  sendDm: DmSendFn;
  buildAttachment?: BuildAttachmentFn;
}

export type RouteStagedShareToDmResult =
  | { ok: true; destination: 'dm'; messageId: string }
  | { ok: false; error: string };

/**
 * Route one staged intake into a direct-message thread THROUGH the real DM
 * provider (sendDm wraps SyncProvider.queueDmMessage; this module never touches
 * dm_messages directly). The intake is marked routed only on the real local
 * echo id, so a failed/exceptional send leaves it 'staged' and retryable, and
 * "Sent" reads a real dm_messages row (isShareIntakeSent), never the status.
 */
export async function routeStagedShareToDm(
  deps: RouteStagedShareToDmDeps,
): Promise<RouteStagedShareToDmResult> {
  const { db, item, conversationId, sendDm, buildAttachment } = deps;
  if (!conversationId) return { ok: false, error: 'Choose someone to send this to.' };

  const payloads = getSharePayloads(db, item.id);
  if (payloads.length === 0) return { ok: false, error: 'Nothing staged to send.' };

  const bodyParts: string[] = [];
  const attachments: DmMessageAttachment[] = [];
  for (const payload of payloads) {
    if ((payload.kind === 'text' || payload.kind === 'url') && payload.text_value) {
      bodyParts.push(payload.text_value);
      continue;
    }
    if (payload.blob_hash) {
      if (!buildAttachment) return { ok: false, error: 'This build cannot attach shared files yet.' };
      const attachment = await buildAttachment(payload);
      if (!attachment) {
        return { ok: false, error: `${payload.filename ?? 'A shared file'} is no longer on this device.` };
      }
      attachments.push(attachment);
    }
  }

  const body = bodyParts.join('\n');
  if (!body && attachments.length === 0) return { ok: false, error: 'Nothing staged to send.' };

  // Route through the REAL DM provider. It writes the signed local echo row
  // synchronously; we mark routed ONLY on a real returned message id. A throw
  // or an ok:false leaves the intake 'staged' (retryable), never a fake "sent".
  let sent: Awaited<ReturnType<DmSendFn>>;
  try {
    sent = await sendDm(conversationId, body, attachments);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not send this message.' };
  }
  if (!sent.ok) return { ok: false, error: sent.error };

  markShareIntakeRouted(db, item.id, 'dm', sent.messageId);
  return { ok: true, destination: 'dm', messageId: sent.messageId };
}

/**
 * Is this staged item truly delivered? TRUE only when a REAL destination row
 * exists for its recorded dest_ref. This NEVER trusts mk_share_intake.status:
 * a routed status whose dest_ref points at no real cm_messages / dm_messages
 * row reads as not-sent (NC-10 / L7).
 */
export function isShareIntakeSent(db: DatabaseAdapter, item: ShareIntakeRow): boolean {
  if (!item.dest_ref) return false;
  if (item.destination === 'channel' || item.destination === 'files') {
    const rows = db.query<{ n: number }>(
      `SELECT COUNT(*) AS n FROM ${CM_MESSAGES_TABLE} WHERE id = ?`,
      [item.dest_ref],
    );
    return (rows[0]?.n ?? 0) > 0;
  }
  if (item.destination === 'dm') {
    // "Sent" for a DM destination is a real dm_messages row (the local echo the
    // DM provider wrote), never the intake status.
    const rows = db.query<{ n: number }>(
      `SELECT COUNT(*) AS n FROM dm_messages WHERE id = ?`,
      [item.dest_ref],
    );
    return (rows[0]?.n ?? 0) > 0;
  }
  return false;
}
