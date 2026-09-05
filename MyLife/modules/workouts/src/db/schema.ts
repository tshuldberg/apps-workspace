// Legacy tables (v1) retained for backward compatibility with prior hub releases.
export const CREATE_WORKOUT_LOGS = `
CREATE TABLE IF NOT EXISTS wk_workout_logs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  focus TEXT NOT NULL DEFAULT 'full_body',
  duration_min INTEGER NOT NULL,
  calories INTEGER NOT NULL DEFAULT 0,
  rpe INTEGER NOT NULL DEFAULT 7,
  completed_at TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_WORKOUT_PROGRAMS = `
CREATE TABLE IF NOT EXISTS wk_programs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  goal TEXT NOT NULL,
  weeks INTEGER NOT NULL,
  sessions_per_week INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_EXERCISES = `
CREATE TABLE IF NOT EXISTS wk_exercises (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  muscle_groups_json TEXT NOT NULL DEFAULT '[]',
  difficulty TEXT NOT NULL DEFAULT 'beginner',
  video_url TEXT,
  thumbnail_url TEXT,
  audio_cues_json TEXT NOT NULL DEFAULT '[]',
  default_sets INTEGER NOT NULL DEFAULT 3,
  default_reps INTEGER,
  default_duration INTEGER,
  is_premium INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_WORKOUTS = `
CREATE TABLE IF NOT EXISTS wk_workouts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  difficulty TEXT NOT NULL DEFAULT 'beginner',
  exercises_json TEXT NOT NULL DEFAULT '[]',
  estimated_duration INTEGER NOT NULL DEFAULT 0,
  is_premium INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_WORKOUT_SESSIONS = `
CREATE TABLE IF NOT EXISTS wk_workout_sessions (
  id TEXT PRIMARY KEY,
  workout_id TEXT NOT NULL REFERENCES wk_workouts(id) ON DELETE CASCADE,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  exercises_completed_json TEXT NOT NULL DEFAULT '[]',
  voice_commands_used_json TEXT NOT NULL DEFAULT '[]',
  pace_adjustments_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_FORM_RECORDINGS = `
