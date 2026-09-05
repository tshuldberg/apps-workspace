# Feature Spec: HealthKit Integration

## Metadata
- **Module:** health
- **Priority Score:** 43 / 50 (S-Tier)
- **Scoring Breakdown:** Market 5 x3 + Switching 5 x3 + Complexity 2 x2 + CrossModule 5 x1 + PaidUser 4 x1
- **Sprint:** Sprint 1
- **Estimated CC Time:** 3-4 hours
- **Depends On:** none (health module schema already supports apple_health source)
- **Blocks:** Sleep stage analysis (P1), Heart rate during sleep (P1), Blood oxygen tracking (P1), HRV tracking (P1), Activity tracking (P1), Workouts HealthKit sync, Habits HealthKit auto-tracking, Fast HealthKit sync

## Business Context

### Why This Feature Exists
HealthKit integration is the single most impactful P0 gap across the entire Health module. Every major health and fitness app on iOS reads from Apple Health. Without this, MyLife users must manually enter steps, heart rate, sleep, and workout data that their Apple Watch or iPhone is already collecting automatically. This creates friction that drives users to competitors and makes MyLife feel incomplete next to Apple Health's native ecosystem. It also unlocks cross-module value: steps feed into habits, workouts sync bidirectionally, and sleep data enriches mood correlations.

### Competitor Landscape
Every serious health/fitness app on iOS integrates with HealthKit. It is table stakes for the category.

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Apple Health | Yes (native) | No (free) | The source of truth. All data originates here. |
| Bearable | Yes | No | Reads steps, sleep, heart rate. Free tier. Correlation with symptoms. |
| CareClinic | Yes | No | Reads vitals, sleep, activity. Includes in clinical reports. |
| Google Fit | N/A (Android) | No | Uses Health Connect on Android. Cross-platform via API. |
| Flo | Yes | No | Reads cycle, activity, weight. Feeds into fertility predictions. |
| Zero (fasting) | Yes | No | Reads weight, writes fasting sessions. Background sync. |
| Streaks (habits) | Yes | No | Apple Design Award winner. Deep HealthKit for auto-tracking habits. |

### Target User
Any iOS user who wears an Apple Watch or uses an iPhone with Health data. This is 100M+ Apple Watch users globally. The migration path: "You already have months of health data on your phone. MyLife imports it and gives you a unified dashboard with correlations no single-purpose app can offer."

## Technical Context

### Where This Lives in MyLife

```
modules/health/src/
  healthkit/
    permissions.ts          -- Permission request helpers and type mappings
    sync-service.ts         -- Orchestrates data pull from HealthKit into SQLite
    data-mappers.ts         -- Transforms HKSample types to hl_vitals/hl_sleep_sessions rows
    background-task.ts      -- Expo background fetch registration for periodic sync
    types.ts                -- HealthKit-specific TypeScript types
    index.ts                -- Barrel export
apps/mobile/app/(health)/
  health-sync-settings.tsx  -- Settings screen for toggling per-type sync
  (existing screens)        -- Today, Vitals, Insights screens show HealthKit data
packages/module-registry/   -- No changes (health module already registered)
```

### Wireframe Position

```
Hub Dashboard
  └── MyHealth card
       ├── Today tab            ← Shows HealthKit-sourced vitals inline
       ├── Vitals tab           ← HealthKit data appears with "apple_health" source badge
       ├── Insights tab         ← Correlations use HealthKit data
       └── Vault tab
            └── Health Sync     ← Permission management + per-type toggles
```

### Data Model
No new tables needed. The existing schema already supports HealthKit data:

```sql
-- Already exists: hl_vitals with source = 'apple_health'
-- Already exists: hl_sleep_sessions with source = 'apple_health'
-- Already exists: hl_sync_log for cursor tracking

-- hl_vitals.source CHECK constraint already includes 'apple_health'
-- hl_sleep_sessions.source CHECK constraint already includes 'apple_health'

-- hl_sync_log tracks incremental sync cursors:
--   data_type TEXT PRIMARY KEY (e.g., 'steps', 'heart_rate', 'sleep')
--   last_sync_at TEXT NOT NULL
--   last_anchor TEXT            (HealthKit anchor for incremental queries)
--   records_synced INTEGER
--   error_message TEXT
```

The `hl_settings` table already has per-type sync toggles via `isHealthSyncEnabled()` / `setHealthSyncToggle()`.

