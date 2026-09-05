# Feature Spec: Harvest Tracking Improvements

## Metadata
- **Module:** garden
- **Priority Score:** 25 / 50 (B-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 2 x3 + Complexity 4 x2 + CrossModule 3 x1 + PaidUser 2 x1
- **Sprint:** Sprint 2+
- **Estimated CC Time:** 2-3 hours
- **Depends On:** none (basic harvest exists via gd_entries with action='harvest' and quantityGrams)
- **Blocks:** none

## Business Context

### Why This Feature Exists
The garden module already tracks harvests via journal entries (action='harvest', quantityGrams), but this is a flat log with no structure. Users who grow food want to know: how many tomatoes did I harvest this year? How does this year compare to last year? What's my best-producing plant? When was peak harvest? Seed to Spoon's harvest tracking with yield charts and seasonal comparisons is one of its most valued premium features. This enhancement adds dedicated harvest logging with crop types, weight units, quality ratings, harvest calendar visualization, and yield analytics per plant and per season.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Seed to Spoon | Yes | Premium ($46.99/yr) | Detailed harvest log with weight, quantity, photos, yield charts by season |
| Gardenize | Yes | Free (basic) | Harvest entries with weight, tied to plant records |
| GrowVeg | Yes | Premium ($35) | Harvest tracking with crop yield comparison year-over-year |
| Planter | No | N/A | No harvest tracking |
| PlantIn | No | N/A | Focused on houseplants, no harvest feature |

### Target User
Vegetable and herb gardeners who want data on their growing productivity. Users who track harvests in spreadsheets or note apps because their garden app only supports basic weight logging. Also food-conscious users who want to quantify how much food they grow at home (crossModule with recipes for "garden-to-table" tracking).

## Technical Context

### Where This Lives in MyLife

```
modules/garden/src/types.ts                        -- HarvestRecord, HarvestUnit, HarvestStats types
modules/garden/src/db/schema.ts                    -- gd_harvests table (V2 migration)
modules/garden/src/db/crud.ts                      -- Harvest CRUD, yield analytics queries
modules/garden/src/engine/harvest-analytics.ts      -- Yield calculations, seasonal comparisons
modules/garden/src/definition.ts                   -- V2 migration
apps/mobile/app/(garden)/harvests.tsx              -- Harvest log screen
apps/mobile/app/(garden)/harvest-detail.tsx         -- Harvest detail/edit screen
apps/mobile/app/(garden)/components/HarvestCalendar.tsx  -- Calendar heatmap
apps/mobile/app/(garden)/components/YieldChart.tsx       -- Yield bar chart
apps/web/app/garden/harvests/page.tsx              -- Web harvest dashboard
```

### Wireframe Position

```
Hub Dashboard
  └── MyGarden card
       └── Journal tab
            └── [Filter: All | Harvests]
                 └── Harvest log ← YOU ARE HERE
       └── Garden tab
            └── Plant Detail
                 └── Harvest Log section
```

### Data Model

```sql
-- V2 migration: dedicated harvest tracking table
CREATE TABLE IF NOT EXISTS gd_harvests (
  id TEXT PRIMARY KEY,
  plant_id TEXT NOT NULL REFERENCES gd_plants(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit TEXT NOT NULL DEFAULT 'grams',
  crop_type TEXT,
  quality_rating INTEGER,
  image_uri TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS gd_harvests_plant_idx ON gd_harvests(plant_id);
CREATE INDEX IF NOT EXISTS gd_harvests_date_idx ON gd_harvests(date DESC);
CREATE INDEX IF NOT EXISTS gd_harvests_crop_idx ON gd_harvests(crop_type);
```

**Column notes:**
- `quantity`: numeric amount (e.g., 500.0)
- `unit`: 'grams' | 'kg' | 'oz' | 'lbs' | 'count' | 'bunches' | 'cups'
- `crop_type`: freeform text for categorization (e.g., "tomato", "basil", "zucchini"). Used for grouping analytics.
- `quality_rating`: 1-5 star rating (nullable, optional)
- `image_uri`: local photo path of the harvest

**Migration note:** Existing harvest data lives in gd_entries (action='harvest', quantityGrams). The V2 migration should include a data migration step that copies existing harvest entries to gd_harvests, converting quantityGrams to quantity with unit='grams'. After migration, new harvests go to gd_harvests; old entries remain for journal continuity.

### Dependencies
- **Internal:** `@mylife/garden` (types, crud, existing harvest entries), `@mylife/ui`
- **External:** None for V1. Future: `victory-native` for charts on mobile, `recharts` for web
- **Cross-Module:** recipes module (CrossModule score 3) -- future "garden-to-table" link where harvest records feed into recipe ingredient tracking. Budget module could track value of home-grown produce.

## Functional Requirements

### User Stories
1. As a gardener, I want to log harvests with quantity, weight unit, crop type, quality, and photo so that I have detailed records of my yields.
2. As a gardener, I want to see a calendar heatmap of harvest activity so that I can visualize my growing season peaks.
3. As a gardener, I want yield analytics per plant and per crop type so that I know which plants produce the most.
4. As a gardener, I want year-over-year harvest comparisons so that I can track whether my garden is improving.
5. As a gardener, I want to choose my preferred weight unit (metric or imperial) so that harvest data is in familiar units.

### Behavior Specification

**Log a harvest:**
1. User navigates to a plant's detail page and taps "Log Harvest" (or uses the Journal tab and selects "Harvest" action)
2. Harvest form opens with:
   - Plant (pre-filled if from plant detail, picker if from journal)
   - Date (defaults to today, date picker)
   - Quantity (numeric input, required)
   - Unit (segmented picker: g, kg, oz, lbs, count, bunches, cups)
   - Crop type (text input with autocomplete from previous crop types, e.g., "tomato")
   - Quality rating (1-5 stars, optional)
   - Photo (camera or gallery, optional)
   - Notes (text, optional)
3. Save creates gd_harvests record

**Harvest log screen:**
1. Chronological list of all harvests, newest first
2. Filter bar: by plant, by crop type, by date range
3. Each harvest card shows: plant name, crop type badge, quantity + unit, quality stars, date, thumbnail
4. Summary stats at top: total harvested this year (in preferred unit), number of harvest events, top-producing plant

**Harvest calendar heatmap:**
1. GitHub-style contribution calendar showing daily harvest activity
2. Darker green = more harvests that day
3. Tapping a day shows harvest details for that date

**Yield analytics:**
1. Bar chart: total yield per plant (top 10 plants)
2. Line chart: monthly harvest totals for current year
3. Year-over-year comparison: side-by-side bars for current vs previous year (if data exists)
4. Crop type breakdown: donut chart showing proportion by crop type

### Edge Cases

- **No harvests yet:** Empty state with illustration: "Log your first harvest to start tracking yields." + "Log Harvest" button
- **Harvest with 0 quantity:** Reject with validation "Quantity must be greater than 0"
- **Unit conversion for analytics:** When aggregating totals, convert all weights to user's preferred unit. Default to grams for metric, oz for imperial.
- **Mixed units in same plant:** Analytics normalize to a single unit per chart. Show the unit in chart labels.
- **Very large harvest values:** Accept up to 99,999.99 per entry. Display with appropriate precision (0 decimals for count, 1 decimal for weight).
- **Plant deleted:** CASCADE deletes all harvest records for that plant
- **Data migration from V1 entries:** Existing gd_entries with action='harvest' must be migrated to gd_harvests with unit='grams'. Don't delete old entries.
- **Crop type autocomplete:** Fuzzy match against existing crop types in gd_harvests. Case-insensitive.
- **Year-over-year with no prior year data:** Show only current year, hide comparison

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Log Harvest form accepts quantity, unit, crop type, quality rating, photo, and notes
- [ ] **AC-2:** Harvest log shows chronological list with filter by plant, crop type, and date range
- [ ] **AC-3:** Summary stats at top show total harvested this year, event count, and top producer
- [ ] **AC-4:** Calendar heatmap visualizes daily harvest activity with intensity shading
- [ ] **AC-5:** Tapping a heatmap day shows that day's harvest details
- [ ] **AC-6:** Yield analytics show per-plant bar chart, monthly line chart, and crop type donut
- [ ] **AC-7:** Year-over-year comparison visible when 2+ years of data exist
- [ ] **AC-8:** Unit picker allows switching between g/kg/oz/lbs/count/bunches/cups
- [ ] **AC-9:** Crop type input autocompletes from previously used crop types
- [ ] **AC-10:** Quality rating is optional (1-5 stars)
- [ ] **AC-11:** Harvest photos viewable from harvest detail

### Technical Criteria
- [ ] **TC-1:** Harvests persisted to gd_harvests with all columns populated correctly
- [ ] **TC-2:** V2 migration migrates existing gd_entries harvest data to gd_harvests
- [ ] **TC-3:** Yield analytics queries aggregate correctly across unit types
- [ ] **TC-4:** CASCADE delete on plant_id removes harvest records
- [ ] **TC-5:** Crop type autocomplete query returns case-insensitive matches
- [ ] **TC-6:** Calendar heatmap data query returns harvest counts by date efficiently
- [ ] **TC-7:** Analytics handle empty data gracefully (no divide-by-zero, no empty charts)

### Negative Criteria
- [ ] **NC-1:** Harvest photos must NOT be uploaded to any server
- [ ] **NC-2:** Migration must NOT delete existing gd_entries harvest records
- [ ] **NC-3:** Harvest tracking must NOT require network connectivity
- [ ] **NC-4:** Quality rating must NOT be required (optional field)

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Cards: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border
- Module accent: `#22C55E`
- Harvest cards: glass morphism, plant thumbnail (36px circle), crop type pill badge in accent color, quantity + unit in large text, quality stars in golden (#FFD60A), date in secondary text
- Calendar heatmap: 7-row x 52-column grid, intensity mapped from transparent to accent green. Empty days: `rgba(255,255,255,0.04)`. Active days: `#22C55E` at 25/50/75/100% opacity based on harvest count
- Charts: accent green for bars/lines/donut segments, secondary text for labels
- Unit picker: horizontal segmented control, accent highlight on selected

### Web (Next.js)

- Same tokens via CSS variables
- Route: `/garden/harvests`
- 2-column layout: harvest log left, analytics right
- Calendar heatmap spans full width above the log
- Charts use recharts library with Cool Obsidian theme colors

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton cards + placeholder chart | Initial data fetch |
| Empty | "Log your first harvest" illustration + CTA | No harvest records |
| Error | "Could not load harvests. Pull to retry." | DB query fails |
| Success | Harvest log + calendar + analytics | 1+ harvests exist |
| Partial | Log populated but analytics sparse (few data points) | <5 harvests |

## Test Requirements

### Unit Tests
- [ ] `createHarvest()`: persists record with all fields
- [ ] `createHarvest()`: rejects quantity <= 0
- [ ] `getHarvests()`: filters by plant_id, crop_type, date range
- [ ] `getHarvestStats()`: returns correct total, count, top producer
- [ ] `getYieldByPlant()`: aggregates correctly with unit normalization
- [ ] `getMonthlyYield()`: returns 12-month totals for a given year
- [ ] `getHarvestCalendar()`: returns harvest count per day for date range
- [ ] `getCropTypes()`: returns distinct crop types for autocomplete
- [ ] `migrateHarvestEntries()`: converts gd_entries harvests to gd_harvests correctly
- [ ] Unit conversion: grams to oz, kg to lbs, etc.

### Integration Tests
- [ ] Full flow: log harvest -> verify in DB -> verify in harvest log list -> verify in analytics
- [ ] Migration flow: existing harvest entry -> run V2 migration -> verify in gd_harvests
- [ ] Delete flow: delete plant -> verify cascade removes harvests

### QA Verification Script

1. Open the app on iOS/Android
2. Navigate to MyGarden module
3. Open a plant that can produce harvests (e.g., a tomato plant)
4. Tap "Log Harvest"
5. Fill in: quantity 500, unit grams, crop type "tomato", quality 4 stars, add photo
6. Save
7. Verify: harvest appears in plant detail's harvest section -- AC-1
8. Navigate to Harvests screen (Journal tab > filter "Harvests")
9. Verify: harvest log shows the new entry with all details -- AC-2
10. Verify: summary stats show total, count, and top producer -- AC-3
11. Log 5 more harvests on different dates
12. Verify: calendar heatmap shows activity on those dates -- AC-4
13. Tap a heatmap day
14. Verify: that day's harvest details appear -- AC-5
15. Scroll to yield analytics
16. Verify: per-plant bar chart, monthly line chart, crop type donut visible -- AC-6
17. Change unit picker to "oz"
18. Verify: displayed quantities convert to ounces -- AC-8
19. Start typing a crop type
20. Verify: autocomplete suggests previously used types -- AC-9
21. Delete the plant
22. Verify: all associated harvests are removed from the log
23. On web: navigate to /garden/harvests
24. Verify: 2-column layout with log, calendar heatmap, and charts

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for yield analytics and unit conversion

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- if module has standalone counterpart
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
Harvests tracked via gd_entries (action='harvest', quantityGrams). No crop types, no unit selection, no quality rating, no analytics, no calendar visualization.

### After This Work
- Dedicated gd_harvests table with crop type, unit, quality rating, photo
- Data migration from existing harvest entries
- Harvest log screen with filtering and summary stats
- Calendar heatmap for harvest activity visualization
- Yield analytics with per-plant, monthly, crop type, and year-over-year charts
- Unit conversion and preference system

### Files Changed
- `modules/garden/src/types.ts` -- HarvestRecord, HarvestUnit, HarvestStats types
- `modules/garden/src/db/schema.ts` -- gd_harvests table
- `modules/garden/src/db/crud.ts` -- Harvest CRUD and analytics queries
- `modules/garden/src/engine/harvest-analytics.ts` -- Yield calculations, unit conversion
- `modules/garden/src/definition.ts` -- V2 migration with data migration step
- `apps/mobile/app/(garden)/harvests.tsx` -- Harvest log screen
- `apps/mobile/app/(garden)/harvest-detail.tsx` -- Harvest detail/edit
- `apps/mobile/app/(garden)/components/HarvestCalendar.tsx` -- Calendar heatmap
- `apps/mobile/app/(garden)/components/YieldChart.tsx` -- Yield charts
- `apps/web/app/garden/harvests/page.tsx` -- Web harvest dashboard

### Known Limitations
- V1 charts may use simple bar/line representations. Victory-native or recharts integration adds complexity.
- Year-over-year comparison requires 2 years of data. First-year users only see current year.
- Unit conversion is approximate for volume units (cups/bunches) which vary by crop.

### Context for Next Agent
- The data migration from gd_entries to gd_harvests should run inside the V2 migration's `up` function. Use an INSERT...SELECT pattern.
- Existing gd_entries harvest records should NOT be deleted -- they remain as journal entries. The new gd_harvests table is the canonical harvest data source going forward.
- The crossModule score (3) reflects future potential: recipes module could query gd_harvests to show "home-grown ingredients available" when planning meals. Budget module could track dollar-value of home-grown produce. These integrations are NOT part of this spec.
