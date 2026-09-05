/**
 * Signed, group-key-encrypted channel history snapshots (plan 15, MK-055).
 *
 * Live channel events are the source of truth. A history snapshot is a compact,
 * signed batch of already signed ChannelMessageEvents, then encrypted under the
 * community workspace epoch content key and published as a community catalog
 * file. Hosts seed opaque bytes only: nonce || ciphertext. The decrypted
 * payload carries the community/channel/workspace/epoch scope and the snapshot
 * signature, so a corrupt host or wrong group key fails closed.
 */

import nacl from 'tweetnacl';
import type { ContentManifest, DeviceIdentity } from '../types';
import {
  extractSigningPrivateKeyHex,
  signMessage,
  verifySignature,
} from '../identity/device-identity';
import { bytesToHex, hexToBytes } from '../encryption/keys';
import { decrypt, encrypt } from '../encryption/encrypt';
import { sha512Hex } from '../node/hkdf';
import { buildCommunityCatalog, catalogPieceBytes, verifyCatalogPiece, type CommunityCatalog } from '../torrent/community-catalog';
import { WebSeedClient } from '../torrent/web-seed';
import { deriveEpochContentKey } from './group-keys';
import {
  compareChannelMessages,
  verifyChannelMessage,
  type ChannelMessageAttachment,
  type ChannelMessageEvent,
} from './channel-message';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const NONCE_BYTES = nacl.secretbox.nonceLength;

export interface ChannelHistoryScope {
  communityId: string;
  channelId: string;
  workspaceId: string;
  epoch: number;
}

export interface SignedChannelHistorySnapshot extends ChannelHistoryScope {
  version: 1;
  snapshotId: string;
  createdAt: string;
  signerDeviceId: string;
  events: ChannelMessageEvent[];
  signature: string;
}

/**
 * Compile-time XOR for the seal-key choice: a caller must supply EXACTLY ONE of
 * groupKey (the PRIVATE epoch path; deriveEpochContentKey is applied) or sealKey
 * (the NON-secret published content key, used verbatim by the cipher on the
 * public-snapshot path). The union blocks passing neither/both at compile time;
 * assertExactlyOneSealKey re-checks at runtime as defense in depth.
 *
 * WARNING: a PRIVATE-feed caller that passes sealKey would seal the private feed
 * under a non-secret key (zero confidentiality). Only the public-snapshot path
 * (protocol/public-snapshot.ts) should ever pass sealKey.
 */
export type SealKeyChoice =
  | { groupKey: Uint8Array; sealKey?: never }
  | { sealKey: Uint8Array; groupKey?: never };

interface BuildChannelHistoryInputBase extends ChannelHistoryScope {
  events: readonly ChannelMessageEvent[];
  signer: DeviceIdentity;
  createdAt?: string;
  pieceLength?: number;
  webSeeds?: string[];
}

export type BuildChannelHistoryInput = BuildChannelHistoryInputBase & SealKeyChoice;

export interface BuildChannelHistoryResult {
  snapshot: SignedChannelHistorySnapshot;
  catalog: CommunityCatalog;
  pieces: Uint8Array[];
}

interface ParseChannelHistoryInputBase extends ChannelHistoryScope {
  manifest: ContentManifest;
  pieces: readonly Uint8Array[] | Map<number, Uint8Array>;
}

export type ParseChannelHistoryInput = ParseChannelHistoryInputBase & SealKeyChoice;

/** Loose seal-key carrier for the internal resolver (runtime-guarded, not XOR-typed). */
interface SealKeyResolution {
  groupKey?: Uint8Array;
  sealKey?: Uint8Array;
  workspaceId: string;
  epoch: number;
}

export type ParseChannelHistoryResult =
  | { ok: true; snapshot: SignedChannelHistorySnapshot; events: ChannelMessageEvent[] }
  | {
    ok: false;
    reason:
      | 'bad_manifest'
      | 'missing_piece'
      | 'bad_piece'
      | 'decrypt_failed'
      | 'invalid_json'
      | 'wrong_scope'
      | 'bad_snapshot_signature'
      | 'bad_message_signature';
  };

