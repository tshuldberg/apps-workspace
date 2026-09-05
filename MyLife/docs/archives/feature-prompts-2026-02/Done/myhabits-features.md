# MyHabits Feature Set

## Problem Statement

You are working in the MyLife monorepo at `/Users/trey/Desktop/Apps/MyLife/`. MyLife is a unified hub app consolidating 10+ privacy-first personal app modules into a single cross-platform application. Each module implements a `ModuleDefinition` contract from `@mylife/module-registry` and stores data in a shared SQLite database using table-name prefixes (`hb_` for habits).

**MyHabits** is a privacy-first habit tracking app. The standalone directory lives at `/Users/trey/Desktop/Apps/MyLife/MyHabits/` with basic Expo and Next.js app shells (`apps/` directory) and a `DESIGN.md` that defines the MVP specification. The hub module lives at `modules/habits/`. Most of the planned MVP is not yet built. DESIGN.md specifies: habit CRUD, daily completions, streak tracking, heatmap visualization, habit archive, drag-to-reorder, CSV export, and home screen widgets.

**Current state:** Early development. The standalone has basic Expo/Next.js layout files but no shared package, no database schema, no habit engine. This is largely a ground-up build informed by the DESIGN.md specification.

**Consolidation context:** MyHabits absorbs **MyCycle** (a planned period/cycle tracking app that does not yet have runtime code). The combined app becomes a "Patterns" hub: daily habits and biological cycles are both pattern-tracking activities. The unique value proposition is tracking all personal patterns in one privacy-first app. Cycle tracking is a post-Dobbs privacy play: all data stays on-device with zero cloud dependency.

**What needs to be built (3 feature sets):**

### Feature Set 1: Core Habit Tracking (MVP)

The foundation that competes with Streaks, Habitica, and Loop Habit Tracker.

**Features:**
- Habit CRUD: create habits with name, icon, color, frequency (daily/weekly/specific days), time of day (morning/afternoon/evening/anytime), and optional target
- Daily completions: tap to mark done, with timestamp
- Streak tracking: current streak, longest streak, streak recovery (allow 1 grace day)
- Heatmap visualization: GitHub-style contribution grid showing completions over the past year
- Habit archive: hide completed or paused habits without deleting data
- Drag-to-reorder: custom habit display order
- CSV export of all habit data

### Feature Set 2: Advanced Habit Types

Features that differentiate from basic trackers.

**Features:**
- Timed habit tasks: built-in timer for habits like "meditate 10 minutes," auto-complete when target duration is reached
- Negative / "break a bad habit" tracking: track days since last occurrence (e.g., "days without smoking"), streak counts up from last slip
- Measurable / quantitative habits: numeric targets (e.g., "drink 8 glasses of water" -- tap increments the count, completes at target)
- Habit completion statistics: completion rate by day of week, time of day patterns, monthly/yearly summaries
- Habit reminders / notifications: configurable push notifications per habit at the scheduled time
- Siri Shortcuts / quick actions: mark a habit complete from the home screen or via Siri without opening the app

### Feature Set 3: Cycle Tracking (MyCycle Consolidation)

MyCycle features integrate as a "Cycle" section within MyHabits. Period tracking is a pattern-tracking activity that fits naturally alongside daily habits.

**Features:**
- Period tracking: log start and end dates of each period
- Moving-average prediction algorithm: predict next period start date based on the user's historical cycle lengths (all computation local, no cloud)
- Cycle calendar visualization: month view showing period days, predicted days, and fertile window
- Symptom logging per cycle day: predefined symptoms (cramps, headache, mood swings, bloating, fatigue) plus custom symptoms with severity scale
- Fertility window estimation: based on cycle length averages and ovulation day calculation (day 14 of average cycle, adjusted for individual patterns)
- Post-Dobbs privacy: all data on-device, no cloud sync, no accounts, encrypted at rest, no analytics or telemetry of any kind

---

## Acceptance Criteria

### Feature Set 1: Core Habit Tracking

1. User taps "New Habit" -> fills in name ("Morning Run"), selects an icon and color, sets frequency to "weekdays only" -> the habit appears on the daily view with a circle to tap; tapping it marks today as complete with a checkmark animation
2. User completes a habit 7 days in a row -> sees "7-day streak" badge on the habit; misses one day but completes the next -> streak shows "1 day" (reset); if grace day is enabled, streak shows "8 days" (preserved through 1 missed day)
3. User opens the heatmap view for a habit -> sees a year-long grid colored by completion density (darker = more completions); tapping a specific week shows daily breakdown

### Feature Set 2: Advanced Habit Types

4. User creates a timed habit "Meditate" with a 10-minute target -> taps "Start" -> a countdown timer runs; at 10:00 the habit auto-completes and a "session complete" sound plays; if the user stops early at 6:00, the partial session is logged but the habit is not marked complete
5. User creates a negative habit "No Snacking After 9 PM" -> the tracker shows "12 days since last slip"; user taps "I slipped" -> counter resets to 0; the history preserves all slip dates for trend analysis
6. User creates a measurable habit "Drink 8 Glasses" -> sees a counter at 0/8; each tap increments by 1; at 8/8 the habit auto-completes for the day

