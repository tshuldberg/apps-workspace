# MyTrails Module Audit

**ID:** trails | **Prefix:** tr_ | **Tier:** premium | **Storage:** sqlite
**Mobile wired:** yes | **Web wired:** yes | **Version:** 1.0.0
**One-line promise:** Offline hiking and trail guide

## User Value
- GPS recording for hikes, runs, cycles, walks
- Elevation profile, pace, calorie estimation
- Waypoints and geotagged photos per recording
- Offline map regions with tile downloads
- Wrong-turn alert settings with deviation events
- Segments with KOM-style efforts
- Packing templates and checklists
- Trip itineraries (multi-day, multi-activity)
- Route builder and community reviews

## Feature Inventory (code-verified)
| Feature | Source | Status |
|---|---|---|
| Trails, recordings, waypoints, photos CRUD | src/db/crud.ts | shipped V1 |
| Offline map regions | V2 | shipped |
| Wrong-turn alerts + deviation events | V3 | shipped |
| Weather overlay cache | V4 | shipped |
| Segments + segment efforts | V5 | shipped |
| Packing templates + items | V6 | shipped |
| Trips + trip days + trip activities | V7 | shipped |
| Trail database integration | V8 | shipped |
| Planned routes + waypoints | V9 | shipped |
| Reviews + photo attachments | V10, V11 | shipped |
| Module settings | V12 | shipped |
| Recording notes + privacy + quick rating | V13 | shipped |
| Hub places adoption (hub_place_id shadow-write) | V14 | shipped |
| Geo engine (Haversine, elevation, pace, calories) | src/engine/geo.ts | shipped |
| Record, map, trails list, trail detail screens | app/(trails)/* | shipped |
| Discover, route-builder, write-review, trips | app/(trails)/* | shipped |

## Data Model
Prefix `tr_`, schema v14 (14 migrations). Tables include tr_trails, tr_recordings, tr_waypoints, tr_photos, tr_offline_regions, tr_alert_settings, tr_deviation_events, tr_weather_cache, tr_segments, tr_segment_efforts, tr_packing_templates/items, tr_trips/trip_days/trip_activities, tr_trail_database, tr_planned_routes, tr_route_waypoints, tr_reviews, tr_settings. Cross-module hub_place_id pointer in V14.

## Screens / User Flows
Mobile tabs: Map, Trails, Recordings, Settings. 13+ screens including record, trail detail, elevation-profile, offline-regions, alert-settings, segment detail, packing checklist, trips, discover, route-builder, write-review, gear, photos, weather, calories. Web route parity.

## Distinctive / Moat-worthy
- Full stack: record, plan, discover, pack, review, retrace, all local
- 14 migrations showing deep iteration cycles
- 30+ geo-engine tests including antimeridian, southern hemisphere edge cases
- Cross-module hub_places pointer (V14) enables sharing locations with Travel, RSVP

## Gaps vs competitors
- No AllTrails-scale community trail database yet (V8 schema exists, content pipeline needed)
- No offline tile provider wired in production (schema ready)
- Wrong-turn voice alerts schema exists; UX still maturing

## Investor-facing hook
AllTrails plus Komoot plus Strava segments in one private module, no $54 per year paywall, and no location data ever leaves the device.
