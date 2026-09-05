# Feature Spec: Workouts Rest Timer

## Metadata
- **Module:** workouts
- **Priority Score:** 42 / 50 (S-Tier)
- **Scoring Breakdown:** Market 4 x3 + Switching 5 x3 + Complexity 5 x2 + CrossModule 1 x1 + PaidUser 4 x1
- **Sprint:** Sprint 1
- **Estimated CC Time:** 2-3 hours
- **Depends On:** none (engine.ts `rest` state and `restRemaining` already exist)
- **Blocks:** progressive overload automation (A-tier, needs rest timing data)

## Business Context

### Why This Feature Exists
Rest timers are the single most-requested missing feature in workout apps. Proper rest between sets directly affects training effectiveness: too short reduces performance, too long wastes time. Every serious workout app has this, and its absence is the top reason users bounce from a new app within the first session. The engine already has a `rest` state and countdown logic, but there is no user-facing timer UI, no customizable durations, no audio/haptic notification when rest ends, and no way to override the hardcoded inter-set rest formula.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Hevy | Yes | Free | Per-exercise configurable timer, auto-start after logging set, vibration + sound alert, full-screen countdown overlay |
| Strong | Yes | Free | Global default + per-exercise override, haptic pulse at 0, minimalist circular countdown |
| JEFIT | Yes | Free | Animated countdown, configurable per exercise, voice announcement option |
| Fitbod | Yes | Pro only | Auto-calculated based on exercise intensity + muscle group, no manual override |

### Target User
Gym-goers who currently use Hevy ($36/yr) or Strong ($29.99/yr) for workout tracking and would switch to MyLife if it had feature parity on the core lifting experience. Rest timers are the #1 deal-breaker: without them, users open a separate timer app mid-workout, which means they never adopt MyWorkouts as their primary tracker.

## Technical Context

### Where This Lives in MyLife

```
modules/workouts/src/workout/engine.ts         -- Add REST_TIMER_START, REST_TIMER_ADJUST actions
modules/workouts/src/workout/rest-timer.ts      -- Rest timer configuration, presets, persistence
modules/workouts/src/types.ts                   -- Add RestTimerConfig, RestTimerPreset types
modules/workouts/src/db/crud.ts                 -- Persist per-exercise rest preferences
modules/workouts/src/db/schema.ts               -- Add wk_rest_preferences table (V4 migration)
modules/workouts/src/definition.ts              -- Add V4 migration
apps/mobile/app/(workouts)/components/RestTimerOverlay.tsx  -- Full-screen countdown UI
apps/mobile/app/(workouts)/components/RestTimerBadge.tsx    -- Inline timer badge on workout screen
apps/web/app/workouts/components/RestTimerOverlay.tsx       -- Web countdown UI
```

### Wireframe Position

```
Hub Dashboard
  └── MyWorkouts card
       └── Home tab (or active session)
            └── Active Workout Session
                 └── [Complete Set] button tap
                      └── Rest Timer Overlay ← YOU ARE HERE
```

The timer appears automatically after the user completes a set (taps "Done" or the engine dispatches `COMPLETE_SET`). It can also be triggered manually via a "Start Rest" button visible during the `playing` state.

### Data Model

```sql
-- V4 migration: per-exercise rest duration preferences
CREATE TABLE IF NOT EXISTS wk_rest_preferences (
  exercise_id TEXT PRIMARY KEY NOT NULL,
  rest_seconds INTEGER NOT NULL DEFAULT 90,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS wk_rest_preferences_updated_idx
  ON wk_rest_preferences(updated_at DESC);
```

The `rest_seconds` column stores the user's preferred rest duration for a specific exercise. If no row exists for an exercise, the system falls back to the global default (90 seconds) or the exercise's `rest_after` field.

### Dependencies
- **Internal:** `@mylife/workouts` (engine.ts, types.ts, crud.ts), `@mylife/ui` (Cool Obsidian tokens)
- **External:** `expo-haptics` (mobile vibration), `expo-av` (optional sound alert), `expo-notifications` (background timer on iOS)
- **Cross-Module:** None for V1. Future: meds module could schedule dose reminders at rest timer intervals.

