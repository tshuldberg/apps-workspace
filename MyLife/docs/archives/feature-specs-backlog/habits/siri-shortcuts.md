# Feature Spec: Siri Shortcuts

## Metadata
- **Module:** habits
- **Priority Score:** 26 / 50 (B-Tier)
- **Scoring Breakdown:** Market 3 x3 + Switching 2 x3 + Complexity 3 x2 + CrossModule 3 x1 + PaidUser 2 x1
- **Sprint:** Sprint 3
- **Estimated CC Time:** 3-4 hours
- **Depends On:** HB-002 (Daily Check-In & Completion)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Streaks ($4.99 one-time, Apple Design Award winner) lists Siri Shortcuts as a headline feature. The ability to say "Hey Siri, log my meditation" and have a habit marked complete is a zero-friction completion method that dramatically increases daily engagement. It's especially valuable for habits completed during activities where the phone isn't in hand (driving, exercising, cooking). Apple's Shortcuts app enables automation workflows where habit completions can be part of "Good Morning" or "Good Night" routines. This is iOS-only but the iOS user base is the primary target for MyLife's premium tier.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Streaks | Yes | No ($4.99 one-time) | Deep Siri Shortcuts integration. "Complete [habit]", "Start [habit] timer." Shortcuts appear in Spotlight and Shortcuts app. |
| Habitify | Yes (partial) | Yes ($59.88/yr) | Basic Siri support for habit completion. Premium only. |
| Habitica | No | N/A | No Siri support. Web-first app. |
| Productive | Yes | Yes ($24/yr) | Siri shortcuts for marking habits. Premium tier. |
| Fabulous | No | N/A | No Siri integration. |

### Target User
iOS users who want hands-free habit completion, especially during routines (morning, workout, driving). Also Shortcuts power users who build automated morning/evening routines and want habit tracking integrated into those workflows. Migration path: Streaks user who loves Siri integration but wants more than 24 habits, or wants habit tracking integrated with budget, health, and other MyLife modules.

## Technical Context

### Where This Lives in MyLife

```
modules/habits/src/
  siri/
    engine.ts                     -- NEW: Intent handler logic, duplicate detection, response generation
    __tests__/engine.test.ts      -- NEW: Engine tests
  types.ts                        -- MODIFY: Add SiriShortcutConfig type
  index.ts                        -- MODIFY: Export siri engine + types
apps/mobile/
  ios/                            -- MODIFY: App Intents Swift module (native)
  app/(habits)/
    habit-detail.tsx              -- MODIFY: Add "Siri Shortcut" configuration section
```

Note: No web equivalent. Siri Shortcuts is iOS-only. Android may get Google Assistant integration in a future update.

### Wireframe Position

```
Hub Dashboard
  └── MyHabits card
       ├── Today tab
       │    └── [Habit card] -> [Habit Detail]
       │         └── Siri Shortcut section ← YOU ARE HERE
       ├── Habits tab
       ├── Stats tab
       └── Settings tab
```

### Data Model

No new database tables needed. Siri shortcuts are managed by the iOS system via the App Intents framework. The association between a habit and its Siri phrase is stored in the OS, not in the app's SQLite database.

The only app-side data is the shortcut configuration state, which can be derived from the system's registered intents.

### Dependencies
- **Internal:** `@mylife/habits` (completion recording, habit CRUD), `@mylife/db` (DatabaseAdapter for completion writes)
- **External:**
  - iOS App Intents framework (Swift, requires native module)
  - `expo-shortcuts` or custom Expo native module for bridging React Native to App Intents
  - Minimum iOS 16 (App Intents API)
- **Cross-Module:** None. Siri completion is a passthrough to the existing completion recording system.

## Functional Requirements

### User Stories
1. As an iOS user, I want to say "Hey Siri, log my meditation" to complete a habit hands-free.
2. As a Shortcuts power user, I want my habit completion to appear as an action in the Shortcuts app, so I can include it in automated routines.
3. As a user, I want Siri to confirm "Done. Meditation logged." after completing a habit via voice.
4. As a user, I want Siri to tell me "Already done for today" if I try to log a habit I already completed.

### Behavior Specification

**Setting up a Siri Shortcut:**
1. User navigates to a habit's detail screen.
2. "Siri Shortcut" section is visible (iOS only; hidden on Android/web).
3. User taps "Add Siri Shortcut."
4. System presents the Siri phrase recording sheet (native iOS UI).
5. User records a phrase: "Log my meditation."
6. Shortcut is registered with the system.
7. The habit detail screen shows the configured phrase with a "Remove Shortcut" option.

