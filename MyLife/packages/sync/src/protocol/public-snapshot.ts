/**
 * Public, non-confidential, author-signed channel snapshots (Plan 19, P1).
 *
 * Mirrors community-snapshots' build/import orchestration (piece-store put/get,
 * infoHash, oversize signal) but keys the seal off a publication's PUBLISHED
 * content key instead of the private community epoch key. It does NOT roll a
 * parallel seal: build + import both go through the SAME extended
 * buildChannelHistory / parseChannelHistory path, passing the derived public
 * sealKey in place of the epoch groupKey.
 *
 * Confidentiality is intentionally ZERO. The seal key is derived from the
 * publication's NON-secret public key, so anyone who can read the directory entry
 * or share link can derive it. Because that key is public, the secretbox MAC is
 * NOT an authenticity boundary against someone who knows it. The injected sealKey
 * exists only to keep one uniform code path through the seal; it is a transparency
 * wrapper carried in the clear, not a secret.
 *
 * What import verifies, and what it does NOT.
 *  - INTERNAL integrity + authenticity are FULL. importPublicSnapshot reuses
 *    parseChannelHistory, which verifies every piece hash (assembleVerifiedCatalogBytes
 *    + verifyCatalogPiece), the snapshot signature, the snapshot scope, every event's
 *    Ed25519 author signature, and each event's content-id, failing closed on ANY
 *    mismatch -- the same posture as openSealedShare. A host cannot tamper, inject,
 *    reorder, or silently drop events INSIDE a given snapshot without detection.
 *  - It does NOT, by itself, prove the snapshot is a SPECIFIC publication's content.
 *    Anyone holding the (non-secret) public key can build a fully self-signed
 *    snapshot under their OWN device identity and seal it with the same derived key;
 *    that passes every internal check. The load-bearing binding is `expectedAuthor`:
 *    the caller MUST pass the owner-signed PublicationDescriptor's `ownerDeviceId` so
 *    import enforces snapshot.signerDeviceId === expectedAuthor fail-closed. The snapshot
 *    signer is signature-verified and unforgeable, so that check is what actually rejects
 *    a substituted self-signed snapshot. `expectedContentId` (the descriptor's `contentId`,
 *    checked as manifest.infoHash === contentId) is a cheap pre-filter only: infoHash is
 *    NOT re-derived against the pieces on this path, so on its own it blocks a mismatched
 *    id but not self-consistent forged pieces that carry the claimed id. Pass BOTH in
 *    practice; without `expectedAuthor`, import only attests internal authenticity, not
 *    publication identity.
 *
 * No private epoch key is ever used or exposed.
 *
 * Scope convention: public snapshots ride workspaceId = communityId and a FIXED
 * public-epoch sentinel (PUBLIC_SNAPSHOT_EPOCH). The seal ignores both (the
 * sealKey wins); they only travel inside the signed snapshot, so build and import
 * pass the same values for the snapshot-scope check to pass.
 */

import { hkdf } from '../node/hkdf';
import type { ContentManifest, DeviceIdentity } from '../types';
import {
  buildChannelHistory,
  parseChannelHistory,
} from './channel-history';
import {
  DEFAULT_MAX_SNAPSHOT_BYTES,
  DEFAULT_MAX_SNAPSHOT_PIECES,
  hlcAfter,
  type ImportSnapshotResult,
  type SnapshotPieceStore,
} from './community-snapshots';
import {
  highestEventHlc,
  type ChannelMessageEvent,
  type Hlc,
} from './channel-message';

/** Public snapshots carry a fixed sentinel epoch; the seal uses the published key, not the epoch. */
const PUBLIC_SNAPSHOT_EPOCH = 0;
/** HKDF info binding the published content key to the public-snapshot domain. */
const PUBLIC_SNAPSHOT_KEY_INFO = 'meerkat-public-snapshot-v1';

/**
 * Derive the NON-secret published content key from a publication's public key.
 * Identical in build and import so the seal round-trips. This is NOT a secret:
 * anyone holding the publication's public key can derive it. Confidentiality is
 * intentionally zero; this key only provides a uniform seal path.
 */
