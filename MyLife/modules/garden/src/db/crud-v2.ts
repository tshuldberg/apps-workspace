import type { DatabaseAdapter } from '@mylife/db';
import type {
  Identification, SeasonalTask, HarvestRecord, Diagnosis, WishListItem,
  Propagation, LightReading, Layout, LayoutItem, FrostConfig,
  CreateHarvestInput, CreateDiagnosisInput, CreateWishListInput,
  CreatePropagationInput, CreateLightReadingInput, CreateLayoutInput,
  CreateLayoutItemInput, UpdateZoneInput, HarvestStats, ZoneStats,
  PropagationStats, GardenZone, TreatmentStatus, PropagationStage,
} from '../types';
import { CreateHarvestInputSchema } from '../types';
import { classifyLight } from '../engine/light';

function nowIso(): string { return new Date().toISOString(); }
function todayDate(): string { return new Date().toISOString().slice(0, 10); }

// ── Zone V2 Operations ──────────────────────────────────────────────────

export function updateZone(db: DatabaseAdapter, id: string, input: UpdateZoneInput): GardenZone | null {
  const rows = db.query<Record<string, unknown>>('SELECT * FROM gd_zones WHERE id = ?', [id]);
  if (rows.length === 0) return null;

  const now = nowIso();
  const updates: string[] = ['updated_at = ?'];
  const params: unknown[] = [now];

  if (input.name !== undefined) { updates.push('name = ?'); params.push(input.name); }
  if (input.location !== undefined) { updates.push('location = ?'); params.push(input.location); }
  if (input.description !== undefined) { updates.push('description = ?'); params.push(input.description); }
  if (input.sortOrder !== undefined) { updates.push('sort_order = ?'); params.push(input.sortOrder); }
  if (input.zoneType !== undefined) { updates.push('zone_type = ?'); params.push(input.zoneType); }
  if (input.icon !== undefined) { updates.push('icon = ?'); params.push(input.icon); }
  if (input.color !== undefined) { updates.push('color = ?'); params.push(input.color); }
  if (input.photoUri !== undefined) { updates.push('photo_uri = ?'); params.push(input.photoUri); }
  if (input.lightLevel !== undefined) { updates.push('light_level = ?'); params.push(input.lightLevel); }
  if (input.humidity !== undefined) { updates.push('humidity = ?'); params.push(input.humidity); }
  if (input.temperatureNotes !== undefined) { updates.push('temperature_notes = ?'); params.push(input.temperatureNotes); }

  params.push(id);
  db.execute(`UPDATE gd_zones SET ${updates.join(', ')} WHERE id = ?`, params);

  const updated = db.query<Record<string, unknown>>('SELECT * FROM gd_zones WHERE id = ?', [id]);
  if (updated.length === 0) return null;
  const r = updated[0];
  return {
    id: r.id as string,
    name: r.name as string,
    location: r.location as GardenZone['location'],
    description: (r.description as string) ?? null,
    sortOrder: r.sort_order as number,
    createdAt: r.created_at as string,
  };
}

export function getZoneStats(db: DatabaseAdapter, zoneId: string): ZoneStats {
  const zone = db.query<{ name: string }>('SELECT name FROM gd_zones WHERE id = ?', [zoneId]);
  const today = todayDate();
  const stats = db.query<{ total: number; healthy: number; needs_attention: number }>(
    `SELECT COUNT(*) as total,
       SUM(CASE WHEN status = 'healthy' THEN 1 ELSE 0 END) as healthy,
       SUM(CASE WHEN status = 'needs_attention' THEN 1 ELSE 0 END) as needs_attention
     FROM gd_plants WHERE zone = ?`,
    [zoneId],
  );
  const overdue = db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM gd_plants
     WHERE zone = ? AND water_frequency_days IS NOT NULL AND status != 'dead'
       AND (last_watered IS NULL OR julianday(?) - julianday(last_watered) > water_frequency_days)`,
    [zoneId, today],
  );
  return {
    zoneId,
    zoneName: zone.length > 0 ? zone[0].name : '',
    plantCount: stats[0].total,
    healthyCount: stats[0].healthy,
    needsAttentionCount: stats[0].needs_attention,
    overdueCount: overdue[0].count,
  };
}

// ── Identification CRUD ─────────────────────────────────────────────────

export function createIdentification(db: DatabaseAdapter, id: string, data: {
  plantId?: string | null; imageUri: string; topSpecies?: string | null;
  topCommonName?: string | null; topConfidence?: number | null;
  allResultsJson?: string | null; source?: string;
}): Identification {
  const now = nowIso();
  db.execute(
    `INSERT INTO gd_identifications (id, plant_id, image_uri, top_species, top_common_name, top_confidence, all_results_json, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.plantId ?? null, data.imageUri, data.topSpecies ?? null, data.topCommonName ?? null,
     data.topConfidence ?? null, data.allResultsJson ?? null, data.source ?? 'on_device', now],
  );
  return {
    id, plantId: data.plantId ?? null, imageUri: data.imageUri,
    topSpecies: data.topSpecies ?? null, topCommonName: data.topCommonName ?? null,
    topConfidence: data.topConfidence ?? null, allResultsJson: data.allResultsJson ?? null,
    source: data.source ?? 'on_device', createdAt: now,
  };
}

