import type { DatabaseAdapter } from '@mylife/db';
import {
  CreateProgressEntryInputSchema,
  CreateProgressEntryRecordSchema,
  UpdateCreateProgressEntryInputSchema,
  type CreateProgressEntryInput,
  type CreateProgressEntryRecord,
  type UpdateCreateProgressEntryInput,
} from '../../models/schemas';
import { getProject, recalcProjectActualHours } from './projects';
import {
  normalizeNullableText,
  parseStringArray,
  serializeStringArray,
} from './shared';

interface ProgressEntryRow {
  id: string;
  project_id: string;
  date: string;
  notes_md: string | null;
  hours_spent: number | null;
  milestone: number | null;
  milestone_name: string | null;
  roadblock: string | null;
  breakthrough: string | null;
  mood: string | null;
  photo_ids: string | null;
  created_at: string;
}

function deserializeProgressEntry(
  row: ProgressEntryRow,
): CreateProgressEntryRecord {
  return CreateProgressEntryRecordSchema.parse({
    id: row.id,
    project_id: row.project_id,
    date: row.date,
    notes_md: row.notes_md,
    hours_spent: row.hours_spent ?? 0,
    milestone: (row.milestone ?? 0) === 1,
    milestone_name: row.milestone_name,
    roadblock: row.roadblock,
    breakthrough: row.breakthrough,
    mood: row.mood,
    photo_ids: parseStringArray(row.photo_ids),
    created_at: row.created_at,
  });
}

export function createProgressEntry(
  db: DatabaseAdapter,
  id: string,
  input: CreateProgressEntryInput,
): CreateProgressEntryRecord {
  const parsed = CreateProgressEntryInputSchema.parse(input);
  if (!getProject(db, parsed.project_id)) {
    throw new Error(`Project not found: ${parsed.project_id}`);
  }

  const now = new Date().toISOString();
  const entry = CreateProgressEntryRecordSchema.parse({
    id,
    project_id: parsed.project_id,
    date: parsed.date ?? now,
    notes_md: normalizeNullableText(parsed.notes_md),
    hours_spent: parsed.hours_spent ?? 0,
    milestone: parsed.milestone ?? false,
    milestone_name:
      parsed.milestone ?? false
        ? normalizeNullableText(parsed.milestone_name)
        : null,
    roadblock: normalizeNullableText(parsed.roadblock),
    breakthrough: normalizeNullableText(parsed.breakthrough),
    mood: parsed.mood ?? null,
    photo_ids: parsed.photo_ids ?? [],
    created_at: now,
  });

  db.transaction(() => {
    db.execute(
      `INSERT INTO ct_progress_entries (
        id, project_id, date, notes_md, hours_spent, milestone,
        milestone_name, roadblock, breakthrough, mood, photo_ids, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.id,
        entry.project_id,
        entry.date,
        entry.notes_md,
        entry.hours_spent,
        entry.milestone ? 1 : 0,
        entry.milestone_name,
        entry.roadblock,
        entry.breakthrough,
        entry.mood,
        serializeStringArray(entry.photo_ids),
        entry.created_at,
      ],
    );
    recalcProjectActualHours(db, entry.project_id);
  });

  return entry;
}

export function getProgressEntry(
  db: DatabaseAdapter,
  id: string,
): CreateProgressEntryRecord | null {
  const rows = db.query<ProgressEntryRow>(
    `SELECT * FROM ct_progress_entries WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? deserializeProgressEntry(rows[0]) : null;
}

export function updateProgressEntry(
  db: DatabaseAdapter,
  id: string,
  updates: UpdateCreateProgressEntryInput,
): CreateProgressEntryRecord | null {
  const parsed = UpdateCreateProgressEntryInputSchema.parse(updates);
  const existing = getProgressEntry(db, id);
  if (!existing) return null;

  const fields: string[] = [];
  const values: unknown[] = [];

  if (parsed.date !== undefined) {
    fields.push('date = ?');
    values.push(parsed.date);
  }
  if (parsed.notes_md !== undefined) {
    fields.push('notes_md = ?');
    values.push(normalizeNullableText(parsed.notes_md));
  }
  if (parsed.hours_spent !== undefined) {
    fields.push('hours_spent = ?');
    values.push(parsed.hours_spent);
  }
  if (parsed.milestone !== undefined) {
    fields.push('milestone = ?');
    values.push(parsed.milestone ? 1 : 0);
    if (!parsed.milestone && parsed.milestone_name === undefined) {
      fields.push('milestone_name = ?');
      values.push(null);
    }
  }
  if (parsed.milestone_name !== undefined) {
    fields.push('milestone_name = ?');
    values.push(normalizeNullableText(parsed.milestone_name));
  }
  if (parsed.roadblock !== undefined) {
    fields.push('roadblock = ?');
    values.push(normalizeNullableText(parsed.roadblock));
  }
  if (parsed.breakthrough !== undefined) {
    fields.push('breakthrough = ?');
    values.push(normalizeNullableText(parsed.breakthrough));
  }
  if (parsed.mood !== undefined) {
    fields.push('mood = ?');
    values.push(parsed.mood);
  }
  if (parsed.photo_ids !== undefined) {
    fields.push('photo_ids = ?');
    values.push(serializeStringArray(parsed.photo_ids));
  }

  if (fields.length === 0) return existing;

  db.transaction(() => {
    db.execute(
      `UPDATE ct_progress_entries SET ${fields.join(', ')} WHERE id = ?`,
      [...values, id],
    );
    recalcProjectActualHours(db, existing.project_id);
  });

  return getProgressEntry(db, id);
}

export function deleteProgressEntry(db: DatabaseAdapter, id: string): void {
  const existing = getProgressEntry(db, id);
  if (!existing) return;

  db.transaction(() => {
    db.execute(`DELETE FROM ct_progress_entries WHERE id = ?`, [id]);
    recalcProjectActualHours(db, existing.project_id);
  });
}

export function listProgressByProject(
  db: DatabaseAdapter,
  projectId: string,
): CreateProgressEntryRecord[] {
  return db
    .query<ProgressEntryRow>(
      `SELECT * FROM ct_progress_entries
       WHERE project_id = ?
       ORDER BY date DESC, created_at DESC`,
      [projectId],
    )
    .map(deserializeProgressEntry);
}

export function listMilestones(
  db: DatabaseAdapter,
  projectId?: string,
): CreateProgressEntryRecord[] {
  const where = ['milestone = 1'];
  const params: unknown[] = [];

  if (projectId) {
    where.push('project_id = ?');
    params.push(projectId);
  }

  return db
    .query<ProgressEntryRow>(
      `SELECT * FROM ct_progress_entries
       WHERE ${where.join(' AND ')}
       ORDER BY date DESC, created_at DESC`,
      params,
    )
    .map(deserializeProgressEntry);
}

export function getBreakthroughs(
  db: DatabaseAdapter,
  projectId?: string,
): CreateProgressEntryRecord[] {
  const where = ["breakthrough IS NOT NULL", "TRIM(breakthrough) != ''"];
  const params: unknown[] = [];

  if (projectId) {
    where.push('project_id = ?');
    params.push(projectId);
  }

  return db
    .query<ProgressEntryRow>(
      `SELECT * FROM ct_progress_entries
       WHERE ${where.join(' AND ')}
       ORDER BY date DESC, created_at DESC`,
      params,
    )
    .map(deserializeProgressEntry);
}
