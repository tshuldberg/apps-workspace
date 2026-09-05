# Feature Spec: Relational Databases

## Metadata
- **Module:** notes
- **Priority Score:** 33 / 50 (A-Tier)
- **Scoring Breakdown:** Market 5 x3 + Switching 4 x3 + Complexity 0 x2 + CrossModule 2 x1 + PaidUser 4 x1
- **Sprint:** Sprint 5 (S+A Features)
- **Estimated CC Time:** 6-8 hours
- **Depends On:** NT-001 (Markdown Editor -- implemented)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Notion's relational databases are the feature that justifies its $96/yr pricing. Users create structured databases with typed columns (text, number, select, date, URL, relation), then view data as tables, boards, calendars, or lists. This turns a note-taking app into a lightweight project management, CRM, or content management tool. While a full Notion-style database engine is complex, a focused implementation covering the most-used column types and table/board views would be a massive differentiator for MyNotes. The privacy angle is compelling: Notion stores all database content on their servers, while MyNotes can offer the same structured data entirely on-device.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Notion | Yes | Free (limited) | Full relational databases with 20+ column types, 6 view types, formulas, rollups, relations. Core product feature. |
| Obsidian | Partial | Free | Dataview plugin (community) queries YAML frontmatter. Not true databases. |
| Evernote | No | N/A | No structured data. Rich text tables only. |
| Apple Notes | No | N/A | No databases. Basic tables only. |
| Airtable | Yes | Free (limited) | Dedicated database tool. $20/mo/user for pro features. |

### Target User
Project managers tracking tasks, content creators managing editorial calendars, small business owners maintaining customer lists, students organizing research. Primary migration target: Notion free-tier users who have outgrown the block limits and want unlimited local databases without subscription costs.

## Technical Context

### Where This Lives in MyLife

```
modules/notes/src/database/                       -- NEW: database engine
modules/notes/src/database/types.ts               -- Database, Column, Row, Cell types
modules/notes/src/database/engine.ts              -- CRUD, filtering, sorting, formula evaluation
modules/notes/src/database/views.ts               -- View definitions (table, board)
modules/notes/src/database/index.ts               -- Barrel export
modules/notes/src/database/__tests__/             -- Tests
modules/notes/src/db/database.ts                  -- NEW: database table CRUD
apps/mobile/app/(notes)/database.tsx              -- Mobile database screen
apps/mobile/app/(notes)/database-view.tsx         -- Mobile database views (table, board)
apps/web/app/notes/database/page.tsx              -- Web database page
apps/web/app/notes/database/[id]/page.tsx         -- Web individual database
```

### Wireframe Position

```
Hub Dashboard
  └── MyNotes card
       └── Notes tab
            └── "New" -> "Database" option ← YOU ARE HERE
       └── Databases section in Folders sidebar ← ALSO HERE
```

### Data Model

Four new tables in migration V2:

```sql
CREATE TABLE IF NOT EXISTS nt_databases (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled Database',
  description TEXT DEFAULT '',
  folder_id TEXT REFERENCES nt_folders(id) ON DELETE SET NULL,
  default_view TEXT NOT NULL DEFAULT 'table'
    CHECK (default_view IN ('table', 'board', 'list')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS nt_db_columns (
  id TEXT PRIMARY KEY NOT NULL,
  database_id TEXT NOT NULL REFERENCES nt_databases(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  column_type TEXT NOT NULL DEFAULT 'text'
    CHECK (column_type IN ('text', 'number', 'select', 'multi_select', 'date', 'checkbox', 'url', 'email', 'phone', 'relation')),
  options_json TEXT DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS nt_db_rows (
  id TEXT PRIMARY KEY NOT NULL,
  database_id TEXT NOT NULL REFERENCES nt_databases(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS nt_db_cells (
  id TEXT PRIMARY KEY NOT NULL,
  row_id TEXT NOT NULL REFERENCES nt_db_rows(id) ON DELETE CASCADE,
  column_id TEXT NOT NULL REFERENCES nt_db_columns(id) ON DELETE CASCADE,
  value_text TEXT,
  value_number REAL,
  value_json TEXT,
  UNIQUE(row_id, column_id)
);

CREATE INDEX IF NOT EXISTS nt_databases_folder_idx ON nt_databases(folder_id);
CREATE INDEX IF NOT EXISTS nt_db_columns_database_idx ON nt_db_columns(database_id, sort_order);
CREATE INDEX IF NOT EXISTS nt_db_rows_database_idx ON nt_db_rows(database_id, sort_order);
CREATE INDEX IF NOT EXISTS nt_db_cells_row_idx ON nt_db_cells(row_id);
CREATE INDEX IF NOT EXISTS nt_db_cells_column_idx ON nt_db_cells(column_id);
```

