# Feature Spec: AI Workout Generation

## Metadata
- **Module:** workouts
- **Priority Score:** 34 / 50 (A-Tier)
- **Scoring Breakdown:** Market 4 x3 + Switching 4 x3 + Complexity 1 x2 + CrossModule 3 x1 + PaidUser 5 x1
- **Sprint:** 5
- **Estimated CC Time:** 5-6 hours
- **Depends On:** none (uses existing exercise library and workout builder)
- **Blocks:** none

## Business Context

### Why This Feature Exists
AI workout generation is Fitbod's core differentiator and a major premium conversion driver (5/5 PaidUser score). Users who don't know how to program their own workouts need intelligent suggestions based on their goals, available equipment, experience level, and recovery status. Complexity is 1 (hard) because it requires building a workout generation engine that considers muscle group balance, exercise selection, volume programming, and user preferences. This is a key competitive feature -- Fitbod charges $95.99/yr primarily for this capability.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Fitbod | Yes | Yes ($95.99/yr) | Core product: ML-driven workout generation with muscle recovery, equipment, goals |
| Hevy | Partial | Free (basic templates) | Pre-built workout templates, no AI generation |
| JEFIT | Partial | Yes ($155.88/yr) | Workout plan recommendations based on goals, not per-session generation |
| Strong | No | N/A | Template library only, no generation |
| Strava | No | N/A | No workout generation (GPS activity focused) |

### Target User
Beginners who don't know how to program workouts and need intelligent guidance. Intermediate users who want variety in their training without manually designing every session. Premium users willing to pay for AI-powered workout creation as a core value proposition.

## Technical Context

### Where This Lives in MyLife

```
modules/workouts/src/ai/generator.ts          -- Workout generation engine
modules/workouts/src/ai/prompt-builder.ts     -- LLM prompt construction
modules/workouts/src/ai/types.ts              -- Generation request/response types
modules/workouts/src/db/schema.ts             -- New wk_generation_history table
modules/workouts/src/db/crud.ts               -- Generation history CRUD
modules/workouts/src/index.ts                 -- Export AI generation functions
apps/mobile/app/(workouts)/generate.tsx       -- Generation request screen
apps/mobile/app/(workouts)/generated-preview.tsx -- Preview and accept screen
```

### Wireframe Position

```
Hub Dashboard
  └── MyWorkouts card
       └── Explore tab
            └── Generate Workout ← YOU ARE HERE
                 ├── Goal selector (strength/hypertrophy/endurance/general)
                 ├── Muscle focus selector (body map)
                 ├── Equipment selector
                 ├── Duration preference
                 ├── Difficulty preference
                 └── "Generate" button -> Preview -> Accept/Regenerate
```

### Data Model

```sql
-- Tracks generated workout history for user analytics and dedup
CREATE TABLE IF NOT EXISTS wk_generation_history (
  id TEXT PRIMARY KEY,
  goal TEXT NOT NULL,
  focus TEXT NOT NULL,                          -- muscle focus / workout focus
  equipment_json TEXT NOT NULL DEFAULT '[]',    -- available equipment
  difficulty TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  generated_workout_json TEXT NOT NULL,         -- the full generated workout definition
  accepted INTEGER NOT NULL DEFAULT 0,         -- 1 if user saved this workout
  source TEXT NOT NULL DEFAULT 'local' CHECK (source IN ('local', 'llm')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS wk_generation_history_created_idx ON wk_generation_history(created_at DESC);
CREATE INDEX IF NOT EXISTS wk_generation_history_goal_idx ON wk_generation_history(goal);
```

### Dependencies
- **Internal:** `@mylife/db`, exercise library (`wk_exercises`), workout builder (`createWorkout`), body map (muscle group data)
- **External:** Claude API (optional, for LLM-powered generation when API key is set). Falls back to local rule-based generation when no API key.
- **Cross-Module:** Muscle recovery heatmap (if built first, factor recovery status into exercise selection). Health module (user profile data for BMR/activity level). Nutrition module could inform pre/post workout suggestions (future).

## Functional Requirements

