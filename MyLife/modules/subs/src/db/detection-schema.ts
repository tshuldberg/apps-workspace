// MySubs V2 schema - bank sync detection tables (prefix: sb_)

export const CREATE_DETECTED_SUBSCRIPTIONS = `
CREATE TABLE IF NOT EXISTS sb_detected_subscriptions (
  id TEXT PRIMARY KEY,
  payee TEXT NOT NULL,
  normalized_payee TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  frequency TEXT NOT NULL
    CHECK (frequency IN ('weekly', 'monthly', 'annual')),
  confidence REAL NOT NULL DEFAULT 0,
  matched_catalog_id TEXT,
  transaction_dates TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'dismissed')),
  accepted_subscription_id TEXT REFERENCES sb_subscriptions(id) ON DELETE SET NULL,
  bank_connection_id TEXT,
  detected_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_DISMISSED_PAYEES = `
CREATE TABLE IF NOT EXISTS sb_dismissed_payees (
  id TEXT PRIMARY KEY,
  normalized_payee TEXT NOT NULL UNIQUE,
  raw_payee TEXT NOT NULL,
  dismissed_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const V2_TABLES = [
  CREATE_DETECTED_SUBSCRIPTIONS,
  CREATE_DISMISSED_PAYEES,
];

export const V2_INDEXES = [
  'CREATE INDEX IF NOT EXISTS sb_detected_subs_status_idx ON sb_detected_subscriptions(status)',
  'CREATE INDEX IF NOT EXISTS sb_detected_subs_payee_idx ON sb_detected_subscriptions(normalized_payee)',
  'CREATE INDEX IF NOT EXISTS sb_detected_subs_confidence_idx ON sb_detected_subscriptions(confidence)',
  'CREATE INDEX IF NOT EXISTS sb_dismissed_payees_payee_idx ON sb_dismissed_payees(normalized_payee)',
];

export const V2_ALTER_STATEMENTS = [
  'ALTER TABLE sb_subscriptions ADD COLUMN bank_detected INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE sb_subscriptions ADD COLUMN bank_payee TEXT',
];
