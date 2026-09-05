---
name: hub-module-scaffold
description: "Creates a brand new MyLife hub module from scratch with no standalone source. Generates the full module package with ModuleDefinition, SQLite schema, CRUD operations, Zod models, mobile/web routes, and test scaffolding. Use when the user says 'scaffold module', 'create new module', 'add new module', 'new hub module', or wants to build a module that doesn't have a standalone app."
user-invocable: true
argument-hint: "<module-name> <table-prefix> (e.g., MyGarden gd_)"
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash]
---

# Hub Module Scaffold

Scaffolds a complete new MyLife hub module. Follows the conventions of
`@mylife/books` and `@mylife/meds`.

## Step 1 -- Gather Requirements

Ask the user for anything not already provided:

| Field | Example | Required |
|-------|---------|----------|
| Module name | `MyGarden` | Yes |
| Module ID | `garden` (lowercase, one word) | Yes |
| Table prefix | `gd_` (2-3 chars + `_`) | Yes |
| Icon emoji | `&#x1F331;` | Yes |
| Accent color | `#4CAF50` | Yes |
| Tier | `free` or `premium` (default `premium`) | Yes |
| Tagline | `Grow your green thumb` | Yes |
| Primary entity | `Plant` (drives table + CRUD) | Yes |
| Extra tables | Optional | No |

## Step 2 -- Check for Conflicts

1. Read `packages/module-registry/src/types.ts` -- confirm ID not in `ModuleId`
   union or `ModuleIdSchema` enum.
2. Verify prefix is not taken (`hub_`, `bk_`, `bg_`, `ft_`, `cr_`, `hb_`,
   `md_`, `rc_` are reserved). Grep `modules/` for the prefix to be safe.
3. If a conflict exists, ask the user for an alternative.

## Step 3 -- Create Module Package (`modules/<id>/`)

### `package.json`

