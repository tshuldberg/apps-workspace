# MyHabits -- UI/UX Design Prompts

**Tagline:** Build the life you want, one habit at a time
**Icon:** ✅ | **Accent:** #10B981 | **Tier:** Premium
**Bottom Tabs:** Home | Stats | Challenges | Timer | Settings

---

## Prompt 1 of 2 -- Mobile Screens 1-12

```
Design system: Cool Obsidian (dark theme -- #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

App: MyHabits
Accent color: #10B981 (emerald green)
Platform: iOS mobile (Expo/React Native)
Bottom tab bar: Home | Stats | Challenges | Timer | Settings

Design the following 12 screens:

1. HOME (index.tsx)
- Top date navigation bar with horizontally scrollable day pills (Mon-Sun), selected day highlighted with accent color
- "Today" label with current date
- Habit groups organized by area with section headers: Health, Productivity, Mindfulness, Social, Learning, Other
- Each habit row: checkbox toggle (accent fill when complete), habit name, streak count badge, frequency label (e.g. "Daily")
- Undo toast notification at bottom after toggling a habit complete ("Habit marked complete. Undo")
- Floating action button (FAB) bottom-right with "+" icon for quick add, accent-colored with glass border
- Empty state: illustration with "Start your first habit" prompt
- Overall completion progress bar at top (e.g. "7/12 done today")

2. ADD HABIT (add-habit.tsx)
- Header: "New Habit"
- 4 habit type selector cards in a 2x2 grid: Standard (check icon), Timed (clock icon), Negative (X icon), Measurable (chart icon)
- Text input: habit name
- NLP magic fill banner: text input "Type naturally, e.g. 'meditate 10 min every morning'" with sparkle icon, auto-parses into fields below
- Frequency picker: segmented control (Daily / Weekdays / Custom), custom shows day-of-week toggles (M T W T F S S)
- Time of day picker: pill selector (Morning / Afternoon / Evening / Anytime)
- Grace period: stepper input (0-7 days)
- Area picker: 6 colored chips (Health / Productivity / Mindfulness / Social / Learning / Other)
- Template picker: "Choose from templates" expandable section showing 24 template cards grouped by area
- "Create Habit" button at bottom, accent-colored, full width

3. HABIT DETAIL ([id].tsx)
- Header with habit name, area color indicator dot, edit icon button
- Current streak: large number display with flame icon and "days" label
- GitHub-style contribution heatmap: 52 weeks of daily squares, color intensity = completion consistency, scrollable
- Completion rate: circular progress gauge with percentage in center
- Reminders section: list of set reminder times with add button for multiple reminders
- Start date and optional end date display
- Sub-tasks checklist: ordered list with checkboxes, "Add sub-task" row at bottom
- Action buttons at bottom: "Archive Habit" (muted), "Delete Habit" (danger red #FF453A)
- Stats row: total completions, best streak, average per week

4. STATS (stats.tsx)
- Header: "Statistics"
- Overall completion rate: large circular gauge with percentage
- Daily completion chart: bar chart showing last 30 days, accent bars, scrollable
- Time-of-day distribution: horizontal bar chart (Morning / Afternoon / Evening / Anytime) showing which time slots have highest completions
- Month-by-month breakdown: list of months with completion rate per month, trend arrow (up/down)
- GitHub-style year heatmap: full 365-day grid, color legend (none / low / medium / high / perfect)
- Date range filter at top: "This Week" / "This Month" / "This Year" / "All Time" segmented control

5. SOBRIETY (sobriety.tsx)
- Header: "Sobriety Tracker"
- Large sobriety clock: prominent display showing days, hours, minutes, seconds counting up, accent-colored numbers
- Sobriety start date display with edit option
- Money saved calculator: "Cost per unit" input, calculated "Total Saved" in large bold text with currency symbol
- Daily pledge card: glass surface card with pledge text "I commit to another day", checkmark button to affirm, date stamped
- Lifetime stats grid: 4 stat cards (Longest Streak, Current Streak, Total Saved, Days Tracked)
- Motivational milestone banner when approaching round numbers

6. CRAVING LOG (craving.tsx)
- Header: "Log Craving"
- Trigger picker: 5 pill buttons (Social / Stress / Boredom / Habit / Emotion)
- Intensity slider: horizontal 1-10 scale with color gradient (green to red), large number display
- Coping strategy used: text input with suggestions dropdown (e.g. "Called a friend", "Went for a walk", "Deep breathing")
- Outcome toggle: two large buttons "Resisted" (green, success) and "Gave In" (red, muted)
- Timestamp: auto-filled with current time, editable
- "Save Entry" button
- Recent cravings list below with date, trigger, intensity, outcome summary per row

7. TIMER (timer.tsx)
- Header: "Focus Timer"
- Phase indicator: segmented pill bar showing Work / Break / Long Break, current phase highlighted
- Large circular countdown timer: minutes:seconds in center, circular progress ring in accent color
- Session count: dots or numbered indicators showing completed Pomodoro sessions (e.g. 2/4)
- Start / Pause button: large centered circle button, toggles between play and pause icons
- Reset button: smaller, muted, positioned below
- Pomodoro settings: work duration, break duration, long break duration, sessions before long break
- Linked habit selector: "Track time for: [habit name]" dropdown

8. TIME TRACKING (time-tracking.tsx)
- Header: "Time Tracking"
- Active timer card: project name, task description, running timer display (HH:MM:SS), stop button
- Project list: project name, total tracked time, billable toggle
- "New Project" button
- Task entry rows: task description, duration, date, project tag
- Manual time entry form: project picker, task description, start time, end time (or duration), date
- Daily total and weekly total summary at top
- "Export CSV" button in header

9. CHALLENGES (challenges.tsx)
- Header: "Challenges"
- 8 program cards in a scrollable list:
  - 30-Day Meditation: lotus icon, 30 days, progress bar
  - Couch to 5K: running icon, 8 weeks, progress bar
  - Morning Routine: sunrise icon, 21 days, progress bar
  - Digital Detox: phone-off icon, 7 days, progress bar
  - Gratitude Journal: heart icon, 30 days, progress bar
  - Hydration Challenge: water icon, 14 days, progress bar
  - Reading Challenge: book icon, 30 days, progress bar
  - Stretching Routine: stretch icon, 14 days, progress bar
- Each card: program name, icon, duration, progress bar with day count, "Start" / "Continue" / "Restart" button
- Completed challenges section at bottom with badge earned indicator

10. BADGES (badges.tsx)
- Header: "Badges"
- 5 category tabs: Streak | Completion | Habit Count | Challenge | Special
- Badge grid: 3 columns, each badge is a circular icon
- Unlocked badges: full color with glow effect
- Locked badges: greyed out with lock overlay
- Streak badges: 7-day, 14-day, 30-day, 60-day, 90-day, 180-day, 365-day
- Completion badges: 50%, 75%, 90%, 100% completion rate
- Total badge count: "12/37 Unlocked" at top
- Tap badge for detail modal: badge name, description, unlock criteria, date earned (if unlocked)

11. PET / AVATAR (pet.tsx)
- Header: "My Pet"
- Large pet display: animated pet sprite centered on screen
- 5 species options: Dog, Cat, Bunny, Dragon, Robot (shown during first setup or in settings)
- Mood indicator below pet: emoji + label (Happy / Content / Sad / Sick) based on recent habit completion
- Pet name display with edit pencil icon
- Happiness meter: horizontal bar with gradient (red to green)
- Wardrobe section: scrollable row of accessory thumbnails (hats, glasses, bows, etc.), locked items greyed with badge requirement label
- Equipped items shown on pet sprite
- "Feed your pet by completing habits!" tip text

12. MILESTONES (milestones.tsx)
- Header: "Milestones"
- Celebration cards in a vertical list, each card:
  - Milestone type icon (flame for streak, chart for completion, clock for sobriety, dollar for savings, star for custom)
  - Title (e.g. "30-Day Streak!")
  - Description (e.g. "You meditated for 30 days straight")
  - Date achieved
  - Confetti animation trigger on first view
- Milestone categories: Streak milestones, Completion milestones, Sobriety milestones, Money saved milestones, Custom milestones
- "Add Custom Milestone" button at bottom
- Empty state: "Keep going! Your first milestone is around the corner."
```

