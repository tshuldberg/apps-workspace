# MyTrails - Feature Gap Design Doc
**Source:** Competitive Feature Analysis (2026-03-05)
**Status:** Stub (navigation only)

## Current State
Stub module with navigation scaffolding only. No business logic, no database tables, no screens implemented.

## Competitors Analyzed

| Competitor | Pricing | Focus |
|-----------|---------|-------|
| AllTrails | $36-80/yr | Trail discovery, GPS recording, offline maps, community reviews |
| Komoot | $60/yr | Route planning, turn-by-turn navigation, sport-specific routing |
| Wanderlog | $80/yr | Trip planning with itineraries, bookings, collaborative travel |
| TripIt | $49/yr | Automatic travel itinerary from email confirmations |
| PackPoint | $3 (one-time) | Weather-based packing list generator for trips |

## Feature Gaps (Full Build Required)

| Feature | Priority | Competitors That Have It | Implementation Difficulty | Notes |
|---------|----------|--------------------------|--------------------------|-------|
| GPS trail recording | P0 | AllTrails, Komoot | High | Record route with map, distance, elevation, pace. Background GPS on mobile |
| Offline map downloads | P0 | AllTrails, Komoot | High | Download map tiles for areas without cell service. Use OpenStreetMap or Mapbox offline |
| Trail history log | P0 | AllTrails | Low | List of past hikes/rides with stats, date, and route preview |
| Route display on map | P0 | AllTrails, Komoot | Medium | Render recorded or planned routes on interactive map |
| Basic stats (distance, elevation gain, time, pace) | P0 | AllTrails, Komoot | Medium | Calculate from GPS data. Show during and after activity |
| Trail database integration | P1 | AllTrails (400K+ trails) | High | Start with curated local trails or integrate OpenStreetMap trail data |
| Wrong-turn alerts | P1 | AllTrails | Medium | Vibrate/alert when user goes off planned trail route |
| Turn-by-turn navigation | P1 | Komoot | High | Voice-guided directions on trail. Requires routing engine |
| Route planning/builder | P1 | Komoot | High | Plan routes before heading out. Drag waypoints on map |
| Offline trail guides | P1 | AllTrails | Medium | Trail descriptions, difficulty ratings, photos available offline |
| Live location sharing | P1 | AllTrails, Komoot | Medium | Share real-time location with emergency contact. Critical safety feature |
| Trip itinerary builder | P1 | Wanderlog, TripIt | Medium | Plan multi-day trips with accommodations, activities, transport legs |
| Weather overlay | P1 | AllTrails | Medium | Show forecast for trail location and time of planned activity |
| Auto-import bookings from email | P2 | Wanderlog, TripIt | High | Parse confirmation emails for flights, hotels, restaurants. Requires mail access |
| Weather-based packing list | P2 | PackPoint | Medium | Generate packing checklist based on destination weather and activities |
| Activity-based packing templates | P2 | PackPoint | Low | Hiking, camping, skiing, beach trip templates with customization |
| Plant/tree identification | P2 | AllTrails | High | Camera-based plant ID on trail. Requires ML model or API |
| Trip budgeting | P2 | Wanderlog | Medium | Track spending during trips with categories and daily totals |
| Community trail reviews | P2 | AllTrails, Komoot | High | Crowd-sourced trail conditions and reviews. Opt-in only |
| Photo geotagging on trail | P2 | AllTrails | Low | Auto-tag photos with trail location and display on route map |
| Trail difficulty rating | P2 | AllTrails | Low | Rate trails after completion based on personal experience |
| Segment tracking (fastest times) | P2 | Strava | Medium | Personal bests on trail segments. Compare your own historical performance |

## Recommended MVP Features

Minimal feature set to ship v1 of MyTrails:

1. **GPS trail recording** - Background GPS tracking with map display during activity
2. **Offline map downloads** - Download map regions for cell-dead zones (OpenStreetMap tiles)
3. **Trail history log** - Chronological list of all recorded activities with stats
4. **Route display** - Render recorded routes on interactive map with elevation profile
5. **Basic stats** - Distance, elevation gain/loss, time, average pace, max pace
6. **Live location sharing** - Share real-time position with a trusted contact (safety)
7. **Photo geotagging** - Take photos during activity, auto-pin to route location

This MVP covers the core AllTrails use case (record and review outdoor activities) with privacy and safety features built in from day one.

## Full Feature Roadmap

1. **v1.0 (MVP)** - GPS recording, offline maps, trail history, route display, stats, live sharing, photo tagging
2. **v1.1** - Weather overlay, wrong-turn alerts, trail difficulty rating
3. **v1.2** - Route planning/builder, turn-by-turn navigation
4. **v1.3** - Trip itinerary builder, activity-based packing templates, weather-based packing lists
5. **v2.0** - Trail database integration (OpenStreetMap), offline trail guides
6. **v2.1** - Auto-import bookings from email, trip budgeting
7. **v2.2** - Segment tracking (personal bests), plant/tree identification
8. **v3.0** - Community trail reviews and conditions (opt-in P2P)

## Privacy Competitive Advantage

Outdoor activity tracking is a high-sensitivity privacy category. GPS data reveals where you live, work, exercise, and travel:

- **AllTrails** shares user location data for targeted advertising. Trail activity reveals home address (start/end points), daily routines, and travel patterns.
- **Strava** infamously exposed military base locations and world leaders' security team movements through its global heatmap (2018 incident, similar exposure in 2025).
- **TripIt** and **Wanderlog** store complete travel itineraries in the cloud, including flight numbers, hotel addresses, and schedules.
- **Komoot** shares activity data with third-party analytics providers.

MyTrails' positioning: **Your GPS data never leaves your device.** No heatmaps, no social feeds, no cloud upload of location history. Live location sharing is explicit, temporary, and direct to a chosen contact (not stored on a server). For users who value both outdoor adventure and personal security, this is a clear differentiator.

## Cross-Module Integration

| Module | Integration Point |
|--------|------------------|
| MyWorkouts | Outdoor workouts (hiking, running, cycling) share GPS and fitness data. Trail activity counts as exercise |
| MyHealth | Outdoor activity duration and frequency contribute to wellness metrics |
| MyHabits | Weekly outdoor activity tracked as a habit goal |
| MyBudget | Trip expense tracking. Link spending to specific trips or trail outings |
| MyRecipes | Meal planning for camping trips and multi-day hikes |
| MyCloset | Activity-appropriate clothing suggestions for weather and trail conditions |
