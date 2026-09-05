# Feature Spec: HealthKit Integration

## Metadata
- **Module:** health
- **Priority Score:** 40 / 50 (S-Tier)
- **Scoring Breakdown:** Market 5 x3 + Switching 5 x3 + Complexity 1 x2 + CrossModule 5 x1 + PaidUser 3 x1
- **Sprint:** 5
- **Estimated CC Time:** 6-8 hours
- **Depends On:** none
- **Blocks:** Activity tracking, Sleep stage analysis, HRV tracking, Blood oxygen tracking, Readiness score, Multi-app aggregation

## Business Context

### Why This Feature Exists
HealthKit integration is the #1 ranked Health feature and #5 overall because it unlocks cross-module data flow for 5+ modules. Without it, users must manually enter heart rate, steps, sleep, and other vitals that their Apple Watch already collects. Every serious health app on iOS integrates with HealthKit. This is table-stakes for user retention -- users will not manually enter data their watch already has.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Apple Health | Yes | Free | Native OS, is the HealthKit provider |
| Google Fit | Yes | Free | Health Connect on Android, bidirectional sync |
| Bearable | Yes | Yes ($34.99/yr) | Read-only from HealthKit, auto-imports selected types |
| CareClinic | Yes | Yes ($9.99/mo) | HealthKit read for vitals, manual entry fallback |

### Target User
Anyone with an Apple Watch or compatible health device who wants their health data flowing into MyLife automatically. This eliminates the friction of manual entry for steps, heart rate, sleep, and other vitals, making the health module useful from day one without any data entry work.

## Technical Context

### Where This Lives in MyLife

```
modules/health/src/healthkit/adapter.ts         -- HealthKit read/write adapter (Expo)
modules/health/src/healthkit/types.ts           -- HealthKit data type mappings
modules/health/src/healthkit/sync.ts            -- Incremental sync engine (anchor-based)
modules/health/src/healthkit/permissions.ts     -- Permission request helpers
modules/health/src/db/crud.ts                   -- Extended: bulk insert for synced data
modules/health/src/settings/index.ts            -- Extended: sync toggle per data type
apps/mobile/app/(health)/health-sync-settings.tsx -- Sync settings UI
```

### Wireframe Position

```
Hub Dashboard
  └── MyHealth card
       └── Vault tab
            └── Health Sync Settings ← YOU ARE HERE (setup)
       └── Today tab
            └── Auto-populated vitals from HealthKit ← YOU ARE HERE (consumption)
       └── Vitals tab
            └── Charts with HealthKit-sourced data
```

### Data Model

No new tables required. HealthKit data flows into existing tables:

- `hl_vitals` -- heart_rate, resting_heart_rate, hrv, blood_oxygen, steps, active_energy, respiratory_rate, vo2_max (source='apple_health')
- `hl_sleep_sessions` -- sleep duration and stages (source='apple_health')
- `hl_sync_log` -- tracks last sync anchor per data type for incremental import

The `hl_sync_log` table already exists with the correct schema for cursor-based sync.

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter), existing hl_vitals and hl_sleep_sessions tables, hl_sync_log for cursor tracking, hl_settings for per-type toggles
- **External:** `expo-health` (Expo HealthKit module) for iOS, `react-native-health-connect` for Android (future). Requires iOS 15+ and HealthKit entitlement in app.json.
- **Cross-Module:** Workouts module can read exercise data. Nutrition module can read active energy for TDEE. Cycle module can read BBT. Fast module can read weight. Meds module can correlate vitals with medication adherence.

## Functional Requirements

### User Stories
1. As an Apple Watch user, I want MyHealth to automatically import my heart rate, steps, and sleep data so that I don't have to enter it manually.
2. As a privacy-conscious user, I want to choose exactly which health data types MyHealth can access so that I control what is shared.
3. As a user, I want synced data to appear on my Today dashboard and Vitals charts within seconds of opening the app.
4. As a user, I want to see which data came from HealthKit vs what I entered manually so I can trust the data source.

### Behavior Specification

**Initial setup:**
1. User navigates to MyHealth > Vault > Health Sync Settings (or prompted on first launch)
2. System checks if HealthKit is available on the device
3. If available, shows a list of data types with toggles:
   - Heart Rate (default: on)
   - Resting Heart Rate (default: on)
   - HRV (default: on)
   - Blood Oxygen (default: on)
   - Steps (default: on)
   - Active Energy (default: on)
   - Sleep (default: on)
   - Blood Pressure (default: off)
   - Body Temperature (default: off)
   - Respiratory Rate (default: off)
   - Weight (default: on)
4. User enables desired types and taps "Connect"
5. System requests HealthKit permissions for selected types via native iOS dialog
6. On approval, system performs initial sync (last 30 days of data)
7. Progress indicator shows import status
8. After initial sync, incremental sync runs on each app launch

