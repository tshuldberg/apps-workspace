# Feature Spec: Stars Full Web UI

## Metadata
- **Module:** stars
- **Task:** W14-7
- **Sprint:** W14
- **Estimated CC Time:** 5-7 hours
- **Depends On:** none (all 76+ module exports exist, schema V2 with 11 tables, mobile has 22 screens across 4 tabs)
- **Blocks:** Stars web QA pass, Stars web design review
- **Reference Implementation:** `apps/web/app/books/` (layout, page, actions, sub-routes, tests)

## Design Pipeline Signoff

### Phase 1: Office Hours (Builder Mode)

**Core insight:** An astrology app on desktop must exploit what mobile cannot: simultaneous multi-panel views of cosmic data, dense calendar grids, side-by-side chart comparison, and data tables for transit timelines. The narrowest wedge -- the single screen that makes users say "I need this on desktop" -- is the **Cosmic Command Center**. On mobile, you scroll vertically through today's sun sign, moon phase, retrograde banner, tarot card, and action pills. On desktop, you see everything at once: a left panel with your birth profile summary and chart placements, a center hero with today's cosmic snapshot (sun/moon/tarot/retrograde), and a right sidebar with upcoming transits and zodiac events. Plus, the moon calendar becomes a full desktop-width grid showing an entire month of lunar data with illumination percentages, sign transits, and key phases -- something that's cramped on a phone but gorgeous on a wide screen.

**What makes a Stars web app delightful vs mobile?**
1. **Information density:** Astrology is data-rich (12 signs, 10 planets, 12 houses, aspects, transits, retrogrades, moon phases, journals). Desktop can show 3-4 data panels simultaneously instead of one-at-a-time scrolling.
2. **Calendar affordances:** Moon calendar, transit calendar, and zodiac events calendar all benefit from wide grids with hover tooltips showing detail without navigation.
3. **Side-by-side comparison:** Compatibility view can show both profiles' placements side by side instead of switching between them.
4. **Rich text editing:** Journal compose benefits from a wider text area, keyboard shortcuts, and the ability to see astrological context alongside the editor.
5. **Reference browsing:** Users researching their chart want to open multiple interpretations simultaneously -- desktop allows split-panel reading.
6. **Deep linking:** Every profile, journal entry, and transit date is a unique URL. Users can bookmark their daily reading page.

**Web-specific affordances to leverage:**
1. **Multi-panel cosmic dashboard:** Three-column layout -- profile summary | cosmic snapshot | upcoming events. All on one screen.
2. **Full-width moon calendar:** 7-column grid spanning the full content width, with each cell showing phase icon, illumination %, and sign. Hover reveals interpretation. Click navigates to day detail.
3. **Data tables for transits and events:** Sortable/filterable tables for zodiac events (category, date, body, from/to sign) and transit events (significance, aspect, orb, exact date). Searchable.
4. **Keyboard shortcuts:** `D` goes to daily reading. `M` opens moon calendar. `J` opens journal. `C` opens compatibility. `N` creates new journal entry. `P` manages profiles. Arrow keys navigate calendar dates.
5. **Side-by-side compatibility:** Two birth profile cards flanking a central score breakdown with color-coded bars.
6. **Print-optimized birth chart:** Clean print stylesheet for profile placements + aspects (for sharing or physical reference).
7. **Wide journal entries:** Two-column journal compose: text editor on left, astrological context (moon phase, sun sign, retrogrades, tarot) auto-populated on right.
8. **Deep linking:** Every screen has a unique route. `/stars/profile/[id]` for chart detail, `/stars/journal/[id]` for entry detail, `/stars/moon-calendar?month=2026-03` for specific month.

**Brainstorm scoring:**
- Demand signal: Co-Star has a web app. Astro.com is desktop-first. The Pattern has web. Desktop astrology serves the "morning ritual at computer" and "deep chart research" use cases.
- Narrowest wedge: Cosmic dashboard + moon calendar. If these two screens are beautiful and dense, users adopt the web UI for their daily check-in.
- Expansion path: Dashboard -> Moon Calendar -> Journal -> Compatibility -> Transit Timeline (each adds a reason to stay on desktop).

### Phase 2: Engineering Review

**Module surface area (verified):**
- 76+ named exports from `@mylife/stars` (verified via `modules/stars/src/index.ts`)
- 8 engine files: astro (5 functions), lunar (3 functions + types), compatibility (2 functions + types), zodiac-events (3 functions + types), transits (3 functions + types), retrograde (5 functions + types), journal (4 functions + types), solar-return (2 functions + types), progressions (4 functions + types)
- 15 Zod schemas for type-safe validation
- 30+ CRUD operations across 11 tables
- 11 SQLite tables (st_ prefix) across 2 migration versions
- Schema version: 2

**Existing CRUD coverage by domain:**

| Domain | Functions | Tables |
|--------|-----------|--------|
| Birth Profiles | create, get, getAll, update, delete | st_birth_profiles |
| Transits | create, getByProfile, getByDate | st_transits |
| Daily Readings | create, get | st_daily_readings |
| Saved Charts | create, getByProfile | st_saved_charts |
| Stats | getStarsStats | (aggregate query) |
| Moon Calendar | cacheMoonCalendarDay, getMoonCalendarMonth | st_moon_calendar |
| Compatibility | save, get, getRecent | st_compatibility_results |
| Zodiac Events | cache, get (by date range) | st_zodiac_events |
| Transit Events | save, getByProfile (by date range) | st_transit_events |
| Journal | create, getAll, getById, search, delete, count | st_journal_entries |
| Solar Returns | save, get (by profile + year) | st_solar_returns |
| Progressed Charts | save, get (by profile) | st_progressed_charts |

**Engine functions available (all pure, no DB dependency):**

| Engine | Functions |
|--------|-----------|
| astro | `getMoonPhase`, `getMoonSign`, `getZodiacSign`, `getZodiacElement`, `calculateCompatibility`, `getTarotCardOfDay` |
| lunar | `computeMoonCalendarMonth`, `computeIllumination`, `getKeyPhasesForMonth` |
| compatibility | `computeQuickMatch`, `canonicalPair` |
| zodiac-events | `computeSunIngresses`, `computeZodiacEvents`, `filterEventsByCategory` |
| transits | `detectTransitsForDate`, `classifySignificance`, `filterBySignificance` |
| retrograde | `computeRetrogradeStatuses`, `computeRetrogradeBanner`, `getActiveRetrogrades`, `getUpcomingRetrogrades`, `getRetrogradeTips` |
| journal | `captureAstrologicalContext`, `isValidMood`, `validateJournalContent`, `detectPatterns` |
| solar-return | `computeSolarReturn`, `computeSolarReturnRange` |
| progressions | `computeProgressedChart`, `computeProgressedDate`, `computeAgeInYears`, `forecastMoonSignChange` |