export function getIdentificationsForPlant(db: DatabaseAdapter, plantId: string): Identification[] {
  return db.query<Record<string, unknown>>(
    'SELECT * FROM gd_identifications WHERE plant_id = ? ORDER BY created_at DESC', [plantId],
  ).map(rowToIdentification);
}

// ── Seasonal Task CRUD ──────────────────────────────────────────────────

export function createSeasonalTask(db: DatabaseAdapter, id: string, data: {
  plantId?: string | null; season: string; taskType: string;
  description?: string | null; dueMonth?: number | null;
}): SeasonalTask {
  const now = nowIso();
  db.execute(
    `INSERT INTO gd_seasonal_tasks (id, plant_id, season, task_type, description, due_month, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, data.plantId ?? null, data.season, data.taskType, data.description ?? null, data.dueMonth ?? null, now],
  );
  return {
    id, plantId: data.plantId ?? null, season: data.season as SeasonalTask['season'],
    taskType: data.taskType as SeasonalTask['taskType'], description: data.description ?? null,
    dueMonth: data.dueMonth ?? null, completedAt: null, snoozedUntil: null, createdAt: now,
  };
}

export function completeSeasonalTask(db: DatabaseAdapter, id: string): void {
  db.execute('UPDATE gd_seasonal_tasks SET completed_at = ? WHERE id = ?', [nowIso(), id]);
}

export function snoozeSeasonalTask(db: DatabaseAdapter, id: string, until: string): void {
  db.execute('UPDATE gd_seasonal_tasks SET snoozed_until = ? WHERE id = ?', [until, id]);
}

export function getPendingSeasonalTasks(db: DatabaseAdapter, season?: string): SeasonalTask[] {
  const today = todayDate();
  let sql = `SELECT * FROM gd_seasonal_tasks WHERE completed_at IS NULL AND (snoozed_until IS NULL OR snoozed_until <= ?)`;
  const params: unknown[] = [today];
  if (season) { sql += ' AND season = ?'; params.push(season); }
  sql += ' ORDER BY due_month ASC, created_at ASC';
  return db.query<Record<string, unknown>>(sql, params).map(rowToSeasonalTask);
}

// ── Harvest CRUD ────────────────────────────────────────────────────────

export function createHarvest(db: DatabaseAdapter, id: string, rawInput: CreateHarvestInput): HarvestRecord {
  const input = CreateHarvestInputSchema.parse(rawInput);
  const now = nowIso();
  const date = input.date ?? todayDate();
  db.execute(
    `INSERT INTO gd_harvests (id, plant_id, date, quantity, unit, crop_type, quality_rating, image_uri, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.plantId, date, input.quantity, input.unit ?? 'grams',
     input.cropType ?? null, input.qualityRating ?? null, input.imageUri ?? null, input.notes ?? null, now],
  );
  return {
    id, plantId: input.plantId, date, quantity: input.quantity,
    unit: (input.unit ?? 'grams') as HarvestRecord['unit'],
    cropType: input.cropType ?? null, qualityRating: input.qualityRating ?? null,
    imageUri: input.imageUri ?? null, notes: input.notes ?? null, createdAt: now,
  };
}