### Dependencies
- **Internal:** `@mylife/db`, notes folders (for organization)
- **External:** none (all data local)
- **Cross-Module:** Databases could relate to other module data (e.g., a "Books" column linking to MyBooks entries), but cross-module relations are deferred.

## Functional Requirements

### User Stories
1. As a project manager, I want to create a database with custom columns to track tasks with status, priority, due dates, and assignees.
2. As a content creator, I want to view my database as a Kanban board grouped by status so that I can manage my editorial pipeline visually.
3. As a privacy-conscious user, I want structured databases stored entirely on my device so that my project data never touches a cloud server.

### Behavior Specification

1. User taps "New" -> "Database" from the Notes tab.
2. Database creation wizard:
   a. Title (default: "Untitled Database").
   b. Pre-built templates: "Task Tracker", "Reading List", "CRM Contacts", "Project Roadmap", "Blank".
3. Database opens in table view (default):
   a. Header row shows column names. Each column has a type icon.
   b. Rows display cell values. Empty cells show placeholder.
   c. Last column: "+" button to add a new column.
   d. Last row: "New Row" button.
4. Column types (10):
   - **Text:** Free-text input.
   - **Number:** Numeric input with optional format (plain, currency, percentage).
   - **Select:** Single-choice from defined options (colored tags).
   - **Multi-Select:** Multiple choices from defined options.
   - **Date:** Date picker.
   - **Checkbox:** Boolean toggle.
   - **URL:** Clickable link.
   - **Email:** Clickable mailto link.
   - **Phone:** Clickable tel link.
   - **Relation:** Link to a row in another database (deferred; scaffold type only).
5. Column management:
   a. Click column header to rename, change type, sort, filter, or delete.
   b. Drag column headers to reorder.
   c. Type change: converts data where possible (number -> text = string representation, text -> number = parse or null).
6. Row management:
   a. Click a row to open a full row detail view (card view with all fields).
   b. Drag rows to reorder.
   c. Right-click/long-press for options: "Duplicate", "Delete".
7. Views:
   a. **Table:** Spreadsheet-like grid (default).
   b. **Board:** Kanban board grouped by a select column.
   c. **List:** Compact list showing primary column + subtitle.
8. Filtering: filter rows by any column value. Multiple filters combined with AND.
9. Sorting: sort by any column, ascending or descending.

### Edge Cases

- **Empty database:** Shows header row with columns, "New Row" button, and a helpful empty state message.
- **Delete column:** Confirmation. All cells for that column are deleted (CASCADE).
- **Delete row:** Confirmation. All cells for that row are deleted (CASCADE).
- **Type change with incompatible data:** Data is converted where possible. Incompatible values become null with a warning count shown.
- **Very large database (10,000+ rows):** Virtualize table rendering. Paginate queries (100 rows per page).
- **Select options with same name:** Prevent duplicate option names within a column.
- **Board view with no select column:** Show message "Add a Select column to use Board view."
- **No databases:** Empty state with "Create your first database" CTA.
- **Delete database:** Confirmation. CASCADE deletes all columns, rows, and cells.
- **Relation column (deferred):** Shows as disabled with "Coming soon" tooltip.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** "Database" option in the new note/item action sheet.
- [ ] **AC-2:** Database opens in table view with column headers and rows.
- [ ] **AC-3:** All 10 column types functional: text, number, select, multi_select, date, checkbox, url, email, phone, relation (scaffold).
- [ ] **AC-4:** Columns can be added, renamed, reordered, type-changed, and deleted.
- [ ] **AC-5:** Rows can be added, edited, reordered, duplicated, and deleted.
- [ ] **AC-6:** Row detail view shows all fields as a card.
- [ ] **AC-7:** Board view groups rows by a select column as Kanban columns.
- [ ] **AC-8:** List view shows compact rows with primary column.
- [ ] **AC-9:** Filtering by column values works with AND combination.
- [ ] **AC-10:** Sorting by any column, ascending/descending.
- [ ] **AC-11:** 4 pre-built database templates available.
- [ ] **AC-12:** Select/multi-select options have assignable colors.

