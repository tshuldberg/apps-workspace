// Definition
export { VOICE_MODULE } from './definition';

// Types and schemas
export type {
  Transcription,
  VoiceNote,
  VoiceSetting,
  TranscriptionStats,
  Speaker,
  SpeakerSegment,
  VoiceCommand,
  CommandLog,
  LanguageSegment,
  LanguageProfile,
} from './types';

export {
  TranscriptionSchema,
  VoiceNoteSchema,
  VoiceSettingSchema,
  TranscriptionStatsSchema,
  SpeakerSchema,
  SpeakerSegmentSchema,
  VoiceCommandSchema,
  CommandLogSchema,
  LanguageSegmentSchema,
  LanguageProfileSchema,
} from './types';

// CRUD
export {
  // Transcriptions
  createTranscription,
  getTranscription,
  getTranscriptions,
  updateTranscription,
  deleteTranscription,
  // Voice Notes
  createVoiceNote,
  getVoiceNote,
  getVoiceNotes,
  updateVoiceNote,
  deleteVoiceNote,
  toggleFavorite,
  // Settings
  setSetting,
  getSetting,
  getSettings,
  // Stats
  getTranscriptionStats,
  // Speakers
  createSpeaker,
  getSpeaker,
  getSpeakers,
  updateSpeaker,
  deleteSpeaker,
  // Speaker Segments
  createSpeakerSegment,
  getSpeakerSegments,
  updateSegmentSpeaker,
  // Commands
  createCommand,
  getCommand,
  getCommands,
  updateCommand,
  deleteCommand,
  incrementCommandUsage,
  // Command Log
  logCommandExecution,
  getCommandLog,
  // Language Segments
  createLanguageSegment,
  getLanguageSegments,
  getLanguageBreakdown,
  // Language Profiles
  createLanguageProfile,
  getLanguageProfile,
  getLanguageProfiles,
  setDefaultProfile,
  deleteLanguageProfile,
} from './db/crud';

// Schema DDL
export {
  ALL_TABLES,
  CREATE_TRANSCRIPTIONS,
  CREATE_VOICE_NOTES,
  CREATE_VOICE_SETTINGS,
  CREATE_INDEXES,
  V2_TABLES,
  CREATE_SPEAKERS,
  CREATE_SPEAKER_SEGMENTS,
  CREATE_COMMANDS,
  CREATE_COMMAND_LOG,
  CREATE_LANGUAGE_SEGMENTS,
  CREATE_LANGUAGE_PROFILES,
  CREATE_V2_INDEXES,
} from './db/schema';

// Engine - Text
export {
  calculateWordCount,
  calculateReadingTime,
  extractKeywords,
  summarizeText,
  formatDuration,
} from './engine/text';

// Engine - Speaker
export {
  SPEAKER_COLORS,
  getSpeakerColor,
  mergeShortSegments,
  assignSpeakerLabels,
  isMultiSpeaker,
  getSpeakerBreakdown,
  processDiarization,
} from './engine/speaker';

// Engine - Commands
export {
  normalizePhrase,
  phraseToRegex,
  hasVariableSlots,
  matchCommand,
  PRESET_TEMPLATES,
} from './engine/commands';

// Engine - Language
export {
  LANGUAGE_COLORS,
  SUPPORTED_LANGUAGES,
  MAX_PROFILE_LANGUAGES,
  isValidBcp47,
  getBaseLanguage,
  getLanguageColor,
  mergeAdjacentLanguageSegments,
  calculateLanguageBreakdown,
  isMultiLanguage,
  validateProfileLanguages,
  processLanguageDetection,
} from './engine/language';
