# Feature Spec: Flashcard Integration (Words x Flash)

## Metadata
- **Module:** words (cross-module with flash)
- **Priority Score:** 27 / 50 (B-Tier)
- **Scoring Breakdown:** Market [2] x3 + Switching [3] x3 + Complexity [3] x2 + CrossModule [5] x1 + PaidUser [1] x1
- **Sprint:** 5
- **Estimated CC Time:** 3-4 hours
- **Depends On:** Saved words persistence (must be complete; uses `wd_saved_words` and `wd_word_lists` tables, `SavedWord` type, and mastery_level field)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Dictionary.com offers vocabulary quizzes alongside word lookup. MyLife can go further: saved words in MyWords become flashcards in MyFlash with one tap, creating a learning pipeline that no standalone dictionary offers. This is the highest cross-module score (5/5) in the Words backlog because it turns two premium modules into a unified vocabulary-building system. Users who save 20+ words per week get spaced repetition review for free, dramatically increasing retention.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Dictionary.com | Partial | Premium ($2.99/mo) | "Vocabulary quizzes" test saved words but not spaced repetition. Basic multiple choice on definitions. No interval scheduling. |
| Merriam-Webster | No | N/A | No flashcard or quiz feature. Saved words are a static list. |
| WordReference | No | N/A | No vocabulary study features at all. Forum-based. |
| Anki + Dictionary combo | Manual | Anki free / AnkiMobile $24.99 | Users manually create cards from dictionary lookups. High friction: copy-paste definitions, no auto-population. |
| Quizlet + Dictionary | Manual | Quizlet Plus $35.99/yr | Same manual workflow. No dictionary integration. Users create study sets by hand. |

### Target User
Language learners (18-45) building vocabulary who want their dictionary lookups to automatically become study material. GRE/SAT students who save 10-20 words daily and need spaced repetition. Bilingual professionals learning technical vocabulary in a second language. Users who currently bounce between a dictionary app and a flashcard app (Anki, Quizlet) and want one integrated tool. The cross-module score (5/5) reflects that this feature is the primary reason to have both Words and Flash enabled together.

## Technical Context

### Where This Lives in MyLife

```
modules/words/src/
  flash-bridge.ts                  -- NEW: cross-module bridge (create flashcards from saved words)
  types.ts                         -- New FlashBridgeInput/Output types
  index.ts                         -- Export bridge functions and types

modules/flash/src/
  (no changes -- uses existing createFlashcards API)

apps/mobile/app/(words)/
  saved-word-detail.tsx            -- Updated: "Create Flashcard" button
  saved.tsx                        -- Updated: bulk "Send to Flash" action

apps/web/app/words/
  page.tsx                         -- Updated: flashcard action on saved words
```

### Wireframe Position

```
Hub Dashboard
  └── MyWords card
       └── Saved tab
            └── [Saved Word Detail]
                 └── "Create Flashcard" button ← YOU ARE HERE
            └── Bulk actions bar
                 └── "Send to Flash" ← bulk create flashcards
```

### Data Model

No new tables required. This feature bridges existing tables:

**Read from (Words):**
```sql
-- wd_saved_words: source data for flashcard content
SELECT id, word, language_code, language_name, definition_summary,
       part_of_speech, pronunciation_text, lookup_data, mastery_level
FROM wd_saved_words
WHERE id = ?
```

**Write to (Flash):**
```sql
-- fl_cards: destination for generated flashcards
-- Uses existing createFlashcards() API from @mylife/flash
-- front = word + pronunciation + part of speech
-- back = definition summary + example sentences
-- source = 'words' (uses the V3 source column)
-- tags = ['words', language_code, part_of_speech]
```

**Tracking link (Words):**
```sql
-- New column on wd_saved_words to track linked flashcard
ALTER TABLE wd_saved_words ADD COLUMN flash_card_id TEXT DEFAULT NULL;
-- Migration V2
CREATE INDEX IF NOT EXISTS idx_wd_saved_words_flash ON wd_saved_words(flash_card_id);
```

