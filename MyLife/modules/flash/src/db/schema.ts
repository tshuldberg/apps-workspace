export const DEFAULT_FLASH_DECK_ID = 'fl_deck_default';

export const CREATE_DECKS = `
CREATE TABLE IF NOT EXISTS fl_decks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  parent_id TEXT REFERENCES fl_decks(id) ON DELETE SET NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_CARDS = `
CREATE TABLE IF NOT EXISTS fl_cards (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL,
  deck_id TEXT NOT NULL REFERENCES fl_decks(id) ON DELETE CASCADE,
  card_type TEXT NOT NULL,
  template_ordinal INTEGER NOT NULL DEFAULT 0,
  front TEXT NOT NULL,
  back TEXT NOT NULL DEFAULT '',
  tags_json TEXT NOT NULL DEFAULT '[]',
  queue TEXT NOT NULL DEFAULT 'new',
  interval_days REAL NOT NULL DEFAULT 0,
  ease REAL NOT NULL DEFAULT 2.5,
  due_at TEXT,
  last_review_at TEXT,
  review_count INTEGER NOT NULL DEFAULT 0,
  lapse_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_REVIEW_LOGS = `
CREATE TABLE IF NOT EXISTS fl_review_logs (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES fl_cards(id) ON DELETE CASCADE,
  rating TEXT NOT NULL,
  scheduled_before_at TEXT,
  scheduled_after_at TEXT,
  reviewed_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_SETTINGS = `
CREATE TABLE IF NOT EXISTS fl_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
)`;

export const CREATE_EXPORT_RECORDS = `
CREATE TABLE IF NOT EXISTS fl_export_records (
  id TEXT PRIMARY KEY,
  deck_id TEXT REFERENCES fl_decks(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL DEFAULT 0,
  cards_exported INTEGER NOT NULL DEFAULT 0,
  media_exported INTEGER NOT NULL DEFAULT 0,
  include_scheduling INTEGER NOT NULL DEFAULT 1,
  include_media INTEGER NOT NULL DEFAULT 0,
  include_tags INTEGER NOT NULL DEFAULT 1,
  exported_at TEXT NOT NULL DEFAULT (datetime('now')),
  duration_ms INTEGER NOT NULL DEFAULT 0
)`;

export const BASE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS fl_cards_deck_idx ON fl_cards(deck_id, queue, due_at)`,
  `CREATE INDEX IF NOT EXISTS fl_cards_note_idx ON fl_cards(note_id)`,
  `CREATE INDEX IF NOT EXISTS fl_review_logs_card_idx ON fl_review_logs(card_id, reviewed_at DESC)`,
  `CREATE INDEX IF NOT EXISTS fl_review_logs_date_idx ON fl_review_logs(reviewed_at DESC)`,
];

export const SEED_SETTINGS = [
  `INSERT OR IGNORE INTO fl_settings (key, value) VALUES ('dailyNewLimit', '20')`,
  `INSERT OR IGNORE INTO fl_settings (key, value) VALUES ('dailyReviewLimit', '200')`,
  `INSERT OR IGNORE INTO fl_settings (key, value) VALUES ('dailyStudyTarget', '1')`,
];

export const EXPANDED_SETTINGS = [
  `INSERT OR IGNORE INTO fl_settings (key, value) VALUES ('autoBurySiblings', '1')`,
  `INSERT OR IGNORE INTO fl_settings (key, value) VALUES ('dailyReminderEnabled', '0')`,
  `INSERT OR IGNORE INTO fl_settings (key, value) VALUES ('dailyReminderTime', '09:00')`,
  `INSERT OR IGNORE INTO fl_settings (key, value) VALUES ('desiredRetention', '0.90')`,
  `INSERT OR IGNORE INTO fl_settings (key, value) VALUES ('leechThreshold', '8')`,
];

export const DEFAULT_DECK_SEED = `
INSERT OR IGNORE INTO fl_decks (id, name, description, parent_id, is_default, created_at, updated_at)
VALUES ('${DEFAULT_FLASH_DECK_ID}', 'Default', 'Default study deck', NULL, 1, datetime('now'), datetime('now'))`;

