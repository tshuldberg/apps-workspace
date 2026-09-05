# Feature Spec: Multiple Choice Mode

## Metadata
- **Module:** flash
- **Priority Score:** 32 / 50 (A-Tier)
- **Scoring Breakdown:** Market 4 x3 + Switching 3 x3 + Complexity 4 x2 + CrossModule 1 x1 + PaidUser 2 x1
- **Sprint:** Sprint 5 (S+A Features)
- **Estimated CC Time:** 2-3 hours
- **Depends On:** FL-001 (Flashcard Creation -- implemented), FL-003 (Deck Organization -- implemented)
- **Blocks:** FL-023 (AI Practice Tests -- can reuse multiple choice infrastructure)

## Business Context

### Why This Feature Exists
Multiple choice is the second most-requested study mode after standard flashcard review. Quizlet (300M users) and Brainscape ($79.99/yr) both offer it. Multiple choice is particularly effective for recognition-based learning (early stages of memorization) and provides a lower-friction study option than free recall. Some learners simply prefer multiple choice over "flip the card" review. By generating distractors from other cards in the same deck, MyFlash creates a meaningful quiz experience without any AI or cloud dependency.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Quizlet | Yes | Free | Multiple choice with 4 options generated from same study set. "Learn" mode uses MC as scaffolding. |
| Brainscape | Yes | $79.99/yr | Confidence-based MC. Rate your confidence 1-5 after seeing the answer. Premium feature. |
| Anki | No | N/A | No built-in MC mode. Available via add-ons only. |
| StudyFetch | Yes | $228/yr | AI-generated MC with intelligent distractors. Premium. |

### Target User
Students preparing for standardized tests (SAT, GRE, medical boards) who are trained on MC format, and casual learners who find free recall intimidating. These users need a familiar quiz format that leverages their existing flashcard content.

## Technical Context

### Where This Lives in MyLife

```
modules/flash/src/mc/                           -- NEW: multiple choice engine
modules/flash/src/mc/types.ts                   -- MCQuestion, MCSession, MCResult types
modules/flash/src/mc/distractor-engine.ts       -- Distractor generation from deck cards
modules/flash/src/mc/mc-engine.ts               -- Session management, scoring, results
modules/flash/src/mc/index.ts                   -- Barrel export
modules/flash/src/mc/__tests__/                 -- Tests
apps/mobile/app/(flash)/multiple-choice.tsx     -- Mobile MC session screen
apps/mobile/app/(flash)/mc-results.tsx          -- Mobile MC results screen
apps/web/app/flash/multiple-choice/page.tsx     -- Web MC session
apps/web/app/flash/multiple-choice/results/page.tsx -- Web MC results
```

### Wireframe Position

```
Hub Dashboard
  └── MyFlash card
       └── Decks tab -> Deck Detail
            └── "Multiple Choice" button (in study mode picker) ← YOU ARE HERE
```

### Data Model

One new table in migration V3 (coordinate with rich media migration):

```sql
CREATE TABLE IF NOT EXISTS fl_mc_results (
  id TEXT PRIMARY KEY NOT NULL,
  deck_id TEXT NOT NULL REFERENCES fl_decks(id) ON DELETE CASCADE,
  question_count INTEGER NOT NULL,
  correct_count INTEGER NOT NULL,
  incorrect_count INTEGER NOT NULL,
  score_percent REAL NOT NULL,
  time_ms INTEGER NOT NULL DEFAULT 0,
  played_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS fl_mc_results_deck_idx ON fl_mc_results(deck_id, played_at DESC);
```

### Dependencies
- **Internal:** `@mylife/db`, flash card CRUD (`listCardsForDeck`, `getFlashcardById`)
- **External:** none (fully local, no AI needed for basic distractors)
- **Cross-Module:** none (flash-internal)

## Functional Requirements

### User Stories
1. As a student, I want to take a multiple choice quiz from my flashcard deck so that I can practice recognition before moving to free recall.
2. As a learner, I want the wrong answers to come from other cards in the same deck so that the quiz tests real knowledge, not just elimination.
3. As a test-prep student, I want to see my score and which questions I got wrong so that I can focus on weak areas.

### Behavior Specification

1. User navigates to a deck detail screen.
2. User taps "Multiple Choice" in the study mode picker (alongside "Review" and "Match Game" when available).
3. Configuration screen appears: question count selector (5, 10, 15, 20, or all), optional tag filter.
4. User taps "Start Quiz".
5. First question appears: card front text as the question, 4 answer options (1 correct + 3 distractors).
6. User taps an answer:
   - **Correct:** Option highlights green, brief celebratory animation, score increments, auto-advance after 1s.
   - **Incorrect:** Selected option highlights red, correct answer highlights green, auto-advance after 2s.
