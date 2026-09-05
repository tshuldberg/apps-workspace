# Feature Spec: Daily Reminders

## Metadata
- **Module:** flash
- **Priority Score:** 35 / 50 (A-Tier)
- **Scoring Breakdown:** Market 4 x3 + Switching 3 x3 + Complexity 5 x2 + CrossModule 2 x1 + PaidUser 2 x1
- **Sprint:** Sprint 5 (S+A Features)
- **Estimated CC Time:** 1.5-2 hours
- **Depends On:** FL-005 (Study Sessions -- implemented), FL-014 (Streak Tracking -- `calculateStudyStreak` implemented in `engine/scheduler.ts`)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Daily reminders are the #1 retention tool for flashcard apps. Quizlet sends daily push notifications that account for 40%+ of return visits. Brainscape ($79.99/yr) uses reminders as a core premium feature. Without reminders, users forget to study, lose their streak, and churn. MyFlash already stores `dailyReminderEnabled` and `dailyReminderTime` settings (seeded in V2 migration) but has no notification scheduling logic. The infrastructure is ready; this feature wires it up.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Quizlet | Yes | Free | Daily push notification with due card count. "You have 42 terms to review." |
| Brainscape | Yes | $79.99/yr | Smart reminders based on optimal study time. Part of premium. |
| Anki | Yes | Free (desktop) / $29.99 (iOS) | AnkiDroid has reminders. AnkiMobile has badge count. |
| StudyFetch | No | N/A | No reminder system. |

### Target User
Students and language learners who want to build a daily study habit but forget to open the app. These users respond well to gentle nudges with specific card counts. The reminder also reinforces streak motivation by showing streak status.

## Technical Context

### Where This Lives in MyLife

```
modules/flash/src/reminders/                    -- NEW: reminder scheduling logic
modules/flash/src/reminders/types.ts            -- ReminderConfig, NotificationPayload types
modules/flash/src/reminders/scheduler.ts        -- Notification scheduling, due card counting
modules/flash/src/reminders/index.ts            -- Barrel export
modules/flash/src/reminders/__tests__/          -- Tests
apps/mobile/app/(flash)/settings.tsx            -- Reminder settings UI (extend existing settings)
apps/web/app/flash/settings/page.tsx            -- Web settings (reminder config, no notifications)
```

### Wireframe Position

```
Hub Dashboard
  └── MyFlash card
       └── Settings tab
            └── "Daily Reminder" section ← YOU ARE HERE
```

### Data Model

No new tables needed. Settings already seeded in V2 migration:

```sql
-- Already exists in fl_settings (seeded by V2 EXPANDED_SETTINGS):
-- key: 'dailyReminderEnabled', value: '0'
-- key: 'dailyReminderTime', value: '09:00'
```

Additional settings keys stored in `fl_settings` (no migration needed, INSERT OR IGNORE):

```sql
INSERT OR IGNORE INTO fl_settings (key, value) VALUES ('dailyReminderIncludeStreak', '1');
INSERT OR IGNORE INTO fl_settings (key, value) VALUES ('dailyReminderDeckFilter', 'all');
```

### Dependencies
- **Internal:** `@mylife/db`, flash CRUD (`listDueFlashcards`, `getFlashDashboard`, `getFlashSetting`, `setFlashSetting`)
- **External:** `expo-notifications` (mobile local notifications), Notification API (web, limited)
- **Cross-Module:** Streak data from `calculateStudyStreak` feeds into notification content

## Functional Requirements

### User Stories
1. As a busy student, I want to receive a daily push notification reminding me to review my flashcards so that I never forget to study.
2. As a streak-focused learner, I want the reminder to tell me my current streak is at risk so that I feel urgency to study.
3. As a user with multiple decks, I want to customize which decks trigger reminders so that I only get notified for important decks.

### Behavior Specification