### Feature Set 3: Cycle Tracking

7. User navigates to the Cycle section and logs a period start date -> after logging 3+ complete cycles, the app predicts the next period start date with a "predicted" label and a confidence indicator based on cycle regularity
8. User opens the cycle calendar -> sees red-highlighted period days, pink-highlighted predicted days, and a green-highlighted estimated fertile window; tapping a day opens a symptom logger with predefined options and severity slider
9. User opens Cycle Stats -> sees average cycle length, cycle length variation, and a month-by-month history; all data displayed with a privacy badge confirming "All data stored on this device only"

---

## Constraint Architecture

**Musts:**
- All data stored in local SQLite with `hb_` prefix (tables: `hb_habits`, `hb_completions`, `hb_streaks`, `hb_habit_order`, `hb_timed_sessions`, `hb_measurements`) and `cy_` prefix for cycle data (`cy_periods`, `cy_symptoms`, `cy_predictions`, `cy_settings`)
- Zero network calls for any feature
- Cycle prediction algorithm must be purely local (moving average of last 3-6 cycle lengths)
- Cycle data encrypted at rest (application-level AES-256)
- Push notifications for habit reminders via Expo Notifications (mobile) and browser Notification API (web)
- Both standalone (`MyHabits/`) and hub module (`modules/habits/`) must receive changes

**Must-nots:**
- Do not add cloud sync, accounts, or telemetry for any feature
- Do not transmit cycle data off-device under any circumstance
- Do not use third-party health tracking SDKs
- Do not modify `packages/module-registry/` or other modules
- Do not add fertility/pregnancy features beyond basic window estimation (this is not a fertility treatment app)

**Preferences:**
- Start from the DESIGN.md specification as the architectural blueprint
- Habit reordering via drag-and-drop on mobile (react-native-reanimated) and drag events on web
- Heatmap component should be reusable and added to `packages/ui/` for potential use by other modules
- Cycle prediction should display confidence (e.g., "+/- 2 days") based on standard deviation of past cycles
- Use Expo SecureStore for the encryption key on mobile

**Escalation triggers:**
- If the DESIGN.md specification conflicts with the consolidation requirements, prioritize the consolidation map and document the deviation
- If Siri Shortcuts require native Swift code outside Expo's capabilities, defer to a later native integration phase
- If encryption of cycle data introduces noticeable UI lag (> 100ms per read), consider encrypting only at the database level rather than per-field

---

## Subtask Decomposition

**Subtask 1: Habit Schema and CRUD (90 min)**
Implement the full habit SQLite schema with `hb_` prefix following DESIGN.md. Build habit CRUD operations with frequency parsing (daily, weekly, specific days). Implement drag-to-reorder with persistent ordering.

**Subtask 2: Completions, Streaks, and Heatmap (90 min)**
Build daily completion logging with timestamps. Implement streak calculator with configurable grace period. Build heatmap data queries (year of daily completion counts). Create the heatmap UI component in `packages/ui/`.

**Subtask 3: Advanced Habit Types (60 min)**
Implement timed habits (countdown timer, auto-complete at target). Implement negative habits (days-since counter, slip logging). Implement measurable habits (numeric increment, auto-complete at target).

**Subtask 4: Statistics, Notifications, and Export (60 min)**
Build completion statistics engine (rate by day of week, time of day, monthly/yearly summaries). Implement push notification reminders per habit. Build CSV export for all habit data.

**Subtask 5: Cycle Tracking Schema and Engine (90 min)**
Add cycle tables with `cy_` prefix. Build period logging (start/end dates). Implement moving-average prediction algorithm with confidence intervals. Build fertile window estimation. Encrypt cycle data at rest.

**Subtask 6: Cycle UI and Symptom Logging (60 min)**
Build cycle calendar visualization (period days, predicted days, fertile window). Implement symptom logger with predefined symptoms, custom symptoms, and severity scale. Build cycle statistics view.

---

## Evaluation Design

1. **Streak calculation:** Log completions for 5 consecutive days, skip day 6, complete day 7 with grace enabled -> `getStreak(habitId)` returns 7; with grace disabled -> returns 1
2. **Timed habit:** Start a 10-minute habit timer -> at 10:00 the completion is auto-logged; stop at 6:00 -> `getCompletion(habitId, today)` returns null (incomplete)
3. **Cycle prediction:** Log 4 cycles with lengths [28, 30, 29, 27] -> `predictNextPeriod()` returns a date 28.5 days after last period start with confidence "+/- 1.3 days"
4. **Cycle encryption:** Write a period entry -> raw SQLite query on `cy_periods` returns encrypted content; decrypt with correct key -> original dates match
5. **Type safety:** `pnpm typecheck` exits 0; `pnpm check:parity` exits 0
