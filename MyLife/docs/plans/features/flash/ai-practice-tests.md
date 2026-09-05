# Feature Spec: AI Practice Tests

## Metadata
- **Module:** flash
- **Priority Score:** 25 / 50 (B-Tier)
- **Scoring Breakdown:** Market 4 x3 + Switching 2 x3 + Complexity 1 x2 + CrossModule 1 x1 + PaidUser 4 x1
- **Sprint:** Sprint 6+ (B+C Features)
- **Estimated CC Time:** 5-6 hours
- **Depends On:** AI card generation (A-tier, cloud generation infrastructure), Multiple choice (A-tier, MC engine)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Practice tests are fundamentally different from flashcard review. Flashcards test one fact at a time with immediate feedback. Practice tests simulate exam conditions: timed, multi-question, no peeking, with a score report at the end. StudyFetch charges $228/yr and positions AI-generated practice tests as their core differentiator. Students preparing for exams (SAT, MCAT, NCLEX, bar exam, professional certifications) want realistic test simulations built from their study material. By generating practice tests from the user's existing flashcard decks, MyFlash transforms a passive card collection into an active exam prep tool without the user creating test questions manually.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| StudyFetch | Yes | $228/yr | AI generates practice tests from uploaded notes. Multiple question types (MC, true/false, short answer, essay). Timed mode. Score reports with weak-area analysis. |
| Quizlet | Partial | $35.99/yr (Learn mode) | "Test" mode generates random MC/TF/written/matching from cards. No AI. No timing. Basic score report. |
| Anki | No | N/A | No practice test mode. Review only. Third-party add-ons can simulate tests but poorly. |
| Brainscape | No | N/A | No practice test mode. Confidence-based review only. |

### Target User
Students preparing for standardized tests (MCAT, NCLEX, bar exam, GRE) who have built flashcard decks as their study material and want to simulate exam conditions. Also professionals studying for certifications (AWS, CPA, PMP) who need timed test practice. These users currently pay $228/yr for StudyFetch or cobble together Quizlet's test mode with a separate timer app.

## Technical Context

### Where This Lives in MyLife

```
modules/flash/src/practice/types.ts                 -- PracticeTest, PracticeQuestion, QuestionType types
modules/flash/src/practice/generator.ts             -- AI-powered test generation from deck content
modules/flash/src/practice/scorer.ts                -- Test scoring, weak-area analysis, time analysis
modules/flash/src/practice/index.ts                 -- Barrel export
modules/flash/src/practice/__tests__/               -- Tests
modules/flash/src/db/practice.ts                    -- SQLite CRUD for practice tests and results
modules/flash/src/db/schema.ts                      -- V4 migration: fl_practice_tests, fl_practice_answers
modules/flash/src/definition.ts                     -- Add V4 migration
apps/mobile/app/(flash)/practice-test.tsx           -- Practice test session screen
apps/mobile/app/(flash)/practice-results.tsx        -- Score report screen
apps/mobile/app/(flash)/components/PracticeQuestion.tsx  -- Question renderer (MC/TF/short answer)
apps/web/app/flash/practice/page.tsx                -- Web practice test page
apps/web/app/flash/practice/results/page.tsx        -- Web score report
```

### Wireframe Position

```
Hub Dashboard
  └── MyFlash card
       └── Study tab -> "Practice Test" button (below review cards)
            └── Test configuration modal
                 └── Practice Test Session <- YOU ARE HERE
                      └── Score Report (on completion)
```

### Data Model

Two new tables in V4 migration:

```sql
-- V4 migration: AI practice tests
CREATE TABLE IF NOT EXISTS fl_practice_tests (
  id TEXT PRIMARY KEY NOT NULL,
  deck_id TEXT NOT NULL REFERENCES fl_decks(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Practice Test',
  question_count INTEGER NOT NULL,
  time_limit_seconds INTEGER,
  question_types_json TEXT NOT NULL DEFAULT '["mc","tf"]',
  total_score REAL,
  max_score INTEGER,
  score_percent REAL,
  time_taken_seconds INTEGER,
  weak_tags_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS fl_practice_answers (
  id TEXT PRIMARY KEY NOT NULL,
  test_id TEXT NOT NULL REFERENCES fl_practice_tests(id) ON DELETE CASCADE,
  question_index INTEGER NOT NULL,
  source_card_id TEXT REFERENCES fl_cards(id) ON DELETE SET NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('mc', 'tf', 'short_answer', 'fill_blank')),
  question_text TEXT NOT NULL,
  options_json TEXT NOT NULL DEFAULT '[]',
  correct_answer TEXT NOT NULL,
  user_answer TEXT,
  is_correct INTEGER,
  time_spent_seconds INTEGER NOT NULL DEFAULT 0,
  explanation TEXT NOT NULL DEFAULT '',
  answered_at TEXT
);

CREATE INDEX IF NOT EXISTS fl_practice_tests_deck_idx ON fl_practice_tests(deck_id, started_at DESC);
CREATE INDEX IF NOT EXISTS fl_practice_answers_test_idx ON fl_practice_answers(test_id, question_index);
```