1. User navigates to Flash > Settings tab.
2. "Daily Reminder" section shows toggle (default: off) and configuration options.
3. User toggles reminder on.
4. If notification permission not granted: system permission dialog appears.
5. If permission granted: time picker shows (default: 9:00 AM local time).
6. User sets preferred time (e.g., 8:00 AM).
7. User optionally configures deck filter (all decks or specific decks).
8. User optionally toggles "Include streak info" (default: on).
9. System schedules a daily local notification for the configured time.
10. At the scheduled time: system checks if there are due cards.
11. If due cards exist: notification fires with message "You have X cards due for review" plus streak info if enabled.
12. If no due cards: no notification sent (silent skip).
13. User taps notification: app opens directly to the study screen.
14. Notification reschedules itself for the next day after firing or after app open.

### Edge Cases

- **Notification permission denied:** Show alert explaining why notifications help with link to system settings. Reminder toggle stays off.
- **No due cards at scheduled time:** No notification sent. Check again next day.
- **App not running at scheduled time:** Local notifications fire from the OS notification scheduler even when app is closed.
- **Timezone change (travel):** Notification time adjusts to new local time on next reschedule.
- **Multiple decks, some filtered:** Only count due cards from filtered decks.
- **User changes time:** Cancel old notification, schedule new one.
- **User disables reminder:** Cancel all scheduled notifications for this feature.
- **Device restarted:** `expo-notifications` persists scheduled notifications across reboots.
- **Web platform:** Show reminder configuration UI but note "Push notifications require a mobile device. Web reminders use browser notifications (limited support)."

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Reminder toggle appears in Settings with default off state.
- [ ] **AC-2:** Toggling reminder on requests notification permission if not already granted.
- [ ] **AC-3:** Time picker allows setting reminder time in 15-minute increments (default 9:00 AM).
- [ ] **AC-4:** Deck filter allows choosing "All Decks" or specific decks.
- [ ] **AC-5:** "Include streak info" toggle adds streak data to notification text.
- [ ] **AC-6:** Notification shows due card count: "You have X cards due for review."
- [ ] **AC-7:** With streak enabled, notification shows: "Keep your X-day streak alive! Y cards due."
- [ ] **AC-8:** No notification fires when there are 0 due cards.
- [ ] **AC-9:** Tapping the notification opens the app to the study screen.
- [ ] **AC-10:** Changing the time reschedules the notification.
- [ ] **AC-11:** Disabling the reminder cancels all scheduled notifications.
- [ ] **AC-12:** Preview of notification text shown in settings.

### Technical Criteria
- [ ] **TC-1:** Settings are stored in `fl_settings` using existing `setFlashSetting` API.
- [ ] **TC-2:** Mobile uses `expo-notifications` `scheduleNotificationAsync` with daily trigger.
- [ ] **TC-3:** Due card count is computed by `listDueFlashcards` with optional deck filter.
- [ ] **TC-4:** Streak data is computed by `getFlashDashboard` for notification content.
- [ ] **TC-5:** Notification rescheduling runs on: app launch, after study session, and after settings change.
- [ ] **TC-6:** Notification content is computed at fire time (not at schedule time) for accurate due counts.

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Reminders must NOT use any cloud push notification service. All notifications are local.
- [ ] **NC-2:** Reminder schedule data must NOT leave the device.
- [ ] **NC-3:** Reminders must NOT fire when notification permission is not granted.
- [ ] **NC-4:** Disabling reminders must NOT affect study data, streak data, or any other feature.

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Settings section: glass card style, grouped with other settings
- Toggle: standard iOS/Android switch
- Time picker: native platform time picker (24h or 12h based on locale)
- Deck filter: multi-select list with checkboxes, "All Decks" default
- Preview: glass card showing sample notification text with accent `#FBBF24` highlight
- Module accent: `#FBBF24`

### Web (Next.js)

- Route: `/flash/settings` (existing, extend with reminder section)
- Same configuration UI but with note about browser notification limitations
- "Test Notification" button for browsers that support Notification API

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Disabled | Toggle off, time picker hidden | Default state |
| Permission Needed | System permission dialog | First toggle on |
| Permission Denied | Alert with settings link, toggle reverts to off | User denies permission |
| Enabled | Toggle on, time picker, deck filter, streak toggle, preview | Permission granted |
| Scheduled | "Next reminder: Tomorrow at 9:00 AM" indicator | After enabling |

## Test Requirements