## Functional Requirements

### User Stories
1. As a lifter, I want an automatic rest timer after completing a set so that I rest the optimal amount without watching a clock.
2. As a lifter, I want to customize rest duration per exercise so that I can rest longer on heavy compounds (3 min for squats) and shorter on isolation moves (60s for curls).
3. As a lifter, I want a haptic/sound alert when rest ends so that I know it's time to lift even when my phone is in my pocket or face-down on a bench.
4. As a lifter, I want to skip or extend the timer mid-rest so that I can adjust on the fly based on how I feel.
5. As a lifter, I want the timer to keep running if I lock my phone or switch apps so that I don't lose my rest period.

### Behavior Specification

**Happy path: automatic rest after set completion**
1. User is in an active workout session (`state: 'playing'`)
2. User taps "Done" to complete current set
3. Engine dispatches `COMPLETE_SET`, which transitions to `state: 'rest'`
4. Rest Timer Overlay slides up from the bottom of the screen
5. Circular countdown displays remaining time (e.g., "1:30")
6. Timer counts down in real-time, updating every 100ms
7. At 3 seconds remaining, device vibrates once (short haptic)
8. At 0 seconds, device vibrates twice (medium haptic) and plays a brief tone
9. Overlay auto-dismisses, engine transitions to `state: 'playing'` for next set
10. If this was the final set of an exercise, the between-exercise rest uses the next exercise's rest preference

**Manual rest start**
1. User taps "Rest" button during `playing` state (between reps, whenever they want)
2. Engine dispatches new `REST_TIMER_START` action with the exercise's configured duration
3. Same overlay and countdown behavior as automatic path

**Timer adjustment mid-rest**
1. During rest, user sees "+30s" and "-30s" buttons on the overlay
2. Tapping "+30s" adds 30 seconds to `restRemaining`
3. Tapping "-30s" subtracts 30 seconds (clamped to 0, which skips rest)
4. User can also tap "Skip" to immediately end rest

**Per-exercise configuration**
1. User taps the timer duration label on the Rest Timer Overlay (e.g., "1:30")
2. A picker appears with preset options: 30s, 60s, 90s, 2:00, 3:00, 5:00, Custom
3. User selects a preset or enters a custom value (10-600 seconds)
4. Selection is saved to `wk_rest_preferences` for this exercise
5. Future sets of this exercise use the saved duration

**Global default**
1. In workout settings, user can set a global default rest time (default: 90s)
2. This is used for any exercise without a per-exercise override
3. Stored in `wk_settings` table with key `rest_timer_default_seconds`

### Edge Cases

- **App backgrounded during rest:** Timer continues via a background timer or local notification scheduled at rest start. When user returns, overlay shows accurate remaining time.
- **Phone locked during rest:** Haptic/sound alert still fires via scheduled local notification. On unlock, overlay shows current state.
- **Timer running when workout completes:** If the last set triggers rest, the timer still runs but shows "Workout complete!" on dismiss rather than advancing to next set.
- **Timer at 0 but user hasn't dismissed:** Auto-advance after 2-second delay. If auto-advance is disabled in settings, overlay stays with "Tap to continue" prompt.
- **User skips exercise while timer is running:** Timer cancels, overlay dismisses, next exercise begins.
- **User navigates away from workout screen:** Timer persists in state. Returning to workout screen shows the overlay if rest is still active.
- **Module disabled mid-timer:** Timer state is part of the in-memory engine, not the database. Disabling the module closes the session; no crash.
- **Very short rest (< 5s):** No overlay shown. Engine transitions directly to next set.
- **Very long rest (> 10 min):** Timer still works but after 10 minutes shows "Extended rest" label. No auto-cancel.
- **Multiple sets completed rapidly (e.g., supersets):** In superset groups, rest is skipped between exercises in the same group (existing behavior). Rest only triggers after all exercises in the group complete one round.
- **Sound/haptic settings:** Respect device silent mode. Haptics work regardless of volume. Sound respects ringer/silent switch.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** After tapping "Done" on a set, a countdown overlay appears within 200ms showing the rest time counting down
- [ ] **AC-2:** The countdown displays remaining time in M:SS format, updating smoothly (no visible jitter)
- [ ] **AC-3:** A haptic pulse fires at 3 seconds remaining and a double-pulse fires at 0 seconds
- [ ] **AC-4:** Tapping "+30s" increases the displayed timer by exactly 30 seconds
- [ ] **AC-5:** Tapping "-30s" decreases the timer by 30 seconds, clamped at 0 (which ends rest immediately)
- [ ] **AC-6:** Tapping "Skip" ends rest immediately and advances to the next set
- [ ] **AC-7:** Tapping the timer duration label opens a picker with presets (30s, 60s, 90s, 2:00, 3:00, 5:00)
- [ ] **AC-8:** Selecting a preset saves it for the current exercise and is used for subsequent sets of the same exercise
- [ ] **AC-9:** The timer continues counting down when the app is backgrounded
- [ ] **AC-10:** On the final set of the last exercise, rest timer shows "Workout complete!" when it reaches 0
- [ ] **AC-11:** The rest timer is not shown for supersets between exercises in the same group (existing superset skip behavior preserved)
- [ ] **AC-12:** The "Rest" button is visible during `playing` state, allowing manual rest start

