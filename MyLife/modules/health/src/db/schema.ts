/**
 * SQLite schema for MyHealth module.
 * All table names use the hl_ prefix to avoid collisions in the shared hub database.
 *
 * MyHealth absorbs data from md_* (meds), ft_* (fast), and cy_* (cycle) tables
 * by reading/writing them directly. These 8 tables are NEW health-specific storage
 * that the absorbed modules never had.
 *
 * UUIDs stored as TEXT.
 * Dates stored as TEXT in ISO datetime format.
 * Booleans stored as INTEGER (0/1).
 * BLOBs stored directly for document content (max 10MB enforced at app layer).
 */

// -- 1. Documents (health records, lab results, prescriptions, insurance cards) --
export const CREATE_DOCUMENTS = `
CREATE TABLE IF NOT EXISTS hl_documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('lab_result', 'prescription', 'insurance', 'imaging', 'vaccination', 'referral', 'discharge', 'other')),
    mime_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    content BLOB NOT NULL,
    thumbnail BLOB,
    notes TEXT,
    document_date TEXT,
    is_starred INTEGER NOT NULL DEFAULT 0,
    tags TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// -- 2. Vitals (wearable + manual measurements beyond what md_measurements covers) --
export const CREATE_VITALS = `
CREATE TABLE IF NOT EXISTS hl_vitals (
    id TEXT PRIMARY KEY,
    vital_type TEXT NOT NULL CHECK (vital_type IN (
        'heart_rate', 'resting_heart_rate', 'hrv', 'blood_oxygen',
        'blood_pressure', 'body_temperature', 'steps', 'active_energy',
        'respiratory_rate', 'vo2_max'
    )),
    value REAL NOT NULL,
    value_secondary REAL,
    unit TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'apple_health', 'health_connect', 'imported')),
    recorded_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// -- 3. Sleep Sessions --
