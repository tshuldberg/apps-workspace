/**
 * Restaurant CRUD operations.
 */

import type { DatabaseAdapter } from '@mylife/db';
import { CreateRestaurantSchema, UpdateRestaurantSchema, RestaurantFilterSchema } from '../../models/schemas';
import type {
  Restaurant,
  RestaurantWithTags,
  CreateRestaurantInput,
  UpdateRestaurantInput,
  RestaurantFilter,
  Tag,
} from '../../models/schemas';

const RESTAURANT_COLUMNS = [
  'id',
  'name',
  'address',
  'city',
  'neighborhood',
  'lat',
  'lng',
  'cuisines',
  'price_tier',
  'website_url',
  'resy_url',
  'opentable_url',
  'tock_url',
  'yelp_url',
  'instagram_handle',
  'notes_md',
  'is_wishlist',
  'is_visited',
  'first_visited_at',
  'last_visited_at',
  'visit_count',
  'average_rating',
  'photo_id',
  'created_at',
  'updated_at',
].join(', ');

const SORT_COLUMNS: Record<string, string> = {
  name: 'name',
  created_at: 'created_at',
  visit_count: 'visit_count',
  average_rating: 'average_rating',
  last_visited_at: 'last_visited_at',
};

const DEFAULT_LIMIT = 50;

