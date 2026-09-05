# Feature Spec: Saved Words Persistence

## Metadata
- **Module:** words
- **Priority Score:** 31 / 50 (A-Tier)
- **Scoring Breakdown:** Market [2] x3 + Switching [4] x3 + Complexity [5] x2 + CrossModule [2] x1 + PaidUser [1] x1
- **Sprint:** 5
- **Estimated CC Time:** 1-2 hours
- **Depends On:** none (words module already has lookup, word helper, and browse; this adds persistence layer)
- **Blocks:** Flashcard integration with Flash module (P2), offline fallback (P1, saved words provide local cache seed)

## Business Context

### Why This Feature Exists
Every dictionary app lets you save words. Dictionary.com and Merriam-Webster both offer word lists/favorites, and users expect their lookups to persist across sessions. Currently, MyWords uses only in-memory caching (5min TTL for lookups), so every word the user looks up is gone after they close the app. This is the #1 gap preventing MyWords from being a real vocabulary-building tool. The high Complexity score (5/5, Inverse = 5) reflects that this is straightforward CRUD with no tricky algorithms. The cross-module score (2) comes from the future Flash module integration: saved words become flashcard candidates, creating hub-level value that no standalone dictionary app offers.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Dictionary.com | Yes | Free (basic), Premium for lists | "Favorites" heart button on any word, organized into custom lists, synced to account. Premium adds unlimited lists and quiz mode. |
| Merriam-Webster | Yes | Free | "Save" button on word pages, "Saved Words" section in menu, sorted alphabetically. No organization beyond a flat list. |
| WordReference | No | N/A | No save/favorites feature. Users rely on browser bookmarks. Forum-based, not app-focused. |
| Google Translate | Yes | Free | "Saved" star icon, phrasebook feature. Cloud-synced via Google account. |

### Target User
Language learners (18-45) using MyWords to build vocabulary who want their lookups to persist. Students studying for GRE/SAT who look up 10-20 words daily and need to review them later. Writers who collect interesting words for future use. Bilingual users building vocabulary in a second language. Users switching from Dictionary.com who expect a "favorites" feature as table stakes. The switching motivation (4/5) reflects that saved words are standard in every competitor, and users migrating from Dictionary.com lose their word lists without this feature.

## Technical Context

### Where This Lives in MyLife

```
modules/words/src/
  types.ts                        -- New SavedWord, SavedWordList Zod schemas
  db/                             -- NEW directory
    schema.ts                     -- New wd_saved_words, wd_word_lists tables (migration V1)
    crud.ts                       -- CRUD for saved words and word lists
    index.ts                      -- DB barrel export
  definition.ts                   -- Add V1 migration, bump schemaVersion to 1
  index.ts                        -- Export new saved word functions and types
  service.ts                      -- Updated: auto-cache lookup results to SQLite for saved words

apps/mobile/app/(words)/
  saved.tsx                       -- Updated: real saved words list (currently placeholder)
  saved-word-detail.tsx           -- Updated: full word detail from local data
  lookup.tsx                      -- Updated: save/unsave button on lookup results

apps/web/app/words/
  page.tsx                        -- Updated: saved words section, save button on lookups
```

### Wireframe Position

```
Hub Dashboard
  └── MyWords card
       └── Lookup tab (search + results with save button)
       └── Saved tab ← saved words list, word lists, search/filter
            └── [Saved Word Detail] ← full cached lookup data
       └── Settings tab
```

### Data Model

