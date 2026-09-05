# Feature Spec: AI Card Generation

## Metadata
- **Module:** flash
- **Priority Score:** 31 / 50 (A-Tier)
- **Scoring Breakdown:** Market 4 x3 + Switching 3 x3 + Complexity 2 x2 + CrossModule 2 x1 + PaidUser 4 x1
- **Sprint:** Sprint 5 (S+A Features)
- **Estimated CC Time:** 3-4 hours
- **Depends On:** FL-001 (Flashcard Creation -- implemented via `createFlashcards`), FL-003 (Deck Organization -- implemented)
- **Blocks:** FL-023 (AI Practice Tests -- shares AI infrastructure)

## Business Context

### Why This Feature Exists
Manual card creation is the #1 friction point for flashcard apps. Creating 50 cards from a chapter of notes takes 30-60 minutes. Quizlet's "Magic Notes" (AI card generation) was their biggest feature launch in 2024, directly responsible for their growth to $96M revenue. StudyFetch charges $228/yr largely for this feature. MyFlash can match this capability with a privacy-first approach: on-device generation as the default (no data leaves the phone) with optional cloud AI for higher-quality cards (explicit consent, text-only transmission).

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Quizlet | Yes | $35.99/yr | "Magic Notes" -- paste text, AI generates study sets. Cloud-only. Tracks all user content. |
| StudyFetch | Yes | $228/yr | AI card generation, practice tests, conversation. Core feature, very expensive. |
| Anki | No | N/A | No AI. Manual creation or community deck download. |
| Brainscape | No | N/A | No AI generation. Manual only. |

### Target User
Students with lecture notes, textbook chapters, or article excerpts who want flashcards without the manual effort. Also professionals studying for certifications who have study guides. Primary migration target: Quizlet users paying $35.99/yr for Magic Notes.

## Technical Context

### Where This Lives in MyLife

```
modules/flash/src/ai/                           -- NEW: AI card generation engine
modules/flash/src/ai/types.ts                   -- GenerationConfig, GeneratedCard, GenerationResult types
modules/flash/src/ai/text-parser.ts             -- Text preprocessing, section segmentation
modules/flash/src/ai/on-device-generator.ts     -- Rule-based + pattern extraction (no ML)
modules/flash/src/ai/cloud-generator.ts         -- Claude API integration (opt-in)
modules/flash/src/ai/generator.ts               -- Unified generation interface
modules/flash/src/ai/index.ts                   -- Barrel export
modules/flash/src/ai/__tests__/                 -- Tests
apps/mobile/app/(flash)/ai-generate.tsx         -- Mobile AI generator screen
apps/mobile/app/(flash)/ai-review.tsx           -- Mobile generated cards review screen
apps/web/app/flash/ai-generate/page.tsx         -- Web AI generator
```

### Wireframe Position

```
Hub Dashboard
  └── MyFlash card
       └── Decks tab
            └── "AI Generate" button (deck action bar or FAB) ← YOU ARE HERE
            └── Or: Add Card -> "Generate from Text" option
```

### Data Model

No new tables needed. Generated cards become standard `fl_cards` records on save using `createFlashcards`. A `source` column is added to `fl_cards` in migration V3:

```sql
ALTER TABLE fl_cards ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'
  CHECK (source IN ('manual', 'ai_ondevice', 'ai_cloud', 'import'));
```

### Dependencies
- **Internal:** `@mylife/db`, `createFlashcards` (existing card creation pipeline), cloze engine for cloze-type cards
- **External:** On-device: none (rule-based extraction). Cloud: Anthropic Claude API or user-provided API key via `@mylife/intelligence` package patterns.
- **Cross-Module:** Notes module could send selected text to Flash AI generator (cross-module action)

## Functional Requirements

### User Stories
1. As a student, I want to paste my lecture notes and have the app generate flashcards automatically so that I can create study materials in seconds.
2. As a privacy-conscious user, I want on-device card generation that works offline so that my notes never leave my phone.
3. As a user who wants better cards, I want the option to use cloud AI with clear consent so that I get higher-quality results when I choose to.
4. As a user, I want to review and edit generated cards before saving so that I control what goes into my deck.

