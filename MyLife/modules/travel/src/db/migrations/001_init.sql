-- MyTravel initial schema (version 1)
-- Table prefix: tv_
-- Kept as a human-readable source of truth alongside src/db/schema.ts.

CREATE TABLE tv_trips (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  destination_ids TEXT DEFAULT '[]',
  trip_type TEXT CHECK(trip_type IN ('vacation','business','family','solo','road_trip','backpacking')),
  start_date TEXT,
  end_date TEXT,
  status TEXT CHECK(status IN ('planning','upcoming','active','completed','cancelled')) DEFAULT 'planning',
  companion_ids TEXT DEFAULT '[]',
  budget_planned_cents INTEGER,
  budget_actual_cents INTEGER DEFAULT 0,
  cover_photo_id TEXT,
  notes_md TEXT,
  rating INTEGER CHECK(rating BETWEEN 1 AND 5),
  template_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE tv_destinations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT,
  country_code TEXT,
  region TEXT,
  lat REAL,
  lng REAL,
  first_visited TEXT,
  last_visited TEXT,
  visit_count INTEGER DEFAULT 0,
  rating INTEGER CHECK(rating BETWEEN 1 AND 5),
  bucket_list INTEGER DEFAULT 0,
  priority INTEGER,
  notes_md TEXT,
  best_season TEXT,
  photo_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE tv_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE INDEX idx_tv_trips_status ON tv_trips(status);
CREATE INDEX idx_tv_trips_start_date ON tv_trips(start_date);
CREATE INDEX idx_tv_destinations_country ON tv_destinations(country_code);
CREATE INDEX idx_tv_destinations_bucket ON tv_destinations(bucket_list);
