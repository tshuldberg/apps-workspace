---
name: migrate-module
description: "Migrates a standalone MyLife app into the hub as a module. Reads the standalone app's schema, routes, and features, then creates the hub module with ModuleDefinition, table prefixes, route wiring, and data importer. Use when the user says 'migrate module', 'integrate standalone', 'add module to hub', or 'wire standalone into MyLife'."
user-invocable: true
argument-hint: "<standalone-app-name> (e.g., MyBudget, MyFast)"
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash, Task]
---

# Migrate Standalone App to Hub Module

Migrate a standalone MyLife app (e.g., MyBudget, MyGarden) into the MyLife hub as a fully wired module. The hub module must be a parity adapter, not an independent rewrite.

## Prerequisites

- The standalone app exists as a submodule directory at the MyLife repo root (e.g., `MyBudget/`, `MyFast/`).
- The `ModuleId` for this module is already declared in `packages/module-registry/src/types.ts`. If not, add it there first.
- The table prefix is assigned in `CLAUDE.md` (see prefix table). If not, choose a unique 2-letter prefix with `_` suffix.

## Reference Files

Study these completed modules before starting:

| Purpose | File |
|---------|------|
| Simple module definition | `modules/fast/src/definition.ts` |
| Complex module definition | `modules/books/src/definition.ts` |
| Schema with prefix | `modules/meds/src/db/schema.ts` |
| CRUD layer | `modules/meds/src/db/crud.ts` |
| Zod models | `modules/meds/src/models/medication.ts` |
| Module index barrel | `modules/meds/src/index.ts` |
| Data importer | `packages/migration/src/importers/books.ts` |
| Mobile layout | `apps/mobile/app/(meds)/_layout.tsx` |
| Web passthrough | `apps/web/app/books/page.tsx` |
| Module test | `modules/meds/src/__tests__/meds.test.ts` |
| Module registry types | `packages/module-registry/src/types.ts` |
| DB adapter | `packages/db/src/adapter.ts` |

## Step 1: Read Standalone App

Read the standalone app to understand its data model, routes, and features.

```
Read: <Standalone>/CLAUDE.md
Read: <Standalone>/AGENTS.md (if exists)
Glob: <Standalone>/**/schema*.ts, <Standalone>/**/db/**/*.ts
Glob: <Standalone>/app/**/_layout.tsx, <Standalone>/app/**/page.tsx
Grep: "CREATE TABLE" in <Standalone>/
```

Capture:
- All table names and their columns
- Route/screen structure (tabs, detail screens)
- Feature list (what the app does)
- App name, icon, accent color, tagline

## Step 2: Determine Module ID and Table Prefix

Look up the module ID and table prefix from `CLAUDE.md` and `packages/module-registry/src/types.ts`.

Table prefix mapping from CLAUDE.md:

| Module | Prefix | Module | Prefix |
|--------|--------|--------|--------|
| Hub | `hub_` | Car | `cr_` |
| Books | `bk_` | Habits | `hb_` |
| Budget | `bg_` | Meds | `md_` |
| Fast | `ft_` | Recipes | `rc_` |

If the module is not in this table, choose a unique 2-letter prefix. Update CLAUDE.md with the new prefix.

Verify the module ID exists in `packages/module-registry/src/types.ts` (`ModuleId` union and `ModuleIdSchema`). If not, add it.

Check `packages/module-registry/src/constants.ts` for `MODULE_IDS` and `MODULE_METADATA`. Update both if the module is missing.

## Step 3: Create Module Package

Create `modules/<id>/` with these files:

### package.json

