# Feature Spec: Multi-Beverage Types

## Metadata
- **Module:** fast
- **Priority Score:** 28 / 50 (B-Tier)
- **Scoring Breakdown:** Market [3] x3 + Switching [2] x3 + Complexity [4] x2 + CrossModule [2] x1 + PaidUser [3] x1
- **Sprint:** 2+
- **Estimated CC Time:** 3-4 hours
- **Depends On:** Water intake logging (FT-007, already implemented in ft_water_intake)
- **Blocks:** Caffeine tracking (FT-016, depends on beverage type infrastructure)

## Business Context

### Why This Feature Exists
MyFast's current water intake system is a simple glass counter (ft_water_intake with an integer count). Real users drink tea, coffee, sparkling water, juice, and other beverages throughout the day, each with different hydration contributions. A cup of coffee is slightly dehydrating due to caffeine (coefficient ~0.8), while herbal tea hydrates equivalently to water (coefficient 1.0). Alcohol is net dehydrating (coefficient -0.5). Without multi-beverage support, users either over-count (logging all drinks as water) or under-count (only logging plain water), making hydration tracking inaccurate. This feature also lays the data foundation for caffeine tracking (FT-016).

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Zero | Yes | Yes ($69.99/yr) | Multiple drink types with hydration coefficients, quick-log icons |
| Simple | Partial | Yes ($59.99/yr) | Water + "other drinks" category, no per-type coefficients |
| WaterMinder | Yes | Free | Best-in-class beverage picker, 20+ drink types, custom drinks, Apple Watch |
| Fastic | No | N/A | Only basic water tracking |
| BodyFast | No | N/A | No water tracking at all |

### Target User
Intermittent fasters who drink coffee, tea, or other beverages throughout their fasting and eating windows. Users migrating from WaterMinder ($10/yr) who want combined fasting + hydration tracking. Zero subscribers ($69.99/yr) who currently use its multi-beverage logging. Health-conscious users who want accurate hydration metrics rather than a simple glass counter.

## Technical Context

### Where This Lives in MyLife

```
modules/fast/src/types.ts              -- BeverageType, BeverageLog types
modules/fast/src/db/schema.ts          -- ft_beverage_types, ft_beverage_log tables (V4 migration)
modules/fast/src/db/beverages.ts       -- Beverage CRUD operations
modules/fast/src/engines/hydration.ts  -- Hydration calculation engine
modules/fast/src/definition.ts         -- Add V4 migration
modules/fast/src/index.ts              -- Export new functions
apps/mobile/app/(fast)/timer.tsx       -- Update water card with beverage picker
apps/mobile/app/(fast)/settings.tsx    -- Beverage types management screen
apps/web/app/fast/page.tsx             -- Update water section with beverage picker
```

### Wireframe Position

```
Hub Dashboard
  └── MyFast card
       └── Timer tab
            └── Hydration Card (currently simple water counter)
                 └── [+] button expands to Beverage Picker ← YOU ARE HERE
```

### Data Model

```sql
-- V4 Migration: Multi-beverage types

CREATE TABLE IF NOT EXISTS ft_beverage_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  default_oz REAL NOT NULL DEFAULT 8.0,
  coefficient REAL NOT NULL DEFAULT 1.0,
  caffeine_mg REAL,
  is_builtin INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ft_beverage_log (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  beverage_type_id TEXT NOT NULL REFERENCES ft_beverage_types(id),
  volume_oz REAL NOT NULL,
  hydration_oz REAL NOT NULL,
  logged_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS ft_beverage_log_date_idx ON ft_beverage_log(date);
CREATE INDEX IF NOT EXISTS ft_beverage_log_type_idx ON ft_beverage_log(beverage_type_id);
```

**Built-in beverage types (seeded in migration):**

| id | Name | Icon | Default oz | Coefficient | Caffeine mg | Rationale |
|----|------|------|-----------|-------------|-------------|-----------|
| water | Water | (water drop) | 8 | 1.0 | null | Baseline hydration |
| herbal_tea | Herbal Tea | (teacup) | 8 | 1.0 | 0 | Caffeine-free, fully hydrating |
| green_tea | Green Tea | (tea leaf) | 8 | 0.95 | 28 | Mild caffeine |
| black_tea | Black Tea | (teacup) | 8 | 0.9 | 47 | Moderate caffeine |
| coffee | Coffee | (coffee) | 8 | 0.8 | 95 | Caffeine causes mild diuresis |
| espresso | Espresso | (espresso) | 2 | 0.8 | 63 | Concentrated, small serving |
| sparkling | Sparkling Water | (bubbles) | 12 | 1.0 | null | Same as still water |
| juice | Juice | (juice) | 8 | 0.9 | null | Sugar reduces net hydration slightly |
| milk | Milk | (glass) | 8 | 0.9 | null | Protein/fat slow absorption |
| alcohol | Alcohol | (beer) | 12 | -0.5 | null | Net dehydrating |

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter), existing ft_water_intake for migration path, ft_settings for preference storage
- **External:** None (all on-device)
- **Cross-Module:** Nutrition module could read beverage log data for fluid intake tracking via cross-module interface (future)

