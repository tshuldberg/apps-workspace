# Feature Spec: MyWords Full Mobile UI

## Metadata
- **Module:** words
- **Task ID:** M11-8
- **Priority Score:** 36 / 50 (A-Tier)
- **Scoring Breakdown:** Market 4 x3 + Switching 3 x3 + Complexity 3 x2 + CrossModule 2 x1 + PaidUser 3 x1
- **Sprint:** Sprint 2
- **Estimated CC Time:** 6-8 hours
- **Depends On:** All V1-V4 CRUD, service layer, flash bridge, offline cache, and FTS search already implemented
- **Blocks:** Words web UI, flash module cross-module bridge, offline-first dictionary experience

## Business Context

### Why This Spec Exists
MyWords has 30+ exported functions across 4 schema versions covering dictionary lookup in 270 languages, saved words with mastery tracking, word lists, flashcard bridge to MyFlash, offline lookup cache with LRU eviction, and FTS5 full-text search with advanced filters. The mobile UI is a single 443-line placeholder screen that crams lookup + results into one ScrollView with no navigation to saved words, word lists, word helper, language browser, or settings. The module is a lookup toy, not a vocabulary learning tool. This spec designs the full mobile experience: 5 tabs and 4 stack screens that surface every feature the backend already supports.

### Competitor Landscape (Mobile UX)

| Competitor | Screen Count | Navigation Pattern | Standout UX |
|-----------|-------------|-------------------|-------------|
| Merriam-Webster | ~8 | Tab bar (Search, Word of Day, Games, Saved) | Beautiful word cards, audio pronunciation, etymology timeline |
| Dictionary.com | ~10 | Tab bar (Define, Translate, Games, Word of Day) | Voice search, synonym swiper, reading level tags |
| WordReference | ~6 | Minimal stack, language pair picker | Side-by-side translations, forum integration |
| Google Translate | ~4 | Single-screen with history drawer | Camera/voice input, conversation mode, phrasebook |
| Vocabulary.com | ~8 | Tab bar (Dictionary, Lists, Progress, Spelling Bee) | Adaptive quiz, mastery meter, vocabulary challenge |

### MyWords Differentiators
- **Privacy-first:** All saved words and lookup cache stored locally in SQLite. No accounts, no cloud sync, no telemetry.
- **270 language support:** More languages than any competitor dictionary app, powered by Wiktionary-backed Free Dictionary API.
- **Multi-provider enrichment:** Definitions + thesaurus + etymology + rhymes + contextual word replacement from 3 APIs (Free Dictionary, Datamuse, Wiktionary), merged and deduplicated.
- **Flash bridge:** One-tap flashcard creation from any saved word, with automatic front/back content generation and bulk export to MyFlash decks.
- **Offline fallback:** Transparent API -> cache -> saved words fallback chain. Previously looked-up words work without internet.
- **Word Helper:** Paste a sentence, select a word, get contextually-ranked replacement suggestions with the full sentence rewritten.

### Target User
Language learners, writers, and word enthusiasts who currently bounce between 3-4 apps (dictionary, thesaurus, flashcards, vocabulary tracker). The switching trigger is encountering an unfamiliar word while reading: look it up, save it, study it later as a flashcard. MyWords collapses that entire workflow into one module that lives alongside their budget, books, and health tracking.

## Technical Context

### Where This Lives in MyLife

```
apps/mobile/app/(words)/
  _layout.tsx                    -- Tabs navigator (5 tabs) + hidden stack screens
  index.tsx                      -- Tab 1: Lookup / Search (complete rewrite)
  helper.tsx                     -- Tab 2: Word Helper (new)
  languages.tsx                  -- Tab 3: Language Browser (new)
  saved.tsx                      -- Tab 4: Saved Words (new)
  settings.tsx                   -- Tab 5: Settings (new)
  word/[word].tsx                -- Stack: Word Detail (full lookup result)
  saved/[id].tsx                 -- Stack: Saved Word Detail (notes, mastery, flash bridge)
  list/index.tsx                 -- Stack: Word Lists Manager
  list/[id].tsx                  -- Stack: Word List Detail (words in list)
```

### Wireframe Position

