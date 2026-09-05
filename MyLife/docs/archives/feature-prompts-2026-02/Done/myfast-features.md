# MyFast Feature Set

## Problem Statement

You are working in the MyLife monorepo at `/Users/trey/Desktop/Apps/MyLife/`. MyLife is a unified hub app consolidating 10+ privacy-first personal app modules into a single cross-platform application. Each module implements a `ModuleDefinition` contract from `@mylife/module-registry` and stores data in a shared SQLite database using table-name prefixes (`ft_` for fast).

**MyFast** is a privacy-first intermittent fasting timer. It is the **only free-tier module** in MyLife (always unlocked, no subscription required). The standalone source of truth lives at `/Users/trey/Desktop/Apps/MyLife/MyFast/`, a Turborepo monorepo with `apps/mobile/` (Expo), `apps/web/` (Next.js 15), and `packages/shared/`. The hub module lives at `modules/fast/`.

**What already exists:** Timestamp-based fasting timer with animated progress ring, 6 preset fasting protocols (16:8, 18:6, 20:4, OMAD 23:1, 5:2, Eat-Stop-Eat) plus custom durations, fasting history log, streak tracking (current and longest), statistics (average duration, adherence rate, weekly rollup, monthly heatmap, duration trend over time), weight tracking with entries, and CSV export. The app has a complete DESIGN.md, APPSTORE.md, PRIVACY.md, and README.md.

**MyFast is standalone** (no absorbed apps). As the free-tier module, it serves as the gateway to the MyLife suite, so polish and delight are especially important.

**What needs to be built (1 feature set):**

### Feature Set 1: Health Integration and Engagement

Features that make MyFast more engaging and health-aware, encouraging users to upgrade to the full MyLife suite.

**Features:**
- Water intake tracking: log glasses/bottles of water during a fast with a daily target and visual progress indicator
- Fasting zones / body status visualization: show the metabolic stage the user is currently in based on elapsed time (e.g., 0-4h: "Fed State - Insulin Rising", 4-8h: "Early Fasting - Insulin Dropping", 8-12h: "Fat Burning - Glucagon Active", 12-18h: "Ketosis Beginning", 18-24h: "Deep Ketosis", 24h+: "Autophagy Possible") with educational descriptions per zone
- Fasting start/end notifications: push notification reminders when a fast begins and when the target duration is reached, with optional periodic check-ins ("You're 75% through your fast!")
- Monthly and annual stats summary: a shareable recap card showing total fasts, total hours fasted, average duration, longest fast, streak, and adherence rate
- Goal setting beyond streaks: set targets for total hours fasted per week/month, number of fasts per week, or weight loss milestones
- Apple Health / Google Fit integration: sync fasting windows and weight data to/from Health platforms (read weight entries, write fasting periods)
- Home screen widget: iOS/Android widget showing current fast status (timer, progress ring, next eating window)

---

## Acceptance Criteria

1. User starts a 16:8 fast and opens the timer screen -> sees the progress ring filling up; below the timer, a "Metabolic Zone" card shows the current zone (e.g., "Fat Burning" at 6 hours) with a brief educational description and an illustration of the body's metabolic state; the zone card auto-updates as the fast progresses
2. User taps "Log Water" during a fast -> a counter increments (e.g., 3/8 glasses); a water drop icon on the timer screen fills proportionally to the daily target; at 8/8, a "Hydration Goal Met" badge appears
3. User starts a fast -> receives a push notification confirming "Fast started - 16:8 protocol"; at 75% completion (12 hours for a 16h fast), receives "You're 75% there! Keep going"; at target completion (16 hours), receives "Congratulations! Fast complete - time to eat"
4. User opens "Monthly Summary" at the end of January -> sees a card with total fasts (22), total hours fasted (352h), average duration (16h), longest fast (20h), adherence rate (91%), and current streak (8 days); taps "Share" -> the card is exported as a PNG image
5. User sets a weekly goal of "5 fasts per week" -> the home screen shows a progress indicator (3/5 this week); at week end, the goal result is logged and displayed in the goal history
6. User enables Apple Health integration -> weight entries logged in MyFast appear in Apple Health; fasting periods sync as "Mindful Minutes" or a custom fasting category; weight entries from Apple Health are imported into MyFast
7. User adds a MyFast widget to their iPhone home screen -> the widget shows current fast status (elapsed time, progress percentage, protocol name) and updates in real time; when not fasting, it shows "Next fast" with time since last eating window ended

