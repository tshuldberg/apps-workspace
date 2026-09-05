# MyWords Feature Set

## Problem Statement

You are working in the MyLife monorepo at `/Users/trey/Desktop/Apps/MyLife/`. MyLife is a unified hub app consolidating 10+ privacy-first personal app modules into a single cross-platform application. Each module implements a `ModuleDefinition` contract from `@mylife/module-registry` and stores data in a shared SQLite database using table-name prefixes.

**MyWords** is a vocabulary and language reference app. The standalone source of truth lives at `/Users/trey/Desktop/Apps/MyLife/MyWords/`, a Turborepo monorepo with `apps/` (Expo mobile and Next.js web) and `packages/` (shared logic). Currently minimal with approximately 10 source files. What exists: dictionary definitions (Free Dictionary API), thesaurus (synonyms/antonyms), word etymology (Wiktionary scraping), rhymes (Datamuse API), alphabetical browse, word helper (contextual word replacement suggestions), and API response caching.

**Consolidation context:** MyWords absorbs **MyFlash** (a planned spaced repetition flashcard app that does not yet have runtime code). The combined app becomes a "Learning" hub: look up any word or concept, save it, then study it with scientifically-backed spaced repetition. The unique value proposition is that vocabulary discovery and flashcard study live in the same app, so looking up a word flows directly into studying it.

**What needs to be built (2 feature sets):**

### Feature Set 1: Vocabulary Collection and Study

Transform MyWords from a reference tool into an active learning platform. Users save words they encounter, organize them into lists, and study them through daily practice.

**Features:**
- Personal vocabulary lists / word collections: create named lists (e.g., "GRE Prep", "Spanish Travel"), add words with definitions, example sentences, and notes
- Word of the Day / daily discovery: surface a new word each day from a curated list or from the user's least-studied words
- Vocabulary quiz / self-test mode: multiple choice, fill-in-the-blank, and definition matching exercises generated from the user's vocabulary lists
- Offline dictionary database: bundled word database so definitions work without network
- Multi-language vocabulary learning: support for non-English word entries with translations and romanization
- "Save to Study" flow: when looking up any word in the dictionary, a single tap adds it to a vocabulary list and creates a flashcard automatically

### Feature Set 2: Spaced Repetition Flashcard Engine (MyFlash Consolidation)

MyFlash features bring a full flashcard system with the FSRS algorithm (Free Spaced Repetition Scheduler), the successor to SM-2 used by modern Anki forks.

**Features:**
- Full spaced repetition engine using the FSRS algorithm (calculates optimal review intervals based on difficulty, stability, and retrievability)
- Deck management: create, rename, delete, and reorder decks; nest decks in a hierarchy
- Multiple card types: basic (front/back), cloze deletion (fill in the blank from a sentence), and image occlusion (mask parts of an image)
- AI card generation: paste a paragraph of notes or a document and auto-generate flashcards from the content
- Anki .apkg import: parse Anki export files and import decks, cards, and review history
- Study modes: flashcards (spaced repetition order), learn (new cards only), test (randomized quiz), match (pair terms and definitions)
- Study statistics and streaks: cards reviewed per day, retention rate, streak tracker, heatmap of study activity
- Review scheduling: daily review count target with notification reminders

---

## Acceptance Criteria

### Feature Set 1: Vocabulary Collection and Study

1. User looks up "ephemeral" in the dictionary -> sees definition, etymology, synonyms, and example sentences; taps "Save to Study" -> the word is added to their default vocabulary list AND a basic flashcard (front: "ephemeral", back: definition + example sentence) is auto-created in their default deck
2. User creates a vocabulary list named "GRE Prep" and adds 20 words -> opens Quiz mode -> sees a multiple-choice quiz with 4 options per question generated from their list; completes the quiz -> sees score and incorrectly answered words highlighted for review
3. User enables airplane mode and searches for "ubiquitous" -> the offline dictionary returns the definition, part of speech, and example usage without any network call
4. User opens the app -> sees a "Word of the Day" card on the home screen with a word, definition, and "Add to List" button

### Feature Set 2: Spaced Repetition Flashcard Engine

5. User creates a deck "Biology 101", adds 10 basic flashcards -> taps "Study" -> sees cards in FSRS-calculated order; rates each card (Again / Hard / Good / Easy) -> the next review date adjusts based on the rating; "Again" cards reappear within the same session
6. User creates a cloze card from the sentence "The mitochondria is the {{powerhouse}} of the cell" -> during study, sees "The mitochondria is the [...] of the cell" and must recall "powerhouse"
7. User pastes a 3-paragraph biology notes document and taps "Generate Cards" -> the AI creates 5-8 flashcards extracting key terms and concepts; user reviews and edits the generated cards before saving to a deck
8. User imports an Anki .apkg file containing 50 cards with review history -> all cards appear in a new deck with their FSRS scheduling state preserved (previously easy cards do not reset to "new")
9. User opens Study Stats -> sees a heatmap of study activity (days studied highlighted), cards reviewed per day chart, overall retention rate percentage, and current study streak count

