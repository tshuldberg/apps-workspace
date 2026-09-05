# Feature Spec: Garden Full Mobile UI

## Metadata
- **Module:** garden
- **Task ID:** M11-5
- **Priority:** P0 (foundation for all Garden mobile work)
- **Estimated CC Time:** 10-14 hours
- **Depends On:** All V1/V2 CRUD and engines already implemented
- **Prerequisites:** Fix garden migration bug (P0 from TODOS.md) -- V2 migration references a `status` column that doesn't exist, breaking fresh installs. Must be fixed before any UI work.
- **Blocks:** All Garden mobile features (plant identification UX, layout editor interactions, etc.)

## Business Context

### Why This Spec Exists
MyGarden has 80+ exported functions across 2 schema versions, 7 engines (watering, companion planting, diagnosis, light classification, propagation, seasonal care, frost dates), and 16 database tables. The mobile UI is a single placeholder screen that does not surface any of this functionality. This spec designs the full 30+ screen mobile experience that surfaces all module capabilities through a plant-centric navigation flow with zone organization, seasonal intelligence, and visual garden planning tools.

### Competitor Landscape (Mobile UX)

| Competitor | Screen Count | Navigation Pattern | Standout UX |
|-----------|-------------|-------------------|-------------|
| Planta | ~15 | Tab bar (My Plants, Explore, Calendar, Profile) | Beautiful watering schedule with drop animation, plant health meter |
| Greg | ~12 | Plant-centric stack with watering reminders | Personality-driven ("Greg waters your plants"), swipe-to-water |
| PictureThis | ~10 | Camera-first (Identify, My Plants, Explore) | AI identification via camera, disease diagnosis from photo |
| Gardenia | ~8 | Tab bar (Garden, Tasks, Calendar, Encyclopedia) | Seasonal task calendar, frost date alerts, companion planting |
| Vera | ~6 | Minimal stack (Plants, Reminders) | Ultra-simple watering reminders, no clutter |

### MyGarden Differentiators
- **Privacy-first:** All data local SQLite, no accounts, no cloud dependency, no subscription for basic plant care
- **Suite integration:** Plants can reference MyWorkouts outdoor activities, MyBudget garden spending
- **Full garden lifecycle:** Plant catalog -> zone organization -> seasonal task queue -> diagnosis tool -> harvest tracking -> companion planting -> layout planning -> propagation tracker -> frost dates -> wish list -> seed inventory
- **7 bundled engines** with offline intelligence (companion DB, symptom matcher, seasonal care KB, frost zone lookup, light classification, propagation state machine, watering calculator)
- **No paywalled identification:** PictureThis charges $30/yr for ID; MyGarden stores identification results locally

## Screen Architecture

### Navigation Structure

```
(garden)/
  _layout.tsx              -- Tabs navigator (4 visible tabs + hidden stack screens)
  index.tsx                -- Tab 1: Garden (plant list + watering urgency)
  tasks.tsx                -- Tab 2: Tasks (seasonal + watering combined queue)
  journal.tsx              -- Tab 3: Journal (care log timeline)
  settings.tsx             -- Tab 4: Settings
  plant/[id].tsx           -- Stack: Plant Detail (the hub for one plant)
  add-plant.tsx            -- Stack: Add Plant (form with optional zone assignment)
  zone/[id].tsx            -- Stack: Zone Detail (plants in zone, stats, light readings)
  zones.tsx                -- Stack: Zone Manager (all zones list + create)
  diagnose.tsx             -- Stack: Diagnosis Tool (symptom picker + results)
  diagnosis/[id].tsx       -- Stack: Diagnosis Detail (treatment tracking)
  companions.tsx           -- Stack: Companion Planting Guide (search + compatibility)
  companion-check.tsx      -- Stack: Compatibility Checker (pair two plants)
  layout/[id].tsx          -- Stack: Layout Editor (grid-based garden planner)
  layouts.tsx              -- Stack: Layout List (all saved layouts)
  propagation/[id].tsx     -- Stack: Propagation Detail (stage progression)
  propagations.tsx         -- Stack: Active Propagations List
  frost.tsx                -- Stack: Frost Dates & Planting Calendar
  harvests.tsx             -- Stack: Harvest Log + Stats
  harvest/add.tsx          -- Stack: Log Harvest
  wishlist.tsx             -- Stack: Wish List
  seeds.tsx                -- Stack: Seed Inventory
  light-meter.tsx          -- Stack: Light Meter (manual lux entry + classification)
  identify.tsx             -- Stack: Identify Plant (photo + results)
  seasonal.tsx             -- Stack: Seasonal Care Guide (browse by category)
```

### Tab Bar Configuration

| Tab | Label | Icon | Screen |
|-----|-------|------|--------|
| 1 | Garden | `flower-2` | `index.tsx` |
| 2 | Tasks | `check-circle` | `tasks.tsx` |
| 3 | Journal | `book-open` | `journal.tsx` |
| 4 | More | `grid` | `more.tsx` |

Stack screens are hidden from the tab bar via `href: null` (same pattern as recipes/rsvp modules).

### Layout Pattern

Follow the recipes module layout pattern (`apps/mobile/app/(recipes)/_layout.tsx`):
- `Tabs` navigator from `expo-router`
- `ModuleErrorBoundary` wrapper with `moduleName="MyGarden"`
- `BackToHubButton` in `headerLeft`
- Accent color: `colors.modules.garden` (`#22C55E`)
- Cool Obsidian theme tokens throughout

---

## Screen Specifications

### Screen 1: Garden Overview (`index.tsx`)

**Purpose:** Primary landing screen. Shows all plants organized by urgency, with quick watering actions. Entry point for adding plants.

**Layout:**
```
+-----------------------------------+
| <- MyGarden                    +  |  Header with add plant button
+-----------------------------------+
| [All] [NEEDS WATER] [By Zone]    |  Segment control (smart default)
+-----------------------------------+
|  TODAY IN YOUR GARDEN             |  Urgency hero (if overdue > 0)
|  3 plants need water              |
|  [Water All Overdue]              |  Batch action button
+-----------------------------------+
| +-------------------------------+ |
| | [img]  Monstera Deliciosa     | |  Plant card (glass morphism)
| |        Living Room            | |  Zone name
| |   !! 2 days overdue  [Water]  | |  Overdue badge + quick water
| +-------------------------------+ |
| +-------------------------------+ |
| | [img]  Fiddle Leaf Fig        | |
| |        Bedroom Window         | |
| |   Due tomorrow     [Water]    | |  Upcoming badge
| +-------------------------------+ |
| +-------------------------------+ |
| | [img]  Snake Plant            | |
| |        Office                 | |
| |   Watered 3 days ago          | |  Healthy, no action needed
| +-------------------------------+ |
|                                   |
|          Empty State:             |
|    "Your garden is empty.         |
|     Tap + to add your first       |
|     plant."                       |
+-----------------------------------+
| [Garden] [Tasks] [Journal] [Set] |  Tab bar
+-----------------------------------+
```

**Data Sources:**
- `getPlants()` -- all plants, sorted by name
- `getWateringSchedule()` -- urgency-sorted watering list
- `getGardenStats()` -- overdue count for urgency banner
- `getZones()` -- for "By Zone" grouping

**Interactions:**
- Tap plant card -> push `plant/[id]`
- Tap [Water] quick action -> call `waterPlant(plantId)`, show success toast, refresh list
- Tap + button -> push `add-plant`
- **Smart default:** When `overdueWateringCount > 0`, default to "Needs Water" segment. When all plants are healthy, default to "All". User tap overrides for the session.
- "Water All Overdue" batch action calls `waterPlant()` for each overdue plant in sequence, shows batch success animation (checkmark sweep), refreshes list
- Segment: "All" = alphabetical, "Needs Water" = overdue first sorted by urgency, "By Zone" = grouped by zone with zone headers
- Pull-to-refresh reloads plant list and watering schedule
- Search bar (visible on scroll-up): filter plants by name or species. Required at 50+ plants.

**Quick Actions (long press on plant card):**
- Water now
- Log care entry
- View diagnoses
- Edit plant

**Stats Bar (below segment control):**
```
+-----------------------------------+
| 24 plants  |  3 overdue  | 22    |  Compact stat badges
| total       watering     thriving |
+-----------------------------------+
```
Uses `getGardenStats()` for total/overdue and `calculateSurvivalRate()` for survival percentage.

---

### Screen 2: Plant Detail (`plant/[id].tsx`)

**Purpose:** Central hub for a single plant. Shows care history, health status, watering schedule, diagnoses, harvests, propagations, and identification history.

**Layout:**
```
+-----------------------------------+
| <- Monstera Deliciosa        ...  |  Header with overflow menu
+-----------------------------------+
| +-------------------------------+ |
| |                               | |
| |      [Plant Photo]           | |  Hero image (or placeholder icon)
| |                               | |
| +-------------------------------+ |
| Monstera deliciosa               |  Species name (italic, secondary)
| Living Room  ·  Indoor           |  Zone + location
| Acquired: Jun 2024               |  Acquired date
+-----------------------------------+
|         Status: Healthy           |  Status badge (color-coded)
+-----------------------------------+
| WATERING                          |  Section header
| +-------------------------------+ |
| | Every 7 days                  | |  Frequency
| | Last watered: Mar 21          | |  Last watered
| | Next: Mar 28 (in 5 days)      | |  Next water date
| |          [Water Now]           | |  Primary action button
| +-------------------------------+ |
+-----------------------------------+
| QUICK ACTIONS                     |  Grid of action buttons
| +-------+ +-------+ +-------+   |
| | Water | | Feed  | | Prune |   |  Creates journal entry
| +-------+ +-------+ +-------+   |
| +-------+ +-------+ +-------+   |
| |Harvest| | Photo | | Note  |   |
| +-------+ +-------+ +-------+   |
+-----------------------------------+
| CARE HISTORY                      |  Recent journal entries
| Mar 21  Watered                  |
| Mar 18  Fertilized - "Used 10-  |
|         10-10 diluted half"       |
| Mar 12  Watered                  |
| [View All in Journal]            |
+-----------------------------------+
| TOOLS                             |  Navigation cards
| +-------------------------------+ |
| | Diagnose Problem    >         | |  -> diagnose (pre-filled plant)
| | Companion Check     >         | |  -> companion-check (pre-filled)
| | Propagations (2)    >         | |  -> propagations (filtered)
| | Harvests (14)       >         | |  -> harvests (filtered)
| | Identifications (1) >         | |  -> identification history
| +-------------------------------+ |
+-----------------------------------+
| NOTES                             |  Free-text notes section
| "Bought from Home Depot. Likes   |
|  humidity. Mist weekly."          |
|                        [Edit]     |
+-----------------------------------+
```

