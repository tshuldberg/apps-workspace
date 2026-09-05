import type { DatabaseAdapter } from '@mylife/db';
import type {
  Plant,
  GardenEntry,
  GardenZone,
  Seed,
  GardenSetting,
  CreatePlantInput,
  UpdatePlantInput,
  CreateEntryInput,
  CreateZoneInput,
  CreateSeedInput,
  PlantFilter,
  GardenStats,
  WateringScheduleItem,
} from '../types';
import { CreatePlantInputSchema, PlantFilterSchema } from '../types';
import { calculateNextWaterDate, isDaysOverdue } from '../engine/watering';

// ── Helpers ────────────────────────────────────────────────────────────

function nowIso(): string {
  return new Date().toISOString();
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function rowToPlant(row: Record<string, unknown>): Plant {
  return {
    id: row.id as string,
    name: row.name as string,
    species: (row.species as string) ?? null,
    location: row.location as Plant['location'],
    zone: (row.zone as string) ?? null,
    imageUri: (row.image_uri as string) ?? null,
    waterFrequencyDays: (row.water_frequency_days as number) ?? null,
    lastWatered: (row.last_watered as string) ?? null,
    status: row.status as Plant['status'],
    acquiredDate: (row.acquired_date as string) ?? null,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToEntry(row: Record<string, unknown>): GardenEntry {
  return {
    id: row.id as string,
    plantId: (row.plant_id as string) ?? null,
    date: row.date as string,
    action: row.action as GardenEntry['action'],
    notes: (row.notes as string) ?? null,
    imageUri: (row.image_uri as string) ?? null,
    quantityGrams: (row.quantity_grams as number) ?? null,
    createdAt: row.created_at as string,
  };
}

function rowToZone(row: Record<string, unknown>): GardenZone {
  return {
    id: row.id as string,
    name: row.name as string,
    location: row.location as GardenZone['location'],
    description: (row.description as string) ?? null,
    sortOrder: row.sort_order as number,
    createdAt: row.created_at as string,
  };
}

function rowToSeed(row: Record<string, unknown>): Seed {
  return {
    id: row.id as string,
    name: row.name as string,
    species: (row.species as string) ?? null,
    quantity: row.quantity as number,
    source: (row.source as string) ?? null,
    purchasedDate: (row.purchased_date as string) ?? null,
    expiryDate: (row.expiry_date as string) ?? null,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
  };
}

// ── Plants CRUD ────────────────────────────────────────────────────────

export function createPlant(
  db: DatabaseAdapter,
  id: string,
  rawInput: CreatePlantInput,
): Plant {
  const input = CreatePlantInputSchema.parse(rawInput);
  const now = nowIso();

  db.execute(
    `INSERT INTO gd_plants (id, name, species, location, zone, image_uri, water_frequency_days, status, acquired_date, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.name, input.species, input.location, input.zone, input.imageUri, input.waterFrequencyDays, input.status, input.acquiredDate, input.notes, now, now],
  );

  return {
    id,
    name: input.name,
    species: input.species ?? null,
    location: input.location ?? 'indoor',
    zone: input.zone ?? null,
    imageUri: input.imageUri ?? null,
    waterFrequencyDays: input.waterFrequencyDays ?? null,
    lastWatered: null,
    status: input.status ?? 'healthy',
    acquiredDate: input.acquiredDate ?? null,
    notes: input.notes ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

export function getPlantById(db: DatabaseAdapter, id: string): Plant | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM gd_plants WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rowToPlant(rows[0]) : null;
}

export function getPlants(db: DatabaseAdapter, rawFilter?: PlantFilter): Plant[] {
  const filter = PlantFilterSchema.parse(rawFilter ?? {});
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter.location) { conditions.push('location = ?'); params.push(filter.location); }
  if (filter.status) { conditions.push('status = ?'); params.push(filter.status); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM gd_plants ${where} ORDER BY name ASC LIMIT ? OFFSET ?`,
    [...params, filter.limit, filter.offset],
  );
  return rows.map(rowToPlant);
}

export function updatePlant(
  db: DatabaseAdapter,
  id: string,
  input: UpdatePlantInput,
): Plant | null {
  const existing = getPlantById(db, id);
  if (!existing) return null;

  const now = nowIso();
  const updates: string[] = ['updated_at = ?'];
  const params: unknown[] = [now];

  if (input.name !== undefined) { updates.push('name = ?'); params.push(input.name); }
  if (input.species !== undefined) { updates.push('species = ?'); params.push(input.species); }
  if (input.location !== undefined) { updates.push('location = ?'); params.push(input.location); }
  if (input.zone !== undefined) { updates.push('zone = ?'); params.push(input.zone); }
  if (input.imageUri !== undefined) { updates.push('image_uri = ?'); params.push(input.imageUri); }
  if (input.waterFrequencyDays !== undefined) { updates.push('water_frequency_days = ?'); params.push(input.waterFrequencyDays); }
  if (input.lastWatered !== undefined) { updates.push('last_watered = ?'); params.push(input.lastWatered); }
  if (input.status !== undefined) { updates.push('status = ?'); params.push(input.status); }
  if (input.acquiredDate !== undefined) { updates.push('acquired_date = ?'); params.push(input.acquiredDate); }
  if (input.notes !== undefined) { updates.push('notes = ?'); params.push(input.notes); }

  params.push(id);
  db.execute(`UPDATE gd_plants SET ${updates.join(', ')} WHERE id = ?`, params);
  return getPlantById(db, id);
}

export function deletePlant(db: DatabaseAdapter, id: string): boolean {
  db.execute(`DELETE FROM gd_plants WHERE id = ?`, [id]);
  return true;
}

export function getPlantCount(db: DatabaseAdapter): number {
  const rows = db.query<{ count: number }>(`SELECT COUNT(*) as count FROM gd_plants`);
  return rows[0].count;
}

export function waterPlant(db: DatabaseAdapter, plantId: string): void {
  const now = nowIso();
  const today = todayDate();
  db.transaction(() => {
    db.execute(
      `UPDATE gd_plants SET last_watered = ?, updated_at = ? WHERE id = ?`,
      [now, now, plantId],
    );
    db.execute(
      `INSERT INTO gd_entries (id, plant_id, date, action, created_at)
       VALUES (?, ?, ?, 'water', ?)`,
      [crypto.randomUUID(), plantId, today, now],
    );
  });
}

// ── Garden Entries ─────────────────────────────────────────────────────

export function createEntry(
  db: DatabaseAdapter,
  id: string,
  input: CreateEntryInput,
): GardenEntry {
  const now = nowIso();
  const date = input.date ?? todayDate();

  const insertAndUpdate = () => {
    db.execute(
      `INSERT INTO gd_entries (id, plant_id, date, action, notes, image_uri, quantity_grams, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, input.plantId, date, input.action, input.notes ?? null, input.imageUri ?? null, input.quantityGrams ?? null, now],
    );

    // Auto-update last_watered when logging a water action
    if (input.action === 'water' && input.plantId) {
      db.execute(
        `UPDATE gd_plants SET last_watered = ?, updated_at = ? WHERE id = ?`,
        [now, now, input.plantId],
      );
    }
  };

  // Wrap in transaction when water action updates both entry and plant
  if (input.action === 'water' && input.plantId) {
    db.transaction(insertAndUpdate);
  } else {
    insertAndUpdate();
  }

  return {
    id,
    plantId: input.plantId ?? null,
    date,
    action: input.action,
    notes: input.notes ?? null,
    imageUri: input.imageUri ?? null,
    quantityGrams: input.quantityGrams ?? null,
    createdAt: now,
  };
}

export function getEntriesForPlant(
  db: DatabaseAdapter,
  plantId: string,
  limit = 50,
): GardenEntry[] {
  return db.query<Record<string, unknown>>(
    `SELECT * FROM gd_entries WHERE plant_id = ? ORDER BY date DESC, created_at DESC LIMIT ?`,
    [plantId, limit],
  ).map(rowToEntry);
}

export function getEntriesByDate(
  db: DatabaseAdapter,
  startDate: string,
  endDate: string,
): GardenEntry[] {
  return db.query<Record<string, unknown>>(
    `SELECT * FROM gd_entries WHERE date >= ? AND date <= ? ORDER BY date DESC, created_at DESC`,
    [startDate, endDate],
  ).map(rowToEntry);
}

export function deleteEntry(db: DatabaseAdapter, id: string): boolean {
  db.execute(`DELETE FROM gd_entries WHERE id = ?`, [id]);
  return true;
}

// ── Zones CRUD ─────────────────────────────────────────────────────────

export function createZone(
  db: DatabaseAdapter,
  id: string,
  input: CreateZoneInput,
): GardenZone {
  const now = nowIso();
  db.execute(
    `INSERT INTO gd_zones (id, name, location, description, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, input.name, input.location ?? 'indoor', input.description ?? null, input.sortOrder ?? 0, now],
  );
  return {
    id,
    name: input.name,
    location: input.location ?? 'indoor',
    description: input.description ?? null,
    sortOrder: input.sortOrder ?? 0,
    createdAt: now,
  };
}

export function getZones(db: DatabaseAdapter): GardenZone[] {
  return db.query<Record<string, unknown>>(
    `SELECT * FROM gd_zones ORDER BY sort_order ASC, name ASC`,
  ).map(rowToZone);
}

export function deleteZone(db: DatabaseAdapter, id: string): boolean {
  db.execute(`DELETE FROM gd_zones WHERE id = ?`, [id]);
  return true;
}

// ── Seeds CRUD ─────────────────────────────────────────────────────────

export function createSeed(
  db: DatabaseAdapter,
  id: string,
  input: CreateSeedInput,
): Seed {
  const now = nowIso();
  db.execute(
    `INSERT INTO gd_seeds (id, name, species, quantity, source, purchased_date, expiry_date, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.name, input.species ?? null, input.quantity ?? 0, input.source ?? null, input.purchasedDate ?? null, input.expiryDate ?? null, input.notes ?? null, now],
  );
  return {
    id,
    name: input.name,
    species: input.species ?? null,
    quantity: input.quantity ?? 0,
    source: input.source ?? null,
    purchasedDate: input.purchasedDate ?? null,
    expiryDate: input.expiryDate ?? null,
    notes: input.notes ?? null,
    createdAt: now,
  };
}

export function getSeeds(db: DatabaseAdapter): Seed[] {
  return db.query<Record<string, unknown>>(
    `SELECT * FROM gd_seeds ORDER BY name ASC`,
  ).map(rowToSeed);
}

export function updateSeedQuantity(db: DatabaseAdapter, id: string, quantity: number): void {
  db.execute(`UPDATE gd_seeds SET quantity = ? WHERE id = ?`, [quantity, id]);
}

export function deleteSeed(db: DatabaseAdapter, id: string): boolean {
  db.execute(`DELETE FROM gd_seeds WHERE id = ?`, [id]);
  return true;
}

// ── Settings ───────────────────────────────────────────────────────────

export function getSetting(db: DatabaseAdapter, key: string): string | null {
  const rows = db.query<GardenSetting>(
    `SELECT * FROM gd_settings WHERE key = ?`,
    [key],
  );
  return rows.length > 0 ? rows[0].value : null;
}

export function setSetting(db: DatabaseAdapter, key: string, value: string): void {
  db.execute(
    `INSERT INTO gd_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}

// ── Analytics ──────────────────────────────────────────────────────────

export function getGardenStats(db: DatabaseAdapter): GardenStats {
  const plants = db.query<{
    total: number;
    healthy: number;
    needs_attention: number;
    dormant: number;
    dead: number;
  }>(
    `SELECT COUNT(*) as total,
       SUM(CASE WHEN status = 'healthy' THEN 1 ELSE 0 END) as healthy,
       SUM(CASE WHEN status = 'needs_attention' THEN 1 ELSE 0 END) as needs_attention,
       SUM(CASE WHEN status = 'dormant' THEN 1 ELSE 0 END) as dormant,
       SUM(CASE WHEN status = 'dead' THEN 1 ELSE 0 END) as dead
     FROM gd_plants`,
  );

  const harvest = db.query<{ total_grams: number }>(
    `SELECT COALESCE(SUM(quantity_grams), 0) as total_grams
     FROM gd_entries WHERE action = 'harvest'`,
  );

  const entries = db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM gd_entries`,
  );

  // Overdue watering: plants with water_frequency_days set and last_watered older than frequency
  const today = todayDate();
  const overdue = db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM gd_plants
     WHERE water_frequency_days IS NOT NULL
       AND status != 'dead'
       AND (last_watered IS NULL
         OR julianday(?) - julianday(last_watered) > water_frequency_days)`,
    [today],
  );

  return {
    totalPlants: plants[0].total,
    healthyCount: plants[0].healthy,
    needsAttentionCount: plants[0].needs_attention,
    dormantCount: plants[0].dormant,
    deadCount: plants[0].dead,
    totalHarvestGrams: harvest[0].total_grams,
    totalEntries: entries[0].count,
    overdueWateringCount: overdue[0].count,
  };
}

export function getWateringSchedule(db: DatabaseAdapter): WateringScheduleItem[] {
  const today = todayDate();
  const rows = db.query<Record<string, unknown>>(
    `SELECT id, name, last_watered, water_frequency_days
     FROM gd_plants
     WHERE water_frequency_days IS NOT NULL AND status != 'dead'
     ORDER BY
       CASE WHEN last_watered IS NULL THEN 0
            ELSE julianday(last_watered) + water_frequency_days - julianday(?)
       END ASC`,
    [today],
  );

  return rows.map((r) => {
    const lastWatered = (r.last_watered as string) ?? null;
    const freq = r.water_frequency_days as number;
    const nextDate = lastWatered ? calculateNextWaterDate(lastWatered, freq) : null;
    const overdue = isDaysOverdue(lastWatered, freq, today);

    return {
      plantId: r.id as string,
      plantName: r.name as string,
      lastWatered,
      frequencyDays: freq,
      nextWaterDate: nextDate,
      isOverdue: overdue > 0,
      daysOverdue: overdue,
    };
  });
}