### Behavior Specification

1. User navigates to Decks tab and taps "AI Generate" or opens Add Card and selects "Generate from Text".
2. AI Generator screen appears with:
   - Generation mode selector: "On-Device" (default, lock icon) / "Cloud AI" (cloud icon + privacy note)
   - Large text input area (50% of screen)
   - Character count: "0 / 50,000"
   - Target deck selector
   - Card type preference: "Auto" / "Basic Only" / "Cloze Only"
   - "Generate" button
3. User pastes text (lecture notes, article excerpt, etc.).
4. User taps "Generate".
5. **If on-device mode:** Text is processed locally using pattern extraction:
   - Definitions (term: definition, "X is Y" patterns) become basic Q&A cards
   - Lists and enumerations become "Name the X types of Y" cards
   - Bold/italicized terms become cloze cards (if cloze type allowed)
   - Key facts become question/answer pairs
   - Processing: 2-5 seconds per 1000 words
6. **If cloud mode:**
   - Consent dialog appears: "Your text will be sent to an AI service. No account or study data is transmitted."
   - User confirms.
   - Text sent to Claude API with structured prompt for card generation.
   - API returns structured card data (JSON).
   - Processing: 3-10 seconds for any length.
7. Generated Cards Review screen shows all generated cards in a scrollable list.
8. Each card shows: front (bold), back, card type badge, checkbox, edit/delete buttons.
9. User can edit any card inline, delete unwanted cards, or deselect cards.
10. User taps "Save All" or "Save Selected".
11. Selected cards are saved to the target deck via `createFlashcards` with `source = 'ai_ondevice'` or `'ai_cloud'`.
12. Success message: "X cards added to [Deck Name]".

### Edge Cases

- **Text too short (<50 chars):** "Enter more text for better card generation."
- **Text exceeds 50,000 chars:** Character count turns red, Generate button disabled, "Text too long. Split into sections."
- **On-device generates 0 cards:** "No cards could be generated. Try more structured text (definitions, lists, facts)."
- **Cloud API timeout (30s):** "Generation timed out. Check your connection and try again."
- **Cloud API returns invalid data:** "Could not process AI response. Try again."
- **User edits a generated card then saves:** Edited version is saved (not the original).
- **User deletes all generated cards:** "No cards to save. Go back to regenerate."
- **Input in non-English language:** Pattern extraction works for definition patterns in any Latin-script language. Cloud mode handles all languages.
- **Input is poetry/narrative (few extractable facts):** Generate fewer cards, show "Limited factual content detected."
- **Cross-module: Notes sends text:** Text arrives pre-populated in the input area with the note title as a suggested tag.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** AI Generator screen shows mode selector (On-Device default / Cloud AI), text input, deck selector, and Generate button.
- [ ] **AC-2:** On-Device mode generates cards locally with no network request.
- [ ] **AC-3:** Cloud AI mode shows consent dialog before transmitting text.
- [ ] **AC-4:** Generated cards appear in a review list with front, back, type badge, and edit/delete controls.
- [ ] **AC-5:** User can edit any generated card inline before saving.
- [ ] **AC-6:** User can deselect cards and save only selected ones.
- [ ] **AC-7:** Saved cards appear in the target deck with correct `source` metadata.
- [ ] **AC-8:** Definition patterns ("X is Y", "X: Y") produce basic Q&A cards on-device.
- [ ] **AC-9:** List patterns ("types of X: A, B, C") produce enumeration cards on-device.
- [ ] **AC-10:** Text exceeding 50,000 characters disables the Generate button.
- [ ] **AC-11:** Text under 50 characters shows "Enter more text" message.
- [ ] **AC-12:** "Regenerate" button re-runs generation on the same text.

