# Feature Spec: Smart Water Reminders

## Metadata
- **Module:** fast
- **Priority Score:** 31 / 50 (A-Tier)
- **Scoring Breakdown:** Market [3] x3 + Switching [3] x3 + Complexity [4] x2 + CrossModule [2] x1 + PaidUser [3] x1
- **Sprint:** 5
- **Estimated CC Time:** 2-3 hours
- **Depends On:** Water intake logging (FT-007, already implemented in ft_water_intake)
- **Blocks:** none

## Business Context

### Why This Feature Exists
MyFast already logs water intake but provides no proactive nudges. Users forget to drink water throughout the day, especially during fasting windows when hydration is critical. Smart water reminders are the bridge between passive logging and active health assistance. The Complexity score (4/5) is the highest in the Fast backlog because the core logic is straightforward: calculate a personalized target from body weight and schedule interval-based local notifications during waking hours. Competitors like Zero and Simple charge $60-70/yr and include water reminders as a premium feature. MyFast offering this for free in the free tier is a strong differentiator.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Zero | Yes | Yes ($69.99/yr) | Basic hydration reminders, configurable intervals |
| Simple | Yes | Yes ($59.99/yr) | AI-driven water reminders, personalized targets |
| WaterMinder | Yes | Partial ($10/yr) | Best-in-class hydration tracking with Apple Watch, smart reminders |
| Fastic | No | N/A | No water reminder feature |
| BodyFast | No | N/A | No water tracking at all |

### Target User
Health-conscious intermittent fasters (20-50) who struggle with daily hydration. Users of WaterMinder ($10/yr) who want a combined fasting + hydration app instead of two separate apps. Users of Zero/Simple who pay $60-70/yr and would switch to a free app that includes water reminders. Dry fasters who need reminders paused during fasting windows (a niche but important segment).

## Technical Context

### Where This Lives in MyLife

```
modules/fast/src/
  engines/water-reminder-engine.ts       -- NEW: personalized target calculation, schedule computation
  types.ts                               -- Add WaterReminderConfig type
  db/schema.ts                           -- No table changes (uses ft_settings)
  index.ts                               -- Re-export engine functions

apps/mobile/app/(fast)/
  water-settings.tsx                     -- NEW: Water reminder settings screen/modal
  water.tsx                              -- Modify: add reminder status indicator

apps/mobile/hooks/
  use-water-reminders.ts                 -- NEW: Hook for scheduling/cancelling local notifications

apps/web/app/fast/
  water/page.tsx                         -- Show reminder settings (no push notifications on web)
```

### Wireframe Position

```
Hub Dashboard
  └── MyFast card
       └── Timer tab
            └── Water intake card (existing)
                 └── Long press / gear icon → Water Reminder Settings ← YOU ARE HERE
                      ├── Smart Reminders toggle
                      ├── Reminder Interval picker
                      ├── Waking Hours range
                      ├── Pause During Dry Fasting toggle
                      └── Personalized Goal toggle
```

Also accessible from Settings tab > Water section.

### Data Model

No new tables. New settings keys added to `ft_settings`:

```sql
-- New settings keys (no schema change, just new key-value rows)
INSERT OR IGNORE INTO ft_settings (key, value) VALUES ('waterRemindersEnabled', 'false');
INSERT OR IGNORE INTO ft_settings (key, value) VALUES ('waterReminderInterval', '60');
INSERT OR IGNORE INTO ft_settings (key, value) VALUES ('waterWakeStart', '07:00');
INSERT OR IGNORE INTO ft_settings (key, value) VALUES ('waterWakeEnd', '22:00');
INSERT OR IGNORE INTO ft_settings (key, value) VALUES ('waterPauseDuringDryFast', 'false');
INSERT OR IGNORE INTO ft_settings (key, value) VALUES ('waterPersonalizedGoal', 'false');
```

