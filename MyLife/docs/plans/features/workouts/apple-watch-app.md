# Feature Spec: Apple Watch App

## Metadata
- **Module:** workouts
- **Priority Score:** 31 / 50 (A-Tier)
- **Scoring Breakdown:** Market 4 x3 + Switching 4 x3 + Complexity 0 x2 + CrossModule 3 x1 + PaidUser 4 x1
- **Sprint:** 5
- **Estimated CC Time:** 8-10 hours
- **Depends On:** Rest timer (shows timer on watch), GPS route recording (outdoor tracking from wrist)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Apple Watch is the most popular wearable for fitness tracking. Strava, Hevy, and Strong all have Apple Watch companion apps. Lifters want to log sets from their wrist without pulling out their phone. Runners want to start/stop GPS from the watch. Complexity is 0 (massive) because it requires building a standalone watchOS app with WatchKit/SwiftUI, WatchConnectivity for phone sync, HealthKit workout session integration, and a constrained UI for a tiny screen. This is the most complex feature in the workouts backlog.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Strava | Yes | Free (basic) | Full GPS recording from watch, live stats, heart rate, auto-pause |
| Hevy | Yes | Free | Set logging from watch, rest timer, exercise navigation |
| Strong | Yes | Yes ($29.99/yr) | Set/rep logging, rest timer, exercise list, Apple Watch complication |
| JEFIT | Partial | Yes ($155.88/yr) | Basic workout control, limited watch features |
| Fitbod | Yes | Yes ($95.99/yr) | Full workout experience on watch, auto-advance exercises |

### Target User
Users with Apple Watch who want to log strength workouts from their wrist (no phone needed on the gym floor). Runners who want to start GPS tracking from the watch. Users who want workout data to sync to HealthKit as proper workout sessions for Activity Ring credit.

## Technical Context

### Where This Lives in MyLife

```
apps/watch/                                    -- New: watchOS app target
apps/watch/src/WatchApp.swift                  -- SwiftUI app entry
apps/watch/src/SessionView.swift               -- Active workout session UI
apps/watch/src/ExerciseView.swift              -- Exercise + set logging
apps/watch/src/RestTimerView.swift             -- Rest countdown on wrist
apps/watch/src/GPSView.swift                   -- GPS workout view
apps/watch/src/SyncManager.swift               -- WatchConnectivity bridge
apps/watch/src/HealthKitSession.swift          -- HKWorkoutSession integration
modules/workouts/src/watch/sync-protocol.ts    -- Sync message format (shared types)
modules/workouts/src/watch/types.ts            -- Watch-specific types
apps/mobile/app/(workouts)/watch-sync.tsx      -- Watch sync status on phone
```

### Wireframe Position

```
Apple Watch (standalone)
  └── MyWorkouts Watch
       ├── Workout list (recent workouts)
       ├── Active session
       │    ├── Exercise name + current set
       │    ├── Weight + reps display
       │    ├── "Done" set completion button
       │    └── Rest timer countdown
       ├── GPS workout
       │    ├── Activity type selector
       │    ├── Live stats (distance/pace/time)
       │    └── Pause/Stop controls
       └── Complication (streak count or today's workout name)
```

### Data Model

No new tables in the main SQLite database. Watch data syncs to the phone via WatchConnectivity and is written to existing tables (`wk_workout_sessions`, `wk_workout_set_weights`, `wk_gps_routes`, `wk_gps_points`).

**Sync protocol messages (JSON over WatchConnectivity):**

```typescript
// Phone -> Watch
interface WatchSyncMessage {
  type: 'workout_list' | 'exercise_library' | 'settings';
  payload: unknown;
}

// Watch -> Phone
interface WatchSessionUpdate {
  type: 'set_completed' | 'session_started' | 'session_completed' | 'gps_points';
  sessionId: string;
  payload: unknown;
}
```

### Dependencies
- **Internal:** `@mylife/db` (phone-side), workout engine, exercise library, GPS tracker, rest timer
- **External:** watchOS SDK (SwiftUI, WatchKit), WatchConnectivity framework, HealthKit (HKWorkoutSession for Activity Ring credit), CoreLocation (watch GPS)
- **Cross-Module:** Health module (HealthKit workout data flows to health vitals). GPS routes sync to workouts module on phone.

