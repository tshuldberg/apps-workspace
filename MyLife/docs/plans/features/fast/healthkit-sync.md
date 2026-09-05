# Feature Spec: HealthKit Sync

## Metadata
- **Module:** fast
- **Priority Score:** 33 / 50 (A-Tier)
- **Scoring Breakdown:** Market [3] x3 + Switching [4] x3 + Complexity [2] x2 + CrossModule [4] x1 + PaidUser [4] x1
- **Sprint:** 5
- **Estimated CC Time:** 3-4 hours
- **Depends On:** Weight tracking (already implemented in ft_weight_entries)
- **Blocks:** none

## Business Context

### Why This Feature Exists
HealthKit sync is the highest-scored Fast feature (33/50) and the top cross-module enabler (CrossModule 4/5). Users who track weight in Apple Health are forced to double-enter data without this feature, creating friction that drives them to competitors like Zero ($69.99/yr) and Simple ($59.99/yr), both of which offer HealthKit integration. The bidirectional sync (read weight, write fasts) also makes MyFast data visible in the Health app's timeline, which is where health-conscious users expect to see a unified view. This feature scores high on PaidUser (4/5) because HealthKit integration is a hallmark premium feature that fasting apps gate behind subscriptions, while MyFast offers it free.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Zero | Yes | Yes ($69.99/yr) | Reads weight, writes fasting sessions to Health, shows activity during fasts |
| Simple | Yes | Yes ($59.99/yr) | Reads weight, writes fasting data, AI nutrition coaching tied to health data |
| Fastic | Partial | Yes ($59.99-79.99/yr) | Writes step data, limited Health integration |
| BodyFast | No | N/A | No HealthKit integration |

### Target User
iPhone-owning intermittent fasters (25-50) who already use Apple Health as their health data aggregator. Users of Zero ($69.99/yr) or Simple ($59.99/yr) who pay primarily because of HealthKit integration and would switch to a free app that offers the same capability. Also targets users of multiple MyLife modules (CrossModule 4/5): syncing weight from Health benefits MyFast, MyWorkouts, and MyHealth simultaneously.

## Technical Context

### Where This Lives in MyLife

```
modules/fast/src/
  engines/healthkit-sync.ts              -- NEW: weight import logic, fast export formatting
  types.ts                               -- Add WeightSource type, HealthKitSyncState
  db/schema.ts                           -- ALTER ft_weight_entries: add source column (migration v3)
  definition.ts                          -- Migration v3

apps/mobile/app/(fast)/
  settings.tsx                           -- Add Health section with toggles (modify existing)

apps/mobile/hooks/
  use-healthkit.ts                       -- NEW: React hook wrapping expo-health-connect APIs

apps/web/app/fast/settings/
  page.tsx                               -- Hide Health section on web (platform check)
```

### Wireframe Position

```
Hub Dashboard
  └── MyFast card
       └── Settings tab
            └── Health section ← YOU ARE HERE
                 ├── HealthKit Sync toggle (master)
                 ├── Read Weight from Health toggle
                 ├── Read Activity During Fasts toggle
                 └── Write Fasts to Health toggle
```

Also surfaces on the Timer screen during active fasts:
```
Timer tab
  └── Active fast display
       └── Activity Context Card ← Steps, calories, heart rate (ephemeral)
```

### Data Model

```sql
-- Migration v3: Add source column to ft_weight_entries
ALTER TABLE ft_weight_entries ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';

-- New settings keys (inserted via ft_settings, no schema change)
-- healthSyncEnabled: "false"
-- healthReadWeight: "false"
-- healthReadActivity: "false"
-- healthWriteFasts: "false"
-- healthLastSyncTimestamp: "" (ISO 8601)
```

The `source` column distinguishes manual weight entries from HealthKit-imported ones. Valid values: `"manual"` (default), `"healthkit"`. This is critical for the conflict resolution rule: manual entries always take precedence over HealthKit imports.

