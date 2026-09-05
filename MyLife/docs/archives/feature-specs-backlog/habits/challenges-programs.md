# Feature Spec: Challenges & Programs

## Metadata
- **Module:** habits
- **Priority Score:** 29 / 50 (B-Tier)
- **Scoring Breakdown:** Market 3 x3 + Switching 3 x3 + Complexity 2 x2 + CrossModule 3 x1 + PaidUser 4 x1
- **Sprint:** Sprint 3
- **Estimated CC Time:** 5-6 hours
- **Depends On:** HB-001 (Habit Creation), HB-002 (Daily Check-In)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Fabulous ($59.99/yr) built a $20M+ business primarily on "science-based journey programs" that guide users through progressive habit building. Their structured 30-day challenges create higher retention than freeform habit tracking because users have a clear daily target that escalates gradually. MyHabits already has the habit infrastructure (types, frequencies, completions). Adding a programs layer on top lets us capture the "structured guidance" segment that Fabulous and Habitica's quests serve, without requiring cloud accounts or subscriptions.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Fabulous | Yes | Yes ($59.99/yr) | "Journeys" with daily rituals, science-backed coaching, progressive difficulty. Premium-only for most journeys. |
| Habitica | Yes (partial) | Yes (premium quests) | Guild quests with group accountability, but these are social, not structured solo programs. |
| Habitify | No | N/A | No challenge/program system. |
| Streaks | No | N/A | No challenge/program system. |
| Productive | Yes (partial) | Yes | "Challenges" are preset 7/14/30 day streaks, no progressive targets. |

### Target User
Users who tried Fabulous for structured habit-building journeys but churned because of the $60/yr subscription. Also users who want guided onboarding into a new habit (e.g., starting meditation, building a morning routine, Couch-to-5K) with progressive daily targets rather than a flat "do X every day" goal. Migration path: Fabulous user discovers MyLife does structured programs with progressive targets at no additional subscription cost.

## Technical Context

### Where This Lives in MyLife

```
modules/habits/src/
  challenges/
    engine.ts                     -- NEW: Program resolution, target interpolation, enrollment logic
    built-in-programs.ts          -- NEW: 8 built-in program definitions
    __tests__/engine.test.ts      -- NEW: Engine tests
  db/
    challenges.ts                 -- NEW: Program + enrollment CRUD
    schema.ts                     -- MODIFY: Add hb_programs, hb_program_enrollments tables (V4)
  types.ts                        -- MODIFY: Add Program, ProgramEnrollment, ProgramDifficulty schemas
  definition.ts                   -- MODIFY: Add V4 migration, add programs-browser screen
  index.ts                        -- MODIFY: Export challenge engine + types + CRUD
apps/mobile/app/(habits)/
  programs.tsx                    -- NEW: Programs browser screen
  program-detail.tsx              -- NEW: Program detail with day-by-day schedule
apps/web/app/habits/
  programs/page.tsx               -- NEW: Web programs page (or fallback)
```

### Wireframe Position

```
Hub Dashboard
  └── MyHabits card
       ├── Today tab
       │    └── [Active program banner with progress bar]
       ├── Habits tab
       │    └── [Programs section at top]
       │         └── Programs Browser ← YOU ARE HERE
       ├── Stats tab
       └── Settings tab
```

### Data Model

```sql
-- Program definition (built-in or user-created)
CREATE TABLE IF NOT EXISTS hb_programs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  duration_days INTEGER NOT NULL CHECK (duration_days >= 7 AND duration_days <= 90),
  schedule TEXT NOT NULL,  -- JSON array of daily target values
  difficulty TEXT NOT NULL DEFAULT 'beginner'
    CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  is_built_in INTEGER NOT NULL DEFAULT 0 CHECK (is_built_in IN (0, 1)),
  icon TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- User enrollment in a program
CREATE TABLE IF NOT EXISTS hb_program_enrollments (
  id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL REFERENCES hb_programs(id) ON DELETE CASCADE,
  habit_id TEXT NOT NULL REFERENCES hb_habits(id) ON DELETE CASCADE,
  start_date TEXT NOT NULL,
  current_day INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'abandoned')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(habit_id)  -- one program per habit at a time
);

CREATE INDEX IF NOT EXISTS hb_programs_built_in_idx ON hb_programs(is_built_in);
CREATE INDEX IF NOT EXISTS hb_enrollments_program_idx ON hb_program_enrollments(program_id);
CREATE INDEX IF NOT EXISTS hb_enrollments_habit_idx ON hb_program_enrollments(habit_id);
CREATE INDEX IF NOT EXISTS hb_enrollments_status_idx ON hb_program_enrollments(status);
```

