# Feature Spec: Stars Full Mobile UI

## Metadata
- **Module:** stars
- **Task ID:** M11-6
- **Priority:** P0 (foundation for all Stars mobile work)
- **Estimated CC Time:** 10-14 hours
- **Depends On:** All V1/V2 CRUD and engines already implemented (astro, lunar, compatibility, zodiac-events, transits, retrograde, journal, solar-return, progressions)
- **Prerequisites (from eng review):**
  - Fix moon sign computation: add `getMoonSign(date)` to engine/astro.ts (currently uses sun sign as proxy)
  - Add FTS5 virtual table for journal search (V3 migration -- current CRUD uses LIKE)
  - Add 'red' banner variant to retrograde engine for 3+ simultaneous retrogrades
  - Add `cacheMoonCalendarMonth()` batch insert for fast month swiping
  - Add shared `<RequiresProfileState />` component for 5 profile-gated screens
  - Add foreground-refresh hook (AppState listener) to Today and Sky screens
  - Update `definition.ts` navigation from 5 tabs to 4 tabs (Today/Sky/Journal/More)
- **Blocks:** All Stars mobile features (transit timeline interactions, journal compose UX, compatibility results visualization, etc.)

## Business Context

### Why This Spec Exists
MyStars has 50+ exported functions across 2 schema versions, 9 engines (astro, lunar, compatibility, zodiac-events, transits, retrograde, journal, solar-return, progressions), and 11 database tables. The mobile UI is a single placeholder screen (`index.tsx`) showing moon phase and stats counters. None of the module's functionality is surfaced. This spec designs the full 24-screen mobile experience across 4 tab sections: a personalized daily home, chart and profile management, cosmic weather (transits, retrogrades, lunar, zodiac events), and a private astrology journal.

### Competitor Landscape (Mobile UX)

| Competitor | Screen Count | Navigation Pattern | Standout UX |
|-----------|-------------|-------------------|-------------|
| Co-Star | ~12 | Tab bar (Today, Chart, Compatibility, Profile) | Hyper-minimal black/white, shareable daily readings, social compatibility graph |
| TimePassages | ~15 | Tab bar (Today, Chart, Transits, Calendar) | Dense transit timeline with orbs, solar return navigation, educational tooltips |
| The Pattern | ~10 | Stack (Today, Timing, Relationships, Explore) | Proprietary "Patterns" language, lush gradients, relationship bond scores |
| Nebula | ~8 | Tab bar (Daily, Chart, Compatibility, Explore) | AI-generated readings, compatibility percentage, paywall after first read |
| Stardust | ~6 | Stack (Today, Moon, Retrogrades) | Mercury retrograde countdown, clean card UI, moon phase tracker |

### MyStars Differentiators
- **Privacy-first:** All birth data, charts, and compatibility results stored on-device. No cloud accounts, no friend graph harvesting, no push notification manipulation.
- **Suite integration:** Journal entries bridge to MyMood and MyJournal modules. Lunar cycle overlays for MyHealth cycle tracking. Habit alignment with MyHabits.
- **9 bundled engines** running fully offline (astro, lunar, compatibility, zodiac-events, transits, retrograde, journal context, solar return, progressions).
- **No paywall for basics:** Retrograde status, moon phase, zodiac calendar work without a birth profile. Premium unlocks advanced charts.
- **Honest astrology:** No anxiety-inducing notifications (a known Co-Star complaint). No manipulative engagement hooks.

## Screen Architecture

### Navigation Structure

```
(stars)/
  _layout.tsx              -- Tabs navigator (4 visible tabs + hidden stack screens)
  index.tsx                -- Tab 1: Today (daily snapshot + personalized reading)
  sky.tsx                  -- Tab 2: Sky (cosmic weather: retrogrades, lunar, zodiac events)
  journal.tsx              -- Tab 3: Journal (astrology journal entries)
  settings.tsx             -- Tab 4: Settings (profiles, advanced charts, data)
  birth-chart.tsx          -- Stack: Birth Chart viewer (natal chart visualization)
  add-profile.tsx          -- Stack: Add/Edit Profile (form, modal presentation)
  profile/[id].tsx         -- Stack: Profile Detail (sun/moon/rising, saved charts)
  compatibility.tsx        -- Stack: Compatibility Checker (profile pair selector + results)
  compatibility-history.tsx -- Stack: Past Compatibility Results
  moon-calendar.tsx        -- Stack: Moon Calendar (monthly phase grid)
  zodiac-events.tsx        -- Stack: Zodiac Events (upcoming astrological events)
  transit-timeline.tsx     -- Stack: Transit Timeline (active/upcoming/recent)
  transit-calendar.tsx     -- Stack: Transit Calendar (monthly view with dots)
  retrograde-dashboard.tsx -- Stack: Retrograde Dashboard (status + tips)
  journal-compose.tsx      -- Stack: Compose Journal Entry
  journal-entry/[id].tsx   -- Stack: Journal Entry Detail
  journal-patterns.tsx     -- Stack: Pattern Detection (mood-astrology correlations)
  solar-return.tsx         -- Stack: Solar Return Chart (yearly forecast)
  progressions.tsx         -- Stack: Progressed Chart (long-term evolution)
  daily-reading.tsx        -- Stack: Full Daily Reading (expanded from Today card)
  tarot-card.tsx           -- Stack: Tarot Card of the Day (full card detail)
  readings-history.tsx     -- Stack: Past Daily Readings
```

### Tab Bar Configuration

| Tab | Label | Icon | Screen |
|-----|-------|------|--------|
| 1 | Today | `star` | `index.tsx` |
| 2 | Sky | `moon` | `sky.tsx` |
| 3 | Journal | `book-open` | `journal.tsx` |
| 4 | More | `grid` | `settings.tsx` |

Stack screens are hidden from the tab bar via `href: null` (same pattern as books/recipes modules).

### Layout Pattern

Follow the books module layout pattern (`apps/mobile/app/(books)/_layout.tsx`):
- `Tabs` navigator from `expo-router`
- `ModuleErrorBoundary` wrapper with `moduleName="MyStars"`
- `BackToHubButton` in `headerLeft`
- Accent color: `colors.modules.stars` (`#8B5CF6`)
- Cool Obsidian theme tokens throughout
- Tab bar icon using emoji with opacity toggle for focused/unfocused

---

## Screen Specifications

### Screen 1: Today (`index.tsx`)

**Purpose:** Primary landing screen. The daily touchpoint users open every morning. One dominant cosmic snapshot hero owns the viewport. Designed to feel like opening a private astrolabe, not a dashboard.

**Design decisions (from design review):**
- One dominant hero surface (cosmic snapshot) merges reading + moon + tarot -- no competing cards
- First-open state: onboarding CTA appears AFTER hero, not at page bottom
- Quick links replaced with horizontal action rail (pills, not card grid -- avoids AI slop)
- "Reflect on today" quick action bridges reading -> journal compose
- Foreground refresh: recompute all daily data on AppState 'active' (midnight rollover)
- "Personalized for [Name]" label when profile exists; absent when generic

