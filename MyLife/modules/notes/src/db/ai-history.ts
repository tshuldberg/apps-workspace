import type { DatabaseAdapter } from '@mylife/db';
import type { AiHistoryEntry } from '../types';

function rowToAiHistory(row: Record<string, unknown>): AiHistoryEntry {
  return {
    id: row.id as string,
    noteId: row.note_id as string,
    action: row.action as AiHistoryEntry['action'],
    inputText: row.input_text as string,
    outputText: row.output_text as string,
    provider: row.provider as AiHistoryEntry['provider'],
    accepted: (row.accepted as number) === 1,
    createdAt: row.created_at as string,
  };
}

export function createAiHistoryEntry(
  db: DatabaseAdapter,
  id: string,
  input: { noteId: string; action: string; inputText: string; outputText: string; provider?: string },
): AiHistoryEntry {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO nt_ai_history (id, note_id, action, input_text, output_text, provider, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.noteId, input.action, input.inputText, input.outputText, input.provider ?? 'local', now],
  );
  return { id, noteId: input.noteId, action: input.action as AiHistoryEntry['action'], inputText: input.inputText, outputText: input.outputText, provider: (input.provider ?? 'local') as AiHistoryEntry['provider'], accepted: false, createdAt: now };
}

export function acceptAiResult(db: DatabaseAdapter, id: string): void {
  db.execute(`UPDATE nt_ai_history SET accepted = 1 WHERE id = ?`, [id]);
}

export function getAiHistoryForNote(db: DatabaseAdapter, noteId: string, limit = 50): AiHistoryEntry[] {
  return db.query<Record<string, unknown>>(
    `SELECT * FROM nt_ai_history WHERE note_id = ? ORDER BY created_at DESC LIMIT ?`,
    [noteId, limit],
  ).map(rowToAiHistory);
}

export function deleteAiHistory(db: DatabaseAdapter, noteId: string): void {
  db.execute(`DELETE FROM nt_ai_history WHERE note_id = ?`, [noteId]);
}