```sql
-- Migration V1: Saved words and word lists
CREATE TABLE IF NOT EXISTS wd_word_lists (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,                          -- "GRE Vocab", "Spanish Verbs"
  description TEXT,
  language_code TEXT,                          -- optional filter: "en", "es", etc.
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS wd_saved_words (
  id TEXT PRIMARY KEY NOT NULL,
  word TEXT NOT NULL,                          -- the looked-up word
  language_code TEXT NOT NULL,                 -- "en", "es", etc.
  language_name TEXT NOT NULL,                 -- "English", "Spanish"
  list_id TEXT REFERENCES wd_word_lists(id) ON DELETE SET NULL,
  definition_summary TEXT,                     -- first definition, truncated for list display
  part_of_speech TEXT,                         -- first part of speech for quick display
  pronunciation_text TEXT,                     -- IPA or similar for quick display
  lookup_data TEXT,                            -- full MyWordsLookupResult as JSON (offline access)
  notes TEXT,                                  -- user's personal notes about the word
  mastery_level INTEGER NOT NULL DEFAULT 0,    -- 0-5 self-rated mastery (for Flash integration)
  is_favorite INTEGER NOT NULL DEFAULT 0,      -- starred for quick access
  looked_up_count INTEGER NOT NULL DEFAULT 1,  -- how many times the user looked this up
  last_looked_up_at TEXT NOT NULL,             -- last lookup timestamp
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_wd_saved_words_word_lang ON wd_saved_words(word, language_code);
CREATE INDEX IF NOT EXISTS idx_wd_saved_words_list ON wd_saved_words(list_id);
CREATE INDEX IF NOT EXISTS idx_wd_saved_words_language ON wd_saved_words(language_code);
CREATE INDEX IF NOT EXISTS idx_wd_saved_words_favorite ON wd_saved_words(is_favorite);
CREATE INDEX IF NOT EXISTS idx_wd_saved_words_mastery ON wd_saved_words(mastery_level);
CREATE INDEX IF NOT EXISTS idx_wd_saved_words_last_lookup ON wd_saved_words(last_looked_up_at DESC);
CREATE INDEX IF NOT EXISTS idx_wd_word_lists_sort ON wd_word_lists(sort_order);
```

### Dependencies
- **Internal:** `@mylife/words` (lookupWord for auto-populating saved word data), `@mylife/db` (DatabaseAdapter, migration orchestration)
- **External:** None. All data stored locally in SQLite.
- **Cross-Module:** Flash module (future P2 integration). Saved words with mastery_level provide a bridge for generating flashcards. The `lookup_data` JSON column stores the full lookup result so Flash can render definitions without re-fetching. Score: 2.

## Functional Requirements

### User Stories
1. As a language learner, I want to save words I look up so that I can review them later without searching again.
2. As a GRE student, I want to organize saved words into custom lists so that I can study topic-by-topic (e.g., "Week 1 Vocab", "Hard Words").
3. As a writer, I want to add personal notes to saved words so that I can record context for how I plan to use them.
4. As a bilingual user, I want to filter saved words by language so that I can focus on one language at a time.
5. As a returning user, I want to see how many times I've looked up a word so that I know which words I struggle with.
6. As a vocabulary builder, I want to rate my mastery of saved words (0-5) so that I can track my learning progress.

### Behavior Specification

**Saving a word:**
1. User looks up a word via the Lookup tab
2. Lookup result displays with a bookmark/save icon in the top-right
3. If the word is not yet saved: icon is outline (unsaved state)
4. User taps the save icon
5. System creates a `wd_saved_words` record with:
   - word, language_code, language_name from the lookup
   - definition_summary: first definition from entries[0].senses[0].definition, truncated to 200 chars
   - part_of_speech: first entry's partOfSpeech
   - pronunciation_text: first pronunciation's text (if available)
   - lookup_data: full MyWordsLookupResult serialized as JSON
   - looked_up_count: 1, last_looked_up_at: now
6. Save icon fills in (saved state) with a brief haptic confirmation
7. If the word is already saved: icon is filled, tapping un-saves (deletes the record)

**Re-looking up a saved word:**
1. User looks up a word that already exists in wd_saved_words
2. System increments looked_up_count and updates last_looked_up_at
3. System updates lookup_data with the fresh result (keeps data current)
4. Save icon shows as filled (already saved)

**Browsing saved words:**
1. User navigates to the Saved tab
2. Default view: all saved words sorted by last_looked_up_at DESC (most recently looked up first)
3. Each row shows: word, part of speech, truncated definition, language flag/code, favorite star
4. Sort options: recently looked up, alphabetical, most looked up, mastery level
5. Filter options: by language, by list, favorites only
6. Search bar: filters saved words by word text (local SQLite LIKE query)
7. Tap a word to open saved-word-detail screen

