# Feature Spec: CBT Exercises

## Metadata
- **Module:** health
- **Priority Score:** 34 / 50 (A-Tier)
- **Scoring Breakdown:** Market 5 x3 + Switching 2 x3 + Complexity 3 x2 + CrossModule 4 x1 + PaidUser 3 x1
- **Sprint:** 5
- **Estimated CC Time:** 3-4 hours
- **Depends On:** none
- **Blocks:** none

## Business Context

### Why This Feature Exists
Cognitive Behavioral Therapy (CBT) exercises are evidence-based tools for managing anxiety, depression, and negative thought patterns. Bearable and CareClinic both offer CBT-style exercises as part of their therapy toolkits. MyHealth can differentiate by integrating CBT outputs with mood tracking (already robust in the meds module's mood system) to show measurable improvement over time. This connects health, mood, and journal modules (CrossModule 4/5).

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Bearable | Yes | Yes ($34.99/yr) | Guided CBT worksheets, factor correlation |
| CareClinic | Yes | Yes ($9.99/mo) | CBT as part of therapy plans, caregiver visibility |
| Woebot | Yes | Free (limited) | AI-guided CBT conversations |
| MoodKit | Yes | $4.99 one-time | 200+ CBT activities, thought journal |

### Target User
Users experiencing anxiety, stress, or negative thought patterns who want structured self-help tools within their health hub. Users already tracking mood in MyLife who want actionable exercises when their mood is low, not just a log of how they feel.

## Technical Context

### Where This Lives in MyLife

```
modules/health/src/cbt/exercises.ts         -- Exercise definitions (static data)
modules/health/src/cbt/types.ts             -- CBT exercise and journal types
modules/health/src/cbt/crud.ts              -- Completed exercise persistence
modules/health/src/db/schema.ts             -- New hl_cbt_entries table
modules/health/src/index.ts                 -- Export CBT functions
apps/mobile/app/(health)/cbt.tsx            -- CBT exercise list screen
apps/mobile/app/(health)/cbt-exercise.tsx   -- Single exercise screen
```

### Wireframe Position

```
Hub Dashboard
  └── MyHealth card
       └── Insights tab
            └── CBT Exercises ← YOU ARE HERE
                 ├── Exercise categories
                 ├── Guided prompts
                 └── Completed journal entries
```

### Data Model

```sql
CREATE TABLE IF NOT EXISTS hl_cbt_entries (
  id TEXT PRIMARY KEY,
  exercise_type TEXT NOT NULL,          -- 'thought_record' | 'behavioral_activation' | 'cognitive_restructuring' | 'gratitude' | 'worry_time' | 'values_clarification'
  prompt TEXT NOT NULL,                 -- The exercise prompt/question
  response TEXT NOT NULL,               -- User's written response
  mood_before INTEGER,                  -- 1-10
  mood_after INTEGER,                   -- 1-10
  tags TEXT,                            -- JSON array of user tags
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS hl_cbt_type_idx ON hl_cbt_entries(exercise_type);
CREATE INDEX IF NOT EXISTS hl_cbt_date_idx ON hl_cbt_entries(created_at DESC);
```

### Dependencies
- **Internal:** `@mylife/db`, mood module (mood scoring for before/after), journal module (related concept)
- **External:** None
- **Cross-Module:** Mood before/after links to mood tracking. Completed exercises feed wellness timeline. Journal module could reference CBT entries. Readiness score could factor in mental health inputs.

## Functional Requirements

### User Stories
1. As a user experiencing anxiety, I want guided CBT exercises so I can work through negative thoughts.
2. As a user, I want to track my mood before and after exercises to see if they help.
3. As a user, I want a journal of completed exercises so I can review my progress.
4. As a user, I want exercises suggested based on my mood state.

### Behavior Specification

**Exercise library:**
1. User navigates to Insights tab > CBT Exercises
2. Screen shows 6 exercise categories:
   - **Thought Record:** Identify and challenge negative automatic thoughts
   - **Behavioral Activation:** Plan pleasurable activities when feeling low
   - **Cognitive Restructuring:** Reframe distorted thinking patterns
   - **Gratitude Practice:** Focus on positive aspects of life
   - **Worry Time:** Scheduled worry with containment strategy
   - **Values Clarification:** Connect actions to personal values
3. Each category shows a brief description and estimated time (2-5 minutes)

**Completing an exercise:**
1. User taps a category
2. Optional: pre-exercise mood rating (1-10 slider)
3. System presents the exercise as a guided multi-step form:
   - Each exercise has 3-5 structured prompts
   - User writes free-text responses to each prompt
   - Example (Thought Record):
     a. "What situation triggered your negative thought?"
     b. "What automatic thought came up?"
     c. "What evidence supports this thought?"
     d. "What evidence contradicts it?"
     e. "What's a more balanced way to see this?"
4. User completes all prompts and taps "Done"
5. Optional: post-exercise mood rating (1-10 slider)
6. System saves entry to hl_cbt_entries
7. Shows mood delta if both ratings provided

**Exercise history:**
1. Below categories, a "History" section shows completed exercises
2. Each entry shows: date, exercise type, mood delta (if available)
3. Tapping an entry shows the full responses (private, read-only)
4. Stats: total exercises completed, average mood improvement, most-used category

**Mood-triggered suggestions:**
1. When user logs a low mood (1-4) in mood check-in, system suggests: "Would you like to try a CBT exercise?"
2. Suggestion links to the most relevant exercise for the mood context

### Edge Cases

- **Very long responses:** No character limit. Scroll for long text.
- **Empty response:** Require at least one non-empty prompt response to save.
- **Mood skipped:** Save with null mood_before/mood_after.
- **User navigates away mid-exercise:** Show "Discard this exercise?" confirmation.
- **Module disabled:** Data preserved. Re-enabling shows history.
- **No exercises completed:** History shows empty state with encouragement.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** 6 CBT exercise categories are displayed with descriptions and time estimates
- [ ] **AC-2:** Tapping a category opens a guided multi-step form with prompts
- [ ] **AC-3:** Pre/post mood rating is offered (optional, skippable)
- [ ] **AC-4:** Mood delta is shown after completing an exercise with both ratings
- [ ] **AC-5:** Completed exercises appear in history with date and type
- [ ] **AC-6:** Tapping a history entry shows the full prompts and responses
- [ ] **AC-7:** Stats section shows total exercises, avg improvement, favorite category
- [ ] **AC-8:** Low mood check-in triggers CBT exercise suggestion

### Technical Criteria
- [ ] **TC-1:** hl_cbt_entries table created by migration
- [ ] **TC-2:** All 6 exercise types have defined prompt sequences (3-5 prompts each)
- [ ] **TC-3:** CRUD operations (create, get by type, get all, get stats) work correctly
- [ ] **TC-4:** Mood delta calculation handles nulls correctly
- [ ] **TC-5:** Responses are stored as user entered (no modification or summarization)

### Negative Criteria
- [ ] **NC-1:** CBT exercises must NOT claim to replace professional therapy
- [ ] **NC-2:** Exercise responses must NOT be shared or exported without explicit user action
- [ ] **NC-3:** Must NOT require network access

## UI Specification

### Mobile (Expo)
- **Category cards:** Glass cards with exercise icon, name, description, "~3 min" badge. Accent `#10B981`.
- **Exercise screen:** Multi-step form. Step indicator at top. Large text area for each prompt. "Next" / "Back" navigation. Dark background `#0A0A0F`.
- **History entries:** Glass cards with exercise type badge, date, mood delta indicator.
- **Mood slider:** Horizontal 1-10 with color gradient (red to green).

### Web (Next.js)
- `/health/cbt` for exercise list. `/health/cbt/[exercise-type]` for guided form.
- Same design tokens. Wider text areas on desktop.

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Library | 6 exercise category cards | Initial navigation |
| In-progress | Multi-step form with prompts | Exercise started |
| Complete | Mood delta + save confirmation | All prompts answered |
| History empty | "No exercises yet" with encouragement | No completed exercises |
| History | Exercise list with mood deltas | Previous exercises exist |

## Test Requirements

### Unit Tests
- [ ] `getExercisePrompts`: returns correct prompts for each of 6 types
- [ ] `createCbtEntry`: stores response and mood correctly
- [ ] `createCbtEntry`: rejects all-empty responses
- [ ] `getCbtEntries`: returns in reverse chronological order
- [ ] `getCbtStats`: correct total, avg improvement, most-used type
- [ ] `calculateMoodDelta`: 7 - 4 = +3
- [ ] `calculateMoodDelta`: null when either rating missing

### Integration Tests
- [ ] Full flow: select exercise -> complete prompts -> save -> appears in history
- [ ] Mood integration: log low mood -> CBT suggestion appears -> complete exercise -> mood improves

### QA Verification Script

1. Navigate to MyHealth > Insights > CBT Exercises
2. Verify: 6 exercise categories visible -- corresponds to AC-1
3. Tap "Thought Record"
4. Verify: Guided prompts appear step-by-step -- corresponds to AC-2
5. Rate pre-mood as 3
6. Complete all prompts with responses
7. Rate post-mood as 6
8. Verify: "+3 improvement" shown -- corresponds to AC-4
9. Return to CBT list
10. Verify: Completed exercise in history -- corresponds to AC-5
11. Tap the history entry
12. Verify: Full prompts and responses shown -- corresponds to AC-6
13. Check stats section
14. Verify: "1 exercise, +3 avg improvement" shown -- corresponds to AC-7

## gstack Quality Gates

Based on Complexity 3 (Inverse), this feature is "Medium" tier.

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states

### Post-merge:
- [ ] `/parity-check` -- skip (no standalone)

## Handoff State

### Before This Work
Health module has mood tracking (from absorbed meds module) but no structured therapeutic exercises.

### After This Work
- 6 CBT exercise types with guided multi-step prompts
- Exercise completion with mood before/after tracking
- Exercise history with full response review
- Stats tracking (total, avg improvement, favorites)
- Mood-triggered exercise suggestions

### Files Changed
- `modules/health/src/cbt/exercises.ts` -- Exercise definitions
- `modules/health/src/cbt/types.ts` -- Types
- `modules/health/src/cbt/crud.ts` -- CRUD
- `modules/health/src/db/schema.ts` -- hl_cbt_entries table
- `modules/health/src/definition.ts` -- Migration bump
- `modules/health/src/index.ts` -- Exports
- `apps/mobile/app/(health)/cbt.tsx` -- Exercise list
- `apps/mobile/app/(health)/cbt-exercise.tsx` -- Exercise form

### Known Limitations
- No AI-powered conversation (static prompts only)
- No therapist/caregiver sharing
- No scheduled exercise reminders
- Exercises are English-only (no i18n yet)

### Context for Next Agent
- The 6 exercise types are static data, not database-driven. Define them as a constant array in exercises.ts.
- Each exercise type has a fixed set of 3-5 prompts. These should not be randomized or AI-generated.
- The mood before/after system should use the same 1-10 scale as the mood module for consistency.
- Include a disclaimer on the exercise list: "These exercises are for self-help and do not replace professional therapy."
