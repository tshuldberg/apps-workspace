# Feature Spec: Dog Training Lesson Curriculum

## Metadata
- **Module:** pets
- **Priority Score:** 20 / 50 (B-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 2 x3 + Complexity 2 x2 + CrossModule 1 x1 + PaidUser 3 x1
- **Sprint:** Sprint 3
- **Estimated CC Time:** 3-4 hours
- **Depends On:** Training progress feature (V2 -- `pt_training_logs` table + `createTrainingLog` + `listTrainingLogsForPet` CRUD)
- **Blocks:** None

## Business Context

### Why This Feature Exists
Dog owners, especially first-time owners, struggle to know what commands to teach and in what order. Professional training classes cost $100-$300 for a multi-week course, and many owners want to train at home but lack a structured curriculum. The existing `pt_training_logs` table (V2) lets users log individual training sessions with command name, duration, location, and success rating, but there is no guidance on what to teach, no progression system, and no way to track mastery across a structured curriculum. This feature adds a 5-level training curriculum with 28 commands, step-by-step lesson plans, and automatic progress tracking that integrates with existing training log data.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Dogo | Yes | Premium ($200+/yr) | Full training curriculum with video guides, AI-based posture detection, 100+ tricks, gamified progression |
| Pupford | Yes | Partial (Free content + paid courses) | Video-based training courses, free basic commands, paid advanced courses ($47-$99 each) |
| 11pets | No | N/A | Training log only, no curriculum or lesson plans |
| PetDesk | No | N/A | No training features |
| Pawp | No | N/A | No training features |
| FitBark | No | N/A | Activity tracking only, no training |

### Target User
First-time dog owners (ages 20-45) who want a structured, self-paced training plan without paying for professional classes or expensive app subscriptions. Also experienced dog owners who adopt a new dog and want a refresher on progressive obedience training. Currently these users either pay $200+/yr for Dogo or watch unstructured YouTube videos. This feature provides a curated text-based curriculum for free (within the premium pets module) that integrates with the user's actual training log data to show real progress.

## Technical Context

### Where This Lives in MyLife

```
modules/pets/src/engine/lessons.ts                 -- NEW: curriculum data, lesson plans, progress tracking
modules/pets/src/types.ts                          -- New types: TrainingLevel, Lesson, LessonPlan, LevelProgress
modules/pets/src/index.ts                          -- Re-export new public API
modules/pets/src/__tests__/lessons.test.ts         -- Engine tests
apps/mobile/app/(pets)/training-lessons.tsx         -- Training curriculum screen
apps/mobile/app/(pets)/components/LessonCard.tsx    -- Lesson card with mastery indicator
apps/web/app/pets/[petId]/training/lessons/page.tsx -- Web training lessons page
```

### Wireframe Position

```
Hub Dashboard
  +-- MyPets card
       +-- Pets tab (pet list)
            +-- Pet Detail
                 +-- Health tab
                      +-- Training section
                           +-- Training Lessons <-- YOU ARE HERE
```

The training lessons screen is accessible from the pet detail's training section, either via a "View Curriculum" button on the training log screen or a dedicated "Lessons" nav item. It sits alongside the existing training log functionality.

### Data Model

No schema changes needed. Lessons are static content and progress is derived from existing `pt_training_logs` data.

```sql
-- Existing V2 table (no changes needed)
CREATE TABLE IF NOT EXISTS pt_training_logs (
  id TEXT PRIMARY KEY,
  pet_id TEXT NOT NULL REFERENCES pt_pets(id) ON DELETE CASCADE,
  command_name TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT 'home',
  duration_minutes INTEGER,
  success_rating INTEGER,
  logged_at TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Existing V2 index (no changes needed)
CREATE INDEX IF NOT EXISTS pt_training_logs_pet_idx
  ON pt_training_logs(pet_id, logged_at DESC);
```

Progress is computed by matching `command_name` values in training logs against the curriculum's command names. A command is considered "mastered" when at least 3 training sessions exist with a `success_rating` of 4 or 5.

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter -- for reading training logs), `@mylife/module-registry` (ModuleDefinition), `@mylife/ui` (Cool Obsidian tokens, glass card components)
- **External:** None. Curriculum content is static and bundled. No videos, no external APIs.
- **Cross-Module:** None. Training is self-contained within the Pets module.

