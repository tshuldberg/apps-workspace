# Feature Spec: Apple Watch Quick-Log

## Metadata
- **Module:** fast
- **Priority Score:** 30 / 50 (A-Tier)
- **Scoring Breakdown:** Market [3] x3 + Switching [4] x3 + Complexity [2] x2 + CrossModule [1] x1 + PaidUser [4] x1
- **Sprint:** 5
- **Estimated CC Time:** 5-6 hours
- **Depends On:** Fasting timer (FT-001, implemented), Water intake logging (FT-007, implemented)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Apple Watch is the most-worn smartwatch in the US (over 100M active devices). Fasting app users wearing a Watch want to glance at their wrist to see how long they've been fasting and tap once to log water, without pulling out their phone. Zero ($69.99/yr) and Fastic ($59.99-79.99/yr) both offer Watch apps behind their premium subscriptions. MyFast offering a free Watch companion is a high-switching-motivation differentiator (Switching 4/5) and a strong signal of premium quality (PaidUser 4/5). The low Complexity score (2/5) reflects that this feature requires native watchOS development, a WatchConnectivity bridge, and expo-dev-client (cannot use Expo Go), making it the most technically demanding feature in the Fast backlog.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Zero | Yes | Yes ($69.99/yr) | Timer display, fasting zone, start/stop from Watch, complications |
| Fastic | Yes | Yes ($59.99-79.99/yr) | Timer display, water logging, step tracking on Watch |
| Simple | No | N/A | No Watch app |
| BodyFast | No | N/A | No Watch app |
| WaterMinder | Yes | Partial ($10/yr) | Water logging complications, Watch app for quick-log |

### Target User
Apple Watch-wearing intermittent fasters (25-45) who currently use Zero or Fastic's Watch app behind a $60-80/yr paywall. Also users of WaterMinder ($10/yr) who want a combined fasting + hydration Watch companion instead of a separate hydration-only app. The Watch app is particularly valuable for users who fast during workouts or outdoor activities where pulling out a phone is inconvenient.

## Technical Context

### Where This Lives in MyLife

```
apps/mobile/
  ios/
    MyFastWatch/                           -- NEW: native watchOS app target
      MyFastWatchApp.swift                 -- Watch app entry point
      TimerView.swift                      -- Fasting timer screen
      WaterView.swift                      -- Water quick-log screen
      ComplicationProvider.swift           -- Watch complications
      WatchSessionManager.swift            -- WatchConnectivity delegate
  app/(fast)/
    timer.tsx                              -- Modify: add WatchConnectivity sync

modules/fast/src/
  engines/watch-sync.ts                    -- NEW: message formatting, command handling
  types.ts                                 -- Add WatchMessage, WatchCommand types
```

### Wireframe Position

```
Apple Watch
  ├── Timer Screen (default)
  │    ├── Fasting zone name + color (top)
  │    ├── Elapsed time HH:MM (center, large)
  │    ├── Zone name (below time)
  │    └── Start/End Fast button (bottom)
  │
  └── Water Screen (swipe/crown)
       ├── Daily count / target "5 / 8" (center)
       ├── Progress ring (around count)
       └── "Log Water" button (bottom)

Complications (watchOS):
  ├── Circular: elapsed time + progress ring (timer)
  └── Circular: water count + progress ring (water)
```

On the phone, no new screens. The sync layer is invisible to the user.

### Data Model

No new database tables or columns. The Watch companion does not have its own database. All data lives on the phone in the existing ft_fasts, ft_active_fast, and ft_water_intake tables.

**Watch-Phone Communication Protocol (WatchConnectivity):**

Phone-to-Watch messages (applicationContext):
```typescript
interface WatchState {
  // Fasting state
  activeFast: {
    protocol: string;
    startedAt: string;    // ISO 8601
    targetHours: number;
    zoneName: string;
    zoneColor: string;
  } | null;

  // Water state
  waterCount: number;
  waterTarget: number;

  // Metadata
  timestamp: string;      // ISO 8601
}
```

Watch-to-Phone commands (sendMessage):
```typescript
type WatchCommand =
  | { action: 'logWater' }
  | { action: 'startFast'; protocol: string; targetHours: number }
  | { action: 'endFast' }
  | { action: 'requestState' };
```

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter, used on phone side only), existing fasting CRUD (`startFast`, `endFast`, `getActiveFast`), existing water CRUD (`incrementWaterIntake`, `getWaterIntake`), fasting zones (`getCurrentFastingZone`), timer (`computeTimerState`)
- **External:**
  - `WatchConnectivity` framework (Apple, native Swift)
  - `expo-dev-client` (required, cannot use Expo Go)
  - Native Swift module bridge (expo modules API or react-native-watch-connectivity)
  - watchOS 10+ SDK
  - Xcode (for building Watch app target)
