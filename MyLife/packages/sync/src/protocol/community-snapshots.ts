/**
 * Rolling community snapshots + warm-tail cursor (community feed P1).
 *
 * P0 distributed the epoch keys; P1 packages each channel's resolved feed into
 * ONE rolling signed snapshot per channel and lets a warm puller transfer only
 * the events AFTER its per-(community,channel) cursor.
 *
 * This module is PURE and App-Isolation safe: it owns no cm_ knowledge and
 * imports nothing from any app. The caller (the app helper layer) reads the
 * verified ChannelMessageEvents out of its own cm_messages table, hands them in,
 * and provides a piece store. The snapshot itself is built/sealed/verified by
 * the existing channel-history.ts primitives (buildChannelHistory /
 * parseChannelHistory); this module only orchestrates them per channel, writes
 * the pieces to a host-style store, persists rolling-snapshot metadata, and
 * computes the incremental tail.
 *
 * Compaction: exactly ONE rolling snapshot per channel. When a channel's
 * snapshot is rebuilt under a new content id, the previous content's pieces are
 * removed from the store (the old infoHash is no longer referenced).
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { ContentManifest, DeviceIdentity } from '../types';
import { ContentManifestSchema } from '../types';
import { getCurrentEpochKey } from './group-keys';
import {
  buildChannelHistory,
  parseChannelHistory,
} from './channel-history';
import {
  highestEventHlc,
  type ChannelMessageEvent,
  type Hlc,
} from './channel-message';

/**
 * A minimal host-style piece store. Structurally compatible with
 * meerkat-relay's SeederPieceStore (so InMemorySeederPieceStore satisfies it),
 * but declared here so @mylife/sync never imports meerkat-relay.
 */
export interface SnapshotPieceStore {
  put(infoHash: string, index: number, bytes: Uint8Array): void | Promise<void>;
  get(infoHash: string, index: number): Uint8Array | null | Promise<Uint8Array | null>;
  removeContent(infoHash: string): void | Promise<void>;
}

/** Persisted rolling-snapshot metadata (the app stores this in cm_snapshots). */
export interface CommunitySnapshotRecord {
  communityId: string;
  channelId: string;
  epoch: number;
  snapshotId: string;
  infoHash: string;
  /** HLC of the highest event the snapshot covers (the cold-start watermark). */
  throughWall: string;
  throughCounter: number;
  /** JSON.stringify of the catalog ContentManifest. */
  manifestJson: string;
  eventCount: number;
  /**
   * Total opaque piece bytes of this snapshot (the cold-start transfer size).
   * Optional: set on the freshly BUILT record; the app's row-reader may omit it
   * (no DB column required, keeping P6 item 4 a light touch).
   */
  totalBytes?: number;
  /**
   * True when this snapshot exceeds a configured cap (bytes or pieces). The
   * snapshot is STILL built and served in full -- never silently truncated -- so
   * the cold-start pull stays correct; this is an HONEST signal the caller logs so
   * a future re-baseline / split can act on it (P6 item 4). Optional for the same
   * row-reader reason as totalBytes.
   */
  oversized?: boolean;
  createdAt: string;
}

/** One channel's verified events the app read from cm_messages. */
export interface SnapshotChannelInput {
  channelId: string;
  events: ChannelMessageEvent[];
}

/**
 * Default cold-start snapshot caps (P6 item 4). These are HONEST-SIGNAL caps, not
 * hard limits: a channel whose snapshot exceeds them is still built + served in
 * full (so the feed stays correct), but flagged `oversized: true` so the caller can
 * log it and schedule a re-baseline / split. 8 MiB / 4096 pieces is a generous
 * ceiling for one channel's rolling snapshot; tune per deployment.
 */
export const DEFAULT_MAX_SNAPSHOT_BYTES = 8 * 1024 * 1024;
export const DEFAULT_MAX_SNAPSHOT_PIECES = 4096;

/** A snapshot that tripped a cap, surfaced to the caller's log hook. */
export interface OversizedSnapshot {
  channelId: string;
  infoHash: string;
  totalBytes: number;
  pieces: number;
  maxBytes: number;
  maxPieces: number;
}

export interface BuildCommunitySnapshotsInput {
  db: DatabaseAdapter;
  identity: DeviceIdentity;
  communityId: string;
  channels: SnapshotChannelInput[];
  pieceStore: SnapshotPieceStore;
  /** Prior rolling-snapshot records for this community (drives compaction). */
  previous?: CommunitySnapshotRecord[];
  webSeeds?: string[];
  /** Byte cap before a snapshot is flagged oversized (default 8 MiB). */
  maxSnapshotBytes?: number;
  /** Piece-count cap before a snapshot is flagged oversized (default 4096). */
  maxSnapshotPieces?: number;
  /** Honest log hook: called once per oversized snapshot. Never throws upward. */
  log?: (event: 'snapshot_oversized', detail: OversizedSnapshot) => void;
  now?: string;
}