**Interpretations (static data):**
- `MOON_PHASE_INTERPRETATIONS` -- 8 entries (one per phase)
- `MOON_SIGN_INTERPRETATIONS` -- 12 entries (one per sign)
- `RETROGRADE_TIPS` -- per-planet guidance
- `RETROGRADE_INTERPRETATIONS` -- per-planet meaning
- `JOURNAL_MOODS` -- valid mood options for journal entries

**New server actions needed (`apps/web/app/stars/actions.ts`):**

```typescript
// All new -- the current web stub has zero server actions

// DB helper
function db(): DatabaseAdapter  // getAdapter() + ensureModuleMigrations('stars')

// Birth Profiles
fetchProfiles(): BirthProfile[]
fetchProfile(id: string): BirthProfile | null
doCreateProfile(input: CreateBirthProfileInput): BirthProfile
doUpdateProfile(id: string, input: UpdateBirthProfileInput): BirthProfile | null
doDeleteProfile(id: string): boolean

// Daily Readings
fetchDailyReading(profileId: string, date: string): DailyReading | null
doCreateDailyReading(input: CreateDailyReadingInput): DailyReading

// Transits
fetchTransitsByProfile(profileId: string, limit?: number): Transit[]
fetchTransitsByDate(date: string): Transit[]
doCreateTransit(input: CreateTransitInput): Transit

// Saved Charts
fetchSavedCharts(profileId: string): SavedChart[]
doCreateSavedChart(profileId: string, chartType: string, title: string, data: string): SavedChart

// Stats
fetchStats(): StarsStats

// V2: Moon Calendar
doComputeAndCacheMoonMonth(year: number, month: number): MoonCalendarDay[]
fetchMoonCalendarMonth(year: number, month: number): MoonCalendarDay[]

// V2: Compatibility
doComputeCompatibility(profileAId: string, profileBId: string): CompatibilityAnalysis
fetchRecentCompatibility(limit?: number): Array<{...}>

// V2: Zodiac Events
doComputeAndCacheZodiacEvents(startDate: string, endDate: string): ZodiacEvent[]
fetchZodiacEvents(startDate: string, endDate: string): ZodiacEvent[]

// V2: Transit Events
doComputeAndCacheTransitEvents(profileId: string, startDate: string, endDate: string): TransitEvent[]
fetchTransitEvents(profileId: string, startDate: string, endDate: string): TransitEvent[]

// V2: Journal
fetchJournalEntries(limit?: number): JournalEntryRow[]
fetchJournalEntry(id: string): JournalEntryRow | null
doCreateJournalEntry(entry: {...}): JournalEntryRow
doDeleteJournalEntry(id: string): boolean
doSearchJournalEntries(query: string, limit?: number): JournalEntryRow[]
fetchJournalEntryCount(): number

// V2: Solar Returns
doComputeSolarReturn(profileId: string, year: number): SolarReturnResult
fetchSolarReturn(profileId: string, year: number): SolarReturnResult | null

// V2: Progressed Charts
doComputeProgressedChart(profileId: string): ProgressedChartResult
fetchProgressedChart(profileId: string): ProgressedChartResult | null
```

**Route structure (Next.js App Router):**

```
apps/web/app/stars/
  layout.tsx                    # Module layout with glass nav header + tab links
  page.tsx                      # Cosmic Dashboard (today's snapshot + profile summary + upcoming events)
  actions.ts                    # Server actions wrapping @mylife/stars CRUD + engines
  profile/page.tsx              # Profile management (list, add, edit birth profiles)
  profile/[id]/page.tsx         # Individual profile detail (placements, chart data, solar return, progressions)
  compatibility/page.tsx        # Side-by-side compatibility comparison + history
  moon-calendar/page.tsx        # Full-width lunar calendar with phase/sign detail
  zodiac-events/page.tsx        # Sortable event timeline with category filters
  transit-timeline/page.tsx     # Personal transit events with significance filtering
  retrograde/page.tsx           # Active retrogrades dashboard + tips + timeline
  journal/page.tsx              # Journal entries list with search + mood filter
  journal/compose/page.tsx      # New journal entry with astrological context sidebar
  journal/[id]/page.tsx         # Journal entry detail view
  readings/page.tsx             # Daily readings history + tarot card archive
  __tests__/
    stars-dashboard.test.tsx    # Dashboard rendering, stats display, cosmic snapshot
    profile-page.test.tsx       # Profile CRUD, form validation
    moon-calendar.test.tsx      # Calendar navigation, phase display
    compatibility-page.test.tsx # Profile selection, score display
    journal-page.test.tsx       # Entry list, compose flow, search
    zodiac-events.test.tsx      # Event table, category filtering
```

**Data flow (per books reference pattern):**
1. `layout.tsx` renders glass header with accent color `#8B5CF6`, nav links for primary sections, and `{children}` slot
2. Each page is `'use client'` with `useEffect` calling server actions on mount
3. Server actions call `db()` (which runs `getAdapter()` + `ensureModuleMigrations('stars')`)
4. Server actions call module CRUD/engine functions from `@mylife/stars`
5. Client state managed via local `useState` per page (no global state library)
6. All mutations go through server actions; client calls `refresh()` pattern to re-fetch
7. Engine functions (pure, no DB) called both client-side (for instant updates like moon phase) and server-side (for computed + cached data like zodiac events)
8. Error handling: all server action calls wrapped in try/catch/finally (per feedback_web_error_handling.md)

