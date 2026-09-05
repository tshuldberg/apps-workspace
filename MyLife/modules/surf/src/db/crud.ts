import type { DatabaseAdapter } from '@mylife/db';
import type {
  SurfSession,
  SurfSpot,
  CreateSpotInput,
  Forecast,
  SwellComponent,
  TidePoint,
  BuoyReading,
  Narrative,
  UserPin,
  SpotAlert,
  AlertRule,
  SpotReview,
  SpotPhoto,
  SpotGuide,
  SessionWave,
  RecordedHike,
  SurfZone,
  SurfProfile,
  Follow,
  SharedSession,
  SessionComment,
  SessionLike,
  Crew,
  CrewMember,
} from '../types';

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

function rowToSpot(row: Record<string, unknown>): SurfSpot {
  const hazardsRaw = row.hazards_json as string | null;
  return {
    id: row.id as string,
    name: row.name as string,
    region: row.region as string,
    breakType: row.break_type as SurfSpot['breakType'],
    waveHeightFt: row.wave_height_ft as number,
    windKts: row.wind_kts as number,
    tide: row.tide as SurfSpot['tide'],
    swellDirection: row.swell_direction as string,
    isFavorite: !!(row.is_favorite as number),
    lastUpdated: row.last_updated as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    slug: (row.slug as string) ?? undefined,
    latitude: (row.latitude as number) ?? undefined,
    longitude: (row.longitude as number) ?? undefined,
    orientationDeg: (row.orientation_deg as number) ?? undefined,
    skillLevel: (row.skill_level as SurfSpot['skillLevel']) ?? undefined,
    hazards: hazardsRaw ? JSON.parse(hazardsRaw) : undefined,
    idealSwellDirMin: (row.ideal_swell_dir_min as number) ?? undefined,
    idealSwellDirMax: (row.ideal_swell_dir_max as number) ?? undefined,
    idealTideLow: (row.ideal_tide_low as number) ?? undefined,
    idealTideHigh: (row.ideal_tide_high as number) ?? undefined,
    description: (row.description as string) ?? undefined,
    crowdFactor: (row.crowd_factor as number) ?? undefined,
  };
}

function rowToSession(row: Record<string, unknown>): SurfSession {
  return {
    id: row.id as string,
    spotId: row.spot_id as string,
    sessionDate: row.session_date as string,
    durationMin: row.duration_min as number,
    rating: row.rating as number,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function rowToForecast(row: Record<string, unknown>): Omit<Forecast, 'swellComponents'> {
  return {
    id: row.id as string,
    spotId: row.spot_id as string,
    forecastTime: row.forecast_time as string,
    waveHeightMinFt: row.wave_height_min_ft as number,
    waveHeightMaxFt: row.wave_height_max_ft as number,
    waveHeightLabel: (row.wave_height_label as string) ?? undefined,
    rating: row.rating as number,
    conditionColor: row.condition_color as Forecast['conditionColor'],
    windSpeedKts: row.wind_speed_kts as number,
    windGustKts: row.wind_gust_kts as number,
    windDirectionDegrees: row.wind_direction_deg as number,
    windLabel: row.wind_label as Forecast['windLabel'],
    energyKj: row.energy_kj as number,
    consistencyScore: row.consistency_score as number,
    waterTempF: (row.water_temp_f as number) ?? undefined,
    airTempF: (row.air_temp_f as number) ?? undefined,
    modelRun: row.model_run as string,
    modelName: (row.model_name as string) ?? undefined,
  };
}

function rowToSwellComponent(row: Record<string, unknown>): SwellComponent {
  return {
    heightFt: row.height_ft as number,
    periodSeconds: row.period_s as number,
    directionDegrees: row.direction_deg as number,
    directionLabel: (row.direction_label as string) ?? '',
    componentOrder: row.swell_index as number,
  };
}

function rowToTide(row: Record<string, unknown>): TidePoint {
  return {
    timestamp: row.timestamp as string,
    heightFt: row.height_ft as number,
    type: row.type as TidePoint['type'],
  };
}

function rowToBuoy(row: Record<string, unknown>): BuoyReading {
  return {
    buoyId: row.buoy_id as string,
    timestamp: row.timestamp as string,
    waveHeightFt: (row.wave_height_ft as number) ?? undefined,
    dominantPeriodSeconds: (row.dominant_period_s as number) ?? undefined,
    averagePeriodSeconds: (row.avg_period_s as number) ?? undefined,
    waveDirectionDegrees: (row.wave_direction_deg as number) ?? undefined,
    waterTempF: (row.water_temp_f as number) ?? undefined,
    airTempF: (row.air_temp_f as number) ?? undefined,
    windSpeedKts: (row.wind_speed_kts as number) ?? undefined,
    windDirectionDegrees: (row.wind_direction_deg as number) ?? undefined,
  };
}

function rowToNarrative(row: Record<string, unknown>): Narrative {
  return {
    id: row.id as string,
    spotId: (row.spot_id as string) ?? undefined,
    region: (row.region as string) ?? undefined,
    forecastDate: row.forecast_date as string,
    summary: row.summary as string,
    body: row.body as string,
    generatedAt: row.generated_at as string,
    helpfulVotes: row.helpful_votes as number,
    unhelpfulVotes: row.unhelpful_votes as number,
  };
}

function rowToUserPin(row: Record<string, unknown>): UserPin {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    latitude: row.latitude as number,
    longitude: row.longitude as number,
    name: row.name as string,
    notes: (row.notes as string) ?? undefined,
    isPublic: !!(row.is_public as number),
    createdAt: (row.created_at as string) ?? undefined,
  };
}

function rowToReview(row: Record<string, unknown>): SpotReview {
  return {
    id: row.id as string,
    spotId: row.spot_id as string,
    userId: row.user_id as string,
    rating: row.rating as number,
    title: (row.title as string) ?? undefined,
    body: row.body as string,
    photoCount: row.photo_count as number,
    createdAt: (row.created_at as string) ?? undefined,
    updatedAt: (row.updated_at as string) ?? undefined,
  };
}

function rowToPhoto(row: Record<string, unknown>): SpotPhoto {
  return {
    id: row.id as string,
    spotId: row.spot_id as string,
    reviewId: (row.review_id as string) ?? undefined,
    userId: row.user_id as string,
    imageUrl: row.image_url as string,
    caption: (row.caption as string) ?? undefined,
    latitude: (row.latitude as number) ?? undefined,
    longitude: (row.longitude as number) ?? undefined,
    takenAt: (row.taken_at as string) ?? undefined,
    createdAt: (row.created_at as string) ?? undefined,
  };
}

function rowToGuide(row: Record<string, unknown>): SpotGuide {
  const hazardsRaw = row.hazards_json as string | null;
  return {
    spotId: row.spot_id as string,
    bestTideWindow: row.best_tide_window as string,
    bestSwellDirection: row.best_swell_direction as string,
    hazards: hazardsRaw ? JSON.parse(hazardsRaw) : [],
    parkingNotes: row.parking_notes as string,
    crowdNotes: row.crowd_notes as string,
    localTips: row.local_tips as string,
    updatedAt: (row.updated_at as string) ?? undefined,
  };
}

function rowToSessionWave(row: Record<string, unknown>): SessionWave {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    waveNumber: row.wave_number as number,
    durationSeconds: row.duration_s as number,
    maxSpeedKts: row.max_speed_kts as number,
    distanceMeters: row.distance_m as number,
    direction: (row.direction as number) ?? undefined,
    detectedAt: row.detected_at as string,
  };
}

