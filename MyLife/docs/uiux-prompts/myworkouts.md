# MyWorkouts -- UI/UX Design Prompts

**Tagline:** Train smarter, lift heavier, run farther
**Icon:** 💪 | **Accent:** #EF4444 | **Tier:** Premium | **Storage:** SQLite + Supabase
**Bottom Tabs:** Home | Exercises | Programs | Progress | Settings
**Total Screens:** 26 mobile + 6 web = 32

---

## Prompt 1 of 3 -- Screens 1-12 (Mobile)

```
Design system: Cool Obsidian (dark theme -- #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

App: MyWorkouts
Tagline: Train smarter, lift heavier, run farther
Icon: 💪
Accent color: #EF4444
Platform: iOS (mobile)
Bottom tabs: Home | Exercises | Programs | Progress | Settings

Design 12 mobile screens:

1. HOME (index.tsx)
- Bottom tab bar with Home (active, #EF4444 accent), Exercises, Programs, Progress, Settings
- This week summary card (glass card, prominent):
  - "This Week" header
  - Sessions count (large #EF4444 number)
  - Total volume (weight x reps) with unit
  - Comparison to last week: up/down arrow with percentage
- Streak counter card (glass card):
  - Flame icon (#EF4444)
  - Streak number (large, bold) + "day streak"
  - Calendar dots: last 7 days, filled (#EF4444) for workout days
- Upcoming scheduled workout card (glass card, #EF4444 left border):
  - Workout name (#F0F0F5 bold)
  - Scheduled date and time
  - Exercise count: "6 exercises"
  - "Start" button (#EF4444)
- "Quick Start" button (full width, #EF4444 background):
  - Opens empty workout session to log freely

2. EXERCISES (exercises.tsx)
- Bottom tab: Exercises (active, #EF4444)
- Search bar: "Search 50+ exercises..."
- Filter row (horizontal scroll pills):
  - Muscle group: All | Chest | Back | Shoulders | Arms | Legs | Core | Cardio
  - Equipment: All | Barbell | Dumbbell | Machine | Cable | Bodyweight
- Body map button: human silhouette icon to open body map filter
- Exercise list, each as a glass card row:
  - Exercise name (#F0F0F5 bold)
  - Muscle group badges (pills): primary (#EF4444 fill), secondary (#EF4444 outline)
  - Equipment badge (outline pill)
  - Chevron right for detail
- Alphabet section headers for scrolling
- "Add Custom Exercise" button at bottom

3. EXERCISE DETAIL (exercise/[id].tsx)
- Header: exercise name with back arrow
- Demo area (top, 240pt):
  - Video/animation of exercise form
  - Play/pause button overlay
- Written instructions section (glass card):
  - Step-by-step numbered list
  - Tips and common mistakes
- Targeted muscles section (glass card):
  - Primary muscles: list with #EF4444 dots
  - Secondary muscles: list with #EF4444 outline dots
  - Mini body map highlighting targeted areas
- 1RM history chart (glass card):
  - Line graph: x-axis dates, y-axis weight
  - #EF4444 line with data points
  - Current 1RM displayed large at top
- "Add to Workout" button (#EF4444)

4. WORKOUT BUILDER (builder.tsx)
- Header: "Build Workout" with Cancel (left) and Save (right, #EF4444)
- Workout name input at top
- Exercise list (reorderable):
  - Each exercise as a glass card:
    - Drag handle (left)
    - Exercise name (#F0F0F5 bold)
    - Sets/Reps/Weight inputs row:
      - Sets: number stepper (default 3)
      - Reps: number stepper (default 10)
      - Weight: number input with unit
    - Rest time: selector (30s/60s/90s/120s/custom)
    - Remove button (trash, #FF453A)
- "Add Exercise" button (#EF4444 outline): opens exercise picker
- "Save as Template" toggle at bottom
- Estimated duration display

5. SESSION (session.tsx)
- Full-screen active workout interface
- Header: workout name + elapsed timer
- Current exercise card (glass card, prominent):
  - Exercise name (large, #F0F0F5)
  - Set indicator: "Set 3 of 4"
  - Previous performance ghost text (#F0F0F5 at 35% opacity): "Last: 135 lbs x 10"
  - Weight input (large number, tappable to edit)
  - Reps input (large number, tappable to edit)
  - "Complete Set" button (full width, #EF4444)
- Rest timer (shown between sets):
  - Circular countdown (#EF4444 ring depleting)
  - Time remaining (large text, center)
  - Skip button
- Exercise queue below: upcoming exercises (collapsed list)
- Voice command button (microphone icon, bottom right)
- Bottom controls: Previous exercise | Next exercise | Finish workout

6. HISTORY (history.tsx)
- Header: "History"
- Workout history list, each as a glass card:
  - Workout name (#F0F0F5 bold)
  - Date (#F0F0F5 at 65% opacity)
  - Duration: "52 min"
  - Total volume: "12,450 lbs"
  - PR indicators: star icon(s) with "#EF4444" if personal records were broken
- Filter: date range picker, workout type
- Monthly grouping headers
- Empty state: dumbbell illustration with "Complete your first workout"

7. PROGRAMS (programs.tsx)
- Bottom tab: Programs (active, #EF4444)
- Program list, each as a glass card:
  - Program name (#F0F0F5 bold)
  - Duration: "8 Weeks"
  - Frequency: "4x per week"
  - Difficulty badge: Beginner (#30D158) / Intermediate (#3B82F6) / Advanced (#EF4444)
  - Description preview (1 line)
  - Progress bar if active (filled #EF4444)
- "Create Program" button (#EF4444)
- Active program highlighted with #EF4444 left border

8. PROGRAM DETAIL (program/[id].tsx)
- Header: program name with back arrow
- Overview card (glass card):
  - Duration, frequency, difficulty
  - Description text
- Weekly schedule view:
  - Week tabs: Week 1, Week 2, ... (horizontal scroll)
  - Day rows within selected week:
    - Day label: "Monday", "Wednesday", etc.
    - Workout template name assigned to that day
    - Exercise count
    - "Rest Day" label for off days
  - Progress indicator: checkmarks on completed days
- "Start Program" button (#EF4444) or "Continue" if in progress

9. CREATE PROGRAM (program/create.tsx)
- Header: "Create Program" with Cancel and Save
- Program name input
- Duration: week count stepper (1-52)
- Description text area
- Weekly template builder:
  - 7-day grid (Mon-Sun)
  - Tap day to assign a workout template (opens template picker)
  - Assigned days show workout name
  - Unassigned days show "Rest"
- Copy week: "Apply to all weeks" toggle or "Copy Week 1 to Week 2" button
- "Save Program" button (#EF4444)

10. PROGRESS (progress.tsx)
- Bottom tab: Progress (active, #EF4444)
- PR tracking table (glass card):
  - Columns: Exercise | Weight | Date
  - Rows sorted by most recent PR
  - PR icon (#EF4444 star) next to each
  - Tap row to see history for that exercise
- Volume trend chart (glass card):
  - Bar chart: weekly total volume over past 8 weeks
  - #EF4444 bars, #F0F0F5 labels
- Streak visualization (glass card):
  - GitHub-style contribution grid (past 12 weeks)
  - Days with workouts: filled squares (#EF4444 intensity by volume)
  - Current streak and longest streak counters

11. BODY MAP (body-map.tsx)
- Header: "Recovery Map"
- Full body illustration (front and back views, tappable):
  - 14 muscle groups highlighted with fatigue heatmap:
    - Fresh: #30D158 (green)
    - Moderate: #EAB308 (yellow)
    - Fatigued: #EF4444 (red)
    - Overtrained: #FF453A (deep red, pulsing)
- Legend: Fresh / Moderate / Fatigued / Overtrained with color swatches
- Tap any muscle group for detail card:
  - Muscle group name
  - Last trained: "[X] days ago"
  - Estimated recovery: "Recovered" or "Rest [X] more days"
  - Suggested action: "Ready to train" or "Light work only"
- "Suggest Workout" button (#EF4444): generates workout targeting fresh muscles

12. MEASUREMENTS (measurements.tsx)
- Header: "Measurements"
- Body measurement categories (glass card sections):
  - Weight (scale icon)
  - Arms (flexing icon)
  - Chest
  - Waist
  - Hips
  - Thighs
  - Calves
- Each category shows:
  - Latest value (large text)
  - Change from last entry: up/down arrow with delta
  - Mini sparkline trend
- "Log Measurement" button (#EF4444): opens entry form
  - Measurement type selector
  - Value input with unit
  - Date picker (defaults to today)
- Tap category for full trend chart: line graph over time
```