## Functional Requirements

### User Stories
1. As a coffee drinker who fasts, I want to log coffee separately from water so my hydration tracking accounts for caffeine's mild dehydrating effect.
2. As a tea lover, I want to quickly log different tea types (herbal, green, black) with one tap.
3. As someone who tracks alcohol intake, I want to see how a beer reduces my overall hydration.
4. As a user with specific drink preferences, I want to create custom beverage types with my own names and hydration coefficients.
5. As an existing user, I want my old water intake data to still work seamlessly after this upgrade.

### Behavior Specification

1. User taps the "+" button on the hydration card (Timer tab)
2. A beverage picker row expands showing up to 4 most-recently-used beverage icons, plus a "More..." button
3. User taps a beverage icon (e.g., coffee icon)
4. System creates a BeverageLog entry with: date=today, beverage_type_id='coffee', volume_oz=8.0, hydration_oz=6.4 (8.0 * 0.8)
5. Hydration progress bar updates to reflect new total hydration
6. Daily hydration total recalculates as SUM(hydration_oz) across all beverage logs for the day
7. Total displays as "X.X glasses" (total_hydration_oz / 8.0) for continuity with existing UI

**Long press flow:**
1. User long-presses a beverage icon
2. A volume input appears with the beverage's default_oz pre-filled
3. User adjusts volume (e.g., 16 oz large coffee)
4. System logs with adjusted volume: hydration_oz = 16.0 * 0.8 = 12.8

**Custom beverage flow:**
1. User navigates to Settings > Beverage Types
2. User taps "Add Custom Beverage"
3. User enters: name (required, max 50 chars), icon (emoji picker), default serving size (oz), hydration coefficient (0.0-2.0 slider)
4. System validates and saves to ft_beverage_types with is_builtin=0
5. Custom type appears in the beverage picker

**Settings management flow:**
1. User navigates to Settings > Beverage Types
2. List shows all beverage types (built-in first, then custom)
3. Built-in types: user can change default_oz but NOT delete
4. Custom types: user can edit all fields or delete
5. Reordering via drag handles changes sort_order

### Edge Cases

- **Legacy migration:** On first launch after V4 migration, existing ft_water_intake counts remain readable. The old count-based system and the new beverage log system coexist. If multi-beverage is enabled (setting), new logs go to ft_beverage_log. The hydration card shows combined totals from both tables until the user exclusively uses the new system.
- **Alcohol reduces total below zero:** Total hydration is clamped to 0. Displaying negative hydration is confusing and medically nonsensical for daily tracking.
- **Beverage type deleted after logs exist:** BeverageLog entries retain beverage_type_id. UI shows "[Deleted type]" with the original hydration_oz still counted in totals. Orphaned logs are never auto-deleted.
- **Coefficient edge values:** Coefficient range is -1.0 to 2.0. Values outside this range are rejected at validation. Coefficient of 0.0 means the drink neither hydrates nor dehydrates (e.g., a caloric drink logged for awareness only).
- **Volume of 0 or negative:** Rejected at validation with inline error "Enter a valid amount".
- **Empty beverage name:** Rejected at validation with inline error "Name is required".
- **Module disabled mid-use:** Beverage data is preserved. Re-enabling shows all historical data.
- **Extremely large volume input:** Capped at 128 oz (1 gallon). Amounts above this are rejected with "Volume cannot exceed 128 oz".
- **No beverages logged today:** Hydration card shows "0 glasses" with encouragement CTA: "Log your first drink".

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Tapping "+" on hydration card expands a row of beverage type icons with most-recently-used types shown first (up to 4)
- [ ] **AC-2:** Tapping a beverage icon logs one default serving and updates the hydration progress bar within 200ms
- [ ] **AC-3:** Long-pressing a beverage icon opens a custom volume input pre-filled with the beverage's default_oz
- [ ] **AC-4:** Tapping "More..." opens the full beverage list with all types and custom volume entry
- [ ] **AC-5:** Hydration total displays as "X.X glasses" (total_hydration_oz / 8.0) matching existing UI convention
- [ ] **AC-6:** Logging 3 waters (24oz * 1.0) + 1 coffee (8oz * 0.8) shows total of 3.8 glasses (30.4 oz / 8)
- [ ] **AC-7:** Logging a 12oz beer (coefficient -0.5) reduces hydration total by 6oz equivalent
- [ ] **AC-8:** Total hydration never displays below 0 even when alcohol makes the math negative
- [ ] **AC-9:** Settings > Beverage Types shows all types with name, icon, default size, and coefficient
- [ ] **AC-10:** Users can create custom beverage types with name, icon, default_oz, and coefficient
- [ ] **AC-11:** Built-in beverage types cannot be deleted (delete button hidden/disabled)
- [ ] **AC-12:** Custom beverage types can be edited (all fields) and deleted
- [ ] **AC-13:** Deleting a custom type does not delete associated log entries; orphaned logs show "[Deleted type]"

