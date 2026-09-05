/**
 * Device-local OS share-intake store (Plan 20, Phase 8.3/8.4). Shared by both
 * clients so the schema + helpers cannot drift; RN-safe (DatabaseAdapter only).
 *
 * mk_share_intake + mk_share_payload stage an incoming OS-shared item until the
 * user routes it. DEVICE-LOCAL by construction: mk_ prefix, deliberately OUTSIDE
 * MEERKAT_SYNC_PREFIXES, never replicated (NC-9). A staged item leaves the device
 * only when the user explicitly routes + sends it through an existing real path
 * (channel / DM / file request); that path's own rows are then the source of
 * truth for "sent" (NC-10), not mk_share_intake.status. Bytes live in the
 * EXISTING blob store (content-addressed); these rows only reference them. A
 * sweep removes expired/discarded rows and returns blob hashes no live payload
 * still references, so the app can unpin the orphaned bytes.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type {
  NormalizedPayload,
  ShareDestination,
  ShareIntakeStatus,
  ShareSource,
} from './share-intake';

export const CREATE_MK_SHARE_INTAKE = `
CREATE TABLE IF NOT EXISTS mk_share_intake (
  id           TEXT PRIMARY KEY,
  source       TEXT NOT NULL,
  source_app   TEXT,
  status       TEXT NOT NULL,
  destination  TEXT,
  dest_ref     TEXT,
  created_at   TEXT NOT NULL,
  expires_at   TEXT NOT NULL
)`;

export const CREATE_MK_SHARE_PAYLOAD = `
CREATE TABLE IF NOT EXISTS mk_share_payload (
  id           TEXT PRIMARY KEY,
  intake_id    TEXT NOT NULL,
  kind         TEXT NOT NULL,
  uti          TEXT,
  mime         TEXT,
  filename     TEXT,
  byte_length  INTEGER,
  text_value   TEXT,
  blob_hash    TEXT,
  thumb_hash   TEXT
)`;

export function ensureShareIntakeTables(db: DatabaseAdapter): void {
  db.execute(CREATE_MK_SHARE_INTAKE);
  db.execute(CREATE_MK_SHARE_PAYLOAD);
}

export interface StagePayloadInput extends NormalizedPayload {
  id: string;
  /** Content address into the existing blob store; null for inline text/url. */
  blobHash?: string | null;
  thumbHash?: string | null;
}

export interface StageShareIntakeInput {
  id: string;
  source: ShareSource;
  sourceApp?: string | null;
  createdAt: string;
  expiresAt: string;
  payloads: StagePayloadInput[];
}

export interface ShareIntakeRow {
  id: string;
  source: string;
  source_app: string | null;
  status: ShareIntakeStatus;
  destination: ShareDestination | null;
  dest_ref: string | null;
  created_at: string;
  expires_at: string;
}

export interface SharePayloadRow {
  id: string;
  intake_id: string;
  kind: string;
  uti: string | null;
  mime: string | null;
  filename: string | null;
  byte_length: number | null;
  text_value: string | null;
  blob_hash: string | null;
  thumb_hash: string | null;
}

