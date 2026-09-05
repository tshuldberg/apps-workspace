# Feature Spec: Canvas/Whiteboard

## Metadata
- **Module:** notes
- **Priority Score:** 26 / 50 (B-Tier)
- **Scoring Breakdown:** Market 5 x3 + Switching 2 x3 + Complexity 0 x2 + CrossModule 2 x1 + PaidUser 3 x1
- **Sprint:** Sprint 3-4 (B-Tier Features)
- **Estimated CC Time:** 12-16 hours
- **Depends On:** NT-001 (Markdown Editor, implemented), NT-002 (Image/File Attachments, implemented)
- **Blocks:** none

## Business Context

### Why This Feature Exists
An infinite canvas is a spatial thinking tool that lets users arrange notes, images, shapes, and connections on a freeform 2D surface. It bridges the gap between linear note-taking and visual brainstorming/mind-mapping. Obsidian Canvas (shipped 2022) became one of its most popular features, and Notion recently added a whiteboard integration. For MyNotes, canvas transforms the app from a text editor into a full knowledge workspace, the kind of upgrade that justifies a premium tier and makes MyNotes competitive with Obsidian for visual thinkers. This is a P3 priority due to the high complexity of building an infinite canvas rendering engine, but the market demand score of 5 reflects that every serious note app is adding spatial features.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Obsidian | Yes | Free (Sync is paid) | Canvas: infinite 2D surface. Embed notes, images, links, groups. JSON file format (.canvas). Drag-and-drop cards. Color-coded groups. Arrows between cards. Local-only, no collaboration. |
| Notion | Yes | Free tier (limited) | Whiteboard integration via third-party (Miro/FigJam embed). Native "Board" view for databases. No built-in infinite canvas. |
| Evernote | No | N/A | No spatial/canvas features. |
| Apple Notes | No | N/A | Sketch/drawing support but no infinite canvas or spatial note arrangement. |
| Miro | Yes | $96/yr | Dedicated infinite canvas tool. Not a note app. Collaboration-first. |
| Excalidraw | Yes | Free (open source) | Popular Obsidian plugin. Hand-drawn style infinite canvas. Often used as reference for canvas implementations. |

### Target User
Visual thinkers, brainstormers, and knowledge workers who use mind maps or spatial layouts to organize ideas. Primary migration target: Obsidian Canvas users who want mobile-first canvas support (Obsidian Canvas is desktop-centric), and Notion users who embed Miro/FigJam boards but want a native integrated canvas inside their notes app. Secondary target: students who create concept maps and study diagrams.

## Technical Context

### Where This Lives in MyLife

```
modules/notes/src/canvas/                        -- NEW: canvas data model and engine
modules/notes/src/canvas/types.ts                -- Canvas, CanvasNode, CanvasEdge, CanvasGroup types
modules/notes/src/canvas/engine.ts               -- Canvas operations (add/move/resize/delete nodes, connect edges)
modules/notes/src/canvas/layout.ts               -- Auto-layout algorithms (force-directed, grid snap)
modules/notes/src/canvas/serializer.ts           -- JSON serialization/deserialization
modules/notes/src/canvas/index.ts                -- Barrel export
modules/notes/src/canvas/__tests__/              -- Tests
modules/notes/src/db/canvas.ts                   -- NEW: canvas CRUD operations
modules/notes/src/db/schema-v3.ts                -- NEW: V3 migration for canvas tables
apps/mobile/app/(notes)/canvas.tsx               -- Mobile canvas viewer/editor screen
apps/mobile/app/(notes)/canvas-list.tsx           -- Mobile canvas list screen
apps/web/app/notes/canvas/page.tsx               -- Web canvas list page
apps/web/app/notes/canvas/[id]/page.tsx          -- Web canvas editor page
```

### Wireframe Position

```
Hub Dashboard
  +-- MyNotes card
       +-- Notes tab (existing)
       +-- Folders tab (existing)
       +-- Canvas tab  <-- NEW TAB
       |    +-- Canvas list (grid of canvas thumbnails)
       |    +-- [tap canvas] -> Canvas editor (full-screen infinite surface)
       +-- Search tab (existing)
       +-- Settings tab (existing)
```

### Data Model

Canvas data is stored in three new SQLite tables plus a JSON blob for the canvas state itself. The `nt_canvases` table stores canvas metadata, while `nt_canvas_nodes` and `nt_canvas_edges` store the graph structure for querying/filtering without parsing JSON. A `canvas_json` column on the canvas table stores the full rendering state for fast load/save.

