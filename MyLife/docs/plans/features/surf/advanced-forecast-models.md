# Feature Spec: Advanced Forecast Models

## Metadata
- **Module:** surf
- **Priority Score:** 19 / 50 (C-Tier)
- **Scoring Breakdown:** Market 1 x3 + Switching 3 x3 + Complexity 1 x2 + CrossModule 1 x1 + PaidUser 4 x1
- **Sprint:** TBD
- **Estimated CC Time:** 4-5 hours
- **Depends On:** none
- **Blocks:** none

## Business Context

### Why This Feature Exists
MySurf currently uses a single forecast model (GFS) for all predictions. Serious surfers and weather nerds want multi-model comparison to make better session decisions. Surfline uses proprietary LOLA models, while Windy differentiates on multi-model visualization (ECMWF, GFS, NAM, ICON). Adding model comparison turns MySurf from a "good enough" forecast tool into a power-user tool that justifies the premium subscription.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Surfline | Yes | Partial | Proprietary LOLA model + GFS. Premium unlocks 16-day extended forecasts. Model comparison not exposed to users. |
| Windy | Yes | Partial | ECMWF, GFS, NAM, ICON, AROME visible to all. Premium adds more models and higher resolution. Multi-model overlay on maps. |
| Magic Seaweed | Yes | No | GFS + ECMWF comparison charts for wave height, period, direction |

### Target User
Power surfers and weather enthusiasts who understand swell models and want to cross-reference predictions. These users currently toggle between Windy ($19.99/yr) for weather models and Surfline ($119.99/yr) for surf-specific forecasts. Giving them model comparison in one app adds premium value.

## Technical Context

### Where This Lives in MyLife

```
modules/surf/src/types.ts                    -- ForecastModelSchema, ModelComparisonSchema
modules/surf/src/db/schema.ts                -- ALTER sf_forecasts, new sf_model_runs table
modules/surf/src/db/crud.ts                  -- Multi-model forecast queries
modules/surf/src/cloud/forecasts.ts          -- Updated cloud queries with model filter
modules/surf/src/engine/model-comparison.ts  -- NEW: model comparison/ensemble engine
modules/surf/src/index.ts                    -- Export new types and functions
modules/surf/src/definition.ts               -- Migration version bump
apps/mobile/app/(surf)/models.tsx            -- Model comparison screen
apps/web/app/surf/models/page.tsx            -- Web model comparison page
```

### Wireframe Position

```
Hub Dashboard
  └── MySurf card
       └── Forecast tab (existing)
            └── Spot Forecast view
                 └── Model selector toggle ← NEW (GFS | ECMWF | Ensemble)
                 └── Model comparison chart ← NEW (overlay/split view)
       └── Models tab ← NEW TAB (or accessible from spot detail)
            └── Model dashboard with all models side-by-side
```

### Data Model

```sql
-- Track model run metadata (when each model was last ingested)
CREATE TABLE IF NOT EXISTS sf_model_runs (
  id TEXT PRIMARY KEY,
  model_name TEXT NOT NULL,
  run_time TEXT NOT NULL,
  coverage_hours INTEGER NOT NULL DEFAULT 168,
  resolution_hours REAL NOT NULL DEFAULT 3,
  source TEXT NOT NULL DEFAULT 'noaa',
  ingested_at TEXT NOT NULL DEFAULT (datetime('now')),
  forecast_count INTEGER NOT NULL DEFAULT 0
);

-- Extend sf_forecasts: model_name column already exists (DEFAULT 'gfs')
-- Add model confidence score
ALTER TABLE sf_forecasts ADD COLUMN confidence REAL;

-- Ensemble/blended forecast cache
CREATE TABLE IF NOT EXISTS sf_ensemble_forecasts (
  id TEXT PRIMARY KEY,
  spot_id TEXT NOT NULL REFERENCES sf_spots(id) ON DELETE CASCADE,
  forecast_time TEXT NOT NULL,
  wave_height_min_ft REAL NOT NULL DEFAULT 0,
  wave_height_max_ft REAL NOT NULL DEFAULT 0,
  wave_height_spread_ft REAL NOT NULL DEFAULT 0,
  wind_speed_kts REAL NOT NULL DEFAULT 0,
  wind_speed_spread_kts REAL NOT NULL DEFAULT 0,
  model_count INTEGER NOT NULL DEFAULT 1,
  models_json TEXT NOT NULL DEFAULT '[]',
  agreement_score REAL NOT NULL DEFAULT 0,
  rating INTEGER,
  condition_color TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS sf_model_runs_name_time_idx
  ON sf_model_runs(model_name, run_time);
CREATE UNIQUE INDEX IF NOT EXISTS sf_ensemble_spot_time_idx
  ON sf_ensemble_forecasts(spot_id, forecast_time);
```

