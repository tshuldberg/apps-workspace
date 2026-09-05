import type { DatabaseAdapter } from '@mylife/db';
import type {
  ReaderDocumentPreference,
  ReaderDocumentPreferenceInsert,
  ReaderTheme,
} from '../models/schemas';

const DEFAULT_READER_PREFERENCES = {
  font_size: 20,
  line_height: 1.6,
  font_family: 'serif',
  theme: 'sepia' as ReaderTheme,
  margin_size: 20,
};

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function clampFloat(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizePreferences(input: ReaderDocumentPreferenceInsert): Omit<ReaderDocumentPreference, 'updated_at'> {
  return {
    document_id: input.document_id,
    font_size: clampInt(input.font_size ?? DEFAULT_READER_PREFERENCES.font_size, 12, 48),
    line_height: clampFloat(input.line_height ?? DEFAULT_READER_PREFERENCES.line_height, 1, 3),
    font_family: input.font_family ?? DEFAULT_READER_PREFERENCES.font_family,
    theme: input.theme ?? DEFAULT_READER_PREFERENCES.theme,
    margin_size: clampInt(input.margin_size ?? DEFAULT_READER_PREFERENCES.margin_size, 0, 64),
  };
}

export function getReaderPreferences(
  db: DatabaseAdapter,
  documentId: string,
): ReaderDocumentPreference | null {
  const rows = db.query<ReaderDocumentPreference>(
    `SELECT * FROM bk_reader_preferences WHERE document_id = ?`,
    [documentId],
  );
  return rows.length > 0 ? rows[0] : null;
}

export function upsertReaderPreferences(
  db: DatabaseAdapter,
  input: ReaderDocumentPreferenceInsert,
): ReaderDocumentPreference {
  const now = new Date().toISOString();
  const prefs = normalizePreferences(input);

  db.execute(
    `INSERT INTO bk_reader_preferences (
      document_id, font_size, line_height, font_family, theme, margin_size, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(document_id) DO UPDATE SET
      font_size = excluded.font_size,
      line_height = excluded.line_height,
      font_family = excluded.font_family,
      theme = excluded.theme,
      margin_size = excluded.margin_size,
      updated_at = excluded.updated_at`,
    [
      prefs.document_id,
      prefs.font_size,
      prefs.line_height,
      prefs.font_family,
      prefs.theme,
      prefs.margin_size,
      now,
    ],
  );

  return {
    ...prefs,
    updated_at: now,
  };
}
