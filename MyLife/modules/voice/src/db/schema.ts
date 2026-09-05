// MyVoice SQLite schema - table prefix: vc_

export const CREATE_TRANSCRIPTIONS = `
CREATE TABLE IF NOT EXISTS vc_transcriptions (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  duration_seconds REAL NOT NULL,
  language TEXT,
  confidence REAL,
  audio_uri TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_VOICE_NOTES = `
CREATE TABLE IF NOT EXISTS vc_voice_notes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  transcription_id TEXT REFERENCES vc_transcriptions(id) ON DELETE SET NULL,
  tags TEXT,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_VOICE_SETTINGS = `
CREATE TABLE IF NOT EXISTS vc_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
)`;

export const CREATE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS vc_transcriptions_created_idx ON vc_transcriptions(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS vc_transcriptions_language_idx ON vc_transcriptions(language)`,
  `CREATE INDEX IF NOT EXISTS vc_voice_notes_created_idx ON vc_voice_notes(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS vc_voice_notes_favorite_idx ON vc_voice_notes(is_favorite)`,
  `CREATE INDEX IF NOT EXISTS vc_voice_notes_transcription_idx ON vc_voice_notes(transcription_id)`,
];

export const ALL_TABLES = [
  CREATE_TRANSCRIPTIONS,
  CREATE_VOICE_NOTES,
  CREATE_VOICE_SETTINGS,
];

// ── V2 Tables: Speaker Identification ────────────────────────────────

export const CREATE_SPEAKERS = `
CREATE TABLE IF NOT EXISTS vc_speakers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  voice_print_hash TEXT,
  sample_count INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#EF4444',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_SPEAKER_SEGMENTS = `
CREATE TABLE IF NOT EXISTS vc_speaker_segments (
  id TEXT PRIMARY KEY,
  transcription_id TEXT NOT NULL REFERENCES vc_transcriptions(id) ON DELETE CASCADE,
  speaker_id TEXT REFERENCES vc_speakers(id) ON DELETE SET NULL,
  speaker_label TEXT NOT NULL DEFAULT 'Speaker 1',
  start_seconds REAL NOT NULL,
  end_seconds REAL NOT NULL,
  text TEXT NOT NULL,
  confidence REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// ── V2 Tables: Custom Voice Commands ─────────────────────────────────

export const CREATE_COMMANDS = `
CREATE TABLE IF NOT EXISTS vc_commands (
  id TEXT PRIMARY KEY,
  phrase TEXT NOT NULL,
  action TEXT NOT NULL,
  module_target TEXT,
  params TEXT,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 0,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_COMMAND_LOG = `
CREATE TABLE IF NOT EXISTS vc_command_log (
  id TEXT PRIMARY KEY,
  command_id TEXT NOT NULL REFERENCES vc_commands(id) ON DELETE CASCADE,
  matched_phrase TEXT NOT NULL,
  match_confidence REAL,
  executed_at TEXT NOT NULL DEFAULT (datetime('now')),
  success INTEGER NOT NULL DEFAULT 1,
  error_message TEXT
)`;

// ── V2 Tables: Multi-Language Transcription ──────────────────────────

export const CREATE_LANGUAGE_SEGMENTS = `
CREATE TABLE IF NOT EXISTS vc_language_segments (
  id TEXT PRIMARY KEY,
  transcription_id TEXT NOT NULL REFERENCES vc_transcriptions(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  start_seconds REAL NOT NULL,
  end_seconds REAL NOT NULL,
  text TEXT NOT NULL,
  confidence REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_LANGUAGE_PROFILES = `
CREATE TABLE IF NOT EXISTS vc_language_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  languages TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// ── V2 Indexes ───────────────────────────────────────────────────────

export const CREATE_V2_INDEXES = [
  `CREATE INDEX IF NOT EXISTS vc_speakers_name_idx ON vc_speakers(name)`,
  `CREATE INDEX IF NOT EXISTS vc_speaker_segments_transcription_idx ON vc_speaker_segments(transcription_id)`,
  `CREATE INDEX IF NOT EXISTS vc_speaker_segments_speaker_idx ON vc_speaker_segments(speaker_id)`,
  `CREATE INDEX IF NOT EXISTS vc_speaker_segments_time_idx ON vc_speaker_segments(transcription_id, start_seconds)`,
  `CREATE INDEX IF NOT EXISTS vc_commands_enabled_idx ON vc_commands(is_enabled)`,
  `CREATE INDEX IF NOT EXISTS vc_commands_module_idx ON vc_commands(module_target)`,
  `CREATE INDEX IF NOT EXISTS vc_command_log_command_idx ON vc_command_log(command_id)`,
  `CREATE INDEX IF NOT EXISTS vc_command_log_executed_idx ON vc_command_log(executed_at DESC)`,
  `CREATE INDEX IF NOT EXISTS vc_lang_segments_transcription_idx ON vc_language_segments(transcription_id)`,
  `CREATE INDEX IF NOT EXISTS vc_lang_segments_language_idx ON vc_language_segments(language)`,
  `CREATE INDEX IF NOT EXISTS vc_lang_segments_time_idx ON vc_language_segments(transcription_id, start_seconds)`,
  `CREATE INDEX IF NOT EXISTS vc_lang_profiles_default_idx ON vc_language_profiles(is_default)`,
];

export const V2_TABLES = [
  CREATE_SPEAKERS,
  CREATE_SPEAKER_SEGMENTS,
  CREATE_COMMANDS,
  CREATE_COMMAND_LOG,
  CREATE_LANGUAGE_SEGMENTS,
  CREATE_LANGUAGE_PROFILES,
];
