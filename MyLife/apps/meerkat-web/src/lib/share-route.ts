// Web OS-share routing (Plan 20, Phase 10 web). The thin, honest glue that stages
// an incoming OS-shared / file-picked item DEVICE-LOCALLY through the SHIPPED
// @mylife/sync share-intake engine, then routes a staged item into an existing
// real destination (a channel / files message) by REUSING the composer
// attach+send path. It owns no crypto and no schema: the tables come from
// ensureShareIntakeTables (mk_share_intake + mk_share_payload, deliberately
// OUTSIDE MEERKAT_SYNC_PREFIXES), and the normalize/stage/route helpers come
// from the engine unchanged.
//
// Load-bearing honesty properties (never violate):
//   - mk_share_intake + mk_share_payload are DEVICE-LOCAL (mk_ prefix). They are
//     never in MEERKAT_SYNC_PREFIXES, so a staged item can never auto-replicate
//     (NC-9/L7). Staging writes RAW db rows, never engine.recordChange.
//   - a staged item is NEVER "Sent" until a REAL cm_messages row exists
//     (NC-10/L7). isShareIntakeSent reads the real destination row, NEVER
//     mk_share_intake.status.
//   - the payload MIME is RE-SNIFFED from the bytes on intake (the engine's
//     normalizeSharedItem does this); the sender-declared MIME is never trusted
//     for classification or for the blob-store mime when bytes are in hand.
//   - Plan 40 R1 wires the real DM share route (routeStagedShareToDm): it routes
//     through the REAL DM provider (queueDmMessage) and never writes a
//     dm_messages row directly. A failed send leaves the intake staged +
//     retryable, and "Sent" for a DM reads a real dm_messages row.

import type { DatabaseAdapter } from '@mylife/db';
import {
  bytesToHex,
  generateSyncRandomBytes,
  normalizeSharedItem,
  stageShareIntake,
  listShareIntakes,
  getSharePayloads,
  routeShareIntake,
  discardShareIntake,
  type DmMessageAttachment,
  type RawSharedItem,
  type ShareDestination,
  type ShareIntakeRow,
  type ShareSource,
  type SharePayloadRow,
  type StagePayloadInput,
} from '@mylife/sync';
import { COMMUNITY_MODULE_ID } from './schema';

/** Staged items live for a week before the sweep can reclaim their bytes. */
export const DEFAULT_SHARE_INTAKE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Where a routed share may land. 'dm' is Plan-21-gated (see availableShareDestinations). */
export type ShareRouteDestination = Extract<ShareDestination, 'channel' | 'files' | 'dm'>;

/** One raw item the user brought in (file pick, drag-drop, or Web Share Target). */
export interface WebShareItemInput {
  /** Inline shared text / url. */
  text?: string;
  /** The sender-declared MIME. NEVER trusted for classification when bytes exist. */
  declaredMime?: string;
  filename?: string;
  /** File bytes, when the item is a file. */
  bytes?: Uint8Array;
}

/** The subset of the on-device blob store staging needs (seal file bytes). */
export interface ShareBlobSink {
  putLocal(
    bytes: Uint8Array,
    opts: { moduleId: string; mimeType?: string | null },
  ): Promise<{ hash: string; size: number }>;
}

/** The subset of the on-device blob store routing needs (read file bytes back). */
export interface ShareBlobSource {
  get(hash: string): Uint8Array | null | Promise<Uint8Array | null>;
}

export interface StageWebShareInput {
  items: readonly WebShareItemInput[];
  source: ShareSource;
  sourceApp?: string | null;
  now?: () => string;
  ttlMs?: number;
  /** Unique-id factory (defaults to crypto.randomUUID with a hash fallback). */
  idFactory?: () => string;
}

export interface StageWebShareResult {
  ok: boolean;
  intakeId: string | null;
  staged: number;
  errors: string[];
}

/** One staged share plus its verified device-local payload rows. */
export interface StagedShareItem {
  intake: ShareIntakeRow;
  payloads: SharePayloadRow[];
}

/** The composer attach+send contract this module REUSES (provider.attachAndSend). */
export interface ShareComposerFile {
  name: string;
  mimeType: string;
  bytes: Uint8Array;
}

