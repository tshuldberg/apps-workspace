import type { DatabaseAdapter } from '@mylife/db';
import type { MeditationTemplate, MeditationSession, MeditationStep, CreateMeditationSessionInput, CompleteMeditationSessionInput } from '../types';

function nowIso(): string {
  return new Date().toISOString();
}

function rowToTemplate(row: Record<string, unknown>): MeditationTemplate {
  return {
    id: row.id as string,
    name: row.name as string,
    description: row.description as string,
    category: row.category as string,
    difficulty: row.difficulty as MeditationTemplate['difficulty'],
    durationSeconds: row.duration_seconds as number,
    steps: JSON.parse(row.steps_json as string) as MeditationStep[],
    isDefault: (row.is_default as number) === 1,
    sortOrder: row.sort_order as number,
    createdAt: row.created_at as string,
  };
}

function rowToSession(row: Record<string, unknown>): MeditationSession {
  return {
    id: row.id as string,
    templateId: (row.template_id as string) ?? null,
    templateName: row.template_name as string,
    durationSeconds: row.duration_seconds as number,
    stepsCompleted: row.steps_completed as number,
    totalSteps: row.total_steps as number,
    preMoodScore: (row.pre_mood_score as number) ?? null,
    postMoodScore: (row.post_mood_score as number) ?? null,
    completed: (row.completed as number) === 1,
    startedAt: row.started_at as string,
    completedAt: (row.completed_at as string) ?? null,
    createdAt: row.created_at as string,
  };
}

export function getMeditationTemplates(db: DatabaseAdapter): MeditationTemplate[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM mo_meditation_templates ORDER BY category, sort_order, name`,
  );
  return rows.map(rowToTemplate);
}

export function getMeditationTemplatesByCategory(db: DatabaseAdapter, category: string): MeditationTemplate[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM mo_meditation_templates WHERE category = ? ORDER BY sort_order, name`,
    [category],
  );
  return rows.map(rowToTemplate);
}

export function getMeditationTemplateById(db: DatabaseAdapter, id: string): MeditationTemplate | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM mo_meditation_templates WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rowToTemplate(rows[0]) : null;
}

export function createMeditationSession(
  db: DatabaseAdapter,
  id: string,
  input: CreateMeditationSessionInput,
): MeditationSession {
  const now = nowIso();
  db.execute(
    `INSERT INTO mo_meditation_sessions (id, template_id, template_name, duration_seconds, total_steps, pre_mood_score, started_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.templateId ?? null, input.templateName, input.durationSeconds, input.totalSteps, input.preMoodScore ?? null, now, now],
  );
  return {
    id,
    templateId: input.templateId ?? null,
    templateName: input.templateName,
    durationSeconds: input.durationSeconds,
    stepsCompleted: 0,
    totalSteps: input.totalSteps,
    preMoodScore: input.preMoodScore ?? null,
    postMoodScore: null,
    completed: false,
    startedAt: now,
    completedAt: null,
    createdAt: now,
  };
}

export function completeMeditationSession(
  db: DatabaseAdapter,
  id: string,
  input: CompleteMeditationSessionInput,
): void {
  const now = nowIso();
  db.execute(
    `UPDATE mo_meditation_sessions SET steps_completed = ?, post_mood_score = ?, completed = 1, completed_at = ? WHERE id = ?`,
    [input.stepsCompleted, input.postMoodScore ?? null, now, id],
  );
}

export function getMeditationSession(db: DatabaseAdapter, id: string): MeditationSession | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM mo_meditation_sessions WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rowToSession(rows[0]) : null;
}

export function getMeditationSessions(db: DatabaseAdapter, limit = 50): MeditationSession[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM mo_meditation_sessions ORDER BY started_at DESC LIMIT ?`,
    [limit],
  );
  return rows.map(rowToSession);
}

export function getMeditationSessionCount(db: DatabaseAdapter): number {
  const rows = db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM mo_meditation_sessions`,
  );
  return rows[0].count;
}