**Layout:**
```
+-----------------------------------+
| <- MyStars                   ...  |  Header with overflow menu
+-----------------------------------+
|  RETROGRADE BANNER (if active)    |  Full-bleed amber/red banner
|  Mercury Rx until Apr 7      [x] |  Dismissable (calendar-day scope)
|  Banner: 44pt tall, body/500,     |  Stored as dismissedAt timestamp
|  planet in subheading weight      |  in module state (not React state)
+-----------------------------------+
| +-------------------------------+ |
| | COSMIC SNAPSHOT         Mar 23| |  ONE dominant hero surface
| |                               | |  70% of viewport height
| |  Sun in Aries                 | |  Current sun sign (heading/700)
| |  Moon in Scorpio              | |  Current moon sign (body/400)
| |  Waxing Gibbous               | |  Phase emoji + label
| |                               | |
| |  VII - The Chariot            | |  Tarot INSIDE hero (caption/500)
| |  Determination and willpower  | |  Not a separate card
| |                               | |
| |  "Today brings clarity to     | |  Reading summary (body/400)
| |   long-standing questions..." | |  Personalized for Trey (if profile)
| |                               | |
| |  [Read Full Reading]          | |  Primary CTA -> daily-reading.tsx
| |  [Reflect on Today]           | |  Secondary -> journal-compose.tsx
| +-------------------------------+ |
+-----------------------------------+
| FIRST-OPEN STATE (no profile):    |  Appears HERE, not at bottom
| +-------------------------------+ |
| |  Unlock personalized readings | |  surfaceElevated card
| |  Add your birth details for   | |  body/400 + accent CTA
| |  chart analysis and transits. | |
| |  Works great without too.     | |  Reassurance line
| |  [Add Profile]                | |  -> add-profile.tsx (modal)
| +-------------------------------+ |
+-----------------------------------+
| [Moon Cal] [Events] [Match] [Tr] |  Horizontal action rail
|  Scrollable pill buttons, 44pt h  |  Profile-gated pills show lock icon
+-----------------------------------+
| YOUR CHART (only if profile)      |  Compact row, not a hero card
| +-------------------------------+ |
| |  Trey  Sun: Leo  Moon: Pisces | |  Single-line summary
| |  Rising: Sag  [View Chart >]  | |  -> birth-chart.tsx
| +-------------------------------+ |
+-----------------------------------+
| [Today] [Sky] [Journal] [More]   |  Tab bar
+-----------------------------------+
```

**Data Sources:**
- `getMoonPhase(today)` -- current moon phase
- `getZodiacSign(today)` -- current sun sign
- `computeRetrogradeBanner(today)` -- retrograde banner (if any active)
- `getTarotCardOfDay(today)` -- deterministic daily tarot card
- `getBirthProfiles(db)` -- list profiles (show primary)
- `getDailyReading(db, profileId, today)` -- cached reading for today
- `getStarsStats(db)` -- stats for metrics display

**Interactions:**
- Tap "Read Full Reading" -> push `daily-reading`
- Tap "View Card" -> push `tarot-card`
- Tap "View Birth Chart" -> push `birth-chart` with profile ID
- Tap "Add Profile" -> present `add-profile` modally
- Tap any quick link card -> push respective screen
- Retrograde banner tap -> push `retrograde-dashboard`
- Pull-to-refresh recalculates all daily data

**Retrograde Banner Logic:**
- `computeRetrogradeBanner(today)` returns `{ active: boolean, planet: string, endsDate: string, color: 'amber' | 'red' }`
- Amber = single planet retrograde (Mercury, Venus, Mars)
- Red = 3+ planets retrograde simultaneously
- No banner if no retrogrades active
- Banner is dismissable for the session but returns next open

---

### Screen 2: Sky (`sky.tsx`)

**Purpose:** Cosmic weather dashboard. Shows what's happening in the sky right now, independent of birth chart. Accessible to all users without a profile.

**Layout:**
```
+-----------------------------------+
| <- Sky                            |
+-----------------------------------+
| MOON RIGHT NOW                    |  Section header
| +-------------------------------+ |
| |  Full Moon in Scorpio         | |  Phase + sign
| |  94% illuminated              | |  computeIllumination()
| |  [View Moon Calendar]         | |  -> moon-calendar.tsx
| +-------------------------------+ |
+-----------------------------------+
| RETROGRADES                       |  Section header
| +-------------------------------+ |
| |  Mercury Rx  Feb 14 - Mar 15 | |  Active retrogrades (red dot)
| |  Saturn Rx   Jun 7 - Oct 25  | |  Upcoming retrogrades (gray dot)
| |  [Full Retrograde Dashboard]  | |  -> retrograde-dashboard.tsx
| +-------------------------------+ |
+-----------------------------------+
| ZODIAC SEASON                     |  Section header
| +-------------------------------+ |
| |  Aries Season                 | |  Current sun sign season
| |  Mar 20 - Apr 19              | |
| |  Fire sign energy: bold,      | |
| |  initiating, courageous       | |
| +-------------------------------+ |
+-----------------------------------+
| UPCOMING EVENTS                   |  Section header
| +-------------------------------+ |
| |  Mar 25  Full Moon in Libra   | |  Next 5 zodiac events
| |  Mar 29  Mercury enters Aries | |
| |  Apr 1   Venus Rx begins     | |
| |  Apr 8   Solar Eclipse        | |
| |  Apr 19  Taurus Season begins | |
| |  [View All Events]           | |  -> zodiac-events.tsx
| +-------------------------------+ |
+-----------------------------------+
| PERSONAL TRANSITS                 |  (Only if profile exists)
| +-------------------------------+ |
| |  2 active transits            | |
| |  Saturn square natal Moon     | |  Top transit by significance
| |  [View Transit Timeline]      | |  -> transit-timeline.tsx
| +-------------------------------+ |
+-----------------------------------+
```

**Data Sources:**
- `getMoonPhase(today)` + `getZodiacSign(today)` -- moon info
- `computeIllumination(today)` -- illumination percentage
- `computeRetrogradeBanner(today)` + `getActiveRetrogrades(today)` -- retrograde status
- `computeZodiacEvents(year)` -- upcoming events
- `getTransitEventsByProfile(db, profileId)` -- personal transits (if profile)

**Interactions:**
- Tap Moon section -> push `moon-calendar`
- Tap Retrogrades section -> push `retrograde-dashboard`
- Tap "View All Events" -> push `zodiac-events`
- Tap "View Transit Timeline" -> push `transit-timeline`
- Pull-to-refresh updates all sky data

---

### Screen 3: Moon Calendar (`moon-calendar.tsx`)

**Purpose:** Monthly calendar grid showing moon phase, zodiac sign, and illumination for each day. Key phases (new, first quarter, full, last quarter) are highlighted.

**Layout:**
```
+-----------------------------------+
| <- Moon Calendar                  |
+-----------------------------------+
| [<]  March 2026              [>] |  Month navigation
+-----------------------------------+
| Su  Mo  Tu  We  Th  Fr  Sa      |  Day headers
|                                   |
|  1   2   3   4   5   6   7      |  Each day cell shows:
| New               FQ             |  - Phase icon (emoji)
|  8   9  10  11  12  13  14      |  - Key phase label
|                                   |  - Moon sign glyph
| 15  16  17  18  19  20  21      |
|     Full                          |
| 22  23  24  25  26  27  28      |
|              LQ                   |
| 29  30  31                       |
+-----------------------------------+
| TODAY: Mar 23                     |  Detail panel for selected day
| +-------------------------------+ |
| |  Waxing Gibbous in Scorpio   | |  Phase + sign
| |  87% illuminated              | |  Illumination
| |                               | |
| |  "Deep emotional insight.     | |  Phase interpretation
| |   Good for inner work and     | |
| |   transformation."            | |
| |                               | |
| |  Moon in Scorpio: intensity,  | |  Sign interpretation
| |  research, uncovering truth   | |
| +-------------------------------+ |
+-----------------------------------+
| KEY PHASES THIS MONTH             |  Quick reference
| +-------------------------------+ |
| |  New Moon     Mar 1   Pisces  | |
| |  First Qtr    Mar 8   Gemini  | |
| |  Full Moon    Mar 15  Virgo   | |
| |  Last Qtr     Mar 22  Sag    | |
| +-------------------------------+ |
+-----------------------------------+
```

**Data Sources:**
- `computeMoonCalendarMonth(year, month)` -- all days for the month
- `getKeyPhasesForMonth(year, month)` -- key phase dates
- `MOON_PHASE_INTERPRETATIONS` -- phase meaning text
- `MOON_SIGN_INTERPRETATIONS` -- sign meaning text
- `cacheMoonCalendarDay(db, day)` / `getMoonCalendarMonth(db, year, month)` -- SQLite cache

**Interactions:**
- Tap day cell -> select it, show detail panel below
- Swipe left/right or tap arrows -> navigate months
- Key phases section scrolls to selected phase when tapped
- Pre-computes and caches month data on first load

---

### Screen 4: Retrograde Dashboard (`retrograde-dashboard.tsx`)

**Purpose:** Dedicated retrograde status page. Shows which planets are currently retrograde, upcoming retrogrades, and survival tips.