### User Stories
1. As a beginner, I want the app to generate a workout for me based on my goals and available equipment so I don't have to program my own.
2. As a user, I want to specify muscle focus, difficulty, and duration so the generated workout matches my needs today.
3. As a user, I want to preview the generated workout before accepting it so I can swap exercises or adjust.
4. As a user, I want both a local (offline) generator and an optional AI-enhanced generator for more creative workouts.

### Behavior Specification

**Generation request flow:**
1. User navigates to Explore tab and taps "Generate Workout"
2. Configuration screen appears with:
   - **Goal:** Strength / Hypertrophy / Endurance / General Fitness (segmented control)
   - **Muscle Focus:** Body map selector (tap muscle groups to include). Presets: Push/Pull/Legs/Upper/Lower/Full Body
   - **Equipment:** Multi-select from: Barbell, Dumbbells, Cables, Machines, Bodyweight, Bands, Kettlebell
   - **Duration:** 30 / 45 / 60 / 90 minutes (segmented)
   - **Difficulty:** Beginner / Intermediate / Advanced (segmented)
3. User taps "Generate"
4. System generates a workout using the selected parameters

**Local generation engine (always available):**
1. Filter exercise library (`wk_exercises`) by:
   - Matching muscle groups from the selected focus
   - Matching difficulty level
   - Category matching goal (strength -> compound lifts, hypertrophy -> isolation + compound, endurance -> circuit style)
2. Select exercises:
   - 4-6 exercises for 30 min, 6-8 for 45 min, 8-10 for 60 min, 10-12 for 90 min
   - Balance push/pull when full body or upper body
   - Avoid duplicate muscle groups (e.g., no 3 chest exercises unless chest-focused)
   - Prioritize compound movements first, then isolation
3. Program sets/reps based on goal:
   - Strength: 4-5 sets x 3-6 reps, 180s rest
   - Hypertrophy: 3-4 sets x 8-12 reps, 90s rest
   - Endurance: 2-3 sets x 15-20 reps, 45s rest
   - General: 3 sets x 10-12 reps, 60s rest
4. Build a `WorkoutDefinition` and present for preview

**LLM-enhanced generation (when API key configured):**
1. Build a prompt with:
   - User's goal, muscle focus, equipment, duration, difficulty
   - Available exercises from the library (names + muscle groups)
   - User's recent workout history (last 7 days of sessions, to avoid repeating)
   - Recovery status from muscle recovery heatmap (if available)
2. Send to Claude API via the intelligence module's consent-gated pipeline
3. Parse response into a `WorkoutDefinition`
4. Fall back to local generation if API call fails

**Preview and accept:**
1. Generated workout shown as a preview screen with:
   - Workout title (auto-generated)
   - Exercise list with sets, reps, rest times
   - Estimated duration
   - Muscle group coverage (body map mini-view)
2. User can:
   - **Accept:** Saves the workout to `wk_workouts` and optionally starts a session
   - **Regenerate:** Generates a new workout with the same parameters
   - **Edit:** Opens the workout builder with the generated exercises pre-loaded
   - **Dismiss:** Returns to Explore tab without saving

### Edge Cases

- **Exercise library has <4 matching exercises:** Generate with what's available. Show warning: "Limited exercises match your criteria."
- **No exercises match all filters:** Relax filters in priority order: difficulty first, then equipment, then muscle groups. Show which filters were relaxed.
- **API key not set:** Use local generation only. Show "AI-enhanced generation available with API key" prompt in settings.
- **API call fails (timeout, error):** Fall back to local generation. Show "Generated locally (AI unavailable)" badge.
- **API returns invalid workout structure:** Fall back to local generation. Log the error.
- **User generates 10+ workouts without accepting any:** Allow. No cap on generation.
- **Generated workout has the same exercises as last session:** Local engine checks recent sessions and de-prioritizes repeated exercises (use a freshness score).
- **Bodyweight-only equipment selected:** Filter to bodyweight exercises only. Many exercises qualify.
- **No equipment selected:** Default to bodyweight.
- **Duration mismatch (estimated > requested by 20%+):** Trim exercises from the end until duration estimate fits.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Generation request screen shows goal, muscle focus, equipment, duration, and difficulty selectors
- [ ] **AC-2:** "Generate" button creates a workout based on selected parameters
- [ ] **AC-3:** Preview screen shows exercise list with sets, reps, rest, and estimated duration
- [ ] **AC-4:** Body map mini-view shows muscle group coverage of the generated workout
- [ ] **AC-5:** "Accept" saves the workout and optionally starts a session
- [ ] **AC-6:** "Regenerate" creates a new workout with the same parameters
- [ ] **AC-7:** "Edit" opens the workout builder with generated exercises
- [ ] **AC-8:** Local generation works offline (no network required)
- [ ] **AC-9:** LLM generation available when API key is configured
- [ ] **AC-10:** Graceful fallback from LLM to local when API fails