export interface BuildCommunitySnapshotsResult {
  records: CommunitySnapshotRecord[];
  skipped: Array<{ channelId: string; reason: 'no_key' | 'empty' }>;
  /** Snapshots that tripped a cap (built + served in full, flagged for follow-up). */
  oversized: OversizedSnapshot[];
}

/** a strictly after b in HLC total order. */
export function hlcAfter(a: Hlc, b: Hlc): boolean {
  if (a.wall !== b.wall) return a.wall > b.wall;
  return a.counter > b.counter;
}

/**
 * Build one rolling snapshot per non-empty channel under the community's current
 * epoch key. Each channel's snapshot pieces are written to the piece store under
 * the catalog infoHash; the returned records are the metadata the app persists.
 * Compaction removes a channel's previous content from the store when its
 * infoHash changes (one rolling snapshot per channel).
 */
export async function buildCommunitySnapshots(
  input: BuildCommunitySnapshotsInput,
): Promise<BuildCommunitySnapshotsResult> {
  const epochKey = getCurrentEpochKey(input.db, input.communityId, input.identity);
  const now = input.now ?? new Date().toISOString();
  const maxBytes = input.maxSnapshotBytes ?? DEFAULT_MAX_SNAPSHOT_BYTES;
  const maxPieces = input.maxSnapshotPieces ?? DEFAULT_MAX_SNAPSHOT_PIECES;
  const records: CommunitySnapshotRecord[] = [];
  const skipped: BuildCommunitySnapshotsResult['skipped'] = [];
  const oversized: OversizedSnapshot[] = [];

  if (!epochKey) {
    for (const channel of input.channels) skipped.push({ channelId: channel.channelId, reason: 'no_key' });
    return { records, skipped, oversized };
  }

  const previousByChannel = new Map<string, CommunitySnapshotRecord>();
  for (const record of input.previous ?? []) previousByChannel.set(record.channelId, record);

  for (const channel of input.channels) {
    if (channel.events.length === 0) {
      skipped.push({ channelId: channel.channelId, reason: 'empty' });
      continue;
    }

    const built = buildChannelHistory({
      communityId: input.communityId,
      channelId: channel.channelId,
      workspaceId: input.communityId,
      epoch: epochKey.epoch,
      events: channel.events,
      groupKey: epochKey.secret,
      signer: input.identity,
      createdAt: now,
      webSeeds: input.webSeeds,
    });

    const infoHash = built.catalog.manifest.infoHash;
    let totalBytes = 0;
    for (let index = 0; index < built.pieces.length; index += 1) {
      totalBytes += built.pieces[index].length;
      await input.pieceStore.put(infoHash, index, built.pieces[index]);
    }

    // Compaction: drop the previous content's pieces if the id changed.
    const prior = previousByChannel.get(channel.channelId);
    if (prior && prior.infoHash !== infoHash) {
      await input.pieceStore.removeContent(prior.infoHash);
    }

    // HONEST cap signal (P6 item 4). The snapshot is built + stored in FULL above
    // (never truncated, so the cold-start pull stays correct). If it tripped a cap
    // we flag it + log it so a future re-baseline / split can act; the pull keeps
    // its natural piece-by-piece paging.
    const isOversized = totalBytes > maxBytes || built.pieces.length > maxPieces;
    if (isOversized) {
      const detail: OversizedSnapshot = {
        channelId: channel.channelId,
        infoHash,
        totalBytes,
        pieces: built.pieces.length,
        maxBytes,
        maxPieces,
      };
      oversized.push(detail);
      try { input.log?.('snapshot_oversized', detail); } catch { /* a log failure never breaks the build */ }
    }

    const through = highestEventHlc(built.snapshot.events);
    records.push({
      communityId: input.communityId,
      channelId: channel.channelId,
      epoch: epochKey.epoch,
      snapshotId: built.snapshot.snapshotId,
      infoHash,
      throughWall: through?.wall ?? '',
      throughCounter: through?.counter ?? 0,
      manifestJson: JSON.stringify(built.catalog.manifest),
      eventCount: built.snapshot.events.length,
      totalBytes,
      oversized: isOversized,
      createdAt: now,
    });
  }

  return { records, skipped, oversized };
}

/** Safe-parse a stored manifest JSON into a ContentManifest, or null. */
export function parseSnapshotManifest(json: string): ContentManifest | null {
  const trimmed = json.trim();
  if (!trimmed) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  const result = ContentManifestSchema.safeParse(parsed);
  return result.success ? result.data : null;
}

export interface ImportSnapshotFromPiecesInput {
  communityId: string;
  channelId: string;
  epoch: number;
  manifest: ContentManifest;
  pieceStore: SnapshotPieceStore;
  /** Unwrapped epoch secret. deriveEpochContentKey is applied inside parseChannelHistory. */
  groupKey: Uint8Array;
  existingEvents?: readonly ChannelMessageEvent[];
  /** When set, newEvents are only the snapshot events strictly AFTER this HLC. */
  sinceHlc?: Hlc | null;
}