```sql
-- V3 Migration: Canvas/Whiteboard

CREATE TABLE IF NOT EXISTS nt_canvases (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled Canvas',
  description TEXT DEFAULT '',
  folder_id TEXT REFERENCES nt_folders(id) ON DELETE SET NULL,
  thumbnail_path TEXT,
  canvas_json TEXT NOT NULL DEFAULT '{"nodes":[],"edges":[],"groups":[],"viewport":{"x":0,"y":0,"zoom":1}}',
  width INTEGER NOT NULL DEFAULT 0,           -- bounding box width (0 = unbounded)
  height INTEGER NOT NULL DEFAULT 0,          -- bounding box height (0 = unbounded)
  is_pinned INTEGER NOT NULL DEFAULT 0,
  node_count INTEGER NOT NULL DEFAULT 0,      -- denormalized for list display
  edge_count INTEGER NOT NULL DEFAULT 0,      -- denormalized for list display
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS nt_canvas_nodes (
  id TEXT PRIMARY KEY NOT NULL,
  canvas_id TEXT NOT NULL REFERENCES nt_canvases(id) ON DELETE CASCADE,
  node_type TEXT NOT NULL DEFAULT 'text'
    CHECK (node_type IN ('text', 'note', 'image', 'link', 'group', 'shape')),
  label TEXT DEFAULT '',
  content TEXT DEFAULT '',                    -- markdown body for text nodes
  ref_note_id TEXT REFERENCES nt_notes(id) ON DELETE SET NULL,    -- for 'note' type
  ref_attachment_id TEXT REFERENCES nt_attachments(id) ON DELETE SET NULL,  -- for 'image' type
  url TEXT,                                   -- for 'link' type
  x REAL NOT NULL DEFAULT 0,                  -- position x
  y REAL NOT NULL DEFAULT 0,                  -- position y
  w REAL NOT NULL DEFAULT 200,                -- width
  h REAL NOT NULL DEFAULT 100,                -- height
  color TEXT DEFAULT '',                      -- node color (accent override)
  shape TEXT DEFAULT 'rectangle'
    CHECK (shape IN ('rectangle', 'rounded', 'ellipse', 'diamond', 'hexagon')),
  group_id TEXT,                              -- parent group node id (self-referential)
  z_index INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS nt_canvas_edges (
  id TEXT PRIMARY KEY NOT NULL,
  canvas_id TEXT NOT NULL REFERENCES nt_canvases(id) ON DELETE CASCADE,
  source_node_id TEXT NOT NULL REFERENCES nt_canvas_nodes(id) ON DELETE CASCADE,
  target_node_id TEXT NOT NULL REFERENCES nt_canvas_nodes(id) ON DELETE CASCADE,
  label TEXT DEFAULT '',
  edge_style TEXT NOT NULL DEFAULT 'straight'
    CHECK (edge_style IN ('straight', 'curved', 'step')),
  arrow_start INTEGER NOT NULL DEFAULT 0,     -- 0=none, 1=arrow
  arrow_end INTEGER NOT NULL DEFAULT 1,       -- 0=none, 1=arrow
  color TEXT DEFAULT '',
  stroke_width REAL NOT NULL DEFAULT 2,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS nt_canvases_folder_idx ON nt_canvases(folder_id);
CREATE INDEX IF NOT EXISTS nt_canvases_pinned_idx ON nt_canvases(is_pinned);
CREATE INDEX IF NOT EXISTS nt_canvas_nodes_canvas_idx ON nt_canvas_nodes(canvas_id, z_index);
CREATE INDEX IF NOT EXISTS nt_canvas_nodes_ref_note_idx ON nt_canvas_nodes(ref_note_id) WHERE ref_note_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS nt_canvas_nodes_group_idx ON nt_canvas_nodes(group_id) WHERE group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS nt_canvas_edges_canvas_idx ON nt_canvas_edges(canvas_id);
CREATE INDEX IF NOT EXISTS nt_canvas_edges_source_idx ON nt_canvas_edges(source_node_id);
CREATE INDEX IF NOT EXISTS nt_canvas_edges_target_idx ON nt_canvas_edges(target_node_id);
```

### Zod Schemas (new types in `canvas/types.ts`)