type ParseChannelHistoryFailureReason = Extract<ParseChannelHistoryResult, { ok: false }>['reason'];

export interface FetchChannelHistoryInput extends ChannelHistoryScope {
  manifest: ContentManifest;
  /** Unwrapped workspace epoch secret. deriveEpochContentKey is applied here. */
  groupKey: Uint8Array;
  /** Already recorded live/session events. Used for dedupe. */
  existingEvents?: readonly ChannelMessageEvent[];
  /** Descriptor host URLs or explicit web-seed URLs. Combined with manifest.webSeeds. */
  hosts?: readonly string[];
  /** Known per-piece copy counts. Lower values are fetched first. */
  pieceAvailability?: ReadonlyMap<number, number> | readonly number[];
  fetchFn?: typeof fetch;
  requestTimeoutMs?: number;
  maxConcurrent?: number;
}

export type FetchChannelHistoryResult =
  | {
    ok: true;
    snapshot: SignedChannelHistorySnapshot;
    events: ChannelMessageEvent[];
    mergedEvents: ChannelMessageEvent[];
    importedCount: number;
    fetchedPieces: number[];
    failedPieces: number[];
  }
  | {
    ok: false;
    reason: 'no_hosts' | 'fetch_failed' | ParseChannelHistoryFailureReason;
    mergedEvents: ChannelMessageEvent[];
    failedPieces: number[];
  };

type UnsignedChannelHistorySnapshot = Omit<SignedChannelHistorySnapshot, 'snapshotId' | 'signature'>;
type SignedChannelHistoryWithoutId = Omit<SignedChannelHistorySnapshot, 'snapshotId'>;

function canonicalAttachments(
  attachments: readonly ChannelMessageAttachment[] | undefined,
): Array<[string, string, string, string, number]> {
  return (attachments ?? []).map((attachment) => [
    attachment.id,
    attachment.blobHash,
    attachment.name,
    attachment.mimeType,
    attachment.size,
  ]);
}

function canonicalHistoryEvent(event: ChannelMessageEvent): unknown[] {
  return [
    event.version,
    event.id,
    event.communityId,
    event.channelId,
    event.authorDeviceId,
    event.body,
    canonicalAttachments(event.attachments),
    event.hlc.wall,
    event.hlc.counter,
    event.supersedes ? [event.supersedes.id, event.supersedes.deleted] : null,
    event.signature,
  ];
}

function canonicalChannelHistorySnapshot(snapshot: UnsignedChannelHistorySnapshot): Uint8Array {
  return encoder.encode(JSON.stringify([
    'meerkat-channel-history-v1',
    snapshot.version,
    snapshot.communityId,
    snapshot.channelId,
    snapshot.workspaceId,
    snapshot.epoch,
    snapshot.createdAt,
    snapshot.signerDeviceId,
    snapshot.events.map(canonicalHistoryEvent),
  ]));
}

export function channelHistorySnapshotId(snapshot: SignedChannelHistoryWithoutId): string {
  const { signature, ...unsigned } = snapshot;
  const canonical = canonicalChannelHistorySnapshot(unsigned);
  const signatureBytes = encoder.encode(signature);
  const bytes = new Uint8Array(canonical.length + signatureBytes.length);
  bytes.set(canonical, 0);
  bytes.set(signatureBytes, canonical.length);
  return sha512Hex(bytes).slice(0, 32);
}

function normalizeHistoryEvents(
  input: BuildChannelHistoryInput,
): ChannelMessageEvent[] {
  const seen = new Set<string>();
  const ordered = [...input.events].sort(compareChannelMessages);
  const events: ChannelMessageEvent[] = [];

  for (const event of ordered) {
    if (seen.has(event.id)) continue;
    if (event.communityId !== input.communityId || event.channelId !== input.channelId) {
      throw new Error('Channel history event scope does not match the snapshot scope.');
    }
    if (!verifyChannelMessage(event)) {
      throw new Error(`Invalid channel message in history snapshot: ${event.id}`);
    }
    seen.add(event.id);
    events.push(event);
  }

  return events;
}

