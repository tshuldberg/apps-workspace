# Feature Spec: Advanced Search Filters

## Metadata
- **Module:** words
- **Priority Score:** 20 / 50 (B-Tier)
- **Scoring Breakdown:** Market [2] x3 + Switching [2] x3 + Complexity [3] x2 + CrossModule [1] x1 + PaidUser [1] x1
- **Sprint:** 5
- **Estimated CC Time:** 2-3 hours
- **Depends On:** Saved words persistence (uses `wd_saved_words` data for local search), offline fallback (uses `wd_lookup_cache` for cached search)
- **Blocks:** none

## Business Context

### Why This Feature Exists
WordReference is the gold standard for multilingual dictionary search. It offers conjugation tables, forum discussion links, and powerful cross-language search filters. MyWords currently has a simple text-match search (LIKE query on saved words) and single-word API lookup. Advanced search filters let users find words by part of speech, language, mastery level, date range, and more. This is especially valuable for language learners managing 100+ saved words across multiple languages who need to drill down quickly. The complexity score (3/5, Inverse = 3) reflects moderate implementation effort: mostly UI work plus SQLite query composition, but also includes a new FTS5 virtual table for full-text search across definitions and notes.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| WordReference | Yes | Free | Language filter, part of speech filter, search within forums, conjugation search. Powerful but cluttered UI. |
| Dictionary.com | Partial | Free (basic) | Search by word only. "Browse" by letter. No advanced filters on saved words. |
| Merriam-Webster | Partial | Free | Search suggestions as you type. Thesaurus filter (synonyms vs antonyms). No saved word filters. |
| Anki | Yes | Free | Browser with complex query syntax: `deck:X tag:Y prop:due<7 rated:3`. Powerful but steep learning curve. |
| Quizlet | Partial | Free | Filter study sets by subject and creator. No per-card filters. |

### Target User
Power users with 50+ saved words who need to filter and find specific vocabulary. Language learners studying multiple languages simultaneously who want to isolate one language. GRE students who want to review only low-mastery words. Writers who search their notes for words they wrote context about. Users who want Anki-like browser power but with a friendlier UI.

## Technical Context

### Where This Lives in MyLife

```
modules/words/src/
  db/
    schema.ts                      -- Updated: V4 migration adds FTS5 virtual table
    crud.ts                        -- Updated: enhanced getSavedWords with compound filters
  search.ts                        -- NEW: search engine (query parser, filter composition)
  types.ts                         -- New AdvancedSearchFilters type
  definition.ts                    -- Add V4 migration, bump schemaVersion
  index.ts                         -- Export search functions

apps/mobile/app/(words)/
  saved.tsx                        -- Updated: filter bar UI, advanced search sheet

apps/web/app/words/
  page.tsx                         -- Updated: filter sidebar/toolbar
```

### Wireframe Position

```
Hub Dashboard
  └── MyWords card
       └── Saved tab
            └── [Search bar with filter icon]
                 └── Advanced Filter Sheet ← YOU ARE HERE
                      └── Part of speech filter
                      └── Language filter
                      └── Mastery level range
                      └── Date range
                      └── Favorites toggle
                      └── Full-text search (definitions + notes)
```

### Data Model

