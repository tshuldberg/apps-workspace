# Feature Spec: Muscle Recovery Heatmap

## Metadata
- **Module:** workouts
- **Priority Score:** 33 / 50 (A-Tier)
- **Scoring Breakdown:** Market 4 x3 + Switching 3 x3 + Complexity 3 x2 + CrossModule 2 x1 + PaidUser 4 x1
- **Sprint:** 5
- **Estimated CC Time:** 3-4 hours
- **Depends On:** none (uses existing body map and session data)
- **Blocks:** AI workout generation can use recovery data for smarter exercise selection

## Business Context

### Why This Feature Exists
Muscle recovery tracking tells users which muscle groups are fresh, recovering, or fatigued based on recent workout history. Fitbod's recovery heatmap is their second most-cited premium feature (after AI generation). JEFIT shows muscle fatigue indicators. This prevents overtraining and helps users plan balanced training splits. Complexity is 3 (medium) because it requires building a recovery estimation model that factors in time since last workout, volume, intensity, and muscle group recovery rates.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Fitbod | Yes | Yes ($95.99/yr) | Color-coded body map showing muscle fatigue/recovery, used for workout generation |
| JEFIT | Yes | Yes ($155.88/yr) | Muscle recovery indicator (simple time-based, 48-72h) |
| Hevy | No | N/A | Shows volume by muscle group but no recovery heatmap |
| Strong | No | N/A | No recovery tracking |
| Strava | No | N/A | No muscle-level tracking |

### Target User
Users training 3+ days per week who want to avoid overtraining specific muscle groups. Users following push/pull/legs or upper/lower splits who need to verify they're not hitting the same muscles too frequently. Users drawn to Fitbod's visual recovery heatmap.

## Technical Context

### Where This Lives in MyLife

```
modules/workouts/src/recovery/engine.ts       -- Recovery estimation engine
modules/workouts/src/recovery/types.ts        -- Recovery types
modules/workouts/src/index.ts                 -- Export recovery functions
apps/mobile/app/(workouts)/recovery.tsx       -- Recovery heatmap screen
```

### Wireframe Position

```
Hub Dashboard
  └── MyWorkouts card
       └── Home tab
            └── Recovery Heatmap card ← YOU ARE HERE
                 ├── Body map with color-coded muscles
                 ├── Per-muscle status (fresh/recovering/fatigued)
                 ├── Recovery time estimate per muscle
                 └── "Best to train today" suggestion
```

### Data Model

No new tables. Recovery is calculated dynamically from existing data:
- `wk_workout_sessions` -- when workouts happened
- `wk_workout_set_weights` -- volume per exercise per session
- `wk_exercises` -- exercise-to-muscle group mapping via `muscle_groups_json`
- `EXERCISE_MUSCLE_MAPPINGS` in `body-map.ts` -- primary and secondary muscle groups per exercise

The recovery engine is a pure function that takes session history and produces recovery status per muscle group.

### Dependencies
- **Internal:** `@mylife/db`, body map module (`BODY_MAP_MUSCLE_GROUPS`, `EXERCISE_MUSCLE_MAPPINGS`), session data, set weight data
- **External:** None
- **Cross-Module:** Health module's sleep data (if available) could modify recovery rates. Nutrition module's protein intake (if available) could affect recovery. Both are optional enhancements.

## Functional Requirements

### User Stories
1. As a user, I want to see which muscle groups are fresh, recovering, or fatigued so I can plan today's workout accordingly.
2. As a user, I want a visual body map showing recovery status with color coding.
3. As a user, I want estimated time until a muscle group is fully recovered.
4. As a user, I want a "best to train today" suggestion based on recovery status.

### Behavior Specification

**Recovery calculation:**
1. For each of the 14 muscle groups, calculate a recovery score (0-100):
   - 0 = fully fatigued (just trained, high volume)
   - 100 = fully recovered (not trained in 72+ hours or very low volume)
2. Recovery model inputs:
   a. **Time since last trained:** Hours since the muscle group was last worked
   b. **Volume:** Total sets x reps for that muscle group in the last session
   c. **Intensity:** Average weight as percentage of 1RM (if 1RM data exists)
   d. **Primary vs secondary:** Exercises hit primary muscles harder than secondary
3. Recovery curve:
   - Base recovery time: 48 hours for moderate volume, 72 hours for high volume
   - Recovery score = min(100, (hours_since_trained / base_recovery_hours) * 100)
   - Volume modifier: high volume (>15 sets) extends recovery by 24h. Low volume (<6 sets) shortens by 12h.
   - Intensity modifier: >85% 1RM adds 12h. <65% 1RM subtracts 12h.
   - Secondary muscle groups recover 30% faster than primary.