### Dependencies
- **Internal:** `@mylife/health` (vitals CRUD, sleep CRUD, sync log, settings), `@mylife/db` (DatabaseAdapter)
- **External:** `expo-health` (Expo wrapper for Apple HealthKit, maintained by Expo team) or `react-native-health` (community library, more mature). Recommendation: evaluate both, prefer `expo-health` if it covers our read types since it follows Expo conventions. Fall back to `react-native-health` if `expo-health` lacks coverage.
- **Cross-Module:**
  - **Workouts** (`@mylife/workouts`): HealthKit workout sessions can feed into workouts module (future, not this spec)
  - **Habits** (`@mylife/habits`): Steps data can auto-complete step-based habits (future)
  - **Mood** (via `@mylife/meds` correlation engine): Heart rate, HRV, and sleep quality feed into mood-health correlations
  - **Fast** (`@mylife/fast`): Weight readings from HealthKit (future)

## Functional Requirements

### User Stories
1. As an iPhone user, I want to import my step counts from Apple Health so that I see accurate daily activity without manual logging.
2. As an Apple Watch wearer, I want my heart rate, HRV, and blood oxygen readings to automatically appear in MyHealth so that I have a complete vitals history.
3. As someone who tracks sleep with Apple Watch, I want my sleep sessions imported into MyHealth so that I can see sleep quality scores and trends alongside my other health data.
4. As a privacy-conscious user, I want to choose exactly which HealthKit data types MyLife can read so that I stay in control of my data.
5. As a returning user, I want new HealthKit data to sync automatically in the background so that my dashboard is always current without opening the app.

### Behavior Specification

**First-time setup (permission request):**
1. User opens MyHealth module and navigates to Vault > Health Sync
2. User sees a card explaining what data MyLife can import: Steps, Heart Rate, Resting Heart Rate, HRV, Blood Oxygen, Sleep, Active Energy, Workouts
3. User taps "Connect Apple Health"
4. iOS presents the native HealthKit permission sheet listing all requested read types
5. User toggles individual data types on/off and taps "Allow"
6. MyLife receives the permission result
7. If any permission granted: trigger initial sync, show progress indicator
8. If all permissions denied: show friendly message, no error. User can re-request later.
9. After initial sync completes, user returns to Health Sync screen showing per-type toggles and last sync timestamps

**Incremental sync (foreground):**
1. User opens MyHealth module
2. App checks last sync timestamp per data type from `hl_sync_log`
3. For each enabled type where last sync > 15 minutes ago, query HealthKit for new samples since last anchor
4. Transform samples to `hl_vitals` or `hl_sleep_sessions` rows with `source = 'apple_health'`
5. Bulk insert into SQLite, update `hl_sync_log` with new anchor and timestamp
6. UI refreshes to show new data

**Background sync:**
1. Register an Expo background fetch task (`expo-task-manager`)
2. iOS wakes the app periodically (system-determined, typically every 15-30 minutes)
3. Task queries HealthKit for new samples since last anchor for all enabled types
4. Inserts into SQLite, updates sync log
5. No UI update needed (app may not be visible)

**Permission management (ongoing):**
1. User can toggle individual data types on/off in Health Sync settings
2. Toggling off a type stops syncing that type but does NOT delete already-imported data
3. User can tap "Sync Now" to force an immediate sync of all enabled types
4. User can tap "Disconnect Apple Health" to disable all sync and clear sync log cursors
5. If user revokes HealthKit permissions in iOS Settings, next sync attempt detects the revocation and updates the UI to show "Permission revoked" per type

### Edge Cases

- **HealthKit not available:** iPad-only users or devices without HealthKit. Show "Apple Health is not available on this device" with explanation. Hide the Connect button.
- **Partial permissions:** User grants steps but denies heart rate. Sync only the granted types. Show per-type status (enabled/disabled/denied).
- **Permission revoked externally:** User goes to iOS Settings > Privacy > Health and removes MyLife access. Next sync attempt gets authorization status "not determined" or "sharing denied". Update UI and stop syncing that type.
- **Massive initial import:** User has 2+ years of step data (730+ daily records, ~26,000+ hourly samples). Batch import in chunks of 500 records. Show progress bar. Don't block UI thread.
- **Duplicate data:** HealthKit may return overlapping samples on incremental sync. Use the HealthKit anchor-based query to avoid duplicates. If duplicates slip through, the `recorded_at + vital_type + source` combination provides a natural dedup key; UPSERT or skip on conflict.
- **No HealthKit data:** User grants permission but has no data (new Apple Watch, no steps logged). Show "No data found yet. Once your Apple Watch or iPhone records health data, it will appear here."
- **Module disabled:** If user disables the health module, background sync task should unregister. Re-enabling should re-register if permissions are still granted.
- **App killed/force-quit:** Background fetch does not run while force-quit on iOS. This is expected iOS behavior. Data syncs on next app launch.
- **Clock/timezone changes:** HealthKit samples use UTC internally. All `recorded_at` values stored as ISO 8601 UTC strings.
- **HealthKit data deletion:** If user deletes a sample in Apple Health, our sync does not retroactively delete the local copy. This is intentional (privacy-first: your data stays until you delete it in MyLife).