### Dependencies
- **Internal:** `@mylife/words` (SavedWord type, getSavedWord, updateSavedWord), `@mylife/flash` (createFlashcards, Deck, CreateFlashcardInput), `@mylife/db` (DatabaseAdapter), `@mylife/module-registry` (check if Flash module is enabled)
- **External:** None
- **Cross-Module:** Flash module must be enabled for the feature to function. If Flash is disabled, the "Create Flashcard" button shows a prompt to enable Flash. The bridge reads from `wd_saved_words` and writes to `fl_cards` via Flash's public API.

## Functional Requirements

### User Stories
1. As a language learner, I want to turn a saved word into a flashcard with one tap so that I can study it with spaced repetition without manual card creation.
2. As a GRE student, I want to send an entire word list to Flash as a deck so that I can study a batch of vocabulary words together.
3. As a returning user, I want to see which saved words already have flashcards so that I avoid creating duplicates.
4. As a vocabulary builder, I want my flashcard to auto-populate with the word, definition, pronunciation, and example sentences so that I don't have to type anything.

### Behavior Specification

**Creating a single flashcard from saved word detail:**
1. User opens a saved word detail screen
2. If Flash module is enabled: "Create Flashcard" button appears below the mastery rating
3. If a flashcard already exists for this word (`flash_card_id` is not null): button shows "View in Flash" instead
4. User taps "Create Flashcard"
5. System presents a pre-populated flashcard preview:
   - **Front:** `word` (bold) + `pronunciationText` (if available, in IPA) + `partOfSpeech` (italic)
   - **Back:** `definitionSummary` + first 2 example sentences from `lookupData.entries[0].senses[0].examples`
   - **Deck:** dropdown defaulting to "Vocabulary" deck (auto-created if it doesn't exist, named "Words: Vocabulary")
   - **Tags:** `['words', languageCode, partOfSpeech]` (auto-populated, editable)
6. User can edit front/back text before confirming
7. User taps "Create"
8. System calls `createFlashcards()` from Flash module with `source: 'words'`
9. System updates `wd_saved_words.flash_card_id` with the new card ID
10. Button changes to "View in Flash"
11. Haptic confirmation

**Bulk send to Flash:**
1. User is on the Saved tab with word cards visible
2. User long-presses a word card to enter selection mode
3. Selection checkboxes appear on all cards
4. Bottom action bar appears with "Send to Flash" button (and count badge)
5. User selects multiple words (or taps "Select All")
6. User taps "Send to Flash"
7. System presents bulk confirmation: "[N] words will become flashcards in deck [Vocabulary]"
8. User can change target deck
9. User confirms
10. System creates flashcards for each selected word that doesn't already have a `flash_card_id`
11. Progress indicator shows during bulk creation
12. Completion toast: "Created [M] flashcards. [K] already existed."
13. All created words get their `flash_card_id` updated

**View in Flash navigation:**
1. User taps "View in Flash" on a word that has a linked flashcard
2. System navigates to the Flash module's card detail screen for that card
3. If the linked card was deleted in Flash (orphan reference), system clears `flash_card_id` and shows "Create Flashcard" again

**Flash module not enabled:**
1. If Flash is disabled, the "Create Flashcard" button shows as dimmed
2. Tapping it shows a bottom sheet: "Enable MyFlash to study saved words with spaced repetition" with "Enable" and "Not Now" buttons
3. "Enable" navigates to Hub Settings > Modules

### Edge Cases

- **Flash module disabled after cards were created:** The `flash_card_id` references remain in `wd_saved_words`. When Flash is re-enabled, the links should still work if Flash data was preserved (MyLife lifecycle: disable preserves data). If Flash data was somehow lost, the orphan check handles it.
- **Saved word has no definition_summary:** Generate back text from `lookupData` directly. If `lookupData` is also null (edge case: word saved from cache before API returned), show "No definition available" on the back and let the user edit.
- **Saved word has very long definition:** Truncate back text to 500 characters with "..." suffix. User can edit before creating.
- **Duplicate flashcard attempt:** If `flash_card_id` already points to an existing Flash card, do not create a duplicate. Show "View in Flash" instead. Check by querying Flash for the card ID before creation.
- **Bulk send with 100+ words:** Process in batches of 20 to avoid blocking the UI thread. Show progress bar.
- **Word saved in non-Latin script (Chinese, Arabic, Japanese):** Front text should render correctly. No special handling needed beyond Unicode support. Tags use the language code, not the script name.
- **Flash card deleted independently:** User deletes a card in Flash without going through Words. On next view of the saved word detail, check if `flash_card_id` still points to a valid card. If not, clear it and show "Create Flashcard."
- **User edits flashcard in Flash after creation:** The card in Flash is independent after creation. Edits in Flash do not propagate back to Words. The link is one-directional: Words -> Flash.
- **Module disabled mid-bulk-send:** If Words module is disabled during a bulk operation, the operation should complete for already-queued items. Partially created cards should still have their `flash_card_id` set correctly.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Saved word detail shows "Create Flashcard" button when Flash module is enabled and no flashcard exists yet
- [ ] **AC-2:** Tapping "Create Flashcard" shows a pre-populated preview with word (front) and definition (back)
- [ ] **AC-3:** Front text includes the word, pronunciation (if available), and part of speech
- [ ] **AC-4:** Back text includes definition summary and up to 2 example sentences
- [ ] **AC-5:** User can edit front and back text before confirming flashcard creation
- [ ] **AC-6:** After creation, button changes to "View in Flash" with the linked card ID stored
- [ ] **AC-7:** "View in Flash" navigates to the Flash module's card detail for the linked card
- [ ] **AC-8:** Long-press on Saved tab enters selection mode with checkboxes on each word
- [ ] **AC-9:** "Send to Flash" bulk action creates flashcards for all selected words without existing links
- [ ] **AC-10:** Bulk completion shows accurate counts: "[M] created, [K] already existed"
- [ ] **AC-11:** If Flash is disabled, "Create Flashcard" button is dimmed and tapping shows enable prompt
- [ ] **AC-12:** If linked Flash card was deleted, "Create Flashcard" reappears on next view
- [ ] **AC-13:** Default deck is "Words: Vocabulary" (auto-created if absent), changeable via dropdown

### Technical Criteria
- [ ] **TC-1:** Migration V2 adds `flash_card_id TEXT DEFAULT NULL` column to `wd_saved_words`
- [ ] **TC-2:** Index `idx_wd_saved_words_flash` is created on `flash_card_id`
- [ ] **TC-3:** `createFlashcardFromWord()` calls Flash's `createFlashcards()` with `source: 'words'`
- [ ] **TC-4:** Tags array includes `['words', languageCode, partOfSpeech]` (filtered for non-null values)
- [ ] **TC-5:** `flash_card_id` is updated atomically with flashcard creation
- [ ] **TC-6:** Bulk creation processes in batches of 20 or fewer
- [ ] **TC-7:** Orphan detection: querying Flash for a non-existent card clears `flash_card_id`
- [ ] **TC-8:** Module registry check: bridge function returns early with error if Flash is not enabled

### Negative Criteria
- [ ] **NC-1:** Creating a flashcard must NOT modify the saved word's `lookupData`, `notes`, or `masteryLevel`
- [ ] **NC-2:** Deleting a flashcard in Flash must NOT delete the saved word in Words
- [ ] **NC-3:** The bridge must NOT directly read/write `fl_cards` table; it must use Flash's public API (`createFlashcards`)
- [ ] **NC-4:** Flashcard creation must NOT make any network calls (all data comes from local SQLite)
- [ ] **NC-5:** Bulk send must NOT create duplicate flashcards for words that already have a `flash_card_id`

## UI Specification

### Mobile (Expo)

**Saved Word Detail (updated):**
- "Create Flashcard" button: glass card style, accent color `#0EA5E9`, Flash icon (lightning bolt) left-aligned
- Position: below mastery stars, above "Look Up Again" button
- When flash_card_id exists: "View in Flash" with Flash accent `#FBBF24` tint and right-arrow icon

**Flashcard Preview Modal:**
- Bottom sheet with glass background
- "Front" section: editable text area with word pre-populated, glass card
- "Back" section: editable text area with definition pre-populated, glass card
- Deck picker: dropdown showing existing Flash decks + "Words: Vocabulary" default
- Tags: horizontal chip row, removable/addable
- "Create" button: accent color, full-width at bottom
- "Cancel" link: textSecondary color above

**Bulk Selection Mode (Saved tab):**
- Circular checkboxes appear left of each word card on long-press
- Top bar changes: "[N] selected" with "Select All" and "Cancel" actions
- Bottom floating bar: "Send to Flash" button with count badge
- Progress overlay during bulk creation with cancel option

**Enable Flash Prompt:**
- Bottom sheet with Flash module icon and accent color
- "Enable MyFlash to study saved words with spaced repetition"
- Two buttons: "Enable" (accent), "Not Now" (textSecondary)

### Web (Next.js)

- "Create Flashcard" button on saved word detail panel/dialog, same behavior
- Bulk selection via checkbox column in saved words table/list
- "Send to Flash" toolbar button when selections exist
- Flashcard preview in a modal dialog rather than bottom sheet
- Same deck picker and tag editing

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Ready | "Create Flashcard" button with Flash icon | Flash enabled, no existing link |
| Linked | "View in Flash" button with card link | flash_card_id exists and card is valid |
| Disabled | Dimmed button + "Enable Flash" prompt | Flash module not enabled |
| Creating | Spinner on button, disabled state | Flashcard creation in progress |
| Bulk Progress | Progress bar overlay: "Creating 15/42..." | Bulk send in progress |
| Bulk Complete | Toast: "Created 38 flashcards. 4 already existed." | Bulk send finished |
| Error | "Couldn't create flashcard" + retry | Flash API call failed |
| Orphan Resolved | Button reverts to "Create Flashcard" | Linked card was deleted in Flash |

## Test Requirements

### Unit Tests
- [ ] `createFlashcardFromWord(db, savedWordId, deckId)`: creates Flash card and sets flash_card_id
- [ ] `createFlashcardFromWord(db, savedWordId, deckId)`: returns existing link if flash_card_id already set
- [ ] `createFlashcardFromWord(db, nonExistentId, deckId)`: returns null
- [ ] `buildFlashcardContent(savedWord)`: generates front with word + pronunciation + part of speech
- [ ] `buildFlashcardContent(savedWord)`: generates back with definition + up to 2 examples
- [ ] `buildFlashcardContent(savedWord)`: handles missing pronunciation gracefully
- [ ] `buildFlashcardContent(savedWord)`: handles missing lookupData gracefully
- [ ] `buildFlashcardContent(savedWord)`: truncates back text exceeding 500 chars
- [ ] `buildFlashcardTags(savedWord)`: returns ['words', languageCode, partOfSpeech]
- [ ] `buildFlashcardTags(savedWord)`: omits null partOfSpeech from tags
- [ ] `bulkCreateFlashcards(db, savedWordIds, deckId)`: creates cards for words without flash_card_id
- [ ] `bulkCreateFlashcards(db, savedWordIds, deckId)`: skips words that already have flash_card_id
- [ ] `bulkCreateFlashcards(db, savedWordIds, deckId)`: returns created/skipped counts
- [ ] `checkFlashCardExists(db, flashCardId)`: returns true for existing Flash card
- [ ] `checkFlashCardExists(db, flashCardId)`: returns false and clears flash_card_id for deleted card
- [ ] `getOrCreateVocabularyDeck(db)`: creates "Words: Vocabulary" deck on first call
- [ ] `getOrCreateVocabularyDeck(db)`: returns existing deck on subsequent calls

### Integration Tests
- [ ] Full flow: save word -> create flashcard -> verify card in Flash -> verify flash_card_id set
- [ ] Orphan flow: save word -> create flashcard -> delete card in Flash -> verify "Create Flashcard" reappears
- [ ] Bulk flow: save 5 words -> bulk send -> verify 5 cards created in Flash
- [ ] Duplicate guard: save word -> create flashcard -> try bulk send including same word -> verify no duplicate

### QA Verification Script
1. Open the app on iOS simulator
2. Navigate to Words > Lookup tab
3. Search for "ephemeral" and save the word
4. Navigate to Saved tab, tap "ephemeral"
5. Verify: "Create Flashcard" button appears below mastery stars -- corresponds to AC-1
6. Tap "Create Flashcard"
7. Verify: preview shows front="ephemeral /ɪˈfɛm.ər.əl/ (adjective)" and back contains the definition -- corresponds to AC-2, AC-3, AC-4
8. Verify: deck dropdown shows "Words: Vocabulary" -- corresponds to AC-13
9. Edit the back text to add a personal note
10. Verify: text is editable -- corresponds to AC-5
11. Tap "Create"
12. Verify: button changes to "View in Flash" -- corresponds to AC-6
13. Tap "View in Flash"
14. Verify: navigates to Flash module showing the card detail -- corresponds to AC-7
15. Go back to Words > Saved tab
16. Long-press "ephemeral"
17. Verify: selection mode with checkboxes appears -- corresponds to AC-8
18. Save 2 more words ("ubiquitous", "sanguine") and select all 3
19. Tap "Send to Flash"
20. Verify: confirmation shows "3 words will become flashcards" -- corresponds to AC-9
21. Confirm
22. Verify: toast shows "Created 2 flashcards. 1 already existed." -- corresponds to AC-10
23. Disable Flash module in Hub Settings
24. Go back to Words > Saved tab, tap "ephemeral"
25. Verify: button is dimmed, tapping shows enable prompt -- corresponds to AC-11
26. Re-enable Flash, navigate to Flash module, delete the "ephemeral" card
27. Go back to Words > Saved tab, tap "ephemeral"
28. Verify: "Create Flashcard" button reappears (orphan resolved) -- corresponds to AC-12

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to saved word detail, verify flashcard button states (ready, linked, disabled, creating, error)
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required if this feature contains business logic:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for `buildFlashcardContent` and `bulkCreateFlashcards`

### Post-merge:
- [ ] `/parity-check` -- words module parity (cross-module link)
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Words module has saved words persistence (V1 migration, `wd_saved_words` table with `mastery_level`)
- Flash module has `createFlashcards()` API with `source` column (V3)
- No cross-module bridge exists between Words and Flash
- `wd_saved_words` has no `flash_card_id` column
- No "Words: Vocabulary" deck concept in Flash

### After This Work
- V2 migration adds `flash_card_id` column and index to `wd_saved_words`
- `flash-bridge.ts` provides `createFlashcardFromWord()`, `bulkCreateFlashcards()`, `buildFlashcardContent()`, `checkFlashCardExists()`, `getOrCreateVocabularyDeck()`
- Saved word detail shows "Create Flashcard" / "View in Flash" button
- Bulk selection on Saved tab enables multi-word flashcard creation
- Flash cards created from Words have `source: 'words'` and tags including language code

### Files Changed
- `modules/words/src/flash-bridge.ts` -- NEW: cross-module bridge functions
- `modules/words/src/types.ts` -- Add FlashBridgeResult type
- `modules/words/src/definition.ts` -- Add V2 migration (flash_card_id column)
- `modules/words/src/index.ts` -- Export bridge functions
- `modules/words/src/__tests__/flash-bridge.test.ts` -- NEW: bridge function tests
- `modules/words/src/db/schema.ts` -- V2 ALTER TABLE + index SQL
- `apps/mobile/app/(words)/saved-word-detail.tsx` -- Flashcard create/view button
- `apps/mobile/app/(words)/saved.tsx` -- Bulk selection mode + Send to Flash
- `apps/web/app/words/page.tsx` -- Flashcard actions on saved words

### Known Limitations
- **One-directional link:** Editing a flashcard in Flash does not update the saved word in Words. The link is Words -> Flash only.
- **No sync of mastery_level:** Words mastery (0-5 self-assessment) and Flash scheduling (FSRS algorithm) are independent systems. A future feature could sync Flash review performance back to Words mastery.
- **Single deck target:** Bulk send targets one deck. A future enhancement could allow per-word deck assignment.
- **No reverse creation:** Users cannot create a saved word from a Flash card. The flow is dictionary lookup -> save -> flashcard only.

### Context for Next Agent
- Flash's `createFlashcards()` expects a `CreateFlashcardInput` with `deckId`, `front`, `back`, `cardType`, and `tags`. The `source` column is set separately via the V3 schema.
- The "Words: Vocabulary" deck should use Flash's `createDeck()` API with a recognizable name. Check for existence by name before creating.
- The `flash_card_id` column is nullable and defaults to NULL. Migration V2 uses ALTER TABLE (SQLite supports ADD COLUMN).
- The module registry check (`isModuleEnabled('flash')`) should use `@mylife/module-registry`'s public API. Import the check, don't hardcode module IDs.
- For the orphan check, call Flash's `getFlashcardById(flash_card_id)`. If it returns null, clear the reference.
