# Cloud Module Conversion Spec

## Purpose

This document is a self-contained prompt and instruction set for converting any MyLife hub module from local-only SQLite to support optional non-local (cloud) connections. It is designed to be handed to a developer or AI agent as a complete brief -- no additional context needed beyond the codebase itself.

**Read this entire document before starting work on any module.**

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [The Five Layers of Cloud Opt-In](#2-the-five-layers-of-cloud-opt-in)
3. [Module Cloud Classification](#3-module-cloud-classification)
4. [Per-Module Conversion Analysis](#4-per-module-conversion-analysis)
5. [Step-by-Step Conversion Process](#5-step-by-step-conversion-process)
6. [Code Templates](#6-code-templates)
7. [Testing Requirements](#7-testing-requirements)
8. [Verification Checklist](#8-verification-checklist)
9. [Prompts for Each Conversion Phase](#9-prompts-for-each-conversion-phase)

---

## 1. Architecture Overview

MyLife is a local-first, privacy-first platform. Every module works fully offline with SQLite. Cloud features are strictly opt-in and additive -- they never replace the local layer.

### Key Packages

| Package | Role | Key Exports |
|---------|------|-------------|
| `@mylife/db` | SQLite adapter, hub schema, migration runner | `DatabaseAdapter`, `runModuleMigrations`, `createModuleTestDatabase` |
| `@mylife/module-registry` | Module metadata + lifecycle | `ModuleDefinition`, `ModuleId`, `StorageType` |
| `@mylife/sync` | Tiered sync (local/P2P/cloud) | `SyncTier`, `SyncManager`, `SyncProvider`, `useSyncStatus` |
| `@mylife/auth` | Dual local/cloud auth | `AuthMode`, `AuthProvider`, `useAuth`, `LocalAuthState` |
| `@mylife/social` | Social graph + activity feed | `SOCIAL_CAPABLE_MODULES`, `emitActivity`, `SocialProfile` |
| `@mylife/subscription` | Billing + entitlements | `EntitlementState`, `StorageTier`, `isModuleUnlocked` |
| `@mylife/ui` | Cool Obsidian design system | Theme tokens, shared components |

### The Data Flow

```
User Action
  -> Module CRUD (DatabaseAdapter, local SQLite)
  -> [If cloud tier active] SyncManager replicates via PowerSync
  -> [If social enabled] emitActivity() posts to Supabase feed
  -> [If cloud queries needed] Cloud adapter fetches from Supabase
  -> Local cache updated
```

### Storage Architecture

```
Single SQLite File (on-device)
  hub_*          -- Hub tables (auth, settings, enabled modules, schema versions)
  bk_*           -- Books module tables
  bg_*           -- Budget module tables
  sf_*           -- Surf module tables
  ...            -- Each module has its own prefix

PowerSync (cloud tier only)
  SQLite <-> Supabase bidirectional sync
  Operates at the table level, transparent to module code

Supabase (cloud-native modules only)
  Direct queries for data that doesn't live locally
  (e.g., community content, external data feeds, social graph)
```

---

## 2. The Five Layers of Cloud Opt-In

Each layer is independent. A module can adopt any combination.

### Layer 1: Transparent Sync (Zero module code changes)

**What it does:** Replicates the module's local SQLite tables to/from Supabase via PowerSync.

**How it works:** The hub's `SyncManager` handles this at the SQLite file level. When a user upgrades their sync tier (local_only -> free_cloud -> starter_cloud -> power_cloud), PowerSync starts syncing all prefixed tables automatically.

**Module code changes needed:** None. The module's CRUD functions still use `DatabaseAdapter`. Sync happens below the CRUD layer.

**Requirements:**
- User must be authenticated (Supabase auth)
- User must have purchased a storage tier (free = 1 GB, starter = 5 GB, power = 25 GB)
- Supabase schema must have matching tables (managed via `supabase/migrations/`)

**When to use:** Any module that just needs cross-device sync. No new features, just data portability.

### Layer 2: Cloud Query Adapters (Module-specific cloud data)

**What it does:** Adds a `src/cloud/` directory with functions that query Supabase directly for data that doesn't originate locally (e.g., community content, external data feeds, shared catalogs).

**How it works:** Cloud adapters mirror the local CRUD interface but target Supabase. The UI layer (in `apps/`) decides which source to use based on `SyncTier`.

**Module code changes needed:**
- Create `src/cloud/client.ts` (Supabase client wrapper)
- Create `src/cloud/*.ts` (query functions)
- Create `src/cloud/index.ts` (barrel + `isCloudAvailable()`)
- Update `src/index.ts` to re-export cloud module

**When to use:** Modules that need data the user didn't create locally -- surf forecasts, recipe databases, word definitions, shared catalogs.

### Layer 3: Social Activity Emission (Opt-in social feed)

**What it does:** Emits activity events to the hub's social feed when interesting things happen in the module.

**How it works:** The module calls `emitActivity()` from `@mylife/social`. This silently no-ops if the user has no social profile. If they do, it posts to Supabase with the user's chosen visibility setting.

**Module code changes needed:**
- Add module to `SOCIAL_CAPABLE_MODULES` array in `packages/social/src/types.ts`
- Define activity types for the module (e.g., `car_maintenance_logged`, `car_milestone_reached`)
- Create `emitCarMaintenance()` and similar helper functions in `packages/social/src/emitters.ts`
- Call the emitter from the module's CRUD functions (optional -- can also be called from UI)

**When to use:** Any module where users might want to share achievements, streaks, or milestones.

### Layer 4: Cloud-Native Storage (Supabase as primary backend)

**What it does:** Changes the module's `storageType` from `'sqlite'` to `'supabase'` in its `ModuleDefinition`. The module still has local SQLite tables (for offline cache), but the cloud is the source of truth.

**How it works:** The module declares `storageType: 'supabase'` and `requiresAuth: true`. The hub ensures the user is authenticated before enabling the module. PowerSync keeps the local cache in sync.

**Module code changes needed:**
- Update `definition.ts`: `storageType: 'supabase'`, `requiresAuth: true`
- Add `src/cloud/` directory with full query adapters
- Ensure local CRUD still works for offline mode
- Add Supabase migration to `supabase/migrations/`

**When to use:** Modules where data inherently comes from external sources (surf forecasts, shared home listings, mail) or where multi-user collaboration is core.

### Layer 5: Shared/Community Features (User-generated cloud content)

**What it does:** Allows users to contribute content visible to other users -- reviews, photos, guides, shared workouts, recipe sharing.

**How it works:** Write operations go to Supabase (not local SQLite). Read operations can come from either local cache or Supabase. Content moderation, reporting, and privacy controls are handled by the hub's social package.

**Module code changes needed:**
- Add community table schemas (both local cache and Supabase)
- Add cloud query adapters for community CRUD
- Wire visibility controls (`public | followers | private`)
- Add Supabase RLS policies for the community tables

**When to use:** Modules where user-generated content adds value for other users.

---

## 3. Module Cloud Classification

Every module is classified by which layers make sense for it. This classification drives the conversion work.

### Classification Matrix

| Module | Layer 1 (Sync) | Layer 2 (Cloud Queries) | Layer 3 (Social) | Layer 4 (Cloud-Native) | Layer 5 (Community) |
|--------|:-:|:-:|:-:|:-:|:-:|
| **books** | Yes | Yes (Open Library catalog) | Yes (already wired) | No | Yes (reviews, lists) |
| **budget** | Yes | No | Yes (already wired) | No | No |
| **car** | Yes | Yes (recall databases, VIN lookup) | No | No | No |
| **closet** | Yes | No | No | No | No |
| **cycle** | Yes | No | Yes (streak sharing) | No | No |
| **fast** | Yes | No | Yes (already wired) | No | No |
| **flash** | Yes | Yes (shared card decks) | No | No | Yes (shared decks) |
| **garden** | Yes | Yes (plant databases) | Yes (garden sharing) | No | Yes (plant tips) |
| **habits** | Yes | No | Yes (already wired) | No | No |
| **health** | Yes | No | Yes (already wired) | No | No |
| **homes** | Yes | Yes (listings, market data) | No | Yes (already drizzle) | No |
| **journal** | Yes | No | No | No | No |
| **mail** | No (self-hosted) | N/A | No | Yes (IMAP/SMTP) | No |
| **meds** | Yes | Yes (drug interaction databases) | Yes (already wired) | No | No |
| **mood** | Yes | No | No | No | No |
| **notes** | Yes | No | No | No | Yes (shared notes) |
| **nutrition** | Yes | Yes (food databases, USDA) | No | No | No |
| **pets** | Yes | Yes (vet databases, breed info) | Yes (pet milestones) | No | No |
| **recipes** | Yes | Yes (shared recipe databases) | Yes (already wired) | No | Yes (shared recipes) |
| **rsvp** | Yes | No | No | No | Yes (shared events) |
| **stars** | Yes | Yes (astronomy databases) | No | No | No |
| **subs** | Yes | Yes (subscription price databases) | No | No | No |
| **surf** | Yes | Yes (forecasts, buoys, tides) | Yes (already wired) | Yes (already supabase) | Yes (reviews, photos) |
| **trails** | Yes | Yes (trail databases, maps) | Yes (hike sharing) | No | Yes (trail reviews) |
| **voice** | Yes | No | No | No | No |
| **words** | Yes | Yes (dictionary APIs) | Yes (already wired) | No | No |
| **workouts** | Yes | Yes (shared workout plans) | Yes (already wired) | No | Yes (shared workouts) |

### Priority Batches

**Batch 1 -- Sync Only (Layer 1, zero module code changes):**
All 26 sqlite modules get transparent sync for free when the user upgrades their sync tier. No conversion work needed. This is already built into the hub.

**Batch 2 -- Social Emission (Layer 3, small additions):**
Modules already in `SOCIAL_CAPABLE_MODULES`: books, budget, fast, habits, health, meds, recipes, surf, words, workouts. These just need their emitter functions called from CRUD or UI.

New modules to add: cycle, garden, pets, trails. Each needs 2-4 activity type definitions and corresponding emitter helpers.

**Batch 3 -- Cloud Query Adapters (Layer 2, moderate work):**
Priority order based on user value:
1. **nutrition** -- USDA food database lookups (high daily-use value)
2. **meds** -- Drug interaction checks (safety value)
3. **car** -- VIN decode, recall database (safety value)
4. **recipes** -- Shared recipe discovery (engagement value)
5. **books** -- Open Library integration (catalog value)
6. **words** -- Dictionary/thesaurus APIs (already requires network)
7. **pets** -- Breed info, vet finder (convenience)
8. **subs** -- Subscription price tracking (cost saving)
9. **stars** -- Astronomy event calendars (niche)
10. **flash** -- Shared flashcard decks (education)
11. **garden** -- Plant database (seasonal)
12. **trails** -- Trail databases (outdoor)
13. **workouts** -- Shared workout plans (fitness)

**Batch 4 -- Community Features (Layer 5, significant work):**
1. **recipes** -- Shared recipes, ratings (highest engagement potential)
2. **workouts** -- Shared plans, community challenges
3. **books** -- Book reviews, reading lists
4. **surf** -- Spot reviews, photos (already in Phase 5)
5. **trails** -- Trail reviews, conditions
6. **rsvp** -- Shared events, RSVPs
7. **flash** -- Shared card decks
8. **notes** -- Collaborative notes
9. **garden** -- Community plant tips

---

## 4. Per-Module Conversion Analysis

Each module gets a conversion profile. This section tells you exactly what to build for each module.

### books

**Current state:** Archived standalone, hub module has 4 schema versions, 11 tables, full CRUD, stats/export/import engines.
**Layer 1 (Sync):** Free -- no changes needed.
**Layer 2 (Cloud Queries):**
- `src/cloud/open-library.ts`: `searchBooks(query)`, `getBookByISBN(isbn)`, `getAuthor(key)`, `getCoverUrl(isbn, size)`
- Source: Port from standalone's `packages/shared/src/api/open-library.ts`
- External API: `https://openlibrary.org/` (no auth needed, rate-limited)
**Layer 3 (Social):** Already in `SOCIAL_CAPABLE_MODULES`. Emitters already defined: `books_started`, `books_finished`, `books_reviewed`, `books_goal_reached`.
**Layer 5 (Community):**
- `sf_book_reviews` -- public book reviews (distinct from private ratings already in module)
- `sf_reading_lists` -- shareable curated reading lists
- Requires: Supabase tables, RLS policies, cloud query adapters

### budget

**Current state:** Archived, 4 schema versions, 13 tables, budget + subscription engines, 200 tests.
**Layer 1 (Sync):** Free.
**Layer 3 (Social):** Already wired. Emitters: `budget_goal_met`, `budget_streak`.
**No other layers recommended.** Budget data is inherently private. No external data sources or community features make sense.

### car

**Current state:** 1 schema version, 4 tables. Phase 6 will expand to 7 tables + 4 engines.
**Layer 1 (Sync):** Free.
**Layer 2 (Cloud Queries):**
- `src/cloud/recalls.ts`: `checkRecalls(make, model, year)` -- NHTSA Recalls API (`https://api.nhtsa.dot.gov/recalls/recallsByVehicle`)
- `src/cloud/vin.ts`: `decodeVin(vin)` -- NHTSA VIN Decode API (`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/`)
- `src/cloud/fuel-prices.ts`: `getFuelPrices(zipCode)` -- future integration point (no free API yet)
- All NHTSA APIs are free, no auth needed, rate-limited
**Layer 3 (Social):** Not recommended. Vehicle maintenance is inherently private.

### closet

**Current state:** Scaffold only (definition + types + index, zero DB).
**Layer 1 (Sync):** Free once DB exists.
**No other layers recommended initially.** Build local-first closet management first.

### cycle

**Current state:** Scaffold only.
**Layer 1 (Sync):** Free once DB exists.
**Layer 3 (Social):** Add to `SOCIAL_CAPABLE_MODULES`. Activities: `cycle_period_logged`, `cycle_prediction_accuracy`.
**No other layers.** Cycle tracking is inherently private. Social is opt-in streak sharing only.

### fast

**Current state:** Full module, 2 schema versions, free tier.
**Layer 1 (Sync):** Free.
**Layer 3 (Social):** Already wired. Emitters: `fast_completed`, `fast_streak`, `fast_personal_best`.
**No other layers.** Fasting is simple local tracking with optional social sharing.

### flash

**Current state:** Scaffold only.
**Layer 1 (Sync):** Free once DB exists.
**Layer 2 (Cloud Queries):** `src/cloud/shared-decks.ts`: browse and import community flashcard decks from Supabase.
**Layer 5 (Community):** Users can publish their decks. Requires: `supabase/migrations/` for shared deck tables, RLS policies for public read + creator write.

### garden

**Current state:** Scaffold only.
**Layer 1 (Sync):** Free once DB exists.
**Layer 2 (Cloud Queries):**
- `src/cloud/plants.ts`: `searchPlants(query)`, `getPlantDetails(id)` -- Trefle API or similar plant database
- `src/cloud/weather.ts`: `getGrowingConditions(zipCode)` -- weather data for garden planning
**Layer 3 (Social):** Add to `SOCIAL_CAPABLE_MODULES`. Activities: `garden_planted`, `garden_harvested`, `garden_milestone`.
**Layer 5 (Community):** Community plant tips, garden photos.

### habits

**Current state:** Full module, 2 schema versions.
**Layer 1 (Sync):** Free.
**Layer 3 (Social):** Already wired. Emitters: `habits_completed`, `habits_streak`, `habits_milestone`.
**No other layers.** Habits are personal tracking with optional streak sharing.

### health

**Current state:** Full module, 1 schema version. Has `freeSections: ['fasting']`.
**Layer 1 (Sync):** Free.
**Layer 3 (Social):** Already wired. Emitters: `health_milestone`.
**No other layers.** Health data is maximally private.

### homes

**Current state:** Full module, `storageType: 'drizzle'`, `requiresAuth: true`. Already cloud-native.
**Already converted.** Uses Drizzle ORM + tRPC for cloud backend. Local SQLite for offline cache.

### journal

**Current state:** Scaffold only. Free tier.
**Layer 1 (Sync):** Free once DB exists.
**No other layers.** Journal is maximally private. End-to-end encryption recommended if sync is enabled.

### mail

**Current state:** Scaffold only. `requiresAuth: true`, `requiresNetwork: true`.
**Layer 4 (Cloud-Native):** Mail is inherently cloud-connected (IMAP/SMTP). Self-hosted email server, not Supabase.
**Special case:** Mail doesn't follow the standard conversion pattern. It connects to the user's own mail server, not MyLife's cloud infrastructure.

### meds

**Current state:** Full module, 2 schema versions.
**Layer 1 (Sync):** Free.
**Layer 2 (Cloud Queries):**
- `src/cloud/interactions.ts`: `checkInteractions(drugA, drugB)` -- OpenFDA API (`https://api.fda.gov/drug/`)
- `src/cloud/pill-id.ts`: `identifyPill(imprint, shape, color)` -- NLM Pillbox (or successor)
- Safety-critical: must show disclaimers, never replace medical advice
**Layer 3 (Social):** Already wired. Emitters: `meds_adherence_streak`. Only streak sharing, never share medication details.

### mood

**Current state:** Scaffold only. Free tier.
**Layer 1 (Sync):** Free once DB exists.
**No other layers.** Mood tracking is maximally private.

### notes

**Current state:** Scaffold only. Free tier.
**Layer 1 (Sync):** Free once DB exists.
**Layer 5 (Community):** Optional shared/collaborative notes. Low priority.

### nutrition

**Current state:** Full module, 3 schema versions.
**Layer 1 (Sync):** Free.
**Layer 2 (Cloud Queries):**
- `src/cloud/usda.ts`: `searchFoods(query)`, `getFoodDetails(fdcId)`, `getNutrients(fdcId)` -- USDA FoodData Central API (`https://api.nal.usda.gov/fdc/v1/`)
- Free API key required (register at USDA)
- `src/cloud/barcode.ts`: `lookupBarcode(upc)` -- Open Food Facts (`https://world.openfoodfacts.org/api/v2/`)
- No auth needed

### pets

**Current state:** Scaffold only.
**Layer 1 (Sync):** Free once DB exists.
**Layer 2 (Cloud Queries):**
- `src/cloud/breeds.ts`: `searchBreeds(species, query)`, `getBreedDetails(id)` -- TheDogAPI / TheCatAPI
- `src/cloud/vets.ts`: `findVets(latitude, longitude, radius)` -- Google Places or Yelp (requires API key)
**Layer 3 (Social):** Add to `SOCIAL_CAPABLE_MODULES`. Activities: `pets_milestone`, `pets_vet_visit`. Never share medical details.

### recipes

**Current state:** Archived, 4 schema versions, 8 tables, recipe scaling/nutrition engines.
**Layer 1 (Sync):** Free.
**Layer 2 (Cloud Queries):**
- `src/cloud/discover.ts`: `searchRecipes(query, filters)`, `getRecipeDetails(id)` -- Browse community-shared recipes from Supabase
**Layer 3 (Social):** Already wired. Emitters: `recipes_cooked`, `recipes_created`.
**Layer 5 (Community):**
- `sf_shared_recipes` -- publicly shared recipes
- `sf_recipe_ratings` -- community ratings
- `sf_recipe_comments` -- discussion threads
- Requires: Supabase tables, RLS, image storage bucket for recipe photos

### rsvp

**Current state:** Full module, 1 schema version.
**Layer 1 (Sync):** Free.
**Layer 5 (Community):**
- `sf_shared_events` -- events with shareable invite links
- `sf_rsvp_responses` -- attendee responses
- Core value proposition of RSVP is sharing events, so this is high priority

### stars

**Current state:** Scaffold only.
**Layer 1 (Sync):** Free once DB exists.
**Layer 2 (Cloud Queries):**
- `src/cloud/events.ts`: `getUpcomingEvents(latitude, longitude, days)` -- astronomy event APIs
- `src/cloud/objects.ts`: `searchObjects(query)` -- star/constellation databases

### subs

**Current state:** Scaffold only.
**Layer 1 (Sync):** Free once DB exists.
**Layer 2 (Cloud Queries):**
- `src/cloud/prices.ts`: `getSubscriptionPrice(service)`, `getPriceHistory(service)` -- track subscription price changes
- Would need a custom data source or scraping pipeline

### surf

**Current state:** Full module, `storageType: 'supabase'`. Phase 5 will expand significantly.
**Already cloud-native.** See `docs/plans/active/phase-5-mysurf-consolidation.md` for full plan.

### trails

**Current state:** Scaffold only.
**Layer 1 (Sync):** Free once DB exists.
**Layer 2 (Cloud Queries):**
- `src/cloud/trails.ts`: `searchTrails(lat, lng, radius)`, `getTrailDetails(id)` -- AllTrails-style trail database
- `src/cloud/weather.ts`: `getTrailWeather(lat, lng)` -- weather at trailhead
**Layer 3 (Social):** Add to `SOCIAL_CAPABLE_MODULES`. Activities: `trails_hike_completed`, `trails_distance_milestone`.
**Layer 5 (Community):** Trail reviews, condition reports, photos.

### voice

**Current state:** Scaffold only. Free tier.
**Layer 1 (Sync):** Free once DB exists.
**No other layers.** Voice memos are private recordings.

### words

**Current state:** Full module, `requiresNetwork: true`.
**Layer 1 (Sync):** Free.
**Layer 2 (Cloud Queries):** Already expected -- the module is marked `requiresNetwork: true`.
- `src/cloud/dictionary.ts`: `lookupWord(word)`, `getSynonyms(word)`, `getDefinitions(word)` -- Free Dictionary API, Datamuse, or Merriam-Webster
- `src/cloud/translate.ts`: `translateText(text, from, to)` -- LibreTranslate (self-hosted) or Google Cloud Translation
**Layer 3 (Social):** Already wired. Emitters: `words_learned`, `words_streak`, `words_milestone`.

### workouts

**Current state:** Archived, 3 schema versions, 11 tables, 8 engines, 284 tests.
**Layer 1 (Sync):** Free.
**Layer 2 (Cloud Queries):**
- `src/cloud/plans.ts`: `browseWorkoutPlans(filters)`, `importPlan(id)` -- community workout plans from Supabase
**Layer 3 (Social):** Already wired. Emitters: `workouts_completed`, `workouts_personal_best`, `workouts_streak`, `workouts_volume_milestone`.
**Layer 5 (Community):** Shared workout plans, community challenges.

---

## 5. Step-by-Step Conversion Process

For each module, follow these steps in order. Skip layers that don't apply per the classification matrix.

### Phase A: Audit (15 min)

1. Read the module's `src/definition.ts`, `src/types.ts`, `src/db/schema.ts`, `src/db/crud.ts`, `src/index.ts`
2. Read the module's classification entry in Section 4 above
3. Identify which layers (1-5) apply
4. Note the module's `tablePrefix` (e.g., `cr_` for car)
5. Check if the module is already in `SOCIAL_CAPABLE_MODULES`
6. List the external APIs or data sources needed for Layer 2

### Phase B: Cloud Query Adapters (Layer 2) -- If Applicable

1. Create `src/cloud/client.ts`:
   ```typescript
   // See Template 1 in Section 6
   ```

2. Create one file per data domain in `src/cloud/`:
   ```
   src/cloud/
     client.ts         -- Supabase client wrapper (if needed) or API client
     <domain>.ts       -- One file per external data source
     index.ts          -- Barrel export + isCloudAvailable()
   ```

3. Each cloud query function must:
   - Accept typed parameters
   - Return typed results matching the module's Zod schemas
   - Handle errors gracefully (return empty arrays or null, don't throw in the UI)
   - Include rate-limiting awareness if hitting external APIs
   - Never write to local SQLite -- that's the caller's job

4. Update `src/index.ts` to export the cloud module:
   ```typescript
   export * as cloud from './cloud/index';
   ```

5. If the external API requires an API key:
   - Add the key name to `packages/config/src/env.ts` (or equivalent)
   - Document the key in the module's CLAUDE.md
   - Never hardcode keys in source

### Phase C: Social Activity Emission (Layer 3) -- If Applicable

1. If the module is NOT already in `SOCIAL_CAPABLE_MODULES`:
   - Add it to the array in `packages/social/src/types.ts`
   - Define activity types in the `ActivityType` union
   - Create emitter helper functions in `packages/social/src/emitters.ts`

2. Activity type naming convention: `{moduleId}_{action}` (e.g., `car_maintenance_logged`)

3. Each emitter function:
   ```typescript
   // See Template 3 in Section 6
   ```

4. Call emitters from the module's CRUD functions or from UI event handlers. The emitter silently no-ops if the user has no social profile.

### Phase D: Supabase Schema (Layers 2/4/5) -- If Applicable

1. Create a new migration file in `supabase/migrations/` following the naming pattern:
   ```
   NNNNN_create_{module}_cloud_tables.sql
   ```

2. Each cloud table needs:
   - Primary key: `id UUID DEFAULT gen_random_uuid() PRIMARY KEY`
   - Timestamps: `created_at TIMESTAMPTZ DEFAULT now()`, `updated_at TIMESTAMPTZ DEFAULT now()`
   - User ownership: `user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE` (if user-specific)
   - Appropriate indexes

3. Add RLS policies:
   - Public data (e.g., recipes catalog): `ENABLE ROW LEVEL SECURITY; CREATE POLICY "public read" ON table FOR SELECT USING (true);`
   - User-owned data: `CREATE POLICY "user crud" ON table FOR ALL USING (auth.uid() = user_id);`
   - Community data: public read + authenticated write + owner-only update/delete

4. If using Supabase Storage (photos, files):
   - Create a storage bucket in the migration
   - Add storage RLS policies
   - Cloud adapter uploads via `supabase.storage.from('bucket').upload()`

### Phase E: Local Cache Tables (Layers 2/5) -- If Applicable

If cloud data needs to be cached locally for offline access:

1. Add new tables to the module's `src/db/schema.ts` with the module's prefix
2. Add a new migration version to `src/definition.ts`
3. Add CRUD functions for the cache tables in `src/db/crud.ts`
4. The cache is populated by the cloud adapter results -- the UI layer writes cloud results to local cache

### Phase F: Definition Update

1. Update `src/definition.ts` if the module's cloud requirements changed:
   - `storageType`: Change only if the module is now cloud-native (Layer 4). Most modules stay `'sqlite'`.
   - `requiresAuth`: Set to `true` only if the module CANNOT function without auth. Cloud sync (Layer 1) doesn't require this -- the sync layer handles its own auth gate.
   - `requiresNetwork`: Set to `true` only if the module CANNOT function without internet. Cloud query adapters (Layer 2) should degrade gracefully to cached data.

2. **Most modules should NOT change these flags.** The local-first default is intentional. Cloud features are additive overlays, not requirements.

### Phase G: Update Barrel Exports

1. Update `src/index.ts` to export new directories:
   ```typescript
   // Existing exports
   export { MODULE } from './definition';
   export * from './types';
   export * from './db/crud';

   // New cloud exports (if applicable)
   export * as cloud from './cloud/index';
   ```

### Phase H: Registry Sync

1. If you changed `storageType`, `requiresAuth`, or `requiresNetwork` in `definition.ts`, also update the corresponding entry in `packages/module-registry/src/constants.ts` to match.
2. The `definition.ts` is the source of truth, but keeping the registry in sync prevents confusion.

---

## 6. Code Templates

### Template 1: Cloud Client (External API)

```typescript
// modules/<name>/src/cloud/client.ts
// Use this when the module calls external APIs (not Supabase)

const BASE_URL = 'https://api.example.com/v1';

interface ApiClientOptions {
  apiKey?: string;
  timeout?: number;
}

let options: ApiClientOptions = {};

export function initApiClient(opts: ApiClientOptions): void {
  options = opts;
}

export async function apiFetch<T>(
  path: string,
  params?: Record<string, string>,
): Promise<T | null> {
  const url = new URL(path, BASE_URL);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  const headers: Record<string, string> = {};
  if (options.apiKey) {
    headers['Authorization'] = `Bearer ${options.apiKey}`;
  }

  const res = await fetch(url.toString(), {
    headers,
    signal: AbortSignal.timeout(options.timeout ?? 10_000),
  });

  if (!res.ok) return null;
  return res.json() as Promise<T>;
}
```

### Template 2: Cloud Client (Supabase)

```typescript
// modules/<name>/src/cloud/client.ts
// Use this when the module queries Supabase directly

import type { SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function initSupabaseClient(supabase: SupabaseClient): void {
  client = supabase;
}

export function getSupabase(): SupabaseClient {
  if (!client) {
    throw new Error(
      'Supabase client not initialized. Call initSupabaseClient() first.',
    );
  }
  return client;
}

export function isCloudAvailable(): boolean {
  return client !== null;
}
```

### Template 3: Social Activity Emitter

```typescript
// In packages/social/src/emitters.ts
// Add one function per module activity type

import { emitActivity } from './activity';
import type { ModuleId } from '@mylife/module-registry';

export function emitCarMaintenanceLogged(
  vehicleName: string,
  serviceType: string,
): ReturnType<typeof emitActivity> {
  return emitActivity({
    moduleId: 'car' as ModuleId,
    type: 'car_maintenance_logged',
    title: `Logged ${serviceType} for ${vehicleName}`,
    metadata: { vehicleName, serviceType },
  });
}

export function emitCarMilestone(
  vehicleName: string,
  milestone: string,
): ReturnType<typeof emitActivity> {
  return emitActivity({
    moduleId: 'car' as ModuleId,
    type: 'car_milestone_reached',
    title: `${vehicleName}: ${milestone}`,
    metadata: { vehicleName, milestone },
  });
}
```

### Template 4: Cloud Query Adapter

```typescript
// modules/<name>/src/cloud/<domain>.ts
// Example: modules/car/src/cloud/recalls.ts

import { apiFetch } from './client';
import type { RecallNotice } from '../types';

interface NhtsaRecallResponse {
  Count: number;
  results: Array<{
    NHTSACampaignNumber: string;
    Manufacturer: string;
    Component: string;
    Summary: string;
    Consequence: string;
    Remedy: string;
    ReportReceivedDate: string;
  }>;
}

export async function checkRecalls(
  make: string,
  model: string,
  year: number,
): Promise<RecallNotice[]> {
  const data = await apiFetch<NhtsaRecallResponse>(
    `/recalls/recallsByVehicle`,
    { make, model, modelYear: String(year) },
  );

  if (!data?.results) return [];

  return data.results.map((r) => ({
    campaignNumber: r.NHTSACampaignNumber,
    manufacturer: r.Manufacturer,
    component: r.Component,
    summary: r.Summary,
    consequence: r.Consequence,
    remedy: r.Remedy,
    reportDate: r.ReportReceivedDate,
  }));
}
```

### Template 5: Cloud Barrel Export

```typescript
// modules/<name>/src/cloud/index.ts

export { initApiClient, isCloudAvailable } from './client';
// OR for Supabase:
// export { initSupabaseClient, isCloudAvailable } from './client';

export { checkRecalls } from './recalls';
export { decodeVin } from './vin';
// ... other domain exports
```

### Template 6: UI Toggle Pattern (For Reference)

```typescript
// This goes in apps/web or apps/mobile -- NOT in the module
// Shows how the UI layer switches between local and cloud data sources

import { getSpots } from '@mylife/surf';          // local CRUD
import * as surfCloud from '@mylife/surf/cloud';   // cloud adapters
import { useSyncStatus } from '@mylife/sync';

function useSurfSpots(region: string) {
  const { tier } = useSyncStatus();
  const isCloud = tier !== 'local_only' && tier !== 'p2p';

  // Cloud: fetch from Supabase, then cache locally
  if (isCloud && surfCloud.isCloudAvailable()) {
    const cloudSpots = await surfCloud.getSpotsByRegion(region);
    // Optionally write to local cache for offline use
    for (const spot of cloudSpots) {
      createSpot(db, spot); // local cache write
    }
    return cloudSpots;
  }

  // Local: read from SQLite
  return getSpots(db, { region });
}
```

---

## 7. Testing Requirements

### Cloud Query Adapter Tests

Each cloud adapter file should have a corresponding test file:

```typescript
// modules/<name>/src/cloud/__tests__/<domain>.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the fetch calls
vi.stubGlobal('fetch', vi.fn());

describe('checkRecalls', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockReset();
  });

  it('returns recalls for a known vehicle', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        Count: 1,
        results: [{ NHTSACampaignNumber: '24V123', /* ... */ }],
      }),
    } as Response);

    const recalls = await checkRecalls('Toyota', 'Camry', 2020);
    expect(recalls).toHaveLength(1);
    expect(recalls[0].campaignNumber).toBe('24V123');
  });

  it('returns empty array on API failure', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response);
    const recalls = await checkRecalls('Toyota', 'Camry', 2020);
    expect(recalls).toEqual([]);
  });
});
```

### Social Emitter Tests

```typescript
// packages/social/src/__tests__/emitters.test.ts
// Test that emitters call emitActivity with correct parameters
// and that they no-op gracefully when no social profile exists
```

### What NOT to Test

- Do not test PowerSync sync behavior -- that's `@mylife/sync`'s responsibility
- Do not test Supabase auth flows -- that's `@mylife/auth`'s responsibility
- Do not test entitlement gating -- that's `@mylife/subscription`'s responsibility
- Focus on: your cloud adapter functions return correct types, handle errors, and transform API responses properly

---

## 8. Verification Checklist

After converting a module, verify:

```
[ ] pnpm typecheck passes
[ ] pnpm test passes (including new cloud adapter tests)
[ ] Module's definition.ts flags are correct
[ ] Registry constants.ts matches definition.ts
[ ] Cloud adapters handle API failures gracefully (return null/empty, don't throw)
[ ] Cloud adapters don't import from @mylife/db or DatabaseAdapter
[ ] Cloud adapters don't write to local SQLite (that's the caller's job)
[ ] Local CRUD functions don't import from cloud/ directory
[ ] If social emitters added: module is in SOCIAL_CAPABLE_MODULES
[ ] If Supabase tables added: migration file exists in supabase/migrations/
[ ] If Supabase tables added: RLS policies are defined
[ ] src/index.ts exports new cloud module
[ ] No API keys hardcoded in source
[ ] Module still works fully offline (cloud is additive, not required)
```

---

## 9. Prompts for Each Conversion Phase

These are copy-paste prompts for an AI agent or developer to execute each phase of a module's cloud conversion.

### Prompt 1: Audit a Module for Cloud Readiness

```
Read the cloud module conversion spec at docs/plans/active/cloud-module-conversion-spec.md,
Section 4, for the module "{MODULE_NAME}".

Then read these files:
- modules/{MODULE_NAME}/src/definition.ts
- modules/{MODULE_NAME}/src/types.ts
- modules/{MODULE_NAME}/src/db/schema.ts (if exists)
- modules/{MODULE_NAME}/src/db/crud.ts (if exists)
- modules/{MODULE_NAME}/src/index.ts

Produce a report:
1. Current state (tables, CRUD functions, tests, schema version)
2. Which cloud layers (1-5) apply per the spec's classification matrix
3. For Layer 2: list specific external APIs with their base URLs and auth requirements
4. For Layer 3: list activity types to define
5. For Layer 5: list community table schemas needed
6. Estimated effort (S/M/L/XL)
7. Any concerns or blockers
```

### Prompt 2: Add Cloud Query Adapters (Layer 2)

```
Read the cloud module conversion spec at docs/plans/active/cloud-module-conversion-spec.md.
Follow Section 5, Phase B exactly.

Module: {MODULE_NAME}
External APIs to integrate: {API_LIST_FROM_AUDIT}

Steps:
1. Create src/cloud/client.ts using Template 1 (external API) or Template 2 (Supabase)
2. For each API domain, create src/cloud/{domain}.ts using Template 4
3. Each function must:
   - Accept typed parameters matching the module's Zod schemas
   - Return typed results (never raw API responses)
   - Return null or empty arrays on failure (never throw)
   - Use AbortSignal.timeout for request timeouts
4. Create src/cloud/index.ts using Template 5
5. Update src/index.ts to export: export * as cloud from './cloud/index'
6. Add types for API response shapes to src/types.ts if needed
7. Write tests in src/cloud/__tests__/{domain}.test.ts mocking fetch calls
8. Run: pnpm typecheck && pnpm test -- --filter @mylife/{MODULE_NAME}

Do NOT modify definition.ts flags (storageType, requiresAuth, requiresNetwork)
unless the module genuinely cannot function without network.
```

### Prompt 3: Add Social Activity Emission (Layer 3)

```
Read the cloud module conversion spec at docs/plans/active/cloud-module-conversion-spec.md.
Follow Section 5, Phase C exactly.

Module: {MODULE_NAME}
Activity types to add: {ACTIVITY_LIST_FROM_AUDIT}

Steps:
1. Check if {MODULE_NAME} is already in SOCIAL_CAPABLE_MODULES
   - File: packages/social/src/types.ts
   - If not present, add it to the array

2. Add activity type strings to the ActivityType union in packages/social/src/types.ts:
   - Naming convention: {moduleId}_{action} (e.g., car_maintenance_logged)

3. Create emitter helper functions in packages/social/src/emitters.ts using Template 3:
   - One function per activity type
   - Each function calls emitActivity() with moduleId, type, title, metadata
   - The emitter silently no-ops if no social profile exists

4. Run: pnpm typecheck && pnpm test

Do NOT call the emitters from module CRUD functions yet.
That wiring happens in the UI layer or during a separate integration pass.
```

### Prompt 4: Add Supabase Cloud Tables (Layers 4/5)

```
Read the cloud module conversion spec at docs/plans/active/cloud-module-conversion-spec.md.
Follow Section 5, Phase D exactly.

Module: {MODULE_NAME}
Tables to create: {TABLE_LIST_FROM_AUDIT}

Steps:
1. Determine the next migration number in supabase/migrations/ (ls the directory)
2. Create: supabase/migrations/{NEXT_NUMBER}_create_{MODULE_NAME}_cloud_tables.sql
3. For each table:
   - Use UUID primary keys: id UUID DEFAULT gen_random_uuid() PRIMARY KEY
   - Add created_at TIMESTAMPTZ DEFAULT now()
   - Add user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE (if user-owned)
   - Add appropriate indexes (foreign keys, frequently queried columns)
4. Add RLS policies:
   - Public read tables: CREATE POLICY "public_read" ON {table} FOR SELECT USING (true)
   - User-owned tables: CREATE POLICY "user_crud" ON {table} FOR ALL USING (auth.uid() = user_id)
   - Community tables: public read + authenticated insert + owner update/delete
5. If using Supabase Storage:
   - INSERT INTO storage.buckets (id, name, public) VALUES ('{module}-photos', '{module}-photos', true)
   - Add storage RLS policies

Review the migration SQL for:
- All tables have RLS enabled
- Foreign key references are valid
- Indexes cover query patterns from the cloud adapter functions
```

### Prompt 5: Add Local Cache Tables (Layer 2/5 supplement)

```
Read the cloud module conversion spec at docs/plans/active/cloud-module-conversion-spec.md.
Follow Section 5, Phase E exactly.

Module: {MODULE_NAME}
Table prefix: {PREFIX} (e.g., cr_ for car)
Current schema version: {VERSION}

Steps:
1. Add new CREATE TABLE statements to src/db/schema.ts
   - Use the module's table prefix (e.g., cr_recalls for car recall cache)
   - Include a synced_at TEXT column for cache freshness tracking
2. Add a new migration to src/definition.ts:
   - Bump schemaVersion by 1
   - Migration.up = SQL to create new tables
   - Migration.down = SQL to drop new tables
3. Add CRUD functions to src/db/crud.ts for the cache tables:
   - upsert pattern (INSERT OR REPLACE) for cache writes
   - Standard SELECT for cache reads
   - Optional: cache expiry check function
4. Update src/types.ts with Zod schemas for cached entities
5. Update src/index.ts barrel exports
6. Run: pnpm typecheck && pnpm test -- --filter @mylife/{MODULE_NAME}
```

### Prompt 6: Full Module Cloud Conversion (All Applicable Layers)

```
Read the entire cloud module conversion spec at
docs/plans/active/cloud-module-conversion-spec.md.

Module to convert: {MODULE_NAME}

Execute all applicable phases from Section 5 in order:
A. Audit (read existing code, identify applicable layers)
B. Cloud Query Adapters (if Layer 2 applies)
C. Social Activity Emission (if Layer 3 applies)
D. Supabase Schema (if Layers 4/5 apply)
E. Local Cache Tables (if caching cloud data)
F. Definition Update (only if truly needed)
G. Barrel Export Updates
H. Registry Sync

After each phase, run: pnpm typecheck

After all phases, run the full verification checklist from Section 8.

Final verification:
- pnpm typecheck passes
- pnpm test passes
- pnpm check:parity passes
- The module still works fully offline (cloud is additive)
```

### Prompt 7: Batch Social Emission for Multiple Modules

```
Read the cloud module conversion spec at docs/plans/active/cloud-module-conversion-spec.md,
Section 5 Phase C and Section 4 for the following modules:
{MODULE_LIST}

For each module:
1. Check the classification matrix for which activity types to add
2. Add the module to SOCIAL_CAPABLE_MODULES if not present
3. Add activity type strings to the ActivityType union
4. Create emitter helper functions

All changes go to packages/social/src/:
- types.ts (SOCIAL_CAPABLE_MODULES array, ActivityType union)
- emitters.ts (helper functions)

Run: pnpm typecheck && pnpm test after all modules are added.
```

---

## Appendix A: External API Reference

| API | URL | Auth | Rate Limit | Used By |
|-----|-----|------|------------|---------|
| NHTSA Recalls | `api.nhtsa.dot.gov/recalls/` | None | Unspecified | car |
| NHTSA VIN Decode | `vpic.nhtsa.dot.gov/api/` | None | Unspecified | car |
| USDA FoodData Central | `api.nal.usda.gov/fdc/v1/` | API key (free) | 3600/hr | nutrition |
| Open Food Facts | `world.openfoodfacts.org/api/v2/` | None | Unspecified | nutrition |
| OpenFDA Drug | `api.fda.gov/drug/` | API key (free) | 240/min | meds |
| Open Library | `openlibrary.org/` | None | Rate limited | books |
| Free Dictionary API | `api.dictionaryapi.dev/api/v2/` | None | Unspecified | words |
| Datamuse | `api.datamuse.com/` | None | 100k/day | words |
| TheDogAPI | `api.thedogapi.com/v1/` | API key (free) | Unspecified | pets |
| TheCatAPI | `api.thecatapi.com/v1/` | API key (free) | Unspecified | pets |
| Trefle Plants | `trefle.io/api/v1/` | API key (free) | 120/min | garden |

## Appendix B: Supabase Table Naming

Cloud tables in Supabase do NOT use the module's SQLite prefix. They use descriptive names:

| Module | SQLite (local) | Supabase (cloud) |
|--------|---------------|-----------------|
| surf | `sf_spots` | `spots` |
| surf | `sf_forecasts` | `forecasts` |
| recipes | `rc_shared_recipes` | `shared_recipes` |
| workouts | `wk_shared_plans` | `shared_workout_plans` |

PowerSync maps between them. The module's cloud adapter queries Supabase tables by their cloud names.

## Appendix C: Privacy Classification

Modules are classified by data sensitivity. This affects which layers are appropriate.

| Classification | Modules | Cloud Restrictions |
|---------------|---------|-------------------|
| **Maximum Privacy** | journal, mood, health, cycle, meds | Sync only (Layer 1). No community features. E2E encryption recommended. Social limited to anonymous streaks. |
| **Private by Default** | budget, car, closet, subs, voice | Sync only (Layer 1). Cloud queries OK for external data (Layer 2). No community sharing of personal data. |
| **Shareable** | books, fast, habits, nutrition, pets, recipes, words, workouts | All layers appropriate. User controls what to share. Default: private. |
| **Inherently Social** | rsvp, surf, trails, garden, flash | Community features (Layer 5) are core value. Still default to private, but sharing is a primary use case. |
| **Cloud-Native** | surf, homes, mail | Cannot function fully without network. Local cache for offline degradation. |
