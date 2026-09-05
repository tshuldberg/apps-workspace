# Feature Spec: Garden Full Web UI

## Metadata
- **Module:** garden
- **Task:** W14-10
- **Sprint:** W14
- **Estimated CC Time:** 5-7 hours
- **Depends On:** none (all 75+ module exports exist, schema V2 with 15 tables, 25 mobile screens implemented)
- **Blocks:** Garden web QA pass, Garden web design review
- **Reference Implementation:** `apps/web/app/books/` (layout, page, actions, sub-routes, tests)

## Design Pipeline Signoff

### Phase 1: Office Hours (Builder Mode)

**Core insight:** A garden app on desktop must exploit what mobile cannot: spatial planning, data density, and simultaneous multi-panel views. The narrowest wedge -- the single screen that makes users say "I need this on desktop" -- is the **Garden Layout Planner with companion planting matrix**. On mobile, you see a scrollable list of plants. On desktop, you see a visual grid-based garden bed layout where you can drag-and-drop plants into spatial positions, check companion planting compatibility in real time, and view your full watering schedule alongside harvest analytics -- all on one screen. The layout planner is fundamentally a desktop experience: it needs mouse precision for placement, hover for compatibility tooltips, and screen real estate for the grid.

**Web-specific affordances to leverage:**
1. **Visual layout planner:** Drag-and-drop grid canvas for garden bed planning. Place plants spatially, see spacing recommendations, visualize companion relationships with color-coded borders. Impossible to do well on a phone screen.
2. **Companion planting matrix:** Full NxN compatibility grid showing beneficial/antagonistic pairs. Hover reveals the specific benefit. On mobile this is a search-one-at-a-time flow; on desktop you see the whole picture.
3. **Multi-panel plant detail:** Plant profile + care journal timeline + diagnosis history + harvest log + propagation tracker all visible simultaneously in a two-column layout.
4. **Data tables with sort/filter:** Harvest log as a sortable, filterable data table with totals. Seed inventory with expiry dates, quantities, and inline editing.
5. **Keyboard shortcuts:** `W` marks selected plant as watered. `N` opens new plant form. `J` opens journal entry. `L` switches to layout view. Number keys navigate between zones.
6. **Calendar views:** Watering schedule as a week/month calendar view (vs. mobile's linear list). Frost date countdown with planting calendar overlay.
7. **Bulk operations:** Water all plants in a zone with one click. Batch update plant status. Multi-select for journal entries.
8. **Deep linking:** Every plant, zone, layout, harvest, and diagnosis is a unique URL. Bookmarkable views for specific zones.

**Brainstorm scoring:**
- Demand signal: Serious gardeners already use desktop tools (spreadsheets, garden planning websites like GardenPlanner, GrowVeg). A desktop-native garden app serves the "planning session at the kitchen table with laptop" use case.
- Narrowest wedge: Layout planner + watering dashboard. If these two screens are beautiful and functional, desktop users adopt immediately.
- Expansion path: Layout planner -> Watering dashboard -> Harvest analytics -> Companion guide -> Frost/planting calendar (each adds a reason to stay on desktop).
- What makes it delightful vs mobile: The spatial, bird's-eye view of your garden. Seeing everything at once instead of drilling into one plant at a time. The feeling of "command center for my garden."

### Phase 2: Engineering Review

**Module surface area (verified):**
- 75+ named exports from `@mylife/garden`
- 17 feature clusters: plant CRUD, journal entries, zones (V1+V2), seeds, settings, garden stats, watering schedule/engine, identifications, seasonal tasks, harvests, diagnoses, wishlist, propagations, light readings, layouts/layout items, frost config, companion planting
- 15 SQLite tables (`gd_` prefix) across 2 migration versions
- 6 engine modules: watering, companion, diagnosis-db, light, propagation, seasonal-data, frost
- Schema version: 2

**Server actions needed (`actions.ts`):**

```typescript
// ── DB helper ──
function db() { const adapter = getAdapter(); ensureModuleMigrations('garden'); return adapter; }

// ── V1 Plant CRUD ──
fetchPlants(filter?), fetchPlantById(id), doCreatePlant(id, input), doUpdatePlant(id, input),
doDeletePlant(id), fetchPlantCount(), doWaterPlant(plantId)

// ── V1 Journal Entries ──
doCreateEntry(id, input), fetchEntriesForPlant(plantId, limit?), fetchEntriesByDate(start, end),
doDeleteEntry(id)

// ── V1 Zone CRUD ──
doCreateZone(id, input), fetchZones(), doDeleteZone(id)

// ── V2 Zone Operations ──
doUpdateZone(id, input), fetchZoneStats(zoneId)

// ── V1 Seed CRUD ──
doCreateSeed(id, input), fetchSeeds(), doUpdateSeedQuantity(id, qty), doDeleteSeed(id)

// ── V1 Settings ──
fetchSetting(key), doSetSetting(key, value)

// ── V1 Analytics ──
fetchGardenStats(), fetchWateringSchedule()

// ── V2 Identification ──
doCreateIdentification(id, data), fetchIdentificationsForPlant(plantId)

// ── V2 Seasonal Tasks ──
doCreateSeasonalTask(id, data), doCompleteSeasonalTask(id), doSnoozeSeasonalTask(id, until),
fetchPendingSeasonalTasks(season?)

// ── V2 Harvests ──
doCreateHarvest(id, input), fetchHarvests(filters?), fetchHarvestStats(year?), fetchCropTypes()

// ── V2 Diagnoses ──
doCreateDiagnosis(id, input), doUpdateDiagnosisStatus(id, status),
fetchActiveDiagnoses(plantId?), fetchDiagnosisHistory(plantId)

// ── V2 Wishlist ──
doCreateWishListItem(id, input), fetchWishList(includeAcquired?),
doMarkWishListAcquired(id, plantId?), doDeleteWishListItem(id)

// ── V2 Propagations ──
doCreatePropagation(id, input), doAdvancePropagationStage(id, stage),
doLinkPropagationChild(propId, childPlantId), fetchActivePropagations(),
fetchPropagationStats()

// ── V2 Light Readings ──
doCreateLightReading(id, input), fetchLightReadingsForZone(zoneId), fetchZoneAverageLux(zoneId)

// ── V2 Layouts ──
doCreateLayout(id, input), fetchLayouts(zoneId?), doDeleteLayout(id),
doCreateLayoutItem(id, input), fetchLayoutItems(layoutId), doDeleteLayoutItem(id)

// ── V2 Frost Config ──
fetchFrostConfig(), doSetFrostConfig(data)

// ── Engine wrappers (pure, can run client-side but exposed as actions for SSR) ──
lookupFrostZone(zone), calculateFrostCountdown(targetMmDd, today),
getCurrentFrostPhase(config), getPlantingCalendar(zone),
checkPlantCompatibility(plantA, plantB), getCompanionList(plantName), getAntagonistList(plantName),
searchCompanionPlant(query), getAllCompanionPlantNames(),
matchPlantSymptoms(symptoms), getAllSymptomNames(),
classifyLightLevel(lux), calculateSuccessRate(method),
getSeasonalTasks(category), getPlantCategories(), inferPlantCategory(species)
```

**Route structure (Next.js App Router):**

```
apps/web/app/garden/
  layout.tsx                # Module layout with glass nav header + tab links
  page.tsx                  # Garden dashboard (stats + watering urgency + plant grid)
  actions.ts                # Server actions wrapping all 75+ module exports
  [id]/page.tsx             # Plant detail (profile + journal + diagnoses + harvests)
  zones/page.tsx            # Zone manager (zone cards + plant counts + light levels)
  zones/[id]/page.tsx       # Zone detail (plants in zone + stats + light readings)
  journal/page.tsx          # Garden journal (chronological entries + date range filter)
  seeds/page.tsx            # Seed inventory (sortable table + expiry alerts)
  harvests/page.tsx         # Harvest log (data table + stats + crop breakdown)
  companions/page.tsx       # Companion planting guide (matrix + search + check)
  layout-planner/page.tsx   # Visual garden layout planner (grid canvas + items)
  frost/page.tsx            # Frost dates + planting calendar + USDA zone setup
  seasonal/page.tsx         # Seasonal care tasks (by season + by category)
  diagnoses/page.tsx        # Active diagnoses + history + symptom matcher
  wishlist/page.tsx         # Plant wish list (priority sorted + acquired filter)
  propagations/page.tsx     # Active propagations + stats + stage tracker
  __tests__/
    garden-page.test.tsx
    plant-detail.test.tsx
    zones-page.test.tsx
    harvests-page.test.tsx
    companions-page.test.tsx
    layout-planner.test.tsx
    frost-page.test.tsx
```

**Data flow (per books reference pattern):**
1. `layout.tsx` renders glass header with nav links + `{children}` slot
2. Each page is `'use client'` with `useEffect` calling server actions
3. Server actions call `db()` (which runs `getAdapter()` + `ensureModuleMigrations('garden')`)
4. Server actions call module CRUD/engine functions from `@mylife/garden`
5. Client state managed via local `useState` per page (no global state library)
6. All mutations go through server actions; client calls `refresh()` pattern (increment tick state to re-trigger `useMemo`/`useEffect`)
7. All server action calls wrapped in try/catch/finally to prevent stuck loading states

**Architecture decisions:**
- Layout planner uses CSS Grid for the garden bed canvas (widthCells x heightCells). Items positioned via `gridColumn`/`gridRow`. Drag-and-drop via native HTML5 drag API (no library needed for grid snapping).
- Companion planting matrix rendered as a CSS grid table with plant names on both axes. Cell colors: green (beneficial), red (antagonistic), gray (neutral). Data sourced from the bundled `COMPANION_DATA` array via engine functions.
- No charting library for V1. Harvest stats use CSS bar charts (width percentage fills). Frost countdown uses styled number displays. Add recharts later if needed.
- Watering schedule renders as a priority-sorted list with urgency color coding (same urgency sort from `getWateringSchedule`).
- Frost engine functions (`lookupZone`, `calculateCountdown`, `getCurrentFrostPhase`, `getPlantingCalendar`) are pure and can run client-side, but exposed as server actions for consistency with the books pattern.

**Missing CRUD gaps:** None. All required operations exist in `crud.ts` and `crud-v2.ts`. The module exports 75+ functions covering full CRUD for all 15 tables plus 6 engine modules. No new module code needed.

### Phase 3: Design Review

**Rating per dimension:**

| Dimension | Score | Notes |
|-----------|-------|-------|
| Layout & Composition | 9/10 | Two-column dashboard, spatial layout planner, multi-panel plant detail, data tables |
| Typography | 9/10 | Full Cool Obsidian type scale. heroTitle for dashboard, stat for numbers, subheading for cards |
| Color | 9/10 | Green accent #22C55E throughout. Status accents: red for overdue/dead, amber for needs_attention, teal for dormant |
| Spacing & Rhythm | 8/10 | Token-based spacing. Cards use xl radius. Sections separated by lg gap |
| States (5/5) | 9/10 | Loading (skeleton), Empty (warm CTA), Error (retry), Success, Partial -- all designed |
| Interaction | 9/10 | Drag-and-drop layout planner, hover tooltips on companion matrix, keyboard shortcuts, bulk watering |
| Responsive | 8/10 | Desktop-first. Below 768px collapses to single column, layout planner hidden |
| Accessibility | 7/10 | ARIA on layout grid, keyboard nav for plant list, color not sole indicator for status |

**Desktop-optimized layouts (not mobile-responsive -- desktop-native):**

1. **Dashboard page:** Two-column. Left (60%): urgency banner + watering schedule + plant grid. Right (40%): stats cards + seasonal tasks + quick actions.
2. **Plant detail:** Two-column. Left (55%): plant profile card + care journal timeline. Right (45%): watering info + diagnoses + harvests + propagations.
3. **Zones page:** Card grid (3 columns) of zones with plant count, light level badge, and overdue indicator.
4. **Zone detail:** Two-column. Left: plants in zone list. Right: zone stats + light readings chart.
5. **Harvests page:** Full-width data table with sort by date/plant/crop/quantity + stats summary row + crop breakdown cards.
6. **Companion planting:** Full-width NxN matrix grid + search bar + sidebar with selected pair detail.
7. **Layout planner:** Full-width canvas (80% viewport height) with toolbar above and plant palette sidebar.
8. **Frost dates:** Centered planting calendar timeline + zone config card + countdown cards row.
9. **Seeds page:** Sortable data table with expiry highlighting + summary cards.
10. **Diagnoses page:** Two-column. Left: active diagnoses cards. Right: symptom matcher + history.

**All 5 states per page:**

| State | Pattern |
|-------|---------|
| Loading | Skeleton pulse: glass cards with animated shimmer matching layout shape. Plant grid shows 6 placeholder cards. Data tables show row outlines |
| Empty | Module icon (🌱) + warm heading + green CTA button. "Your garden awaits -- add your first plant to get growing" |
| Error | Glass card with error icon + message + "Retry" ghost button. try/catch/finally wrapper on all server actions |
| Success | Green flash on water action. Plant card briefly highlights on update. Harvest row appears with slide-in animation |
| Partial | Mixed states: some plants watered, others overdue. Stats show partial data with "N plants tracked" qualifier |

### Phase 4: Design Consultation

**Module-specific design system:**
- **Accent:** `#22C55E` (green) -- used for all primary CTAs, active states, healthy status, watering buttons, layout planner grid highlights
- **Secondary accents:** `#FF453A` (iOS red) for overdue/dead plants; `#F59E0B` (amber) for needs_attention status; `#3B82F6` (blue) for water-related actions; `#14B8A6` (teal) for dormant status; `#8B5CF6` (purple) for propagation stages
- **Companion planting colors:** `rgba(34,197,94,0.25)` (green tint) for beneficial pairs; `rgba(255,69,58,0.25)` (red tint) for antagonistic pairs; `rgba(255,255,255,0.04)` (neutral glass) for unknown/neutral
- **Information density:** HIGH on desktop. Show more data per screen than mobile. Leverage 1120px max-width container for data tables and multi-column layouts.
- **Glass cards:** All content containers use `rgba(255,255,255,0.04)` background + `rgba(255,255,255,0.06)` border + `backdrop-filter: blur(40px) saturate(180%)`
- **Layout planner grid:** 12px cell default, 2px gap, cells filled with plant accent colors at 20% opacity. Hover shows plant name tooltip. Selected cell has green border. Companion conflict cells pulse with red border.
- **Typography:** `heroTitle` (36/800) for dashboard greeting. `stat` (36/700) for big numbers (plant count, harvest total, days until frost). `subheading` (18/600) for card titles. `body` (16/400) for descriptions. `caption` (13/500) for metadata. `label` (12/600 uppercase) for status badges.
- **Component reuse from `@mylife/ui`:** colors, spacing, borderRadius tokens. From books pattern: layout header, glass card, pill buttons, filter chips, grid/list toggle, stat metric cards.
- **Plant status badges:** Colored pills -- healthy (green), needs_attention (amber), dormant (teal), dead (red with strikethrough).
- **Iconography:** Botanical feel. Leaf-based status indicators. Water droplet for watering actions. Sprout for propagations. Snowflake for frost. Magnifying glass for diagnosis. Seed packet for seed inventory.

---

## Page-by-Page Wireframes

### 1. Layout (`layout.tsx`)

Glass morphism header with module branding and nav links.

```
+------------------------------------------------------------------+
| [#22C55E] MyGarden                                                |
| Plant care and garden planner inside MyLife.                      |
|                                                                   |
| Garden  Zones  Journal  Seeds  Harvests  Companions  More v      |
+------------------------------------------------------------------+
| {children}                                                        |
+------------------------------------------------------------------+
```

- Glass background: `rgba(18,18,26,0.78)` + `backdrop-filter: blur(14px)`
- Bottom border: `rgba(255,255,255,0.06)`
- Max width: 1120px centered
- "More" dropdown: Layout Planner, Frost Dates, Seasonal Care, Diagnoses, Wishlist, Propagations
- Nav links: `textSecondary` color, 14px/600

### 2. Garden Dashboard (`page.tsx`)

The flagship screen. Two-column desktop layout.

```
+------------------------------------------------------------------+
|                                                                    |
|  [Left Column - 60%]              [Right Column - 40%]            |
|                                                                    |
|  +---------------------------+    +---------------------------+    |
|  | URGENCY BANNER (if any)   |    | Garden Stats              |   |
|  | 3 plants need water       |    | 12 plants  |  3 overdue   |   |
|  | [Water All Overdue]       |    | 10 healthy |  847g harvest |   |
|  +---------------------------+    +---------------------------+    |
|                                                                    |
|  +---------------------------+    +---------------------------+    |
|  | Watering Schedule         |    | Seasonal Tasks            |   |
|  |                           |    | (current season)          |   |
|  | [overdue] Monstera  3d!   |    | [ ] Increase watering     |   |
|  | [overdue] Fern      1d!   |    | [ ] Start fertilizing     |   |
|  | [today]   Pothos    today |    | [ ] Repot root-bound      |   |
|  | [ok]      Snake     in 4d |    |                           |   |
|  |                           |    | [Browse Seasonal Guide]   |   |
|  +---------------------------+    +---------------------------+    |
|                                                                    |
|  Segment: [All] [Needs Water] [By Zone]                           |
|                                                                    |
|  +---------------------------+    +---------------------------+    |
|  | 🌿 Monstera deliciosa    |    | 🌿 Fern                   |   |
|  | Living Room | 3d overdue  |    | Bedroom | 1d overdue      |   |
|  | [Water]                   |    | [Water]                   |   |
|  +---------------------------+    +---------------------------+    |
|  | 🌿 Pothos                |    | 🌿 Snake Plant            |   |
|  | Kitchen | Due today       |    | Office | Next: Mar 27     |   |
|  | [Water]                   |    | [Water]                   |   |
|  +---------------------------+    +---------------------------+    |
|                                                                    |
|  + Add Plant                                                      |
+------------------------------------------------------------------+
```

**Data sources:**
- `fetchGardenStats()` -> stats cards (totalPlants, healthyCount, overdueWateringCount, totalHarvestGrams)
- `fetchWateringSchedule()` -> urgency-sorted watering list
- `fetchPlants(filter)` -> plant grid with segment filtering
- `fetchPendingSeasonalTasks(currentSeason)` -> seasonal task list
- `fetchZones()` -> for "By Zone" segment grouping

**Interactions:**
- Click [Water] button -> `doWaterPlant(id)` -> refresh
- Click [Water All Overdue] -> loop `doWaterPlant()` for all overdue -> refresh
- Click plant card -> navigate to `/garden/[id]`
- Click segment pill -> filter plant grid (All / Needs Water / By Zone)
- Click "+ Add Plant" -> inline modal or form expansion
- Click seasonal task checkbox -> `doCompleteSeasonalTask(id)` -> refresh
- Search input appears when 10+ plants (fuzzy filter by name/species)

**Keyboard shortcuts:**
- `N` -> open add plant form
- `W` -> water selected/hovered plant
- `J` -> navigate to journal
- `/` -> focus search input

### 3. Plant Detail (`[id]/page.tsx`)

Two-column layout with comprehensive plant profile.

```
+------------------------------------------------------------------+
|                                                                    |
|  [Left Column - 55%]              [Right Column - 45%]            |
|                                                                    |
|  +---------------------------+    +---------------------------+    |
|  | 🌿 Monstera deliciosa    |    | Watering                  |   |
|  | Zone: Living Room         |    | Every 7 days              |   |
|  | Location: indoor          |    | Last: Mar 20 (3d ago)     |   |
|  | Status: [healthy]         |    | Next: Mar 27              |   |
|  | Acquired: Jan 15, 2026    |    | [Water Now]               |   |
|  | Notes: Bright indirect... |    +---------------------------+    |
|  |                           |                                    |
|  | [Edit] [Delete]           |    +---------------------------+    |
|  +---------------------------+    | Active Diagnoses          |   |
|                                   | Yellow leaves - moderate   |   |
|  +---------------------------+    | Status: in_treatment      |   |
|  | Care Journal              |    | [View] [Resolve]          |   |
|  |                           |    +---------------------------+    |
|  | Mar 23 - watered          |                                    |
|  | Mar 20 - watered          |    +---------------------------+    |
|  | Mar 15 - fertilized       |    | Harvests                  |   |
|  |   Notes: Spring feeding   |    | Total: 450g this year     |   |
|  | Mar 10 - watered          |    | Last: Mar 18 - 120g       |   |
|  | Mar 5  - pruned           |    | [Log Harvest]             |   |
|  |                           |    +---------------------------+    |
|  | [+ Log Entry]             |                                    |
|  +---------------------------+    +---------------------------+    |
|                                   | Propagations              |   |
|  +---------------------------+    | Stem cutting - rooting    |   |
|  | Identifications           |    | Started: Mar 1            |   |
|  | Mar 1 - Monstera (92%)   |    | [Advance Stage]           |   |
|  +---------------------------+    +---------------------------+    |
+------------------------------------------------------------------+
```

**Data sources:**
- `fetchPlantById(id)` -> plant profile
- `fetchEntriesForPlant(id, 20)` -> recent journal entries
- `fetchWateringSchedule()` -> find this plant's watering info
- `fetchActiveDiagnoses(id)` -> active diagnoses for this plant
- `fetchHarvests({ plantId: id })` -> harvest history
- `fetchIdentificationsForPlant(id)` -> ID history

**Interactions:**
- [Water Now] -> `doWaterPlant(id)` -> refresh
- [Edit] -> inline edit form (name, species, location, zone, frequency, status, notes)
- [Delete] -> confirm dialog -> `doDeletePlant(id)` -> navigate back to `/garden`
- [+ Log Entry] -> inline form (action selector, notes, optional quantity for harvest)
- [Log Harvest] -> quick harvest form (quantity, unit, crop type)
- [Resolve] diagnosis -> `doUpdateDiagnosisStatus(id, 'resolved')`
- [Advance Stage] propagation -> `doAdvancePropagationStage(id, nextStage)`
- Click journal entry -> expand to show full notes

### 4. Zones Manager (`zones/page.tsx`)

Card grid of garden zones with summary metrics.

```
+------------------------------------------------------------------+
|  Zones                                         [+ New Zone]       |
|                                                                   |
|  +------------------+ +------------------+ +------------------+   |
|  | Living Room      | | Kitchen          | | Balcony          |   |
|  | indoor / room    | | indoor / room    | | outdoor / balcony|   |
|  | 5 plants         | | 3 plants         | | 4 plants         |   |
|  | 1 overdue        | | 0 overdue        | | 2 overdue        |   |
|  | Light: bright    | | Light: moderate   | | Light: full sun  |   |
|  | Avg: 850 lux     | | Avg: 420 lux     | | Avg: 2400 lux    |   |
|  +------------------+ +------------------+ +------------------+   |
|  | Bedroom          | | Greenhouse       | | Unassigned        |   |
|  | indoor / room    | | greenhouse       | | 2 plants          |   |
|  | 2 plants         | | 6 plants         | |                   |   |
|  | 0 overdue        | | 0 overdue        | |                   |   |
|  +------------------+ +------------------+ +------------------+   |
+------------------------------------------------------------------+
```

**Data sources:**
- `fetchZones()` -> zone list
- `fetchZoneStats(zoneId)` per zone -> plant count, overdue count
- `fetchZoneAverageLux(zoneId)` per zone -> average lux reading

**Interactions:**
- Click zone card -> navigate to `/garden/zones/[id]`
- [+ New Zone] -> inline form (name, location, zone_type, description)
- Zone cards show overdue badge in red if overdueCount > 0

### 5. Zone Detail (`zones/[id]/page.tsx`)

Two-column layout showing zone details and its plants.

```
+------------------------------------------------------------------+
|  <- Back to Zones                                                 |
|                                                                    |
|  [Left Column - 60%]              [Right Column - 40%]            |
|                                                                    |
|  +---------------------------+    +---------------------------+    |
|  | Living Room               |    | Zone Stats                |   |
|  | indoor / room             |    | 5 plants | 4 healthy      |   |
|  | Bright indirect light     |    | 1 overdue | 0 needs attn  |   |
|  | [Edit Zone] [Delete Zone] |    +---------------------------+    |
|  +---------------------------+                                    |
|                                   +---------------------------+    |
|  Plants in this zone:             | Light Readings            |   |
|  +---------------------------+    | Avg: 850 lux (bright)     |   |
|  | Monstera | healthy | 3d!  |    | Mar 23: 920 lux           |   |
|  | Pothos   | healthy | today|    | Mar 20: 780 lux           |   |
|  | Fern     | needs_attn     |    | Mar 15: 850 lux           |   |
|  | ZZ Plant | healthy | 5d   |    |                           |   |
|  | Orchid   | healthy | 2d   |    | [+ Log Reading]           |   |
|  +---------------------------+    +---------------------------+    |
+------------------------------------------------------------------+
```

**Data sources:**
- Zone: `fetchZones()` filtered by id (or add `fetchZoneById` action)
- `fetchZoneStats(zoneId)` -> stats
- `fetchPlants({ zone: zoneName })` -> plants in zone (note: plants reference zone by name string)
- `fetchLightReadingsForZone(zoneId)` -> light history
- `fetchZoneAverageLux(zoneId)` -> average lux

### 6. Garden Journal (`journal/page.tsx`)

Chronological journal entries with date range filtering.

```
+------------------------------------------------------------------+
|  Journal                                      [+ New Entry]       |
|                                                                   |
|  Date Range: [Mar 1] to [Mar 23]   Action: [All v]               |
|                                                                   |
|  --- March 23, 2026 ---                                           |
|  +------------------------------------------------------------+   |
|  | watered  Monstera              3:42 PM                      |   |
|  | watered  Pothos                3:40 PM                      |   |
|  +------------------------------------------------------------+   |
|                                                                   |
|  --- March 20, 2026 ---                                           |
|  +------------------------------------------------------------+   |
|  | watered  Monstera              10:15 AM                     |   |
|  | fertilized  Fern               10:20 AM                     |   |
|  |   Notes: Spring feeding with diluted 20-20-20               |   |
|  +------------------------------------------------------------+   |
|                                                                   |
|  --- March 15, 2026 ---                                           |
|  +------------------------------------------------------------+   |
|  | pruned   Pothos                2:30 PM                      |   |
|  |   Notes: Removed 3 yellow leaves                            |   |
|  | pest_treatment  Fern           2:45 PM                      |   |
|  |   Notes: Neem oil spray for fungus gnats                    |   |
|  +------------------------------------------------------------+   |
+------------------------------------------------------------------+
```

**Data sources:**
- `fetchEntriesByDate(startDate, endDate)` -> entries grouped by date
- Action filter: client-side filter on the `action` field

**Interactions:**
- [+ New Entry] -> form: select plant, action type, notes, optional quantity
- Date range inputs filter the query
- Action dropdown filters: All, Water, Fertilize, Prune, Repot, Harvest, Pest Treatment, Photo, Note
- Click plant name -> navigate to plant detail

### 7. Seed Inventory (`seeds/page.tsx`)

Sortable data table with summary cards.

```
+------------------------------------------------------------------+
|  Seed Inventory                                [+ Add Seed]       |
|                                                                   |
|  +--------+ +--------+ +--------+                                 |
|  | Total  | | Low    | | Expiring|                                |
|  | Seeds  | | Stock  | | Soon   |                                 |
|  | 24     | | 3      | | 2      |                                 |
|  +--------+ +--------+ +--------+                                 |
|                                                                   |
|  +------------------------------------------------------------+   |
|  | Name          | Species      | Qty | Source   | Expires    |   |
|  |------------------------------------------------------------+   |
|  | Tomato Roma   | S. lyco...   | 45  | Burpee   | Dec 2026   |   |
|  | Basil Sweet   | O. basil...  | 12  | Local    | Jun 2026 ! |   |
|  | Lettuce Mix   | L. sativa    |  3  | Baker Ck | Sep 2026   |   |
|  | Pepper Hab.   | C. chin...   | 28  | Seed Sav | Mar 2027   |   |
|  | Zinnia Mix    | Z. elegans   |  0  | --       | --         |   |
|  +------------------------------------------------------------+   |
|                                                                   |
|  Sort: [Name v]  Filter: [All v]                                  |
+------------------------------------------------------------------+
```

**Data sources:**
- `fetchSeeds()` -> seed list
- Summary cards computed client-side: total count, low stock (qty < 5), expiring within 3 months

**Interactions:**
- [+ Add Seed] -> inline form (name, species, quantity, source, expiry date)
- Click quantity -> inline edit (number input)
- Sort by: Name, Quantity, Expiry Date
- Expiry warning: amber text for seeds expiring within 3 months, red for expired
- Click delete icon -> confirm -> `doDeleteSeed(id)`

### 8. Harvest Log (`harvests/page.tsx`)

Data table with stats summary and crop breakdown.

```
+------------------------------------------------------------------+
|  Harvests                                    [+ Log Harvest]      |
|                                                                   |
|  Year: [2026 v]                                                   |
|                                                                   |
|  +--------+ +--------+ +--------+                                 |
|  | Total  | | Harvests| | Top    |                                |
|  | 2.4 kg | | 18     | | Tomato |                                |
|  |        | |         | | 1.2 kg |                                |
|  +--------+ +--------+ +--------+                                 |
|                                                                   |
|  +------------------------------------------------------------+   |
|  | Date       | Plant        | Crop     | Qty   | Unit | Qual |   |
|  |------------------------------------------------------------+   |
|  | Mar 23     | Tomato Roma  | tomato   | 340g  | grams| 4/5  |   |
|  | Mar 20     | Basil        | herb     | 45g   | grams| 5/5  |   |
|  | Mar 18     | Monstera     | --       | 120g  | grams| --   |   |
|  | Mar 15     | Pepper       | pepper   | 280g  | grams| 3/5  |   |
|  +------------------------------------------------------------+   |
|                                                                   |
|  Crop Breakdown:                                                  |
|  tomato [==============] 1,200g                                   |
|  pepper [========]        680g                                    |
|  herb   [====]            340g                                    |
|  other  [==]              180g                                    |
+------------------------------------------------------------------+
```

**Data sources:**
- `fetchHarvestStats(year)` -> summary cards
- `fetchHarvests({ startDate, endDate })` -> table data
- `fetchCropTypes()` -> crop breakdown labels
- Crop breakdown bars computed client-side by grouping harvests

**Interactions:**
- [+ Log Harvest] -> form: select plant, quantity, unit, crop type, quality rating, notes
- Year selector -> re-fetches stats and harvest list
- Sort by date, plant, crop type, quantity
- Filter by crop type, plant

### 9. Companion Planting Guide (`companions/page.tsx`)

Full-width compatibility matrix + search.

```
+------------------------------------------------------------------+
|  Companion Planting Guide                                         |
|                                                                   |
|  Check two plants: [Tomato    ] + [Basil     ] [Check]            |
|                                                                   |
|  +------------------------------------------------------------+   |
|  | Result: BENEFICIAL                                          |   |
|  | Basil repels aphids and improves tomato flavor.             |   |
|  | Category: pest_control                                      |   |
|  +------------------------------------------------------------+   |
|                                                                   |
|  Browse Companions:                                               |
|  Search: [                    ]                                   |
|                                                                   |
|  +------------------------------------------------------------+   |
|  | Tomato                                                      |   |
|  | Companions: Basil, Carrot, Parsley, Marigold, Borage       |   |
|  | Antagonists: Fennel, Brassicas, Corn                        |   |
|  +------------------------------------------------------------+   |
|  | Basil                                                       |   |
|  | Companions: Tomato, Pepper, Oregano, Chamomile              |   |
|  | Antagonists: Sage, Rue                                      |   |
|  +------------------------------------------------------------+   |
|                                                                   |
|  Full Compatibility Matrix (hover for details):                   |
|  +------+------+------+------+------+------+                     |
|  |      | Tom  | Bas  | Car  | Pep  | Fen  |                     |
|  | Tom  |  --  | [G]  | [G]  | [G]  | [R]  |                     |
|  | Bas  | [G]  |  --  | [N]  | [G]  | [N]  |                     |
|  | Car  | [G]  | [N]  |  --  | [G]  | [N]  |                     |
|  | Pep  | [G]  | [G]  | [G]  |  --  | [N]  |                     |
|  | Fen  | [R]  | [N]  | [N]  | [N]  |  --  |                     |
|  +------+------+------+------+------+------+                     |
|  [G]=beneficial  [R]=antagonistic  [N]=neutral                    |
+------------------------------------------------------------------+
```

**Data sources:**
- `checkPlantCompatibility(plantA, plantB)` -> pair check result
- `getCompanionList(plantName)` -> all companions for a plant
- `getAntagonistList(plantName)` -> all antagonists for a plant
- `searchCompanionPlant(query)` -> fuzzy search through companion database
- `getAllCompanionPlantNames()` -> full plant list for matrix

**Interactions:**
- Type plant names in two inputs -> [Check] -> shows compatibility result
- Search input -> filters browse list to matching plants
- Hover matrix cell -> tooltip with relationship detail and benefit text
- Matrix cells colored: green = beneficial, red = antagonistic, gray = neutral

### 10. Layout Planner (`layout-planner/page.tsx`)

Visual grid canvas for garden bed planning.

```
+------------------------------------------------------------------+
|  Layout Planner                              [+ New Layout]       |
|                                                                   |
|  Layout: [Spring 2026 - Raised Bed v]    Zone: [Balcony v]       |
|  Grid: 8x8 cells, 12" per cell                                   |
|                                                                   |
|  +------------------------------------------+ +---------------+   |
|  |  +--+--+--+--+--+--+--+--+              | | Plant Palette  |   |
|  |  |To|To|  |Ba|Ba|  |  |  |              | |                |   |
|  |  +--+--+--+--+--+--+--+--+              | | [Tomato]       |   |
|  |  |To|To|  |  |  |Pe|Pe|  |              | | [Basil]        |   |
|  |  +--+--+--+--+--+--+--+--+              | | [Pepper]       |   |
|  |  |  |  |Ca|Ca|  |Pe|Pe|  |              | | [Carrot]       |   |
|  |  +--+--+--+--+--+--+--+--+              | | [Lettuce]      |   |
|  |  |  |  |Ca|Ca|  |  |  |  |              | | [Marigold]     |   |
|  |  +--+--+--+--+--+--+--+--+              | | [path]         |   |
|  |  |Le|Le|Le|  |  |  |  |  |              | | [raised bed]   |   |
|  |  +--+--+--+--+--+--+--+--+              | |                |   |
|  |  |  |Ma|  |  |  |  |  |  |              | | Drag onto grid |   |
|  |  +--+--+--+--+--+--+--+--+              | +---------------+   |
|  |  |  |Ma|  |  |  |  |  |  |              |                     |
|  |  +--+--+--+--+--+--+--+--+              | +---------------+   |
|  +------------------------------------------+ | Companion      |   |
|                                                | Warnings       |   |
|  Legend: To=Tomato Ba=Basil Pe=Pepper          | Fennel near    |   |
|          Ca=Carrot Le=Lettuce Ma=Marigold      | Tomato: BAD    |   |
|                                                +---------------+   |
+------------------------------------------------------------------+
```

**Data sources:**
- `fetchLayouts(zoneId?)` -> layout list for selector
- `fetchLayoutItems(layoutId)` -> items positioned on grid
- `fetchPlants()` -> plant palette (existing plants)
- Companion checks via `checkPlantCompatibility()` run on placement

**Interactions:**
- Drag plant from palette onto grid cell -> `doCreateLayoutItem()`
- Drag existing item to new position -> delete old + create new (or update x/y)
- Click item -> select (shows delete option)
- Delete key / click X -> `doDeleteLayoutItem(id)`
- On place: check compatibility with adjacent items -> show warning if antagonistic
- [+ New Layout] -> form: name, zone, grid dimensions, cell size, season, year
- Layout dropdown -> switch between saved layouts
- Right panel shows real-time companion warnings for current layout

### 11. Frost Dates & Planting Calendar (`frost/page.tsx`)

Zone configuration and seasonal timeline.

```
+------------------------------------------------------------------+
|  Frost Dates & Planting Calendar                                  |
|                                                                   |
|  +------------------------------------------------------------+   |
|  | Your Zone                                                   |   |
|  | USDA Zone: [8a v]    ZIP: [94110  ]    [Save]               |   |
|  |                                                             |   |
|  | Last Frost: Mar 15   First Frost: Nov 10                    |   |
|  | Growing Season: 240 days                                    |   |
|  +------------------------------------------------------------+   |
|                                                                   |
|  +--------+ +--------+ +--------+                                 |
|  | Last   | | First  | | Current|                                 |
|  | Frost  | | Frost  | | Phase  |                                 |
|  | 8 days | | 232    | | Growing|                                 |
|  | ago    | | days   | | Season |                                 |
|  +--------+ +--------+ +--------+                                 |
|                                                                   |
|  Planting Calendar:                                               |
|  +------------------------------------------------------------+   |
|  | Crop     | Start Indoors | Transplant | Direct Sow | Harvest|  |
|  |------------------------------------------------------------+   |
|  | Tomato   | Feb 15        | Apr 1      | --         | Jul 1  |   |
|  | Pepper   | Feb 1         | Apr 15     | --         | Jul 15 |   |
|  | Lettuce  | --            | --         | Mar 1      | Apr 15 |   |
|  | Basil    | Mar 1         | Apr 15     | May 1      | Jun 15 |   |
|  +------------------------------------------------------------+   |
+------------------------------------------------------------------+
```

**Data sources:**
- `fetchFrostConfig()` -> saved zone/frost config
- `lookupFrostZone(usdaZone)` -> lookup avg frost dates for selected zone
- `calculateFrostCountdown(targetDate, today)` -> countdown to next frost event
- `getCurrentFrostPhase(config)` -> current phase (pre-season, growing, late-season, frost-risk)
- `getPlantingCalendar(usdaZone)` -> planting schedule for the zone

**Interactions:**
- Select USDA zone from dropdown -> live update frost dates and planting calendar
- Enter ZIP -> if zone mapping exists, auto-select zone
- [Save] -> `doSetFrostConfig(data)` -> persists zone preference
- Countdown cards update relative to today

### 12. Seasonal Care (`seasonal/page.tsx`)

Seasonal task browser and tracker.

```
+------------------------------------------------------------------+
|  Seasonal Care                                                    |
|                                                                   |
|  Season: [Spring v]    Category: [All v]                          |
|                                                                   |
|  Pending Tasks (3):                                               |
|  +------------------------------------------------------------+   |
|  | Increase watering (tropical)                                |   |
|  | Increase watering as growth resumes                         |   |
|  | Due: March                              [Complete] [Snooze] |   |
|  +------------------------------------------------------------+   |
|  | Start fertilizing (tropical)                                |   |
|  | Begin monthly fertilizing                                   |   |
|  | Due: April                              [Complete] [Snooze] |   |
|  +------------------------------------------------------------+   |
|  | Repot root-bound plants (tropical)                          |   |
|  | Repot into larger containers                                |   |
|  | Due: April                              [Complete] [Snooze] |   |
|  +------------------------------------------------------------+   |
|                                                                   |
|  Browse by Category:                                              |
|  +------------------+ +------------------+ +------------------+   |
|  | Tropical         | | Succulent        | | Herb             |   |
|  | 9 seasonal tasks | | 6 seasonal tasks | | 7 seasonal tasks |   |
|  +------------------+ +------------------+ +------------------+   |
+------------------------------------------------------------------+
```

**Data sources:**
- `fetchPendingSeasonalTasks(season)` -> pending tasks
- `getSeasonalTasks(category)` -> tasks for a category
- `getPlantCategories()` -> category list for browse cards
- Engine: `getSeason(currentMonth)` -> auto-select current season

**Interactions:**
- [Complete] -> `doCompleteSeasonalTask(id)` -> refresh
- [Snooze] -> `doSnoozeSeasonalTask(id, oneWeekFromNow)` -> refresh
- Season dropdown -> re-fetch pending tasks for that season
- Category dropdown -> filter pending tasks
- Click category card -> filter to that category's tasks
- [+ Add Task] -> form to create custom seasonal task

### 13. Diagnoses (`diagnoses/page.tsx`)

Active diagnoses and symptom matcher.

```
+------------------------------------------------------------------+
|  Plant Health                                                     |
|                                                                   |
|  [Left Column - 55%]              [Right Column - 45%]            |
|                                                                    |
|  Active Diagnoses (2):             Symptom Matcher                 |
|  +---------------------------+    +---------------------------+    |
|  | Monstera - Yellow Leaves  |    | Describe symptoms:        |   |
|  | Type: nutrient            |    | [ ] Yellow leaves          |   |
|  | Severity: moderate        |    | [ ] Brown tips             |   |
|  | Status: in_treatment      |    | [ ] Wilting                |   |
|  | Treatment: Iron suppl...  |    | [ ] Spots                  |   |
|  | [Resolve] [Mark Worse]    |    | [ ] Drooping               |   |
|  +---------------------------+    | [ ] Root rot               |   |
|  | Fern - Brown Tips         |    | [ ] Pests visible          |   |
|  | Type: environmental       |    | [ ] Stunted growth         |   |
|  | Severity: mild            |    |                           |   |
|  | Status: pending           |    | [Match Symptoms]          |   |
|  | [Start Treatment] [Res.]  |    |                           |   |
|  +---------------------------+    | Results:                  |   |
|                                   | Overwatering (85%)        |   |
|  Diagnosis History:                | Nutrient deficiency (72%) |   |
|  +---------------------------+    +---------------------------+    |
|  | Resolved: 5 | Failed: 1  |                                    |
|  +---------------------------+                                    |
+------------------------------------------------------------------+
```

**Data sources:**
- `fetchActiveDiagnoses()` -> active diagnosis cards
- `matchPlantSymptoms(selectedSymptoms)` -> symptom matcher results
- `getAllSymptomNames()` -> symptom checkbox list
- `fetchDiagnosisHistory(plantId)` -> resolved/failed history

**Interactions:**
- [Resolve] -> `doUpdateDiagnosisStatus(id, 'resolved')`
- [Start Treatment] -> `doUpdateDiagnosisStatus(id, 'in_treatment')`
- Check symptoms -> [Match Symptoms] -> shows ranked diagnoses
- [+ New Diagnosis] -> form: select plant, type, symptoms, severity, treatment notes

### 14. Wish List (`wishlist/page.tsx`)

Priority-sorted wish list with acquisition tracking.

```
+------------------------------------------------------------------+
|  Wish List                                   [+ Add to List]      |
|                                                                   |
|  Filter: [Active v]  Show acquired: [ ]                          |
|                                                                   |
|  HIGH PRIORITY:                                                   |
|  +------------------------------------------------------------+   |
|  | Fiddle Leaf Fig - Ficus lyrata                              |   |
|  | Source: Local nursery  |  Est: $45  |  Added: Mar 10        |   |
|  | Notes: Large specimen, at least 4ft                          |   |
|  | [Mark Acquired]  [Delete]                                   |   |
|  +------------------------------------------------------------+   |
|                                                                   |
|  MEDIUM PRIORITY:                                                 |
|  +------------------------------------------------------------+   |
|  | String of Pearls - Senecio rowleyanus                       |   |
|  | Source: Etsy  |  Est: $18  |  Added: Feb 28                 |   |
|  | [Mark Acquired]  [Delete]                                   |   |
|  +------------------------------------------------------------+   |
+------------------------------------------------------------------+
```

**Data sources:**
- `fetchWishList(includeAcquired)` -> priority-sorted list
- Filter by acquired status is client-side toggle

**Interactions:**
- [Mark Acquired] -> `doMarkWishListAcquired(id, optionalPlantId)` with option to link to new/existing plant
- [Delete] -> confirm -> `doDeleteWishListItem(id)`
- [+ Add to List] -> form: name, species, source, estimated price, priority, notes

### 15. Propagations (`propagations/page.tsx`)

Active propagation tracker with stats.

```
+------------------------------------------------------------------+
|  Propagations                              [+ Start Propagation]  |
|                                                                   |
|  +--------+ +--------+ +--------+ +--------+                     |
|  | Active | | Success| | Failed | | Rate   |                     |
|  | 3      | | 8      | | 2      | | 80.0%  |                     |
|  +--------+ +--------+ +--------+ +--------+                     |
|                                                                   |
|  Active Propagations:                                             |
|  +------------------------------------------------------------+   |
|  | Monstera Stem Cutting                                       |   |
|  | Method: stem_cutting  |  Medium: water                      |   |
|  | Stage: rooting  |  Started: Mar 1 (22 days)                 |   |
|  | [Advance: root_growth] [Mark Failed]                        |   |
|  +------------------------------------------------------------+   |
|  | Pothos Division                                             |   |
|  | Method: division  |  Medium: soil                           |   |
|  | Stage: root_growth  |  Started: Feb 20 (31 days)            |   |
|  | [Advance: potted] [Mark Failed]                             |   |
|  +------------------------------------------------------------+   |
|  | Snake Plant Leaf                                            |   |
|  | Method: leaf_cutting  |  Medium: soil                       |   |
|  | Stage: started  |  Started: Mar 15 (8 days)                 |   |
|  | [Advance: rooting] [Mark Failed]                            |   |
|  +------------------------------------------------------------+   |
+------------------------------------------------------------------+
```

**Data sources:**
- `fetchActivePropagations()` -> active propagation list
- `fetchPropagationStats()` -> summary cards (total, success, failed, rate)
- Engine: `getNextStages(currentStage)` -> valid next stages for advance button
- Engine: `calculateSuccessRate(method)` -> method-specific success rate

**Interactions:**
- [Advance: nextStage] -> `doAdvancePropagationStage(id, nextStage)` -> refresh
- When advancing to 'potted' -> prompt to link to existing or new plant -> `doLinkPropagationChild()`
- [Mark Failed] -> `doAdvancePropagationStage(id, 'failed')`
- [+ Start Propagation] -> form: parent plant, method, medium, notes

---

## Component Inventory

### New Components (web-specific)

| Component | Location | Purpose |
|-----------|----------|---------|
| `GardenLayout` | `layout.tsx` | Glass header + nav links + children slot |
| `StatsRow` | Shared inline | 3-4 metric cards in a row (glass cards with stat numbers) |
| `PlantCard` | `page.tsx` | Plant card with name, species, zone, status badge, water button |
| `WateringRow` | `page.tsx` | Urgency-sorted watering task row with overdue highlighting |
| `PlantStatusBadge` | Shared inline | Colored pill: healthy/needs_attention/dormant/dead |
| `ZoneCard` | `zones/page.tsx` | Zone summary card with plant count and light level |
| `JournalEntry` | `journal/page.tsx` | Timestamped care log entry with action icon and notes |
| `SeedRow` | `seeds/page.tsx` | Table row with inline quantity editing and expiry highlighting |
| `HarvestRow` | `harvests/page.tsx` | Table row with date, plant, crop, quantity, quality |
| `CropBar` | `harvests/page.tsx` | CSS width-based bar for crop breakdown visualization |
| `CompanionCheck` | `companions/page.tsx` | Two-input compatibility checker with result card |
| `CompanionMatrix` | `companions/page.tsx` | NxN grid with color-coded cells and hover tooltips |
| `LayoutCanvas` | `layout-planner/page.tsx` | CSS Grid canvas with drag-and-drop item placement |
| `LayoutPalette` | `layout-planner/page.tsx` | Draggable plant/item sidebar for the layout planner |
| `FrostCountdown` | `frost/page.tsx` | Countdown cards for last/first frost dates |
| `PlantingCalendar` | `frost/page.tsx` | Table showing planting windows per crop |
| `SeasonalTaskCard` | `seasonal/page.tsx` | Task card with complete/snooze actions |
| `DiagnosisCard` | `diagnoses/page.tsx` | Active diagnosis with status actions |
| `SymptomMatcher` | `diagnoses/page.tsx` | Checkbox symptom selector with match results |
| `WishListCard` | `wishlist/page.tsx` | Priority-grouped wish list item with acquire/delete |
| `PropagationCard` | `propagations/page.tsx` | Active propagation with stage advance button |

### Reused from Books Pattern

| Pattern | Usage |
|---------|-------|
| Glass header layout | `layout.tsx` structure matches books `layout.tsx` |
| Server action wrapper | `db()` function with `getAdapter()` + `ensureModuleMigrations('garden')` |
| `'use client'` + `useEffect` + `useState` | All pages follow this data fetch pattern |
| `refresh()` via tick state | Mutation -> increment tick -> re-fetch via useMemo/useEffect |
| Pill buttons with accent color | Active segment/filter indicators |
| Grid/list toggle | Plant view options |
| Empty state pattern | Module icon + warm heading + accent CTA |
| Glass card styling | `rgba(255,255,255,0.04)` bg + `rgba(255,255,255,0.06)` border |
| Color constants at top of page | `ACCENT`, `TEXT`, `TEXT_SEC`, `SURFACE`, `BORDER`, `GLASS` |

---

## Data Flow

```
User Action
    |
    v
Client Component (useState, useEffect)
    |
    v
Server Action (actions.ts)
    |
    v
db() -> getAdapter() + ensureModuleMigrations('garden')
    |
    v
@mylife/garden CRUD/Engine function
    |
    v
SQLite (gd_* tables)
    |
    v
Return typed result -> Client re-renders
```

### Error Handling Pattern (Critical)

Every page must wrap server action calls in try/catch/finally:

```typescript
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  let cancelled = false;
  setLoading(true);
  setError(null);
  fetchPlants()
    .then((result) => { if (!cancelled) setPlants(result); })
    .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load'); })
    .finally(() => { if (!cancelled) setLoading(false); });
  return () => { cancelled = true; };
}, [tick]);
```

This prevents the "stuck loading" bug found in the QA audit (see `qa-design-review-2026-03-23.md` memory).

---

## Test Plan

### Unit Tests (`__tests__/`)

| Test File | Covers | Assertions |
|-----------|--------|------------|
| `garden-page.test.tsx` | Dashboard page | Renders stats, watering schedule, plant grid, empty state, urgency banner |
| `plant-detail.test.tsx` | Plant detail page | Renders plant profile, journal entries, watering info, edit/delete actions |
| `zones-page.test.tsx` | Zones manager | Renders zone cards, plant counts, new zone form |
| `harvests-page.test.tsx` | Harvest log | Renders data table, stats summary, crop breakdown, year filter |
| `companions-page.test.tsx` | Companion guide | Renders compatibility checker, browse list, matrix grid |
| `layout-planner.test.tsx` | Layout planner | Renders grid canvas, palette sidebar, item placement |
| `frost-page.test.tsx` | Frost dates | Renders zone config, countdowns, planting calendar |

### Test Strategy

- Mock server actions at the module level (vitest `vi.mock`)
- Test all 5 states: loading skeleton, empty state CTA, error with retry, success render, partial data
- Test key interactions: water plant, change segment, filter by zone, navigate to detail
- Snapshot test for layout.tsx nav structure

---

## QA Checklist

### Per-Page Verification

- [ ] Dashboard: Stats load correctly, watering schedule sorted by urgency, segment pills work
- [ ] Dashboard: Empty state shows "Your garden awaits" with green CTA
- [ ] Dashboard: Urgency banner appears when plants are overdue
- [ ] Dashboard: "Water All Overdue" processes all overdue plants
- [ ] Plant Detail: All sections populate (profile, journal, watering, diagnoses, harvests)
- [ ] Plant Detail: Water Now updates lastWatered and creates journal entry
- [ ] Plant Detail: Edit form persists changes
- [ ] Plant Detail: Delete navigates back to garden
- [ ] Zones: Zone cards show correct plant count and overdue badge
- [ ] Zone Detail: Plants in zone listed, light readings displayed
- [ ] Journal: Date range filter works, action filter works
- [ ] Seeds: Table sorts by all columns, inline quantity edit works, expiry highlighting
- [ ] Harvests: Data table sorts, year filter re-fetches, crop breakdown bars render
- [ ] Companions: Pair check returns correct result, browse search filters, matrix renders
- [ ] Layout Planner: Drag-and-drop places items on grid, companion warnings appear
- [ ] Frost: Zone dropdown updates dates, countdown cards are correct, planting calendar populates
- [ ] Seasonal: Season dropdown filters tasks, Complete/Snooze work, category browse works
- [ ] Diagnoses: Active list populates, symptom matcher returns results, status updates work
- [ ] Wishlist: Priority sort correct, mark acquired works, delete works
- [ ] Propagations: Active list populates, stage advance works, stats cards correct

### Cross-Cutting Checks

- [ ] All pages handle loading state (skeleton)
- [ ] All pages handle empty state (warm CTA, not "No items found")
- [ ] All pages handle error state (retry button, not technical error)
- [ ] All server action calls wrapped in try/catch/finally
- [ ] No stuck-loading states (the P0 bug from DB init race)
- [ ] Cool Obsidian theme throughout (no light theme cards, no white backgrounds)
- [ ] Responsive: Below 768px collapses to single column gracefully
- [ ] Nav header links all functional, "More" dropdown works
- [ ] Every interactive element has min 44px touch target
- [ ] Module accent #22C55E used consistently
- [ ] No em dashes in any text content
- [ ] No "Coming Soon" or placeholder buttons

---

## Implementation Priority

Build in this order (dependency chain):

1. **`actions.ts`** -- All server actions wrapping module exports (foundation for every page)
2. **`layout.tsx`** -- Glass nav header (shared by all pages)
3. **`page.tsx`** -- Dashboard (the hero screen, highest value)
4. **`[id]/page.tsx`** -- Plant detail (most-visited sub-page)
5. **`zones/page.tsx` + `zones/[id]/page.tsx`** -- Zone management
6. **`journal/page.tsx`** -- Garden journal
7. **`seeds/page.tsx`** -- Seed inventory
8. **`harvests/page.tsx`** -- Harvest log
9. **`companions/page.tsx`** -- Companion planting guide
10. **`frost/page.tsx`** -- Frost dates and planting calendar
11. **`seasonal/page.tsx`** -- Seasonal care tasks
12. **`diagnoses/page.tsx`** -- Plant health diagnoses
13. **`wishlist/page.tsx`** -- Wish list
14. **`propagations/page.tsx`** -- Propagation tracker
15. **`layout-planner/page.tsx`** -- Visual layout planner (most complex, build last)
16. **`__tests__/`** -- Test suite for core pages

---

## Acceptance Criteria

The Garden web UI is complete when:

1. All 15 routes render correctly with real data from the garden module
2. All 75+ module exports are accessible via server actions in `actions.ts`
3. All 5 states (loading, empty, error, success, partial) work on every page
4. Dashboard shows watering urgency, stats, plant grid with segments, and seasonal tasks
5. Plant detail shows complete profile with journal, diagnoses, harvests, and propagations
6. Companion planting guide shows pair checker and NxN matrix with correct data
7. Layout planner renders grid canvas with drag-and-drop item placement
8. Frost page shows zone config with countdown cards and planting calendar
9. Cool Obsidian theme compliant (dark background, glass cards, green accent #22C55E)
10. No stuck-loading bugs (try/catch/finally on all server action calls)
11. Test suite covers dashboard, plant detail, zones, harvests, companions, layout planner, and frost pages
12. `pnpm typecheck` passes, `pnpm test` passes for garden web tests
