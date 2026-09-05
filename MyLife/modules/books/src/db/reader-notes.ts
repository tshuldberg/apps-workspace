import type { DatabaseAdapter } from '@mylife/db';
import type { ReaderDocumentNote, ReaderDocumentNoteInsert } from '../models/schemas';

function normalizeRange(start: number, end: number): { start: number; end: number } {
  const safeStart = Math.max(0, start);
  const safeEnd = Math.max(safeStart, end);
  return { start: safeStart, end: safeEnd };
}

export function createReaderNote(
  db: DatabaseAdapter,
  id: string,
  input: ReaderDocumentNoteInsert,
): ReaderDocumentNote {
  const now = new Date().toISOString();
  const range = normalizeRange(input.selection_start, input.selection_end);
  const note: ReaderDocumentNote = {
    id,
    document_id: input.document_id,
    note_type: input.note_type ?? 'note',
    selection_start: range.start,
    selection_end: range.end,
    selected_text: input.selected_text ?? null,
    note_text: input.note_text ?? null,
    color: input.color ?? null,
    created_at: now,
    updated_at: now,
  };

  db.execute(
    `INSERT INTO bk_reader_notes (
      id, document_id, note_type, selection_start, selection_end,
      selected_text, note_text, color, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      note.id,
      note.document_id,
      note.note_type,
      note.selection_start,
      note.selection_end,
      note.selected_text,
      note.note_text,
      note.color,
      note.created_at,
      note.updated_at,
    ],
  );

  return note;
}

export function getReaderNote(db: DatabaseAdapter, id: string): ReaderDocumentNote | null {
  const rows = db.query<ReaderDocumentNote>(
    `SELECT * FROM bk_reader_notes WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rows[0] : null;
}

export function getReaderNotes(
  db: DatabaseAdapter,
  documentId: string,
  filters?: { note_type?: ReaderDocumentNote['note_type']; limit?: number },
): ReaderDocumentNote[] {
  let sql = `SELECT * FROM bk_reader_notes WHERE document_id = ?`;
  const params: unknown[] = [documentId];

  if (filters?.note_type) {
    sql += ' AND note_type = ?';
    params.push(filters.note_type);
  }

  sql += ' ORDER BY selection_start ASC, created_at ASC';

  if (filters?.limit) {
    sql += ' LIMIT ?';
    params.push(filters.limit);
  }

  return db.query<ReaderDocumentNote>(sql, params);
}

export function updateReaderNote(
  db: DatabaseAdapter,
  id: string,
  updates: Partial<Pick<ReaderDocumentNote, 'note_type' | 'selection_start' | 'selection_end' | 'selected_text' | 'note_text' | 'color'>>,
): void {
  const fields: string[] = [];
  const values: unknown[] = [];
  let start = updates.selection_start;
  let end = updates.selection_end;

  if (typeof start === 'number' || typeof end === 'number') {
    const range = normalizeRange(start ?? 0, end ?? (start ?? 0));
    start = range.start;
    end = range.end;
  }

  if (updates.note_type !== undefined) {
    fields.push('note_type = ?');
    values.push(updates.note_type);
  }
  if (start !== undefined) {
    fields.push('selection_start = ?');
    values.push(start);
  }
  if (end !== undefined) {
    fields.push('selection_end = ?');
    values.push(end);
  }
  if (updates.selected_text !== undefined) {
    fields.push('selected_text = ?');
    values.push(updates.selected_text);
  }
  if (updates.note_text !== undefined) {
    fields.push('note_text = ?');
    values.push(updates.note_text);
  }
  if (updates.color !== undefined) {
    fields.push('color = ?');
    values.push(updates.color);
  }

  if (fields.length === 0) return;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.execute(
    `UPDATE bk_reader_notes SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}

export function deleteReaderNote(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM bk_reader_notes WHERE id = ?`, [id]);
}