### Technical Criteria
- [ ] **TC-1:** V4 migration creates ft_beverage_types and ft_beverage_log tables with correct schema
- [ ] **TC-2:** V4 migration seeds 10 built-in beverage types with correct coefficients and caffeine values
- [ ] **TC-3:** BeverageLog entries correctly compute hydration_oz = volume_oz * coefficient on insert
- [ ] **TC-4:** Daily hydration query returns SUM(hydration_oz) grouped by date with total clamped to >= 0
- [ ] **TC-5:** Most-recently-used query returns up to 4 beverage types ordered by most recent log timestamp
- [ ] **TC-6:** All CRUD operations use the ft_ table prefix consistently
- [ ] **TC-7:** Hydration calculation completes in <50ms for 100+ log entries per day
- [ ] **TC-8:** Beverage type validation rejects: empty name, volume <= 0, volume > 128, coefficient outside [-1.0, 2.0]

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** This feature must NOT break existing ft_water_intake data or queries
- [ ] **NC-2:** Built-in beverage types must NOT be deletable by the user
- [ ] **NC-3:** Hydration total must NOT display as negative
- [ ] **NC-4:** Beverage log data must NOT be deleted when a custom beverage type is deleted
- [ ] **NC-5:** This feature must NOT make network calls or send data off-device

## UI Specification

### Mobile (Expo)

**Hydration Card (Timer tab):**
- Background: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border
- Module accent: `#14B8A6` (teal) for progress bar fill
- Beverage picker row: horizontal ScrollView with 36x36 icon buttons, teal highlight on selected
- Volume input modal: glass surface with number input, "oz" / "ml" unit toggle
- Progress bar: animated fill from left to right, teal gradient

**Beverage Types Management (Settings):**
- Full-screen list with swipe-to-delete on custom items
- Each row: icon (24x24), name, default_oz, coefficient displayed as percentage ("80% hydrating")
- "Add Custom" button at bottom with accent color
- Built-in items have a lock icon indicator

### Web (Next.js)

- Same tokens via CSS variables in `globals.css`
- Sidebar navigation: accessible via `/fast` route, hydration card in main timer view
- Beverage picker: horizontal flex row instead of ScrollView
- Settings page: table-style list instead of swipeable cards
- Volume input: inline number input instead of modal

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton shimmer on hydration card | Initial mount, DB query in flight |
| Empty | "0 glasses - Log your first drink" with CTA arrow pointing to "+" | No beverage logs today |
| Error | "Could not load beverages" + retry button | DB read failure |
| Success | Hydration total, progress bar, beverage icons | At least one log exists |
| Partial | Hydration total shows, but beverage icons still loading | Slow query on type list |

## Test Requirements

### Unit Tests
- [ ] `calculateDailyHydration`: water (8oz, coeff 1.0) returns 8.0 hydration_oz
- [ ] `calculateDailyHydration`: coffee (8oz, coeff 0.8) returns 6.4 hydration_oz
- [ ] `calculateDailyHydration`: alcohol (12oz, coeff -0.5) returns -6.0 hydration_oz
- [ ] `calculateDailyHydration`: 3 waters + 1 coffee = 30.4 oz total
- [ ] `calculateDailyHydration`: all alcohol, total clamped to 0
- [ ] `createBeverageType`: rejects empty name
- [ ] `createBeverageType`: rejects volume <= 0
- [ ] `createBeverageType`: rejects volume > 128
- [ ] `createBeverageType`: rejects coefficient outside [-1.0, 2.0]
- [ ] `logBeverage`: creates entry with correct hydration_oz computation
- [ ] `getMostRecentBeverageTypes`: returns up to 4 types ordered by recency
- [ ] `deleteBeverageType`: rejects built-in types
- [ ] `deleteBeverageType`: does not cascade-delete beverage logs

