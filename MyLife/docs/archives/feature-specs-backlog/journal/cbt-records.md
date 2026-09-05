# Feature Spec: CBT Thought Records

## Metadata
- **Module:** journal
- **Priority Score:** 30 / 50 (A-Tier)
- **Scoring Breakdown:** Market 3 x3 + Switching 3 x3 + Complexity 3 x2 + CrossModule 3 x1 + PaidUser 3 x1
- **Sprint:** Sprint 5 (S+A Features)
- **Estimated CC Time:** 3-4 hours
- **Depends On:** JR-001 (Rich Text Editor -- implemented), JR-005 (Mood Tagging -- implemented, 5-level mood scale)
- **Blocks:** JR-023 (Therapy Prep Templates -- uses thought records for auto-population), JR-019 (Mood Analytics -- distortion frequency analysis)

## Business Context

### Why This Feature Exists
Cognitive Behavioral Therapy (CBT) is the most evidence-based psychotherapy method, and the thought record is its core self-help tool. Daylio ($35.99/yr, 20M users) and Stoic ($40/yr) both charge for CBT templates. These tools store users' most clinically sensitive data -- negative thoughts, emotional vulnerabilities, cognitive distortions -- on cloud servers accessible to the company. MyJournal can offer the same evidence-based CBT framework with the guarantee that thought records never leave the device. This transforms a clinical tool from a subscription-gated cloud product into a free, private, self-help resource.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Daylio | Yes | $35.99/yr | CBT-inspired mood + activity tracking. Cloud-synced. Basic thought records. |
| Stoic | Yes | $40/yr | Full CBT thought records with 15 cognitive distortions. Cloud-stored. Subscription. |
| Day One | No | N/A | No CBT tooling. Generic journaling only. |
| Woebot | Yes | Free (funded) | AI-guided CBT chatbot. Cloud-processed conversations. |

### Target User
People in CBT therapy who use thought records as homework, and self-directed mental health practitioners who want structured cognitive restructuring tools. These users currently use paper worksheets (lose them), generic note apps (no structure), or cloud-based therapy apps (privacy concern). MyJournal offers the clinically correct 6-step framework with zero data exposure.

## Technical Context

### Where This Lives in MyLife

```
modules/journal/src/cbt/                        -- NEW: CBT thought record engine
modules/journal/src/cbt/types.ts                -- ThoughtRecord, Emotion, Distortion, CbtStats types
modules/journal/src/cbt/distortions.ts          -- 15 cognitive distortion definitions
modules/journal/src/cbt/cbt-engine.ts           -- Thought record CRUD, analytics, emotional impact
modules/journal/src/cbt/index.ts                -- Barrel export
modules/journal/src/cbt/__tests__/              -- Tests
modules/journal/src/db/cbt.ts                   -- NEW: SQLite CRUD for CBT tables
apps/mobile/app/(journal)/cbt-wizard.tsx        -- Mobile 6-step wizard
apps/mobile/app/(journal)/cbt-review.tsx        -- Mobile thought record review
apps/web/app/journal/cbt/page.tsx               -- Web CBT wizard
apps/web/app/journal/cbt/[id]/page.tsx          -- Web thought record review
```

### Wireframe Position

```
Hub Dashboard
  └── MyJournal card
       └── Today tab / Entries tab
            └── Entry Editor
                 └── "Add Thought Record" button ← YOU ARE HERE
                      └── 6-Step Wizard
```

### Data Model

Three new tables in migration V3 (coordinate with voice/metadata/therapy):

