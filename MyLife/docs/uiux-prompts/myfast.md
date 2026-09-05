# MyFast -- UI/UX Design Prompt

Tagline: Fasting & hydration, completely private
Icon: ⏱️ | Accent: #F97316 | Tier: Free
Bottom tabs: Timer | History | Stats | Settings

```
Design system: Cool Obsidian (dark theme — #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

Module: MyFast
Accent color: #F97316 (orange)
Platform: Mobile (Expo / React Native) + Web (Next.js 15)
Total screens: 10

---

SCREEN 1 — TIMER (index.tsx) [Mobile, Tab: Timer]

- Full-screen active fast timer display
  - Large elapsed time counter (HH:MM:SS) centered on screen
  - Goal progress ring surrounding the timer, fills clockwise as fast progresses, colored with accent #F97316
  - Inside the ring: current fasting zone label and zone icon
- Fasting zone progression indicator
  - 6 zones displayed as horizontal segmented bar below timer: Fed State, Post-Absorptive, Early Fasting, Fasting, Deep Fasting, Extended
  - Active zone highlighted with accent color, completed zones dimmed, upcoming zones outlined
  - Zone transition times labeled beneath each segment
- Protocol selector
  - Pill/chip at top of screen showing current protocol (e.g. "16:8")
  - Tap to open bottom sheet with protocol options: 16:8, 18:6, 20:4, OMAD, Custom
- Eating window awareness
  - Text below timer: "Eating window opens in X hours" or "Eating window closes in X hours"
  - Visual indicator (green dot when in eating window, orange dot when fasting)
- Water counter section
  - Glass icon with current count (e.g. "6 glasses")
  - Increment (+) and decrement (-) buttons flanking the count
  - Subtle progress bar showing daily water goal completion
- Start/Stop fast button
  - Large pill button at bottom: "Start Fast" (accent color) or "End Fast" (danger red #FF453A)
  - Confirmation dialog when ending fast early

---

SCREEN 2 — CAFFEINE (caffeine.tsx) [Mobile, Tab: Timer, nested]

- Daily caffeine intake summary card
  - Total mg consumed today displayed prominently
  - Status badge: "Safe" (green #30D158), "Caution" (yellow #F59E0B), "Limit" (red #FF453A)
- Caffeine log list
  - Each entry: beverage name, mg amount, time consumed
  - Add button (+) opens bottom sheet with common beverages (coffee, espresso, tea, energy drink, custom)
- Metabolization timeline
  - Horizontal timeline chart showing caffeine level decay curve (5.7-hour half-life)
  - Current estimated caffeine level marked on curve
  - "Clear by" time displayed prominently (estimated time caffeine drops below threshold)
- Clear-by-time calculator
  - Shows projected time when caffeine will be below 50mg (sleep-safe threshold)
  - Warning if clear-by time is after desired bedtime

---

SCREEN 3 — HISTORY (history.tsx) [Mobile, Tab: History]

- Completed fasts list
  - Each row: protocol name badge (e.g. "16:8"), total duration (e.g. "16h 23m"), date, quality score (0-100 as circular badge)
  - Optional note preview (truncated, single line)
  - Swipe left to delete
- Filter/sort controls
  - Sort by: date (default), duration, quality score
  - Filter by protocol type
- Empty state
  - Illustration and "No fasts recorded yet -- start your first fast!" message

---

SCREEN 4 — STATS (stats.tsx) [Mobile, Tab: Stats]

- Streak tracking card
  - Current streak (days) displayed large
  - Longest streak displayed smaller below
  - Streak calendar heat map (last 30 days, colored cells for completed fasts)
- Weekly summary card
  - Total hours fasted this week
  - Average fast duration
  - Number of fasts completed
- Quality trends chart
  - Line chart showing quality score over last 30 fasts
  - Average quality line overlay
- Zone time distribution
  - Horizontal stacked bar or donut chart showing total time spent in each of the 6 fasting zones
  - Color-coded: each zone gets a shade progressing from light orange to deep orange
- Total hours fasted
  - Large stat: lifetime total hours

---

SCREEN 5 — WEIGHT (weight.tsx) [Mobile, Tab: Stats, nested]

- Weight entries list
  - Each row: weight value, date, optional note
  - Most recent entry at top
- Add weight entry button
  - FAB or header button, opens input with numeric keyboard
- Unit toggle
  - Segmented control: lbs / kg
  - Persists to settings
- Trend line chart
  - Line chart showing weight over time
  - 7-day moving average overlay line
- HealthKit sync status
  - Badge: "Synced" (green) or "Not connected" (gray)
  - Tap to open HealthKit permissions

---

SCREEN 6 — SETTINGS (settings.tsx) [Mobile, Tab: Settings]

- Protocol management section
  - List of protocols: 16:8, 18:6, 20:4, OMAD, Custom
  - Each shows fasting/eating window hours
  - Tap to edit custom protocol (fasting hours, eating window start time)
  - Active protocol indicated with checkmark
- Notifications section
  - Toggle switches for milestone notifications: 25%, 50%, 75%, Complete
  - Each toggle shows estimated notification time based on current protocol
- HealthKit sync toggle
  - On/off switch, permission prompt on first enable
- Apple Watch toggle
  - On/off switch for Watch companion app data sync
- Water reminder interval
  - Picker: Off, 30 min, 1 hour, 2 hours, 4 hours
- CSV export
  - Button: "Export Fast History"
  - Generates CSV and opens share sheet

---

SCREEN 7 — HUB (/fast) [Web]

- Timer display card
  - Same progress ring and elapsed time as mobile, centered in main content area
  - Current zone label and zone progression bar
- Active fast info
  - Protocol name, start time, projected end time
  - Eating window status
- Quick actions row
  - "Start Fast" / "End Fast" button
  - "Log Water" button with counter
  - "Log Caffeine" button
- Recent fasts sidebar card
  - Last 5 completed fasts with duration and quality score

---

SCREEN 8 — HISTORY (/fast/history) [Web]

- Detailed fast history table
  - Columns: Date, Protocol, Duration, Quality Score, Notes
  - Sortable columns
  - Pagination or infinite scroll
- Filter bar
  - Date range picker, protocol filter dropdown
- Analytics summary row above table
  - Total fasts, average duration, average quality, current streak

---

SCREEN 9 — STATS (/fast/stats) [Web]

- Statistics dashboard layout (2-column grid)
  - Streak card (current + longest)
  - Weekly summary card
  - Quality trends line chart (larger, interactive with tooltips)
  - Zone time distribution chart
  - Monthly comparison bar chart
  - Goal completion rate

---

SCREEN 10 — SETTINGS (/fast/settings) [Web]

- All settings from mobile, laid out in card sections
  - Protocol management with inline editing
  - Notification preferences
  - HealthKit sync status (display only on web)
  - Water reminder settings
  - Export section with CSV download button
```