---

## Prompt 2 of 3 -- Screens 13-24 (Mobile)

```
Design system: Cool Obsidian (dark theme -- #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

App: MyWorkouts
Tagline: Train smarter, lift heavier, run farther
Icon: 💪
Accent color: #EF4444
Platform: iOS (mobile)
Bottom tabs: Home | Exercises | Programs | Progress | Settings

Design 12 mobile screens:

13. PHOTOS (photos.tsx)
- Header: "Progress Photos"
- View type tabs: Front | Back | Side Left | Side Right
- Photo grid for selected view (chronological):
  - Each photo: thumbnail with date stamp overlay at bottom
  - Tap for full-screen view
- Comparison slider (glass card, #EF4444 border):
  - "Before" photo on left, "After" photo on right
  - Draggable center divider to reveal/hide each side
  - Date labels below each photo
  - Photo selector: tap to choose before/after photos
- "Take Photo" button (#EF4444): camera opens with view type label overlay
- Empty state per view: silhouette placeholder with "Add your first [front] photo"

14. 1RM CALCULATOR (one-rm.tsx)
- Header: "1RM Calculator"
- Input section (glass card):
  - Weight input: large number field with unit (lbs/kg)
  - Reps input: large number field (1-30)
  - Formula selector: Epley (default) | Brzycki (segmented control)
- Result section (glass card, #EF4444 border):
  - Calculated 1RM: very large bold number (#EF4444)
  - Unit label
- Rep max table (glass card):
  - Table rows: 2RM, 3RM, 4RM, 5RM, 6RM, 7RM, 8RM, 9RM, 10RM
  - Each row: rep count | estimated weight | percentage of 1RM
  - Alternating row backgrounds for readability
- Exercise context (optional): exercise name selector to compare against recorded 1RM

15. WARMUP CALCULATOR (warmup.tsx)
- Header: "Warmup Calculator"
- Input section (glass card):
  - Working weight input: number field with unit
  - Bar weight: quick-select buttons (45 / 35 / 25 lbs) or custom input
- Warmup set suggestions (glass card):
  - Progressive loading table:
    - Set 1: empty bar (bar weight only)
    - Set 2: 50% of working weight -- plate breakdown
    - Set 3: 60% of working weight -- plate breakdown
    - Set 4: 70% of working weight -- plate breakdown
    - Set 5: 80% of working weight -- plate breakdown
  - Each row: set number, percentage, total weight, plates per side
  - Reps suggestion: decreasing (10, 8, 5, 3, 2)
- Visual plate layout: bar illustration with colored plates on each side

16. PLATE LOADER (plate-loader.tsx)
- Header: "Plate Loader"
- Target weight input (glass card):
  - Number field (large)
  - Unit toggle: lbs / kg
- Bar weight selector (glass card):
  - Quick buttons: 45 lbs | 35 lbs | 25 lbs | Custom
  - Custom input field
- Available plate inventory (glass card):
  - Plate toggles: 45, 35, 25, 10, 5, 2.5 (each with on/off toggle and quantity stepper)
- Result section (glass card, #EF4444 border):
  - Visual bar illustration:
    - Center bar
    - Plates stacked on each side, color-coded by weight
    - Size proportional to plate weight
  - Text breakdown: "Each side: 45 + 25 + 10 = 80 lbs"
  - Total weight verification: "Bar (45) + Plates (160) = 205 lbs"
- "Not possible" warning if target cannot be reached with available plates

17. AI GENERATOR (ai-workout.tsx)
- Header: "Generate Workout"
- Configuration form (glass card sections):
  - Goal picker (segmented): Strength | Hypertrophy | Endurance
  - Target muscles: multi-select body part chips (tappable, #EF4444 when selected):
    - Chest, Back, Shoulders, Biceps, Triceps, Quads, Hamstrings, Glutes, Calves, Core
  - Available equipment: multi-select chips:
    - Barbell, Dumbbells, Cables, Machines, Bodyweight, Kettlebell, Bands
  - Duration slider: 30 min -- 90 min
- "Generate" button (full width, #EF4444)
- Generated workout preview (glass card):
  - Workout name (auto-generated)
  - Exercise list: name, sets x reps, target muscle
  - Estimated duration
  - "Use This Workout" button (#EF4444)
  - "Regenerate" button (#EF4444 outline)

18. OVERLOAD (overload.tsx)
- Header: "Progressive Overload"
- Exercise list, each as a glass card:
  - Exercise name (#F0F0F5 bold)
  - Last 3 sessions: compact table (date, weight, reps)
  - Trend arrow: increasing (#30D158 up), plateaued (#EAB308 flat), decreasing (#FF453A down)
  - Recommendation card (#EF4444 left border):
    - Suggested increase: "+5 lbs" or "+2 reps" or "+1 set"
    - Trigger: "You've hit 3x12 for 2 sessions -- increase weight"
    - Confidence: "High" / "Medium" badge
- Filter: by muscle group or by readiness
- Summary at top: "5 exercises ready for progression"

19. GPS RUNS (gps.tsx)
- Header: "Run"
- Full-screen map (top 60%): live GPS track (#EF4444 line)
- Stats overlay (glass card, bottom 40%):
  - Current pace (large, primary stat)
  - Distance: running total
  - Elevation: gain and current
  - Calories: estimated burn
  - Split times: per km/mile (compact list)
- Duration timer (always visible, top of stats)
- Controls: Start (#EF4444 large) | Pause (#EAB308) | Stop (#FF453A)
- Pre-run: "Start Run" button centered on map
- Post-run summary: route map, total stats, split table, "Save" button

20. WATCH APP (watch.tsx)
- Header: "Apple Watch"
- Connection status card (glass card):
  - Status indicator: Green dot (#30D158) "Connected" or Red dot (#FF453A) "Disconnected"
  - Watch model name
  - Last sync timestamp (#F0F0F5 at 65% opacity)
- What syncs section (glass card):
  - Active workout data: checkbox (enabled)
  - Heart rate: checkbox (enabled)
  - Sets completed: checkbox (enabled)
  - Calories: checkbox (enabled)
- Sync controls:
  - "Sync Now" button (#EF4444)
  - Auto-sync toggle
- Recent sync history: last 5 syncs with timestamp and data transferred

21. SOCIAL FEED (social.tsx)
- Header: "Feed"
- Feed items, each as a glass card:
  - User avatar + name
  - Workout summary: workout name, duration, volume
  - PRs broken: highlighted with star icon (#EF4444)
  - Muscle groups trained: pill badges
  - Timestamp (#F0F0F5 at 65% opacity)
  - Engagement: heart icon + count, comment icon + count
  - Sharing controls: privacy badge (Public / Friends Only / Private)
- Pull-to-refresh
- "Share Workout" shortcut button at top

22. SHARE WORKOUT (share.tsx)
- Header: "Share Workout"
- Summary card builder (preview):
  - Card mockup showing:
    - Workout name (bold, #F0F0F5)
    - PRs broken (star icons, #EF4444)
    - Total volume (large number)
    - Muscle groups trained (colored pills)
    - Duration
    - Date
  - Card style: Cool Obsidian glass card with #EF4444 accent
- Customization options:
  - Show/hide PRs toggle
  - Show/hide volume toggle
  - Show/hide duration toggle
- "Export as Image" button (#EF4444): saves card as shareable image
- "Share" button: opens system share sheet

23. EXPLORE (explore.tsx)
- Header: "Explore"
- "Featured Programs" section:
  - Horizontal scroll of program cards with cover images
  - Program name, duration, difficulty badge
- "Popular Exercises" section:
  - Grid of exercise cards (2 columns)
  - Exercise name, primary muscle, demo thumbnail
- "Community Content" section:
  - Shared workouts from other users
  - User name, workout name, exercise count, rating
- Search bar at top
- Category quick-links: Strength, Hypertrophy, Cardio, Flexibility

24. SUPERSET (superset.tsx)
- Header: "Superset Builder"
- Pair configuration (glass card):
  - Exercise A: picker (tap to select from library)
  - Exercise B: picker (tap to select from library)
  - "Swap" button between them
- Set configuration:
  - Alternating sets display:
    - "A: Bench Press -- 4x10"
    - "B: Bent Over Row -- 4x10"
  - Rest between pairs: time selector
  - Rest between individual sets: time selector (0 for no rest)
- Superset list (if multiple pairs):
  - Each pair as a glass card with exercise A and B
  - "Add Pair" button (#EF4444)
- "Start Superset" button (#EF4444): opens session view with alternating exercise flow
```

