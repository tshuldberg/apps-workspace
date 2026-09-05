# Notes Web UI Spec

**Task:** W14-5
**Module:** `@mylife/notes` (id: `notes`, prefix: `nt_`, tier: free)
**Accent:** `#64748B` (slate)
**Reference implementation:** `apps/web/app/books/`
**Design pipeline:** Office Hours (builder) -> Eng Review -> Design Review -> Design Consultation

---

## 1. Executive Summary

Build a full functional web UI for MyNotes, transforming 10 stub files into a desktop-optimized note-taking experience. The narrowest wedge is the split-pane markdown editor with live preview, `[[backlink]]` autocomplete, and FTS5-powered search. The module's engine layer (100+ exports across 3 schema versions) is complete -- no new CRUD operations are needed. This spec covers 10 pages, 12 components, 1 server actions file, and a test suite.

## 2. Design Pipeline Results

### 2.1 Office Hours (Builder Mode)

**Narrowest wedge:** The split-pane editor page where users write markdown on the left, see a live preview on the right, type `[[` for backlink autocomplete, and use `/` slash commands for templates, checklists, code blocks, and tables. This single screen is where 80% of time is spent.

**Web-specific affordances:**

| Affordance | Desktop Advantage |
|-----------|-------------------|
| Multi-panel layout | Editor + preview + backlinks side-by-side |
| Keyboard shortcuts | `Cmd+K` search, `Cmd+N` new note, `Cmd+B` bold, `/` commands |
| Drag-and-drop | Reorder folders, drag notes into folders |
| Wide content area | Full markdown tables, code blocks, database views |
| Right-click context menus | Delete, move, pin, tag from context menu |
| Resizable panels | User controls editor/preview split ratio |
| Data tables | Full-width database views with column resize |
| Canvas/whiteboard | Mouse precision for node placement, edge drawing |

**Status quo competitors:** Apple Notes (no backlinks), Notion (cloud-dependent), Obsidian (Electron, paid sync), Bear (no web). MyNotes wedge: free tier, private, local-first, web-accessible, with power-user features.

**10-star experience:** Open `/notes`, instantly see today's daily note. Type `[[` and the entire knowledge graph is autocomplete-searchable. Split the screen to see live preview. Click any backlink to open in side panel. Graph view shows knowledge topology. Database view tracks structured data. All data stays on-device.

### 2.2 Eng Review

**CRUD completeness:** All module functions are available. No gaps found across 10 feature areas (notes, folders, tags, links, daily, templates, search, databases, plugins, canvas). The module exports 100+ functions from `@mylife/notes`.

**Schema:** 3 migration versions covering 20+ tables (notes, folders, tags, note_tags, note_links, templates, settings, attachments, ai_history, databases, db_columns, db_rows, db_cells, plugins, plugin_settings, canvases, canvas_nodes, canvas_edges) + FTS5 virtual tables + 17 indexes.

**Data flow:** Server actions pattern (same as Books):
1. `actions.ts` exports `'use server'` functions
2. Each calls `getAdapter()` + `ensureModuleMigrations('notes')`
3. Delegates to `@mylife/notes` CRUD functions
4. Client components call server actions via `useEffect` or event handlers
5. `NOTES_MODULE` is already imported in `apps/web/lib/db.ts` (line 32)

**State management:** Local `useState` per page. No global state store. Editor uses debounced save (500ms after last keystroke). No React context needed beyond what the hub provides.

### 2.3 Design Review

| Dimension | Score | Notes |
|-----------|-------|-------|
| Information Architecture | 9/10 | Dashboard -> drill-down. Universal search spans all content. |
| Desktop-Optimized Layout | 9/10 | Split-pane editor, sidebar folder tree, wide tables. |
| Keyboard Navigation | 8/10 | Cmd+K, Cmd+N, Cmd+S, Cmd+B, / commands. |
| Visual Density | 9/10 | Linear/Raycast aesthetic. Compact note rows. No hero sections. |
| Cool Obsidian Compliance | 10/10 | All glass tokens, slate accent, blur effects. |
| 5 States Coverage | 9/10 | All pages have loading/empty/error/success/partial states. |
| Typography | 9/10 | Inter for chrome, monospace option for editor. |
| Motion | 8/10 | 200ms transitions, stagger on lists, smooth panel resize. |
| **Overall** | **8.9/10** | |

### 2.4 Design Consultation

- **Accent:** `#64748B` (slate) -- muted, keeps focus on content
- **Icons:** Lucide (hub-consistent): `file-text`, `folder`, `hash`, `search`, `calendar`, `layout`, `database`, `puzzle`, `scissors`, `git-branch`
- **Density:** High by default (Linear aesthetic). Compact rows: title + snippet + word count + tags + updated time.
- **Editor:** Plain `textarea` with monospace font option. Markdown-in, markdown-out. Preview renders to HTML. No rich-text editor (privacy-first, no lock-in).
- **Graph:** SVG or `<canvas>` with simple force-directed layout (~100 lines). No D3 dependency for v1.
- **Reuse from `packages/ui/`:** `Card`, `Text`, `colors`, `spacing` tokens, glass card pattern, skeleton components.
- **Reuse from Books pattern:** `layout.tsx` header, `actions.ts` db() helper, `page.tsx` fetch + cancelled flag.

