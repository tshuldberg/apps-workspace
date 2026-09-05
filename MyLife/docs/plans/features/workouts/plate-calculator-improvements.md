# Feature Spec: Plate Calculator Improvements

## Metadata
- **Module:** workouts
- **Feature ID:** WO-019+
- **Priority Score:** 29 / 50 (B-Tier)
- **Scoring Breakdown:** Market [4] x3 + Switching [2] x3 + Complexity [4] x2 + CrossModule [1] x1 + PaidUser [2] x1
- **Sprint:** S9+
- **Estimated CC Time:** 2-3 hours
- **Depends On:** none (engine exists in `modules/workouts/src/workout/plates.ts`)
- **Blocks:** none

## Business Context

### Why This Feature Exists
The plate calculator engine already exists and returns correct per-side breakdowns, but the user-facing experience is bare. Lifters in the middle of a set need fast, glanceable plate loading guidance. Strong (the competitor that pioneered this) offers a visual barbell diagram with color-coded plates, custom plate inventories (home gym vs. commercial gym), and quick-swap bar types. Our engine computes the math but the UI and customization layer are missing.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Strong | Yes | Free | Visual barbell diagram, custom plate inventory, bar weight selector, color-coded plates |
| Hevy | Yes | Free | Simple text-based plate breakdown, no visual diagram |
| JEFIT | No | N/A | No plate calculator |
| Fitbod | No | N/A | No plate calculator |

### Target User
Strength lifters (persona: Alex) training 4-6x/week who use barbells daily and need instant plate-loading guidance between sets. Also home gym users (persona: Jordan) with non-standard plate inventories who can't use default plate lists.

## Technical Context

### Where This Lives in MyLife
```
modules/workouts/src/workout/plates.ts    -- Engine (exists, needs custom inventory support)
modules/workouts/src/types.ts             -- New types for plate inventory + bar presets
modules/workouts/src/db/schema.ts         -- New wk_plate_inventories table
modules/workouts/src/db/crud.ts           -- CRUD for plate inventories
apps/mobile/app/(workouts)/plate-calc.tsx -- Mobile plate calculator screen
apps/web/app/workouts/plate-calc/page.tsx -- Web plate calculator page
```

### Wireframe Position
```
Hub Dashboard
  └── MyWorkouts card
       └── Workouts tab (during active workout)
            └── Set Logger (per exercise)
                 └── Barbell icon -> Plate Calculator (bottom sheet) ← YOU ARE HERE
       └── Profile tab
            └── Settings
                 └── Plate Inventory Manager
```

### Data Model

