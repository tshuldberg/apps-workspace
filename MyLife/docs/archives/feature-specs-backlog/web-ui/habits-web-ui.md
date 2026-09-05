# Feature Spec: Habits Full Web UI

## Metadata
- **Module:** habits
- **Task:** W14-2
- **Sprint:** W14
- **Estimated CC Time:** 4-6 hours
- **Depends On:** none (all 49+ module exports exist, actions.ts has V1-V2 wrappers, 13 stub files in place)
- **Blocks:** Habits web QA pass, Habits web design review
- **Reference Implementation:** `apps/web/app/books/` (layout, page, actions, sub-routes, tests)

## Design Pipeline Signoff

### Phase 1: Office Hours (Builder Mode)

**Core insight:** A habits app on desktop must exploit what mobile cannot: data density, keyboard-first interaction, and multi-panel simultaneous views. The narrowest wedge -- the single screen that makes users say "I need this on desktop" -- is the **Today Dashboard with GitHub-style Heatmap**. On mobile, you see a scrolling checklist. On desktop, you see your entire year at a glance (365-cell heatmap) alongside today's habits, streak stats, and completion rate -- all on one screen. Plus, keyboard shortcuts mean you can blast through your daily check-in in seconds.

**Web-specific affordances to leverage:**
1. **Heatmap hero:** 52-week x 7-day grid showing a full year of data. Impossible on a phone. Hover tooltips reveal date + completion count per cell.
2. **Keyboard shortcuts:** Number keys 1-9 toggle habits by position. Space checks off selected habit. `T` starts focus timer. `N` opens new habit form. `S` jumps to stats.
3. **Multi-panel layouts:** Two-column: habit list on left, detail/stats on right. Stats page shows 4 metric cards + 3 charts simultaneously.
4. **Data tables with sort/filter:** Searchable, sortable completion history. Filterable by habit type, frequency, date range.
5. **Browser tab title:** Focus timer updates tab title ("25:00 - Focus | MyHabits") so users see progress without switching tabs.
6. **Copy-paste from tables:** Time reports and export data can be copied directly.
7. **Print-optimized time reports:** Clean print stylesheet for billing.
8. **Deep linking:** Every habit, stat view, program, and report is a unique URL.

**Brainstorm scoring:**
- Demand signal: Every competitor has a web/desktop app (Habitica, Streaks, Loop Habit Tracker). Desktop habit tracking serves the "morning routine at computer" use case.
- Narrowest wedge: Today dashboard + heatmap. If this screen is beautiful and fast, users adopt the web UI.
- Expansion path: Heatmap -> Stats -> Focus Timer -> Time Reports (each adds a reason to stay on desktop).

### Phase 2: Engineering Review

**Module surface area (verified):**
- 49+ named exports from `@mylife/habits`
- 20 feature clusters: habit CRUD, completions, streaks (3 variants), timed sessions, measurements, heatmap, statistics, CSV export, cross-module, cycle tracking, sobriety clock, craving log, milestones, focus timer, HealthKit, programs/challenges, badges, time tracking, RPG gamification, pet companion, Siri, location reminders
- 16 SQLite tables (hb_ prefix) across 4 migration versions
- Schema version: 4

**Existing actions.ts coverage:**
The current `apps/web/app/habits/actions.ts` already wraps V1-V2 features:
- Habit CRUD (create, get, getById, update, delete, count)
- Settings (get, set)
- Completions (record, fetch, fetchForDate, delete)
- Streaks (basic, with grace, negative, measurable)
- Timed sessions (start, end, fetchForHabit, fetchForDate)
- Measurements (record, fetchForHabit, fetchForDate)
- Heatmap (data, range)
- Statistics (dayOfWeek, timeOfDay, monthly, yearly, overall)
- CSV export (habits, completions, all)
- Cycle tracking (period CRUD, symptoms, prediction, fertility)

**New server actions needed (V3-V4):**