- **Cross-Module:** None. Watch app is scoped to Fast module only.

## Functional Requirements

### User Stories
1. As a user wearing an Apple Watch, I want to log water intake from my wrist with a single tap, so that I do not need to pull out my phone every time I drink water.
2. As a fasting user with an Apple Watch, I want to see my current fasting timer status on my watch, including the elapsed time and fasting zone.
3. As a fasting user, I want to start and stop fasts from my wrist, so that I can control my timer without my phone.
4. As a Watch user, I want watch face complications showing my fasting timer and water progress, so I can glance at my wrist throughout the day.

### Behavior Specification

**Watch Timer Screen:**
1. On launch, the Watch app requests current state from the phone via `requestState` command.
2. While waiting, displays cached state (from last `applicationContext` update) or a "Syncing..." placeholder.
3. Once state arrives:
   - If a fast is active: shows elapsed time (HH:MM), current fasting zone name with zone color accent, and "End Fast" button.
   - If no fast is active: shows "Not Fasting" with "Start Fast" button and the user's default protocol.
4. Elapsed time updates every second using the `startedAt` timestamp (computed locally on Watch, no per-second sync needed).
5. Zone transitions happen locally using the same zone boundaries (4h, 8h, 12h, 18h, 24h).

**Start Fast from Watch:**
1. User taps "Start Fast" on the Watch.
2. Watch sends `{ action: 'startFast', protocol: defaultProtocol, targetHours }` to phone.
3. Phone executes `startFast()` in the database.
4. Phone sends updated `WatchState` back to Watch.
5. Watch updates to show the active timer.
6. Haptic confirmation on Watch (success tap).
7. If phone is not reachable: Watch shows "Syncing..." and queues the command. When phone becomes available, command is sent and state syncs.

**End Fast from Watch:**
1. User taps "End Fast" on the Watch.
2. Watch shows a confirmation prompt: "End your fast?"
3. If confirmed: Watch sends `{ action: 'endFast' }` to phone.
4. Phone executes `endFast()`.
5. Phone sends updated `WatchState` (activeFast: null).
6. Watch updates to show "Not Fasting" state.
7. Haptic confirmation.

**Water Quick-Log:**
1. User navigates to the Water screen (swipe or digital crown scroll from Timer).
2. Screen shows daily count/target (e.g., "5 / 8") with a progress ring.
3. User taps "Log Water" button.
4. Watch sends `{ action: 'logWater' }` to phone.
5. Phone executes `incrementWaterIntake()`.
6. Phone sends updated `WatchState` with new count.
7. Watch updates count and progress ring.
8. Haptic confirmation.
9. If phone is not reachable: command queued, Watch optimistically increments display count, syncs when connected.

**Complications:**
1. Timer complication (circular): shows elapsed time text and a small progress ring (progress toward targetHours).
2. Water complication (circular): shows water count text and a progress ring (count/target).
3. Complications update via `WidgetKit` timeline entries, refreshed when `applicationContext` changes.
4. Tapping a complication opens the corresponding Watch screen (timer or water).

**Phone-side sync triggers:**
- Fast started or ended (from phone or Watch command)
- Water intake changed (from phone or Watch command)
- App returns to foreground
- Timer screen becomes visible
- `applicationContext` is updated with latest `WatchState` on every state change

### Edge Cases