```typescript
// Node types
const CanvasNodeTypeEnum = z.enum(['text', 'note', 'image', 'link', 'group', 'shape']);
const CanvasShapeEnum = z.enum(['rectangle', 'rounded', 'ellipse', 'diamond', 'hexagon']);
const CanvasEdgeStyleEnum = z.enum(['straight', 'curved', 'step']);

// Viewport state
const CanvasViewportSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number().min(0.1).max(5),
});

// Full canvas JSON blob structure
const CanvasJsonSchema = z.object({
  nodes: z.array(CanvasNodeJsonSchema),
  edges: z.array(CanvasEdgeJsonSchema),
  groups: z.array(CanvasGroupJsonSchema),
  viewport: CanvasViewportSchema,
});

// Canvas entity
const CanvasSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  folderId: z.string().nullable(),
  thumbnailPath: z.string().nullable(),
  canvasJson: z.string(),
  width: z.number().int(),
  height: z.number().int(),
  isPinned: z.boolean(),
  nodeCount: z.number().int(),
  edgeCount: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
```

### Dependencies
- **Internal:** `@mylife/db` (SQLite adapter), `@mylife/ui` (Cool Obsidian tokens, gesture handling), `@mylife/module-registry` (navigation tab registration), existing `nt_notes` and `nt_attachments` tables (for embedded note/image references)
- **External:** `react-native-gesture-handler` (pinch/pan/drag on mobile), `react-native-reanimated` (smooth canvas animations on mobile). Web uses native PointerEvents and CSS transforms.
- **Cross-Module:** Notes module's existing backlinks system. When a note is embedded on a canvas, it creates a conceptual link visible in the knowledge graph. Canvases should appear in graph view as hub nodes connecting the notes they reference.

## Functional Requirements

### User Stories
1. As a visual thinker, I want to create an infinite canvas where I can spatially arrange text cards, notes, and images so that I can brainstorm and organize ideas visually.
2. As a knowledge worker, I want to embed existing MyNotes documents onto a canvas and draw connections between them so that I can map relationships between my notes.
3. As a student, I want to create concept maps with labeled arrows between topics so that I can study and understand how concepts relate.
4. As a note-taker, I want to quickly add text cards and shape nodes on a canvas so that I can capture ideas without leaving the spatial view.
5. As a power user, I want to group related cards together and move them as a unit so that I can organize complex canvases.
6. As a user, I want my canvas position and zoom level to be remembered so that I return to where I left off.
7. As a user, I want to see a list of all my canvases with thumbnails so that I can quickly find the one I need.

### Behavior Specification

**Canvas List Screen:**
1. User taps the Canvas tab in MyNotes navigation
2. System shows a grid of canvas cards, each displaying: title, node count, thumbnail (if available), last updated date
3. Pinned canvases appear first, then sorted by last updated
4. User taps "+" FAB to create a new canvas
5. System creates canvas with default title "Untitled Canvas" and opens the editor
6. Long-press on a canvas card shows context menu: Rename, Pin/Unpin, Move to Folder, Duplicate, Delete

**Canvas Editor (Core Interaction Loop):**
1. Canvas opens showing the saved viewport position and zoom
2. The canvas is an infinite 2D surface with a subtle dot grid background
3. **Pan:** Two-finger drag (mobile) or middle-click drag / spacebar+drag (web) pans the viewport
4. **Zoom:** Pinch gesture (mobile) or scroll wheel (web) zooms the canvas. Range: 10%-500%. Zoom-to-fit button in toolbar.
5. **Select:** Tap/click a node to select it. Selection shows resize handles and a floating toolbar (color, delete, edit).
6. **Multi-select:** Drag on empty space to create a selection box. All nodes within the box become selected. Selected nodes can be moved/deleted together.
7. **Move:** Drag a selected node to reposition it. Snapping to grid (optional, toggleable) provides alignment guides.
8. **Resize:** Drag corner handles to resize a node. Minimum size: 80x40.

**Adding Nodes:**
1. Double-tap/double-click on empty space creates a new text card at that position
2. Toolbar buttons allow adding specific node types:
   - **Text card:** Empty markdown-editable card
   - **Embed note:** Opens a note picker, selected note appears as a read-only card showing title + first ~100 chars
   - **Embed image:** Opens attachment picker or file picker, image appears at native aspect ratio
   - **Link card:** Enter URL, shows URL title and favicon
   - **Shape:** Rectangle, rounded rect, ellipse, diamond, hexagon with optional label
