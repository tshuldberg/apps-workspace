import type { DatabaseAdapter } from '@mylife/db';

export interface FavoriteFood {
  id: string;
  foodId: string;
  createdAt: string;
}

export function addFavorite(db: DatabaseAdapter, id: string, foodId: string): void {
  db.execute(
    'INSERT OR IGNORE INTO nu_favorites (id, food_id) VALUES (?, ?)',
    [id, foodId],
  );
}

export function removeFavorite(db: DatabaseAdapter, foodId: string): void {
  db.execute('DELETE FROM nu_favorites WHERE food_id = ?', [foodId]);
}

export function isFavorite(db: DatabaseAdapter, foodId: string): boolean {
  const rows = db.query<{ count: number }>(
    'SELECT COUNT(*) as count FROM nu_favorites WHERE food_id = ?',
    [foodId],
  );
  return (rows[0]?.count ?? 0) > 0;
}

export function getFavoriteIds(db: DatabaseAdapter): string[] {
  const rows = db.query<{ food_id: string }>(
    'SELECT food_id FROM nu_favorites ORDER BY created_at DESC',
  );
  return rows.map((r) => r.food_id);
}

export function getFavoriteCount(db: DatabaseAdapter): number {
  const rows = db.query<{ count: number }>(
    'SELECT COUNT(*) as count FROM nu_favorites',
  );
  return rows[0]?.count ?? 0;
}
