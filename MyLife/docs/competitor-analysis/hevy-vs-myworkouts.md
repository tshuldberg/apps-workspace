# Hevy vs MyWorkouts: Feature Comparison

**Date:** 2026-03-29
**Source:** Screen recording of Hevy iOS app (6 min walkthrough, fresh account)
**Screenshots:** `docs/competitor-analysis/hevy-screens/labeled/`

## Summary

Hevy is a popular workout logging app with a clean, gym-optimized UX. MyWorkouts already matches or exceeds Hevy in most areas (rest timer, previous performance, routines/plans, exercise library, muscle body map, volume tracking, progressive overload, recovery scoring, GPS cardio, cross-module intelligence). The main gaps are **post-workout celebration UX**, **monthly heatmap report**, **workout onboarding wizard**, and **shareable workout cards UI** (backend exists but not wired to share targets).

---

## Feature-by-Feature Comparison

| # | Hevy Feature | MyWorkouts Has It? | Notes |
|---|---|---|---|
| **ONBOARDING** | | | |
| 1 | Marketing splash with workout preview | NO | We drop into empty dashboard. No value prop on first open. |
| 2 | Gender/birthday/height/weight onboarding | NO | No guided profile setup. Health data collected separately. |
| 3 | Training experience level selector | NO | Beginner/Intermediate/Advanced -- could personalize exercise suggestions |
| 4 | HealthKit permission prompt with granular toggles | PARTIAL | Watch sync protocol exists but no structured HealthKit onboarding |
| 5 | "How did you hear about us?" attribution survey | NO | Not applicable for privacy-first app |
| **WORKOUT LOGGING** | | | |
| 6 | Live duration timer during workout | YES | session.tsx has running timer |
| 7 | Volume counter (total lbs lifted) | YES | calculateVolume() in progress.ts |
| 8 | Sets counter | YES | Set tracking in wk_workout_set_weights |
| 9 | Muscle group body map (front/back anatomy) | YES | body-map.ts with 14 muscle groups, buildHighlightData() |
| 10 | Per-exercise rest timer with configurable duration | YES | session.tsx rest overlay with circular countdown ring |
| 11 | PREVIOUS column showing last session's weight/reps | YES | getPreviousPerformance() in crud.ts |
| 12 | SET / PREVIOUS / LBS / REPS / checkmark table | PARTIAL | Set logging exists but UI may not match Hevy's table layout exactly |
| 13 | "+ Add Set" button | YES | Builder and session support adding sets |
| 14 | "+ Add Exercise" button | YES | Exercise picker in session |
| 15 | Per-exercise notes | YES | Notes field on exercises |
| 16 | "Discard Workout" option | YES | Session can be discarded |
| 17 | Notification for rest timer when app backgrounded | NO | Rest timer runs in-app only. No push notification when backgrounded. |
| **EXERCISE LIBRARY** | | | |
| 18 | Exercise search with text input | YES | FTS search on exercise library |
| 19 | Equipment filter (All Equipment) | PARTIAL | Exercises have equipment type but may not have filter chips |
| 20 | Muscle filter (All Muscles) | YES | getMuscleGroupsByRegion() |
| 21 | Exercise illustrations (anatomical drawings) | YES | wk_exercise_videos with thumbnails, demo.ts for bundled assets |
| 22 | Popular exercises list | PARTIAL | Exercise library exists but no "popular" sort |
| **ROUTINES & PROGRAMS** | | | |
| 23 | Create Routine (title + add exercises) | YES | builder.tsx, wk_workouts table |
| 24 | "Start Routine" one-tap workout start | YES | Start from routine card |
| 25 | Explore community routines | PARTIAL | Explore screen exists but community routines need cloud |
| 26 | AI-generated programs ("Hevy Trainer") | YES | generate.tsx, wk_generation_history |
| 27 | Multi-week programs with exercise lists | YES | wk_workout_plans with weeks_json |
| **SAVE WORKOUT** | | | |
| 28 | Save screen with title, duration, volume, sets | PARTIAL | Session completes but no dedicated "Save Workout" review screen |
| 29 | Date/time picker for workout | NO | Workout timestamp is automatic, no manual override |
| 30 | Add photo/video to workout | YES | progress photos (wk_progress_photos) |
| 31 | Description/notes field | YES | Notes on exercises and sessions |
| 32 | Visibility setting (Everyone/private) | YES | social/privacy.ts handles visibility |
| 33 | Sync with Apple Health toggle | PARTIAL | Watch sync protocol but no HealthKit write |
| 34 | Heart rate data retrieval from watch | PARTIAL | Watch sync has HR message type but no HealthKit read |
| **POST-WORKOUT** | | | |
| 35 | "Nice work!" celebration with confetti | NO | Session ends silently. No celebration UI. |
| 36 | Milestone callout ("This is your 1st workout") | NO | No milestone detection on completion |
| 37 | Shareable workout cards (5 templates) | PARTIAL | buildWorkoutSummary() exists but no card UI templates or share sheet |
| 38 | Share targets (Instagram Stories, Twitter, Copy, Link) | NO | No share action sheet wired |
| **HOME FEED** | | | |
| 39 | Social feed with workout posts | PARTIAL | Feed engine exists (sortFeedChronological, paginateFeed) but not wired to mobile UI |
| 40 | Like / Comment / Share actions | PARTIAL | enrichPost() adds counts but no mobile UI |
| 41 | Suggested Athletes carousel | NO | No athlete discovery |
| 42 | Invite a friend | NO | No invite flow |
| **PROFILE** | | | |
| 43 | Profile with Workouts/Followers/Following counts | PARTIAL | Dashboard exists but no follower counts |
| 44 | Profile completion progress ("80% finished") | NO | No profile completion prompt |
| 45 | Weekly activity chart (Duration/Volume/Reps toggle) | YES | progress.tsx with weekly summaries |
| 46 | Dashboard grid (Statistics, Exercises, Measures, Calendar) | YES | Dashboard with stats cards |
| **STATISTICS** | | | |
| 47 | Set count per muscle group | YES | Body map + exercise tracking |
| 48 | Muscle distribution chart | YES | body-map.ts buildHighlightData() |
| 49 | Muscle distribution body heatmap | YES | recovery.tsx heatmap screen |
| 50 | Main exercises (most frequent) | PARTIAL | Exercise history exists but no "main exercises" ranking view |
| 51 | Leaderboard exercises | NO | No leaderboard system |
| 52 | Monthly Report (calendar, streak, muscle map, Share) | NO | No monthly report generation or calendar heatmap |
| **PRICING/PAYWALL** | | | |
| 53 | 10-page paywall carousel with feature comparison | N/A | Our paywall is hub-level (MyLife Pro), not per-module |
| 54 | Monthly/Yearly/Lifetime pricing tiers | N/A | Hub subscription handles this |

