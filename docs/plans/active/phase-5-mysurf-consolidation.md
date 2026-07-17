# Phase 5: MySurf Consolidation Plan

## Metadata
- **Project:** MyLife
- **Priority:** 02
- **Effort:** XL (2-3 sessions)
- **Dependencies:** Phase 4 complete (workouts archived)
- **Worktree:** No (direct on main)

## Context

MySurf is the first cloud-capable module consolidation. Unlike Phases 1-4 (pure SQLite local modules), MySurf has a dual-layer architecture: local SQLite for offline-first operation + Supabase cloud backend for forecasts, community, and sync. The hub already supports this via `@mylife/sync` (PowerSync + SyncManager), `@mylife/auth` (dual local/cloud), and `ModuleDefinition.storageType: 'supabase'`.

**Standalone stack:** Turborepo, Expo, Next.js 15, Supabase (PostgreSQL + PostGIS + Edge Functions), Mapbox GL, Claude API, Zod, Vitest
**Hub pattern:** Port `packages/shared/` engines into `modules/surf/src/`, port `packages/api/` queries as cloud query adapters, port data pipeline as a separate concern

### Why This Phase Is Special

This is the **template consolidation** for cloud modules. The patterns established here (local-first CRUD + optional cloud queries, social opt-in, data pipeline integration) will be reused by any future module that needs cloud connectivity. The plan explicitly marks which decisions are MySurf-specific vs reusable template patterns.

## Current Hub Module State

The hub surf module at `modules/surf/` already has:
- **Definition:** `storageType: 'supabase'`, `requiresAuth: true`, `requiresNetwork: false`
- **Schema V1 (2 tables):** `sf_spots` (basic spot info + conditions), `sf_sessions` (surf session logs)
- **CRUD:** 12 functions (spots CRUD, sessions CRUD, favorites, aggregations)
- **Types:** Basic `Spot`, `SurfSession` schemas
- **Tests:** Zero test files

## Gap Analysis

### A. Pure Business Logic Engines (Port Directly)

These are stateless, zero-dependency functions. Copy and adapt imports only.

| File to Create | Source | Key Exports |
|---------------|--------|-------------|
| `src/rating/rating.ts` | `packages/shared/src/models/rating.ts` | `computeSpotRating(spot, forecast)` -- weighted algorithm: swell 0.45, wind 0.30, tide 0.15, consistency 0.10. Multi-swell support, cross-swell interference penalty, spot-type refraction modifier |
| `src/rating/energy.ts` | `packages/shared/src/models/energy.ts` | `computeEnergy(swells)` -- oceanographic formula E = rho*g*H^2*T/16 |
| `src/rating/wind.ts` | `packages/shared/src/models/wind.ts` | `classifyWind(dir, spotOrientation, speed)`, `windScore(speed, dir, orientation)` -- 6 wind categories, speed modifier |
| `src/rating/tide.ts` | `packages/shared/src/models/tide.ts` | `scoreTide(currentTideFt, idealLow, idealHigh, spotType)` -- sensitivity multipliers per break type |
| `src/utils/directions.ts` | `packages/shared/src/utils/directions.ts` | `angleDifference`, `degreesToCompass`, `computeDirectionFit` -- wrap-around angle math |
| `src/utils/geo.ts` | `packages/shared/src/utils/geo.ts` | `haversineDistance`, `feetToMeters`, `metersToFeet` |
| `src/utils/waves.ts` | `packages/shared/src/utils/waves.ts` | `detectWaves(points, options)` -- GPS wave detection from track points |
| `src/utils/alerts.ts` | `packages/shared/src/utils/alerts.ts` | `evaluateAlertRule`, `evaluateAlertRules` -- AND/OR chain evaluation |
| `src/utils/trails.ts` | `packages/shared/src/utils/trails.ts` | `computeTrackDistanceMeters`, `computeElevationGainLoss`, `summarizeTrail` |
| `src/utils/gpx.ts` | `packages/shared/src/utils/gpx.ts` | `exportTrackToGpx`, `importTrackFromGpx` -- regex-based XML, no DOM dep |

### B. Types (Expand types.ts)

**From standalone `packages/shared/src/types/`:**