export type ImportSnapshotResult =
  | {
    ok: true;
    /** Full resolved-feed event set carried by the snapshot (ordered). */
    events: ChannelMessageEvent[];
    /** Events strictly after sinceHlc (the warm tail); all events when no cursor. */
    newEvents: ChannelMessageEvent[];
    snapshotId: string;
  }
  | { ok: false; reason: 'missing_piece' | Extract<
      ReturnType<typeof parseChannelHistory>,
      { ok: false }
    >['reason'] };

/**
 * Read a channel's snapshot pieces back from a piece store, parse + verify them
 * with the epoch key, and split the carried events into the full set plus the
 * warm tail (events strictly after a cursor). Fails closed on a missing piece or
 * any parse/verify failure (it never writes anything; the app does the merge).
 */
export async function importSnapshotFromPieces(
  input: ImportSnapshotFromPiecesInput,
): Promise<ImportSnapshotResult> {
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
    epoch: input.epoch,
    manifest: input.manifest,
    pieces,
    groupKey: input.groupKey,
  });
  if (!parsed.ok) return { ok: false, reason: parsed.reason };

  const sinceHlc = input.sinceHlc ?? null;
  const newEvents = sinceHlc
    ? parsed.events.filter((event) => hlcAfter(event.hlc, sinceHlc))
    : [...parsed.events];

  return { ok: true, events: parsed.events, newEvents, snapshotId: parsed.snapshot.snapshotId };
}

// ---------------------------------------------------------------------------
// Scheduler hook (pure core only).
//
// runCommunitySnapshotJob is the pure heart a future OS scheduler will call. It
// rebuilds the rolling snapshots when the per-channel tail since the last
// snapshot exceeds a threshold (or always, on demand). Mirrors the pure shape of
// runMailboxDrainJob: injected stores + db + identity, no native wiring.
//
// TODO: OS scheduling (expo-task-manager / expo-background-task) is DEFERRED
// behind the existing dev flag, exactly like background-task-registration.ts.
// This function is exercised on demand today; the cadence wake is future work.
// ---------------------------------------------------------------------------

export interface CommunitySnapshotJobInput {
  db: DatabaseAdapter;
  identity: DeviceIdentity;
  communityId: string;
  channels: SnapshotChannelInput[];
  pieceStore: SnapshotPieceStore;
  previous?: CommunitySnapshotRecord[];
  /** Rebuild a channel when its tail beyond the last snapshot exceeds this. */
  rebuildThreshold?: number;
  /** Force a rebuild of every non-empty channel regardless of the tail size. */
  force?: boolean;
  webSeeds?: string[];
  now?: string;
}

export interface CommunitySnapshotJobResult extends BuildCommunitySnapshotsResult {
  /** Channels left untouched because the tail was under the rebuild threshold. */
  unchanged: Array<{ channelId: string; tail: number }>;
}

/** Number of events in a channel strictly after a record's watermark. */
function tailCount(
  events: readonly ChannelMessageEvent[],
  record: CommunitySnapshotRecord | undefined,
): number {
  if (!record || !record.throughWall) return events.length;
  const watermark: Hlc = { wall: record.throughWall, counter: record.throughCounter };
  return events.filter((event) => hlcAfter(event.hlc, watermark)).length;
}

export async function runCommunitySnapshotJob(
  input: CommunitySnapshotJobInput,
): Promise<CommunitySnapshotJobResult> {
  const threshold = input.rebuildThreshold ?? 50;
  const previousByChannel = new Map<string, CommunitySnapshotRecord>();
  for (const record of input.previous ?? []) previousByChannel.set(record.channelId, record);

  const toRebuild: SnapshotChannelInput[] = [];
  const unchanged: CommunitySnapshotJobResult['unchanged'] = [];

  for (const channel of input.channels) {
    if (channel.events.length === 0) {
      // Empty channels fall through to buildCommunitySnapshots, which records the
      // honest 'empty' skip reason.
      toRebuild.push(channel);
      continue;
    }
    const tail = tailCount(channel.events, previousByChannel.get(channel.channelId));
    const noSnapshotYet = !previousByChannel.has(channel.channelId);
    if (input.force || noSnapshotYet || tail >= threshold) {
      toRebuild.push(channel);
    } else {
      unchanged.push({ channelId: channel.channelId, tail });
    }
  }

  const built = await buildCommunitySnapshots({
    db: input.db,
    identity: input.identity,
    communityId: input.communityId,
    channels: toRebuild,
    pieceStore: input.pieceStore,
    previous: input.previous,
    webSeeds: input.webSeeds,
    now: input.now,
  });

  return { ...built, unchanged };
}
