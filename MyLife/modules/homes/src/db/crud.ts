import type { DatabaseAdapter } from '@mylife/db';
import type {
  HomeListing,
  HomeListingStatus,
  HomeMarketMetrics,
  HomeTour,
} from '../types';

function rowToListing(row: Record<string, unknown>): HomeListing {
  return {
    id: row.id as string,
    address: row.address as string,
    city: row.city as string,
    state: row.state as string,
    priceCents: row.price_cents as number,
    bedrooms: row.bedrooms as number,
    bathrooms: row.bathrooms as number,
    sqft: row.sqft as number,
    status: row.status as HomeListingStatus,
    isSaved: !!(row.is_saved as number),
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToTour(row: Record<string, unknown>): HomeTour {
  return {
    id: row.id as string,
    listingId: row.listing_id as string,
    tourAt: row.tour_at as string,
    agentName: (row.agent_name as string) ?? null,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
  };
}

export function createListing(
  db: DatabaseAdapter,
  id: string,
  input: {
    address: string;
    city: string;
    state: string;
    priceCents: number;
    bedrooms: number;
    bathrooms: number;
    sqft: number;
    status?: HomeListingStatus;
    isSaved?: boolean;
    notes?: string;
  },
): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO hm_listings (
      id, address, city, state, price_cents, bedrooms, bathrooms, sqft,
      status, is_saved, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.address,
      input.city,
      input.state.toUpperCase(),
      input.priceCents,
      input.bedrooms,
      input.bathrooms,
      input.sqft,
      input.status ?? 'new',
      input.isSaved ? 1 : 0,
      input.notes ?? null,
      now,
      now,
    ],
  );
}

export function getListings(
  db: DatabaseAdapter,
  options?: {
    search?: string;
    savedOnly?: boolean;
    status?: HomeListingStatus;
  },
): HomeListing[] {
  const where: string[] = [];
  const params: unknown[] = [];

  if (options?.search) {
    where.push(`(address LIKE ? ESCAPE '\\' OR city LIKE ? ESCAPE '\\' OR state LIKE ? ESCAPE '\\')`);
    const escaped = options.search.replace(/[%_\\]/g, '\\$&');
    const token = `%${escaped}%`;
    params.push(token, token, token);
  }
  if (options?.savedOnly) {
    where.push('is_saved = 1');
  }
  if (options?.status) {
    where.push('status = ?');
    params.push(options.status);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM hm_listings
       ${whereClause}
       ORDER BY is_saved DESC, updated_at DESC
       LIMIT 500`,
      params,
    )
    .map(rowToListing);
}

export function toggleListingSaved(db: DatabaseAdapter, id: string): void {
  db.execute(
    `UPDATE hm_listings
     SET is_saved = CASE WHEN is_saved = 1 THEN 0 ELSE 1 END,
         updated_at = ?
     WHERE id = ?`,
    [new Date().toISOString(), id],
  );
}

export function updateListingStatus(
  db: DatabaseAdapter,
  id: string,
  status: HomeListingStatus,
): void {
  db.execute(
    `UPDATE hm_listings SET status = ?, updated_at = ? WHERE id = ?`,
    [status, new Date().toISOString(), id],
  );
}

export function deleteListing(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM hm_listings WHERE id = ?', [id]);
}

export function countSavedListings(db: DatabaseAdapter): number {
  return db.query<{ c: number }>('SELECT COUNT(*) as c FROM hm_listings WHERE is_saved = 1')[0]?.c ?? 0;
}

export function getHomeMarketMetrics(db: DatabaseAdapter): HomeMarketMetrics {
  const counts = db.query<{
    listings: number;
    avg_price_cents: number | null;
    avg_ppsf: number | null;
  }>(
    `SELECT
       COUNT(*) as listings,
       AVG(price_cents) as avg_price_cents,
       AVG(CASE WHEN sqft > 0 THEN CAST(price_cents AS REAL) / sqft ELSE NULL END) as avg_ppsf
     FROM hm_listings`,
  )[0];

  return {
    listings: counts?.listings ?? 0,
    savedListings: countSavedListings(db),
    averagePriceCents: Math.round(counts?.avg_price_cents ?? 0),
    averagePricePerSqft: counts?.avg_ppsf ?? 0,
  };
}

export function createTour(
  db: DatabaseAdapter,
  id: string,
  input: {
    listingId: string;
    tourAt: string;
    agentName?: string;
    notes?: string;
  },
): void {
  db.execute(
    `INSERT INTO hm_tours (id, listing_id, tour_at, agent_name, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.listingId,
      input.tourAt,
      input.agentName ?? null,
      input.notes ?? null,
      new Date().toISOString(),
    ],
  );
}

export function getToursByListing(
  db: DatabaseAdapter,
  listingId: string,
): HomeTour[] {
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM hm_tours WHERE listing_id = ? ORDER BY tour_at DESC LIMIT 200`,
      [listingId],
    )
    .map(rowToTour);
}

export function deleteTour(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM hm_tours WHERE id = ?', [id]);
}