```sql
-- Migration V4: FTS5 virtual table for full-text search
CREATE VIRTUAL TABLE IF NOT EXISTS wd_saved_words_fts USING fts5(
  word,
  definition_summary,
  notes,
  content='wd_saved_words',
  content_rowid='rowid'
);

-- Triggers to keep FTS in sync with main table
CREATE TRIGGER IF NOT EXISTS wd_saved_words_fts_insert
AFTER INSERT ON wd_saved_words BEGIN
  INSERT INTO wd_saved_words_fts(rowid, word, definition_summary, notes)
  VALUES (NEW.rowid, NEW.word, NEW.definition_summary, NEW.notes);
END;

CREATE TRIGGER IF NOT EXISTS wd_saved_words_fts_delete
AFTER DELETE ON wd_saved_words BEGIN
  INSERT INTO wd_saved_words_fts(wd_saved_words_fts, rowid, word, definition_summary, notes)
  VALUES ('delete', OLD.rowid, OLD.word, OLD.definition_summary, OLD.notes);
END;

CREATE TRIGGER IF NOT EXISTS wd_saved_words_fts_update
AFTER UPDATE ON wd_saved_words BEGIN
  INSERT INTO wd_saved_words_fts(wd_saved_words_fts, rowid, word, definition_summary, notes)
  VALUES ('delete', OLD.rowid, OLD.word, OLD.definition_summary, OLD.notes);
  INSERT INTO wd_saved_words_fts(rowid, word, definition_summary, notes)
  VALUES (NEW.rowid, NEW.word, NEW.definition_summary, NEW.notes);
END;

-- Rebuild FTS index from existing data (for users upgrading from V3)
INSERT INTO wd_saved_words_fts(wd_saved_words_fts) VALUES('rebuild');
```

### Dependencies
- **Internal:** `@mylife/words` (getSavedWords, SavedWord, SavedWordSortBy), `@mylife/db` (DatabaseAdapter)
- **External:** None. FTS5 is a built-in SQLite extension (available in expo-sqlite and better-sqlite3).
- **Cross-Module:** None directly. Search results feed into the Flash bridge (users can filter to low-mastery words and bulk-send to Flash).

## Functional Requirements

### User Stories
1. As a multilingual learner, I want to filter saved words by language so that I can study one language at a time.
2. As a GRE student, I want to filter by mastery level (0-2) so that I can focus on words I haven't learned yet.
3. As a writer, I want to search across my personal notes so that I can find words where I wrote specific context.
4. As an organized user, I want to filter by part of speech so that I can review all my saved nouns or verbs separately.
5. As a returning user, I want to filter by date range so that I can see words I saved this week or this month.
6. As a power user, I want to combine multiple filters simultaneously so that I can create precise queries like "Spanish verbs saved this week with mastery < 3."

### Behavior Specification

**Opening advanced search:**
1. User is on the Saved tab with the search bar visible
2. A filter icon (funnel) appears to the right of the search bar
3. If any filters are active: the filter icon shows a badge with the active filter count
4. User taps the filter icon
5. Advanced Filter Sheet slides up from the bottom

**Filter sheet layout:**
1. **Full-text search:** Text input for searching across word, definition_summary, and notes. Uses FTS5 for ranked matching.
2. **Language:** Multi-select chips showing all languages the user has saved words in (dynamically populated from `getSavedWordCountByLanguage`). Tap to toggle.
3. **Part of speech:** Multi-select chips: noun, verb, adjective, adverb, other. Populated from distinct values in `wd_saved_words.part_of_speech`.
4. **Mastery level range:** Dual-thumb slider from 0 to 5. Default: 0-5 (all). Drag to narrow range.
5. **Favorites only:** Toggle switch.
6. **Word list:** Dropdown showing all lists + "Uncategorized" (null list_id). Multi-select.
7. **Date range:** "Saved" date range picker: Last 7 days, Last 30 days, Last 90 days, All time, Custom range.
8. **Sort by:** Selector for sort order (recent, alphabetical, most looked up, mastery). Same options as existing sort.
9. **Apply** button (accent color) and **Reset** link (textSecondary)

**Applying filters:**
1. User selects desired filters and taps "Apply"
2. Sheet dismisses
3. Saved words list updates to show only matching results
4. Active filter summary appears below the search bar: "3 filters active: English, Nouns, Mastery 0-2"
5. Tapping the summary reopens the filter sheet with current selections
6. "X" button on the summary clears all filters

