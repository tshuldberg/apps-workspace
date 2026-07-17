# MyStars — Design Document

**Date:** 2026-02-22
**Status:** Draft
**Author:** MyApps Product Team

---

## Overview

**MyStars** is a privacy-first astrology and birth chart app that performs all astrological calculations entirely on the user's device using the Swiss Ephemeris compiled to WebAssembly. While every major astrology app requires users to upload their exact birth date, time, and location to remote servers — data that is profoundly personal and useful for identity verification and social engineering — MyStars keeps this information exclusively in a local SQLite database. Users get professional-grade natal charts, daily transits, compatibility readings, and moon phase tracking without ever creating an account or making a network request for chart generation.

---

## Problem Statement

The astrology app market is thriving (~$4.75B in 2025, growing at 20%+ CAGR) but deeply compromised in three ways:

1. **Birth data is identity-grade sensitive, yet apps treat it casually.** Astrology apps collect the exact date, time, and geographic coordinates of your birth — a data triple that is more personally identifying than most credentials. This data can be used for identity verification security questions, social engineering attacks, and profiling. Co-Star has 30M+ users' birth data on its servers. The Pattern reserves the right to share collected data with third parties. In 2024, the Moonly app leaked GPS coordinates, birth dates, and email addresses of 6 million users, with the breach revealing ties to Russian-based employees. No major astrology app treats birth data with the security it deserves.

2. **Subscription pricing for content that should be computed locally.** CHANI charges $11.99/month ($143.88/year) for personalized readings. Co-Star monetizes through in-app purchases. Sanctuary charges $2.99/minute for live readings and $199.99/year for subscriptions. The astronomical calculations underlying all birth charts were solved in the 1990s by the Swiss Ephemeris (free, open-source, arc-second accuracy). There is no technical reason to upload birth data to a server to compute a natal chart — the entire calculation runs in <100ms on a modern phone via WebAssembly.

3. **Cold, algorithmic aesthetic dominates the category.** Co-Star's minimalist black-and-white design and AI-generated "brutally honest" push notifications have defined the visual language of astrology apps. But astrology's appeal is warmth, mystery, and cosmic wonder — not clinical detachment. Users on r/astrology and r/AskAstrologers consistently request apps that feel more personal, more beautiful, and less like a tech startup's personality quiz.

---

## Target User Persona

**Primary: Maya, 26, Spiritually Curious Professional**

- Checks Co-Star daily but is increasingly uncomfortable that they have her exact birth time and birthplace on their servers
- Reads her horoscope as a reflective ritual, not a predictive tool — values the interpretive framework astrology provides
- Has explored her natal chart on astro.com and wants deeper transit tracking without re-entering birth data into yet another app
- Willing to pay once for a beautiful, private app; deeply resistant to another $10+/month subscription
- Age range: 18-34 (core demographic — 58-64% of astrology app users)
- Platforms: Primarily iOS, secondarily Android
- Technical level: Moderate — uses privacy settings on her phone but doesn't audit network traffic
- Interested in: birth charts, daily transits, compatibility, moon phases. Not interested in: live psychic readings, tarot, crystal healing

**Secondary: Practicing astrologers who want a portable reference tool, privacy advocates who track their data exposure, parents who want to generate family charts without uploading children's birth data**

---

## Competitive Landscape