- **Phone not reachable:** Watch shows last known state. Commands are queued via WatchConnectivity's `transferUserInfo` (guaranteed delivery). When phone becomes available, queued commands execute and state syncs.
- **Start fast on Watch while fast already active on phone:** Phone rejects the command. Watch receives current state (showing active fast) and updates display. No error shown to user (just syncs to correct state).
- **End fast on Watch but fast was already ended on phone:** Phone returns null (no active fast). Watch syncs to "Not Fasting" state. No error.
- **Water logged on both Watch and phone simultaneously:** Both increment independently. Next state sync resolves to the phone's authoritative count. Possible brief count discrepancy (Watch shows optimistic +1 then corrects).
- **Watch app not installed:** Feature is entirely on the Watch. Phone does not know or care if Watch app is installed. WatchConnectivity session activation is handled gracefully (no crash if no Watch).
- **watchOS version too old (< 10):** Watch app requires watchOS 10. If running older OS, app is not installable from the Watch App Store.
- **Multiple Watches paired:** WatchConnectivity handles this automatically (broadcasts to active Watch).
- **App killed on phone:** `applicationContext` persists across app launches. Watch retains last context. When phone relaunches, pending commands in `transferUserInfo` are delivered.
- **Watch loses Bluetooth connection:** Notifications and complications still show cached data. Commands queue until reconnection.
- **Module disabled on phone:** Watch state stops updating. Watch shows stale data. No crash.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Tapping "Log Water" on the Watch increments the phone's water count by 1 and updates the Watch display within 2 seconds.
- [ ] **AC-2:** With a fast active on the phone, opening the Watch app shows the correct elapsed time and fasting zone.
- [ ] **AC-3:** Starting a fast from the Watch creates an active fast on the phone, and the phone app shows the active timer.
- [ ] **AC-4:** Ending a fast from the Watch (with confirmation) ends the fast on the phone.
- [ ] **AC-5:** When the phone is not reachable, tapping "Log Water" shows optimistic increment and queues the command for delivery when connected.
- [ ] **AC-6:** Timer complication shows elapsed time and progress ring, updating as the fast progresses.
- [ ] **AC-7:** Water complication shows count/target and progress ring, updating when water is logged.
- [ ] **AC-8:** Tapping a complication opens the corresponding Watch screen.
- [ ] **AC-9:** Haptic confirmation fires on successful water log, fast start, and fast end.
- [ ] **AC-10:** The Watch timer screen correctly transitions between fasting zones as time passes (matches phone zone boundaries).

### Technical Criteria
- [ ] **TC-1:** `WatchState` message correctly serializes active fast state (protocol, startedAt, targetHours, zoneName, zoneColor) or null.
- [ ] **TC-2:** `WatchState` message correctly serializes water state (count, target).
- [ ] **TC-3:** `WatchCommand` for `logWater` triggers `incrementWaterIntake()` on the phone and returns updated state.
- [ ] **TC-4:** `WatchCommand` for `startFast` triggers `startFast()` with the specified protocol and returns updated state.
- [ ] **TC-5:** `WatchCommand` for `startFast` rejects gracefully if a fast is already active (returns current state, no crash).
- [ ] **TC-6:** `WatchCommand` for `endFast` triggers `endFast()` and returns updated state with activeFast: null.
- [ ] **TC-7:** Phone sends `applicationContext` on every relevant state change (fast start/end, water log).
- [ ] **TC-8:** Watch timer computes elapsed time locally from `startedAt` timestamp (no per-second phone sync).
- [ ] **TC-9:** Watch zone transitions match phone zone boundaries (4h, 8h, 12h, 18h, 24h).
- [ ] **TC-10:** WatchConnectivity session activates without crash when no Watch is paired.
- [ ] **TC-11:** Queued commands via `transferUserInfo` are delivered when phone becomes reachable.

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** The Watch must NOT have its own database. All data is authoritative on the phone.
- [ ] **NC-2:** Timer must NOT sync elapsed time from the phone every second. It must compute locally from startedAt.
- [ ] **NC-3:** Starting a fast from Watch when a fast is already active must NOT create a second fast or crash.
- [ ] **NC-4:** The phone app must NOT crash or show errors when no Watch is paired.
- [ ] **NC-5:** Watch complications must NOT show stale data when the fast has ended (must update via applicationContext).

## UI Specification

### Watch App (watchOS, native Swift)

**Timer Screen:**
- Background: black (watchOS standard)
- Zone color accent: maps from FASTING_ZONES colors (teal-family matching module accent `#14B8A6`)
- Elapsed time: large SF Pro Display, center-aligned, white
- Zone name: smaller text below time, in zone accent color
- Start/End button: full-width at bottom, teal accent background, white text
- Progress ring (thin): behind the time display, teal accent, shows progress toward targetHours

**Water Screen:**
- Background: black
- Count/target text: large, center-aligned ("5 / 8"), white with teal accent on count
- Progress ring: circular, teal accent fill, surrounding the count
- "Log Water" button: full-width at bottom, teal accent, droplet icon + "Log Water" text

**Complications (WidgetKit):**
- Circular family: abbreviated info (time or count + mini ring)
- Tint: module accent teal `#14B8A6`

