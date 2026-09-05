# Habitify vs MyHabits -- Competitor Review

**Date:** 2026-03-29
**Reviewer:** Claude (automated analysis)
**MyHabits module:** `modules/habits/src/` (27 tables, 18 engines, 289 tests)

---

## Methodology

Each Habitify feature was cataloged from the app walkthrough, then cross-referenced against:
- `modules/habits/src/index.ts` (public API)
- `modules/habits/src/types.ts` (data model)
- `apps/mobile/app/(habits)/` (23 screens)
- Engine source files under `modules/habits/src/*/engine.ts`

Status key: **YES** = fully implemented, **PARTIAL** = logic exists but UI or scope is incomplete, **NO** = not present.

---

## Feature Comparison

### ONBOARDING

| # | Habitify Feature | MyHabits | Notes |
|---|-----------------|----------|-------|
| 1 | Welcome splash with "Tiny changes, remarkable results" value prop | **NO** | No onboarding flow exists. App launches directly to Today screen. |
| 2 | 4-step progress bar onboarding | **NO** | No guided onboarding wizard. |
| 3 | "Pick a two-minute action" starter habit picker (drink water, stretch, vitamins, plank, walk, squats) | **NO** | No preset habit templates. User must create from scratch via Add Habit screen. |
| 4 | Immediate completion celebration: confetti + "1 day streak!" + weekly dot tracker | **NO** | No confetti or celebration animation. Streaks are shown inline on habit rows but no first-completion fanfare. |
| 5 | Premium upsell with 14-day free trial ($39.99/yr) | **PARTIAL** | Module is tier: premium in registry, but no in-app upsell screen or trial flow exists in the habits screens. Subscription is handled at the hub level by `@mylife/subscription`. |

### JOURNAL / HOME

| # | Habitify Feature | MyHabits | Notes |
|---|-----------------|----------|-------|
| 6 | "My Journal" header with edit + sort icons | **PARTIAL** | Header says "Today" with a hamburger menu. No edit/sort icons on the home screen itself. Sort is available on the All Habits screen via up/down arrows. |
| 7 | Area filter pills (All Habits, + New Area) for habit grouping | **NO** | No area/category grouping system. Habits are a flat list. The `Habit` schema has no `area` or `category` field. |
| 8 | Habit cards: icon, name, completion count (1/1), "+ Log" button | **YES** | Habit rows show icon, name, type badge, streak info, and an action button (checkbox/timer/counter). Completion count shown for measurable type (e.g. "2/5"). |
| 9 | Strikethrough on completed habits | **PARTIAL** | Completed habits get dimmed text color (`colors.textSecondary`) but no CSS strikethrough decoration. |
| 10 | "Undo last action" modal | **NO** | No undo modal. Standard habits toggle completion on tap (acts as implicit undo), but there is no explicit undo confirmation dialog. |
| 11 | Day-of-week horizontal scroll bar (dates, current highlighted) | **NO** | No date navigation. Today screen is fixed to the current date. No way to view past dates without going to Statistics. |
| 12 | 4-tab navigation: Journal, Progress, Friends, Settings | **NO** | Navigation is a hamburger menu with 15 items, not a tab bar. No Friends tab. |
| 13 | "+" FAB for adding habits | **NO** | No floating action button. Adding habits requires navigating through hamburger menu -> All Habits screen or using the `add-habit` route directly. |

### HABIT CREATION

