# Feature Spec: Grid/Mandala Layout

## Metadata
- **Module:** journal
- **Priority Score:** 24 / 50 (B-Tier)
- **Scoring Breakdown:** Market 3 x3 + Switching 2 x3 + Complexity 3 x2 + CrossModule 1 x1 + PaidUser 2 x1
- **Sprint:** Sprint 6 (B+C Features)
- **Estimated CC Time:** 3-4 hours
- **Depends On:** JR-001 (Rich Text Editor -- implemented), entry_type system (V3, implemented)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Grid Diary charges $23/yr for structured grid-based journaling and has proven that many people find a blank page intimidating. By dividing the entry into small, focused cells with individual prompts, grid layouts reduce "blank page anxiety" and make journaling feel approachable. Diarium also offers calendar-view grid layouts. MyJournal can offer both free-form and grid-based entry formats, covering both writing styles in a single app.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Grid Diary | Yes | $23/yr | Grid-only format (2x2, 3x3, custom). Core product. Cloud-synced. |
| Diarium | Yes | $5-10 one-time | Calendar view with grid-style daily entries. Multi-platform. |
| Day One | No | N/A | Free-form entries only. No grid layout option. |
| Reflectly | No | N/A | Guided prompts but not in grid format. |

### Target User
Journalers who struggle with blank page anxiety. Grid Diary users paying $23/yr who want the same structured experience in a privacy-first app. People who prefer answering specific questions over open-ended writing. Beginners who find guided grid prompts easier than free-form journaling.

## Technical Context

### Where This Lives in MyLife

```
modules/journal/src/grid/                          -- NEW: grid layout engine
modules/journal/src/grid/types.ts                  -- GridConfig, GridCell, GridLayout types
modules/journal/src/grid/layouts.ts                -- 5 built-in grid layout definitions
modules/journal/src/grid/grid-engine.ts            -- Grid assembly, validation, Markdown conversion
modules/journal/src/grid/index.ts                  -- Barrel export
modules/journal/src/grid/__tests__/                -- Tests
modules/journal/src/db/grid.ts                     -- NEW: CRUD for grid cells
apps/mobile/app/(journal)/grid-editor.tsx          -- Mobile grid entry editor
apps/mobile/app/(journal)/grid-builder.tsx         -- Mobile custom grid builder
apps/web/app/journal/grid/page.tsx                 -- Web grid editor
apps/web/app/journal/grid/builder/page.tsx         -- Web grid builder
```

### Wireframe Position

```
Hub Dashboard
  └── MyJournal card
       └── Today tab / New Entry
            └── Entry type selector: "Standard" / "Grid" / "Therapy Prep"
                 └── Grid Layout Selector -> Grid Editor ← YOU ARE HERE
```

### Data Model

New table and entry columns in migration V4:

```sql
-- Extend entry_type to include 'grid'
-- (V3 already has entry_type with CHECK; V4 recreates the CHECK to add 'grid')

ALTER TABLE jn_entries ADD COLUMN grid_rows INTEGER;
ALTER TABLE jn_entries ADD COLUMN grid_cols INTEGER;

CREATE TABLE IF NOT EXISTS jn_grid_cells (
  id TEXT PRIMARY KEY NOT NULL,
  entry_id TEXT NOT NULL REFERENCES jn_entries(id) ON DELETE CASCADE,
  cell_row INTEGER NOT NULL CHECK (cell_row >= 0 AND cell_row <= 3),
  cell_col INTEGER NOT NULL CHECK (cell_col >= 0 AND cell_col <= 3),
  prompt TEXT NOT NULL,
  content TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(entry_id, cell_row, cell_col)
);

CREATE TABLE IF NOT EXISTS jn_grid_layouts (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  rows INTEGER NOT NULL CHECK (rows >= 1 AND rows <= 4),
  cols INTEGER NOT NULL CHECK (cols >= 1 AND cols <= 4),
  is_builtin INTEGER NOT NULL DEFAULT 0,
  grid_config TEXT NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS jn_grid_cells_entry_idx ON jn_grid_cells(entry_id);
CREATE INDEX IF NOT EXISTS jn_grid_cells_position_idx ON jn_grid_cells(entry_id, cell_row, cell_col);
```