No new tables are needed. Activity data (steps, calories, heart rate) is read from HealthKit on demand and displayed ephemerally on the timer screen without persisting to SQLite.

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter), `@mylife/ui` (toggle components, glass cards), existing `ft_weight_entries` table and weight CRUD
- **External:** `expo-health-connect` (cross-platform HealthKit/Health Connect wrapper for Expo), `expo-dev-client` (required for native health APIs, cannot use Expo Go)
- **Cross-Module:** Weight data synced from HealthKit is stored in `ft_weight_entries` and could be shared with MyWorkouts and MyHealth modules via cross-module queries. Fasting sessions written to HealthKit are visible to any other Health-connected app.

## Functional Requirements

### User Stories
1. As a user who tracks my weight in Apple Health, I want MyFast to read my weight data from HealthKit, so that I do not have to log it in two places.
2. As a user who wants to correlate fasting with activity, I want to see my step count and calories burned alongside my fasting data, so that I can understand how fasting affects my activity.
3. As a user who completes fasts, I want my fasting sessions to appear in Apple Health, so that my health timeline is unified.
4. As a privacy-conscious user, I want granular control over what health data MyFast can read and write, so that I share only what I'm comfortable with.
5. As an Android user, I want the health feature to be hidden entirely, so I don't see broken or irrelevant options.

### Behavior Specification

**Enabling HealthKit sync:**
1. User navigates to MyFast > Settings > Health section.
2. User toggles "HealthKit Sync" on.
3. System triggers the iOS HealthKit authorization prompt requesting access to: weight (read), step count (read), active calories (read), heart rate (read), dietary energy (write).
4. If user grants at least one permission, the master toggle stays on and sub-toggles appear.
5. If user denies all permissions, a toast appears: "Health access denied. Enable in Settings > Privacy > Health." The toggle reverts to off.

**Sub-toggle behavior:**
- "Read Weight from Health": When enabled, triggers an immediate weight sync. Subsequent syncs run on app foreground and when the user taps "Sync Now".
- "Read Activity During Fasts": When enabled, the timer screen shows an Activity Context Card during active fasts with steps, calories, and heart rate.
- "Write Fasts to Health": When enabled, every completed fast is automatically written to HealthKit on `endFast`.

**Weight auto-import logic:**
1. On sync trigger (app foreground, manual "Sync Now", or toggle enable):
2. Query HealthKit for weight samples since `healthLastSyncTimestamp` (or last 30 days on first sync).
3. For each weight sample:
   a. Convert to user's preferred unit (lbs or kg).
   b. Check if an entry exists for that date in `ft_weight_entries`.
   c. If no entry: insert with `source = "healthkit"`.
   d. If entry exists and `source = "manual"`: do not overwrite (manual wins).
   e. If entry exists and `source = "healthkit"`: update with latest value.
4. Update `healthLastSyncTimestamp` in ft_settings.

**Fast write to HealthKit:**
1. When `endFast()` completes and returns a completed Fast:
2. If `healthSyncEnabled` AND `healthWriteFasts` are both "true":
3. Create a HealthKit dietary energy sample:
   - Start: `fast.startedAt`
   - End: `fast.endedAt`
   - Metadata: `{ protocol, target_hours, hit_target, app: "MyFast" }`
4. Write to HealthKit. If write fails, log silently (do not block fast completion).

**Activity context card (during active fast):**
1. When a fast is active and `healthReadActivity` is "true":
2. Query HealthKit for today's step count, active calories burned since fast start, and latest heart rate sample.
3. Display on the timer screen as an ephemeral card. Data is not stored in SQLite.
4. Refresh every 60 seconds while the timer screen is visible.

### Edge Cases