```
Hub Dashboard
  |-- MyWords card
       |-- (words) tab navigator
            |-- Lookup tab (index.tsx)
            |     |-- Search bar with language selector
            |     |-- Recent lookups (from cache/saved)
            |     |-- Type-ahead suggestions
            |     |-- [search] -> Word Detail (word/[word].tsx)
            |
            |-- Word Helper tab (helper.tsx)
            |     |-- Sentence input
            |     |-- Tap-to-select word highlighting
            |     |-- Replacement suggestions ranked by relevance
            |     |-- One-tap sentence rewrite preview
            |
            |-- Languages tab (languages.tsx)
            |     |-- Language list (270+) with word counts
            |     |-- Set default language
            |     |-- Alphabetical browse (English only)
            |
            |-- Saved tab (saved.tsx)
            |     |-- Saved words list (sort/filter/search)
            |     |-- Quick filters: favorites, mastery level
            |     |-- [tap] -> Saved Word Detail (saved/[id].tsx)
            |     |-- [lists icon] -> Word Lists Manager (list/index.tsx)
            |
            |-- Settings tab (settings.tsx)
                  |-- Default language
                  |-- Flash bridge toggle + deck name
                  |-- Offline cache stats + clear
                  |-- Search history controls
```

### Data Model Summary

4 tables across 4 schema versions:

| Table | Key Fields | Version |
|-------|-----------|---------|
| `wd_word_lists` | name, description, language_code, sort_order | V1 |
| `wd_saved_words` | word, language_code, definition_summary, mastery_level, is_favorite, flash_card_id | V1+V2 |
| `wd_lookup_cache` | word, language_code, lookup_data, data_size_bytes, access_count | V3 |
| `wd_saved_words_fts` | word, definition_summary, notes (FTS5 virtual) | V4 |

### Dependencies
- **Internal:** `@mylife/words` (service layer, all CRUD functions, flash bridge, offline, search), `@mylife/ui` (Cool Obsidian tokens, Card, Text), `@mylife/db` (database provider)
- **External:** `expo-router` (tabs + stack), `expo-haptics` (save/favorite feedback), `expo-clipboard` (copy word/definition)
- **Cross-Module:** `@mylife/flash` (flash bridge: deck lookup, card creation). Optional dependency; flash bridge features gracefully degrade if flash module is not enabled.

## Screen Designs

### Tab Bar Configuration

| Tab | Label | Icon | Accent |
|-----|-------|------|--------|
| Lookup | Lookup | `search` | `#0EA5E9` (module sky blue) |
| Helper | Helper | `sparkles` | `#0EA5E9` |
| Languages | Languages | `globe` | `#0EA5E9` |
| Saved | Saved | `bookmark` | `#0EA5E9` |
| Settings | Settings | `settings` | `#0EA5E9` |

---

### Screen 1: Lookup Tab (`index.tsx`)

**Purpose:** Primary dictionary interface. Type a word, pick a language, get results. The screen users open most frequently. Replaces the current 443-line monolithic placeholder.

**Layout:**
```
[ScrollView]
  Search Bar (prominent, top-anchored)
    - TextInput with search icon prefix
    - Language pill selector below (horizontal scroll)
      - Top 8 languages shown as pills
      - Selected = module sky blue fill
      - "All 270+" pill at end -> languages tab
    - Submit on Enter or tap search icon
    - Type-ahead dropdown (from getCachePrefixMatches)
      - Shows up to 8 cached/saved word matches as user types
      - Each row: word + language badge
      - Tap row to look up immediately

  Recent Lookups (default state when no search active)
    - Section heading: "Recent" (subheading, 18px/600)
    - Last 10 looked-up words from cache, sorted by last_accessed_at DESC
    - Each row: word (body), language badge (caption), part of speech (caption, textSecondary)
    - Tap -> word/[word].tsx with cached result
    - "Clear History" link at bottom

  Search Results (replaces Recent when search is active)
    - Inline result card (not a separate screen for simple lookups)
    - Word heading (24px/700) + language + pronunciation
    - First 2 definitions shown inline (collapsed)
    - "View Full Entry" button -> word/[word].tsx
    - Save button (bookmark icon, toggles saved state)
    - If not found: "No entry found" message with suggestion to try another language

  Word of the Day (bottom, optional delight feature)
    - Glass card with a random word from saved/cache
    - Rotates daily based on date seed
    - "Look it up" CTA
```

**Engine Functions Used:**
- `lookupWord({ languageCode, word })` -- primary lookup
- `lookupWordWithFallback(db, input, isOnline)` -- offline-aware lookup
- `getCachePrefixMatches(db, prefix, languageCode, 8)` -- type-ahead suggestions
- `getMyWordsLanguages()` -- language list for pill selector
- `getSavedWordByWordAndLang(db, word, lang)` -- check saved state for save toggle
- `saveWord(db, id, input)` -- quick save from results
- `incrementLookupCount(db, id, result)` -- track re-lookups

