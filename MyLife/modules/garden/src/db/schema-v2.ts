// Garden V2 schema additions: 11 B+C features
// Table prefix: gd_

// ── Zone enhancements (Room/Zone Organization) ──────────────────────────
export const ALTER_ZONES = [
  `ALTER TABLE gd_zones ADD COLUMN zone_type TEXT NOT NULL DEFAULT 'room'`,
  `ALTER TABLE gd_zones ADD COLUMN icon TEXT`,
  `ALTER TABLE gd_zones ADD COLUMN color TEXT`,
  `ALTER TABLE gd_zones ADD COLUMN photo_uri TEXT`,
  `ALTER TABLE gd_zones ADD COLUMN light_level TEXT`,
  `ALTER TABLE gd_zones ADD COLUMN humidity TEXT`,
  `ALTER TABLE gd_zones ADD COLUMN temperature_notes TEXT`,
  `ALTER TABLE gd_zones ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'))`,
];

// ── AI Plant Identification ─────────────────────────────────────────────
export const CREATE_IDENTIFICATIONS = `
CREATE TABLE IF NOT EXISTS gd_identifications (
  id TEXT PRIMARY KEY,
  plant_id TEXT REFERENCES gd_plants(id) ON DELETE SET NULL,
  image_uri TEXT NOT NULL,
  top_species TEXT,
  top_common_name TEXT,
  top_confidence REAL,
  all_results_json TEXT,
  source TEXT NOT NULL DEFAULT 'on_device',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// ── Seasonal Care ───────────────────────────────────────────────────────
export const CREATE_SEASONAL_TASKS = `
CREATE TABLE IF NOT EXISTS gd_seasonal_tasks (
  id TEXT PRIMARY KEY,
  plant_id TEXT REFERENCES gd_plants(id) ON DELETE CASCADE,
  season TEXT NOT NULL,
  task_type TEXT NOT NULL,
  description TEXT,
  due_month INTEGER,
  completed_at TEXT,
  snoozed_until TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// ── Harvest Tracking ────────────────────────────────────────────────────
export const CREATE_HARVESTS = `
CREATE TABLE IF NOT EXISTS gd_harvests (
  id TEXT PRIMARY KEY,
  plant_id TEXT NOT NULL REFERENCES gd_plants(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit TEXT NOT NULL DEFAULT 'grams',
  crop_type TEXT,
  quality_rating INTEGER,
  image_uri TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// ── Disease/Pest Diagnosis ──────────────────────────────────────────────
export const CREATE_DIAGNOSES = `
CREATE TABLE IF NOT EXISTS gd_diagnoses (
  id TEXT PRIMARY KEY,
  plant_id TEXT REFERENCES gd_plants(id) ON DELETE CASCADE,
  diagnosed_date TEXT NOT NULL,
  type TEXT NOT NULL,
  symptoms_json TEXT NOT NULL,
  diagnosis_name TEXT,
  diagnosis_confidence REAL,
  severity TEXT NOT NULL DEFAULT 'moderate',
  treatment_notes TEXT,
  treatment_status TEXT NOT NULL DEFAULT 'pending',
  image_uri TEXT,
  resolved_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// ── Wish List ───────────────────────────────────────────────────────────
export const CREATE_WISHLIST = `
CREATE TABLE IF NOT EXISTS gd_wishlist (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  species TEXT,
  source TEXT,
  estimated_price REAL,
  priority TEXT NOT NULL DEFAULT 'medium',
  notes TEXT,
  image_uri TEXT,
  added_date TEXT NOT NULL DEFAULT (date('now')),
  acquired INTEGER NOT NULL DEFAULT 0,
  acquired_date TEXT,
  acquired_plant_id TEXT REFERENCES gd_plants(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// ── Propagation Tracking ────────────────────────────────────────────────
export const CREATE_PROPAGATIONS = `
CREATE TABLE IF NOT EXISTS gd_propagations (
  id TEXT PRIMARY KEY,
  parent_plant_id TEXT REFERENCES gd_plants(id) ON DELETE SET NULL,
  method TEXT NOT NULL,
  medium TEXT,
  start_date TEXT NOT NULL,
  current_stage TEXT NOT NULL DEFAULT 'started',
  stage_updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  notes TEXT,
  image_uri TEXT,
  child_plant_id TEXT REFERENCES gd_plants(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// ── Light Level Estimation ──────────────────────────────────────────────
export const CREATE_LIGHT_READINGS = `
CREATE TABLE IF NOT EXISTS gd_light_readings (
  id TEXT PRIMARY KEY,
  zone_id TEXT REFERENCES gd_zones(id) ON DELETE CASCADE,
  reading_lux INTEGER NOT NULL,
  light_level TEXT NOT NULL,
  reading_date TEXT NOT NULL,
  reading_time TEXT,
  duration_minutes INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// ── Garden Layout Planner ───────────────────────────────────────────────
export const CREATE_LAYOUTS = `
CREATE TABLE IF NOT EXISTS gd_layouts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  zone_id TEXT REFERENCES gd_zones(id) ON DELETE SET NULL,
  width_cells INTEGER NOT NULL DEFAULT 8,
  height_cells INTEGER NOT NULL DEFAULT 8,
  cell_size_inches INTEGER NOT NULL DEFAULT 12,
  season TEXT,
  year INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_LAYOUT_ITEMS = `
CREATE TABLE IF NOT EXISTS gd_layout_items (
  id TEXT PRIMARY KEY,
  layout_id TEXT NOT NULL REFERENCES gd_layouts(id) ON DELETE CASCADE,
  plant_id TEXT REFERENCES gd_plants(id) ON DELETE SET NULL,
  item_type TEXT NOT NULL DEFAULT 'plant',
  label TEXT NOT NULL,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  width_cells INTEGER NOT NULL DEFAULT 1,
  height_cells INTEGER NOT NULL DEFAULT 1,
  color TEXT,
  icon TEXT,
  spacing_inches INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// ── Frost Date Alerts ───────────────────────────────────────────────────
export const CREATE_FROST_CONFIG = `
CREATE TABLE IF NOT EXISTS gd_frost_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  zip_code TEXT,
  usda_zone TEXT,
  avg_last_frost TEXT,
  avg_first_frost TEXT,
  notification_days_before INTEGER NOT NULL DEFAULT 7,
  custom_last_frost TEXT,
  custom_first_frost TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// ── V2 Indexes ──────────────────────────────────────────────────────────
export const V2_INDEXES = [
  // Identifications
  `CREATE INDEX IF NOT EXISTS gd_identifications_plant_idx ON gd_identifications(plant_id)`,
  `CREATE INDEX IF NOT EXISTS gd_identifications_date_idx ON gd_identifications(created_at DESC)`,
  // Seasonal tasks
  `CREATE INDEX IF NOT EXISTS gd_seasonal_tasks_plant_idx ON gd_seasonal_tasks(plant_id)`,
  `CREATE INDEX IF NOT EXISTS gd_seasonal_tasks_season_idx ON gd_seasonal_tasks(season)`,
  `CREATE INDEX IF NOT EXISTS gd_seasonal_tasks_completed_idx ON gd_seasonal_tasks(completed_at)`,
  // Harvests
  `CREATE INDEX IF NOT EXISTS gd_harvests_plant_idx ON gd_harvests(plant_id)`,
  `CREATE INDEX IF NOT EXISTS gd_harvests_date_idx ON gd_harvests(date DESC)`,
  `CREATE INDEX IF NOT EXISTS gd_harvests_crop_idx ON gd_harvests(crop_type)`,
  // Diagnoses
  `CREATE INDEX IF NOT EXISTS gd_diagnoses_plant_idx ON gd_diagnoses(plant_id)`,
  `CREATE INDEX IF NOT EXISTS gd_diagnoses_date_idx ON gd_diagnoses(diagnosed_date DESC)`,
  `CREATE INDEX IF NOT EXISTS gd_diagnoses_status_idx ON gd_diagnoses(treatment_status)`,
  // Wishlist
  `CREATE INDEX IF NOT EXISTS gd_wishlist_priority_idx ON gd_wishlist(priority)`,
  `CREATE INDEX IF NOT EXISTS gd_wishlist_acquired_idx ON gd_wishlist(acquired)`,
  // Propagations
  `CREATE INDEX IF NOT EXISTS gd_propagations_parent_idx ON gd_propagations(parent_plant_id)`,
  `CREATE INDEX IF NOT EXISTS gd_propagations_stage_idx ON gd_propagations(current_stage)`,
  `CREATE INDEX IF NOT EXISTS gd_propagations_date_idx ON gd_propagations(start_date DESC)`,
  // Light readings
  `CREATE INDEX IF NOT EXISTS gd_light_readings_zone_idx ON gd_light_readings(zone_id)`,
  `CREATE INDEX IF NOT EXISTS gd_light_readings_date_idx ON gd_light_readings(reading_date DESC)`,
  // Layouts
  `CREATE INDEX IF NOT EXISTS gd_layouts_zone_idx ON gd_layouts(zone_id)`,
  `CREATE INDEX IF NOT EXISTS gd_layout_items_layout_idx ON gd_layout_items(layout_id)`,
  `CREATE INDEX IF NOT EXISTS gd_layout_items_plant_idx ON gd_layout_items(plant_id)`,
];

// ── Migrate existing harvest entries to gd_harvests ─────────────────────
export const MIGRATE_HARVESTS = `
INSERT INTO gd_harvests (id, plant_id, date, quantity, unit, notes, created_at)
SELECT id, plant_id, date, COALESCE(quantity_grams, 0), 'grams', notes, created_at
FROM gd_entries
WHERE action = 'harvest' AND plant_id IS NOT NULL
`;

// ── All V2 tables ───────────────────────────────────────────────────────
export const V2_TABLES = [
  CREATE_IDENTIFICATIONS,
  CREATE_SEASONAL_TASKS,
  CREATE_HARVESTS,
  CREATE_DIAGNOSES,
  CREATE_WISHLIST,
  CREATE_PROPAGATIONS,
  CREATE_LIGHT_READINGS,
  CREATE_LAYOUTS,
  CREATE_LAYOUT_ITEMS,
  CREATE_FROST_CONFIG,
];

export const V2_DOWN = [
  'DROP TABLE IF EXISTS gd_frost_config',
  'DROP TABLE IF EXISTS gd_layout_items',
  'DROP TABLE IF EXISTS gd_layouts',
  'DROP TABLE IF EXISTS gd_light_readings',
  'DROP TABLE IF EXISTS gd_propagations',
  'DROP TABLE IF EXISTS gd_wishlist',
  'DROP TABLE IF EXISTS gd_diagnoses',
  'DROP TABLE IF EXISTS gd_harvests',
  'DROP TABLE IF EXISTS gd_seasonal_tasks',
  'DROP TABLE IF EXISTS gd_identifications',
];
