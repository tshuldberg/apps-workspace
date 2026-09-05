// MyStars SQLite schema - table prefix: st_

export const CREATE_BIRTH_PROFILES = `
CREATE TABLE IF NOT EXISTS st_birth_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  birth_date TEXT NOT NULL,
  birth_time TEXT,
  birth_lat REAL,
  birth_lng REAL,
  birth_place TEXT,
  sun_sign TEXT,
  moon_sign TEXT,
  rising_sign TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_TRANSITS = `
CREATE TABLE IF NOT EXISTS st_transits (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES st_birth_profiles(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  planet TEXT NOT NULL,
  sign TEXT NOT NULL,
  aspect TEXT,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_DAILY_READINGS = `
CREATE TABLE IF NOT EXISTS st_daily_readings (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES st_birth_profiles(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  moon_phase TEXT NOT NULL,
  moon_sign TEXT,
  summary TEXT,
  tarot_card TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(profile_id, date)
)`;

export const CREATE_SAVED_CHARTS = `
CREATE TABLE IF NOT EXISTS st_saved_charts (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES st_birth_profiles(id) ON DELETE CASCADE,
  chart_type TEXT NOT NULL,
  title TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS st_birth_profiles_name_idx ON st_birth_profiles(name)`,
  `CREATE INDEX IF NOT EXISTS st_transits_profile_idx ON st_transits(profile_id)`,
  `CREATE INDEX IF NOT EXISTS st_transits_date_idx ON st_transits(date)`,
  `CREATE INDEX IF NOT EXISTS st_transits_profile_date_idx ON st_transits(profile_id, date)`,
  `CREATE INDEX IF NOT EXISTS st_daily_readings_profile_idx ON st_daily_readings(profile_id)`,
  `CREATE INDEX IF NOT EXISTS st_daily_readings_date_idx ON st_daily_readings(date)`,
  `CREATE INDEX IF NOT EXISTS st_saved_charts_profile_idx ON st_saved_charts(profile_id)`,
];

export const ALL_TABLES = [
  CREATE_BIRTH_PROFILES,
  CREATE_TRANSITS,
  CREATE_DAILY_READINGS,
  CREATE_SAVED_CHARTS,
];

// ── V2 Tables (B+C Features) ────────────────────────────────────────

export const CREATE_MOON_CALENDAR = `
CREATE TABLE IF NOT EXISTS st_moon_calendar (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  moon_phase TEXT NOT NULL,
  moon_sign TEXT NOT NULL,
  illumination_pct REAL NOT NULL,
  is_key_phase INTEGER NOT NULL DEFAULT 0,
  phase_interpretation TEXT,
  sign_interpretation TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(date)
)`;

export const CREATE_COMPATIBILITY_RESULTS = `
CREATE TABLE IF NOT EXISTS st_compatibility_results (
  id TEXT PRIMARY KEY,
  profile_a_id TEXT NOT NULL REFERENCES st_birth_profiles(id) ON DELETE CASCADE,
  profile_b_id TEXT NOT NULL REFERENCES st_birth_profiles(id) ON DELETE CASCADE,
  analysis_type TEXT NOT NULL DEFAULT 'quick_match',
  overall_score INTEGER NOT NULL,
  element_compatibility TEXT NOT NULL,
  sun_sign_description TEXT,
  computed_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(profile_a_id, profile_b_id)
)`;

export const CREATE_ZODIAC_EVENTS = `
CREATE TABLE IF NOT EXISTS st_zodiac_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  category TEXT NOT NULL,
  event_date TEXT NOT NULL,
  body TEXT NOT NULL,
  from_sign TEXT,
  to_sign TEXT,
  title TEXT NOT NULL,
  description_brief TEXT NOT NULL,
  description_full TEXT,
  computed_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(event_type, body, event_date)
)`;

export const CREATE_TRANSIT_EVENTS = `
CREATE TABLE IF NOT EXISTS st_transit_events (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES st_birth_profiles(id) ON DELETE CASCADE,
  transiting_body TEXT NOT NULL,
  natal_body TEXT NOT NULL,
  aspect_type TEXT NOT NULL,
  significance TEXT NOT NULL DEFAULT 'minor',
  current_orb REAL,
  exact_date TEXT NOT NULL,
  is_applying INTEGER NOT NULL DEFAULT 1,
  interpretation_brief TEXT,
  computed_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(profile_id, transiting_body, natal_body, aspect_type, exact_date)
)`;

export const CREATE_JOURNAL_ENTRIES = `
CREATE TABLE IF NOT EXISTS st_journal_entries (
  id TEXT PRIMARY KEY,
  profile_id TEXT REFERENCES st_birth_profiles(id) ON DELETE SET NULL,
  date TEXT NOT NULL,
  content TEXT NOT NULL,
  mood TEXT,
  moon_phase TEXT NOT NULL,
  moon_sign TEXT NOT NULL,
  sun_sign TEXT NOT NULL,
  retrograde_planets TEXT,
  tarot_card_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_SOLAR_RETURNS = `
CREATE TABLE IF NOT EXISTS st_solar_returns (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES st_birth_profiles(id) ON DELETE CASCADE,
  return_year INTEGER NOT NULL,
  return_date TEXT NOT NULL,
  sun_sign TEXT NOT NULL,
  moon_sign TEXT NOT NULL,
  year_theme TEXT,
  computed_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(profile_id, return_year)
)`;

export const CREATE_PROGRESSED_CHARTS = `
CREATE TABLE IF NOT EXISTS st_progressed_charts (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES st_birth_profiles(id) ON DELETE CASCADE,
  progressed_date TEXT NOT NULL,
  current_age_years REAL NOT NULL,
  moon_sign TEXT NOT NULL,
  moon_degree_approx INTEGER NOT NULL,
  moon_next_sign_change_years REAL,
  moon_next_sign TEXT,
  moon_interpretation TEXT,
  sun_sign TEXT NOT NULL,
  sun_degree_approx INTEGER NOT NULL,
  computed_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(profile_id)
)`;

export const V2_TABLES = [
  CREATE_MOON_CALENDAR,
  CREATE_COMPATIBILITY_RESULTS,
  CREATE_ZODIAC_EVENTS,
  CREATE_TRANSIT_EVENTS,
  CREATE_JOURNAL_ENTRIES,
  CREATE_SOLAR_RETURNS,
  CREATE_PROGRESSED_CHARTS,
];

export const V2_INDEXES = [
  `CREATE INDEX IF NOT EXISTS st_moon_calendar_date_idx ON st_moon_calendar(date)`,
  `CREATE INDEX IF NOT EXISTS st_moon_calendar_phase_idx ON st_moon_calendar(moon_phase)`,
  `CREATE INDEX IF NOT EXISTS st_compat_profiles_idx ON st_compatibility_results(profile_a_id, profile_b_id)`,
  `CREATE INDEX IF NOT EXISTS st_zodiac_events_date_idx ON st_zodiac_events(event_date)`,
  `CREATE INDEX IF NOT EXISTS st_zodiac_events_category_idx ON st_zodiac_events(category)`,
  `CREATE INDEX IF NOT EXISTS st_transit_events_profile_date_idx ON st_transit_events(profile_id, exact_date)`,
  `CREATE INDEX IF NOT EXISTS st_transit_events_significance_idx ON st_transit_events(significance)`,
  `CREATE INDEX IF NOT EXISTS st_journal_entries_date_idx ON st_journal_entries(date)`,
  `CREATE INDEX IF NOT EXISTS st_journal_entries_profile_idx ON st_journal_entries(profile_id)`,
  `CREATE INDEX IF NOT EXISTS st_journal_entries_mood_idx ON st_journal_entries(mood)`,
  `CREATE INDEX IF NOT EXISTS st_solar_returns_profile_year_idx ON st_solar_returns(profile_id, return_year)`,
  `CREATE INDEX IF NOT EXISTS st_progressed_profile_idx ON st_progressed_charts(profile_id)`,
];

// ── V3 Tables (Tarot Phase) ──────────────────────────────────────────

export const ADD_DAILY_READING_TAROT_CARD_ID = `
ALTER TABLE st_daily_readings ADD COLUMN tarot_card_id TEXT`;

export const ADD_DAILY_READING_TAROT_IS_REVERSED = `
ALTER TABLE st_daily_readings ADD COLUMN tarot_is_reversed INTEGER NOT NULL DEFAULT 0`;

export const ADD_DAILY_READING_JOURNAL_PROMPT = `
ALTER TABLE st_daily_readings ADD COLUMN journal_prompt TEXT`;

export const CREATE_TAROT_READINGS = `
CREATE TABLE IF NOT EXISTS st_tarot_readings (
  id TEXT PRIMARY KEY,
  profile_id TEXT REFERENCES st_birth_profiles(id) ON DELETE SET NULL,
  reading_date TEXT NOT NULL,
  spread_type TEXT NOT NULL,
  title TEXT NOT NULL,
  question TEXT,
  narrative TEXT,
  notes TEXT,
  cards_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const V3_TABLES = [
  ADD_DAILY_READING_TAROT_CARD_ID,
  ADD_DAILY_READING_TAROT_IS_REVERSED,
  ADD_DAILY_READING_JOURNAL_PROMPT,
  CREATE_TAROT_READINGS,
];

export const V3_INDEXES = [
  `CREATE INDEX IF NOT EXISTS st_tarot_readings_profile_idx ON st_tarot_readings(profile_id)`,
  `CREATE INDEX IF NOT EXISTS st_tarot_readings_date_idx ON st_tarot_readings(reading_date)`,
  `CREATE INDEX IF NOT EXISTS st_tarot_readings_spread_idx ON st_tarot_readings(spread_type)`,
];

// ── V4 Tables (Journal Compose Phase) ────────────────────────────────

export const ADD_JOURNAL_ENTRY_TITLE = `
ALTER TABLE st_journal_entries ADD COLUMN title TEXT`;

export const ADD_JOURNAL_ENTRY_INTENTION = `
ALTER TABLE st_journal_entries ADD COLUMN intention TEXT`;

export const ADD_JOURNAL_ENTRY_PHOTO_URIS = `
ALTER TABLE st_journal_entries ADD COLUMN photo_uris TEXT`;

export const V4_TABLES = [
  ADD_JOURNAL_ENTRY_TITLE,
  ADD_JOURNAL_ENTRY_INTENTION,
  ADD_JOURNAL_ENTRY_PHOTO_URIS,
];

export const V4_INDEXES = [
  `CREATE INDEX IF NOT EXISTS st_journal_entries_title_idx ON st_journal_entries(title)`,
  `CREATE INDEX IF NOT EXISTS st_journal_entries_intention_idx ON st_journal_entries(intention)`,
];
