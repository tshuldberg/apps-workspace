// ── V1 Tables ─────────────────────────────────────────────────────────────

export const CREATE_HABITS = `
CREATE TABLE IF NOT EXISTS hb_habits (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    color TEXT,
    frequency TEXT NOT NULL DEFAULT 'daily',
    target_count INTEGER NOT NULL DEFAULT 1,
    unit TEXT,
    is_archived INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_COMPLETIONS = `
CREATE TABLE IF NOT EXISTS hb_completions (
    id TEXT PRIMARY KEY,
    habit_id TEXT NOT NULL REFERENCES hb_habits(id) ON DELETE CASCADE,
    completed_at TEXT NOT NULL,
    value REAL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_SETTINGS = `
CREATE TABLE IF NOT EXISTS hb_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS hb_completions_habit_idx ON hb_completions(habit_id)`,
  `CREATE INDEX IF NOT EXISTS hb_completions_date_idx ON hb_completions(completed_at)`,
  `CREATE INDEX IF NOT EXISTS hb_habits_archived_idx ON hb_habits(is_archived)`,
];

export const ALL_TABLES = [CREATE_HABITS, CREATE_COMPLETIONS, CREATE_SETTINGS];

export const SEED_SETTINGS = [
  `INSERT OR IGNORE INTO hb_settings (key, value) VALUES ('weekStartsOn', 'monday')`,
];

// ── V2 Schema additions ──────────────────────────────────────────────────

export const ALTER_HABITS_V2 = [
  `ALTER TABLE hb_habits ADD COLUMN habit_type TEXT DEFAULT 'standard'`,
  `ALTER TABLE hb_habits ADD COLUMN time_of_day TEXT DEFAULT 'anytime'`,
  `ALTER TABLE hb_habits ADD COLUMN specific_days TEXT`,
  `ALTER TABLE hb_habits ADD COLUMN grace_period INTEGER DEFAULT 0`,
  `ALTER TABLE hb_habits ADD COLUMN reminder_time TEXT`,
];

export const CREATE_TIMED_SESSIONS = `
CREATE TABLE IF NOT EXISTS hb_timed_sessions (
    id TEXT PRIMARY KEY,
    habit_id TEXT NOT NULL REFERENCES hb_habits(id) ON DELETE CASCADE,
    started_at TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    target_seconds INTEGER NOT NULL DEFAULT 0,
    completed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_MEASUREMENTS = `
