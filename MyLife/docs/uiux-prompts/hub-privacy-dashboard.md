# Hub Privacy Dashboard -- UI/UX Implementation Prompt

**Screen:** Privacy Dashboard (storage, data footprint, destructive actions)
**Route:** `apps/mobile/app/(hub)/privacy.tsx`
**Design System:** Cool Obsidian (Obsidian Noir variant)
**Platform:** React Native (Expo)
**Reference:** `stitch_loom_ui_ux_rebuild/privacy_dashboard/`
**Shared Reference:** Read `hub-redesign-reference.md` first for token mapping and codebase connections.

---

## Codebase Connections

| What | Where |
|------|-------|
| Existing implementation | `apps/mobile/app/(hub)/privacy.tsx` (16 KB) |
| Database access | `useDatabase()` from `apps/mobile/components/DatabaseProvider.tsx` |
| Module definitions | `packages/module-registry/src/constants.ts` (table prefixes for storage calc) |
| DB package | `packages/db/` (@mylife/db, SQLite adapter, migration orchestration) |
| Enabled modules | `useEnabledModules()` from `@mylife/module-registry` |
| Glass tokens | `packages/ui/src/tokens/glass.ts` |
| Color tokens | `packages/ui/src/tokens/colors.ts` (danger/error colors for destructive zone) |

**Notes:**
- Storage allocation bar chart data should be computed from actual SQLite table sizes (using `PRAGMA table_info` or file size estimates per table prefix).
- "Identity Modules" accordion maps to per-module table groups. Each module's tablePrefix from its definition gives the table set.
- "Delete All Data" is a destructive action. Implement with two-step confirmation dialog and ensure it drops all prefixed tables, not the hub schema.
- Cloud sync percentage should reflect actual sync state if cloud sync is implemented.

---

## Prompt