### Technical Criteria
- [ ] **TC-1:** wk_generation_history table created by migration v4
- [ ] **TC-2:** Local engine selects exercises matching goal, focus, equipment, difficulty
- [ ] **TC-3:** Sets/reps programming follows goal-specific rep ranges
- [ ] **TC-4:** Exercise count scales with duration preference
- [ ] **TC-5:** Generated workout is a valid WorkoutDefinition that passes Zod validation
- [ ] **TC-6:** LLM prompt includes available exercises, recent history, and recovery status
- [ ] **TC-7:** Generation history logged for analytics

### Negative Criteria
- [ ] **NC-1:** Must NOT require API key or network for basic generation (local engine mandatory)
- [ ] **NC-2:** Must NOT generate exercises not in the user's exercise library
- [ ] **NC-3:** Must NOT send personal health data to the API (only exercise names and parameters)
- [ ] **NC-4:** Must NOT auto-start a session without user confirmation

## UI Specification

### Mobile (Expo)
- **Generation screen:** Background `#0A0A0F`. Goal as segmented control at top (`#EF4444` accent on selected). Body map selector with tappable muscle groups (highlighted in `#EF4444`). Equipment grid of glass cards with icons. Duration and difficulty as segmented controls. "Generate" button full-width, accent `#EF4444`.
- **Preview screen:** Glass card per exercise. Exercise name (primary text `#F0F0F5`), sets x reps (secondary `rgba(240,240,245,0.65)`), rest time, muscle group tags. Body map mini-view at top showing coverage. Action buttons at bottom: Accept (accent), Regenerate (glass), Edit (glass).
- **Loading state:** Skeleton cards with shimmer animation while generating (local should be <100ms, LLM may take 2-5s).

### Web (Next.js)
- `/workouts/generate` route. Side-by-side layout: configuration on left, preview on right.
- Body map clickable for muscle selection.

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Configuration | Goal, focus, equipment, duration, difficulty selectors | Navigate to Generate |
| Generating | Shimmer skeleton cards | "Generate" tapped |
| Preview | Exercise list with accept/regenerate/edit buttons | Generation complete |
| Fallback | "Generated locally" badge | LLM failed, local used |
| Empty library | "Add exercises to generate workouts" CTA | <4 exercises match filters |

## Test Requirements

### Unit Tests
- [ ] `generateLocalWorkout`: selects correct number of exercises for 30/45/60/90 min
- [ ] `generateLocalWorkout`: exercises match the selected muscle focus
- [ ] `generateLocalWorkout`: exercises match the selected difficulty
- [ ] `generateLocalWorkout`: programs correct rep ranges for strength/hypertrophy/endurance/general
- [ ] `generateLocalWorkout`: programs correct rest times per goal
- [ ] `generateLocalWorkout`: compound exercises prioritized over isolation
- [ ] `generateLocalWorkout`: avoids duplicate muscle groups (unless focused)
- [ ] `generateLocalWorkout`: returns valid WorkoutDefinition (passes Zod schema)
- [ ] `generateLocalWorkout`: handles empty exercise library gracefully
- [ ] `generateLocalWorkout`: de-prioritizes recently used exercises
- [ ] `buildLLMPrompt`: includes available exercises and parameters
- [ ] `buildLLMPrompt`: excludes personal health data
- [ ] `parseLLMResponse`: parses valid response into WorkoutDefinition
- [ ] `parseLLMResponse`: returns null for invalid response structure

### Integration Tests
- [ ] Full flow: configure -> generate (local) -> preview -> accept -> workout saved in wk_workouts
- [ ] Edit flow: generate -> edit -> modify in builder -> save
- [ ] Regenerate flow: generate -> regenerate -> different workout shown