**Supported models (initial launch):**

| Model | Source | Resolution | Forecast Range | Update Frequency |
|-------|--------|------------|---------------|-----------------|
| GFS | NOAA | 0.25 deg / 3hr | 16 days | Every 6 hours |
| ECMWF | Copernicus | 0.1 deg / 1hr | 10 days | Every 12 hours |
| NAM | NOAA | 12km / 1hr | 3.5 days | Every 6 hours |
| WaveWatch III | NOAA | 0.5 deg / 3hr | 7 days | Every 6 hours |

### Dependencies
- **Internal:** `@mylife/db` (migration), existing `sf_forecasts` table (model_name column already present)
- **External:** NOAA GFS (existing), Copernicus CDS API (ECMWF access), NOAA NAM/WW3 endpoints. Data pipeline workers (Supabase Edge Functions or standalone cron) to ingest multiple models.
- **Cross-Module:** None

## Functional Requirements

### User Stories
1. As a power surfer, I want to compare GFS and ECMWF forecasts for my spot so I can see where the models agree and where they diverge.
2. As a casual surfer, I want to see an "ensemble" (blended) forecast that combines multiple models so I get the most accurate prediction without needing to understand model differences.
3. As a weather nerd, I want to see which model run I'm looking at (timestamp, resolution) so I can assess data freshness.
4. As a surfer planning a trip, I want to see model agreement scores so I know how confident to be in the extended forecast.

### Behavior Specification

1. User navigates to a spot's forecast view
2. A model toggle appears above the forecast chart: `Ensemble` (default) | `GFS` | `ECMWF` | `More...`
3. **Ensemble view (default):** Shows blended wave height range with a shaded confidence band. The band is narrow when models agree and wide when they diverge. An "agreement score" (0-100%) is displayed per time slot.
4. **Single model view:** Shows that model's forecast only, with a small badge showing the model run timestamp and resolution.
5. **Comparison view:** User taps "Compare" to see 2 models overlaid on the same chart (different colored lines). Divergence zones are highlighted.
6. User taps "More..." to see all available models and their metadata (last run time, resolution, coverage).
7. Model metadata section shows: model name, last ingestion time, forecast horizon, and a freshness indicator (green = <6h old, yellow = 6-12h, red = >12h).
8. Extended forecast (days 8-16) shows only GFS data with a "single model" badge since ECMWF/NAM don't extend that far.

### Edge Cases

- **Only one model available:** Show that model directly without a toggle. Display "Additional models coming soon" note.
- **Model run delayed/missing:** Show last available run with a stale-data warning: "GFS data is 8 hours old (expected every 6 hours)".
- **Models disagree significantly (spread >3ft):** Show a "High uncertainty" badge on the ensemble view to warn users.
- **ECMWF data unavailable (API down):** Gracefully fall back to GFS-only with an info banner. Do not break the forecast view.
- **Forecast time beyond a model's range:** Grey out that model's line in the comparison chart beyond its horizon.
- **New model added in the future:** The `sf_model_runs` table and `models_json` in ensemble forecasts are schema-flexible. Adding a model requires only a new pipeline worker and seed data -- no schema migration.
- **Offline mode:** Cache the latest ensemble forecast for favorited spots. Individual model data is too large for offline caching.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Model toggle appears on spot forecast view with Ensemble as default
- [ ] **AC-2:** Ensemble view shows blended wave height with confidence band visualization
- [ ] **AC-3:** Agreement score (0-100%) displays per time slot in ensemble view
- [ ] **AC-4:** Selecting a single model shows that model's forecast with run metadata badge
- [ ] **AC-5:** Compare view overlays 2 models with different colors and highlights divergence zones
- [ ] **AC-6:** "More..." button shows all models with last run time, resolution, and freshness indicator
- [ ] **AC-7:** Extended forecast beyond model coverage gracefully indicates limited data source

