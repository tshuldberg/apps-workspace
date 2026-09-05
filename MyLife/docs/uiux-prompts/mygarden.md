# MyGarden -- UI/UX Design Prompts

**Tagline:** Grow with confidence
**Icon:** 🌱 | **Accent:** #84CC16 | **Tier:** Premium
**Bottom Tabs:** Home | Plants | Watering | Tasks | Settings

---

## Prompt 1 of 3 -- Mobile Screens 1-12

```
Design system: Cool Obsidian (dark theme -- #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

App: MyGarden
Accent color: #84CC16 (lime green)
Platform: iOS mobile (Expo/React Native)
Bottom tab bar: Home | Plants | Watering | Tasks | Settings

Design the following 12 screens:

1. HOME (index.tsx)
- Header: "MyGarden" with leaf icon
- Stats summary row: 4 glass surface cards in horizontal scroll
  - Active Plants: count with plant icon
  - Overdue Watering: count with red alert badge and water drop icon
  - Harvest Ready: count with basket icon
  - Total Harvests: lifetime count with checkmark icon
- Garden stats card: oldest plant (name + age), total species count, garden age
- Overdue watering alert banner: red-tinted glass card if any plants overdue, "Water Now" quick action
- Quick action buttons row: "Add Plant", "Log Watering", "Add Task", "Log Harvest"
- Recent activity feed: last 5 garden events (watered, harvested, added plant, completed task) with timestamps
- Empty state: "Start your garden! Add your first plant." with illustration

2. PLANTS (plants.tsx)
- Header: "My Plants" with count badge
- Search bar at top
- Filter chips: All | Needs Attention | Healthy | By Zone
- Plant inventory grid: 2-column card layout
  - Each card: photo thumbnail (or placeholder plant icon), species name (bold), variety name (smaller), zone badge (colored chip), health status indicator dot (green=healthy, yellow=needs attention, red=critical)
- Sort options: by name, by date added, by zone, by health status
- "Add Plant" FAB button at bottom-right, accent-colored
- Empty state: "No plants yet. Tap + to add your first plant."

3. ADD PLANT (plant/add.tsx)
- Header: "Add Plant"
- Species search/picker: searchable dropdown with common plant database
- Variety: text input
- Planting date: date picker, default today
- Zone assignment: picker showing existing zones + "New Zone" option
- Soil type: picker (Loam / Clay / Sandy / Silt / Peat / Chalk)
- Sun requirement: segmented control (Full Sun / Partial Sun / Partial Shade / Full Shade)
- Spacing: numeric input with unit (inches or cm)
- Expected harvest date: date picker (optional, auto-calculated if species known)
- Photo: camera/gallery picker, thumbnail preview
- Watering interval: "Water every X days" stepper
- Notes: multi-line text input
- "Save Plant" button, accent-colored, full width

4. PLANT DETAIL (plant/[id].tsx)
- Header: plant species name with variety subtitle
- Photo: large hero image (or placeholder), tap to view full screen
- Health status badge: Healthy (green) / Needs Attention (yellow) / Critical (red)
- Care schedule card:
  - Watering: "Every X days" with next due date, days until next watering
  - Fertilizing: schedule and next due date
  - Pruning: schedule and next due date
- Growth log: chronological entry list (date, note, photo thumbnail), "Add Entry" button
- Watering history chart: bar chart showing watering events over last 30 days
- Plant info card: zone, soil type, sun requirement, spacing, planting date, age
- Action buttons: "Edit Plant", "Archive" (muted), "Delete" (danger red)

5. WATERING (watering.tsx)
- Header: "Watering Schedule" with today's date
- 3 status sections with colored headers:
  - Overdue (red header): plants past their watering date, each row: plant name, days overdue, zone badge, checkbox to mark watered
  - Due Today (yellow/accent header): plants needing water today, same row format
  - Upcoming (green header): plants due in next 3 days, row shows days until due
- Each row: plant photo thumbnail, species name, zone badge, last watered date, checkbox
- "Water All Due" bulk action button at top (waters all overdue + due today)
- Watered confirmation toast: "Watered! Next due in X days"
- Calendar view toggle: switch to calendar showing watering events on date grid

6. GARDEN LAYOUT (layout.tsx)
- Header: "Garden Layout"
- Visual garden bed planner: top-down grid view
  - Drag-and-drop plant icons onto grid cells
  - Bed dimensions: width x height input, adjustable grid size
  - Spacing guides: grid lines showing recommended plant spacing
  - Companion planting warnings: red outline on adjacent incompatible plants, green outline on compatible pairs
- Bed selector: tabs or dropdown for multiple garden beds
- Plant palette sidebar: scrollable list of user's plants, drag from palette to grid
- Zoom in/out controls
- "Add New Bed" button
- Legend: icon meanings for companion planting indicators

7. HARVEST (harvest.tsx)
- Header: "Harvest Log"
- "Log Harvest" button at top
- Log harvest form (inline or modal):
  - Plant picker: dropdown of user's plants
  - Quantity: numeric input with unit toggle (weight lbs/kg or count)
  - Date: date picker, default today
  - Quality rating: 5-star rating
  - Photo: camera/gallery picker
  - Notes: text input
- Harvest history list: grouped by plant, each entry shows date, quantity, quality stars, photo thumbnail
- Running totals per plant: total weight/count harvested
- Seasonal summary card: this month's total harvests, top producing plant

8. ZONES (zones.tsx)
- Header: "Garden Zones"
- Zone list: each zone as a glass surface card
  - Zone name (editable)
  - Type badge: Raised Bed / In-Ground / Container / Indoor / Greenhouse
  - Sun exposure: Full Sun / Partial Sun / Partial Shade / Full Shade
  - Soil type label
  - Plants assigned: count with "View" link
  - Thumbnail grid of plant photos in this zone
- "Add Zone" button at top
- Add zone form: name input, type picker, sun exposure picker, soil type picker
- Tap zone card to see full plant list for that zone

9. COMPANION PLANTING (companions.tsx)
- Header: "Companion Planting"
- Plant pair lookup: two search/picker dropdowns ("Plant A" and "Plant B"), "Check Compatibility" button
- Result display: large icon -- green checkmark (compatible), red X (incompatible), grey dash (neutral)
- Compatibility description: text explaining why (e.g. "Tomatoes and basil: basil repels pests that attack tomatoes")
- Compatible pairs list: scrollable list of known good companions, each row: Plant A icon + Plant B icon, green indicator, brief reason
- Incompatible pairs list: same format with red indicators
- Planting suggestions card: "Based on your garden, consider adding [plant] near your [plant]"
- Search/filter bar at top

10. TASKS (tasks.tsx)
- Header: "Garden Tasks"
- Filter tabs: All | Overdue | Today | Upcoming | Completed
- Task list: each row:
  - Task type icon and colored badge: Prune (scissors) / Fertilize (droplet) / Transplant (arrow) / Pest Control (bug) / Harvest (basket) / Mulch (layer) / Weed (leaf) / Water (water) / Other (star)
  - Task description
  - Due date (red if overdue)
  - Plant reference (linked plant name)
  - Priority indicator: High (red dot) / Medium (yellow dot) / Low (green dot)
  - Checkbox to mark complete
- "Add Task" FAB button
- Add task form: type picker, description, due date, plant picker (optional), priority picker
- Completed tasks at bottom with strikethrough

11. SEASONAL CALENDAR (calendar.tsx)
- Header: "Planting Calendar"
- Region setup: USDA zone picker at top, hemisphere toggle (Northern / Southern)
- Month-by-month grid: 12 columns (Jan-Dec), rows for each plantable crop
  - Color-coded cells: green = plant/sow, blue = transplant, orange = harvest, grey = dormant
  - Legend at bottom explaining colors
- Current month highlighted with accent border
- Crop filter: search bar to filter visible crops
- "What to do this month" summary card: list of actions for current month based on zone
- Tap cell for detail: planting tips for that crop in that month

12. DIAGNOSE (diagnose.tsx)
- Header: "Plant Diagnosis"
- Photo upload area: large dashed-border zone with camera icon, "Take Photo" and "Choose from Gallery" buttons
- Plant selector: dropdown to specify which plant (optional, helps accuracy)
- "Diagnose" button, accent-colored
- Results view (after analysis):
  - Identified issue: disease/pest name with confidence percentage
  - Severity indicator: Mild / Moderate / Severe with color coding
  - Description: what the issue is
  - Treatment recommendations: numbered list of steps
  - Prevention tips: how to avoid in the future
  - "Save to Plant Log" button to add diagnosis to plant's growth log
- Recent diagnoses list below
```

