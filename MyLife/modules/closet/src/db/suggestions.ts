import type { DatabaseAdapter } from '@mylife/db';
import {
  SuggestionFeedbackSchema,
  type SuggestionFeedback,
} from '../types';

function nowIso(): string {
  return new Date().toISOString();
}

function createId(): string {
  const cryptoApi = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (typeof cryptoApi?.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }
  return `cl_sfb_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function parseStringArray(raw: unknown): string[] {
  if (typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function rowToFeedback(row: Record<string, unknown>): SuggestionFeedback {
  return SuggestionFeedbackSchema.parse({
    id: row.id,
    suggestionHash: row.suggestion_hash,
    itemIds: parseStringArray(row.item_ids_json),
    feedback: row.feedback,
    context: typeof row.context_json === 'string' ? row.context_json : '',
    createdAt: row.created_at,
  });
}

export function recordSuggestionFeedback(
  db: DatabaseAdapter,
  suggestionHash: string,
  itemIds: string[],
  feedback: 'up' | 'down',
  context: string = '',
): SuggestionFeedback {
  const id = createId();
  const now = nowIso();

  db.execute(
    `INSERT INTO cl_suggestion_feedback (id, suggestion_hash, item_ids_json, feedback, context_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, suggestionHash, JSON.stringify(itemIds), feedback, context, now],
  );

  return SuggestionFeedbackSchema.parse({
    id,
    suggestionHash,
    itemIds,
    feedback,
    context,
    createdAt: now,
  });
}

export function listSuggestionFeedback(db: DatabaseAdapter, limit: number = 500): SuggestionFeedback[] {
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM cl_suggestion_feedback ORDER BY created_at DESC LIMIT ?`,
      [limit],
    )
    .map(rowToFeedback);
}

export function getFeedbackForHash(
  db: DatabaseAdapter,
  hash: string,
): SuggestionFeedback[] {
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM cl_suggestion_feedback WHERE suggestion_hash = ? ORDER BY created_at DESC`,
      [hash],
    )
    .map(rowToFeedback);
}
