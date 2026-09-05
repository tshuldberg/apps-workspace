# Feature Spec: MyWords Full Web UI

## Metadata
- **Module:** words
- **Task ID:** W14-3
- **Priority Score:** 36 / 50 (A-Tier)
- **Scoring Breakdown:** Market 4 x3 + Switching 3 x3 + Complexity 3 x2 + CrossModule 2 x1 + PaidUser 3 x1
- **Sprint:** Sprint 3
- **Estimated CC Time:** 6-8 hours
- **Depends On:** All V1-V4 CRUD, service layer, flash bridge, offline cache, FTS search, and mobile UI already implemented
- **Blocks:** Words full cross-platform parity, web module completion dashboard metric
- **Reference Implementation:** `apps/web/app/books/` (layout, page, actions, sub-routes, tests)
- **Design Pipeline:** /office-hours (builder) -> /plan-eng-review -> /plan-design-review -> /design-consultation

## Phase 1: Office Hours (Builder Mode) -- Web UX Brainstorm

### What Makes a Dictionary App Delightful on Desktop

Desktop is where serious word work happens. Writers draft in browsers, students research in browsers, professionals compose emails in browsers. A dictionary web UI has inherent advantages over mobile that should be fully exploited:

1. **Keyboard-first interaction.** Type a word, hit Enter, see the result. No tapping, no scrolling to find input fields. The search bar is always focused, always accessible. `Cmd+K` opens a command palette for rapid lookup from anywhere in the app.

2. **Multi-panel layouts.** The killer desktop feature: see the word detail AND your saved words list simultaneously. A two-panel layout (sidebar list + main content) lets you browse through saved words while reading definitions. Mobile can only show one at a time.

3. **Information density.** Desktop can show definitions, synonyms, antonyms, etymology, and rhymes in one viewport without scrolling. Mobile spreads this across 3-4 scrollable sections. Dense, well-organized information is delightful when you have 1120px to work with.

4. **Data tables for vocabulary management.** Saved words as a sortable, filterable table with columns for word, language, part of speech, mastery, last looked up, list assignment. Far more powerful than the mobile FlatList.

5. **Drag-and-drop for list management.** Drag words between lists, reorder lists, bulk-select and move. Desktop affordances that are clumsy or impossible on touch.

6. **Inline editing.** Click a word's notes field and edit in-place. Change mastery level with a dropdown, not a modal. Toggle favorite with a click. No navigation required.

### The Narrowest Wedge

**The Lookup page.** A fast, keyboard-driven dictionary lookup that shows rich results with pronunciation, definitions grouped by part of speech, synonyms/antonyms, etymology, rhymes, and word family, all in a single viewport. The "I need this on desktop" moment: you're writing an email, encounter a word you want to verify, hit Cmd+K, type the word, and see everything instantly without leaving your flow. The desktop lookup experience should feel like Raycast or Spotlight for words.

### How Information Density Differs From Mobile

| Dimension | Mobile | Web |
|-----------|--------|-----|
| Definitions per viewport | 2-3 | 6-8 |
| Synonym/antonym display | Horizontal chip scroll | Full grid with grouping |
| Etymology | Collapsed section | Always visible panel |
| Word detail layout | Single column scroll | Two-column (defs left, thesaurus/meta right) |
| Saved words | Vertical list | Sortable data table with inline actions |
| Navigation | Tab bar + stack push | Sidebar tabs + in-page sections |

### Linear/Raycast Aesthetic Patterns

- **Command palette (`Cmd+K`):** Primary search entry point, works from any page
- **Glass card surfaces:** Frosted translucent cards over deep background
- **Subtle hover states:** Cards gently elevate on hover with border glow
- **Keyboard shortcuts displayed inline:** Show `Cmd+S` next to the save button, `Cmd+F` next to search
- **No unnecessary chrome:** Dense information, no hero sections inside the app
- **Fast transitions:** 200ms fade + slide between views, not page reloads

## Phase 2: Engineering Review -- Architecture Lock

### Module Exports Audit

The `@mylife/words` module exports 50+ functions across 5 categories. Here is what the web UI needs:

