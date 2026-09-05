# Feature Spec: Custom Experiments

## Metadata
- **Module:** mood
- **Priority Score:** 35 / 50 (A-Tier)
- **Scoring Breakdown:** Market [3] x3 + Switching [4] x3 + Complexity [3] x2 + CrossModule [4] x1 + PaidUser [4] x1
- **Sprint:** 5
- **Estimated CC Time:** 4-5 hours
- **Depends On:** Existing Pearson correlation engine (engine/streak.ts), mood entry CRUD
- **Blocks:** none

## Business Context

### Why This Feature Exists
Mood tracking apps collect data but rarely help users act on it. Custom experiments transform passive mood logging into an evidence-based self-improvement tool by letting users run structured A/B lifestyle tests ("Does daily meditation improve my mood?"). This is the highest-scored Mood feature (35/50) and the key differentiator identified in competitive analysis. Bearable ($34.99/yr) is the only competitor offering this capability, making it a genuine feature moat. The cross-module score (4/5) reflects that experiments can correlate mood with activities tracked across other MyLife modules (workouts, fasting, sleep).

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Bearable | Yes | Yes ($34.99/yr) | Multi-factor correlation with custom experiment tracking, symptom-to-factor analysis |
| Daylio | No | N/A | Has activity correlations but no structured experiment framework |
| Reflectly | No | N/A | AI prompts only, no hypothesis testing or baseline/intervention comparison |
| Calm | No | N/A | Meditation-focused, no data-driven self-experimentation |

### Target User
Data-driven self-trackers (25-45) who want to optimize their lifestyle with evidence rather than guesswork. Users of Bearable ($34.99/yr) who want the experiment capability without a separate subscription. Also therapy-supported users whose therapists ask them to test behavioral interventions between sessions and bring data to appointments.

## Technical Context

### Where This Lives in MyLife

```
modules/mood/src/
  types.ts                                  -- New schemas: Experiment, ExperimentTemplate, ExperimentStatus
  db/schema.ts                              -- New tables: mo_experiments, mo_experiment_templates + indexes
  db/crud.ts                                -- New CRUD: experiment create/read/update/abandon, template queries
  engines/experiment-engine.ts              -- NEW: lifecycle state machine, results analysis, conclusion generation
  definition.ts                             -- Migration v2 for new tables
  __tests__/experiment-engine.test.ts       -- NEW: unit tests for experiment engine

apps/mobile/app/(mood)/
  experiments.tsx                           -- NEW: Experiments home screen
  experiment-designer.tsx                   -- NEW: Multi-step experiment creation wizard
  experiment-results.tsx                    -- NEW: Results comparison screen

apps/web/app/mood/
  experiments/page.tsx                      -- NEW: Experiments web page
```

### Wireframe Position

```
Hub Dashboard
  └── MyMood card
       └── Insights tab
            └── "Experiments" section ← YOU ARE HERE
                 ├── Active experiment card (if running)
                 ├── "Start New Experiment" button
                 ├── Template carousel
                 └── Past experiments list
```

The Experiments view is accessible from:
1. The Insights tab in MyMood (primary entry point, as a section or sub-tab)
2. A "Run an Experiment" CTA on the correlation insights screen
3. Push notification tap during an active experiment ("Time to log! Day 5 of your experiment")

### Data Model

```sql
-- New table: mo_experiments (Migration v2)
CREATE TABLE IF NOT EXISTS mo_experiments (
    id TEXT PRIMARY KEY,
    hypothesis TEXT NOT NULL,
    intervention_description TEXT NOT NULL,
    period_days INTEGER NOT NULL DEFAULT 14,
    baseline_start TEXT NOT NULL,
    baseline_end TEXT NOT NULL,
    intervention_start TEXT NOT NULL,
    intervention_end TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    template_id TEXT,
    baseline_avg REAL,
    intervention_avg REAL,
    baseline_entry_count INTEGER,
    intervention_entry_count INTEGER,
    score_diff REAL,
    percent_change REAL,
    pearson_r REAL,
    is_significant INTEGER,
    conclusion TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT
);

-- New table: mo_experiment_templates (Migration v2, seeded with 10 templates)
CREATE TABLE IF NOT EXISTS mo_experiment_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    hypothesis TEXT NOT NULL,
    intervention_description TEXT NOT NULL,
    suggested_days INTEGER NOT NULL DEFAULT 14,
    category TEXT NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS mo_experiments_status_idx
    ON mo_experiments(status);
CREATE INDEX IF NOT EXISTS mo_experiments_baseline_start_idx
    ON mo_experiments(baseline_start DESC);
CREATE INDEX IF NOT EXISTS mo_templates_category_idx
    ON mo_experiment_templates(category);
```

