import type { DatabaseAdapter } from '@mylife/db';
import {
  addWorkspaceMember,
  buildCommunitySnapshots,
  communityRole,
  ensurePresenceBeaconTable,
  PRESENCE_BEACON_SYNC_RULE,
  communityTransportPolicy,
  communityIdentityEventFromRow,
  communityIdentityEventToRow,
  communityLayoutEventFromRow,
  communityLayoutEventToRow,
  createCommunityLayoutEvent,
  resolveCommunityLayout as resolveCommunityLayoutEvents,
  compareCommunityProfileEvents,
  compareChannelMessages,
  createChannelMessageV2,
  createCommunityIdentityEvent,
  createGroupCommit,
  createWorkspace,
  destroyEntityKey,
  drainCommunityNotifyPings,
  getCommunity,
  listCommunities,
  parseHumanityToken,
  verifyHumanityToken,
  getCurrentEpochKey,
  getPairedDevices,
  getWorkspaceEpoch,
  unwrapEpochSecret,
  deriveCommunityHistoryRegistryId,
  importSnapshotFromPieces,
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
  lookupHosts,
  runAutomaticHistorySync,
  resolveChannelMessages,
  resolveCommunityIdentity,
  shouldEmitMessageNotification,
  sha512Hex,
  upsertCommunity,
  verifyCommunityProfileEvent,
  verifyChannelMessage,
  type BuildCommunitySnapshotsResult,
  type ChannelMessageAttachment,
  type ChannelMessageEvent,
  type ChannelMessageIntent,
  type CommunityIdentityBanner,
  type CommunityIdentityEvent,
  type CommunityLayoutEvent,
  type CommunityProfileEvent,
  type CommunityTransportPolicy,
  type CommunitySnapshotRecord,
  type DeviceIdentity,
  type DrainCommunityNotifyResult,
  type GroupMemberKey,
  type HistoryHostRecord,
  type HistoryHostPuller,
  type HistoryHostResolver,
  type Hlc,
  type HumanityRedeemClient,
  type MailboxEnvelope,
  type MailboxEnvelopeHandlers,
  type MessageAuthorKind,
  type NativeSyncEngineOptions,
  type PublicJoinRequestPayload,
  type RecordKeyWrapChange,
  type SignedCommunityDescriptor,
  type SnapshotChannelInput,
  type SnapshotPieceStore,
} from '@mylife/sync';
import { getSetting, setLastPulledAt, setSetting } from './db';
import {
  createCommunitySafetyIndex,
  type CommunitySafetyIndex,
} from './community-safety';

type ModuleSyncPolicy = NonNullable<NativeSyncEngineOptions['modulePolicies']> extends Map<string, infer Policy>
  ? Policy
  : never;

export const COMMUNITY_MODULE_ID = 'community';
export const COMMUNITY_PREFIX = 'cm_';
export const CM_MESSAGES_TABLE = 'cm_messages';
export const CM_MESSAGE_ATTACHMENTS_TABLE = 'cm_message_attachments';
export const CM_READ_STATE_TABLE = 'cm_read_state';
export const CM_POSTS_TABLE = 'cm_posts';
export const CM_PROFILES_TABLE = 'cm_profiles';
export const CM_SAFETY_ACTIONS_TABLE = 'cm_safety_actions';
// cm_file_requests is the honest local record that drives the request/approve/
// restore UI (Files Phase 3). It is LOCAL-ONLY by deliberate OMISSION from
// MEERKAT_SYNC_PREFIXES (cm_ maps to the community module, but only the tables
// listed in COMMUNITY_SYNC_POLICY.entityRules replicate). This table is NOT in
// that policy, so it NEVER crosses a session: it is a private state machine.
export const CM_FILE_REQUESTS_TABLE = 'cm_file_requests';
// Plan 19 FF3 (app half): the owner's LOCAL review queue for REQUEST-policy
// public-join requests the mailbox dispatcher recorded (never auto-approved --
// see recordPublicJoinRequests below). LOCAL-ONLY by deliberate OMISSION from
// COMMUNITY_SYNC_POLICY.entityRules default (and an EXPLICIT device_local rule,
// Wave-1 style): a public join grant is BROADCAST, so this queue is this
// device's private admission decision state and must never replicate.
export const CM_PUBLIC_JOIN_REQUESTS_TABLE = 'cm_public_join_requests';
// Plan 39 P10: the device's OWN public-tier follows (personas + Commons topics).
// DEVICE-LOCAL BY DESIGN: a follow is this device's private choice of what to show
// in its Following feed; it must NEVER replicate over a community session (an
// explicit device_local rule below, mirroring cm_public_feed_cursor). The host
// aggregates follower counts from a SEPARATE registration, never from this table,
// so this row leaks nothing and never fabricates a public count (NC-P6).
export const CM_PUBLIC_FOLLOWS_TABLE = 'cm_public_follows';
// Plan 38 Phase 0: the community data-hub (Plex-style libraries) tables. The
// owner-signed identity + library-config rows and the curator-signed item/
// collection/tag/rule rows all replicate at shared_workspace (explicit rules
// below). cm_library_progress is PERSONAL (personal_replica, cm_read_state
// precedent): your own paired devices resume, but it is NEVER community-visible.
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

