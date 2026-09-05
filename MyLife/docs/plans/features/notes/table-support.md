# Feature Spec: Table Support

## Metadata
- **Module:** notes
- **Priority Score:** 32 / 50 (A-Tier)
- **Scoring Breakdown:** Market 5 x3 + Switching 3 x3 + Complexity 2 x2 + CrossModule 1 x1 + PaidUser 3 x1
- **Sprint:** Sprint 5 (S+A Features)
- **Estimated CC Time:** 2-3 hours
- **Depends On:** NT-001 (Markdown Editor -- implemented)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Markdown tables (pipe syntax) are widely used but painful to create manually -- aligning pipes and dashes is tedious, especially on mobile. Notion and Evernote have visual table editors where users click to add rows/columns. MyNotes stores markdown that supports GFM table syntax, but there is no visual table editor or interactive table rendering. Adding a WYSIWYG table editor that generates and modifies the underlying pipe-syntax markdown makes tables accessible to all users, not just markdown experts. This is a must-have for comparison charts, schedules, data summaries, and structured information.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Notion | Yes | Free tier | Rich table blocks with resizable columns, row/column operations, cell formatting, formulas. |
| Evernote | Yes | Free tier | WYSIWYG table editor with row/column add/delete, merge cells, background colors. |
| Obsidian | Yes | Free | Markdown pipe tables rendered in preview. Advanced Table plugin for visual editing. |
| Apple Notes | Yes | Free | Visual table with tap-to-add rows/columns. No markdown. |

### Target User
Users who organize information in tabular format: comparison charts, schedules, pricing tables, feature matrices, meeting agendas with time slots. Primary migration target: Apple Notes and Evernote users who create tables visually and want a privacy-first alternative.

## Technical Context

### Where This Lives in MyLife

```
modules/notes/src/engine/table.ts                 -- NEW: table parsing, generation, manipulation
modules/notes/src/engine/__tests__/table.test.ts   -- Tests
apps/mobile/app/(notes)/components/TableEditor.tsx -- Mobile visual table editor
apps/web/app/notes/components/TableEditor.tsx      -- Web visual table editor
```

### Wireframe Position

```
Hub Dashboard
  └── MyNotes card
       └── Notes tab -> Note Editor
            └── Formatting toolbar
                 └── Table button ← YOU ARE HERE
            └── Note body
                 └── Rendered tables ← AND HERE (interactive)
```

### Data Model

No new tables or columns. Tables are stored as standard GFM markdown in the `body` column:

```markdown
| Feature | Status | Priority |
|---------|--------|----------|
| Search  | Done   | High     |
| Export  | WIP    | Medium   |
```

The rendering layer provides interactive table editing. Changes update the markdown in-place.

### Dependencies
- **Internal:** `@mylife/db`, notes CRUD (`updateNote`), markdown engine
- **External:** none
- **Cross-Module:** none

## Functional Requirements

### User Stories
1. As a note-taker, I want to insert tables visually without typing pipe syntax so that I can organize information quickly.
2. As a mobile user, I want to add and remove rows and columns by tapping buttons so that table editing is touch-friendly.
3. As a markdown user, I want the table editor to read and write standard GFM pipe syntax so that my tables are portable.

### Behavior Specification

1. User taps the "Table" button in the formatting toolbar.
2. Table insertion dialog: choose initial size (rows x columns). Default: 3x3. Max: 20x20.
3. Table inserted at cursor position as GFM markdown.
4. In editor/preview, tables render as interactive grids:
   a. Cells are tappable/clickable for inline editing.
   b. Header row is visually distinct (bold, slight background color).
   c. Column alignment respects GFM alignment syntax (`:---`, `:---:`, `---:`).
5. Table toolbar appears when cursor is in a table:
   a. "Add Row" (below current row).
   b. "Add Column" (right of current column).
   c. "Delete Row" (current row, confirmation if data exists).
   d. "Delete Column" (current column, confirmation if data exists).
   e. "Align Left/Center/Right" (current column).