```sql
CREATE TABLE IF NOT EXISTS jn_thought_records (
  id TEXT PRIMARY KEY NOT NULL,
  entry_id TEXT NOT NULL REFERENCES jn_entries(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'complete')),
  situation TEXT,
  situation_date TEXT,
  automatic_thought TEXT,
  thought_belief_before INTEGER CHECK (thought_belief_before >= 0 AND thought_belief_before <= 100),
  rational_response TEXT,
  evidence_for TEXT,
  evidence_against TEXT,
  thought_belief_after INTEGER CHECK (thought_belief_after >= 0 AND thought_belief_after <= 100),
  outcome_note TEXT,
  current_step INTEGER NOT NULL DEFAULT 1 CHECK (current_step >= 1 AND current_step <= 6),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS jn_thought_record_emotions (
  id TEXT PRIMARY KEY NOT NULL,
  thought_record_id TEXT NOT NULL REFERENCES jn_thought_records(id) ON DELETE CASCADE,
  emotion_name TEXT NOT NULL,
  intensity_before INTEGER NOT NULL DEFAULT 0 CHECK (intensity_before >= 0 AND intensity_before <= 100),
  intensity_after INTEGER CHECK (intensity_after >= 0 AND intensity_after <= 100)
);

CREATE TABLE IF NOT EXISTS jn_thought_record_distortions (
  id TEXT PRIMARY KEY NOT NULL,
  thought_record_id TEXT NOT NULL REFERENCES jn_thought_records(id) ON DELETE CASCADE,
  distortion_type TEXT NOT NULL
    CHECK (distortion_type IN (
      'all_or_nothing', 'overgeneralization', 'mental_filter',
      'disqualifying_positive', 'mind_reading', 'fortune_telling',
      'magnification', 'minimization', 'emotional_reasoning',
      'should_statements', 'labeling', 'personalization',
      'blame', 'always_being_right', 'fallacy_of_fairness'
    ))
);

-- Indexes
CREATE INDEX IF NOT EXISTS jn_thought_records_entry_idx ON jn_thought_records(entry_id);
CREATE INDEX IF NOT EXISTS jn_thought_records_status_idx ON jn_thought_records(status);
CREATE INDEX IF NOT EXISTS jn_thought_record_emotions_record_idx ON jn_thought_record_emotions(thought_record_id);
CREATE INDEX IF NOT EXISTS jn_thought_record_distortions_record_idx ON jn_thought_record_distortions(thought_record_id);
CREATE INDEX IF NOT EXISTS jn_thought_record_distortions_type_idx ON jn_thought_record_distortions(distortion_type);
```

### Dependencies
- **Internal:** `@mylife/db`, journal entry CRUD, mood types
- **External:** none (fully local)
- **Cross-Module:** Distortion frequency analysis feeds into mood analytics. Thought records are referenced by therapy templates for auto-population.

## Functional Requirements

### User Stories
1. As a therapy client, I want to create structured CBT thought records so that I can challenge my negative thinking patterns using the evidence-based 6-step framework.
2. As a reflective person, I want to identify which cognitive distortions I use most frequently so that I can work on specific thinking patterns.
3. As someone who feels overwhelmed, I want to compare my emotional intensity before and after completing a thought record so that I can see that the exercise actually helps.
4. As a journal user, I want thought records linked to my journal entries so that I can add context around the cognitive work.

### Behavior Specification

1. User opens an entry or creates a new one.
2. User taps "Add Thought Record" button (below the entry body or in a toolbar).
3. **6-Step Wizard** opens as a full-screen flow with step indicator (6 dots).

4. **Step 1: Situation**
   - Text area: "Describe the situation" (max 1000 chars)
   - Date/time auto-populated (editable)
   - "Next" advances. "Save & Close" saves as draft.

5. **Step 2: Automatic Thought**
   - Text area: "What went through your mind?" (max 1000 chars)
   - Belief rating slider: "How strongly do you believe this?" 0-100%
   - "Back" / "Next" navigation.

6. **Step 3: Emotions**
   - Grid of 30 emotion labels (tappable multi-select)
   - For each selected emotion: intensity slider 0-100%
   - "Add Custom Emotion" option

7. **Step 4: Cognitive Distortion**
   - Scrollable list of 15 distortions, each with name + one-line description + example
   - Multi-select (most thoughts involve multiple distortions)
   - "Learn More" expands a detailed explanation card per distortion

8. **Step 5: Rational Response**
   - Text area: "What is a more balanced way to think about this?" (max 2000 chars)
   - Optional "Evidence For" and "Evidence Against" sub-sections