## Functional Requirements

### User Stories
1. As a dog owner, I want to see a structured curriculum with 5 progressive levels so that I know what commands to teach and in what order.
2. As a dog owner, I want each lesson to include step-by-step instructions, tips, and common mistakes so that I can train my dog effectively at home.
3. As a dog owner, I want the curriculum to automatically track which commands my dog has mastered based on my training logs so that I do not have to manually check off progress.
4. As a dog owner, I want to see my current level and a progress percentage so that I feel motivated to continue training.
5. As a dog owner, I want to see the next recommended lesson so that I know exactly what to work on next.
6. As a cat/bird/other pet owner, I want a clear message that training lessons are dog-only so that I do not feel like the feature is broken.

### Behavior Specification

**Viewing the training curriculum:**
1. User navigates to a pet's training section and taps "View Curriculum" or "Lessons"
2. System checks if the pet's species is "dog". If not, shows species-gate message (see edge cases).
3. System loads all training logs for this pet via `listTrainingLogsForPet()`
4. System computes mastery status for each curriculum command by matching `command_name` (case-insensitive)
5. System determines the current level (first level with at least one un-mastered command)
6. System displays the curriculum as expandable level sections with lesson cards inside

**Level display:**
1. Five levels are shown as expandable accordion sections
2. Each level header shows: level name, progress bar, "X of Y commands mastered" count
3. The current level (first incomplete) is expanded by default, others are collapsed
4. Completed levels show a green checkmark badge on the header
5. Future levels (beyond current) are visible but show a muted "Complete [previous level] first" note

**Lesson card display:**
1. Each lesson card shows: command name, difficulty indicator (1-3 paw prints), estimated time to master, mastery status
2. Mastery status: "Not Started" (gray), "In Progress" (amber, shows session count), "Mastered" (green checkmark)
3. Tapping a lesson card expands it to show: step-by-step instructions (3-5 numbered steps), tips section, common mistakes section

**Logging a training session from the curriculum:**
1. User taps "Log Practice" on an expanded lesson card
2. System pre-fills the training log form with the command name from the curriculum
3. User fills in duration, location, success rating, and optional notes
4. On save, the system creates a training log record via existing `createTrainingLog()` CRUD
5. The lesson card's mastery indicator updates to reflect the new session count / rating

**Getting the next lesson:**
1. A "Next Lesson" banner at the top of the curriculum shows the first un-mastered command in the current level
2. Tapping the banner scrolls to and expands that lesson card
3. If the current level is complete, the banner promotes to the next level's first command

### Edge Cases

