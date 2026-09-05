# MyJournal -- UI/UX Design Prompts

**Tagline:** Write freely, privately, yours forever
**Icon:** 📓 | **Accent:** #A78BFA | **Tier:** Free
**Bottom Tabs:** Today | Entries | Search | Notebooks | Settings
**Total Screens:** 17 mobile + 4 web = 21

---

## Prompt 1 -- Mobile Screens 1-12

```
Design system: Cool Obsidian (dark theme — #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

App: MyJournal
Platform: iOS (React Native / Expo)
Accent color: #A78BFA
Bottom tab bar: Today | Entries | Search | Notebooks | Settings

Design 12 mobile screens:

1. TODAY (index.tsx)
- Bottom tab bar with Today tab active, #A78BFA accent highlight
- Streak counter at top: flame icon, consecutive writing days number (large, bold, #A78BFA), "day streak" label
- Total word count stat card: book icon, formatted number, "words written" label
- Recent entries section (3 cards): title, first line preview (rgba(240,240,245,0.65)), date, mood emoji
- Daily prompt card on #12121A surface with rgba(255,255,255,0.10) border: prompt text in italic, "Write about this" button
- Quick action buttons row: "New Entry" (pen icon), "Voice Entry" (mic icon), "On This Day" (calendar icon) -- glass fill cards with #A78BFA icon tint
- Pull-to-refresh for new daily prompt

2. ENTRIES (entries.tsx)
- Bottom tab bar with Entries tab active
- Search bar at top: magnifying glass icon, #1A1A24 background, rgba(255,255,255,0.10) border
- Filter row below search: "All" | notebook name pills | tag pills -- glass fill, #A78BFA when active
- Entry list, each card on #12121A surface:
  - Title (bold, #F0F0F5)
  - Mood indicator emoji (left of title)
  - First line preview (1 line, rgba(240,240,245,0.65))
  - Date (formatted, rgba(240,240,245,0.65))
  - Notebook badge (small pill, glass fill)
  - Tag chips (horizontal, small, glass fill)
- Swipe-to-delete with #FF453A background
- FAB bottom-right for new entry, #A78BFA fill

3. NEW ENTRY (new.tsx)
- Full-screen editor, nav bar: "Cancel" (left), "Save" (right, #A78BFA)
- Title input at top: large font, placeholder "Entry title"
- Markdown editor body: multi-line, #0A0A0F background
- Floating toolbar at bottom (above keyboard):
  - Bold (B), Italic (I), Heading (H), Link (chain), List (bullets), Code (brackets), Image (photo icon)
  - Toolbar on #1A1A24 surface with rgba(255,255,255,0.06) top border
- Mood tag selector row: 5 emoji levels (great/good/okay/low/bad), selectable, #A78BFA ring when selected
- Custom tags section: existing tag chips + "Add Tag" button with color picker popover
- Image attachment button in toolbar opens photo picker
- Word count in bottom-right corner, rgba(240,240,245,0.65)

4. ENTRY DETAIL ([id].tsx)
- Nav bar: back arrow, edit button (pencil icon), overflow menu (share, delete, export)
- Full entry rendered markdown on #0A0A0F background
- Metadata section at top in rgba(240,240,245,0.65):
  - Location pin icon + location name
  - Cloud icon + weather description
  - Globe icon + timezone
  - Hash icon + word count
  - Calendar icon + creation date
- Tags displayed as chips below metadata
- Mood emoji displayed next to date
- Share button in overflow menu

5. SEARCH (search.tsx)
- Bottom tab bar with Search tab active
- Large search input, auto-focus, #1A1A24 background
- Full-text search across title and body
- Result list: entry title, matched text snippet with highlighted keywords (#A78BFA background tint), date
- Recent searches section when input is empty (clock icon per item)
- Empty state: magnifying glass illustration, "Search your journal" text
- Result count displayed below search bar

6. NOTEBOOKS (notebooks.tsx)
- Bottom tab bar with Notebooks tab active
- Notebook grid/list: each card on #12121A surface
  - Notebook name (bold)
  - Entry count
  - Last updated date (rgba(240,240,245,0.65))
  - Color indicator strip on left edge
- Create notebook button at top: "New Notebook" with + icon
- Long-press context menu per notebook: Rename, Change Color, Delete
- Default notebook indicated with star icon
- Swipe-to-delete with confirmation dialog

7. ON THIS DAY (on-this-day.tsx)
- Nav bar: back arrow, "On This Day" title with calendar icon
- Date displayed prominently: "April 4" in large text
- Historical entries from same date in prior years
- Year section headers: "2025", "2024", etc.
- Entry cards: mood emoji, title, first line preview, year badge
- Smart nostalgia ranking: most significant entries surfaced first (based on length, mood intensity)
- Empty state if no prior entries: "Start writing today to build your history"
- Left/right swipe or arrows to browse adjacent dates

8. PROMPTS (prompts.tsx)
- Nav bar: back arrow, "Daily Prompts" title
- Category tabs: Reflection | Gratitude | Therapy | Stoic -- #A78BFA underline on active
- Daily featured prompt: large card on #12121A surface, prompt text, "Write" button (#A78BFA)
- Prompt list below: scrollable, each prompt on glass fill card
- Refresh button to get new prompts
- AI-powered mood-aware suggestions section: "Based on your recent mood" header, 3 personalized prompts
- Tap any prompt to open new entry with prompt pre-filled as header

9. VOICE ENTRY (voice.tsx)
- Full-screen recording interface
- Large circular record button center-screen: red when recording, #A78BFA when idle
- Recording waveform visualization: horizontal bars animating with audio input
- Timer showing recording duration (MM:SS)
- Status labels: "Tap to Record" / "Recording..." / "Processing..."
- Transcription section below: real-time text appearing as speech is recognized
- After recording: transcription text in editable text area
- "Edit & Save" button (#A78BFA) and "Discard" button (outlined)
- Quality indicator: confidence percentage for transcription accuracy

10. GRID/MANDALA (grid.tsx)
- Nav bar: back arrow, "Visual Journal" title
- Grid/mandala layout view for visual journaling
- Template picker at top: horizontal scroll of built-in templates (grid, mandala, mood board, timeline)
- Canvas area: selected template rendered as interactive layout
- Tap cells/sections to add text, images, or stickers
- Color palette selector for cell backgrounds
- Save button in nav bar
- Zoom and pan gestures supported

11. VISION BOARD (vision-board.tsx)
- Nav bar: back arrow, "Vision Board" title, "Edit" toggle
- Freeform canvas with drag-and-drop items
- Item types: image (from photos), text card, quote card, goal card
- Add button (+) opens type picker: Image | Text | Quote | Goal
- Each item: draggable, resizable handles when in edit mode
- Background selector: solid colors or gradient options
- Pin/lock items to prevent accidental movement
- Export/share button for the complete board image

12. AFFIRMATIONS (affirmations.tsx)
- Nav bar: back arrow, "Affirmations" title
- Daily affirmation displayed large and centered on glass card with #A78BFA accent border
- 8 category tabs in horizontal scroll: Self-Worth | Gratitude | Health | Career | Relationships | Creativity | Resilience | Growth
- Streak counter: consecutive days of affirmation practice
- "Next" button to cycle affirmation within category
- "Save to Journal" button (#A78BFA) to create entry with affirmation
- Favorite toggle (heart icon) per affirmation
- History section: recently viewed affirmations list
```

