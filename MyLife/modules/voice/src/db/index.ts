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
} from './schema';

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
} from './crud';
