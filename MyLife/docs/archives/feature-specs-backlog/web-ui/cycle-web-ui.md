# Feature Spec: Cycle Full Web UI

## Metadata
- **Module:** cycle
- **Task:** W14-9
- **Sprint:** W14
- **Estimated CC Time:** 5-7 hours
- **Depends On:** none (all 60+ module exports exist, 6 tables across 4 migrations, 4 engines, community page stub exists)
- **Blocks:** Cycle web QA pass, Cycle web design review
- **Reference Implementation:** `apps/web/app/books/` (layout, page, actions, sub-routes, tests)

## Design Pipeline Signoff

### Phase 1: Office Hours (Builder Mode)

**Core insight:** A cycle tracking app on desktop must exploit what mobile cannot: data density, multi-panel simultaneous views, and precision data entry. The narrowest wedge -- the single screen that makes users say "I need this on desktop" -- is the **BBT Temperature Chart with Interactive Coverline Analysis**. On mobile, you see a row of dots and a text label. On desktop, you see a full-width, interactive SVG chart with hover tooltips showing each reading, a dashed coverline, color-coded ovulation shift zones, and the ability to click any point to edit its value inline. This is the fertility awareness method (FAM) power user screen -- the one that makes serious cycle trackers open their laptop.

**What makes a cycle web app delightful vs mobile:**
1. **Data precision:** Temperature logging on desktop uses a proper numeric input with keyboard, not a phone number pad. Users recording BBT at 5:30am can type "97.8" faster on a keyboard than tapping a phone screen.
2. **Calendar density:** A full 3-month view with period days, fertile windows, predicted periods, and temperature overlay -- all visible at once. Mobile can show one month at a time. Desktop can show an entire quarter.
3. **Pregnancy dashboard:** Week-by-week progress, appointment timeline, development milestones, and upcoming appointments all on one screen. On mobile these are separate scrollable sections.
4. **Partner sharing management:** QR code display, permission toggles, shared view preview -- desktop lets you configure sharing while seeing the partner's view side-by-side.
5. **Insights data tables:** Sortable cycle history with length, period duration, regularity score per cycle. Copy-pasteable for sharing with a doctor.

**Web-specific affordances to leverage:**
1. **Interactive SVG temperature chart:** Hover for precise values, click to edit, drag to select date ranges. Coverline drawn as a dashed line. Shift zone highlighted in green.
2. **Keyboard shortcuts:** `L` to log today, `T` to enter temperature, `C` for calendar, `P` for predictions, `Esc` to dismiss modals.
3. **Multi-panel layouts:** Two-column: calendar/chart on left, log form on right. Pregnancy page: week progress on left, milestones/appointments on right.
4. **Data tables with sort/filter:** Cycle history table with sortable columns (start date, length, period length, regularity). Exportable.
5. **Print-optimized reports:** Temperature chart and cycle history printable for doctor visits.
6. **Deep linking:** Every cycle, day log, insights view, and pregnancy week is a unique URL.
7. **Date picker affordances:** Web date pickers are more precise than mobile. Calendar click-to-log is instant.

**Brainstorm scoring:**
- Demand signal: Fertility awareness method (FAM) users actively want desktop charting. Tempdrop and Fertility Friend both have web dashboards for this reason. Desktop is the "review and analyze" surface; mobile is the "quick morning log" surface.
- Narrowest wedge: Temperature chart + today dashboard. If the BBT chart is beautiful and the today view is information-dense, users adopt the web UI.
- Expansion path: Today -> Temperature Chart -> Calendar -> Pregnancy Mode -> Partner Sharing (each adds a reason to stay on desktop).

### Phase 2: Engineering Review

**Module surface area (verified from `modules/cycle/src/index.ts`):**
- 60+ named exports from `@mylife/cycle`
- 9 feature clusters: Cycle CRUD, Cycle Day CRUD, Symptom CRUD, Analytics, Prediction Engine, Temperature Engine, Pregnancy Engine, Sharing Engine, Pregnancy Week Data
- 7 SQLite tables (cy_ prefix) across 4 migration versions:
  - v1: cy_cycles, cy_cycle_days, cy_symptoms (+ 5 indexes)
  - v2: cy_temperatures (+ 2 indexes)
  - v3: cy_pregnancy_config, cy_appointments (+ 3 indexes)
  - v4: cy_partner_links (+ 2 indexes)
- Schema version: 4

**Current web state:**
- `apps/web/app/cycle/page.tsx` -- static stub with hardcoded metrics, no DB access
- `apps/web/app/cycle/community/page.tsx` -- client-only thread list (no server actions)
- No `layout.tsx`, no `actions.ts`, no sub-routes

**Server actions needed (`actions.ts`):**

