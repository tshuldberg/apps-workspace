-- MyTravel itinerary schema (version 2)
-- Adds tv_itinerary_days and tv_activities.
-- Kept as a human-readable source of truth alongside src/db/schema.ts.

CREATE TABLE tv_itinerary_days (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES tv_trips(id) ON DELETE CASCADE,
  date TEXT,
  day_number INTEGER NOT NULL,
  location TEXT,
  weather_notes TEXT,
  summary_md TEXT,
  photo_ids TEXT DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE tv_activities (
  id TEXT PRIMARY KEY,
  day_id TEXT NOT NULL REFERENCES tv_itinerary_days(id) ON DELETE CASCADE,
  trip_id TEXT NOT NULL REFERENCES tv_trips(id) ON DELETE CASCADE,
  time TEXT,
  end_time TEXT,
  title TEXT NOT NULL,
  type TEXT CHECK(type IN ('flight','hotel','restaurant','sight','tour','hike','transport','other')),
  location TEXT,
  address TEXT,
  lat REAL,
  lng REAL,
  confirmation_code TEXT,
  cost_cents INTEGER,
  notes_md TEXT,
  booking_url TEXT,
  photo_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_tv_itinerary_days_trip ON tv_itinerary_days(trip_id);
CREATE INDEX idx_tv_activities_day ON tv_activities(day_id);
CREATE INDEX idx_tv_activities_trip ON tv_activities(trip_id);
