# Feature Spec: RSVP Map/Directions

## Metadata
- **Module:** rsvp
- **Priority Score:** 27 / 50 (B-Tier)
- **Scoring Breakdown:** Market 3 x3 + Switching 3 x3 + Complexity 3 x2 + CrossModule 1 x1 + PaidUser 2 x1
- **Sprint:** Sprint 3
- **Estimated CC Time:** 3-4 hours
- **Depends On:** Event creation (built -- rv_events has location_name, location_address)
- **Blocks:** none

## Business Context

### Why This Feature Exists
When a guest RSVPs "going", the next action is always "how do I get there?" Currently guests must copy the address from the event page and paste it into Google Maps or Apple Maps manually. Partiful and Evite both embed interactive maps directly on the event page with one-tap navigation. This is table stakes for any event platform -- without it, guests fumble with addresses and arrive late or at the wrong place.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Partiful | Yes | Free | Embedded Google Maps on event page, "Get Directions" button opens native maps |
| Evite | Yes | Free | Static map thumbnail + "Get Directions" link |
| RSVPify | Yes | Free | Google Maps embed on event page |
| Google Calendar | Yes | Free | Maps link in event details |

### Target User
Event guests who need to navigate to the venue. Also hosts who want guests to find the right location without follow-up "where is it?" texts. Particularly valuable for events at non-standard locations (someone's house, a park pavilion, a specific restaurant entrance) where a map pin is worth more than a text address.

## Technical Context

### Where This Lives in MyLife

```
modules/rsvp/src/engines/location.ts          -- Pure functions: geocoding prep, maps URL builders
modules/rsvp/src/types.ts                     -- LocationCoordinates, MapsProvider types
modules/rsvp/src/db/crud.ts                   -- Add lat/lng tracking to events (V3)
modules/rsvp/src/db/schema.ts                 -- V3 migration: lat/lng columns on rv_events
modules/rsvp/src/definition.ts                -- Add to RSVP_MIGRATION_V3
modules/rsvp/src/index.ts                     -- Re-export location API
modules/rsvp/src/__tests__/location.test.ts   -- Maps URL and coordinate tests
apps/mobile/app/(rsvp)/components/EventMap.tsx          -- Mobile static map + directions button
apps/web/app/rsvp/[eventId]/components/EventMap.tsx     -- Web interactive map
```

### Wireframe Position

```
Hub Dashboard
  └── MyRSVP card
       └── Events tab
            └── Event Detail
                 └── Location section
                      └── Map card + "Get Directions" ← YOU ARE HERE
```

### Data Model

```sql
-- V3 Migration: Add coordinate tracking for map display
ALTER TABLE rv_events ADD COLUMN location_lat REAL;
ALTER TABLE rv_events ADD COLUMN location_lng REAL;
```

No new tables. Latitude and longitude are stored on the event for map display without re-geocoding. Coordinates are populated when the host enters an address (via device geocoding API) or manually via map pin placement.

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter), `@mylife/ui` (map components, Cool Obsidian tokens)
- **External:** `expo-location` (geocoding on mobile), `react-native-maps` or static map image API (map display). No paid API keys required for basic geocoding or static maps.
- **Cross-Module:** MyTrails -- if both modules are enabled, "Get Directions" could offer a hiking trail route option. Low priority, not required for this feature.

## Functional Requirements

### User Stories
1. As a guest, I want to see a map of the event location on the event detail page so I know where to go.
2. As a guest, I want a "Get Directions" button that opens my preferred maps app with the destination pre-filled.
3. As a host, I want to pin the exact location on a map when creating an event so guests go to the right spot.
4. As a host, I want the system to auto-geocode the address I enter so the map shows up automatically.

### Behavior Specification

**Host sets location:**
1. Host creates or edits an event
2. Host enters location_name and/or location_address in the form
3. On address blur (mobile) or on save (web), system attempts geocoding via device API
4. If geocoding succeeds: store lat/lng, show map preview with pin in the form
5. If geocoding fails: show the address text only, no map (graceful degradation)
6. Host can optionally tap the map preview to adjust pin position (drag to exact spot)
7. Adjusted coordinates override geocoded ones

**Guest views map:**
1. Guest opens event detail
2. If lat/lng exist: a map card appears below the location address showing a pin
3. Map card shows: static map image (mobile) or interactive embed (web) at zoom level 15
4. Below the map: "Get Directions" button with car icon
5. If lat/lng do not exist but location_address does: show address text with "Open in Maps" link
6. If no location data at all: no map section shown