## Acceptance Criteria

**These are the definitive checks that prove this feature works. A QA tester will verify each one. Every criterion must be independently testable.**

### User Experience Criteria
- [ ] **AC-1:** Tapping "Connect Apple Health" presents the iOS native HealthKit permission sheet
- [ ] **AC-2:** After granting step permission, step counts appear in the Today and Vitals tabs within 10 seconds
- [ ] **AC-3:** After granting sleep permission, sleep sessions appear with quality scores computed
- [ ] **AC-4:** After granting heart rate permission, heart rate readings show with timestamps and source badge
- [ ] **AC-5:** Health Sync settings screen shows per-type toggle with last sync time for each enabled type
- [ ] **AC-6:** Toggling off a type stops new data from importing but existing data remains visible
- [ ] **AC-7:** "Sync Now" button triggers immediate sync and updates the last sync timestamp
- [ ] **AC-8:** "Disconnect Apple Health" stops all sync and clears the connection state
- [ ] **AC-9:** On a device without HealthKit (e.g., iPad), the Connect button is hidden and a message explains why
- [ ] **AC-10:** Initial import of large datasets (1000+ samples) shows a progress indicator and does not freeze the UI
- [ ] **AC-11:** After force-quitting and reopening the app, HealthKit data syncs on launch without user action

### Technical Criteria
- [ ] **TC-1:** HealthKit data is stored in `hl_vitals` with `source = 'apple_health'` and correct vital_type mapping
- [ ] **TC-2:** Sleep sessions are stored in `hl_sleep_sessions` with `source = 'apple_health'` and sleep stage breakdown populated
- [ ] **TC-3:** `hl_sync_log` records the HealthKit anchor per data type, enabling incremental-only queries
- [ ] **TC-4:** Background fetch task registers successfully and runs when iOS schedules it
- [ ] **TC-5:** Sync processes 500+ records per type in under 5 seconds
- [ ] **TC-6:** No duplicate records created when sync runs multiple times with overlapping time ranges
- [ ] **TC-7:** All timestamps stored as ISO 8601 UTC strings regardless of device timezone

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** MyLife must NOT write any data to HealthKit (read-only in this phase)
- [ ] **NC-2:** HealthKit data must NOT leave the device (no network calls with health data)
- [ ] **NC-3:** Revoking HealthKit permission must NOT delete already-imported data from SQLite
- [ ] **NC-4:** HealthKit sync must NOT block the UI thread or cause frame drops
- [ ] **NC-5:** Background sync must NOT wake the device or cause battery drain beyond iOS system defaults
- [ ] **NC-6:** Health module disable must NOT leave orphaned background tasks running

## UI Specification

### Mobile (Expo)

**Health Sync Settings screen** (`apps/mobile/app/(health)/health-sync-settings.tsx`):

- Background: `#0A0A0F` (background token)
- Cards: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border
- Module accent: `#10B981` (emerald, health module)

Layout:
```
[Header: "Health Sync"]

[Connection card -- glass strong]
  Apple Health                     [Connected badge / Connect button]
  Last synced: 2 minutes ago

[Per-type toggles -- glass card list]
  Steps                            [toggle: on/off]
  Heart Rate                       [toggle: on/off]
  Resting Heart Rate               [toggle: on/off]
  Heart Rate Variability           [toggle: on/off]
  Blood Oxygen                     [toggle: on/off]
  Sleep                            [toggle: on/off]
  Active Energy                    [toggle: on/off]

[Action buttons]
  [Sync Now -- accent button]
  [Disconnect -- ghost danger button]

[Privacy note -- text-tertiary, caption]
  "All health data stays on your device. MyLife never sends your health data to any server."
```

