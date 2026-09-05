# MyStars -- UI/UX Design Prompts

**Tagline:** The cosmos in your pocket
**Icon:** ⭐ | **Accent:** #A78BFA | **Tier:** Premium
**Bottom Tabs:** Home | Chart | Moon | Tarot | Settings
**Total Screens:** 23 mobile + 13 web = 36

---

## Prompt 1 of 2 -- Screens 1-12 (Mobile)

```
Design system: Cool Obsidian (dark theme -- #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

App: MyStars
Tagline: The cosmos in your pocket
Icon: ⭐
Accent color: #A78BFA
Platform: iOS (mobile)
Bottom tabs: Home | Chart | Moon | Tarot | Settings

Design 12 mobile screens:

1. HOME (index.tsx)
- Bottom tab bar with Home (active, #A78BFA accent), Chart, Moon, Tarot, Settings
- Daily horoscope card (glass card, prominent):
  - Sun sign icon and name at top
  - Horoscope text body (#F0F0F5, 16pt)
  - Date label (#F0F0F5 at 65% opacity)
- Current moon phase card (glass card):
  - Moon phase illustration (crescent/quarter/full/new)
  - Phase name (e.g., "Waxing Gibbous")
  - Illumination percentage (#A78BFA accent)
  - Zodiac position text
- Retrograde status banner:
  - Full width, color-coded: Green (#30D158) = "All Clear", Yellow (#EAB308) = "Mercury Retrograde", Red (#FF453A) = "Multiple Retrogrades"
  - Planet names in retrograde listed
- Planetary positions summary: compact row of planet glyphs with sign abbreviations

2. BIRTH CHART (birth-chart.tsx)
- Bottom tab: Chart (active, #A78BFA)
- Natal chart wheel visualization (center of screen, circular):
  - Outer ring: 12 zodiac signs with glyphs and degree markers
  - Inner sections: 12 houses numbered
  - Planet glyphs positioned at their zodiac degrees
  - Aspect lines connecting planets:
    - Conjunction (0 degrees): #A78BFA solid
    - Trine (120 degrees): #30D158 dashed
    - Square (90 degrees): #FF453A dashed
    - Opposition (180 degrees): #EAB308 solid
    - Sextile (60 degrees): #3B82F6 dotted
- Planet legend below chart: scrollable horizontal list of planets with sign and house
- Tap any planet to highlight its aspects

3. MOON PHASE (moon.tsx)
- Bottom tab: Moon (active, #A78BFA)
- Large moon phase illustration (center, 200pt diameter):
  - Realistic moon rendering showing current illumination
  - Subtle glow effect around illuminated portion (#A78BFA at low opacity)
- Phase name below illustration (large, bold, #F0F0F5)
- Illumination percentage (#A78BFA large text)
- Zodiac position: "Moon in [Sign]" with glyph
- Next phase dates (glass card):
  - Next New Moon: date
  - Next First Quarter: date
  - Next Full Moon: date
  - Next Last Quarter: date
  - Each with moon phase icon

4. MOON CALENDAR (moon-calendar.tsx)
- Header: month/year with left/right arrows to navigate
- Monthly calendar grid (7 columns for days):
  - Each day cell shows: day number + small moon phase icon
  - Full moon days: highlighted with #A78BFA circle background
  - New moon days: highlighted with rgba(255,255,255,0.08) circle
  - Today: #A78BFA border ring
- Tap any day to show detail popover:
  - Phase name, illumination %, zodiac position, rise/set times
- Legend at bottom: Full Moon, New Moon, Quarter icons explained

5. COMPATIBILITY (compatibility.tsx)
- Header: "Compatibility"
- Two input sections (glass cards side by side or stacked):
  - Person 1: name, birth date, birth time, birth location
  - Person 2: name, birth date, birth time, birth location
- "Calculate" button (#A78BFA, full width)
- Results section (after calculation):
  - Compatibility score: large circular gauge (0-100), filled arc in #A78BFA
  - Element analysis: Fire/Earth/Air/Water balance comparison bars
  - Modality analysis: Cardinal/Fixed/Mutable comparison
  - Synastry aspects list: each aspect as a row (Planet1 [aspect glyph] Planet2, description)
  - Overall summary text

6. TAROT (tarot.tsx)
- Bottom tab: Tarot (active, #A78BFA)
- "Card of the Day" header
- Card display area (center):
  - Tarot card image (decorative back if not yet drawn)
  - Draw animation: card flips from back to front
  - Card name below image (bold, #F0F0F5)
  - Upright/Reversed badge (#30D158 for upright, #EAB308 for reversed)
- Meaning section (glass card):
  - Meaning text (#F0F0F5)
  - Keywords row (pill badges)
- Reflection prompt (glass card):
  - Prompt question in italic (#F0F0F5 at 65% opacity)
- "Draw Card" button (#A78BFA) if not yet drawn today
- "View Full Reading" link to tarot-reading screen

7. TAROT READING (tarot-reading.tsx)
- Header: "Tarot Reading" with back arrow
- Spread layout picker (horizontal scroll):
  - 3-Card Spread (Past/Present/Future)
  - Celtic Cross (10 cards)
  - Horseshoe (7 cards)
  - Single Card
  - Each as a selectable glass pill
- Card positions layout:
  - Cards arranged according to chosen spread geometry
  - Empty positions shown as dashed outline rectangles
  - Filled positions show card face with position label below
  - Tap empty position to draw, tap filled position to read meaning
- Card detail overlay (on tap):
  - Card image, name, position meaning, upright/reversed, interpretation
- Reading narrative section at bottom: synthesized interpretation text
- "Save Reading" button (#A78BFA)

8. READINGS HISTORY (readings-history.tsx)
- Header: "Reading History"
- Readings list, each as a glass card:
  - Date (#F0F0F5 at 65% opacity)
  - Spread type badge (3-Card, Celtic Cross, etc.)
  - Cards drawn: horizontal row of mini card thumbnails
  - Saved interpretation preview (truncated, 2 lines)
- Tap to expand full reading
- Search bar at top
- Empty state: crystal ball illustration with "No readings yet"

9. TRANSIT TIMELINE (transit-timeline.tsx)
- Header: "Transits"
- Timeline view (vertical):
  - Date range at top
  - Each transit as a horizontal bar on the timeline:
    - Planet glyph + sign
    - Aspect to natal planet: "Mars square natal Venus"
    - Date range bar (colored by aspect type)
    - Influence description text (#F0F0F5 at 65% opacity)
- Active transits highlighted with #A78BFA left border
- Filter: planet picker (show transits for specific planets)
- Glass card summary at top: "3 Active Transits"

10. DAILY READING (daily-reading.tsx)
- Header: today's date
- Sun influence card (glass card):
  - Sun glyph + "Sun in [Sign]"
  - Theme text for the day
- Moon influence card (glass card):
  - Moon glyph + "Moon in [Sign]"
  - Emotional tone text
- Rising influence card (glass card):
  - Rising sign glyph + "Rising in [Sign]"
  - Outward energy text
- Transits affecting today section:
  - List of active transit aspects with brief descriptions
- Advice card (glass card, #A78BFA border):
  - "Today's Guidance" header
  - Advisory text

11. ZODIAC EVENTS (zodiac-events.tsx)
- Header: "Zodiac Events"
- Event list (chronological), each as a glass card:
  - Event type icon (eclipse = circle, equinox = sun, meteor = star burst, ingress = arrow)
  - Event name (#F0F0F5 bold): "Spring Equinox", "Lunar Eclipse in Scorpio", "Perseid Meteor Shower"
  - Date (#A78BFA)
  - Description text (#F0F0F5 at 65% opacity)
- Section grouping by month
- "Add to Calendar" button on each event
- Countdown to next event at top: "Next: Lunar Eclipse in 12 days"

12. RETROGRADE TRACKER (retrograde.tsx)
- Header: "Retrogrades"
- Current retrogrades section (glass cards, #FF453A left border if active):
  - Planet name and glyph (large)
  - Sign the planet is retrograde in
  - Start date -- End date
  - Severity banner: color-coded bar
  - "What to Expect" expandable text section
- Upcoming retrogrades section (glass cards, muted):
  - Same layout but with countdown "Starts in X days"
- Summary banner at top:
  - "X Planets Currently Retrograde" or "All Clear" (#30D158)
- Timeline visualization: horizontal bar chart showing retrograde periods across the year
```

