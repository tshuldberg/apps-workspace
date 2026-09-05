# MyTrails -- UI/UX Design Prompts

**Tagline:** Offline hiking and trail guide
**Icon:** 🥾 | **Accent:** #65A30D | **Tier:** Premium
**Bottom Tabs:** Home | Trails | Record | Packing | Settings
**Total Screens:** 21 mobile + 11 web = 32

---

## Prompt 1 of 2 -- Screens 1-12 (Mobile)

```
Design system: Cool Obsidian (dark theme -- #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

App: MyTrails
Tagline: Offline hiking and trail guide
Icon: 🥾
Accent color: #65A30D
Platform: iOS (mobile)
Bottom tabs: Home | Trails | Record | Packing | Settings

Design 12 mobile screens:

1. HOME (index.tsx)
- Bottom tab bar with Home (active, #65A30D accent), Trails, Record, Packing, Settings
- Mini-map card at top (glass card, 180pt height):
  - Map showing nearby trails or last recorded route
  - Tap to expand to full map view
- Quick stats row (glass cards, 2x2 grid):
  - Total recordings (number + "hikes" label)
  - Total distance (number + unit)
  - Total elevation gain (number + unit, mountain icon)
  - Average pace (number + unit/distance)
- "Recent Recordings" section header
- Recent trail recordings list (glass card rows):
  - Activity type icon (hike/run/bike)
  - Trail/route name (#F0F0F5 bold)
  - Date (#F0F0F5 at 65% opacity)
  - Distance and duration compact row
  - Small map thumbnail (right side)

2. TRAILS (trails.tsx)
- Bottom tab: Trails (active, #65A30D)
- Search bar: "Search trails..."
- Filter row (horizontal scroll pills):
  - Difficulty: All | Easy | Moderate | Hard | Expert
  - Activity: All | Hike | Run | Bike
  - Region filter
  - Sort by: Distance | Elevation | Rating | Name
- Trail list, each as a glass card:
  - Trail name (#F0F0F5 bold)
  - Distance and elevation gain row
  - Difficulty badge: color-coded pill (Easy = #30D158, Moderate = #65A30D, Hard = #EAB308, Expert = #FF453A)
  - Activity type badge (outline pill)
  - Star rating (1-5, #EAB308)
  - Mini-map thumbnail (right side)

3. RECORDINGS (recordings.tsx)
- Header: "Recordings"
- GPS recording list, each as a glass card:
  - Activity type badge (hike/run/bike): color-coded icon
  - Route name or "Untitled Recording" (#F0F0F5 bold)
  - Date (#F0F0F5 at 65% opacity)
  - Stats row: distance, duration, elevation gain (with up-arrow icon)
  - Map thumbnail: mini trail map (right side, 80x80)
- Sort: by date (newest first), with option for distance/duration
- Empty state: boot illustration with "No recordings yet"

4. ELEVATION PROFILE (elevation-profile.tsx)
- Header: "Elevation" with back arrow
- Animated elevation graph (glass card, full width):
  - X-axis: distance
  - Y-axis: elevation
  - Line: #65A30D with gradient fill below
  - Scrubber: drag along graph to see elevation at any point
- Stats cards below (glass cards, row):
  - Elevation gain: number with up-arrow icon (#30D158)
  - Elevation loss: number with down-arrow icon (#FF453A)
  - Min elevation
  - Max elevation
- Map view below: route colored by elevation gradient (low = blue, high = red)

5. OFFLINE REGIONS (offline-regions.tsx)
- Header: "Offline Maps"
- Region selector: map view with draggable selection rectangle
- Downloaded regions list, each as a glass card:
  - Region name (#F0F0F5 bold)
  - Storage size (e.g., "124 MB")
  - Download date (#F0F0F5 at 65% opacity)
  - Delete button (trash icon, #FF453A)
- Download progress: progress bar (#65A30D fill) for active downloads
- Storage summary at top: "Using 340 MB of offline maps"
- "Download Region" button (#65A30D): opens region selection on map

6. ALERT SETTINGS (alert-settings.tsx)
- Header: "Trail Alerts"
- Off-trail deviation section (glass card):
  - Enable toggle
  - Distance threshold slider: 50m -- 500m, with value label
  - Sensitivity label: "Alert when you're [Xm] off trail"
- Audio cue section (glass card):
  - Toggle: play audio alert
  - Sound picker: beep / whistle / voice
  - Volume slider
- Vibration section (glass card):
  - Toggle: vibrate on alert
  - Pattern picker: short / long / pulse
- Preview button: "Test Alert" (#65A30D)

7. PACKING LISTS (packing.tsx)
- Bottom tab: Packing (active, #65A30D)
- Packing list overview, each as a glass card:
  - List name (#F0F0F5 bold)
  - Trip date (#F0F0F5 at 65% opacity)
  - Item count: "14 items" with progress "9/14 packed" (progress bar, #65A30D)
  - Completion percentage badge
- "Create New List" button (#65A30D, full width)
- Create form: name input, trip date picker
- Empty state: backpack illustration with "Create your first packing list"

8. PACKING DETAIL (packing/[id].tsx)
- Header: list name with back arrow, Edit button
- Trip date display
- Items grouped by category (collapsible sections):
  - Clothing (shirt icon)
  - Gear (wrench icon)
  - Food (apple icon)
  - Navigation (compass icon)
  - Safety (cross icon)
- Each item row:
  - Checkbox (filled = #65A30D, empty = border)
  - Item name
  - Weight if set (#F0F0F5 at 65% opacity)
  - Swipe to delete
- "Add Item" row at bottom of each category
- Season-aware suggestions banner (glass card, #65A30D border):
  - "Suggested for [season]:" with gear recommendations from inventory
- Total packed weight at bottom

9. TRIP PLANNER (trip.tsx)
- Header: "Trips"
- Trip list, each as a glass card:
  - Trip name (#F0F0F5 bold)
  - Date range (#F0F0F5 at 65% opacity)
  - Linked trail count: "3 trails"
  - Waypoint count
  - Share icon button
- "Create Trip" button (#65A30D)
- Create form:
  - Name input
  - Start and end date pickers
  - Map view: tap to add waypoints
- Empty state: compass illustration with "Plan your next adventure"

10. TRIP DETAIL (trip/[id].tsx)
- Header: trip name with back arrow, Edit/Share buttons
- Date range display
- Day-by-day plan (vertical timeline):
  - Day header: "Day 1 -- [Date]"
  - Linked trail(s) for each day (tappable, glass card):
    - Trail name, distance, elevation
  - Notes field per day
  - Waypoints on mini-map per day
- Summary card at bottom (glass card):
  - Total distance, total elevation, total days
- Map view toggle: show full trip route with all waypoints

11. TRAIL DETAIL (trail/[id].tsx)
- Header: trail name with back arrow, favorite heart toggle
- Map with route line (#65A30D) at top (200pt height)
- Stats row (glass cards):
  - Distance
  - Elevation gain/loss
  - Difficulty badge (Easy/Moderate/Hard/Expert, color-coded)
- Description text (#F0F0F5)
- Waypoints list: ordered points of interest along the trail
  - Name, description, distance from start
- Photo gallery: horizontal scroll of trail photos
- User reviews section:
  - Star rating average
  - Review count
  - "Write Review" button (#65A30D)

12. TRAIL REVIEWS (reviews.tsx)
- Header: "Reviews" with back arrow
- Rating summary at top:
  - Large average score (#65A30D)
  - Star breakdown bars (5-star through 1-star, horizontal bars showing distribution)
  - Total review count
- Review list, each as a glass card:
  - Star rating (1-5, #EAB308)
  - Review text (#F0F0F5)
  - Author name and date (#F0F0F5 at 65% opacity)
  - Photos (thumbnail row if attached)
  - "Helpful" vote button with count
- "Write Review" floating action button (#65A30D)
- Review form: star picker, text area, photo upload
```