- **HealthKit not available (Android, web):** Health section is hidden entirely via platform check. No settings keys are modified.
- **HealthKit permission revoked after initial grant:** Sync fails silently. Sub-toggles show a warning icon with tooltip "Permission revoked. Re-enable in Settings > Privacy > Health."
- **Weight conflict (manual vs HealthKit for same date):** Manual entry always takes precedence. HealthKit value is silently discarded for that date.
- **No weight entries in HealthKit:** Sync completes with zero imports. No error shown.
- **User disables master toggle:** All sub-toggles turn off. Pending syncs are cancelled. No data is deleted from ft_weight_entries (previously imported weights remain).
- **Fast ends while offline/HealthKit unavailable:** Fast completes normally. HealthKit write is skipped. No retry queue (data is still in ft_fasts if user wants to manually reference it).
- **Multiple weight samples for same day in HealthKit:** Use the latest (most recent timestamp) sample for that date.
- **Very old HealthKit data (first sync with years of weight history):** Capped to last 30 days on first sync to avoid importing hundreds of entries.
- **expo-health-connect not installed (dev without native build):** Feature disabled at runtime with graceful fallback. No crash.
- **Module disabled:** Sync stops. Data preserved. Re-enabling resumes from last sync timestamp.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Toggling "HealthKit Sync" on triggers the iOS HealthKit authorization prompt with the correct data types (weight, steps, calories, heart rate read; dietary energy write).
- [ ] **AC-2:** After granting permissions, sub-toggles for Read Weight, Read Activity, and Write Fasts appear.
- [ ] **AC-3:** Enabling "Read Weight from Health" triggers an immediate sync that imports weight entries into the weight chart.
- [ ] **AC-4:** Imported weight entries appear in the weight chart alongside manually entered values, distinguishable by source.
- [ ] **AC-5:** Enabling "Write Fasts to Health" and completing a fast creates a dietary entry visible in the Apple Health app.
- [ ] **AC-6:** During an active fast with "Read Activity" enabled, the timer screen shows steps, calories, and heart rate in an Activity Context Card.
- [ ] **AC-7:** Tapping "Sync Now" triggers a manual weight sync and updates the "Last synced" timestamp.
- [ ] **AC-8:** On Android and web, the Health section is completely hidden in settings.

### Technical Criteria
- [ ] **TC-1:** Migration v3 adds `source TEXT NOT NULL DEFAULT 'manual'` column to ft_weight_entries without data loss.
- [ ] **TC-2:** Weight import logic correctly converts between lbs and kg (175 lbs = 79.4 kg, 80 kg = 176.4 lbs).
- [ ] **TC-3:** Weight import skips dates where a `source = "manual"` entry already exists.
- [ ] **TC-4:** Weight import updates existing `source = "healthkit"` entries with newer HealthKit values.
- [ ] **TC-5:** First sync queries HealthKit for the last 30 days. Subsequent syncs query from `healthLastSyncTimestamp`.
- [ ] **TC-6:** Fast write to HealthKit includes correct metadata (protocol, target_hours, hit_target).
- [ ] **TC-7:** Fast write failure does not block or revert `endFast()` completion.
- [ ] **TC-8:** Activity data is queried from HealthKit and displayed without persisting to SQLite.
- [ ] **TC-9:** All HealthKit operations are no-ops on Android and web (platform guard).
- [ ] **TC-10:** Settings keys (healthSyncEnabled, healthReadWeight, healthReadActivity, healthWriteFasts, healthLastSyncTimestamp) are read/written correctly via existing `getSetting`/`setSetting`.

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** HealthKit data must NOT be transmitted over the network. All reads/writes are local.
- [ ] **NC-2:** Manual weight entries must NOT be overwritten by HealthKit imports.
- [ ] **NC-3:** Disabling the master toggle must NOT delete previously imported weight data from ft_weight_entries.
- [ ] **NC-4:** HealthKit authorization must NOT be requested at app launch or module enable. Only when the user explicitly toggles HealthKit Sync on.
- [ ] **NC-5:** Activity data (steps, calories, heart rate) must NOT be persisted in the Fast module's database.

## UI Specification

### Mobile (Expo)

**Health Section in Settings:**
- Background: `#0A0A0F` (background token)
- Section card: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border
- Module accent: `#14B8A6` (teal, from definition.ts)
- Master toggle: "HealthKit Sync" with Apple Health icon
- Sub-toggles: indented under master, visible only when master is on
- "Last synced: [relative time]" in `textSecondary`
- "Sync Now" button: accent color outline, glass background
- Permission warning: amber icon + "Permission revoked" text when applicable