export const COMMUNITY_SYNC_POLICY: ModuleSyncPolicy = {
  // Wave-1 audit fix: device_local default so a cm_ table OMITTED from entityRules
  // fails CLOSED (never replicates) instead of inheriting a shared_workspace default
  // and silently leaking. Every table that MUST sync has an explicit shared_workspace
  // (or personal_replica) rule below, so this flip changes no real table's behavior.
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
    {
      tableName: CM_MESSAGES_TABLE,
      defaultScope: 'shared_workspace',
      maxScope: 'shared_workspace',
      conflictStrategy: 'or_set',
    },
    {
      tableName: CM_MESSAGE_ATTACHMENTS_TABLE,
      defaultScope: 'shared_workspace',
      maxScope: 'shared_workspace',
      conflictStrategy: 'lww',
    },
    {
      tableName: 'cm_reactions',
      defaultScope: 'shared_workspace',
      maxScope: 'shared_workspace',
      conflictStrategy: 'or_set',
    },
    {
      tableName: CM_PROFILES_TABLE,
      defaultScope: 'shared_workspace',
      maxScope: 'shared_workspace',
      conflictStrategy: 'or_set',
    },
    {
      tableName: 'cm_posts',
      defaultScope: 'shared_workspace',
      maxScope: 'shared_workspace',
      conflictStrategy: 'lww',
    },
    {
      tableName: 'cm_post_tags',
      defaultScope: 'shared_workspace',
      maxScope: 'shared_workspace',
      conflictStrategy: 'or_set',
    },
    {
      tableName: 'cm_post_lifecycle',
      defaultScope: 'shared_workspace',
      maxScope: 'shared_workspace',
      conflictStrategy: 'lww',
    },
    {
      tableName: CM_READ_STATE_TABLE,
      defaultScope: 'personal_replica',
      maxScope: 'personal_replica',
      conflictStrategy: 'lww',
    },
    // Plan 19 (Public Social Layer) P0: cm_publications is the ONLY community-family
    // entity that may reach published_blob. It MUST keep the cm_ prefix so the
    // ChangeTracker resolves it to the community module (a cp_ prefix resolves to
    // null and is rejected as unknown_table before the scope cap is ever consulted).
    // cm_messages stays shared_workspace.
    {
      tableName: 'cm_publications',
      defaultScope: 'shared_workspace',
      maxScope: 'published_blob',
      conflictStrategy: 'lww',
    },
    {
      tableName: 'cm_public_reports',
      defaultScope: 'shared_workspace',
      maxScope: 'shared_workspace',
      conflictStrategy: 'or_set',
    },
    {
      tableName: 'cm_public_directory_cache',
      defaultScope: 'device_local',
      maxScope: 'device_local',
      conflictStrategy: 'lww',
    },
    {
      tableName: 'cm_public_feed_cursor',
      defaultScope: 'device_local',
      maxScope: 'device_local',
      conflictStrategy: 'lww',
    },
    // Plan 39 P10: the device's own public-tier follows. LOCAL-ONLY (device_local
    // default AND max): a follow is a private viewing choice, never a shared or
    // published signal, so it can never escalate past this device.
    {
      tableName: CM_PUBLIC_FOLLOWS_TABLE,
      defaultScope: 'device_local',
      maxScope: 'device_local',
      conflictStrategy: 'lww',
    },
    // Plan 19 P8: LOCAL-ONLY owner-side moderation state. The published snapshot
    // pieces are kept so the owner can re-register an UNPUBLISHED revision (the
    // host requires the contentId among the supplied snapshots), and reviewed
    // host-intake report markers hide a report once the owner has acted. Both are
    // owner-local and must NEVER replicate (device_local).
    {
      tableName: 'cm_publication_snapshots',
      defaultScope: 'device_local',
      maxScope: 'device_local',
      conflictStrategy: 'lww',
    },
    {
      tableName: 'cm_public_report_reviews',
      defaultScope: 'device_local',
      maxScope: 'device_local',
      conflictStrategy: 'lww',
    },
    // Plan 19 P9 (Public/Forever Archive): durable-pin lifecycle + moderation mirror
    // + rights cache. NONE escalates to published_blob (cm_publications stays the
    // single escalation point, TC-9). cm_archive_jobs replicates across the OWNER's
    // own devices only (personal_replica); the other two are device_local. The
    // canonical rights ride INSIDE the signed PublicationDescriptor; cm_publication_rights
    // only mirrors them for query.
    {
      tableName: 'cm_archive_jobs',
      defaultScope: 'device_local',
      maxScope: 'personal_replica',
      conflictStrategy: 'lww',
    },
    {
      tableName: 'cm_archive_moderation',
      defaultScope: 'device_local',
      maxScope: 'device_local',
      conflictStrategy: 'lww',
    },
    {
      tableName: 'cm_publication_rights',
      defaultScope: 'device_local',
      maxScope: 'device_local',
      conflictStrategy: 'lww',
    },
    // Wave-1 audit fix (adversarial verify): these cm_ tables are LOCAL-ONLY by
    // design but were previously OMITTED from entityRules. Because the ChangeTracker
    // resolves a cm_ table to the community module and falls back to
    // policy.defaultScope, an omitted table inherited the OLD shared_workspace default
    // and silently REPLICATED (leaking the local file-request state machine, the
    // local feed/snapshot caches, the LOCAL-derived post bump/attention -- breaking
    // the bump-honesty invariant -- and the owner's private block/mute/report set, and
    // accepting forged inbound writes). Each is now pinned device_local AND the module
    // defaultScope below is device_local, so omission fails closed.
    {
      tableName: 'cm_file_requests',
      defaultScope: 'device_local',
      maxScope: 'device_local',
      conflictStrategy: 'lww',
    },
    {
      tableName: 'cm_feed_cursor',
      defaultScope: 'device_local',
      maxScope: 'device_local',
      conflictStrategy: 'lww',
    },
    {
      tableName: 'cm_snapshots',
      defaultScope: 'device_local',
      maxScope: 'device_local',
      conflictStrategy: 'lww',
    },
    {
      tableName: 'cm_post_activity',
      defaultScope: 'device_local',
      maxScope: 'device_local',
      conflictStrategy: 'lww',
    },
    {
      tableName: 'cm_safety_actions',
      defaultScope: 'device_local',
      maxScope: 'device_local',
      conflictStrategy: 'lww',
    },
    // Plan 19 FF3: the owner's local public-join review queue. NEVER escalates
    // (device_local default AND cap), so a re-recorded/approved/declined request
    // can never leak this device's admission decisions to a peer.
    {
      tableName: CM_PUBLIC_JOIN_REQUESTS_TABLE,
      defaultScope: 'device_local',
      maxScope: 'device_local',
      conflictStrategy: 'lww',
    },
    // Plan 27 P4: this device's LOCAL observed transport-policy ledger. A policy
    // change notice is private device state (the signed descriptor is the real
    // sync channel for the policy itself); this ledger must NEVER replicate.
    {
      tableName: 'cm_policy_history',
      defaultScope: 'device_local',
      maxScope: 'device_local',
      conflictStrategy: 'lww',
    },
    // Plan 38 Phase 0: community data-hub rows replicate at shared_workspace. The
    // identity + library-config rows are OWNER-signed and the item/collection/tag/
    // rule rows curator-signed; row-level policy + apply-time curator enforcement
    // key off the signed community_id/channel_id columns (Codex amendments 2-3).
    {
      tableName: 'cm_community_identity',
      defaultScope: 'shared_workspace',
      maxScope: 'shared_workspace',
      conflictStrategy: 'lww',
    },
    // Composition plan 2.2: the owner-signed layout document. Apply-time
    // verified (a member-forged re-composition dies before INSERT).
    {
      tableName: 'cm_layout',
      defaultScope: 'shared_workspace',
      maxScope: 'shared_workspace',
      conflictStrategy: 'lww',
    },
    // Plan 56 C1: the Canvas layer. Registry + nodes are per-object LWW (the
    // Excalidraw model, F5); strokes and marks are append-only or_set events.
    // All apply-time verified, role/layer-gated, cap/rate-checked in
    // @mylife/sync community-canvas validators.
    {
      tableName: 'cm_canvas',
      defaultScope: 'shared_workspace',
      maxScope: 'shared_workspace',
      conflictStrategy: 'lww',
    },
    {
      tableName: 'cm_canvas_nodes',
      defaultScope: 'shared_workspace',
      maxScope: 'shared_workspace',
      conflictStrategy: 'lww',
    },
    {
      tableName: 'cm_canvas_strokes',
      defaultScope: 'shared_workspace',
      maxScope: 'shared_workspace',
      conflictStrategy: 'or_set',
    },
    {
      tableName: 'cm_canvas_counters',
      defaultScope: 'shared_workspace',
      maxScope: 'shared_workspace',
      conflictStrategy: 'or_set',
    },
    // Plan 56 C2: badge mints + awards (verifiable scarcity, 7.6).
    {
      tableName: 'cm_badges',
      defaultScope: 'shared_workspace',
      maxScope: 'shared_workspace',
      conflictStrategy: 'or_set',
    },
    // Plan 56 C2 (feature 5): uploader-signed emoji/sticker packs; per-identity
    // lww (entryVersion) resolved in @mylife/sync; sealed item blobs ride
    // asset_manifest_json -> collectBlobRefs.
    {
      tableName: 'cm_asset_packs',
      defaultScope: 'shared_workspace',
      maxScope: 'shared_workspace',
      conflictStrategy: 'lww',
    },
    // Plan 56 C3 (Plaza): one signed pixel per placement, pure or_set append;
    // the validator enforces membership, the board's policy grid, and the
    // per-member placement interval at apply time.
    {
      tableName: 'cm_canvas_pixels',
      defaultScope: 'shared_workspace',
      maxScope: 'shared_workspace',
      conflictStrategy: 'or_set',
    },
    {
      tableName: 'cm_libraries',
      defaultScope: 'shared_workspace',
      maxScope: 'shared_workspace',
      conflictStrategy: 'lww',
    },
    {
      tableName: 'cm_library_items',
      defaultScope: 'shared_workspace',
      maxScope: 'shared_workspace',
      conflictStrategy: 'lww',
    },
    {
      tableName: 'cm_library_collections',
      defaultScope: 'shared_workspace',
      maxScope: 'shared_workspace',
      conflictStrategy: 'lww',
    },
    {
      tableName: 'cm_library_collection_items',
      defaultScope: 'shared_workspace',
      maxScope: 'shared_workspace',
      conflictStrategy: 'lww',
    },
    {
      tableName: 'cm_library_smart_rules',
      defaultScope: 'shared_workspace',
      maxScope: 'shared_workspace',
      conflictStrategy: 'lww',
    },
    {
      tableName: 'cm_library_tags',
      defaultScope: 'shared_workspace',
      maxScope: 'shared_workspace',
      conflictStrategy: 'lww',
    },
    // Plan 38 Codex amendment 5: watch/read resume state. PERSONAL replica only
    // (your own paired devices, cm_read_state precedent); it must NEVER reach
    // shared_workspace, so a community can never learn what a member watched.
    {
      tableName: 'cm_library_progress',
      defaultScope: 'personal_replica',
      maxScope: 'personal_replica',
      conflictStrategy: 'lww',
    },
    // Plan 29 P6: presence beacons are DEVICE-LOCAL and must never ride the CRDT
    // document onto a wider transport. An explicit device_local cap (in addition
    // to the defaultScope) keeps a beacon off every shared session.
    { ...PRESENCE_BEACON_SYNC_RULE },
    // Plan 52 P2: signed person-group membership proofs (mutual member
    // signatures over the community-derived group id). Verified fail-closed at
    // apply by validatePersonAnnounceRow; the inner group id never rides here.
    {
      tableName: 'cm_person_announces',
      defaultScope: 'shared_workspace',
      maxScope: 'shared_workspace',
      conflictStrategy: 'lww',
    },
    // Plan 52: the receiver-side materialization of verified announces
    // (derived group id -> member device ids). DEVICE-LOCAL by explicit cap:
    // each device rebuilds it from announces it verified itself.
    {
      tableName: 'cm_person_links',
      defaultScope: 'device_local',
      maxScope: 'device_local',
      conflictStrategy: 'lww',
    },
  ],
};

