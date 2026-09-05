/**
 * Shared Tags — operations.
 *
 * CRUD + binding operations for the canonical tag vocabulary.
 * All operations are synchronous and take a DatabaseAdapter first.
 */

import type { DatabaseAdapter } from '../../adapter';
import { generateId } from '../_generate-id';
import {
  BindTagInputSchema,
  CreateTagInputSchema,
  type BindTagInput,
  type CreateTagInput,
  type Tag,
  type TagBinding,
} from './types';

// ---------------------------------------------------------------------------
// Internal row types (match hub_tags / hub_tag_bindings columns)
// ---------------------------------------------------------------------------

interface TagRow {
  id: string;
  label: string;
  color: string | null;
  created_at: string;
}

function rowToTag(row: TagRow): Tag {
  return {
    id: row.id,
    label: row.label,
    color: row.color,
    createdAt: row.created_at,
  };
}

interface TagBindingRow {
  tag_id: string;
  module_id: string;
  entity_type: string;
  entity_id: string;
  bound_at: string;
}

function rowToBinding(row: TagBindingRow): TagBinding {
  return {
    tagId: row.tag_id,
    moduleId: row.module_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    boundAt: row.bound_at,
  };
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * Create a new tag row. Throws if the label already exists (UNIQUE constraint).
 */
export function createTag(
  db: DatabaseAdapter,
  input: CreateTagInput,
): Tag {
  const parsed = CreateTagInputSchema.parse(input);
  const id = generateId();

  db.execute(
    `INSERT INTO hub_tags (id, label, color) VALUES (?, ?, ?)`,
    [id, parsed.label, parsed.color ?? null],
  );

  const rows = db.query<TagRow>(
    `SELECT * FROM hub_tags WHERE id = ?`,
    [id],
  );

  if (rows.length === 0) throw new Error(`Failed to create tag ${id}`);
  return rowToTag(rows[0]!);
}

/**
 * Get an existing tag by label, or create a new one if it does not yet exist.
 * Idempotent: calling twice with the same label returns the same row.
 */
export function getOrCreateTag(
  db: DatabaseAdapter,
  label: string,
  color?: string,
): Tag {
  const existing = db.query<TagRow>(
    `SELECT * FROM hub_tags WHERE label = ?`,
    [label],
  );
  if (existing.length > 0) return rowToTag(existing[0]!);

  return createTag(db, { label, color });
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/** Get a tag by ID. Returns null if not found. */
export function getTagById(
  db: DatabaseAdapter,
  id: string,
): Tag | null {
  const rows = db.query<TagRow>(
    `SELECT * FROM hub_tags WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rowToTag(rows[0]!) : null;
}

/**
 * Search for tags whose label starts with the given prefix.
 * Results ordered alphabetically by label ASC.
 * Default limit 50.
 */
export function searchTags(
  db: DatabaseAdapter,
  prefix: string,
  limit: number = 50,
): Tag[] {
  // Escape LIKE wildcards in the user-supplied prefix so a literal '%' or '_'
  // does not broaden the match.
  const escaped = prefix
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');

  const rows = db.query<TagRow>(
    `SELECT * FROM hub_tags
       WHERE label LIKE ? || '%' ESCAPE '\\'
       ORDER BY label ASC
       LIMIT ?`,
    [escaped, limit],
  );
  return rows.map(rowToTag);
}

// ---------------------------------------------------------------------------
// Bind / Unbind
// ---------------------------------------------------------------------------

/**
 * Bind a tag to a (module, entityType, entityId) triple.
 * Idempotent by composite PK: re-binding the same tuple is a no-op and
 * returns the existing binding row.
 */
export function bindTag(
  db: DatabaseAdapter,
  input: BindTagInput,
): TagBinding {
  const parsed = BindTagInputSchema.parse(input);
  db.execute(
    `INSERT OR IGNORE INTO hub_tag_bindings
       (tag_id, module_id, entity_type, entity_id)
     VALUES (?, ?, ?, ?)`,
    [parsed.tagId, parsed.moduleId, parsed.entityType, parsed.entityId],
  );

  const rows = db.query<TagBindingRow>(
    `SELECT * FROM hub_tag_bindings
       WHERE tag_id = ? AND module_id = ? AND entity_type = ? AND entity_id = ?`,
    [parsed.tagId, parsed.moduleId, parsed.entityType, parsed.entityId],
  );

  if (rows.length === 0) {
    throw new Error(
      `Failed to bind tag ${parsed.tagId} to ${parsed.moduleId}/${parsed.entityType}/${parsed.entityId}`,
    );
  }
  return rowToBinding(rows[0]!);
}

/** Remove a single (tag, module, entityType, entityId) binding. */
export function unbindTag(
  db: DatabaseAdapter,
  params: {
    tagId: string;
    moduleId: string;
    entityType: string;
    entityId: string;
  },
): void {
  db.execute(
    `DELETE FROM hub_tag_bindings
       WHERE tag_id = ? AND module_id = ? AND entity_type = ? AND entity_id = ?`,
    [params.tagId, params.moduleId, params.entityType, params.entityId],
  );
}

// ---------------------------------------------------------------------------
// Reverse lookups
// ---------------------------------------------------------------------------

/**
 * List every tag bound to a given entity, ordered alphabetically by label.
 */
export function getTagsFor(
  db: DatabaseAdapter,
  query: { moduleId: string; entityType: string; entityId: string },
): Tag[] {
  const rows = db.query<TagRow>(
    `SELECT t.*
       FROM hub_tags t
       JOIN hub_tag_bindings b ON b.tag_id = t.id
       WHERE b.module_id = ? AND b.entity_type = ? AND b.entity_id = ?
       ORDER BY t.label ASC`,
    [query.moduleId, query.entityType, query.entityId],
  );
  return rows.map(rowToTag);
}

/** List every binding for the given tag across all modules / entities. */
export function getEntitiesForTag(
  db: DatabaseAdapter,
  tagId: string,
): TagBinding[] {
  const rows = db.query<TagBindingRow>(
    `SELECT * FROM hub_tag_bindings WHERE tag_id = ?`,
    [tagId],
  );
  return rows.map(rowToBinding);
}