**Incremental sync (background):**
1. On app foreground, system checks hl_sync_log for each enabled data type
2. For each type, queries HealthKit for new samples since last_anchor
3. Inserts new samples into hl_vitals or hl_sleep_sessions with source='apple_health'
4. Updates hl_sync_log with new anchor and timestamp
5. Sync is non-blocking; UI shows cached data immediately, then refreshes when sync completes

**Data display:**
1. Synced data appears in Vitals tab charts with a small HealthKit badge icon
2. Today tab shows latest synced values (e.g., "Steps: 8,432" with Apple Health source indicator)
3. Manual entries and HealthKit entries coexist; charts show both with source differentiation

**Disconnecting:**
1. User can disable individual data types or all sync from Health Sync Settings
2. Disabling does NOT delete previously synced data
3. User can tap "Remove Synced Data" to delete all source='apple_health' records (with confirmation)

### Edge Cases

- **HealthKit not available (iPad, older iOS):** Show "HealthKit is not available on this device" with graceful fallback to manual entry.
- **User denies permission:** Show "Permission denied" per data type. Allow re-requesting (opens iOS Settings).
- **Large initial sync (years of data):** Cap initial sync to 90 days. Show progress bar. Run in batches of 500 records.
- **Duplicate detection:** Use recorded_at + vital_type + source as dedup key. Skip records that already exist.
- **HealthKit data deleted externally:** MyLife retains its local copy. No retroactive deletion sync.
- **App killed during sync:** Anchor-based sync resumes from last checkpoint on next launch.
- **No Apple Watch (manual HealthKit entries):** Still works -- syncs any HealthKit data regardless of source device.
- **Android:** Show "Health Connect coming soon" placeholder. Do not crash.
- **Module disabled:** Sync stops. Data preserved. Re-enabling resumes sync.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Health Sync Settings screen shows toggles for all supported data types
- [ ] **AC-2:** Tapping "Connect" triggers the native iOS HealthKit permission dialog
- [ ] **AC-3:** After granting permission, initial sync imports last 30 days of data with progress indicator
- [ ] **AC-4:** Synced heart rate data appears in the Vitals tab chart within 5 seconds of sync completion
- [ ] **AC-5:** Synced step count appears on the Today dashboard with an Apple Health source badge
- [ ] **AC-6:** Sleep sessions from HealthKit appear in the sleep section with source='apple_health'
- [ ] **AC-7:** Disabling a data type stops future syncing for that type without deleting existing data
- [ ] **AC-8:** "Remove Synced Data" deletes all apple_health-sourced records after confirmation
- [ ] **AC-9:** On subsequent app launches, only new data since last sync is imported (incremental)
- [ ] **AC-10:** On devices without HealthKit, a clear message explains unavailability

### Technical Criteria
- [ ] **TC-1:** HealthKit adapter correctly maps HKQuantityType identifiers to VitalType enum values
- [ ] **TC-2:** Anchor-based sync uses hl_sync_log.last_anchor correctly for each data type
- [ ] **TC-3:** Bulk insert handles 500+ records per batch without blocking the UI thread
- [ ] **TC-4:** Duplicate detection prevents re-importing existing records
- [ ] **TC-5:** Initial sync caps at 90 days of historical data
- [ ] **TC-6:** Sync errors are logged to hl_sync_log.error_message without crashing the app
- [ ] **TC-7:** HealthKit background delivery observer is registered for real-time updates (when app is backgrounded)

### Negative Criteria
- [ ] **NC-1:** HealthKit data must NOT be written back to HealthKit without explicit user action
- [ ] **NC-2:** Sync must NOT block the main UI thread
- [ ] **NC-3:** Denied permissions must NOT prevent the rest of the app from functioning
- [ ] **NC-4:** HealthKit data must NOT be sent to any network endpoint

## UI Specification

### Mobile (Expo)

**Health Sync Settings screen:**
- Background: `#0A0A0F`
- Section header: "Apple Health" with Apple Health icon
- Toggle rows in glass cards (`rgba(255,255,255,0.04)`) with `rgba(255,255,255,0.10)` border
- Module accent `#10B981` for active toggles
- "Connect" button: full-width, `#10B981` accent fill
- Progress bar during initial sync: `#10B981` fill on `rgba(255,255,255,0.06)` track
- Source badge: small Apple Health icon in `rgba(240,240,245,0.65)` next to synced values

### Web (Next.js)
- HealthKit is iOS-only. Web shows: "Health data sync is available on mobile (iOS) only."
- Manually entered vitals still display on web.

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Not connected | Setup prompt with "Connect to Apple Health" | No sync enabled |
| Connecting | Native iOS permission dialog | User taps Connect |
| Syncing | Progress bar with record count | Initial or incremental sync |
| Connected | Toggle list with last sync time | Sync complete |
| Error | Error message per data type with retry | Sync failure |
| Unavailable | "HealthKit not available" message | Non-iOS or old iOS device |

