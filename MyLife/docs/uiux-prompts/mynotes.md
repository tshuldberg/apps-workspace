# MyNotes -- UI/UX Design Prompts

**Tagline:** Think in markdown, link everything
**Icon:** 📝 | **Accent:** #64748B | **Tier:** Free
**Bottom Tabs:** Home | Search | Folders | Graph | Settings
**Total Screens:** 14 mobile + 12 web = 26

---

## Prompt 1 -- Mobile Screens 1-12

```
Design system: Cool Obsidian (dark theme — #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

App: MyNotes
Platform: iOS (React Native / Expo)
Accent color: #64748B
Bottom tab bar: Home | Search | Folders | Graph | Settings

Design 12 mobile screens:

1. HOME (index.tsx)
- Bottom tab bar with Home tab active, #64748B accent highlight
- Pinned notes section at top: horizontal scroll of pinned note cards on #12121A surface
  - Each card: title (bold, #F0F0F5), first line preview, pin icon in corner
- Recent notes list below: vertical scroll
  - Each row on #12121A surface: title, first line preview (rgba(240,240,245,0.65)), last modified date, folder badge (small pill)
  - Tag chips below preview (small, glass fill)
- Folder tree sidebar: slide-in from left (hamburger menu or swipe gesture)
  - Nested folder hierarchy with expand/collapse chevrons
  - Note count per folder in rgba(240,240,245,0.65)
- FAB bottom-right for quick create, #64748B fill with + icon

2. EDITOR (editor.tsx)
- Full-screen editor, nav bar: back arrow, note title (editable), overflow menu (pin, share, move, delete)
- Markdown editor with live content area on #0A0A0F background
- Floating toolbar at bottom (above keyboard) on #1A1A24 surface:
  - Bold (B), Italic (I), Heading (H), Link (chain), List (bullets), Code (brackets), Table (grid icon), Image (photo icon), Checkbox (check-square)
  - Toolbar scrollable if needed
- [[wikilink]] auto-complete: typing [[ triggers inline dropdown of matching note titles
  - Dropdown on #1A1A24 surface with rgba(255,255,255,0.10) border
  - Note titles listed with folder context
- Live preview toggle button in nav bar: switches between raw markdown and rendered view
- Word count in bottom-right corner, rgba(240,240,245,0.65)
- Unsaved changes indicator (dot next to title)

3. NOTE DETAIL ([id].tsx)
- Nav bar: back arrow, edit button (pencil icon), overflow menu (pin, move, export, delete)
- Full note rendered as markdown on #0A0A0F background
  - Headers, bold, italic, links, code blocks, tables, images, checkboxes all styled
  - Code blocks on #1A1A24 surface with monospace font
  - Links in #64748B color
- Backlinks section at bottom: "Linked References" header
  - List of notes that link to this note: title, matched [[link]] context snippet
  - Tap to navigate to linking note
- Metadata footer in rgba(240,240,245,0.65):
  - Tags as chips
  - Word count
  - Created date, last updated date
  - Folder location

4. SEARCH (search.tsx)
- Bottom tab bar with Search tab active
- Large search input at top, auto-focus, #1A1A24 background
- FTS5 full-text search across all note content
- Result list: each result on #12121A surface
  - Note title (bold), folder path (rgba(240,240,245,0.65))
  - Context snippet with highlighted matched keywords (#64748B background tint)
  - Tags shown as chips
- Search operators hint: "tip: use folder:name to filter" in rgba(240,240,245,0.65)
- Recent searches section when input is empty
- Result count below search bar

5. FOLDERS (folders.tsx)
- Bottom tab bar with Folders tab active
- Folder hierarchy with nesting, expandable tree view
- Each folder row on #12121A surface:
  - Folder icon (open/closed state), folder name (bold), note count
  - Expand/collapse chevron for subfolders
  - Indent levels: 0px, 24px, 48px for nesting depth
- Drag-and-drop reorder: hold to pick up, drag to new position or into another folder
- Long-press context menu: Rename, Move, Create Subfolder, Delete
- "New Folder" button at top with + icon
- Swipe-to-delete with #FF453A confirmation
- Root level shows all top-level folders + "Unfiled" section for unorganized notes

6. TAGS (tags.tsx)
- Nav bar: back arrow, "Tags" title
- Tag browser: all tags displayed as a cloud or list
- Each tag row on #12121A surface:
  - Tag name with # prefix, usage count badge
  - Tap to view all notes with this tag
- Sort options: Alphabetical | Most Used | Recently Used
- Co-occurrence analysis section: "Often Used Together" header
  - Tag pairs shown with connection count
- Unused tag cleanup: "Unused Tags" section at bottom
  - Tags with 0 notes, "Clean Up" button to batch-remove
- Tag suggestions: "Suggested" section based on note content analysis
- Search bar at top to filter tags

7. GRAPH VIEW (graph.tsx)
- Bottom tab bar with Graph tab active
- Full-screen visual knowledge graph on #0A0A0F background
- Nodes: circles representing notes, sized by connection count
  - Node color: #64748B default, folder-based color variation
  - Node label: note title (truncated), visible on zoom
- Edges: lines connecting linked notes ([[wikilinks]])
  - Line color: rgba(255,255,255,0.10), subtle
- Interactions:
  - Pinch-to-zoom, pan to navigate
  - Tap node to select: highlights direct connections, shows note preview card
  - Double-tap node to open note
- Filter panel (slide-up sheet): filter by folder, filter by tag, connection depth slider
- Local graph mode: toggle to show only connections from selected note (1-2 hops)
- Clustering: densely connected notes grouped visually
- Stats overlay: total nodes, total edges, average connections per note

8. TEMPLATES (templates.tsx)
- Nav bar: back arrow, "Templates" title
- 8 built-in templates displayed as cards on #12121A surface:
  - Meeting Notes, Daily Note, Project Plan, Reading Notes, Decision Log, Research Notes, Weekly Review, Bug Report
  - Each card: template name, description preview, variable count badge
- Variable expansion system: {{date}}, {{title}}, {{time}} shown as highlighted tokens
- "Use Template" button per card (#64748B) -- creates new note with template applied
- Custom templates section below: user-created templates
  - "Create Template" button with + icon
  - Edit, rename, delete per custom template
- Template preview: tap to see full template content in modal

9. DAILY NOTE (daily.tsx)
- Nav bar: date display (large, centered), left/right arrows for date navigation
- Get-or-create behavior: loads existing daily note or creates from daily template
- Date browser: prev/next arrows cycle through dates
  - Calendar icon opens date picker modal
  - Dots on dates that have existing daily notes
- Note content area: markdown editor (same toolbar as editor.tsx)
- Auto-template: new daily notes pre-filled from daily note template
- Quick links at top: "Yesterday" | "Tomorrow" | "This Week" pills
- Metadata: word count, created time shown in rgba(240,240,245,0.65)

10. CANVAS (canvas.tsx)
- Full-screen whiteboard, minimal nav bar: back arrow, canvas title, tool picker
- Infinite canvas with zoom/pan (pinch + drag)
- Tool palette (floating, draggable):
  - 6 node types: Note (link to existing note), Text (free text), Image (photo), Link (URL), Group (container), Embed (note content inline)
  - 5 shapes: Rectangle, Circle, Diamond, Hexagon, Triangle
  - 3 edge styles: Solid, Dashed, Arrow
- Node interactions: tap to select, drag to move, resize handles on corners
- Edge drawing: drag from node edge to another node, style picker on creation
- Grouping: select multiple nodes, "Group" action in context menu
- Color picker for node fill and border
- Layer ordering: bring forward, send back
- Minimap in bottom-right corner for orientation

11. DATABASES (databases.tsx)
- Nav bar: back arrow, "Databases" title
- Database list: each database card on #12121A surface
  - Database name, row count, column count, last updated
  - View type icon (table/board/list/gallery)
- "New Database" button at top with + icon
- Database detail view (on tap):
  - Column headers with type indicators:
    - Text (T), Number (#), Select (dropdown), Date (calendar), Checkbox (check), Relation (link)
  - Rows of data in table format, horizontally scrollable
  - Tap cell to edit inline
  - "Add Row" button at bottom, "Add Column" button at right
- View switcher tabs: Table | Board (kanban by select column) | List | Gallery (card grid by image column)
- Filter bar: add filter rules per column
- Sort control: sort by any column, ascending/descending

12. CHECKLISTS (checklists.tsx)
- Nav bar: back arrow, "Checklists" title
- Checklist notes listed: each card on #12121A surface
  - Checklist name, progress bar (filled portion in #64748B), "3/7 items" count
  - Last updated date
- Checklist detail view:
  - Items with checkboxes: tap to toggle complete/incomplete
  - Completed items: strikethrough text, rgba(240,240,245,0.65) color
  - Indent/outdent nesting: swipe right to indent, swipe left to outdent
  - Drag-to-reorder items
  - Auto-sort toggle: unchecked items first, checked items pushed to bottom
  - "Add Item" input at bottom with + icon
- Progress bar at top: visual completion percentage
- "New Checklist" button on list view
```

