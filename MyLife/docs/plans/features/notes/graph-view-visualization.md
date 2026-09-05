# Feature Spec: Graph View Visualization

## Metadata
- **Module:** notes
- **Priority Score:** 34 / 50 (A-Tier)
- **Scoring Breakdown:** Market 5 x3 + Switching 3 x3 + Complexity 2 x2 + CrossModule 3 x1 + PaidUser 3 x1
- **Sprint:** Sprint 5 (S+A Features)
- **Estimated CC Time:** 3-4 hours
- **Depends On:** NT-006 (Wiki-Style Backlinks -- implemented, `nt_note_links` table exists, `getNoteGraph` function exists)
- **Blocks:** none

## Business Context

### Why This Feature Exists
The graph view is Obsidian's signature feature and a primary reason users pay $48/yr for sync. It visualizes the connections between notes as an interactive force-directed graph, revealing patterns and clusters in a user's knowledge base. MyNotes already has the entire backend: `nt_note_links` stores link relationships, `extractBacklinks` parses `[[wiki links]]`, and `getNoteGraph` returns nodes (notes) and edges (links). The only missing piece is the visual rendering -- an interactive graph canvas where users can see and explore their note connections. This is a high-impact, moderate-complexity feature because the data infrastructure already exists.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Obsidian | Yes | Free | Interactive force-directed graph with zoom, filter, color by folder/tag, local + global graph. Signature feature. |
| Logseq | Yes | Free | Similar to Obsidian. Force-directed graph with page references. |
| Notion | No | N/A | No graph view. Relational databases provide a different kind of relationship visualization. |
| Evernote | No | N/A | No graph view. No note linking. |
| Apple Notes | No | N/A | No graph view. No note linking. |

### Target User
Knowledge workers building a "second brain" or personal wiki. Researchers connecting papers and concepts. Writers linking character profiles, world-building notes, and plot threads. Primary migration target: Obsidian users (1.5M MAU) who use graph view to discover connections and identify orphan notes.

## Technical Context

### Where This Lives in MyLife

```
modules/notes/src/graph/                          -- NEW: graph layout + rendering data
modules/notes/src/graph/layout.ts                 -- Force-directed layout algorithm
modules/notes/src/graph/filters.ts                -- Graph filtering (by folder, tag, connections)
modules/notes/src/graph/index.ts                  -- Barrel export
modules/notes/src/graph/__tests__/                -- Tests
apps/mobile/app/(notes)/graph.tsx                 -- Mobile graph screen
apps/web/app/notes/graph/page.tsx                 -- Web graph page
```

### Wireframe Position

```
Hub Dashboard
  └── MyNotes card
       └── Notes tab
       └── Graph tab (new) ← YOU ARE HERE
```

### Data Model

No new tables needed. The graph is computed from existing data:

- `nt_notes` provides nodes (id, title)
- `nt_note_links` provides edges (source_note_id, target_note_id)
- `getNoteGraph()` already returns `{ nodes: GraphNode[], edges: GraphEdge[] }`

The `GraphNode` interface already exists in `types.ts` with `id`, `title`, and `linkCount`.

### Dependencies
- **Internal:** `@mylife/db`, `getNoteGraph` (existing), `getNotes`, `getTagsForNote`
- **External:** Canvas/SVG rendering library. Options: `react-native-canvas`, `react-native-skia` (performant, GPU-accelerated), or `d3-force` (layout) + `react-native-svg` (rendering). Recommend `d3-force` for layout + `react-native-svg` for mobile / SVG for web.
- **Cross-Module:** Graph view could visualize cross-module links (e.g., book notes linked to reading notes). Deferred to future work.

## Functional Requirements

### User Stories
1. As a knowledge worker, I want to see a visual graph of my notes and their connections so that I can discover patterns and clusters in my knowledge base.
2. As a researcher, I want to filter the graph by folder or tag so that I can focus on a specific topic area.
3. As a note organizer, I want to identify orphan notes (no connections) so that I can link them or archive them.

### Behavior Specification

1. User navigates to the Graph tab.
2. Graph renders as an interactive force-directed visualization:
   a. Each note is a node (circle) with its title as a label.
   b. Each link between notes is an edge (line connecting two nodes).
   c. Node size scales with link count (more connections = larger node).
   d. Nodes are colored by folder (each folder gets a distinct color from a palette).
3. Interactions:
   a. Pinch-to-zoom (mobile) or scroll wheel (web) zooms the graph.
   b. Pan by dragging the background.
   c. Tap/click a node to highlight it and its direct connections. Other nodes dim.
   d. Double-tap/double-click a node to open that note in the editor.
   e. Long-press a node to see a popover with: title, folder, tag list, link count, "Open" button.