3. New nodes appear at the center of the current viewport if added via toolbar, or at tap position if added via double-tap

**Connecting Nodes (Edges):**
1. User drags from a node's edge connector (small circles on each side of the node) to another node
2. A line is drawn between the two nodes. Default: straight line with arrow on target end.
3. Tap an edge to select it. Floating toolbar shows: label (editable text field), style (straight/curved/step), arrow start/end toggles, color, delete.
4. Edges remain connected when nodes are moved (rubber-band behavior).
5. An edge cannot connect a node to itself.

**Groups:**
1. Select multiple nodes, then tap "Group" in the floating toolbar
2. System creates a group node as a colored background rectangle behind the selected nodes
3. Group has a title bar (editable label) and a color
4. Moving the group moves all contained nodes together
5. Double-tap group title bar to rename
6. "Ungroup" removes the group node but leaves children in place

**Editing Node Content:**
1. Double-tap a text card to enter edit mode. A markdown text input appears inline.
2. Double-tap an embedded note card to navigate to the note editor. Canvas state is saved first.
3. When returning from note editor, canvas restores to saved viewport.

**Canvas Settings (per-canvas):**
1. Grid snap: on/off
2. Grid size: 10/20/40 pixels
3. Background: dots/lines/none
4. Default edge style: straight/curved/step

### Edge Cases

- **Empty canvas:** Show centered placeholder text "Double-tap to add your first card" with a pulsing + icon.
- **Large canvas (1000+ nodes):** Only render nodes within the current viewport plus a buffer zone. Use spatial indexing (quadtree or simple bounds check) for viewport culling.
- **Referenced note deleted:** If a note embedded on a canvas is deleted, the canvas node shows "[Note deleted]" in muted text with a warning icon. The node is NOT auto-deleted; the user must manually remove it.
- **Referenced attachment deleted:** Same behavior as deleted note. Shows "[Image removed]" placeholder.
- **Canvas deleted:** All nodes and edges cascade-deleted via SQLite foreign keys. No orphan records.
- **Extremely large node (e.g., long text):** Text cards have a max rendered height. Content beyond the max is truncated with "..." and a "See full text" expand toggle.
- **Overlapping nodes:** Z-index determines render order. Selecting a node brings it to front (highest z-index).
- **Undo/redo:** Maintain an in-memory operation stack for the current editing session. Undo/redo buttons in toolbar. Stack cleared when leaving the canvas.
- **Module disabled mid-use:** Canvas editor saves current state and gracefully exits to hub dashboard.
- **Viewport persistence:** Canvas viewport (x, y, zoom) is saved in `canvas_json` on every meaningful state change (debounced 500ms after last interaction).
- **Concurrent edits (future-proof):** Single-user local-only in v1. No conflict resolution needed. The `canvas_json` column is the single source of truth.

## Acceptance Criteria

**These are the definitive checks that prove this feature works. A QA tester will verify each one. Every criterion must be independently testable.**

### User Experience Criteria
- [ ] **AC-1:** User can create a new canvas from the Canvas tab and it opens in the editor with an empty surface
- [ ] **AC-2:** User can pan the canvas by two-finger drag (mobile) or spacebar+drag (web) and the viewport moves smoothly
- [ ] **AC-3:** User can zoom with pinch (mobile) or scroll wheel (web) between 10% and 500%
- [ ] **AC-4:** User can double-tap/double-click empty space to create a text card at that position
- [ ] **AC-5:** User can add an "Embed Note" node that displays the referenced note's title and preview text
- [ ] **AC-6:** User can add an "Embed Image" node that displays the referenced attachment at correct aspect ratio
- [ ] **AC-7:** User can add a "Link" node by entering a URL, displaying the URL as card content
- [ ] **AC-8:** User can add shape nodes (rectangle, rounded, ellipse, diamond, hexagon) with optional labels
- [ ] **AC-9:** User can select a node by tapping/clicking it, and selection shows resize handles and a floating toolbar
- [ ] **AC-10:** User can drag a selected node to reposition it on the canvas
- [ ] **AC-11:** User can resize a node via corner handles, with minimum size 80x40
- [ ] **AC-12:** User can draw an edge by dragging from a node's edge connector to another node
- [ ] **AC-13:** User can select an edge and change its style (straight/curved/step), add a label, toggle arrows
- [ ] **AC-14:** Edges follow their connected nodes when nodes are moved
- [ ] **AC-15:** User can multi-select nodes via selection box drag on empty space
- [ ] **AC-16:** User can group selected nodes, and the group moves all children together
- [ ] **AC-17:** User can ungroup to dissolve a group while preserving child positions
- [ ] **AC-18:** User can double-tap a text card to enter inline markdown editing
- [ ] **AC-19:** User can double-tap an embedded note card to navigate to the note editor, then return to the canvas
- [ ] **AC-20:** Canvas list shows all canvases in a grid with title, node count, and last updated date
- [ ] **AC-21:** User can pin/unpin canvases and pinned canvases appear first in the list
- [ ] **AC-22:** User can rename, duplicate, and delete canvases from the list context menu
- [ ] **AC-23:** Undo/redo works for add, move, resize, delete, and connect operations within a session
- [ ] **AC-24:** "Zoom to fit" button adjusts viewport to show all nodes
- [ ] **AC-25:** Grid snap (when enabled) aligns nodes to the configured grid size

