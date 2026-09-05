/**
 * Badge CRUD operations.
 */

import type { DatabaseAdapter } from '@mylife/db';

export type BadgeCategory = 'volume' | 'pages' | 'genre' | 'author' | 'streak' | 'challenge' | 'speed' | 'review' | 'journal';
export type BadgeTier = 'bronze' | 'silver' | 'gold';

export interface Badge {
  id: string;
  category: BadgeCategory;
  name: string;
  description: string;
  tier: BadgeTier;
  threshold: number;
  icon: string;
  earned_at: string | null;
  created_at: string;
}

export function getAllBadges(db: DatabaseAdapter): Badge[] {
  return db.query<Badge>(
    `SELECT * FROM bk_badges ORDER BY category, threshold`,
  );
}

export function getEarnedBadges(db: DatabaseAdapter): Badge[] {
  return db.query<Badge>(
    `SELECT * FROM bk_badges WHERE earned_at IS NOT NULL ORDER BY earned_at DESC`,
  );
}

export function getUnearnedBadges(db: DatabaseAdapter): Badge[] {
  return db.query<Badge>(
    `SELECT * FROM bk_badges WHERE earned_at IS NULL ORDER BY category, threshold`,
  );
}

export function getBadgesByCategory(db: DatabaseAdapter, category: BadgeCategory): Badge[] {
  return db.query<Badge>(
    `SELECT * FROM bk_badges WHERE category = ? ORDER BY threshold`,
    [category],
  );
}

export function getBadge(db: DatabaseAdapter, id: string): Badge | null {
  const rows = db.query<Badge>(
    `SELECT * FROM bk_badges WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rows[0] : null;
}

export function awardBadge(db: DatabaseAdapter, id: string): void {
  db.execute(
    `UPDATE bk_badges SET earned_at = ? WHERE id = ? AND earned_at IS NULL`,
    [new Date().toISOString(), id],
  );
}
