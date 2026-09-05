# Feature Spec: Training Progress Tracker

## Metadata
- **Module:** pets
- **Priority Score:** 21 / 50 (B-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 2 x3 + Complexity 3 x2 + CrossModule 1 x1 + PaidUser 2 x1
- **Sprint:** 3
- **Estimated CC Time:** 2-3 hours
- **Depends On:** Pet profile CRUD (V1), Training logs table (V2)
- **Blocks:** Dog training lessons (future feature)

## Business Context

### Why This Feature Exists
The `pt_training_logs` table (V2) stores individual training sessions (command, location, duration, success rating 1-5, notes), and basic CRUD for create/list exists. But there is no way to track mastery progression per command, see which commands a pet has learned, visualize training streaks, or get a summary of training activity. Dog and cat owners who actively train their pets want to see progress over time, not just a flat list of log entries. Dogo charges $200+/yr for training content and progress tracking. This feature adds command-level mastery tracking, auto-mastery detection, training streaks, and a training summary dashboard, all without paid content -- just tracking tools the user drives themselves.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Dogo | Yes | Yes ($200+/yr) | Lesson-based training programs with progress tracking, video tutorials, daily training plans |
| Pupford | Partial | Free + paid courses | Training course progress tracking, no custom command tracking |
| 11pets | No | N/A | No training features at all |
| PetDesk | No | N/A | Vet-practice focused, no training tools |
| Pawp | No | N/A | Vet telehealth only |
| FitBark | No | N/A | Activity monitoring only |

### Target User
Dog owners actively training their pet (puppy classes, obedience training, trick training) who want to track which commands their pet knows and how well. Also owners working with a professional trainer who want to log homework sessions and see improvement over time. These users currently use notes apps or paper logs to track training, losing the ability to see trends and celebrate mastery milestones.

## Technical Context

### Where This Lives in MyLife

```
modules/pets/src/db/schema.ts                     -- V4 migration: pt_training_commands table
modules/pets/src/definition.ts                     -- Add V4 migration (if not already added by grooming feature)
modules/pets/src/types.ts                          -- New types: TrainingCommand, TrainingCommandStatus, TrainingSummary
modules/pets/src/db/crud.ts                        -- New CRUD: addTrainingCommand, updateCommandStatus, listTrainingCommands, getCommandProgress
modules/pets/src/engine/training.ts                -- Pure functions: calculateCommandProgress, getMasteredCommands, getTrainingStreak, getTrainingSummary
modules/pets/src/index.ts                          -- Re-export new public API
modules/pets/src/__tests__/training.test.ts        -- Engine + CRUD tests
apps/mobile/app/(pets)/training.tsx                -- Per-pet training screen
apps/web/app/pets/[petId]/training/page.tsx        -- Web training screen
```

### Wireframe Position

```
Hub Dashboard
  +-- MyPets card
       +-- Multi-Pet Dashboard
       +-- Pet Detail
       |    +-- Overview
       |    +-- Health tab
       |    +-- Training  <-- YOU ARE HERE
       |    |    +-- Command list with mastery status
       |    |    +-- Training streak display
       |    |    +-- Summary stats
       |    |    +-- Session log history
       |    +-- Settings
       +-- Settings
```

### Data Model

V4 migration adds one new table for training commands (note: if the grooming feature's V4 migration is built first, this becomes part of the same V4 or a V5):

```sql
-- V4 Migration (addendum): Training command mastery tracking

CREATE TABLE IF NOT EXISTS pt_training_commands (
  id TEXT PRIMARY KEY,
  pet_id TEXT NOT NULL REFERENCES pt_pets(id) ON DELETE CASCADE,
  command_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'learning',
  mastered_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(pet_id, command_name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS pt_training_commands_pet_idx
  ON pt_training_commands(pet_id, status);
CREATE INDEX IF NOT EXISTS pt_training_commands_name_idx
  ON pt_training_commands(pet_id, command_name);
```

Existing table (V2, unchanged):
```sql
-- pt_training_logs (already exists)
-- id TEXT PK, pet_id TEXT FK, command_name TEXT, location TEXT,
-- duration_minutes INTEGER, success_rating INTEGER (1-5), logged_at TEXT,
-- notes TEXT, created_at TEXT
```

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter, Migration), `@mylife/module-registry` (ModuleDefinition), `@mylife/ui` (Cool Obsidian tokens, glass card components)
- **External:** None. All local SQLite.
- **Cross-Module:** None for MVP. Future: training sessions could surface as trackable habits in MyHabits module.

## Functional Requirements

### User Stories
1. As a dog owner, I want to register commands I am training my pet on so that I can track progress per command over time.
2. As a pet trainer, I want to see each command's average success rating across recent sessions so that I know which commands need more work.
3. As a pet owner, I want commands to be auto-promoted to "mastered" when they reach 5+ sessions with an average rating of 4.0+ so that I can celebrate milestones without manual tracking.
4. As a pet owner, I want to see my training streak (consecutive days with at least one training session) so that I stay motivated.
5. As a pet owner, I want a training summary (total sessions, unique commands, mastery rate, average session duration) so that I can see my overall training effort.

### Behavior Specification

**Adding a training command:**
1. User navigates to a pet's training section
2. User taps "Add Command" button
3. User enters command name (e.g., "Sit", "Stay", "Shake")
4. System creates a `pt_training_commands` record with status = "learning"
5. Command appears in the command list with a "Learning" badge
6. If a command with the same name already exists for this pet, show error: "Command already exists"

**Logging a training session:**
1. User taps "Log Session" from the training screen
2. User selects command (from existing commands or enters new -- auto-creates the command)
3. User fills in: location (home/park/class/other), duration (minutes), success rating (1-5 stars), notes (optional)
4. User taps Save
5. System creates `pt_training_logs` record
6. System checks auto-mastery: queries recent 5+ sessions for this command, calculates average rating
7. If average >= 4.0 and session count >= 5 and status is not already "mastered": auto-update status to "mastered", set mastered_at

**Viewing command progress:**
1. User views the training screen
2. Command list shows each command with: name, status badge (learning/practicing/mastered), session count, average rating (stars), last practiced date
3. Commands sorted: learning first, then practicing, then mastered
4. Tapping a command shows detailed history: all sessions for that command with date, location, rating, duration, notes

**Training streak:**
1. Displayed at top of training screen
2. Shows current streak (consecutive days with at least 1 training log)
3. "5-day streak" with a flame icon
4. Streak resets to 0 if a day is missed (based on local date, not hours)

**Training summary:**
1. Summary card on training screen showing:
   - Total training sessions (all time)
   - Unique commands trained
   - Mastered commands / total commands (mastery rate percentage)
   - Average session duration (minutes)
   - Current training streak

**Manual status override:**
1. User can manually change a command's status (learning -> practicing -> mastered or any direction)
2. If manually set to "mastered", set mastered_at to now
3. If manually set back to "learning" or "practicing", clear mastered_at

### Edge Cases

- **Same command logged multiple times same day:** All sessions count toward the command's statistics. Each creates a separate `pt_training_logs` record. The day counts as 1 for streak purposes.
- **Command renamed:** Command names are denormalized in `pt_training_logs` (the `command_name` TEXT column). Renaming a command in `pt_training_commands` does NOT update historical log entries. Old logs keep the old name. This is by design: the log is a historical record.
- **No rating provided (null):** Session excluded from average rating calculation. Session still counts toward session count and streak.
- **All sessions have null rating:** Average rating shows "No ratings" instead of a number. Auto-mastery cannot trigger (requires avg >= 4.0, which needs at least 1 rated session).
- **Auto-mastery with exactly 5 sessions:** Triggers if avg rating >= 4.0. Uses the 5 most recent sessions with non-null ratings.
- **Auto-mastery recalculation:** Checked on every new training log for that command. If a new session drops the average below 4.0, status is NOT demoted automatically (mastery is sticky once earned). Only manual override can revert status.
- **Pet deleted:** CASCADE deletes training commands and training logs.
- **Command with 0 sessions:** Shows in command list with "0 sessions" and "No ratings". Cannot auto-master.
- **Training streak across timezone changes:** Streak uses local calendar dates (YYYY-MM-DD from `logged_at`). No timezone adjustment.
- **Pet archived:** Training data preserved but training screen not accessible (pet detail hidden for archived pets).
- **Duplicate command name (case-insensitive):** Enforce case-insensitive uniqueness. "Sit" and "sit" are the same command. Store in user's original casing but compare lowercase for uniqueness.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** User can add a new training command with a name, creating it in "learning" status
- [ ] **AC-2:** User can log a training session for an existing command with location, duration, success rating (1-5), and notes
- [ ] **AC-3:** Command list shows each command with status badge, session count, average rating, and last practiced date
- [ ] **AC-4:** Auto-mastery triggers when a command reaches 5+ rated sessions with average >= 4.0, updating status to "mastered"
- [ ] **AC-5:** Training streak shows consecutive days with training activity
- [ ] **AC-6:** Training summary shows total sessions, unique commands, mastery rate, and average duration
- [ ] **AC-7:** User can manually change a command's status (learning/practicing/mastered)
- [ ] **AC-8:** Logging a session with a new command name auto-creates the command
- [ ] **AC-9:** Tapping a command shows its detailed session history
- [ ] **AC-10:** Commands sorted: learning first, then practicing, then mastered

### Technical Criteria
- [ ] **TC-1:** V4 migration adds `pt_training_commands` table with UNIQUE(pet_id, command_name) constraint
- [ ] **TC-2:** V4 migration is idempotent (CREATE TABLE IF NOT EXISTS) and has correct down migration
- [ ] **TC-3:** `calculateCommandProgress()` correctly averages success_rating across recent sessions, excluding null ratings
- [ ] **TC-4:** `getMasteredCommands()` returns commands with 5+ rated sessions and avg >= 4.0
- [ ] **TC-5:** `getTrainingStreak()` correctly counts consecutive calendar days with training logs
- [ ] **TC-6:** `getTrainingSummary()` aggregates total sessions, unique commands, mastery rate, and average duration
- [ ] **TC-7:** Auto-mastery check runs on every `createTrainingLog` call and updates `pt_training_commands` when criteria met
- [ ] **TC-8:** Command name uniqueness is case-insensitive
- [ ] **TC-9:** Training logs with null `success_rating` are excluded from average but included in session count

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Auto-mastery must NOT demote a mastered command if new sessions lower the average (mastery is sticky)
- [ ] **NC-2:** Renaming a command in `pt_training_commands` must NOT update historical `pt_training_logs` entries
- [ ] **NC-3:** Deleting a pet must NOT leave orphaned training commands (CASCADE)
- [ ] **NC-4:** Adding a duplicate command name (case-insensitive) must NOT create a second record
- [ ] **NC-5:** Disabling the Pets module must NOT delete training data
- [ ] **NC-6:** Training operations must NOT require network access (offline-first)

## UI Specification

### Mobile (Expo)

- **Background:** `#0A0A0F` (background token)
- **Training summary card:** `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border, 12px border radius. Stats in 2x2 grid: total sessions, unique commands, mastery rate %, avg duration. Each stat: value in `#F0F0F5` 24px semibold, label in `rgba(240,240,245,0.65)` 12px.
- **Streak display:** `#F59E0B` (module accent) flame icon + "X-day streak" in `#F0F0F5` 16px. Background: `rgba(245,158,11,0.08)` rounded pill. Positioned above the command list.
- **Command cards:** `rgba(255,255,255,0.04)` glass cards, 12px border radius. Left: command name in `#F0F0F5` 16px + session count in `rgba(240,240,245,0.65)`. Right: star rating display (filled stars in `#F59E0B`, empty in `rgba(255,255,255,0.10)`) + status badge.
- **Status badges:** Learning = `rgba(245,158,11,0.12)` background with `#F59E0B` text. Practicing = `rgba(48,209,88,0.12)` background with `#30D158` text. Mastered = `#30D158` background with `#0A0A0F` text (filled badge, celebratory).
- **Log session form:** Bottom sheet via expo-blur BlurView. Command picker (existing commands + "New command" option), location picker, duration stepper, 5-star rating selector, notes text area.
- **Session history:** Expandable per-command. List of sessions with date, location icon, rating stars, duration, notes. Glass card style.
- **Layout:** ScrollView with sections: streak pill, summary card, command list, "Log Session" FAB at bottom right.

### Web (Next.js)

- Same tokens via CSS variables in `globals.css`
- Training page at `/pets/[petId]/training` route
- Sidebar navigation: "Training" as sub-nav under pet detail
- Summary card uses CSS Grid (4-column at 1024px+, 2-column below)
- Command list as a table at wider viewports, cards on mobile
- Star rating uses CSS with `color: #F59E0B` for filled, `color: rgba(255,255,255,0.10)` for empty
- Log session uses modal dialog instead of bottom sheet
- Glass cards use CSS `backdrop-filter: blur(12px)`

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton summary card + 3 skeleton command cards | Initial data fetch |
| Empty | Paw + dumbbell illustration, "Start training [pet name]" CTA, "Add Command" + "Log Session" buttons | No commands or logs |
| Has commands, no logs | Command list with "0 sessions" on each, summary shows all zeros, no streak | Commands added but no sessions logged |
| Active training | Summary populated, streak shown, command progress visible | Training logs exist |
| Mastery achieved | Mastered command shows filled green badge + confetti animation (one-time) | Auto or manual mastery |
| Error | Toast: "Could not load training data." with retry | Database read fails |

## Test Requirements

### Unit Tests (engine/training.ts)
- [ ] `calculateCommandProgress`: returns average rating across 5 sessions (all rated)
- [ ] `calculateCommandProgress`: excludes null ratings from average
- [ ] `calculateCommandProgress`: returns null average when all ratings are null
- [ ] `calculateCommandProgress`: returns correct session count including unrated sessions
- [ ] `calculateCommandProgress`: uses only the N most recent sessions for average
- [ ] `getMasteredCommands`: returns commands with 5+ rated sessions and avg >= 4.0
- [ ] `getMasteredCommands`: excludes commands with <5 rated sessions even if avg >= 4.0
- [ ] `getMasteredCommands`: excludes commands where avg < 4.0 even with 10+ sessions
- [ ] `getMasteredCommands`: handles mixed rated/unrated sessions correctly
- [ ] `getTrainingStreak`: returns 5 for 5 consecutive days of training
- [ ] `getTrainingStreak`: returns 1 for training today only
- [ ] `getTrainingStreak`: returns 0 when no training logs exist
- [ ] `getTrainingStreak`: resets on a gap day (day 1, day 2, gap, day 4 = streak of 1)
- [ ] `getTrainingStreak`: multiple sessions same day count as 1 day
- [ ] `getTrainingStreak`: streak starts from most recent day backward
- [ ] `getTrainingSummary`: returns correct totals (sessions, commands, mastery rate, avg duration)
- [ ] `getTrainingSummary`: mastery rate = mastered / total commands as percentage
- [ ] `getTrainingSummary`: avg duration excludes null durations
- [ ] `getTrainingSummary`: returns all zeros when no data

### Integration Tests (CRUD)
- [ ] `addTrainingCommand`: creates command with "learning" status
- [ ] `addTrainingCommand`: rejects duplicate command name (case-insensitive)
- [ ] `addTrainingCommand`: stores original casing of command name
- [ ] `updateCommandStatus`: updates status and sets mastered_at for "mastered"
- [ ] `updateCommandStatus`: clears mastered_at when set to "learning" or "practicing"
- [ ] `listTrainingCommands`: returns commands sorted by status (learning, practicing, mastered)
- [ ] `getCommandProgress`: returns session count and average rating for a command
- [ ] `createTrainingLog` auto-creates command if new command name provided
- [ ] `createTrainingLog` triggers auto-mastery check and updates command status
- [ ] Auto-mastery: 5 sessions with ratings [4, 5, 4, 4, 5] triggers mastery (avg 4.4)
- [ ] Auto-mastery: 5 sessions with ratings [3, 5, 4, 4, 3] does NOT trigger (avg 3.8)
- [ ] Auto-mastery: 4 sessions with ratings [5, 5, 5, 5] does NOT trigger (<5 sessions)
- [ ] Auto-mastery does NOT demote already-mastered command on low new rating
- [ ] Delete pet cascades to training commands and training logs
- [ ] V4 migration runs cleanly on existing database

### QA Verification Script

1. Open the app on mobile (iOS simulator or device)
2. Navigate to MyPets module from hub dashboard
3. Tap an existing pet (or create "Luna", dog, golden retriever)
4. Navigate to training section
5. **Verify empty state:** Illustration with "Start training Luna" CTA -- empty state
6. Tap "Add Command"
7. Enter "Sit", save
8. **Verify:** "Sit" appears with "Learning" badge, "0 sessions", no rating -- AC-1
9. Add another command "Stay"
10. Try adding "sit" (lowercase)
11. **Verify:** Error "Command already exists" -- NC-4
12. Tap "Log Session"
13. Select "Sit", location = Home, duration = 10 min, rating = 4, save
14. **Verify:** Sit now shows "1 session", 4-star rating -- AC-2, AC-3
15. **Verify streak:** "1-day streak" displayed -- AC-5
16. Log 4 more sessions for "Sit" with ratings 4, 5, 4, 5 (total 5 sessions, avg 4.4)
17. **Verify auto-mastery:** Sit status changes to "Mastered" with green badge -- AC-4
18. **Verify summary:** Total sessions = 5, unique commands = 2, mastery rate = 50%, avg duration = 10 min -- AC-6
19. Tap "Stay" command
20. **Verify:** Shows "0 sessions" in detail view -- AC-9
21. Navigate back to command list
22. **Verify sort order:** Stay (learning) first, Sit (mastered) last -- AC-10
23. Long-press Stay, change status to "Practicing"
24. **Verify:** Stay shows "Practicing" badge in green -- AC-7
25. Log a session for a new command "Shake" (enters name directly in log form)
26. **Verify:** "Shake" auto-created in command list with "Learning" status -- AC-8
27. Log a session for "Sit" with rating = 2
28. **Verify:** Sit remains "Mastered" (mastery is sticky) -- NC-1

## gstack Quality Gates

Based on this feature's Complexity Inverse score of 3 (Medium):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI (check all that apply):
- [ ] `/browse` -- navigate to `/pets/[petId]/training` on web, verify all 6 states (loading, empty, has commands, active training, mastery, error)
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for training engine (command progress, auto-mastery, streak calculation, summary aggregation)

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- pets module has no standalone counterpart (skip)
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- `pt_training_logs` table exists (V2) with: id, pet_id, command_name, location, duration_minutes, success_rating (1-5), logged_at, notes, created_at
- `createTrainingLog()` and `listTrainingLogsForPet()` CRUD exist in `crud.ts`
- `TrainingLogSchema`, `CreateTrainingLogInputSchema`, `TrainingLocationSchema` exist in `types.ts`
- No command-level mastery tracking (just flat log entries)
- No training streak calculation
- No training summary statistics
- No auto-mastery detection

### After This Work
- V4 migration adds `pt_training_commands` table with UNIQUE(pet_id, command_name) and status tracking
- New engine `engine/training.ts` with: `calculateCommandProgress`, `getMasteredCommands`, `getTrainingStreak`, `getTrainingSummary`
- New CRUD: `addTrainingCommand`, `updateCommandStatus`, `listTrainingCommands`, `getCommandProgress`
- Enhanced `createTrainingLog` with auto-command creation and auto-mastery check
- New types: `TrainingCommand`, `TrainingCommandStatus`, `TrainingSummary`, `CommandProgress`
- Mobile screen at `apps/mobile/app/(pets)/training.tsx`
- Web page at `apps/web/app/pets/[petId]/training/page.tsx`
- 34+ new tests covering engine logic and CRUD operations

### Files Changed

- `modules/pets/src/db/schema.ts` -- V4 table DDL: pt_training_commands + indexes
- `modules/pets/src/definition.ts` -- Add pt_training_commands to V4 migration (or create V4/V5), bump schemaVersion
- `modules/pets/src/types.ts` -- New schemas: TrainingCommand, TrainingCommandStatus enum (learning/practicing/mastered), TrainingSummary, CommandProgress, CreateTrainingCommandInput
- `modules/pets/src/db/crud.ts` -- New CRUD: addTrainingCommand, updateCommandStatus, listTrainingCommands, getCommandProgress. Enhanced createTrainingLog with auto-command creation + auto-mastery.
- `modules/pets/src/engine/training.ts` -- New pure functions: calculateCommandProgress, getMasteredCommands, getTrainingStreak, getTrainingSummary
- `modules/pets/src/index.ts` -- Re-export new public API
- `modules/pets/src/__tests__/training.test.ts` -- Unit + integration tests
- `apps/mobile/app/(pets)/training.tsx` -- Per-pet training screen
- `apps/web/app/pets/[petId]/training/page.tsx` -- Web training page

### Known Limitations
- Command names are denormalized in `pt_training_logs` (TEXT column, not FK). Renaming a command does not update historical logs. This is intentional for historical accuracy.
- Auto-mastery is sticky: once mastered, a command stays mastered even if new sessions have low ratings. Only manual override can revert. This prevents discouraging users.
- Training streak is based on calendar days, not 24-hour windows. A session at 11:55 PM and another at 12:05 AM count as two separate days.
- No training lesson content or guided programs (Dogo's model). This is a tracking tool, not a curriculum.
- No video recording of training sessions (future feature).
- No cross-pet training comparison (e.g., "Luna mastered Sit faster than Max").

### Context for Next Agent
- The existing `createTrainingLog()` in `crud.ts` creates a `pt_training_logs` record. Enhance it to: (1) check if a `pt_training_commands` record exists for this pet+command_name (case-insensitive), (2) if not, auto-create one with status="learning", (3) after creating the log, run the auto-mastery check.
- Auto-mastery check logic: query the 5 most recent `pt_training_logs` for this pet+command where `success_rating IS NOT NULL`, compute average. If count >= 5 and avg >= 4.0 and current command status != "mastered", update `pt_training_commands` to status="mastered" and set `mastered_at`.
- The `TrainingLocationSchema` enum has 4 values: home, park, class, other. This is defined in `types.ts` (line 84).
- For the training streak, query `SELECT DISTINCT date(logged_at) as d FROM pt_training_logs WHERE pet_id = ? ORDER BY d DESC`. Then iterate from the most recent date backward, counting consecutive days. Stop at the first gap.
- Case-insensitive uniqueness: use `COLLATE NOCASE` on the UNIQUE constraint or normalize to lowercase before insert/check. SQLite's `COLLATE NOCASE` on the UNIQUE constraint is the cleanest approach: `UNIQUE(pet_id, command_name COLLATE NOCASE)`.
- The `success_rating` column allows NULL (for sessions where the user skips rating). Treat NULL as "no data" in averages but count the session toward total session count and streak.