export function getHarvests(db: DatabaseAdapter, filters?: { plantId?: string; cropType?: string; startDate?: string; endDate?: string }): HarvestRecord[] {
  const conds: string[] = [];
  const params: unknown[] = [];
  if (filters?.plantId) { conds.push('plant_id = ?'); params.push(filters.plantId); }
  if (filters?.cropType) { conds.push('crop_type = ?'); params.push(filters.cropType); }
  if (filters?.startDate) { conds.push('date >= ?'); params.push(filters.startDate); }
  if (filters?.endDate) { conds.push('date <= ?'); params.push(filters.endDate); }
  const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';
  return db.query<Record<string, unknown>>(`SELECT * FROM gd_harvests ${where} ORDER BY date DESC`, params).map(rowToHarvest);
}

export function getHarvestStats(db: DatabaseAdapter, year?: number): HarvestStats {
  const yearStr = year ?? new Date().getFullYear();
  const start = `${yearStr}-01-01`;
  const end = `${yearStr}-12-31`;
  const totals = db.query<{ total_qty: number; total_count: number }>(
    `SELECT COALESCE(SUM(quantity), 0) as total_qty, COUNT(*) as total_count FROM gd_harvests WHERE date >= ? AND date <= ?`,
    [start, end],
  );
  const top = db.query<{ plant_id: string; total: number }>(
    `SELECT plant_id, SUM(quantity) as total FROM gd_harvests WHERE date >= ? AND date <= ? GROUP BY plant_id ORDER BY total DESC LIMIT 1`,
    [start, end],
  );
  let topProducer: HarvestStats['topProducer'] = null;
  if (top.length > 0) {
    const plant = db.query<{ name: string }>('SELECT name FROM gd_plants WHERE id = ?', [top[0].plant_id]);
    topProducer = { plantId: top[0].plant_id, plantName: plant.length > 0 ? plant[0].name : 'Unknown', total: top[0].total };
  }
  return { totalQuantity: totals[0].total_qty, totalHarvests: totals[0].total_count, topProducer };
}

export function getCropTypes(db: DatabaseAdapter): string[] {
  return db.query<{ crop_type: string }>(
    `SELECT DISTINCT crop_type FROM gd_harvests WHERE crop_type IS NOT NULL ORDER BY crop_type`,
  ).map((r) => r.crop_type);
}

// ── Diagnosis CRUD ──────────────────────────────────────────────────────

export function createDiagnosis(db: DatabaseAdapter, id: string, input: CreateDiagnosisInput): Diagnosis {
  const now = nowIso();
  const date = input.diagnosedDate ?? todayDate();
  const symptomsJson = JSON.stringify(input.symptoms);
  db.execute(
    `INSERT INTO gd_diagnoses (id, plant_id, diagnosed_date, type, symptoms_json, diagnosis_name, diagnosis_confidence, severity, treatment_notes, image_uri, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.plantId ?? null, date, input.type, symptomsJson,
     input.diagnosisName ?? null, input.diagnosisConfidence ?? null,
     input.severity ?? 'moderate', input.treatmentNotes ?? null, input.imageUri ?? null, now, now],
  );
  return {
    id, plantId: input.plantId ?? null, diagnosedDate: date,
    type: input.type as Diagnosis['type'], symptomsJson, diagnosisName: input.diagnosisName ?? null,
    diagnosisConfidence: input.diagnosisConfidence ?? null, severity: (input.severity ?? 'moderate') as Diagnosis['severity'],
    treatmentNotes: input.treatmentNotes ?? null, treatmentStatus: 'pending',
    imageUri: input.imageUri ?? null, resolvedDate: null, createdAt: now, updatedAt: now,
  };
}

export function updateDiagnosisStatus(db: DatabaseAdapter, id: string, status: TreatmentStatus): void {
  const now = nowIso();
  const resolvedDate = (status === 'resolved' || status === 'unresolvable') ? todayDate() : null;
  db.execute(
    `UPDATE gd_diagnoses SET treatment_status = ?, resolved_date = ?, updated_at = ? WHERE id = ?`,
    [status, resolvedDate, now, id],
  );
}

export function getActiveDiagnoses(db: DatabaseAdapter, plantId?: string): Diagnosis[] {
  let sql = `SELECT * FROM gd_diagnoses WHERE treatment_status IN ('pending', 'in_treatment')`;
  const params: unknown[] = [];
  if (plantId) { sql += ' AND plant_id = ?'; params.push(plantId); }
  sql += ' ORDER BY diagnosed_date DESC';
  return db.query<Record<string, unknown>>(sql, params).map(rowToDiagnosis);
}

export function getDiagnosisHistory(db: DatabaseAdapter, plantId: string): Diagnosis[] {
  return db.query<Record<string, unknown>>(
    `SELECT * FROM gd_diagnoses WHERE plant_id = ? AND treatment_status IN ('resolved', 'unresolvable') ORDER BY diagnosed_date DESC`,
    [plantId],
  ).map(rowToDiagnosis);
}

// ── Wish List CRUD ──────────────────────────────────────────────────────

export function createWishListItem(db: DatabaseAdapter, id: string, input: CreateWishListInput): WishListItem {
  const now = nowIso();
  const today = todayDate();
  db.execute(
    `INSERT INTO gd_wishlist (id, name, species, source, estimated_price, priority, notes, image_uri, added_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.name, input.species ?? null, input.source ?? null, input.estimatedPrice ?? null,
     input.priority ?? 'medium', input.notes ?? null, input.imageUri ?? null, today, now, now],
  );
  return {
    id, name: input.name, species: input.species ?? null, source: input.source ?? null,
    estimatedPrice: input.estimatedPrice ?? null, priority: (input.priority ?? 'medium') as WishListItem['priority'],
    notes: input.notes ?? null, imageUri: input.imageUri ?? null, addedDate: today,
    acquired: false, acquiredDate: null, acquiredPlantId: null, createdAt: now, updatedAt: now,
  };
}

