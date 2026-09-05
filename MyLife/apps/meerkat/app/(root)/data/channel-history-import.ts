import type { DatabaseAdapter } from '@mylife/db';
import {
  ContentManifestSchema,
  fetchChannelHistory,
  getCurrentEpochKey,
  type ChannelMessageEvent,
  type ContentManifest,
  type DeviceIdentity,
  type FetchChannelHistoryResult,
} from '@mylife/sync';
import {
  CM_MESSAGES_TABLE,
  CM_MESSAGE_ATTACHMENTS_TABLE,
  channelMessageAttachmentRowsFromEvent,
  channelMessageRowFromEvent,
  listChannelMessageEvents,
  mergeChannelMessageEvents,
} from './community-core';

/** recordLocalChange shape (SyncProvider.recordLocalChange / ChatProvider.recordLocalChange). */
export type RecordLocalChangeFn = (
  table: string,
  operation: 'INSERT' | 'UPDATE' | 'DELETE',
  rowId: string,
  data: Record<string, unknown> | null,
) => void;

/**
 * Replicate host-imported channel events onward -- the ONE two-table loop shared
 * by ChatProvider.importHistory and the settings HistoryImportSheet. It must be
 * called ONLY with mergeChannelMessageEvents' insertedEvents: those exclude
 * dropped-removed events (a removed member's post-removal posts), so a removed
 * member's messages are never re-injected to peers who fail-closed dropped them
 * (Plan 28 membership cut; peers gate on the sending peer, not the row author).
 */
export function replicateImportedHistoryEvents(
  recordLocalChange: RecordLocalChangeFn,
  insertedEvents: readonly ChannelMessageEvent[],
): void {
  for (const event of insertedEvents) {
    recordLocalChange(CM_MESSAGES_TABLE, 'INSERT', event.id, { ...channelMessageRowFromEvent(event) });
    for (const attachmentRow of channelMessageAttachmentRowsFromEvent(event)) {
      recordLocalChange(CM_MESSAGE_ATTACHMENTS_TABLE, 'INSERT', attachmentRow.id, { ...attachmentRow });
    }
  }
}

export type ChannelHistoryImportFailureReason =
  | 'empty_manifest'
  | 'invalid_json'
  | 'invalid_manifest'
  | 'catalog_mismatch'
  | 'no_key'
  | Extract<FetchChannelHistoryResult, { ok: false }>['reason'];

export type ChannelHistoryImportTone = 'success' | 'info' | 'warning' | 'error';

export type ChannelHistoryImportResult =
  | {
    ok: true;
    tone: ChannelHistoryImportTone;
    importedEvents: ChannelMessageEvent[];
    inserted: number;
    skipped: number;
    invalid: number;
    fetchedPieces: number;
    snapshotId: string;
    eventCount: number;
    message: string;
  }
  | {
    ok: false;
    tone: ChannelHistoryImportTone;
    reason: ChannelHistoryImportFailureReason;
    failedPieces: number[];
    message: string;
  };

export type ParseChannelHistoryManifestResult =
  | { ok: true; manifest: ContentManifest }
  | { ok: false; reason: 'empty_manifest' | 'invalid_json' | 'invalid_manifest' };

export interface FetchAndImportChannelHistoryInput {
  db: DatabaseAdapter;
  identity: DeviceIdentity;
  communityId: string;
  channelId: string;
  manifestJson: string;
  hosts?: readonly string[];
  expectedCatalogCid?: string | null;
  fetchFn?: typeof fetch;
  requestTimeoutMs?: number;
}