---

## Constraint Architecture

**Musts:**
- All data stored in local SQLite (new tables with `wd_` prefix: `wd_vocabulary_lists`, `wd_vocabulary_words`, `wd_decks`, `wd_cards`, `wd_card_reviews`, `wd_study_sessions`, `wd_study_stats`, `wd_word_of_day`)
- FSRS algorithm implemented locally (TypeScript port), not via external API
- Offline dictionary bundled as a SQLite table (at minimum 50,000 English words with definitions)
- Anki .apkg parser handles SQLite-inside-ZIP format (Anki stores cards in a SQLite DB inside a ZIP file)
- Both standalone (`MyWords/`) and hub module must receive changes

**Must-nots:**
- Do not require network for core flashcard study (only AI card generation needs network)
- Do not modify existing dictionary/thesaurus/etymology API integrations
- Do not add user accounts or cloud sync
- Do not modify `packages/module-registry/` or other modules
- Do not implement a full Anki clone (no add-ons, no AnkiConnect, no LaTeX rendering)

**Preferences:**
- Use the open-source `ts-fsrs` library (TypeScript FSRS implementation) if available and under 20KB, otherwise implement the core algorithm directly (the FSRS-4.5 formula is well-documented)
- AI card generation should use a local prompt with structured output (JSON array of {front, back, type} objects)
- For the offline dictionary, prefer a compressed SQLite file derived from Wiktionary or WordNet
- Cloze deletion syntax should match Anki's `{{c1::answer}}` format for import compatibility
- Image occlusion can use canvas-based mask regions stored as JSON coordinates

**Escalation triggers:**
- If bundling a 50,000-word offline dictionary exceeds 30MB, reduce to 25,000 most common words and document
- If `.apkg` import requires parsing Anki's complex note type system beyond basic/cloze, simplify to basic cards only and document unsupported types
- If AI card generation quality is poor without a large context window, defer to manual card creation only

---

## Subtask Decomposition

**Subtask 1: Vocabulary List Schema and CRUD (60 min)**
Add vocabulary tables with `wd_` prefix. Build vocabulary list and word CRUD. Implement the "Save to Study" flow that auto-creates a flashcard when a word is saved.

**Subtask 2: FSRS Engine and Card Schema (90 min)**
Add flashcard tables (decks, cards, reviews, sessions). Implement the FSRS-4.5 algorithm: calculate stability, difficulty, and retrievability per card; determine next review date based on rating. Write unit tests with known FSRS test vectors.

**Subtask 3: Study Modes and UI (90 min)**
Build the flashcard study interface (show front, reveal back, rate). Implement study modes: spaced repetition order, learn (new only), test (random quiz), match (pair terms). Track session stats.

**Subtask 4: Card Types and AI Generation (60 min)**
Implement cloze deletion cards (parse `{{c1::answer}}` syntax, render with blanks). Implement AI card generation: accept text input, call Claude API with structured output prompt, return generated cards for user review.

**Subtask 5: Anki Import and Offline Dictionary (90 min)**
Build `.apkg` parser: unzip, read SQLite database, extract notes and cards, map to internal schema. Bundle offline dictionary as a compressed SQLite table. Wire offline lookup fallback when network is unavailable.

**Subtask 6: Statistics, Streaks, and Word of the Day (60 min)**
Build study statistics engine: cards per day, retention rate, streak tracking, heatmap data. Implement Word of the Day selection logic (curated list or least-studied). Build the stats dashboard UI.

---

## Evaluation Design

1. **FSRS scheduling:** Create a card, rate it "Good" -> `getNextReview(cardId)` returns a date approximately 1 day later; rate it "Good" again at review -> next interval is approximately 3 days; rate "Again" -> interval resets to minutes
2. **Save-to-Study flow:** Look up "serendipity" -> tap "Save to Study" -> verify both `wd_vocabulary_words` and `wd_cards` contain the new entry with matching content
3. **Anki import:** Import a test `.apkg` with 10 basic cards and 5 cloze cards -> `getCards(deckId)` returns 15 cards with correct types and content
4. **Offline dictionary:** Disconnect network, search "algorithm" -> definition returned from local SQLite within 50ms
5. **Type safety:** `pnpm typecheck` exits 0; `pnpm check:parity` exits 0