### Technical Criteria
- [ ] **TC-1:** Canvas data persists across app restarts (both metadata in tables and full state in canvas_json)
- [ ] **TC-2:** Viewport position and zoom are restored when reopening a canvas
- [ ] **TC-3:** Node counts are correctly denormalized in nt_canvases.node_count and edge_count
- [ ] **TC-4:** Deleting a canvas cascade-deletes all its nodes and edges with no orphan records
- [ ] **TC-5:** Deleting a note that is embedded on a canvas does NOT crash; the canvas node shows "[Note deleted]"
- [ ] **TC-6:** Deleting an attachment referenced by a canvas node shows "[Image removed]" placeholder
- [ ] **TC-7:** Canvas with 500+ nodes renders without visible frame drops (viewport culling active)
- [ ] **TC-8:** canvas_json is saved on a debounced 500ms timer after the last interaction
- [ ] **TC-9:** Migration V3 creates all three tables and indexes without errors on fresh and existing databases
- [ ] **TC-10:** All Zod schemas validate correctly for canvas, canvas node, and canvas edge entities
- [ ] **TC-11:** Canvas appears in the Notes tab of the module navigation as a new tab
- [ ] **TC-12:** FTS search does NOT index canvas content (canvases are found by title search in list view only)

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** An edge must NOT connect a node to itself (self-loop)
- [ ] **NC-2:** Canvas operations must NOT modify the nt_notes, nt_note_links, or nt_note_tags tables directly
- [ ] **NC-3:** Canvas data must NOT be sent over the network (privacy-first, local-only)
- [ ] **NC-4:** Creating or deleting a canvas must NOT affect note counts in getNotesStats()
- [ ] **NC-5:** Canvas must NOT register in the knowledge graph as note-to-note links (canvas embedding is a visual relationship, not a wiki backlink)

## UI Specification

### Mobile (Expo)

**Canvas List Screen:**
- Background: `#0A0A0F` (background token)
- Canvas cards: 2-column grid, `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border
- Card content: thumbnail placeholder (gradient), title in `#F0F0F5` (text token), node count and date in `rgba(240,240,245,0.65)` (textSecondary)
- Module accent: `#64748B` (slate, from Notes definition.ts)
- FAB: circular, module accent color, "+" icon
- Pin indicator: small pin icon top-right of card

**Canvas Editor Screen:**
- Full-screen canvas surface, no tab bar (immersive mode)
- Background: `#0A0A0F` with subtle dot grid at `rgba(255,255,255,0.06)` (border token)
- Top toolbar: translucent bar with back arrow, canvas title (editable), undo/redo, zoom-to-fit, overflow menu
- Bottom toolbar: node type buttons (text, note, image, link, shape) in a horizontal scrollable strip
- Node cards: `rgba(255,255,255,0.08)` (glassStrong) fill, `rgba(255,255,255,0.10)` border, 8px corner radius
- Selected node: border changes to `#64748B` (accent), resize handles as small circles at corners
- Edges: `rgba(240,240,245,0.65)` stroke, arrow heads as filled triangles
- Group: colored background with 50% opacity fill, dashed border, title above
- Floating toolbar on selection: pill-shaped bar above selected element with color/edit/delete icons
- Gestures: react-native-gesture-handler for pan, pinch, drag. react-native-reanimated for smooth 60fps transforms.