### Dependencies
- **Internal:** `@mylife/habits` (habit CRUD, completion recording, timed sessions), `@mylife/db` (DatabaseAdapter)
- **External:** None. Pure local calculation.
- **Cross-Module:** Milestone system (program completion triggers milestones). Focus timer (programs can target focus duration). RPG gamification (program completion awards bonus XP).

## Functional Requirements

### User Stories
1. As a user who wants structured guidance, I want to join a "30 Days of Meditation" challenge with daily targets that increase over time, so that I build the habit progressively.
2. As a user who has completed a challenge, I want a celebration screen and record of my achievement, so that I feel accomplished.
3. As a creative user, I want to create my own custom programs with custom target schedules, so that I can design my own progressive habit-building plan.
4. As a user browsing programs, I want to see difficulty labels and descriptions so I can pick one that matches my current level.

### Behavior Specification

**Browsing programs:**
1. User navigates to Habits > Programs (via a tab or button on the Habits tab).
2. Active enrollments section at the top: shows current programs with progress bars ("Day 12 of 30").
3. Built-in programs section: 8 preset programs with name, icon, duration, difficulty, description.
4. Custom programs section: user-created programs.
5. "Create Custom Program" button at the bottom.

**Joining a program:**
1. User taps a program card.
2. Program detail screen shows: name, description, full day-by-day schedule.
3. User taps "Join Program."
4. If the user has no linked habit: prompt to select an existing habit or create a new one.
5. Enrollment created with start_date = today, current_day = 1.
6. Today's target is set on the linked habit.

**Daily target resolution:**
1. Each day, the system resolves today's target from the program schedule.
2. `currentDay = daysBetween(enrollment.startDate, today) + 1`
3. If currentDay > durationDays: program is complete, enrollment status -> "completed".
4. Otherwise: look up `schedule[currentDay - 1]` for today's target value.
5. The linked habit's targetCount is temporarily overridden by the program target.

**Custom program creation:**
1. User taps "Create Custom Program."
2. Enters: name, duration (7-90 days), linked habit, description.
3. Defines keyframe targets (e.g., Day 1 = 5, Day 15 = 15, Day 30 = 30).
4. System interpolates daily targets between keyframes using linear interpolation.
5. `interpolatedTarget = floor(startValue + (endValue - startValue) * (day - startDay) / (endDay - startDay))`

**Program completion:**
1. When currentDay exceeds durationDays, enrollment status changes to "completed."
2. Celebration screen: "You completed [Program Name]!" with total days, total completions.
3. If milestones module is active: program completion milestone is triggered.

**Leaving a program:**
1. User taps "Leave Program" on the program detail screen.
2. Confirmation dialog: "Leave [Program Name]? Your progress will be saved but the program will be marked as abandoned."
3. Enrollment status -> "abandoned."
4. Habit continues as a normal habit with its own target.

### Edge Cases

- **User misses a day:** Program day advances based on calendar date, not completions. Missed days are missed, not skipped.
- **User completes ahead of schedule:** Day counter does not skip. currentDay is always calendar-based.
- **Habit deleted while enrolled:** Enrollment is cascade-deleted (FK constraint).
- **Multiple programs for same habit:** Not allowed. UNIQUE(habit_id) constraint on enrollments.
- **Program abandoned then re-joined:** User can re-enroll from Day 1. Old enrollment stays as "abandoned."
- **Custom program with only one keyframe:** All days get that same target value (flat program).
- **Module disabled mid-program:** Program pauses. On re-enable, currentDay recalculates from calendar.
- **Schedule JSON invalid:** Validation at creation time. Schedule must be a JSON array with length == durationDays.
- **Duration = 0 or negative:** Prevented by CHECK constraint (min 7 days).

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Programs browser shows all 8 built-in programs with name, icon, duration, difficulty, description
- [ ] **AC-2:** Active enrollments section shows current programs with progress bars (Day X of Y)
- [ ] **AC-3:** Joining a program creates an enrollment and adjusts the linked habit's daily target
- [ ] **AC-4:** Day-by-day schedule is visible on the program detail screen with today highlighted
- [ ] **AC-5:** Program completion shows a celebration screen with stats
- [ ] **AC-6:** Custom program creation allows defining keyframe targets with interpolation
- [ ] **AC-7:** "Leave Program" marks enrollment as abandoned after confirmation
- [ ] **AC-8:** Built-in programs can be re-joined after completion or abandonment
- [ ] **AC-9:** Feature renders correctly on both mobile and web