**Layout:**
```
+-----------------------------------+
| <- Retrogrades                    |
+-----------------------------------+
| CURRENTLY RETROGRADE              |  Section (or "No Active Retrogrades")
| +-------------------------------+ |
| |  Mercury Rx                   | |  Planet name + Rx symbol
| |  Feb 14 - Mar 15, 2026       | |  Date range
| |  In Pisces -> Aquarius        | |  Signs traversed
| |  =====[====]========          | |  Progress bar (current position)
| |  Day 22 of 29                 | |  Days elapsed / total
| +-------------------------------+ |
+-----------------------------------+
| SURVIVAL TIPS                     |  getRetrogradeTips(planet)
| +-------------------------------+ |
| |  - Back up all devices        | |
| |  - Avoid signing contracts    | |
| |  - Double-check travel plans  | |
| |  - Re-read before sending     | |
| |  - Review, don't start new    | |
| +-------------------------------+ |
+-----------------------------------+
| UPCOMING RETROGRADES              |  Section header
| +-------------------------------+ |
| |  Saturn Rx   Jun 7 - Oct 25  | |  Next retrograde per planet
| |  Jupiter Rx  Jul 10 - Nov 8  | |
| |  Neptune Rx  Jul 4 - Dec 10  | |
| +-------------------------------+ |
+-----------------------------------+
| 2026 RETROGRADE CALENDAR          |  Year overview
| +-------------------------------+ |
| | J F M A M J J A S O N D      | |  Month strips with colored
| | Mercury   ===   ===   ===    | |  bars showing Rx periods
| | Venus         ====           | |
| | Mars                  ===    | |
| | Jupiter          ========    | |
| | Saturn           =========  | |
| +-------------------------------+ |
+-----------------------------------+
```

**Data Sources:**
- `computeRetrogradeStatuses(today)` -- all planet statuses
- `getActiveRetrogrades(today)` -- currently retrograde planets
- `getUpcomingRetrogrades(today)` -- next retrograde per planet
- `getRetrogradeTips(planet)` -- survival tips from interpretations library
- `RETROGRADE_INTERPRETATIONS` -- detailed retrograde meanings

**Interactions:**
- Tap a retrograde card -> expand inline to show full interpretation
- Year calendar is static, no interaction needed
- Pull-to-refresh updates current positions

---

### Screen 5: Zodiac Events (`zodiac-events.tsx`)

**Purpose:** Scrollable timeline of upcoming astrological events: zodiac season changes, planet ingresses, retrogrades, eclipses.

**Layout:**
```
+-----------------------------------+
| <- Zodiac Events                  |
+-----------------------------------+
| [All] [Seasons] [Retrogrades]    |  Filter chips
| [Eclipses] [Ingresses]           |  filterEventsByCategory()
+-----------------------------------+
| MARCH 2026                        |  Month header
| +-------------------------------+ |
| |  Mar 20  Sun enters Aries    | |  Event card
| |  Aries Season begins.         | |  Brief description
| |  Fire sign energy: bold moves | |
| +-------------------------------+ |
| +-------------------------------+ |
| |  Mar 25  Full Moon in Libra  | |
| |  Balance and partnership      | |
| |  themes illuminated.          | |
| +-------------------------------+ |
+-----------------------------------+
| APRIL 2026                        |  Next month
| +-------------------------------+ |
| |  Apr 1   Venus Rx begins     | |
| |  Apr 8   Solar Eclipse Aries | |
| |  Apr 19  Sun enters Taurus   | |
| +-------------------------------+ |
+-----------------------------------+
```

**Data Sources:**
- `computeZodiacEvents(year)` -- all events for the year
- `computeSunIngresses(year)` -- zodiac season boundaries
- `filterEventsByCategory(events, category)` -- filter by type

**Interactions:**
- Tap filter chip -> filter events by category
- Tap event card -> expand inline to show full description
- Events auto-scroll to "today" on first open
- Lazy-loads future months as user scrolls

---

### Screen 6: Birth Chart Viewer (`birth-chart.tsx`)

**Purpose:** Visual natal chart display for a profile. Shows sun, moon, and rising sign placements with element analysis and brief interpretations.

**Layout:**
```
+-----------------------------------+
| <- Birth Chart           [Edit]  |  Edit -> add-profile (edit mode)
+-----------------------------------+
| +-------------------------------+ |
| |       NATAL CHART WHEEL       | |  Visual chart representation
| |                               | |  (SVG circle with sign segments,
| |    Asc                        | |   planet glyphs positioned by sign)
| |     \     Sun                 | |
| |      \   /                    | |  Simplified wheel showing
| |       \ /                     | |  Sun, Moon, Rising positions
| |  MC----+----IC                | |
| |       / \                     | |
| |      /   \                    | |
| |     /     Moon                | |
| |                               | |
| +-------------------------------+ |
+-----------------------------------+
| PLACEMENTS                        |  Section header
| +-------------------------------+ |
| |  Sun      Leo        Fire    | |  Sign + element badge
| |  Moon     Pisces     Water   | |
| |  Rising   Sagittarius Fire   | |
| +-------------------------------+ |
+-----------------------------------+
| SUN IN LEO                        |  Expandable interpretation
| +-------------------------------+ |
| |  "Creative, warm, and         | |
| |   generous. You lead with     | |
| |   heart and thrive in the     | |
| |   spotlight..."               | |
| +-------------------------------+ |
+-----------------------------------+
| MOON IN PISCES                    |  Expandable interpretation
| +-------------------------------+ |
| |  "Deeply empathetic and       | |
| |   intuitive. Your emotions    | |
| |   flow like water..."         | |
| +-------------------------------+ |
+-----------------------------------+
| ELEMENT BALANCE                   |  Visual breakdown
| +-------------------------------+ |
| |  Fire   ========  67%        | |  Element percentages
| |  Water  ====      33%        | |  based on 3 placements
| |  Earth             0%        | |
| |  Air               0%        | |
| +-------------------------------+ |
+-----------------------------------+
| SAVED CHARTS                      |  getSavedChartsByProfile()
| +-------------------------------+ |
| |  Solar Return 2026     >     | |  -> solar-return.tsx
| |  Progressed Chart      >     | |  -> progressions.tsx
| +-------------------------------+ |
+-----------------------------------+
```

**Data Sources:**
- `getBirthProfile(db, id)` -- profile with sun/moon/rising
- `getZodiacElement(sign)` -- element for each sign
- `getSavedChartsByProfile(db, profileId)` -- saved charts list

**Interactions:**
- Tap "Edit" -> present `add-profile` in edit mode
- Tap placement row -> expand/collapse interpretation section
- Tap "Solar Return 2026" -> push `solar-return` with profile
- Tap "Progressed Chart" -> push `progressions` with profile
- Chart wheel is a simplified SVG, non-interactive (decorative)

---

### Screen 7: Add/Edit Profile (`add-profile.tsx`)

**Purpose:** Form to create or edit a birth profile. Modal presentation.

**Layout:**
```
+-----------------------------------+
| [Cancel]  Add Profile    [Save]  |  Modal header
+-----------------------------------+
| Name *                            |  Required
| [                              ]  |
| Birth Date *                      |  Required, date picker
| [March 23, 1992]                 |
| Birth Time                        |  Optional, time picker
| [2:30 PM]                        |  (Unknown option available)
| Birth Place                       |  Optional, text input
| [San Francisco, CA]              |
+-----------------------------------+
| COMPUTED SIGNS                    |  Auto-computed on save
| +-------------------------------+ |
| |  These will be calculated     | |
| |  from your birth data.        | |
| |                               | |
| |  Sun:    (from birth date)    | |
| |  Moon:   (from birth date)    | |
| |  Rising: (requires time+place)| |
| +-------------------------------+ |
+-----------------------------------+
```

**Data Sources:**
- `createBirthProfile(db, input)` -- create
- `updateBirthProfile(db, id, input)` -- update
- `getZodiacSign(birthDate)` -- compute sun sign
- `getMoonPhase(birthDate)` -- moon phase at birth