### Technical Criteria
- [ ] **TC-1:** Migration V2 creates nt_databases, nt_db_columns, nt_db_rows, nt_db_cells tables.
- [ ] **TC-2:** Cell values stored in typed columns (value_text, value_number, value_json) for efficient queries.
- [ ] **TC-3:** UNIQUE(row_id, column_id) constraint prevents duplicate cells.
- [ ] **TC-4:** CASCADE deletes propagate correctly: database -> columns/rows -> cells.
- [ ] **TC-5:** Table renders with virtualization for 10,000+ rows.
- [ ] **TC-6:** Select column options stored in nt_db_columns.options_json.

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Database data must NEVER leave the device.
- [ ] **NC-2:** Deleting a column must NOT affect rows in other columns.
- [ ] **NC-3:** Type change must NOT silently discard data without warning the user.
- [ ] **NC-4:** Relation column must NOT be fully functional yet (scaffold only, marked as coming soon).

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Table view: horizontally scrollable grid, sticky first column (primary), sticky header row
- Column header: 14px semibold, type icon (12px), sort indicator
- Cell: 14px text, appropriate input for column type (text field, number pad, date picker, checkbox, color-tagged select)
- Row detail: full-screen card with all fields as labeled form inputs
- Board view: horizontal scrollable columns, cards within each column
- Board card: glass card, primary field title, subtitle fields, drag handle
- View switcher: segmented control (Table | Board | List) in toolbar
- "+" column button: dashed border, "+" icon
- "New Row" button: full-width, subtle glass style
- Module accent: `#64748B`

### Web (Next.js)

- Route: `/notes/database`, `/notes/database/[id]`
- Full-width table with resizable columns
- Inline cell editing (click to edit)
- Column type picker dropdown
- Board view with drag-and-drop cards
- Filter/sort bar below column headers

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Empty Database | Column headers, "New Row" button, empty state message | New database with no rows |
| Table View | Spreadsheet grid with data | Default view |
| Board View | Kanban columns grouped by select field | User switches to board view |
| List View | Compact row list | User switches to list view |
| Row Detail | Full-screen card with all fields | User taps a row |
| Filtering | Subset of rows matching filter criteria | User applies filters |
| No Databases | "Create your first database" CTA | No databases exist |

## Test Requirements

### Unit Tests
- [ ] `createDatabase`: creates database with title and default columns
- [ ] `addColumn`: adds column with type and sort_order
- [ ] `addRow`: adds row with cells for each column
- [ ] `updateCell`: updates cell value (text, number, json based on type)
- [ ] `deleteColumn`: CASCADE deletes all cells for that column
- [ ] `deleteRow`: CASCADE deletes all cells for that row
- [ ] `changeColumnType`: number -> text converts values to strings
- [ ] `changeColumnType`: text -> number parses numbers, nulls for non-numeric
- [ ] `filterRows`: filter by select column value -> returns matching rows
- [ ] `sortRows`: sort by number column ascending -> rows in order
- [ ] `getBoardData`: groups rows by select column -> returns grouped structure
- [ ] `duplicateRow`: creates new row with same cell values

### Integration Tests
- [ ] Full flow: create database -> add 3 columns -> add 5 rows -> filter -> sort -> verify results
- [ ] Board flow: create database with select column -> add rows -> switch to board view -> verify grouping

### QA Verification Script