### Technical Criteria
- [ ] **TC-1:** `resolveDailyTarget(enrollment, schedule, today)` returns correct target for any given day
- [ ] **TC-2:** `interpolateSchedule(keyframes, durationDays)` produces correct linear interpolation
- [ ] **TC-3:** V4 migration creates hb_programs and hb_program_enrollments tables
- [ ] **TC-4:** UNIQUE(habit_id) constraint prevents multiple active programs per habit
- [ ] **TC-5:** Built-in programs are seeded on first migration run
- [ ] **TC-6:** Engine functions are pure (no side effects, no database calls)
- [ ] **TC-7:** Schedule stored as valid JSON array with length == durationDays

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Programs must NOT allow enrollment in two programs for the same habit simultaneously
- [ ] **NC-2:** Program completion must NOT happen before the actual last day
- [ ] **NC-3:** Leaving a program must NOT delete historical completion data
- [ ] **NC-4:** Custom program targets must NOT interpolate to negative values

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Cards: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border
- Module accent: `#8B5CF6` (habits purple)
- Progress bar: accent color fill on glass background
- Difficulty badges: Beginner (green), Intermediate (orange), Advanced (red)
- Active enrollment banner: prominent card at top of programs list with progress %

Layout:
```
[Programs Browser Screen]

  "Active Programs" (section header)
  [30 Days of Meditation - Day 12 of 30 ████████░░░░ 40%]

  "Built-in Programs" (section header)
  [30 Days of Meditation  🧘  30 days  Beginner]
  [Couch to 5K           🏃  63 days  Intermediate]
  [Morning Routine        ☀️  28 days  Beginner]
  [30-Day No Sugar        🚫  30 days  Intermediate]
  [Daily Reading Habit    📚  30 days  Beginner]
  [Hydration Challenge    💧  14 days  Beginner]
  [Digital Detox          📵  21 days  Intermediate]
  [Gratitude Practice     🙏  30 days  Beginner]

  "My Programs" (section header, if any custom programs exist)
  [Custom Program 1  ...]

  [+ Create Custom Program]    (button, bottom)
```

### Web (Next.js)

- Route: `/habits/programs`
- Same tokens via CSS variables
- Grid layout for program cards (2-column on desktop, 1-column mobile)
- Responsive: max-width 800px centered

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton cards | Initial data fetch |
| No enrollments | Built-in programs only, no active section | No programs joined |
| Active enrollment | Progress bar with day counter at top | User joined a program |
| Program complete | Celebration overlay with stats | currentDay > durationDays |
| Create custom | Modal/screen with keyframe editor | User taps create button |
| Error | "Could not load programs" + retry | Data fetch failure |

## Test Requirements

### Unit Tests
- [ ] `resolveDailyTarget`: Day 1 of 30-day program returns schedule[0]
- [ ] `resolveDailyTarget`: Day 30 of 30-day program returns schedule[29]
- [ ] `resolveDailyTarget`: Day 31 of 30-day program returns null (completed)
- [ ] `interpolateSchedule`: keyframes (1, 5) and (30, 30) at Day 15 returns ~17
- [ ] `interpolateSchedule`: single keyframe (1, 10) returns 10 for all days
- [ ] `interpolateSchedule`: keyframes at boundaries return exact values
- [ ] `getCurrentDay`: start March 1, today March 15 returns 15
- [ ] `getCurrentDay`: start today returns 1
- [ ] `isProgramComplete`: day 31 of 30-day program returns true
- [ ] `isProgramComplete`: day 30 of 30-day program returns false
- [ ] `BUILT_IN_PROGRAMS`: all 8 programs have valid schedules matching their durationDays
- [ ] `BUILT_IN_PROGRAMS`: all schedules have non-negative target values

### Integration Tests
- [ ] Full flow: join program -> daily target updates -> complete all days -> status = completed
- [ ] Abandon flow: join program -> leave -> enrollment status = abandoned -> habit target resets
- [ ] Custom program: create with keyframes -> interpolated schedule is correct -> join works

