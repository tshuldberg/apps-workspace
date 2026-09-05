-- MyTravel extended logistics schema (version 5)
-- Table prefix: tv_
-- Emergency contacts (global or trip-scoped), currency rates, trip checklists.

CREATE TABLE IF NOT EXISTS tv_emergency_contacts (
  id TEXT PRIMARY KEY,
  trip_id TEXT REFERENCES tv_trips(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relationship TEXT,
  phone TEXT,
  email TEXT,
  country_code TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS tv_currencies (
  id TEXT PRIMARY KEY,
  trip_id TEXT REFERENCES tv_trips(id) ON DELETE CASCADE,
  base TEXT NOT NULL,
  quote TEXT NOT NULL,
  rate REAL NOT NULL,
  fetched_at TEXT NOT NULL,
  source TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS tv_checklist_items (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES tv_trips(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  category TEXT,
  done INTEGER NOT NULL DEFAULT 0,
  done_at TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_tv_emergency_contacts_trip ON tv_emergency_contacts(trip_id);
CREATE INDEX IF NOT EXISTS idx_tv_currencies_trip ON tv_currencies(trip_id);
CREATE INDEX IF NOT EXISTS idx_tv_currencies_pair ON tv_currencies(base, quote);
CREATE INDEX IF NOT EXISTS idx_tv_checklist_items_trip ON tv_checklist_items(trip_id);
CREATE INDEX IF NOT EXISTS idx_tv_checklist_items_order ON tv_checklist_items(trip_id, sort_order);
