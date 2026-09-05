import type { DatabaseAdapter } from '@mylife/db';
import type {
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
} from '../types';

// ── Helpers ────────────────────────────────────────────────────────────

function nowIso(): string {
  return new Date().toISOString();
}

function rowToTranscription(row: Record<string, unknown>): Transcription {
  return {
    id: row.id as string,
    text: row.text as string,
    durationSeconds: row.duration_seconds as number,
    language: (row.language as string) ?? null,
    confidence: (row.confidence as number) ?? null,
    audioUri: (row.audio_uri as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function rowToVoiceNote(row: Record<string, unknown>): VoiceNote {
  return {
    id: row.id as string,
    title: row.title as string,
    transcriptionId: (row.transcription_id as string) ?? null,
    tags: (row.tags as string) ?? null,
    isFavorite: (row.is_favorite as number) === 1,
    createdAt: row.created_at as string,
  };
}

// ── Transcriptions ────────────────────────────────────────────────────

export function createTranscription(
  db: DatabaseAdapter,
  id: string,
  input: {
    text: string;
    durationSeconds: number;
    language?: string | null;
    confidence?: number | null;
    audioUri?: string | null;
  },
): Transcription {
  const now = nowIso();
  db.execute(
    `INSERT INTO vc_transcriptions (id, text, duration_seconds, language, confidence, audio_uri, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.text,
      input.durationSeconds,
      input.language ?? null,
      input.confidence ?? null,
      input.audioUri ?? null,
      now,
    ],
  );
  return {
    id,
    text: input.text,
    durationSeconds: input.durationSeconds,
    language: input.language ?? null,
    confidence: input.confidence ?? null,
    audioUri: input.audioUri ?? null,
    createdAt: now,
  };
}

export function getTranscription(db: DatabaseAdapter, id: string): Transcription | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM vc_transcriptions WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rowToTranscription(rows[0]) : null;
}

export function getTranscriptions(
  db: DatabaseAdapter,
  options?: { limit?: number; offset?: number },
): Transcription[] {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM vc_transcriptions ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [limit, offset],
  );
  return rows.map(rowToTranscription);
}

export function updateTranscription(
  db: DatabaseAdapter,
  id: string,
  input: {
    text?: string;
    durationSeconds?: number;
    language?: string | null;
    confidence?: number | null;
    audioUri?: string | null;
  },
): Transcription | null {
  const existing = getTranscription(db, id);
  if (!existing) return null;

  const updates: string[] = [];
  const params: unknown[] = [];

  if (input.text !== undefined) {
    updates.push('text = ?');
    params.push(input.text);
  }
  if (input.durationSeconds !== undefined) {
    updates.push('duration_seconds = ?');
    params.push(input.durationSeconds);
  }
  if (input.language !== undefined) {
    updates.push('language = ?');
    params.push(input.language);
  }
  if (input.confidence !== undefined) {
    updates.push('confidence = ?');
    params.push(input.confidence);
  }
  if (input.audioUri !== undefined) {
    updates.push('audio_uri = ?');
    params.push(input.audioUri);
  }

  if (updates.length === 0) return existing;

  params.push(id);
  db.execute(`UPDATE vc_transcriptions SET ${updates.join(', ')} WHERE id = ?`, params);
  return getTranscription(db, id);
}

export function deleteTranscription(db: DatabaseAdapter, id: string): boolean {
  db.execute(`DELETE FROM vc_transcriptions WHERE id = ?`, [id]);
  return true;
}

// ── Voice Notes ───────────────────────────────────────────────────────

export function createVoiceNote(
  db: DatabaseAdapter,
  id: string,
  input: {
    title: string;
    transcriptionId?: string | null;
    tags?: string | null;
    isFavorite?: boolean;
  },
): VoiceNote {
  const now = nowIso();
  const isFavorite = input.isFavorite ? 1 : 0;
  db.execute(
    `INSERT INTO vc_voice_notes (id, title, transcription_id, tags, is_favorite, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, input.title, input.transcriptionId ?? null, input.tags ?? null, isFavorite, now],
  );
  return {
    id,
    title: input.title,
    transcriptionId: input.transcriptionId ?? null,
    tags: input.tags ?? null,
    isFavorite: !!input.isFavorite,
    createdAt: now,
  };
}

export function getVoiceNote(db: DatabaseAdapter, id: string): VoiceNote | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM vc_voice_notes WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rowToVoiceNote(rows[0]) : null;
}

export function getVoiceNotes(
  db: DatabaseAdapter,
  options?: { limit?: number; offset?: number },
): VoiceNote[] {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM vc_voice_notes ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [limit, offset],
  );
  return rows.map(rowToVoiceNote);
}

export function updateVoiceNote(
  db: DatabaseAdapter,
  id: string,
  input: {
    title?: string;
    tags?: string | null;
    isFavorite?: boolean;
  },
): VoiceNote | null {
  const existing = getVoiceNote(db, id);
  if (!existing) return null;

  const updates: string[] = [];
  const params: unknown[] = [];

  if (input.title !== undefined) {
    updates.push('title = ?');
    params.push(input.title);
  }
  if (input.tags !== undefined) {
    updates.push('tags = ?');
    params.push(input.tags);
  }
  if (input.isFavorite !== undefined) {
    updates.push('is_favorite = ?');
    params.push(input.isFavorite ? 1 : 0);
  }

  if (updates.length === 0) return existing;

  params.push(id);
  db.execute(`UPDATE vc_voice_notes SET ${updates.join(', ')} WHERE id = ?`, params);
  return getVoiceNote(db, id);
}

export function deleteVoiceNote(db: DatabaseAdapter, id: string): boolean {
  db.execute(`DELETE FROM vc_voice_notes WHERE id = ?`, [id]);
  return true;
}

export function toggleFavorite(db: DatabaseAdapter, id: string): VoiceNote | null {
  db.execute(
    `UPDATE vc_voice_notes SET is_favorite = 1 - is_favorite WHERE id = ?`,
    [id],
  );
  return getVoiceNote(db, id);
}

// ── Settings ──────────────────────────────────────────────────────────

export function setSetting(db: DatabaseAdapter, key: string, value: string): void {
  db.execute(
    `INSERT INTO vc_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}

export function getSetting(db: DatabaseAdapter, key: string): string | null {
  const rows = db.query<VoiceSetting>(
    `SELECT * FROM vc_settings WHERE key = ?`,
    [key],
  );
  return rows.length > 0 ? rows[0].value : null;
}

export function getSettings(db: DatabaseAdapter): VoiceSetting[] {
  return db.query<VoiceSetting>(`SELECT * FROM vc_settings ORDER BY key ASC`);
}

// ── Stats ─────────────────────────────────────────────────────────────

export function getTranscriptionStats(db: DatabaseAdapter): TranscriptionStats {
  const countRow = db.query<{ count: number; total_duration: number | null; avg_duration: number | null }>(
    `SELECT
       COUNT(*) as count,
       COALESCE(SUM(duration_seconds), 0) as total_duration,
       COALESCE(AVG(duration_seconds), 0) as avg_duration
     FROM vc_transcriptions`,
  );

  const byLanguage = db.query<{ language: string; count: number }>(
    `SELECT COALESCE(language, 'unknown') as language, COUNT(*) as count
     FROM vc_transcriptions
     GROUP BY language
     ORDER BY count DESC`,
  );

  return {
    totalCount: countRow[0].count,
    totalDurationSeconds: countRow[0].total_duration ?? 0,
    avgDurationSeconds: countRow[0].avg_duration ?? 0,
    byLanguage,
  };
}

// ── Row Mappers (V2) ─────────────────────────────────────────────────

function rowToSpeaker(row: Record<string, unknown>): Speaker {
  return {
    id: row.id as string,
    name: row.name as string,
    voicePrintHash: (row.voice_print_hash as string) ?? null,
    sampleCount: row.sample_count as number,
    color: row.color as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToSpeakerSegment(row: Record<string, unknown>): SpeakerSegment {
  return {
    id: row.id as string,
    transcriptionId: row.transcription_id as string,
    speakerId: (row.speaker_id as string) ?? null,
    speakerLabel: row.speaker_label as string,
    startSeconds: row.start_seconds as number,
    endSeconds: row.end_seconds as number,
    text: row.text as string,
    confidence: (row.confidence as number) ?? null,
    createdAt: row.created_at as string,
  };
}

function rowToVoiceCommand(row: Record<string, unknown>): VoiceCommand {
  return {
    id: row.id as string,
    phrase: row.phrase as string,
    action: row.action as string,
    moduleTarget: (row.module_target as string) ?? null,
    params: (row.params as string) ?? null,
    isEnabled: (row.is_enabled as number) === 1,
    priority: row.priority as number,
    usageCount: row.usage_count as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToCommandLog(row: Record<string, unknown>): CommandLog {
  return {
    id: row.id as string,
    commandId: row.command_id as string,
    matchedPhrase: row.matched_phrase as string,
    matchConfidence: (row.match_confidence as number) ?? null,
    executedAt: row.executed_at as string,
    success: (row.success as number) === 1,
    errorMessage: (row.error_message as string) ?? null,
  };
}

function rowToLanguageSegment(row: Record<string, unknown>): LanguageSegment {
  return {
    id: row.id as string,
    transcriptionId: row.transcription_id as string,
    language: row.language as string,
    startSeconds: row.start_seconds as number,
    endSeconds: row.end_seconds as number,
    text: row.text as string,
    confidence: (row.confidence as number) ?? null,
    createdAt: row.created_at as string,
  };
}

function safeParseLanguages(raw: unknown): string[] {
  if (typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function rowToLanguageProfile(row: Record<string, unknown>): LanguageProfile {
  return {
    id: row.id as string,
    name: row.name as string,
    languages: safeParseLanguages(row.languages),
    isDefault: (row.is_default as number) === 1,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ── Speakers ─────────────────────────────────────────────────────────

export function createSpeaker(
  db: DatabaseAdapter,
  id: string,
  input: {
    name: string;
    voicePrintHash?: string | null;
    color?: string;
  },
): Speaker {
  const now = nowIso();
  const color = input.color ?? '#EF4444';
  db.execute(
    `INSERT INTO vc_speakers (id, name, voice_print_hash, color, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, input.name, input.voicePrintHash ?? null, color, now, now],
  );
  return {
    id,
    name: input.name,
    voicePrintHash: input.voicePrintHash ?? null,
    sampleCount: 0,
    color,
    createdAt: now,
    updatedAt: now,
  };
}

export function getSpeaker(db: DatabaseAdapter, id: string): Speaker | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM vc_speakers WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rowToSpeaker(rows[0]) : null;
}