### Mobile (Expo) - Changes

No new screens. Behind-the-scenes changes:
- WatchConnectivity bridge module (native Swift, exposed via expo-modules-core)
- State sync hook that sends `applicationContext` on relevant changes

### Web (Next.js)

No changes. Watch features are iOS-only.

### State Coverage

| State | What User Sees (Watch) | Trigger |
|-------|----------------------|---------|
| Syncing | "Syncing..." placeholder | First launch, phone not yet responding |
| Idle (no fast) | "Not Fasting", Start Fast button | No active fast on phone |
| Fasting | Elapsed time, zone name, End Fast button | Active fast on phone |
| Water (low) | Count/target with partial progress ring | Water count < target |
| Water (complete) | Full progress ring, "Goal met!" | Water count >= target |
| Disconnected | Last known state, commands queued | Phone not reachable |
| Error | Brief haptic error + state refresh | Conflicting command (e.g., start while active) |

## Test Requirements

### Unit Tests (modules/fast/src/__tests__/watch-sync.test.ts)
- [ ] `formatWatchState`: with active fast, produces correct WatchState with zone info
- [ ] `formatWatchState`: with no active fast, produces WatchState with activeFast: null
- [ ] `formatWatchState`: includes correct water count and target
- [ ] `handleWatchCommand(logWater)`: increments water count by 1 and returns updated state
- [ ] `handleWatchCommand(startFast)`: creates fast with correct protocol and returns updated state
- [ ] `handleWatchCommand(startFast)`: returns error response when fast already active
- [ ] `handleWatchCommand(endFast)`: ends fast and returns state with activeFast: null
- [ ] `handleWatchCommand(endFast)`: returns current state (no error) when no fast active
- [ ] `handleWatchCommand(requestState)`: returns current state without mutations
- [ ] `mapZoneToWatchColor`: maps each fasting zone ID to a color string
- [ ] `mapZoneToWatchColor`: returns default color for unknown zone ID

### Integration Tests
- [ ] Full flow: format state with active fast and water, verify all fields populate correctly
- [ ] Command flow: handle logWater command, verify water count incremented in database
- [ ] Command flow: handle startFast command, verify active fast created in database
- [ ] Rejection flow: handle startFast when fast active, verify no new fast created and error returned

### QA Verification Script

1. Build the app with expo-dev-client (not Expo Go). Install on iPhone paired with Apple Watch.
2. Open MyFast on the iPhone. Verify no crashes related to WatchConnectivity.
3. Open the MyFast Watch app. Verify it shows "Not Fasting" with a "Start Fast" button. -- Corresponds to AC-2 (idle state).
4. On the Watch, tap "Start Fast". Verify haptic confirmation and timer starts showing elapsed time. -- Corresponds to AC-3, AC-9.
5. Open the iPhone app. Verify the timer screen shows the same active fast with matching timing. -- Corresponds to AC-3.
6. Wait for zone transitions (or start a fast with a time in the past for testing). Verify Watch transitions between zones at the same boundaries as the phone. -- Corresponds to AC-10, TC-9.
7. On the Watch, scroll to the Water screen. Verify it shows current count and target. -- Water screen.
8. Tap "Log Water" on the Watch. Verify count increments, haptic fires, and the phone's water count also updates within 2 seconds. -- Corresponds to AC-1, AC-9.
9. On the Watch, tap "End Fast". Verify confirmation prompt appears. Confirm. Verify fast ends and Watch shows "Not Fasting". -- Corresponds to AC-4.
10. Check the phone app. Verify fast is ended with correct duration and hit_target. -- Corresponds to AC-4.
11. Put the phone in airplane mode (simulate disconnect). On the Watch, tap "Log Water". Verify optimistic count increment on Watch. -- Corresponds to AC-5.
12. Take the phone out of airplane mode. Verify the phone's water count updates to match (queued command delivered). -- Corresponds to AC-5, TC-11.
13. Add Timer and Water complications to the watch face. Start a fast. Verify timer complication shows elapsed time and progress ring. -- Corresponds to AC-6.
14. Log water. Verify water complication updates count and progress ring. -- Corresponds to AC-7.
15. Tap the timer complication. Verify it opens the Timer screen. -- Corresponds to AC-8.
16. Tap the water complication. Verify it opens the Water screen. -- Corresponds to AC-8.
17. On a phone with no Watch paired, open the app. Verify no crashes or errors related to WatchConnectivity. -- Corresponds to NC-4.
18. Try starting a fast from the Watch while a fast is already active (start on phone first). Verify Watch syncs to show the active fast without creating a duplicate. -- Corresponds to NC-3, TC-5.

