export const DEFAULT_JOURNAL_ID = 'journal-default';

export const CREATE_ENTRIES = `
CREATE TABLE IF NOT EXISTS jn_entries (
  id TEXT PRIMARY KEY,
  entry_date TEXT NOT NULL,
  title TEXT,
  body TEXT NOT NULL,
  mood TEXT,
  image_uris_json TEXT NOT NULL DEFAULT '[]',
  word_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_TAGS = `
CREATE TABLE IF NOT EXISTS jn_tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_ENTRY_TAGS = `
CREATE TABLE IF NOT EXISTS jn_entry_tags (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL REFERENCES jn_entries(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES jn_tags(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(entry_id, tag_id)
)`;

export const CREATE_SETTINGS = `
CREATE TABLE IF NOT EXISTS jn_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
)`;

export const CREATE_JOURNALS = `
CREATE TABLE IF NOT EXISTS jn_journals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const BASE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS jn_entries_date_idx ON jn_entries(entry_date DESC, updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS jn_entries_mood_idx ON jn_entries(mood, entry_date DESC)`,
  `CREATE INDEX IF NOT EXISTS jn_entry_tags_entry_idx ON jn_entry_tags(entry_id)`,
  `CREATE INDEX IF NOT EXISTS jn_entry_tags_tag_idx ON jn_entry_tags(tag_id)`,
];

export const JOURNAL_INDEXES = [
  `CREATE INDEX IF NOT EXISTS jn_journals_default_idx ON jn_journals(is_default, name ASC)`,
  `CREATE INDEX IF NOT EXISTS jn_entries_journal_idx ON jn_entries(journal_id, entry_date DESC, updated_at DESC)`,
];

export const SEED_SETTINGS = [
  `INSERT OR IGNORE INTO jn_settings (key, value) VALUES ('editorMode', 'markdown')`,
  `INSERT OR IGNORE INTO jn_settings (key, value) VALUES ('dailyPromptEnabled', 'false')`,
  `INSERT OR IGNORE INTO jn_settings (key, value) VALUES ('dailyPromptCategory', 'reflection')`,
];

export const BASE_TABLES = [
  CREATE_ENTRIES,
  CREATE_TAGS,
  CREATE_ENTRY_TAGS,
  CREATE_SETTINGS,
];

// ── V3: Voice-to-text columns on jn_entries ──
export const V3_VOICE_COLUMNS = [
  `ALTER TABLE jn_entries ADD COLUMN audio_path TEXT`,
  `ALTER TABLE jn_entries ADD COLUMN audio_duration_ms INTEGER`,
  `ALTER TABLE jn_entries ADD COLUMN transcription_source TEXT CHECK (transcription_source IN ('voice', 'manual'))`,
];

export const CREATE_VOICE_RECORDINGS = `
CREATE TABLE IF NOT EXISTS jn_voice_recordings (
  id TEXT PRIMARY KEY NOT NULL,
  entry_id TEXT NOT NULL REFERENCES jn_entries(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  file_size_bytes INTEGER NOT NULL DEFAULT 0,
  transcription TEXT,
  transcription_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (transcription_status IN ('pending', 'transcribing', 'complete', 'failed')),
  keep_audio INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const V3_VOICE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS jn_voice_recordings_entry_idx ON jn_voice_recordings(entry_id)`,
];

// ── V3: Metadata columns on jn_entries ──
export const V3_METADATA_COLUMNS = [
  `ALTER TABLE jn_entries ADD COLUMN latitude REAL`,
  `ALTER TABLE jn_entries ADD COLUMN longitude REAL`,
  `ALTER TABLE jn_entries ADD COLUMN place_name TEXT`,
  `ALTER TABLE jn_entries ADD COLUMN timezone TEXT`,
  `ALTER TABLE jn_entries ADD COLUMN weather_temp_c REAL`,
  `ALTER TABLE jn_entries ADD COLUMN weather_description TEXT`,
  `ALTER TABLE jn_entries ADD COLUMN weather_icon TEXT`,
];

