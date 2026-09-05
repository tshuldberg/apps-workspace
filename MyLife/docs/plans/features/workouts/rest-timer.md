# Feature Spec: Rest Timer

## Metadata
- **Module:** workouts
- **Priority Score:** 42 / 50 (S-Tier)
- **Scoring Breakdown:** Market 4 x3 + Switching 5 x3 + Complexity 5 x2 + CrossModule 1 x1 + PaidUser 4 x1
- **Sprint:** 5
- **Estimated CC Time:** 1-2 hours
- **Depends On:** none (uses existing engine rest state)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Rest timer is the #1 most requested feature in workout app reviews across Hevy, Strong, and JEFIT. Every serious lifter needs configurable rest periods between sets to optimize recovery and performance. Complexity is 5 (trivial) because the workout engine already has a `rest` state with `restRemaining` countdown in `PlayerStatus`, and exercises already define `rest_after` in seconds. This feature surfaces a visible, interactive timer UI on top of the existing engine infrastructure.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Hevy | Yes | Free | Configurable per-exercise rest, countdown with haptic, auto-start on set completion |
| Strong | Yes | Free (basic), Pro ($29.99/yr) for custom | Preset rest intervals (30s, 60s, 90s, 120s, 3min, 5min), manual override |
| JEFIT | Yes | Free | Rest timer with sound alerts, customizable default rest time per exercise |
| Fitbod | Yes | Yes ($95.99/yr) | Auto-adjusted rest based on exercise type and intensity |
| Strava | No | N/A | No rest timer (cardio-focused) |

### Target User
Strength training users who need timed rest periods between sets for consistent training stimulus. Users coming from Hevy or Strong who expect a visible countdown timer as a core workout feature. Users following structured programs where rest intervals are prescribed (e.g., "3x10 bench press, 90s rest").

## Technical Context

### Where This Lives in MyLife

```
modules/workouts/src/workout/engine.ts       -- Already has rest state, enhance with timer config
modules/workouts/src/types.ts                -- Add RestTimerConfig type
modules/workouts/src/index.ts                -- Export new types
apps/mobile/app/(workouts)/session.tsx       -- Rest timer overlay during active session
```

### Wireframe Position

```
Hub Dashboard
  └── MyWorkouts card
       └── Active workout session
            └── Rest Timer overlay ← YOU ARE HERE
                 ├── Circular countdown display
                 ├── Skip rest button
                 ├── +30s / -30s adjustment buttons
                 └── Haptic/sound notification at 0
```

### Data Model

No new tables. Rest timer configuration uses existing infrastructure:

1. **Per-exercise rest:** Already stored in `wk_workouts.exercises_json` via `WorkoutExerciseEntry.restAfter` (seconds).
2. **Default rest time:** New setting in `wk_settings` (if a settings table exists) or in the engine config. For simplicity, store as a user preference read from the workout builder when creating exercises.
3. **Engine state:** `PlayerStatus.restRemaining` already tracks countdown in milliseconds. The `rest` state already ticks down via `TICK` action.

The only new column needed is a user-level default rest preference. Store in the module's settings pattern:

```sql
-- No new table needed. Use existing wk_workout_logs or add to a settings approach.
-- Default rest time is stored per-exercise in exercises_json.
-- Global default rest preference can be stored in the app's settings system.
```

### Dependencies
- **Internal:** `@mylife/db`, workout engine (`reducePlayer`, `PlayerStatus`), workout types
- **External:** expo-haptics (for haptic feedback on timer completion), expo-av (optional sound alert)
- **Cross-Module:** None. Rest timer is self-contained within the workout session.

## Functional Requirements

### User Stories
1. As a lifter, I want a visible countdown timer between sets so I can rest the exact prescribed duration.
2. As a user, I want to adjust the rest time mid-workout (+30s/-30s) without leaving the session.
3. As a user, I want haptic/sound feedback when rest is over so I know to start my next set without staring at the screen.
4. As a user, I want to skip rest early if I feel ready.

### Behavior Specification

**Rest timer activation:**
1. User completes a set (taps "Complete Set" or the engine triggers `COMPLETE_SET`)
2. Engine transitions to `rest` state with `restRemaining` set to `current.rest_after * 1000` (already implemented in `engine.ts` line 170)
3. Rest timer overlay appears on the session screen
4. Circular countdown starts, showing remaining seconds in large text
5. Progress ring animates from full to empty as time elapses

