import type { DatabaseAdapter } from '@mylife/db';
import { createPlace, updatePlace, deletePlace } from '@mylife/db';
import type {
  Trail,
  TrailPhoto,
  TrailRecording,
  Waypoint,
  TrailStats,
  CreateTrailInput,
  UpdateTrailInput,
  CreateRecordingInput,
  UpdateRecordingInput,
  CreateWaypointInput,
  CreateTrailPhotoInput,
  OfflineRegion,
  CreateOfflineRegionInput,
  AlertSettings,
  UpdateAlertSettingsInput,
  DeviationEvent,
  CreateDeviationEventInput,
  WeatherCache,
  Segment,
  SegmentEffort,
  CreateSegmentInput,
  CreateSegmentEffortInput,
  PackingTemplate,
  PackingItem,
  CreatePackingItemInput,
  UpdatePackingItemInput,
  Trip,
  TripDay,
  TripActivity,
  CreateTripInput,
  CreateTripDayInput,
  CreateTripActivityInput,
  TrailDatabaseEntry,
  PlannedRoute,
  RouteWaypoint,
  CreatePlannedRouteInput,
  CreateRouteWaypointInput,
  TrailReview,
  CreateReviewInput,
} from '../types';
import {
  CreateTrailInputSchema,
  UpdateTrailInputSchema,
  CreateRecordingInputSchema,
  UpdateRecordingInputSchema,
  CreateWaypointInputSchema,
  CreateTrailPhotoInputSchema,
  CreateOfflineRegionInputSchema,
  UpdateAlertSettingsInputSchema,
  CreateDeviationEventInputSchema,
  CreateSegmentInputSchema,
  CreateSegmentEffortInputSchema,
  CreatePackingItemInputSchema,
  UpdatePackingItemInputSchema,
  CreateTripInputSchema,
  CreateTripDayInputSchema,
  CreateTripActivityInputSchema,
  CreatePlannedRouteInputSchema,
  CreateRouteWaypointInputSchema,
  CreateReviewInputSchema,
} from '../types';

// ── Helpers ────────────────────────────────────────────────────────────

