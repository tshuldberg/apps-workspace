# Feature Spec: FODMAP Tracking

## Metadata
- **Module:** meds
- **Priority Score:** 24 / 50 (B-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 2 x3 + Complexity 3 x2 + CrossModule 4 x1 + PaidUser 2 x1
- **Sprint:** Sprint 3
- **Estimated CC Time:** 5-6 hours
- **Depends On:** Symptom logging (built -- `md_symptoms`, `md_symptom_logs`), measurements (built)
- **Blocks:** none

## Business Context

### Why This Feature Exists
FODMAP tracking is essential for IBS sufferers (10-15% of the global population, ~45M in the US). Cara Care (acquired by Bayer, $79.99/yr) is the dominant FODMAP tracking app, offering food diary with FODMAP classification, Bristol Stool Scale, and symptom-food correlation. The problem: Cara Care was acquired by Bayer, a company that sells digestive health products -- user data now feeds a pharma company's product pipeline. MyLife can offer equivalent FODMAP tracking that stays on-device. High CrossModule score (4) because FODMAP data naturally bridges with the Nutrition module's meal tracking.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Cara Care | Yes | Yes ($79.99/yr) | Full FODMAP diary, Bristol Stool Scale, food-symptom correlation, dietitian chat. Owned by Bayer. |
| FODMAP Friendly | Yes | Yes ($12.99/yr) | FODMAP database, food scanner, meal logging. No symptom correlation. |
| Monash FODMAP | Yes | Yes ($9.99 one-time) | Gold standard FODMAP database from Monash University. Reference-only, no tracking. |
| CareClinic | Partial | Yes ($119.88/yr) | Generic food diary. No FODMAP classification. |
| Medisafe | No | N/A | No digestive health features. |

### Target User
IBS and FODMAP-sensitive patients (45M in US, 10-15% globally) following a low-FODMAP elimination diet under dietitian guidance. Specifically: Cara Care users paying $79.99/yr who want the same FODMAP tracking and symptom correlation without their digestive health data being owned by Bayer. Migration path: equivalent food-symptom diary, local-only data.

## Technical Context

### Where This Lives in MyLife

```
modules/meds/src/
  fodmap/
    engine.ts                      -- NEW: FODMAP classification, food-symptom correlation
    database.ts                    -- NEW: Built-in FODMAP food database (top 200 foods)
    __tests__/engine.test.ts       -- NEW: Engine tests
  db/
    fodmap.ts                      -- NEW: CRUD for food diary, stool logs
    schema.ts                      -- MODIFY: Add md_food_diary, md_stool_logs, md_fodmap_foods tables (V4)
  models/
    fodmap.ts                      -- NEW: Zod schemas for FODMAP tracking
    index.ts                       -- MODIFY: Export FODMAP models
  definition.ts                    -- MODIFY: Add to V4 migration, add fodmap screens
  index.ts                         -- MODIFY: Export FODMAP engine + types
apps/mobile/app/(meds)/
  fodmap.tsx                       -- NEW: FODMAP dashboard screen
  log-meal.tsx                     -- NEW: Meal logging with FODMAP classification
  stool-log.tsx                    -- NEW: Bristol Stool Scale logging
apps/web/app/meds/
  fodmap/page.tsx                  -- NEW: Web FODMAP dashboard
```

### Wireframe Position

```
Hub Dashboard
  └── MyMeds card
       ├── Today tab
       │    └── [FODMAP summary: meals logged, symptom status]
       ├── History tab
       │    └── Digestive Health section
       │         └── [FODMAP Dashboard] ← YOU ARE HERE
       │              ├── [Food diary with FODMAP ratings]
       │              ├── [Bristol Stool Scale log]
       │              ├── [Symptom-food correlation timeline]
       │              └── [Trigger identification report]
       └── Medications tab
```

### Data Model

```sql
-- Built-in FODMAP food reference database
CREATE TABLE IF NOT EXISTS md_fodmap_foods (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('fruit', 'vegetable', 'grain', 'dairy', 'protein', 'legume', 'nut_seed', 'sweetener', 'condiment', 'beverage', 'other')),
  fodmap_rating TEXT NOT NULL CHECK (fodmap_rating IN ('low', 'moderate', 'high')),
  fructose INTEGER NOT NULL DEFAULT 0 CHECK (fructose IN (0, 1)),
  lactose INTEGER NOT NULL DEFAULT 0 CHECK (lactose IN (0, 1)),
  fructan INTEGER NOT NULL DEFAULT 0 CHECK (fructan IN (0, 1)),
  galactan INTEGER NOT NULL DEFAULT 0 CHECK (galactan IN (0, 1)),
  polyol INTEGER NOT NULL DEFAULT 0 CHECK (polyol IN (0, 1)),
  serving_size TEXT,
  notes TEXT
);

-- Food diary entries
CREATE TABLE IF NOT EXISTS md_food_diary (
  id TEXT PRIMARY KEY,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  food_items TEXT NOT NULL,
  fodmap_rating TEXT NOT NULL CHECK (fodmap_rating IN ('low', 'moderate', 'high', 'unknown')),
  fodmap_types TEXT,
  portion_size TEXT,
  notes TEXT,
  eaten_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Stool log (Bristol Stool Scale)
CREATE TABLE IF NOT EXISTS md_stool_logs (
  id TEXT PRIMARY KEY,
  bristol_type INTEGER NOT NULL CHECK (bristol_type >= 1 AND bristol_type <= 7),
  urgency INTEGER NOT NULL DEFAULT 1 CHECK (urgency >= 1 AND urgency <= 5),
  pain_level INTEGER NOT NULL DEFAULT 0 CHECK (pain_level >= 0 AND pain_level <= 5),
  blood INTEGER NOT NULL DEFAULT 0 CHECK (blood IN (0, 1)),
  notes TEXT,
  logged_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Dependencies
- **Internal:** `@mylife/meds` symptom logging (`logSymptom`, `getSymptomLogs`), correlation engine
- **External:** None. Built-in FODMAP database, no API calls.
- **Cross-Module:** Nutrition module (`@mylife/nutrition`) can provide meal data. High CrossModule score (4) because FODMAP diary entries could auto-populate from Nutrition meal logs if the user has both modules enabled. Initially standalone; cross-module bridge is a future enhancement.

## Functional Requirements

### User Stories
1. As an IBS sufferer, I want to log meals with FODMAP classification so I can track which foods trigger symptoms.
2. As a patient on a FODMAP elimination diet, I want a built-in FODMAP food database so I can quickly check if a food is low/moderate/high FODMAP.
3. As an IBS sufferer, I want to log bowel movements using the Bristol Stool Scale so my gastroenterologist has standardized data.
4. As a patient, I want to see a timeline correlating meals with symptoms and stool patterns so I can identify trigger foods.
5. As a patient, I want a trigger report summarizing which high-FODMAP foods correlate with symptom flares so I can discuss elimination strategies with my dietitian.

### Behavior Specification

1. User navigates to MyMeds -> History -> Digestive Health -> FODMAP Dashboard
2. **Log Meal flow:**
   a. User taps "Log Meal"
   b. User selects meal type (breakfast/lunch/dinner/snack)
   c. User types food items (autocomplete from `md_fodmap_foods` database)
   d. System auto-classifies overall FODMAP rating (highest rating of any item wins)
   e. System highlights which FODMAP types are present (fructose, lactose, fructan, galactan, polyol)
   f. User can override rating if they know their tolerance
   g. System saves to `md_food_diary`
3. **Log Stool flow:**
   a. User taps "Log Bowel Movement"
   b. User selects Bristol type (1-7) with visual reference images
   c. User rates urgency (1-5) and pain level (0-5)
   d. User optionally flags blood present
   e. System saves to `md_stool_logs`
4. **Timeline view:**
   a. Scrollable timeline showing meals, symptoms, and stool logs chronologically
   b. Meals color-coded by FODMAP rating (green=low, yellow=moderate, red=high)
   c. Symptom severity shown as small bar charts
   d. Stool type shown as Bristol scale icons
5. **Trigger report:**
   a. System analyzes correlation between high-FODMAP meals and symptom flares within 2-24 hour windows
   b. Ranks foods by symptom correlation strength
   c. Groups by FODMAP type (e.g., "Lactose-containing foods correlated with 73% of your flares")

### Edge Cases

- Food not in FODMAP database: allow manual entry with "unknown" FODMAP rating + option to classify manually
- User logs symptom but no meals in prior 24 hours: exclude from correlation analysis
- Multiple meals before a symptom flare: each meal gets partial correlation credit (weighted by time proximity)
- Bristol type 3-4 (normal) logged: no symptom trigger, positive data point for correlation
- Very few data points (<10 meals and <5 symptoms): show "Need more data" instead of correlation report
- User has Nutrition module enabled: show "Import from MyNutrition" option (future, not for initial build)
- Module disabled: data preserved, trigger analysis unavailable

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** User can log a meal with food items and auto-FODMAP classification
- [ ] **AC-2:** Food autocomplete suggests from built-in FODMAP database (200+ foods)
- [ ] **AC-3:** Overall FODMAP rating auto-calculated (highest item wins)
- [ ] **AC-4:** FODMAP type breakdown shown (fructose, lactose, fructan, galactan, polyol)
- [ ] **AC-5:** User can log stool with Bristol type selector (visual icons for types 1-7)
- [ ] **AC-6:** Urgency, pain level, and blood flag captured in stool log
- [ ] **AC-7:** Timeline view shows meals, symptoms, and stools chronologically with color coding
- [ ] **AC-8:** Trigger report ranks foods by symptom correlation strength
- [ ] **AC-9:** Trigger report groups by FODMAP type with percentage correlations
- [ ] **AC-10:** Dashboard shows summary: meals logged today, latest stool, active symptoms

### Technical Criteria
- [ ] **TC-1:** `md_fodmap_foods` seeded with 200+ common foods in V4 migration
- [ ] **TC-2:** `md_food_diary` stores meal entries with FODMAP classification
- [ ] **TC-3:** `md_stool_logs` stores Bristol scale entries with urgency/pain/blood
- [ ] **TC-4:** FODMAP auto-classification picks the highest-rated item in a meal
- [ ] **TC-5:** Trigger correlation engine uses 2-24 hour window between meal and symptom
- [ ] **TC-6:** Correlation strength: Pearson or frequency-based metric between food and symptom occurrence
- [ ] **TC-7:** Food autocomplete responds in <100ms for 200+ food database

### Negative Criteria
- [ ] **NC-1:** FODMAP ratings must NOT be presented as medical advice -- include disclaimer
- [ ] **NC-2:** Trigger report must NOT claim causation, only correlation
- [ ] **NC-3:** Must NOT require network access
- [ ] **NC-4:** Must NOT modify existing symptom logging system -- extend, do not replace
- [ ] **NC-5:** Must NOT auto-import from Nutrition module without explicit user action (privacy boundary)

## UI Specification

### Mobile (Expo)
- Background: `#0A0A0F` (background token)
- Dashboard: glass cards for today's summary, recent meals, latest stool
- FODMAP rating colors: green (#30D158) = low, yellow (#FFD60A) = moderate, red (#FF453A) = high
- Bristol Scale: 7 visual icons (simple line illustrations, not photorealistic)
- Timeline: vertical scrollable list with colored dots on left rail
- Module accent: `#06B6D4` (meds cyan)
- Food autocomplete: glass dropdown with FODMAP rating badges per result

### Web (Next.js)
- Route: `/meds/fodmap`
- Same tokens via CSS variables
- Three-column layout: diary (left), timeline (center), trigger report (right)
- Food autocomplete as inline search with results dropdown

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton cards + timeline placeholder | Initial data fetch |
| Empty | "Start your FODMAP diary" + quick-log CTA cards for meal and stool | No diary entries |
| Error | "Could not load diary" + retry button | Database read fails |
| Success | Full dashboard with meals, stools, timeline, trigger report | Sufficient data |
| Partial | Meals logged but no symptoms/stools yet | Incomplete diary |
| Insufficient | "Need more data for trigger analysis" (meals + symptoms exist but <10 each) | Too few entries |

## Test Requirements

### Unit Tests
- [ ] `classifyMealFODMAP`: returns 'high' when any food item is high FODMAP
- [ ] `classifyMealFODMAP`: returns 'low' when all items are low FODMAP
- [ ] `classifyMealFODMAP`: returns 'unknown' when food not in database
- [ ] `getFODMAPTypes`: returns correct boolean flags for a meal's FODMAP types
- [ ] `searchFODMAPFoods`: returns matching foods from built-in database
- [ ] `searchFODMAPFoods`: handles partial matches and case insensitivity
- [ ] `calculateTriggerCorrelation`: identifies high-FODMAP food eaten 2-6 hours before symptom flare
- [ ] `calculateTriggerCorrelation`: returns empty results with <10 data points
- [ ] `groupByFODMAPType`: aggregates trigger foods by FODMAP type with percentages
- [ ] Bristol type validation: accepts 1-7, rejects 0 and 8

### Integration Tests
- [ ] Full flow: log meal -> log symptom 4 hours later -> trigger report shows correlation
- [ ] Stool logging: log Bristol type 6 with urgency 4 -> appears on timeline
- [ ] Food search: type "app" -> autocomplete shows "apple" (high FODMAP) and "applesauce" (low FODMAP)

### QA Verification Script

1. Open the app on iOS simulator
2. Navigate to MyMeds -> History -> Digestive Health -> FODMAP Dashboard
3. Verify: empty state with "Start your FODMAP diary" -- state coverage
4. Tap "Log Meal"
5. Select "Lunch", type "garlic" in food field
6. Verify: autocomplete suggests "garlic" with "High FODMAP" badge -- AC-2
7. Add "rice" (Low FODMAP) to the same meal
8. Verify: overall FODMAP rating shows "High" (garlic wins) -- AC-3
9. Verify: FODMAP types show fructan flagged (from garlic) -- AC-4
10. Save the meal
11. Tap "Log Bowel Movement"
12. Select Bristol type 6 (mushy)
13. Set urgency to 4, pain to 3
14. Save
15. Verify: stool log appears with Bristol icon -- AC-5, AC-6
16. Log 10+ meals and 5+ symptom entries over several days
17. Navigate to trigger report
18. Verify: foods ranked by correlation strength -- AC-8
19. Verify: FODMAP type grouping shown with percentages -- AC-9
20. Verify: timeline shows meals, symptoms, stools chronologically -- AC-7
21. Verify: disclaimer text about correlation vs causation -- NC-2
22. Repeat key checks on web at `/meds/fodmap`

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to `/meds/fodmap`, click every button, verify all 5 states
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for FODMAP classification and trigger correlation

### Post-merge:
- [ ] `/parity-check` -- if module has standalone counterpart

## Handoff State

### Before This Work
The meds module has generic symptom logging (`md_symptoms`, `md_symptom_logs`) but no food diary, no FODMAP database, no Bristol Stool Scale logging, and no food-symptom correlation analysis.

### After This Work
A complete FODMAP tracking system with built-in 200+ food database, meal diary with auto-FODMAP classification, Bristol Stool Scale logging, chronological timeline, and trigger identification report. All on-device.

### Files Changed
- `modules/meds/src/fodmap/engine.ts` -- FODMAP classification, trigger correlation, type grouping
- `modules/meds/src/fodmap/database.ts` -- Built-in FODMAP food database (200+ entries)
- `modules/meds/src/fodmap/__tests__/engine.test.ts` -- Engine tests
- `modules/meds/src/db/fodmap.ts` -- CRUD for food diary, stool logs, FODMAP foods
- `modules/meds/src/db/schema.ts` -- V4 table definitions (3 new tables)
- `modules/meds/src/models/fodmap.ts` -- Zod schemas
- `modules/meds/src/models/index.ts` -- Re-export FODMAP models
- `modules/meds/src/definition.ts` -- V4 migration, add fodmap screens
- `modules/meds/src/index.ts` -- Export FODMAP engine + types
- `apps/mobile/app/(meds)/fodmap.tsx` -- FODMAP dashboard
- `apps/mobile/app/(meds)/log-meal.tsx` -- Meal logging screen
- `apps/mobile/app/(meds)/stool-log.tsx` -- Bristol Stool Scale screen
- `apps/web/app/meds/fodmap/page.tsx` -- Web FODMAP dashboard

### Known Limitations
- Built-in FODMAP database covers 200+ common foods but is not exhaustive. Users can manually enter unknown foods.
- Trigger correlation uses a simple frequency-based approach, not a clinical FODMAP elimination protocol. For clinical-grade analysis, users should work with a dietitian.
- No photo meal logging (camera -> food recognition). That would require ML/cloud, which conflicts with privacy-first design.
- Cross-module bridge with Nutrition is planned but not part of this initial build.

### Context for Next Agent
- The FODMAP food database should be seeded in the V4 migration as INSERT statements (similar to how drug interactions are seeded in V2). Source data from Monash University's public FODMAP lists.
- The existing symptom logging system (`md_symptoms`, `md_symptom_logs`) should be reused for digestive symptoms. Add IBS-specific predefined symptoms (bloating, cramping, gas, constipation, diarrhea) to the `PREDEFINED_SYMPTOMS` list.
- Bristol Stool Scale types 1-2 = constipation, 3-4 = normal, 5-7 = diarrhea. The engine should use this classification for correlation analysis.