### Technical Criteria
- [ ] **TC-1:** Migration V3 adds `source` column to `fl_cards` with default 'manual'.
- [ ] **TC-2:** On-device generation uses regex-based pattern extraction (no ML model required).
- [ ] **TC-3:** Cloud generation sends ONLY the input text and card_type_preference. No user ID, deck names, or study data.
- [ ] **TC-4:** Generated cards are saved via existing `createFlashcards` pipeline with `source` field set.
- [ ] **TC-5:** On-device generation completes within 10 seconds for 5,000 words of input.
- [ ] **TC-6:** Cloud generation uses structured JSON output from the API for reliable parsing.
- [ ] **TC-7:** Generated cards are deduplicated (no duplicate fronts).

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** On-device mode must NOT make any network requests.
- [ ] **NC-2:** Cloud mode must NOT transmit user identity, deck names, existing cards, or study data.
- [ ] **NC-3:** Cloud mode must NOT proceed without explicit user consent (consent dialog is mandatory).
- [ ] **NC-4:** Generated cards must NOT be automatically saved without user review.
- [ ] **NC-5:** The generation process must NOT modify existing cards in the deck.

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Mode selector: segmented control, On-Device with lock icon (default selected, `#FBBF24`), Cloud AI with cloud icon
- Cloud AI privacy note: "Text will be sent to AI service" in `rgba(240,240,245,0.65)` below selector
- Text input: glass card, full-width, multiline, 50% screen height, `#F0F0F5` text
- Character count: bottom-right, accent color when under limit, `#FF453A` when over
- Generate button: full-width, accent `#FBBF24`, disabled state in gray
- Progress: pulsing animation with "Generating cards..." text and estimated time
- Review list: glass cards per generated card, front in bold, back in normal text, type badge, checkbox
- Module accent: `#FBBF24`

### Web (Next.js)

- Route: `/flash/ai-generate` (generator), `/flash/ai-generate/review` (review)
- Two-column layout: text input left, configuration right
- Generated cards in a scrollable list, inline editing

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Empty | Text area with placeholder, Generate disabled | No text entered |
| Text Entered | Character count updates, Generate active | Text pasted or typed |
| Over Limit | Character count red, Generate disabled | >50,000 characters |
| Generating | Progress animation, "Generating cards..." | User tapped Generate |
| Results | Generated card list with edit/save controls | Cards generated |
| No Results | "No cards could be generated" with retry | Pattern extraction found nothing |
| Error | Error message with retry button | API timeout or parsing failure |
| Consent | Cloud consent dialog | User selects Cloud AI and taps Generate |

## Test Requirements

### Unit Tests
- [ ] `extractDefinitions`: "Mitosis is cell division" -> Q: "What is mitosis?", A: "Cell division"
- [ ] `extractColonDefinitions`: "Photosynthesis: the process..." -> Q: "What is photosynthesis?", A: "The process..."
- [ ] `extractLists`: "Three types of rocks: ignite, sedimentary, metamorphic" -> Q: "Name three types of rocks", A: list
- [ ] `handleBoldTerms`: "**DNA** stores genetic information" -> cloze: "{{c1::DNA}} stores genetic information"
- [ ] `deduplicateCards`: 2 cards with same front text -> only 1 kept
- [ ] `rejectShortText`: 30-char input -> error: insufficient text
- [ ] `rejectLongText`: 51,000 chars -> error: text too long
- [ ] `cloudPayloadValidation`: cloud request contains only text and preference, no user data
- [ ] `parseCloudResponse`: valid JSON response -> array of {front, back, type} objects
- [ ] `handleCloudTimeout`: 35s response -> timeout error
- [ ] `setSourceMetadata`: saved cards have source = 'ai_ondevice' or 'ai_cloud'

### Integration Tests
- [ ] Full flow: paste text -> generate on-device -> review -> edit one card -> save -> verify cards in deck
- [ ] Cloud consent flow: select cloud -> generate -> consent dialog -> confirm -> cards generated

### QA Verification Script