export type AuthorSharedMessageResult =
  | { ok: true; event: { id: string } }
  | { ok: false; error: string };

export type AuthorSharedMessage = (
  communityId: string,
  channelId: string,
  body: string,
  files: ShareComposerFile[],
) => Promise<AuthorSharedMessageResult>;

export interface RouteStagedShareInput {
  intakeId: string;
  communityId: string;
  channelId: string;
  destination: ShareRouteDestination;
  /** Extra body text; prepended to any staged text/url payloads. */
  body?: string;
}

export type RouteStagedShareResult =
  | { ok: true; destination: ShareRouteDestination; destRef: string; messageId: string }
  | { ok: false; error: string };

function defaultIdFactory(): () => string {
  let counter = 0;
  return () => {
    const g = globalThis as { crypto?: { randomUUID?: () => string } };
    if (typeof g.crypto?.randomUUID === 'function') return g.crypto.randomUUID();
    counter += 1;
    return `sh_${Date.now().toString(36)}_${counter.toString(36)}_${bytesToHex(generateSyncRandomBytes(6))}`;
  };
}

/**
 * Stage one or more brought-in items DEVICE-LOCALLY. File bytes are sealed into
 * the on-device blob store under the SNIFFED mime; the row references the hash.
 * Returns honest counts; per-item failures (empty / oversized) are collected,
 * not thrown. Writes RAW mk_share_* rows only (never engine.recordChange), so
 * the item cannot replicate.
 */
export async function stageWebShare(
  db: DatabaseAdapter,
  blobStore: ShareBlobSink,
  input: StageWebShareInput,
): Promise<StageWebShareResult> {
  const now = input.now ?? (() => new Date().toISOString());
  const ttlMs = input.ttlMs ?? DEFAULT_SHARE_INTAKE_TTL_MS;
  const newId = input.idFactory ?? defaultIdFactory();

  const payloads: StagePayloadInput[] = [];
  const errors: string[] = [];

  for (const item of input.items) {
    const raw: RawSharedItem = {
      text: item.text,
      declaredMime: item.declaredMime,
      filename: item.filename,
      bytes: item.bytes,
    };
    const res = normalizeSharedItem(raw);
    if (!res.ok) {
      errors.push(res.reason);
      continue;
    }
    const p = res.payload;
    let blobHash: string | null = null;
    // A file (bytes present, no inline text) is sealed under the SNIFFED mime.
    if (item.bytes && p.textValue == null) {
      const stored = await blobStore.putLocal(item.bytes, {
        moduleId: COMMUNITY_MODULE_ID,
        mimeType: p.mime ?? 'application/octet-stream',
      });
      blobHash = stored.hash;
    }
    payloads.push({
      id: newId(),
      kind: p.kind,
      uti: p.uti,
      mime: p.mime,
      filename: p.filename,
      byteLength: p.byteLength,
      textValue: p.textValue,
      blobHash,
    });
  }

  if (payloads.length === 0) {
    return { ok: false, intakeId: null, staged: 0, errors };
  }

  const intakeId = newId();
  const createdAt = now();
  const createdMs = Date.parse(createdAt);
  const expiresAt = new Date((Number.isFinite(createdMs) ? createdMs : Date.now()) + ttlMs).toISOString();
  stageShareIntake(db, {
    id: intakeId,
    source: input.source,
    sourceApp: input.sourceApp ?? null,
    createdAt,
    expiresAt,
    payloads,
  });
  return { ok: true, intakeId, staged: payloads.length, errors };
}

/** List the still-actionable staged shares (staged + reviewing) with their payloads. */
export function listStagedShareItems(db: DatabaseAdapter): StagedShareItem[] {
  return listShareIntakes(db, ['staged', 'reviewing']).map((intake) => ({
    intake,
    payloads: getSharePayloads(db, intake.id),
  }));
}