### QA Verification Script

1. Navigate to MyWorkouts > Explore tab
2. Tap "Generate Workout"
3. Verify: Configuration screen with all selectors -- corresponds to AC-1
4. Select: Hypertrophy, Upper Body, Dumbbells + Barbell, 45 min, Intermediate
5. Tap "Generate"
6. Verify: Preview shows 6-8 exercises with 3-4 sets x 8-12 reps -- corresponds to AC-2, AC-3
7. Verify: Body map shows upper body coverage -- corresponds to AC-4
8. Tap "Accept"
9. Verify: Workout saved, option to start session -- corresponds to AC-5
10. Return and tap "Generate" again with same params
11. Tap "Regenerate"
12. Verify: Different workout generated -- corresponds to AC-6
13. Tap "Edit"
14. Verify: Workout builder opens with exercises pre-loaded -- corresponds to AC-7
15. Turn off airplane mode (if applicable), verify local generation works
16. Verify: No network required -- corresponds to AC-8
17. If API key configured, generate with LLM
18. Verify: AI-enhanced result appears -- corresponds to AC-9

## gstack Quality Gates

Based on Complexity 1 (Inverse), this feature is "Complex" tier.

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states

### Required if Complexity <= 2:
- [ ] `/plan-eng-review` -- run on this spec BEFORE building

### Required if Complexity <= 1:
- [ ] `/office-hours` (builder mode) -- validate approach

### Required if this feature contains business logic:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for generation engine

### Post-merge:
- [ ] `/parity-check` -- verify standalone parity

## Handoff State

### Before This Work
Workouts module has an exercise library (50+ exercises) and workout builder but no automated workout generation. Users must manually select exercises and program sets/reps.

### After This Work
- Local workout generation engine (offline, rule-based)
- Optional LLM-enhanced generation via Claude API
- Configuration screen with goal, muscle focus, equipment, duration, difficulty
- Preview and accept/regenerate/edit flow
- Generation history tracking
- Goal-specific rep/set/rest programming

### Files Changed
- `modules/workouts/src/ai/generator.ts` -- New: local generation engine
- `modules/workouts/src/ai/prompt-builder.ts` -- New: LLM prompt construction
- `modules/workouts/src/ai/types.ts` -- New: generation request/response types
- `modules/workouts/src/db/schema.ts` -- Extended: wk_generation_history table
- `modules/workouts/src/db/crud.ts` -- Extended: generation history CRUD
- `modules/workouts/src/db/migrations.ts` -- Extended: migration v4
- `modules/workouts/src/definition.ts` -- Bump schemaVersion, add generate screen
- `modules/workouts/src/index.ts` -- Export AI generation functions
- `apps/mobile/app/(workouts)/generate.tsx` -- Generation request screen
- `apps/mobile/app/(workouts)/generated-preview.tsx` -- Preview and accept screen

### Known Limitations
- Local engine is rule-based, not ML (simpler but less "intelligent" than Fitbod)
- No periodization awareness (doesn't plan mesocycles)
- No equipment availability memory (user selects each time)
- No user body composition input for exercise selection
- LLM generation requires API key and consent (opt-in)
- No generation from natural language ("give me a chest day")

### Context for Next Agent
- The exercise library is in `wk_exercises` with columns: name, category, muscle_groups_json, difficulty, default_sets, default_reps. Query it to get available exercises.
- The body map module (`body-map.ts`) has `EXERCISE_MUSCLE_MAPPINGS` for 12 exercises and `BODY_MAP_MUSCLE_GROUPS` for 14 muscle groups. Use these for muscle focus matching.
- The intelligence module (if it exists) provides the consent-gated LLM pipeline. Check `modules/workouts/src/definition.ts` imports. If not available, implement the API call directly with proper consent checks.
- For the local engine, exercise selection should use a scoring function: `score = muscleMatchScore + difficultyMatchScore + freshnessScore + compoundBonus`. Select top N exercises by score.
- Existing `WorkoutDefinitionSchema` in `types.ts` validates the output. The generated workout must pass this schema.
- All DB functions take `db: DatabaseAdapter` as the first parameter.
- If multiple features share migration v4, coordinate table creation in a single migration.