/** Stage one incoming share (status 'staged') with its payloads in a transaction. */
export function stageShareIntake(db: DatabaseAdapter, input: StageShareIntakeInput): void {
  db.transaction(() => {
    db.execute(
      `INSERT OR REPLACE INTO mk_share_intake
         (id, source, source_app, status, destination, dest_ref, created_at, expires_at)
       VALUES (?, ?, ?, 'staged', NULL, NULL, ?, ?)`,
      [input.id, input.source, input.sourceApp ?? null, input.createdAt, input.expiresAt],
    );
    for (const p of input.payloads) {
      db.execute(
        `INSERT OR REPLACE INTO mk_share_payload
           (id, intake_id, kind, uti, mime, filename, byte_length, text_value, blob_hash, thumb_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          p.id,
          input.id,
          p.kind,
          p.uti ?? null,
          p.mime ?? null,
          p.filename ?? null,
          p.byteLength ?? null,
          p.textValue ?? null,
          p.blobHash ?? null,
          p.thumbHash ?? null,
        ],
      );
    }
  });
}

export function listShareIntakes(
  db: DatabaseAdapter,
  statuses: ShareIntakeStatus[] = ['staged', 'reviewing'],
): ShareIntakeRow[] {
  const placeholders = statuses.map(() => '?').join(', ');
  return db.query<ShareIntakeRow>(
    `SELECT id, source, source_app, status, destination, dest_ref, created_at, expires_at
       FROM mk_share_intake
      WHERE status IN (${placeholders})
      ORDER BY created_at DESC`,
    statuses,
  );
}

export function getSharePayloads(db: DatabaseAdapter, intakeId: string): SharePayloadRow[] {
  return db.query<SharePayloadRow>(
    `SELECT id, intake_id, kind, uti, mime, filename, byte_length, text_value, blob_hash, thumb_hash
       FROM mk_share_payload WHERE intake_id = ?`,
    [intakeId],
  );
}

export function setShareIntakeStatus(db: DatabaseAdapter, id: string, status: ShareIntakeStatus): void {
  db.execute(`UPDATE mk_share_intake SET status = ? WHERE id = ?`, [status, id]);
}

/** Mark a staged item routed to a destination (the destination row owns "sent"). */
export function routeShareIntake(
  db: DatabaseAdapter,
  id: string,
  destination: ShareDestination,
  destRef: string,
): void {
  db.execute(
    `UPDATE mk_share_intake SET status = 'routed', destination = ?, dest_ref = ? WHERE id = ?`,
    [destination, destRef, id],
  );
}

export function discardShareIntake(db: DatabaseAdapter, id: string): void {
  setShareIntakeStatus(db, id, 'discarded');
}

/**
 * Sweep intakes that are past their TTL (staged/reviewing/expired) or discarded,
 * deleting their rows and returning the blob hashes that no LIVE payload still
 * references, so the caller can unpin the orphaned bytes. Routed items are kept
 * (their bytes are owned by the destination path).
 */
export function sweepExpiredShareIntakes(
  db: DatabaseAdapter,
  nowIso: string,
): { removedIntakeIds: string[]; orphanedBlobHashes: string[] } {
  const victims = db.query<{ id: string }>(
    `SELECT id FROM mk_share_intake
      WHERE status = 'discarded'
         OR (status IN ('staged', 'reviewing', 'expired') AND expires_at < ?)`,
    [nowIso],
  );
  const ids = victims.map((v) => v.id);
  if (ids.length === 0) return { removedIntakeIds: [], orphanedBlobHashes: [] };

  const placeholders = ids.map(() => '?').join(', ');
  const blobRows = db.query<{ blob_hash: string | null; thumb_hash: string | null }>(
    `SELECT blob_hash, thumb_hash FROM mk_share_payload WHERE intake_id IN (${placeholders})`,
    ids,
  );
  const candidateHashes = new Set<string>();
  for (const row of blobRows) {
    if (row.blob_hash) candidateHashes.add(row.blob_hash);
    if (row.thumb_hash) candidateHashes.add(row.thumb_hash);
  }

  db.transaction(() => {
    db.execute(`DELETE FROM mk_share_payload WHERE intake_id IN (${placeholders})`, ids);
    db.execute(`DELETE FROM mk_share_intake WHERE id IN (${placeholders})`, ids);
  });

  // Only report a hash as orphaned when NO surviving payload references it.
  const orphaned: string[] = [];
  for (const hash of candidateHashes) {
    const still = db.query<{ n: number }>(
      `SELECT COUNT(*) AS n FROM mk_share_payload WHERE blob_hash = ? OR thumb_hash = ?`,
      [hash, hash],
    );
    if ((still[0]?.n ?? 0) === 0) orphaned.push(hash);
  }
  return { removedIntakeIds: ids, orphanedBlobHashes: orphaned };
}