### Unit Tests
- [ ] `buildNotificationContent`: 42 due cards, streak 5 -> "Keep your 5-day streak alive! 42 cards due."
- [ ] `buildNotificationContentNoStreak`: 42 due, streak disabled -> "You have 42 cards due for review."
- [ ] `buildNotificationContentZeroDue`: 0 due cards -> returns null (no notification)
- [ ] `filterDueByDecks`: deck filter with 2 of 5 decks -> only counts due from those 2
- [ ] `filterDueAllDecks`: filter "all" -> counts from all decks
- [ ] `scheduleNotification`: enabled=true, time=09:00 -> schedules for next 9:00 AM
- [ ] `cancelNotification`: enabled=false -> cancels scheduled notification
- [ ] `rescheduleOnTimeChange`: time changes from 09:00 to 08:00 -> old cancelled, new scheduled

### Integration Tests
- [ ] Full flow: enable reminder -> set time -> verify notification scheduled -> disable -> verify cancelled
- [ ] Permission flow: toggle on -> deny permission -> toggle reverts to off

### QA Verification Script

1. Open the app on mobile (iOS simulator)
2. Navigate to MyFlash > Settings tab
3. Verify: "Daily Reminder" section shows toggle (off by default) -- corresponds to AC-1
4. Toggle reminder on
5. Verify: notification permission dialog appears -- corresponds to AC-2
6. Grant permission
7. Verify: time picker appears with 9:00 AM default -- corresponds to AC-3
8. Change time to 8:00 AM
9. Verify: "Next reminder: Tomorrow at 8:00 AM" shown -- corresponds to AC-10
10. Toggle "Include streak info" off
11. Verify: preview text changes to "You have X cards due for review" -- corresponds to AC-12
12. Toggle "Include streak info" back on
13. Verify: preview includes streak info -- corresponds to AC-5
14. Create some due cards (add cards and set due dates to past)
15. Wait for scheduled time (or advance device clock for testing)
16. Verify: notification appears with due card count -- corresponds to AC-6
17. Tap notification
18. Verify: app opens to study screen -- corresponds to AC-9
19. Toggle reminder off
20. Verify: no more notifications fire -- corresponds to AC-11

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to /flash/settings, verify reminder configuration UI

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
The flash module has `dailyReminderEnabled` and `dailyReminderTime` settings keys seeded in V2 migration but no notification scheduling logic or UI.

### After This Work
A `reminders/` directory contains notification scheduling logic. Settings UI allows configuring reminders with time, deck filter, and streak info toggle. Mobile uses `expo-notifications` for local daily notifications. Web shows configuration but with limited notification support.

### Files Changed
- `modules/flash/src/reminders/types.ts` -- ReminderConfig, NotificationPayload types
- `modules/flash/src/reminders/scheduler.ts` -- scheduleReminder, cancelReminder, buildNotificationContent
- `modules/flash/src/reminders/index.ts` -- barrel export
- `modules/flash/src/reminders/__tests__/scheduler.test.ts` -- 8+ unit tests
- `modules/flash/src/index.ts` -- re-export reminders module
- `apps/mobile/app/(flash)/settings.tsx` -- extend with reminder settings section
- `apps/web/app/flash/settings/page.tsx` -- extend with reminder configuration

### Known Limitations
- Web notifications require browser Notification API support (not available in all browsers).
- Notification content is built at schedule time, not fire time, on some platforms. Due card count may be slightly stale.
- No "smart" scheduling based on optimal study times. Fixed daily time only.

### Context for Next Agent
- Settings keys `dailyReminderEnabled` and `dailyReminderTime` already exist in `fl_settings` via V2 migration. Use `getFlashSetting(db, 'dailyReminderEnabled')` and `setFlashSetting(db, 'dailyReminderEnabled', '1')`.
- Due cards are counted via `listDueFlashcards(db, deckId)`. For all decks, pass undefined for deckId.
- Streak data comes from `getFlashDashboard(db)` which returns `currentStreak` and `longestStreak`.
- For `expo-notifications`, use `scheduleNotificationAsync` with a daily trigger: `{ hour, minute, repeats: true }`.
- The notification deep link should open `mylife://flash/study` to land on the study screen.