| Category | Functions Needed | Status |
|----------|-----------------|--------|
| **Service (API)** | `lookupWord`, `browseWordsAlphabetically`, `suggestWordReplacements`, `getMyWordsLanguages` | 3 already in actions.ts, `suggestWordReplacements` missing |
| **Saved Words CRUD** | `saveWord`, `unsaveWord`, `getSavedWord`, `getSavedWordByWordAndLang`, `getSavedWordsLightweight`, `updateSavedWord`, `incrementLookupCount`, `getSavedWordCount`, `getSavedWordCountByLanguage` | None in actions.ts -- all need adding |
| **Word Lists CRUD** | `createWordList`, `getWordList`, `getWordLists`, `updateWordList`, `deleteWordList` | None -- all need adding |
| **Offline Cache** | `cacheLookupResult`, `getCachedLookup`, `getCachePrefixMatches`, `getCacheStats`, `clearCache`, `evictStaleEntries` | None -- all need adding |
| **Advanced Search (V4)** | `advancedSearchSavedWords`, `searchSavedWordsFts`, `getDistinctPartsOfSpeech`, `escapeFtsQuery` | None -- all need adding |
| **Flash Bridge (V2)** | `buildFlashcardContent`, `createFlashcardFromWord`, `bulkCreateFlashcards`, `checkFlashCardExists`, `setFlashCardId` | None -- future (Flash module not wired on web yet) |

### Missing Server Actions (actions.ts)

The current `actions.ts` has only 3 actions. The web UI needs ~25 server actions:

```typescript
// Service (API) actions -- 1 missing
suggestWordReplacementsAction(input: WordHelperInput)

// Saved Words CRUD -- 9 new
saveWordAction(input: CreateSavedWordInput)
unsaveWordAction(id: string)
fetchSavedWordAction(id: string)
fetchSavedWordByWordAndLangAction(word: string, languageCode: string)
fetchSavedWordsAction(options?: GetSavedWordsOptions)
fetchSavedWordsLightweightAction(options?: GetSavedWordsOptions)
updateSavedWordAction(id: string, input: UpdateSavedWordInput)
fetchSavedWordCountAction()
fetchSavedWordCountByLanguageAction()

// Word Lists CRUD -- 5 new
createWordListAction(input: CreateWordListInput)
fetchWordListAction(id: string)
fetchWordListsAction()
updateWordListAction(id: string, input: UpdateWordListInput)
deleteWordListAction(id: string)

// Offline Cache -- 5 new
cacheLookupAction(word: string, languageCode: string, data: MyWordsLookupResult)
fetchCachedLookupAction(word: string, languageCode: string)
fetchCachePrefixMatchesAction(prefix: string, languageCode: string | null)
fetchCacheStatsAction()
clearCacheAction()

// Advanced Search (V4) -- 3 new
advancedSearchAction(filters: AdvancedSearchFilters)
fetchDistinctPartsOfSpeechAction()
searchFtsAction(query: string, limit?: number, offset?: number)
```

All server actions follow the books pattern: `'use server'` directive, import `getAdapter` and `ensureModuleMigrations` from `@/lib/db`, call `ensureModuleMigrations('words')` before any query.

### Schema Verification

The schema (V1-V4) supports all planned features:
- **V1:** `wd_word_lists` + `wd_saved_words` with indexes on word+lang, list, language, favorite, mastery, last_lookup
- **V2:** `flash_card_id` column on saved_words (Flash bridge ready)
- **V3:** `wd_lookup_cache` table with LRU eviction (offline support)
- **V4:** `wd_saved_words_fts` FTS5 virtual table with triggers (full-text search ready)

No schema gaps. All features have backend support.

### Web Route Structure (Next.js App Router)

```
apps/web/app/words/
  layout.tsx                    -- Module layout: header nav bar + content area
  page.tsx                      -- Main page: Lookup (search + results + recent)
  actions.ts                    -- All server actions (~25 functions)
  ui.ts                         -- Shared UI helpers (mastery computation, formatting)
  saved/
    page.tsx                    -- Saved words: data table + filters + sort + search
  saved/[id]/
    page.tsx                    -- Saved word detail: definition, mastery, notes, list
  lists/
    page.tsx                    -- Word lists manager: all lists with word counts
  lists/[id]/
    page.tsx                    -- Word list detail: words in list, edit list
  helper/
    page.tsx                    -- Word Helper: sentence input, word selection, replacements
  languages/
    page.tsx                    -- Language browser: searchable list + A-Z browse
  [word]/
    page.tsx                    -- Word detail: full lookup result (definitions, thesaurus, etymology)
  __tests__/
    lookup-page.test.tsx        -- Lookup page tests
    saved-page.test.tsx         -- Saved words page tests
    word-detail-page.test.tsx   -- Word detail page tests
    actions.test.ts             -- Server actions tests
    social-contract-parity.test.ts -- Parity with mobile feature set
```

### Data Flow

```
User types word in search bar
  -> Client state update (debounced)
  -> fetchCachePrefixMatchesAction() for type-ahead
  -> On Enter: lookupWordAction()
  -> Result rendered in main panel
  -> cacheLookupAction() fires in background
  -> If user clicks "Save": saveWordAction() -> re-render saved indicator

Saved words page load:
  -> fetchSavedWordsLightweightAction() with filter/sort params
  -> fetchWordListsAction() for filter sidebar
  -> fetchSavedWordCountByLanguageAction() for language filters
  -> Client-side state manages sort, filter, search, pagination
```