```sql
-- Custom plate inventories for users with non-standard plate sets
CREATE TABLE IF NOT EXISTS wk_plate_inventories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'lbs' CHECK (unit IN ('lbs', 'kg')),
  plates_json TEXT NOT NULL DEFAULT '[]',
  bar_weight REAL NOT NULL DEFAULT 45,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

`plates_json` stores an array of `{ weight: number, count: number }` representing available plates (total count, not per-side). Example: `[{"weight":45,"count":6},{"weight":25,"count":4},{"weight":10,"count":4},{"weight":5,"count":4},{"weight":2.5,"count":2}]`.

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter for CRUD), `@mylife/ui` (Cool Obsidian tokens)
- **External:** none
- **Cross-Module:** none

## Functional Requirements

### User Stories
1. As a lifter between sets, I want to tap a barbell icon and see a visual diagram of which plates to load for my target weight, so I load the bar correctly without mental math.
2. As a home gym owner with only 10 lb and 25 lb plates, I want to configure my available plate inventory so the calculator only shows plates I actually own.
3. As a user switching between barbell and EZ curl bar, I want quick bar type presets (45 lb, 35 lb, 15 lb) so I do not have to re-enter bar weight each time.
4. As a user, I want to see color-coded plates in a visual barbell diagram so I can identify plate sizes at a glance.

### Behavior Specification

1. User is in the Set Logger during an active workout for a barbell exercise.
2. User taps the barbell icon next to the weight input.
3. System opens a bottom sheet showing the Plate Calculator.
4. Target weight is pre-filled from the current exercise weight (if available).
5. Bar weight defaults to the user's last-used bar type or 45 lbs.
6. User can change bar type via segmented control: Standard (45 lb), Women's (35 lb), EZ Curl (15 lb), Custom.
7. User can toggle lbs/kg.
8. System shows a visual barbell diagram with color-coded plates on each side.
9. Below the diagram, a text summary lists: "Each side: 1x45 + 1x25 = 70 lbs".
10. Total weight and remainder (if any) displayed below.
11. User can access "My Plates" from a gear icon to manage custom inventories.

**Custom Inventory Flow:**
1. User navigates to Profile > Settings > Plate Inventory.
2. User taps "Create Inventory" or edits an existing one.
3. User names the inventory (e.g., "Home Gym").
4. User adds plate weights and quantities (how many of each plate they own total).
5. User sets the default bar weight.
6. User saves. The calculator uses the selected inventory's plates instead of standard plates.

### Edge Cases
- Target weight is less than or equal to bar weight: show "Just the bar" with empty barbell diagram.
- Target weight is negative or zero: treat as bar weight only.
- Custom inventory has no plates that can reach the target: show closest achievable weight with remainder.
- Custom inventory has limited plate count: respect count limits (e.g., only 2x45 lb plates means max 2 per side from that denomination).
- User has multiple inventories: show a dropdown to select which inventory to use.
- Unit mismatch: if user switches from lbs to kg, recalculate with kg plate set.
- Very large target weight (e.g., 1000 lbs): handle gracefully, show many plates.
- Floating point issues: round remainder to 2 decimal places.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Tapping the barbell icon during an active workout opens the plate calculator bottom sheet with the target weight pre-filled.
- [ ] **AC-2:** The visual barbell diagram shows color-coded plates matching the standard color scheme (45=Blue, 35=Yellow, 25=Green, 10=White, 5=Red, 2.5=Gray).
- [ ] **AC-3:** Changing the bar type instantly recalculates and updates the diagram.
- [ ] **AC-4:** Toggling lbs/kg recalculates using the appropriate plate set.
- [ ] **AC-5:** The text summary below the diagram lists each plate and count per side.
- [ ] **AC-6:** Users can create, edit, and delete custom plate inventories from Settings.
- [ ] **AC-7:** Selecting a custom inventory in the calculator restricts plates to only those in the inventory.
- [ ] **AC-8:** When a custom inventory has limited plate counts, the calculator respects the per-plate maximum.
- [ ] **AC-9:** For a target of 225 lbs with a 45 lb bar, the calculator shows 2x45 per side.
- [ ] **AC-10:** For a target <= bar weight, the diagram shows an empty barbell with "Just the bar" message.

### Technical Criteria
- [ ] **TC-1:** `wk_plate_inventories` table is created via V5 migration.
- [ ] **TC-2:** `calculatePlates` accepts an optional custom plates array and respects count limits.
- [ ] **TC-3:** Plate inventory CRUD (create, read, update, delete) functions work correctly.
- [ ] **TC-4:** Default inventories (standard lbs, standard kg) are pre-seeded.
- [ ] **TC-5:** Calculation completes in < 5ms for any realistic target weight.

### Negative Criteria
- [ ] **NC-1:** Custom inventories must NOT be synced to any cloud service (local SQLite only).
- [ ] **NC-2:** Plate calculator must NOT crash or hang on extreme inputs (negative, zero, > 2000 lbs).

## UI Specification

### Mobile (Expo)
- Bottom sheet opened from Set Logger barbell icon
- Background: `#0A0A0F` (background token)
- Barbell diagram: horizontal bar with colored plate rectangles stacked on each side
- Plate colors per the standard color table
- Cards: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border
- Module accent: `#EF4444` (workouts red) for active/selected states
- Bar type segmented control with 3-4 options
- Numeric input for target weight with +/- buttons for 5 lb/2.5 kg increments