### Technical Criteria
- [ ] **TC-1:** Migration creates `sf_model_runs` and `sf_ensemble_forecasts` tables
- [ ] **TC-2:** Migration adds `confidence` column to `sf_forecasts`
- [ ] **TC-3:** `sf_forecasts` can store rows for multiple model_name values per spot+time
- [ ] **TC-4:** Ensemble engine: given forecasts from N models for a spot+time, computes blended height, spread, and agreement score
- [ ] **TC-5:** Cloud adapter `cloudGetSpotForecast` accepts optional `modelName` filter parameter
- [ ] **TC-6:** Cloud adapter `cloudGetEnsembleForecast(spotId)` returns the ensemble view data
- [ ] **TC-7:** Cloud adapter `cloudGetModelRuns()` returns latest run metadata for all models
- [ ] **TC-8:** Ensemble computation runs in <100ms for a 7-day forecast (168 time slots x 4 models)

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** The default forecast view must NOT change for users who don't interact with the model toggle -- ensemble is the new default and must be at least as good as the old single-model view
- [ ] **NC-2:** Model comparison must NOT show data as if models are equivalent when they have different resolutions -- always show resolution metadata
- [ ] **NC-3:** Stale model data must NOT be silently served -- freshness indicators are required

## UI Specification

### Mobile (Expo)

- **Model toggle:** Segmented control (`Ensemble | GFS | ECMWF | More...`) pinned below the spot name, above the forecast chart. Selected segment uses accent `#3B82F6`, unselected uses `rgba(255,255,255,0.08)`.
- **Confidence band:** Semi-transparent fill between min/max of model spread, color intensity proportional to agreement score. High agreement = narrow solid band. Low agreement = wide faded band.
- **Agreement score badge:** Small pill with percentage, colored green (>80%), yellow (50-80%), or red (<50%).
- **Model metadata card:** Glass card showing model name, icon, last run time, resolution, coverage range.
- Background: `#0A0A0F`, chart grid: `rgba(255,255,255,0.06)`

### Web (Next.js)

- **Model toggle:** Same segmented control pattern, responsive to wider screens
- **Comparison chart:** Wider canvas allows side-by-side model charts or overlay with legend
- Route: `/surf/models` for standalone model dashboard, `/surf/spot/[slug]` retains model toggle inline
- Chart library: use the same charting library already in the surf module (or introduce a lightweight one like `recharts` if none exists)

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton chart area with shimmer | Forecast data fetching |
| Empty | "No forecast data available" with "Check back soon" | Model data not yet ingested for this spot |
| Error | "Unable to load forecast models" + retry | API/network failure |
| Success | Model toggle + chart with confidence band + agreement scores | Multi-model data loaded |
| Partial | Single model forecast shown, "Additional models unavailable" banner | Only GFS available, ECMWF missing |

## Test Requirements

### Unit Tests
- [ ] Ensemble engine: 2 models with identical forecasts -> agreement = 100%, spread = 0
- [ ] Ensemble engine: 2 models with 3ft divergence -> agreement < 50%, spread = 3
- [ ] Ensemble engine: 1 model input -> returns that model's data as-is, agreement = 100%
- [ ] Ensemble engine: handles missing time slots in one model (interpolation or gap)
- [ ] Model run CRUD: create, list, get latest by model name
- [ ] Ensemble forecast CRUD: upsert, get by spot, delete old

