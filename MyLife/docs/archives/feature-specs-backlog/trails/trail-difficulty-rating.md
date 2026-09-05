# Feature Spec: Trail Difficulty Rating

## Metadata
- **Module:** trails
- **Priority Score:** 29 / 50 (B-Tier)
- **Scoring Breakdown:** Market [3] x3 + Switching [3] x3 + Complexity [4] x2 + CrossModule [1] x1 + PaidUser [2] x1
- **Sprint:** 6
- **Estimated CC Time:** 1-2 hours (Complexity Inverse = 4, "Small")
- **Depends On:** GPS trail recording (V1), elevation engine (existing geo.ts)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Trail difficulty rating is foundational data that hikers use to decide whether a trail matches their fitness level. AllTrails rates every trail as Easy/Moderate/Hard using a combination of distance, elevation gain, and trail type. Komoot uses a 1-5 fitness level system calibrated to sport type. MyTrails already stores a user-assigned `difficulty` field (`easy/moderate/hard/expert`), but it's purely manual. This feature adds an algorithmic difficulty calculator that auto-suggests a difficulty rating based on GPS data (distance, elevation gain, steepness, and max grade). Users can override the suggestion, but new trails imported or completed get an instant rating. This reduces friction when logging trails and gives consistent difficulty comparisons across all trails in the library.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| AllTrails | Yes | Free | Easy/Moderate/Hard based on distance + elevation gain + trail type. Community can dispute. 400K+ trails rated. |
| Komoot | Yes | Free | Fitness level 1-5 per sport type (hiking, cycling, MTB). Factors in surface type and technicality. 35M+ users. |
| Gaia GPS | No | N/A | No difficulty rating. Shows raw elevation profile. Users interpret difficulty from data. |
| Strava | Partial | Free | "Segment difficulty" on specific segments but no overall trail rating. Focuses on performance, not safety. |

### Target User
All MyTrails users who record hikes. Beginners (the most safety-sensitive group) who need guidance on whether a trail is within their ability. Users importing trails from GPX files who want an instant difficulty assessment. Users comparing trails in their library to decide which one to do this weekend.

## Technical Context

### Where This Lives in MyLife

```
modules/trails/src/
  types.ts                      -- New DifficultyRating, DifficultyFactors schemas
  engine/
    difficulty-calculator.ts    -- NEW: algorithmic difficulty rating engine
  index.ts                      -- Export new difficulty functions and types

apps/mobile/app/(trails)/
  trail-detail.tsx              -- Updated: difficulty badge with breakdown tooltip

apps/web/app/trails/
  page.tsx                      -- Updated: difficulty column in trail list, breakdown in detail
```

### Wireframe Position

```
Hub Dashboard
  └── MyTrails card
       └── Trails tab
            └── Trail list (difficulty badge on each card)
            └── Trail Detail screen
                 └── Difficulty Badge ← calculated rating + factor breakdown
```

### Data Model

No new tables required. The existing `tr_trails.difficulty` column already stores the rating. This feature adds:
1. A pure-function engine that calculates difficulty from distance + elevation + grade data
2. Auto-suggestion when creating or updating a trail
3. A breakdown display showing which factors contributed to the rating

The difficulty factors are computed on-the-fly from trail data (not stored), keeping the schema unchanged.

### Dependencies
- **Internal:** `@mylife/trails` (trail data, waypoints for grade calculation), `engine/geo.ts` (elevation gain, haversine distance)
- **External:** None. Pure computation.
- **Cross-Module:** None (score: 1). Difficulty ratings are fully self-contained.

## Functional Requirements

### User Stories
1. As a beginner hiker, I want trails automatically rated by difficulty so that I don't accidentally attempt a trail beyond my ability.
2. As a user logging a new trail, I want the app to suggest a difficulty based on the trail's stats so that I don't have to guess.
3. As a user comparing trails, I want to see what factors contribute to the difficulty (distance, elevation, steepness) so that I understand why one trail is rated harder than another.
4. As an experienced hiker, I want to override the calculated difficulty if I know the trail's true difficulty differs from what the numbers suggest (e.g., technical scrambling not captured by elevation data).

### Behavior Specification

**Auto-suggestion on trail creation:**
1. User creates or completes recording of a new trail
2. System calculates difficulty from: distance, total elevation gain, max grade (if waypoints available)
3. Difficulty suggestion appears as a pre-filled picker (Easy/Moderate/Hard/Expert)
4. User can accept or change the suggestion before saving