**Recovery heatmap display:**
1. Full-body map (front and back view, using existing body-map.ts data)
2. Each muscle group colored by recovery score:
   - 0-33: Red (`#FF453A`) -- Fatigued
   - 34-66: Orange/Yellow (`#FF9F0A`) -- Recovering
   - 67-100: Green (`#30D158`) -- Fresh
3. Tapping a muscle group shows detail:
   - Recovery percentage
   - Hours until fully recovered
   - Last trained date
   - Volume from last session
   - Recent training frequency (times in last 7 days)

**"Best to train today" suggestion:**
1. Analyze all muscle groups and identify which are fully recovered (score >= 80)
2. Suggest a workout focus:
   - If chest/shoulders/triceps are fresh: "Push day looks good"
   - If back/biceps are fresh: "Pull day looks good"
   - If quads/hamstrings/glutes/calves are fresh: "Leg day looks good"
   - If all upper/lower are fresh: "Full body is an option"
   - If nothing is fresh: "Consider a rest day"
3. Show as a card on the Home tab above the heatmap

### Edge Cases

- **No workout history:** All muscles show as "Fresh" (100%). Show "Start training to see your recovery status."
- **Only 1 muscle group trained ever:** Show accurate data for that group, others as Fresh.
- **Very high volume (50+ sets for one muscle group):** Cap recovery time at 96 hours. Beyond that is unusual and likely an error.
- **No 1RM data:** Skip intensity modifier. Use time + volume only.
- **Exercise not in EXERCISE_MUSCLE_MAPPINGS:** Fall back to the exercise's `muscle_groups_json` from `wk_exercises` table. Treat all listed as primary.
- **Same muscle worked on consecutive days:** Recovery resets. New volume replaces previous recovery calculation (the muscle is now freshly fatigued again).
- **Cross-module data unavailable (sleep, nutrition):** Engine works without cross-module data. Recovery is purely time + volume + intensity based.
- **Muscle groups with no exercises in the library:** Show as "Fresh" by default.
- **User trains the same muscle at low volume daily (e.g., core every day):** Engine correctly shows core as recovering but not fully fatigued (low volume = faster recovery).

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Body map heatmap visible on Home tab with color-coded muscle groups
- [ ] **AC-2:** Muscles colored red (fatigued), orange (recovering), or green (fresh)
- [ ] **AC-3:** Tapping a muscle shows recovery detail (percentage, hours to recovery, last trained)
- [ ] **AC-4:** "Best to train today" suggestion card shown above heatmap
- [ ] **AC-5:** Recovery updates automatically when new sessions are completed
- [ ] **AC-6:** Front and back body views available (toggle or swipe)
- [ ] **AC-7:** All 14 muscle groups represented on the map

### Technical Criteria
- [ ] **TC-1:** Recovery engine is a pure function (no DB dependency, testable)
- [ ] **TC-2:** Recovery score correctly factors time, volume, and intensity
- [ ] **TC-3:** Primary muscles recover 30% slower than secondary muscles
- [ ] **TC-4:** No new database tables (all computed from existing data)
- [ ] **TC-5:** Recovery calculation runs in <50ms for 90 days of workout history
- [ ] **TC-6:** Body map uses existing `BODY_MAP_MUSCLE_GROUPS` data from body-map.ts

### Negative Criteria
- [ ] **NC-1:** Must NOT claim medical accuracy for recovery estimates
- [ ] **NC-2:** Recovery heatmap must NOT prevent users from working out fatigued muscles (informational only)
- [ ] **NC-3:** Must NOT require network access

## UI Specification

### Mobile (Expo)
- **Heatmap card:** Glass card on Home tab. Body silhouette (front/back toggle) with muscle groups as tappable regions. Colors: red `#FF453A`, orange `#FF9F0A`, green `#30D158` at varying alpha levels based on exact score.
- **Suggestion card:** Glass card above heatmap. Icon (checkmark or warning), text "Push day looks good" or "Consider rest", accent border on actionable suggestions.
- **Muscle detail sheet:** Bottom sheet with recovery percentage ring, "Estimated recovery: 14h remaining" text, last trained date, volume stat, frequency stat.
- **Front/back toggle:** Segmented control below the body map. Smooth crossfade transition.

### Web (Next.js)
- `/workouts/recovery` route. Side-by-side front and back body views.
- Hover over muscle group shows tooltip with recovery detail.

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| All fresh | Body map all green, "You're fully recovered!" | No workouts in 72+ hours |
| Mixed recovery | Color-coded muscles, training suggestion | Normal training pattern |
| All fatigued | Body map mostly red, "Consider a rest day" | Heavy training, no rest |
| No data | Green map, "Start training to track recovery" | No sessions recorded |
| Detail view | Bottom sheet with muscle recovery stats | Muscle group tapped |

## Test Requirements

