/**
 * Shared Attachments — operations.
 *
 * Sync CRUD over hub_attachments + hub_attachment_links. IDs are generated
 * with a local UUID helper (matching backup/operations.ts, which avoids a
 * direct `crypto.randomUUID` dep for RN compatibility). Timestamps come
 * from SQL `datetime('now')` defaults. Zod schemas validate inputs at
 * the boundary.
 */

import type { DatabaseAdapter } from '../../adapter';
import {
  CreateAttachmentInputSchema,
  LinkAttachmentInputSchema,
  type Attachment,
  type AttachmentLink,
  type CreateAttachmentInput,
  type LinkAttachmentInput,
} from './types';

// ---------------------------------------------------------------------------
// Row types (snake_case, as returned by the DB)
// ---------------------------------------------------------------------------

interface AttachmentRow {
  id: string;
  uri: string;
  mime: string;
  sha256: string | null;
  bytes: number | null;
  thumb_uri: string | null;
  caption: string | null;
  taken_at: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
  updated_at: string;
}

interface AttachmentLinkRow {
  attachment_id: string;
  module_id: string;
  entity_type: string;
  entity_id: string;
  role: string | null;
  linked_at: string;
}

function rowToAttachment(row: AttachmentRow): Attachment {
  return {
    id: row.id,
    uri: row.uri,
    mime: row.mime,
    sha256: row.sha256,
    bytes: row.bytes,
    thumbUri: row.thumb_uri,
    caption: row.caption,
    takenAt: row.taken_at,
    lat: row.lat,
    lng: row.lng,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToAttachmentLink(row: AttachmentLinkRow): AttachmentLink {
  return {
    attachmentId: row.attachment_id,
    moduleId: row.module_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    role: row.role,
    linkedAt: row.linked_at,
  };
}

// ---------------------------------------------------------------------------
// Attachment CRUD
// ---------------------------------------------------------------------------

/**
 * Create a new attachment row. Generates the ID; timestamps come from
 * SQL defaults. Input is validated via Zod; invalid shapes throw.
 */
export function createAttachment(
  db: DatabaseAdapter,
  input: CreateAttachmentInput,
): Attachment {
  const parsed = CreateAttachmentInputSchema.parse(input);
  const id = generateId();

  db.execute(
    `INSERT INTO hub_attachments (
       id, uri, mime, sha256, bytes, thumb_uri, caption, taken_at, lat, lng
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      parsed.uri,
      parsed.mime,
      parsed.sha256 ?? null,
      parsed.bytes ?? null,
      parsed.thumbUri ?? null,
      parsed.caption ?? null,
      parsed.takenAt ?? null,
      parsed.lat ?? null,
      parsed.lng ?? null,
    ],
  );

  const rows = db.query<AttachmentRow>(
    `SELECT * FROM hub_attachments WHERE id = ?`,
    [id],
  );
  if (rows.length === 0) {
    throw new Error(`Failed to create attachment ${id}`);
  }
  return rowToAttachment(rows[0]!);
}

/** Get a single attachment by id, or null if missing. */
export function getAttachment(
  db: DatabaseAdapter,
  id: string,
): Attachment | null {
  const rows = db.query<AttachmentRow>(
    `SELECT * FROM hub_attachments WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rowToAttachment(rows[0]!) : null;
}

/**
 * Delete an attachment. FK `ON DELETE CASCADE` on hub_attachment_links.attachment_id
 * removes dependent links (provided `PRAGMA foreign_keys = ON`).
 */
export function deleteAttachment(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM hub_attachments WHERE id = ?`, [id]);
}

// ---------------------------------------------------------------------------
// Link CRUD
// ---------------------------------------------------------------------------

/**
 * Bind an attachment to a module entity. The composite PK
 * (attachment_id, module_id, entity_type, entity_id) means repeat
 * binds for the same tuple violate PK uniqueness.
 */
export function linkAttachment(
  db: DatabaseAdapter,
  input: LinkAttachmentInput,
): AttachmentLink {
  const parsed = LinkAttachmentInputSchema.parse(input);

  db.execute(
    `INSERT INTO hub_attachment_links (
       attachment_id, module_id, entity_type, entity_id, role
     ) VALUES (?, ?, ?, ?, ?)`,
    [
      parsed.attachmentId,
      parsed.moduleId,
      parsed.entityType,
      parsed.entityId,
      parsed.role ?? null,
    ],
  );

  const rows = db.query<AttachmentLinkRow>(
    `SELECT * FROM hub_attachment_links
     WHERE attachment_id = ? AND module_id = ? AND entity_type = ? AND entity_id = ?`,
    [parsed.attachmentId, parsed.moduleId, parsed.entityType, parsed.entityId],
  );
  if (rows.length === 0) {
    throw new Error(
      `Failed to create attachment link for ${parsed.attachmentId}`,
    );
  }
  return rowToAttachmentLink(rows[0]!);
}

/** Remove a specific (attachment, module, entityType, entityId) binding. */
export function unlinkAttachment(
  db: DatabaseAdapter,
  params: {
    attachmentId: string;
    moduleId: string;
    entityType: string;
    entityId: string;
  },
): void {
  db.execute(
    `DELETE FROM hub_attachment_links
     WHERE attachment_id = ? AND module_id = ? AND entity_type = ? AND entity_id = ?`,
    [params.attachmentId, params.moduleId, params.entityType, params.entityId],
  );
}

/**
 * Return all attachments bound to a given module entity, ordered by
 * link time (newest first).
 */
export function getAttachmentsFor(
  db: DatabaseAdapter,
  query: { moduleId: string; entityType: string; entityId: string },
): Attachment[] {
  const rows = db.query<AttachmentRow>(
    `SELECT a.*
     FROM hub_attachments a
     INNER JOIN hub_attachment_links l ON l.attachment_id = a.id
     WHERE l.module_id = ? AND l.entity_type = ? AND l.entity_id = ?
     ORDER BY l.linked_at DESC`,
    [query.moduleId, query.entityType, query.entityId],
  );
  return rows.map(rowToAttachment);
}

/** Return every link row for a given attachment (across all modules/entities). */
export function getLinksForAttachment(
  db: DatabaseAdapter,
  attachmentId: string,
): AttachmentLink[] {
  const rows = db.query<AttachmentLinkRow>(
    `SELECT * FROM hub_attachment_links
     WHERE attachment_id = ?
     ORDER BY linked_at ASC`,
    [attachmentId],
  );
  return rows.map(rowToAttachmentLink);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * UUID v4-shaped id. Matches the helper in backup/operations.ts so this
 * module does not depend on Node `crypto` (which is not available in
 * the RN runtime on all platforms).
 */
function generateId(): string {
  const hex = '0123456789abcdef';
  const segments = [8, 4, 4, 4, 12];
  return segments
    .map((len) =>
      Array.from({ length: len }, () =>
        hex[Math.floor(Math.random() * 16)],
      ).join(''),
    )
    .join('-');
}
