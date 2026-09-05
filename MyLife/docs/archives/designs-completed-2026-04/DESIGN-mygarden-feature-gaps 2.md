# MyGarden - Feature Gap Design Doc
**Source:** Competitive Feature Analysis (2026-03-05)
**Status:** Stub (navigation only)

## Current State
Stub module with navigation scaffolding only. No business logic, no database tables, no screens implemented.

Note: MyRecipes already has garden tracking with plant journals, harvest tracking, and garden layout. MyGarden should either absorb and expand that functionality or remain merged with MyRecipes. This design doc covers features needed regardless of where they live.

## Competitors Analyzed

| App | Pricing | Focus |
|-----|---------|-------|
| Planta | $36/yr | Indoor plant care with smart watering reminders |
| PictureThis | $30-40/yr | AI plant identification and disease diagnosis |

## Feature Gaps (Full Build Required)

### P0 - MVP Features

| Feature | Priority | Competitors That Have It | Implementation Difficulty | Notes |
|---------|----------|--------------------------|---------------------------|-------|
| Plant catalog/inventory | P0 | Planta, PictureThis | Low | Track all plants with name, location (indoor/outdoor), date acquired, photo |
| Watering reminders | P0 | Planta, PictureThis | Medium | Smart reminders based on plant type, season, and pot size |
| Care schedule (water/fertilize/prune/repot) | P0 | Planta | Medium | Per-plant care calendar with notification reminders |
| Plant journal with photos | P0 | Planta, PictureThis | Medium | Track growth over time with dated photos |
| Basic plant care info | P0 | Planta | Low | Sunlight, water, humidity, temperature needs per species |

### P1 Features

| Feature | Priority | Competitors That Have It | Implementation Difficulty | Notes |
|---------|----------|--------------------------|---------------------------|-------|
| AI plant identification (camera) | P1 | Planta, PictureThis | High | Take photo, identify species, get care instructions |
| Disease/pest diagnosis (photo) | P1 | Planta, PictureThis | High | Photograph sick plant, get diagnosis and treatment |
| Light level estimation | P1 | Planta, PictureThis | Medium | Use phone camera/sensors to estimate light levels in a room |
| Seasonal care adjustments | P1 | Planta | Medium | Adjust watering and care based on season |
| Plant wish list | P1 | None | Low | Track plants you want to acquire |
| Room/zone organization | P1 | Planta | Medium | Group plants by room or garden zone |

### P2 Features

| Feature | Priority | Competitors That Have It | Implementation Difficulty | Notes |
|---------|----------|--------------------------|---------------------------|-------|
| Harvest tracking | P2 | Unique (already in MyRecipes) | Medium | When to harvest, yield tracking, season planning |
| Garden layout planner | P2 | Unique (already in MyRecipes) | High | Visual plot layout with plant spacing |
| Companion planting guide | P2 | None | Medium | Which plants grow well together |
| Frost date alerts | P2 | None | Medium | Warn when to bring plants inside based on local weather |
| Propagation tracking | P2 | None | Medium | Track cuttings, seeds started, success rates |
| Expert consultation (AI) | P2 | PictureThis | High | AI-powered plant care Q&A (on-device) |
| Monthly care summary | P2 | Planta | Medium | Overview of all plants' needs for the month |

## Recommended MVP Features

Minimal feature set to ship v1:
1. Plant catalog with photo, name, species, location (indoor/outdoor/room), date acquired
2. Watering reminders with smart scheduling based on plant type and season
3. Care schedule for each plant (water, fertilize, prune, repot) with notification reminders
4. Plant journal with dated photo entries to track growth over time
5. Basic plant care database with sunlight, water, humidity, and temperature needs per species
6. SQLite storage with `gd_` table prefix

Design decision needed: If MyRecipes garden tracking is absorbed into MyGarden, the existing harvest tracking and garden layout data should migrate cleanly. The table prefix and data model should account for this from the start.

## Full Feature Roadmap

1. **v1.0 - Core Plant Care** (P0): Plant catalog, watering reminders, care schedule, plant journal, species care database
2. **v1.1 - Smart Features** (P1): AI plant identification via camera, disease/pest diagnosis from photos, light level estimation
3. **v1.2 - Organization** (P1): Seasonal care adjustments, plant wish list, room/zone grouping
4. **v2.0 - Garden Planning** (P2): Harvest tracking (from MyRecipes), garden layout planner (from MyRecipes), companion planting guide
5. **v2.1 - Advanced Care** (P2): Frost date alerts based on local weather, propagation tracking with success rates, AI plant care Q&A
6. **v2.2 - Summaries** (P2): Monthly care summary across all plants

## Privacy Competitive Advantage

Planta and PictureThis both require cloud accounts and process plant photos on their servers. This includes EXIF data from photos, which contains GPS coordinates (revealing home location and layout). PictureThis specifically markets their AI identification as a cloud service, meaning every photo of your home and garden is uploaded and stored on their servers.

MyGarden keeps plant photos and care data fully on-device. AI plant identification could use on-device models (Core ML on iOS, NNAPI on Android) to avoid sending photos to external servers. No cloud account, no EXIF location harvesting, no photo library scanning.

## Cross-Module Integration

| Module | Integration |
|--------|-------------|
| **MyRecipes** | Harvest-to-recipe linking already exists in MyRecipes. MyGarden provides the growing side, MyRecipes provides the cooking side. Shared data model for plants that produce edible harvests. |
| **MyHabits** | Plant care routines as trackable daily habits (watering, checking for pests, fertilizing) |
| **MyBudget** | Gardening expense tracking (plants, soil, pots, tools, seeds) auto-categorized into budget envelopes |
| **MyTrails** | Outdoor plant identification while hiking. Save wild plant sightings with GPS coordinates and photos. |
