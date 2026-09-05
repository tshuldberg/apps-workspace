// Meerkat local database schema (meerkat.db).
//
// The node is local-first: identity, friend code, settings, and the pinned
// manifest index live in SQLite on the device. Sealed ciphertext blocks live
// on the filesystem (see expo-node-store.ts), not here. All table names use
// the mk_ prefix. Every statement is parameterized at the call site; the DDL
// below is static.

import type { DatabaseAdapter } from '@mylife/db';
import { ensureMeerkatPinnedTables, ensureShareIntakeTables, type RelayHealth } from '@mylife/sync';
import { CREATE_MK_THEMES } from '../theme/theme-store';
import { ensureCallTables } from './call-store';
import type { CommunityPrefs } from './community-org-core';

// mk_settings key for the Android SAF default save destination (Task 2). The
// canonical declaration lives in file-save.ts next to the save logic; it is
// re-exported here so settings callers reach for it alongside getSetting/
// setSetting. No DDL change: it is just another key/value row.
export { FILE_SAVE_DIR_ANDROID } from './file-save';

// mk_settings keys shared by the Identity and Sync providers. Friend-code state
// lives in these key/value rows (no DDL change): the current code, the derived
// rendezvous id both devices meet at, and whether the code is a user-chosen
// vanity code (so the publish path can keep using the stored code as-is).
export const FRIEND_CODE_KEY = 'friend_code';
export const RENDEZVOUS_ID_KEY = 'rendezvous_id';
export const FRIEND_CODE_IS_CUSTOM_KEY = 'friend_code_is_custom';
// D.5: the persistent secret half (hex) that seals this device's published
// rendezvous record. Shared only as part of the extended friend code; never
// transmitted to the relay. Reused across republishes so the extended code is stable.
export const FRIEND_CODE_SECRET_KEY = 'friend_code_secret';
export const ONBOARDING_COMPLETE_KEY = 'onboarding_complete';

// Connection-server settings (Plan 20). Device-local mk_settings rows, never
// synced. `default_relay_optout` = '1' when the user turns the free default off;
// effectiveRelayUrl() reads it so the opt-out governs the real dial, not just
// status copy (AC-4). `adopted_server_url` is a convenience alias for a server
// adopted via a connection card (the effective dial URL still flows through
// relay_url / RELAY_URL_SETTING_KEY).
export const DEFAULT_RELAY_OPTOUT_KEY = 'default_relay_optout';
export const ADOPTED_SERVER_URL_KEY = 'adopted_server_url';

const CREATE_MK_IDENTITY = `
CREATE TABLE IF NOT EXISTS mk_identity (
  id TEXT PRIMARY KEY DEFAULT 'self',
  public_key TEXT NOT NULL,
  dh_public_key TEXT NOT NULL,
  private_key_ref TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL
)`;

const CREATE_MK_SETTINGS = `
CREATE TABLE IF NOT EXISTS mk_settings (
  key TEXT PRIMARY KEY,
  value TEXT
)`;

// mk_pinned + mk_pinned_blocks (the pinned-manifest index + sealed-block
// refcount) are context-aware (Plan 38 D.4). Their DDL + the (content_id,
// pin_context) PK migration live in @mylife/sync (ensureMeerkatPinnedTables) so
// the mobile and web surfaces share one source of truth and cannot drift, the
// same pattern as ensureShareIntakeTables.

// Plan 20: cache the LAST REAL /healthz probe per relay URL so connection status
// is honest (never fabricated). Display reads ok + probed_at; rows older than
// RELAY_PROBE_TTL_MS are ignored on read. Device-local (mk_), never replicated.
const CREATE_MK_RELAY_PROBE = `
CREATE TABLE IF NOT EXISTS mk_relay_probe (
  url          TEXT PRIMARY KEY,
  ok           INTEGER NOT NULL,
  connections  INTEGER,
  latency_ms   INTEGER,
  probed_at    TEXT NOT NULL
)`;