## Functional Requirements

### User Stories
1. As a lifter with an Apple Watch, I want to log sets from my wrist so I don't need my phone on the gym floor.
2. As a runner, I want to start GPS tracking from my watch and see live pace/distance.
3. As a user, I want my watch workouts to sync to HealthKit for Activity Ring credit.
4. As a user, I want a rest timer on my watch with haptic feedback when rest is over.

### Behavior Specification

**Watch app launch:**
1. On first launch, Watch app requests phone connection via WatchConnectivity
2. Phone sends: recent workout definitions (last 10), exercise library, user settings (weight unit, rest default)
3. Watch caches this data locally (UserDefaults or SwiftData)
4. Watch home screen shows: list of recent workouts + "Start GPS" button

**Strength workout on watch:**
1. User selects a workout from the list
2. Watch starts an HKWorkoutSession (for Activity Ring credit)
3. First exercise appears:
   - Exercise name (large text)
   - "Set 1 of 3" indicator
   - Previous performance (if synced): "Last: 135 x 10"
   - Current weight display (editable via Digital Crown)
   - Rep counter (increment/decrement buttons)
4. User adjusts weight with Digital Crown, taps reps, taps "Done" to log set
5. Set data sent to phone via WatchConnectivity
6. Rest timer appears (if rest > 0):
   - Circular countdown with remaining seconds
   - Haptic tap at 10s, 5s, and completion
   - "Skip" button to end rest early
7. Next set or next exercise appears
8. On workout completion:
   - HKWorkoutSession ends
   - Summary screen: total duration, sets completed, volume
   - Data syncs to phone

**GPS workout on watch:**
1. User taps "Start GPS" on the watch
2. Activity type selector: Run / Cycle / Hike / Walk
3. GPS tracking starts (using watch CoreLocation)
4. Live display shows:
   - Distance (large number)
   - Elapsed time
   - Current pace (running) or speed (cycling)
   - Heart rate (from watch sensors)
5. Pause/Stop controls at bottom
6. On stop, route data syncs to phone via WatchConnectivity
7. Phone stores route in `wk_gps_routes` and `wk_gps_points`

**Watch complication:**
1. Provides a complication showing:
   - Current streak count, or
   - Today's planned workout name, or
   - "Rest day" if no workout scheduled
2. Tapping complication launches the watch app

**Sync behavior:**
1. WatchConnectivity transferUserInfo for background sync (guaranteed delivery)
2. WatchConnectivity sendMessage for real-time sync when both app and watch are active
3. Sync queue on watch: if phone is unreachable, queue updates and send when connected
4. Conflict resolution: watch data is always additive (new sets, new sessions). No destructive operations from watch.

### Edge Cases

- **Phone not reachable:** Queue sync data on watch. Send when reconnected. Show "Syncing..." badge.
- **Watch loses GPS signal:** Same behavior as phone GPS: pause recording, resume when signal returns.
- **Watch battery critically low (<10%):** Show warning. Allow completing current set but discourage starting new workouts.
- **Mid-workout app crash:** HKWorkoutSession persists. On relaunch, recover the session state and offer to resume or discard.
- **Workout definition changed on phone mid-session:** Watch uses cached version. Sync updates on next session start.
- **No workouts synced to watch:** Show "Open MyWorkouts on your phone to sync workouts."
- **Very large exercise library (50+ exercises):** Watch only caches exercises referenced by synced workouts, not the full library.
- **Digital Crown sensitivity for weight adjustment:** Step in 2.5 lbs (or 1 kg) increments. Fine-tune with haptic detents.
- **watchOS version too old (<9.0):** Show "Update watchOS to use MyWorkouts."
- **Watch only (no phone nearby):** GPS recording works standalone. Syncs when phone reconnects. Strength tracking requires initial workout sync but can operate with cached data.
- **Heart rate data:** Read from HealthKit during workout. Display on GPS screen. Store in session data for sync.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Watch app shows list of recent synced workouts
- [ ] **AC-2:** Selecting a workout starts HKWorkoutSession and shows first exercise
- [ ] **AC-3:** Digital Crown adjusts weight in configurable increments
- [ ] **AC-4:** Set completion button logs weight + reps and advances to next set
- [ ] **AC-5:** Rest timer with haptic feedback appears between sets
- [ ] **AC-6:** "Start GPS" button launches GPS tracking with live stats
- [ ] **AC-7:** GPS displays distance, time, pace, and heart rate
- [ ] **AC-8:** Workout completion shows summary and syncs to phone
- [ ] **AC-9:** Complication shows streak count or today's workout
- [ ] **AC-10:** Watch works offline with cached workout data