export function getSpeakers(
  db: DatabaseAdapter,
  options?: { limit?: number },
): Speaker[] {
  const limit = options?.limit ?? 200;
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM vc_speakers ORDER BY name ASC LIMIT ?`,
    [limit],
  );
  return rows.map(rowToSpeaker);
}

export function updateSpeaker(
  db: DatabaseAdapter,
  id: string,
  input: {
    name?: string;
    color?: string;
    voicePrintHash?: string | null;
    incrementSamples?: boolean;
  },
): Speaker | null {
  const existing = getSpeaker(db, id);
  if (!existing) return null;

  const updates: string[] = [];
  const params: unknown[] = [];

  if (input.name !== undefined) {
    updates.push('name = ?');
    params.push(input.name);
  }
  if (input.color !== undefined) {
    updates.push('color = ?');
    params.push(input.color);
  }
  if (input.voicePrintHash !== undefined) {
    updates.push('voice_print_hash = ?');
    params.push(input.voicePrintHash);
  }
  if (input.incrementSamples) {
    updates.push('sample_count = sample_count + 1');
  }

  updates.push('updated_at = ?');
  params.push(nowIso());
  params.push(id);

  db.execute(`UPDATE vc_speakers SET ${updates.join(', ')} WHERE id = ?`, params);
  return getSpeaker(db, id);
}

export function deleteSpeaker(db: DatabaseAdapter, id: string): boolean {
  db.execute(`DELETE FROM vc_speakers WHERE id = ?`, [id]);
  return true;
}

// ── Speaker Segments ─────────────────────────────────────────────────

export function createSpeakerSegment(
  db: DatabaseAdapter,
  id: string,
  input: {
    transcriptionId: string;
    speakerId?: string | null;
    speakerLabel: string;
    startSeconds: number;
    endSeconds: number;
    text: string;
    confidence?: number | null;
  },
): SpeakerSegment {
  const now = nowIso();
  db.execute(
    `INSERT INTO vc_speaker_segments (id, transcription_id, speaker_id, speaker_label, start_seconds, end_seconds, text, confidence, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.transcriptionId,
      input.speakerId ?? null,
      input.speakerLabel,
      input.startSeconds,
      input.endSeconds,
      input.text,
      input.confidence ?? null,
      now,
    ],
  );
  return {
    id,
    transcriptionId: input.transcriptionId,
    speakerId: input.speakerId ?? null,
    speakerLabel: input.speakerLabel,
    startSeconds: input.startSeconds,
    endSeconds: input.endSeconds,
    text: input.text,
    confidence: input.confidence ?? null,
    createdAt: now,
  };
}