// Plan 38 Phase 2 (G4): per-device Communities-tab organization -- pin/favorite,
// manual reorder, optional folder. DEVICE-LOCAL and NEVER replicated: the mk_
// prefix is deliberately OUTSIDE MEERKAT_SYNC_PREFIXES, so a member's private
// arrangement of their own community list stays on the device.
const CREATE_MK_COMMUNITY_PREFS = `
CREATE TABLE IF NOT EXISTS mk_community_prefs (
  community_id TEXT PRIMARY KEY,
  pinned       INTEGER NOT NULL DEFAULT 0,
  sort_index   INTEGER,
  folder       TEXT
)`;

// Plan 38 C.7: per-library pin policy + explicit-keep marker. DEVICE-LOCAL, never
// replicated (mk_ prefix, outside MEERKAT_SYNC_PREFIXES). Kept BYTE-IDENTICAL with
// the web schema.ts twin. The pin-class LRU column (mk_pinned.last_used) is added
// by ensureMkPinnedLastUsed below.
const CREATE_MK_LIBRARY_PIN_POLICY = `
CREATE TABLE IF NOT EXISTS mk_library_pin_policy (
  library_id TEXT PRIMARY KEY,
  policy     TEXT NOT NULL CHECK(policy IN ('pin_all','fetch_on_demand')),
  updated_at TEXT NOT NULL
)`;

const CREATE_MK_LIBRARY_KEPT = `
CREATE TABLE IF NOT EXISTS mk_library_kept (
  content_id  TEXT NOT NULL,
  pin_context TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (content_id, pin_context)
)`;

// Plan 56 C1 (3.6): receiver-side render dials. DEVICE-LOCAL and NEVER synced
// (mk_ sits outside the sync prefix map): what THIS member renders is their
// private choice. community_id '' = the global row; per-community rows
// override it. Author mutes ride the same table as pref 'mute:<deviceId>'.
const CREATE_MK_RENDER_PREFS = `
CREATE TABLE IF NOT EXISTS mk_render_prefs (
  community_id TEXT NOT NULL DEFAULT '',
  pref         TEXT NOT NULL,
  value        TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (community_id, pref)
)`;

// Plan 56 C1 (8): canvas editor drafts. DEVICE-LOCAL; survives app restarts;
// draft_json is a meerkat-canvas snapshot (strict-parsed on load, a malformed
// draft is dropped, never a crash).
const CREATE_MK_CANVAS_DRAFTS = `
CREATE TABLE IF NOT EXISTS mk_canvas_drafts (
  id           TEXT PRIMARY KEY,
  community_id TEXT NOT NULL,
  canvas_id    TEXT,
  kind         TEXT NOT NULL,
  draft_json   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
)`;

/**
 * Add the mk_pinned.last_used column (fetch_cache LRU recency, Plan 38 C.7).
 * mk_pinned is @mylife/sync-owned; last_used is an additive app-side column.
 * Idempotent: SQLite has no ADD COLUMN IF NOT EXISTS, so probe first.
 */
function ensureMkPinnedLastUsed(db: DatabaseAdapter): void {
  const cols = db.query<{ name: string }>(`PRAGMA table_info(mk_pinned)`);
  if (cols.length > 0 && !cols.some((c) => c.name === 'last_used')) {
    db.execute(`ALTER TABLE mk_pinned ADD COLUMN last_used TEXT`);
  }
}