**Full-text search behavior:**
1. When the user types in the full-text search field, the query uses FTS5 MATCH
2. FTS5 searches across: word, definition_summary, notes
3. Results are ranked by FTS5's built-in BM25 ranking
4. Highlighted matches: the matching terms in word, definition, and notes are highlighted in the results list
5. FTS5 supports prefix matching (e.g., "ephem*" matches "ephemeral")
6. FTS5 supports phrase matching (e.g., '"word family"' matches the exact phrase)

**Compound filter SQL composition:**
1. Each filter adds a WHERE clause condition
2. FTS5 full-text filter joins wd_saved_words_fts
3. Conditions are AND-composed (all filters must match)
4. The query is built dynamically with parameterized values (no SQL injection risk)

### Edge Cases

- **No saved words match filters:** Show "No words match your filters" with active filter summary and "Reset Filters" button.
- **FTS5 not available:** If FTS5 extension is not available (unlikely but possible on some SQLite builds), fall back to LIKE queries on word, definition_summary, and notes. Log a warning.
- **Empty definition_summary or notes:** FTS5 handles NULL/empty values gracefully. They simply don't match text queries.
- **Part of speech values inconsistent:** API returns values like "noun", "verb", "adjective", "adverb", "pronoun", "preposition", "conjunction", "interjection", "determiner", "numeral". Group rare types into "Other" in the filter UI.
- **Language list very long (10+ languages):** Show the top 6 languages by word count, with a "Show All" expander for the rest.
- **Mastery range 0-0:** Valid filter. Shows only words with mastery_level = 0 (unrated/new words).
- **Date range custom:** If user selects a custom range with start > end, swap them silently.
- **FTS5 special characters:** Escape special FTS5 query characters: `*`, `"`, `(`, `)`, `AND`, `OR`, `NOT`. Treat user input as literal unless it contains FTS5 operators.
- **Performance with 10,000+ saved words and FTS5:** FTS5 queries are O(log n) with the inverted index. Should return in <50ms even for large collections.
- **Filter state persistence:** Current filter selections persist during the session (in React state) but reset when the user leaves the Words module and returns. Do not persist to SQLite.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Filter icon appears next to the search bar on the Saved tab
- [ ] **AC-2:** Tapping filter icon opens the Advanced Filter Sheet with all filter options
- [ ] **AC-3:** Language filter shows chips for all languages the user has saved words in
- [ ] **AC-4:** Part of speech filter shows chips for all distinct parts of speech in saved words
- [ ] **AC-5:** Mastery level dual-thumb slider filters words by mastery range
- [ ] **AC-6:** Favorites toggle filters to only favorited words
- [ ] **AC-7:** Word list multi-select filters by one or more lists (or "Uncategorized")
- [ ] **AC-8:** Date range filter limits results to words saved within the selected timeframe
- [ ] **AC-9:** Full-text search finds matches in word, definition_summary, and notes
- [ ] **AC-10:** Full-text search supports prefix matching (e.g., "ephem*")
- [ ] **AC-11:** Multiple filters can be combined (AND logic)
- [ ] **AC-12:** Active filter count badge appears on the filter icon
- [ ] **AC-13:** Active filter summary below search bar shows which filters are applied
- [ ] **AC-14:** "Reset" clears all filters and returns to the default unfiltered view
- [ ] **AC-15:** Matching terms are highlighted in search results when full-text search is active

### Technical Criteria
- [ ] **TC-1:** Migration V4 creates `wd_saved_words_fts` FTS5 virtual table
- [ ] **TC-2:** FTS5 sync triggers fire on INSERT, UPDATE, DELETE of `wd_saved_words`
- [ ] **TC-3:** FTS5 rebuild runs on migration to index existing saved words
- [ ] **TC-4:** Compound filter queries use parameterized SQL (no string concatenation)
- [ ] **TC-5:** FTS5 queries return results in <50ms for 10,000+ saved words
- [ ] **TC-6:** `getDistinctPartsOfSpeech(db)` returns all unique part_of_speech values
- [ ] **TC-7:** `getDistinctLanguages(db)` returns languages with word counts (reuse `getSavedWordCountByLanguage`)
- [ ] **TC-8:** Filter query composition correctly ANDs all active conditions