/** Exactly one of groupKey or sealKey must be supplied; neither/both is a caller bug. */
function assertExactlyOneSealKey(
  groupKey: Uint8Array | undefined,
  sealKey: Uint8Array | undefined,
): void {
  if ((groupKey !== undefined) === (sealKey !== undefined)) {
    throw new Error('Channel history requires exactly one of groupKey or sealKey.');
  }
}

/**
 * The symmetric content key the snapshot seals under. When sealKey is supplied
 * (the non-confidential public-snapshot path) it is used verbatim; otherwise the
 * private epoch path derives deriveEpochContentKey(groupKey, workspaceId, epoch),
 * byte-for-byte unchanged from before this feature.
 */
function resolveSealContentKey(input: SealKeyResolution): Uint8Array {
  assertExactlyOneSealKey(input.groupKey, input.sealKey);
  if (input.sealKey !== undefined) return input.sealKey;
  if (input.groupKey === undefined) {
    // unreachable: narrowing for tsc (assertExactlyOneSealKey already guaranteed one).
    throw new Error('Channel history requires exactly one of groupKey or sealKey.');
  }
  return deriveEpochContentKey(input.groupKey, input.workspaceId, input.epoch);
}

function sealHistorySnapshot(
  snapshot: SignedChannelHistorySnapshot,
  input: SealKeyResolution,
): Uint8Array {
  const contentKey = resolveSealContentKey(input);
  const sealed = encrypt(encoder.encode(JSON.stringify(snapshot)), contentKey);
  const bytes = new Uint8Array(sealed.nonce.length + sealed.ciphertext.length);
  bytes.set(sealed.nonce, 0);
  bytes.set(sealed.ciphertext, sealed.nonce.length);
  return bytes;
}

export function buildChannelHistory(input: BuildChannelHistoryInput): BuildChannelHistoryResult {
  // The seal-key XOR is enforced compile-time by SealKeyChoice and at runtime by
  // resolveSealContentKey inside sealHistorySnapshot below (single source of truth).
  const events = normalizeHistoryEvents(input);
  const unsigned: UnsignedChannelHistorySnapshot = {
    version: 1,
    communityId: input.communityId,
    channelId: input.channelId,
    workspaceId: input.workspaceId,
    epoch: input.epoch,
    createdAt: input.createdAt ?? new Date().toISOString(),
    signerDeviceId: input.signer.publicKey,
    events,
  };

  const privateKeyHex = extractSigningPrivateKeyHex(input.signer.privateKeyRef);
  const signature = bytesToHex(signMessage(privateKeyHex, canonicalChannelHistorySnapshot(unsigned)));
  const snapshotId = channelHistorySnapshotId({ ...unsigned, signature });
  const snapshot: SignedChannelHistorySnapshot = { ...unsigned, snapshotId, signature };
  const encrypted = sealHistorySnapshot(snapshot, input);
  const catalog = buildCommunityCatalog({
    communityName: 'Meerkat channel history',
    description: 'Encrypted channel history snapshot',
    entries: [{
      path: `history/${snapshotId}.mkhist`,
      data: encrypted,
      mimeType: 'application/vnd.mylife.meerkat-history',
    }],
    creatorPublicKey: input.signer.publicKey,
    creatorDisplayName: input.signer.displayName,
    creatorPrivateKey: privateKeyHex,
    pieceLength: input.pieceLength,
    webSeeds: input.webSeeds,
  });
  const pieces = catalog.manifest.pieces.map((_, index) => catalogPieceBytes(catalog, index));

  return { snapshot, catalog, pieces };
}

function pieceAt(
  pieces: readonly Uint8Array[] | Map<number, Uint8Array>,
  index: number,
): Uint8Array | undefined {
  return pieces instanceof Map ? pieces.get(index) : pieces[index];
}

function normalizeHistoryHosts(
  manifestSeeds: readonly string[],
  hosts: readonly string[] | undefined,
): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const raw of [...manifestSeeds, ...(hosts ?? [])]) {
    const value = raw.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    urls.push(value);
  }
  return urls;
}

