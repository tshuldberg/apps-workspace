# Feature Spec: Previous Performance Display

## Metadata
- **Module:** workouts
- **Priority Score:** 40 / 50 (S-Tier)
- **Scoring Breakdown:** Market 4 x3 + Switching 5 x3 + Complexity 4 x2 + CrossModule 1 x1 + PaidUser 4 x1
- **Sprint:** 5
- **Estimated CC Time:** 2-3 hours
- **Depends On:** none (uses existing wk_workout_set_weights data)
- **Blocks:** Progressive overload automation (reads previous performance to suggest increases)

## Business Context

### Why This Feature Exists
"What did I lift last time?" is the single most important question during a workout. Hevy and Strong both show previous set weights/reps inline during the active session. Without this, users must scroll through history or use a paper notebook. This is the #2 top complaint in workout app reviews and a primary switching motivator (5/5). Complexity is 4 (easy) because the data already exists in `wk_workout_set_weights` -- this feature queries the most recent session for the same workout and displays it inline.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Hevy | Yes | Free | Previous set weight/reps shown as ghost text in input fields |
| Strong | Yes | Free | "Last time" column next to current set entry |
| JEFIT | Yes | Free | Previous workout log visible during active session |
| Fitbod | Partial | Yes ($95.99/yr) | Shows recommended weight based on history (not raw previous) |
| Strava | No | N/A | No strength tracking |

### Target User
Strength training users following progressive overload who need to see what they lifted last time to know what weight/reps to target today. Users switching from Hevy or Strong where this is a core UX pattern. Any user who tracks sets and weights.

## Technical Context

### Where This Lives in MyLife

```
modules/workouts/src/db/crud.ts              -- New query: getPreviousPerformance
modules/workouts/src/types.ts                -- PreviousPerformance type
modules/workouts/src/index.ts                -- Export new function and type
apps/mobile/app/(workouts)/session.tsx       -- Inline previous performance display
```

### Wireframe Position

```
Hub Dashboard
  └── MyWorkouts card
       └── Active workout session
            └── Exercise card (during workout)
                 └── Set row ← YOU ARE HERE
                      ├── Set number
                      ├── Previous: 135 lbs x 10 (ghost text)
                      ├── Current weight input
                      └── Current reps input
```

### Data Model

No new tables. Query existing `wk_workout_set_weights` for the most recent completed session of the same workout.

```sql
-- Query to get previous performance for a workout
SELECT sw.exercise_id, sw.set_number, sw.weight, sw.reps, sw.unit, sw.estimated_1rm
FROM wk_workout_set_weights sw
JOIN wk_workout_sessions s ON sw.session_id = s.id
WHERE s.workout_id = ?
  AND s.completed_at IS NOT NULL
  AND s.id != ?  -- exclude current session
ORDER BY s.completed_at DESC
LIMIT 100;  -- reasonable cap, then filter by most recent session in code
```

### Dependencies
- **Internal:** `@mylife/db`, `wk_workout_set_weights` (existing table), `wk_workout_sessions` (existing table)
- **External:** None
- **Cross-Module:** None. Previous performance is entirely within the workouts module.

## Functional Requirements

### User Stories
1. As a lifter, I want to see what I lifted last time for each exercise and set so I can match or beat it.
2. As a user, I want previous performance shown inline during my active session without navigating to history.
3. As a user, I want to see previous performance even if my exercise order changed since last time.

### Behavior Specification

**Loading previous performance:**
1. When a workout session starts, the system queries `wk_workout_set_weights` for the most recent completed session of the same `workout_id`.
2. Data is grouped by `exercise_id` and `set_number`.
3. This becomes a lookup map: `Map<exerciseId, Map<setNumber, { weight, reps, unit }>>`.

**Display during session:**
1. Each exercise card shows a set entry table.
2. For each set row, if previous performance exists for that exercise/set:
   - Show "Last: 135 lbs x 10" as secondary text above or beside the weight/reps input fields.
   - Text color: `rgba(240,240,245,0.40)` (ghost text).