### Technical Criteria
- [ ] **TC-1:** Per-exercise rest preferences persist in `wk_rest_preferences` and survive app restart
- [ ] **TC-2:** Global default rest time persists in `wk_settings` with key `rest_timer_default_seconds`
- [ ] **TC-3:** Engine correctly resolves rest duration: per-exercise preference > exercise `rest_after` field > global default > 90s fallback
- [ ] **TC-4:** `REST_TIMER_START` action correctly sets `restRemaining` and transitions to `rest` state
- [ ] **TC-5:** `REST_TIMER_ADJUST` action correctly adds/subtracts from `restRemaining` with 0 clamping
- [ ] **TC-6:** Timer accuracy: actual elapsed time within 500ms of expected after 3 minutes of countdown
- [ ] **TC-7:** V4 migration runs cleanly on fresh and existing databases without data loss

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Rest timer must NOT play sound when device is in silent mode
- [ ] **NC-2:** Rest timer must NOT crash or freeze if the user rapidly taps +30s/-30s
- [ ] **NC-3:** Timer state must NOT persist to the database (it lives in engine memory only)
- [ ] **NC-4:** Saving a per-exercise rest preference must NOT affect other exercises' timers
- [ ] **NC-5:** The timer must NOT block the user from ending the workout at any time

## UI Specification

### Mobile (Expo)

**Rest Timer Overlay (full-screen modal, slides up from bottom)**
- Background: `rgba(10, 10, 15, 0.92)` with `backdrop-filter: blur(20px)` (iOS BlurView)
- Circular countdown ring: 200px diameter, stroke width 8px
  - Track: `rgba(255,255,255,0.06)` (border token)
  - Progress: `#EF4444` (workouts accent), animated counter-clockwise
- Center text: remaining time in `M:SS` format, `fontSize: 48`, `fontWeight: 800`, color `#F0F0F5`
- Below timer: exercise name in `fontSize: 16`, color `rgba(240,240,245,0.5)`
- Below exercise name: "Set X of Y" in `fontSize: 14`, color `rgba(240,240,245,0.35)`

**Control buttons (row below countdown):**
- "-30s" button: ghost style, `rgba(255,255,255,0.08)` background, `borderRadius: 12`
- "Skip" button: outlined, `border: 1px solid rgba(239,68,68,0.3)`, `borderRadius: 12`
- "+30s" button: ghost style, matching -30s

**Duration picker (when user taps timer label):**
- Bottom sheet with preset pills: 30s, 60s, 90s, 2:00, 3:00, 5:00
- Each pill: `borderRadius: 999`, selected state uses `#EF4444` background
- "Custom" option opens numeric input (10-600 range)

**Rest Timer Badge (inline, when overlay is dismissed but rest is active):**
- Small floating badge: `borderRadius: 20`, `#EF4444` background, white text
- Shows countdown in compact format: "1:30"
- Tapping badge re-opens the overlay