**status enum values:** `draft`, `baseline`, `intervention`, `analyzing`, `completed`, `abandoned`

**template category enum values:** `exercise`, `sleep`, `mindfulness`, `social`, `nutrition`, `digital`

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter), `@mylife/ui` (Cool Obsidian tokens), existing `pearsonCorrelation` and `isSignificantCorrelation` from `engine/streak.ts`
- **External:** `expo-notifications` (experiment phase transition reminders), `zod` (validation). No external APIs or cloud services.
- **Cross-Module:** None in MVP. Future integration: correlate experiment periods with Workouts frequency, Fast completion rate, or Journal entries. The experiment engine is designed so that cross-module data sources can be plugged in later.

## Functional Requirements

### User Stories
1. As a wellness optimizer, I want to create a personal experiment to test whether a lifestyle change improves my mood, so that I can make evidence-based decisions about my habits.
2. As a data-driven user, I want to see the results of my experiment compared to a baseline period with statistical analysis, so I can determine if the intervention had a meaningful effect.
3. As a curious self-tracker, I want to browse a library of experiment templates, so I can start experiments without designing them from scratch.
4. As a user mid-experiment, I want daily reminders to log my mood during both baseline and intervention, so I collect enough data for reliable results.
5. As a returning user, I want to see my past experiments and their outcomes, so I can build a personal evidence base over time.

### Behavior Specification

**Starting from a template:**
1. User navigates to MyMood > Insights > Experiments.
2. User browses the template carousel (10 templates across 6 categories).
3. User taps a template (e.g., "Morning Exercise").
4. Experiment Designer opens pre-filled with the template's hypothesis, intervention description, and suggested period.
5. User can edit any field or accept as-is.
6. User selects a start date (today or future).
7. User reviews the summary: hypothesis, intervention, baseline dates, intervention dates.
8. User taps "Start Experiment".
9. Experiment is created with status `draft`, then immediately transitions to `baseline` if start date is today.

**Starting from scratch:**
1. User taps "Start New Experiment" (or "Design Your Own").
2. Experiment Designer opens with empty fields.
3. Step 1 -- Hypothesis: text field "I believe that..." + text field describing expected outcome.
4. Step 2 -- Intervention: text field "What will you do differently?", duration picker (7/14/21/30 days per period), start date picker.
5. Step 3 -- Review: summary of all fields with "Start" button.
6. Experiment is saved and transitions to `baseline` if start date is today.

**Experiment lifecycle (automatic transitions):**
1. On every app open, the experiment engine checks the active experiment's status against today's date.
2. If status = `baseline` AND today > baseline_end: transition to `intervention`. Schedule a notification: "Baseline complete! Start your intervention: [intervention_description]."
3. If status = `intervention` AND today > intervention_end: transition to `analyzing`. Run the results analysis immediately.
4. After analysis completes: transition to `completed`. Schedule a notification: "Your experiment results are ready!"

**Viewing results:**
1. User navigates to the completed experiment (via notification tap or Past Experiments list).
2. Results screen shows:
   - Hypothesis statement
   - Two-column comparison: Baseline avg vs Intervention avg, entry count for each
   - Score difference and percentage change (e.g., "+1.3 points, 22% improvement")
   - Pearson r value with strength label (weak/moderate/strong)
   - Line chart: daily scores with baseline period shaded in module accent, intervention shaded in green
   - Plain-language conclusion (auto-generated)
3. Action buttons: "Archive" (moves to past list), "Run Again" (creates new experiment from same parameters).

**Abandoning an experiment:**
1. User taps "..." menu on active experiment card > "Abandon Experiment".
2. Confirmation dialog: "Abandon this experiment? Any data collected so far will be preserved."
3. If confirmed: status set to `abandoned`, partial data preserved. No analysis runs.

**Concurrent experiment guard:**
1. If user tries to start a new experiment while one is active (status = baseline or intervention):
2. Warning dialog: "You already have an active experiment. Starting a new one will abandon it. Continue?"
3. If confirmed: active experiment set to `abandoned`, new one created.

