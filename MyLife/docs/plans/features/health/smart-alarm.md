# Feature Spec: Smart Alarm

## Metadata
- **Module:** health
- **Priority Score:** 24 / 50 (B-Tier)
- **Scoring Breakdown:** Market 4 x3 + Switching 1 x3 + Complexity 2 x2 + CrossModule 2 x1 + PaidUser 3 x1
- **Sprint:** 6
- **Estimated CC Time:** 4-5 hours
- **Depends On:** HealthKit integration (sleep stage data source), Sleep stage analysis (determines light sleep windows)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Smart alarm (also called "optimal wake") wakes users during their lightest sleep phase within a configurable window before their alarm time. Waking during light sleep instead of deep or REM sleep reduces grogginess (sleep inertia). Sleep Cycle built a $30M+ business primarily on this feature. Apple added it natively in iOS 15 via Sleep Focus. Complexity is 2 (hard) because it requires background processing, real-time sleep stage detection, and reliable notification triggering at a dynamically calculated time.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Apple Health | Yes | Free | Sleep Focus mode with optimal wake, requires Apple Watch |
| Sleep Cycle | Yes | Yes ($39.99/yr) | Audio-based sleep analysis, vibration alarm during light sleep |
| AutoSleep | Yes | $8 one-time | Apple Watch-based smart alarm with configurable wake window |
| Pillow | Yes | Freemium ($4.99/mo) | Optimal wake within 30-min window, Apple Watch haptics |
| Oura | Yes | Yes ($5.99/mo) | Optimal wake time suggestion (no alarm, just advice) |

### Target User
Users who wake up groggy despite sleeping 7-8 hours and want to be woken at the optimal sleep phase. Apple Watch users who already have real-time sleep stage data. Anyone who has tried Sleep Cycle and wants that functionality integrated into their health hub.

## Technical Context

### Where This Lives in MyLife

```
modules/health/src/smart-alarm/engine.ts      -- Smart alarm scheduling logic
modules/health/src/smart-alarm/types.ts       -- Alarm types and configuration
modules/health/src/smart-alarm/crud.ts        -- Alarm persistence
modules/health/src/db/schema.ts               -- New hl_smart_alarms table
modules/health/src/index.ts                   -- Export smart alarm functions
apps/mobile/app/(health)/smart-alarm.tsx      -- Alarm setup screen
apps/web/app/health/smart-alarm/page.tsx      -- Web alarm settings (view only)
```

### Wireframe Position

```
Hub Dashboard
  +-- MyHealth card
       +-- Vitals tab
            +-- Sleep section
                 +-- Smart Alarm <-- YOU ARE HERE
                      |-- Alarm toggle (on/off)
                      |-- Wake-by time picker
                      |-- Wake window slider (10-30 min)
                      |-- Alarm history + effectiveness
                      +-- Sound selection
```

### Data Model

```sql
CREATE TABLE IF NOT EXISTS hl_smart_alarms (
    id TEXT PRIMARY KEY,
    target_time TEXT NOT NULL,           -- HH:MM format, e.g., '07:00'
    wake_window_minutes INTEGER NOT NULL DEFAULT 20,  -- 10, 15, 20, 25, 30
    is_enabled INTEGER NOT NULL DEFAULT 1,
    days_of_week TEXT NOT NULL DEFAULT '1,2,3,4,5',  -- Comma-separated: 1=Mon...7=Sun
    sound TEXT NOT NULL DEFAULT 'gentle_rise',
    vibration INTEGER NOT NULL DEFAULT 1,
    snooze_enabled INTEGER NOT NULL DEFAULT 1,
    snooze_duration_minutes INTEGER NOT NULL DEFAULT 5,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS hl_alarm_history (
    id TEXT PRIMARY KEY,
    alarm_id TEXT NOT NULL REFERENCES hl_smart_alarms(id) ON DELETE CASCADE,
    scheduled_time TEXT NOT NULL,        -- The target alarm time (e.g., '2026-03-15T07:00:00')
    actual_trigger_time TEXT,            -- When it actually fired (may be earlier if light sleep detected)
    trigger_reason TEXT NOT NULL,        -- 'light_sleep' | 'window_end' | 'manual_wake' | 'snoozed'
    sleep_stage_at_trigger TEXT,         -- 'deep' | 'rem' | 'light' | 'awake' | null
    snoozed INTEGER NOT NULL DEFAULT 0,
    snooze_count INTEGER NOT NULL DEFAULT 0,
    dismissed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS hl_alarm_enabled_idx ON hl_smart_alarms(is_enabled);
CREATE INDEX IF NOT EXISTS hl_alarm_history_date_idx ON hl_alarm_history(scheduled_time DESC);
CREATE INDEX IF NOT EXISTS hl_alarm_history_alarm_idx ON hl_alarm_history(alarm_id);
```