- **Non-dog pets:** Show a message: "Training lessons are currently available for dogs. Log training sessions for [pet name] in the Training Log." Do not block access to training log CRUD -- only the curriculum feature is dog-specific.
- **Commands already mastered before starting curriculum:** If a user has logged training sessions for "sit" with 3+ sessions at 4-5 rating before ever viewing the curriculum, the "sit" lesson shows as "Mastered" immediately. Prior training history counts.
- **No training history:** All commands show "Not Started". Level 1 is expanded. "Next Lesson" banner points to the first command (sit).
- **Training log command name does not match curriculum exactly:** Match is case-insensitive and trimmed. "Sit" matches "sit", " SIT " matches "sit". No fuzzy matching (e.g., "sitting" does not match "sit").
- **Multiple sessions for same command with varying ratings:** Mastery requires 3+ sessions with `success_rating >= 4`. Sessions with lower ratings count toward the total but not toward mastery. Show "X sessions logged, Y successful" detail.
- **All commands mastered (curriculum complete):** Show a congratulatory banner: "Amazing! [pet name] has completed the entire curriculum!" with confetti-style accent animation.
- **Training logs deleted after mastery:** Mastery status recalculates dynamically from current log data. Deleting a session may demote a mastered command to "In Progress".
- **Pet is archived:** Curriculum is still viewable with current progress, but "Log Practice" button is hidden.
- **Module disabled:** Routes removed, training log data preserved.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Curriculum screen shows 5 levels (Puppy Basics, Good Manners, Social Skills, Advanced, Expert) as expandable sections
- [ ] **AC-2:** Each level header shows level name, progress bar, and "X of Y commands mastered" count
- [ ] **AC-3:** Current level (first incomplete) is expanded by default; completed levels show green checkmark
- [ ] **AC-4:** Lesson cards show command name, difficulty (1-3 paw prints), estimated mastery time, and mastery status
- [ ] **AC-5:** Tapping a lesson card expands to show step-by-step instructions, tips, and common mistakes
- [ ] **AC-6:** Mastery status reflects actual training log data (3+ sessions with success_rating >= 4 = mastered)
- [ ] **AC-7:** "Log Practice" button pre-fills command name and creates a training log via existing CRUD
- [ ] **AC-8:** "Next Lesson" banner at top shows the first un-mastered command in current level
- [ ] **AC-9:** Non-dog pets see "Training lessons are currently available for dogs" message
- [ ] **AC-10:** Curriculum completion shows congratulatory banner

### Technical Criteria
- [ ] **TC-1:** `TRAINING_CURRICULUM` constant defines 5 levels with 5-8 commands each (28 total commands)
- [ ] **TC-2:** Each curriculum entry includes: commandName, difficulty (1-3), steps (3-5 strings), tips (1-3 strings), commonMistakes (1-3 strings), estimatedDays (number)
- [ ] **TC-3:** `getLessonPlan()` returns the full curriculum annotated with mastery status from training logs
- [ ] **TC-4:** `getNextLesson()` returns the first un-mastered command in the first incomplete level, or null if all mastered
- [ ] **TC-5:** `getLevelProgress()` returns the correct percentage of mastered commands for a given level
- [ ] **TC-6:** Mastery detection is case-insensitive and trim-normalized (matches `command_name` in training logs)
- [ ] **TC-7:** Mastery threshold is 3 sessions with `success_rating >= 4`
- [ ] **TC-8:** All engine functions are pure (take training logs + curriculum as input, produce results as output)

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Curriculum must NOT require schema changes or new database tables
- [ ] **NC-2:** Non-dog pets must NOT see training lesson content (species gate required)
- [ ] **NC-3:** Logging practice from curriculum must NOT bypass existing `createTrainingLog()` CRUD validation
- [ ] **NC-4:** Mastery status must NOT persist anywhere except as computed from training log data (no separate mastery table)
- [ ] **NC-5:** Disabling the Pets module must NOT delete training log data used for progress tracking
- [ ] **NC-6:** Curriculum content must NOT include video or external media links (text-only, offline-first)

## UI Specification

### Mobile (Expo)

- **Background:** `#0A0A0F` (background token)
- **Level headers:** `#12121A` (surface token) background, `#F0F0F5` (text token) level name, `rgba(240,240,245,0.65)` (textSecondary) progress count
- **Level progress bar:** `#F59E0B` (module accent) fill on `rgba(255,255,255,0.06)` track, 4px height, rounded ends
- **Completed level badge:** `#30D158` (success) checkmark circle on level header
- **Lesson cards:** `rgba(255,255,255,0.04)` (glass token) fill with `rgba(255,255,255,0.10)` (glassBorder) border, 12px border radius
- **Difficulty paw prints:** `#F59E0B` (filled) and `rgba(255,255,255,0.10)` (unfilled), 16px size
- **Mastery indicators:**
  - Not Started: `rgba(240,240,245,0.35)` circle outline, gray text
  - In Progress: `#F59E0B` (amber) partial fill circle, amber text showing "X/3 sessions"
  - Mastered: `#30D158` (success) filled circle with checkmark