function nowIso(): string {
  return new Date().toISOString();
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function rowToTrail(row: Record<string, unknown>): Trail {
  return {
    id: row.id as string,
    name: row.name as string,
    difficulty: row.difficulty as Trail['difficulty'],
    distanceMeters: row.distance_meters as number,
    elevationGainMeters: row.elevation_gain_meters as number,
    estimatedMinutes: (row.estimated_minutes as number) ?? null,
    lat: row.lat as number,
    lng: row.lng as number,
    region: (row.region as string) ?? null,
    description: (row.description as string) ?? null,
    isSaved: (row.is_saved as number) === 1,
    createdAt: row.created_at as string,
  };
}

function rowToTrailPhoto(row: Record<string, unknown>): TrailPhoto {
  return {
    id: row.id as string,
    recordingId: (row.recording_id as string) ?? null,
    trailId: (row.trail_id as string) ?? null,
    lat: row.lat as number,
    lng: row.lng as number,
    uri: row.uri as string,
    caption: (row.caption as string) ?? null,
    takenAt: row.taken_at as string,
    createdAt: row.created_at as string,
  };
}

function rowToRecording(row: Record<string, unknown>): TrailRecording {
  return {
    id: row.id as string,
    trailId: (row.trail_id as string) ?? null,
    name: row.name as string,
    activityType: row.activity_type as TrailRecording['activityType'],
    startedAt: row.started_at as string,
    endedAt: (row.ended_at as string) ?? null,
    distanceMeters: row.distance_meters as number,
    elevationGainMeters: row.elevation_gain_meters as number,
    durationSeconds: row.duration_seconds as number,
    notes: (row.notes as string) ?? null,
    isPrivate: (row.is_private as number) === 1,
    activityRating: (row.activity_rating as number) ?? null,
    gpxData: (row.gpx_data as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function rowToWaypoint(row: Record<string, unknown>): Waypoint {
  return {
    id: row.id as string,
    recordingId: row.recording_id as string,
    lat: row.lat as number,
    lng: row.lng as number,
    elevation: (row.elevation as number) ?? null,
    timestamp: row.timestamp as string,
    accuracy: (row.accuracy as number) ?? null,
    createdAt: row.created_at as string,
  };
}

// ── Trails ─────────────────────────────────────────────────────────────

export function createTrail(
  db: DatabaseAdapter,
  id: string,
  rawInput: CreateTrailInput,
): Trail {
  const input = CreateTrailInputSchema.parse(rawInput);
  const now = nowIso();

  db.transaction(() => {
    db.execute(
      `INSERT INTO tr_trails (id, name, difficulty, distance_meters, elevation_gain_meters, estimated_minutes, lat, lng, region, description, is_saved, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [
        id,
        input.name,
        input.difficulty,
        input.distanceMeters,
        input.elevationGainMeters,
        input.estimatedMinutes ?? null,
        input.lat,
        input.lng,
        input.region ?? null,
        input.description ?? null,
        now,
      ],
    );

    // Shadow write to hub_places (Phase 1c Wave A). Failures here throw
    // and roll back the tr_trails insert via the surrounding transaction.
    const place = createPlace(db, {
      name: input.name,
      kind: 'trailhead',
      lat: input.lat,
      lng: input.lng,
      moduleOrigin: 'trails',
    });
    db.execute(
      `UPDATE tr_trails SET hub_place_id = ? WHERE id = ?`,
      [place.id, id],
    );
  });

  return {
    id,
    name: input.name,
    difficulty: input.difficulty,
    distanceMeters: input.distanceMeters,
    elevationGainMeters: input.elevationGainMeters,
    estimatedMinutes: input.estimatedMinutes ?? null,
    lat: input.lat,
    lng: input.lng,
    region: input.region ?? null,
    description: input.description ?? null,
    isSaved: false,
    createdAt: now,
  };
}

export function getTrail(db: DatabaseAdapter, id: string): Trail | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM tr_trails WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rowToTrail(rows[0]) : null;
}

export function getTrails(
  db: DatabaseAdapter,
  options?: { difficulty?: string; savedOnly?: boolean; limit?: number; offset?: number },
): Trail[] {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options?.difficulty) {
    conditions.push('difficulty = ?');
    params.push(options.difficulty);
  }
  if (options?.savedOnly) {
    conditions.push('is_saved = 1');
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = options?.limit ?? 100;
  const offset = options?.offset ?? 0;

  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM tr_trails ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  return rows.map(rowToTrail);
}

export function getNearbyTrails(
  db: DatabaseAdapter,
  trailId: string,
  limit = 6,
): Trail[] {
  const trail = getTrail(db, trailId);
  if (!trail) {
    return [];
  }

  return getTrails(db, { limit: 500 })
    .filter((candidate) => candidate.id !== trailId)
    .sort((left, right) => {
      const leftRegionBonus = left.region === trail.region ? -1 : 0;
      const rightRegionBonus = right.region === trail.region ? -1 : 0;
      if (leftRegionBonus !== rightRegionBonus) {
        return leftRegionBonus - rightRegionBonus;
      }

      const leftDifficultyBonus = left.difficulty === trail.difficulty ? -1 : 0;
      const rightDifficultyBonus = right.difficulty === trail.difficulty ? -1 : 0;
      if (leftDifficultyBonus !== rightDifficultyBonus) {
        return leftDifficultyBonus - rightDifficultyBonus;
      }

      const leftDistance = Math.abs(left.lat - trail.lat) + Math.abs(left.lng - trail.lng);
      const rightDistance = Math.abs(right.lat - trail.lat) + Math.abs(right.lng - trail.lng);
      return leftDistance - rightDistance;
    })
    .slice(0, limit);
}

export function updateTrail(
  db: DatabaseAdapter,
  id: string,
  rawInput: UpdateTrailInput,
): Trail | null {
  const existing = getTrail(db, id);
  if (!existing) return null;

  const input = UpdateTrailInputSchema.parse(rawInput);
  const updates: string[] = [];
  const params: unknown[] = [];

  if (input.name !== undefined) { updates.push('name = ?'); params.push(input.name); }
  if (input.difficulty !== undefined) { updates.push('difficulty = ?'); params.push(input.difficulty); }
  if (input.distanceMeters !== undefined) { updates.push('distance_meters = ?'); params.push(input.distanceMeters); }
  if (input.elevationGainMeters !== undefined) { updates.push('elevation_gain_meters = ?'); params.push(input.elevationGainMeters); }
  if (input.estimatedMinutes !== undefined) { updates.push('estimated_minutes = ?'); params.push(input.estimatedMinutes); }
  if (input.lat !== undefined) { updates.push('lat = ?'); params.push(input.lat); }
  if (input.lng !== undefined) { updates.push('lng = ?'); params.push(input.lng); }
  if (input.region !== undefined) { updates.push('region = ?'); params.push(input.region); }
  if (input.description !== undefined) { updates.push('description = ?'); params.push(input.description); }
  if (input.isSaved !== undefined) { updates.push('is_saved = ?'); params.push(input.isSaved ? 1 : 0); }

  if (updates.length === 0) return existing;

  params.push(id);

  // Determine whether any hub-place-relevant field is being patched. Only
  // name, lat, lng propagate to hub_places.
  const hubPatch: { name?: string; lat?: number; lng?: number } = {};
  if (input.name !== undefined) hubPatch.name = input.name;
  if (input.lat !== undefined) hubPatch.lat = input.lat;
  if (input.lng !== undefined) hubPatch.lng = input.lng;
  const hasHubPatch = Object.keys(hubPatch).length > 0;

  db.transaction(() => {
    db.execute(`UPDATE tr_trails SET ${updates.join(', ')} WHERE id = ?`, params);

    if (hasHubPatch) {
      const pointerRows = db.query<{ hub_place_id: string | null }>(
        `SELECT hub_place_id FROM tr_trails WHERE id = ?`,
        [id],
      );
      const hubPlaceId = pointerRows[0]?.hub_place_id ?? null;
      if (hubPlaceId !== null) {
        updatePlace(db, hubPlaceId, hubPatch);
      }
    }
  });

  return getTrail(db, id);
}

export function deleteTrail(db: DatabaseAdapter, id: string): boolean {
  db.transaction(() => {
    const pointerRows = db.query<{ hub_place_id: string | null }>(
      `SELECT hub_place_id FROM tr_trails WHERE id = ?`,
      [id],
    );
    const hubPlaceId = pointerRows[0]?.hub_place_id ?? null;

    db.execute(`DELETE FROM tr_trails WHERE id = ?`, [id]);

    if (hubPlaceId !== null) {
      deletePlace(db, hubPlaceId);
    }
  });
  return true;
}

// ── Recordings ─────────────────────────────────────────────────────────

export function createRecording(
  db: DatabaseAdapter,
  id: string,
  rawInput: CreateRecordingInput,
): TrailRecording {
  const input = CreateRecordingInputSchema.parse(rawInput);
  const now = nowIso();

  db.execute(
    `INSERT INTO tr_recordings (
       id,
       trail_id,
       name,
       activity_type,
       started_at,
       ended_at,
       distance_meters,
       elevation_gain_meters,
       duration_seconds,
       notes,
       is_private,
       activity_rating,
       gpx_data,
       created_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.trailId ?? null,
      input.name,
      input.activityType,
      input.startedAt,
      input.endedAt ?? null,
      input.distanceMeters,
      input.elevationGainMeters,
      input.durationSeconds,
      input.notes ?? null,
      input.isPrivate ? 1 : 0,
      input.activityRating ?? null,
      input.gpxData ?? null,
      now,
    ],
  );

  return {
    id,
    trailId: input.trailId ?? null,
    name: input.name,
    activityType: input.activityType,
    startedAt: input.startedAt,
    endedAt: input.endedAt ?? null,
    distanceMeters: input.distanceMeters,
    elevationGainMeters: input.elevationGainMeters,
    durationSeconds: input.durationSeconds,
    notes: input.notes ?? null,
    isPrivate: input.isPrivate ?? false,
    activityRating: input.activityRating ?? null,
    gpxData: input.gpxData ?? null,
    createdAt: now,
  };
}

export function getRecording(db: DatabaseAdapter, id: string): TrailRecording | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM tr_recordings WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rowToRecording(rows[0]) : null;
}

export function getRecordings(
  db: DatabaseAdapter,
  options?: { activityType?: string; limit?: number; offset?: number },
): TrailRecording[] {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options?.activityType) {
    conditions.push('activity_type = ?');
    params.push(options.activityType);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = options?.limit ?? 100;
  const offset = options?.offset ?? 0;

  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM tr_recordings ${where} ORDER BY started_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  return rows.map(rowToRecording);
}

export function getRecordingsByTrail(
  db: DatabaseAdapter,
  trailId: string,
): TrailRecording[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM tr_recordings WHERE trail_id = ? ORDER BY started_at DESC LIMIT 200`,
    [trailId],
  );
  return rows.map(rowToRecording);
}

export function updateRecording(
  db: DatabaseAdapter,
  id: string,
  rawInput: UpdateRecordingInput,
): TrailRecording | null {
  const existing = getRecording(db, id);
  if (!existing) return null;

  const input = UpdateRecordingInputSchema.parse(rawInput);
  const updates: string[] = [];
  const params: unknown[] = [];

  if (input.trailId !== undefined) { updates.push('trail_id = ?'); params.push(input.trailId); }
  if (input.name !== undefined) { updates.push('name = ?'); params.push(input.name); }
  if (input.activityType !== undefined) { updates.push('activity_type = ?'); params.push(input.activityType); }
  if (input.startedAt !== undefined) { updates.push('started_at = ?'); params.push(input.startedAt); }
  if (input.endedAt !== undefined) { updates.push('ended_at = ?'); params.push(input.endedAt); }
  if (input.distanceMeters !== undefined) { updates.push('distance_meters = ?'); params.push(input.distanceMeters); }
  if (input.elevationGainMeters !== undefined) { updates.push('elevation_gain_meters = ?'); params.push(input.elevationGainMeters); }
  if (input.durationSeconds !== undefined) { updates.push('duration_seconds = ?'); params.push(input.durationSeconds); }
  if (input.notes !== undefined) { updates.push('notes = ?'); params.push(input.notes); }
  if (input.isPrivate !== undefined) { updates.push('is_private = ?'); params.push(input.isPrivate ? 1 : 0); }
  if (input.activityRating !== undefined) { updates.push('activity_rating = ?'); params.push(input.activityRating); }
  if (input.gpxData !== undefined) { updates.push('gpx_data = ?'); params.push(input.gpxData); }

  if (updates.length === 0) {
    return existing;
  }

  params.push(id);
  db.execute(`UPDATE tr_recordings SET ${updates.join(', ')} WHERE id = ?`, params);
  return getRecording(db, id);
}

export function deleteRecording(db: DatabaseAdapter, id: string): boolean {
  db.execute(`DELETE FROM tr_recordings WHERE id = ?`, [id]);
  return true;
}

export function exportRecordingAsGPX(db: DatabaseAdapter, id: string): string | null {
  const recording = getRecording(db, id);
  if (!recording) return null;

  const waypoints = getWaypointsByRecording(db, id);
  const trackPoints = waypoints.map((waypoint) => {
    const elevationTag = waypoint.elevation !== null ? `\n        <ele>${waypoint.elevation.toFixed(2)}</ele>` : '';
    return `      <trkpt lat="${waypoint.lat.toFixed(6)}" lon="${waypoint.lng.toFixed(6)}">${elevationTag}\n        <time>${waypoint.timestamp}</time>\n      </trkpt>`;
  }).join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="MyTrails" xmlns="http://www.topografix.com/GPX/1/1">',
    '  <metadata>',
    `    <name>${escapeXml(recording.name)}</name>`,
    `    <time>${recording.startedAt}</time>`,
    '  </metadata>',
    '  <trk>',
    `    <name>${escapeXml(recording.name)}</name>`,
    `    <type>${escapeXml(recording.activityType)}</type>`,
    '    <trkseg>',
    trackPoints,
    '    </trkseg>',
    '  </trk>',
    '</gpx>',
  ].join('\n');
}

// ── Waypoints ──────────────────────────────────────────────────────────

export function createWaypoint(
  db: DatabaseAdapter,
  id: string,
  rawInput: CreateWaypointInput,
): Waypoint {
  const input = CreateWaypointInputSchema.parse(rawInput);
  const now = nowIso();

  db.execute(
    `INSERT INTO tr_waypoints (id, recording_id, lat, lng, elevation, timestamp, accuracy, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.recordingId,
      input.lat,
      input.lng,
      input.elevation ?? null,
      input.timestamp,
      input.accuracy ?? null,
      now,
    ],
  );

  return {
    id,
    recordingId: input.recordingId,
    lat: input.lat,
    lng: input.lng,
    elevation: input.elevation ?? null,
    timestamp: input.timestamp,
    accuracy: input.accuracy ?? null,
    createdAt: now,
  };
}

export function getWaypointsByRecording(
  db: DatabaseAdapter,
  recordingId: string,
): Waypoint[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM tr_waypoints WHERE recording_id = ? ORDER BY timestamp ASC`,
    [recordingId],
  );
  return rows.map(rowToWaypoint);
}

export function getTrailPhotos(
  db: DatabaseAdapter,
  trailId: string,
  limit = 12,
): TrailPhoto[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT *
     FROM tr_photos
     WHERE trail_id = ?
        OR recording_id IN (
          SELECT id
          FROM tr_recordings
          WHERE trail_id = ?
        )
     ORDER BY datetime(taken_at) DESC, datetime(created_at) DESC
     LIMIT ?`,
    [trailId, trailId, limit],
  );
  return rows.map(rowToTrailPhoto);
}

// ── Stats ──────────────────────────────────────────────────────────────

export function getTrailStats(db: DatabaseAdapter): TrailStats {
  const rows = db.query<{
    total_recordings: number;
    total_distance: number;
    total_elevation: number;
    total_duration: number;
  }>(
    `SELECT
       COUNT(*) as total_recordings,
       COALESCE(SUM(distance_meters), 0) as total_distance,
       COALESCE(SUM(elevation_gain_meters), 0) as total_elevation,
       COALESCE(SUM(duration_seconds), 0) as total_duration
     FROM tr_recordings`,
  );

  const r = rows[0];
  const totalDistanceKm = r.total_distance / 1000;
  const totalDurationMin = r.total_duration / 60;
  const averagePace = totalDistanceKm > 0 ? totalDurationMin / totalDistanceKm : null;

  return {
    totalRecordings: r.total_recordings,
    totalDistanceMeters: r.total_distance,
    totalElevationGainMeters: r.total_elevation,
    totalDurationSeconds: r.total_duration,
    averagePaceMinPerKm: averagePace,
  };
}

// ── Photos ────────────────────────────────────────────────────────────

export function getPhotos(
  db: DatabaseAdapter,
  options?: {
    trailId?: string;
    recordingId?: string;
    startDate?: string;
    endDate?: string;
    hasLocation?: boolean;
    limit?: number;
    offset?: number;
  },
): TrailPhoto[] {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options?.trailId) {
    conditions.push('trail_id = ?');
    params.push(options.trailId);
  }

  if (options?.recordingId) {
    conditions.push('recording_id = ?');
    params.push(options.recordingId);
  }

  if (options?.startDate) {
    conditions.push('taken_at >= ?');
    params.push(options.startDate);
  }

  if (options?.endDate) {
    conditions.push('taken_at <= ?');
    params.push(options.endDate);
  }

  if (options?.hasLocation) {
    conditions.push('lat IS NOT NULL AND lng IS NOT NULL');
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = options?.limit ?? 200;
  const offset = options?.offset ?? 0;

  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM tr_photos ${where} ORDER BY taken_at DESC, created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  return rows.map(rowToTrailPhoto);
}

export function createPhoto(
  db: DatabaseAdapter,
  id: string,
  rawInput: CreateTrailPhotoInput,
): TrailPhoto {
  const input = CreateTrailPhotoInputSchema.parse(rawInput);
  const now = nowIso();

  db.execute(
    `INSERT INTO tr_photos (id, recording_id, trail_id, lat, lng, uri, caption, taken_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.recordingId ?? null,
      input.trailId ?? null,
      input.lat,
      input.lng,
      input.uri,
      input.caption ?? null,
      input.takenAt,
      now,
    ],
  );

  return {
    id,
    recordingId: input.recordingId ?? null,
    trailId: input.trailId ?? null,
    lat: input.lat,
    lng: input.lng,
    uri: input.uri,
    caption: input.caption ?? null,
    takenAt: input.takenAt,
    createdAt: now,
  };
}

export function getPhotosByRecording(db: DatabaseAdapter, recordingId: string): TrailPhoto[] {
  return getPhotos(db, { recordingId, limit: 400 });
}

export function getPhotosByTrail(db: DatabaseAdapter, trailId: string): TrailPhoto[] {
  return getPhotos(db, { trailId, limit: 400 });
}

export function getPhotosByDateRange(
  db: DatabaseAdapter,
  startDate: string,
  endDate: string,
): TrailPhoto[] {
  return getPhotos(db, { startDate, endDate, limit: 400 });
}

// ── Offline Regions ───────────────────────────────────────────────────

function rowToOfflineRegion(row: Record<string, unknown>): OfflineRegion {
  return {
    id: row.id as string,
    name: row.name as string,
    regionKey: row.region_key as string,
    minLat: row.min_lat as number,
    maxLat: row.max_lat as number,
    minLng: row.min_lng as number,
    maxLng: row.max_lng as number,
    minZoom: row.min_zoom as number,
    maxZoom: row.max_zoom as number,
    tileCount: row.tile_count as number,
    sizeBytes: row.size_bytes as number,
    status: row.status as OfflineRegion['status'],
    progress: row.progress as number,
    downloadedAt: (row.downloaded_at as string) ?? null,
    expiresAt: (row.expires_at as string) ?? null,
    errorMessage: (row.error_message as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function createOfflineRegion(
  db: DatabaseAdapter,
  id: string,
  rawInput: CreateOfflineRegionInput,
): OfflineRegion {
  const input = CreateOfflineRegionInputSchema.parse(rawInput);
  const now = nowIso();

  db.execute(
    `INSERT INTO tr_offline_regions (id, name, region_key, min_lat, max_lat, min_lng, max_lng, min_zoom, max_zoom, status, progress, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0.0, ?, ?)`,
    [
      id,
      input.name,
      input.regionKey,
      input.minLat,
      input.maxLat,
      input.minLng,
      input.maxLng,
      input.minZoom ?? 1,
      input.maxZoom ?? 15,
      now,
      now,
    ],
  );

  return {
    id,
    name: input.name,
    regionKey: input.regionKey,
    minLat: input.minLat,
    maxLat: input.maxLat,
    minLng: input.minLng,
    maxLng: input.maxLng,
    minZoom: input.minZoom ?? 1,
    maxZoom: input.maxZoom ?? 15,
    tileCount: 0,
    sizeBytes: 0,
    status: 'pending',
    progress: 0.0,
    downloadedAt: null,
    expiresAt: null,
    errorMessage: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function getOfflineRegion(db: DatabaseAdapter, id: string): OfflineRegion | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM tr_offline_regions WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rowToOfflineRegion(rows[0]) : null;
}

export function getOfflineRegions(db: DatabaseAdapter): OfflineRegion[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM tr_offline_regions ORDER BY created_at DESC LIMIT 100`,
  );
  return rows.map(rowToOfflineRegion);
}

export function getReadyRegions(db: DatabaseAdapter): OfflineRegion[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM tr_offline_regions WHERE status = 'ready' ORDER BY name ASC`,
  );
  return rows.map(rowToOfflineRegion);
}

export function getStaleRegions(db: DatabaseAdapter): OfflineRegion[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM tr_offline_regions WHERE status = 'ready' AND downloaded_at IS NOT NULL AND datetime(downloaded_at, '+30 days') < datetime('now') ORDER BY downloaded_at ASC`,
  );
  return rows.map(rowToOfflineRegion);
}

export function updateRegionProgress(
  db: DatabaseAdapter,
  id: string,
  progress: number,
  tileCount: number,
): void {
  const now = nowIso();
  db.execute(
    `UPDATE tr_offline_regions SET status = 'downloading', progress = ?, tile_count = ?, updated_at = ? WHERE id = ?`,
    [progress, tileCount, now, id],
  );
}

export function markRegionReady(
  db: DatabaseAdapter,
  id: string,
  sizeBytes: number,
  tileCount: number,
): void {
  const now = nowIso();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  db.execute(
    `UPDATE tr_offline_regions SET status = 'ready', progress = 1.0, size_bytes = ?, tile_count = ?, downloaded_at = ?, expires_at = ?, error_message = NULL, updated_at = ? WHERE id = ?`,
    [sizeBytes, tileCount, now, expiresAt, now, id],
  );
}

export function markRegionError(
  db: DatabaseAdapter,
  id: string,
  errorMessage: string,
): void {
  const now = nowIso();
  db.execute(
    `UPDATE tr_offline_regions SET status = 'error', error_message = ?, updated_at = ? WHERE id = ?`,
    [errorMessage, now, id],
  );
}

export function resetRegionToPending(db: DatabaseAdapter, id: string): void {
  const now = nowIso();
  db.execute(
    `UPDATE tr_offline_regions SET status = 'pending', progress = 0.0, error_message = NULL, updated_at = ? WHERE id = ?`,
    [now, id],
  );
}

export function deleteOfflineRegion(db: DatabaseAdapter, id: string): string | null {
  const region = getOfflineRegion(db, id);
  if (!region) return null;
  db.execute(`DELETE FROM tr_offline_regions WHERE id = ?`, [id]);
  return region.regionKey;
}

// ── Alert Settings ────────────────────────────────────────────────────

function rowToAlertSettings(row: Record<string, unknown>): AlertSettings {
  return {
    id: row.id as string,
    deviationThresholdMeters: row.deviation_threshold_meters as number,
    alertCooldownSeconds: row.alert_cooldown_seconds as number,
    vibrationEnabled: (row.vibration_enabled as number) === 1,
    soundEnabled: (row.sound_enabled as number) === 1,
    autoPauseOnDeviation: (row.auto_pause_on_deviation as number) === 1,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function getAlertSettings(db: DatabaseAdapter): AlertSettings {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM tr_alert_settings LIMIT 1`,
  );
  if (rows.length > 0) return rowToAlertSettings(rows[0]);
  return createAlertSettings(db, 'default-alert-settings');
}

export function createAlertSettings(
  db: DatabaseAdapter,
  id: string,
): AlertSettings {
  const now = nowIso();
  db.execute(
    `INSERT OR IGNORE INTO tr_alert_settings (id, created_at, updated_at)
     VALUES (?, ?, ?)`,
    [id, now, now],
  );
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM tr_alert_settings WHERE id = ?`,
    [id],
  );
  return rowToAlertSettings(rows[0]);
}

export function updateAlertSettings(
  db: DatabaseAdapter,
  rawInput: UpdateAlertSettingsInput,
): AlertSettings {
  const settings = getAlertSettings(db);
  const input = UpdateAlertSettingsInputSchema.parse(rawInput);
  const updates: string[] = [];
  const params: unknown[] = [];

  if (input.deviationThresholdMeters !== undefined) {
    updates.push('deviation_threshold_meters = ?');
    params.push(input.deviationThresholdMeters);
  }
  if (input.alertCooldownSeconds !== undefined) {
    updates.push('alert_cooldown_seconds = ?');
    params.push(input.alertCooldownSeconds);
  }
  if (input.vibrationEnabled !== undefined) {
    updates.push('vibration_enabled = ?');
    params.push(input.vibrationEnabled ? 1 : 0);
  }
  if (input.soundEnabled !== undefined) {
    updates.push('sound_enabled = ?');
    params.push(input.soundEnabled ? 1 : 0);
  }
  if (input.autoPauseOnDeviation !== undefined) {
    updates.push('auto_pause_on_deviation = ?');
    params.push(input.autoPauseOnDeviation ? 1 : 0);
  }

  if (updates.length === 0) return settings;

  const now = nowIso();
  updates.push('updated_at = ?');
  params.push(now);
  params.push(settings.id);

  db.execute(
    `UPDATE tr_alert_settings SET ${updates.join(', ')} WHERE id = ?`,
    params,
  );

  return getAlertSettings(db);
}

// ── Deviation Events ──────────────────────────────────────────────────

function rowToDeviationEvent(row: Record<string, unknown>): DeviationEvent {
  return {
    id: row.id as string,
    recordingId: row.recording_id as string,
    trailId: (row.trail_id as string) ?? null,
    lat: row.lat as number,
    lng: row.lng as number,
    deviationMeters: row.deviation_meters as number,
    nearestTrailLat: row.nearest_trail_lat as number,
    nearestTrailLng: row.nearest_trail_lng as number,
    acknowledged: (row.acknowledged as number) === 1,
    createdAt: row.created_at as string,
  };
}

export function createDeviationEvent(
  db: DatabaseAdapter,
  id: string,
  rawInput: CreateDeviationEventInput,
): DeviationEvent {
  const input = CreateDeviationEventInputSchema.parse(rawInput);
  const now = nowIso();

  db.execute(
    `INSERT INTO tr_deviation_events (id, recording_id, trail_id, lat, lng, deviation_meters, nearest_trail_lat, nearest_trail_lng, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.recordingId,
      input.trailId ?? null,
      input.lat,
      input.lng,
      input.deviationMeters,
      input.nearestTrailLat,
      input.nearestTrailLng,
      now,
    ],
  );

  return {
    id,
    recordingId: input.recordingId,
    trailId: input.trailId ?? null,
    lat: input.lat,
    lng: input.lng,
    deviationMeters: input.deviationMeters,
    nearestTrailLat: input.nearestTrailLat,
    nearestTrailLng: input.nearestTrailLng,
    acknowledged: false,
    createdAt: now,
  };
}

export function getDeviationsByRecording(
  db: DatabaseAdapter,
  recordingId: string,
): DeviationEvent[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM tr_deviation_events WHERE recording_id = ? ORDER BY created_at ASC`,
    [recordingId],
  );
  return rows.map(rowToDeviationEvent);
}

export function getDeviationEvents(
  db: DatabaseAdapter,
  limit = 20,
): DeviationEvent[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM tr_deviation_events ORDER BY created_at DESC LIMIT ?`,
    [limit],
  );
  return rows.map(rowToDeviationEvent);
}

export function acknowledgeDeviation(db: DatabaseAdapter, id: string): void {
  db.execute(
    `UPDATE tr_deviation_events SET acknowledged = 1 WHERE id = ?`,
    [id],
  );
}

// ── Weather Cache ─────────────────────────────────────────────────────

function rowToWeatherCache(row: Record<string, unknown>): WeatherCache {
  return {
    id: row.id as string,
    lat: row.lat as number,
    lng: row.lng as number,
    conditionsJson: row.conditions_json as string,
    fetchedAt: row.fetched_at as string,
    expiresAt: row.expires_at as string,
    createdAt: row.created_at as string,
  };
}

export function cacheWeather(
  db: DatabaseAdapter,
  id: string,
  lat: number,
  lng: number,
  conditionsJson: string,
  fetchedAt: string,
  expiresAt: string,
): WeatherCache {
  const now = nowIso();
  const roundedLat = Math.round(lat * 100) / 100;
  const roundedLng = Math.round(lng * 100) / 100;

  db.execute(
    `INSERT INTO tr_weather_cache (id, lat, lng, conditions_json, fetched_at, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, roundedLat, roundedLng, conditionsJson, fetchedAt, expiresAt, now],
  );

  return {
    id,
    lat: roundedLat,
    lng: roundedLng,
    conditionsJson,
    fetchedAt,
    expiresAt,
    createdAt: now,
  };
}

export function getCachedWeather(
  db: DatabaseAdapter,
  lat: number,
  lng: number,
): WeatherCache | null {
  const roundedLat = Math.round(lat * 100) / 100;
  const roundedLng = Math.round(lng * 100) / 100;

  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM tr_weather_cache WHERE lat = ? AND lng = ? ORDER BY fetched_at DESC LIMIT 1`,
    [roundedLat, roundedLng],
  );
  return rows.length > 0 ? rowToWeatherCache(rows[0]) : null;
}

export function cleanExpiredCache(db: DatabaseAdapter): number {
  const now = nowIso();
  const before = db.query<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM tr_weather_cache WHERE expires_at < ?`,
    [now],
  );
  const count = before[0]?.cnt ?? 0;
  db.execute(`DELETE FROM tr_weather_cache WHERE expires_at < ?`, [now]);
  return count;
}

// ── Segments ──────────────────────────────────────────────────────────

function rowToSegment(row: Record<string, unknown>): Segment {
  return {
    id: row.id as string,
    trailId: row.trail_id as string,
    name: row.name as string,
    startLat: row.start_lat as number,
    startLng: row.start_lng as number,
    endLat: row.end_lat as number,
    endLng: row.end_lng as number,
    distanceMeters: row.distance_meters as number,
    elevationGainMeters: row.elevation_gain_meters as number,
    createdAt: row.created_at as string,
  };
}

function rowToSegmentEffort(row: Record<string, unknown>): SegmentEffort {
  return {
    id: row.id as string,
    segmentId: row.segment_id as string,
    recordingId: row.recording_id as string,
    durationSeconds: row.duration_seconds as number,
    paceMinPerKm: (row.pace_min_per_km as number) ?? null,
    startedAt: row.started_at as string,
    endedAt: row.ended_at as string,
    isPersonalBest: (row.is_personal_best as number) === 1,
    createdAt: row.created_at as string,
  };
}

export function createSegment(
  db: DatabaseAdapter,
  id: string,
  rawInput: CreateSegmentInput,
): Segment {
  const input = CreateSegmentInputSchema.parse(rawInput);
  const now = nowIso();

  db.execute(
    `INSERT INTO tr_segments (id, trail_id, name, start_lat, start_lng, end_lat, end_lng, distance_meters, elevation_gain_meters, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.trailId,
      input.name,
      input.startLat,
      input.startLng,
      input.endLat,
      input.endLng,
      input.distanceMeters,
      input.elevationGainMeters,
      now,
    ],
  );

  return {
    id,
    trailId: input.trailId,
    name: input.name,
    startLat: input.startLat,
    startLng: input.startLng,
    endLat: input.endLat,
    endLng: input.endLng,
    distanceMeters: input.distanceMeters,
    elevationGainMeters: input.elevationGainMeters,
    createdAt: now,
  };
}

export function getSegmentsByTrail(
  db: DatabaseAdapter,
  trailId: string,
): Segment[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM tr_segments WHERE trail_id = ? ORDER BY created_at ASC`,
    [trailId],
  );
  return rows.map(rowToSegment);
}

export function createSegmentEffort(
  db: DatabaseAdapter,
  id: string,
  rawInput: CreateSegmentEffortInput,
): SegmentEffort {
  const input = CreateSegmentEffortInputSchema.parse(rawInput);
  const now = nowIso();
  let isPB = false;

  db.transaction(() => {
    // Check if this is a personal best
    const existing = db.query<{ duration_seconds: number }>(
      `SELECT duration_seconds FROM tr_segment_efforts WHERE segment_id = ? ORDER BY duration_seconds ASC LIMIT 1`,
      [input.segmentId],
    );
    isPB = existing.length === 0 || input.durationSeconds < existing[0].duration_seconds;

    // If this is PB, clear previous PB flags
    if (isPB) {
      db.execute(
        `UPDATE tr_segment_efforts SET is_personal_best = 0 WHERE segment_id = ?`,
        [input.segmentId],
      );
    }

    db.execute(
      `INSERT INTO tr_segment_efforts (id, segment_id, recording_id, duration_seconds, pace_min_per_km, started_at, ended_at, is_personal_best, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.segmentId,
        input.recordingId,
        input.durationSeconds,
        input.paceMinPerKm ?? null,
        input.startedAt,
        input.endedAt,
        isPB ? 1 : 0,
        now,
      ],
    );
  });

  return {
    id,
    segmentId: input.segmentId,
    recordingId: input.recordingId,
    durationSeconds: input.durationSeconds,
    paceMinPerKm: input.paceMinPerKm ?? null,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    isPersonalBest: isPB,
    createdAt: now,
  };
}

export function getEffortsBySegment(
  db: DatabaseAdapter,
  segmentId: string,
): SegmentEffort[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM tr_segment_efforts WHERE segment_id = ? ORDER BY duration_seconds ASC`,
    [segmentId],
  );
  return rows.map(rowToSegmentEffort);
}

export function getSegmentEffortsByRecording(
  db: DatabaseAdapter,
  recordingId: string,
): SegmentEffort[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM tr_segment_efforts WHERE recording_id = ? ORDER BY started_at ASC`,
    [recordingId],
  );
  return rows.map(rowToSegmentEffort);
}

export function getPersonalBest(
  db: DatabaseAdapter,
  segmentId: string,
): SegmentEffort | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM tr_segment_efforts WHERE segment_id = ? AND is_personal_best = 1 LIMIT 1`,
    [segmentId],
  );
  return rows.length > 0 ? rowToSegmentEffort(rows[0]) : null;
}

export function recalculatePersonalBest(
  db: DatabaseAdapter,
  segmentId: string,
): void {
  // Clear all PB flags
  db.execute(
    `UPDATE tr_segment_efforts SET is_personal_best = 0 WHERE segment_id = ?`,
    [segmentId],
  );
  // Find the fastest and set as PB
  const rows = db.query<{ id: string }>(
    `SELECT id FROM tr_segment_efforts WHERE segment_id = ? ORDER BY duration_seconds ASC LIMIT 1`,
    [segmentId],
  );
  if (rows.length > 0) {
    db.execute(
      `UPDATE tr_segment_efforts SET is_personal_best = 1 WHERE id = ?`,
      [rows[0].id],
    );
  }
}

// ── Packing Templates & Items ─────────────────────────────────────────

function rowToPackingTemplate(row: Record<string, unknown>): PackingTemplate {
  return {
    id: row.id as string,
    name: row.name as string,
    type: row.type as PackingTemplate['type'],
    isBuiltIn: (row.is_built_in as number) === 1,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToPackingItem(row: Record<string, unknown>): PackingItem {
  return {
    id: row.id as string,
    templateId: row.template_id as string,
    name: row.name as string,
    category: row.category as string,
    isChecked: (row.is_checked as number) === 1,
    sortOrder: row.sort_order as number,
    createdAt: row.created_at as string,
  };
}

export function createPackingTemplate(
  db: DatabaseAdapter,
  id: string,
  name: string,
  type: string,
  isBuiltIn = false,
): PackingTemplate {
  const now = nowIso();
  db.execute(
    `INSERT INTO tr_packing_templates (id, name, type, is_built_in, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, name, type, isBuiltIn ? 1 : 0, now, now],
  );

  return {
    id,
    name,
    type: type as PackingTemplate['type'],
    isBuiltIn,
    createdAt: now,
    updatedAt: now,
  };
}

export function getPackingTemplates(db: DatabaseAdapter): PackingTemplate[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM tr_packing_templates ORDER BY is_built_in DESC, name ASC`,
  );
  return rows.map(rowToPackingTemplate);
}

export function getPackingTemplate(
  db: DatabaseAdapter,
  id: string,
): PackingTemplate | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM tr_packing_templates WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rowToPackingTemplate(rows[0]) : null;
}

export function createPackingItem(
  db: DatabaseAdapter,
  id: string,
  rawInput: CreatePackingItemInput,
): PackingItem {
  const input = CreatePackingItemInputSchema.parse(rawInput);
  const now = nowIso();
  const sortOrder = input.sortOrder ?? 0;

  db.execute(
    `INSERT INTO tr_packing_items (id, template_id, name, category, is_checked, sort_order, created_at)
     VALUES (?, ?, ?, ?, 0, ?, ?)`,
    [id, input.templateId, input.name, input.category, sortOrder, now],
  );

  return {
    id,
    templateId: input.templateId,
    name: input.name,
    category: input.category,
    isChecked: false,
    sortOrder,
    createdAt: now,
  };
}

export function getPackingItems(
  db: DatabaseAdapter,
  templateId: string,
): PackingItem[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM tr_packing_items WHERE template_id = ? ORDER BY category ASC, sort_order ASC`,
    [templateId],
  );
  return rows.map(rowToPackingItem);
}

export function updatePackingItem(
  db: DatabaseAdapter,
  id: string,
  rawInput: UpdatePackingItemInput,
): PackingItem | null {
  const input = UpdatePackingItemInputSchema.parse(rawInput);
  const updates: string[] = [];
  const params: unknown[] = [];

  if (input.name !== undefined) {
    updates.push('name = ?');
    params.push(input.name);
  }
  if (input.category !== undefined) {
    updates.push('category = ?');
    params.push(input.category);
  }
  if (input.isChecked !== undefined) {
    updates.push('is_checked = ?');
    params.push(input.isChecked ? 1 : 0);
  }
  if (input.sortOrder !== undefined) {
    updates.push('sort_order = ?');
    params.push(input.sortOrder);
  }

  if (updates.length === 0) {
    const rows = db.query<Record<string, unknown>>(
      `SELECT * FROM tr_packing_items WHERE id = ?`,
      [id],
    );
    return rows.length > 0 ? rowToPackingItem(rows[0]) : null;
  }

  params.push(id);
  db.execute(`UPDATE tr_packing_items SET ${updates.join(', ')} WHERE id = ?`, params);

  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM tr_packing_items WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rowToPackingItem(rows[0]) : null;
}

export function checkItem(db: DatabaseAdapter, id: string): void {
  db.execute(`UPDATE tr_packing_items SET is_checked = 1 WHERE id = ?`, [id]);
}

export function uncheckItem(db: DatabaseAdapter, id: string): void {
  db.execute(`UPDATE tr_packing_items SET is_checked = 0 WHERE id = ?`, [id]);
}

export function uncheckAll(db: DatabaseAdapter, templateId: string): void {
  db.execute(
    `UPDATE tr_packing_items SET is_checked = 0 WHERE template_id = ?`,
    [templateId],
  );
}

export function deletePackingTemplate(db: DatabaseAdapter, id: string): boolean {
  db.execute(`DELETE FROM tr_packing_templates WHERE id = ?`, [id]);
  return true;
}

export function deletePackingItem(db: DatabaseAdapter, id: string): boolean {
  db.execute(`DELETE FROM tr_packing_items WHERE id = ?`, [id]);
  return true;
}

export function getPackingProgress(
  db: DatabaseAdapter,
  templateId: string,
): { total: number; checked: number } {
  const rows = db.query<{ total: number; checked: number }>(
    `SELECT COUNT(*) as total, SUM(CASE WHEN is_checked = 1 THEN 1 ELSE 0 END) as checked
     FROM tr_packing_items WHERE template_id = ?`,
    [templateId],
  );
  return { total: rows[0].total, checked: rows[0].checked ?? 0 };
}

// ── Trips ─────────────────────────────────────────────────────────────

function rowToTrip(row: Record<string, unknown>): Trip {
  return {
    id: row.id as string,
    name: row.name as string,
    startDate: (row.start_date as string) ?? null,
    endDate: (row.end_date as string) ?? null,
    notes: (row.notes as string) ?? null,
    packingTemplateId: (row.packing_template_id as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToTripDay(row: Record<string, unknown>): TripDay {
  return {
    id: row.id as string,
    tripId: row.trip_id as string,
    dayNumber: row.day_number as number,
    date: (row.date as string) ?? null,
    title: (row.title as string) ?? null,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function rowToTripActivity(row: Record<string, unknown>): TripActivity {
  return {
    id: row.id as string,
    dayId: row.day_id as string,
    trailId: (row.trail_id as string) ?? null,
    type: row.type as TripActivity['type'],
    name: row.name as string,
    description: (row.description as string) ?? null,
    sortOrder: row.sort_order as number,
    createdAt: row.created_at as string,
  };
}

export function createTrip(
  db: DatabaseAdapter,
  id: string,
  rawInput: CreateTripInput,
): Trip {
  const input = CreateTripInputSchema.parse(rawInput);
  const now = nowIso();

  db.execute(
    `INSERT INTO tr_trips (id, name, start_date, end_date, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.name,
      input.startDate ?? null,
      input.endDate ?? null,
      input.notes ?? null,
      now,
      now,
    ],
  );

  return {
    id,
    name: input.name,
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
    notes: input.notes ?? null,
    packingTemplateId: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function getTrip(db: DatabaseAdapter, id: string): Trip | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM tr_trips WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rowToTrip(rows[0]) : null;
}

export function getTrips(db: DatabaseAdapter): Trip[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM tr_trips ORDER BY created_at DESC LIMIT 200`,
  );
  return rows.map(rowToTrip);
}

export function updateTrip(
  db: DatabaseAdapter,
  id: string,
  updates: {
    name?: string;
    startDate?: string | null;
    endDate?: string | null;
    notes?: string | null;
    packingTemplateId?: string | null;
  },
): Trip | null {
  const parts: string[] = [];
  const params: unknown[] = [];

  if (updates.name !== undefined) { parts.push('name = ?'); params.push(updates.name); }
  if (updates.startDate !== undefined) { parts.push('start_date = ?'); params.push(updates.startDate); }
  if (updates.endDate !== undefined) { parts.push('end_date = ?'); params.push(updates.endDate); }
  if (updates.notes !== undefined) { parts.push('notes = ?'); params.push(updates.notes); }
  if (updates.packingTemplateId !== undefined) { parts.push('packing_template_id = ?'); params.push(updates.packingTemplateId); }

  if (parts.length === 0) return getTrip(db, id);

  const now = nowIso();
  parts.push('updated_at = ?');
  params.push(now);
  params.push(id);

  db.execute(`UPDATE tr_trips SET ${parts.join(', ')} WHERE id = ?`, params);
  return getTrip(db, id);
}

export function deleteTrip(db: DatabaseAdapter, id: string): boolean {
  db.execute(`DELETE FROM tr_trips WHERE id = ?`, [id]);
  return true;
}

export function createTripDay(
  db: DatabaseAdapter,
  id: string,
  rawInput: CreateTripDayInput,
): TripDay {
  const input = CreateTripDayInputSchema.parse(rawInput);
  const now = nowIso();

  db.execute(
    `INSERT INTO tr_trip_days (id, trip_id, day_number, date, title, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.tripId,
      input.dayNumber,
      input.date ?? null,
      input.title ?? null,
      input.notes ?? null,
      now,
    ],
  );

  return {
    id,
    tripId: input.tripId,
    dayNumber: input.dayNumber,
    date: input.date ?? null,
    title: input.title ?? null,
    notes: input.notes ?? null,
    createdAt: now,
  };
}

export function getTripDays(
  db: DatabaseAdapter,
  tripId: string,
): TripDay[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM tr_trip_days WHERE trip_id = ? ORDER BY day_number ASC`,
    [tripId],
  );
  return rows.map(rowToTripDay);
}

export function updateTripDay(
  db: DatabaseAdapter,
  id: string,
  updates: {
    dayNumber?: number;
    date?: string | null;
    title?: string | null;
    notes?: string | null;
  },
): TripDay | null {
  const parts: string[] = [];
  const params: unknown[] = [];

  if (updates.dayNumber !== undefined) { parts.push('day_number = ?'); params.push(updates.dayNumber); }
  if (updates.date !== undefined) { parts.push('date = ?'); params.push(updates.date); }
  if (updates.title !== undefined) { parts.push('title = ?'); params.push(updates.title); }
  if (updates.notes !== undefined) { parts.push('notes = ?'); params.push(updates.notes); }

  if (parts.length === 0) {
    const rows = db.query<Record<string, unknown>>(`SELECT * FROM tr_trip_days WHERE id = ?`, [id]);
    return rows.length > 0 ? rowToTripDay(rows[0]) : null;
  }

  params.push(id);
  db.execute(`UPDATE tr_trip_days SET ${parts.join(', ')} WHERE id = ?`, params);

  const rows = db.query<Record<string, unknown>>(`SELECT * FROM tr_trip_days WHERE id = ?`, [id]);
  return rows.length > 0 ? rowToTripDay(rows[0]) : null;
}

export function deleteTripDay(db: DatabaseAdapter, id: string): boolean {
  db.execute(`DELETE FROM tr_trip_days WHERE id = ?`, [id]);
  return true;
}

export function createTripActivity(
  db: DatabaseAdapter,
  id: string,
  rawInput: CreateTripActivityInput,
): TripActivity {
  const input = CreateTripActivityInputSchema.parse(rawInput);
  const now = nowIso();
  const sortOrder = input.sortOrder ?? 0;

  db.execute(
    `INSERT INTO tr_trip_activities (id, day_id, trail_id, type, name, description, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.dayId,
      input.trailId ?? null,
      input.type,
      input.name,
      input.description ?? null,
      sortOrder,
      now,
    ],
  );

  return {
    id,
    dayId: input.dayId,
    trailId: input.trailId ?? null,
    type: input.type,
    name: input.name,
    description: input.description ?? null,
    sortOrder,
    createdAt: now,
  };
}

export function getTripActivities(
  db: DatabaseAdapter,
  dayId: string,
): TripActivity[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM tr_trip_activities WHERE day_id = ? ORDER BY sort_order ASC`,
    [dayId],
  );
  return rows.map(rowToTripActivity);
}

export function updateTripActivity(
  db: DatabaseAdapter,
  id: string,
  updates: {
    name?: string;
    description?: string | null;
    type?: string;
    trailId?: string | null;
    sortOrder?: number;
  },
): TripActivity | null {
  const parts: string[] = [];
  const params: unknown[] = [];

  if (updates.name !== undefined) { parts.push('name = ?'); params.push(updates.name); }
  if (updates.description !== undefined) { parts.push('description = ?'); params.push(updates.description); }
  if (updates.type !== undefined) { parts.push('type = ?'); params.push(updates.type); }
  if (updates.trailId !== undefined) { parts.push('trail_id = ?'); params.push(updates.trailId); }
  if (updates.sortOrder !== undefined) { parts.push('sort_order = ?'); params.push(updates.sortOrder); }

  if (parts.length === 0) {
    const rows = db.query<Record<string, unknown>>(`SELECT * FROM tr_trip_activities WHERE id = ?`, [id]);
    return rows.length > 0 ? rowToTripActivity(rows[0]) : null;
  }

  params.push(id);
  db.execute(`UPDATE tr_trip_activities SET ${parts.join(', ')} WHERE id = ?`, params);

  const rows = db.query<Record<string, unknown>>(`SELECT * FROM tr_trip_activities WHERE id = ?`, [id]);
  return rows.length > 0 ? rowToTripActivity(rows[0]) : null;
}

export function deleteTripActivity(db: DatabaseAdapter, id: string): boolean {
  db.execute(`DELETE FROM tr_trip_activities WHERE id = ?`, [id]);
  return true;
}

export function reorderActivities(
  db: DatabaseAdapter,
  dayId: string,
  orderedIds: string[],
): void {
  orderedIds.forEach((actId, index) => {
    db.execute(
      `UPDATE tr_trip_activities SET sort_order = ? WHERE id = ? AND day_id = ?`,
      [index, actId, dayId],
    );
  });
}

// ── Trail Database ────────────────────────────────────────────────────

function rowToTrailDatabaseEntry(row: Record<string, unknown>): TrailDatabaseEntry {
  return {
    id: row.id as string,
    osmId: (row.osm_id as string) ?? null,
    name: row.name as string,
    description: (row.description as string) ?? null,
    difficulty: (row.difficulty as TrailDatabaseEntry['difficulty']) ?? null,
    distanceMeters: (row.distance_meters as number) ?? null,
    elevationGainMeters: (row.elevation_gain_meters as number) ?? null,
    lat: row.lat as number,
    lng: row.lng as number,
    region: (row.region as string) ?? null,
    trailType: row.trail_type as TrailDatabaseEntry['trailType'],
    surface: (row.surface as string) ?? null,
    routeGeometry: (row.route_geometry as string) ?? null,
    source: row.source as string,
    fetchedAt: row.fetched_at as string,
    createdAt: row.created_at as string,
  };
}

export function upsertDatabaseEntry(
  db: DatabaseAdapter,
  id: string,
  entry: {
    osmId?: string | null;
    name: string;
    description?: string | null;
    difficulty?: string | null;
    distanceMeters?: number | null;
    elevationGainMeters?: number | null;
    lat: number;
    lng: number;
    region?: string | null;
    trailType: string;
    surface?: string | null;
    routeGeometry?: string | null;
    source: string;
    fetchedAt: string;
  },
): TrailDatabaseEntry {
  const now = nowIso();
  db.execute(
    `INSERT OR REPLACE INTO tr_trail_database (id, osm_id, name, description, difficulty, distance_meters, elevation_gain_meters, lat, lng, region, trail_type, surface, route_geometry, source, fetched_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      entry.osmId ?? null,
      entry.name,
      entry.description ?? null,
      entry.difficulty ?? null,
      entry.distanceMeters ?? null,
      entry.elevationGainMeters ?? null,
      entry.lat,
      entry.lng,
      entry.region ?? null,
      entry.trailType,
      entry.surface ?? null,
      entry.routeGeometry ?? null,
      entry.source,
      entry.fetchedAt,
      now,
    ],
  );

  return {
    id,
    osmId: entry.osmId ?? null,
    name: entry.name,
    description: entry.description ?? null,
    difficulty: (entry.difficulty as TrailDatabaseEntry['difficulty']) ?? null,
    distanceMeters: entry.distanceMeters ?? null,
    elevationGainMeters: entry.elevationGainMeters ?? null,
    lat: entry.lat,
    lng: entry.lng,
    region: entry.region ?? null,
    trailType: entry.trailType as TrailDatabaseEntry['trailType'],
    surface: entry.surface ?? null,
    routeGeometry: entry.routeGeometry ?? null,
    source: entry.source,
    fetchedAt: entry.fetchedAt,
    createdAt: now,
  };
}