---

## 3. Route Structure

```
apps/web/app/notes/
  layout.tsx              # Module shell: glass header + nav links
  page.tsx                # Dashboard: stats, recent notes, quick actions
  actions.ts              # Server actions: all CRUD wrappers
  [id]/
    page.tsx              # Note editor: split-pane (edit + preview)
  daily/
    page.tsx              # Daily note: date nav + auto-create + editor
  graph/
    page.tsx              # Knowledge graph: force-directed SVG
  databases/
    page.tsx              # Database list + inline table editor
  canvas/
    page.tsx              # Canvas list with thumbnails
    [id]/
      page.tsx            # Canvas editor: infinite whiteboard
  templates/
    page.tsx              # Template browser: built-in + custom
  clipper/
    page.tsx              # Web clipper: URL input -> markdown preview -> save
  plugins/
    page.tsx              # Plugin manager: list + toggle + settings
  components/
    NoteCard.tsx           # Compact note row (title, snippet, tags, word count)
    NoteEditor.tsx         # Split-pane markdown editor with toolbar
    NotePreview.tsx        # Markdown-to-HTML renderer
    FolderTree.tsx         # Sidebar folder hierarchy with drag-drop
    TagPicker.tsx          # Multi-select tag chips with color dots
    SearchBar.tsx          # FTS5 search with highlighted snippets
    GraphView.tsx          # Force-directed graph renderer (SVG)
    DatabaseTable.tsx      # Spreadsheet-style table editor
    CanvasRenderer.tsx     # Whiteboard canvas with nodes + edges
    BacklinkPanel.tsx      # Backlinks sidebar for editor page
    TemplateCard.tsx       # Template preview card with use count
    ChecklistItem.tsx      # (exists) Checkbox line renderer
```

---

## 4. Page-by-Page Wireframes

### 4.1 Dashboard (`page.tsx`)

```
+---------------------------------------------------------------+
| MyNotes            Notes  Daily  Graph  Databases  Canvas  ... |
|---------------------------------------------------------------|
| [stats row: 4 glass metric cards]                             |
| Notes: 42   Folders: 8   Tags: 15   Words: 28.4k             |
|                                                                |
| [Quick Actions bar]                                           |
| [+ New Note]  [Today's Note]  [Clip URL]                     |
|                                                                |
| Recent Notes                                     Sort: Updated |
| +----------------------------------------------------------+ |
| | Meeting Notes - Q1 Planning                    2m ago     | |
| | Review the roadmap priorities for...    #work  1,240w     | |
| +----------------------------------------------------------+ |
| | Daily Note - 2026-03-23                        today      | |
| | Standup notes and action items...       #daily   380w     | |
| +----------------------------------------------------------+ |
| | [[Project Alpha]] Design Doc                   1h ago     | |
| | Architecture decisions and trade...    #design 3,100w     | |
| +----------------------------------------------------------+ |
|                                                                |
| Pinned Notes                                                   |
| [pinned note cards in a row]                                  |
+---------------------------------------------------------------+
```

**Data sources:** `getNotesStats(db)`, `getNotes(db, { limit: 20, sortBy: 'updated' })`, `getNotes(db, { isPinned: true })`

**States:**
- Loading: 4 skeleton metric cards + 5 skeleton note rows
- Empty: "Your notes are waiting" + warm CTA: "Create your first note" (accent button) + "Or clip a webpage" (secondary)
- Error: Glass card with "Something went wrong" + retry button
- Success: Stats cards + note list + pinned section
- Partial: Stats loaded, note list still loading (skeleton rows below stats)

### 4.2 Note Editor (`[id]/page.tsx`)

```
+---------------------------------------------------------------+
| < Back     Untitled Note           [Pin] [Fav] [Tags] [Save] |
|---------------------------------------------------------------|
| [Folder selector]  [Tag chips]  Word count: 1,240  Chars: 6k |
|---------------------------------------------------------------|
|                        |                                       |
| # Meeting Notes        | # Meeting Notes                      |
|                        |                                       |
| ## Attendees           | ## Attendees                          |
| - Alice                | - Alice                               |
| - Bob                  | - Bob                                 |
|                        |                                       |
| ## Action Items        | ## Action Items                       |
| - [x] Review PR       | [x] Review PR                         |
| - [ ] Update docs     | [ ] Update docs                       |
|                        |                                       |
| See [[Project Alpha]]  | See Project Alpha (linked)            |
|                        |                                       |
|   EDITOR (monospace)   |   PREVIEW (rendered HTML)             |
|                        |                                       |
|---------------------------------------------------------------|
| Backlinks: [[Project Alpha]], [[Q1 OKRs]]                    |
+---------------------------------------------------------------+
```