### Integration Tests
- [ ] Full flow: log water + coffee + beer -> daily total correct -> progress bar updates
- [ ] Migration flow: V4 migration runs on fresh DB, all built-in types seeded
- [ ] Custom type flow: create -> log -> edit -> log again -> totals correct
- [ ] Delete custom type flow: delete type -> orphaned logs still counted -> UI shows "[Deleted type]"

### QA Verification Script

1. Open the app on mobile
2. Navigate to MyFast > Timer tab
3. Verify hydration card shows "0 glasses" with empty state CTA -- AC-1
4. Tap "+" button on hydration card
5. Verify beverage picker row expands with icons (water, coffee, tea, etc.) -- AC-1
6. Tap the water icon
7. Verify: hydration card updates to "1.0 glasses" and progress bar fills -- AC-2, AC-5
8. Tap "+" again, then tap the coffee icon
9. Verify: hydration card updates to "1.8 glasses" (8oz + 6.4oz = 14.4oz / 8 = 1.8) -- AC-6
10. Long-press the coffee icon
11. Verify: volume input appears with "8" pre-filled -- AC-3
12. Change volume to 16 oz and confirm
13. Verify: total increases by 1.6 glasses (16oz * 0.8 / 8 = 1.6) -- AC-3
14. Tap "More..." button
15. Verify: full beverage list opens -- AC-4
16. Select "Alcohol" and confirm
17. Verify: total decreases by 0.75 glasses (12oz * -0.5 / 8) -- AC-7
18. Log enough alcohol to make math negative
19. Verify: total shows 0 glasses, never negative -- AC-8
20. Navigate to Settings > Beverage Types
21. Verify: all 10 built-in types listed with correct info -- AC-9
22. Try to delete a built-in type
23. Verify: delete action is blocked/hidden -- AC-11, NC-2
24. Tap "Add Custom Beverage"
25. Enter name "Kombucha", icon, 12 oz, coefficient 0.9
26. Verify: custom type appears in the list -- AC-10
27. Navigate back to Timer, tap "+", verify Kombucha appears -- AC-10
28. Navigate back to Settings, delete "Kombucha"
29. Verify: Kombucha removed from list -- AC-12
30. Navigate to Timer, verify any Kombucha logs still show in history as "[Deleted type]" -- AC-13, NC-4
31. Repeat steps 3-10 on web at `/fast`

## gstack Quality Gates

Based on this feature's complexity score (4/5 = Inverse 1), these gstack skills are REQUIRED:

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI (check all that apply):
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for hydration calculation engine

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- if module has standalone counterpart
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- ft_water_intake exists with simple integer count per day (date, count, target)
- No concept of beverage types, hydration coefficients, or per-drink logging
- Water card shows a simple "X / Y glasses" counter with increment/decrement

### After This Work
- ft_beverage_types table with 10 built-in types + custom type support
- ft_beverage_log table with per-drink entries including hydration calculations
- Hydration card upgraded with beverage picker, accurate hydration totals
- Settings page with beverage type management
- Foundation laid for caffeine tracking (FT-016) via caffeine_mg column

### Files Changed
- `modules/fast/src/types.ts` -- Added BeverageType, BeverageLog interfaces
- `modules/fast/src/db/schema.ts` -- Added V4 migration tables, indexes, seed data
- `modules/fast/src/db/beverages.ts` -- New file: CRUD for beverage types and logs
- `modules/fast/src/engines/hydration.ts` -- New file: hydration calculation engine
- `modules/fast/src/definition.ts` -- Added FAST_MIGRATION_V4
- `modules/fast/src/index.ts` -- Exported new functions and types
- `apps/mobile/app/(fast)/timer.tsx` -- Updated hydration card with beverage picker
- `apps/mobile/app/(fast)/settings.tsx` -- Added beverage types management
- `apps/web/app/fast/page.tsx` -- Updated hydration section with beverage picker

### Known Limitations
- No unit conversion UI (oz/ml toggle) in this iteration; volume always stored as oz internally
- No syncing beverage logs to Apple Watch (future: requires watch sync update)
- No integration with nutrition module for calorie tracking from beverages
- Most-recently-used ordering is per-device, not synced across platforms

### Context for Next Agent
- The caffeine_mg column on ft_beverage_types is pre-populated for caffeinated drinks. FT-016 (Caffeine Tracking) should read this column directly rather than maintaining a separate caffeine table.
- The hydration engine in `engines/hydration.ts` is a pure function that takes beverage logs and returns totals. The caffeine engine should follow the same pure-function pattern.
- The ft_water_intake table is NOT deprecated by this feature. Both systems coexist. A future migration could consolidate, but backward compatibility with existing data is critical.
- Built-in beverage type IDs are string constants (e.g., 'water', 'coffee'). The caffeine tracking feature can reference these IDs directly.