**Interactions:**
- Save validates: name required (1-100 chars), birth date required
- On save: computes sun sign from date, moon sign if time provided
- Rising sign requires both time and place (note: approximate without full ephemeris)
- Cancel: confirmation dialog if form has unsaved changes
- Edit mode: pre-fills all fields from existing profile

---

### Screen 8: Profile Detail (`profile/[id].tsx`)

**Purpose:** Full profile view with all astrological data, charts, and actions for one person.

**Layout:**
```
+-----------------------------------+
| <- Trey                     ...  |  Header with overflow menu
+-----------------------------------+
| +-------------------------------+ |
| |  Sun: Leo                     | |  Big three display
| |  Moon: Pisces                 | |  with sign glyphs
| |  Rising: Sagittarius          | |
| |                               | |
| |  Born: Mar 23, 1992           | |
| |  San Francisco, CA  2:30 PM  | |
| +-------------------------------+ |
+-----------------------------------+
| ACTIONS                           |  Action grid
| +-------+ +-------+ +-------+   |
| | Birth | |Compat | |Transit|   |
| | Chart | |ibility| |  s    |   |
| +-------+ +-------+ +-------+   |
| +-------+ +-------+ +-------+   |
| | Solar | |Progr  | |Journal|   |
| |Return | |essed  | |       |   |
| +-------+ +-------+ +-------+   |
+-----------------------------------+
| READINGS                          |  Recent daily readings
| +-------------------------------+ |
| |  Mar 23  Moon in Scorpio     | |
| |  Mar 22  Moon in Libra       | |
| |  [View All Readings]         | |  -> readings-history
| +-------------------------------+ |
+-----------------------------------+
```

**Interactions:**
- Tap Birth Chart -> push `birth-chart` with profile
- Tap Compatibility -> push `compatibility` with profile pre-selected
- Tap Transits -> push `transit-timeline` with profile
- Tap Solar Return -> push `solar-return` with profile
- Tap Progressed -> push `progressions` with profile
- Overflow: Edit, Delete (with cascade warning)

---

### Screen 9: Compatibility Checker (`compatibility.tsx`)

**Purpose:** Select two profiles and view element-based compatibility analysis with cached results.

**Layout:**
```
+-----------------------------------+
| <- Compatibility                  |
+-----------------------------------+
| SELECT TWO PROFILES               |
| +-------------------------------+ |
| |  Person A                     | |  Picker (dropdown of profiles)
| |  [Trey - Leo]                 | |
| |                               | |
| |         vs                    | |  Versus divider
| |                               | |
| |  Person B                     | |  Picker
| |  [Select a profile...]       | |
| |                               | |
| |  [Compare]                    | |  Primary action (disabled until both)
| +-------------------------------+ |
+-----------------------------------+
| RESULT (after Compare)            |
| +-------------------------------+ |
| |      Overall Score            | |
| |         78%                   | |  Large score display
| |  =============                | |  Score bar (accent color fill)
| |                               | |
| |  Element Compatibility        | |
| |  Fire + Water = Steam         | |  Element pairing description
| |  "Dynamic tension that        | |
| |   creates transformation..."  | |
| |                               | |
| |  Sun Sign Match               | |
| |  Leo + Pisces                 | |
| |  "Creative dreamer meets      | |
| |   bold performer..."          | |
| +-------------------------------+ |
+-----------------------------------+
| PAST RESULTS                      |  getRecentCompatibilityResults()
| +-------------------------------+ |
| |  Trey + Alex       78%    >  | |
| |  Trey + Jordan     85%    >  | |
| |  [View All]                   | |  -> compatibility-history
| +-------------------------------+ |
+-----------------------------------+
```

**Data Sources:**
- `getBirthProfiles(db)` -- populate pickers
- `computeQuickMatch(signA, signB)` -- compatibility analysis
- `saveCompatibilityResult(db, result)` -- cache result
- `getCompatibilityResult(db, profileA, profileB)` -- check cache
- `getRecentCompatibilityResults(db)` -- past results

**Interactions:**
- Select profiles from dropdown pickers
- Tap Compare -> run `computeQuickMatch`, animate score reveal
- Tap past result -> show cached analysis inline
- Cannot compare a profile with itself (disabled state)

---

### Screen 10: Transit Timeline (`transit-timeline.tsx`)

**Purpose:** Active, upcoming, and recent transits for a profile. Shows which planets are currently aspecting the natal chart.

**Layout:**
```
+-----------------------------------+
| <- Transits                       |
+-----------------------------------+
| [Active] [Upcoming] [Recent]     |  Segmented control
+-----------------------------------+
| [All] [Major Only] [Minor Only]  |  Filter chips
+-----------------------------------+
| +-------------------------------+ |
| |  MAJOR  Saturn sq. natal Moon | |  Transit card
| |  Orb: 2.3 deg (applying)     | |  Orb + direction
| |  =====[==]===============     | |  Progress bar (entering->exact->leaving)
| |  "Emotional restructuring..." | |  Brief interpretation
| +-------------------------------+ |
| +-------------------------------+ |
| |  minor  Venus cnj. natal Sun | |  Minor transit
| |  Orb: 0.8 deg (separating)   | |
| |  =================[=]=       | |
| |  "Charm and creativity..."   | |
| +-------------------------------+ |
+-----------------------------------+
| [Transit Calendar]               |  Link -> transit-calendar.tsx
+-----------------------------------+
| No Chart State:                   |
| "Calculate your natal chart to   |
|  track personal transits."       |
| [Add Profile]                    |
+-----------------------------------+
```

**Data Sources:**
- `detectTransitsForDate(db, profileId, today)` -- compute transits
- `classifySignificance(transit)` -- major/minor classification
- `filterBySignificance(transits, filter)` -- apply filter
- `saveTransitEvent(db, event)` -- cache computed transit
- `getTransitEventsByProfile(db, profileId)` -- cached events

**Interactions:**
- Segmented control: Active (within orb now), Upcoming (exact in next 30 days), Recent (exact in past 14 days)
- Filter chips: All, Major Only, Minor Only
- Tap transit card -> expand inline for full interpretation
- Tap Transit Calendar -> push `transit-calendar`
- Pull-to-refresh recalculates positions and orbs

---

### Screen 11: Transit Calendar (`transit-calendar.tsx`)

**Purpose:** Monthly calendar view with colored dots showing transit dates. Orange dots for major transits, gray for minor.

**Layout:**
```
+-----------------------------------+
| <- Transit Calendar               |
+-----------------------------------+
| [<]  March 2026              [>] |  Month navigation
+-----------------------------------+
| Su  Mo  Tu  We  Th  Fr  Sa      |
|  1   2   3   4   5   6   7      |
|              .                    |  Orange dot = major transit
|  8   9  10  11  12  13  14      |
|  .       ..                      |  Multiple dots = multiple transits
| 15  16  17  18  19  20  21      |
|          .                       |
| 22  23  24  25  26  27  28      |
|      .                           |
| 29  30  31                       |
+-----------------------------------+
| MARCH 23 (selected)              |  Detail panel
| +-------------------------------+ |
| |  Saturn sq. natal Moon  MAJOR | |  Transit for selected day
| |  Venus cnj. natal Sun  minor | |
| +-------------------------------+ |
+-----------------------------------+
```

**Interactions:**
- Tap day -> show transits for that day in detail panel
- Swipe left/right -> navigate months
- Orange dot: major transit exact on that date
- Gray dot: minor transit exact on that date

---

### Screen 12: Journal List (`journal.tsx`)

**Purpose:** Astrology journal. List of entries with auto-captured cosmic context (moon phase, sun sign, retrogrades) alongside user reflections.