### Integration Tests
- [ ] Full flow: ingest GFS + ECMWF forecasts -> compute ensemble -> query ensemble for spot
- [ ] Model selector: switch between models -> verify different data returned
- [ ] Stale data: create model run >12h old -> verify freshness indicator is red

### QA Verification Script

1. Open the app on mobile
2. Navigate to a spot detail with multi-model forecast data
3. Verify model toggle appears with "Ensemble" selected by default -- corresponds to AC-1
4. Verify confidence band is visible on the wave height chart -- corresponds to AC-2
5. Verify agreement score badges appear per time slot -- corresponds to AC-3
6. Tap "GFS" -- verify chart updates to single model with run metadata badge -- corresponds to AC-4
7. Tap "Compare" -- select GFS + ECMWF -- verify overlay chart with colored lines -- corresponds to AC-5
8. Tap "More..." -- verify all models listed with metadata and freshness -- corresponds to AC-6
9. Scroll to extended forecast (days 8+) -- verify single model indicator -- corresponds to AC-7

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for the ensemble computation engine

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- if module has standalone counterpart
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- MySurf uses a single forecast model (GFS) via `sf_forecasts.model_name DEFAULT 'gfs'`
- No model comparison or ensemble functionality
- No model metadata tracking
- `cloudGetSpotForecast` returns all forecasts for a spot without model filtering

### After This Work
- `sf_model_runs` table tracks ingestion metadata for each model
- `sf_ensemble_forecasts` table stores precomputed blended forecasts
- `sf_forecasts.confidence` column available for per-row model confidence
- Model comparison engine computes agreement scores and confidence bands
- Cloud adapters support model-filtered queries and ensemble retrieval
- Spot detail shows model toggle with ensemble as default
- New Models screen/page for detailed model metadata

### Files Changed

- `modules/surf/src/types.ts` -- Add ForecastModelSchema, ModelRunSchema, EnsembleForecastSchema, ModelComparisonResultSchema
- `modules/surf/src/db/schema.ts` -- New table DDL for sf_model_runs and sf_ensemble_forecasts, ALTER sf_forecasts
- `modules/surf/src/db/crud.ts` -- Model run CRUD, ensemble CRUD, updated forecast queries with model filter
- `modules/surf/src/cloud/forecasts.ts` -- Add modelName param to cloudGetSpotForecast, new cloudGetEnsembleForecast, cloudGetModelRuns
- `modules/surf/src/engine/model-comparison.ts` -- New file: ensemble computation engine
- `modules/surf/src/definition.ts` -- Migration version bump
- `modules/surf/src/index.ts` -- Export new types, engine, and CRUD
- `apps/mobile/app/(surf)/models.tsx` -- New model comparison screen
- `apps/mobile/app/(surf)/spot/[id].tsx` -- Add model toggle to forecast section
- `apps/web/app/surf/models/page.tsx` -- New web models page

### Known Limitations
- ECMWF data requires a Copernicus CDS API key and has rate limits -- free tier may be sufficient for MVP but production scale needs a commercial agreement
- NAM model covers only CONUS -- not useful for Hawaii or international zones
- Ensemble computation is precomputed by a backend worker, not real-time -- there's a lag between model ingestion and ensemble availability
- V1 does not include proprietary model tuning (Surfline's LOLA equivalent) -- this is a potential future differentiator

### Context for Next Agent
- The `model_name` column already exists on `sf_forecasts` with a default of `'gfs'`. The schema change is additive (new tables + one new column), not destructive.
- The data pipeline workers that ingest forecast data (currently in the standalone MySurf repo) need to be updated to ingest ECMWF, NAM, and WW3 in addition to GFS. This is pipeline work, not hub module work.
- The ensemble engine is a pure computation: given N model forecasts for the same spot+time, output a blended forecast with spread and agreement metrics. Good candidate for `/domain-engine-benchmarker`.
- Chart rendering will need a library. Check if the existing surf module already uses one before adding a new dependency.