---

## Prompt 2 of 3 -- Mobile Screens 13-22

```
Design system: Cool Obsidian (dark theme -- #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

App: MyGarden
Accent color: #84CC16 (lime green)
Platform: iOS mobile (Expo/React Native)
Bottom tab bar: Home | Plants | Watering | Tasks | Settings

Design the following 10 screens:

13. WEATHER (weather.tsx)
- Header: "Garden Weather"
- Current conditions card: temperature (large), weather icon (sun/cloud/rain), humidity %, wind speed, "feels like" temp
- 7-day forecast: horizontal scrollable day cards, each with day name, weather icon, high/low temp, rain probability %
- Garden alerts section:
  - Frost warning: red alert card if frost expected within 7 days, date and expected low temp
  - Heavy rain: blue alert card, expected rainfall amount
  - Extreme heat: orange alert card, heat advisory details
- Garden planning advice card: AI-generated tip based on forecast (e.g. "Rain expected Thursday -- skip watering Wednesday", "Frost warning Friday -- cover tender plants")
- Location display: city name, "Change Location" link
- Sunrise/sunset times

14. WISHLIST (wishlist.tsx)
- Header: "Plant Wishlist"
- Wishlist entries in a card list:
  - Species name (bold)
  - Source: Nursery name / Seed Catalog / Trade / Online
  - Priority: High / Medium / Low (colored dot)
  - Notes: brief text
  - "Added" checkbox to mark as acquired (moves to "Acquired" section)
- "Add to Wishlist" button at top
- Add form: species name, source picker, priority picker, notes text input
- Acquired section at bottom: previously wishlisted plants now in garden
- Sort: by priority, by date added, by name

15. SEED LIBRARY (seeds.tsx)
- Header: "Seed Library"
- Seed inventory list:
  - Each row: species name, variety, quantity display (packet count or weight), purchase/harvest date
  - Viability indicator: germination rate percentage with color (green >80%, yellow 50-80%, red <50%)
  - Storage location label
- "Add Seeds" button at top
- Add seed form: species, variety, quantity, source (purchased/saved), date, storage location, germination rate (if tested)
- Expiring seeds alert: seeds approaching low viability highlighted with yellow badge
- Filter: by species, by viability, by storage location
- Total seed count and species count summary

16. PHOTOS (photos.tsx)
- Header: "Garden Photos"
- Photo grid: 3-column masonry layout of garden photos
- Each photo: thumbnail, date stamp overlay, plant tag (if linked to a plant)
- Filter: by plant, by date range, by zone
- Before/after comparisons: paired photo view showing same plant/area at two different dates, side-by-side layout
- "Add Photo" button: camera or gallery, with plant tag picker and date
- Tap photo for full-screen view with pinch-to-zoom
- Photo count: "X photos in your garden journal"

17. PROPAGATION (propagation.tsx)
- Header: "Propagation Tracker"
- Active propagation list:
  - Each card: parent plant name, method badge (Cutting / Division / Seed / Layering), start date, status badge (Rooting / Growing / Established / Failed)
  - Days since start
  - Photo thumbnail
- "New Propagation" button at top
- Add form: parent plant picker, method picker (Cutting / Division / Seed / Layering), start date, notes, photo
- Status update: tap card to update status, add notes, add photos
- Success rate stats: overall success rate percentage, rate by method
- Completed propagations section: successfully established plants with "Add to Garden" button

18. LIGHT LEVELS (light.tsx)
- Header: "Light Levels"
- Zone-by-zone light assessment:
  - Each zone card: zone name, light level badge (Full Sun / Partial Sun / Partial Shade / Full Shade)
  - Hours of direct light: numeric display
  - Seasonal variation note: "Summer: 8 hrs, Winter: 4 hrs"
  - Plant compatibility: list of plants in this zone with light requirement match indicator (green check = matched, yellow warning = suboptimal)
- "Assess Light" button per zone: opens guide for measuring light (place phone in zone, timer, or manual entry)
- Light requirement reference chart: what each level means in hours
- Suggestions card: "Consider moving [plant] from [zone] to [zone] for better light"

19. FROST DATES (frost.tsx)
- Header: "Frost Dates"
- Region display: city/zip code, USDA zone
- First frost date: large date display with "X days away" countdown, autumn/fall context
- Last frost date: large date display with "X days since" or "X days until" counter, spring context
- Historical average card: average first and last frost dates for region
- Frost alert toggle: enable/disable frost notifications
- Frost-free growing season: calculated number of days between last spring frost and first fall frost
- Planting timeline: visual bar showing safe outdoor planting window
- "Change Region" button

20. JOURNAL (journal.tsx)
- Header: "Garden Journal"
- Journal entry list: reverse chronological
  - Each entry card: date, text preview (2-3 lines), linked plant tags (colored chips), photo thumbnails (horizontal scroll if multiple), weather icon for that day
- "New Entry" button at top
- New entry form: rich text area, plant tag multi-select, photo attachment (multiple), auto-captured weather at time of entry
- Search bar: full-text search across journal entries
- Filter: by plant, by date range, by weather condition
- Monthly summary view toggle: aggregated entries by month

21. EXPORT (export.tsx)
- Header: "Export Data"
- Data categories with checkboxes:
  - Plants (species, variety, zone, dates, care schedules)
  - Harvest Log (plant, quantity, dates, quality)
  - Tasks (type, description, dates, status)
  - Watering Log (plant, dates, amounts)
  - Journal Entries (dates, text, plant references)
  - Zones (name, type, conditions)
- Date range: start and end date pickers
- Export format: CSV
- "Export" button: generates file and opens system share sheet
- Export preview: sample of data to be exported
- Export history: previous exports with date and size

22. SETTINGS (settings.tsx)
- Header: "Settings"
- Climate zone: USDA zone picker (1a through 13b), with "Detect from location" option
- Hemisphere: Northern / Southern toggle
- Notifications section:
  - Watering reminders: toggle, time picker for daily check
  - Frost alerts: toggle
  - Task reminders: toggle, days before due
- Units: Metric / Imperial toggle (affects temperature, weight, distance)
- Default soil type: picker for new plants
- Default sun exposure: picker for new plants
- Data management: "Export Data", "Clear All Data" (danger with confirmation)
- About: version, privacy policy link
```

