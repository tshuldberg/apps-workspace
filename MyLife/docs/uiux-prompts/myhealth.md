# MyHealth -- UI/UX Design Prompts

**Tagline:** Your health data, on your device, under your control
**Icon:** ❤️ | **Accent:** #EF4444 | **Tier:** Premium
**Bottom Tabs:** Today | Vitals | Activity | Vault | Settings

---

## Prompt 1 of 3 -- Mobile Screens 1-12

```
Design system: Cool Obsidian (dark theme -- #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

App: MyHealth
Accent color: #EF4444 (red)
Platform: iOS mobile (Expo/React Native)
Bottom tab bar: Today | Vitals | Activity | Vault | Settings

Design the following 12 screens:

1. TODAY (index.tsx)
- Header: "Today" with current date
- Active fast status card: if fasting, show elapsed time, fast type, progress ring; if not fasting, show "No active fast" with "Start Fast" button
- Due meds card: list of medications due now or overdue, each with name, dosage, time, "Take" button; green checkmark if already taken
- Current mood indicator: emoji + score from most recent mood entry, "Log Mood" quick action
- Vitals summary row: 4 mini cards in horizontal scroll -- steps (with step count), heart rate (BPM), blood oxygen (%), sleep quality (score)
- Sleep quality last night: hours slept, quality score bar
- Active health goals: up to 3 goal cards with progress bars (e.g. "10,000 steps: 7,234/10,000")
- Quick action buttons row: "Log Vital", "Log Mood", "Start Fast", "Take Meds"

2. VITALS (vitals.tsx)
- Header: "Vitals"
- 10 vital type cards in a 2-column grid:
  - Heart Rate (heart icon, BPM)
  - Resting Heart Rate (resting heart icon, BPM)
  - HRV (wave icon, ms)
  - Blood Oxygen (O2 icon, %)
  - Blood Pressure (gauge icon, mmHg)
  - Temperature (thermometer icon, degrees)
  - Steps (footprint icon, count)
  - Active Energy (flame icon, kcal)
  - Respiratory Rate (lungs icon, breaths/min)
  - VO2 Max (mountain icon, mL/kg/min)
- Each card: vital type icon, name, most recent value, mini sparkline chart (last 7 readings), trend arrow (up/down/stable)
- Tap card to navigate to vital detail
- "Log Vital" FAB button at bottom-right

3. VITAL DETAIL (vital-detail.tsx)
- Header: vital type name (e.g. "Heart Rate")
- Trend chart: line chart showing readings over time, accent-colored line
- Date range picker: segmented control (1W / 1M / 3M / 6M / 1Y / All)
- Baseline comparison: dashed horizontal line at baseline value, label showing baseline
- Abnormal readings highlighted: data points outside normal range shown in red
- Recent readings list below chart: date, time, value, normal/abnormal indicator
- Normal range reference card: "Normal range: 60-100 BPM" with source citation
- "Log New" button at bottom

4. MEASUREMENT LOG (measurement-log.tsx)
- Header: "Log Vital"
- Type picker: dropdown or segmented tabs for 10 vital types
- Value input: large numeric input with unit display (e.g. "BPM", "mmHg", "%")
- For blood pressure: two inputs (systolic / diastolic)
- Timestamp: default "Now" with option to set custom date/time
- Notes: optional text input
- "Save" button, accent-colored, full width
- Recent entries list below for quick reference

5. SLEEP STAGES (sleep-stages.tsx)
- Header: "Sleep Analysis"
- Last night's sleep summary: total time, time in bed, sleep efficiency percentage
- Sleep quality score: large 0-100 score in circular gauge
- Stage breakdown stacked bar: horizontal bar showing Deep (dark blue) / REM (purple) / Light (light blue) / Awake (red) proportions
- Stage duration labels: hours and minutes per stage
- Nightly trend chart: line chart showing sleep quality score over last 30 nights
- Sleep/wake time consistency chart: dot plot showing bedtime and wake time variation
- "Last Night" / "This Week" / "This Month" date navigation

6. SMART ALARM (smart-alarm.tsx)
- Header: "Smart Alarm"
- Target wake time: large time picker, prominently displayed
- Wake window display: "Will wake you between 6:30 and 7:00 during light sleep"
- 30-minute light sleep detection window explanation card
- Alarm toggle: large on/off switch
- Sound picker: list of alarm sounds with play preview button
- Days active: day-of-week toggles (M T W T F S S)
- Snooze settings: enable/disable, snooze duration picker

7. BREATHING (breathing.tsx)
- Header: "Breathing Exercises"
- 5 pattern cards in a vertical list:
  - Box Breathing: "4-4-4-4" -- inhale 4s, hold 4s, exhale 4s, hold 4s
  - 4-7-8 Breathing: inhale 4s, hold 7s, exhale 8s
  - Relaxing: slow deep breaths, 6 breaths/min
  - Energizing: rapid rhythmic breathing
  - Sleep Prep: progressively slower breaths
- Each card: pattern name, timing description, duration estimate, "Start" button
- Pre-session mood check: "How do you feel? (1-10)" slider before starting
- Active session: animated expanding/contracting circle with phase labels (Inhale / Hold / Exhale), timer countdown per phase
- Post-session mood check: same 1-10 slider, comparison display ("Before: 4 -> After: 7")

8. BODY COMPOSITION (body-composition.tsx)
- Header: "Body Composition"
- BMI calculator card: height input (ft/in or cm), weight input (lbs or kg), calculated BMI with category label (Underweight/Normal/Overweight/Obese), color-coded gauge
- Body weight trend chart: line chart over time with goal line if set
- Lean mass tracker: input and trend chart
- Body fat percentage tracker: input and trend chart
- Measurement log: "Add Measurement" button, date, weight, body fat %, lean mass
- Goal card: target weight or body fat %, progress bar

9. READINESS (readiness.tsx)
- Header: "Daily Readiness"
- Large readiness score gauge: 0-100, semi-circular dial, color gradient (red 0-40, yellow 40-70, green 70-100)
- Score label: "Your body is ready" / "Take it easy today" / "Push yourself today" based on score
- Contributing factors breakdown: 5 horizontal bars
  - Sleep Quality (weight, current value)
  - HRV (weight, current value)
  - Resting Heart Rate (weight, current value)
  - Yesterday's Activity (weight, current value)
  - Strain Level (weight, current value)
- 7-day readiness trend: sparkline chart
- Recommendations card: AI-generated suggestion based on score (e.g. "High readiness -- good day for intense workout")

10. HRV (hrv.tsx)
- Header: "HRV Analysis"
- Current HRV: large ms value display
- 7-day baseline: horizontal bar showing current vs baseline, percentage difference
- Percentile rank: "Your HRV is in the Xth percentile for your age group"
- Trend chart: line chart with 7-day moving average overlay, date range picker
- Insight text card: glass surface with AI insight (e.g. "Your HRV is trending up -- good recovery sign")
- Contributing factors: sleep quality correlation, stress events correlation
- "What is HRV?" expandable info card

11. ACTIVITY (activity.tsx)
- Header: "Activity"
- 3 activity rings (Apple Health style): outer ring = Active Energy (kcal), middle ring = Exercise Minutes, inner ring = Move Hours (stand hours)
- Ring labels with current/goal values below rings
- Step count: large number with daily goal progress bar
- Activity streaks: "X days in a row meeting all goals" with flame icon
- Weekly comparison: 7-day bar chart comparing this week vs last week
- "Log Workout" quick action button
- Move reminder settings toggle

12. MOOD CHECK-IN (mood-check-in.tsx)
- Header: "Mood Check-In"
- Score slider: horizontal 1-10 with emoji faces at intervals (sad face at 1, neutral at 5, happy at 10)
- Current medications list: checkboxes showing which meds were taken today (auto-populated from meds module)
- Activities checklist: exercise, social, work, sleep quality, food quality, outdoors, creative, screen time
- Optional note: text input for free-form journaling
- "Save" button
- Recent mood entries list: date, time, score, brief note preview
- Mood trend mini-chart: last 7 days sparkline
```