export const V3_METADATA_INDEXES = [
  `CREATE INDEX IF NOT EXISTS jn_entries_location_idx ON jn_entries(latitude, longitude)`,
];

export const V3_METADATA_SETTINGS = [
  `INSERT OR IGNORE INTO jn_settings (key, value) VALUES ('metadataLocationEnabled', 'false')`,
  `INSERT OR IGNORE INTO jn_settings (key, value) VALUES ('metadataWeatherEnabled', 'false')`,
];

// ── V3: Therapy columns on jn_entries + topics table ──
export const V3_THERAPY_COLUMNS = [
  `ALTER TABLE jn_entries ADD COLUMN entry_type TEXT DEFAULT 'standard' CHECK (entry_type IN ('standard', 'therapy_prep'))`,
  `ALTER TABLE jn_entries ADD COLUMN therapy_session_number INTEGER`,
  `ALTER TABLE jn_entries ADD COLUMN therapy_template_type TEXT CHECK (therapy_template_type IN ('pre_session', 'post_session', 'crisis_plan', 'progress_checkin'))`,
];

export const CREATE_THERAPY_TOPICS = `
CREATE TABLE IF NOT EXISTS jn_therapy_topics (
  id TEXT PRIMARY KEY NOT NULL,
  entry_id TEXT NOT NULL REFERENCES jn_entries(id) ON DELETE CASCADE,
  section TEXT NOT NULL
    CHECK (section IN (
      'topics', 'wins', 'challenges', 'questions',
      'takeaways', 'action_items', 'followup_questions',
      'warning_signs', 'coping_strategies', 'support_contacts', 'safe_actions',
      'original_goals', 'new_goals', 'patterns', 'working', 'not_working'
    )),
  content TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_completed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const V3_THERAPY_INDEXES = [
  `CREATE INDEX IF NOT EXISTS jn_therapy_topics_entry_idx ON jn_therapy_topics(entry_id, section, sort_order)`,
  `CREATE INDEX IF NOT EXISTS jn_entries_therapy_session_idx ON jn_entries(therapy_session_number)`,
  `CREATE INDEX IF NOT EXISTS jn_entries_type_idx ON jn_entries(entry_type)`,
];

// ── V3: CBT thought records tables ──
export const CREATE_THOUGHT_RECORDS = `
CREATE TABLE IF NOT EXISTS jn_thought_records (
  id TEXT PRIMARY KEY NOT NULL,
  entry_id TEXT NOT NULL REFERENCES jn_entries(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'complete')),
  situation TEXT,
  situation_date TEXT,
  automatic_thought TEXT,
  thought_belief_before INTEGER CHECK (thought_belief_before >= 0 AND thought_belief_before <= 100),
  rational_response TEXT,
  evidence_for TEXT,
  evidence_against TEXT,
  thought_belief_after INTEGER CHECK (thought_belief_after >= 0 AND thought_belief_after <= 100),
  outcome_note TEXT,
  current_step INTEGER NOT NULL DEFAULT 1 CHECK (current_step >= 1 AND current_step <= 6),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_THOUGHT_RECORD_EMOTIONS = `
CREATE TABLE IF NOT EXISTS jn_thought_record_emotions (
  id TEXT PRIMARY KEY NOT NULL,
  thought_record_id TEXT NOT NULL REFERENCES jn_thought_records(id) ON DELETE CASCADE,
  emotion_name TEXT NOT NULL,
  intensity_before INTEGER NOT NULL DEFAULT 0 CHECK (intensity_before >= 0 AND intensity_before <= 100),
  intensity_after INTEGER CHECK (intensity_after >= 0 AND intensity_after <= 100)
)`;

