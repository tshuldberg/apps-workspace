# Feature Spec: MyVoice Full Web UI

## Metadata
- **Module:** voice
- **Task ID:** W14-6
- **Priority Score:** 28 / 50 (B-Tier)
- **Scoring Breakdown:** Market 3 x3 + Switching 2 x3 + Complexity 3 x2 + CrossModule 3 x1 + PaidUser 2 x1
- **Sprint:** Sprint 3
- **Estimated CC Time:** 5-7 hours
- **Depends On:** All V1-V2 CRUD, text/speaker/commands/language engines, mobile UI (2 screens), schema v2 complete
- **Blocks:** Voice full cross-platform parity, web module completion dashboard metric
- **Reference Implementation:** `apps/web/app/books/` (layout, page, actions, sub-routes, tests)
- **Design Pipeline:** /office-hours (builder) -> /plan-eng-review -> /plan-design-review -> /design-consultation

## Phase 1: Office Hours (Builder Mode) -- Web UX Brainstorm

### What Makes a Voice App Delightful on Desktop

Desktop changes the voice game entirely. On mobile, voice is the natural input; on desktop, voice is a power tool for people who already have keyboards. The web UI needs to lean into what desktop does better than mobile:

1. **Transcript management as a workspace.** The killer desktop use case is not recording (mobile wins there) but reviewing, editing, organizing, and searching through transcription history. Desktop is where you sit with 40 transcriptions and need to find, compare, and export them. A searchable, sortable data table of transcriptions with inline metadata is far more powerful than mobile's scrollable list.

2. **Multi-panel layouts for speaker diarization.** On mobile, diarization shows a linear chat-style view. On desktop, the left panel shows the full transcript with color-coded speaker labels, the right panel shows speaker breakdown stats, a timeline visualization, and speaker management. You can see the full conversation structure at a glance.

3. **Keyword and text analysis dashboard.** Desktop can show word count, reading time, keyword extraction, and text summarization all at once in a dense stats panel alongside the transcript. Mobile spreads this across taps and scrolls.

4. **Voice command management.** Creating, editing, and testing voice commands is a power-user workflow. Desktop can show a full command table with phrase, action, target module, priority, usage stats, enable/disable toggle, and an inline test input. Mobile would need 3-4 screens for the same.

5. **Language profile configuration.** A settings panel with language profiles, supported languages browser, and per-profile language selection is natural on desktop. Drag-and-drop to reorder languages, click to toggle, see all 18 supported languages in a grid.

6. **Bulk operations.** Select multiple transcriptions, bulk delete, bulk export, bulk tag. Desktop affordances that are clumsy on touch.

### The Narrowest Wedge

**The Transcriptions page.** A searchable, sortable data table of all transcriptions with duration, language, word count, date, and keywords visible in columns. Click any row to expand the full transcript with speaker segments, language breakdown, and text analysis. The "I need this on desktop" moment: you have weeks of voice notes and need to find the one where you discussed project timelines -- full-text search across all transcriptions, instant results, click to read. This is the Raycast-for-your-voice-notes experience.

### How Information Density Differs From Mobile

| Dimension | Mobile | Web |
|-----------|--------|-----|
| Transcription list | Vertical cards, title + date | Data table: title, duration, language, words, date, keywords |
| Transcript view | Single column, linear scroll | Two-panel: transcript left, analysis/speakers right |
| Speaker diarization | Chat bubble style | Color-coded blocks + speaker timeline + breakdown chart |
| Stats overview | 4 metric cards | Dense stats bar + language distribution chart + trends |
| Voice commands | List with tap-to-edit | Full table with inline editing, test input, usage stats |
| Language profiles | Stack of profile cards | Grid of all 18 languages with profile presets sidebar |
| Settings | Single scrollable page | Tabbed settings panel with immediate preview |

### Linear/Raycast Aesthetic Patterns

- **Command palette (`Cmd+K`):** Jump to any transcription, search across all text
- **Glass card surfaces:** Frosted translucent cards for transcription entries and stats
- **Color-coded speaker labels:** Speaker colors from engine (blue, orange, emerald, violet, etc.) on dark glass
- **Language badges:** Color-coded pills matching LANGUAGE_COLORS (en=blue, es=orange, zh=red, etc.)
- **Keyboard shortcuts displayed inline:** `Cmd+N` next to new recording, `Cmd+F` for search
- **Dense information layout:** No wasted space, stats always visible, no hero sections inside app

## Phase 2: Engineering Review -- Architecture Lock

### Module Exports Audit

The `@mylife/voice` module exports 40+ functions across 6 categories. Here is what the web UI needs:

| Category | Functions Needed | Status |
|----------|-----------------|--------|
| **Transcription CRUD** | `createTranscription`, `getTranscription`, `getTranscriptions`, `deleteTranscription` | None in web actions.ts -- all need adding |
| **Voice Note CRUD** | `createVoiceNote`, `getVoiceNote`, `getVoiceNotes`, `updateVoiceNote`, `deleteVoiceNote`, `toggleFavorite` | None -- all need adding |
| **Settings** | `setSetting`, `getSetting`, `getSettings` | None -- all need adding |
| **Stats** | `getTranscriptionStats` | None -- needs adding |
| **Speaker CRUD** | `createSpeaker`, `getSpeaker`, `getSpeakers`, `updateSpeaker`, `deleteSpeaker` | None -- all need adding |
| **Speaker Segments** | `createSpeakerSegment`, `getSpeakerSegments`, `updateSegmentSpeaker` | None -- all need adding |
| **Commands CRUD** | `createCommand`, `getCommand`, `getCommands`, `updateCommand`, `deleteCommand`, `incrementCommandUsage` | None -- all need adding |
| **Command Log** | `logCommandExecution`, `getCommandLog` | None -- all need adding |
| **Language Segments** | `createLanguageSegment`, `getLanguageSegments`, `getLanguageBreakdown` | None -- all need adding |
| **Language Profiles** | `createLanguageProfile`, `getLanguageProfile`, `getLanguageProfiles`, `setDefaultProfile`, `deleteLanguageProfile` | None -- all need adding |
| **Text Engine** | `calculateWordCount`, `calculateReadingTime`, `extractKeywords`, `summarizeText`, `formatDuration` | Client-side -- import directly |
| **Speaker Engine** | `SPEAKER_COLORS`, `getSpeakerColor`, `mergeShortSegments`, `assignSpeakerLabels`, `isMultiSpeaker`, `getSpeakerBreakdown`, `processDiarization` | Client-side -- import directly |
| **Commands Engine** | `normalizePhrase`, `phraseToRegex`, `hasVariableSlots`, `matchCommand`, `PRESET_TEMPLATES` | Client-side -- import directly |
| **Language Engine** | `LANGUAGE_COLORS`, `SUPPORTED_LANGUAGES`, `MAX_PROFILE_LANGUAGES`, `isValidBcp47`, `getBaseLanguage`, `getLanguageColor`, `mergeAdjacentLanguageSegments`, `calculateLanguageBreakdown`, `isMultiLanguage`, `validateProfileLanguages`, `processLanguageDetection` | Client-side -- import directly |

### Server Actions Needed (actions.ts)

The current web page has zero server actions. The web UI needs ~30 server actions:

```typescript
// Transcription CRUD -- 4 new
createTranscriptionAction(input: { text: string; durationSeconds: number; language?: string; confidence?: number; audioUri?: string })
fetchTranscriptionAction(id: string)
fetchTranscriptionsAction(options?: { limit?: number; offset?: number })
deleteTranscriptionAction(id: string)

// Voice Note CRUD -- 6 new
createVoiceNoteAction(input: { title: string; transcriptionId?: string; tags?: string })
fetchVoiceNoteAction(id: string)
fetchVoiceNotesAction(options?: { limit?: number; offset?: number })
updateVoiceNoteAction(id: string, input: { title?: string; tags?: string; isFavorite?: boolean })
deleteVoiceNoteAction(id: string)
toggleFavoriteAction(id: string)

// Settings -- 3 new
setSettingAction(key: string, value: string)
fetchSettingAction(key: string)
fetchSettingsAction()

// Stats -- 1 new
fetchTranscriptionStatsAction()

// Speaker CRUD -- 5 new
createSpeakerAction(input: { name: string; color?: string })
fetchSpeakerAction(id: string)
fetchSpeakersAction()
updateSpeakerAction(id: string, input: { name?: string; color?: string })
deleteSpeakerAction(id: string)

// Speaker Segments -- 3 new
createSpeakerSegmentAction(input: { transcriptionId: string; speakerId?: string; speakerLabel: string; startSeconds: number; endSeconds: number; text: string; confidence?: number })
fetchSpeakerSegmentsAction(transcriptionId: string)
updateSegmentSpeakerAction(segmentId: string, speakerId: string | null, speakerLabel: string)

// Commands CRUD -- 5 new
createCommandAction(input: { phrase: string; action: string; moduleTarget?: string; params?: string; priority?: number })
fetchCommandsAction(options?: { enabledOnly?: boolean })
updateCommandAction(id: string, input: { phrase?: string; action?: string; moduleTarget?: string; isEnabled?: boolean; priority?: number })
deleteCommandAction(id: string)
incrementCommandUsageAction(id: string)

// Command Log -- 2 new
logCommandExecutionAction(input: { commandId: string; matchedPhrase: string; matchConfidence?: number; success: boolean; errorMessage?: string })
fetchCommandLogAction(options?: { commandId?: string; limit?: number })

// Language Segments -- 3 new
createLanguageSegmentAction(input: { transcriptionId: string; language: string; startSeconds: number; endSeconds: number; text: string; confidence?: number })
fetchLanguageSegmentsAction(transcriptionId: string)
fetchLanguageBreakdownAction(transcriptionId: string)

// Language Profiles -- 5 new
createLanguageProfileAction(input: { name: string; languages: string[]; isDefault?: boolean })
fetchLanguageProfilesAction()
setDefaultProfileAction(id: string)
deleteLanguageProfileAction(id: string)
```