export function getSpeakerSegments(
  db: DatabaseAdapter,
  transcriptionId: string,
): SpeakerSegment[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM vc_speaker_segments WHERE transcription_id = ? ORDER BY start_seconds ASC`,
    [transcriptionId],
  );
  return rows.map(rowToSpeakerSegment);
}

export function updateSegmentSpeaker(
  db: DatabaseAdapter,
  segmentId: string,
  speakerId: string | null,
  speakerLabel: string,
): boolean {
  db.execute(
    `UPDATE vc_speaker_segments SET speaker_id = ?, speaker_label = ? WHERE id = ?`,
    [speakerId, speakerLabel, segmentId],
  );
  return true;
}

// ── Voice Commands ───────────────────────────────────────────────────

export function createCommand(
  db: DatabaseAdapter,
  id: string,
  input: {
    phrase: string;
    action: string;
    moduleTarget?: string | null;
    params?: string | null;
    isEnabled?: boolean;
    priority?: number;
  },
): VoiceCommand {
  const now = nowIso();
  const isEnabled = input.isEnabled !== false ? 1 : 0;
  const priority = input.priority ?? 0;
  db.execute(
    `INSERT INTO vc_commands (id, phrase, action, module_target, params, is_enabled, priority, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.phrase, input.action, input.moduleTarget ?? null, input.params ?? null, isEnabled, priority, now, now],
  );
  return {
    id,
    phrase: input.phrase,
    action: input.action,
    moduleTarget: input.moduleTarget ?? null,
    params: input.params ?? null,
    isEnabled: isEnabled === 1,
    priority,
    usageCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function getCommand(db: DatabaseAdapter, id: string): VoiceCommand | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM vc_commands WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rowToVoiceCommand(rows[0]) : null;
}