**During rest:**
1. Large circular timer shows remaining time (MM:SS format)
2. Two adjustment buttons: "+30s" and "-30s"
3. "+30s" adds 30000ms to `restRemaining`
4. "-30s" subtracts 30000ms (minimum 0, which triggers skip)
5. "Skip Rest" button dispatches `REST_COMPLETE` action immediately
6. Exercise preview card below timer shows next exercise name, sets, reps

**Timer completion:**
1. When `restRemaining` reaches 0, engine dispatches `REST_COMPLETE` (already implemented)
2. Haptic feedback fires (medium impact)
3. Optional sound alert plays (configurable, default ON)
4. Rest overlay dismisses
5. Session resumes in `playing` state on the next exercise/set

**Default rest time setting:**
1. In workout builder, each exercise has a "Rest" field (already `restAfter` in `WorkoutExerciseEntry`)
2. In Workouts settings, a "Default Rest Time" picker sets the default for new exercises
3. Presets: 30s, 60s, 90s, 120s, 180s, 300s
4. Custom entry also allowed

### Edge Cases

- **Rest time is 0:** Engine already skips rest state when `rest_after` is 0 (line 173 in engine.ts: `state: restMs > 0 ? 'rest' : 'playing'`). No timer shown.
- **-30s when <30s remaining:** Set remaining to 0, trigger `REST_COMPLETE`.
- **+30s past 10 minutes:** Allow. No cap on rest time. Some powerlifters rest 5-10 minutes.
- **App backgrounded during rest:** Timer continues counting down via elapsed time calculation on foreground resume.
- **Superset rest:** Engine already skips rest between exercises in the same group (line 157). Rest only appears after the final exercise in the superset group.
- **User navigates away mid-rest:** Session state preserved. Returning shows remaining rest time.
- **Sound/haptic disabled at OS level:** Degrade gracefully. Visual timer still works.
- **Very short rest (<5s):** Allow. Show countdown but skip the circular animation (just flash the number).

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Rest timer overlay appears automatically when engine enters `rest` state
- [ ] **AC-2:** Circular countdown shows remaining time in MM:SS format
- [ ] **AC-3:** Progress ring animates smoothly as time counts down
- [ ] **AC-4:** "+30s" button adds 30 seconds to the timer
- [ ] **AC-5:** "-30s" button removes 30 seconds (or skips if <30s remaining)
- [ ] **AC-6:** "Skip Rest" button immediately ends rest and resumes workout
- [ ] **AC-7:** Haptic feedback fires when timer reaches zero
- [ ] **AC-8:** Next exercise preview shown below the timer
- [ ] **AC-9:** Default rest time configurable in workout builder per exercise
- [ ] **AC-10:** Timer not shown when rest_after is 0

### Technical Criteria
- [ ] **TC-1:** Rest timer reads `restRemaining` from `PlayerStatus` (no separate timer state)
- [ ] **TC-2:** Adjustment buttons dispatch engine actions that modify `restRemaining`
- [ ] **TC-3:** Skip dispatches existing `REST_COMPLETE` action
- [ ] **TC-4:** Timer works correctly at all engine speed settings (0.5x-2.0x)
- [ ] **TC-5:** No new database tables required

### Negative Criteria
- [ ] **NC-1:** Rest timer must NOT create a separate countdown mechanism outside the engine
- [ ] **NC-2:** Timer must NOT block the user from seeing session progress
- [ ] **NC-3:** Must NOT auto-start next set without user awareness (visual + haptic signal required)

## UI Specification

### Mobile (Expo)
- **Rest overlay:** Full-width card overlaying the bottom 60% of session screen. Background: `rgba(10,10,15,0.95)` with `backdrop-filter: blur(20px)`.
- **Countdown ring:** 200px diameter. Track: `rgba(255,255,255,0.06)`. Fill: module accent `#EF4444` animating from 100% to 0%. Timer text centered: large `#F0F0F5` with remaining seconds.
- **Adjustment buttons:** Glass pill buttons (`rgba(255,255,255,0.08)` fill, `rgba(255,255,255,0.10)` border) with "+30s" and "-30s" labels.
- **Skip button:** Full-width button at bottom, text "Skip Rest" in `#EF4444`.
- **Next exercise preview:** Glass card below ring showing exercise name, sets x reps, muscle group tags.