CREATE TABLE IF NOT EXISTS hb_measurements (
    id TEXT PRIMARY KEY,
    habit_id TEXT NOT NULL REFERENCES hb_habits(id) ON DELETE CASCADE,
    measured_at TEXT NOT NULL,
    value REAL NOT NULL,
    target REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// Note: V2 previously created hb_periods, hb_period_symptoms, hb_predictions,
// and hb_cycle_settings. Cycle tracking now lives in @mylife/cycle, so those
// tables have been removed from fresh installs and are dropped on upgrade by
// HABITS_MIGRATION_V8 in definition.ts.

export const V2_INDEXES = [
  `CREATE INDEX IF NOT EXISTS hb_timed_sessions_habit_idx ON hb_timed_sessions(habit_id)`,
  `CREATE INDEX IF NOT EXISTS hb_timed_sessions_date_idx ON hb_timed_sessions(started_at)`,
  `CREATE INDEX IF NOT EXISTS hb_measurements_habit_idx ON hb_measurements(habit_id)`,
  `CREATE INDEX IF NOT EXISTS hb_measurements_date_idx ON hb_measurements(measured_at)`,
];

export const ALL_V2_TABLES = [
  CREATE_TIMED_SESSIONS,
  CREATE_MEASUREMENTS,
];

// ── V3 Schema additions ──────────────────────────────────────────────────

export const CREATE_SOBRIETY_PROFILES = `
CREATE TABLE IF NOT EXISTS hb_sobriety_profiles (
    id TEXT PRIMARY KEY,
    habit_id TEXT NOT NULL REFERENCES hb_habits(id) ON DELETE CASCADE,
    quit_date TEXT NOT NULL,
    daily_cost INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USD',
    motivation TEXT,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(habit_id)
)`;

export const CREATE_SOBRIETY_PLEDGES = `
CREATE TABLE IF NOT EXISTS hb_sobriety_pledges (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES hb_sobriety_profiles(id) ON DELETE CASCADE,
    pledged_on TEXT NOT NULL,
    fulfilled INTEGER NOT NULL DEFAULT 0 CHECK (fulfilled IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(profile_id, pledged_on)
)`;

export const CREATE_CRAVINGS = `
CREATE TABLE IF NOT EXISTS hb_cravings (
    id TEXT PRIMARY KEY,
    habit_id TEXT NOT NULL REFERENCES hb_habits(id) ON DELETE CASCADE,
    intensity INTEGER NOT NULL CHECK (intensity >= 1 AND intensity <= 10),
    duration_minutes INTEGER,
    coping_strategy TEXT,
    outcome TEXT CHECK (outcome IN ('resisted', 'gave_in', 'distracted', 'delayed')),
    notes TEXT,
    logged_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_CRAVING_TRIGGERS = `
CREATE TABLE IF NOT EXISTS hb_craving_triggers (
    id TEXT PRIMARY KEY,
    craving_id TEXT NOT NULL REFERENCES hb_cravings(id) ON DELETE CASCADE,
    trigger_name TEXT NOT NULL,
    trigger_category TEXT NOT NULL
        CHECK (trigger_category IN ('emotional', 'social', 'environmental', 'physical', 'routine', 'custom')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_MILESTONES = `
CREATE TABLE IF NOT EXISTS hb_milestones (
    id TEXT PRIMARY KEY,
    habit_id TEXT NOT NULL REFERENCES hb_habits(id) ON DELETE CASCADE,
    milestone_type TEXT NOT NULL
        CHECK (milestone_type IN ('streak', 'total_completions', 'sobriety_days', 'sobriety_money', 'custom')),
    threshold INTEGER NOT NULL,
    label TEXT NOT NULL,
    emoji TEXT,
    achieved_at TEXT,
    dismissed INTEGER NOT NULL DEFAULT 0 CHECK (dismissed IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_FOCUS_SESSIONS = `
CREATE TABLE IF NOT EXISTS hb_focus_sessions (
    id TEXT PRIMARY KEY,
    habit_id TEXT NOT NULL REFERENCES hb_habits(id) ON DELETE CASCADE,
    work_duration INTEGER NOT NULL,
    break_duration INTEGER NOT NULL,
    rounds_target INTEGER NOT NULL DEFAULT 4,
    rounds_completed INTEGER NOT NULL DEFAULT 0,
    total_focus_seconds INTEGER NOT NULL DEFAULT 0,
    total_break_seconds INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'completed', 'abandoned')),
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_HEALTHKIT_LINKS = `
CREATE TABLE IF NOT EXISTS hb_healthkit_links (
    id TEXT PRIMARY KEY,
    habit_id TEXT NOT NULL REFERENCES hb_habits(id) ON DELETE CASCADE,
    data_source TEXT NOT NULL,
    metric TEXT NOT NULL,
    threshold REAL NOT NULL,
    comparison TEXT NOT NULL DEFAULT 'gte'
        CHECK (comparison IN ('gte', 'lte', 'eq', 'gt', 'lt')),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    last_synced_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(habit_id)
)`;

export const V3_INDEXES = [
  `CREATE INDEX IF NOT EXISTS hb_sobriety_profiles_habit_idx ON hb_sobriety_profiles(habit_id)`,
  `CREATE INDEX IF NOT EXISTS hb_sobriety_pledges_profile_date_idx ON hb_sobriety_pledges(profile_id, pledged_on DESC)`,
  `CREATE INDEX IF NOT EXISTS hb_cravings_habit_idx ON hb_cravings(habit_id)`,
  `CREATE INDEX IF NOT EXISTS hb_cravings_logged_idx ON hb_cravings(logged_at DESC)`,
  `CREATE INDEX IF NOT EXISTS hb_craving_triggers_craving_idx ON hb_craving_triggers(craving_id)`,
  `CREATE INDEX IF NOT EXISTS hb_craving_triggers_name_idx ON hb_craving_triggers(trigger_name)`,
  `CREATE INDEX IF NOT EXISTS hb_milestones_habit_idx ON hb_milestones(habit_id)`,
  `CREATE INDEX IF NOT EXISTS hb_milestones_achieved_idx ON hb_milestones(achieved_at)`,
  `CREATE INDEX IF NOT EXISTS hb_milestones_type_idx ON hb_milestones(milestone_type, threshold)`,
  `CREATE INDEX IF NOT EXISTS hb_focus_sessions_habit_idx ON hb_focus_sessions(habit_id)`,
  `CREATE INDEX IF NOT EXISTS hb_focus_sessions_status_idx ON hb_focus_sessions(status)`,
  `CREATE INDEX IF NOT EXISTS hb_focus_sessions_started_idx ON hb_focus_sessions(started_at DESC)`,
  `CREATE INDEX IF NOT EXISTS hb_healthkit_links_habit_idx ON hb_healthkit_links(habit_id)`,
  `CREATE INDEX IF NOT EXISTS hb_healthkit_links_source_idx ON hb_healthkit_links(data_source)`,
];

export const ALL_V3_TABLES = [
  CREATE_SOBRIETY_PROFILES,
  CREATE_SOBRIETY_PLEDGES,
  CREATE_CRAVINGS,
  CREATE_CRAVING_TRIGGERS,
  CREATE_MILESTONES,
  CREATE_FOCUS_SESSIONS,
  CREATE_HEALTHKIT_LINKS,
];

// ── V4 Schema additions ──────────────────────────────────────────────────

export const CREATE_PROGRAMS = `
CREATE TABLE IF NOT EXISTS hb_programs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    duration_days INTEGER NOT NULL CHECK (duration_days >= 7 AND duration_days <= 90),
    schedule TEXT NOT NULL,
    difficulty TEXT NOT NULL DEFAULT 'beginner'
        CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
    is_built_in INTEGER NOT NULL DEFAULT 0 CHECK (is_built_in IN (0, 1)),
    icon TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_PROGRAM_ENROLLMENTS = `
CREATE TABLE IF NOT EXISTS hb_program_enrollments (
    id TEXT PRIMARY KEY,
    program_id TEXT NOT NULL REFERENCES hb_programs(id) ON DELETE CASCADE,
    habit_id TEXT NOT NULL REFERENCES hb_habits(id) ON DELETE CASCADE,
    start_date TEXT NOT NULL,
    current_day INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'completed', 'abandoned')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(habit_id)
)`;

export const CREATE_BADGES = `
CREATE TABLE IF NOT EXISTS hb_badges (
    id TEXT PRIMARY KEY,
    badge_key TEXT NOT NULL,
    habit_id TEXT REFERENCES hb_habits(id) ON DELETE SET NULL,
    unlocked_at TEXT NOT NULL DEFAULT (datetime('now')),
    dismissed INTEGER NOT NULL DEFAULT 0 CHECK (dismissed IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(badge_key, habit_id)
)`;

export const CREATE_PROJECTS = `
CREATE TABLE IF NOT EXISTS hb_projects (
    id TEXT PRIMARY KEY,
    habit_id TEXT NOT NULL REFERENCES hb_habits(id) ON DELETE CASCADE,
    project_name TEXT NOT NULL,
    client_name TEXT,
    hourly_rate INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USD',
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(habit_id)
)`;

export const CREATE_PLAYER_PROFILE = `
CREATE TABLE IF NOT EXISTS hb_player_profile (
    id TEXT PRIMARY KEY DEFAULT 'player',
    total_xp INTEGER NOT NULL DEFAULT 0,
    current_level INTEGER NOT NULL DEFAULT 1,
    gamification_enabled INTEGER NOT NULL DEFAULT 0 CHECK (gamification_enabled IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_XP_TRANSACTIONS = `
CREATE TABLE IF NOT EXISTS hb_xp_transactions (
    id TEXT PRIMARY KEY,
    amount INTEGER NOT NULL CHECK (amount > 0),
    source TEXT NOT NULL,
    habit_id TEXT REFERENCES hb_habits(id) ON DELETE SET NULL,
    earned_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_PET_STATE = `
CREATE TABLE IF NOT EXISTS hb_pet_state (
    id TEXT PRIMARY KEY DEFAULT 'pet',
    name TEXT NOT NULL DEFAULT 'Buddy',
    species TEXT NOT NULL DEFAULT 'fox',
    equipped_items TEXT NOT NULL DEFAULT '[]',
    days_together INTEGER NOT NULL DEFAULT 0,
    total_habits_completed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_LOCATION_REMINDERS = `
CREATE TABLE IF NOT EXISTS hb_location_reminders (
    id TEXT PRIMARY KEY,
    habit_id TEXT NOT NULL REFERENCES hb_habits(id) ON DELETE CASCADE,
    location_name TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    radius_meters INTEGER NOT NULL DEFAULT 100 CHECK (radius_meters >= 50 AND radius_meters <= 500),
    trigger_type TEXT NOT NULL DEFAULT 'arrival'
        CHECK (trigger_type IN ('arrival', 'departure', 'both')),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(habit_id)
)`;

export const V4_INDEXES = [
  `CREATE INDEX IF NOT EXISTS hb_programs_built_in_idx ON hb_programs(is_built_in)`,
  `CREATE INDEX IF NOT EXISTS hb_enrollments_program_idx ON hb_program_enrollments(program_id)`,
  `CREATE INDEX IF NOT EXISTS hb_enrollments_habit_idx ON hb_program_enrollments(habit_id)`,
  `CREATE INDEX IF NOT EXISTS hb_enrollments_status_idx ON hb_program_enrollments(status)`,
  `CREATE INDEX IF NOT EXISTS hb_badges_key_idx ON hb_badges(badge_key)`,
  `CREATE INDEX IF NOT EXISTS hb_badges_habit_idx ON hb_badges(habit_id)`,
  `CREATE INDEX IF NOT EXISTS hb_badges_unlocked_idx ON hb_badges(unlocked_at DESC)`,
  `CREATE INDEX IF NOT EXISTS hb_projects_habit_idx ON hb_projects(habit_id)`,
  `CREATE INDEX IF NOT EXISTS hb_projects_active_idx ON hb_projects(is_active)`,
  `CREATE INDEX IF NOT EXISTS hb_xp_transactions_source_idx ON hb_xp_transactions(source)`,
  `CREATE INDEX IF NOT EXISTS hb_xp_transactions_habit_idx ON hb_xp_transactions(habit_id)`,
  `CREATE INDEX IF NOT EXISTS hb_xp_transactions_earned_idx ON hb_xp_transactions(earned_at DESC)`,
  `CREATE INDEX IF NOT EXISTS hb_location_reminders_habit_idx ON hb_location_reminders(habit_id)`,
  `CREATE INDEX IF NOT EXISTS hb_location_reminders_active_idx ON hb_location_reminders(is_active)`,
];

export const ALL_V4_TABLES = [
  CREATE_PROGRAMS,
  CREATE_PROGRAM_ENROLLMENTS,
  CREATE_BADGES,
  CREATE_PROJECTS,
  CREATE_PLAYER_PROFILE,
  CREATE_XP_TRANSACTIONS,
  CREATE_PET_STATE,
  CREATE_LOCATION_REMINDERS,
];

// ── V5 Schema additions ──────────────────────────────────────────────────

export const CREATE_HABIT_LINKS = `
CREATE TABLE IF NOT EXISTS hb_habit_links (
    id TEXT PRIMARY KEY,
    parent_habit_id TEXT NOT NULL REFERENCES hb_habits(id) ON DELETE CASCADE,
    child_habit_id TEXT NOT NULL REFERENCES hb_habits(id) ON DELETE CASCADE,
    link_type TEXT NOT NULL DEFAULT 'after'
        CHECK (link_type IN ('after', 'before', 'with')),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(parent_habit_id, child_habit_id)
)`;

export const CREATE_STREAK_FREEZES = `
CREATE TABLE IF NOT EXISTS hb_streak_freezes (
    id TEXT PRIMARY KEY,
    habit_id TEXT NOT NULL REFERENCES hb_habits(id) ON DELETE CASCADE,
    freeze_date TEXT NOT NULL,
    reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(habit_id, freeze_date)
)`;

export const CREATE_ACTION_ITEMS = `
CREATE TABLE IF NOT EXISTS hb_action_items (
    id TEXT PRIMARY KEY,
    habit_id TEXT NOT NULL REFERENCES hb_habits(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_ACTION_COMPLETIONS = `
CREATE TABLE IF NOT EXISTS hb_action_completions (
    id TEXT PRIMARY KEY,
    action_item_id TEXT NOT NULL REFERENCES hb_action_items(id) ON DELETE CASCADE,
    completed_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(action_item_id, completed_at)
)`;

export const V5_INDEXES = [
  `CREATE INDEX IF NOT EXISTS hb_habit_links_parent_idx ON hb_habit_links(parent_habit_id)`,
  `CREATE INDEX IF NOT EXISTS hb_habit_links_child_idx ON hb_habit_links(child_habit_id)`,
  `CREATE INDEX IF NOT EXISTS hb_streak_freezes_habit_idx ON hb_streak_freezes(habit_id)`,
  `CREATE INDEX IF NOT EXISTS hb_streak_freezes_date_idx ON hb_streak_freezes(freeze_date)`,
  `CREATE INDEX IF NOT EXISTS hb_action_items_habit_idx ON hb_action_items(habit_id)`,
  `CREATE INDEX IF NOT EXISTS hb_action_items_order_idx ON hb_action_items(habit_id, sort_order)`,
  `CREATE INDEX IF NOT EXISTS hb_action_completions_item_idx ON hb_action_completions(action_item_id)`,
  `CREATE INDEX IF NOT EXISTS hb_action_completions_date_idx ON hb_action_completions(completed_at)`,
  // Composite index for the most common query pattern: completions by habit + date
  `CREATE INDEX IF NOT EXISTS hb_completions_habit_date_idx ON hb_completions(habit_id, completed_at)`,
];

export const ALL_V5_TABLES = [
  CREATE_HABIT_LINKS,
  CREATE_STREAK_FREEZES,
  CREATE_ACTION_ITEMS,
  CREATE_ACTION_COMPLETIONS,
];

// ── V6 Schema additions ──────────────────────────────────────────────────

export const CREATE_AREAS = `
CREATE TABLE IF NOT EXISTS hb_areas (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    color TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const ALTER_HABITS_V6 = [
  `ALTER TABLE hb_habits ADD COLUMN area_id TEXT REFERENCES hb_areas(id)`,
];

export const SEED_AREAS = [
  `INSERT OR IGNORE INTO hb_areas (id, name, icon, color, sort_order, created_at) VALUES ('area_health', 'Health', '\u2764\uFE0F', '#EF4444', 0, datetime('now'))`,
  `INSERT OR IGNORE INTO hb_areas (id, name, icon, color, sort_order, created_at) VALUES ('area_work', 'Work', '\uD83D\uDCBC', '#3B82F6', 1, datetime('now'))`,
  `INSERT OR IGNORE INTO hb_areas (id, name, icon, color, sort_order, created_at) VALUES ('area_personal', 'Personal', '\u2B50', '#EAB308', 2, datetime('now'))`,
  `INSERT OR IGNORE INTO hb_areas (id, name, icon, color, sort_order, created_at) VALUES ('area_fitness', 'Fitness', '\uD83D\uDCAA', '#22C55E', 3, datetime('now'))`,
  `INSERT OR IGNORE INTO hb_areas (id, name, icon, color, sort_order, created_at) VALUES ('area_learning', 'Learning', '\uD83D\uDCDA', '#8B5CF6', 4, datetime('now'))`,
  `INSERT OR IGNORE INTO hb_areas (id, name, icon, color, sort_order, created_at) VALUES ('area_mindfulness', 'Mindfulness', '\uD83E\uDDD8', '#14B8A6', 5, datetime('now'))`,
];

export const V6_INDEXES = [
  `CREATE INDEX IF NOT EXISTS hb_areas_order_idx ON hb_areas(sort_order)`,
  `CREATE INDEX IF NOT EXISTS hb_habits_area_idx ON hb_habits(area_id)`,
];

export const ALL_V6_TABLES = [CREATE_AREAS];

// ── V7 Schema additions ──────────────────────────────────────────────────

export const CREATE_REMINDERS = `
CREATE TABLE IF NOT EXISTS hb_reminders (
    id TEXT PRIMARY KEY,
    habit_id TEXT NOT NULL REFERENCES hb_habits(id) ON DELETE CASCADE,
    time TEXT NOT NULL,
    label TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const ALTER_HABITS_V7 = [
  `ALTER TABLE hb_habits ADD COLUMN start_date TEXT`,
  `ALTER TABLE hb_habits ADD COLUMN end_date TEXT`,
];

export const MIGRATE_REMINDER_DATA = `
INSERT INTO hb_reminders (id, habit_id, time, label, is_active, created_at)
SELECT id || '_rem', id, reminder_time, NULL, 1, datetime('now')
FROM hb_habits WHERE reminder_time IS NOT NULL
`;

export const V7_INDEXES = [
  `CREATE INDEX IF NOT EXISTS hb_reminders_habit_idx ON hb_reminders(habit_id)`,
  `CREATE INDEX IF NOT EXISTS hb_habits_start_date_idx ON hb_habits(start_date)`,
  `CREATE INDEX IF NOT EXISTS hb_habits_end_date_idx ON hb_habits(end_date)`,
];

export const ALL_V7_TABLES = [CREATE_REMINDERS];

// ── V8 Schema additions ──────────────────────────────────────────────────
// Drop deprecated cycle-tracking tables. Cycle tracking now lives in
// @mylife/cycle (cy_* tables). See docs/plans/consolidation/phase-0-research.md
// Fix 1 for background.

export const DROP_DEPRECATED_CYCLE_TABLES = [
  'DROP TABLE IF EXISTS hb_period_symptoms',
  'DROP TABLE IF EXISTS hb_predictions',
  'DROP TABLE IF EXISTS hb_periods',
  'DROP TABLE IF EXISTS hb_cycle_settings',
];