function rowToHikeSummary(row: Record<string, unknown>): RecordedHike {
  return {
    id: row.id as string,
    localId: row.local_hike_id as string,
    userId: (row.user_id as string) ?? undefined,
    trailId: (row.trail_id as string) ?? undefined,
    name: row.name as string,
    startedAt: row.started_at as string,
    durationSeconds: row.duration_s as number,
    distanceMeters: row.distance_m as number,
    elevationGainMeters: row.elevation_gain_m as number,
    elevationLossMeters: row.elevation_loss_m as number,
    paceMinutesPerKm: (row.pace_min_per_km as number) ?? undefined,
    createdAt: (row.created_at as string) ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Spots CRUD (V1 + V2 enrichment)
// ---------------------------------------------------------------------------

export function createSpot(
  db: DatabaseAdapter,
  id: string,
  input: CreateSpotInput,
): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO sf_spots (
      id, name, region, break_type, wave_height_ft, wind_kts,
      tide, swell_direction, is_favorite, last_updated, created_at, updated_at,
      slug, latitude, longitude, orientation_deg, skill_level, hazards_json,
      ideal_swell_dir_min, ideal_swell_dir_max, ideal_tide_low, ideal_tide_high,
      description, crowd_factor
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.name,
      input.region,
      input.breakType,
      input.waveHeightFt ?? 0,
      input.windKts ?? 0,
      input.tide ?? 'mid',
      input.swellDirection ?? 'W',
      input.isFavorite ? 1 : 0,
      now,
      now,
      now,
      input.slug ?? null,
      input.latitude ?? null,
      input.longitude ?? null,
      input.orientationDeg ?? null,
      input.skillLevel ?? 'all',
      input.hazards ? JSON.stringify(input.hazards) : '[]',
      input.idealSwellDirMin ?? null,
      input.idealSwellDirMax ?? null,
      input.idealTideLow ?? null,
      input.idealTideHigh ?? null,
      input.description ?? null,
      input.crowdFactor ?? null,
    ],
  );
}

export function getSpots(
  db: DatabaseAdapter,
  options?: {
    search?: string;
    region?: string;
    favoritesOnly?: boolean;
    limit?: number;
  },
): SurfSpot[] {
  const where: string[] = [];
  const params: unknown[] = [];

  if (options?.search) {
    where.push('(name LIKE ? ESCAPE ? OR region LIKE ? ESCAPE ?)');
    const escaped = options.search.replace(/[%_\\]/g, '\\$&');
    const token = `%${escaped}%`;
    params.push(token, '\\', token, '\\');
  }
  if (options?.region) {
    where.push('region = ?');
    params.push(options.region);
  }
  if (options?.favoritesOnly) {
    where.push('is_favorite = 1');
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const limit = options?.limit ?? 200;
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM sf_spots
       ${whereClause}
       ORDER BY is_favorite DESC, updated_at DESC
       LIMIT ?`,
      [...params, limit],
    )
    .map(rowToSpot);
}

export function getSpotById(db: DatabaseAdapter, id: string): SurfSpot | null {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM sf_spots WHERE id = ?',
    [id],
  );
  return rows.length > 0 ? rowToSpot(rows[0]) : null;
}

export function getSpotBySlug(db: DatabaseAdapter, slug: string): SurfSpot | null {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM sf_spots WHERE slug = ?',
    [slug],
  );
  return rows.length > 0 ? rowToSpot(rows[0]) : null;
}

export function updateSpotConditions(
  db: DatabaseAdapter,
  id: string,
  updates: Partial<{
    waveHeightFt: number;
    windKts: number;
    tide: SurfSpot['tide'];
    swellDirection: string;
  }>,
): void {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (updates.waveHeightFt !== undefined) {
    sets.push('wave_height_ft = ?');
    params.push(updates.waveHeightFt);
  }
  if (updates.windKts !== undefined) {
    sets.push('wind_kts = ?');
    params.push(updates.windKts);
  }
  if (updates.tide !== undefined) {
    sets.push('tide = ?');
    params.push(updates.tide);
  }
  if (updates.swellDirection !== undefined) {
    sets.push('swell_direction = ?');
    params.push(updates.swellDirection);
  }

  if (sets.length === 0) return;
  const now = new Date().toISOString();
  sets.push('last_updated = ?', 'updated_at = ?');
  params.push(now, now, id);

  db.execute(`UPDATE sf_spots SET ${sets.join(', ')} WHERE id = ?`, params);
}

export function updateSpotProfile(
  db: DatabaseAdapter,
  id: string,
  updates: Partial<CreateSpotInput>,
): void {
  const sets: string[] = [];
  const params: unknown[] = [];

  const fieldMap: Record<string, string> = {
    name: 'name',
    region: 'region',
    breakType: 'break_type',
    slug: 'slug',
    latitude: 'latitude',
    longitude: 'longitude',
    orientationDeg: 'orientation_deg',
    skillLevel: 'skill_level',
    idealSwellDirMin: 'ideal_swell_dir_min',
    idealSwellDirMax: 'ideal_swell_dir_max',
    idealTideLow: 'ideal_tide_low',
    idealTideHigh: 'ideal_tide_high',
    description: 'description',
    crowdFactor: 'crowd_factor',
  };

  for (const [key, col] of Object.entries(fieldMap)) {
    const val = (updates as Record<string, unknown>)[key];
    if (val !== undefined) {
      sets.push(`${col} = ?`);
      params.push(val);
    }
  }

  if (updates.hazards !== undefined) {
    sets.push('hazards_json = ?');
    params.push(JSON.stringify(updates.hazards));
  }

  if (sets.length === 0) return;
  const now = new Date().toISOString();
  sets.push('updated_at = ?');
  params.push(now, id);

  db.execute(`UPDATE sf_spots SET ${sets.join(', ')} WHERE id = ?`, params);
}

export function toggleSpotFavorite(db: DatabaseAdapter, id: string): void {
  db.execute(
    `UPDATE sf_spots
     SET is_favorite = CASE WHEN is_favorite = 1 THEN 0 ELSE 1 END,
         updated_at = ?,
         last_updated = ?
     WHERE id = ?`,
    [new Date().toISOString(), new Date().toISOString(), id],
  );
}

export function deleteSpot(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM sf_spots WHERE id = ?', [id]);
}

export function countSpots(db: DatabaseAdapter): number {
  return db.query<{ c: number }>('SELECT COUNT(*) as c FROM sf_spots')[0]?.c ?? 0;
}

export function countFavoriteSpots(db: DatabaseAdapter): number {
  return db.query<{ c: number }>('SELECT COUNT(*) as c FROM sf_spots WHERE is_favorite = 1')[0]?.c ?? 0;
}

export function getAverageWaveHeightFt(db: DatabaseAdapter): number {
  const row = db.query<{ avg: number | null }>(
    'SELECT AVG(wave_height_ft) as avg FROM sf_spots',
  )[0];
  return row?.avg ?? 0;
}

// ---------------------------------------------------------------------------
// Sessions CRUD
// ---------------------------------------------------------------------------

export function createSession(
  db: DatabaseAdapter,
  id: string,
  input: {
    spotId: string;
    sessionDate: string;
    durationMin: number;
    rating: number;
    notes?: string;
  },
): void {
  db.execute(
    `INSERT INTO sf_sessions (id, spot_id, session_date, duration_min, rating, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.spotId,
      input.sessionDate,
      input.durationMin,
      input.rating,
      input.notes ?? null,
      new Date().toISOString(),
    ],
  );
}

