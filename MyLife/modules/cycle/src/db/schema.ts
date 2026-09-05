// MyCycle SQLite schema - table prefix: cy_

export const CREATE_CYCLES = `
CREATE TABLE IF NOT EXISTS cy_cycles (
  id TEXT PRIMARY KEY,
  start_date TEXT NOT NULL,
  end_date TEXT,
  period_end_date TEXT,
  cycle_length INTEGER,
  period_length INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_CYCLE_DAYS = `
CREATE TABLE IF NOT EXISTS cy_cycle_days (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,
  cycle_id TEXT REFERENCES cy_cycles(id) ON DELETE SET NULL,
  phase TEXT,
  flow_level TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_SYMPTOMS = `
CREATE TABLE IF NOT EXISTS cy_symptoms (
  id TEXT PRIMARY KEY,
  cycle_day_id TEXT NOT NULL REFERENCES cy_cycle_days(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  symptom TEXT NOT NULL,
  intensity TEXT NOT NULL DEFAULT 'moderate',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS cy_cycles_start_date_idx ON cy_cycles(start_date DESC)`,
  `CREATE INDEX IF NOT EXISTS cy_cycle_days_date_idx ON cy_cycle_days(date DESC)`,
  `CREATE INDEX IF NOT EXISTS cy_cycle_days_cycle_idx ON cy_cycle_days(cycle_id)`,
  `CREATE INDEX IF NOT EXISTS cy_symptoms_day_idx ON cy_symptoms(cycle_day_id)`,
  `CREATE INDEX IF NOT EXISTS cy_symptoms_category_idx ON cy_symptoms(category)`,
];

export const CREATE_TEMPERATURES = `
CREATE TABLE IF NOT EXISTS cy_temperatures (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,
  cycle_day_id TEXT REFERENCES cy_cycle_days(id) ON DELETE SET NULL,
  value_celsius REAL NOT NULL,
  time_taken TEXT,
  method TEXT NOT NULL DEFAULT 'oral',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_TEMPERATURE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS cy_temps_date_idx ON cy_temperatures(date DESC)`,
  `CREATE INDEX IF NOT EXISTS cy_temps_cycle_day_idx ON cy_temperatures(cycle_day_id)`,
];

// ── Pregnancy Tables ──────────────────────────────────────────────────

export const CREATE_PREGNANCY_CONFIG = `
CREATE TABLE IF NOT EXISTS cy_pregnancy_config (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'active',
  start_method TEXT NOT NULL,
  last_period_date TEXT,
  conception_date TEXT,
  due_date TEXT NOT NULL,
  actual_end_date TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_APPOINTMENTS = `
CREATE TABLE IF NOT EXISTS cy_appointments (
  id TEXT PRIMARY KEY,
  pregnancy_id TEXT NOT NULL REFERENCES cy_pregnancy_config(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT,
  location TEXT,
  notes TEXT,
  completed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_PREGNANCY_INDEXES = [
  `CREATE INDEX IF NOT EXISTS cy_preg_status_idx ON cy_pregnancy_config(status)`,
  `CREATE INDEX IF NOT EXISTS cy_appt_preg_idx ON cy_appointments(pregnancy_id)`,
  `CREATE INDEX IF NOT EXISTS cy_appt_date_idx ON cy_appointments(date ASC)`,
];

// ── Partner Sync Tables ───────────────────────────────────────────────

export const CREATE_PARTNER_LINKS = `
CREATE TABLE IF NOT EXISTS cy_partner_links (
  id TEXT PRIMARY KEY,
  link_code TEXT NOT NULL UNIQUE,
  partner_name TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  share_phase INTEGER NOT NULL DEFAULT 1,
  share_predictions INTEGER NOT NULL DEFAULT 1,
  share_fertile_window INTEGER NOT NULL DEFAULT 0,
  share_symptoms INTEGER NOT NULL DEFAULT 0,
  share_pregnancy INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_PARTNER_INDEXES = [
  `CREATE INDEX IF NOT EXISTS cy_partner_link_code_idx ON cy_partner_links(link_code)`,
  `CREATE INDEX IF NOT EXISTS cy_partner_link_status_idx ON cy_partner_links(status)`,
];

export const PARTNER_LINKS_V5_ALTERS = [
  `ALTER TABLE cy_partner_links ADD COLUMN share_mood INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE cy_partner_links ADD COLUMN share_temperature INTEGER NOT NULL DEFAULT 0`,
];

export const ALL_TABLES = [
  CREATE_CYCLES,
  CREATE_CYCLE_DAYS,
  CREATE_SYMPTOMS,
];