export function getCommands(
  db: DatabaseAdapter,
  options?: { enabledOnly?: boolean; limit?: number },
): VoiceCommand[] {
  const enabledOnly = options?.enabledOnly ?? false;
  const limit = options?.limit ?? 200;
  const where = enabledOnly ? 'WHERE is_enabled = 1' : '';
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM vc_commands ${where} ORDER BY priority DESC, created_at ASC LIMIT ?`,
    [limit],
  );
  return rows.map(rowToVoiceCommand);
}

export function updateCommand(
  db: DatabaseAdapter,
  id: string,
  input: {
    phrase?: string;
    action?: string;
    moduleTarget?: string | null;
    params?: string | null;
    isEnabled?: boolean;
    priority?: number;
  },
): VoiceCommand | null {
  const existing = getCommand(db, id);
  if (!existing) return null;

  const updates: string[] = [];
  const params: unknown[] = [];

  if (input.phrase !== undefined) {
    updates.push('phrase = ?');
    params.push(input.phrase);
  }
  if (input.action !== undefined) {
    updates.push('action = ?');
    params.push(input.action);
  }
  if (input.moduleTarget !== undefined) {
    updates.push('module_target = ?');
    params.push(input.moduleTarget);
  }
  if (input.params !== undefined) {
    updates.push('params = ?');
    params.push(input.params);
  }
  if (input.isEnabled !== undefined) {
    updates.push('is_enabled = ?');
    params.push(input.isEnabled ? 1 : 0);
  }
  if (input.priority !== undefined) {
    updates.push('priority = ?');
    params.push(input.priority);
  }

  if (updates.length === 0) return existing;

  updates.push('updated_at = ?');
  params.push(nowIso());
  params.push(id);

  db.execute(`UPDATE vc_commands SET ${updates.join(', ')} WHERE id = ?`, params);
  return getCommand(db, id);
}

export function deleteCommand(db: DatabaseAdapter, id: string): boolean {
  db.execute(`DELETE FROM vc_commands WHERE id = ?`, [id]);
  return true;
}

export function incrementCommandUsage(db: DatabaseAdapter, id: string): void {
  db.execute(
    `UPDATE vc_commands SET usage_count = usage_count + 1, updated_at = ? WHERE id = ?`,
    [nowIso(), id],
  );
}

// ── Command Log ──────────────────────────────────────────────────────

export function logCommandExecution(
  db: DatabaseAdapter,
  id: string,
  input: {
    commandId: string;
    matchedPhrase: string;
    matchConfidence?: number | null;
    success: boolean;
    errorMessage?: string | null;
  },
): CommandLog {
  const now = nowIso();
  db.execute(
    `INSERT INTO vc_command_log (id, command_id, matched_phrase, match_confidence, executed_at, success, error_message)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.commandId,
      input.matchedPhrase,
      input.matchConfidence ?? null,
      now,
      input.success ? 1 : 0,
      input.errorMessage ?? null,
    ],
  );
  return {
    id,
    commandId: input.commandId,
    matchedPhrase: input.matchedPhrase,
    matchConfidence: input.matchConfidence ?? null,
    executedAt: now,
    success: input.success,
    errorMessage: input.errorMessage ?? null,
  };
}