7. Progress bar at top shows question X of Y.
8. After all questions: results screen shows score (X/Y, percentage), time taken, list of incorrect answers with correct answer shown.
9. User can tap "Review Mistakes" to study only incorrect cards, "Play Again" to retake, or "Done" to return.
10. MC results are saved to `fl_mc_results` for performance tracking over time.
11. MC mode does NOT affect FSRS scheduling. No review logs are created. This is a separate study mode.

### Edge Cases

- **Deck has fewer than 4 cards:** Cannot play MC (need at least 4 for 1 correct + 3 distractors). Show "Need at least 4 cards for multiple choice."
- **Deck has exactly 4 cards:** All cards used as distractors for each question. Limited variety.
- **Duplicate back text across cards:** Skip cards with identical backs as distractors (they would be indistinguishable).
- **Very long answer text:** Truncate to 120 characters with ellipsis in option display.
- **Cloze cards in MC:** Use the cloze answer as the correct answer, full text (with blank) as the question.
- **Reversed cards in MC:** Use front as question, back as correct answer (standard orientation only, skip reversed duplicates).
- **Suspended/buried cards:** Excluded from MC question pool.
- **User navigates away mid-quiz:** Session is lost. No partial save.
- **All answers are very similar:** Distractor selection tries to maximize diversity (see algorithm).

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** "Multiple Choice" option appears in deck study mode picker for decks with 4+ cards.
- [ ] **AC-2:** Configuration screen allows selecting question count (5, 10, 15, 20, all).
- [ ] **AC-3:** Each question shows the card front as the question and 4 answer options.
- [ ] **AC-4:** Correct answer highlights green with brief celebration on tap.
- [ ] **AC-5:** Incorrect answer highlights red, correct answer highlights green, 2s delay before next.
- [ ] **AC-6:** Progress bar shows current question / total questions.
- [ ] **AC-7:** Results screen shows score (count and percentage), time taken.
- [ ] **AC-8:** Results screen lists all incorrect answers with the correct answer shown.
- [ ] **AC-9:** "Review Mistakes" button starts a review session with only incorrect cards.
- [ ] **AC-10:** "Play Again" reshuffles and restarts the quiz.
- [ ] **AC-11:** MC results are saved for performance tracking.
- [ ] **AC-12:** Decks with fewer than 4 cards show "Need at least 4 cards for multiple choice."

