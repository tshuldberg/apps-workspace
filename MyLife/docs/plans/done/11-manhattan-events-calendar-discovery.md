# Manhattan (Events, Calendar & Discovery) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Manhattan, a NYC events + calendar + discovery MyLife app, as a BestChef-style pair (`modules/manhattan` + `apps/manhattan`) that is local-first, persistent, and ready to grow source adapters, calendar sync, notes, and a multi-axis taxonomy.

**Architecture:** A logic module (`@mylife/manhattan`) holding SQLite schema, types, CRUD, pure engines, and a pluggable source-adapter registry, consumed by a standalone Expo Router app (`@mylife/manhattan-app`). It runs entirely on existing MyLife substrate: SQLite via `@mylife/db`, mesh sync via a declarative `syncPolicy` on `@mylife/sync`, no-login identity via `@mylife/auth`, paywall via `@mylife/billing-config` + `@mylife/entitlements`, design via `@mylife/ui`.

**Tech Stack:** TypeScript, Expo (React Native) + Expo Router, Next.js (later for web), SQLite (expo-sqlite / better-sqlite3), Zod, Vitest, Turborepo, pnpm.

**Design spec:** `docs/designs/DESIGN-manhattan-events-calendar-discovery.md` (source of truth for product decisions).

---

## Conventions this plan must respect (MyLife)

- No em dashes in any file. Keep code lean, no filler comments.
- Module id `manhattan`, table prefix `mh_` (verified unused), SKU `mylife_manhattan_unlock` ($4.99), accent `#E4572E`.
- Every new `ModuleDefinition` must declare a `syncPolicy` (mesh sync is mandatory). Extend `@mylife/sync`; never parallel-wire sync code.
- Run `pnpm gate:function:changed` before finalizing any function-logic change. State explicitly when no function logic changed.
- After each task: update `memory.md` (Project State + one Sessions row), append to `errors_log.md` on any real failure, and capture an Open Brain memory with context `"personal, mylife"`.
- Standalone-first: do NOT wire into `apps/mobile` or `apps/web` in this plan (cross-module interfaces are deferred to Phase 4). Follow the BestChef / dowork / yearn standalone precedent.
- Caller-provided or function-generated UUID strings for primary keys; bump `updated_at` on every UPDATE.

---

## File structure (Phase 0)

```
modules/manhattan/
  package.json              # @mylife/manhattan
  tsconfig.json
  vitest.config.ts
  src/
    index.ts               # barrel
    definition.ts          # MANHATTAN_MODULE (migration v1, syncPolicy, navigation)
    types.ts               # zod schemas + inferred types
    db/
      schema.ts            # mh_* CREATE TABLE constants + indexes + seeds
      crud/
        events.ts          # events CRUD (tested in Phase 0)
      __tests__/
        schema.test.ts     # migration + table presence
        events.test.ts     # events CRUD round-trip

apps/manhattan/            # scaffolded by copying apps/bestchef and renaming
  package.json             # @mylife/manhattan-app
  app.json  eas.json  tsconfig.json  metro.config.js  .easignore
  shims/crypto.js          # copied verbatim from apps/bestchef
  app/
    index.tsx              # Redirect -> /(root)/(tabs)/discover
    _layout.tsx
    (root)/
      _layout.tsx          # DatabaseProvider > AppThemeProvider > Stack
      (tabs)/_layout.tsx   # Tabs: Discover | Calendar | Pins | Plans | Settings
      (tabs)/discover.tsx calendar.tsx pins.tsx plans.tsx settings.tsx
      providers/
        DatabaseProvider.tsx   # opens manhattan.db, runs MANHATTAN_MODULE.migrations
        AppThemeProvider.tsx

packages/module-registry/src/{types.ts, constants.ts, release-states.ts}  # register id
packages/ui/src/tokens/colors.ts                                          # accent
packages/billing-config/src/index.ts                                      # SKU
```

---

# PART A — Phase 0 (Foundation). Execute now, full detail.

## Task 0.1: Create the `@mylife/manhattan` module package

**Files:**
- Create: `modules/manhattan/package.json`
- Create: `modules/manhattan/tsconfig.json`
- Create: `modules/manhattan/vitest.config.ts`

- [ ] **Step 1: Create `modules/manhattan/package.json`**