---

## Prompt 2 of 2 -- Screens 13-21 (Mobile) + Web Screens

```
Design system: Cool Obsidian (dark theme -- #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

App: MyTrails
Tagline: Offline hiking and trail guide
Icon: 🥾
Accent color: #65A30D
Platform: iOS (mobile) for screens 13-21, Web (desktop) for web screens
Bottom tabs (mobile): Home | Trails | Record | Packing | Settings

Design 10+ screens:

13. WEATHER OVERLAY (weather.tsx) -- Mobile
- Header: "Weather" with back arrow
- Location display at top: trail name or coordinates
- Current conditions card (glass card, prominent):
  - Temperature (large, #F0F0F5)
  - Weather icon (sun/cloud/rain/snow)
  - Condition text: "Partly Cloudy"
  - Wind: speed and direction with arrow
  - Humidity: percentage with droplet icon
  - Precipitation: chance percentage
- 5-day forecast row (horizontal scroll, glass cards):
  - Each day: day name, weather icon, high/low temps
  - Highlighted: days with rain/snow (#3B82F6 / #A78BFA tint)
- Hourly breakdown (expandable per day):
  - Temperature curve graph
  - Precipitation bars

14. ROUTE BUILDER (route.tsx) -- Mobile
- Header: "Route Builder" with Cancel and Save buttons
- Full-screen map:
  - Tap-to-add waypoints (numbered markers, #65A30D)
  - Connecting lines between waypoints (#65A30D)
  - Drag waypoints to reposition
  - Long-press to insert waypoint between existing ones
- Bottom sheet (partial, draggable):
  - Auto-calculated stats: total distance, estimated elevation gain/loss
  - Waypoint list: ordered, with name/label editable inline
  - "Undo" button for last waypoint
- "Save Route" button (#65A30D) -- name input before save

15. SEGMENTS (segments.tsx) -- Mobile
- Header: "Segments"
- Segment list, each as a glass card:
  - Segment name (#F0F0F5 bold)
  - Distance and elevation
  - Personal best time (#65A30D, crown icon if first place)
  - Attempts count
- Tap segment for detail:
  - Map with segment route highlighted
  - Leaderboard: ranked list of times (position, name/you, time, date)
  - Personal best vs all-time best comparison
- "Create Segment" button (#65A30D): select start/end points on map

16. RECORD (record.tsx) -- Mobile
- Bottom tab: Record (active, #65A30D)
- Large map view (top 60% of screen): live GPS track (#65A30D line on map)
- Stats overlay (glass card, bottom 40%):
  - Current pace (large text)
  - Distance (large text)
  - Elevation: current + gain so far
  - Duration: running timer
- Control buttons (bottom row):
  - Pause button (yellow, #EAB308)
  - Resume button (#65A30D, shown when paused)
  - Stop button (#FF453A)
- Pre-recording state: large "Start" button (#65A30D, centered)
- Activity type selector before start: Hike | Run | Bike

17. PHOTOS (photos.tsx) -- Mobile
- Header: "Photos"
- Map view at top: photo markers pinned at geolocation
- Photo grid below (3 columns):
  - Each photo: thumbnail with date overlay at bottom
  - Tap for full-screen viewer
- Full-screen viewer:
  - Photo with swipe navigation
  - Trail reference: "[Trail Name]" badge
  - Date and location info
  - Share and delete buttons
- "Add Photo" floating button (#65A30D)
- Empty state: camera illustration with "Capture your trail moments"

18. DISCOVER (discover.tsx) -- Mobile
- Header: "Discover"
- "Recommended for You" section:
  - Horizontal scroll of trail cards based on preferences
  - Each card: name, photo, distance, difficulty badge, rating
- "Nearby Trails" section:
  - Trail cards with distance from current location
  - "See All" link
- "Popular Trails" section:
  - Ranked trail list: position number, name, rating, hike count
- Search bar at top with location auto-detect

19. GEAR (gear.tsx) -- Mobile
- Header: "Gear Inventory"
- Gear list, each as a glass card row:
  - Item name (#F0F0F5 bold)
  - Category badge (Clothing, Footwear, Shelter, Cooking, Electronics, etc.)
  - Weight (#F0F0F5 at 65% opacity)
  - Condition indicator: Good (#30D158) / Fair (#EAB308) / Replace (#FF453A)
- Pack weight calculator section (glass card, #65A30D border):
  - Select items to pack (checkboxes)
  - Running total weight at bottom (large text)
- "Add Gear" button (#65A30D)
- Add form: name, weight, category dropdown, condition picker

20. EXPORT (export.tsx) -- Mobile
- Header: "Export"
- Recording selector: list of recordings with checkboxes
- Select all / deselect all toggle
- Export format: GPX (default, selected), KML (option)
- Selected count: "3 recordings selected"
- "Export GPX" button (full width, #65A30D)
- Share sheet opens with generated file(s)
- Export preview: file size estimate

21. SETTINGS (settings.tsx) -- Mobile
- Bottom tab: Settings (active)
- Section: "Units" (glass card):
  - Distance: toggle miles / km
  - Elevation: toggle feet / meters
  - Pace: toggle min/mi / min/km
- Section: "Map Preferences" (glass card):
  - Map style: Satellite | Terrain | Topo (radio buttons with preview thumbnails)
  - Show trail markers toggle
  - Offline maps storage display
- Section: "Activity Defaults" (glass card):
  - Default activity type: Hike | Run | Bike
  - Auto-pause toggle
  - GPS accuracy: High / Balanced / Low battery
- Section: "Notifications" (glass card):
  - Weather alerts toggle
  - Off-trail alerts toggle
  - Weekly summary toggle

WEB -- TRAIL EXPLORER (/trails) -- Desktop
- Left sidebar (240px, #12121A):
  - MyTrails logo + "🥾 MyTrails"
  - Nav links: Explorer, Recordings, Trip Planner, Packing, Gear, Discover, Settings
  - Active link: #65A30D left border
- Main content: split view
  - Left (50%): interactive map with trail routes
  - Right (50%): trail list with filters, search, sort

WEB -- RECORDINGS (/trails/recordings) -- Desktop
- Sidebar nav
- Two-column layout:
  - Left (40%): recording list with activity badges, stats
  - Right (60%): selected recording -- large map with GPS trace, elevation profile, full stats

WEB -- TRIP PLANNER (/trails/trips) -- Desktop
- Sidebar nav
- Trip list (left) + trip detail with day-by-day timeline and map (right)

WEB -- PACKING (/trails/packing) -- Desktop
- Sidebar nav
- Packing list manager: list sidebar + detail with categorized checklist

WEB -- GEAR (/trails/gear) -- Desktop
- Sidebar nav
- Gear inventory table: sortable columns (name, category, weight, condition)
- Pack calculator panel (right side)

WEB -- ROUTE BUILDER (/trails/routes) -- Desktop
- Sidebar nav
- Full-width map with route building tools
- Waypoint list panel (right side)
- Auto-calculated stats below map

WEB -- DISCOVER (/trails/discover) -- Desktop
- Sidebar nav
- Featured trails hero section
- Grid layout: recommended, nearby, popular sections

WEB -- WEATHER (/trails/weather) -- Desktop
- Sidebar nav
- Location search + 5-day forecast dashboard
- Hourly breakdown charts

WEB -- SEGMENTS (/trails/segments) -- Desktop
- Sidebar nav
- Segment list with leaderboard panels

WEB -- PHOTOS (/trails/photos) -- Desktop
- Sidebar nav
- Photo map (top) + masonry photo grid (bottom)
- Full viewer modal with trail reference

WEB -- SETTINGS (/trails/settings) -- Desktop
- Sidebar nav
- Settings form: units, map preferences, activity defaults, notifications
```