**Layout:** Split-pane. Left: `<textarea>` with monospace font. Right: rendered markdown preview. Bottom: backlinks bar. Top: toolbar with pin/fav/tags/save buttons.

**Key behaviors:**
- Auto-save on debounce (500ms after last keystroke)
- `[[` triggers autocomplete dropdown with note title search
- `/` triggers slash command menu (template, checklist, code block, table, heading)
- `Cmd+B` bold, `Cmd+I` italic, `Cmd+K` link
- `Cmd+S` explicit save
- Backlinks panel shows all notes that reference this one
- Word count and char count update in real-time

**Data sources:** `getNoteById(db, id)`, `getTagsForNote(db, id)`, `getBacklinksForNote(db, id)`, `getFolders(db)`, `getTags(db)` (for autocomplete), `getNotes(db, { limit: 100 })` (for `[[` autocomplete)

**New note flow:** URL `/notes/new` creates a note via `createNote(db, ...)` and redirects to `/notes/[id]`.

**States:**
- Loading: Skeleton title bar + skeleton editor area
- Empty (new note): Blank editor with placeholder "Start typing or use / for commands"
- Error: Save failed banner with retry, content preserved locally
- Success: Full editor with live preview
- Partial: Note body loaded, backlinks still loading

### 4.3 Daily Note (`daily/page.tsx`)

```
+---------------------------------------------------------------+
| MyNotes  ...  Daily                                           |
|---------------------------------------------------------------|
|         [<]   2026-03-23   [Today badge]   [>]               |
|---------------------------------------------------------------|
|                                                                |
| [inline note editor for today's daily note]                   |
| Same split-pane as note editor but embedded                   |
|                                                                |
|---------------------------------------------------------------|
| Previous Daily Notes                                          |
| Mar 22 - 380 words | Mar 21 - 520 words | Mar 20 - 290 words |
+---------------------------------------------------------------+
```

**Key behaviors:**
- Auto-creates today's daily note on first visit (via `getOrCreateDailyNote`)
- Date navigation arrows to browse previous/next days
- "Today" badge when viewing current date
- Previous daily notes listed as compact links at bottom
- Uses the daily note template if configured

**Data sources:** `getOrCreateDailyNote(db, date)`, `getDailyNoteDates(db)`, `getDailyNoteByDate(db, date)`

**States:**
- Loading: Date nav + skeleton editor
- Empty (no daily notes ever): "Start your daily practice" + enable CTA + explanation of daily notes
- Error: Retry banner
- Success: Today's note in editor + previous notes list
- Partial: Date navigation loaded, note body creating

### 4.4 Knowledge Graph (`graph/page.tsx`)

```
+---------------------------------------------------------------+
| MyNotes  ...  Graph                                           |
|---------------------------------------------------------------|
| Notes: 42  Links: 87  Orphans: 5  Clusters: 3  Avg links: 2 |
|---------------------------------------------------------------|
| [Filter: All | By folder | By tag]   [Search node]           |
|                                                                |
|          o---o                                                 |
|         / \   \         o                                      |
|    o---o   o---o       / \                                     |
|     \     / \         o   o                                    |
|      o---o   o                                                 |
|                    o (orphan, dimmed)                          |
|                                                                |
|   [Interactive force-directed graph]                           |
|   Click node -> highlight connections + show note preview     |
|   Hover node -> tooltip with title + link count               |
|   Scroll to zoom, drag to pan                                 |
+---------------------------------------------------------------+
```

**Key behaviors:**
- Force-directed layout using simple spring simulation
- Nodes sized by link count (more links = larger)
- Node color: slate accent for normal, dimmed for orphans
- Click a node to highlight its 1-hop neighborhood and show a preview panel
- Filter by folder or tag to narrow the graph
- Search to find and focus on a specific node
- Stats bar shows graph metrics

**Data sources:** `getNoteGraph(db)`, `getGraphStats(graph)`, `filterGraph(graph, predicate)`, `getLocalGraph(graph, noteId)`, `findOrphans(graph)`, `clusterNotes(graph)`

**States:**
- Loading: Stats bar skeletons + pulsing circle placeholder
- Empty: "Create notes with [[backlinks]] to build your knowledge graph" + illustration
- Error: Retry
- Success: Interactive force-directed graph
- Partial: Stats loaded, graph still computing/rendering

### 4.5 Databases (`databases/page.tsx`)

