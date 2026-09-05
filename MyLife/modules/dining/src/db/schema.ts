/**
 * SQLite schema for MyDining module.
 * All table names use the dn_ prefix to avoid collisions in the shared hub database.
 *
 * UUIDs stored as TEXT.
 * Dates stored as TEXT in ISO datetime format.
 * Booleans stored as INTEGER (0/1).
 */

// -- Settings (V1 anchor) --
export const CREATE_SETTINGS = `
CREATE TABLE IF NOT EXISTS dn_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
)`;

// -- Restaurants (V2) --
export const CREATE_RESTAURANTS = `
CREATE TABLE IF NOT EXISTS dn_restaurants (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  neighborhood TEXT,
  lat REAL,
  lng REAL,
  cuisines TEXT,
  price_tier INTEGER,
  website_url TEXT,
  resy_url TEXT,
  opentable_url TEXT,
  tock_url TEXT,
  yelp_url TEXT,
  instagram_handle TEXT,
  notes_md TEXT,
  is_wishlist INTEGER NOT NULL DEFAULT 0,
  is_visited INTEGER NOT NULL DEFAULT 0,
  first_visited_at TEXT,
  last_visited_at TEXT,
  visit_count INTEGER NOT NULL DEFAULT 0,
  average_rating REAL,
  photo_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// -- Tags (V2) --
export const CREATE_TAGS = `
CREATE TABLE IF NOT EXISTS dn_tags (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL UNIQUE,
  color TEXT,
  kind TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// -- Restaurant-Tags join (V2) --
export const CREATE_RESTAURANT_TAGS = `
CREATE TABLE IF NOT EXISTS dn_restaurant_tags (
  restaurant_id TEXT NOT NULL REFERENCES dn_restaurants(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES dn_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (restaurant_id, tag_id)
)`;

/**
 * All V1 table creation statements in dependency order.
 */
export const ALL_TABLES = [CREATE_SETTINGS];

/**
 * V1 indexes (none yet).
 */
export const CREATE_INDEXES: string[] = [];

/**
 * V2 table creation statements.
 */
export const V2_TABLES = [CREATE_RESTAURANTS, CREATE_TAGS, CREATE_RESTAURANT_TAGS];

/**
 * V2 indexes for restaurant lookups.
 */
export const V2_INDEXES = [
  'CREATE INDEX IF NOT EXISTS dn_restaurants_name_idx ON dn_restaurants (name)',
  'CREATE INDEX IF NOT EXISTS dn_restaurants_city_idx ON dn_restaurants (city)',
  'CREATE INDEX IF NOT EXISTS dn_restaurants_neighborhood_idx ON dn_restaurants (neighborhood)',
  'CREATE INDEX IF NOT EXISTS dn_restaurants_wishlist_idx ON dn_restaurants (is_wishlist)',
  'CREATE INDEX IF NOT EXISTS dn_restaurant_tags_tag_idx ON dn_restaurant_tags (tag_id)',
];

// -- Visits (V3) --
export const CREATE_VISITS = `
CREATE TABLE IF NOT EXISTS dn_visits (
  id TEXT PRIMARY KEY NOT NULL,
  restaurant_id TEXT NOT NULL REFERENCES dn_restaurants(id) ON DELETE CASCADE,
  visited_at TEXT NOT NULL,
  party_size INTEGER,
  occasion TEXT,
  reservation_platform TEXT,
  reservation_confirmation_code TEXT,
  overall_rating INTEGER NOT NULL,
  vibe_rating INTEGER,
  food_rating INTEGER,
  service_rating INTEGER,
  notes_md TEXT,
  total_cost_cents INTEGER,
  who_paid TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// -- Photos (V3) --
export const CREATE_PHOTOS = `
CREATE TABLE IF NOT EXISTS dn_photos (
  id TEXT PRIMARY KEY NOT NULL,
  visit_id TEXT REFERENCES dn_visits(id) ON DELETE CASCADE,
  dish_id TEXT,
  kind TEXT NOT NULL,
  local_uri TEXT NOT NULL,
  caption TEXT,
  width INTEGER,
  height INTEGER,
  size_bytes INTEGER,
  taken_at TEXT,
  exif_stripped INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// -- Companions (V3) --
export const CREATE_COMPANIONS = `
CREATE TABLE IF NOT EXISTS dn_companions (
  id TEXT PRIMARY KEY NOT NULL,
  visit_id TEXT NOT NULL REFERENCES dn_visits(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

/**
 * V3 table creation statements.
 */
export const V3_TABLES = [CREATE_VISITS, CREATE_PHOTOS, CREATE_COMPANIONS];

/**
 * V3 indexes for visits, photos, and companions.
 */
export const V3_INDEXES = [
  'CREATE INDEX IF NOT EXISTS dn_visits_restaurant_idx ON dn_visits (restaurant_id)',
  'CREATE INDEX IF NOT EXISTS dn_visits_visited_at_idx ON dn_visits (visited_at)',
  'CREATE INDEX IF NOT EXISTS dn_photos_visit_idx ON dn_photos (visit_id)',
  'CREATE INDEX IF NOT EXISTS dn_photos_dish_idx ON dn_photos (dish_id)',
  'CREATE INDEX IF NOT EXISTS dn_companions_visit_idx ON dn_companions (visit_id)',
];

// -- Watchlist (V4) --
export const CREATE_WATCHLIST = `
CREATE TABLE IF NOT EXISTS dn_watchlist (
  id TEXT PRIMARY KEY NOT NULL,
  restaurant_id TEXT NOT NULL REFERENCES dn_restaurants(id) ON DELETE CASCADE,
  party_size INTEGER NOT NULL,
  date_range_start TEXT,
  date_range_end TEXT,
  notify_enabled INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

/** V4 table creation statements. */
export const V4_TABLES = [CREATE_WATCHLIST];

/** V4 indexes for watchlist lookups. */
export const V4_INDEXES = [
  'CREATE INDEX IF NOT EXISTS dn_watchlist_restaurant_idx ON dn_watchlist (restaurant_id)',
  'CREATE INDEX IF NOT EXISTS dn_watchlist_status_idx ON dn_watchlist (status)',
];

// -- Dishes (V5) --
export const CREATE_DISHES = `
CREATE TABLE IF NOT EXISTS dn_dishes (
  id TEXT PRIMARY KEY NOT NULL,
  visit_id TEXT REFERENCES dn_visits(id) ON DELETE SET NULL,
  restaurant_id TEXT NOT NULL REFERENCES dn_restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  course TEXT,
  price_cents INTEGER,
  rating INTEGER,
  would_order_again INTEGER DEFAULT 0,
  allergens TEXT,
  notes TEXT,
  photo_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// -- Wines (V5) --
export const CREATE_WINES = `
CREATE TABLE IF NOT EXISTS dn_wines (
  id TEXT PRIMARY KEY NOT NULL,
  visit_id TEXT REFERENCES dn_visits(id) ON DELETE SET NULL,
  restaurant_id TEXT NOT NULL REFERENCES dn_restaurants(id) ON DELETE CASCADE,
  producer TEXT NOT NULL,
  name TEXT NOT NULL,
  vintage INTEGER,
  region TEXT,
  varietal TEXT,
  color TEXT,
  rating INTEGER,
  price_cents INTEGER,
  by_glass INTEGER DEFAULT 0,
  pairing_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

/** V5 table creation statements. */
export const V5_TABLES = [CREATE_DISHES, CREATE_WINES];

/** V5 indexes for dish and wine lookups. */
export const V5_INDEXES = [
  'CREATE INDEX IF NOT EXISTS dn_dishes_restaurant_idx ON dn_dishes (restaurant_id)',
  'CREATE INDEX IF NOT EXISTS dn_dishes_visit_idx ON dn_dishes (visit_id)',
  'CREATE INDEX IF NOT EXISTS dn_dishes_name_idx ON dn_dishes (name)',
  'CREATE INDEX IF NOT EXISTS dn_wines_restaurant_idx ON dn_wines (restaurant_id)',
  'CREATE INDEX IF NOT EXISTS dn_wines_visit_idx ON dn_wines (visit_id)',
  'CREATE INDEX IF NOT EXISTS dn_wines_name_idx ON dn_wines (name)',
];

// -- Reservations (V6) --
export const CREATE_RESERVATIONS = `
CREATE TABLE IF NOT EXISTS dn_reservations (
  id TEXT PRIMARY KEY NOT NULL,
  restaurant_id TEXT NOT NULL REFERENCES dn_restaurants(id) ON DELETE CASCADE,
  reserved_at TEXT NOT NULL,
  party_size INTEGER NOT NULL,
  confirmation_code TEXT,
  platform TEXT,
  status TEXT NOT NULL DEFAULT 'upcoming',
  cancel_reason TEXT,
  reminder_minutes INTEGER,
  notes TEXT,
  visit_id TEXT REFERENCES dn_visits(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// -- Imports (V6) --
export const CREATE_IMPORTS = `
CREATE TABLE IF NOT EXISTS dn_imports (
  id TEXT PRIMARY KEY NOT NULL,
  source TEXT NOT NULL,
  raw_text TEXT NOT NULL,
  parsed_data TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reservation_id TEXT REFERENCES dn_reservations(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

/** V6 table creation statements. */
export const V6_TABLES = [CREATE_RESERVATIONS, CREATE_IMPORTS];

/** V6 indexes for reservation and import lookups. */
export const V6_INDEXES = [
  'CREATE INDEX IF NOT EXISTS dn_reservations_restaurant_idx ON dn_reservations (restaurant_id)',
  'CREATE INDEX IF NOT EXISTS dn_reservations_reserved_at_idx ON dn_reservations (reserved_at)',
  'CREATE INDEX IF NOT EXISTS dn_reservations_status_idx ON dn_reservations (status)',
  'CREATE INDEX IF NOT EXISTS dn_imports_source_idx ON dn_imports (source)',
  'CREATE INDEX IF NOT EXISTS dn_imports_status_idx ON dn_imports (status)',
];