**Saved word detail:**
1. Shows the full cached lookup data (definitions, pronunciations, etymology, synonyms, antonyms, rhymes)
2. Personal notes section: editable text area for user's notes
3. Mastery level: 0-5 star rating the user can tap to set
4. Looked up count and last looked up date displayed
5. List assignment: dropdown to move word to a different list
6. "Look Up Again" button: re-fetches from API and updates cached data
7. Delete button: removes the saved word

**Word lists:**
1. User can create named word lists from the Saved tab ("+" button)
2. Each list has a name, optional description, and optional language filter
3. Words can be assigned to one list (or no list)
4. Lists displayed as tabs or filter chips at the top of the Saved tab
5. "All Words" shows everything; individual list tabs filter to that list
6. Lists can be renamed, reordered, or deleted (words move to "Uncategorized")

### Edge Cases

- **Saving a word that returns null from lookup:** Should not happen in normal flow (save button only appears on successful lookups). If attempted programmatically, reject with error.
- **Saving the same word in two languages:** The unique index is on (word, language_code), so "chat" in English and "chat" in French are separate saved words.
- **Very long lookup_data JSON:** Some words (like "set" or "run" with 50+ definitions) produce large JSON. Cap lookup_data at 100KB. If the result exceeds this, store a truncated version (limit entries to first 10, senses to first 5 per entry).
- **Deleting a word list with assigned words:** Words move to uncategorized (list_id set to NULL via ON DELETE SET NULL FK constraint).
- **Offline save attempt:** If the user previously looked up a word (cached in memory) and goes offline, the save should still work because we're writing to local SQLite. The lookup_data is captured from the cached result.
- **Module disabled:** Saved words persist in SQLite (data preserved per MyLife lifecycle contract). Re-enabling the module shows all previously saved words.
- **lookup_data format changes:** If the MyWordsLookupResult interface evolves, old saved lookup_data may have missing fields. The detail screen should gracefully handle missing fields (optional rendering).
- **Extremely large saved word collection:** Support 10,000+ saved words without performance degradation. Pagination via limit/offset. SQLite indexes on sort columns.
- **Duplicate save tap:** Debounce the save action. If the word is already being saved (pending write), ignore subsequent taps.
- **Mastery level used by Flash module:** The mastery_level field (0-5) is designed for future Flash integration. Words with mastery 0-2 would be prioritized for flashcard review. For now, it's user-facing self-assessment only.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Looking up a word shows a save/bookmark icon on the result screen
- [ ] **AC-2:** Tapping the save icon on an unsaved word fills the icon and persists the word to local storage
- [ ] **AC-3:** Tapping the save icon on a saved word unfills the icon and removes it from local storage
- [ ] **AC-4:** Saved tab shows all saved words with word, part of speech, definition preview, and language code
- [ ] **AC-5:** Saved words list can be sorted by: recently looked up, alphabetical, most looked up, mastery level
- [ ] **AC-6:** Saved words list can be filtered by language
- [ ] **AC-7:** Tapping a saved word opens a detail screen showing the full cached definition, synonyms, etymology
- [ ] **AC-8:** User can add and edit personal notes on a saved word
- [ ] **AC-9:** User can set a mastery level (0-5) on a saved word via star rating
- [ ] **AC-10:** User can create, rename, and delete custom word lists
- [ ] **AC-11:** User can assign a saved word to a word list
- [ ] **AC-12:** Looking up an already-saved word increments the lookup count and updates the cached data
- [ ] **AC-13:** Search bar in Saved tab filters words by text match

### Technical Criteria
- [ ] **TC-1:** `wd_saved_words` and `wd_word_lists` tables are created by migration V1 with all columns and indexes
- [ ] **TC-2:** Unique index on (word, language_code) prevents duplicate saves for the same word+language
- [ ] **TC-3:** `lookup_data` JSON column stores the complete MyWordsLookupResult for offline access
- [ ] **TC-4:** `lookup_data` is capped at 100KB; oversized results are truncated gracefully
- [ ] **TC-5:** Saved word CRUD operations complete in <50ms for collections of 10,000+ words
- [ ] **TC-6:** Re-looking up a saved word updates looked_up_count, last_looked_up_at, and lookup_data
- [ ] **TC-7:** Deleting a word list sets list_id to NULL on orphaned words (FK ON DELETE SET NULL)
- [ ] **TC-8:** Search uses SQLite LIKE with proper escaping of special characters