**Canvas Editor (Gesture Details):**
- Single finger drag on node: move node
- Single finger drag on empty: selection box
- Two finger drag: pan canvas
- Pinch: zoom
- Double tap on empty: create text card
- Double tap on node: edit node (text) or navigate (note embed)
- Long press on node: context menu

### Web (Next.js)

- Same tokens via CSS variables in `globals.css`
- Sidebar navigation: Canvas accessible via `/notes/canvas` route
- Canvas list: responsive grid (2-4 columns depending on viewport)
- Canvas editor: full-width below the sidebar, no additional chrome
- Mouse controls: scroll to zoom, middle-click drag or spacebar+drag to pan, click to select, drag to move, double-click to edit
- Right-click context menu on nodes/edges for quick actions
- Keyboard shortcuts: Delete/Backspace (delete selected), Ctrl+Z/Cmd+Z (undo), Ctrl+Shift+Z/Cmd+Shift+Z (redo), Ctrl+A/Cmd+A (select all), Ctrl+G/Cmd+G (group), Escape (deselect)
- Rendering: HTML div-based nodes with CSS transforms for position/scale. SVG overlay for edges. This avoids Canvas API complexity while maintaining DOM accessibility.

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton grid of canvas cards | Canvas list fetching from SQLite |
| Empty (list) | Centered illustration + "Create your first canvas" button | No canvases exist |
| Empty (editor) | Dot grid background + "Double-tap to add your first card" centered text | New canvas, no nodes |
| Error | "Could not load canvas" with retry button | SQLite read failure |
| Success (list) | Grid of canvas cards with thumbnails | Canvases exist |
| Success (editor) | Nodes, edges, and groups rendered on infinite surface | Canvas has content |
| Partial | Some nodes loaded, others showing skeleton placeholders | Large canvas still loading |
| Editing | Inline text input on a text card, cursor active | Double-tap text card |
| Selection | Blue border on selected node(s), floating toolbar visible | Tap/click node |
| Multi-selection | Selection box drawn, multiple nodes highlighted | Drag on empty space |

## Test Requirements

### Unit Tests
- [ ] `createCanvas`: creates canvas with default title and empty canvas_json
- [ ] `createCanvas`: respects provided title, description, folder_id
- [ ] `getCanvases`: returns all canvases sorted by pinned first, then updated_at desc
- [ ] `getCanvasById`: returns canvas with all fields
- [ ] `getCanvasById`: returns null for non-existent id
- [ ] `updateCanvas`: updates title, description, canvas_json, updated_at
- [ ] `deleteCanvas`: removes canvas and cascade-deletes nodes and edges
- [ ] `addNode`: creates node with correct position and type
- [ ] `addNode`: validates node_type enum
- [ ] `addNode`: increments canvas node_count
- [ ] `moveNode`: updates x, y coordinates
- [ ] `resizeNode`: updates w, h with minimum size enforcement (80x40)
- [ ] `deleteNode`: removes node, connected edges, and decrements counts
- [ ] `addEdge`: creates edge between two nodes
- [ ] `addEdge`: rejects self-loop (source === target)
- [ ] `addEdge`: increments canvas edge_count
- [ ] `deleteEdge`: removes edge and decrements count
- [ ] `groupNodes`: sets group_id on all selected nodes and creates group node
- [ ] `ungroupNodes`: clears group_id on children and deletes group node
- [ ] `getNodesForCanvas`: returns nodes sorted by z_index
- [ ] `getEdgesForCanvas`: returns all edges for a canvas
- [ ] `serializeCanvas`: produces valid CanvasJson from database records
- [ ] `deserializeCanvas`: populates tables from CanvasJson blob
- [ ] `viewportCull`: returns only nodes within viewport bounds plus buffer
- [ ] `viewportCull`: handles zero-node canvas without error
- [ ] `snapToGrid`: aligns position to nearest grid point
- [ ] `snapToGrid`: respects configurable grid size (10, 20, 40)
- [ ] `bringToFront`: sets z_index to max + 1 for selected node
- [ ] `zoomToFit`: computes viewport that fits all nodes with padding