export const BASE_TABLES = [
  CREATE_DECKS,
  CREATE_CARDS,
  CREATE_REVIEW_LOGS,
  CREATE_SETTINGS,
];

// ── V3 Tables ─────────────────────────────────────────────────────────

export const CREATE_MEDIA = `
CREATE TABLE IF NOT EXISTS fl_media (
  id TEXT PRIMARY KEY NOT NULL,
  hash TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'audio')),
  mime_type TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL DEFAULT 0,
  width INTEGER,
  height INTEGER,
  duration_ms INTEGER,
  local_path TEXT NOT NULL,
  reference_count INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_MC_RESULTS = `
CREATE TABLE IF NOT EXISTS fl_mc_results (
  id TEXT PRIMARY KEY NOT NULL,
  deck_id TEXT NOT NULL REFERENCES fl_decks(id) ON DELETE CASCADE,
  question_count INTEGER NOT NULL,
  correct_count INTEGER NOT NULL,
  incorrect_count INTEGER NOT NULL,
  score_percent REAL NOT NULL,
  time_ms INTEGER NOT NULL DEFAULT 0,
  played_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_MATCH_RESULTS = `
CREATE TABLE IF NOT EXISTS fl_match_results (
  id TEXT PRIMARY KEY NOT NULL,
  deck_id TEXT NOT NULL REFERENCES fl_decks(id) ON DELETE CASCADE,
  board_size INTEGER NOT NULL,
  time_ms INTEGER NOT NULL DEFAULT 0,
  mistakes INTEGER NOT NULL DEFAULT 0,
  stars INTEGER NOT NULL DEFAULT 1 CHECK (stars >= 1 AND stars <= 3),
  card_ids_json TEXT NOT NULL DEFAULT '[]',
  played_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_MATCH_BESTS = `
CREATE TABLE IF NOT EXISTS fl_match_bests (
  deck_id TEXT NOT NULL REFERENCES fl_decks(id) ON DELETE CASCADE,
  board_size INTEGER NOT NULL,
  best_time_ms INTEGER NOT NULL,
  best_stars INTEGER NOT NULL DEFAULT 1,
  achieved_at TEXT NOT NULL,
  PRIMARY KEY (deck_id, board_size)
)`;

export const V3_INDEXES = [
  `CREATE INDEX IF NOT EXISTS fl_media_type_idx ON fl_media(media_type)`,
  `CREATE INDEX IF NOT EXISTS fl_mc_results_deck_idx ON fl_mc_results(deck_id, played_at DESC)`,
  `CREATE INDEX IF NOT EXISTS fl_match_results_deck_idx ON fl_match_results(deck_id, played_at DESC)`,
];

export const V3_UP = [
  CREATE_MEDIA,
  CREATE_MC_RESULTS,
  CREATE_MATCH_RESULTS,
  CREATE_MATCH_BESTS,
  ...V3_INDEXES,
  `ALTER TABLE fl_cards ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'`,
];

// ── V4 Tables (B+C features) ──────────────────────────────────────────

export const CREATE_TEMPLATES = `
CREATE TABLE IF NOT EXISTS fl_templates (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_builtin INTEGER NOT NULL DEFAULT 0,
  card_count_per_note INTEGER NOT NULL DEFAULT 1,
  front_format TEXT NOT NULL DEFAULT '{{Front}}',
  back_format TEXT NOT NULL DEFAULT '{{Back}}',
  css TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_TEMPLATE_FIELDS = `