/** Reconstruct the composer body + files for a staged item from its payloads. */
async function reconstructComposerInput(
  blobStore: ShareBlobSource,
  payloads: SharePayloadRow[],
  extraBody?: string,
): Promise<{ body: string; files: ShareComposerFile[] }> {
  const textParts: string[] = [];
  if (extraBody && extraBody.trim()) textParts.push(extraBody.trim());
  const files: ShareComposerFile[] = [];
  for (const p of payloads) {
    if (p.text_value != null && p.blob_hash == null) {
      const t = p.text_value.trim();
      if (t) textParts.push(t);
      continue;
    }
    if (p.blob_hash) {
      const bytes = await blobStore.get(p.blob_hash);
      if (!bytes) continue;
      files.push({
        name: p.filename ?? `shared-${p.id.slice(0, 8)}`,
        // Reuse the mime SNIFFED at intake; never the sender-declared value.
        mimeType: p.mime ?? 'application/octet-stream',
        bytes,
      });
    }
  }
  return { body: textParts.join('\n'), files };
}

/**
 * Route a staged item into a channel / files message by REUSING the composer
 * attach+send path (author). A real cm_messages row is written FIRST; only then
 * is the intake marked routed with dest_ref = that real message id. On any author
 * failure the intake is left staged (never a fabricated "sent"). 'files' and
 * 'channel' both land as a real channel message (files aggregate from
 * attachments); 'dm' is rejected here until Plan 21 ships a real DM path.
 */
export async function routeStagedShare(
  db: DatabaseAdapter,
  blobStore: ShareBlobSource,
  author: AuthorSharedMessage,
  input: RouteStagedShareInput,
): Promise<RouteStagedShareResult> {
  if (input.destination === 'dm') {
    return { ok: false, error: 'Direct messages are not available yet.' };
  }
  const rows = db.query<ShareIntakeRow>(
    `SELECT id, source, source_app, status, destination, dest_ref, created_at, expires_at
       FROM mk_share_intake WHERE id = ?`,
    [input.intakeId],
  );
  const intake = rows[0];
  if (!intake) return { ok: false, error: 'That shared item is no longer staged.' };
  if (intake.status === 'routed') return { ok: false, error: 'That item was already routed.' };
  if (intake.status === 'discarded' || intake.status === 'expired') {
    return { ok: false, error: 'That shared item is no longer available.' };
  }

  const payloads = getSharePayloads(db, input.intakeId);
  const { body, files } = await reconstructComposerInput(blobStore, payloads, input.body);
  if (!body && files.length === 0) {
    return { ok: false, error: 'Nothing to send from that item.' };
  }

  const result = await author(input.communityId, input.channelId, body, files);
  if (!result.ok) return { ok: false, error: result.error };

  // The REAL destination row now exists; record it as the intake's dest_ref.
  routeShareIntake(db, input.intakeId, input.destination, result.event.id);
  return {
    ok: true,
    destination: input.destination,
    destRef: result.event.id,
    messageId: result.event.id,
  };
}

/** Writes the REAL dm_messages local echo via the DM provider and returns its id. */
export type ShareDmSend = (
  conversationId: string,
  body: string,
  attachments: DmMessageAttachment[],
) => Promise<{ ok: true; messageId: string } | { ok: false; error: string }>;

export interface RouteStagedShareToDmInput {
  intakeId: string;
  conversationId: string;
  body?: string;
}

export type RouteStagedShareToDmResult =
  | { ok: true; destination: 'dm'; destRef: string; messageId: string }
  | { ok: false; error: string };

/**
 * Route a staged item into a direct-message thread THROUGH the real DM provider
 * (sendDm wraps MeerkatProvider.queueDmMessage; this module never touches
 * dm_messages directly). The intake is marked routed only on the real local
 * echo id, so a failed/throwing send leaves it 'staged' and retryable, and
 * "Sent" reads a real dm_messages row (isShareIntakeSent), never the status.
 */