## gstack Quality Gates

Based on this feature's Complexity Inverse score of 2 (Large):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- not applicable (Watch UI cannot be browser-tested). Manual QA on device required.

### Required for Complexity <= 2 (Large):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. Validate WatchConnectivity architecture, expo-dev-client build pipeline, native module bridge approach, and complication update strategy.

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- fast module has standalone counterpart
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- No watchOS app target exists in the Xcode project
- No WatchConnectivity code anywhere in the codebase
- Fasting timer and water logging work on phone only
- App runs via Expo Go (no native modules required)

### After This Work
- Native watchOS app target (`MyFastWatch/`) with Timer and Water screens
- WatchConnectivity bridge module exposing state sync and command handling to React Native
- Phone app sends `applicationContext` on every relevant state change
- Watch complications for timer and water progress
- expo-dev-client required for builds (Expo Go no longer sufficient for full feature set)
- `watch-sync.ts` engine in modules/fast/src/ for message formatting and command handling

### Files Changed

- `modules/fast/src/engines/watch-sync.ts` -- NEW: formatWatchState, handleWatchCommand, mapZoneToWatchColor
- `modules/fast/src/types.ts` -- Add WatchState interface, WatchCommand type union
- `modules/fast/src/index.ts` -- Re-export watch-sync functions
- `modules/fast/src/__tests__/watch-sync.test.ts` -- NEW: 11+ unit tests
- `apps/mobile/ios/MyFastWatch/MyFastWatchApp.swift` -- NEW: Watch app entry point
- `apps/mobile/ios/MyFastWatch/TimerView.swift` -- NEW: Timer screen (SwiftUI)
- `apps/mobile/ios/MyFastWatch/WaterView.swift` -- NEW: Water quick-log screen (SwiftUI)
- `apps/mobile/ios/MyFastWatch/ComplicationProvider.swift` -- NEW: WidgetKit complications
- `apps/mobile/ios/MyFastWatch/WatchSessionManager.swift` -- NEW: WatchConnectivity delegate
- `apps/mobile/modules/watch-bridge/` -- NEW: Expo native module bridging WatchConnectivity to JS
- `apps/mobile/hooks/use-watch-sync.ts` -- NEW: React hook for sending applicationContext on state changes
- `apps/mobile/app/(fast)/timer.tsx` -- Modify: integrate watch sync hook

### Known Limitations
- Watch app is iOS-only (no Android Wear OS support in MVP)
- Cannot use Expo Go for development after this feature (requires expo-dev-client)
- Watch app does not have its own database (phone is the single source of truth)
- No offline fast start on Watch (requires phone to create the database record; optimistic UI is display-only)
- Complications update on applicationContext change, not real-time (may lag by a few seconds)
- No custom watch face design (uses standard watchOS layout patterns)
- Watch cannot display historical fasts or stats (only current state)

### Context for Next Agent
- This is the most technically complex feature in the Fast module. It requires:
  1. A native watchOS app target added to the Xcode project (SwiftUI)
  2. An Expo native module bridge (via expo-modules-core) to expose WatchConnectivity to React Native
  3. expo-dev-client for all future builds
- The `watch-sync.ts` engine in modules/fast/src/ must be pure TypeScript (no native dependencies). It handles message formatting and command dispatch. The native Swift code on the Watch and the native bridge module handle the actual WatchConnectivity API calls.
- The Watch timer computes elapsed time LOCALLY from the `startedAt` timestamp. This is critical for performance (no per-second phone sync). The zone boundaries are hardcoded constants matching `zones.ts`, duplicated in Swift.
- WatchConnectivity has two communication channels: `applicationContext` (latest state, persists) and `sendMessage` (real-time, requires reachability). Use `applicationContext` for state updates (always delivered) and `sendMessage` for commands (with `transferUserInfo` fallback for guaranteed delivery).
- The complication update strategy uses WidgetKit `TimelineProvider`. When `applicationContext` changes, the Watch's `WatchSessionManager` calls `WidgetCenter.shared.reloadAllTimelines()`.
- Testing the Watch app requires a physical Apple Watch or the Xcode Watch simulator. It cannot be tested via Expo Go or Detox.