### Unit Tests
- [ ] `calculateRecovery`: 0 hours since trained, moderate volume = ~0% recovered
- [ ] `calculateRecovery`: 24 hours since trained, moderate volume = ~50% recovered
- [ ] `calculateRecovery`: 48 hours since trained, moderate volume = ~100% recovered
- [ ] `calculateRecovery`: high volume extends recovery to 72 hours
- [ ] `calculateRecovery`: low volume shortens recovery to 36 hours
- [ ] `calculateRecovery`: high intensity (>85% 1RM) adds 12h
- [ ] `calculateRecovery`: secondary muscles recover 30% faster
- [ ] `calculateRecovery`: no history returns 100% recovered
- [ ] `calculateRecovery`: caps at 96 hours max recovery time
- [ ] `getBestToTrain`: suggests push day when push muscles are fresh
- [ ] `getBestToTrain`: suggests rest when no muscles are fresh
- [ ] `buildRecoveryMap`: processes 14 muscle groups from session data
- [ ] `buildRecoveryMap`: handles exercises with only primary (no secondary) muscles

### Integration Tests
- [ ] Full flow: complete workout -> heatmap updates -> trained muscles show as fatigued -> wait simulation -> muscles turn green
- [ ] Suggestion flow: complete push workout -> suggestion shows pull day -> complete pull workout -> suggestion shows legs

### QA Verification Script

1. Navigate to MyWorkouts > Home tab
2. Verify: Recovery heatmap card visible -- corresponds to AC-1
3. Complete a "Push" workout (chest, shoulders, triceps exercises)
4. Return to Home tab
5. Verify: Chest, shoulders, triceps show red/orange -- corresponds to AC-2
6. Verify: Back, biceps, legs show green -- corresponds to AC-2
7. Tap on "Chest" muscle
8. Verify: Detail sheet shows recovery %, hours to recovery, last trained -- corresponds to AC-3
9. Verify: "Best to train today" card suggests Pull or Legs -- corresponds to AC-4
10. Complete another workout
11. Verify: Heatmap updates -- corresponds to AC-5
12. Toggle front/back view
13. Verify: Both views show correctly -- corresponds to AC-6
14. Verify: All 14 muscle groups visible across both views -- corresponds to AC-7

## gstack Quality Gates

Based on Complexity 3 (Inverse), this feature is "Medium" tier.

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states

### Required if this feature contains business logic:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for recovery engine

### Post-merge:
- [ ] `/parity-check` -- verify standalone parity

## Handoff State

### Before This Work
Workouts module has a body map with 14 muscle groups and exercise-muscle mappings but no recovery tracking or visual heatmap. Users have no visibility into which muscles need rest.

### After This Work
- Pure-function recovery estimation engine
- Color-coded body map heatmap (front/back views)
- Per-muscle recovery detail (percentage, time to recovery, training history)
- "Best to train today" suggestion engine
- Integration-ready for cross-module recovery factors (sleep, nutrition)

### Files Changed
- `modules/workouts/src/recovery/engine.ts` -- New: recovery calculation engine
- `modules/workouts/src/recovery/types.ts` -- New: recovery types (RecoveryScore, RecoveryMap, TrainingSuggestion)
- `modules/workouts/src/index.ts` -- Export recovery functions
- `apps/mobile/app/(workouts)/recovery.tsx` -- Recovery heatmap screen/component

### Known Limitations
- No machine learning for personalized recovery rates (uses population averages)
- No sleep or nutrition integration for recovery adjustment (future enhancement)
- No soreness self-reporting (purely time + volume based)
- Recovery curve is linear (real recovery is logarithmic, but linear is simpler and close enough)
- No recovery history or trend tracking over weeks

### Context for Next Agent
- `BODY_MAP_MUSCLE_GROUPS` in `body-map.ts` defines 14 muscle groups with region (upper/core/lower) and side (front/back/both). Use this as the complete list.
- `EXERCISE_MUSCLE_MAPPINGS` maps exercise names to primary and secondary muscle groups. Use primary for full fatigue impact, secondary at 70% impact.
- Session data comes from `wk_workout_sessions` (when workouts happened) and `wk_workout_set_weights` (volume per exercise). Join these with `wk_exercises` to get muscle group mappings.
- The recovery engine should be a pure function: `calculateRecoveryMap(sessions, exercises, now) => Map<MuscleGroup, RecoveryScore>`. No DB dependency in the engine itself; the DB query happens in a wrapper function.
- Recovery time constants: moderate volume base = 48h, high volume (>15 sets) = 72h, low volume (<6 sets) = 36h. Intensity modifier: >85% 1RM adds 12h, <65% 1RM subtracts 12h. These should be named constants, not magic numbers.
- The AI workout generation feature (if built) should consume the recovery map to avoid suggesting exercises for fatigued muscle groups.