4. Toolbar at the top:
   a. Filter by folder (dropdown).
   b. Filter by tag (dropdown).
   c. Toggle orphan notes visibility (default: shown with a distinct style).
   d. Search: type a note title to zoom to that node.
5. Local graph: when viewing a note, a "Local Graph" button shows only that note and its direct connections (1 hop). This appears in the note editor sidebar or as a panel.
6. Stats overlay: total nodes, total edges, average connections per note, orphan count.

### Edge Cases

- **No notes:** Empty graph with message "Create notes with [[links]] to build your graph."
- **No links:** All notes shown as disconnected nodes (orphans). Message: "Link notes with [[wiki links]] to see connections."
- **Single note:** One node, no edges.
- **Very large graph (1000+ notes):** Performance optimization required. Use quadtree for force simulation. Limit initial render to top 200 most-connected notes with a "Load all" button.
- **Circular links:** A links to B, B links to A. Both edges shown. Force layout handles this naturally.
- **Self-links:** A note linking to itself. Show as a loop edge or ignore (recommend ignore).
- **Deleted note with dangling links:** CASCADE deletes clean up links. Graph should never show deleted nodes.
- **Filter results in empty graph:** Show "No notes match the current filters."
- **Rapid zoom/pan on mobile:** Debounce re-render. Use GPU-accelerated rendering (Skia or SVG).

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Graph tab shows interactive force-directed graph of notes and links.
- [ ] **AC-2:** Nodes are labeled with note titles.
- [ ] **AC-3:** Node size scales with link count.
- [ ] **AC-4:** Nodes colored by folder.
- [ ] **AC-5:** Pinch-to-zoom and pan gestures work on mobile.
- [ ] **AC-6:** Tapping a node highlights it and its connections.
- [ ] **AC-7:** Double-tapping a node opens the note in the editor.
- [ ] **AC-8:** Filter by folder and tag available in toolbar.
- [ ] **AC-9:** Orphan notes visible with a distinct style (dashed border or faded).
- [ ] **AC-10:** Search zooms to a specific node.
- [ ] **AC-11:** Local graph shows a note and its direct connections.
- [ ] **AC-12:** Stats overlay shows total nodes, edges, average connections, orphan count.

### Technical Criteria
- [ ] **TC-1:** Graph data sourced from existing `getNoteGraph()` function.
- [ ] **TC-2:** Force-directed layout computed on the client (no server).
- [ ] **TC-3:** Graph with 200 notes renders within 2 seconds.
- [ ] **TC-4:** Large graphs (1000+ notes) use progressive loading.
- [ ] **TC-5:** Node positions stabilize within 3 seconds of initial render.

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Graph rendering must NOT block the main thread (use requestAnimationFrame or Web Workers).
- [ ] **NC-2:** Graph must NOT show deleted notes or broken links.
- [ ] **NC-3:** Opening the graph must NOT modify any note data.

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Nodes: circles, min 8px radius (orphans), max 24px radius (highly connected), 2px stroke
- Node colors: folder-based palette with 10 distinct colors, orphans in `rgba(240,240,245,0.25)`
- Node labels: 11px, `#F0F0F5`, positioned below node, truncated to 20 chars
- Edges: 1px lines, `rgba(255,255,255,0.15)`, curved slightly for readability
- Highlighted node: `#64748B` (accent) glow, connected nodes at full opacity, others at 0.15 opacity
- Toolbar: glass bar at top with folder filter, tag filter, search, orphan toggle
- Stats overlay: bottom-left, glass card, 12px text
- Module accent: `#64748B`

### Web (Next.js)

- Route: `/notes/graph`
- Full-width SVG canvas
- Hover effects on nodes (tooltip with title + link count)
- Click and drag to reposition individual nodes
- Keyboard: Ctrl+G to open graph from any notes page

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Empty | Message: "Create notes with [[links]] to build your graph" | No notes exist |
| No Links | All nodes disconnected, message about wiki links | Notes exist but no links |
| Normal | Interactive force-directed graph | Notes with links exist |
| Focused | Selected node highlighted, others dimmed | User taps a node |
| Filtered | Subset of nodes matching folder/tag filter | User applies filter |
| Local | Single note + direct connections | User opens local graph from note editor |
| Loading | Spinner while layout computes | Large graph initializing |

## Test Requirements