### Edge Cases

- **No mood entries exist:** Experiments home shows CTA "Log your mood for a few days first to build baseline data." Allow experiment creation anyway (user might plan ahead).
- **Zero entries during baseline period:** Analysis shows "No baseline data logged. Experiment cannot be analyzed." Offer to extend baseline by re-running.
- **Zero entries during intervention period:** Analysis shows "No intervention data logged." Same handling.
- **Very few entries (< 5 total):** Analysis runs but flags results as "Preliminary -- limited data. Log more consistently for reliable results."
- **User opens app days after a period boundary:** Engine catches up, transitions through missed states. If both baseline and intervention are elapsed, transitions directly to analyzing.
- **Experiment with future start date:** Stays in `draft` until start date arrives. On app open that day, transitions to `baseline`.
- **Same-day start and very short period (7 days):** Valid. Experiment starts immediately.
- **User deletes mood entries during an active experiment:** Analysis uses whatever entries remain. No special handling.
- **Module disabled mid-experiment:** Experiment pauses (no transitions). Re-enabling resumes from current date context. If the entire experiment period elapsed while disabled, transitions to analyzing.
- **Multiple entries per day:** All entries counted and averaged for that day.
- **Period days not matching a calendar boundary:** baseline_end = baseline_start + period_days - 1. Intervention_start = baseline_end + 1.
- **hypothesis or intervention_description empty:** Rejected by Zod validation (min 1 char each, max 500).

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Tapping a template pre-fills the Experiment Designer with the template's hypothesis, intervention description, and suggested period.
- [ ] **AC-2:** The Experiment Designer wizard has 3 steps (Hypothesis, Intervention, Review) and validates required fields before advancing.
- [ ] **AC-3:** Starting an experiment with today's start date immediately shows an active experiment card on the Experiments screen with phase "Baseline (Day 1 of N)".
- [ ] **AC-4:** The active experiment card updates daily: "Baseline (Day 4 of 14)" with a progress bar.
- [ ] **AC-5:** When the baseline period ends and the user opens the app, the experiment transitions to intervention with a notification.
- [ ] **AC-6:** When the intervention period ends, results are automatically computed and a "Results Ready!" banner appears.
- [ ] **AC-7:** The results screen shows baseline vs intervention averages, score difference, percentage change, Pearson r, and a plain-language conclusion.
- [ ] **AC-8:** A line chart shows daily mood scores with baseline and intervention periods visually distinguished.
- [ ] **AC-9:** Past experiments appear in a scrollable list with status badges (Completed/Abandoned) and summary stats.
- [ ] **AC-10:** Abandoning an experiment preserves partial data and shows status "Abandoned" in the past experiments list.
- [ ] **AC-11:** Attempting to start a second experiment while one is active shows a warning dialog.
- [ ] **AC-12:** "Run Again" on a completed experiment creates a new experiment with the same hypothesis and intervention, new dates.
- [ ] **AC-13:** The template carousel shows 10 templates across 6 categories with horizontal scrolling.