**"Get Directions" button:**
1. Guest taps "Get Directions"
2. On iOS: opens Apple Maps with the destination coordinates
3. On Android: opens Google Maps with the destination coordinates
4. On web: opens Google Maps in a new tab with the destination
5. URL format:
   - Apple Maps: `maps://maps.apple.com/?daddr={lat},{lng}`
   - Google Maps: `https://www.google.com/maps/dir/?api=1&destination={lat},{lng}`
   - Fallback (address only): `https://www.google.com/maps/search/?api=1&query={encoded_address}`

### Edge Cases
- **No address entered:** Map section not shown. No geocoding attempted.
- **Address entered but geocoding fails:** Show address text + "Open in Maps" link using address search URL. No map image.
- **Coordinates but no address:** Show map with pin. "Get Directions" uses coordinates. Address section shows "Location pinned on map".
- **Very long address (>200 chars):** Truncate display to 2 lines with ellipsis. Full address in URL.
- **Event with updated address:** Re-geocode on save. Update lat/lng. Old coordinates replaced.
- **No network for geocoding (offline):** Skip geocoding. Host can manually place pin on map if map tiles are cached.
- **Location is "Virtual" or "Online":** Detect keywords "zoom", "virtual", "online", "video call" in location_name. Skip map display, show link icon instead.
- **Multiple events at same location:** Each event stores its own coordinates. No deduplication needed.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Map card with pin appears on event detail when lat/lng exist
- [ ] **AC-2:** "Get Directions" button opens native maps app with correct destination
- [ ] **AC-3:** Address auto-geocodes to coordinates when host saves event
- [ ] **AC-4:** Host can adjust pin position by tapping map in event form
- [ ] **AC-5:** Fallback: address-only events show "Open in Maps" text link
- [ ] **AC-6:** No map section shown when event has no location data
- [ ] **AC-7:** Virtual/online events show link icon instead of map

### Technical Criteria
- [ ] **TC-1:** V3 migration adds location_lat and location_lng REAL columns to rv_events
- [ ] **TC-2:** `buildAppleMapsUrl()` generates correct `maps://` URL with coordinates
- [ ] **TC-3:** `buildGoogleMapsUrl()` generates correct `google.com/maps/dir/` URL
- [ ] **TC-4:** `buildMapsSearchUrl()` generates fallback URL with encoded address
- [ ] **TC-5:** Geocoding failure does not crash event creation or display
- [ ] **TC-6:** Coordinates stored as REAL (not TEXT) for proper numeric comparison

### Negative Criteria
- [ ] **NC-1:** Map feature must NOT require a paid API key for basic functionality
- [ ] **NC-2:** Geocoding failure must NOT block event creation
- [ ] **NC-3:** Map must NOT display for events with no location data
- [ ] **NC-4:** Directions must NOT send location data to any third party beyond the maps app

## UI Specification

### Mobile (Expo)
- **Map card:** 200px height, glass card border `rgba(255,255,255,0.10)`, rounded `xl` (16px)
- **Map content:** Static map image or MapView at zoom 15, single pin at event coordinates
- **Pin color:** Module accent `#FB7185`
- **"Get Directions" button:** Full width below map, glass background with car icon (Feather: `navigation`), accent color text
- **Address text:** Below map card, `#F0F0F5` primary text, `rgba(240,240,245,0.65)` secondary

### Web (Next.js)
- **Map embed:** 300px height interactive map (Leaflet or static Google Maps image)
- **"Get Directions" link:** Opens Google Maps in new tab
- Same glass card tokens via CSS variables

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Map with Pin | Static/interactive map + "Get Directions" button | lat/lng exist |
| Address Only | Address text + "Open in Maps" link | Address exists but no lat/lng |
| Virtual Event | Link icon + "Online Event" label | location_name contains virtual keywords |
| No Location | No map section rendered | No location data on event |
| Geocoding | Brief loading shimmer on map area | Address being geocoded |

## Test Requirements

