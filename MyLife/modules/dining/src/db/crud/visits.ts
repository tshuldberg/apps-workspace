/**
 * Visit CRUD operations.
 */

import type { DatabaseAdapter } from '@mylife/db';
import { CreateVisitSchema, UpdateVisitSchema, VisitFilterSchema } from '../../models/schemas';
import type {
  Visit,
  VisitWithRelations,
  CreateVisitInput,
  UpdateVisitInput,
  VisitFilter,
  VisitStats,
  VisitMonthCount,
  Photo,
  Companion,
} from '../../models/schemas';
import { incrementVisitCount, recalcAverageRating, decrementVisitCount } from './restaurants';

const VISIT_COLUMNS = [
  'id',
  'restaurant_id',
  'visited_at',
  'party_size',
  'occasion',
  'reservation_platform',
  'reservation_confirmation_code',
  'overall_rating',
  'vibe_rating',
  'food_rating',
  'service_rating',
  'notes_md',
  'total_cost_cents',
  'who_paid',
  'created_at',
  'updated_at',
].join(', ');

const VISIT_SORT_COLUMNS: Record<string, string> = {
  visited_at: 'visited_at',
  overall_rating: 'overall_rating',
  created_at: 'created_at',
};

const DEFAULT_LIMIT = 50;

export function createVisit(
  db: DatabaseAdapter,
  id: string,
  input: CreateVisitInput,
): Visit {
  const parsed = CreateVisitSchema.parse(input);
  const now = new Date().toISOString();

  const visit: Visit = {
    id,
    restaurant_id: parsed.restaurant_id,
    visited_at: parsed.visited_at,
    party_size: parsed.party_size ?? null,
    occasion: parsed.occasion ?? null,
    reservation_platform: parsed.reservation_platform ?? null,
    reservation_confirmation_code: parsed.reservation_confirmation_code ?? null,
    overall_rating: parsed.overall_rating,
    vibe_rating: parsed.vibe_rating ?? null,
    food_rating: parsed.food_rating ?? null,
    service_rating: parsed.service_rating ?? null,
    notes_md: parsed.notes_md ?? null,
    total_cost_cents: parsed.total_cost_cents ?? null,
    who_paid: parsed.who_paid ?? null,
    created_at: now,
    updated_at: now,
  };

  db.execute(
    `INSERT INTO dn_visits (${VISIT_COLUMNS})
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      visit.id,
      visit.restaurant_id,
      visit.visited_at,
      visit.party_size,
      visit.occasion,
      visit.reservation_platform,
      visit.reservation_confirmation_code,
      visit.overall_rating,
      visit.vibe_rating,
      visit.food_rating,
      visit.service_rating,
      visit.notes_md,
      visit.total_cost_cents,
      visit.who_paid,
      visit.created_at,
      visit.updated_at,
    ],
  );

  // Update parent restaurant counters
  incrementVisitCount(db, visit.restaurant_id);
  recalcAverageRating(db, visit.restaurant_id);

  return visit;
}

export function getVisit(
  db: DatabaseAdapter,
  id: string,
): VisitWithRelations | null {
  const rows = db.query<Visit>(
    `SELECT ${VISIT_COLUMNS} FROM dn_visits WHERE id = ?`,
    [id],
  );
  if (rows.length === 0) return null;

  const photos = db.query<Photo>(
    `SELECT id, visit_id, dish_id, kind, local_uri, caption, width, height, size_bytes, taken_at, exif_stripped, created_at
     FROM dn_photos WHERE visit_id = ?
     ORDER BY created_at`,
    [id],
  );

  const companions = db.query<Companion>(
    `SELECT id, visit_id, display_name, notes, created_at
     FROM dn_companions WHERE visit_id = ?
     ORDER BY display_name`,
    [id],
  );

  return { ...rows[0], photos, companions };
}

export function updateVisit(
  db: DatabaseAdapter,
  id: string,
  input: UpdateVisitInput,
): void {
  const parsed = UpdateVisitSchema.parse(input);
  const fields: string[] = [];
  const values: unknown[] = [];

  const fieldMap: Record<string, unknown> = {
    visited_at: parsed.visited_at,
    party_size: parsed.party_size,
    occasion: parsed.occasion,
    reservation_platform: parsed.reservation_platform,
    reservation_confirmation_code: parsed.reservation_confirmation_code,
    overall_rating: parsed.overall_rating,
    vibe_rating: parsed.vibe_rating,
    food_rating: parsed.food_rating,
    service_rating: parsed.service_rating,
    notes_md: parsed.notes_md,
    total_cost_cents: parsed.total_cost_cents,
    who_paid: parsed.who_paid,
  };

  for (const [key, value] of Object.entries(fieldMap)) {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.execute(
    `UPDATE dn_visits SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );

  // If rating changed, recalculate restaurant average
  if (parsed.overall_rating !== undefined) {
    const rows = db.query<{ restaurant_id: string }>(
      'SELECT restaurant_id FROM dn_visits WHERE id = ?',
      [id],
    );
    if (rows.length > 0) {
      recalcAverageRating(db, rows[0].restaurant_id);
    }
  }
}