```json
{
  "name": "@mylife/<id>",
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
  "dependencies": {
    "zod": "^3.24.0"
  },
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

Add module-specific dependencies as needed (e.g., `jszip` for books).

### tsconfig.json

```json
{
  "extends": "@mylife/typescript-config/base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

### vitest.config.ts

```ts
import { defineConfig } from 'vitest/config';
import {
  VITEST_GLOBAL_SETUP_FILE,
  vitestBaseTestConfig,
} from '../../test/vitest/base';

export default defineConfig({
  test: {
    ...vitestBaseTestConfig,
    setupFiles: [VITEST_GLOBAL_SETUP_FILE],
    include: ['src/**/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/__tests__/**'],
      reporter: ['text', 'lcov'],
      thresholds: {
        lines: 70,
        statements: 70,
        functions: 65,
        branches: 50,
      },
    },
  },
});
```

## Step 4: Define Schema

Create `modules/<id>/src/db/schema.ts`.

Rules:
- Every table name MUST use the assigned prefix (e.g., `md_medications`, `bk_books`).
- UUIDs as TEXT PRIMARY KEY.
- Dates as TEXT in ISO datetime format.
- Booleans as INTEGER (0/1).
- JSON arrays as TEXT.
- Use `CREATE TABLE IF NOT EXISTS`.
- Export each CREATE statement as a named constant.
- Export `ALL_TABLES` array in dependency order (parent tables before children with FK references).
- Export `CREATE_INDEXES` array with all index creation statements.
- Export seed data arrays if needed (e.g., `SEED_SETTINGS`).

Map standalone table names to prefixed names:
- Standalone `medications` becomes `<prefix>medications` (e.g., `md_medications`)
- Preserve all columns, constraints, and CHECK clauses from standalone schema.

## Step 5: Define Module

Create `modules/<id>/src/definition.ts`.

The module definition implements the `ModuleDefinition` interface from `@mylife/module-registry`:

```ts
import type { ModuleDefinition, Migration } from '@mylife/module-registry';
import { ALL_TABLES, CREATE_INDEXES, SEED_DATA } from './db/schema';

const MIGRATION_V1: Migration = {
  version: 1,
  description: 'Initial <name> schema',
  up: [...ALL_TABLES, ...CREATE_INDEXES, ...SEED_DATA],
  down: [
    // DROP tables in reverse dependency order
  ],
};

export const <NAME>_MODULE: ModuleDefinition = {
  id: '<id>',
  name: 'My<Name>',
  tagline: '<tagline from standalone>',
  icon: '<emoji>',
  accentColor: '<hex color>',
  tier: 'premium',  // or 'free' for MyFast only
  storageType: 'sqlite',
  migrations: [MIGRATION_V1],
  schemaVersion: 1,
  tablePrefix: '<prefix>_',
  navigation: {
    tabs: [
      // Match standalone app's tab structure exactly
    ],
    screens: [
      // Match standalone app's non-tab screens
    ],
  },
  requiresAuth: false,
  requiresNetwork: false,
  version: '0.1.0',
};
```

Navigation tabs and screens MUST match the standalone app exactly. Only hub shell chrome (sidebar, top-level hub nav) may differ.

## Step 6: Create CRUD Layer

Create `modules/<id>/src/db/crud.ts`.

Pattern:
- Import `DatabaseAdapter` from `@mylife/db`.
- Create row mapper functions (`rowToEntity`) that convert DB rows to typed objects.
- Export CRUD functions: `create<Entity>`, `get<Entity>s`, `get<Entity>ById`, `update<Entity>`, `delete<Entity>`.
- All functions take `db: DatabaseAdapter` as first parameter.
- Use parameterized queries (never string interpolation for values).
- Always set `created_at` and `updated_at` with `new Date().toISOString()`.

Create `modules/<id>/src/db/index.ts` to re-export all CRUD operations.

## Step 7: Create Zod Models

Create `modules/<id>/src/models/<entity>.ts` for each primary entity.

Pattern:
- Define Zod schema for the full record (matching DB columns with camelCase field names).
- Define `Create<Entity>InputSchema` with required fields and optional fields.
- Define `Update<Entity>InputSchema` as partial of create input.
- Export inferred TypeScript types.

Create `modules/<id>/src/models/index.ts` to re-export all models.

## Step 8: Create Module Index

Create `modules/<id>/src/index.ts`:

```ts
export { <NAME>_MODULE } from './definition';
export * from './models';
export * from './db';
```

Add additional feature re-exports as needed (analytics, export, etc.).

## Step 9: Wire Mobile Routes

Create `apps/mobile/app/(<id>)/` with:

### _layout.tsx

Follow the pattern from `apps/mobile/app/(meds)/_layout.tsx`:
- Import `Tabs` from `expo-router`, `colors` from `@mylife/ui`, `BackToHubButton`.
- Use `colors.modules.<id>` for accent color.
- Create one `<Tabs.Screen>` per navigation tab from the ModuleDefinition.
- Hide non-tab screens with `options={{ href: null }}`.

### Tab screen files

Create one `.tsx` file per tab (e.g., `index.tsx`, `settings.tsx`).
Create one `.tsx` file per non-tab screen (e.g., `add-med.tsx`, `[id].tsx`).

Mobile screens should match standalone app screens exactly (parity requirement).

## Step 10: Wire Web Routes

Create `apps/web/app/<id>/` with passthrough routes.

For passthrough-enabled modules, each web route file should be a thin wrapper:

```ts
export { default } from '@my<name>-web/app/<id>/page';
```

For modules without a standalone web app, create full page components.

Create at minimum:
- `layout.tsx` -- module layout wrapper
- `page.tsx` -- module home/index page

## Step 11: Create Data Importer

Create `packages/migration/src/importers/<id>.ts`.

Pattern from `packages/migration/src/importers/books.ts`:
- Import `DatabaseAdapter` from `@mylife/db`.
- Define a result interface with per-entity import counts and an `errors` array.
- Export `importFromMy<Name>(sourceDb, hubDb)` function.
- Wrap all imports in `hubDb.transaction()`.
- Read from unprefixed tables in `sourceDb`, write to prefixed tables in `hubDb`.
- Use `INSERT OR IGNORE` to handle duplicate IDs.
- Import in dependency order (parent tables first).
- Catch per-row errors and push to errors array (do not abort on single-row failure).

## Step 12: Write Tests

Create `modules/<id>/src/__tests__/<id>.test.ts`.

Pattern from `modules/meds/src/__tests__/meds.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { <NAME>_MODULE } from '../definition';

describe('@mylife/<id>', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('<id>', <NAME>_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => { closeDb(); });

  describe('module definition', () => {
    it('has correct metadata', () => {
      expect(<NAME>_MODULE.id).toBe('<id>');
      expect(<NAME>_MODULE.tablePrefix).toBe('<prefix>');
    });
  });

  describe('CRUD operations', () => {
    // Test create, read, update, delete for each entity
  });
});
```

## Step 13: Register and Validate

1. Verify `packages/module-registry/src/constants.ts` has this module in `MODULE_IDS` and `MODULE_METADATA`.
2. Run `pnpm install` to link the new workspace package.
3. Run `pnpm typecheck` to verify no type errors.
4. Run `pnpm test` (or `vitest run` in the module directory) to verify tests pass.
5. Run `pnpm check:parity` to verify standalone-hub parity.
6. Run `pnpm gate:function:changed` if function logic was modified.

## Parity Rules (Critical)

- Hub module is a parity adapter, NOT an independent rewrite.
- Route/screen structure, user-visible labels, controls, and settings must match the standalone app exactly.
- Module screen theming must match the standalone app (hub shell theming may differ).
- Any parity validation failure is a release blocker.
- Web passthrough routes must stay thin wrappers that import standalone pages for passthrough-enabled modules.
- Do not ship module-only or standalone-only capabilities.

## File Structure Checklist

After migration, the module should have this structure:

```
modules/<id>/
  package.json
  tsconfig.json
  vitest.config.ts
  src/
    index.ts                    # Barrel exports
    definition.ts               # ModuleDefinition + migrations
    types.ts                    # Shared types (if needed)
    db/
      schema.ts                 # Prefixed CREATE TABLE statements
      crud.ts                   # CRUD operations
      index.ts                  # Re-exports
      migrations.ts             # Additional migrations (if > v1)
    models/
      <entity>.ts               # Zod schemas per entity
      index.ts                  # Re-exports
    __tests__/
      <id>.test.ts              # Core CRUD + definition tests

apps/mobile/app/(<id>)/
  _layout.tsx                   # Tabs layout with BackToHubButton
  index.tsx                     # First tab (home/today/timer)
  <tab2>.tsx                    # Additional tabs
  settings.tsx                  # Settings tab
  <detail>.tsx                  # Non-tab screens

apps/web/app/<id>/
  layout.tsx                    # Web layout
  page.tsx                      # Home page (passthrough or full)

packages/migration/src/importers/
  <id>.ts                       # Data importer
```