export function getWishList(db: DatabaseAdapter, includeAcquired = false): WishListItem[] {
  const sql = includeAcquired
    ? `SELECT * FROM gd_wishlist ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 WHEN 'low' THEN 2 END, added_date DESC`
    : `SELECT * FROM gd_wishlist WHERE acquired = 0 ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 WHEN 'low' THEN 2 END, added_date DESC`;
  return db.query<Record<string, unknown>>(sql).map(rowToWishList);
}

export function markWishListAcquired(db: DatabaseAdapter, id: string, plantId?: string | null): void {
  const now = nowIso();
  db.execute(
    `UPDATE gd_wishlist SET acquired = 1, acquired_date = ?, acquired_plant_id = ?, updated_at = ? WHERE id = ?`,
    [todayDate(), plantId ?? null, now, id],
  );
}

export function deleteWishListItem(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM gd_wishlist WHERE id = ?', [id]);
}

// ── Propagation CRUD ────────────────────────────────────────────────────

export function createPropagation(db: DatabaseAdapter, id: string, input: CreatePropagationInput): Propagation {
  const now = nowIso();
  const start = input.startDate ?? todayDate();
  db.execute(
    `INSERT INTO gd_propagations (id, parent_plant_id, method, medium, start_date, notes, image_uri, created_at, updated_at, stage_updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.parentPlantId ?? null, input.method, input.medium ?? null, start, input.notes ?? null, input.imageUri ?? null, now, now, now],
  );
  return {
    id, parentPlantId: input.parentPlantId ?? null, method: input.method as Propagation['method'],
    medium: (input.medium ?? null) as Propagation['medium'], startDate: start, currentStage: 'started',
    stageUpdatedAt: now, notes: input.notes ?? null, imageUri: input.imageUri ?? null,
    childPlantId: null, createdAt: now, updatedAt: now,
  };
}

export function advancePropagationStage(db: DatabaseAdapter, id: string, newStage: PropagationStage): void {
  const now = nowIso();
  db.execute(
    `UPDATE gd_propagations SET current_stage = ?, stage_updated_at = ?, updated_at = ? WHERE id = ?`,
    [newStage, now, now, id],
  );
}

export function linkPropagationChild(db: DatabaseAdapter, propagationId: string, childPlantId: string): void {
  const now = nowIso();
  db.execute(
    `UPDATE gd_propagations SET child_plant_id = ?, current_stage = 'potted', stage_updated_at = ?, updated_at = ? WHERE id = ?`,
    [childPlantId, now, now, propagationId],
  );
}

export function getActivePropagations(db: DatabaseAdapter): Propagation[] {
  return db.query<Record<string, unknown>>(
    `SELECT * FROM gd_propagations WHERE current_stage NOT IN ('failed', 'potted') ORDER BY start_date DESC`,
  ).map(rowToPropagation);
}

export function getPropagationStats(db: DatabaseAdapter): PropagationStats {
  const rows = db.query<{ total: number; potted: number; failed: number; active: number }>(
    `SELECT COUNT(*) as total,
       SUM(CASE WHEN current_stage = 'potted' THEN 1 ELSE 0 END) as potted,
       SUM(CASE WHEN current_stage = 'failed' THEN 1 ELSE 0 END) as failed,
       SUM(CASE WHEN current_stage NOT IN ('potted', 'failed') THEN 1 ELSE 0 END) as active
     FROM gd_propagations`,
  );
  const r = rows[0];
  return {
    total: r.total,
    successCount: r.potted,
    failedCount: r.failed,
    activeCount: r.active,
    successRate: r.total > 0 ? Math.round((r.potted / r.total) * 1000) / 10 : 0,
  };
}

// ── Light Reading CRUD ──────────────────────────────────────────────────

export function createLightReading(db: DatabaseAdapter, id: string, input: CreateLightReadingInput): LightReading {
  const now = nowIso();
  const date = input.readingDate ?? todayDate();
  const level = classifyLight(input.readingLux);
  db.execute(
    `INSERT INTO gd_light_readings (id, zone_id, reading_lux, light_level, reading_date, reading_time, duration_minutes, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.zoneId ?? null, input.readingLux, level, date, input.readingTime ?? null, input.durationMinutes ?? null, input.notes ?? null, now],
  );
  return {
    id, zoneId: input.zoneId ?? null, readingLux: input.readingLux, lightLevel: level,
    readingDate: date, readingTime: input.readingTime ?? null, durationMinutes: input.durationMinutes ?? null,
    notes: input.notes ?? null, createdAt: now,
  };
}