**Data Sources:**
- `getPlantById(id)` -- plant details
- `getEntriesForPlant(id, 5)` -- last 5 care entries
- `calculateNextWaterDate()` + `isDaysOverdue()` -- watering intelligence
- `adjustFrequencyForSeason()` -- current season adjustment note
- `getActiveDiagnoses(plantId)` -- active diagnosis count
- `getActivePropagations()` filtered by parentPlantId -- propagation count
- `getHarvests({ plantId })` -- harvest count
- `getIdentificationsForPlant(plantId)` -- identification history

**Overflow Menu (...):**
- Edit plant details
- Change status (healthy / needs attention / dormant / dead)
- Move to different zone
- Delete plant (with confirmation)

---

### Screen 3: Add Plant (`add-plant.tsx`)

**Purpose:** Create a new plant with all relevant details.

**Layout:**
```
+-----------------------------------+
| <- Add Plant              [Save]  |
+-----------------------------------+
| [Tap to add photo]               |  Image picker
+-----------------------------------+
| Name *                            |  Required
| [                              ]  |
| Species                           |  Optional
| [                              ]  |
| Location                          |  Picker: indoor/outdoor/greenhouse/balcony
| [Indoor          v]              |
| Zone                              |  Picker from existing zones
| [Living Room     v] [+ New]      |
| Water Frequency                   |  Number input + "days" suffix
| Every [7] days                    |
| Status                            |  Picker
| [Healthy         v]              |
| Acquired Date                     |  Date picker
| [Mar 23, 2026]                   |
| Notes                             |  Multi-line text
| [                              ]  |
+-----------------------------------+
```

**Interactions:**
- Save calls `createPlant()` with form data
- Photo picker via `expo-image-picker`
- Zone picker shows existing zones from `getZones()` with "+ New Zone" shortcut that opens an inline modal
- Validation: name is required, min 1 char, max 100
- After save: navigate back to garden list

---

### Screen 4: Zone Manager (`zones.tsx`)

**Purpose:** View all zones, their stats, and manage zone organization.

**Layout:**
```
+-----------------------------------+
| <- Zones                      +  |  Header with add zone
+-----------------------------------+
| +-------------------------------+ |
| | Living Room           Indoor  | |  Zone card
| | 8 plants  |  2 overdue       | |  Zone stats
| | Avg light: Medium (1,200 lux)| |  Light reading average
| +-------------------------------+ |
| +-------------------------------+ |
| | Balcony              Outdoor  | |  Zone card
| | 5 plants  |  0 overdue       | |
| | Avg light: Direct (12k lux)  | |
| +-------------------------------+ |
| +-------------------------------+ |
| | Greenhouse         Greenhouse | |  Zone card
| | 12 plants |  1 overdue       | |
| | Avg light: Bright (4k lux)   | |
| +-------------------------------+ |
|                                   |
|          Empty State:             |
|    "No zones yet. Organize your   |
|     plants by room or area."      |
+-----------------------------------+
```

**Data Sources:**
- `getZones()` -- all zones
- `getZoneStats(zoneId)` -- per-zone plant counts and health
- `getZoneAverageLux(zoneId)` -- average light reading per zone
- `classifyLight(avgLux)` -- light level label

**Interactions:**
- Tap zone card -> push `zone/[id]`
- Tap + -> create zone modal (name, location, zone type, icon, description)
- Long press -> edit/delete zone
- Zones sorted by `sortOrder` then name

---

### Screen 5: Zone Detail (`zone/[id].tsx`)

**Purpose:** View all plants in a zone, zone conditions, and light reading history.

**Layout:**
```
+-----------------------------------+
| <- Living Room               ...  |
+-----------------------------------+
| ZONE INFO                         |
| Type: Room  ·  Indoor             |
| 8 plants  ·  6 healthy  ·  2 !!  |
| Avg Light: Medium (1,200 lux)    |
| Humidity: Medium                  |
+-----------------------------------+
| LIGHT READINGS                    |
| +-------------------------------+ |
| | Mar 23  1,350 lux  Medium    | |
| | Mar 20  1,100 lux  Medium    | |
| | Mar 15    980 lux  Medium    | |
| +-------------------------------+ |
| [Take Reading]  [View History]   |
+-----------------------------------+
| PLANTS IN THIS ZONE               |
| (Same plant card format as main   |
|  garden list, filtered by zone)   |
+-----------------------------------+
```

**Data Sources:**
- `getZoneStats(zoneId)` -- zone-level stats
- `getZones()` filtered by id -- zone details (type, humidity, etc.)
- `getLightReadingsForZone(zoneId)` -- recent light readings
- `getPlants({ zone: zoneId })` -- plants in this zone

**Interactions:**
- "Take Reading" -> push `light-meter` pre-filled with zone
- "View History" -> full light reading list
- Tap plant card -> push `plant/[id]`
- Overflow menu: edit zone, delete zone

---

### Screen 6: Tasks Queue (`tasks.tsx`)

**Purpose:** Unified task queue combining watering schedule and seasonal care tasks. The daily "what to do" screen.

**Layout:**
```
+-----------------------------------+
| Tasks                             |
+-----------------------------------+
| [Today] [This Week] [Seasonal]   |  Segment control
+-----------------------------------+
| OVERDUE                           |  Section (red accent)
| +-------------------------------+ |
| | !! Monstera     2 days late   | |
| |    Water now          [Done]  | |
| +-------------------------------+ |
| +-------------------------------+ |
| | !! Fern          1 day late   | |
| |    Water now          [Done]  | |
| +-------------------------------+ |
+-----------------------------------+
| TODAY                             |  Section
| +-------------------------------+ |
| | Fiddle Leaf Fig               | |
| |    Water today        [Done]  | |
| +-------------------------------+ |
+-----------------------------------+
| SEASONAL TASKS                    |  Section (spring tasks)
| +-------------------------------+ |
| | Start fertilizing (tropicals) | |
| |    Begin monthly fertilizing  | |
| |    Due: March                 | |
| |    [Complete]  [Snooze 1 wk] | |
| +-------------------------------+ |
| +-------------------------------+ |
| | Repot root-bound (tropicals)  | |
| |    Repot into larger pots     | |
| |    Due: April                 | |
| |    [Complete]  [Snooze 1 wk] | |
| +-------------------------------+ |
+-----------------------------------+
| NO MORE TASKS TODAY               |  All caught up state
|    Your garden is happy!          |
+-----------------------------------+
```

**Data Sources:**
- `getWateringSchedule()` -- watering urgency list
- `getPendingSeasonalTasks(currentSeason)` -- seasonal task queue
- `getSeason(new Date().getMonth())` -- current season
- `getSeasonalTasksForCategory(category, season)` -- suggested tasks

**Interactions:**
- Tap [Done] on watering task -> call `waterPlant()`, animate removal
- Tap [Complete] on seasonal task -> call `completeSeasonalTask()`, animate removal
- Tap [Snooze 1 wk] -> call `snoozeSeasonalTask(id, dateInOneWeek)`
- "Today" view: overdue + due today watering tasks
- "This Week" view: next 7 days of watering tasks
- "Seasonal" view: all pending seasonal tasks for current season
- Tap plant name on watering task -> push `plant/[id]`

---

### Screen 7: Journal (`journal.tsx`)

**Purpose:** Chronological timeline of all care activities across all plants. The garden diary.

**Layout:**
```
+-----------------------------------+
| Journal                       +  |  Header with add entry button
+-----------------------------------+
| [All] [Water] [Feed] [Harvest]   |  Filter by action type
+-----------------------------------+
| TODAY - Mar 23                    |  Date header
| +-------------------------------+ |
| | 10:30 AM  Watered             | |
| | Monstera Deliciosa            | |
| +-------------------------------+ |
| +-------------------------------+ |
| | 9:15 AM   Fertilized          | |
| | Snake Plant                   | |
| | "Used 10-10-10 diluted"       | |
| +-------------------------------+ |
+-----------------------------------+
| YESTERDAY - Mar 22               |  Date header
| +-------------------------------+ |
| | 3:00 PM   Pruned              | |
| | Fiddle Leaf Fig               | |
| | [photo thumbnail]             | |
| | "Removed 3 dead leaves"       | |
| +-------------------------------+ |
| +-------------------------------+ |
| | 11:00 AM  Harvested           | |
| | Basil                         | |
| | 45g                           | |
| +-------------------------------+ |
+-----------------------------------+
```

**Data Sources:**
- `getEntriesByDate(startDate, endDate)` -- entries in date range
- Paginated: load 2 weeks at a time, load more on scroll

**Interactions:**
- Tap + -> quick entry form (select plant, action, notes, photo)
- Tap entry -> expand to show full notes and photo
- Filter chips filter by `CareAction` type: water, fertilize, prune, repot, harvest, pest_treatment, photo, note
- Pull-to-refresh reloads entries