export function getSessions(
  db: DatabaseAdapter,
  options?: {
    spotId?: string;
    limit?: number;
  },
): SurfSession[] {
  const params: unknown[] = [];
  let sql = 'SELECT * FROM sf_sessions';

  if (options?.spotId) {
    sql += ' WHERE spot_id = ?';
    params.push(options.spotId);
  }

  sql += ' ORDER BY session_date DESC';

  if (options?.limit !== undefined) {
    sql += ' LIMIT ?';
    params.push(options.limit);
  }

  return db.query<Record<string, unknown>>(sql, params).map(rowToSession);
}

export function deleteSession(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM sf_sessions WHERE id = ?', [id]);
}

export function countSessions(db: DatabaseAdapter): number {
  return db.query<{ c: number }>('SELECT COUNT(*) as c FROM sf_sessions')[0]?.c ?? 0;
}

// ---------------------------------------------------------------------------
// Forecasts CRUD (V2 cache)
// ---------------------------------------------------------------------------

export function upsertForecast(
  db: DatabaseAdapter,
  id: string,
  input: Omit<Forecast, 'id' | 'swellComponents'>,
): void {
  db.execute(
    `INSERT OR REPLACE INTO sf_forecasts (
      id, spot_id, forecast_time, model_run, model_name,
      wave_height_min_ft, wave_height_max_ft, wave_height_label,
      rating, condition_color,
      wind_speed_kts, wind_gust_kts, wind_direction_deg, wind_label,
      energy_kj, consistency_score, water_temp_f, air_temp_f
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.spotId,
      input.forecastTime,
      input.modelRun,
      input.modelName ?? 'gfs',
      input.waveHeightMinFt,
      input.waveHeightMaxFt,
      input.waveHeightLabel ?? null,
      input.rating,
      input.conditionColor,
      input.windSpeedKts,
      input.windGustKts,
      input.windDirectionDegrees,
      input.windLabel,
      input.energyKj,
      input.consistencyScore,
      input.waterTempF ?? null,
      input.airTempF ?? null,
    ],
  );
}

export function upsertSwellComponents(
  db: DatabaseAdapter,
  forecastId: string,
  components: SwellComponent[],
): void {
  db.execute('DELETE FROM sf_swell_components WHERE forecast_id = ?', [forecastId]);
  for (const c of components) {
    db.execute(
      `INSERT INTO sf_swell_components (id, forecast_id, swell_index, height_ft, period_s, direction_deg, direction_label)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        `${forecastId}_${c.componentOrder}`,
        forecastId,
        c.componentOrder,
        c.heightFt,
        c.periodSeconds,
        c.directionDegrees,
        c.directionLabel ?? null,
      ],
    );
  }
}

export function getSpotForecast(
  db: DatabaseAdapter,
  spotId: string,
  days?: number,
): Forecast[] {
  const params: unknown[] = [spotId];
  let sql = `SELECT * FROM sf_forecasts WHERE spot_id = ?`;
  if (days !== undefined) {
    sql += ` AND forecast_time >= datetime('now') AND forecast_time <= datetime('now', '+' || ? || ' days')`;
    params.push(days);
  }
  sql += ' ORDER BY forecast_time ASC LIMIT 500';

  const rows = db.query<Record<string, unknown>>(sql, params);
  if (rows.length === 0) return [];

  // Batch-load swell components for all forecasts to avoid N+1
  const forecastIds = rows.map((r) => r.id as string);
  const placeholders = forecastIds.map(() => '?').join(',');
  const compsByForecast = new Map<string, SwellComponent[]>();
  const rawComps = db.query<Record<string, unknown>>(
    `SELECT * FROM sf_swell_components WHERE forecast_id IN (${placeholders}) ORDER BY swell_index`,
    forecastIds,
  );
  for (const rc of rawComps) {
    const fid = rc.forecast_id as string;
    if (!compsByForecast.has(fid)) compsByForecast.set(fid, []);
    compsByForecast.get(fid)!.push(rowToSwellComponent(rc));
  }

  return rows.map((r) => {
    const base = rowToForecast(r);
    return { ...base, swellComponents: compsByForecast.get(base.id) ?? [] } as Forecast;
  });
}

