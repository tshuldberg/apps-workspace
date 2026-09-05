# MyHabits - Feature Gap Design Doc

**Source:** Competitive Feature Analysis (2026-03-05)
**Updated:** CEO Review (2026-03-24)
**Status:** Complete (27 tables, 5 migrations, 100% competitive parity)

## Current State

MyHabits is a fully implemented module with 9 database tables supporting habit tracking across daily, weekly, and monthly frequencies. Core features include streak tracking, timed sessions, measurements, heatmap visualization, menstrual cycle tracking, and fertility predictions. All data is stored locally in SQLite with the `hb_` table prefix.

## Competitors Analyzed

| Competitor | Pricing | Category |
|------------|---------|----------|
| Habitify | $40/yr | Habit tracking, analytics |
| Habitica | $48/yr | Gamified habit RPG |
| Streaks | $5 once | Minimalist streak tracker |
| Productive | $24/yr | Smart habit reminders |
| Toggl | $108/user/yr | Time tracking |
| Forest | $4 once | Focus timer |
| Sorted3 | $15 once | Calendar + tasks hybrid |
| I Am Sober | $40/yr | Sobriety tracking |
| Smoke Free | Freemium | Quit smoking tracker |
| Finch | Freemium | Self-care pet companion |

## Feature Gaps

| Feature | Priority | Competitors That Have It | Implementation Difficulty | Notes |
|---------|----------|--------------------------|---------------------------|-------|
| Negative habit tracking | P0 | Habitica, Streaks | Low | Track habits to break (smoking, nail biting, etc.) with "days since" counter |
| Sobriety clock with money saved | P0 | I Am Sober ($40/yr), Smoke Free | Low | Days sober, money saved calculator, health recovery timeline. Extremely privacy-sensitive. I Am Sober charges $40/yr for this. |
| Craving log with triggers | P1 | I Am Sober, Smoke Free | Low | Log cravings with time, intensity, trigger, and outcome |
| Milestone celebrations | P1 | I Am Sober | Low | Celebrate sobriety milestones (1 week, 1 month, 100 days, 1 year) |
| RPG gamification (XP, levels) | P1 | Habitica | Medium | Earn XP for completing habits, level up character |
| Focus timer (Pomodoro) | P1 | Forest ($4), Sorted3 | Low | Timer with tree/plant growing animation, phone-down enforcement |
| Apple Health auto-tracking | P1 | Habitify, Streaks | Medium | Auto-complete habits based on HealthKit data (steps, sleep, water) |
| Challenges/programs | P1 | Habitify, Habitica, Productive | Medium | Multi-week structured habit building programs (e.g., "30 days of meditation") |
| Achievement badges | P1 | Smoke Free, various | Low | Visual badge collection for milestones |
| Daily pledge system | P2 | I Am Sober | Low | Morning commitment ritual |
| Pet/avatar collection | P2 | Habitica, Finch | Medium | Virtual companion that grows healthier as you complete habits |
| Location-based reminders | P2 | Productive | Medium | Remind to do habit when arriving at gym/home/office |
| Siri shortcuts | P2 | Streaks, Productive | Low | "Hey Siri, log my meditation" |
| Time tracking (billable hours) | P2 | Toggl ($108/user/yr) | Medium | Track time spent on tasks/projects with reports |
| Calendar + tasks unified view | P2 | Sorted3 | Medium | See habits alongside calendar events |
| Action lists (sub-tasks) | P2 | Habitify, Habitica, Sorted3 | Low | Break habits into sub-steps |
| Boss fights (team challenges) | P3 | Habitica | High | Group challenges where missed habits damage the team |

## Recommended Features -- ALL BUILT

All 7 recommended features from the original analysis are implemented:

1. **Negative habit tracking with sobriety clock** -- BUILT (V3). Sobriety profiles with quit date, daily cost, money saved, pledge system, craving log with triggers and coping strategies. Replaces I Am Sober ($40/yr).

2. **Craving log with triggers and milestones** -- BUILT (V3). 6 trigger categories (emotional, social, environmental, physical, routine, custom), intensity 1-10, outcome tracking (resisted/gave_in/distracted/delayed), 5 milestone types.

3. **Focus timer (Pomodoro)** -- BUILT (V3). Full Pomodoro state machine with work/break/long-break phases, pause/resume/skip, configurable durations, session stats.

4. **Apple Health auto-tracking** -- BUILT (V3). HealthKit bridge with configurable thresholds, comparison operators, data sources for steps/sleep/water/exercise.

5. **Achievement badges and RPG elements** -- BUILT (V4). 37 badges across 5 categories, XP/level system with 1.2x exponential curve, 12 unlockable items, streak bonus XP.

6. **Structured challenges/programs** -- BUILT (V4). 8 built-in programs (meditation, C25K, morning routine, no sugar, reading, hydration, digital detox, gratitude) with linear interpolation scheduling.

7. **Action lists (sub-tasks)** -- BUILT (V5). Ordered checklists per habit with individual completion tracking, auto-complete parent on all-done, reordering support.

## Additional Features Beyond Original Analysis (V5)

8. **Habit stacking** -- Atomic Habits methodology. Chain habits in sequences (before/after/with links). Circular dependency validation. Next-in-chain prompting.

9. **Streak freeze/insurance** -- 2 freezes per month. Frozen dates bridge streak gaps without breaking or incrementing. Smart suggestion when past typical completion time.

## Privacy Competitive Advantage

Sobriety data, addiction recovery progress, and productivity/focus metrics are among the most sensitive personal data categories. I Am Sober requires a cloud account and stores recovery data on their servers. Habitica stores all habit data in their cloud. Toggl uploads all time tracking data to their infrastructure.

MyHabits keeps everything local on-device:

- **Sobriety/addiction data** never leaves the device. No risk of a data breach exposing someone's recovery journey.
- **Focus and productivity data** stays private. No employer or advertiser sees work patterns.
- **Menstrual cycle data** (already implemented) remains local, which is increasingly important given legal scrutiny of period tracking apps.
- **Habit patterns** reveal daily routines, sleep schedules, and lifestyle choices. MyHabits ensures this data is never monetized or shared.

The privacy angle is especially strong for the sobriety clock feature: users tracking addiction recovery should never have to trust a third party with that information.

## Cross-Module Integration

| Integration | Module | Description |
|-------------|--------|-------------|
| Health impact tracking | MyHealth | Correlate habit streaks with health metrics (sleep quality improves with meditation habit) |
| Medication adherence | MyMeds | Surface medication schedules as trackable habits with adherence scoring |
| Fasting as habit | MyFast | Fasting windows appear as habit entries with automatic completion |
| Reflection journaling | MyJournal | Prompt journal entries when habits are completed or streaks are broken |
| Mood correlation | MyMood | Chart mood trends against habit completion rates to identify which habits improve wellbeing |
| Exercise habits | MyWorkouts | Auto-complete exercise habits from logged workouts |
| Nutrition habits | MyNutrition | Track food-related habits (water intake, veggie servings) with nutrition module data |