export function ensureMeerkatTables(db: DatabaseAdapter): void {
  db.execute(CREATE_MK_IDENTITY);
  db.execute(CREATE_MK_SETTINGS);
  db.execute(CREATE_MK_COMMUNITY_PREFS);
  // Context-aware pinned-manifest index + sealed-block refcount (Plan 38 D.4),
  // owned by @mylife/sync so both surfaces stay identical.
  ensureMeerkatPinnedTables(db);
  // Plan 38 C.7 pin-policy/keep tables + mk_pinned.last_used LRU column.
  db.execute(CREATE_MK_LIBRARY_PIN_POLICY);
  db.execute(CREATE_MK_LIBRARY_KEPT);
  // Plan 56 C1: receiver dials + canvas drafts (device-local, never synced).
  db.execute(CREATE_MK_RENDER_PREFS);
  db.execute(CREATE_MK_CANVAS_DRAFTS);
  ensureMkPinnedLastUsed(db);
  // Theme system (Plan 18): device-local mk_themes, never replicated. DDL owned
  // by theme-store.ts so the web twin mirrors a single source of truth.
  db.execute(CREATE_MK_THEMES);
  // Connection-server probe cache (Plan 20), device-local, never replicated.
  db.execute(CREATE_MK_RELAY_PROBE);
  // OS share-intake staging (Plan 20, Phase 8), device-local, never replicated.
  ensureShareIntakeTables(db);
  // Direct-call history + replay floor (Plan 25 WP-25G), device-local, never
  // replicated (NC-25.7). DDL lives in call-store.ts.
  ensureCallTables(db);
}

// --- settings helpers ---

export function getSetting(db: DatabaseAdapter, key: string): string | null {
  const rows = db.query<{ value: string | null }>(
    `SELECT value FROM mk_settings WHERE key = ?`,
    [key],
  );
  return rows[0]?.value ?? null;
}

export function setSetting(db: DatabaseAdapter, key: string, value: string): void {
  db.execute(
    `INSERT OR REPLACE INTO mk_settings (key, value) VALUES (?, ?)`,
    [key, value],
  );
}

export function deleteSetting(db: DatabaseAdapter, key: string): void {
  db.execute(`DELETE FROM mk_settings WHERE key = ?`, [key]);
}

// --- link-preview generation toggle (Plan 32 T3.2), device-local, DEFAULT ON ---
//
// When on, a message send whose body contains a URL fetches that page ON THIS
// (the SENDER's) device to build a preview attachment. Receivers never fetch.
// Absent row => default ON; only an explicit '0' turns it off.
export const LINK_PREVIEWS_ENABLED_SETTING_KEY = 'link_previews_enabled';

export function isLinkPreviewsEnabled(db: DatabaseAdapter): boolean {
  return getSetting(db, LINK_PREVIEWS_ENABLED_SETTING_KEY) !== '0';
}

export function setLinkPreviewsEnabled(db: DatabaseAdapter, enabled: boolean): void {
  setSetting(db, LINK_PREVIEWS_ENABLED_SETTING_KEY, enabled ? '1' : '0');
}

// --- connection-server probe cache (Plan 20) ---
//
// A cached /healthz probe is fresh for this long; older rows read as 'unknown'
// (TC-3) so a stale success can never linger on the Connection card.
export const RELAY_PROBE_TTL_MS = 60_000;

/**
 * Read the cached probe for a relay URL as a RelayHealth, or null when there is
 * no row or the row is older than RELAY_PROBE_TTL_MS. Pass `nowMs` for tests.
 */
export function getRelayProbe(
  db: DatabaseAdapter,
  url: string,
  nowMs: number = Date.now(),
): RelayHealth | null {
  if (!url) return null;
  const rows = db.query<{
    ok: number;
    connections: number | null;
    latency_ms: number | null;
    probed_at: string;
  }>(
    `SELECT ok, connections, latency_ms, probed_at FROM mk_relay_probe WHERE url = ?`,
    [url],
  );
  const row = rows[0];
  if (!row) return null;
  const probedMs = Date.parse(row.probed_at);
  if (!Number.isFinite(probedMs) || nowMs - probedMs > RELAY_PROBE_TTL_MS) return null;
  return {
    url,
    healthy: row.ok === 1,
    latencyMs: row.latency_ms ?? 0,
    connections: row.connections ?? undefined,
  };
}

