// ── V1 Tables (Phase 1: Core Tracking) ────────────────────────────────────

export const CREATE_DAILY_USAGE = `
CREATE TABLE IF NOT EXISTS pr_daily_usage (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL UNIQUE,
    total_minutes REAL NOT NULL DEFAULT 0,
    goal_minutes INTEGER,
    goal_met INTEGER NOT NULL DEFAULT 0,
    pickups INTEGER NOT NULL DEFAULT 0,
    first_pickup TEXT,
    last_pickup TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_APP_USAGE = `
CREATE TABLE IF NOT EXISTS pr_app_usage (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    app_id TEXT NOT NULL,
    app_name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'other',
    minutes REAL NOT NULL DEFAULT 0,
    opens INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_GOALS = `
CREATE TABLE IF NOT EXISTS pr_goals (
    id TEXT PRIMARY KEY,
    daily_minutes INTEGER NOT NULL,
    effective_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_SESSIONS = `
CREATE TABLE IF NOT EXISTS pr_sessions (
    id TEXT PRIMARY KEY,
    start_time TEXT NOT NULL,
    end_time TEXT,
    planned_minutes INTEGER NOT NULL,
    actual_minutes REAL,
    completed INTEGER NOT NULL DEFAULT 0,
    type TEXT NOT NULL DEFAULT 'solo',
    rating INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_SESSION_WHITELIST = `
CREATE TABLE IF NOT EXISTS pr_session_whitelist (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES pr_sessions(id) ON DELETE CASCADE,
    app_id TEXT NOT NULL,
    app_name TEXT NOT NULL
)`;

export const CREATE_APP_INTENTIONS = `
CREATE TABLE IF NOT EXISTS pr_app_intentions (
    id TEXT PRIMARY KEY,
    app_id TEXT NOT NULL,
    app_name TEXT NOT NULL,
    daily_open_limit INTEGER,
    per_open_minutes INTEGER,
    breathing_pause INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_APP_OPENS = `
CREATE TABLE IF NOT EXISTS pr_app_opens (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    app_id TEXT NOT NULL,
    opened_at TEXT NOT NULL,
    intention_text TEXT,
    post_rating INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_XP_LOG = `
CREATE TABLE IF NOT EXISTS pr_xp_log (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    source TEXT NOT NULL,
    amount INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_SETTINGS = `
CREATE TABLE IF NOT EXISTS pr_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// ── V1 Indexes ────────────────────────────────────────────────────────────

export const CREATE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_pr_daily_usage_date ON pr_daily_usage(date)`,
  `CREATE INDEX IF NOT EXISTS idx_pr_app_usage_date ON pr_app_usage(date)`,
  `CREATE INDEX IF NOT EXISTS idx_pr_app_usage_app ON pr_app_usage(app_id, date)`,
  `CREATE INDEX IF NOT EXISTS idx_pr_sessions_date ON pr_sessions(start_time)`,
  `CREATE INDEX IF NOT EXISTS idx_pr_app_opens_date ON pr_app_opens(date, app_id)`,
  `CREATE INDEX IF NOT EXISTS idx_pr_xp_log_date ON pr_xp_log(date)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_pr_app_intentions_app ON pr_app_intentions(app_id)`,
];

// ── V1 Seeds ──────────────────────────────────────────────────────────────

export const SEED_SETTINGS = [
  `INSERT OR IGNORE INTO pr_settings (key, value) VALUES ('daily_goal_minutes', '180')`,
  `INSERT OR IGNORE INTO pr_settings (key, value) VALUES ('daily_report_reminder_enabled', '1')`,
  `INSERT OR IGNORE INTO pr_settings (key, value) VALUES ('daily_report_reminder_time', '20:30')`,
  `INSERT OR IGNORE INTO pr_settings (key, value) VALUES ('scroll_alert_interval_minutes', '60')`,
  `INSERT OR IGNORE INTO pr_settings (key, value) VALUES ('progressive_alerts_enabled', '1')`,
  `INSERT OR IGNORE INTO pr_settings (key, value) VALUES ('focus_session_reminders_enabled', '1')`,
  `INSERT OR IGNORE INTO pr_settings (key, value) VALUES ('morning_briefing_enabled', '1')`,
  `INSERT OR IGNORE INTO pr_settings (key, value) VALUES ('morning_briefing_time', '07:30')`,
  `INSERT OR IGNORE INTO pr_settings (key, value) VALUES ('bedtime_wind_down_enabled', '0')`,
  `INSERT OR IGNORE INTO pr_settings (key, value) VALUES ('bedtime_time', '22:00')`,
  `INSERT OR IGNORE INTO pr_settings (key, value) VALUES ('streak_reminders_enabled', '1')`,
  `INSERT OR IGNORE INTO pr_settings (key, value) VALUES ('time_display_mode', 'clock')`,
  `INSERT OR IGNORE INTO pr_settings (key, value) VALUES ('onboarding_completed', '0')`,
];

// ── Aggregates ────────────────────────────────────────────────────────────

export const ALL_TABLES = [
  CREATE_DAILY_USAGE,
  CREATE_APP_USAGE,
  CREATE_GOALS,
  CREATE_SESSIONS,
  CREATE_SESSION_WHITELIST,
  CREATE_APP_INTENTIONS,
  CREATE_APP_OPENS,
  CREATE_XP_LOG,
  CREATE_SETTINGS,
];

// ── V2 Tables (Phase 4: Gap Fillers) ─────────────────────────────────────

export const ALTER_APP_OPENS_ADD_REFLECTION_NOTE = `
ALTER TABLE pr_app_opens ADD COLUMN reflection_note TEXT
`;

export const CREATE_SCHEDULED_SESSIONS = `
CREATE TABLE IF NOT EXISTS pr_scheduled_sessions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    start_time TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    days_of_week TEXT NOT NULL,
    whitelist_json TEXT,
    session_type TEXT NOT NULL DEFAULT 'solo',
    active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
)`;

export const CREATE_BADGES = `
CREATE TABLE IF NOT EXISTS pr_badges (
    id TEXT PRIMARY KEY,
    badge_id TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    tier TEXT NOT NULL DEFAULT 'bronze',
    earned_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
)`;

export const CREATE_ACCOUNTABILITY_PARTNERS = `
CREATE TABLE IF NOT EXISTS pr_accountability_partners (
    id TEXT PRIMARY KEY,
    partner_name TEXT NOT NULL,
    share_code TEXT NOT NULL UNIQUE,
    active INTEGER NOT NULL DEFAULT 1,
    notify_over_goal INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL
)`;

export const CREATE_REWARDS = `
CREATE TABLE IF NOT EXISTS pr_rewards (
    id TEXT PRIMARY KEY,
    milestone_type TEXT NOT NULL,
    milestone_value INTEGER NOT NULL,
    reward_text TEXT NOT NULL,
    earned INTEGER NOT NULL DEFAULT 0,
    earned_at INTEGER,
    created_at INTEGER NOT NULL
)`;

export const CREATE_COMMITMENT_CONTRACTS = `
CREATE TABLE IF NOT EXISTS pr_commitment_contracts (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
)`;

export const V2_TABLES = [
  ALTER_APP_OPENS_ADD_REFLECTION_NOTE,
  CREATE_SCHEDULED_SESSIONS,
  CREATE_BADGES,
  CREATE_ACCOUNTABILITY_PARTNERS,
  CREATE_REWARDS,
  CREATE_COMMITMENT_CONTRACTS,
];

export const V2_INDEXES = [
  `CREATE INDEX IF NOT EXISTS pr_scheduled_active_idx ON pr_scheduled_sessions(active)`,
  `CREATE INDEX IF NOT EXISTS pr_badges_category_idx ON pr_badges(category)`,
  `CREATE INDEX IF NOT EXISTS pr_partners_active_idx ON pr_accountability_partners(active)`,
  `CREATE INDEX IF NOT EXISTS pr_rewards_earned_idx ON pr_rewards(earned, milestone_type)`,
  `CREATE INDEX IF NOT EXISTS pr_commitment_active_idx ON pr_commitment_contracts(active, updated_at DESC)`,
];