// ---------------------------------------------------------------------------
// Tides CRUD (V2 cache)
// ---------------------------------------------------------------------------

export function upsertTide(
  db: DatabaseAdapter,
  id: string,
  input: { stationId: string; timestamp: string; heightFt: number; type?: string },
): void {
  db.execute(
    `INSERT OR REPLACE INTO sf_tides (id, station_id, timestamp, height_ft, type)
     VALUES (?, ?, ?, ?, ?)`,
    [id, input.stationId, input.timestamp, input.heightFt, input.type ?? 'intermediate'],
  );
}

export function getTides(
  db: DatabaseAdapter,
  stationId: string,
  start: string,
  end: string,
): TidePoint[] {
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM sf_tides
       WHERE station_id = ? AND timestamp >= ? AND timestamp <= ?
       ORDER BY timestamp ASC`,
      [stationId, start, end],
    )
    .map(rowToTide);
}

// ---------------------------------------------------------------------------
// Buoy Readings CRUD (V2 cache)
// ---------------------------------------------------------------------------

export function upsertBuoyReading(
  db: DatabaseAdapter,
  id: string,
  input: Omit<BuoyReading, 'buoyName' | 'latitude' | 'longitude'> & { buoyId: string },
): void {
  db.execute(
    `INSERT OR REPLACE INTO sf_buoy_readings (
      id, buoy_id, timestamp, wave_height_ft, dominant_period_s,
      avg_period_s, wave_direction_deg, water_temp_f, air_temp_f,
      wind_speed_kts, wind_direction_deg
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.buoyId,
      input.timestamp,
      input.waveHeightFt ?? null,
      input.dominantPeriodSeconds ?? null,
      input.averagePeriodSeconds ?? null,
      input.waveDirectionDegrees ?? null,
      input.waterTempF ?? null,
      input.airTempF ?? null,
      input.windSpeedKts ?? null,
      input.windDirectionDegrees ?? null,
    ],
  );
}

export function getLatestBuoyReading(
  db: DatabaseAdapter,
  buoyId: string,
): BuoyReading | null {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM sf_buoy_readings WHERE buoy_id = ? ORDER BY timestamp DESC LIMIT 1',
    [buoyId],
  );
  return rows.length > 0 ? rowToBuoy(rows[0]) : null;
}

export function getRecentBuoyReadings(
  db: DatabaseAdapter,
  buoyId: string,
  hours: number,
): BuoyReading[] {
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM sf_buoy_readings
       WHERE buoy_id = ? AND timestamp >= datetime('now', '-' || ? || ' hours')
       ORDER BY timestamp DESC`,
      [buoyId, hours],
    )
    .map(rowToBuoy);
}

// ---------------------------------------------------------------------------
// Narratives CRUD (V2 cache)
// ---------------------------------------------------------------------------

export function upsertNarrative(
  db: DatabaseAdapter,
  id: string,
  input: Omit<Narrative, 'id' | 'helpfulVotes' | 'unhelpfulVotes'>,
): void {
  db.execute(
    `INSERT OR REPLACE INTO sf_narratives (
      id, spot_id, region, forecast_date, summary, body, model_used, generated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.spotId ?? null,
      input.region ?? null,
      input.forecastDate,
      input.summary,
      input.body,
      null,
      input.generatedAt,
    ],
  );
}

export function getSpotNarrative(
  db: DatabaseAdapter,
  spotId: string,
  date: string,
): Narrative | null {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM sf_narratives WHERE spot_id = ? AND forecast_date = ? ORDER BY generated_at DESC LIMIT 1',
    [spotId, date],
  );
  return rows.length > 0 ? rowToNarrative(rows[0]) : null;
}

export function getRegionNarrative(
  db: DatabaseAdapter,
  region: string,
  date: string,
): Narrative | null {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM sf_narratives WHERE region = ? AND forecast_date = ? ORDER BY generated_at DESC LIMIT 1',
    [region, date],
  );
  return rows.length > 0 ? rowToNarrative(rows[0]) : null;
}

// ---------------------------------------------------------------------------
// User Pins CRUD (V3)
// ---------------------------------------------------------------------------

export function createUserPin(
  db: DatabaseAdapter,
  id: string,
  input: { userId: string; latitude: number; longitude: number; name: string; notes?: string; isPublic?: boolean },
): void {
  db.execute(
    `INSERT INTO sf_user_pins (id, user_id, latitude, longitude, name, notes, is_public)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.userId, input.latitude, input.longitude, input.name, input.notes ?? null, input.isPublic ? 1 : 0],
  );
}

export function getUserPins(db: DatabaseAdapter, userId: string, limit: number = 250): UserPin[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM sf_user_pins WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
      [userId, limit],
    )
    .map(rowToUserPin);
}

export function deleteUserPin(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM sf_user_pins WHERE id = ?', [id]);
}

// ---------------------------------------------------------------------------
// Spot Alerts CRUD (V3)
// ---------------------------------------------------------------------------

export function createSpotAlert(
  db: DatabaseAdapter,
  id: string,
  input: { userId: string; spotId: string; name: string; cooldownMinutes?: number; rules: Omit<AlertRule, 'id' | 'alertId'>[] },
): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO sf_spot_alerts (id, user_id, spot_id, name, cooldown_minutes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.userId, input.spotId, input.name, input.cooldownMinutes ?? 30, now, now],
  );
  for (let i = 0; i < input.rules.length; i++) {
    const r = input.rules[i];
    db.execute(
      `INSERT INTO sf_alert_rules (id, alert_id, parameter, operator, value, join_operator, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [`${id}_r${i}`, id, r.parameter, r.operator, r.value, r.joinWith ?? 'and', r.sortOrder ?? i],
    );
  }
}