/**
 * Upsert a real /healthz probe result. A stale probe never overwrites a newer
 * recorded result (probe-race guard, TC-3): if a newer row exists, this is a
 * no-op. Non-finite latency (a failed probe) is stored as NULL.
 */
export function writeRelayProbe(
  db: DatabaseAdapter,
  health: RelayHealth,
  probedAtIso: string = new Date().toISOString(),
): void {
  const existing = db.query<{ probed_at: string }>(
    `SELECT probed_at FROM mk_relay_probe WHERE url = ?`,
    [health.url],
  )[0];
  if (existing && Date.parse(existing.probed_at) > Date.parse(probedAtIso)) return;
  db.execute(
    `INSERT OR REPLACE INTO mk_relay_probe (url, ok, connections, latency_ms, probed_at)
     VALUES (?, ?, ?, ?, ?)`,
    [
      health.url,
      health.healthy ? 1 : 0,
      health.connections ?? null,
      Number.isFinite(health.latencyMs) ? Math.round(health.latencyMs) : null,
      probedAtIso,
    ],
  );
}

// --- per-community auto-update toggle (community feed P4) ---
//
// PERSONAL and NEVER synced. The feed's "auto-update on the admin poll cadence"
// switch is this device's preference only; it lives in mk_settings (which is
// deliberately OUTSIDE the sync prefix map) under `auto_update:<communityId>`,
// written ROW-ONLY. Default OFF: a member opts in to background polling.
//
// SOURCE OF TRUTH for the web twin: apps/meerkat-web/src/lib/meerkat-data.ts
// (getAutoUpdate / setAutoUpdate). Keep them in lockstep, verbatim.

const AUTO_UPDATE_PREFIX = 'auto_update:';

export function getAutoUpdate(db: DatabaseAdapter, communityId: string): boolean {
  return getSetting(db, `${AUTO_UPDATE_PREFIX}${communityId}`) === '1';
}

export function setAutoUpdate(db: DatabaseAdapter, communityId: string, on: boolean): void {
  setSetting(db, `${AUTO_UPDATE_PREFIX}${communityId}`, on ? '1' : '0');
}

// --- per-community last successful pull time (community feed P5) ---
//
// PERSONAL and NEVER synced. The "Updated Xm ago" label reads this; it is set
// ONLY when a real community-node pull succeeds (refreshCommunityFeed). It lives
// in mk_settings (outside the sync prefix map) under `last_pulled:<communityId>`,
// written ROW-ONLY. Null/absent means "Never updated" honestly.
//
// SOURCE OF TRUTH for the web twin: apps/meerkat-web/src/lib/meerkat-data.ts
// (getLastPulledAt / setLastPulledAt). Native is canonical; keep them in
// lockstep, verbatim. The web surface is the one that actually renders this; the
// native twin exists for parity (the honesty grep + check-meerkat-parity).

const LAST_PULLED_PREFIX = 'last_pulled:';

export function getLastPulledAt(db: DatabaseAdapter, communityId: string): string | null {
  return getSetting(db, `${LAST_PULLED_PREFIX}${communityId}`);
}

export function setLastPulledAt(db: DatabaseAdapter, communityId: string, iso: string): void {
  setSetting(db, `${LAST_PULLED_PREFIX}${communityId}`, iso);
}

// --- per-photo-library offline map enabled (Plan 38 amendment C.6) ---
//
// DEVICE-LOCAL and NEVER synced. The photo library's Map segment is DEFAULT-OFF
// per library; a member enables it only after downloading a founder-hosted static
// tile pack. It lives in mk_settings (outside the sync prefix map) under
// `photo_map_enabled:<channelId>`, written ROW-ONLY. Absent/anything but '1' is
// OFF, so a fresh library never shows a map until the user opts in.

const PHOTO_MAP_ENABLED_PREFIX = 'photo_map_enabled:';

