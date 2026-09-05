-- MyTravel journal schema (version 7)
-- Table prefix: tv_
-- Journal entries (trip/destination optional) + attached memories (photos, quotes, souvenirs).

CREATE TABLE IF NOT EXISTS tv_journal_entries (
  id TEXT PRIMARY KEY,
  trip_id TEXT REFERENCES tv_trips(id) ON DELETE SET NULL,
  destination_id TEXT REFERENCES tv_destinations(id) ON DELETE SET NULL,
  day_number INTEGER,
  entry_date TEXT NOT NULL,
  title TEXT,
  body_md TEXT NOT NULL DEFAULT '',
  mood INTEGER CHECK (mood IS NULL OR (mood BETWEEN 1 AND 5)),
  weather TEXT,
  location_label TEXT,
  lat REAL,
  lng REAL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS tv_journal_memories (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL REFERENCES tv_journal_entries(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('photo','quote','souvenir','video','audio','other')),
  media_ref TEXT,
  caption TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_tv_journal_entries_trip ON tv_journal_entries(trip_id);
CREATE INDEX IF NOT EXISTS idx_tv_journal_entries_destination ON tv_journal_entries(destination_id);
CREATE INDEX IF NOT EXISTS idx_tv_journal_entries_date ON tv_journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_tv_journal_entries_mood ON tv_journal_entries(mood);
CREATE INDEX IF NOT EXISTS idx_tv_journal_memories_entry_order ON tv_journal_memories(entry_id, sort_order);