```
+---------------------------------------------------------------+
| MyNotes  ...  Databases                                       |
|---------------------------------------------------------------|
| Your Databases                         [+ New Database]       |
|                                                                |
| +----------------------------------------------------------+ |
| | Reading List                          Table view  12 rows | |
| |----------------------------------------------------------| |
| | Title        | Author    | Status   | Rating  | Date     | |
| |--------------|-----------|----------|---------|----------| |
| | Dune         | Herbert   | Finished | 4.5     | 2026-01  | |
| | Neuromancer  | Gibson    | Reading  | --      | 2026-03  | |
| | ...          |           |          |         |          | |
| +----------------------------------------------------------+ |
|                                                                |
| +----------------------------------------------------------+ |
| | Project Tracker                       Table view   8 rows | |
| | [collapsed - click to expand]                             | |
| +----------------------------------------------------------+ |
+---------------------------------------------------------------+
```

**Key behaviors:**
- List all databases with title, description, row count, default view
- Click to expand inline and show the table
- Full spreadsheet-style editing: click cell to edit, tab to next cell
- Add row (bottom), add column (right), delete row/column via context menu
- Column types: text, number, select, multi_select, date, checkbox, url, email, phone
- View toggle: table / board / list (as defined in schema)

**Data sources:** `getDatabases(db)`, `getColumnsForDatabase(db, dbId)`, `getRowsForDatabase(db, dbId)`, `getCellsForRow(db, rowId)`, `setCellValue(db, ...)`, `createDbRow(db, ...)`, `createDbColumn(db, ...)`

**States:**
- Loading: Skeleton table rows
- Empty: "Create your first database" + description of use cases (reading lists, project trackers, habit logs) + CTA
- Error: Retry
- Success: Database list with inline table editors
- Partial: Database list loaded, cell data streaming

### 4.6 Canvas List (`canvas/page.tsx`)

```
+---------------------------------------------------------------+
| MyNotes  ...  Canvas                                          |
|---------------------------------------------------------------|
| Your Canvases                          [+ New Canvas]         |
|                                                                |
| [Grid of canvas thumbnail cards]                              |
| +----------+  +----------+  +----------+                     |
| | Thumb    |  | Thumb    |  | Thumb    |                     |
| |          |  |          |  |          |                     |
| | Mind Map |  | Arch.    |  | Flow     |                     |
| | 12 nodes |  | 8 nodes  |  | 5 nodes  |                     |
| +----------+  +----------+  +----------+                     |
+---------------------------------------------------------------+
```

**Data sources:** `getCanvases(db)`, `getNodesForCanvas(db, canvasId)` (for node count)

### 4.7 Canvas Editor (`canvas/[id]/page.tsx`)

```
+---------------------------------------------------------------+
| [< Back]  Canvas Title              [Zoom -][100%][Zoom +]   |
|---------------------------------------------------------------|
| [toolbar: Select | Text | Note | Shape | Link | Image]       |
|---------------------------------------------------------------|
|                                                                |
|   +--------+          +--------+                              |
|   | Text   |----->    | Note   |                              |
|   | node   |          | ref    |                              |
|   +--------+          +--------+                              |
|                  \                                             |
|                   +--------+                                  |
|                   | Shape  |                                  |
|                   +--------+                                  |
|                                                                |
|   [infinite canvas with grid background]                      |
|   Drag to create, click to select, double-click to edit      |
+---------------------------------------------------------------+
```

**Key behaviors:**
- Infinite canvas with pan (drag background) and zoom (scroll)
- Toolbar for creating node types: text, note (link to existing note), image, shape, link
- Select nodes to move, resize, delete
- Draw edges between nodes by dragging from edge handles
- Group selection with rectangle drag
- Grid snapping (configurable)
- Auto-save canvas state on change

**Data sources:** `getCanvasById(db, id)`, `getNodesForCanvas(db, id)`, `getEdgesForCanvas(db, id)`, all canvas CRUD functions, canvas engine functions (viewport cull, zoom to fit, hit test, etc.)

### 4.8 Templates (`templates/page.tsx`)

```
+---------------------------------------------------------------+
| MyNotes  ...  Templates                                       |
|---------------------------------------------------------------|
| Note Templates                         [+ New Template]       |
|                                                                |
| Built-in                                                      |
| +----------+  +----------+  +----------+  +----------+       |
| | 📋 Meet  |  | 📅 Daily |  | 📝 Blog  |  | 🔬 Res.  |       |
| | Meeting  |  | Daily    |  | Blog     |  | Research |       |
| | Notes    |  | Journal  |  | Post     |  | Paper    |       |
| | Used: 12 |  | Used: 45 |  | Used: 3  |  | Used: 7  |       |
| +----------+  +----------+  +----------+  +----------+       |
|                                                                |
| Custom                                                        |
| +----------+  +----------+                                    |
| | 📄 My    |  | 📄 Stand |                                    |
| | Template |  | -up      |                                    |
| |          |  |          |                                    |
| | Used: 5  |  | Used: 2  |                                    |
| +----------+  +----------+                                    |
+---------------------------------------------------------------+
```

