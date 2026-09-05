// Non-React DB-helper layer for the web node.
//
// App Isolation (MyLife CLAUDE.md "App Isolation + Hub Inclusion"): the native
// app's row/wiring helpers live INSIDE the apps/meerkat boundary (that app has
// no package `exports`; its `main` is expo-router/entry). They cannot be deep-
// imported here. So the truly app-owned, non-crypto helpers are replicated
// verbatim from the cited sources below. Every cryptographic + protocol
// primitive is still consumed from @mylife/sync unchanged (guardrail 4).
//
// SOURCE OF TRUTH (keep in lockstep until a shared @mylife/meerkat-core package
// extracts these; that is the honest Phase-2 consolidation path):
//   - identity rows + settings : apps/meerkat/app/(root)/data/db.ts (lines 55-107)
//   - sync wiring + rendezvous : apps/meerkat/app/(root)/data/sync-core.ts (31-51, 70, 119-121)
//   - cm_ row helpers          : apps/meerkat/app/(root)/data/community-core.ts
//   - community store bridge    : packages/meerkat-relay .../support/multi-node-harness.ts
//                                 (installCommunityOnNode, lines 264-289)

import type { DatabaseAdapter } from '@mylife/db';
import {
  addWorkspaceMember,
  buildCommunitySnapshots,
  communityIdentityEventFromRow,
  communityIdentityEventToRow,
  communityLayoutEventFromRow,
  communityLayoutEventToRow,
  createCommunityLayoutEvent,
  resolveCommunityLayout as resolveCommunityLayoutEvents,
  communityRole,
  PRESENCE_BEACON_SYNC_RULE,
  parseHumanityToken,
  verifyHumanityToken,
  type HumanityRedeemClient,
  compareCommunityProfileEvents,
  compareChannelMessages,
  createCommunityIdentityEvent,
  createGroupCommit,
  createChannelMessageV2,
  createSignedIdentityBundle,
  createWorkspace,
  drainCommunityNotifyPings,
  evaluateChannelPost,
  getCommunity,
  getCurrentEpochKey,
  getPairedDevices,
  getWorkspaceEpoch,
  unwrapEpochSecret,
  deriveCommunityHistoryRegistryId,
  importSnapshotFromPieces,
  isAfterCursor,
  isDeviceRevoked,
  isServableEvent,
  parseSnapshotManifest,
  pullCommunityFeed,
  publishCommunityFeed,
  appendCommunityTail,
  republishCommunityDescriptor,
  reviseCommunity,
  drainJoinBoxFromNode,
  parkJoinEnvelopeOnNode,
  deriveCommunityJoinToken,
  transportPolicyAllows,
  communityTransportPolicy,
  listCommunities,
  lookupHosts,
  runAutomaticHistorySync,
  resolveChannelMessages,
  resolveCommunityIdentity,
  restoreFromGrantPayload,
  sealHistoryGrantMailbox,
  shouldEmitMessageNotification,
  upsertCommunity,
  verifyCommunityProfileEvent,
  verifyChannelMessage,
  verifySignedIdentityBundle,
  HISTORY_GRANT_MAX_EVENTS,
  type BuildCommunitySnapshotsResult,
  type ChannelMessageEvent,
  type CommunityChannel,
  type CommunityIdentityBanner,
  type CommunityIdentityEvent,
  type CommunityProfileEvent,
  type CommunitySnapshotRecord,
  type DeviceIdentity,
  type DrainCommunityNotifyResult,
  type FileGrantMailboxPayload,
  type FileRequestMailboxPayload,
  type ChannelMessageIntent,
  type GroupMemberKey,
  type HistoryHostRecord,
  type HistoryHostPuller,
  type HistoryHostResolver,
  type Hlc,
  type HistoryGrantMailboxPayload,
  type HistoryRequestMailboxPayload,
  type MailboxEnvelope,
  type MailboxEnvelopeHandlers,
  type MessageAuthorKind,
  type NativeSyncEngineOptions,
  type PairingData,
  type PublicJoinRequestPayload,
  type CommunityLayoutEvent,
  type RecordKeyWrapChange,
  type RelayHealth,
  type SessionBlobProvider,
  type SignedCommunityDescriptor,
  type SignedIdentityBundle,
  type SnapshotChannelInput,
  type SnapshotPieceStore,
} from '@mylife/sync';
import { COMMUNITY_MODULE_ID } from './schema';
import { formatBytes } from '../ui/format';
import {
  createCommunitySafetyIndex,
  type CommunitySafetyIndex,
} from './community-safety';
import { LINK_PREVIEW_MIME_TYPE } from './link-preview';

type PolicyMap = NonNullable<NativeSyncEngineOptions['modulePolicies']>;
type ModuleSyncPolicy = PolicyMap extends Map<string, infer P> ? P : never;

// ---------------------------------------------------------------------------
// Identity rows + settings (mirror of data/db.ts)
// ---------------------------------------------------------------------------

export const DEFAULT_DISPLAY_NAME = 'My Meerkat';

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

// --- connection-server probe cache (Plan 20) ---
//
// Mirror of apps/meerkat data/db.ts. A cached /healthz probe is fresh for this
// long; older rows read as 'unknown' (TC-3) so a stale success never lingers.
export const RELAY_PROBE_TTL_MS = 60_000;

/** Read the cached probe for a relay URL, or null when absent or stale. */
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
 * recorded result (probe-race guard, TC-3). Non-finite latency stored as NULL.
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
// SOURCE OF TRUTH: apps/meerkat/app/(root)/data/db.ts (getAutoUpdate /
// setAutoUpdate). This is the verbatim web twin; keep them in lockstep.

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
// SOURCE OF TRUTH: apps/meerkat/app/(root)/data/db.ts (getLastPulledAt /
// setLastPulledAt). This is the verbatim web twin; keep them in lockstep.

const LAST_PULLED_PREFIX = 'last_pulled:';

export function getLastPulledAt(db: DatabaseAdapter, communityId: string): string | null {
  return getSetting(db, `${LAST_PULLED_PREFIX}${communityId}`);
}

export function setLastPulledAt(db: DatabaseAdapter, communityId: string, iso: string): void {
  setSetting(db, `${LAST_PULLED_PREFIX}${communityId}`, iso);
}

// ---------------------------------------------------------------------------
// Friend code (mirror of apps/meerkat/app/(root)/providers/IdentityProvider.tsx
// FRIEND_CODE_KEY / RENDEZVOUS_ID_KEY, extended for the custom vanity code).
//
// The friend code's bytes ARE the rendezvous lookup key (rid) two devices meet
// at on the relay. A standard code embeds the rid + a checksum; a custom code is
// hashed (domain-separated) into a stable rid via the @mylife/sync primitives
// (rendezvousIdFromCustomCode / friendCodeToRendezvousId). All entropy + hashing
// stays in @mylife/sync; this layer only persists the public code + rid bytes.
// ---------------------------------------------------------------------------

export const FRIEND_CODE_KEY = 'friend_code';
export const RENDEZVOUS_ID_KEY = 'rendezvous_id';
/** '1' when the stored friend_code is a user-chosen vanity code, else absent. */
export const FRIEND_CODE_IS_CUSTOM_KEY = 'friend_code_is_custom';
/**
 * D.5: the persistent secret half (hex) that seals this device's published
 * rendezvous record. Shared only as part of the extended friend code; never
 * transmitted to the relay. Reused across republishes so the extended code is stable.
 */
export const FRIEND_CODE_SECRET_KEY = 'friend_code_secret';

/** Base64 of a byte array, without pulling in tweetnacl-util on web. */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i] ?? 0);
  return typeof btoa === 'function'
    ? btoa(binary)
    : Buffer.from(bytes).toString('base64');
}

/** A friend code plus whether the user authored it (custom) or it is generated. */
export interface FriendCodeState {
  code: string;
  isCustom: boolean;
}

/** Read the stored friend code, or null when none has been created yet. */
export function getFriendCode(db: DatabaseAdapter): FriendCodeState | null {
  const code = getSetting(db, FRIEND_CODE_KEY);
  if (!code) return null;
  return { code, isCustom: getSetting(db, FRIEND_CODE_IS_CUSTOM_KEY) === '1' };
}

/**
 * Persist a friend code + its 8-byte rendezvous id. The rid is supplied by the
 * caller from a @mylife/sync derivation (generateFriendCode for a standard code,
 * rendezvousIdFromCustomCode for a custom one), so this layer never hashes.
 */
export function saveFriendCode(
  db: DatabaseAdapter,
  code: string,
  rendezvousId: Uint8Array,
  isCustom: boolean,
): void {
  setSetting(db, FRIEND_CODE_KEY, code);
  setSetting(db, RENDEZVOUS_ID_KEY, bytesToBase64(rendezvousId));
  setSetting(db, FRIEND_CODE_IS_CUSTOM_KEY, isCustom ? '1' : '');
}

// ---------------------------------------------------------------------------
// Sync wiring (mirror of data/sync-core.ts) + community policy.
//
// The community policy literal mirrors COMMUNITY_SYNC_POLICY in
// apps/meerkat/app/(root)/data/community-core.ts (lines 29-58); it is also the
// SAME literal the relay harness asserts deep-equal against the app.
// ---------------------------------------------------------------------------

export const MEERKAT_SYNC_MODULE_ID = 'meerkatpad';
export { COMMUNITY_MODULE_ID };
export const COMMUNITY_PREFIX = 'cm_';
export const CM_MESSAGES_TABLE = 'cm_messages';
export const CM_MESSAGE_ATTACHMENTS_TABLE = 'cm_message_attachments';
export const CM_READ_STATE_TABLE = 'cm_read_state';
export const CM_POSTS_TABLE = 'cm_posts';
export const CM_PROFILES_TABLE = 'cm_profiles';
// Plan 19 FF3 (app half): the owner's LOCAL review queue for REQUEST-policy
// public-join requests the mailbox dispatcher recorded (never auto-approved --
// see recordPublicJoinRequests below). LOCAL-ONLY by deliberate OMISSION from
// COMMUNITY_SYNC_POLICY.entityRules default (and an EXPLICIT device_local rule,
// Wave-1 style): a public join grant is BROADCAST, so this queue is this
// device's private admission decision state and must never replicate.
export const CM_PUBLIC_JOIN_REQUESTS_TABLE = 'cm_public_join_requests';
// Plan 38 Phase 0: community data-hub (Plex-style libraries) tables. Mirror of
// apps/meerkat/app/(root)/data/community-core.ts. cm_library_progress is PERSONAL
// (personal_replica); the rest replicate at shared_workspace.
export const CM_COMMUNITY_IDENTITY_TABLE = 'cm_community_identity';
// Composition plan 2.2: the OWNER-signed composition document (block layout,
// capability manifest, tier definitions) as ONE opaque @mylife/meerkat-layout
// codec blob. Same signed-event spine as cm_community_identity; verified at
// apply (SIGNED_ROW_VALIDATORS) and at read (resolveCommunityLayout).
export const CM_LAYOUT_TABLE = 'cm_layout';
// Plan 56 C1: the Canvas layer tables. Every row is a SIGNED event verified at
// apply (SIGNED_ROW_VALIDATORS in @mylife/sync) and re-verified at read; a
// forged/unverifiable row renders nothing. Deletion is tombstone events only.
export const CM_CANVAS_TABLE = 'cm_canvas';
export const CM_CANVAS_NODES_TABLE = 'cm_canvas_nodes';
export const CM_CANVAS_STROKES_TABLE = 'cm_canvas_strokes';
export const CM_CANVAS_MARKS_TABLE = 'cm_canvas_counters';
// Plan 56 C2: owner-minted badges + curator awards (or_set, apply-verified).
export const CM_BADGES_TABLE = 'cm_badges';
export const CM_ASSET_PACKS_TABLE = 'cm_asset_packs';
export const CM_CANVAS_PIXELS_TABLE = 'cm_canvas_pixels';
export const CM_LIBRARIES_TABLE = 'cm_libraries';
export const CM_LIBRARY_ITEMS_TABLE = 'cm_library_items';
export const CM_LIBRARY_COLLECTIONS_TABLE = 'cm_library_collections';
export const CM_LIBRARY_COLLECTION_ITEMS_TABLE = 'cm_library_collection_items';
export const CM_LIBRARY_SMART_RULES_TABLE = 'cm_library_smart_rules';
export const CM_LIBRARY_TAGS_TABLE = 'cm_library_tags';
export const CM_LIBRARY_PROGRESS_TABLE = 'cm_library_progress';
export const RELAY_URL_SETTING_KEY = 'relay_url';
// Plan 19 (Public Social Layer): the configured public-directory host the
// Discover/Feed probe queries (public-directory-client.ts). EMPTY/unset by design
// until a real directory is deployed. SOURCE OF TRUTH:
// apps/meerkat/app/(root)/data/sync-core.ts (PUBLIC_DIRECTORY_URL_SETTING).
export const PUBLIC_DIRECTORY_URL_SETTING = 'public_directory_url';

// Connection-server settings (Plan 20). Device-local mk_settings rows, never
// synced. Mirror of apps/meerkat data/db.ts. `default_relay_optout` = '1' when
// the user turns the free default off (effectiveRelayUrl reads it so the opt-out
// governs the real dial, AC-4); `adopted_server_url` is a convenience alias for
// a server adopted via a connection card (effective dial still flows through
// relay_url).
export const DEFAULT_RELAY_OPTOUT_KEY = 'default_relay_optout';
export const ADOPTED_SERVER_URL_KEY = 'adopted_server_url';

export const COMMUNITY_SYNC_POLICY: ModuleSyncPolicy = {
  // Wave-1 audit fix: device_local default so a cm_ table OMITTED from entityRules
  // fails CLOSED (never replicates) instead of inheriting a shared_workspace default
  // and silently leaking. Every table that MUST sync has an explicit rule below.
  defaultScope: 'device_local',
  shareable: true,
  // MK-017 / audit trust-root: a community replicates into a shared workspace only
  // from a peer the user has SAS (emoji) verified out of band. Signed identity
  // bundles + TOFU authenticate an established device, but not first contact; the
  // SAS compare closes the first-contact MITM. Decoupled from isSensitive so the
  // gate applies WITHOUT per-entity content-key encryption (community payloads are
  // already sealed by the community-identity model). Enforced at apply time in
  // inbound-policy.ts (sas_unverified).
  requiresSasForShare: true,
  entityRules: [
    { tableName: CM_MESSAGES_TABLE, defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'or_set' },
    { tableName: CM_MESSAGE_ATTACHMENTS_TABLE, defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'lww' },
    { tableName: 'cm_reactions', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'or_set' },
    { tableName: CM_PROFILES_TABLE, defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'or_set' },
    { tableName: CM_POSTS_TABLE, defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'lww' },
    { tableName: 'cm_post_tags', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'or_set' },
    { tableName: 'cm_post_lifecycle', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'lww' },
    { tableName: CM_READ_STATE_TABLE, defaultScope: 'personal_replica', maxScope: 'personal_replica', conflictStrategy: 'lww' },
    // Plan 19 (Public Social Layer) P0: cm_publications is the ONLY community-family
    // entity that may reach published_blob. It keeps the cm_ prefix so the
    // ChangeTracker resolves it to the community module (a cp_ prefix would resolve
    // to null and be rejected as unknown_table before the scope cap). cm_messages
    // stays shared_workspace.
    { tableName: 'cm_publications', defaultScope: 'shared_workspace', maxScope: 'published_blob', conflictStrategy: 'lww' },
    { tableName: 'cm_public_reports', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'or_set' },
    { tableName: 'cm_public_directory_cache', defaultScope: 'device_local', maxScope: 'device_local', conflictStrategy: 'lww' },
    { tableName: 'cm_public_feed_cursor', defaultScope: 'device_local', maxScope: 'device_local', conflictStrategy: 'lww' },
    // Plan 39 P10: the device's own public-tier follows. LOCAL-ONLY (never replicates).
    { tableName: 'cm_public_follows', defaultScope: 'device_local', maxScope: 'device_local', conflictStrategy: 'lww' },
    // Plan 19 P9 (Public/Forever Archive): durable-pin lifecycle + moderation mirror
    // + rights cache. NONE escalates to published_blob (cm_publications stays the
    // single escalation point, TC-9). cm_archive_jobs replicates across the OWNER's
    // own devices only (personal_replica); the other two are device_local. The
    // canonical rights ride INSIDE the signed PublicationDescriptor; cm_publication_rights
    // only mirrors them for query.
    { tableName: 'cm_archive_jobs', defaultScope: 'device_local', maxScope: 'personal_replica', conflictStrategy: 'lww' },
    { tableName: 'cm_archive_moderation', defaultScope: 'device_local', maxScope: 'device_local', conflictStrategy: 'lww' },
    { tableName: 'cm_publication_rights', defaultScope: 'device_local', maxScope: 'device_local', conflictStrategy: 'lww' },
    // Wave-1 audit fix (adversarial verify): these cm_ tables are LOCAL-ONLY by design
    // but were OMITTED from entityRules, so an omitted cm_ table inherited the OLD
    // shared_workspace default and silently REPLICATED. Each is now pinned device_local
    // AND the module defaultScope below is device_local so omission fails closed. The
    // last two (cm_public_report_reviews + cm_publication_snapshots) ALSO close a web
    // vs mobile drift -- mobile already capped them device_local.
    { tableName: 'cm_file_requests', defaultScope: 'device_local', maxScope: 'device_local', conflictStrategy: 'lww' },
    { tableName: 'cm_feed_cursor', defaultScope: 'device_local', maxScope: 'device_local', conflictStrategy: 'lww' },
    { tableName: 'cm_snapshots', defaultScope: 'device_local', maxScope: 'device_local', conflictStrategy: 'lww' },
    { tableName: 'cm_post_activity', defaultScope: 'device_local', maxScope: 'device_local', conflictStrategy: 'lww' },
    { tableName: 'cm_safety_actions', defaultScope: 'device_local', maxScope: 'device_local', conflictStrategy: 'lww' },
    { tableName: 'cm_public_report_reviews', defaultScope: 'device_local', maxScope: 'device_local', conflictStrategy: 'lww' },
    { tableName: 'cm_publication_snapshots', defaultScope: 'device_local', maxScope: 'device_local', conflictStrategy: 'lww' },
    // Plan 19 FF3: the owner's local public-join review queue. NEVER escalates
    // (device_local default AND cap), so a re-recorded/approved/declined request
    // can never leak this device's admission decisions to a peer.
    { tableName: CM_PUBLIC_JOIN_REQUESTS_TABLE, defaultScope: 'device_local', maxScope: 'device_local', conflictStrategy: 'lww' },
    // Plan 27 P4 (item 13): this device's LOCAL observed transport-policy ledger.
    // The signed descriptor is the real sync channel for the policy itself; this
    // notice ledger is private device state and must NEVER replicate.
    { tableName: 'cm_policy_history', defaultScope: 'device_local', maxScope: 'device_local', conflictStrategy: 'lww' },
    // Plan 38 Phase 0: community data-hub rows replicate at shared_workspace. The
    // identity + library-config rows are OWNER-signed and the item/collection/tag/
    // rule rows curator-signed; row-level policy + apply-time curator enforcement
    // key off the signed community_id/channel_id columns (Codex amendments 2-3).
    { tableName: 'cm_community_identity', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'lww' },
    // Composition plan 2.2: the owner-signed layout document. Apply-time
    // verified (a member-forged re-composition dies before INSERT).
    { tableName: 'cm_layout', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'lww' },
    // Plan 56 C1: the Canvas layer (per-object LWW nodes; or_set strokes/marks;
    // apply-time verified, role/layer-gated, cap/rate-checked in @mylife/sync).
    { tableName: 'cm_canvas', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'lww' },
    { tableName: 'cm_canvas_nodes', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'lww' },
    { tableName: 'cm_canvas_strokes', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'or_set' },
    { tableName: 'cm_canvas_counters', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'or_set' },
    // Plan 56 C2: badge mints + awards (verifiable scarcity, 7.6).
    { tableName: 'cm_badges', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'or_set' },
    // Plan 56 C2 (feature 5): uploader-signed emoji/sticker packs; per-identity
    // lww (entryVersion) resolved in @mylife/sync; sealed item blobs ride
    // asset_manifest_json -> collectBlobRefs.
    { tableName: 'cm_asset_packs', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'lww' },
    // Plan 56 C3 (Plaza): one signed pixel per placement, pure or_set append;
    // the validator enforces membership, the board's policy grid, and the
    // per-member placement interval at apply time.
    { tableName: 'cm_canvas_pixels', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'or_set' },
    { tableName: 'cm_libraries', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'lww' },
    { tableName: 'cm_library_items', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'lww' },
    { tableName: 'cm_library_collections', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'lww' },
    { tableName: 'cm_library_collection_items', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'lww' },
    { tableName: 'cm_library_smart_rules', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'lww' },
    { tableName: 'cm_library_tags', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'lww' },
    // Plan 38 Codex amendment 5: watch/read resume state. PERSONAL replica only
    // (your own paired devices, cm_read_state precedent); it must NEVER reach
    // shared_workspace, so a community can never learn what a member watched.
    { tableName: 'cm_library_progress', defaultScope: 'personal_replica', maxScope: 'personal_replica', conflictStrategy: 'lww' },
    // Plan 29 P6: presence beacons are DEVICE-LOCAL and never ride the CRDT
    // document onto a wider transport (explicit device_local cap).
    { ...PRESENCE_BEACON_SYNC_RULE },
    // Plan 52 P2: signed person-group membership proofs (mutual member
    // signatures over the community-derived group id). Verified fail-closed at
    // apply by validatePersonAnnounceRow; the inner group id never rides here.
    { tableName: 'cm_person_announces', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'lww' },
    // Plan 52: the receiver-side materialization of verified announces
    // (derived group id -> member device ids). DEVICE-LOCAL by explicit cap:
    // each device rebuilds it from announces it verified itself.
    { tableName: 'cm_person_links', defaultScope: 'device_local', maxScope: 'device_local', conflictStrategy: 'lww' },
  ],
};

