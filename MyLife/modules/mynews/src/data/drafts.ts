import type { DatabaseAdapter } from '@mylife/db';
import type { ChangelogEntry } from '../models';
import type { SignableRevision } from '../signing/canonical';

export interface Draft {
  id: string;
  headline: string | null;
  dek: string | null;
  bodyMd: string;
  kind: 'news' | 'preprint';
  updatedAt: string;
}

interface DraftRow {
  id: string;
  headline: string | null;
  dek: string | null;
  body_md: string;
  kind: string;
  updated_at: string;
}

function rowToDraft(row: DraftRow): Draft {
  return {
    id: row.id,
    headline: row.headline,
    dek: row.dek,
    bodyMd: row.body_md,
    kind: row.kind === 'preprint' ? 'preprint' : 'news',
    updatedAt: row.updated_at,
  };
}

export function listDrafts(db: DatabaseAdapter): Draft[] {
  return db
    .query<DraftRow>('SELECT * FROM nw_drafts ORDER BY updated_at DESC')
    .map(rowToDraft);
}

export function getDraft(db: DatabaseAdapter, id: string): Draft | null {
  const rows = db.query<DraftRow>('SELECT * FROM nw_drafts WHERE id = ?', [id]);
  return rows[0] ? rowToDraft(rows[0]) : null;
}

export function upsertDraft(
  db: DatabaseAdapter,
  draft: Omit<Draft, 'updatedAt'> & { updatedAt?: string },
  nowIso: string,
): Draft {
  const updatedAt = draft.updatedAt ?? nowIso;
  db.execute(
    `INSERT INTO nw_drafts (id, headline, dek, body_md, kind, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       headline = excluded.headline,
       dek = excluded.dek,
       body_md = excluded.body_md,
       kind = excluded.kind,
       updated_at = excluded.updated_at`,
    [draft.id, draft.headline, draft.dek, draft.bodyMd, draft.kind, updatedAt],
  );
  return { ...draft, updatedAt };
}

export function deleteDraft(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM nw_drafts WHERE id = ?', [id]);
}

/**
 * Shapes a local draft into the revision payload the author will sign.
 * Throws when the draft cannot be published (no headline, empty body):
 * the composer surfaces these as inline validation, never a silent fallback.
 */
export function draftToSignableRevision(input: {
  draft: Draft;
  articleId: string;
  rev: number;
  changelog: ChangelogEntry[];
  createdAt: string;
  signerPubkey: string;
}): SignableRevision {
  const headline = input.draft.headline?.trim();
  if (!headline) throw new Error('draftToSignableRevision: a headline is required to publish');
  if (!input.draft.bodyMd.trim()) {
    throw new Error('draftToSignableRevision: an empty article cannot be published');
  }
  return {
    articleId: input.articleId,
    rev: input.rev,
    headline,
    dek: input.draft.dek?.trim() || undefined,
    bodyMd: input.draft.bodyMd,
    changelog: input.changelog,
    createdAt: input.createdAt,
    signerPubkey: input.signerPubkey,
  };
}