### Dependencies
- **Internal:** `@mylife/db`, journal entry CRUD, word count from `engine/stats.ts`
- **External:** none (fully local)
- **Cross-Module:** none

## Functional Requirements

### User Stories
1. As a journaler who struggles with blank-page anxiety, I want a grid layout that divides my entry into smaller focused cells with prompts.
2. As a daily journaler, I want to create custom grid layouts with my own prompts for a personalized daily practice.
3. As a reflective thinker, I want to review past grid entries in their original layout to see how my responses evolve.

### Behavior Specification

1. User taps "New Entry" and selects "Grid" from entry type options.
2. Grid layout selector appears with 5 built-in layouts + any custom layouts:
   - **Morning Check-In (2x2):** How am I feeling? / Top priority today? / What am I grateful for? / What would make today great?
   - **Evening Reflection (2x2):** What went well? / What could I improve? / What did I learn? / How am I feeling now?
   - **Weekly Review (3x3):** Accomplishments / Challenges / Lessons / Health & Energy / Relationships / Work & Career / Personal Growth / Fun & Recreation / Goals for Next Week
   - **Mindfulness Check (2x3):** Body Scan / Current Emotion / Stressors / Coping Strategy / Gratitude / Intention
   - **Decision Matrix (2x2):** Situation / Pros / Cons / Decision
3. User selects a layout. Grid editor opens with cells arranged in rows and columns.
4. Each cell shows: prompt text as placeholder, multiline text input (max 1,000 chars), character count.
5. User fills in cells in any order. Tab/swipe navigates left-to-right, top-to-bottom.
6. User taps "Done."
7. **Content assembly:** Cells are concatenated into a single Markdown document. Each cell becomes `### {prompt}\n\n{content}\n\n`. This enables full-text search and export compatibility.
8. Entry saved with entry_type = 'grid', grid_rows, grid_cols, individual GridCell records, and assembled body.
9. Reading mode: cells displayed in original grid layout (not Markdown).
10. **Grid Layout Builder:** users create custom grids (1-4 rows, 1-4 cols, minimum 2 total cells) with custom prompt text per cell. Saved as GridLayout record.

### Edge Cases

- **Partial fill:** User fills only some cells. Empty cells included in Markdown as heading with no body. Entry still saves.
- **Grid size 1x1:** Validation blocks with "Grid must have at least 2 cells."
- **Grid size 5x5 or larger:** Validation blocks at 4x4 maximum (16 cells).
- **Cell content exceeds 1,000 chars:** Input blocked at limit, character counter red.
- **Custom grid layout name empty:** "Save" disabled with inline validation.
- **Grid layout JSON corrupted:** "This grid layout could not be loaded" with option to create new.
- **Cell save fails:** Cell border turns red, auto-retry 3 times, content preserved in memory.
- **Search on grid entry:** Full-text search operates on the assembled body (Markdown), so any cell content is searchable.
- **Export grid entry:** Exported as Markdown with prompt headings.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** "Grid" option appears in entry type selector.
- [ ] **AC-2:** Grid layout selector shows 5 built-in layouts with descriptions.
- [ ] **AC-3:** Grid editor displays cells in correct row/column arrangement with prompts.
- [ ] **AC-4:** Each cell accepts text input with character count (max 1,000).
- [ ] **AC-5:** "Done" saves entry with assembled Markdown body.
- [ ] **AC-6:** Reading mode shows cells in original grid layout.
- [ ] **AC-7:** Custom Grid Builder allows creating grids (1-4 rows, 1-4 cols, min 2 cells).
- [ ] **AC-8:** Custom grids appear alongside built-in in layout selector.
- [ ] **AC-9:** Grid entries are searchable via full-text search (searches assembled body).
- [ ] **AC-10:** Grid entries export correctly as Markdown with prompt headings.