- **Expanded lesson content:** Step numbers in `#F59E0B`, step text in `#F0F0F5`, tips in `rgba(240,240,245,0.65)` with lightbulb icon, common mistakes in `rgba(255,69,58,0.65)` with warning icon
- **"Next Lesson" banner:** `rgba(245,158,11,0.12)` background with `#F59E0B` text and arrow icon, top of screen
- **"Log Practice" button:** `#F59E0B` background, `#0A0A0F` text, full-width within expanded card
- **Congratulatory banner:** `rgba(48,209,88,0.12)` background with `#30D158` text, trophy icon
- **Species gate message:** Centered text with `rgba(240,240,245,0.65)` color, dog silhouette illustration
- **Layout:** ScrollView with sections: "Next Lesson" banner, 5 level accordion sections, each containing lesson cards

### Web (Next.js)

- Same tokens via CSS variables in `globals.css`
- Training lessons accessible via `/pets/[petId]/training/lessons` route
- Sidebar navigation: "Lessons" appears as a sub-nav item under Training
- Level sections use `<details>` elements for native accordion behavior
- Lesson cards expand inline with CSS transitions (200ms ease)
- "Log Practice" opens a side panel form instead of navigating away
- Difficulty paw prints rendered as SVG inline icons

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | 5 skeleton level headers with pulsing animation | Initial data fetch |
| Species Gate | Dog silhouette, "Training lessons are currently available for dogs" message, link to training log | Pet is not a dog |
| Fresh Start | All levels visible, Level 1 expanded, all commands "Not Started", "Next Lesson" points to "sit" | Dog with no training history |
| In Progress | Current level expanded with mix of mastered/in-progress/not-started commands, completed levels collapsed with checkmarks | Dog with partial training history |
| Level Complete | Completed level shows green checkmark, next level auto-expands | All commands in a level mastered |
| All Complete | Congratulatory banner with trophy icon, all levels show green checkmarks | All 28 commands mastered |
| Error | Toast: "Could not load training data." with retry action | Database read fails |

## Test Requirements

### Unit Tests (engine/lessons.ts)
- [ ] `TRAINING_CURRICULUM`: contains exactly 5 levels
- [ ] `TRAINING_CURRICULUM`: Puppy Basics has exactly 5 commands (sit, stay, come, down, leave it)
- [ ] `TRAINING_CURRICULUM`: Good Manners has exactly 5 commands (heel, wait, drop it, gentle, place)
- [ ] `TRAINING_CURRICULUM`: Social Skills has exactly 5 commands (greet, quiet, settle, off, touch)
- [ ] `TRAINING_CURRICULUM`: Advanced has exactly 5 commands (roll over, shake, spin, crawl, bow)
- [ ] `TRAINING_CURRICULUM`: Expert has exactly 5 commands (back up, speak, weave, fetch specific, clean up) -- adjusted to 3-8 per spec
- [ ] `TRAINING_CURRICULUM`: every command has 3-5 steps, 1-3 tips, 1-3 common mistakes, and an estimatedDays value
- [ ] `getLessonPlan`: returns all commands with "not_started" status when no training logs exist
- [ ] `getLessonPlan`: marks "sit" as "mastered" when 3+ sessions with rating >= 4 exist
- [ ] `getLessonPlan`: marks "sit" as "in_progress" when 2 sessions with rating >= 4 exist
- [ ] `getLessonPlan`: does not count sessions with rating < 4 toward mastery
- [ ] `getLessonPlan`: case-insensitive matching ("SIT" matches curriculum "sit")
- [ ] `getLessonPlan`: trims whitespace (" sit " matches "sit")
- [ ] `getLessonPlan`: marks command mastered before curriculum was viewed (pre-existing logs)
- [ ] `getNextLesson`: returns "sit" when no commands are mastered
- [ ] `getNextLesson`: returns second un-mastered command when first is mastered
- [ ] `getNextLesson`: promotes to next level when current level is complete
- [ ] `getNextLesson`: returns null when all 28 commands are mastered
- [ ] `getLevelProgress`: returns 0 for a level with no mastered commands
- [ ] `getLevelProgress`: returns 60 (3/5) when 3 of 5 commands in a level are mastered
- [ ] `getLevelProgress`: returns 100 when all commands in a level are mastered

