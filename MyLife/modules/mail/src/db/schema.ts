// MyMail SQLite schema - table prefix: ml_

export const CREATE_MAIL_ACCOUNTS = `
CREATE TABLE IF NOT EXISTS ml_accounts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  server_host TEXT NOT NULL,
  server_port INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_MAIL_MESSAGES = `
CREATE TABLE IF NOT EXISTS ml_messages (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES ml_accounts(id) ON DELETE CASCADE,
  subject TEXT NOT NULL DEFAULT '',
  "from" TEXT NOT NULL,
  "to" TEXT NOT NULL DEFAULT '[]',
  body TEXT NOT NULL DEFAULT '',
  is_read INTEGER NOT NULL DEFAULT 0,
  is_starred INTEGER NOT NULL DEFAULT 0,
  folder TEXT NOT NULL DEFAULT 'Inbox',
  received_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_MAIL_DRAFTS = `
CREATE TABLE IF NOT EXISTS ml_drafts (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES ml_accounts(id) ON DELETE CASCADE,
  subject TEXT NOT NULL DEFAULT '',
  "to" TEXT NOT NULL DEFAULT '[]',
  body TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_MAIL_FOLDERS = `
CREATE TABLE IF NOT EXISTS ml_folders (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES ml_accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_system INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS ml_messages_account_idx ON ml_messages(account_id)`,
  `CREATE INDEX IF NOT EXISTS ml_messages_folder_idx ON ml_messages(folder)`,
  `CREATE INDEX IF NOT EXISTS ml_messages_received_idx ON ml_messages(received_at DESC)`,
  `CREATE INDEX IF NOT EXISTS ml_messages_read_idx ON ml_messages(is_read)`,
  `CREATE INDEX IF NOT EXISTS ml_messages_starred_idx ON ml_messages(is_starred)`,
  `CREATE INDEX IF NOT EXISTS ml_messages_account_folder_idx ON ml_messages(account_id, folder)`,
  `CREATE INDEX IF NOT EXISTS ml_drafts_account_idx ON ml_drafts(account_id)`,
  `CREATE INDEX IF NOT EXISTS ml_folders_account_idx ON ml_folders(account_id)`,
];

export const ALL_TABLES = [
  CREATE_MAIL_ACCOUNTS,
  CREATE_MAIL_MESSAGES,
  CREATE_MAIL_DRAFTS,
  CREATE_MAIL_FOLDERS,
];

// ── V2: B+C Feature Tables ──────────────────────────────────────────

// Attachments
export const CREATE_MAIL_ATTACHMENTS = `
CREATE TABLE IF NOT EXISTS ml_attachments (
  id TEXT PRIMARY KEY,
  message_id TEXT REFERENCES ml_messages(id) ON DELETE CASCADE,
  draft_id TEXT REFERENCES ml_drafts(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  local_path TEXT,
  is_inline INTEGER NOT NULL DEFAULT 0,
  content_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// Filters
export const CREATE_MAIL_FILTERS = `
CREATE TABLE IF NOT EXISTS ml_filters (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES ml_accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  field TEXT NOT NULL CHECK(field IN ('from', 'to', 'subject', 'body')),
  pattern TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('move', 'star', 'mark_read', 'delete')),
  action_value TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// Contacts
export const CREATE_MAIL_CONTACTS = `
CREATE TABLE IF NOT EXISTS ml_contacts (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES ml_accounts(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  company TEXT,
  phone TEXT,
  notes TEXT,
  is_vip INTEGER NOT NULL DEFAULT 0,
  source TEXT DEFAULT 'manual' CHECK(source IN ('manual', 'device', 'auto_created', 'imported')),
  frequency INTEGER NOT NULL DEFAULT 0,
  last_contacted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(account_id, email)
)`;

// Threads
export const CREATE_MAIL_THREADS = `
CREATE TABLE IF NOT EXISTS ml_threads (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES ml_accounts(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  participant_emails TEXT NOT NULL DEFAULT '[]',
  message_count INTEGER NOT NULL DEFAULT 1,
  unread_count INTEGER NOT NULL DEFAULT 0,
  latest_message_at TEXT NOT NULL,
  is_muted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// Calendar events (from email .ics attachments)
export const CREATE_MAIL_CALENDAR_EVENTS = `
CREATE TABLE IF NOT EXISTS ml_calendar_events (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES ml_messages(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES ml_accounts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  organizer TEXT,
  attendees TEXT DEFAULT '[]',
  ics_uid TEXT,
  rsvp_status TEXT DEFAULT 'pending' CHECK(rsvp_status IN ('pending', 'accepted', 'declined', 'tentative')),
  is_all_day INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// Notification preferences
export const CREATE_MAIL_NOTIFICATION_PREFERENCES = `
CREATE TABLE IF NOT EXISTS ml_notification_preferences (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES ml_accounts(id) ON DELETE CASCADE,
  enabled INTEGER NOT NULL DEFAULT 1,
  quiet_start TEXT,
  quiet_end TEXT,
  vip_only INTEGER NOT NULL DEFAULT 0,
  show_preview INTEGER NOT NULL DEFAULT 1,
  sound TEXT DEFAULT 'default',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(account_id)
)`;

// Encryption keys
export const CREATE_MAIL_ENCRYPTION_KEYS = `
CREATE TABLE IF NOT EXISTS ml_encryption_keys (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES ml_accounts(id) ON DELETE CASCADE,
  key_type TEXT NOT NULL CHECK(key_type IN ('rsa', 'x25519', 'pgp')),
  public_key TEXT NOT NULL,
  private_key_encrypted TEXT,
  fingerprint TEXT NOT NULL,
  contact_email TEXT,
  is_own_key INTEGER NOT NULL DEFAULT 0,
  is_revoked INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// IMAP sync state
export const CREATE_MAIL_SYNC_STATE = `
CREATE TABLE IF NOT EXISTS ml_sync_state (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES ml_accounts(id) ON DELETE CASCADE,
  folder TEXT NOT NULL,
  last_uid TEXT,
  last_sync_at TEXT,
  uidvalidity TEXT,
  status TEXT DEFAULT 'idle' CHECK(status IN ('idle', 'syncing', 'error')),
  error_message TEXT,
  UNIQUE(account_id, folder)
)`;

// V2 ALTER statements for existing tables
export const V2_ALTER_ACCOUNTS = [
  `ALTER TABLE ml_accounts ADD COLUMN imap_host TEXT`,
  `ALTER TABLE ml_accounts ADD COLUMN imap_port INTEGER DEFAULT 993`,
  `ALTER TABLE ml_accounts ADD COLUMN imap_security TEXT DEFAULT 'ssl'`,
  `ALTER TABLE ml_accounts ADD COLUMN smtp_host TEXT`,
  `ALTER TABLE ml_accounts ADD COLUMN smtp_port INTEGER DEFAULT 587`,
  `ALTER TABLE ml_accounts ADD COLUMN smtp_security TEXT DEFAULT 'starttls'`,
  `ALTER TABLE ml_accounts ADD COLUMN auth_method TEXT DEFAULT 'password'`,
  `ALTER TABLE ml_accounts ADD COLUMN color TEXT DEFAULT '#3B82F6'`,
  `ALTER TABLE ml_accounts ADD COLUMN sort_order INTEGER DEFAULT 0`,
  `ALTER TABLE ml_accounts ADD COLUMN is_default INTEGER DEFAULT 0`,
];

export const V2_ALTER_MESSAGES = [
  `ALTER TABLE ml_messages ADD COLUMN server_uid TEXT`,
  `ALTER TABLE ml_messages ADD COLUMN message_id_header TEXT`,
  `ALTER TABLE ml_messages ADD COLUMN in_reply_to TEXT`,
  `ALTER TABLE ml_messages ADD COLUMN "references" TEXT DEFAULT '[]'`,
  `ALTER TABLE ml_messages ADD COLUMN thread_id TEXT REFERENCES ml_threads(id) ON DELETE SET NULL`,
  `ALTER TABLE ml_messages ADD COLUMN is_encrypted INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE ml_messages ADD COLUMN encryption_status TEXT DEFAULT 'none'`,
  `ALTER TABLE ml_messages ADD COLUMN has_attachments INTEGER NOT NULL DEFAULT 0`,
];

export const V2_TABLES = [
  CREATE_MAIL_ATTACHMENTS,
  CREATE_MAIL_FILTERS,
  CREATE_MAIL_CONTACTS,
  CREATE_MAIL_THREADS,
  CREATE_MAIL_CALENDAR_EVENTS,
  CREATE_MAIL_NOTIFICATION_PREFERENCES,
  CREATE_MAIL_ENCRYPTION_KEYS,
  CREATE_MAIL_SYNC_STATE,
];

export const V2_INDEXES = [
  // Attachments
  `CREATE INDEX IF NOT EXISTS ml_attachments_message_idx ON ml_attachments(message_id)`,
  `CREATE INDEX IF NOT EXISTS ml_attachments_draft_idx ON ml_attachments(draft_id)`,
  // Filters
  `CREATE INDEX IF NOT EXISTS ml_filters_account_idx ON ml_filters(account_id)`,
  `CREATE INDEX IF NOT EXISTS ml_filters_active_idx ON ml_filters(is_active)`,
  // Contacts
  `CREATE INDEX IF NOT EXISTS ml_contacts_account_idx ON ml_contacts(account_id)`,
  `CREATE INDEX IF NOT EXISTS ml_contacts_email_idx ON ml_contacts(email)`,
  `CREATE INDEX IF NOT EXISTS ml_contacts_vip_idx ON ml_contacts(is_vip)`,
  `CREATE INDEX IF NOT EXISTS ml_contacts_frequency_idx ON ml_contacts(frequency DESC)`,
  // Threads
  `CREATE INDEX IF NOT EXISTS ml_threads_account_idx ON ml_threads(account_id)`,
  `CREATE INDEX IF NOT EXISTS ml_threads_latest_idx ON ml_threads(latest_message_at DESC)`,
  `CREATE INDEX IF NOT EXISTS ml_messages_thread_idx ON ml_messages(thread_id)`,
  `CREATE INDEX IF NOT EXISTS ml_messages_message_id_idx ON ml_messages(message_id_header)`,
  // Calendar events
  `CREATE INDEX IF NOT EXISTS ml_calendar_events_message_idx ON ml_calendar_events(message_id)`,
  `CREATE INDEX IF NOT EXISTS ml_calendar_events_account_idx ON ml_calendar_events(account_id)`,
  `CREATE INDEX IF NOT EXISTS ml_calendar_events_start_idx ON ml_calendar_events(start_time)`,
  // Encryption keys
  `CREATE INDEX IF NOT EXISTS ml_encryption_keys_account_idx ON ml_encryption_keys(account_id)`,
  `CREATE INDEX IF NOT EXISTS ml_encryption_keys_fingerprint_idx ON ml_encryption_keys(fingerprint)`,
  `CREATE INDEX IF NOT EXISTS ml_encryption_keys_contact_idx ON ml_encryption_keys(contact_email)`,
  // Sync state
  `CREATE INDEX IF NOT EXISTS ml_sync_state_account_idx ON ml_sync_state(account_id)`,
  // Multiple accounts
  `CREATE UNIQUE INDEX IF NOT EXISTS ml_messages_server_uid_idx ON ml_messages(account_id, server_uid)`,
];
