'use server';

import { getAdapter, ensureModuleMigrations } from '@/lib/db';
import {
  // Transcription CRUD
  createTranscription,
  getTranscription,
  getTranscriptions,
  updateTranscription,
  deleteTranscription,
  // Voice Note CRUD
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
  getLanguageProfiles,
  setDefaultProfile,
  deleteLanguageProfile,
} from '@mylife/voice';

/** Ensure voice module tables exist before any query. */
function db() {
  const adapter = getAdapter();
  ensureModuleMigrations('voice');
  return adapter;
}

// ── Transcription CRUD ──────────────────────────────────────────────

export async function createTranscriptionAction(input: {
  text: string;
  durationSeconds: number;
  language?: string | null;
  confidence?: number | null;
  audioUri?: string | null;
}) {
  const id = crypto.randomUUID();
  return createTranscription(db(), id, input);
}

export async function fetchTranscriptionAction(id: string) {
  return getTranscription(db(), id);
}

export async function fetchTranscriptionsAction(options?: {
  limit?: number;
  offset?: number;
}) {
  return getTranscriptions(db(), options);
}

export async function updateTranscriptionAction(
  id: string,
  input: {
    text?: string;
    durationSeconds?: number;
    language?: string | null;
    confidence?: number | null;
    audioUri?: string | null;
  },
) {
  return updateTranscription(db(), id, input);
}

export async function deleteTranscriptionAction(id: string) {
  return deleteTranscription(db(), id);
}

export async function searchTranscriptionsAction(
  query: string,
  options?: { limit?: number; offset?: number },
) {
  const adapter = db();
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;
  const escaped = query.replace(/[%_]/g, (ch) => `\\${ch}`);
  const rows = adapter.query<Record<string, unknown>>(
    `SELECT * FROM vc_transcriptions WHERE text LIKE ? ESCAPE '\\' ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [`%${escaped}%`, limit, offset],
  );
  return rows.map((row) => ({
    id: row.id as string,
    text: row.text as string,
    durationSeconds: row.duration_seconds as number,
    language: (row.language as string) ?? null,
    confidence: (row.confidence as number) ?? null,
    audioUri: (row.audio_uri as string) ?? null,
    createdAt: row.created_at as string,
  }));
}

// ── Voice Note CRUD ─────────────────────────────────────────────────

export async function createVoiceNoteAction(input: {
  title: string;
  transcriptionId?: string | null;
  tags?: string | null;
  isFavorite?: boolean;
}) {
  const id = crypto.randomUUID();
  return createVoiceNote(db(), id, input);
}

export async function fetchVoiceNoteAction(id: string) {
  return getVoiceNote(db(), id);
}

export async function fetchVoiceNotesAction(options?: {
  limit?: number;
  offset?: number;
}) {
  return getVoiceNotes(db(), options);
}

export async function updateVoiceNoteAction(
  id: string,
  input: { title?: string; tags?: string | null; isFavorite?: boolean },
) {
  return updateVoiceNote(db(), id, input);
}

export async function deleteVoiceNoteAction(id: string) {
  return deleteVoiceNote(db(), id);
}

export async function toggleFavoriteAction(id: string) {
  return toggleFavorite(db(), id);
}

// ── Settings ────────────────────────────────────────────────────────

export async function setSettingAction(key: string, value: string) {
  return setSetting(db(), key, value);
}

export async function fetchSettingAction(key: string) {
  return getSetting(db(), key);
}

export async function fetchSettingsAction() {
  return getSettings(db());
}

// ── Stats ───────────────────────────────────────────────────────────

export async function fetchTranscriptionStatsAction() {
  return getTranscriptionStats(db());
}

// ── Speakers ────────────────────────────────────────────────────────

export async function createSpeakerAction(input: {
  name: string;
  color?: string;
}) {
  const id = crypto.randomUUID();
  return createSpeaker(db(), id, input);
}

export async function fetchSpeakerAction(id: string) {
  return getSpeaker(db(), id);
}

export async function fetchSpeakersAction() {
  return getSpeakers(db());
}

export async function updateSpeakerAction(
  id: string,
  input: { name?: string; color?: string },
) {
  return updateSpeaker(db(), id, input);
}

export async function deleteSpeakerAction(id: string) {
  return deleteSpeaker(db(), id);
}

// ── Speaker Segments ────────────────────────────────────────────────

export async function createSpeakerSegmentAction(input: {
  transcriptionId: string;
  speakerId?: string | null;
  speakerLabel: string;
  startSeconds: number;
  endSeconds: number;
  text: string;
  confidence?: number | null;
}) {
  const id = crypto.randomUUID();
  return createSpeakerSegment(db(), id, input);
}

export async function fetchSpeakerSegmentsAction(transcriptionId: string) {
  return getSpeakerSegments(db(), transcriptionId);
}

export async function updateSegmentSpeakerAction(
  segmentId: string,
  speakerId: string | null,
  speakerLabel: string,
) {
  return updateSegmentSpeaker(db(), segmentId, speakerId, speakerLabel);
}

// ── Commands ────────────────────────────────────────────────────────

export async function createCommandAction(input: {
  phrase: string;
  action: string;
  moduleTarget?: string | null;
  params?: string | null;
  isEnabled?: boolean;
  priority?: number;
}) {
  const id = crypto.randomUUID();
  return createCommand(db(), id, input);
}

export async function fetchCommandsAction(options?: {
  enabledOnly?: boolean;
}) {
  return getCommands(db(), options);
}

export async function updateCommandAction(
  id: string,
  input: {
    phrase?: string;
    action?: string;
    moduleTarget?: string | null;
    params?: string | null;
    isEnabled?: boolean;
    priority?: number;
  },
) {
  return updateCommand(db(), id, input);
}

export async function deleteCommandAction(id: string) {
  return deleteCommand(db(), id);
}

export async function incrementCommandUsageAction(id: string) {
  return incrementCommandUsage(db(), id);
}

// ── Command Log ─────────────────────────────────────────────────────

export async function logCommandExecutionAction(input: {
  commandId: string;
  matchedPhrase: string;
  matchConfidence?: number | null;
  success: boolean;
  errorMessage?: string | null;
}) {
  const id = crypto.randomUUID();
  return logCommandExecution(db(), id, input);
}

export async function fetchCommandLogAction(options?: {
  commandId?: string;
  limit?: number;
}) {
  return getCommandLog(db(), options);
}

// ── Language Segments ───────────────────────────────────────────────

export async function createLanguageSegmentAction(input: {
  transcriptionId: string;
  language: string;
  startSeconds: number;
  endSeconds: number;
  text: string;
  confidence?: number | null;
}) {
  const id = crypto.randomUUID();
  return createLanguageSegment(db(), id, input);
}

export async function fetchLanguageSegmentsAction(transcriptionId: string) {
  return getLanguageSegments(db(), transcriptionId);
}

export async function fetchLanguageBreakdownAction(transcriptionId: string) {
  return getLanguageBreakdown(db(), transcriptionId);
}

// ── Language Profiles ───────────────────────────────────────────────

export async function createLanguageProfileAction(input: {
  name: string;
  languages: string[];
  isDefault?: boolean;
}) {
  const id = crypto.randomUUID();
  return createLanguageProfile(db(), id, input);
}

export async function fetchLanguageProfilesAction() {
  return getLanguageProfiles(db());
}

export async function setDefaultProfileAction(id: string) {
  return setDefaultProfile(db(), id);
}

export async function deleteLanguageProfileAction(id: string) {
  return deleteLanguageProfile(db(), id);
}