### Technical Criteria
- [ ] **TC-1:** WatchConnectivity sync protocol sends workout data bi-directionally
- [ ] **TC-2:** HKWorkoutSession creates proper workout entries for Activity Ring credit
- [ ] **TC-3:** GPS points synced to phone are stored in wk_gps_points correctly
- [ ] **TC-4:** Set weight data synced to phone is stored in wk_workout_set_weights
- [ ] **TC-5:** Sync queue handles offline scenarios (queues and retries)
- [ ] **TC-6:** Watch app binary size < 50MB
- [ ] **TC-7:** Battery usage < 15% per hour of active workout tracking

### Negative Criteria
- [ ] **NC-1:** Must NOT require constant phone connection during workout (offline capable)
- [ ] **NC-2:** Must NOT overwrite phone-side data (watch sync is additive only)
- [ ] **NC-3:** Must NOT skip HealthKit workout session (required for Activity Rings)
- [ ] **NC-4:** Must NOT transmit data over the internet (local WatchConnectivity only)

## UI Specification

### watchOS (SwiftUI)
- **Home screen:** List view with workout names in system font, white on black. Accent highlights in `#EF4444`. "Start GPS" button as a large tappable card.
- **Exercise view:** Exercise name top-center (bold, 16pt). Set indicator ("Set 2/3") below. Weight display (large, 36pt) adjustable via Digital Crown. Rep count buttons (+/-). "Done" button full-width at bottom in accent.
- **Rest timer:** Circular progress in `#EF4444`. Remaining time centered (28pt). "Skip" button below.
- **GPS view:** Distance (large, 40pt) centered. Time and pace as secondary stats. Heart rate with small heart icon. Pause/Stop buttons.
- **Complication:** Modular small: streak number with flame icon. Graphic corner: workout name.

### Mobile (Phone-side sync UI)
- **Watch sync status:** In Workouts Settings, a "Watch" section shows sync status: "Last synced: 5 min ago", connection status indicator.

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Synced | Workout list on watch | Phone connected, workouts synced |
| No workouts | "Sync from phone" message | No workouts cached |
| Active strength | Exercise view with weight/reps | Workout started |
| Rest | Timer countdown with haptic | Set completed |
| Active GPS | Live stats on map | GPS workout started |
| Offline | "Syncing..." badge, works normally | Phone not reachable |
| Complication | Streak or workout name | Watch face installed |

## Test Requirements

### Unit Tests
- [ ] `WatchSyncMessage`: serializes/deserializes workout definitions correctly
- [ ] `WatchSessionUpdate`: serializes set completion data correctly
- [ ] `WatchSessionUpdate`: serializes GPS points correctly
- [ ] Sync queue: queues messages when offline
- [ ] Sync queue: sends queued messages when reconnected
- [ ] Digital Crown: weight adjusts in correct increments (2.5 lbs / 1 kg)
- [ ] Heart rate: reads from HealthKit during active workout
- [ ] HKWorkoutSession: starts and ends with correct activity type

### Integration Tests
- [ ] Full sync flow: create workout on phone -> syncs to watch -> complete on watch -> data syncs back to phone -> appears in wk_workout_set_weights
- [ ] GPS flow: start GPS on watch -> record route -> stop -> sync to phone -> route appears in wk_gps_routes

### QA Verification Script