```typescript
// DB helper
function db(): DatabaseAdapter  // getAdapter() + ensureModuleMigrations('cycle')

// Cycle CRUD
fetchCycles(limit?: number, offset?: number)
fetchCycle(id: string)
doCreateCycle(input: CreateCycleInput)
doEndCycle(cycleId: string, nextStartDate: string)
doDeleteCycle(id: string)
fetchCycleCount()

// Cycle Day CRUD
fetchCycleDayByDate(date: string)
fetchCycleDaysByDate(date: string)
fetchCycleDaysByCycle(cycleId: string)
doCreateCycleDay(input: CreateCycleDayRawInput)
doUpdateCycleDay(id: string, input: UpdateCycleDayInput)
doDeleteCycleDay(id: string)

// Symptoms
fetchSymptomsForDay(cycleDayId: string)
doAddSymptom(cycleDayId: string, category: string, symptom: string, intensity?: string)
doDeleteSymptom(id: string)

// Analytics
fetchCycleStats()
fetchSymptomFrequencies(limit?: number)

// Prediction (computed server-side)
fetchPrediction()  // internally: getCycles -> extract lengths -> predictNextPeriod
fetchCurrentPhase()  // internally: recent cycle + getCycleStats -> getCurrentPhase

// Temperature
fetchTemperatureByDate(date: string)
fetchTemperaturesByDateRange(startDate: string, endDate: string)
doUpsertTemperature(input: CreateTemperatureRawInput)
doDeleteTemperature(id: string)
fetchTemperatureAnalysis(startDate: string, endDate: string)  // wraps analyzeTemperatures

// Pregnancy
fetchActivePregnancy()
fetchPregnancyHistory()
doCreatePregnancy(input: CreatePregnancyInput)
doEndPregnancy(id: string, status: 'completed' | 'loss')
doUpdateDueDate(id: string, newDueDate: string)
fetchPregnancyWeekInfo(dueDate: string, lastPeriodDate?: string)

// Appointments
fetchAppointmentsByPregnancy(pregnancyId: string)
fetchUpcomingAppointments(pregnancyId: string)
doCreateAppointment(input: CreateAppointmentInput)
doUpdateAppointment(id: string, input: UpdateAppointmentInput)
doCompleteAppointment(id: string)
doDeleteAppointment(id: string)

// Partner sharing
fetchActivePartnerLink()
doCreatePartnerLink(input?: CreatePartnerLinkRawInput)
doUpdatePartnerLink(id: string, input: UpdatePartnerLinkInput)
doRevokePartnerLink(id: string)
fetchSharedView()  // wraps generateSharedView with current data
```

**Route structure (Next.js App Router):**

```
apps/web/app/cycle/
  layout.tsx              # Module layout with glass nav header + tab links
  page.tsx                # Today dashboard (phase ring, predictions, quick log, stats)
  actions.ts              # Server actions wrapping @mylife/cycle CRUD + engines
  calendar/page.tsx       # 3-month calendar view with period/fertile/predicted overlays
  log/page.tsx            # Daily log form (temperature, flow, symptoms, notes)
  insights/page.tsx       # BBT chart + cycle stats + symptom frequency patterns
  pregnancy/page.tsx      # Pregnancy mode (week tracker, milestones, appointments)
  history/page.tsx        # Cycle history data table (sortable, exportable)
  sharing/page.tsx        # Partner sharing setup + permissions + shared view preview
  community/page.tsx      # Community forums (already exists, wire to server actions)
  settings/page.tsx       # Temperature unit, data export/import, notifications
  __tests__/
    cycle-page.test.tsx
    insights-page.test.tsx
    pregnancy-page.test.tsx
    history-page.test.tsx
    log-page.test.tsx
```

**Data flow (per books reference pattern):**
1. `layout.tsx` renders glass header with nav links + `{children}` slot
2. Each page is `'use client'` with `useEffect` calling server actions
3. Server actions call `db()` (which runs `getAdapter()` + `ensureModuleMigrations('cycle')`)
4. Server actions call module CRUD/engine functions from `@mylife/cycle`
5. Client state managed via local `useState` per page (no global state library)
6. All mutations go through server actions; client re-fetches after mutation
7. All server action calls wrapped in try/catch/finally to prevent stuck loading states

