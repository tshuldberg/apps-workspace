# Feature Spec: Multi-Region Expansion Beyond CA

## Metadata
- **Module:** surf
- **Priority Score:** 28 / 50 (B-Tier)
- **Scoring Breakdown:** Market 1 x3 + Switching 5 x3 + Complexity 2 x2 + CrossModule 1 x1 + PaidUser 5 x1
- **Sprint:** TBD
- **Estimated CC Time:** 4-6 hours
- **Depends On:** none
- **Blocks:** none

## Business Context

### Why This Feature Exists
MySurf currently covers only California with ~200 curated spots across 13 regions (Humboldt through San Diego South). Surfline and Magic Seaweed both offer global coverage, making this the #1 reason surfers outside CA never try MySurf. Expanding to additional US coastlines and eventually international zones captures the entire addressable market instead of limiting it to one state.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Surfline | Yes | Partial (premium cams/forecasts) | Global coverage -- thousands of spots across 6 continents, organized by country > region > spot |
| Magic Seaweed | Yes | No (free spot data, premium forecasts) | Global spot database with swell charts and community reports per region |
| Windy | Yes | No | Global weather visualization, not spot-specific but covers all coastlines |

### Target User
Surfers outside California who currently use Surfline ($119.99/yr) or Magic Seaweed. The immediate expansion targets Oregon, Washington, Hawaii, and East Coast (Florida, Carolinas, Northeast), which collectively represent ~60% of the US surf population not currently served.

## Technical Context

### Where This Lives in MyLife

```
modules/surf/src/types.ts           -- Expand RegionSchema, add ZoneSchema
modules/surf/src/db/schema.ts       -- New sf_zones table, ALTER sf_spots
modules/surf/src/db/crud.ts         -- Zone CRUD, updated spot queries
modules/surf/src/cloud/spots.ts     -- Cloud zone queries
modules/surf/src/cloud/index.ts     -- Export new cloud functions
modules/surf/src/index.ts           -- Export new types and CRUD
modules/surf/src/definition.ts      -- V4 migration
apps/mobile/app/(surf)/regions.tsx  -- Region/zone browser screen
apps/web/app/surf/regions/page.tsx  -- Web region browser
```

### Wireframe Position

```
Hub Dashboard
  └── MySurf card
       └── Map tab (existing)
            └── Zone selector dropdown ← NEW (top of map)
       └── Regions tab ← NEW TAB
            └── Zone cards (Pacific NW, Hawaii, East Coast...)
                 └── Region list within zone
                      └── Spot list within region
```

### Data Model

```sql
-- New V4 table: surf zones (top-level geographic grouping)
CREATE TABLE IF NOT EXISTS sf_zones (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  country TEXT NOT NULL DEFAULT 'US',
  sort_order INTEGER NOT NULL DEFAULT 0,
  bounding_box_json TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/Los_Angeles',
  is_active INTEGER NOT NULL DEFAULT 1,
  spot_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Extend sf_spots to reference zones
ALTER TABLE sf_spots ADD COLUMN zone_id TEXT REFERENCES sf_zones(id);
ALTER TABLE sf_spots ADD COLUMN country TEXT NOT NULL DEFAULT 'US';
ALTER TABLE sf_spots ADD COLUMN timezone TEXT;

-- Index for zone-based queries
CREATE INDEX IF NOT EXISTS sf_spots_zone_idx ON sf_spots(zone_id);
CREATE INDEX IF NOT EXISTS sf_zones_country_idx ON sf_zones(country);
CREATE INDEX IF NOT EXISTS sf_zones_slug_idx ON sf_zones(slug);
```

The `RegionSchema` enum in `types.ts` must be expanded to a string type (or a union that includes non-CA regions) since hardcoding every region in every zone as an enum is not scalable. The approach:

1. Keep the existing `RegionSchema` enum for backward compatibility as `CARegionSchema`
2. Create a new `region` field on spots that accepts any string (validated at the zone level)
3. Add `sf_zones` as the parent grouping: Zone > Region > Spot

**Seed zones (initial launch):**

| Zone ID | Name | Country | Regions |
|---------|------|---------|---------|
| california | California | US | 13 existing CA regions |
| pacific-nw | Pacific Northwest | US | oregon_north, oregon_south, washington |
| hawaii | Hawaii | US | north_shore, south_shore, west_side, east_side, maui, big_island, kauai |
| east-coast-south | East Coast South | US | florida_atlantic, florida_gulf, outer_banks, south_carolina |
| east-coast-north | East Coast North | US | new_jersey, new_york, rhode_island, massachusetts, new_hampshire, maine |
| gulf-coast | Gulf Coast | US | texas, louisiana, alabama, florida_panhandle |

