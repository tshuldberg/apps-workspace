import type { DatabaseAdapter } from '@mylife/db';
import type { Registration, RegistrationDocument } from '../types';

// ---------------------------------------------------------------------------
// Row mappers (snake_case SQL -> camelCase TS)
// ---------------------------------------------------------------------------

function rowToRegistration(row: Record<string, unknown>): Registration {
  return {
    id: row.id as string,
    vehicleId: row.vehicle_id as string,
    regState: (row.reg_state as string) ?? null,
    regNumber: (row.reg_number as string) ?? null,
    regExpirationDate: (row.reg_expiration_date as string) ?? null,
    inspectionType: row.inspection_type as Registration['inspectionType'],
    inspectionExpirationDate: (row.inspection_expiration_date as string) ?? null,
    inspectionStation: (row.inspection_station as string) ?? null,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToRegDocument(row: Record<string, unknown>): RegistrationDocument {
  return {
    id: row.id as string,
    registrationId: row.registration_id as string,
    documentType: row.document_type as RegistrationDocument['documentType'],
    imageUri: row.image_uri as string,
    label: (row.label as string) ?? null,
    createdAt: row.created_at as string,
  };
}

// ---------------------------------------------------------------------------
// Registrations
// ---------------------------------------------------------------------------

export function createRegistration(
  db: DatabaseAdapter,
  id: string,
  input: {
    vehicleId: string;
    regState?: string;
    regNumber?: string;
    regExpirationDate?: string;
    inspectionType?: string;
    inspectionExpirationDate?: string;
    inspectionStation?: string;
    notes?: string;
  },
): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO cr_registrations
     (id, vehicle_id, reg_state, reg_number, reg_expiration_date,
      inspection_type, inspection_expiration_date, inspection_station, notes,
      created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.vehicleId,
      input.regState ?? null,
      input.regNumber ?? null,
      input.regExpirationDate ?? null,
      input.inspectionType ?? 'none',
      input.inspectionExpirationDate ?? null,
      input.inspectionStation ?? null,
      input.notes ?? null,
      now,
      now,
    ],
  );
}

export function getRegistrationByVehicle(db: DatabaseAdapter, vehicleId: string): Registration | null {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM cr_registrations WHERE vehicle_id = ? ORDER BY created_at DESC LIMIT 1',
    [vehicleId],
  );
  return rows.length > 0 ? rowToRegistration(rows[0]) : null;
}

export function getRegistrationById(db: DatabaseAdapter, id: string): Registration | null {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM cr_registrations WHERE id = ?',
    [id],
  );
  return rows.length > 0 ? rowToRegistration(rows[0]) : null;
}

export function updateRegistration(
  db: DatabaseAdapter,
  id: string,
  updates: Partial<{
    regState: string | null;
    regNumber: string | null;
    regExpirationDate: string | null;
    inspectionType: string;
    inspectionExpirationDate: string | null;
    inspectionStation: string | null;
    notes: string | null;
  }>,
): void {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (updates.regState !== undefined) { sets.push('reg_state = ?'); params.push(updates.regState); }
  if (updates.regNumber !== undefined) { sets.push('reg_number = ?'); params.push(updates.regNumber); }
  if (updates.regExpirationDate !== undefined) { sets.push('reg_expiration_date = ?'); params.push(updates.regExpirationDate); }
  if (updates.inspectionType !== undefined) { sets.push('inspection_type = ?'); params.push(updates.inspectionType); }
  if (updates.inspectionExpirationDate !== undefined) { sets.push('inspection_expiration_date = ?'); params.push(updates.inspectionExpirationDate); }
  if (updates.inspectionStation !== undefined) { sets.push('inspection_station = ?'); params.push(updates.inspectionStation); }
  if (updates.notes !== undefined) { sets.push('notes = ?'); params.push(updates.notes); }
  if (sets.length === 0) return;
  sets.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(id);
  db.execute(`UPDATE cr_registrations SET ${sets.join(', ')} WHERE id = ?`, params);
}

export function deleteRegistration(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM cr_registrations WHERE id = ?', [id]);
}

// ---------------------------------------------------------------------------
// Registration Documents
// ---------------------------------------------------------------------------

export function createRegDocument(
  db: DatabaseAdapter,
  id: string,
  input: {
    registrationId: string;
    documentType?: string;
    imageUri: string;
    label?: string;
  },
): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO cr_registration_documents (id, registration_id, document_type, image_uri, label, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, input.registrationId, input.documentType ?? 'other', input.imageUri, input.label ?? null, now],
  );
}

export function getRegDocumentsByRegistration(db: DatabaseAdapter, registrationId: string): RegistrationDocument[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM cr_registration_documents WHERE registration_id = ? ORDER BY created_at DESC',
      [registrationId],
    )
    .map(rowToRegDocument);
}

export function deleteRegDocument(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM cr_registration_documents WHERE id = ?', [id]);
}