export function getCommandLog(
  db: DatabaseAdapter,
  options?: { commandId?: string; limit?: number },
): CommandLog[] {
  const limit = options?.limit ?? 50;
  const where = options?.commandId ? 'WHERE command_id = ?' : '';
  const params: unknown[] = options?.commandId ? [options.commandId, limit] : [limit];
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM vc_command_log ${where} ORDER BY executed_at DESC LIMIT ?`,
    params,
  );
  return rows.map(rowToCommandLog);
}

// ── Language Segments ────────────────────────────────────────────────

export function createLanguageSegment(
  db: DatabaseAdapter,
  id: string,
  input: {
    transcriptionId: string;
    language: string;
    startSeconds: number;
    endSeconds: number;
    text: string;
    confidence?: number | null;
  },
): LanguageSegment {
  const now = nowIso();
  db.execute(
    `INSERT INTO vc_language_segments (id, transcription_id, language, start_seconds, end_seconds, text, confidence, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.transcriptionId,
      input.language,
      input.startSeconds,
      input.endSeconds,
      input.text,
      input.confidence ?? null,
      now,
    ],
  );
  return {
    id,
    transcriptionId: input.transcriptionId,
    language: input.language,
    startSeconds: input.startSeconds,
    endSeconds: input.endSeconds,
    text: input.text,
    confidence: input.confidence ?? null,
    createdAt: now,
  };
}

export function getLanguageSegments(
  db: DatabaseAdapter,
  transcriptionId: string,
): LanguageSegment[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM vc_language_segments WHERE transcription_id = ? ORDER BY start_seconds ASC`,
    [transcriptionId],
  );
  return rows.map(rowToLanguageSegment);
}

export function getLanguageBreakdown(
  db: DatabaseAdapter,
  transcriptionId: string,
): Array<{ language: string; percentage: number; totalSeconds: number }> {
  const rows = db.query<{ language: string; total_seconds: number }>(
    `SELECT language, SUM(end_seconds - start_seconds) as total_seconds
     FROM vc_language_segments
     WHERE transcription_id = ?
     GROUP BY language
     ORDER BY total_seconds DESC`,
    [transcriptionId],
  );

  if (rows.length === 0) return [];

  const grandTotal = rows.reduce((sum, r) => sum + r.total_seconds, 0);
  if (grandTotal === 0) return [];

  return rows.map((r) => ({
    language: r.language,
    totalSeconds: r.total_seconds,
    percentage: Math.round((r.total_seconds / grandTotal) * 100),
  }));
}

// ── Language Profiles ────────────────────────────────────────────────

export function createLanguageProfile(
  db: DatabaseAdapter,
  id: string,
  input: {
    name: string;
    languages: string[];
    isDefault?: boolean;
  },
): LanguageProfile {
  const now = nowIso();
  const isDefault = input.isDefault ? 1 : 0;

  db.transaction(() => {
    // If setting as default, unset any existing default
    if (isDefault) {
      db.execute(`UPDATE vc_language_profiles SET is_default = 0 WHERE is_default = 1`);
    }

    db.execute(
      `INSERT INTO vc_language_profiles (id, name, languages, is_default, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, input.name, JSON.stringify(input.languages), isDefault, now, now],
    );
  });
  return {
    id,
    name: input.name,
    languages: input.languages,
    isDefault: isDefault === 1,
    createdAt: now,
    updatedAt: now,
  };
}

export function getLanguageProfile(db: DatabaseAdapter, id: string): LanguageProfile | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM vc_language_profiles WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rowToLanguageProfile(rows[0]) : null;
}

export function getLanguageProfiles(
  db: DatabaseAdapter,
  options?: { limit?: number },
): LanguageProfile[] {
  const limit = options?.limit ?? 100;
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM vc_language_profiles ORDER BY name ASC LIMIT ?`,
    [limit],
  );
  return rows.map(rowToLanguageProfile);
}

export function setDefaultProfile(db: DatabaseAdapter, id: string): LanguageProfile | null {
  const existing = getLanguageProfile(db, id);
  if (!existing) return null;

  db.transaction(() => {
    db.execute(`UPDATE vc_language_profiles SET is_default = 0 WHERE is_default = 1`);
    db.execute(
      `UPDATE vc_language_profiles SET is_default = 1, updated_at = ? WHERE id = ?`,
      [nowIso(), id],
    );
  });
  return getLanguageProfile(db, id);
}

export function deleteLanguageProfile(db: DatabaseAdapter, id: string): boolean {
  db.execute(`DELETE FROM vc_language_profiles WHERE id = ?`, [id]);
  return true;
}