### Dependencies
- **Internal:** `@mylife/db` (migration orchestration), `@mylife/module-registry` (version bump)
- **External:** NOAA buoy station IDs for new regions, NDBC data coverage verification, tide station IDs from CO-OPS
- **Cross-Module:** None

## Functional Requirements

### User Stories
1. As a surfer in Oregon, I want to browse Pacific NW spots so I can use MySurf for my local breaks.
2. As a traveling surfer, I want to switch between zones so I can check conditions at my destination.
3. As a California surfer, I want my existing experience unchanged -- no disruption to current region browsing.
4. As a new user, I want to set my home zone during onboarding so the app defaults to my local spots.

### Behavior Specification

1. User opens MySurf and sees a zone selector at the top of the Forecast/Map screens
2. Zone selector defaults to their home zone (set in profile, or auto-detected by GPS)
3. User taps zone selector, sees a list of available zones with spot counts
4. User selects "Pacific Northwest" -- the map pans to PNW, spot list updates to PNW regions
5. Region sub-selector filters within the zone (e.g., "Oregon North", "Oregon South", "Washington")
6. Spot detail pages work identically regardless of zone -- forecast, tide, buoy, narrative, alerts all function the same
7. User can favorite spots across zones -- favorites page shows all favorites grouped by zone
8. Existing CA users see "California" as their default zone, with all 13 regions working exactly as before

### Edge Cases

- **No spots in a zone yet:** Show empty state with "Coming soon" message and a request form to suggest spots
- **GPS outside any zone:** Default to nearest zone, show "No local zone detected" with manual picker
- **Buoy/tide data unavailable for new region:** Gracefully degrade -- show forecast without buoy/tide context, display "Buoy data unavailable for this region"
- **Zone with 0 active spots:** Hide from zone selector unless user has explicitly pinned it
- **Existing alerts on CA spots:** Must continue working after migration -- zone_id backfill for CA spots is critical
- **Offline mode:** Zone metadata and user's home zone spots should be cached locally
- **Region string migration:** Old `RegionSchema` enum values must remain valid; new regions use the expanded string format

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Zone selector appears at top of Forecast and Map screens and defaults to user's home zone
- [ ] **AC-2:** Selecting a new zone updates the map viewport, spot list, and region filter
- [ ] **AC-3:** All 13 existing CA regions appear under the "California" zone with no behavior changes
- [ ] **AC-4:** At least one non-CA zone (Pacific NW or Hawaii) is browsable with seed spots
- [ ] **AC-5:** Favorites page groups favorites by zone with zone headers
- [ ] **AC-6:** Spot detail pages work for non-CA spots (forecast, reviews, photos, guides)
- [ ] **AC-7:** Regions tab shows all active zones as cards with spot counts and a map thumbnail

### Technical Criteria
- [ ] **TC-1:** V4 migration creates `sf_zones` table and adds `zone_id`/`country`/`timezone` columns to `sf_spots`
- [ ] **TC-2:** V4 migration backfills `zone_id = 'california'` for all existing spots
- [ ] **TC-3:** `RegionSchema` backward compatibility -- all existing region enum values still parse
- [ ] **TC-4:** `cloudGetSpotsByRegion` still works for CA regions (no breaking change)
- [ ] **TC-5:** New `cloudGetSpotsByZone(zoneId)` returns all spots in a zone
- [ ] **TC-6:** New `cloudGetZones()` returns all active zones sorted by sort_order
- [ ] **TC-7:** Zone-based queries are indexed and return in <200ms for zones with <500 spots
- [ ] **TC-8:** Spot search works across all zones (not limited to active zone)

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Existing CA spot data must NOT be altered or lost during migration
- [ ] **NC-2:** Existing alerts, reviews, photos, guides for CA spots must NOT break
- [ ] **NC-3:** The `RegionSchema` enum must NOT be removed -- it stays as a subset type for CA

## UI Specification

### Mobile (Expo)

- **Zone selector:** Horizontal pill row at top of Forecast/Map screens, accent color `#3B82F6` for selected zone
- **Zone cards (Regions tab):** Glass cards (`rgba(255,255,255,0.04)`) with zone name, spot count badge, and a small map preview
- **Region sub-filter:** Collapsible section within zone view, same glass card style as existing region filter
- Background: `#0A0A0F`, text: `#F0F0F5`, borders: `rgba(255,255,255,0.06)`