---

## Constraint Architecture

**Musts:**
- All data stored in local SQLite with `ft_` prefix (new tables: `ft_water_intake`, `ft_goals`, `ft_goal_progress`, `ft_notifications_config`)
- Zero subscription requirement (this is the free-tier module; all features must work without MyLife Pro)
- Fasting zone definitions must be configurable (stored as a JSON constant, not hardcoded in UI logic) so they can be updated with new research
- Push notifications via Expo Notifications with user-configurable preferences (opt-in per notification type)
- Widget via expo-widget or react-native-widget-extension
- Both standalone (`MyFast/`) and hub module (`modules/fast/`) must receive changes

**Must-nots:**
- Do not add premium/paid features to MyFast (it must remain fully free)
- Do not add cloud sync or accounts
- Do not provide medical advice or medical claims in fasting zone descriptions (use hedging language like "research suggests" and "may occur")
- Do not modify `packages/module-registry/` or other modules
- Do not break existing timer, history, or stats functionality

**Preferences:**
- Water intake UI should be a simple tap-to-increment counter, not a complex fluid tracking system
- Fasting zone visualization should be a vertical timeline or stepped progress bar alongside the existing circular timer
- Apple Health integration via `expo-health-connect` (Android) and `expo-apple-healthkit` (iOS) if available in the Expo ecosystem
- Monthly summary card should match the existing dark theme and be visually appealing for social sharing
- Widget should use the smallest possible bundle size and update every 15 minutes (iOS widget refresh constraint)

**Escalation triggers:**
- If Apple Health / Google Fit integration requires ejecting from Expo managed workflow, defer to a later phase and document
- If iOS widget development requires native Swift code outside Expo's widget support, implement Android widget only and document the iOS limitation
- If fasting zone science is contested or varies significantly by source, add a disclaimer and cite sources in the educational descriptions

---

## Subtask Decomposition

**Subtask 1: Water Intake Tracking (45 min)**
Add `ft_water_intake` table (date, count, target). Build water logging UI: tap-to-increment counter with visual progress indicator on the timer screen. Display daily total and target completion.

**Subtask 2: Fasting Zones Visualization (60 min)**
Define fasting zone thresholds as a JSON configuration (zone name, start hour, end hour, description, icon). Build the zone display card on the timer screen that updates as elapsed time crosses zone boundaries. Write educational descriptions with appropriate hedging language.

**Subtask 3: Notifications System (45 min)**
Add `ft_notifications_config` table for user preferences. Implement push notifications for: fast start confirmation, periodic progress (25%, 50%, 75%), and fast completion. Build notification preferences UI (toggle per notification type).

**Subtask 4: Goals and Monthly Summary (60 min)**
Add `ft_goals` and `ft_goal_progress` tables. Build goal creation (fasts per week, hours per month, weight milestones). Track goal progress automatically from existing fast and weight data. Build monthly/annual summary card renderer with PNG export for sharing.

**Subtask 5: Health Platform Integration (90 min)**
Integrate Apple HealthKit and Google Health Connect via Expo libraries. Sync weight entries bidirectionally. Write fasting periods to the health platform. Handle permissions, unavailability, and opt-out gracefully.

**Subtask 6: Home Screen Widget (60 min)**
Build an iOS and Android home screen widget showing current fast status: elapsed time, progress ring, protocol name. Handle the "not fasting" state with time since last eating window. Implement periodic refresh (every 15 minutes on iOS, more frequent on Android).

---

## Evaluation Design

1. **Water tracking:** Log 5 glasses on a day with target 8 -> `getWaterIntake(today)` returns {count: 5, target: 8, completed: false}; log 3 more -> completed flips to true
2. **Fasting zones:** Start a fast, simulate 10 hours elapsed -> `getCurrentZone(10)` returns "Fat Burning" with the correct description; simulate 14 hours -> returns "Ketosis Beginning"
3. **Notifications:** Start a 16-hour fast -> verify scheduled notifications exist at 4h (25%), 8h (50%), 12h (75%), and 16h (complete)
4. **Goal tracking:** Set goal "5 fasts/week", complete 3 fasts -> `getGoalProgress(goalId)` returns {current: 3, target: 5, completed: false}
5. **Type safety:** `pnpm typecheck` exits 0; `pnpm check:parity` exits 0; existing tests pass
