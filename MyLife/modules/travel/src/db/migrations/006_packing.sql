-- MyTravel packing schema (version 6)
-- Table prefix: tv_
-- Packing lists (trip-scoped or templates) + packing items.

CREATE TABLE IF NOT EXISTS tv_packing_lists (
  id TEXT PRIMARY KEY,
  trip_id TEXT REFERENCES tv_trips(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS tv_packing_items (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL REFERENCES tv_packing_lists(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  category TEXT,
  packed INTEGER NOT NULL DEFAULT 0,
  packed_at TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_tv_packing_lists_trip ON tv_packing_lists(trip_id);
CREATE INDEX IF NOT EXISTS idx_tv_packing_lists_template ON tv_packing_lists(template);
CREATE INDEX IF NOT EXISTS idx_tv_packing_items_list_order ON tv_packing_items(list_id, sort_order);