**Architecture decisions:**
- No charting library needed. Birth chart placements displayed as styled text cards (same approach as mobile's placement list). Moon phases use emoji icons with CSS for illumination bar. Compatibility scores use CSS width percentage bars.
- Moon calendar grid uses CSS Grid (7 columns, 5-6 rows). Each cell shows phase emoji + sign abbreviation. Hover tooltip shows full interpretation.
- Transit events table uses a simple HTML table with column sorting via client-side state.
- Journal compose uses a standard textarea with auto-expanding height. Astrological context computed client-side and displayed in a right-side panel.
- Zodiac events computed for a rolling 90-day window and cached in SQLite. The engine computes sun ingresses + zodiac events; CRUD caches them.

**Missing CRUD (none):** All CRUD operations needed for the web UI already exist in the module. No module-level code changes required.

### Phase 3: Design Review

**Rating per dimension:**

| Dimension | Score | Notes |
|-----------|-------|-------|
| Layout & Composition | 9/10 | Three-column dashboard, full-width calendar grids, side-by-side compatibility, two-column journal compose |
| Typography | 9/10 | Full Cool Obsidian type scale. heroTitle for dashboard greeting, stat for moon illumination %, subheading for card titles, body for interpretations, caption for timestamps/metadata |
| Color | 10/10 | Purple accent `#8B5CF6` throughout. Moon phase illumination uses white-to-purple gradient. Retrograde banner uses system colors (red/amber/green). Element colors (fire=red, earth=green, air=blue, water=teal) for zodiac categorization |
| Spacing & Rhythm | 9/10 | Token-based spacing. Cards use xl radius (16px). Sections separated by lg gap (24px). Calendar cells use md padding (16px) |
| States (5/5) | 9/10 | All 5 states designed per section below |
| Interaction | 9/10 | Keyboard shortcuts, hover tooltips on calendar cells, click-to-expand interpretations, date picker navigation |
| Accessibility | 8/10 | ARIA labels on all zodiac symbols and emoji. Screen reader announces "Moon in Scorpio, Waning Crescent, 62% illuminated". Focus management for calendar grid navigation |
| Information Density | 9/10 | Desktop-optimized: 3+ data panels visible simultaneously, no unnecessary whitespace, dense calendar grids |
| Cool Obsidian Compliance | 10/10 | Glass cards, dark background, purple accent, no light theme contamination, no spinner loading, no "Coming Soon" |

**5 States per section:**

**Dashboard (page.tsx):**
- **Loading:** Three skeleton cards (profile summary, cosmic snapshot, events sidebar) pulsing at 60% opacity, matching the three-column layout
- **Empty (no profiles):** Full-width glass card: "The stars are waiting" headline, "Add your birth details for personalized cosmic insights" body, purple CTA "Add Birth Profile"
- **Error:** Glass card with "Something went wrong" + Retry button. Never shows technical error text
- **Success:** Full three-column dashboard with live data
- **Partial (profiles exist but no readings yet):** Dashboard shows cosmic snapshot (sun sign, moon phase, tarot -- these don't need profiles) with a subtle prompt card: "Generate your first daily reading"

**Moon Calendar (moon-calendar/page.tsx):**
- **Loading:** 7x5 skeleton grid matching calendar layout
- **Empty:** "Navigate to a month to see lunar phases" with month picker focused
- **Error:** Inline error below calendar header with retry
- **Success:** Full calendar grid with phase icons, illumination, signs, and key phase highlights
- **Partial:** Calendar with computed phases but no cached interpretations yet -- shows phases without interpretation text

**Journal (journal/page.tsx):**
- **Loading:** 3 skeleton entry cards in a list
- **Empty:** "Your cosmic journal awaits" headline, "Record your thoughts alongside the day's astrological weather" body, purple CTA "Write First Entry"
- **Error:** Glass card error with retry
- **Success:** Entry list with mood badges, date, moon phase, content preview
- **Partial:** Some entries with astrological context, some without (older entries before V2)

**Compatibility (compatibility/page.tsx):**
- **Loading:** Two skeleton profile cards + center score skeleton
- **Empty (no profiles):** "Add at least two birth profiles to explore cosmic compatibility" with CTA to profile page
- **Empty (one profile):** "Add a second birth profile to compare" with CTA
- **Error:** Inline error below comparison area with retry
- **Success:** Side-by-side profiles with score breakdown

**Profile Detail (profile/[id]/page.tsx):**
- **Loading:** Profile header skeleton + placements list skeleton
- **Empty:** Should never happen (profile must exist to reach this route). 404-style: "Profile not found" with link back to profiles
- **Error:** Glass card error with retry
- **Success:** Full profile with sun/moon/rising display, birth details, placements, solar return, progressions
- **Partial:** Profile with basic info but solar return/progressions not yet computed -- shows "Compute" CTAs

**Design tokens applied:**

| Element | Token | Value |
|---------|-------|-------|
| Module accent | `colors.modules.stars` | `#8B5CF6` |
| Accent dim background | -- | `rgba(139,92,246,0.15)` |
| Accent border | -- | `rgba(139,92,246,0.25)` |
| Page background | `background` | `#0A0A0F` |
| Card fill | `surface` | `#12121A` |
| Glass card fill | `glass.card` | `rgba(255,255,255,0.04)` |
| Glass card border | -- | `rgba(255,255,255,0.06)` |
| Text primary | `text` | `#F0F0F5` |
| Text secondary | `textSecondary` | `rgba(240,240,245,0.65)` |
| Border | `border` | `rgba(255,255,255,0.06)` |
| Danger (delete actions) | `danger` | `#FF453A` |
| Success (green retro) | `success` | `#30D158` |
| Card border radius | `xl` | 16px |
| Pill border radius | `pill` | 999px |

**Retrograde banner colors (from mobile):**
- Red: `#FF453A` (multiple significant retrogrades)
- Amber: `#FF9F0A` (some retrogrades active)
- Yellow: `#FFD60A` (minor activity)
- Green: `#30D158` (all clear)

**Element accent colors (for zodiac categorization):**
- Fire signs (Aries, Leo, Sagittarius): `#EF4444`
- Earth signs (Taurus, Virgo, Capricorn): `#22C55E`
- Air signs (Gemini, Libra, Aquarius): `#3B82F6`
- Water signs (Cancer, Scorpio, Pisces): `#06B6D4`

### Phase 4: Design Consultation

**Module-specific design system decisions:**

**Accent color:** `#8B5CF6` (purple) -- same as the Habits module, which is intentional since Stars and Habits share a purple family. Stars distinguishes itself through celestial iconography and the use of element accent colors for categorization.

**Iconography:** Stars module uses a mix of Unicode emoji for moon phases and zodiac elements (consistent with mobile) and text labels for astrological placements. No custom SVG icons needed for V1.

Moon phase display map (from mobile, reused on web):
```
new_moon: 🌑    waxing_crescent: 🌒    first_quarter: 🌓    waxing_gibbous: 🌔
full_moon: 🌕    waning_gibbous: 🌖    last_quarter: 🌗    waning_crescent: 🌘
```

**Information density:** Desktop Stars is denser than most modules because astrology inherently involves cross-referencing multiple data dimensions (sign + house + aspect + transit + phase). The design leans into this by:
- Using compact card layouts (less padding than Books/Budget)
- Showing 3-column layouts on desktop (>1024px)
- Using inline metadata (sign + element badges next to names)
- Avoiding full-screen hero sections after the dashboard -- sub-pages are utility-focused

**Component reuse from `packages/ui/`:**
- `Text` component with variant props (heroTitle, heading, subheading, body, caption, label)
- `Card` component (glass card styling)
- `colors`, `spacing`, `glass` tokens

**Component reuse from existing web modules:**
- Glass header layout pattern from `books/layout.tsx` (accent color, nav links, title/tagline)
- Grid/list toggle pattern from `books/page.tsx`
- Server action `db()` helper pattern from `books/actions.ts`
- Error/loading/empty state patterns from other web modules

**New component patterns unique to Stars:**
- **Moon Phase Cell:** Compact cell showing emoji + illumination bar + sign abbreviation. Used in both calendar grid and dashboard.
- **Retrograde Banner:** Horizontal strip with dynamic color based on retrograde severity. Matches mobile's banner exactly.
- **Profile Placements Card:** Vertical list of Sun/Moon/Rising with sign name + element badge. Expandable for full placement list.
- **Compatibility Score Bars:** Horizontal bars showing element compatibility percentage with fill colors.
- **Astrological Context Panel:** Right-sidebar panel showing current moon phase, sun sign, retrogrades, and tarot card -- used in journal compose.

---

## Page-by-Page Wireframes

### 1. Layout (`layout.tsx`)

```
┌─────────────────────────────────────────────────────────────────┐
│  ✨ MyStars            Today  Profiles  Moon  Journal  More  ▼  │
│  Private astrology and birth charts                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                        {children}                               │
│                                                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

- Glass header: `rgba(18,18,26,0.78)` with `backdrop-filter: blur(14px)`
- Title "MyStars" in accent purple, weight 800, size 30px
- Tagline below in textSecondary
- Nav links: Today, Profiles, Moon, Journal, More (dropdown for: Compatibility, Transits, Events, Retrogrades, Readings)
- Max width: 1120px centered

### 2. Cosmic Dashboard (`page.tsx`)

```
┌─────────────────────────────────────────────────────────────────┐
│  [Retrograde Banner -- amber/red/green based on current status] │
├───────────────────┬─────────────────────┬───────────────────────┤
│  YOUR CHART       │  TODAY'S SKY        │  WHAT'S AHEAD         │
│                   │                     │                       │
│  Trey             │  ☀ Sun in Aries     │  Upcoming Events      │
│  ☀ Sun: Aries     │  🌒 Moon in Scorpio │  ├ Mar 25: Mercury ▸  │
│  🌙 Moon: Scorpio │  Waxing Crescent    │  │  enters Aries      │
│  ↑ Rising: --     │                     │  ├ Mar 28: Full Moon  │
│                   │  🃏 VII - Chariot   │  │  in Libra           │
│  [View Chart →]   │  Major Arcana       │  ├ Apr 1: Venus ▸     │
│                   │                     │  │  enters Taurus      │
│  ┌─────────────┐  │  [Read Full ▸]      │  └ Apr 5: New Moon    │
│  │ 0 Profiles  │  │  [Reflect ▸]        │      in Aries         │
│  │ 0 Readings  │  │                     │                       │
│  │ 0 Entries   │  │                     │  [View All Events →]  │
│  │ 0 Charts    │  │                     │                       │
│  └─────────────┘  │                     │                       │
├───────────────────┴─────────────────────┴───────────────────────┤
│  ⚡ Quick Actions                                               │
│  [🌙 Moon Cal] [🌟 Events] [❤️ Match] [🌌 Transits]            │
└─────────────────────────────────────────────────────────────────┘
```

- Three-column layout on desktop (>1024px), stacks vertically on tablet/mobile
- Left column: Profile summary card (name, sun/moon/rising, stats)
- Center column: Cosmic snapshot hero (sun sign, moon phase/sign, tarot card, CTAs)
- Right column: Upcoming events sidebar (next 5 zodiac events/transits)
- Bottom: Quick action pill row (same as mobile's action rail)
- Retrograde banner at top (dismissible, color-coded)

**First-visit variant (no profiles):**
- Center column shows cosmic data (sun sign, moon phase work without profile)
- Left column shows onboarding CTA: "Unlock personalized readings" with Add Profile button
- Stats card shows zeroes but with warm text

### 3. Profile Management (`profile/page.tsx`)

```
┌─────────────────────────────────────────────────────────────────┐
│  Birth Profiles                              [+ Add Profile]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────────────┐  ┌────────────────────┐                │
│  │ Trey               │  │ Alex               │                │
│  │ ☀ Aries  🌙 Scorpio│  │ ☀ Leo  🌙 Pisces   │                │
│  │ Born: Jun 15, 1997 │  │ Born: Aug 22, 1998 │                │
│  │ San Francisco, CA  │  │ New York, NY       │                │
│  │                    │  │                    │                │
│  │ [View] [Edit] [✕]  │  │ [View] [Edit] [✕]  │                │
│  └────────────────────┘  └────────────────────┘                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

- Grid of profile cards (auto-fit, min 280px)
- Each card: glass card with name, sun/moon/rising signs, birth date, birth place
- Actions: View (navigates to detail), Edit (inline form), Delete (with confirmation)
- Add Profile button opens inline form at top of page

**Add/Edit Profile form fields:**
- Name (text input, required)
- Birth Date (date input, required, validated: not future, not before 1900)
- Birth Time (time input, optional)
- Birth Place (text input, optional)
- Sun Sign (select, auto-computed from birth date, editable override)
- Moon Sign (select, optional manual entry)
- Rising Sign (select, optional manual entry)

### 4. Profile Detail (`profile/[id]/page.tsx`)

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back to Profiles              Trey                           │
├──────────────────────────────┬──────────────────────────────────┤
│  BIRTH DATA                  │  PLACEMENTS                     │
│                              │                                  │
│  Born: June 15, 1997         │  ☀ Sun in Gemini               │
│  Time: 2:30 PM               │  🌙 Moon in Scorpio            │
│  Place: San Francisco, CA    │  ↑ Rising: Virgo               │
│                              │                                  │
│  [Edit Profile]              │  Saved Charts: 3                │
│                              │  Daily Readings: 45              │
│                              │  Transits Logged: 127            │
├──────────────────────────────┼──────────────────────────────────┤
│  SOLAR RETURN (2026)         │  PROGRESSIONS                   │
│                              │                                  │
│  Return Date: Jun 15, 2026   │  Current Age: 28.8 years        │
│  Sun: Gemini                 │  Progressed Moon: Aquarius      │
│  Moon: Cancer                │  Moon Degree: ~15               │
│  Year Theme: "A year of      │  Next Sign Change: ~2.1 years   │
│  intellectual expansion..."  │  Next Sign: Pisces              │
│                              │  Progressed Sun: Cancer         │
│  [Recompute]                 │  [Recompute]                    │
└──────────────────────────────┴──────────────────────────────────┘
```

- Two-column layout: birth data + placements on top, solar return + progressions on bottom
- Solar return and progressed chart sections show computed data or "Compute" CTA if not yet cached
- Back navigation link to profile list

### 5. Compatibility (`compatibility/page.tsx`)

```
┌─────────────────────────────────────────────────────────────────┐
│  Compatibility                                                  │
├─────────────┬─────────────────────────────┬─────────────────────┤
│  Profile A  │                             │  Profile B          │
│  [Select ▾] │                             │  [Select ▾]         │
│             │       OVERALL: 78%          │                     │
│  Trey       │                             │  Alex               │
│  ☀ Gemini   │  Element: Harmonious        │  ☀ Leo              │
│  🌙 Scorpio  │  ████████████░░░░░░░░ 78%  │  🌙 Pisces          │
│             │                             │                     │
│             │       [Compare →]           │                     │
├─────────────┴─────────────────────────────┴─────────────────────┤
│  RECENT COMPARISONS                                             │
│                                                                 │
│  ┌──────────┬──────────┬──────────┬──────────┐                 │
│  │ Trey     │ Alex     │ 78%      │ Mar 22   │                 │
│  │ vs       │          │ Harmonic │          │                 │
│  └──────────┴──────────┴──────────┴──────────┘                 │
└─────────────────────────────────────────────────────────────────┘
```

- Top section: Two profile selectors (dropdown with profile list) flanking a central score display
- Compare button runs compatibility computation
- Score shown as percentage with element compatibility label
- Bottom section: Recent comparison history table

### 6. Moon Calendar (`moon-calendar/page.tsx`)

```
┌─────────────────────────────────────────────────────────────────┐
│  Moon Calendar           [◄ Prev]  March 2026  [Next ►]        │
├────────┬────────┬────────┬────────┬────────┬────────┬──────────┤
│  Su    │  Mo    │  Tu    │  We    │  Th    │  Fr    │  Sa      │
├────────┼────────┼────────┼────────┼────────┼────────┼──────────┤
│  1     │  2     │  3     │  4     │  5     │  6     │  7       │
│  🌒    │  🌓    │  🌓    │  🌔    │  🌔    │  🌕 ★  │  🌕      │
│  Gem   │  Can   │  Can   │  Leo   │  Leo   │  Vir   │  Vir     │
│  42%   │  50%   │  58%   │  67%   │  75%   │  100%  │  98%     │
├────────┼────────┼────────┼────────┼────────┼────────┼──────────┤
│  8     │  9     │  ...                                         │
│  🌖    │  🌖    │                                               │
│  Lib   │  Lib   │       (continues for full month)             │
│  92%   │  85%   │                                               │
├────────┼────────┼──────────────────────────────────────────────┤
│                                                                 │
│  KEY PHASES THIS MONTH                                          │
│  🌕 Full Moon: Mar 6 in Virgo -- "A time of harvest..."        │
│  🌑 New Moon: Mar 21 in Aries -- "A time of new beginnings..." │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

- Full 7-column CSS grid spanning content width
- Each cell: date, phase emoji, sign abbreviation (3 letters), illumination %
- Key phases marked with star (★)
- Month navigation with prev/next arrows
- Below calendar: Key phases section listing full/new moons with interpretations
- Hover tooltip on each cell: full phase name, full sign name, phase interpretation, sign interpretation
- Click on cell: highlights cell, shows detail below calendar
- Today's date has accent border highlight

### 7. Zodiac Events (`zodiac-events/page.tsx`)

```
┌─────────────────────────────────────────────────────────────────┐
│  Zodiac Events                    [All] [Ingress] [Lunar] [▾]  │
├──────────┬──────────────────┬───────┬──────────────────────────┤
│  Date    │  Event           │  Body │  Description             │
├──────────┼──────────────────┼───────┼──────────────────────────┤
│  Mar 20  │  Sun enters      │  ☀    │  Spring equinox marks    │
│          │  Aries            │       │  the start of the        │
│          │                  │       │  astrological new year    │
├──────────┼──────────────────┼───────┼──────────────────────────┤
│  Mar 25  │  Mercury enters  │  ☿    │  Communication shifts    │
│          │  Aries            │       │  to direct and assertive │
├──────────┼──────────────────┼───────┼──────────────────────────┤
│  Mar 28  │  Full Moon in    │  🌕   │  Illumination of         │
│          │  Libra            │       │  partnerships and        │
│          │                  │       │  relational balance      │
├──────────┼──────────────────┼───────┼──────────────────────────┤
│  ...     │  (more events)   │       │                          │
└──────────┴──────────────────┴───────┴──────────────────────────┘
```

- Data table with columns: Date, Event (title), Body, Description
- Category filter pills at top: All, Ingress, Lunar, Retrograde (from `filterEventsByCategory`)
- Sortable by date (default ascending)
- Click on event expands to show full description
- 90-day rolling window (computed and cached)

### 8. Transit Timeline (`transit-timeline/page.tsx`)

```
┌─────────────────────────────────────────────────────────────────┐
│  Transit Timeline                  Profile: [Trey ▾]           │
│                        [All] [Major] [Moderate] [Minor]         │
├──────────┬─────────────┬──────────┬──────────┬─────────────────┤
│  Date    │  Transit    │  Aspect  │  Signif. │  Interpretation │
├──────────┼─────────────┼──────────┼──────────┼─────────────────┤
│  Mar 22  │  Mars ▸     │  Conj    │  🔴 Major│  Mars activates │
│          │  natal Sun  │          │          │  your core self  │
├──────────┼─────────────┼──────────┼──────────┼─────────────────┤
│  Mar 25  │  Venus ▸    │  Trine   │  🟡 Mod  │  Harmonious     │
│          │  natal Moon │          │          │  emotional flow  │
├──────────┼─────────────┼──────────┼──────────┼─────────────────┤
│  ...     │  (more)     │          │          │                 │
└──────────┴─────────────┴──────────┴──────────┴─────────────────┘
```

- Profile selector dropdown (requires at least one profile)
- Significance filter pills: All, Major, Moderate, Minor (from `filterBySignificance`)
- Table columns: Exact Date, Transiting/Natal bodies, Aspect Type, Significance (color-coded dot), Interpretation
- Significance colors: Major = red, Moderate = amber, Minor = green
- Click on row expands full interpretation
- 30-day forward window

### 9. Retrograde Dashboard (`retrograde/page.tsx`)

```
┌─────────────────────────────────────────────────────────────────┐
│  Retrogrades                                                    │
├─────────────────────────────────────────────────────────────────┤
│  [BANNER: "Mercury Retrograde is active until Apr 12"]          │
├─────────────────┬───────────────────────────────────────────────┤
│  CURRENTLY      │  UPCOMING                                     │
│  RETROGRADE     │                                               │
│                 │  Saturn Rx: May 1 - Oct 15                    │
│  ☿ Mercury      │  Jupiter Rx: Jun 8 - Oct 4                   │
│  Mar 15 - Apr 12│  Venus Rx: Jul 23 - Sep 5                    │
│  In Pisces      │                                               │
│                 │                                               │
│  Tips:          │                                               │
│  - Review       │                                               │
│    contracts    │                                               │
│  - Back up data │                                               │
│  - Delay major  │                                               │
│    purchases    │                                               │
├─────────────────┴───────────────────────────────────────────────┤
│  RETROGRADE GUIDE                                               │
│                                                                 │
│  Mercury: Communication, travel, technology                     │
│  Venus: Love, beauty, values                                    │
│  Mars: Action, energy, conflict                                 │
│  Jupiter: Growth, luck, expansion                               │
│  Saturn: Structure, discipline, karma                           │
└─────────────────────────────────────────────────────────────────┘
```

- Top banner with dynamic color (from `computeRetrogradeBanner`)
- Two-column: Active retrogrades (left) with tips, Upcoming retrogrades (right) as timeline
- Bottom: Reference guide for each planet's retrograde meaning (from `RETROGRADE_INTERPRETATIONS`)

### 10. Journal List (`journal/page.tsx`)

```
┌─────────────────────────────────────────────────────────────────┐
│  Journal  (47 entries)       [Search...] [+ New Entry]          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Mar 22, 2026                    🌒 Waning Crescent      │  │
│  │  Mood: reflective                ☀ Aries  🌙 Scorpio      │  │
│  │                                                           │  │
│  │  Feeling a shift in energy today as Mars moves            │  │
│  │  through my natal sun. The cosmic weather...              │  │
│  │                                               [Read →]    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Mar 21, 2026                    🌑 New Moon              │  │
│  │  Mood: hopeful                   ☀ Pisces  🌙 Libra       │  │
│  │                                                           │  │
│  │  New moon in Aries feels like a fresh start...            │  │
│  │                                               [Read →]    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

- Entry count in header
- Search input (triggers `searchJournalEntries`)
- Each entry card: date, mood badge, moon phase emoji + label, sun/moon signs, content preview (truncated to 2 lines)
- Click entry navigates to detail page
- New Entry button navigates to compose page

### 11. Journal Compose (`journal/compose/page.tsx`)

```
┌─────────────────────────────────────────────────────────────────┐
│  New Journal Entry                              [Save] [Cancel] │
├───────────────────────────────────┬─────────────────────────────┤
│                                   │  TODAY'S SKY               │
│  Date: [Mar 23, 2026]            │                             │
│                                   │  🌒 Waxing Crescent        │
│  Mood: [Select ▾]                │  Moon in Scorpio            │
│                                   │                             │
│  ┌───────────────────────────┐   │  ☀ Sun in Aries            │
│  │                           │   │                             │
│  │  Write your thoughts...   │   │  Retrogrades:              │
│  │                           │   │  ☿ Mercury (Pisces)        │
│  │                           │   │                             │
│  │                           │   │  🃏 Card: VII - Chariot    │
│  │                           │   │                             │
│  │                           │   │  Profile: Trey             │
│  │                           │   │  (linked via profile_id)   │
│  │                           │   │                             │
│  └───────────────────────────┘   │                             │
│                                   │                             │
└───────────────────────────────────┴─────────────────────────────┘
```

- Two-column layout: editor (left ~65%), astrological context (right ~35%)
- Left: Date picker, mood dropdown (from `JOURNAL_MOODS`), expanding textarea
- Right: Auto-computed context (moon phase, moon sign, sun sign, retrogrades, tarot card) from `captureAstrologicalContext`
- Save button calls `doCreateJournalEntry` with astrological context fields auto-populated
- Cancel returns to journal list

### 12. Journal Entry Detail (`journal/[id]/page.tsx`)

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back to Journal                           [Delete]           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  March 22, 2026                                                 │
│  Mood: reflective                                               │
│                                                                 │
│  🌒 Waning Crescent  ☀ Aries  🌙 Scorpio                       │
│  ☿ Mercury Rx (Pisces)  🃏 VII - Chariot                       │
│                                                                 │
│  ─────────────────────────────────────────────                  │
│                                                                 │
│  Feeling a shift in energy today as Mars moves through my       │
│  natal sun. The cosmic weather feels electric, like something   │
│  is about to break through. I've been thinking about the       │
│  transit timeline and how these moments of tension often        │
│  precede growth...                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

- Full entry display with all astrological metadata
- Delete button with confirmation dialog
- Back link to journal list
- Clean reading layout, body text at 16px/26px line height

### 13. Readings History (`readings/page.tsx`)

```
┌─────────────────────────────────────────────────────────────────┐
│  Daily Readings                    Profile: [Trey ▾]           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  March 22, 2026                                           │  │
│  │  🌒 Waning Crescent  Moon in Scorpio                     │  │
│  │  🃏 VII - The Chariot (Major Arcana)                     │  │
│  │                                                           │  │
│  │  A day of determination and forward momentum. The         │  │
│  │  Chariot suggests willpower is your ally. Moon in         │  │
│  │  Scorpio deepens emotional intensity...                   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  March 21, 2026                                           │  │
│  │  🌑 New Moon  Moon in Libra                              │  │
│  │  🃏 XVIII - The Moon (Major Arcana)                      │  │
│  │  ...                                                      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

- Profile selector (readings are per-profile)
- Chronological list of daily readings (most recent first)
- Each card: date, moon phase, moon sign, tarot card, summary text
- "Generate Today's Reading" CTA if no reading exists for today

---

## Component Inventory

### Layout Components
| Component | File | Description |
|-----------|------|-------------|
| StarsLayout | `layout.tsx` | Glass header with accent purple, nav links, maxWidth 1120 |
| StarsNav | inline in layout | Nav link list with "More" dropdown |

### Dashboard Components
| Component | File | Description |
|-----------|------|-------------|
| RetrogradeBanner | `page.tsx` | Dismissible color-coded banner (red/amber/yellow/green) |
| CosmicSnapshot | `page.tsx` | Center column: sun sign, moon phase/sign, tarot card, CTAs |
| ProfileSummary | `page.tsx` | Left column: name, placements, stats |
| UpcomingEvents | `page.tsx` | Right column: next 5 zodiac/transit events |
| QuickActions | `page.tsx` | Pill row: Moon Cal, Events, Match, Transits |
| OnboardCard | `page.tsx` | CTA card shown when no profiles exist |
| StatsCard | `page.tsx` | 4-metric card (profiles, transits, readings, charts) |

### Profile Components
| Component | File | Description |
|-----------|------|-------------|
| ProfileCard | `profile/page.tsx` | Glass card with name, signs, birth info, actions |
| ProfileForm | `profile/page.tsx` | Inline form for add/edit profile |
| PlacementsList | `profile/[id]/page.tsx` | Sun/Moon/Rising display with sign + element |
| SolarReturnCard | `profile/[id]/page.tsx` | Computed solar return data display |
| ProgressionsCard | `profile/[id]/page.tsx` | Progressed chart data display |

### Calendar Components
| Component | File | Description |
|-----------|------|-------------|
| MoonCalendarGrid | `moon-calendar/page.tsx` | 7-column CSS grid, one cell per day |
| MoonCalendarCell | `moon-calendar/page.tsx` | Phase emoji + sign + illumination % |
| KeyPhasesSection | `moon-calendar/page.tsx` | Full/new moon dates with interpretations |
| MonthNavigator | `moon-calendar/page.tsx` | Prev/next month arrows with month/year display |

### Table Components
| Component | File | Description |
|-----------|------|-------------|
| EventsTable | `zodiac-events/page.tsx` | Sortable table with category filters |
| TransitTable | `transit-timeline/page.tsx` | Filterable by significance, profile selector |
| CompatibilityHistory | `compatibility/page.tsx` | Recent comparisons table |

### Journal Components
| Component | File | Description |
|-----------|------|-------------|
| JournalEntryCard | `journal/page.tsx` | Entry preview: date, mood, context, content truncated |
| JournalComposeForm | `journal/compose/page.tsx` | Textarea + mood selector + date picker |
| AstroContextPanel | `journal/compose/page.tsx` | Right sidebar: auto-computed cosmic context |
| JournalEntryFull | `journal/[id]/page.tsx` | Full entry with metadata header |

### Shared Components
| Component | Usage | Description |
|-----------|-------|-------------|
| MoonPhaseEmoji | Multiple pages | Maps phase key to emoji character |
| SignBadge | Multiple pages | Inline badge with sign name + element color |
| AccentButton | Multiple pages | Purple pill CTA button |
| GlassCard | Multiple pages | Standard glass card wrapper |
| SkeletonCard | Multiple pages | Loading skeleton matching card layout |
| ErrorCard | Multiple pages | "Something went wrong" + retry button |
| EmptyState | Multiple pages | Module-specific icon + warm headline + CTA |
| ProfileSelector | Transit timeline, Readings | Dropdown to switch between profiles |
| SignificanceDot | Transit timeline | Color-coded dot (red/amber/green) |

---

## Data Flow Diagrams

### Dashboard Load Sequence
```
page.tsx (client)
  ├─ useEffect mount
  │   ├─ fetchProfiles() → getBirthProfiles(db)
  │   ├─ fetchStats() → getStarsStats(db)
  │   └─ fetchZodiacEvents(start, end) → getZodiacEvents(db, start, end)
  ├─ Client-side computation (no server action needed)
  │   ├─ getMoonPhase(today)
  │   ├─ getMoonSign(today)
  │   ├─ getZodiacSign(today)
  │   ├─ computeRetrogradeStatuses(today)
  │   ├─ computeRetrogradeBanner(statuses)
  │   └─ getTarotCardOfDay(today)
  └─ Render three columns + banner
```

### Moon Calendar Load Sequence
```
moon-calendar/page.tsx (client)
  ├─ useEffect(year, month)
  │   ├─ doComputeAndCacheMoonMonth(year, month)
  │   │   ├─ computeMoonCalendarMonth(year, month)  // engine, pure
  │   │   ├─ cacheMoonCalendarDay(db, id, day)       // persist each day
  │   │   └─ return MoonCalendarDay[]
  │   └─ Client-side: getKeyPhasesForMonth(year, month)
  └─ Render CSS grid + key phases
```

### Journal Compose Save Flow
```
journal/compose/page.tsx (client)
  ├─ On mount: captureAstrologicalContext(today)  // client-side engine
  ├─ User writes content, selects mood
  ├─ On save:
  │   └─ doCreateJournalEntry({
  │        date, content, mood,
  │        moonPhase, moonSign, sunSign,
  │        retrogradePlanets, tarotCardName,
  │        profileId (optional)
  │      })
  │      └─ createJournalEntry(db, id, entry)
  └─ Navigate to journal list (refresh)
```

### Compatibility Compute Flow
```
compatibility/page.tsx (client)
  ├─ User selects Profile A + Profile B
  ├─ On "Compare":
  │   └─ doComputeCompatibility(profileAId, profileBId)
  │       ├─ getBirthProfile(db, profileAId)
  │       ├─ getBirthProfile(db, profileBId)
  │       ├─ computeQuickMatch(signA, signB)  // engine
  │       ├─ saveCompatibilityResult(db, ...)  // persist
  │       └─ return { overallScore, elementCompatibility }
  └─ Display score + bars
```

---

## Keyboard Shortcuts

| Key | Action | Context |
|-----|--------|---------|
| `D` | Navigate to dashboard | Global |
| `P` | Navigate to profiles | Global |
| `M` | Navigate to moon calendar | Global |
| `J` | Navigate to journal | Global |
| `C` | Navigate to compatibility | Global |
| `T` | Navigate to transit timeline | Global |
| `R` | Navigate to retrogrades | Global |
| `N` | New journal entry | Journal page |
| `←` / `→` | Previous / next month | Moon calendar |
| `Escape` | Close expanded detail | Event/transit tables |

---

## Test Plan

### Unit Tests (in `__tests__/`)

**stars-dashboard.test.tsx:**
- Renders cosmic snapshot with current sun sign, moon phase, moon sign
- Renders tarot card of the day
- Renders retrograde banner when retrogrades active
- Does not render banner when all clear (green)
- Renders profile summary when profiles exist
- Renders onboarding CTA when no profiles
- Renders stats card with correct counts
- Renders quick action pills
- Error state: shows retry when fetchProfiles fails
- Loading state: shows skeleton cards initially

**profile-page.test.tsx:**
- Lists all profiles as cards
- Creates new profile via form submission
- Validates birth date (not future, not before 1900)
- Updates profile via edit form
- Deletes profile with confirmation
- Shows empty state when no profiles
- Error handling: shows error on CRUD failure

**moon-calendar.test.tsx:**
- Renders 7-column grid for current month
- Navigates to next/previous month
- Shows correct moon phase emoji per cell
- Shows sign abbreviation per cell
- Highlights today's date
- Shows key phases section
- Handles month boundary (Dec -> Jan, Jan -> Dec)

**compatibility-page.test.tsx:**
- Shows profile selectors
- Requires two different profiles to compare
- Displays score after computation
- Shows element compatibility label
- Shows recent comparisons history
- Empty state: no profiles message
- Error handling on compute failure

**journal-page.test.tsx:**
- Lists entries with date, mood, moon phase, content preview
- Creates new entry via compose form
- Searches entries by content
- Deletes entry with confirmation
- Shows empty state when no entries
- Journal compose: auto-populates astrological context

**zodiac-events.test.tsx:**
- Renders events table with date, title, body, description
- Filters by category (all, ingress, lunar, retrograde)
- Sorts by date
- Expands event detail on click
- Handles empty event list

### Integration Tests

- Server actions correctly call module CRUD with proper DB initialization
- `ensureModuleMigrations('stars')` called before every query
- Error handling: try/catch/finally in all server action calls
- Profile deletion cascades correctly (transits, readings, charts cleaned up)

---

## QA Checklist

### Dashboard
- [ ] Three-column layout renders on desktop (>1024px)
- [ ] Layout stacks to single column on mobile (<768px)
- [ ] Retrograde banner shows correct color (check engine output)
- [ ] Banner dismisses on click, stays dismissed for the day
- [ ] Cosmic snapshot shows current sun sign, moon phase, moon sign
- [ ] Tarot card displays correctly (Major Arcana with Roman numeral, Minor with number)
- [ ] "Read Full Reading" navigates to readings page
- [ ] "Reflect on Today" navigates to journal compose
- [ ] Quick action pills navigate to correct pages
- [ ] Stats card shows correct counts from DB
- [ ] Profile summary card shows primary profile data
- [ ] Onboarding CTA shows when no profiles exist
- [ ] No "Coming Soon" text anywhere
- [ ] No spinner-only loading (skeletons only)

### Profiles
- [ ] All profiles listed as cards in grid
- [ ] Add Profile form validates all fields
- [ ] Birth date validation: not future, not before 1900
- [ ] Sun sign auto-computes from birth date
- [ ] Edit form pre-fills existing data
- [ ] Delete has confirmation dialog
- [ ] Profile detail shows placements, solar return, progressions
- [ ] Solar return and progressions compute on demand
- [ ] Back navigation works

### Moon Calendar
- [ ] Full 7-column grid renders
- [ ] Correct number of days per month
- [ ] First day of month aligns to correct weekday column
- [ ] Moon phase emojis match engine output
- [ ] Sign abbreviations show correctly
- [ ] Illumination percentages display
- [ ] Key phases highlighted with star
- [ ] Today's date has accent border
- [ ] Month navigation works (prev/next)
- [ ] December -> January and January -> December transitions correctly
- [ ] Key phases section shows full/new moon dates with interpretations
- [ ] Hover tooltip shows full interpretation (desktop)

### Journal
- [ ] Entry list shows all entries in reverse chronological order
- [ ] Entry cards show date, mood, moon phase, sun/moon signs, content preview
- [ ] New Entry navigates to compose
- [ ] Compose shows two-column layout (editor + context)
- [ ] Astrological context auto-populates (moon phase, sun sign, retrogrades)
- [ ] Mood selector has all valid options from JOURNAL_MOODS
- [ ] Save creates entry and returns to list
- [ ] Search filters entries by content
- [ ] Delete has confirmation dialog
- [ ] Entry detail shows full content with all metadata

### Compatibility
- [ ] Profile selectors list all profiles
- [ ] Cannot compare profile to itself
- [ ] Compare button computes and displays score
- [ ] Score bar shows percentage with fill
- [ ] Element compatibility label displays
- [ ] Recent comparisons table shows history
- [ ] Empty state when <2 profiles

### Transit Timeline
- [ ] Profile selector works
- [ ] Significance filters (All/Major/Moderate/Minor) work
- [ ] Table shows correct columns
- [ ] Significance dot colors match (red/amber/green)
- [ ] Row expansion shows interpretation
- [ ] Empty state when no profile selected or no transits

### Zodiac Events
- [ ] Table renders with correct columns
- [ ] Category filters work (All/Ingress/Lunar/Retrograde)
- [ ] Events sorted by date ascending
- [ ] Row expansion shows full description
- [ ] 90-day window loads correctly

### Retrogrades
- [ ] Banner shows with correct color and text
- [ ] Active retrogrades listed with dates and signs
- [ ] Upcoming retrogrades listed
- [ ] Tips display for active retrogrades
- [ ] Reference guide shows all planets

### Cross-Cutting
- [ ] All pages use Cool Obsidian tokens (no hardcoded light colors)
- [ ] All server actions have try/catch/finally error handling
- [ ] All pages have loading skeletons (not spinners)
- [ ] All empty states have warm headlines + CTAs (not "No items found")
- [ ] All error states have "Something went wrong" + retry (not technical messages)
- [ ] Glass cards use correct background + border + border radius
- [ ] Purple accent `#8B5CF6` consistent throughout
- [ ] Navigation links all work
- [ ] Deep links work (direct URL access to each page)
- [ ] Keyboard shortcuts work (D, P, M, J, C, T, R, N)
- [ ] Responsive: 3-col desktop, 2-col tablet, 1-col mobile

---

## Implementation Priority

Build order optimized for incremental value delivery:

| Priority | Route | Rationale |
|----------|-------|-----------|
| P0 | `layout.tsx` | Shared shell for all pages |
| P0 | `actions.ts` | Server actions needed by all pages |
| P1 | `page.tsx` (dashboard) | Narrowest wedge -- the daily check-in screen |
| P1 | `profile/page.tsx` | Profiles are a prerequisite for personalized features |
| P1 | `profile/[id]/page.tsx` | Detail view for profile management |
| P2 | `moon-calendar/page.tsx` | Second highest-value web screen (full-width calendar) |
| P2 | `journal/page.tsx` | Core feature -- daily reflection |
| P2 | `journal/compose/page.tsx` | Two-column compose is a web-specific delight |
| P2 | `journal/[id]/page.tsx` | Entry detail view |
| P3 | `compatibility/page.tsx` | Side-by-side comparison is web-native |
| P3 | `zodiac-events/page.tsx` | Data table is web-native |
| P3 | `transit-timeline/page.tsx` | Data table with significance filtering |
| P3 | `retrograde/page.tsx` | Reference dashboard |
| P3 | `readings/page.tsx` | History view |
| P4 | `__tests__/` | Tests for all pages |

---

## File Summary

| File | Purpose | New/Modify |
|------|---------|------------|
| `apps/web/app/stars/layout.tsx` | Module layout with glass header + nav | Modify (replace stub) |
| `apps/web/app/stars/page.tsx` | Cosmic Dashboard | Modify (replace stub) |
| `apps/web/app/stars/actions.ts` | Server actions for all CRUD + engines | New |
| `apps/web/app/stars/profile/page.tsx` | Profile management page | New |
| `apps/web/app/stars/profile/[id]/page.tsx` | Profile detail page | New |
| `apps/web/app/stars/compatibility/page.tsx` | Compatibility comparison | New |
| `apps/web/app/stars/moon-calendar/page.tsx` | Full-width lunar calendar | New |
| `apps/web/app/stars/zodiac-events/page.tsx` | Zodiac events data table | New |
| `apps/web/app/stars/transit-timeline/page.tsx` | Personal transit timeline | New |
| `apps/web/app/stars/retrograde/page.tsx` | Retrogrades dashboard | New |
| `apps/web/app/stars/journal/page.tsx` | Journal entries list | New |
| `apps/web/app/stars/journal/compose/page.tsx` | Journal compose with context | New |
| `apps/web/app/stars/journal/[id]/page.tsx` | Journal entry detail | New |
| `apps/web/app/stars/readings/page.tsx` | Daily readings history | New |
| `apps/web/app/stars/__tests__/stars-dashboard.test.tsx` | Dashboard tests | New |
| `apps/web/app/stars/__tests__/profile-page.test.tsx` | Profile tests | New |
| `apps/web/app/stars/__tests__/moon-calendar.test.tsx` | Calendar tests | New |
| `apps/web/app/stars/__tests__/compatibility-page.test.tsx` | Compatibility tests | New |
| `apps/web/app/stars/__tests__/journal-page.test.tsx` | Journal tests | New |
| `apps/web/app/stars/__tests__/zodiac-events.test.tsx` | Events tests | New |