1. Open MyWorkouts on phone, create a workout with 2 exercises
2. Open MyWorkouts on Apple Watch
3. Verify: Workout appears in watch list -- corresponds to AC-1
4. Tap the workout
5. Verify: First exercise shown with set/rep info -- corresponds to AC-2
6. Adjust weight with Digital Crown
7. Verify: Weight changes in correct increments -- corresponds to AC-3
8. Enter reps and tap "Done"
9. Verify: Set logged, advances to next set -- corresponds to AC-4
10. Verify: Rest timer appears with haptic -- corresponds to AC-5
11. After rest, complete remaining sets and exercises
12. Verify: Summary shown, data syncs to phone -- corresponds to AC-8
13. Return to watch home, tap "Start GPS"
14. Verify: GPS options shown -- corresponds to AC-6
15. Select Run, start tracking
16. Walk for 1 minute
17. Verify: Distance, time, pace, heart rate shown -- corresponds to AC-7
18. Stop GPS session
19. Verify: Route syncs to phone
20. Check watch face complication
21. Verify: Streak count or workout name shown -- corresponds to AC-9
22. Disable phone Bluetooth, start workout on watch
23. Verify: Watch workout works with cached data -- corresponds to AC-10

## gstack Quality Gates

Based on Complexity 0 (Inverse), this feature is "Massive" tier.

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states

### Required if Complexity <= 2:
- [ ] `/plan-eng-review` -- run on this spec BEFORE building

### Required if Complexity <= 1:
- [ ] `/office-hours` (builder mode) -- validate approach

### Required if Complexity <= 0:
- [ ] `/plan-design-review` -- review UI design for watch constraints

### Post-merge:
- [ ] `/parity-check` -- verify standalone parity

## Handoff State

### Before This Work
Workouts module is phone-only. No Apple Watch companion app exists. Users must use their phone during workouts.

### After This Work
- watchOS companion app with SwiftUI interface
- Strength workout logging from wrist (exercise navigation, weight/rep entry, set completion)
- GPS workout tracking from watch
- Rest timer with haptic feedback on watch
- WatchConnectivity bi-directional sync
- HKWorkoutSession integration for Activity Ring credit
- Watch face complication
- Offline-capable with sync queue

### Files Changed
- `apps/watch/` -- New: entire watchOS app target (SwiftUI)
- `modules/workouts/src/watch/sync-protocol.ts` -- New: sync message format types
- `modules/workouts/src/watch/types.ts` -- New: watch-specific types
- `modules/workouts/src/index.ts` -- Export watch sync types
- `apps/mobile/app/(workouts)/watch-sync.tsx` -- Watch sync status UI on phone

### Known Limitations
- iOS only (no Android Wear OS support)
- No independent app store presence (companion to phone app)
- No workout creation on watch (must create on phone and sync)
- No exercise video playback on watch (too small, battery drain)
- No voice commands on watch (phone only)
- No social features on watch
- Limited to 10 most recent workouts cached on watch
- No complex workout builder on watch (use phone)
- Heart rate zones not yet implemented (raw HR only)

### Context for Next Agent
- This is the only feature that requires native Swift code. The watch app is a separate Xcode target, not part of the Expo/React Native build.
- WatchConnectivity is the communication layer. Key APIs:
  - `WCSession.default.transferUserInfo(_:)` for guaranteed background delivery (phone -> watch: workout definitions)
  - `WCSession.default.sendMessage(_:replyHandler:errorHandler:)` for real-time updates (watch -> phone: set completions)
  - `WCSession.default.transferCurrentComplicationUserInfo(_:)` for complication updates
- The sync protocol must be defined in TypeScript (for phone-side processing) and mirrored in Swift (for watch-side). Keep the JSON schema simple and flat.
- HKWorkoutSession requires:
  - `HKWorkoutConfiguration` with `.activityType` (e.g., `.traditionalStrengthTraining`, `.running`)
  - `HKWorkoutBuilder` to add samples and events
  - Call `endCollection()` and `finishWorkout()` on completion
- The phone-side sync handler receives WatchConnectivity messages in the React Native layer. Use `react-native-watch-connectivity` or a native module bridge.
- For the Expo project, the watch target may need to be added via a custom Xcode workspace or an Expo config plugin. Check the Expo docs for watchOS target support.
- Battery optimization: batch GPS points (send every 30s, not every 2s). Use significant location changes for background GPS.
- This feature should be built AFTER rest timer and GPS route recording, as it surfaces both on the watch.