### Integration Tests
- [ ] Full flow: create canvas -> add 3 text nodes -> connect with edges -> save -> reopen -> verify state restored
- [ ] Full flow: embed existing note -> delete original note -> canvas shows "[Note deleted]" placeholder
- [ ] Full flow: embed attachment -> delete attachment -> canvas shows "[Image removed]" placeholder
- [ ] Error flow: attempt self-loop edge -> graceful rejection with no edge created
- [ ] Delete flow: delete canvas -> verify zero orphan rows in nt_canvas_nodes and nt_canvas_edges
- [ ] Migration flow: V3 migration applies cleanly on database already at V2

### QA Verification Script

1. Open the app on mobile
2. Navigate to MyNotes -> Canvas tab
3. Verify: empty state shows "Create your first canvas" message -- corresponds to AC-20 (empty state)
4. Tap "+" FAB to create a new canvas
5. Verify: canvas editor opens with empty dot grid surface and placeholder text -- corresponds to AC-1
6. Double-tap on the canvas surface
7. Verify: a text card appears at the tapped position -- corresponds to AC-4
8. Double-tap the text card to enter edit mode
9. Type "Hello World" and tap outside to dismiss
10. Verify: text card shows "Hello World" -- corresponds to AC-18
11. Tap the "Embed Note" button in the bottom toolbar
12. Select an existing note from the picker
13. Verify: a note card appears showing the note's title and preview -- corresponds to AC-5
14. Drag from the text card's right edge connector to the note card
15. Verify: an arrow-headed edge connects the two cards -- corresponds to AC-12
16. Two-finger drag to pan the canvas
17. Verify: viewport moves smoothly -- corresponds to AC-2
18. Pinch to zoom out
19. Verify: canvas zooms smoothly -- corresponds to AC-3
20. Tap the zoom-to-fit button
21. Verify: viewport adjusts to show all nodes -- corresponds to AC-24
22. Select the text card, then drag it to a new position
23. Verify: the edge follows the node -- corresponds to AC-10, AC-14
24. Drag a corner resize handle on the text card
25. Verify: card resizes, minimum 80x40 enforced -- corresponds to AC-11
26. Create 3 more text cards, then drag-select all 4
27. Verify: selection box appears and all 4 are highlighted -- corresponds to AC-15
28. Tap "Group" in floating toolbar
29. Verify: colored background appears behind grouped nodes -- corresponds to AC-16
30. Drag the group
31. Verify: all children move together -- corresponds to AC-16
32. Tap "Ungroup"
33. Verify: group dissolves, nodes remain in position -- corresponds to AC-17
34. Tap undo repeatedly
35. Verify: operations reverse correctly -- corresponds to AC-23
36. Press back to return to canvas list
37. Verify: canvas appears in list with title, node count, and updated date -- corresponds to AC-20
38. Long-press the canvas card, tap "Pin"
39. Verify: canvas shows pin indicator -- corresponds to AC-21
40. Force-close and reopen the app
41. Navigate back to the canvas and open it
42. Verify: all nodes, edges, and viewport position are restored -- corresponds to TC-1, TC-2

## gstack Quality Gates

Based on this feature's Complexity Inverse score of 0 (Massive), ALL gates are required:

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI (yes -- canvas editor + list):
- [ ] `/browse` -- navigate to the Canvas tab URL, verify all 5 states (loading, empty, error, success, editing)
- [ ] Batch QA: after 5 features in Notes module, run `/qa` on the module URL

### Required if Complexity <= 2 (yes -- Complexity Inverse 0):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. Fix issues found.

### Required if Complexity <= 1 (yes -- Complexity Inverse 0):
- [ ] `/office-hours` (builder mode) -- validate canvas rendering approach before implementation

### Required if this feature contains business logic / calculation engine (yes -- canvas engine + layout):
- [ ] `/domain-engine-benchmarker` -- generate eval suite for canvas engine (node operations, viewport culling, serialization)

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- Notes module has no standalone counterpart (hub-only)
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
The Notes module has a rich text-based feature set: markdown notes with backlinks, FTS5 search, folders, tags, templates, checklists, code blocks, table support, daily notes, attachments with OCR, AI writing assistant, relational databases, graph view, web clipper, and a plugin system. All features are text/document-oriented. There is no spatial or visual canvas capability. Schema is at V2 with 7 core tables + V2 additions.