**States:**

| State | What User Sees |
|-------|---------------|
| Loading | Skeleton search bar + shimmer rows |
| Empty (first open) | Search bar + "Look up any word in 270+ languages" prompt + suggested starter words |
| Has recent lookups | Search bar + recent lookup rows |
| Searching | Search bar + loading indicator below |
| Results found | Inline result card with save button |
| Not found | "No entry found" card with language suggestion |
| Offline, cached | Result card with "Cached result" badge |
| Offline, not cached | "You're offline and this word isn't cached" message |
| Type-ahead active | Dropdown overlay with cached/saved matches |

---

### Screen 2: Word Detail (`word/[word].tsx`)

**Purpose:** Full dictionary entry with every piece of data the multi-provider lookup returns. The deep-dive screen for word enthusiasts. Reached from lookup results, saved words, recent history, or tapping related words.

**Route params:** `word` (the lookup word), `lang` (language code, default 'en'), `cachedResult` (optional serialized result to avoid re-fetch)

**Layout:**
```
[ScrollView]
  Word Header
    - Word (heroTitle, 32px/800)
    - Language name + code badge (body, textSecondary)
    - Pronunciation row: IPA text + audio icon (future) + type tags
    - Word forms row: plural, past tense, etc. as pills
    - Save button (top right, bookmark icon, filled if saved)
    - Share button (top right, copy word + definition to clipboard)

  Definitions Section (grouped by part of speech)
    - Part of speech header (label, module sky blue, e.g., "noun")
    - Numbered definitions with:
      - Definition text (body)
      - Usage tags as tiny pills (e.g., "informal", "archaic")
      - Examples in italics (caption, textSecondary)
      - Quotes with attribution (caption, textTertiary)
      - Per-sense synonyms (inline, tappable -> new lookup)
      - Per-sense antonyms (inline, tappable)
      - Subsenses indented (recursive rendering, existing pattern)

  Thesaurus Section (full-width glass card)
    - Two columns: Synonyms | Antonyms
    - Each word as a tappable chip (glass.strong background)
    - Tap chip -> new lookup for that word
    - "X synonyms" / "X antonyms" count in section header

  Etymology Section (conditional, English only)
    - "Word History" heading
    - History paragraphs from Wiktionary
    - Chronology timeline: markers as horizontal pills (e.g., "14th century", "1823")
    - First Known Use callout (glass card, single line)
    - "Did You Know?" callout (glass card, interesting fact)

  Word Family Section (conditional)
    - Related words as tappable chips (glass background)
    - Organized by relationship: forms, derivatives, related

  Rhymes Section (conditional, English only)
    - Rhyming words as tappable chips
    - Up to 24 shown, sorted by relevance

  Nearby Words Section (conditional)
    - Similar words from Wiktionary
    - Tappable chips for quick cross-reference

  Sources Footer
    - Attribution cards for each provider used
    - Provider name + license text (caption, textTertiary)
```

**Engine Functions Used:**
- `lookupWord({ languageCode, word })` -- full lookup (if not passed cached result)
- `lookupWordWithFallback(db, input, isOnline)` -- offline-aware variant
- `saveWord(db, id, input)` / `unsaveWord(db, id)` -- save/unsave toggle
- `getSavedWordByWordAndLang(db, word, lang)` -- check if already saved
- `incrementLookupCount(db, id, result)` -- track lookup frequency

**States:**

| State | What User Sees |
|-------|---------------|
| Loading | Skeleton: word header shimmer + 3 definition block shimmers |
| Full result | All sections populated based on available data |
| Minimal result (non-English) | Definitions only, no etymology/rhymes/word family |
| Not found | "No entry found" with back button |
| Offline cached | Full result with "Cached" badge in header |
| Saved | Bookmark icon filled, "Saved" badge visible |

---

### Screen 3: Word Helper Tab (`helper.tsx`)

**Purpose:** Contextual word replacement tool. Paste a sentence, select a word, get ranked synonym suggestions with the full sentence rewritten. For writers looking for the right word.