export const COMMUNITY_DDL = [
  `CREATE TABLE IF NOT EXISTS cm_messages (
    id TEXT PRIMARY KEY,
    community_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    author_device_id TEXT NOT NULL,
    body TEXT NOT NULL,
    attachments_json TEXT NOT NULL DEFAULT '[]',
    hlc_wall TEXT NOT NULL,
    hlc_counter INTEGER NOT NULL,
    supersedes_id TEXT,
    supersedes_deleted INTEGER,
    signature TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    post_id TEXT,
    parent_id TEXT,
    branch_id TEXT,
    author_kind TEXT,
    mentions_json TEXT NOT NULL DEFAULT '[]',
    intent TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS cm_messages_channel
    ON cm_messages (community_id, channel_id, hlc_wall, hlc_counter, author_device_id)`,
  `CREATE TABLE IF NOT EXISTS cm_message_attachments (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL,
    community_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    attachment_id TEXT NOT NULL,
    blob_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS cm_message_attachments_message
    ON cm_message_attachments (community_id, channel_id, message_id)`,
  `CREATE INDEX IF NOT EXISTS cm_message_attachments_blob
    ON cm_message_attachments (blob_hash)`,
  `CREATE TABLE IF NOT EXISTS cm_reactions (
    id TEXT PRIMARY KEY,
    community_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    emoji_shortcode TEXT NOT NULL,
    member_device_id TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  // Prompt 09: member-signed community profile events. Append-only OR-set rows
  // keep forged profile rows from overwriting a valid prior profile; readers
  // verify signatures and active membership before using a row.
  `CREATE TABLE IF NOT EXISTS cm_profiles (
    id TEXT PRIMARY KEY,
    community_id TEXT NOT NULL,
    member_device_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    avatar_initial TEXT,
    updated_at TEXT NOT NULL,
    signature TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS cm_profiles_member
    ON cm_profiles (community_id, member_device_id, updated_at DESC)`,
  // MK-P01: the immutable signed post header (the bump/addressing anchor).
  `CREATE TABLE IF NOT EXISTS cm_posts (
    id TEXT PRIMARY KEY,
    community_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    author_device_id TEXT NOT NULL,
    author_kind TEXT NOT NULL DEFAULT 'human',
    post_type TEXT NOT NULL,
    title TEXT,
    created_wall TEXT NOT NULL,
    created_counter INTEGER NOT NULL,
    signature TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS cm_posts_channel
    ON cm_posts (community_id, channel_id)`,
  // MK-P01: add/remove-as-a-set post tags (or_set semantics).
  `CREATE TABLE IF NOT EXISTS cm_post_tags (
    post_id TEXT NOT NULL,
    community_id TEXT NOT NULL,
    tag TEXT NOT NULL,
    added_by_device_id TEXT NOT NULL,
    added_wall TEXT NOT NULL,
    added_counter INTEGER NOT NULL,
    PRIMARY KEY (post_id, tag)
  )`,
  `CREATE INDEX IF NOT EXISTS cm_post_tags_community
    ON cm_post_tags (community_id)`,
  // MK-P01: post lifecycle (open/resolved) set by signed superseding events.
  `CREATE TABLE IF NOT EXISTS cm_post_lifecycle (
    post_id TEXT PRIMARY KEY,
    community_id TEXT NOT NULL,
    state TEXT NOT NULL,
    set_by_device_id TEXT NOT NULL,
    set_wall TEXT NOT NULL,
    set_counter INTEGER NOT NULL,
    signature TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS cm_post_lifecycle_community
    ON cm_post_lifecycle (community_id)`,
  // MK-P01: LOCAL-ONLY derived bump/unread state. Omitted from COMMUNITY_SYNC_POLICY
  // by design (mirrors cm_feed_cursor); recomputed from verified child events, never synced.
  `CREATE TABLE IF NOT EXISTS cm_post_activity (
    post_id TEXT PRIMARY KEY,
    community_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    bumped_at_wall TEXT NOT NULL,
    bumped_at_counter INTEGER NOT NULL,
    reply_count INTEGER NOT NULL DEFAULT 0,
    last_author_device_id TEXT,
    unread_count INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS cm_post_activity_channel
    ON cm_post_activity (community_id, channel_id, bumped_at_wall DESC, bumped_at_counter DESC)`,
  `CREATE TABLE IF NOT EXISTS cm_read_state (
    id TEXT PRIMARY KEY,
    community_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    last_read_wall TEXT,
    last_read_counter INTEGER,
    last_read_author TEXT,
    updated_at TEXT NOT NULL,
    post_id TEXT,
    branch_id TEXT,
    follow INTEGER,
    mute INTEGER,
    snooze_until TEXT,
    importance INTEGER
  )`,
  `CREATE INDEX IF NOT EXISTS cm_read_state_channel
    ON cm_read_state (community_id, channel_id)`,
  // Prompt 07 safety: LOCAL-ONLY mute/block/report state. Omitted from
  // COMMUNITY_SYNC_POLICY by design, so these actions never pretend to notify
  // other devices or remove a member.
  `CREATE TABLE IF NOT EXISTS cm_safety_actions (
    id TEXT PRIMARY KEY,
    community_id TEXT NOT NULL,
    channel_id TEXT,
    target_kind TEXT NOT NULL,
    target_id TEXT NOT NULL,
    target_author_device_id TEXT,
    action TEXT NOT NULL,
    status TEXT NOT NULL,
    reason TEXT,
    target_label TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS cm_safety_actions_lookup
    ON cm_safety_actions (community_id, target_kind, target_id, action, status)`,
  `CREATE INDEX IF NOT EXISTS cm_safety_actions_review
    ON cm_safety_actions (community_id, action, status, updated_at DESC)`,
  // Files Phase 3: the honest local request/approve/restore ledger. LOCAL-ONLY
  // (never in the sync policy), so it does not replicate. id = requestId.
  `CREATE TABLE IF NOT EXISTS cm_file_requests (
    id TEXT PRIMARY KEY,
    community_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    attachment_id TEXT NOT NULL,
    blob_hash TEXT NOT NULL,
    direction TEXT NOT NULL,
    counterparty_device_id TEXT NOT NULL,
    status TEXT NOT NULL,
    detail TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS cm_file_requests_incoming
    ON cm_file_requests (direction, status, community_id)`,
  `CREATE INDEX IF NOT EXISTS cm_file_requests_attachment
    ON cm_file_requests (community_id, channel_id, attachment_id)`,
  // Community feed P1: the rolling-snapshot index. LOCAL-ONLY by deliberate
  // OMISSION from COMMUNITY_SYNC_POLICY (one rolling snapshot per channel; the
  // pieces live in a host-style store, this row is just metadata). NEVER syncs.
  `CREATE TABLE IF NOT EXISTS cm_snapshots (
    community_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    epoch INTEGER NOT NULL,
    snapshot_id TEXT NOT NULL,
    info_hash TEXT NOT NULL,
    through_wall TEXT NOT NULL,
    through_counter INTEGER NOT NULL,
    manifest_json TEXT NOT NULL,
    event_count INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (community_id, channel_id)
  )`,
  // Community feed P1: the warm-tail cursor. Personal-replica by intent but
  // LOCAL-ONLY here (omitted from the sync policy); it is written ROW-ONLY and
  // never crosses an engine session.
  `CREATE TABLE IF NOT EXISTS cm_feed_cursor (
    community_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    last_wall TEXT NOT NULL,
    last_counter INTEGER NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (community_id, channel_id)
  )`,
  // Plan 19 (Public Social Layer) P5: the signed decision to publish content
  // publicly. The ONLY community-family table whose maxScope is published_blob
  // (COMMUNITY_SYNC_POLICY). Publishing writes a SEPARATE row referencing content
  // by id; it never rewrites a cm_messages row's scope.
  `CREATE TABLE IF NOT EXISTS cm_publications (
    publication_id TEXT PRIMARY KEY,
    community_id TEXT NOT NULL,
    channel_id TEXT,
    post_id TEXT,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL,
    owner_device_id TEXT NOT NULL,
    content_id TEXT NOT NULL,
    public_key_hex TEXT NOT NULL,
    host_urls TEXT NOT NULL DEFAULT '[]',
    revision INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'active',
    join_policy TEXT NOT NULL DEFAULT 'request',
    signature_hex TEXT NOT NULL,
    rights_json TEXT,
    public_join_json TEXT,
    post_policy TEXT,
    post_node_key_hex TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  // Plan 19 P5: signed abuse reports filed against PUBLIC content. Delivered to
  // the publishing owner (mailbox) AND the host abuse endpoint.
  `CREATE TABLE IF NOT EXISTS cm_public_reports (
    report_id TEXT PRIMARY KEY,
    publication_id TEXT NOT NULL,
    target_kind TEXT NOT NULL,
    target_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    reporter_device_id TEXT NOT NULL,
    signature_hex TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  // Plan 19 P5: LOCAL-ONLY cache of browse/search/trending results. Every row
  // carries its real source host + fetch time and is recomputed, never synced
  // (the sync policy caps it device_local). verified=1 only after signature +
  // content-id verification passes.
  `CREATE TABLE IF NOT EXISTS cm_public_directory_cache (
    publication_id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    owner_device_id TEXT NOT NULL,
    content_id TEXT NOT NULL,
    public_key_hex TEXT NOT NULL,
    host_urls TEXT NOT NULL,
    announcing_hosts INTEGER NOT NULL DEFAULT 0,
    event_count INTEGER NOT NULL DEFAULT 0,
    latest_wall TEXT NOT NULL DEFAULT '',
    source_host TEXT NOT NULL,
    fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
    verified INTEGER NOT NULL DEFAULT 0
  )`,
  // Plan 19 P5: LOCAL-ONLY warm-tail cursor per (publication, channel). Like
  // cm_read_state / cm_feed_cursor it must NEVER be sent (device_local).
  `CREATE TABLE IF NOT EXISTS cm_public_feed_cursor (
    publication_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    last_wall TEXT NOT NULL DEFAULT '',
    last_counter INTEGER NOT NULL DEFAULT 0,
    source_host TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (publication_id, channel_id)
  )`,
  // Plan 39 P10: the device's OWN public-tier follows (personas + Commons topics).
  // follow_kind is 'persona' (target_id = persona pubkey hex) or 'topic' (target_id
  // = Commons channel id). display_hint caches the alias/title for list rendering so
  // the Following list does not need a network round-trip to render a name. LOCAL-ONLY
  // (COMMUNITY_SYNC_POLICY caps it device_local); never synced.
  `CREATE TABLE IF NOT EXISTS cm_public_follows (
    follow_kind TEXT NOT NULL,
    target_id TEXT NOT NULL,
    display_hint TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (follow_kind, target_id)
  )`,
  // Plan 19 P8: LOCAL-ONLY cache of an owned publication's published snapshot
  // pieces (base64) + manifest, kept so unpublishPublicly can re-register the
  // UNPUBLISHED revision on each host (the host's register route requires the
  // descriptor's contentId among the supplied snapshots). Never synced.
  `CREATE TABLE IF NOT EXISTS cm_publication_snapshots (
    publication_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    epoch INTEGER NOT NULL DEFAULT 0,
    manifest_json TEXT NOT NULL,
    pieces_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (publication_id, channel_id)
  )`,
  // Plan 19 P8: LOCAL-ONLY markers for host-intake reports the owner has reviewed.
  // Keyed by the report's Ed25519 signature (a stable unique id), so a reviewed
  // report drops from the owner's Public reports queue. Never synced.
  `CREATE TABLE IF NOT EXISTS cm_public_report_reviews (
    report_sig TEXT PRIMARY KEY,
    publication_id TEXT NOT NULL,
    reviewed_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  // Plan 19 P9 (Public/Forever Archive): the durable-pin lifecycle for a
  // publication's public snapshot. content_id is the DEDUPE key. Replicates across
  // the OWNER's own devices (personal_replica); never published. total_bytes is the
  // REAL byte count from SeederNodeStats, never fabricated.
  `CREATE TABLE IF NOT EXISTS cm_archive_jobs (
    job_id TEXT PRIMARY KEY,
    publication_id TEXT NOT NULL,
    content_id TEXT NOT NULL,
    tier TEXT NOT NULL DEFAULT 'self_host',
    host_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'consented',
    total_bytes INTEGER NOT NULL DEFAULT 0,
    pieces INTEGER NOT NULL DEFAULT 0,
    consent_sig_hex TEXT NOT NULL,
    signature_hex TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  // Plan 19 P9: LOCAL mirror of the host moderation-queue decision for a candidate.
  // The authoritative queue lives on the host; this row is recomputed from host
  // responses. scan_result stays 'unscanned' until a REAL scan result returns.
  `CREATE TABLE IF NOT EXISTS cm_archive_moderation (
    publication_id TEXT NOT NULL,
    content_id TEXT NOT NULL,
    host_url TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'pending',
    scan_result TEXT NOT NULL DEFAULT 'unscanned',
    decided_at TEXT,
    source_host TEXT NOT NULL,
    fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (publication_id, host_url)
  )`,
  // Plan 19 P9: LOCAL cache of the rights/provenance/license + consent the owner
  // declared. CANONICAL copy lives inside the signed PublicationDescriptor; this
  // mirrors it for query. Never published.
  `CREATE TABLE IF NOT EXISTS cm_publication_rights (
    publication_id TEXT PRIMARY KEY,
    license TEXT NOT NULL,
    rights_assertion TEXT NOT NULL,
    provenance TEXT NOT NULL DEFAULT '',
    consent_at TEXT NOT NULL,
    signature_hex TEXT NOT NULL
  )`,
  // Plan 19 FF3 (app half): the owner's LOCAL review queue for REQUEST-policy
  // public-join requests. Written ONLY by recordPublicJoinRequests (the mailbox
  // dispatcher's publicJoinRequest handler) AFTER the envelope already verified;
  // this table adds NO member and hands off NO key -- it is purely a decision
  // queue the owner later approves/declines through approvePublicJoinRequest.
  // PRIMARY KEY (publication_id, sender_device_id) makes a re-sent request
  // idempotent: INSERT OR IGNORE never resets an already-decided row back to
  // 'pending'. LOCAL-ONLY (COMMUNITY_SYNC_POLICY caps it device_local); never
  // synced.
  `CREATE TABLE IF NOT EXISTS cm_public_join_requests (
    publication_id TEXT NOT NULL,
    community_id TEXT NOT NULL,
    sender_device_id TEXT NOT NULL,
    grant_id TEXT NOT NULL,
    bundle_json TEXT NOT NULL,
    humanity_token TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    PRIMARY KEY (publication_id, sender_device_id)
  )`,
  `CREATE INDEX IF NOT EXISTS cm_public_join_requests_pending
    ON cm_public_join_requests (community_id, status, created_at DESC)`,
  // Plan 27 P4: the LOCAL, append-only ledger of a community's transport-policy
  // changes as this device observed them. Written ONLY by reconcileCommunityPolicyHistory
  // AFTER a real signed descriptor was already adopted (via join, gossip, or the
  // owner's own revise), so a row reflects an already-verified owner-signed policy
  // -- it never asserts a change that did not really take effect. LOCAL-ONLY
  // (COMMUNITY_SYNC_POLICY caps cm_policy_history device_local); never synced.
  // A row with previous_policy NULL is the baseline seed (first time this device
  // saw the community); a non-NULL previous_policy is a real observed change and
  // drives the in-community notice.
  `CREATE TABLE IF NOT EXISTS cm_policy_history (
    id TEXT PRIMARY KEY,
    community_id TEXT NOT NULL,
    policy TEXT NOT NULL,
    previous_policy TEXT,
    revision INTEGER NOT NULL,
    recorded_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS cm_policy_history_community
    ON cm_policy_history (community_id, recorded_at DESC)`,
  // Plan 38 Phase 0: OWNER-signed community identity + theme. Columns mirror
  // @mylife/sync communityIdentityEventToRow exactly (id is the content-addressed
  // event id; the highest VERIFIED revision wins). shared_workspace; an unverified
  // row renders NOTHING (the avatar rule).
  `CREATE TABLE IF NOT EXISTS cm_community_identity (
    id TEXT PRIMARY KEY,
    community_id TEXT NOT NULL,
    revision INTEGER NOT NULL,
    description TEXT,
    accent_color TEXT,
    icon_image TEXT,
    banner_cid TEXT,
    banner_key_epoch INTEGER,
    banner_wrapped_key TEXT,
    banner_manifest_json TEXT,
    theme_blob TEXT,
    tombstone INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    signed_by TEXT NOT NULL,
    signature TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS cm_community_identity_revision
    ON cm_community_identity (community_id, revision)`,
  // Composition plan 2.2: OWNER-signed layout document. Columns mirror
  // @mylife/sync communityLayoutEventToRow exactly (id is the content-addressed
  // event id; the highest VERIFIED revision wins). shared_workspace; an
  // unverified row renders NOTHING (the app falls back to the legacy
  // communityLayout() rendering).
  `CREATE TABLE IF NOT EXISTS cm_layout (
    id TEXT PRIMARY KEY,
    community_id TEXT NOT NULL,
    revision INTEGER NOT NULL,
    layout_blob TEXT,
    tombstone INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    signed_by TEXT NOT NULL,
    signature TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS cm_layout_revision
    ON cm_layout (community_id, revision)`,
  // Plan 56 C1: the canvas registry (one SIGNED row per canvas; the row id IS
  // the canvas id). Columns mirror @mylife/sync canvasEventToRow exactly.
  `CREATE TABLE IF NOT EXISTS cm_canvas (
    id TEXT PRIMARY KEY,
    community_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    policy_json TEXT,
    revision INTEGER NOT NULL,
    tombstone INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    signed_by TEXT NOT NULL,
    signature TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS cm_canvas_subject
    ON cm_canvas (community_id, kind, subject_id)`,
  // Plan 56 C1: one SIGNED row per placed object, author-signed, per-object
  // LWW via (node_version, version_nonce). The sealed asset rides four
  // dedicated columns; asset_manifest_json feeds the blob-transfer collector.
  `CREATE TABLE IF NOT EXISTS cm_canvas_nodes (
    id TEXT PRIMARY KEY,
    canvas_id TEXT NOT NULL,
    community_id TEXT NOT NULL,
    author_device TEXT NOT NULL,
    node_type TEXT NOT NULL,
    schema_version INTEGER NOT NULL,
    props_json TEXT NOT NULL,
    layer TEXT NOT NULL,
    x REAL NOT NULL,
    y REAL NOT NULL,
    w REAL NOT NULL,
    h REAL NOT NULL,
    rotation REAL NOT NULL,
    z INTEGER NOT NULL,
    parent_id TEXT,
    node_version INTEGER NOT NULL,
    version_nonce INTEGER NOT NULL,
    asset_cid TEXT,
    asset_key_epoch INTEGER,
    asset_wrapped_key TEXT,
    asset_manifest_json TEXT,
    tombstone INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    signed_by TEXT NOT NULL,
    signature TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS cm_canvas_nodes_canvas
    ON cm_canvas_nodes (canvas_id, layer, z)`,
  // Plan 56 C1: append-only SIGNED freehand strokes; erasing is a new signed
  // event whose erases_id names the target (author or owner/admin).
  `CREATE TABLE IF NOT EXISTS cm_canvas_strokes (
    id TEXT PRIMARY KEY,
    canvas_id TEXT NOT NULL,
    community_id TEXT NOT NULL,
    author_device TEXT NOT NULL,
    stroke_json TEXT,
    erases_id TEXT,
    created_at TEXT NOT NULL,
    signed_by TEXT NOT NULL,
    signature TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS cm_canvas_strokes_canvas
    ON cm_canvas_strokes (canvas_id, created_at)`,
  // Plan 56 C1 (3.3): honest interaction marks: increment (counters), vote
  // (polls), note (guestbooks). Every number shown derives from these
  // verified rows; nothing else exists.
  `CREATE TABLE IF NOT EXISTS cm_canvas_counters (
    id TEXT PRIMARY KEY,
    canvas_id TEXT NOT NULL,
    community_id TEXT NOT NULL,
    node_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    option INTEGER,
    note TEXT,
    author_device TEXT NOT NULL,
    created_at TEXT NOT NULL,
    signed_by TEXT NOT NULL,
    signature TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS cm_canvas_counters_node
    ON cm_canvas_counters (node_id, kind)`,
  // Plan 56 C2: badge mint + award events. Columns mirror @mylife/sync
  // badgeEventToRow exactly; resolution honors only the signed supply cap.
  `CREATE TABLE IF NOT EXISTS cm_badges (
    id TEXT PRIMARY KEY,
    community_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    badge_id TEXT NOT NULL,
    name TEXT,
    glyph TEXT,
    color_token TEXT,
    supply_cap INTEGER,
    recipient_device TEXT,
    created_at TEXT NOT NULL,
    signed_by TEXT NOT NULL,
    signature TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS cm_badges_badge
    ON cm_badges (community_id, badge_id, kind)`,
  // Plan 56 C2 (feature 5): asset pack + item events. Columns mirror
  // @mylife/sync assetPackEventToRow exactly; the manifest column feeds
  // collectBlobRefs so sealed item blobs replicate automatically.
  `CREATE TABLE IF NOT EXISTS cm_asset_packs (
    id TEXT PRIMARY KEY,
    community_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    pack_id TEXT NOT NULL,
    name TEXT,
    pack_kind TEXT,
    slug TEXT,
    glyph TEXT,
    asset_cid TEXT,
    asset_key_epoch INTEGER,
    asset_wrapped_key TEXT,
    asset_manifest_json TEXT,
    entry_version INTEGER NOT NULL,
    tombstone INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    signed_by TEXT NOT NULL,
    signature TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS cm_asset_packs_pack
    ON cm_asset_packs (community_id, pack_id, kind, slug)`,
  // Plan 56 C3 (Plaza): pixel placements. Columns mirror @mylife/sync
  // canvasPixelEventToRow exactly; resolution is last verified writer per cell.
  `CREATE TABLE IF NOT EXISTS cm_canvas_pixels (
    id TEXT PRIMARY KEY,
    canvas_id TEXT NOT NULL,
    community_id TEXT NOT NULL,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    color_index INTEGER NOT NULL,
    author_device TEXT NOT NULL,
    created_at TEXT NOT NULL,
    signed_by TEXT NOT NULL,
    signature TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS cm_canvas_pixels_board
    ON cm_canvas_pixels (canvas_id, created_at)`,
  // Plan 38 Phase 0: OWNER-signed library config (one row per library channel).
  // id = channel_id = the kind:'library' channel id; channel_id is carried as its
  // own column so the engine's row-level transport + curator-role gates apply
  // (Codex amendment 2). shared_workspace.
  `CREATE TABLE IF NOT EXISTS cm_libraries (
    id TEXT PRIMARY KEY,
    community_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    media_type TEXT NOT NULL,
    sort_default TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    signed_by TEXT NOT NULL,
    signature TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS cm_libraries_community
    ON cm_libraries (community_id)`,
  // Plan 38 Phase 0: curator-signed library items = signed metadata over a sealed
  // blob (content_cid) plus its cover/thumb blobs. key_epoch + wrapped_key deliver
  // the per-object DEK under the workspace epoch (Codex amendment 1). channel_id +
  // community_id are signed enforcement columns (amendment 2). manifest_json holds
  // {manifest, manifestSignature} for the sealed object: the manifest is itself
  // author-signed by the sealed-share layer (self-verifying), and the receiver
  // reads it to learn which sealed block ids to fetch. shared_workspace.
  `CREATE TABLE IF NOT EXISTS cm_library_items (
    id TEXT PRIMARY KEY,
    community_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    content_cid TEXT NOT NULL,
    cover_cid TEXT,
    thumb_cid TEXT,
    key_epoch INTEGER NOT NULL,
    wrapped_key TEXT NOT NULL,
    cover_wrapped_key TEXT,
    manifest_json TEXT NOT NULL,
    title TEXT NOT NULL,
    sort_title TEXT,
    year INTEGER,
    duration_ms INTEGER,
    size_bytes INTEGER,
    mime_type TEXT,
    metadata_json TEXT NOT NULL,
    metadata_source TEXT NOT NULL,
    author_device_id TEXT NOT NULL,
    signature TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    tombstone INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS cm_library_items_channel
    ON cm_library_items (channel_id)`,
  `CREATE INDEX IF NOT EXISTS cm_library_items_community
    ON cm_library_items (community_id)`,
  // Plan 38 Phase 0: curator-signed collections + their membership (shared_workspace).
  `CREATE TABLE IF NOT EXISTS cm_library_collections (
    id TEXT PRIMARY KEY,
    community_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    name TEXT NOT NULL,
    pinned INTEGER NOT NULL DEFAULT 0,
    author_device_id TEXT NOT NULL,
    signature TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    tombstone INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS cm_library_collections_channel
    ON cm_library_collections (community_id, channel_id)`,
  `CREATE TABLE IF NOT EXISTS cm_library_collection_items (
    id TEXT PRIMARY KEY,
    community_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    collection_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    author_device_id TEXT NOT NULL,
    signature TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    tombstone INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS cm_library_collection_items_collection
    ON cm_library_collection_items (community_id, collection_id)`,
  // Plan 38 Phase 0 (C.3): curator-signed smart-collection rules evaluated locally.
  // An unknown rule_type fails safe to an empty collection + notice (evaluateSmartRuleSafe).
  `CREATE TABLE IF NOT EXISTS cm_library_smart_rules (
    id TEXT PRIMARY KEY,
    community_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    collection_id TEXT NOT NULL,
    rule_type TEXT NOT NULL,
    rule_json TEXT NOT NULL,
    author_device_id TEXT NOT NULL,
    signature TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    tombstone INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS cm_library_smart_rules_collection
    ON cm_library_smart_rules (community_id, collection_id)`,
  // Plan 38 Codex amendment 6: item tags MIRROR cm_post_tags' add/remove-as-a-set
  // shape (not reuse it), keyed by item_id + the signed community_id/channel_id
  // enforcement columns. shared_workspace.
  `CREATE TABLE IF NOT EXISTS cm_library_tags (
    item_id TEXT NOT NULL,
    community_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    tag TEXT NOT NULL,
    added_by_device_id TEXT NOT NULL,
    added_wall TEXT NOT NULL,
    added_counter INTEGER NOT NULL,
    signature TEXT NOT NULL,
    PRIMARY KEY (item_id, tag)
  )`,
  `CREATE INDEX IF NOT EXISTS cm_library_tags_community
    ON cm_library_tags (community_id)`,
  // Plan 38 Codex amendment 5: personal watch/read resume state. personal_replica
  // (your own paired devices only); NEVER community-visible. id is the item id (the engine injects id=rowId on apply, so synced tables carry an id PK).
  `CREATE TABLE IF NOT EXISTS cm_library_progress (
    id TEXT PRIMARY KEY,
    community_id TEXT,
    position_ms INTEGER NOT NULL DEFAULT 0,
    completed INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
  )`,
  // Plan 52 P2: signed person-group membership proofs, one row per
  // (community, derived group id). shared_workspace; verified fail-closed at
  // apply (validatePersonAnnounceRow) AND at read. The inner group id never
  // appears in this table.
  `CREATE TABLE IF NOT EXISTS cm_person_announces (
    id TEXT PRIMARY KEY,
    community_id TEXT NOT NULL,
    derived_group_id TEXT NOT NULL,
    revision INTEGER NOT NULL,
    announce_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS cm_person_announces_community
    ON cm_person_announces (community_id, updated_at DESC)`,
  // Plan 52: device-local materialization of verified announces
  // (derived group id -> member device id). Rebuilt from announces this device
  // verified itself; never replicates (explicit device_local cap).
  `CREATE TABLE IF NOT EXISTS cm_person_links (
    id TEXT PRIMARY KEY,
    community_id TEXT NOT NULL,
    derived_group_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    revision INTEGER NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS cm_person_links_community_device
    ON cm_person_links (community_id, device_id)`,
  `CREATE INDEX IF NOT EXISTS cm_person_links_group
    ON cm_person_links (community_id, derived_group_id)`,
] as const;

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
   * The events actually inserted on THIS device. This is the ONLY set safe to
   * replicate onward: it excludes dropped-removed events (a removed member's
   * post-removal posts), which must NOT be re-injected to peers who fail-closed
   * dropped them (Plan 28 membership cut; peers gate on the sending peer, not the
   * row author).
   */
  insertedEvents: ChannelMessageEvent[];
}

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

function ensureColumn(
  db: DatabaseAdapter,
  table: string,
  column: string,
  definition: string,
): void {
  const columns = db.query<{ name: string }>(`PRAGMA table_info(${table})`);
  if (columns.some((c) => c.name === column)) return;
  db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

export function ensureCommunityTables(db: DatabaseAdapter): void {
  for (const statement of COMMUNITY_DDL) {
    db.execute(statement);
  }
  // Plan 29 P6: device-local presence beacon store (cm_presence_beacons). Capped
  // to device_local by PRESENCE_BEACON_SYNC_RULE above; never replicates.
  ensurePresenceBeaconTable(db);
  ensureColumn(db, 'cm_messages', 'attachments_json', "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(db, 'cm_messages', 'version', 'INTEGER NOT NULL DEFAULT 1');
  ensureColumn(db, 'cm_messages', 'post_id', 'TEXT');
  ensureColumn(db, 'cm_messages', 'parent_id', 'TEXT');
  ensureColumn(db, 'cm_messages', 'branch_id', 'TEXT');
  ensureColumn(db, 'cm_messages', 'author_kind', 'TEXT');
  ensureColumn(db, 'cm_messages', 'mentions_json', "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(db, 'cm_messages', 'intent', 'TEXT');
  ensureColumn(db, 'cm_read_state', 'last_read_author', 'TEXT');
  ensureColumn(db, 'cm_read_state', 'post_id', 'TEXT');
  ensureColumn(db, 'cm_read_state', 'branch_id', 'TEXT');
  ensureColumn(db, 'cm_read_state', 'follow', 'INTEGER');
  ensureColumn(db, 'cm_read_state', 'mute', 'INTEGER');
  ensureColumn(db, 'cm_read_state', 'snooze_until', 'TEXT');
  ensureColumn(db, 'cm_read_state', 'importance', 'INTEGER');
  // Plan 32 T2.2: the signed community profile gains a v2 base64-JPEG avatar. BOTH
  // columns are required: without a persisted version a stored v2 event reconstructs
  // as v1, its canonical bytes differ, verifyCommunityProfileEvent fails on read, and
  // the avatar is dropped fail-closed. Legacy rows default to version 1 (no image).
  ensureColumn(db, 'cm_profiles', 'avatar_image', 'TEXT');
  ensureColumn(db, 'cm_profiles', 'version', 'INTEGER NOT NULL DEFAULT 1');
  // Plan 56 feature 53: v3 persona columns (additive; older rows stay null).
  ensureColumn(db, 'cm_profiles', 'bio', 'TEXT');
  ensureColumn(db, 'cm_profiles', 'pronouns', 'TEXT');
  ensureColumn(db, 'cm_profiles', 'name_color', 'TEXT');
  // Plan 19 P9.3e: the signed rights block rides on cm_publications so a takedown can
  // reconstruct a rights-bearing descriptor byte-exact on any device (ALTER for DBs
  // created before P9.3e).
  ensureColumn(db, 'cm_publications', 'rights_json', 'TEXT');
  // Plan 19 FF3: the owner-signed public-join grant rides on cm_publications so a takedown can
  // reconstruct a grant-bearing descriptor byte-exact on any device (ALTER for DBs created before FF3).
  ensureColumn(db, 'cm_publications', 'public_join_json', 'TEXT');
  // Plan 39 P4: the signed posting policy + pinned node receipt key ride on
  // cm_publications so a takedown/revision reconstructs a policy-bearing
  // descriptor byte-exact on any device (ALTER for pre-P4 DBs).
  ensureColumn(db, 'cm_publications', 'post_policy', 'TEXT');
  ensureColumn(db, 'cm_publications', 'post_node_key_hex', 'TEXT');
  // Plan 24 P3 / AM1: the joiner's humanity token is persisted on the owner's
  // review-queue row so the owner-side approve reconstructs the byte-exact
  // PublicJoinRequestPayload the engine now requires (ALTER for pre-AM1 DBs).
  ensureColumn(db, 'cm_public_join_requests', 'humanity_token', "TEXT NOT NULL DEFAULT ''");
  // Create the post index after column migrations so it is safe for legacy tables.
  db.execute(
    `CREATE INDEX IF NOT EXISTS cm_messages_post
      ON cm_messages (community_id, channel_id, post_id, branch_id, hlc_wall, hlc_counter)`,
  );
}

function isChannelMessageAttachment(value: unknown): value is ChannelMessageAttachment {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === 'string'
    && typeof candidate.blobHash === 'string'
    && typeof candidate.name === 'string'
    && typeof candidate.mimeType === 'string'
    && typeof candidate.size === 'number'
    && Number.isFinite(candidate.size)
    && candidate.size >= 0;
}

function parseAttachmentsJson(json: string): ChannelMessageAttachment[] {
  try {
    const value = JSON.parse(json) as unknown;
    if (!Array.isArray(value)) return [];
    return value.filter(isChannelMessageAttachment);
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
// resolves to null and renders NOTHING (the avatar rule). The native functions
// are mirrored on web (apps/meerkat-web/src/lib/meerkat-data.ts); keep in lockstep.
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

export function buildCommunityPeerNameMap(
  db: DatabaseAdapter,
  communityId: string,
): Map<string, string> {
  const names = new Map<string, string>();
  const stored = getCommunity(db, communityId);
  if (stored) {
    for (const member of stored.descriptor.members) {
      const name = member.displayName?.trim();
      if (name) names.set(member.deviceId, name);
    }
  }
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

// Plan 32 T5.3: a friend's signed avatar image resolved across communities. A
// paired friend is not scoped to one community, so the first signature-verified
// v2 avatar found among the given community ids is used (each already filtered
// through verify by resolveCommunityAvatarImage; a forged row never yields one).
// Null when the friend has set no photo in any shared community (initial fallback
// on the People list). Never fetches; reads only local verified profile rows.
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

export function markChannelRead(
  db: DatabaseAdapter,
  communityId: string,
  channelId: string,
  lastRead: Hlc,
  lastReadAuthor: string,
  now: string = new Date().toISOString(),
): MarkChannelReadResult {
  const id = channelReadStateId(communityId, channelId);
  const existing = getChannelReadState(db, communityId, channelId);
  const existingBoundary = readBoundaryFromReadState(existing);
  // No-op unless the new position sorts strictly after the stored boundary.
  if (existingBoundary && !isEventAfterReadBoundary(lastRead.wall, lastRead.counter, lastReadAuthor, existingBoundary)) {
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
    if (isChannelPostRootEvent(event)) {
      roots.set(event.postId, event);
    }
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

export function listChannelMessageThreadIds(
  db: DatabaseAdapter,
  communityId: string,
  channelId: string,
  eventId: string,
): string[] {
  const events = listChannelMessageEvents(db, communityId, channelId);
  const rootByEventId = new Map<string, string>();
  const idsByRoot = new Map<string, string[]>();

  for (const event of events) {
    if (!event.supersedes) {
      rootByEventId.set(event.id, event.id);
      idsByRoot.set(event.id, [event.id]);
      continue;
    }

    const rootId = rootByEventId.get(event.supersedes.id);
    if (!rootId) continue;
    rootByEventId.set(event.id, rootId);
    idsByRoot.set(rootId, [...(idsByRoot.get(rootId) ?? []), event.id]);
  }

  const rootId = rootByEventId.get(eventId);
  return rootId ? idsByRoot.get(rootId) ?? [eventId] : [eventId];
}

export function destroyChannelMessageKeys(
  db: DatabaseAdapter,
  communityId: string,
  channelId: string,
  eventId: string,
): string[] {
  const destroyed: string[] = [];
  for (const rowId of listChannelMessageThreadIds(db, communityId, channelId, eventId)) {
    const didDestroy = destroyEntityKey(db, {
      moduleId: COMMUNITY_MODULE_ID,
      tableName: CM_MESSAGES_TABLE,
      rowId,
    });
    if (didDestroy) destroyed.push(rowId);
  }
  return destroyed;
}

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

// ---------------------------------------------------------------------------
// Community store bridge for the CREATE path (community feed P0).
//
// joinCommunityFromLink bridges the workspace internally on the joiner; the
// founder must do the same itself, plus mint the epoch key. createCommunity only
// produces the signed descriptor. This persists the workspace + members, stores
// the descriptor, and mints epoch 1 wrapped for every member whose DH key the
// owner knows (the owner always knows its own). recordChange replicates those
// wraps to members over the next engine session. This is the native twin of
// apps/meerkat-web/src/lib/meerkat-data.ts storeOwnedCommunity; keep in lockstep.
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
      // 0: no epoch until createGroupCommit below mints epoch 1.
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
// This is the native twin of apps/meerkat-web/src/lib/meerkat-data.ts (the P1
// snapshot/cursor helpers). Native is canonical; keep them in lockstep.
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

/**
 * Build (or rebuild) this community's rolling snapshots from the local cm_messages
 * feed and persist each record. Compaction is handled by buildCommunitySnapshots
 * (one rolling snapshot per channel; the prior content's pieces are removed).
 */
export async function buildOwnedCommunitySnapshots(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  pieceStore: SnapshotPieceStore,
  now: string = new Date().toISOString(),
): Promise<BuildCommunitySnapshotsResult> {
  const communities = listCommunitiesForSnapshots(db, identity);
  const allRecords: CommunitySnapshotRecord[] = [];
  const allSkipped: BuildCommunitySnapshotsResult['skipped'] = [];
  const allOversized: BuildCommunitySnapshotsResult['oversized'] = [];
  for (const communityId of communities) {
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

/**
 * Build (or rebuild) snapshots for a SINGLE community (the common foreground
 * path: the channel screen rebuilds its own community's snapshots).
 */
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

function listCommunitiesForSnapshots(db: DatabaseAdapter, identity: DeviceIdentity): string[] {
  void identity;
  return db
    .query<{ community_id: string }>('SELECT community_id FROM sync_communities ORDER BY community_id ASC')
    .map((row) => row.community_id);
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

  // Advance the cursor (row-only) to the highest HLC the snapshot carried.
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
// Community feed P4: refresh ("pull now") + notify-drain core.
//
// SOURCE OF TRUTH for the web twin: apps/meerkat-web/src/lib/meerkat-data.ts
// (refreshCommunityFeed / drainCommunityNotifyForRefresh). Native is canonical;
// keep them in lockstep, verbatim.
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
  /** Injected for RN-safety + tests. Defaults to global fetch. */
  fetchFn?: typeof fetch;
  /** Optional hosted-entitlement bearer for entitlement-gated first-party nodes. */
  entitlementToken?: string;
  /**
   * Fallback when no community node host is reachable: enqueue a P3 member-to-
   * member history backfill (parks a request per channel to a paired peer). The
   * caller wires this to SyncProvider.queueHistoryRequest. Returns the number of
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
// SOURCE OF TRUTH for the web twin: apps/meerkat-web/src/lib/meerkat-data.ts.
// Native is canonical; keep them in lockstep, verbatim.
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
   * which runs the atomic network-wide double-spend. When absent (no service
   * configured), the owner CANNOT enforce single-use, so the request is dropped
   * fail-closed and NO queue row is written. A replayed token comes back
   * `already_spent` and is dropped. A device cannot run the spent-set locally,
   * so local verify alone is insufficient -- the service call is the real gate.
   */
  redeem?: HumanityRedeemClient;
  /**
   * The pinned humanity-service Ed25519 public key (hex), or '' when unset. Used
   * ONLY as a cheap local pre-check (reject an obviously forged/expired token
   * before the redeem round-trip); the authoritative gate is `redeem`.
   */
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
      // AUTHORITATIVE single-use check is the service redeem. Without a redeem
      // client (no verification service configured) the owner cannot enforce
      // single-use, so drop fail-closed. An optional local pre-check rejects an
      // obviously forged/expired token before the round-trip.
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
        // reconstructs the byte-exact payload the engine requires (the token was
        // already bound + verified before this handler fired; recording is not
        // re-verification, it is durable pass-through).
        humanityToken: payload.humanityToken,
        createdAt,
      });
      return true;
    },
  };
}

// ---------------------------------------------------------------------------
// Plan 27 P4: transport-policy labels + observed policy-change ledger.
//
// The label/meaning maps and the notice formatter are a byte-parity twin with
// apps/meerkat-web/src/lib/policy-history.ts (locked by check-meerkat-parity.mjs).
// Keep every user-facing string identical across surfaces and HONEST: a label
// describes what the policy guarantees, never a live connection state.
// ---------------------------------------------------------------------------

/** Short, human policy names shown in the settings row and change notices. */
export const TRANSPORT_POLICY_LABELS: Record<CommunityTransportPolicy, string> = {
  local_only: 'In person only',
  local_preferred: 'Local preferred',
  any: 'Any connection',
};

/** One honest sentence explaining what each policy does (and does not) promise. */
export const TRANSPORT_POLICY_MEANINGS: Record<CommunityTransportPolicy, string> = {
  local_only: 'This community only updates in person or on a shared network.',
  local_preferred: 'This community prefers a nearby connection and labels updates that go over the internet.',
  any: 'This community updates over any connection, including the internet.',
};

export interface PolicyHistoryRow {
  id: string;
  communityId: string;
  policy: CommunityTransportPolicy;
  previousPolicy: CommunityTransportPolicy | null;
  revision: number;
  recordedAt: string;
}

function readPolicy(raw: string | null | undefined): CommunityTransportPolicy | null {
  if (raw === 'local_only' || raw === 'local_preferred' || raw === 'any') return raw;
  return null;
}

/**
 * Record this device's CURRENT observed transport policy for a community into the
 * local ledger, IF it differs from the most recent recorded point. Idempotent per
 * revision (the row id is `${communityId}:${revision}`), so re-running after every
 * drain never duplicates. The first point for a community seeds a baseline row
 * (previous_policy NULL); a later differing point records the real change that
 * drives the member notice. Returns true iff a new row was written.
 *
 * HONEST: this is called only AFTER a real, owner-signed descriptor was adopted
 * (join grant, gossip, member-removal revision, or the owner's own revise), so a
 * recorded change always reflects a verified signed policy, never a UI guess.
 */
export function recordCommunityPolicyPoint(
  db: DatabaseAdapter,
  communityId: string,
  now: string = new Date().toISOString(),
): boolean {
  const community = getCommunity(db, communityId);
  if (!community) return false;
  const policy = communityTransportPolicy(community.descriptor);
  const revision = community.descriptor.revision;

  const latest = db.query<{ policy: string; revision: number }>(
    'SELECT policy, revision FROM cm_policy_history WHERE community_id = ? ORDER BY revision DESC, recorded_at DESC LIMIT 1',
    [communityId],
  )[0];

  if (!latest) {
    // Baseline seed: record the first observed policy with no "previous".
    db.execute(
      `INSERT OR IGNORE INTO cm_policy_history (id, community_id, policy, previous_policy, revision, recorded_at)
       VALUES (?, ?, ?, NULL, ?, ?)`,
      [`${communityId}:${revision}`, communityId, policy, revision, now],
    );
    return true;
  }

  const previousPolicy = readPolicy(latest.policy);
  if (previousPolicy === policy) return false; // no change since the last point
  db.execute(
    `INSERT OR IGNORE INTO cm_policy_history (id, community_id, policy, previous_policy, revision, recorded_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [`${communityId}:${revision}`, communityId, policy, previousPolicy, revision, now],
  );
  return true;
}

/**
 * Reconcile the policy ledger for every community this device holds (call after a
 * drain / on the communities screen). Appends a point wherever the current signed
 * policy differs from the last recorded one. Returns how many rows were written.
 */
export function reconcileCommunityPolicyHistory(
  db: DatabaseAdapter,
  now: string = new Date().toISOString(),
): number {
  let written = 0;
  for (const community of listCommunities(db)) {
    if (recordCommunityPolicyPoint(db, community.descriptor.communityId, now)) written += 1;
  }
  return written;
}

/** The full observed policy ledger for a community, newest first. */
export function listCommunityPolicyHistory(db: DatabaseAdapter, communityId: string): PolicyHistoryRow[] {
  return db
    .query<{ id: string; community_id: string; policy: string; previous_policy: string | null; revision: number; recorded_at: string }>(
      'SELECT * FROM cm_policy_history WHERE community_id = ? ORDER BY revision DESC, recorded_at DESC',
      [communityId],
    )
    .map((r) => ({
      id: r.id,
      communityId: r.community_id,
      policy: readPolicy(r.policy) ?? 'local_only',
      previousPolicy: readPolicy(r.previous_policy),
      revision: r.revision,
      recordedAt: r.recorded_at,
    }));
}

/** The most recent REAL change (previous_policy not null), or null if none. */
export function getLatestPolicyChange(db: DatabaseAdapter, communityId: string): PolicyHistoryRow | null {
  return listCommunityPolicyHistory(db, communityId).find((r) => r.previousPolicy !== null) ?? null;
}

/**
 * Honest one-line notice for a recorded policy change, e.g.
 * "The owner changed the sync policy from In person only to Any connection." The
 * date is formatted by the caller (surface-specific); this string is the
 * parity-locked twin.
 */
export function formatPolicyChangeNotice(change: PolicyHistoryRow): string {
  const from = change.previousPolicy ? TRANSPORT_POLICY_LABELS[change.previousPolicy] : TRANSPORT_POLICY_LABELS.any;
  const to = TRANSPORT_POLICY_LABELS[change.policy];
  return `The owner changed the sync policy from ${from} to ${to}.`;
}
