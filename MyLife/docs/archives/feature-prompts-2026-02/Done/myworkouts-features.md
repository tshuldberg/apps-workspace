# MyWorkouts Feature Set

## Problem Statement

You are working in the MyLife monorepo at `/Users/trey/Desktop/Apps/MyLife/`. MyLife is a unified hub app consolidating 10+ privacy-first personal app modules into a single cross-platform application. MyWorkouts uses a **Supabase backend** (not local SQLite) and its hub module lives at `modules/workouts/`.

**MyWorkouts** is a fitness tracking app with a Supabase backend. The standalone source of truth lives at `/Users/trey/Desktop/Apps/MyLife/MyWorkouts/`, a Turborepo monorepo with `apps/mobile/` (Expo), `apps/web/` (Next.js 15), `packages/shared/`, `packages/ui/`, and `supabase/` (migrations, Edge Functions). Authentication uses Supabase Auth with subscription tiers.

**What already exists:** Exercise catalog with 14 muscle groups, interactive SVG body map for muscle group selection, workout builder with sets/reps/duration/rest configuration, full workout engine state machine (planned/active/paused/completed), voice commands during workouts, workout plans with day assignments, progress tracking (streaks, volume stats, personal records), form recording with video capture, coach portal for creating and sharing plans, authentication with subscription tiers.

**MyWorkouts is standalone** (no absorbed apps). It is the fitness platform within the MyLife suite.

**What needs to be built (2 feature sets):**

### Feature Set 1: Strength Training Depth

The features that serious lifters expect. MyWorkouts has workout logging but lacks the weight tracking and progression tools that compete with Strong, Hevy, and JEFIT.

**Features:**
- Weight tracking per set: log weight (lbs/kg) alongside reps for each set in a workout, with unit preference in settings
- Estimated 1RM calculation: calculate one-rep max from working sets using the Epley formula (1RM = weight x (1 + reps/30)), displayed per exercise
- Strength progression charts: line chart showing 1RM or max weight over time per exercise, with trend line
- Routine templates: save a workout as a reusable template; browse and clone community-shared templates
- Superset, drop set, and special set types: group exercises into supersets (back-to-back, no rest), drop sets (decreasing weight), giant sets (3+ exercises), and pyramid sets (increasing then decreasing weight)
- Rest timer with configuration: user-configurable between-set countdown timer (default 90s for hypertrophy, 180s for strength), with audio/haptic alert at completion
- Plate calculator: enter target barbell weight, see plate breakdown per side (including bar weight)

### Feature Set 2: Body Tracking and Social

Features that round out the fitness experience beyond just workouts.

**Features:**
- Body measurements: track chest, waist, hips, biceps, thighs, calves, and custom measurement points over time with date entries
- Progress photos: take and store front/side/back photos with date stamps, displayed in a timeline comparison view
- Warm-up set calculator: given a working weight, generate a warm-up pyramid (e.g., empty bar x 10, 50% x 8, 70% x 5, 85% x 3, working weight)
- Social feed and workout sharing: share completed workouts to a feed visible to followed users; like and comment on shared workouts
- Apple Watch / wearable standalone app: minimal watch app showing current exercise, set count, and rest timer with haptic cues

---

## Acceptance Criteria

### Feature Set 1: Strength Training Depth

1. User starts a workout and begins Bench Press -> for each set, enters weight (185 lbs) and reps (8) -> after the set, the rest timer starts counting down from their configured rest period (90s); the set is saved with weight, reps, and timestamp; estimated 1RM (185 x (1 + 8/30) = 234 lbs) displays next to the exercise
2. User finishes a workout with Bench Press and opens the exercise's history -> sees a line chart showing estimated 1RM over the last 3 months with a trend line; a personal record badge appears when today's 1RM exceeds all previous entries
3. User creates a superset of Bench Press + Bent-Over Row -> during the workout, after completing a Bench Press set, the app immediately prompts the next Row set with no rest timer; rest timer only starts after both exercises in the superset are completed
4. User opens the Plate Calculator, enters target weight 225 lbs with a 45 lb bar -> sees "Each side: 1x 45 lb, 1x 22.5 lb" (or nearest available plate combination)
5. User saves their Push/Pull/Legs workout as a template named "PPL - Push Day" -> the template appears in the template library; another user browses community templates and clones "PPL - Push Day" to their workout plans

### Feature Set 2: Body Tracking and Social

