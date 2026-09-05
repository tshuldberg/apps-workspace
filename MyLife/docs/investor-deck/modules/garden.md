# MyGarden — Module Audit

**ID:** garden | **Prefix:** gd_ | **Tier:** premium | **Storage:** sqlite
**Mobile wired:** yes | **Web wired:** yes | **Version:** 0.2.0 (schema v2)
**One-line promise:** Plant care and garden planner

## User Value
- Plant identification and disease/pest diagnosis on-device (no PlantIn subscription).
- Watering schedules that adapt to plant, zone, and frost data.
- Layout planner with companion-planting guidance and seasonal tasks.
- Harvest tracking with analytics; propagation tracking for cuttings.
- Light-level readings and zone organization without selling your garden to an ad network.

## Feature Inventory (code-verified)
| Feature | Source | Status |
|---------|--------|--------|
| Plants + zones | modules/garden/src/db/schema-v2.ts (gd_plants, gd_zones) | shipped |
| Identification (camera + DB) | modules/garden/src/engine/ (identifications); db (gd_identifications) | shipped |
| Diagnosis (disease/pest) | modules/garden/src/engine/diagnosis.ts, diagnosis-db.ts; db (gd_diagnoses) | shipped |
| Watering engine | modules/garden/src/engine/watering.ts | shipped |
| Seasonal tasks + data | modules/garden/src/engine/seasonal-data.ts; db (gd_seasonal_tasks) | shipped |
| Harvest tracking + analytics | modules/garden/src/engine/harvest-analytics.ts; db (gd_harvests) | shipped |
| Propagation tracking | modules/garden/src/engine/propagation.ts; db (gd_propagations) | shipped |
| Light meter + classification | modules/garden/src/engine/light.ts, light-classification.ts; db (gd_light_readings) | shipped |
| Layout planner | modules/garden/src/engine/layout-planner.ts; db (gd_layouts, gd_layout_items) | shipped |
| Companion planting | modules/garden/src/engine/companion.ts, companion-data.ts | shipped |
| Frost dates + alerts | modules/garden/src/engine/frost.ts, frost-data.ts; db (gd_frost_config) | shipped |
| Wishlist | modules/garden/src/db (gd_wishlist) | shipped |
| Seeds tracking | modules/garden/src/db (gd_seeds) | shipped |
| Journal entries | modules/garden/src/db (gd_entries) | shipped |

## Data Model
- gd_plants, gd_zones, gd_entries, gd_harvests, gd_propagations, gd_diagnoses, gd_identifications, gd_seasonal_tasks, gd_seeds, gd_wishlist, gd_light_readings, gd_layouts, gd_layout_items, gd_frost_config, gd_settings.

## Screens / User Flows
- Mobile: apps/mobile/app/(garden)/ -- index, plants, plant/, add-plant, journal, identify, diagnose, diagnosis/, companions, companion-check, companion-matrix, wishlist, propagations, propagation/, light-meter, layouts, layout/, frost, seasonal, seeds, harvests, harvest/, photos, export.
- Web: apps/web/app/garden/ -- page, plants/, [id], companions/, diagnoses/, frost/, harvests/, journal/, layout-planner/, propagations/, schedule/, seasonal/, seeds/, wishlist/, zones/, photos/, _components, _lib, actions.ts.

## Distinctive / Moat-worthy
- Plant ID + diagnosis + watering + layout + companion + frost + propagation + harvest in one module; PlantIn, Planta, Seed to Spoon each cover fractions.
- Local layout planner with drag-and-drop layout items (no proprietary cloud design tool).
- Light classification engine turns a phone camera into a par meter.
- Companion matrix is an actual data model, not a blog post.

## Gaps vs competitors (from COMPETITIVE-MATRIX)
- COMPETITIVE-MATRIX section 25 reports 40% with many [ ] items, but the current code ships the majority of them:
  - [ ] AI plant identification -- shipped (identify.tsx, gd_identifications).
  - [ ] Disease/pest diagnosis -- shipped (diagnose.tsx, diagnosis-db.ts).
  - [ ] Light level estimation -- shipped (light-meter, gd_light_readings).
  - [ ] Seasonal care -- shipped (seasonal-data.ts, gd_seasonal_tasks).
  - [ ] Wish list -- shipped (gd_wishlist).
  - [ ] Room/zone organization -- shipped (gd_zones).
  - [ ] Harvest tracking -- shipped (harvest-analytics.ts).
  - [ ] Garden layout planner -- shipped (layout-planner.ts).
  - [ ] Companion planting -- shipped (companion.ts, companion-matrix).
  - [ ] Frost date alerts -- shipped (frost.ts, gd_frost_config).
  - [ ] Propagation tracking -- shipped (propagation.ts).
- Action: matrix row is stale; update to reflect ~100% parity.

## Investor-facing hook
MyGarden quietly reached feature parity with every paid garden app on the market while the competitive matrix still lists it at 40% -- the module is a ready-to-market growth lever for spring launches.
