export const CREATE_ITEMS = `
CREATE TABLE IF NOT EXISTS cl_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  color TEXT,
  brand TEXT,
  purchase_price_cents INTEGER,
  purchase_date TEXT,
  image_uri TEXT,
  seasons_json TEXT NOT NULL DEFAULT '[]',
  occasions_json TEXT NOT NULL DEFAULT '[]',
  condition TEXT NOT NULL DEFAULT 'good',
  status TEXT NOT NULL DEFAULT 'active',
  laundry_status TEXT NOT NULL DEFAULT 'clean',
  times_worn INTEGER NOT NULL DEFAULT 0,
  last_worn_date TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_OUTFITS = `
CREATE TABLE IF NOT EXISTS cl_outfits (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  occasion TEXT,
  season TEXT,
  image_uri TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_OUTFIT_ITEMS = `
CREATE TABLE IF NOT EXISTS cl_outfit_items (
  id TEXT PRIMARY KEY,
  outfit_id TEXT NOT NULL REFERENCES cl_outfits(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES cl_items(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(outfit_id, item_id)
)`;

export const CREATE_WEAR_LOGS = `
CREATE TABLE IF NOT EXISTS cl_wear_logs (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  outfit_id TEXT REFERENCES cl_outfits(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_WEAR_LOG_ITEMS = `
CREATE TABLE IF NOT EXISTS cl_wear_log_items (
  id TEXT PRIMARY KEY,
  wear_log_id TEXT NOT NULL REFERENCES cl_wear_logs(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES cl_items(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(wear_log_id, item_id)
)`;

export const CREATE_TAGS = `
CREATE TABLE IF NOT EXISTS cl_tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_ITEM_TAGS = `
CREATE TABLE IF NOT EXISTS cl_item_tags (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES cl_items(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES cl_tags(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(item_id, tag_id)
)`;

export const CREATE_SETTINGS = `
CREATE TABLE IF NOT EXISTS cl_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
)`;

export const ADD_ITEM_CARE_INSTRUCTIONS = `
ALTER TABLE cl_items ADD COLUMN care_instructions TEXT NOT NULL DEFAULT 'machine_wash'`;

export const ADD_ITEM_AUTO_DIRTY = `
ALTER TABLE cl_items ADD COLUMN auto_dirty_on_wear INTEGER NOT NULL DEFAULT 1`;

export const ADD_ITEM_WEARS_SINCE_WASH = `
ALTER TABLE cl_items ADD COLUMN wears_since_wash INTEGER NOT NULL DEFAULT 0`;

export const CREATE_LAUNDRY_EVENTS = `
CREATE TABLE IF NOT EXISTS cl_laundry_events (
  id TEXT PRIMARY KEY,
  clothing_item_id TEXT NOT NULL REFERENCES cl_items(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL DEFAULT 'washed',
  event_date TEXT NOT NULL,
  wears_before_wash INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_PACKING_LISTS = `
CREATE TABLE IF NOT EXISTS cl_packing_lists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  occasions_json TEXT NOT NULL DEFAULT '[]',
  season TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'quick_list',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_PACKING_LIST_ITEMS = `
CREATE TABLE IF NOT EXISTS cl_packing_list_items (
  id TEXT PRIMARY KEY,
  packing_list_id TEXT NOT NULL REFERENCES cl_packing_lists(id) ON DELETE CASCADE,
  clothing_item_id TEXT REFERENCES cl_items(id) ON DELETE SET NULL,
  custom_name TEXT,
  category_group TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  is_packed INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(packing_list_id, clothing_item_id)
)`;

export const BASE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS cl_items_category_idx ON cl_items(category, status)`,
  `CREATE INDEX IF NOT EXISTS cl_items_last_worn_idx ON cl_items(last_worn_date, status)`,
  `CREATE INDEX IF NOT EXISTS cl_outfit_items_outfit_idx ON cl_outfit_items(outfit_id)`,
  `CREATE INDEX IF NOT EXISTS cl_wear_logs_date_idx ON cl_wear_logs(date DESC)`,
  `CREATE INDEX IF NOT EXISTS cl_wear_log_items_log_idx ON cl_wear_log_items(wear_log_id)`,
  `CREATE INDEX IF NOT EXISTS cl_wear_log_items_item_idx ON cl_wear_log_items(item_id)`,
  `CREATE INDEX IF NOT EXISTS cl_item_tags_item_idx ON cl_item_tags(item_id)`,
  `CREATE INDEX IF NOT EXISTS cl_item_tags_tag_idx ON cl_item_tags(tag_id)`,
];

export const EXPANDED_INDEXES = [
  `CREATE INDEX IF NOT EXISTS cl_items_laundry_idx ON cl_items(laundry_status, care_instructions, wears_since_wash DESC)`,
  `CREATE INDEX IF NOT EXISTS cl_laundry_events_item_idx ON cl_laundry_events(clothing_item_id, event_date DESC)`,
  `CREATE INDEX IF NOT EXISTS cl_laundry_events_date_idx ON cl_laundry_events(event_date DESC)`,
  `CREATE INDEX IF NOT EXISTS cl_packing_lists_date_idx ON cl_packing_lists(start_date ASC, end_date ASC)`,
  `CREATE INDEX IF NOT EXISTS cl_packing_list_items_list_idx ON cl_packing_list_items(packing_list_id, category_group, sort_order)`,
];

export const BASE_SETTINGS = [
  `INSERT OR IGNORE INTO cl_settings (key, value) VALUES ('donationThresholdDays', '365')`,
];

export const EXPANDED_SETTINGS = [
  `INSERT OR IGNORE INTO cl_settings (key, value) VALUES ('viewMode', 'grid')`,
  `INSERT OR IGNORE INTO cl_settings (key, value) VALUES ('gridColumns', '2')`,
  `INSERT OR IGNORE INTO cl_settings (key, value) VALUES ('showWardrobeValue', '1')`,
  `INSERT OR IGNORE INTO cl_settings (key, value) VALUES ('currency', 'USD')`,
  `INSERT OR IGNORE INTO cl_settings (key, value) VALUES ('defaultCondition', 'good')`,
  `INSERT OR IGNORE INTO cl_settings (key, value) VALUES ('catalogRequirePhoto', '0')`,
  `INSERT OR IGNORE INTO cl_settings (key, value) VALUES ('wearAutoMarkLoggedOutfit', '1')`,
  `INSERT OR IGNORE INTO cl_settings (key, value) VALUES ('wearLoggingReminder', 'none')`,
  `INSERT OR IGNORE INTO cl_settings (key, value) VALUES ('laundryAutoDirty', '1')`,
  `INSERT OR IGNORE INTO cl_settings (key, value) VALUES ('laundryWearsBeforeDirty', '1')`,
  `INSERT OR IGNORE INTO cl_settings (key, value) VALUES ('laundryReminder', 'none')`,
  `INSERT OR IGNORE INTO cl_settings (key, value) VALUES ('laundryReminderDay', '0')`,
];

export const BASE_TABLES = [
  CREATE_ITEMS,
  CREATE_OUTFITS,
  CREATE_OUTFIT_ITEMS,
  CREATE_WEAR_LOGS,
  CREATE_WEAR_LOG_ITEMS,
  CREATE_TAGS,
  CREATE_ITEM_TAGS,
  CREATE_SETTINGS,
];

export const EXPANDED_TABLES = [
  ADD_ITEM_CARE_INSTRUCTIONS,
  ADD_ITEM_AUTO_DIRTY,
  ADD_ITEM_WEARS_SINCE_WASH,
  CREATE_LAUNDRY_EVENTS,
  CREATE_PACKING_LISTS,
  CREATE_PACKING_LIST_ITEMS,
];

export const ALL_TABLES = [...BASE_TABLES, ...EXPANDED_TABLES];

// ── V3 tables: wishlist, capsule wardrobes, outfit suggestion feedback, weather cache ──

export const CREATE_WISHLIST_ITEMS = `
CREATE TABLE IF NOT EXISTS cl_wishlist_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  brand TEXT,
  color TEXT,
  estimated_price_cents INTEGER,
  url TEXT,
  image_uri TEXT,
  notes TEXT,
  priority TEXT NOT NULL DEFAULT 'medium',
  is_purchased INTEGER NOT NULL DEFAULT 0,
  purchased_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_CAPSULES = `
CREATE TABLE IF NOT EXISTS cl_capsules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  season TEXT NOT NULL,
  target_count INTEGER NOT NULL DEFAULT 33,
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_CAPSULE_ITEMS = `
CREATE TABLE IF NOT EXISTS cl_capsule_items (
  id TEXT PRIMARY KEY,
  capsule_id TEXT NOT NULL REFERENCES cl_capsules(id) ON DELETE CASCADE,
  clothing_item_id TEXT NOT NULL REFERENCES cl_items(id) ON DELETE CASCADE,
  is_essential INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(capsule_id, clothing_item_id)
)`;

export const CREATE_SUGGESTION_FEEDBACK = `
CREATE TABLE IF NOT EXISTS cl_suggestion_feedback (
  id TEXT PRIMARY KEY,
  suggestion_hash TEXT NOT NULL,
  item_ids_json TEXT NOT NULL,
  feedback TEXT NOT NULL,
  context_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_WEATHER_CACHE = `
CREATE TABLE IF NOT EXISTS cl_weather_cache (
  id TEXT PRIMARY KEY,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  temperature_f REAL NOT NULL,
  condition TEXT NOT NULL,
  humidity INTEGER,
  wind_speed_mph REAL,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
)`;

export const V3_TABLES = [
  CREATE_WISHLIST_ITEMS,
  CREATE_CAPSULES,
  CREATE_CAPSULE_ITEMS,
  CREATE_SUGGESTION_FEEDBACK,
  CREATE_WEATHER_CACHE,
];

export const V3_INDEXES = [
  `CREATE INDEX IF NOT EXISTS cl_wishlist_priority_idx ON cl_wishlist_items(priority, is_purchased, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS cl_capsules_active_idx ON cl_capsules(is_active, season)`,
  `CREATE INDEX IF NOT EXISTS cl_capsule_items_capsule_idx ON cl_capsule_items(capsule_id)`,
  `CREATE INDEX IF NOT EXISTS cl_suggestion_feedback_hash_idx ON cl_suggestion_feedback(suggestion_hash, feedback)`,
  `CREATE INDEX IF NOT EXISTS cl_weather_cache_expires_idx ON cl_weather_cache(expires_at)`,
];

export const V3_SETTINGS = [
  `INSERT OR IGNORE INTO cl_settings (key, value) VALUES ('seasonalReminderEnabled', '1')`,
  `INSERT OR IGNORE INTO cl_settings (key, value) VALUES ('seasonalReminderAdvanceDays', '14')`,
  `INSERT OR IGNORE INTO cl_settings (key, value) VALUES ('lastSeasonalRotationDate', '')`,
  `INSERT OR IGNORE INTO cl_settings (key, value) VALUES ('hemisphere', 'northern')`,
  `INSERT OR IGNORE INTO cl_settings (key, value) VALUES ('temperatureUnit', 'F')`,
];