1. Open the app on mobile
2. Navigate to MyFlash > Decks > select a deck
3. Tap "AI Generate"
4. Verify: generator screen with mode selector, text input, Generate button -- corresponds to AC-1
5. Verify: On-Device mode selected by default with lock icon -- corresponds to AC-2
6. Paste 2,000 words of lecture notes with definitions and lists
7. Verify: character count updates -- corresponds to AC-10 (under limit)
8. Tap "Generate"
9. Verify: progress animation appears
10. Wait for generation (2-10 seconds)
11. Verify: generated cards appear in review list -- corresponds to AC-4
12. Verify: definition-style cards have Q&A format -- corresponds to AC-8
13. Verify: list-style content generates enumeration cards -- corresponds to AC-9
14. Tap edit on one card, modify back text
15. Verify: inline editing works -- corresponds to AC-5
16. Deselect 2 cards
17. Tap "Save Selected"
18. Verify: only selected cards saved to deck with source metadata -- corresponds to AC-6, AC-7
19. Go back, switch to "Cloud AI" mode
20. Tap "Generate"
21. Verify: consent dialog appears -- corresponds to AC-3
22. Confirm consent
23. Verify: cards generated (higher quality if cloud is configured)
24. Paste text over 50,000 chars
25. Verify: character count red, Generate disabled -- corresponds to AC-10
26. Open the app on web
27. Navigate to Flash > AI Generate
28. Verify: same generation flow works

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to /flash/ai-generate, test both modes

### Required if Complexity <= 2 (Large/Complex):
- [ ] `/plan-eng-review` -- review AI integration architecture and privacy safeguards

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for text-to-card extraction

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
Cards are created manually via `createFlashcards` or imported. No AI generation capability exists.

### After This Work
An `ai/` directory contains a text-to-card generation engine with on-device (pattern extraction) and cloud (Claude API) modes. Users can paste text and generate cards with full review/edit before saving. Cards are tagged with their `source` metadata.

### Files Changed
- `modules/flash/src/db/schema.ts` -- add ALTER TABLE for `source` column
- `modules/flash/src/definition.ts` -- add source column to FLASH_MIGRATION_V3
- `modules/flash/src/ai/types.ts` -- GenerationConfig, GeneratedCard, GenerationResult, GenerationMode types
- `modules/flash/src/ai/text-parser.ts` -- segmentText, extractDefinitions, extractLists, extractBoldTerms
- `modules/flash/src/ai/on-device-generator.ts` -- generateCardsOnDevice using pattern extraction
- `modules/flash/src/ai/cloud-generator.ts` -- generateCardsCloud via Claude API
- `modules/flash/src/ai/generator.ts` -- unified generateCards function with mode dispatch
- `modules/flash/src/ai/index.ts` -- barrel export
- `modules/flash/src/ai/__tests__/text-parser.test.ts` -- pattern extraction tests
- `modules/flash/src/ai/__tests__/generator.test.ts` -- generation pipeline tests
- `modules/flash/src/types.ts` -- extend FlashcardSchema with source field, add GeneratedCard schema
- `modules/flash/src/index.ts` -- re-export ai module
- `apps/mobile/app/(flash)/ai-generate.tsx` -- mobile AI generator screen
- `apps/mobile/app/(flash)/ai-review.tsx` -- mobile generated cards review
- `apps/web/app/flash/ai-generate/page.tsx` -- web AI generator

### Known Limitations
- On-device generation is rule-based pattern extraction, not ML. Quality is lower than cloud AI for unstructured text.
- Cloud generation requires API key configuration. Not available out of the box.
- No on-device ML model bundling in V1 (deferred -- pattern extraction is sufficient for MVP).
- Non-Latin script languages have limited pattern extraction support in on-device mode.

### Context for Next Agent
- The `source` column added to `fl_cards` must be nullable for backward compatibility (existing cards have no source). Default to 'manual'. Migration uses `ALTER TABLE ... ADD COLUMN` which SQLite handles gracefully.
- For cloud generation, follow the pattern from `packages/intelligence/` for Claude API integration. Use the user's API key if configured, or the app-level key.
- The on-device text parser uses regex patterns. Key patterns to implement:
  - `"X is Y"` / `"X are Y"` -> definition cards
  - `"X: Y"` -> definition cards
  - Numbered/bulleted lists -> enumeration cards
  - `**bold terms**` / `*italic terms*` in markdown -> cloze candidates
- Cloze cards use the existing `buildClozeFlashcards` from `engine/cloze.ts`. Generate cloze syntax `{{c1::term}}` and pass through the cloze pipeline.
- The consent dialog for cloud mode must be shown every time (no "remember my choice" checkbox).