### Negative Criteria
- [ ] **NC-1:** Advanced search must NOT make any network calls (all data is local SQLite)
- [ ] **NC-2:** Filter state must NOT persist across module exits (session-only state)
- [ ] **NC-3:** FTS5 triggers must NOT cause observable performance degradation on save/unsave operations
- [ ] **NC-4:** The filter sheet must NOT block interaction with the rest of the app (dismissible by swiping down or tapping outside)
- [ ] **NC-5:** Full-text search must NOT allow SQL injection through FTS5 query syntax

## UI Specification

### Mobile (Expo)

**Filter Icon:**
- Funnel icon (Lucide `filter`) right-aligned in the search bar container
- Default: `rgba(240,240,245,0.65)` (textSecondary)
- Active: accent `#0EA5E9` with count badge (small circle, accent background, white text)

**Advanced Filter Sheet (Bottom Sheet):**
- Glass background with handle bar at top
- Snap points: 60% height (default), 90% (expanded for scrolling)
- Sections separated by subtle dividers

*Full-text search:*
- Text input at top with magnifying glass icon
- Placeholder: "Search words, definitions, notes..."
- Glass card background

*Language chips:*
- Section label: "Language"
- Horizontal scrollable row of chips
- Each chip shows language code + word count: "EN (142)", "ES (28)"
- Unselected: glass border, textSecondary text
- Selected: accent fill, white text

*Part of speech chips:*
- Section label: "Part of Speech"
- Horizontal scrollable row: "Noun", "Verb", "Adjective", "Adverb", "Other"
- Same selected/unselected styling as language chips

*Mastery level:*
- Section label: "Mastery Level"
- Dual-thumb range slider, 0-5
- Track: glass background; filled range: accent color
- Labels at each end: "0" and "5"
- Current range shown: "0 - 5" (or "2 - 4" when narrowed)

*Favorites:*
- Toggle row: "Favorites only" with switch component
- Off by default

*Word list:*
- Section label: "Word List"
- Multi-select dropdown or chip row
- Options: all user-created lists + "Uncategorized"

*Date range:*
- Section label: "Date Range"
- Segmented control: "7d", "30d", "90d", "All", "Custom"
- Custom shows two date inputs

*Sort:*
- Section label: "Sort By"
- Segmented control: "Recent", "A-Z", "Lookups", "Mastery"

*Actions:*
- "Apply" button: full-width, accent color, bottom of sheet
- "Reset" link: textSecondary, above Apply button

**Active Filter Summary:**
- Horizontal bar below search bar when filters active
- Text: "3 filters: English, Nouns, Mastery 0-2" (truncated with "...")
- "X" button right-aligned to clear all
- Tappable to reopen filter sheet

**Highlighted Matches:**
- When full-text search is active, matching terms in word, definition preview, and notes preview are highlighted
- Highlight: accent color background at 20% opacity with accent text

### Web (Next.js)

- Filter panel as a sidebar or collapsible toolbar above the saved words list
- Same filter controls adapted for desktop: multi-select dropdowns instead of chips, native range slider
- Full-text search in the main search bar with a toggle for "Search definitions and notes"
- Active filter pills below the search bar

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| No Filters | Standard saved words list, filter icon neutral | Default state |
| Filters Active | Filtered list + badge + summary bar | User applied filters |
| FTS Results | Highlighted matches in word/definition/notes | Full-text search query |
| No Matches | "No words match your filters" + Reset button | Filters too narrow |
| Filter Sheet Open | Bottom sheet with all filter controls | Tapped filter icon |
| Loading Filters | Brief skeleton in filter sheet for language/POS counts | First open of filter sheet |