9. **Step 6: Outcome**
   - Re-rate each emotion from Step 3 (intensity 0-100%)
   - Re-rate belief in automatic thought (0-100%)
   - Outcome note (max 500 chars)
   - Visual comparison: before/after intensity bars side by side

10. "Done" saves as complete. Thought record summary card appears in the linked entry.

### Edge Cases

- **User saves as draft at Step 3:** Record saved with steps 1-3 data, status = 'draft', current_step = 3. Can resume later.
- **User skips Step 4 (no distortion selected):** Validation requires at least 1 distortion. Cannot advance without selection.
- **User adds custom emotion:** Custom emotion text is stored as `emotion_name`. No predefined list constraint.
- **User re-opens completed thought record:** Opens in read-only review mode with before/after comparison.
- **Entry deleted:** Cascade deletes thought record, emotions, and distortions.
- **Multiple thought records per entry:** Allowed. User can add multiple records to one entry (e.g., multiple triggering situations in one day).
- **Very high initial intensity (100%):** Expected for acute distress. No validation cap beyond 0-100 range.
- **Belief rating unchanged after exercise:** Some thought records don't reduce belief intensity. That is valid and expected.
- **Distortion "Learn More" content:** Static educational text, not generated. Defined as constants.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** "Add Thought Record" button appears in the entry editor.
- [ ] **AC-2:** Wizard shows 6 steps with step indicator dots and Back/Next navigation.
- [ ] **AC-3:** Step 1 (Situation) shows text area and auto-populated date.
- [ ] **AC-4:** Step 2 (Automatic Thought) shows text area and belief slider 0-100%.
- [ ] **AC-5:** Step 3 (Emotions) shows grid of 30 emotions with multi-select and intensity sliders.
- [ ] **AC-6:** Step 4 (Cognitive Distortions) shows 15 distortions with names, descriptions, and "Learn More".
- [ ] **AC-7:** Step 5 (Rational Response) shows text area with optional evidence for/against sections.
- [ ] **AC-8:** Step 6 (Outcome) shows re-rating sliders for each emotion and belief, with before/after comparison.
- [ ] **AC-9:** "Save & Close" at any step saves as draft, resumable later.
- [ ] **AC-10:** Completed thought record shows a summary card in the linked entry.
- [ ] **AC-11:** Summary card shows: situation preview, primary emotion, distortions, before/after intensity bars.
- [ ] **AC-12:** Distortion frequency analysis shows most common distortions across all completed records.

### Technical Criteria
- [ ] **TC-1:** Migration V3 creates `jn_thought_records`, `jn_thought_record_emotions`, `jn_thought_record_distortions` tables with indexes.
- [ ] **TC-2:** Thought records are linked to entries via `entry_id` foreign key with CASCADE delete.
- [ ] **TC-3:** Draft records store `current_step` for wizard resumption.
- [ ] **TC-4:** Distortion types are validated against the 15 allowed values.
- [ ] **TC-5:** Emotional impact score = average(intensity_before - intensity_after) across all emotions.
- [ ] **TC-6:** Distortion frequency: `GROUP BY distortion_type` across completed records.
- [ ] **TC-7:** 15 distortion definitions stored as constants with name, description, and example text.

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** CBT thought record data must NEVER leave the device. This is clinically sensitive material.
- [ ] **NC-2:** Completing a thought record must NOT modify the parent entry's mood tag (thought record has its own emotion tracking).
- [ ] **NC-3:** Deleting a thought record must NOT delete the parent entry.
- [ ] **NC-4:** The wizard must NOT allow advancing past Step 4 without at least 1 distortion selected.

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Step indicator: 6 dots, current = `#A78BFA` (accent), completed = `rgba(167,139,250,0.5)`, upcoming = `rgba(255,255,255,0.2)`
- Step title: 20px semibold, `#F0F0F5`
- Instruction text: 14px, textSecondary
- Text areas: glass card, multiline, `#F0F0F5` text
- Belief/intensity sliders: track = `rgba(255,255,255,0.1)`, fill = `#A78BFA`, thumb = white circle
- Emotion grid: 5 columns, glass pill buttons, selected = `#A78BFA` fill, unselected = glass outline
- Distortion list: glass cards, selected = accent border + checkmark, "Learn More" = expandable accordion
- Before/after bars: red gradient (high) to green gradient (low), side-by-side comparison
- Summary card in entry: glass card, collapsible, situation preview + emotion + distortion chips + intensity comparison
- Module accent: `#A78BFA`