export const CREATE_SLEEP_SESSIONS = `
CREATE TABLE IF NOT EXISTS hl_sleep_sessions (
    id TEXT PRIMARY KEY,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    deep_minutes INTEGER,
    rem_minutes INTEGER,
    light_minutes INTEGER,
    awake_minutes INTEGER,
    quality_score REAL,
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'apple_health', 'health_connect', 'imported')),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// -- 4. Sync Log (cursor tracking for incremental health data import) --
export const CREATE_SYNC_LOG = `
CREATE TABLE IF NOT EXISTS hl_sync_log (
    data_type TEXT PRIMARY KEY,
    last_sync_at TEXT NOT NULL,
    last_anchor TEXT,
    records_synced INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// -- 5. Goals (cross-domain health goals spanning fasting, weight, steps, sleep, adherence) --
export const CREATE_GOALS = `
CREATE TABLE IF NOT EXISTS hl_goals (
    id TEXT PRIMARY KEY,
    domain TEXT NOT NULL CHECK (domain IN ('fasting', 'weight', 'steps', 'sleep', 'adherence', 'water', 'vitals', 'custom')),
    metric TEXT NOT NULL,
    target_value REAL NOT NULL,
    unit TEXT,
    period TEXT NOT NULL DEFAULT 'daily' CHECK (period IN ('daily', 'weekly', 'monthly')),
    direction TEXT NOT NULL DEFAULT 'at_least' CHECK (direction IN ('at_least', 'at_most', 'exactly')),
    label TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    start_date TEXT NOT NULL,
    end_date TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// -- 6. Goal Progress --
export const CREATE_GOAL_PROGRESS = `
CREATE TABLE IF NOT EXISTS hl_goal_progress (
    id TEXT PRIMARY KEY,
    goal_id TEXT NOT NULL REFERENCES hl_goals(id) ON DELETE CASCADE,
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    current_value REAL NOT NULL,
    target_value REAL NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// -- 7. Emergency Info (singleton ICE card) --
export const CREATE_EMERGENCY_INFO = `
CREATE TABLE IF NOT EXISTS hl_emergency_info (
    id TEXT PRIMARY KEY DEFAULT 'profile',
    full_name TEXT,
    date_of_birth TEXT,
    blood_type TEXT CHECK (blood_type IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', NULL)),
    allergies TEXT,
    conditions TEXT,
    emergency_contacts TEXT,
    insurance_provider TEXT,
    insurance_policy_number TEXT,
    insurance_group_number TEXT,
    primary_physician TEXT,
    physician_phone TEXT,
    organ_donor INTEGER,
    notes TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// -- 8. Settings (consolidated health settings) --
export const CREATE_SETTINGS = `
CREATE TABLE IF NOT EXISTS hl_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// -- Indexes --
export const CREATE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS hl_documents_type_idx ON hl_documents(type)`,
  `CREATE INDEX IF NOT EXISTS hl_documents_starred_idx ON hl_documents(is_starred)`,
  `CREATE INDEX IF NOT EXISTS hl_documents_date_idx ON hl_documents(document_date)`,
  `CREATE INDEX IF NOT EXISTS hl_vitals_type_date_idx ON hl_vitals(vital_type, recorded_at)`,
  `CREATE INDEX IF NOT EXISTS hl_vitals_source_idx ON hl_vitals(source)`,
  `CREATE INDEX IF NOT EXISTS hl_sleep_start_idx ON hl_sleep_sessions(start_time)`,
  `CREATE INDEX IF NOT EXISTS hl_sleep_end_idx ON hl_sleep_sessions(end_time)`,
  `CREATE INDEX IF NOT EXISTS hl_goals_active_idx ON hl_goals(is_active)`,
  `CREATE INDEX IF NOT EXISTS hl_goals_domain_idx ON hl_goals(domain)`,
  `CREATE INDEX IF NOT EXISTS hl_goal_progress_goal_idx ON hl_goal_progress(goal_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS hl_goal_progress_unique_period_idx ON hl_goal_progress(goal_id, period_start, period_end)`,
];

/** All table creation statements in dependency order. */
export const ALL_TABLES = [
  CREATE_DOCUMENTS,
  CREATE_VITALS,
  CREATE_SLEEP_SESSIONS,
  CREATE_SYNC_LOG,
  CREATE_GOALS,
  CREATE_GOAL_PROGRESS,
  CREATE_EMERGENCY_INFO,
  CREATE_SETTINGS,
];

// ---------------------------------------------------------------------------
// V2 Tables -- 14 A-tier features (9 new tables)
// ---------------------------------------------------------------------------

// -- 9. Breathing Sessions --
export const CREATE_BREATHING_SESSIONS = `
CREATE TABLE IF NOT EXISTS hl_breathing_sessions (
    id TEXT PRIMARY KEY,
    pattern TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL,
    cycles_completed INTEGER NOT NULL,
    completed INTEGER NOT NULL DEFAULT 1,
    mood_before INTEGER,
    mood_after INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// -- 10. Readiness Scores --
export const CREATE_READINESS_SCORES = `
CREATE TABLE IF NOT EXISTS hl_readiness_scores (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL UNIQUE,
    score INTEGER NOT NULL,
    sleep_factor REAL NOT NULL,
    hrv_factor REAL NOT NULL,
    rhr_factor REAL NOT NULL,
    activity_factor REAL NOT NULL,
    strain_factor REAL NOT NULL,
    recommendation TEXT NOT NULL,
    data_completeness REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// -- 11. Activity Summaries --
export const CREATE_ACTIVITY_SUMMARIES = `
CREATE TABLE IF NOT EXISTS hl_activity_summaries (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL UNIQUE,
    steps INTEGER NOT NULL DEFAULT 0,
    steps_goal INTEGER NOT NULL DEFAULT 10000,
    active_energy_cal REAL NOT NULL DEFAULT 0,
    active_energy_goal REAL NOT NULL DEFAULT 500,
    move_minutes INTEGER NOT NULL DEFAULT 0,
    move_minutes_goal INTEGER NOT NULL DEFAULT 30,
    distance_meters REAL,
    floors_climbed INTEGER,
    source TEXT NOT NULL DEFAULT 'manual',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// -- 12. CBT Entries --
export const CREATE_CBT_ENTRIES = `
CREATE TABLE IF NOT EXISTS hl_cbt_entries (
    id TEXT PRIMARY KEY,
    exercise_type TEXT NOT NULL,
    prompt TEXT NOT NULL,
    response TEXT NOT NULL,
    mood_before INTEGER,
    mood_after INTEGER,
    tags TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// -- 13. Meditation Sessions --
export const CREATE_MEDITATION_SESSIONS = `
CREATE TABLE IF NOT EXISTS hl_meditation_sessions (
    id TEXT PRIMARY KEY,
    meditation_type TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL,
    completed INTEGER NOT NULL DEFAULT 1,
    mood_before INTEGER,
    mood_after INTEGER,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// -- 14. Body Measurements --
export const CREATE_BODY_MEASUREMENTS = `
CREATE TABLE IF NOT EXISTS hl_body_measurements (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    weight_kg REAL,
    body_fat_percent REAL,
    lean_mass_kg REAL,
    bmi REAL,
    waist_cm REAL,
    hip_cm REAL,
    chest_cm REAL,
    height_cm REAL,
    source TEXT NOT NULL DEFAULT 'manual',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// -- 15. SOS Sessions --
export const CREATE_SOS_SESSIONS = `
CREATE TABLE IF NOT EXISTS hl_sos_sessions (
    id TEXT PRIMARY KEY,
    trigger_source TEXT NOT NULL DEFAULT 'manual',
    tools_used TEXT,
    duration_seconds INTEGER,
    mood_before INTEGER,
    mood_after INTEGER,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// -- 16. Sleep Routines --
export const CREATE_SLEEP_ROUTINES = `
CREATE TABLE IF NOT EXISTS hl_sleep_routines (
    id TEXT PRIMARY KEY,
    routine_type TEXT NOT NULL,
    routine_name TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL,
    completed INTEGER NOT NULL DEFAULT 1,
    sleep_session_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// -- 17. Import Log --
export const CREATE_IMPORT_LOG = `
CREATE TABLE IF NOT EXISTS hl_import_log (
    id TEXT PRIMARY KEY,
    source_name TEXT NOT NULL,
    file_name TEXT,
    records_imported INTEGER NOT NULL DEFAULT 0,
    records_skipped INTEGER NOT NULL DEFAULT 0,
    records_conflicted INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'completed',
    error_message TEXT,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT
)`;

// V2 table array
export const V2_ALL_TABLES = [
  CREATE_BREATHING_SESSIONS,
  CREATE_READINESS_SCORES,
  CREATE_ACTIVITY_SUMMARIES,
  CREATE_CBT_ENTRIES,
  CREATE_MEDITATION_SESSIONS,
  CREATE_BODY_MEASUREMENTS,
  CREATE_SOS_SESSIONS,
  CREATE_SLEEP_ROUTINES,
  CREATE_IMPORT_LOG,
];

// V2 indexes
export const V2_INDEXES = [
  `CREATE INDEX IF NOT EXISTS hl_breathing_date_idx ON hl_breathing_sessions(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS hl_breathing_pattern_idx ON hl_breathing_sessions(pattern)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS hl_readiness_date_idx ON hl_readiness_scores(date)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS hl_activity_date_idx ON hl_activity_summaries(date)`,
  `CREATE INDEX IF NOT EXISTS hl_cbt_type_idx ON hl_cbt_entries(exercise_type)`,
  `CREATE INDEX IF NOT EXISTS hl_cbt_date_idx ON hl_cbt_entries(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS hl_meditation_date_idx ON hl_meditation_sessions(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS hl_meditation_type_idx ON hl_meditation_sessions(meditation_type)`,
  `CREATE INDEX IF NOT EXISTS hl_body_date_idx ON hl_body_measurements(date DESC)`,
  `CREATE INDEX IF NOT EXISTS hl_sos_date_idx ON hl_sos_sessions(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS hl_routine_date_idx ON hl_sleep_routines(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS hl_routine_sleep_idx ON hl_sleep_routines(sleep_session_id)`,
  `CREATE INDEX IF NOT EXISTS hl_import_source_idx ON hl_import_log(source_name)`,
  `CREATE INDEX IF NOT EXISTS hl_import_date_idx ON hl_import_log(started_at DESC)`,
];

// V2 seeds
export const V2_SEEDS = [
  `INSERT OR IGNORE INTO hl_settings (key, value) VALUES ('activity.stepsGoal', '10000')`,
  `INSERT OR IGNORE INTO hl_settings (key, value) VALUES ('activity.activeEnergyGoal', '500')`,
  `INSERT OR IGNORE INTO hl_settings (key, value) VALUES ('activity.moveMinutesGoal', '30')`,
  `INSERT OR IGNORE INTO hl_settings (key, value) VALUES ('bedtime.reminderEnabled', 'false')`,
  `INSERT OR IGNORE INTO hl_settings (key, value) VALUES ('bedtime.targetTime', '22:30')`,
];

// ---------------------------------------------------------------------------
// V3 Tables -- 3 B+C features (4 new tables)
// ---------------------------------------------------------------------------

// -- 18. Smart Alarms --
export const CREATE_SMART_ALARMS = `
CREATE TABLE IF NOT EXISTS hl_smart_alarms (
    id TEXT PRIMARY KEY,
    target_time TEXT NOT NULL,
    wake_window_minutes INTEGER NOT NULL DEFAULT 20,
    is_enabled INTEGER NOT NULL DEFAULT 1,
    days_of_week TEXT NOT NULL DEFAULT '1,2,3,4,5',
    sound TEXT NOT NULL DEFAULT 'gentle_rise',
    vibration INTEGER NOT NULL DEFAULT 1,
    snooze_enabled INTEGER NOT NULL DEFAULT 1,
    snooze_duration_minutes INTEGER NOT NULL DEFAULT 5,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// -- 19. Alarm History --
export const CREATE_ALARM_HISTORY = `
CREATE TABLE IF NOT EXISTS hl_alarm_history (
    id TEXT PRIMARY KEY,
    alarm_id TEXT NOT NULL REFERENCES hl_smart_alarms(id) ON DELETE CASCADE,
    scheduled_time TEXT NOT NULL,
    actual_trigger_time TEXT,
    trigger_reason TEXT NOT NULL,
    sleep_stage_at_trigger TEXT,
    snoozed INTEGER NOT NULL DEFAULT 0,
    snooze_count INTEGER NOT NULL DEFAULT 0,
    dismissed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// -- 20. Snore Sessions --
export const CREATE_SNORE_SESSIONS = `
CREATE TABLE IF NOT EXISTS hl_snore_sessions (
    id TEXT PRIMARY KEY,
    sleep_session_id TEXT,
    start_time TEXT NOT NULL,
    end_time TEXT,
    duration_minutes INTEGER,
    snore_score INTEGER,
    snore_minutes INTEGER DEFAULT 0,
    snore_percentage REAL,
    loudest_db REAL,
    average_db REAL,
    event_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'recording',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// -- 21. Snore Events --
export const CREATE_SNORE_EVENTS = `
CREATE TABLE IF NOT EXISTS hl_snore_events (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES hl_snore_sessions(id) ON DELETE CASCADE,
    timestamp TEXT NOT NULL,
    duration_seconds REAL NOT NULL,
    intensity TEXT NOT NULL,
    decibels REAL,
    audio_clip_path TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// V3 table array
export const V3_ALL_TABLES = [
  CREATE_SMART_ALARMS,
  CREATE_ALARM_HISTORY,
  CREATE_SNORE_SESSIONS,
  CREATE_SNORE_EVENTS,
];

// V3 indexes
export const V3_INDEXES = [
  `CREATE INDEX IF NOT EXISTS hl_alarm_enabled_idx ON hl_smart_alarms(is_enabled)`,
  `CREATE INDEX IF NOT EXISTS hl_alarm_history_date_idx ON hl_alarm_history(scheduled_time DESC)`,
  `CREATE INDEX IF NOT EXISTS hl_alarm_history_alarm_idx ON hl_alarm_history(alarm_id)`,
  `CREATE INDEX IF NOT EXISTS hl_snore_session_date_idx ON hl_snore_sessions(start_time DESC)`,
  `CREATE INDEX IF NOT EXISTS hl_snore_session_sleep_idx ON hl_snore_sessions(sleep_session_id)`,
  `CREATE INDEX IF NOT EXISTS hl_snore_event_session_idx ON hl_snore_events(session_id)`,
  `CREATE INDEX IF NOT EXISTS hl_snore_event_time_idx ON hl_snore_events(timestamp)`,
];

/** Default settings for health module. */
export const SEED_SETTINGS = [
  `INSERT OR IGNORE INTO hl_settings (key, value) VALUES ('healthSync.enabled', 'false')`,
  `INSERT OR IGNORE INTO hl_settings (key, value) VALUES ('healthSync.heartRate', 'true')`,
  `INSERT OR IGNORE INTO hl_settings (key, value) VALUES ('healthSync.restingHeartRate', 'true')`,
  `INSERT OR IGNORE INTO hl_settings (key, value) VALUES ('healthSync.hrv', 'true')`,
  `INSERT OR IGNORE INTO hl_settings (key, value) VALUES ('healthSync.bloodOxygen', 'true')`,
  `INSERT OR IGNORE INTO hl_settings (key, value) VALUES ('healthSync.bloodPressure', 'false')`,
  `INSERT OR IGNORE INTO hl_settings (key, value) VALUES ('healthSync.bodyTemperature', 'false')`,
  `INSERT OR IGNORE INTO hl_settings (key, value) VALUES ('healthSync.steps', 'true')`,
  `INSERT OR IGNORE INTO hl_settings (key, value) VALUES ('healthSync.activeEnergy', 'true')`,
  `INSERT OR IGNORE INTO hl_settings (key, value) VALUES ('healthSync.sleep', 'true')`,
  `INSERT OR IGNORE INTO hl_settings (key, value) VALUES ('healthSync.respiratoryRate', 'false')`,
  `INSERT OR IGNORE INTO hl_settings (key, value) VALUES ('healthSync.weight', 'true')`,
  `INSERT OR IGNORE INTO hl_settings (key, value) VALUES ('units.weight', 'lbs')`,
  `INSERT OR IGNORE INTO hl_settings (key, value) VALUES ('units.temperature', 'F')`,
  `INSERT OR IGNORE INTO hl_settings (key, value) VALUES ('units.height', 'ft')`,
  `INSERT OR IGNORE INTO hl_settings (key, value) VALUES ('sleep.targetHours', '8')`,
  `INSERT OR IGNORE INTO hl_settings (key, value) VALUES ('notifications.medicationReminders', 'true')`,
  `INSERT OR IGNORE INTO hl_settings (key, value) VALUES ('notifications.goalProgress', 'true')`,
];
