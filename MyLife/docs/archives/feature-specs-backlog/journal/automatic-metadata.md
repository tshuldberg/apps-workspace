# Feature Spec: Automatic Metadata (Location, Weather)

## Metadata
- **Module:** journal
- **Priority Score:** 31 / 50 (A-Tier)
- **Scoring Breakdown:** Market 3 x3 + Switching 4 x3 + Complexity 2 x2 + CrossModule 2 x1 + PaidUser 4 x1
- **Sprint:** Sprint 5 (S+A Features)
- **Estimated CC Time:** 2-3 hours
- **Depends On:** JR-001 (Rich Text Editor -- implemented)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Day One's auto-metadata (location, weather, music) is cited as the #1 reason users pay $34.99/yr. When you read an entry from 3 years ago and it says "San Francisco, 62F, Partly Cloudy", the memory becomes vivid. Apple Journal (free) adopted the same approach, auto-capturing location context. MyJournal can match this with a privacy-respecting design: location captured via on-device GPS (no transmission), weather via a free API that receives only coordinates (no user identity). Location data stays in local SQLite, never leaves the device beyond the optional weather fetch.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Day One | Yes | $34.99/yr | Auto-captures location, weather, music, step count. Cloud-synced metadata. Premium feature. |
| Apple Journal | Yes | Free | Auto-suggests entries based on location, photos, music via on-device ML. Location metadata on entries. |
| Daylio | No | N/A | No location or weather. Mood + activities only. |
| Diarium | Yes | $5-10 one-time | Location and weather on entries. On-device. |

### Target User
Travel journalers who want entries enriched with where-and-when context, and daily journalers who value the nostalgia of re-reading entries with weather and place data. Primary migration target: Day One users paying $34.99/yr for auto-metadata.

## Technical Context

### Where This Lives in MyLife

```
modules/journal/src/metadata/                   -- NEW: location + weather capture
modules/journal/src/metadata/types.ts           -- EntryMetadata, LocationData, WeatherData types
modules/journal/src/metadata/location.ts        -- Location capture, reverse geocoding
modules/journal/src/metadata/weather.ts         -- Open-Meteo API client
modules/journal/src/metadata/index.ts           -- Barrel export
modules/journal/src/metadata/__tests__/         -- Tests
apps/mobile/app/(journal)/components/MetadataBar.tsx  -- Metadata display in editor
apps/web/app/journal/components/MetadataBar.tsx       -- Web metadata display
```

### Wireframe Position

```
Hub Dashboard
  └── MyJournal card
       └── Today tab -> Entry Editor
            └── Below mood selector, above content area
                 └── Metadata Bar ← YOU ARE HERE (auto-captured)
```

### Data Model

New columns on `jn_entries` in migration V3 (coordinate with voice-to-text migration):

```sql
ALTER TABLE jn_entries ADD COLUMN latitude REAL;
ALTER TABLE jn_entries ADD COLUMN longitude REAL;
ALTER TABLE jn_entries ADD COLUMN place_name TEXT;
ALTER TABLE jn_entries ADD COLUMN timezone TEXT;
ALTER TABLE jn_entries ADD COLUMN weather_temp_c REAL;
ALTER TABLE jn_entries ADD COLUMN weather_description TEXT;
ALTER TABLE jn_entries ADD COLUMN weather_icon TEXT;

CREATE INDEX IF NOT EXISTS jn_entries_location_idx ON jn_entries(latitude, longitude);
```

New settings keys (no migration needed):

```sql
INSERT OR IGNORE INTO jn_settings (key, value) VALUES ('metadataLocationEnabled', 'false');
INSERT OR IGNORE INTO jn_settings (key, value) VALUES ('metadataWeatherEnabled', 'false');
```

### Dependencies
- **Internal:** `@mylife/db`, journal entry CRUD, `getJournalSetting`, `setJournalSetting`
- **External:** `expo-location` (mobile location), Geolocation API (web), Open-Meteo API (weather, free, no API key)
- **Cross-Module:** Location data could feed into `crossModule.getCorrelationData()` for cross-module location analysis

## Functional Requirements

### User Stories
1. As a travel journaler, I want entries to automatically capture my current city and weather so that I have rich context when re-reading years later.
2. As a privacy-conscious user, I want to control whether location and weather are captured, and disable them independently.
3. As a user re-reading old entries, I want to see a map pin and weather icon on each entry so that the context is immediately visible.

### Behavior Specification

1. User enables location and/or weather metadata in Settings.
2. First enable: location permission dialog (foreground-only, not background).
3. User opens the entry editor (new entry or Today tab).
4. **Metadata capture (async, non-blocking):**
   a. Entry editor opens immediately. Metadata bar shows skeleton placeholders.
   b. Location: request current position via `expo-location` (balanced accuracy, 5s timeout).
   c. If location received: reverse geocode to place name (on-device via `expo-location` geocoding).
   d. If weather enabled AND location received: fetch from Open-Meteo API.
      - `GET https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current_weather=true`
      - Parse: temperature, weathercode (mapped to description + icon)
   e. Store timezone from device.
