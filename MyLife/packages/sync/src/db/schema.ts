/**
 * DDL constants for all sync_ and torrent_ tables.
 *
 * Follows the hub-schema pattern from @mylife/db:
 * each table gets its own exported constant, plus a combined array.
 */

// ---------------------------------------------------------------------------
// Sync Tables (Personal Sync - Spec Section 8.1)
// ---------------------------------------------------------------------------

export const CREATE_SYNC_DEVICE_IDENTITY = `
CREATE TABLE IF NOT EXISTS sync_device_identity (
  id TEXT PRIMARY KEY NOT NULL CHECK (id = 'self'),
  public_key TEXT NOT NULL,
  private_key_ref TEXT NOT NULL,
  dh_public_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

export const CREATE_SYNC_PAIRED_DEVICES = `
CREATE TABLE IF NOT EXISTS sync_paired_devices (
  device_id TEXT PRIMARY KEY NOT NULL,
  display_name TEXT NOT NULL,
  dh_public_key TEXT NOT NULL,
  shared_secret_ref TEXT NOT NULL,
  last_seen_at TEXT,
  last_sync_at TEXT,
  last_sync_module TEXT,
  bytes_sent INTEGER NOT NULL DEFAULT 0,
  bytes_received INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  auto_connect INTEGER NOT NULL DEFAULT 1,
  paired_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

// Per-peer auto-connect backoff ledger (Plan 29 Phase 0). One row per paired
// peer the auto-connect scheduler has attempted. Timestamps are epoch ms so the
// pure planner can compare against an injected `now`. A `completed` outcome
// resets failure_count to 0 and clears next_attempt_at; a `failed` outcome
// advances the backoff ladder. Foreground and background rounds share this row
// so their backoff cannot drift.
export const CREATE_SYNC_AUTO_CONNECT_STATE = `
CREATE TABLE IF NOT EXISTS sync_auto_connect_state (
  peer_device_id TEXT PRIMARY KEY NOT NULL,
  failure_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER,
  last_attempt_at INTEGER,
  last_result TEXT
);`;

export const CREATE_SYNC_CHANGE_LOG = `
CREATE TABLE IF NOT EXISTS sync_change_log (
  id TEXT PRIMARY KEY NOT NULL,
  module_id TEXT NOT NULL,
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  row_id TEXT NOT NULL,
  data_json TEXT,
  device_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  synced INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

export const CREATE_SYNC_CHANGE_LOG_INDEXES = `
CREATE INDEX IF NOT EXISTS sync_change_log_unsynced_idx
  ON sync_change_log (synced, timestamp ASC);
CREATE INDEX IF NOT EXISTS sync_change_log_module_idx
  ON sync_change_log (module_id, timestamp ASC);`;

export const CREATE_SYNC_PEER_MODULE_STATE = `
CREATE TABLE IF NOT EXISTS sync_peer_module_state (
  device_id TEXT NOT NULL,
  module_id TEXT NOT NULL,
  last_synced_version INTEGER NOT NULL DEFAULT 0,
  last_synced_at TEXT,
  automerge_heads TEXT,
  PRIMARY KEY (device_id, module_id)
);`;

export const CREATE_SYNC_DEVICE_REVOCATIONS = `
CREATE TABLE IF NOT EXISTS sync_device_revocations (
  device_id TEXT PRIMARY KEY NOT NULL,
  revoked_by_device_id TEXT NOT NULL,
  reason TEXT,
  revoked_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

export const CREATE_SYNC_BLOBS = `
CREATE TABLE IF NOT EXISTS sync_blobs (
  hash TEXT PRIMARY KEY NOT NULL,
  size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  module_id TEXT NOT NULL,
  ref_count INTEGER NOT NULL DEFAULT 1,
  stored_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

export const CREATE_SYNC_BLOBS_INDEX = `
CREATE INDEX IF NOT EXISTS sync_blobs_module_idx
  ON sync_blobs (module_id);`;

export const CREATE_SYNC_BLOB_POLICY = `
CREATE TABLE IF NOT EXISTS sync_blob_policy (
  module_id TEXT PRIMARY KEY NOT NULL,
  policy TEXT NOT NULL DEFAULT 'wifi_only'
    CHECK (policy IN ('always', 'wifi_only', 'manual', 'never')),
  max_blob_size_bytes INTEGER DEFAULT 52428800,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

export const CREATE_SYNC_SESSIONS = `
CREATE TABLE IF NOT EXISTS sync_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT,
  peer_device_id TEXT NOT NULL,
  transport TEXT NOT NULL CHECK (transport IN ('lan', 'nearby', 'ble', 'wan_webrtc', 'wan_relay')),
  direction TEXT NOT NULL CHECK (direction IN ('push', 'pull', 'bidirectional')),
  modules_synced TEXT NOT NULL,
  changes_sent INTEGER NOT NULL DEFAULT 0,
  changes_received INTEGER NOT NULL DEFAULT 0,
  bytes_sent INTEGER NOT NULL DEFAULT 0,
  bytes_received INTEGER NOT NULL DEFAULT 0,
  blobs_sent INTEGER NOT NULL DEFAULT 0,
  blobs_received INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('completed', 'partial', 'failed')),
  error TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

// ---------------------------------------------------------------------------
// Mesh Sync Tables (Workspace, ACL, Conflict, Relay - Spec Section 8)
// ---------------------------------------------------------------------------

export const CREATE_SYNC_WORKSPACES = `
CREATE TABLE IF NOT EXISTS sync_workspaces (
  id TEXT PRIMARY KEY NOT NULL,
  display_name TEXT NOT NULL,
  workspace_type TEXT NOT NULL CHECK (workspace_type IN ('personal','group','community','dm_group')) DEFAULT 'personal',
  created_by_device_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  rotated_at TEXT,
  current_key_version INTEGER NOT NULL DEFAULT 1,
  archived_at TEXT
);`;

export const CREATE_SYNC_WORKSPACE_MEMBERS = `
CREATE TABLE IF NOT EXISTS sync_workspace_members (
  workspace_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner','admin','member','viewer')),
  invited_by_device_id TEXT NOT NULL,
  invited_at TEXT NOT NULL DEFAULT (datetime('now')),
  removed_at TEXT,
  PRIMARY KEY (workspace_id, device_id)
);`;

export const CREATE_SYNC_WORKSPACE_KEYS = `
CREATE TABLE IF NOT EXISTS sync_workspace_keys (
  workspace_id TEXT NOT NULL,
  key_version INTEGER NOT NULL,
  wrapped_for_device_id TEXT NOT NULL,
  wrapped_key_blob BLOB NOT NULL,
  valid_from TEXT NOT NULL DEFAULT (datetime('now')),
  valid_until TEXT,
  PRIMARY KEY (workspace_id, key_version, wrapped_for_device_id)
);`;

export const CREATE_SYNC_ENTITY_ACL = `
CREATE TABLE IF NOT EXISTS sync_entity_acl (
  module_id TEXT NOT NULL,
  table_name TEXT NOT NULL,
  row_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('device_local','personal_replica','shared_workspace','published_blob')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (module_id, table_name, row_id)
);`;

export const CREATE_SYNC_TOMBSTONES = `
CREATE TABLE IF NOT EXISTS sync_tombstones (
  module_id TEXT NOT NULL,
  table_name TEXT NOT NULL,
  row_id TEXT NOT NULL,
  deleted_by_device_id TEXT NOT NULL,
  deleted_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (module_id, table_name, row_id)
);`;

export const CREATE_SYNC_RECEIPTS = `
CREATE TABLE IF NOT EXISTS sync_receipts (
  session_id TEXT NOT NULL,
  peer_device_id TEXT NOT NULL,
  module_id TEXT NOT NULL,
  change_id TEXT NOT NULL,
  acknowledged_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (session_id, peer_device_id, change_id)
);`;

export const CREATE_SYNC_CONFLICT_QUEUE = `
CREATE TABLE IF NOT EXISTS sync_conflict_queue (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL,
  module_id TEXT NOT NULL,
  table_name TEXT NOT NULL,
  row_id TEXT NOT NULL,
  local_version_json TEXT NOT NULL,
  remote_version_json TEXT NOT NULL,
  remote_device_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT,
  resolution TEXT CHECK (resolution IN ('local','remote','merged'))
);`;

export const CREATE_SYNC_TRANSPORT_PREFERENCES = `
CREATE TABLE IF NOT EXISTS sync_transport_preferences (
  device_id TEXT NOT NULL,
  layer_id INTEGER NOT NULL CHECK (layer_id BETWEEN 1 AND 5),
  rank INTEGER NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (device_id, layer_id)
);`;

export const CREATE_SYNC_SECURITY_PREFERENCES = `
CREATE TABLE IF NOT EXISTS sync_security_preferences (
  subject_type TEXT NOT NULL CHECK (subject_type IN ('default','workspace','direct')),
  subject_id TEXT NOT NULL,
  encryption_mode TEXT NOT NULL DEFAULT 'required'
    CHECK (encryption_mode IN ('off','opportunistic','required')),
  disappearing_messages_enabled INTEGER NOT NULL DEFAULT 0,
  disappear_after_seconds INTEGER,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (subject_type, subject_id)
);`;

export const CREATE_SYNC_SECURITY_CONFIRMATIONS = `
CREATE TABLE IF NOT EXISTS sync_security_confirmations (
  subject_type TEXT NOT NULL CHECK (subject_type IN ('default','workspace','direct')),
  subject_id TEXT NOT NULL,
  peer_device_id TEXT NOT NULL,
  local_encryption_mode TEXT NOT NULL CHECK (local_encryption_mode IN ('off','opportunistic','required')),
  remote_encryption_mode TEXT NOT NULL CHECK (remote_encryption_mode IN ('off','opportunistic','required')),
  encryption_confirmed INTEGER NOT NULL DEFAULT 0,
  disappearing_messages_confirmed INTEGER NOT NULL DEFAULT 0,
  disappear_after_seconds INTEGER,
  confirmed_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (subject_type, subject_id, peer_device_id)
);`;

export const CREATE_SYNC_EXPIRING_ENTITIES = `
CREATE TABLE IF NOT EXISTS sync_expiring_entities (
  module_id TEXT NOT NULL,
  table_name TEXT NOT NULL,
  row_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  delete_after_sync INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (module_id, table_name, row_id)
);`;

export const CREATE_SYNC_EXPIRING_ENTITIES_INDEX = `
CREATE INDEX IF NOT EXISTS sync_expiring_entities_expires_idx
  ON sync_expiring_entities (expires_at);`;

export const CREATE_SYNC_SESSION_MODULE_STATS = `
CREATE TABLE IF NOT EXISTS sync_session_module_stats (
  session_id TEXT NOT NULL,
  module_id TEXT NOT NULL,
  changes_sent INTEGER NOT NULL DEFAULT 0,
  changes_received INTEGER NOT NULL DEFAULT 0,
  bytes_sent INTEGER NOT NULL DEFAULT 0,
  bytes_received INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (session_id, module_id)
);`;

export const CREATE_SYNC_SHARE_LOG = `
CREATE TABLE IF NOT EXISTS sync_share_log (
  id TEXT PRIMARY KEY NOT NULL,
  from_device_id TEXT NOT NULL,
  to_device_id TEXT NOT NULL,
  module_id TEXT NOT NULL,
  table_name TEXT NOT NULL,
  row_id TEXT NOT NULL,
  data_json TEXT NOT NULL,
  workspace_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending','sent','delivered','failed')) DEFAULT 'pending',
  transport TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  delivered_at TEXT
);`;

export const CREATE_SYNC_RELAY_TOKENS = `
CREATE TABLE IF NOT EXISTS sync_relay_tokens (
  workspace_id TEXT NOT NULL,
  peer_device_id TEXT NOT NULL,
  ephemeral_token TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, peer_device_id)
);`;

// ---------------------------------------------------------------------------
// Torrent Tables (Content Distribution - Spec Section 11.11)
// ---------------------------------------------------------------------------

export const CREATE_TORRENT_PUBLISHED = `
CREATE TABLE IF NOT EXISTS torrent_published (
  info_hash TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  tags_json TEXT NOT NULL DEFAULT '[]',
  access TEXT NOT NULL CHECK (access IN ('public', 'link', 'paid', 'encrypted')),
  price_cents INTEGER,
  currency TEXT DEFAULT 'USD',
  total_size INTEGER NOT NULL,
  piece_length INTEGER NOT NULL,
  pieces_json TEXT NOT NULL,
  merkle_root TEXT NOT NULL,
  files_json TEXT NOT NULL,
  manifest_json TEXT NOT NULL,
  content_key TEXT,
  trackers_json TEXT NOT NULL DEFAULT '["wss://tracker.mylife.app"]',
  web_seeds_json TEXT DEFAULT '[]',
  download_count INTEGER NOT NULL DEFAULT 0,
  revenue_cents INTEGER NOT NULL DEFAULT 0,
  published_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

export const CREATE_TORRENT_DOWNLOADS = `
CREATE TABLE IF NOT EXISTS torrent_downloads (
  info_hash TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  creator_public_key TEXT NOT NULL,
  creator_display_name TEXT,
  total_size INTEGER NOT NULL,
  downloaded_size INTEGER NOT NULL DEFAULT 0,
  piece_count INTEGER NOT NULL,
  pieces_completed INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'downloading'
    CHECK (status IN ('downloading', 'completed', 'paused', 'seeding', 'stopped')),
  manifest_json TEXT NOT NULL,
  content_key TEXT,
  access_token TEXT,
  storage_path TEXT NOT NULL,
  downloaded_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

export const CREATE_TORRENT_SEEDING = `
CREATE TABLE IF NOT EXISTS torrent_seeding (
  info_hash TEXT PRIMARY KEY NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  bytes_uploaded INTEGER NOT NULL DEFAULT 0,
  peers_served INTEGER NOT NULL DEFAULT 0,
  last_upload_at TEXT,
  pin_forever INTEGER NOT NULL DEFAULT 0,
  auto_delete_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

export const CREATE_TORRENT_PIECES = `
CREATE TABLE IF NOT EXISTS torrent_pieces (
  info_hash TEXT NOT NULL,
  piece_index INTEGER NOT NULL,
  hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'missing'
    CHECK (status IN ('missing', 'downloading', 'verified')),
  verified_at TEXT,
  PRIMARY KEY (info_hash, piece_index)
);`;

export const CREATE_TORRENT_PIECES_INDEX = `
CREATE INDEX IF NOT EXISTS torrent_pieces_status_idx
  ON torrent_pieces (info_hash, status);`;

export const CREATE_TORRENT_PEERS = `
CREATE TABLE IF NOT EXISTS torrent_peers (
  info_hash TEXT NOT NULL,
  peer_id TEXT NOT NULL,
  connection_info TEXT,
  is_seeder INTEGER NOT NULL DEFAULT 0,
  bytes_downloaded_from INTEGER NOT NULL DEFAULT 0,
  bytes_uploaded_to INTEGER NOT NULL DEFAULT 0,
  connected_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_active_at TEXT,
  PRIMARY KEY (info_hash, peer_id)
);`;

export const CREATE_TORRENT_PAYMENTS = `
CREATE TABLE IF NOT EXISTS torrent_payments (
  id TEXT PRIMARY KEY NOT NULL,
  info_hash TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_method TEXT NOT NULL,
  payment_provider_id TEXT,
  buyer_public_key TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'refunded', 'failed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

export const CREATE_TORRENT_SEEDING_POLICY = `
CREATE TABLE IF NOT EXISTS torrent_seeding_policy (
  id TEXT PRIMARY KEY NOT NULL CHECK (id = 'config'),
  enabled INTEGER NOT NULL DEFAULT 1,
  max_upload_kbps INTEGER NOT NULL DEFAULT 0,
  max_seed_storage_mb INTEGER NOT NULL DEFAULT 5120,
  auto_delete_days INTEGER NOT NULL DEFAULT 30,
  seed_on_cellular INTEGER NOT NULL DEFAULT 0,
  seed_while_charging INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

/** Audit log of inbound change decisions (MK-002 inbound policy enforcement). */
export const CREATE_SYNC_INBOUND_AUDIT = `
CREATE TABLE IF NOT EXISTS sync_inbound_audit (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT,
  peer_device_id TEXT NOT NULL,
  module_id TEXT,
  table_name TEXT,
  row_id TEXT,
  operation TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN ('accepted','rejected')),
  reason TEXT,
  scope TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

export const CREATE_SYNC_INBOUND_AUDIT_INDEX = `
CREATE INDEX IF NOT EXISTS idx_sync_inbound_audit_peer
  ON sync_inbound_audit (peer_device_id, outcome);`;

/** Trust-on-first-use pinned identities (MK-015): one row per known device. */
export const CREATE_SYNC_PINNED_IDENTITIES = `
CREATE TABLE IF NOT EXISTS sync_pinned_identities (
  device_id TEXT PRIMARY KEY NOT NULL,
  dh_public_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  bundle_json TEXT NOT NULL,
  bundle_signature TEXT NOT NULL,
  first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  key_change_count INTEGER NOT NULL DEFAULT 0
);`;

// SAS (emoji) verifications (MK-017). A row means the user confirmed the
// five-emoji short authentication string matched for this peer at this trust
// boundary (a workspace id, or '' for the personal own-device boundary). The
// engine requires a row before a sensitive module replicates at shared_workspace.
export const CREATE_SYNC_SAS_VERIFICATIONS = `
CREATE TABLE IF NOT EXISTS sync_sas_verifications (
  peer_device_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL DEFAULT '',
  sas_indices TEXT NOT NULL,
  verified_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (peer_device_id, workspace_id)
);`;

// Per-entity content keys (MK-024, D10.5 crypto-shredding). A row whose policy
// demands it (disappearing messages, sensitive entities) encrypts its payload
// under its own random key; destroying the key renders every replica of that
// ciphertext unreadable, which is how erasure works on data that has already
// left the device.
export const CREATE_SYNC_ENTITY_KEYS = `
CREATE TABLE IF NOT EXISTS sync_entity_keys (
  module_id TEXT NOT NULL,
  table_name TEXT NOT NULL,
  row_id TEXT NOT NULL,
  key_hex TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (module_id, table_name, row_id)
);`;

// Blob block staging (MK-027). Received BLOB_DATA blocks persist here until the
// blob completes, so an interrupted transfer resumes from the staged indices
// instead of restarting from block zero.
export const CREATE_SYNC_BLOB_BLOCKS = `
CREATE TABLE IF NOT EXISTS sync_blob_blocks (
  blob_hash TEXT NOT NULL,
  block_index INTEGER NOT NULL,
  total INTEGER NOT NULL,
  data_hex TEXT NOT NULL,
  staged_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (blob_hash, block_index)
);`;

// Signed revocation records (MK-019 gossip). The sync_device_revocations table
// drops the signature; this sidecar keeps the full SignedRevocation so a device
// can FORWARD it over a session (epidemic gossip) -- a revocation reaches every
// member within a gossip round, not just the device that issued it.
export const CREATE_SYNC_REVOCATION_RECORDS = `
CREATE TABLE IF NOT EXISTS sync_revocation_records (
  device_id TEXT PRIMARY KEY NOT NULL,
  signed_json TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

// Signed introduction records (MK-018 gossip). Persist the full
// SignedIntroduction so a member who paired via an admin can FORWARD that
// introduction to other members -- transitive trust propagates the same
// epidemic way revocations do. Keyed by (workspace, introduced subject).
export const CREATE_SYNC_INTRODUCTION_RECORDS = `
CREATE TABLE IF NOT EXISTS sync_introduction_records (
  workspace_id TEXT NOT NULL DEFAULT '',
  subject_device_id TEXT NOT NULL,
  signed_json TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (workspace_id, subject_device_id)
);`;

// Joined communities (MK-030). One row per community this device belongs to:
// the latest signed descriptor (the community IS this document) plus our role.
// Channel/role posting rights are enforced from descriptor_json at apply time.
export const CREATE_SYNC_COMMUNITIES = `
CREATE TABLE IF NOT EXISTS sync_communities (
  community_id TEXT PRIMARY KEY NOT NULL,
  descriptor_json TEXT NOT NULL,
  signature TEXT NOT NULL,
  my_role TEXT,
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

// ---------------------------------------------------------------------------
// Combined DDL Arrays
// ---------------------------------------------------------------------------

/** All sync table DDL in creation order. */
export const SYNC_TABLES = [
  CREATE_SYNC_DEVICE_IDENTITY,
  CREATE_SYNC_PAIRED_DEVICES,
  CREATE_SYNC_CHANGE_LOG,
  CREATE_SYNC_CHANGE_LOG_INDEXES,
  CREATE_SYNC_PEER_MODULE_STATE,
  CREATE_SYNC_DEVICE_REVOCATIONS,
  CREATE_SYNC_BLOBS,
  CREATE_SYNC_BLOBS_INDEX,
  CREATE_SYNC_BLOB_POLICY,
  CREATE_SYNC_SESSIONS,
  CREATE_SYNC_WORKSPACES,
  CREATE_SYNC_WORKSPACE_MEMBERS,
  CREATE_SYNC_WORKSPACE_KEYS,
  CREATE_SYNC_ENTITY_ACL,
  CREATE_SYNC_TOMBSTONES,
  CREATE_SYNC_RECEIPTS,
  CREATE_SYNC_CONFLICT_QUEUE,
  CREATE_SYNC_TRANSPORT_PREFERENCES,
  CREATE_SYNC_SECURITY_PREFERENCES,
  CREATE_SYNC_SECURITY_CONFIRMATIONS,
  CREATE_SYNC_EXPIRING_ENTITIES,
  CREATE_SYNC_EXPIRING_ENTITIES_INDEX,
  CREATE_SYNC_SESSION_MODULE_STATS,
  CREATE_SYNC_RELAY_TOKENS,
  CREATE_SYNC_SHARE_LOG,
  CREATE_SYNC_INBOUND_AUDIT,
  CREATE_SYNC_INBOUND_AUDIT_INDEX,
  CREATE_SYNC_PINNED_IDENTITIES,
  CREATE_SYNC_SAS_VERIFICATIONS,
  CREATE_SYNC_ENTITY_KEYS,
  CREATE_SYNC_BLOB_BLOCKS,
  CREATE_SYNC_COMMUNITIES,
  CREATE_SYNC_REVOCATION_RECORDS,
  CREATE_SYNC_INTRODUCTION_RECORDS,
  CREATE_SYNC_AUTO_CONNECT_STATE,
] as const;

/** All torrent table DDL in creation order. */
export const TORRENT_TABLES = [
  CREATE_TORRENT_PUBLISHED,
  CREATE_TORRENT_DOWNLOADS,
  CREATE_TORRENT_SEEDING,
  CREATE_TORRENT_PIECES,
  CREATE_TORRENT_PIECES_INDEX,
  CREATE_TORRENT_PEERS,
  CREATE_TORRENT_PAYMENTS,
  CREATE_TORRENT_SEEDING_POLICY,
] as const;

/** All DDL for the P2P sync system (sync + torrent). */
export const ALL_P2P_TABLES = [...SYNC_TABLES, ...TORRENT_TABLES] as const;

/**
 * Create all sync and torrent tables. Safe to call multiple times (IF NOT EXISTS).
 *
 * Note: CREATE_SYNC_CHANGE_LOG_INDEXES contains multiple statements separated
 * by semicolons. Some SQLite drivers require executing them individually, so
 * we split on semicolons for multi-statement constants.
 */
export function createSyncTables(db: { execute(sql: string): void }): void {
  for (const ddl of ALL_P2P_TABLES) {
    // Handle multi-statement DDL (e.g., indexes grouped in one constant)
    const statements = ddl
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const stmt of statements) {
      db.execute(stmt);
    }
  }
}

/** Minimal adapter surface the post-DDL migrations need (read + write + transaction). */
type MigratableDb = {
  execute(sql: string, params?: unknown[]): void;
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[];
  transaction(fn: () => void): void;
};

const SYNC_WORKSPACES_MIGRATION_TABLE = 'sync_workspaces__mig_workspace_type';

/**
 * Rebuild sync_workspaces when its workspace_type CHECK predates a newer allowed
 * value ('dm_group', Plan 21 Phase 6). SQLite bakes a CHECK into the table at
 * CREATE time and cannot ALTER it, and CREATE TABLE IF NOT EXISTS is a no-op on an
 * existing table, so an install whose sync_workspaces was created before the value
 * was added would throw a constraint violation on the first INSERT of that type
 * (group DM create fails; a received group commit is swallowed as rejected and the
 * epoch key never lands). No FOREIGN KEY references sync_workspaces, so the
 * standard 12-step rebuild collapses to a safe DROP + RENAME. Idempotent: skips
 * when the live CHECK already lists 'dm_group' (fresh installs + already migrated).
 */
function migrateWorkspaceTypeConstraint(db: MigratableDb): void {
  const rows = db.query<{ sql: string | null }>(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'sync_workspaces'",
  );
  const liveSql = rows[0]?.sql;
  if (!liveSql) return; // table not created yet (createSyncTables runs first)
  if (liveSql.includes("'dm_group'")) return; // CHECK already current

  const rebuildDdl = CREATE_SYNC_WORKSPACES
    .replace('sync_workspaces', SYNC_WORKSPACES_MIGRATION_TABLE)
    .trim();

  db.transaction(() => {
    db.execute(`DROP TABLE IF EXISTS ${SYNC_WORKSPACES_MIGRATION_TABLE}`);
    db.execute(rebuildDdl);
    db.execute(
      `INSERT INTO ${SYNC_WORKSPACES_MIGRATION_TABLE}
         (id, display_name, workspace_type, created_by_device_id, created_at, rotated_at, current_key_version, archived_at)
       SELECT id, display_name, workspace_type, created_by_device_id, created_at, rotated_at, current_key_version, archived_at
       FROM sync_workspaces`,
    );
    db.execute('DROP TABLE sync_workspaces');
    db.execute(`ALTER TABLE ${SYNC_WORKSPACES_MIGRATION_TABLE} RENAME TO sync_workspaces`);
  });
}

/**
 * Add a column to an existing table if it is missing. SQLite cannot ALTER a
 * CHECK/PK, but a plain ADD COLUMN with a constant DEFAULT is safe and cheap.
 * Idempotent: no-ops when the column already exists (fresh installs get it from
 * the CREATE TABLE DDL, so this only fires on upgraded installs).
 */
function ensureSyncColumn(db: MigratableDb, table: string, column: string, definition: string): void {
  const columns = db.query<{ name: string }>(`PRAGMA table_info(${table})`);
  if (columns.length === 0) return; // table not created yet (createSyncTables DDL already has the column)
  if (columns.some((c) => c.name === column)) return;
  db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

/**
 * Post-DDL migrations for installs whose sync_ tables predate a schema change that
 * CREATE TABLE IF NOT EXISTS cannot apply. Idempotent: each step detects whether it
 * already ran and no-ops otherwise. Call right after createSyncTables so both the
 * mobile and web ensureSyncSchema paths (and any other persistent-db consumer) run
 * the same upgrade and cannot drift.
 */
export function migrateSyncSchema(db: MigratableDb): void {
  migrateWorkspaceTypeConstraint(db);
  // Plan 29 Phase 0: auto_connect flag on paired devices (default ON). An
  // upgraded install created sync_paired_devices before this column existed, so
  // add it here; CREATE TABLE IF NOT EXISTS would never add it.
  ensureSyncColumn(db, 'sync_paired_devices', 'auto_connect', 'INTEGER NOT NULL DEFAULT 1');
}
