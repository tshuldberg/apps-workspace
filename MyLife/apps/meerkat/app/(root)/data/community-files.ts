// community-files.ts: pure, native-free logic for the per-community Files index
// and bulk export (Phase 2 of Files & Sharing).
//
// Why this exists (Critical, mirrors community-core + blob-store-core + file-save):
//   The honesty-critical decisions of the Files index must be testable without
//   React Native:
//     1. AGGREGATE from RESOLVED message events (resolveChannelMessages output via
//        listChannelMessages), reading event.attachments, NEVER the
//        cm_message_attachments rows. Those rows are INSERT OR IGNORE and are
//        never tombstoned, so reading them surfaces ghost files from
//        deleted/superseded messages. The resolved events already collapse
//        edits/deletes, so they are the only honest source.
//     2. PRESENCE (on-device vs removed) comes ONLY from a real ExpoBlobStore.has()
//        check, applied as an async pass over the synchronous aggregation. A
//        removed file is not selectable for save.
//     3. BULK SAVE returns HONEST per-file outcomes from the real FileSaveResult
//        union (saved / failed-with-real-reason / skipped-because-removed). The
//        summary count is computed from those outcomes, never a blanket "all done".
//
// This module performs NO transport, NO native IO, and NO sealed-store access. It
// takes the DatabaseAdapter directly and injects loadBytes/saveOne so tests drive
// it with createInMemoryTestDatabase and fakes. The screen is a thin renderer
// over it.

import type { DatabaseAdapter } from '@mylife/db';
import type { ChannelMessageEvent, CommunityChannel } from '@mylife/sync';
import { formatBytes } from '../theme/format';
import { listChannelMessages } from './community-core';
import { LINK_PREVIEW_MIME_TYPE } from './link-preview';
import type { FileSaveResult } from './file-save';

/**
 * One aggregated file in the community Files index. Derived from a signed,
 * resolved message event's attachment metadata, tagged with the channel it was
 * shared in. `id` is a stable selection key (channelId:attachmentId). Presence is
 * NOT stored here; it is resolved live (see applyPresence / buildPresenceMap).
 */
export interface AggregatedFile {
  /** Stable selection id: `${channelId}:${attachmentId}`. */
  id: string;
  attachmentId: string;
  blobHash: string;
  name: string;
  mimeType: string;
  /** Signed attachment size (honest; never on-disk base64-inflated bytes). */
  size: number;
  channelId: string;
  channelName: string;
  /** The message event the attachment was last seen on (for ordering only). */
  messageId: string;
  authorDeviceId: string;
  /** HLC wall clock of the source message, for stable ordering. */
  hlcWall: string;
  hlcCounter: number;
}

/** A file row with its live on-device presence resolved. */
export interface PresentFile extends AggregatedFile {
  /** True only when ExpoBlobStore.has() confirmed the bytes are on this device. */
  present: boolean;
}

export interface DownloadCommunity {
  communityId: string;
  descriptor: {
    name: string;
    channels: readonly Pick<CommunityChannel, 'id' | 'name'>[];
  };
}

/** One global Downloads row, still sourced from the per-community aggregation. */
export interface GlobalDownloadFile extends PresentFile {
  communityId: string;
  communityName: string;
}

export type DownloadStatusFilter = 'all' | 'on-device' | 'removed';

export interface DownloadFilters {
  query: string;
  status: DownloadStatusFilter;
}

export interface DownloadSummary {
  total: number;
  onDevice: number;
  removed: number;
  onDeviceBytes: number;
  totalBytes: number;
}

/** The stable selection id for an aggregated file row. */
export function aggregatedFileId(channelId: string, attachmentId: string): string {
  return `${channelId}:${attachmentId}`;
}

export function globalDownloadFileId(communityId: string, localFileId: string): string {
  return `${communityId}:${localFileId}`;
}

/**
 * Aggregate every attachment across the given channels of a community into a
 * single de-duped list, ordered oldest-first.
 *
 * HONESTY (Critical): this walks listChannelMessages(...) (resolveChannelMessages
 * output), so edited/superseded and deleted messages are already collapsed and
 * their attachments never appear. It NEVER reads cm_message_attachments rows.
 *
 * De-dupe: the same blobHash+attachmentId can appear if the same blob is shared
 * in two messages/channels; we keep the FIRST (earliest by HLC) occurrence as the
 * single source-of-truth row.
 */