```json
{
  "name": "@mylife/manhattan",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./sources": "./src/sources/registry.ts"
  },
  "scripts": {
    "build": "tsc --build",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist",
    "test:coverage": "vitest run --coverage"
  },
  "dependencies": {
    "uuid": "^11.1.0",
    "zod": "^3.24.0"
  },
  "peerDependencies": {
    "@mylife/db": "workspace:*",
    "@mylife/module-registry": "workspace:*",
    "@mylife/ui": "workspace:*",
    "react": "*",
    "react-native": "*"
  },
  "devDependencies": {
    "@mylife/db": "workspace:*",
    "@mylife/module-registry": "workspace:*",
    "@mylife/typescript-config": "workspace:*",
    "@mylife/ui": "workspace:*",
    "@types/better-sqlite3": "^7.6.0",
    "@types/react": "^19.1.11",
    "better-sqlite3": "^11.0.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create `modules/manhattan/tsconfig.json`** (identical pattern to `modules/bestchef/tsconfig.json`)

```json
{
  "extends": "@mylife/typescript-config/react.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "types": ["react-native"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `modules/manhattan/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Install workspace deps**

Run: `pnpm install`
Expected: lockfile updates, `@mylife/manhattan` linked, no errors.

- [ ] **Step 5: Commit**

```bash
git add modules/manhattan/package.json modules/manhattan/tsconfig.json modules/manhattan/vitest.config.ts pnpm-lock.yaml
git commit -m "feat(manhattan): scaffold @mylife/manhattan module package"
```

## Task 0.2: Define the SQLite schema

**Files:**
- Create: `modules/manhattan/src/db/schema.ts`

- [ ] **Step 1: Write `modules/manhattan/src/db/schema.ts`**

```ts
/**
 * SQLite schema for the Manhattan module. All tables use the mh_ prefix.
 */

export const CREATE_EVENTS = `
CREATE TABLE IF NOT EXISTS mh_events (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL DEFAULT 'manual',
    external_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    venue_name TEXT,
    address TEXT,
    lat REAL,
    lng REAL,
    neighborhood TEXT,
    start_at TEXT,
    end_at TEXT,
    all_day INTEGER NOT NULL DEFAULT 0,
    category TEXT,
    purchase_url TEXT,
    ticket_provider TEXT,
    image_url TEXT,
    price_min REAL,
    price_max REAL,
    is_free INTEGER NOT NULL DEFAULT 0,
    saved INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
)`;

export const CREATE_EVENT_FACETS = `
CREATE TABLE IF NOT EXISTS mh_event_facets (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES mh_events(id) ON DELETE CASCADE,
    axis TEXT NOT NULL,
    value TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_PINS = `
CREATE TABLE IF NOT EXISTS mh_pins (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT,
    lat REAL,
    lng REAL,
    neighborhood TEXT,
    photo_ref TEXT,
    is_shareable INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
)`;

export const CREATE_PLANS = `
CREATE TABLE IF NOT EXISTS mh_plans (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    start_at TEXT NOT NULL,
    end_at TEXT,
    event_id TEXT REFERENCES mh_events(id) ON DELETE SET NULL,
    pin_id TEXT REFERENCES mh_pins(id) ON DELETE SET NULL,
    reminder_minutes INTEGER,
    calendar_event_id TEXT,
    has_reservation INTEGER NOT NULL DEFAULT 0,
    party_size INTEGER NOT NULL DEFAULT 1,
    source TEXT NOT NULL DEFAULT 'manual',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
)`;

export const CREATE_PLAN_MEMBERS = `
CREATE TABLE IF NOT EXISTS mh_plan_members (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL REFERENCES mh_plans(id) ON DELETE CASCADE,
    person_ref TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'guest',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_SOURCES = `
CREATE TABLE IF NOT EXISTS mh_sources (
    id TEXT PRIMARY KEY,
    enabled INTEGER NOT NULL DEFAULT 1,
    last_synced_at TEXT,
    config_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_SOURCE_CACHE = `
CREATE TABLE IF NOT EXISTS mh_source_cache (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
    payload_json TEXT NOT NULL,
    ttl_seconds INTEGER NOT NULL DEFAULT 900
)`;

export const CREATE_SETTINGS = `
CREATE TABLE IF NOT EXISTS mh_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS mh_events_start_idx ON mh_events(start_at)`,
  `CREATE INDEX IF NOT EXISTS mh_events_category_idx ON mh_events(category)`,
  `CREATE INDEX IF NOT EXISTS mh_events_saved_idx ON mh_events(saved)`,
  `CREATE INDEX IF NOT EXISTS mh_event_facets_event_idx ON mh_event_facets(event_id)`,
  `CREATE INDEX IF NOT EXISTS mh_event_facets_axis_idx ON mh_event_facets(axis, value)`,
  `CREATE INDEX IF NOT EXISTS mh_pins_shareable_idx ON mh_pins(is_shareable)`,
  `CREATE INDEX IF NOT EXISTS mh_plans_start_idx ON mh_plans(start_at)`,
  `CREATE INDEX IF NOT EXISTS mh_plans_event_idx ON mh_plans(event_id)`,
  `CREATE INDEX IF NOT EXISTS mh_plan_members_plan_idx ON mh_plan_members(plan_id)`,
  `CREATE INDEX IF NOT EXISTS mh_source_cache_source_idx ON mh_source_cache(source_id)`,
];

export const SEED_SETTINGS = [
  `INSERT OR IGNORE INTO mh_settings (key, value) VALUES ('defaultCity', 'New York')`,
  `INSERT OR IGNORE INTO mh_settings (key, value) VALUES ('defaultTimezone', 'America/New_York')`,
  `INSERT OR IGNORE INTO mh_settings (key, value) VALUES ('aiExtractionEnabled', 'false')`,
];

export const ALL_TABLES = [
  CREATE_EVENTS,
  CREATE_EVENT_FACETS,
  CREATE_PINS,
  CREATE_PLANS,
  CREATE_PLAN_MEMBERS,
  CREATE_SOURCES,
  CREATE_SOURCE_CACHE,
  CREATE_SETTINGS,
];
```

- [ ] **Step 2: Commit**

```bash
git add modules/manhattan/src/db/schema.ts
git commit -m "feat(manhattan): mh_ SQLite schema (events, facets, pins, plans, sources)"
```

## Task 0.3: Define types (Zod)

**Files:**
- Create: `modules/manhattan/src/types.ts`

- [ ] **Step 1: Write `modules/manhattan/src/types.ts`**

```ts
import { z } from 'zod';

export const FacetAxis = z.enum([
  'category',
  'format',
  'genre',
  'vibe',
  'price',
  'time',
]);
export type FacetAxis = z.infer<typeof FacetAxis>;

export const EventInputSchema = z.object({
  id: z.string().optional(),
  sourceId: z.string().default('manual'),
  externalId: z.string().nullish(),
  title: z.string().min(1),
  description: z.string().nullish(),
  venueName: z.string().nullish(),
  address: z.string().nullish(),
  lat: z.number().nullish(),
  lng: z.number().nullish(),
  neighborhood: z.string().nullish(),
  startAt: z.string().nullish(),
  endAt: z.string().nullish(),
  allDay: z.boolean().default(false),
  category: z.string().nullish(),
  purchaseUrl: z.string().nullish(),
  ticketProvider: z.string().nullish(),
  imageUrl: z.string().nullish(),
  priceMin: z.number().nullish(),
  priceMax: z.number().nullish(),
  isFree: z.boolean().default(false),
  saved: z.boolean().default(false),
});
export type EventInput = z.input<typeof EventInputSchema>;

export interface EventRow {
  id: string;
  source_id: string;
  external_id: string | null;
  title: string;
  description: string | null;
  venue_name: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  neighborhood: string | null;
  start_at: string | null;
  end_at: string | null;
  all_day: number;
  category: string | null;
  purchase_url: string | null;
  ticket_provider: string | null;
  image_url: string | null;
  price_min: number | null;
  price_max: number | null;
  is_free: number;
  saved: number;
  status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
```

- [ ] **Step 2: Commit**

```bash
git add modules/manhattan/src/types.ts
git commit -m "feat(manhattan): event zod schema and row types"
```

## Task 0.4: Module definition with migration v1 and syncPolicy

**Files:**
- Create: `modules/manhattan/src/definition.ts`

- [ ] **Step 1: Write `modules/manhattan/src/definition.ts`** (shape mirrors `modules/rsvp/src/definition.ts`)

```ts
import type { ModuleDefinition, Migration } from '@mylife/module-registry';
import { ALL_TABLES, CREATE_INDEXES, SEED_SETTINGS } from './db/schema';

const MANHATTAN_MIGRATION_V1: Migration = {
  version: 1,
  description:
    'Initial Manhattan schema - events, event_facets, pins, plans, plan_members, sources, source_cache, settings',
  up: [...ALL_TABLES, ...CREATE_INDEXES, ...SEED_SETTINGS],
  down: [
    'DROP TABLE IF EXISTS mh_source_cache',
    'DROP TABLE IF EXISTS mh_sources',
    'DROP TABLE IF EXISTS mh_plan_members',
    'DROP TABLE IF EXISTS mh_plans',
    'DROP TABLE IF EXISTS mh_pins',
    'DROP TABLE IF EXISTS mh_event_facets',
    'DROP TABLE IF EXISTS mh_events',
    'DROP TABLE IF EXISTS mh_settings',
  ],
};

export const MANHATTAN_MODULE: ModuleDefinition = {
  id: 'manhattan',
  name: 'Manhattan',
  tagline: 'Your city, planned',
  icon: '\u{1F5FD}',
  accentColor: '#E4572E',
  tier: 'premium',
  storageType: 'sqlite',
  migrations: [MANHATTAN_MIGRATION_V1],
  schemaVersion: 1,
  tablePrefix: 'mh_',
  syncPolicy: {
    defaultScope: 'personal_replica',
    shareable: true,
    entityRules: [
      { tableName: 'events', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      { tableName: 'event_facets', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      {
        tableName: 'pins',
        defaultScope: 'personal_replica',
        maxScope: 'shared_workspace',
        conflictStrategy: 'lww',
        isSensitive: true,
      },
      { tableName: 'plans', defaultScope: 'shared_workspace', conflictStrategy: 'lww' },
      { tableName: 'plan_members', defaultScope: 'shared_workspace', conflictStrategy: 'or_set' },
      { tableName: 'sources', defaultScope: 'device_local', conflictStrategy: 'lww' },
      { tableName: 'source_cache', defaultScope: 'device_local', conflictStrategy: 'lww' },
    ],
  },
  navigation: {
    tabs: [
      { key: 'discover', label: 'Discover', icon: 'compass' },
      { key: 'calendar', label: 'Calendar', icon: 'calendar' },
      { key: 'pins', label: 'Pins', icon: 'map-pin' },
      { key: 'plans', label: 'Plans', icon: 'list' },
      { key: 'settings', label: 'Settings', icon: 'settings' },
    ],
    screens: [
      { name: 'event-detail', title: 'Event' },
      { name: 'pin-detail', title: 'Pin' },
      { name: 'plan-detail', title: 'Plan' },
    ],
  },
  requiresAuth: false,
  requiresNetwork: false,
  version: '0.1.0',
};
```

Note: `maxScope`/`isSensitive` on entity rules and `crossModule` are validated by `@mylife/module-registry`. If `typecheck` reports `maxScope` or `isSensitive` are not valid keys on the entity-rule type, open `packages/module-registry/src/types.ts`, confirm the `ModuleSyncPolicy` entity-rule field names, and use the exact names found there (the mesh-sync doc names them `maxScope` and `isSensitive`).

- [ ] **Step 2: Commit**

```bash
git add modules/manhattan/src/definition.ts
git commit -m "feat(manhattan): module definition with migration v1 and syncPolicy"
```

## Task 0.5: Events CRUD (TDD)

**Files:**
- Create: `modules/manhattan/src/db/crud/events.ts`
- Test: `modules/manhattan/src/db/__tests__/events.test.ts`

- [ ] **Step 1: Write the failing test** `modules/manhattan/src/db/__tests__/events.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { createModuleTestDatabase } from '@mylife/db';
import { MANHATTAN_MODULE } from '../../definition';
import { createEvent, getEvents, getEventById, setEventSaved, softDeleteEvent } from '../crud/events';

describe('manhattan events CRUD', () => {
  it('creates, lists, and reads an event', () => {
    const { adapter, close } = createModuleTestDatabase('manhattan', MANHATTAN_MODULE.migrations!);
    const id = createEvent(adapter, {
      title: 'Blue Note Jazz',
      category: 'Music',
      startAt: '2026-07-01T20:00:00',
      venueName: 'Blue Note',
    });
    const all = getEvents(adapter);
    expect(all).toHaveLength(1);
    expect(getEventById(adapter, id)?.title).toBe('Blue Note Jazz');
    close();
  });

  it('marks an event saved and soft-deletes it', () => {
    const { adapter, close } = createModuleTestDatabase('manhattan', MANHATTAN_MODULE.migrations!);
    const id = createEvent(adapter, { title: 'Comedy Cellar Late Show' });
    setEventSaved(adapter, id, true);
    expect(getEventById(adapter, id)?.saved).toBe(1);
    softDeleteEvent(adapter, id);
    expect(getEventById(adapter, id)).toBeNull();
    expect(getEvents(adapter)).toHaveLength(0);
    close();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @mylife/manhattan test`
Expected: FAIL ("Cannot find module '../crud/events'").

- [ ] **Step 3: Write `modules/manhattan/src/db/crud/events.ts`**

```ts
import { v4 as uuidv4 } from 'uuid';
import type { DatabaseAdapter } from '@mylife/db';
import { EventInputSchema, type EventInput, type EventRow } from '../../types';

export function createEvent(db: DatabaseAdapter, input: EventInput): string {
  const data = EventInputSchema.parse(input);
  const id = data.id ?? uuidv4();
  db.execute(
    `INSERT INTO mh_events
      (id, source_id, external_id, title, description, venue_name, address, lat, lng,
       neighborhood, start_at, end_at, all_day, category, purchase_url, ticket_provider,
       image_url, price_min, price_max, is_free, saved)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      data.sourceId,
      data.externalId ?? null,
      data.title,
      data.description ?? null,
      data.venueName ?? null,
      data.address ?? null,
      data.lat ?? null,
      data.lng ?? null,
      data.neighborhood ?? null,
      data.startAt ?? null,
      data.endAt ?? null,
      data.allDay ? 1 : 0,
      data.category ?? null,
      data.purchaseUrl ?? null,
      data.ticketProvider ?? null,
      data.imageUrl ?? null,
      data.priceMin ?? null,
      data.priceMax ?? null,
      data.isFree ? 1 : 0,
      data.saved ? 1 : 0,
    ],
  );
  return id;
}

export function getEvents(db: DatabaseAdapter): EventRow[] {
  return db.query<EventRow>(
    `SELECT * FROM mh_events WHERE deleted_at IS NULL ORDER BY start_at ASC`,
  );
}

export function getEventById(db: DatabaseAdapter, id: string): EventRow | null {
  const rows = db.query<EventRow>(
    `SELECT * FROM mh_events WHERE id = ? AND deleted_at IS NULL`,
    [id],
  );
  return rows[0] ?? null;
}

export function setEventSaved(db: DatabaseAdapter, id: string, saved: boolean): void {
  db.execute(
    `UPDATE mh_events SET saved = ?, updated_at = datetime('now') WHERE id = ?`,
    [saved ? 1 : 0, id],
  );
}

export function softDeleteEvent(db: DatabaseAdapter, id: string): void {
  db.execute(
    `UPDATE mh_events SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
    [id],
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @mylife/manhattan test`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add modules/manhattan/src/db/crud/events.ts modules/manhattan/src/db/__tests__/events.test.ts
git commit -m "feat(manhattan): events CRUD with tests"
```

## Task 0.6: Schema/migration test

**Files:**
- Test: `modules/manhattan/src/db/__tests__/schema.test.ts`

- [ ] **Step 1: Write the test** `modules/manhattan/src/db/__tests__/schema.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { createModuleTestDatabase } from '@mylife/db';
import { MANHATTAN_MODULE } from '../../definition';

describe('manhattan migrations', () => {
  it('creates all mh_ tables', () => {
    const { adapter, close } = createModuleTestDatabase('manhattan', MANHATTAN_MODULE.migrations!);
    const rows = adapter.query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'mh_%' ORDER BY name`,
    );
    expect(rows.map((r) => r.name)).toEqual([
      'mh_event_facets',
      'mh_events',
      'mh_pins',
      'mh_plan_members',
      'mh_plans',
      'mh_settings',
      'mh_source_cache',
      'mh_sources',
    ]);
    close();
  });

  it('seeds default settings', () => {
    const { adapter, close } = createModuleTestDatabase('manhattan', MANHATTAN_MODULE.migrations!);
    const row = adapter.query<{ value: string }>(
      `SELECT value FROM mh_settings WHERE key = 'defaultCity'`,
    );
    expect(row[0]?.value).toBe('New York');
    close();
  });
});
```

- [ ] **Step 2: Run and verify it passes**

Run: `pnpm --filter @mylife/manhattan test`
Expected: PASS (all tests, including events).

- [ ] **Step 3: Commit**

```bash
git add modules/manhattan/src/db/__tests__/schema.test.ts
git commit -m "test(manhattan): migration and seed coverage"
```

## Task 0.7: Barrel export

**Files:**
- Create: `modules/manhattan/src/index.ts`

- [ ] **Step 1: Write `modules/manhattan/src/index.ts`**

```ts
// @mylife/manhattan -- NYC events, calendar, and discovery module

export { MANHATTAN_MODULE } from './definition';

export {
  EventInputSchema,
  FacetAxis,
} from './types';
export type { EventInput, EventRow } from './types';

export {
  createEvent,
  getEvents,
  getEventById,
  setEventSaved,
  softDeleteEvent,
} from './db/crud/events';
```

- [ ] **Step 2: Typecheck the module**

Run: `pnpm --filter @mylife/manhattan typecheck`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add modules/manhattan/src/index.ts
git commit -m "feat(manhattan): public API barrel export"
```

## Task 0.8: Register the module id across shared config

**Files:**
- Modify: `packages/module-registry/src/types.ts` (ModuleId union + ModuleIdSchema enum)
- Modify: `packages/module-registry/src/constants.ts` (MODULE_IDS + MODULE_METADATA)
- Modify: `packages/module-registry/src/release-states.ts` (HIDDEN_MODULE_IDS)
- Modify: `packages/ui/src/tokens/colors.ts` (module accent map)
- Modify: `packages/billing-config/src/index.ts` (standaloneModules)

- [ ] **Step 1: Add to the `ModuleId` union** in `packages/module-registry/src/types.ts`

Insert `| 'manhattan'` in the union (alphabetical, after the `'mail'` entry, before `'market'`). Add `'manhattan',` to the `ModuleIdSchema` z.enum array in the same alphabetical position.

- [ ] **Step 2: Add to `MODULE_IDS`** in `packages/module-registry/src/constants.ts`

Insert `'manhattan',` into the `MODULE_IDS` array after `'mail'`.

- [ ] **Step 3: Add the `MODULE_METADATA` entry** in `packages/module-registry/src/constants.ts` (mirror the existing `rsvp` entry shape)

```ts
  manhattan: {
    id: 'manhattan',
    name: 'Manhattan',
    tagline: 'Your city, planned',
    icon: '\u{1F5FD}',
    accentColor: '#E4572E',
    tier: 'premium',
    storageType: 'sqlite',
    tablePrefix: 'mh_',
    navigation: {
      tabs: [
        { key: 'discover', label: 'Discover', icon: 'compass' },
        { key: 'calendar', label: 'Calendar', icon: 'calendar' },
        { key: 'pins', label: 'Pins', icon: 'map-pin' },
        { key: 'plans', label: 'Plans', icon: 'list' },
        { key: 'settings', label: 'Settings', icon: 'settings' },
      ],
      screens: [
        { name: 'event-detail', title: 'Event' },
        { name: 'pin-detail', title: 'Pin' },
        { name: 'plan-detail', title: 'Plan' },
      ],
    },
    requiresAuth: false,
    requiresNetwork: false,
    version: '0.1.0',
  },
```

Place this object alongside the other entries in the metadata record (the keys are not strictly ordered, but keep it near `mail`/`market`). If the metadata record is typed `Record<ModuleId, ...>`, this entry becomes required and the file will not typecheck until it is added.

- [ ] **Step 4: Add to `HIDDEN_MODULE_IDS`** in `packages/module-registry/src/release-states.ts`

Add `'manhattan',` to the `HIDDEN_MODULE_IDS` array. Do NOT add it to `GA_MODULE_IDS` or `PUBLIC_BETA_MODULE_IDS` yet (promotion happens in Phase 5 after a mission-control doc exists).

- [ ] **Step 5: Add the accent** in `packages/ui/src/tokens/colors.ts`

In the module accent map (the object that contains `rsvp: '#FB7185'`), add `manhattan: '#E4572E',`.

- [ ] **Step 6: Add the SKU** in `packages/billing-config/src/index.ts`

In the `standaloneModules` object, add (alphabetically, near the `mail`/`market` entries):

```ts
    manhattan: { id: 'mylife_manhattan_unlock', price: 4.99 },
```

- [ ] **Step 7: Typecheck the affected packages**

Run: `pnpm --filter @mylife/module-registry typecheck && pnpm --filter @mylife/ui typecheck && pnpm --filter @mylife/billing-config typecheck`
Expected: PASS. If `Record<ModuleId, ...>` exhaustiveness errors appear, you missed a required map entry; add it.

- [ ] **Step 8: Run the module-registry tests** (catches metadata/release-state contract breaks)

Run: `pnpm --filter @mylife/module-registry test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/module-registry packages/ui/src/tokens/colors.ts packages/billing-config/src/index.ts
git commit -m "feat(manhattan): register module id, accent, and \$4.99 SKU"
```

## Task 0.9: Scaffold the standalone Expo app

**Files:**
- Create: `apps/manhattan/` (by copying `apps/bestchef/` and renaming)

> This task copies the proven BestChef app shell and renames it. Open `apps/bestchef/` files as you go; these are real reference files, not placeholders.

- [ ] **Step 1: Create the app package** `apps/manhattan/package.json`

```json
{
  "name": "@mylife/manhattan-app",
  "version": "1.0.0",
  "private": true,
  "main": "expo-router/entry",
  "scripts": {
    "dev": "expo start",
    "build": "expo export --platform android --platform ios",
    "typecheck": "tsc --noEmit",
    "test": "vitest run --passWithNoTests",
    "android": "expo run:android",
    "ios": "expo run:ios"
  },
  "dependencies": {
    "@babel/runtime": "^7.28.6",
    "@expo/metro-runtime": "^6.1.2",
    "@expo/vector-icons": "^15.1.1",
    "@mylife/auth": "workspace:*",
    "@mylife/db": "workspace:*",
    "@mylife/manhattan": "workspace:*",
    "@mylife/module-registry": "workspace:*",
    "@mylife/sync": "workspace:*",
    "@mylife/ui": "workspace:*",
    "@supabase/supabase-js": "^2.49.0",
    "expo": "~54.0.33",
    "expo-blur": "~15.0.8",
    "expo-constants": "~18.0.13",
    "expo-crypto": "~15.0.8",
    "expo-file-system": "~19.0.21",
    "expo-font": "^14.0.11",
    "expo-haptics": "^15.0.8",
    "expo-image": "~3.0.10",
    "expo-linear-gradient": "~15.0.8",
    "expo-linking": "~8.0.11",
    "expo-localization": "~17.0.8",
    "expo-location": "~18.1.6",
    "expo-router": "~6.0.23",
    "expo-secure-store": "~15.0.8",
    "expo-sqlite": "~16.0.10",
    "expo-status-bar": "~3.0.9",
    "lucide-react-native": "^0.469.0",
    "react": "19.1.0",
    "react-native": "~0.81.5",
    "react-native-gesture-handler": "^2.28.0",
    "react-native-safe-area-context": "~5.6.2",
    "react-native-screens": "~4.16.0",
    "react-native-svg": "~15.12.1"
  },
  "devDependencies": {
    "@expo/config-plugins": "~54.0.4",
    "@mylife/typescript-config": "workspace:*",
    "@types/react": "~19.0.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Copy config files from BestChef and rename**

Copy these files from `apps/bestchef/` to `apps/manhattan/` and apply the substitutions below:
- `metro.config.js` -> copy verbatim (it resolves the workspace root and crypto shim; no app-specific names).
- `shims/crypto.js` -> copy verbatim.
- `.easignore` -> copy verbatim.
- `tsconfig.json` -> copy verbatim.
- `eas.json` -> copy verbatim (project id is set later via `eas init`).
- `app.json` -> copy, then change: `expo.name` to `"Manhattan"`, `expo.slug` to `"manhattan"`, `expo.scheme` to `"manhattan"`, and the iOS/Android bundle identifier to `com.mylife.manhattan` (match the BestChef package-name pattern). Remove any BestChef-specific plugins that pull recipe-only native modules; keep `expo-router`, `expo-secure-store`, `expo-sqlite`, security/data-protection plugins.

- [ ] **Step 3: Create the DatabaseProvider** `apps/manhattan/app/(root)/providers/DatabaseProvider.tsx`

Open `apps/bestchef/app/(root)/providers/DatabaseProvider.tsx` and reproduce it with these exact substitutions:
- database filename: `manhattan.db` (BestChef uses its own `.db` name).
- module id string: `'manhattan'`.
- migrations: import `MANHATTAN_MODULE` from `@mylife/manhattan` and pass `MANHATTAN_MODULE.migrations` to the same migration runner BestChef uses (`runModuleMigrations` / `initializeHubDatabase` from `@mylife/db`, in the same call order as BestChef).
- exported hook/name: rename `useBestChefDatabase` (or equivalent) to `useManhattanDatabase`.
Keep everything else identical (expo-sqlite `openDatabaseSync`, adapter construction, context provider, loading gate).

- [ ] **Step 4: Create `AppThemeProvider.tsx`**

Copy `apps/bestchef/app/(root)/providers/AppThemeProvider.tsx` verbatim, then set the module accent to `#E4572E` (replace the BestChef green `#22C55E`). This provider feeds `@mylife/ui` the Cool Obsidian tokens plus the Manhattan accent.

- [ ] **Step 5: Create the router shell**

Create these files (model `_layout.tsx` files on the BestChef equivalents):
- `apps/manhattan/app/index.tsx`:

```tsx
import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href="/(root)/(tabs)/discover" />;
}
```

- `apps/manhattan/app/_layout.tsx`: copy `apps/bestchef/app/_layout.tsx` (GestureHandlerRootView + StatusBar + ErrorBoundary + Stack with a single `(root)` screen). No content changes needed.
- `apps/manhattan/app/(root)/_layout.tsx`: model on the BestChef `(root)/_layout.tsx`, but the provider stack is `DatabaseProvider > AppThemeProvider > Stack`. Drop BestChef-only providers (recipes/cloud) for Phase 0; the cloud provider is added in Phase 5.
- `apps/manhattan/app/(root)/(tabs)/_layout.tsx`: a `Tabs` navigator with five screens (`discover`, `calendar`, `pins`, `plans`, `settings`) using `lucide-react-native` icons (`Compass`, `Calendar`, `MapPin`, `List`, `Settings`). Model the styling on the BestChef tabs layout.

- [ ] **Step 6: Create the five tab screens as working shells**

Each screen renders a titled empty state from `@mylife/ui`. Example `apps/manhattan/app/(root)/(tabs)/discover.tsx`:

```tsx
import { View, StyleSheet } from 'react-native';
import { Text } from '@mylife/ui';

export default function DiscoverScreen() {
  return (
    <View style={styles.container}>
      <Text variant="title">Discover</Text>
      <Text variant="body">Aggregated NYC events will appear here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 8, justifyContent: 'center' },
});
```

Create `calendar.tsx`, `pins.tsx`, `plans.tsx`, `settings.tsx` the same way with their own titles and one-line descriptions. (If `Text` from `@mylife/ui` does not accept a `variant` prop, open `packages/ui/src/index.ts` and use the actual `Text` API.)

- [ ] **Step 7: Install and typecheck the app**

Run: `pnpm install && pnpm --filter @mylife/manhattan-app typecheck`
Expected: PASS. Resolve any import-path or `@mylife/ui` API mismatches against the real package exports.

- [ ] **Step 8: Boot the app once to verify migrations run and tabs render**

Run: `pnpm --filter @mylife/manhattan-app dev` (then open iOS simulator or Expo Go).
Expected: app launches to the Discover tab, all five tabs switch, no redbox. The `manhattan.db` file is created on first launch (DatabaseProvider runs the migration).

- [ ] **Step 9: Commit**

```bash
git add apps/manhattan
git commit -m "feat(manhattan): scaffold standalone Expo app shell (5 tabs, persistence)"
```

## Task 0.10: Phase 0 verification and bookkeeping

- [ ] **Step 1: Full module + registry verification**

Run: `pnpm --filter @mylife/manhattan typecheck && pnpm --filter @mylife/manhattan test && pnpm --filter @mylife/manhattan-app typecheck`
Expected: all green.

- [ ] **Step 2: Function quality gate on staged changes**

Run: `pnpm gate:function:changed`
Expected: pass (or no changed source detected). Fix any reported issues.

- [ ] **Step 3: Parity check** (Manhattan is standalone-only, so this confirms no host-app drift)

Run: `pnpm check:parity --quiet`
Expected: pass.

- [ ] **Step 4: Update `memory.md` and capture Open Brain memory**

- Add a Sessions row: `Manhattan Phase 0: scaffolded module + standalone app, mh_ schema, registered id + $4.99 SKU.`
- Update Project State module count if tracked.
- Capture an Open Brain memory (context `"personal, mylife"`) summarizing Phase 0 completion and that Manhattan implementation has started, pointing to this plan and the design spec.
- Create a session log at `docs/sessions/YYYY-MM-DD-manhattan-phase-0-foundation.md`.

- [ ] **Step 5: Final commit**

```bash
git add memory.md docs/sessions
git commit -m "docs(manhattan): log Phase 0 foundation"
```

**Phase 0 acceptance:** `apps/manhattan` boots to a five-tab shell; `manhattan.db` persists across relaunch; `@mylife/manhattan` typechecks and all tests pass; module id, accent, and SKU are registered (hidden release state); no parity drift.

---

# PART B — Roadmap (Phases 1 to 5). Each becomes its own full plan before execution.

These phases are intentionally specified at task level. Write a full bite-sized plan (like Part A) for each phase immediately before executing it, because each phase's exact code depends on the artifacts produced by the previous one. Source of truth for scope: the design spec.

### Phase 1: Local CRUD + UI (offline, no sources)
- `db/crud/pins.ts`, `db/crud/plans.ts`, `db/crud/plan-members.ts`, `db/crud/facets.ts`, `db/crud/sources.ts` with tests (mirror events CRUD).
- Real Discover/Calendar/Pins/Plans screens backed by CRUD; create/edit forms; an onboarding pledge screen ("No data sale, ever. No ads, ever.").
- Acceptance: full offline create/read/update/delete for events, pins, plans persists across relaunch.

### Phase 2: Tier-1 source adapters + dedup + taxonomy
- `sources/types.ts` (`EventSourceAdapter`, `NormalizedEvent`, `gapFlag`, `SourceGapError`), `sources/registry.ts`.
- Adapters: `seatgeek.ts`, `nyc-open-data.ts`, `ics-import.ts` (reuse `modules/mail` `parseIcs`). Gap stubs in `sources/gaps/` (ticketmaster, ra, dice, posh, partiful, equinox, mylife-tickets).
- `engines/dedup.ts` (title + venue + start_at fuzzy) and `engines/taxonomy.ts` (six axes incl. music purpose facets) with tests.
- Backend calls routed through a Supabase Edge Function proxy (short-TTL cache, deep-link out). SeatGeek key in `.env.local`.
- Acceptance: discovery feed populates from SeatGeek + NYC Open Data, deduped, filterable across all six axes; gap adapters render as "Coming with MyLife Tickets."

### Phase 3: Calendar + share intent + TikTok oEmbed + opt-in AI
- Add `expo-calendar` (two-way, dedicated calendar, UUID de-dup, TZID America/New_York via `engines/calendar-payload.ts` reusing `modules/classes` payload shapes) and `expo-share-intent` (+ share extension) feeding `parser/url-parser.ts`.
- `tiktok-oembed.ts` adapter; opt-in AI extraction via `@mylife/intelligence` (defaults off).
- Evaluate reusing `docs/plans/queue/09-universal-share-to-mesh-delivery.md` infrastructure before adding `expo-share-intent`.
- Acceptance: a plan written in-app appears on the device calendar and survives edit/delete without duplicates; a shared post becomes a confirmable candidate event; calendar events read back in.

### Phase 4: Hub composition (cross-module, standalone still)
- Implement `cross-module.ts` (`getTodayCards`, `getSearchableContent`, `getDataSummary`) modeled on `modules/rsvp/src/cross-module.ts`; add `crossModule` to the definition.
- Compose `@mylife/notes` (extended notes + `hub_tags`/`hub_tag_bindings`) via `integrations/notes-bridge.ts`; `@mylife/friends` hangout stubs via `integrations/friends-bridge.ts`; `@mylife/notifications` reminders (build the shared Expo `NotificationPlatformOps` adapter); Equinox/class capture via `modules/classes` recurrence engine.
- Acceptance: notes and tags attach to pins/plans; reminders fire; attending an event can log a friends hangout.

### Phase 5: Cloud + social + monetization + release
- `ManhattanCloudProvider` (Supabase via `@mylife/auth`, opt-in on a Data & Sync screen), optional app lock via `@mylife/auth/module-lock` (+ add `'manhattan'` to `LOCKABLE_MODULE_IDS`), mesh sync verified across two devices with per-pin privacy respected.
- `@mylife/social` activity type + share cards; wire the $4.99 paywall via `EntitlementsProvider`/`useModuleUnlocked`; set entitlements test mode false.
- `eas init` and set `extra.eas.projectId`; promote module id from `HIDDEN_MODULE_IDS` after a mission-control doc; EAS build + submit.
- Acceptance: cloud opt-in syncs across devices; lock gates the app; paywall gates correctly; TestFlight build uploads.

---

## Self-review (against the spec)

- Spec coverage: Phase 0 covers placement, stack, schema, syncPolicy, registration, monetization SKU, and the app shell. Discovery/sources (spec 6), calendar/share/notes/taxonomy (spec 7-8), AI (9), identity/cloud (10), cross-module (11) map to Phases 2-5. Future MyLife Tickets module (spec 12) is represented by the gap-adapter stubs in Phase 2.
- Placeholder scan: Part A contains complete code or precise copy-from-named-file transforms. The two soft references (`maxScope`/`isSensitive` field names, `@mylife/ui` `Text` API) include explicit instructions to confirm against the real source, because those exact symbols were not read during planning.
- Type consistency: `MANHATTAN_MODULE`, `EventInput`, `EventRow`, and the CRUD function names (`createEvent`, `getEvents`, `getEventById`, `setEventSaved`, `softDeleteEvent`) are consistent across schema, types, CRUD, tests, and barrel.