3. If no previous performance exists (first time doing this workout or exercise):
   - Show nothing (no placeholder, no empty state -- just the blank input fields).

**Edge case: exercise order changed:**
1. Previous performance is keyed by `exercise_id`, not by position in the workout.
2. If an exercise was at position 3 last time but is now at position 1, its previous data still shows correctly.

**Tapping previous performance:**
1. Tapping the "Last: 135 lbs x 10" text pre-fills the current set's weight and reps with those values.
2. User can then adjust up or down from there.

### Edge Cases

- **First workout ever:** No previous data. Inputs show empty (no ghost text).
- **Same workout done multiple times:** Uses the most recent completed session only.
- **Exercise removed from workout since last time:** Ignored. Previous data only shown for exercises in the current workout.
- **New exercise added to workout:** No previous data for that exercise specifically. Show empty.
- **Exercise done in a different workout:** Only queries sessions of the same `workout_id`, not all sessions. This is intentional (users may use different weights in different workout contexts).
- **Incomplete previous session (abandoned mid-workout):** Only uses sessions where `completed_at IS NOT NULL`.
- **Unit mismatch (lbs last time, kg now):** Display previous in the unit it was recorded. If the user has changed their preferred unit, show a converted value with original in parentheses.
- **Very large number of sets (20+ sets from a high-volume day):** Display all. Performance lookup handles any set count.
- **Multiple sessions on the same day:** Uses the most recent by `completed_at`.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Previous performance text appears for each set that has historical data
- [ ] **AC-2:** Ghost text format is "Last: [weight] [unit] x [reps]"
- [ ] **AC-3:** Ghost text is visually distinct from current input (secondary text color)
- [ ] **AC-4:** Tapping ghost text pre-fills current set with those values
- [ ] **AC-5:** No ghost text shown for exercises with no history
- [ ] **AC-6:** Previous performance is per-exercise, not per-position
- [ ] **AC-7:** Data comes from most recent completed session of the same workout

### Technical Criteria
- [ ] **TC-1:** `getPreviousPerformance` query runs in <50ms for typical workout size
- [ ] **TC-2:** Query only includes completed sessions (completed_at IS NOT NULL)
- [ ] **TC-3:** Query excludes current session from results
- [ ] **TC-4:** Data is fetched once on session start, not re-queried per set
- [ ] **TC-5:** No new database tables or columns required

### Negative Criteria
- [ ] **NC-1:** Must NOT show data from sessions of a different workout_id
- [ ] **NC-2:** Must NOT auto-fill weight/reps without user action (tap required)
- [ ] **NC-3:** Must NOT block session start while loading previous data (async, show when ready)

## UI Specification

### Mobile (Expo)
- **Set row layout:** Each row has: set number badge, previous text (secondary), weight input, "x", reps input, check button.
- **Previous text:** `rgba(240,240,245,0.40)` color, 13pt font. Format: "Last: 135 lbs x 10". Positioned above the weight input or as a subline beneath the set number.
- **Pre-fill tap target:** The entire previous text line is tappable. On tap, weight and reps inputs animate to the previous values (brief scale animation).
- **Input fields:** Glass fill `rgba(255,255,255,0.04)`, border `rgba(255,255,255,0.10)`, text `#F0F0F5`. Number keyboard.

### Web (Next.js)
- `/workouts/session` route. Table layout with "Previous" column between "Set" and "Weight" columns.
- Click to pre-fill same as mobile.

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Previous data loaded | Ghost text on each set row | Session started, previous session found |
| No previous data | Empty set rows (no ghost text) | First time doing this workout |
| Pre-filled | Input fields populated with previous values | User tapped ghost text |
| Loading | Brief skeleton on ghost text area | Query in progress (should be <50ms) |

## Test Requirements