| Type File | Key Schemas to Add |
|-----------|--------------------|
| `spot.ts` | `SpotTypeSchema` (beach/point/reef), `SkillLevelSchema`, `HazardSchema` (9 values), `RegionSchema` (13 CA regions). Align existing `sf_spots` schema with standalone's richer `Spot` (add: break_type, skill_level, hazards, ideal_swell_dir_min/max, ideal_tide_low/high, orientation_deg, latitude, longitude) |
| `forecast.ts` | `ConditionColorSchema`, `WindLabelSchema`, `SwellComponentSchema`, `ForecastSchema`, `TidePointSchema`, `NarrativeSchema`, `BuoyReadingSchema`, `SunTimesSchema` |
| `user.ts` | `UserProfileSchema`, `SurfSessionSchema` (align with existing `sf_sessions`), `UserPinSchema` |
| `alerts.ts` | `AlertParameterSchema` (7 params), `AlertOperatorSchema`, `AlertRuleSchema`, `SpotAlertSchema`, `SpotAlertNotificationSchema` |
| `community.ts` | `SpotReviewSchema`, `SpotPhotoSchema`, `SpotGuideSchema` |
| `trails.ts` | `TrailDifficultySchema`, `TrailSchema`, `RecordedHikeSchema`, `OfflineRegionSchema` |

**Engine-specific types:**
- `RatingResult`, `SpotProfile`, `SwellInput`, `ForecastInput`
- `GpsTrackPoint`, `DetectedWave`, `WaveDetectionOptions`
- `TrailTrackPoint`, `TrailSummary`, `GpxTrackPoint`

### C. Schema Expansion (V2 + V3 Migrations)

**V2 Migration -- Enrich existing tables + add forecast/buoy tables:**

| Table | Hub Name | Key Columns | Notes |
|-------|----------|-------------|-------|
| ALTER `sf_spots` | -- | Add: break_type, skill_level, hazards_json, ideal_swell_dir_min, ideal_swell_dir_max, ideal_tide_low, ideal_tide_high, orientation_deg, latitude, longitude, slug | Align with standalone's rich spot model |
| `sf_forecasts` | NEW | id, spot_id FK, forecast_time, model_run, model_name, wave_height_ft, wave_period_s, wave_direction, wind_speed_kts, wind_direction, wind_label, consistency, rating, condition_color, water_temp_f, created_at | Local cache of forecast data |
| `sf_swell_components` | NEW | id, forecast_id FK, swell_index, height_ft, period_s, direction, energy_kj | Per-swell breakdown for multi-swell rating |
| `sf_tides` | NEW | id, station_id, timestamp, height_ft, type, created_at | Tide predictions cache |
| `sf_buoy_readings` | NEW | id, buoy_id, timestamp, wave_height_ft, dominant_period_s, avg_period_s, wave_direction, water_temp_f, wind_speed_kts, wind_direction, created_at | NDBC buoy data cache |
| `sf_narratives` | NEW | id, spot_id, region, forecast_date, summary, detail_json, model_used, helpful_votes, unhelpful_votes, created_at | AI-generated surf narratives |

**V3 Migration -- User + community + alerts tables:**

| Table | Hub Name | Key Columns | Notes |
|-------|----------|-------------|-------|
| `sf_user_pins` | NEW | id, user_id, name, latitude, longitude, notes, created_at | Custom map pins |
| `sf_spot_alerts` | NEW | id, user_id, spot_id FK, name, is_active, last_triggered_at, cooldown_minutes, created_at | Condition alert subscriptions |
| `sf_alert_rules` | NEW | id, alert_id FK, parameter, operator, value, join_operator, sort_order | Alert rule chain |
| `sf_alert_notifications` | NEW | id, alert_id FK, forecast_id, triggered_at, dismissed_at | Alert history |
| `sf_spot_reviews` | NEW | id, spot_id FK, user_id, rating, text, skill_level, visited_at, created_at | Community reviews |
| `sf_spot_photos` | NEW | id, spot_id FK, user_id, image_url, caption, created_at | Community photos |
| `sf_spot_guides` | NEW | id, spot_id FK, overview, best_conditions_json, hazards_json, access_notes, created_at | Spot guides |
| `sf_session_waves` | NEW | id, session_id FK, wave_number, duration_s, max_speed_kts, distance_m, direction, detected_at | GPS-detected wave rides |
| `sf_trail_hike_summaries` | NEW | id, user_id, local_hike_id, trail_id, distance_m, elevation_gain_m, elevation_loss_m, duration_s, pace_min_per_km, started_at, created_at | Recorded hikes |

### D. CRUD Functions (New)

**Forecast/conditions CRUD (local cache):**
- `upsertForecast(db, input)`, `getSpotForecast(db, spotId, days?)`, `getSpotForecastByModel(db, spotId, model, days?)`
- `upsertSwellComponents(db, forecastId, components[])`, `getSwellComponents(db, forecastId)`
- `upsertTidePrediction(db, input)`, `getTides(db, stationId, start, end)`
- `upsertBuoyReading(db, input)`, `getLatestBuoyReading(db, buoyId)`, `getRecentBuoyReadings(db, buoyId, hours)`
- `upsertNarrative(db, input)`, `getSpotNarrative(db, spotId, date)`, `getRegionNarrative(db, region, date)`