export const CREATE_THOUGHT_RECORD_DISTORTIONS = `
CREATE TABLE IF NOT EXISTS jn_thought_record_distortions (
  id TEXT PRIMARY KEY NOT NULL,
  thought_record_id TEXT NOT NULL REFERENCES jn_thought_records(id) ON DELETE CASCADE,
  distortion_type TEXT NOT NULL
    CHECK (distortion_type IN (
      'all_or_nothing', 'overgeneralization', 'mental_filter',
      'disqualifying_positive', 'mind_reading', 'fortune_telling',
      'magnification', 'minimization', 'emotional_reasoning',
      'should_statements', 'labeling', 'personalization',
      'blame', 'always_being_right', 'fallacy_of_fairness'
    ))
)`;

export const V3_CBT_INDEXES = [
  `CREATE INDEX IF NOT EXISTS jn_thought_records_entry_idx ON jn_thought_records(entry_id)`,
  `CREATE INDEX IF NOT EXISTS jn_thought_records_status_idx ON jn_thought_records(status)`,
  `CREATE INDEX IF NOT EXISTS jn_thought_record_emotions_record_idx ON jn_thought_record_emotions(thought_record_id)`,
  `CREATE INDEX IF NOT EXISTS jn_thought_record_distortions_record_idx ON jn_thought_record_distortions(thought_record_id)`,
  `CREATE INDEX IF NOT EXISTS jn_thought_record_distortions_type_idx ON jn_thought_record_distortions(distortion_type)`,
];