```typescript
// V3: Sobriety
fetchSobrietyProfile(habitId), fetchAllSobrietyProfiles(), doCreateSobrietyProfile(id, input),
doUpdateSobrietyProfile(id, updates), doDeleteSobrietyProfile(id),
doCreatePledge(id, profileId, date), fetchPledgeForDate(profileId, date),
fetchRecentPledgeDates(profileId), fetchSlipDates(habitId)

// V3: Cravings
doCreateCraving(id, input), fetchCravingsForHabit(habitId), fetchTriggersForCraving(cravingId),
fetchAllTriggersForHabit(habitId), fetchCustomTriggerNames(habitId), doDeleteCraving(id)

// V3: Milestones
doCreateMilestone(...), fetchMilestonesForHabit(habitId), fetchAchievedMilestones(habitId),
fetchUnachievedMilestones(habitId), doMarkMilestoneAchieved(id), doDismissMilestone(id),
doSeedMilestonesForHabit(habitId)

// V3: Focus sessions
doCreateFocusSession(id, input), doCompleteFocusSession(id, rounds, focus, break, status),
fetchFocusSessionsForHabit(habitId), fetchAllFocusSessions(), doDeleteFocusSession(id)

// V4: Programs
doCreateProgram(id, input), fetchProgramById(id), fetchAllPrograms(), fetchBuiltInPrograms(),
doDeleteProgram(id), doCreateEnrollment(id, input), fetchActiveEnrollment(habitId),
fetchAllActiveEnrollments(), doUpdateEnrollmentStatus(id, status), doDeleteEnrollment(id)

// V4: Badges
doCreateBadge(...), fetchBadgesForHabit(habitId), fetchAllBadges(),
fetchUnlockedBadgeKeys(), doDismissBadge(id), doDeleteBadge(id)

// V4: Time tracking
doCreateProject(id, input), fetchProjectByHabit(habitId), fetchAllActiveProjects(),
doUpdateProject(id, updates), doDeleteProject(id)

// V4: RPG
fetchPlayerProfile(), doEnsurePlayerProfile(), doUpdatePlayerXP(habitId, amount, source),
doSetGamificationEnabled(enabled), fetchXPTransactions(limit?), fetchXPTransactionsForHabit(habitId)

// V4: Pet
fetchPetState(), doEnsurePetState(), doUpdatePetName(name), doUpdatePetSpecies(species),
doUpdatePetEquippedItems(items), doIncrementPetCompletions()
```

**Route structure (Next.js App Router):**

```
apps/web/app/habits/
  layout.tsx              # Module layout with glass nav header + tab links
  page.tsx                # Today dashboard (hero stats + heatmap + habit checklist)
  actions.ts              # Server actions (extend existing with V3-V4)
  [id]/page.tsx           # Habit detail (heatmap + streaks + completions + edit)
  stats/page.tsx          # Statistics dashboard (overall, patterns, per-habit, monthly)
  sobriety/page.tsx       # Sobriety clock + pledge + lifetime stats + craving insights
  cravings/page.tsx       # Craving log + trigger analysis + coping effectiveness
  focus/page.tsx          # Pomodoro focus timer + session history
  programs/page.tsx       # Challenge programs catalog + active enrollments
  badges/page.tsx         # Badge gallery (earned + locked)
  time-reports/page.tsx   # Time tracking reports + CSV export + billing
  cycle/page.tsx          # Cycle tracker + predictions + symptoms
  pet/page.tsx            # Virtual pet companion + equipped items
  __tests__/
    habits-page.test.tsx  # Already exists (update)
    habit-detail.test.tsx
    stats-page.test.tsx
    sobriety-page.test.tsx
    focus-page.test.tsx
```

**Data flow (per books reference pattern):**
1. `layout.tsx` renders glass header with nav links + `{children}` slot
2. Each page is `'use client'` with `useEffect` calling server actions
3. Server actions call `db()` (which runs `getAdapter()` + `ensureModuleMigrations('habits')`)
4. Server actions call module CRUD/engine functions from `@mylife/habits`
5. Client state managed via local `useState` per page (no global state library)
6. All mutations go through server actions; client calls `refresh()` pattern to re-fetch

