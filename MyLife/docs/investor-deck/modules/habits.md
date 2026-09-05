# MyHabits — Module Audit

**ID:** habits | **Prefix:** hb_ | **Tier:** premium | **Storage:** sqlite
**Mobile wired:** yes | **Web wired:** yes | **Version:** 0.5.0
**One-line promise:** Your complete habit system

## User Value
- Build and break habits with streaks, area grouping, stacks, and sub-tasks
- Sobriety tracker with craving log, triggers, money saved, milestones
- Pomodoro focus timer, time tracking with billable projects, heatmap stats
- RPG gamification: XP, levels, virtual pet companion, 37 badges
- HealthKit auto-tracking + location-based reminders + Siri shortcuts

## Feature Inventory (code-verified)
| Feature | Source | Status |
|---|---|---|
| Habit CRUD + streaks + grace periods | src/db/crud.ts, src/db/streaks.ts | shipped |
| Habit stacking (chains) | src/stacking, src/db/stacking.ts | shipped |
| Streak freezes | src/streak-freeze, src/db/streak-freezes.ts | shipped |
| Action items (sub-tasks) | src/db/actions.ts | shipped |
| Sobriety clock + pledges + cravings | src/sobriety | shipped |
| Focus timer (Pomodoro state machine) | src/focus/engine.ts | shipped |
| Time tracking + billable projects | src/time-tracking/engine.ts | shipped |
| Challenges/programs (8 built-in) | src/challenges/engine.ts | shipped |
| Badges (37 across 5 categories) | src/badges/engine.ts | shipped |
| RPG player profile, XP, levels | src/rpg/engine.ts | shipped |
| Virtual pet companion | src/pet/engine.ts | shipped |
| HealthKit auto-tracking | src/healthkit | shipped |
| Location-based reminders | src/location/engine.ts | shipped |
| Siri shortcuts | src/siri/engine.ts | shipped |
| Milestones, heatmap, stats | src/milestones, heatmap.ts, stats.ts | shipped |
| Multiple reminders per habit | schema V7 | shipped |
| Magic fill templates | src/magic-fill, templates.ts | shipped |
| Import/export | src/import.ts, src/export.ts | shipped |

## Data Model
Prefix `hb_`, schema v8. 26 tables: hb_habits, hb_completions, hb_settings, hb_timed_sessions, hb_measurements, hb_sobriety_profiles, hb_sobriety_pledges, hb_cravings, hb_craving_triggers, hb_milestones, hb_focus_sessions, hb_healthkit_links, hb_programs, hb_program_enrollments, hb_badges, hb_projects, hb_player_profile, hb_xp_transactions, hb_pet_state, hb_location_reminders, hb_habit_links, hb_streak_freezes, hb_action_items, hb_action_completions, hb_areas, hb_reminders. V8 dropped deprecated cycle tables (moved to @mylife/cycle).

## Screens / User Flows
Mobile tabs: Today, Habits, Stats, Settings. Stack screens: habit-detail, add-habit, streak-detail, sobriety-clock, log-craving, craving-insights, focus-timer, programs, program-detail, badge-gallery, time-reports, pet-detail, habit-stack. 26 mobile route files, 22 web route files.

## Distinctive / Moat-worthy
- Consolidates 6+ standalone apps (Habitify + I Am Sober + Forest + Toggl + Habitica + Finch) into one local-first module
- 289 passing tests across 18 files; all engines are pure functions
- On-device Siri + HealthKit + location triggers, no cloud required

## Gaps vs competitors
- No social accountability feeds (Habitica guilds/parties) — presence module has partners but habits itself lacks peer-facing UI
- No AI-generated habit coaching narratives

## Investor-facing hook
One privacy-first app replaces six category leaders (Habitica, Forest, I Am Sober, Habitify, Toggl, Finch) with cross-habit intelligence they cannot touch.
