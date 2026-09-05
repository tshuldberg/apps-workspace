// MyTrails SQLite schema - table prefix: tr_

export const CREATE_TRAILS = `
CREATE TABLE IF NOT EXISTS tr_trails (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK(difficulty IN ('easy', 'moderate', 'hard', 'expert')),
  distance_meters REAL NOT NULL DEFAULT 0,
  elevation_gain_meters REAL NOT NULL DEFAULT 0,
  estimated_minutes INTEGER,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  region TEXT,
  description TEXT,
  is_saved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_RECORDINGS = `
CREATE TABLE IF NOT EXISTS tr_recordings (
  id TEXT PRIMARY KEY,
  trail_id TEXT REFERENCES tr_trails(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  activity_type TEXT NOT NULL DEFAULT 'hike' CHECK(activity_type IN ('hike', 'run', 'bike', 'walk')),
  started_at TEXT NOT NULL,
  ended_at TEXT,
  distance_meters REAL NOT NULL DEFAULT 0,
  elevation_gain_meters REAL NOT NULL DEFAULT 0,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  gpx_data TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_WAYPOINTS = `
CREATE TABLE IF NOT EXISTS tr_waypoints (
  id TEXT PRIMARY KEY,
  recording_id TEXT NOT NULL REFERENCES tr_recordings(id) ON DELETE CASCADE,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  elevation REAL,
  timestamp TEXT NOT NULL,
  accuracy REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_PHOTOS = `
CREATE TABLE IF NOT EXISTS tr_photos (
  id TEXT PRIMARY KEY,
  recording_id TEXT REFERENCES tr_recordings(id) ON DELETE SET NULL,
  trail_id TEXT REFERENCES tr_trails(id) ON DELETE SET NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  uri TEXT NOT NULL,
  caption TEXT,
  taken_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS tr_trails_name_idx ON tr_trails(name)`,
  `CREATE INDEX IF NOT EXISTS tr_trails_difficulty_idx ON tr_trails(difficulty)`,
  `CREATE INDEX IF NOT EXISTS tr_trails_region_idx ON tr_trails(region)`,
  `CREATE INDEX IF NOT EXISTS tr_trails_saved_idx ON tr_trails(is_saved)`,
  `CREATE INDEX IF NOT EXISTS tr_recordings_trail_idx ON tr_recordings(trail_id)`,
  `CREATE INDEX IF NOT EXISTS tr_recordings_started_idx ON tr_recordings(started_at DESC)`,
  `CREATE INDEX IF NOT EXISTS tr_recordings_activity_idx ON tr_recordings(activity_type)`,
  `CREATE INDEX IF NOT EXISTS tr_waypoints_recording_idx ON tr_waypoints(recording_id)`,
  `CREATE INDEX IF NOT EXISTS tr_waypoints_timestamp_idx ON tr_waypoints(timestamp)`,
  `CREATE INDEX IF NOT EXISTS tr_photos_recording_idx ON tr_photos(recording_id)`,
  `CREATE INDEX IF NOT EXISTS tr_photos_trail_idx ON tr_photos(trail_id)`,
];

export const ALL_TABLES = [
  CREATE_TRAILS,
  CREATE_RECORDINGS,
  CREATE_WAYPOINTS,
  CREATE_PHOTOS,
];

// ── V2: Offline Map Downloads ─────────────────────────────────────────

export const CREATE_OFFLINE_REGIONS = `
CREATE TABLE IF NOT EXISTS tr_offline_regions (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  region_key TEXT NOT NULL UNIQUE,
  min_lat REAL NOT NULL,
  max_lat REAL NOT NULL,
  min_lng REAL NOT NULL,
  max_lng REAL NOT NULL,
  min_zoom INTEGER NOT NULL DEFAULT 1,
  max_zoom INTEGER NOT NULL DEFAULT 15,
  tile_count INTEGER NOT NULL DEFAULT 0,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','downloading','ready','error','stale')),
  progress REAL NOT NULL DEFAULT 0.0,
  downloaded_at TEXT,
  expires_at TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const V2_INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_tr_offline_regions_status ON tr_offline_regions(status)`,
  `CREATE INDEX IF NOT EXISTS idx_tr_offline_regions_bbox ON tr_offline_regions(min_lat, max_lat, min_lng, max_lng)`,
];

export const V2_TABLES = [CREATE_OFFLINE_REGIONS];

// ── V3: Wrong-Turn Alerts ─────────────────────────────────────────────

export const CREATE_ALERT_SETTINGS = `
CREATE TABLE IF NOT EXISTS tr_alert_settings (
  id TEXT PRIMARY KEY NOT NULL,
  deviation_threshold_meters REAL NOT NULL DEFAULT 30.0,
  alert_cooldown_seconds INTEGER NOT NULL DEFAULT 60,
  vibration_enabled INTEGER NOT NULL DEFAULT 1,
  sound_enabled INTEGER NOT NULL DEFAULT 0,
  auto_pause_on_deviation INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_DEVIATION_EVENTS = `
CREATE TABLE IF NOT EXISTS tr_deviation_events (
  id TEXT PRIMARY KEY NOT NULL,
  recording_id TEXT NOT NULL REFERENCES tr_recordings(id) ON DELETE CASCADE,
  trail_id TEXT REFERENCES tr_trails(id) ON DELETE SET NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  deviation_meters REAL NOT NULL,
  nearest_trail_lat REAL NOT NULL,
  nearest_trail_lng REAL NOT NULL,
  acknowledged INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const V3_INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_tr_deviation_events_recording ON tr_deviation_events(recording_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tr_deviation_events_trail ON tr_deviation_events(trail_id)`,
];

export const V3_TABLES = [CREATE_ALERT_SETTINGS, CREATE_DEVIATION_EVENTS];

// ── V4: Weather Cache ─────────────────────────────────────────────────

export const CREATE_WEATHER_CACHE = `
CREATE TABLE IF NOT EXISTS tr_weather_cache (
  id TEXT PRIMARY KEY NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  conditions_json TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const V4_INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_tr_weather_cache_coords ON tr_weather_cache(lat, lng)`,
  `CREATE INDEX IF NOT EXISTS idx_tr_weather_cache_expires ON tr_weather_cache(expires_at)`,
];

export const V4_TABLES = [CREATE_WEATHER_CACHE];

// ── V5: Segments & Segment Efforts ────────────────────────────────────

export const CREATE_SEGMENTS = `
CREATE TABLE IF NOT EXISTS tr_segments (
  id TEXT PRIMARY KEY NOT NULL,
  trail_id TEXT NOT NULL REFERENCES tr_trails(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_lat REAL NOT NULL,
  start_lng REAL NOT NULL,
  end_lat REAL NOT NULL,
  end_lng REAL NOT NULL,
  distance_meters REAL NOT NULL DEFAULT 0,
  elevation_gain_meters REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_SEGMENT_EFFORTS = `
CREATE TABLE IF NOT EXISTS tr_segment_efforts (
  id TEXT PRIMARY KEY NOT NULL,
  segment_id TEXT NOT NULL REFERENCES tr_segments(id) ON DELETE CASCADE,
  recording_id TEXT NOT NULL REFERENCES tr_recordings(id) ON DELETE CASCADE,
  duration_seconds INTEGER NOT NULL,
  pace_min_per_km REAL,
  started_at TEXT NOT NULL,
  ended_at TEXT NOT NULL,
  is_personal_best INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const V5_INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_tr_segments_trail ON tr_segments(trail_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tr_segment_efforts_segment ON tr_segment_efforts(segment_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tr_segment_efforts_recording ON tr_segment_efforts(recording_id)`,
];

export const V5_TABLES = [CREATE_SEGMENTS, CREATE_SEGMENT_EFFORTS];

// ── V6: Packing Templates & Items ────────────────────────────────────

export const CREATE_PACKING_TEMPLATES = `
CREATE TABLE IF NOT EXISTS tr_packing_templates (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'custom' CHECK(type IN ('day_hike','overnight','backpacking','winter','trail_run','custom')),
  is_built_in INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_PACKING_ITEMS = `
CREATE TABLE IF NOT EXISTS tr_packing_items (
  id TEXT PRIMARY KEY NOT NULL,
  template_id TEXT NOT NULL REFERENCES tr_packing_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  is_checked INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const V6_INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_tr_packing_items_template ON tr_packing_items(template_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tr_packing_items_category ON tr_packing_items(category)`,
];

export const V6_TABLES = [CREATE_PACKING_TEMPLATES, CREATE_PACKING_ITEMS];

// ── V7: Trips, Trip Days, Trip Activities ────────────────────────────

export const CREATE_TRIPS = `
CREATE TABLE IF NOT EXISTS tr_trips (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  notes TEXT,
  packing_template_id TEXT REFERENCES tr_packing_templates(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_TRIP_DAYS = `
CREATE TABLE IF NOT EXISTS tr_trip_days (
  id TEXT PRIMARY KEY NOT NULL,
  trip_id TEXT NOT NULL REFERENCES tr_trips(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  date TEXT,
  title TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_TRIP_ACTIVITIES = `
CREATE TABLE IF NOT EXISTS tr_trip_activities (
  id TEXT PRIMARY KEY NOT NULL,
  day_id TEXT NOT NULL REFERENCES tr_trip_days(id) ON DELETE CASCADE,
  trail_id TEXT REFERENCES tr_trails(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'hike' CHECK(type IN ('hike','drive','camp','rest','other')),
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const V7_INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_tr_trip_days_trip ON tr_trip_days(trip_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tr_trip_activities_day ON tr_trip_activities(day_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tr_trip_activities_trail ON tr_trip_activities(trail_id)`,
];

export const V7_TABLES = [CREATE_TRIPS, CREATE_TRIP_DAYS, CREATE_TRIP_ACTIVITIES];

// ── V8: Trail Database Integration ────────────────────────────────────

export const CREATE_TRAIL_DATABASE = `
CREATE TABLE IF NOT EXISTS tr_trail_database (
  id TEXT PRIMARY KEY NOT NULL,
  osm_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  difficulty TEXT CHECK(difficulty IN ('easy','moderate','hard','expert')),
  distance_meters REAL,
  elevation_gain_meters REAL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  region TEXT,
  trail_type TEXT NOT NULL DEFAULT 'hiking' CHECK(trail_type IN ('hiking','cycling','running','multi_use')),
  surface TEXT,
  route_geometry TEXT,
  source TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const V8_INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_tr_trail_database_name ON tr_trail_database(name)`,
  `CREATE INDEX IF NOT EXISTS idx_tr_trail_database_region ON tr_trail_database(region)`,
  `CREATE INDEX IF NOT EXISTS idx_tr_trail_database_type ON tr_trail_database(trail_type)`,
  `CREATE INDEX IF NOT EXISTS idx_tr_trail_database_coords ON tr_trail_database(lat, lng)`,
  `CREATE INDEX IF NOT EXISTS idx_tr_trail_database_osm ON tr_trail_database(osm_id)`,
];

export const V8_TABLES = [CREATE_TRAIL_DATABASE];

// ── V9: Planned Routes & Waypoints ───────────────────────────────────

export const CREATE_PLANNED_ROUTES = `
CREATE TABLE IF NOT EXISTS tr_planned_routes (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  distance_meters REAL NOT NULL DEFAULT 0,
  elevation_gain_meters REAL NOT NULL DEFAULT 0,
  estimated_minutes INTEGER,
  is_loop INTEGER NOT NULL DEFAULT 0,
  route_geometry TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_ROUTE_WAYPOINTS = `
CREATE TABLE IF NOT EXISTS tr_route_waypoints (
  id TEXT PRIMARY KEY NOT NULL,
  route_id TEXT NOT NULL REFERENCES tr_planned_routes(id) ON DELETE CASCADE,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  label TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const V9_INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_tr_route_waypoints_route ON tr_route_waypoints(route_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tr_route_waypoints_order ON tr_route_waypoints(route_id, sort_order)`,
];

export const V9_TABLES = [CREATE_PLANNED_ROUTES, CREATE_ROUTE_WAYPOINTS];

// ── V10: Community Reviews ────────────────────────────────────────────

export const CREATE_REVIEWS = `
CREATE TABLE IF NOT EXISTS tr_reviews (
  id TEXT PRIMARY KEY NOT NULL,
  trail_id TEXT NOT NULL REFERENCES tr_trails(id) ON DELETE CASCADE,
  recording_id TEXT REFERENCES tr_recordings(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
  title TEXT,
  body TEXT,
  conditions TEXT,
  visited_at TEXT,
  is_shared INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const V10_INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_tr_reviews_trail ON tr_reviews(trail_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tr_reviews_recording ON tr_reviews(recording_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tr_reviews_rating ON tr_reviews(rating)`,
];

export const V10_TABLES = [CREATE_REVIEWS];

// ── V11: Review Photo Attachments ────────────────────────────────────

export const V11_TABLES = [
  `ALTER TABLE tr_reviews ADD COLUMN photo_uris TEXT`,
];

export const V11_INDEXES: string[] = [];

// ── V12: Module Settings ─────────────────────────────────────────────

export const CREATE_SETTINGS = `
CREATE TABLE IF NOT EXISTS tr_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const V12_TABLES = [CREATE_SETTINGS];

export const V12_INDEXES: string[] = [];

// ── V13: Recording Metadata ───────────────────────────────────────────

export const V13_TABLES = [
  `ALTER TABLE tr_recordings ADD COLUMN notes TEXT`,
  `ALTER TABLE tr_recordings ADD COLUMN is_private INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE tr_recordings ADD COLUMN activity_rating INTEGER CHECK(activity_rating >= 1 AND activity_rating <= 5)`,
];

export const V13_INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_tr_recordings_private ON tr_recordings(is_private)`,
];