### Technical Criteria
- [ ] **TC-1:** Schema migration v2 creates mo_experiments and mo_experiment_templates tables with all columns and indexes.
- [ ] **TC-2:** 10 experiment templates are seeded on migration (Morning Exercise, Daily Meditation, 8 Hours Sleep, Social Lunch, No Phone Before Bed, 3x Weekly Workout, Daily Journaling, Caffeine Cutoff, Nature Walk, Gratitude Practice).
- [ ] **TC-3:** `transitionExperiment()` correctly transitions draft -> baseline when today >= baseline_start.
- [ ] **TC-4:** `transitionExperiment()` correctly transitions baseline -> intervention when today > baseline_end.
- [ ] **TC-5:** `transitionExperiment()` correctly transitions intervention -> analyzing when today > intervention_end.
- [ ] **TC-6:** `analyzeExperiment()` computes baseline_avg, intervention_avg, score_diff, percent_change, and pearson_r from mood entries within the experiment date ranges.
- [ ] **TC-7:** `analyzeExperiment()` uses the existing `pearsonCorrelation()` function from engine/streak.ts.
- [ ] **TC-8:** `generateConclusion()` returns a positive conclusion when significant AND r > 0, negative when significant AND r < 0, and neutral when not significant.
- [ ] **TC-9:** `isSignificantExperiment()` requires |r| >= 0.3 AND total entries >= 20.
- [ ] **TC-10:** Only one experiment with status `baseline` or `intervention` can exist. Starting a new one abandons the active one.
- [ ] **TC-11:** Zod validation rejects empty hypothesis or intervention_description.
- [ ] **TC-12:** Zod validation rejects period_days not in [7, 14, 21, 30].
- [ ] **TC-13:** Zod validation rejects baseline_start in the past.
- [ ] **TC-14:** Experiment CRUD operations (create, read, update status, abandon) persist correctly in SQLite.
- [ ] **TC-15:** Date ranges compute correctly: baseline_end = baseline_start + period_days - 1, intervention_start = baseline_end + 1, intervention_end = intervention_start + period_days - 1.

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Experiment analysis must NOT make network calls. All computation is on-device using existing Pearson correlation logic.
- [ ] **NC-2:** Abandoning an experiment must NOT delete the record or any associated mood entries.
- [ ] **NC-3:** Experiment creation must NOT modify existing mood entries or activities.
- [ ] **NC-4:** Automatic phase transitions must NOT occur for experiments in `draft`, `completed`, or `abandoned` status.
- [ ] **NC-5:** Template seed data must NOT be modifiable by the user. Templates are read-only reference data.

## UI Specification

### Mobile (Expo)

**Experiments Home Screen:**
- Background: `#0A0A0F` (background token)
- Active experiment card: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border
  - Module accent progress bar: `#FB923C`
  - Phase label: textSecondary color, "Baseline (Day 4 of 14)"
  - Hypothesis text truncated to 2 lines
- Template carousel: horizontal scroll, glass cards with category icon + template name
- Past experiments: list of glass cards with status badge (green "Completed" or gray "Abandoned") + summary line
- "Start New Experiment" button: accent color outline, glass background
- Empty state: Centered beaker icon, "Run your first experiment" text, template suggestions below

**Experiment Designer (3-step wizard):**
- Step indicator dots at top (3 dots, accent color for active)
- Step 1: "I believe that..." text area (multiline, max 500 chars), "...will improve my mood" label
- Step 2: "What will you do differently?" text area, period duration segmented control (7/14/21/30 days), start date picker
- Step 3: Review card showing all fields, total experiment timeline visualization
- "Start Experiment" button: full-width, accent color, bottom of screen

**Results Screen:**
- Hypothesis at top in large text
- Two glass cards side by side: "Baseline" (left, module accent) and "Intervention" (right, `#30D158` green)
  - Average score (large number), entry count, score range
- Difference pill: "+1.3 pts (22%)" in green or red based on direction
- Pearson r with strength badge: "r = 0.45 (Moderate)"
- Line chart: accent color for baseline dots, green for intervention dots, shaded regions
- Conclusion text block in glass card
- "Run Again" and "Archive" buttons at bottom

### Web (Next.js)

- Same tokens via CSS variables
- Accessible at `/mood/experiments` route
- Layout: sidebar navigation, main content area
- Experiment designer as a multi-step form (same 3 steps, not modal)
- Results comparison uses wider two-column layout
- Past experiments in a table format with sortable columns
- Line chart rendered with same data, wider aspect ratio

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton cards with pulsing animation | Initial data fetch |
| Empty (no experiments) | "Run your first experiment" + template carousel | No experiments in mo_experiments |
| Active (baseline) | Active card with baseline progress bar + day counter | Experiment in baseline phase |
| Active (intervention) | Active card with intervention progress bar + phase label | Experiment in intervention phase |
| Analysis Ready | "Results Ready!" banner with accent-colored View button | Experiment just completed analysis |
| Results | Full comparison view with charts and conclusion | User views completed experiment |
| Error | "Something went wrong" + retry button | SQLite read/write failure |

## Test Requirements