### Technical Criteria
- [ ] **TC-1:** Migration V4 adds grid_rows, grid_cols columns to jn_entries and creates jn_grid_cells, jn_grid_layouts tables.
- [ ] **TC-2:** Content assembly: cells -> Markdown with `### {prompt}\n\n{content}\n\n` format.
- [ ] **TC-3:** Word count calculated from total content across all cells.
- [ ] **TC-4:** Each (entry_id, cell_row, cell_col) combination is unique (enforced by constraint).
- [ ] **TC-5:** GridLayout grid_config stores JSON with rows, cols, and cell prompt definitions.
- [ ] **TC-6:** Minimum grid size: 2 cells. Maximum: 4x4 = 16 cells.

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Grid entry creation must NOT be slower than standard entry creation.
- [ ] **NC-2:** Saving a grid entry must NOT lose any cell content (even partially filled grids).
- [ ] **NC-3:** Built-in grid layouts must NOT be editable or deletable.

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Grid cells: glass cards with prompt text as placeholder, rounded corners (lg)
- Cell focus: 150ms border highlight in `#A78BFA` (accent)
- Character count: bottom-right of cell, textTertiary, turns red at limit
- Layout selector: glass cards with layout preview thumbnails
- Grid builder: row/col steppers with live grid preview
- Module accent: `#A78BFA`

### Web (Next.js)

- Route: `/journal/grid` (new grid entry), `/journal/grid/builder` (custom builder)
- Wider cells on desktop, side-by-side layout for 2-column grids
- Grid builder has drag handles for rearranging cells

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Layout Selection | 5+ layout cards to choose from | User tapped "Grid" entry type |
| Empty Grid | Cells with prompt placeholders | Layout selected, no content yet |
| Partial | Some cells filled, others showing placeholders | User has filled some cells |
| Complete | All cells have content, subtle checkmarks | All cells filled |
| Reading | Grid layout with rendered content, read-only | Viewing saved grid entry |
| Builder | Row/col steppers, editable prompt fields | User creating custom layout |

## Test Requirements

### Unit Tests
- [ ] `assembleGridToMarkdown`: 4 cells with content -> Markdown with 4 H3 sections
- [ ] `assembleGridToMarkdown`: 2 of 4 cells filled -> Markdown with 4 headings, 2 with content, 2 empty
- [ ] `calculateGridWordCount`: cells ["hello world", "foo bar baz"] -> 5
- [ ] `validateGridSize`: rows=1, cols=1 -> validation error (min 2 cells)
- [ ] `validateGridSize`: rows=5 -> validation error (max 4)
- [ ] `validateGridSize`: rows=2, cols=2 -> valid (4 cells)
- [ ] `parseGridConfig`: valid JSON -> GridConfig object with rows, cols, cells
- [ ] `parseGridConfig`: malformed JSON -> parse error
- [ ] `enforceCellCharLimit`: 1001 chars -> truncated or rejected
- [ ] `uniqueCellPositions`: duplicate (row=0, col=0) -> validation error

### Integration Tests
- [ ] Full flow: select "Morning Check-In" -> fill 4 cells -> save -> entry has entry_type='grid', 4 GridCell records, assembled Markdown body
- [ ] Custom layout: create 3x2 grid -> name prompts -> save layout -> create entry from it -> 6 cells correct
- [ ] Search: create grid entry with "vacation" in a cell -> search "vacation" -> grid entry appears
- [ ] Export: grid entry -> export as Markdown -> prompts as headings with content

### QA Verification Script