**Layout:**
```
+-----------------------------------+
| <- Journal                    +  |  Header with compose button
+-----------------------------------+
| [Search...]                      |  Search bar (FTS5)
+-----------------------------------+
| [Entries] [Patterns]             |  Segmented control
+-----------------------------------+
| +-------------------------------+ |
| |  Mar 23, 2026                 | |  Entry card
| |  Waxing Gibbous  Scorpio     | |  Moon phase icon + sign
| |  (calm)                       | |  Mood dot (colored)
| |  "Feeling grounded today.     | |  Content preview (100 chars)
| |   The Scorpio moon brought..." | |
| +-------------------------------+ |
| +-------------------------------+ |
| |  Mar 22, 2026                 | |
| |  Waxing Gibbous  Libra       | |
| |  (contemplative)              | |
| |  "Had a long conversation..." | |
| +-------------------------------+ |
+-----------------------------------+
| Empty State:                      |
| "Your astrology journal is empty" |
| "Write your first entry to start |
|  tracking cosmic correlations."  |
| [Write First Entry]             |  -> journal-compose.tsx
+-----------------------------------+
```

**Data Sources:**
- `getJournalEntries(db, { limit: 50, offset: 0 })` -- paginated entries
- `searchJournalEntries(db, query)` -- FTS5 search
- `getJournalEntryCount(db)` -- total count (for patterns threshold)
- `detectPatterns(entries)` -- pattern analysis (30+ entries required)

**Interactions:**
- Tap + or "Write First Entry" -> push `journal-compose`
- Tap entry card -> push `journal-entry/[id]`
- Type in search bar -> real-time FTS5 filtering
- Tap "Patterns" segment -> show patterns view (or locked state if < 30 entries)
- Pull-to-refresh reloads entries

**Patterns Tab (inside segmented control):**
```
+-----------------------------------+
| PATTERNS (30+ entries required)   |
+-----------------------------------+
| Unlocked State:                   |
| +-------------------------------+ |
| |  HIGH CONFIDENCE              | |
| |  You feel "inspired" 62%     | |  Pattern card
| |  more during Full Moons       | |
| |  (14 entries)                  | |  Supporting count
| +-------------------------------+ |
| +-------------------------------+ |
| |  MEDIUM CONFIDENCE            | |
| |  "anxious" appears 48% more  | |
| |  during Mercury Rx            | |
| |  (8 entries)                   | |
| +-------------------------------+ |
+-----------------------------------+
| Locked State:                     |
| "Write [N] more entries to       |
|  unlock pattern detection."      |
| [===============     ]  22/30    |  Progress bar
+-----------------------------------+
```

---

### Screen 13: Journal Compose (`journal-compose.tsx`)

**Purpose:** Write a new journal entry. Auto-captures current astrological context.

**Layout:**
```
+-----------------------------------+
| [Cancel]  New Entry      [Save]  |  Modal-style header
+-----------------------------------+
| COSMIC CONTEXT                    |  Auto-captured card
| +-------------------------------+ |
| |  Mar 23, 2026                 | |  Date
| |  Waxing Gibbous in Scorpio   | |  Moon phase + sign
| |  Sun in Aries                 | |  Current sun sign
| |  Mercury Rx                   | |  Active retrogrades (if any)
| |  VII - The Chariot            | |  Today's tarot card
| +-------------------------------+ |
+-----------------------------------+
| MOOD (optional)                   |
| +-------------------------------+ |
| | [inspired] [calm] [anxious]  | |  Mood pills (colored)
| | [frustrated] [joyful]        | |
| | [contemplative] [energized]  | |
| | [drained]                     | |
| +-------------------------------+ |
+-----------------------------------+
| [                                ]|  Large text area
| [                                ]|  Placeholder: "How are the stars
| [                                ]|   affecting you today?"
| [                                ]|
| [                                ]|
|                          0/5,000  |  Character count
+-----------------------------------+
```

**Data Sources:**
- `captureAstrologicalContext(today)` -- auto-capture moon, sun, retrogrades
- `getTarotCardOfDay(today)` -- tarot card for context display
- `isValidMood(mood)` -- validate mood selection
- `validateJournalContent(content)` -- validate content length
- `createJournalEntry(db, entry)` -- save

**Interactions:**
- Tap mood pill -> select/deselect (single selection, optional)
- Type content -> character count updates live
- Save: validates non-empty content, max 5,000 chars
- Cancel: confirmation dialog if text entered
- After save: navigates back to journal list

**Mood Colors:**
- inspired: `#FFD700`, calm: `#30D158`, anxious: `#FF9F0A`, frustrated: `#FF453A`
- joyful: `#FF375F`, contemplative: `#8B5CF6`, energized: `#32D74B`, drained: `#98989D`

---

### Screen 14: Journal Entry Detail (`journal-entry/[id].tsx`)

**Purpose:** Full view of a single journal entry with cosmic context and content.

**Layout:**
```
+-----------------------------------+
| <- Entry                    ...  |  Overflow: Edit, Delete
+-----------------------------------+
| Mar 23, 2026                      |  Date
| +-------------------------------+ |
| |  Waxing Gibbous in Scorpio   | |  Context card
| |  Sun in Aries                 | |
| |  Mercury Rx                   | |
| |  VII - The Chariot            | |
| |  Mood: calm                   | |  Mood badge (colored)
| +-------------------------------+ |
+-----------------------------------+
| "Feeling grounded today. The     | |  Full content
| Scorpio moon brought deep        | |
| insight into a relationship      | |
| question I've been sitting       | |
| with. The Chariot card feels     | |
| right -- time to move forward    | |
| with determination."             | |
+-----------------------------------+
```

**Interactions:**
- Overflow menu: Edit (-> journal-compose with pre-fill), Delete (confirmation dialog)
- Delete calls `deleteJournalEntry(db, id)`

---

### Screen 15: Solar Return (`solar-return.tsx`)

**Purpose:** Solar return chart for a profile. Shows the birthday-year forecast with sun and moon sign positions at the exact solar return moment.

**Layout:**
```
+-----------------------------------+
| <- Solar Return                   |
+-----------------------------------+
| [<]  2026                    [>] |  Year navigation
+-----------------------------------+
| +-------------------------------+ |
| |  Solar Return: Mar 23, 2026  | |  Exact return date
| |  at 14:22 UTC                 | |
| |                               | |
| |  Sun: Aries  Moon: Gemini    | |  Positions at return moment
| +-------------------------------+ |
+-----------------------------------+
| YEAR THEME                        |
| +-------------------------------+ |
| |  "A year of bold new          | |  computeSolarReturn()
| |   beginnings. The Aries Sun   | |  Year theme interpretation
| |   brings initiative, while    | |
| |   the Gemini Moon adds        | |
| |   adaptability and social     | |
| |   curiosity..."               | |
| +-------------------------------+ |
+-----------------------------------+
| SOLAR RETURN RANGE               |
| +-------------------------------+ |
| |  Previous: Mar 23, 2025      | |  computeSolarReturnRange()
| |  Current:  Mar 23, 2026      | |
| |  Next:     Mar 23, 2027      | |
| +-------------------------------+ |
+-----------------------------------+
```

**Data Sources:**
- `computeSolarReturn(birthDate, year)` -- solar return moment
- `computeSolarReturnRange(birthDate, year)` -- previous/current/next
- `saveSolarReturn(db, result)` -- cache
- `getSolarReturn(db, profileId, year)` -- check cache

**Interactions:**
- Tap year arrows -> navigate to previous/next solar return year
- Year range list scrollable for historical returns
- Requires a birth profile with birth date

---

### Screen 16: Progressions (`progressions.tsx`)

**Purpose:** Secondary progressions chart showing long-term personal evolution. Focuses on the progressed Moon, which changes signs every 2-3 years.

**Layout:**
```
+-----------------------------------+
| <- Progressions                   |
+-----------------------------------+
| +-------------------------------+ |
| |  PROGRESSED MOON              | |  Primary focus
| |  Currently in: Capricorn      | |
| |  Degree: ~18                  | |
| |                               | |
| |  "A period of ambition and    | |  Moon sign interpretation
| |   practical focus. Building   | |
| |   structures that last..."    | |
| +-------------------------------+ |
+-----------------------------------+
| NEXT SIGN CHANGE                  |
| +-------------------------------+ |
| |  Aquarius in ~1.4 years       | |  forecastMoonSignChange()
| |  (around July 2027)           | |
| |                               | |
| |  "Shifting toward innovation, | |
| |   community, and             | |
| |   independence..."            | |
| +-------------------------------+ |
+-----------------------------------+
| PROGRESSED SUN                    |
| +-------------------------------+ |
| |  Currently in: Taurus         | |  Moves ~1 degree/year
| |  Degree: ~4                   | |
| |  (Sun entered Taurus at age   | |
| |   ~8, will enter Gemini       | |
| |   around age ~38)             | |
| +-------------------------------+ |
+-----------------------------------+
| YOUR AGE: 33.9 years             |  computeAgeInYears()
+-----------------------------------+
```

