/**
 * V10 — add hub_attachment_id pointer column to bk_journal_photos.
 *
 * Enables shadow-write adoption of the shared hub_attachments +
 * hub_attachment_links store. Existing rows remain NULL; a backfill
 * migration populates them in a later wave.
 */

export const ADD_HUB_ATTACHMENT_ID_V10 = [
  'ALTER TABLE bk_journal_photos ADD COLUMN hub_attachment_id TEXT;',
];