**Difficulty display:**
1. Trail list cards show a colored difficulty badge: green (Easy), yellow (Moderate), orange (Hard), red (Expert)
2. Trail detail screen shows the badge plus a factor breakdown:
   - Distance factor: Short (<5km) / Medium (5-15km) / Long (>15km)
   - Elevation factor: Flat (<200m gain) / Moderate (200-600m) / Steep (600-1200m) / Extreme (>1200m)
   - Grade factor: Gentle (<10% max) / Moderate (10-20%) / Steep (20-35%) / Technical (>35%)
3. Each factor shows a small bar indicating its contribution

**Calculation algorithm:**
1. Score distance: 0-3 points (0: <3km, 1: 3-8km, 2: 8-16km, 3: >16km)
2. Score elevation gain: 0-3 points (0: <100m, 1: 100-400m, 2: 400-800m, 3: >800m)
3. Score max grade: 0-3 points (0: <8%, 1: 8-15%, 2: 15-25%, 3: >25%)
4. Total = distance_score + elevation_score + grade_score (0-9)
5. Map total to difficulty: 0-2 = Easy, 3-4 = Moderate, 5-6 = Hard, 7-9 = Expert
6. If no grade data available (no waypoints), use distance + elevation only (0-6 scale, thresholds adjusted)

### Edge Cases

- **No elevation data:** If trail has 0 elevation gain (flat coastal walk or data missing), elevation factor is 0. Rating based on distance + grade only.
- **No waypoint data:** If trail was manually created (no recording), grade factor is unavailable. Use 2-factor rating (distance + elevation). Show "Grade: Unknown" in breakdown.
- **Very short, very steep trail:** A 1km trail with 500m elevation gain should rate Hard or Expert despite short distance. The elevation and grade factors dominate correctly.
- **User override:** If user changes difficulty from the suggestion, persist their choice. Do not auto-recalculate unless user explicitly taps "Recalculate."
- **Existing trails:** Trails created before this feature have a manual difficulty value. Show "Manual rating" in the breakdown. Offer a "Recalculate" button to update.
- **Zero-length trail:** Distance 0 and elevation 0 should rate as Easy (score 0).

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Trail list shows colored difficulty badge (green/yellow/orange/red) on each trail card
- [ ] **AC-2:** Trail detail screen shows difficulty rating with factor breakdown (distance, elevation, grade)
- [ ] **AC-3:** When creating a trail with recording data, difficulty picker is pre-filled with calculated suggestion
- [ ] **AC-4:** User can override the calculated difficulty and their choice is preserved
- [ ] **AC-5:** Existing trails show a "Recalculate" button to update difficulty from current data
- [ ] **AC-6:** Factor breakdown shows labeled bars for each contributing factor

### Technical Criteria
- [ ] **TC-1:** `calculateDifficulty(distance, elevationGain, maxGrade)` returns correct rating for all threshold boundaries
- [ ] **TC-2:** Rating is consistent: same inputs always produce the same output (pure function)
- [ ] **TC-3:** Calculation completes in <1ms for any input
- [ ] **TC-4:** Missing grade data falls back to 2-factor calculation without error

### Negative Criteria
- [ ] **NC-1:** Auto-calculated difficulty must NOT overwrite a user's manual choice without explicit action
- [ ] **NC-2:** Difficulty calculation must NOT require network access (pure local computation)
- [ ] **NC-3:** This feature must NOT add new database tables or migrations

## UI Specification

### Mobile (Expo)

**Difficulty Badge (on trail cards and detail):**
- Pill-shaped badge with background color:
  - Easy: `#30D158` (success green) at 20% opacity, text in green
  - Moderate: `#FFD60A` (yellow) at 20% opacity, text in yellow
  - Hard: `#FF9F0A` (orange) at 20% opacity, text in orange
  - Expert: `#FF453A` (danger red) at 20% opacity, text in red
- Text: difficulty label in `label` variant (12px, 600 weight, uppercase)

**Factor Breakdown (trail detail):**
- Glass card below the difficulty badge
- Three rows: Distance, Elevation, Grade
- Each row: factor name, small horizontal bar (filled proportion = score/3), description text
- Bar fill color: module accent `#65A30D` (lime)

### Web (Next.js)

- Difficulty badge in the trail list table as a colored chip
- Factor breakdown as a tooltip or expandable section on trail detail

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Calculated | Colored badge + factor breakdown | Trail has distance + elevation data |
| Partial | Badge + "Grade: Unknown" in breakdown | Trail has no waypoint data for grade |
| Manual | Badge + "Manual rating" note + "Recalculate" button | Trail difficulty set before this feature |
| Override | Badge + "Manual override" note | User changed the calculated suggestion |

