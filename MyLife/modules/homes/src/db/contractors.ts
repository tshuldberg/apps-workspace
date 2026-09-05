import type { DatabaseAdapter } from '@mylife/db';
import type { Contractor, Specialty } from '../types';

function rowToContractor(row: Record<string, unknown>): Contractor {
  return {
    id: row.id as string,
    propertyId: (row.property_id as string) ?? null,
    name: row.name as string,
    company: (row.company as string) ?? null,
    specialty: row.specialty as Specialty,
    phone: (row.phone as string) ?? null,
    email: (row.email as string) ?? null,
    website: (row.website as string) ?? null,
    address: (row.address as string) ?? null,
    rating: (row.rating as number) ?? null,
    notes: (row.notes as string) ?? null,
    isFavorite: row.is_favorite === 1 || row.is_favorite === true,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function createContractor(
  db: DatabaseAdapter,
  id: string,
  input: {
    propertyId?: string;
    name: string;
    company?: string;
    specialty?: Specialty;
    phone?: string;
    email?: string;
    website?: string;
    address?: string;
    rating?: number;
    notes?: string;
    isFavorite?: boolean;
  },
): Contractor {
  const now = new Date().toISOString();
  const specialty = input.specialty ?? 'general';
  const isFavorite = input.isFavorite ?? false;

  db.execute(
    `INSERT INTO hm_contractors (
      id, property_id, name, company, specialty, phone, email,
      website, address, rating, notes, is_favorite,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.propertyId ?? null,
      input.name,
      input.company ?? null,
      specialty,
      input.phone ?? null,
      input.email ?? null,
      input.website ?? null,
      input.address ?? null,
      input.rating ?? null,
      input.notes ?? null,
      isFavorite ? 1 : 0,
      now,
      now,
    ],
  );

  return {
    id,
    propertyId: input.propertyId ?? null,
    name: input.name,
    company: input.company ?? null,
    specialty,
    phone: input.phone ?? null,
    email: input.email ?? null,
    website: input.website ?? null,
    address: input.address ?? null,
    rating: input.rating ?? null,
    notes: input.notes ?? null,
    isFavorite,
    createdAt: now,
    updatedAt: now,
  };
}

export function getContractor(
  db: DatabaseAdapter,
  id: string,
): Contractor | null {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM hm_contractors WHERE id = ?',
    [id],
  );
  return rows.length > 0 ? rowToContractor(rows[0]) : null;
}

export function getContractorsForProperty(
  db: DatabaseAdapter,
  propertyId: string,
): Contractor[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM hm_contractors WHERE property_id = ? OR property_id IS NULL ORDER BY name ASC LIMIT 200',
      [propertyId],
    )
    .map(rowToContractor);
}

export function getAllContractors(db: DatabaseAdapter): Contractor[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM hm_contractors ORDER BY name ASC LIMIT 200',
    )
    .map(rowToContractor);
}

export function updateContractor(
  db: DatabaseAdapter,
  id: string,
  input: Partial<{
    propertyId: string | null;
    name: string;
    company: string | null;
    specialty: Specialty;
    phone: string | null;
    email: string | null;
    website: string | null;
    address: string | null;
    rating: number | null;
    notes: string | null;
    isFavorite: boolean;
  }>,
): void {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (input.propertyId !== undefined) { sets.push('property_id = ?'); params.push(input.propertyId); }
  if (input.name !== undefined) { sets.push('name = ?'); params.push(input.name); }
  if (input.company !== undefined) { sets.push('company = ?'); params.push(input.company); }
  if (input.specialty !== undefined) { sets.push('specialty = ?'); params.push(input.specialty); }
  if (input.phone !== undefined) { sets.push('phone = ?'); params.push(input.phone); }
  if (input.email !== undefined) { sets.push('email = ?'); params.push(input.email); }
  if (input.website !== undefined) { sets.push('website = ?'); params.push(input.website); }
  if (input.address !== undefined) { sets.push('address = ?'); params.push(input.address); }
  if (input.rating !== undefined) { sets.push('rating = ?'); params.push(input.rating); }
  if (input.notes !== undefined) { sets.push('notes = ?'); params.push(input.notes); }
  if (input.isFavorite !== undefined) { sets.push('is_favorite = ?'); params.push(input.isFavorite ? 1 : 0); }

  if (sets.length === 0) return;

  sets.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(id);

  db.execute(
    `UPDATE hm_contractors SET ${sets.join(', ')} WHERE id = ?`,
    params,
  );
}

export function toggleFavorite(db: DatabaseAdapter, id: string): void {
  db.execute(
    `UPDATE hm_contractors SET is_favorite = CASE WHEN is_favorite = 1 THEN 0 ELSE 1 END, updated_at = ? WHERE id = ?`,
    [new Date().toISOString(), id],
  );
}

export function deleteContractor(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM hm_contractors WHERE id = ?', [id]);
}