**Activity Context Card (Timer Screen):**
- Glass card below the timer ring during active fasts
- Three stat items inline: Steps (footprint icon), Calories (flame icon), Heart Rate (heart icon)
- Values in primary text, labels in `textSecondary`
- Refreshes every 60 seconds with subtle fade animation

### Web (Next.js)

- Health section is **hidden** on web (no HealthKit API available)
- Settings page shows all other settings without the Health section
- No placeholder or "coming soon" message (clean omission)

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Spinner on "Sync Now" button | Sync in progress |
| Empty (no HealthKit data) | "No weight data found in Apple Health" after sync | HealthKit has no weight samples |
| Error (permission denied) | Toast + warning icon on toggle | User denies HealthKit authorization |
| Error (sync failure) | Toast: "Could not sync with Health" + "Sync Now" retry | HealthKit query fails |
| Success | "Last synced: just now" + weight entries in chart | Sync completes with data |
| Hidden (non-iOS) | Health section not rendered | Android or web platform |

## Test Requirements

### Unit Tests (modules/fast/src/__tests__/healthkit-sync.test.ts)
- [ ] `convertWeight`: 175 lbs to kg = 79.4
- [ ] `convertWeight`: 80 kg to lbs = 176.4
- [ ] `shouldImportWeight`: returns true when no entry exists for date
- [ ] `shouldImportWeight`: returns false when manual entry exists for date
- [ ] `shouldImportWeight`: returns true when healthkit entry exists (update case)
- [ ] `formatFastForHealthKit`: produces correct sample structure with metadata
- [ ] `formatFastForHealthKit`: handles null notes gracefully
- [ ] `calculateSyncWindow`: returns 30-day window on first sync (no timestamp)
- [ ] `calculateSyncWindow`: returns window from last timestamp on subsequent syncs
- [ ] `isHealthKitAvailable`: returns false on Android/web platform
- [ ] `isHealthKitAvailable`: returns true on iOS with native module available
- [ ] `mergeWeightEntries`: multiple HealthKit samples for same day uses latest

### Integration Tests
- [ ] Full flow: enable sync, mock HealthKit returns 5 weight entries, verify 5 entries in ft_weight_entries with source="healthkit"
- [ ] Conflict flow: manual entry exists for 2026-03-15, HealthKit has entry for same date, verify manual entry preserved
- [ ] Write flow: complete a fast with healthWriteFasts enabled, verify HealthKit write called with correct parameters
- [ ] Disable flow: turn off master toggle, verify sub-toggles reset, no data deleted

### QA Verification Script

1. Open the app on an iOS device/simulator with Apple Health data available.
2. Navigate to MyFast > Settings. Verify the Health section is visible. -- Platform check.
3. Toggle "HealthKit Sync" on. Verify the iOS HealthKit authorization prompt appears. -- Corresponds to AC-1.
4. Grant all permissions. Verify sub-toggles appear (Read Weight, Read Activity, Write Fasts). -- Corresponds to AC-2.
5. Enable "Read Weight from Health". Verify sync starts (spinner) and weight entries appear in the weight chart. -- Corresponds to AC-3.
6. Open Apple Health app, verify the imported weight entries match (date and value). -- Corresponds to AC-4.
7. Manually log a weight entry in MyFast for today's date.
8. Add a different weight value in Apple Health for today.
9. Tap "Sync Now". Verify the manual entry is preserved, not overwritten. -- Corresponds to TC-3, NC-2.
10. Enable "Write Fasts to Health". Start and complete a 16:8 fast.
11. Open Apple Health app. Verify the fasting session appears as a dietary entry with correct times. -- Corresponds to AC-5, TC-6.
12. Enable "Read Activity During Fasts". Start a new fast.
13. Verify the Activity Context Card appears on the timer screen showing steps, calories, heart rate. -- Corresponds to AC-6.
14. Disable "HealthKit Sync" master toggle. Verify all sub-toggles disappear. Verify previously imported weights are still in the chart. -- Corresponds to NC-3.
15. Open the app on an Android device/simulator (or web). Verify the Health section is not visible in Settings. -- Corresponds to AC-8, TC-9.
16. Verify that starting and ending fasts on Android works without errors (no HealthKit calls attempted). -- Corresponds to TC-9.

