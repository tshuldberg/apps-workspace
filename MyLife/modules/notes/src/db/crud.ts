import type { DatabaseAdapter } from '@mylife/db';
import { bindTag, getOrCreateTag, unbindTag } from '@mylife/db';
import type {
  Note,
  NoteFolder,
  NoteTag,
  NoteLink,
  NoteTemplate,
  NoteSetting,
  CreateNoteInput,
  UpdateNoteInput,
  CreateFolderInput,
  UpdateFolderInput,
  CreateTagInput,
  CreateTemplateInput,
  NoteFilter,
  NoteSearchResult,
  NoteGraph,
  NotesStats,
} from '../types';
import { CreateNoteInputSchema, NoteFilterSchema } from '../types';
import { countWords, extractBacklinks } from '../engine/markdown';

// ── Helpers ────────────────────────────────────────────────────────────

function nowIso(): string {
  return new Date().toISOString();
}

function rowToNote(row: Record<string, unknown>): Note {
  return {
    id: row.id as string,
    title: row.title as string,
    body: row.body as string,
    folderId: (row.folder_id as string) ?? null,
    isPinned: (row.is_pinned as number) === 1,
    isFavorite: (row.is_favorite as number) === 1,
    wordCount: row.word_count as number,
    charCount: row.char_count as number,
    isDailyNote: (row.is_daily_note as number) === 1,
    dailyDate: (row.daily_date as string) ?? null,
    sourceUrl: (row.source_url as string) ?? null,
    clippedAt: (row.clipped_at as string) ?? null,
    clipType: (row.clip_type as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToFolder(row: Record<string, unknown>): NoteFolder {
  return {
    id: row.id as string,
    name: row.name as string,
    parentId: (row.parent_id as string) ?? null,
    sortOrder: row.sort_order as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/**
 * Look up the canonical hub tag id pointer stored on a module-scoped tag row.
 * Returns null when the tag row is missing or has not been shadow-written yet
 * (e.g. pre-V4 data that has not been backfilled).
 */
function getHubTagIdForModuleTag(
  db: DatabaseAdapter,
  tagId: string,
): string | null {
  const rows = db.query<{ hub_tag_id: string | null }>(
    `SELECT hub_tag_id FROM nt_tags WHERE id = ?`,
    [tagId],
  );
  return rows[0]?.hub_tag_id ?? null;
}

function rowToTag(row: Record<string, unknown>): NoteTag {
  return {
    id: row.id as string,
    name: row.name as string,
    color: (row.color as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function rowToLink(row: Record<string, unknown>): NoteLink {
  return {
    id: row.id as string,
    sourceNoteId: row.source_note_id as string,
    targetNoteId: row.target_note_id as string,
    createdAt: row.created_at as string,
  };
}

function rowToTemplate(row: Record<string, unknown>): NoteTemplate {
  return {
    id: row.id as string,
    name: row.name as string,
    body: row.body as string,
    description: (row.description as string) ?? '',
    category: (row.category as string) ?? 'custom',
    icon: (row.icon as string) ?? '📄',
    useCount: (row.use_count as number) ?? 0,
    isBuiltIn: (row.is_built_in as number) === 1,
    createdAt: row.created_at as string,
  };
}

// ── Notes CRUD ─────────────────────────────────────────────────────────

export function createNote(
  db: DatabaseAdapter,
  id: string,
  rawInput: CreateNoteInput,
): Note {
  const input = CreateNoteInputSchema.parse(rawInput);
  const now = nowIso();
  const wc = countWords(input.body ?? '');
  const cc = (input.body ?? '').length;

  db.transaction(() => {
    db.execute(
      `INSERT INTO nt_notes (id, title, body, folder_id, is_pinned, is_favorite, word_count, char_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, input.title, input.body, input.folderId, input.isPinned ? 1 : 0, input.isFavorite ? 1 : 0, wc, cc, now, now],
    );

    for (const tagId of input.tagIds ?? []) {
      db.execute(
        `INSERT OR IGNORE INTO nt_note_tags (note_id, tag_id) VALUES (?, ?)`,
        [id, tagId],
      );
      // Shadow-write: mirror the note→tag link into hub_tag_bindings.
      const hubTagId = getHubTagIdForModuleTag(db, tagId);
      if (hubTagId) {
        bindTag(db, {
          tagId: hubTagId,
          moduleId: 'notes',
          entityType: 'note',
          entityId: id,
        });
      }
    }

    // Parse backlinks and create link records
    const backlinks = extractBacklinks(input.body ?? '');
    for (const targetTitle of backlinks) {
      const targets = db.query<{ id: string }>(
        `SELECT id FROM nt_notes WHERE title = ?`,
        [targetTitle],
      );
      if (targets.length > 0) {
        db.execute(
          `INSERT INTO nt_note_links (id, source_note_id, target_note_id, created_at)
           VALUES (?, ?, ?, ?)`,
          [crypto.randomUUID(), id, targets[0].id, now],
        );
      }
    }
  });

  return {
    id,
    title: input.title ?? '',
    body: input.body ?? '',
    folderId: input.folderId ?? null,
    isPinned: input.isPinned ?? false,
    isFavorite: input.isFavorite ?? false,
    wordCount: wc,
    charCount: cc,
    isDailyNote: false,
    dailyDate: null,
    sourceUrl: null,
    clippedAt: null,
    clipType: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function getNoteById(db: DatabaseAdapter, id: string): Note | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM nt_notes WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rowToNote(rows[0]) : null;
}

export function getNotes(db: DatabaseAdapter, rawFilter?: NoteFilter): Note[] {
  const filter = NoteFilterSchema.parse(rawFilter ?? {});
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter.folderId !== undefined) {
    if (filter.folderId === null) {
      conditions.push('folder_id IS NULL');
    } else {
      conditions.push('folder_id = ?');
      params.push(filter.folderId);
    }
  }
  if (filter.isPinned !== undefined) {
    conditions.push('is_pinned = ?');
    params.push(filter.isPinned ? 1 : 0);
  }
  if (filter.isFavorite !== undefined) {
    conditions.push('is_favorite = ?');
    params.push(filter.isFavorite ? 1 : 0);
  }
  if (filter.tagId) {
    conditions.push('id IN (SELECT note_id FROM nt_note_tags WHERE tag_id = ?)');
    params.push(filter.tagId);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sortCol = filter.sortBy === 'title' ? 'title' : filter.sortBy === 'created' ? 'created_at' : 'updated_at';
  const sortDir = filter.sortDir === 'asc' ? 'ASC' : 'DESC';

  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM nt_notes ${where} ORDER BY is_pinned DESC, ${sortCol} ${sortDir} LIMIT ? OFFSET ?`,
    [...params, filter.limit, filter.offset],
  );
  return rows.map(rowToNote);
}

export function updateNote(
  db: DatabaseAdapter,
  id: string,
  input: UpdateNoteInput,
): Note | null {
  const existing = getNoteById(db, id);
  if (!existing) return null;

  const now = nowIso();

  db.transaction(() => {
    const updates: string[] = ['updated_at = ?'];
    const params: unknown[] = [now];

    if (input.title !== undefined) { updates.push('title = ?'); params.push(input.title); }
    if (input.body !== undefined) {
      const wc = countWords(input.body);
      updates.push('body = ?', 'word_count = ?', 'char_count = ?');
      params.push(input.body, wc, input.body.length);
    }
    if (input.folderId !== undefined) { updates.push('folder_id = ?'); params.push(input.folderId); }
    if (input.isPinned !== undefined) { updates.push('is_pinned = ?'); params.push(input.isPinned ? 1 : 0); }
    if (input.isFavorite !== undefined) { updates.push('is_favorite = ?'); params.push(input.isFavorite ? 1 : 0); }

    params.push(id);
    db.execute(`UPDATE nt_notes SET ${updates.join(', ')} WHERE id = ?`, params);

    // Update tags if provided
    if (input.tagIds !== undefined) {
      // Shadow-write: capture the existing hub tag ids we must unbind after
      // the module-scoped rows are cleared.
      const existingHubTagIds = db.query<{ hub_tag_id: string | null }>(
        `SELECT t.hub_tag_id
           FROM nt_note_tags nt
           JOIN nt_tags t ON t.id = nt.tag_id
           WHERE nt.note_id = ?`,
        [id],
      )
        .map((r) => r.hub_tag_id)
        .filter((hubId): hubId is string => hubId !== null);

      db.execute(`DELETE FROM nt_note_tags WHERE note_id = ?`, [id]);

      for (const hubTagId of existingHubTagIds) {
        unbindTag(db, {
          tagId: hubTagId,
          moduleId: 'notes',
          entityType: 'note',
          entityId: id,
        });
      }

      for (const tagId of input.tagIds) {
        db.execute(
          `INSERT OR IGNORE INTO nt_note_tags (note_id, tag_id) VALUES (?, ?)`,
          [id, tagId],
        );
        const hubTagId = getHubTagIdForModuleTag(db, tagId);
        if (hubTagId) {
          bindTag(db, {
            tagId: hubTagId,
            moduleId: 'notes',
            entityType: 'note',
            entityId: id,
          });
        }
      }
    }

    // Re-sync backlinks when body changes
    if (input.body !== undefined) {
      db.execute(`DELETE FROM nt_note_links WHERE source_note_id = ?`, [id]);
      const backlinks = extractBacklinks(input.body);
      for (const targetTitle of backlinks) {
        const targets = db.query<{ id: string }>(
          `SELECT id FROM nt_notes WHERE title = ?`,
          [targetTitle],
        );
        if (targets.length > 0) {
          db.execute(
            `INSERT INTO nt_note_links (id, source_note_id, target_note_id, created_at)
             VALUES (?, ?, ?, ?)`,
            [crypto.randomUUID(), id, targets[0].id, now],
          );
        }
      }
    }
  });

  return getNoteById(db, id);
}

export function deleteNote(db: DatabaseAdapter, id: string): boolean {
  db.transaction(() => {
    // Collect hub tag ids bound to this note so we can unbind them after the
    // local delete cascades through nt_note_tags. Only non-null ids matter.
    const hubTagIds = db
      .query<{ hub_tag_id: string | null }>(
        `SELECT t.hub_tag_id FROM nt_note_tags nt
           JOIN nt_tags t ON t.id = nt.tag_id
          WHERE nt.note_id = ?`,
        [id],
      )
      .map((row) => row.hub_tag_id)
      .filter((v): v is string => v !== null);

    db.execute(`DELETE FROM nt_notes WHERE id = ?`, [id]);

    for (const hubTagId of hubTagIds) {
      unbindTag(db, {
        tagId: hubTagId,
        moduleId: 'notes',
        entityType: 'note',
        entityId: id,
      });
    }
  });
  return true;
}

export function getNoteCount(db: DatabaseAdapter): number {
  const rows = db.query<{ count: number }>(`SELECT COUNT(*) as count FROM nt_notes`);
  return rows[0].count;
}

// ── Search ─────────────────────────────────────────────────────────────

export function searchNotes(
  db: DatabaseAdapter,
  query: string,
  limit = 20,
): NoteSearchResult[] {
  if (!query.trim()) return [];
  // Sanitize FTS5 query: escape double quotes and wrap each token in quotes
  // to prevent FTS5 syntax injection (OR, AND, NOT, NEAR, *, {, etc.)
  const sanitized = query
    .trim()
    .replace(/"/g, '""')
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .map((t) => `"${t}"`)
    .join(' ');
  if (!sanitized) return [];
  const rows = db.query<{ id: string; title: string; snippet: string; rank: number }>(
    `SELECT n.id, n.title, snippet(nt_notes_fts, 1, '<b>', '</b>', '...', 32) as snippet, rank
     FROM nt_notes_fts fts
     JOIN nt_notes n ON n.rowid = fts.rowid
     WHERE nt_notes_fts MATCH ?
     ORDER BY rank
     LIMIT ?`,
    [sanitized, limit],
  );
  return rows;
}

// ── Folders CRUD ───────────────────────────────────────────────────────

export function createFolder(
  db: DatabaseAdapter,
  id: string,
  input: CreateFolderInput,
): NoteFolder {
  const now = nowIso();
  db.execute(
    `INSERT INTO nt_folders (id, name, parent_id, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, input.name, input.parentId ?? null, input.sortOrder ?? 0, now, now],
  );
  return {
    id,
    name: input.name,
    parentId: input.parentId ?? null,
    sortOrder: input.sortOrder ?? 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function getFolders(db: DatabaseAdapter, parentId?: string | null, limit = 500): NoteFolder[] {
  if (parentId === undefined) {
    return db.query<Record<string, unknown>>(
      `SELECT * FROM nt_folders ORDER BY sort_order ASC, name ASC LIMIT ?`,
      [limit],
    ).map(rowToFolder);
  }
  if (parentId === null) {
    return db.query<Record<string, unknown>>(
      `SELECT * FROM nt_folders WHERE parent_id IS NULL ORDER BY sort_order ASC, name ASC LIMIT ?`,
      [limit],
    ).map(rowToFolder);
  }
  return db.query<Record<string, unknown>>(
    `SELECT * FROM nt_folders WHERE parent_id = ? ORDER BY sort_order ASC, name ASC LIMIT ?`,
    [parentId, limit],
  ).map(rowToFolder);
}

export function getFolderById(db: DatabaseAdapter, id: string): NoteFolder | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM nt_folders WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rowToFolder(rows[0]) : null;
}

export function updateFolder(
  db: DatabaseAdapter,
  id: string,
  input: UpdateFolderInput,
): NoteFolder | null {
  const existing = getFolderById(db, id);
  if (!existing) return null;

  const now = nowIso();
  const updates: string[] = ['updated_at = ?'];
  const params: unknown[] = [now];

  if (input.name !== undefined) { updates.push('name = ?'); params.push(input.name); }
  if (input.parentId !== undefined) { updates.push('parent_id = ?'); params.push(input.parentId); }
  if (input.sortOrder !== undefined) { updates.push('sort_order = ?'); params.push(input.sortOrder); }

  params.push(id);
  db.execute(`UPDATE nt_folders SET ${updates.join(', ')} WHERE id = ?`, params);
  return getFolderById(db, id);
}

export function deleteFolder(db: DatabaseAdapter, id: string): boolean {
  // Notes in this folder get their folder_id set to NULL via ON DELETE SET NULL
  db.execute(`DELETE FROM nt_folders WHERE id = ?`, [id]);
  return true;
}

// ── Tags CRUD ──────────────────────────────────────────────────────────

export function createTag(
  db: DatabaseAdapter,
  id: string,
  input: CreateTagInput,
): NoteTag {
  const now = nowIso();
  db.transaction(() => {
    db.execute(
      `INSERT INTO nt_tags (id, name, color, created_at) VALUES (?, ?, ?, ?)`,
      [id, input.name, input.color ?? null, now],
    );

    // Shadow-write: resolve (or create) the canonical hub tag row and
    // pointer-link it on the module-scoped tag row. Any failure here throws
    // and rolls back the nt_tags insert so the two tables stay in sync.
    const hubTag = getOrCreateTag(db, input.name, input.color ?? undefined);
    db.execute(
      `UPDATE nt_tags SET hub_tag_id = ? WHERE id = ?`,
      [hubTag.id, id],
    );
  });
  return { id, name: input.name, color: input.color ?? null, createdAt: now };
}

export function getTags(db: DatabaseAdapter, limit = 500): NoteTag[] {
  return db.query<Record<string, unknown>>(
    `SELECT * FROM nt_tags ORDER BY name ASC LIMIT ?`,
    [limit],
  ).map(rowToTag);
}

export function getTagById(db: DatabaseAdapter, id: string): NoteTag | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM nt_tags WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rowToTag(rows[0]) : null;
}

export function deleteTag(db: DatabaseAdapter, id: string): boolean {
  db.transaction(() => {
    // Resolve the hub tag id + all notes currently bound via this tag so we
    // can clean up hub_tag_bindings after the CASCADE on nt_note_tags fires.
    const tagRows = db.query<{ hub_tag_id: string | null }>(
      `SELECT hub_tag_id FROM nt_tags WHERE id = ?`,
      [id],
    );
    const hubTagId = tagRows[0]?.hub_tag_id ?? null;

    let noteIds: string[] = [];
    if (hubTagId) {
      const rows = db.query<{ note_id: string }>(
        `SELECT note_id FROM nt_note_tags WHERE tag_id = ?`,
        [id],
      );
      noteIds = rows.map((r) => r.note_id);
    }

    db.execute(`DELETE FROM nt_tags WHERE id = ?`, [id]);

    // Unbind only this module's note bindings for the hub tag. The canonical
    // hub_tags row itself stays intact; other modules may still reference it.
    if (hubTagId) {
      for (const noteId of noteIds) {
        unbindTag(db, {
          tagId: hubTagId,
          moduleId: 'notes',
          entityType: 'note',
          entityId: noteId,
        });
      }
    }
  });
  return true;
}

export function getTagsForNote(db: DatabaseAdapter, noteId: string): NoteTag[] {
  return db.query<Record<string, unknown>>(
    `SELECT t.* FROM nt_tags t JOIN nt_note_tags nt ON nt.tag_id = t.id WHERE nt.note_id = ?`,
    [noteId],
  ).map(rowToTag);
}

// ── Links ──────────────────────────────────────────────────────────────

export function getBacklinksForNote(db: DatabaseAdapter, noteId: string, limit = 200): NoteLink[] {
  return db.query<Record<string, unknown>>(
    `SELECT * FROM nt_note_links WHERE target_note_id = ? LIMIT ?`,
    [noteId, limit],
  ).map(rowToLink);
}

export function getOutgoingLinksForNote(db: DatabaseAdapter, noteId: string, limit = 200): NoteLink[] {
  return db.query<Record<string, unknown>>(
    `SELECT * FROM nt_note_links WHERE source_note_id = ? LIMIT ?`,
    [noteId, limit],
  ).map(rowToLink);
}

export function getNoteGraph(db: DatabaseAdapter): NoteGraph {
  const nodes = db.query<{ id: string; title: string; link_count: number }>(
    `SELECT n.id, n.title,
       (SELECT COUNT(*) FROM nt_note_links WHERE source_note_id = n.id OR target_note_id = n.id) as link_count
     FROM nt_notes n
     ORDER BY link_count DESC`,
  ).map((r) => ({ id: r.id, title: r.title, linkCount: r.link_count }));

  const edges = db.query<{ source: string; target: string }>(
    `SELECT source_note_id as source, target_note_id as target FROM nt_note_links`,
  );

  return { nodes, edges };
}

// ── Templates CRUD ─────────────────────────────────────────────────────

export function createTemplate(
  db: DatabaseAdapter,
  id: string,
  input: CreateTemplateInput,
): NoteTemplate {
  const now = nowIso();
  db.execute(
    `INSERT INTO nt_templates (id, name, body, created_at) VALUES (?, ?, ?, ?)`,
    [id, input.name, input.body ?? '', now],
  );
  return { id, name: input.name, body: input.body ?? '', description: '', category: 'custom', icon: '📄', useCount: 0, isBuiltIn: false, createdAt: now };
}

export function getTemplates(db: DatabaseAdapter, limit = 200): NoteTemplate[] {
  return db.query<Record<string, unknown>>(
    `SELECT * FROM nt_templates ORDER BY name ASC LIMIT ?`,
    [limit],
  ).map(rowToTemplate);
}

export function deleteTemplate(db: DatabaseAdapter, id: string): boolean {
  db.execute(`DELETE FROM nt_templates WHERE id = ? AND is_built_in = 0`, [id]);
  return true;
}

export function updateTemplate(
  db: DatabaseAdapter,
  id: string,
  input: { name?: string; body?: string; description?: string; icon?: string },
): NoteTemplate | null {
  const existing = db.query<Record<string, unknown>>(`SELECT * FROM nt_templates WHERE id = ?`, [id]);
  if (existing.length === 0) return null;

  const updates: string[] = [];
  const params: unknown[] = [];
  if (input.name !== undefined) { updates.push('name = ?'); params.push(input.name); }
  if (input.body !== undefined) { updates.push('body = ?'); params.push(input.body); }
  if (input.description !== undefined) { updates.push('description = ?'); params.push(input.description); }
  if (input.icon !== undefined) { updates.push('icon = ?'); params.push(input.icon); }

  if (updates.length === 0) return rowToTemplate(existing[0]);
  params.push(id);
  db.execute(`UPDATE nt_templates SET ${updates.join(', ')} WHERE id = ?`, params);
  const rows = db.query<Record<string, unknown>>(`SELECT * FROM nt_templates WHERE id = ?`, [id]);
  return rows.length > 0 ? rowToTemplate(rows[0]) : null;
}

export function incrementTemplateUseCount(db: DatabaseAdapter, id: string): void {
  db.execute(`UPDATE nt_templates SET use_count = use_count + 1 WHERE id = ?`, [id]);
}

export function seedBuiltInTemplates(db: DatabaseAdapter, templates: Array<{ id: string; name: string; description: string; icon: string; body: string }>): void {
  for (const t of templates) {
    db.execute(
      `INSERT OR IGNORE INTO nt_templates (id, name, body, description, category, icon, use_count, is_built_in, created_at) VALUES (?, ?, ?, ?, 'built_in', ?, 0, 1, datetime('now'))`,
      [t.id, t.name, t.body, t.description, t.icon],
    );
  }
}

// ── Settings ───────────────────────────────────────────────────────────

export function getSetting(db: DatabaseAdapter, key: string): string | null {
  const rows = db.query<NoteSetting>(
    `SELECT * FROM nt_settings WHERE key = ?`,
    [key],
  );
  return rows.length > 0 ? rows[0].value : null;
}

export function setSetting(db: DatabaseAdapter, key: string, value: string): void {
  db.execute(
    `INSERT INTO nt_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}

// ── Stats ──────────────────────────────────────────────────────────────

export function getNotesStats(db: DatabaseAdapter): NotesStats {
  const notes = db.query<{ count: number; total_words: number; pinned: number; fav: number }>(
    `SELECT COUNT(*) as count,
       COALESCE(SUM(word_count), 0) as total_words,
       SUM(CASE WHEN is_pinned = 1 THEN 1 ELSE 0 END) as pinned,
       SUM(CASE WHEN is_favorite = 1 THEN 1 ELSE 0 END) as fav
     FROM nt_notes`,
  );
  const folders = db.query<{ count: number }>(`SELECT COUNT(*) as count FROM nt_folders`);
  const tags = db.query<{ count: number }>(`SELECT COUNT(*) as count FROM nt_tags`);

  return {
    totalNotes: notes[0].count,
    totalFolders: folders[0].count,
    totalTags: tags[0].count,
    totalWords: notes[0].total_words,
    pinnedCount: notes[0].pinned,
    favoriteCount: notes[0].fav,
  };
}
