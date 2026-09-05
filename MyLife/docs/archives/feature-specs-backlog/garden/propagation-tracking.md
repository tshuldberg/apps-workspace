# Feature Spec: Propagation Tracking

## Metadata
- **Module:** garden
- **Priority Score:** 23 / 50 (B-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 2 x3 + Complexity 4 x2 + CrossModule 1 x1 + PaidUser 2 x1
- **Sprint:** Sprint 2+
- **Estimated CC Time:** 2-3 hours
- **Depends On:** none (gd_plants and gd_entries tables exist)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Propagation (growing new plants from cuttings, divisions, seeds, or layering) is a core activity for plant enthusiasts. Users track propagation attempts in spreadsheets, journals, or separate apps because no mainstream garden app handles it well. Planta is the only competitor with propagation tracking, and it's behind a paywall. Tracking propagation attempts with stages, success rates, and parent-child plant relationships adds genuine value for the growing community of "plant propagators" on social media (Instagram #propagation has 3M+ posts). This feature also creates natural parent-child relationships in the plant catalog, enriching the user's plant family tree.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Planta | Yes | Pro ($36/yr) | Basic propagation tracking: start date, method, status, photo journal |
| PlantIn | No | N/A | No propagation tracking |
| Planter | No | N/A | No propagation tracking |
| Seed to Spoon | Partial | Premium | Seed starting tracker, but not cuttings/divisions |

### Target User
Plant enthusiasts who propagate plants at home (cuttings in water, soil propagation, leaf propagation for succulents, dividing root-bound plants). Active on plant communities where sharing propagation progress is popular. Currently tracking attempts in notes or spreadsheets.

## Technical Context

### Where This Lives in MyLife

```
modules/garden/src/types.ts                        -- Propagation types, method enum, stage enum
modules/garden/src/db/schema.ts                    -- gd_propagations table (V2 migration)
modules/garden/src/db/crud.ts                      -- Propagation CRUD, stats
modules/garden/src/engine/propagation.ts            -- Stage transitions, success rate calc
modules/garden/src/definition.ts                   -- V2 migration
apps/mobile/app/(garden)/propagations.tsx          -- Propagation list screen
apps/mobile/app/(garden)/propagation-detail.tsx     -- Propagation detail/progress
apps/mobile/app/(garden)/components/PropagationCard.tsx  -- Propagation card
apps/web/app/garden/propagations/page.tsx          -- Web propagation list
```

### Wireframe Position

```
Hub Dashboard
  └── MyGarden card
       └── Garden tab
            └── Plant Detail
                 └── "Propagate" button ← START HERE
       └── Journal tab
            └── [Filter: All | Propagations]
                 └── Propagation list ← YOU ARE HERE
```

### Data Model

```sql
-- V2 migration: propagation tracking
CREATE TABLE IF NOT EXISTS gd_propagations (
  id TEXT PRIMARY KEY,
  parent_plant_id TEXT REFERENCES gd_plants(id) ON DELETE SET NULL,
  method TEXT NOT NULL,
  medium TEXT,
  start_date TEXT NOT NULL,
  current_stage TEXT NOT NULL DEFAULT 'started',
  stage_updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  notes TEXT,
  image_uri TEXT,
  child_plant_id TEXT REFERENCES gd_plants(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS gd_propagations_parent_idx ON gd_propagations(parent_plant_id);
CREATE INDEX IF NOT EXISTS gd_propagations_stage_idx ON gd_propagations(current_stage);
CREATE INDEX IF NOT EXISTS gd_propagations_date_idx ON gd_propagations(start_date DESC);
```

**Column notes:**
- `method`: 'stem_cutting' | 'leaf_cutting' | 'division' | 'seed' | 'air_layering' | 'water_propagation' | 'grafting' | 'offsets'
- `medium`: 'water' | 'soil' | 'perlite' | 'sphagnum_moss' | 'leca' | 'vermiculite' | 'none'
- `current_stage`: 'started' | 'callusing' | 'rooting' | 'growing' | 'ready' | 'potted' | 'failed'
- `child_plant_id`: FK to the new plant created when propagation succeeds and is potted

### Dependencies
- **Internal:** `@mylife/garden` (types, crud, createPlant), `@mylife/ui`
- **External:** None
- **Cross-Module:** None

## Functional Requirements

### User Stories
1. As a plant propagator, I want to track propagation attempts from start to finish so that I know what's in progress and what methods work.
2. As a plant propagator, I want to advance through stages (started > callusing > rooting > growing > ready > potted) so that I can track progress over time.
3. As a plant propagator, I want to convert a successful propagation into a new plant record (child) linked to the parent so that my plant family tree grows naturally.
4. As a plant propagator, I want to see propagation success rates by method and by parent plant so that I can improve my technique.
5. As a plant propagator, I want to add photos at each stage so that I have a visual progress journal.

### Behavior Specification

**Start propagation:**
1. From Plant Detail, user taps "Propagate" button
2. Propagation form opens: parent plant (pre-filled), method (required picker), medium (picker), start date (default today), notes, initial photo
3. Save creates gd_propagations record with stage='started'

**Advance stages:**
1. User opens propagation detail (from propagation list or plant detail)
2. Current stage shown with a horizontal stage progress indicator
3. "Advance Stage" button moves to the next stage in sequence
4. Each stage advance: logs date, allows notes + photo for the new stage, updates stage_updated_at
5. Stage sequence: started -> callusing -> rooting -> growing -> ready -> potted
6. Not all stages are required. User can skip (e.g., go from started to rooting for water propagation)
7. "Mark Failed" available from any stage

**Convert to plant:**
1. When stage reaches 'ready', a "Pot and Add to Garden" CTA appears
2. Tapping opens Add Plant form pre-filled: name = "[Parent Name] (propagated)", species = parent species, acquiredDate = today, notes = "Propagated from [Parent Name] via [method]"
3. On plant creation: propagation record updated with child_plant_id and stage='potted'
4. Plant Detail for parent now shows "Children" section; child shows "Parent" link

**Propagation list screen:**
1. Shows all active propagations (not failed, not potted) sorted by start date
2. Each card: parent plant thumbnail + name, method badge, medium badge, current stage indicator, days since started
3. Filter: by method, by stage, by parent plant
4. "History" section: completed (potted) and failed propagations

**Analytics:**
1. Success rate: (potted count) / (total count) x 100
2. Success rate by method: breakdown per propagation method
3. Average days to root: time from started to rooting stage
4. Most propagated plant: parent with most propagation attempts

### Edge Cases

- **Parent plant deleted:** parent_plant_id SET NULL. Propagation record remains with a "Parent removed" label.
- **Child plant deleted:** child_plant_id SET NULL. Propagation shows "potted" stage but link is broken.
- **Mark failed then restart:** Create a new propagation record for the same parent. Don't modify the failed one.
- **Skip stages:** Allow jumping forward (e.g., started -> rooting) but not backward. Backward movement requires creating a new propagation.
- **Multiple active propagations from same parent:** Allowed and common (taking multiple cuttings at once).
- **Propagation with no parent (e.g., found cutting):** parent_plant_id is nullable. User can start a propagation without linking a parent.
- **Very long propagation (months):** Show "days since started" and "days in current stage" for context.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** "Propagate" button on Plant Detail starts a new propagation with parent pre-filled
- [ ] **AC-2:** Propagation form accepts method, medium, date, notes, and photo
- [ ] **AC-3:** Stage progress indicator shows current stage in the sequence
- [ ] **AC-4:** "Advance Stage" moves to the next stage with date logging
- [ ] **AC-5:** Stages can be skipped forward but not moved backward
- [ ] **AC-6:** "Mark Failed" available from any active stage
- [ ] **AC-7:** "Pot and Add to Garden" at 'ready' stage creates plant record linked to propagation
- [ ] **AC-8:** Parent plant detail shows "Children" section with links to propagated plants
- [ ] **AC-9:** Propagation list shows active propagations with method, stage, and age
- [ ] **AC-10:** Analytics show success rate overall and by method
- [ ] **AC-11:** Photo can be added at each stage for visual journal

### Technical Criteria
- [ ] **TC-1:** Propagations persisted to gd_propagations with all fields
- [ ] **TC-2:** Stage transitions update current_stage and stage_updated_at
- [ ] **TC-3:** Child plant creation populates child_plant_id on propagation record
- [ ] **TC-4:** ON DELETE SET NULL for both parent_plant_id and child_plant_id
- [ ] **TC-5:** Success rate calculation handles zero total (returns 0%, not NaN)
- [ ] **TC-6:** Active propagation query excludes 'failed' and 'potted' stages

### Negative Criteria
- [ ] **NC-1:** Deleting parent plant must NOT delete propagation records
- [ ] **NC-2:** Marking propagation failed must NOT change parent plant status
- [ ] **NC-3:** Stage advancement must NOT be reversible (no going backward)
- [ ] **NC-4:** Photos must NOT be uploaded to any server

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Cards: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border
- Module accent: `#22C55E`
- Stage progress: horizontal pill chain, each stage is a small circle connected by lines. Completed = accent green filled, Current = accent green pulsing, Future = dimmed border only, Failed = red (#FF453A) X
- Method badges: pill-shaped, accent border, method icon (scissors for cutting, hand for division, seed icon for seed, water drop for water prop)
- Days since started: secondary text below card, "21d" format
- "Pot and Add" CTA: accent-colored button that appears only at 'ready' stage

### Web (Next.js)

- Same tokens via CSS variables
- Route: `/garden/propagations`
- Table layout: columns for Parent, Method, Medium, Stage, Started, Days Active, Actions
- Detail view in slide-over panel
- Analytics as simple stat cards above the table

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton propagation cards | Initial data fetch |
| Empty | "Start your first propagation from any plant" + illustration | No propagations |
| Error | "Could not load propagations. Pull to retry." | DB query fails |
| Success | Active propagation list with stage indicators | 1+ propagations exist |
| All Complete | "History" section with potted/failed entries, no active | All propagations done |

## Test Requirements

### Unit Tests
- [ ] `createPropagation()`: persists record with all fields
- [ ] `advanceStage()`: moves to next valid stage
- [ ] `advanceStage()`: allows skipping forward
- [ ] `advanceStage()`: rejects backward movement
- [ ] `markFailed()`: sets stage to 'failed'
- [ ] `convertToPlant()`: creates plant and updates child_plant_id
- [ ] `getActivePropagations()`: excludes failed and potted
- [ ] `getSuccessRate()`: returns correct percentage
- [ ] `getSuccessRateByMethod()`: returns per-method breakdown
- [ ] `getAverageDaysToRoot()`: calculates correctly, handles zero data

### Integration Tests
- [ ] Full flow: start propagation -> advance through stages -> convert to plant -> verify parent-child link
- [ ] Failure flow: start propagation -> mark failed -> verify in history
- [ ] Delete parent: verify propagation remains with null parent

### QA Verification Script

1. Open the app on iOS/Android
2. Navigate to MyGarden > any plant's detail page
3. Tap "Propagate"
4. Fill in: method "Stem Cutting", medium "Water", add photo
5. Save
6. Verify: propagation created with "Started" stage -- AC-1, AC-2
7. Navigate to propagation list (Journal tab > Propagations filter)
8. Verify: propagation shows with method badge, stage indicator, days -- AC-9
9. Open propagation detail
10. Verify: stage progress indicator shows "Started" as current -- AC-3
11. Tap "Advance Stage"
12. Verify: advances to "Callusing" (or next stage), date logged -- AC-4
13. Advance through: Rooting -> Growing -> Ready
14. At "Ready" stage, verify: "Pot and Add to Garden" CTA appears -- AC-7
15. Tap "Pot and Add to Garden"
16. Verify: Add Plant form pre-filled with parent data
17. Save plant
18. Verify: propagation shows "Potted" stage, child link visible
19. Go to parent plant detail
20. Verify: "Children" section shows the new plant -- AC-8
21. Create another propagation, mark it as "Failed"
22. Verify: appears in history with red X indicator -- AC-6
23. Check analytics section
24. Verify: success rate shown (50% with 1 potted, 1 failed) -- AC-10
25. On web: navigate to /garden/propagations
26. Verify: table layout with stage, method, and action columns

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- if module has standalone counterpart
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
No propagation tracking. Users can log a 'note' journal entry about propagation, but there's no structured workflow, stage tracking, or parent-child linking.

### After This Work
- gd_propagations table with method, medium, stage tracking, parent-child FKs
- Stage advancement workflow with progress visualization
- Convert-to-plant flow that creates linked child records
- Propagation list with filtering and history
- Success rate analytics by method
- Parent plant "Children" section showing propagated offspring

### Files Changed
- `modules/garden/src/types.ts` -- Propagation types, method/stage/medium enums
- `modules/garden/src/db/schema.ts` -- gd_propagations table
- `modules/garden/src/db/crud.ts` -- Propagation CRUD, active/history queries
- `modules/garden/src/engine/propagation.ts` -- Stage transitions, success rate calculations
- `modules/garden/src/definition.ts` -- V2 migration
- `apps/mobile/app/(garden)/propagations.tsx` -- Propagation list
- `apps/mobile/app/(garden)/propagation-detail.tsx` -- Detail/progress view
- `apps/mobile/app/(garden)/components/PropagationCard.tsx` -- Card component
- `apps/web/app/garden/propagations/page.tsx` -- Web propagation list

### Known Limitations
- Photo is stored per-propagation (one photo), not per-stage. A per-stage photo journal is a future enhancement (can use gd_entries with propagation_id).
- Stage sequence is fixed. Custom stages are not supported in V1.
- No notification when a propagation has been in the same stage for a long time (e.g., "rooting for 30+ days").

### Context for Next Agent
- The stage progression is a simple state machine. Valid transitions: started -> (callusing | rooting | growing | ready), callusing -> (rooting | growing | ready), etc. Any stage can go to 'failed'. Only 'ready' can go to 'potted'.
- The parent-child relationship is important: Plant Detail should show both "Children" (propagated from this plant) and "Parent" (this plant was propagated from). Query both directions using parent_plant_id and child_plant_id.
- For the "Pot and Add to Garden" flow, call the existing `createPlant()` function and then update the propagation record. Do this in a transaction.
