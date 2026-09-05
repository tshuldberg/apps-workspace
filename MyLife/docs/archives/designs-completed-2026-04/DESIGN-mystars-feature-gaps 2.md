# MyStars - Feature Gap Design Doc
**Source:** Competitive Feature Analysis (2026-03-05)
**Status:** Stub (navigation only)

## Current State
Stub module with navigation scaffolding only. No business logic, no database tables, no screens implemented.

Note: The competitive analysis rates this as LOW PRIORITY. Astrology is cloud-dependent by nature (requires ephemeris calculations and daily content generation). Consider as a fun lifestyle add-on rather than a core module.

## Competitors Analyzed

| App | Pricing | Focus |
|-----|---------|-------|
| Co-Star | Freemium | Social astrology with daily push notifications |
| Nebula | $50/yr | Detailed natal charts and transit tracking |
| The Pattern | $120/yr | Personality analysis and relationship compatibility |

## Feature Gaps (Full Build Required)

### P0 - MVP Features

| Feature | Priority | Competitors That Have It | Implementation Difficulty | Notes |
|---------|----------|--------------------------|---------------------------|-------|
| Natal chart generation | P0 | Co-Star, Nebula, The Pattern | High | Enter birth date/time/place, generate natal chart with planet positions |
| Sun/Moon/Rising sign display | P0 | All competitors | Medium | Basic astrological profile from birth data |
| Daily horoscope (locally generated) | P0 | All competitors | High | Generate daily insights based on current planetary positions using local ephemeris data |
| Planet position calculator | P0 | All competitors | High | Current positions of planets in zodiac signs |

### P1 Features

| Feature | Priority | Competitors That Have It | Implementation Difficulty | Notes |
|---------|----------|--------------------------|---------------------------|-------|
| Friend compatibility | P1 | Co-Star, The Pattern | Medium | Compare charts between two people (synastry) |
| Transit tracking | P1 | Nebula | High | When planets make significant aspects to natal chart |
| Lunar cycle guide | P1 | The Pattern, Stardust | Medium | Moon phase tracking with zodiac sign |
| Personality insights | P1 | The Pattern | Medium | Detailed personality analysis from natal chart |
| Birth chart explanations | P1 | All competitors | Medium | Educational text explaining what each placement means |
| Zodiac calendar | P1 | None | Medium | Upcoming astrological events and transits |

### P2 Features

| Feature | Priority | Competitors That Have It | Implementation Difficulty | Notes |
|---------|----------|--------------------------|---------------------------|-------|
| Solar return chart | P2 | Nebula | High | Birthday year forecast |
| Progressed chart | P2 | None | High | Long-term life cycles |
| Astrology journal | P2 | None | Medium | Log how transits affect you (feeds into correlation) |
| Retrograde tracker | P2 | Co-Star | Low | Mercury, Venus, Mars retrograde periods with survival tips |
| Daily card/affirmation | P2 | Nebula | Low | Daily tarot-style card pull |
| Astronomical events calendar | P2 | None | Medium | Eclipses, meteor showers, planetary conjunctions |

### P3 Features

| Feature | Priority | Competitors That Have It | Implementation Difficulty | Notes |
|---------|----------|--------------------------|---------------------------|-------|
| Audio meditations (zodiac-themed) | P3 | The Pattern | High | Sign-specific guided meditations |
| Dating compatibility | P3 | The Pattern | Medium | Romantic compatibility analysis |

## Recommended MVP Features

Minimal feature set to ship v1:
1. Birth data input (date, time, place) stored locally
2. Natal chart generation with planet positions using bundled ephemeris data
3. Sun, Moon, and Rising sign display with brief descriptions
4. Daily horoscope generated locally from current planetary positions
5. Planet position calculator showing current zodiac placements
6. SQLite storage with `st_` table prefix

Technical note: The key challenge is bundling ephemeris data for offline use. Swiss Ephemeris (open source) provides the calculations needed. The data files for a reasonable date range (1900-2100) are roughly 50MB, which is acceptable for a mobile app bundle.

## Full Feature Roadmap

1. **v1.0 - Core Astrology** (P0): Birth data entry, natal chart generation, Sun/Moon/Rising display, daily horoscope, planet positions
2. **v1.1 - Relationships and Transits** (P1): Friend compatibility (synastry charts), transit tracking with personal alerts, lunar cycle guide
3. **v1.2 - Education and Planning** (P1): Detailed personality insights, birth chart explanations, zodiac calendar
4. **v2.0 - Advanced Charts** (P2): Solar return charts, progressed charts, retrograde tracker
5. **v2.1 - Journaling and Events** (P2): Astrology journal (transit-mood correlation), daily card/affirmation pull, astronomical events calendar
6. **v3.0 - Premium** (P3): Zodiac-themed guided meditations, dating compatibility analysis

## Privacy Competitive Advantage

Co-Star has been criticized for manipulative push notifications designed to increase engagement through anxiety-inducing messages. The Pattern charges $120/yr and collects detailed personal data. Both apps require cloud accounts and process birth data on their servers.

Birth data (exact time and location of birth) is sensitive PII that can be used for identity verification and social engineering. Astrology apps also collect relationship data through compatibility features. MyStars keeps all birth data, chart calculations, and compatibility analyses fully on-device using bundled ephemeris data. No cloud processing, no push notification manipulation, no relationship graph harvesting.

## Cross-Module Integration

| Module | Integration |
|--------|-------------|
| **MyMood** | Correlate mood logs with astrological transits (e.g., "Your mood tends to dip during Mercury retrograde") |
| **MyJournal** | Astrology-themed journal prompts based on current transits and lunar phase |
| **MyHabits** | Lunar cycle habit alignment (e.g., "Start new habits on the New Moon") |
| **MyHealth** | Cycle tracking with lunar phase overlay for menstrual cycle awareness |
