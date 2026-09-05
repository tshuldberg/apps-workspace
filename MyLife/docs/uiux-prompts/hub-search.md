# Hub Search -- UI/UX Implementation Prompt

**Screen:** Search (cross-module global search)
**Route:** `apps/mobile/app/(hub)/search.tsx`
**Design System:** Cool Obsidian (Obsidian Noir variant)
**Platform:** React Native (Expo)
**Reference:** `stitch_loom_ui_ux_rebuild/loom_search/`
**Shared Reference:** Read `hub-redesign-reference.md` first for token mapping and codebase connections.

---

## Codebase Connections

| What | Where |
|------|-------|
| Existing implementation | `apps/mobile/app/(hub)/search.tsx` (11 KB, full-text search) |
| Search package | `@mylife/search` (cross-module search engine) |
| Enabled modules | `useEnabledModules()` from `@mylife/module-registry` |
| Module definitions | `packages/module-registry/src/constants.ts` (accent colors for result grouping) |
| Database access | `useDatabase()` from `apps/mobile/components/DatabaseProvider.tsx` |
| SearchBar component | `packages/ui/src/components/SearchBar.tsx` |
| Glass tokens | `packages/ui/src/tokens/glass.ts` |
| Color tokens | `packages/ui/src/tokens/colors.ts` (moduleAccent map for per-module result headers) |

**Notes:**
- Existing search uses the `@mylife/search` package for cross-module FTS. The Stitch design shows the same concept with richer result rendering.
- Activity feed (empty state) is new. Data source: could use a hub_activity table or aggregate recent module events.
- Result grouping by module should use each module's accent color for the header icon, not a universal amber.
- "GLOBAL" badge toggle (Global vs per-module scope) is a new feature in the Stitch design.

---

## Prompt

```
Design system: Obsidian Noir (dark theme, #131318 background, Plus Jakarta Sans, #C9894D/#ffb877 amber accent)

Component: MyLife Global Search (cross-module search with activity feed)
Platform: React Native (Expo)
Route: apps/mobile/app/(hub)/search.tsx

Build the MyLife global search screen. Searches across all enabled modules simultaneously and displays results grouped by module. When the search field is empty, shows a recent activity feed. Results highlight matched keywords in amber.

COLOR TOKENS:
- background: #131318
- surface-container-low: #1b1b20
- surface-container-high: #2a292f
- surface-container-highest: #35343a
- primary: #ffb877
- primary-container: #c9894d
- on-surface: #e4e1e9
- on-surface-variant: #d6c3b5
- outline: #9f8e81
- outline-variant: #52443a
- tertiary: #8bcff0

LAYOUT:

1. TOP APP BAR (fixed, same as other screens)
   - Hamburger + "MyLife" wordmark + user avatar

2. SEARCH INPUT (prominent, large)
   - Full-width, h-20, rounded-full, bg-surface-container-highest, no border
   - Left: search icon (outline-variant color, transitions to primary on focus)
   - Input: xl font-light, placeholder "Search across all modules..." (on-surface-variant)
   - Right: "GLOBAL" badge pill (bg-primary/10, text-primary, px-4 py-2, rounded-full, xs bold uppercase tracking-widest)
   - Focus: ring-2 ring-primary/20
   - 200ms debounce on input

3. EMPTY STATE: RECENT ACTIVITY FEED (shown when search is empty)
   - Section header: "RECENT ACTIVITY" (sm bold uppercase tracking-[0.15em] on-surface-variant) + history icon (right, sm, outline color, tappable)
   - Container: bg-surface-container-low, p-6, rounded-lg
   - Activity items (vertical list, space-y-4):
     Each item is a row:
     - Status dot: w-2 h-2 rounded-full
       - Active/book: primary (#ffb877) with shadow glow (0 0 8px rgba(201,137,77,0.5))
       - Budget/tertiary: tertiary (#8bcff0) with shadow glow
       - System/passive: outline-variant, no glow
     - Module icon: Material Symbols, on-surface-variant, lg size
     - Text column:
       - Action text: xs font-medium on-surface (e.g., 'Book indexed: "Parametric Design"')
       - Timestamp: 10px, outline color (e.g., "2m ago", "15m ago", "Yesterday")
     - Older items: progressively lower opacity (80%, 60%)

   Sample activity items:
   - Book indexed: "Parametric Design" -- 2m ago (primary dot, auto_fix_high icon)
   - Budget updated: "Studio Q3" -- 15m ago (tertiary dot, payments icon)
   - Cloud sync complete -- 1h ago (outline-variant dot, sync icon)
   - Added "Modernist Void" to Archive -- 3h ago (primary dot, collections_bookmark icon)
   - Security audit run -- 5h ago (outline-variant dot, shield_person icon)
   - Restored "Asset_042.mylife" -- Yesterday (primary dot, history icon)

   Footer: "VIEW FULL JOURNAL" link (10px uppercase tracking-widest primary bold, full-width, py-2, hover:bg-white/5, border-t border-white/5)

4. SEARCH RESULTS (shown when query is entered, grouped by module)

   Each module group:
   - Header row: filled module icon (primary or tertiary color) + module name (sm bold uppercase tracking-widest on-surface) + gradient divider line (h-[1px] from outline-variant/40 to transparent)

   MYBOOKS RESULTS:
   - 2-column grid of book cards
   - Each card: bg-surface-container-high, p-5, rounded-lg, border border-white/5, hover:bg-surface-variant
   - Layout: book cover thumbnail (w-16 h-24, bg-surface-container-highest, rounded-sm, cover image) + text column
   - Title: bold on-surface, matched keyword wrapped in primary color span
   - Author: xs on-surface-variant
   - Timestamp: 10px outline with schedule icon (e.g., "Accessed 2 days ago", "Last read Sep 14")

   MYBUDGET RESULTS:
   - Table layout: bg-surface-container-low, rounded-lg, border border-white/5, overflow-hidden
   - Header row: bg-surface-container, 10px uppercase tracking-widest outline color, columns: Entity/Invoice | Value | Date
   - Data rows: hover:bg-white/5, border-b border-white/5
     - Entity: font-medium, matched keyword in primary bold. Sub-text: invoice number (10px outline)
     - Value: right-aligned, font-mono, tertiary color (e.g., "$1,250.00")
     - Date: right-aligned, xs, outline color

   SYNC CLOUD ASSETS:
   - Row of pill-shaped file chips
   - Each chip: bg-surface-container-low, px-4 py-3, rounded-full, flex row with file icon + filename
   - Filename: xs font-medium, matched keyword in primary span
   - Hover: bg-primary/10, text transitions to primary
   - Icons: folder_zip, description (PDF), image (PNG)

5. BOTTOM NAV (Search tab active)

INTERACTIONS:
- Real-time search with 200ms debounce
- Results appear with staggered fade-in animation
- Book cards and budget rows are tappable, navigate to item detail in respective module
- Activity items are tappable, navigate to relevant module/item
- Pull-to-refresh on activity feed
- "Global" badge is tappable to switch between Global and per-module search scope

DESIGN RULES:
- Keyword highlighting: wrap matched text in primary (#ffb877) colored span, bold weight
- Module group headers use gradient divider lines, not solid borders
- Activity dots use CSS shadow for glow effect
- No empty result state: show "No results found" with search icon when query returns nothing
```