---

## Prompt 2 -- Mobile Screens 13-14 + Web Pages 15-26

```
Design system: Cool Obsidian (dark theme — #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

App: MyNotes
Accent color: #64748B

Design 14 screens (2 remaining mobile + 12 web):

--- MOBILE (iOS, React Native / Expo) ---

1. WEB CLIPPER (clipper.tsx)
- Nav bar: back arrow, "Web Clipper" title
- URL input field at top: paste or type URL, "Clip" button (#64748B)
- Processing state: spinner with "Converting to Markdown..."
- Preview section: HTML-to-markdown conversion result displayed
  - Rendered markdown preview on #12121A surface
  - Raw markdown toggle for editing
- Save options below preview:
  - Folder selector dropdown: choose destination folder
  - Tag assignment: tag chips with add button
  - Title override: editable title field (auto-populated from page title)
- "Save to Notes" button (#64748B, full width)
- Recent clips section: last 5 clipped URLs with titles
- Error state: "Could not parse URL" with retry button

2. SETTINGS (settings.tsx)
- Bottom tab bar with Settings tab active
- Settings sections on #12121A surface cards:
  - Default Folder: dropdown selector
  - Sort Order: radio options -- Name | Date Created | Date Modified
  - Editor Preferences:
    - Default to edit mode or preview mode toggle
    - Line numbers toggle
    - Spell check toggle
    - Auto-save interval selector
  - Sync: cloud sync status, last sync timestamp, force sync button
- Export section:
  - "Export All Notes" button -- format picker (Markdown ZIP / JSON)
  - Include attachments toggle
  - Last export date
- Plugin management section:
  - Installed plugins list with enable/disable toggles
  - "Browse Plugins" button
- Data section: note count, folder count, total word count, storage used
- Danger zone: "Delete All Notes" in #FF453A

--- WEB (Next.js 15, desktop layout with persistent MyLife hub sidebar) ---

3. HOME (/notes)
- Three-column layout: folder tree sidebar (left, 240px), note list (center, 320px), note preview (right, remaining)
- Folder tree: collapsible hierarchy, note counts, drag-drop support
- Note list: sorted by recent, each row shows title, first line, date, tags
- Note preview: rendered markdown of selected note
- Pinned notes section at top of note list
- Quick create: "New Note" button at top of note list
- Search bar above note list

4. EDITOR (/notes/[id]/edit)
- Full-width editor layout, max-width 800px centered
- Markdown editor with full toolbar: bold, italic, heading (H1-H3), link, list (ordered/unordered), code (inline/block), table, image upload, checkbox
- Split view option: editor left, preview right (50/50)
- [[wikilink]] autocomplete dropdown
- Breadcrumb: folder path above title
- Auto-save indicator in top-right
- Word count and reading time in footer

5. NOTE DETAIL (/notes/[id])
- Rendered markdown view, max-width 800px centered
- Table of contents sidebar (auto-generated from headings) for long notes
- Backlinks section at bottom
- Metadata panel (collapsible right sidebar): tags, folder, dates, word count
- "Edit" button prominent in top bar
- Print/export button in toolbar

6. SEARCH (/notes/search)
- Large search input centered at top, full width
- Advanced search panel: folder filter, tag filter, date range, content type
- Result list: title, folder path, context snippet with highlighted matches
- Faceted results: counts per folder on left sidebar
- Search history sidebar
- Keyboard shortcut hint: Cmd+K

7. FOLDERS (/notes/folders)
- Two-panel layout: folder tree (left), folder contents (right)
- Folder tree: same as sidebar but expanded, drag-drop reorder and nesting
- Folder contents: note list for selected folder, with subfolder list at top
- Bulk actions toolbar: move, tag, delete selected notes
- Breadcrumb navigation for nested folders
- Context menu: right-click for rename, move, delete, create subfolder

8. TAGS (/notes/tags)
- Tag cloud visualization at top: sized by usage frequency, colored by category
- Tag list below: sortable table with tag name, usage count, last used date
- Click tag to filter notes by that tag
- Co-occurrence network: small graph showing tag relationships
- Batch actions: merge tags, rename tag across all notes, delete unused tags
- Tag creation with color picker

9. GRAPH VIEW (/notes/graph)
- Full-width interactive knowledge graph, height 80vh
- Nodes and edges rendered with WebGL or SVG for performance
- Control panel (floating, top-right):
  - Zoom slider
  - Filter: by folder, by tag, by connection depth
  - Layout algorithm selector: force-directed, radial, hierarchical
  - Local/global graph toggle
- Click node: opens note preview panel on right side
- Double-click: navigates to note
- Stats panel (bottom): total nodes, edges, orphan notes, clusters
- Search within graph: highlight matching nodes

10. TEMPLATES (/notes/templates)
- Two-column layout: template list (left), template preview/editor (right)
- Built-in templates: 8 cards with name, description, use count
- Custom templates section with create/edit/delete
- Template editor: markdown editor with variable highlighting ({{date}}, {{title}})
- "Use Template" creates new note and opens editor
- Variable reference guide panel

11. DAILY NOTE (/notes/daily)
- Calendar view at top: month grid, dots on days with notes
- Selected day's note below: full editor or rendered view
- Navigation: prev/next day arrows, "Today" button
- Week view toggle: see all 7 daily notes in compact list
- Template section: configure daily note template
- Streak display: consecutive days with daily notes

12. CANVAS (/notes/canvas)
- Full-screen canvas workspace, toolbar along top
- Tool palette (left sidebar, vertical):
  - Selection, Text, Note link, Image, Link, Shape, Group, Edge
  - Shape subtypes: rectangle, circle, diamond, hexagon, triangle
  - Edge styles: solid, dashed, arrow
- Canvas area: infinite scroll with zoom (scroll wheel)
- Properties panel (right sidebar): selected node properties (color, size, text, links)
- Minimap (bottom-right)
- Canvas list: multiple canvases per notebook, switch between them
- Export: PNG, SVG, PDF

13. DATABASES (/notes/databases)
- Full-width database view, similar to Notion
- Database selector dropdown at top
- View tabs: Table | Board | List | Gallery
- Table view: spreadsheet-style with resizable columns, inline editing
- Board view: kanban columns by select/status field, drag cards between columns
- Filter bar: multiple filter rules, and/or logic
- Sort: multi-column sort
- "New Database" button, column type configuration panel
- Row detail: click row to open as full page with all fields

14. SETTINGS (/notes/settings)
- Form layout, max-width 640px centered on #12121A surface cards
- Same sections as mobile: default folder, sort order, editor preferences, sync
- Export section with download buttons
- Plugin management with web-specific plugins (browser extension, etc.)
- Keyboard shortcuts reference table
- Data statistics as cards
- Import section: import from Obsidian, Notion, Evernote (file upload)
```
