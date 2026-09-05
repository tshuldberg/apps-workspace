// MyGarden SQLite schema - table prefix: gd_

export const CREATE_PLANTS = `
CREATE TABLE IF NOT EXISTS gd_plants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  species TEXT,
  location TEXT NOT NULL DEFAULT 'indoor',
  zone TEXT,
  image_uri TEXT,
  water_frequency_days INTEGER,
  last_watered TEXT,
  status TEXT NOT NULL DEFAULT 'healthy',
  acquired_date TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_GARDEN_ENTRIES = `
CREATE TABLE IF NOT EXISTS gd_entries (
  id TEXT PRIMARY KEY,
  plant_id TEXT REFERENCES gd_plants(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  action TEXT NOT NULL,
  notes TEXT,
  image_uri TEXT,
  quantity_grams REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_GARDEN_ZONES = `
CREATE TABLE IF NOT EXISTS gd_zones (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT 'indoor',
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_SEEDS = `
CREATE TABLE IF NOT EXISTS gd_seeds (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  species TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  source TEXT,
  purchased_date TEXT,
  expiry_date TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_GARDEN_SETTINGS = `
CREATE TABLE IF NOT EXISTS gd_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
)`;

export const CREATE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS gd_plants_location_idx ON gd_plants(location)`,
  `CREATE INDEX IF NOT EXISTS gd_plants_status_idx ON gd_plants(status)`,
  `CREATE INDEX IF NOT EXISTS gd_plants_updated_idx ON gd_plants(updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS gd_entries_plant_idx ON gd_entries(plant_id)`,
  `CREATE INDEX IF NOT EXISTS gd_entries_date_idx ON gd_entries(date DESC)`,
  `CREATE INDEX IF NOT EXISTS gd_entries_action_idx ON gd_entries(action)`,
  `CREATE INDEX IF NOT EXISTS gd_seeds_name_idx ON gd_seeds(name)`,
  `CREATE INDEX IF NOT EXISTS gd_zones_sort_idx ON gd_zones(sort_order ASC)`,
];

export const ALL_TABLES = [
  CREATE_PLANTS,
  CREATE_GARDEN_ENTRIES,
  CREATE_GARDEN_ZONES,
  CREATE_SEEDS,
  CREATE_GARDEN_SETTINGS,
];
