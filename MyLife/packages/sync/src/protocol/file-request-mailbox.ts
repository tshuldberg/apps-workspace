/**
 * File request / grant mailbox payloads (Files & Sharing Phase 3).
 *
 * A member who removed an attachment from their device can ask the message
 * author to re-send it. The "request" and the "grant" both ride the EXACT
 * existing pair-private mailbox path: sealMailboxDelta to the recipient's
 * X25519 key, addressed by deriveMailboxToken(pairSecret, recipientDeviceId),
 * parked in the relay's TTL store-and-forward mailbox. So the relay sees only a
 * 64-hex token and a ciphertext size: no file metadata, no identities, no kind
 * tag ever crosses in the clear. This is a sibling of channel-mailbox.ts and
 * reuses the channel-message machinery's primitives VERBATIM.
 *
 * Two new sealed payload kinds live INSIDE the box:
 *   FILE_REQUEST_MAILBOX_KIND -- requester -> owner; names only the blob the
 *     requester already legitimately knows about (it is in the signed
 *     cm_messages event they hold), so nothing new leaks.
 *   FILE_GRANT_MAILBOX_KIND   -- owner -> requester; an approve variant carries
 *     the re-sealed BlobDataPayload[] (same 16 KiB block format as the live
 *     blob phase), a decline variant carries a reason.
 *
 * Verify-then-pin (Critical) lives in buildFileGrant (SEND side: the owner
 * re-verifies blobContentHash(localBytes) === blobHash before sealing) and in
 * applyFileGrant (RECEIVE side: the requester reassembles, re-verifies the hash
 * AND that the hash matches the requester's OWN signed-event blobHash, then
 * writes through an injected putBlob that hash-checks again). 'restored' is the
 * caller's job only after that put succeeds.
 *
 * RN-safe: no Node crypto/fs. Blob storage is delegated to an injected
 * SessionBlobProvider-shaped getter/putter, mirroring blob-transfer.ts.
 */

import type { DeviceIdentity } from '../types';
import { hexToBytes } from '../encryption/keys';
import { sha512Hex } from '../node/hkdf';
import {
  blobContentHash,
  isBlobHash,
  splitBlobForTransfer,
  type BlobDataPayload,
} from './blob-transfer';
import {
  deriveMailboxToken,
  resolveMailboxSealClock,
  openMailboxDelta,
  sealMailboxDelta,
  type MailboxEnvelope,
} from './mailbox';

export const FILE_REQUEST_MAILBOX_KIND = 'meerkat.file-request-v1';
export const FILE_GRANT_MAILBOX_KIND = 'meerkat.file-grant-v1';

/** Why an owner could not (or would not) re-send a requested blob. */
export type FileGrantDeclineReason =
  | 'owner_no_longer_has_file'
  | 'not_a_member'
  | 'declined';

/**
 * The blob coordinates a request/grant names. The requester already holds all
 * of these in a verified local cm_messages event, so the request leaks nothing.
 */
export interface FileRequestFields {
  communityId: string;
  channelId: string;
  messageId: string;
  attachmentId: string;
  blobHash: string;
  /**
   * Content-derived id that correlates a grant to its request idempotently. A
   * single logical request is stable; the caller mints it (see fileRequestId).
   */
  requestId: string;
}

export interface FileRequestMailboxPayload extends FileRequestFields {
  kind: typeof FILE_REQUEST_MAILBOX_KIND;
  version: 1;
}

export type FileGrantMailboxPayload =
  | (FileRequestFields & {
      kind: typeof FILE_GRANT_MAILBOX_KIND;
      version: 1;
      decision: 'approve';
      blocks: BlobDataPayload[];
    })
  | (FileRequestFields & {
      kind: typeof FILE_GRANT_MAILBOX_KIND;
      version: 1;
      decision: 'decline';
      reason: FileGrantDeclineReason;
    });

export type FileRequestMailboxRejectReason =
  | 'invalid_payload'
  | 'invalid_signature'
  | 'wrong_recipient'
  | 'decrypt_failed'
  | 'malformed';

// ---------------------------------------------------------------------------
// requestId derivation (stable per logical request)
// ---------------------------------------------------------------------------

/**
 * A stable request id. Reusing the same inputs (same requester, same blob,
 * same message slot) yields the same id, so retries are idempotent on the
 * owner's prompt and a grant always correlates back to its request. The
 * requesterDeviceId is included so two members requesting the same blob get
 * distinct ids; createdAt is intentionally NOT included so a retry collapses.
 */