## Test Requirements

### Unit Tests
- [ ] `mapHKTypeToVitalType`: maps HKQuantityTypeIdentifierHeartRate to 'heart_rate'
- [ ] `mapHKTypeToVitalType`: maps all 10 supported types correctly
- [ ] `bulkInsertVitals`: inserts batch of 100 records correctly
- [ ] `bulkInsertVitals`: skips duplicates (same recorded_at + vital_type + source)
- [ ] `getLastSyncAnchor`: returns null for never-synced type
- [ ] `updateSyncAnchor`: stores new anchor and timestamp
- [ ] `deleteSyncedData`: removes only source='apple_health' records
- [ ] `deleteSyncedData`: preserves manual entries
- [ ] `isSyncEnabled`: reads from hl_settings correctly per type

### Integration Tests
- [ ] Full flow: enable sync -> mock HealthKit response -> data appears in hl_vitals -> chart renders
- [ ] Incremental sync: sync once -> add new mock data -> sync again -> only new records inserted
- [ ] Error recovery: sync fails -> error logged -> retry succeeds

### QA Verification Script

1. Open the app on a physical iOS device with Apple Watch data
2. Navigate to MyHealth > Vault > Health Sync Settings
3. Verify: Toggle list appears for all supported data types -- corresponds to AC-1
4. Enable Heart Rate, Steps, Sleep
5. Tap "Connect"
6. Verify: iOS HealthKit permission dialog appears -- corresponds to AC-2
7. Grant all requested permissions
8. Verify: Progress indicator shows sync in progress -- corresponds to AC-3
9. Wait for sync to complete
10. Navigate to Vitals tab
11. Verify: Heart rate chart shows synced data points -- corresponds to AC-4
12. Navigate to Today tab
13. Verify: Step count displays with Apple Health source badge -- corresponds to AC-5
14. Check sleep section
15. Verify: HealthKit sleep sessions appear -- corresponds to AC-6
16. Return to Health Sync Settings
17. Disable Heart Rate toggle
18. Verify: Existing heart rate data remains visible but no new HR data syncs -- corresponds to AC-7
19. Tap "Remove Synced Data"
20. Confirm in dialog
21. Verify: All apple_health-sourced records are removed -- corresponds to AC-8
22. Re-enable and re-sync
23. Close and reopen the app
24. Verify: Only new data since last sync is imported -- corresponds to AC-9
25. Test on iPad (no HealthKit): verify unavailability message -- corresponds to AC-10

## gstack Quality Gates

Based on Complexity 1 (Inverse), this feature is "Complex" tier.

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states

### Required if Complexity <= 2 (Large/Complex):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. Fix issues found.

### Required if Complexity <= 1 (Complex/Massive):
- [ ] `/office-hours` (builder mode) -- validate approach before spec finalization

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- health has no standalone counterpart (skip)

## Handoff State

### Before This Work
Health module has hl_vitals and hl_sleep_sessions tables with source column supporting 'apple_health', but no actual HealthKit integration code. All data is manually entered. hl_sync_log table exists but is unused.

### After This Work
- HealthKit adapter reads 10+ data types from Apple Health
- Anchor-based incremental sync engine with cursor tracking in hl_sync_log
- Per-type toggle controls in hl_settings (already seeded)
- Health Sync Settings UI with connect/disconnect flow
- Bulk insert with dedup for high-volume data import
- Background delivery observer for real-time updates

### Files Changed
- `modules/health/src/healthkit/adapter.ts` -- New: HealthKit read adapter
- `modules/health/src/healthkit/types.ts` -- New: HK type mappings
- `modules/health/src/healthkit/sync.ts` -- New: Incremental sync engine
- `modules/health/src/healthkit/permissions.ts` -- New: Permission helpers
- `modules/health/src/db/crud.ts` -- Extended: bulk insert with dedup (not a new file)
- `modules/health/src/index.ts` -- Export healthkit functions
- `apps/mobile/app/(health)/health-sync-settings.tsx` -- Sync settings UI
- `apps/mobile/app.json` -- HealthKit entitlement

### Known Limitations
- iOS only (Android Health Connect is a separate future feature)
- No write-back to HealthKit (read-only)
- No background fetch (sync on app foreground only; background delivery is observer-based for when app wakes)
- Initial sync capped at 90 days
- No real-time streaming (poll-based on app launch)

### Context for Next Agent
- The hl_sync_log table already exists and uses data_type as primary key with last_anchor TEXT for HKQueryAnchor serialization
- hl_settings already has seed values for all healthSync.* toggles (see schema.ts SEED_SETTINGS)
- Use expo-health (Expo's official HealthKit module) not react-native-health (community)
- All HealthKit queries must run off the main thread; use Expo's background task API
- The source column in hl_vitals and hl_sleep_sessions already supports 'apple_health' in CHECK constraints