```json
{
  "name": "@mylife/<ID>",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc --build",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist",
    "test:coverage": "vitest run --coverage"
  },
  "dependencies": { "zod": "^3.24.0" },
  "peerDependencies": {
    "@mylife/db": "workspace:*",
    "@mylife/module-registry": "workspace:*"
  },
  "devDependencies": {
    "@mylife/typescript-config": "workspace:*",
    "better-sqlite3": "^11.0.0",
    "@types/better-sqlite3": "^7.6.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

### `tsconfig.json`

Copy from `modules/meds/tsconfig.json` (extends `@mylife/typescript-config/base.json`,
`outDir: "dist"`, `rootDir: "src"`, `include: ["src"]`).

### `vitest.config.ts`

Copy from `modules/meds/vitest.config.ts` (imports `vitestBaseTestConfig` and
`VITEST_GLOBAL_SETUP_FILE` from `../../test/vitest/base`).

## Step 4 -- Create Source Files

### `src/index.ts`

Barrel export: re-export `<ID_UPPER>_MODULE` from `./definition`, all schemas
and types from `./models/*`, and all CRUD functions from `./db/crud`.

### `src/definition.ts`

```ts
import type { ModuleDefinition, Migration } from '@mylife/module-registry';
import { ALL_TABLES, CREATE_INDEXES, SEED_SETTINGS } from './db/schema';

const <ID_UPPER>_MIGRATION_V1: Migration = {
  version: 1,
  description: 'Initial <ID> schema',
  up: [...ALL_TABLES, ...CREATE_INDEXES, ...SEED_SETTINGS],
  down: [
    'DROP TABLE IF EXISTS <PREFIX>settings',
    'DROP TABLE IF EXISTS <PREFIX><entities>',
  ],
};

export const <ID_UPPER>_MODULE: ModuleDefinition = {
  id: '<ID>',
  name: '<MODULE_NAME>',
  tagline: '<TAGLINE>',
  icon: '<ICON>',
  accentColor: '<ACCENT_COLOR>',
  tier: '<TIER>',
  storageType: 'sqlite',
  migrations: [<ID_UPPER>_MIGRATION_V1],
  schemaVersion: 1,
  tablePrefix: '<PREFIX>',
  navigation: {
    tabs: [
      { key: 'home', label: 'Home', icon: 'home' },
      { key: 'list', label: '<Entity>s', icon: 'list' },
      { key: 'settings', label: 'Settings', icon: 'settings' },
    ],
    screens: [
      { name: '<entity>-detail', title: '<Entity> Detail' },
      { name: 'add-<entity>', title: 'Add <Entity>' },
    ],
  },
  requiresAuth: false,
  requiresNetwork: false,
  version: '0.1.0',
};
```

### `src/db/schema.ts`

Create the primary entity table and a settings table, both with the module
prefix. Follow the pattern in `modules/meds/src/db/schema.ts`:

- Primary table: `<PREFIX><entities>` with `id TEXT PRIMARY KEY`, `name TEXT NOT NULL`,
  domain columns, `is_active INTEGER DEFAULT 1`, `sort_order INTEGER DEFAULT 0`,
  `created_at`/`updated_at` with `datetime('now')` defaults.
- Settings table: `<PREFIX>settings` with `key TEXT PRIMARY KEY`, `value TEXT NOT NULL`,
  `updated_at`.
- Export `ALL_TABLES`, `CREATE_INDEXES`, `SEED_SETTINGS` arrays.

Add domain-specific columns and extra tables based on user requirements.

### `src/db/crud.ts`

Follow the pattern in `modules/meds/src/db/crud.ts`. Implement:

- `rowTo<Entity>(row)` -- maps DB row to TypeScript type (snake_case to camelCase).
- `create<Entity>(db, id, input)` -- INSERT with timestamps.
- `get<Entity>s(db, opts?)` -- SELECT with optional `isActive` filter.
- `get<Entity>ById(db, id)` -- SELECT by primary key, return `T | null`.
- `update<Entity>(db, id, updates)` -- dynamic SET clause builder.
- `delete<Entity>(db, id)` -- DELETE by primary key.
- `count<Entity>s(db)` -- COUNT query.
- `getSetting(db, key)` / `setSetting(db, key, value)` -- settings CRUD with
  `ON CONFLICT` upsert.

Import `DatabaseAdapter` from `@mylife/db`. Import entity type from models.

### `src/models/schemas.ts`

```ts
import { z } from 'zod';

export const <Entity>Schema = z.object({
  id: z.string(),
  name: z.string().min(1),
  notes: z.string().nullable(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const Create<Entity>InputSchema = z.object({
  name: z.string().min(1),
  notes: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

export const Update<Entity>InputSchema = Create<Entity>InputSchema.partial().extend({
  isActive: z.boolean().optional(),
});
```

Add domain-specific fields to match the schema columns.

### `src/models/types.ts`

Derive TypeScript types from Zod schemas using `z.infer`:

```ts
export type <Entity> = z.infer<typeof <Entity>Schema>;
export type Create<Entity>Input = z.infer<typeof Create<Entity>InputSchema>;
export type Update<Entity>Input = z.infer<typeof Update<Entity>InputSchema>;
```

## Step 5 -- Register the Module

Edit `packages/module-registry/src/types.ts`:

1. Add `'<id>'` to the `ModuleId` type union (alphabetical order).
2. Add `'<id>'` to the `ModuleIdSchema` `z.enum()` array (same order).

## Step 6 -- Create Routes

### Mobile: `apps/mobile/app/(<id>)/_layout.tsx`

Follow the pattern in `apps/mobile/app/(meds)/_layout.tsx`:

- Import `Tabs` from `expo-router`, `colors` from `@mylife/ui`,
  `BackToHubButton` from `../../components/BackToHubButton`.
- Set `ACCENT` to the module accent color.
- Create a `TabIcon` component rendering emoji with opacity.
- Export a default `<Name>Layout` with `Tabs` containing screen entries for
  each navigation tab. Set `headerLeft: () => <BackToHubButton />`.

### Mobile: `apps/mobile/app/(<id>)/index.tsx`

Placeholder home screen with `ScrollView`, a `Card` showing the module name
and tagline, and a "coming soon" placeholder. Import from `@mylife/ui`.

### Web: `apps/web/app/<id>/layout.tsx`

Passthrough layout: `export default function <Name>Layout({ children }) { return <>{children}</>; }`

### Web: `apps/web/app/<id>/page.tsx`

Placeholder page with title, tagline, and "coming soon" card using CSS
variables (`var(--text)`, `var(--surface-elevated)`, `var(--border)`, etc.).

## Step 7 -- Create Test Scaffold

### `src/__tests__/<id>.test.ts`

Follow the pattern in `modules/meds/src/__tests__/meds.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { <ID_UPPER>_MODULE } from '../definition';
import { create<Entity>, get<Entity>s, get<Entity>ById,
  update<Entity>, delete<Entity>, count<Entity>s,
  getSetting, setSetting } from '../db/crud';

describe('@mylife/<ID>', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('<ID>', <ID_UPPER>_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;
  });
  afterEach(() => { closeDb(); });

  it('has correct module metadata', () => {
    expect(<ID_UPPER>_MODULE.id).toBe('<ID>');
    expect(<ID_UPPER>_MODULE.tablePrefix).toBe('<PREFIX>');
    expect(<ID_UPPER>_MODULE.navigation.tabs.length).toBeGreaterThanOrEqual(2);
  });

  it('seeds default settings', () => {
    expect(getSetting(adapter, 'initialized')).toBe('1');
  });

  it('CRUD: create, read, update, delete', () => {
    create<Entity>(adapter, 'e1', { name: 'Test' });
    expect(count<Entity>s(adapter)).toBe(1);
    expect(get<Entity>ById(adapter, 'e1')!.name).toBe('Test');

    update<Entity>(adapter, 'e1', { name: 'Updated' });
    expect(get<Entity>ById(adapter, 'e1')!.name).toBe('Updated');

    delete<Entity>(adapter, 'e1');
    expect(count<Entity>s(adapter)).toBe(0);
  });

  it('filters by active status', () => {
    create<Entity>(adapter, 'e1', { name: 'Active' });
    create<Entity>(adapter, 'e2', { name: 'Inactive' });
    update<Entity>(adapter, 'e2', { isActive: false });
    expect(get<Entity>s(adapter, { isActive: true })).toHaveLength(1);
    expect(get<Entity>s(adapter, { isActive: false })).toHaveLength(1);
  });

  it('upserts settings', () => {
    setSetting(adapter, 'theme', 'dark');
    expect(getSetting(adapter, 'theme')).toBe('dark');
  });
});
```

## Step 8 -- Validate

```bash
pnpm install
pnpm typecheck
pnpm test -- --filter=@mylife/<ID>
```

Fix any errors before finishing.

## File Structure Summary

```
modules/<id>/
  package.json
  tsconfig.json
  vitest.config.ts
  src/
    index.ts
    definition.ts
    db/
      schema.ts
      crud.ts
    models/
      schemas.ts
      types.ts
    __tests__/
      <id>.test.ts
apps/mobile/app/(<id>)/
  _layout.tsx
  index.tsx
apps/web/app/<id>/
  layout.tsx
  page.tsx
```

## Placeholder Reference

| Placeholder | Meaning | Example |
|-------------|---------|---------|
| `<ID>` | Module ID (lowercase) | `garden` |
| `<ID_UPPER>` | Constant prefix (UPPER_SNAKE) | `GARDEN` |
| `<PREFIX>` | Table prefix | `gd_` |
| `<MODULE_NAME>` | Display name | `MyGarden` |
| `<TAGLINE>` | Short description | `Grow your green thumb` |
| `<ICON>` | Emoji icon | `&#x1F331;` |
| `<ACCENT_COLOR>` | Hex color | `#4CAF50` |
| `<TIER>` | `free` or `premium` | `premium` |
| `<Entity>` | Primary entity (PascalCase) | `Plant` |
| `<entity>` | Primary entity (camelCase) | `plant` |
| `<entities>` | Entity plural (lowercase) | `plants` |
| `<ENTITY_UPPER>` | Entity (UPPER_SNAKE) | `PLANTS` |
| `<Name>` | Layout prefix (PascalCase) | `Garden` |
