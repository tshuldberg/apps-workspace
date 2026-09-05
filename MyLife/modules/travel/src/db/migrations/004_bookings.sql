-- MyTravel bookings schema (version 4)
-- Adds tv_bookings for flights, hotels, car rentals, trains, ferries, tours.
-- Each booking is linked to a trip and includes timing, cost, and notes.
-- Kept as a human-readable source of truth alongside src/db/schema.ts.

CREATE TABLE tv_bookings (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES tv_trips(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('flight','hotel','car','train','ferry','tour','other')),
  provider TEXT NOT NULL,
  confirmation_code TEXT,
  start_ts TEXT NOT NULL,
  end_ts TEXT,
  location TEXT,
  cost_cents INTEGER,
  currency TEXT,
  notes TEXT,
  attachments_ref TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_tv_bookings_trip ON tv_bookings(trip_id);
CREATE INDEX idx_tv_bookings_type ON tv_bookings(type);
CREATE INDEX idx_tv_bookings_start_ts ON tv_bookings(start_ts);
