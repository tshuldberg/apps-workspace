/**
 * Cross-module tag readers for @mylife/notes.
 *
 * Phase 1c Wave A shipped a shadow-write path from nt_note_tags to
 * hub_tags + hub_tag_bindings. These helpers expose the read side so
 * other modules (and insights screens) can ask hub-wide questions like
 * "which notes share the 'reading' tag" or "which entities across all
 * modules share this tag label".
 *
 * Reads only. No schema changes. No mutation of shadow-write paths.
 */

import type { DatabaseAdapter } from '@mylife/db';
import { getEntitiesForTag } from '@mylife/db';
import type { Note } from '../types';

const NOTES_MODULE_ID = 'notes';
const NOTE_ENTITY_TYPE = 'note';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface NoteRow {
  id: string;
  title: string;
  body: string;
  folder_id: string | null;
  is_pinned: number;
  is_favorite: number;
  word_count: number;
  char_count: number;
  is_daily_note: number;
  daily_date: string | null;
  source_url: string | null;
  clipped_at: string | null;
  clip_type: string | null;
  created_at: string;
  updated_at: string;
}

function rowToNote(row: NoteRow): Note {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    folderId: row.folder_id ?? null,
    isPinned: row.is_pinned === 1,
    isFavorite: row.is_favorite === 1,
    wordCount: row.word_count,
    charCount: row.char_count,
    isDailyNote: row.is_daily_note === 1,
    dailyDate: row.daily_date ?? null,
    sourceUrl: row.source_url ?? null,
    clippedAt: row.clipped_at ?? null,
    clipType: row.clip_type ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Look up the canonical hub_tags row id for a given label. Returns null when
 * the label has not been registered in the hub vocabulary.
 */
function getHubTagIdByLabel(
  db: DatabaseAdapter,
  label: string,
): string | null {
  const rows = db.query<{ id: string }>(
    `SELECT id FROM hub_tags WHERE label = ?`,
    [label],
  );
  return rows[0]?.id ?? null;
}

// ---------------------------------------------------------------------------
// Public readers
// ---------------------------------------------------------------------------

/**
 * Find every note bound to the canonical hub tag for the given label.
 *
 * Resolves the label to its hub_tags row, then walks hub_tag_bindings to
 * find every note entity (moduleId='notes', entityType='note') and joins
 * back to nt_notes. Returns an empty array when the label has no hub tag.
 */
export function getNotesWithTagLabel(
  db: DatabaseAdapter,
  label: string,
): Note[] {
  const hubTagId = getHubTagIdByLabel(db, label);
  if (hubTagId === null) return [];

  const rows = db.query<NoteRow>(
    `SELECT n.*
       FROM nt_notes n
       JOIN hub_tag_bindings b ON b.entity_id = n.id
      WHERE b.tag_id = ?
        AND b.module_id = ?
        AND b.entity_type = ?
      ORDER BY n.updated_at DESC`,
    [hubTagId, NOTES_MODULE_ID, NOTE_ENTITY_TYPE],
  );
  return rows.map(rowToNote);
}

export interface CrossModuleTagEntityCount {
  moduleId: string;
  entityType: string;
  entityId: string;
  count: number;
}

/**
 * For a given tag label, return every (moduleId, entityType, entityId)
 * triple bound to that tag's canonical hub row, with a per-binding count.
 *
 * The composite PK on hub_tag_bindings means each triple appears at most
 * once, so `count` is always 1 here. The shape is preserved so future
 * call sites can aggregate by (moduleId, entityType) without changing the
 * helper signature.
 */
export function getCrossModuleEntitiesForTagLabel(
  db: DatabaseAdapter,
  label: string,
): CrossModuleTagEntityCount[] {
  const hubTagId = getHubTagIdByLabel(db, label);
  if (hubTagId === null) return [];

  const bindings = getEntitiesForTag(db, hubTagId);
  return bindings.map((binding) => ({
    moduleId: binding.moduleId,
    entityType: binding.entityType,
    entityId: binding.entityId,
    count: 1,
  }));
}