### Unit Tests
- [ ] `computeLayout`: 5 nodes, 4 edges -> returns positions for all nodes
- [ ] `computeLayout`: 0 nodes -> returns empty layout
- [ ] `computeLayout`: single node -> returns centered position
- [ ] `filterByFolder`: 10 nodes, filter to folder "Work" -> returns subset
- [ ] `filterByTag`: filter by tag "project" -> returns notes with that tag
- [ ] `getOrphanNodes`: 3 orphans out of 10 -> returns 3 node IDs
- [ ] `getLocalGraph`: node with 3 connections -> returns 4 nodes (center + 3) and 3 edges
- [ ] `scaleNodeSize`: 0 links -> min size, 20 links -> max size
- [ ] `computeGraphStats`: 10 nodes, 8 edges -> avg connections = 1.6, orphans = N

### Integration Tests
- [ ] Full flow: create 3 notes with [[links]] between them -> open graph -> 3 nodes and 2 edges visible
- [ ] Filter flow: create notes in 2 folders -> filter to one folder -> only that folder's notes shown

### QA Verification Script

1. Open the app on mobile
2. Navigate to MyNotes
3. Create 5 notes with [[wiki links]] between them
4. Navigate to the Graph tab
5. Verify: interactive graph with 5 nodes and edges -- corresponds to AC-1, AC-2
6. Verify: node sizes vary by connection count -- corresponds to AC-3
7. Assign notes to different folders
8. Verify: nodes colored by folder -- corresponds to AC-4
9. Pinch-to-zoom and pan the graph
10. Verify: smooth zoom and pan -- corresponds to AC-5
11. Tap a node
12. Verify: node highlighted, connections shown, others dimmed -- corresponds to AC-6
13. Double-tap a node
14. Verify: note opens in editor -- corresponds to AC-7
15. Use the folder filter
16. Verify: graph shows only notes in selected folder -- corresponds to AC-8
17. Create a note with no links
18. Verify: orphan node visible with distinct style -- corresponds to AC-9
19. Use the search field to find a note
20. Verify: graph zooms to that node -- corresponds to AC-10
21. Open the app on web
22. Navigate to Notes > Graph
23. Verify: same graph functionality with hover tooltips

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to graph view, verify interactions, filters, and navigation

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
The `nt_note_links` table stores note-to-note link relationships. `extractBacklinks` parses `[[wiki links]]` from markdown. `getNoteGraph` returns `{ nodes, edges }` data. The `GraphNode`, `GraphEdge`, and `NoteGraph` types exist. But there is no visual rendering -- no graph screen, no canvas, no interaction layer.

### After This Work
A Graph tab renders an interactive force-directed graph from existing link data. Nodes scale by connections, color by folder. Tap to highlight, double-tap to open. Filter by folder/tag. Search to zoom. Local graph from note editor. Orphan detection. Stats overlay.

### Files Changed
- `modules/notes/src/graph/layout.ts` -- force-directed layout computation (wraps d3-force)
- `modules/notes/src/graph/filters.ts` -- filterByFolder, filterByTag, getOrphanNodes, getLocalGraph
- `modules/notes/src/graph/index.ts` -- barrel export
- `modules/notes/src/graph/__tests__/layout.test.ts` -- layout tests
- `modules/notes/src/graph/__tests__/filters.test.ts` -- filter tests
- `modules/notes/src/index.ts` -- re-export graph module
- `apps/mobile/app/(notes)/graph.tsx` -- mobile graph screen
- `apps/web/app/notes/graph/page.tsx` -- web graph page

### Known Limitations
- No 3D graph (2D force-directed only).
- No animation of graph evolution over time.
- No cross-module links in graph (only note-to-note within MyNotes).
- Performance degrades above ~500 nodes on mobile. Progressive loading mitigates this.
- No export of graph as image (screenshot only).

### Context for Next Agent
- `getNoteGraph()` in `db/crud.ts` already returns the full graph data. Use this as the data source.
- For the force simulation, use `d3-force` with `forceSimulation`, `forceLink`, `forceManyBody`, `forceCenter`. This is a well-tested, performant layout algorithm.
- For mobile rendering, `react-native-svg` is the most compatible option. Alternatively, `react-native-skia` offers GPU acceleration but has a steeper learning curve.
- For web rendering, standard SVG or Canvas with D3 bindings.
- Node size: `minRadius + (linkCount / maxLinkCount) * (maxRadius - minRadius)`. Clamp to [8, 24].
- Folder colors: use a predefined 10-color palette. Hash folder ID to select a color index.
- The `navigation` in `definition.ts` needs a new tab entry for "Graph" added.