## Test Requirements

### Unit Tests
- [ ] `buildFilterQuery(filters)`: generates correct SQL with no filters (returns base query)
- [ ] `buildFilterQuery(filters)`: adds language_code IN (?) for language filter
- [ ] `buildFilterQuery(filters)`: adds part_of_speech IN (?) for POS filter
- [ ] `buildFilterQuery(filters)`: adds mastery_level BETWEEN ? AND ? for mastery range
- [ ] `buildFilterQuery(filters)`: adds is_favorite = 1 for favorites toggle
- [ ] `buildFilterQuery(filters)`: adds list_id IN (?) for word list filter (including NULL for uncategorized)
- [ ] `buildFilterQuery(filters)`: adds created_at >= ? for date range filter
- [ ] `buildFilterQuery(filters)`: joins FTS5 table for full-text query
- [ ] `buildFilterQuery(filters)`: combines all filters with AND
- [ ] `buildFilterQuery(filters)`: uses parameterized values (no raw string interpolation)
- [ ] `escapeFtsQuery(input)`: escapes FTS5 special characters
- [ ] `escapeFtsQuery(input)`: preserves prefix matching asterisks at end of tokens
- [ ] `escapeFtsQuery(input)`: preserves phrase matching quotes
- [ ] `getDistinctPartsOfSpeech(db)`: returns unique non-null values sorted alphabetically
- [ ] `getDistinctPartsOfSpeech(db)`: returns empty array when no saved words exist
- [ ] `searchSavedWordsFts(db, query)`: returns words matching text in word column
- [ ] `searchSavedWordsFts(db, query)`: returns words matching text in definition_summary
- [ ] `searchSavedWordsFts(db, query)`: returns words matching text in notes
- [ ] `searchSavedWordsFts(db, query)`: returns empty array for non-matching query
- [ ] `searchSavedWordsFts(db, "ephem*")`: matches prefix
- [ ] FTS5 triggers: inserting a saved word makes it searchable via FTS
- [ ] FTS5 triggers: updating a saved word's notes makes new text searchable
- [ ] FTS5 triggers: deleting a saved word removes it from FTS index

### Integration Tests
- [ ] Compound filter: set language=EN + mastery 0-2 + POS=noun -> verify only matching words returned
- [ ] FTS + filter: full-text "novel" + language=EN -> verify intersection of both
- [ ] Date filter: save 3 words across different dates -> filter "Last 7 days" -> verify only recent word shown
- [ ] Reset: apply filters -> reset -> verify all words shown again

### QA Verification Script
1. Open the app on iOS simulator
2. Pre-condition: have 10+ saved words across 2+ languages, various POS, some with notes
3. Navigate to Words > Saved tab
4. Verify: filter icon (funnel) appears next to search bar -- corresponds to AC-1
5. Tap the filter icon
6. Verify: Advanced Filter Sheet opens with all sections -- corresponds to AC-2
7. Verify: Language chips show languages with word counts -- corresponds to AC-3
8. Verify: Part of speech chips show distinct POS values -- corresponds to AC-4
9. Select "English" language chip
10. Drag mastery slider to 0-2
11. Tap "Apply"
12. Verify: only English words with mastery 0-2 shown -- corresponds to AC-5, AC-11
13. Verify: filter icon shows badge "2" -- corresponds to AC-12
14. Verify: summary bar shows "2 filters: English, Mastery 0-2" -- corresponds to AC-13
15. Tap filter icon again
16. Toggle "Favorites only"
17. Tap "Apply"
18. Verify: only favorited English words with mastery 0-2 shown -- corresponds to AC-6
19. Tap filter icon, select a word list
20. Tap "Apply"
21. Verify: results filtered to that list -- corresponds to AC-7
22. Tap filter icon, select "Last 7 days" date range
23. Tap "Apply"
24. Verify: only recently saved words shown -- corresponds to AC-8
25. Tap filter icon, type "novel" in full-text search
26. Tap "Apply"
27. Verify: words with "novel" in word, definition, or notes are shown -- corresponds to AC-9
28. Clear the full-text field, type "ephem*"
29. Tap "Apply"
30. Verify: "ephemeral" matches via prefix -- corresponds to AC-10
31. Verify: matching text is highlighted in results -- corresponds to AC-15
32. Tap "X" on the filter summary bar
33. Verify: all filters cleared, full word list shown -- corresponds to AC-14

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to Saved tab, open filter sheet, apply various filters, verify all states
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Post-merge:
- [ ] `/parity-check` -- words module parity
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Saved words search is basic LIKE query on word column only
- No full-text search across definitions or notes
- Filter options limited to: sort, language (single), list (single), favorites
- No part of speech filter, no mastery range filter, no date range filter
- No FTS5 virtual table exists