export function getSpotAlerts(
  db: DatabaseAdapter,
  userId: string,
  spotId?: string,
): SpotAlert[] {
  const params: unknown[] = [userId];
  let sql = 'SELECT * FROM sf_spot_alerts WHERE user_id = ?';
  if (spotId) {
    sql += ' AND spot_id = ?';
    params.push(spotId);
  }
  sql += ' ORDER BY created_at DESC LIMIT 100';

  const alertRows = db.query<Record<string, unknown>>(sql, params);
  if (alertRows.length === 0) return [];

  // Batch-load all rules to avoid N+1
  const alertIds = alertRows.map((r) => r.id as string);
  const ph = alertIds.map(() => '?').join(',');
  const allRuleRows = db.query<Record<string, unknown>>(
    `SELECT * FROM sf_alert_rules WHERE alert_id IN (${ph}) ORDER BY sort_order`,
    alertIds,
  );
  const rulesByAlert = new Map<string, AlertRule[]>();
  for (const r of allRuleRows) {
    const aid = r.alert_id as string;
    if (!rulesByAlert.has(aid)) rulesByAlert.set(aid, []);
    rulesByAlert.get(aid)!.push({
      id: r.id as string,
      alertId: aid,
      parameter: r.parameter as AlertRule['parameter'],
      operator: r.operator as AlertRule['operator'],
      value: r.value as number,
      joinWith: r.join_operator as AlertRule['joinWith'],
      sortOrder: r.sort_order as number,
    });
  }

  return alertRows.map((row) => {
    const alertId = row.id as string;
    return {
      id: alertId,
      userId: row.user_id as string,
      spotId: row.spot_id as string,
      name: row.name as string,
      isActive: !!(row.is_active as number),
      cooldownMinutes: row.cooldown_minutes as number,
      lastTriggeredAt: (row.last_triggered_at as string) ?? undefined,
      rules: rulesByAlert.get(alertId) ?? [],
      createdAt: (row.created_at as string) ?? undefined,
      updatedAt: (row.updated_at as string) ?? undefined,
    };
  });
}

export function setSpotAlertActive(
  db: DatabaseAdapter,
  id: string,
  active: boolean,
): void {
  db.execute(
    'UPDATE sf_spot_alerts SET is_active = ?, updated_at = ? WHERE id = ?',
    [active ? 1 : 0, new Date().toISOString(), id],
  );
}

export function deleteSpotAlert(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM sf_spot_alerts WHERE id = ?', [id]);
}

// ---------------------------------------------------------------------------
// Reviews CRUD (V3)
// ---------------------------------------------------------------------------

export function createSpotReview(
  db: DatabaseAdapter,
  id: string,
  input: { spotId: string; userId: string; rating: number; title?: string; body: string },
): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO sf_spot_reviews (id, spot_id, user_id, rating, title, body, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.spotId, input.userId, input.rating, input.title ?? null, input.body, now, now],
  );
}

export function getSpotReviews(
  db: DatabaseAdapter,
  spotId: string,
  limit: number = 100,
): SpotReview[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM sf_spot_reviews WHERE spot_id = ? ORDER BY created_at DESC LIMIT ?',
      [spotId, limit],
    )
    .map(rowToReview);
}

export function deleteSpotReview(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM sf_spot_reviews WHERE id = ?', [id]);
}

// ---------------------------------------------------------------------------
// Photos CRUD (V3)
// ---------------------------------------------------------------------------

export function createSpotPhoto(
  db: DatabaseAdapter,
  id: string,
  input: { spotId: string; userId: string; imageUrl: string; reviewId?: string; caption?: string; latitude?: number; longitude?: number; takenAt?: string },
): void {
  db.execute(
    `INSERT INTO sf_spot_photos (id, spot_id, review_id, user_id, image_url, caption, latitude, longitude, taken_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.spotId, input.reviewId ?? null, input.userId, input.imageUrl, input.caption ?? null, input.latitude ?? null, input.longitude ?? null, input.takenAt ?? null],
  );
}

export function getSpotPhotos(
  db: DatabaseAdapter,
  spotId: string,
  limit: number = 100,
): SpotPhoto[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM sf_spot_photos WHERE spot_id = ? ORDER BY created_at DESC LIMIT ?',
      [spotId, limit],
    )
    .map(rowToPhoto);
}

export function deleteSpotPhoto(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM sf_spot_photos WHERE id = ?', [id]);
}

// ---------------------------------------------------------------------------
// Spot Guides CRUD (V3)
// ---------------------------------------------------------------------------

export function upsertSpotGuide(
  db: DatabaseAdapter,
  input: Omit<SpotGuide, 'updatedAt'> & { id: string },
): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT OR REPLACE INTO sf_spot_guides (id, spot_id, best_tide_window, best_swell_direction, hazards_json, parking_notes, crowd_notes, local_tips, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [input.id, input.spotId, input.bestTideWindow, input.bestSwellDirection, JSON.stringify(input.hazards), input.parkingNotes, input.crowdNotes, input.localTips, now],
  );
}

export function getSpotGuide(
  db: DatabaseAdapter,
  spotId: string,
): SpotGuide | null {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM sf_spot_guides WHERE spot_id = ?',
    [spotId],
  );
  return rows.length > 0 ? rowToGuide(rows[0]) : null;
}

// ---------------------------------------------------------------------------
// Session Waves CRUD (V3)
// ---------------------------------------------------------------------------

export function recordSessionWave(
  db: DatabaseAdapter,
  id: string,
  input: Omit<SessionWave, 'id'>,
): void {
  db.execute(
    `INSERT INTO sf_session_waves (id, session_id, wave_number, duration_s, max_speed_kts, distance_m, direction, detected_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.sessionId, input.waveNumber, input.durationSeconds, input.maxSpeedKts, input.distanceMeters, input.direction ?? null, input.detectedAt],
  );
}

export function getSessionWaves(
  db: DatabaseAdapter,
  sessionId: string,
): SessionWave[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM sf_session_waves WHERE session_id = ? ORDER BY wave_number',
      [sessionId],
    )
    .map(rowToSessionWave);
}

// ---------------------------------------------------------------------------
// Trail Hike Summaries CRUD (V3)
// ---------------------------------------------------------------------------