**Key behaviors:**
- Grid of template cards with icon, name, category, use count
- Click template to preview body in a modal
- "Use Template" creates a new note from the template (expands variables)
- "New Template" opens a form with name + body editor
- Built-in templates seeded on first visit via `seedBuiltInTemplates`
- Template variables auto-expanded: `{{date}}`, `{{time}}`, `{{title}}`

**Data sources:** `getTemplates(db)`, `seedBuiltInTemplates(db)`, `createTemplate(db, ...)`, `expandVariables(body, vars)`, `BUILT_IN_TEMPLATES`

### 4.9 Web Clipper (`clipper/page.tsx`)

```
+---------------------------------------------------------------+
| MyNotes  ...  Clipper                                         |
|---------------------------------------------------------------|
| Web Clipper                                                   |
|                                                                |
| Paste a URL to save a webpage as a markdown note.             |
|                                                                |
| URL: [https://example.com/article________________] [Clip]    |
|                                                                |
| Clip type: (o) Article  ( ) Full Page  ( ) Bookmark          |
|                                                                |
| [Preview of converted markdown]                               |
| +---------------------------------------------------------+  |
| | # Article Title                                         |  |
| |                                                         |  |
| | > Clipped from https://example.com/article              |  |
| |                                                         |  |
| | ---                                                     |  |
| |                                                         |  |
| | Article body converted to markdown...                   |  |
| +---------------------------------------------------------+  |
|                                                                |
| [Save to Folder: ___]  [Add Tags: ___]  [Save Note]          |
+---------------------------------------------------------------+
```

**Key behaviors:**
- Input field for URL
- Clip type selection: article (extract main content), full page, bookmark (title + link only)
- Fetch URL content, convert HTML to markdown via `htmlToMarkdown()`
- Build clip body with metadata header via `buildClipBody()`
- Preview the result before saving
- Save creates a note with `source_url`, `clipped_at`, `clip_type` fields
- Folder and tag assignment before save

**Data sources:** `htmlToMarkdown(html)`, `buildClipBody(content, url, title)`, `truncateClip(md)`, `createNote(db, ...)`

**Note:** URL fetching requires a server action or API route since it's a cross-origin request. The server action will `fetch(url)` and return the HTML.

### 4.10 Plugins (`plugins/page.tsx`)

```
+---------------------------------------------------------------+
| MyNotes  ...  Plugins                                         |
|---------------------------------------------------------------|
| Plugins                                                       |
|                                                                |
| +----------------------------------------------------------+ |
| | 🔌 Word Count Pro                     v1.0  [Enabled ✓]  | |
| | Enhanced word count with reading time estimates            | |
| | By: MyLife Team  |  [Settings]  [Uninstall]               | |
| +----------------------------------------------------------+ |
| | 🔌 Export to PDF                       v0.2  [Disabled]   | |
| | Export notes as formatted PDF files                        | |
| | By: Community   |  [Settings]  [Uninstall]                | |
| +----------------------------------------------------------+ |
|                                                                |
| [+ Install Plugin]                                            |
+---------------------------------------------------------------+
```

**Key behaviors:**
- List installed plugins with name, version, description, author, enabled status
- Toggle enable/disable
- Plugin settings panel (key/value configuration)
- Uninstall confirmation
- Install from manifest (for v1, manual JSON input; future: plugin marketplace)

**Data sources:** `getPlugins(db)`, `enablePlugin(db, id)`, `disablePlugin(db, id)`, `uninstallPlugin(db, id)`, `getPluginSettings(db, id)`, `setPluginSetting(db, id, key, value)`

---

## 5. Component Inventory

| Component | Description | Props | Reuse Source |
|-----------|-------------|-------|-------------|
| `NoteCard` | Compact note row for lists | `note`, `onClick`, `onContextMenu` | New |
| `NoteEditor` | Split-pane markdown editor | `note`, `onSave`, `allNotes` (for `[[` autocomplete) | New |
| `NotePreview` | Markdown-to-HTML renderer | `markdown`, `onBacklinkClick` | New |
| `FolderTree` | Sidebar folder hierarchy | `folders`, `selectedId`, `onSelect`, `onDrop` | New |
| `TagPicker` | Multi-select tag chips | `allTags`, `selectedIds`, `onChange` | New |
| `SearchBar` | FTS5 search with snippets | `onSearch`, `results` | New |
| `GraphView` | Force-directed graph (SVG) | `graph`, `onNodeClick`, `selectedId` | New |
| `DatabaseTable` | Spreadsheet-style editor | `database`, `columns`, `rows`, `onCellChange` | New |
| `CanvasRenderer` | Whiteboard with nodes/edges | `canvas`, `nodes`, `edges`, `onUpdate` | New |
| `BacklinkPanel` | Backlinks list for a note | `backlinks`, `onNoteClick` | New |
| `TemplateCard` | Template preview card | `template`, `onUse`, `onEdit`, `onDelete` | New |
| `ChecklistItem` | Checkbox line renderer | `checked`, `text`, `onChange` | Exists |
| `MetricCard` | Glass stat card | `label`, `value`, `accent` | Refactor from current page.tsx |
| `EmptyState` | Reusable warm empty state | `icon`, `title`, `description`, `cta` | New (pattern from DESIGN.md) |
| `SkeletonRow` | Pulsing placeholder row | `count` | New (pattern from DESIGN.md) |

