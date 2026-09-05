// MySubs SQLite schema - table prefix: sb_

export const CREATE_CATEGORIES = `
CREATE TABLE IF NOT EXISTS sb_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  icon TEXT,
  color TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_SUBSCRIPTIONS = `
CREATE TABLE IF NOT EXISTS sb_subscriptions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cost_cents INTEGER NOT NULL DEFAULT 0,
  billing_cycle TEXT NOT NULL DEFAULT 'monthly'
    CHECK (billing_cycle IN ('weekly', 'monthly', 'quarterly', 'yearly', 'lifetime')),
  category_id TEXT REFERENCES sb_categories(id) ON DELETE SET NULL,
  next_renewal_date TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT,
  trial_end_date TEXT,
  icon_uri TEXT,
  url TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'cancelled', 'trial', 'expired')),
  notification_enabled INTEGER NOT NULL DEFAULT 1,
  notification_days_before INTEGER NOT NULL DEFAULT 3,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_PRICE_HISTORY = `
CREATE TABLE IF NOT EXISTS sb_price_history (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES sb_subscriptions(id) ON DELETE CASCADE,
  old_cost_cents INTEGER NOT NULL,
  new_cost_cents INTEGER NOT NULL,
  changed_on TEXT NOT NULL DEFAULT (datetime('now')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_RENEWAL_EVENTS = `
CREATE TABLE IF NOT EXISTS sb_renewal_events (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES sb_subscriptions(id) ON DELETE CASCADE,
  renewal_date TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming'
    CHECK (status IN ('upcoming', 'paid', 'skipped', 'missed')),
  notified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_CANCELLATION_ACTIONS = `
CREATE TABLE IF NOT EXISTS sb_cancellation_actions (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES sb_subscriptions(id) ON DELETE CASCADE,
  action TEXT NOT NULL
    CHECK (action IN ('dismissed', 'reminded', 'cancelled', 'downgraded', 'kept')),
  savings_cents INTEGER,
  notes TEXT,
  acted_on TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_PRICE_ALTERNATIVES = `
CREATE TABLE IF NOT EXISTS sb_price_alternatives (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES sb_subscriptions(id) ON DELETE CASCADE,
  alternative_name TEXT NOT NULL,
  alternative_cost_cents INTEGER NOT NULL,
  alternative_billing_cycle TEXT NOT NULL DEFAULT 'monthly'
    CHECK (alternative_billing_cycle IN ('weekly', 'monthly', 'quarterly', 'yearly', 'lifetime')),
  alternative_url TEXT,
  notes TEXT,
  is_free_tier INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_CATALOG = `
CREATE TABLE IF NOT EXISTS sb_catalog (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category_id TEXT REFERENCES sb_categories(id) ON DELETE SET NULL,
  typical_cost_cents INTEGER,
  typical_billing_cycle TEXT DEFAULT 'monthly'
    CHECK (typical_billing_cycle IN ('weekly', 'monthly', 'quarterly', 'yearly', 'lifetime')),
  cancel_url TEXT,
  website_url TEXT,
  icon_uri TEXT,
  search_terms TEXT,
  popularity_rank INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_INDEXES = [
  'CREATE INDEX IF NOT EXISTS sb_subscriptions_status_idx ON sb_subscriptions(status)',
  'CREATE INDEX IF NOT EXISTS sb_subscriptions_next_renewal_idx ON sb_subscriptions(next_renewal_date)',
  'CREATE INDEX IF NOT EXISTS sb_subscriptions_category_idx ON sb_subscriptions(category_id)',
  'CREATE INDEX IF NOT EXISTS sb_price_history_sub_idx ON sb_price_history(subscription_id)',
  'CREATE INDEX IF NOT EXISTS sb_price_history_date_idx ON sb_price_history(changed_on)',
  'CREATE INDEX IF NOT EXISTS sb_renewal_events_sub_idx ON sb_renewal_events(subscription_id)',
  'CREATE INDEX IF NOT EXISTS sb_renewal_events_date_idx ON sb_renewal_events(renewal_date)',
  'CREATE UNIQUE INDEX IF NOT EXISTS sb_renewal_events_sub_date_uniq ON sb_renewal_events(subscription_id, renewal_date)',
  'CREATE INDEX IF NOT EXISTS sb_cancellation_actions_sub_idx ON sb_cancellation_actions(subscription_id)',
  'CREATE INDEX IF NOT EXISTS sb_cancellation_actions_action_idx ON sb_cancellation_actions(action)',
  'CREATE INDEX IF NOT EXISTS sb_price_alternatives_sub_idx ON sb_price_alternatives(subscription_id)',
  'CREATE INDEX IF NOT EXISTS sb_catalog_name_idx ON sb_catalog(name)',
  'CREATE INDEX IF NOT EXISTS sb_catalog_category_idx ON sb_catalog(category_id)',
  'CREATE INDEX IF NOT EXISTS sb_catalog_popularity_idx ON sb_catalog(popularity_rank)',
];

export const ALL_TABLES = [
  CREATE_CATEGORIES,
  CREATE_SUBSCRIPTIONS,
  CREATE_PRICE_HISTORY,
  CREATE_RENEWAL_EVENTS,
  CREATE_CANCELLATION_ACTIONS,
  CREATE_PRICE_ALTERNATIVES,
  CREATE_CATALOG,
];

export const SEED_CATEGORIES = [
  `INSERT OR IGNORE INTO sb_categories (id, name, icon, color, sort_order) VALUES ('cat-streaming', 'Streaming', 'tv', '#E50914', 0)`,
  `INSERT OR IGNORE INTO sb_categories (id, name, icon, color, sort_order) VALUES ('cat-music', 'Music', 'music', '#1DB954', 1)`,
  `INSERT OR IGNORE INTO sb_categories (id, name, icon, color, sort_order) VALUES ('cat-cloud', 'Cloud Storage', 'cloud', '#4285F4', 2)`,
  `INSERT OR IGNORE INTO sb_categories (id, name, icon, color, sort_order) VALUES ('cat-productivity', 'Productivity', 'briefcase', '#FF6900', 3)`,
  `INSERT OR IGNORE INTO sb_categories (id, name, icon, color, sort_order) VALUES ('cat-gaming', 'Gaming', 'gamepad-2', '#9146FF', 4)`,
  `INSERT OR IGNORE INTO sb_categories (id, name, icon, color, sort_order) VALUES ('cat-news', 'News & Media', 'newspaper', '#1A1A1A', 5)`,
  `INSERT OR IGNORE INTO sb_categories (id, name, icon, color, sort_order) VALUES ('cat-health', 'Health & Fitness', 'heart', '#FF2D55', 6)`,
  `INSERT OR IGNORE INTO sb_categories (id, name, icon, color, sort_order) VALUES ('cat-education', 'Education', 'graduation-cap', '#00B4D8', 7)`,
  `INSERT OR IGNORE INTO sb_categories (id, name, icon, color, sort_order) VALUES ('cat-shopping', 'Shopping', 'shopping-cart', '#FF9900', 8)`,
  `INSERT OR IGNORE INTO sb_categories (id, name, icon, color, sort_order) VALUES ('cat-other', 'Other', 'tag', '#6B7280', 9)`,
];