### Integration Tests
- [ ] Logging a training session via `createTrainingLog()` and then calling `getLessonPlan()` reflects the new session
- [ ] Deleting a training log demotes a "mastered" command to "in_progress" when session count drops below threshold
- [ ] Multiple pets have independent progress (logs for pet A do not affect pet B's curriculum)

### QA Verification Script

1. Open the app on mobile (iOS simulator or device)
2. Navigate to MyPets module from hub dashboard
3. Create a dog pet: "Rex", dog, labrador retriever, birth date = 6 months ago
4. Navigate to pet detail, find the training area, tap "View Curriculum" or "Lessons"
5. **Verify curriculum structure:** 5 levels visible, Level 1 (Puppy Basics) expanded -- AC-1
6. **Verify level header:** "Puppy Basics - 0 of 5 mastered" with empty progress bar -- AC-2
7. **Verify "Next Lesson" banner:** Shows "sit" as the next lesson -- AC-8
8. Tap the "sit" lesson card
9. **Verify expanded content:** Step-by-step instructions (3-5 steps), tips, common mistakes visible -- AC-5
10. **Verify difficulty:** 1 paw print (easiest command) -- AC-4
11. Tap "Log Practice" on the sit lesson
12. **Verify pre-fill:** Command name is "sit" -- AC-7
13. Fill in: duration = 10 min, location = home, success_rating = 5, save
14. **Verify mastery update:** Sit shows "1/3 sessions" in progress indicator -- AC-6
15. Log 2 more successful sessions for "sit" (rating 4 or 5)
16. **Verify mastery:** Sit shows green checkmark "Mastered" -- AC-6
17. **Verify level progress:** "1 of 5 mastered", progress bar shows 20% -- AC-2
18. **Verify "Next Lesson":** Now shows "stay" (next un-mastered in Level 1) -- AC-8
19. Create a cat pet: "Whiskers", cat
20. Navigate to Whiskers' training lessons
21. **Verify species gate:** "Training lessons are currently available for dogs" message -- AC-9
22. Return to Rex, master all Level 1 commands (log 3 sessions each at rating 5)
23. **Verify level complete:** Level 1 header shows green checkmark, Level 2 auto-expands -- AC-3
24. Master all remaining commands across all levels
25. **Verify curriculum complete:** Congratulatory banner appears -- AC-10

## gstack Quality Gates

Based on this feature's Complexity Inverse score of 2 (Large):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required for Large features:
- [ ] `/plan-eng-review` -- review this spec before building

### Required if this feature has UI (check all that apply):
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states
- [ ] `/qa` -- run after building, comprehensive QA pass on the training lessons section

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for mastery detection and level progression logic

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- pets module has no standalone counterpart (skip)
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- `pt_training_logs` table exists (V2) with columns: id, pet_id, command_name, location, duration_minutes, success_rating, logged_at, notes, created_at
- `createTrainingLog()` and `listTrainingLogsForPet()` CRUD exist in `crud.ts`
- `TrainingLogSchema`, `CreateTrainingLogInputSchema`, and `TrainingLocationSchema` Zod schemas exist in `types.ts`
- No structured curriculum content
- No lesson plans with step-by-step instructions
- No mastery detection or progress tracking
- No species gating for training features
- No mobile or web UI for curriculum browsing

### After This Work
- New engine file `engine/lessons.ts` with `TRAINING_CURRICULUM` constant, `getLessonPlan()`, `getNextLesson()`, `getLevelProgress()`
- New types: `TrainingLevelSchema`, `LessonSchema`, `LessonPlanEntry`, `LevelProgress`, `MasteryStatus`
- No schema changes (progress is computed from existing training logs)
- Mobile screen at `apps/mobile/app/(pets)/training-lessons.tsx` with level accordion, lesson cards, "Next Lesson" banner
- Web page at `apps/web/app/pets/[petId]/training/lessons/page.tsx`
- 25+ new tests covering curriculum structure, mastery detection, level progression

### Files Changed

- `modules/pets/src/engine/lessons.ts` -- NEW: TRAINING_CURRICULUM (5 levels, 28 commands), getLessonPlan, getNextLesson, getLevelProgress, mastery detection
- `modules/pets/src/types.ts` -- New: TrainingLevelSchema enum, LessonSchema, LessonPlanEntry interface, LevelProgress interface, MasteryStatus type
- `modules/pets/src/index.ts` -- Re-export new public API
- `modules/pets/src/__tests__/lessons.test.ts` -- Unit + integration tests
- `apps/mobile/app/(pets)/training-lessons.tsx` -- Curriculum screen with level accordion
- `apps/mobile/app/(pets)/components/LessonCard.tsx` -- Lesson card with mastery indicator and expandable content
- `apps/web/app/pets/[petId]/training/lessons/page.tsx` -- Web training lessons page

### Known Limitations
- Curriculum content is text-only. No videos, animations, or interactive demos. This is intentional (offline-first, no external dependencies) but means the feature competes on structure and integration rather than multimedia richness.
- The curriculum is fixed at 28 commands across 5 levels. Users cannot add custom commands to the curriculum (though they can log any command name in training logs).
- Mastery threshold (3 sessions, rating >= 4) is not configurable. A future enhancement could allow users to set their own mastery criteria.
- Command matching is exact (case-insensitive, trimmed) but not fuzzy. Logging "sitting" does not count toward "sit" mastery. Users need to use the exact command name or use the "Log Practice" button which pre-fills it.
- No breed-specific curriculum adjustments. A border collie and a bulldog see the same curriculum. Breed-specific training recommendations could be a future enhancement.
- Levels must be completed in order for the "Next Lesson" recommendation, but users can log sessions for any command at any time. The curriculum order is advisory, not enforced.

### Context for Next Agent
- The `TRAINING_CURRICULUM` should be a typed constant, not a database table. Define it as `ReadonlyArray<TrainingLevel>` where each level has `name`, `commands: ReadonlyArray<Lesson>`. Each `Lesson` has `commandName`, `difficulty` (1-3), `steps` (string[]), `tips` (string[]), `commonMistakes` (string[]), `estimatedDays` (number).
- `getLessonPlan()` should take `(curriculum: ReadonlyArray<TrainingLevel>, trainingLogs: TrainingLog[])` and return an annotated plan with mastery status per command. Keep it pure -- no database access in the engine.
- Mastery detection: build a `Map<string, { totalSessions: number; successfulSessions: number }>` from training logs (keyed by `commandName.trim().toLowerCase()`). A command is "mastered" when `successfulSessions >= 3`, "in_progress" when `totalSessions > 0 && successfulSessions < 3`, and "not_started" when `totalSessions === 0`. A "successful session" has `success_rating >= 4`.
- The `getNextLesson()` function should iterate levels in order, then commands within each level, returning the first command with status !== "mastered". This provides the linear progression path.
- For the UI, the "Log Practice" button should navigate to the existing training log creation flow with the `commandName` pre-filled. Do not create a separate training log creation path -- reuse `createTrainingLog()`.