export function deleteVisit(db: DatabaseAdapter, id: string): void {
  // Get restaurant_id before deleting
  const rows = db.query<{ restaurant_id: string }>(
    'SELECT restaurant_id FROM dn_visits WHERE id = ?',
    [id],
  );
  if (rows.length === 0) return;

  const restaurantId = rows[0].restaurant_id;

  // Delete the visit (cascades to photos and companions via FK)
  db.execute('DELETE FROM dn_visits WHERE id = ?', [id]);

  // Update parent restaurant counters
  decrementVisitCount(db, restaurantId);
  recalcAverageRating(db, restaurantId);
}

export function listVisitsByRestaurant(
  db: DatabaseAdapter,
  restaurantId: string,
  opts?: Pick<VisitFilter, 'sort_by' | 'sort_dir' | 'limit' | 'offset'>,
): Visit[] {
  const sortCol = VISIT_SORT_COLUMNS[opts?.sort_by ?? 'visited_at'] ?? 'visited_at';
  const sortDir = opts?.sort_dir === 'ASC' ? 'ASC' : 'DESC';
  const limit = opts?.limit ?? DEFAULT_LIMIT;
  const offset = opts?.offset ?? 0;

  return db.query<Visit>(
    `SELECT ${VISIT_COLUMNS} FROM dn_visits
     WHERE restaurant_id = ?
     ORDER BY ${sortCol} ${sortDir}
     LIMIT ? OFFSET ?`,
    [restaurantId, limit, offset],
  );
}

export function listVisitsChronological(
  db: DatabaseAdapter,
  opts?: VisitFilter,
): Visit[] {
  const parsed = opts ? VisitFilterSchema.parse(opts) : {};
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (parsed.restaurant_id) {
    conditions.push('restaurant_id = ?');
    params.push(parsed.restaurant_id);
  }

  if (parsed.date_from) {
    conditions.push('visited_at >= ?');
    params.push(parsed.date_from);
  }

  if (parsed.date_to) {
    conditions.push('visited_at <= ?');
    params.push(parsed.date_to);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sortCol = VISIT_SORT_COLUMNS[parsed.sort_by ?? 'visited_at'] ?? 'visited_at';
  const sortDir = parsed.sort_dir === 'ASC' ? 'ASC' : 'DESC';
  const limit = parsed.limit ?? DEFAULT_LIMIT;
  const offset = parsed.offset ?? 0;

  params.push(limit, offset);

  return db.query<Visit>(
    `SELECT ${VISIT_COLUMNS} FROM dn_visits ${where} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`,
    params,
  );
}

export function getVisitStats(
  db: DatabaseAdapter,
  restaurantId?: string,
): VisitStats {
  const where = restaurantId ? 'WHERE restaurant_id = ?' : '';
  const params: unknown[] = restaurantId ? [restaurantId] : [];

  const countRows = db.query<{ cnt: number; avg_rating: number | null }>(
    `SELECT COUNT(*) as cnt, AVG(CAST(overall_rating AS REAL)) as avg_rating
     FROM dn_visits ${where}`,
    params,
  );

  const totalVisits = countRows.length > 0 ? countRows[0].cnt : 0;
  const avgRating = countRows.length > 0 ? countRows[0].avg_rating : null;

  const monthRows = db.query<{ month: string; count: number }>(
    `SELECT strftime('%Y-%m', visited_at) as month, COUNT(*) as count
     FROM dn_visits ${where}
     GROUP BY month
     ORDER BY month`,
    params,
  );

  const visitsByMonth: VisitMonthCount[] = monthRows.map((r) => ({
    month: r.month,
    count: r.count,
  }));

  return { totalVisits, avgRating, visitsByMonth };
}