### Unit Tests
- [ ] `getPreviousPerformance`: returns correct data for a workout with 2 sessions
- [ ] `getPreviousPerformance`: returns most recent session only (not older ones)
- [ ] `getPreviousPerformance`: returns empty map when no previous sessions exist
- [ ] `getPreviousPerformance`: excludes current session from results
- [ ] `getPreviousPerformance`: excludes incomplete sessions (completed_at is NULL)
- [ ] `getPreviousPerformance`: groups data correctly by exercise_id and set_number
- [ ] `getPreviousPerformance`: handles exercises not in the current workout gracefully

### Integration Tests
- [ ] Full flow: complete workout session with weights -> start same workout again -> previous values shown -> tap to pre-fill
- [ ] First-time flow: create new workout -> start session -> no previous values shown

### QA Verification Script

1. Create a workout "Test Bench Day" with Bench Press (3 sets), Incline DB Press (3 sets)
2. Start a session, log: Set 1: 135 lbs x 10, Set 2: 155 lbs x 8, Set 3: 175 lbs x 5
3. Log Incline DB: Set 1: 50 lbs x 12, Set 2: 55 lbs x 10, Set 3: 60 lbs x 8
4. Complete the session
5. Start the same workout again
6. Verify: "Last: 135 lbs x 10" shown on Bench Press Set 1 -- corresponds to AC-1, AC-2
7. Verify: Ghost text is dimmed/secondary color -- corresponds to AC-3
8. Tap the "Last: 135 lbs x 10" text
9. Verify: Weight pre-fills to 135, reps pre-fills to 10 -- corresponds to AC-4
10. Start a brand new workout with a new exercise
11. Verify: No ghost text on any set -- corresponds to AC-5
12. Edit "Test Bench Day" to swap exercise order
13. Start session
14. Verify: Previous data still matches correct exercises -- corresponds to AC-6
15. Verify: Data is from the most recent completed session -- corresponds to AC-7

## gstack Quality Gates

Based on Complexity 4 (Inverse), this feature is "Small" tier.

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states

### Post-merge:
- [ ] `/parity-check` -- verify standalone parity

## Handoff State

### Before This Work
Set weight tracking exists (`wk_workout_set_weights` table, `recordSetWeight` and `getSetWeightsForSession` functions) but previous session data is not surfaced during an active workout session.

### After This Work
- `getPreviousPerformance()` function returns previous set data for a workout
- Inline ghost text on each set row during active sessions
- Tap-to-prefill from previous values
- Data keyed by exercise_id (position-independent)

### Files Changed
- `modules/workouts/src/db/crud.ts` -- New: `getPreviousPerformance` query function
- `modules/workouts/src/types.ts` -- New: `PreviousSetData` and `PreviousPerformanceMap` types
- `modules/workouts/src/index.ts` -- Export new function and types
- `apps/mobile/app/(workouts)/session.tsx` -- Inline previous performance display + tap to pre-fill

### Known Limitations
- Only shows previous data from the same workout_id (not cross-workout exercise history)
- No trend line or chart of historical performance for an exercise (that's a different feature)
- No "best ever" display alongside previous (only last session)
- No recommendation for weight increase (that's progressive overload automation)

### Context for Next Agent
- `wk_workout_set_weights` stores per-set weight, reps, unit, and estimated_1rm. It references `session_id` (FK to `wk_workout_sessions`).
- `wk_workout_sessions` has `workout_id` (FK to `wk_workouts`) and `completed_at`.
- The query needs to: (1) find the most recent completed session for the given `workout_id` that is NOT the current session, (2) return all `wk_workout_set_weights` rows for that session, grouped by `exercise_id` and `set_number`.
- The result type should be: `Map<string, Map<number, { weight: number; reps: number; unit: WeightUnit; estimated1rm: number }>>` (exerciseId -> setNumber -> data).
- All DB functions take `db: DatabaseAdapter` as the first parameter. Follow the existing pattern in `crud.ts`.