These keys are inserted via migration v3 seeds (or created on first use via `setSetting`). The existing `ft_settings` table and `getSetting`/`setSetting` CRUD operations handle them without schema changes.

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter), existing `ft_water_intake` CRUD, existing `ft_weight_entries` for weight-based target calculation, existing `ft_settings` CRUD, `@mylife/ui` (toggle, picker components)
- **External:** `expo-notifications` (local push notification scheduling on mobile)
- **Cross-Module:** Reads weight from `ft_weight_entries` for personalized target calculation. If HealthKit sync (separate feature) is enabled, weight may come from Apple Health via that pipeline.

## Functional Requirements

### User Stories
1. As a user who forgets to drink water, I want to receive reminders at regular intervals throughout the day, so that I consistently meet my hydration goal.
2. As a user who tracks my weight, I want my daily water goal to be calculated from my body weight, so that my target is personalized.
3. As a dry faster, I want reminders to pause automatically during active fasts, so I don't get nagged to drink while fasting.
4. As a user with a variable schedule, I want to set my waking hours, so reminders don't fire while I'm sleeping.

### Behavior Specification

**Enabling smart reminders:**
1. User navigates to Water Reminder Settings (via long press on water card or Settings > Water).
2. User toggles "Smart Reminders" on.
3. System requests notification permission if not already granted.
4. If permission granted: reminders are scheduled at the configured interval during waking hours.
5. If permission denied: toggle stays on but a warning banner appears: "Enable notifications in Settings to receive water reminders."

**Personalized goal calculation:**
1. User enables "Personalized Goal" toggle.
2. System reads the latest weight entry from `ft_weight_entries`.
3. Calculates target: `weight_lbs * 0.5 / 8` = glasses (or `weight_kg * 33 / 29.5735 / 8`).
4. Clamps result to range [4, 30] glasses.
5. Updates the water intake target for today via `setWaterTarget()`.
6. Displays: "Based on your weight of 160 lbs: 10 glasses/day".
7. If no weight entries exist: shows toast "Log your weight to get a personalized water goal" and falls back to the manual target (default 8).

**Reminder scheduling logic:**
1. Cancel all existing water reminder notifications (identifier prefix: `myfast_water_`).
2. If `waterRemindersEnabled` is "false": stop (no notifications).
3. Get today's water intake. If `count >= target`: stop (goal met, no more reminders today).
4. If `waterPauseDuringDryFast` is "true" AND an active fast exists: stop (dry fast active).
5. Calculate next reminder time:
   a. Start from `max(now, wakeStart)`.
   b. Round up to the next interval boundary.
   c. If past `wakeEnd`: schedule for tomorrow at `wakeStart`.
6. Schedule repeating local notification every `[interval]` minutes until `wakeEnd`.
7. Notification content: title "Time to drink water!", body "[count]/[target] glasses today."

**Re-scheduling triggers:**
- Water intake logged (count changed, may have hit target).
- Reminder settings changed (interval, waking hours, toggle).
- Fast started or ended (dry fast pause check).
- App returns to foreground.
- Day changes (midnight rollover resets count).

### Edge Cases