### After This Work
Notes gains a full infinite canvas system. Users can create canvases with text cards, embedded notes, images, links, shapes, and groups connected by styled edges. Schema advances to V3 with 3 new tables (`nt_canvases`, `nt_canvas_nodes`, `nt_canvas_edges`). A new "Canvas" tab appears in the Notes module navigation. The canvas engine (add/move/resize/delete/connect/group) is fully tested. Mobile uses gesture-handler + reanimated for smooth 60fps interaction. Web uses pointer events + CSS transforms with SVG edges.

### Files Changed

- `modules/notes/src/canvas/types.ts` -- Canvas, CanvasNode, CanvasEdge, CanvasGroup Zod schemas and TypeScript types
- `modules/notes/src/canvas/engine.ts` -- Node/edge/group CRUD operations, viewport culling, z-index management
- `modules/notes/src/canvas/layout.ts` -- Grid snap, zoom-to-fit, auto-layout helpers
- `modules/notes/src/canvas/serializer.ts` -- JSON blob serialization/deserialization between canvas_json and typed objects
- `modules/notes/src/canvas/index.ts` -- Barrel export for all canvas public API
- `modules/notes/src/canvas/__tests__/engine.test.ts` -- Canvas engine unit tests
- `modules/notes/src/canvas/__tests__/layout.test.ts` -- Layout/snap/culling unit tests
- `modules/notes/src/canvas/__tests__/serializer.test.ts` -- Serialization round-trip tests
- `modules/notes/src/db/canvas.ts` -- Canvas CRUD: createCanvas, getCanvases, getCanvasById, updateCanvas, deleteCanvas, addNode, moveNode, resizeNode, deleteNode, addEdge, deleteEdge, groupNodes, ungroupNodes, getNodesForCanvas, getEdgesForCanvas
- `modules/notes/src/db/schema-v3.ts` -- V3 migration: 3 CREATE TABLE, 8 CREATE INDEX
- `modules/notes/src/definition.ts` -- Add V3 migration, add Canvas tab to navigation, bump schemaVersion to 3
- `modules/notes/src/types.ts` -- Add Canvas, CanvasNode, CanvasEdge schemas and types (or import from canvas/types.ts)
- `modules/notes/src/index.ts` -- Re-export canvas public API
- `apps/mobile/app/(notes)/canvas.tsx` -- Mobile canvas editor with gesture-handler
- `apps/mobile/app/(notes)/canvas-list.tsx` -- Mobile canvas list grid
- `apps/web/app/notes/canvas/page.tsx` -- Web canvas list
- `apps/web/app/notes/canvas/[id]/page.tsx` -- Web canvas editor

### Known Limitations
- **No collaboration:** Single-user, local-only in v1. Multi-user canvas would require CRDTs or OT.
- **No canvas templates:** No pre-built canvas layouts (e.g., mind map template, kanban template). Possible future feature.
- **No drawing/freehand:** This is a card+edge canvas, not a drawing surface. Freehand sketching is a separate feature.
- **No canvas-to-canvas links:** Canvases cannot embed other canvases. A future enhancement.
- **Thumbnail generation:** v1 may use a placeholder gradient instead of actual canvas thumbnails. True thumbnails require offscreen rendering.
- **No export:** Canvas cannot be exported as image/PDF/SVG in v1. Future feature.
- **Performance ceiling:** Viewport culling handles 500+ nodes. Canvases with 5000+ nodes may degrade. Future optimization: WebGL renderer or spatial indexing via quadtree.

### Context for Next Agent
- The canvas rendering on web uses DOM elements + CSS transforms (not HTML5 Canvas API). This simplifies accessibility and text rendering but means hit-testing uses standard DOM events. If performance becomes an issue with large canvases, the next step is a WebGL-backed renderer.
- On mobile, `react-native-gesture-handler` and `react-native-reanimated` are assumed to be installed (they are Expo defaults). The canvas surface is a single `GestureDetector` wrapping an `Animated.View` with transforms for pan/zoom.
- The `canvas_json` column is the canonical state. The `nt_canvas_nodes` and `nt_canvas_edges` tables are denormalized copies for queryability (e.g., "find all canvases containing note X"). The serializer must keep them in sync. When loading, prefer `canvas_json` for speed; use tables for search queries.
- Edge connector positions are calculated at render time based on node positions and edge style. They are NOT stored in the database. The closest-side algorithm determines which side of the node the edge connects to.
- Undo/redo is session-only (in-memory stack). It does NOT survive app restarts. Each "operation" is a reversible command object with `execute()` and `undo()` methods.
