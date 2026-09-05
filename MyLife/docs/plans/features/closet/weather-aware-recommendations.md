# Feature Spec: Weather-Aware Recommendations

## Metadata
- **Module:** closet
- **Priority Score:** 24 / 50 (B-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 3 x3 + Complexity 2 x2 + CrossModule 2 x1 + PaidUser 3 x1
- **Sprint:** 2
- **Estimated CC Time:** 45 min
- **Depends On:** none
- **Blocks:** AI outfit suggestions (can use weather context)

## Business Context

### Why This Feature Exists
Deciding what to wear based on today's weather is the #1 daily friction point for closet app users. Clueless charges $69/yr and makes this their core feature. By combining the user's actual wardrobe inventory with real-time weather data, MyCloset can suggest outfits that are both weather-appropriate and drawn from items the user actually owns. This is a premium differentiator that justifies the paid tier.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Clueless | Yes | $69/yr | Real-time weather + closet integration, daily outfit push notifications |
| Indyx | No | N/A | Has styling tips but no weather integration |
| Stylebook | No | N/A | No weather features |
| Alta | Partial | Free | AI suggests outfits but doesn't use real-time weather |

### Target User
Daily users who open their closet app every morning to decide what to wear. Users in climates with variable weather who need different outfit strategies for 40F vs 80F days. Users migrating from Clueless who expect weather-based suggestions.

## Technical Context

### Where This Lives in MyLife

```
modules/closet/src/engine/weather.ts     -- NEW: Weather recommendation engine
modules/closet/src/types.ts              -- Add WeatherCondition, WeatherOutfitRecommendation types
modules/closet/src/db/crud.ts            -- Add getWeatherRecommendations() orchestrator
apps/mobile/app/(closet)/wardrobe.tsx    -- Add "Today's Weather" card at top
apps/mobile/components/closet/WeatherCard.tsx -- NEW: Weather + outfit suggestion card
apps/web/app/closet/page.tsx             -- Web weather card
```

### Wireframe Position

```
Hub Dashboard
  └── MyCloset card
       └── Wardrobe tab
            ├── Weather Card (top)  ← YOU ARE HERE
            │    ├── Current temp + condition
            │    ├── "Perfect for:" item suggestions
            │    └── Quick outfit builder link
            └── Item grid (existing)
```

### Data Model
No new permanent tables. Weather data is ephemeral and cached in memory or a transient cache table.

```sql
-- Optional: lightweight weather cache (V3 migration if needed, otherwise in-memory)
CREATE TABLE IF NOT EXISTS cl_weather_cache (
  id TEXT PRIMARY KEY,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  temperature_f REAL NOT NULL,
  condition TEXT NOT NULL,
  humidity INTEGER,
  wind_speed_mph REAL,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
```

The recommendation engine is purely logic-based: given weather conditions + wardrobe items, score and rank items. The engine function is pure (weather in, items in, recommendations out).

**Temperature-to-category mapping (core logic):**

| Temp Range (F) | Recommended Categories | Layer Strategy |
|---|---|---|
| < 32 | outerwear, sweaters, boots | Heavy layers, 3+ layers |
| 32-50 | outerwear, long sleeves, boots | Medium layers, 2-3 layers |
| 50-65 | light jackets, long sleeves, closed shoes | Light layers, 1-2 layers |
| 65-80 | t-shirts, shorts, sneakers | Single layer |
| > 80 | tank tops, shorts, sandals | Minimal, breathable |

### Dependencies
- **Internal:** `@mylife/closet` (item data), `@mylife/ui`
- **External:** Weather API -- use the device's native weather/location. On mobile: `expo-location` for coordinates + Open-Meteo API (free, no key required) for weather. On web: browser Geolocation API + same Open-Meteo API.
- **Cross-Module:** None currently. Future: calendar module could show weather for event days.

## Functional Requirements

### User Stories
1. As a closet user, I want to see today's weather with outfit suggestions when I open my wardrobe so I can dress appropriately.
2. As a user in variable weather, I want layering recommendations so I can prepare for temperature changes throughout the day.
3. As a user who has logged seasons on my items, I want weather suggestions to use my season tags so the right items surface.
4. As a privacy-conscious user, I want location to be opt-in and only used for weather, with the option to set a manual city.

### Behavior Specification

1. User opens Wardrobe tab
2. If location permission granted (or manual city set):
   a. Weather card appears at top showing: current temp, condition icon (sunny/cloudy/rain/snow), high/low for the day
   b. Below weather: "Today's Picks" -- 3-5 item suggestions from user's wardrobe, scored by weather match + season + recent wear + clean status
   c. Each suggestion shows item thumbnail, name, category, and a match reason ("Great for 72F and sunny")
   d. "Build Outfit" button opens outfit creator pre-filtered to weather-appropriate items
3. If location not granted and no manual city:
   a. Weather card shows "Enable location or set your city to get weather-based outfit suggestions"
   b. Tapping opens settings with location permission prompt or manual city entry
4. Weather refreshes every 30 minutes while app is foregrounded (cached)
5. User can pull-to-refresh to force weather update
6. Settings section: Location toggle (device/manual), manual city entry (autocomplete), temperature unit (F/C)

### Edge Cases
- Location permission denied: show opt-in card with rationale, offer manual city fallback
- No internet connection: show last cached weather with "Last updated X ago" label, still show suggestions from cache
- Empty wardrobe: show weather only, no item suggestions
- All items are one category: show what's available + "You might want to add some [missing category] items"
- Extreme weather (< 0F or > 110F): show safety-oriented suggestions ("Stay warm!" / "Stay hydrated!")
- Overnight temperature swings: show both current temp and "later today" with adjusted suggestions
- User has no seasonal tags on items: fall back to category-only matching (outerwear for cold, etc.)
- API rate limit or failure: gracefully degrade to "Weather unavailable" with last cache
- Manual city set but no coordinates: geocode city name via Open-Meteo geocoding endpoint

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Weather card appears at top of Wardrobe tab when location is available
- [ ] **AC-2:** Weather card shows current temperature, condition icon, and high/low
- [ ] **AC-3:** "Today's Picks" shows 3-5 wardrobe items scored by weather appropriateness
- [ ] **AC-4:** Each suggestion shows item thumbnail, name, and match reason text
- [ ] **AC-5:** "Build Outfit" button navigates to outfit creator pre-filtered to weather-matching items
- [ ] **AC-6:** Location opt-in card shown when permission not granted
- [ ] **AC-7:** Manual city entry available in settings as alternative to device location
- [ ] **AC-8:** Temperature unit toggle (F/C) in settings affects all displays
- [ ] **AC-9:** Weather auto-refreshes every 30 minutes
- [ ] **AC-10:** Pull-to-refresh forces weather update

### Technical Criteria
- [ ] **TC-1:** Weather engine function is pure: `recommendForWeather(items, weather) -> WeatherRecommendation[]`
- [ ] **TC-2:** Open-Meteo API called with lat/lon, returns temp, condition, humidity, wind
- [ ] **TC-3:** Weather cache expires after 30 minutes, stale cache used when offline
- [ ] **TC-4:** Recommendation scoring considers: temperature match, season tags, clean status, recent wear frequency
- [ ] **TC-5:** Engine handles all temperature ranges without errors (tested from -20F to 120F)
- [ ] **TC-6:** Location coordinates are stored only locally in cl_settings, never sent to any analytics

### Negative Criteria
- [ ] **NC-1:** Location must NOT be used without explicit user permission
- [ ] **NC-2:** Weather API calls must NOT include any user-identifiable information
- [ ] **NC-3:** Feature must NOT block app usage if weather API is down -- graceful degradation
- [ ] **NC-4:** Dirty items must NOT appear as primary suggestions (may appear as fallback if wardrobe is very small)

## UI Specification

### Mobile (Expo)
- Background: `#0A0A0F`
- Weather card: glass card with gradient overlay based on condition (warm amber for sunny, cool blue for cold, gray for cloudy)
- Temperature: large accent-colored number `#E879A8`
- Condition icon: emoji or SF Symbol-style icon
- Item suggestion pills: horizontal scroll, glass background, 48x48 thumbnail, name below
- "Build Outfit" button: accent border, glass fill

### Web (Next.js)
- Weather card as hero section at top of closet dashboard
- Item suggestions in a horizontal card row
- Same tokens via CSS variables

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Weather skeleton card with pulsing placeholder | Initial location/weather fetch |
| Empty | "Enable location for weather suggestions" + CTA | No location permission |
| Error | "Weather unavailable" with last cached data or plain empty | API failure, no cache |
| Success | Full weather card + item suggestions | Location + weather + items available |
| Partial | Weather card + "Add more items for better suggestions" | Weather available but few items |

## Test Requirements

### Unit Tests
- [ ] `recommendForWeather`: cold weather (30F) recommends outerwear, boots
- [ ] `recommendForWeather`: hot weather (85F) recommends light items, no outerwear
- [ ] `recommendForWeather`: moderate weather (70F) recommends single layers
- [ ] `recommendForWeather`: prioritizes clean items over dirty
- [ ] `recommendForWeather`: respects season tags (winter coat not suggested in summer even if cold snap)
- [ ] `recommendForWeather`: handles empty wardrobe (returns empty array)
- [ ] `recommendForWeather`: handles items with no season tags (uses category fallback)
- [ ] `scoreItemForWeather`: returns higher score for category match + clean + recently worn
- [ ] Temperature conversion: F to C and C to F correct to 1 decimal

### Integration Tests
- [ ] Full flow: set manual city -> fetch weather -> get recommendations from wardrobe
- [ ] Cache flow: fetch weather -> wait for expiry -> auto-refresh

### QA Verification Script

1. Open app on iOS simulator
2. Navigate to MyCloset module, Wardrobe tab
3. Verify: Location opt-in card is shown (no permission yet) -- corresponds to AC-6
4. Grant location permission (or set manual city in settings)
5. Verify: Weather card appears with temperature and condition -- corresponds to AC-1, AC-2
6. Add 10 items across categories: 2 outerwear, 3 tops, 2 bottoms, 1 shoes, 1 activewear, 1 accessory
7. Tag items with seasons (some winter, some summer, some all-season)
8. Verify: "Today's Picks" shows 3-5 items appropriate for current weather -- corresponds to AC-3
9. Verify: Each suggestion shows thumbnail, name, match reason -- corresponds to AC-4
10. Tap "Build Outfit"
11. Verify: Outfit creator opens with items pre-filtered to weather-appropriate -- corresponds to AC-5
12. Go to Settings, switch temperature to Celsius
13. Verify: Temperature display updates to Celsius -- corresponds to AC-8
14. Enable airplane mode
15. Navigate away and back to Wardrobe
16. Verify: Last cached weather shown with "Last updated" timestamp -- corresponds to NC-3
17. Disable airplane mode, pull to refresh
18. Verify: Weather updates -- corresponds to AC-10
19. Repeat weather card check on web at `/closet`

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to wardrobe tab, verify weather card in all 5 states

### Required if Complexity <= 2 (Large/Complex):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. Fix issues found.

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for weather recommendation engine

### Post-merge:
- [ ] `/parity-check` -- closet module parity

## Handoff State

### Before This Work
- No weather integration exists
- Items have `seasons` array and `occasions` array
- No weather cache table

### After This Work
- Weather recommendation engine (pure function)
- Weather API client (Open-Meteo, free, no API key)
- Weather card on Wardrobe tab (mobile + web)
- Location settings (device permission or manual city)
- Temperature unit setting (F/C)

### Files Changed
- `modules/closet/src/engine/weather.ts` -- NEW: Weather scoring and recommendation engine
- `modules/closet/src/types.ts` -- Add WeatherCondition, WeatherRecommendation types
- `modules/closet/src/db/crud.ts` -- Add weather cache read/write if using SQLite cache
- `modules/closet/src/db/schema.ts` -- Add cl_weather_cache table (V3 migration)
- `modules/closet/src/definition.ts` -- Add V3 migration
- `modules/closet/src/index.ts` -- Export weather engine functions
- `modules/closet/src/__tests__/weather.test.ts` -- NEW: Weather engine tests
- `apps/mobile/app/(closet)/wardrobe.tsx` -- Add WeatherCard at top
- `apps/mobile/components/closet/WeatherCard.tsx` -- NEW: Weather display component
- `apps/web/app/closet/page.tsx` -- Web weather card

### Known Limitations
- Uses Open-Meteo (free) which has lower resolution than premium weather APIs
- No hourly forecast (just current + today's high/low)
- No rain probability integration (just current condition)
- Does not account for indoor vs outdoor activities

### Context for Next Agent
- Open-Meteo API is free, no key needed: `https://api.open-meteo.com/v1/forecast?latitude=X&longitude=Y&current_weather=true`
- Keep the recommendation engine as a pure function for testability -- weather data in, items in, scored recommendations out.
- Use `expo-location` for mobile coordinates. Request `foregroundPermissions` only.
- This engine's output can feed into the future AI outfit suggestions feature.