export function isPhotoMapEnabled(db: DatabaseAdapter, channelId: string): boolean {
  return getSetting(db, `${PHOTO_MAP_ENABLED_PREFIX}${channelId}`) === '1';
}

export function setPhotoMapEnabled(db: DatabaseAdapter, channelId: string, on: boolean): void {
  setSetting(db, `${PHOTO_MAP_ENABLED_PREFIX}${channelId}`, on ? '1' : '0');
}

// --- identity row ---

export interface IdentityRow {
  public_key: string;
  dh_public_key: string;
  private_key_ref: string;
  display_name: string;
  created_at: string;
}

export function getIdentityRow(db: DatabaseAdapter): IdentityRow | null {
  const rows = db.query<IdentityRow>(
    `SELECT public_key, dh_public_key, private_key_ref, display_name, created_at
     FROM mk_identity WHERE id = 'self'`,
  );
  return rows[0] ?? null;
}

export function saveIdentityRow(db: DatabaseAdapter, row: IdentityRow): void {
  db.execute(
    `INSERT OR REPLACE INTO mk_identity
       (id, public_key, dh_public_key, private_key_ref, display_name, created_at)
     VALUES ('self', ?, ?, ?, ?, ?)`,
    [row.public_key, row.dh_public_key, row.private_key_ref, row.display_name, row.created_at],
  );
}

export function updateDisplayName(db: DatabaseAdapter, displayName: string): void {
  db.execute(`UPDATE mk_identity SET display_name = ? WHERE id = 'self'`, [displayName]);
}

export function deleteIdentityRow(db: DatabaseAdapter): void {
  db.execute(`DELETE FROM mk_identity WHERE id = 'self'`);
}

// --- per-device community organization (Plan 38 Phase 2, G4) ---
//
// DEVICE-LOCAL and NEVER synced (mk_community_prefs sits outside the sync prefix
// map). Pin/favorite floats a community to the top of the Communities tab, a
// manual sort_index orders cards within a section, and an optional folder groups
// them. This is one member's private arrangement of their own list.

export function getCommunityPrefs(db: DatabaseAdapter, communityId: string): CommunityPrefs | null {
  const rows = db.query<{ community_id: string; pinned: number; sort_index: number | null; folder: string | null }>(
    `SELECT community_id, pinned, sort_index, folder FROM mk_community_prefs WHERE community_id = ?`,
    [communityId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    communityId: row.community_id,
    pinned: row.pinned === 1,
    sortIndex: row.sort_index,
    folder: row.folder,
  };
}

export function listCommunityPrefs(db: DatabaseAdapter): Record<string, CommunityPrefs> {
  const rows = db.query<{ community_id: string; pinned: number; sort_index: number | null; folder: string | null }>(
    `SELECT community_id, pinned, sort_index, folder FROM mk_community_prefs`,
  );
  const byId: Record<string, CommunityPrefs> = {};
  for (const row of rows) {
    byId[row.community_id] = {
      communityId: row.community_id,
      pinned: row.pinned === 1,
      sortIndex: row.sort_index,
      folder: row.folder,
    };
  }
  return byId;
}

export function setCommunityPrefs(
  db: DatabaseAdapter,
  communityId: string,
  prefs: Partial<Omit<CommunityPrefs, 'communityId'>>,
): void {
  const current = getCommunityPrefs(db, communityId);
  const pinned = prefs.pinned ?? current?.pinned ?? false;
  const sortIndex = prefs.sortIndex !== undefined ? prefs.sortIndex : current?.sortIndex ?? null;
  const folder = prefs.folder !== undefined ? prefs.folder : current?.folder ?? null;
  db.execute(
    `INSERT OR REPLACE INTO mk_community_prefs (community_id, pinned, sort_index, folder)
     VALUES (?, ?, ?, ?)`,
    [communityId, pinned ? 1 : 0, sortIndex, folder && folder.trim() ? folder.trim() : null],
  );
}