6. User opens Body Measurements and logs chest: 42", waist: 34", biceps: 15" with today's date -> the measurements appear in a table; after 4 weeks of entries, a trend chart shows change over time per measurement
7. User takes a progress photo (front view) -> the photo is stored locally with a date stamp; user opens the Progress Photos timeline -> sees photos arranged chronologically with a side-by-side comparison mode (select any two dates)
8. User enters working weight of 225 lbs for Squat -> taps "Warm-Up" -> sees a generated warm-up sequence: 45 lbs x 10, 115 lbs x 8, 160 lbs x 5, 195 lbs x 3, then working sets at 225 lbs
9. User completes a workout and taps "Share" -> the workout summary (exercises, volume, duration, PRs hit) posts to the social feed; a follower sees it, taps "Like" and leaves a comment "Great session!"

---

## Constraint Architecture

**Musts:**
- Backend uses Supabase (PostgreSQL with RLS); new tables: `workout_set_weights`, `exercise_1rm_history`, `routine_templates`, `template_exercises`, `body_measurements`, `progress_photos`, `social_posts`, `social_likes`, `social_comments`
- Weight tracking must support both lbs and kg with user preference toggle and display conversion
- 1RM calculation uses the Epley formula as the default (allow future algorithm swap)
- Rest timer must work when the screen is locked or the app is backgrounded
- Plate calculator must handle standard plate sets: 45, 35, 25, 10, 5, 2.5 lbs (and metric equivalents)
- Both standalone (`MyWorkouts/`) and hub module (`modules/workouts/`) must receive changes

**Must-nots:**
- Do not modify the existing workout engine state machine
- Do not change the exercise catalog or body map
- Do not require subscription for basic weight tracking (premium: progression charts, social features, templates marketplace)
- Do not modify `packages/module-registry/` or other modules
- Do not store progress photos on the server (local device storage only; social sharing posts the workout summary, not photos)

**Preferences:**
- Strength progression charts via a lightweight chart library consistent with other MyLife modules
- Rest timer with haptic feedback on mobile (expo-haptics) and audio alert on web
- Warm-up calculator uses standard percentages: bar only, 50%, 70%, 85%, working weight
- Social feed uses Supabase Realtime for live updates
- Superset grouping should be a UI concept (group exercises in the builder) stored as a `set_group_id` on the exercise-in-workout record

**Escalation triggers:**
- If Apple Watch app requires WatchKit/SwiftUI native code outside Expo's capabilities, defer to a later native phase and document
- If social feed moderation is needed (spam, inappropriate content), add a report mechanism but defer full moderation to a later phase
- If plate calculator needs to handle specialty plates (bumper plates, fractional plates), start with standard plates and add customization later

---

## Subtask Decomposition

**Subtask 1: Weight Tracking and 1RM (90 min)**
Add `workout_set_weights` table linked to existing sets. Build weight input UI per set with unit toggle (lbs/kg). Implement Epley 1RM calculation. Add `exercise_1rm_history` table for tracking 1RM over time. Display estimated 1RM and PR badges.

**Subtask 2: Strength Progression Charts (60 min)**
Build exercise history query: 1RM and max weight over time. Build line chart UI with trend line. Add "All Time PR" detection and badge display.

**Subtask 3: Special Set Types and Rest Timer (90 min)**
Implement superset, drop set, giant set, and pyramid set grouping in the workout builder. Modify the workout engine to handle grouped exercise transitions (skip rest between superset exercises). Build configurable rest timer with background support and haptic/audio alerts.

**Subtask 4: Routine Templates and Plate Calculator (60 min)**
Add `routine_templates` and `template_exercises` tables. Build save-as-template and clone-template flows. Implement plate calculator: input target weight and bar weight, output plate breakdown per side using a greedy algorithm.

**Subtask 5: Body Measurements and Progress Photos (60 min)**
Add `body_measurements` table. Build measurement logging UI with predefined + custom measurement points. Build trend charts. Implement progress photo capture with local storage, timeline view, and side-by-side comparison.

**Subtask 6: Social Feed (90 min)**
Add social tables (posts, likes, comments) in Supabase with RLS. Build workout sharing flow (post summary after completion). Build social feed UI with like/comment. Use Supabase Realtime for live updates.

---

## Evaluation Design

1. **1RM calculation:** Log a set of 185 lbs x 8 reps -> `calculate1RM(185, 8)` returns 234 (Epley formula); log 200 lbs x 5 -> returns 233; the exercise history shows the 234 as the PR
2. **Rest timer:** Configure 90s rest, complete a set -> timer starts at 90s and counts down; at 0s, haptic/audio fires; timer works with screen locked (verify notification or background timer fires)
3. **Superset:** Create a superset of exercises A and B -> complete set of A -> app immediately prompts set of B with no rest countdown; complete set of B -> rest timer starts
4. **Plate calculator:** Input 225 lbs with 45 lb bar -> `calculatePlates(225, 45)` returns [45, 45] per side (total: 45 bar + 4x45 = 225); input 135 -> returns [45] per side
5. **Type safety and parity:** `pnpm typecheck` exits 0; `pnpm check:parity` exits 0; existing tests pass