### Technical Criteria
- [ ] **TC-1:** Distractors are randomly selected from other cards in the same deck (not the correct card's siblings).
- [ ] **TC-2:** Distractor selection excludes cards with identical back text to the correct answer.
- [ ] **TC-3:** Answer options are shuffled randomly (correct answer is not always in the same position).
- [ ] **TC-4:** Suspended and buried cards are excluded from the question pool.
- [ ] **TC-5:** Cloze cards are converted: cloze answer as correct answer, rendered front (with blank) as question.
- [ ] **TC-6:** MC mode does NOT create review logs or affect FSRS scheduling.
- [ ] **TC-7:** Results are persisted to `fl_mc_results` table.
- [ ] **TC-8:** Quiz completes in real-time with no perceptible lag between questions.

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** MC sessions must NOT create review log entries or affect card scheduling.
- [ ] **NC-2:** Must NOT allow starting MC with fewer than 4 cards in the deck.
- [ ] **NC-3:** Correct answer must NOT always appear in the same position (A/B/C/D).
- [ ] **NC-4:** Distractors must NOT include the same text as the correct answer.

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Question text: `#F0F0F5`, 20px, centered
- Answer options: glass cards (`rgba(255,255,255,0.04)`), full width, 16px text, 12px vertical padding
- Option states: default (glass), selected-correct (green `#30D158` background), selected-incorrect (red `#FF453A` background), revealed-correct (green border glow)
- Progress bar: `#FBBF24` (accent) fill on `rgba(255,255,255,0.1)` track
- Question counter: "3 / 10" in textSecondary
- Timer: running clock in top-right corner
- Module accent: `#FBBF24`
- Results: large score percentage in accent color, grade text (A/B/C/D/F), incorrect answers in glass cards with red/green indicators

### Web (Next.js)

- Route: `/flash/multiple-choice?deck=:deckId`
- Same layout, centered content max-width 600px
- Keyboard shortcuts: 1/2/3/4 or A/B/C/D to select answers

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Config | Question count selector + start button | User taps "Multiple Choice" from deck |
| Question | Question text + 4 answer options + progress bar | Quiz in progress |
| Correct | Selected option green, brief checkmark animation | User taps correct answer |
| Incorrect | Selected option red, correct option green, 2s delay | User taps wrong answer |
| Results | Score, time, incorrect answer list | All questions answered |
| Too Few Cards | "Need at least 4 cards" message | Deck has < 4 cards |

## Test Requirements

### Unit Tests
- [ ] `generateDistractors`: deck with 10 cards, select 3 distractors for card X -> 3 unique cards, none matching X
- [ ] `excludeDuplicateBacks`: 2 cards with same back text -> only 1 used as distractor
- [ ] `shuffleOptions`: correct answer not always in same position across 100 iterations
- [ ] `excludeSuspendedCards`: suspended card not in question pool
- [ ] `excludeBuriedCards`: buried card not in question pool
- [ ] `minimumCardCheck`: deck with 3 cards -> throws "Need at least 4 cards"
- [ ] `clozeConversion`: cloze card "The {{c1::mitochondria}} is the powerhouse" -> question with blank, answer "mitochondria"
- [ ] `scoreCalculation`: 7 correct out of 10 -> score_percent = 70.0
- [ ] `truncateLongAnswers`: 150-char answer -> truncated to 120 + "..."
- [ ] `skipReversedDuplicates`: reversed card siblings -> only one appears as a question

### Integration Tests
- [ ] Full flow: start MC -> answer all questions -> view results -> verify score matches
- [ ] Mistakes review: get 3 wrong -> tap "Review Mistakes" -> 3 cards in review queue

### QA Verification Script

1. Open the app on mobile
2. Navigate to MyFlash > Decks > select a deck with 10+ cards
3. Verify: "Multiple Choice" option in study mode picker -- corresponds to AC-1
4. Tap "Multiple Choice"
5. Verify: configuration screen with question count selector -- corresponds to AC-2
6. Select "10 questions", tap "Start Quiz"
7. Verify: first question shows card front text and 4 answer options -- corresponds to AC-3
8. Tap the correct answer
9. Verify: option highlights green with checkmark -- corresponds to AC-4
10. Verify: auto-advances to next question after 1s
11. Verify: progress bar shows "2 / 10" -- corresponds to AC-6
12. Tap an incorrect answer
13. Verify: selected shows red, correct shows green, 2s delay -- corresponds to AC-5
14. Complete all 10 questions
15. Verify: results screen shows score and time -- corresponds to AC-7
16. Verify: incorrect answers listed with correct answer shown -- corresponds to AC-8
17. Tap "Review Mistakes"
18. Verify: only incorrect cards in the review queue -- corresponds to AC-9
19. Go back, tap "Play Again"
20. Verify: quiz restarts with reshuffled questions -- corresponds to AC-10
21. Try MC on a deck with 3 cards
22. Verify: "Need at least 4 cards" message -- corresponds to AC-12
23. Open the app on web
24. Navigate to Flash > deck > Multiple Choice
25. Verify: keyboard shortcuts (1-4) work for answer selection

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to MC mode, play through a quiz, verify all states

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for distractor engine

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
MyFlash has standard card review (flip + rate) as the only study mode. No alternative study modes exist.

### After This Work
Multiple choice mode is available from the deck detail screen. A distractor engine selects plausible wrong answers from the same deck. Results are tracked in `fl_mc_results`. MC is fully separate from FSRS scheduling.

### Files Changed
- `modules/flash/src/db/schema.ts` -- add CREATE_MC_RESULTS, CREATE_MC_RESULTS_INDEX
- `modules/flash/src/definition.ts` -- add mc_results table to FLASH_MIGRATION_V3
- `modules/flash/src/mc/types.ts` -- MCQuestion, MCOption, MCSession, MCResult types
- `modules/flash/src/mc/distractor-engine.ts` -- generateDistractors, shuffleOptions, excludeDuplicates
- `modules/flash/src/mc/mc-engine.ts` -- startMCSession, answerQuestion, getResults, saveMCResult
- `modules/flash/src/mc/index.ts` -- barrel export
- `modules/flash/src/mc/__tests__/distractor-engine.test.ts` -- 10+ unit tests
- `modules/flash/src/db/mc-results.ts` -- CRUD for fl_mc_results
- `modules/flash/src/types.ts` -- add MCResult Zod schema
- `modules/flash/src/index.ts` -- re-export mc module
- `apps/mobile/app/(flash)/multiple-choice.tsx` -- mobile MC session
- `apps/mobile/app/(flash)/mc-results.tsx` -- mobile MC results
- `apps/web/app/flash/multiple-choice/page.tsx` -- web MC session

### Known Limitations
- Distractors come from the same deck only. No AI-generated distractors (that's FL-023).
- Small decks (4-6 cards) produce repetitive distractors.
- No difficulty scaling. All questions are equally weighted.
- No timed mode (timer runs but does not force answers).

### Context for Next Agent
- Cards are fetched via `listCardsForDeck(db, deckId)`. Filter out `queue === 'suspended'` and `queue === 'buried'`.
- For cloze cards, use `renderClozeFront(text, number)` from `engine/cloze.ts` to get the question (with blank) and extract the cloze answer from the marker.
- Reversed cards share a `noteId`. To avoid duplicate questions, only use `templateOrdinal === 0` cards.
- The distractor engine should maximize text diversity. Sort candidate distractors by Levenshtein distance from the correct answer and pick the 3 most diverse.
- Results table uses deck_id foreign key with CASCADE delete, so deleting a deck cleans up MC results.