### Negative Criteria
- [ ] **NC-1:** Saving a word must NOT make any network calls (only SQLite writes)
- [ ] **NC-2:** Deleting a saved word must NOT affect lookup cache or API behavior
- [ ] **NC-3:** Word lists must NOT be shared or synced to any external service
- [ ] **NC-4:** The save/unsave action must NOT block the UI (async SQLite write)
- [ ] **NC-5:** lookup_data JSON must NOT include raw API responses or provider credentials

## UI Specification

### Mobile (Expo)

**Lookup Tab (updated):**
- Save icon: bookmark outline (unsaved) or filled bookmark (saved) in the top-right of the lookup result card
- Module accent: `#0EA5E9` (sky blue)
- Save icon color: `#0EA5E9` when saved, `rgba(240,240,245,0.65)` (textSecondary) when unsaved
- Brief haptic feedback on save/unsave (`Haptics.impactAsync(ImpactFeedbackStyle.Light)`)

**Saved Tab (updated from placeholder):**
- Background: `#0A0A0F`
- Header: "Saved Words" with count badge and "+" button for new list
- Filter chips row: "All Words", then user-created lists, scrollable horizontal
- Sort picker: icon button opening a bottom sheet with sort options
- Search bar: glass card input with magnifying glass icon
- Word rows: glass cards showing:
  - Word text (bold, `#F0F0F5`)
  - Part of speech (italic, `rgba(240,240,245,0.65)`)
  - Definition preview (truncated, `rgba(240,240,245,0.65)`)
  - Language code badge (e.g., "EN", "ES") in small chip
  - Favorite star (right-aligned)
  - Lookup count badge (if > 1)
- Swipe actions: swipe left to delete, swipe right to favorite

**Saved Word Detail Screen:**
- Full lookup data rendered in expandable sections: Definitions, Pronunciations, Etymology, Synonyms/Antonyms, Rhymes, Word Family
- Personal notes: editable text area with glass card background
- Mastery level: row of 5 stars, tappable, accent-colored when filled
- Metadata row: "Looked up 3 times, last on Mar 15"
- List assignment: dropdown/picker
- Action buttons: "Look Up Again" (re-fetch), "Delete" (with confirmation)

**Create/Edit List Modal:**
- Glass card modal with name input, optional description, optional language filter
- "Save" button in accent color

### Web (Next.js)

- Save icon on lookup results, same behavior as mobile
- Saved words section in the Words page sidebar or as a sub-route
- Same sort/filter/search functionality
- Word detail shown in a panel or dialog
- List management as a sidebar section
- Same tokens via CSS variables

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton cards in saved words list | Initial SQLite query |
| Empty | "No saved words yet. Look up a word and tap the bookmark to save it." + CTA to Lookup tab | No words in wd_saved_words |
| Success | List of saved word cards with sort/filter/search | Words exist in local storage |
| Error | "Couldn't load saved words" + retry button | SQLite read error (unlikely) |
| Empty List | "This list is empty. Assign words from your saved collection." | List exists but no words assigned |
| Search No Results | "No saved words match '[query]'" | Search query returns no matches |

## Test Requirements