- **No weight entries with personalized goal on:** Falls back to manual target (default 8 glasses). Toast warns user.
- **Very low weight (< 80 lbs):** Personalized target clamps to minimum 4 glasses.
- **Very high weight (> 400 lbs):** Personalized target clamps to maximum 30 glasses.
- **Waking hours span midnight (e.g., night shift worker, 10 PM - 6 AM):** Schedule correctly handles wrap-around. Reminders fire from 10 PM to midnight, then midnight to 6 AM.
- **Interval does not divide evenly into waking hours:** Last reminder fires at the last interval boundary before wakeEnd. No partial-interval reminders.
- **User logs water to meet target mid-day:** All remaining reminders for today are cancelled immediately.
- **User changes interval while reminders are active:** All existing reminders cancelled and rescheduled at new interval.
- **Notification permission revoked:** Reminders fail silently. In-app water card still shows progress. Warning banner in settings.
- **Dry fast started while reminders are active:** If `waterPauseDuringDryFast` is on, all current reminders are cancelled. When fast ends, reminders resume.
- **Module disabled:** All notifications cancelled. Settings preserved. Re-enabling reschedules.
- **Web platform:** Settings are configurable but no push notifications. Reminders only display as in-app indicators (e.g., "Time to drink water" badge on the water card).
- **App killed/backgrounded:** Scheduled local notifications fire regardless of app state (OS-level scheduling).
- **Multiple days without opening app:** Notifications fire on schedule. On next open, today's count is 0 and reminders reschedule.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Toggling "Smart Reminders" on requests notification permission (if not already granted) and schedules reminders.
- [ ] **AC-2:** Reminders fire at the configured interval (30/60/90/120 min) during waking hours.
- [ ] **AC-3:** Notification body shows current progress: "[count]/[target] glasses today."
- [ ] **AC-4:** Reminders stop for the day when the daily target is met.
- [ ] **AC-5:** With "Pause During Dry Fasting" enabled and an active fast, no reminders fire. Reminders resume when the fast ends.
- [ ] **AC-6:** Enabling "Personalized Goal" with a weight of 160 lbs sets the daily target to 10 glasses.
- [ ] **AC-7:** With no weight entries and personalized goal on, a toast warns the user and falls back to the manual target.
- [ ] **AC-8:** Changing the reminder interval reschedules all pending notifications immediately.
- [ ] **AC-9:** Changing waking hours reschedules reminders within the new time range.
- [ ] **AC-10:** The water card shows a reminder status indicator (next reminder time or "Goal met!").

### Technical Criteria
- [ ] **TC-1:** `calculatePersonalizedTarget(160, 'lbs')` returns 10 glasses.
- [ ] **TC-2:** `calculatePersonalizedTarget(70, 'kg')` returns 10 glasses (70*33/29.5735/8 = 9.7, rounded to 10).
- [ ] **TC-3:** `calculatePersonalizedTarget(50, 'lbs')` returns 4 (clamped minimum).
- [ ] **TC-4:** `calculatePersonalizedTarget(500, 'lbs')` returns 30 (clamped maximum).
- [ ] **TC-5:** `calculateNextReminderTime` correctly computes the next interval boundary from current time.
- [ ] **TC-6:** `calculateNextReminderTime` returns tomorrow's wakeStart when current time is past wakeEnd.
- [ ] **TC-7:** All reminder notifications use identifier prefix `myfast_water_` for clean cancellation.
- [ ] **TC-8:** Settings keys are read/written correctly via existing `getSetting`/`setSetting`.
- [ ] **TC-9:** Logging water triggers reminder rescheduling (checks if target met).
- [ ] **TC-10:** Starting/ending a fast triggers reminder rescheduling (dry fast pause check).

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Reminders must NOT fire outside of configured waking hours.
- [ ] **NC-2:** Reminders must NOT fire after the daily target is met.
- [ ] **NC-3:** Personalized goal calculation must NOT crash when no weight entries exist (graceful fallback).
- [ ] **NC-4:** Changing reminder settings must NOT affect existing water intake counts for the day.
- [ ] **NC-5:** Dry fast pause must NOT disable reminders permanently (only during the active fast).

## UI Specification

### Mobile (Expo)

**Water Reminder Settings Screen/Modal:**
- Background: `#0A0A0F` (background token)
- Card: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border
- Module accent: `#14B8A6` (teal)
- "Smart Reminders" master toggle at top
- When enabled, settings appear with slide animation:
  - Reminder Interval: segmented control with 30/60/90/120 options
  - Waking Hours: two time pickers (start/end) in a row
  - Pause During Dry Fasting: toggle
  - Personalized Goal: toggle with calculated target display below
- Personalized goal display: "Based on your weight of [N] lbs: [N] glasses/day" in `textSecondary`, accent-colored number
- Permission warning: amber banner at top if notifications are denied

**Water Card Modification (Timer tab):**
- Add a small indicator below the water progress ring:
  - When reminders active: "Next reminder in [N] min" in `textSecondary`
  - When target met: "Goal met!" in `success` green
  - When paused (dry fast): "Paused during fast" in `textSecondary`

### Web (Next.js)