| # | Habitify Feature | MyHabits | Notes |
|---|-----------------|----------|-------|
| 14 | Name input with icon picker | **YES** | `add-habit.tsx` has name TextInput + 20-emoji grid picker + 10-color picker. |
| 15 | Repeat: Everyday / specific days / interval | **YES** | `FrequencySchema`: daily, weekly, monthly, specific_days. Specific days shows Mon-Sun toggles. |
| 16 | Goal: X times per day/week, or X minutes (timed habits) | **YES** | `targetCount` field. Measurable type = count target. Timed type = duration target (seconds). |
| 17 | Time of Day: Anytime / Morning / Afternoon / Evening | **YES** | `TimeOfDaySchema`: morning, afternoon, evening, anytime. Chip selector in add-habit. |
| 18 | Area categorization (group habits by life area) | **NO** | No area/category field on `HabitSchema`. No grouping UI. |
| 19 | Multiple time-based reminders (6:30 AM, 9:00 AM) | **PARTIAL** | Schema has `reminderTime` (single string, nullable). Only one reminder per habit. No multiple-reminder support. No notification scheduling implemented in UI. |
| 20 | Checklist (sub-tasks within a habit) | **YES** | Full action items system: `ActionItemSchema`, `ActionCompletionSchema`, `createActionItem`, `calculateActionProgress`, `shouldAutoCompleteHabit`. Engine + CRUD + tests. |
| 21 | Start Date / End Date (or Never) | **PARTIAL** | `SobrietyProfile` has `startDate`/`endDate`. `ProgramEnrollment` has `startDate`. But the core `Habit` schema itself has `createdAt` only, no explicit start/end date fields for scheduling. |
| 22 | **Magic Fill AI**: natural language input auto-parses into structured habit | **NO** | No AI/NLP parsing. All habit creation is manual form input. |
| 23 | **Location Reminders**: trigger at specific GPS locations (enter/leave geofence) | **YES** | Full implementation: `LocationReminderSchema` with `triggerType` (arrival/departure/dwell), `latitude`/`longitude`/`radius`. Engine: `shouldShowNotification`, `validateRadius`, `validateCoordinates`. Dedicated `locations.tsx` screen. |
| 24 | **Habit Stacking**: link habits -- "When [A] completed, remind me to do [B]" | **YES** | Full implementation: `HabitLinkSchema` with types: before/after/with. Engine: `resolveStack`, `getNextInStack`, `getParallelHabits`, `validateNoCircularDependency`. Dedicated `stacking.tsx` screen. |

### FRIENDS

| # | Habitify Feature | MyHabits | Notes |
|---|-----------------|----------|-------|
| 25 | Friends page with avatar bubbles | **NO** | No social features. MyHabits is privacy-first, offline-only. No user accounts, no friend system. |
| 26 | Circle: share progress, send kudos, multi-goal accountability | **NO** | No accountability groups. |
| 27 | Challenge: race against friends, single goal, time limit | **PARTIAL** | `challenges/engine.ts` has 8 built-in programs (30-Day Minimalist, Couch to 5K, etc.) with enrollment tracking, but these are solo programs, not social challenges. |
| 28 | "Create Your First Squad" CTA | **NO** | No social onboarding. |

### SETTINGS

| # | Habitify Feature | MyHabits | Notes |
|---|-----------------|----------|-------|
| 29 | Off Mode (pause streaks without breaking them) | **YES** | `streak-freeze/engine.ts`: `canFreeze`, `remainingFreezes`, `calculateStreakWithFreezes`, `shouldSuggestFreeze`, `MAX_FREEZES_PER_MONTH`. Full CRUD for `hb_streak_freezes` table. |
| 30 | Import from Streaks / Productive (competitor import) | **NO** | No competitor-specific importers. The hub has `@mylife/migration` but it targets standalone MyLife apps, not third-party habit trackers. |
| 31 | CSV + Backup export/import | **PARTIAL** | CSV export: `exportHabitsCSV`, `exportCompletionsCSV`, `exportAllCSV` (all implemented). CSV import: **NO** -- no import function exists. No full backup/restore. |
| 32 | NFC Tag integration (tap phone to mark habit done) | **NO** | No NFC support. No hardware integration beyond HealthKit. |
| 33 | App Badge setting (all habits / specific) | **NO** | No app badge configuration. Notifications are minimal (single `reminderTime` field). |
| 34 | First Day of Week setting | **YES** | `settings.tsx` has "Week Starts On" with Monday/Sunday toggle, stored via `getSetting`/`setSetting`. |
| 35 | Journal name customization | **NO** | No customizable screen title. Header is hardcoded "Today". |

---

## Summary Scorecard

| Category | Habitify Features | YES | PARTIAL | NO |
|----------|------------------|-----|---------|-----|
| Onboarding | 5 | 0 | 1 | 4 |
| Journal / Home | 8 | 1 | 2 | 5 |
| Habit Creation | 11 | 5 | 2 | 4 |
| Friends | 4 | 0 | 1 | 3 |
| Settings | 7 | 2 | 1 | 4 |
| **Total** | **35** | **8** | **7** | **20** |