// Community epoch key wraps (community feed P0). Replicated over the engine as
// shared_workspace so a member who has not yet held the epoch key receives it;
// each wrap is already sealed to one member's DH key, so syncing leaks nothing.
// SOURCE OF TRUTH: apps/meerkat/app/(root)/data/sync-core.ts (MEERKAT_KEYS_MODULE_ID
// + KEYS_SYNC_POLICY). Keep this literal identical there, here, and in the relay
// harness + config guard, or the harness deep-equal guard fails.
export const MEERKAT_KEYS_MODULE_ID = 'communitykeys';

export const KEYS_SYNC_POLICY: ModuleSyncPolicy = {
  defaultScope: 'shared_workspace',
  shareable: true,
  entityRules: [
    { tableName: 'sync_workspace_keys', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'lww' },
  ],
};

// Plan 52: the person-identity module. pi_person_group carries the mutually
// attested device-group doc + the group secret; pi_presentation_profile the
// person's one name + per-community overrides. BOTH are personal_replica-capped
// AND the module is non-shareable, so these rows replicate ONLY between this
// user's own paired devices and can never escalate to a shared workspace.
// SOURCE OF TRUTH: apps/meerkat/app/(root)/data/sync-core.ts; keep identical.
export const PERSON_IDENTITY_MODULE_ID = 'personidentity';

export const PERSON_IDENTITY_SYNC_POLICY: ModuleSyncPolicy = {
  defaultScope: 'personal_replica',
  shareable: false,
  entityRules: [
    { tableName: 'pi_person_group', defaultScope: 'personal_replica', maxScope: 'personal_replica', conflictStrategy: 'lww' },
    { tableName: 'pi_presentation_profile', defaultScope: 'personal_replica', maxScope: 'personal_replica', conflictStrategy: 'lww' },
  ],
};

/** Only mp_ + cm_ + pi_ + the key-wrap table sync; mk_ tables stay device-local by omission. */
export const MEERKAT_SYNC_PREFIXES = new Map<string, string>([
  [MEERKAT_SYNC_MODULE_ID, 'mp_'],
  [COMMUNITY_MODULE_ID, COMMUNITY_PREFIX],
  [MEERKAT_KEYS_MODULE_ID, 'sync_workspace_keys'],
  [PERSON_IDENTITY_MODULE_ID, 'pi_'],
]);