export function upsertTrailHikeSummary(
  db: DatabaseAdapter,
  id: string,
  input: {
    userId: string;
    localHikeId: string;
    trailId?: string;
    name: string;
    distanceMeters: number;
    elevationGainMeters: number;
    elevationLossMeters: number;
    durationSeconds: number;
    paceMinutesPerKm?: number;
    startedAt: string;
  },
): void {
  db.execute(
    `INSERT OR REPLACE INTO sf_trail_hike_summaries (
      id, user_id, local_hike_id, trail_id, name,
      distance_m, elevation_gain_m, elevation_loss_m, duration_s,
      pace_min_per_km, started_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.userId,
      input.localHikeId,
      input.trailId ?? null,
      input.name,
      input.distanceMeters,
      input.elevationGainMeters,
      input.elevationLossMeters,
      input.durationSeconds,
      input.paceMinutesPerKm ?? null,
      input.startedAt,
    ],
  );
}

export function getTrailHikeSummaries(
  db: DatabaseAdapter,
  userId: string,
  limit: number = 200,
): RecordedHike[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM sf_trail_hike_summaries WHERE user_id = ? ORDER BY started_at DESC LIMIT ?',
      [userId, limit],
    )
    .map(rowToHikeSummary);
}

// ---------------------------------------------------------------------------
// V4 Row Mappers
// ---------------------------------------------------------------------------

function rowToZone(row: Record<string, unknown>): SurfZone {
  const bbRaw = row.bounding_box_json as string | null;
  return {
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    country: row.country as string,
    sortOrder: row.sort_order as number,
    boundingBox: bbRaw ? JSON.parse(bbRaw) : undefined,
    timezone: row.timezone as string,
    isActive: !!(row.is_active as number),
    spotCount: row.spot_count as number,
    createdAt: (row.created_at as string) ?? undefined,
    updatedAt: (row.updated_at as string) ?? undefined,
  };
}

function rowToSurfProfile(row: Record<string, unknown>): SurfProfile {
  const quiverRaw = row.board_quiver_json as string | null;
  return {
    id: row.id as string,
    userId: row.user_id as string,
    displayName: row.display_name as string,
    avatarUrl: (row.avatar_url as string) ?? undefined,
    bio: (row.bio as string) ?? undefined,
    homeSpotId: (row.home_spot_id as string) ?? undefined,
    skillLevel: row.skill_level as SurfProfile['skillLevel'],
    boardQuiver: quiverRaw ? JSON.parse(quiverRaw) : [],
    sessionCount: row.session_count as number,
    totalWaves: row.total_waves as number,
    totalHours: row.total_hours as number,
    isPublic: !!(row.is_public as number),
    createdAt: (row.created_at as string) ?? undefined,
    updatedAt: (row.updated_at as string) ?? undefined,
  };
}

function rowToFollow(row: Record<string, unknown>): Follow {
  return {
    id: row.id as string,
    followerId: row.follower_id as string,
    followingId: row.following_id as string,
    createdAt: (row.created_at as string) ?? undefined,
  };
}

function rowToSharedSession(row: Record<string, unknown>): SharedSession {
  const photosRaw = row.photo_urls_json as string | null;
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    userId: row.user_id as string,
    spotId: row.spot_id as string,
    caption: (row.caption as string) ?? undefined,
    waveCount: (row.wave_count as number) ?? undefined,
    bestWaveDurationS: (row.best_wave_duration_s as number) ?? undefined,
    conditionsSummary: (row.conditions_summary as string) ?? undefined,
    photoUrls: photosRaw ? JSON.parse(photosRaw) : [],
    stokeLevel: row.stoke_level as number,
    isPublic: !!(row.is_public as number),
    likesCount: row.likes_count as number,
    commentsCount: row.comments_count as number,
    createdAt: (row.created_at as string) ?? undefined,
  };
}

function rowToSessionComment(row: Record<string, unknown>): SessionComment {
  return {
    id: row.id as string,
    sharedSessionId: row.shared_session_id as string,
    userId: row.user_id as string,
    body: row.body as string,
    createdAt: (row.created_at as string) ?? undefined,
  };
}

function rowToSessionLike(row: Record<string, unknown>): SessionLike {
  return {
    id: row.id as string,
    sharedSessionId: row.shared_session_id as string,
    userId: row.user_id as string,
    createdAt: (row.created_at as string) ?? undefined,
  };
}

function rowToCrew(row: Record<string, unknown>): Crew {
  return {
    id: row.id as string,
    name: row.name as string,
    creatorId: row.creator_id as string,
    description: (row.description as string) ?? undefined,
    homeSpotId: (row.home_spot_id as string) ?? undefined,
    memberCount: row.member_count as number,
    createdAt: (row.created_at as string) ?? undefined,
    updatedAt: (row.updated_at as string) ?? undefined,
  };
}

function rowToCrewMember(row: Record<string, unknown>): CrewMember {
  return {
    id: row.id as string,
    crewId: row.crew_id as string,
    userId: row.user_id as string,
    role: row.role as CrewMember['role'],
    joinedAt: (row.joined_at as string) ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Zones CRUD (V4 -- Multi-Region)
// ---------------------------------------------------------------------------

export function createZone(
  db: DatabaseAdapter,
  id: string,
  input: { name: string; slug: string; country?: string; sortOrder?: number; timezone?: string; boundingBox?: { minLat: number; maxLat: number; minLng: number; maxLng: number } },
): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO sf_zones (id, name, slug, country, sort_order, bounding_box_json, timezone, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.name, input.slug, input.country ?? 'US', input.sortOrder ?? 0, input.boundingBox ? JSON.stringify(input.boundingBox) : null, input.timezone ?? 'America/Los_Angeles', now, now],
  );
}

export function getZones(db: DatabaseAdapter, activeOnly: boolean = true): SurfZone[] {
  const where = activeOnly ? ' WHERE is_active = 1' : '';
  return db
    .query<Record<string, unknown>>(`SELECT * FROM sf_zones${where} ORDER BY sort_order, name`)
    .map(rowToZone);
}

export function getZoneBySlug(db: DatabaseAdapter, slug: string): SurfZone | undefined {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM sf_zones WHERE slug = ? LIMIT 1',
    [slug],
  );
  return rows[0] ? rowToZone(rows[0]) : undefined;
}

export function updateZoneSpotCount(db: DatabaseAdapter, zoneId: string): void {
  db.execute(
    `UPDATE sf_zones SET spot_count = (SELECT COUNT(*) FROM sf_spots WHERE zone_id = ?), updated_at = datetime('now') WHERE id = ?`,
    [zoneId, zoneId],
  );
}

export function getSpotsByZone(db: DatabaseAdapter, zoneId: string, limit: number = 200): SurfSpot[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM sf_spots WHERE zone_id = ? ORDER BY name LIMIT ?',
      [zoneId, limit],
    )
    .map(rowToSpot);
}

// ---------------------------------------------------------------------------
// Surf Profiles CRUD (V4 -- Social)
// ---------------------------------------------------------------------------

export function createSurfProfile(
  db: DatabaseAdapter,
  id: string,
  input: { userId: string; displayName: string; avatarUrl?: string; bio?: string; homeSpotId?: string; skillLevel?: string },
): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO sf_profiles (id, user_id, display_name, avatar_url, bio, home_spot_id, skill_level, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.userId, input.displayName, input.avatarUrl ?? null, input.bio ?? null, input.homeSpotId ?? null, input.skillLevel ?? 'intermediate', now, now],
  );
}

export function getSurfProfile(db: DatabaseAdapter, userId: string): SurfProfile | undefined {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM sf_profiles WHERE user_id = ? LIMIT 1',
    [userId],
  );
  return rows[0] ? rowToSurfProfile(rows[0]) : undefined;
}

export function updateSurfProfile(
  db: DatabaseAdapter,
  userId: string,
  input: { displayName?: string; avatarUrl?: string; bio?: string; homeSpotId?: string; skillLevel?: string; boardQuiver?: string[]; isPublic?: boolean },
): void {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (input.displayName !== undefined) { sets.push('display_name = ?'); params.push(input.displayName); }
  if (input.avatarUrl !== undefined) { sets.push('avatar_url = ?'); params.push(input.avatarUrl); }
  if (input.bio !== undefined) { sets.push('bio = ?'); params.push(input.bio); }
  if (input.homeSpotId !== undefined) { sets.push('home_spot_id = ?'); params.push(input.homeSpotId); }
  if (input.skillLevel !== undefined) { sets.push('skill_level = ?'); params.push(input.skillLevel); }
  if (input.boardQuiver !== undefined) { sets.push('board_quiver_json = ?'); params.push(JSON.stringify(input.boardQuiver)); }
  if (input.isPublic !== undefined) { sets.push('is_public = ?'); params.push(input.isPublic ? 1 : 0); }
  if (sets.length === 0) return;
  sets.push("updated_at = datetime('now')");
  params.push(userId);
  db.execute(`UPDATE sf_profiles SET ${sets.join(', ')} WHERE user_id = ?`, params);
}

export function incrementProfileStats(
  db: DatabaseAdapter,
  userId: string,
  stats: { sessions?: number; waves?: number; hours?: number },
): void {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (stats.sessions) { sets.push('session_count = session_count + ?'); params.push(stats.sessions); }
  if (stats.waves) { sets.push('total_waves = total_waves + ?'); params.push(stats.waves); }
  if (stats.hours) { sets.push('total_hours = total_hours + ?'); params.push(stats.hours); }
  if (sets.length === 0) return;
  sets.push("updated_at = datetime('now')");
  params.push(userId);
  db.execute(`UPDATE sf_profiles SET ${sets.join(', ')} WHERE user_id = ?`, params);
}

// ---------------------------------------------------------------------------
// Follows CRUD (V4 -- Social)
// ---------------------------------------------------------------------------

export function createFollow(db: DatabaseAdapter, id: string, followerId: string, followingId: string): void {
  db.execute(
    'INSERT OR IGNORE INTO sf_follows (id, follower_id, following_id) VALUES (?, ?, ?)',
    [id, followerId, followingId],
  );
}

export function deleteFollow(db: DatabaseAdapter, followerId: string, followingId: string): void {
  db.execute(
    'DELETE FROM sf_follows WHERE follower_id = ? AND following_id = ?',
    [followerId, followingId],
  );
}

export function getFollowers(db: DatabaseAdapter, userId: string, limit: number = 500): Follow[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM sf_follows WHERE following_id = ? ORDER BY created_at DESC LIMIT ?',
      [userId, limit],
    )
    .map(rowToFollow);
}

export function getFollowing(db: DatabaseAdapter, userId: string, limit: number = 500): Follow[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM sf_follows WHERE follower_id = ? ORDER BY created_at DESC LIMIT ?',
      [userId, limit],
    )
    .map(rowToFollow);
}

export function isFollowing(db: DatabaseAdapter, followerId: string, followingId: string): boolean {
  const rows = db.query<Record<string, unknown>>(
    'SELECT 1 FROM sf_follows WHERE follower_id = ? AND following_id = ? LIMIT 1',
    [followerId, followingId],
  );
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Shared Sessions CRUD (V4 -- Social)
// ---------------------------------------------------------------------------

export function createSharedSession(
  db: DatabaseAdapter,
  id: string,
  input: {
    sessionId: string;
    userId: string;
    spotId: string;
    caption?: string;
    waveCount?: number;
    bestWaveDurationS?: number;
    conditionsSummary?: string;
    photoUrls?: string[];
    stokeLevel?: number;
    isPublic?: boolean;
  },
): void {
  db.execute(
    `INSERT INTO sf_shared_sessions
      (id, session_id, user_id, spot_id, caption, wave_count, best_wave_duration_s,
       conditions_summary, photo_urls_json, stoke_level, is_public)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, input.sessionId, input.userId, input.spotId, input.caption ?? null,
      input.waveCount ?? null, input.bestWaveDurationS ?? null,
      input.conditionsSummary ?? null, JSON.stringify(input.photoUrls ?? []),
      input.stokeLevel ?? 3, input.isPublic === true ? 1 : 0,
    ],
  );
}