### State Management

Client-side `useState` + `useEffect` pattern (same as books). No global state library needed. Each page manages its own state with server actions for data fetching. Key state patterns:

- **Lookup page:** `query`, `languageCode`, `result`, `loading`, `error`, `typeAheadResults`, `recentLookups`, `isSaved`
- **Saved words page:** `words[]`, `sortBy`, `filterOptions`, `searchText`, `selectedListId`, `viewMode`
- **Word detail page:** `result`, `loading`, `error`, `isSaved`, `savedWordId`

## Phase 3: Design Review -- Dimension Ratings

### Design Dimension Scores

| Dimension | Score | Rationale | What Makes It a 10 |
|-----------|-------|-----------|---------------------|
| **Information Architecture** | 9/10 | Clean 7-route structure maps 1:1 to user mental model (lookup, saved, lists, helper, languages, detail) | Add breadcrumb trail for deep navigation |
| **Information Density** | 9/10 | Desktop-optimized: two-column word detail, data table for saved words, full thesaurus visible | Consider collapsible sections for etymology/rhymes |
| **Keyboard Accessibility** | 9/10 | Cmd+K global search, Enter to lookup, Tab through results, keyboard shortcuts on all actions | Ensure all keyboard shortcuts visible in UI |
| **Visual Hierarchy** | 8/10 | Word -> POS -> Definition -> Thesaurus -> Etymology flows naturally top-to-bottom | Stronger visual separation between POS groups |
| **Cool Obsidian Compliance** | 10/10 | Sky blue accent (#0EA5E9), glass cards, dark background, Inter font, all tokens from DESIGN.md | Already using correct token system |
| **Empty States** | 9/10 | Warm CTAs per DESIGN.md: "Your vocabulary starts here" not "No items found" | Module-specific illustrations |
| **Error States** | 9/10 | Inline retry, network awareness, no technical messages exposed | Add offline detection banner |
| **Loading States** | 9/10 | Skeleton screens matching content layout, not spinners | Ensure skeletons pulse at 60% opacity per DESIGN.md |
| **Responsiveness** | 8/10 | Desktop-first but must degrade to tablet/mobile breakpoints per DESIGN.md | Test at all 3 breakpoints (768, 1024, 1120+) |
| **Micro-interactions** | 8/10 | Save bookmark animation, hover states on cards, focus ring on search | Add subtle transition on sort/filter changes |

### All 5 States Designed Per Page

| Page | Loading | Empty | Error | Success | Partial |
|------|---------|-------|-------|---------|---------|
| **Lookup** | Skeleton in result area | Starter word chips + "Look up any word in 270+ languages" | Red text + Retry button in glass card | Full result card with save button | Type-ahead dropdown while typing |
| **Saved Words** | Skeleton rows in table | "Your vocabulary starts here" + CTA to lookup | "Could not load saved words" + Retry | Data table with sort/filter | Filtered view with "N of M words" |
| **Word Detail** | 6-line shimmer placeholder (title, subtitle, lines) | N/A (always has data from navigation) | "Could not load word" + Retry + Back | Full two-column layout | Cached result with "Offline" badge |
| **Word Lists** | Skeleton cards | "Create your first word list" + CTA | "Could not load lists" + Retry | List cards with word counts | Empty list with "Add words from Saved" |
| **Word Helper** | Spinner below sentence input | "Type or paste a sentence" guidance | "Replacements unavailable" + Retry | Grouped suggestions by relevance tier | Non-English language message |
| **Languages** | Skeleton rows | N/A (API-loaded, always has data) | "Could not load languages" + Retry | Searchable list + A-Z grid | Search-filtered subset |
| **Saved Word Detail** | Shimmer placeholder | N/A (navigated from list) | "Word not found" + Back | Full detail with notes + mastery + list | Partial lookup data (no enrichment) |

## Phase 4: Design Consultation -- Final Design System Decisions

### Module Identity

- **Accent Color:** `#0EA5E9` (sky blue) -- from `packages/ui/src/tokens/colors.ts`
- **Accent Dim:** `rgba(14,165,233,0.15)` -- for hero section background
- **Accent Border:** `rgba(14,165,233,0.25)` -- for active states and borders
- **Icon:** Book emoji (consistent with definition.ts)
- **Header Title:** "MyWords" in accent color, 30px, weight 800

### Component Reuse from packages/ui/ and Existing Web Modules

| Component Pattern | Source | Usage in Words |
|-------------------|--------|----------------|
| Glass card (`rgba(255,255,255,0.04)` + `rgba(255,255,255,0.06)` border) | DESIGN.md tokens | Result cards, saved word cards, list cards |
| Glass strong (`rgba(255,255,255,0.08)` + `rgba(255,255,255,0.10)` border) | DESIGN.md tokens | Word detail header, active filter states |
| Pill button (border-radius: 999, padding: 8px 14px) | Books page.tsx | Language pills, sort chips, filter chips |
| Active pill (accent background, dark text) | Books page.tsx | Selected language, active sort, active filter |
| Data table row (flex row, border-bottom, hover highlight) | Books page.tsx list mode | Saved words table rows |
| Hero section (accent-dim bg, accent border, flex between) | Books page.tsx | Lookup hero, saved words stats bar |
| Nav header (glass dock bg, backdrop-blur, nav links) | Books layout.tsx | Words layout header |
| Empty state (dashed border, centered text, CTA links) | Books page.tsx | All empty states |
| Grid/List toggle button | Books page.tsx | Saved words view mode |

### Typography Decisions

| Element | Variant | Size | Weight |
|---------|---------|------|--------|
| Word title (detail) | heading | 28px | 800 |
| Part of speech label | label | 12px | 600, uppercase |
| Definition text | body | 16px / 26px LH | 400 |
| Example text | body italic | 16px | 400 |
| Language badge | caption | 13px | 500 |
| Stats numbers | stat | 36px | 700 |
| Section headers | subheading | 18px | 600 |
| Nav links | body | 14px | 600 |

### Keyboard Shortcuts

| Shortcut | Action | Context |
|----------|--------|---------|
| `Cmd+K` / `Ctrl+K` | Focus search bar / Open from any page | Global |
| `Enter` | Execute lookup | Search bar focused |
| `Cmd+S` / `Ctrl+S` | Save/unsave current word | Word detail page |
| `Escape` | Clear search / Close type-ahead | Search bar focused |
| `Arrow Up/Down` | Navigate type-ahead suggestions | Type-ahead visible |
| `Tab` | Move between interactive elements | Global |

## Page-by-Page Wireframes

### 1. Layout (`layout.tsx`)

```
+----------------------------------------------------------------------+
| [#0EA5E9] MyWords           Lookup | Saved | Lists | Helper | Languages |
| Dictionary + thesaurus in 270 languages                              |
+----------------------------------------------------------------------+
|                                                                      |
|  {children}                                                          |
|  max-width: 1120px, centered, padding: 32px 24px                    |
|                                                                      |
+----------------------------------------------------------------------+
```

Header: glass dock background (`rgba(18,18,26,0.78)` + `backdrop-filter: blur(14px)`), bottom border. Module name in accent color. Nav links in textSecondary, 14px weight 600.

### 2. Lookup Page (`page.tsx`) -- The Narrowest Wedge

```
+----------------------------------------------------------------------+
| [Hero Section: accent-dim bg, accent border]                         |
|   "Dictionary & Thesaurus"                   [Language: EN v] [270+] |
|   "Look up any word in 270+ languages"                               |
|   +----------------------------------------------------------+       |
|   | [magnifying glass] Search any word...        [Cmd+K]     |       |
|   +----------------------------------------------------------+       |
|   [EN] [FR] [DE] [ES] [IT] [PT] [JA] [ZH] [All 270+]               |
+----------------------------------------------------------------------+
|                                                                      |
| [Type-ahead dropdown if 2+ chars typed]                              |
| +----------------------------------------------------------+        |
| | ephemeral                                           [EN]  |        |
| | ephemeron                                           [EN]  |        |
| +----------------------------------------------------------+        |
|                                                                      |
| [Result Card: glass.strong]                                          |
| +----------------------------------------------------------+        |
| | ephemeral                                   [Save] [Copy] |        |
| | /ɪˈfɛm.ər.əl/   adjective                               |        |
| |                                                           |        |
| | 1. Lasting for a very short time.                         |        |
| |    "ephemeral pleasures"                                  |        |
| |    Syn: transient, fleeting, brief                        |        |
| |                                                           |        |
| | 2. (biology) An organism with a very short life cycle.    |        |
| |                                                           |        |
| | [Full Entry ->]                                           |        |
| +----------------------------------------------------------+        |
|                                                                      |
| Recent Lookups                              [Clear History]          |
| ephemeral [EN]  |  serendipity [EN]  |  ubiquitous [EN]             |
|                                                                      |
| -- OR (first run) --                                                 |
| "Look up any word in 270+ languages"                                 |
| [ephemeral] [serendipity] [ubiquitous]   <- starter chips           |
+----------------------------------------------------------------------+
```

### 3. Word Detail Page (`[word]/page.tsx`)

Two-column layout on desktop (>1024px), single column on mobile/tablet.

```
+----------------------------------------------------------------------+
| [Back to Lookup]                                                     |
+----------------------------------------------------------------------+
| LEFT COLUMN (60%)                | RIGHT COLUMN (40%)                |
|                                  |                                   |
| [Header Card: glass.strong]      | [Thesaurus Card: glass.strong]   |
| ephemeral                        | Synonyms                         |
| /ɪˈfɛm.ər.əl/  [IPA] [RP]     | [transient] [fleeting] [brief]   |
| English [EN] [Cached badge?]     | [momentary] [passing] [short]    |
| [Save] [Copy to Clipboard]      |                                   |
|                                  | Antonyms                         |
| ADJECTIVE                        | [permanent] [enduring] [lasting] |
| 1. Lasting for a very short...  |                                   |
|    "ephemeral pleasures"         | [Word Family Card]               |
|    Syn: transient  Ant: lasting  | [ephemeron] [ephemera]           |
|                                  | [ephemerality]                   |
| 2. (biology) An organism...     |                                   |
|                                  | [Rhymes Card]                    |
| NOUN                             | [general] [mineral] [admiral]    |
| 1. Something lasting a very...  | [temporal] [lateral]             |
|                                  |                                   |
| [Word History Card]              | [Nearby Words Card]              |
| Greek ephemeros "lasting only    | [ephemera] [ephemeron]           |
| a day" from epi- + hemera "day" | [epi-] [hem-]                    |
|                                  |                                   |
| First Known Use: 1576            |                                   |
| Did You Know? ...                |                                   |
|                                  |                                   |
| [Sources Footer]                 |                                   |
| Free Dictionary API (CC BY-SA)   |                                   |
| Datamuse API                     |                                   |
| Wiktionary (CC BY-SA 4.0)       |                                   |
+----------------------------------------------------------------------+
```

### 4. Saved Words Page (`saved/page.tsx`)

```
+----------------------------------------------------------------------+
| [Hero Section: accent-dim bg]                                        |
|   "Your Vocabulary"                    [Grid/Table toggle] [+ Lookup]|
|   "142 words in your collection"                                     |
+----------------------------------------------------------------------+
|                                                                      |
| [Stats Bar: glass.dock]                                              |
| 142 Saved  |  23 Favorites  |  4 Lists  |  12 Flash Cards           |
|                                                                      |
| [Search: glass input]                                                |
| Search saved words...                                                |
|                                                                      |
| [Sort chips] [Recent] [A-Z] [Lookups] [Mastery]                     |
|                                                                      |
| [Filter chips] [All] [Favorites] [EN (98)] [FR (22)] [DE (12)]      |
|                [New 0-1] [Learning 2-3] [Known 4-5]                  |
|                                                                      |
| [Data Table]                                                         |
| +----+------------+------+-----+---------+--------+------+--------+ |
| |    | Word       | Lang | POS | Mastery | Looked | Fav  | Actions| |
| +----+------------+------+-----+---------+--------+------+--------+ |
| |    | ephemeral  | EN   | adj | [green] | 12x    | [heart]| [...]| |
| |    | serendipity| EN   | noun| [yellow]| 3x     | [heart]| [...]| |
| |    | Zeitgeist  | DE   | noun| [red]   | 1x     |       | [...]| |
| +----+------------+------+-----+---------+--------+------+--------+ |
|                                                                      |
| [Load More] or [Pagination: 1 2 3 ... 5]                            |
+----------------------------------------------------------------------+
```

### 5. Saved Word Detail Page (`saved/[id]/page.tsx`)

```
+----------------------------------------------------------------------+
| [Back to Saved Words]                                                |
+----------------------------------------------------------------------+
| ephemeral                                     [Favorite] [More ...]  |
| /ɪˈfɛm.ər.əl/  adjective                                           |
| English [EN]                                                         |
+----------------------------------------------------------------------+
|                                                                      |
| [Definition Card: glass]                                             |
| Lasting for a very short time.                                       |
| [View Full Entry ->]                                                 |
|                                                                      |
| [Mastery Card: glass]                                                |
| Mastery: [green dot] Familiar                                        |
| Looked up 12 times, last today                                       |
|                                                                      |
| [Stats Row]                                                          |
| Looked up 12 times | Last: today | Saved: Mar 15                    |
|                                                                      |
| [Notes Card: glass]                                                  |
| Notes                                                      [pencil] |
| +----------------------------------------------------------+        |
| | Used in essay about temporal experiences...               |        |
| +----------------------------------------------------------+        |
|                                                                      |
| [List Assignment Card: glass]                                        |
| List: [Academic Vocabulary v]                               [>]      |
|                                                                      |
| [Flash Status Card: glass]                                           |
| Flash module coming soon                                             |
|                                                                      |
| [Remove from Saved]  (danger outline button)                         |
+----------------------------------------------------------------------+
```

### 6. Word Lists Page (`lists/page.tsx`)

```
+----------------------------------------------------------------------+
| [Hero Section: accent-dim bg]                                        |
|   "Word Lists"                                        [+ New List]   |
|   "Organize your vocabulary into collections"                        |
+----------------------------------------------------------------------+
|                                                                      |
| [List Cards: grid, auto-fit, minmax(280px, 1fr)]                    |
|                                                                      |
| +----------------------------+  +----------------------------+       |
| | Academic Vocabulary        |  | Travel French              |       |
| | 34 words                   |  | 12 words                   |       |
| | EN                         |  | FR                         |       |
| | Last updated: Mar 22       |  | Last updated: Mar 18       |       |
| +----------------------------+  +----------------------------+       |
|                                                                      |
| +----------------------------+                                       |
| | Medical Terms              |                                       |
| | 8 words                    |                                       |
| | EN                         |                                       |
| | Last updated: Mar 10       |                                       |
| +----------------------------+                                       |
|                                                                      |
| -- OR (empty) --                                                     |
| "Create your first word list"                                        |
| "Group related words for focused study"                              |
| [+ Create List]                                                      |
+----------------------------------------------------------------------+
```

### 7. Word List Detail Page (`lists/[id]/page.tsx`)

```
+----------------------------------------------------------------------+
| [Back to Lists]                                                      |
+----------------------------------------------------------------------+
| Academic Vocabulary                                      [Edit] [...]|
| Optional description text here                                       |
| EN | 34 words | 8 favorites                                         |
+----------------------------------------------------------------------+
|                                                                      |
| [Word rows - same card style as saved words]                         |
| ephemeral [EN] adjective  [green dot] [heart] [x remove]            |
| serendipity [EN] noun     [yellow dot] [heart] [x remove]           |
| ubiquitous [EN] adjective [green dot]          [x remove]           |
|                                                                      |
| -- OR (empty) --                                                     |
| "This list is waiting"                                               |
| "Save words and assign them here"                                    |
| [Go to Lookup]                                                       |
+----------------------------------------------------------------------+
```

### 8. Word Helper Page (`helper/page.tsx`)

```
+----------------------------------------------------------------------+
| Word Helper                                                          |
| Find the perfect word for your sentence                              |
+----------------------------------------------------------------------+
|                                                                      |
| [Sentence Input Card: glass]                                         |
| +----------------------------------------------------------+        |
| | The ephemeral nature of social media trends makes it      |   [X]  |
| | difficult to predict long-term cultural impact.           |        |
| +----------------------------------------------------------+        |
| 87 chars                                    [EN v] [change]          |
|                                                                      |
| Tap a word to find replacements:                                     |
| [The] [ephemeral] [nature] [of] [social] [media] [trends]           |
| [makes] [it] [difficult] [to] [predict] [long-term]                 |
| [cultural] [impact]                                                  |
|                     ^ selected (accent bg)                           |
|                                                                      |
| Replacements for 'ephemeral'                                         |
|                                                                      |
| [green dot] High relevance                                          |
| +----------------------------------------------------------+        |
| | transient (score: 98,432)                                 |        |
| | "The transient nature of social media trends..."    [Copy]|        |
| +----------------------------------------------------------+        |
| +----------------------------------------------------------+        |
| | fleeting (score: 95,201)                                  |        |
| | "The fleeting nature of social media trends..."     [Copy]|        |
| +----------------------------------------------------------+        |
|                                                                      |
| [yellow dot] Good alternatives                                      |
| +----------------------------------------------------------+        |
| | brief (score: 72,100)                                     |        |
| | "The brief nature of social media trends..."        [Copy]|        |
| +----------------------------------------------------------+        |
|                                                                      |
| Sources: Datamuse API                                                |
+----------------------------------------------------------------------+
```

### 9. Languages Page (`languages/page.tsx`)

```
+----------------------------------------------------------------------+
| [Search: glass input]                                                |
| Search by name or code...                                            |
+----------------------------------------------------------------------+
|                                                                      |
| [Default Language Card: glass.strong]                                |
| Default Language                                                     |
| English [EN]                                                         |
| 469,000+ words                                                       |
+----------------------------------------------------------------------+
|                                                                      |
| [Language List: sortable by word count]                              |
| English        [EN]              469,000+ words  [check]             |
| French         [FR]               38,000+ words                     |
| German         [DE]               24,000+ words                     |
| Spanish        [ES]               22,000+ words                     |
| Portuguese     [PT]               18,000+ words                     |
| ...                                                                  |
+----------------------------------------------------------------------+
|                                                                      |
| Browse English Dictionary                                            |
| [A] [B] [C] [D] [E] [F] [G] [H] [I] [J] [K] [L] [M]              |
| [N] [O] [P] [Q] [R] [S] [T] [U] [V] [W] [X] [Y] [Z]              |
| Only English supports alphabetical browsing                          |
+----------------------------------------------------------------------+
```

## Component Inventory

### New Components (Words-specific)

| Component | File | Description |
|-----------|------|-------------|
| `WordResultCard` | Inline in page.tsx | Compact lookup result with save button |
| `WordDetailView` | Inline in [word]/page.tsx | Full two-column word detail |
| `SenseItem` | Inline in [word]/page.tsx | Recursive definition renderer (numbered, with examples, syn/ant) |
| `SavedWordsTable` | Inline in saved/page.tsx | Sortable, filterable data table |
| `SavedWordRow` | Inline in saved/page.tsx | Table row with inline actions |
| `WordListCard` | Inline in lists/page.tsx | List card with word count |
| `SuggestionRow` | Inline in helper/page.tsx | Replacement suggestion with copy button |
| `LanguageRow` | Inline in languages/page.tsx | Language list row |
| `LetterGrid` | Inline in languages/page.tsx | A-Z alphabetical browse grid |
| `MasteryDot` | `ui.ts` | Colored dot (red/yellow/green) based on lookup frequency |
| `LanguageBadge` | `ui.ts` helper | Small badge showing language code |

### Shared Patterns (from Books reference)

All inline styles following the Books pattern (no CSS modules, no Tailwind). Style constants defined at top of each file:

```typescript
const ACCENT = '#0EA5E9';
const ACCENT_DIM = 'rgba(14,165,233,0.15)';
const ACCENT_BORDER = 'rgba(14,165,233,0.25)';
const TEXT = '#F0F0F5';
const TEXT_SEC = 'rgba(240,240,245,0.65)';
const SURFACE = '#12121A';
const BORDER = 'rgba(255,255,255,0.06)';
const GLASS = 'rgba(255,255,255,0.04)';
const GLASS_STRONG = 'rgba(255,255,255,0.08)';
const GLASS_BORDER = 'rgba(255,255,255,0.10)';
```

### UI Helper Functions (`ui.ts`)

```typescript
computeMastery(lookedUpCount, lastLookedUpAt) -> { level, color, label }
formatDaysAgo(isoDate) -> string
formatDate(isoDate) -> string
formatLanguageName(code, languages) -> string
```

## Test Plan

### Unit Tests (Vitest)

| Test File | Coverage |
|-----------|----------|
| `__tests__/lookup-page.test.tsx` | Renders search bar, language pills, starter words, handles lookup result, shows type-ahead, displays error state, shows recent lookups |
| `__tests__/saved-page.test.tsx` | Renders data table, sort/filter chips work, search filters results, empty state shown, pagination works, favorite toggle calls action |
| `__tests__/word-detail-page.test.tsx` | Renders word header, definitions grouped by POS, thesaurus section, etymology section, save/unsave toggle, error + loading states |
| `__tests__/actions.test.ts` | All 25+ server actions call correct module functions with correct params, db() helper initializes and runs migrations |
| `__tests__/social-contract-parity.test.ts` | Web exports match mobile feature set: lookup, save, unsave, word lists, word helper, languages, settings, search, detail views |

### Parity Test Assertions

The social-contract parity test should verify:
- Web has lookup with language selection (mobile: index.tsx)
- Web has saved words with sort/filter/search (mobile: saved.tsx)
- Web has word detail with full definitions + thesaurus (mobile: word/[id].tsx)
- Web has saved word detail with notes + mastery + list (mobile: saved/[id].tsx)
- Web has word lists manager (mobile: list/[id].tsx)
- Web has word helper (mobile: helper.tsx)
- Web has language browser with A-Z browse (mobile: languages.tsx)
- Web has settings/cache management (exposed inline on relevant pages)

## QA Checklist

### Functional QA

- [ ] Lookup: type word, press Enter, see result
- [ ] Lookup: language pill selection changes lookup language
- [ ] Lookup: type-ahead shows cached/saved word matches after 2+ chars
- [ ] Lookup: "All 270+" link navigates to languages page
- [ ] Lookup: starter words appear on first run, disappear after first lookup
- [ ] Lookup: recent lookups show after first lookup, "Clear History" works
- [ ] Save: click bookmark on result card saves word to DB
- [ ] Save: click bookmark again unsaves word from DB
- [ ] Word Detail: navigate from lookup result "Full Entry" link
- [ ] Word Detail: definitions grouped by part of speech
- [ ] Word Detail: synonyms/antonyms clickable (navigate to that word)
- [ ] Word Detail: etymology section shows word history
- [ ] Word Detail: rhymes/word family/nearby words shown
- [ ] Word Detail: loading shows shimmer skeleton
- [ ] Word Detail: error shows retry button
- [ ] Saved Words: data table loads with all saved words
- [ ] Saved Words: sort by recent/A-Z/lookups/mastery works
- [ ] Saved Words: filter by favorites/language/mastery works
- [ ] Saved Words: search filters by word text
- [ ] Saved Words: click row navigates to saved word detail
- [ ] Saved Words: empty state shows warm CTA
- [ ] Saved Word Detail: shows definition, mastery, notes, list assignment
- [ ] Saved Word Detail: notes field editable with auto-save on blur
- [ ] Saved Word Detail: list assignment dropdown works
- [ ] Saved Word Detail: "View Full Entry" navigates to word detail
- [ ] Saved Word Detail: "Remove from Saved" deletes with confirmation
- [ ] Word Lists: shows all lists with word counts
- [ ] Word Lists: "New List" creates a list
- [ ] Word Lists: empty state shows warm CTA
- [ ] Word List Detail: shows words in list
- [ ] Word List Detail: edit list name/description
- [ ] Word List Detail: remove word from list
- [ ] Word Helper: paste sentence, select word, see replacements
- [ ] Word Helper: replacements grouped by relevance (high/medium/related)
- [ ] Word Helper: click suggestion copies replaced sentence
- [ ] Word Helper: language selection works
- [ ] Languages: searchable language list sorted by word count
- [ ] Languages: default language card shown
- [ ] Languages: A-Z browse grid opens modal with word list
- [ ] Languages: A-Z modal "Load More" pagination works
- [ ] All pages: loading shows skeleton, not spinner
- [ ] All pages: error shows retry, not technical message
- [ ] All pages: empty shows warm CTA, not "No items found"
- [ ] Navigation: all header nav links work
- [ ] Navigation: browser back/forward works correctly
- [ ] Keyboard: Cmd+K focuses search from any page

### Visual QA (Cool Obsidian Compliance)

- [ ] Background: `#0A0A0F` everywhere
- [ ] Text: `#F0F0F5` primary, `rgba(240,240,245,0.65)` secondary
- [ ] Cards: glass morphism with correct tokens
- [ ] Accent: `#0EA5E9` on header, active states, CTAs
- [ ] Font: Inter everywhere (no serif, no system font fallback visible)
- [ ] Border radius: 20px on large cards, 999px on pills, 8px on buttons
- [ ] No light theme cards inside dark background
- [ ] No developer-facing text visible
- [ ] Touch targets: 44px minimum on all interactive elements
- [ ] Glass blur: `backdrop-filter: blur(14px)` on header

### Responsive QA

- [ ] Desktop (>1024px): full layout, two-column word detail, data table
- [ ] Tablet (768-1024px): single column, data table simplifies to list
- [ ] Mobile (<768px): full single column, nav wraps or collapses

## Implementation Sequence

1. **actions.ts** -- Add all 25 server actions (biggest file, most foundational)
2. **ui.ts** -- Add shared helpers (mastery, formatting)
3. **layout.tsx** -- Module header with nav links
4. **page.tsx** -- Lookup page (the narrowest wedge, ship-test this first)
5. **[word]/page.tsx** -- Word detail (two-column layout)
6. **saved/page.tsx** -- Saved words data table
7. **saved/[id]/page.tsx** -- Saved word detail
8. **lists/page.tsx** -- Word lists manager
9. **lists/[id]/page.tsx** -- Word list detail
10. **helper/page.tsx** -- Word helper
11. **languages/page.tsx** -- Language browser
12. **__tests__/*.test.tsx** -- All test files
13. **Error handling pass** -- Wrap all server action calls in try/catch/finally per feedback memory

## Error Handling Rule

Per project feedback: all web module pages MUST wrap server action calls in try/catch/finally to prevent stuck loading states. Pattern:

```typescript
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  let cancelled = false;
  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchSomeAction();
      if (!cancelled) setData(data);
    } catch (err) {
      if (!cancelled) setError('Something went wrong. Please try again.');
    } finally {
      if (!cancelled) setLoading(false);
    }
  };
  void load();
  return () => { cancelled = true; };
}, []);
```

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| Office Hours | `/office-hours` | Web UX brainstorm (builder mode) | 1 | DONE | Narrowest wedge: keyboard-driven lookup. Multi-panel layouts for desktop. Data tables for saved words. |
| Eng Review | `/plan-eng-review` | Architecture & data flow | 1 | DONE | 25 missing server actions identified. Schema V1-V4 covers all features. Route structure: 7 pages + tests. |
| Design Review | `/plan-design-review` | UI/UX gaps & dimensions | 1 | DONE | 10 dimensions rated 8-10/10. All 5 states designed for 7 pages. Cool Obsidian compliant. |
| Design Consultation | `/design-consultation` | Design system finalization | 1 | DONE | Accent #0EA5E9, glass tokens, keyboard shortcuts, component reuse plan from Books. |

**VERDICT:** ALL 4 REVIEWS COMPLETE. Spec ready for implementation.
