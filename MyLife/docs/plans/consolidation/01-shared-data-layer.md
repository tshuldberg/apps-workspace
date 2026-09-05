---
status: PROPOSAL
phase: 1
parent: docs/plans/consolidation/README.md
---

# Shared Data Layer

Eleven hub tables consolidate cross-cutting entities scattered across 30 module-private schemas. Migration uses **pointer tables** (index side-by-side with canonical per-module tables) first, then **hard consolidation** only for entities with low semantic divergence across modules.

## Migration philosophy

**Pointer tables (soft adoption)** — per-module tables stay canonical; hub table is a denormalized index. Safe to add without touching module code. Modules opt in by writing to both.

- `hub_timeline` — index of log events (source: module-specific log tables)
- `hub_cost_events` — index of money events (source: `bg_transactions` canonical, plus references)
- `hub_body_metrics` — union of weight/BP/glucose/HR from 7 modules

**Hard consolidation (deep adoption)** — per-module tables are dropped; hub table is the only store. Requires coordinated migration of every writer + reader.

- `hub_attachments` + `hub_attachment_links` — replaces 16+ photo/document tables
- `hub_tags` + `hub_tag_bindings` — replaces 10+ tag tables
- `hub_reminders` — replaces 10 reminder schedulers
- `hub_people` + `hub_person_module_roles` — replaces 11 contact tables
- `hub_goals` + `hub_goal_progress` — replaces 10 goal tables
- `hub_events` — replaces 10 event/appointment tables
- `hub_places` + `hub_gps_tracks` — replaces 8 location tables
- `hub_foods` — replaces 5 food tables
- `hub_books` — replaces book identity in books/words/flash/notes

Hard consolidations ship in sequenced waves so each module migrates once per wave.

## SQL schemas

Drop these into `packages/db/src/hub-schema.ts`. Each gets a `CREATE_HUB_*` export plus an entry in `HUB_SCHEMA_STATEMENTS` so the migration runner picks it up. Follow the existing `hub_enabled_modules` / `hub_friend_profiles` patterns.

