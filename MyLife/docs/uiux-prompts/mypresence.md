# MyPresence -- UI/UX Design Prompt

Tagline: Put your phone down. Pick your life up.
Icon: 📱 | Accent: #0891B2 | Tier: Premium
Bottom tabs: Home | Stats | Sessions | Intentions | Settings

```
Design system: Cool Obsidian (dark theme — #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

Module: MyPresence
Accent color: #0891B2 (cyan/teal)
Platform: Mobile (Expo / React Native) + Web (Next.js 15)
Total screens: 11

---

SCREEN 1 — HOME (index.tsx) [Mobile, Tab: Home]

- Daily screen time summary card
  - Large text: total screen time today (e.g. "3h 42m")
  - Comparison to daily average: "+12m above average" or "-30m below average"
  - Color-coded: green if below goal, orange if near goal, red if over goal
- 30-day trend mini-chart
  - Compact sparkline or small bar chart showing daily screen time over last 30 days
  - Goal line overlay
  - Tap to navigate to Stats screen
- Top apps by usage
  - Ranked list of top 5 apps today
  - Each row: app icon placeholder, app name, time used, category badge
  - Small horizontal bar showing proportion of total screen time
- XP level display
  - Level badge (e.g. "Level 12") with XP progress bar to next level
  - Total XP number shown
- Streak badges row
  - Horizontal scrollable row of recent streak badges
  - Active streak count displayed (e.g. "7-day streak")
  - Badges glow or pulse if streak is active

---

SCREEN 2 — STATS (stats.tsx) [Mobile, Tab: Stats]

- App usage by category
  - Categories: Social, Entertainment, Productivity, Communication, Utilities, Games, Other
  - Each category shows total time and percentage
  - Tappable to expand and see individual apps within category
- Daily usage bar chart
  - Vertical bar chart, one bar per day, last 7 or 14 days
  - Each bar segmented by category (color-coded)
  - Goal line shown as horizontal dashed line
  - Tap a bar to see day detail
- Distribution pie chart
  - Donut chart showing category breakdown for selected time period
  - Legend with category names, colors, and percentages
  - Center text: total screen time for period
- Time period selector
  - Segmented control: Today, 7 Days, 30 Days, 90 Days
  - All charts update based on selection

---

SCREEN 3 — SESSIONS (sessions.tsx) [Mobile, Tab: Sessions]

- Focus session list
  - Each row: session date/time, duration (e.g. "25 min"), type badge
  - Type badges: Solo (accent color), Group (purple), Beast (red/orange gradient)
  - Completion status: checkmark for completed, "X" for abandoned
  - XP earned shown per session
- Start new session button
  - Prominent button at top or FAB: "Start Focus Session"
  - Tap opens session type picker (Solo, Group, Beast Mode)
  - Duration picker: 15, 25, 45, 60, 90 minutes or custom
- Filter/sort
  - Filter by type, completion status
  - Sort by date, duration, XP earned
- Weekly session summary
  - Small card at top: sessions this week, total focus time, completion rate

---

SCREEN 4 — INTENTIONS (intentions.tsx) [Mobile, Tab: Intentions]

- Per-app limits list
  - List of apps with configured intentions
  - Each row: app name, daily opens limit, per-open time limit, breathing pause status
  - Toggle to enable/disable each app's intentions
- Add app intention
  - "Add App" button at top
  - App picker (list of installed apps or manual entry)
- Per-app configuration (bottom sheet on tap)
  - Daily opens limit: number stepper (e.g. max 10 opens per day)
  - Per-open time limit: duration picker (e.g. 5 minutes per session)
  - Breathing pause toggle: when enabled, shows a 3-breath pause screen before the app opens
  - Current usage today vs limit shown
- Breathing pause preview
  - Small preview card showing what the breathing pause looks like
  - "3 deep breaths before opening [App Name]"
- Summary card at top
  - Number of apps with active intentions
  - Apps over limit today (count, highlighted in red)

---

SCREEN 5 — ACTIVE SESSION (session-active.tsx) [Mobile, full screen overlay]

- Full-screen focus timer
  - Minimal chrome -- nearly everything hidden
  - Background: deep dark (#0A0A0F) or subtle gradient
  - Large countdown timer centered: "18:42" remaining
  - Thin progress ring or bar at top showing session progress
- Session type indicator
  - Small badge at top: "Solo Focus" / "Group Focus" / "Beast Mode"
  - Beast Mode uses red/orange accent instead of teal
- Rotating motivational messages
  - Subtle text below timer, changes every 30-60 seconds
  - Examples: "Stay present", "You're doing great", "Your mind is clearing"
  - Fade in/out animation
- Abandon button
  - Small, de-emphasized text at bottom: "End Session"
  - Requires confirmation tap
  - Warns about XP penalty for early abandonment
- No navigation bar, no status indicators, no distractions

---

SCREEN 6 — SESSION COMPLETE (session-complete.tsx) [Mobile, full screen]

- Time completed display
  - Large text: "25 minutes of focus"
  - Checkmark animation or success icon
- XP earned
  - "+150 XP" displayed with accent color
  - Breakdown: base XP + streak bonus + beast mode multiplier (if applicable)
- Streak status update
  - "7-day streak!" or "Streak started!" or "Streak continues!"
  - Streak badge animation if new milestone reached
- Celebration animation
  - Confetti or particle effect (subtle, on-brand)
  - Short duration, non-blocking
- Action buttons
  - "Done" -- returns to Sessions tab
  - "Start Another" -- opens new session picker
- Session note (optional)
  - Small text input: "How did that feel?" (optional, dismissible)

---

SCREEN 7 — BADGES (badges.tsx) [Mobile, accessed from Home or Settings]

- Badge grid gallery
  - Grid layout (3 columns) of badge icons
  - Earned badges: full color, glowing border
  - Locked badges: grayscale, lock icon overlay
- Per-badge detail (tap to expand or bottom sheet)
  - Badge name and icon (large)
  - Unlock criteria description (e.g. "Complete 30 consecutive days of focus sessions")
  - Earned date (if unlocked): "Earned March 15, 2026"
  - Progress toward unlock (if locked): "22/30 days" with progress bar
- Badge categories
  - Sections: Streaks, Sessions, Screen Time, Milestones, Special
  - Section headers with count: "Streaks (4/8 earned)"
- Total badges earned
  - Summary at top: "12 of 24 badges earned"

---

SCREEN 8 — INSIGHTS (insights.tsx) [Mobile, accessed from Home or Stats]

- Trend analysis charts
  - Screen time trend: line chart over 30/60/90 days with trend direction
  - Focus session frequency: bar chart showing sessions per week
  - Average daily screen time by day of week (reveals patterns)
- Streak history
  - Timeline visualization of past streaks
  - Longest streak highlighted
  - Current streak if active
- Weekly summaries
  - Expandable list of past weeks
  - Each week: total screen time, sessions completed, XP earned, badge unlocks
- Recommendations
  - Personalized suggestions based on usage patterns
  - Examples: "You use Social apps most on Sundays -- try a Sunday focus session"
  - "Your screen time drops on days you complete a morning session"
  - Styled as glass cards with lightbulb icon

---

SCREEN 9 — DAILY REPORT (report.tsx) [Mobile, accessed from Home]

- Report header
  - Date prominently displayed
  - Overall grade or score for the day (A-F or 0-100)
- Total screen time card
  - Time value, comparison to goal, comparison to 7-day average
- App breakdown table
  - Ranked list of all apps used today
  - Columns: app name, time, opens count, category
  - Sorted by time (descending)
- Focus sessions card
  - Sessions completed today, total focus time, XP earned
- XP earned today
  - Breakdown: session XP, streak bonus, intention compliance bonus
- Recommendations section
  - 2-3 actionable tips based on today's data
  - "Try limiting [app] to X minutes tomorrow"
  - "Great job staying under your social media goal!"
- Share button
  - Optional: share daily summary as image (privacy-safe, no app names)

---

SCREEN 10 — SETTINGS (settings.tsx) [Mobile, Tab: Settings]

- Daily focus goal
  - Time picker or stepper: target screen time per day (e.g. 3 hours)
  - Separate goal for focus session minutes per day
- Measurement system
  - Toggle: show time as hours:minutes or decimal hours
- App categories configuration
  - List of categories with assigned apps
  - Drag to reassign apps between categories
  - Add custom category
- Notifications section
  - Toggle: daily report reminder
  - Toggle: screen time approaching goal warning
  - Toggle: streak at risk reminder
  - Toggle: focus session reminders (with time picker)
- Data section
  - Export usage data (CSV)
  - Clear all data (with confirmation)
- About section
  - XP system explanation
  - Badge criteria overview link

---

SCREEN 11 — WEB PAGES NOTE

Web mirrors 8 core mobile screens adapted for desktop layout:

1. Dashboard (/presence) -- Home screen content in card grid layout, wider charts
2. Stats (/presence/stats) -- Full statistics dashboard with larger interactive charts
3. Sessions (/presence/sessions) -- Session history table with filters, start session button
4. Intentions (/presence/intentions) -- App intention management in table/card layout
5. Badges (/presence/badges) -- Badge gallery in wider grid (4-5 columns)
6. Insights (/presence/insights) -- Trend charts and recommendations in 2-column layout
7. Settings (/presence/settings) -- All settings in card sections
8. Daily Report (/presence/report) -- Full daily report with exportable format

All web pages use the same Cool Obsidian design system, adapted for wider viewports with sidebar navigation instead of bottom tabs.
```
