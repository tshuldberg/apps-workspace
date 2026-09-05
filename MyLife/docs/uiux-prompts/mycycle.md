# MyCycle -- UI/UX Design Prompt

Tagline: Your body, your data, your device
Icon: 🌙 | Accent: #F472B6 | Tier: Premium
Bottom tabs: Home | Calendar | History | Insights | Settings

```
Design system: Cool Obsidian (dark theme — #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

Module: MyCycle
Accent color: #F472B6 (pink)
Platform: Mobile (Expo / React Native)
Total screens: 12

---

SCREEN 1 — HOME (index.tsx) [Mobile, Tab: Home]

- Current phase indicator
  - Large circular phase ring at top center
  - Four phases color-coded around the ring: Menstrual (red), Follicular (soft pink), Ovulation (warm pink), Luteal (muted rose)
  - Active phase segment highlighted and labeled prominently
- Cycle day number
  - Large text inside the phase ring: "Day 14" style display
  - Subtitle: phase name (e.g. "Ovulation Phase")
- Next period prediction date
  - Card below phase ring: "Next period in X days" with predicted date
  - Confidence indicator (high/medium/low) shown as subtle text
- Fertile window dates
  - Card: "Fertile window: [date range]" with green accent dots
  - Current fertility status: "Fertile today" or "Not in fertile window"
- Quick log button
  - Prominent FAB or pill button: "Log Today"
  - Opens log screen (Screen 3) with today pre-selected

---

SCREEN 2 — CALENDAR (calendar.tsx) [Mobile, Tab: Calendar]

- Monthly calendar grid
  - Standard month view with day cells
  - Period days: filled red circles on dates
  - Fertile window days: filled green circles on dates
  - Predicted period days: outlined red circles (not yet confirmed)
  - Predicted fertile days: outlined green circles
  - Symptom markers: small colored dots below date number (one dot per logged symptom category)
  - Today highlighted with accent border
- Month navigation
  - Left/right arrows to change month
  - Month/year label centered
- Day detail on tap
  - Tapping a day opens a bottom sheet or navigates to log screen pre-filled for that date
  - Bottom sheet shows: logged symptoms, flow level, mood for that day
  - "Edit" button to modify log entry

---

SCREEN 3 — LOG (log.tsx) [Mobile, accessed from Home or Calendar]

- Date selector
  - Date shown at top, tap to change (defaults to today)
- Flow level picker
  - Horizontal segmented control or icon row: None, Spotting, Light, Medium, Heavy
  - Each level has a distinct icon (droplet sizes)
  - Selected state uses accent color
- Symptoms checklist
  - 13+ symptoms organized in categories:
    - Physical: cramps, headache, bloating, breast tenderness, fatigue, backache, nausea, acne
    - Mood: irritability, anxiety, mood swings, sadness, energy changes
  - Each symptom is a tappable chip/pill
  - Selected symptoms highlighted with accent color
  - Intensity selector appears on selection: Mild, Moderate, Severe (3 levels)
- Mood selector
  - Row of 5 mood icons (faces): Great, Good, Okay, Low, Bad
  - Single selection, highlighted with accent
- Notes field
  - Optional free-text input at bottom
- Save button
  - Full-width button at bottom: "Save Log"

---

SCREEN 4 — HISTORY (history.tsx) [Mobile, Tab: History]

- Cycle history list
  - Each row represents one complete cycle
  - Data shown per row: Cycle number, start date, cycle length (days), period length (days)
  - Mini stats badges: "28 days" cycle length, "5 days" period
  - Tap to expand or navigate to cycle detail
- Cycle detail (expanded or sub-screen)
  - Day-by-day breakdown of that cycle
  - Flow levels per day, logged symptoms summary
  - Comparison to average cycle length
- Summary stats at top
  - Average cycle length, average period length, total cycles tracked

---

SCREEN 5 — ANALYTICS (analytics.tsx) [Mobile, Tab: Insights, nested]

- Average cycle length card
  - Large number display (e.g. "28.3 days")
  - Standard deviation shown below (e.g. "+/- 1.2 days")
- Cycle length history chart
  - Bar chart showing length of last 12 cycles
  - Average line overlay
  - Shortest and longest cycle labeled
- Symptom frequency chart
  - Horizontal bar chart: each symptom with frequency percentage across all cycles
  - Sorted by most frequent
  - Color-coded by category (physical vs mood)
- Period length trends
  - Line chart showing period duration over last 12 cycles

---

SCREEN 6 — TEMPERATURE (temperature.tsx) [Mobile, Tab: Insights, nested]

- BBT logging
  - Date selector (defaults to today morning)
  - Decimal number input (e.g. 97.6 F or 36.4 C)
  - Unit toggle: Fahrenheit / Celsius
  - Time of measurement input
- Temperature chart
  - Line chart showing daily BBT readings over current and past cycles
  - Coverline calculation: horizontal dashed line drawn at calculated coverline level
  - Thermal shift detection: visual marker where sustained rise begins
  - Follicular phase readings in one color, luteal phase readings in another
- Cycle overlay
  - Chart background shading for cycle phases
  - Period days marked with subtle red band at bottom

---

SCREEN 7 — PREDICTIONS (predictions.tsx) [Mobile, Tab: Insights, nested]

- Prediction display card
  - Next period predicted date, large and prominent
  - Fertile window predicted range
  - Ovulation day estimate
- Prediction method info
  - Weighted moving average explanation (brief, collapsible)
  - Number of cycles used for prediction
- Prediction confidence
  - Confidence level: High (6+ regular cycles), Medium (3-5 cycles), Low (fewer than 3)
  - Visual confidence bar or badge
- Upcoming predictions list
  - Next 3 predicted cycles with dates
  - Each shows predicted period start, fertile window, ovulation day

---

SCREEN 8 — PARTNER SYNC (partner.tsx) [Mobile, Tab: Home, nested or Settings]

- Share code generation
  - "Generate Share Code" button
  - Displays 6-digit alphanumeric code with copy button
  - Code expiry timer (24 hours)
- Granular privacy controls
  - Toggle switches for each data category:
    - Period dates (on/off)
    - Fertile window (on/off)
    - Symptoms (on/off)
    - Mood (on/off)
    - Temperature (on/off)
    - Predictions (on/off)
  - Each toggle clearly labeled with what the partner will see
- Connected partner status
  - Partner name/identifier displayed
  - "Connected" badge with green dot
  - "Disconnect" button (with confirmation dialog)
- Empty state (no partner)
  - Illustration and explanation text
  - "Connect Partner" button to enter their share code

---

SCREEN 9 — PREGNANCY MODE (pregnancy.tsx) [Mobile, Tab: Home, nested]

- Week-by-week tracking
  - Current week number displayed large (e.g. "Week 24")
  - Week progress bar within the trimester
  - Trimester indicator: 1st / 2nd / 3rd with color coding
- Due date display
  - Prominent due date with countdown: "X days to go"
- Due date calculation methods
  - 4 methods available (selectable):
    - Last menstrual period (LMP)
    - Conception date
    - Ultrasound date
    - IVF transfer date
  - Selected method shown with calculated date
  - Ability to switch methods and see recalculated date
- Appointment scheduler
  - List of upcoming appointments with date, time, type (OB visit, ultrasound, lab work)
  - "Add Appointment" button
  - Edit/delete existing appointments
- Weekly info card
  - Brief info about current week (size comparison, development milestones)

---

SCREEN 10 — SYMPTOMS (symptoms.tsx) [Mobile, Tab: Insights, nested]

- Symptom categories
  - Physical symptoms section:
    - Cramps, headache, bloating, breast tenderness, fatigue, backache, nausea, acne
  - Mood symptoms section:
    - Irritability, anxiety, mood swings, sadness, energy changes
  - Additional symptoms (expandable)
- Intensity levels per symptom
  - 3 levels: Mild, Moderate, Severe
  - Displayed as selectable pills or stepper for each symptom
- Frequency stats per symptom
  - Percentage of cycles where each symptom was logged
  - Bar or sparkline showing occurrence pattern across cycle days
- Symptom-phase correlation
  - Which symptoms appear most in which phase
  - Visual: grouped by phase with frequency indicators

---

SCREEN 11 — INSIGHTS (insights.tsx) [Mobile, Tab: Insights]

- Phase pattern analysis card
  - Average duration of each phase across tracked cycles
  - Visual: stacked horizontal bar showing phase proportions
- Cycle length trends chart
  - Line chart of cycle lengths over time
  - Trend direction arrow: shortening, lengthening, or stable
  - Average line overlay
- Regularity scoring
  - Score from 0-100 based on cycle length consistency
  - Label: "Very Regular", "Regular", "Somewhat Irregular", "Irregular"
  - Factors listed: standard deviation, outlier count
- Trend direction summary
  - Cards for key metrics: cycle length trend, period length trend, symptom trend
  - Each shows directional arrow and brief description

---

SCREEN 12 — SETTINGS (settings.tsx) [Mobile, Tab: Settings]

- Default cycle length
  - Number input with stepper (default 28, range 20-45)
  - Used for predictions when fewer than 3 cycles logged
- Default period length
  - Number input with stepper (default 5, range 1-10)
- Notification preferences
  - Toggle: Period reminder (X days before predicted start)
  - Toggle: Fertile window reminder
  - Toggle: Log reminder (daily during period)
  - Days-before picker for each enabled notification
- Partner sharing settings
  - Link to Partner Sync screen
  - Current partner connection status shown
- Pregnancy mode toggle
  - Switch to enable/disable pregnancy mode
  - When enabled, navigates to pregnancy setup
- Data section
  - Export data (CSV)
  - Import from other apps
  - Delete all data (with confirmation, danger styled)
```