### Dependencies
- **Internal:** `@mylife/db`, hl_sleep_sessions (for stage data), hl_vitals (heart rate as wake signal), sleep stage analysis (light sleep detection)
- **External:** `expo-notifications` (local notification scheduling), `expo-haptics` (vibration alarm), potentially `expo-av` (alarm sound playback), Apple Watch background task API (via HealthKit for real-time stage detection)
- **Cross-Module:** Sleep tracking provides the data. Readiness score could incorporate wake quality. Sleep aids (wind-down routines) could auto-schedule before the smart alarm.

## Functional Requirements

### User Stories
1. As a user who wakes up groggy, I want to be woken during light sleep so I feel refreshed.
2. As a user, I want to configure when I need to be up by and how much flexibility the alarm has to find light sleep.
3. As a user, I want to see if the smart alarm actually improves my wake quality compared to a fixed alarm.
4. As a user, I want the alarm to fall back to a normal alarm if light sleep is not detected.

### Behavior Specification

**Setting up a smart alarm:**
1. User navigates to Vitals > Sleep > Smart Alarm
2. Screen shows:
   a. **Enable toggle:** On/Off for the smart alarm feature
   b. **Wake-by time:** Time picker for the latest acceptable wake time (e.g., 7:00 AM)
   c. **Wake window:** Slider for how many minutes early the alarm can fire (10, 15, 20, 25, 30 min; default 20)
   d. **Active days:** Day-of-week selector (e.g., weekdays only)
   e. **Sound:** Selection from 4 alarm sounds (Gentle Rise, Chimes, Nature, Vibration Only)
   f. **Snooze:** Toggle + duration (5/10/15 min)
3. Settings saved to hl_smart_alarms

**How the smart alarm works:**
1. Each night before sleep, system schedules a fallback notification at the target_time
2. During the wake window (target_time minus wake_window_minutes to target_time):
   a. If HealthKit provides real-time sleep stage and user enters light sleep or awake: trigger alarm immediately
   b. If no real-time stage data is available: use heart rate variability increase as a proxy for lightening sleep
   c. If neither signal is available: alarm fires at target_time (standard alarm behavior)
3. Alarm fires as:
   a. Local notification with custom sound
   b. Haptic feedback (if enabled)
   c. Full-screen alarm UI if app is in foreground
4. User can snooze or dismiss
5. Alarm event logged to hl_alarm_history with trigger_reason and sleep_stage

**Effectiveness tracking:**
1. Alarm history screen shows past alarms
2. Each entry shows: date, scheduled time, actual trigger time, trigger reason, how much earlier
3. Over time, shows "Smart wake success rate: 72% of alarms fired during light sleep"
4. Optional: correlate wake quality with mood check-in (if user logs morning mood)

### Edge Cases

