// ---------------------------------------------------------------------------
// V1 Tables (existing)
// ---------------------------------------------------------------------------

export const CREATE_SPOTS = `
CREATE TABLE IF NOT EXISTS sf_spots (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  region TEXT NOT NULL,
  break_type TEXT NOT NULL DEFAULT 'beach',
  wave_height_ft REAL NOT NULL DEFAULT 0,
  wind_kts REAL NOT NULL DEFAULT 0,
  tide TEXT NOT NULL DEFAULT 'mid',
  swell_direction TEXT NOT NULL DEFAULT 'W',
  is_favorite INTEGER NOT NULL DEFAULT 0,
  last_updated TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_SESSIONS = `
CREATE TABLE IF NOT EXISTS sf_sessions (
  id TEXT PRIMARY KEY,
  spot_id TEXT NOT NULL REFERENCES sf_spots(id) ON DELETE CASCADE,
  session_date TEXT NOT NULL,
  duration_min INTEGER NOT NULL,
  rating INTEGER NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS sf_spots_region_idx ON sf_spots(region)`,
  `CREATE INDEX IF NOT EXISTS sf_spots_favorite_idx ON sf_spots(is_favorite)`,
  `CREATE INDEX IF NOT EXISTS sf_sessions_spot_idx ON sf_sessions(spot_id)`,
  `CREATE INDEX IF NOT EXISTS sf_sessions_date_idx ON sf_sessions(session_date DESC)`,
];

export const ALL_TABLES = [CREATE_SPOTS, CREATE_SESSIONS];

// ---------------------------------------------------------------------------
// V2 Tables (forecast/conditions cache + spot enrichment)
// ---------------------------------------------------------------------------

export const ALTER_SPOTS_V2 = [
  `ALTER TABLE sf_spots ADD COLUMN slug TEXT`,
  `ALTER TABLE sf_spots ADD COLUMN latitude REAL`,
  `ALTER TABLE sf_spots ADD COLUMN longitude REAL`,
  `ALTER TABLE sf_spots ADD COLUMN orientation_deg REAL`,
  `ALTER TABLE sf_spots ADD COLUMN skill_level TEXT DEFAULT 'all'`,
  `ALTER TABLE sf_spots ADD COLUMN hazards_json TEXT DEFAULT '[]'`,
  `ALTER TABLE sf_spots ADD COLUMN ideal_swell_dir_min REAL`,
  `ALTER TABLE sf_spots ADD COLUMN ideal_swell_dir_max REAL`,
  `ALTER TABLE sf_spots ADD COLUMN ideal_tide_low REAL`,
  `ALTER TABLE sf_spots ADD COLUMN ideal_tide_high REAL`,
  `ALTER TABLE sf_spots ADD COLUMN description TEXT`,
  `ALTER TABLE sf_spots ADD COLUMN crowd_factor INTEGER`,
];

export const CREATE_FORECASTS = `
CREATE TABLE IF NOT EXISTS sf_forecasts (
  id TEXT PRIMARY KEY,
  spot_id TEXT NOT NULL REFERENCES sf_spots(id) ON DELETE CASCADE,
  forecast_time TEXT NOT NULL,
  model_run TEXT NOT NULL,
  model_name TEXT DEFAULT 'gfs',
  wave_height_min_ft REAL NOT NULL DEFAULT 0,
  wave_height_max_ft REAL NOT NULL DEFAULT 0,
  wave_height_label TEXT,
  rating INTEGER,
  condition_color TEXT,
  wind_speed_kts REAL NOT NULL DEFAULT 0,
  wind_gust_kts REAL NOT NULL DEFAULT 0,
  wind_direction_deg REAL NOT NULL DEFAULT 0,
  wind_label TEXT,
  energy_kj REAL NOT NULL DEFAULT 0,
  consistency_score REAL NOT NULL DEFAULT 0,
  water_temp_f REAL,
  air_temp_f REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_SWELL_COMPONENTS = `
CREATE TABLE IF NOT EXISTS sf_swell_components (
  id TEXT PRIMARY KEY,
  forecast_id TEXT NOT NULL REFERENCES sf_forecasts(id) ON DELETE CASCADE,
  swell_index INTEGER NOT NULL,
  height_ft REAL NOT NULL DEFAULT 0,
  period_s REAL NOT NULL DEFAULT 0,
  direction_deg REAL NOT NULL DEFAULT 0,
  direction_label TEXT,
  energy_kj REAL
)`;

export const CREATE_TIDES = `
CREATE TABLE IF NOT EXISTS sf_tides (
  id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  height_ft REAL NOT NULL,
  type TEXT NOT NULL DEFAULT 'intermediate',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_BUOY_READINGS = `
CREATE TABLE IF NOT EXISTS sf_buoy_readings (
  id TEXT PRIMARY KEY,
  buoy_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  wave_height_ft REAL,
  dominant_period_s REAL,
  avg_period_s REAL,
  wave_direction_deg REAL,
  water_temp_f REAL,
  air_temp_f REAL,
  wind_speed_kts REAL,
  wind_direction_deg REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_NARRATIVES = `
CREATE TABLE IF NOT EXISTS sf_narratives (
  id TEXT PRIMARY KEY,
  spot_id TEXT,
  region TEXT,
  forecast_date TEXT NOT NULL,
  summary TEXT NOT NULL,
  body TEXT NOT NULL,
  model_used TEXT,
  helpful_votes INTEGER NOT NULL DEFAULT 0,
  unhelpful_votes INTEGER NOT NULL DEFAULT 0,
  generated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const V2_INDEXES = [
  `CREATE INDEX IF NOT EXISTS sf_spots_slug_idx ON sf_spots(slug)`,
  `CREATE INDEX IF NOT EXISTS sf_spots_coords_idx ON sf_spots(latitude, longitude)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS sf_forecasts_spot_time_idx ON sf_forecasts(spot_id, forecast_time, model_name)`,
  `CREATE INDEX IF NOT EXISTS sf_forecasts_model_run_idx ON sf_forecasts(model_run)`,
  `CREATE INDEX IF NOT EXISTS sf_swell_forecast_idx ON sf_swell_components(forecast_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS sf_tides_station_time_idx ON sf_tides(station_id, timestamp)`,
  `CREATE INDEX IF NOT EXISTS sf_buoy_id_time_idx ON sf_buoy_readings(buoy_id, timestamp DESC)`,
  `CREATE INDEX IF NOT EXISTS sf_narratives_spot_date_idx ON sf_narratives(spot_id, forecast_date)`,
  `CREATE INDEX IF NOT EXISTS sf_narratives_region_date_idx ON sf_narratives(region, forecast_date)`,
];

export const V2_TABLES = [
  CREATE_FORECASTS,
  CREATE_SWELL_COMPONENTS,
  CREATE_TIDES,
  CREATE_BUOY_READINGS,
  CREATE_NARRATIVES,
];

// ---------------------------------------------------------------------------
// V3 Tables (user, alerts, community, waves, trails)
// ---------------------------------------------------------------------------

export const CREATE_USER_PINS = `
CREATE TABLE IF NOT EXISTS sf_user_pins (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  name TEXT NOT NULL,
  notes TEXT,
  is_public INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_SPOT_ALERTS = `
CREATE TABLE IF NOT EXISTS sf_spot_alerts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  spot_id TEXT NOT NULL REFERENCES sf_spots(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  cooldown_minutes INTEGER NOT NULL DEFAULT 30,
  last_triggered_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_ALERT_RULES = `
CREATE TABLE IF NOT EXISTS sf_alert_rules (
  id TEXT PRIMARY KEY,
  alert_id TEXT NOT NULL REFERENCES sf_spot_alerts(id) ON DELETE CASCADE,
  parameter TEXT NOT NULL,
  operator TEXT NOT NULL,
  value REAL NOT NULL,
  join_operator TEXT NOT NULL DEFAULT 'and',
  sort_order INTEGER NOT NULL DEFAULT 0
)`;

export const CREATE_ALERT_NOTIFICATIONS = `
CREATE TABLE IF NOT EXISTS sf_alert_notifications (
  id TEXT PRIMARY KEY,
  alert_id TEXT NOT NULL REFERENCES sf_spot_alerts(id) ON DELETE CASCADE,
  forecast_id TEXT,
  triggered_at TEXT NOT NULL DEFAULT (datetime('now')),
  dismissed_at TEXT
)`;

export const CREATE_SPOT_REVIEWS = `
CREATE TABLE IF NOT EXISTS sf_spot_reviews (
  id TEXT PRIMARY KEY,
  spot_id TEXT NOT NULL REFERENCES sf_spots(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  rating INTEGER NOT NULL,
  title TEXT,
  body TEXT NOT NULL,
  photo_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_SPOT_PHOTOS = `
CREATE TABLE IF NOT EXISTS sf_spot_photos (
  id TEXT PRIMARY KEY,
  spot_id TEXT NOT NULL REFERENCES sf_spots(id) ON DELETE CASCADE,
  review_id TEXT REFERENCES sf_spot_reviews(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL,
  image_url TEXT NOT NULL,
  caption TEXT,
  latitude REAL,
  longitude REAL,
  taken_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_SPOT_GUIDES = `
CREATE TABLE IF NOT EXISTS sf_spot_guides (
  id TEXT PRIMARY KEY,
  spot_id TEXT NOT NULL REFERENCES sf_spots(id) ON DELETE CASCADE,
  best_tide_window TEXT NOT NULL,
  best_swell_direction TEXT NOT NULL,
  hazards_json TEXT NOT NULL DEFAULT '[]',
  parking_notes TEXT NOT NULL,
  crowd_notes TEXT NOT NULL,
  local_tips TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_SESSION_WAVES = `
CREATE TABLE IF NOT EXISTS sf_session_waves (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sf_sessions(id) ON DELETE CASCADE,
  wave_number INTEGER NOT NULL,
  duration_s REAL NOT NULL DEFAULT 0,
  max_speed_kts REAL NOT NULL DEFAULT 0,
  distance_m REAL NOT NULL DEFAULT 0,
  direction REAL,
  detected_at TEXT NOT NULL
)`;

export const CREATE_TRAIL_HIKE_SUMMARIES = `
CREATE TABLE IF NOT EXISTS sf_trail_hike_summaries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  local_hike_id TEXT NOT NULL,
  trail_id TEXT,
  name TEXT NOT NULL,
  distance_m REAL NOT NULL DEFAULT 0,
  elevation_gain_m REAL NOT NULL DEFAULT 0,
  elevation_loss_m REAL NOT NULL DEFAULT 0,
  duration_s REAL NOT NULL DEFAULT 0,
  pace_min_per_km REAL,
  started_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const V3_INDEXES = [
  `CREATE INDEX IF NOT EXISTS sf_pins_user_idx ON sf_user_pins(user_id)`,
  `CREATE INDEX IF NOT EXISTS sf_alerts_user_spot_idx ON sf_spot_alerts(user_id, spot_id)`,
  `CREATE INDEX IF NOT EXISTS sf_alert_rules_alert_idx ON sf_alert_rules(alert_id)`,
  `CREATE INDEX IF NOT EXISTS sf_alert_notif_alert_idx ON sf_alert_notifications(alert_id)`,
  `CREATE INDEX IF NOT EXISTS sf_reviews_spot_idx ON sf_spot_reviews(spot_id)`,
  `CREATE INDEX IF NOT EXISTS sf_photos_spot_idx ON sf_spot_photos(spot_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS sf_guides_spot_idx ON sf_spot_guides(spot_id)`,
  `CREATE INDEX IF NOT EXISTS sf_waves_session_idx ON sf_session_waves(session_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS sf_hikes_user_local_idx ON sf_trail_hike_summaries(user_id, local_hike_id)`,
];

export const V3_TABLES = [
  CREATE_USER_PINS,
  CREATE_SPOT_ALERTS,
  CREATE_ALERT_RULES,
  CREATE_ALERT_NOTIFICATIONS,
  CREATE_SPOT_REVIEWS,
  CREATE_SPOT_PHOTOS,
  CREATE_SPOT_GUIDES,
  CREATE_SESSION_WAVES,
  CREATE_TRAIL_HIKE_SUMMARIES,
];

// ---------------------------------------------------------------------------
// V4 Tables (zones, cams, model runs, ensemble, social)
// ---------------------------------------------------------------------------

// -- Multi-region zones --
export const CREATE_ZONES = `
CREATE TABLE IF NOT EXISTS sf_zones (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  country TEXT NOT NULL DEFAULT 'US',
  sort_order INTEGER NOT NULL DEFAULT 0,
  bounding_box_json TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/Los_Angeles',
  is_active INTEGER NOT NULL DEFAULT 1,
  spot_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const ALTER_SPOTS_V4 = [
  `ALTER TABLE sf_spots ADD COLUMN zone_id TEXT REFERENCES sf_zones(id)`,
  `ALTER TABLE sf_spots ADD COLUMN country TEXT NOT NULL DEFAULT 'US'`,
  `ALTER TABLE sf_spots ADD COLUMN timezone TEXT`,
];

// -- Cam feeds --
export const CREATE_CAM_FEEDS = `
CREATE TABLE IF NOT EXISTS sf_cam_feeds (
  id TEXT PRIMARY KEY,
  spot_id TEXT NOT NULL REFERENCES sf_spots(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  stream_url TEXT,
  snapshot_url TEXT,
  source TEXT NOT NULL DEFAULT 'community',
  status TEXT NOT NULL DEFAULT 'active',
  orientation_deg REAL,
  resolution TEXT,
  is_premium INTEGER NOT NULL DEFAULT 0,
  last_checked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_CAM_SNAPSHOTS = `
CREATE TABLE IF NOT EXISTS sf_cam_snapshots (
  id TEXT PRIMARY KEY,
  cam_id TEXT NOT NULL REFERENCES sf_cam_feeds(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  captured_at TEXT NOT NULL,
  conditions_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// -- Advanced forecast models --
export const CREATE_MODEL_RUNS = `
CREATE TABLE IF NOT EXISTS sf_model_runs (
  id TEXT PRIMARY KEY,
  model_name TEXT NOT NULL,
  run_time TEXT NOT NULL,
  coverage_hours INTEGER NOT NULL DEFAULT 168,
  resolution_hours REAL NOT NULL DEFAULT 3,
  source TEXT NOT NULL DEFAULT 'noaa',
  ingested_at TEXT NOT NULL DEFAULT (datetime('now')),
  forecast_count INTEGER NOT NULL DEFAULT 0
)`;

export const ALTER_FORECASTS_V4 = [
  `ALTER TABLE sf_forecasts ADD COLUMN confidence REAL`,
];

export const CREATE_ENSEMBLE_FORECASTS = `
CREATE TABLE IF NOT EXISTS sf_ensemble_forecasts (
  id TEXT PRIMARY KEY,
  spot_id TEXT NOT NULL REFERENCES sf_spots(id) ON DELETE CASCADE,
  forecast_time TEXT NOT NULL,
  wave_height_min_ft REAL NOT NULL DEFAULT 0,
  wave_height_max_ft REAL NOT NULL DEFAULT 0,
  wave_height_spread_ft REAL NOT NULL DEFAULT 0,
  wind_speed_kts REAL NOT NULL DEFAULT 0,
  wind_speed_spread_kts REAL NOT NULL DEFAULT 0,
  model_count INTEGER NOT NULL DEFAULT 1,
  models_json TEXT NOT NULL DEFAULT '[]',
  agreement_score REAL NOT NULL DEFAULT 0,
  rating INTEGER,
  condition_color TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// -- Social: profiles, follows, shared sessions, comments, likes, crews --
export const CREATE_SURF_PROFILES = `
CREATE TABLE IF NOT EXISTS sf_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  home_spot_id TEXT REFERENCES sf_spots(id),
  skill_level TEXT DEFAULT 'intermediate',
  board_quiver_json TEXT DEFAULT '[]',
  session_count INTEGER NOT NULL DEFAULT 0,
  total_waves INTEGER NOT NULL DEFAULT 0,
  total_hours REAL NOT NULL DEFAULT 0,
  is_public INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_FOLLOWS = `
CREATE TABLE IF NOT EXISTS sf_follows (
  id TEXT PRIMARY KEY,
  follower_id TEXT NOT NULL,
  following_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(follower_id, following_id)
)`;

export const CREATE_SHARED_SESSIONS = `
CREATE TABLE IF NOT EXISTS sf_shared_sessions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sf_sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  spot_id TEXT NOT NULL REFERENCES sf_spots(id),
  caption TEXT,
  wave_count INTEGER,
  best_wave_duration_s REAL,
  conditions_summary TEXT,
  photo_urls_json TEXT DEFAULT '[]',
  stoke_level INTEGER NOT NULL DEFAULT 3,
  is_public INTEGER NOT NULL DEFAULT 0,
  likes_count INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_SESSION_COMMENTS = `
CREATE TABLE IF NOT EXISTS sf_session_comments (
  id TEXT PRIMARY KEY,
  shared_session_id TEXT NOT NULL REFERENCES sf_shared_sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_SESSION_LIKES = `
CREATE TABLE IF NOT EXISTS sf_session_likes (
  id TEXT PRIMARY KEY,
  shared_session_id TEXT NOT NULL REFERENCES sf_shared_sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(shared_session_id, user_id)
)`;

export const CREATE_CREWS = `
CREATE TABLE IF NOT EXISTS sf_crews (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  creator_id TEXT NOT NULL,
  description TEXT,
  home_spot_id TEXT REFERENCES sf_spots(id),
  member_count INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_CREW_MEMBERS = `
CREATE TABLE IF NOT EXISTS sf_crew_members (
  id TEXT PRIMARY KEY,
  crew_id TEXT NOT NULL REFERENCES sf_crews(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(crew_id, user_id)
)`;

export const V4_TABLES = [
  CREATE_ZONES,
  CREATE_CAM_FEEDS,
  CREATE_CAM_SNAPSHOTS,
  CREATE_MODEL_RUNS,
  CREATE_ENSEMBLE_FORECASTS,
  CREATE_SURF_PROFILES,
  CREATE_FOLLOWS,
  CREATE_SHARED_SESSIONS,
  CREATE_SESSION_COMMENTS,
  CREATE_SESSION_LIKES,
  CREATE_CREWS,
  CREATE_CREW_MEMBERS,
];

export const V4_INDEXES = [
  // Zones
  `CREATE INDEX IF NOT EXISTS sf_zones_country_idx ON sf_zones(country)`,
  `CREATE INDEX IF NOT EXISTS sf_zones_slug_idx ON sf_zones(slug)`,
  `CREATE INDEX IF NOT EXISTS sf_spots_zone_idx ON sf_spots(zone_id)`,
  // Cams
  `CREATE INDEX IF NOT EXISTS sf_cams_spot_idx ON sf_cam_feeds(spot_id)`,
  `CREATE INDEX IF NOT EXISTS sf_cams_status_idx ON sf_cam_feeds(status)`,
  `CREATE INDEX IF NOT EXISTS sf_snapshots_cam_time_idx ON sf_cam_snapshots(cam_id, captured_at DESC)`,
  // Model runs + ensemble
  `CREATE UNIQUE INDEX IF NOT EXISTS sf_model_runs_name_time_idx ON sf_model_runs(model_name, run_time)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS sf_ensemble_spot_time_idx ON sf_ensemble_forecasts(spot_id, forecast_time)`,
  // Social
  `CREATE INDEX IF NOT EXISTS sf_profiles_user_idx ON sf_profiles(user_id)`,
  `CREATE INDEX IF NOT EXISTS sf_follows_follower_idx ON sf_follows(follower_id)`,
  `CREATE INDEX IF NOT EXISTS sf_follows_following_idx ON sf_follows(following_id)`,
  `CREATE INDEX IF NOT EXISTS sf_shared_sessions_user_idx ON sf_shared_sessions(user_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS sf_shared_sessions_spot_idx ON sf_shared_sessions(spot_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS sf_comments_session_idx ON sf_session_comments(shared_session_id)`,
  `CREATE INDEX IF NOT EXISTS sf_likes_session_idx ON sf_session_likes(shared_session_id)`,
  `CREATE INDEX IF NOT EXISTS sf_crew_members_crew_idx ON sf_crew_members(crew_id)`,
  `CREATE INDEX IF NOT EXISTS sf_crew_members_user_idx ON sf_crew_members(user_id)`,
];