export async function routeStagedShareToDm(
  db: DatabaseAdapter,
  blobStore: ShareBlobSource,
  sendDm: ShareDmSend,
  input: RouteStagedShareToDmInput,
): Promise<RouteStagedShareToDmResult> {
  if (!input.conversationId) return { ok: false, error: 'Choose someone to send this to.' };
  const rows = db.query<ShareIntakeRow>(
    `SELECT id, source, source_app, status, destination, dest_ref, created_at, expires_at
       FROM mk_share_intake WHERE id = ?`,
    [input.intakeId],
  );
  const intake = rows[0];
  if (!intake) return { ok: false, error: 'That shared item is no longer staged.' };
  if (intake.status === 'routed') return { ok: false, error: 'That item was already routed.' };
  if (intake.status === 'discarded' || intake.status === 'expired') {
    return { ok: false, error: 'That shared item is no longer available.' };
  }

  const payloads = getSharePayloads(db, input.intakeId);
  const bodyParts: string[] = [];
  if (input.body && input.body.trim()) bodyParts.push(input.body.trim());
  const attachments: DmMessageAttachment[] = [];
  for (const payload of payloads) {
    if (payload.text_value != null && payload.blob_hash == null) {
      const text = payload.text_value.trim();
      if (text) bodyParts.push(text);
      continue;
    }
    if (payload.blob_hash) {
      // Reference the bytes already sealed into the on-device blob store at
      // intake (DmMessageAttachment === ChannelMessageAttachment, a blob ref).
      // Confirm the bytes are present so a dangling hash is not attached.
      const bytes = await blobStore.get(payload.blob_hash);
      if (!bytes) {
        return { ok: false, error: `${payload.filename ?? 'A shared file'} is no longer on this device.` };
      }
      attachments.push({
        id: `att_${payload.blob_hash.slice(0, 16)}_${payload.id.slice(0, 6)}`,
        blobHash: payload.blob_hash,
        name: payload.filename ?? 'shared-file',
        mimeType: payload.mime ?? 'application/octet-stream',
        size: payload.byte_length ?? bytes.length,
      });
    }
  }
  const body = bodyParts.join('\n');
  if (!body && attachments.length === 0) return { ok: false, error: 'Nothing to send from that item.' };

  let sent: Awaited<ReturnType<ShareDmSend>>;
  try {
    sent = await sendDm(input.conversationId, body, attachments);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not send this message.' };
  }
  if (!sent.ok) return { ok: false, error: sent.error };

  routeShareIntake(db, input.intakeId, 'dm', sent.messageId);
  return { ok: true, destination: 'dm', destRef: sent.messageId, messageId: sent.messageId };
}

/** Discard a staged item (marks it discarded; the sweep reclaims its bytes). */
export function discardStagedShare(db: DatabaseAdapter, intakeId: string): void {
  discardShareIntake(db, intakeId);
}

/**
 * The HONEST "Sent" signal for a staged item: true ONLY when the intake carries
 * a dest_ref AND a REAL cm_messages row with that id exists on this device. The
 * mk_share_intake.status is never trusted on its own (a routed status with no
 * matching message row reads as NOT sent).
 */
export function isShareIntakeSent(db: DatabaseAdapter, intakeId: string): boolean {
  const rows = db.query<{ dest_ref: string | null; destination: string | null }>(
    `SELECT dest_ref, destination FROM mk_share_intake WHERE id = ?`,
    [intakeId],
  );
  const destRef = rows[0]?.dest_ref;
  if (!destRef) return false;
  // A DM destination's "Sent" is a real dm_messages row (the local echo the DM
  // provider wrote via routeStagedShareToDm), never the intake status.
  if (rows[0]?.destination === 'dm') {
    const dmHit = db.query<{ n: number }>(
      `SELECT COUNT(*) AS n FROM dm_messages WHERE id = ?`,
      [destRef],
    );
    return (dmHit[0]?.n ?? 0) > 0;
  }
  const hit = db.query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM cm_messages WHERE id = ?`,
    [destRef],
  );
  return (hit[0]?.n ?? 0) > 0;
}

/**
 * The destinations offered for a staged item. 'channel' + 'files' are always
 * real (both write a cm_messages row). 'dm' is included ONLY when a real Plan-21
 * direct-messages send path exists; until then it is HIDDEN, never a dead button.
 */
export function availableShareDestinations(
  caps: { directMessages?: boolean } = {},
): ShareRouteDestination[] {
  const destinations: ShareRouteDestination[] = ['channel', 'files'];
  if (caps.directMessages) destinations.push('dm');
  return destinations;
}