function pieceAvailability(
  availability: FetchChannelHistoryInput['pieceAvailability'],
  index: number,
): number {
  if (!availability) return Number.MAX_SAFE_INTEGER;
  if (Array.isArray(availability)) return availability[index] ?? Number.MAX_SAFE_INTEGER;
  const copyCounts = availability as ReadonlyMap<number, number>;
  return copyCounts.get(index) ?? Number.MAX_SAFE_INTEGER;
}

function historyPieceOrder(
  manifest: ContentManifest,
  availability: FetchChannelHistoryInput['pieceAvailability'],
): number[] {
  return manifest.pieces
    .map((_, index) => index)
    .sort((a, b) => pieceAvailability(availability, a) - pieceAvailability(availability, b) || a - b);
}

function assembleVerifiedCatalogBytes(
  manifest: ContentManifest,
  pieces: readonly Uint8Array[] | Map<number, Uint8Array>,
): ParseChannelHistoryResult | Uint8Array {
  if (manifest.pieces.length === 0 || manifest.totalSize <= 0) {
    return { ok: false, reason: 'bad_manifest' };
  }

  const bytes = new Uint8Array(manifest.totalSize);
  let offset = 0;
  for (let index = 0; index < manifest.pieces.length; index += 1) {
    const piece = pieceAt(pieces, index);
    if (!piece) return { ok: false, reason: 'missing_piece' };
    if (!verifyCatalogPiece(manifest, index, piece)) {
      return { ok: false, reason: 'bad_piece' };
    }
    bytes.set(piece.slice(0, Math.min(piece.length, manifest.totalSize - offset)), offset);
    offset += piece.length;
  }

  return bytes.slice(0, manifest.totalSize);
}

function parseSnapshotJson(json: string): SignedChannelHistorySnapshot | null {
  try {
    const value = JSON.parse(json) as Partial<SignedChannelHistorySnapshot>;
    if (
      value.version !== 1
      || typeof value.snapshotId !== 'string'
      || typeof value.communityId !== 'string'
      || typeof value.channelId !== 'string'
      || typeof value.workspaceId !== 'string'
      || typeof value.epoch !== 'number'
      || typeof value.createdAt !== 'string'
      || typeof value.signerDeviceId !== 'string'
      || !Array.isArray(value.events)
      || typeof value.signature !== 'string'
    ) {
      return null;
    }
    return value as SignedChannelHistorySnapshot;
  } catch {
    return null;
  }
}

function isChannelMessageEvent(value: unknown): value is ChannelMessageEvent {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return candidate.version === 1
    && typeof candidate.id === 'string'
    && typeof candidate.communityId === 'string'
    && typeof candidate.channelId === 'string'
    && typeof candidate.authorDeviceId === 'string'
    && typeof candidate.body === 'string'
    && typeof candidate.hlc === 'object'
    && candidate.hlc !== null
    && typeof (candidate.hlc as Record<string, unknown>).wall === 'string'
    && typeof (candidate.hlc as Record<string, unknown>).counter === 'number'
    && typeof candidate.signature === 'string';
}

export function verifyChannelHistorySnapshot(snapshot: SignedChannelHistorySnapshot): boolean {
  if (snapshot.version !== 1) return false;
  if (snapshot.snapshotId !== channelHistorySnapshotId(snapshot)) return false;

  const { snapshotId, signature, ...unsigned } = snapshot;
  void snapshotId;
  try {
    if (!verifySignature(
      snapshot.signerDeviceId,
      canonicalChannelHistorySnapshot(unsigned),
      hexToBytes(signature),
    )) {
      return false;
    }
  } catch {
    return false;
  }

  return snapshot.events.every((event) =>
    isChannelMessageEvent(event)
    && event.version === 1
    && event.communityId === snapshot.communityId
    && event.channelId === snapshot.channelId
    && verifyChannelMessage(event));
}