All server actions follow the books pattern: `'use server'` directive, import `getAdapter` and `ensureModuleMigrations` from `@/lib/db`, call `ensureModuleMigrations('voice')` before any query.

### Schema Verification

The schema (V1-V2) supports all planned features:
- **V1:** `vc_transcriptions`, `vc_voice_notes`, `vc_settings` with indexes on created_at, language, favorite, transcription_id
- **V2:** `vc_speakers`, `vc_speaker_segments`, `vc_commands`, `vc_command_log`, `vc_language_segments`, `vc_language_profiles` with comprehensive indexes

No schema gaps. All features have backend support. No additional CRUD operations or engine functions needed.

### Missing Module Functions

One gap identified: no full-text search across transcription text. For MVP, use LIKE-based search in a new server action:

```typescript
searchTranscriptionsAction(query: string, options?: { limit?: number; offset?: number })
// SQL: SELECT * FROM vc_transcriptions WHERE text LIKE '%query%' ORDER BY created_at DESC
```

This is acceptable for MVP. FTS5 can be added in a future schema migration if search volume warrants it.

### Web Route Structure (Next.js App Router)

```
apps/web/app/voice/
  layout.tsx                    -- Module layout: header nav bar + content area
  page.tsx                      -- Dashboard: stats overview + recent transcriptions
  actions.ts                    -- All server actions (~30 functions)
  ui.ts                         -- Shared UI helpers (formatting, color utils)
  transcriptions/
    page.tsx                    -- Full transcription list: data table + search + filters
  transcriptions/[id]/
    page.tsx                    -- Transcription detail: full text, speaker segments, language breakdown, analysis
  notes/
    page.tsx                    -- Voice notes: organized by title, tags, favorites
  speakers/
    page.tsx                    -- Speaker management: named speakers, color assignment, sample counts
  commands/
    page.tsx                    -- Voice commands: full table with inline editing, presets, test input
  languages/
    page.tsx                    -- Language profiles: supported languages grid, profile management
  settings/
    page.tsx                    -- Module settings: recording preferences, auto-save, default language
  __tests__/
    dashboard-page.test.tsx     -- Dashboard page tests
    transcriptions-page.test.tsx-- Transcription list tests
    transcription-detail.test.tsx -- Detail page tests
    commands-page.test.tsx      -- Commands page tests
    actions.test.ts             -- Server actions tests
    social-contract-parity.test.ts -- Parity with mobile feature set
```

### Data Flow

```
Dashboard page load:
  -> fetchTranscriptionStatsAction() for stats
  -> fetchTranscriptionsAction({ limit: 5 }) for recent
  -> fetchVoiceNotesAction({ limit: 5 }) for recent notes
  -> Client renders stats bar + recent lists

Transcriptions page load:
  -> fetchTranscriptionsAction() with pagination params
  -> Client-side state manages sort, filter, search, pagination

Transcription detail load:
  -> fetchTranscriptionAction(id) for main text
  -> fetchSpeakerSegmentsAction(id) for diarization
  -> fetchLanguageSegmentsAction(id) for language breakdown
  -> Client computes: calculateWordCount, calculateReadingTime, extractKeywords, summarizeText
  -> All rendered in two-panel layout

Commands page load:
  -> fetchCommandsAction() for all commands
  -> Client renders table with PRESET_TEMPLATES for quick-add
  -> Inline test: matchCommand(inputPhrase, commands) runs client-side

Voice notes page:
  -> fetchVoiceNotesAction() with pagination
  -> Toggle favorite: toggleFavoriteAction(id) -> re-render
```

### State Management

Client-side `useState` + `useEffect` pattern (same as books). No global state library needed. Key state patterns:

- **Dashboard:** `stats`, `recentTranscriptions[]`, `recentNotes[]`, `loading`
- **Transcriptions:** `transcriptions[]`, `sortBy`, `searchQuery`, `languageFilter`, `page`, `loading`
- **Transcription detail:** `transcription`, `speakerSegments[]`, `languageSegments[]`, `loading`, `error`, `analysis` (computed client-side)
- **Voice notes:** `notes[]`, `filterFavorites`, `tagFilter`, `searchQuery`, `page`
- **Commands:** `commands[]`, `testPhrase`, `testResult`, `showPresets`
- **Speakers:** `speakers[]`, `editingSpeakerId`, `newSpeakerName`
- **Languages:** `profiles[]`, `supportedLanguages`, `editingProfileId`
- **Settings:** `settings{}`, `saving`

## Phase 3: Design Review -- Dimension Ratings

### Design Dimension Scores

