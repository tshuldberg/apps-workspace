# MyWords -- UI/UX Design Prompt

Tagline: Look up any word, in any language
Icon: 📖 | Accent: #F59E0B | Tier: Premium
Bottom tabs: Home | Search | Saved | Lists | Settings

```
Design system: Cool Obsidian (dark theme — #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

Module: MyWords
Accent color: #F59E0B (amber)
Platform: Mobile (Expo / React Native)
Total screens: 10

---

SCREEN 1 — HOME (index.tsx) [Mobile, Tab: Home]

- Search bar prominent
  - Large search input at top of screen with magnifying glass icon
  - Placeholder text: "Look up any word..."
  - Tap to navigate to Search screen with keyboard open
- Word of the day card
  - Glass card with accent border
  - Word displayed large and bold
  - Part of speech label (e.g. "noun")
  - Brief definition (first definition, truncated if long)
  - Pronunciation (IPA notation)
  - Tap to navigate to full Word Detail screen
  - "New word" refreshes daily
- Recent lookups list
  - Section header: "Recent"
  - List of last 10-15 looked-up words
  - Each row: word, part of speech badge, brief definition preview
  - Tap to navigate to Word Detail
  - "Clear History" link at bottom of section

---

SCREEN 2 — SEARCH (search.tsx) [Mobile, Tab: Search]

- Search input
  - Auto-focused text input at top
  - Real-time search suggestions as user types
  - Clear button (X) in input field
- Language selector
  - Dropdown or pill below search bar showing current language
  - Tap to open language picker with 270+ languages
  - Search/filter within language list
  - Most recently used languages pinned at top
- Multi-provider results
  - Results pulled from multiple dictionary providers
  - Each result row: word, part of speech, brief definition, provider badge
  - Tap to navigate to full Word Detail
- Provider indicator
  - Small text or icon showing which dictionary provider returned the result
- Empty state
  - "No results found for '[query]'" with suggestions
- Loading state
  - Skeleton cards while fetching results

---

SCREEN 3 — WORD DETAIL ([id].tsx) [Mobile, navigated from any word tap]

- Word header
  - Word displayed very large at top
  - Part of speech badges (noun, verb, adjective, etc.) -- may have multiple
  - Language badge if not default language
- Pronunciations
  - IPA notation displayed (e.g. "/ˈwɜːrd/")
  - Audio play button -- tap to hear pronunciation
  - Multiple pronunciations if regional variants exist (US, UK)
- Definitions grouped by part of speech
  - Section per part of speech (noun, verb, etc.)
  - Numbered definitions within each section
  - Example sentences in italics below each definition
- Etymology
  - Collapsible section: word origin and history
  - Language of origin, root words, evolution
- Word forms
  - Section showing: plural, past tense, present participle, comparative, superlative (as applicable)
- Synonyms and antonyms
  - Horizontal scrollable chip rows
  - Synonyms section with tappable word chips (navigate to that word's detail)
  - Antonyms section with tappable word chips
- Rhymes
  - Scrollable chip row of rhyming words
  - Tappable to navigate to that word
- Save/bookmark button
  - Heart or bookmark icon in header
  - Toggles saved state, adds to Saved Words list
- Add to list button
  - "Add to List" button opens list picker bottom sheet

---

SCREEN 4 — SAVED WORDS (saved.tsx) [Mobile, Tab: Saved]

- Saved words list
  - Each row: word (bold), part of speech badge, brief definition (single line, truncated)
  - Swipe left to unsave/remove
  - Tap to navigate to Word Detail
- Search within saved
  - Search bar at top to filter saved words
- Sort options
  - Sort by: date saved (newest first), alphabetical (A-Z, Z-A), language
  - Toggle in header or sort button
- Empty state
  - "No saved words yet -- tap the bookmark icon on any word to save it"
- Count display
  - "42 saved words" at top or in header

---

SCREEN 5 — WORD LISTS (lists.tsx) [Mobile, Tab: Lists]

- Custom word list management
  - List of user-created word lists
  - Each row: list name, word count badge, language badge (if list is language-specific)
  - Swipe left to delete (with confirmation)
  - Tap to navigate to List Detail
- Create new list
  - "+" button or "New List" button in header
  - Bottom sheet: name input, optional description, optional language filter
- Default lists
  - "All Saved" (system list, not deletable)
  - "Word of the Day" (auto-populated)
- Empty state
  - "Create your first word list to organize your vocabulary"

---

SCREEN 6 — LIST DETAIL (list/[id].tsx) [Mobile, navigated from Lists]

- List header
  - List name (editable on tap)
  - Word count and description
- Words in list
  - Same row format as Saved Words: word, part of speech, definition preview
  - Tap to navigate to Word Detail
  - Swipe left to remove from list (does not unsave the word globally)
- Study mode link
  - Button: "Study with MyFlash"
  - Creates/links flashcard deck in the Flash module
  - Badge showing if flash deck already exists for this list
- Add words
  - "Add Words" button opens search interface filtered to saved words
  - Multi-select to add multiple words at once
- Sort/reorder
  - Alphabetical sort toggle
  - Manual drag-to-reorder option

---

SCREEN 7 — HELPER (helper.tsx) [Mobile, accessed from Home or Search]

- Crossword solver
  - Pattern input field with underscores for unknown letters (e.g. "c_t" finds "cat", "cut", "cot")
  - Wildcard character explanation
  - Results list showing matching words with definitions
  - Word length filter
- Anagram finder
  - Letter input field
  - Results list of valid anagram words
  - Sort by word length or alphabetical
- Word games tools section
  - Tools header with icons for each tool
  - Crossword helper, anagram solver clearly separated
- Results display
  - Tappable results -- navigate to Word Detail for any result
  - Result count shown

---

SCREEN 8 — BROWSE (browse.tsx) [Mobile, accessed from Home or Search]

- Alphabetical word browsing
  - Scrollable word list in alphabetical order
  - Each row: word, brief definition
  - Tap to navigate to Word Detail
- Letter picker
  - Vertical A-Z rail on right side of screen (like iOS Contacts)
  - Tap or drag to jump to that letter section
  - Current letter highlighted with accent color
- Language filter
  - Language selector at top (same as Search screen)
  - Browse words for selected language
- Section headers
  - Letter headers (A, B, C...) as sticky section dividers

---

SCREEN 9 — FLASH LINK (flash.tsx) [Mobile, accessed from Saved or List Detail]

- Create flashcards from saved words
  - Word selection: multi-select from saved words or a specific list
  - Preview: front (word) and back (definition + pronunciation)
- Send to MyFlash module
  - Deck selection: pick existing MyFlash deck or create new one
  - Deck name auto-suggested from word list name
  - Card format options: word-to-definition, definition-to-word, both directions
- Status display
  - "X cards ready to create"
  - "Send to MyFlash" button
- Confirmation
  - Success message: "24 flashcards created in deck 'Spanish Vocab'"
  - "Open MyFlash" link button

---

SCREEN 10 — SETTINGS (settings.tsx) [Mobile, Tab: Settings]

- Default language
  - Language picker showing current default
  - Search within language list
- Dictionary providers
  - List of available providers with toggle switches
  - Reorder priority (drag to reorder)
  - Provider status: connected (green dot), unavailable (gray dot)
- Cache settings
  - Cache size display (e.g. "142 MB cached")
  - "Clear Cache" button
  - Auto-cache toggle for offline access
- Offline data
  - Download language packs for offline use
  - Per-language download size shown
  - Downloaded languages with delete option
- Display preferences
  - Toggle: show IPA pronunciation
  - Toggle: show etymology by default
  - Toggle: show example sentences
- Data section
  - Export saved words (CSV/JSON)
  - Import word lists
```
