# Feature Spec: Room/Zone Organization

## Metadata
- **Module:** garden
- **Priority Score:** 26 / 50 (B-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 3 x3 + Complexity 3 x2 + CrossModule 2 x1 + PaidUser 3 x1
- **Sprint:** Sprint 2+
- **Estimated CC Time:** 2-3 hours
- **Depends On:** none (gd_zones table already exists with basic schema)
- **Blocks:** light level estimation (reads per zone), garden layout planner (layouts reference zones)

## Business Context

### Why This Feature Exists
Plant parents organize their collections by room ("living room windowsill", "bathroom", "south balcony"). Currently the garden module has a basic gd_zones table with name, location, description, and sortOrder, but no way to visually group plants by zone, see zone-level health summaries, or manage zones with meaningful metadata like light conditions, temperature range, or humidity level. PlantIn's room-based organization is one of its most praised features and a key reason users stay subscribed. This enhancement turns a bare-bones zone list into a spatial organization system that mirrors how people actually think about their plants.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| PlantIn | Yes | Free (basic), Pro for advanced | Room cards with plant count, room photo, light level indicator, scrollable room list |
| Planta | Yes | Pro ($36/yr) | Room-based grouping, custom room icons, drag-to-reorder |
| Gardenize | Partial | Free | Zone tags but no visual grouping or room-level views |
| Seed to Spoon | No | N/A | No room concept, only outdoor garden bed planning |

### Target User
Indoor plant parents with 10+ plants spread across multiple rooms who want to see at a glance which room needs attention. Also apartment gardeners who track balcony vs kitchen vs bathroom conditions. Users currently using PlantIn's room organization would switch if MyLife matched its room cards with health summaries.

## Technical Context

### Where This Lives in MyLife

```
modules/garden/src/types.ts                    -- Add ZoneType enum, ZoneStats, extend GardenZone
modules/garden/src/db/schema.ts                -- Extend gd_zones columns (V2 migration)
modules/garden/src/db/crud.ts                  -- Add zone stats, zone detail queries, updateZone
modules/garden/src/definition.ts               -- Add V2 migration
apps/mobile/app/(garden)/zones.tsx             -- Zone list/grid screen
apps/mobile/app/(garden)/zone-detail.tsx       -- Zone detail with plant list
apps/mobile/app/(garden)/components/ZoneCard.tsx  -- Zone summary card
apps/web/app/garden/zones/page.tsx             -- Web zone list
apps/web/app/garden/zones/[id]/page.tsx        -- Web zone detail
```

### Wireframe Position

```
Hub Dashboard
  └── MyGarden card
       └── Garden tab
            └── [Toggle: Plants | Zones]
                 └── Zones view ← YOU ARE HERE
                      └── Zone Card tap
                           └── Zone Detail (plants in this zone)
```

### Data Model

```sql
-- V2 migration: extend gd_zones with metadata columns
ALTER TABLE gd_zones ADD COLUMN zone_type TEXT NOT NULL DEFAULT 'room';
ALTER TABLE gd_zones ADD COLUMN icon TEXT;
ALTER TABLE gd_zones ADD COLUMN color TEXT;
ALTER TABLE gd_zones ADD COLUMN photo_uri TEXT;
ALTER TABLE gd_zones ADD COLUMN light_level TEXT;
ALTER TABLE gd_zones ADD COLUMN humidity TEXT;
ALTER TABLE gd_zones ADD COLUMN temperature_notes TEXT;
ALTER TABLE gd_zones ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'));
```

**Column notes:**
- `zone_type`: 'room' | 'greenhouse' | 'balcony' | 'yard_section' | 'raised_bed' | 'windowsill' | 'shelf' | 'custom'
- `icon`: Emoji or icon identifier for the zone (e.g., '🛋️', '🛁', '🌿')
- `color`: Hex color for visual differentiation in grid view (e.g., '#4CAF50')
- `photo_uri`: Local file path to a zone photo
- `light_level`: 'low' | 'medium' | 'bright_indirect' | 'direct' -- general light classification
- `humidity`: 'low' | 'medium' | 'high' -- general humidity classification
- `temperature_notes`: Freeform text (e.g., "Drafty in winter", "Near heater")

**Note:** SQLite ALTER TABLE ADD COLUMN does not support NOT NULL without a default value. The `zone_type` default is 'room' so existing zones auto-classify as rooms.

### Dependencies
- **Internal:** `@mylife/garden` (types, crud, schema), `@mylife/ui` (Cool Obsidian tokens)
- **External:** `expo-image-picker` (zone photos, optional)
- **Cross-Module:** recipes module could reference zone data for herb garden zones (future)

## Functional Requirements

### User Stories
1. As a plant parent, I want to organize my plants by room so that I can quickly see all plants in a specific location.
2. As a plant parent, I want to see a health summary per zone (total plants, needs attention count, overdue watering count) so that I know which room needs care today.
3. As a plant parent, I want to set light level and humidity for each zone so that I can verify my plants are in appropriate locations.
4. As a plant parent, I want to add a photo to each zone so that I can visually recognize the space at a glance.
5. As a plant parent, I want to reorder zones by drag-and-drop so that my most important zones appear first.

### Behavior Specification

**Zone list view:**
1. User navigates to Garden tab
2. A toggle at the top switches between "Plants" (default, current list) and "Zones"
3. Zones view shows a grid of zone cards (2 columns on mobile, 3 on web)
4. Each zone card shows: zone photo or colored placeholder with icon, zone name, plant count badge, status summary (green/yellow/red dots for healthy/attention/overdue counts)
5. Tapping a zone card navigates to Zone Detail
6. FAB or "+" button opens Add Zone modal

**Zone detail view:**
1. Zone header: photo (or placeholder), name, zone type label, light level badge, humidity badge
2. Plant list: all plants assigned to this zone, sorted by status (needs_attention first, then healthy, dormant, dead)
3. Quick actions: "Add Plant to Zone" (opens plant picker or Add Plant with zone pre-filled), "Edit Zone", "Delete Zone"
4. Stats card: total plants, healthy %, overdue watering count, total harvested

**Add/Edit zone:**
1. Modal with fields: name (required), zone type (segmented picker), icon (emoji picker grid), color (preset swatches), photo (camera/gallery), light level (radio buttons with descriptions), humidity (radio buttons), temperature notes (text), sort order (stepper)
2. Save validates name is non-empty and unique among zones

**Delete zone:**
1. Confirmation: "Delete [zone name]? Plants in this zone will be unassigned but not deleted."
2. On confirm: delete zone, set zone=null on all plants referencing it

### Edge Cases

- **No zones exist:** Empty state with illustration: "Organize your plants by room. Add your first zone to get started." + "Add Zone" button
- **Zone with 0 plants:** Show zone card with "0 plants" badge and "Add plants" CTA
- **Deleting a zone with plants:** Plants become unassigned (zone=null), not deleted
- **Duplicate zone names:** Block with validation message "A zone with this name already exists"
- **Very long zone name:** Truncate at 50 chars in display, enforce 100 char max on input
- **Photo permission denied:** Show zone with colored placeholder, no camera icon
- **Module disabled:** Zone assignments preserved in DB, restored when re-enabled
- **Migration with existing zones:** Existing zones get `zone_type='room'`, all new columns get defaults

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Plants/Zones toggle on Garden tab switches between plant list and zone grid
- [ ] **AC-2:** Zone cards show photo/icon, name, plant count, and health status dots
- [ ] **AC-3:** Tapping a zone card shows zone detail with all assigned plants
- [ ] **AC-4:** Add Zone modal allows setting name, type, icon, color, photo, light, humidity
- [ ] **AC-5:** Edit Zone modal pre-populates all fields and saves changes
- [ ] **AC-6:** Deleting a zone unassigns plants but does not delete them
- [ ] **AC-7:** Plant count and status dots update in real time when plants are added/removed/status changes
- [ ] **AC-8:** Zone cards are reorderable by drag (mobile) or sort order adjustment (web)
- [ ] **AC-9:** From zone detail, "Add Plant to Zone" creates a new plant with zone pre-filled
- [ ] **AC-10:** Light level and humidity are displayed as badges on zone detail header

### Technical Criteria
- [ ] **TC-1:** V2 migration adds all new columns to gd_zones without data loss
- [ ] **TC-2:** Existing zones default to zone_type='room' after migration
- [ ] **TC-3:** Zone stats query returns correct counts for healthy/attention/overdue plants
- [ ] **TC-4:** Deleting a zone sets zone=null on gd_plants rows (not CASCADE delete)
- [ ] **TC-5:** Zone photos stored locally, path persisted in gd_zones.photo_uri
- [ ] **TC-6:** Zone name uniqueness enforced at CRUD layer

### Negative Criteria
- [ ] **NC-1:** Deleting a zone must NOT delete any plant records
- [ ] **NC-2:** Zone photos must NOT be uploaded to any server
- [ ] **NC-3:** Changing zone metadata must NOT affect plant care schedules
- [ ] **NC-4:** Feature must NOT break existing zone assignments from V1 schema

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Zone cards: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border
- Module accent: `#22C55E`
- Zone card layout: 2-column grid, 160px height, photo fills card with gradient overlay at bottom for text
- No-photo zones: solid color fill (zone color or accent) with centered emoji icon (32px)
- Plant count badge: top-right corner, pill shape with accent background
- Status dots: 8px circles, green (#30D158)/yellow (#FFD60A)/red (#FF453A), bottom-left corner row
- Toggle (Plants/Zones): segmented control at top, accent color for active segment

### Web (Next.js)

- Same tokens via CSS variables in `globals.css`
- 3-column zone grid on desktop, 2 on tablet, 1 on mobile
- Sidebar shows "Zones" as a navigation item under Garden
- Zone detail: 2-panel layout (zone info left, plant list right)
- Route: `/garden/zones` (list), `/garden/zones/[id]` (detail)

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton zone cards (4 placeholders) | Initial data fetch |
| Empty | Illustration + "Add your first zone" CTA | No zones exist |
| Error | "Could not load zones. Pull down to retry." | DB query fails |
| Success | Zone grid with cards | 1+ zones exist |
| Partial | Mix of zones with/without photos, varying plant counts | Normal mixed data |

## Test Requirements

### Unit Tests
- [ ] `createZone()`: creates zone with all new V2 fields
- [ ] `updateZone()`: updates individual fields without affecting others
- [ ] `deleteZone()`: removes zone and nullifies plant zone references
- [ ] `getZoneStats()`: returns correct plant counts by status per zone
- [ ] `getZones()`: returns zones ordered by sort_order ASC
- [ ] Zone name uniqueness check: rejects duplicate names
- [ ] Migration: existing zones get correct defaults for new columns

### Integration Tests
- [ ] Full flow: create zone -> assign plant -> view zone detail -> verify plant appears
- [ ] Delete flow: delete zone -> verify plants unassigned but exist
- [ ] Stats flow: add plants with different statuses -> verify zone stats accuracy

### QA Verification Script

1. Open the app on iOS/Android
2. Navigate to MyGarden module
3. Verify: Plants/Zones toggle visible at top of Garden tab -- AC-1
4. Tap "Zones" toggle
5. Verify: empty state with "Add your first zone" CTA (if no zones)
6. Tap "Add Zone" (FAB or CTA)
7. Fill in: name "Living Room", type "Room", icon "🛋️", light "Bright Indirect", humidity "Medium"
8. Save zone
9. Verify: zone card appears in grid with icon and name -- AC-2
10. Create 2 more zones: "Bathroom" (high humidity), "Balcony" (direct light)
11. Assign plants to zones via plant edit or zone detail "Add Plant"
12. Verify: plant count badges update on zone cards -- AC-7
13. Tap a zone card
14. Verify: zone detail shows header with light/humidity badges and plant list -- AC-3, AC-10
15. From zone detail, tap "Add Plant to Zone"
16. Verify: Add Plant form has zone pre-filled -- AC-9
17. Edit zone: add a photo, change light level
18. Verify: zone card now shows photo, detail shows updated light badge -- AC-4, AC-5
19. Delete a zone that has plants
20. Verify: confirmation dialog mentions plants will be unassigned -- AC-6
21. Confirm delete
22. Verify: plants still exist but have no zone assignment -- AC-6, NC-1
23. On web: navigate to /garden/zones
24. Verify: zone grid renders in 3-column layout on desktop

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- if module has standalone counterpart
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
gd_zones table exists with basic fields (id, name, location, description, sort_order, created_at). Zones are assignable to plants but have no visual presence, no stats aggregation, and no metadata like light level or humidity.

### After This Work
- gd_zones extended with zone_type, icon, color, photo_uri, light_level, humidity, temperature_notes, updated_at
- Zone grid view accessible via Plants/Zones toggle on Garden tab
- Zone detail screen with plant list and stats
- Zone CRUD enhanced with updateZone, deleteZone (with plant unassignment), stats queries
- Mobile and web zone management screens

### Files Changed
- `modules/garden/src/types.ts` -- ZoneType enum, ZoneStats interface, extended GardenZone type
- `modules/garden/src/db/schema.ts` -- ALTER TABLE statements for V2
- `modules/garden/src/db/crud.ts` -- updateZone, getZoneStats, enhanced deleteZone
- `modules/garden/src/definition.ts` -- V2 migration
- `apps/mobile/app/(garden)/zones.tsx` -- Zone grid screen
- `apps/mobile/app/(garden)/zone-detail.tsx` -- Zone detail screen
- `apps/mobile/app/(garden)/components/ZoneCard.tsx` -- Zone card component
- `apps/web/app/garden/zones/page.tsx` -- Web zone list
- `apps/web/app/garden/zones/[id]/page.tsx` -- Web zone detail

### Known Limitations
- Drag-to-reorder on mobile requires a gesture library (react-native-reanimated + react-native-gesture-handler). V1 may use a simpler sort-order stepper.
- Zone photos are optional. Zones without photos show colored placeholder with icon.

### Context for Next Agent
- The light level estimation feature (separate spec) builds on this by adding measured lux readings to zones.
- The garden layout planner (separate spec) creates visual layouts scoped to zones.
- When building the V2 migration, note that SQLite ALTER TABLE ADD COLUMN has limitations -- each column must be added in a separate ALTER statement and must have a default value if NOT NULL.