**Data Sources:**
- `computeProgressedChart(birthDate, today)` -- full progressed chart
- `computeProgressedDate(birthDate, today)` -- the progressed date
- `computeAgeInYears(birthDate, today)` -- current age
- `forecastMoonSignChange(progressedChart)` -- next Moon sign change
- `saveProgressedChart(db, result)` -- cache
- `getProgressedChart(db, profileId)` -- check cache

**Interactions:**
- Static display, no direct interactions
- Refreshes on load with current date
- Requires a birth profile with birth date

---

### Screen 17: Daily Reading (`daily-reading.tsx`)

**Purpose:** Full daily reading with personalized astrological summary for a profile. Combines moon phase, sun sign, transits, and tarot into a cohesive reading.

**Layout:**
```
+-----------------------------------+
| <- Today's Reading                |
+-----------------------------------+
| Mar 23, 2026                      |
| +-------------------------------+ |
| |  Sun in Aries                 | |
| |  Moon: Waxing Gibbous Scorpio| |
| |  Tarot: VII - The Chariot    | |
| +-------------------------------+ |
+-----------------------------------+
| DAILY SUMMARY                     |
| +-------------------------------+ |
| |  "Today the Aries Sun fuels  | |
| |   your ambition while the    | |
| |   Scorpio Moon deepens your  | |
| |   emotional insight. This    | |
| |   is a day for bold moves    | |
| |   backed by intuition.       | |
| |                               | |
| |   The Chariot card confirms  | |
| |   forward momentum. Channel  | |
| |   the determination without  | |
| |   forcing outcomes.          | |
| |                               | |
| |   Active retrogrades may     | |
| |   slow communication, so     | |
| |   double-check details."     | |
| +-------------------------------+ |
+-----------------------------------+
| ACTIVE TRANSITS (if profile)     |
| +-------------------------------+ |
| |  Saturn sq. natal Moon        | |  Top transits for context
| |  Venus cnj. natal Sun        | |
| +-------------------------------+ |
+-----------------------------------+
```

**Data Sources:**
- `getDailyReading(db, profileId, today)` -- cached reading
- `createDailyReading(db, input)` -- generate and cache
- `getMoonPhase(today)` + `getZodiacSign(today)` -- current sky
- `getTarotCardOfDay(today)` -- tarot
- `getTransitEventsByProfile(db, profileId)` -- active transits

---

### Screen 18: Tarot Card of the Day (`tarot-card.tsx`)

**Purpose:** Full display of today's tarot card with name, number, suit, and meaning.

**Layout:**
```
+-----------------------------------+
| <- Card of the Day                |
+-----------------------------------+
| +-------------------------------+ |
| |                               | |
| |         VII                   | |  Card number (large)
| |    THE CHARIOT                | |  Card name
| |                               | |
| |    Major Arcana               | |  Suit/type
| |                               | |
| +-------------------------------+ |
+-----------------------------------+
| MEANING                           |
| +-------------------------------+ |
| |  "Determination, willpower,   | |
| |   triumph over obstacles.     | |
| |   Victory through focus       | |
| |   and discipline."            | |
| +-------------------------------+ |
+-----------------------------------+
| REVERSED                          |
| +-------------------------------+ |
| |  "Self-doubt, scattered       | |
| |   energy, lack of direction." | |
| +-------------------------------+ |
+-----------------------------------+
```

**Data Sources:**
- `getTarotCardOfDay(today)` -- deterministic card selection (78-card deck, cycling by Julian Day)

---

### Screen 19: Readings History (`readings-history.tsx`)

**Purpose:** List of past daily readings for a profile, sorted by most recent.

**Layout:**
```
+-----------------------------------+
| <- Past Readings                  |
+-----------------------------------+
| +-------------------------------+ |
| |  Mar 23  Moon in Scorpio     | |  Reading card
| |  Waxing Gibbous              | |
| |  VII - The Chariot            | |  Tarot
| |  "Today brings clarity..."    | |  Summary preview
| +-------------------------------+ |
| +-------------------------------+ |
| |  Mar 22  Moon in Libra       | |
| |  Waxing Gibbous              | |
| |  III - The Empress            | |
| |  "Nurture your creative..."   | |
| +-------------------------------+ |
+-----------------------------------+
```

**Interactions:**
- Tap reading card -> push `daily-reading` with date override
- Infinite scroll for past readings

---

### Screen 20: Compatibility History (`compatibility-history.tsx`)

**Purpose:** List of all past compatibility analyses.

**Layout:**
```
+-----------------------------------+
| <- Past Comparisons               |
+-----------------------------------+
| +-------------------------------+ |
| |  Trey + Alex         78%     | |  Result card
| |  Leo + Gemini                 | |
| |  Computed: Mar 20, 2026       | |
| +-------------------------------+ |
| +-------------------------------+ |
| |  Trey + Jordan       85%     | |
| |  Leo + Leo                    | |
| |  Computed: Mar 18, 2026       | |
| +-------------------------------+ |
+-----------------------------------+
```

**Interactions:**
- Tap result card -> inline expand with full analysis

---

### Screen 21: Settings (`settings.tsx`)

**Purpose:** Module settings, profile management, data management, and access to advanced features.

**Layout:**
```
+-----------------------------------+
| <- More                           |
+-----------------------------------+
| PROFILES                          |  Section
| +-------------------------------+ |
| |  Trey (primary)          >   | |  -> profile/[id]
| |  Alex                    >   | |
| |  Jordan                  >   | |
| |  [+ Add Profile]             | |  -> add-profile (modal)
| +-------------------------------+ |
+-----------------------------------+
| ADVANCED CHARTS                   |  Section
| +-------------------------------+ |
| |  Solar Return            >   | |  -> solar-return
| |  Progressed Chart        >   | |  -> progressions
| |  Compatibility History   >   | |  -> compatibility-history
| +-------------------------------+ |
+-----------------------------------+
| SKY TOOLS                         |  Section
| +-------------------------------+ |
| |  Moon Calendar           >   | |  -> moon-calendar
| |  Zodiac Events           >   | |  -> zodiac-events
| |  Retrograde Dashboard   >   | |  -> retrograde-dashboard
| |  Transit Timeline        >   | |  -> transit-timeline
| |  Transit Calendar        >   | |  -> transit-calendar
| +-------------------------------+ |
+-----------------------------------+
| DATA                              |  Section
| +-------------------------------+ |
| |  Journal Entries: 42          | |  Count
| |  Daily Readings: 28          | |
| |  Saved Charts: 3             | |
| |  Compatibility Results: 5    | |
| +-------------------------------+ |
+-----------------------------------+
| ABOUT                             |
| +-------------------------------+ |
| |  Version: 0.2.0              | |
| |  All data stored on-device   | |
| |  No cloud, no tracking       | |
| +-------------------------------+ |
+-----------------------------------+
```

**Data Sources:**
- `getBirthProfiles(db)` -- all profiles
- `getStarsStats(db)` -- data counts

**Interactions:**
- Tap profile -> push `profile/[id]`
- Tap "+ Add Profile" -> present `add-profile` modally
- Tap any tool/chart link -> push respective screen

---

## State Coverage (All Screens)

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Shimmer placeholders on cards | Fetching data from SQLite |
| Empty (no profiles) | "Add your birth details" CTA | No birth profiles exist |
| Empty (no data) | Feature-specific empty state with action CTA | No entries/results for feature |
| Error | "Could not load [feature]. Pull to retry." | Database or computation error |
| Success | Full data display | Data loaded successfully |
| No Profile Required | Full display (sky, retrogrades, moon, zodiac events) | Features that work without birth data |
| Patterns Locked | Progress bar "Write N more entries" | Journal < 30 entries |

## Design Tokens