export function createRestaurant(
  db: DatabaseAdapter,
  id: string,
  input: CreateRestaurantInput,
): Restaurant {
  const parsed = CreateRestaurantSchema.parse(input);
  const now = new Date().toISOString();

  const restaurant: Restaurant = {
    id,
    name: parsed.name,
    address: parsed.address ?? null,
    city: parsed.city ?? null,
    neighborhood: parsed.neighborhood ?? null,
    lat: parsed.lat ?? null,
    lng: parsed.lng ?? null,
    cuisines: parsed.cuisines ?? null,
    price_tier: parsed.price_tier ?? null,
    website_url: parsed.website_url ?? null,
    resy_url: parsed.resy_url ?? null,
    opentable_url: parsed.opentable_url ?? null,
    tock_url: parsed.tock_url ?? null,
    yelp_url: parsed.yelp_url ?? null,
    instagram_handle: parsed.instagram_handle ?? null,
    notes_md: parsed.notes_md ?? null,
    is_wishlist: parsed.is_wishlist ?? 0,
    is_visited: parsed.is_visited ?? 0,
    first_visited_at: null,
    last_visited_at: null,
    visit_count: 0,
    average_rating: null,
    photo_id: parsed.photo_id ?? null,
    created_at: now,
    updated_at: now,
  };

  db.execute(
    `INSERT INTO dn_restaurants (${RESTAURANT_COLUMNS})
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      restaurant.id,
      restaurant.name,
      restaurant.address,
      restaurant.city,
      restaurant.neighborhood,
      restaurant.lat,
      restaurant.lng,
      restaurant.cuisines,
      restaurant.price_tier,
      restaurant.website_url,
      restaurant.resy_url,
      restaurant.opentable_url,
      restaurant.tock_url,
      restaurant.yelp_url,
      restaurant.instagram_handle,
      restaurant.notes_md,
      restaurant.is_wishlist,
      restaurant.is_visited,
      restaurant.first_visited_at,
      restaurant.last_visited_at,
      restaurant.visit_count,
      restaurant.average_rating,
      restaurant.photo_id,
      restaurant.created_at,
      restaurant.updated_at,
    ],
  );

  return restaurant;
}

export function getRestaurant(
  db: DatabaseAdapter,
  id: string,
): RestaurantWithTags | null {
  const rows = db.query<Restaurant>(
    `SELECT ${RESTAURANT_COLUMNS} FROM dn_restaurants WHERE id = ?`,
    [id],
  );
  if (rows.length === 0) return null;

  const tags = db.query<Tag>(
    `SELECT t.id, t.name, t.color, t.kind, t.created_at
     FROM dn_tags t
     INNER JOIN dn_restaurant_tags rt ON t.id = rt.tag_id
     WHERE rt.restaurant_id = ?
     ORDER BY t.name`,
    [id],
  );

  return { ...rows[0], tags };
}

export function updateRestaurant(
  db: DatabaseAdapter,
  id: string,
  input: UpdateRestaurantInput,
): void {
  const parsed = UpdateRestaurantSchema.parse(input);
  const fields: string[] = [];
  const values: unknown[] = [];

  const fieldMap: Record<string, unknown> = {
    name: parsed.name,
    address: parsed.address,
    city: parsed.city,
    neighborhood: parsed.neighborhood,
    lat: parsed.lat,
    lng: parsed.lng,
    cuisines: parsed.cuisines,
    price_tier: parsed.price_tier,
    website_url: parsed.website_url,
    resy_url: parsed.resy_url,
    opentable_url: parsed.opentable_url,
    tock_url: parsed.tock_url,
    yelp_url: parsed.yelp_url,
    instagram_handle: parsed.instagram_handle,
    notes_md: parsed.notes_md,
    is_wishlist: parsed.is_wishlist,
    is_visited: parsed.is_visited,
    photo_id: parsed.photo_id,
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
    `UPDATE dn_restaurants SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}

export function deleteRestaurant(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM dn_restaurants WHERE id = ?', [id]);
}

export function listRestaurants(
  db: DatabaseAdapter,
  filters?: RestaurantFilter,
): Restaurant[] {
  const parsed = filters ? RestaurantFilterSchema.parse(filters) : {};
  const conditions: string[] = [];
  const params: unknown[] = [];
  let needsTagJoin = false;

  if (parsed.search) {
    conditions.push(
      '(r.name LIKE ? OR r.city LIKE ? OR r.neighborhood LIKE ?)',
    );
    const term = `%${parsed.search}%`;
    params.push(term, term, term);
  }

  if (parsed.cuisine_tag_ids && parsed.cuisine_tag_ids.length > 0) {
    needsTagJoin = true;
    const placeholders = parsed.cuisine_tag_ids.map(() => '?').join(', ');
    conditions.push(`rt.tag_id IN (${placeholders})`);
    params.push(...parsed.cuisine_tag_ids);
  }

  if (parsed.neighborhood) {
    conditions.push('r.neighborhood = ?');
    params.push(parsed.neighborhood);
  }

  if (parsed.price_tier_min !== undefined) {
    conditions.push('r.price_tier >= ?');
    params.push(parsed.price_tier_min);
  }

  if (parsed.price_tier_max !== undefined) {
    conditions.push('r.price_tier <= ?');
    params.push(parsed.price_tier_max);
  }

  if (parsed.is_wishlist !== undefined) {
    conditions.push('r.is_wishlist = ?');
    params.push(parsed.is_wishlist);
  }

  if (parsed.is_visited !== undefined) {
    conditions.push('r.is_visited = ?');
    params.push(parsed.is_visited);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sortCol = SORT_COLUMNS[parsed.sort_by ?? 'created_at'] ?? 'created_at';
  const sortDir = parsed.sort_dir === 'ASC' ? 'ASC' : 'DESC';
  const limit = parsed.limit ?? DEFAULT_LIMIT;
  const offset = parsed.offset ?? 0;

  const join = needsTagJoin
    ? 'INNER JOIN dn_restaurant_tags rt ON r.id = rt.restaurant_id'
    : '';

  const selectCols = RESTAURANT_COLUMNS.split(', ')
    .map((c) => `r.${c.trim()}`)
    .join(', ');

  const distinct = needsTagJoin ? 'DISTINCT' : '';

  const sql = `SELECT ${distinct} ${selectCols} FROM dn_restaurants r ${join} ${where} ORDER BY r.${sortCol} ${sortDir} LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  return db.query<Restaurant>(sql, params);
}

export function markVisited(db: DatabaseAdapter, id: string): void {
  const now = new Date().toISOString();
  db.execute(
    `UPDATE dn_restaurants
     SET is_visited = 1,
         first_visited_at = COALESCE(first_visited_at, ?),
         updated_at = ?
     WHERE id = ?`,
    [now, now, id],
  );
}

export function incrementVisitCount(db: DatabaseAdapter, id: string): void {
  const now = new Date().toISOString();
  db.execute(
    `UPDATE dn_restaurants
     SET visit_count = visit_count + 1,
         last_visited_at = ?,
         is_visited = 1,
         first_visited_at = COALESCE(first_visited_at, ?),
         updated_at = ?
     WHERE id = ?`,
    [now, now, now, id],
  );
}

/**
 * Recalculate average_rating from visit overall_rating values.
 */
export function recalcAverageRating(
  db: DatabaseAdapter,
  restaurantId: string,
): void {
  const rows = db.query<{ avg_rating: number | null }>(
    `SELECT AVG(CAST(overall_rating AS REAL)) as avg_rating
     FROM dn_visits WHERE restaurant_id = ?`,
    [restaurantId],
  );
  const avg = rows.length > 0 ? rows[0].avg_rating : null;
  db.execute(
    `UPDATE dn_restaurants SET average_rating = ?, updated_at = ? WHERE id = ?`,
    [avg, new Date().toISOString(), restaurantId],
  );
}

/**
 * Decrement visit_count for a restaurant. Recalculates last_visited_at from
 * remaining visits. If no visits remain, clears is_visited and visit dates.
 */
export function decrementVisitCount(
  db: DatabaseAdapter,
  restaurantId: string,
): void {
  const now = new Date().toISOString();

  // Get remaining visits after the delete has occurred
  const remaining = db.query<{ cnt: number; max_date: string | null }>(
    `SELECT COUNT(*) as cnt, MAX(visited_at) as max_date
     FROM dn_visits WHERE restaurant_id = ?`,
    [restaurantId],
  );

  const count = remaining.length > 0 ? remaining[0].cnt : 0;
  const lastDate = remaining.length > 0 ? remaining[0].max_date : null;

  if (count === 0) {
    db.execute(
      `UPDATE dn_restaurants
       SET visit_count = 0,
           is_visited = 0,
           first_visited_at = NULL,
           last_visited_at = NULL,
           updated_at = ?
       WHERE id = ?`,
      [now, restaurantId],
    );
  } else {
    // Recalculate first_visited_at from remaining visits
    const first = db.query<{ min_date: string | null }>(
      `SELECT MIN(visited_at) as min_date FROM dn_visits WHERE restaurant_id = ?`,
      [restaurantId],
    );
    const firstDate = first.length > 0 ? first[0].min_date : null;
    db.execute(
      `UPDATE dn_restaurants
       SET visit_count = ?,
           first_visited_at = ?,
           last_visited_at = ?,
           updated_at = ?
       WHERE id = ?`,
      [count, firstDate, lastDate, now, restaurantId],
    );
  }
}