export function getLightReadingsForZone(db: DatabaseAdapter, zoneId: string): LightReading[] {
  return db.query<Record<string, unknown>>(
    'SELECT * FROM gd_light_readings WHERE zone_id = ? ORDER BY reading_date DESC', [zoneId],
  ).map(rowToLightReading);
}

export function getZoneAverageLux(db: DatabaseAdapter, zoneId: string): number | null {
  const rows = db.query<{ avg_lux: number | null }>(
    'SELECT AVG(reading_lux) as avg_lux FROM gd_light_readings WHERE zone_id = ?', [zoneId],
  );
  return rows[0].avg_lux != null ? Math.round(rows[0].avg_lux) : null;
}

// ── Layout CRUD ─────────────────────────────────────────────────────────

export function createLayout(db: DatabaseAdapter, id: string, input: CreateLayoutInput): Layout {
  const now = nowIso();
  db.execute(
    `INSERT INTO gd_layouts (id, name, zone_id, width_cells, height_cells, cell_size_inches, season, year, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.name, input.zoneId ?? null, input.widthCells ?? 8, input.heightCells ?? 8,
     input.cellSizeInches ?? 12, input.season ?? null, input.year ?? null, input.notes ?? null, now, now],
  );
  return {
    id, name: input.name, zoneId: input.zoneId ?? null, widthCells: input.widthCells ?? 8,
    heightCells: input.heightCells ?? 8, cellSizeInches: input.cellSizeInches ?? 12,
    season: input.season ?? null, year: input.year ?? null, notes: input.notes ?? null,
    createdAt: now, updatedAt: now,
  };
}

export function getLayouts(db: DatabaseAdapter, zoneId?: string): Layout[] {
  const sql = zoneId
    ? 'SELECT * FROM gd_layouts WHERE zone_id = ? ORDER BY created_at DESC'
    : 'SELECT * FROM gd_layouts ORDER BY created_at DESC';
  return db.query<Record<string, unknown>>(sql, zoneId ? [zoneId] : []).map(rowToLayout);
}

export function deleteLayout(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM gd_layouts WHERE id = ?', [id]);
}

export function createLayoutItem(db: DatabaseAdapter, id: string, input: CreateLayoutItemInput): LayoutItem {
  const now = nowIso();
  db.execute(
    `INSERT INTO gd_layout_items (id, layout_id, plant_id, item_type, label, x, y, width_cells, height_cells, color, icon, spacing_inches, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.layoutId, input.plantId ?? null, input.itemType ?? 'plant', input.label,
     input.x, input.y, input.widthCells ?? 1, input.heightCells ?? 1,
     input.color ?? null, input.icon ?? null, input.spacingInches ?? null, now],
  );
  return {
    id, layoutId: input.layoutId, plantId: input.plantId ?? null,
    itemType: (input.itemType ?? 'plant') as LayoutItem['itemType'], label: input.label,
    x: input.x, y: input.y, widthCells: input.widthCells ?? 1, heightCells: input.heightCells ?? 1,
    color: input.color ?? null, icon: input.icon ?? null, spacingInches: input.spacingInches ?? null,
    createdAt: now,
  };
}