export function derivePublicSnapshotSealKey(publicKey: Uint8Array): Uint8Array {
  return hkdf(publicKey, PUBLIC_SNAPSHOT_KEY_INFO, null, 32);
}

export interface BuildPublicSnapshotInput {
  identity: DeviceIdentity;
  publicationId: string;
  /** Source community (rides inside the signed snapshot scope; not used by the seal). */
  communityId: string;
  channelId: string;
  events: ChannelMessageEvent[];
  /** The publication's PUBLISHED public key. The seal key is derived from this. NON-secret. */
  publicKey: Uint8Array;
  pieceStore: SnapshotPieceStore;
  webSeeds?: string[];
  /** Byte cap before a snapshot is flagged oversized (default 8 MiB). */
  maxSnapshotBytes?: number;
  /** Piece-count cap before a snapshot is flagged oversized (default 4096). */
  maxSnapshotPieces?: number;
  now?: string;
}

/** Persisted public-snapshot metadata (the directory/host stores this). */
export interface PublicSnapshotRecord {
  publicationId: string;
  communityId: string;
  channelId: string;
  snapshotId: string;
  infoHash: string;
  /** HLC of the highest event the snapshot covers (the cold-start watermark). */
  throughWall: string;
  throughCounter: number;
  /** JSON.stringify of the signed catalog ContentManifest. */
  manifestJson: string;
  eventCount: number;
  /** Total opaque piece bytes (the cold-start transfer size). */
  totalBytes: number;
  /**
   * True when the snapshot exceeds a configured cap. It is STILL built + served in
   * full (never truncated), so the cold-start pull stays correct; the flag is an
   * honest signal the caller logs for a future re-baseline / split.
   */
  oversized: boolean;
  createdAt: string;
}

export interface ImportPublicSnapshotInput {
  publicationId: string;
  /** Source community (must match the snapshot scope; not used by the seal). */
  communityId: string;
  channelId: string;
  manifest: ContentManifest;
  pieceStore: SnapshotPieceStore;
  /** The publication's PUBLISHED public key. The seal key is derived from this. */
  publicKey: Uint8Array;
  /**
   * The owner-signed PublicationDescriptor.contentId. When set, import binds the
   * snapshot to the publication: manifest.infoHash MUST equal it, else fail-closed
   * with content_id_mismatch. REQUIRED to trust the snapshot as a specific
   * publication's content (the public seal key alone cannot establish this).
   */
  expectedContentId?: string;
  /**
   * The owner-signed PublicationDescriptor.ownerDeviceId. When set, the snapshot's
   * signing device MUST equal it, else fail-closed with author_mismatch. Mirrors
   * openSealedShare's expectedAuthor posture.
   */
  expectedAuthor?: string;
  /** When set, newEvents are only the snapshot events strictly AFTER this HLC. */
  sinceHlc?: Hlc | null;
}

/** Failure reasons import can return: the channel-history set plus the publication-binding checks. */
type ImportSnapshotFailureReason = Extract<ImportSnapshotResult, { ok: false }>['reason'];

export type ImportPublicSnapshotResult =
  | Extract<ImportSnapshotResult, { ok: true }>
  | { ok: false; reason: ImportSnapshotFailureReason | 'content_id_mismatch' | 'author_mismatch' };

/**
 * Build one public snapshot for a publication's channel under its published key.
 * Pieces are written to the piece store under the catalog infoHash; the returned
 * record is the metadata the directory/host persists. The snapshot is always built
 * + stored in full; an oversize trip only sets the honest `oversized` flag.
 *
 * Empty events are rejected (throws). community-snapshots SKIPS empty channels with
 * an honest 'empty' reason; this single-record builder has no skip channel, so a
 * zero-event publish is treated as a caller bug rather than silently producing an
 * empty signed snapshot. The caller must filter empty channels before publishing.
 */