**Coverage: 23% full, 20% partial, 57% missing**

---

## Gap Priority Matrix

### High Priority (user-facing, high retention impact)
- **Onboarding flow** (#1-4): First-run experience is critical for retention. Currently zero guidance.
- **Area grouping** (#7, #18): Power users with 10+ habits need categorization.
- **Date navigation** (#11): Users must be able to view/edit past days.
- **FAB button** (#13): Discoverability of "add habit" is buried in hamburger menu.
- **Undo modal** (#10): Prevents accidental taps from frustrating users.
- **Strikethrough styling** (#9): Visual satisfaction of completing a habit.
- **Multiple reminders** (#19): Single reminder is insufficient for time-based habits.

### Medium Priority (competitive differentiation)
- **Magic Fill AI** (#22): Marquee feature that reduces friction. Could leverage device-local LLM or structured NLP.
- **Starter habit templates** (#3): Reduces blank-slate anxiety.
- **Celebration animations** (#4): Dopamine loop for streak milestones.
- **CSV import** (#31): Users switching from other apps need data portability.
- **Habit start/end dates** (#21): Temporary habits and challenges need scheduling.

### Low Priority (nice-to-have or philosophy mismatch)
- **Friends/Social** (#25-28): Conflicts with privacy-first philosophy. Could be opt-in cloud feature in future.
- **NFC Tag** (#32): Hardware integration, niche use case.
- **Competitor import** (#30): Requires reverse-engineering each app's export format.
- **Journal name customization** (#35): Minor personalization.
- **App badge setting** (#33): Requires full notification system first.
- **Premium upsell** (#5): Hub-level concern, not module-level.
- **Tab navigation** (#12): Architectural decision; hamburger works but tabs improve discoverability.

---

## MyHabits Exclusive Features (Not in Habitify)

MyHabits has several features Habitify does not offer:

| Feature | Engine | Description |
|---------|--------|-------------|
| Sobriety Clock | `sobriety/engine.ts` | Full sobriety tracking with pledges, money saved, lifetime stats |
| Craving Log | `sobriety/craving-engine.ts` | Trigger frequency analysis, intensity trends, peak times, coping effectiveness |
| Focus Timer (Pomodoro) | `focus/engine.ts` | Full Pomodoro state machine with phases, pause/resume, stats |
| HealthKit Auto-tracking | `healthkit/bridge.ts` | Link habits to Apple Health data sources for automatic completion |
| RPG Gamification | `rpg/engine.ts` | XP, leveling (1.2x exponential curve), unlockable items |
| Virtual Pet | `pet/engine.ts` | Pet companion with mood tracking, species catalog, wardrobe |
| Achievement Badges | `badges/engine.ts` | 37 badges across 5 categories with detection engine |
| Time Tracking | `time-tracking/engine.ts` | Billable project tracking with CSV reports |
| Siri Shortcuts | `siri/engine.ts` | Voice-activated habit completion |
| Cycle Tracking | `cycle/` | Menstrual cycle prediction (deprecated, moved to @mylife/cycle) |
| Grace Period Streaks | `db/streaks.ts` | Configurable forgiveness for missed days |
| Negative Habit Tracking | types.ts | Track avoidance habits with slip logging |
| Measurable Habits | types.ts | Numeric targets (cups of water, pages read) |
| Heatmap | `heatmap.ts` | GitHub-style contribution heatmap |

---

## Recommended Implementation Order

1. **Date navigation bar** (highest UX impact, unblocks historical editing)
2. **FAB button** (simple, high discoverability win)
3. **Area grouping** (schema change + UI, enables organized habit management)
4. **Onboarding flow** (4 screens, retention critical)
5. **Starter templates** (pairs with onboarding)
6. **Undo modal** (small UX polish)
7. **Strikethrough styling** (CSS-only change)
8. **Multiple reminders** (schema migration + notification scheduling)
9. **Celebration animations** (confetti library integration)
10. **Magic Fill AI** (largest effort, highest wow factor)
11. **CSV import** (data portability)
12. **Habit start/end dates** (schema + UI)
