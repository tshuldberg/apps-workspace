// MyNotes V4 migration schema - hub tag shadow-write adoption
//
// Adds a nullable `hub_tag_id` column to `nt_tags` so the notes module can
// pointer-link each module-scoped tag row to its canonical `hub_tags` id.
// Reads continue to hit `nt_tags`; writes are shadowed into `hub_tags` and
// `hub_tag_bindings` via the @mylife/db shared-tag adapter.

export const ADD_HUB_TAG_ID_V4 = 'ALTER TABLE nt_tags ADD COLUMN hub_tag_id TEXT';

export const NOTES_V4_UP: string[] = [ADD_HUB_TAG_ID_V4];

// SQLite pre-3.35 cannot DROP COLUMN; leaving an orphan column on rollback
// is harmless (nullable, ignored by pre-V4 code).
export const NOTES_V4_DOWN: string[] = ['SELECT 1;'];