**Today tab** shows HealthKit-sourced data inline:
- Step count card with daily total and "from Apple Health" caption
- Heart rate latest reading with timestamp
- Sleep summary card (if sleep data synced)

**Vitals tab** shows HealthKit entries with a small Apple Health badge icon next to the source.

### Web (Next.js)

HealthKit is iOS-only. The web UI should:
- Show a "Connect on iOS" card in the Health Sync settings area
- Display already-synced HealthKit data (it's in SQLite, which web reads too) with the apple_health source badge
- No sync controls on web (syncing only happens on iOS)

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton cards matching Today layout | Initial data fetch |
| Empty (no permission) | Glass card with Apple Health logo, "Connect Apple Health to see your vitals, steps, and sleep" + Connect button | First visit, no permission granted |
| Empty (permission granted, no data) | Glass card with "No data found yet. Once your Apple Watch or iPhone records health data, it will appear here." | Permission granted but HealthKit empty |
| Error (sync failed) | Glass card with "Sync encountered an issue" + retry button. Per-type error shown in sync log. | HealthKit query fails |
| Success | Vitals, steps, sleep data rendered with source badges | Data synced |
| Partial (some types synced) | Mixed: some vital cards show data, others show "not connected" or "permission denied" | User granted partial permissions |
| Syncing | "Syncing..." label with subtle spinner on the Sync Now button | Sync in progress |

## Test Requirements

### Unit Tests
- [ ] `data-mappers.ts`: transforms HKQuantitySample to LogVitalInput correctly for each vital type
- [ ] `data-mappers.ts`: transforms HKCategorySample (sleep) to LogSleepInput with stage breakdown
- [ ] `data-mappers.ts`: handles nil/undefined sample values gracefully
- [ ] `data-mappers.ts`: maps HealthKit units to MyHealth units correctly (bpm, ms, %, kcal)
- [ ] `permissions.ts`: returns correct HKQuantityTypeIdentifier for each VitalType
- [ ] `permissions.ts`: detects HealthKit availability (returns false on iPad/Simulator)
- [ ] `sync-service.ts`: respects per-type toggle settings (skips disabled types)
- [ ] `sync-service.ts`: updates sync log with anchor after successful sync
- [ ] `sync-service.ts`: handles empty result set without errors
- [ ] `sync-service.ts`: chunks large datasets into batches of 500
- [ ] `sync-service.ts`: does not create duplicate vitals for overlapping sync windows

### Integration Tests
- [ ] Full flow: grant permission -> initial sync -> data appears in hl_vitals -> UI shows values
- [ ] Error flow: HealthKit query fails -> sync log records error -> UI shows retry
- [ ] Toggle flow: disable heart_rate sync -> sync runs -> heart_rate not queried, other types still sync
- [ ] Disconnect flow: disconnect -> sync log cleared -> background task unregistered -> data preserved

### QA Verification Script

1. Open the app on a physical iPhone with Apple Watch paired
2. Navigate to MyHealth > Vault > Health Sync
3. Verify: "Connect Apple Health" button visible -- corresponds to AC-1
4. Tap "Connect Apple Health"
5. Verify: iOS HealthKit permission sheet appears with all read types listed
6. Grant all permissions, tap Allow
7. Verify: Progress indicator appears, then sync completes within 30 seconds -- AC-10
8. Navigate to Today tab
9. Verify: Step count card shows today's steps with "from Apple Health" label -- AC-2
10. Verify: Heart rate latest reading visible with timestamp -- AC-4
11. Navigate to Vitals tab
12. Verify: Heart rate, HRV, SpO2 entries shown with apple_health source badge
13. Go back to Health Sync settings
14. Verify: Per-type toggles shown, each with "Last synced: X ago" -- AC-5
15. Toggle off "Heart Rate"
16. Tap "Sync Now" -- AC-7
17. Verify: Sync runs, heart rate NOT updated, steps updated
18. Navigate to Vitals tab
19. Verify: Old heart rate data still visible (not deleted) -- AC-6
20. Go back to Health Sync, tap "Disconnect Apple Health" -- AC-8
21. Verify: All toggles reset, connection status shows disconnected
22. Navigate to Vitals tab
23. Verify: Previously synced data still visible -- NC-3
24. Go to iOS Settings > Privacy > Health > MyLife and revoke all permissions
25. Return to app, navigate to Health Sync
26. Verify: Connection shows revoked state, per-type status updated
27. Force-quit the app, wait 30 minutes, reopen
28. Navigate to Today tab
29. Verify: Background sync ran (if iOS scheduled it), step count current -- AC-11
30. Test on iPad or Simulator
31. Verify: Connect button hidden, "Apple Health is not available" message shown -- AC-9

## gstack Quality Gates

Based on Complexity score 2 (Large), these gates are required:

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the Health Sync settings screen, verify all states
- [ ] Batch QA: after 5 features in health module, run `/qa` on the module URL

### Required if Complexity <= 2 (Large/Complex):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. Fix issues found.

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for sync-service edge cases

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- health module is hub-only, so N/A for standalone parity
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Health module has `hl_vitals` table with `apple_health` source support, `hl_sleep_sessions` with `apple_health` source, `hl_sync_log` for cursor tracking, and per-type sync toggles in `hl_settings`. All schema is ready.
- No HealthKit library is installed. No `healthkit/` subdirectory exists in the health module.
- The health-sync-settings screen is defined in the module navigation but not yet built.
- Health module has 3 test files covering schema, business logic, and definition contract.

### After This Work
- `modules/health/src/healthkit/` contains permission helpers, sync service, data mappers, background task registration, and types.
- `apps/mobile/app/(health)/health-sync-settings.tsx` renders the sync management screen.
- Today and Vitals tabs display HealthKit-sourced data with source badges.
- Background fetch task registered via `expo-task-manager`.
- `expo-health` (or `react-native-health`) added as a dependency to `apps/mobile/package.json`.
- New tests cover data mapping, sync logic, and permission handling.

### Files Changed
- `modules/health/src/healthkit/permissions.ts` -- HealthKit availability check, permission request, type mappings
- `modules/health/src/healthkit/sync-service.ts` -- Orchestrates incremental sync: query HealthKit, transform, bulk insert, update sync log
- `modules/health/src/healthkit/data-mappers.ts` -- HKSample to LogVitalInput/LogSleepInput transformations
- `modules/health/src/healthkit/background-task.ts` -- Expo background fetch task registration and handler
- `modules/health/src/healthkit/types.ts` -- HealthKit-specific type definitions
- `modules/health/src/healthkit/index.ts` -- Barrel export
- `modules/health/src/index.ts` -- Add healthkit re-exports
- `apps/mobile/app/(health)/health-sync-settings.tsx` -- Sync settings screen with permission management
- `apps/mobile/package.json` -- Add expo-health or react-native-health dependency
- `apps/mobile/app.json` -- Add HealthKit usage description strings (NSHealthShareUsageDescription)

### Known Limitations
- **Read-only:** This phase does not write to HealthKit (no workout export, no fasting session export). Write support is a separate future feature.
- **iOS only:** Android Health Connect integration is a separate feature (uses `react-native-health-connect`).
- **No real-time observer:** This implementation uses polling (foreground on app open + background fetch) rather than HealthKit observer queries. Observer queries add complexity and battery considerations. Polling with anchored queries provides near-real-time data for the use case.
- **No data deletion sync:** If a user deletes a HealthKit sample in Apple Health, the local copy in MyLife is not deleted. This is intentional for the privacy-first model.
- **No cross-module auto-wiring yet:** Steps feeding habits, workouts syncing bidirectionally, and weight feeding fast are all future features that depend on this foundation.

### Context for Next Agent
- The `hl_sync_log.last_anchor` column stores the HealthKit query anchor (an opaque value from HKAnchoredObjectQuery). This is critical for incremental sync. Never clear it unless disconnecting.
- `isHealthSyncEnabled(db, dataType)` and `setHealthSyncToggle(db, dataType, enabled)` already exist in `modules/health/src/settings/`. Use them; don't reinvent toggle storage.
- The `VitalSource` type in `modules/health/src/vitals/types.ts` already includes `'apple_health'`. No schema migration needed.
- Expo's background fetch has significant iOS limitations: minimum interval is 15 minutes, iOS controls actual frequency, and it doesn't run after force-quit. Document this in the UI so users understand.
- When evaluating `expo-health` vs `react-native-health`, check: (1) Does it support anchored queries? (2) Does it support sleep stage analysis (HKCategoryValueSleepAnalysis)? (3) Is it compatible with Expo SDK 52+?
