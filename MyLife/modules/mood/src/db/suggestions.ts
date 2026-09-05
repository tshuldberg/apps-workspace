import type { DatabaseAdapter } from '@mylife/db';
import type { SuggestionHistory, CreateSuggestionHistoryInput, SuggestionAction } from '../types';

function nowIso(): string {
  return new Date().toISOString();
}

function rowToSuggestionHistory(row: Record<string, unknown>): SuggestionHistory {
  return {
    id: row.id as string,
    suggestionKey: row.suggestion_key as string,
    category: row.category as string,
    source: row.source as SuggestionHistory['source'],
    shownAt: row.shown_at as string,
    action: (row.action as SuggestionHistory['action']) ?? null,
    actedAt: (row.acted_at as string) ?? null,
    createdAt: row.created_at as string,
  };
}

export function createSuggestionHistory(
  db: DatabaseAdapter,
  id: string,
  input: CreateSuggestionHistoryInput,
): SuggestionHistory {
  const now = nowIso();
  db.execute(
    `INSERT INTO mo_suggestion_history (id, suggestion_key, category, source, shown_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, input.suggestionKey, input.category, input.source, now, now],
  );
  return {
    id,
    suggestionKey: input.suggestionKey,
    category: input.category,
    source: input.source,
    shownAt: now,
    action: null,
    actedAt: null,
    createdAt: now,
  };
}

export function updateSuggestionAction(
  db: DatabaseAdapter,
  id: string,
  action: SuggestionAction,
): void {
  const now = nowIso();
  db.execute(
    `UPDATE mo_suggestion_history SET action = ?, acted_at = ? WHERE id = ?`,
    [action, now, id],
  );
}

export function getSuggestionHistory(db: DatabaseAdapter, limit = 50): SuggestionHistory[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM mo_suggestion_history ORDER BY shown_at DESC LIMIT ?`,
    [limit],
  );
  return rows.map(rowToSuggestionHistory);
}

export function getRecentSuggestionKeys(db: DatabaseAdapter, sinceIso: string, limit = 500): string[] {
  const rows = db.query<{ suggestion_key: string }>(
    `SELECT DISTINCT suggestion_key FROM mo_suggestion_history WHERE shown_at >= ? LIMIT ?`,
    [sinceIso, limit],
  );
  return rows.map((r) => r.suggestion_key);
}

export function getSuggestionsByKey(db: DatabaseAdapter, key: string, limit = 200): SuggestionHistory[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM mo_suggestion_history WHERE suggestion_key = ? ORDER BY shown_at DESC LIMIT ?`,
    [key, limit],
  );
  return rows.map(rowToSuggestionHistory);
}
