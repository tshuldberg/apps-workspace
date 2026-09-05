/**
 * Journal photo CRUD operations (hub variant with bk_ prefix).
 *
 * Shadow-writes to hub_attachments + hub_attachment_links (Phase 1c Wave A).
 * The per-module table bk_journal_photos stays canonical for reads; each
 * CRUD op mirrors the write to the shared hub tables inside a single
 * transaction. Hub-write failures throw and roll back the local write.
 *
 * bk_journal_photos has no caption/metadata edit path, so no update shadow
 * is implemented. If/when caption edits land, the attachments adapter
 * will need an updateAttachment operation.
 */

import type { DatabaseAdapter } from '@mylife/db';
import {
  createAttachment,
  deleteAttachment,
  getLinksForAttachment,
  linkAttachment,
} from '@mylife/db';
import type { JournalPhoto, JournalPhotoInsert } from '../models/schemas';

function inferMime(filePath: string): string {
  const ext = filePath.toLowerCase().split('.').pop() ?? '';
  switch (ext) {
    case 'png': return 'image/png';
    case 'gif': return 'image/gif';
    case 'webp': return 'image/webp';
    case 'heic': return 'image/heic';
    case 'jpg':
    case 'jpeg':
    default: return 'image/jpeg';
  }
}

export function addJournalPhoto(
  db: DatabaseAdapter,
  id: string,
  input: JournalPhotoInsert,
): JournalPhoto {
  const now = new Date().toISOString();
  const photo: JournalPhoto = {
    id,
    entry_id: input.entry_id,
    file_path: input.file_path,
    file_name: input.file_name ?? null,
    width: input.width ?? null,
    height: input.height ?? null,
    sort_order: input.sort_order ?? 0,
    created_at: now,
  };

  db.transaction(() => {
    db.execute(
      `INSERT INTO bk_journal_photos (id, entry_id, file_path, file_name,
        width, height, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        photo.id, photo.entry_id, photo.file_path, photo.file_name,
        photo.width, photo.height, photo.sort_order, photo.created_at,
      ],
    );

    const hub = createAttachment(db, {
      uri: photo.file_path,
      mime: inferMime(photo.file_path),
    });

    linkAttachment(db, {
      attachmentId: hub.id,
      moduleId: 'books',
      entityType: 'journal_photo',
      entityId: photo.id,
    });

    db.execute(
      `UPDATE bk_journal_photos SET hub_attachment_id = ? WHERE id = ?`,
      [hub.id, photo.id],
    );
  });

  return photo;
}

export function getPhotosForEntry(
  db: DatabaseAdapter,
  entryId: string,
): JournalPhoto[] {
  return db.query<JournalPhoto>(
    `SELECT * FROM bk_journal_photos WHERE entry_id = ? ORDER BY sort_order`,
    [entryId],
  );
}

export function removeJournalPhoto(
  db: DatabaseAdapter,
  id: string,
): void {
  db.transaction(() => {
    const rows = db.query<{ hub_attachment_id: string | null }>(
      `SELECT hub_attachment_id FROM bk_journal_photos WHERE id = ?`,
      [id],
    );
    const hubId = rows[0]?.hub_attachment_id ?? null;

    db.execute(`DELETE FROM bk_journal_photos WHERE id = ?`, [id]);

    if (hubId) {
      // FK ON DELETE CASCADE on hub_attachment_links cleans up the binding.
      deleteAttachment(db, hubId);
    }
  });
}

export function reorderJournalPhotos(
  db: DatabaseAdapter,
  entryId: string,
  photoIds: string[],
): void {
  db.transaction(() => {
    for (let i = 0; i < photoIds.length; i++) {
      db.execute(
        `UPDATE bk_journal_photos SET sort_order = ? WHERE id = ? AND entry_id = ?`,
        [i, photoIds[i], entryId],
      );
    }
  });
}

// ---------------------------------------------------------------------------
// Cross-module readers (Phase 2 Wave A read-side)
// ---------------------------------------------------------------------------

/** A non-books link to one of this book's hub_attachment ids. */
export interface CrossModuleAttachmentLink {
  moduleId: string;
  entityType: string;
  entityId: string;
}

/**
 * For every journal photo linked to entries belonging to `bookId`, walk the
 * shadow-written hub_attachments + hub_attachment_links and surface every
 * link that points at a non-books entity.
 *
 * Powers a future insights surface like "this book's photos appear in X
 * other modules". Reads only; the local bk_journal_photos remain canonical
 * for in-module reads. Photos lacking a hub_attachment_id (pre-shadow
 * legacy rows) are silently skipped.
 */
export function getCrossModuleAttachmentsForBook(
  db: DatabaseAdapter,
  bookId: string,
): CrossModuleAttachmentLink[] {
  const photoRows = db.query<{ hub_attachment_id: string | null }>(
    `SELECT p.hub_attachment_id
       FROM bk_journal_photos p
       JOIN bk_journal_book_links jbl ON jbl.entry_id = p.entry_id
      WHERE jbl.book_id = ?
        AND p.hub_attachment_id IS NOT NULL`,
    [bookId],
  );

  const out: CrossModuleAttachmentLink[] = [];
  for (const row of photoRows) {
    const hubId = row.hub_attachment_id;
    if (hubId === null) continue;
    const links = getLinksForAttachment(db, hubId);
    for (const link of links) {
      if (link.moduleId === 'books') continue;
      out.push({
        moduleId: link.moduleId,
        entityType: link.entityType,
        entityId: link.entityId,
      });
    }
  }
  return out;
}
