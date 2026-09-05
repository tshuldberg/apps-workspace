import type { DatabaseAdapter } from '@mylife/db';
import type { Property, PropertyType, OwnershipType } from '../types';

function rowToProperty(row: Record<string, unknown>): Property {
  return {
    id: row.id as string,
    name: row.name as string,
    address: (row.address as string) ?? null,
    city: (row.city as string) ?? null,
    state: (row.state as string) ?? null,
    yearBuilt: (row.year_built as number) ?? null,
    sqft: (row.sqft as number) ?? null,
    propertyType: row.property_type as PropertyType,
    ownershipType: row.ownership_type as OwnershipType,
    listingId: (row.listing_id as string) ?? null,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function createProperty(
  db: DatabaseAdapter,
  id: string,
  input: {
    name: string;
    address?: string;
    city?: string;
    state?: string;
    yearBuilt?: number;
    sqft?: number;
    propertyType?: PropertyType;
    ownershipType?: OwnershipType;
    listingId?: string;
    notes?: string;
  },
): Property {
  const now = new Date().toISOString();
  const propertyType = input.propertyType ?? 'house';
  const ownershipType = input.ownershipType ?? 'own';

  db.execute(
    `INSERT INTO hm_properties (
      id, name, address, city, state, year_built, sqft,
      property_type, ownership_type, listing_id, notes,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.name,
      input.address ?? null,
      input.city ?? null,
      input.state ?? null,
      input.yearBuilt ?? null,
      input.sqft ?? null,
      propertyType,
      ownershipType,
      input.listingId ?? null,
      input.notes ?? null,
      now,
      now,
    ],
  );

  return {
    id,
    name: input.name,
    address: input.address ?? null,
    city: input.city ?? null,
    state: input.state ?? null,
    yearBuilt: input.yearBuilt ?? null,
    sqft: input.sqft ?? null,
    propertyType,
    ownershipType,
    listingId: input.listingId ?? null,
    notes: input.notes ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

export function getProperty(
  db: DatabaseAdapter,
  id: string,
): Property | null {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM hm_properties WHERE id = ?',
    [id],
  );
  return rows.length > 0 ? rowToProperty(rows[0]) : null;
}

export function getProperties(db: DatabaseAdapter): Property[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM hm_properties ORDER BY name ASC LIMIT 200',
    )
    .map(rowToProperty);
}

export function updateProperty(
  db: DatabaseAdapter,
  id: string,
  input: Partial<{
    name: string;
    address: string | null;
    city: string | null;
    state: string | null;
    yearBuilt: number | null;
    sqft: number | null;
    propertyType: PropertyType;
    ownershipType: OwnershipType;
    notes: string | null;
  }>,
): void {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (input.name !== undefined) { sets.push('name = ?'); params.push(input.name); }
  if (input.address !== undefined) { sets.push('address = ?'); params.push(input.address); }
  if (input.city !== undefined) { sets.push('city = ?'); params.push(input.city); }
  if (input.state !== undefined) { sets.push('state = ?'); params.push(input.state); }
  if (input.yearBuilt !== undefined) { sets.push('year_built = ?'); params.push(input.yearBuilt); }
  if (input.sqft !== undefined) { sets.push('sqft = ?'); params.push(input.sqft); }
  if (input.propertyType !== undefined) { sets.push('property_type = ?'); params.push(input.propertyType); }
  if (input.ownershipType !== undefined) { sets.push('ownership_type = ?'); params.push(input.ownershipType); }
  if (input.notes !== undefined) { sets.push('notes = ?'); params.push(input.notes); }

  if (sets.length === 0) return;

  sets.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(id);

  db.execute(
    `UPDATE hm_properties SET ${sets.join(', ')} WHERE id = ?`,
    params,
  );
}

export function deleteProperty(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM hm_properties WHERE id = ?', [id]);
}

export function promoteListingToProperty(
  db: DatabaseAdapter,
  propertyId: string,
  listing: {
    id: string;
    address: string;
    city: string;
    state: string;
    sqft: number;
  },
  propertyName: string,
): Property {
  return createProperty(db, propertyId, {
    name: propertyName,
    address: listing.address,
    city: listing.city,
    state: listing.state,
    sqft: listing.sqft,
    listingId: listing.id,
  });
}