6. Cell editing: tap a cell to focus it. Text input within the cell. Tab to move to next cell. Shift+Tab to move to previous cell.
7. All changes update the underlying markdown in-place. The pipe syntax is auto-aligned (pipes and dashes aligned for readability).
8. Long-press on a table shows: "Copy Table" (copies as markdown), "Delete Table".

### Edge Cases

- **Empty table:** All cells empty. Still renders the grid with headers.
- **Single cell table:** 1x1 table. Minimum valid table.
- **Very wide table (10+ columns):** Horizontal scroll within the table container.
- **Very tall table (50+ rows):** Virtualize rows for performance.
- **Pipe character in cell content:** Escaped with `\|` in markdown. Table parser handles this.
- **Cell with multiline content:** GFM tables do not support multiline cells. Content truncated to single line.
- **Table at start/end of note:** Renders correctly without extra padding issues.
- **Multiple tables in one note:** Each rendered independently. Toolbar context-sensitive to focused table.
- **Delete all rows:** Table is removed entirely.
- **Delete all columns:** Table is removed entirely.
- **Undo/redo:** Table operations are part of the note body undo/redo stack.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Table button in formatting toolbar inserts a table.
- [ ] **AC-2:** Table insertion dialog allows choosing initial size.
- [ ] **AC-3:** Tables render as interactive grids in editor/preview.
- [ ] **AC-4:** Cells are tappable for inline editing.
- [ ] **AC-5:** Header row visually distinct (bold, background).
- [ ] **AC-6:** Table toolbar with add/delete row/column and alignment.
- [ ] **AC-7:** Tab/Shift+Tab navigates between cells.
- [ ] **AC-8:** Underlying markdown uses standard GFM pipe syntax.
- [ ] **AC-9:** Column alignment (left/center/right) functional.
- [ ] **AC-10:** Wide tables scroll horizontally.

### Technical Criteria
- [ ] **TC-1:** Table parser reads GFM pipe syntax into structured data.
- [ ] **TC-2:** Table generator produces aligned GFM pipe syntax from structured data.
- [ ] **TC-3:** Cell editing updates the markdown body in-place.
- [ ] **TC-4:** Pipe characters in cell content properly escaped with `\|`.
- [ ] **TC-5:** Table operations (add/delete row/column) modify markdown correctly.

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Table editing must NOT break other markdown content in the same note.
- [ ] **NC-2:** Table parser must NOT crash on malformed pipe syntax.
- [ ] **NC-3:** Adding/deleting rows or columns must NOT corrupt existing cell data.

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Table container: `rgba(255,255,255,0.04)` background, 8px border-radius, horizontal scroll
- Header row: `rgba(255,255,255,0.08)` background, bold text
- Cell borders: `rgba(255,255,255,0.06)`
- Cell text: 14px, `#F0F0F5`, 8px padding
- Active cell: `#64748B` border highlight (2px)
- Table toolbar: floating bar above table, glass style, row/column operation buttons
- Size picker dialog: grid of cells to select dimensions (like Excel/Sheets insert)
- Module accent: `#64748B`

### Web (Next.js)

- Same table rendering with CSS Grid
- Click to edit cells
- Hover effects on row/column headers for add/delete operations
- Resize column widths by dragging column borders

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Size Picker | Grid dialog for choosing table dimensions | User taps Table toolbar button |
| Empty Table | Grid with header row, empty cells | New table created |
| Editing Cell | Cell highlighted, text cursor active | User taps a cell |
| Table Toolbar | Row/column operations above table | Cursor is inside a table |
| Wide Table | Horizontally scrollable grid | Table has many columns |

## Test Requirements