### Web (Next.js)

- Same design tokens applied via inline styles (matching Cool Obsidian pattern)
- Overlay: centered modal with `position: fixed`, dark backdrop
- Circular countdown: CSS `conic-gradient` animation (no canvas needed)
- Audio alert: `new Audio('/sounds/rest-complete.mp3').play()` with user-interaction gate
- No haptics on web
- Route: integrated into `/workouts` active session view (no separate page)

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Timer not visible (workout loading) | Session initializing |
| Empty | No timer shown; "Rest" button visible | `playing` state, no active rest |
| Active | Countdown overlay with circular timer, controls | `rest` state entered |
| Paused | Overlay shows "Paused" with resume button | User pauses workout during rest |
| Complete | "Workout complete!" message in overlay | Last set of last exercise finishes rest |

## Test Requirements

### Unit Tests
- [ ] `getRestDuration(exerciseId)`: returns per-exercise preference when saved
- [ ] `getRestDuration(exerciseId)`: falls back to exercise `rest_after` when no preference
- [ ] `getRestDuration(exerciseId)`: falls back to global default when no preference and no `rest_after`
- [ ] `getRestDuration(exerciseId)`: falls back to 90s when nothing is configured
- [ ] `saveRestPreference(exerciseId, seconds)`: persists to `wk_rest_preferences`
- [ ] `saveRestPreference(exerciseId, seconds)`: upserts on duplicate exercise_id
- [ ] `reducePlayer(status, REST_TIMER_START)`: sets `restRemaining` and transitions to `rest`
- [ ] `reducePlayer(status, REST_TIMER_START)`: no-op if already in `rest` state
- [ ] `reducePlayer(status, REST_TIMER_ADJUST)`: adds 30s to `restRemaining`
- [ ] `reducePlayer(status, REST_TIMER_ADJUST)`: subtracts 30s, clamped at 0
- [ ] `reducePlayer(status, REST_TIMER_ADJUST)`: at 0, dispatches `REST_COMPLETE`
- [ ] `COMPLETE_SET` -> `rest` transition: uses resolved rest duration (preference > rest_after > global > 90s)
- [ ] V4 migration: `wk_rest_preferences` table created successfully
- [ ] V4 migration: existing data in other tables unaffected

### Integration Tests
- [ ] Full flow: complete set -> rest overlay appears -> countdown -> haptic -> auto-advance to next set
- [ ] Preference flow: set custom rest duration -> complete set -> timer uses custom duration -> preference persists after app restart
- [ ] Skip flow: rest starts -> user taps skip -> overlay dismisses -> next set begins immediately

### QA Verification Script

1. Open the app on iOS simulator or device
2. Navigate to MyWorkouts via hub dashboard
3. Create a workout with 3 exercises, 3 sets each
4. Start a workout session
5. Complete the first set by tapping "Done"
6. **Verify:** Rest Timer Overlay appears with countdown (AC-1)
7. **Verify:** Timer displays M:SS format and counts down smoothly (AC-2)
8. Tap "+30s" button
9. **Verify:** Timer increases by exactly 30 seconds (AC-4)
10. Tap "-30s" button
11. **Verify:** Timer decreases by 30 seconds (AC-5)
12. Wait for timer to reach 3 seconds
13. **Verify:** Single haptic pulse at 3s remaining (AC-3)
14. Wait for timer to reach 0
15. **Verify:** Double haptic pulse at 0s (AC-3)
16. **Verify:** Overlay dismisses and next set is ready (AC-1)
17. On the next set completion, tap the timer duration label
18. **Verify:** Preset picker appears with 30s, 60s, 90s, 2:00, 3:00, 5:00 (AC-7)
19. Select "2:00"
20. **Verify:** Timer starts at 2:00 for subsequent sets of this exercise (AC-8)
21. Complete all sets of this exercise, advance to next exercise
22. **Verify:** Next exercise uses its own rest duration, not the 2:00 override (NC-4)
23. Background the app during rest
24. Wait for rest to complete
25. **Verify:** Return to app shows timer completed or at accurate remaining time (AC-9)
26. On the final set of the final exercise, complete the set
27. **Verify:** Rest timer shows "Workout complete!" when it reaches 0 (AC-10)
28. Create a superset group, complete sets
29. **Verify:** No rest timer between exercises in the same superset group (AC-11)
30. During a set, tap the "Rest" button
31. **Verify:** Manual rest timer starts (AC-12)
32. Tap "Skip" during rest
33. **Verify:** Rest ends immediately, next set begins (AC-6)
34. Open web at /workouts, start a session, complete a set
35. **Verify:** Web countdown overlay appears with circular timer animation
36. **Verify:** Web timer audio plays when rest completes (if browser permissions allow)

