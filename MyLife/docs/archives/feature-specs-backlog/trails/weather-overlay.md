# Feature Spec: Weather Overlay

## Metadata
- **Module:** trails
- **Priority Score:** 29 / 50 (B-Tier)
- **Scoring Breakdown:** Market [3] x3 + Switching [3] x3 + Complexity [3] x2 + CrossModule [2] x1 + PaidUser [3] x1
- **Sprint:** 6
- **Estimated CC Time:** 2-3 hours (Complexity Inverse = 3, "Medium")
- **Depends On:** Offline map downloads (V2 migration, map infrastructure)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Checking weather before and during a hike is a safety-critical workflow that hikers currently do in a separate app. AllTrails added weather overlays to their premium tier, displaying current conditions and hourly forecasts directly on the trail map and detail screen. Integrating weather into MyTrails eliminates the need to switch to a weather app, reduces pre-hike friction, and adds a premium-tier value justification. Mountain weather is particularly dangerous because conditions change rapidly with altitude; a sunny trailhead can mean a thunderstorm at the summit 3 hours later.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| AllTrails | Yes | Yes ($26.99-53.99/yr) | Current conditions + 10-day forecast on trail detail page. Hourly breakdown with precipitation probability. Premium-only. |
| Gaia GPS | Yes | Yes ($39.99/yr) | Weather layer on map with animated radar. Forecast at waypoints. Shows wind speed and direction. |
| Komoot | Partial | Free | Basic current temperature shown during navigation. No detailed forecasts or weather layers. |
| Strava | No | N/A | No weather integration. Users check weather separately. |

### Target User
Day hikers (25-55) who check the weather 1-3 times before every outing and want it integrated into their trail planning flow. Mountain hikers concerned about afternoon thunderstorms, winter conditions, or extreme heat. Trail runners who need to know wind and precipitation probability before choosing a route. Users in the western US where fire weather (red flag warnings) can close trails without notice.

## Technical Context

### Where This Lives in MyLife

```
modules/trails/src/
  types.ts                      -- New WeatherForecast, WeatherCondition, HourlyWeather schemas
  db/schema.ts                  -- New tr_weather_cache table (migration V4)
  db/crud.ts                    -- CRUD for weather cache
  definition.ts                 -- Add V4 migration, bump schemaVersion to 4
  index.ts                      -- Export new weather functions and types
  weather/                      -- NEW directory
    weather-service.ts          -- Weather API client (Open-Meteo, free, no API key)
    weather-formatter.ts        -- Human-readable weather strings, icon mapping

apps/mobile/app/(trails)/
  trail-detail.tsx              -- Updated: weather card in trail detail view
  map.tsx                       -- Updated: weather badge overlay on map

apps/web/app/trails/
  page.tsx                      -- Updated: weather panel in trail detail
```

### Wireframe Position

```
Hub Dashboard
  └── MyTrails card
       └── Trails tab
            └── Trail Detail screen
                 └── Weather Card ← current conditions + hourly forecast
       └── Map tab
            └── Weather badge (top-right corner, shows current temp + icon)
```

### Data Model

```sql
-- Migration V4: Weather cache
CREATE TABLE IF NOT EXISTS tr_weather_cache (
  id TEXT PRIMARY KEY NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  conditions_json TEXT NOT NULL,          -- JSON: current conditions + hourly forecast
  fetched_at TEXT NOT NULL,               -- ISO timestamp of last API fetch
  expires_at TEXT NOT NULL,               -- cache valid until (fetched_at + 1 hour)
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tr_weather_cache_location ON tr_weather_cache(lat, lng);
CREATE INDEX IF NOT EXISTS idx_tr_weather_cache_expires ON tr_weather_cache(expires_at);
```

Weather data is cached per lat/lng (rounded to 2 decimal places, ~1.1km precision). Cache TTL is 1 hour. Old entries are cleaned up on each fetch. The `conditions_json` column stores a full JSON payload to avoid many narrow columns and to accommodate future weather fields without schema changes.