// ── V4: AI Prompts table ──
export const CREATE_AI_PROMPTS = `
CREATE TABLE IF NOT EXISTS jn_ai_prompts (
  id TEXT PRIMARY KEY NOT NULL,
  prompt_text TEXT NOT NULL,
  theme TEXT NOT NULL,
  context_summary TEXT,
  mood_context TEXT,
  was_used INTEGER NOT NULL DEFAULT 0,
  was_skipped INTEGER NOT NULL DEFAULT 0,
  generated_date TEXT NOT NULL,
  entry_id TEXT REFERENCES jn_entries(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const V4_AI_PROMPTS_INDEXES = [
  `CREATE INDEX IF NOT EXISTS jn_ai_prompts_date_idx ON jn_ai_prompts(generated_date DESC)`,
  `CREATE INDEX IF NOT EXISTS jn_ai_prompts_theme_idx ON jn_ai_prompts(theme)`,
  `CREATE INDEX IF NOT EXISTS jn_ai_prompts_used_idx ON jn_ai_prompts(was_used, was_skipped)`,
];

// ── V4: Philosophy Quotes table ──
export const CREATE_PHILOSOPHY_QUOTES = `
CREATE TABLE IF NOT EXISTS jn_philosophy_quotes (
  id TEXT PRIMARY KEY NOT NULL,
  day_number INTEGER NOT NULL UNIQUE,
  quote_text TEXT NOT NULL,
  author TEXT NOT NULL,
  tradition TEXT NOT NULL
    CHECK (tradition IN ('stoicism', 'buddhism', 'existentialism', 'pragmatism', 'general_wisdom')),
  reflection_prompt TEXT NOT NULL,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  times_reflected INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const V4_PHILOSOPHY_INDEXES = [
  `CREATE INDEX IF NOT EXISTS jn_philosophy_quotes_day_idx ON jn_philosophy_quotes(day_number)`,
  `CREATE INDEX IF NOT EXISTS jn_philosophy_quotes_tradition_idx ON jn_philosophy_quotes(tradition)`,
  `CREATE INDEX IF NOT EXISTS jn_philosophy_quotes_fav_idx ON jn_philosophy_quotes(is_favorite)`,
];

// ── V4: Affirmations tables ──
export const CREATE_AFFIRMATIONS = `
CREATE TABLE IF NOT EXISTS jn_affirmations (
  id TEXT PRIMARY KEY NOT NULL,
  text TEXT NOT NULL,
  category TEXT NOT NULL
    CHECK (category IN (
      'self_worth', 'resilience', 'growth', 'health',
      'relationships', 'gratitude', 'productivity', 'peace'
    )),
  is_builtin INTEGER NOT NULL DEFAULT 0,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  is_dismissed INTEGER NOT NULL DEFAULT 0,
  times_shown INTEGER NOT NULL DEFAULT 0,
  times_affirmed INTEGER NOT NULL DEFAULT 0,
  last_shown_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_AFFIRMATION_LOGS = `
CREATE TABLE IF NOT EXISTS jn_affirmation_logs (
  id TEXT PRIMARY KEY NOT NULL,
  affirmation_id TEXT NOT NULL REFERENCES jn_affirmations(id) ON DELETE CASCADE,
  log_date TEXT NOT NULL,
  action TEXT NOT NULL
    CHECK (action IN ('shown', 'affirmed', 'wrote_entry', 'dismissed')),
  entry_id TEXT REFERENCES jn_entries(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const V4_AFFIRMATION_INDEXES = [
  `CREATE INDEX IF NOT EXISTS jn_affirmations_dismissed_idx ON jn_affirmations(is_dismissed)`,
  `CREATE INDEX IF NOT EXISTS jn_affirmations_favorite_idx ON jn_affirmations(is_favorite)`,
  `CREATE INDEX IF NOT EXISTS jn_affirmations_category_idx ON jn_affirmations(category)`,
  `CREATE INDEX IF NOT EXISTS jn_affirmations_last_shown_idx ON jn_affirmations(last_shown_date)`,
  `CREATE INDEX IF NOT EXISTS jn_affirmation_logs_date_idx ON jn_affirmation_logs(log_date, action)`,
  `CREATE INDEX IF NOT EXISTS jn_affirmation_logs_aff_idx ON jn_affirmation_logs(affirmation_id)`,
];

// ── V4: Grid layout tables ──
export const V4_GRID_COLUMNS = [
  `ALTER TABLE jn_entries ADD COLUMN grid_rows INTEGER`,
  `ALTER TABLE jn_entries ADD COLUMN grid_cols INTEGER`,
];

export const CREATE_GRID_CELLS = `
CREATE TABLE IF NOT EXISTS jn_grid_cells (
  id TEXT PRIMARY KEY NOT NULL,
  entry_id TEXT NOT NULL REFERENCES jn_entries(id) ON DELETE CASCADE,
  cell_row INTEGER NOT NULL CHECK (cell_row >= 0 AND cell_row <= 3),
  cell_col INTEGER NOT NULL CHECK (cell_col >= 0 AND cell_col <= 3),
  prompt TEXT NOT NULL,
  content TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(entry_id, cell_row, cell_col)
)`;

export const CREATE_GRID_LAYOUTS = `
CREATE TABLE IF NOT EXISTS jn_grid_layouts (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  rows INTEGER NOT NULL CHECK (rows >= 1 AND rows <= 4),
  cols INTEGER NOT NULL CHECK (cols >= 1 AND cols <= 4),
  is_builtin INTEGER NOT NULL DEFAULT 0,
  grid_config TEXT NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const V4_GRID_INDEXES = [
  `CREATE INDEX IF NOT EXISTS jn_grid_cells_entry_idx ON jn_grid_cells(entry_id)`,
  `CREATE INDEX IF NOT EXISTS jn_grid_cells_position_idx ON jn_grid_cells(entry_id, cell_row, cell_col)`,
];

// ── V4: Vision Board tables ──
export const CREATE_VISION_BOARDS = `
CREATE TABLE IF NOT EXISTS jn_vision_boards (
  id TEXT PRIMARY KEY NOT NULL,
  entry_id TEXT NOT NULL REFERENCES jn_entries(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  orientation TEXT NOT NULL DEFAULT 'portrait'
    CHECK (orientation IN ('portrait', 'landscape')),
  background_color TEXT NOT NULL DEFAULT '#1A1A2E',
  is_daily_vision INTEGER NOT NULL DEFAULT 0,
  item_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_VISION_BOARD_ITEMS = `
CREATE TABLE IF NOT EXISTS jn_vision_board_items (
  id TEXT PRIMARY KEY NOT NULL,
  board_id TEXT NOT NULL REFERENCES jn_vision_boards(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL
    CHECK (item_type IN ('image', 'text', 'quote', 'goal')),
  content TEXT,
  image_path TEXT,
  position_x REAL NOT NULL DEFAULT 0.5,
  position_y REAL NOT NULL DEFAULT 0.5,
  width REAL NOT NULL DEFAULT 0.3,
  height REAL NOT NULL DEFAULT 0.3,
  rotation_deg REAL NOT NULL DEFAULT 0,
  z_index INTEGER NOT NULL DEFAULT 0,
  background_color TEXT,
  font_size INTEGER DEFAULT 18,
  goal_target_date TEXT,
  goal_progress INTEGER DEFAULT 0 CHECK (goal_progress >= 0 AND goal_progress <= 100),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const V4_VISION_BOARD_INDEXES = [
  `CREATE INDEX IF NOT EXISTS jn_vision_boards_daily_idx ON jn_vision_boards(is_daily_vision)`,
  `CREATE INDEX IF NOT EXISTS jn_vision_board_items_board_idx ON jn_vision_board_items(board_id)`,
  `CREATE INDEX IF NOT EXISTS jn_vision_board_items_z_idx ON jn_vision_board_items(board_id, z_index)`,
];

// ── V4: New settings ──
export const V4_SETTINGS = [
  `INSERT OR IGNORE INTO jn_settings (key, value) VALUES ('aiPromptsEnabled', 'true')`,
  `INSERT OR IGNORE INTO jn_settings (key, value) VALUES ('philosophyEnabled', 'true')`,
  `INSERT OR IGNORE INTO jn_settings (key, value) VALUES ('affirmationsEnabled', 'true')`,
  `INSERT OR IGNORE INTO jn_settings (key, value) VALUES ('dailyVisionEnabled', 'false')`,
];

// ── Combined V4 migration ──
export const V4_UP = [
  // AI Prompts
  CREATE_AI_PROMPTS,
  ...V4_AI_PROMPTS_INDEXES,
  // Philosophy Quotes
  CREATE_PHILOSOPHY_QUOTES,
  ...V4_PHILOSOPHY_INDEXES,
  // Affirmations
  CREATE_AFFIRMATIONS,
  CREATE_AFFIRMATION_LOGS,
  ...V4_AFFIRMATION_INDEXES,
  // Grid Layout
  ...V4_GRID_COLUMNS,
  CREATE_GRID_CELLS,
  CREATE_GRID_LAYOUTS,
  ...V4_GRID_INDEXES,
  // Vision Board
  CREATE_VISION_BOARDS,
  CREATE_VISION_BOARD_ITEMS,
  ...V4_VISION_BOARD_INDEXES,
  // Settings
  ...V4_SETTINGS,
];

// ── Combined V3 migration ──
export const V3_UP = [
  // Voice
  ...V3_VOICE_COLUMNS,
  CREATE_VOICE_RECORDINGS,
  ...V3_VOICE_INDEXES,
  // Metadata
  ...V3_METADATA_COLUMNS,
  ...V3_METADATA_INDEXES,
  ...V3_METADATA_SETTINGS,
  // Therapy
  ...V3_THERAPY_COLUMNS,
  CREATE_THERAPY_TOPICS,
  ...V3_THERAPY_INDEXES,
  // CBT
  CREATE_THOUGHT_RECORDS,
  CREATE_THOUGHT_RECORD_EMOTIONS,
  CREATE_THOUGHT_RECORD_DISTORTIONS,
  ...V3_CBT_INDEXES,
];

export const V2_UP = [
  CREATE_JOURNALS,
  `INSERT OR IGNORE INTO jn_journals (id, name, description, color, is_default, created_at, updated_at)
   VALUES ('${DEFAULT_JOURNAL_ID}', 'Daily Journal', 'Default notebook for daily writing', '#A78BFA', 1, datetime('now'), datetime('now'))`,
  `ALTER TABLE jn_entries ADD COLUMN journal_id TEXT REFERENCES jn_journals(id)`,
  `UPDATE jn_entries SET journal_id = '${DEFAULT_JOURNAL_ID}' WHERE journal_id IS NULL`,
  ...JOURNAL_INDEXES,
];