### Dependencies
- **Internal:** `@mylife/flash` (fl_cards for source content, MC engine for distractor generation, AI generator for cloud processing), `@mylife/ui` (Cool Obsidian tokens)
- **External:** Claude API (cloud mode for question generation and answer explanations). On-device mode uses existing MC distractor engine as fallback.
- **Cross-Module:** None directly. Future: health module could track study stress correlation.

## Functional Requirements

### User Stories
1. As a medical student, I want to generate a timed practice test from my anatomy deck so that I can simulate exam conditions.
2. As a certification prep student, I want multiple question types (MC, true/false, fill-in-the-blank) so that I practice different recall modes.
3. As a test-taker, I want a score report showing which topics I'm weak on so that I can focus my review.
4. As a busy learner, I want to configure test length and time limit so that I can fit practice into available time.
5. As a returning student, I want to see my practice test history with score trends so that I can track improvement.

### Behavior Specification

**Configuring a practice test:**
1. User navigates to Study tab and taps "Practice Test"
2. Configuration modal appears with:
   - Deck selector (which deck to test from; "All Decks" option available)
   - Question count slider: 10, 20, 30, 50, 100, or "All"
   - Time limit toggle: off, or 15/30/45/60/90/120 minutes
   - Question types: checkboxes for MC, True/False, Short Answer, Fill-in-the-Blank (at least one required)
   - Difficulty filter: All, Due cards only, Leeches only, New cards only
3. User taps "Start Test"
4. System generates questions (see generation section below)

**Generating questions:**
1. System selects N cards from the deck based on filters
2. For each selected card, the system generates a question:
   - **MC (multiple choice):** Uses the existing MC distractor engine to generate 4 options. The card's front is the question, correct answer is the back, distractors from other cards in the deck.
   - **TF (true/false):** Pairs the card's front with either the correct back (true) or a distractor back from another card (false). 50/50 distribution.
   - **Short answer:** Shows the card's front, user types the answer. Scored by normalized string similarity (Levenshtein distance / answer length; threshold: 80% match = correct).
   - **Fill-in-the-blank:** For cloze cards, uses the cloze deletion directly. For basic cards, generates a fill-blank by removing a key term from the back.
3. If cloud AI is configured (API key set), the system sends the card content to Claude API for:
   - Higher-quality distractors (contextually plausible wrong answers)
   - Explanations for each correct answer
   - Fill-in-the-blank generation from non-cloze cards
4. If no API key, the system uses the on-device MC distractor engine and simpler generation.
5. Questions are shuffled randomly
6. Questions and correct answers are persisted to `fl_practice_answers` immediately (so abandoning the test preserves the questions)

**Taking the test:**
1. Full-screen test mode: one question per screen, navigation dots at top
2. Timer (if enabled) shows remaining time in top-right corner
3. User answers each question:
   - MC: tap one of 4 options
   - TF: tap "True" or "False"
   - Short answer: type in text field, tap "Submit"
   - Fill-blank: type the missing word(s), tap "Submit"
4. User can navigate forward/backward between questions
5. Unanswered questions show a warning badge in the navigation dots
6. User can flag questions for review (star icon)
7. After answering all questions (or when time expires), "Finish Test" button becomes prominent
8. Tapping "Finish Test" shows confirmation: "X of Y answered. Submit?" with "Submit" / "Keep Going"
9. On submit, system scores the test and navigates to results

**Score report:**
1. Overall score: X/Y correct (Z%)
2. Score gauge: circular ring (green > 70%, amber 50-70%, red < 50%)
3. Time taken vs time limit (if timed)
4. Per-question-type breakdown: MC score, TF score, Short Answer score, Fill-blank score
5. Weak areas: tags with lowest scores, specific cards answered incorrectly
6. "Review Mistakes" button: opens a mini review session with only the incorrectly answered cards
7. Score history chart: line graph showing scores over time for this deck