All screens use Cool Obsidian theme from `@mylife/ui`:

| Token | Value | Usage |
|-------|-------|-------|
| Accent | `#8B5CF6` (violet) | Tab bar active, buttons, progress bars, headings |
| Background | `#0A0A0F` | Screen backgrounds |
| Surface | `#12121A` | Card fills |
| Surface Elevated | `#1A1A24` | Inner cards, expanded sections |
| Text | `#F0F0F5` | Primary text |
| Text Secondary | `rgba(240,240,245,0.65)` | Labels, captions |
| Border | `rgba(255,255,255,0.06)` | Card borders |
| Glass | `rgba(255,255,255,0.04)` | Glass card fill |
| Major Transit | `#FF9500` | Major transit badges, orange dots |
| Minor Transit | `rgba(255,255,255,0.4)` | Minor transit badges, gray dots |
| Retrograde Amber | `#FF9F0A` | Single planet Rx banner |
| Retrograde Red | `#FF453A` | 3+ planets Rx banner |
| Danger | `#FF453A` | Delete actions, char count over limit |
| Success | `#30D158` | Saved confirmations |

## Cross-Module Integration Points

| Module | Integration | Screen |
|--------|-------------|--------|
| **MyMood** | Mood tags in journal correlate with Mood module tracking | Journal Compose |
| **MyJournal** | Astrology journal entries could surface in main journal timeline | Journal List |
| **MyHabits** | "Start new habits on New Moon" suggestion | Moon Calendar |
| **MyHealth** | Lunar cycle overlay for menstrual cycle awareness | Moon Calendar |

## Implementation Sequence

Build in this order to maximize incremental value:

1. **Layout + Today screen** -- Replace `_layout.tsx` (Stack -> Tabs), rebuild `index.tsx` with daily snapshot
2. **Sky screen** -- Cosmic weather dashboard (retrogrades, moon, zodiac season, events)
3. **Moon Calendar + Retrograde Dashboard** -- Most popular casual features
4. **Birth Chart + Profile screens** -- Core profile management with chart viewer
5. **Compatibility Checker** -- Social hook, high engagement
6. **Transit Timeline + Calendar** -- Personalized transit tracking
7. **Journal List + Compose + Entry Detail** -- Astrology journal with FTS5 search
8. **Journal Patterns** -- Pattern detection (unlocks after 30 entries)
9. **Solar Return + Progressions** -- Advanced chart features
10. **Settings + History screens** -- Polish and data management
11. **Tarot Card + Daily Reading + Readings History** -- Daily content features

## Files Changed

### New Files (23)
- `apps/mobile/app/(stars)/_layout.tsx` -- Tabs navigator (replaces existing Stack layout)
- `apps/mobile/app/(stars)/index.tsx` -- Today screen (replaces existing placeholder)
- `apps/mobile/app/(stars)/sky.tsx` -- Sky/cosmic weather tab
- `apps/mobile/app/(stars)/journal.tsx` -- Journal tab
- `apps/mobile/app/(stars)/settings.tsx` -- Settings/More tab
- `apps/mobile/app/(stars)/birth-chart.tsx` -- Birth chart viewer
- `apps/mobile/app/(stars)/add-profile.tsx` -- Add/edit profile form (modal)
- `apps/mobile/app/(stars)/profile/[id].tsx` -- Profile detail
- `apps/mobile/app/(stars)/compatibility.tsx` -- Compatibility checker
- `apps/mobile/app/(stars)/compatibility-history.tsx` -- Past comparisons
- `apps/mobile/app/(stars)/moon-calendar.tsx` -- Monthly moon phase grid
- `apps/mobile/app/(stars)/zodiac-events.tsx` -- Upcoming astrological events
- `apps/mobile/app/(stars)/transit-timeline.tsx` -- Transit tracker with segments
- `apps/mobile/app/(stars)/transit-calendar.tsx` -- Transit calendar view
- `apps/mobile/app/(stars)/retrograde-dashboard.tsx` -- Retrograde status + tips
- `apps/mobile/app/(stars)/journal-compose.tsx` -- Compose journal entry
- `apps/mobile/app/(stars)/journal-entry/[id].tsx` -- Journal entry detail
- `apps/mobile/app/(stars)/journal-patterns.tsx` -- Pattern detection view
- `apps/mobile/app/(stars)/solar-return.tsx` -- Solar return chart
- `apps/mobile/app/(stars)/progressions.tsx` -- Progressed chart
- `apps/mobile/app/(stars)/daily-reading.tsx` -- Full daily reading
- `apps/mobile/app/(stars)/tarot-card.tsx` -- Tarot card of the day
- `apps/mobile/app/(stars)/readings-history.tsx` -- Past daily readings

### Modified Files (5)
- `modules/stars/src/definition.ts` -- Update navigation tabs (5->4) and screens to match new layout
- `modules/stars/src/engine/astro.ts` -- Add `getMoonSign(date)` function (prerequisite)
- `modules/stars/src/engine/retrograde.ts` -- Add 'red' to BannerColor type (prerequisite)
- `modules/stars/src/db/schema.ts` -- V3 migration adding FTS5 virtual table (prerequisite)
- `modules/stars/src/db/crud.ts` -- Update searchJournalEntries to FTS5, add cacheMoonCalendarMonth batch

### New Test Files (8)
- `apps/mobile/app/(stars)/__tests__/layout.test.tsx`
- `apps/mobile/app/(stars)/__tests__/today.test.tsx`
- `apps/mobile/app/(stars)/__tests__/sky.test.tsx`
- `apps/mobile/app/(stars)/__tests__/journal.test.tsx`
- `apps/mobile/app/(stars)/__tests__/journal-compose.test.tsx`
- `apps/mobile/app/(stars)/__tests__/compatibility.test.tsx`
- `apps/mobile/app/(stars)/__tests__/moon-calendar.test.tsx`
- `apps/mobile/app/(stars)/__tests__/settings.test.tsx`

### New Shared Component (1)
- `apps/mobile/app/(stars)/components/RequiresProfileState.tsx` -- Shared empty state for profile-gated screens

## Acceptance Criteria

### Navigation
- [ ] **AC-1:** Module opens to Today tab by default with daily snapshot
- [ ] **AC-2:** 4 tab bar items visible: Today, Sky, Journal, More
- [ ] **AC-3:** All 20+ stack screens accessible via navigation (hidden from tab bar)
- [ ] **AC-4:** BackToHubButton present in tab screen headers

### Today Tab
- [ ] **AC-5:** Retrograde banner appears when any planet is retrograde
- [ ] **AC-6:** Daily reading card shows sun sign, moon phase, and personalized summary
- [ ] **AC-7:** Tarot card of the day displays with deterministic selection
- [ ] **AC-8:** Quick link grid navigates to all major features
- [ ] **AC-9:** Empty profile state shows "Add Profile" CTA

### Sky Tab
- [ ] **AC-10:** Moon section shows current phase, sign, and illumination percentage
- [ ] **AC-11:** Retrograde section lists active and upcoming retrogrades
- [ ] **AC-12:** Zodiac season displays current sun sign period
- [ ] **AC-13:** Next 5 zodiac events listed with dates and descriptions
- [ ] **AC-14:** Personal transits section appears only when a profile exists

### Chart and Profile
- [ ] **AC-15:** Birth chart shows sun/moon/rising placements with element analysis
- [ ] **AC-16:** Add profile form validates name and birth date as required
- [ ] **AC-17:** Computed signs auto-populate on profile save
- [ ] **AC-18:** Profile detail shows actions grid linking to all chart features

### Compatibility
- [ ] **AC-19:** Two-profile picker with Compare button
- [ ] **AC-20:** Score displayed as percentage with element compatibility description
- [ ] **AC-21:** Results cached in SQLite and shown in history

### Transits
- [ ] **AC-22:** Active/Upcoming/Recent segmented control works
- [ ] **AC-23:** Major/Minor filter chips filter transit list
- [ ] **AC-24:** Transit cards show significance badge, orb, progress bar, interpretation
- [ ] **AC-25:** "No chart" state shown when no profile exists

