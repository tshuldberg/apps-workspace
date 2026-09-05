/**
 * MyTravel <-> MyVoice read-only integration.
 *
 * Surfaces voice notes recorded inside a trip's [start_date, end_date]
 * window, and optionally filters by tag. Read-only: no schema changes, no
 * writes to voice tables.
 *
 * Degrades gracefully if the `vc_voice_notes` / `vc_transcriptions` tables
 * do not exist in the current database (voice module not installed).
 */

import type { DatabaseAdapter } from '@mylife/db';

export interface VoiceNoteLink {
  noteId: string;
  recordedAtIso: string;
  durationSeconds?: number;
  transcript?: string;
}

interface TripWindowRow {
  start_date: string | null;
  end_date: string | null;
}

interface VoiceJoinRow {
  id: string;
  created_at: string;
  duration_seconds: number | null;
  text: string | null;
  tags: string | null;
}

function rowToLink(row: VoiceJoinRow): VoiceNoteLink {
  const link: VoiceNoteLink = {
    noteId: row.id,
    recordedAtIso: row.created_at,
  };
  if (row.duration_seconds != null) {
    link.durationSeconds = row.duration_seconds;
  }
  if (row.text != null) {
    link.transcript = row.text;
  }
  return link;
}

/**
 * Fetch voice notes whose `created_at` falls inside a trip's date window.
 * Returns [] if the trip is missing, has no window, or the voice tables
 * are absent.
 */
export function getTripVoiceNotes(
  db: DatabaseAdapter,
  tripId: string,
): VoiceNoteLink[] {
  let tripRows: TripWindowRow[];
  try {
    tripRows = db.query<TripWindowRow>(
      `SELECT start_date, end_date FROM tv_trips WHERE id = ?`,
      [tripId],
    );
  } catch {
    return [];
  }
  if (tripRows.length === 0) return [];
  const { start_date, end_date } = tripRows[0]!;
  if (!start_date || !end_date) return [];

  try {
    const rows = db.query<VoiceJoinRow>(
      `SELECT n.id AS id,
              n.created_at AS created_at,
              t.duration_seconds AS duration_seconds,
              t.text AS text,
              n.tags AS tags
       FROM vc_voice_notes n
       LEFT JOIN vc_transcriptions t ON t.id = n.transcription_id
       WHERE date(n.created_at) >= date(?)
         AND date(n.created_at) <= date(?)
       ORDER BY n.created_at ASC`,
      [start_date, end_date],
    );
    return rows.map(rowToLink);
  } catch {
    return [];
  }
}

/**
 * Return voice notes whose comma-delimited `tags` field contains the given
 * tag (case-sensitive match on a whole token). Returns [] when the voice
 * tables are absent.
 */
export function filterVoiceNotesByTag(
  db: DatabaseAdapter,
  tag: string,
): VoiceNoteLink[] {
  const needle = tag.trim();
  if (!needle) return [];

  let rows: VoiceJoinRow[];
  try {
    rows = db.query<VoiceJoinRow>(
      `SELECT n.id AS id,
              n.created_at AS created_at,
              t.duration_seconds AS duration_seconds,
              t.text AS text,
              n.tags AS tags
       FROM vc_voice_notes n
       LEFT JOIN vc_transcriptions t ON t.id = n.transcription_id
       WHERE n.tags IS NOT NULL
         AND n.tags LIKE ?
       ORDER BY n.created_at ASC`,
      [`%${needle}%`],
    );
  } catch {
    return [];
  }

  // Post-filter to avoid matching substrings (e.g. "travel" inside "traveling").
  const exact: VoiceNoteLink[] = [];
  for (const row of rows) {
    const tokens = (row.tags ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    if (tokens.indexOf(needle) !== -1) {
      exact.push(rowToLink(row));
    }
  }
  return exact;
}
