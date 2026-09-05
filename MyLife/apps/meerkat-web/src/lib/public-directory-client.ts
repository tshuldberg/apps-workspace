// Public directory probe client (Plan 19, Meerkat Public Social Layer -- P5a, web
// twin). Mirrors apps/meerkat/app/(root)/data/public-directory-client.ts; the only
// difference is where the settings helpers and the directory URL key are sourced
// (./meerkat-data here vs ./db + ./sync-core on mobile).
//
// The app-side, device-local read path over @mylife/sync's OPEN public-directory
// client (browse/search). It reads the configured directory host from mk_settings
// (PUBLIC_DIRECTORY_URL_SETTING), asks the directory for verified
// PublicationDescriptors, maps each to a VerifiedPublicEntry, caches it in the
// device-local cm_public_directory_cache (verified=1, never synced), and returns
// the verified set for the Discover surface and the Feed public source.
//
// Honesty: announcing_hosts is the REAL distinct serving-host count the directory
// returned (DirectoryEntry.announcingHosts), never fabricated. event_count stays
// the directory's value (0 in P2) and latest_wall is the owner-signed
// descriptor.updatedAt until a reader actually pulls and verifies the snapshot.
// No URL configured => { configured: false }; configured but unreachable =>
// { configured: true, respondedAt: null }; configured + responded (even with zero
// entries) => respondedAt set. The responded-but-empty case is the Discover Empty
// state, never a visible-but-empty Public control (feed-core TC-5).

import type { DatabaseAdapter } from '@mylife/db';
import {
  browsePublications,
  fetchPublicPage,
  hlcAfter,
  searchPublications,
  type AcceptedPublicPost,
  type ChannelMessageEvent,
  type DirectoryEntry,
  type Hlc,
  type PublicCategory,
} from '@mylife/sync';
import { PUBLIC_DIRECTORY_URL_SETTING, getSetting } from './meerkat-data';

// The full fixed public taxonomy (mirrors the engine PublicCategory enum, plan
// section 8). The rendered chip set and this list are the same closed set.
export const PUBLIC_CATEGORIES: readonly PublicCategory[] = [
  'technology',
  'gaming',
  'news',
  'sports',
  'local',
  'hobbies',
  'creative',
  'discussion',
  'other',
];

// A verified directory row, mirroring the cm_public_directory_cache columns.
export interface VerifiedPublicEntry {
  publication_id: string;
  kind: string;
  title: string;
  description: string;
  category: string;
  owner_device_id: string;
  content_id: string;
  public_key_hex: string;
  /** JSON array of reachable serving-host URLs. */
  host_urls: string;
  /** REAL distinct announcing-host count from the directory. Never fabricated. */
  announcing_hosts: number;
  /** From the verified snapshot; 0 until a reader pulls it. */
  event_count: number;
  /** HLC wall of the newest signed event; descriptor.updatedAt until a snapshot pull. */
  latest_wall: string;
  source_host: string;
  fetched_at: string;
  verified: boolean;
}

/** Injectable WebSocket constructor (defaults to the global one in the app). */
type DirectoryWebSocket = Parameters<typeof browsePublications>[0]['webSocketImpl'];

export interface ProbePublicDirectoryInput {
  /** Browse a single category. Ignored when searchTerms is non-empty. */
  category?: PublicCategory;
  /** Search terms; when present the probe searches instead of browsing. */
  searchTerms?: string[];
  /** Global WebSocket, injected by the app. */
  webSocketImpl?: DirectoryWebSocket;
  /** Clock seam (defaults to wall-clock ISO). */
  now?: () => string;
  /** Test seam: the real @mylife/sync browse client by default. */
  browseFn?: typeof browsePublications;
  /** Test seam: the real @mylife/sync search client by default. */
  searchFn?: typeof searchPublications;
}

export interface ProbePublicDirectoryResult {
  configured: boolean;
  respondedAt: string | null;
  entries: VerifiedPublicEntry[];
}

interface DirectoryCacheRow {
  publication_id: string;
  kind: string;
  title: string;
  description: string;
  category: string;
  owner_device_id: string;
  content_id: string;
  public_key_hex: string;
  host_urls: string;
  announcing_hosts: number;
  event_count: number;
  latest_wall: string;
  source_host: string;
  fetched_at: string;
  verified: number;
}

function rowToEntry(row: DirectoryCacheRow): VerifiedPublicEntry {
  return {
    publication_id: row.publication_id,
    kind: row.kind,
    title: row.title,
    description: row.description,
    category: row.category,
    owner_device_id: row.owner_device_id,
    content_id: row.content_id,
    public_key_hex: row.public_key_hex,
    host_urls: row.host_urls,
    announcing_hosts: row.announcing_hosts,
    event_count: row.event_count,
    latest_wall: row.latest_wall,
    source_host: row.source_host,
    fetched_at: row.fetched_at,
    verified: row.verified === 1,
  };
}