- Settings are configurable at `/fast/water` or within the settings page
- Same toggles and pickers as mobile
- No push notifications. Instead, show an in-app badge/indicator on the water card: "Time to drink water" when the interval has elapsed since last log
- "Notifications are not available on web" info text below the Smart Reminders toggle

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Toggle loading state while requesting notification permission | Enabling smart reminders for first time |
| Disabled | Toggle off, no sub-settings visible | Smart reminders off (default) |
| Active | Sub-settings visible, "Next reminder in [N] min" on water card | Reminders enabled, target not met |
| Goal Met | Sub-settings visible, "Goal met!" on water card, no pending reminders | Daily target reached |
| Paused (Dry Fast) | Sub-settings visible, "Paused during fast" on water card | Active fast + dry fast pause enabled |
| Error (Permission) | Amber warning banner, reminders not scheduling | Notification permission denied |

## Test Requirements

### Unit Tests (modules/fast/src/__tests__/water-reminder-engine.test.ts)
- [ ] `calculatePersonalizedTarget`: 160 lbs returns 10 glasses
- [ ] `calculatePersonalizedTarget`: 70 kg returns 10 glasses
- [ ] `calculatePersonalizedTarget`: 50 lbs clamps to 4 glasses
- [ ] `calculatePersonalizedTarget`: 500 lbs clamps to 30 glasses
- [ ] `calculatePersonalizedTarget`: 0 lbs clamps to 4 glasses (edge)
- [ ] `calculateNextReminderTime`: at 14:00 with 60min interval returns 14:00 (on boundary)
- [ ] `calculateNextReminderTime`: at 14:15 with 60min interval returns 15:00 (round up)
- [ ] `calculateNextReminderTime`: at 14:15 with 30min interval returns 14:30
- [ ] `calculateNextReminderTime`: at 21:50 with wakeEnd 22:00 and 60min interval returns tomorrow wakeStart
- [ ] `calculateNextReminderTime`: respects wakeStart (before wakeStart rounds to wakeStart)
- [ ] `shouldSendReminder`: returns true when count < target and reminders enabled
- [ ] `shouldSendReminder`: returns false when count >= target
- [ ] `shouldSendReminder`: returns false when dry fast pause on and fast active
- [ ] `shouldSendReminder`: returns true when dry fast pause on but no fast active
- [ ] `generateReminderSlots`: generates correct number of slots for 7AM-10PM with 60min interval (15 slots)
- [ ] `generateReminderSlots`: handles waking hours spanning midnight

### Integration Tests
- [ ] Full flow: enable reminders, mock notification API, verify notifications scheduled at correct times
- [ ] Target flow: enable personalized goal with weight 160 lbs, verify water target updated to 10
- [ ] Goal met flow: log water to meet target, verify all pending reminders cancelled
- [ ] Dry fast flow: start fast with pause enabled, verify reminders cancelled; end fast, verify reminders rescheduled

### QA Verification Script

1. Open the app on iOS. Navigate to MyFast > Timer tab.
2. Long-press the water card (or go to Settings > Water). Verify Water Reminder Settings appear. -- Navigation check.
3. Toggle "Smart Reminders" on. Verify notification permission prompt appears. -- Corresponds to AC-1.
4. Grant permission. Verify sub-settings appear (interval, waking hours, dry fast pause, personalized goal). -- Corresponds to AC-1.
5. Set interval to 30 minutes. Verify the water card shows "Next reminder in ~[N] min". -- Corresponds to AC-2, AC-10.
6. Wait for a reminder to fire (or advance simulator time). Verify notification appears with title "Time to drink water!" and body showing current progress. -- Corresponds to AC-2, AC-3.
7. Log water glasses until daily target is met. Verify "Goal met!" appears on water card and no more reminders fire. -- Corresponds to AC-4, NC-2.
8. Reset water count to 0. Verify reminders resume.
9. Enable "Pause During Dry Fasting". Start a fast. Verify "Paused during fast" appears and reminders stop. -- Corresponds to AC-5.
10. End the fast. Verify reminders resume. -- Corresponds to NC-5.
11. Log a weight entry of 160 lbs (if not already). Enable "Personalized Goal". Verify target changes to 10 glasses and display shows "Based on your weight of 160 lbs: 10 glasses/day". -- Corresponds to AC-6.
12. Delete all weight entries. Verify toast warning and fallback to manual target (8). -- Corresponds to AC-7.
13. Change interval from 30 to 120 minutes. Verify the water card updates "Next reminder in ~[N] min" reflecting the new interval. -- Corresponds to AC-8.
14. Change waking hours to 9 AM - 8 PM. Verify reminders reschedule within new range. -- Corresponds to AC-9.
15. Disable "Smart Reminders". Verify sub-settings disappear and no more reminders fire. -- Toggle off.
16. On web, verify reminder settings are configurable but notification text says "Notifications are not available on web". -- Web parity check.

