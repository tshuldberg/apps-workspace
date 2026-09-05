import type { DatabaseAdapter } from '@mylife/db';
import {
  CertificationInputSchema,
  CertificationRowSchema,
  CertificationUpdateSchema,
  type CertificationInput,
  type CertificationRow,
  type CertificationUpdate,
} from '../../models/schemas';

export function createCertification(
  db: DatabaseAdapter,
  id: string,
  input: CertificationInput,
): CertificationRow {
  const parsed = CertificationInputSchema.parse(input);
  const now = new Date().toISOString();

  const row: CertificationRow = {
    id,
    name: parsed.name,
    issuer: parsed.issuer ?? null,
    issued_at: parsed.issued_at ?? null,
    expires_at: parsed.expires_at ?? null,
    credential_id: parsed.credential_id ?? null,
    credential_url: parsed.credential_url ?? null,
    category: parsed.category ?? null,
    notes_md: parsed.notes_md ?? null,
    renewal_reminder_days: parsed.renewal_reminder_days ?? null,
    created_at: now,
    updated_at: now,
  };

  db.execute(
    `INSERT INTO cs_certifications
      (id, name, issuer, issued_at, expires_at, credential_id, credential_url,
       category, notes_md, renewal_reminder_days, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.name,
      row.issuer,
      row.issued_at,
      row.expires_at,
      row.credential_id,
      row.credential_url,
      row.category,
      row.notes_md,
      row.renewal_reminder_days,
      row.created_at,
      row.updated_at,
    ],
  );

  return CertificationRowSchema.parse(row);
}

export function getCertification(
  db: DatabaseAdapter,
  id: string,
): CertificationRow | null {
  const rows = db.query<CertificationRow>(
    `SELECT * FROM cs_certifications WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? CertificationRowSchema.parse(rows[0]) : null;
}

const UPDATABLE_COLUMNS = new Set([
  'name',
  'issuer',
  'issued_at',
  'expires_at',
  'credential_id',
  'credential_url',
  'category',
  'notes_md',
  'renewal_reminder_days',
]);

export function updateCertification(
  db: DatabaseAdapter,
  id: string,
  updates: CertificationUpdate,
): void {
  const parsed = CertificationUpdateSchema.parse(updates);
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(parsed)) {
    if (!UPDATABLE_COLUMNS.has(key)) continue;
    fields.push(`${key} = ?`);
    values.push(value ?? null);
  }

  if (fields.length === 0) return;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());

  db.execute(
    `UPDATE cs_certifications SET ${fields.join(', ')} WHERE id = ?`,
    [...values, id],
  );
}

export function deleteCertification(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM cs_certifications WHERE id = ?`, [id]);
}

export function listCertifications(db: DatabaseAdapter): CertificationRow[] {
  return db
    .query<CertificationRow>(
      `SELECT * FROM cs_certifications
       ORDER BY (issued_at IS NULL), issued_at DESC, created_at DESC`,
    )
    .map((row) => CertificationRowSchema.parse(row));
}

/**
 * listExpiring: certifications whose expires_at falls within [now, now + days).
 * Certs with no expires_at are excluded.
 */
export function listExpiring(
  db: DatabaseAdapter,
  days: number,
  now?: Date,
): CertificationRow[] {
  const start = now ?? new Date();
  const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
  return db
    .query<CertificationRow>(
      `SELECT * FROM cs_certifications
       WHERE expires_at IS NOT NULL
         AND expires_at >= ?
         AND expires_at < ?
       ORDER BY expires_at ASC`,
      [start.toISOString(), end.toISOString()],
    )
    .map((row) => CertificationRowSchema.parse(row));
}
