import type { DatabaseAdapter } from '@mylife/db';

export function createBadge(db: DatabaseAdapter, id: string, badgeKey: string, habitId: string | null): void {
  db.execute(
    `INSERT OR IGNORE INTO hb_badges (id, badge_key, habit_id) VALUES (?, ?, ?)`,
    [id, badgeKey, habitId],
  );
}

export function getBadgesForHabit(db: DatabaseAdapter, habitId: string) {
  return db.query<Record<string, unknown>>(
    'SELECT * FROM hb_badges WHERE habit_id = ? ORDER BY unlocked_at DESC',
    [habitId],
  ).map(mapBadge);
}

export function getAllBadges(db: DatabaseAdapter) {
  return db.query<Record<string, unknown>>('SELECT * FROM hb_badges ORDER BY unlocked_at DESC').map(mapBadge);
}

export function getEarnedBadges(db: DatabaseAdapter) {
  return getAllBadges(db);
}

export function getUnlockedBadgeKeys(db: DatabaseAdapter): Set<string> {
  const rows = db.query<Record<string, unknown>>('SELECT badge_key FROM hb_badges');
  return new Set(rows.map((r: Record<string, unknown>) => r.badge_key as string));
}

export function dismissBadge(db: DatabaseAdapter, id: string): void {
  db.execute('UPDATE hb_badges SET dismissed = 1 WHERE id = ?', [id]);
}

export function deleteBadge(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM hb_badges WHERE id = ?', [id]);
}

function mapBadge(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    badgeKey: row.badge_key as string,
    habitId: (row.habit_id as string) ?? null,
    unlockedAt: row.unlocked_at as string,
    dismissed: (row.dismissed as number) === 1,
    createdAt: row.created_at as string,
  };
}