```
Design system: Obsidian Noir (dark theme, #131318 background, Plus Jakarta Sans, #C9894D/#ffb877 amber accent)

Component: MyLife Privacy Dashboard (storage visualization, data modules, delete zone)
Platform: React Native (Expo)
Route: apps/mobile/app/(hub)/privacy.tsx

Build the MyLife privacy dashboard. Users monitor their data footprint, see storage allocation by category, review per-module data records, and access the destructive "Delete All Data" action. This is a settings sub-screen accessed from the main Settings page.

COLOR TOKENS:
- background: #131318
- surface-container-low: #1b1b20
- surface-container-high: #2a292f
- surface-container-highest: #35343a
- surface-container-lowest: #0e0e13
- primary: #ffb877 / #c9894d
- on-surface: #e4e1e9
- on-surface-variant: #d6c3b5
- outline-variant: #52443a
- error: #ffb4ab
- error-container: #93000a
- on-error: #690005
- on-error-container: #ffdad6
- tertiary: #8bcff0

LAYOUT:

1. TOP APP BAR (fixed)

2. PAGE HEADER
   - Title: "Privacy Dashboard" (4xl extrabold tracking-tight on-surface)
   - Subtitle: "Control your digital footprint. View storage distribution, manage data synchronization, and curate your private library." (on-surface-variant, lg, relaxed leading, max-w-2xl)

3. STORAGE VISUALIZATION BENTO (2-column grid)

   LEFT CARD (2/3 width) -- Storage Allocation:
   - bg-surface-container-low, p-8, rounded-lg, relative overflow-hidden
   - Header: "STORAGE ALLOCATION" (xs uppercase tracking-[0.1em] bold primary)
   - Bar chart (5 vertical bars, h-32 area):
     - Each bar: flex-1, rounded-t-md, varying heights via style percentage
     - Colors at varying primary opacities: Books (20%), Archived (100%), Metadata (40%), Media (tertiary/20%), Other (10%)
     - Hover: opacity increases by 20%, cursor-pointer
   - X-axis labels: "Books | Archived | Metadata | Media | Other" (10px uppercase tracking-wider semibold on-surface-variant at 60%)
   - Decorative: huge faded database icon (200px, filled, absolute -right-12 -bottom-12, 5% opacity)

   RIGHT CARD (1/3 width) -- Total Footprint:
   - bg-surface-container-high, p-8, rounded-lg, flex column justify-between
   - Top: "TOTAL FOOTPRINT" label (xs uppercase tracking-[0.1em] bold on-surface-variant) + "1.2 GB" (4xl bold on-surface, with "GB" in xl normal on-surface-variant)
   - Bottom (border-t border-outline-variant/10, pt-4):
     - Row: "Cloud Sync" label (sm on-surface-variant) + "85%" value (sm bold primary)
     - Progress bar: w-full h-1.5 rounded-full, bg-surface-container-lowest track, primary fill at 85% width with shadow glow (0 0 8px rgba(201,137,77,0.4))

4. IDENTITY MODULES ACCORDION
   - Section header: "IDENTITY MODULES" (xs uppercase tracking-[0.2em] bold on-surface-variant at 50%)
   - Vertical list of expandable module cards:

   COLLAPSED MODULE CARD:
   - bg-surface-container-low, rounded-lg
   - Row layout (p-6): icon circle (w-12 h-12 rounded-full bg-primary/10, primary Material icon filled) + text column (title: bold lg + record count: sm on-surface-variant) + status badge + expand icon
   - Status badges:
     - "LOCAL ONLY": bg-white/5, 10px bold uppercase tracking-widest on-surface-variant, border border-outline-variant/10, rounded-full
     - "CLOUD LINKED": bg-primary/10, 10px bold uppercase tracking-widest primary, border border-primary/20, rounded-full
   - Chevron: expand_more (on-surface-variant at 40%)
   - Hover: bg-white/5

   EXPANDED MODULE CARD:
   - Same as collapsed but with border border-primary/10
   - Header background: bg-white/5
   - Chevron: expand_less (primary color)
   - Expanded content (px-6 pb-6 pt-2):
     - Inner container: bg-surface-container-lowest at 50% opacity, rounded-xl, p-4
     - Data rows (space-y-3): label (sm on-surface-variant) + value (sm font-mono on-surface), separated by border-b border-outline-variant/5
     - Example rows: "Global Access Logs -- 842 rows", "Device Handshakes -- 312 rows", "Encryption Keys -- 50 rows"

   Sample modules:
   - Personal Library: book_2 icon (filled), 428 records, LOCAL ONLY
   - Sync History: sync_saved_locally icon (filled), 1,204 records, CLOUD LINKED (expanded by default)
   - Search Manifest: manage_search icon (filled), 89 records, CLOUD LINKED

5. DESTRUCTIVE ZONE
   - mt-16, p-8, rounded-lg
   - Background: error-container at 5% opacity, border border-error-container at 10% opacity
   - Section header: "DESTRUCTIVE ZONE" (xs uppercase tracking-[0.2em] bold error color)
   - Content row:
     - Left (max-w-md): "Delete All Collected Data" (on-surface leading-snug semibold) + warning text "This action is permanent. All local and cloud records across every module will be purged. This cannot be undone." (sm on-surface-variant relaxed leading)
     - Right: Delete button (bg-error-container text-on-error-container, hover:bg-error hover:text-on-error, px-8 py-4, rounded-full, bold, flex row with delete_forever icon + "Delete All Data" text, active:scale-95)

6. BOTTOM NAV (Settings tab active)

INTERACTIONS:
- Module cards expand/collapse on tap with smooth height animation
- Bar chart bars show tooltip with exact values on tap/long-press
- Delete button requires confirmation dialog (two-step: first tap shows confirmation, second tap executes)
- Storage values are dynamically calculated from SQLite database size
- Cloud Sync percentage reflects actual sync completion status

DESIGN RULES:
- Bar chart uses primary opacity variations, not different colors
- Destructive zone is visually separated with error tint
- Accordion animation: smooth spring easing
- Data rows in expanded cards use monospace for values
```