### Unit Tests
- [ ] `saveWord(db, input)`: creates saved word record with all fields populated
- [ ] `saveWord(db, input)`: rejects duplicate (word, language_code) pair
- [ ] `unsaveWord(db, wordId)`: deletes record and returns true
- [ ] `unsaveWord(db, nonexistentId)`: returns false
- [ ] `getSavedWord(db, id)`: returns saved word with parsed lookup_data
- [ ] `getSavedWordByWordAndLang(db, word, languageCode)`: finds by unique index
- [ ] `getSavedWords(db, options)`: returns all words sorted by last_looked_up_at DESC by default
- [ ] `getSavedWords(db, { sortBy: 'alphabetical' })`: sorts by word ASC
- [ ] `getSavedWords(db, { sortBy: 'mostLookedUp' })`: sorts by looked_up_count DESC
- [ ] `getSavedWords(db, { sortBy: 'mastery' })`: sorts by mastery_level ASC
- [ ] `getSavedWords(db, { languageCode: 'es' })`: filters by language
- [ ] `getSavedWords(db, { listId })`: filters by word list
- [ ] `getSavedWords(db, { favoritesOnly: true })`: filters by is_favorite = 1
- [ ] `getSavedWords(db, { search: 'hap' })`: filters by LIKE '%hap%'
- [ ] `updateSavedWord(db, id, { notes })`: updates notes field
- [ ] `updateSavedWord(db, id, { masteryLevel: 3 })`: updates mastery_level
- [ ] `updateSavedWord(db, id, { isFavorite: true })`: sets is_favorite = 1
- [ ] `updateSavedWord(db, id, { listId })`: assigns word to a list
- [ ] `incrementLookupCount(db, id, newLookupData)`: increments count and updates lookup_data and last_looked_up_at
- [ ] `createWordList(db, input)`: creates list with name and description
- [ ] `getWordLists(db)`: returns all lists sorted by sort_order
- [ ] `updateWordList(db, id, input)`: updates name, description
- [ ] `deleteWordList(db, id)`: deletes list, orphaned words get list_id = NULL
- [ ] `getSavedWordCount(db)`: returns total count
- [ ] `getSavedWordCountByLanguage(db)`: returns counts grouped by language_code
- [ ] `truncateLookupData(data, maxBytes)`: truncates oversized lookup results gracefully

### Integration Tests
- [ ] Full save flow: lookup word -> save -> navigate to Saved tab -> verify word appears with correct data
- [ ] Re-lookup flow: save word -> look up same word again -> verify count incremented and data updated
- [ ] Unsave flow: save word -> unsave -> verify removed from Saved tab
- [ ] List flow: create list -> assign word -> filter by list -> verify word shown -> delete list -> verify word still exists with list_id = NULL
- [ ] Search flow: save 5 words -> search for partial match -> verify filtered results

### QA Verification Script
1. Open the app on iOS simulator
2. Navigate to Words > Lookup tab
3. Search for "serendipity"
4. Verify: lookup result shows with a bookmark icon -- corresponds to AC-1
5. Tap the bookmark icon
6. Verify: icon fills in, brief haptic feedback -- corresponds to AC-2
7. Navigate to Saved tab
8. Verify: "serendipity" appears with definition preview and "EN" badge -- corresponds to AC-4
9. Go back to Lookup, search "serendipity" again
10. Verify: bookmark icon already filled, lookup count will increment -- corresponds to AC-12
11. Search for "alegria" in Spanish
12. Tap save
13. Navigate to Saved tab
14. Tap the sort icon, select "Alphabetical"
15. Verify: "alegria" appears before "serendipity" -- corresponds to AC-5
16. Tap the language filter, select "English"
17. Verify: only "serendipity" shown -- corresponds to AC-6
18. Clear filter, tap "serendipity"
19. Verify: full detail screen with definitions, synonyms, etymology -- corresponds to AC-7
20. Type "Found this word in a novel" in the notes area
21. Verify: notes saved -- corresponds to AC-8
22. Tap 3 stars in mastery rating
23. Verify: 3 stars filled -- corresponds to AC-9
24. Tap the "+" button on Saved tab to create a list
25. Name it "GRE Vocab", tap Save
26. Verify: list appears as a filter chip -- corresponds to AC-10
27. Open "serendipity" detail, assign to "GRE Vocab" list
28. Verify: word now shows under "GRE Vocab" filter -- corresponds to AC-11
29. Type "ser" in the search bar on Saved tab
30. Verify: "serendipity" appears, "alegria" filtered out -- corresponds to AC-13
31. Tap the bookmark icon on "serendipity" in Lookup (to unsave)
32. Verify: icon unfills, word removed from Saved tab -- corresponds to AC-3

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to Saved tab, verify all 6 states render (loading, empty, success, error, empty list, search no results)
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Post-merge:
- [ ] `/parity-check` -- words module parity
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Words module is entirely stateless: in-memory LRU caching with no SQLite tables
- Module definition has no migrations, no schemaVersion
- Table prefix `wd_` is reserved but unused
- Saved tab exists in navigation but is a placeholder
- saved-word-detail screen exists in navigation but has no data source
- Lookup results have no save/bookmark button