---

### Screen 8: Diagnosis Tool (`diagnose.tsx`)

**Purpose:** Symptom-based plant problem diagnosis. Select symptoms from the built-in database and get matched conditions with treatment advice.

**Layout:**
```
+-----------------------------------+
| <- Diagnose Problem               |
+-----------------------------------+
| WHICH PLANT?                      |
| [Select plant       v]           |  Optional plant picker
| (or diagnose without a plant)    |
+-----------------------------------+
| WHAT DO YOU SEE?                  |  Symptom picker
| +-------------------------------+ |
| | Leaves                        | |  Category header
| | [Yellowing] [Brown tips]     | |  Selectable chips
| | [Spots] [Wilting] [Curling]  | |
| +-------------------------------+ |
| | Stems                        | |
| | [Soft/mushy] [Black spots]   | |
| | [Leggy growth]               | |
| +-------------------------------+ |
| | Soil / Roots                  | |
| | [Mold on soil] [Root rot]    | |
| | [Fungus gnats]               | |
| +-------------------------------+ |
| | Other                        | |
| | [Slow growth] [No blooms]    | |
| | [Dropping leaves]            | |
| +-------------------------------+ |
+-----------------------------------+
| Selected: Yellowing, Wilting     |  Selected symptom summary
|                                   |
|          [Diagnose]              |  Primary action button
+-----------------------------------+
```

**Results Screen (inline, below button):**
```
+-----------------------------------+
| POSSIBLE CAUSES                   |
| +-------------------------------+ |
| | Overwatering           85%    | |  Confidence badge
| |  Type: Environmental          | |
| |  Severity: Moderate           | |
| |  Treatment: Reduce watering,  | |
| |  check drainage, let soil dry | |
| |         [Save Diagnosis]      | |
| +-------------------------------+ |
| +-------------------------------+ |
| | Root Rot               60%    | |
| |  Type: Disease                | |
| |  Severity: Severe             | |
| |  Treatment: Remove affected   | |
| |  roots, repot in fresh soil   | |
| |         [Save Diagnosis]      | |
| +-------------------------------+ |
+-----------------------------------+
```

**Data Sources:**
- `getAllSymptoms()` -- full symptom list grouped by category
- `matchSymptoms(selectedSymptoms)` -- diagnosis matching engine
- `getPlants()` -- plant picker data

**Interactions:**
- Tap symptom chips to toggle selection (min 1 required)
- "Diagnose" runs `matchSymptoms()` and shows ranked results
- "Save Diagnosis" calls `createDiagnosis()` with selected plant, symptoms, diagnosis name, severity
- Optional: attach photo via `expo-image-picker`
- Saved diagnosis appears on plant detail and in active diagnoses list

---

### Screen 9: Diagnosis Detail (`diagnosis/[id].tsx`)

**Purpose:** Track treatment progress for a saved diagnosis.

**Layout:**
```
+-----------------------------------+
| <- Diagnosis                      |
+-----------------------------------+
| Overwatering                      |  Diagnosis name
| Monstera Deliciosa               |  Plant name (tappable)
| Diagnosed: Mar 20, 2026          |
| Severity: Moderate               |  Color-coded badge
| Status: In Treatment             |  Status badge
+-----------------------------------+
| SYMPTOMS                          |
| Yellowing, Wilting               |
+-----------------------------------+
| TREATMENT NOTES                   |
| "Reduced watering to every 10    |
|  days. Moved away from window.   |
|  Checking soil moisture before    |
|  watering."                       |
|                        [Edit]     |
+-----------------------------------+
| STATUS ACTIONS                    |
| [Mark Resolved] [Mark Unresolvable]|
+-----------------------------------+
```

**Data Sources:**
- `getActiveDiagnoses(plantId)` or `getDiagnosisHistory(plantId)` filtered by ID
- `updateDiagnosisStatus(id, status)` -- status transitions

---

### Screen 10: Companion Planting Guide (`companions.tsx`)

**Purpose:** Browse the companion planting database. Search for any plant to see what grows well (or poorly) next to it.

**Layout:**
```
+-----------------------------------+
| <- Companion Guide                |
+-----------------------------------+
| [Search plants...              ]  |  Search bar
+-----------------------------------+
| POPULAR LOOKUPS                   |  Quick access
| [Tomato] [Basil] [Pepper]       |
| [Carrot] [Lettuce] [Bean]       |
+-----------------------------------+
| (After selecting "Tomato")       |
| COMPANIONS                        |  Green section
| +-------------------------------+ |
| | Basil                         | |
| | Repels pests, improves flavor | |
| +-------------------------------+ |
| | Carrot                        | |
| | Loosens soil for tomato roots  | |
| +-------------------------------+ |
+-----------------------------------+
| ANTAGONISTS                       |  Red section
| +-------------------------------+ |
| | Fennel                        | |
| | Inhibits tomato growth        | |
| +-------------------------------+ |
| | Cabbage                       | |
| | Competes for nutrients        | |
| +-------------------------------+ |
+-----------------------------------+
| [Check Two Plants]               |  Navigate to compatibility checker
+-----------------------------------+
```

**Data Sources:**
- `searchCompanionPlants(query)` -- fuzzy search
- `getAllCompanionPlants()` -- full plant list for browsing
- `getCompanions(plantName)` -- companion relationships
- `getAntagonists(plantName)` -- antagonist relationships

---

### Screen 11: Compatibility Checker (`companion-check.tsx`)

**Purpose:** Check compatibility between two specific plants.

**Layout:**
```
+-----------------------------------+
| <- Compatibility Check            |
+-----------------------------------+
| PLANT A                           |
| [Search or select...       v]    |  Autocomplete from companion DB
| PLANT B                           |
| [Search or select...       v]    |
|                                   |
|          [Check]                 |
+-----------------------------------+
| (Result)                          |
| +-------------------------------+ |
| |   Tomato + Basil              | |
| |        COMPANION              | |  Green badge
| |   "Basil repels aphids and    | |
| |    whiteflies from tomatoes.  | |
| |    Improves flavor."          | |
| |   Category: pest_control      | |
| +-------------------------------+ |
+-----------------------------------+
```

**Data Sources:**
- `checkCompatibility(plantA, plantB)` -- returns relationship + benefit

---

### Screen 12: Layout List (`layouts.tsx`)

**Purpose:** Browse saved garden layouts. Create new ones.

**Layout:**
```
+-----------------------------------+
| <- Garden Layouts              +  |
+-----------------------------------+
| +-------------------------------+ |
| | Spring 2026 Veggie Bed       | |  Layout card
| | 8x8 grid  ·  12" cells      | |  Dimensions
| | Backyard Raised Bed           | |  Zone name
| | 6 plants placed              | |
| +-------------------------------+ |
| +-------------------------------+ |
| | Indoor Plant Arrangement     | |
| | 6x4 grid  ·  12" cells      | |
| | Living Room                   | |
| +-------------------------------+ |
|                                   |
|          Empty State:             |
|    "Plan your garden layout.      |
|     Tap + to create one."         |
+-----------------------------------+
```

**Data Sources:**
- `getLayouts()` -- all layouts
- `getLayoutItems(layoutId)` -- item count per layout

---

### Screen 13: Layout Editor (`layout/[id].tsx`)

**Purpose:** Grid-based visual garden layout planner. Place plants, paths, structures, and decorations on a configurable grid.

**Layout:**
```
+-----------------------------------+
| <- Spring 2026 Veggie Bed   ...  |
+-----------------------------------+
|                                   |
|  +--+--+--+--+--+--+--+--+      |  8x8 grid canvas
|  |To|To|  |Ba|Ba|  |  |  |      |  Items placed on grid
|  +--+--+--+--+--+--+--+--+      |  To=Tomato, Ba=Basil
|  |  |  |Ca|Ca|  |Pe|Pe|  |      |  Ca=Carrot, Pe=Pepper
|  +--+--+--+--+--+--+--+--+      |
|  |  |  |  |  |  |  |  |  |      |
|  +--+--+--+--+--+--+--+--+      |
|  |Le|Le|Le|  |  |  |  |  |      |  Le=Lettuce
|  +--+--+--+--+--+--+--+--+      |
|  |  |  |  |  |  |  |  |  |      |
|  +--+--+--+--+--+--+--+--+      |
|  |  |  |~~|~~|~~|  |  |  |      |  ~~=Water source
|  +--+--+--+--+--+--+--+--+      |
|  |  |  |  |  |  |  |  |  |      |
|  +--+--+--+--+--+--+--+--+      |
|  |  |  |  |  |  |  |  |  |      |
|  +--+--+--+--+--+--+--+--+      |
|                                   |
+-----------------------------------+
| PALETTE                           |  Scrollable item picker
| [+ Plant] [Path] [Structure]     |
| [Water] [Decoration] [Empty]     |
+-----------------------------------+
| PLACED ITEMS (6)                  |  Item list below grid
| Tomato (2x1)  ·  12" spacing    |
| Basil (2x1)                      |
| Carrot (2x1)                     |
+-----------------------------------+
```

**Data Sources:**
- `getLayouts()` filtered by id -- layout metadata
- `getLayoutItems(layoutId)` -- placed items
- `createLayoutItem()` -- add new item
- `deleteLayoutItem()` -- remove item