CREATE TABLE IF NOT EXISTS wk_form_recordings (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES wk_workout_sessions(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL,
  video_url TEXT NOT NULL,
  timestamp_start REAL NOT NULL,
  timestamp_end REAL NOT NULL,
  coach_feedback_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_WORKOUT_SET_WEIGHTS = `
CREATE TABLE IF NOT EXISTS wk_workout_set_weights (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES wk_workout_sessions(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL,
  set_number INTEGER NOT NULL,
  weight REAL NOT NULL,
  reps INTEGER NOT NULL,
  unit TEXT NOT NULL DEFAULT 'lbs',
  estimated_1rm REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_EXERCISE_1RM_HISTORY = `
CREATE TABLE IF NOT EXISTS wk_exercise_1rm_history (
  id TEXT PRIMARY KEY,
  exercise_id TEXT NOT NULL,
  max_weight REAL NOT NULL,
  max_reps INTEGER NOT NULL,
  estimated_1rm REAL NOT NULL,
  unit TEXT NOT NULL DEFAULT 'lbs',
  achieved_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_BODY_MEASUREMENTS = `
CREATE TABLE IF NOT EXISTS wk_body_measurements (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  value REAL NOT NULL,
  unit TEXT NOT NULL,
  measured_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_WORKOUT_PLANS = `
CREATE TABLE IF NOT EXISTS wk_workout_plans (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  creator_id TEXT,
  weeks_json TEXT NOT NULL DEFAULT '[]',
  is_premium INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_PLAN_SUBSCRIPTIONS = `
CREATE TABLE IF NOT EXISTS wk_plan_subscriptions (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES wk_workout_plans(id) ON DELETE CASCADE,
  started_at TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// ── V4 Tables ──

export const CREATE_OVERLOAD_RULES = `
CREATE TABLE IF NOT EXISTS wk_overload_rules (
  id TEXT PRIMARY KEY,
  exercise_id TEXT,
  rule_type TEXT NOT NULL DEFAULT 'weight_increment' CHECK (rule_type IN ('weight_increment', 'rep_increment', 'set_increment', 'percentage')),
  trigger_condition TEXT NOT NULL DEFAULT 'all_sets_hit' CHECK (trigger_condition IN ('all_sets_hit', 'any_set_hit', 'average_reps_hit')),
  target_reps INTEGER,
  increment_value REAL NOT NULL DEFAULT 5,
  increment_unit TEXT NOT NULL DEFAULT 'lbs' CHECK (increment_unit IN ('lbs', 'kg', 'reps', 'percent')),
  min_sessions INTEGER NOT NULL DEFAULT 2,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_GENERATION_HISTORY = `
CREATE TABLE IF NOT EXISTS wk_generation_history (
  id TEXT PRIMARY KEY,
  goal TEXT NOT NULL,
  focus TEXT NOT NULL,
  equipment_json TEXT NOT NULL DEFAULT '[]',
  difficulty TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  generated_workout_json TEXT NOT NULL,
  accepted INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'local' CHECK (source IN ('local', 'llm')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_GPS_ROUTES = `
CREATE TABLE IF NOT EXISTS wk_gps_routes (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES wk_workout_sessions(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL DEFAULT 'run' CHECK (activity_type IN ('run', 'cycle', 'hike', 'walk', 'other')),
  name TEXT,
  distance_meters REAL NOT NULL DEFAULT 0,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  elevation_gain_meters REAL NOT NULL DEFAULT 0,
  elevation_loss_meters REAL NOT NULL DEFAULT 0,
  avg_pace_sec_per_km REAL,
  avg_speed_kmh REAL,
  max_speed_kmh REAL,
  calories_estimated INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_GPS_POINTS = `
CREATE TABLE IF NOT EXISTS wk_gps_points (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  route_id TEXT NOT NULL REFERENCES wk_gps_routes(id) ON DELETE CASCADE,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  altitude_meters REAL,
  speed_mps REAL,
  accuracy_meters REAL,
  timestamp_ms INTEGER NOT NULL,
  segment INTEGER NOT NULL DEFAULT 0
)`;

// ── V5 Tables ──

export const CREATE_PLATE_INVENTORIES = `
CREATE TABLE IF NOT EXISTS wk_plate_inventories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'lbs' CHECK (unit IN ('lbs', 'kg')),
  plates_json TEXT NOT NULL DEFAULT '[]',
  bar_weight REAL NOT NULL DEFAULT 45,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_PROGRESS_PHOTOS = `
CREATE TABLE IF NOT EXISTS wk_progress_photos (
  id TEXT PRIMARY KEY,
  photo_uri TEXT NOT NULL,
  view_type TEXT NOT NULL DEFAULT 'front' CHECK (view_type IN ('front', 'side_left', 'side_right', 'back')),
  notes TEXT NOT NULL DEFAULT '',
  taken_at TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL DEFAULT 0,
  width INTEGER NOT NULL DEFAULT 0,
  height INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// ── V6 Tables ──

export const CREATE_TRAINERS = `
CREATE TABLE IF NOT EXISTS wk_trainers (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  display_name TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  avatar_uri TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_EXERCISE_VIDEOS = `
CREATE TABLE IF NOT EXISTS wk_exercise_videos (
  id TEXT PRIMARY KEY,
  exercise_id TEXT NOT NULL,
  trainer_id TEXT NOT NULL,
  video_uri TEXT NOT NULL,
  thumbnail_uri TEXT,
  angle TEXT NOT NULL DEFAULT 'front'
    CHECK (angle IN ('front', 'side', 'back', 'detail', 'common_mistakes')),
  duration_seconds REAL NOT NULL DEFAULT 0,
  file_size_bytes INTEGER NOT NULL DEFAULT 0,
  width INTEGER NOT NULL DEFAULT 0,
  height INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_primary INTEGER NOT NULL DEFAULT 0,
  storage_type TEXT NOT NULL DEFAULT 'local'
    CHECK (storage_type IN ('local', 'supabase', 'cdn')),
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS wk_workout_logs_focus_idx ON wk_workout_logs(focus)`,
  `CREATE INDEX IF NOT EXISTS wk_workout_logs_completed_idx ON wk_workout_logs(completed_at DESC)`,
  `CREATE INDEX IF NOT EXISTS wk_programs_active_idx ON wk_programs(is_active)`,
  `CREATE INDEX IF NOT EXISTS wk_exercises_category_idx ON wk_exercises(category)`,
  `CREATE INDEX IF NOT EXISTS wk_exercises_difficulty_idx ON wk_exercises(difficulty)`,
  `CREATE INDEX IF NOT EXISTS wk_workouts_created_idx ON wk_workouts(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS wk_workout_sessions_workout_idx ON wk_workout_sessions(workout_id)`,
  `CREATE INDEX IF NOT EXISTS wk_workout_sessions_completed_idx ON wk_workout_sessions(completed_at DESC)`,
  `CREATE INDEX IF NOT EXISTS wk_form_recordings_session_idx ON wk_form_recordings(session_id)`,
  `CREATE INDEX IF NOT EXISTS wk_set_weights_session_exercise_idx ON wk_workout_set_weights(session_id, exercise_id)`,
  `CREATE INDEX IF NOT EXISTS wk_1rm_history_exercise_idx ON wk_exercise_1rm_history(exercise_id)`,
  `CREATE INDEX IF NOT EXISTS wk_body_measurements_type_measured_idx ON wk_body_measurements(type, measured_at DESC)`,
  `CREATE INDEX IF NOT EXISTS wk_workout_plans_created_idx ON wk_workout_plans(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS wk_plan_subscriptions_plan_active_idx ON wk_plan_subscriptions(plan_id, is_active)`,
];

export const ALL_TABLES = [
  CREATE_WORKOUT_LOGS,
  CREATE_WORKOUT_PROGRAMS,
  CREATE_EXERCISES,
  CREATE_WORKOUTS,
  CREATE_WORKOUT_SESSIONS,
  CREATE_FORM_RECORDINGS,
  CREATE_WORKOUT_SET_WEIGHTS,
  CREATE_EXERCISE_1RM_HISTORY,
  CREATE_BODY_MEASUREMENTS,
  CREATE_WORKOUT_PLANS,
  CREATE_PLAN_SUBSCRIPTIONS,
];
