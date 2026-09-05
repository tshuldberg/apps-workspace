# MyStars Module Audit

**ID:** stars | **Prefix:** st_ | **Tier:** premium | **Storage:** sqlite
**Mobile wired:** yes | **Web wired:** yes | **Version:** 0.2.0
**One-line promise:** The cosmos in your pocket

## User Value
- Birth chart with sun/moon/rising, fully on-device
- Moon phase, zodiac events, retrograde dashboard
- Compatibility scoring between saved profiles
- Daily readings, tarot card of the day, tarot spreads
- Solar returns, progressions, transit calendar/timeline
- Astrology journal with compose + attachments

## Feature Inventory (code-verified)
| Feature | Source | Status |
|---|---|---|
| Birth profiles CRUD | src/db/crud.ts | shipped |
| Transits CRUD | src/db/crud.ts | shipped |
| Daily reading + tarot card | src/db/crud.ts + engine/astro.ts | shipped |
| Saved charts | src/db/crud.ts | shipped |
| Moon phase engine (synodic period) | src/engine/astro.ts | shipped |
| Zodiac sign + element mapping | src/engine/astro.ts | shipped |
| Compatibility scoring (40-90 range) | src/engine/astro.ts | shipped |
| Tarot deck (78 cards, deterministic by JD) | src/engine/astro.ts | shipped |
| V2 moon calendar + zodiac events + solar returns + progressions | schema V2 | shipped |
| V3 tarot spread storage | schema V3 | shipped |
| V4 journal compose (title/intention/attachments) | schema V4 | shipped |
| Today / Sky / Journal / More tab nav | navigation | shipped |
| Birth chart, add/view profile | app/(stars)/* | shipped |
| Moon calendar, transit calendar/timeline, retrograde dashboard | app/(stars)/* | shipped |
| Friends + compatibility history | app/(stars)/friends.tsx, compatibility-history.tsx | shipped |

## Data Model
Prefix `st_`, schema v4. V1: st_birth_profiles, st_transits, st_daily_readings, st_saved_charts. V2: moon_calendar, compatibility_results, zodiac_events, transit_events, journal_entries, solar_returns, progressed_charts. V3: st_tarot_readings. V4: journal compose metadata.

## Screens / User Flows
Mobile tabs: Today, Sky, Journal, More. 18+ screens including birth-chart, add-profile, compatibility, moon-calendar, transit-timeline/calendar, retrograde-dashboard, solar-return, progressions, tarot-card, tarot-reading, journal-compose. Web parity.

## Distinctive / Moat-worthy
- Pure on-device calculations, zero network for all astrology (privacy win)
- Deterministic tarot card algorithm (Julian Day cycling), same card for same day everywhere
- Multiple saved profiles + compatibility history across people
- 30+ tests covering moon phase edge dates, element boundaries, compatibility symmetry

## Gaps vs competitors
- No professional natal chart geometry visualizations (Co-Star has glyph art)
- No personalized push notifications for transits
- No partner feed or social sharing (Co-Star's moat)

## Investor-facing hook
Co-Star's daily reading engine plus a full tarot deck, moon calendar, and compatibility database, running entirely offline at zero API cost.