### Web (Next.js)
- Same timer component rendered inline on the session page at `/workouts/session`.
- Keyboard shortcuts: Space to skip rest, Up arrow +30s, Down arrow -30s.

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Active rest | Countdown ring + time + adjustment buttons | Set completed, rest_after > 0 |
| Rest ending | Ring empty, haptic + sound fires | restRemaining reaches 0 |
| Skipped | Overlay dismisses instantly | User taps "Skip Rest" |
| No rest | No overlay shown | rest_after is 0 or superset transition |
| Adjusted | Timer updates to new value | User taps +30s or -30s |

## Test Requirements

### Unit Tests
- [ ] `reducePlayer(TICK)`: rest state decrements `restRemaining` correctly
- [ ] `reducePlayer(TICK)`: rest auto-completes when `restRemaining` reaches 0
- [ ] `reducePlayer(REST_COMPLETE)`: transitions from `rest` to `playing`
- [ ] `reducePlayer(COMPLETE_SET)`: enters `rest` state when `rest_after > 0`
- [ ] `reducePlayer(COMPLETE_SET)`: skips rest for superset (same `setGroupId`)
- [ ] `reducePlayer(COMPLETE_SET)`: skips rest when `rest_after` is 0
- [ ] Rest time adjustment: adding 30s increases `restRemaining` by 30000
- [ ] Rest time adjustment: subtracting below 0 clamps to 0

### Integration Tests
- [ ] Full flow: complete set -> rest timer appears -> countdown -> timer ends -> next exercise starts
- [ ] Skip flow: complete set -> rest timer appears -> tap skip -> next exercise starts immediately

### QA Verification Script

1. Create a workout with 3 exercises, each with 3 sets, 90s rest
2. Start the workout session
3. Complete the first set
4. Verify: Rest timer overlay appears with 1:30 countdown -- corresponds to AC-1, AC-2
5. Verify: Ring animates as time passes -- corresponds to AC-3
6. Tap "+30s"
7. Verify: Timer shows 2:00 -- corresponds to AC-4
8. Tap "-30s"
9. Verify: Timer shows 1:30 -- corresponds to AC-5
10. Tap "Skip Rest"
11. Verify: Timer dismisses, next set begins -- corresponds to AC-6
12. Complete another set, let timer run to 0
13. Verify: Haptic fires at completion -- corresponds to AC-7
14. Verify: Next exercise name shown below timer during rest -- corresponds to AC-8
15. Go to workout builder, set an exercise rest to 60s
16. Verify: Timer uses that value during session -- corresponds to AC-9
17. Set an exercise rest to 0
18. Verify: No timer overlay after completing that exercise's sets -- corresponds to AC-10

## gstack Quality Gates

Based on Complexity 5 (Inverse), this feature is "Trivial" tier.

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Post-merge:
- [ ] `/parity-check` -- verify standalone parity

## Handoff State

### Before This Work
The workout engine already has a `rest` state with `restRemaining` countdown, `REST_COMPLETE` action, and `rest_after` per exercise. But there is no visible timer UI during rest periods.

### After This Work
- Visible circular countdown timer overlay during rest periods
- +30s/-30s adjustment buttons
- Skip rest button
- Haptic/sound feedback at timer completion
- Next exercise preview during rest

### Files Changed
- `modules/workouts/src/types.ts` -- Add `RestTimerAction` type for adjustment actions
- `modules/workouts/src/workout/engine.ts` -- Add `ADJUST_REST` action to reducer
- `modules/workouts/src/index.ts` -- Export new types
- `apps/mobile/app/(workouts)/session.tsx` -- Rest timer overlay component

### Known Limitations
- No auto-start rest on set completion without user input (user must tap "Complete Set")
- No per-exercise rest history analytics
- No rest time suggestions based on exercise type or intensity
- No background timer with lock screen widget

### Context for Next Agent
- The engine is in `modules/workouts/src/workout/engine.ts`. The `reducePlayer` function is a pure reducer. The `rest` state is already implemented with `restRemaining` countdown on TICK.
- `WorkoutExerciseEntry.restAfter` stores rest in seconds. The engine converts to milliseconds (`rest_after * 1000`).
- To add rest adjustment, add a new `PlayerAction` variant: `{ type: 'ADJUST_REST'; deltaMs: number }` and handle it in the reducer by modifying `restRemaining` (clamped to 0 minimum).
- The `SPEED_OPTIONS` array in the engine module controls playback speed. Rest timer ticks at real time regardless of speed setting (use raw `deltaMs`, not `scaledDelta`). Check: currently rest TICK uses raw `action.deltaMs`, not scaled. This is correct for rest.
- Haptic feedback: use `expo-haptics` with `Haptics.impactAsync(ImpactFeedbackStyle.Medium)`.