### Unit Tests (modules/mood/src/__tests__/experiment-engine.test.ts)
- [ ] `transitionExperiment`: draft -> baseline when today = baseline_start
- [ ] `transitionExperiment`: stays draft when today < baseline_start
- [ ] `transitionExperiment`: baseline -> intervention when today > baseline_end
- [ ] `transitionExperiment`: intervention -> analyzing when today > intervention_end
- [ ] `transitionExperiment`: no transition for completed or abandoned status
- [ ] `transitionExperiment`: catches up through multiple transitions if app was closed for days
- [ ] `analyzeExperiment`: computes correct baseline_avg from entries in date range
- [ ] `analyzeExperiment`: computes correct intervention_avg from entries in date range
- [ ] `analyzeExperiment`: computes score_diff = intervention_avg - baseline_avg
- [ ] `analyzeExperiment`: computes percent_change = (score_diff / baseline_avg) * 100
- [ ] `analyzeExperiment`: calls pearsonCorrelation with (period=0 for baseline, 1 for intervention) x scores
- [ ] `analyzeExperiment`: handles zero baseline entries gracefully (returns null results with error message)
- [ ] `analyzeExperiment`: handles zero intervention entries gracefully
- [ ] `generateConclusion`: positive conclusion when significant AND r > 0
- [ ] `generateConclusion`: negative conclusion when significant AND r < 0
- [ ] `generateConclusion`: neutral conclusion when not significant
- [ ] `generateConclusion`: includes hypothesis text in output
- [ ] `computeDateRanges`: baseline_end = baseline_start + period_days - 1
- [ ] `computeDateRanges`: intervention_start = baseline_end + 1
- [ ] `computeDateRanges`: intervention_end = intervention_start + period_days - 1
- [ ] Zod validation: rejects empty hypothesis
- [ ] Zod validation: rejects period_days = 5 (not in [7,14,21,30])
- [ ] Zod validation: rejects baseline_start in the past
- [ ] Seed templates: exactly 10 templates with correct categories

### Integration Tests
- [ ] Full lifecycle: create experiment from template, transition through all phases, verify results computed
- [ ] Abandon flow: start experiment, abandon, verify status = abandoned, data preserved
- [ ] Concurrent guard: create active experiment, try to start another, verify warning and abandon of first
- [ ] Date range query: create experiment, log entries during baseline/intervention, verify analyzeExperiment picks up correct entries by date range
- [ ] Error flow: create experiment with invalid period_days, verify Zod rejection

### QA Verification Script