## gstack Quality Gates

Based on this feature's complexity score (5 -- Trivial), these gstack skills are REQUIRED:

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI (check all that apply):
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for the engine (rest duration resolution logic)

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- workouts has a standalone counterpart
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
The workout engine already has a `rest` state, `restRemaining` field, and `REST_COMPLETE` action. Inter-set rest is hardcoded as `Math.min(rest_after * 0.5, 30000)ms` and between-exercise rest uses the exercise's `rest_after` field directly. There is no user-facing timer UI, no configurable rest durations, no haptic/sound alerts, and no persistence of rest preferences.

### After This Work
- A full-screen countdown overlay appears automatically after every set completion
- Users can customize rest duration per exercise via preset picker or custom input
- Rest preferences persist in `wk_rest_preferences` (V4 migration)
- Haptic and sound alerts fire at countdown end
- Timer continues in background when app is backgrounded
- The `rest_after` field on exercises is still respected as a fallback
- Engine has two new actions: `REST_TIMER_START` and `REST_TIMER_ADJUST`

### Files Changed
- `modules/workouts/src/workout/engine.ts` -- Add `REST_TIMER_START` and `REST_TIMER_ADJUST` action handlers
- `modules/workouts/src/workout/rest-timer.ts` -- New: rest duration resolution, presets, CRUD helpers
- `modules/workouts/src/types.ts` -- Add `RestTimerPreset`, update `PlayerAction` union
- `modules/workouts/src/db/crud.ts` -- Add `getRestPreference`, `saveRestPreference`, `getGlobalRestDefault`, `setGlobalRestDefault`
- `modules/workouts/src/db/schema.ts` -- Add `CREATE_REST_PREFERENCES` table
- `modules/workouts/src/definition.ts` -- Add `WORKOUTS_MIGRATION_V4`
- `apps/mobile/app/(workouts)/components/RestTimerOverlay.tsx` -- New: full-screen countdown overlay
- `apps/mobile/app/(workouts)/components/RestTimerBadge.tsx` -- New: inline floating badge
- `apps/web/app/workouts/components/RestTimerOverlay.tsx` -- New: web countdown overlay
- `modules/workouts/src/workout/__tests__/rest-timer.test.ts` -- New: unit tests for duration resolution
- `modules/workouts/src/workout/__tests__/engine.test.ts` -- Extended: new action tests

### Known Limitations
- V1 does not include Apple Watch complications (planned for a future sprint)
- No analytics on average rest times or rest-to-performance correlation (future cross-module feature with meds/mood)
- Custom sound selection is not supported (single default tone)
- Web haptics are not supported (browser limitation)

### Context for Next Agent
- The engine's `COMPLETE_SET` handler already transitions to `rest` state. The new `REST_TIMER_START` action is for manual rest initiation only.
- The inter-set rest formula (`Math.min(rest_after * 0.5, 30000)`) should be replaced with the new resolution chain: per-exercise preference > exercise `rest_after` > global default > 90s.
- Superset group logic must NOT be affected. The `inSameGroup` check in `COMPLETE_SET` must still skip rest within groups.
- The `wk_rest_preferences` table uses `exercise_id` as the primary key. This is the library exercise ID (e.g., "seed-bench-press-1"), not a session-specific ID.
- For background timer on iOS, schedule a local notification at rest start time + rest duration. Cancel it if the user skips rest early.