export function parseChannelHistory(input: ParseChannelHistoryInput): ParseChannelHistoryResult {
  const contentKey = resolveSealContentKey(input);
  const assembled = assembleVerifiedCatalogBytes(input.manifest, input.pieces);
  if (!(assembled instanceof Uint8Array)) return assembled;
  if (assembled.length <= NONCE_BYTES) return { ok: false, reason: 'decrypt_failed' };

  const nonce = assembled.slice(0, NONCE_BYTES);
  const ciphertext = assembled.slice(NONCE_BYTES);
  const plaintext = decrypt(ciphertext, nonce, contentKey);
  if (!plaintext) return { ok: false, reason: 'decrypt_failed' };

  const snapshot = parseSnapshotJson(decoder.decode(plaintext));
  if (!snapshot) return { ok: false, reason: 'invalid_json' };
  if (
    snapshot.communityId !== input.communityId
    || snapshot.channelId !== input.channelId
    || snapshot.workspaceId !== input.workspaceId
    || snapshot.epoch !== input.epoch
  ) {
    return { ok: false, reason: 'wrong_scope' };
  }
  if (!verifyChannelHistorySnapshot(snapshot)) {
    return { ok: false, reason: 'bad_snapshot_signature' };
  }

  const events = [...snapshot.events].sort(compareChannelMessages);
  if (!events.every(verifyChannelMessage)) {
    return { ok: false, reason: 'bad_message_signature' };
  }

  return { ok: true, snapshot, events };
}

export function mergeChannelHistoryEvents(
  existingEvents: readonly ChannelMessageEvent[],
  historyEvents: readonly ChannelMessageEvent[],
): ChannelMessageEvent[] {
  const byId = new Map<string, ChannelMessageEvent>();
  for (const event of [...existingEvents, ...historyEvents]) {
    if (byId.has(event.id) || !verifyChannelMessage(event)) continue;
    byId.set(event.id, event);
  }
  return [...byId.values()].sort(compareChannelMessages);
}

export async function fetchChannelHistory(
  input: FetchChannelHistoryInput,
): Promise<FetchChannelHistoryResult> {
  const existingEvents = input.existingEvents ?? [];
  const hosts = normalizeHistoryHosts(input.manifest.webSeeds, input.hosts);
  if (hosts.length === 0) {
    return {
      ok: false,
      reason: 'no_hosts',
      mergedEvents: mergeChannelHistoryEvents(existingEvents, []),
      failedPieces: input.manifest.pieces.map((_, index) => index),
    };
  }

  const manifest: ContentManifest = { ...input.manifest, webSeeds: hosts };
  const order = historyPieceOrder(manifest, input.pieceAvailability);
  const client = new WebSeedClient({
    manifest,
    fetchFn: input.fetchFn,
    requestTimeoutMs: input.requestTimeoutMs,
    maxConcurrent: input.maxConcurrent,
  });
  const pieces = await client.downloadPieces(order);
  const failedPieces = order.filter((index) => !pieces.has(index));

  if (failedPieces.length > 0) {
    return {
      ok: false,
      reason: 'fetch_failed',
      mergedEvents: mergeChannelHistoryEvents(existingEvents, []),
      failedPieces,
    };
  }

  const parsed = parseChannelHistory({
    communityId: input.communityId,
    channelId: input.channelId,
    workspaceId: input.workspaceId,
    epoch: input.epoch,
    manifest,
    pieces,
    groupKey: input.groupKey,
  });

  if (!parsed.ok) {
    return {
      ok: false,
      reason: parsed.reason,
      mergedEvents: mergeChannelHistoryEvents(existingEvents, []),
      failedPieces: [],
    };
  }

  const existingIds = new Set(existingEvents.map((event) => event.id));
  const mergedEvents = mergeChannelHistoryEvents(existingEvents, parsed.events);

  return {
    ok: true,
    snapshot: parsed.snapshot,
    events: parsed.events,
    mergedEvents,
    importedCount: parsed.events.filter((event) => !existingIds.has(event.id)).length,
    fetchedPieces: order,
    failedPieces: [],
  };
}