export function getSharedSessionsByUser(db: DatabaseAdapter, userId: string, limit: number = 30): SharedSession[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM sf_shared_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
      [userId, limit],
    )
    .map(rowToSharedSession);
}

export function getSharedSessionsBySpot(db: DatabaseAdapter, spotId: string, limit: number = 30): SharedSession[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM sf_shared_sessions WHERE spot_id = ? AND is_public = 1 ORDER BY created_at DESC LIMIT ?',
      [spotId, limit],
    )
    .map(rowToSharedSession);
}

export function getFeedForUser(db: DatabaseAdapter, userId: string, limit: number = 30, createdBefore?: string): SharedSession[] {
  const params: unknown[] = [userId];
  let cursorClause = '';
  if (createdBefore) {
    cursorClause = ' AND ss.created_at < ?';
    params.push(createdBefore);
  }
  params.push(limit);
  return db
    .query<Record<string, unknown>>(
      `SELECT ss.* FROM sf_shared_sessions ss
       INNER JOIN sf_follows f ON f.following_id = ss.user_id AND f.follower_id = ?
       WHERE ss.is_public = 1${cursorClause}
       ORDER BY ss.created_at DESC LIMIT ?`,
      params,
    )
    .map(rowToSharedSession);
}

export function deleteSharedSession(db: DatabaseAdapter, id: string, userId: string): void {
  db.execute('DELETE FROM sf_shared_sessions WHERE id = ? AND user_id = ?', [id, userId]);
}

// ---------------------------------------------------------------------------
// Session Comments CRUD (V4 -- Social)
// ---------------------------------------------------------------------------