### Web (Next.js)

- **Zone selector:** Dropdown in the surf sidebar navigation, persists across pages
- **Regions page (`/surf/regions`):** Grid of zone cards with map thumbnails, click to drill into region list
- Same Cool Obsidian tokens via CSS variables

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton zone cards with shimmer | Initial zone fetch |
| Empty | "No zones available" with retry button | Zone fetch returns empty (unlikely) |
| Error | "Unable to load zones" toast with retry | Network error on zone fetch |
| Success | Zone cards with spot counts and map previews | Zones loaded successfully |
| Partial | Home zone loaded, other zones show loading spinners | Slow network, home zone cached |

## Test Requirements

### Unit Tests
- [ ] Zone CRUD: create, list, get by slug, update spot count
- [ ] Spot CRUD with zone_id: create spot in non-CA zone, query by zone
- [ ] RegionSchema backward compat: all 13 CA region strings still parse
- [ ] Migration V4: sf_zones table created, sf_spots columns added, CA backfill applied

### Integration Tests
- [ ] Full flow: create zone -> add spot to zone -> query spots by zone -> verify spot detail
- [ ] Migration test: V3 data + V4 migration -> all CA spots have zone_id = 'california'
- [ ] Cross-zone favorites: favorite spots in different zones, verify favorites list groups by zone

### QA Verification Script

1. Open the app on mobile
2. Verify Forecast screen shows a zone selector defaulting to California
3. Tap zone selector, verify California and at least one other zone appear
4. Select the non-CA zone, verify map pans and spot list updates -- corresponds to AC-2
5. Tap a spot in the non-CA zone, verify spot detail loads -- corresponds to AC-6
6. Navigate back, select California, verify all 13 regions work as before -- corresponds to AC-3
7. Navigate to Regions tab, verify zone cards with spot counts -- corresponds to AC-7
8. Favorite a spot in the non-CA zone, go to Favorites, verify it appears grouped by zone -- corresponds to AC-5

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required if Complexity <= 2 (Large/Complex):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. Fix issues found.

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- if module has standalone counterpart
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- MySurf supports only California with 13 hardcoded regions in `RegionSchema`
- ~200 curated spots all in CA
- No concept of zones or multi-region grouping
- `sf_spots.region` stores one of 13 CA enum values

### After This Work
- Zone-based geographic hierarchy: Zone > Region > Spot
- `sf_zones` table with at least 2 active zones (California + one expansion)
- `sf_spots` has `zone_id`, `country`, `timezone` columns
- All CA spots backfilled with `zone_id = 'california'`
- Zone selector UI on Forecast/Map screens
- Regions tab with zone browser
- New cloud adapter functions for zone queries

### Files Changed

- `modules/surf/src/types.ts` -- Add ZoneSchema, expand region handling
- `modules/surf/src/db/schema.ts` -- V4 table and ALTER statements
- `modules/surf/src/db/crud.ts` -- Zone CRUD functions
- `modules/surf/src/cloud/spots.ts` -- cloudGetSpotsByZone, cloudGetZones
- `modules/surf/src/cloud/index.ts` -- Export new cloud functions
- `modules/surf/src/definition.ts` -- Add SURF_MIGRATION_V4, bump version
- `modules/surf/src/index.ts` -- Export new types and functions
- `apps/mobile/app/(surf)/regions.tsx` -- New regions/zone browser screen
- `apps/mobile/app/(surf)/_layout.tsx` -- Add Regions tab
- `apps/web/app/surf/regions/page.tsx` -- New web regions page

### Known Limitations
- Initial launch includes US zones only -- international expansion is a future phase
- Spot seed data for non-CA zones will be smaller (~20-50 spots per zone vs 200 for CA)
- Buoy and tide station coverage varies by region -- some new regions may have limited real-time data
- AI narrative generation may need retraining/tuning for non-CA regional language

### Context for Next Agent
- The `RegionSchema` enum is used in many places (types, CRUD, cloud queries). Expanding it to support non-CA regions requires careful backward-compat work. The recommended approach is keeping the enum for CA and adding a broader string-validated region field.
- The standalone MySurf app also has a `RegionSchema` -- if parity is active, the standalone needs the same expansion.
- NOAA buoy station IDs and CO-OPS tide stations for new regions need to be researched and seeded.