### Dependencies
- **Internal:** `@mylife/trails` (trail lat/lng for location, offline regions for map), `@mylife/db` (DatabaseAdapter)
- **External:**
  - Open-Meteo API (free, no API key, 10,000 requests/day): current weather + 48-hour hourly forecast
  - No external dependencies for the engine; weather-service.ts uses `fetch()` directly
- **Cross-Module:** Health module's weather-sensitive workout recommendations could consume trail weather data in a future cross-module integration. Score: 2 (mild benefit).

## Functional Requirements

### User Stories
1. As a hiker planning a trip, I want to see the weather forecast for a trail so that I can decide whether to go and what to pack.
2. As a hiker on the trail, I want to see current conditions on the map so that I can watch for incoming weather changes.
3. As a mountain hiker, I want hourly forecasts showing temperature and precipitation probability so that I can plan my summit timing to avoid afternoon storms.
4. As a trail runner, I want to see wind speed and direction at a glance so that I can choose a sheltered route on windy days.
5. As a privacy-conscious user, I want weather data fetched only when I explicitly open a trail detail, not passively in the background.

### Behavior Specification

**Trail detail weather card:**
1. User opens a trail detail screen
2. System checks weather cache for the trail's lat/lng (rounded to 2 decimal places)
3. If cache hit and not expired (< 1 hour old): display cached data immediately
4. If cache miss or expired: fetch from Open-Meteo API
5. Display weather card showing:
   - Current conditions: temperature, weather description (Sunny, Partly Cloudy, Rain, etc.), humidity, wind speed/direction
   - Hourly forecast: next 12 hours as horizontal scroll, each showing hour, temp, precipitation %, weather icon
   - Sunrise/sunset times
6. Weather card auto-refreshes if user pulls to refresh on the trail detail screen

**Map weather badge:**
1. When the map tab loads, show a small weather badge in the top-right corner
2. Badge shows current temp and weather icon for the map's center point
3. Tapping the badge expands to show a brief 6-hour forecast
4. Badge updates when user pans the map to a new region (debounced, 2-second delay)

**Offline behavior:**
1. If user is offline and cache exists: show cached weather with "Last updated X ago" note
2. If user is offline and no cache: show "Weather unavailable offline" placeholder
3. Weather fetch failures do not affect any other trail functionality

### Edge Cases

- **Stale cache display:** If cache is 1-6 hours old and user is offline, show the stale data with a visible timestamp rather than hiding it entirely. Weather from 3 hours ago is better than no weather.
- **API rate limit:** Open-Meteo allows 10,000 requests/day. With a 1-hour cache per unique location, this is more than sufficient for personal use. If rate-limited (HTTP 429), retry after 60 seconds; if still failing, fall back to cached data.
- **Extreme locations:** Lat/lng near poles or on open ocean will return valid weather data from Open-Meteo but may have less forecast accuracy. No special handling needed.
- **Time zone handling:** Open-Meteo returns hourly forecasts in the location's local time zone. Display times using the trail's local time, not the device's time zone.
- **Module disabled while fetching:** Cancel pending weather fetch. Cache remains for next enable.
- **Multiple trails in same area:** Lat/lng rounding to 2 decimal places means trails within ~1.1km share a cache entry. This is intentional to reduce API calls.
- **No GPS permission:** Weather uses the trail's stored lat/lng, not device GPS. Works regardless of location permissions.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Opening a trail detail screen displays current temperature, conditions, humidity, and wind speed within 3 seconds
- [ ] **AC-2:** Hourly forecast shows next 12 hours with temperature and precipitation probability for each hour
- [ ] **AC-3:** Weather card shows sunrise and sunset times for the trail location
- [ ] **AC-4:** Weather badge on map tab shows current temperature and weather icon
- [ ] **AC-5:** Tapping the map weather badge shows a 6-hour mini-forecast
- [ ] **AC-6:** Pull-to-refresh on trail detail screen refreshes weather data
- [ ] **AC-7:** When offline, cached weather displays with "Last updated X ago" note
- [ ] **AC-8:** When offline with no cache, a "Weather unavailable offline" placeholder is shown (not a crash)
- [ ] **AC-9:** Weather data matches the trail's location, not the user's current location