- **No Apple Watch (no real-time sleep data):** Smart alarm degrades to a normal alarm at target_time. Show note: "Connect Apple Watch for smart wake functionality."
- **User already awake before window:** If HR/movement indicates user is awake, do not fire alarm.
- **User in deep sleep entire window:** Fire at target_time (end of window). Log trigger_reason='window_end'.
- **User wakes naturally before alarm window:** Detect via HealthKit "wrist on" signal if available. Cancel alarm notification.
- **Multiple alarms configured:** Support up to 5 alarms. Each fires independently.
- **Alarm set for time that already passed today:** Schedule for tomorrow.
- **Phone on silent/DND:** Respect system settings. If DND allows alarms, fire. If not, the notification will be suppressed by iOS.
- **App not running in background:** Fallback notification still fires at target_time (scheduled in advance). Smart wake requires background processing.
- **Snooze 3+ times:** Allow unlimited snoozes but track count. After 3 snoozes, show gentle nudge: "Consider adjusting your wake time."
- **Timezone change (travel):** Alarm uses device local time. Recalculate on timezone change.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Smart alarm setup screen shows toggle, time picker, window slider, and day selector
- [ ] **AC-2:** Wake-by time picker works with 5-minute increments
- [ ] **AC-3:** Wake window slider offers 10/15/20/25/30 minute options
- [ ] **AC-4:** Day-of-week selector allows any combination (including weekends)
- [ ] **AC-5:** Alarm fires within the wake window when light sleep is detected
- [ ] **AC-6:** Alarm fires at target_time as fallback when no sleep stage data is available
- [ ] **AC-7:** Snooze works for the configured duration
- [ ] **AC-8:** Alarm history shows past alarms with trigger reason and timing
- [ ] **AC-9:** Success rate statistic calculates correctly over alarm history
- [ ] **AC-10:** Sound selection plays a preview when tapped

### Technical Criteria
- [ ] **TC-1:** hl_smart_alarms and hl_alarm_history tables created by migration
- [ ] **TC-2:** Local notification scheduled correctly for fallback alarm
- [ ] **TC-3:** Wake window calculation: if target is 7:00 and window is 20, alarm can fire 6:40-7:00
- [ ] **TC-4:** Trigger reason logged correctly: 'light_sleep', 'window_end', 'manual_wake', 'snoozed'
- [ ] **TC-5:** Alarm persists across app restart (notification scheduled via expo-notifications)
- [ ] **TC-6:** Success rate calculation: count(trigger_reason='light_sleep') / total alarms

### Negative Criteria
- [ ] **NC-1:** Smart alarm must NOT fire before the wake window starts
- [ ] **NC-2:** Must NOT auto-call emergency services or contact anyone
- [ ] **NC-3:** Must NOT require network access for core alarm functionality
- [ ] **NC-4:** Must NOT bypass system DND/Focus settings

## UI Specification

### Mobile (Expo)
- **Setup screen:** Glass card with sections. Toggle at top in `#10B981` accent. Time picker in large format (48px, `#F0F0F5`). Wake window as segmented control. Day chips in a row.
- **Alarm firing:** Full-screen if in foreground: dark background (`#0A0A0F`) with pulsing circle in `#10B981`, time display, "Snooze" and "Dismiss" buttons.
- **History:** Glass cards per alarm event. Green chip for "Light Sleep", orange for "Window End", gray for "Manual".
- **Sound preview:** Play 3-second preview when tapped. Active sound highlighted in accent.

### Web (Next.js)
- `/health/smart-alarm` route. Configuration view only (alarms fire on mobile).
- Show history and success rate statistics.
- Note: "Smart alarm only fires on your mobile device."

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Disabled | Setup screen with toggle off | Feature not enabled |
| Configured | Active alarm with next trigger preview | Alarm set and enabled |
| Firing | Full-screen alarm with snooze/dismiss | Alarm triggers |
| Snoozed | "Snoozing... 5 min" countdown | User taps snooze |
| History | Past alarms with success rate | Tap history section |
| No Watch | Setup screen with "Connect Apple Watch" note | No real-time data |

## Test Requirements

### Unit Tests
- [ ] `calculateWakeWindow`: target 07:00, window 20 = [06:40, 07:00]
- [ ] `calculateWakeWindow`: target 00:15, window 30 = [23:45, 00:15] (crosses midnight)
- [ ] `shouldTriggerAlarm`: light sleep during window = true
- [ ] `shouldTriggerAlarm`: deep sleep during window = false
- [ ] `shouldTriggerAlarm`: at window_end regardless of stage = true
- [ ] `calculateSuccessRate`: 7 light_sleep out of 10 total = 70%
- [ ] `calculateSuccessRate`: handles 0 alarms gracefully
- [ ] `getNextAlarmTime`: Monday alarm on Sunday returns next Monday
- [ ] `getNextAlarmTime`: daily alarm returns today if before target time
- [ ] `createAlarm`: stores all fields correctly
- [ ] `logAlarmTrigger`: stores trigger reason and stage