## gstack Quality Gates

Based on this feature's Complexity Inverse score of 2 (Large):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to Settings, verify Health section visibility/toggling, verify Activity Context Card during active fast

### Required for Complexity <= 2 (Large):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. Validate expo-health-connect integration approach, migration safety, and platform guard strategy.

### Required if this feature contains business logic:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for `healthkit-sync.ts` (weight import logic, conversion, conflict resolution)

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- fast module has standalone counterpart
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Fast module has 10 tables, schema version 2
- ft_weight_entries has no `source` column (all entries are implicitly manual)
- ft_settings already seeds healthSyncEnabled, healthReadWeight, healthWriteFasts as "false"
- No HealthKit integration code exists anywhere in the module
- No expo-health-connect dependency in the project

### After This Work
- ft_weight_entries has `source TEXT NOT NULL DEFAULT 'manual'` column (migration v3)
- New engine file `healthkit-sync.ts` with weight import logic, fast export formatting, conversion utilities
- New mobile hook `use-healthkit.ts` wrapping expo-health-connect APIs
- Settings screen has a Health section (iOS only) with master toggle and sub-toggles
- Timer screen shows Activity Context Card during active fasts (iOS, when enabled)
- expo-health-connect added as a dependency to apps/mobile

### Files Changed

- `modules/fast/src/types.ts` -- Add WeightSource type ("manual" | "healthkit"), HealthKitSyncState interface
- `modules/fast/src/db/schema.ts` -- Add ALTER TABLE statement for source column
- `modules/fast/src/definition.ts` -- Add FAST_MIGRATION_V3, update schemaVersion to 3
- `modules/fast/src/engines/healthkit-sync.ts` -- NEW: convertWeight, shouldImportWeight, formatFastForHealthKit, calculateSyncWindow, mergeWeightEntries
- `modules/fast/src/index.ts` -- Re-export healthkit-sync engine functions
- `modules/fast/src/__tests__/healthkit-sync.test.ts` -- NEW: 12+ unit tests
- `apps/mobile/hooks/use-healthkit.ts` -- NEW: React hook for HealthKit read/write operations
- `apps/mobile/app/(fast)/settings.tsx` -- Add Health section with toggles (iOS-only render)
- `apps/mobile/app/(fast)/timer.tsx` -- Add Activity Context Card (conditional on health read + active fast)
- `apps/mobile/package.json` -- Add expo-health-connect dependency

### Known Limitations
- No retry queue for failed HealthKit writes (fast data is still in ft_fasts, just not in Health)
- Activity data is ephemeral (not stored for historical correlation)
- First sync capped to 30 days of history (avoids importing years of weight data)
- No Health Connect support for Android in MVP (expo-health-connect supports it, but scoped to iOS first)
- Heart rate data is latest sample only, not a time series during the fast

### Context for Next Agent
- The `source` column on ft_weight_entries is a critical migration. Existing rows default to "manual", which is correct since all pre-migration entries are user-entered.
- The healthSyncEnabled, healthReadWeight, and healthWriteFasts settings keys already exist as seeds in schema.ts. The migration does NOT need to insert them; it only needs to add the column.
- expo-health-connect requires expo-dev-client (Expo Go cannot access native health APIs). The mobile app must be using a development build for this feature to work.
- The weight import logic in `healthkit-sync.ts` must be pure and platform-agnostic (no direct HealthKit API calls). The platform-specific HealthKit calls live in `use-healthkit.ts`. This separation allows the import/conflict logic to be unit tested without native dependencies.
- The Activity Context Card data (steps, calories, heart rate) must NOT be written to SQLite. It's read-only, ephemeral, and refreshed every 60 seconds from HealthKit.