---

## Prompt 2 -- Mobile Screens 13-17 + Web Pages 18-21

```
Design system: Cool Obsidian (dark theme — #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

App: MyJournal
Accent color: #A78BFA

Design 9 screens (5 mobile + 4 web):

--- MOBILE (iOS, React Native / Expo) ---

1. PHILOSOPHY (philosophy.tsx)
- Nav bar: back arrow, "Philosophy" title with scroll icon
- 5 tradition tabs in horizontal scroll: Stoic | Buddhist | Taoist | Existentialist | Pragmatist -- #A78BFA underline on active
- Daily quote displayed prominently: large card on #12121A surface
  - Quote text in serif-style rendering (or italic), #F0F0F5
  - Attribution below: philosopher name, tradition badge
- "Save to Journal" button (#A78BFA)
- "New Quote" button (outlined) to refresh
- Browse section below: scrollable list of quotes per tradition
- Favorite toggle (heart icon) per quote
- Tap quote to expand with context/explanation

2. CBT RECORDS (cbt.tsx)
- Nav bar: back arrow, "Thought Records" title
- Record list: each card on #12121A surface showing situation summary, date, primary emotion, belief strength change indicator
- "New Record" FAB (#A78BFA)
- New record form (multi-step or scrollable):
  - Situation: text input -- "What happened?"
  - Automatic Thought: text input -- "What went through your mind?"
  - Emotions: multi-select emotion chips with intensity slider (0-100) per emotion
  - Evidence For: text input for supporting evidence
  - Evidence Against: text input for contradicting evidence
  - Balanced Thought: text input for reframed thought
- 15 cognitive distortions checklist: scrollable list with checkboxes (All-or-Nothing, Overgeneralization, Mental Filter, etc.)
- Belief strength tracking: "Before" slider (0-100) and "After" slider (0-100) with visual comparison
- Save button (#A78BFA)

3. THERAPY PREP (therapy.tsx)
- Nav bar: back arrow, "Therapy Prep" title
- Two main sections as tab toggle: Pre-Session | Post-Session
- Pre-Session template card on #12121A surface:
  - "Topics to Discuss" -- editable bullet list, add/remove items
  - "Questions for Therapist" -- editable bullet list
  - "Mood Summary" -- auto-generated from recent journal mood data, editable
  - "Since Last Session" -- text area for updates
- Post-Session template card:
  - "Key Insights" -- bullet list
  - "Homework / Action Items" -- checklist with checkboxes
  - "Progress Check-In" -- 1-10 scale slider
- Crisis Plan section (expandable accordion):
  - Emergency contacts list
  - Coping strategies checklist
  - Warning signs list
- Session history: list of past prep notes with dates

4. BOOK BUILDER (book-builder.tsx)
- Nav bar: back arrow, "Book Builder" title
- Step indicator at top: 1. Select Entries > 2. Arrange > 3. Cover > 4. Preview
- Entry selector: checkbox list of all journal entries, filterable by notebook/date range/tag
- Selected count badge: "12 entries selected"
- Page layout estimation: "~48 pages" calculated from word count
- Arrange step: drag-to-reorder selected entries, section divider insertion
- Cover template picker: 4-6 cover designs in horizontal scroll, title/author name input overlaid
- Preview step: page-flip preview showing entry layout
- "Generate Book" button (#A78BFA) -- exports as PDF
- Format options: page size, font size, include/exclude metadata

5. SETTINGS (settings.tsx)
- Bottom tab bar with Settings tab active
- Settings sections on #12121A surface cards:
  - Default Notebook: dropdown selector
  - Daily Prompt Category: preference picker
  - Font Preferences: font family selector, size slider
  - Privacy: passcode/biometric lock toggle, auto-lock timer
- Export section:
  - "Export All Entries" button -- format picker (Markdown/JSON/PDF)
  - "Export Bundle" -- full backup including images
  - Last export date shown
- Data section:
  - Entry count, total word count, date range
  - Storage used indicator
- Danger zone: "Delete All Entries" in #FF453A, requires confirmation
- App version at bottom in rgba(240,240,245,0.65)

--- WEB (Next.js 15, desktop layout with persistent MyLife hub sidebar) ---

6. TODAY (/journal)
- Content area centered, max-width 720px
- Left: daily prompt card (prominent), streak counter, word count stat
- Recent entries list (5 entries): title, date, mood, preview
- Quick actions: "New Entry", "Voice Entry", "On This Day" as card buttons
- Right sidebar area (if space): calendar mini-view with dots on days with entries

7. ENTRIES (/journal/entries)
- Two-column layout: filter sidebar (left, 240px) + entry list (right)
- Filter sidebar: notebook filter, tag filter, date range picker, mood filter
- Entry list: larger cards than mobile, title, full first paragraph preview, metadata row
- Grid/list view toggle
- Search bar at top of entry list
- Pagination or infinite scroll

8. SEARCH (/journal/search)
- Large search input centered at top
- Full-text search with result highlighting (#A78BFA background tint on matched text)
- Result cards: title, matched context snippet, date, notebook, tags
- Search operators help text: "Use quotes for exact match"
- Recent searches sidebar
- Result count displayed

9. SETTINGS (/journal/settings)
- Form layout on #12121A surface cards, max-width 640px
- Same sections as mobile settings: default notebook, font, privacy, export
- Export section with download buttons for each format
- Data statistics displayed as stat cards
- Account-level preferences
```