5. Metadata bar populates: pin icon + "San Francisco, CA", weather icon + "18C Partly Cloudy".
6. User can tap "x" on individual metadata items to remove from this entry.
7. Metadata is saved with the entry. Once captured, it is never updated retroactively.
8. In entry reading view: metadata card below content shows location + weather.
9. Tap location in reading view: shows a static map image of the coordinates.

### Edge Cases

- **Location permission denied:** No metadata captured. No error shown. Settings shows "Enable location in device Settings."
- **Location timeout (5s):** Skip silently. Entry created without location.
- **Weather API unavailable/error:** Location captured, weather omitted. No error shown.
- **Airplane mode:** GPS may still work (cached location). Weather skipped.
- **User edits entry from different location:** Original metadata preserved, never overwritten.
- **Very fast entry creation:** Metadata capture is async. If user saves before metadata arrives, save without metadata (it can be captured on next edit... but don't retroactively update).
- **No location hardware (web desktop):** Use browser Geolocation API. If unavailable, skip with tooltip.
- **Open-Meteo weathercode mapping:** Map WMO weather codes (0-99) to descriptions and emoji icons.
- **Metadata disabled:** No metadata bar visible. No permission requests. No network calls.
- **Multiple entries same day:** Each gets its own metadata snapshot (weather may differ morning vs evening).

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Location and weather toggles exist in Settings (both default off for privacy).
- [ ] **AC-2:** Enabling location triggers system permission dialog on first use.
- [ ] **AC-3:** New entry shows metadata bar with skeleton while capturing.
- [ ] **AC-4:** Metadata bar shows pin icon + place name when location captured.
- [ ] **AC-5:** Metadata bar shows weather icon + temperature when weather captured.
- [ ] **AC-6:** Tapping "x" on a metadata item removes it from this entry only.
- [ ] **AC-7:** Entry reading view shows location and weather in a metadata card.
- [ ] **AC-8:** Metadata is captured once on entry creation and never updated retroactively.
- [ ] **AC-9:** Entry editor opens immediately (metadata capture is non-blocking).
- [ ] **AC-10:** No metadata captured or UI shown when both toggles are off.
- [ ] **AC-11:** Weather API only receives coordinates (no user identity).
- [ ] **AC-12:** Tapping location in reading view shows map preview.

### Technical Criteria
- [ ] **TC-1:** Migration V3 adds 7 metadata columns to `jn_entries` with location index.
- [ ] **TC-2:** Location uses balanced accuracy (not GPS-precise) to conserve battery.
- [ ] **TC-3:** Location request times out after 5 seconds and fails silently.
- [ ] **TC-4:** Weather fetched from Open-Meteo API with only lat/lon parameters (no API key, no user ID).
- [ ] **TC-5:** WMO weather codes mapped to human-readable descriptions and icon identifiers.
- [ ] **TC-6:** Reverse geocoding uses on-device `expo-location` geocoding (no external API).
- [ ] **TC-7:** Metadata settings stored in `jn_settings` using existing settings infrastructure.

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Location coordinates must NEVER be transmitted beyond the Open-Meteo weather API call.
- [ ] **NC-2:** The weather API request must NOT include any user identity, device ID, or metadata.
- [ ] **NC-3:** Editing an existing entry must NOT overwrite the original metadata.
- [ ] **NC-4:** Metadata capture must NOT block or delay the entry editor opening.
- [ ] **NC-5:** Background location tracking must NEVER be requested. Foreground-only permission.

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Metadata bar: compact single row below mood selector, glass card style
- Pin icon: `#A78BFA` (accent), 16px. Place name in `#F0F0F5`, 14px.
- Weather icon: emoji mapped from WMO code (e.g., sun, cloud, rain), 16px. Temperature + description in `#F0F0F5`, 14px.
- "x" remove buttons: small, textSecondary color, on each metadata item
- Skeleton state: subtle pulse animation on placeholder bars
- Reading view metadata card: glass card at bottom of entry, pin + location, weather icon + temp/description
- Map preview: static map image (Mapbox Static API or similar) centered on coordinates, 16:9 aspect, rounded corners
- Module accent: `#A78BFA`

### Web (Next.js)

- Same metadata bar in entry editor
- Uses browser Geolocation API for location
- Map preview via embedded `<iframe>` or static image

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Disabled | No metadata bar | Both toggles off in Settings |
| Capturing | Skeleton placeholders with pulse | Entry opened, metadata being fetched |
| Complete | Location + weather displayed | Both captured successfully |
| Partial | Location only (weather failed) or vice versa | One source failed |
| Permission Denied | No metadata bar, no error | Location permission denied |
| Offline | Location only (GPS), no weather | No network connectivity |

## Test Requirements

### Unit Tests
- [ ] `parseWeatherResponse`: valid Open-Meteo JSON -> temp, description, icon extracted
- [ ] `mapWeatherCode`: WMO code 0 -> "Clear sky", code 61 -> "Light rain", code 95 -> "Thunderstorm"
- [ ] `reverseGeocode`: coordinates (37.7749, -122.4194) -> "San Francisco, CA, US" (mocked)
- [ ] `handleLocationTimeout`: 5s elapsed, no coords -> fields remain null
- [ ] `handleWeatherApiError`: HTTP 500 -> weather fields null, location preserved
- [ ] `validateCoordinates`: latitude 91 -> rejected, latitude 37.7 -> accepted
- [ ] `preserveOriginalMetadata`: update entry body -> metadata columns unchanged
- [ ] `metadataDisabled`: both toggles off -> no location request, no API call

### Integration Tests
- [ ] Full flow: enable both -> create entry -> location + weather captured -> save -> re-open -> metadata visible
- [ ] Location only: enable location, disable weather -> create entry -> location captured, no weather API call

### QA Verification Script

1. Open the app on mobile
2. Navigate to MyJournal > Settings
3. Verify: "Location metadata" and "Weather metadata" toggles, both off -- corresponds to AC-1
4. Enable "Location metadata"
5. Verify: location permission dialog appears -- corresponds to AC-2
6. Grant permission, also enable "Weather metadata"
7. Navigate to Today tab, open entry editor
8. Verify: metadata bar shows skeleton placeholders -- corresponds to AC-3
9. Wait up to 5 seconds
10. Verify: pin icon + city name appears -- corresponds to AC-4
11. Verify: weather icon + temperature appears -- corresponds to AC-5
12. Tap "x" on weather item
13. Verify: weather removed, location remains -- corresponds to AC-6
14. Save the entry
15. Open the entry in reading view
16. Verify: metadata card shows location and weather -- corresponds to AC-7
17. Edit the entry text
18. Verify: metadata is unchanged -- corresponds to AC-8, NC-3
19. Go to Settings, disable both toggles
20. Create a new entry
21. Verify: no metadata bar visible -- corresponds to AC-10
22. Tap location in reading view of the earlier entry
23. Verify: map preview shown -- corresponds to AC-12

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to journal entry editor, verify metadata capture flow

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
Journal entries have no contextual metadata beyond date, mood, and tags. No location or weather capture exists.

### After This Work
Seven metadata columns on `jn_entries` store location coordinates, place name, timezone, and weather. A `metadata/` directory handles async capture on entry creation. Settings toggles control location and weather independently. Reading view shows metadata with map preview.

### Files Changed
- `modules/journal/src/db/schema.ts` -- add ALTER TABLE for 7 metadata columns, location index
- `modules/journal/src/definition.ts` -- add metadata columns to JOURNAL_MIGRATION_V3
- `modules/journal/src/metadata/types.ts` -- EntryMetadata, LocationData, WeatherData, WeatherCode types
- `modules/journal/src/metadata/location.ts` -- captureLocation, reverseGeocode
- `modules/journal/src/metadata/weather.ts` -- fetchWeather, mapWeatherCode (WMO code -> description/icon)
- `modules/journal/src/metadata/index.ts` -- barrel export + captureEntryMetadata orchestrator
- `modules/journal/src/metadata/__tests__/weather.test.ts` -- weather parsing and code mapping tests
- `modules/journal/src/metadata/__tests__/location.test.ts` -- location capture and validation tests
- `modules/journal/src/types.ts` -- extend JournalEntrySchema with metadata fields
- `modules/journal/src/index.ts` -- re-export metadata module
- `apps/mobile/app/(journal)/components/MetadataBar.tsx` -- metadata display in editor
- `apps/web/app/journal/components/MetadataBar.tsx` -- web metadata display

### Known Limitations
- Weather is a point-in-time snapshot. No hourly or daily forecast.
- Map preview requires a static map API or embedded map (adds dependency).
- No music metadata capture (Day One feature, deferred).
- Reverse geocoding precision depends on device and locale.

### Context for Next Agent
- Open-Meteo API is free, requires no API key, and has no rate limits. URL: `https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current_weather=true`. Response contains `current_weather.temperature`, `current_weather.weathercode`.
- WMO weather codes: 0=Clear, 1-3=Clouds, 45-48=Fog, 51-55=Drizzle, 61-65=Rain, 71-75=Snow, 80-82=Showers, 95-99=Thunderstorm. Map each to a description string and emoji icon.
- For `expo-location`, use `Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })` with a 5s timeout.
- For reverse geocoding, use `Location.reverseGeocodeAsync({ latitude, longitude })` which returns city, region, country.
- Migration V3 coordination: if voice-to-text also adds V3 columns, combine both into a single V3 migration.
- Settings use existing `jn_settings` key-value table. Default both `metadataLocationEnabled` and `metadataWeatherEnabled` to `'false'` (opt-in for privacy).