function directoryEntryToVerified(entry: DirectoryEntry, fetchedAt: string): VerifiedPublicEntry {
  const d = entry.descriptor;
  return {
    publication_id: d.publicationId,
    kind: d.kind,
    title: d.title,
    description: d.description,
    category: d.category,
    owner_device_id: d.ownerDeviceId,
    content_id: d.contentId,
    public_key_hex: d.publicKeyHex,
    host_urls: JSON.stringify(d.hostUrls),
    // REAL distinct serving-host count from the directory; never fabricated.
    announcing_hosts: entry.announcingHosts,
    // 0 in P2 (the directory holds no snapshots); populated when a reader verifies.
    event_count: entry.eventCount,
    // Owner-signed recency until a verified snapshot pull replaces it.
    latest_wall: d.updatedAt,
    source_host: entry.sourceHost,
    fetched_at: fetchedAt,
    verified: true,
  };
}

function upsertDirectoryCacheRow(db: DatabaseAdapter, entry: VerifiedPublicEntry): void {
  db.execute(
    `INSERT OR REPLACE INTO cm_public_directory_cache (
      publication_id, kind, title, description, category, owner_device_id,
      content_id, public_key_hex, host_urls, announcing_hosts, event_count,
      latest_wall, source_host, fetched_at, verified
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.publication_id,
      entry.kind,
      entry.title,
      entry.description,
      entry.category,
      entry.owner_device_id,
      entry.content_id,
      entry.public_key_hex,
      entry.host_urls,
      entry.announcing_hosts,
      entry.event_count,
      entry.latest_wall,
      entry.source_host,
      entry.fetched_at,
      entry.verified ? 1 : 0,
    ],
  );
}

/**
 * Read verified rows from the device-local directory cache for warm display
 * before a fresh probe completes. Ordered by newest signed activity first.
 */
export function getDirectoryCacheEntries(
  db: DatabaseAdapter,
  category?: string,
): VerifiedPublicEntry[] {
  const rows = category
    ? db.query<DirectoryCacheRow>(
        `SELECT publication_id, kind, title, description, category, owner_device_id,
                content_id, public_key_hex, host_urls, announcing_hosts, event_count,
                latest_wall, source_host, fetched_at, verified
         FROM cm_public_directory_cache
         WHERE verified = 1 AND category = ?
         ORDER BY latest_wall DESC`,
        [category],
      )
    : db.query<DirectoryCacheRow>(
        `SELECT publication_id, kind, title, description, category, owner_device_id,
                content_id, public_key_hex, host_urls, announcing_hosts, event_count,
                latest_wall, source_host, fetched_at, verified
         FROM cm_public_directory_cache
         WHERE verified = 1
         ORDER BY latest_wall DESC`,
      );
  return rows.map(rowToEntry);
}

/**
 * Read a single verified directory-cache row by publication id. Used by the
 * Public Reader to bootstrap the host + published-key + owner-signed binding it
 * needs before pulling the snapshot. Returns null when the row is absent or not
 * yet verified (verified=0 rows are display-suppressed, plan section 4.3).
 */
export function getDirectoryCacheEntry(
  db: DatabaseAdapter,
  publicationId: string,
): VerifiedPublicEntry | null {
  const rows = db.query<DirectoryCacheRow>(
    `SELECT publication_id, kind, title, description, category, owner_device_id,
            content_id, public_key_hex, host_urls, announcing_hosts, event_count,
            latest_wall, source_host, fetched_at, verified
     FROM cm_public_directory_cache
     WHERE publication_id = ? AND verified = 1`,
    [publicationId],
  );
  const row = rows[0];
  return row ? rowToEntry(row) : null;
}

/**
 * Probe the configured public directory. Returns { configured:false } when no URL
 * is set; { configured:true, respondedAt:null } on a network failure (configured
 * but unreachable = error state); and a responded result (respondedAt set) on
 * success, with every verified entry upserted into the device-local cache. A
 * responded-but-empty result keeps respondedAt set with zero entries, which the
 * Feed treats as "no source available" (TC-5).
 */
export async function probePublicDirectory(
  db: DatabaseAdapter,
  input: ProbePublicDirectoryInput = {},
): Promise<ProbePublicDirectoryResult> {
  const url = (getSetting(db, PUBLIC_DIRECTORY_URL_SETTING) ?? '').trim();
  if (!url) return { configured: false, respondedAt: null, entries: [] };

  const browse = input.browseFn ?? browsePublications;
  const search = input.searchFn ?? searchPublications;
  const clock = input.now ?? (() => new Date().toISOString());
  const terms = (input.searchTerms ?? []).filter((term) => term.trim().length > 0);

  try {
    let raw: DirectoryEntry[];
    if (terms.length > 0) {
      raw = await search({ url, terms, webSocketImpl: input.webSocketImpl });
    } else if (input.category) {
      raw = await browse({ url, category: input.category, webSocketImpl: input.webSocketImpl });
    } else {
      // No category/terms: browse the full fixed taxonomy and union by id.
      const byId = new Map<string, DirectoryEntry>();
      for (const category of PUBLIC_CATEGORIES) {
        const page = await browse({ url, category, webSocketImpl: input.webSocketImpl });
        for (const entry of page) byId.set(entry.descriptor.publicationId, entry);
      }
      raw = [...byId.values()];
    }

    const fetchedAt = clock();
    const entries: VerifiedPublicEntry[] = [];
    for (const entry of raw) {
      if (!entry.verified) continue;
      const mapped = directoryEntryToVerified(entry, fetchedAt);
      upsertDirectoryCacheRow(db, mapped);
      entries.push(mapped);
    }
    return { configured: true, respondedAt: fetchedAt, entries };
  } catch {
    // Configured but unreachable: the honest error state, never a fabricated row.
    return { configured: true, respondedAt: null, entries: [] };
  }
}

// --- FF2 warm-tail paging (section 5.6): device-local cursor + incremental reader ---
// cm_public_feed_cursor is device_local and NEVER synced (omitted from the synced
// scope; the existing TC-7 guard pattern). These helpers + pagePublicReader let the
// Public reader append only the warm tail instead of re-importing the full snapshot
// on every focus.

/** Read the device-local warm-tail cursor for a (publication, channel). null = genesis. */
export function getPublicFeedCursor(
  db: DatabaseAdapter,
  publicationId: string,
  channelId: string,
): Hlc | null {
  const rows = db.query<{ last_wall: string; last_counter: number }>(
    "SELECT last_wall, last_counter FROM cm_public_feed_cursor WHERE publication_id = ? AND channel_id = ?",
    [publicationId, channelId],
  );
  const row = rows[0];
  return row ? { wall: row.last_wall, counter: row.last_counter } : null;
}

/** Advance the device-local warm-tail cursor (row-only; never synced). */
export function setPublicFeedCursor(
  db: DatabaseAdapter,
  publicationId: string,
  channelId: string,
  hlc: Hlc,
  sourceHost: string,
  now: string = new Date().toISOString(),
): void {
  db.execute(
    `INSERT OR REPLACE INTO cm_public_feed_cursor (
      publication_id, channel_id, last_wall, last_counter, source_host, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [publicationId, channelId, hlc.wall, hlc.counter, sourceHost, now],
  );
}

export interface PagePublicReaderInput {
  /** A reachable serving-host base url. */
  baseUrl: string;
  publicationId: string;
  channelId: string;
  /** The owner-signed descriptor.communityId; every event must match it (scope bind). */
  expectedCommunityId: string;
  /**
   * The descriptor-pinned node receipt key (descriptor.postNodeKeyHex, Plan 39).
   * Enables dual-verified PUBLIC POSTS on the page; absent = posts are dropped
   * fail-closed (unverifiable = unseen).
   */
  pinnedNodeKeyHex?: string | null;
  limit?: number;
  fetchFn?: typeof fetch;
  now?: () => string;
}

export type PagePublicReaderResult =
  | {
    ok: true;
    events: ChannelMessageEvent[];
    /** Dual-verified node-accepted public posts (Plan 39 P6), receipt-HLC order. */
    publicPosts: AcceptedPublicPost[];
    hasMore: boolean;
    cursorAdvanced: boolean;
  }
  | { ok: false; reason: "fetch_failed" | "not_found" | "bad_cursor" | "bad_page" };

/**
 * Pull ONE warm-tail page of a public channel and advance the cursor (FF2). Reads the
 * device-local cursor, fetches only events strictly after it via the OPEN page route
 * (fetchPublicPage re-verifies every event author signature + community/channel scope,
 * fail-closed -- the node is never trusted), advances the cursor (row-only,
 * device_local) to the newest verified event, and returns the new verified events for
 * the reader to append. A second call with no newer content returns [] and does not
 * advance, so re-paging never duplicates.
 */
export async function pagePublicReader(
  db: DatabaseAdapter,
  input: PagePublicReaderInput,
): Promise<PagePublicReaderResult> {
  const after = getPublicFeedCursor(db, input.publicationId, input.channelId);
  const page = await fetchPublicPage({
    baseUrl: input.baseUrl,
    publicationId: input.publicationId,
    channelId: input.channelId,
    expectedCommunityId: input.expectedCommunityId,
    pinnedNodeKeyHex: input.pinnedNodeKeyHex,
    after,
    limit: input.limit,
    fetchFn: input.fetchFn,
  });
  if (!page.ok) return { ok: false, reason: page.reason };
  // Cursor = the newest VERIFIED item, never the node's word: a hostile cursor
  // could otherwise skip past withheld events. A posts-only page still advances.
  let lastHlc = page.events[page.events.length - 1]?.hlc ?? null;
  const lastPostHlc = page.publicPosts[page.publicPosts.length - 1]?.receipt.hlc ?? null;
  if (lastPostHlc && (!lastHlc || hlcAfter(lastPostHlc, lastHlc))) lastHlc = lastPostHlc;
  let cursorAdvanced = false;
  if (lastHlc) {
    const stamp = (input.now ?? (() => new Date().toISOString()))();
    setPublicFeedCursor(db, input.publicationId, input.channelId, lastHlc, input.baseUrl, stamp);
    cursorAdvanced = true;
  }
  return { ok: true, events: page.events, publicPosts: page.publicPosts, hasMore: page.hasMore, cursorAdvanced };
}
