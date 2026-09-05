# Feature Spec: Progressive Overload Automation

## Metadata
- **Module:** workouts
- **Priority Score:** 35 / 50 (A-Tier)
- **Scoring Breakdown:** Market 4 x3 + Switching 4 x3 + Complexity 3 x2 + CrossModule 1 x1 + PaidUser 4 x1
- **Sprint:** 5
- **Estimated CC Time:** 3-4 hours
- **Depends On:** Previous performance display (needs historical data query pattern)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Progressive overload is the fundamental principle of strength training: gradually increasing weight, reps, or volume over time to force adaptation. Fitbod automates this with AI-driven weight suggestions. Hevy added a simpler version with manual progression rules. Users who don't progressively overload plateau and churn. Complexity is 3 (medium) because it requires building a suggestion engine that reads historical performance, applies configurable progression rules, and surfaces suggestions inline during the session.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Fitbod | Yes | Yes ($95.99/yr) | AI-driven weight recommendations based on muscle recovery, rep ranges, and training history |
| Hevy | Yes | Yes ($36/yr Pro) | Manual progression rules: +5 lbs when all sets hit target reps |
| Strong | Partial | Yes ($29.99/yr) | Shows rep/weight trends but no auto-suggestions |
| JEFIT | Partial | Yes ($155.88/yr) | Progress tracking with goals but no auto-progression |

### Target User
Intermediate to advanced lifters who understand progressive overload but want automation to handle the math. Users following structured programs where progressive overload is prescribed (e.g., "add 5 lbs to your squat every session"). Users switching from Fitbod who expect weight suggestions.

## Technical Context

### Where This Lives in MyLife

```
modules/workouts/src/overload/engine.ts       -- Progressive overload calculation engine
modules/workouts/src/overload/types.ts        -- Overload rule types
modules/workouts/src/db/crud.ts               -- Query exercise history for overload decisions
modules/workouts/src/db/schema.ts             -- New wk_overload_rules table
modules/workouts/src/index.ts                 -- Export overload functions
apps/mobile/app/(workouts)/session.tsx        -- Suggestion badges on set rows
apps/mobile/app/(workouts)/overload-settings.tsx -- Overload rule configuration
```

### Wireframe Position

```
Hub Dashboard
  └── MyWorkouts card
       └── Active workout session
            └── Exercise card (during workout)
                 └── Set row
                      ├── Previous: 135 lbs x 10
                      ├── Suggested: 140 lbs x 10 ↑ ← YOU ARE HERE
                      ├── Current weight input
                      └── Current reps input
```

### Data Model

```sql
-- Progressive overload rules per exercise or global
CREATE TABLE IF NOT EXISTS wk_overload_rules (
  id TEXT PRIMARY KEY,
  exercise_id TEXT,                           -- NULL = global default rule
  rule_type TEXT NOT NULL DEFAULT 'weight_increment' CHECK (rule_type IN ('weight_increment', 'rep_increment', 'set_increment', 'percentage')),
  trigger_condition TEXT NOT NULL DEFAULT 'all_sets_hit' CHECK (trigger_condition IN ('all_sets_hit', 'any_set_hit', 'average_reps_hit')),
  target_reps INTEGER,                        -- e.g., when all sets hit 10 reps
  increment_value REAL NOT NULL DEFAULT 5,    -- e.g., add 5 lbs
  increment_unit TEXT NOT NULL DEFAULT 'lbs' CHECK (increment_unit IN ('lbs', 'kg', 'reps', 'percent')),
  min_sessions INTEGER NOT NULL DEFAULT 2,    -- require N sessions of hitting target before suggesting
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS wk_overload_rules_exercise_idx ON wk_overload_rules(exercise_id);
```

### Dependencies
- **Internal:** `@mylife/db`, `wk_workout_set_weights` (performance history), `wk_exercise_1rm_history` (1RM trends), previous performance query
- **External:** None
- **Cross-Module:** None

## Functional Requirements

### User Stories
1. As a lifter, I want the app to suggest when to increase weight based on my recent performance so I don't have to do the math.
2. As a user, I want configurable progression rules (e.g., "+5 lbs when all sets hit 10 reps") so the system matches my training philosophy.
3. As a user, I want to see the suggestion inline during my session so I can accept or ignore it.
4. As a user, I want a global default rule and the ability to override per exercise.

### Behavior Specification

**Overload suggestion calculation:**
1. Before or during session start, for each exercise in the workout:
   a. Look up the overload rule (exercise-specific first, then global default)
   b. Query the last N sessions (from `min_sessions`) for that exercise's set weights
   c. Check the trigger condition against recent performance:
      - `all_sets_hit`: All sets in the last N sessions achieved >= `target_reps` at the current weight
      - `any_set_hit`: At least one set in the last session hit `target_reps`
      - `average_reps_hit`: Average reps across last N sessions >= `target_reps`
   d. If condition met, calculate the suggestion:
      - `weight_increment`: Previous weight + `increment_value` (in `increment_unit`)
      - `rep_increment`: Previous reps + `increment_value`
      - `set_increment`: Previous sets + `increment_value`
      - `percentage`: Previous weight * (1 + `increment_value` / 100)