**Voice completion flow:**
1. User says "Hey Siri, log my meditation."
2. Siri activates the App Intent associated with this habit.
3. App Intent handler runs in the background:
   a. Looks up the habit by ID (embedded in the intent).
   b. Checks if the habit has already been completed today.
   c. If not completed: records a completion with `value = 1`, `completedAt = now`.
   d. If already completed: does not duplicate.
4. Siri responds:
   - Success: "Done. Meditation logged."
   - Already completed: "Already done for today."
   - Error: "Couldn't log that habit. Please try in the app."

**Shortcuts app integration:**
1. Each configured habit appears as an App Shortcut in the Shortcuts app.
2. Users can add it to automation workflows (e.g., "When I arrive home, log my evening walk").
3. The shortcut accepts no parameters (it completes the specific habit).

### Edge Cases

- **Habit deleted but shortcut exists:** Siri responds "This habit no longer exists. You can remove this shortcut in Settings." The orphaned shortcut persists in the system until the user manually removes it.
- **Siri not available:** Feature section hidden on devices without Siri (old devices, certain regions).
- **Habit is archived:** Shortcut still works (archived habits can still receive completions). This is intentional to avoid surprising the user.
- **App not running:** App Intents run in the background without launching the full app. This is a system-level capability.
- **Multiple habits with similar names:** Each shortcut is tied to a specific habit ID, not the name. No confusion.
- **Negative habit:** Siri completion records a standard completion. For negative habits, the user should use "I Slipped" in the app, not Siri.
- **Measurable habit:** Siri completion records a completion with `value = 1` (default). For specific values (e.g., "8 glasses of water"), a future update could add parameterized intents.
- **Timed habit:** Siri completion records a completion, not a timed session. Starting a timer via Siri is a future enhancement.
- **Android users:** Feature is hidden entirely. No error, no mention of Siri. Future: Google Assistant Routines.
- **iOS version < 16:** Feature hidden. App Intents requires iOS 16+.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** "Add Siri Shortcut" button appears on habit detail screen (iOS only)
- [ ] **AC-2:** Tapping the button opens the native Siri phrase recording sheet
- [ ] **AC-3:** After setup, configured phrase is displayed with a "Remove" option
- [ ] **AC-4:** Saying the phrase to Siri completes the habit
- [ ] **AC-5:** Siri confirms with "Done. [Habit name] logged."
- [ ] **AC-6:** Duplicate completion in the same day returns "Already done for today."
- [ ] **AC-7:** Shortcut appears in the Shortcuts app for automation
- [ ] **AC-8:** Feature is hidden on Android and web platforms

### Technical Criteria
- [ ] **TC-1:** `handleSiriCompletion(habitId, today)` returns correct response for new completion
- [ ] **TC-2:** `handleSiriCompletion(habitId, today)` returns "already_done" when habit is already completed
- [ ] **TC-3:** `handleSiriCompletion(habitId, today)` returns "not_found" for deleted habits
- [ ] **TC-4:** App Intent runs in the background without launching the full app
- [ ] **TC-5:** Completion recorded via Siri uses the same `recordCompletion` path as in-app completion
- [ ] **TC-6:** Engine function is pure (returns response type; caller handles DB write)

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Siri must NOT create duplicate completions for the same habit on the same day
- [ ] **NC-2:** Siri feature must NOT appear on Android or web
- [ ] **NC-3:** Siri must NOT log a habit with value = -1 (slip) -- that's app-only
- [ ] **NC-4:** Removing a Siri shortcut must NOT delete the habit or its data

## UI Specification

### Mobile (Expo) -- iOS Only

- Background: `#0A0A0F` (background token)
- Cards: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border
- Module accent: `#8B5CF6` (habits purple)
- Siri button: system-provided `INUIAddVoiceShortcutButton` style (native iOS button)
- Configured phrase: monospace text in glass card

Layout (on Habit Detail screen):
```
[Habit Detail Screen]

  [Habit Info Card]
  ...

  [Siri Shortcut Card]
  Siri Shortcut
  "Log my meditation"           [configured phrase]
  [Remove Shortcut]             [red text button]

  -- OR if not configured --

  [Siri Shortcut Card]
  Siri Shortcut
  [+ Add Siri Shortcut]         [system button]
```

### Web (Next.js)

Not applicable. Siri Shortcuts is iOS-only. The web habits page does not render any Siri-related UI.

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Not configured | "Add Siri Shortcut" button | No shortcut set for this habit |
| Configured | Phrase displayed + Remove button | Shortcut registered |
| Hidden (Android) | Section not rendered | Platform is Android |
| Hidden (web) | Section not rendered | Platform is web |
| Hidden (old iOS) | Section not rendered | iOS version < 16 |