export function fileRequestId(
  fields: Omit<FileRequestFields, 'requestId'>,
  requesterDeviceId: string,
): string {
  const canonical = JSON.stringify([
    'meerkat-file-request-id-v1',
    fields.communityId,
    fields.channelId,
    fields.messageId,
    fields.attachmentId,
    fields.blobHash,
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
    && typeof value.messageId === 'string'
    && typeof value.attachmentId === 'string'
    && isBlobHash(value.blobHash)
    && typeof value.requestId === 'string'
    && value.requestId.length > 0;
}

function readRequestFields(value: Record<string, unknown>): FileRequestFields {
  return {
    communityId: value.communityId as string,
    channelId: value.channelId as string,
    messageId: value.messageId as string,
    attachmentId: value.attachmentId as string,
    blobHash: value.blobHash as string,
    requestId: value.requestId as string,
  };
}

/**
 * Pick ONLY the FileRequestFields off a value that may carry extra props (e.g.
 * a full FileRequestMailboxPayload with its own kind/version). Spreading the
 * whole payload into a grant would otherwise clobber the grant's kind tag.
 */
function pickRequestFields(fields: FileRequestFields): FileRequestFields {
  return {
    communityId: fields.communityId,
    channelId: fields.channelId,
    messageId: fields.messageId,
    attachmentId: fields.attachmentId,
    blobHash: fields.blobHash,
    requestId: fields.requestId,
  };
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
// FILE_REQUEST: requester -> owner
// ---------------------------------------------------------------------------

export interface SealFileRequestInput {
  /** The requester (this device). */
  sender: DeviceIdentity;
  /** The owner (message author) this is addressed to. */
  recipient: { deviceId: string; dhPublicKey: string };
  /** The pairing shared secret between the two devices (hex). */
  pairSharedSecretHex: string;
  fields: FileRequestFields;
  now?: string;
}

export interface SealFileRequestResult {
  token: string;
  envelope: MailboxEnvelope;
  payload: FileRequestMailboxPayload;
}

export function sealFileRequestMailbox(input: SealFileRequestInput): SealFileRequestResult {
  const payload: FileRequestMailboxPayload = {
    kind: FILE_REQUEST_MAILBOX_KIND,
    version: 1,
    ...pickRequestFields(input.fields),
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

export type OpenFileRequestResult =
  | {
      ok: true;
      senderDeviceId: string;
      createdAt: string;
      payload: FileRequestMailboxPayload;
    }
  | { ok: false; reason: FileRequestMailboxRejectReason };

export function openFileRequestMailbox(
  recipient: DeviceIdentity,
  envelope: MailboxEnvelope,
): OpenFileRequestResult {
  const opened = openMailboxDelta<unknown>(recipient, envelope);
  if (!opened.ok) return opened;

  const payload = opened.payload;
  if (
    !isRecord(payload)
    || payload.kind !== FILE_REQUEST_MAILBOX_KIND
    || payload.version !== 1
    || !hasRequestFields(payload)
  ) {
    return { ok: false, reason: 'invalid_payload' };
  }

  return {
    ok: true,
    senderDeviceId: opened.senderDeviceId,
    createdAt: opened.createdAt,
    payload: { kind: FILE_REQUEST_MAILBOX_KIND, version: 1, ...readRequestFields(payload) },
  };
}

// ---------------------------------------------------------------------------
// FILE_GRANT: owner -> requester
// ---------------------------------------------------------------------------

export interface SealFileGrantInput {
  /** The owner (this device). */
  sender: DeviceIdentity;
  /** The requester this grant is addressed back to. */
  recipient: { deviceId: string; dhPublicKey: string };
  pairSharedSecretHex: string;
  payload: FileGrantMailboxPayload;
  now?: string;
}

export interface SealFileGrantResult {
  token: string;
  envelope: MailboxEnvelope;
  payload: FileGrantMailboxPayload;
}

export function sealFileGrantMailbox(input: SealFileGrantInput): SealFileGrantResult {
  const clock = resolveMailboxSealClock(input.now);
  const token = deriveMailboxToken(
    input.pairSharedSecretHex,
    input.recipient.deviceId,
    clock.nowMs,
  );
  const envelope = sealMailboxDelta(input.sender, input.recipient, input.payload, clock.nowIso);
  return { token, envelope, payload: input.payload };
}

export type OpenFileGrantResult =
  | {
      ok: true;
      senderDeviceId: string;
      createdAt: string;
      payload: FileGrantMailboxPayload;
    }
  | { ok: false; reason: FileRequestMailboxRejectReason };

export function openFileGrantMailbox(
  recipient: DeviceIdentity,
  envelope: MailboxEnvelope,
): OpenFileGrantResult {
  const opened = openMailboxDelta<unknown>(recipient, envelope);
  if (!opened.ok) return opened;

  const payload = opened.payload;
  if (
    !isRecord(payload)
    || payload.kind !== FILE_GRANT_MAILBOX_KIND
    || payload.version !== 1
    || !hasRequestFields(payload)
  ) {
    return { ok: false, reason: 'invalid_payload' };
  }

  const fields = readRequestFields(payload);
  if (payload.decision === 'approve') {
    if (!Array.isArray(payload.blocks) || !payload.blocks.every(isBlobDataPayload)) {
      return { ok: false, reason: 'invalid_payload' };
    }
    return {
      ok: true,
      senderDeviceId: opened.senderDeviceId,
      createdAt: opened.createdAt,
      payload: {
        kind: FILE_GRANT_MAILBOX_KIND,
        version: 1,
        ...fields,
        decision: 'approve',
        blocks: payload.blocks as BlobDataPayload[],
      },
    };
  }

  if (payload.decision === 'decline') {
    const reason = payload.reason;
    if (reason !== 'owner_no_longer_has_file' && reason !== 'not_a_member' && reason !== 'declined') {
      return { ok: false, reason: 'invalid_payload' };
    }
    return {
      ok: true,
      senderDeviceId: opened.senderDeviceId,
      createdAt: opened.createdAt,
      payload: { kind: FILE_GRANT_MAILBOX_KIND, version: 1, ...fields, decision: 'decline', reason },
    };
  }

  return { ok: false, reason: 'invalid_payload' };
}

// ---------------------------------------------------------------------------
// Owner SEND-side: build a verified grant
// ---------------------------------------------------------------------------

export interface BuildFileGrantInput {
  owner: DeviceIdentity;
  recipient: { deviceId: string; dhPublicKey: string };
  pairSharedSecretHex: string;
  request: FileRequestFields;
  moduleId: string;
  /** Best-effort local bytes for the requested blob hash (null = no longer held). */
  getBlobBytes: (hash: string) => Uint8Array | null | Promise<Uint8Array | null>;
  /** The blob's mime type for the re-sent blocks, if known. */
  mimeType?: string | null;
  now?: string;
}

/**
 * Build an approve grant after re-verifying the owner still holds bytes whose
 * blobContentHash === the requested blobHash. If the bytes are absent or have
 * drifted, return a decline('owner_no_longer_has_file') -- NEVER seal garbage or
 * attacker-substituted bytes under the requested slot. This is the honest
 * verify-before-trust on the SEND side, the analog of fetchAndPinFromHosts.
 */
export async function buildFileGrant(input: BuildFileGrantInput): Promise<SealFileGrantResult> {
  const fields = pickRequestFields(input.request);
  const bytes = await input.getBlobBytes(fields.blobHash);
  if (!bytes || blobContentHash(bytes) !== fields.blobHash) {
    return sealFileGrantMailbox({
      sender: input.owner,
      recipient: input.recipient,
      pairSharedSecretHex: input.pairSharedSecretHex,
      payload: {
        kind: FILE_GRANT_MAILBOX_KIND,
        version: 1,
        ...fields,
        decision: 'decline',
        reason: 'owner_no_longer_has_file',
      },
      now: input.now,
    });
  }

  const blocks = splitBlobForTransfer(
    bytes,
    fields.blobHash,
    input.moduleId,
    input.mimeType ?? null,
  );
  return sealFileGrantMailbox({
    sender: input.owner,
    recipient: input.recipient,
    pairSharedSecretHex: input.pairSharedSecretHex,
    payload: {
      kind: FILE_GRANT_MAILBOX_KIND,
      version: 1,
      ...fields,
      decision: 'approve',
      blocks,
    },
    now: input.now,
  });
}

/** Build an explicit owner decline (manual "Decline" tap). */
export function buildFileDecline(
  input: Omit<BuildFileGrantInput, 'getBlobBytes' | 'moduleId' | 'mimeType'>,
  reason: FileGrantDeclineReason = 'declined',
): SealFileGrantResult {
  return sealFileGrantMailbox({
    sender: input.owner,
    recipient: input.recipient,
    pairSharedSecretHex: input.pairSharedSecretHex,
    payload: {
      kind: FILE_GRANT_MAILBOX_KIND,
      version: 1,
      ...pickRequestFields(input.request),
      decision: 'decline',
      reason,
    },
    now: input.now,
  });
}

// ---------------------------------------------------------------------------
// Requester RECEIVE-side: reassemble + verify-then-pin
// ---------------------------------------------------------------------------

/** Reassemble a complete set of grant blocks, or null while any are missing. */
export function assembleGrantBlocks(blocks: readonly BlobDataPayload[]): Uint8Array | null {
  if (blocks.length === 0) return null;
  const total = blocks[0]!.total;
  if (total <= 0) return null;
  const byIndex = new Map<number, BlobDataPayload>();
  for (const block of blocks) {
    if (block.total !== total) return null;
    if (block.index < 0 || block.index >= total) return null;
    byIndex.set(block.index, block);
  }
  if (byIndex.size < total) return null;

  const parts: Uint8Array[] = [];
  for (let i = 0; i < total; i++) {
    const block = byIndex.get(i);
    if (!block) return null;
    parts.push(hexToBytes(block.dataHex));
  }
  const size = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export type ApplyFileGrantResult =
  | { ok: true; restored: true; decision: 'approve'; blobHash: string }
  | { ok: true; restored: false; decision: 'decline'; reason: FileGrantDeclineReason }
  | {
      ok: false;
      restored: false;
      reason:
        | FileRequestMailboxRejectReason
        | 'hash_mismatch'
        | 'expected_mismatch'
        | 'incomplete'
        | 'put_failed';
    };

export interface ApplyFileGrantInput {
  recipient: DeviceIdentity;
  envelope: MailboxEnvelope;
  /**
   * The blob hash from the requester's OWN signed cm_message event for the
   * attachment slot. A malicious owner cannot swap in different bytes under the
   * same UI slot: the reassembled hash must match THIS, not merely the grant's
   * self-claimed hash.
   */
  expectedBlobHash: string;
  /** Verify-then-pin sink (ExpoBlobStore.put; it hash-checks again on write). */
  putBlob: (
    hash: string,
    bytes: Uint8Array,
    meta: { moduleId: string; mimeType: string | null },
  ) => void | Promise<void>;
  moduleId: string;
}

export interface RestoreFromGrantPayloadInput {
  payload: FileGrantMailboxPayload;
  expectedBlobHash: string;
  putBlob: ApplyFileGrantInput['putBlob'];
  moduleId: string;
}

/**
 * Verify-then-pin core, on an ALREADY opened+verified grant payload (the
 * dispatcher and the app SyncProvider have the payload, not the raw envelope).
 *   - decline: restored:false with the honest reason (no put);
 *   - approve: reassemble, re-verify blobContentHash === expectedBlobHash (the
 *     requester's own signed-event hash, NOT the grant's self-claim), then
 *     putBlob (which hash-checks). restored:true only after the write succeeds.
 *
 * Partial/short delivery (some blocks missing) returns 'incomplete' with NO
 * write, so the caller leaves the request re-tryable rather than half-written.
 */
export async function restoreFromGrantPayload(
  input: RestoreFromGrantPayloadInput,
): Promise<ApplyFileGrantResult> {
  const payload = input.payload;
  if (payload.decision === 'decline') {
    return { ok: true, restored: false, decision: 'decline', reason: payload.reason };
  }

  // The grant must be for the slot we expect (defense in depth: the caller also
  // looks the request up by requestId before calling).
  if (payload.blobHash !== input.expectedBlobHash) {
    return { ok: false, restored: false, reason: 'expected_mismatch' };
  }

  const bytes = assembleGrantBlocks(payload.blocks);
  if (!bytes) return { ok: false, restored: false, reason: 'incomplete' };

  if (blobContentHash(bytes) !== input.expectedBlobHash) {
    return { ok: false, restored: false, reason: 'hash_mismatch' };
  }

  const mimeType = payload.blocks[0]?.mimeType ?? null;
  try {
    await input.putBlob(input.expectedBlobHash, bytes, { moduleId: input.moduleId, mimeType });
  } catch {
    return { ok: false, restored: false, reason: 'put_failed' };
  }

  return { ok: true, restored: true, decision: 'approve', blobHash: input.expectedBlobHash };
}

/**
 * Open + verify a grant ENVELOPE, then delegate to restoreFromGrantPayload.
 * Fail-closed on signature / wrong-recipient / decrypt / wrong-kind.
 */
export async function applyFileGrant(input: ApplyFileGrantInput): Promise<ApplyFileGrantResult> {
  const opened = openFileGrantMailbox(input.recipient, input.envelope);
  if (!opened.ok) return { ok: false, restored: false, reason: opened.reason };

  return restoreFromGrantPayload({
    payload: opened.payload,
    expectedBlobHash: input.expectedBlobHash,
    putBlob: input.putBlob,
    moduleId: input.moduleId,
  });
}