---

## 6. Server Actions (`actions.ts`)

```typescript
'use server';

// All actions follow the Books pattern:
// 1. Call getAdapter() + ensureModuleMigrations('notes')
// 2. Delegate to @mylife/notes CRUD functions
// 3. Wrap in try/catch/finally (web error handling rule)

// Notes CRUD
export async function fetchNotes(filters?: NoteFilter): Promise<Note[]>
export async function fetchNote(id: string): Promise<Note | null>
export async function createNoteAction(input: CreateNoteInput): Promise<string>
export async function updateNoteAction(id: string, input: UpdateNoteInput): Promise<void>
export async function deleteNoteAction(id: string): Promise<void>
export async function searchNotesAction(query: string): Promise<NoteSearchResult[]>
export async function fetchNoteCount(): Promise<number>
export async function fetchStats(): Promise<NotesStats>

// Folders
export async function fetchFolders(): Promise<NoteFolder[]>
export async function createFolderAction(input: CreateFolderInput): Promise<string>
export async function updateFolderAction(id: string, input: UpdateFolderInput): Promise<void>
export async function deleteFolderAction(id: string): Promise<void>

// Tags
export async function fetchTags(): Promise<NoteTag[]>
export async function createTagAction(input: CreateTagInput): Promise<string>
export async function deleteTagAction(id: string): Promise<void>
export async function fetchTagsForNote(noteId: string): Promise<NoteTag[]>

// Links / Graph
export async function fetchBacklinks(noteId: string): Promise<NoteLink[]>
export async function fetchNoteGraph(): Promise<NoteGraph>

// Daily Notes
export async function fetchOrCreateDailyNote(date: string): Promise<Note>
export async function fetchDailyDates(): Promise<string[]>

// Templates
export async function fetchTemplates(): Promise<NoteTemplate[]>
export async function createTemplateAction(input: CreateTemplateInput): Promise<string>
export async function deleteTemplateAction(id: string): Promise<void>
export async function seedTemplatesAction(): Promise<void>

// Settings
export async function fetchSetting(key: string): Promise<string | null>
export async function saveSettingAction(key: string, value: string): Promise<void>

// Web Clipper
export async function clipUrlAction(url: string, clipType: ClipType): Promise<ClipResult>

// Databases
export async function fetchDatabases(): Promise<NoteDatabase[]>
export async function createDatabaseAction(input: { title?: string }): Promise<string>
export async function deleteDatabaseAction(id: string): Promise<void>
export async function fetchDatabaseDetail(id: string): Promise<{
  database: NoteDatabase;
  columns: NoteDbColumn[];
  rows: NoteDbRow[];
  cells: Map<string, NoteDbCell[]>;
}>
export async function createDbRowAction(dbId: string): Promise<string>
export async function createDbColumnAction(dbId: string, input: { name: string; columnType: string }): Promise<string>
export async function setCellValueAction(rowId: string, columnId: string, value: { text?: string; number?: number; json?: string }): Promise<void>
export async function deleteDbRowAction(id: string): Promise<void>
export async function deleteDbColumnAction(id: string): Promise<void>

// Plugins
export async function fetchPlugins(): Promise<NotePlugin[]>
export async function togglePluginAction(id: string, enabled: boolean): Promise<void>
export async function uninstallPluginAction(id: string): Promise<void>
export async function fetchPluginSettings(id: string): Promise<NotePluginSetting[]>
export async function savePluginSettingAction(pluginId: string, key: string, value: string): Promise<void>

// Canvas
export async function fetchCanvases(): Promise<Canvas[]>
export async function fetchCanvas(id: string): Promise<{ canvas: Canvas; nodes: CanvasNode[]; edges: CanvasEdge[] }>
export async function createCanvasAction(input: CreateCanvasInput): Promise<string>
export async function deleteCanvasAction(id: string): Promise<void>
export async function updateCanvasAction(id: string, input: UpdateCanvasInput): Promise<void>
export async function addCanvasNodeAction(canvasId: string, input: AddNodeInput): Promise<string>
export async function moveCanvasNodeAction(nodeId: string, x: number, y: number): Promise<void>
export async function deleteCanvasNodeAction(nodeId: string): Promise<void>
export async function addCanvasEdgeAction(canvasId: string, input: AddEdgeInput): Promise<string>
export async function deleteCanvasEdgeAction(edgeId: string): Promise<void>

// AI Writing Assistant
export async function runAiAction(noteId: string, action: AiAction, text: string): Promise<string>
```