function plural(count: number, singular: string, pluralLabel = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralLabel}`;
}

function isHttpSeed(value: string): boolean {
  return value.startsWith('https://') || value.startsWith('http://');
}

export function httpHistorySeeds(seeds: readonly string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const raw of seeds) {
    const seed = raw.trim();
    if (!seed || !isHttpSeed(seed) || seen.has(seed)) continue;
    seen.add(seed);
    output.push(seed);
  }
  return output;
}

// DoS guard: bound untrusted manifest input before JSON.parse (mirrors the theme
// codec's MAX_INPUT_CHARS). Generous vs a real content manifest but caps a
// malicious paste; oversized fails closed to the existing invalid-json reason.
const MAX_MANIFEST_CHARS = 512 * 1024;

export function parseChannelHistoryManifestJson(
  manifestJson: string,
): ParseChannelHistoryManifestResult {
  const trimmed = manifestJson.trim();
  if (!trimmed) return { ok: false, reason: 'empty_manifest' };
  if (trimmed.length > MAX_MANIFEST_CHARS) return { ok: false, reason: 'invalid_json' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, reason: 'invalid_json' };
  }

  const manifest = ContentManifestSchema.safeParse(parsed);
  if (!manifest.success) return { ok: false, reason: 'invalid_manifest' };
  return { ok: true, manifest: manifest.data };
}

function failureMessage(reason: ChannelHistoryImportFailureReason, failedPieces: readonly number[]): string {
  switch (reason) {
    case 'empty_manifest':
      return 'Paste a history manifest before fetching.';
    case 'invalid_json':
      return 'The history manifest is not valid JSON.';
    case 'invalid_manifest':
      return 'The pasted JSON is not a valid content manifest.';
    case 'catalog_mismatch':
      return 'The manifest does not match this community catalog id.';
    case 'no_key':
      return 'This device does not have the current community group key for host history.';
    case 'no_hosts':
      return 'No HTTP history host is listed in the manifest or community descriptor.';
    case 'fetch_failed':
      return `Host history is still partial. ${plural(failedPieces.length, 'piece')} could not be fetched.`;
    case 'bad_manifest':
      return 'The host history manifest failed integrity checks.';
    case 'missing_piece':
      return 'The host history snapshot is missing one or more pieces.';
    case 'bad_piece':
      return 'A fetched history piece did not match the manifest hash.';
    case 'decrypt_failed':
      return 'The history snapshot could not be opened with this community key.';
    case 'wrong_scope':
      return 'The history snapshot belongs to a different community or channel.';
    case 'bad_snapshot_signature':
      return 'The history snapshot signature failed verification.';
    case 'bad_message_signature':
      return 'One or more channel messages in the history failed signature verification.';
  }
}

function failureTone(reason: ChannelHistoryImportFailureReason): ChannelHistoryImportTone {
  switch (reason) {
    case 'empty_manifest':
    case 'no_hosts':
    case 'no_key':
      return 'warning';
    case 'fetch_failed':
    case 'missing_piece':
      return 'info';
    default:
      return 'error';
  }
}

function failureResult(
  reason: ChannelHistoryImportFailureReason,
  failedPieces: number[] = [],
): ChannelHistoryImportResult {
  return {
    ok: false,
    tone: failureTone(reason),
    reason,
    failedPieces,
    message: failureMessage(reason, failedPieces),
  };
}

export async function fetchAndImportChannelHistory(
  input: FetchAndImportChannelHistoryInput,
): Promise<ChannelHistoryImportResult> {
  const parsed = parseChannelHistoryManifestJson(input.manifestJson);
  if (!parsed.ok) return failureResult(parsed.reason);

  if (input.expectedCatalogCid && parsed.manifest.infoHash !== input.expectedCatalogCid) {
    return failureResult('catalog_mismatch');
  }

  const epochKey = getCurrentEpochKey(input.db, input.communityId, input.identity);
  if (!epochKey) return failureResult('no_key');

  const manifest: ContentManifest = {
    ...parsed.manifest,
    webSeeds: httpHistorySeeds(parsed.manifest.webSeeds),
  };
  const hosts = httpHistorySeeds(input.hosts ?? []);
  const existingEvents = listChannelMessageEvents(input.db, input.communityId, input.channelId);

  let fetched: FetchChannelHistoryResult;
  try {
    fetched = await fetchChannelHistory({
      communityId: input.communityId,
      channelId: input.channelId,
      workspaceId: input.communityId,
      epoch: epochKey.epoch,
      manifest,
      groupKey: epochKey.secret,
      existingEvents,
      hosts,
      fetchFn: input.fetchFn,
      requestTimeoutMs: input.requestTimeoutMs,
    });
  } catch {
    return failureResult('fetch_failed');
  }

  if (!fetched.ok) return failureResult(fetched.reason, fetched.failedPieces);

  const merge = mergeChannelMessageEvents(input.db, fetched.events);
  // Only merge-INSERTED events are safe to replicate onward. This deliberately
  // EXCLUDES dropped-removed events (Plan 28 membership cut): a removed member's
  // post-removal posts are dropped by the merge and must never be re-injected to
  // peers via recordLocalChange.
  const importedEvents = merge.insertedEvents;
  const message = merge.inserted > 0
    ? `Imported ${plural(merge.inserted, 'history event')} from the host snapshot.`
    : 'Host history verified. No new events were found.';

  return {
    ok: true,
    tone: merge.inserted > 0 ? 'success' : 'info',
    importedEvents,
    inserted: merge.inserted,
    skipped: merge.skipped,
    invalid: merge.invalid,
    fetchedPieces: fetched.fetchedPieces.length,
    snapshotId: fetched.snapshot.snapshotId,
    eventCount: fetched.events.length,
    message,
  };
}
