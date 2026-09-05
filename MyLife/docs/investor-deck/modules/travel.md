# MyTravel Module Audit

**ID:** travel | **Prefix:** tv_ | **Tier:** premium | **Storage:** sqlite
**Mobile wired:** yes | **Web wired:** yes | **Version:** 0.1.0
**One-line promise:** Plan trips, collect memories

## User Value
- Plan upcoming trips with logistics, budget, and notes
- Track visited and bucket-list destinations
- Travel journal with photos and memories
- Trip map visualization
- Private travel log (no social feed required)

## Feature Inventory (code-verified)
| Feature | Source | Status |
|---|---|---|
| Core schema (tv_trips, tv_destinations, tv_settings) | src/db/schema.ts | shipped |
| TripSchema, DestinationSchema, TravelSettingSchema (Zod) | src/types.ts | shipped |
| Trips tab + detail | app/(travel)/index.tsx, trip/ | shipped |
| Destinations tab + detail | app/(travel)/destinations.tsx, destination/ | shipped |
| Journal tab + per-entry | app/(travel)/journal.tsx, journal/ | shipped |
| Logistics tab | app/(travel)/logistics.tsx | shipped |
| Bucket list | app/(travel)/bucket-list.tsx | shipped |
| Trip planning | app/(travel)/planning.tsx | shipped |
| Map view | app/(travel)/map.tsx | shipped |
| Memories + memory detail | app/(travel)/memories.tsx, memory/ | shipped |
| Stats | app/(travel)/stats.tsx | shipped |
| Settings | app/(travel)/settings.tsx | shipped |
| Per memory commit log | recent git: P0-P9 complete, 487 tests | shipped |

## Data Model
Prefix `tv_`, schema v7. Tables: tv_trips, tv_destinations, tv_settings (plus v2-v7 migrations per getTravelMigrations(), backed by 487 tests in recent commits). Definition is minimal at module level; richer schema lives in the db package.

## Screens / User Flows
Mobile tabs: Trips, Destinations, Journal, Logistics. Many supporting screens: trip detail, destination detail, journal entry, memory, map, stats, planning, bucket-list, memories. Web route parity.

## Distinctive / Moat-worthy
- Trips plus destinations plus journal plus logistics in one cohesive surface
- Recent MyTravel Mission Control (P0-P9) shipped 487 tests, deepest per-module coverage in the investor-deck audit set
- Bucket list and memories turn trip planning into lifetime log
- Promoted to public beta in registry

## Gaps vs competitors
- No flight/hotel booking integrations (by privacy design)
- No receipt OCR for logistics
- No social trip sharing (not a feed app)

## Investor-facing hook
Polarsteps plus TripIt plus a trip journal, rolled into one private timeline of every place you have ever been and everywhere you still want to go.
