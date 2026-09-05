import type { DatabaseAdapter } from '@mylife/db';
import type { FocusSession, SoundPreset, SoundLayer, CreateFocusSessionInput, CompleteFocusSessionInput, CreateSoundPresetInput } from '../types';

function nowIso(): string {
  return new Date().toISOString();
}

function rowToFocusSession(row: Record<string, unknown>): FocusSession {
  return {
    id: row.id as string,
    presetName: row.preset_name as string,
    layers: JSON.parse(row.layers_json as string) as SoundLayer[],
    targetDurationSeconds: row.target_duration_seconds as number,
    actualDurationSeconds: row.actual_duration_seconds as number,
    completed: (row.completed as number) === 1,
    preMoodScore: (row.pre_mood_score as number) ?? null,
    postMoodScore: (row.post_mood_score as number) ?? null,
    startedAt: row.started_at as string,
    completedAt: (row.completed_at as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function rowToPreset(row: Record<string, unknown>): SoundPreset {
  return {
    id: row.id as string,
    name: row.name as string,
    layers: JSON.parse(row.layers_json as string) as SoundLayer[],
    isDefault: (row.is_default as number) === 1,
    sortOrder: row.sort_order as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function createFocusSession(
  db: DatabaseAdapter,
  id: string,
  input: CreateFocusSessionInput,
): FocusSession {
  const now = nowIso();
  const layersJson = JSON.stringify(input.layers);
  db.execute(
    `INSERT INTO mo_focus_sessions (id, preset_name, layers_json, target_duration_seconds, pre_mood_score, started_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.presetName, layersJson, input.targetDurationSeconds, input.preMoodScore ?? null, now, now],
  );
  return {
    id,
    presetName: input.presetName,
    layers: input.layers,
    targetDurationSeconds: input.targetDurationSeconds,
    actualDurationSeconds: 0,
    completed: false,
    preMoodScore: input.preMoodScore ?? null,
    postMoodScore: null,
    startedAt: now,
    completedAt: null,
    createdAt: now,
  };
}

export function completeFocusSession(
  db: DatabaseAdapter,
  id: string,
  input: CompleteFocusSessionInput,
): void {
  const now = nowIso();
  db.execute(
    `UPDATE mo_focus_sessions SET actual_duration_seconds = ?, post_mood_score = ?, completed = 1, completed_at = ? WHERE id = ?`,
    [input.actualDurationSeconds, input.postMoodScore ?? null, now, id],
  );
}

export function getFocusSession(db: DatabaseAdapter, id: string): FocusSession | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM mo_focus_sessions WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rowToFocusSession(rows[0]) : null;
}

export function getFocusSessions(db: DatabaseAdapter, limit = 50): FocusSession[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM mo_focus_sessions ORDER BY started_at DESC LIMIT ?`,
    [limit],
  );
  return rows.map(rowToFocusSession);
}

export function getSoundPresets(db: DatabaseAdapter): SoundPreset[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM mo_sound_presets ORDER BY sort_order ASC, name ASC`,
  );
  return rows.map(rowToPreset);
}

export function getSoundPresetById(db: DatabaseAdapter, id: string): SoundPreset | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM mo_sound_presets WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rowToPreset(rows[0]) : null;
}

export function createSoundPreset(
  db: DatabaseAdapter,
  id: string,
  input: CreateSoundPresetInput,
): SoundPreset {
  const now = nowIso();
  const layersJson = JSON.stringify(input.layers);
  db.execute(
    `INSERT INTO mo_sound_presets (id, name, layers_json, is_default, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, 0, ?, ?, ?)`,
    [id, input.name, layersJson, input.sortOrder ?? 0, now, now],
  );
  return {
    id,
    name: input.name,
    layers: input.layers,
    isDefault: false,
    sortOrder: input.sortOrder ?? 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function deleteSoundPreset(db: DatabaseAdapter, id: string): boolean {
  db.execute(`DELETE FROM mo_sound_presets WHERE id = ? AND is_default = 0`, [id]);
  return true;
}