### After This Work
- New V1 migration creates `wd_saved_words` and `wd_word_lists` tables
- Module definition updated with schemaVersion: 1 and migration array
- Full CRUD for saved words: save, unsave, get, list (with sort/filter/search), update (notes, mastery, favorite, list)
- Word list management: create, rename, delete
- Lookup tab shows save/unsave bookmark icon
- Saved tab shows real saved words with sort, filter, search
- Saved word detail shows full cached lookup data with notes and mastery rating
- lookup_data JSON column provides offline access to full definitions

### Files Changed
- `modules/words/src/types.ts` -- New Zod schemas: `SavedWordSchema`, `CreateSavedWordInputSchema`, `UpdateSavedWordInputSchema`, `WordListSchema`, `CreateWordListInputSchema`, `UpdateWordListInputSchema`, `SavedWordSortBy` enum
- `modules/words/src/db/schema.ts` -- NEW: V1 migration SQL for `wd_saved_words`, `wd_word_lists` tables and indexes
- `modules/words/src/db/crud.ts` -- NEW: all CRUD operations (saveWord, unsaveWord, getSavedWord, getSavedWords, updateSavedWord, incrementLookupCount, createWordList, getWordLists, updateWordList, deleteWordList, getSavedWordCount)
- `modules/words/src/db/index.ts` -- NEW: DB barrel export
- `modules/words/src/definition.ts` -- Add V1 migration, set schemaVersion: 1
- `modules/words/src/index.ts` -- Export new saved word and word list functions and types
- `modules/words/src/__tests__/saved-words.test.ts` -- NEW: unit tests for saved word CRUD
- `apps/mobile/app/(words)/lookup.tsx` -- Save/unsave bookmark icon on lookup results
- `apps/mobile/app/(words)/saved.tsx` -- Real saved words list with sort/filter/search
- `apps/mobile/app/(words)/saved-word-detail.tsx` -- Full detail screen with notes, mastery, list assignment
- `apps/web/app/words/page.tsx` -- Saved words section and save button on lookups

### Known Limitations
- **No cloud sync:** Saved words are local-only. If the user switches devices, they lose their saved words. Cloud sync is out of scope for MyLife's privacy-first model.
- **lookup_data can become stale:** If API providers update definitions, the cached JSON will be outdated. "Look Up Again" button re-fetches, but there's no automatic refresh.
- **Single list per word:** A word can belong to at most one list. Multi-list tagging could be added later with a junction table, but the simpler FK approach is sufficient for V1.
- **No export in V1:** Export of saved words (CSV, JSON) is not included. Could be added as part of a broader data export feature.
- **Flash module integration is future work:** The mastery_level field is designed for Flash integration (P2) but no cross-module wiring exists yet. The field is user-facing as a self-assessment tool for now.

### Context for Next Agent
- The Words module currently has no `db/` directory at all. You'll need to create `db/schema.ts`, `db/crud.ts`, and `db/index.ts` from scratch.
- The `definition.ts` has no `schemaVersion` or `migrations` array. Add both. Follow the pattern in other modules (e.g., `modules/trails/src/definition.ts`).
- The `lookup_data` column stores a serialized `MyWordsLookupResult`. Use `JSON.stringify()` on save and `JSON.parse()` on read. Handle parse errors gracefully (return null for lookup_data if corrupted).
- The Saved tab already exists in the module navigation (`{ key: 'saved', label: 'Saved', icon: 'bookmark' }`), so no navigation changes are needed in the definition.
- The saved-word-detail screen is already declared in navigation (`{ name: 'saved-word-detail', title: 'Saved Word' }`).
- For the unique index on (word, language_code), handle the INSERT OR IGNORE/REPLACE pattern carefully. If a user saves a word they already saved, the function should return the existing record rather than failing or creating a duplicate.
