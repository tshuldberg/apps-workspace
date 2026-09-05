import type { DeviceIdentity } from '../types';
import {
  extractSigningPrivateKeyHex,
  signMessage,
  verifySignature,
} from '../identity/device-identity';
import { bytesToHex, hexToBytes } from '../encryption/keys';
import { sha512Hex } from '../node/hkdf';
import {
  nextHlc,
  type ChannelMessageAttachment,
  type Hlc,
} from './channel-message';

const encoder = new TextEncoder();

// DM messages reuse the channel-message clock rather than shipping their own.
export { nextHlc };
export type { Hlc };

/**
 * Signed attachment metadata for a DM. Structurally identical to
 * ChannelMessageAttachment; aliased (not re-declared) so the two shapes cannot drift.
 */
export type DmMessageAttachment = ChannelMessageAttachment;

/** Intent of a DM event. A single version, so intent is always canonicalized. */
export type DmMessageIntent = 'message' | 'react';

/** An immutable, sender-signed direct-message event (Plan 21). */
export interface DmMessageEvent {
  version: 1;
  /** Content hash of the signed body and signature. */
  id: string;
  /** Anchor-derived conversation id (see dmConversationId). */
  conversationId: string;
  /** Ed25519 device id. */
  authorDeviceId: string;
  body: string;
  attachments?: DmMessageAttachment[];
  hlc: Hlc;
  /** If set, this event edits or tombstones a prior message id. */
  supersedes?: { id: string; deleted: boolean };
  /** Event intent (always signature-covered). */
  intent?: DmMessageIntent;
  /** Hex Ed25519 signature over the canonical event form. */
  signature: string;
}

export type DmMessageInput = Omit<
  DmMessageEvent,
  'version' | 'id' | 'authorDeviceId' | 'signature'
>;

type UnsignedDmMessageEvent = Omit<DmMessageEvent, 'id' | 'signature'>;
type SignedDmMessageWithoutId = Omit<DmMessageEvent, 'id'>;

function canonicalAttachments(
  attachments: readonly DmMessageAttachment[] | undefined,
): Array<[string, string, string, string, number]> {
  return (attachments ?? []).map((attachment) => [
    attachment.id,
    attachment.blobHash,
    attachment.name,
    attachment.mimeType,
    attachment.size,
  ]);
}

/**
 * Canonical byte form of an unsigned DM event. The FIRST element is the
 * DM-specific domain string, distinct from channel-message, so a DM and a
 * channel message can never cross-verify (TC-2).
 */
function canonicalDmMessage(message: UnsignedDmMessageEvent): Uint8Array {
  const base: unknown[] = [
    'meerkat-dm-message-v1',
    message.version,
    message.conversationId,
    message.authorDeviceId,
    message.body,
    canonicalAttachments(message.attachments),
    message.hlc.wall,
    message.hlc.counter,
    message.supersedes ? [message.supersedes.id, message.supersedes.deleted] : null,
    message.intent ?? null,
  ];
  return encoder.encode(JSON.stringify(base));
}

/** Content id = hash of the signed canonical form plus the signature. */
export function dmMessageId(message: SignedDmMessageWithoutId): string {
  const { signature, ...unsigned } = message;
  const canonical = canonicalDmMessage(unsigned);
  const signatureBytes = encoder.encode(signature);
  const bytes = new Uint8Array(canonical.length + signatureBytes.length);
  bytes.set(canonical, 0);
  bytes.set(signatureBytes, canonical.length);
  return sha512Hex(bytes).slice(0, 32);
}

/**
 * Derive a conversation id from two identity ANCHORS (not device keys), sorted
 * so it is order-independent. Anchors mean every device of either party derives
 * the SAME id. A single-device participant's anchor IS its device public key.
 */
export function dmConversationId(anchorA: string, anchorB: string): string {
  const [lo, hi] = [anchorA, anchorB].sort();
  const canonical = JSON.stringify(['meerkat-dm-conversation-v1', lo, hi]);
  return sha512Hex(encoder.encode(canonical)).slice(0, 32);
}