**Layout:**
```
[ScrollView]
  Hero Section
    - "Word Helper" (subheading, 18px/600)
    - "Find the perfect word for your sentence" (caption, textSecondary)

  Sentence Input (full-width glass card)
    - Multi-line TextInput (3-4 lines visible)
    - Placeholder: "Paste or type a sentence..."
    - Character count (bottom right, caption)
    - Clear button (X icon, top right)

  Word Selector (visible after sentence is entered)
    - "Tap a word to find replacements:" (label, textSecondary)
    - Sentence rendered as tappable word chips
    - Each word = Pressable with glass background
    - Selected word = module sky blue background + white text
    - Non-word characters (punctuation, spaces) rendered inline but not tappable

  Language Selector (compact, below word chips)
    - Current language pill (e.g., "English")
    - Tap to cycle through recent languages

  Results Section (appears after selecting a word)
    - "Replacements for '{word}'" heading
    - Relevance tier sections:
      - High relevance (green dot): contextually best fits
      - Medium relevance (amber dot): good alternatives
      - Related (gray dot): broader suggestions
    - Each suggestion row:
      - Replacement word (body, bold)
      - Relevance dot + score indicator
      - Preview sentence with replacement highlighted (caption, textSecondary)
      - Tap row -> copy rewritten sentence to clipboard + haptic
    - "No replacements found" if empty

  Attribution Footer
    - Provider badges for APIs used in this suggestion
```

**Engine Functions Used:**
- `suggestWordReplacements({ languageCode, sentence, targetWord, maxSuggestions })` -- main word helper
- `lookupWord({ languageCode, word: targetWord })` -- used internally by suggestWordReplacements

**States:**

| State | What User Sees |
|-------|---------------|
| Empty | Sentence input + instructional text |
| Sentence entered | Word chips rendered, "Tap a word" prompt |
| Word selected, loading | Selected word highlighted, spinner below |
| Results found | Tiered suggestion list with sentence previews |
| No results | "No replacements found for '{word}'" message |
| Non-English warning | Results + "Context ranking is strongest for English" note |
| Offline | "Word Helper requires an internet connection" message |

---

### Screen 4: Languages Tab (`languages.tsx`)

**Purpose:** Browse all 270+ supported languages. Set default language for lookups. English-only alphabetical word browsing.

**Layout:**
```
[SectionList]
  Search Bar (filters language list)
    - TextInput with filter icon
    - Filters by language name or code

  Default Language Card (top, full-width glass card)
    - "Default Language" label
    - Current default: flag emoji + name + code (e.g., "English (EN)")
    - Word count: "1,343,902 words"
    - [Change] button -> scrolls to that language in list

  Language List (sorted by word count DESC)
    - Each row:
      - Language name (body) + code badge (caption pill)
      - Word count (caption, textSecondary, right-aligned)
      - Checkmark if this is the default
      - [tap] -> set as default language (with haptic)
    - Sections: A-Z alphabetical headers

  Alphabetical Browse Section (English only, bottom)
    - "Browse English Dictionary" heading
    - A-Z letter grid (6 columns)
    - Each letter = glass card with letter (heading, module sky blue)
    - [tap] -> modal/bottom sheet with paginated word list
      - browseWordsAlphabetically({ languageCode: 'en', letter, page, pageSize: 60 })
      - Infinite scroll pagination
      - Each word tappable -> lookup tab with that word
    - "Only English supports alphabetical browsing" (caption, textTertiary)
```

**Engine Functions Used:**
- `getMyWordsLanguages()` -- full language list with word counts
- `browseWordsAlphabetically({ languageCode, letter, page, pageSize })` -- A-Z word browse
- `getSavedWordCountByLanguage(db)` -- saved count per language (for badge)

**States:**

| State | What User Sees |
|-------|---------------|
| Loading | Skeleton list |
| Loaded | Language list with word counts, default highlighted |
| Search active | Filtered list |
| No search match | "No languages match '{query}'" |
| Browse open | Bottom sheet with paginated English words for selected letter |
| Browse loading | Skeleton rows in bottom sheet |

---

### Screen 5: Saved Words Tab (`saved.tsx`)

**Purpose:** Central vocabulary manager. Browse, search, filter, and organize saved words. Entry point for word lists and flashcard bridge.

