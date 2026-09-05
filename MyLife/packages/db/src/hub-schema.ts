/**
 * Hub-level SQLite schema.
 *
 * These tables are always created in the hub database and manage
 * module enablement, user preferences, subscription state,
 * per-module schema versioning, and backup metadata.
 */

import { BACKUP_TABLES } from './backup/schema';

export const CREATE_HUB_ENABLED_MODULES = `
CREATE TABLE IF NOT EXISTS hub_enabled_modules (
  module_id TEXT PRIMARY KEY NOT NULL,
  enabled_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

export const CREATE_HUB_PREFERENCES = `
CREATE TABLE IF NOT EXISTS hub_preferences (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);`;

export const CREATE_HUB_SETTINGS = `
CREATE TABLE IF NOT EXISTS hub_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);`;

export const CREATE_HUB_AGGREGATE_EVENT_COUNTERS = `
CREATE TABLE IF NOT EXISTS hub_aggregate_event_counters (
  event_key TEXT NOT NULL,
  bucket_date TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (event_key, bucket_date)
);`;

export const CREATE_HUB_SUBSCRIPTION = `
CREATE TABLE IF NOT EXISTS hub_subscription (
  id TEXT PRIMARY KEY NOT NULL,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'premium')),
  provider TEXT CHECK (provider IN ('revenueCat', 'stripe')),
  external_id TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

export const CREATE_HUB_MODE = `
CREATE TABLE IF NOT EXISTS hub_mode (
  id TEXT PRIMARY KEY NOT NULL CHECK (id = 'current'),
  mode TEXT NOT NULL CHECK (mode IN ('hosted', 'self_host', 'local_only')),
  server_url TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

export const CREATE_HUB_ENTITLEMENTS = `
CREATE TABLE IF NOT EXISTS hub_entitlements (
  id TEXT PRIMARY KEY NOT NULL CHECK (id = 'current'),
  raw_token TEXT NOT NULL,
  app_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('hosted', 'self_host', 'local_only')),
  hosted_active INTEGER NOT NULL DEFAULT 0,
  self_host_license INTEGER NOT NULL DEFAULT 0,
  update_pack_year INTEGER,
  features_json TEXT NOT NULL DEFAULT '[]',
  issued_at TEXT NOT NULL,
  expires_at TEXT,
  signature TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

