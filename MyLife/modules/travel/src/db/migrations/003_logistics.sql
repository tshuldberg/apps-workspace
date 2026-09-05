-- MyTravel logistics schema (version 3)
-- Adds tv_documents (passports, visas, insurance, vaccinations, memberships)
-- and tv_loyalty_programs (airlines, hotels, car rentals).
-- Kept as a human-readable source of truth alongside src/db/schema.ts.

CREATE TABLE tv_documents (
  id TEXT PRIMARY KEY,
  type TEXT CHECK(type IN ('passport','visa','insurance','vaccination','membership','other')) NOT NULL,
  name TEXT NOT NULL,
  number TEXT,
  country TEXT,
  issue_date TEXT,
  expiry_date TEXT,
  renewal_reminder_days INTEGER DEFAULT 90,
  notes_md TEXT,
  photo_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE tv_loyalty_programs (
  id TEXT PRIMARY KEY,
  type TEXT CHECK(type IN ('airline','hotel','car')) NOT NULL,
  provider TEXT NOT NULL,
  member_number TEXT,
  status_tier TEXT,
  points_balance INTEGER DEFAULT 0,
  miles_balance INTEGER DEFAULT 0,
  expiry_date TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_tv_documents_type ON tv_documents(type);
CREATE INDEX idx_tv_documents_expiry ON tv_documents(expiry_date);
CREATE INDEX idx_tv_loyalty_type ON tv_loyalty_programs(type);