export function getDatabaseEntries(
  db: DatabaseAdapter,
  options?: {
    trailType?: string;
    difficulty?: string;
    region?: string;
    limit?: number;
    offset?: number;
  },
): TrailDatabaseEntry[] {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options?.trailType) {
    conditions.push('trail_type = ?');
    params.push(options.trailType);
  }
  if (options?.difficulty) {
    conditions.push('difficulty = ?');
    params.push(options.difficulty);
  }
  if (options?.region) {
    conditions.push('region = ?');
    params.push(options.region);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = options?.limit ?? 100;
  const offset = options?.offset ?? 0;

  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM tr_trail_database ${where} ORDER BY name ASC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  return rows.map(rowToTrailDatabaseEntry);
}

export function searchDatabaseTrails(
  db: DatabaseAdapter,
  query: string,
  limit = 50,
): TrailDatabaseEntry[] {
  const escaped = query.replace(/%/g, '\\%').replace(/_/g, '\\_');
  const pattern = `%${escaped}%`;
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM tr_trail_database WHERE name LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\' OR region LIKE ? ESCAPE '\\' ORDER BY name ASC LIMIT ?`,
    [pattern, pattern, pattern, limit],
  );
  return rows.map(rowToTrailDatabaseEntry);
}

export function getDatabaseEntry(
  db: DatabaseAdapter,
  id: string,
): TrailDatabaseEntry | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM tr_trail_database WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rowToTrailDatabaseEntry(rows[0]) : null;
}

