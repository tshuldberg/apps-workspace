/**
 * Challenge CRUD operations.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { Challenge, ChallengeInsert } from '../models/schemas';

export function createChallenge(
  db: DatabaseAdapter,
  id: string,
  input: ChallengeInsert,
): Challenge {
  const now = new Date().toISOString();
  const challenge: Challenge = {
    id,
    name: input.name,
    description: input.description ?? null,
    challenge_type: input.challenge_type,
    target_value: input.target_value,
    target_unit: input.target_unit,
    time_frame: input.time_frame,
    start_date: input.start_date,
    end_date: input.end_date,
    theme_prompt: input.theme_prompt ?? null,
    is_active: input.is_active ?? 1,
    created_at: now,
    updated_at: now,
  };

  db.execute(
    `INSERT INTO bk_challenges (id, name, description, challenge_type, target_value, target_unit,
       time_frame, start_date, end_date, theme_prompt, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      challenge.id, challenge.name, challenge.description, challenge.challenge_type,
      challenge.target_value, challenge.target_unit, challenge.time_frame,
      challenge.start_date, challenge.end_date, challenge.theme_prompt,
      challenge.is_active, challenge.created_at, challenge.updated_at,
    ],
  );

  return challenge;
}

export function getChallenge(db: DatabaseAdapter, id: string): Challenge | null {
  const rows = db.query<Challenge>(
    `SELECT * FROM bk_challenges WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rows[0] : null;
}

export function getActiveChallenges(db: DatabaseAdapter): Challenge[] {
  return db.query<Challenge>(
    `SELECT * FROM bk_challenges WHERE is_active = 1 ORDER BY start_date`,
  );
}

export function getAllChallenges(db: DatabaseAdapter): Challenge[] {
  return db.query<Challenge>(
    `SELECT * FROM bk_challenges ORDER BY created_at DESC`,
  );
}

export function updateChallenge(
  db: DatabaseAdapter,
  id: string,
  updates: Partial<Pick<Challenge, 'name' | 'description' | 'target_value' | 'end_date' | 'theme_prompt'>>,
): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.description !== undefined) {
    fields.push('description = ?');
    values.push(updates.description);
  }
  if (updates.target_value !== undefined) {
    fields.push('target_value = ?');
    values.push(updates.target_value);
  }
  if (updates.end_date !== undefined) {
    fields.push('end_date = ?');
    values.push(updates.end_date);
  }
  if (updates.theme_prompt !== undefined) {
    fields.push('theme_prompt = ?');
    values.push(updates.theme_prompt);
  }

  if (fields.length === 0) return;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.execute(
    `UPDATE bk_challenges SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}

export function deactivateChallenge(db: DatabaseAdapter, id: string): void {
  db.execute(
    `UPDATE bk_challenges SET is_active = 0, updated_at = ? WHERE id = ?`,
    [new Date().toISOString(), id],
  );
}

export function deleteChallenge(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM bk_challenges WHERE id = ?`, [id]);
}