**Layout:**
```
[FlatList with sticky header]
  Stats Bar (sticky, glass background)
    - Total saved count (stat, 20px/700)
    - Favorites count (heart icon + count)
    - Lists count (folder icon + count) -> list/index.tsx
    - Flash cards count (zap icon + count, words with flash_card_id)

  Search + Filter Bar
    - TextInput with search icon (FTS5-powered)
    - Sort picker: Recent | A-Z | Most Looked Up | Mastery
    - Filter chips row (horizontal scroll):
      - All | Favorites | [Language chips from saved words] | [List chips]
      - Mastery level chips: 0-1 (New) | 2-3 (Learning) | 4-5 (Known)

  Saved Word Rows
    - Each row (Pressable -> saved/[id].tsx):
      - Word (body, bold) + language badge (caption pill)
      - Definition summary (caption, textSecondary, 1 line, ellipsized)
      - Part of speech pill (tiny, glass background)
      - Bottom row: mastery dots (0-5, filled/empty) + favorite heart + flash icon
      - Swipe left: delete (danger)
      - Swipe right: toggle favorite (amber)
    - Infinite scroll pagination (limit 50 per page)

  FAB Actions (bottom right)
    - Primary: "+" save new word (opens lookup tab with focus on search)
    - Secondary (on long press): "Create List" -> list/index.tsx

  Empty State
    - Illustration + "Save words from the Lookup tab"
    - "Words you save appear here with definitions, notes, and mastery tracking"
    - "Start looking up words" CTA -> lookup tab
```

**Engine Functions Used:**
- `getSavedWords(db, { sortBy, languageCode, listId, favoritesOnly, search, limit, offset })` -- main list query
- `advancedSearchSavedWords(db, filters)` -- FTS5-powered search with advanced filters
- `searchSavedWordsFts(db, query, limit, offset)` -- direct FTS5 search
- `getSavedWordCount(db)` -- total count
- `getSavedWordCountByLanguage(db)` -- per-language counts for filter chips
- `getDistinctPartsOfSpeech(db)` -- POS filter options
- `getWordLists(db)` -- list names for filter chips
- `updateSavedWord(db, id, { isFavorite })` -- swipe favorite toggle
- `unsaveWord(db, id)` -- swipe delete

**States:**

| State | What User Sees |
|-------|---------------|
| Loading | Skeleton stats bar + shimmer rows |
| Empty | Illustration + CTA to start saving words |
| Has words | Stats bar + scrollable word list |
| Search active | FTS5 results (highlighted matches) |
| Search empty | "No saved words match '{query}'" |
| Filtered | Filter chips active, filtered list |
| Filtered empty | Active filters shown + "No words match these filters" |

---

### Screen 6: Saved Word Detail (`saved/[id].tsx`)

**Purpose:** Deep view of a saved word with editing, notes, mastery tracking, and flash bridge controls.

**Layout:**
```
[ScrollView]
  Word Header
    - Word (heroTitle, 28px/800) + pronunciation (body, textSecondary)
    - Language name + code badge
    - Part of speech pill
    - Favorite toggle (heart icon, top right)
    - More menu (top right): Delete, Move to List

  Definition Card (glass card)
    - Definition summary (body)
    - If full lookupData stored: "View Full Entry" link -> word/[word].tsx
    - Tap to expand full definition if lookupData available

  Mastery Tracker (glass card)
    - "Mastery Level" heading
    - 5 large tappable dots (empty = gray, filled = module sky blue)
    - Current level label: "New" (0) | "Seen" (1) | "Familiar" (2) | "Learning" (3) | "Confident" (4) | "Mastered" (5)
    - Tap any dot to set mastery level
    - Haptic on level change

  Stats Row (compact)
    - "Looked up X times" + "Last: 3 days ago"
    - "Saved: Jan 15, 2026"

  Notes Section (editable)
    - "Notes" heading with edit icon
    - Multi-line TextInput (3 lines default, expandable)
    - Auto-save on blur (300ms debounce)
    - Placeholder: "Add notes about this word..."

  Word List Assignment (glass card)
    - "In list:" + list name pill (or "No list")
    - Tap to open list picker bottom sheet
    - List picker: all lists + "No list" option + "Create New" at bottom

  Flash Bridge Section (glass card, conditional on flash module enabled)
    - If no flash card: "Create Flashcard" button
      - Creates card with buildFlashcardContent(): front = word + pronunciation + POS, back = definition + examples
      - Auto-assigns to "Words: Vocabulary" deck (getOrCreateVocabularyDeck)
    - If flash card exists: "Flashcard Created" badge with green checkmark
      - "View in MyFlash" link (cross-module navigation)
    - If flash module not enabled: section hidden entirely

  Danger Zone
    - "Remove from Saved" button (danger outline style)
    - Confirmation dialog before delete
```

**Engine Functions Used:**
- `getSavedWord(db, id)` -- load saved word
- `updateSavedWord(db, id, { notes, masteryLevel, isFavorite, listId })` -- edit fields
- `unsaveWord(db, id)` -- delete
- `getWordLists(db)` -- list picker options
- `createFlashcardFromWord(db, savedWordId, deckId, deps)` -- flash bridge
- `getOrCreateVocabularyDeck(db, deps)` -- get/create deck
- `checkFlashCardExists(db, savedWordId, deps)` -- verify flash card status
- `buildFlashcardContent(savedWord)` -- preview flash card content