```sql
-- hub_attachments: single store for photos, documents, voice, video
CREATE TABLE IF NOT EXISTS hub_attachments (
  id TEXT PRIMARY KEY NOT NULL,
  uri TEXT NOT NULL,
  mime TEXT NOT NULL,
  sha256 TEXT,
  bytes INTEGER,
  thumb_uri TEXT,
  caption TEXT,
  taken_at TEXT,
  lat REAL,
  lng REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS hub_attachment_links (
  attachment_id TEXT NOT NULL,
  module_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  role TEXT,
  linked_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (attachment_id, module_id, entity_type, entity_id),
  FOREIGN KEY (attachment_id) REFERENCES hub_attachments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_hub_attachment_links_entity
  ON hub_attachment_links(module_id, entity_type, entity_id);

-- hub_tags: polymorphic tagging
CREATE TABLE IF NOT EXISTS hub_tags (
  id TEXT PRIMARY KEY NOT NULL,
  label TEXT NOT NULL UNIQUE,
  color TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS hub_tag_bindings (
  tag_id TEXT NOT NULL,
  module_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  bound_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (tag_id, module_id, entity_type, entity_id),
  FOREIGN KEY (tag_id) REFERENCES hub_tags(id) ON DELETE CASCADE
);

-- hub_reminders: unified scheduler
CREATE TABLE IF NOT EXISTS hub_reminders (
  id TEXT PRIMARY KEY NOT NULL,
  module_id TEXT NOT NULL,
  entity_ref TEXT,
  title TEXT NOT NULL,
  body TEXT,
  trigger_rule TEXT NOT NULL,        -- RRULE-compatible string
  next_fire_at TEXT NOT NULL,
  last_fired_at TEXT,
  location_id TEXT,
  radius_m INTEGER,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_hub_reminders_fire ON hub_reminders(active, next_fire_at);

-- hub_goals: unified progress tracking
CREATE TABLE IF NOT EXISTS hub_goals (
  id TEXT PRIMARY KEY NOT NULL,
  module_id TEXT NOT NULL,
  title TEXT NOT NULL,
  target_value REAL,
  unit TEXT,
  period TEXT,                       -- 'daily' | 'weekly' | 'monthly' | 'total'
  starts_at TEXT,
  due_at TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'completed', 'abandoned')),
  entity_ref TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS hub_goal_progress (
  goal_id TEXT NOT NULL,
  at TEXT NOT NULL,
  value REAL NOT NULL,
  PRIMARY KEY (goal_id, at),
  FOREIGN KEY (goal_id) REFERENCES hub_goals(id) ON DELETE CASCADE
);

-- hub_people: unified contact / partner / caregiver / contractor graph
CREATE TABLE IF NOT EXISTS hub_people (
  id TEXT PRIMARY KEY NOT NULL,
  display_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  avatar_attachment_id TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (avatar_attachment_id) REFERENCES hub_attachments(id)
);

CREATE TABLE IF NOT EXISTS hub_person_module_roles (
  person_id TEXT NOT NULL,
  module_id TEXT NOT NULL,
  role TEXT NOT NULL,                -- 'contact' | 'caregiver' | 'contractor' | 'vet' | 'trainer' | 'partner' | 'guest'
  entity_ref TEXT,
  added_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (person_id, module_id, role, entity_ref),
  FOREIGN KEY (person_id) REFERENCES hub_people(id) ON DELETE CASCADE
);

-- hub_body_metrics: one weight / BP / glucose / HR timeline
CREATE TABLE IF NOT EXISTS hub_body_metrics (
  id TEXT PRIMARY KEY NOT NULL,
  subject_type TEXT NOT NULL DEFAULT 'self'
    CHECK (subject_type IN ('self', 'pet')),
  subject_id TEXT,                   -- NULL for self; pet_id for pets
  metric TEXT NOT NULL,              -- 'weight' | 'bp_sys' | 'bp_dia' | 'glucose' | 'bbt' | 'hr' | 'hrv' | 'sleep_min' | 'steps'
  value REAL NOT NULL,
  unit TEXT NOT NULL,
  source TEXT NOT NULL,              -- 'manual' | 'healthkit' | 'cgm' | 'scale' | 'imported'
  module_origin TEXT NOT NULL,
  at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_hub_body_metrics_at
  ON hub_body_metrics(subject_type, subject_id, metric, at DESC);

-- hub_cost_events: money events pointer (bg_transactions stays canonical)
CREATE TABLE IF NOT EXISTS hub_cost_events (
  id TEXT PRIMARY KEY NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  payee TEXT,
  at TEXT NOT NULL,
  budget_txn_id TEXT,                -- points to bg_transactions if synced
  module_id TEXT NOT NULL,
  entity_ref TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_hub_cost_events_at ON hub_cost_events(at DESC);

-- hub_places: canonical locations
CREATE TABLE IF NOT EXISTS hub_places (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,                -- 'home' | 'trailhead' | 'surf' | 'restaurant' | 'garden_zone' | 'parking' | 'other'
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  geohash TEXT,
  address_json TEXT,
  module_origin TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_hub_places_geo ON hub_places(geohash);

CREATE TABLE IF NOT EXISTS hub_gps_tracks (
  id TEXT PRIMARY KEY NOT NULL,
  module_id TEXT NOT NULL,
  entity_ref TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  distance_m REAL,
  polyline TEXT,                     -- Google polyline encoding
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- hub_events: one calendar
CREATE TABLE IF NOT EXISTS hub_events (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT,
  kind TEXT NOT NULL,                -- 'rsvp' | 'appointment' | 'workout' | 'fast' | 'maintenance' | 'focus' | 'other'
  module_id TEXT NOT NULL,
  entity_ref TEXT,
  place_id TEXT,
  rrule TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (place_id) REFERENCES hub_places(id)
);
CREATE INDEX IF NOT EXISTS idx_hub_events_range ON hub_events(starts_at);

-- hub_foods: canonical food database + barcode cache
CREATE TABLE IF NOT EXISTS hub_foods (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  brand TEXT,
  barcode TEXT UNIQUE,
  nutrients_json TEXT NOT NULL,      -- macro + micro JSON
  source TEXT NOT NULL,              -- 'off' (OpenFoodFacts) | 'manual' | 'recipe' | 'usda'
  verified INTEGER NOT NULL DEFAULT 0 CHECK (verified IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- hub_books: canonical book identity
CREATE TABLE IF NOT EXISTS hub_books (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  isbn TEXT UNIQUE,
  ol_id TEXT,                        -- OpenLibrary ID
  cover_attachment_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (cover_attachment_id) REFERENCES hub_attachments(id)
);

-- hub_timeline: denormalized log-event index (read-optimized, not canonical)
CREATE TABLE IF NOT EXISTS hub_timeline (
  id TEXT PRIMARY KEY NOT NULL,
  module_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  summary TEXT NOT NULL,
  payload_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_hub_timeline_at ON hub_timeline(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_hub_timeline_mod ON hub_timeline(module_id, occurred_at DESC);
```