export function createSessionComment(
  db: DatabaseAdapter,
  id: string,
  input: { sharedSessionId: string; userId: string; body: string },
): void {
  db.execute(
    'INSERT INTO sf_session_comments (id, shared_session_id, user_id, body) VALUES (?, ?, ?, ?)',
    [id, input.sharedSessionId, input.userId, input.body],
  );
  // Recount from source of truth to prevent drift
  db.execute(
    `UPDATE sf_shared_sessions SET comments_count = (
      SELECT COUNT(*) FROM sf_session_comments WHERE shared_session_id = ?
    ) WHERE id = ?`,
    [input.sharedSessionId, input.sharedSessionId],
  );
}

export function getSessionComments(db: DatabaseAdapter, sharedSessionId: string, limit: number = 200): SessionComment[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM sf_session_comments WHERE shared_session_id = ? ORDER BY created_at LIMIT ?',
      [sharedSessionId, limit],
    )
    .map(rowToSessionComment);
}

export function deleteSessionComment(db: DatabaseAdapter, commentId: string, _sharedSessionId?: string): void {
  // Verify the comment exists and belongs to the given session before decrementing
  const existing = db.query<{ shared_session_id: string }>(
    'SELECT shared_session_id FROM sf_session_comments WHERE id = ? LIMIT 1',
    [commentId],
  );
  if (existing.length === 0) return;
  const actualSessionId = existing[0].shared_session_id;
  db.execute('DELETE FROM sf_session_comments WHERE id = ?', [commentId]);
  // Recount from source of truth to prevent drift
  db.execute(
    `UPDATE sf_shared_sessions SET comments_count = (
      SELECT COUNT(*) FROM sf_session_comments WHERE shared_session_id = ?
    ) WHERE id = ?`,
    [actualSessionId, actualSessionId],
  );
}

// ---------------------------------------------------------------------------
// Session Likes CRUD (V4 -- Social)
// ---------------------------------------------------------------------------

export function toggleSessionLike(
  db: DatabaseAdapter,
  id: string,
  sharedSessionId: string,
  userId: string,
): { liked: boolean } {
  const existing = db.query<Record<string, unknown>>(
    'SELECT id FROM sf_session_likes WHERE shared_session_id = ? AND user_id = ? LIMIT 1',
    [sharedSessionId, userId],
  );
  if (existing.length > 0) {
    db.execute('DELETE FROM sf_session_likes WHERE shared_session_id = ? AND user_id = ?', [sharedSessionId, userId]);
    // Recount from source of truth to avoid drift from concurrent operations
    db.execute(
      `UPDATE sf_shared_sessions SET likes_count = (
        SELECT COUNT(*) FROM sf_session_likes WHERE shared_session_id = ?
      ) WHERE id = ?`,
      [sharedSessionId, sharedSessionId],
    );
    return { liked: false };
  }
  db.execute(
    'INSERT INTO sf_session_likes (id, shared_session_id, user_id) VALUES (?, ?, ?)',
    [id, sharedSessionId, userId],
  );
  // Recount from source of truth to avoid drift from concurrent operations
  db.execute(
    `UPDATE sf_shared_sessions SET likes_count = (
      SELECT COUNT(*) FROM sf_session_likes WHERE shared_session_id = ?
    ) WHERE id = ?`,
    [sharedSessionId, sharedSessionId],
  );
  return { liked: true };
}

export function getSessionLikes(db: DatabaseAdapter, sharedSessionId: string, limit: number = 500): SessionLike[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM sf_session_likes WHERE shared_session_id = ? ORDER BY created_at DESC LIMIT ?',
      [sharedSessionId, limit],
    )
    .map(rowToSessionLike);
}

// ---------------------------------------------------------------------------
// Crews CRUD (V4 -- Social)
// ---------------------------------------------------------------------------

export function createCrew(
  db: DatabaseAdapter,
  id: string,
  input: { name: string; creatorId: string; description?: string; homeSpotId?: string },
): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO sf_crews (id, name, creator_id, description, home_spot_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.name, input.creatorId, input.description ?? null, input.homeSpotId ?? null, now, now],
  );
  db.execute(
    `INSERT INTO sf_crew_members (id, crew_id, user_id, role) VALUES (?, ?, ?, 'creator')`,
    [`${id}-creator`, id, input.creatorId],
  );
}

export function getCrew(db: DatabaseAdapter, crewId: string): Crew | undefined {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM sf_crews WHERE id = ? LIMIT 1',
    [crewId],
  );
  return rows[0] ? rowToCrew(rows[0]) : undefined;
}

export function getUserCrews(db: DatabaseAdapter, userId: string, limit: number = 100): Crew[] {
  return db
    .query<Record<string, unknown>>(
      `SELECT c.* FROM sf_crews c
       INNER JOIN sf_crew_members cm ON cm.crew_id = c.id
       WHERE cm.user_id = ?
       ORDER BY c.name LIMIT ?`,
      [userId, limit],
    )
    .map(rowToCrew);
}

export function addCrewMember(db: DatabaseAdapter, id: string, crewId: string, userId: string): void {
  db.execute(
    'INSERT OR IGNORE INTO sf_crew_members (id, crew_id, user_id, role) VALUES (?, ?, ?, ?)',
    [id, crewId, userId, 'member'],
  );
  db.execute(
    `UPDATE sf_crews SET member_count = (SELECT COUNT(*) FROM sf_crew_members WHERE crew_id = ?), updated_at = datetime('now') WHERE id = ?`,
    [crewId, crewId],
  );
}

export function removeCrewMember(db: DatabaseAdapter, crewId: string, userId: string): void {
  db.execute('DELETE FROM sf_crew_members WHERE crew_id = ? AND user_id = ?', [crewId, userId]);
  db.execute(
    `UPDATE sf_crews SET member_count = (SELECT COUNT(*) FROM sf_crew_members WHERE crew_id = ?), updated_at = datetime('now') WHERE id = ?`,
    [crewId, crewId],
  );
}

export function getCrewMembers(db: DatabaseAdapter, crewId: string, limit: number = 100): CrewMember[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM sf_crew_members WHERE crew_id = ? ORDER BY joined_at LIMIT ?',
      [crewId, limit],
    )
    .map(rowToCrewMember);
}

export function deleteCrew(db: DatabaseAdapter, crewId: string): void {
  db.execute('DELETE FROM sf_crews WHERE id = ?', [crewId]);
}