## Test Requirements

### Unit Tests
- [ ] `handleSiriCompletion`: valid habit, not completed today -> returns "completed" with habit name
- [ ] `handleSiriCompletion`: valid habit, already completed today -> returns "already_done"
- [ ] `handleSiriCompletion`: deleted habit (not found) -> returns "not_found"
- [ ] `handleSiriCompletion`: archived habit -> returns "completed" (archived habits can be completed)
- [ ] `generateSiriResponse`: "completed" -> "Done. Meditation logged."
- [ ] `generateSiriResponse`: "already_done" -> "Already done for today."
- [ ] `generateSiriResponse`: "not_found" -> "This habit no longer exists."
- [ ] `isPlatformSupported`: iOS 16+ -> true
- [ ] `isPlatformSupported`: iOS 15 -> false
- [ ] `isPlatformSupported`: Android -> false

### Integration Tests
- [ ] Full flow: configure shortcut -> invoke intent -> completion recorded -> streak updates
- [ ] Duplicate flow: complete via Siri -> invoke again -> "already done" response
- [ ] Delete flow: delete habit -> invoke Siri -> "not found" response

### QA Verification Script

1. Open the app on iOS (requires physical device or simulator with Siri)
2. Navigate to MyHabits > Habits tab
3. Create a standard habit "Meditation"
4. Navigate to Meditation detail screen
5. Verify: "Siri Shortcut" section is visible -- AC-1
6. Tap "Add Siri Shortcut"
7. Verify: Native Siri phrase recording sheet appears -- AC-2
8. Record phrase "Log my meditation"
9. Verify: Phrase displayed in the Siri section -- AC-3
10. Activate Siri, say "Log my meditation"
11. Verify: Siri confirms "Done. Meditation logged." -- AC-4, AC-5
12. Say "Log my meditation" again
13. Verify: Siri says "Already done for today." -- AC-6
14. Open Shortcuts app
15. Verify: "Log my meditation" appears as available shortcut -- AC-7
16. Open app on Android (or check web)
17. Verify: No Siri section visible -- AC-8

## gstack Quality Gates

Based on Complexity score 3 (Medium), these gates are required:

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- verify Siri section on habit detail, test add/remove flow

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Habit completions work via in-app tap. No voice/Siri integration.
- No App Intents, no Shortcuts app integration, no hands-free completion.
- Timed sessions and negative habits have no Siri path.

### After This Work
- New engine: `modules/habits/src/siri/engine.ts` with intent handler logic and response generation.
- Native module: `apps/mobile/ios/` App Intents Swift code bridged to React Native.
- Modified: Habit detail screen with Siri Shortcut configuration section.
- iOS habits appear in the Shortcuts app as automatable actions.

### Files Changed
- `modules/habits/src/siri/engine.ts` -- NEW: Siri intent handler logic
- `modules/habits/src/siri/__tests__/engine.test.ts` -- NEW: Engine tests
- `modules/habits/src/types.ts` -- MODIFY: Add SiriCompletionResult type
- `modules/habits/src/index.ts` -- MODIFY: Export siri engine + types
- `apps/mobile/ios/[NativeModule]` -- NEW: App Intents Swift module
- `apps/mobile/app/(habits)/habit-detail.tsx` -- MODIFY: Add Siri Shortcut section

### Known Limitations
- **iOS only.** No Android Google Assistant support in V1. Future enhancement.
- **Standard completion only.** Siri cannot start a timed session or log a specific measurement value. It records completion with value = 1.
- **No parameterized intents.** Can't say "Log 8 glasses of water." Only "Log my water intake."
- **Orphaned shortcuts.** If a habit is deleted, the Siri shortcut persists in the system until the user manually removes it. The intent handler returns a "not found" message.
- **No Siri Suggestions.** The app does not proactively suggest shortcuts based on usage patterns. Users must manually configure each shortcut.

### Context for Next Agent
- This feature requires native Swift code for App Intents. It cannot be done purely in React Native. The `expo-shortcuts` library may provide a bridge, but verify its App Intents support. If insufficient, a custom Expo native module is needed.
- The intent handler receives a habit ID (embedded when the shortcut is created). It calls the same `recordCompletion` function used by the in-app completion flow.
- The "already completed today" check uses `getCompletionsForDate(db, habitId, todayString)`. If the result is non-empty, return "already_done."
- The engine module (`engine.ts`) contains the pure logic. The native Swift module handles the App Intents registration and calls the engine via the React Native bridge.
- The Siri section on the habit detail screen should check `Platform.OS === 'ios'` and `parseInt(Platform.Version) >= 16` before rendering.