export const CREATE_HUB_FRIEND_PROFILES = `
CREATE TABLE IF NOT EXISTS hub_friend_profiles (
  user_id TEXT PRIMARY KEY NOT NULL,
  display_name TEXT NOT NULL,
  handle TEXT,
  avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

export const CREATE_HUB_FRIEND_INVITES = `
CREATE TABLE IF NOT EXISTS hub_friend_invites (
  id TEXT PRIMARY KEY NOT NULL,
  from_user_id TEXT NOT NULL,
  to_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'revoked', 'declined')),
  message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  responded_at TEXT
);`;

export const CREATE_HUB_FRIENDSHIPS = `
CREATE TABLE IF NOT EXISTS hub_friendships (
  user_id TEXT NOT NULL,
  friend_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'accepted'
    CHECK (status IN ('accepted', 'blocked')),
  source_invite_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, friend_user_id)
);`;

export const CREATE_HUB_FRIEND_MESSAGES = `
CREATE TABLE IF NOT EXISTS hub_friend_messages (
  id TEXT PRIMARY KEY NOT NULL,
  client_message_id TEXT UNIQUE NOT NULL,
  sender_user_id TEXT NOT NULL,
  recipient_user_id TEXT NOT NULL,
  content_type TEXT NOT NULL
    CHECK (content_type IN ('text/plain', 'application/e2ee+ciphertext')),
  content TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'local'
    CHECK (source IN ('local', 'remote')),
  sync_state TEXT NOT NULL DEFAULT 'pending'
    CHECK (sync_state IN ('pending', 'synced', 'failed')),
  server_message_id TEXT,
  created_at TEXT NOT NULL,
  read_at TEXT,
  last_error TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (sender_user_id <> recipient_user_id)
);`;

export const CREATE_HUB_FRIEND_MESSAGE_OUTBOX = `
CREATE TABLE IF NOT EXISTS hub_friend_message_outbox (
  client_message_id TEXT PRIMARY KEY NOT NULL,
  from_user_id TEXT NOT NULL,
  to_user_id TEXT NOT NULL,
  content_type TEXT NOT NULL
    CHECK (content_type IN ('text/plain', 'application/e2ee+ciphertext')),
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'retry', 'failed', 'sent')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (from_user_id <> to_user_id)
);`;

export const CREATE_HUB_FRIEND_INDEXES = [
  `CREATE INDEX IF NOT EXISTS hub_friend_invites_to_status_idx
     ON hub_friend_invites (to_user_id, status, created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS hub_friend_invites_from_status_idx
     ON hub_friend_invites (from_user_id, status, created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS hub_friendships_user_status_idx
     ON hub_friendships (user_id, status, created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS hub_friend_messages_conversation_idx
     ON hub_friend_messages (sender_user_id, recipient_user_id, created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS hub_friend_messages_recipient_unread_idx
     ON hub_friend_messages (recipient_user_id, read_at, created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS hub_friend_messages_sync_state_idx
     ON hub_friend_messages (sync_state, created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS hub_friend_message_outbox_schedule_idx
     ON hub_friend_message_outbox (status, next_attempt_at ASC);`,
] as const;

export const CREATE_HUB_REVOKED_ENTITLEMENTS = `
CREATE TABLE IF NOT EXISTS hub_revoked_entitlements (
  signature TEXT PRIMARY KEY NOT NULL,
  reason TEXT,
  source_event_id TEXT,
  revoked_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

export const CREATE_HUB_HUMAN_VERIFICATION = `
CREATE TABLE IF NOT EXISTS hub_human_verification (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  verified_at TEXT NOT NULL DEFAULT (datetime('now')),
  method TEXT NOT NULL CHECK (method IN ('faceid', 'touchid', 'biometric', 'passkey')),
  device_attestation TEXT,
  revoked_at TEXT
);`;

export const CREATE_HUB_HUMAN_VERIFICATION_INDEX = `
CREATE INDEX IF NOT EXISTS hub_human_verification_user_idx
  ON hub_human_verification (user_id, revoked_at, verified_at DESC);`;

export const CREATE_HUB_SHARING_PREFERENCES = `
CREATE TABLE IF NOT EXISTS hub_sharing_preferences (
  id TEXT PRIMARY KEY NOT NULL,
  module_id TEXT NOT NULL,
  data_type TEXT NOT NULL,
  shared INTEGER NOT NULL DEFAULT 0,
  anonymized INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (module_id, data_type)
);`;

export const CREATE_HUB_SHARING_PREFERENCES_INDEX = `
CREATE INDEX IF NOT EXISTS hub_sharing_preferences_module_idx
  ON hub_sharing_preferences (module_id, shared);`;

export const CREATE_HUB_SHARING_CONSENT = `
CREATE TABLE IF NOT EXISTS hub_sharing_consent (
  id TEXT PRIMARY KEY NOT NULL CHECK (id = 'current'),
  consented INTEGER NOT NULL DEFAULT 0,
  consented_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

export const CREATE_HUB_DASHBOARD_LAYOUT = `
CREATE TABLE IF NOT EXISTS hub_dashboard_layout (
  module_id TEXT PRIMARY KEY NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  visible INTEGER NOT NULL DEFAULT 1 CHECK (visible IN (0, 1)),
  card_size TEXT NOT NULL DEFAULT 'standard' CHECK (card_size IN ('standard', 'compact')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

export const CREATE_HUB_DASHBOARD_LAYOUT_INDEX = `
CREATE INDEX IF NOT EXISTS hub_dashboard_layout_position_idx
  ON hub_dashboard_layout (visible, position ASC);`;

export const CREATE_HUB_ONBOARDING = `
CREATE TABLE IF NOT EXISTS hub_onboarding (
  id TEXT PRIMARY KEY NOT NULL,
  current_step TEXT NOT NULL DEFAULT 'WELCOME',
  completed_steps TEXT NOT NULL DEFAULT '[]',
  content_prefs TEXT NOT NULL DEFAULT '{}',
  selected_modules TEXT NOT NULL DEFAULT '[]',
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

export const CREATE_HUB_HEALTH_CONSENT = `
CREATE TABLE IF NOT EXISTS hub_health_consent (
  module_id TEXT PRIMARY KEY NOT NULL,
  data_types TEXT NOT NULL DEFAULT '[]',
  consented_at TEXT NOT NULL DEFAULT (datetime('now')),
  withdrawn_at TEXT
);`;

export const CREATE_HUB_MODULE_LOCKS = `
CREATE TABLE IF NOT EXISTS hub_module_locks (
  module_id TEXT PRIMARY KEY NOT NULL,
  pin_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'pin' CHECK (method IN ('pin', 'biometric', 'biometricWithPin')),
  lock_timeout_seconds INTEGER NOT NULL DEFAULT 0,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

export const CREATE_HUB_SCHEDULED_NOTIFICATIONS = `
CREATE TABLE IF NOT EXISTS hub_scheduled_notifications (
  id TEXT PRIMARY KEY NOT NULL,
  module_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  trigger_at TEXT NOT NULL,
  timezone TEXT NOT NULL,
  repeat_interval TEXT NOT NULL DEFAULT 'none'
    CHECK (repeat_interval IN ('none', 'daily', 'weekly', 'monthly')),
  platform_notification_id TEXT,
  data_json TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'cancelled', 'fired')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

export const CREATE_HUB_SCHEDULED_NOTIFICATIONS_INDEXES = [
  `CREATE INDEX IF NOT EXISTS hub_scheduled_notifications_module_status_idx
     ON hub_scheduled_notifications (module_id, status, trigger_at ASC);`,
  `CREATE INDEX IF NOT EXISTS hub_scheduled_notifications_status_trigger_idx
     ON hub_scheduled_notifications (status, trigger_at ASC);`,
] as const;

export const CREATE_HUB_NOTIFICATION_PREFERENCES = `
CREATE TABLE IF NOT EXISTS hub_notification_preferences (
  module_id TEXT PRIMARY KEY NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

export const CREATE_HUB_ENTITLEMENT_CACHE = `
CREATE TABLE IF NOT EXISTS hub_entitlement_cache (
  module_id TEXT NOT NULL,
  entitled INTEGER NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('revenuecat', 'stripe', 'free')),
  cached_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT,
  PRIMARY KEY (module_id)
);`;

export const CREATE_HUB_SCHEMA_VERSIONS = `
CREATE TABLE IF NOT EXISTS hub_schema_versions (
  module_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (module_id, version)
);`;

// ---------------------------------------------------------------------------
// Phase 1a: shared data layer tables.
// Spec: docs/plans/consolidation/01-shared-data-layer.md
// These are additive, cross-module hub tables (attachments, tags, reminders,
// goals, people, body metrics, places, GPS tracks, events, foods, books,
// cost events, timeline). Schema-only in this phase; module adapters arrive
// in later waves per the spec's wave schedule (A/B/C/D).
// ---------------------------------------------------------------------------

export const CREATE_HUB_ATTACHMENTS = `
CREATE TABLE IF NOT EXISTS hub_attachments (
  id TEXT PRIMARY KEY NOT NULL,
  uri TEXT NOT NULL,
  mime TEXT NOT NULL,
  sha256 TEXT,
  bytes INTEGER,
  thumb_uri TEXT,
  caption TEXT,
  taken_at TEXT,
  lat REAL,
  lng REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

export const CREATE_HUB_ATTACHMENT_LINKS = `
CREATE TABLE IF NOT EXISTS hub_attachment_links (
  attachment_id TEXT NOT NULL,
  module_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  role TEXT,
  linked_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (attachment_id, module_id, entity_type, entity_id),
  FOREIGN KEY (attachment_id) REFERENCES hub_attachments(id) ON DELETE CASCADE
);`;

export const CREATE_HUB_ATTACHMENT_LINKS_ENTITY_IDX = `
CREATE INDEX IF NOT EXISTS hub_attachment_links_entity_idx
  ON hub_attachment_links(module_id, entity_type, entity_id);`;

export const CREATE_HUB_TAGS = `
CREATE TABLE IF NOT EXISTS hub_tags (
  id TEXT PRIMARY KEY NOT NULL,
  label TEXT NOT NULL UNIQUE,
  color TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

export const CREATE_HUB_TAG_BINDINGS = `
CREATE TABLE IF NOT EXISTS hub_tag_bindings (
  tag_id TEXT NOT NULL,
  module_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  bound_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (tag_id, module_id, entity_type, entity_id),
  FOREIGN KEY (tag_id) REFERENCES hub_tags(id) ON DELETE CASCADE
);`;

export const CREATE_HUB_REMINDERS = `
CREATE TABLE IF NOT EXISTS hub_reminders (
  id TEXT PRIMARY KEY NOT NULL,
  module_id TEXT NOT NULL,
  entity_ref TEXT,
  title TEXT NOT NULL,
  body TEXT,
  trigger_rule TEXT NOT NULL,
  next_fire_at TEXT NOT NULL,
  last_fired_at TEXT,
  location_id TEXT,
  radius_m INTEGER,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

export const CREATE_HUB_REMINDERS_FIRE_IDX = `
CREATE INDEX IF NOT EXISTS hub_reminders_fire_idx
  ON hub_reminders(active, next_fire_at);`;

export const CREATE_HUB_GOALS = `
CREATE TABLE IF NOT EXISTS hub_goals (
  id TEXT PRIMARY KEY NOT NULL,
  module_id TEXT NOT NULL,
  title TEXT NOT NULL,
  target_value REAL,
  unit TEXT,
  period TEXT,
  starts_at TEXT,
  due_at TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'completed', 'abandoned')),
  entity_ref TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

export const CREATE_HUB_GOAL_PROGRESS = `
CREATE TABLE IF NOT EXISTS hub_goal_progress (
  goal_id TEXT NOT NULL,
  at TEXT NOT NULL,
  value REAL NOT NULL,
  PRIMARY KEY (goal_id, at),
  FOREIGN KEY (goal_id) REFERENCES hub_goals(id) ON DELETE CASCADE
);`;

export const CREATE_HUB_PEOPLE = `
CREATE TABLE IF NOT EXISTS hub_people (
  id TEXT PRIMARY KEY NOT NULL,
  display_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  avatar_attachment_id TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (avatar_attachment_id) REFERENCES hub_attachments(id)
);`;

export const CREATE_HUB_PERSON_MODULE_ROLES = `
CREATE TABLE IF NOT EXISTS hub_person_module_roles (
  person_id TEXT NOT NULL,
  module_id TEXT NOT NULL,
  role TEXT NOT NULL,
  entity_ref TEXT NOT NULL DEFAULT '',
  added_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (person_id, module_id, role, entity_ref),
  FOREIGN KEY (person_id) REFERENCES hub_people(id) ON DELETE CASCADE
);`;

export const CREATE_HUB_BODY_METRICS = `
CREATE TABLE IF NOT EXISTS hub_body_metrics (
  id TEXT PRIMARY KEY NOT NULL,
  subject_type TEXT NOT NULL DEFAULT 'self'
    CHECK (subject_type IN ('self', 'pet')),
  subject_id TEXT,
  metric TEXT NOT NULL,
  value REAL NOT NULL,
  unit TEXT NOT NULL,
  source TEXT NOT NULL,
  module_origin TEXT NOT NULL,
  at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

export const CREATE_HUB_BODY_METRICS_IDX = `
CREATE INDEX IF NOT EXISTS hub_body_metrics_at_idx
  ON hub_body_metrics(subject_type, subject_id, metric, at DESC);`;

export const CREATE_HUB_PLACES = `
CREATE TABLE IF NOT EXISTS hub_places (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  geohash TEXT,
  address_json TEXT,
  module_origin TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

export const CREATE_HUB_PLACES_GEO_IDX = `
CREATE INDEX IF NOT EXISTS hub_places_geo_idx ON hub_places(geohash);`;

export const CREATE_HUB_GPS_TRACKS = `
CREATE TABLE IF NOT EXISTS hub_gps_tracks (
  id TEXT PRIMARY KEY NOT NULL,
  module_id TEXT NOT NULL,
  entity_ref TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  distance_m REAL,
  polyline TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

export const CREATE_HUB_EVENTS = `
CREATE TABLE IF NOT EXISTS hub_events (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT,
  kind TEXT NOT NULL,
  module_id TEXT NOT NULL,
  entity_ref TEXT,
  place_id TEXT,
  rrule TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (place_id) REFERENCES hub_places(id)
);`;

export const CREATE_HUB_EVENTS_RANGE_IDX = `
CREATE INDEX IF NOT EXISTS hub_events_range_idx ON hub_events(starts_at);`;

export const CREATE_HUB_FOODS = `
CREATE TABLE IF NOT EXISTS hub_foods (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  brand TEXT,
  barcode TEXT UNIQUE,
  nutrients_json TEXT NOT NULL,
  source TEXT NOT NULL,
  verified INTEGER NOT NULL DEFAULT 0 CHECK (verified IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

export const CREATE_HUB_BOOKS = `
CREATE TABLE IF NOT EXISTS hub_books (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  isbn TEXT UNIQUE,
  ol_id TEXT,
  cover_attachment_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (cover_attachment_id) REFERENCES hub_attachments(id)
);`;

export const CREATE_HUB_COST_EVENTS = `
CREATE TABLE IF NOT EXISTS hub_cost_events (
  id TEXT PRIMARY KEY NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  payee TEXT,
  at TEXT NOT NULL,
  budget_txn_id TEXT,
  module_id TEXT NOT NULL,
  entity_ref TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

export const CREATE_HUB_COST_EVENTS_AT_IDX = `
CREATE INDEX IF NOT EXISTS hub_cost_events_at_idx ON hub_cost_events(at DESC);`;

export const CREATE_HUB_TIMELINE = `
CREATE TABLE IF NOT EXISTS hub_timeline (
  id TEXT PRIMARY KEY NOT NULL,
  module_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  summary TEXT NOT NULL,
  payload_json TEXT
);`;

export const CREATE_HUB_TIMELINE_AT_IDX = `
CREATE INDEX IF NOT EXISTS hub_timeline_at_idx ON hub_timeline(occurred_at DESC);`;

export const CREATE_HUB_TIMELINE_MOD_IDX = `
CREATE INDEX IF NOT EXISTS hub_timeline_mod_idx ON hub_timeline(module_id, occurred_at DESC);`;

// ---------------------------------------------------------------------------
// Phase 1a (AI permissions scaffolding).
// Spec: docs/plans/consolidation/05-ai-agent-layer.md
// Reserved for Phase 4 wiring. No hub or module code reads these tables yet;
// they exist so later waves can enforce AI tool-use permissions and audit
// logging without a second migration hop.
// ---------------------------------------------------------------------------

export const CREATE_HUB_AI_PERMISSIONS = `
CREATE TABLE IF NOT EXISTS hub_ai_permissions (
  user_id TEXT NOT NULL,
  module_id TEXT NOT NULL,
  can_read INTEGER NOT NULL DEFAULT 0 CHECK (can_read IN (0, 1)),
  can_write INTEGER NOT NULL DEFAULT 0 CHECK (can_write IN (0, 1)),
  granular_mode INTEGER NOT NULL DEFAULT 0 CHECK (granular_mode IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, module_id)
);`;

export const CREATE_HUB_AI_TABLE_PERMISSIONS = `
CREATE TABLE IF NOT EXISTS hub_ai_table_permissions (
  user_id TEXT NOT NULL,
  module_id TEXT NOT NULL,
  table_name TEXT NOT NULL,
  can_read INTEGER NOT NULL DEFAULT 0 CHECK (can_read IN (0, 1)),
  can_write INTEGER NOT NULL DEFAULT 0 CHECK (can_write IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, module_id, table_name)
);`;

export const CREATE_HUB_AI_AUDIT_LOG = `
CREATE TABLE IF NOT EXISTS hub_ai_audit_log (
  id TEXT PRIMARY KEY NOT NULL,
  at TEXT NOT NULL DEFAULT (datetime('now')),
  provider TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  module_id TEXT,
  action TEXT NOT NULL CHECK (action IN ('read', 'write', 'schedule', 'message')),
  outcome TEXT NOT NULL CHECK (outcome IN ('allowed', 'denied', 'user_cancelled')),
  payload_sha256 TEXT
);`;

export const CREATE_HUB_AI_AUDIT_LOG_AT_IDX = `
CREATE INDEX IF NOT EXISTS hub_ai_audit_log_at_idx ON hub_ai_audit_log(at DESC);`;

// ---------------------------------------------------------------------------
// Phase 5-core: automation rule engine tables.
// Spec: docs/plans/consolidation/06-automation-shortcuts.md
// Handoff: docs/plans/consolidation/phase-5-core-handoff.md
// Schema-only in this track; engine + rule wiring arrive in Tracks A/C.
// ---------------------------------------------------------------------------

export const CREATE_HUB_AUTOMATION_RULES = `
CREATE TABLE IF NOT EXISTS hub_automation_rules (
  id TEXT PRIMARY KEY NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  last_fired_at TEXT,
  fire_count INTEGER NOT NULL DEFAULT 0 CHECK (fire_count >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

export const CREATE_HUB_AUTOMATION_LOG = `
CREATE TABLE IF NOT EXISTS hub_automation_log (
  id TEXT PRIMARY KEY NOT NULL,
  rule_id TEXT NOT NULL,
  at TEXT NOT NULL DEFAULT (datetime('now')),
  outcome TEXT NOT NULL CHECK (outcome IN ('applied', 'dismissed', 'error')),
  payload_sha256 TEXT,
  error TEXT
);`;

export const CREATE_HUB_AUTOMATION_LOG_INDEX = `
CREATE INDEX IF NOT EXISTS hub_automation_log_rule_at_idx
  ON hub_automation_log (rule_id, at DESC);`;

// ---------------------------------------------------------------------------
// Theme Profiles (Phase 0): user + built-in + AI-generated theme storage.
// Active theme id and theme settings live in hub_settings as key-value pairs.
// ---------------------------------------------------------------------------

export const CREATE_HUB_THEME_PROFILES = `
CREATE TABLE IF NOT EXISTS hub_theme_profiles (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  json TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'user'
    CHECK (source IN ('user', 'imported', 'ai-generated')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

/**
 * All hub DDL statements in creation order.
 */
export const HUB_TABLES = [
  CREATE_HUB_ENABLED_MODULES,
  CREATE_HUB_PREFERENCES,
  CREATE_HUB_SETTINGS,
  CREATE_HUB_AGGREGATE_EVENT_COUNTERS,
  CREATE_HUB_SUBSCRIPTION,
  CREATE_HUB_MODE,
  CREATE_HUB_ENTITLEMENTS,
  CREATE_HUB_FRIEND_PROFILES,
  CREATE_HUB_FRIEND_INVITES,
  CREATE_HUB_FRIENDSHIPS,
  CREATE_HUB_FRIEND_MESSAGES,
  CREATE_HUB_FRIEND_MESSAGE_OUTBOX,
  ...CREATE_HUB_FRIEND_INDEXES,
  CREATE_HUB_REVOKED_ENTITLEMENTS,
  CREATE_HUB_HUMAN_VERIFICATION,
  CREATE_HUB_HUMAN_VERIFICATION_INDEX,
  CREATE_HUB_SHARING_PREFERENCES,
  CREATE_HUB_SHARING_PREFERENCES_INDEX,
  CREATE_HUB_SHARING_CONSENT,
  CREATE_HUB_DASHBOARD_LAYOUT,
  CREATE_HUB_DASHBOARD_LAYOUT_INDEX,
  CREATE_HUB_ONBOARDING,
  CREATE_HUB_HEALTH_CONSENT,
  CREATE_HUB_MODULE_LOCKS,
  CREATE_HUB_SCHEDULED_NOTIFICATIONS,
  ...CREATE_HUB_SCHEDULED_NOTIFICATIONS_INDEXES,
  CREATE_HUB_NOTIFICATION_PREFERENCES,
  CREATE_HUB_ENTITLEMENT_CACHE,
  CREATE_HUB_SCHEMA_VERSIONS,
  // Phase 1a: shared data layer (FK-ordered: parents before children).
  CREATE_HUB_ATTACHMENTS,
  CREATE_HUB_ATTACHMENT_LINKS,
  CREATE_HUB_ATTACHMENT_LINKS_ENTITY_IDX,
  CREATE_HUB_TAGS,
  CREATE_HUB_TAG_BINDINGS,
  CREATE_HUB_REMINDERS,
  CREATE_HUB_REMINDERS_FIRE_IDX,
  CREATE_HUB_GOALS,
  CREATE_HUB_GOAL_PROGRESS,
  CREATE_HUB_PEOPLE,
  CREATE_HUB_PERSON_MODULE_ROLES,
  CREATE_HUB_BODY_METRICS,
  CREATE_HUB_BODY_METRICS_IDX,
  CREATE_HUB_PLACES,
  CREATE_HUB_PLACES_GEO_IDX,
  CREATE_HUB_GPS_TRACKS,
  CREATE_HUB_EVENTS,
  CREATE_HUB_EVENTS_RANGE_IDX,
  CREATE_HUB_FOODS,
  CREATE_HUB_BOOKS,
  CREATE_HUB_COST_EVENTS,
  CREATE_HUB_COST_EVENTS_AT_IDX,
  CREATE_HUB_TIMELINE,
  CREATE_HUB_TIMELINE_AT_IDX,
  CREATE_HUB_TIMELINE_MOD_IDX,
  // Phase 1a: AI permissions scaffolding (no readers yet; reserved for Phase 4).
  CREATE_HUB_AI_PERMISSIONS,
  CREATE_HUB_AI_TABLE_PERMISSIONS,
  CREATE_HUB_AI_AUDIT_LOG,
  CREATE_HUB_AI_AUDIT_LOG_AT_IDX,
  // Phase 5-core: automation rule engine tables (no FKs).
  CREATE_HUB_AUTOMATION_RULES,
  CREATE_HUB_AUTOMATION_LOG,
  CREATE_HUB_AUTOMATION_LOG_INDEX,
  // Theme Profiles (Phase 0).
  CREATE_HUB_THEME_PROFILES,
  ...BACKUP_TABLES,
] as const;

/**
 * Initialize hub tables. Safe to call multiple times (uses IF NOT EXISTS).
 */
export function createHubTables(db: { execute(sql: string): void }): void {
  for (const ddl of HUB_TABLES) {
    db.execute(ddl);
  }
}