## Test Requirements

### Unit Tests
- [ ] `calculateDifficulty(1000, 50, 5)`: returns 'easy' (short, flat, gentle)
- [ ] `calculateDifficulty(10000, 500, 18)`: returns 'hard' (medium distance, moderate elevation, steep grade)
- [ ] `calculateDifficulty(20000, 1500, 30)`: returns 'expert' (long, extreme elevation, technical grade)
- [ ] `calculateDifficulty(500, 500, 40)`: returns 'expert' (short but extreme elevation and grade)
- [ ] `calculateDifficulty(0, 0, 0)`: returns 'easy' (zero-length trail)
- [ ] `calculateDifficulty(5000, 200, null)`: returns correct rating without grade data
- [ ] `difficultyScore(distance, elevation, grade)`: returns correct numeric score at each threshold boundary
- [ ] `difficultyFactors(distance, elevation, grade)`: returns labeled breakdown for each factor
- [ ] `difficultyColor('easy')`: returns correct hex color
- [ ] `difficultyColor('expert')`: returns correct hex color

### Integration Tests
- [ ] Create trail with recording -> verify auto-suggested difficulty matches algorithm
- [ ] Override difficulty -> close -> reopen -> verify override persisted
- [ ] Tap "Recalculate" on manual trail -> verify new difficulty applied

### QA Verification Script
1. Open the app on iOS simulator
2. Navigate to Trails tab
3. Verify: each trail card shows a colored difficulty badge -- corresponds to AC-1
4. Tap a trail to open detail
5. Verify: difficulty badge and factor breakdown (distance, elevation, grade) displayed -- corresponds to AC-2
6. Create a new recording on a trail, complete it
7. Verify: difficulty picker is pre-filled with a calculated suggestion -- corresponds to AC-3
8. Change the difficulty to a different value, save
9. Verify: the changed value is displayed, not recalculated -- corresponds to AC-4
10. Open an older trail created before this feature
11. Verify: "Recalculate" button is visible -- corresponds to AC-5
12. Tap "Recalculate"
13. Verify: difficulty updates based on trail data -- corresponds to AC-5
14. Check the factor breakdown
15. Verify: each factor has a labeled bar showing contribution -- corresponds to AC-6

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to trail detail, verify difficulty badge and breakdown render

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for difficulty-calculator engine

### Post-merge:
- [ ] `/parity-check` -- trails module parity
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Trails module has a `difficulty` field on trails (manual, user-assigned)
- Geo engine has haversine distance and elevation gain calculation
- No algorithmic difficulty rating

### After This Work
- New `engine/difficulty-calculator.ts` with pure functions for scoring and rating
- Trail detail shows difficulty badge with factor breakdown
- Trail creation auto-suggests difficulty from GPS data
- No schema changes required (uses existing `difficulty` column)

### Files Changed
- `modules/trails/src/types.ts` -- New `DifficultyRating`, `DifficultyFactors` schemas
- `modules/trails/src/engine/difficulty-calculator.ts` -- Difficulty calculation engine
- `modules/trails/src/index.ts` -- Export new functions and types
- `apps/mobile/app/(trails)/trail-detail.tsx` -- Difficulty badge + factor breakdown
- `apps/web/app/trails/page.tsx` -- Difficulty column + breakdown

### Known Limitations
- **No terrain type factor:** The algorithm uses distance, elevation, and grade but not surface type (paved vs rocky vs scramble). Surface type data would require either user input or trail database integration.
- **Grade requires waypoints:** Trails without waypoint data cannot calculate the grade factor. This is noted in the UI as "Grade: Unknown."
- **No sport-specific calibration:** Komoot adjusts difficulty per sport (hiking vs cycling vs MTB). V1 uses a single algorithm for all activity types. Sport-specific calibration could be added later.

### Context for Next Agent
- The existing `difficulty` column in `tr_trails` accepts `easy/moderate/hard/expert`. The calculator maps to these same values.
- `calculateElevationGain` in `engine/geo.ts` already computes elevation gain from waypoints. For max grade, you need to compute the steepest segment from consecutive waypoints: `grade = (elevation_delta / horizontal_distance) * 100`.
- The difficulty calculator is a pure function with zero side effects. It does not touch the database. The CRUD layer calls it as a suggestion; the user's choice is what gets persisted.