export function getLayoutItems(db: DatabaseAdapter, layoutId: string): LayoutItem[] {
  return db.query<Record<string, unknown>>(
    'SELECT * FROM gd_layout_items WHERE layout_id = ? ORDER BY y ASC, x ASC', [layoutId],
  ).map(rowToLayoutItem);
}

export function deleteLayoutItem(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM gd_layout_items WHERE id = ?', [id]);
}

// ── Frost Config CRUD ───────────────────────────────────────────────────

export function getFrostConfig(db: DatabaseAdapter): FrostConfig | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM gd_frost_config WHERE id = 'default'`,
  );
  return rows.length > 0 ? rowToFrostConfig(rows[0]) : null;
}

export function setFrostConfig(db: DatabaseAdapter, data: {
  zipCode?: string | null; usdaZone?: string | null;
  avgLastFrost?: string | null; avgFirstFrost?: string | null;
  notificationDaysBefore?: number; customLastFrost?: string | null;
  customFirstFrost?: string | null;
}): void {
  const now = nowIso();
  db.execute(
    `INSERT INTO gd_frost_config (id, zip_code, usda_zone, avg_last_frost, avg_first_frost, notification_days_before, custom_last_frost, custom_first_frost, created_at, updated_at)
     VALUES ('default', ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       zip_code = excluded.zip_code, usda_zone = excluded.usda_zone,
       avg_last_frost = excluded.avg_last_frost, avg_first_frost = excluded.avg_first_frost,
       notification_days_before = excluded.notification_days_before,
       custom_last_frost = excluded.custom_last_frost, custom_first_frost = excluded.custom_first_frost,
       updated_at = excluded.updated_at`,
    [data.zipCode ?? null, data.usdaZone ?? null, data.avgLastFrost ?? null, data.avgFirstFrost ?? null,
     data.notificationDaysBefore ?? 7, data.customLastFrost ?? null, data.customFirstFrost ?? null, now, now],
  );
}

// ── Row Mappers ─────────────────────────────────────────────────────────

function rowToIdentification(r: Record<string, unknown>): Identification {
  return {
    id: r.id as string, plantId: (r.plant_id as string) ?? null, imageUri: r.image_uri as string,
    topSpecies: (r.top_species as string) ?? null, topCommonName: (r.top_common_name as string) ?? null,
    topConfidence: (r.top_confidence as number) ?? null, allResultsJson: (r.all_results_json as string) ?? null,
    source: r.source as string, createdAt: r.created_at as string,
  };
}

function rowToSeasonalTask(r: Record<string, unknown>): SeasonalTask {
  return {
    id: r.id as string, plantId: (r.plant_id as string) ?? null,
    season: r.season as SeasonalTask['season'], taskType: r.task_type as SeasonalTask['taskType'],
    description: (r.description as string) ?? null, dueMonth: (r.due_month as number) ?? null,
    completedAt: (r.completed_at as string) ?? null, snoozedUntil: (r.snoozed_until as string) ?? null,
    createdAt: r.created_at as string,
  };
}

function rowToHarvest(r: Record<string, unknown>): HarvestRecord {
  return {
    id: r.id as string, plantId: r.plant_id as string, date: r.date as string,
    quantity: r.quantity as number, unit: r.unit as HarvestRecord['unit'],
    cropType: (r.crop_type as string) ?? null, qualityRating: (r.quality_rating as number) ?? null,
    imageUri: (r.image_uri as string) ?? null, notes: (r.notes as string) ?? null,
    createdAt: r.created_at as string,
  };
}

function rowToDiagnosis(r: Record<string, unknown>): Diagnosis {
  return {
    id: r.id as string, plantId: (r.plant_id as string) ?? null,
    diagnosedDate: r.diagnosed_date as string, type: r.type as Diagnosis['type'],
    symptomsJson: r.symptoms_json as string, diagnosisName: (r.diagnosis_name as string) ?? null,
    diagnosisConfidence: (r.diagnosis_confidence as number) ?? null,
    severity: r.severity as Diagnosis['severity'], treatmentNotes: (r.treatment_notes as string) ?? null,
    treatmentStatus: r.treatment_status as Diagnosis['treatmentStatus'],
    imageUri: (r.image_uri as string) ?? null, resolvedDate: (r.resolved_date as string) ?? null,
    createdAt: r.created_at as string, updatedAt: r.updated_at as string,
  };
}

function rowToWishList(r: Record<string, unknown>): WishListItem {
  return {
    id: r.id as string, name: r.name as string, species: (r.species as string) ?? null,
    source: (r.source as string) ?? null, estimatedPrice: (r.estimated_price as number) ?? null,
    priority: r.priority as WishListItem['priority'], notes: (r.notes as string) ?? null,
    imageUri: (r.image_uri as string) ?? null, addedDate: r.added_date as string,
    acquired: (r.acquired as number) === 1, acquiredDate: (r.acquired_date as string) ?? null,
    acquiredPlantId: (r.acquired_plant_id as string) ?? null,
    createdAt: r.created_at as string, updatedAt: r.updated_at as string,
  };
}

function rowToPropagation(r: Record<string, unknown>): Propagation {
  return {
    id: r.id as string, parentPlantId: (r.parent_plant_id as string) ?? null,
    method: r.method as Propagation['method'], medium: (r.medium as Propagation['medium']) ?? null,
    startDate: r.start_date as string, currentStage: r.current_stage as Propagation['currentStage'],
    stageUpdatedAt: r.stage_updated_at as string, notes: (r.notes as string) ?? null,
    imageUri: (r.image_uri as string) ?? null, childPlantId: (r.child_plant_id as string) ?? null,
    createdAt: r.created_at as string, updatedAt: r.updated_at as string,
  };
}

function rowToLightReading(r: Record<string, unknown>): LightReading {
  return {
    id: r.id as string, zoneId: (r.zone_id as string) ?? null,
    readingLux: r.reading_lux as number, lightLevel: r.light_level as LightReading['lightLevel'],
    readingDate: r.reading_date as string, readingTime: (r.reading_time as string) ?? null,
    durationMinutes: (r.duration_minutes as number) ?? null, notes: (r.notes as string) ?? null,
    createdAt: r.created_at as string,
  };
}

function rowToLayout(r: Record<string, unknown>): Layout {
  return {
    id: r.id as string, name: r.name as string, zoneId: (r.zone_id as string) ?? null,
    widthCells: r.width_cells as number, heightCells: r.height_cells as number,
    cellSizeInches: r.cell_size_inches as number, season: (r.season as string) ?? null,
    year: (r.year as number) ?? null, notes: (r.notes as string) ?? null,
    createdAt: r.created_at as string, updatedAt: r.updated_at as string,
  };
}

function rowToLayoutItem(r: Record<string, unknown>): LayoutItem {
  return {
    id: r.id as string, layoutId: r.layout_id as string, plantId: (r.plant_id as string) ?? null,
    itemType: r.item_type as LayoutItem['itemType'], label: r.label as string,
    x: r.x as number, y: r.y as number, widthCells: r.width_cells as number,
    heightCells: r.height_cells as number, color: (r.color as string) ?? null,
    icon: (r.icon as string) ?? null, spacingInches: (r.spacing_inches as number) ?? null,
    createdAt: r.created_at as string,
  };
}

function rowToFrostConfig(r: Record<string, unknown>): FrostConfig {
  return {
    id: r.id as string, zipCode: (r.zip_code as string) ?? null,
    usdaZone: (r.usda_zone as string) ?? null, avgLastFrost: (r.avg_last_frost as string) ?? null,
    avgFirstFrost: (r.avg_first_frost as string) ?? null,
    notificationDaysBefore: r.notification_days_before as number,
    customLastFrost: (r.custom_last_frost as string) ?? null,
    customFirstFrost: (r.custom_first_frost as string) ?? null,
    createdAt: r.created_at as string, updatedAt: r.updated_at as string,
  };
}
