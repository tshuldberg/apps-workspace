# MySurf -- UI/UX Design Prompts

**Tagline:** Surf forecasts and spot intel, no ads, no tracking
**Icon:** 🏄 | **Accent:** #3B82F6 | **Tier:** Premium | **Storage:** Supabase + SQLite cache
**Bottom Tabs:** Home | Map | Spots | Sessions | Settings
**Total Screens:** 21 mobile + 9 web = 30

---

## Prompt 1 of 2 -- Screens 1-12 (Mobile)

```
Design system: Cool Obsidian (dark theme -- #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

App: MySurf
Tagline: Surf forecasts and spot intel, no ads, no tracking
Icon: 🏄
Accent color: #3B82F6
Platform: iOS (mobile)
Bottom tabs: Home | Map | Spots | Sessions | Settings

Design 12 mobile screens:

1. HOME (index.tsx)
- Bottom tab bar with Home (active, #3B82F6 accent), Map, Spots, Sessions, Settings
- Quick stats row (glass cards, horizontal scroll):
  - Total spots count
  - Favorites count (heart icon)
  - Avg wave height (with unit)
  - Total sessions count
- "Favorites" section header
- Top 6 favorite spots grid (2 columns, 3 rows), each as a glass card:
  - Spot name (#F0F0F5 bold)
  - Current wave height (#3B82F6 large text)
  - Condition indicator dot: Green (#30D158) = good, Yellow (#EAB308) = fair, Red (#FF453A) = poor
  - Wind direction arrow icon
  - Star rating (1-5 stars, #EAB308)
- Pull-to-refresh for latest conditions

2. MAP (map.tsx)
- Bottom tab: Map (active, #3B82F6)
- Full-screen Mapbox map (dark style):
  - Spot markers as circles, color-coded by conditions:
    - Green (#30D158): good conditions
    - Yellow (#EAB308): fair conditions
    - Red (#FF453A): poor conditions
  - Marker clusters when zoomed out
- Filter bar at top (horizontal scroll pills):
  - Region filter: All, CA, HI, East Coast, Portugal, Custom
  - Condition filter: Good Only, All
- Tap marker to show quick info card (bottom sheet, partial):
  - Spot name, current wave height, wind, tide status
  - "View Detail" button
- Current location button (bottom right, GPS icon)

3. SPOTS (spots.tsx)
- Bottom tab: Spots (active, #3B82F6)
- Search bar at top: "Search spots..."
- Filter row (horizontal scroll pills):
  - Difficulty: All | Beginner | Intermediate | Advanced | Expert
  - Break type: All | Beach | Point | Reef
  - Sort by: Rating | Distance | Name
- Spot list, each as a glass card row:
  - Spot name (#F0F0F5 bold)
  - Difficulty badge: color-coded pill (Beginner = #30D158, Intermediate = #3B82F6, Advanced = #EAB308, Expert = #FF453A)
  - Break type badge: Beach / Point / Reef (outline pill)
  - Current rating: 1-5 stars (#EAB308)
  - Favorite heart toggle (right side, #FF453A when active)
- Empty state: wave illustration with "No spots match filters"

4. SPOT DETAIL (spot-detail.tsx)
- Header: spot name with back arrow, favorite heart toggle
- Conditions summary card (glass card, prominent):
  - Wave height (large #3B82F6 text)
  - Swell direction + period
  - Wind speed + direction
  - Tide status (high/mid/low with arrow)
  - Overall rating bar
- Info section (glass card):
  - Hazards list: each as a warning pill (e.g., rocks, currents, sharks)
  - Recommended skill level badge
  - Ideal swell: direction and size range
  - Crowd factor: 1-5 people icons (filled = crowded)
  - Tide preference: "Best at mid-tide"
  - Wind preference: "Offshore NE"
- User notes section: editable text area for personal notes
- Rating breakdown: "View Ratings" button linking to rating detail

5. ALERTS (alerts.tsx)
- Header: "Alerts"
- Alert rules list, each as a glass card:
  - Condition label: "Wave Height", "Wind Speed", "Tide", "Rating"
  - Operator: ">", "<", "="
  - Value with unit
  - Logic connector: AND / OR badge between conditions
  - Toggle switch (active/inactive)
  - Edit/Delete icons
- "Create Alert" button (#3B82F6, full width)
- Create alert form:
  - Spot selector dropdown
  - Condition picker (wave height, wind, tide, rating)
  - Operator picker
  - Value input
  - Add condition button (for AND/OR logic)
- Notification history section: list of triggered alerts with timestamps

6. BUOYS (buoys.tsx)
- Header: "Buoys"
- Mini-map at top (200pt height): buoy locations as marker dots on coastline
- Buoy list below, each as a glass card:
  - Buoy station name/ID (#F0F0F5 bold)
  - Wave height: large text (#3B82F6)
  - Dominant swell: direction arrow + period
  - Water temperature with thermometer icon
  - Last updated timestamp (#F0F0F5 at 65% opacity)
- Tap buoy for expanded view with historical charts
- Data source label: "NOAA" badge

7. TIDES (tides.tsx)
- Header: "Tides"
- Location selector at top (dropdown)
- Tide chart (glass card, full width):
  - Sinusoidal curve (#3B82F6 line, rgba fill below)
  - Current time marker (vertical dashed line)
  - High tide peaks labeled with height and time
  - Low tide troughs labeled with height and time
  - X-axis: hours (24h), Y-axis: height (ft or m)
- Current tide status card:
  - "Rising" or "Falling" with arrow icon
  - Current height estimate
  - Next high/low time
- 7-day forecast: horizontal scroll of daily tide summary cards

8. SESSIONS (sessions.tsx)
- Bottom tab: Sessions (active, #3B82F6)
- Session list, each as a glass card:
  - Date (#F0F0F5 at 65% opacity)
  - Duration: "1h 45m"
  - Spot name (#3B82F6, tappable)
  - Rating: 1-5 stars (#EAB308)
  - Conditions at time: wave height, wind, tide (compact row)
  - Notes preview (1 line, truncated)
- "Log Session" floating action button (#3B82F6)
- Log form: date, spot picker, duration, rating slider, conditions (auto-filled if available), notes text area
- Empty state: surfboard illustration with "No sessions logged"

9. REGIONS (regions.tsx)
- Header: "Regions"
- Region map: map view showing selectable coastal regions
- Region list below, each as a glass card:
  - Region name (#F0F0F5 bold)
  - Spot count
  - Active indicator (checkmark if enabled)
  - Tap to toggle region on/off
- Built-in regions: California, Hawaii, East Coast, Portugal
- "Add Custom Region" button (#3B82F6):
  - Draw region on map or enter coordinates
  - Name input
  - Save button

10. WAVE DETECTION (wave-detect.tsx)
- Header: "Wave Detection"
- GPS recording interface:
  - Start/Stop button (large, circular, #3B82F6)
  - Status: "Recording..." with pulsing dot or "Idle"
- Active session display:
  - Ride count (large #3B82F6 number)
  - Current speed
  - Total distance
- Ride list (during/after session):
  - Each ride: ride number, speed, distance, duration
  - Map trace of the ride path
- Session summary card (after stop):
  - Total rides, average speed, max speed, total distance, duration
  - "Save Session" button

11. TRAIL (trail.tsx)
- Header: "Coastal Trail"
- GPS route tracking interface:
  - Map view with live track line (#3B82F6)
  - Start/Pause/Stop buttons
- Live stats overlay (glass card at bottom):
  - Distance (large text)
  - Elevation profile mini-graph
  - Current pace
  - Duration
- Completed trail view:
  - Full map with route
  - Elevation profile graph (distance on x-axis, elevation on y-axis)
  - Stats summary: distance, elevation gain/loss, time, avg pace

12. CREW (crew.tsx)
- Header: "Crew"
- Crew member list, each as a glass card:
  - Avatar (circular, initials fallback)
  - Name (#F0F0F5 bold)
  - Last session info (#F0F0F5 at 65% opacity)
- "Invite to Crew" button (#3B82F6): generates invite code
- Invite code display: large monospace text with copy button
- Shared session history section:
  - Sessions where 2+ crew members surfed together
  - Date, spot, who was there
- Empty state: people illustration with "Build your surf crew"
```