---

## Prompt 3 of 3 -- Screens 25-32 (Mobile 25-26 + Web 27-32)

```
Design system: Cool Obsidian (dark theme -- #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

App: MyWorkouts
Tagline: Train smarter, lift heavier, run farther
Icon: 💪
Accent color: #EF4444
Platform: iOS (mobile) for screens 25-26, Web (desktop) for screens 27-32
Bottom tabs (mobile): Home | Exercises | Programs | Progress | Settings

Design 8 screens:

25. TIMER (timer.tsx) -- Mobile
- Full-screen rest timer interface
- Countdown display (center, very large):
  - Circular progress ring (#EF4444, depleting clockwise)
  - Time remaining in center (large bold text)
  - Total time below (smaller, #F0F0F5 at 65% opacity)
- Preset buttons row (below countdown):
  - 30s | 60s | 90s | 120s | Custom
  - Each as a glass pill, active one highlighted #EF4444
- Custom time input: stepper or scroll picker
- Controls:
  - Start/Pause toggle button (#EF4444)
  - Reset button (outline)
- Auto-start option toggle: "Start timer after completing set"
- "Done" button to return to workout session
- Subtle pulse animation when timer reaches 0

26. SETTINGS (settings.tsx) -- Mobile
- Bottom tab: Settings (active)
- Section: "Units" (glass card):
  - Weight: toggle lbs / kg
  - Distance: toggle miles / km
  - Height: toggle ft+in / cm
- Section: "Equipment" (glass card):
  - Equipment inventory: checkboxes for available equipment
    - Barbell, Dumbbells, Cables, Machines, Kettlebells, Bands, Pull-up Bar, Bench
  - Used by AI Generator and exercise filters
- Section: "Notifications" (glass card):
  - Workout reminders toggle
  - Rest day reminders toggle
  - PR celebration notifications toggle
  - Scheduled workout alerts toggle
- Section: "Apple Watch" (glass card):
  - Watch sync toggle
  - Link to Watch App screen
- Section: "Data" (glass card):
  - Export workout data
  - Supabase sync status
  - "Sync Now" button

27. WEB -- HUB (/workouts) -- Desktop
- Left sidebar (240px, #12121A):
  - MyWorkouts logo + "💪 MyWorkouts"
  - Nav links: Dashboard, Exercises, Progress, Programs, Explore, Settings
  - Active link: #EF4444 left border + text color
- Main dashboard content:
  - Top row: stat cards (this week sessions, volume, streak, upcoming workout)
  - Middle: weekly volume bar chart (past 8 weeks)
  - Bottom left: recent workout history list
  - Bottom right: body map recovery heatmap

28. WEB -- EXERCISES (/workouts/exercises) -- Desktop
- Sidebar nav
- Two-column layout:
  - Left (35%): exercise list with search bar, muscle group filter sidebar, equipment filter
  - Right (65%): selected exercise detail -- demo video/animation, instructions, muscle targets, 1RM chart
- "Add Custom Exercise" button in header

29. WEB -- PROGRESS (/workouts/progress) -- Desktop
- Sidebar nav
- Analytics dashboard:
  - PR table (full width, sortable columns: exercise, weight, reps, date)
  - Volume trend chart (larger, interactive with hover tooltips)
  - Streak grid (wider, past 6 months)
  - Measurements section: trend charts per body measurement
  - Progress photos grid with comparison slider

30. WEB -- PROGRAMS (/workouts/programs) -- Desktop
- Sidebar nav
- Two-column layout:
  - Left (40%): program list with create button, difficulty and duration filters
  - Right (60%): selected program -- weekly schedule calendar view, workout details per day, progress tracking

31. WEB -- EXPLORE (/workouts/explore) -- Desktop
- Sidebar nav
- Content discovery grid:
  - Featured programs hero section
  - Popular exercises grid (3 columns)
  - Community shared workouts feed
  - AI Generator panel (sidebar or inline form)

32. WEB -- SETTINGS (/workouts/settings) -- Desktop
- Sidebar nav
- Settings form (centered, max-width 640px):
  - Units section
  - Equipment inventory (checkbox grid)
  - Notifications section
  - Apple Watch section
  - Data management (export, sync)
  - Account preferences
```
