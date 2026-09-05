/**
 * SQLite schema for MyFast module.
 * All table names use the ft_ prefix to avoid collisions in the shared hub database.
 *
 * UUIDs stored as TEXT.
 * Dates stored as TEXT in ISO datetime format.
 * Booleans stored as INTEGER (0/1).
 */

// -- 1. Fasts --
export const CREATE_FASTS = `
CREATE TABLE IF NOT EXISTS ft_fasts (
    id TEXT PRIMARY KEY,
    protocol TEXT NOT NULL,
    target_hours REAL NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    duration_seconds INTEGER,
    hit_target INTEGER,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// -- 2. Weight Entries --
export const CREATE_WEIGHT_ENTRIES = `
CREATE TABLE IF NOT EXISTS ft_weight_entries (
    id TEXT PRIMARY KEY,
    weight_value REAL NOT NULL,
    unit TEXT NOT NULL DEFAULT 'lbs',
    date TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// -- 3. Protocols --
export const CREATE_PROTOCOLS = `
CREATE TABLE IF NOT EXISTS ft_protocols (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    fasting_hours REAL NOT NULL,
    eating_hours REAL NOT NULL,
    description TEXT,
    is_custom INTEGER NOT NULL DEFAULT 0,
    is_default INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0
)`;

// -- 4. Streak Cache --
export const CREATE_STREAK_CACHE = `
CREATE TABLE IF NOT EXISTS ft_streak_cache (
    key TEXT PRIMARY KEY,
    value INTEGER NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// -- 5. Active Fast (singleton) --
export const CREATE_ACTIVE_FAST = `
CREATE TABLE IF NOT EXISTS ft_active_fast (
    id TEXT PRIMARY KEY DEFAULT 'current',
    fast_id TEXT NOT NULL REFERENCES ft_fasts(id) ON DELETE CASCADE,
    protocol TEXT NOT NULL,
    target_hours REAL NOT NULL,
    started_at TEXT NOT NULL
)`;

// -- 6. Settings --
export const CREATE_SETTINGS = `
CREATE TABLE IF NOT EXISTS ft_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
)`;

// -- 7. Water Intake --
export const CREATE_WATER_INTAKE = `
CREATE TABLE IF NOT EXISTS ft_water_intake (
    date TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0,
    target INTEGER NOT NULL DEFAULT 8,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// -- 8. Goals --
export const CREATE_GOALS = `
CREATE TABLE IF NOT EXISTS ft_goals (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    target_value REAL NOT NULL,
    period TEXT NOT NULL,
    direction TEXT NOT NULL DEFAULT 'at_least',
    label TEXT,
    unit TEXT,
    start_date TEXT NOT NULL,
    end_date TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// -- 9. Goal Progress --
export const CREATE_GOAL_PROGRESS = `
CREATE TABLE IF NOT EXISTS ft_goal_progress (
    id TEXT PRIMARY KEY,
    goal_id TEXT NOT NULL REFERENCES ft_goals(id) ON DELETE CASCADE,
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    current_value REAL NOT NULL,
    target_value REAL NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// -- 10. Notifications Config --
export const CREATE_NOTIFICATIONS_CONFIG = `
CREATE TABLE IF NOT EXISTS ft_notifications_config (
    key TEXT PRIMARY KEY,
    enabled INTEGER NOT NULL DEFAULT 1
)`;

// -- Indexes --
export const CREATE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS ft_fasts_started_idx ON ft_fasts(started_at)`,
  `CREATE INDEX IF NOT EXISTS ft_fasts_protocol_idx ON ft_fasts(protocol)`,
  `CREATE INDEX IF NOT EXISTS ft_fasts_hit_target_idx ON ft_fasts(hit_target)`,
  `CREATE INDEX IF NOT EXISTS ft_weight_date_idx ON ft_weight_entries(date)`,
  `CREATE INDEX IF NOT EXISTS ft_water_updated_idx ON ft_water_intake(updated_at)`,
  `CREATE INDEX IF NOT EXISTS ft_goals_active_idx ON ft_goals(is_active)`,
  `CREATE INDEX IF NOT EXISTS ft_goals_type_idx ON ft_goals(type)`,
  `CREATE INDEX IF NOT EXISTS ft_goal_progress_goal_idx ON ft_goal_progress(goal_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS ft_goal_progress_unique_period_idx ON ft_goal_progress(goal_id, period_start, period_end)`,
];

/** All table creation statements in dependency order */
export const ALL_TABLES = [
  CREATE_FASTS,
  CREATE_WEIGHT_ENTRIES,
  CREATE_PROTOCOLS,
  CREATE_STREAK_CACHE,
  CREATE_ACTIVE_FAST,
  CREATE_SETTINGS,
  CREATE_WATER_INTAKE,
  CREATE_GOALS,
  CREATE_GOAL_PROGRESS,
  CREATE_NOTIFICATIONS_CONFIG,
];

/** Seed SQL for the 6 preset fasting protocols */
export const SEED_PROTOCOLS = [
  `INSERT OR IGNORE INTO ft_protocols (id, name, fasting_hours, eating_hours, description, sort_order, is_default) VALUES ('16:8', 'Lean Gains (16:8)', 16, 8, 'Fast 16 hours, eat within an 8-hour window. Most popular protocol for beginners.', 1, 1)`,
  `INSERT OR IGNORE INTO ft_protocols (id, name, fasting_hours, eating_hours, description, sort_order, is_default) VALUES ('18:6', 'Daily 18:6', 18, 6, 'Fast 18 hours, eat within a 6-hour window. Moderate intensity.', 2, 0)`,
  `INSERT OR IGNORE INTO ft_protocols (id, name, fasting_hours, eating_hours, description, sort_order, is_default) VALUES ('20:4', 'Warrior (20:4)', 20, 4, 'Fast 20 hours, eat within a 4-hour window. One main meal with snacks.', 3, 0)`,
  `INSERT OR IGNORE INTO ft_protocols (id, name, fasting_hours, eating_hours, description, sort_order, is_default) VALUES ('23:1', 'OMAD (23:1)', 23, 1, 'One Meal A Day. Fast 23 hours, single eating hour.', 4, 0)`,
  `INSERT OR IGNORE INTO ft_protocols (id, name, fasting_hours, eating_hours, description, sort_order, is_default) VALUES ('36:0', 'Alternate Day (36h)', 36, 0, 'Full 36-hour fast. Skip an entire day of eating.', 5, 0)`,
  `INSERT OR IGNORE INTO ft_protocols (id, name, fasting_hours, eating_hours, description, sort_order, is_default) VALUES ('48:0', 'Extended (48h)', 48, 0, 'Full 48-hour fast. Two days without eating.', 6, 0)`,
];

/** Seed SQL for default settings */
export const SEED_SETTINGS = [
  `INSERT OR IGNORE INTO ft_settings (key, value) VALUES ('defaultProtocol', '16:8')`,
  `INSERT OR IGNORE INTO ft_settings (key, value) VALUES ('notifyFastComplete', 'true')`,
  `INSERT OR IGNORE INTO ft_settings (key, value) VALUES ('notifyEatingWindowClosing', 'false')`,
  `INSERT OR IGNORE INTO ft_settings (key, value) VALUES ('weightTrackingEnabled', 'false')`,
  `INSERT OR IGNORE INTO ft_settings (key, value) VALUES ('weightUnit', 'lbs')`,
  `INSERT OR IGNORE INTO ft_settings (key, value) VALUES ('waterDailyTarget', '8')`,
  `INSERT OR IGNORE INTO ft_settings (key, value) VALUES ('healthSyncEnabled', 'false')`,
  `INSERT OR IGNORE INTO ft_settings (key, value) VALUES ('healthReadWeight', 'false')`,
  `INSERT OR IGNORE INTO ft_settings (key, value) VALUES ('healthReadActivity', 'false')`,
  `INSERT OR IGNORE INTO ft_settings (key, value) VALUES ('healthWriteFasts', 'false')`,
  `INSERT OR IGNORE INTO ft_settings (key, value) VALUES ('healthLastSyncTimestamp', '')`,
  `INSERT OR IGNORE INTO ft_settings (key, value) VALUES ('waterRemindersEnabled', 'false')`,
  `INSERT OR IGNORE INTO ft_settings (key, value) VALUES ('waterReminderInterval', '60')`,
  `INSERT OR IGNORE INTO ft_settings (key, value) VALUES ('waterWakeStart', '07:00')`,
  `INSERT OR IGNORE INTO ft_settings (key, value) VALUES ('waterWakeEnd', '22:00')`,
  `INSERT OR IGNORE INTO ft_settings (key, value) VALUES ('waterPauseDuringDryFast', 'false')`,
  `INSERT OR IGNORE INTO ft_settings (key, value) VALUES ('waterPersonalizedGoal', 'false')`,
];

/** Migration v3: Add source column to ft_weight_entries + new settings seeds */
export const MIGRATION_V3_UP = [
  `ALTER TABLE ft_weight_entries ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'`,
];

// -- 11. Beverage Types --
export const CREATE_BEVERAGE_TYPES = `
CREATE TABLE IF NOT EXISTS ft_beverage_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT NOT NULL,
    default_oz REAL NOT NULL DEFAULT 8.0,
    coefficient REAL NOT NULL DEFAULT 1.0,
    caffeine_mg REAL,
    is_builtin INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// -- 12. Beverage Log --
// No FK constraint on beverage_type_id: orphaned logs survive type deletion.
export const CREATE_BEVERAGE_LOG = `
CREATE TABLE IF NOT EXISTS ft_beverage_log (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    beverage_type_id TEXT NOT NULL,
    volume_oz REAL NOT NULL,
    hydration_oz REAL NOT NULL,
    logged_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// -- 13. Container Presets --
export const CREATE_CONTAINER_PRESETS = `
CREATE TABLE IF NOT EXISTS ft_container_presets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    volume_oz REAL NOT NULL,
    icon TEXT NOT NULL DEFAULT '🫗',
    is_builtin INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

/** V4 table creation statements */
export const MIGRATION_V4_TABLES = [
  CREATE_BEVERAGE_TYPES,
  CREATE_BEVERAGE_LOG,
  CREATE_CONTAINER_PRESETS,
];

/** V4 indexes */
export const MIGRATION_V4_INDEXES = [
  `CREATE INDEX IF NOT EXISTS ft_beverage_log_date_idx ON ft_beverage_log(date)`,
  `CREATE INDEX IF NOT EXISTS ft_beverage_log_type_idx ON ft_beverage_log(beverage_type_id)`,
  `CREATE INDEX IF NOT EXISTS ft_container_sort_idx ON ft_container_presets(sort_order)`,
];

/** Seed SQL for built-in beverage types */
export const SEED_BEVERAGE_TYPES = [
  `INSERT OR IGNORE INTO ft_beverage_types (id, name, icon, default_oz, coefficient, caffeine_mg, is_builtin, sort_order) VALUES ('water', 'Water', '💧', 8.0, 1.0, NULL, 1, 1)`,
  `INSERT OR IGNORE INTO ft_beverage_types (id, name, icon, default_oz, coefficient, caffeine_mg, is_builtin, sort_order) VALUES ('herbal_tea', 'Herbal Tea', '🍵', 8.0, 1.0, 0, 1, 2)`,
  `INSERT OR IGNORE INTO ft_beverage_types (id, name, icon, default_oz, coefficient, caffeine_mg, is_builtin, sort_order) VALUES ('green_tea', 'Green Tea', '🍃', 8.0, 0.95, 28, 1, 3)`,
  `INSERT OR IGNORE INTO ft_beverage_types (id, name, icon, default_oz, coefficient, caffeine_mg, is_builtin, sort_order) VALUES ('black_tea', 'Black Tea', '☕', 8.0, 0.9, 47, 1, 4)`,
  `INSERT OR IGNORE INTO ft_beverage_types (id, name, icon, default_oz, coefficient, caffeine_mg, is_builtin, sort_order) VALUES ('coffee', 'Coffee', '☕', 8.0, 0.8, 95, 1, 5)`,
  `INSERT OR IGNORE INTO ft_beverage_types (id, name, icon, default_oz, coefficient, caffeine_mg, is_builtin, sort_order) VALUES ('espresso', 'Espresso', '☕', 2.0, 0.8, 63, 1, 6)`,
  `INSERT OR IGNORE INTO ft_beverage_types (id, name, icon, default_oz, coefficient, caffeine_mg, is_builtin, sort_order) VALUES ('sparkling', 'Sparkling Water', '🫧', 12.0, 1.0, NULL, 1, 7)`,
  `INSERT OR IGNORE INTO ft_beverage_types (id, name, icon, default_oz, coefficient, caffeine_mg, is_builtin, sort_order) VALUES ('juice', 'Juice', '🧃', 8.0, 0.95, NULL, 1, 8)`,
  `INSERT OR IGNORE INTO ft_beverage_types (id, name, icon, default_oz, coefficient, caffeine_mg, is_builtin, sort_order) VALUES ('milk', 'Milk', '🥛', 8.0, 0.9, NULL, 1, 9)`,
  `INSERT OR IGNORE INTO ft_beverage_types (id, name, icon, default_oz, coefficient, caffeine_mg, is_builtin, sort_order) VALUES ('alcohol', 'Alcohol', '🍺', 12.0, -0.5, NULL, 1, 10)`,
  `INSERT OR IGNORE INTO ft_beverage_types (id, name, icon, default_oz, coefficient, caffeine_mg, is_builtin, sort_order) VALUES ('sports_drink', 'Sports Drink', '⚡', 12.0, 1.05, NULL, 1, 11)`,
  `INSERT OR IGNORE INTO ft_beverage_types (id, name, icon, default_oz, coefficient, caffeine_mg, is_builtin, sort_order) VALUES ('other', 'Other', '🥤', 8.0, 1.0, NULL, 1, 12)`,
];

/** Seed SQL for built-in container presets */
export const SEED_CONTAINER_PRESETS = [
  `INSERT OR IGNORE INTO ft_container_presets (id, name, volume_oz, icon, is_builtin, sort_order) VALUES ('small_glass', 'Small Glass', 8.0, '🥃', 1, 1)`,
  `INSERT OR IGNORE INTO ft_container_presets (id, name, volume_oz, icon, is_builtin, sort_order) VALUES ('can', 'Can', 12.0, '🥫', 1, 2)`,
  `INSERT OR IGNORE INTO ft_container_presets (id, name, volume_oz, icon, is_builtin, sort_order) VALUES ('bottle', 'Bottle', 16.0, '🧴', 1, 3)`,
  `INSERT OR IGNORE INTO ft_container_presets (id, name, volume_oz, icon, is_builtin, sort_order) VALUES ('large_bottle', 'Large Bottle', 32.0, '🫗', 1, 4)`,
  `INSERT OR IGNORE INTO ft_container_presets (id, name, volume_oz, icon, is_builtin, sort_order) VALUES ('xl_bottle', 'XL Bottle', 40.0, '🫗', 1, 5)`,
];

/** V4 settings seeds for caffeine tracking */
export const SEED_CAFFEINE_SETTINGS = [
  `INSERT OR IGNORE INTO ft_settings (key, value) VALUES ('caffeineTrackingEnabled', 'false')`,
  `INSERT OR IGNORE INTO ft_settings (key, value) VALUES ('caffeineCutoffTime', '14:00')`,
  `INSERT OR IGNORE INTO ft_settings (key, value) VALUES ('caffeineDailyLimitMg', '400')`,
];

/** Seed SQL for notification preferences */
export const SEED_NOTIFICATIONS_CONFIG = [
  `INSERT OR IGNORE INTO ft_notifications_config (key, enabled) VALUES ('fastStart', 1)`,
  `INSERT OR IGNORE INTO ft_notifications_config (key, enabled) VALUES ('progress25', 0)`,
  `INSERT OR IGNORE INTO ft_notifications_config (key, enabled) VALUES ('progress50', 1)`,
  `INSERT OR IGNORE INTO ft_notifications_config (key, enabled) VALUES ('progress75', 1)`,
  `INSERT OR IGNORE INTO ft_notifications_config (key, enabled) VALUES ('fastComplete', 1)`,
];