## gstack Quality Gates

Based on this feature's Complexity Inverse score of 4 (Small):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to water reminder settings, toggle all options, verify water card indicator updates

### Required if this feature contains business logic:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for `water-reminder-engine.ts` (personalizedTarget, nextReminderTime, shouldSendReminder)

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- fast module has standalone counterpart
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Water intake logging works (ft_water_intake table, increment/set/reset CRUD)
- Daily target is manually configurable (default 8 glasses)
- No reminder or notification logic for water
- No personalized target calculation
- Settings keys waterDailyTarget exists; no reminder-specific keys

### After This Work
- Smart water reminder engine with personalized target calculation, interval scheduling, waking hours, dry fast pause
- New settings keys: waterRemindersEnabled, waterReminderInterval, waterWakeStart, waterWakeEnd, waterPauseDuringDryFast, waterPersonalizedGoal
- Mobile: local push notifications at configured intervals during waking hours
- Water card shows reminder status indicator (next reminder time / goal met / paused)
- Web: settings configurable but no push notifications (in-app indicator only)

### Files Changed

- `modules/fast/src/engines/water-reminder-engine.ts` -- NEW: calculatePersonalizedTarget, calculateNextReminderTime, shouldSendReminder, generateReminderSlots
- `modules/fast/src/types.ts` -- Add WaterReminderConfig interface
- `modules/fast/src/index.ts` -- Re-export water reminder engine functions
- `modules/fast/src/__tests__/water-reminder-engine.test.ts` -- NEW: 16+ unit tests
- `apps/mobile/app/(fast)/water-settings.tsx` -- NEW: Water reminder settings screen
- `apps/mobile/app/(fast)/water.tsx` -- Modify: add reminder status indicator to water card
- `apps/mobile/hooks/use-water-reminders.ts` -- NEW: Hook for scheduling/cancelling expo-notifications
- `apps/web/app/fast/water/page.tsx` -- Add reminder settings (no push notifications)

### Known Limitations
- No smart reminder adjustment based on activity level or temperature
- No notification sound customization (uses system default)
- Web has no push notification support (in-app indicator only)
- Waking hours are fixed daily (no per-day-of-week schedule)
- No integration with Apple Watch water complication in this feature (separate spec)

### Context for Next Agent
- The `waterDailyTarget` setting already exists and is used by `getDefaultTarget()` in `water.ts`. The personalized goal calculation should UPDATE this value via `setSetting('waterDailyTarget', ...)` when the toggle is on, and RESTORE the previous manual value when toggled off. Store the manual value in a setting like `waterManualTarget` before overwriting.
- The notification scheduling hook (`use-water-reminders.ts`) should use `expo-notifications` `scheduleNotificationAsync` with a repeating trigger. Cancel by identifier prefix `myfast_water_` to avoid interfering with fasting notifications.
- Water intake changes (via `incrementWaterIntake`) should trigger a reminder reschedule check. The cleanest integration point is in the mobile hook that calls the CRUD function, not in the CRUD function itself (keep the engine pure).
- The dry fast pause interacts with the fasting timer. When a fast starts or ends, the water reminder hook needs to be notified. Use a React effect that watches the active fast state.