---

## Prompt 2 of 3 -- Mobile Screens 13-23

```
Design system: Cool Obsidian (dark theme -- #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

App: MyHealth
Accent color: #EF4444 (red)
Platform: iOS mobile (Expo/React Native)
Bottom tab bar: Today | Vitals | Activity | Vault | Settings

Design the following 11 screens:

13. GROUNDING / SOS (grounding.tsx)
- Header: "Grounding Exercise" with red SOS accent
- 5-step sensory grounding flow, one step per card (swipe or "Next" to advance):
  - Step 1: "Name 5 things you can SEE" -- eye icon, 5 text input fields
  - Step 2: "Name 4 things you can HEAR" -- ear icon, 4 text input fields
  - Step 3: "Name 3 things you can TOUCH" -- hand icon, 3 text input fields
  - Step 4: "Name 2 things you can SMELL" -- nose icon, 2 text input fields
  - Step 5: "Name 1 thing you can TASTE" -- tongue icon, 1 text input field
- Progress indicator: 5 dots showing current step
- Completion screen: "You're grounded. Take a deep breath." with breathing exercise link
- Crisis hotline card at bottom (always visible): National Suicide Prevention Lifeline, Crisis Text Line, 988 number, one-tap call buttons
- "Start Breathing Exercise" link

14. VAULT (vault.tsx)
- Header: "Health Vault"
- Document categories as section headers with counts:
  - Lab Results (blood work icon)
  - Prescriptions (pill icon)
  - Insurance Cards (card icon)
  - Imaging (scan icon)
  - Other (folder icon)
- Each document row: document title, type badge, date, thumbnail preview
- Search bar at top: search by document name, type, date
- "Add Document" FAB button at bottom-right
- Sort options: by date (newest first), by type, by name
- Total document count at top

15. DOCUMENT VIEWER (document-viewer.tsx)
- Full-screen document display
- Pinch-to-zoom gesture support
- Rotate button in toolbar
- Document title and date in top bar
- Share button: system share sheet
- Edit button: navigate to edit document metadata
- Delete button with confirmation dialog
- Page indicator if multi-page document
- Dark background to match theme

16. ADD DOCUMENT (add-document.tsx)
- Header: "Add Document"
- Photo/file upload area: large dashed-border drop zone with camera icon and "Take Photo" / "Choose File" buttons
- Type classification picker: segmented or dropdown (Lab Results / Prescription / Insurance Card / Imaging / Other)
- Date picker: date of document
- Title: text input
- Notes: multi-line text input
- Provider name: optional text input
- "Save" button, accent-colored, full width

17. EMERGENCY INFO (emergency-info.tsx)
- Header: "Emergency Info" with red accent badge
- "Always accessible" subtitle -- available from lock screen
- ICE Contacts section: list of contacts (name, phone, relationship), tap to call, "Add Contact" button
- Medical info cards:
  - Allergies: list with severity (mild/moderate/severe), "Add Allergy" button
  - Blood Type: picker (A+/A-/B+/B-/AB+/AB-/O+/O-)
  - Medical Conditions: list with "Add Condition" button
  - Organ Donor Status: toggle (Yes / No / Undeclared)
- All fields editable inline
- "Share Emergency Info" button to generate shareable card

18. ADD GOAL (add-goal.tsx)
- Header: "New Health Goal"
- 8 goal type cards in a 2x4 grid:
  - Fasting (clock icon)
  - Weight (scale icon)
  - Steps (footprint icon)
  - Sleep (moon icon)
  - Med Adherence (pill icon)
  - Water Intake (water icon)
  - Vitals (heart icon)
  - Custom (star icon)
- Target value input: numeric with unit label (varies by type)
- Frequency: Daily / Weekly / Monthly
- Start date picker
- Reminder toggle with time picker
- "Create Goal" button

19. HEALTH SYNC (health-sync-settings.tsx)
- Header: "Health Sync"
- HealthKit / Health Connect integration banner
- Per-data-type toggle list:
  - Steps: toggle, sync direction (Read / Write / Both)
  - Heart Rate: toggle, sync direction
  - Sleep: toggle, sync direction
  - Weight: toggle, sync direction
  - Blood Oxygen: toggle, sync direction
  - Blood Pressure: toggle, sync direction
  - Active Energy: toggle, sync direction
  - Exercise Minutes: toggle, sync direction
  - HRV: toggle, sync direction
  - Respiratory Rate: toggle, sync direction
- Last sync timestamp: "Last synced: 2 min ago"
- "Sync Now" manual sync button
- Permission status: granted / denied per data type

20. SNORE DETECTION (snore.tsx)
- Header: "Snore Detection"
- Session controls: large "Start Recording" / "Stop Recording" button
- Active session indicator: recording duration, microphone animation
- Event classification: detected events shown in real-time list as light / moderate / heavy snoring
- Session score: 0-100 after session ends, based on snoring frequency and intensity
- Session history list: date, duration, score, event count per session
- Tips card: "Place phone on nightstand, face up, within 1 meter"

21. EXPORT (export.tsx)
- Header: "Export Data"
- Format picker: PDF / CSV toggle
- Date range: start date, end date pickers
- Data types to include: checkbox list (Vitals, Sleep, Mood, Activity, Goals, Medications, Fasting, Documents)
- Preview card: sample of what export will contain
- "Export for Doctor" button: generates formatted PDF with patient info header
- Share via system share sheet
- Export history: previous exports with date and format

22. MIGRATION PROMPT (migration-prompt.tsx)
- Welcome banner: "Welcome to MyHealth!"
- Explanation card: "Your data from standalone meds, fasting, and cycle modules can be imported into MyHealth"
- Import summary: list of detected data sources with record counts
  - MyMeds: X medications, Y adherence records
  - MyFast: X fasting sessions
  - MyCycle: X cycle records
- "Import All" primary button
- "Import Selected" secondary button with checkboxes per source
- "Skip" text link
- Progress indicator during import

23. MEDITATION / CBT (meditation-cbt.tsx)
- Two-tab layout: Meditation | CBT
- Meditation tab:
  - Template browser: categories (Calm / Focus / Sleep / Gratitude / Body Scan)
  - Each template: name, duration, description, "Start" button
  - Active session: step progress, instruction text, ambient sound toggle, timer
  - Completion: pre/post mood comparison
- CBT tab:
  - Thought record form: situation, automatic thought, emotion (with intensity 1-10), cognitive distortion picker (12 types), balanced thought, outcome emotion
  - Thought record history list
  - Behavioral activation: activity scheduling, mood tracking per activity
```