---

## Prompt 2 of 2 -- Screens 13-23 (Mobile 13-15 + Web 16-23)

```
Design system: Cool Obsidian (dark theme -- #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

App: MySurf
Tagline: Surf forecasts and spot intel, no ads, no tracking
Icon: 🏄
Accent color: #3B82F6
Platform: iOS (mobile) for screens 13-15, Web (desktop) for screens 16-23
Bottom tabs (mobile): Home | Map | Spots | Sessions | Settings

Design 12 screens:

13. FEED (feed.tsx) -- Mobile
- Header: "Feed"
- Social activity feed, each item as a glass card:
  - User avatar + name at top
  - Session summary: spot name, wave height, duration, rating stars
  - Conditions row: compact weather/surf info
  - Optional photo (full card width)
  - Engagement row: heart icon + like count, comment icon + comment count
  - Timestamp (#F0F0F5 at 65% opacity)
- Pull-to-refresh
- "Share Session" shortcut at top (#3B82F6)
- Empty state: wave illustration with "Your feed is empty"

14. RATING DETAIL (rating-detail.tsx) -- Mobile
- Header: "[Spot Name] Ratings" with back arrow
- Overall rating: large star display with average score
- Rating breakdown section (glass card):
  - Swell Energy (45% weight): horizontal gauge bar, filled to score level (#3B82F6)
  - Wind (30% weight): horizontal gauge bar
  - Tide (15% weight): horizontal gauge bar
  - Consistency (10% weight): horizontal gauge bar
  - Each bar labeled with factor name, weight %, and score
- Weight distribution visualization: segmented horizontal bar showing 45/30/15/10 proportions
- Historical rating chart: line graph showing spot rating over past 7 days
- User reviews section: star rating + text from community

15. SETTINGS (settings.tsx) -- Mobile
- Bottom tab: Settings (active)
- Section: "Units" (glass card):
  - Height: toggle feet / meters
  - Temperature: toggle F / C
  - Distance: toggle miles / km
- Section: "Default Region" (glass card):
  - Region picker dropdown
- Section: "Sync" (glass card):
  - Supabase sync status indicator (green dot = synced)
  - Last sync timestamp
  - "Sync Now" button
  - Offline mode toggle
- Section: "Notifications" (glass card):
  - Alert notifications toggle
  - Session reminders toggle
  - Crew activity toggle

16. WEB -- SPOT EXPLORER (/surf) -- Desktop
- Left sidebar (240px, #12121A):
  - MySurf logo + "🏄 MySurf"
  - Nav links: Spots, Forecast, Swell, Tides, Alerts, Sessions, Crew, Ratings, Settings
  - Active link: #3B82F6 left border
- Main content: split view
  - Top half (60%): interactive map with spot markers (same color-coding as mobile)
  - Bottom half (40%): spot list with search and filters, horizontal scrolling spot cards

17. WEB -- FORECAST DASHBOARD (/surf/forecast) -- Desktop
- Sidebar nav
- Dashboard grid layout:
  - Swell components card: swell direction arrows, height, period (multiple swell sources)
  - Wind card: speed, direction, gusts, wind map
  - Tide card: tide chart (larger, interactive hover for values)
  - 7-day forecast table: rows for each day, columns for swell/wind/tide/rating

18. WEB -- SWELL COMPONENTS (/surf/swell) -- Desktop
- Sidebar nav
- Detailed swell analysis:
  - Primary swell: height, direction arrow, period, energy
  - Secondary swell(s): same breakdown
  - Combined swell visualization: directional rose diagram
  - Swell history chart: 7-day line graph with multiple swell sources

19. WEB -- TIDE PREDICTIONS (/surf/tides) -- Desktop
- Sidebar nav
- Large tide chart (full width, interactive):
  - Sinusoidal curve with hover tooltip for exact height/time
  - Current time marker
  - High/low annotations
- Below: 7-day tide table with precise times and heights
- Location selector at top

20. WEB -- ALERT MANAGEMENT (/surf/alerts) -- Desktop
- Sidebar nav
- Alert rules table: columns for Spot, Conditions, Operator, Value, Logic, Status (active/paused)
- Create alert form (right panel or modal)
- Alert history log: triggered alerts with timestamps and conditions at trigger time

21. WEB -- SESSION JOURNAL (/surf/sessions) -- Desktop
- Sidebar nav
- Two-column layout:
  - Left (40%): session list with date, spot, duration, rating
  - Right (60%): selected session detail -- map with GPS trace (if recorded), conditions, notes, photos
- "Log Session" button in header
- Filter/sort controls: by date, spot, rating

22. WEB -- CREW/SOCIAL (/surf/crew) -- Desktop
- Sidebar nav
- Crew member grid (cards with avatar, name, recent activity)
- Shared sessions timeline
- Invite section: generate code, share link
- Activity feed (right column)

23. WEB -- RATINGS (/surf/ratings) -- Desktop
- Sidebar nav
- Spot ratings explorer:
  - Spot selector at top
  - Large rating breakdown with gauge bars (same as mobile rating detail, but larger)
  - Historical rating chart (interactive, zoomable)
  - Community reviews section below
```