### Unit Tests (engines/location.ts)
- [ ] `buildAppleMapsUrl`: generates correct URL with lat/lng
- [ ] `buildGoogleMapsUrl`: generates correct URL with lat/lng
- [ ] `buildMapsSearchUrl`: URL-encodes address correctly
- [ ] `buildMapsSearchUrl`: handles special characters in address
- [ ] `isVirtualLocation`: detects "zoom", "virtual", "online", "video call"
- [ ] `isVirtualLocation`: returns false for normal addresses
- [ ] `buildDirectionsUrl`: returns Apple Maps URL on iOS platform
- [ ] `buildDirectionsUrl`: returns Google Maps URL on Android/web platform
- [ ] `buildDirectionsUrl`: falls back to search URL when no coordinates

### Integration Tests
- [ ] Create event with address -> verify lat/lng stored after geocoding
- [ ] Create event without address -> verify lat/lng are null
- [ ] Update event address -> verify lat/lng updated
- [ ] V3 migration runs cleanly on existing V2 database

### QA Verification Script

1. Open MyRSVP, create event with address "123 Main St, San Francisco, CA"
2. **Verify:** Map preview appears in form with pin -- AC-3
3. Save event, navigate to event detail
4. **Verify:** Map card with pin visible -- AC-1
5. Tap "Get Directions"
6. **Verify:** Native maps app opens with correct destination -- AC-2
7. Create event with location "Zoom Meeting"
8. **Verify:** No map shown, link icon displayed -- AC-7
9. Create event with no location
10. **Verify:** No map section visible -- AC-6
11. Create event with address that fails geocoding (e.g., "The Secret Spot")
12. **Verify:** Address text shown with "Open in Maps" link, no map image -- AC-5

## gstack Quality Gates

Based on Complexity Inverse score of 3 (Medium):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to event detail with location, verify map display and directions

### Post-merge:
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- rv_events has location_name and location_address text fields
- No coordinates stored, no map display, no directions integration
- Hosts enter addresses as freeform text with no validation

### After This Work
- V3 migration adds location_lat, location_lng to rv_events
- Pure engine: `buildAppleMapsUrl()`, `buildGoogleMapsUrl()`, `buildMapsSearchUrl()`, `buildDirectionsUrl()`, `isVirtualLocation()`
- Geocoding integration via expo-location on mobile
- Map card component for mobile and web
- "Get Directions" button opening native maps apps
- 9+ unit tests, 4+ integration tests

### Files Changed
- `modules/rsvp/src/db/schema.ts` -- V3 migration: lat/lng columns
- `modules/rsvp/src/definition.ts` -- Add to RSVP_MIGRATION_V3
- `modules/rsvp/src/types.ts` -- LocationCoordinates type
- `modules/rsvp/src/engines/location.ts` -- Maps URL builders, virtual detection
- `modules/rsvp/src/db/crud.ts` -- lat/lng read/write on events
- `modules/rsvp/src/index.ts` -- Re-export location API
- `modules/rsvp/src/__tests__/location.test.ts` -- URL generation and edge case tests
- `apps/mobile/app/(rsvp)/components/EventMap.tsx` -- Mobile map card
- `apps/web/app/rsvp/[eventId]/components/EventMap.tsx` -- Web map embed

### Known Limitations
- No turn-by-turn navigation within the app (relies on native maps apps)
- No travel time estimation (would require a paid Directions API)
- No offline map support (map display requires network)
- Geocoding accuracy depends on address format and device API availability
- No map tile provider bundled (uses native MapView on mobile, Leaflet with OSM tiles on web)

### Context for Next Agent
- V3 migration is shared with recurring events. Both features' DDL should be combined into a single RSVP_MIGRATION_V3 if built in the same sprint. If recurring events are built first, add the lat/lng ALTERs to the existing V3. If this feature is built first, the V3 migration should only contain the lat/lng ALTERs.
- `expo-location` provides `geocodeAsync(address)` which returns `{ latitude, longitude }[]`. Use the first result. Falls back gracefully when no results found.
- For the static map image on mobile, consider using a free tile server URL like `https://a.tile.openstreetmap.org/{z}/{x}/{y}.png` rendered in a MapView component, or a simple static image from a free provider.
- The `isVirtualLocation()` function should check `location_name.toLowerCase()` against a keyword list. Keep it simple -- no NLP needed. Just substring matching for "zoom", "virtual", "online", "video call", "teams", "meet", "webex".
- The `buildDirectionsUrl()` function should accept a `platform` parameter ('ios' | 'android' | 'web') and return the appropriate maps URL. On mobile, use `Linking.openURL()`. On web, use `window.open()`.