---

## Prompt 2 of 2 -- Mobile Screens 13-24 + Web Pages

```
Design system: Cool Obsidian (dark theme -- #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

App: MyHabits
Accent color: #10B981 (emerald green)
Platform: iOS mobile (Expo/React Native) screens 13-24, then web (Next.js 15) pages
Bottom tab bar: Home | Stats | Challenges | Timer | Settings

Design the following 12 screens:

13. STACKING (stacking.tsx)
- Header: "Habit Stacking"
- Explanation card: "After I [Habit A], I will [Habit B]" -- Atomic Habits methodology
- Visual chain view: vertical timeline connecting linked habits with arrows, each node is a habit card with name and checkbox
- "Create Stack" button: select Habit A (trigger), then Habit B (response), optional chain further
- Existing stacks list: each stack shown as a connected chain, tap to expand and see completion flow
- Completion cascades: completing Habit A prompts for Habit B, completing B prompts for C, etc.
- Drag handles on chain items to reorder

14. AREAS (areas.tsx)
- Header: "Areas"
- 6 area cards in a 2-column grid:
  - Health (red accent), Productivity (blue accent), Mindfulness (purple accent), Social (orange accent), Learning (yellow accent), Other (gray accent)
- Each card: area icon, area name, habit count, completion rate percentage, colored left border
- Tap area to see filtered habit list for that area
- Overall distribution pie/donut chart at top showing habit distribution across areas

15. TEMPLATES (templates.tsx)
- Header: "Habit Templates"
- 6 area section headers with expandable template lists
- 24 template cards total (4 per area):
  - Template name, default frequency label, short description (1 line)
  - "Add to My Habits" button on each card
  - Expandable detail: full description, suggested time of day, tips
- Search bar at top to filter templates
- Templates organized: Health (Drink Water, Exercise 30min, Sleep by 10pm, Take Vitamins), Productivity (Deep Work Block, Inbox Zero, Plan Tomorrow, Read 30min), Mindfulness (Meditate, Gratitude Journal, Digital Sunset, Nature Walk), Social (Call a Friend, Compliment Someone, Family Dinner, Volunteer), Learning (Practice Language, Code Challenge, Listen to Podcast, Write 500 Words), Other (Clean 10min, Budget Check, Stretch, Skin Care)

16. ONBOARDING (onboarding.tsx)
- 4-step paginated flow with dot indicators at bottom:
  - Step 1: Welcome screen -- app icon, "Build the life you want, one habit at a time", philosophy text "Small steps, big changes", "Get Started" button
  - Step 2: Pick 2-3 starter habits from template grid, selected habits highlighted with checkmark, "Skip" and "Next" buttons
  - Step 3: Set reminder times for each selected habit, time picker per habit, toggle reminders on/off
  - Step 4: Meet your pet -- 5 species selection cards, name input, "Let's Go!" button
- Progress bar at top spanning all 4 steps
- Each step has illustration/animation area at top

17. ACTION ITEMS (action-items.tsx)
- Header: habit name + "Action Items"
- Ordered checklist: numbered list of sub-tasks
- Each row: drag handle, checkbox, task name text, delete button (X)
- Completed items: strikethrough text, muted color
- "Add Item" row at bottom with text input
- Drag to reorder with haptic feedback indicator
- Progress indicator: "3/5 completed" at top

18. LOCATION REMINDERS (location.tsx)
- Header: "Location Reminders"
- Map view (top half): interactive map showing saved geofence circles
- Geofence list (bottom half): location name, radius display, linked habit name, trigger type (Arrive / Depart)
- "Add Location" button: opens map pin placement, radius slider (100m-1km), habit picker dropdown, arrive/depart toggle
- Active location reminders with toggle to enable/disable each
- Permission prompt card if location access not granted

19. SIRI SHORTCUTS (siri.tsx)
- Header: "Siri Shortcuts"
- Explanation banner: "Complete habits with your voice"
- Per-habit shortcut list: habit name, configured phrase (e.g. "Hey Siri, I meditated"), setup status (configured / not set up)
- "Set Up" button per habit: opens Siri phrase recording flow
- Example phrases section: "Hey Siri, I exercised", "Hey Siri, log my meditation"
- Shortcut management: edit phrase, delete shortcut

20. HEALTHKIT AUTO-TRACK (healthkit.tsx)
- Header: "Auto-Tracking"
- Apple Health integration banner with Health app icon
- Data type toggles:
  - Steps: linked habit selector, auto-complete threshold (e.g. 10,000 steps)
  - Sleep: linked habit selector, auto-complete threshold (e.g. 7+ hours)
  - Water Intake: linked habit selector, auto-complete threshold
  - Exercise Minutes: linked habit selector, auto-complete threshold
- Each toggle: data type icon, enable/disable switch, linked habit name, threshold input
- Last sync timestamp
- "Sync Now" button
- Permission status indicators

21. RPG (rpg.tsx)
- Header: "RPG Progress"
- Level display: large level number with progress bar to next level, XP count
- XP breakdown: base XP per completion, streak bonus multiplier, time-of-day bonus
- Level progression table: scrollable list showing level thresholds and unlockable rewards (pet items, badges)
- Recent XP gains: log of last 10 XP events with source habit, amount, bonuses applied
- Level badge display: current level badge prominently shown
- Leaderboard-style personal stats: total XP earned, highest level, longest earning streak

22. EXPORT (export.tsx)
- Header: "Export Data"
- Export format: CSV (selected by default)
- Date range picker: start date, end date
- Data fields included: habit name, date, completed (yes/no), streak at time, notes
- Preview section: sample rows of export data
- "Export" button: triggers system share sheet
- Export history: list of previous exports with date and file size

23. SETTINGS (settings.tsx)
- Header: "Settings"
- Default frequency: picker (Daily / Weekdays / Custom)
- Grace period days: stepper (0-7)
- Notification preferences: master toggle, quiet hours start/end time
- HealthKit toggle: enable/disable with status
- Siri toggle: enable/disable
- Theme: "Cool Obsidian" label (read-only, system theme)
- Data management: "Export Data", "Clear All Data" (danger)
- About: version number, privacy policy link

WEB PAGES (13 total -- desktop-optimized):

W1. DASHBOARD (/habits)
- Left sidebar navigation: all module links
- Main area: today's habits in a wide card layout, grouped by area, date picker at top
- Right sidebar: stats summary (streak, completion rate), upcoming reminders
- Desktop-optimized heatmap spanning full content width

W2. ADD HABIT (/habits/add)
- Centered form card with all habit creation fields
- Template browser in sidebar or modal
- NLP input bar at top of form

W3. HABIT DETAIL (/habits/[id])
- Two-column layout: left has habit info and controls, right has heatmap and charts
- Sub-tasks list with inline editing

W4. STATS (/habits/stats)
- Full-width charts: daily completion bar chart, year heatmap, time distribution
- Filterable by area, date range

W5. CHALLENGES (/habits/challenges)
- Program cards in a responsive grid (3 columns on desktop)
- Expanded program detail view with daily schedule

W6. TIMER (/habits/timer)
- Centered large timer display, session history sidebar

W7. TIME TRACKING (/habits/time-tracking)
- Table view with sortable columns, project grouping, running totals

W8. SOBRIETY (/habits/sobriety)
- Large clock display centered, stats cards flanking, pledge card below

W9. BADGES (/habits/badges)
- Badge grid with hover tooltips, category filter tabs

W10. PET (/habits/pet)
- Large pet display centered, wardrobe grid on side

W11. STACKING (/habits/stacking)
- Horizontal chain visualization, drag-and-drop on desktop

W12. TEMPLATES (/habits/templates)
- Searchable grid with category sidebar filter

W13. SETTINGS (/habits/settings)
- Standard settings form, two-column layout on wide screens
```