**Display during session:**
1. If a suggestion exists for an exercise, show a "Suggested" badge on the first set row:
   - "Suggested: 140 lbs x 10" with an up-arrow icon
   - Badge color: module accent `#EF4444` with alpha
2. If no suggestion (not enough history, or condition not met), show nothing extra.
3. Tapping the suggestion pre-fills weight/reps (same pattern as previous performance tap-to-fill).

**Rule configuration:**
1. In Workouts Settings > Progressive Overload:
   - Global default rule (applies to all exercises without a specific rule)
   - Default: "Add 5 lbs when all sets hit target reps for 2 consecutive sessions"
2. Per-exercise override:
   - Accessible from exercise detail screen or workout builder
   - Same fields: rule type, trigger, target reps, increment, min sessions
3. Preset templates:
   - "Linear progression (beginners)": +5 lbs / session when target reps hit
   - "Double progression": increase reps first to top of range, then add weight and reset reps
   - "Percentage-based": +2.5% when target hit

**Suggestion history:**
1. When a user accepts a suggestion (taps to pre-fill and completes the set), log it for analytics.
2. This data feeds into the progress module's trend analysis.

### Edge Cases

- **No previous sessions for an exercise:** No suggestion generated. Show nothing.
- **Only 1 previous session but min_sessions is 2:** No suggestion until 2 sessions meet criteria.
- **User decreased weight last session (deload):** Suggestion engine reads the most recent weight at the target set count. If user deloaded, suggestion is based on the deload weight, not the pre-deload weight.
- **Mixed weight across sets (e.g., pyramid sets):** Suggestion applies per-set. If set 1 was 135, set 2 was 155, set 3 was 175, suggestions are calculated independently per set.
- **Bodyweight exercises (e.g., pull-ups):** Rule type `rep_increment` works. No weight increment needed.
- **Cardio/mobility exercises:** No overload suggestions for non-strength categories. Suggestion engine filters by category.
- **Very small increment (e.g., 1.25 lbs):** Allow. Microloading is a real training technique.
- **Weight exceeds available plates:** Not our concern. User decides feasibility.
- **No global default rule set:** Use built-in default: weight_increment, +5 lbs, all_sets_hit, target 10 reps, min 2 sessions.
- **Exercise has no set weight history (only bodyweight):** No weight suggestion. Rep suggestion can still apply if rule_type is rep_increment.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Overload suggestion shown inline on exercise set rows when conditions are met
- [ ] **AC-2:** Suggestion format: "Suggested: [weight] [unit] x [reps]" with accent badge
- [ ] **AC-3:** Tapping suggestion pre-fills weight and reps inputs
- [ ] **AC-4:** No suggestion shown when conditions are not met or no history exists
- [ ] **AC-5:** Global default rule configurable in settings
- [ ] **AC-6:** Per-exercise rule override available from exercise detail
- [ ] **AC-7:** Preset rule templates available (linear, double progression, percentage)
- [ ] **AC-8:** Suggestions calculated from the most recent N sessions matching min_sessions

### Technical Criteria
- [ ] **TC-1:** wk_overload_rules table created by migration v4
- [ ] **TC-2:** Overload engine is a pure function (no side effects, testable)
- [ ] **TC-3:** Engine correctly evaluates all_sets_hit, any_set_hit, average_reps_hit triggers
- [ ] **TC-4:** Engine correctly calculates weight_increment, rep_increment, set_increment, percentage
- [ ] **TC-5:** Default rule seeded on first use (not in migration, created lazily)
- [ ] **TC-6:** Suggestion calculation runs in <100ms for exercises with 50+ sessions of history

### Negative Criteria
- [ ] **NC-1:** Must NOT auto-apply suggestions (user must tap to accept)
- [ ] **NC-2:** Must NOT show suggestions for cardio or mobility exercises
- [ ] **NC-3:** Must NOT require network access

## UI Specification

### Mobile (Expo)
- **Suggestion badge:** Inline on set row, below previous performance ghost text. Background: `rgba(239,68,68,0.15)` (accent with alpha). Text: `#EF4444`. Up-arrow icon (Feather: `arrow-up`). "Suggested: 140 lbs x 10".
- **Settings screen:** Glass cards for rule configuration. Segmented controls for rule type and trigger condition. Number inputs for increment value and target reps. Preset template cards at top.
- **Exercise override:** On exercise detail screen, a "Progression Rule" section with toggle "Use custom rule" and fields below.

### Web (Next.js)
- `/workouts/settings/overload` route. Table layout for rules.
- Suggestions shown in the session table alongside previous performance column.

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Suggestion available | Accent badge with suggested weight/reps | Overload conditions met |
| No suggestion | No badge (just previous performance or empty) | Conditions not met or no history |
| Suggestion accepted | Inputs pre-filled, badge dims | User tapped suggestion |
| Settings | Rule configuration form | Navigate to overload settings |
| First use | Default rule auto-created, explainer card | First workout after feature ships |