**User/community CRUD:**
- `createUserPin(db, input)`, `getUserPins(db, userId)`, `deleteUserPin(db, id)`
- `createSpotReview(db, input)`, `getSpotReviews(db, spotId)`, `deleteSpotReview(db, id)`
- `createSpotPhoto(db, input)`, `getSpotPhotos(db, spotId)`, `deleteSpotPhoto(db, id)`
- `upsertSpotGuide(db, input)`, `getSpotGuide(db, spotId)`

**Alert CRUD:**
- `createSpotAlert(db, input)`, `getSpotAlerts(db, userId, spotId?)`, `setSpotAlertActive(db, id, active)`
- `deleteSpotAlert(db, id)`, `createAlertRule(db, input)`, `getAlertRules(db, alertId)`
- `createAlertNotification(db, input)`, `getAlertNotifications(db, alertId)`

**Session waves:**
- `recordSessionWave(db, input)`, `getSessionWaves(db, sessionId)`

**Trail hikes:**
- `upsertTrailHikeSummary(db, input)`, `getTrailHikeSummaries(db, userId)`

### E. Cloud Query Adapters (New -- Template Pattern)

> **TEMPLATE PATTERN:** This is the reusable pattern for adding cloud connectivity to any module.

Create `src/cloud/` directory with query adapters that mirror the local CRUD interface but target Supabase. These are used when `SyncTier >= free_cloud` and the user is authenticated.

| File | Source | Description |
|------|--------|-------------|
| `src/cloud/client.ts` | `packages/api/src/client.ts` | Lazy Supabase client init, injected URL + anon key |
| `src/cloud/spots.ts` | `packages/api/src/queries/spots.ts` | `getSpotsByRegion`, `getSpotBySlug`, `getNearbySpots` (PostGIS RPC), `getUserFavoriteSpots` |
| `src/cloud/forecasts.ts` | `packages/api/src/queries/forecasts.ts` | `getSpotForecast`, `getSpotNarrative`, `getRegionNarrative`, `getTides` |
| `src/cloud/buoys.ts` | `packages/api/src/queries/buoys.ts` | `getLatestBuoyReading`, `getRecentBuoyReadings` |
| `src/cloud/alerts.ts` | `packages/api/src/queries/alerts.ts` | `createSpotAlert`, `getSpotAlerts`, `evaluateAlertsForForecast` (Edge Function call) |
| `src/cloud/community.ts` | `packages/api/src/queries/community.ts` | `getSpotReviews`, `createSpotReview`, `uploadSpotPhoto` (Storage bucket) |
| `src/cloud/mutations.ts` | `packages/api/src/queries/mutations.ts` | `createUserPin`, `createSurfSession`, `toggleFavorite`, `voteOnNarrative` |
| `src/cloud/trails.ts` | `packages/api/src/queries/trails.ts` | `syncTrailHikeSummary`, `getTrailHikeSummaries` |
| `src/cloud/index.ts` | -- | Barrel export + `isCloudAvailable()` helper |

**The cloud query adapter pattern:**
```typescript
// Template: src/cloud/spots.ts
import { getSupabase } from './client';
import type { Spot } from '../types';

export async function getSpotsByRegion(region: string): Promise<Spot[]> {
  const client = getSupabase();
  const { data, error } = await client
    .from('spots')
    .select('*')
    .eq('region', region)
    .order('name');
  if (error) throw error;
  return data ?? [];
}
```

Each cloud adapter:
1. Gets the Supabase client (throws if not initialized)
2. Runs the query against the cloud table (no prefix -- Supabase uses its own schema)
3. Returns typed results matching the local CRUD return types
4. The calling code decides whether to use local CRUD or cloud adapter based on sync tier

### F. Data Pipeline Integration (Defer to Separate Package)

The data pipeline (`apps/data-pipeline/`) handles NOAA/NDBC ingestion, forecast generation, and narrative creation. This is **not** module business logic -- it's a server-side data service.

**Recommendation:** Do NOT port the data pipeline into `modules/surf/`. Instead:
1. Port the pure parsers (e.g., `parseNdbcLine`, `parseWW3BulletinLine`, prompt templates) into the module for potential local use
2. Keep the pipeline itself as a separate concern -- either `apps/data-pipeline/` in the hub or a standalone service
3. The module's cloud adapters fetch the pipeline's output via Supabase queries