| Competitor | Price | Est. Users | Est. Revenue | Privacy Stance | Key Weakness |
|---|---|---|---|---|---|
| **Co-Star** | Free + IAP | 30M+ downloads | ~$5M ARR ($400K/mo) | Claims no third-party data sales, but collects birth data server-side. Security researchers found undisclosed communication with external servers. Requests camera, contacts, Bluetooth permissions | Birth data stored on servers. AI-generated "brutal honesty" tone alienates users. Cold aesthetic. $21M VC-funded — monetization pressure. 11-50 employees |
| **CHANI** | $11.99/mo | 2M+ downloads | ~$17M ARR (#1 grossing) | Cloud-synced with account required. Standard privacy policy | Highest price in category. Content-heavy model dependent on Chani Nicholas's personal brand. If founder steps back, value proposition weakens. Subscription fatigue |
| **The Pattern** | Free + premium | 10M+ downloads | ~$8M ARR est. | Reserves right to share all collected data with third parties. Channing Tatum publicly questioned if app was listening to his therapy sessions (2019) | Privacy policy explicitly allows third-party data sharing. Personality-focused, not chart-focused. Opaque methodology — not transparent about astrological vs. psychological basis |
| **TimePassages** | $9.99 unlock | 2M+ downloads | ~$3M ARR est. | Desktop software heritage. Less aggressive data collection than mobile-native competitors | Dated UI. Desktop software aesthetic ported to mobile. Limited social features. Niche audience of serious astrologers |
| **Sanctuary** | $2.99/min live + $199.99/yr | ~500K downloads | ~$5M ARR est. | Cloud-based, account required. Live readings require real-time data transmission | Expensive live reading model. $6.5M VC-funded. High price ceiling alienates casual users. Reading quality inconsistent |
| **Astrology Zone** | Free (ad-supported) | 30yr web legacy, ~180K IG followers | ~$6M ARR | Web-first, standard ad-tracking cookies and third-party analytics | Entirely dependent on Susan Miller's monthly horoscopes. No birth chart functionality. Website feels 2005. No modern app experience. Content-only, no computation |

**Market opportunity:** The astrology app market reached $4.75B in 2025 and is projected to hit $9.91B by 2029 (20.2% CAGR). 58-64% of users are aged 18-34 — a demographic that indexes high on both spiritual curiosity and privacy awareness. 28% of users in 2024 reported privacy and data-sharing concerns. 45% cited data security concerns as a barrier to adoption (FTC study, 2023). No major astrology app offers verifiably local-only birth chart computation. The privacy gap is wide open.

---

## Key Features (MVP)

### Birth Chart Generation (On-Device)

- **Natal chart calculation:** Full birth chart computed locally using Swiss Ephemeris WebAssembly (astro-sweph). Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto positions. All 12 houses computed using Placidus system (with Whole Sign and Koch available in settings). Ascendant, Midheaven, North Node, Chiron included
- **Chart visualization:** Traditional circular chart wheel rendered with react-native-svg. Zodiac signs on outer ring, house cusps as dividing lines, planet glyphs positioned at their degree. Aspect lines drawn between planets (conjunction, sextile, square, trine, opposition)
- **Birth data input:** Date picker, time picker (with "I don't know my birth time" option — generates a solar chart using noon), and location search. Location search uses a bundled city database (~40K cities with lat/lng/timezone) — no geocoding API call needed
- **Interpretations:** Each planet-in-sign, planet-in-house, and major aspect has a locally-stored interpretation text. ~200 interpretation entries bundled with the app (~500KB of text). Written in a warm, reflective tone — not Co-Star's "brutal honesty"

### Daily Horoscope & Transit Tracking

- **Daily transits:** Each morning, compute current planetary positions and compare against the user's natal chart. Highlight active transits (e.g., "Transiting Mars conjunct your natal Venus") with interpretations
- **Transit timeline:** Week and month views showing upcoming transits with significance ratings (major/moderate/minor). Helps users plan around meaningful astrological events
- **Daily summary:** A locally-generated 3-4 sentence daily reading synthesized from active transits. No AI API call — template-based generation from transit data + interpretation library
- **Push notifications:** Optional daily local notification with the day's key transit (e.g., "Full Moon in your 7th house today"). All local — no APNs/FCM server

### Compatibility

- **Synastry chart:** Compare two birth charts. Compute inter-chart aspects (e.g., "Their Moon conjunct your Sun"). Both charts stored locally
- **Compatibility score:** Weighted score based on inter-chart aspects. Displayed as a percentage with breakdown by category (emotional, intellectual, physical, communication)
- **Multiple profiles:** Store up to 20 birth chart profiles locally (self, partner, friends, family). Each profile has name, birth data, and computed chart cached in SQLite

### Moon Phases & Calendar

- **Moon phase display:** Current moon phase computed from ephemeris. Visual representation (illumination percentage rendered as filled circle). Phase name (New, Waxing Crescent, First Quarter, Waxing Gibbous, Full, Waning Gibbous, Last Quarter, Waning Crescent)
- **Moon sign:** Current moon sign computed in real-time. "Moon in Scorpio" with brief interpretation
- **Lunar calendar:** Month view showing moon phase for each day, with full/new moon dates highlighted
- **Void-of-course Moon:** Computed from last aspect before Moon sign change. Important for planning-oriented astrology users

### Retrograde Tracker

- **Current retrogrades:** Dashboard showing which planets are currently retrograde, with start/end dates
- **Retrograde calendar:** Forward-looking view of upcoming retrograde periods (Mercury, Venus, Mars — the most impactful)
- **Retrograde impact:** How each retrograde transits the user's natal chart specifically

---

## Technical Architecture

### Stack

| Layer | Technology |
|---|---|
| Mobile framework | Expo (React Native) with Expo Router |
| Web framework | Next.js 15 (App Router) |
| Ephemeris engine | astro-sweph (Swiss Ephemeris WebAssembly, ~1.9MB, embedded data, offline) |
| Local database | expo-sqlite (mobile) / sql.js (web) |
| State management | Zustand with SQLite persistence layer |
| UI components | Custom component library, celestial dark theme |
| Chart rendering | react-native-svg (mobile) / SVG (web) — custom chart wheel renderer |
| Notifications | expo-notifications (local only) |
| Date/time handling | date-fns + bundled timezone database (IANA) |
| City database | Bundled GeoNames dataset (~40K cities, ~2MB compressed) |
| Monorepo | Turborepo |
| Package manager | pnpm |
| Language | TypeScript 5.9 everywhere |
| Testing | Vitest (shared logic), Jest (React Native), Playwright (web) |

### Monorepo Structure

```
MyStars/
├── apps/
│   ├── mobile/             # Expo app (iOS + Android)
│   └── web/                # Next.js 15 app
├── packages/
│   ├── shared/             # Core logic (ephemeris, calculations, interpretations)
│   │   ├── src/
│   │   │   ├── ephemeris/  # astro-sweph wrapper, chart computation
│   │   │   ├── charts/     # Natal, transit, synastry calculations
│   │   │   ├── interpret/  # Interpretation text library
│   │   │   ├── moon/       # Moon phase, sign, void-of-course
│   │   │   ├── transit/    # Daily transit computation
│   │   │   ├── geo/        # City database, timezone lookup
│   │   │   └── types/      # Zod schemas, TypeScript types
│   │   └── data/
│   │       ├── cities.json.gz     # Bundled city database
│   │       └── interpretations/   # Planet-sign, planet-house, aspect texts
│   ├── ui/                 # Shared UI components
│   │   ├── chart-wheel/    # Circular chart renderer (SVG)
│   │   ├── moon-phase/     # Moon phase visual component
│   │   └── theme/          # Color tokens, typography
│   └── db/                 # SQLite schema, migrations, queries
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

### Data Model (SQLite)

```sql
-- User birth profiles (self + saved charts)
CREATE TABLE profiles (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name          TEXT NOT NULL,                -- Display name ("Me", "Alex", "Mom")
  birth_date    TEXT NOT NULL,                -- ISO 8601 date (YYYY-MM-DD)
  birth_time    TEXT,                         -- HH:MM (24hr) or NULL if unknown
  birth_time_known INTEGER NOT NULL DEFAULT 1, -- 0 = unknown (use solar chart)
  latitude      REAL NOT NULL,               -- Birth location latitude
  longitude     REAL NOT NULL,               -- Birth location longitude
  city_name     TEXT,                         -- Display name for birth city
  timezone      TEXT NOT NULL,               -- IANA timezone (e.g., 'America/New_York')
  is_primary    INTEGER NOT NULL DEFAULT 0,  -- 1 = user's own chart
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_profiles_primary ON profiles(is_primary);

-- Cached natal chart data (recomputed on profile edit)
CREATE TABLE natal_charts (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  profile_id    TEXT NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  -- Planet positions (longitude in degrees, 0-360)
  sun_lon       REAL NOT NULL,
  sun_sign      TEXT NOT NULL,               -- 'aries' | 'taurus' | ... | 'pisces'
  sun_house     INTEGER NOT NULL,            -- 1-12
  moon_lon      REAL NOT NULL,
  moon_sign     TEXT NOT NULL,
  moon_house    INTEGER NOT NULL,
  mercury_lon   REAL NOT NULL,
  mercury_sign  TEXT NOT NULL,
  mercury_house INTEGER NOT NULL,
  venus_lon     REAL NOT NULL,
  venus_sign    TEXT NOT NULL,
  venus_house   INTEGER NOT NULL,
  mars_lon      REAL NOT NULL,
  mars_sign     TEXT NOT NULL,
  mars_house    INTEGER NOT NULL,
  jupiter_lon   REAL NOT NULL,
  jupiter_sign  TEXT NOT NULL,
  jupiter_house INTEGER NOT NULL,
  saturn_lon    REAL NOT NULL,
  saturn_sign   TEXT NOT NULL,
  saturn_house  INTEGER NOT NULL,
  uranus_lon    REAL NOT NULL,
  uranus_sign   TEXT NOT NULL,
  uranus_house  INTEGER NOT NULL,
  neptune_lon   REAL NOT NULL,
  neptune_sign  TEXT NOT NULL,
  neptune_house INTEGER NOT NULL,
  pluto_lon     REAL NOT NULL,
  pluto_sign    TEXT NOT NULL,
  pluto_house   INTEGER NOT NULL,
  north_node_lon REAL NOT NULL,
  north_node_sign TEXT NOT NULL,
  north_node_house INTEGER NOT NULL,
  chiron_lon    REAL NOT NULL,
  chiron_sign   TEXT NOT NULL,
  chiron_house  INTEGER NOT NULL,
  -- House cusps (Placidus by default)
  ascendant_lon REAL NOT NULL,
  ascendant_sign TEXT NOT NULL,
  midheaven_lon REAL NOT NULL,
  midheaven_sign TEXT NOT NULL,
  house_system  TEXT NOT NULL DEFAULT 'placidus', -- 'placidus' | 'whole_sign' | 'koch'
  house_cusps   TEXT NOT NULL,               -- JSON array of 12 cusp longitudes
  -- Aspects (precomputed)
  aspects       TEXT NOT NULL,               -- JSON array of {planet1, planet2, type, orb, applying}
  computed_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_natal_charts_profile ON natal_charts(profile_id);

-- Daily transit snapshots (computed and cached per day)
CREATE TABLE transit_snapshots (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  profile_id    TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date          TEXT NOT NULL,               -- ISO 8601 date (YYYY-MM-DD)
  -- Active transits to natal chart
  transits      TEXT NOT NULL,               -- JSON array of {transiting_planet, natal_planet, aspect_type, orb, exact_date, interpretation_key}
  -- Current planet positions for the day
  planet_positions TEXT NOT NULL,            -- JSON {sun: {lon, sign, retrograde}, moon: {lon, sign}, ...}
  -- Moon data
  moon_phase    TEXT NOT NULL,               -- 'new' | 'waxing_crescent' | ... | 'waning_crescent'
  moon_illumination REAL NOT NULL,           -- 0.0-1.0
  moon_sign     TEXT NOT NULL,
  moon_void_of_course INTEGER NOT NULL DEFAULT 0, -- 1 = Moon is void-of-course
  void_until    TEXT,                        -- datetime when Moon enters next sign
  -- Daily reading
  daily_summary TEXT,                        -- Generated from transit templates
  computed_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(profile_id, date)
);

CREATE INDEX idx_transit_snapshots_date ON transit_snapshots(profile_id, date);

-- Synastry comparison results (cached)
CREATE TABLE synastry_charts (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  profile_a_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  profile_b_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- Inter-chart aspects
  aspects       TEXT NOT NULL,               -- JSON array of {planet_a, planet_b, aspect_type, orb}
  -- Compatibility scores (0-100)
  score_overall     INTEGER NOT NULL,
  score_emotional   INTEGER NOT NULL,
  score_intellectual INTEGER NOT NULL,
  score_physical    INTEGER NOT NULL,
  score_communication INTEGER NOT NULL,
  interpretation    TEXT,                    -- Summary text
  computed_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(profile_a_id, profile_b_id)
);

-- Retrograde periods (precomputed for next 2 years)
CREATE TABLE retrograde_periods (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  planet        TEXT NOT NULL,               -- 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn'
  start_date    TEXT NOT NULL,               -- ISO 8601 date
  end_date      TEXT NOT NULL,               -- ISO 8601 date
  sign_start    TEXT NOT NULL,               -- Zodiac sign at retrograde start
  sign_end      TEXT,                        -- Zodiac sign at retrograde end (if changes)
  computed_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_retrograde_planet_date ON retrograde_periods(planet, start_date);

-- User preferences (key-value)
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Bookmarked/saved readings
CREATE TABLE saved_readings (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  profile_id    TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,               -- 'transit' | 'natal' | 'synastry' | 'daily'
  title         TEXT NOT NULL,
  content       TEXT NOT NULL,               -- Full reading text
  date          TEXT NOT NULL,               -- Date of the reading
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_saved_readings_profile ON saved_readings(profile_id, created_at);

-- Schema version for migrations
CREATE TABLE schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Ephemeris Architecture

The core differentiator is on-device chart computation using the Swiss Ephemeris:

```
Birth Data Input                Swiss Ephemeris (WASM)              Chart Output
─────────────────              ────────────────────────            ──────────────
Date: 1997-06-15    ──►  astro-sweph (1.9MB embedded)  ──►  Planet longitudes
Time: 14:30 UTC     ──►  No network request needed     ──►  House cusps
Lat:  40.7128       ──►  Arc-second accuracy            ──►  Aspects matrix
Lon: -74.0060       ──►  Dates: 1800-2400 CE           ──►  Moon phase
                         50+ celestial bodies                 Retrograde status
```

**astro-sweph** is the recommended library because:
- Single-file deployment with embedded ephemeris data (LZ4 compressed, ~1.9MB)
- No external file dependencies — works offline immediately
- WebAssembly runs identically in React Native (via Hermes) and web browsers
- Arc-second accuracy for dates 1800-2400 CE (covers all living humans and historical figures)
- 50+ celestial bodies: Sun, Moon, Mercury through Pluto, North Node, Chiron, 50 numbered asteroids
- Supports all major house systems (Placidus, Whole Sign, Koch, Equal, Campanus, etc.)
- MIT-compatible license for commercial use

**Chart computation pipeline:**
1. User enters birth date, time, location
2. Location lookup against bundled city database (no geocoding API)
3. Convert local time to Julian Day Number using timezone database
4. Call `astro-sweph` for each planet: `calc_ut(julday, planet_id)` returns ecliptic longitude
5. Call `astro-sweph` for house cusps: `houses(julday, lat, lon, house_system)` returns 12 cusps + ASC/MC
6. Determine planet signs (longitude / 30 = sign index) and houses (compare longitude to cusp ranges)
7. Compute aspect matrix: for each planet pair, check if angular distance matches any aspect within orb
8. Cache complete chart in `natal_charts` table
9. Render chart wheel using react-native-svg

**Performance:** Full natal chart computation takes <100ms on iPhone 12 equivalent. Transit computation (all current planet positions vs. natal chart) takes <50ms. Moon phase calculation takes <5ms. All computations are synchronous and non-blocking.

### Privacy Architecture

**Network isolation — the core promise:**

The app makes zero network requests for astrological functionality. Birth data, chart computations, transit calculations, and interpretations all execute on-device. The only network activity is App Store update checks (controlled by the OS, not the app) and IAP validation (RevenueCat, which never receives birth data).

**What the app NEVER transmits:**
- Birth date, time, or location
- Planet positions or chart data
- Saved profiles or compatibility results
- Daily readings or transit data
- Any content from the SQLite database

**What the app CAN transmit (explicitly documented):**
- IAP receipt validation (RevenueCat) — transmits only purchase receipt, not birth data
- App Store update metadata (OS-level, not app-level)

**Data at rest:**
- SQLite database in app's sandboxed container
- iOS: `NSFileProtectionComplete` — database inaccessible when device is locked
- Android: Private internal storage, inaccessible without root
- iOS: Database excluded from iCloud backup via `NSURLIsExcludedFromBackupKey`
- Android: `android:allowBackup="false"` in manifest

**Verification strategy:**
- Source-available under FSL license. Anyone can audit the code
- No analytics SDK (no Firebase, no Amplitude, no Mixpanel)
- No crash reporting SDK (no Sentry, no Crashlytics)
- No remote config, no feature flags, no A/B testing frameworks
- Network traffic auditable via Charles Proxy — zero outgoing requests to our servers

**City database privacy:**
- The ~40K city bundled database means location search happens locally
- No Google Places API, no Mapbox geocoding, no network-based location lookup
- User types "New York" → local fuzzy search returns matching cities with lat/lng/timezone
- Birth coordinates never leave the device

---

## UI/UX Direction

### Design Language

- **Color palette:** Deep navy background (#0B0E1A), warm gold primary (#D4A843), soft purple accent (#8B6CC1), rose for important transits (#E8788A), teal for harmonious aspects (#4ECDC4), silver for moon elements (#C0C7D0), deep indigo for cards/surfaces (#151A2E)
- **Aesthetic:** Celestial, warm, mystical — NOT clinical or minimalist like Co-Star. Think antique star charts meets modern UI. Subtle star-field particle effects on key screens. Gold gradient accents on active elements
- **Typography:** Playfair Display for headings (serif, elegant, astrological), Inter for body text (clean, readable). System font fallback for performance
- **Shape language:** Circular motifs (chart wheels, moon phases, zodiac rings). Cards with 16px radius. Subtle inner glow on selected elements
- **Iconography:** Custom line icons with celestial aesthetic — zodiac glyphs, planet symbols, moon phases. 1.5px stroke, gold color. Astrological symbols use traditional glyphs (♈ ♉ ♊ etc.)
- **Motion:** Slow, orbital animations. Chart wheel draws incrementally on first view. Moon phase transitions smoothly. Transit highlights pulse gently. No jarring or fast animations — everything moves like celestial bodies

### Navigation Structure

Bottom tab bar with 4 tabs:

```
[Chart]     [Today]     [Moon]     [Explore]
```

1. **Chart tab (default):** Interactive natal chart wheel. Tap any planet to see its sign, house, and interpretation. Pinch to zoom. Below the chart: scrollable list of all placements (Sun in Gemini, Moon in Scorpio, etc.) with expandable interpretations. Gear icon in top-right for profile management (switch between saved charts).

2. **Today tab:** Today's cosmic weather. Top card: current transits to the user's natal chart with significance indicators. Below: daily reading (3-4 sentences). Below: retrograde status dashboard (which planets are retrograde, when they end). Quick-glance design — the "check it on the train" screen.

3. **Moon tab:** Large moon phase visualization (golden circle with shadow). Current moon sign and interpretation. Void-of-course indicator. Below: lunar calendar for the month showing phase progression. Tappable days for detailed moon data.

4. **Explore tab:** Compatibility checker (select two profiles → synastry chart + scores). Transit calendar (upcoming significant transits for the next 30 days). Retrograde calendar. Saved readings library.

### Key Screen Flows

**Onboarding (4 screens):**
```
Screen 1: "The stars are yours."
  [Animated constellation connecting into a chart wheel]
  "MyStars computes your birth chart on your device.
   Your birth data never leaves your phone.
   Not to our servers. Not to anyone's servers."
  [Continue]

Screen 2: "Let's build your chart."
  [Birth date picker — large, friendly date wheel]
  [Continue]

Screen 3: "When were you born?"
  [Time picker — hour/minute wheels]
  [Toggle: "I don't know my exact birth time"]
  (If unknown: "We'll create a solar chart using noon.
   Your rising sign and houses will be approximate.")
  [Continue]

Screen 4: "Where were you born?"
  [Search field with local city database autocomplete]
  [City results appear as user types — no network call]
  [Selected city shows lat/lng confirmation]
  [Create My Chart →]
```

**Chart view (main screen after onboarding):**
```
┌─────────────────────────────────────┐
│  ☰  My Chart            ⚙️ Profiles │
│                                     │
│         ╭─────────────────╮         │
│       ╱  ♈  ♉  ♊  ♋  ♌  ╲        │
│     ╱    ☉ ☽ ☿ ♀ ♂ ♃ ♄    ╲      │
│    │     [Chart Wheel SVG]   │      │
│     ╲    ♅ ♆ ♇ ☊ ⚷         ╱      │
│       ╲                   ╱        │
│         ╰─────────────────╯         │
│                                     │
│  ☉ Sun in Gemini (10th House)  ▾   │
│  ☽ Moon in Scorpio (3rd House) ▾   │
│  ↑ Ascendant in Virgo          ▾   │
│  ☿ Mercury in Cancer (11th)    ▾   │
│  ♀ Venus in Taurus (9th)      ▾   │
│  ...                               │
│                                     │
│ [Chart]  [Today]  [Moon]  [Explore] │
└─────────────────────────────────────┘
```

**Compatibility view (from Explore tab):**
```
┌─────────────────────────────────────┐
│  ← Compatibility                    │
│                                     │
│   [Maya's Chart]  ♥  [Alex's Chart] │
│                                     │
│        Overall: 78% Compatible      │
│                                     │
│  Emotional      ████████░░  82%     │
│  Intellectual   ███████░░░  71%     │
│  Physical       █████████░  89%     │
│  Communication  ██████░░░░  63%     │
│                                     │
│  Key Aspects:                       │
│  ☽ → ☉  Moon conjunct Sun     ★★★  │
│  ♀ → ♂  Venus trine Mars      ★★   │
│  ☿ → ☿  Mercury square Mercury ★   │
│  ...                               │
│                                     │
│  [View Synastry Chart]              │
│  [Save This Reading]                │
└─────────────────────────────────────┘
```

### Platform-Specific Considerations

- **iOS widget (small, 2x2):** Today's moon phase icon + moon sign text. Gold on dark navy. No network needed
- **iOS widget (medium, 4x2):** Moon phase + current retrogrades + "Transit: Mars □ your Venus" one-liner
- **Apple Watch complication (post-MVP):** Moon phase on watch face, current moon sign
- **Android widget:** Same as iOS widgets, using expo-widgets or native module

---

## Monetization

### Pricing

- **$4.99 one-time purchase** via App Store / Google Play (RevenueCat for IAP management)
- No free tier. The entire app is the paid product
- No subscription. One payment, lifetime access, all future updates included
- No ads. No sponsored content. No data monetization

### Why $4.99

Market research supports this price point:
- **Below CHANI's annual cost** ($143.88/yr) by 97%. Users save $139+ per year
- **Below Co-Star's cumulative IAP spend** (average user spends $15-25 on in-app purchases)
- **Below TimePassages** ($9.99 unlock) with modern UI and transit tracking
- **Consistent MyApps suite pricing** — same $4.99 price point across all apps builds brand trust
- **One-time model aligns with zero-server-cost architecture** — no recurring infrastructure to fund

### Revenue Model

- App Store takes 30% (year 1) / 15% (year 2+ via Small Business Program)
- Net per sale: ~$3.49 (year 1) → ~$4.24 (year 2+)
- Target: 40,000 paid downloads in year 1 = ~$199,600 gross (~$139,720 net after App Store cut)
- Year 2 target: 80,000 cumulative downloads. Privacy-first astrology becomes a recognized category
- Long-term: 200,000+ downloads as word-of-mouth compounds in astrology communities

### Why One-Time Works

- Zero server costs — all computation is on-device
- Zero API costs — no OpenAI, no geocoding, no push notification infrastructure
- Marginal cost per user is effectively $0
- The bundled interpretation library and ephemeris engine have zero ongoing cost
- Updates funded by new user acquisition, not retention pressure
- Aligns incentives: app must be good enough that users recommend it

---

## Marketing Angle

### One-Sentence Pitch

**"Your birth chart. Not their data."**

### Expanded Pitch

Every astrology app on the market requires you to upload your exact date, time, and place of birth to their servers. This data triple is more personally identifying than your Social Security Number — it's unique to you and can never be changed. Co-Star has 30 million people's birth data. The Pattern openly shares user data with third parties. Moonly leaked 6 million users' GPS coordinates and birth dates.

MyStars is the first commercial astrology app that computes your natal chart entirely on your device using the Swiss Ephemeris — the same astronomical engine used by professional astrologers worldwide. Your birth data never touches a server. Not ours. Not anyone's.

Professional-grade charts. $4.99. Once. Forever.

### Target Communities

1. **r/astrology** (1.2M members) + **r/AskAstrologers** (400K members) — Core audience. These communities actively discuss chart interpretations, transit effects, and app recommendations. Lead with chart accuracy (Swiss Ephemeris) and the on-device computation angle. Astrology enthusiasts will verify and amplify
2. **r/privacy** (1.7M members) — Technical audience that will audit the source code. Lead with the privacy architecture: zero network requests, no telemetry, source-available. Privacy advocates who happen to be into astrology are a powerful crossover niche
3. **Astrology TikTok/Instagram** — "#astrology" has 40B+ views on TikTok. Short-form content: "Your astrology app knows your exact birth time and location. Here's why that matters." Creator partnerships with astrology influencers who value privacy
4. **WitchTok / spiritual communities** — Adjacent audience deeply engaged with astrology. Privacy resonates ("protect your energy and your data")
5. **Tech press** — Pitch to The Verge, Wired, Ars Technica: "A developer built an astrology app that does all the math on your phone — because birth data shouldn't live on servers." The technical angle (Swiss Ephemeris compiled to WebAssembly) is genuinely interesting to tech journalists
6. **Digital rights organizations** — EFF, Access Now, The Markup. Position as a case study in privacy-first consumer app design

### Press-Worthy Elements

- **Privacy as verifiable guarantee:** Source-available under FSL. Network traffic auditable. No other commercial astrology app can make and prove this claim
- **The Moonly breach narrative:** "6 million astrology users' birth data and GPS coordinates leaked, with ties to Russian employees. Here's the app that makes this breach impossible — because the data never leaves your phone"
- **Channing Tatum angle:** "He asked 'how does The Pattern know this about me?' We built the app where the answer is: it doesn't know — because we never asked"
- **Birth data as identity data:** Novel angle that birth date + time + location is more sensitive than most credential data. Astrology apps are holding identity-grade information with startup-grade security
- **Price disruption:** $4.99 once vs. $144/year (CHANI). $4.99 once vs. $200/year (Sanctuary). Math is obvious

---

## MVP Timeline

### Pre-Development (Week 0)
- Finalize design document (this document)
- Set up Turborepo monorepo with Expo + Next.js + shared packages
- Configure pnpm, TypeScript, ESLint, Prettier
- Set up CI (GitHub Actions: typecheck, lint, test)
- Evaluate and integrate astro-sweph (verify WASM runs in Hermes/JSC)

### Week 1: Ephemeris Engine + Data Layer
- Integrate astro-sweph into `packages/shared/ephemeris/`
- Build chart computation pipeline: birth data → Julian Day → planet positions → house cusps → aspects
- Implement SQLite schema and migration system
- Build profile CRUD operations
- Write comprehensive tests for chart computation (verify against known charts from astro.com)
- Build city database search (fuzzy matching against bundled GeoNames data)

### Week 2: Chart Visualization
- Build circular chart wheel renderer using react-native-svg
- Implement zodiac ring, house cusp lines, planet glyphs, aspect lines
- Build planet placement list (below chart) with expandable interpretations
- Implement tap-to-select planet interaction on chart wheel
- Build profile switcher (top-right gear icon)

### Week 3: Transit Engine + Today View
- Build transit computation: current planet positions vs. natal chart
- Implement transit significance scoring (major/moderate/minor based on aspect type and orb tightness)
- Build template-based daily reading generator
- Build Today tab: transit cards, daily reading, retrograde dashboard
- Build retrograde period computation and caching

### Week 4: Moon + Compatibility
- Build moon phase computation and visualization (golden circle with shadow animation)
- Implement moon sign tracking and void-of-course detection
- Build lunar calendar month view
- Build synastry engine: inter-chart aspect computation
- Build compatibility scoring algorithm
- Build compatibility view with score breakdown and aspect list

### Week 5: Interpretations + Polish
- Write/curate interpretation library (~200 entries: planet-in-sign, planet-in-house, aspects, transits)
- Build daily notification system (local push via expo-notifications)
- Build Settings screen (house system preference, notification config, export, wipe data)
- Implement data export (JSON) and import
- Build saved readings functionality

### Week 6: Onboarding + Web
- Build 4-screen onboarding flow with animations
- Port mobile UI to Next.js web app
- Cross-platform testing (iOS simulator, Android emulator, web browsers)
- Accessibility pass (VoiceOver, TalkBack, dynamic type)
- Performance profiling (chart render time, transit computation time)
- Dark mode refinement and animation polish

### Week 7: Distribution Prep
- App Store screenshots (chart wheel, today view, moon phase, compatibility)
- Privacy policy page emphasizing zero-server architecture
- App Store review submission (iOS + Android)
- RevenueCat IAP configuration ($4.99 one-time)
- Source-available repository setup (GitHub, FSL license)
- App icon design (celestial motif, gold on dark navy)

### Week 8: Launch
- Submit to App Store review
- Prepare launch posts for r/astrology, r/AskAstrologers, r/privacy
- Draft press pitches for The Verge, Wired, Ars Technica
- Set up landing page (mystars.app or similar)
- Create TikTok/Instagram launch content (screen recordings of chart computation)
- Launch day: community posts, press emails, creator outreach
- Monitor reviews, crash-free rate, download velocity

---

## Acceptance Criteria

The MVP is complete when ALL of the following are true:

### Functional — Chart Generation
- [ ] User can enter birth date, time, and location during onboarding
- [ ] User can select "I don't know my birth time" for solar chart generation
- [ ] Location search works against bundled city database with no network call
- [ ] Natal chart is computed on-device using astro-sweph WebAssembly
- [ ] Chart wheel renders all planet positions, house cusps, and aspect lines
- [ ] Tapping a planet on the chart wheel shows its sign, house, and interpretation
- [ ] All 12 planet/point placements have interpretation text (Sun through Chiron + North Node)
- [ ] Aspect interpretations display for all major aspects (conjunction, sextile, square, trine, opposition)

### Functional — Transits & Daily
- [ ] Daily transits computed from current planet positions vs. natal chart
- [ ] Transit significance rated as major/moderate/minor
- [ ] Daily reading generated from active transit data
- [ ] Retrograde dashboard shows currently retrograde planets with dates
- [ ] Local push notification fires with daily transit summary at configured time

### Functional — Moon
- [ ] Current moon phase displayed with accurate illumination visualization
- [ ] Current moon sign displayed with interpretation
- [ ] Void-of-course Moon detected and displayed
- [ ] Lunar calendar shows moon phases for the current month

### Functional — Compatibility
- [ ] User can save up to 20 birth chart profiles
- [ ] Synastry chart computes inter-chart aspects between two profiles
- [ ] Compatibility score breaks down into emotional, intellectual, physical, communication
- [ ] Compatibility reading text generated from synastry aspects

### Functional — Data Management
- [ ] User can export all data as JSON
- [ ] User can wipe all data with confirmation dialog
- [ ] User can switch between saved profiles on the chart tab
- [ ] User can save/bookmark readings for later reference

### Privacy
- [ ] Zero network requests for chart computation confirmed via Charles Proxy
- [ ] Birth data stored only in local SQLite database
- [ ] iOS: Database excluded from iCloud backup (`NSURLIsExcludedFromBackupKey`)
- [ ] Android: `android:allowBackup="false"` in manifest
- [ ] No analytics SDK, no crash reporting SDK in dependency tree
- [ ] City database search operates locally against bundled data
- [ ] Only network requests are IAP validation (RevenueCat) — verified to not transmit birth data
- [ ] Privacy policy accurately states: birth data never transmitted to any server

### Quality
- [ ] Full natal chart computes in <200ms on iPhone 12 equivalent
- [ ] Daily transit computation completes in <100ms
- [ ] Chart wheel renders at 60fps during pinch-to-zoom
- [ ] All planet glyphs and zodiac symbols render correctly across platforms
- [ ] Interpretation text covers all sun signs, moon signs, and major aspects (~200 entries)
- [ ] Chart positions verified against astro.com for 10 test birth dates
- [ ] VoiceOver (iOS) and TalkBack (Android) navigate all screens
- [ ] Dynamic Type / font scaling does not break layouts

### Distribution
- [ ] Available on iOS App Store ($4.99 one-time)
- [ ] Available on Google Play Store ($4.99 one-time)
- [ ] Source code published on GitHub under FSL license
- [ ] Landing page live with privacy architecture explanation and download links
- [ ] App Store description emphasizes on-device computation and zero data collection