---

## Prompt 3 of 3 -- Web Pages

```
Design system: Cool Obsidian (dark theme -- #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

App: MyHealth
Accent color: #EF4444 (red)
Platform: Web (Next.js 15, desktop-optimized)
Layout: Persistent left sidebar with module navigation

Design the following 8 web pages:

W1. DASHBOARD (/health)
- Left sidebar: module navigation links with icons
- Main content area: 3-column layout on desktop
  - Left column: Today's summary card (fast status, due meds, mood, goals)
  - Center column: vitals overview grid (2x5 vital type cards with sparklines), activity rings
  - Right column: recent activity feed (mood entries, vital logs, medication taken, goals progress)
- Top bar: date navigation, "Log Vital" and "Log Mood" action buttons
- Responsive: collapses to single column on narrow viewports

W2. VITALS (/health/vitals)
- Full-width content area
- Vital type selector: horizontal tab bar or sidebar filter (10 types)
- Selected vital: large interactive chart (line/bar, zoomable, tooltips on hover)
- Date range picker: 1W / 1M / 3M / 6M / 1Y / All
- Readings table below chart: sortable columns (date, time, value, normal/abnormal)
- Baseline overlay on chart
- "Log New Vital" button in header
- Abnormal readings highlighted in table rows

W3. SLEEP (/health/sleep)
- Two-panel layout:
  - Left panel: sleep stage breakdown for selected night (stacked horizontal bar), sleep quality score gauge, stage durations
  - Right panel: trend charts (quality score over time, bedtime/wake time consistency, stage proportion trends)
- Night selector: calendar date picker or "Previous / Next" navigation
- Sleep efficiency percentage prominent display
- Smart alarm settings card below charts

W4. GOALS (/health/goals)
- Goal cards in responsive grid (3 columns desktop)
- Each card: goal type icon, title, progress bar, current/target values, streak count
- "Add Goal" button top-right
- Filter tabs: All | Active | Completed
- Goal detail modal on click: edit goal, view history chart, delete

W5. MOOD (/health/mood)
- Timeline view: chronological mood entries with score, emotions, activities, notes
- Side panel: trend chart (daily average over time), activity correlation bar chart, most frequent emotions list
- "Log Mood" button in header
- Date range filter
- Mood heatmap calendar view option

W6. EMERGENCY (/health/emergency)
- Centered card layout
- ICE contacts: table with name, phone, relationship, edit/delete
- Medical info: allergies table, blood type display, conditions list, organ donor status
- All fields inline-editable
- "Print Emergency Card" button: generates printable PDF
- "Share" button for digital sharing

W7. EXPORT (/health/export)
- Centered form layout
- Format selector: PDF / CSV radio buttons
- Date range pickers (start, end)
- Data type checkboxes in a 2-column grid
- Preview pane: shows sample output
- "Generate Export" primary button
- Download area: previous exports with download links

W8. SYNC (/health/sync)
- Settings form layout
- HealthKit / Health Connect status banner
- Per-data-type table: columns for data type, enabled toggle, sync direction dropdown, last synced timestamp
- "Sync Now" button at top
- Sync log: recent sync events with status (success/failed/partial), timestamp, records synced
- Permission management links
```