### Web (Next.js)

- Route: `/journal/cbt` (new wizard), `/journal/cbt/[id]` (review)
- Same 6-step wizard, wider layout for text areas
- Distortion list in 2-column grid on desktop

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Step 1-6 | Current step's form with Back/Next | Wizard in progress |
| Draft | "Draft thought record" badge on entry, "Resume" button | User tapped "Save & Close" |
| Complete | Summary card in entry, read-only review | User completed Step 6 |
| Resuming | Wizard opens at last completed step | User taps "Resume" on draft |
| Review | Read-only view of all 6 steps with comparisons | User taps completed thought record |
| First Use | Educational intro: "What is a CBT Thought Record?" with diagram | First time opening wizard |

## Test Requirements

### Unit Tests
- [ ] `createThoughtRecord`: creates record linked to entry with status 'draft'
- [ ] `addEmotions`: add 3 emotions with intensities -> 3 emotion rows created
- [ ] `addDistortions`: select 2 distortions -> 2 distortion rows created
- [ ] `validateDistortionType`: 'invalid_type' -> rejected
- [ ] `completeRecord`: set all fields + status 'complete' -> record finalized
- [ ] `saveDraftAtStep3`: current_step = 3, status = 'draft' -> resumable
- [ ] `resumeDraft`: open draft at step 3 -> wizard starts at step 3 with prior data
- [ ] `emotionalImpactScore`: before [80, 60], after [40, 20] -> avg reduction = 40
- [ ] `distortionFrequency`: 5 records with 'all_or_nothing' 3 times, 'labeling' 2 times -> ranked
- [ ] `beliefReduction`: belief_before 90, belief_after 40 -> 50% reduction
- [ ] `multipleRecordsPerEntry`: 2 records on same entry -> both accessible
- [ ] `cascadeDelete`: delete entry -> all thought records, emotions, distortions deleted
- [ ] `customEmotion`: add "overwhelmed" (not in predefined list) -> stored as emotion_name

### Integration Tests
- [ ] Full flow: create entry -> add thought record -> complete all 6 steps -> verify summary in entry
- [ ] Draft flow: start wizard -> save at step 3 -> reopen -> resume at step 3 -> complete

### QA Verification Script

1. Open the app on mobile
2. Navigate to MyJournal > Today tab > open an entry
3. Verify: "Add Thought Record" button visible -- corresponds to AC-1
4. Tap "Add Thought Record"
5. Verify: 6-step wizard with step indicator -- corresponds to AC-2
6. **Step 1:** Enter situation description, verify date auto-populated -- corresponds to AC-3
7. Tap "Next"
8. **Step 2:** Enter automatic thought, adjust belief slider to 85% -- corresponds to AC-4
9. Tap "Next"
10. **Step 3:** Select 2 emotions (anxious, sad), set intensities (80%, 60%) -- corresponds to AC-5
11. Tap "Next"
12. **Step 4:** Select "All-or-Nothing Thinking" and "Catastrophizing" -- corresponds to AC-6
13. Tap "Learn More" on a distortion
14. Verify: explanation card expands
15. Tap "Next"
16. **Step 5:** Enter rational response -- corresponds to AC-7
17. Tap "Next"
18. **Step 6:** Re-rate emotions (40%, 20%), re-rate belief (40%) -- corresponds to AC-8
19. Verify: before/after comparison bars shown
20. Tap "Done"
21. Verify: summary card appears in the entry -- corresponds to AC-10, AC-11
22. Start another thought record, save as draft at Step 3
23. Verify: "Draft thought record" badge on entry -- corresponds to AC-9
24. Tap "Resume"
25. Verify: wizard resumes at Step 3
26. Complete and verify
27. Open the app on web
28. Navigate to Journal > entry > Add Thought Record
29. Verify: same 6-step wizard flow

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to journal entry, create a thought record through all 6 steps

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for emotional impact score and distortion frequency

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
Journal entries support text, mood tags, and image attachments. No structured CBT framework or cognitive distortion tracking exists. The prompts engine has a "therapy" category with generic prompts but no CBT-specific structure.