**Pure parsers to port:**
- `src/pipeline/parsers.ts`: `parseNdbcLine(line, buoyId)`, `parseWW3BulletinLine(line)`, `buildWW3Url(modelRun)`, `getLatestModelRun()`
- `src/pipeline/prompts.ts`: `REGION_NARRATIVE_SYSTEM_PROMPT`, `SPOT_NARRATIVE_SYSTEM_PROMPT`, `buildRegionNarrativePrompt(ctx)`
- `src/pipeline/color-mapper.ts`: `waveHeightToColor(heightFt)`, `gridToPixelBuffer(grid, width, height)`
- `src/pipeline/tile-generator.ts`: `latLngToTile`, `tileBounds`, `getCATiles` (pure math)

### G. Deliberately Excluded

- **Supabase migrations** -- Stays in `supabase/migrations/`. The hub shares these across cloud modules.
- **Edge Functions** -- Stay in `supabase/functions/`. Server-side only. Alert evaluation logic is already in `src/utils/alerts.ts` (no duplication needed).
- **Data pipeline scheduling** -- Server-side cron concern, not module business logic.
- **Mapbox config** -- UI layer, stays in `apps/` and `packages/maps/`.
- **Historical backfill CLI** -- One-time data seed script, not ongoing module code.

### H. Missing Tests

**Port from standalone:**
1. `rating/__tests__/rating.test.ts` -- spot rating algorithm
2. `rating/__tests__/energy.test.ts` -- wave energy calculations
3. `rating/__tests__/wind.test.ts` -- wind classification and scoring
4. `rating/__tests__/tide.test.ts` -- tide scoring
5. `utils/__tests__/directions.test.ts` -- angle math
6. `utils/__tests__/geo.test.ts` -- haversine, unit conversions
7. `utils/__tests__/waves.test.ts` -- GPS wave detection
8. `utils/__tests__/alerts.test.ts` -- alert rule evaluation
9. `utils/__tests__/trails.test.ts` -- trail analytics
10. `utils/__tests__/gpx.test.ts` -- GPX import/export

**Write new:**
11. `db/__tests__/spots.test.ts` -- enriched spot CRUD
12. `db/__tests__/sessions.test.ts` -- session + wave detection CRUD
13. `db/__tests__/forecasts.test.ts` -- forecast cache CRUD
14. `db/__tests__/alerts.test.ts` -- alert + rule CRUD
15. `db/__tests__/community.test.ts` -- reviews, photos, guides CRUD
16. `pipeline/__tests__/parsers.test.ts` -- NDBC/WW3 line parsers

## Tasks

### Task 1: Expand Types + V2/V3 Schema + CRUD
- Add all missing types from standalone `types/*.ts` to `src/types.ts`
- Add engine-specific types (RatingResult, DetectedWave, TrailSummary, etc.)
- Align existing Spot/Session schemas with standalone (add missing columns)
- Create V2 migration (enrich spots, add forecast/buoy/tide/narrative tables)
- Create V3 migration (user pins, alerts, community, session waves, trail hikes)
- Implement all new CRUD functions
- Update barrel exports

### Task 2: Port Pure Business Logic Engines
- Copy and adapt 10 engine files from standalone
- Create `src/rating/` directory: rating.ts, energy.ts, wind.ts, tide.ts, index.ts
- Create `src/utils/` directory: directions.ts, geo.ts, waves.ts, alerts.ts, trails.ts, gpx.ts, index.ts
- Port pure pipeline parsers to `src/pipeline/`: parsers.ts, prompts.ts, color-mapper.ts, tile-generator.ts
- Update barrel exports

### Task 3: Create Cloud Query Adapters
- Create `src/cloud/` directory with 9 adapter files
- Implement cloud versions of spot, forecast, buoy, alert, community, mutation, trail queries
- Add `isCloudAvailable()` helper based on sync tier
- Wire cloud client initialization
- Update barrel exports

### Task 4: Write Tests
- Port 10 engine test files from standalone
- Write 6 new CRUD test files
- Target: ~150+ tests

### Task 5: Docs + Archive
- Update `modules/surf/CLAUDE.md`
- Update `MyLife/CLAUDE.md` (Phase 5 Done, MySurf archived)
- Update parity scripts
- Archive standalone: `git submodule deinit -f MySurf && git rm --cached MySurf && mv MySurf archive/MySurf`
- Update `archive/README.md`, `.gitmodules`, parity scripts, passthrough matrix test

## Verification

```bash
pnpm typecheck           # Zero errors
pnpm test -- --filter @mylife/surf  # All tests pass
pnpm check:parity        # Full suite passes
```

---

