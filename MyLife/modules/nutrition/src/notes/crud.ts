import type { DatabaseAdapter } from '@mylife/db';
import type { DailyNote, NoteSearchResult } from './types';
import type { MealType } from '../types';

// ---------------------------------------------------------------------------
// Row mapper
// ---------------------------------------------------------------------------

function rowToDailyNote(row: Record<string, unknown>): DailyNote {
  const tags = parseJsonArray(row.tags as string | null);
  const mealTypes = parseJsonArray(row.meal_types as string | null) as MealType[] | null;
  const linkedFoodIds = parseJsonArray(row.linked_food_ids as string | null);

  return {
    id: row.id as string,
    date: row.date as string,
    content: row.content as string,
    tags,
    mealTypes,
    linkedFoodIds,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export function createDailyNote(
  db: DatabaseAdapter,
  id: string,
  input: {
    date: string;
    content: string;
    tags?: string[];
    mealTypes?: MealType[];
    linkedFoodIds?: string[];
  },
): void {
  const tagsJson = input.tags ? JSON.stringify(input.tags) : null;
  const mealTypesJson = input.mealTypes ? JSON.stringify(input.mealTypes) : null;
  const linkedFoodIdsJson = input.linkedFoodIds ? JSON.stringify(input.linkedFoodIds) : null;
  db.execute(
    `INSERT INTO nu_daily_notes (id, date, content, tags, meal_types, linked_food_ids, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [id, input.date, input.content, tagsJson, mealTypesJson, linkedFoodIdsJson],
  );
}

export function getDailyNote(db: DatabaseAdapter, date: string): DailyNote | null {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM nu_daily_notes WHERE date = ?',
    [date],
  );
  return rows.length > 0 ? rowToDailyNote(rows[0]) : null;
}

export function getDailyNotes(
  db: DatabaseAdapter,
  options?: {
    limit?: number;
    offset?: number;
  },
): DailyNote[] {
  const limit = options?.limit ?? 90;
  const offset = options?.offset ?? 0;

  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM nu_daily_notes ORDER BY date DESC LIMIT ? OFFSET ?',
      [limit, offset],
    )
    .map(rowToDailyNote);
}

export function getDailyNotesByDate(
  db: DatabaseAdapter,
  startDate: string,
  endDate = startDate,
): DailyNote[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM nu_daily_notes WHERE date BETWEEN ? AND ? ORDER BY date DESC',
      [startDate, endDate],
    )
    .map(rowToDailyNote);
}

export function updateDailyNote(
  db: DatabaseAdapter,
  date: string,
  updates: {
    content?: string;
    tags?: string[];
    mealTypes?: MealType[];
    linkedFoodIds?: string[];
  },
): void {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (updates.content !== undefined) {
    sets.push('content = ?');
    params.push(updates.content);
  }
  if (updates.tags !== undefined) {
    sets.push('tags = ?');
    params.push(JSON.stringify(updates.tags));
  }
  if (updates.mealTypes !== undefined) {
    sets.push('meal_types = ?');
    params.push(JSON.stringify(updates.mealTypes));
  }
  if (updates.linkedFoodIds !== undefined) {
    sets.push('linked_food_ids = ?');
    params.push(JSON.stringify(updates.linkedFoodIds));
  }

  if (sets.length === 0) return;

  sets.push("updated_at = datetime('now')");
  params.push(date);

  db.execute(
    `UPDATE nu_daily_notes SET ${sets.join(', ')} WHERE date = ?`,
    params,
  );
}

export function deleteDailyNote(db: DatabaseAdapter, date: string): void {
  db.execute('DELETE FROM nu_daily_notes WHERE date = ?', [date]);
}

/**
 * Upsert a daily note: creates if not exists, updates if exists.
 * If content is empty, deletes the note.
 */
export function upsertDailyNote(
  db: DatabaseAdapter,
  id: string,
  input: {
    date: string;
    content: string;
    tags?: string[];
    mealTypes?: MealType[];
    linkedFoodIds?: string[];
  },
): void {
  if (!input.content.trim()) {
    deleteDailyNote(db, input.date);
    return;
  }

  const tagsJson = input.tags ? JSON.stringify(input.tags) : null;
  const mealTypesJson = input.mealTypes ? JSON.stringify(input.mealTypes) : null;
  const linkedFoodIdsJson = input.linkedFoodIds ? JSON.stringify(input.linkedFoodIds) : null;
  db.execute(
    `INSERT INTO nu_daily_notes (id, date, content, tags, meal_types, linked_food_ids, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
     ON CONFLICT(date) DO UPDATE SET
       content = excluded.content,
       tags = excluded.tags,
       meal_types = excluded.meal_types,
       linked_food_ids = excluded.linked_food_ids,
       updated_at = datetime('now')`,
    [id, input.date, input.content, tagsJson, mealTypesJson, linkedFoodIdsJson],
  );
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Search both daily notes and per-meal notes (nu_food_log.notes).
 * Uses LIKE queries (sufficient for personal data volumes).
 */
export function searchNotes(db: DatabaseAdapter, query: string): NoteSearchResult[] {
  if (!query.trim()) return [];

  const escaped = query.replace(/[%_]/g, (c) => `\\${c}`);
  const pattern = `%${escaped}%`;
  const results: NoteSearchResult[] = [];

  // Search daily notes
  const dailyRows = db.query<Record<string, unknown>>(
    "SELECT date, content FROM nu_daily_notes WHERE content LIKE ? ESCAPE '\\' ORDER BY date DESC LIMIT 50",
    [pattern],
  );
  for (const row of dailyRows) {
    const content = row.content as string;
    results.push({
      date: row.date as string,
      snippet: extractSnippet(content, query),
      source: 'daily',
    });
  }

  // Search per-meal notes
  const mealRows = db.query<Record<string, unknown>>(
    `SELECT l.date, l.notes, l.meal_type FROM nu_food_log l
     WHERE l.notes IS NOT NULL AND l.notes LIKE ? ESCAPE '\\'
     ORDER BY l.date DESC LIMIT 50`,
    [pattern],
  );
  for (const row of mealRows) {
    const notes = row.notes as string;
    results.push({
      date: row.date as string,
      snippet: extractSnippet(notes, query),
      source: 'meal',
      mealType: row.meal_type as string,
    });
  }

  // Sort by date descending
  results.sort((a, b) => b.date.localeCompare(a.date));

  return results;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function parseTags(tagsJson: string | null): string[] {
  return parseJsonArray(tagsJson) ?? [];
}

export function serializeTags(tags: string[]): string {
  return JSON.stringify(tags);
}

function extractSnippet(text: string, query: string, contextChars = 60): string {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return text.slice(0, contextChars * 2);

  const start = Math.max(0, idx - contextChars);
  const end = Math.min(text.length, idx + query.length + contextChars);
  let snippet = text.slice(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';
  return snippet;
}

function parseJsonArray(value: string | null): string[] | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : null;
  } catch {
    return null;
  }
}