**States:**

| State | What User Sees |
|-------|---------------|
| Loading | Skeleton header + definition card |
| Loaded | Full saved word detail |
| Editing notes | TextInput focused, keyboard visible |
| Mastery changed | Updated dots + haptic feedback |
| Flash card created | Success badge with checkmark |
| Flash module disabled | Flash section hidden |
| Delete confirmation | Dialog: "Remove '{word}' from saved words?" |

---

### Screen 7: Word Lists Manager (`list/index.tsx`)

**Purpose:** Create and manage word lists for organizing vocabulary by topic, language, or study goal.

**Layout:**
```
[FlatList]
  Header
    - "Word Lists" (subheading, 18px/600)
    - List count subtitle

  List Cards (sortable by sort_order)
    - Each card (Pressable -> list/[id].tsx):
      - List name (body, bold)
      - Description (caption, textSecondary, 1 line)
      - Language badge (if language-specific list)
      - Word count in list (right-aligned, caption)
      - Drag handle for reordering (left edge)
    - Swipe left: delete (with confirmation)
    - Swipe right: edit name/description

  "Uncategorized" Virtual Row (always at bottom)
    - Shows count of saved words with no list assigned
    - Tap -> saved.tsx filtered to listId=null

  FAB (+) -> Create List Bottom Sheet
    - Name input (required)
    - Description input (optional)
    - Language filter (optional, narrows which saved words can be added)
    - [Create] button

  Empty State
    - "No word lists yet"
    - "Create lists to organize words by topic, language, or study goal"
    - [Create Your First List] CTA
```

**Engine Functions Used:**
- `getWordLists(db)` -- all lists sorted by sort_order
- `createWordList(db, id, { name, description, languageCode })` -- create
- `updateWordList(db, id, { name, description, sortOrder })` -- rename/reorder
- `deleteWordList(db, id)` -- delete (saved words become uncategorized)
- `getSavedWords(db, { listId })` -- word count per list
- `getSavedWords(db, { listId: undefined })` -- uncategorized count

**States:**

| State | What User Sees |
|-------|---------------|
| Loading | Skeleton cards |
| Empty | Illustration + CTA |
| Has lists | Sortable list cards + uncategorized row |
| Creating | Bottom sheet with form |
| Deleting | Confirmation dialog: "Delete '{name}'? Words in this list will become uncategorized." |

---

### Screen 8: Word List Detail (`list/[id].tsx`)

**Purpose:** View and manage words in a specific list. Bulk operations for flashcard creation and list management.

**Layout:**
```
[FlatList with sticky header]
  List Header
    - List name (subheading, 20px/700), editable on tap
    - Description (body, textSecondary), editable on tap
    - Language badge (if set)
    - Word count + "X with flashcards" stats
    - Edit button (pencil icon) -> inline edit mode

  Bulk Action Bar (visible when words exist)
    - "Create All Flashcards" button (zap icon)
      - bulkCreateFlashcards for all words in list without flash_card_id
      - Progress indicator during bulk operation
    - "Export List" button (share icon, future)

  Word Rows (same style as saved.tsx rows)
    - Each row (Pressable -> saved/[id].tsx):
      - Word + language badge + POS pill
      - Definition summary (1 line)
      - Mastery dots + favorite heart + flash icon
    - Swipe left: remove from list (sets listId = null, does not delete word)

  Empty State
    - "No words in this list"
    - "Save words from Lookup and assign them to this list"
    - [Go to Lookup] CTA
```

**Engine Functions Used:**
- `getWordList(db, id)` -- list metadata
- `getSavedWords(db, { listId: id, sortBy, limit, offset })` -- words in list
- `updateWordList(db, id, { name, description })` -- edit list
- `updateSavedWord(db, wordId, { listId: null })` -- remove word from list
- `bulkCreateFlashcards(db, savedWordIds, deckId, deps)` -- bulk flash bridge
- `getOrCreateVocabularyDeck(db, deps)` -- deck for bulk creation
- `deleteWordList(db, id)` -- delete list (from more menu)

**States:**

| State | What User Sees |
|-------|---------------|
| Loading | Skeleton header + rows |
| Has words | Header + word rows + bulk actions |
| Empty | Header + illustration + CTA |
| Bulk creating | Progress bar: "Creating flashcards... 15/23" |
| Bulk complete | Success toast: "Created 18 flashcards, skipped 5 existing" |