## Test Requirements

### Unit Tests
- [ ] `evaluateOverload`: all_sets_hit returns true when all sets >= target_reps for min_sessions
- [ ] `evaluateOverload`: all_sets_hit returns false when one set misses target
- [ ] `evaluateOverload`: any_set_hit returns true when at least one set hits target
- [ ] `evaluateOverload`: average_reps_hit calculates average correctly across sessions
- [ ] `calculateSuggestion`: weight_increment adds correct value in lbs
- [ ] `calculateSuggestion`: weight_increment adds correct value in kg
- [ ] `calculateSuggestion`: rep_increment adds reps correctly
- [ ] `calculateSuggestion`: percentage calculates correct increment
- [ ] `calculateSuggestion`: returns null when fewer sessions than min_sessions
- [ ] `calculateSuggestion`: returns null for cardio/mobility exercises
- [ ] `getOverloadRule`: returns exercise-specific rule when available
- [ ] `getOverloadRule`: falls back to global default when no exercise rule exists
- [ ] `getOverloadRule`: returns built-in default when no rules exist at all

### Integration Tests
- [ ] Full flow: complete 2 sessions hitting target reps -> start 3rd session -> suggestion appears -> tap -> pre-fill
- [ ] Override flow: set per-exercise rule -> complete sessions -> exercise-specific suggestion differs from global

### QA Verification Script

1. Navigate to Workouts > Settings > Progressive Overload
2. Verify: Default rule exists (5 lbs, all sets hit 10 reps, 2 sessions) -- corresponds to AC-5
3. Create a workout with Bench Press (3x10)
4. Complete session 1: all sets at 135 lbs x 10
5. Complete session 2: all sets at 135 lbs x 10
6. Start session 3
7. Verify: "Suggested: 140 lbs x 10" badge on Bench Press -- corresponds to AC-1, AC-2
8. Tap the suggestion
9. Verify: Weight pre-fills to 140, reps to 10 -- corresponds to AC-3
10. Create a new exercise with no history
11. Verify: No suggestion badge -- corresponds to AC-4
12. Go to exercise detail for Bench Press
13. Set a custom rule: +2.5 kg, percentage-based
14. Verify: Rule saved -- corresponds to AC-6
15. Check preset templates
16. Verify: Linear, double progression, percentage presets available -- corresponds to AC-7

## gstack Quality Gates

Based on Complexity 3 (Inverse), this feature is "Medium" tier.

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states

### Required if this feature contains business logic:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for overload engine

### Post-merge:
- [ ] `/parity-check` -- verify standalone parity

## Handoff State

### Before This Work
Workouts module tracks set weights and 1RM history but provides no suggestions for progressive overload. Users must manually decide weight increases.

### After This Work
- Overload rules table with global default and per-exercise overrides
- Pure-function overload engine evaluating trigger conditions and calculating suggestions
- Inline suggestion badges during active sessions
- Preset rule templates (linear, double progression, percentage)
- Settings UI for rule configuration

### Files Changed
- `modules/workouts/src/overload/engine.ts` -- New: overload evaluation engine
- `modules/workouts/src/overload/types.ts` -- New: rule types, suggestion types
- `modules/workouts/src/db/schema.ts` -- Extended: wk_overload_rules table
- `modules/workouts/src/db/crud.ts` -- Extended: overload rule CRUD, exercise history queries
- `modules/workouts/src/db/migrations.ts` -- Extended: migration v4
- `modules/workouts/src/definition.ts` -- Bump schemaVersion to 4, add overload-settings screen
- `modules/workouts/src/index.ts` -- Export overload functions and types
- `apps/mobile/app/(workouts)/session.tsx` -- Suggestion badges on set rows
- `apps/mobile/app/(workouts)/overload-settings.tsx` -- Rule configuration screen

### Known Limitations
- No machine learning or AI-driven suggestions (rule-based only)
- No deload detection or deload week automation
- No periodization awareness (doesn't know about mesocycles)
- No RPE-based progression (only rep/weight targets)
- No suggestion acceptance tracking for analytics

### Context for Next Agent
- The overload engine must be a pure function: `evaluateOverload(rule, performanceHistory) => Suggestion | null`. Keep it testable with no DB dependencies.
- `wk_workout_set_weights` is the primary data source. It has `session_id`, `exercise_id`, `set_number`, `weight`, `reps`, `unit`, `estimated_1rm`.
- The trigger `all_sets_hit` means: for the last `min_sessions` sessions, every set for this exercise achieved `>= target_reps` at the same or higher weight as the current working weight.
- "Current working weight" is the weight from the most recent session's set 1 for that exercise.
- When `rule_type` is `percentage`, `increment_value` is a percentage (e.g., 2.5 means +2.5%). Apply to the current working weight.
- All DB functions take `db: DatabaseAdapter` as the first parameter.
- If multiple features share migration v4, coordinate table creation in a single migration.
