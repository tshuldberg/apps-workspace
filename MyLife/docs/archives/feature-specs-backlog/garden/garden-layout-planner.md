# Feature Spec: Garden Layout Planner

## Metadata
- **Module:** garden
- **Priority Score:** 21 / 50 (B-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 3 x3 + Complexity 1 x2 + CrossModule 1 x1 + PaidUser 3 x1
- **Sprint:** Sprint 2+
- **Estimated CC Time:** 5-7 hours
- **Depends On:** room/zone organization (layouts scoped to zones), companion planting guide (compatibility data for placement suggestions)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Visual garden planning is a premium feature that commands high prices. GrowVeg charges $35 one-time and Planter charges $49.99 for apps whose primary value is garden bed layout planning. Users want to draw their garden beds on a grid, place plants with spacing information, see companion planting overlays, and print/export their plans. This is the most complex garden feature (Complexity score 1/5) but also one of the most differentiated -- none of the free garden apps offer it, making it a strong premium upsell.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| GrowVeg | Yes | $35 one-time | Desktop-focused drag-and-drop garden planner with plant spacing, crop rotation, succession planting |
| Planter | Yes | $49.99 lifetime | Grid-based bed planner with companion planting overlay, square-foot gardening support |
| Seed to Spoon | Partial | Premium ($46.99/yr) | Basic garden bed layout, less interactive than GrowVeg |
| PlantIn | No | N/A | No layout planner (houseplant-focused) |
| Planta | No | N/A | No layout planner |

### Target User
Vegetable gardeners who plan garden beds each season. Users who currently use paper graph paper, GrowVeg ($35), or Planter ($49.99) for garden planning. Square-foot gardening practitioners who want precise plant placement on a grid.

## Technical Context

### Where This Lives in MyLife

```
modules/garden/src/types.ts                        -- Layout, LayoutItem, LayoutGrid types
modules/garden/src/db/schema.ts                    -- gd_layouts, gd_layout_items tables (V2 migration)
modules/garden/src/db/crud.ts                      -- Layout CRUD, item placement
modules/garden/src/engine/layout-planner.ts         -- Grid management, spacing calc, companion overlay
modules/garden/src/definition.ts                   -- V2 migration
apps/mobile/app/(garden)/layout.tsx                -- Layout planner screen (canvas)
apps/mobile/app/(garden)/layout-editor.tsx          -- Full-screen layout editor
apps/mobile/app/(garden)/components/LayoutCanvas.tsx    -- Interactive grid canvas
apps/mobile/app/(garden)/components/PlantPlacer.tsx     -- Plant placement palette
apps/web/app/garden/layout/page.tsx                -- Web layout planner
apps/web/app/garden/layout/[id]/page.tsx           -- Web layout editor
```

### Wireframe Position

```
Hub Dashboard
  └── MyGarden card
       └── Garden tab
            └── Zone Detail
                 └── "Plan Layout" button
                      └── Layout Planner ← YOU ARE HERE
```

Also accessible via dedicated "Layout" action in the Garden tab toolbar for a quick entry.

### Data Model

```sql
-- V2 migration: garden layout planner
CREATE TABLE IF NOT EXISTS gd_layouts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  zone_id TEXT REFERENCES gd_zones(id) ON DELETE SET NULL,
  width_cells INTEGER NOT NULL DEFAULT 8,
  height_cells INTEGER NOT NULL DEFAULT 8,
  cell_size_inches INTEGER NOT NULL DEFAULT 12,
  season TEXT,
  year INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS gd_layout_items (
  id TEXT PRIMARY KEY,
  layout_id TEXT NOT NULL REFERENCES gd_layouts(id) ON DELETE CASCADE,
  plant_id TEXT REFERENCES gd_plants(id) ON DELETE SET NULL,
  item_type TEXT NOT NULL DEFAULT 'plant',
  label TEXT NOT NULL,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  width_cells INTEGER NOT NULL DEFAULT 1,
  height_cells INTEGER NOT NULL DEFAULT 1,
  color TEXT,
  icon TEXT,
  spacing_inches INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS gd_layouts_zone_idx ON gd_layouts(zone_id);
CREATE INDEX IF NOT EXISTS gd_layout_items_layout_idx ON gd_layout_items(layout_id);
CREATE INDEX IF NOT EXISTS gd_layout_items_plant_idx ON gd_layout_items(plant_id);
```

**Column notes:**
- `width_cells` / `height_cells` on gd_layouts: grid dimensions (e.g., 8x8 for a 4'x4' raised bed at 6" cells)
- `cell_size_inches`: physical size each cell represents (default 12 = 1 foot per cell, 6 = half foot for square-foot gardening)
- `season` + `year`: optional, for seasonal planning (e.g., 'spring', 2026)
- `item_type` on gd_layout_items: 'plant' | 'path' | 'structure' | 'water' | 'decoration' | 'empty'
- `x`, `y`: grid position (0-based from top-left)
- `width_cells` / `height_cells` on items: how many cells the item spans (e.g., 2x2 for a large plant)
- `spacing_inches`: recommended spacing from plant care database (display only, not enforced)
- `color`: hex color for the item on the grid
- `icon`: emoji or icon for display

### Dependencies
- **Internal:** `@mylife/garden` (types, zones, plants, companion data), `@mylife/ui`
- **External:** `react-native-gesture-handler` + `react-native-reanimated` (drag-and-drop on mobile), `react-native-svg` or Canvas API for grid rendering
- **Cross-Module:** None

## Functional Requirements

### User Stories
1. As a gardener, I want to create a grid-based layout of my garden bed so that I can plan plant placement before planting season.
2. As a gardener, I want to drag plants onto the grid and see their spacing requirements so that I don't overcrowd my beds.
3. As a gardener, I want companion planting indicators on the grid so that I can see which neighbors benefit or harm each other.
4. As a gardener, I want to create multiple layouts per zone (one per season) so that I can plan crop rotation.
5. As a gardener, I want to add non-plant items (paths, trellises, water sources) so that my layout represents the full garden structure.
6. As a gardener, I want to export my layout as an image so that I can print it and reference it in the garden.

### Behavior Specification

**Create a layout:**
1. User navigates to zone detail and taps "Plan Layout" (or uses Garden tab toolbar)
2. New layout form: name, zone (pre-filled), grid dimensions (width x height in cells), cell size (picker: 6" for square-foot, 12" for standard, 24" for large plots), season (optional), year (optional)
3. Creates empty grid

**Layout editor (full-screen):**
1. Grid displayed as a canvas: cells shown as bordered squares, header with row/column numbers
2. Plant palette: scrollable sidebar/bottom sheet with available plants from user's collection + a generic "Add plant by name" option
3. Drag a plant from the palette onto a cell. Plant icon + label appears on the grid.
4. Plant size auto-set from care database spacing (e.g., tomato = 2x2 cells at 12" cells), adjustable by user
5. Companion planting overlay: when a plant is placed, adjacent cells highlight green (good companions nearby) or red (antagonists nearby). Based on companion planting data.
6. Spacing warning: if two plants overlap or are closer than recommended, show a yellow border on the conflicting cells
7. Non-plant items: palette also offers Path (gray), Trellis (brown), Water Source (blue), Border (dark), Custom (user-defined label + color)
8. Tap a placed item to edit (move, resize, remove, change label)
9. Pinch-to-zoom and pan on the canvas for large grids

**Layout list:**
1. Shows all layouts, grouped by zone
2. Each card: layout name, grid size, season/year, plant count, zone name
3. Tap to open editor

**Export:**
1. "Export" button renders the layout as a PNG image
2. Share via system share sheet or save to photos
3. Include legend: plant labels, companion markers, grid dimensions

### Edge Cases

- **Empty grid:** Valid. User may create the grid first and add plants later.
- **Overlapping items:** Warn but allow (user may intentionally stack for succession planting)
- **Grid too large for screen:** Pinch-to-zoom + pan. Minimum zoom fits the entire grid. Maximum zoom shows 4 cells.
- **Plant not in companion database:** No companion overlay for that plant (gray neutral indicator)
- **Layout with deleted zone:** zone_id SET NULL. Layout persists but is orphaned. Show "No zone assigned" label.
- **Layout with deleted plants:** plant_id SET NULL on items. Item remains on grid with label but broken plant link.
- **Very large grid (>50x50):** Cap at 50x50 cells. Show: "Maximum grid size is 50x50."
- **Portrait vs landscape:** Layout editor forces landscape on mobile for wider grids. Or allow rotation.
- **Cell size change after placing items:** Warn: "Changing cell size will affect spacing calculations. Continue?"

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Create layout with name, zone, grid dimensions, and cell size
- [ ] **AC-2:** Grid canvas shows bordered cells with row/column headers
- [ ] **AC-3:** Plants draggable from palette onto grid cells
- [ ] **AC-4:** Placed plants show icon/label and occupy correct number of cells
- [ ] **AC-5:** Companion planting overlay highlights good (green) and bad (red) neighbors
- [ ] **AC-6:** Spacing warnings shown for overcrowded plants
- [ ] **AC-7:** Non-plant items (path, trellis, water, etc.) placeable on grid
- [ ] **AC-8:** Tap placed item to edit, move, or remove
- [ ] **AC-9:** Pinch-to-zoom and pan on large grids
- [ ] **AC-10:** Export layout as PNG image via share sheet
- [ ] **AC-11:** Multiple layouts per zone (seasonal planning)
- [ ] **AC-12:** Layout list shows all layouts grouped by zone

### Technical Criteria
- [ ] **TC-1:** Layouts and items persisted to gd_layouts and gd_layout_items
- [ ] **TC-2:** CASCADE delete on layout_id removes all items when layout deleted
- [ ] **TC-3:** SET NULL on zone_id and plant_id when referenced records deleted
- [ ] **TC-4:** Grid max 50x50 cells enforced
- [ ] **TC-5:** Companion overlay uses companion-data.ts for relationship lookup
- [ ] **TC-6:** PNG export renders at 2x resolution for print quality
- [ ] **TC-7:** Canvas rendering stays smooth at 60fps for grids up to 20x20

### Negative Criteria
- [ ] **NC-1:** Exported images must NOT contain user metadata or EXIF data
- [ ] **NC-2:** Layout data must NOT require network connectivity
- [ ] **NC-3:** Companion overlay must NOT automatically move or remove plants (advisory only)
- [ ] **NC-4:** Grid interactions must NOT modify actual plant records

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Module accent: `#22C55E`
- Grid cells: `rgba(255,255,255,0.06)` fill, `rgba(255,255,255,0.10)` border
- Plant items on grid: rounded squares with plant icon/emoji, label text below, accent background at 20% opacity
- Companion overlay: green glow on cells adjacent to companions, red glow for antagonists (semi-transparent overlay, does not obscure items)
- Spacing warning: yellow dashed border on conflicting cells
- Plant palette: bottom sheet that slides up, horizontally scrollable plant chips with icons
- Non-plant items: colored rectangles (gray=path, brown=trellis, blue=water, dark=border)
- Editor toolbar (top): Undo, Redo, Toggle Companion Overlay, Grid Settings, Export, Save
- Pinch-to-zoom: smooth animated zoom centered on pinch point

### Web (Next.js)

- Same tokens via CSS variables
- Route: `/garden/layout` (list), `/garden/layout/[id]` (editor)
- Full-screen editor: grid canvas center, plant palette as left sidebar, properties panel as right sidebar
- Mouse drag-and-drop for placing items
- Hover tooltips on placed items showing plant name + spacing info
- Export renders to a downloadable PNG

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton grid | Layout opening |
| Empty Grid | Bordered cells with no items | New layout created |
| Populated | Plants and items on grid with labels | Items placed |
| Companion Active | Green/red glow overlays on adjacent cells | Companion toggle on |
| Warning | Yellow borders on overcrowded areas | Spacing violations |
| Export Preview | PNG preview with share options | Export button tapped |

## Test Requirements

### Unit Tests
- [ ] `createLayout()`: persists with grid dimensions and cell size
- [ ] `placeItem()`: creates gd_layout_items at correct x,y
- [ ] `placeItem()`: rejects positions outside grid bounds
- [ ] `moveItem()`: updates x,y coordinates
- [ ] `removeItem()`: deletes item from grid
- [ ] `checkSpacing()`: detects overlap between two items
- [ ] `getCompanionOverlay()`: returns green/red indicators for adjacent plants
- [ ] `getCompanionOverlay()`: returns neutral for unknown plants
- [ ] `exportLayoutToPng()`: generates valid PNG data (basic render test)
- [ ] Grid size cap: rejects dimensions > 50x50

### Integration Tests
- [ ] Full flow: create layout -> place 3 plants -> verify companion overlay -> export
- [ ] Delete flow: delete layout -> verify all items CASCADE deleted
- [ ] Zone link: delete zone -> verify layout retains items but zone_id is null

### QA Verification Script

1. Open the app on iOS/Android
2. Navigate to MyGarden > a zone detail page
3. Tap "Plan Layout"
4. Create layout: "Spring 2026 Raised Bed", 8x8 grid, 12" cells -- AC-1
5. Verify: empty grid with bordered cells and row/column headers -- AC-2
6. Open plant palette (bottom sheet)
7. Drag "Tomato" onto the grid
8. Verify: tomato icon appears on grid, occupying correct cell count -- AC-3, AC-4
9. Place "Basil" adjacent to tomato
10. Toggle companion overlay on
11. Verify: green glow between tomato and basil -- AC-5
12. Place "Fennel" adjacent to tomato
13. Verify: red glow between tomato and fennel -- AC-5
14. Place two large plants in overlapping cells
15. Verify: yellow spacing warning appears -- AC-6
16. Add a "Path" item between beds
17. Verify: gray rectangle placed on grid -- AC-7
18. Tap a placed plant
19. Verify: edit options (move, resize, remove) appear -- AC-8
20. Pinch to zoom in/out
21. Verify: smooth zoom centered on pinch point -- AC-9
22. Tap "Export"
23. Verify: PNG preview with share sheet -- AC-10
24. Create a second layout for the same zone (different season)
25. Verify: both layouts appear in layout list for this zone -- AC-11, AC-12
26. On web: navigate to /garden/layout
27. Verify: layout list with create button
28. Open a layout in web editor
29. Verify: drag-and-drop works with mouse, sidebar shows palette

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required if Complexity <= 2 (Large/Complex):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. Fix issues found.

### Required if Complexity <= 1 (Complex/Massive):
- [ ] `/office-hours` (builder mode) -- validate approach before spec finalization

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- if module has standalone counterpart
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
No garden bed layout or visual planning capability. gd_zones provides organizational grouping but no spatial representation.

### After This Work
- gd_layouts and gd_layout_items tables for grid-based garden planning
- Interactive grid canvas editor on mobile and web
- Drag-and-drop plant placement from collection
- Companion planting overlay integrated with companion data
- Spacing conflict warnings
- Non-plant items (paths, structures, water sources)
- PNG export for printing
- Multi-layout support per zone (seasonal planning)

### Files Changed
- `modules/garden/src/types.ts` -- Layout, LayoutItem, ItemType, LayoutGrid types
- `modules/garden/src/db/schema.ts` -- gd_layouts, gd_layout_items tables
- `modules/garden/src/db/crud.ts` -- Layout and item CRUD
- `modules/garden/src/engine/layout-planner.ts` -- Grid logic, spacing calc, companion overlay
- `modules/garden/src/definition.ts` -- V2 migration
- `apps/mobile/app/(garden)/layout.tsx` -- Layout list
- `apps/mobile/app/(garden)/layout-editor.tsx` -- Full-screen editor
- `apps/mobile/app/(garden)/components/LayoutCanvas.tsx` -- Grid canvas
- `apps/mobile/app/(garden)/components/PlantPlacer.tsx` -- Plant palette
- `apps/web/app/garden/layout/page.tsx` -- Web layout list
- `apps/web/app/garden/layout/[id]/page.tsx` -- Web editor

### Known Limitations
- V1 grid is 2D top-down only. No vertical/3D representation (trellising, hanging baskets).
- Canvas rendering on mobile may be laggy for grids >20x20 without optimization (consider react-native-skia for hardware-accelerated rendering).
- Companion overlay is binary (companion/antagonist/neutral). Distance-based relationships are not modeled.
- No undo/redo history in V1 (complex to implement for canvas state).

### Context for Next Agent
- This is the most complex garden feature. Start with the data model and CRUD, then build the canvas renderer, then add drag-and-drop, then companion overlay, then export.
- The grid should be rendered using `react-native-svg` or a Canvas-based approach. SVG is easier for initial implementation but Canvas performs better for larger grids.
- Companion overlay data comes from the companion planting guide feature (companion-data.ts). Call `getRelationship(plantA, plantB)` for each pair of adjacent placed plants.
- Export uses a headless render of the canvas to PNG. On mobile, use `react-native-view-shot`. On web, use `html-to-image` or `canvas.toDataURL()`.
- Consider making this feature a mini-app within the garden module. It has its own editor state, its own undo history, and its own export pipeline. Keep it decoupled from the main garden CRUD.