1. Open the app on mobile
2. Navigate to MyJournal > Today tab > New Entry
3. Verify: "Grid" option in entry type selector -- corresponds to AC-1
4. Tap "Grid"
5. Verify: 5 built-in layouts shown -- corresponds to AC-2
6. Select "Morning Check-In"
7. Verify: 2x2 grid with 4 cells and correct prompts -- corresponds to AC-3
8. Fill in all 4 cells
9. Verify: character count visible on each cell -- corresponds to AC-4
10. Tap "Done"
11. Verify: entry saved successfully -- corresponds to AC-5
12. Open saved entry
13. Verify: cells displayed in grid layout (not flat Markdown) -- corresponds to AC-6
14. Navigate to Grid Builder
15. Create a custom 3x3 grid with 9 prompts
16. Verify: grid builder allows 1-4 rows, 1-4 cols -- corresponds to AC-7
17. Save custom layout
18. Create new grid entry
19. Verify: custom layout appears in selector -- corresponds to AC-8
20. Search for text from a grid entry
21. Verify: grid entry appears in results -- corresponds to AC-9

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to grid entry editor, create a grid entry, verify reading mode

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
Journal entries are either 'standard' or 'therapy_prep' (V3). No grid-based entry format exists. Entries use a single `body` text field.

### After This Work
Entry type extended to include 'grid'. Two new tables: `jn_grid_cells` (per-cell data) and `jn_grid_layouts` (custom layout templates). A `grid/` directory provides 5 built-in layouts, content assembly to Markdown, validation, and a layout builder. Grid editor and builder screens on mobile and web.

### Files Changed
- `modules/journal/src/db/schema.ts` -- add grid_rows/cols columns, CREATE_GRID_CELLS, CREATE_GRID_LAYOUTS, indexes
- `modules/journal/src/definition.ts` -- add to JOURNAL_MIGRATION_V4
- `modules/journal/src/grid/types.ts` -- GridConfig, GridCell, GridLayout types
- `modules/journal/src/grid/layouts.ts` -- 5 built-in layout definitions
- `modules/journal/src/grid/grid-engine.ts` -- assembleGridToMarkdown, validateGridSize, parseGridConfig
- `modules/journal/src/grid/index.ts` -- barrel export
- `modules/journal/src/grid/__tests__/grid-engine.test.ts` -- 10+ unit tests
- `modules/journal/src/db/grid.ts` -- CRUD for grid cells and layouts
- `modules/journal/src/types.ts` -- extend entry_type CHECK, add GridCell/GridLayout schemas
- `modules/journal/src/index.ts` -- re-export grid module
- `apps/mobile/app/(journal)/grid-editor.tsx` -- grid entry editor
- `apps/mobile/app/(journal)/grid-builder.tsx` -- custom grid builder
- `apps/web/app/journal/grid/page.tsx` -- web grid editor
- `apps/web/app/journal/grid/builder/page.tsx` -- web grid builder

### Known Limitations
- Grid entries store both structured cells and assembled Markdown body. Editing the Markdown directly (outside grid editor) will not update individual cells.
- No cell-level images or rich formatting. Cells are plain text only.
- Grid layout changes after creation do not re-map existing cells.
- No animation between cells on mobile (future polish).

### Context for Next Agent
- The `entry_type` column on `jn_entries` was added in V3 with CHECK constraint allowing 'standard' and 'therapy_prep'. V4 needs to update or replace this constraint to also allow 'grid'. SQLite does not support ALTER COLUMN, so use a workaround: drop the CHECK constraint by recreating the column or adding a trigger.
- Grid content assembly into Markdown uses `### {prompt}\n\n{content}\n\n` per cell, ordered by row ASC then col ASC. This assembled text goes into the existing `body` column.
- The `word_count` on the entry should be calculated from the assembled body (total across all cells).
- The `grid_config` column on `jn_grid_layouts` stores JSON: `{ "rows": 2, "cols": 2, "cells": [{ "row": 0, "col": 0, "prompt": "..." }, ...] }`.
- Built-in layouts have is_builtin = 1 and cannot be modified. Custom layouts have is_builtin = 0.