### After This Work
- V4 migration creates `wd_saved_words_fts` FTS5 virtual table with sync triggers
- `search.ts` provides query builder with compound filter composition
- All filter options available: language (multi), POS (multi), mastery range, favorites, word list (multi), date range, full-text search
- FTS5 enables fast ranked search across word, definition, and notes
- Filter UI with bottom sheet, active badges, and summary bar

### Files Changed
- `modules/words/src/db/schema.ts` -- V4 migration: FTS5 virtual table, triggers, rebuild
- `modules/words/src/db/crud.ts` -- Updated: enhanced query builder, getDistinctPartsOfSpeech, FTS search
- `modules/words/src/search.ts` -- NEW: filter composition engine, FTS query escaping
- `modules/words/src/types.ts` -- New AdvancedSearchFilters interface
- `modules/words/src/definition.ts` -- Add V4 migration, bump schemaVersion
- `modules/words/src/index.ts` -- Export search functions
- `modules/words/src/__tests__/search.test.ts` -- NEW: search engine tests
- `apps/mobile/app/(words)/saved.tsx` -- Filter icon, Advanced Filter Sheet, active filter summary
- `apps/web/app/words/page.tsx` -- Filter panel/toolbar

### Known Limitations
- **No saved filter presets:** Users cannot save frequently-used filter combinations as named presets. Could be added later as a separate feature.
- **No OR-composition:** All filters are AND-composed. Users cannot search "nouns OR verbs" as a single filter. They can select both in the multi-select, which is effectively OR within one filter type but AND across filter types.
- **FTS5 language support:** FTS5 tokenization is optimized for Latin-script languages. CJK (Chinese/Japanese/Korean) tokenization may miss some compound words. A future enhancement could add ICU tokenizer support.
- **No relevance score display:** FTS5 provides BM25 relevance scores internally, but we don't surface the score to the user. Results are ranked by relevance but the score isn't shown.
- **Filter state is ephemeral:** Filters reset when leaving the module. A future "saved searches" feature could persist filter presets.

### Context for Next Agent
- FTS5 is built into both expo-sqlite and better-sqlite3. No external extensions needed.
- The FTS5 content-sync pattern (external content table with triggers) is standard SQLite. The `content='wd_saved_words'` and `content_rowid='rowid'` parameters link FTS to the main table. The triggers keep them in sync.
- The `rebuild` command in the migration re-indexes all existing rows. This is needed for users upgrading from V3 who already have saved words.
- For the compound filter query builder, use a pattern similar to the existing `getSavedWords` function in `crud.ts` but extend it to handle the new filter types. Keep all SQL parameterized.
- The part of speech values come from the Free Dictionary API and are lowercase English strings: "noun", "verb", "adjective", "adverb", etc. Display them capitalized in the UI.
- Migration version numbering: V1 = saved words, V2 = flash_card_id, V3 = lookup cache, V4 = FTS5 (this feature). Ensure the version numbers don't conflict with other Words specs.
