import type { DatabaseAdapter } from '@mylife/db';
import type { Pet, PetActivity, PetActivityType } from '../types';

function nowIso(): string {
  return new Date().toISOString();
}

function rowToPet(row: Record<string, unknown>): Pet {
  return {
    id: row.id as string,
    name: row.name as string,
    species: row.species as string,
    evolutionStage: row.evolution_stage as number,
    happiness: row.happiness as number,
    experience: row.experience as number,
    totalFeeds: row.total_feeds as number,
    streakBonus: row.streak_bonus as number,
    lastFedAt: (row.last_fed_at as string) ?? null,
    hatchedAt: (row.hatched_at as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToPetActivity(row: Record<string, unknown>): PetActivity {
  return {
    id: row.id as string,
    activityType: row.activity_type as PetActivityType,
    happinessDelta: row.happiness_delta as number,
    experienceDelta: row.experience_delta as number,
    sourceModule: (row.source_module as string) ?? null,
    createdAt: row.created_at as string,
  };
}

export function getPet(db: DatabaseAdapter): Pet | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM mo_pet WHERE id = 'singleton'`,
  );
  return rows.length > 0 ? rowToPet(rows[0]) : null;
}

export function createPet(db: DatabaseAdapter, name = 'Buddy'): Pet {
  const now = nowIso();
  db.execute(
    `INSERT OR IGNORE INTO mo_pet (id, name, created_at, updated_at)
     VALUES ('singleton', ?, ?, ?)`,
    [name, now, now],
  );
  return getPet(db)!;
}

export function updatePetStats(
  db: DatabaseAdapter,
  happiness: number,
  experience: number,
  evolutionStage: number,
  totalFeeds: number,
  hatchedAt?: string | null,
): void {
  const now = nowIso();
  const fields = [
    'happiness = ?',
    'experience = ?',
    'evolution_stage = ?',
    'total_feeds = ?',
    'last_fed_at = ?',
    'updated_at = ?',
  ];
  const params: unknown[] = [happiness, experience, evolutionStage, totalFeeds, now, now];
  if (hatchedAt !== undefined) {
    fields.push('hatched_at = ?');
    params.push(hatchedAt);
  }
  params.push('singleton');
  db.execute(
    `UPDATE mo_pet SET ${fields.join(', ')} WHERE id = ?`,
    params,
  );
}

export function renamePet(db: DatabaseAdapter, name: string): void {
  const now = nowIso();
  db.execute(
    `UPDATE mo_pet SET name = ?, updated_at = ? WHERE id = 'singleton'`,
    [name, now],
  );
}

export function createPetActivity(
  db: DatabaseAdapter,
  id: string,
  activityType: PetActivityType,
  happinessDelta: number,
  experienceDelta: number,
  sourceModule?: string,
): PetActivity {
  const now = nowIso();
  db.execute(
    `INSERT INTO mo_pet_activities (id, activity_type, happiness_delta, experience_delta, source_module, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, activityType, happinessDelta, experienceDelta, sourceModule ?? null, now],
  );
  return {
    id,
    activityType,
    happinessDelta,
    experienceDelta,
    sourceModule: sourceModule ?? null,
    createdAt: now,
  };
}

export function getPetActivities(db: DatabaseAdapter, limit = 50): PetActivity[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM mo_pet_activities ORDER BY created_at DESC LIMIT ?`,
    [limit],
  );
  return rows.map(rowToPetActivity);
}

export function getPetActivitiesToday(db: DatabaseAdapter, type: PetActivityType, todayDate: string): number {
  const rows = db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM mo_pet_activities WHERE activity_type = ? AND created_at >= ? AND created_at < date(?, '+1 day')`,
    [type, todayDate, todayDate],
  );
  return rows[0].count;
}