1. Open the app on iOS/Android simulator.
2. Navigate to MyMood > Insights > Experiments. Verify empty state with "Run your first experiment" and template carousel. -- Verifies empty state.
3. Browse template carousel. Verify 10 templates visible with category labels. -- Corresponds to AC-13.
4. Tap "Morning Exercise" template. Verify Designer pre-fills hypothesis ("Exercising in the morning improves my mood throughout the day") and period (14 days). -- Corresponds to AC-1.
5. Set start date to today. Tap through Review step. Tap "Start Experiment". -- Corresponds to AC-3.
6. Verify active experiment card appears: "Baseline (Day 1 of 14)" with progress bar at ~7%. -- Corresponds to AC-3, AC-4.
7. Log 3 mood entries today (scores 5, 6, 7). Navigate back to Experiments. Verify card still shows Day 1. -- Verifies entries don't affect phase.
8. Manually edit the experiment's baseline_start to 15 days ago (via database or test hook).
9. Re-open MyMood. Verify experiment transitions to intervention phase with updated card: "Intervention (Day 1 of 14)". -- Corresponds to AC-5, TC-4.
10. Manually edit intervention_start to 15 days ago.
11. Re-open MyMood. Verify experiment transitions to analyzing and then completed with "Results Ready!" banner. -- Corresponds to AC-6, TC-5.
12. Tap "View Results". Verify results screen shows baseline avg, intervention avg, score difference, Pearson r, and conclusion text. -- Corresponds to AC-7.
13. Verify line chart is visible with two visually distinct periods. -- Corresponds to AC-8.
14. Tap "Archive". Verify experiment moves to Past Experiments list with "Completed" badge. -- Corresponds to AC-9.
15. Tap "Start New Experiment". Fill in custom hypothesis "Daily journaling", intervention "Write for 15 min each morning", period 7 days, start today. Start experiment. -- Corresponds to AC-2.
16. Verify new active experiment card appears. -- Confirms custom experiment creation.
17. Tap "..." > "Abandon Experiment". Confirm. Verify experiment shows "Abandoned" in past list with partial data. -- Corresponds to AC-10.
18. Start another experiment. While one exists (if it wasn't abandoned), verify warning dialog. -- Corresponds to AC-11.
19. View a completed experiment. Tap "Run Again". Verify new experiment created with same hypothesis/intervention but new dates. -- Corresponds to AC-12.
20. Repeat key steps (2-7, 15-17) on web at `/mood/experiments`. Verify functional parity. -- Web parity check.

## gstack Quality Gates

Based on this feature's Complexity Inverse score of 3 (Medium):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI (check all that apply):
- [ ] `/browse` -- navigate to `/mood/experiments`, click every button, verify all states (empty, active-baseline, active-intervention, results-ready, results, error)
- [ ] Batch QA: after 5 features in mood module, run `/qa` on the module URL

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for `experiment-engine.ts` (transitionExperiment, analyzeExperiment, generateConclusion, computeDateRanges)

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Mood module has 6 tables: mo_entries, mo_activities, mo_emotion_tags, mo_entry_activities, mo_breathing_sessions, mo_settings
- Schema version 1, migration v1 only
- Pearson correlation engine exists in engine/streak.ts (pearsonCorrelation, isSignificantCorrelation)
- No experiment framework, no A/B test capability, no template system

### After This Work
- Mood module has 8 tables (new: mo_experiments, mo_experiment_templates) with 3 new indexes
- Schema version 2, migration v2 added with 10 seed templates
- Full experiment lifecycle: design (from template or scratch), baseline data collection, intervention, automated analysis with Pearson correlation, plain-language conclusion
- `experiment-engine.ts` contains pure functions for state transitions, date range computation, results analysis, and conclusion generation
- Mobile: phase transition notifications via expo-notifications
- Web: in-app experiment management at /mood/experiments

### Files Changed

- `modules/mood/src/types.ts` -- Add ExperimentSchema, ExperimentStatusSchema, ExperimentTemplateSchema, ExperimentCategorySchema, CreateExperimentInputSchema Zod schemas and types
- `modules/mood/src/db/schema.ts` -- Add CREATE_EXPERIMENTS, CREATE_EXPERIMENT_TEMPLATES tables, 3 indexes, template seed SQL
- `modules/mood/src/db/crud.ts` -- Add experiment CRUD: createExperiment, getExperiment, getActiveExperiment, getExperiments, updateExperimentStatus, abandonExperiment, getTemplates, getTemplatesByCategory
- `modules/mood/src/engines/experiment-engine.ts` -- NEW: transitionExperiment, analyzeExperiment, generateConclusion, computeDateRanges, isSignificantExperiment
- `modules/mood/src/definition.ts` -- Add MOOD_MIGRATION_V2, update schemaVersion to 2
- `modules/mood/src/index.ts` -- Re-export new types and engine functions
- `modules/mood/src/__tests__/experiment-engine.test.ts` -- NEW: 24+ unit tests
- `apps/mobile/app/(mood)/experiments.tsx` -- NEW: Experiments home screen
- `apps/mobile/app/(mood)/experiment-designer.tsx` -- NEW: 3-step wizard
- `apps/mobile/app/(mood)/experiment-results.tsx` -- NEW: Results comparison screen
- `apps/web/app/mood/experiments/page.tsx` -- NEW: Experiments web page

### Known Limitations
- Only one active experiment at a time (prevents confounding variables but limits power users)
- No cross-module data integration in MVP (cannot correlate experiment with Workouts frequency or Fast streaks yet)
- Templates are static seed data, not user-creatable or shareable
- Statistical analysis is limited to Pearson r and difference-of-means (no t-test, no confidence intervals)
- No photo or media attachments on experiment notes
- Baseline start cannot be in the past (cannot retroactively use existing data as baseline)

### Context for Next Agent
- The experiment analysis reuses `pearsonCorrelation()` and `isSignificantCorrelation()` from `engine/streak.ts`. Import them directly; do not duplicate the implementation.
- Date ranges are inclusive on both ends: a 14-day period starting on March 1 runs through March 14 (baseline_end = baseline_start + 13 days, not +14).
- The `conclusion` field stores the auto-generated text. It is computed once during the analyzing -> completed transition and never recomputed. If the user deletes mood entries after completion, the conclusion becomes stale. This is acceptable.
- Template seed data should be inserted in the migration's `up` array as INSERT statements, not via a runtime seed function. This ensures templates exist even if the app never runs the seed function.
- The experiment status transitions should be checked on every app open. Use a hook (e.g., `useExperimentSync`) that calls `transitionExperiment()` with today's date. Keep the engine function pure (accepts a date parameter, returns the new status).
