# Hub Import Wizard -- UI/UX Implementation Prompt

**Screen:** Import Wizard (external data import flow)
**Route:** `apps/mobile/app/(hub)/import.tsx`
**Design System:** Cool Obsidian (Obsidian Noir variant)
**Platform:** React Native (Expo)
**Reference:** `stitch_loom_ui_ux_rebuild/import_wizard/`
**Shared Reference:** Read `hub-redesign-reference.md` first for token mapping and codebase connections.

---

## Codebase Connections

| What | Where |
|------|-------|
| Existing implementation | `apps/mobile/app/(hub)/import-wizard.tsx` (17 KB, import orchestration) |
| Migration package | `packages/migration/` (@mylife/migration, standalone importers) |
| Database access | `useDatabase()` from `apps/mobile/components/DatabaseProvider.tsx` |
| File picker | `expo-document-picker` for CSV/JSON file selection |
| Module definitions | `packages/module-registry/src/constants.ts` (target module for import) |

**Notes:**
- Import sources (Goodreads, YNAB, MyFitnessPal, Day One, CSV) should map to real importers in `packages/migration/`.
- The existing import-wizard.tsx at 17KB already has substantial import orchestration logic. The Stitch design is a visual redesign, not a logic rewrite.
- Parsing discrepancies (ISBN mismatches, multiple editions) are real scenarios from the books import flow.
- Privacy notice ("Your data is processed locally") is a critical trust signal. Always display it.
- Step indicator should use the existing StepIndicator component pattern from onboarding.

---

## Prompt

```
Design system: Obsidian Noir (dark theme, #131318 background, Plus Jakarta Sans, #C9894D/#ffb877 amber accent)

Component: MyLife Import Wizard (multi-step data import from external services)
Platform: React Native (Expo)
Route: apps/mobile/app/(hub)/import.tsx

Build the MyLife import wizard. A 4-step flow for importing data from external services (Goodreads, YNAB, MyFitnessPal, etc.) into MyLife modules. Each step is a distinct section with clear visual separation.

COLOR TOKENS:
- background: #131318
- surface-container-low: #1b1b20
- surface-container-high: #2a292f
- surface-container-highest: #35343a
- surface-container-lowest: #0e0e13
- primary: #ffb877 / #c9894d
- on-surface: #e4e1e9
- on-surface-variant: #d6c3b5
- on-primary: #4b2700
- error: #ffb4ab

LAYOUT:

1. TOP APP BAR (fixed)

2. PAGE HEADER
   - Breadcrumb: "IMPORT WIZARD" (xs uppercase tracking-widest on-surface-variant)
   - Title: "Sync your data" (3xl extrabold tracking-tight on-surface)
   - Step indicator: "Step 3 of 4" (sm on-surface-variant, right-aligned)

3. STEP 1: FILE UPLOAD
   - Card: bg-surface-container-low, p-8, rounded-lg, centered content
   - Upload icon: large centered Material icon (upload_file, primary, 5xl)
   - Title: "Upload Data File" (xl bold centered)
   - Description: "Select the .csv or .json file you exported from your provider. We'll handle the mapping and cleaning." (sm on-surface-variant centered)
   - Progress indicator (shown during processing):
     - Row: "PROCESSING..." label (xs uppercase tracking-widest on-surface-variant) + "68%" percentage (xs on-surface-variant)
   - CTA: "SELECT FILE" button (primary gradient pill, full-width max-w-xs centered, bold, with file icon)
   - Navigation: "BACK" (glass pill, left) + "NEXT STEP" (glass pill, right)

4. STEP 2: SOURCE SELECTION
   - Card: bg-surface-container-low, p-8, rounded-lg
   - Header: "SELECTED SOURCE" (xs uppercase tracking-widest on-surface-variant)
   - Source card (selected state):
     - bg-surface-container-high, p-5, rounded-lg, flex row
     - Service icon (e.g., Goodreads logo placeholder, w-12 h-12) + service name ("Goodreads", bold) + description ("Reading History", sm on-surface-variant)
     - Radio indicator: filled circle (primary)
   - Quick guide:
     - Header: "QUICK GUIDE" (xs uppercase tracking-widest on-surface-variant)
     - Numbered steps:
       1. 'Export your "Library" from Goodreads settings.'
       2. 'Ensure the file is in .CSV format.'
       3. 'Upload the file using the central portal.' (dimmed, not yet reached)
     - Each step: number badge (w-8 h-8 rounded-full bg-surface-container-highest centered primary bold) + instruction text (sm)
   - Privacy notice card:
     - bg-surface-container-high, p-4, rounded-lg, flex row
     - Shield icon (primary) + "Privacy Dashboard" title (bold sm) + description: "Your data is processed locally. We never store your credentials or raw export files." (xs on-surface-variant)

5. STEP 3: IMPORT PREVIEW (results dashboard)
   - Title: "Import Preview" (xl bold)
   - Stats grid (2x2, large numbers):
     - "1,248" BOOKS FOUND (3xl bold primary on surface-container-low card)
     - "98%" MATCH RATE (3xl bold primary)
     - "12" ERRORS (3xl bold error color #ffb4ab)
     - "0.8s" PROCESSING (3xl bold primary)
   - Each stat: large number on top (3xl bold, color varies) + label below (xs uppercase tracking-widest on-surface-variant)

6. STEP 4: PARSING DISCREPANCIES
   - Card: bg-surface-container-low, p-6, rounded-lg
   - Header: "PARSING DISCREPANCIES" label (xs uppercase tracking-widest on-surface-variant) + "Review required for 12 items" count (xs on-surface-variant, right)
   - Discrepancy list:
     Each item:
     - Warning icon (error/amber triangle) + title (bold sm) + issue description in parentheses (sm on-surface-variant)
     - Action: "FIX MANUALLY" link (xs bold primary uppercase tracking-widest, right-aligned, tappable)

   Sample items:
   - "The Great Gatsby (ISBN Mismatch)" -- FIX MANUALLY
   - "Foundation (Multiple Editions Found)" -- FIX MANUALLY

7. BOTTOM NAV (Sync tab active)

INTERACTIONS:
- File picker opens system document picker for .csv/.json/.sqlite files
- Progress bar animates during file processing
- Source selection is a radio-button-style single selection
- Import preview stats animate in with counting animation
- "FIX MANUALLY" opens a detail modal for conflict resolution
- Step indicator updates as user progresses
- Back/Next buttons navigate between steps
- Final step has "Complete Import" CTA

DESIGN RULES:
- Stats use large numbers for visual impact (inspired by data dashboards)
- Error count uses error color (#ffb4ab) to draw attention
- Privacy notice is always visible to reinforce trust
- Steps flow vertically on mobile (not horizontal tabs)
- Each step is a distinct card section separated by generous spacing
```