---

## 7. Keyboard Shortcuts

| Shortcut | Action | Context |
|----------|--------|---------|
| `Cmd+K` | Open hub command palette (search notes) | Global |
| `Cmd+N` | Create new note | Notes pages |
| `Cmd+S` | Save current note | Editor |
| `Cmd+B` | Bold selection | Editor |
| `Cmd+I` | Italic selection | Editor |
| `Cmd+Shift+K` | Insert link | Editor |
| `Cmd+Shift+C` | Toggle checklist | Editor |
| `/` | Open slash command menu | Editor (at line start) |
| `[[` | Open backlink autocomplete | Editor |
| `Cmd+Shift+P` | Toggle preview panel | Editor |
| `Escape` | Close modals/menus | Global |

---

## 8. Data Flow Diagram

```
User Action
    |
    v
Client Component (useState, event handlers)
    |
    v
Server Action (actions.ts)
    |
    v
getAdapter() + ensureModuleMigrations('notes')
    |
    v
@mylife/notes CRUD function
    |
    v
SQLite (better-sqlite3, nt_ prefixed tables)
    |
    v
Return typed data
    |
    v
Client re-renders with new state
```

**Editor auto-save flow:**
```
Keystroke -> local state update -> debounce 500ms -> updateNoteAction(id, { body, title })
                                                     -> countWords(body) computed server-side
                                                     -> extractBacklinks(body) auto-links
```

---

## 9. Cool Obsidian Token Usage

```typescript
const ACCENT = '#64748B';           // Slate (notes module accent)
const ACCENT_DIM = 'rgba(100,116,139,0.15)';
const ACCENT_BORDER = 'rgba(100,116,139,0.25)';
const TEXT = '#F0F0F5';
const TEXT_SEC = 'rgba(240,240,245,0.65)';
const TEXT_TERT = 'rgba(240,240,245,0.35)';
const BG = '#0A0A0F';
const SURFACE = '#12121A';
const SURFACE_ELEV = '#1A1A24';
const BORDER = 'rgba(255,255,255,0.06)';
const GLASS = 'rgba(255,255,255,0.04)';
const GLASS_STRONG = 'rgba(255,255,255,0.08)';
const GLASS_BORDER = 'rgba(255,255,255,0.10)';
const DANGER = '#FF453A';
const SUCCESS = '#30D158';
```

**Layout header:** `backgroundColor: 'rgba(18,18,26,0.78)'`, `backdropFilter: 'blur(14px)'`
**Cards:** `borderRadius: 20`, `border: 1px solid ${BORDER}`, `backgroundColor: ${SURFACE}`
**Buttons (primary):** `backgroundColor: ${ACCENT}`, `color: '#0A0A0F'`
**Buttons (secondary):** `backgroundColor: ${GLASS}`, `color: ${TEXT_SEC}`, `border: 1px solid ${BORDER}`

---

## 10. Test Plan

### Unit Tests (Vitest)

| Test File | Coverage |
|-----------|----------|
| `actions.test.ts` | All server actions: CRUD for notes, folders, tags; search; daily notes; templates; settings; databases; plugins; canvas; web clipper |
| `page.test.tsx` | Dashboard rendering: stats display, empty state, note list, pinned section |
| `editor.test.tsx` | Editor page: load note, save on debounce, backlink detection, tag picker, folder selector |
| `daily.test.tsx` | Daily note: auto-create, date navigation, previous notes list |
| `graph.test.tsx` | Graph: render nodes/edges, click node, filter, stats display |
| `databases.test.tsx` | Database: create, add row/column, edit cell, delete, view toggle |
| `templates.test.tsx` | Template: list, use (with variable expansion), create, delete |
| `clipper.test.tsx` | Clipper: URL input, clip types, markdown preview, save |
| `plugins.test.tsx` | Plugin: list, toggle, settings, uninstall |

### Integration Tests

| Test | What It Verifies |
|------|-----------------|
| Note lifecycle | Create -> edit -> add tags -> pin -> search -> delete |
| Backlink auto-detection | Create note A, create note B with `[[A]]`, verify link exists |
| Daily note auto-create | Navigate to daily page, verify note created for today |
| Database CRUD | Create database -> add columns -> add rows -> edit cells -> delete |
| Template expansion | Create template with `{{date}}` -> use -> verify expanded |
| Canvas CRUD | Create canvas -> add nodes -> add edges -> move -> delete |

### Test Pattern (matching Books)