**Architecture decisions:**
- No charting library needed for V1 web UI. Use CSS grid for heatmap (52x7 cells) and CSS width percentages for progress bars (same approach as mobile's `barFill`). Add recharts later for stats page charts in a follow-up.
- Sobriety clock live timer uses `useEffect` + `setInterval` client-side (same as mobile).
- Focus timer Pomodoro state machine runs client-side using the engine functions (same as mobile).
- CSV export triggers a download via blob URL.

**Known issue:** V2 migration has period_id bug (P0 in TODOS.md). Does NOT block web UI work -- cycle tracking page should handle the case where the table doesn't exist gracefully.

### Phase 3: Design Review

**Rating per dimension:**

| Dimension | Score | Notes |
|-----------|-------|-------|
| Layout & Composition | 9/10 | Two-column dashboard, multi-panel stats, centered focus timer |
| Typography | 9/10 | Full Cool Obsidian type scale. heroTitle for dashboard, stat for numbers, subheading for cards |
| Color | 9/10 | Purple accent #8B5CF6 throughout. Feature-specific accents (green for sobriety $, red for danger/slips) |
| Spacing & Rhythm | 8/10 | Token-based spacing. Cards use xl radius. Sections separated by lg gap |
| States (5/5) | 9/10 | Loading (skeleton), Empty (warm CTA), Error (retry), Success, Partial -- all designed |
| Interaction | 8/10 | Keyboard shortcuts, hover tooltips, click-to-toggle, focus timer tab title |
| Responsive | 8/10 | Desktop-first. Below 768px collapses to single column |
| Accessibility | 7/10 | ARIA on heatmap cells, keyboard nav for habit list, tabular-nums for timer |

**Desktop-optimized layouts (not mobile-responsive -- desktop-native):**

1. **Today page:** Two-column. Left (60%): hero stats row + habit checklist. Right (40%): year heatmap + quick actions.
2. **Stats page:** 4-column metric cards row + full-width per-habit completion bars + monthly chart.
3. **Habit detail:** Two-column. Left: heatmap + completion history table. Right: streak info + edit form + quick actions.
4. **Sobriety page:** Centered hero clock + stats cards row + pledge section + craving insights sidebar.
5. **Focus timer:** Centered timer ring (full viewport height) with minimal controls. Session history below on scroll.
6. **Programs:** Card grid (3 columns) of available programs with difficulty badges.
7. **Badges:** Gallery grid (4 columns) with earned/locked visual distinction.
8. **Time reports:** Data table with sortable columns + summary cards + export button.

**All 5 states per page:**

| State | Pattern |
|-------|---------|
| Loading | Skeleton pulse: glass cards with animated shimmer. Heatmap shows grid outline with placeholder cells |
| Empty | Module icon + warm heading + purple CTA button. "No habits yet -- create your first one" |
| Error | Glass card with error icon + message + "Retry" ghost button. try/catch/finally wrapper on all server actions |
| Success | Green checkmark animation on completion. Streak counter increments. Heatmap cell fills |
| Partial | Mixed completion states: some habits checked, others pending. Progress bar shows partial fill |

### Phase 4: Design Consultation

**Module-specific design system:**
- **Accent:** `#8B5CF6` (purple) -- used for all primary CTAs, active states, heatmap intensity, streak highlights
- **Secondary accents:** `#22C55E` (green) for sobriety money saved + success states; `#EF4444` (red) for danger/slips; `#14B8A6` (teal) for focus break phase; `#F59E0B` (amber) for intermediate difficulty
- **Information density:** HIGH on desktop. Show more data per screen than mobile. Leverage 1120px max-width container.
- **Glass cards:** All content containers use `rgba(255,255,255,0.04)` background + `rgba(255,255,255,0.06)` border + `backdrop-filter: blur(40px) saturate(180%)`
- **Heatmap design:** 52 columns x 7 rows CSS grid. 5-level intensity scale: `transparent` (0) -> `rgba(139,92,246,0.15)` (1) -> `rgba(139,92,246,0.35)` (2) -> `rgba(139,92,246,0.55)` (3) -> `#8B5CF6` (4+). Cell size: 14px square, 2px gap, 4px border-radius. Month labels above.
- **Typography:** `heroTitle` (36/800) for dashboard greeting. `stat` (36/700) for big numbers (streak count, sobriety duration, money saved). `subheading` (18/600) for card titles. `body` (16/400) for descriptions. `caption` (13/500) for metadata. Timer display uses `tabular-nums` variant.
- **Component reuse from `@mylife/ui`:** colors, spacing tokens. From books pattern: layout header, glass card, pill buttons, filter chips, grid/list toggle.
- **Habit type badges:** Colored pills matching mobile -- standard (purple), timed (blue), negative (red), measurable (green).

---

## Page-by-Page Wireframes

### 1. Layout (`layout.tsx`)

Glass morphism header with module branding and nav links.

```
+------------------------------------------------------------------+
| [#8B5CF6] MyHabits                                               |
| Build habits that stick inside MyLife.                            |
|                                                                   |
| Today  Habits  Stats  Focus  Programs  Sobriety  Badges  More v  |
+------------------------------------------------------------------+
| {children}                                                        |
+------------------------------------------------------------------+
```

- Glass background: `rgba(18,18,26,0.78)` + `backdrop-filter: blur(14px)`
- Bottom border: `rgba(255,255,255,0.06)`
- Max width: 1120px centered
- "More" dropdown: Cycle, Time Reports, Pet, Cravings
- Nav links: `textSecondary` color, 14px/600

### 2. Today Dashboard (`page.tsx`)

The flagship screen. Two-column desktop layout.

```
+------------------------------------------------------------------+
|                                                                    |
|  [Left Column - 60%]              [Right Column - 40%]            |
|                                                                    |
|  +---------------------------+    +---------------------------+    |
|  | Today's Progress          |    | Year Heatmap (52x7 grid)  |   |
|  | Due: 8  Done: 5/8  63%   |    | [________________________] |   |
|  | [========>     ] progress |    | [________________________] |   |
|  +---------------------------+    | [________________________] |   |
|                                   | [________________________] |   |
|  +---------------------------+    | [________________________] |   |
|  | Today's Habits            |    | [________________________] |   |
|  |                           |    | [________________________] |   |
|  | [x] Meditate     5d str  |    |                           |   |
|  | [x] Read 30min   12d str |    | Jan Feb Mar ... Nov Dec   |   |
|  | [ ] Exercise     0d str  |    +---------------------------+    |
|  | [3/8] Water (measurable)  |                                    |
|  | [Start] Deep Work (timed) |    +---------------------------+    |
|  | [ ] No Sugar (negative)   |    | Quick Actions             |   |
|  |                           |    | [+ New Habit]             |   |
|  | + Add Habit               |    | [Focus Timer]             |   |
|  +---------------------------+    | [Export CSV]              |   |
|                                   +---------------------------+    |
+------------------------------------------------------------------+
```

**Data sources:**
- `fetchHabits({ isArchived: false })` -> filter `isDueToday()`
- `fetchCompletionsForDate(today)` -> map by habitId
- `fetchMeasurementsForDate(today)` -> map by habitId
- `fetchSessionsForDate(today)` -> map by habitId
- `fetchHeatmapData(null, currentYear)` -> aggregate across all habits
- `fetchStreaks(habitId)` per visible habit (or `fetchStreaksWithGrace` / `fetchNegativeStreaks` / `fetchMeasurableStreaks` based on type)

**Interactions:**
- Click checkbox -> `doRecordCompletion()` / `doDeleteCompletion()` toggle
- Click measurable counter -> `doRecordMeasurement()` increment
- Click "Start" on timed -> `doStartSession()`, run client-side timer, `doEndSession()` on stop
- Click habit name -> navigate to `/habits/[id]`
- Hover heatmap cell -> tooltip with date and completion count
- Click "+ Add Habit" -> inline form or navigate to add flow

### 3. Habit Detail (`[id]/page.tsx`)

Two-column layout with habit-specific deep dive.

```
+------------------------------------------------------------------+
|                                                                    |
|  [Left Column - 55%]              [Right Column - 45%]            |
|                                                                    |
|  +---------------------------+    +---------------------------+    |
|  | [icon] Meditate           |    | Streak Info               |   |
|  | Daily / Morning           |    | Current: 12 days          |   |
|  | standard | grace: 1       |    | Longest: 45 days          |   |
|  | [Edit] [Archive] [Delete] |    | Total: 234 completions    |   |
|  +---------------------------+    +---------------------------+    |
|                                                                    |
|  +---------------------------+    +---------------------------+    |
|  | Heatmap (52x7)           |    | Recent Completions        |   |
|  | [full year grid]         |    | 2026-03-23  1x            |   |
|  |                          |    | 2026-03-22  1x            |   |
|  +---------------------------+    | 2026-03-21  1x            |   |
|                                   | 2026-03-19  (missed)      |   |
|  +---------------------------+    | ...                       |   |
|  | Completion Rate by Day    |    +---------------------------+    |
|  | Mon [====] 85%           |                                    |
|  | Tue [===]  72%           |    +---------------------------+    |
|  | ...                      |    | Milestones                |   |
|  +---------------------------+    | [x] 7-day streak         |   |
|                                   | [x] 30-day streak        |   |
|                                   | [ ] 100-day streak       |   |
|                                   +---------------------------+    |
+------------------------------------------------------------------+
```

**Data sources:**
- `fetchHabitById(id)` -> habit details
- `fetchHeatmapData(id)` -> year heatmap for this habit
- `fetchStreaks(id)` (or grace/negative/measurable variant)
- `fetchCompletions(id)` -> recent completions list
- `fetchDayOfWeekStats(id)` -> completion rate bars
- `fetchTimeOfDayStats(id)` -> best time pattern
- `fetchMilestonesForHabit(id)` -> milestone checklist

**Interactions:**
- Edit button -> inline edit form (name, icon, frequency, etc.)
- Archive button -> confirm dialog -> `doUpdateHabit(id, { isArchived: true })`
- Delete button -> confirm dialog -> `doDeleteHabit(id)`
- Click milestone -> `doMarkMilestoneAchieved(id)` if not yet achieved

### 4. Statistics Dashboard (`stats/page.tsx`)

Dense analytics view with multiple chart types.

```
+------------------------------------------------------------------+
|  Statistics                                                        |
|                                                                    |
|  +--------+ +--------+ +--------+ +--------+                      |
|  | Total  | | Total  | | Avg    | | Best   |                      |
|  | Habits | | Done   | | Rate   | | Habit  |                      |
|  | 12     | | 1,847  | | 78%    | | Read   |                      |
|  +--------+ +--------+ +--------+ +--------+                      |
|                                                                    |
|  +---------------------------+    +---------------------------+    |
|  | Patterns                  |    | Monthly Trends (bar chart)|   |
|  | Best Day: Tuesday         |    | Jan [==]                  |   |
|  | Best Time: Morning        |    | Feb [====]                |   |
|  +---------------------------+    | Mar [======]              |   |
|                                   | ...                       |   |
|  +------------------------------------------------------------+   |
|  | Per-Habit Completion Rate                                   |   |
|  | Meditate     [================] 92%                         |   |
|  | Read         [==============]   85%                         |   |
|  | Exercise     [=========]        63%                         |   |
|  | Water        [=======]          55%                         |   |
|  +------------------------------------------------------------+   |
+------------------------------------------------------------------+
```

**Data sources:**
- `fetchOverallStats()` -> 4 metric cards
- `fetchHabits()` -> per-habit list
- Per habit: `fetchYearlyStats(habitId)` -> completion rates + monthly rates
- `fetchDayOfWeekStats(habitId)` -> aggregate best day
- `fetchTimeOfDayStats(habitId)` -> aggregate best time

### 5. Focus Timer (`focus/page.tsx`)

Centered, immersive timer experience.

```
+------------------------------------------------------------------+
|                                                                    |
|                        FOCUS                                       |
|                    Round 2 of 4                                    |
|                                                                    |
|                    +----------+                                    |
|                    |          |                                    |
|                    |  18:42   |   <- ring progress indicator       |
|                    |          |                                    |
|                    +----------+                                    |
|                                                                    |
|              [Pause]  [Skip]  [Stop]                               |
|                                                                    |
|  +------------------------------------------------------------+   |
|  | Session History                                             |   |
|  | Today    4 rounds   100 min focused   20 min break          |   |
|  | Mar 22   3 rounds    75 min focused   15 min break          |   |
|  | Mar 21   4 rounds   100 min focused   20 min break          |   |
|  +------------------------------------------------------------+   |
+------------------------------------------------------------------+
```

**Setup screen:** Work/Break/LongBreak/Rounds config (same as mobile). Config persisted in localStorage.

**Running screen:** CSS ring animation for progress. Browser tab title updates: `"18:42 - Focus | MyHabits"`. Desktop notification on phase change (via Notification API with permission).

**Data sources:**
- `fetchAllFocusSessions()` -> session history table
- Pomodoro state machine runs client-side via engine: `createPomodoroState`, `getRemainingMs`, `isPhaseComplete`, `advancePhase`, `pauseTimer`, `resumeTimer`, `skipPhase`, `stopSession`, `formatTimerDisplay`
- On complete: `doCreateFocusSession()` + `doCompleteFocusSession()`

### 6. Sobriety Clock (`sobriety/page.tsx`)

Emotional, supportive design centered on the clock.

```
+------------------------------------------------------------------+
|                                                                    |
|                    [habit name]                                    |
|                                                                    |
|              +----------------------------+                        |
|              |  1 year, 3 months, 12 days |  <- heroTitle          |
|              |  4 hours, 23 min, 45 sec   |  <- textSecondary      |
|              +----------------------------+                        |
|                                                                    |
|              +----------------------------+                        |
|              |     $4,832.50 saved        |  <- stat, green        |
|              |     this streak            |                        |
|              +----------------------------+                        |
|                                                                    |
|  +--------+ +--------+ +--------+ +--------+                      |
|  | Clean  | | Longest| | Total  | | Life   |                      |
|  | Days   | | Streak | | Slips  | | Saved  |                      |
|  | 467    | | 467d   | | 3      | | $7,210 |                      |
|  +--------+ +--------+ +--------+ +--------+                      |
|                                                                    |
|  +----------------------------+  +----------------------------+    |
|  | Daily Pledge               |  | Motivation                 |   |
|  | [Take Today's Pledge]      |  | "For my kids and my health"|   |
|  | 45-day pledge streak       |  +----------------------------+    |
|  +----------------------------+                                    |
|                                                                    |
|              [I Slipped]  <- danger outline button                 |
+------------------------------------------------------------------+
```

**Data sources:**
- `fetchSobrietyProfile(habitId)` or `fetchAllSobrietyProfiles()`
- Client-side `calculateSobrietyDuration()` + `calculateLifetimeStats()` on 1s interval
- `fetchPledgeForDate()`, `fetchRecentPledgeDates()`, `getPledgeStreak()`
- `fetchSlipDates(habitId)` for lifetime stats

### 7. Craving Insights (`cravings/page.tsx`)

Analytics-focused view of craving patterns.

```
+------------------------------------------------------------------+
|  Craving Insights                                                  |
|                                                                    |
|  +---------------------------+    +---------------------------+    |
|  | Log a Craving             |    | Trigger Frequency         |   |
|  | Intensity: [====6====]    |    | Stress      [========] 12 |   |
|  | Duration:  15 min         |    | Social      [=====]    7  |   |
|  | Triggers: [Stress] [+]   |    | Boredom     [====]     5  |   |
|  | Strategy: [Deep breathing]|    | After meals [==]       3  |   |
|  | Outcome:  [Resisted]      |    +---------------------------+    |
|  | [Save Craving]            |                                    |
|  +---------------------------+    +---------------------------+    |
|                                   | Peak Times                |   |
|  +---------------------------+    | Morning    [===]          |   |
|  | Intensity Trend           |    | Afternoon  [======]       |   |
|  | (last 30 days sparkline)  |    | Evening    [========]     |   |
|  +---------------------------+    | Night      [==]           |   |
|                                   +---------------------------+    |
|  +------------------------------------------------------------+   |
|  | Recent Cravings                                             |   |
|  | Mar 23  Intensity: 6  Resisted  Triggers: Stress, Social   |   |
|  | Mar 22  Intensity: 4  Delayed   Triggers: Boredom          |   |
|  +------------------------------------------------------------+   |
+------------------------------------------------------------------+
```

**Data sources:**
- `fetchCravingsForHabit(habitId)` -> recent list
- `fetchAllTriggersForHabit(habitId)` -> trigger frequency analysis (client-side via `analyzeTriggerFrequency`)
- `analyzeIntensityTrend(cravings)` -> trend sparkline
- `analyzePeakTimes(cravings)` -> peak time bars
- `analyzeCopingEffectiveness(cravings)` -> strategy effectiveness
- `doCreateCraving(id, input)` -> save new craving

### 8. Programs (`programs/page.tsx`)

Card grid of available challenge programs.

```
+------------------------------------------------------------------+
|  Programs                                                          |
|                                                                    |
|  Active Enrollments                                                |
|  +--------------------+                                            |
|  | 30-Day Meditation  |  Day 12 of 30  [====>      ]             |
|  +--------------------+                                            |
|                                                                    |
|  Built-in Programs                                                 |
|  +----------------+ +----------------+ +----------------+          |
|  | 7-Day Starter  | | 21-Day Builder | | 30-Day Master  |         |
|  | Beginner       | | Intermediate   | | Advanced       |         |
|  | 7 days         | | 21 days        | | 30 days        |         |
|  | [Start]        | | [Start]        | | [Start]        |         |
|  +----------------+ +----------------+ +----------------+          |
+------------------------------------------------------------------+
```

**Data sources:**
- `BUILT_IN_PROGRAMS` constant
- `fetchAllActiveEnrollments()` -> active cards
- `fetchProgramById(id)` -> program detail
- Engine: `getCurrentDay()`, `resolveDailyTarget()`, `isProgramComplete()`
- `doCreateEnrollment(id, input)` -> start program

### 9. Badges Gallery (`badges/page.tsx`)

Visual grid of all achievable badges.

```
+------------------------------------------------------------------+
|  Badges                                                            |
|                                                                    |
|  Earned (12)                                                       |
|  +------+ +------+ +------+ +------+                              |
|  | [1d] | | [7d] | | [30d]| | [100]|                              |
|  | Fire | | Week | | Month| | Comp |                              |
|  +------+ +------+ +------+ +------+                              |
|                                                                    |
|  Locked (24)                                                       |
|  +------+ +------+ +------+ +------+                              |
|  | [?]  | | [?]  | | [?]  | | [?]  |  <- dimmed, locked          |
|  | 365d | | 1000 | | ...  | | ...  |                              |
|  +------+ +------+ +------+ +------+                              |
+------------------------------------------------------------------+
```

**Data sources:**
- `BADGE_CATALOG` constant
- `fetchAllBadges()` -> earned badges
- `fetchUnlockedBadgeKeys()` -> which keys are unlocked
- `getBadgesByCategory()` -> grouped display

### 10. Time Reports (`time-reports/page.tsx`)

Professional, data-table-centric view.

```
+------------------------------------------------------------------+
|  Time Reports                                                      |
|                                                                    |
|  +--------+ +--------+ +--------+                                  |
|  | Total  | | This   | | Billed |                                  |
|  | Hours  | | Week   | | Amount |                                  |
|  | 142.5h | | 12.3h  | | $2,850 |                                 |
|  +--------+ +--------+ +--------+                                  |
|                                                                    |
|  +------------------------------------------------------------+   |
|  | Project        | Hours  | Rate   | Amount   | Status       |   |
|  |----------------|--------|--------|----------|--------------|   |
|  | Deep Work      | 45.2h  | $50/hr | $2,260   | Active       |   |
|  | Client ABC     | 23.1h  | $75/hr | $1,732   | Active       |   |
|  | Side Project   | 12.0h  | --     | --       | Active       |   |
|  +------------------------------------------------------------+   |
|                                                                    |
|  [Export CSV]  [Print Report]                                      |
+------------------------------------------------------------------+
```

**Data sources:**
- `fetchAllActiveProjects()` -> project list
- `generateTimeReport(sessions, projects)` -> report data
- `calculateBillableAmount(sessions, rate)` -> billing
- `generateCSV(report)` -> export
- `formatDuration()`, `formatCurrency()` for display

### 11. Cycle Tracker (`cycle/page.tsx`)

```
+------------------------------------------------------------------+
|  Cycle Tracker                                                     |
|                                                                    |
|  +---------------------------+    +---------------------------+    |
|  | Next Period Prediction    |    | Log Period                |   |
|  | Predicted: Mar 28 - Apr 2 |    | Start: [date picker]     |   |
|  | Confidence: +/- 2 days    |    | End:   [date picker]     |   |
|  +---------------------------+    | Notes: [text]            |   |
|                                   | [Save]                   |   |
|  +---------------------------+    +---------------------------+    |
|  | Fertility Window          |                                    |
|  | [timeline visualization]  |    +---------------------------+    |
|  +---------------------------+    | Symptoms                  |   |
|                                   | [predefined list]        |   |
|  +------------------------------------------------------------+   |
|  | Period History                                              |   |
|  | Mar 1-5   28-day cycle   Symptoms: cramps, fatigue         |   |
|  | Feb 2-6   27-day cycle   Symptoms: headache                |   |
|  +------------------------------------------------------------+   |
+------------------------------------------------------------------+
```

**Data sources:**
- `fetchPeriods()` -> period history
- `fetchPrediction()` -> next period prediction
- `fetchFertilityWindow()` -> fertility window
- `fetchSymptoms(periodId)` -> symptoms per period
- `PREDEFINED_SYMPTOMS` constant

### 12. Pet Companion (`pet/page.tsx`)

```
+------------------------------------------------------------------+
|  Your Pet                                                          |
|                                                                    |
|              +-------------------+                                 |
|              |    [fox emoji]    |                                 |
|              |    "Buddy"        |                                 |
|              |    Happy          |                                 |
|              +-------------------+                                 |
|                                                                    |
|  +--------+ +--------+ +--------+                                  |
|  | Days   | | Habits | | Mood   |                                  |
|  | 45     | | 234    | | Happy  |                                  |
|  +--------+ +--------+ +--------+                                  |
|                                                                    |
|  Species: [fox] [cat] [dog] [penguin] [dragon]                    |
|  Name: [Buddy] [Save]                                             |
|                                                                    |
|  Equipped Items: [hat] [scarf]                                    |
+------------------------------------------------------------------+
```

**Data sources:**
- `fetchPetState()` -> current pet
- `PET_SPECIES_CATALOG` constant
- `calculatePetMood(completions)` -> mood
- `getMoodEmoji()`, `getMoodLabel()`, `getDaysTogether()`
- `doUpdatePetName()`, `doUpdatePetSpecies()`, `doUpdatePetEquippedItems()`

---

## Component Inventory

### New Components (habits-specific)
| Component | Used On | Description |
|-----------|---------|-------------|
| `HeatmapGrid` | Today, [id] | 52x7 CSS grid with 5-level purple intensity |
| `HabitChecklistItem` | Today | Habit row with type-aware action (checkbox/timer/counter/slip) |
| `StreakCard` | Today, [id] | Current/longest streak display |
| `CompletionBar` | Stats, [id] | Horizontal progress bar with percentage |
| `MonthlyBarChart` | Stats | 12-bar vertical chart for monthly trends |
| `SobrietyClock` | Sobriety | Live-updating duration display |
| `PomodoroRing` | Focus | CSS ring progress indicator with timer |
| `CravingForm` | Cravings | Intensity slider + trigger picker + outcome select |
| `TriggerFrequencyBars` | Cravings | Horizontal bars for trigger analysis |
| `ProgramCard` | Programs | Program info with difficulty badge + start CTA |
| `BadgeTile` | Badges | Badge icon with earned/locked visual state |
| `TimeReportTable` | Time Reports | Sortable data table with project rows |

### Reused Patterns (from books/budget reference)
| Pattern | Source | Adaptation |
|---------|--------|------------|
| Glass layout header | books/layout.tsx | Purple accent, habits nav links |
| Hero stats section | books/page.tsx | "Today's Progress" with completion rate |
| Filter pill buttons | books/page.tsx | Habit type filter (standard/timed/negative/measurable) |
| Grid/list toggle | books/page.tsx | For habit list view mode |
| Glass card container | Shared pattern | All content containers |
| Empty state CTA | books/page.tsx | "No habits yet" with create button |

---

## Test Plan

### Unit Tests (Vitest)

| Test File | Coverage |
|-----------|----------|
| `habits-page.test.tsx` | Today page: renders metrics, habit list, heatmap; toggle completion; empty state |
| `habit-detail.test.tsx` | Detail page: renders streak info, heatmap, completions; edit/archive/delete |
| `stats-page.test.tsx` | Stats page: renders metric cards, per-habit bars, patterns; empty state |
| `sobriety-page.test.tsx` | Sobriety: renders clock, money saved, pledge, slip; no-profile empty state |
| `focus-page.test.tsx` | Focus: setup screen, start/pause/skip/stop, session complete; session history |

### Integration Tests (via /browse QA)
- Navigate all 12 routes and verify rendering
- Create a habit via the form and verify it appears on Today page
- Toggle a completion and verify heatmap updates
- Start and stop a focus timer session
- Trigger all 5 states per page (loading, empty, error, success, partial)

---

## QA Checklist

### Critical Path (must pass before merge)
- [ ] `/habits` -- Today dashboard loads with metrics, habit list, heatmap
- [ ] `/habits` -- Click checkbox toggles completion (server action round-trip)
- [ ] `/habits` -- Heatmap renders 52x7 grid with correct intensity levels
- [ ] `/habits/[id]` -- Habit detail shows streak, heatmap, completions, milestones
- [ ] `/habits/[id]` -- Edit habit name/icon/frequency works
- [ ] `/habits/[id]` -- Delete habit with confirmation dialog
- [ ] `/habits/stats` -- Overall stats render (total habits, completions, avg rate)
- [ ] `/habits/stats` -- Per-habit completion bars render
- [ ] `/habits/focus` -- Pomodoro setup, start, pause, resume, skip, stop, complete flow
- [ ] `/habits/focus` -- Browser tab title updates during timer
- [ ] `/habits/sobriety` -- Clock ticks every second, money saved updates
- [ ] `/habits/sobriety` -- Take pledge + slip logging works
- [ ] `/habits/programs` -- Built-in programs render, start enrollment works
- [ ] `/habits/badges` -- Earned vs locked badges display correctly

### Secondary Path
- [ ] `/habits/cravings` -- Log craving form with triggers and outcome
- [ ] `/habits/cravings` -- Trigger frequency and peak time analysis renders
- [ ] `/habits/time-reports` -- Project list with hours and billing amounts
- [ ] `/habits/time-reports` -- CSV export downloads file
- [ ] `/habits/cycle` -- Period history, prediction, fertility window
- [ ] `/habits/pet` -- Pet renders with mood, species picker, name edit

### State Coverage (per page)
- [ ] Loading: skeleton shimmer visible during data fetch
- [ ] Empty: warm CTA shown when no data exists
- [ ] Error: try/catch/finally on all server actions, error card with retry
- [ ] Success: green feedback on mutations
- [ ] Partial: mixed completion states render correctly

### Responsive
- [ ] All pages render correctly at 1440px, 1024px, 768px widths
- [ ] Below 768px: two-column layouts collapse to single column
- [ ] Nav header wraps gracefully on narrow viewports

### Cool Obsidian Compliance
- [ ] Background: `#0A0A0F` (no light backgrounds anywhere)
- [ ] Text: `#F0F0F5` primary, `rgba(240,240,245,0.65)` secondary
- [ ] Cards: glass morphism with `backdrop-filter` on web
- [ ] Accent: `#8B5CF6` for all primary elements
- [ ] Border radius: 16px for cards (xl), 8px for buttons (md), 999px for pills

### Performance
- [ ] Today page loads in < 200ms (no waterfall fetches)
- [ ] Heatmap renders 365 cells without jank
- [ ] Focus timer updates at 200ms intervals without drift
- [ ] Sobriety clock updates at 1s intervals

---

## Implementation Order

| Phase | Pages | Effort | Notes |
|-------|-------|--------|-------|
| 1 | layout.tsx, page.tsx (Today), actions.ts (V3-V4) | L | Core dashboard, heatmap, habit checklist. Extend actions.ts. |
| 2 | [id]/page.tsx, stats/page.tsx | M | Habit detail + stats. Reuse heatmap component. |
| 3 | focus/page.tsx, sobriety/page.tsx | M | Timer + clock. Both have live-updating client state. |
| 4 | programs/page.tsx, badges/page.tsx | S | Read-mostly views. Cards + grids. |
| 5 | cravings/page.tsx, time-reports/page.tsx | M | Form + analytics. Data tables. |
| 6 | cycle/page.tsx, pet/page.tsx | S | Specialized features. Smaller scope. |
| 7 | Tests + QA | M | 5 test files + /browse QA pass + /design-review |

Total: 12 pages (replacing 13 stubs) + ~40 new server actions + 5 test files.