---

### Screen 9: Settings Tab (`settings.tsx`)

**Purpose:** Module configuration. Default language, flash bridge settings, offline cache management, and data controls.

**Layout:**
```
[ScrollView]
  Default Language Section (glass card)
    - "Default Language" heading
    - Current: language name + code (tappable -> languages tab)
    - "Used for all new lookups unless you change it"

  Flash Bridge Section (glass card, conditional)
    - "Flashcard Integration" heading
    - Toggle: "Auto-create flashcards when saving words" (future feature placeholder)
    - Deck name display: "Words: Vocabulary"
    - Stats: "X words have flashcards" / "Y words without"
    - "Create Missing Flashcards" button (bulk operation)
    - If flash module not enabled: "Enable MyFlash to create vocabulary flashcards" message

  Offline Cache Section (glass card)
    - "Offline Cache" heading
    - Stats: "X words cached" + "Y MB used" (from getCacheStats)
    - Cache limit display: "50 MB max (LRU eviction)"
    - "Clear Cache" button (danger outline)
      - Confirmation: "Clear all cached lookups? Saved words are not affected."
    - "Remove Stale Entries" button (outline)
      - Removes entries not accessed in 30 days

  Search Section (glass card)
    - "Full-Text Search" heading
    - FTS5 index status: "Indexed X words"
    - "Rebuild Index" button (for troubleshooting)

  Data Section (glass card)
    - Saved words count
    - Word lists count
    - "Export Saved Words" button (future: CSV/JSON export)

  About Section
    - Module version: "MyWords v0.2.0"
    - API providers: Free Dictionary, Datamuse, Wiktionary
    - Attribution links
```

**Engine Functions Used:**
- `getMyWordsLanguages()` -- current default language display
- `getCacheStats(db)` -- cache word count and size
- `clearCache(db)` -- clear all cached lookups
- `evictStaleEntries(db, 30)` -- remove stale entries
- `getSavedWordCount(db)` -- total saved count
- `getSavedWordCountByLanguage(db)` -- per-language stats
- `getWordLists(db)` -- list count
- `bulkCreateFlashcards(db, ids, deckId, deps)` -- bulk flash creation

**States:**

| State | What User Sees |
|-------|---------------|
| Loaded | All sections with current stats |
| Cache clearing | Spinner on clear button, then updated stats |
| Bulk flash creating | Progress bar |
| Flash module disabled | Flash section shows enable prompt |

## Data Hooks

Custom hooks to share state across screens and avoid prop drilling:

| Hook | Purpose | Used By |
|------|---------|---------|
| `useWordsLookup()` | Manages lookup state (query, language, result, loading, error). Wraps `lookupWordWithFallback` with online detection. Returns `{ lookup, setQuery, setLanguage, languages, result, loading, error }` | Lookup tab, Word Detail |
| `useWordsSaved(options?)` | Paginated saved words list with sort/filter. Wraps `getSavedWords` + `advancedSearchSavedWords`. Returns `{ words, loading, refresh, hasMore, loadMore, totalCount }` | Saved tab, List Detail |
| `useWordsLists()` | All word lists with word counts. Wraps `getWordLists` + per-list count query. Returns `{ lists, loading, refresh, create, update, remove }` | Saved tab, Lists Manager, Saved Word Detail (list picker) |
| `useFlashBridge(savedWordId?)` | Flash bridge state for a single word. Wraps `checkFlashCardExists` + `createFlashcardFromWord`. Returns `{ hasCard, creating, createCard, flashEnabled }` | Saved Word Detail |

## Acceptance Criteria

1. **5-tab navigation** matches definition.ts tabs (lookup, helper, languages, saved, settings) with correct icons and labels
2. **Lookup tab** performs dictionary lookups via `lookupWord` with language selection and type-ahead from cache
3. **Word Detail screen** displays all fields from `MyWordsLookupResult`: definitions grouped by POS, pronunciation, forms, synonyms, antonyms, etymology, chronology, first known use, did you know, rhymes, word family, nearby words, and attributions
4. **Word Helper tab** accepts sentence input, renders words as tappable chips, calls `suggestWordReplacements`, and displays ranked results with rewritten sentence previews
5. **Languages tab** lists 270+ languages from `getMyWordsLanguages`, supports search filtering, allows setting default language, and provides English A-Z browse via `browseWordsAlphabetically`
6. **Saved tab** lists saved words with sort (recent/alpha/lookup count/mastery), filter (language/list/favorites/mastery), and FTS5 search, with swipe actions for favorite/delete
7. **Saved Word Detail** shows full saved word data with editable notes, tappable mastery dots (0-5), word list assignment picker, and flash bridge create/status
8. **Word Lists Manager** supports CRUD for lists with drag reorder, word count per list, and uncategorized virtual row
9. **Word List Detail** shows words in a list with bulk flashcard creation via `bulkCreateFlashcards`
10. **Settings tab** shows default language, cache stats from `getCacheStats`, clear cache, stale eviction, flash bridge bulk creation, and module info
11. **All 5 states** (loading/empty/error/success/partial) handled per screen with Cool Obsidian theming
12. **Offline fallback** chain (API -> cache -> saved words) transparent to user with source badges