### Edge Cases

- **Deck with fewer cards than requested question count:** Generate as many questions as possible. Show notice: "Only X cards available. Test will have X questions."
- **Deck with fewer than 4 cards (can't generate MC distractors):** Fall back to TF and Short Answer only. If MC was the only selected type, show error: "Need at least 4 cards for multiple choice."
- **Timer expires with unanswered questions:** Auto-submit with unanswered questions marked incorrect. Show "(X unanswered)" in results.
- **App backgrounded during test:** Timer continues (local notification for time expiry). Test state persisted in SQLite. Returning resumes from current question.
- **App crashes during test:** Test has `status = 'in_progress'`. On next open, offer "Resume test?" or "Abandon?"
- **Short answer scoring edge cases:** Ignore case, ignore leading/trailing whitespace, ignore punctuation. "United States" matches "united states" and "United States." Accept reasonable abbreviations only if exact match fails.
- **Cloze card as MC question:** Use the full text (with blank) as the question, the cloze answer as correct, distractors from other cloze cards' answers or from basic card backs.
- **Card with very long content (> 500 chars front):** Truncate question text at 500 chars with "..." for readability. Full text available on tap.
- **Module disabled mid-test:** Test persists with `status = 'in_progress'`. Re-enabling module shows resume prompt.
- **No API key for cloud mode:** All question generation falls back to on-device. Short answer explanations are omitted.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** "Practice Test" button is visible on the Study tab below the review cards section
- [ ] **AC-2:** Configuration modal shows deck selector, question count, time limit, question types, and difficulty filter
- [ ] **AC-3:** Starting a test shows a full-screen test mode with one question per screen
- [ ] **AC-4:** Navigation dots at top show progress and answered/unanswered status
- [ ] **AC-5:** MC questions show 4 options; tapping one highlights it as selected
- [ ] **AC-6:** TF questions show "True" and "False" buttons
- [ ] **AC-7:** Short answer questions show a text input field with "Submit" button
- [ ] **AC-8:** Timer (when enabled) counts down in the top-right corner
- [ ] **AC-9:** "Finish Test" appears after all questions are answered
- [ ] **AC-10:** Score report shows overall score, per-type breakdown, and weak areas
- [ ] **AC-11:** "Review Mistakes" opens a review session with only incorrect cards
- [ ] **AC-12:** Practice test history shows past scores with date and deck name

### Technical Criteria
- [ ] **TC-1:** Questions generated from deck cards using MC distractor engine (on-device) or Claude API (cloud)
- [ ] **TC-2:** Test state persists in `fl_practice_tests` with status tracking
- [ ] **TC-3:** Individual answers persist in `fl_practice_answers` as they are submitted
- [ ] **TC-4:** Short answer scoring uses normalized Levenshtein distance with 80% threshold
- [ ] **TC-5:** Timer continues in background via scheduled local notification
- [ ] **TC-6:** V4 migration creates tables without affecting existing data
- [ ] **TC-7:** Cloud API failure gracefully falls back to on-device generation

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Practice test scoring must NOT affect card SRS scheduling (test results are separate from review ratings)
- [ ] **NC-2:** Navigating between questions must NOT reset already-submitted answers
- [ ] **NC-3:** Timer expiry must NOT lose already-submitted answers
- [ ] **NC-4:** Cloud API calls must NOT send card content without user consent (API key opt-in is consent)
- [ ] **NC-5:** Practice tests must NOT block the standard review flow (user can still review cards normally)
- [ ] **NC-6:** Short answer scoring must NOT be case-sensitive

## UI Specification

### Mobile (Expo)

**Configuration Modal (bottom sheet)**
- Background: `#12121A` (surface token) with glass border
- Deck picker: dropdown with deck names
- Question count: segmented control [10, 20, 30, 50, All]
- Time limit: toggle + segmented control [15m, 30m, 45m, 60m, 90m, 120m]
- Question types: checkbox pills for MC, TF, Short Answer, Fill Blank
- "Start Test" button: full-width, `#FBBF24` background

**Test Session (full-screen)**
- Background: `#0A0A0F` (background token)
- Navigation dots: top, small circles (filled = answered, empty = unanswered, star = flagged)
- Timer: top-right, `rgba(240,240,245,0.65)` text, turns red < 5 min
- Question number: "Question 3 of 20", `fontSize: 14`, `rgba(240,240,245,0.5)`
- Question text: `fontSize: 18`, `fontWeight: 600`, color `#F0F0F5`
- MC options: glass cards, tap to select (selected = `#FBBF24` border), spacing 12px
- TF buttons: two large pills, side by side
- Short answer: text input with `glassBorder` styling, "Submit" button below
- Navigation: "Previous" / "Next" buttons at bottom

**Score Report**
- Score gauge: 120px circular ring, accent color based on score (green/amber/red)
- Score: large text "85%" center, "17/20 correct" below
- Time: "Completed in 12:34" if timed
- Per-type bars: horizontal bars showing MC: 9/10, TF: 5/5, SA: 3/5
- Weak tags: tag pills with red accent for tags scoring < 60%
- "Review Mistakes" button: outlined, `#FBBF24` text
- History section: mini line chart of recent scores

### Web (Next.js)

- Same design tokens via CSS variables
- Test session: centered content area (max-width 700px), navigation sidebar
- Timer: sticky top-bar
- Score report: two-column (gauge + breakdown left, weak areas right)
- Route: `/flash/practice` (config + start), `/flash/practice/session/:id` (taking test), `/flash/practice/results/:id` (report)

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton question cards | Questions generating |
| Config | Configuration modal with options | "Practice Test" tapped |
| In Progress | Full-screen test with question | Test started |
| Review | Question with answer revealed + explanation | Question submitted in review mode |
| Completed | Score report with breakdown | All questions answered + submitted |
| Abandoned | "Resume?" prompt | In-progress test found on re-entry |

## Test Requirements

### Unit Tests
- [ ] `generateMCQuestion(card, deck)`: returns question with 4 options including correct answer
- [ ] `generateMCQuestion(card, deck)`: distractors come from other cards in the deck
- [ ] `generateTFQuestion(card, deck)`: returns true or false question with correct answer
- [ ] `generateTFQuestion(card, deck)`: roughly 50/50 true/false distribution over many calls
- [ ] `generateShortAnswerQuestion(card)`: returns question from front, answer from back
- [ ] `generateFillBlankQuestion(clozeCard)`: uses cloze deletion directly
- [ ] `generateFillBlankQuestion(basicCard)`: extracts key term from back for blank
- [ ] `scoreShortAnswer('united states', 'United States')`: returns correct (case-insensitive)
- [ ] `scoreShortAnswer('US', 'United States')`: returns incorrect (too different)
- [ ] `scoreShortAnswer('Untied States', 'United States')`: returns correct (> 80% similarity)
- [ ] `calculateTestScore(answers)`: returns correct count, total, percentage
- [ ] `findWeakAreas(answers, cards)`: returns tags with lowest scores
- [ ] `generateTest(config)`: respects question count and type filters
- [ ] `generateTest(config)`: handles deck with fewer cards than requested
- [ ] V4 migration: tables created, indexes created

### Integration Tests
- [ ] Full flow: configure test -> start -> answer all -> submit -> score report accurate
- [ ] Resume flow: start test -> background app -> resume -> answers preserved
- [ ] Abandon flow: start test -> abandon -> history shows abandoned test
- [ ] Cloud fallback: invalid API key -> test generates using on-device engine

### QA Verification Script

1. Open the app on iOS simulator
2. Navigate to MyFlash via hub dashboard
3. Ensure a deck exists with 20+ cards
4. Navigate to Study tab
5. **Verify:** "Practice Test" button visible (AC-1)
6. Tap "Practice Test"
7. **Verify:** Configuration modal appears with all options (AC-2)
8. Select the deck, 10 questions, 15-minute timer, MC + TF types
9. Tap "Start Test"
10. **Verify:** Full-screen test mode with first question displayed (AC-3)
11. **Verify:** Navigation dots visible at top (AC-4)
12. Answer a MC question by tapping an option
13. **Verify:** Option highlights with accent border (AC-5)
14. Navigate to a TF question
15. **Verify:** True/False buttons displayed (AC-6)
16. Navigate to next, then back
17. **Verify:** Previous answer preserved (NC-2)
18. **Verify:** Timer counting down in top-right (AC-8)
19. Answer all 10 questions
20. **Verify:** "Finish Test" button appears (AC-9)
21. Tap "Finish Test" -> "Submit"
22. **Verify:** Score report shows overall score, per-type breakdown, weak areas (AC-10)
23. Tap "Review Mistakes"
24. **Verify:** Review session shows only incorrect cards (AC-11)
25. Go back to Study tab -> "Practice Test" history
26. **Verify:** Past test visible with date, deck, score (AC-12)
27. Start a new test, then background the app for 30 seconds
28. Return to the app
29. **Verify:** Test resumes from current question, timer accurate
30. Create a short answer test (10 questions, SA only)
31. Answer with slight misspellings
32. **Verify:** Reasonable typos accepted, case ignored (NC-6, TC-4)
33. Open web at /flash/practice, repeat steps 6-27
34. **Verify:** Web test interface works identically

## gstack Quality Gates

Based on this feature's complexity score (1 -- Complex), these gstack skills are REQUIRED:

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states
- [ ] Batch QA: after 5 features in flash module, run `/qa` on the module URL

### Required if Complexity <= 2 (Large/Complex):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. Fix issues found.

### Required if Complexity <= 1 (Complex):
- [ ] `/office-hours` (builder mode) -- validate approach before building

### Required if this feature contains business logic:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for test generation and scoring engines

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
Flash module has MC distractor engine (`mc/distractor-engine.ts`) and AI card generation (`ai/generator.ts` with on-device text parsing and cloud placeholder). There is no concept of timed tests, multi-question sessions, score tracking, or weak-area analysis. The MC results table (`fl_mc_results`) tracks individual MC quiz sessions but not structured practice tests.

### After This Work
- Two new tables: `fl_practice_tests` (test configuration + results) and `fl_practice_answers` (per-question answers)
- Practice test generator that creates questions from deck content using MC distractor engine (on-device) or Claude API (cloud)
- Four question types: MC, True/False, Short Answer, Fill-in-the-Blank
- Timed test mode with background timer
- Score report with per-type breakdown and weak-area identification (by tag)
- Test history with score trends

### Files Changed
- `modules/flash/src/practice/types.ts` -- New: PracticeTest, PracticeQuestion, QuestionType, TestConfig types
- `modules/flash/src/practice/generator.ts` -- New: test generation from deck cards
- `modules/flash/src/practice/scorer.ts` -- New: scoring engine, Levenshtein similarity, weak-area analysis
- `modules/flash/src/practice/index.ts` -- New: barrel export
- `modules/flash/src/practice/__tests__/generator.test.ts` -- New: generation tests
- `modules/flash/src/practice/__tests__/scorer.test.ts` -- New: scoring tests
- `modules/flash/src/db/practice.ts` -- New: CRUD for practice tests and answers
- `modules/flash/src/db/schema.ts` -- Add V4 migration SQL
- `modules/flash/src/definition.ts` -- Add FLASH_MIGRATION_V4
- `modules/flash/src/index.ts` -- Export practice types and functions
- `apps/mobile/app/(flash)/practice-test.tsx` -- New: test session screen
- `apps/mobile/app/(flash)/practice-results.tsx` -- New: score report screen
- `apps/mobile/app/(flash)/components/PracticeQuestion.tsx` -- New: question renderer
- `apps/web/app/flash/practice/page.tsx` -- New: web test page
- `apps/web/app/flash/practice/results/page.tsx` -- New: web score report

### Known Limitations
- V1 does not support essay questions (requires AI grading which is unreliable and slow)
- V1 does not support question images (test from text content only). Future: combine with image occlusion for visual tests.
- V1 explanations require cloud API. On-device mode omits explanations.
- No adaptive difficulty (questions are randomly selected, not intelligently ordered by estimated difficulty).
- No cross-deck practice tests (test from one deck at a time). "All Decks" is planned for V2.

### Context for Next Agent
- The MC distractor engine (`mc/distractor-engine.ts`) already handles generating plausible wrong answers from other cards in a deck. Reuse `generateDistractors` and `buildMCQuestion` for MC test questions.
- The Claude API integration in `ai/generator.ts` is a placeholder for cloud mode. Extend it for practice test generation or create a separate cloud client.
- Short answer scoring needs a Levenshtein distance function. Implement as a pure function in `scorer.ts` (no external dependency).
- Practice test results are completely separate from SRS scheduling. Answering a test question does NOT call `rateFlashcard`.
- The `source_card_id` on `fl_practice_answers` links back to the card that generated the question. This enables "Review Mistakes" to open those specific cards for standard SRS review.