### After This Work
Three new tables (`jn_thought_records`, `jn_thought_record_emotions`, `jn_thought_record_distortions`) store structured CBT data. A 6-step wizard guides users through the clinically-validated thought record process. Emotional impact scores and distortion frequency analysis are computed from the data. Summary cards appear inline in linked entries.

### Files Changed
- `modules/journal/src/db/schema.ts` -- add CREATE_THOUGHT_RECORDS, CREATE_THOUGHT_RECORD_EMOTIONS, CREATE_THOUGHT_RECORD_DISTORTIONS, indexes
- `modules/journal/src/definition.ts` -- add CBT tables to JOURNAL_MIGRATION_V3
- `modules/journal/src/db/cbt.ts` -- CRUD for thought records, emotions, distortions
- `modules/journal/src/cbt/types.ts` -- ThoughtRecord, RecordEmotion, RecordDistortion, CbtStats, EmotionalImpact types
- `modules/journal/src/cbt/distortions.ts` -- 15 distortion definitions (name, description, example)
- `modules/journal/src/cbt/cbt-engine.ts` -- createRecord, updateStep, completeRecord, emotionalImpactScore, distortionFrequency
- `modules/journal/src/cbt/index.ts` -- barrel export
- `modules/journal/src/cbt/__tests__/cbt-engine.test.ts` -- 13+ unit tests
- `modules/journal/src/types.ts` -- add ThoughtRecord, RecordEmotion, RecordDistortion Zod schemas
- `modules/journal/src/index.ts` -- re-export cbt module
- `apps/mobile/app/(journal)/cbt-wizard.tsx` -- mobile 6-step wizard
- `apps/mobile/app/(journal)/cbt-review.tsx` -- mobile thought record review
- `apps/web/app/journal/cbt/page.tsx` -- web CBT wizard
- `apps/web/app/journal/cbt/[id]/page.tsx` -- web thought record review

### Known Limitations
- No AI-guided CBT (e.g., suggesting which distortion applies). Manual selection only.
- No therapist sharing. Users share by showing their device or exporting to PDF.
- No longitudinal analysis beyond distortion frequency (no trend lines over time).
- Custom emotions are free-text, not normalized. "Anxious" and "anxious" could coexist.

### Context for Next Agent
- The 15 cognitive distortion types are well-established in CBT literature. Use the exact types from the SPEC: `all_or_nothing`, `overgeneralization`, `mental_filter`, `disqualifying_positive`, `mind_reading`, `fortune_telling`, `magnification`, `minimization`, `emotional_reasoning`, `should_statements`, `labeling`, `personalization`, `blame`, `always_being_right`, `fallacy_of_fairness`.
- For the emotion grid, suggested predefined emotions (30): angry, anxious, ashamed, bored, calm, confused, content, disappointed, disgusted, embarrassed, excited, frustrated, grateful, guilty, happy, hopeful, hopeless, jealous, lonely, loved, nervous, overwhelmed, peaceful, proud, relieved, sad, scared, stressed, surprised, worried.
- The `current_step` field on `jn_thought_records` enables draft resumption. On wizard open, check if entry has a draft record and resume from `current_step`.
- Emotional impact score: `avg(before - after)` across emotions. Positive = improvement. Can be negative (rare but valid).
- Migration V3 coordination: combine voice-to-text, metadata, therapy templates, and CBT tables into a single V3 migration in `definition.ts`.
- Therapy templates (JR-023) depend on CBT records for auto-population. The dependency is optional -- therapy templates show fallback text if CBT is not enabled/used.