### QA Verification Script

1. Open the app on [iOS / web]
2. Navigate to MyHabits > Programs
3. Verify: 8 built-in programs are displayed with names, icons, durations -- AC-1
4. Tap "30 Days of Meditation"
5. Verify: Day-by-day schedule visible, targets escalate from 2 to 20 min -- AC-4
6. Tap "Join Program," select or create a meditation habit
7. Verify: Enrollment created, progress shows "Day 1 of 30" -- AC-2, AC-3
8. Navigate to Today tab
9. Verify: Habit target reflects program's Day 1 target (2 min)
10. Tap "Leave Program"
11. Verify: Confirmation dialog, then enrollment marked abandoned -- AC-7
12. Re-join the same program
13. Verify: New enrollment starts at Day 1 -- AC-8
14. Tap "+ Create Custom Program"
15. Enter: "My Custom", 14 days, keyframes Day 1 = 5, Day 14 = 20
16. Verify: Interpolated schedule shows progressive targets -- AC-6
17. Verify on web at /habits/programs -- AC-9

## gstack Quality Gates

Based on Complexity score 2 (Large), these gates are required:

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to programs browser, join a program, verify progress bar, test leave flow

### Required if Complexity <= 2 (Large):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. Fix issues found.

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for target interpolation engine

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Habits module has V3 schema (16 tables) with habit types, streaks, sobriety, cravings, milestones, focus timer, HealthKit links.
- No structured programs or challenges exist. Users set flat daily targets manually.
- No progressive target system.

### After This Work
- New engine: `modules/habits/src/challenges/engine.ts` with target resolution, interpolation, enrollment management.
- New data: `modules/habits/src/challenges/built-in-programs.ts` with 8 preset program definitions.
- New CRUD: `modules/habits/src/db/challenges.ts` for programs and enrollments.
- New tables: `hb_programs`, `hb_program_enrollments` (V4 migration).
- New screens: mobile programs browser + detail, web `/habits/programs` page.

### Files Changed
- `modules/habits/src/challenges/engine.ts` -- NEW: Program engine (resolve target, interpolate, check completion)
- `modules/habits/src/challenges/built-in-programs.ts` -- NEW: 8 built-in program definitions
- `modules/habits/src/challenges/__tests__/engine.test.ts` -- NEW: Engine tests
- `modules/habits/src/db/challenges.ts` -- NEW: Program + enrollment CRUD
- `modules/habits/src/db/schema.ts` -- MODIFY: Add V4 tables + indexes
- `modules/habits/src/types.ts` -- MODIFY: Add Program, ProgramEnrollment Zod schemas
- `modules/habits/src/definition.ts` -- MODIFY: Add V4 migration, add programs screen
- `modules/habits/src/index.ts` -- MODIFY: Export challenge engine + types + CRUD
- `apps/mobile/app/(habits)/programs.tsx` -- NEW: Programs browser screen
- `apps/mobile/app/(habits)/program-detail.tsx` -- NEW: Program detail screen
- `apps/web/app/habits/programs/page.tsx` -- NEW: Web programs page

### Known Limitations
- **No social/community challenges.** Habitica has guild quests; out of scope for V1.
- **No push notifications for daily program targets.** Future: integrate with expo-notifications.
- **Schedule is flat JSON array, not a formula.** This means a 90-day program stores 90 target values. This is simple but not storage-efficient. Acceptable for local-only data.
- **No program analytics.** No historical view of past program enrollments or completion rates. Future feature.

### Context for Next Agent
- The schedule is stored as a JSON array of numbers in the `schedule` TEXT column. Parse with `JSON.parse()`, validate length matches `durationDays`.
- Built-in programs should be seeded into `hb_programs` during migration with `is_built_in = 1`. User-created programs have `is_built_in = 0`.
- The UNIQUE(habit_id) constraint on enrollments prevents a habit from being in two programs simultaneously. If the user wants to switch, they must leave the current program first.
- `currentDay` should be recalculated from `daysBetween(startDate, today) + 1` rather than stored and incremented, to handle days the app wasn't opened.
- The program target temporarily overrides the habit's `targetCount`. When the program ends (completed or abandoned), revert to the habit's original target. Store the original target before enrollment starts.