export async function buildPublicSnapshot(input: BuildPublicSnapshotInput): Promise<PublicSnapshotRecord> {
  if (input.events.length === 0) {
    throw new Error('buildPublicSnapshot requires at least one event.');
  }
  const now = input.now ?? new Date().toISOString();
  const maxBytes = input.maxSnapshotBytes ?? DEFAULT_MAX_SNAPSHOT_BYTES;
  const maxPieces = input.maxSnapshotPieces ?? DEFAULT_MAX_SNAPSHOT_PIECES;
  const sealKey = derivePublicSnapshotSealKey(input.publicKey);

  const built = buildChannelHistory({
    communityId: input.communityId,
    channelId: input.channelId,
    workspaceId: input.communityId,
    epoch: PUBLIC_SNAPSHOT_EPOCH,
    events: input.events,
    sealKey,
    signer: input.identity,
    createdAt: now,
    webSeeds: input.webSeeds,
  });

  const infoHash = built.catalog.manifest.infoHash;
  let totalBytes = 0;
  for (let index = 0; index < built.pieces.length; index += 1) {
    totalBytes += built.pieces[index]!.length;
    await input.pieceStore.put(infoHash, index, built.pieces[index]!);
  }

  const oversized = totalBytes > maxBytes || built.pieces.length > maxPieces;
  const through = highestEventHlc(built.snapshot.events);

  return {
    publicationId: input.publicationId,
    communityId: input.communityId,
    channelId: input.channelId,
    snapshotId: built.snapshot.snapshotId,
    infoHash,
    throughWall: through?.wall ?? '',
    throughCounter: through?.counter ?? 0,
    manifestJson: JSON.stringify(built.catalog.manifest),
    eventCount: built.snapshot.events.length,
    totalBytes,
    oversized,
    createdAt: now,
  };
}

/**
 * Read a publication's snapshot pieces back from a piece store, parse + verify them
 * with the derived public key, and split the carried events into the full set plus
 * the warm tail (events strictly after a cursor). Fails closed on a missing piece
 * or any parse/verify failure; it never writes anything (the caller does the merge).
 *
 * Publication binding (fail-closed, when provided): expectedContentId enforces
 * manifest.infoHash === contentId; expectedAuthor enforces the snapshot signer ===
 * ownerDeviceId. Pass the owner-signed PublicationDescriptor's contentId (and
 * ownerDeviceId) to trust the snapshot as that publication's content; without them
 * a holder of the non-secret public key could substitute self-signed content.
 */
export async function importPublicSnapshot(input: ImportPublicSnapshotInput): Promise<ImportPublicSnapshotResult> {
  // Bind to the publication before any work: a manifest whose infoHash is not the
  // owner-signed contentId is not this publication's content, full stop.
  if (input.expectedContentId !== undefined && input.manifest.infoHash !== input.expectedContentId) {
    return { ok: false, reason: 'content_id_mismatch' };
  }

  const sealKey = derivePublicSnapshotSealKey(input.publicKey);

  const pieces = new Map<number, Uint8Array>();
  for (let index = 0; index < input.manifest.pieces.length; index += 1) {
    const piece = await input.pieceStore.get(input.manifest.infoHash, index);
    if (!piece) return { ok: false, reason: 'missing_piece' };
    pieces.set(index, piece);
  }

  const parsed = parseChannelHistory({
    communityId: input.communityId,
    channelId: input.channelId,
    workspaceId: input.communityId,
    epoch: PUBLIC_SNAPSHOT_EPOCH,
    manifest: input.manifest,
    pieces,
    sealKey,
  });
  if (!parsed.ok) return { ok: false, reason: parsed.reason };

  // The internal checks pass for ANY self-signed snapshot sealed under the public
  // key; bind the signer to the owner-signed identity to reject substitution.
  if (input.expectedAuthor !== undefined && parsed.snapshot.signerDeviceId !== input.expectedAuthor) {
    return { ok: false, reason: 'author_mismatch' };
  }

  const sinceHlc = input.sinceHlc ?? null;
  const newEvents = sinceHlc
    ? parsed.events.filter((event) => hlcAfter(event.hlc, sinceHlc))
    : [...parsed.events];

  return { ok: true, events: parsed.events, newEvents, snapshotId: parsed.snapshot.snapshotId };
}
