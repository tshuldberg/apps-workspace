# MySurf Module Audit

**ID:** surf | **Prefix:** sf_ | **Tier:** premium | **Storage:** supabase (plus local SQLite cache)
**Mobile wired:** yes | **Web wired:** yes | **Version:** 0.5.0
**One-line promise:** Surf forecasts and spot intel, no ads, no tracking

## User Value
- Multi-region coverage (California, Hawaii, East Coast, Portugal) with 41+ seeded spots
- NOAA data: hourly forecast, swell components, buoys, tides
- Go / Maybe / No one-glance verdict on every spot
- AI-generated forecast narratives per spot and region
- Configurable surf alerts on wave height, wind, tide, period
- Session logging with GPS wave detection
- Opt-in crews and shared sessions (no public feed by default)

## Feature Inventory (code-verified)
| Feature | Source | Status |
|---|---|---|
| Spots, sessions CRUD | src/db/crud.ts | shipped V1 |
| Forecast / swell / tide / buoy / narrative cache | V2 schema | shipped |
| User pins, alerts, community (reviews/photos/guides), session waves, trail hikes | V3 schema | shipped |
| Zones, profiles, follows, shared sessions, crews | V4 schema | shipped |
| Cam feeds and ensemble forecasts | V5 drop | intentionally removed |
| Cloud adapters (30 functions) | src/cloud/ | shipped |
| Spot rating engine (swell/wind/tide/consistency) | src/rating/rating.ts | shipped |
| Go/Maybe/No quick glance | src/rating/quick-glance.ts | shipped |
| Wave energy physics | src/rating/energy.ts | shipped |
| GPS wave detection | src/utils/waves.ts | shipped |
| Alert evaluator (AND/OR) | src/utils/alerts.ts | shipped |
| GPX import / export | src/utils/gpx.ts | shipped |
| Region, map, spots, feed, profile, account tabs | app/(surf)/* | shipped |
| Web full route tree | apps/web/app/surf/* | shipped |

## Data Model
Prefix `sf_`, schema v5 (storageType supabase). 20+ tables across 5 migrations. Cloud-connected via Supabase client with local SQLite cache. PostGIS-backed nearby-spots lookup. Intentionally omits cam feeds and ensemble forecasts (Surfline's moat, not ours).

## Screens / User Flows
Mobile tabs: Forecast, Map, Spots, Feed, Profile. Screens: spot detail, buoy detail, session log, regions, surfer profile, crew, alerts, tides, wave-detect, trail, feed. Web matches.

## Distinctive / Moat-worthy
- Pure TS rating physics (energy = rho g H^2 T / 16), no secret Surfline-style black box
- Anti-enshittification V5 migration: code deletes cam-feed and ensemble-forecast tables to enforce positioning
- 15 test files covering every rating engine, utility, and CRUD path
- Cloud storage is opt-in; core forecast reads work offline from cache

## Gaps vs competitors
- No live cam feeds (deliberate)
- Only 5 regions seeded (Surfline has global)
- No editorial or surf-journalist content

## Investor-facing hook
Surfline's clean forecast math without the $120 per year paywall, the ad network, or the tracking, with higher-frequency daily usage that drives hub suite retention.