**Architecture decisions:**
- Temperature chart: Custom SVG in the browser (no charting library). Dots for readings, dashed line for coverline, green zone for shift. Hover tooltips via mouse events. Same approach as mobile's dot-based chart but with proper SVG axes and labels.
- Calendar: CSS grid (7 columns x ~5 rows per month). 3-month view on desktop. Day cells color-coded: pink fill for period, pink outline for predicted period, subtle highlight for fertile window.
- Pregnancy week progress: CSS progress bar (same approach as other modules). Week data from `PREGNANCY_WEEK_DATA` static array.
- Community: already has a client-side stub. Wire to forums DB adapter pattern (same as mobile's `toForumsDb` wrapper).
- No date library needed. All date operations use the module's built-in helpers (ISO string math).

**Engine function mapping per page:**

| Page | Engine Functions Used |
|------|---------------------|
| Today (page.tsx) | `getCycleStats`, `getCycles`, `getCurrentPhase`, `predictNextPeriod`, `isLateByDays` |
| Calendar | `getCycleDaysByCycle`, `predictNextPeriod`, `getCurrentPhase` |
| Log | `upsertTemperature`, `createCycleDay`, `addSymptom`, `getTemperatureByDate`, `getCycleDayByDate` |
| Insights | `getTemperaturesByDateRange`, `analyzeTemperatures`, `celsiusToFahrenheit`, `getCycleStats`, `getSymptomFrequencies` |
| Pregnancy | `getActivePregnancy`, `getCurrentWeek`, `getCurrentTrimester`, `getDaysUntilDue`, `getPregnancyWeekInfo`, `formatWeekDisplay`, `getUpcomingAppointments` |
| History | `getCycles`, `getCycleDaysByCycle`, `getCycleStats` |
| Sharing | `getActivePartnerLink`, `generateSharedView`, `generateShareCode` |

**Missing CRUD operations:** None. The module has full CRUD coverage for all 7 tables. All engine functions are pure and tested. No new module code is needed.

### Phase 3: Design Review

**Rating per dimension:**

| Dimension | Score | Notes |
|-----------|-------|-------|
| Layout & Composition | 9/10 | Two-column dashboard, full-width chart, centered pregnancy tracker, dense data tables |
| Typography | 9/10 | Full Cool Obsidian type scale. heroTitle for dashboard, stat for cycle day/countdown, subheading for cards |
| Color | 10/10 | Pink accent #F472B6 throughout. Green #30D158 for temp shift/success. Red #FF453A for late/danger. Teal for fertile window |
| Spacing & Rhythm | 9/10 | Token-based spacing. Cards use xl radius. Sections separated by lg gap |
| States (5/5) | 9/10 | Loading (skeleton), Empty (warm CTA), Error (retry), Success, Partial -- all designed per page |
| Interaction | 9/10 | Keyboard shortcuts, hover tooltips on chart, click-to-log on calendar, toggle chips for symptoms |
| Responsive | 8/10 | Desktop-first two-column. Below 768px collapses to single column with stacked sections |
| Accessibility | 8/10 | ARIA on chart points, keyboard nav for symptom chips, screen reader labels on phase indicators |

**Desktop-optimized layouts (not mobile-responsive -- desktop-native):**

1. **Today page:** Two-column. Left (55%): phase indicator ring + cycle day hero stat + prediction card + late warning. Right (45%): quick-log panel (temperature + flow + top symptoms) + recent cycle summary card.
2. **Calendar page:** Full-width 3-month calendar grid. Period days filled pink, predicted outlined pink, fertile window subtle teal highlight. Click any day to open log panel in right sidebar (if viewport > 1200px) or navigate to log page (narrower viewports).
3. **Insights page:** Full-width BBT temperature chart (SVG, ~300px height) with coverline and shift zone. Below: 4-column stats cards (avg cycle, avg period, shortest, longest). Below: symptom frequency bar chart.
4. **Log page:** Centered form (max-width 640px). Temperature input with unit toggle. Flow selector (4 chips). Symptom grid (physical row + mood row). Notes textarea. Save button.
5. **Pregnancy page:** Left (60%): week progress hero ("Week 24 of 40" with trimester bar + baby size illustration text). Right (40%): upcoming appointments list + development highlights card. Below: appointment form for adding new ones.
6. **History page:** Full-width data table. Columns: Start Date, End Date, Length, Period Length, Phase. Sortable. Row click expands to show day-by-day breakdown.
7. **Sharing page:** Left: QR code / share code display + permission toggle switches. Right: live preview of what the partner sees (SharedCycleView rendered as a card).

**All 5 states per page:**

| State | Pattern |
|-------|---------|
| Loading | Skeleton pulse: glass cards with animated shimmer matching the page layout. Chart shows empty SVG frame with axis labels |
| Empty | Module moon icon + warm heading + pink CTA button. "Your cycle journey starts here -- log your first period to begin tracking" |
| Error | Glass card with error icon + message + "Retry" ghost button. try/catch/finally wrapper on all server action calls |
| Success | Pink checkmark on save. Stat counters animate on update. Chart points appear with fade-in |
| Partial | Mixed states: temperature logged but no symptoms yet. Calendar shows some tracked days, prediction shows low confidence badge |

### Phase 4: Design Consultation

**Module-specific design system:**
- **Accent:** `#F472B6` (pink) -- used for all primary CTAs, active states, chart elements, phase indicators, period day fills
- **Secondary accents:**
  - `#30D158` (green) for temperature shift confirmed, success states, fertile window confidence
  - `#FF453A` (red) for late period warning, severe symptoms, error states
  - `#14B8A6` (teal) for fertile window overlay on calendar
  - `rgba(244,114,182,0.15)` (pink dim) for hero section background
  - `rgba(244,114,182,0.25)` (pink border) for hero section border
- **Information density:** HIGH on desktop. Temperature chart should show 90 days of data comfortably. Cycle history table should show 12+ rows without scrolling. Calendar shows 3 months simultaneously.
- **Glass cards:** All content containers use `rgba(255,255,255,0.04)` background + `rgba(255,255,255,0.06)` border + `backdrop-filter: blur(40px) saturate(180%)`
- **Temperature chart design:**
  - SVG container: full width, 280px height, dark background (`rgba(255,255,255,0.02)`)
  - Data points: 8px circles, `#F472B6` default, `#30D158` for post-shift readings
  - Coverline: 1px dashed `rgba(240,240,245,0.35)` with label
  - X-axis: date labels every 7 days, `caption` style
  - Y-axis: temperature labels in user's preferred unit, `caption` style
  - Hover tooltip: glass card with date, temperature, method, shift status
- **Phase indicator ring:** Circular SVG (120px diameter) divided into 4 colored arcs: menstrual (pink), follicular (light pink), ovulation (teal), luteal (muted pink). Current phase arc highlighted with full opacity, others at 30%.
- **Calendar cell design:** 36px square. Period days: pink fill with white text. Predicted: pink dashed border. Fertile: teal dot. Today: white ring. Empty: transparent with subtle border on hover.
- **Typography:** `heroTitle` (36/800) for dashboard greeting and pregnancy week. `stat` (36/700) for cycle day number and days-until-period. `subheading` (18/600) for card titles. `body` (16/400) for descriptions. `caption` (13/500) for metadata and chart labels. `label` (12/600/UPPERCASE) for phase names, symptom categories.
- **Component reuse from `@mylife/ui`:** colors, spacing tokens. From books pattern: layout header, glass card, pill buttons, filter chips.
- **Symptom chips:** Rounded pills (16px radius, 1px border). Default: `rgba(255,255,255,0.06)` border, secondary text. Selected: `#F472B6` background + border, white text. Intensity badge (mild/moderate/severe) as small dot on selected chips.
- **Flow level selector:** 4 horizontal chips, mutually exclusive. Styled like symptom chips but with gradient pink intensity (spotting = lightest, heavy = full pink).

---

## Page-by-Page Wireframes

### 1. Layout (`layout.tsx`)

Glass morphism header with module branding and nav links.

```
+------------------------------------------------------------------+
| [#F472B6] MyCycle                                                |
| Private period and fertility tracker inside MyLife.               |
|                                                                   |
| [Today] [Calendar] [Log] [Insights] [Pregnancy] [History]       |
| [Sharing] [Community] [Settings]                                  |
+------------------------------------------------------------------+
|                                                                   |
|  {children}                                                       |
|                                                                   |
+------------------------------------------------------------------+
```

- Header: glass background `rgba(18,18,26,0.78)` + `backdrop-filter: blur(14px)`
- Bottom border: `rgba(255,255,255,0.06)`
- Module name: pink accent, 30px, weight 800
- Nav links: `textSecondary` color, 14px, weight 600. Hover: `text` color
- Max-width container: 1120px centered
- Content area: 32px top padding, 24px horizontal padding

### 2. Today Dashboard (`page.tsx`)

Two-column layout with phase visualization and quick-log panel.

```
+------------------------------------------------------------------+
| [Hero Section - pink dim background]                              |
|                                                                   |
|  [Phase Ring]     Day 14                Today is March 23         |
|  Ovulation        of ~28               Period in ~14 days         |
|  phase                                 Confidence: 87%            |
|                                                                   |
+------------------------------------------------------------------+
|                                                                   |
| LEFT COLUMN (55%)               | RIGHT COLUMN (45%)             |
|                                 |                                 |
| [Prediction Card]               | [Quick Log Card]               |
| Next period: Apr 6              | Temperature                    |
| Fertile window: Mar 27-31       | [____] [F/C] [Save]            |
| Avg cycle: 28.3 days            |                                 |
| Avg period: 5.2 days            | Flow Today                     |
|                                 | [Spot] [Light] [Med] [Heavy]   |
| [Current Cycle Card]            |                                 |
| Started Mar 10                  | Quick Symptoms                  |
| Ovulation phase, day 14         | [Cramps] [Headache] [Fatigue]  |
| Period ended Mar 14 (5 days)    | [Anxious] [Irritable] [Calm]   |
|                                 |                                 |
+------------------------------------------------------------------+
| [Stats Row - 4 columns]                                          |
| Total Cycles | Avg Length | Avg Period | Std Dev                  |
| 12           | 28.3       | 5.2        | 1.8                      |
+------------------------------------------------------------------+
```

**Empty state:** "Your cycle journey starts here. Log your first period to begin tracking predictions, temperature charts, and cycle insights." + pink "Start Tracking" CTA that navigates to /cycle/log.

### 3. Calendar (`calendar/page.tsx`)

Full-width 3-month calendar with cycle overlays.

```
+------------------------------------------------------------------+
| < February 2026        March 2026         April 2026 >            |
+------------------------------------------------------------------+
| Mo Tu We Th Fr Sa Su | Mo Tu We Th Fr Sa Su | Mo Tu We Th Fr Sa  |
| [calendar grid]      | [calendar grid]      | [calendar grid]     |
|                      |                      |                      |
| Legend:                                                            |
| [pink fill] Period  [pink dash] Predicted  [teal dot] Fertile    |
| [white ring] Today                                                |
+------------------------------------------------------------------+
| Click any day to log                                              |
+------------------------------------------------------------------+
```

- On day click (viewport > 1200px): slide-in right panel with log form for that date
- On day click (viewport < 1200px): navigate to `/cycle/log?date=YYYY-MM-DD`
- Period days: `#F472B6` fill, white text
- Predicted period: `#F472B6` dashed border
- Fertile window: small teal (`#14B8A6`) dot in corner
- Today: white 2px ring
- Hover: glass background elevation

### 4. Log Day (`log/page.tsx`)

Centered form for comprehensive daily logging. Supports date parameter for calendar click-through.

```
+------------------------------------------------------------------+
|                  Log Day -- March 23, 2026                        |
|                  [< Prev Day] [Next Day >]                        |
+------------------------------------------------------------------+
|                                                                   |
| [Temperature Card]                                                |
| +--------------------------------------------------------------+ |
| | [____97.8____] [F toggle C]  Method: [Oral] [Vaginal] [Wear] | |
| | Time taken: [____6:30 AM____]                                  | |
| | [Save Temperature]                                             | |
| +--------------------------------------------------------------+ |
|                                                                   |
| [Flow Card]                                                       |
| +--------------------------------------------------------------+ |
| | [Spotting] [Light] [Medium] [Heavy]                           | |
| +--------------------------------------------------------------+ |
|                                                                   |
| [Physical Symptoms]                                               |
| +--------------------------------------------------------------+ |
| | [Cramps] [Headache] [Bloating] [Breast Tenderness]            | |
| | [Fatigue] [Acne] [Backache]                                   | |
| +--------------------------------------------------------------+ |
|                                                                   |
| [Mood]                                                            |
| +--------------------------------------------------------------+ |
| | [Happy] [Anxious] [Irritable] [Sad] [Energetic] [Calm]       | |
| +--------------------------------------------------------------+ |
|                                                                   |
| [Notes]                                                           |
| +--------------------------------------------------------------+ |
| | [textarea.......................................              ] | |
| +--------------------------------------------------------------+ |
|                                                                   |
| [Save All]                                                        |
+------------------------------------------------------------------+
```

- Max-width 640px centered
- Date navigation with arrow keys (keyboard shortcut: left/right arrows)
- Temperature: auto-detects if entry exists for date, shows saved state or input form
- Symptom chips: toggle on/off. Click again for intensity picker (mild/moderate/severe popover)
- Save writes cycle day + symptoms + temperature in one action

### 5. Insights (`insights/page.tsx`)

Full-width BBT temperature chart with cycle statistics.

```
+------------------------------------------------------------------+
| Temperature Insights                          [90d] [60d] [30d]   |
+------------------------------------------------------------------+
|                                                                   |
| [BBT Chart - Full Width SVG]                                      |
| 98.8 |                                   * * *                    |
| 98.4 |                              * *       *                   |
| 98.0 |  - - - - - - - Coverline - - - - - - - - - - - - - - -    |
| 97.6 | * *   * * *  *                                             |
| 97.2 |    * *                                                     |
|      +----+----+----+----+----+----+----+----+----+              |
|       Mar 1  Mar 8  Mar 15  Mar 22  Mar 29                       |
|                                                                   |
| [Shift detected badge] Ovulation likely confirmed                |
| Coverline: 97.9F (36.61C)                                        |
+------------------------------------------------------------------+
|                                                                   |
| [Stats Cards - 4 columns]                                        |
| Avg Cycle Length | Avg Period | Shortest | Longest                |
| 28.3 days        | 5.2 days   | 26 days  | 31 days               |
| Std Dev: 1.8     | 12 cycles  |          |                        |
+------------------------------------------------------------------+
|                                                                   |
| [Symptom Frequency]                                               |
| Cramps          ████████████████████  15                          |
| Fatigue         ██████████████        11                          |
| Headache        ████████              8                           |
| Anxious         ██████                6                           |
| Bloating        █████                 5                           |
+------------------------------------------------------------------+
```

- Chart: SVG with responsive width. Data points from `getTemperaturesByDateRange`. Analysis from `analyzeTemperatures`.
- Shift detection: green badge when `shiftDetected === true`. Points after `shiftStartIndex` colored green.
- Time range toggle: 90d (default), 60d, 30d pill buttons.
- Stats cards: from `getCycleStats()`.
- Symptom frequency: horizontal bar chart from `getSymptomFrequencies()`. Pink bars.
- Empty state (no temperatures): "Log your temperature on the Log page to see your BBT chart with coverline analysis and shift detection." + pink CTA.

### 6. Pregnancy Mode (`pregnancy/page.tsx`)

Week-by-week pregnancy tracker with appointments.

```
+------------------------------------------------------------------+
| [Hero - centered]                                                 |
| Week 24 of 40                                                     |
| Trimester 2                                                       |
| [===================|----------] 60%                              |
| Due date: July 15, 2026 -- 112 days to go                        |
+------------------------------------------------------------------+
|                                                                   |
| LEFT (60%)                      | RIGHT (40%)                    |
|                                 |                                 |
| [Development Card]              | [Upcoming Appointments]         |
| Baby size: ~30cm (corn)         | Mar 28 - Glucose test          |
| Highlight: Baby can hear        | Apr 10 - Ultrasound            |
| your voice and responds to      | Apr 25 - Checkup               |
| sound. Lungs are developing     |                                 |
| surfactant for breathing.       | [+ Add Appointment]            |
|                                 |                                 |
| [Pregnancy Symptoms Quick Log]  | [Appointment Form (collapsed)]  |
| [Morning Sickness] [Fatigue]    | Title: [____________]           |
| [Back Pain] [Heartburn]         | Date: [____________]            |
| [Swelling] [Braxton Hicks]      | Time: [____________]            |
| [Insomnia] [Constipation]       | Location: [____________]        |
|                                 | Notes: [____________]           |
| [History]                       | [Save]                          |
| Previous pregnancies: 0         |                                 |
+------------------------------------------------------------------+
```

- Conditional render: if no active pregnancy, show setup wizard (start method picker + date input)
- Start methods: Last period, Conception date, Known due date, Transfer date
- Week info from `getPregnancyWeekInfo()` which pulls from `PREGNANCY_WEEK_DATA`
- Appointments from `getUpcomingAppointments()`. Completed appointments shown with strikethrough.
- End pregnancy button with confirmation dialog (status: completed or loss)

### 7. Cycle History (`history/page.tsx`)

Sortable data table of past cycles.

```
+------------------------------------------------------------------+
| Cycle History                              [Export CSV]            |
+------------------------------------------------------------------+
| Start Date  | End Date   | Length | Period | Status               |
|-------------|------------|--------|--------|----------------------|
| Mar 10 2026 | --         | --     | 5d     | Active               |
| Feb 10 2026 | Mar 9 2026 | 28d    | 5d     | Complete             |
| Jan 14 2026 | Feb 9 2026 | 27d    | 4d     | Complete             |
| Dec 16 2025 | Jan 13 2026| 29d    | 6d     | Complete             |
| ...                                                               |
+------------------------------------------------------------------+
| Showing 12 of 12 cycles                                          |
+------------------------------------------------------------------+
```

- Columns: Start Date, End Date, Length (days), Period Length (days), Status (Active/Complete)
- Click header to sort (default: start date descending)
- Row click: expand inline to show day-by-day breakdown with symptoms
- Export CSV: trigger download via blob URL
- Empty state: "No cycles tracked yet. Log your first period on the Log page to start building your history."

### 8. Partner Sharing (`sharing/page.tsx`)

Sharing setup and live preview.

```
+------------------------------------------------------------------+
| Partner Sharing                                                   |
+------------------------------------------------------------------+
|                                                                   |
| LEFT (50%)                      | RIGHT (50%)                    |
|                                 |                                 |
| [Share Code Card]               | [Partner's View Preview]       |
| Code: A7K9M3                    | "What your partner sees"       |
| Share this code with your       |                                 |
| partner so they can see your    | Phase: Ovulation               |
| cycle updates.                  | Cycle Day: 14                  |
|                                 | Next period: ~Apr 6            |
| [Permission Toggles]            | Fertile window: Mar 27-31      |
| Phase & cycle day    [ON]       | Pregnancy: Not sharing          |
| Predictions          [ON]       |                                 |
| Fertile window       [OFF]      |                                 |
| Symptoms             [OFF]      |                                 |
| Pregnancy info       [ON]       |                                 |
|                                 |                                 |
| Partner name: [__________]      |                                 |
|                                 |                                 |
| [Revoke Link]                   |                                 |
+------------------------------------------------------------------+
```

- If no active link: show "Create Partner Link" CTA. Creates link with default permissions.
- Permission toggles update via `doUpdatePartnerLink()`. Preview updates live.
- Revoke link: confirmation dialog. Sets status to 'revoked'.
- Share code displayed in large monospace font for easy reading/dictation.

### 9. Community (`community/page.tsx`)

Already exists. Wire to server actions following the forums DB adapter pattern from mobile.

### 10. Settings (`settings/page.tsx`)

Module preferences and data management.

```
+------------------------------------------------------------------+
| Settings                                                          |
+------------------------------------------------------------------+
|                                                                   |
| [Temperature Unit]                                                |
| Display in: [F] / [C]          Storage always Celsius             |
|                                                                   |
| [Data Export]                                                     |
| [Export Cycles CSV] [Export All JSON]                              |
|                                                                   |
| [Danger Zone]                                                     |
| [Delete All Cycle Data]  -- Permanently removes all cycle,        |
| temperature, symptom, and pregnancy data.                         |
+------------------------------------------------------------------+
```

---

## Component Inventory

### New Components (in page files, not extracted)

| Component | Page | Description |
|-----------|------|-------------|
| `PhaseRing` | Today | SVG circular phase indicator (4 arcs) |
| `PredictionCard` | Today | Next period date, fertile window, confidence badge |
| `QuickLogPanel` | Today | Temperature input + flow chips + top symptoms |
| `CalendarGrid` | Calendar | 3-month CSS grid with day cells |
| `CalendarDayCell` | Calendar | Individual day with period/fertile/predicted overlays |
| `TemperatureChart` | Insights | Full-width SVG BBT chart with coverline and shift |
| `ChartTooltip` | Insights | Hover tooltip for chart data points |
| `SymptomBarChart` | Insights | Horizontal frequency bars |
| `PregnancyProgress` | Pregnancy | Week/trimester progress bar with hero stats |
| `AppointmentList` | Pregnancy | Upcoming/completed appointment cards |
| `AppointmentForm` | Pregnancy | Create/edit appointment form |
| `CycleHistoryTable` | History | Sortable table with expandable rows |
| `ShareCodeDisplay` | Sharing | Large monospace code with copy button |
| `PermissionToggles` | Sharing | Toggle switches for each sharing preference |
| `SharedViewPreview` | Sharing | Rendered preview of SharedCycleView |
| `SymptomChipGrid` | Log | Grid of toggleable symptom chips with intensity |
| `FlowSelector` | Log | Mutually exclusive flow level chips |
| `TemperatureInput` | Log, Today | Number input with unit toggle and method selector |

### Reused Patterns (from books reference)

| Pattern | Source | Usage |
|---------|--------|-------|
| Glass header layout | `books/layout.tsx` | Module header with nav links |
| Server action wrapper | `books/actions.ts` | `db()` helper with `ensureModuleMigrations` |
| Glass card container | Inline styles | `surface` background + `border` + `xl` radius |
| Pill button filter | `books/page.tsx` | Date range toggles, shelf-like filter chips |
| Data table | `books/page.tsx` grid | Cycle history table |
| Hero section | `books/page.tsx` | Pink-accented hero with stats |
| Empty state | DESIGN.md pattern | Icon + warm heading + CTA |

---

## Data Flow Diagram

```
User Action
    |
    v
Page Component ('use client')
    |
    v
Server Action (actions.ts, 'use server')
    |
    v
db() helper: getAdapter() + ensureModuleMigrations('cycle')
    |
    v
@mylife/cycle CRUD / Engine functions
    |
    v
SQLite (cy_* tables via DatabaseAdapter)
    |
    v
Return typed result to client
    |
    v
setState() to update UI
```

**Mutation flow:**
1. User fills form (e.g., temperature input)
2. Client calls server action (e.g., `doUpsertTemperature(...)`)
3. Server action validates input via Zod schema (inside module)
4. Server action writes to SQLite
5. Server action returns result
6. Client calls fetch actions to refresh displayed data
7. UI updates via setState

---

## Test Plan

### Unit Tests (in `__tests__/`)

| Test File | Coverage |
|-----------|----------|
| `cycle-page.test.tsx` | Today dashboard: renders stats, phase, predictions. Empty state. Error state with retry. |
| `insights-page.test.tsx` | Temperature chart renders with data. Empty state when no temps. Stats cards display correct values. Symptom bars render. |
| `pregnancy-page.test.tsx` | Active pregnancy renders week info. No pregnancy shows setup form. Appointment list renders. Complete appointment works. |
| `history-page.test.tsx` | Table renders cycles. Sort by column. Empty state. Row expansion. |
| `log-page.test.tsx` | Temperature save (Fahrenheit and Celsius). Flow selection. Symptom toggle and intensity. Date navigation. |

### Test Strategy

- Mock server actions using Vitest `vi.mock()`
- Test all 5 states per page: loading, empty, error, success, partial
- Test keyboard shortcuts (simulate keydown events)
- Test responsive behavior (mock viewport width via container queries)
- Do not test internal SVG rendering details -- test that chart container renders and has correct data attributes

### Parity Tests

- Verify all mobile screens have web equivalents: today, log-day, insights, community, settings + new web-only pages (calendar, pregnancy, history, sharing)
- Verify server actions cover all module CRUD functions used by mobile

---

## QA Checklist

### Functional

- [ ] Today dashboard shows correct cycle day, phase, and prediction
- [ ] Today dashboard shows late warning when period is overdue
- [ ] Quick log panel saves temperature, flow, and symptoms
- [ ] Calendar renders 3 months with correct period/fertile/predicted overlays
- [ ] Calendar day click opens log for that date
- [ ] Log page saves temperature with unit conversion
- [ ] Log page saves flow level (mutually exclusive)
- [ ] Log page saves symptoms with intensity
- [ ] Log page saves notes
- [ ] Log page date navigation works with arrow keys
- [ ] Insights BBT chart renders with coverline and shift detection
- [ ] Insights chart hover shows tooltip with reading details
- [ ] Insights chart time range toggle (30d/60d/90d) works
- [ ] Insights stats cards show correct computed values
- [ ] Insights symptom frequency bars render correctly
- [ ] Pregnancy setup wizard collects start method and computes due date
- [ ] Pregnancy week tracker shows correct week, trimester, baby size
- [ ] Pregnancy appointment CRUD works (create, complete, delete)
- [ ] History table renders all cycles with correct data
- [ ] History table sorts by any column
- [ ] Partner link creation generates a 6-character code
- [ ] Partner permission toggles update the shared view preview
- [ ] Partner link revocation works with confirmation
- [ ] Community page renders threads and allows creation
- [ ] Settings temperature unit toggle persists
- [ ] All server action calls wrapped in try/catch/finally (no stuck loading)

### Design

- [ ] All pages use Cool Obsidian tokens (no hardcoded colors outside accent)
- [ ] Glass morphism on all cards and header
- [ ] Pink accent (#F472B6) used consistently for CTAs, active states, chart
- [ ] Typography matches spec (heroTitle, stat, subheading, body, caption, label)
- [ ] Empty states follow DESIGN.md pattern (icon + warm heading + CTA)
- [ ] Loading states use skeleton pulse (not spinners)
- [ ] Error states show glass card with retry button
- [ ] Responsive: two-column above 768px, single column below
- [ ] Hover states on all interactive elements
- [ ] Focus indicators (2px accent outline) on all keyboard-focusable elements

### Privacy

- [ ] Zero network requests from cycle pages (all data local SQLite)
- [ ] No telemetry, analytics, or crash reporting in cycle code paths
- [ ] Partner sharing only generates a local snapshot (no network send)

### Performance

- [ ] Temperature chart renders 90 data points without jank
- [ ] Calendar renders 3 months of data in <100ms
- [ ] Page transitions feel instant (skeleton appears within 50ms)

---

## Implementation Notes

### Critical Path

1. `actions.ts` -- all server actions (blocks everything else)
2. `layout.tsx` -- module chrome (blocks all pages)
3. `page.tsx` (Today) -- narrowest wedge, highest impact
4. `insights/page.tsx` -- BBT chart, the desktop differentiator
5. `log/page.tsx` -- core daily workflow
6. Remaining pages in any order

### Known Constraints

- Community page (`community/page.tsx`) already exists with client-only state. Migrate to server actions for consistency but preserve existing UX.
- Temperature chart uses custom SVG, not a charting library. This keeps the bundle small and the rendering fast.
- Pregnancy week data comes from `PREGNANCY_WEEK_DATA` (static 42-entry array in `modules/cycle/src/data/pregnancy-weeks.ts`). No network fetch needed.
- Partner sharing is local-only. The "shared view" is a JSON snapshot that could be shared via copy-paste or messaging. No real-time sync.
- All date operations use ISO strings and the module's built-in `addDays`/`daysBetween` helpers. No date library dependency.