export function aggregateCommunityFiles(
  db: DatabaseAdapter,
  communityId: string,
  channels: readonly Pick<CommunityChannel, 'id' | 'name'>[],
  visibleMessagesByChannel?: ReadonlyMap<string, readonly ChannelMessageEvent[]>,
): AggregatedFile[] {
  const rows: AggregatedFile[] = [];
  for (const channel of channels) {
    const events = visibleMessagesByChannel?.get(channel.id)
      ?? listChannelMessages(db, communityId, channel.id);
    for (const event of events) {
      for (const attachment of event.attachments ?? []) {
        // Plan 32 T5.1: a link-preview payload is a decoration that rides the
        // attachment pipeline, NOT a user-shared file. Exclude it from the Files
        // index and the Feed's Files source (mirrors the channel screen, which
        // never renders it as a file chip). It is never a downloadable "file".
        if (attachment.mimeType === LINK_PREVIEW_MIME_TYPE) continue;
        rows.push({
          id: aggregatedFileId(channel.id, attachment.id),
          attachmentId: attachment.id,
          blobHash: attachment.blobHash,
          name: attachment.name,
          mimeType: attachment.mimeType,
          size: attachment.size,
          channelId: channel.id,
          channelName: channel.name,
          messageId: event.id,
          authorDeviceId: event.authorDeviceId,
          hlcWall: event.hlc.wall,
          hlcCounter: event.hlc.counter,
        });
      }
    }
  }

  // Order oldest-first across channels, then de-dupe by blobHash+attachmentId so
  // a blob shared more than once collapses to one source-of-truth row (the
  // earliest occurrence wins).
  rows.sort((a, b) => {
    if (a.hlcWall !== b.hlcWall) return a.hlcWall < b.hlcWall ? -1 : 1;
    if (a.hlcCounter !== b.hlcCounter) return a.hlcCounter - b.hlcCounter;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  const seen = new Set<string>();
  const deduped: AggregatedFile[] = [];
  for (const row of rows) {
    const key = `${row.blobHash}:${row.attachmentId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
  }
  return deduped;
}

/**
 * Resolve live on-device presence for a list of aggregated files using a real
 * has(blobHash) check. Pure: the has function is injected (ExpoBlobStore.has in
 * the app, a fake in tests). Distinct blob hashes are checked once and the result
 * fanned back out, so a long list does at most one stat per unique blob.
 */
export async function buildPresenceMap(
  files: readonly AggregatedFile[],
  has: (blobHash: string) => Promise<boolean>,
): Promise<Map<string, boolean>> {
  const uniqueHashes = [...new Set(files.map((file) => file.blobHash))];
  const presence = new Map<string, boolean>();
  await Promise.all(
    uniqueHashes.map(async (hash) => {
      presence.set(hash, await has(hash));
    }),
  );
  return presence;
}

/** Attach live presence to each file from a presence map (absent hash = removed). */
export function applyPresence(
  files: readonly AggregatedFile[],
  presence: Map<string, boolean>,
): PresentFile[] {
  return files.map((file) => ({ ...file, present: presence.get(file.blobHash) ?? false }));
}

/**
 * Aggregate every community's resolved message attachments into a single device
 * Downloads source. This intentionally builds from aggregateCommunityFiles, not
 * raw attachment rows, so deleted/superseded attachments stay invisible.
 */
export function aggregateGlobalDownloadFiles(
  db: DatabaseAdapter,
  communities: readonly DownloadCommunity[],
): Omit<GlobalDownloadFile, 'present'>[] {
  const rows: Omit<GlobalDownloadFile, 'present'>[] = [];
  for (const community of communities) {
    const files = aggregateCommunityFiles(db, community.communityId, community.descriptor.channels);
    for (const file of files) {
      rows.push({
        ...file,
        id: globalDownloadFileId(community.communityId, file.id),
        communityId: community.communityId,
        communityName: community.descriptor.name,
      });
    }
  }

  rows.sort((a, b) => {
    if (a.hlcWall !== b.hlcWall) return a.hlcWall > b.hlcWall ? -1 : 1;
    if (a.hlcCounter !== b.hlcCounter) return b.hlcCounter - a.hlcCounter;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return rows;
}

export function filterGlobalDownloadFiles(
  files: readonly GlobalDownloadFile[],
  filters: DownloadFilters,
): GlobalDownloadFile[] {
  const q = filters.query.trim().toLowerCase();
  return files.filter((file) => {
    if (filters.status === 'on-device' && !file.present) return false;
    if (filters.status === 'removed' && file.present) return false;
    if (!q) return true;
    return [
      file.name,
      file.mimeType,
      file.channelName,
      file.communityName,
      file.authorDeviceId,
    ].some((value) => value.toLowerCase().includes(q));
  });
}

export function summarizeGlobalDownloads(files: readonly GlobalDownloadFile[]): DownloadSummary {
  let onDevice = 0;
  let onDeviceBytes = 0;
  let totalBytes = 0;
  for (const file of files) {
    totalBytes += file.size;
    if (file.present) {
      onDevice += 1;
      onDeviceBytes += file.size;
    }
  }
  return {
    total: files.length,
    onDevice,
    removed: files.length - onDevice,
    onDeviceBytes,
    totalBytes,
  };
}

// ---------------------------------------------------------------------------
// Multi-select (pure reducer)
// ---------------------------------------------------------------------------

/** Selection state: a set of selected aggregated-file ids. */
export interface FileSelectionState {
  selectedIds: ReadonlySet<string>;
}

export type FileSelectionAction =
  | { type: 'toggle'; id: string }
  | { type: 'select-all'; files: readonly PresentFile[] }
  | { type: 'clear' };

export const EMPTY_FILE_SELECTION: FileSelectionState = { selectedIds: new Set() };

/**
 * Pure selection reducer. `toggle` flips one row. `select-all` selects ONLY the
 * on-device rows (removed files are never selectable). `clear` empties.
 */
export function fileSelectionReducer(
  state: FileSelectionState,
  action: FileSelectionAction,
): FileSelectionState {
  switch (action.type) {
    case 'toggle': {
      const next = new Set(state.selectedIds);
      if (next.has(action.id)) next.delete(action.id);
      else next.add(action.id);
      return { selectedIds: next };
    }
    case 'select-all': {
      const next = new Set<string>();
      for (const file of action.files) {
        if (file.present) next.add(file.id);
      }
      return { selectedIds: next };
    }
    case 'clear':
      return EMPTY_FILE_SELECTION;
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

/** A derived summary of the current selection, computed from the LIVE presence list. */
export interface SelectionSummary {
  count: number;
  bytes: number;
  label: string;
}

/**
 * Summarize the selection from the live presence list (NOT the static aggregation),
 * so the bulk bar's "N files, X MB" only ever counts files whose bytes are present.
 * A selected id that is no longer present (or no longer exists) is excluded.
 */
export function summarizeSelection(
  files: readonly PresentFile[],
  selectedIds: ReadonlySet<string>,
): SelectionSummary {
  let count = 0;
  let bytes = 0;
  for (const file of files) {
    if (file.present && selectedIds.has(file.id)) {
      count += 1;
      bytes += file.size;
    }
  }
  return { count, bytes, label: `${count} file${count === 1 ? '' : 's'} · ${formatBytes(bytes)}` };
}

/** The set of files that a bulk save will act on: selected AND present. */
export function resolveFilesToSave(
  files: readonly PresentFile[],
  selectedIds: ReadonlySet<string>,
): PresentFile[] {
  return files.filter((file) => file.present && selectedIds.has(file.id));
}

// ---------------------------------------------------------------------------
// Bulk save orchestration (honest per-file outcomes)
// ---------------------------------------------------------------------------

/** The honest per-file outcome of a bulk save, mapped from the real FileSaveResult. */
export type PerFileSaveOutcome =
  | { id: string; name: string; status: 'saved'; location: 'files-app' | 'saf-folder' }
  | { id: string; name: string; status: 'failed'; reason: string }
  | { id: string; name: string; status: 'skipped'; reason: string };

export interface BulkSaveResult {
  total: number;
  savedCount: number;
  failedCount: number;
  skippedCount: number;
  perFile: PerFileSaveOutcome[];
}

/** Honest copy reused by the screen and asserted by tests; never claims "all done". */
export function bulkSaveHeadline(result: BulkSaveResult): string {
  return `${result.savedCount} of ${result.total} saved`;
}

const REMOVED_SKIP_REASON = 'Not on this device. Request it first.';
const NO_DESTINATION_REASON = 'No save folder is set. Choose one and try again.';
const CANCELLED_REASON = 'Save cancelled. Nothing was written.';

export interface SaveOneInput {
  bytes: Uint8Array;
  name: string;
  mimeType: string;
}

export interface SaveFilesBulkArgs {
  /** The files to save. The caller passes only selected + present rows. */
  files: readonly AggregatedFile[];
  /** Loads the verified plaintext bytes for a blob hash; null = removed/absent. */
  loadBytes: (blobHash: string) => Promise<Uint8Array | null>;
  /** The single verified-write core (NodeProvider.saveContent / saveBytesToDestination). */
  saveOne: (input: SaveOneInput) => Promise<FileSaveResult>;
}

/**
 * Save a set of files one at a time, returning an HONEST per-file result list.
 *
 * SEQUENTIAL (Critical): each saveOne is awaited before the next begins so an
 * Android SAF verified write (or an iOS staged-and-verified copy) completes
 * before the next, and the summary count reflects only confirmed writes.
 *
 * Per file:
 *   - loadBytes returns null (the bytes are not on this device, i.e. removed) ->
 *     'skipped' with an honest reason; never counted as saved or failed.
 *   - saveOne 'saved'             -> 'saved' (the real verified location).
 *   - saveOne 'failed'            -> 'failed' with the REAL reason string.
 *   - saveOne 'no-destination'    -> 'failed' (honest "set a folder" reason).
 *   - saveOne 'cancelled'         -> 'skipped' (honest "nothing written" reason).
 *   - saveOne throws              -> 'failed' with the thrown message.
 *
 * The summary counts are derived from the real outcomes; the header line uses
 * bulkSaveHeadline (e.g. "2 of 3 saved"), never a blanket "all done".
 */
export async function saveFilesBulk(args: SaveFilesBulkArgs): Promise<BulkSaveResult> {
  const perFile: PerFileSaveOutcome[] = [];
  let savedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const file of args.files) {
    const bytes = await args.loadBytes(file.blobHash);
    if (!bytes) {
      perFile.push({ id: file.id, name: file.name, status: 'skipped', reason: REMOVED_SKIP_REASON });
      skippedCount += 1;
      continue;
    }

    let result: FileSaveResult;
    try {
      result = await args.saveOne({ bytes, name: file.name, mimeType: file.mimeType });
    } catch (err) {
      perFile.push({
        id: file.id,
        name: file.name,
        status: 'failed',
        reason: err instanceof Error && err.message ? err.message : String(err),
      });
      failedCount += 1;
      continue;
    }

    switch (result.kind) {
      case 'saved':
        perFile.push({ id: file.id, name: file.name, status: 'saved', location: result.location });
        savedCount += 1;
        break;
      case 'failed':
        perFile.push({ id: file.id, name: file.name, status: 'failed', reason: result.reason });
        failedCount += 1;
        break;
      case 'no-destination':
        perFile.push({ id: file.id, name: file.name, status: 'failed', reason: NO_DESTINATION_REASON });
        failedCount += 1;
        break;
      case 'cancelled':
        perFile.push({ id: file.id, name: file.name, status: 'skipped', reason: CANCELLED_REASON });
        skippedCount += 1;
        break;
      default: {
        const _exhaustive: never = result;
        return _exhaustive;
      }
    }
  }

  return { total: args.files.length, savedCount, failedCount, skippedCount, perFile };
}

/** Per-file outcome copy for the result list (saved is location-aware, honest on iOS). */
export function perFileOutcomeLabel(outcome: PerFileSaveOutcome): string {
  switch (outcome.status) {
    case 'saved':
      return outcome.location === 'saf-folder'
        ? 'saved · verified on disk'
        : 'saved · verified copy in the Files app';
    case 'failed':
      return `failed · ${outcome.reason}`;
    case 'skipped':
      return outcome.reason;
    default: {
      const _exhaustive: never = outcome;
      return _exhaustive;
    }
  }
}