## Per-module migration checklist (abbreviated)

Each hard-consolidation table gets a one-session migration per module. Pattern for each module:

1. Add adapter in `modules/<name>/src/shared/<entity>.ts` that reads the hub table and writes back.
2. Add a migration version that copies rows from `<prefix>_<old_table>` to the hub table, then drops `<prefix>_<old_table>`.
3. Update all module reads/writes to go through the adapter.
4. Run `pnpm gate:function --file <adapter>` and `pnpm check:module-parity`.

Tables → owning modules per wave:

| Wave | Table | Modules affected |
|------|-------|------------------|
| A (lowest risk) | hub_attachments | all 16 with photo/doc tables |
| A | hub_tags | books, closet, journal, notes, recipes, mood, forums |
| A | hub_places | trails, surf, car, workouts, homes, nutrition, garden |
| B | hub_reminders | meds, habits, cycle, car, homes, pets, fast, garden, rsvp, workouts |
| B | hub_goals | budget, books, fast, nutrition, health, presence, pets, habits, workouts |
| B | hub_events | rsvp, mail, cycle, meds, car, homes, habits, presence, workouts, fast |
| C (medium risk) | hub_people | budget, mail, meds, pets, homes, rsvp, surf, forums, cycle, workouts, presence |
| C | hub_body_metrics | fast, health, meds, workouts, cycle, pets |
| C | hub_foods | nutrition, recipes, fast, meds, pets |
| C | hub_books | books, words, flash, notes |
| D (pointer-only, shippable anytime) | hub_timeline | all 30 |
| D | hub_cost_events | budget, car, homes, pets, rsvp, recipes, subs, closet, books |

## Migration risk hot-spots

### Budget / Subs cost ownership conflict

`bg_transactions` + 40 sibling tables vs `sb_subscriptions` both claim subscription truth. Resolve **before** cost consolidation:

- Subs module becomes the *detection* + *management* UI.
- Budget module owns the canonical `bg_transactions` + recurring template.
- `sb_subscriptions` becomes a view over `bg_subscriptions` filtered by `type = 'subscription'`.
- Price history and cancellation flows stay in subs.

### Meds super-module

`md_mood_entries`, `md_food_diary`, `md_bp_readings`, `md_contacts`, `md_appointments`, `md_reminders` all duplicate other modules. Phased migration:

1. `md_reminders` → `hub_reminders` (Wave B)
2. `md_appointments` → `hub_events` (Wave B)
3. `md_bp_readings` / `md_glucose_readings` / `md_cgm_readings` → `hub_body_metrics` (Wave C)
4. `md_contacts` / `md_caregivers` → `hub_people` (Wave C)
5. `md_mood_entries` → mood module takes ownership; meds module reads from `mo_entries` (Wave C)
6. `md_food_diary` stays meds-private for FODMAP specificity; cross-refs `hub_foods`.

### Habits super-module

`hb_periods` / `hb_predictions` / `hb_cycle_settings` fully duplicate cycle module. Ownership decision: cycle module owns the cycle data. Habits module deletes the duplicate tables and reads via adapter. Do this before any other habits consolidation so the module surface stays stable.

## Rollback plan

Each migration writes a backup row count to `hub_schema_versions`. Rollback = restore from the `backup/` exports shipped in `packages/db/src/backup/` plus replay of recent writes from the transaction journal. Every wave ships behind a `hub_shared_entity_adoption` preference flag so individual modules can flip back to private tables without downgrading schema.

## Acceptance

- All 11 tables created by migrations in `packages/db/src/hub-schema.ts`
- `pnpm test` green for `packages/db`
- At least one module per wave writes + reads through each adapter
- `pnpm check:module-parity` green
- `pnpm check:generated-artifacts` green
- No changes to `bg_transactions`, `mo_entries`, or any module-canonical table in Waves A/B