| Dimension | Score | Rationale | What Makes It a 10 |
|-----------|-------|-----------|---------------------|
| **Information Architecture** | 9/10 | 8-route structure covers all module domains: dashboard, transcriptions, notes, speakers, commands, languages, settings | Breadcrumb trail for deep navigation in detail pages |
| **Information Density** | 9/10 | Desktop-optimized: two-column transcript detail, data tables for lists, stats always visible | Collapsible sidebar for speaker/language panels when not needed |
| **Keyboard Accessibility** | 8/10 | Cmd+K global search, Tab through table rows, Enter to open detail, Escape to close | Add per-row keyboard shortcuts for quick actions (favorite, delete) |
| **Visual Hierarchy** | 9/10 | Dashboard -> Stats bar -> Recent items -> Action cards flows naturally | Color-coded speaker and language badges create strong visual anchoring |
| **Cool Obsidian Compliance** | 10/10 | Red accent (#EF4444), glass cards, dark background, Inter font, all tokens from DESIGN.md | Already defined in module definition |
| **Empty States** | 9/10 | Warm CTAs per DESIGN.md: "Your voice, your words" not "No items found" | Module-specific microphone illustration |
| **Error States** | 9/10 | Inline retry, no technical messages, glass card error containers | Add "Your data is safe -- everything is stored on-device" messaging |
| **Loading States** | 9/10 | Skeleton screens matching content layout for all pages | Skeletons pulse at 60% opacity per DESIGN.md |
| **Responsiveness** | 8/10 | Desktop-first but degrades to tablet (2-col to 1-col), mobile (single column) | Test at all 3 breakpoints (768, 1024, 1120+) |
| **Micro-interactions** | 8/10 | Favorite toggle animation, hover states on table rows, speaker color dots | Add waveform-style visual on transcription cards as decorative element |

### All 5 States Designed Per Page

| Page | Loading | Empty | Error | Success | Partial |
|------|---------|-------|-------|---------|---------|
| **Dashboard** | 4 skeleton metric cards + 2 skeleton lists | "Your voice, your words" + mic icon + "Start recording on mobile to see your transcriptions here" | "Could not load stats" + Retry button | Stats bar + recent transcriptions + recent notes | Stats loaded but no recent items |
| **Transcriptions** | Skeleton rows in data table | "No transcriptions yet" + "Record on mobile to get started" + link to mobile app | "Could not load transcriptions" + Retry | Full data table with sort, search, language filter | Search results: "N results for 'query'" |
| **Transcription Detail** | Two-panel shimmer (left: 6 text lines, right: 3 stat cards) | N/A (always navigated from list) | "Transcription not found" + Back button | Full transcript + speakers + languages + analysis | Transcript loaded, no speaker/language data |
| **Voice Notes** | Skeleton cards with title and date placeholders | "Organize your voice notes" + "Create notes from your transcriptions" | "Could not load notes" + Retry | Grid of note cards with favorite stars | Filtered view: "N favorites" or "Tagged: #tag" |
| **Speakers** | Skeleton avatar + name rows | "No speakers identified yet" + "Speaker identification happens automatically during transcription" | "Could not load speakers" + Retry | Speaker cards with color dots + sample counts | Speakers loaded, edit modal open |
| **Commands** | Skeleton table rows | "Voice commands let you control MyLife by speaking" + preset template grid + "Add your first command" | "Could not load commands" + Retry | Full table with toggle, usage stats, test input | Presets shown but no custom commands |
| **Languages** | Skeleton grid of language flags | N/A (always shows SUPPORTED_LANGUAGES from engine) | "Could not load profiles" + Retry | 18-language grid + profile sidebar | Default profile only, no custom profiles |
| **Settings** | Inline shimmer for each setting row | Default settings pre-populated | "Could not load settings" + Retry | All settings visible with toggle/select controls | Some settings loaded, others at defaults |

## Phase 4: Design Consultation -- Final Design System Decisions

### Module Identity

- **Accent Color:** `#EF4444` (red) -- from `packages/ui/src/tokens/colors.ts` and `definition.ts`
- **Accent Dim:** `rgba(239,68,68,0.15)` -- for hero section background, active state backgrounds
- **Accent Border:** `rgba(239,68,68,0.25)` -- for active states and borders
- **Icon:** Microphone emoji (consistent with definition.ts)
- **Header Title:** "MyVoice" in accent color, 30px, weight 800
- **Tagline:** "Private on-device dictation"

### Component Reuse from packages/ui/ and Existing Web Modules

| Component Pattern | Source | Usage in Voice |
|-------------------|--------|----------------|
| Glass card (`rgba(255,255,255,0.04)` + `rgba(255,255,255,0.06)` border) | DESIGN.md tokens | Transcription cards, note cards, speaker cards |
| Glass strong (`rgba(255,255,255,0.08)` + `rgba(255,255,255,0.10)` border) | DESIGN.md tokens | Detail header, active stats, command test area |
| Pill button (border-radius: 999, padding: 8px 14px) | Books page.tsx | Language filter pills, tag pills, speaker color dots |
| Active pill (accent background, dark text) | Books page.tsx | Selected language, active filter |
| Data table row (flex row, border-bottom, hover highlight) | Books page.tsx list mode | Transcription table, command table |
| Hero section (accent-dim bg, accent border, flex between) | Books page.tsx | Dashboard hero, transcriptions stats bar |
| Nav header (glass dock bg, backdrop-filter blur, nav links) | Books layout.tsx | Voice layout header |
| Empty state (dashed border, centered text, CTA links) | Books page.tsx | All empty states |
| Toggle switch | General pattern | Command enable/disable, setting toggles |

### Typography Decisions

| Element | Variant | Size | Weight |
|---------|---------|------|--------|
| Module title (layout) | custom | 30px | 800 |
| Stats numbers | stat | 36px | 700 |
| Section headers | heading | 24px | 700 |
| Card titles | subheading | 18px | 600 |
| Transcript text | body | 16px / 26px LH | 400 |
| Speaker labels | label | 12px | 600, uppercase |
| Language badges | caption | 13px | 500 |
| Timestamps/metadata | caption | 13px | 500 |
| Nav links | custom | 14px | 600 |
| Command phrases | body mono | 16px | 500 |

### Color Palette (Module-Specific)

| Token | Value | Usage |
|-------|-------|-------|
| `ACCENT` | `#EF4444` | Primary accent, header title, CTA buttons |
| `ACCENT_DIM` | `rgba(239,68,68,0.15)` | Hero bg, active state bg |
| `ACCENT_BORDER` | `rgba(239,68,68,0.25)` | Active borders, hero border |
| Speaker colors | `SPEAKER_COLORS` from engine | `#60A5FA`, `#F97316`, `#34D399`, `#A78BFA`, etc. |
| Language colors | `LANGUAGE_COLORS` from engine | `en=#60A5FA`, `es=#F97316`, `zh=#EF4444`, etc. |

### Keyboard Shortcuts

| Shortcut | Action | Context |
|----------|--------|---------|
| `Cmd+K` / `Ctrl+K` | Focus search / global search | Global |
| `Enter` | Open selected transcription / Execute search | Table row selected / Search focused |
| `Escape` | Clear search / Close modal | Search focused / Modal open |
| `Cmd+Delete` / `Ctrl+Delete` | Delete selected item | Item selected |
| `Arrow Up/Down` | Navigate table rows | Table focused |
| `Tab` | Move between interactive elements | Global |
| `F` | Toggle favorite (when note selected) | Notes page |

## Page-by-Page Wireframes

### 1. Layout (`layout.tsx`)

```
+----------------------------------------------------------------------+
| [#EF4444] MyVoice     Dashboard | Transcriptions | Notes | Commands  |
| Private on-device dictation                     Speakers | Languages |
+----------------------------------------------------------------------+
|                                                                      |
|  {children}                                                          |
|  max-width: 1120px, centered, padding: 32px 24px                    |
|                                                                      |
+----------------------------------------------------------------------+
```

Header: glass dock background (`rgba(18,18,26,0.78)` + `backdrop-filter: blur(14px)`), bottom border. Module name "MyVoice" in accent color (#EF4444). Nav links in textSecondary, 14px weight 600. 7 nav links: Dashboard, Transcriptions, Notes, Commands, Speakers, Languages, Settings (last 3 on right or second row at narrow widths).

### 2. Dashboard (`page.tsx`)

```
+----------------------------------------------------------------------+
| [Hero Section: accent-dim bg, accent border]                         |
|   "Your Voice Dashboard"                                             |
|   "X transcriptions, Y hours recorded"                               |
+----------------------------------------------------------------------+
|                                                                      |
| [Stats Grid: 4 glass cards]                                         |
| +--------+ +--------+ +--------+ +--------+                         |
| | Total  | |Duration| |Avg Len | |Languages|                        |
| | 42     | | 3h 45m | | 2m 30s | | 4      |                        |
| +--------+ +--------+ +--------+ +--------+                         |
|                                                                      |
| Recent Transcriptions                    [View All ->]               |
| +----------------------------------------------------------+        |
| | "Meeting notes about Q2 pl..."   2m 30s  EN  Mar 23     |        |
| | "Idea for new feature..."        45s     EN  Mar 22      |        |
| | "Grocery list for weekend..."    1m 12s  ES  Mar 21      |        |
| +----------------------------------------------------------+        |
|                                                                      |
| Recent Voice Notes                       [View All ->]               |
| +----------------------------------------------------------+        |
| | "Project Planning"    #work  [star]     Mar 23           |        |
| | "Recipe Ideas"        #food             Mar 22            |        |
| +----------------------------------------------------------+        |
|                                                                      |
| -- OR (empty state) --                                               |
| +----------------------------------------------------------+        |
| |  [mic icon]                                               |        |
| |  "Your voice, your words"                                 |        |
| |  Start recording on mobile to see transcriptions here.    |        |
| +----------------------------------------------------------+        |
+----------------------------------------------------------------------+
```

### 3. Transcriptions Page (`transcriptions/page.tsx`)

```
+----------------------------------------------------------------------+
| [Hero: accent-dim bg]                                                |
|   "Transcriptions"                      [Search: Cmd+K]             |
|   "42 transcriptions, 3h 45m total"                                  |
+----------------------------------------------------------------------+
| [Filter Pills]                                                       |
| [All] [English] [Spanish] [French] [Multi-language]                  |
+----------------------------------------------------------------------+
| [Data Table: glass card]                                             |
| +------------------------------------------------------------------+|
| | Text Preview          | Duration | Language | Words | Date       ||
| |------------------------------------------------------------------||
| | Meeting notes about Q2| 2m 30s   | EN       | 342   | Mar 23    ||
| | Idea for new feature  | 45s      | EN       | 98    | Mar 22    ||
| | Lista de compras...   | 1m 12s   | ES       | 156   | Mar 21    ||
| | Code review feedback  | 4m 10s   | EN [2sp] | 523   | Mar 20    ||
| +------------------------------------------------------------------+|
|                                                                      |
| [Pagination: < 1 2 3 ... 5 >]                                       |
+----------------------------------------------------------------------+
```

Column headers are sortable (click to sort asc/desc). The `[2sp]` badge indicates multi-speaker. Language pills use LANGUAGE_COLORS. Click any row to navigate to detail page.

### 4. Transcription Detail (`transcriptions/[id]/page.tsx`)

Two-column layout on desktop (>1024px), single column on mobile/tablet.

```
+----------------------------------------------------------------------+
| [Back to Transcriptions]                                             |
+----------------------------------------------------------------------+
| LEFT COLUMN (60%)                | RIGHT COLUMN (40%)                |
|                                  |                                   |
| [Header Card: glass.strong]      | [Analysis Card: glass.strong]    |
| "Meeting notes about Q2..."     | Word Count: 342                  |
| 2m 30s  |  EN  |  Mar 23, 2026  | Reading Time: ~2 min             |
| [Delete]                         | Confidence: 94%                  |
|                                  |                                   |
| [Full Transcript]                | [Keywords Card]                  |
| "So for Q2 we need to focus     | [quarterly] [budget]             |
|  on three key areas. First,     | [planning] [timeline]            |
|  the quarterly budget needs     | [revenue]                        |
|  review. Second, we should      |                                   |
|  finalize the project           | [Summary Card]                   |
|  timeline..."                    | "Discussion covering Q2          |
|                                  |  priorities: budget review,       |
| -- IF multi-speaker --           |  project timeline, and           |
| [Speaker 1: blue]               |  revenue targets."               |
| "So for Q2 we need to focus     |                                   |
|  on three key areas."           | [Speaker Breakdown Card]         |
| [Speaker 2: orange]             | Speaker 1: 1m 45s (70%)         |
| "Right, and the budget was      | Speaker 2: 45s (30%)            |
|  already reviewed last month."  |                                   |
| [Speaker 1: blue]               | [Language Breakdown Card]        |
| "True, but the new numbers..."  | English: 100%                   |
|                                  | (or multi-lang pie)             |
+----------------------------------------------------------------------+
```

Speaker segments are color-coded blocks using `SPEAKER_COLORS`. Each block shows the speaker label and their assigned color. If no speakers, show plain transcript text.

### 5. Voice Notes Page (`notes/page.tsx`)

```
+----------------------------------------------------------------------+
| [Hero: accent-dim bg]                                                |
|   "Voice Notes"                         [+ New Note]                 |
|   "15 notes, 3 favorites"                                           |
+----------------------------------------------------------------------+
| [Filter: All | Favorites | Tags: #work #personal #ideas]            |
+----------------------------------------------------------------------+
| [Notes Grid: 2-3 columns of glass cards]                            |
| +--------------------------+ +--------------------------+            |
| | "Project Planning"       | | "Recipe Ideas"           |            |
| | #work  #planning         | | #food  #personal         |            |
| | [star: filled]           | |                           |            |
| | Linked to: "Meeting..."  | | Linked to: "Lista de..." |            |
| | Mar 23, 2026             | | Mar 22, 2026             |            |
| +--------------------------+ +--------------------------+            |
|                                                                      |
| -- OR (empty state) --                                               |
| +----------------------------------------------------------+        |
| |  "Organize your voice notes"                              |        |
| |  Create notes from your transcriptions to keep            |        |
| |  important thoughts organized and easily findable.        |        |
| |  [Create First Note]                                      |        |
| +----------------------------------------------------------+        |
+----------------------------------------------------------------------+
```

### 6. Commands Page (`commands/page.tsx`)

```
+----------------------------------------------------------------------+
| [Hero: accent-dim bg]                                                |
|   "Voice Commands"                      [+ New Command]              |
|   "Control MyLife modules with your voice"                           |
+----------------------------------------------------------------------+
|                                                                      |
| [Test Command Area: glass.strong]                                    |
| +----------------------------------------------------------+        |
| | Try a command: [Type a phrase to test...          ] [Test] |        |
| | Result: "Start fasting" -> fast module, action: start_fast|        |
| +----------------------------------------------------------+        |
|                                                                      |
| [Custom Commands: data table]                                        |
| +------------------------------------------------------------------+|
| | Phrase              | Action     | Target | Priority | Uses | On ||
| |------------------------------------------------------------------||
| | "Start fasting"     | start_fast | fast   | 0        | 12   | [x]||
| | "Add expense [amt]" | add_expense| budget | 0        | 8    | [x]||
| | "Log mood [rating]" | log_mood   | mood   | 0        | 5    | [x]||
| +------------------------------------------------------------------+|
|                                                                      |
| [Preset Templates: collapsed by default]                             |
| [+ Show 10 preset templates]                                        |
| +------------------------------------------------------------------+|
| | "Start fasting"              -> fast   [Add]                     ||
| | "End my fast"                -> fast   [Add]                     ||
| | "Add expense [amount]"       -> budget [Add]                     ||
| | "Quick note [text]"          -> notes  [Add]                     ||
| | "Mark [habit] done"          -> habits [Add]                     ||
| | ... 5 more                                                       ||
| +------------------------------------------------------------------+|
+----------------------------------------------------------------------+
```

### 7. Speakers Page (`speakers/page.tsx`)

```
+----------------------------------------------------------------------+
| [Hero: accent-dim bg]                                                |
|   "Speakers"                            [+ Add Speaker]              |
|   "Manage identified speakers"                                       |
+----------------------------------------------------------------------+
|                                                                      |
| [Speaker Cards: grid of glass cards]                                 |
| +--------------------------+ +--------------------------+            |
| | [blue dot] Speaker 1     | | [orange dot] Speaker 2   |            |
| | "Trey"                   | | "Alex"                   |            |
| | 12 samples               | | 5 samples                |            |
| | [Edit] [Delete]          | | [Edit] [Delete]          |            |
| +--------------------------+ +--------------------------+            |
|                                                                      |
| -- OR (empty state) --                                               |
| +----------------------------------------------------------+        |
| |  "No speakers identified yet"                             |        |
| |  Speaker identification happens automatically during      |        |
| |  transcription. Add speakers manually to label them.      |        |
| |  [Add Speaker]                                            |        |
| +----------------------------------------------------------+        |
+----------------------------------------------------------------------+
```

### 8. Languages Page (`languages/page.tsx`)

```
+----------------------------------------------------------------------+
| [Hero: accent-dim bg]                                                |
|   "Languages"                           [+ New Profile]              |
|   "18 supported languages, 2 profiles"                               |
+----------------------------------------------------------------------+
|                                                                      |
| [Profiles Sidebar (left 30%)]   | [Languages Grid (right 70%)]      |
| +-------------------+           | +------------------------------+   |
| | * Default Profile |           | | [blue] English (US)   en-US |   |
| |   EN-US, ES-US    |           | | [blue] English (UK)   en-GB |   |
| |                   |           | | [orange] Spanish (US) es-US |   |
| | Bilingual         |           | | [orange] Spanish (ES) es-ES |   |
| |   EN-US, FR-FR    |           | | [orange] Spanish (MX) es-MX |   |
| |                   |           | | [red] Mandarin (Simp) zh-CN |   |
| | [+ New Profile]   |           | | [red] Mandarin (Trad) zh-TW |   |
| +-------------------+           | | [indigo] French (FR)  fr-FR |   |
|                                  | | [indigo] French (CA)  fr-CA |   |
|                                  | | [amber] German        de-DE |   |
|                                  | | [pink] Japanese       ja-JP |   |
|                                  | | [teal] Korean         ko-KR |   |
|                                  | | [emerald] Portuguese  pt-BR |   |
|                                  | | [emerald] Portuguese  pt-PT |   |
|                                  | | [violet] Hindi        hi-IN |   |
|                                  | | [l.orange] Arabic     ar-SA |   |
|                                  | | [green] Italian       it-IT |   |
|                                  | | [sky] Russian         ru-RU |   |
|                                  | +------------------------------+   |
+----------------------------------------------------------------------+
```

### 9. Settings Page (`settings/page.tsx`)

```
+----------------------------------------------------------------------+
| [Hero: accent-dim bg]                                                |
|   "Settings"                                                         |
|   "Configure your voice preferences"                                 |
+----------------------------------------------------------------------+
|                                                                      |
| [Glass card sections]                                                |
| Recording                                                            |
| +----------------------------------------------------------+        |
| | Default Language       [English (US) v]                   |        |
| | Audio Quality          [Standard v]                       |        |
| | Auto-save recordings   [toggle: on]                       |        |
| +----------------------------------------------------------+        |
|                                                                      |
| Transcription                                                        |
| +----------------------------------------------------------+        |
| | Auto-detect language   [toggle: off]                      |        |
| | Speaker identification [toggle: on]                       |        |
| +----------------------------------------------------------+        |
|                                                                      |
| Data                                                                 |
| +----------------------------------------------------------+        |
| | Export all transcriptions   [Export JSON]                  |        |
| | Total storage used          12.4 MB                       |        |
| +----------------------------------------------------------+        |
+----------------------------------------------------------------------+
```

## Component Inventory

| Component | File | Description |
|-----------|------|-------------|
| `VoiceLayout` | `layout.tsx` | Glass header with nav, max-width container |
| `MetricCard` | `page.tsx` | Stat number + label in glass card |
| `TranscriptionRow` | `transcriptions/page.tsx` | Table row with preview, duration, language pill, date |
| `TranscriptionDetail` | `transcriptions/[id]/page.tsx` | Two-column detail with transcript + analysis |
| `SpeakerSegmentBlock` | `transcriptions/[id]/page.tsx` | Color-coded speaker text block |
| `LanguagePill` | shared via `ui.ts` | Color-coded language badge (uses LANGUAGE_COLORS) |
| `SpeakerDot` | shared via `ui.ts` | Small colored circle for speaker identity |
| `NoteCard` | `notes/page.tsx` | Glass card with title, tags, favorite star, date |
| `CommandRow` | `commands/page.tsx` | Table row with phrase, action, target, toggle |
| `CommandTestArea` | `commands/page.tsx` | Glass.strong input + result area for testing commands |
| `PresetTemplateGrid` | `commands/page.tsx` | Collapsible grid of PRESET_TEMPLATES |
| `SpeakerCard` | `speakers/page.tsx` | Glass card with color dot, name, sample count |
| `LanguageGrid` | `languages/page.tsx` | Grid of all SUPPORTED_LANGUAGES with color badges |
| `ProfileSidebar` | `languages/page.tsx` | List of language profiles with default indicator |
| `SettingsSection` | `settings/page.tsx` | Glass card group with label + control pairs |
| `KeywordChip` | `transcriptions/[id]/page.tsx` | Small pill showing extracted keyword |
| `AnalysisPanel` | `transcriptions/[id]/page.tsx` | Right column: word count, reading time, keywords, summary |

## Test Plan

### Unit Tests (actions.test.ts)
- All 30+ server actions return correct data types
- Database adapter initialization with `ensureModuleMigrations('voice')`
- Error handling: missing IDs return null, invalid inputs throw
- Pagination: limit/offset respected for transcriptions, notes, commands

### Page Tests (per-page .test.tsx)
- **Dashboard:** Renders stats, recent lists, empty state when no data
- **Transcriptions:** Renders table, language filter pills, search, pagination
- **Transcription Detail:** Renders two-column layout, speaker segments when present, analysis panel
- **Notes:** Renders note grid, favorite toggle, tag filter
- **Commands:** Renders command table, test area, preset templates
- **Speakers:** Renders speaker cards, add/edit/delete flows
- **Languages:** Renders language grid, profile sidebar, default profile indicator

### Parity Test (social-contract-parity.test.ts)
- Mobile has 2 screens (dictate + history) -- web must cover equivalent functionality
- Stats display: both platforms show total count, duration, avg length, languages
- Transcription list: both platforms show chronological list with date and language
- Empty state: both platforms show encouraging message (not "No items found")

## QA Checklist

- [ ] Dashboard loads with correct stats from `getTranscriptionStats`
- [ ] Transcription data table is sortable by all columns
- [ ] Search filters transcriptions by text content
- [ ] Language pills filter by language
- [ ] Transcription detail shows full text
- [ ] Speaker segments render with correct colors from `SPEAKER_COLORS`
- [ ] Language breakdown shows percentages from `getLanguageBreakdown`
- [ ] Keywords extracted via `extractKeywords` display as chips
- [ ] Summary generated via `summarizeText` shows in analysis panel
- [ ] Voice notes grid shows favorites with filled star
- [ ] Favorite toggle calls `toggleFavoriteAction` and re-renders
- [ ] Note tags display as pills
- [ ] Commands table shows all fields including usage count
- [ ] Command enable/disable toggle works via `updateCommandAction`
- [ ] Preset templates can be added as new commands
- [ ] Command test area uses `matchCommand` engine client-side
- [ ] Speaker cards show correct colors and sample counts
- [ ] Add/edit/delete speaker flows work end-to-end
- [ ] Language grid shows all 18 SUPPORTED_LANGUAGES
- [ ] Language profiles can be created, set as default, deleted
- [ ] Settings page loads current values from `getSettings`
- [ ] Setting changes persist via `setSettingAction`
- [ ] All empty states use warm copy (not "No items found")
- [ ] All loading states use skeleton screens (not spinners)
- [ ] All error states show retry button in glass card
- [ ] Cool Obsidian tokens used throughout: background, surface, text, textSecondary, border
- [ ] Accent color #EF4444 used for header, CTAs, active states
- [ ] Glass morphism applied: backdrop-filter on header, glass.card on cards
- [ ] Responsive: degrades cleanly at 768px and 1024px breakpoints
- [ ] All server actions wrap in try/catch/finally to prevent stuck loading states
- [ ] Max-width 1120px content area, centered, 32px 24px padding