### Unit Tests
- [ ] `parseTable`: valid GFM markdown -> structured table data (headers, rows, alignments)
- [ ] `parseTable`: malformed table -> graceful fallback (treat as plain text)
- [ ] `generateTable`: structured data -> aligned GFM markdown
- [ ] `addRow`: 3x3 table -> 4x3 table with empty new row
- [ ] `addColumn`: 3x3 table -> 3x4 table with empty new column
- [ ] `deleteRow`: 3x3 table, delete row 2 -> 2x3 table
- [ ] `deleteColumn`: 3x3 table, delete column 2 -> 3x2 table
- [ ] `updateCell`: change cell (1,1) value -> only that cell updated
- [ ] `setAlignment`: set column 2 to center -> `| :---: |` in separator row
- [ ] `escapeCell`: "value|with|pipes" -> "value\|with\|pipes"
- [ ] `alignPipes`: uneven pipes -> pipes aligned for readability

### Integration Tests
- [ ] Full flow: insert 3x3 table -> edit cells -> add row -> delete column -> verify markdown output
- [ ] Round-trip: parse GFM table -> modify -> generate -> parse again -> data preserved

### QA Verification Script

1. Open the app on mobile
2. Navigate to MyNotes > Notes tab
3. Create a new note
4. Tap the Table button in the toolbar
5. Verify: size picker dialog appears -- corresponds to AC-1, AC-2
6. Select 3x3 table
7. Verify: table rendered as interactive grid -- corresponds to AC-3
8. Tap a cell and type content
9. Verify: cell editing works with text input -- corresponds to AC-4
10. Verify: header row is bold with background -- corresponds to AC-5
11. Tap "Add Row" in table toolbar
12. Verify: new row added below -- corresponds to AC-6
13. Press Tab to move between cells
14. Verify: focus moves to next cell -- corresponds to AC-7
15. Switch to preview mode or check raw markdown
16. Verify: standard GFM pipe syntax -- corresponds to AC-8
17. Set a column to center alignment
18. Verify: column content centered -- corresponds to AC-9
19. Create a table with 8+ columns
20. Verify: horizontal scroll works -- corresponds to AC-10
21. Open the app on web
22. Verify: same table editing with column resize

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to note editor, insert table, verify editing

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
GFM table syntax can be typed manually into the note body, but there is no visual table editor, no interactive rendering, and no table manipulation UI. Tables display as plain text unless the user manually types aligned pipe syntax.

### After This Work
A visual table editor with a size picker, inline cell editing, add/delete row/column operations, column alignment, and Tab navigation. All changes stored as standard GFM pipe syntax. Tables render as interactive grids in both editor and preview.

### Files Changed
- `modules/notes/src/engine/table.ts` -- parseTable, generateTable, addRow, addColumn, deleteRow, deleteColumn, updateCell, setAlignment, escapeCell, alignPipes
- `modules/notes/src/engine/__tests__/table.test.ts` -- 11+ unit tests
- `modules/notes/src/index.ts` -- re-export table functions
- `apps/mobile/app/(notes)/components/TableEditor.tsx` -- visual table component
- `apps/web/app/notes/components/TableEditor.tsx` -- web table component

### Known Limitations
- No cell merging (colspan/rowspan). GFM tables do not support this.
- No cell formatting (bold/italic within cells). Uses plain text.
- No formulas or computed values in cells. Use relational databases for that.
- No row/column drag-to-reorder (add/delete + re-create is the workaround).
- No CSV import into tables.

### Context for Next Agent
- GFM table syntax: header row, separator row (`|---|---|`), data rows. Alignment: `:---` (left), `:---:` (center), `---:` (right).
- The `parseTable` function should work on a substring of the note body (the table markdown section). Identify table boundaries by finding contiguous lines that start with `|`.
- The `generateTable` function should auto-align pipes for readability. Calculate max width per column, then pad each cell.
- For cell editing in the markdown body: identify the table's start line and the specific cell position. Replace the cell content in-place, then regenerate the entire table markdown to re-align pipes.
- No new tables or migrations needed. This is purely a rendering and editing feature operating on the existing `body` column.
