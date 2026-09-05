import type { DatabaseAdapter } from '@mylife/db';
import {
  ContentManifestSchema,
  fetchChannelHistory,
  getCurrentEpochKey,
  type ChannelMessageEvent,
  type DeviceIdentity,
} from '@mylife/sync';
import { getFeedCursor, listChannelMessageEvents, mergeChannelMessageEvents, setFeedCursor } from './meerkat-data';

export type WebHistoryImportResult =
  | { ok: true; inserted: number; importedEvents: ChannelMessageEvent[]; message: string }
  | { ok: false; reason: string; message: string };

function httpsSeeds(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter((value) => /^https:\/\//iu.test(value)))];
}

/** Manual web fallback. It verifies the complete snapshot before any local merge. */
export async function importChannelHistoryManifest(input: {
  db: DatabaseAdapter;
  identity: DeviceIdentity;
  communityId: string;
  channelId: string;
  manifestJson: string;
  hosts: readonly string[];
  expectedCatalogCid: string | null;
  fetchFn?: typeof fetch;
  fetchHistory?: typeof fetchChannelHistory;
  now?: string;
}): Promise<WebHistoryImportResult> {
  let raw: unknown;
  try {
    if (!input.manifestJson.trim() || input.manifestJson.length > 512 * 1024) throw new Error('invalid');
    raw = JSON.parse(input.manifestJson);
  } catch {
    return { ok: false, reason: 'invalid_manifest', message: 'Paste a valid history manifest JSON document.' };
  }
  const parsed = ContentManifestSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: 'invalid_manifest', message: 'The JSON is not a valid signed-history content manifest.' };
  if (input.expectedCatalogCid && parsed.data.infoHash !== input.expectedCatalogCid) {
    return { ok: false, reason: 'catalog_mismatch', message: 'The manifest does not match this community catalog.' };
  }
  const epochKey = getCurrentEpochKey(input.db, input.communityId, input.identity);
  if (!epochKey) return { ok: false, reason: 'no_key', message: 'This browser does not hold the current community key.' };
  const manifest = { ...parsed.data, webSeeds: httpsSeeds(parsed.data.webSeeds) };
  const cursor = getFeedCursor(input.db, input.communityId, input.channelId);
  const fetched = await (input.fetchHistory ?? fetchChannelHistory)({
    communityId: input.communityId,
    channelId: input.channelId,
    workspaceId: input.communityId,
    epoch: epochKey.epoch,
    manifest,
    groupKey: epochKey.secret,
    existingEvents: listChannelMessageEvents(input.db, input.communityId, input.channelId),
    hosts: httpsSeeds(input.hosts),
    fetchFn: input.fetchFn,
  }).catch(() => ({ ok: false as const, reason: 'fetch_failed' as const, failedPieces: [] }));
  if (!fetched.ok) {
    return { ok: false, reason: fetched.reason, message: `History was not imported because verification failed (${fetched.reason}).` };
  }
  let inserted = 0;
  let importedEvents: ChannelMessageEvent[] = [];
  const now = input.now ?? new Date().toISOString();
  input.db.transaction(() => {
    const merged = mergeChannelMessageEvents(input.db, fetched.events);
    inserted = merged.inserted;
    importedEvents = merged.insertedEvents;
    const highest = fetched.events.at(-1)?.hlc ?? null;
    if (highest && (!cursor || highest.wall > cursor.wall || (highest.wall === cursor.wall && highest.counter > cursor.counter))) {
      setFeedCursor(input.db, input.communityId, input.channelId, highest, now);
    }
  });
  return {
    ok: true,
    inserted,
    importedEvents,
    message: inserted > 0 ? `Verified and imported ${inserted} history event${inserted === 1 ? '' : 's'}.` : 'History verified. No new events were found.',
  };
}