### Integration Tests
- [ ] Full flow: configure alarm -> schedule -> trigger during light sleep -> log to history
- [ ] Fallback flow: no sleep data -> alarm fires at target time -> logged as 'window_end'
- [ ] Snooze flow: alarm fires -> snooze -> fires again after snooze duration

### QA Verification Script

1. Navigate to MyHealth > Vitals > Sleep > Smart Alarm
2. Verify: Setup screen with toggle, time picker, window slider, days -- corresponds to AC-1
3. Set wake-by time to 7:00 AM, window 20 min, weekdays
4. Verify: Time picker works in 5-min increments -- corresponds to AC-2
5. Verify: Window slider shows 10/15/20/25/30 options -- corresponds to AC-3
6. Tap each day to select all 7 days
7. Verify: All days selectable -- corresponds to AC-4
8. Set an alarm for 2 minutes from now with 1-min window (for testing)
9. Verify: Alarm fires within the window or at target time -- corresponds to AC-5, AC-6
10. Tap snooze
11. Verify: Alarm re-fires after snooze duration -- corresponds to AC-7
12. Navigate to alarm history
13. Verify: Recent alarm appears with trigger reason -- corresponds to AC-8
14. Tap a sound option
15. Verify: Preview plays -- corresponds to AC-10

## gstack Quality Gates

Based on Complexity 2 (Inverse), this feature is "Large" tier.

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states

### Required if Complexity <= 2 (Large/Complex):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. Fix issues found.

### Required if this feature contains business logic:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for alarm scheduling

### Post-merge:
- [ ] `/parity-check` -- skip (no standalone)

## Handoff State

### Before This Work
Health module has sleep tracking with stage analysis, but no alarm functionality. Users must rely on Apple's native alarm or third-party apps.

### After This Work
- Smart alarm configuration with wake window and day selection
- Alarm scheduling via local notifications
- Light sleep detection for optimal wake (when Apple Watch data available)
- Alarm history with trigger reason tracking
- Success rate statistics
- Graceful fallback to standard alarm without Apple Watch

### Files Changed
- `modules/health/src/smart-alarm/engine.ts` -- Alarm scheduling and trigger logic (NEW)
- `modules/health/src/smart-alarm/types.ts` -- Alarm types (NEW)
- `modules/health/src/smart-alarm/crud.ts` -- Alarm and history CRUD (NEW)
- `modules/health/src/db/schema.ts` -- hl_smart_alarms + hl_alarm_history tables
- `modules/health/src/db/migrations.ts` -- V3 migration
- `modules/health/src/definition.ts` -- schemaVersion bump
- `modules/health/src/index.ts` -- Export smart alarm functions
- `apps/mobile/app/(health)/smart-alarm.tsx` -- Alarm setup UI (NEW)

### Known Limitations
- No real-time sleep stage detection without Apple Watch (degrades to fixed alarm)
- No Apple Watch haptic wake (requires watchOS app, not built yet)
- No adaptive learning (does not adjust window based on user's typical light sleep times)
- Audio alarm requires app to be in foreground or background audio mode
- No "feel-good" morning dashboard (just an alarm, no weather/calendar integration)
- Background processing depends on iOS background task capabilities

### Context for Next Agent
- The smart alarm's core challenge is the chicken-and-egg problem: you need to detect light sleep in real-time to fire the alarm early, but real-time sleep stage detection requires HealthKit background delivery (HKObserverQuery) for sleep categories. Check if the HealthKit adapter supports this.
- If real-time stage detection is not feasible on v1, the alarm engine should still provide value by: (a) learning the user's typical light sleep windows from historical data and (b) using heart rate spike detection as a proxy for lightening sleep.
- Use expo-notifications to schedule the fallback alarm. The notification should be scheduled when the user enables the alarm, recalculated each night.
- Alarm sound playback during background state may require adding 'audio' to UIBackgroundModes in app.json.
- The hl_alarm_history table is intentionally separate from hl_smart_alarms so we can keep history even after alarm configuration changes.