/** Create a signed DM event. */
export function createDmMessage(
  author: DeviceIdentity,
  input: DmMessageInput,
): DmMessageEvent {
  const unsigned: UnsignedDmMessageEvent = {
    version: 1,
    authorDeviceId: author.publicKey,
    ...input,
  };
  const privateKeyHex = extractSigningPrivateKeyHex(author.privateKeyRef);
  const signature = bytesToHex(signMessage(privateKeyHex, canonicalDmMessage(unsigned)));
  const id = dmMessageId({ ...unsigned, signature });
  return { ...unsigned, id, signature };
}

export function verifyDmMessage(message: DmMessageEvent): boolean {
  if (message.version !== 1) return false;
  if (message.id !== dmMessageId(message)) return false;

  try {
    const { id, signature, ...unsigned } = message;
    void id;
    return verifySignature(
      message.authorDeviceId,
      canonicalDmMessage(unsigned),
      hexToBytes(signature),
    );
  } catch {
    return false;
  }
}

/** Deterministic total order: wall, then counter, then author, then id. */
export function compareDmMessages(a: DmMessageEvent, b: DmMessageEvent): number {
  if (a.hlc.wall !== b.hlc.wall) return a.hlc.wall < b.hlc.wall ? -1 : 1;
  if (a.hlc.counter !== b.hlc.counter) return a.hlc.counter - b.hlc.counter;
  if (a.authorDeviceId !== b.authorDeviceId) {
    return a.authorDeviceId < b.authorDeviceId ? -1 : 1;
  }
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

/** Normalized intent: a DM event with no intent field is a 'message'. */
function normalizedIntent(event: DmMessageEvent): DmMessageIntent {
  return event.intent ?? 'message';
}

/**
 * Resolve immutable edit/delete events into the visible DM list.
 * Edits keep the original message's slot; deletes remove that slot.
 *
 * A supersede is AUTHOR-BOUND and INTENT-BOUND (fail-closed, pure + deterministic,
 * no env branches) exactly like resolveChannelMessages. Only the ORIGINAL author
 * of a root may edit or delete it, and a supersede may not cross intents. Every
 * DM event is individually signed, but a signed tombstone only proves who authored
 * the TOMBSTONE, not that they may censor the target. Without this bind, ANY DM
 * participant (1:1 or group) could sign a tombstone naming another participant's
 * message id and delete it for everyone, and a react tombstone could censor a
 * message. A mismatched supersede is ignored and the target stays active; the
 * hostile event is simply never applied (it may still be stored).
 */
export function resolveDmMessages(events: readonly DmMessageEvent[]): DmMessageEvent[] {
  const ordered = [...events].sort(compareDmMessages);
  const rootByEventId = new Map<string, string>();
  const rootOrder: string[] = [];
  const visibleByRoot = new Map<string, DmMessageEvent>();
  const rootAuthor = new Map<string, string>();
  const rootIntent = new Map<string, DmMessageIntent>();

  for (const event of ordered) {
    if (!event.supersedes) {
      rootByEventId.set(event.id, event.id);
      if (!rootOrder.includes(event.id)) rootOrder.push(event.id);
      visibleByRoot.set(event.id, event);
      rootAuthor.set(event.id, event.authorDeviceId);
      rootIntent.set(event.id, normalizedIntent(event));
      continue;
    }

    const rootId = rootByEventId.get(event.supersedes.id);
    if (!rootId) continue;
    // Fail-closed author + intent bind: a supersede from anyone but the root's
    // author, or across intents, is ignored (the target is NOT touched).
    if (event.authorDeviceId !== rootAuthor.get(rootId)) continue;
    if (normalizedIntent(event) !== rootIntent.get(rootId)) continue;

    rootByEventId.set(event.id, rootId);
    if (event.supersedes.deleted) {
      visibleByRoot.delete(rootId);
    } else {
      visibleByRoot.set(rootId, event);
    }
  }

  return rootOrder
    .map((rootId) => visibleByRoot.get(rootId))
    .filter((event): event is DmMessageEvent => event !== undefined);
}