---

## Where MyWorkouts EXCEEDS Hevy

| Feature | MyWorkouts | Hevy |
|---------|-----------|------|
| Progressive overload automation | Trigger-based weight/rep/set suggestions (wk_overload_rules) | Manual tracking only |
| Recovery scoring | 14-muscle group fatigue tracking with recovery suggestions | No recovery system |
| Cross-module intelligence | Workout-mood correlation, fasting-performance, protein-recovery | Isolated app |
| GPS cardio | Distance, pace, elevation, calorie estimation (wk_gps_routes/points) | No GPS/cardio |
| Form video system | Multi-angle trainer videos with profiles (5 angles: front, side, back, detail, common_mistakes) | Static exercise illustrations only |
| 1RM + warmup calculators | Epley/Brzycki formula, warmup set generator, plate loading calculator | Basic 1RM only |
| Privacy | Zero cloud by default, all local SQLite | Cloud account required |
| Plate calculator | Greedy algorithm for barbell plate setup from inventory | Not available |

---

## Priority Gaps to Close

### P0 -- High Impact, Should Have

| # | Feature | Why | Effort |
|---|---------|-----|--------|
| 1 | **Post-workout celebration** | Session ends silently. Hevy shows confetti, milestone callout ("1st workout!"), and shareable cards. This is the dopamine hit that drives daily return. | Small |
| 2 | **Workout onboarding wizard** | New users see empty dashboard. Hevy guides through gender, birthday, height, weight, experience level. Personalizes the experience. | Medium |
| 3 | **Monthly heatmap report** | Calendar view showing workout days, week streak, muscle distribution body map. Hevy's monthly report is highly shareable. | Medium |
| 4 | **Rest timer background notification** | Hevy prompts for notification permission so the rest timer works when the app is backgrounded (user checks other apps between sets). | Small |

### P1 -- Nice to Have

| # | Feature | Why | Effort |
|---|---------|-----|--------|
| 5 | **Save Workout review screen** | Dedicated screen after finishing: title, duration, volume, date picker, photo, description, visibility. More intentional than auto-save. | Medium |
| 6 | **Shareable workout cards with share sheet** | buildWorkoutSummary() exists but no visual card templates or Instagram/Twitter share targets. | Medium |
| 7 | **Main exercises ranking** | "Exercises you do most often" list with frequency count. Useful for tracking training balance. | Small |
| 8 | **Equipment filter chips on exercise picker** | Hevy has "All Equipment" and "All Muscles" filter chips above search results. | Small |

### P2 -- Consider Later

| # | Feature | Why | Effort |
|---|---------|-----|--------|
| 9 | **Social feed mobile UI** | Backend (feed engine, privacy, pagination) fully implemented. Just needs mobile screen wiring. | Medium |
| 10 | **Workout date/time override** | Let users log a workout for a past date. Hevy has a date picker on save. | Small |
| 11 | **Profile completion progress** | "Your profile is 80% finished" prompt. Gamifies profile setup. | Small |
| 12 | **Athlete discovery / invite friends** | Community growth features. Low priority for privacy-first app. | Large |

### Out of Scope (By Design)

| Feature | Reason |
|---------|--------|
| Per-module paywall carousel | Hub-level MyLife Pro subscription handles this |
| Cloud account required | Privacy-first, offline-first architecture |
| Attribution survey | Not applicable |

---

## Screenshot Reference

All labeled screenshots are in:
```
docs/competitor-analysis/hevy-screens/labeled/
├── 01-onboarding/        (5 images)
├── 02-paywall/           (3 images)
├── 03-routine-builder/   (1 image)
├── 04-exercise-picker/   (1 image)
├── 05-log-workout/       (2 images)
├── 06-rest-timer/        (2 images)
├── 07-save-workout/      (1 image)
├── 08-celebration/       (2 images)
├── 09-home-feed/         (1 image)
├── 10-profile/           (2 images)
├── 11-statistics/        (1 image)
├── 12-monthly-report/    (1 image)
├── 13-workout-tab/       (1 image)
└── 14-programs/          (1 image)
```