---

## Prompt 3 of 3 -- Web Pages

```
Design system: Cool Obsidian (dark theme -- #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

App: MyGarden
Accent color: #84CC16 (lime green)
Platform: Web (Next.js 15, desktop-optimized)
Layout: Persistent left sidebar with module navigation

Design the following 15 web pages:

W1. DASHBOARD (/garden)
- Left sidebar: module navigation with icons
- Main content: 3-column layout
  - Left column: stats summary cards (active plants, overdue watering, harvest-ready, total harvests), quick action buttons
  - Center column: today's watering schedule (overdue + due today lists with checkboxes), recent activity feed
  - Right column: weather card (current + 3-day forecast), garden alerts (frost/rain), upcoming tasks
- Top bar: "Add Plant" and "Log Watering" action buttons

W2. PLANTS (/garden/plants)
- Full-width responsive grid: 3-4 column plant cards on desktop
- Each card: large photo, species/variety, zone badge, health indicator, last watered, quick water button
- Sidebar filter panel: search, zone filter, health status filter, sort options
- Bulk actions toolbar: select multiple, bulk water, bulk edit zone

W3. PLANT DETAIL (/garden/plants/[id])
- Two-column layout:
  - Left: large photo, plant info (zone, soil, sun, spacing, dates), care schedule, action buttons
  - Right: growth log timeline, watering history chart, harvest log for this plant
- Inline editing for all fields
- Photo gallery with upload

W4. WATERING (/garden/watering)
- Three-panel layout: Overdue | Due Today | Upcoming
- Each panel: plant list with checkboxes, last watered date, days info
- "Water All Due" bulk button
- Calendar view tab: monthly calendar with watering events marked
- Watering history table: sortable by plant, date

W5. TASKS (/garden/tasks)
- Table view with sortable columns: task type, description, plant, due date, priority, status
- Filter bar: type, priority, status, plant, date range
- Kanban view toggle: columns for Overdue, Today, This Week, Later, Completed
- Add task inline or via modal
- Drag to reorder priority

W6. HARVEST (/garden/harvest)
- Two-panel layout:
  - Left: harvest log table (plant, quantity, date, quality, notes), sortable and filterable
  - Right: harvest analytics (totals per plant bar chart, seasonal trend line, top producer)
- "Log Harvest" form at top or modal
- Photo gallery of harvests

W7. ZONES (/garden/zones)
- Zone cards in responsive grid
- Each card: zone name, type, sun exposure, soil, plant count, mini photo grid of plants
- Click card to expand: full plant list, edit zone settings, light level assessment
- "Add Zone" button
- Zone comparison table: side-by-side zone stats

W8. GARDEN LAYOUT (/garden/layout)
- Full-width interactive garden bed planner
- Desktop-optimized drag-and-drop with mouse
- Left sidebar: plant palette (draggable plant cards)
- Main area: grid-based bed layout, zoom controls, pan with mouse drag
- Right sidebar: selected plant info, companion planting status
- Multiple beds with tab navigation
- Print/export layout as image

W9. COMPANION PLANTING (/garden/companions)
- Two-panel layout:
  - Left: plant pair lookup (two dropdowns + check button), result display
  - Right: full compatibility matrix table (plants on both axes, green/red/grey cells)
- Search and filter
- Suggestions based on user's current garden

W10. SEASONAL CALENDAR (/garden/calendar)
- Full-width 12-month grid: crops on rows, months on columns
- Color-coded cells (plant/transplant/harvest/dormant)
- Zone and hemisphere selectors at top
- Current month highlighted
- Click cell for planting tips modal
- "This Month" summary sidebar

W11. DIAGNOSE (/garden/diagnose)
- Centered layout
- Photo upload area (drag-and-drop on desktop)
- Plant selector dropdown
- Results panel: identified issue, severity, treatment steps, prevention
- Diagnosis history: past diagnoses in a table with plant, issue, date, severity

W12. PHOTOS (/garden/photos)
- Full-width masonry photo grid (4-5 columns on desktop)
- Filter sidebar: plant, date range, zone
- Lightbox viewer on click: full-size with navigation arrows
- Before/after comparison tool: side-by-side slider
- Upload: drag-and-drop multiple photos

W13. JOURNAL (/garden/journal)
- Two-panel layout:
  - Left: entry list (scrollable, date + preview + plant tags)
  - Right: selected entry full view with text, photos, linked plants, weather
- New entry editor: rich text, plant tags, photo upload, weather auto-fill
- Search and filter bar

W14. WEATHER (/garden/weather)
- Wide weather dashboard
- Current conditions: large card with temp, icon, humidity, wind
- 7-day forecast: daily cards in a row
- Garden alerts panel: frost, rain, heat warnings
- Planning advice card
- Historical weather data chart for the season

W15. SETTINGS (/garden/settings)
- Standard settings form, two-column layout
- Left: climate zone, hemisphere, units, defaults
- Right: notifications (watering, frost, tasks), data management (export/clear)
- Save button
```