CREATE TABLE IF NOT EXISTS fl_template_fields (
  id TEXT PRIMARY KEY NOT NULL,
  template_id TEXT NOT NULL REFERENCES fl_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text' CHECK (field_type IN ('text', 'richtext', 'media', 'audio')),
  is_required INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  placeholder TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_OCCLUSION_REGIONS = `
CREATE TABLE IF NOT EXISTS fl_occlusion_regions (
  id TEXT PRIMARY KEY NOT NULL,
  card_id TEXT NOT NULL REFERENCES fl_cards(id) ON DELETE CASCADE,
  media_id TEXT NOT NULL REFERENCES fl_media(id) ON DELETE CASCADE,
  region_index INTEGER NOT NULL DEFAULT 0,
  shape TEXT NOT NULL DEFAULT 'rect' CHECK (shape IN ('rect', 'ellipse')),
  x REAL NOT NULL,
  y REAL NOT NULL,
  width REAL NOT NULL,
  height REAL NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  mask_color TEXT NOT NULL DEFAULT '#FBBF24',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_PRACTICE_TESTS = `
CREATE TABLE IF NOT EXISTS fl_practice_tests (
  id TEXT PRIMARY KEY NOT NULL,
  deck_id TEXT NOT NULL REFERENCES fl_decks(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Practice Test',
  question_count INTEGER NOT NULL,
  time_limit_seconds INTEGER,
  question_types_json TEXT NOT NULL DEFAULT '["mc","tf"]',
  total_score REAL,
  max_score INTEGER,
  score_percent REAL,
  time_taken_seconds INTEGER,
  weak_tags_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
)`;

export const CREATE_PRACTICE_ANSWERS = `
CREATE TABLE IF NOT EXISTS fl_practice_answers (
  id TEXT PRIMARY KEY NOT NULL,
  test_id TEXT NOT NULL REFERENCES fl_practice_tests(id) ON DELETE CASCADE,
  question_index INTEGER NOT NULL,
  source_card_id TEXT REFERENCES fl_cards(id) ON DELETE SET NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('mc', 'tf', 'short_answer', 'fill_blank')),
  question_text TEXT NOT NULL,
  options_json TEXT NOT NULL DEFAULT '[]',
  correct_answer TEXT NOT NULL,
  user_answer TEXT,
  is_correct INTEGER,
  time_spent_seconds INTEGER NOT NULL DEFAULT 0,
  explanation TEXT NOT NULL DEFAULT '',
  answered_at TEXT
)`;

export const CREATE_CONVERSATIONS = `
CREATE TABLE IF NOT EXISTS fl_conversations (
  id TEXT PRIMARY KEY NOT NULL,
  deck_id TEXT NOT NULL REFERENCES fl_decks(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'tutor' CHECK (mode IN ('tutor', 'quiz', 'explain', 'debate')),
  difficulty TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('beginner', 'medium', 'advanced')),
  language TEXT NOT NULL DEFAULT 'en',
  topic_summary TEXT NOT NULL DEFAULT '',
  message_count INTEGER NOT NULL DEFAULT 0,
  cards_referenced INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  performance_rating REAL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
)`;

export const CREATE_CONVERSATION_MESSAGES = `
CREATE TABLE IF NOT EXISTS fl_conversation_messages (
  id TEXT PRIMARY KEY NOT NULL,
  conversation_id TEXT NOT NULL REFERENCES fl_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('system', 'assistant', 'user')),
  content TEXT NOT NULL,
  card_ids_json TEXT NOT NULL DEFAULT '[]',
  tokens_used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_LEAGUES = `
CREATE TABLE IF NOT EXISTS fl_leagues (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  season_start TEXT NOT NULL,
  season_end TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum', 'diamond')),
  max_members INTEGER NOT NULL DEFAULT 30,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_LEAGUE_MEMBERS = `
CREATE TABLE IF NOT EXISTS fl_league_members (
  id TEXT PRIMARY KEY NOT NULL,
  league_id TEXT NOT NULL REFERENCES fl_leagues(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  is_self INTEGER NOT NULL DEFAULT 0,
  joined_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_LEAGUE_SCORES = `
CREATE TABLE IF NOT EXISTS fl_league_scores (
  id TEXT PRIMARY KEY NOT NULL,
  league_id TEXT NOT NULL REFERENCES fl_leagues(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  week_start TEXT NOT NULL,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  cards_reviewed INTEGER NOT NULL DEFAULT 0,
  streak_days INTEGER NOT NULL DEFAULT 0,
  rank INTEGER,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const BUILTIN_TEMPLATE_SEEDS = [
  `INSERT OR IGNORE INTO fl_templates (id, name, description, is_builtin, card_count_per_note, front_format, back_format, sort_order)
   VALUES ('fl_tpl_basic', 'Basic', 'Simple front/back card', 1, 1, '{{Front}}', '{{Back}}', 0)`,
  `INSERT OR IGNORE INTO fl_templates (id, name, description, is_builtin, card_count_per_note, front_format, back_format, sort_order)
   VALUES ('fl_tpl_reversed', 'Basic (Reversed)', 'Creates front->back and back->front cards', 1, 2, '{{Front}}', '{{Back}}', 1)`,
  `INSERT OR IGNORE INTO fl_templates (id, name, description, is_builtin, card_count_per_note, front_format, back_format, sort_order)
   VALUES ('fl_tpl_cloze', 'Cloze', 'Fill in the blank using {{c1::...}} syntax', 1, 1, '{{Text}}', '{{Extra}}', 2)`,
  `INSERT OR IGNORE INTO fl_templates (id, name, description, is_builtin, card_count_per_note, front_format, back_format, sort_order)
   VALUES ('fl_tpl_vocab', 'Vocabulary', 'Word, reading, meaning, example', 1, 2, '{{Word}}\\n{{Reading}}', '{{Meaning}}\\n{{Example}}', 3)`,
];

export const BUILTIN_FIELD_SEEDS = [
  `INSERT OR IGNORE INTO fl_template_fields (id, template_id, name, field_type, is_required, sort_order, placeholder)
   VALUES ('fl_fld_basic_front', 'fl_tpl_basic', 'Front', 'text', 1, 0, 'Question or term')`,
  `INSERT OR IGNORE INTO fl_template_fields (id, template_id, name, field_type, is_required, sort_order, placeholder)
   VALUES ('fl_fld_basic_back', 'fl_tpl_basic', 'Back', 'text', 1, 1, 'Answer or definition')`,
  `INSERT OR IGNORE INTO fl_template_fields (id, template_id, name, field_type, is_required, sort_order, placeholder)
   VALUES ('fl_fld_rev_front', 'fl_tpl_reversed', 'Front', 'text', 1, 0, 'Term')`,
  `INSERT OR IGNORE INTO fl_template_fields (id, template_id, name, field_type, is_required, sort_order, placeholder)
   VALUES ('fl_fld_rev_back', 'fl_tpl_reversed', 'Back', 'text', 1, 1, 'Definition')`,
  `INSERT OR IGNORE INTO fl_template_fields (id, template_id, name, field_type, is_required, sort_order, placeholder)
   VALUES ('fl_fld_cloze_text', 'fl_tpl_cloze', 'Text', 'text', 1, 0, 'Text with {{c1::deletions}}')`,
  `INSERT OR IGNORE INTO fl_template_fields (id, template_id, name, field_type, is_required, sort_order, placeholder)
   VALUES ('fl_fld_cloze_extra', 'fl_tpl_cloze', 'Extra', 'text', 0, 1, 'Additional context')`,
  `INSERT OR IGNORE INTO fl_template_fields (id, template_id, name, field_type, is_required, sort_order, placeholder)
   VALUES ('fl_fld_vocab_word', 'fl_tpl_vocab', 'Word', 'text', 1, 0, 'Vocabulary word')`,
  `INSERT OR IGNORE INTO fl_template_fields (id, template_id, name, field_type, is_required, sort_order, placeholder)
   VALUES ('fl_fld_vocab_reading', 'fl_tpl_vocab', 'Reading', 'text', 0, 1, 'Pronunciation or reading')`,
  `INSERT OR IGNORE INTO fl_template_fields (id, template_id, name, field_type, is_required, sort_order, placeholder)
   VALUES ('fl_fld_vocab_meaning', 'fl_tpl_vocab', 'Meaning', 'text', 1, 2, 'Definition or meaning')`,
  `INSERT OR IGNORE INTO fl_template_fields (id, template_id, name, field_type, is_required, sort_order, placeholder)
   VALUES ('fl_fld_vocab_example', 'fl_tpl_vocab', 'Example', 'text', 0, 3, 'Example sentence')`,
];

export const V4_INDEXES = [
  `CREATE INDEX IF NOT EXISTS fl_templates_builtin_idx ON fl_templates(is_builtin)`,
  `CREATE INDEX IF NOT EXISTS fl_template_fields_tpl_idx ON fl_template_fields(template_id, sort_order)`,
  `CREATE INDEX IF NOT EXISTS fl_occlusion_card_idx ON fl_occlusion_regions(card_id)`,
  `CREATE INDEX IF NOT EXISTS fl_occlusion_media_idx ON fl_occlusion_regions(media_id)`,
  `CREATE INDEX IF NOT EXISTS fl_practice_tests_deck_idx ON fl_practice_tests(deck_id, started_at DESC)`,
  `CREATE INDEX IF NOT EXISTS fl_practice_answers_test_idx ON fl_practice_answers(test_id, question_index)`,
  `CREATE INDEX IF NOT EXISTS fl_conversations_deck_idx ON fl_conversations(deck_id, started_at DESC)`,
  `CREATE INDEX IF NOT EXISTS fl_conversation_msgs_conv_idx ON fl_conversation_messages(conversation_id, created_at ASC)`,
  `CREATE INDEX IF NOT EXISTS fl_leagues_active_idx ON fl_leagues(is_active, season_start DESC)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS fl_league_members_league_idx ON fl_league_members(league_id, user_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS fl_league_scores_league_idx ON fl_league_scores(league_id, user_id, week_start)`,
  `CREATE INDEX IF NOT EXISTS fl_league_scores_ranking_idx ON fl_league_scores(league_id, week_start, xp_earned DESC)`,
];

// ── V5 Tables (Star/Favorite) ────────────────────────────────────────

export const V5_UP = [
  `ALTER TABLE fl_cards ADD COLUMN starred INTEGER NOT NULL DEFAULT 0`,
];

export const V4_UP = [
  // Custom templates
  CREATE_TEMPLATES,
  CREATE_TEMPLATE_FIELDS,
  `ALTER TABLE fl_cards ADD COLUMN template_id TEXT REFERENCES fl_templates(id) ON DELETE SET NULL`,
  `ALTER TABLE fl_cards ADD COLUMN fields_json TEXT NOT NULL DEFAULT '{}'`,
  // Image occlusion
  CREATE_OCCLUSION_REGIONS,
  // Practice tests
  CREATE_PRACTICE_TESTS,
  CREATE_PRACTICE_ANSWERS,
  // Conversation practice
  CREATE_CONVERSATIONS,
  CREATE_CONVERSATION_MESSAGES,
  // Competitive leagues
  CREATE_LEAGUES,
  CREATE_LEAGUE_MEMBERS,
  CREATE_LEAGUE_SCORES,
  // All indexes
  ...V4_INDEXES,
  // Seed built-in templates
  ...BUILTIN_TEMPLATE_SEEDS,
  ...BUILTIN_FIELD_SEEDS,
];

export const V2_UP = [
  `ALTER TABLE fl_cards ADD COLUMN queue_before_suspend TEXT`,
  `ALTER TABLE fl_cards ADD COLUMN queue_before_bury TEXT`,
  `ALTER TABLE fl_cards ADD COLUMN buried_until TEXT`,
  CREATE_EXPORT_RECORDS,
  `CREATE INDEX IF NOT EXISTS fl_cards_queue_idx ON fl_cards(queue, due_at)`,
  `CREATE INDEX IF NOT EXISTS fl_cards_buried_until_idx ON fl_cards(buried_until)`,
  `CREATE INDEX IF NOT EXISTS fl_export_records_date_idx ON fl_export_records(exported_at DESC)`,
  ...EXPANDED_SETTINGS,
];