### Technical Criteria
- [ ] **TC-1:** `tr_weather_cache` table is created by migration V4
- [ ] **TC-2:** Weather cache entries expire after 1 hour and are cleaned up on next fetch
- [ ] **TC-3:** Lat/lng is rounded to 2 decimal places for cache deduplication
- [ ] **TC-4:** Weather fetch failures do not block trail detail screen rendering
- [ ] **TC-5:** Open-Meteo API response is parsed and cached correctly

### Negative Criteria
- [ ] **NC-1:** Weather must NOT be fetched in the background or on module load (only on trail detail open or map badge interaction)
- [ ] **NC-2:** Weather fetch failures must NOT show technical error messages to the user
- [ ] **NC-3:** Weather data must NOT be sent to any server other than Open-Meteo for the forecast request
- [ ] **NC-4:** Weather feature must NOT require GPS permission (uses trail's stored coordinates)

## UI Specification

### Mobile (Expo)

**Trail Detail Weather Card:**
- Glass card (`rgba(255,255,255,0.04)`) below the trail header
- Current conditions row: weather icon (emoji or SF Symbol) + temperature (large, `stat` variant 36px) + description text
- Details row: humidity %, wind speed km/h with direction arrow, UV index
- Horizontal scroll: 12 hourly cells, each 60px wide, showing hour label, weather icon, temp, precip %
- Sunrise/sunset row: sun icons with times
- Module accent: `#65A30D` (lime) for active/highlighted elements
- "Last updated X ago" caption text if showing cached data

**Map Weather Badge:**
- Floating pill in top-right corner of map
- Glass background (`rgba(18,18,26,0.65)`)
- Shows: weather icon + temperature
- Tap expands to a 6-hour mini-forecast row
- Collapse on second tap or after 5 seconds

### Web (Next.js)

- Weather section in the trail detail sidebar panel
- Same data as mobile but in a vertical card layout
- Hourly forecast as a compact row of 12 columns
- No map weather badge on web (web has a wider sidebar for this info)

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton weather card with pulsing bars | Initial weather fetch |
| Empty | "Weather unavailable offline" placeholder | Offline with no cache |
| Error | Card with "Couldn't load weather. Pull to retry." | API error |
| Success | Full weather card with current + hourly forecast | Data fetched or cached |
| Stale | Full weather card + "Last updated 3h ago" caption | Offline with expired cache |

## Test Requirements

### Unit Tests
- [ ] `fetchWeather(lat, lng)`: returns parsed weather data for valid coordinates
- [ ] `fetchWeather(lat, lng)`: handles API error gracefully (returns null)
- [ ] `roundCoordinates(lat, lng)`: rounds to 2 decimal places
- [ ] `isWeatherCacheValid(entry)`: returns true for entries < 1 hour old
- [ ] `isWeatherCacheValid(entry)`: returns false for entries > 1 hour old
- [ ] `formatTemperature(celsius)`: formats correctly for display
- [ ] `formatWindSpeed(kmh, direction)`: includes directional arrow
- [ ] `weatherDescription(code)`: maps WMO weather codes to human descriptions
- [ ] `weatherIcon(code)`: maps WMO weather codes to emoji icons
- [ ] `cacheWeather(db, lat, lng, data)`: persists and retrieves correctly
- [ ] `getCachedWeather(db, lat, lng)`: returns null for expired cache
- [ ] `cleanExpiredCache(db)`: removes entries older than expiry

### Integration Tests
- [ ] Full flow: open trail -> fetch weather -> cache -> close -> reopen -> cache hit
- [ ] Offline flow: cache weather -> go offline -> open trail -> show cached data with timestamp
- [ ] Expiry flow: cache weather -> advance time 2 hours -> open trail -> new fetch triggered

### QA Verification Script
1. Open the app on iOS simulator
2. Navigate to Trails > select a saved trail
3. Verify: weather card loads within 3 seconds showing current temp and conditions -- corresponds to AC-1
4. Scroll horizontally in the hourly forecast
5. Verify: 12 hours shown with temp and precipitation % for each -- corresponds to AC-2
6. Verify: sunrise and sunset times displayed -- corresponds to AC-3
7. Navigate to the Map tab
8. Verify: weather badge appears in top-right with temp and icon -- corresponds to AC-4
9. Tap the weather badge
10. Verify: 6-hour mini-forecast expands -- corresponds to AC-5
11. Go back to trail detail, pull to refresh
12. Verify: weather card refreshes -- corresponds to AC-6
13. Enable airplane mode
14. Open the same trail detail
15. Verify: cached weather shown with "Last updated X ago" -- corresponds to AC-7
16. Open a different trail detail (one never opened before)
17. Verify: "Weather unavailable offline" shown, no crash -- corresponds to AC-8
18. Disable airplane mode, open a trail in a different region
19. Verify: weather data reflects that trail's location, not your current location -- corresponds to AC-9

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to trail detail and map tab, verify all 5 weather states render
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required: Complexity <= 2 (this feature is Complexity 3 = Medium):
- Not required for this complexity level.

### Post-merge:
- [ ] `/parity-check` -- trails module parity
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Trails module has GPS recording, offline map downloads (V2), wrong-turn alerts (V3)
- No weather integration of any kind
- Trail detail screen shows trail info, distance, elevation, difficulty
- Map tab renders with offline tile support
- 7 tables across V1-V3 migrations

### After This Work
- New V4 migration adds `tr_weather_cache` table
- New `weather/` directory with API client and formatter
- Trail detail screen shows weather card with current + hourly forecast
- Map tab shows floating weather badge
- Weather data cached per location with 1-hour TTL

### Files Changed
- `modules/trails/src/types.ts` -- New `WeatherCondition`, `HourlyWeather`, `WeatherForecast` schemas
- `modules/trails/src/db/schema.ts` -- V4 migration SQL for `tr_weather_cache`
- `modules/trails/src/db/crud.ts` -- CRUD for weather cache (get, set, clean expired)
- `modules/trails/src/definition.ts` -- Add V4 migration, bump schemaVersion to 4
- `modules/trails/src/weather/weather-service.ts` -- Open-Meteo API client
- `modules/trails/src/weather/weather-formatter.ts` -- WMO code mapping, temp/wind formatting
- `modules/trails/src/index.ts` -- Export weather functions and types
- `apps/mobile/app/(trails)/trail-detail.tsx` -- Weather card section
- `apps/mobile/app/(trails)/map.tsx` -- Weather badge overlay
- `apps/web/app/trails/page.tsx` -- Weather panel in trail detail

### Known Limitations
- **Open-Meteo only:** V1 uses Open-Meteo (free, no API key). Accuracy may be lower than premium weather services in remote mountain areas. A future enhancement could add optional paid weather sources.
- **No weather alerts/warnings:** V1 shows forecasts only. NWS severe weather alerts (thunderstorm, red flag) are a future enhancement.
- **No animated radar layer:** Gaia GPS shows animated precipitation radar on the map. This is a future enhancement requiring a separate tile layer.
- **Cache is location-based, not trail-based:** Two trails in the same area share weather data. This is intentional (they have the same weather), but the UI shows it per-trail.

### Context for Next Agent
- Open-Meteo API docs: `https://open-meteo.com/en/docs`. Use the `/v1/forecast` endpoint with `current` and `hourly` parameters. No API key needed.
- WMO weather interpretation codes are documented at Open-Meteo. Map codes to human descriptions (0 = Clear sky, 1-3 = Partly cloudy, etc.) and emoji icons.
- The weather cache uses JSON in a TEXT column rather than separate columns. This avoids schema changes when adding fields (feels_like, UV, etc.) later.
- The surf module may eventually want the same weather service for beach conditions. Consider making weather-service.ts reusable or extractable to a shared package later, but do not prematurely abstract it now.