1. Open the app on mobile
2. Navigate to MyNotes > Notes tab
3. Tap "New" -> "Database"
4. Verify: database creation with template options -- corresponds to AC-1, AC-11
5. Select "Task Tracker" template
6. Verify: database opens in table view with pre-configured columns -- corresponds to AC-2
7. Add a new row, fill in cells
8. Verify: all column types work (text, select, date, checkbox) -- corresponds to AC-3, AC-5
9. Add a new column, set type to "Number"
10. Verify: column added with correct type -- corresponds to AC-4
11. Tap a row to open detail view
12. Verify: full card view with all fields -- corresponds to AC-6
13. Switch to Board view
14. Verify: rows grouped by select column as Kanban -- corresponds to AC-7
15. Switch to List view
16. Verify: compact list format -- corresponds to AC-8
17. Apply a filter on the select column
18. Verify: only matching rows shown -- corresponds to AC-9
19. Sort by a column
20. Verify: rows reordered -- corresponds to AC-10
21. Verify: select options have colors -- corresponds to AC-12
22. Open the app on web
23. Verify: same database functionality with inline editing

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to database, add columns/rows, verify views

### Required if Complexity <= 2 (Large/Complex):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. Fix issues found.

### Required if Complexity <= 1 (Complex/Massive):
- [ ] `/office-hours` (builder mode) -- validate approach before spec finalization

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for the database engine

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
MyNotes has no concept of structured data or databases. All content is unstructured markdown in the note body. No column types, no views, no filtering/sorting on structured data.

### After This Work
Four new tables support a full relational database system within notes. Users can create databases with 10 column types, view data as table/board/list, filter and sort, and organize databases in folders. All data remains on-device.

### Files Changed
- `modules/notes/src/db/schema.ts` -- CREATE tables for nt_databases, nt_db_columns, nt_db_rows, nt_db_cells
- `modules/notes/src/definition.ts` -- add database tables to NOTES_MIGRATION_V2
- `modules/notes/src/database/types.ts` -- Database, Column, ColumnType, Row, Cell, ViewType types
- `modules/notes/src/database/engine.ts` -- CRUD, filterRows, sortRows, changeColumnType, duplicateRow
- `modules/notes/src/database/views.ts` -- getBoardData, getListData view transformations
- `modules/notes/src/database/index.ts` -- barrel export
- `modules/notes/src/database/__tests__/engine.test.ts` -- 12+ unit tests
- `modules/notes/src/db/database.ts` -- database CRUD at the SQL level
- `modules/notes/src/types.ts` -- add database Zod schemas
- `modules/notes/src/index.ts` -- re-export database module
- `apps/mobile/app/(notes)/database.tsx` -- mobile database screen
- `apps/mobile/app/(notes)/database-view.tsx` -- table/board/list views
- `apps/web/app/notes/database/page.tsx` -- web database list
- `apps/web/app/notes/database/[id]/page.tsx` -- web database detail

### Known Limitations
- No formulas or computed columns (Notion has these; deferred to future work).
- No rollups or aggregations across related databases.
- Relation column type is scaffolded but not functional (cross-database linking deferred).
- No real-time collaboration on databases (single-user, local-only).
- No import from Notion databases (would need Notion API integration).
- Maximum practical limit ~10,000 rows per database (SQLite handles more, but UI performance degrades).

### Context for Next Agent
- Cell values are stored in three typed columns: `value_text`, `value_number`, `value_json`. Use the column type to determine which column to read/write. This avoids type coercion issues.
- `options_json` on `nt_db_columns` stores select options as JSON: `{"options": [{"value": "Todo", "color": "#FF453A"}, {"value": "Done", "color": "#30D158"}]}`.
- Board view groups rows by a single select column. Query: `SELECT * FROM nt_db_rows WHERE database_id = ? ORDER BY sort_order`, then group by the cell value of the grouping column.
- The primary column (is_primary = 1) is used as the row title in board and list views.
- V2 migration coordination: shares V2 with other features. Combine all into one V2 migration.
- Complexity is 0 (most complex tier). Consider `/plan-eng-review` and `/office-hours` before building.