### Web (Next.js)
- Same tokens via CSS variables
- Plate calculator accessible at `/workouts/plate-calc`
- Also available as a popover from the workout session view
- Barbell diagram rendered with CSS (colored divs) or SVG

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton barbell diagram | Initial render |
| Empty | Empty barbell with "Enter a target weight" | No target entered |
| Success | Color-coded barbell diagram with plate breakdown | Valid target > bar weight |
| Bar Only | Empty barbell with "Just the bar" | Target <= bar weight |
| Remainder | Diagram + yellow warning "Closest: X lbs (off by Y)" | Unachievable exact weight |

## Test Requirements

### Unit Tests
- [ ] `calculatePlates` with standard lbs plates: 225 lbs target -> 2x45 per side
- [ ] `calculatePlates` with standard kg plates: 100 kg target -> 1x25 + 1x15 per side
- [ ] `calculatePlates` with target <= bar weight: returns empty plates
- [ ] `calculatePlates` with custom inventory: respects available plates
- [ ] `calculatePlates` with limited plate counts: uses only available quantity
- [ ] `calculatePlates` with remainder: returns correct remainder value
- [ ] Plate inventory CRUD: create, read, update, delete
- [ ] Default inventory seeding: standard lbs and kg inventories exist

### Integration Tests
- [ ] Full flow: open calculator -> enter weight -> see diagram -> change bar type -> diagram updates
- [ ] Custom inventory: create inventory -> select it -> calculator uses custom plates

### QA Verification Script
1. Open the app on mobile
2. Navigate to MyWorkouts > start any barbell workout
3. In the Set Logger, tap the barbell icon
4. Verify: plate calculator bottom sheet opens with target weight pre-filled -- corresponds to AC-1
5. Enter target weight 225 lbs, verify 2x45 plates shown per side in blue -- corresponds to AC-9
6. Tap "Women's (35 lb)" bar type, verify diagram recalculates -- corresponds to AC-3
7. Toggle to kg, verify kg plate set is used -- corresponds to AC-4
8. Enter target weight 30 lbs (< 45 lb bar), verify "Just the bar" -- corresponds to AC-10
9. Navigate to Profile > Settings > Plate Inventory
10. Create a custom inventory "Home Gym" with 2x25, 4x10, 2x5
11. Return to plate calculator, select "Home Gym" inventory
12. Enter 135 lbs, verify only plates from the custom inventory are used -- corresponds to AC-7

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the plate calculator, test all bar types, verify all 5 states
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- if module has standalone counterpart

## Handoff State

### Before This Work
The plate calculator engine exists in `modules/workouts/src/workout/plates.ts` with a `calculatePlates(targetWeight, barWeight, unit)` function using standard plate sets. No UI, no custom inventory support, no visual diagram. 16 tests pass in `plates.test.ts`.

### After This Work
- Engine supports optional custom plate arrays with count limits
- `wk_plate_inventories` table with CRUD operations
- Visual barbell diagram component (mobile bottom sheet + web popover)
- Bar type presets (Standard, Women's, EZ Curl)
- Custom inventory management in Settings

### Files Changed
- `modules/workouts/src/workout/plates.ts` -- add custom inventory support to calculatePlates
- `modules/workouts/src/types.ts` -- add PlateInventory types, bar preset types
- `modules/workouts/src/db/schema.ts` -- add CREATE_PLATE_INVENTORIES
- `modules/workouts/src/db/crud.ts` -- add plate inventory CRUD functions
- `modules/workouts/src/definition.ts` -- add V5 migration with plate inventories table
- `apps/mobile/app/(workouts)/plate-calc.tsx` -- plate calculator bottom sheet
- `apps/web/app/workouts/plate-calc/page.tsx` -- web plate calculator page

### Known Limitations
- No plate animation (plates sliding onto the bar). Static diagram only.
- No integration with gym equipment databases (e.g., "Gold's Gym standard plates").
- Custom inventories are per-device only (no cloud sync).

### Context for Next Agent
The existing `calculatePlates` function signature should be extended with an optional parameter, not replaced. The `PlateResult` type already exists and should be reused. The V5 migration must be added after the existing V4 migration in `definition.ts`.
