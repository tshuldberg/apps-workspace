// Meerkat web schema bootstrap.
//
// App Isolation (MyLife CLAUDE.md "App Isolation + Hub Inclusion"): meerkat-web
// must not deep-import files out of the apps/meerkat app boundary (that app has
// no package `exports`; its `main` is expo-router/entry). So the APP-OWNED DDL
// is replicated here verbatim, with the source of truth cited below. The package
// resolvable generators (createSyncTables, ensureBlobPolicy, ensureCommunity
// tables DDL) are still consumed from @mylife/sync where the app gets them, so
// only the truly app-local tables (mk_*, mp_pad, cm_*) are duplicated.
//
// SOURCE OF TRUTH (keep in lockstep until a shared @mylife/meerkat-core package
// extracts these; that is the honest Phase-2 consolidation path):
//   - mk_* : apps/meerkat/app/(root)/data/db.ts        (ensureMeerkatTables)
//   - mp_pad + ensureSyncSchema : apps/meerkat/app/(root)/data/sync-core.ts
//   - cm_* : apps/meerkat/app/(root)/data/community-core.ts (COMMUNITY_DDL)

import type { DatabaseAdapter } from '@mylife/db';
import { createSyncTables, ensureBlobPolicy, ensureMeerkatPinnedTables, ensurePresenceBeaconTable, ensureShareIntakeTables, migrateSyncSchema } from '@mylife/sync';

// --- mk_ tables (mirror of apps/meerkat/app/(root)/data/db.ts) ---

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
// the web and mobile surfaces share one source of truth and cannot drift, the
// same pattern as ensureShareIntakeTables.

// Plan 20: cache the LAST REAL /healthz probe per relay URL so connection status
// is honest (never fabricated). Mirror of apps/meerkat data/db.ts. Device-local
// (mk_), never replicated.
const CREATE_MK_RELAY_PROBE = `
CREATE TABLE IF NOT EXISTS mk_relay_probe (
  url          TEXT PRIMARY KEY,
  ok           INTEGER NOT NULL,
  connections  INTEGER,
  latency_ms   INTEGER,
  probed_at    TEXT NOT NULL
)`;

// Plan 38 Phase 2 (G4): device-local per-community list organization (pin, manual
// sort, optional folder). NEVER replicates (mk_ prefix, omitted from every sync
// prefix map). Column list/order is kept BYTE-IDENTICAL to the mobile db.ts twin
// (apps/meerkat/app/(root)/data/db.ts) so the two surfaces cannot drift.
const CREATE_MK_COMMUNITY_PREFS = `
CREATE TABLE IF NOT EXISTS mk_community_prefs (
  community_id TEXT PRIMARY KEY,
  pinned INTEGER NOT NULL DEFAULT 0,
  sort_index INTEGER,
  folder TEXT
)`;

// Plan 38 C.7: per-library pin policy + explicit-keep marker. DEVICE-LOCAL, never
// replicated (mk_ prefix). Mirror of apps/meerkat/app/(root)/data/db.ts; kept
// BYTE-IDENTICAL with that twin. The pin-class LRU column (mk_pinned.last_used) is
// added by ensureMkPinnedLastUsed below.
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

// Plan 56 C1 (8): canvas editor drafts. DEVICE-LOCAL; survives reloads;
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
  // Connection-server probe cache (Plan 20), device-local, never replicated.
  db.execute(CREATE_MK_RELAY_PROBE);
  // Per-community list organization (Plan 38 G4), device-local, never replicated.
  db.execute(CREATE_MK_COMMUNITY_PREFS);
  // OS share-intake staging (Plan 20, Phase 8), device-local, never replicated.
  ensureShareIntakeTables(db);
}

// --- mp_pad: the synced bellwether (mirror of sync-core.ts) ---

const CREATE_MP_PAD = `
CREATE TABLE IF NOT EXISTS mp_pad (
  id TEXT PRIMARY KEY,
  body TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`;

// --- cm_ community DDL (mirror of community-core.ts COMMUNITY_DDL) ---

export const COMMUNITY_MODULE_ID = 'community';

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
  // Community feed P1: rolling-snapshot index. LOCAL-ONLY by OMISSION from the
  // sync policy (one rolling snapshot per channel; pieces live in a host-style
  // store, this row is just metadata). NEVER syncs.
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
  // Community feed P1: warm-tail cursor. Personal-replica by intent but
  // LOCAL-ONLY here (omitted from the sync policy); written ROW-ONLY, never
  // through an engine session.
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
  // LOCAL-ONLY (device_local): a follow is a private viewing choice, never a shared or
  // published signal. Twin of apps/meerkat community-core.ts COMMUNITY_DDL.
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
  // Plan 27 P4 (item 13): the LOCAL observed transport-policy ledger. Written ONLY
  // by recordCommunityPolicyPoint AFTER a real owner-signed descriptor was adopted
  // (join, gossip, member-removal, or the owner's own revise). LOCAL-ONLY (device_local);
  // never synced. A row with previous_policy NULL is the baseline seed; a non-NULL
  // previous_policy is a real observed change driving the member notice. Twin of
  // the mobile cm_policy_history DDL in apps/meerkat data/community-core.ts.
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

function ensureCommunityTables(db: DatabaseAdapter): void {
  for (const statement of COMMUNITY_DDL) {
    db.execute(statement);
  }
  // Plan 29 P6: device-local presence beacon store (cm_presence_beacons). Capped
  // to device_local by PRESENCE_BEACON_SYNC_RULE; never replicates.
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
  // Plan 24 P3 / AM1: the joiner's humanity token on the owner's review-queue row
  // so the owner-side approve rebuilds the byte-exact payload (ALTER for pre-AM1 DBs).
  ensureColumn(db, 'cm_public_join_requests', 'humanity_token', "TEXT NOT NULL DEFAULT ''");
  // Create the post index after column migrations so it is safe for legacy tables.
  db.execute(
    `CREATE INDEX IF NOT EXISTS cm_messages_post
      ON cm_messages (community_id, channel_id, post_id, branch_id, hlc_wall, hlc_counter)`,
  );
}

/**
 * Create the sync_ tables (canonical generator from @mylife/sync), the synced
 * pad table, the community tables, and the community blob policy. Idempotent.
 * Mirror of sync-core.ts ensureSyncSchema.
 */
// Plan 52: person-identity tables (see PERSON_IDENTITY_SYNC_POLICY in
// meerkat-data.ts). One 'self' row each; the engine injects id=rowId on apply.
const CREATE_PI_PERSON_GROUP = `
CREATE TABLE IF NOT EXISTS pi_person_group (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  doc_json TEXT NOT NULL,
  secret_hex TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`;

const CREATE_PI_PRESENTATION_PROFILE = `
CREATE TABLE IF NOT EXISTS pi_presentation_profile (
  id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL,
  profile_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`;

export function ensureSyncSchema(db: DatabaseAdapter): void {
  createSyncTables(db);
  // Post-DDL upgrades CREATE TABLE IF NOT EXISTS cannot apply on existing installs
  // (e.g. the sync_workspaces workspace_type CHECK gaining 'dm_group', Plan 21 Ph6).
  migrateSyncSchema(db);
  db.execute(CREATE_MP_PAD);
  db.execute(CREATE_PI_PERSON_GROUP);
  db.execute(CREATE_PI_PRESENTATION_PROFILE);
  ensureCommunityTables(db);
  ensureBlobPolicy(db, COMMUNITY_MODULE_ID);
}
