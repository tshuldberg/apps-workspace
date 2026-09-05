import type { DatabaseAdapter } from '@mylife/db';
import { buildLevelHistory } from '../rpg/engine';

export function getPlayerProfile(db: DatabaseAdapter) {
  const rows = db.query<Record<string, unknown>>('SELECT * FROM hb_player_profile WHERE id = ?', ['player']);
  return rows.length > 0 ? mapProfile(rows[0]) : null;
}

export function ensurePlayerProfile(db: DatabaseAdapter): void {
  db.execute(`INSERT OR IGNORE INTO hb_player_profile (id) VALUES ('player')`);
}

export function updatePlayerXP(db: DatabaseAdapter, totalXP: number, currentLevel: number): void {
  const now = new Date().toISOString();
  db.execute(
    "UPDATE hb_player_profile SET total_xp = ?, current_level = ?, updated_at = ? WHERE id = 'player'",
    [totalXP, currentLevel, now],
  );
}

export function setGamificationEnabled(db: DatabaseAdapter, enabled: boolean): void {
  const now = new Date().toISOString();
  db.execute(
    "UPDATE hb_player_profile SET gamification_enabled = ?, updated_at = ? WHERE id = 'player'",
    [enabled ? 1 : 0, now],
  );
}

export function createXPTransaction(db: DatabaseAdapter, id: string, amount: number, source: string, habitId: string | null): void {
  db.execute(
    `INSERT INTO hb_xp_transactions (id, amount, source, habit_id) VALUES (?, ?, ?, ?)`,
    [id, amount, source, habitId],
  );
}

export function getXPTransactions(db: DatabaseAdapter, limit: number = 50) {
  return db.query<Record<string, unknown>>(
    'SELECT * FROM hb_xp_transactions ORDER BY earned_at DESC LIMIT ?',
    [limit],
  ).map(mapTransaction);
}

export function getXPTransactionsForHabit(db: DatabaseAdapter, habitId: string) {
  return db.query<Record<string, unknown>>(
    'SELECT * FROM hb_xp_transactions WHERE habit_id = ? ORDER BY earned_at DESC',
    [habitId],
  ).map(mapTransaction);
}

export function getLevelHistory(db: DatabaseAdapter, limit: number = 12) {
  const transactions = db.query<Record<string, unknown>>(
    'SELECT * FROM hb_xp_transactions ORDER BY earned_at ASC, created_at ASC',
  ).map(mapTransaction);

  return buildLevelHistory(transactions).slice(0, limit);
}

function mapProfile(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    totalXP: row.total_xp as number,
    currentLevel: row.current_level as number,
    gamificationEnabled: (row.gamification_enabled as number) === 1,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapTransaction(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    amount: row.amount as number,
    source: row.source as string,
    habitId: (row.habit_id as string) ?? null,
    earnedAt: row.earned_at as string,
    createdAt: row.created_at as string,
  };
}