## Test Criteria

1. Lookup tab returns results for English and at least 3 non-English languages
2. Type-ahead shows cached/saved word suggestions within 100ms
3. Word Detail renders all sections conditionally (etymology only for English, rhymes only when present)
4. Word Helper correctly identifies target word in sentence and returns ranked replacements
5. Saved words list pagination loads 50 items per page with infinite scroll
6. FTS5 search returns results matching word, definition_summary, or notes
7. Mastery level updates persist after navigating away and returning

## Non-Functional Criteria

1. Lookup latency under 2s for API calls (with loading state shown immediately)
2. Type-ahead debounced to 150ms to avoid excessive cache queries
3. Saved words list renders 500+ items without frame drops (FlatList virtualization)
4. Cache eviction runs in background after each lookup without blocking UI
5. Flash bridge operations show progress for bulk actions (>5 words)

## QA Script

1. Open MyWords from hub dashboard
2. Verify 5 tabs visible: Lookup, Helper, Languages, Saved, Settings
3. **Lookup tab:**
   - Type "ephemeral" in search bar
   - Verify language pills shown (English selected by default)
   - Submit search, verify inline result with definition
   - Tap "View Full Entry" -> verify Word Detail screen
   - Navigate back, verify "ephemeral" appears in Recent section
   - Type "eph" -> verify type-ahead dropdown shows "ephemeral"
4. **Word Detail:**
   - Verify word header with pronunciation
   - Verify definitions grouped by part of speech (adjective for "ephemeral")
   - Verify synonyms section (transient, fleeting, etc.)
   - Verify etymology section with word history
   - Tap a synonym chip -> verify new lookup for that word
   - Tap save button -> verify bookmark fills
5. **Word Helper:**
   - Paste "The weather was very nice today"
   - Verify words rendered as tappable chips
   - Tap "nice" -> verify replacement suggestions load
   - Verify suggestions ranked by relevance (pleasant, lovely, etc.)
   - Verify rewritten sentence previews shown
   - Tap a suggestion -> verify clipboard copy + haptic
6. **Languages tab:**
   - Verify 270+ languages listed with word counts
   - Type "span" in search -> verify "Spanish" filters
   - Tap Spanish -> verify default language changes
   - Scroll to English A-Z browse section
   - Tap "A" -> verify paginated word list opens
   - Tap a word from list -> verify lookup happens
7. **Saved tab:**
   - Verify saved word from step 4 appears
   - Toggle sort to "A-Z" -> verify alphabetical order
   - Tap favorites filter -> verify filtered (empty if none favorited)
   - Swipe right on a word -> verify favorite toggle
   - Search "ephemeral" -> verify FTS5 result
   - Tap lists icon -> verify Word Lists Manager opens
8. **Word Lists Manager:**
   - Tap FAB -> create "GRE Vocabulary" list
   - Verify list appears with 0 words count
   - Navigate to Saved tab, tap a word -> Saved Word Detail
   - Assign to "GRE Vocabulary" via list picker
   - Navigate back to Lists, verify count = 1
   - Tap list -> verify word appears in List Detail
9. **Saved Word Detail:**
   - Verify word header, definition, pronunciation
   - Tap mastery dot 3 -> verify level updates to "Learning"
   - Add note "This word came up in my reading" -> navigate away and back -> verify note persisted
   - If flash module enabled: tap "Create Flashcard" -> verify success badge
10. **Settings tab:**
    - Verify default language shown
    - Verify cache stats (should show at least 1 cached word)
    - Tap "Clear Cache" -> confirm -> verify stats reset to 0
    - Verify module version and attribution info
11. **Offline test:**
    - Enable airplane mode
    - Look up "ephemeral" (previously cached) -> verify cached result with badge
    - Look up "unprecedented" (not cached) -> verify offline message
    - Disable airplane mode, retry -> verify API result
