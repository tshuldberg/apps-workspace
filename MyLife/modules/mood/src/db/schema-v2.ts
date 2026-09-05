// MyMood V2 Schema -- Custom Experiments + PIN/Biometric Lock + AI Insights
// AI Insights uses mo_settings (existing table), no new tables needed.

// ── Custom Experiments ────────────────────────────────────────────────

export const CREATE_EXPERIMENTS = `
CREATE TABLE IF NOT EXISTS mo_experiments (
  id TEXT PRIMARY KEY,
  hypothesis TEXT NOT NULL,
  intervention_description TEXT NOT NULL,
  period_days INTEGER NOT NULL DEFAULT 14,
  baseline_start TEXT NOT NULL,
  baseline_end TEXT NOT NULL,
  intervention_start TEXT NOT NULL,
  intervention_end TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  template_id TEXT,
  baseline_avg REAL,
  intervention_avg REAL,
  baseline_entry_count INTEGER,
  intervention_entry_count INTEGER,
  score_diff REAL,
  percent_change REAL,
  pearson_r REAL,
  is_significant INTEGER,
  conclusion TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
)`;

export const CREATE_EXPERIMENT_TEMPLATES = `
CREATE TABLE IF NOT EXISTS mo_experiment_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  hypothesis TEXT NOT NULL,
  intervention_description TEXT NOT NULL,
  suggested_days INTEGER NOT NULL DEFAULT 14,
  category TEXT NOT NULL
)`;

// ── PIN/Biometric Lock ────────────────────────────────────────────────

export const CREATE_MODULE_LOCK = `
CREATE TABLE IF NOT EXISTS mo_module_lock (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  is_enabled INTEGER NOT NULL DEFAULT 0,
  method TEXT,
  lock_timeout_seconds INTEGER NOT NULL DEFAULT 0,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// ── Indexes ───────────────────────────────────────────────────────────

export const V2_INDEXES = [
  `CREATE INDEX IF NOT EXISTS mo_experiments_status_idx ON mo_experiments(status)`,
  `CREATE INDEX IF NOT EXISTS mo_experiments_baseline_start_idx ON mo_experiments(baseline_start DESC)`,
  `CREATE INDEX IF NOT EXISTS mo_templates_category_idx ON mo_experiment_templates(category)`,
];

// ── Template Seed Data ────────────────────────────────────────────────

export const SEED_EXPERIMENT_TEMPLATES = [
  `INSERT OR IGNORE INTO mo_experiment_templates (id, name, hypothesis, intervention_description, suggested_days, category)
   VALUES ('tpl-morning-exercise', 'Morning Exercise', 'Exercising in the morning improves my mood throughout the day', 'Do 20-30 minutes of exercise before 9am each day', 14, 'exercise')`,
  `INSERT OR IGNORE INTO mo_experiment_templates (id, name, hypothesis, intervention_description, suggested_days, category)
   VALUES ('tpl-daily-meditation', 'Daily Meditation', 'A daily meditation practice reduces my stress and improves my overall mood', 'Meditate for 10-15 minutes each morning', 14, 'mindfulness')`,
  `INSERT OR IGNORE INTO mo_experiment_templates (id, name, hypothesis, intervention_description, suggested_days, category)
   VALUES ('tpl-8hrs-sleep', '8 Hours Sleep', 'Getting a full 8 hours of sleep makes me feel better the next day', 'Go to bed early enough to get 8 hours of sleep each night', 14, 'sleep')`,
  `INSERT OR IGNORE INTO mo_experiment_templates (id, name, hypothesis, intervention_description, suggested_days, category)
   VALUES ('tpl-social-lunch', 'Social Lunch', 'Eating lunch with others instead of alone improves my afternoon mood', 'Have lunch with a friend or colleague at least 3 times a week', 14, 'social')`,
  `INSERT OR IGNORE INTO mo_experiment_templates (id, name, hypothesis, intervention_description, suggested_days, category)
   VALUES ('tpl-no-phone-bed', 'No Phone Before Bed', 'Avoiding screens before bed improves my sleep quality and next-day mood', 'Put phone away 1 hour before bedtime each night', 14, 'digital')`,
  `INSERT OR IGNORE INTO mo_experiment_templates (id, name, hypothesis, intervention_description, suggested_days, category)
   VALUES ('tpl-3x-workout', '3x Weekly Workout', 'Working out 3 times a week improves my baseline mood', 'Complete 3 workout sessions per week (any type)', 21, 'exercise')`,
  `INSERT OR IGNORE INTO mo_experiment_templates (id, name, hypothesis, intervention_description, suggested_days, category)
   VALUES ('tpl-daily-journaling', 'Daily Journaling', 'Writing in a journal each day helps me process emotions and feel better', 'Write at least 200 words in a journal each evening', 14, 'mindfulness')`,
  `INSERT OR IGNORE INTO mo_experiment_templates (id, name, hypothesis, intervention_description, suggested_days, category)
   VALUES ('tpl-caffeine-cutoff', 'Caffeine Cutoff', 'Stopping caffeine after 2pm improves my sleep and next-day mood', 'No caffeine after 2pm each day', 14, 'nutrition')`,
  `INSERT OR IGNORE INTO mo_experiment_templates (id, name, hypothesis, intervention_description, suggested_days, category)
   VALUES ('tpl-nature-walk', 'Nature Walk', 'A daily walk in nature reduces my anxiety and lifts my mood', 'Take a 20-minute walk outdoors in a green space each day', 14, 'exercise')`,
  `INSERT OR IGNORE INTO mo_experiment_templates (id, name, hypothesis, intervention_description, suggested_days, category)
   VALUES ('tpl-gratitude-practice', 'Gratitude Practice', 'Writing down 3 things I am grateful for each day improves my outlook', 'Write 3 gratitude items each morning', 14, 'mindfulness')`,
];

// ── Combined V2 Migration ─────────────────────────────────────────────

export const MOOD_V2_UP = [
  CREATE_EXPERIMENTS,
  CREATE_EXPERIMENT_TEMPLATES,
  CREATE_MODULE_LOCK,
  ...V2_INDEXES,
  ...SEED_EXPERIMENT_TEMPLATES,
];

export const MOOD_V2_DOWN = [
  'DROP TABLE IF EXISTS mo_module_lock',
  'DROP TABLE IF EXISTS mo_experiment_templates',
  'DROP TABLE IF EXISTS mo_experiments',
];