### Journal
- [ ] **AC-26:** Entry list shows date, mood dot, moon phase, content preview
- [ ] **AC-27:** Compose auto-captures moon phase, sun sign, retrogrades, tarot card
- [ ] **AC-28:** Mood selector offers 8 options as colored pills
- [ ] **AC-29:** FTS5 search filters entries in real-time
- [ ] **AC-30:** Patterns tab requires 30+ entries, shows progress bar when locked

### Advanced Charts
- [ ] **AC-31:** Solar return shows yearly theme with year navigation
- [ ] **AC-32:** Progressions show progressed Moon sign with next change forecast

### Data Integrity
- [ ] **AC-33:** All data stored in SQLite with `st_` prefix
- [ ] **AC-34:** No network requests from any screen
- [ ] **AC-35:** Profile deletion cascades to transits, readings, charts (not journal entries)

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required after building UI:
- [ ] `/browse` -- navigate to each tab, verify all screens load, test navigation flow
- [ ] After 5 screens built: `/qa` on the module URL

### Post-merge:
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Accessibility Requirements (from design review)

- **Touch targets:** Minimum 44x44pt for all interactive elements (buttons, cards, pills, tab items, action rail pills)
- **Screen reader labels:** Moon phase emoji get descriptive labels ("Full Moon", not Unicode name). Mood pills announce color + label ("calm, green"). Progress bars announce percentage ("Saturn square Moon transit, 70% complete").
- **Chart wheel:** Decorative, `accessibilityElementsHidden={true}`. Placements section provides text equivalent.
- **Journal compose:** Character count reads as "250 of 5000 characters used". Mood pills use color + text (not color-only, for colorblind users).
- **Color contrast:** All Cool Obsidian text tokens pass WCAG AA (#F0F0F5 on #0A0A0F = 18.4:1).
- **Retrograde banner:** Banner text must be readable on amber/red backgrounds (use #0A0A0F text on amber, #F0F0F5 text on red).

## Interaction State Coverage (from design review)

| Screen | Loading | Empty | Error | Partial | First-Open |
|--------|---------|-------|-------|---------|------------|
| Today | Shimmer on hero, rail hidden | Generic cosmic snapshot (no profile) | "Could not load. Pull to retry." | Stale reading + fresh moon: render with "updated X ago" label | Onboarding CTA after hero |
| Sky | Shimmer on each section independently | N/A (all sections work without profile) | Per-section error inline | Personal Transits empty if profile has no computed transits | Same as empty |
| Journal | Shimmer on entry list | "Your astrology journal is empty" + "Write First Entry" CTA | "Could not load journal. Pull to retry." | Search with 0 results: "No entries match" | Same as empty |
| Journal Compose | N/A | N/A | Save failure: "Could not save. Try again." toast | N/A | Draft auto-restored from AsyncStorage |
| Compatibility | N/A | Single-profile: "+ Add another person" CTA in Person B picker | Score computation failure: "Could not compute. Try again." | N/A | RequiresProfileState if 0 profiles |
| Moon Calendar | Shimmer on grid | N/A (always has data) | "Could not compute. Pull to retry." | N/A | Same as success |
| Retrograde | Shimmer on status cards | "No Active Retrogrades" section with upcoming list | "Could not load. Pull to retry." | N/A | Same as success |
| Birth Chart | Shimmer on wheel + placements | N/A (requires profile to access) | "Could not load chart." | No rising sign: Sun/Moon only, dimmed Ascendant placeholder | N/A |
| Add Profile | N/A | N/A | Inline validation errors below fields | N/A | N/A |
| Settings | Shimmer on data counts | Profiles section: "No profiles yet" + add button | N/A | N/A | Same as empty |

## Design Specifications (from design review)

- **Progress bars (all screens):** 4px height, `lg` (12px) border radius, accent color (`#8B5CF6`) fill, `border` token track. Consistent across retrograde, transit, compatibility, journal patterns.
- **Segmented controls:** Native iOS `SegmentedControl` with accent color tint. Used on Transit Timeline (Active/Upcoming/Recent) and Journal (Entries/Patterns inline).
- **Retrograde banner:** Full-bleed (edge-to-edge), 44pt minimum height, `subheading` weight for planet name, `caption` for dates. Dismiss button 44x44pt touch target. Amber: `#FF9F0A` bg with `#0A0A0F` text. Red: `#FF453A` bg with `#F0F0F5` text.
- **Mood colors:** Local constants in compose screen (not in global token system): inspired=#FFD700, calm=#30D158, anxious=#FF9F0A, frustrated=#FF453A, joyful=#FF375F, contemplative=#8B5CF6, energized=#32D74B, drained=#98989D. Each pill shows color + text label.
- **Tarot card display:** Typography-only, no artwork. Card number as large decorative Roman numeral (`stat` variant, 36px). No card images in V1.
- **Journal compose drafts:** Auto-save to AsyncStorage every 30 seconds. Restore on mount. Clear on successful save. Success toast: `success` (#30D158) "Entry saved" for 2 seconds.
- **Journal Patterns:** Renders inline as a segment within `journal.tsx`, NOT a separate stack screen. Remove `journal-patterns.tsx` from new files list (patterns view is part of journal.tsx).
- **Generic vs personalized reading:** When profile exists, show "Personalized for [Name]" label (caption, textSecondary). When no profile, omit label entirely (do not show "Generic reading").
- **Profile Detail actions:** Vertical navigation list rows (not 2x3 action grid). Each row: icon + label + chevron. Same pattern as Settings sections.

## Known Limitations

- **Chart wheel is decorative:** The natal chart SVG wheel (Screen 6) is a simplified visualization showing Sun/Moon/Rising positions. Full 10-planet wheel with houses requires a complete ephemeris engine (Swiss Ephemeris integration, ST-004). V1 shows a static diagram.
- **Daily reading summary is template-based:** Without an LLM, daily readings combine pre-written phrases keyed by sun sign + moon phase + retrograde status. The quality is "fortune cookie" level. Future Claude API integration could generate genuinely personalized readings.
- **Transit detection accuracy:** Full transit detection requires precise planet longitude computation. V1 uses simplified positional data. Transits will be approximately correct but not ephemeris-precise.
- **Progressed chart simplification:** Full secondary progressions require ephemeris. V1 uses the "day for a year" method with simplified Moon tracking (~13 degrees/day = ~13 degrees/year progressed).

## Context for Next Agent

- The existing `_layout.tsx` uses a `Stack` navigator. This spec replaces it with a `Tabs` navigator containing 4 tabs plus hidden stack screens (same pattern as `(books)/_layout.tsx`).
- The existing `index.tsx` has moon phase display and stats counters. The new Today screen reuses the moon phase data but restructures the layout as a daily snapshot with reading, tarot, profile, and quick links.
- All 9 engines in `modules/stars/src/engine/` are already implemented and tested. The UI screens are consumers of these engines via the barrel exports in `index.ts`.
- The `definition.ts` already declares 5 tabs and 12 screens in its navigation config. These need to be updated to match the 4-tab layout defined in this spec (Today/Sky/Journal/More replaces Chart/Transits/Match/Journal/Settings).
- Today and Sky screens must use AppState listener for foreground refresh (recompute daily data on midnight rollover).
- Profile-gated screens (Birth Chart, Compatibility, Transit Timeline/Calendar, Solar Return, Progressions, Daily Reading) should use the shared `<RequiresProfileState />` component.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | -- | -- |
| Codex Review | `/codex review` | Independent 2nd opinion | 1 | ISSUES_FOUND | 10 findings (moon sign systemic, FTS5 fictional, cache invalidation, scope theater, premium timing) |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 6 issues, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR | score: 6/10 -> 8/10, 11 decisions |

- **CODEX:** 10 eng findings (2 adopted). 6 design findings + 2 hard rejections (card stack, no anchor). All resolved.
- **CROSS-MODEL:** Both design voices agreed on 6 of 7 litmus failures. Both flagged Today screen card stack and quick links grid as primary slop patterns.
- **UNRESOLVED:** 0
- **VERDICT:** ENG + DESIGN CLEARED -- ready to implement. Run `/ship` when screens are built.