---

## Prompt 2 of 2 -- Screens 13-23 (Mobile) + Web Screens

```
Design system: Cool Obsidian (dark theme -- #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

App: MyStars
Tagline: The cosmos in your pocket
Icon: ⭐
Accent color: #A78BFA
Platform: iOS (mobile) for screens 13-18, Web (desktop) for screens 19-23
Bottom tabs (mobile): Home | Chart | Moon | Tarot | Settings

Design 11 screens:

13. JOURNAL (journal.tsx) -- Mobile
- Header: "Astro Journal"
- Journal entry list, each as a glass card:
  - Entry date (#A78BFA)
  - Moon phase icon at time of entry (auto-captured)
  - Entry text preview (2 lines, #F0F0F5)
  - Tags as pill badges below text
  - Linked chart reference indicator (chart icon if linked)
- Floating action button: "+" to add new entry
- Search bar at top
- Empty state: journal illustration with "Start your cosmic journal"

14. ADD JOURNAL (journal/add.tsx) -- Mobile
- Header: "New Entry" with Cancel (left) and Save (right, #A78BFA)
- Auto-captured info banner (glass card, non-editable):
  - Current moon phase icon + phase name
  - Current date and time
- Text editor: large multi-line input area
- Chart link picker: dropdown to select a saved chart (birth chart, solar return, etc.)
- Tag selector: horizontal scrolling chips (Insight, Dream, Transit, Ritual, Gratitude, Custom)
- Add custom tag: "+" chip that opens text input

15. SOLAR RETURN (solar-return.tsx) -- Mobile
- Header: "Solar Return [Year]"
- Chart wheel (same style as birth chart but for solar return):
  - Zodiac ring, house divisions, planet positions for the return moment
- Year selector: left/right arrows to view different years
- Yearly theme card (glass card, #A78BFA border):
  - Theme title (bold)
  - Theme description text
- Planet positions table: scrollable list showing each planet's sign and house for the solar return
- Comparison toggle: overlay natal chart positions for comparison

16. PROGRESSIONS (progressions.tsx) -- Mobile
- Header: "Progressions"
- Progressed chart wheel visualization:
  - Same circular chart style with zodiac ring
  - Progressed planet positions shown
  - Natal positions shown as faded/ghost markers for comparison
- Date selector: adjust progression date
- Progressed planet list (glass cards):
  - Planet glyph + "Progressed [Planet] in [Sign]"
  - House position
  - Comparison to natal: "Natal: [Sign] -> Progressed: [Sign]"
  - Interpretation text (#F0F0F5 at 65% opacity)

17. FRIENDS (friends.tsx) -- Mobile
- Header: "Friends"
- Friend list, each as a glass card:
  - Avatar (circular, initials fallback)
  - Friend name (#F0F0F5 bold)
  - Sun sign badge with glyph (#A78BFA background)
  - Compatibility score: circular mini-gauge (0-100)
  - Tap for full synastry comparison
- "Add Friend" button at bottom (#A78BFA)
- Add friend form: name + birth data (date, time, location)
- Empty state: people illustration with "Add friends to compare charts"

18. SETTINGS (settings.tsx) -- Mobile
- Bottom tab: Settings (active)
- Section: "Birth Data" (glass card):
  - Birth date picker
  - Birth time picker (with "Unknown" option)
  - Birth location: city search input with autocomplete
- Section: "House System" (glass card):
  - Radio buttons: Placidus (default), Whole Sign, Koch, Equal, Campanus
- Section: "Display Preferences" (glass card):
  - Zodiac system toggle: Tropical (default) / Sidereal
  - Aspect orb size slider (tight/medium/wide)
- Section: "Notifications" (glass card):
  - Daily horoscope notification toggle
  - Moon phase alerts toggle
  - Retrograde alerts toggle

19. WEB -- HOME (/stars) -- Desktop
- Left sidebar (240px, #12121A):
  - MyStars logo + "⭐ MyStars"
  - Nav links: Home, Birth Chart, Moon, Tarot, Transits, Journal, Events, Retrogrades, Settings
  - Active link: #A78BFA left border + text color
- Main content area:
  - Two-column layout
  - Left column (60%): Daily horoscope card (large), Daily reading card
  - Right column (40%): Moon phase card, Retrograde status card, Planetary positions list

20. WEB -- BIRTH CHART (/stars/chart) -- Desktop
- Sidebar nav (same as screen 19)
- Main content: large natal chart wheel (centered, 500px diameter)
- Right panel (300px): planet positions table, aspect grid table
- Below chart: interpretation cards in 2-column grid

21. WEB -- MOON (/stars/moon) -- Desktop
- Sidebar nav
- Main content: large moon illustration (centered)
- Below: moon calendar (full month grid, larger cells than mobile)
- Right sidebar: upcoming phases list, zodiac position details

22. WEB -- TAROT (/stars/tarot) -- Desktop
- Sidebar nav
- Card of the day: centered card display (larger)
- Below: spread selector and card layout area (wider space for Celtic Cross)
- Right panel: reading history list
- Bottom: saved readings gallery

23. WEB -- JOURNAL (/stars/journal) -- Desktop
- Sidebar nav
- Two-column layout:
  - Left (40%): journal entry list with search and filters
  - Right (60%): selected entry full view with moon phase, tags, linked chart
- "New Entry" button in header area
```