**Interactions:**
- Tap empty cell -> add item (pick from palette)
- Tap placed item on grid -> select it (show border), option to move/delete
- Palette buttons set the current "brush" for placement
- Plant items link to existing plants via `plantId` (optional)
- Pinch-to-zoom on the grid
- Each cell represents `cellSizeInches` (default 12" = 1 foot)

---

### Screen 14: Propagation List (`propagations.tsx`)

**Purpose:** View all active propagation projects. Track progress through the propagation stage pipeline.

**Layout:**
```
+-----------------------------------+
| <- Propagations                +  |
+-----------------------------------+
| [Active] [Completed] [Failed]    |  Segment control
+-----------------------------------+
| +-------------------------------+ |
| | Monstera Cutting #1           | |  Propagation card
| | Method: Stem cutting          | |
| | Medium: Water                 | |
| | Stage: Rooting                | |  Stage badge (color-coded)
| | Started: Mar 10               | |
| | [.....====.......]            | |  Stage progress bar
| |  started > callusing >        | |
| |  ROOTING > growing > ready    | |
| +-------------------------------+ |
| +-------------------------------+ |
| | Pothos Division               | |
| | Method: Division              | |
| | Stage: Growing                | |
| | Started: Feb 28               | |
| +-------------------------------+ |
+-----------------------------------+
| STATS                             |
| 12 total  ·  8 success  ·  67%  |  Propagation stats
+-----------------------------------+
```

**Data Sources:**
- `getActivePropagations()` -- active propagations
- `getPropagationStats()` -- success rate and counts
- `getNextStages(currentStage)` -- valid next stages for progression

**Interactions:**
- Tap propagation card -> push `propagation/[id]`
- Tap + -> create new propagation form (parent plant picker, method, medium, notes)
- Stage progress bar shows the 6-stage pipeline visually

---

### Screen 15: Propagation Detail (`propagation/[id].tsx`)

**Purpose:** Track a single propagation project. Advance through stages.

**Layout:**
```
+-----------------------------------+
| <- Monstera Cutting #1           |
+-----------------------------------+
| PARENT PLANT                      |
| Monstera Deliciosa  >            |  Tappable -> plant detail
+-----------------------------------+
| METHOD & MEDIUM                   |
| Stem Cutting  ·  Water           |
| Started: Mar 10, 2026            |
| Days active: 13                  |
+-----------------------------------+
| STAGE PROGRESSION                 |
| [====|====|XXXX|....|....|....]  |  Visual pipeline
|  Start Callus ROOT  Grow  Ready  Pot
|                 ^                 |
|            Current stage          |
+-----------------------------------+
| ADVANCE STAGE                     |
| +-------------------------------+ |
| | [Growing]  [Ready]  [Potted] | |  Valid next stages
| | [Mark Failed]                 | |  Failure option
| +-------------------------------+ |
+-----------------------------------+
| NOTES                             |
| "Good root development visible.  |
|  Roots are about 2 inches long." |
|                        [Edit]     |
+-----------------------------------+
| CHILD PLANT                       |  (Only if stage = potted)
| [Link to existing plant]         |
| (or create new plant from this   |
|  propagation)                     |
+-----------------------------------+
```

**Data Sources:**
- Propagation record by ID
- `getNextStages(currentStage)` -- valid advancement options
- `isValidStageTransition(from, to)` -- validate before advancing
- `advancePropagationStage(id, newStage)` -- advance
- `linkPropagationChild(id, childPlantId)` -- link child plant

---

### Screen 16: Frost Dates & Planting Calendar (`frost.tsx`)

**Purpose:** Configure USDA zone, see frost date countdown, and view a planting calendar with timing relative to frost dates.

**Layout:**
```
+-----------------------------------+
| <- Frost Dates                    |
+-----------------------------------+
| YOUR ZONE                         |
| USDA Zone: [8a     v]            |  Picker (3a-10b)
| ZIP Code:  [94110]               |  Optional text input
+-----------------------------------+
| FROST DATES                       |
| Last Frost:  Mar 15              |  From zone lookup
| First Frost: Nov 10              |
| Growing Season: 240 days         |
+-----------------------------------+
| CURRENT PHASE                     |
| +-------------------------------+ |
| |    GROWING SEASON             | |  Phase badge (green)
| |    233 days until first frost | |  Countdown
| |    (Nov 10, 2026)             | |
| +-------------------------------+ |
+-----------------------------------+
| PLANTING CALENDAR                 |  15 crops with timing
| +-------------------------------+ |
| | Tomato                        | |
| | Indoor start: Jan 18         | |  8 wks before last frost
| | Transplant: Mar 29           | |  2 wks after last frost
| | Last harvest: ~Oct 13        | |  4 wks before first frost
| +-------------------------------+ |
| | Pepper                        | |
| | Indoor start: Jan 4          | |  10 wks before
| | Transplant: Mar 29           | |
| | Last harvest: ~Oct 13        | |
| +-------------------------------+ |
| | Lettuce                       | |
| | Direct sow: Mar 15           | |  At last frost
| | (Can also start indoors       | |
| |  4 weeks earlier)             | |
| +-------------------------------+ |
| | Spinach                       | |
| | Direct sow: Feb 15           | |  4 wks before last frost
| +-------------------------------+ |
| ... (15 total crops)             |
+-----------------------------------+
```

**Data Sources:**
- `lookupZone(usdaZone)` -- frost dates from USDA zone
- `getCurrentFrostPhase(lastFrost, firstFrost, today)` -- current phase + countdown
- `getPlantingCalendar()` -- 15 crops with timing relative to frost
- `getFrostConfig()` / `setFrostConfig()` -- persisted zone config
- `calculateCountdown(targetDate, today)` -- days until event

**Interactions:**
- Changing USDA zone recalculates all dates instantly
- Planting calendar dates are computed from frost dates + crop-specific offsets
- Custom frost date override via "Use custom dates" toggle
- First visit: prompt to set zone

---

### Screen 17: Harvest Log (`harvests.tsx`)

**Purpose:** View all harvests, stats, and trends.

**Layout:**
```
+-----------------------------------+
| <- Harvests                    +  |
+-----------------------------------+
| 2026 STATS                        |
| +------+  +------+  +----------+ |
| | 4.2  |  |  28  |  | Top:    | |
| | kg   |  | logs |  | Tomato  | |
| +------+  +------+  +----------+ |
+-----------------------------------+
| FILTER BY CROP                    |
| [All] [Tomato] [Basil] [Pepper] |  From getCropTypes()
+-----------------------------------+
| HARVEST LOG                       |
| +-------------------------------+ |
| | Mar 22  Basil     45g   ★★★★ | |  Date, plant, qty, quality
| | Mar 20  Tomato   320g   ★★★★★| |
| | Mar 18  Tomato   280g   ★★★★ | |
| | Mar 15  Pepper   150g   ★★★  | |
| +-------------------------------+ |
+-----------------------------------+
```

**Data Sources:**
- `getHarvests(filters)` -- harvest records with optional crop/date/plant filters
- `getHarvestStats(year)` -- total quantity, count, top producer
- `getCropTypes()` -- unique crop types for filter chips

**Interactions:**
- Tap + -> push `harvest/add`
- Tap harvest row -> expand with notes and photo
- Filter by crop type or plant
- Quality shown as star rating (1-5)

---

### Screen 18: Log Harvest (`harvest/add.tsx`)

**Purpose:** Quick harvest logging form.

**Layout:**
```
+-----------------------------------+
| <- Log Harvest            [Save]  |
+-----------------------------------+
| Plant *                           |
| [Select plant          v]        |
| Quantity *                        |
| [         ] [grams    v]         |  Number + unit picker
| Crop Type                         |
| [Tomato                ]         |  Free text / autocomplete from history
| Quality Rating                    |
| [★ ★ ★ ★ ☆]                    |  1-5 star picker
| Date                              |
| [Today                 ]         |
| Photo                             |
| [Tap to add photo]               |
| Notes                             |
| [                              ]  |
+-----------------------------------+
```

**Data Sources:**
- `createHarvest()` -- save harvest record
- `getCropTypes()` -- autocomplete suggestions
- Units: grams, kg, oz, lbs, count, bunches, cups

---

### Screen 19: Wish List (`wishlist.tsx`)

**Purpose:** Track plants you want to acquire. Prioritize and mark as acquired.

**Layout:**
```
+-----------------------------------+
| <- Wish List                   +  |
+-----------------------------------+
| [Active] [Acquired]              |  Segment control
+-----------------------------------+
| HIGH PRIORITY                     |  Section header
| +-------------------------------+ |
| | Variegated Monstera           | |
| | M. deliciosa 'Thai Const.'   | |
| | Source: Local nursery          | |
| | ~$45.00                       | |
| |              [Mark Acquired]  | |
| +-------------------------------+ |
+-----------------------------------+
| MEDIUM PRIORITY                   |
| +-------------------------------+ |
| | String of Pearls             | |
| | Senecio rowleyanus            | |
| | ~$12.00                       | |
| |              [Mark Acquired]  | |
| +-------------------------------+ |
+-----------------------------------+
| LOW PRIORITY                      |
| +-------------------------------+ |
| | Bird of Paradise             | |
| | Strelitzia                    | |
| |              [Mark Acquired]  | |
| +-------------------------------+ |
+-----------------------------------+
```

**Data Sources:**
- `getWishList(includeAcquired)` -- sorted by priority
- `createWishListItem()` -- add new item
- `markWishListAcquired(id, plantId?)` -- mark as acquired, optionally link to new plant
- `deleteWishListItem()` -- remove from list

**Interactions:**
- "Mark Acquired" -> prompt: "Create a plant from this?" If yes, push `add-plant` pre-filled with name/species, then link via `acquiredPlantId`
- Swipe left to delete
- Tap + -> add wish list item form (name, species, source, price, priority, notes, photo)
- "Acquired" tab shows past acquisitions with acquisition date

---

### Screen 20: Seed Inventory (`seeds.tsx`)

**Purpose:** Track seed packets: what you have, how many, expiry dates.

**Layout:**
```
+-----------------------------------+
| <- Seed Inventory              +  |
+-----------------------------------+
| +-------------------------------+ |
| | Tomato (Roma)                 | |  Seed card
| | Solanum lycopersicum          | |
| | Qty: 25 seeds                 | |
| | Source: Burpee                | |
| | Expires: Dec 2027            | |
| |    [-] [25] [+]              | |  Quantity adjuster
| +-------------------------------+ |
| +-------------------------------+ |
| | Basil (Sweet)                 | |
| | Qty: 50 seeds                 | |
| | Source: Baker Creek           | |
| | Expires: Jun 2026  !!        | |  Expiry warning
| |    [-] [50] [+]              | |
| +-------------------------------+ |
+-----------------------------------+
```

**Data Sources:**
- `getSeeds()` -- all seeds sorted by name
- `createSeed()` -- add new seed packet
- `updateSeedQuantity()` -- adjust quantity
- `deleteSeed()` -- remove seed

**Interactions:**
- Tap +/- to adjust quantity (calls `updateSeedQuantity`)
- Highlight seeds expiring within 3 months with warning badge
- Tap + -> add seed form (name, species, quantity, source, purchased date, expiry, notes)
- Long press -> edit/delete

---

### Screen 21: Light Meter (`light-meter.tsx`)

**Purpose:** Record light readings for zones. Manual lux entry with automatic classification.

**Layout:**
```
+-----------------------------------+
| <- Light Meter                    |
+-----------------------------------+
| TAKE A READING                    |
| Zone:  [Living Room     v]       |  Zone picker
| Lux:   [          ]              |  Number input
| Time:  [10:30 AM]                |  Optional time picker
|                                   |
|          [Record]                |
+-----------------------------------+
| (After entering lux value)       |
| CLASSIFICATION                    |
| +-------------------------------+ |
| |    MEDIUM LIGHT               | |  Dynamic classification
| |    500-2,500 lux              | |
| |    East/west windows,         | |
| |    filtered light             | |
| +-------------------------------+ |
+-----------------------------------+
| RECENT READINGS                   |
| Living Room                       |
| +-------------------------------+ |
| | Mar 23  1,350 lux  Medium    | |
| | Mar 20  1,100 lux  Medium    | |
| | Average: 1,200 lux           | |
| +-------------------------------+ |
+-----------------------------------+
| LIGHT LEVEL GUIDE                 |
| Low:     < 500 lux              |
| Medium:  500-2,500 lux          |
| Bright:  2,500-10,000 lux       |
| Direct:  > 10,000 lux           |
+-----------------------------------+
```

**Data Sources:**
- `classifyLight(lux)` -- real-time classification as user types
- `lightLevelDescription(level)` -- human-readable description
- `createLightReading()` -- save reading
- `getLightReadingsForZone(zoneId)` -- reading history
- `getZoneAverageLux(zoneId)` -- zone average
- `getZones()` -- zone picker data

---

### Screen 22: Plant Identification (`identify.tsx`)

**Purpose:** Store plant identification results. Take a photo and manually record what the plant is (or store AI identification results from external services).

**Layout:**
```
+-----------------------------------+
| <- Identify Plant                 |
+-----------------------------------+
| [Tap to take photo]              |  Camera / image picker
+-----------------------------------+
| IDENTIFICATION RESULTS            |
| (Manually enter or paste from    |
|  an external ID app)             |
| Top Match:                        |
| [Monstera deliciosa         ]    |  Species input
| Common Name:                      |
| [Swiss Cheese Plant         ]    |  Common name input
| Confidence:                       |
| [0.92]                           |  0-1 decimal
| Source:                           |
| [on_device   v]                  |  Picker
|                                   |
| Link to Plant:                    |
| [Select existing plant  v]       |  Optional plant link
|          [Save]                  |
+-----------------------------------+
| PREVIOUS IDENTIFICATIONS          |
| +-------------------------------+ |
| | Mar 15  Monstera deliciosa    | |
| | Swiss Cheese Plant  ·  92%   | |
| | Linked to: Monstera           | |
| +-------------------------------+ |
+-----------------------------------+
```

**Data Sources:**
- `createIdentification()` -- save identification
- `getIdentificationsForPlant(plantId)` -- history for a plant
- Image via `expo-image-picker`

---

### Screen 23: Seasonal Care Guide (`seasonal.tsx`)

**Purpose:** Browse the seasonal care knowledge base by plant category. See what tasks apply for the current season and year-round.

**Layout:**
```
+-----------------------------------+
| <- Seasonal Care                  |
+-----------------------------------+
| Current Season: SPRING            |  From getSeason()
+-----------------------------------+
| CATEGORY                          |
| [Tropical] [Succulent] [Veggie] |  Category picker chips
| [Herb] [Flower] [Tree]          |
+-----------------------------------+
| (After selecting "Tropical")     |
| SPRING TASKS                      |
| +-------------------------------+ |
| | Increase Watering             | |
| | Increase watering as growth   | |
| | resumes. Due: March           | |
| |         [Add to My Tasks]     | |
| +-------------------------------+ |
| +-------------------------------+ |
| | Start Fertilizing             | |
| | Begin monthly fertilizing     | |
| | Due: April                    | |
| |         [Add to My Tasks]     | |
| +-------------------------------+ |
| +-------------------------------+ |
| | Repot                         | |
| | Repot root-bound plants into  | |
| | larger containers. Due: April | |
| |         [Add to My Tasks]     | |
| +-------------------------------+ |
+-----------------------------------+
| ALL SEASONS OVERVIEW              |
| Spring: 4 tasks                  |
| Summer: 1 task                   |
| Fall: 3 tasks                    |
| Winter: 1 task                   |
+-----------------------------------+
```

**Data Sources:**
- `getPlantCategories()` -- category list (tropical, succulent, vegetable, herb, flower, tree)
- `getSeasonalTasksForCategory(category, season)` -- tasks for category + season
- `getSeason(month)` -- current season
- `createSeasonalTask()` -- "Add to My Tasks" creates a personal seasonal task

**Interactions:**
- Selecting a category shows its seasonal tasks for the current season
- "Add to My Tasks" creates a `SeasonalTask` that appears in the Tasks tab queue
- Optionally link to a specific plant when adding a task

---

### Screen 24: More (`more.tsx`)

**Purpose:** Feature launcher (tools grid) plus actual preferences. NOT a "settings" dump -- this is the discovery hub for all garden tools.

**Layout:**
```
+-----------------------------------+
| More                              |
+-----------------------------------+
| TOOLS                             |  Icon grid (3 columns)
| [Zones]   [Frost]   [Companion] |  Horizontally scrollable
| [Layout]  [Harvest] [Seeds]     |  icon chips with labels
| [Propagate] [Light] [Identify]  |
| [Seasonal] [Wishlist]           |
+-----------------------------------+
| GARDEN OVERVIEW                   |
| 24 plants  ·  22 thriving        |
| 3 zones  ·  28 journal entries   |
| 4.2 kg harvested this year       |
+-----------------------------------+
| PREFERENCES                       |  Grouped list rows (no cards)
| USDA Zone            [8a]        |
| Default Location    [Indoor]     |
| Watering Reminders   [On]        |
+-----------------------------------+
| DATA                              |  Grouped list rows
| Export Garden Data        >      |
| About MyGarden            >      |
+-----------------------------------+
```

**Data Sources:**
- `getGardenStats()` -- garden overview numbers
- `getHarvestStats()` -- yearly harvest total
- `getSetting()` / `setSetting()` -- preferences
- `getFrostConfig()` -- USDA zone display

---

## State Coverage (All Screens)

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton cards / shimmer placeholders | Initial data fetch on screen mount |
| Empty | Contextual empty message + CTA button | No data for the screen's primary entity |
| Error | "Something went wrong" + retry button | Database read failure |
| Success | Full data rendered in cards/lists | Normal populated state |
| Partial | Urgency banners, warning badges | Overdue watering, expiring seeds, stale diagnoses |

Every screen must handle all 5 states. Use the same skeleton/empty/error patterns established in the recipes and rsvp modules.

### Per-Screen Empty States

Per DESIGN.md pattern: module-specific icon, warm headline, supporting text, primary CTA.

| Screen | Headline | Body | CTA |
|--------|----------|------|-----|
| Garden Overview | "Your garden awaits" | "Add your first plant to start tracking care." | "Add Plant" -> add-plant |
| Tasks Queue (Today) | "Nothing to do today" | "Your garden is all caught up. Enjoy the quiet." | (none) |
| Tasks Queue (Seasonal) | "No seasonal tasks" | "Browse the Seasonal Care Guide to add tasks." | "Browse Guide" -> seasonal |
| Journal | "No entries yet" | "Log your first watering to start your garden diary." | "Log Entry" -> add entry |
| More | (always has content: tools grid) | n/a | n/a |
| Plant Detail | (always has content if plant exists) | n/a | n/a |
| Zone Manager | "No zones yet" | "Organize your plants by room or area." | "Create Zone" |
| Zone Detail | "No plants in this zone" | "Add plants and assign them to this zone." | "Add Plant" -> add-plant |
| Diagnosis Tool | (always has content: symptom picker) | n/a | n/a |
| Diagnosis Detail | (always has content if diagnosis exists) | n/a | n/a |
| Companion Guide | "Search for a plant" | "Look up any plant to see what grows well beside it." | (search bar is CTA) |
| Compatibility Checker | "Pick two plants" | "Select two plants to check if they grow well together." | (inputs are CTA) |
| Layout List | "Plan your garden layout" | "Create a grid-based plan for your beds and rooms." | "Create Layout" |
| Layout Editor | "Empty canvas" | "Tap a cell to place your first plant or item." | (grid is CTA) |
| Propagation List | "No propagation projects" | "Start tracking a cutting, division, or seed." | "New Propagation" |
| Propagation Detail | (always has content if propagation exists) | n/a | n/a |
| Frost Dates | "Set your zone" | "Enter your USDA zone to see frost dates and planting calendar." | (zone picker is CTA) |
| Harvest Log | "No harvests recorded" | "When your garden produces, log it here." | "Log Harvest" -> harvest/add |
| Log Harvest | (form screen, always has content) | n/a | n/a |
| Wish List (Active) | "Your wish list is empty" | "Save plants you want to acquire someday." | "Add to Wish List" |
| Wish List (Acquired) | "Nothing acquired yet" | "Mark wish list items as acquired when you get them." | (none) |
| Seed Inventory | "No seeds tracked" | "Keep track of your seed packets and their expiry dates." | "Add Seeds" |
| Light Meter | (form screen, always has content) | n/a | n/a |
| Identify Plant | (form screen, always has content) | n/a | n/a |
| Seasonal Care Guide | (always has content: category picker) | n/a | n/a |

### Write-Failure Pattern

| Action Type | Behavior | Error UI |
|-------------|----------|----------|
| Quick actions (Water, Feed, Prune) | **Optimistic:** Update UI immediately, roll back on failure | Error toast: "Couldn't save. Tap to retry." with undo of UI change |
| Form submissions (Add Plant, Log Harvest, Create Zone) | **Pessimistic:** Show inline loading on submit button, wait for DB write | Inline error below form: "Save failed. Check your data and try again." + retry button |
| Batch actions (Water All Overdue) | **Sequential pessimistic:** Progress indicator ("Watering 3 of 8..."), stop on first failure | Error toast naming the failed plant: "Couldn't water Monstera. 5 of 8 completed." |
| Delete actions | **Pessimistic:** Confirm dialog first, then loading, then removal | Error toast: "Couldn't delete. Try again." |

### Partial State Thresholds

| Indicator | Threshold | Display | Location |
|-----------|-----------|---------|----------|
| Overdue watering | `daysOverdue > 0` | Red-tinted row + "X days overdue" badge | Garden Overview, Tasks Queue |
| Seed expiry warning | Expires within 90 days | Orange "!!" badge on seed card | Seed Inventory |
| Diagnosis stale | No treatment note update in 14 days | "Check in on treatment" prompt | Plant Detail tools section |
| Propagation stale | No stage advancement in 21 days | "Time to check on this" badge | Propagation List |
| Season transition | Current month crosses season boundary | "New season" banner with suggested tasks | Tasks Queue |

### First-Run Onboarding

On first module open (zero plants, zero zones, no frost config), replace Garden Overview empty state with an onboarding card:

```
+-----------------------------------+
| Welcome to MyGarden               |
| Set up in 3 quick steps:          |
| 1. Set your frost zone            |  -> frost.tsx
| 2. Create a zone (e.g. 'Living    |  -> zones.tsx (create)
|    Room')                          |
| 3. Add your first plant           |  -> add-plant.tsx
+-----------------------------------+
```

Card dismisses permanently after the user adds their first plant. Uses `setSetting('onboarding_complete', 'true')` to persist.

### Celebration Moments

| Trigger | UI | Timing |
|---------|-----|--------|
| Propagation reaches "potted" stage | Success card: "New plant born from [parent name]!" with confetti icon. Option to create a new plant from propagation. | On `advancePropagationStage(id, 'potted')` |
| Harvest milestones (1st, 10th, 50th, 100th) | Congratulatory toast: "Your 10th harvest! [plant name] is producing well." | On `createHarvest()` when count crosses milestone |
| All tasks complete for the day | "Your garden is happy!" card at top of Tasks Queue with leaf animation | When overdue count = 0 and no pending seasonal tasks for today |

### UI Primitive Map

Cards are reserved for true objects (a plant, a zone, a layout, a propagation). All other surfaces use the appropriate native primitive.

| Screen | Primary Primitive | Cards For |
|--------|------------------|-----------|
| Garden Overview | Card list | Plant cards (object rows) |
| Tasks Queue | Compact swipeable rows | None (checklist with inline completion) |
| Journal | Dated timeline | None (expandable entry rows) |
| More | Icon grid + grouped list rows | None |
| Plant Detail | Scrollable detail sections | Watering info card only (sticky CTA) |
| Add Plant | Form | None |
| Zone Manager | Card list | Zone cards (object rows) |
| Zone Detail | Section groups | None (inline stats, plain plant list) |
| Diagnosis Tool | 3-step flow | Result cards only (diagnosis matches) |
| Diagnosis Detail | Detail sections | None |
| Companion Guide | Search + result list | None (plain rows with relationship badges) |
| Compatibility Checker | Form + result | Result card only |
| Layout List | Card list | Layout cards (object) |
| Layout Editor | Canvas + palette | None (grid is the interaction) |
| Propagation List | Card list | Propagation cards (object with stage bar) |
| Propagation Detail | Detail sections | None |
| Frost Dates | Form + data sections | Phase card only (current frost phase) |
| Harvest Log | Compact rows | None (table-like rows with star ratings) |
| Log Harvest | Form | None |
| Wish List | Grouped card list | Wish list item cards (object) |
| Seed Inventory | Compact rows | None (inline quantity adjusters) |
| Light Meter | Form + result | Classification card only |
| Identify Plant | Form + history | None |
| Seasonal Care Guide | Category picker + task rows | None (plain task rows with action buttons) |

### Quick Action Behavior Table (Plant Detail)

| Action | Creates Entry | Type | Also Calls | UI Pattern |
|--------|--------------|------|------------|------------|
| Water | Yes | `water` | `waterPlant(plantId)` | Optimistic, success toast |
| Feed | Yes | `fertilize` | None | Inline note prompt, then toast |
| Prune | Yes | `prune` | None | Inline note prompt, then toast |
| Harvest | No | n/a | Navigate to `harvest/add` pre-filled with plant | Push screen |
| Photo | Yes | `photo` | Opens `expo-image-picker` camera | Camera capture, then toast |
| Note | Yes | `note` | None | Inline text input modal, then toast |

### Photo Storage

| Aspect | Specification |
|--------|--------------|
| Storage location | `expo-file-system` `documentDirectory` (persists across updates) |
| SQLite reference | File URI stored in `imageUri` column |
| Capture resolution | Max 1024px on long edge |
| Format/quality | JPEG, quality 80% |
| Placeholder (no photo) | Accent-tinted circle (`#22C55E` at 15% opacity) with leaf icon (Lucide `leaf`) |
| Thumbnail size | 48x48, `borderRadius.md` (8px) |
| Hero image (Plant Detail) | Full width, aspect-ratio preserved, max height 240px, `borderRadius.lg` (12px) |
| Cleanup on plant delete | Photos remain on disk (data preserved per module lifecycle). Future: garbage collection sweep. |

---

## Visual Design

### Module Accent
- Primary: `#22C55E` (green-500, module accent)
- Urgency/overdue: `#FF453A` (iOS system red)
- Status badges:
  - Healthy: `#30D158` (iOS green)
  - Needs Attention: `#FF9F0A` (iOS orange)
  - Dormant: `rgba(240,240,245,0.40)` (muted)
  - Dead: `#FF453A` (iOS red)

### Card Style
- Object cards use `glass.card` token (fill + border from DESIGN.md, NOT hardcoded RGBA)
- Urgency cards (overdue watering) use `glass.card` fill + `rgba(255,69,58,0.08)` tint overlay
- Elevated cards (active diagnosis, phase card) use `glass.strong` token
- Plant card thumbnails: 48x48, `borderRadius.md` (8px). See Photo Storage section for placeholder.
- Cards only used for true objects per UI Primitive Map above

### Typography (DESIGN.md Token Mapping)

All text elements reference DESIGN.md typography variants. Do not hardcode sizes.

| Element | DESIGN.md Variant | Notes |
|---------|-------------------|-------|
| Plant name on card | `subheading` (18px/600) | Primary card title |
| Species name | `body` (16px/400) italic | Secondary, `textSecondary` color |
| Section headers | `label` (12px/600 uppercase) | `textTertiary` color |
| Badge text | `iconCaption` (12px/600) | Status badges, counts |
| Stats numbers (harvest total, plant count) | `stat` (36px/700) | Large feature numbers |
| Task row primary text | `body` (16px/400) | `text` color |
| Lux reading value | `heading` (24px/700) | Prominent for scanning |
| Frost countdown days | `stat` (36px/700) | Large countdown number |
| Planting calendar crop name | `subheading` (18px/600) | |
| Quick action button label | `iconCaption` (12px/600) | Below icon |
| Toast message | `caption` (13px/500) | `text` color |

### Animation & Transitions

Per DESIGN.md motion spec. No bouncy animations.

| Interaction | Animation | Duration |
|-------------|-----------|----------|
| Task completion (watering/seasonal) | Slide right + fade out, list collapses upward | 300ms ease-out + 200ms collapse |
| Quick water success | Button shows checkmark, green pulse | 200ms ease-out |
| Card appearance (lists) | Stagger children by 50ms | 200ms per card |
| Batch "Water All" success | Sequential checkmarks, then sweep animation | 150ms per plant |
| Success toast | Slide up from bottom, auto-dismiss | 300ms in, 2000ms visible, 300ms out |
| Propagation stage advance | Stage bar segment fills with accent color | 400ms ease-in-out |
| Page transitions | iOS-native push/pop | 300ms (system default) |

## Accessibility

Per DESIGN.md accessibility requirements:

| Requirement | Specification |
|-------------|--------------|
| Touch targets | 44px minimum on all interactive elements (per iOS HIG) |
| Quick action buttons | 48x48 with `spacing.sm` (8px) gap between |
| Plant card | Full-width tap target, entire row is tappable |
| Color contrast | All text meets WCAG 2.1 AA (4.5:1 body, 3:1 large) |
| VoiceOver (plant card) | "[Plant name], [status], [watering info]. Double tap to open." |
| VoiceOver (task row) | "[Plant name], [days overdue/due info]. Swipe right to complete." |
| VoiceOver (quick actions) | "[Action name] button. Double tap to [action]." |
| Haptics | Light impact on water/complete actions, medium impact on delete confirmation |
| Layout editor grid | Max 6x6 for V1 (62px cells on 375px screen, above 44px minimum) |
| Layout editor zoom | 1x to 2x range, pinch gesture, cells snap to grid |
| Reduce motion | Respect `prefers-reduced-motion`. Replace animations with instant state changes. |
| Focus indicators | 2px accent color (`#22C55E`) outline on focused elements |

### Layout Editor Interaction Model (V1)

- **Grid size:** Max 6x6 cells for V1. Data model supports up to 50x50 for future zoom/pan.
- **Cell size:** Minimum 44px rendered (compliance with touch targets). At 6x6 on 375px screen = ~62px per cell.
- **Placement:** Tap empty cell -> palette appears as bottom sheet -> select item type -> item placed. Multi-cell items: `createLayoutItem()` stores `x`, `y`, `widthCells`, `heightCells`. Renderer merges cells visually.
- **Multi-cell placement:** User selects item from palette with desired size (e.g., "Tomato 2x1"). Tap the top-left cell to place. If insufficient space, show inline error "Not enough room here."
- **Selection:** Tap placed item -> highlight border (`#22C55E` 2px), show floating action bar (Move, Delete). Tap elsewhere to deselect.
- **Zoom:** Pinch 1x-2x range. Pan when zoomed. Cells snap to integer positions.

---

## Function Coverage Map

This table maps every exported function in `modules/garden/src/index.ts` to the screen(s) that consume it.

### V1 CRUD
| Function | Screen(s) |
|----------|-----------|
| `createPlant` | Add Plant |
| `getPlantById` | Plant Detail |
| `getPlants` | Garden Overview, Zone Detail |
| `updatePlant` | Plant Detail (edit) |
| `deletePlant` | Plant Detail (overflow menu) |
| `getPlantCount` | More (garden overview) |
| `waterPlant` | Garden Overview (quick action), Tasks Queue, Plant Detail |
| `createEntry` | Journal (add entry), Plant Detail (quick actions) |
| `getEntriesForPlant` | Plant Detail (care history) |
| `getEntriesByDate` | Journal |
| `deleteEntry` | Journal (swipe delete) |
| `createZone` | Zone Manager (add zone) |
| `getZones` | Zone Manager, Garden Overview (by zone view), Add Plant (zone picker) |
| `deleteZone` | Zone Manager (long press) |
| `createSeed` | Seed Inventory (add) |
| `getSeeds` | Seed Inventory |
| `updateSeedQuantity` | Seed Inventory (+/- buttons) |
| `deleteSeed` | Seed Inventory (long press) |
| `getSetting` | More (preferences) |
| `setSetting` | More (preferences) |
| `getGardenStats` | Garden Overview (stats bar), More (overview) |
| `getWateringSchedule` | Garden Overview (needs water), Tasks Queue |

### V2 CRUD
| Function | Screen(s) |
|----------|-----------|
| `updateZone` | Zone Detail (edit) |
| `getZoneStats` | Zone Manager, Zone Detail |
| `createIdentification` | Identify Plant |
| `getIdentificationsForPlant` | Plant Detail (tools section), Identify Plant (history) |
| `createSeasonalTask` | Seasonal Care Guide ("Add to My Tasks") |
| `completeSeasonalTask` | Tasks Queue |
| `snoozeSeasonalTask` | Tasks Queue |
| `getPendingSeasonalTasks` | Tasks Queue |
| `createHarvest` | Log Harvest |
| `getHarvests` | Harvest Log |
| `getHarvestStats` | Harvest Log (stats), More (overview) |
| `getCropTypes` | Harvest Log (filter chips), Log Harvest (autocomplete) |
| `createDiagnosis` | Diagnosis Tool (save result) |
| `updateDiagnosisStatus` | Diagnosis Detail |
| `getActiveDiagnoses` | Plant Detail (tools count), Diagnosis Tool |
| `getDiagnosisHistory` | Diagnosis Detail, Plant Detail |
| `createWishListItem` | Wish List (add) |
| `getWishList` | Wish List |
| `markWishListAcquired` | Wish List |
| `deleteWishListItem` | Wish List (swipe delete) |
| `createPropagation` | Propagation List (add) |
| `advancePropagationStage` | Propagation Detail |
| `linkPropagationChild` | Propagation Detail (link child) |
| `getActivePropagations` | Propagation List, Plant Detail (tools count) |
| `getPropagationStats` | Propagation List (stats) |
| `createLightReading` | Light Meter |
| `getLightReadingsForZone` | Zone Detail, Light Meter (history) |
| `getZoneAverageLux` | Zone Manager, Zone Detail |
| `createLayout` | Layout List (add) |
| `getLayouts` | Layout List |
| `deleteLayout` | Layout List (long press) |
| `createLayoutItem` | Layout Editor |
| `getLayoutItems` | Layout Editor |
| `deleteLayoutItem` | Layout Editor |
| `getFrostConfig` | Frost Dates, More |
| `setFrostConfig` | Frost Dates |

### Engines
| Function | Screen(s) |
|----------|-----------|
| `calculateNextWaterDate` | Plant Detail, Tasks Queue |
| `isDaysOverdue` | Garden Overview, Tasks Queue |
| `getSeason` | Tasks Queue, Seasonal Care Guide |
| `adjustFrequencyForSeason` | Plant Detail (seasonal note) |
| `calculateSurvivalRate` | Garden Overview (stats bar), More |
| `calculateGDD` | (Available for future weather integration) |
| `checkCompatibility` | Compatibility Checker |
| `getCompanions` | Companion Guide |
| `getAntagonists` | Companion Guide |
| `searchCompanionPlants` | Companion Guide (search) |
| `getAllCompanionPlants` | Companion Guide (browse) |
| `matchSymptoms` | Diagnosis Tool |
| `getAllSymptoms` | Diagnosis Tool (symptom picker) |
| `classifyLight` | Light Meter (real-time classification) |
| `lightLevelDescription` | Light Meter (guide), Zone Detail |
| `averageLux` | Zone Manager, Zone Detail |
| `isValidStageTransition` | Propagation Detail (validate) |
| `getNextStages` | Propagation Detail (advancement buttons) |
| `calculateSuccessRate` | Propagation List (stats) |
| `getSeasonalTasksForCategory` | Seasonal Care Guide |
| `getPlantCategories` | Seasonal Care Guide (category picker) |
| `inferCategory` | Tasks Queue (auto-suggest seasonal tasks based on plant species) |
| `lookupZone` | Frost Dates |
| `calculateCountdown` | Frost Dates |
| `getCurrentFrostPhase` | Frost Dates |
| `getPlantingCalendar` | Frost Dates (crop calendar) |

**Coverage: 80/80+ exported functions are mapped to at least one screen.** `calculateGDD` is the only function without a direct screen consumer (reserved for future weather/temperature integration).

---

## Acceptance Criteria

### Navigation & Structure
- [ ] **AC-1:** 4-tab navigation renders (Garden, Tasks, Journal, More)
- [ ] **AC-2:** All 20+ stack screens are reachable from tab screens
- [ ] **AC-3:** Back navigation works correctly from every stack screen
- [ ] **AC-4:** Module accent color `#22C55E` used consistently across all screens

### Garden Overview
- [ ] **AC-5:** Plant list renders with photo, name, zone, and watering status
- [ ] **AC-6:** Quick water button on plant card calls `waterPlant()` and shows success toast
- [ ] **AC-7:** "Needs Water" segment shows overdue plants sorted by urgency
- [ ] **AC-8:** "By Zone" segment groups plants under zone headers
- [ ] **AC-9:** Stats bar shows total plants, overdue count, and thriving count (not survival %)
- [ ] **AC-44:** Smart default: "Needs Water" segment active when overdueCount > 0
- [ ] **AC-45:** "Water All Overdue" batch action waters all overdue plants in sequence
- [ ] **AC-46:** First-run onboarding card shows 3-step setup when zero plants exist

### Plant Detail
- [ ] **AC-10:** Plant detail shows photo, species, zone, location, status, watering info
- [ ] **AC-11:** Quick action grid (6 actions) creates journal entries
- [ ] **AC-12:** Care history shows last 5 entries with "View All" link
- [ ] **AC-13:** Tools section shows diagnosis, companion, propagation, harvest, ID counts

### Tasks Queue
- [ ] **AC-14:** Overdue watering tasks appear in red-tinted section
- [ ] **AC-15:** Completing a watering task calls `waterPlant()` and animates removal
- [ ] **AC-16:** Seasonal tasks show with complete and snooze buttons
- [ ] **AC-17:** Completing seasonal task calls `completeSeasonalTask()` and removes it

### Journal
- [ ] **AC-18:** Journal shows entries grouped by date, newest first
- [ ] **AC-19:** Filter chips filter by care action type
- [ ] **AC-20:** Add entry form allows selecting plant, action, notes, photo

### Diagnosis Tool
- [ ] **AC-21:** Symptom picker shows all symptoms from `getAllSymptoms()` grouped by category
- [ ] **AC-22:** "Diagnose" button runs `matchSymptoms()` and shows ranked results
- [ ] **AC-23:** "Save Diagnosis" persists the diagnosis with severity and treatment notes

### Companion Planting
- [ ] **AC-24:** Search bar searches companion database with `searchCompanionPlants()`
- [ ] **AC-25:** Selecting a plant shows companions (green) and antagonists (red)
- [ ] **AC-26:** Compatibility checker shows relationship for any two plants

### Layout Editor
- [ ] **AC-27:** Grid renders at configured dimensions (widthCells x heightCells)
- [ ] **AC-28:** User can place items on grid cells from the palette
- [ ] **AC-29:** Placed items persist via `createLayoutItem()` / `getLayoutItems()`

### Propagation
- [ ] **AC-30:** Active propagations show stage progress bar
- [ ] **AC-31:** Stage advancement validates via `isValidStageTransition()` before proceeding
- [ ] **AC-32:** Stats show total/success/failed counts with success rate

### Frost Dates
- [ ] **AC-33:** USDA zone picker auto-fills frost dates from `lookupZone()`
- [ ] **AC-34:** Current frost phase badge and countdown render correctly
- [ ] **AC-35:** Planting calendar shows 15 crops with dates relative to frost dates

### Supporting Screens
- [ ] **AC-36:** Harvest log shows all harvests with stats (total qty, count, top producer)
- [ ] **AC-37:** Wish list sorted by priority with "Mark Acquired" -> create plant flow
- [ ] **AC-38:** Seed inventory shows quantity adjusters and expiry warnings
- [ ] **AC-39:** Light meter classifies lux in real-time and saves readings to zones
- [ ] **AC-40:** Plant identification saves results linked to plants
- [ ] **AC-41:** Seasonal care guide shows tasks by category and season with "Add to My Tasks"

### State Coverage
- [ ] **AC-42:** Every screen handles loading, empty, error, success, and partial states
- [ ] **AC-43:** Empty states match per-screen copy from the Empty States table
- [ ] **AC-47:** Write-failure pattern follows optimistic/pessimistic rules from Write-Failure table
- [ ] **AC-48:** Partial state thresholds (seed expiry 90d, diagnosis stale 14d, propagation stale 21d) trigger badges

### Accessibility
- [ ] **AC-49:** All touch targets meet 44px minimum
- [ ] **AC-50:** Layout editor grid capped at 6x6 (62px+ cells)
- [ ] **AC-51:** VoiceOver labels on plant cards include name, status, and watering info
- [ ] **AC-52:** Haptic feedback on water/complete/delete actions
- [ ] **AC-53:** `prefers-reduced-motion` respected (instant state changes)

---

## Test Requirements

Business logic is fully tested (41 tests across 4 files, all passing). The following component tests cover the 8 most complex screens:

### Critical Screen Tests

| Screen | Test File | Tests |
|--------|-----------|-------|
| Garden Overview | `__tests__/garden-overview.test.tsx` | Smart default segment (Needs Water when overdue > 0, All otherwise); batch Water All Overdue (sequential success, mid-batch failure); search filter by name/species; empty state with onboarding card |
| Plant Detail | `__tests__/plant-detail.test.tsx` | Quick action behavior for all 6 actions (Water=optimistic+toast, Feed=note prompt, Harvest=push screen, Photo=camera, Note=modal); care history renders last 5 entries; tools section counts |
| Tasks Queue | `__tests__/tasks-queue.test.tsx` | Watering task completion calls `waterPlant()` and removes row; seasonal task snooze calls `snoozeSeasonalTask()`; segment views (Today/This Week/Seasonal); empty state |
| Journal | `__tests__/journal.test.tsx` | Date grouping (entries grouped by day); filter chips filter by action type; add entry via + button |
| More | `__tests__/more.test.tsx` | Tools grid renders 11 items; each tool navigates to correct screen; preferences persist via `setSetting()` |
| Add Plant | `__tests__/add-plant.test.tsx` | Name required validation; zone picker shows existing zones; save calls `createPlant()` and navigates back |
| Diagnosis Tool | `__tests__/diagnose.test.tsx` | Symptom chip selection; Diagnose button disabled with 0 symptoms; `matchSymptoms()` results render ranked; Save Diagnosis persists |
| Layout Editor | `__tests__/layout-editor.test.tsx` | 6x6 grid renders; tap-to-place via palette; multi-cell item placement; placed items persist via `createLayoutItem()`; insufficient space error |

### Batch Water Clarification

"Water All Overdue" behavior on partial failure: successfully watered plants remain watered (each `waterPlant()` is an independent transaction). The batch stops at the first failure. The error toast names the failed plant and shows how many succeeded (e.g., "Couldn't water Monstera. 5 of 8 completed."). No rollback of successful waterings.

---

## Handoff State

### Before This Work
- Garden module has 80+ functions across V1/V2 CRUD, 7 engines, 16 tables
- Module definition declares 4 tabs and 14 stack screens in navigation config
- Mobile has 1 placeholder screen
- No UI for diagnosis, companion planting, layouts, propagation, frost, harvests, wish list, seeds, light meter, identification, or seasonal care

### After This Work
- Full 24-screen mobile experience covering every module capability
- 4-tab navigation: Garden (plant list), Tasks (unified queue), Journal (care log), More (tools + preferences)
- 20 stack screens for plant detail, zones, diagnosis, companions, layouts, propagation, frost, harvests, wish list, seeds, light meter, identification, seasonal care
- Smart default segments, batch watering, per-screen empty states, accessibility specs
- Every exported function mapped to at least one screen
- All 5 UI states (loading/empty/error/success/partial) specified per screen
- Cool Obsidian theme with module accent `#22C55E` throughout

### Screen Count Summary
| Category | Screens | Names |
|----------|---------|-------|
| Tab screens | 4 | Garden Overview, Tasks Queue, Journal, More |
| Plant management | 3 | Plant Detail, Add Plant, Identify Plant |
| Zone management | 3 | Zone Manager, Zone Detail, Light Meter |
| Health & diagnosis | 3 | Diagnosis Tool, Diagnosis Detail, Seasonal Care Guide |
| Companion & layout | 4 | Companion Guide, Compatibility Checker, Layout List, Layout Editor |
| Propagation | 2 | Propagation List, Propagation Detail |
| Harvest & inventory | 4 | Harvest Log, Log Harvest, Wish List, Seed Inventory |
| Frost & calendar | 1 | Frost Dates & Planting Calendar |
| **Total** | **24** | |

### Files to Create/Modify
```
apps/mobile/app/(garden)/
  _layout.tsx                -- Tab navigator (4 tabs + 20 stack screens)
  index.tsx                  -- Garden Overview (replace placeholder)
  tasks.tsx                  -- Tasks Queue
  journal.tsx                -- Journal
  more.tsx                   -- More (tools + preferences)
  plant/[id].tsx             -- Plant Detail
  add-plant.tsx              -- Add Plant
  zone/[id].tsx              -- Zone Detail
  zones.tsx                  -- Zone Manager
  diagnose.tsx               -- Diagnosis Tool
  diagnosis/[id].tsx         -- Diagnosis Detail
  companions.tsx             -- Companion Planting Guide
  companion-check.tsx        -- Compatibility Checker
  layout/[id].tsx            -- Layout Editor
  layouts.tsx                -- Layout List
  propagation/[id].tsx       -- Propagation Detail
  propagations.tsx           -- Propagation List
  frost.tsx                  -- Frost Dates & Planting Calendar
  harvests.tsx               -- Harvest Log
  harvest/add.tsx            -- Log Harvest
  wishlist.tsx               -- Wish List
  seeds.tsx                  -- Seed Inventory
  light-meter.tsx            -- Light Meter
  identify.tsx               -- Identify Plant
  seasonal.tsx               -- Seasonal Care Guide
```

### Known Limitations
- **No camera-based plant ID in V1:** Identification screen stores manual results. On-device ML identification (like PictureThis) is a future enhancement.
- **Layout editor: multi-cell tap-to-place, max 6x6:** V1 supports multi-cell items via tap placement. Grid capped at 6x6 for touch target compliance. Data model supports up to 50x50 for future zoom/pan expansion.
- **No push notifications:** Watering reminders and frost alerts will need expo-notifications integration (future feature).
- **No weather integration:** `calculateGDD()` engine is ready but needs a temperature data source (future).
- **Light meter is manual entry:** No phone sensor integration for automatic lux reading (future enhancement using `expo-sensors`).

---

## Design Review Notes

### NOT in Scope (Considered and Deferred)
- **Gamification / streaks:** Planta and Greg use streak mechanics. Deferred because MyGarden's identity is "calm tool, not social game."
- **Social / sharing:** No plant photo sharing, community features, or leaderboards. Privacy-first.
- **Drag-and-drop layout editor:** V1 uses tap-to-place. Full drag-and-drop deferred to V2.
- **Automatic lux sensor:** Phone ambient light sensor for automatic readings deferred (expo-sensors integration).
- **Background tile download or cloud sync:** All data stays local. No sync features in scope.

### What Already Exists (Reuse These)
- `ModuleErrorBoundary` component from recipes module
- `BackToHubButton` component for header navigation
- Glass card, button, empty state, loading skeleton, and error state patterns in DESIGN.md
- Tab layout pattern from `apps/mobile/app/(recipes)/_layout.tsx`
- Module accent color `#22C55E` already assigned in `packages/ui/src/tokens/colors.ts`
- `expo-blur` BlurView for mobile glass morphism (existing pattern)
- `expo-image-picker` already used in other modules

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | -- | -- |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | -- | -- |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 1 issue (migration prereq), 0 critical gaps, 8 screen tests added |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR | score: 7/10 -> 9/10, 15 decisions made |

- **OUTSIDE VOICES:** Codex hard-rejected card-first design (hard rejection #7). Claude subagent identified 10 priority fixes. Both converged on Settings-as-tool-dump, no visual anchor, card overuse.
- **UNRESOLVED:** 0 decisions unresolved
- **VERDICT:** ENG + DESIGN CLEARED -- ready to implement after fixing garden migration P0 bug.