export function saveDatabaseTrailToMyTrails(
  db: DatabaseAdapter,
  entry: TrailDatabaseEntry,
  newTrailId: string,
): Trail {
  return createTrail(db, newTrailId, {
    name: entry.name,
    difficulty: entry.difficulty ?? 'moderate',
    distanceMeters: entry.distanceMeters ?? 0,
    elevationGainMeters: entry.elevationGainMeters ?? 0,
    lat: entry.lat,
    lng: entry.lng,
    region: entry.region,
    description: entry.description,
  });
}

// ── Planned Routes & Waypoints ────────────────────────────────────────

function rowToPlannedRoute(row: Record<string, unknown>): PlannedRoute {
  return {
    id: row.id as string,
    name: row.name as string,
    distanceMeters: row.distance_meters as number,
    elevationGainMeters: row.elevation_gain_meters as number,
    estimatedMinutes: (row.estimated_minutes as number) ?? null,
    isLoop: (row.is_loop as number) === 1,
    routeGeometry: (row.route_geometry as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToRouteWaypoint(row: Record<string, unknown>): RouteWaypoint {
  return {
    id: row.id as string,
    routeId: row.route_id as string,
    lat: row.lat as number,
    lng: row.lng as number,
    sortOrder: row.sort_order as number,
    label: (row.label as string) ?? null,
    createdAt: row.created_at as string,
  };
}

export function createPlannedRoute(
  db: DatabaseAdapter,
  id: string,
  rawInput: CreatePlannedRouteInput,
): PlannedRoute {
  const input = CreatePlannedRouteInputSchema.parse(rawInput);
  const now = nowIso();

  db.execute(
    `INSERT INTO tr_planned_routes (id, name, distance_meters, elevation_gain_meters, estimated_minutes, is_loop, route_geometry, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.name,
      input.distanceMeters ?? 0,
      input.elevationGainMeters ?? 0,
      input.estimatedMinutes ?? null,
      input.isLoop ? 1 : 0,
      input.routeGeometry ?? null,
      now,
      now,
    ],
  );

  return {
    id,
    name: input.name,
    distanceMeters: input.distanceMeters ?? 0,
    elevationGainMeters: input.elevationGainMeters ?? 0,
    estimatedMinutes: input.estimatedMinutes ?? null,
    isLoop: input.isLoop ?? false,
    routeGeometry: input.routeGeometry ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

export function getPlannedRoute(
  db: DatabaseAdapter,
  id: string,
): PlannedRoute | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM tr_planned_routes WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rowToPlannedRoute(rows[0]) : null;
}

export function getPlannedRoutes(db: DatabaseAdapter): PlannedRoute[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM tr_planned_routes ORDER BY created_at DESC LIMIT 200`,
  );
  return rows.map(rowToPlannedRoute);
}

export function deletePlannedRoute(db: DatabaseAdapter, id: string): boolean {
  db.execute(`DELETE FROM tr_planned_routes WHERE id = ?`, [id]);
  return true;
}

export function createRouteWaypoint(
  db: DatabaseAdapter,
  id: string,
  rawInput: CreateRouteWaypointInput,
): RouteWaypoint {
  const input = CreateRouteWaypointInputSchema.parse(rawInput);
  const now = nowIso();

  db.execute(
    `INSERT INTO tr_route_waypoints (id, route_id, lat, lng, sort_order, label, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.routeId, input.lat, input.lng, input.sortOrder, input.label ?? null, now],
  );

  return {
    id,
    routeId: input.routeId,
    lat: input.lat,
    lng: input.lng,
    sortOrder: input.sortOrder,
    label: input.label ?? null,
    createdAt: now,
  };
}

export function getRouteWaypoints(
  db: DatabaseAdapter,
  routeId: string,
): RouteWaypoint[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM tr_route_waypoints WHERE route_id = ? ORDER BY sort_order ASC`,
    [routeId],
  );
  return rows.map(rowToRouteWaypoint);
}

export function deleteRouteWaypoint(db: DatabaseAdapter, id: string): boolean {
  db.execute(`DELETE FROM tr_route_waypoints WHERE id = ?`, [id]);
  return true;
}

// ── Reviews ───────────────────────────────────────────────────────────

function rowToTrailReview(row: Record<string, unknown>): TrailReview {
  return {
    id: row.id as string,
    trailId: row.trail_id as string,
    recordingId: (row.recording_id as string) ?? null,
    rating: row.rating as number,
    title: (row.title as string) ?? null,
    body: (row.body as string) ?? null,
    photoUris: (row.photo_uris as string) ?? null,
    conditions: (row.conditions as string) ?? null,
    visitedAt: (row.visited_at as string) ?? null,
    isShared: (row.is_shared as number) === 1,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function createReview(
  db: DatabaseAdapter,
  id: string,
  rawInput: CreateReviewInput,
): TrailReview {
  const input = CreateReviewInputSchema.parse(rawInput);
  const now = nowIso();

  db.execute(
    `INSERT INTO tr_reviews (id, trail_id, recording_id, rating, title, body, photo_uris, conditions, visited_at, is_shared, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [
      id,
      input.trailId,
      input.recordingId ?? null,
      input.rating,
      input.title ?? null,
      input.body ?? null,
      input.photoUris ?? null,
      input.conditions ?? null,
      input.visitedAt ?? null,
      now,
      now,
    ],
  );

  return {
    id,
    trailId: input.trailId,
    recordingId: input.recordingId ?? null,
    rating: input.rating,
    title: input.title ?? null,
    body: input.body ?? null,
    photoUris: input.photoUris ?? null,
    conditions: input.conditions ?? null,
    visitedAt: input.visitedAt ?? null,
    isShared: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function getReviewsByTrail(
  db: DatabaseAdapter,
  trailId: string,
): TrailReview[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM tr_reviews WHERE trail_id = ? ORDER BY created_at DESC LIMIT 200`,
    [trailId],
  );
  return rows.map(rowToTrailReview);
}

export function updateReview(
  db: DatabaseAdapter,
  id: string,
  updates: {
    rating?: number;
    title?: string | null;
    body?: string | null;
    photoUris?: string | null;
    conditions?: string | null;
    visitedAt?: string | null;
    isShared?: boolean;
  },
): TrailReview | null {
  const parts: string[] = [];
  const params: unknown[] = [];

  if (updates.rating !== undefined) { parts.push('rating = ?'); params.push(updates.rating); }
  if (updates.title !== undefined) { parts.push('title = ?'); params.push(updates.title); }
  if (updates.body !== undefined) { parts.push('body = ?'); params.push(updates.body); }
  if (updates.photoUris !== undefined) { parts.push('photo_uris = ?'); params.push(updates.photoUris); }
  if (updates.conditions !== undefined) { parts.push('conditions = ?'); params.push(updates.conditions); }
  if (updates.visitedAt !== undefined) { parts.push('visited_at = ?'); params.push(updates.visitedAt); }
  if (updates.isShared !== undefined) { parts.push('is_shared = ?'); params.push(updates.isShared ? 1 : 0); }

  if (parts.length === 0) {
    const rows = db.query<Record<string, unknown>>(
      `SELECT * FROM tr_reviews WHERE id = ?`,
      [id],
    );
    return rows.length > 0 ? rowToTrailReview(rows[0]) : null;
  }

  const now = nowIso();
  parts.push('updated_at = ?');
  params.push(now);
  params.push(id);

  db.execute(`UPDATE tr_reviews SET ${parts.join(', ')} WHERE id = ?`, params);

  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM tr_reviews WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rowToTrailReview(rows[0]) : null;
}

export function deleteReview(db: DatabaseAdapter, id: string): boolean {
  db.execute(`DELETE FROM tr_reviews WHERE id = ?`, [id]);
  return true;
}

export function getAverageRating(
  db: DatabaseAdapter,
  trailId: string,
): number | null {
  const rows = db.query<{ avg_rating: number | null }>(
    `SELECT AVG(CAST(rating AS REAL)) as avg_rating FROM tr_reviews WHERE trail_id = ?`,
    [trailId],
  );
  return rows[0]?.avg_rating ?? null;
}

export function getReviewCount(
  db: DatabaseAdapter,
  trailId: string,
): number {
  const rows = db.query<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM tr_reviews WHERE trail_id = ?`,
    [trailId],
  );
  return rows[0]?.cnt ?? 0;
}

export function getRecentConditions(
  db: DatabaseAdapter,
  trailId: string,
  limit = 10,
): string[] {
  const rows = db.query<{ conditions: string }>(
    `SELECT conditions FROM tr_reviews WHERE trail_id = ? AND conditions IS NOT NULL ORDER BY created_at DESC LIMIT ?`,
    [trailId, limit],
  );

  const allConditions: string[] = [];
  for (const row of rows) {
    try {
      const parsed = JSON.parse(row.conditions);
      if (Array.isArray(parsed)) {
        allConditions.push(...parsed);
      }
    } catch {
      // Skip invalid JSON
    }
  }

  return [...new Set(allConditions)];
}

export function getRatingDistribution(
  db: DatabaseAdapter,
  trailId: string,
): Record<number, number> {
  const rows = db.query<{ rating: number; cnt: number }>(
    `SELECT rating, COUNT(*) as cnt FROM tr_reviews WHERE trail_id = ? GROUP BY rating ORDER BY rating`,
    [trailId],
  );

  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const row of rows) {
    distribution[row.rating] = row.cnt;
  }
  return distribution;
}

// ── Module Settings ──────────────────────────────────────────────────

export function getSetting(db: DatabaseAdapter, key: string): string | null {
  const rows = db.query<{ value: string }>(
    `SELECT value FROM tr_settings WHERE key = ?`,
    [key],
  );
  return rows[0]?.value ?? null;
}

export function setSetting(db: DatabaseAdapter, key: string, value: string): void {
  db.execute(
    `INSERT INTO tr_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, value],
  );
}