export const MEERKAT_SYNC_POLICIES: PolicyMap = new Map([
  [
    MEERKAT_SYNC_MODULE_ID,
    {
      defaultScope: 'personal_replica',
      shareable: true,
      entityRules: [
        { tableName: 'mp_pad', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      ],
    },
  ],
  [COMMUNITY_MODULE_ID, COMMUNITY_SYNC_POLICY],
  [MEERKAT_KEYS_MODULE_ID, KEYS_SYNC_POLICY],
  [PERSON_IDENTITY_MODULE_ID, PERSON_IDENTITY_SYNC_POLICY],
]);

/**
 * Derive the relay rendezvous token from a human shared phrase. Mirrors
 * sync-core.ts buildRendezvousToken: the relay only ever sees this hash. We use
 * the SAME WebCrypto-free hash @mylife/sync exposes so web and native devices
 * meeting on the same phrase land on the same token. sha512Hex is in the barrel.
 */
import { sha512Hex } from '@mylife/sync';
export function buildRendezvousToken(phrase: string): string {
  return sha512Hex(new TextEncoder().encode(phrase.trim())).slice(0, 64);
}

// ---------------------------------------------------------------------------
// Channel-message row helpers (mirror of data/community-core.ts)
// ---------------------------------------------------------------------------

export interface ChannelMessageRow {
  id: string;
  community_id: string;
  channel_id: string;
  author_device_id: string;
  body: string;
  attachments_json: string;
  hlc_wall: string;
  hlc_counter: number;
  supersedes_id: string | null;
  supersedes_deleted: number | null;
  signature: string;
  updated_at: string;
  version: number; // SQLite returns any integer; narrowed to 1|2 in channelMessageEventFromRow
  post_id: string | null;
  parent_id: string | null;
  branch_id: string | null;
  author_kind: string | null;
  mentions_json: string;
  intent: string | null;
}

export type ChannelPostType = 'discussion' | 'task' | 'announcement' | 'decision' | 'article' | 'preprint';

export interface CreateChannelPostInput {
  communityId: string;
  channelId: string;
  body: string;
  hlc: Hlc;
  postType?: ChannelPostType;
}

export interface CreateChannelPostReplyInput {
  parent: ChannelMessageEvent;
  body: string;
  hlc: Hlc;
}

export interface ChannelPostHeaderRow {
  id: string;
  community_id: string;
  channel_id: string;
  author_device_id: string;
  author_kind: MessageAuthorKind;
  post_type: ChannelPostType;
  title: string | null;
  created_wall: string;
  created_counter: number;
  signature: string;
  updated_at: string;
}

export interface CommunityProfileRow {
  id: string;
  community_id: string;
  member_device_id: string;
  display_name: string;
  avatar_initial: string | null;
  avatar_image: string | null;
  /** v3 persona fields (Plan 56 feature 53); null below v3. */
  bio: string | null;
  pronouns: string | null;
  name_color: string | null;
  version: number;
  updated_at: string;
  signature: string;
}

export interface ChannelPostCard {
  postId: string;
  communityId: string;
  channelId: string;
  root: ChannelMessageEvent;
  title: string | null;
  postType: ChannelPostType;
  replyCount: number;
  lastActivity: Hlc;
  lastAuthorDeviceId: string;
}

export interface ChannelPostThreadNode {
  event: ChannelMessageEvent;
  replies: ChannelPostThreadNode[];
}

export interface ChannelPostThread {
  postId: string;
  root: ChannelMessageEvent;
  replies: ChannelPostThreadNode[];
  replyCount: number;
  lastActivity: Hlc;
}

export function channelMessageRowFromEvent(event: ChannelMessageEvent): ChannelMessageRow {
  return {
    id: event.id,
    community_id: event.communityId,
    channel_id: event.channelId,
    author_device_id: event.authorDeviceId,
    body: event.body,
    attachments_json: JSON.stringify(event.attachments ?? []),
    hlc_wall: event.hlc.wall,
    hlc_counter: event.hlc.counter,
    supersedes_id: event.supersedes?.id ?? null,
    supersedes_deleted: event.supersedes ? (event.supersedes.deleted ? 1 : 0) : null,
    signature: event.signature,
    updated_at: event.hlc.wall,
    version: event.version,
    post_id: event.postId ?? null,
    parent_id: event.parentId ?? null,
    branch_id: event.branchId ?? null,
    author_kind: event.authorKind ?? null,
    mentions_json: JSON.stringify(event.mentions ?? []),
    intent: event.intent ?? null,
  };
}

function isSupportedChannelMessageVersion(version: number): version is ChannelMessageEvent['version'] {
  return version === 1 || version === 2;
}

function assertSupportedChannelMessageVersion(version: number): ChannelMessageEvent['version'] {
  if (!isSupportedChannelMessageVersion(version)) {
    throw new Error(`Unsupported channel message version: ${version}`);
  }
  return version;
}

function channelPostId(input: {
  authorDeviceId: string;
  communityId: string;
  channelId: string;
  hlc: Hlc;
  body: string;
}): string {
  const bytes = new TextEncoder().encode(JSON.stringify([
    'meerkat-channel-post-id-v1',
    input.authorDeviceId,
    input.communityId,
    input.channelId,
    input.hlc.wall,
    input.hlc.counter,
    input.body,
  ]));
  return `post_${sha512Hex(bytes).slice(0, 32)}`;
}

/**
 * Plan 30 T0.3: a reaction is a v2 cm_messages row with intent 'react'. Reactions
 * ride the message/mailbox/safety machinery for free but must NEVER surface as a
 * chat bubble, an unread, a post, or a reply. This predicate is the single seam
 * every read model excludes on.
 */
export function isReactionEvent(event: ChannelMessageEvent): boolean {
  return event.intent === 'react';
}

export function isChannelPostEvent(
  event: ChannelMessageEvent,
): event is ChannelMessageEvent & { version: 2; postId: string; parentId: string } {
  return event.version === 2
    && !isReactionEvent(event)
    && typeof event.postId === 'string'
    && event.postId.length > 0
    && typeof event.parentId === 'string'
    && event.parentId.length > 0;
}

export function isChannelPostRootEvent(event: ChannelMessageEvent): boolean {
  return isChannelPostEvent(event) && event.parentId === event.postId;
}

export function createChannelPostEvent(
  author: DeviceIdentity,
  input: CreateChannelPostInput,
): ChannelMessageEvent {
  const body = input.body.trim();
  if (!body) throw new Error('Write a post first.');
  const postId = channelPostId({
    authorDeviceId: author.publicKey,
    communityId: input.communityId,
    channelId: input.channelId,
    hlc: input.hlc,
    body,
  });
  return createChannelMessageV2(author, {
    communityId: input.communityId,
    channelId: input.channelId,
    body,
    hlc: input.hlc,
    postId,
    parentId: postId,
    branchId: postId,
    authorKind: 'human',
    intent: 'message',
  });
}

export function createChannelPostReplyEvent(
  author: DeviceIdentity,
  input: CreateChannelPostReplyInput,
): ChannelMessageEvent {
  const body = input.body.trim();
  if (!body) throw new Error('Write a reply first.');
  if (!isChannelPostEvent(input.parent)) {
    throw new Error('Replies need a recorded post or reply.');
  }
  return createChannelMessageV2(author, {
    communityId: input.parent.communityId,
    channelId: input.parent.channelId,
    body,
    hlc: input.hlc,
    postId: input.parent.postId,
    parentId: input.parent.id,
    branchId: input.parent.branchId ?? input.parent.postId,
    authorKind: 'human',
    intent: 'message',
  });
}

export function deriveChannelPostTitle(body: string): string | null {
  const firstLine = body.split('\n').map((line) => line.trim()).find(Boolean) ?? '';
  if (!firstLine) return null;
  return firstLine.length > 80 ? `${firstLine.slice(0, 77)}...` : firstLine;
}

export function channelMessageEventFromRow(row: ChannelMessageRow): ChannelMessageEvent {
  const version = assertSupportedChannelMessageVersion(row.version);
  const event: ChannelMessageEvent = {
    version,
    id: row.id,
    communityId: row.community_id,
    channelId: row.channel_id,
    authorDeviceId: row.author_device_id,
    body: row.body,
    attachments: parseAttachmentsJson(row.attachments_json),
    hlc: { wall: row.hlc_wall, counter: row.hlc_counter },
    supersedes: row.supersedes_id
      ? { id: row.supersedes_id, deleted: row.supersedes_deleted === 1 }
      : undefined,
    signature: row.signature,
  };
  if (row.version === 2) {
    if (row.post_id != null) event.postId = row.post_id;
    if (row.parent_id != null) event.parentId = row.parent_id;
    if (row.branch_id != null) event.branchId = row.branch_id;
    if (row.author_kind != null) event.authorKind = row.author_kind as MessageAuthorKind;
    const mentions = parseMentionsJson(row.mentions_json);
    if (mentions.length > 0) event.mentions = mentions;
    if (row.intent != null) event.intent = row.intent as ChannelMessageIntent;
  }
  return event;
}

function parseAttachmentsJson(json: string): ChannelMessageEvent['attachments'] {
  try {
    const value = JSON.parse(json) as unknown;
    return Array.isArray(value) ? (value as ChannelMessageEvent['attachments']) : [];
  } catch {
    return [];
  }
}

function parseMentionsJson(json: string): string[] {
  try {
    const value = JSON.parse(json) as unknown;
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function insertMessageRow(db: DatabaseAdapter, event: ChannelMessageEvent): ChannelMessageRow {
  const row = channelMessageRowFromEvent(event);
  db.execute(
    `INSERT OR IGNORE INTO cm_messages (
      id, community_id, channel_id, author_device_id, body, attachments_json,
      hlc_wall, hlc_counter, supersedes_id, supersedes_deleted,
      signature, updated_at,
      version, post_id, parent_id, branch_id, author_kind, mentions_json, intent
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.community_id,
      row.channel_id,
      row.author_device_id,
      row.body,
      row.attachments_json,
      row.hlc_wall,
      row.hlc_counter,
      row.supersedes_id,
      row.supersedes_deleted,
      row.signature,
      row.updated_at,
      row.version,
      row.post_id,
      row.parent_id,
      row.branch_id,
      row.author_kind,
      row.mentions_json,
      row.intent,
    ],
  );
  return row;
}

export function channelPostHeaderRowFromRootEvent(
  event: ChannelMessageEvent,
  postType: ChannelPostType = 'discussion',
): ChannelPostHeaderRow {
  if (!isChannelPostRootEvent(event) || !event.postId) {
    throw new Error('Post header requires a root post event.');
  }
  return {
    id: event.postId,
    community_id: event.communityId,
    channel_id: event.channelId,
    author_device_id: event.authorDeviceId,
    author_kind: event.authorKind ?? 'human',
    post_type: postType,
    title: deriveChannelPostTitle(event.body),
    created_wall: event.hlc.wall,
    created_counter: event.hlc.counter,
    signature: event.signature,
    updated_at: event.hlc.wall,
  };
}

export function insertPostHeaderRow(
  db: DatabaseAdapter,
  event: ChannelMessageEvent,
  postType: ChannelPostType = 'discussion',
): ChannelPostHeaderRow {
  const row = channelPostHeaderRowFromRootEvent(event, postType);
  db.execute(
    `INSERT OR IGNORE INTO cm_posts (
      id, community_id, channel_id, author_device_id, author_kind,
      post_type, title, created_wall, created_counter, signature, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.community_id,
      row.channel_id,
      row.author_device_id,
      row.author_kind,
      row.post_type,
      row.title,
      row.created_wall,
      row.created_counter,
      row.signature,
      row.updated_at,
    ],
  );
  return row;
}

/** Highest HLC for a channel (mirror of community-core.ts highestHlc). */
export function highestHlc(
  db: DatabaseAdapter,
  communityId: string,
  channelId: string,
): Hlc | null {
  const rows = db.query<{ hlc_wall: string; hlc_counter: number }>(
    `SELECT hlc_wall, hlc_counter
     FROM cm_messages
     WHERE community_id = ? AND channel_id = ?
     ORDER BY hlc_wall DESC, hlc_counter DESC, author_device_id DESC, id DESC
     LIMIT 1`,
    [communityId, channelId],
  );
  const row = rows[0];
  return row ? { wall: row.hlc_wall, counter: row.hlc_counter } : null;
}

/** Verified, time-ordered raw events for a channel (mirror listChannelMessageEvents). */
export function listChannelMessageEvents(
  db: DatabaseAdapter,
  communityId: string,
  channelId: string,
): ChannelMessageEvent[] {
  const rows = db.query<ChannelMessageRow>(
    `SELECT id, community_id, channel_id, author_device_id, body,
       attachments_json, hlc_wall, hlc_counter, supersedes_id, supersedes_deleted,
       signature, updated_at,
       version, post_id, parent_id, branch_id, author_kind, mentions_json, intent
     FROM cm_messages
     WHERE community_id = ? AND channel_id = ?`,
    [communityId, channelId],
  );
  return rows
    .filter((row) => isSupportedChannelMessageVersion(row.version))
    .map(channelMessageEventFromRow)
    .filter((event) => verifyChannelMessage(event))
    .sort(compareChannelMessages);
}

/**
 * Resolved (edits/deletes collapsed) channel messages, the exact shape the UI
 * renders (mirror of community-core.ts listChannelMessages).
 */
export function listChannelMessages(
  db: DatabaseAdapter,
  communityId: string,
  channelId: string,
  verifiedEvents?: readonly ChannelMessageEvent[],
): ChannelMessageEvent[] {
  // Plan 30 T0.3: reactions (intent 'react') are excluded before resolution so
  // they never render as bubbles, never count as unread, and never become posts.
  // Reactions form a disjoint supersedes graph (an un-react tombstone only ever
  // targets its own prior react), so dropping them here cannot orphan a message
  // edit/delete chain.
  const events = (verifiedEvents ?? listChannelMessageEvents(db, communityId, channelId))
    .filter((event) => !isReactionEvent(event));
  return resolveChannelMessages(events);
}

export function communityProfileRowFromEvent(event: CommunityProfileEvent): CommunityProfileRow {
  return {
    id: event.id,
    community_id: event.communityId,
    member_device_id: event.memberDeviceId,
    display_name: event.displayName,
    avatar_initial: event.avatarInitial,
    avatar_image: event.avatarImage ?? null,
    bio: event.bio ?? null,
    pronouns: event.pronouns ?? null,
    name_color: event.nameColor ?? null,
    version: event.version,
    updated_at: event.updatedAt,
    signature: event.signature,
  };
}

export function communityProfileEventFromRow(row: CommunityProfileRow): CommunityProfileEvent {
  const version: 1 | 2 | 3 = row.version === 3 ? 3 : row.version === 2 ? 2 : 1;
  const event: CommunityProfileEvent = {
    version,
    id: row.id,
    communityId: row.community_id,
    memberDeviceId: row.member_device_id,
    displayName: row.display_name,
    avatarInitial: row.avatar_initial,
    updatedAt: row.updated_at,
    signature: row.signature,
  };
  // Restore version-gated fields ONLY at their version; a lower-version event
  // must never carry them or verifyCommunityProfileEvent rejects it.
  if (version >= 2 && row.avatar_image) {
    event.avatarImage = row.avatar_image;
  }
  if (version === 3) {
    if (row.bio) event.bio = row.bio;
    if (row.pronouns) event.pronouns = row.pronouns;
    if (row.name_color) event.nameColor = row.name_color as CommunityProfileEvent['nameColor'];
  }
  return event;
}

export function insertCommunityProfileRow(
  db: DatabaseAdapter,
  event: CommunityProfileEvent,
): CommunityProfileRow {
  if (!verifyCommunityProfileEvent(event)) {
    throw new Error('Community profile signature did not verify.');
  }
  const row = communityProfileRowFromEvent(event);
  db.execute(
    `INSERT OR IGNORE INTO cm_profiles (
      id, community_id, member_device_id, display_name, avatar_initial, avatar_image, bio, pronouns, name_color, version, updated_at, signature
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.community_id,
      row.member_device_id,
      row.display_name,
      row.avatar_initial,
      row.avatar_image,
      row.bio,
      row.pronouns,
      row.name_color,
      row.version,
      row.updated_at,
      row.signature,
    ],
  );
  return row;
}

export function listCommunityProfileEvents(
  db: DatabaseAdapter,
  communityId: string,
): CommunityProfileEvent[] {
  const stored = getCommunity(db, communityId);
  if (!stored) return [];
  const memberIds = new Set(stored.descriptor.members.map((member) => member.deviceId));
  const rows = db.query<CommunityProfileRow>(
    `SELECT id, community_id, member_device_id, display_name, avatar_initial, avatar_image, bio, pronouns, name_color, version, updated_at, signature
     FROM cm_profiles
     WHERE community_id = ?`,
    [communityId],
  );
  return rows
    .map(communityProfileEventFromRow)
    .filter((event) => memberIds.has(event.memberDeviceId))
    .filter(verifyCommunityProfileEvent)
    .sort(compareCommunityProfileEvents);
}

export function getCommunityProfile(
  db: DatabaseAdapter,
  communityId: string,
  deviceId: string,
): CommunityProfileEvent | null {
  const events = listCommunityProfileEvents(db, communityId)
    .filter((event) => event.memberDeviceId === deviceId);
  return events[events.length - 1] ?? null;
}

// ---------------------------------------------------------------------------
// Community identity + theme (Plan 38 Phase 1b). OWNER-signed cosmetic identity
// (description, accent, icon, banner, theme blob) rides cm_community_identity at
// shared_workspace, modeled on the cm_profiles flow: a pure DB write here, the
// engine.recordChange wired by the provider. resolveCommunityIdentity binds the
// winner to the stored descriptor's ownerDeviceId, so a forged or non-owner event
// resolves to null and renders NOTHING (the avatar rule). Native twin:
// apps/meerkat/app/(root)/data/community-core.ts; keep in lockstep.
// ---------------------------------------------------------------------------

/** Serialize + INSERT OR IGNORE an owner-signed identity event (content-addressed id). */
export function insertCommunityIdentityRow(
  db: DatabaseAdapter,
  event: CommunityIdentityEvent,
): void {
  const row = communityIdentityEventToRow(event);
  db.execute(
    `INSERT OR IGNORE INTO cm_community_identity (
      id, community_id, revision, description, accent_color, icon_image,
      banner_cid, banner_key_epoch, banner_wrapped_key, banner_manifest_json,
      theme_blob, tombstone, updated_at, signed_by, signature
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.community_id,
      row.revision,
      row.description,
      row.accent_color,
      row.icon_image,
      row.banner_cid,
      row.banner_key_epoch,
      row.banner_wrapped_key,
      row.banner_manifest_json,
      row.theme_blob,
      row.tombstone,
      row.updated_at,
      row.signed_by,
      row.signature,
    ],
  );
}

/** All parseable identity events for a community (unverified rows dropped as null). */
export function listCommunityIdentityEvents(
  db: DatabaseAdapter,
  communityId: string,
): CommunityIdentityEvent[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT id, community_id, revision, description, accent_color, icon_image,
       banner_cid, banner_key_epoch, banner_wrapped_key, banner_manifest_json,
       theme_blob, tombstone, updated_at, signed_by, signature
     FROM cm_community_identity
     WHERE community_id = ?`,
    [communityId],
  );
  const events: CommunityIdentityEvent[] = [];
  for (const row of rows) {
    const event = communityIdentityEventFromRow(row);
    if (event) events.push(event);
  }
  return events;
}

/**
 * The winning identity for a community: the highest VERIFIED owner-signed revision
 * (resolveCommunityIdentity binds signedBy to the stored descriptor owner). Returns
 * null when nothing verifies or the winner is a tombstone -- both mean "render
 * defaults". A forged/non-owner event never wins.
 */
export function getCommunityIdentity(
  db: DatabaseAdapter,
  communityId: string,
): CommunityIdentityEvent | null {
  const stored = getCommunity(db, communityId);
  if (!stored) return null;
  return resolveCommunityIdentity(
    listCommunityIdentityEvents(db, communityId),
    stored.descriptor.ownerDeviceId,
  );
}

/** Highest identity revision this device has stored for a community (0 when none). */
function highestLocalIdentityRevision(db: DatabaseAdapter, communityId: string): number {
  const rows = db.query<{ revision: number | null }>(
    `SELECT MAX(revision) AS revision FROM cm_community_identity WHERE community_id = ?`,
    [communityId],
  );
  const max = rows[0]?.revision;
  return typeof max === 'number' && Number.isFinite(max) ? max : 0;
}

export interface PublishCommunityIdentityFields {
  description?: string | null;
  accentColor?: string | null;
  iconImage?: string | null;
  banner?: CommunityIdentityBanner | null;
  themeBlob?: string | null;
}

/**
 * Publish (owner-only) the community's identity at the next revision. Reads the
 * highest LOCAL revision, signs revision+1 with the owner identity, inserts the
 * row, and records the change for replication (same path as cm_profiles). REFUSES
 * with an honest error when the caller is not the community owner per the stored
 * descriptor.
 */
export function publishCommunityIdentity(
  db: DatabaseAdapter,
  owner: DeviceIdentity,
  communityId: string,
  fields: PublishCommunityIdentityFields,
  recordChange?: RecordKeyWrapChange,
): CommunityIdentityEvent {
  const stored = getCommunity(db, communityId);
  if (!stored) throw new Error('Community not found on this device.');
  if (stored.descriptor.ownerDeviceId !== owner.publicKey) {
    throw new Error('Only the community owner can change its identity.');
  }
  const event = createCommunityIdentityEvent(owner, {
    communityId,
    revision: highestLocalIdentityRevision(db, communityId) + 1,
    description: fields.description,
    accentColor: fields.accentColor,
    iconImage: fields.iconImage,
    banner: fields.banner,
    themeBlob: fields.themeBlob,
  });
  insertCommunityIdentityRow(db, event);
  recordChange?.(CM_COMMUNITY_IDENTITY_TABLE, 'INSERT', event.id, communityIdentityEventToRow(event));
  return event;
}

/** Owner-only signed tombstone: clears the identity back to defaults at the next revision. */
export function tombstoneCommunityIdentity(
  db: DatabaseAdapter,
  owner: DeviceIdentity,
  communityId: string,
  recordChange?: RecordKeyWrapChange,
): CommunityIdentityEvent {
  const stored = getCommunity(db, communityId);
  if (!stored) throw new Error('Community not found on this device.');
  if (stored.descriptor.ownerDeviceId !== owner.publicKey) {
    throw new Error('Only the community owner can change its identity.');
  }
  const event = createCommunityIdentityEvent(owner, {
    communityId,
    revision: highestLocalIdentityRevision(db, communityId) + 1,
    tombstone: true,
  });
  insertCommunityIdentityRow(db, event);
  recordChange?.(CM_COMMUNITY_IDENTITY_TABLE, 'INSERT', event.id, communityIdentityEventToRow(event));
  return event;
}

// --- cm_layout (composition plan 2.2): the owner-signed composition document.
// Same spine as the identity events above: list parseable rows, resolve the
// highest VERIFIED revision against the stored descriptor owner, publish/
// tombstone owner-only at revision+1, record for replication.

export function insertCommunityLayoutRow(
  db: DatabaseAdapter,
  event: CommunityLayoutEvent,
): void {
  const row = communityLayoutEventToRow(event);
  db.execute(
    `INSERT OR IGNORE INTO cm_layout (
      id, community_id, revision, layout_blob, tombstone, updated_at, signed_by, signature
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.community_id,
      row.revision,
      row.layout_blob,
      row.tombstone,
      row.updated_at,
      row.signed_by,
      row.signature,
    ],
  );
}

/** All parseable layout events for a community (malformed rows dropped as null). */
export function listCommunityLayoutEvents(
  db: DatabaseAdapter,
  communityId: string,
): CommunityLayoutEvent[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT id, community_id, revision, layout_blob, tombstone, updated_at, signed_by, signature
     FROM cm_layout
     WHERE community_id = ?`,
    [communityId],
  );
  const events: CommunityLayoutEvent[] = [];
  for (const row of rows) {
    const event = communityLayoutEventFromRow(row);
    if (event) events.push(event);
  }
  return events;
}

/**
 * The winning layout event for a community: the highest VERIFIED owner-signed
 * revision. Returns null when nothing verifies or the winner is a tombstone --
 * both mean "render the legacy communityLayout() surfaces". A forged/non-owner
 * event never wins.
 */
export function getCommunityLayoutEvent(
  db: DatabaseAdapter,
  communityId: string,
): CommunityLayoutEvent | null {
  const stored = getCommunity(db, communityId);
  if (!stored) return null;
  return resolveCommunityLayoutEvents(
    listCommunityLayoutEvents(db, communityId),
    stored.descriptor.ownerDeviceId,
  );
}

/** Highest layout revision this device has stored for a community (0 when none). */
function highestLocalLayoutRevision(db: DatabaseAdapter, communityId: string): number {
  const rows = db.query<{ revision: number | null }>(
    `SELECT MAX(revision) AS revision FROM cm_layout WHERE community_id = ?`,
    [communityId],
  );
  const max = rows[0]?.revision;
  return typeof max === 'number' && Number.isFinite(max) ? max : 0;
}

/**
 * Publish (owner-only) the community's layout at the next revision. REFUSES
 * with an honest error when the caller is not the community owner per the
 * stored descriptor. The blob must already be a valid @mylife/meerkat-layout
 * codec string (the editor encodes through the codec before calling this).
 */
export function publishCommunityLayout(
  db: DatabaseAdapter,
  owner: DeviceIdentity,
  communityId: string,
  layoutBlob: string,
  recordChange?: RecordKeyWrapChange,
): CommunityLayoutEvent {
  const stored = getCommunity(db, communityId);
  if (!stored) throw new Error('Community not found on this device.');
  if (stored.descriptor.ownerDeviceId !== owner.publicKey) {
    throw new Error('Only the community owner can change its layout.');
  }
  const event = createCommunityLayoutEvent(owner, {
    communityId,
    revision: highestLocalLayoutRevision(db, communityId) + 1,
    layoutBlob,
  });
  insertCommunityLayoutRow(db, event);
  recordChange?.(CM_LAYOUT_TABLE, 'INSERT', event.id, communityLayoutEventToRow(event));
  return event;
}

/** Owner-only signed tombstone: clears the layout back to the legacy rendering. */
export function tombstoneCommunityLayout(
  db: DatabaseAdapter,
  owner: DeviceIdentity,
  communityId: string,
  recordChange?: RecordKeyWrapChange,
): CommunityLayoutEvent {
  const stored = getCommunity(db, communityId);
  if (!stored) throw new Error('Community not found on this device.');
  if (stored.descriptor.ownerDeviceId !== owner.publicKey) {
    throw new Error('Only the community owner can change its layout.');
  }
  const event = createCommunityLayoutEvent(owner, {
    communityId,
    revision: highestLocalLayoutRevision(db, communityId) + 1,
    tombstone: true,
  });
  insertCommunityLayoutRow(db, event);
  recordChange?.(CM_LAYOUT_TABLE, 'INSERT', event.id, communityLayoutEventToRow(event));
  return event;
}

/** A member's per-community theme choice: apply the owner theme, or use their own. */
export type CommunityThemeMode = 'community' | 'mine';

const COMMUNITY_THEME_MODE_PREFIX = 'community_theme_mode:';

/**
 * The member's per-community theme mode. DEVICE-LOCAL (mk_settings), never synced;
 * defaults to 'community' (apply the owner's theme inside that community's screens).
 */
export function getCommunityThemeMode(db: DatabaseAdapter, communityId: string): CommunityThemeMode {
  return getSetting(db, `${COMMUNITY_THEME_MODE_PREFIX}${communityId}`) === 'mine' ? 'mine' : 'community';
}

export function setCommunityThemeMode(
  db: DatabaseAdapter,
  communityId: string,
  mode: CommunityThemeMode,
): void {
  setSetting(db, `${COMMUNITY_THEME_MODE_PREFIX}${communityId}`, mode);
}

// ---------------------------------------------------------------------------
// Friendly-name resolution for community author labels.
//
// HONESTY (Critical): a self-chosen name is NOT proof of identity. Names come
// only from trusted local sources: owner-signed descriptor names, locally paired
// device names, and member-signed community profile events that verify against
// the active descriptor member's device key. Never read names from messages.
// ---------------------------------------------------------------------------

export function buildCommunityPeerNameMap(
  db: DatabaseAdapter,
  communityId: string,
): Map<string, string> {
  const names = new Map<string, string>();
  const stored = getCommunity(db, communityId);
  // Owner-signed descriptor members first (lower trust than a verified pairing).
  if (stored) {
    for (const member of stored.descriptor.members) {
      const name = member.displayName?.trim();
      if (name) names.set(member.deviceId, name);
    }
  }
  // Paired devices override: we paired them after verifying their signed bundle.
  for (const peer of getPairedDevices(db)) {
    const name = peer.displayName?.trim();
    if (name) names.set(peer.deviceId, name);
  }
  for (const event of listCommunityProfileEvents(db, communityId)) {
    names.set(event.memberDeviceId, event.displayName);
  }
  return names;
}

export function resolveCommunityDisplayName(
  db: DatabaseAdapter,
  communityId: string,
  deviceId: string,
  fallbackName?: string,
): string | null {
  const profile = getCommunityProfile(db, communityId, deviceId);
  if (profile) return profile.displayName;
  const stored = getCommunity(db, communityId);
  const descriptorName = stored?.descriptor.members
    .find((member) => member.deviceId === deviceId)
    ?.displayName
    ?.trim();
  if (descriptorName) return descriptorName;
  const pairedName = getPairedDevices(db)
    .find((peer) => peer.deviceId === deviceId)
    ?.displayName
    ?.trim();
  if (pairedName) return pairedName;
  const fallback = fallbackName?.trim();
  return fallback || null;
}

export function resolveCommunityAvatarInitial(
  db: DatabaseAdapter,
  communityId: string,
  deviceId: string,
  fallbackName?: string,
): string | null {
  const profile = getCommunityProfile(db, communityId, deviceId);
  if (profile?.avatarInitial) return profile.avatarInitial;
  const displayName = resolveCommunityDisplayName(db, communityId, deviceId, fallbackName);
  const first = displayName ? Array.from(displayName.trim())[0] : undefined;
  return first ? first.toUpperCase() : null;
}

// Plan 32 T2.2: the verified base64-JPEG avatar for a member, or null. Only a
// signature-verified v2 profile (getCommunityProfile filters through verify) can
// return an image, so a forged or unverifiable row never yields one.
export function resolveCommunityAvatarImage(
  db: DatabaseAdapter,
  communityId: string,
  deviceId: string,
): string | null {
  const profile = getCommunityProfile(db, communityId, deviceId);
  return profile?.avatarImage ?? null;
}

// Plan 56 feature 53: the verified persona (bio / pronouns / name color) for a
// member, or nulls. Persona rides ONLY a signature-verified v3 profile
// (getCommunityProfile filters through verify), so a forged row yields nothing.
export function resolveCommunityPersona(
  db: DatabaseAdapter,
  communityId: string,
  deviceId: string,
): { bio: string | null; pronouns: string | null; nameColor: string | null } {
  const profile = getCommunityProfile(db, communityId, deviceId);
  return {
    bio: profile?.bio ?? null,
    pronouns: profile?.pronouns ?? null,
    nameColor: profile?.nameColor ?? null,
  };
}

// Plan 32 T5.3 (twin of community-core.ts resolveFriendAvatarImage): a friend's
// signed avatar image resolved across communities. A paired friend is not scoped
// to one community, so the first signature-verified v2 avatar found among the
// given community ids is used (each already filtered through verify by
// resolveCommunityAvatarImage; a forged row never yields one). Null when the
// friend has set no photo in any shared community (initial fallback on the People
// list). Never fetches; reads only local verified profile rows.
export function resolveFriendAvatarImage(
  db: DatabaseAdapter,
  communityIds: readonly string[],
  deviceId: string,
): string | null {
  for (const communityId of communityIds) {
    const image = resolveCommunityAvatarImage(db, communityId, deviceId);
    if (image) return image;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Channel read-state + unread (mirror of community-core.ts lines 167-489).
//
// Web has NO personal-replica multi-device flow, so the read-state row is
// written LOCALLY ONLY and NEVER recorded through engine.recordChange. The
// write helper is named markChannelReadRow (not markChannelRead) to avoid
// clashing with the provider method. Self-authored messages are NOT excluded
// from the unread count, matching native.
// ---------------------------------------------------------------------------

export interface ChannelReadStateRow {
  id: string;
  community_id: string;
  channel_id: string;
  last_read_wall: string | null;
  last_read_counter: number | null;
  /** authorDeviceId of the boundary event; the (wall,counter)-tie tiebreak. Null on legacy rows. */
  last_read_author: string | null;
  updated_at: string;
}

export interface MarkChannelReadResult {
  changed: boolean;
  operation: 'INSERT' | 'UPDATE' | null;
  row: ChannelReadStateRow | null;
}

export function channelReadStateId(communityId: string, channelId: string): string {
  return `${communityId}:${channelId}`;
}

export function getChannelReadState(
  db: DatabaseAdapter,
  communityId: string,
  channelId: string,
): ChannelReadStateRow | null {
  const rows = db.query<ChannelReadStateRow>(
    `SELECT id, community_id, channel_id, last_read_wall, last_read_counter, last_read_author, updated_at
     FROM cm_read_state
     WHERE id = ?
     LIMIT 1`,
    [channelReadStateId(communityId, channelId)],
  );
  return rows[0] ?? null;
}

function compareHlc(a: Hlc, b: Hlc): number {
  if (a.wall !== b.wall) return a.wall < b.wall ? -1 : 1;
  return a.counter - b.counter;
}

function compareHlcDesc(a: Hlc, b: Hlc): number {
  return -compareHlc(a, b);
}

export function buildVisibleAliasMap(events: readonly ChannelMessageEvent[]): Map<string, string> {
  const ordered = [...events].sort(compareChannelMessages);
  const rootByEventId = new Map<string, string>();
  const visibleByRoot = new Map<string, ChannelMessageEvent>();
  const rootAuthor = new Map<string, string>();
  const rootIntent = new Map<string, string>();

  for (const event of ordered) {
    if (!event.supersedes) {
      rootByEventId.set(event.id, event.id);
      visibleByRoot.set(event.id, event);
      rootAuthor.set(event.id, event.authorDeviceId);
      rootIntent.set(event.id, event.intent ?? 'message');
      continue;
    }

    const rootId = rootByEventId.get(event.supersedes.id);
    if (!rootId) continue;
    // Fail-closed author + intent bind, mirroring resolveChannelMessages (Plan 30
    // P0 security fix): a supersede from anyone but the root's author, or across
    // intents, is ignored so a cross-author message-intent tombstone naming a post
    // root cannot alias-map it away (defense-in-depth; the alias map must not drift
    // from the resolver it pairs with).
    if (event.authorDeviceId !== rootAuthor.get(rootId)) continue;
    if ((event.intent ?? 'message') !== rootIntent.get(rootId)) continue;
    rootByEventId.set(event.id, rootId);
    if (event.supersedes.deleted) {
      visibleByRoot.delete(rootId);
    } else {
      visibleByRoot.set(rootId, event);
    }
  }

  const alias = new Map<string, string>();
  for (const [eventId, rootId] of rootByEventId) {
    const visible = visibleByRoot.get(rootId);
    if (visible) alias.set(eventId, visible.id);
  }
  return alias;
}

function parseChannelPostType(value: string | undefined): ChannelPostType {
  return value === 'task' ||
    value === 'announcement' ||
    value === 'decision' ||
    value === 'article' ||
    value === 'preprint'
    ? value
    : 'discussion';
}

function postTypesForRoots(
  db: DatabaseAdapter,
  postIds: readonly string[],
): Map<string, ChannelPostType> {
  const result = new Map<string, ChannelPostType>();
  const batchSize = 900;
  for (let offset = 0; offset < postIds.length; offset += batchSize) {
    const batch = postIds.slice(offset, offset + batchSize);
    const placeholders = batch.map(() => '?').join(', ');
    const rows = db.query<{ id: string; post_type: string }>(
      `SELECT id, post_type FROM cm_posts WHERE id IN (${placeholders})`,
      [...batch],
    );
    for (const row of rows) result.set(row.id, parseChannelPostType(row.post_type));
  }
  return result;
}

export function listChannelPostCards(
  db: DatabaseAdapter,
  communityId: string,
  channelId: string,
  visibleMessages?: readonly ChannelMessageEvent[],
): ChannelPostCard[] {
  const visible = (visibleMessages ?? listChannelMessages(db, communityId, channelId))
    .filter(isChannelPostEvent);
  const roots = new Map<string, ChannelMessageEvent>();
  const related = new Map<string, ChannelMessageEvent[]>();

  for (const event of visible) {
    const events = related.get(event.postId) ?? [];
    events.push(event);
    related.set(event.postId, events);
    if (isChannelPostRootEvent(event)) roots.set(event.postId, event);
  }

  const postTypes = postTypesForRoots(db, Array.from(roots.keys()));

  return Array.from(roots.entries())
    .map(([postId, root]) => {
      const events = related.get(postId) ?? [root];
      const replies = events.filter((event) => !isChannelPostRootEvent(event));
      const latest = events.reduce((current, event) => (
        compareHlc(event.hlc, current.hlc) > 0 ? event : current
      ), root);
      return {
        postId,
        communityId,
        channelId,
        root,
        title: deriveChannelPostTitle(root.body),
        postType: postTypes.get(postId) ?? 'discussion',
        replyCount: replies.length,
        lastActivity: latest.hlc,
        lastAuthorDeviceId: latest.authorDeviceId,
      };
    })
    .sort((a, b) => {
      const byActivity = compareHlcDesc(a.lastActivity, b.lastActivity);
      if (byActivity !== 0) return byActivity;
      return a.postId < b.postId ? -1 : a.postId === b.postId ? 0 : 1;
    });
}

export function listChannelPostThread(
  db: DatabaseAdapter,
  communityId: string,
  channelId: string,
  postId: string,
): ChannelPostThread | null {
  // Plan 30 T0.3 (Finding 2): strip reactions before alias + resolution so a
  // react (or a react tombstone) can never perturb thread aliasing or make a
  // post root un-resolvable, exactly as listChannelMessages does for the stream.
  const raw = listChannelMessageEvents(db, communityId, channelId)
    .filter((event) => !isReactionEvent(event));
  const alias = buildVisibleAliasMap(raw);
  const visible = resolveChannelMessages(raw).filter(isChannelPostEvent);
  const root = visible.find((event) => event.postId === postId && isChannelPostRootEvent(event));
  if (!root) return null;

  const replyEvents = visible
    .filter((event) => event.postId === postId && !isChannelPostRootEvent(event))
    .sort(compareChannelMessages);
  const nodes = new Map<string, ChannelPostThreadNode>();
  for (const event of replyEvents) {
    nodes.set(event.id, { event, replies: [] });
  }

  const topLevel: ChannelPostThreadNode[] = [];
  for (const event of replyEvents) {
    const node = nodes.get(event.id);
    if (!node) continue;
    const parentId = event.parentId ? alias.get(event.parentId) ?? event.parentId : null;
    const parentNode = parentId ? nodes.get(parentId) : undefined;
    if (parentNode) {
      parentNode.replies.push(node);
    } else {
      topLevel.push(node);
    }
  }

  const latest = [root, ...replyEvents].reduce((current, event) => (
    compareHlc(event.hlc, current.hlc) > 0 ? event : current
  ), root);

  return {
    postId,
    root,
    replies: topLevel,
    replyCount: replyEvents.length,
    lastActivity: latest.hlc,
  };
}

/** The read boundary: the newest-read event's total-order key (wall, counter, author). */
export interface ReadBoundary {
  wall: string;
  counter: number;
  /** authorDeviceId of the boundary event; null on legacy rows written before the tiebreak. */
  author: string | null;
}

export function readBoundaryFromReadState(row: ChannelReadStateRow | null): ReadBoundary | null {
  if (!row?.last_read_wall || row.last_read_counter === null) return null;
  return { wall: row.last_read_wall, counter: row.last_read_counter, author: row.last_read_author ?? null };
}

/**
 * True when an event sorts strictly AFTER the read boundary, mirroring
 * compareChannelMessages' canonical (wall, counter, authorDeviceId) tiebreak (m3):
 * a distinct remote event sharing the boundary's exact (wall, counter) is unread
 * when its device id sorts after the boundary author, instead of being silently
 * treated as read. A legacy boundary with no author falls back to a (wall, counter)
 * compare (a tie is read), which never re-counts the boundary event itself.
 */
export function isEventAfterReadBoundary(
  eventWall: string,
  eventCounter: number,
  eventAuthor: string,
  boundary: ReadBoundary,
): boolean {
  if (eventWall !== boundary.wall) return eventWall > boundary.wall;
  if (eventCounter !== boundary.counter) return eventCounter > boundary.counter;
  if (boundary.author === null) return false;
  return eventAuthor > boundary.author;
}

export function markChannelReadRow(
  db: DatabaseAdapter,
  communityId: string,
  channelId: string,
  lastRead: Hlc,
  lastReadAuthor: string | null = null,
  now: string = new Date().toISOString(),
): MarkChannelReadResult {
  const id = channelReadStateId(communityId, channelId);
  const existing = getChannelReadState(db, communityId, channelId);
  const existingBoundary = readBoundaryFromReadState(existing);
  // No-op unless the new position sorts strictly after the stored boundary.
  if (existingBoundary && !isEventAfterReadBoundary(lastRead.wall, lastRead.counter, lastReadAuthor ?? '', existingBoundary)) {
    return { changed: false, operation: null, row: existing };
  }

  const row: ChannelReadStateRow = {
    id,
    community_id: communityId,
    channel_id: channelId,
    last_read_wall: lastRead.wall,
    last_read_counter: lastRead.counter,
    last_read_author: lastReadAuthor,
    updated_at: now,
  };
  db.execute(
    `INSERT OR REPLACE INTO cm_read_state (
      id, community_id, channel_id, last_read_wall, last_read_counter, last_read_author, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.community_id,
      row.channel_id,
      row.last_read_wall,
      row.last_read_counter,
      row.last_read_author,
      row.updated_at,
    ],
  );
  return { changed: true, operation: existing ? 'UPDATE' : 'INSERT', row };
}

export function countUnreadChannelMessages(
  db: DatabaseAdapter,
  communityId: string,
  channelId: string,
  visibleMessages?: readonly ChannelMessageEvent[],
): number {
  const boundary = readBoundaryFromReadState(getChannelReadState(db, communityId, channelId));
  const visible = visibleMessages ?? listChannelMessages(db, communityId, channelId);
  if (!boundary) return visible.length;
  return visible.filter((event) => (
    isEventAfterReadBoundary(event.hlc.wall, event.hlc.counter, event.authorDeviceId, boundary)
  )).length;
}

/** Plan 30 T0.4: an aggregated reaction chip for one target message. */
export interface MessageReactionGroup {
  emoji: string;
  /** Distinct non-tombstoned reaction authors holding this emoji. */
  count: number;
  /** True when this device's identity holds this emoji on the target. */
  mine: boolean;
  /** This device's active reaction event id (for building the un-react tombstone). */
  myEventId: string | null;
}

function reactionHiddenBySafety(
  safety: CommunitySafetyIndex,
  react: ChannelMessageEvent,
): boolean {
  if (safety.blockedPersonIds.has(react.authorDeviceId)) return true;
  if (safety.hiddenMessageIds.has(react.id)) return true;
  return false;
}

/**
 * Plan 30 T0.4: verified, non-superseded reactions grouped by (parentId, emoji).
 * A react is a v2 cm_messages row with intent 'react'; an un-react is that
 * author's own supersedes tombstone, so resolveChannelMessages collapses the pair
 * for free. Distinct authors are counted once (idempotent re-reacts), and blocked
 * or report-hidden authors are excluded fail-closed. The returned map is keyed by
 * the reacted-to event id (parentId).
 */
export function listChannelReactions(
  db: DatabaseAdapter,
  communityId: string,
  channelId: string,
  selfDeviceId: string,
  verifiedEvents?: readonly ChannelMessageEvent[],
  safetyIndex?: CommunitySafetyIndex,
): Map<string, MessageReactionGroup[]> {
  const reactions = (verifiedEvents ?? listChannelMessageEvents(db, communityId, channelId))
    .filter(isReactionEvent);
  // resolveChannelMessages drops any react whose author tombstoned it.
  const active = resolveChannelMessages(reactions);
  const safety = safetyIndex ?? (active.length > 0
    ? createCommunitySafetyIndex(db, communityId)
    : null);

  interface EmojiAgg {
    order: number;
    authors: Map<string, string>; // authorDeviceId -> latest active react event id
  }
  const byParent = new Map<string, Map<string, EmojiAgg>>();
  let order = 0;

  for (const react of active) {
    if (!react.parentId) continue;
    if (safety && reactionHiddenBySafety(safety, react)) continue;
    const emoji = react.body;

    const perEmoji = byParent.get(react.parentId) ?? new Map<string, EmojiAgg>();
    byParent.set(react.parentId, perEmoji);
    const agg = perEmoji.get(emoji) ?? { order: order++, authors: new Map<string, string>() };
    // `active` is ascending, so the last write wins as the author's latest react.
    agg.authors.set(react.authorDeviceId, react.id);
    perEmoji.set(emoji, agg);
  }

  const result = new Map<string, MessageReactionGroup[]>();
  for (const [parentId, perEmoji] of byParent) {
    const groups = Array.from(perEmoji.entries())
      .sort((a, b) => a[1].order - b[1].order)
      .map(([emoji, agg]) => ({
        emoji,
        count: agg.authors.size,
        mine: agg.authors.has(selfDeviceId),
        myEventId: agg.authors.get(selfDeviceId) ?? null,
      }));
    result.set(parentId, groups);
  }
  return result;
}

/**
 * Plan 30 (Finding 3): every ACTIVE reaction event id this device holds for a
 * (target, emoji) pair. Makes reacting idempotent (skip a duplicate) and
 * un-reacting total (tombstone all of them), so a double-tap can never leave a
 * sticky reaction after an un-tap.
 */
export function listActiveOwnReactionEventIds(
  db: DatabaseAdapter,
  communityId: string,
  channelId: string,
  selfDeviceId: string,
  parentId: string,
  emoji: string,
): string[] {
  const reactions = listChannelMessageEvents(db, communityId, channelId)
    .filter(isReactionEvent);
  return resolveChannelMessages(reactions)
    .filter((r) => (
      r.authorDeviceId === selfDeviceId && r.parentId === parentId && r.body === emoji
    ))
    .map((r) => r.id);
}

/** Load one verified channel event by id (null if absent, unsupported, or unverified). */
export function getChannelMessageEventById(
  db: DatabaseAdapter,
  eventId: string,
): ChannelMessageEvent | null {
  const rows = db.query<ChannelMessageRow>(
    `SELECT id, community_id, channel_id, author_device_id, body,
       attachments_json, hlc_wall, hlc_counter, supersedes_id, supersedes_deleted,
       signature, updated_at,
       version, post_id, parent_id, branch_id, author_kind, mentions_json, intent
     FROM cm_messages WHERE id = ? LIMIT 1`,
    [eventId],
  );
  const row = rows[0];
  if (!row || !isSupportedChannelMessageVersion(row.version)) return null;
  const event = channelMessageEventFromRow(row);
  return verifyChannelMessage(event) ? event : null;
}

export function listCommunityChannelUnreadCounts(
  db: DatabaseAdapter,
  communityId: string,
): Record<string, number> {
  const rows = db.query<{ channel_id: string }>(
    `SELECT DISTINCT channel_id
     FROM cm_messages
     WHERE community_id = ?
     ORDER BY channel_id ASC`,
    [communityId],
  );
  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.channel_id] = countUnreadChannelMessages(db, communityId, row.channel_id);
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Authenticated pairing payload helpers (mirror of sync-core.ts lines 149-201).
//
// The bundle is self-signed by the device's Ed25519 key (deviceId IS that key),
// so a pasted payload cannot claim a key it does not control. sha512Hex,
// createSignedIdentityBundle, and verifySignedIdentityBundle all come from
// @mylife/sync unchanged.
// ---------------------------------------------------------------------------

export interface SignedPairingPayload {
  v: 2;
  bundle: SignedIdentityBundle;
  pairingNonce: string;
}

/** Build this device's authenticated pairing payload. */
export function buildSignedPairingPayload(
  identity: DeviceIdentity,
  relayHints: string[] = [],
): SignedPairingPayload {
  return {
    v: 2,
    bundle: createSignedIdentityBundle(identity, relayHints),
    pairingNonce: sha512Hex(
      new TextEncoder().encode(`${identity.publicKey}:${identity.dhPublicKey}`),
    ).slice(0, 32),
  };
}

/** Parse + verify a pasted authenticated payload. Null if malformed/unsigned. */
export function parseSignedPairingPayload(json: string): SignedPairingPayload | null {
  try {
    const value = JSON.parse(json) as Partial<SignedPairingPayload>;
    if (
      value.v === 2
      && value.bundle != null
      && typeof value.pairingNonce === 'string'
      && verifySignedIdentityBundle(value.bundle)
    ) {
      return value as SignedPairingPayload;
    }
    return null;
  } catch {
    return null;
  }
}

/** The PairingData completePairing needs, derived from a verified bundle. */
export function pairingDataFromBundle(signed: SignedIdentityBundle): PairingData {
  const { bundle } = signed;
  return {
    publicKey: bundle.deviceId,
    dhPublicKey: bundle.dhPublicKey,
    displayName: bundle.displayName,
    pairingNonce: sha512Hex(
      new TextEncoder().encode(`${bundle.deviceId}:${bundle.dhPublicKey}`),
    ).slice(0, 32),
  };
}

/** PairingData from a v2 envelope, preserving the envelope's transmitted nonce. */
export function pairingDataFromSignedPayload(payload: SignedPairingPayload): PairingData {
  return { ...pairingDataFromBundle(payload.bundle), pairingNonce: payload.pairingNonce };
}

// ---------------------------------------------------------------------------
// Community store bridge for the CREATE path (mirror installCommunityOnNode).
//
// joinCommunityFromLink does this workspace bridge internally; createCommunity
// does NOT, so the founder must persist the descriptor + workspace + members
// itself or the community would not appear in listCommunities and the channel
// post gate would have no membership to read.
// ---------------------------------------------------------------------------

export function storeOwnedCommunity(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  signed: SignedCommunityDescriptor,
  now: string = new Date().toISOString(),
  recordChange?: RecordKeyWrapChange,
): void {
  const d = signed.descriptor;
  const existing = db.query<{ id: string }>('SELECT id FROM sync_workspaces WHERE id = ?', [d.communityId]);
  if (existing.length === 0) {
    createWorkspace(db, {
      id: d.communityId,
      displayName: d.name,
      workspaceType: 'community',
      createdByDeviceId: d.ownerDeviceId,
      createdAt: d.createdAt,
      rotatedAt: null,
      // currentKeyVersion 0: no epoch until createGroupCommit below mints epoch 1.
      // (A non-zero version with no wrap rows would make getCurrentEpochKey lie.)
      currentKeyVersion: 0,
      archivedAt: null,
    });
  }
  for (const member of d.members) {
    const present = db.query<{ device_id: string }>(
      'SELECT device_id FROM sync_workspace_members WHERE workspace_id = ? AND device_id = ?',
      [d.communityId, member.deviceId],
    );
    if (present.length === 0) {
      addWorkspaceMember(db, {
        workspaceId: d.communityId,
        deviceId: member.deviceId,
        role: member.role,
        invitedByDeviceId: d.ownerDeviceId,
        invitedAt: d.createdAt,
        removedAt: null,
      });
    }
  }
  upsertCommunity(db, signed, identity.publicKey, now);

  // Mint epoch 1 wrapped for every member whose DH key the owner knows (community
  // feed P0). The owner always knows its own key; initial members supplied with a
  // dhPublicKey are wrapped too. recordChange replicates the wraps to those
  // members over the next engine session. Idempotent: skipped if an epoch exists.
  if (getWorkspaceEpoch(db, d.communityId) < 1) {
    const members: GroupMemberKey[] = d.members
      .filter((m) => typeof m.dhPublicKey === 'string' && m.dhPublicKey.length > 0)
      .map((m) => ({ deviceId: m.deviceId, dhPublicKey: m.dhPublicKey as string }));
    if (members.some((m) => m.deviceId === identity.publicKey)) {
      createGroupCommit(db, {
        workspaceId: d.communityId,
        committer: identity,
        members,
        recordChange,
        now,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Community feed P1: rolling snapshots (cm_snapshots) + warm cursor
// (cm_feed_cursor). Both tables are LOCAL-ONLY (omitted from the sync policy).
// The cursor is written ROW-ONLY and NEVER through engine.recordChange.
//
// SOURCE OF TRUTH: apps/meerkat/app/(root)/data/community-core.ts (the P1
// snapshot/cursor helpers). Native is canonical; keep this in lockstep.
// ---------------------------------------------------------------------------

interface SnapshotRow {
  community_id: string;
  channel_id: string;
  epoch: number;
  snapshot_id: string;
  info_hash: string;
  through_wall: string;
  through_counter: number;
  manifest_json: string;
  event_count: number;
  created_at: string;
}

function snapshotRecordFromRow(row: SnapshotRow): CommunitySnapshotRecord {
  return {
    communityId: row.community_id,
    channelId: row.channel_id,
    epoch: row.epoch,
    snapshotId: row.snapshot_id,
    infoHash: row.info_hash,
    throughWall: row.through_wall,
    throughCounter: row.through_counter,
    manifestJson: row.manifest_json,
    eventCount: row.event_count,
    createdAt: row.created_at,
  };
}

export function getSnapshotRecord(
  db: DatabaseAdapter,
  communityId: string,
  channelId: string,
): CommunitySnapshotRecord | null {
  const rows = db.query<SnapshotRow>(
    'SELECT * FROM cm_snapshots WHERE community_id = ? AND channel_id = ?',
    [communityId, channelId],
  );
  return rows[0] ? snapshotRecordFromRow(rows[0]) : null;
}

export function listSnapshotRecords(
  db: DatabaseAdapter,
  communityId: string,
): CommunitySnapshotRecord[] {
  return db
    .query<SnapshotRow>(
      'SELECT * FROM cm_snapshots WHERE community_id = ? ORDER BY channel_id ASC',
      [communityId],
    )
    .map(snapshotRecordFromRow);
}

export function putSnapshotRecord(db: DatabaseAdapter, record: CommunitySnapshotRecord): void {
  db.execute(
    `INSERT OR REPLACE INTO cm_snapshots (
      community_id, channel_id, epoch, snapshot_id, info_hash,
      through_wall, through_counter, manifest_json, event_count, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.communityId,
      record.channelId,
      record.epoch,
      record.snapshotId,
      record.infoHash,
      record.throughWall,
      record.throughCounter,
      record.manifestJson,
      record.eventCount,
      record.createdAt,
    ],
  );
}

export function getFeedCursor(
  db: DatabaseAdapter,
  communityId: string,
  channelId: string,
): Hlc | null {
  const rows = db.query<{ last_wall: string; last_counter: number }>(
    'SELECT last_wall, last_counter FROM cm_feed_cursor WHERE community_id = ? AND channel_id = ?',
    [communityId, channelId],
  );
  const row = rows[0];
  return row ? { wall: row.last_wall, counter: row.last_counter } : null;
}

/** Row-only cursor write (personal-replica). NEVER goes through recordChange. */
export function setFeedCursor(
  db: DatabaseAdapter,
  communityId: string,
  channelId: string,
  hlc: Hlc,
  now: string = new Date().toISOString(),
): void {
  db.execute(
    `INSERT OR REPLACE INTO cm_feed_cursor (
      community_id, channel_id, last_wall, last_counter, updated_at
    ) VALUES (?, ?, ?, ?, ?)`,
    [communityId, channelId, hlc.wall, hlc.counter, now],
  );
}

function ownedSnapshotChannels(
  db: DatabaseAdapter,
  communityId: string,
): SnapshotChannelInput[] {
  const community = getCommunity(db, communityId);
  if (!community) return [];
  return community.descriptor.channels.map((channel) => ({
    channelId: channel.id,
    events: listChannelMessageEvents(db, communityId, channel.id),
  }));
}

function listCommunitiesForSnapshots(db: DatabaseAdapter): string[] {
  return db
    .query<{ community_id: string }>('SELECT community_id FROM sync_communities ORDER BY community_id ASC')
    .map((row) => row.community_id);
}

/**
 * Build (or rebuild) every joined community's rolling snapshots from the local
 * cm_messages feed and persist each record. Compaction is handled inside
 * buildCommunitySnapshots (one rolling snapshot per channel).
 */
export async function buildOwnedCommunitySnapshots(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  pieceStore: SnapshotPieceStore,
  now: string = new Date().toISOString(),
): Promise<BuildCommunitySnapshotsResult> {
  const allRecords: CommunitySnapshotRecord[] = [];
  const allSkipped: BuildCommunitySnapshotsResult['skipped'] = [];
  const allOversized: BuildCommunitySnapshotsResult['oversized'] = [];
  for (const communityId of listCommunitiesForSnapshots(db)) {
    const result = await buildCommunitySnapshots({
      db,
      identity,
      communityId,
      channels: ownedSnapshotChannels(db, communityId),
      pieceStore,
      previous: listSnapshotRecords(db, communityId),
      now,
    });
    for (const record of result.records) putSnapshotRecord(db, record);
    allRecords.push(...result.records);
    allSkipped.push(...result.skipped);
    allOversized.push(...result.oversized);
  }
  return { records: allRecords, skipped: allSkipped, oversized: allOversized };
}

/** Build (or rebuild) snapshots for a SINGLE community. */
export async function buildCommunitySnapshotsForId(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  communityId: string,
  pieceStore: SnapshotPieceStore,
  now: string = new Date().toISOString(),
): Promise<BuildCommunitySnapshotsResult> {
  const result = await buildCommunitySnapshots({
    db,
    identity,
    communityId,
    channels: ownedSnapshotChannels(db, communityId),
    pieceStore,
    previous: listSnapshotRecords(db, communityId),
    now,
  });
  for (const record of result.records) putSnapshotRecord(db, record);
  return result;
}

export interface ImportChannelSnapshotResult {
  ok: boolean;
  reason?: string;
  inserted: number;
  skipped: number;
  invalid: number;
  newEvents: number;
  cursorAdvanced: boolean;
}

/**
 * Warm-import a channel's snapshot from a host-style piece store: load the stored
 * manifest, decrypt + verify the pieces with the current epoch key, take only the
 * events strictly after the local cursor, merge them into cm_messages, and advance
 * the cursor (row-only) to the highest imported HLC. Returns honest counts.
 */
export async function importChannelSnapshot(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  communityId: string,
  channelId: string,
  pieceStore: SnapshotPieceStore,
  now: string = new Date().toISOString(),
): Promise<ImportChannelSnapshotResult> {
  const record = getSnapshotRecord(db, communityId, channelId);
  if (!record) {
    return { ok: false, reason: 'no_snapshot', inserted: 0, skipped: 0, invalid: 0, newEvents: 0, cursorAdvanced: false };
  }
  const manifest = parseSnapshotManifest(record.manifestJson);
  if (!manifest) {
    return { ok: false, reason: 'bad_manifest', inserted: 0, skipped: 0, invalid: 0, newEvents: 0, cursorAdvanced: false };
  }
  const epochKey = getCurrentEpochKey(db, communityId, identity);
  if (!epochKey) {
    return { ok: false, reason: 'no_key', inserted: 0, skipped: 0, invalid: 0, newEvents: 0, cursorAdvanced: false };
  }

  const cursor = getFeedCursor(db, communityId, channelId);
  const imported = await importSnapshotFromPieces({
    communityId,
    channelId,
    epoch: record.epoch,
    manifest,
    pieceStore,
    groupKey: epochKey.secret,
    existingEvents: listChannelMessageEvents(db, communityId, channelId),
    sinceHlc: cursor,
  });
  if (!imported.ok) {
    return { ok: false, reason: imported.reason, inserted: 0, skipped: 0, invalid: 0, newEvents: 0, cursorAdvanced: false };
  }

  const merge = mergeChannelMessageEvents(db, imported.newEvents);

  let cursorAdvanced = false;
  const highest = imported.events.length > 0 ? imported.events[imported.events.length - 1].hlc : null;
  if (highest && (!cursor || compareHlc(highest, cursor) > 0)) {
    setFeedCursor(db, communityId, channelId, highest, now);
    cursorAdvanced = true;
  }

  return {
    ok: true,
    inserted: merge.inserted,
    skipped: merge.skipped,
    invalid: merge.invalid,
    newEvents: imported.newEvents.length,
    cursorAdvanced,
  };
}

// ---------------------------------------------------------------------------
// Channel-message ATTACHMENT row helpers (mirror of community-core.ts lines
// 148-365: channelMessageAttachmentRowsFromEvent, insertMessageAttachmentRows,
// listMessageAttachmentRows, mergeChannelMessageEvents).
//
// The cm_message_attachments table already lives in schema.ts (mirror of
// COMMUNITY_DDL). These helpers carry the signed attachment metadata into the
// index table and merge verified inbound channel events fail-closed.
// ---------------------------------------------------------------------------

export interface ChannelMessageAttachmentRow {
  id: string;
  message_id: string;
  community_id: string;
  channel_id: string;
  attachment_id: string;
  blob_hash: string;
  name: string;
  mime_type: string;
  size: number;
  updated_at: string;
}

export interface MergeChannelMessageEventsResult {
  inserted: number;
  skipped: number;
  invalid: number;
  /** Events dropped because their author's roster row was CLOSED before the event's stamp (Plan 28 P5). */
  droppedRemoved: number;
  /**
   * The events actually inserted on THIS device -- the ONLY set safe to replicate
   * onward (excludes dropped-removed events, which must not be re-injected to
   * peers who fail-closed dropped them; Plan 28 membership cut).
   */
  insertedEvents: ChannelMessageEvent[];
}

export function channelMessageAttachmentRowsFromEvent(
  event: ChannelMessageEvent,
): ChannelMessageAttachmentRow[] {
  return (event.attachments ?? []).map((attachment) => ({
    id: `${event.id}:${attachment.id}`,
    message_id: event.id,
    community_id: event.communityId,
    channel_id: event.channelId,
    attachment_id: attachment.id,
    blob_hash: attachment.blobHash,
    name: attachment.name,
    mime_type: attachment.mimeType,
    size: attachment.size,
    updated_at: event.hlc.wall,
  }));
}

export function insertMessageAttachmentRows(
  db: DatabaseAdapter,
  event: ChannelMessageEvent,
): ChannelMessageAttachmentRow[] {
  const rows = channelMessageAttachmentRowsFromEvent(event);
  for (const row of rows) {
    db.execute(
      `INSERT OR IGNORE INTO cm_message_attachments (
        id, message_id, community_id, channel_id, attachment_id,
        blob_hash, name, mime_type, size, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.message_id,
        row.community_id,
        row.channel_id,
        row.attachment_id,
        row.blob_hash,
        row.name,
        row.mime_type,
        row.size,
        row.updated_at,
      ],
    );
  }
  return rows;
}

export function listMessageAttachmentRows(
  db: DatabaseAdapter,
  messageId: string,
): ChannelMessageAttachmentRow[] {
  return db.query<ChannelMessageAttachmentRow>(
    `SELECT id, message_id, community_id, channel_id, attachment_id,
       blob_hash, name, mime_type, size, updated_at
     FROM cm_message_attachments
     WHERE message_id = ?
     ORDER BY id ASC`,
    [messageId],
  );
}

/**
 * Merge verified inbound channel events: each event is verified
 * (verifyChannelMessage), skipped if already present, otherwise its row and
 * attachment rows are written. Mirror of community-core.ts mergeChannelMessageEvents.
 */
export function mergeChannelMessageEvents(
  db: DatabaseAdapter,
  events: readonly ChannelMessageEvent[],
): MergeChannelMessageEventsResult {
  let inserted = 0;
  let skipped = 0;
  let invalid = 0;
  let droppedRemoved = 0;
  const insertedEvents: ChannelMessageEvent[] = [];

  for (const event of events) {
    if (!verifyChannelMessage(event)) {
      invalid += 1;
      continue;
    }

    // Plan 28 P5 membership cut: the pairwise channel-mailbox delivery is
    // membership-UNCHECKED, so the APPLY side is the gate. A CLOSED roster row
    // bounds what its author can still add on THIS device: events stamped after
    // removed_at are dropped fail-closed (a removed member cannot author
    // accepted new rows, AC-2). Events from BEFORE the removal stay
    // (epoch-boundary honesty), and an author with NO roster row at all is
    // allowed -- history from members gone before this device joined must not
    // vanish from snapshot/backfill imports.
    const roster = db.query<{ removed_at: string | null }>(
      'SELECT removed_at FROM sync_workspace_members WHERE workspace_id = ? AND device_id = ? LIMIT 1',
      [event.communityId, event.authorDeviceId],
    );
    const removedAt = roster.length > 0 ? roster[0]!.removed_at : null;
    if (typeof removedAt === 'string') {
      const removedMs = Date.parse(removedAt);
      const eventMs = Date.parse(event.hlc.wall);
      if (Number.isNaN(removedMs) || Number.isNaN(eventMs) || eventMs > removedMs) {
        droppedRemoved += 1;
        continue;
      }
    }

    const existing = db.query<{ id: string }>(
      'SELECT id FROM cm_messages WHERE id = ? LIMIT 1',
      [event.id],
    );
    if (existing.length > 0) {
      skipped += 1;
      continue;
    }
    insertMessageRow(db, event);
    insertMessageAttachmentRows(db, event);
    inserted += 1;
    insertedEvents.push(event);
  }

  return { inserted, skipped, invalid, droppedRemoved, insertedEvents };
}

// ---------------------------------------------------------------------------
// File-request ledger (verbatim mirror of
//   apps/meerkat/app/(root)/data/file-request-core.ts)
//
// The honest LOCAL-ONLY ledger behind the request/approve/restore flow. The
// cm_file_requests table (in schema.ts) is the single source of truth for that
// state machine; it is deliberately omitted from the sync policy so it NEVER
// replicates. Only the sealed FILE_REQUEST / FILE_GRANT mailbox payload (from
// @mylife/sync, consumed unchanged) crosses the wire.
//
// HONESTY rules enforced here:
//   - An OUTGOING row is written ONLY after an envelope was actually parked; the
//     caller passes 'requested' only on a real park. Parking failure records
//     'failed', never an optimistic 'requested'.
//   - 'restored' is set ONLY after verify-then-pin succeeded AND local presence
//     confirms the bytes.
//   - A decline records the real reason; it never silently retries or pretends.
// ---------------------------------------------------------------------------

export type FileRequestDirection = 'outgoing' | 'incoming';

export type FileRequestStatus =
  | 'requested'
  | 'approved'
  | 'declined'
  | 'restored'
  | 'failed';

export interface FileRequestRow {
  id: string;
  community_id: string;
  channel_id: string;
  message_id: string;
  attachment_id: string;
  blob_hash: string;
  direction: FileRequestDirection;
  counterparty_device_id: string;
  status: FileRequestStatus;
  /** Honest free-text detail (e.g. a decline reason or a parking error). */
  detail: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertFileRequestInput {
  id: string;
  communityId: string;
  channelId: string;
  messageId: string;
  attachmentId: string;
  blobHash: string;
  direction: FileRequestDirection;
  counterpartyDeviceId: string;
  status: FileRequestStatus;
  detail?: string | null;
  now?: string;
}

export function getFileRequest(db: DatabaseAdapter, id: string): FileRequestRow | null {
  const rows = db.query<FileRequestRow>(
    `SELECT id, community_id, channel_id, message_id, attachment_id, blob_hash,
       direction, counterparty_device_id, status, detail, created_at, updated_at
     FROM cm_file_requests WHERE id = ? LIMIT 1`,
    [id],
  );
  return rows[0] ?? null;
}

/** Insert or update a request row. Idempotent on id (the requestId). */
export function upsertFileRequest(
  db: DatabaseAdapter,
  input: UpsertFileRequestInput,
): FileRequestRow {
  const now = input.now ?? new Date().toISOString();
  const existing = getFileRequest(db, input.id);
  const createdAt = existing?.created_at ?? now;
  const row: FileRequestRow = {
    id: input.id,
    community_id: input.communityId,
    channel_id: input.channelId,
    message_id: input.messageId,
    attachment_id: input.attachmentId,
    blob_hash: input.blobHash,
    direction: input.direction,
    counterparty_device_id: input.counterpartyDeviceId,
    status: input.status,
    detail: input.detail ?? null,
    created_at: createdAt,
    updated_at: now,
  };
  db.execute(
    `INSERT OR REPLACE INTO cm_file_requests (
      id, community_id, channel_id, message_id, attachment_id, blob_hash,
      direction, counterparty_device_id, status, detail, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.community_id,
      row.channel_id,
      row.message_id,
      row.attachment_id,
      row.blob_hash,
      row.direction,
      row.counterparty_device_id,
      row.status,
      row.detail,
      row.created_at,
      row.updated_at,
    ],
  );
  return row;
}

/** Advance an existing row's status + detail. No-op (returns null) if missing. */
export function setFileRequestStatus(
  db: DatabaseAdapter,
  id: string,
  status: FileRequestStatus,
  detail: string | null = null,
  now: string = new Date().toISOString(),
): FileRequestRow | null {
  const existing = getFileRequest(db, id);
  if (!existing) return null;
  db.execute(
    'UPDATE cm_file_requests SET status = ?, detail = ?, updated_at = ? WHERE id = ?',
    [status, detail, now, id],
  );
  return { ...existing, status, detail, updated_at: now };
}

/** The outgoing request row for an attachment slot, if any (drives the card). */
export function getOutgoingRequestForAttachment(
  db: DatabaseAdapter,
  communityId: string,
  channelId: string,
  attachmentId: string,
): FileRequestRow | null {
  const rows = db.query<FileRequestRow>(
    `SELECT id, community_id, channel_id, message_id, attachment_id, blob_hash,
       direction, counterparty_device_id, status, detail, created_at, updated_at
     FROM cm_file_requests
     WHERE direction = 'outgoing' AND community_id = ? AND channel_id = ? AND attachment_id = ?
     ORDER BY updated_at DESC
     LIMIT 1`,
    [communityId, channelId, attachmentId],
  );
  return rows[0] ?? null;
}

/** Open incoming requests awaiting the owner's Approve/Decline tap. */
export function listIncomingPendingRequests(
  db: DatabaseAdapter,
  communityId?: string,
): FileRequestRow[] {
  if (communityId) {
    return db.query<FileRequestRow>(
      `SELECT id, community_id, channel_id, message_id, attachment_id, blob_hash,
         direction, counterparty_device_id, status, detail, created_at, updated_at
       FROM cm_file_requests
       WHERE direction = 'incoming' AND status = 'requested' AND community_id = ?
       ORDER BY created_at ASC`,
      [communityId],
    );
  }
  return db.query<FileRequestRow>(
    `SELECT id, community_id, channel_id, message_id, attachment_id, blob_hash,
       direction, counterparty_device_id, status, detail, created_at, updated_at
     FROM cm_file_requests
     WHERE direction = 'incoming' AND status = 'requested'
     ORDER BY created_at ASC`,
  );
}

// ---------------------------------------------------------------------------
// Community feed P3: member-to-member history backfill over the pair-private
// mailbox. The serve + apply handlers re-verify EVERY event on BOTH sides and
// gate non-members / revoked / role-denied authors out. No new crypto: this
// reuses @mylife/sync mailbox seal/open + verifyChannelMessage +
// evaluateChannelPost + the cursor helpers above.
//
// SOURCE OF TRUTH (keep in lockstep, verbatim, until a shared @mylife/meerkat-core
// package extracts these):
//   - active-member gate : apps/meerkat/app/(root)/data/file-request-core.ts
//                          (isActiveCommunityMember)
//   - backfill handlers  : apps/meerkat/app/(root)/data/history-backfill-core.ts
//                          (buildHistoryBackfillHandlers)
// Native is canonical. Every cryptographic + protocol primitive is from
// @mylife/sync unchanged (App Isolation guardrail).
// ---------------------------------------------------------------------------

/** The standard active-member check, reused by foreground + background handlers. */
export function isActiveCommunityMember(
  db: DatabaseAdapter,
  communityId: string,
  deviceId: string,
): boolean {
  const rows = db.query<{ device_id: string }>(
    `SELECT device_id
     FROM sync_workspace_members
     WHERE workspace_id = ? AND device_id = ? AND removed_at IS NULL
     LIMIT 1`,
    [communityId, deviceId],
  );
  return rows.length > 0;
}

export interface BuildFileMailboxHandlersDeps {
  db: DatabaseAdapter;
  blobStore: SessionBlobProvider & { has?: (hash: string) => Promise<boolean> };
  /** Is a device a current, non-removed member of a community? */
  isActiveMember: (communityId: string, deviceId: string) => boolean;
}

/**
 * Build the per-kind mailbox drain handlers (channelMessage / fileRequest /
 * fileGrant). fail-closed throughout, exactly like file-request-core.ts:
 *   - channelMessage merges verified events;
 *   - fileRequest records an incoming row ONLY if the sender is a current,
 *     non-revoked member (drops otherwise); nothing is auto-sent;
 *   - fileGrant matches OUR outgoing row, re-verifies bytes against OUR own
 *     signed-event hash (verify-then-pin), and flips to 'restored' only after the
 *     write succeeds and a live presence check confirms the bytes.
 */
export function buildFileMailboxHandlers(
  deps: BuildFileMailboxHandlersDeps,
): MailboxEnvelopeHandlers {
  const { db, blobStore, isActiveMember } = deps;
  return {
    channelMessage: (events) => mergeChannelMessageEvents(db, events),
    fileRequest: (senderDeviceId: string, payload: FileRequestMailboxPayload): boolean => {
      if (isDeviceRevoked(db, senderDeviceId)) return false;
      if (!isActiveMember(payload.communityId, senderDeviceId)) return false;
      upsertFileRequest(db, {
        id: payload.requestId,
        communityId: payload.communityId,
        channelId: payload.channelId,
        messageId: payload.messageId,
        attachmentId: payload.attachmentId,
        blobHash: payload.blobHash,
        direction: 'incoming',
        counterpartyDeviceId: senderDeviceId,
        status: 'requested',
      });
      return true;
    },
    fileGrant: async (
      senderDeviceId: string,
      payload: FileGrantMailboxPayload,
    ): Promise<boolean> => {
      const row = getFileRequest(db, payload.requestId);
      if (!row || row.direction !== 'outgoing' || row.counterparty_device_id !== senderDeviceId) {
        return false;
      }

      // Expected hash = OUR signed-event blob hash, so a malicious owner cannot
      // swap in different bytes under the same UI slot.
      const attRows = listMessageAttachmentRows(db, row.message_id);
      const expected = attRows.find((a) => a.attachment_id === row.attachment_id);
      const expectedBlobHash = expected?.blob_hash ?? row.blob_hash;

      const result = await restoreFromGrantPayload({
        payload,
        expectedBlobHash,
        putBlob: (hash, bytes, meta) => blobStore.put(hash, bytes, meta),
        moduleId: COMMUNITY_MODULE_ID,
      });

      if (result.ok && result.restored) {
        const present = blobStore.has ? await blobStore.has(expectedBlobHash) : true;
        setFileRequestStatus(
          db,
          row.id,
          present ? 'restored' : 'failed',
          present ? null : 'Wrote bytes but could not confirm them on disk.',
        );
        return true;
      }
      if (result.ok && !result.restored) {
        const reason = result.reason === 'owner_no_longer_has_file'
          ? 'Owner no longer has this file.'
          : 'Owner declined.';
        setFileRequestStatus(db, row.id, 'declined', reason);
        return true;
      }
      setFileRequestStatus(db, row.id, 'failed', `Restore failed (${result.reason}).`);
      return false;
    },
  };
}

/** Highest HLC across a set of events (mirror of history-backfill-core.ts). */
function highestEventHlc(events: readonly ChannelMessageEvent[]): Hlc | null {
  let highest: Hlc | null = null;
  for (const event of events) {
    if (
      !highest
      || event.hlc.wall > highest.wall
      || (event.hlc.wall === highest.wall && event.hlc.counter > highest.counter)
    ) {
      highest = event.hlc;
    }
  }
  return highest;
}

export interface BuildHistoryBackfillHandlersDeps {
  db: DatabaseAdapter;
  identity: DeviceIdentity;
  resolvePeer: (deviceId: string) => { dhPublicKey: string; sharedSecretHex: string } | null;
  parkEnvelope: (token: string, envelope: MailboxEnvelope) => boolean | Promise<boolean>;
  now?: () => string;
}

/**
 * Build the per-kind history-backfill drain handlers (serve + apply). Mirror of
 * apps/meerkat/app/(root)/data/history-backfill-core.ts buildHistoryBackfillHandlers.
 */
export function buildHistoryBackfillHandlers(
  deps: BuildHistoryBackfillHandlersDeps,
): Pick<MailboxEnvelopeHandlers, 'historyRequest' | 'historyGrant'> {
  const { db, identity, resolvePeer, parkEnvelope } = deps;
  const nowFn = deps.now ?? (() => new Date().toISOString());

  return {
    historyRequest: async (
      senderDeviceId: string,
      payload: HistoryRequestMailboxPayload,
    ): Promise<boolean> => {
      if (isDeviceRevoked(db, senderDeviceId)) return false;
      if (!isActiveCommunityMember(db, payload.communityId, senderDeviceId)) return false;

      const community = getCommunity(db, payload.communityId);
      if (!community) return false;
      const descriptor = community.descriptor;

      const channelExists = descriptor.channels.some((c) => c.id === payload.channelId);
      if (!channelExists) return false;

      const all = listChannelMessageEvents(db, payload.communityId, payload.channelId);
      const servable: ChannelMessageEvent[] = [];
      for (const event of all) {
        if (!isAfterCursor(event, payload.sinceWall, payload.sinceCounter)) continue;
        if (!isServableEvent(event)) continue;
        if (!evaluateChannelPost(descriptor, event.authorDeviceId, payload.channelId).allowed) {
          continue;
        }
        servable.push(event);
        if (servable.length >= HISTORY_GRANT_MAX_EVENTS) break;
      }

      if (servable.length === 0) return false;

      const peer = resolvePeer(senderDeviceId);
      if (!peer) return false;

      const grantPayload: HistoryGrantMailboxPayload = {
        kind: 'meerkat.history-grant-v1',
        version: 1,
        communityId: payload.communityId,
        channelId: payload.channelId,
        requestId: payload.requestId,
        events: servable,
      };
      const sealed = sealHistoryGrantMailbox({
        sender: identity,
        recipient: { deviceId: senderDeviceId, dhPublicKey: peer.dhPublicKey },
        pairSharedSecretHex: peer.sharedSecretHex,
        payload: grantPayload,
        now: nowFn(),
      });

      const parked = await parkEnvelope(sealed.token, sealed.envelope);
      return parked === true;
    },

    historyGrant: (
      _senderDeviceId: string,
      payload: HistoryGrantMailboxPayload,
    ): boolean => {
      const community = getCommunity(db, payload.communityId);
      if (!community) return false;
      const descriptor = community.descriptor;

      const valid: ChannelMessageEvent[] = [];
      for (const event of payload.events) {
        if (event.communityId !== payload.communityId) continue;
        if (event.channelId !== payload.channelId) continue;
        if (!verifyChannelMessage(event)) continue;
        if (!evaluateChannelPost(descriptor, event.authorDeviceId, payload.channelId).allowed) {
          continue;
        }
        valid.push(event);
      }

      if (valid.length === 0) return false;

      const merge = mergeChannelMessageEvents(db, valid);
      if (merge.inserted <= 0) return false;

      const stored = listChannelMessageEvents(db, payload.communityId, payload.channelId);
      const highest = highestEventHlc(stored);
      if (highest) {
        const cursor = getFeedCursor(db, payload.communityId, payload.channelId);
        if (
          !cursor
          || highest.wall > cursor.wall
          || (highest.wall === cursor.wall && highest.counter > cursor.counter)
        ) {
          setFeedCursor(db, payload.communityId, payload.channelId, highest);
        }
      }
      return true;
    },
  };
}

// ---------------------------------------------------------------------------
// Per-community Files index aggregation (verbatim mirror of
//   apps/meerkat/app/(root)/data/community-files.ts, the aggregation + presence
//   portion. Bulk-save orchestration is platform-specific so the web FilesView
//   uses the browser download path directly.)
//
// HONESTY (Critical): aggregate from RESOLVED message events
// (listChannelMessages output), reading event.attachments, NEVER the
// cm_message_attachments rows (those are INSERT OR IGNORE and never tombstoned).
// PRESENCE comes ONLY from a real has() check applied as an async pass.
// ---------------------------------------------------------------------------

export interface AggregatedFile {
  /** Stable selection id: `${channelId}:${attachmentId}`. */
  id: string;
  attachmentId: string;
  blobHash: string;
  name: string;
  mimeType: string;
  size: number;
  channelId: string;
  channelName: string;
  messageId: string;
  authorDeviceId: string;
  hlcWall: string;
  hlcCounter: number;
}

export interface PresentFile extends AggregatedFile {
  /** True only when has() confirmed the bytes are on this device. */
  present: boolean;
}

export function aggregatedFileId(channelId: string, attachmentId: string): string {
  return `${channelId}:${attachmentId}`;
}

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

export function applyPresence(
  files: readonly AggregatedFile[],
  presence: Map<string, boolean>,
): PresentFile[] {
  return files.map((file) => ({ ...file, present: presence.get(file.blobHash) ?? false }));
}

// ---------------------------------------------------------------------------
// Request-again view-state derivation (verbatim mirror of
//   apps/meerkat/app/(root)/data/attachment-card-state.ts, the honest portion).
//
// Presence is derived LIVE from a real has() check (passed in), never a stored
// flag. The freed-space figure uses the SIGNED attachment.size.
// ---------------------------------------------------------------------------

export type AttachmentCardMode = 'checking' | 'present' | 'removed';

export const REQUEST_AGAIN_LABEL = 'Request again';

export function deriveAttachmentCardMode(present: boolean | null): AttachmentCardMode {
  if (present === null) return 'checking';
  return present ? 'present' : 'removed';
}

export function presentMetaLabel(size: number): string {
  return `${formatBytes(size)} · on this device`;
}

export interface RequestAgainAvailability {
  canRequest: boolean;
  disabledReason: string | null;
}

export interface RequestAgainContext {
  /** Did THIS device author the message? You cannot request your own file back. */
  isOwnMessage: boolean;
  /** Is the message author currently a paired device (so a request can be sealed)? */
  authorPaired: boolean;
  /** Is a relay configured (the store-and-forward path the request rides)? */
  relayConfigured: boolean;
}

export function deriveRequestAgainAvailability(ctx: RequestAgainContext): RequestAgainAvailability {
  if (ctx.isOwnMessage) {
    return { canRequest: false, disabledReason: 'You shared this file. Re-add it from your own device.' };
  }
  if (!ctx.authorPaired) {
    return { canRequest: false, disabledReason: 'You can only request from a paired member.' };
  }
  if (!ctx.relayConfigured) {
    return { canRequest: false, disabledReason: 'Set a connection server before requesting files back.' };
  }
  return { canRequest: true, disabledReason: null };
}

/** The live request state for an attachment, mirrored from cm_file_requests. */
export type RequestAgainStatus =
  | 'none'
  | 'requesting'
  | 'requested'
  | 'restored'
  | 'declined'
  | 'failed';

export interface RequestAgainView {
  tone: 'info' | 'success' | 'error';
  message: string | null;
  busy: boolean;
}

export function deriveRequestAgainView(
  status: RequestAgainStatus,
  detail?: string | null,
): RequestAgainView {
  switch (status) {
    case 'requesting':
      return { tone: 'info', message: 'Sending request to the owner…', busy: true };
    case 'requested':
      return {
        tone: 'info',
        message: 'Waiting for the owner to approve. They will see your request the next time they are online.',
        busy: false,
      };
    case 'restored':
      return { tone: 'success', message: 'Restored to this device.', busy: false };
    case 'declined':
      return { tone: 'error', message: detail?.trim() || 'Owner declined.', busy: false };
    case 'failed':
      return {
        tone: 'error',
        message: detail?.trim() || 'Could not send the request. You can try again.',
        busy: false,
      };
    case 'none':
    default:
      return { tone: 'info', message: null, busy: false };
  }
}

/** Honest copy for a queue-request failure reason. */
export function requestQueueFailureMessage(
  reason:
    | 'not_paired'
    | 'no_relay'
    | 'revoked'
    | 'not_a_member'
    | 'park_failed'
    | 'payment_required'
    | 'self_author',
): string {
  switch (reason) {
    case 'not_paired':
      return 'You can only request from a paired member.';
    case 'no_relay':
      return 'Set a connection server before requesting files back.';
    case 'revoked':
      return 'That member is revoked on this device.';
    case 'not_a_member':
      return 'The owner is no longer a member of this community.';
    case 'park_failed':
      return 'Could not reach the connection server to send the request. Try again when you are online.';
    case 'payment_required':
      return 'The hosted Meerkat connection server requires an active subscription. Use your own server or sign in to hosted access.';
    case 'self_author':
      return 'You shared this file. Re-add it from your own device.';
    default: {
      const _exhaustive: never = reason;
      return _exhaustive;
    }
  }
}

export function freedBytesLabel(size: number): string {
  return `Removed from this device to free ${formatBytes(size)}`;
}

export const REMOVED_META_LABEL = 'Removed from this device';

export interface RemoveFeedback {
  removed: boolean;
  tone: 'success' | 'info' | 'error';
  message: string;
}

export function summarizeRemoveResult(
  result: import('./storage/blob-store-core').RemoveBlobResult,
  size: number,
): RemoveFeedback {
  if (result.freed) {
    return { removed: true, tone: 'success', message: freedBytesLabel(size) };
  }
  switch (result.reason) {
    case 'not-present':
      return { removed: true, tone: 'info', message: REMOVED_META_LABEL };
    case 'still-referenced':
      return {
        removed: false,
        tone: 'info',
        message: 'Kept on this device: another file in this community still uses these bytes.',
      };
    case 'verify-failed':
      return {
        removed: false,
        tone: 'error',
        message: 'Could not confirm the file was deleted. Your local copy is still here.',
      };
    case 'error':
      return {
        removed: false,
        tone: 'error',
        message: `Could not remove the local copy: ${result.message}`,
      };
    default: {
      const _exhaustive: never = result;
      return _exhaustive;
    }
  }
}

/** Map a live FileRequestRow status (+ transient requesting) to a card status. */
export function requestAgainStatusFromRow(
  row: FileRequestRow | null,
  requesting: boolean,
): RequestAgainStatus {
  if (requesting) return 'requesting';
  if (!row) return 'none';
  switch (row.status) {
    case 'requested':
    case 'approved':
      return 'requested';
    case 'restored':
      return 'restored';
    case 'declined':
      return 'declined';
    case 'failed':
      return 'failed';
    default:
      return 'none';
  }
}

// ---------------------------------------------------------------------------
// Community feed P4: refresh ("pull now") + notify-drain core.
//
// SOURCE OF TRUTH: apps/meerkat/app/(root)/data/community-core.ts
// (refreshCommunityFeed / drainCommunityNotifyForRefresh). This is the verbatim
// web twin; keep them in lockstep.
// ---------------------------------------------------------------------------

/** What actually answered a refresh. Honest: it reflects reality, never a fake live. */
export type RefreshFeedSource = 'community node' | 'peer' | 'no host reachable' | 'removed';

export interface RefreshCommunityFeedResult {
  /** Real count of NEW events merged into cm_messages this refresh (0 on the peer path: a parked backfill applies later). */
  applied: number;
  /** Set ONLY on a real successful community-node pull; null otherwise. */
  lastPulledAt: string | null;
  source: RefreshFeedSource;
}

export interface RefreshCommunityFeedDeps {
  /** Injected for tests. Defaults to global fetch. */
  fetchFn?: typeof fetch;
  /** Optional hosted-entitlement bearer for entitlement-gated first-party nodes. */
  entitlementToken?: string;
  /**
   * Fallback when no community node host is reachable: enqueue a P3 member-to-
   * member history backfill (parks a request per channel to a paired peer). The
   * caller wires this to the sync history-request queue. Returns the number of
   * requests really parked. A parked request applies LATER (on grant drain), so
   * the peer path reports applied:0 here -- honest.
   */
  enqueuePeerBackfill?: (communityId: string) => Promise<number> | number;
  now?: string;
}

/** The first http(s) host in the descriptor, treated as the community node base url. */
function communityNodeUrl(db: DatabaseAdapter, communityId: string): string | null {
  const community = getCommunity(db, communityId);
  if (!community) return null;
  const host = community.descriptor.hosts.find((h) => /^https?:\/\//i.test(h));
  return host ? host.replace(/\/+$/, '') : null;
}

/**
 * Pull this community's feed NOW. Tries the community node (pullCommunityFeed,
 * P2) when a node URL is configured; otherwise falls back to a P3 member
 * backfill. Returns REAL counts: `applied` is the number of NEW verified events
 * merged this refresh, `lastPulledAt` is set ONLY on a real successful node pull,
 * and `source` reflects what actually answered. Never claims a status the
 * transport cannot prove.
 */
/**
 * OLDER epoch keys this device still holds (up to 8 prior epochs). A tail entry
 * sealed just before a membership rotation carries no epoch tag; handing the
 * pull these candidates lets it recover the delayed event instead of silently
 * dropping it (authenticated decryption makes a wrong key fail safely).
 */
function candidateEpochKeys(
  db: DatabaseAdapter,
  communityId: string,
  identity: DeviceIdentity,
  currentEpoch: number,
): { epoch: number; secret: Uint8Array }[] {
  const candidates: { epoch: number; secret: Uint8Array }[] = [];
  for (let epoch = currentEpoch - 1; epoch >= Math.max(1, currentEpoch - 8); epoch -= 1) {
    const secret = unwrapEpochSecret(db, communityId, epoch, identity);
    if (secret) candidates.push({ epoch, secret });
  }
  return candidates;
}

type PullHostFeedOutcome =
  | { outcome: 'merged'; applied: number }
  | { outcome: 'not_member' }
  | { outcome: 'no_epoch_key' }
  | { outcome: 'failed'; reason: string };

/**
 * The ONE node-pull-and-merge path (refresh, pre-publish safety pull, and the
 * attach flow all share it so they cannot drift): authenticated pull, local
 * decrypt + inner verify, merge into cm_messages, advance cursors, and record
 * lastPulledAt ONLY on a real success.
 */
async function pullHostFeedAndMerge(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  communityId: string,
  nodeUrl: string,
  deps: RefreshCommunityFeedDeps = {},
): Promise<PullHostFeedOutcome> {
  const now = deps.now ?? new Date().toISOString();
  const epochKey = getCurrentEpochKey(db, communityId, identity);
  if (!epochKey) return { outcome: 'no_epoch_key' };
  const existingEventsByChannel: Record<string, ChannelMessageEvent[]> = {};
  const cursorByChannel: Record<string, Hlc | null> = {};
  const community = getCommunity(db, communityId);
  for (const channel of community?.descriptor.channels ?? []) {
    existingEventsByChannel[channel.id] = listChannelMessageEvents(db, communityId, channel.id);
    cursorByChannel[channel.id] = getFeedCursor(db, communityId, channel.id);
  }
  const result = await pullCommunityFeed({
    baseUrl: nodeUrl,
    communityId,
    identity,
    fetchFn: deps.fetchFn,
    entitlementToken: deps.entitlementToken,
    getEpochKey: () => epochKey,
    getCandidateEpochKeys: () => candidateEpochKeys(db, communityId, identity, epochKey.epoch),
    existingEventsByChannel,
    cursorByChannel,
    now,
  });
  if (!result.ok) {
    return result.reason === 'not_member'
      ? { outcome: 'not_member' }
      : { outcome: 'failed', reason: result.reason };
  }
  let applied = 0;
  for (const channel of result.channels) {
    const merge = mergeChannelMessageEvents(db, channel.newEvents);
    applied += merge.inserted;
    // Advance the cursor (row-only) to the highest resolved HLC.
    const highest = channel.events.length > 0 ? channel.events[channel.events.length - 1].hlc : null;
    const cursor = cursorByChannel[channel.channelId] ?? null;
    if (highest && (!cursor || compareHlc(highest, cursor) > 0)) {
      setFeedCursor(db, communityId, channel.channelId, highest, now);
    }
  }
  // Real successful node pull: persist the pull time (row-only, personal).
  setLastPulledAt(db, communityId, now);
  return { outcome: 'merged', applied };
}

export async function refreshCommunityFeed(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  communityId: string,
  deps: RefreshCommunityFeedDeps = {},
): Promise<RefreshCommunityFeedResult> {
  const now = deps.now ?? new Date().toISOString();
  const nodeUrl = communityNodeUrl(db, communityId);

  if (nodeUrl) {
    const pulled = await pullHostFeedAndMerge(db, identity, communityId, nodeUrl, { ...deps, now });
    if (pulled.outcome === 'merged') {
      return { applied: pulled.applied, lastPulledAt: now, source: 'community node' };
    }
    // The node holds the latest roster and explicitly rejected this device as a
    // non-member: surface the removed state honestly instead of a generic miss.
    // (Do NOT advance last_pulled; nothing was pulled.)
    if (pulled.outcome === 'not_member') {
      return { applied: 0, lastPulledAt: null, source: 'removed' };
    }
    // A node was configured but the pull failed (auth/fetch/parse/no key): fall
    // through to the peer fallback rather than claim a node success.
  }

  // No reachable / usable community node: try the P3 peer backfill.
  if (deps.enqueuePeerBackfill) {
    const parked = await deps.enqueuePeerBackfill(communityId);
    if (parked > 0) {
      // A request was really parked; it applies later on grant drain, so applied
      // is 0 NOW and lastPulledAt stays null (no completed pull yet). Honest.
      return { applied: 0, lastPulledAt: null, source: 'peer' };
    }
  }

  return { applied: 0, lastPulledAt: null, source: 'no host reachable' };
}

// ---------------------------------------------------------------------------
// Plan 57 W2/W3: community server (host) lifecycle + writers.
//
// The Realms pattern: ONLY the community owner ever touches a server decision,
// once, and everyone else just follows the descriptor the invite already
// carries. These helpers populate/clear descriptor.hosts as ONE signed
// revision each (the reviseCommunity chain the members already converge on),
// and drive the W1 writer clients against the attached node. Honesty:
//  - a host is attached ONLY after a real /healthz answer AND the node
//    accepting the owner's publish of this exact revision (fail-closed: a
//    refused publish commits nothing locally);
//  - removal commits locally FIRST (firing a dead server must never be
//    blocked by that server) and the exit republish is best-effort;
//  - every result carries the real reason, never a fabricated success.
//
// VERBATIM TWIN of apps/meerkat/app/(root)/data/community-core.ts (native is
// canonical); keep them in lockstep.
// ---------------------------------------------------------------------------

/** A minimal in-memory SnapshotPieceStore for build-then-publish runs. */
export class InMemorySnapshotPieceStore implements SnapshotPieceStore {
  private readonly pieces = new Map<string, Uint8Array>();
  put(infoHash: string, index: number, bytes: Uint8Array): void {
    this.pieces.set(`${infoHash}:${index}`, bytes);
  }
  get(infoHash: string, index: number): Uint8Array | null {
    return this.pieces.get(`${infoHash}:${index}`) ?? null;
  }
  removeContent(infoHash: string): void {
    for (const key of [...this.pieces.keys()]) {
      if (key.startsWith(`${infoHash}:`)) this.pieces.delete(key);
    }
  }
}

/** The community's attached server base url (first http(s) descriptor host), or null. */
export function getCommunityHostUrl(db: DatabaseAdapter, communityId: string): string | null {
  return communityNodeUrl(db, communityId);
}

/** Normalize an owner-entered host url; null when it is not a plain http(s) base. */
export function normalizeCommunityHostUrl(raw: string): string | null {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!/^https?:\/\/[^\s]+$/i.test(trimmed)) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.username || parsed.password || parsed.search || parsed.hash) return null;
    return trimmed;
  } catch {
    return null;
  }
}

/** Real GET /healthz probe. True ONLY on a 2xx `{ok:true}` answer. */
export async function probeCommunityHost(
  url: string,
  fetchFn: typeof fetch = fetch,
): Promise<boolean> {
  try {
    const res = await fetchFn(`${url.replace(/\/+$/, '')}/healthz`);
    if (!res.ok) return false;
    const body = (await res.json()) as { ok?: unknown };
    return body?.ok === true;
  } catch {
    return false;
  }
}

export type CommunityHostingProbe = 'hosted' | 'server_only' | 'unreachable';

/**
 * Honest hosting probe: /healthz only proves SOME process answers, so the
 * "always available" claim requires the node to confirm it actually hosts THIS
 * community. The join/park route is the one unauthenticated surface that
 * distinguishes it fail-closed: a syntactically valid park to a random token
 * yields `unknown_community` (404) when the node does NOT hold the descriptor,
 * and `token_not_recognized`/`box_full` (the roster gate) when it does --
 * without consuming a challenge or parking anything. 'server_only' = the
 * process answers but does not confirm hosting this community (including an
 * entitlement-gated node we hold no bearer for); copy must never upgrade it.
 */
export async function probeCommunityHosting(
  url: string,
  communityId: string,
  deps: CommunityHostDeps = {},
): Promise<CommunityHostingProbe> {
  const fetchFn = deps.fetchFn ?? fetch;
  const base = url.replace(/\/+$/, '');
  try {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (deps.entitlementToken) headers.authorization = `Bearer ${deps.entitlementToken}`;
    const res = await fetchFn(`${base}/community/${encodeURIComponent(communityId)}/join/park`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ token: 'f'.repeat(64), envelope: 'aGk=' }),
    });
    const body = (await res.json().catch(() => null)) as { reason?: unknown } | null;
    if (body?.reason === 'token_not_recognized' || body?.reason === 'box_full') return 'hosted';
  } catch {
    // fall through to the health check below
  }
  return (await probeCommunityHost(base, fetchFn)) ? 'server_only' : 'unreachable';
}

export interface CommunityHostDeps {
  fetchFn?: typeof fetch;
  /** Optional hosted-entitlement bearer for entitlement-gated first-party nodes. */
  entitlementToken?: string;
  now?: string;
}

export type SetCommunityHostResult =
  | { ok: true; hostUrl: string; channels: number }
  | { ok: false; error: string; reason: 'not_found' | 'not_owner' | 'bad_url' | 'unreachable' | 'publish_failed'; detail?: string };

/**
 * Attach a community server (owner-only): probe it, sign ONE hosts revision,
 * build fresh rolling snapshots, and publish descriptor + snapshots to the
 * node. The revision is committed locally ONLY after the node accepted it, so
 * a refused/unreachable server never leaves the descriptor claiming a host it
 * does not have. Members receive the revised descriptor (and with it the host)
 * over normal descriptor convergence and invites.
 */
export async function setCommunityHost(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  communityId: string,
  rawUrl: string,
  deps: CommunityHostDeps = {},
): Promise<SetCommunityHostResult> {
  const now = deps.now ?? new Date().toISOString();
  const stored = getCommunity(db, communityId);
  if (!stored) {
    return { ok: false, error: 'Community not found on this device.', reason: 'not_found' };
  }
  if (stored.descriptor.ownerDeviceId !== identity.publicKey) {
    return { ok: false, error: 'Only the community owner can attach a server.', reason: 'not_owner' };
  }
  const hostUrl = normalizeCommunityHostUrl(rawUrl);
  if (!hostUrl) {
    return { ok: false, error: 'Enter a plain http(s) server address.', reason: 'bad_url' };
  }
  const reachable = await probeCommunityHost(hostUrl, deps.fetchFn);
  if (!reachable) {
    return {
      ok: false,
      error: 'The server did not answer its health check. Nothing was attached.',
      reason: 'unreachable',
    };
  }

  // Compaction safety (re-attach case): if this node already holds state for
  // the community, pull + merge its feed FIRST so the fresh build below covers
  // every event the node has -- a publish compacts the published channels'
  // tails, and an unmerged member event must never be compacted away.
  // Best-effort: a node with no prior state simply fails the pull.
  await pullHostFeedAndMerge(db, identity, communityId, hostUrl, {
    fetchFn: deps.fetchFn, entitlementToken: deps.entitlementToken, now,
  }).catch(() => undefined);

  const revised = reviseCommunity(
    identity,
    { descriptor: stored.descriptor, signature: stored.signature },
    { hosts: [hostUrl] },
    now,
  );

  // Fresh full build into an in-memory store so the publish carries every
  // channel's complete rolling snapshot (previous: [] forces full rebuilds).
  const pieceStore = new InMemorySnapshotPieceStore();
  const built = await buildCommunitySnapshots({
    db,
    identity,
    communityId,
    channels: ownedSnapshotChannels(db, communityId),
    pieceStore,
    now,
  });

  const published = await publishCommunityFeed({
    baseUrl: hostUrl,
    identity,
    descriptor: revised,
    records: built.records,
    pieceStore,
    fetchFn: deps.fetchFn,
    entitlementToken: deps.entitlementToken,
    now,
  });
  if (!published.ok) {
    return {
      ok: false,
      error: 'The server refused the community publish. Nothing was attached.',
      reason: 'publish_failed',
      detail: published.reason,
    };
  }

  // The node accepted this exact revision: commit it locally + persist the
  // snapshot records so later incremental jobs have a real baseline.
  upsertCommunity(db, revised, identity.publicKey);
  for (const record of built.records) putSnapshotRecord(db, record);
  return { ok: true, hostUrl, channels: published.channels };
}

export type ClearCommunityHostResult =
  | { ok: true; removedHostUrl: string | null; exitRepublished: boolean }
  | { ok: false; error: string; reason: 'not_found' | 'not_owner' | 'no_host' };

/**
 * Detach the community server (owner-only; the "community exit"): sign ONE
 * hosts:[] revision and commit it locally FIRST, then best-effort republish
 * the host-less descriptor to the old node so its roster records the exit. A
 * dead or hostile node can never block its own firing; the fired node keeps
 * only ciphertext it cannot read.
 */
export async function clearCommunityHost(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  communityId: string,
  deps: CommunityHostDeps = {},
): Promise<ClearCommunityHostResult> {
  const now = deps.now ?? new Date().toISOString();
  const stored = getCommunity(db, communityId);
  if (!stored) {
    return { ok: false, error: 'Community not found on this device.', reason: 'not_found' };
  }
  if (stored.descriptor.ownerDeviceId !== identity.publicKey) {
    return { ok: false, error: 'Only the community owner can remove the server.', reason: 'not_owner' };
  }
  const removedHostUrl = communityNodeUrl(db, communityId);
  if (!removedHostUrl && stored.descriptor.hosts.length === 0) {
    return { ok: false, error: 'This community has no server attached.', reason: 'no_host' };
  }

  const revised = reviseCommunity(
    identity,
    { descriptor: stored.descriptor, signature: stored.signature },
    { hosts: [] },
    now,
  );
  upsertCommunity(db, revised, identity.publicKey);

  let exitRepublished = false;
  if (removedHostUrl) {
    const republished = await republishCommunityDescriptor({
      baseUrl: removedHostUrl,
      identity,
      descriptor: revised,
      fetchFn: deps.fetchFn,
      entitlementToken: deps.entitlementToken,
      now,
    });
    exitRepublished = republished.ok;
  }
  return { ok: true, removedHostUrl, exitRepublished };
}

export type AppendToCommunityHostResult =
  | { ok: true; hostUrl: string }
  | { ok: false; reason: 'no_host' | 'no_epoch_key' | string };

/**
 * Best-effort append of ONE locally recorded event to the community's attached
 * server so it lands in the live tail members pull while this device sleeps.
 * Never blocks or fakes the send path: the event is already recorded locally
 * and replicates over normal sessions regardless; this only mirrors it to the
 * always-on host. The caller decides what (if anything) to surface on failure.
 */
export async function appendEventToCommunityHost(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  event: ChannelMessageEvent,
  deps: CommunityHostDeps = {},
): Promise<AppendToCommunityHostResult> {
  const hostUrl = communityNodeUrl(db, event.communityId);
  if (!hostUrl) return { ok: false, reason: 'no_host' };
  const epochKey = getCurrentEpochKey(db, event.communityId, identity);
  if (!epochKey) return { ok: false, reason: 'no_epoch_key' };
  const appended = await appendCommunityTail({
    baseUrl: hostUrl,
    communityId: event.communityId,
    identity,
    event,
    getEpochKey: () => epochKey,
    fetchFn: deps.fetchFn,
    entitlementToken: deps.entitlementToken,
    now: deps.now,
  });
  if (!appended.ok) return { ok: false, reason: appended.reason };
  return { ok: true, hostUrl };
}

/**
 * Owner-side incremental snapshot publish: rebuild channels whose tail grew
 * past the threshold (runCommunitySnapshotJob semantics via cm_snapshots
 * baselines) and publish the refreshed records to the attached server. A
 * community with no host is a cheap no-op. Returns real counts only.
 */
export async function publishCommunitySnapshotsToHost(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  communityId: string,
  deps: CommunityHostDeps = {},
): Promise<
  | { ok: true; hostUrl: string; channels: number }
  | { ok: false; reason: 'no_host' | 'not_owner' | string }
> {
  const hostUrl = communityNodeUrl(db, communityId);
  if (!hostUrl) return { ok: false, reason: 'no_host' };
  const stored = getCommunity(db, communityId);
  if (!stored) return { ok: false, reason: 'no_host' };
  if (stored.descriptor.ownerDeviceId !== identity.publicKey) {
    return { ok: false, reason: 'not_owner' };
  }
  const now = deps.now ?? new Date().toISOString();
  // Compaction safety: the node's publish compacts each published channel's
  // live tail, so pull + merge the host feed FIRST -- a member event the owner
  // has not seen yet lands in cm_messages and therefore in the fresh build,
  // instead of being compacted away by this very publish. Best-effort: if the
  // pull fails the publish will usually fail on the same broken transport.
  await pullHostFeedAndMerge(db, identity, communityId, hostUrl, {
    fetchFn: deps.fetchFn, entitlementToken: deps.entitlementToken, now,
  }).catch(() => undefined);
  const pieceStore = new InMemorySnapshotPieceStore();
  const built = await buildCommunitySnapshots({
    db,
    identity,
    communityId,
    channels: ownedSnapshotChannels(db, communityId),
    pieceStore,
    now,
  });
  const published = await publishCommunityFeed({
    baseUrl: hostUrl,
    identity,
    descriptor: { descriptor: stored.descriptor, signature: stored.signature },
    records: built.records,
    pieceStore,
    fetchFn: deps.fetchFn,
    entitlementToken: deps.entitlementToken,
    now,
  });
  if (!published.ok) return { ok: false, reason: published.reason };
  for (const record of built.records) putSnapshotRecord(db, record);
  return { ok: true, hostUrl, channels: published.channels };
}

const HOST_PUBLISH_ATTEMPT_PREFIX = 'meerkat_host_publish_attempt_v1:';
const DEFAULT_HOST_PUBLISH_MS = 5 * 60 * 1_000;

/**
 * Throttled owner-side snapshot publish (the foreground job seam): a cheap
 * no-op without a host or ownership, at most one real publish attempt per
 * community per interval (attempt-throttled like the history sync, so a dead
 * host is not hammered). Callers fire-and-forget it after sends and on
 * community open.
 */
export async function maybePublishCommunitySnapshotsToHost(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  communityId: string,
  deps: CommunityHostDeps & { minimumIntervalMs?: number; force?: boolean } = {},
): Promise<
  | { ok: true; hostUrl: string; channels: number }
  | { ok: false; reason: 'no_host' | 'not_owner' | 'throttled' | string }
> {
  const hostUrl = communityNodeUrl(db, communityId);
  if (!hostUrl) return { ok: false, reason: 'no_host' };
  const stored = getCommunity(db, communityId);
  if (!stored || stored.descriptor.ownerDeviceId !== identity.publicKey) {
    return { ok: false, reason: 'not_owner' };
  }
  const now = deps.now ?? new Date().toISOString();
  const intervalMs = deps.minimumIntervalMs ?? DEFAULT_HOST_PUBLISH_MS;
  const key = `${HOST_PUBLISH_ATTEMPT_PREFIX}${communityId}`;
  const lastAttempt = getSetting(db, key);
  if (!deps.force && lastAttempt) {
    const elapsed = Date.parse(now) - Date.parse(lastAttempt);
    if (Number.isFinite(elapsed) && elapsed < intervalMs) {
      return { ok: false, reason: 'throttled' };
    }
  }
  setSetting(db, key, now);
  return publishCommunitySnapshotsToHost(db, identity, communityId, deps);
}

/**
 * Fire-and-forget mirror of ONE locally recorded event to the community's
 * attached server: append it to the live tail and (owner-only, throttled)
 * refresh the rolling snapshots. Never throws, never blocks the send path,
 * and a community with no host is a cheap no-op. The local record + normal
 * session replication are the source of truth regardless.
 */
export function mirrorEventToCommunityHost(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  event: ChannelMessageEvent,
  deps: CommunityHostDeps = {},
): void {
  void appendEventToCommunityHost(db, identity, event, deps).catch(() => undefined);
  void maybePublishCommunitySnapshotsToHost(db, identity, event.communityId, deps).catch(() => undefined);
}

const HOST_PULL_ATTEMPT_PREFIX = 'meerkat_host_pull_attempt_v1:';

export type MaybeRefreshFromHostResult =
  | { ran: false; reason: 'no_host' | 'throttled' }
  | { ran: true; result: RefreshCommunityFeedResult };

/**
 * Throttled member-side pull from the community's attached server (the screen-
 * mount seam): a cheap no-op without a host, at most one real pull attempt per
 * community per interval. Wraps refreshCommunityFeed, so applied counts and
 * sources stay the honest engine values; a throttle is reported as ran:false,
 * never disguised as a pull.
 */
export async function maybeRefreshCommunityFeedFromHost(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  communityId: string,
  deps: RefreshCommunityFeedDeps & { minimumIntervalMs?: number; force?: boolean } = {},
): Promise<MaybeRefreshFromHostResult> {
  if (!communityNodeUrl(db, communityId)) return { ran: false, reason: 'no_host' };
  const now = deps.now ?? new Date().toISOString();
  const intervalMs = deps.minimumIntervalMs ?? DEFAULT_HOST_PUBLISH_MS;
  const key = `${HOST_PULL_ATTEMPT_PREFIX}${communityId}`;
  const lastAttempt = getSetting(db, key);
  if (!deps.force && lastAttempt) {
    const elapsed = Date.parse(now) - Date.parse(lastAttempt);
    if (Number.isFinite(elapsed) && elapsed < intervalMs) {
      return { ran: false, reason: 'throttled' };
    }
  }
  setSetting(db, key, now);
  const result = await refreshCommunityFeed(db, identity, communityId, deps);
  return { ran: true, result };
}

/**
 * Plan 57 W4: park a sealed join request on the community's OWN server, read
 * straight from the invite's signed descriptor (`hosts` rides inside every
 * invite). Durable for days and restart-safe on the node side, so the owner
 * can be asleep when the request lands. Returns true ONLY on the node's real
 * accept; false covers both "no host in the invite" and a refused park.
 */
export async function parkJoinRequestOnInviteHost(
  signedDescriptor: SignedCommunityDescriptor,
  token: string,
  envelope: MailboxEnvelope,
  deps: CommunityHostDeps = {},
): Promise<boolean> {
  const host = signedDescriptor.descriptor.hosts.find((h) => /^https?:\/\//i.test(h));
  if (!host) return false;
  if (!transportPolicyAllows(communityTransportPolicy(signedDescriptor.descriptor), 'wan_relay')) return false;
  const result = await parkJoinEnvelopeOnNode({
    baseUrl: host.replace(/\/+$/, ''),
    communityId: signedDescriptor.descriptor.communityId,
    token,
    envelope,
    fetchFn: deps.fetchFn,
    entitlementToken: deps.entitlementToken,
  });
  return result.ok;
}

export interface DrainJoinBoxesResult {
  communities: number;
  fetched: number;
  applied: number;
  rejected: number;
}

/**
 * Plan 57 W4: drain this device's durable join boxes from every attached
 * community server. The OWNER drains its request box (serving joins minted
 * while it slept); a PENDING joiner (holding the descriptor but not yet in the
 * roster) drains the grant box addressed back to it. Listed non-owner members
 * drain nothing here. Envelopes route through the SAME kind-dispatched handler
 * set as the relay drain (caller-composed, so the paths cannot drift), and a
 * community whose signed policy forbids WAN transports is skipped fail-closed.
 */
export async function drainCommunityJoinBoxesFromHosts(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  buildHandlers: (communityId: string, hostUrl: string) => MailboxEnvelopeHandlers,
  deps: CommunityHostDeps = {},
): Promise<DrainJoinBoxesResult> {
  const totals: DrainJoinBoxesResult = { communities: 0, fetched: 0, applied: 0, rejected: 0 };
  for (const community of listCommunities(db)) {
    const d = community.descriptor;
    const hostUrl = communityNodeUrl(db, d.communityId);
    if (!hostUrl) continue;
    if (!transportPolicyAllows(communityTransportPolicy(d), 'wan_relay')) continue;
    const role = communityRole(d, identity.publicKey);
    if (role !== 'owner' && role !== null) continue;
    totals.communities += 1;
    const drained = await drainJoinBoxFromNode({
      baseUrl: hostUrl,
      communityId: d.communityId,
      token: deriveCommunityJoinToken(d.genesisNonce, d.communityId, identity.publicKey),
      identity,
      handlers: buildHandlers(d.communityId, hostUrl),
      // A rejection here can be TRANSIENT (a grant park that failed over the
      // network): keep the durable request parked for the next drain instead of
      // deleting it with no grant delivered. TTL sweeps real poison.
      ackRejected: false,
      fetchFn: deps.fetchFn,
      entitlementToken: deps.entitlementToken,
    });
    totals.fetched += drained.fetched;
    totals.applied += drained.applied;
    totals.rejected += drained.rejected;

    // An owner that served joins revised its LOCAL descriptor; the node still
    // authenticates against its stored roster. Republish the current signed
    // descriptor so the fresh joiner's very next pull is not_member no more.
    if (role === 'owner' && drained.applied > 0) {
      const current = getCommunity(db, d.communityId);
      if (current) {
        await republishCommunityDescriptor({
          baseUrl: hostUrl,
          identity,
          descriptor: { descriptor: current.descriptor, signature: current.signature },
          fetchFn: deps.fetchFn,
          entitlementToken: deps.entitlementToken,
        }).catch(() => undefined);
      }
    }
  }
  return totals;
}

const HISTORY_HOST_CACHE_PREFIX = 'meerkat_history_host_cache_v1:';
const HISTORY_SYNC_ATTEMPT_PREFIX = 'meerkat_history_sync_attempt_v1:';
const DEFAULT_HISTORY_REFRESH_MS = 5 * 60 * 1_000;

export type AutomaticCommunityHistoryResult =
  | { outcome: 'imported'; applied: number; hostUrl: string; fromCache: boolean }
  | { outcome: 'manual_fallback'; applied: 0; reason: 'no_host_announced' | 'no_valid_host' | 'all_hosts_failed' | 'resolve_failed' }
  | { outcome: 'throttled'; applied: 0; retryAt: string };

export interface AutomaticCommunityHistoryDeps {
  relayUrl: string;
  entitlementToken?: string;
  fetchFn?: typeof fetch;
  now?: Date;
  minimumRefreshMs?: number;
  force?: boolean;
  /** Testable seams; production omits these and uses the sealed relay registry plus verified pull. */
  resolveHosts?: HistoryHostResolver;
  pullHost?: HistoryHostPuller;
  recordLocalChange?: (table: string, operation: 'INSERT', rowId: string, data: Record<string, unknown>) => void;
}

function readHistoryHostCache(db: DatabaseAdapter, communityId: string): HistoryHostRecord | null {
  const raw = getSetting(db, `${HISTORY_HOST_CACHE_PREFIX}${communityId}`);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<HistoryHostRecord>;
    return typeof value.hostUrl === 'string' && typeof value.communityId === 'string'
      && typeof value.expiresAt === 'string' && typeof value.descriptorRevision === 'number'
      && typeof value.snapshotVersion === 'number' && typeof value.maxObjectBytes === 'number'
      ? value as HistoryHostRecord : null;
  } catch {
    return null;
  }
}

/** Automatic sealed-registry discovery, full verification, and atomic history commit. */
export async function syncAutomaticCommunityHistory(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  communityId: string,
  deps: AutomaticCommunityHistoryDeps,
): Promise<AutomaticCommunityHistoryResult> {
  const community = getCommunity(db, communityId);
  if (!community) return { outcome: 'manual_fallback', applied: 0, reason: 'no_valid_host' };
  const now = deps.now ?? new Date();
  const nowIso = now.toISOString();
  const minimumRefreshMs = Math.max(30_000, deps.minimumRefreshMs ?? DEFAULT_HISTORY_REFRESH_MS);
  const lastAttemptKey = `${HISTORY_SYNC_ATTEMPT_PREFIX}${communityId}`;
  const lastAttempt = Date.parse(getSetting(db, lastAttemptKey) ?? '');
  if (!deps.force && Number.isFinite(lastAttempt) && now.getTime() - lastAttempt < minimumRefreshMs) {
    return { outcome: 'throttled', applied: 0, retryAt: new Date(lastAttempt + minimumRefreshMs).toISOString() };
  }
  setSetting(db, lastAttemptKey, nowIso);

  const relayUrl = deps.relayUrl.trim();
  if (!relayUrl.startsWith('ws')) return { outcome: 'manual_fallback', applied: 0, reason: 'resolve_failed' };
  const epochKey = getCurrentEpochKey(db, communityId, identity);
  if (!epochKey) return { outcome: 'manual_fallback', applied: 0, reason: 'all_hosts_failed' };
  const existingEventsByChannel: Record<string, ChannelMessageEvent[]> = {};
  const cursorByChannel: Record<string, Hlc | null> = {};
  for (const channel of community.descriptor.channels) {
    existingEventsByChannel[channel.id] = listChannelMessageEvents(db, communityId, channel.id);
    cursorByChannel[channel.id] = getFeedCursor(db, communityId, channel.id);
  }
  let applied = 0;
  const replicated: ChannelMessageEvent[] = [];
  const result = await runAutomaticHistorySync({
    communitySecret: community.descriptor.genesisNonce,
    descriptor: { descriptor: community.descriptor, signature: community.signature },
    resolveHosts: deps.resolveHosts ?? (() => lookupHosts({
      url: relayUrl,
      rid: deriveCommunityHistoryRegistryId(community.descriptor.genesisNonce),
      entitlementToken: deps.entitlementToken,
    })),
    pullHost: deps.pullHost ?? (async ({ hostUrl }) => pullCommunityFeed({
      baseUrl: hostUrl,
      communityId,
      identity,
      fetchFn: deps.fetchFn,
      getEpochKey: () => epochKey,
      existingEventsByChannel,
      cursorByChannel,
      now: nowIso,
    })),
    commit: ({ channels }) => {
      let committedApplied = 0;
      const committedEvents: ChannelMessageEvent[] = [];
      db.transaction(() => {
        for (const channel of channels) {
          const merge = mergeChannelMessageEvents(db, channel.newEvents);
          committedApplied += merge.inserted;
          committedEvents.push(...merge.insertedEvents);
          const highest = channel.events.at(-1)?.hlc ?? null;
          const cursor = cursorByChannel[channel.channelId] ?? null;
          if (highest && (!cursor || compareHlc(highest, cursor) > 0)) {
            setFeedCursor(db, communityId, channel.channelId, highest, nowIso);
          }
        }
        setLastPulledAt(db, communityId, nowIso);
      });
      applied += committedApplied;
      replicated.push(...committedEvents);
    },
    readCachedHost: () => readHistoryHostCache(db, communityId),
    cacheHost: (record) => setSetting(db, `${HISTORY_HOST_CACHE_PREFIX}${communityId}`, record ? JSON.stringify(record) : ''),
    now: nowIso,
  });
  if (result.outcome === 'manual_fallback') return { outcome: result.outcome, applied: 0, reason: result.reason };
  for (const event of replicated) {
    deps.recordLocalChange?.(CM_MESSAGES_TABLE, 'INSERT', event.id, { ...channelMessageRowFromEvent(event) });
    for (const attachment of channelMessageAttachmentRowsFromEvent(event)) {
      deps.recordLocalChange?.(CM_MESSAGE_ATTACHMENTS_TABLE, 'INSERT', attachment.id, { ...attachment });
    }
  }
  return { outcome: 'imported', applied, hostUrl: result.hostUrl, fromCache: result.fromCache };
}

/**
 * Notify-drain for a refresh trigger (community feed P4). Given ping bytes drained
 * off this community's notify token, ENQUEUE a pull per valid ping. The ping
 * delivers NOTHING; a user-visible "message received" notification is the
 * CALLER's job and only fires when the SUBSEQUENT pull's applied > 0 (use
 * shouldEmitMessageNotification, re-exported here). The expo notification wiring
 * is DEFERRED behind a dev flag exactly like background-task-registration.ts.
 */
export async function drainCommunityNotifyForRefresh(input: {
  communitySecret: string;
  pings: readonly Uint8Array[];
  enqueuePull: (communityId: string) => void | Promise<void>;
}): Promise<DrainCommunityNotifyResult> {
  return drainCommunityNotifyPings(input);
}

export { shouldEmitMessageNotification };

// ---------------------------------------------------------------------------
// Plan 19 FF3 (app half): public-join owner review queue.
//
// A request-policy public community's join grant is BROADCAST (unlike an
// individually issued invite), so the mailbox dispatcher's publicJoinRequest
// handler NEVER auto-approves. It only RECORDS a verified request here; the
// owner later makes an explicit approve/decline decision (SyncProvider /
// MeerkatProvider approvePublicJoinRequestById / declinePublicJoinRequestById),
// which calls the @mylife/sync approvePublicJoinRequest engine function. This
// file writes NO key and adds NO member -- it is purely the local decision
// queue. cm_public_join_requests is LOCAL-ONLY (COMMUNITY_SYNC_POLICY caps it
// device_local); it never replicates.
// ---------------------------------------------------------------------------

export type PublicJoinRequestStatus = 'pending' | 'approved' | 'declined';

export interface PublicJoinRequestRow {
  publication_id: string;
  community_id: string;
  sender_device_id: string;
  grant_id: string;
  bundle_json: string;
  /** The joiner's opaque humanity token (AM1), persisted so the owner-side approve
   *  reconstructs the byte-exact PublicJoinRequestPayload the engine requires. */
  humanity_token: string;
  created_at: string;
  status: PublicJoinRequestStatus;
}

export interface RecordPublicJoinRequestInput {
  publicationId: string;
  communityId: string;
  senderDeviceId: string;
  grantId: string;
  bundleJson: string;
  humanityToken: string;
  createdAt: string;
}

/**
 * Record a verified request-policy public-join request into the owner's local
 * review queue. INSERT OR IGNORE: a re-sent request (same publication + sender,
 * e.g. re-parked after a dropped mailbox TTL) is idempotent and never resets an
 * already-decided ('approved' | 'declined') row back to 'pending'.
 */
export function recordPublicJoinRequest(db: DatabaseAdapter, input: RecordPublicJoinRequestInput): void {
  db.execute(
    `INSERT OR IGNORE INTO cm_public_join_requests
       (publication_id, community_id, sender_device_id, grant_id, bundle_json, humanity_token, created_at, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      input.publicationId,
      input.communityId,
      input.senderDeviceId,
      input.grantId,
      input.bundleJson,
      input.humanityToken,
      input.createdAt,
    ],
  );
}

/** All PENDING requests for one community, oldest first (the owner's review order). */
export function listPendingPublicJoinRequests(
  db: DatabaseAdapter,
  communityId: string,
): PublicJoinRequestRow[] {
  return db.query<PublicJoinRequestRow>(
    `SELECT * FROM cm_public_join_requests
     WHERE community_id = ? AND status = 'pending'
     ORDER BY created_at ASC`,
    [communityId],
  );
}

/** One queued request, keyed by its (publication, sender) primary key. */
export function getPublicJoinRequest(
  db: DatabaseAdapter,
  publicationId: string,
  senderDeviceId: string,
): PublicJoinRequestRow | null {
  const rows = db.query<PublicJoinRequestRow>(
    `SELECT * FROM cm_public_join_requests WHERE publication_id = ? AND sender_device_id = ?`,
    [publicationId, senderDeviceId],
  );
  return rows[0] ?? null;
}

/**
 * Move a queued request to 'approved' or 'declined' (or back to 'pending' for a
 * retry after a not_parked failure). Row-only; carries no engine side effect.
 */
export function setPublicJoinRequestStatus(
  db: DatabaseAdapter,
  publicationId: string,
  senderDeviceId: string,
  status: PublicJoinRequestStatus,
): void {
  db.execute(
    `UPDATE cm_public_join_requests SET status = ? WHERE publication_id = ? AND sender_device_id = ?`,
    [status, publicationId, senderDeviceId],
  );
}

export interface RecordPublicJoinRequestsDeps {
  db: DatabaseAdapter;
  /** This device's identity (checked for community ownership below). */
  owner: DeviceIdentity;
  /**
   * The AUTHORITATIVE single-use gate (AM1/AM2 / dev-relay reconciled contract):
   * an owner-side redeem client that POSTs the token to the verification service,
   * which runs the atomic network-wide double-spend. Absent (no service) => drop
   * fail-closed, no row. A replayed token comes back `already_spent`.
   */
  redeem?: HumanityRedeemClient;
  /** Pinned service Ed25519 pubkey (hex) for a cheap local pre-check before redeem. */
  servicePublicKeyHex?: string;
}

/**
 * SERVE side (owner): build the mailbox dispatcher's publicJoinRequest handler.
 * The dispatcher already decrypted + verified the envelope (openPublicJoinRequest)
 * before calling this; this handler ONLY records the request into the review
 * queue -- it writes no key and adds no member.
 *
 * Fail-closed: drops (returns false, records nothing) unless THIS device
 * actually owns the request's target community right now (communityRole against
 * this device's OWN current stored descriptor, never a request-supplied one), so
 * a request naming a community this device does not own can never pollute the
 * queue. Returns true iff a real queue row was written.
 */
export function recordPublicJoinRequests(
  deps: RecordPublicJoinRequestsDeps,
): Pick<MailboxEnvelopeHandlers, 'publicJoinRequest'> {
  const { db, owner, redeem, servicePublicKeyHex } = deps;
  return {
    publicJoinRequest: async (
      senderDeviceId: string,
      payload: PublicJoinRequestPayload,
      createdAt: string,
    ): Promise<boolean> => {
      const stored = getCommunity(db, payload.communityId);
      if (!stored) return false;
      if (communityRole(stored.descriptor, owner.publicKey) !== 'owner') return false;

      // Owner-record humanity gate (AM1/AM2 / dev-relay reconciled): the
      // AUTHORITATIVE single-use check is the service redeem. No redeem client
      // (no service configured) => drop fail-closed. An optional local pre-check
      // rejects an obviously forged/expired token before the round-trip.
      if (!redeem) return false;
      if (servicePublicKeyHex) {
        const token = parseHumanityToken(payload.humanityToken);
        if (!token || verifyHumanityToken(token, servicePublicKeyHex, Date.now()) !== 'ok') {
          return false;
        }
      }
      const spent = await redeem(payload.humanityToken);
      if (!spent.ok) return false;

      recordPublicJoinRequest(db, {
        publicationId: payload.publicationId,
        communityId: payload.communityId,
        senderDeviceId,
        grantId: payload.grantId,
        bundleJson: JSON.stringify(payload.bundle),
        // AM1: persist the joiner's humanity token so the owner-side approve
        // rebuilds the byte-exact payload the engine now requires.
        humanityToken: payload.humanityToken,
        createdAt,
      });
      return true;
    },
  };
}
