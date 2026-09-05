import type { DatabaseAdapter } from '@mylife/db';
import type { SobrietyProfile, SobrietyPledge } from '../types';

// ── Row mappers ──────────────────────────────────────────────────────────

function rowToProfile(row: Record<string, unknown>): SobrietyProfile {
  return {
    id: row.id as string,
    habitId: row.habit_id as string,
    quitDate: row.quit_date as string,
    dailyCost: row.daily_cost as number,
    currency: row.currency as string,
    motivation: (row.motivation as string) ?? null,
    isActive: !!(row.is_active as number),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToPledge(row: Record<string, unknown>): SobrietyPledge {
  return {
    id: row.id as string,
    profileId: row.profile_id as string,
    pledgedOn: row.pledged_on as string,
    fulfilled: !!(row.fulfilled as number),
    createdAt: row.created_at as string,
  };
}

// ── Sobriety Profiles ───────────────────────────────────────────────────

export interface CreateSobrietyProfileInput {
  quitDate: string;
  dailyCost: number;
  currency?: string;
  motivation?: string;
}

export function createSobrietyProfile(
  db: DatabaseAdapter,
  id: string,
  habitId: string,
  input: CreateSobrietyProfileInput,
): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO hb_sobriety_profiles (id, habit_id, quit_date, daily_cost, currency, motivation, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, habitId, input.quitDate, input.dailyCost, input.currency ?? 'USD', input.motivation ?? null, now, now],
  );
}

export function getSobrietyProfile(db: DatabaseAdapter, habitId: string): SobrietyProfile | null {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM hb_sobriety_profiles WHERE habit_id = ? AND is_active = 1',
    [habitId],
  );
  return rows.length > 0 ? rowToProfile(rows[0]) : null;
}

export function getAllSobrietyProfiles(db: DatabaseAdapter): SobrietyProfile[] {
  return db.query<Record<string, unknown>>(
    'SELECT * FROM hb_sobriety_profiles WHERE is_active = 1',
  ).map(rowToProfile);
}

export function updateSobrietyProfile(
  db: DatabaseAdapter,
  id: string,
  updates: Partial<CreateSobrietyProfileInput>,
): void {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (updates.quitDate !== undefined) { sets.push('quit_date = ?'); params.push(updates.quitDate); }
  if (updates.dailyCost !== undefined) { sets.push('daily_cost = ?'); params.push(updates.dailyCost); }
  if (updates.currency !== undefined) { sets.push('currency = ?'); params.push(updates.currency); }
  if (updates.motivation !== undefined) { sets.push('motivation = ?'); params.push(updates.motivation); }
  if (sets.length === 0) return;
  sets.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(id);
  db.execute(`UPDATE hb_sobriety_profiles SET ${sets.join(', ')} WHERE id = ?`, params);
}

export function deleteSobrietyProfile(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM hb_sobriety_profiles WHERE id = ?', [id]);
}

// ── Pledges ─────────────────────────────────────────────────────────────

export function createPledge(
  db: DatabaseAdapter,
  id: string,
  profileId: string,
  pledgedOn: string,
): void {
  db.execute(
    `INSERT OR IGNORE INTO hb_sobriety_pledges (id, profile_id, pledged_on) VALUES (?, ?, ?)`,
    [id, profileId, pledgedOn],
  );
}

export function getPledgeForDate(db: DatabaseAdapter, profileId: string, date: string): SobrietyPledge | null {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM hb_sobriety_pledges WHERE profile_id = ? AND pledged_on = ?',
    [profileId, date],
  );
  return rows.length > 0 ? rowToPledge(rows[0]) : null;
}

export function getRecentPledgeDates(db: DatabaseAdapter, profileId: string, limit: number = 30): string[] {
  const rows = db.query<{ pledged_on: string }>(
    'SELECT pledged_on FROM hb_sobriety_pledges WHERE profile_id = ? ORDER BY pledged_on DESC LIMIT ?',
    [profileId, limit],
  );
  return rows.map((r) => r.pledged_on);
}

/** Get slip dates for a habit (completions with value = -1). */
export function getSlipDates(db: DatabaseAdapter, habitId: string): string[] {
  const rows = db.query<{ d: string }>(
    `SELECT DISTINCT DATE(completed_at) as d FROM hb_completions WHERE habit_id = ? AND value = -1 ORDER BY d ASC`,
    [habitId],
  );
  return rows.map((r) => r.d);
}