## Appendix: Cloud Module Consolidation Template

> **This section is a reusable template.** When consolidating any module that needs cloud connectivity, follow these steps. MySurf is the reference implementation.

### Step 1: Classify Module Features by Connectivity Tier

| Tier | Features | Auth Required? | Network Required? |
|------|----------|---------------|-------------------|
| **Local Only** (default) | All CRUD, pure engines, offline data | No | No |
| **P2P Sync** (opt-in) | Device-to-device data transfer via WebRTC | No | LAN only |
| **Free Cloud** (opt-in) | Basic cloud sync (1 GB), read-only cloud data | Yes (Supabase) | Yes |
| **Paid Cloud** (opt-in) | Full cloud sync (5-25 GB), write to cloud, community features, social | Yes (Supabase) | Yes |

### Step 2: Structure the Module

```
modules/<name>/src/
  types.ts           -- All Zod schemas (shared by local + cloud)
  definition.ts      -- ModuleDefinition with storageType + flags
  db/
    schema.ts        -- SQLite table definitions (prefixed)
    crud.ts          -- Local CRUD against DatabaseAdapter
  <engine>/          -- Pure business logic (zero deps)
    *.ts             -- Stateless functions
  cloud/             -- Cloud query adapters (optional)
    client.ts        -- Supabase client wrapper
    *.ts             -- Cloud query functions mirroring local CRUD
    index.ts         -- Barrel + isCloudAvailable()
  index.ts           -- Barrel exports
```

### Step 3: Implement Local-First CRUD

All CRUD functions take `DatabaseAdapter` as first argument. They write to prefixed SQLite tables. This works regardless of sync tier. The user's data is always local.

```typescript
// Example: modules/surf/src/db/crud.ts
export function createSpot(db: DatabaseAdapter, input: CreateSpotInput): string {
  const id = generateId();
  db.execute(
    `INSERT INTO sf_spots (id, name, region, ...) VALUES (?, ?, ?, ...)`,
    [id, input.name, input.region, ...]
  );
  return id;
}
```

### Step 4: Add Cloud Query Adapters (If Needed)

Cloud adapters mirror the local CRUD interface but target Supabase. They are used when the user has opted into a cloud sync tier.

```typescript
// Example: modules/surf/src/cloud/spots.ts
export async function getSpotsByRegion(region: string): Promise<Spot[]> {
  const client = getSupabase();
  const { data, error } = await client.from('spots').select('*').eq('region', region);
  if (error) throw error;
  return data ?? [];
}
```

### Step 5: Wire the Toggle Pattern

The UI layer (in `apps/`) decides which data source to use:

```typescript
// In apps/web or apps/mobile -- NOT in the module
import { getSpots } from '@mylife/surf'; // local CRUD
import { getSpotsByRegion } from '@mylife/surf/cloud'; // cloud adapter
import { useSyncStatus } from '@mylife/sync';

function useSpots(region: string) {
  const { tier } = useSyncStatus();
  const isCloud = tier !== 'local_only' && tier !== 'p2p';

  if (isCloud) {
    // Fetch from Supabase, cache locally
    return useCloudQuery(() => getSpotsByRegion(region));
  }
  // Use local SQLite data
  return useLocalQuery((db) => getSpots(db, { region }));
}
```

### Step 6: Social Features (Hub-Level)

Social features (profiles, follows, posts, likes) are handled by `packages/social/`, not by individual modules. Modules opt into social by:

1. Being listed in `SOCIAL_CAPABLE_MODULES` in `packages/social/`
2. Emitting social events when interesting things happen (e.g., `surf_session_logged`)
3. The social package handles the Supabase writes and social graph

### Step 7: Entitlements Gate

Cloud features are gated by the user's subscription tier:

```typescript
import { resolveEntitlements } from '@mylife/subscription';

const entitlements = resolveEntitlements(purchases);
// entitlements.storageTier: 'free' | 'starter' | 'power'
// entitlements.syncTier: 'local_only' | 'p2p' | 'free_cloud' | 'starter_cloud' | 'power_cloud'
```

### Key Principles

1. **Local is always the default.** Every module works fully offline with SQLite. Cloud is additive.
2. **Auth is only required for cloud tiers.** Local and P2P modes need no authentication.
3. **CRUD functions never import Supabase.** They take `DatabaseAdapter`. Cloud adapters are a separate directory.
4. **Social is hub-level.** Modules emit events; the hub's social package handles the rest.
5. **Sync is transparent.** PowerSync handles SQLite-to-Supabase replication. Module code doesn't manage sync state.
6. **Storage limits are enforced by SyncManager.** Modules don't need to check quotas.