```typescript
// apps/web/app/notes/__tests__/actions.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { fetchNotes, createNoteAction, ... } from '../actions';

describe('notes server actions', () => {
  beforeEach(() => {
    // Reset DB state via test adapter
  });

  it('creates and fetches a note', async () => {
    const id = await createNoteAction({ title: 'Test', body: '# Hello' });
    const notes = await fetchNotes();
    expect(notes).toHaveLength(1);
    expect(notes[0].title).toBe('Test');
    expect(notes[0].wordCount).toBe(1); // "Hello"
  });

  // ... more tests
});
```

---

## 11. QA Checklist

### Critical Path (must pass before ship)

- [ ] Dashboard loads with correct stats from real data
- [ ] New note creation works (Cmd+N or button)
- [ ] Note editor saves on debounce and on Cmd+S
- [ ] `[[backlink]]` autocomplete shows matching notes
- [ ] FTS5 search returns highlighted results
- [ ] Daily note auto-creates for today
- [ ] Folder tree displays hierarchy correctly
- [ ] Tag picker creates and assigns tags
- [ ] All 10 pages load without errors
- [ ] All 10 pages have proper empty states (warm, not generic)
- [ ] All 10 pages have proper loading states (skeletons, not spinners)
- [ ] All 10 pages have proper error states (retry, not technical)
- [ ] Back navigation works from all sub-pages
- [ ] Database table editing works (click cell, type, save)
- [ ] Canvas nodes can be created, moved, and connected
- [ ] Web clipper converts a real URL to markdown
- [ ] Template expansion replaces `{{date}}` correctly
- [ ] Plugin enable/disable toggles persist

### Visual QA

- [ ] Cool Obsidian tokens used consistently (no light cards, no hardcoded hex)
- [ ] Glass morphism on header (blur + transparency)
- [ ] Slate accent (#64748B) for active states, buttons, highlights
- [ ] No hero sections or marketing chrome
- [ ] Compact note rows with metadata (word count, tags, updated time)
- [ ] Typography follows DESIGN.md variants
- [ ] Cards use borderRadius: 20, BORDER color
- [ ] Buttons meet 44px touch target minimum
- [ ] Responsive at 768px and 1024px breakpoints

### Accessibility

- [ ] All interactive elements keyboard-focusable
- [ ] Tab order matches visual order
- [ ] Focus indicators visible (2px accent outline)
- [ ] ARIA labels on icon-only buttons
- [ ] Color contrast meets WCAG 2.1 AA
- [ ] `prefers-reduced-motion` respected

### Performance

- [ ] Dashboard loads in < 200ms (local SQLite)
- [ ] Search results appear within 50ms (FTS5)
- [ ] Editor auto-save debounce doesn't cause jank
- [ ] Graph view handles 100+ nodes without lag
- [ ] Canvas view handles 50+ nodes with smooth pan/zoom
- [ ] No unnecessary re-renders in editor (React.memo where needed)

---

## 12. Implementation Priority

| Priority | Page | Complexity | Rationale |
|----------|------|-----------|-----------|
| P0 | `actions.ts` | Medium | Foundation for all pages |
| P0 | `layout.tsx` | Low | Module shell, nav links |
| P0 | `page.tsx` (dashboard) | Medium | First impression, stats + recent notes |
| P0 | `[id]/page.tsx` (editor) | High | Core experience, split-pane, backlinks |
| P1 | `daily/page.tsx` | Medium | High-frequency use case |
| P1 | `graph/page.tsx` | High | Desktop differentiator, SVG rendering |
| P1 | `templates/page.tsx` | Low | Template picker + creator |
| P2 | `databases/page.tsx` | High | Spreadsheet-style editing |
| P2 | `clipper/page.tsx` | Medium | URL fetch + HTML-to-markdown |
| P2 | `canvas/page.tsx` + `[id]` | High | Whiteboard is complex |
| P3 | `plugins/page.tsx` | Low | Plugin management UI |

**Recommended build order:** actions.ts -> layout.tsx -> page.tsx -> [id]/page.tsx (editor) -> daily -> graph -> templates -> databases -> clipper -> canvas -> plugins

---

## 13. Dependencies and Constraints

- **No new npm packages required.** All rendering is vanilla React + CSS. Graph uses SVG. Canvas uses `<canvas>` HTML element. Markdown preview uses simple regex-based rendering (same approach as `htmlToMarkdown` in the web clipper engine).
- **Module `@mylife/notes` is already imported** in `apps/web/lib/db.ts` (line 32).
- **No rich-text editor library.** The editor is a plain `<textarea>`. This is intentional: markdown-in, markdown-out, no lock-in.
- **Web clipper URL fetching** requires a server-side `fetch()` in the server action (cross-origin). No proxy needed since Next.js server actions run on the server.
- **Canvas editor** is the most complex component. Consider building it last and shipping the other 9 pages first.
- **All existing web stub files** (10 files) will be replaced with functional implementations. No new route additions needed beyond what exists.
